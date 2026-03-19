const prisma = require('../lib/prisma');
const { createHarvestSchema, updateHarvestSchema } = require('../validators/harvest.validator');

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

/** Verify the project exists, belongs to the user, and is not soft-deleted. */
const findOwnedProject = async (projectId, userId, res) => {
  const project = await prisma.farmProject.findUnique({ where: { id: projectId } });
  if (!project || project.isDeleted || project.userId !== userId) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }
  return project;
};

/** Verify the harvest exists, is not soft-deleted, and belongs to the user's project. */
const findOwnedHarvest = async (harvestId, userId, res) => {
  const harvest = await prisma.harvest.findUnique({
    where:   { id: harvestId },
    include: { project: { select: { userId: true, isDeleted: true } } },
  });
  if (
    !harvest ||
    harvest.isDeleted ||
    harvest.project.isDeleted ||
    harvest.project.userId !== userId
  ) {
    res.status(404).json({ error: 'Harvest not found' });
    return null;
  }
  return harvest;
};

// ── POST /harvests ────────────────────────────────────────────────────────────

const createHarvest = async (req, res) => {
  const data = validate(createHarvestSchema, req.body, res);
  if (!data) return;

  const project = await findOwnedProject(data.projectId, req.user.id, res);
  if (!project) return;

  const harvest = await prisma.harvest.create({
    data: {
      projectId: data.projectId,
      crop:      data.crop,
      date:      new Date(data.date),
      weight:    data.weight,
      unit:      data.unit,
      quality:   data.quality ?? null,
      notes:     data.notes   ?? null,
    },
  });

  return res.status(201).json({ harvest });
};

// ── GET /harvests/:projectId ──────────────────────────────────────────────────

const listHarvests = async (req, res) => {
  const project = await findOwnedProject(req.params.projectId, req.user.id, res);
  if (!project) return;

  const harvests = await prisma.harvest.findMany({
    where:   { projectId: req.params.projectId, isDeleted: false },
    orderBy: { date: 'desc' },
  });

  const totalWeight = parseFloat(
    harvests.reduce((sum, h) => sum + h.weight, 0).toFixed(2)
  );

  return res.json({ harvests, totalWeight });
};

// ── PUT /harvests/:id ─────────────────────────────────────────────────────────

const updateHarvest = async (req, res) => {
  const harvest = await findOwnedHarvest(req.params.id, req.user.id, res);
  if (!harvest) return;

  const data = validate(updateHarvestSchema, req.body, res);
  if (!data) return;

  const updated = await prisma.harvest.update({
    where: { id: req.params.id },
    data: {
      ...data,
      date: data.date ? new Date(data.date) : undefined,
    },
  });

  return res.json({ harvest: updated });
};

// ── DELETE /harvests/:id (soft delete) ────────────────────────────────────────

const deleteHarvest = async (req, res) => {
  const harvest = await findOwnedHarvest(req.params.id, req.user.id, res);
  if (!harvest) return;

  await prisma.harvest.update({
    where: { id: req.params.id },
    data:  { isDeleted: true },
  });

  return res.json({ message: 'Harvest deleted' });
};

module.exports = { createHarvest, listHarvests, updateHarvest, deleteHarvest };
