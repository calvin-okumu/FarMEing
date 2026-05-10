const prisma = require('../lib/prisma');
const { createPayeeSchema, updatePayeeSchema } = require('../validators/payee.validator');

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
 * Find a payee that belongs to the authenticated user and is not deleted.
 * Returns the payee or sends 404 and returns null.
 */
const findOwnedPayee = async (payeeId, userId, res) => {
  const payee = await prisma.payee.findUnique({ where: { id: payeeId } });
  if (!payee || payee.isDeleted || payee.userId !== userId) {
    res.status(404).json({ error: 'Payee not found' });
    return null;
  }
  return payee;
};

// ── POST /payees ─────────────────────────────────────────────────────────────

const createPayee = async (req, res) => {
  const data = validate(createPayeeSchema, req.body, res);
  if (!data) return;

  const payee = await prisma.payee.create({
    data: {
      userId:   req.user.id,
      name:     data.name,
      phone:    data.phone    ?? null,
      email:    data.email    ?? null,
      address:  data.address  ?? null,
      category: data.category ?? null,
      notes:    data.notes    ?? null,
    },
  });

  return res.status(201).json({ payee });
};

// ── GET /payees ──────────────────────────────────────────────────────────────

const listPayees = async (req, res) => {
  const includeDeleted = req.query.includeDeleted === 'true';
  const payees = await prisma.payee.findMany({
    where:   { userId: req.user.id, ...(includeDeleted ? {} : { isDeleted: false }) },
    orderBy: { createdAt: 'desc' },
  });

  return res.json({ payees });
};

// ── GET /payees/:id ──────────────────────────────────────────────────────────

const getPayee = async (req, res) => {
  const payee = await findOwnedPayee(req.params.id, req.user.id, res);
  if (!payee) return;

  return res.json({ payee });
};

// ── PUT /payees/:id ──────────────────────────────────────────────────────────

const updatePayee = async (req, res) => {
  const payee = await findOwnedPayee(req.params.id, req.user.id, res);
  if (!payee) return;

  const data = validate(updatePayeeSchema, req.body, res);
  if (!data) return;

  const updated = await prisma.payee.update({
    where: { id: req.params.id },
    data,
  });

  return res.json({ payee: updated });
};

// ── DELETE /payees/:id (soft delete) ─────────────────────────────────────────

const deletePayee = async (req, res) => {
  const payee = await findOwnedPayee(req.params.id, req.user.id, res);
  if (!payee) return;

  await prisma.payee.update({
    where: { id: req.params.id },
    data:  { isDeleted: true },
  });

  return res.json({ message: 'Payee deleted' });
};

// ── GET /payees/:id/summary ──────────────────────────────────────────────────

const getPayeeSummary = async (req, res) => {
  const payee = await findOwnedPayee(req.params.id, req.user.id, res);
  if (!payee) return;

  const [expenseAgg, inventoryAgg] = await Promise.all([
    prisma.expense.aggregate({
      where: { payeeId: req.params.id, isDeleted: false },
      _sum:  { amount: true },
    }),
    prisma.inventoryItem.aggregate({
      where: { payeeId: req.params.id, isDeleted: false },
      _sum:  { totalCost: true },
    }),
  ]);

  const totalSpentExpenses = parseFloat((expenseAgg._sum.amount ?? 0).toFixed(2));
  const totalSpentInventory = parseFloat((inventoryAgg._sum.totalCost ?? 0).toFixed(2));
  const totalSpent = parseFloat((totalSpentExpenses + totalSpentInventory).toFixed(2));

  return res.json({
    payee: {
      id:       payee.id,
      name:     payee.name,
      category: payee.category,
    },
    summary: {
      totalSpentExpenses,
      totalSpentInventory,
      totalSpent,
    },
  });
};

module.exports = {
  createPayee,
  listPayees,
  getPayee,
  updatePayee,
  deletePayee,
  getPayeeSummary,
};
