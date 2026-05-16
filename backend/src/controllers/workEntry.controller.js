const prisma = require('../lib/prisma');
const { verifyProjectAccess } = require('../lib/project-access');

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

/** Verify work entry exists and project is accessible. */
const findWorkEntry = async (id, res) => {
  try {
    const entry = await prisma.workEntry.findUnique({ 
      where: { id },
    });
    if (!entry || entry.isDeleted) {
      res.status(404).json({ error: 'Work entry not found' });
      return null;
    }
    return entry;
  } catch (error) {
    console.error('Find Work Entry Error:', error);
    res.status(500).json({ error: 'Internal server error' });
    return null;
  }
};

// ── POST /work-entries ───────────────────────────────────────────────────────

const createWorkEntry = async (req, res) => {
  const data = req.validatedData;

  try {
    const access = await verifyProjectAccess(data.projectId, req.user.id, res, ['OWNER', 'MANAGER']);
    if (!access) return;

    const employee = await findAccessibleEmployee(data.employeeId, req.user.id, res);
    if (!employee) return;

    const workEntry = await prisma.workEntry.create({
      data: {
        projectId:   data.projectId,
        employeeId:  data.employeeId,
        activity:    data.activity,
        date:        new Date(data.date),
        daysWorked:  data.daysWorked,
        ratePerDay:  data.ratePerDay,
        totalCost:   parseFloat((data.daysWorked * data.ratePerDay).toFixed(2)),
        hoursWorked: data.hoursWorked ?? null,
        imageUrl:    data.imageUrl ?? null,
        locationLat: data.locationLat ?? null,
        locationLng: data.locationLng ?? null,
        status:      data.status ?? 'PENDING',
        isRecurring: data.isRecurring ?? false,
        frequency:   data.frequency ?? null,
        notes:       data.notes ?? null,
      },
    });

    return res.status(201).json({ workEntry });
  } catch (error) {
    console.error('Create Work Entry Error:', error);
    return res.status(500).json({ error: 'Failed to create work entry' });
  }
};

// ── GET /work-entries/:projectId ─────────────────────────────────────────────

const listWorkEntries = async (req, res) => {
  try {
    const access = await verifyProjectAccess(req.params.projectId, req.user.id, res);
    if (!access) return;
    const includeDeleted = req.query.includeDeleted === 'true';

    const workEntries = await prisma.workEntry.findMany({
      where:   { projectId: req.params.projectId, ...(includeDeleted ? {} : { isDeleted: false }) },
      orderBy: { date: 'desc' },
      include: { employee: { select: { id: true, name: true } } },
    });

    return res.json({ workEntries });
  } catch (error) {
    console.error('List Work Entries Error:', error);
    return res.status(500).json({ error: 'Failed to list work entries' });
  }
};

// ── PUT /work-entries/:id ────────────────────────────────────────────────────

const updateWorkEntry = async (req, res) => {
  const data = req.validatedData;

  try {
    const entry = await findWorkEntry(req.params.id, res);
    if (!entry) return;

    const access = await verifyProjectAccess(entry.projectId, req.user.id, res, ['OWNER', 'MANAGER']);
    if (!access) return;

    const updated = await prisma.workEntry.update({
      where: { id: req.params.id },
      data: {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
      },
    });

    return res.json({ workEntry: updated });
  } catch (error) {
    console.error('Update Work Entry Error:', error);
    return res.status(500).json({ error: 'Failed to update work entry' });
  }
};

// ── DELETE /work-entries/:id (soft delete) ───────────────────────────────────

const deleteWorkEntry = async (req, res) => {
  try {
    const entry = await findWorkEntry(req.params.id, res);
    if (!entry) return;

    const access = await verifyProjectAccess(entry.projectId, req.user.id, res, ['OWNER', 'MANAGER']);
    if (!access) return;

    await prisma.workEntry.update({
      where: { id: req.params.id },
      data:  { isDeleted: true },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Delete Work Entry Error:', error);
    return res.status(500).json({ error: 'Failed to delete work entry' });
  }
};

const approveWorkEntry = async (req, res) => {
  const { status } = req.body;
  if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const entry = await findWorkEntry(req.params.id, res);
    if (!entry) return;

    const access = await verifyProjectAccess(entry.projectId, req.user.id, res, ['OWNER', 'MANAGER']);
    if (!access) return;

    const updated = await prisma.workEntry.update({
      where: { id: req.params.id },
      data: { status },
    });

    return res.json({ workEntry: updated });
  } catch (error) {
    console.error('Approve Work Entry Error:', error);
    return res.status(500).json({ error: 'Failed to approve/reject work entry' });
  }
};

// ── GET /work-entries/:projectId/by-employee ──────────────────────────────────

const getWorkEntriesByEmployee = async (req, res) => {
  try {
    const access = await verifyProjectAccess(req.params.projectId, req.user.id, res);
    if (!access) return;

    const groups = await prisma.workEntry.groupBy({
      by: ['employeeId'],
      where: { projectId: req.params.projectId, isDeleted: false },
      _sum: { totalCost: true, daysWorked: true },
      _count: { id: true },
    });

    // Fetch employee names
    const employeeIds = groups.map(g => g.employeeId);
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, name: true }
    });

    const employeeMap = new Map(employees.map(e => [e.id, e.name]));

    const result = groups.map(g => ({
      employeeId: g.employeeId,
      employeeName: employeeMap.get(g.employeeId) || 'Unknown',
      totalCost: g._sum.totalCost ?? 0,
      totalDays: g._sum.daysWorked ?? 0,
      entryCount: g._count.id,
    })).sort((a, b) => b.totalCost - a.totalCost);

    return res.json({ byEmployee: result });
  } catch (error) {
    console.error('Get Work Entries By Employee Error:', error);
    return res.status(500).json({ error: 'Failed to get work entries by employee' });
  }
};

// ── GET /work-entries/:projectId/by-activity ──────────────────────────────────

const getWorkEntriesByActivity = async (req, res) => {
  try {
    const access = await verifyProjectAccess(req.params.projectId, req.user.id, res);
    if (!access) return;

    const groups = await prisma.workEntry.groupBy({
      by: ['activity'],
      where: { projectId: req.params.projectId, isDeleted: false },
      _sum: { totalCost: true, daysWorked: true },
      _count: { id: true },
    });

    const result = groups.map(g => ({
      activity: g.activity,
      totalCost: g._sum.totalCost ?? 0,
      totalDays: g._sum.daysWorked ?? 0,
      entryCount: g._count.id,
    })).sort((a, b) => b.totalCost - a.totalCost);

    return res.json({ byActivity: result });
  } catch (error) {
    console.error('Get Work Entries By Activity Error:', error);
    return res.status(500).json({ error: 'Failed to get work entries by activity' });
  }
};

module.exports = {
  createWorkEntry,
  listWorkEntries,
  updateWorkEntry,
  deleteWorkEntry,
  approveWorkEntry,
  getWorkEntriesByEmployee,
  getWorkEntriesByActivity,
};
