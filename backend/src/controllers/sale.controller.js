const prisma = require('../lib/prisma');
const { createSaleSchema, updateSaleSchema } = require('../validators/sale.validator');

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

const findOwnedProject = async (projectId, userId, res) => {
  const project = await prisma.farmProject.findUnique({ where: { id: projectId } });
  if (!project || project.isDeleted || project.userId !== userId) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }
  return project;
};

const findOwnedSale = async (saleId, userId, res) => {
  const sale = await prisma.sale.findUnique({
    where:   { id: saleId },
    include: { project: { select: { userId: true, isDeleted: true } } },
  });
  if (
    !sale ||
    sale.isDeleted ||
    sale.project.isDeleted ||
    sale.project.userId !== userId
  ) {
    res.status(404).json({ error: 'Sale not found' });
    return null;
  }
  return sale;
};

// ── POST /sales ──────────────────────────────────────────────────────────────

const createSale = async (req, res) => {
  const data = validate(createSaleSchema, req.body, res);
  if (!data) return;

  const project = await findOwnedProject(data.projectId, req.user.id, res);
  if (!project) return;

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
  const project = await findOwnedProject(req.params.projectId, req.user.id, res);
  if (!project) return;

  const sales = await prisma.sale.findMany({
    where:   { projectId: req.params.projectId, isDeleted: false },
    orderBy: { date: 'desc' },
  });

  const totalRevenue = parseFloat(
    sales.reduce((sum, s) => sum + s.totalAmount, 0).toFixed(2)
  );

  return res.json({ sales, totalRevenue });
};

// ── PUT /sales/:id ───────────────────────────────────────────────────────────

const updateSale = async (req, res) => {
  const sale = await findOwnedSale(req.params.id, req.user.id, res);
  if (!sale) return;

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
  const sale = await findOwnedSale(req.params.id, req.user.id, res);
  if (!sale) return;

  await prisma.sale.update({
    where: { id: req.params.id },
    data:  { isDeleted: true },
  });

  return res.json({ message: 'Sale deleted' });
};

module.exports = { createSale, listSales, updateSale, deleteSale };
