const prisma = require('../lib/prisma');
const { createSaleSchema, updateSaleSchema } = require('../validators/sale.validator');
const { verifyProjectAccess } = require('../lib/project-access');

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

// ── POST /sales ──────────────────────────────────────────────────────────────

const createSale = async (req, res) => {
  const data = validate(createSaleSchema, req.body, res);
  if (!data) return;

  const access = await verifyProjectAccess(data.projectId, req.user.id, res, ['OWNER', 'MANAGER']);
  if (!access) return;

  const sale = await prisma.sale.create({
    data: {
      projectId:   data.projectId,
      date:        new Date(data.date),
      customer:    data.customer ?? null,
      weightSold:  data.weightSold,
      unitPrice:   data.unitPrice,
      totalAmount: data.totalAmount,
      notes:       data.notes ?? null,
    },
  });

  return res.status(201).json({ sale });
};

// ── GET /sales/:projectId ────────────────────────────────────────────────────

const listSales = async (req, res) => {
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
};

// ── PUT /sales/:id ───────────────────────────────────────────────────────────

const updateSale = async (req, res) => {
  const sale = await prisma.sale.findUnique({ where: { id: req.params.id } });
  if (!sale || sale.isDeleted) return res.status(404).json({ error: 'Sale not found' });

  const access = await verifyProjectAccess(sale.projectId, req.user.id, res, ['OWNER', 'MANAGER']);
  if (!access) return;

  const data = validate(updateSaleSchema, req.body, res);
  if (!data) return;

  const updated = await prisma.sale.update({
    where: { id: req.params.id },
    data: {
      ...data,
      date: data.date ? new Date(data.date) : undefined,
    },
  });

  return res.json({ sale: updated });
};

// ── DELETE /sales/:id ────────────────────────────────────────────────────────

const deleteSale = async (req, res) => {
  const sale = await prisma.sale.findUnique({ where: { id: req.params.id } });
  if (!sale || sale.isDeleted) return res.status(404).json({ error: 'Sale not found' });

  const access = await verifyProjectAccess(sale.projectId, req.user.id, res, ['OWNER', 'MANAGER']);
  if (!access) return;

  await prisma.sale.update({
    where: { id: req.params.id },
    data:  { isDeleted: true },
  });

  return res.json({ message: 'Sale deleted' });
};

module.exports = { createSale, listSales, updateSale, deleteSale };
