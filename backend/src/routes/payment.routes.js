const { Router } = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const {
  createPayment,
  listAllPayments,
  listPayments,
  deletePayment,
} = require('../controllers/payment.controller');

const router = Router();

router.use(authenticate);

router.post('/',               createPayment);
router.get ('/',               listAllPayments);
router.get ('/:employeeId',    listPayments);
router.delete('/:id',          deletePayment);

module.exports = router;
