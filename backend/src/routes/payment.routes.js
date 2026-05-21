const { Router } = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const { createPaymentSchema } = require('../validators/payment.validator');
const {
  createPayment,
  listAllPayments,
  listPayments,
  deletePayment,
} = require('../controllers/payment.controller');

const router = Router();

router.use(authenticate);

router.post('/', validateRequest(createPaymentSchema), createPayment);
router.get('/', listAllPayments);
router.get('/:employeeId', listPayments);
router.delete('/:id', deletePayment);

module.exports = router;
