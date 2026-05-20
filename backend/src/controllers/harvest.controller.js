const prisma = require('../lib/prisma');
const { verifyProjectAccess } = require('../lib/project-access');

// ── POST /harvests ────────────────────────────────────────────────────────────

const createHarvest = async (req, res) => {
  const data = req.validatedData;

  try {
    const access = await verifyProjectAccess(data.projectId, req.user.id, res, ['OWNER', 'MANAGER']);
    if (!access) return;

    const harvest = await prisma.harvest.create({
      data: {
        projectId:      data.projectId,
        blockId:        data.blockId,
        crop:           data.crop,
        date:           new Date(data.date),
        weight:         data.weight,
        rejectedWeight: data.rejectedWeight ?? null,
        rejectedReason: data.rejectedReason ?? null,
        unit:           data.unit,
        quality:        data.quality ?? null,
        notes:          data.notes   ?? null,
      },
    });

    return res.status(201).json({ harvest });
  } catch (error) {
    console.error('Create Harvest Error:', error);
    return res.status(500).json({ error: 'Failed to create harvest' });
  }
};

// ── GET /harvests/:projectId ──────────────────────────────────────────────────

const listHarvests = async (req, res) => {
  try {
    const access = await verifyProjectAccess(req.params.projectId, req.user.id, res);
    if (!access) return;
    const includeDeleted = req.query.includeDeleted === 'true';

    const harvests = await prisma.harvest.findMany({
      where:   { projectId: req.params.projectId, ...(includeDeleted ? {} : { isDeleted: false }) },
      orderBy: { date: 'desc' },
    });

    const totalWeight = parseFloat(
      harvests.reduce((sum, h) => sum + (h.weight - (h.rejectedWeight || 0)), 0).toFixed(2)
    )
;

    return res.json({ harvests, totalWeight });
  } catch (error) {
    console.error('List Harvests Error:', error);
    return res.status(500).json({ error: 'Failed to list harvests' });
  }
};

// ── PUT /harvests/:id ─────────────────────────────────────────────────────────

const updateHarvest = async (req, res) => {
  const data = req.validatedData;

  try {
    const harvest = await prisma.harvest.findUnique({ where: { id: req.params.id } });
    if (!harvest || harvest.isDeleted) return res.status(404).json({ error: 'Harvest not found' });

    const access = await verifyProjectAccess(harvest.projectId, req.user.id, res, ['OWNER', 'MANAGER']);
    if (!access) return;

    const updated = await prisma.harvest.update({
      where: { id: req.params.id },
      data: {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
      },
    });

    return res.json({ harvest: updated });
  } catch (error) {
    console.error('Update Harvest Error:', error);
    return res.status(500).json({ error: 'Failed to update harvest' });
  }
};

// ── DELETE /harvests/:id (soft delete) ────────────────────────────────────────

const deleteHarvest = async (req, res) => {
  try {
    const harvest = await prisma.harvest.findUnique({ where: { id: req.params.id } });
    if (!harvest || harvest.isDeleted) return res.status(404).json({ error: 'Harvest not found' });

    const access = await verifyProjectAccess(harvest.projectId, req.user.id, res, ['OWNER', 'MANAGER']);
    if (!access) return;

    await prisma.harvest.update({
      where: { id: req.params.id },
      data:  { isDeleted: true },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Delete Harvest Error:', error);
    return res.status(500).json({ error: 'Failed to delete harvest' });
  }
};

module.exports = { createHarvest, listHarvests, updateHarvest, deleteHarvest };
