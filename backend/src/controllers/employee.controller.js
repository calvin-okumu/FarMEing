const prisma = require('../lib/prisma');

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Find an employee that the user is authorized to see.
 * Authorization: Either the user created the employee, 
 * OR the employee is assigned to a project the user has access to.
 */
const findAccessibleEmployee = async (employeeId, userId, res) => {
  try {
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
  } catch (error) {
    console.error('Find Accessible Employee Error:', error);
    res.status(500).json({ error: 'Internal server error' });
    return null;
  }
};

// ── POST /employees ───────────────────────────────────────────────────────────

const createEmployee = async (req, res) => {
  const data = req.validatedData;

  try {
    const employee = await prisma.employee.create({
      data: {
        userId: req.user.id,
        name:   data.name,
        phone:  data.phone ?? null,
        role:   data.role  ?? null,
      },
    });

    return res.status(201).json({ employee });
  } catch (error) {
    console.error('Create Employee Error:', error);
    return res.status(500).json({ error: 'Failed to create employee' });
  }
};

// ── GET /employees ────────────────────────────────────────────────────────────

const listEmployees = async (req, res) => {
  const includeDeleted = req.query.includeDeleted === 'true';
  
  try {
    // Find employees created by user OR assigned to projects user has access to
    const employees = await prisma.employee.findMany({
      where: {
        ...(includeDeleted ? {} : { isDeleted: false }),
        OR: [
          { userId: req.user.id },
          { assignments: { some: { project: { projectAccess: { some: { userId: req.user.id } } } } } }
        ]
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ employees });
  } catch (error) {
    console.error('List Employees Error:', error);
    return res.status(500).json({ error: 'Failed to list employees' });
  }
};

// ── PUT /employees/:id ────────────────────────────────────────────────────────

const updateEmployee = async (req, res) => {
  const employee = await findAccessibleEmployee(req.params.id, req.user.id, res);
  if (!employee) return;

  const data = req.validatedData;

  try {
    const updated = await prisma.employee.update({
      where: { id: req.params.id },
      data,
    });

    return res.json({ employee: updated });
  } catch (error) {
    console.error('Update Employee Error:', error);
    return res.status(500).json({ error: 'Failed to update employee' });
  }
};

// ── DELETE /employees/:id (soft delete) ───────────────────────────────────────

const deleteEmployee = async (req, res) => {
  const employee = await findAccessibleEmployee(req.params.id, req.user.id, res);
  if (!employee) return;

  try {
    await prisma.employee.update({
      where: { id: req.params.id },
      data:  { isDeleted: true },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Delete Employee Error:', error);
    return res.status(500).json({ error: 'Failed to delete employee' });
  }
};

// ── GET /employees/:id/balance ────────────────────────────────────────────────

const getEmployeeBalance = async (req, res) => {
  const employee = await findAccessibleEmployee(req.params.id, req.user.id, res);
  if (!employee) return;

  try {
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
  } catch (error) {
    console.error('Get Employee Balance Error:', error);
    return res.status(500).json({ error: 'Failed to get employee balance' });
  }
};

module.exports = {
  createEmployee,
  listEmployees,
  updateEmployee,
  deleteEmployee,
  getEmployeeBalance,
};
