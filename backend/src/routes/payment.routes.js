const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth.middleware');

const router = Router();
const prisma = new PrismaClient();

async function createPayment(req, res) {
  try {
    const { employeeId, amount, date, note } = req.body;
    
    const payment = await prisma.payment.create({
      data: {
        employeeId,
        amount: parseFloat(amount),
        date: new Date(date),
        note,
      },
    });
    
    res.status(201).json({ payment });
  } catch (error) {
    console.error('[Payment] create error:', error);
    res.status(500).json({ message: 'Failed to create payment' });
  }
}

async function listPayments(req, res) {
  try {
    const { employeeId } = req.params;
    
    const payments = await prisma.payment.findMany({
      where: { employeeId },
      orderBy: { date: 'desc' },
    });
    
    res.json({ payments });
  } catch (error) {
    console.error('[Payment] list error:', error);
    res.status(500).json({ message: 'Failed to list payments' });
  }
}

async function listAllPayments(req, res) {
  try {
    const userId = req.user.id;
    
    // Get all payments for employees belonging to this user
    const payments = await prisma.payment.findMany({
      where: {
        employee: { userId },
      },
      orderBy: { date: 'desc' },
    });
    
    res.json({ payments });
  } catch (error) {
    console.error('[Payment] list all error:', error);
    res.status(500).json({ message: 'Failed to list payments' });
  }
}

router.use(authenticate);

router.post('/',               createPayment);
router.get ('/',               listAllPayments);
router.get ('/:employeeId',    listPayments);

module.exports = router;
