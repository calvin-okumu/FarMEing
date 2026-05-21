const prisma = require('../lib/prisma');
const { createExpenseSchema, updateExpenseSchema } = require('../validators/expense.validator');
const { verifyProjectAccess } = require('../lib/project-access');

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

// ── POST /expenses ────────────────────────────────────────────────────────────

const createExpense = async (req, res) => {
  const data = validate(createExpenseSchema, req.body, res);
  if (!data) return;

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
};

// ── GET /expenses/:projectId ──────────────────────────────────────────────────

const listExpenses = async (req, res) => {
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
};

// ── PUT /expenses/:id ─────────────────────────────────────────────────────────

const updateExpense = async (req, res) => {
  const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
  if (!expense || expense.isDeleted) {
    return res.status(404).json({ error: 'Expense not found' });
  }

  // Require OWNER or MANAGER to update expenses
  const access = await verifyProjectAccess(expense.projectId, req.user.id, res, ['OWNER', 'MANAGER']);
  if (!access) return;

  const data = validate(updateExpenseSchema, req.body, res);
  if (!data) return;

  const updated = await prisma.expense.update({
    where: { id: req.params.id },
    data: {
      ...data,
      date: data.date ? new Date(data.date) : undefined,
    },
  });

  return res.json({ expense: updated });
};

// ── DELETE /expenses/:id (soft delete) ────────────────────────────────────────

const deleteExpense = async (req, res) => {
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

  return res.json({ message: 'Expense deleted' });
};

module.exports = { createExpense, listExpenses, updateExpense, deleteExpense };
