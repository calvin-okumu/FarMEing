const prisma = require('../lib/prisma');
const { createBudgetItemSchema, updateBudgetItemSchema } = require('../validators/budget.validator');

// ── helpers ──────────────────────────────────────────────────────────────────

const validate = (schema, body, res) => {
  const result = schema.safeParse(body);
  if (!result.success) {
    res.status(400).json({
      error: 'Validation failed',
      details: result.error.issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return null;
  }
  return result.data;
};

/**
 * Verify the project exists, belongs to the authenticated user, and is not deleted.
 * Returns the project or sends 404 and returns null.
 */
const findOwnedProject = async (projectId, userId, res) => {
  const project = await prisma.farmProject.findUnique({ where: { id: projectId } });
  if (!project || project.isDeleted || project.userId !== userId) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }
  return project;
};

/**
 * Verify the budget item exists, is not deleted, and its project belongs to the user.
 * Returns the item or sends 404 and returns null.
 */
const findOwnedItem = async (itemId, userId, res) => {
  const item = await prisma.budgetItem.findUnique({
    where:   { id: itemId },
    include: { project: { select: { userId: true, isDeleted: true } } },
  });
  if (!item || item.isDeleted || item.project.isDeleted || item.project.userId !== userId) {
    res.status(404).json({ error: 'Budget item not found' });
    return null;
  }
  return item;
};

// ── POST /budget ──────────────────────────────────────────────────────────────

const createBudgetItem = async (req, res) => {
  const data = validate(createBudgetItemSchema, req.body, res);
  if (!data) return;

  const project = await findOwnedProject(data.projectId, req.user.id, res);
  if (!project) return;

  // Server-side total calculation — never trust client input
  const total = parseFloat((data.quantity * data.unitPrice).toFixed(2));

  const item = await prisma.budgetItem.create({
    data: {
      projectId: data.projectId,
      category:  data.category,
      name:      data.name,
      quantity:  data.quantity,
      unit:      data.unit,
      unitPrice: data.unitPrice,
      total,
      notes:     data.notes ?? null,
    },
  });

  return res.status(201).json({ budgetItem: item });
};

// ── GET /budget/:projectId ────────────────────────────────────────────────────

const listBudgetItems = async (req, res) => {
  const project = await findOwnedProject(req.params.projectId, req.user.id, res);
  if (!project) return;
  const includeDeleted = req.query.includeDeleted === 'true';

  const items = await prisma.budgetItem.findMany({
    where:   { projectId: req.params.projectId, ...(includeDeleted ? {} : { isDeleted: false }) },
    orderBy: { createdAt: 'asc' },
  });

  // Provide a convenience total across all items
  const grandTotal = parseFloat(
    items.reduce((sum, i) => sum + i.total, 0).toFixed(2)
  );

  return res.json({ budgetItems: items, grandTotal });
};

// ── PUT /budget/:id ───────────────────────────────────────────────────────────

const updateBudgetItem = async (req, res) => {
  const item = await findOwnedItem(req.params.id, req.user.id, res);
  if (!item) return;

  const data = validate(updateBudgetItemSchema, req.body, res);
  if (!data) return;

  // Recalculate total with updated or existing values
  const quantity  = data.quantity  ?? item.quantity;
  const unitPrice = data.unitPrice ?? item.unitPrice;
  const total     = parseFloat((quantity * unitPrice).toFixed(2));

  const updated = await prisma.budgetItem.update({
    where: { id: req.params.id },
    data:  { ...data, total },
  });

  return res.json({ budgetItem: updated });
};

// ── DELETE /budget/:id (soft delete) ──────────────────────────────────────────

const deleteBudgetItem = async (req, res) => {
  const item = await findOwnedItem(req.params.id, req.user.id, res);
  if (!item) return;

  await prisma.budgetItem.update({
    where: { id: req.params.id },
    data:  { isDeleted: true },
  });

  return res.json({ message: 'Budget item deleted' });
};

module.exports = { createBudgetItem, listBudgetItems, updateBudgetItem, deleteBudgetItem };
