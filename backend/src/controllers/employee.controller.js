const prisma = require('../lib/prisma');
const { createEmployeeSchema, updateEmployeeSchema } = require('../validators/employee.validator');

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
 * Find an employee that belongs to the authenticated user and is not deleted.
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

// ── POST /employees ───────────────────────────────────────────────────────────

const createEmployee = async (req, res) => {
  const data = validate(createEmployeeSchema, req.body, res);
  if (!data) return;

  const employee = await prisma.employee.create({
    data: {
      userId: req.user.id,
      name:   data.name,
      phone:  data.phone ?? null,
      role:   data.role  ?? null,
    },
  });

  return res.status(201).json({ employee });
};

// ── GET /employees ────────────────────────────────────────────────────────────

const listEmployees = async (req, res) => {
  const includeDeleted = req.query.includeDeleted === 'true';
  const employees = await prisma.employee.findMany({
    where:   { userId: req.user.id, ...(includeDeleted ? {} : { isDeleted: false }) },
    orderBy: { createdAt: 'desc' },
  });

  return res.json({ employees });
};

// ── PUT /employees/:id ────────────────────────────────────────────────────────

const updateEmployee = async (req, res) => {
  const employee = await findOwnedEmployee(req.params.id, req.user.id, res);
  if (!employee) return;

  const data = validate(updateEmployeeSchema, req.body, res);
  if (!data) return;

  const updated = await prisma.employee.update({
    where: { id: req.params.id },
    data,
  });

  return res.json({ employee: updated });
};

// ── DELETE /employees/:id (soft delete) ───────────────────────────────────────

const deleteEmployee = async (req, res) => {
  const employee = await findOwnedEmployee(req.params.id, req.user.id, res);
  if (!employee) return;

  await prisma.employee.update({
    where: { id: req.params.id },
    data:  { isDeleted: true },
  });

  return res.json({ message: 'Employee deleted' });
};

// ── GET /employees/:id/balance ────────────────────────────────────────────────
// totalEarned  = sum of WorkEntry.totalCost  (non-deleted entries)
// totalPaid    = sum of Payment.amount        (non-deleted payments)
// balance      = totalEarned - totalPaid      (amount still owed)

const getEmployeeBalance = async (req, res) => {
  const employee = await findOwnedEmployee(req.params.id, req.user.id, res);
  if (!employee) return;

  const [earnedAgg, paidAgg] = await Promise.all([
    prisma.workEntry.aggregate({
      where: { employeeId: req.params.id, isDeleted: false },
      _sum:  { totalCost: true },
    }),
    prisma.payment.aggregate({
      where: { employeeId: req.params.id, isDeleted: false },
      _sum:  { amount: true },
    }),
  ]);

  const totalEarned = parseFloat((earnedAgg._sum.totalCost ?? 0).toFixed(2));
  const totalPaid   = parseFloat((paidAgg._sum.amount     ?? 0).toFixed(2));
  const balance     = parseFloat((totalEarned - totalPaid).toFixed(2));

  return res.json({
    employee: {
      id:    employee.id,
      name:  employee.name,
      phone: employee.phone,
      role:  employee.role,
    },
    balance: {
      totalEarned,
      totalPaid,
      outstanding: balance,  // positive = still owed to employee
    },
  });
};

module.exports = {
  createEmployee,
  listEmployees,
  updateEmployee,
  deleteEmployee,
  getEmployeeBalance,
};
