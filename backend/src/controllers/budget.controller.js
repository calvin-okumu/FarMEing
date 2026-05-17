const prisma = require('../lib/prisma');
const { verifyProjectAccess } = require('../lib/project-access');

// ── POST /budget ──────────────────────────────────────────────────────────────

const createBudgetItem = async (req, res) => {
  const data = req.validatedData;

  try {
    const access = await verifyProjectAccess(data.projectId, req.user.id, res, ['OWNER', 'MANAGER']);
    if (!access) return;

    // Server-side total calculation — never trust client input
    const total = parseFloat((data.quantity * data.unitPrice).toFixed(2));

    const item = await prisma.budgetItem.create({
      data: {
        projectId: data.projectId,
        blockId:   data.blockId ?? null,
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
  } catch (error) {
    console.error('Create Budget Item Error:', error);
    return res.status(500).json({ error: 'Failed to create budget item' });
  }
};

// ── GET /budget/:projectId ────────────────────────────────────────────────────

const listBudgetItems = async (req, res) => {
  try {
    const access = await verifyProjectAccess(req.params.projectId, req.user.id, res);
    if (!access) return;
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
  } catch (error) {
    console.error('List Budget Items Error:', error);
    return res.status(500).json({ error: 'Failed to list budget items' });
  }
};

// ── PUT /budget/:id ───────────────────────────────────────────────────────────

const updateBudgetItem = async (req, res) => {
  const data = req.validatedData;

  try {
    const item = await prisma.budgetItem.findUnique({ where: { id: req.params.id } });
    if (!item || item.isDeleted) return res.status(404).json({ error: 'Budget item not found' });

    const access = await verifyProjectAccess(item.projectId, req.user.id, res, ['OWNER', 'MANAGER']);
    if (!access) return;

    // Recalculate total with updated or existing values
    const quantity  = data.quantity  ?? item.quantity;
    const unitPrice = data.unitPrice ?? item.unitPrice;
    const total     = parseFloat((quantity * unitPrice).toFixed(2));

    const updated = await prisma.budgetItem.update({
      where: { id: req.params.id },
      data:  { ...data, total },
    });

    return res.json({ budgetItem: updated });
  } catch (error) {
    console.error('Update Budget Item Error:', error);
    return res.status(500).json({ error: 'Failed to update budget item' });
  }
};

// ── DELETE /budget/:id (soft delete) ──────────────────────────────────────────

const deleteBudgetItem = async (req, res) => {
  try {
    const item = await prisma.budgetItem.findUnique({ where: { id: req.params.id } });
    if (!item || item.isDeleted) return res.status(404).json({ error: 'Budget item not found' });

    const access = await verifyProjectAccess(item.projectId, req.user.id, res, ['OWNER', 'MANAGER']);
    if (!access) return;

    await prisma.budgetItem.update({
      where: { id: req.params.id },
      data:  { isDeleted: true },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Delete Budget Item Error:', error);
    return res.status(500).json({ error: 'Failed to delete budget item' });
  }
};

module.exports = { createBudgetItem, listBudgetItems, updateBudgetItem, deleteBudgetItem };
