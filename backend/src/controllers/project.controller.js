const prisma = require('../lib/prisma');
const { createProjectSchema, updateProjectSchema } = require('../validators/project.validator');
const { addProjectMemberSchema } = require('../validators/projectMember.validator');

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
  contractUrl: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
  projectAccess: true,
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

const ensureOwnerAccess = async (projectId, userId) => {
  if (!prisma.projectAccess) {
    return null;
  }

  return prisma.projectAccess.upsert({
    where: {
      userId_projectId: {
        userId,
        projectId,
      },
    },
    create: {
      userId,
      projectId,
      role: 'OWNER',
    },
    update: {
      role: 'OWNER',
    },
  });
};

/**
 * Find a project that the authenticated user has access to.
 * Sends 404 if not found. Returns { project, accessRole } or null.
 */
const findAccessible = async (id, userId, res, includeDeleted = false) => {
  const access = prisma.projectAccess
    ? await prisma.projectAccess.findFirst({
        where: { projectId: id, userId },
        include: { project: { select: PROJECT_SELECT } },
      })
    : null;

  if (access && (includeDeleted || !access.project.isDeleted)) {
    return { project: access.project, accessRole: access.role };
  }

  const project = await prisma.farmProject.findUnique({
    where: { id },
    select: PROJECT_SELECT,
  });

  if (!project || project.userId !== userId || (!includeDeleted && project.isDeleted)) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }

  await ensureOwnerAccess(id, userId);
  return { project, accessRole: 'OWNER' };
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

  const project = await prisma.$transaction(async (tx) => {
    const newProject = await tx.farmProject.create({
      data: {
        ...data,
        startDate: new Date(data.startDate),
        endDate:   data.endDate ? new Date(data.endDate) : null,
        userId:    req.user.id,
      },
      select: PROJECT_SELECT,
    });

    await tx.projectAccess.create({
      data: {
        userId: req.user.id,
        projectId: newProject.id,
        role: 'OWNER',
      },
    });

    return newProject;
  });

  return res.status(201).json({ project });
};

// ── GET /projects ─────────────────────────────────────────────────────────────

const listProjects = async (req, res) => {
  const includeDeleted = req.query.includeDeleted === 'true';
  
  // Find projects through projectAccess records
  const accessRecords = await prisma.projectAccess.findMany({
    where: { 
      userId: req.user.id, 
      project: { isDeleted: includeDeleted ? undefined : false } 
    },
    include: { project: { select: PROJECT_SELECT } },
    orderBy: { createdAt: 'desc' },
  });

  const projects = accessRecords.map(a => ({
    ...a.project,
    accessRole: a.role
  }));

  return res.json({ projects });
};

// ── GET /projects/:id ─────────────────────────────────────────────────────────

const getProject = async (req, res) => {
  const result = await findAccessible(req.params.id, req.user.id, res);
  if (!result) return;

  return res.json({ 
    project: {
      ...result.project,
      accessRole: result.accessRole
    } 
  });
};

// ── PUT /projects/:id ─────────────────────────────────────────────────────────

const updateProject = async (req, res) => {
  const result = await findAccessible(req.params.id, req.user.id, res);
  if (!result) return;

  if (result.accessRole === 'VIEWER') {
    return res.status(403).json({ error: 'Permission denied' });
  }

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
  const result = await findAccessible(req.params.id, req.user.id, res);
  if (!result) return;

  if (result.accessRole !== 'OWNER') {
    return res.status(403).json({ error: 'Only owners can delete projects' });
  }

  await prisma.$transaction([
    prisma.farmProject.update({
      where: { id: req.params.id },
      data:  { isDeleted: true },
    }),
    prisma.budgetItem.updateMany({
      where: { projectId: req.params.id, isDeleted: false },
      data:  { isDeleted: true },
    }),
    prisma.expense.updateMany({
      where: { projectId: req.params.id, isDeleted: false },
      data:  { isDeleted: true },
    }),
    prisma.workEntry.updateMany({
      where: { projectId: req.params.id, isDeleted: false },
      data:  { isDeleted: true },
    }),
    prisma.harvest.updateMany({
      where: { projectId: req.params.id, isDeleted: false },
      data:  { isDeleted: true },
    }),
    prisma.sale.updateMany({
      where: { projectId: req.params.id, isDeleted: false },
      data:  { isDeleted: true },
    }),
    prisma.inventoryItem.updateMany({
      where: { projectId: req.params.id, isDeleted: false },
      data:  { isDeleted: true },
    }),
  ]);

  return res.json({ message: 'Project deleted' });
};

// ── POST /projects/:id/members ────────────────────────────────────────────────

const addProjectMember = async (req, res) => {
  const result = await findAccessible(req.params.id, req.user.id, res);
  if (!result) return;

  if (result.accessRole !== 'OWNER') {
    return res.status(403).json({ error: 'Only owners can invite members' });
  }

  const data = validate(addProjectMemberSchema, req.body, res);
  if (!data) return;

  const targetUser = await prisma.user.findUnique({ where: { phone: data.phone } });
  if (!targetUser) {
    return res.status(404).json({ error: 'User with this phone number not found' });
  }

  if (targetUser.id === req.user.id) {
    return res.status(400).json({ error: 'You are already the owner of this project' });
  }

  // Check if already has access
  const existing = await prisma.projectAccess.findUnique({
    where: {
      userId_projectId: {
        userId: targetUser.id,
        projectId: req.params.id
      }
    }
  });

  if (existing) {
    return res.status(400).json({ error: 'User already has access to this project' });
  }

  const access = await prisma.projectAccess.create({
    data: {
      userId: targetUser.id,
      projectId: req.params.id,
      role: data.role
    }
  });

  return res.status(201).json({ 
    message: 'Member added',
    member: {
      name: targetUser.name,
      role: access.role
    }
  });
};

// ── GET /projects/:id/members ────────────────────────────────────────────────

const getProjectMembers = async (req, res) => {
  const result = await findAccessible(req.params.id, req.user.id, res);
  if (!result) return;

  const members = await prisma.projectAccess.findMany({
    where: { projectId: req.params.id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          phone: true
        }
      }
    }
  });

  return res.json({ members: members.map(m => ({
    id: m.user.id,
    name: m.user.name,
    phone: m.user.phone,
    role: m.role,
    accessId: m.id
  })) });
};

// ── DELETE /projects/:id/members/:userId ──────────────────────────────────────

const removeProjectMember = async (req, res) => {
  const result = await findAccessible(req.params.id, req.user.id, res);
  if (!result) return;

  if (result.accessRole !== 'OWNER') {
    return res.status(403).json({ error: 'Only owners can remove members' });
  }

  const { userId } = req.params;

  if (userId === req.user.id) {
    return res.status(400).json({ error: 'You cannot remove yourself. Delete the project instead.' });
  }

  await prisma.projectAccess.deleteMany({
    where: {
      projectId: req.params.id,
      userId: userId
    }
  });

  return res.json({ message: 'Member removed' });
};

// ── GET /projects/:id/summary ─────────────────────────────────────────────────

const getProjectSummary = async (req, res) => {
  const result = await findAccessible(req.params.id, req.user.id, res);
  if (!result) return;

  // Run aggregations in parallel
  const [budgetAgg, expenseAgg, laborAgg, harvestAgg, saleAgg, inventoryAgg, expenses, workEntries, harvests, sales, inventoryItems] = await Promise.all([
    prisma.budgetItem.aggregate({
      where:  { projectId: req.params.id, isDeleted: false },
      _sum:   { total: true },
    }),
    prisma.expense.aggregate({
      where:  { projectId: req.params.id, isDeleted: false },
      _sum:   { amount: true },
    }),
    prisma.workEntry.aggregate({
      where:  { projectId: req.params.id, isDeleted: false },
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
    prisma.inventoryItem.aggregate({
      where: { projectId: req.params.id, isDeleted: false },
      _sum: { totalCost: true },
    }),
    prisma.expense.findMany({ where: { projectId: req.params.id, isDeleted: false } }),
    prisma.workEntry.findMany({ where: { projectId: req.params.id, isDeleted: false }, include: { employee: { select: { name: true } } } }),
    prisma.harvest.findMany({ where: { projectId: req.params.id, isDeleted: false } }),
    prisma.sale.findMany({ where: { projectId: req.params.id, isDeleted: false } }),
    prisma.inventoryItem.findMany({ where: { projectId: req.params.id, isDeleted: false } }),
  ]);

  const totalBudget   = budgetAgg._sum.total     ?? 0;
  const totalExpenses = expenseAgg._sum.amount    ?? 0;
  const totalLabor    = laborAgg._sum.totalCost   ?? 0;
  const totalInventory = inventoryAgg._sum.totalCost ?? 0;
  const totalHarvest  = harvestAgg._sum.weight    ?? 0;
  const totalRevenue  = saleAgg._sum.totalAmount  ?? 0;
  const totalCost     = totalExpenses + totalLabor + totalInventory;

  const timeline = [
    ...expenses.map(e => ({ type: 'EXPENSE', date: e.date, label: e.category, amount: e.amount, icon: 'receipt-outline' })),
    ...workEntries.map(w => ({ type: 'WORK', date: w.date, label: `${w.employee.name}: ${w.activity}`, amount: w.totalCost, icon: 'people-outline' })),
    ...harvests.map(h => ({ type: 'HARVEST', date: h.date, label: `Harvest: ${h.weight}kg ${h.crop}`, amount: h.weight, icon: 'leaf-outline' })),
    ...sales.map(s => ({ type: 'SALE', date: s.date, label: `Sale: ${s.customer || 'Cash'}`, amount: s.totalAmount, icon: 'cash-outline' })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  return res.json({
    project: {
      ...result.project,
      accessRole: result.accessRole
    },
    summary: {
      totalBudget,
      totalExpenses,
      totalLaborCost: totalLabor,
      totalInventoryCost: totalInventory,
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
  addProjectMember,
  getProjectMembers,
  removeProjectMember,
};
