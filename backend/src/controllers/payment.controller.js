const prisma = require('../lib/prisma');
const { createPaymentSchema } = require('../validators/payment.validator');

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
 * Verify the employee exists, belongs to the user, and is not deleted.
 * Returns the employee or sends 404 and returns null.
 */
const findOwnedEmployee = async (employeeId, userId, res) => {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee || employee.isDeleted || employee.userId !== userId) {
    res.status(404).json({ error: 'Employee not found' });
    return null;
  }
  return employee;
};

// ── POST /payments ────────────────────────────────────────────────────────────

const createPayment = async (req, res) => {
  const data = validate(createPaymentSchema, req.body, res);
  if (!data) return;

  const employee = await findOwnedEmployee(data.employeeId, req.user.id, res);
  if (!employee) return;

  const payment = await prisma.payment.create({
    data: {
      employeeId: data.employeeId,
      amount:     data.amount,
      date:       new Date(data.date),
      note:       data.note ?? null,
    },
  });

  return res.status(201).json({ payment });
};

// ── GET /payments/:employeeId ─────────────────────────────────────────────────

const listPayments = async (req, res) => {
  const employee = await findOwnedEmployee(req.params.employeeId, req.user.id, res);
  if (!employee) return;

  const payments = await prisma.payment.findMany({
    where:   { employeeId: req.params.employeeId },
    orderBy: { date: 'desc' },
  });

  const totalPaid = parseFloat(
    payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)
  );

  return res.json({ payments, totalPaid });
};

module.exports = { createPayment, listPayments };
