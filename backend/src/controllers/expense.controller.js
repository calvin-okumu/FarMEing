const prisma = require('../lib/prisma');
const { verifyProjectAccess } = require('../lib/project-access');

// ── POST /expenses ────────────────────────────────────────────────────────────

const createExpense = async (req, res) => {
  const data = req.validatedData;

  try {
    // Require OWNER or MANAGER to create expenses
    const access = await verifyProjectAccess(data.projectId, req.user.id, res, ['OWNER', 'MANAGER']);
    if (!access) return;

    const expense = await prisma.expense.create({
      data: {
        projectId:  data.projectId,
        category:   data.category,
        expenseType: data.expenseType ?? 'OPEX',
        amount:     data.amount,
        date:       new Date(data.date),
        isRecurring: data.isRecurring ?? false,
        frequency: data.frequency ?? null,
        note:       data.note       ?? null,
        receiptUrl: data.receiptUrl ?? null,
        payee:      data.payee      ?? null,
        payeeId:    data.payeeId    ?? null,
      },
    });

    return res.status(201).json({ expense });
  } catch (error) {
    console.error('Create Expense Error:', error);
    return res.status(500).json({ error: 'Failed to create expense' });
  }
};

// ── GET /expenses/:projectId ──────────────────────────────────────────────────

const listExpenses = async (req, res) => {
  try {
    // Any role can list expenses
    const access = await verifyProjectAccess(req.params.projectId, req.user.id, res);
    if (!access) return;

    const includeDeleted = req.query.includeDeleted === 'true';

    const expenses = await prisma.expense.findMany({
      where:   { projectId: req.params.projectId, ...(includeDeleted ? {} : { isDeleted: false }) },
      orderBy: { date: 'desc' },
      include: { payeeRecord: true },
    });

    const totalAmount = parseFloat(
      expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)
    );

    return res.json({ expenses, totalAmount });
  } catch (error) {
    console.error('List Expenses Error:', error);
    return res.status(500).json({ error: 'Failed to list expenses' });
  }
};

// ── PUT /expenses/:id ─────────────────────────────────────────────────────────

const updateExpense = async (req, res) => {
  const data = req.validatedData;

  try {
    const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!expense || expense.isDeleted) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Require OWNER or MANAGER to update expenses
    const access = await verifyProjectAccess(expense.projectId, req.user.id, res, ['OWNER', 'MANAGER']);
    if (!access) return;

    const updated = await prisma.expense.update({
      where: { id: req.params.id },
      data: {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
      },
    });

    return res.json({ expense: updated });
  } catch (error) {
    console.error('Update Expense Error:', error);
    return res.status(500).json({ error: 'Failed to update expense' });
  }
};

// ── DELETE /expenses/:id (soft delete) ────────────────────────────────────────

const deleteExpense = async (req, res) => {
  try {
    const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!expense || expense.isDeleted) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Require OWNER or MANAGER to delete expenses
    const access = await verifyProjectAccess(expense.projectId, req.user.id, res, ['OWNER', 'MANAGER']);
    if (!access) return;

    await prisma.expense.update({
      where: { id: req.params.id },
      data:  { isDeleted: true },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Delete Expense Error:', error);
    return res.status(500).json({ error: 'Failed to delete expense' });
  }
};

module.exports = { createExpense, listExpenses, updateExpense, deleteExpense };
