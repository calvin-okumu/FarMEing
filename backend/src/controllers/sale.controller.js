const prisma = require('../lib/prisma');
const { verifyProjectAccess } = require('../lib/project-access');

// ── POST /sales ──────────────────────────────────────────────────────────────

const createSale = async (req, res) => {
  const data = req.validatedData;

  try {
    const access = await verifyProjectAccess(data.projectId, req.user.id, res, ['OWNER', 'MANAGER']);
    if (!access) return;

    const sale = await prisma.sale.create({
      data: {
        projectId:   data.projectId,
        blockId:     data.blockId ?? null,
        date:        new Date(data.date),
        customer:    data.customer ?? null,
        weightSold:  data.weightSold,
        unitPrice:   data.unitPrice,
        totalAmount: data.totalAmount,
        receiptUrl:  data.receiptUrl ?? null,
        invoiceUrl:  data.invoiceUrl ?? null,
        notes:       data.notes ?? null,
      },
    });

    return res.status(201).json({ sale });
  } catch (error) {
    console.error('Create Sale Error:', error);
    return res.status(500).json({ error: 'Failed to create sale' });
  }
};

// ── GET /sales/:projectId ────────────────────────────────────────────────────

const listSales = async (req, res) => {
  try {
    const access = await verifyProjectAccess(req.params.projectId, req.user.id, res);
    if (!access) return;
    const includeDeleted = req.query.includeDeleted === 'true';

    const sales = await prisma.sale.findMany({
      where:   { projectId: req.params.projectId, ...(includeDeleted ? {} : { isDeleted: false }) },
      orderBy: { date: 'desc' },
    });

    const totalRevenue = parseFloat(
      sales.reduce((sum, s) => sum + s.totalAmount, 0).toFixed(2)
    );

    return res.json({ sales, totalRevenue });
  } catch (error) {
    console.error('List Sales Error:', error);
    return res.status(500).json({ error: 'Failed to list sales' });
  }
};

// ── PUT /sales/:id ───────────────────────────────────────────────────────────

const updateSale = async (req, res) => {
  const data = req.validatedData;

  try {
    const sale = await prisma.sale.findUnique({ where: { id: req.params.id } });
    if (!sale || sale.isDeleted) return res.status(404).json({ error: 'Sale not found' });

    const access = await verifyProjectAccess(sale.projectId, req.user.id, res, ['OWNER', 'MANAGER']);
    if (!access) return;

    const updated = await prisma.sale.update({
      where: { id: req.params.id },
      data: {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
      },
    });

    return res.json({ sale: updated });
  } catch (error) {
    console.error('Update Sale Error:', error);
    return res.status(500).json({ error: 'Failed to update sale' });
  }
};

// ── DELETE /sales/:id ────────────────────────────────────────────────────────

const deleteSale = async (req, res) => {
  try {
    const sale = await prisma.sale.findUnique({ where: { id: req.params.id } });
    if (!sale || sale.isDeleted) return res.status(404).json({ error: 'Sale not found' });

    const access = await verifyProjectAccess(sale.projectId, req.user.id, res, ['OWNER', 'MANAGER']);
    if (!access) return;

    await prisma.$transaction([
      prisma.sale.update({
        where: { id: req.params.id },
        data:  { isDeleted: true },
      }),
      prisma.saleHarvest.updateMany({
        where: { saleId: req.params.id },
        data:  { isDeleted: true },
      }),
      prisma.salePayment.updateMany({
        where: { saleId: req.params.id },
        data:  { isDeleted: true },
      }),
    ]);

    return res.status(204).send();
  } catch (error) {
    console.error('Delete Sale Error:', error);
    return res.status(500).json({ error: 'Failed to delete sale' });
  }
};

module.exports = { createSale, listSales, updateSale, deleteSale };
