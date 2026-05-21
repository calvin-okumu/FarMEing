const prisma = require('../lib/prisma');
const { verifyProjectAccess } = require('../lib/project-access');

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Find an employee and verify the user has access to at least one project they are assigned to.
 */
const findAccessibleEmployee = async (employeeId, userId, res, requiredRoles = []) => {
  try {
    const employee = await prisma.employee.findUnique({ 
      where: { id: employeeId },
      include: {
        assignments: {
          where: { isDeleted: false },
          select: { projectId: true }
        }
      }
    });

    if (!employee || employee.isDeleted) {
      res.status(404).json({ error: 'Employee not found' });
      return null;
    }

    // User always has access to employees they created
    if (employee.userId === userId) return employee;

    // Otherwise, check if user has access to any of the employee's assigned projects
    if (employee.assignments.length === 0) {
      res.status(403).json({ error: 'Permission denied: Employee is not assigned to any projects you access' });
      return null;
    }

    const projectIds = employee.assignments.map(a => a.projectId);
    const access = await prisma.projectAccess.findFirst({
      where: {
        userId,
        projectId: { in: projectIds },
        ...(requiredRoles.length > 0 ? { role: { in: requiredRoles } } : {})
      }
    });

    if (!access) {
      res.status(403).json({ error: 'Permission denied' });
      return null;
    }

    return employee;
  } catch (error) {
    console.error('Find Accessible Employee Error:', error);
    res.status(500).json({ error: 'Internal server error' });
    return null;
  }
};

// ── POST /payments ────────────────────────────────────────────────────────────

const createPayment = async (req, res) => {
  const data = req.validatedData;

  try {
    // Require OWNER or MANAGER access to create payments
    const employee = await findAccessibleEmployee(data.employeeId, req.user.id, res, ['OWNER', 'MANAGER']);
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
  } catch (error) {
    console.error('Create Payment Error:', error);
    return res.status(500).json({ error: 'Failed to create payment' });
  }
};

// ── GET /payments ──────────────────────────────────────────────────────────────

const listAllPayments = async (req, res) => {
  const includeDeleted = req.query.includeDeleted === 'true';
  
  try {
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
  } catch (error) {
    console.error('List All Payments Error:', error);
    return res.status(500).json({ error: 'Failed to list payments' });
  }
};

// ── GET /payments/:employeeId ─────────────────────────────────────────────────

const listPayments = async (req, res) => {
  const includeDeleted = req.query.includeDeleted === 'true';
  
  try {
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
  } catch (error) {
    console.error('List Payments Error:', error);
    return res.status(500).json({ error: 'Failed to list payments' });
  }
};

// ── DELETE /payments/:id (soft delete) ────────────────────────────────────────

const deletePayment = async (req, res) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: { employee: true },
    });

    if (!payment || payment.isDeleted || payment.employee.isDeleted) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Require OWNER or MANAGER access to delete payments
    const employee = await findAccessibleEmployee(payment.employeeId, req.user.id, res, ['OWNER', 'MANAGER']);
    if (!employee) return;

    await prisma.payment.update({
      where: { id: req.params.id },
      data: { isDeleted: true },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Delete Payment Error:', error);
    return res.status(500).json({ error: 'Failed to delete payment' });
  }
};

module.exports = { createPayment, listAllPayments, listPayments, deletePayment };
