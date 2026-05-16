const prisma = require('../lib/prisma');

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Find a payee that the user is authorized to see.
 * Authorization: Either the user created the payee, 
 * OR the payee is linked to an expense/inventory item of a project the user has access to.
 */
const findAccessiblePayee = async (payeeId, userId, res) => {
  try {
    const payee = await prisma.payee.findUnique({ 
      where: { id: payeeId },
      include: {
        expenses: {
          where: { project: { projectAccess: { some: { userId } } } }
        },
        inventoryItems: {
          where: { project: { projectAccess: { some: { userId } } } }
        }
      }
    });

    if (!payee || payee.isDeleted) {
      res.status(404).json({ error: 'Payee not found' });
      return null;
    }

    // Check if user is the creator OR has access via linked project
    if (payee.userId !== userId && payee.expenses.length === 0 && payee.inventoryItems.length === 0) {
      res.status(403).json({ error: 'Permission denied' });
      return null;
    }

    return payee;
  } catch (error) {
    console.error('Find Accessible Payee Error:', error);
    res.status(500).json({ error: 'Internal server error' });
    return null;
  }
};

/**
 * Check if the user has OWNER or MANAGER access to the payee.
 * This means they either created the payee, OR they have an 
 * OWNER/MANAGER role on at least one project the payee is linked to.
 */
const hasManagerialPayeeAccess = async (payee, userId) => {
  if (payee.userId === userId) return true;

  const access = await prisma.projectAccess.findFirst({
    where: {
      userId,
      role: { in: ['OWNER', 'MANAGER'] },
      project: {
        OR: [
          { expenses: { some: { payeeId: payee.id } } },
          { inventoryItems: { some: { payeeId: payee.id } } }
        ]
      }
    }
  });

  return !!access;
};

// ── POST /payees ─────────────────────────────────────────────────────────────

const createPayee = async (req, res) => {
  const data = req.validatedData;

  try {
    const payee = await prisma.payee.create({
      data: {
        userId:   req.user.id,
        name:     data.name,
        phone:    data.phone    ?? null,
        email:    data.email    ?? null,
        address:  data.address  ?? null,
        category: data.category ?? null,
        notes:    data.notes    ?? null,
      },
    });

    return res.status(201).json({ payee });
  } catch (error) {
    console.error('Create Payee Error:', error);
    return res.status(500).json({ error: 'Failed to create payee' });
  }
};

// ── GET /payees ──────────────────────────────────────────────────────────────

const listPayees = async (req, res) => {
  const includeDeleted = req.query.includeDeleted === 'true';
  
  try {
    const payees = await prisma.payee.findMany({
      where: {
        ...(includeDeleted ? {} : { isDeleted: false }),
        OR: [
          { userId: req.user.id },
          { expenses: { some: { project: { projectAccess: { some: { userId: req.user.id } } } } } },
          { inventoryItems: { some: { project: { projectAccess: { some: { userId: req.user.id } } } } } }
        ]
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ payees });
  } catch (error) {
    console.error('List Payees Error:', error);
    return res.status(500).json({ error: 'Failed to list payees' });
  }
};

// ── GET /payees/:id ──────────────────────────────────────────────────────────

const getPayee = async (req, res) => {
  const payee = await findAccessiblePayee(req.params.id, req.user.id, res);
  if (!payee) return;

  return res.json({ payee });
};

// ── PUT /payees/:id ──────────────────────────────────────────────────────────

const updatePayee = async (req, res) => {
  const data = req.validatedData;

  try {
    const payee = await findAccessiblePayee(req.params.id, req.user.id, res);
    if (!payee) return;

    if (!(await hasManagerialPayeeAccess(payee, req.user.id))) {
      return res.status(403).json({ error: 'Permission denied: Requires creator OR OWNER/MANAGER role on linked project' });
    }

    const updated = await prisma.payee.update({
      where: { id: req.params.id },
      data,
    });

    return res.json({ payee: updated });
  } catch (error) {
    console.error('Update Payee Error:', error);
    return res.status(500).json({ error: 'Failed to update payee' });
  }
};

// ── DELETE /payees/:id (soft delete) ─────────────────────────────────────────

const deletePayee = async (req, res) => {
  try {
    const payee = await findAccessiblePayee(req.params.id, req.user.id, res);
    if (!payee) return;

    if (!(await hasManagerialPayeeAccess(payee, req.user.id))) {
      return res.status(403).json({ error: 'Permission denied: Requires creator OR OWNER/MANAGER role on linked project' });
    }

    await prisma.payee.update({
      where: { id: req.params.id },
      data:  { isDeleted: true },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Delete Payee Error:', error);
    return res.status(500).json({ error: 'Failed to delete payee' });
  }
};

// ── GET /payees/:id/summary ──────────────────────────────────────────────────

const getPayeeSummary = async (req, res) => {
  const payee = await findAccessiblePayee(req.params.id, req.user.id, res);
  if (!payee) return;

  try {
    const [expenseAgg, inventoryAgg] = await Promise.all([
      prisma.expense.aggregate({
        where: { payeeId: req.params.id, isDeleted: false },
        _sum:  { amount: true },
      }),
      prisma.inventoryItem.aggregate({
        where: { payeeId: req.params.id, isDeleted: false },
        _sum:  { totalCost: true },
      }),
    ]);

    const totalSpentExpenses = parseFloat((expenseAgg._sum.amount ?? 0).toFixed(2));
    const totalSpentInventory = parseFloat((inventoryAgg._sum.totalCost ?? 0).toFixed(2));
    const totalSpent = parseFloat((totalSpentExpenses + totalSpentInventory).toFixed(2));

    return res.json({
      payee: {
        id:       payee.id,
        name:     payee.name,
        category: payee.category,
      },
      summary: {
        totalSpentExpenses,
        totalSpentInventory,
        totalSpent,
      },
    });
  } catch (error) {
    console.error('Get Payee Summary Error:', error);
    return res.status(500).json({ error: 'Failed to get payee summary' });
  }
};

module.exports = {
  createPayee,
  listPayees,
  getPayee,
  updatePayee,
  deletePayee,
  getPayeeSummary,
};
