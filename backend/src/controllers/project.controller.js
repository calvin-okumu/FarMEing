const prisma = require('../lib/prisma');
const { PROJECT_SELECT, verifyProjectAccess } = require('../lib/project-access');

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Find a project that the authenticated user has access to.
 * Sends 404 if not found. Returns { project, accessRole } or null.
 */
const findAccessible = async (id, userId, res, includeDeleted = false) => {
  const access = await verifyProjectAccess(id, userId, res);
  if (!access) return null;

  if (!includeDeleted && access.project.isDeleted) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }

  return { project: access.project, accessRole: access.role };
};

// ── POST /projects ────────────────────────────────────────────────────────────

const createProject = async (req, res) => {
  const data = req.validatedData;
  const { numberOfBlocks, ...projectData } = data;

  try {
    // If seasonId provided, verify it belongs to this user
    if (projectData.seasonId) {
      const season = await prisma.season.findUnique({ where: { id: projectData.seasonId } });
      if (!season || season.userId !== req.user.id) {
        return res.status(404).json({ error: 'Season not found' });
      }
    }

    const owner = await prisma.user.findUnique({ where: { id: req.user.id } });

    const project = await prisma.$transaction(async (tx) => {
      const newProject = await tx.farmProject.create({
        data: {
          ...projectData,
          startDate: new Date(projectData.startDate),
          endDate:   projectData.endDate ? new Date(projectData.endDate) : null,
          userId:    req.user.id,
          userName:  owner?.name,
          userPhone: owner?.phone,
        },
        select: PROJECT_SELECT,
      });

      // 1. Create owner access
      await tx.projectAccess.create({
        data: {
          userId: req.user.id,
          projectId: newProject.id,
          role: 'OWNER',
          userName: owner?.name,
          userPhone: owner?.phone,
        },
      });

      // 2. Auto-generate blocks if requested
      if (numberOfBlocks && numberOfBlocks > 0) {
        const blocksToCreate = [];
        for (let i = 0; i < numberOfBlocks; i++) {
          const char = String.fromCharCode(65 + i); // 65 = 'A'
          blocksToCreate.push({
            projectId: newProject.id,
            name: `Block ${char}`,
          });
        }
        await tx.projectBlock.createMany({
          data: blocksToCreate,
        });
      }

      return newProject;
    });

    return res.status(201).json({ project });
  } catch (error) {
    console.error('Create Project Error:', error);
    return res.status(500).json({ error: 'Failed to create project' });
  }
};


// ── GET /projects ─────────────────────────────────────────────────────────────

const listProjects = async (req, res) => {
  const includeDeleted = req.query.includeDeleted === 'true';

  try {
    // Find projects through projectAccess records
    const accessRecords = await prisma.projectAccess.findMany({
      where: {
        userId: req.user.id,
        project: { isDeleted: includeDeleted ? undefined : false },
      },
      include: { project: { select: PROJECT_SELECT } },
      orderBy: { createdAt: 'desc' },
    });

    const projects = accessRecords.map((a) => ({
      ...a.project,
      accessRole: a.role,
    }));

    return res.json({ projects });
  } catch (error) {
    console.error('List Projects Error:', error);
    return res.status(500).json({ error: 'Failed to list projects' });
  }
};

// ── GET /projects/:id ─────────────────────────────────────────────────────────

const getProject = async (req, res) => {
  const result = await findAccessible(req.params.id, req.user.id, res);
  if (!result) return;

  return res.json({
    project: {
      ...result.project,
      accessRole: result.accessRole,
    },
  });
};

// ── PUT /projects/:id ─────────────────────────────────────────────────────────

const updateProject = async (req, res) => {
  const result = await findAccessible(req.params.id, req.user.id, res);
  if (!result) return;

  if (result.accessRole === 'VIEWER') {
    return res.status(403).json({ error: 'Permission denied' });
  }

  const data = req.validatedData;

  try {
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
        endDate: data.endDate !== undefined ? (data.endDate ? new Date(data.endDate) : null) : undefined,
      },
      select: PROJECT_SELECT,
    });

    return res.json({ project: updated });
  } catch (error) {
    console.error('Update Project Error:', error);
    return res.status(500).json({ error: 'Failed to update project' });
  }
};

// ── DELETE /projects/:id (soft delete) ────────────────────────────────────────

const deleteProject = async (req, res) => {
  const result = await findAccessible(req.params.id, req.user.id, res);
  if (!result) return;

  if (result.accessRole !== 'OWNER') {
    return res.status(403).json({ error: 'Only owners can delete projects' });
  }

  try {
    await prisma.farmProject.update({
      where: { id: req.params.id },
      data: { isDeleted: true },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Delete Project Error:', error);
    return res.status(500).json({ error: 'Failed to delete project' });
  }
};

// ── POST /projects/:id/members ────────────────────────────────────────────────

const addProjectMember = async (req, res) => {
  const result = await findAccessible(req.params.id, req.user.id, res);
  if (!result) return;

  if (result.accessRole !== 'OWNER') {
    return res.status(403).json({ error: 'Only owners can add members' });
  }

  const data = req.validatedData;

  try {
    const user = await prisma.user.findUnique({ where: { phone: data.phone } });
    if (!user) {
      return res.status(404).json({ error: 'User with this phone number not found' });
    }

    const access = await prisma.projectAccess.upsert({
      where: {
        userId_projectId: {
          userId: user.id,
          projectId: req.params.id,
        },
      },
      create: {
        userId: user.id,
        projectId: req.params.id,
        role: data.role,
      },
      update: {
        role: data.role,
      },
    });

    return res.status(201).json({ access });
  } catch (error) {
    console.error('Add Member Error:', error);
    return res.status(500).json({ error: 'Failed to add member' });
  }
};

// ── GET /projects/:id/members ────────────────────────────────────────────────

const getProjectMembers = async (req, res) => {
  const result = await findAccessible(req.params.id, req.user.id, res);
  if (!result) return;

  try {
    const members = await prisma.projectAccess.findMany({
      where: { projectId: req.params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    return res.json({
      members: members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        phone: m.user.phone,
        role: m.role,
        accessId: m.id,
      })),
    });
  } catch (error) {
    console.error('Get Members Error:', error);
    return res.status(500).json({ error: 'Failed to get members' });
  }
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

  try {
    await prisma.projectAccess.deleteMany({
      where: {
        projectId: req.params.id,
        userId: userId,
      },
    });

    return res.json({ message: 'Member removed' });
  } catch (error) {
    console.error('Remove Member Error:', error);
    return res.status(500).json({ error: 'Failed to remove member' });
  }
};

// ── GET /projects/:id/summary ─────────────────────────────────────────────────

const getProjectSummary = async (req, res) => {
  const result = await findAccessible(req.params.id, req.user.id, res);
  if (!result) return;

  try {
    // Run aggregations in parallel
    const [
      budgetAgg,
      expenseAgg,
      laborAgg,
      harvestAgg,
      saleAgg,
      inventoryAgg,
      expenses,
      workEntries,
      harvests,
      sales,
    ] = await Promise.all([
      prisma.budgetItem.aggregate({
        where: { projectId: req.params.id, isDeleted: false },
        _sum: { total: true },
      }),
      prisma.expense.aggregate({
        where: { projectId: req.params.id, isDeleted: false },
        _sum: { amount: true },
      }),
      prisma.workEntry.aggregate({
        where: { projectId: req.params.id, isDeleted: false },
        _sum: { totalCost: true },
      }),
      prisma.harvest.aggregate({
        where: { projectId: req.params.id, isDeleted: false },
        _sum: { weight: true },
      }),
      prisma.sale.aggregate({
        where: { projectId: req.params.id, isDeleted: false },
        _sum: { totalAmount: true },
      }),
      prisma.inventoryItem.aggregate({
        where: { projectId: req.params.id, isDeleted: false },
        _sum: { totalCost: true },
      }),
      prisma.expense.findMany({ where: { projectId: req.params.id, isDeleted: false } }),
      prisma.workEntry.findMany({
        where: { projectId: req.params.id, isDeleted: false },
        include: { employee: { select: { name: true } } },
      }),
      prisma.harvest.findMany({ where: { projectId: req.params.id, isDeleted: false } }),
      prisma.sale.findMany({ where: { projectId: req.params.id, isDeleted: false } }),
    ]);

    const totalBudget = budgetAgg._sum.total ?? 0;
    const totalExpenses = expenseAgg._sum.amount ?? 0;
    const totalLabor = laborAgg._sum.totalCost ?? 0;
    const totalInventory = inventoryAgg._sum.totalCost ?? 0;
    const totalHarvest = harvests.reduce((sum, h) => sum + (h.weight - (h.rejectedWeight || 0)), 0);
    const totalRejected = harvests.reduce((sum, h) => sum + (h.rejectedWeight || 0), 0);
    const totalRevenue = saleAgg._sum.totalAmount ?? 0;
    const totalCost = totalExpenses + totalLabor + totalInventory;

    // Per-block harvest breakdown
    const blocksBreakdown = result.project.blocks.map(block => {
      const blockHarvests = harvests.filter(h => h.blockId === block.id);
      const approved = blockHarvests.reduce((sum, h) => sum + (h.weight - (h.rejectedWeight || 0)), 0);
      const rejected = blockHarvests.reduce((sum, h) => sum + (h.rejectedWeight || 0), 0);
      return {
        id: block.id,
        name: block.name,
        approved,
        rejected,
      };
    });

    const timeline = [
      ...expenses.map((e) => ({
        type: 'EXPENSE',
        date: e.date,
        label: e.category,
        amount: e.amount,
        icon: 'receipt-outline',
      })),
      ...workEntries.map((w) => ({
        type: 'WORK',
        date: w.date,
        label: `${w.employee.name}: ${w.activity}`,
        amount: w.totalCost,
        icon: 'people-outline',
      })),
      ...harvests.map((h) => ({
        type: 'HARVEST',
        date: h.date,
        label: `Harvest: ${h.weight - (h.rejectedWeight || 0)}kg ${h.crop}`,
        amount: h.weight - (h.rejectedWeight || 0),
        icon: 'leaf-outline',
      })),
      ...sales.map((s) => ({
        type: 'SALE',
        date: s.date,
        label: `Sale: ${s.customer || 'Cash'}`,
        amount: s.totalAmount,
        icon: 'cash-outline',
      })),
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    return res.json({
      project: {
        ...result.project,
        accessRole: result.accessRole,
      },
      summary: {
        totalBudget,
        totalExpenses,
        totalLaborCost: totalLabor,
        totalInventoryCost: totalInventory,
        totalCost,
        totalHarvest,
        totalRejected,
        totalRevenue,
        netProfit: totalRevenue - totalCost,
        blocksBreakdown,
      },
      timeline,
    });
  } catch (error) {
    console.error('Get Summary Error:', error);
    return res.status(500).json({ error: 'Failed to get summary' });
  }
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
