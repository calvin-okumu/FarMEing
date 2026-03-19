const prisma = require('../lib/prisma');
const { createProjectSchema, updateProjectSchema } = require('../validators/project.validator');

// Shared select shape (no sensitive fields, no deleted children)
const PROJECT_SELECT = {
  id: true,
  name: true,
  crop: true,
  landSize: true,
  landUnit: true,
  startDate: true,
  endDate: true,
  expectedYield: true,
  status: true,
  notes: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
  seasonId: true,
  userId: true,
  season: { select: { id: true, name: true } },
};

// ── helpers ──────────────────────────────────────────────────────────────────

/** Parse & validate body; return { data } or send 400 and return null */
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
 * Find a project that belongs to the authenticated user and is not deleted.
 * Sends 404 if not found. Returns the raw project or null.
 */
const findOwned = async (id, userId, res, includeDeleted = false) => {
  const project = await prisma.farmProject.findUnique({ where: { id } });
  if (!project || (!includeDeleted && project.isDeleted) || project.userId !== userId) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }
  return project;
};

// ── POST /projects ────────────────────────────────────────────────────────────

const createProject = async (req, res) => {
  const data = validate(createProjectSchema, req.body, res);
  if (!data) return;

  // If seasonId provided, verify it belongs to this user
  if (data.seasonId) {
    const season = await prisma.season.findUnique({ where: { id: data.seasonId } });
    if (!season || season.userId !== req.user.id) {
      return res.status(404).json({ error: 'Season not found' });
    }
  }

  const project = await prisma.farmProject.create({
    data: {
      ...data,
      startDate: new Date(data.startDate),
      endDate:   data.endDate ? new Date(data.endDate) : null,
      userId:    req.user.id,
    },
    select: PROJECT_SELECT,
  });

  return res.status(201).json({ project });
};

// ── GET /projects ─────────────────────────────────────────────────────────────

const listProjects = async (req, res) => {
  const projects = await prisma.farmProject.findMany({
    where:   { userId: req.user.id, isDeleted: false },
    orderBy: { createdAt: 'desc' },
    select:  PROJECT_SELECT,
  });

  return res.json({ projects });
};

// ── GET /projects/:id ─────────────────────────────────────────────────────────

const getProject = async (req, res) => {
  const project = await prisma.farmProject.findUnique({
    where:  { id: req.params.id },
    select: PROJECT_SELECT,
  });

  if (!project || project.isDeleted || project.userId !== req.user.id) {
    return res.status(404).json({ error: 'Project not found' });
  }

  return res.json({ project });
};

// ── PUT /projects/:id ─────────────────────────────────────────────────────────

const updateProject = async (req, res) => {
  const owned = await findOwned(req.params.id, req.user.id, res);
  if (!owned) return;

  const data = validate(updateProjectSchema, req.body, res);
  if (!data) return;

  // Guard: if seasonId is being changed, verify ownership
  if (data.seasonId !== undefined && data.seasonId !== null) {
    const season = await prisma.season.findUnique({ where: { id: data.seasonId } });
    if (!season || season.userId !== req.user.id) {
      return res.status(404).json({ error: 'Season not found' });
    }
  }

  const updated = await prisma.farmProject.update({
    where: { id: req.params.id },
    data: {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate:   data.endDate   ? new Date(data.endDate)   : data.endDate, // allow null
    },
    select: PROJECT_SELECT,
  });

  return res.json({ project: updated });
};

// ── DELETE /projects/:id (soft delete) ────────────────────────────────────────

const deleteProject = async (req, res) => {
  const owned = await findOwned(req.params.id, req.user.id, res);
  if (!owned) return;

  await prisma.farmProject.update({
    where: { id: req.params.id },
    data:  { isDeleted: true },
  });

  return res.json({ message: 'Project deleted' });
};

// ── GET /projects/:id/summary ─────────────────────────────────────────────────

const getProjectSummary = async (req, res) => {
  const owned = await findOwned(req.params.id, req.user.id, res);
  if (!owned) return;

  // Run aggregations in parallel
  const [project, budgetAgg, expenseAgg, laborAgg, harvestAgg, saleAgg, expenses, workEntries, harvests, sales] = await Promise.all([
    prisma.farmProject.findUnique({
      where:  { id: req.params.id },
      select: PROJECT_SELECT,
    }),
    prisma.budgetItem.aggregate({
      where:  { projectId: req.params.id, isDeleted: false },
      _sum:   { total: true },
    }),
    prisma.expense.aggregate({
      where:  { projectId: req.params.id, isDeleted: false },
      _sum:   { amount: true },
    }),
    prisma.workEntry.aggregate({
      where:  { projectId: req.params.id, isDeleted: false, status: 'APPROVED' },
      _sum:   { totalCost: true },
    }),
    prisma.harvest.aggregate({
      where:  { projectId: req.params.id, isDeleted: false },
      _sum:   { weight: true },
    }),
    prisma.sale.aggregate({
      where:  { projectId: req.params.id, isDeleted: false },
      _sum:   { totalAmount: true },
    }),
    prisma.expense.findMany({ where: { projectId: req.params.id, isDeleted: false } }),
    prisma.workEntry.findMany({ where: { projectId: req.params.id, isDeleted: false }, include: { employee: { select: { name: true } } } }),
    prisma.harvest.findMany({ where: { projectId: req.params.id, isDeleted: false } }),
    prisma.sale.findMany({ where: { projectId: req.params.id, isDeleted: false } }),
  ]);

  const totalBudget   = budgetAgg._sum.total     ?? 0;
  const totalExpenses = expenseAgg._sum.amount    ?? 0;
  const totalLabor    = laborAgg._sum.totalCost   ?? 0;
  const totalHarvest  = harvestAgg._sum.weight    ?? 0;
  const totalRevenue  = saleAgg._sum.totalAmount  ?? 0;
  const totalCost     = totalExpenses + totalLabor;

  const timeline = [
    ...expenses.map(e => ({ type: 'EXPENSE', date: e.date, label: e.category, amount: e.amount, icon: 'receipt-outline' })),
    ...workEntries.map(w => ({ type: 'WORK', date: w.date, label: `${w.employee.name}: ${w.activity}`, amount: w.totalCost, icon: 'people-outline' })),
    ...harvests.map(h => ({ type: 'HARVEST', date: h.date, label: `Harvest: ${h.weight}kg ${h.crop}`, amount: h.weight, icon: 'leaf-outline' })),
    ...sales.map(s => ({ type: 'SALE', date: s.date, label: `Sale: ${s.customer || 'Cash'}`, amount: s.totalAmount, icon: 'cash-outline' })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  return res.json({
    project,
    summary: {
      totalBudget,
      totalExpenses,
      totalLaborCost: totalLabor,
      totalCost,
      totalHarvest,
      totalRevenue,
      netProfit: totalRevenue - totalCost,
    },
    timeline,
  });
};

module.exports = {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  getProjectSummary,
};
