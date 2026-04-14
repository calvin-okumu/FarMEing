const prisma = require('../lib/prisma');
const { createExpenseSchema, updateExpenseSchema } = require('../validators/expense.validator');

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

/** Verify the project exists, belongs to the user, and is not soft-deleted. */
const findOwnedProject = async (projectId, userId, res) => {
  const project = await prisma.farmProject.findUnique({ where: { id: projectId } });
  if (!project || project.isDeleted || project.userId !== userId) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }
  return project;
};

/** Verify the expense exists, is not soft-deleted, and belongs to the user's project. */
const findOwnedExpense = async (expenseId, userId, res) => {
  const expense = await prisma.expense.findUnique({
    where:   { id: expenseId },
    include: { project: { select: { userId: true, isDeleted: true } } },
  });
  if (
    !expense ||
    expense.isDeleted ||
    expense.project.isDeleted ||
    expense.project.userId !== userId
  ) {
    res.status(404).json({ error: 'Expense not found' });
    return null;
  }
  return expense;
};

// ── POST /expenses ────────────────────────────────────────────────────────────

const createExpense = async (req, res) => {
  const data = validate(createExpenseSchema, req.body, res);
  if (!data) return;

  const project = await findOwnedProject(data.projectId, req.user.id, res);
  if (!project) return;

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
    },
  });

  return res.status(201).json({ expense });
};

// ── GET /expenses/:projectId ──────────────────────────────────────────────────

const listExpenses = async (req, res) => {
  const project = await findOwnedProject(req.params.projectId, req.user.id, res);
  if (!project) return;
  const includeDeleted = req.query.includeDeleted === 'true';

  const expenses = await prisma.expense.findMany({
    where:   { projectId: req.params.projectId, ...(includeDeleted ? {} : { isDeleted: false }) },
    orderBy: { date: 'desc' },
  });

  const totalAmount = parseFloat(
    expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)
  );

  return res.json({ expenses, totalAmount });
};

// ── PUT /expenses/:id ─────────────────────────────────────────────────────────

const updateExpense = async (req, res) => {
  const expense = await findOwnedExpense(req.params.id, req.user.id, res);
  if (!expense) return;

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
  const expense = await findOwnedExpense(req.params.id, req.user.id, res);
  if (!expense) return;

  await prisma.expense.update({
    where: { id: req.params.id },
    data:  { isDeleted: true },
  });

  return res.json({ message: 'Expense deleted' });
};

module.exports = { createExpense, listExpenses, updateExpense, deleteExpense };
