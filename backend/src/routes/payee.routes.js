const express = require('express');
const router = express.Router();
const payeeController = require('../controllers/payee.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const { createPayeeSchema, updatePayeeSchema } = require('../validators/payee.validator');

// All payee routes are protected by auth
router.use(authenticate);

router.post('/', validateRequest(createPayeeSchema), payeeController.createPayee);
router.get('/', payeeController.listPayees);
router.get('/:id', payeeController.getPayee);
router.get('/:id/summary', payeeController.getPayeeSummary);
router.put('/:id', validateRequest(updatePayeeSchema), payeeController.updatePayee);
router.delete('/:id', payeeController.deletePayee);

module.exports = router;
