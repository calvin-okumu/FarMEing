const prisma = require('../lib/prisma');

const createSeason = async (req, res) => {
  const data = req.validatedData;

  try {
    const season = await prisma.season.create({
      data: {
        userId: req.user.id,
        ...data,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
    });

    return res.status(201).json({ season });
  } catch (error) {
    console.error('Create Season Error:', error);
    return res.status(500).json({ error: 'Failed to create season' });
  }
};

const listSeasons = async (req, res) => {
  const includeDeleted = req.query.includeDeleted === 'true';

  try {
    const seasons = await prisma.season.findMany({
      where: {
        userId: req.user.id,
        isDeleted: includeDeleted ? undefined : false,
      },
      orderBy: { startDate: 'desc' },
    });

    return res.json({ seasons });
  } catch (error) {
    console.error('List Seasons Error:', error);
    return res.status(500).json({ error: 'Failed to list seasons' });
  }
};

const updateSeason = async (req, res) => {
  const { id } = req.params;
  const data = req.validatedData;

  try {
    const season = await prisma.season.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!season) {
      return res.status(404).json({ error: 'Season not found' });
    }

    const updated = await prisma.season.update({
      where: { id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate !== undefined ? (data.endDate ? new Date(data.endDate) : null) : undefined,
      },
    });

    return res.json({ season: updated });
  } catch (error) {
    console.error('Update Season Error:', error);
    return res.status(500).json({ error: 'Failed to update season' });
  }
};

const deleteSeason = async (req, res) => {
  const { id } = req.params;

  try {
    const season = await prisma.season.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!season) {
      return res.status(404).json({ error: 'Season not found' });
    }

    await prisma.season.update({
      where: { id },
      data: { isDeleted: true },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Delete Season Error:', error);
    return res.status(500).json({ error: 'Failed to delete season' });
  }
};

module.exports = {
  createSeason,
  listSeasons,
  updateSeason,
  deleteSeason,
};
