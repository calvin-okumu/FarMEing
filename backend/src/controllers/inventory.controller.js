const prisma = require('../lib/prisma');
const { createInventorySchema, updateInventorySchema } = require('../validators/inventory.validator');

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

/** Verify the project exists, belongs to the user, and is not deleted. */
const findOwnedProject = async (projectId, userId, res) => {
  const project = await prisma.farmProject.findUnique({ where: { id: projectId } });
  if (!project || project.isDeleted || project.userId !== userId) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }
  return project;
};

/** Verify the inventory item exists, is not deleted, and its project belongs to the user. */
const findOwnedItem = async (itemId, userId, res) => {
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item || item.isDeleted) {
    res.status(404).json({ error: 'Inventory item not found' });
    return null;
  }
  // Ownership via project
  const project = await prisma.farmProject.findUnique({ where: { id: item.projectId } });
  if (!project || project.isDeleted || project.userId !== userId) {
    res.status(404).json({ error: 'Inventory item not found' });
    return null;
  }
  return item;
};

// ── POST /inventory ───────────────────────────────────────────────────────────

const createInventoryItem = async (req, res) => {
  const data = validate(createInventorySchema, req.body, res);
  if (!data) return;

  const project = await findOwnedProject(data.projectId, req.user.id, res);
  if (!project) return;

  // Server-side totalCost — never trust client input
  const totalCost = parseFloat((data.quantity * data.unitCost).toFixed(2));

  // usedQty must not exceed quantity
  const usedQty = data.usedQty ?? 0;
  if (usedQty > data.quantity) {
    return res.status(400).json({ error: 'usedQty cannot exceed quantity' });
  }

  const item = await prisma.inventoryItem.create({
    data: {
      projectId: data.projectId,
      name:      data.name,
      category:  data.category,
      quantity:  data.quantity,
      unit:      data.unit,
      unitCost:  data.unitCost,
      totalCost,
      usedQty,
      notes:     data.notes ?? null,
    },
  });

  return res.status(201).json({ inventoryItem: item });
};

// ── GET /inventory/:projectId ─────────────────────────────────────────────────

const listInventoryItems = async (req, res) => {
  const project = await findOwnedProject(req.params.projectId, req.user.id, res);
  if (!project) return;

  const items = await prisma.inventoryItem.findMany({
    where:   { projectId: req.params.projectId, isDeleted: false },
    orderBy: { createdAt: 'asc' },
  });

  const grandTotalCost = parseFloat(
    items.reduce((sum, i) => sum + i.totalCost, 0).toFixed(2)
  );

  return res.json({ inventoryItems: items, grandTotalCost });
};

// ── PUT /inventory/:id ────────────────────────────────────────────────────────

const updateInventoryItem = async (req, res) => {
  const item = await findOwnedItem(req.params.id, req.user.id, res);
  if (!item) return;

  const data = validate(updateInventorySchema, req.body, res);
  if (!data) return;

  // Recalculate totalCost with updated or existing values
  const quantity = data.quantity ?? item.quantity;
  const unitCost = data.unitCost ?? item.unitCost;
  const totalCost = parseFloat((quantity * unitCost).toFixed(2));

  // Validate usedQty doesn't exceed the effective quantity
  const usedQty = data.usedQty ?? item.usedQty;
  if (usedQty > quantity) {
    return res.status(400).json({ error: 'usedQty cannot exceed quantity' });
  }

  const updated = await prisma.inventoryItem.update({
    where: { id: req.params.id },
    data:  { ...data, totalCost },
  });

  return res.json({ inventoryItem: updated });
};

// ── DELETE /inventory/:id (soft delete) ───────────────────────────────────────

const deleteInventoryItem = async (req, res) => {
  const item = await findOwnedItem(req.params.id, req.user.id, res);
  if (!item) return;

  await prisma.inventoryItem.update({
    where: { id: req.params.id },
    data:  { isDeleted: true },
  });

  return res.json({ message: 'Inventory item deleted' });
};

module.exports = {
  createInventoryItem,
  listInventoryItems,
  updateInventoryItem,
  deleteInventoryItem,
};
