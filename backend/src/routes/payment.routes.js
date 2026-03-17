const { Router } = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { createPayment, listPayments } = require('../controllers/payment.controller');

const router = Router();

router.use(authenticate);

router.post('/',               createPayment);   // POST /payments
router.get ('/:employeeId',    listPayments);    // GET  /payments/:employeeId

module.exports = router;
