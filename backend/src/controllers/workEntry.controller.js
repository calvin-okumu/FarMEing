const prisma = require('../lib/prisma');
const { createWorkEntrySchema, updateWorkEntrySchema } = require('../validators/workEntry.validator');

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

/** Verify project exists, belongs to user, and is not deleted. */
const findOwnedProject = async (projectId, userId, res) => {
  const project = await prisma.farmProject.findUnique({ where: { id: projectId } });
  if (!project || project.isDeleted || project.userId !== userId) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }
  return project;
};

/** Verify employee exists, belongs to user, and is not deleted. */
const findOwnedEmployee = async (employeeId, userId, res) => {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee || employee.isDeleted || employee.userId !== userId) {
    res.status(404).json({ error: 'Employee not found' });
    return null;
  }
  return employee;
};

/** Verify work entry exists and project belongs to user. */
const findOwnedEntry = async (id, userId, res) => {
  const entry = await prisma.workEntry.findUnique({ 
    where: { id },
    include: { project: true }
  });
  if (!entry || entry.isDeleted || entry.project.userId !== userId) {
    res.status(404).json({ error: 'Work entry not found' });
    return null;
  }
  return entry;
};

// ── POST /work-entries ───────────────────────────────────────────────────────

const createWorkEntry = async (req, res) => {
  const data = validate(createWorkEntrySchema, req.body, res);
  if (!data) return;

  const project = await findOwnedProject(data.projectId, req.user.id, res);
  if (!project) return;

  const employee = await findOwnedEmployee(data.employeeId, req.user.id, res);
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
};

// ── GET /work-entries/:projectId ─────────────────────────────────────────────

const listWorkEntries = async (req, res) => {
  const project = await findOwnedProject(req.params.projectId, req.user.id, res);
  if (!project) return;
  const includeDeleted = req.query.includeDeleted === 'true';

  const workEntries = await prisma.workEntry.findMany({
    where:   { projectId: req.params.projectId, ...(includeDeleted ? {} : { isDeleted: false }) },
    orderBy: { date: 'desc' },
    include: { employee: { select: { id: true, name: true } } },
  });

  return res.json({ workEntries });
};

// ── PUT /work-entries/:id ────────────────────────────────────────────────────

const updateWorkEntry = async (req, res) => {
  const entry = await findOwnedEntry(req.params.id, req.user.id, res);
  if (!entry) return;

  const data = validate(updateWorkEntrySchema, req.body, res);
  if (!data) return;

  const updated = await prisma.workEntry.update({
    where: { id: req.params.id },
    data: {
      ...data,
      date: data.date ? new Date(data.date) : undefined,
    },
  });

  return res.json({ workEntry: updated });
};

// ── DELETE /work-entries/:id (soft delete) ───────────────────────────────────

const deleteWorkEntry = async (req, res) => {
  const entry = await findOwnedEntry(req.params.id, req.user.id, res);
  if (!entry) return;

  await prisma.workEntry.update({
    where: { id: req.params.id },
    data:  { isDeleted: true },
  });

  return res.json({ message: 'Work entry deleted' });
};

const approveWorkEntry = async (req, res) => {
  const entry = await findOwnedEntry(req.params.id, req.user.id, res);
  if (!entry) return;

  const { status } = req.body;
  if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const updated = await prisma.workEntry.update({
    where: { id: req.params.id },
    data: { status },
  });

  return res.json({ workEntry: updated });
};

// ── GET /work-entries/:projectId/by-employee ──────────────────────────────────

const getWorkEntriesByEmployee = async (req, res) => {
  const project = await findOwnedProject(req.params.projectId, req.user.id, res);
  if (!project) return;

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
};

// ── GET /work-entries/:projectId/by-activity ──────────────────────────────────

const getWorkEntriesByActivity = async (req, res) => {
  const project = await findOwnedProject(req.params.projectId, req.user.id, res);
  if (!project) return;

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
