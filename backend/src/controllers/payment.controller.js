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
 * Find an employee that the user is authorized to see.
 * Authorization: Either the user created the employee, 
 * OR the employee is assigned to a project the user has access to.
 */
const findAccessibleEmployee = async (employeeId, userId, res) => {
  const employee = await prisma.employee.findUnique({ 
    where: { id: employeeId },
    include: {
      assignments: {
        where: { project: { projectAccess: { some: { userId } } } }
      }
    }
  });

  if (!employee || employee.isDeleted) {
    res.status(404).json({ error: 'Employee not found' });
    return null;
  }

  // Check if user is the creator OR has access via an assignment
  if (employee.userId !== userId && employee.assignments.length === 0) {
    res.status(403).json({ error: 'Permission denied' });
    return null;
  }

  return employee;
};

/**
 * Check if the user has OWNER or MANAGER access to the employee.
 * This means they either created the employee, OR they have an 
 * OWNER/MANAGER role on at least one project the employee is assigned to.
 */
const hasManagerialAccess = async (employee, userId) => {
  if (employee.userId === userId) return true;

  const access = await prisma.projectAccess.findFirst({
    where: {
      userId,
      role: { in: ['OWNER', 'MANAGER'] },
      project: { employees: { some: { employeeId: employee.id } } }
    }
  });

  return !!access;
};

// ── POST /payments ────────────────────────────────────────────────────────────

const createPayment = async (req, res) => {
  const data = validate(createPaymentSchema, req.body, res);
  if (!data) return;

  const employee = await findAccessibleEmployee(data.employeeId, req.user.id, res);
  if (!employee) return;

  if (!(await hasManagerialAccess(employee, req.user.id))) {
    return res.status(403).json({ error: 'Permission denied: Requires OWNER or MANAGER role' });
  }

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

// ── GET /payments ──────────────────────────────────────────────────────────────

const listAllPayments = async (req, res) => {
  const includeDeleted = req.query.includeDeleted === 'true';
  
  // Find payments for employees created by user OR assigned to projects user has access to
  const payments = await prisma.payment.findMany({
    where: {
      ...(includeDeleted ? {} : { isDeleted: false }),
      employee: {
        isDeleted: false,
        OR: [
          { userId: req.user.id },
          { assignments: { some: { project: { projectAccess: { some: { userId: req.user.id } } } } } }
        ]
      },
    },
    orderBy: { date: 'desc' },
  });

  return res.json({ payments });
};

// ── GET /payments/:employeeId ─────────────────────────────────────────────────

const listPayments = async (req, res) => {
  const includeDeleted = req.query.includeDeleted === 'true';
  const employee = await findAccessibleEmployee(req.params.employeeId, req.user.id, res);
  if (!employee) return;

  const payments = await prisma.payment.findMany({
    where:   { employeeId: req.params.employeeId, ...(includeDeleted ? {} : { isDeleted: false }) },
    orderBy: { date: 'desc' },
  });

  const totalPaid = parseFloat(
    payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)
  );

  return res.json({ payments, totalPaid });
};

// ── DELETE /payments/:id (soft delete) ────────────────────────────────────────

const deletePayment = async (req, res) => {
  const payment = await prisma.payment.findUnique({
    where: { id: req.params.id },
    include: { employee: true },
  });

  if (!payment || payment.isDeleted || payment.employee.isDeleted) {
    return res.status(404).json({ error: 'Payment not found' });
  }

  const employee = await findAccessibleEmployee(payment.employeeId, req.user.id, res);
  if (!employee) return;

  if (!(await hasManagerialAccess(employee, req.user.id))) {
    return res.status(403).json({ error: 'Permission denied: Requires OWNER or MANAGER role' });
  }

  await prisma.payment.update({
    where: { id: req.params.id },
    data: { isDeleted: true },
  });

  return res.json({ message: 'Payment deleted' });
};

module.exports = { createPayment, listAllPayments, listPayments, deletePayment };
