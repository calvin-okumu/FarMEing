const prisma = require('../lib/prisma');
const { verifyProjectAccess } = require('../lib/project-access');

const createEquipment = async (req, res) => {
  const data = req.validatedData;
  try {
    const access = await verifyProjectAccess(data.projectId, req.user.id, res, ['OWNER', 'MANAGER']);
    if (!access) return;

    const record = await prisma.equipment.create({
      data: {
        ...data,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
      },
    });
    return res.status(201).json({ equipment: record });
  } catch (error) {
    console.error('Create Equipment Error:', error);
    return res.status(500).json({ error: 'Failed to create equipment' });
  }
};

const listEquipments = async (req, res) => {
  try {
    const access = await verifyProjectAccess(req.params.projectId, req.user.id, res);
    if (!access) return;

    const records = await prisma.equipment.findMany({
      where: { projectId: req.params.projectId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ equipments: records });
  } catch (error) {
    console.error('List Equipments Error:', error);
    return res.status(500).json({ error: 'Failed to list equipments' });
  }
};

const updateEquipment = async (req, res) => {
  const data = req.validatedData;
  const { id } = req.params;

  try {
    const existing = await prisma.equipment.findUnique({
      where: { id },
      include: { project: true }
    });

    if (!existing || existing.isDeleted) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    const access = await verifyProjectAccess(existing.projectId, req.user.id, res, ['OWNER', 'MANAGER']);
    if (!access) return;

    const updated = await prisma.equipment.update({
      where: { id },
      data: {
        ...data,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
      },
    });

    return res.json({ equipment: updated });
  } catch (error) {
    console.error('Update Equipment Error:', error);
    return res.status(500).json({ error: 'Failed to update equipment' });
  }
};

const deleteEquipment = async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await prisma.equipment.findUnique({
      where: { id },
    });

    if (!existing || existing.isDeleted) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    const access = await verifyProjectAccess(existing.projectId, req.user.id, res, ['OWNER', 'MANAGER']);
    if (!access) return;

    await prisma.equipment.update({
      where: { id },
      data: { isDeleted: true },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Delete Equipment Error:', error);
    return res.status(500).json({ error: 'Failed to delete equipment' });
  }
};

module.exports = { 
  createEquipment, 
  listEquipments,
  updateEquipment,
  deleteEquipment
};
