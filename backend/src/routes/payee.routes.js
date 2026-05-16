const express = require('express');
const router = express.Router();
const payeeController = require('../controllers/payee.controller');
const { authenticate } = require('../middleware/auth.middleware');

// All payee routes are protected by auth
router.use(authenticate);

router.post('/',    payeeController.createPayee);
router.get('/',     payeeController.listPayees);
router.get('/:id',  payeeController.getPayee);
router.get('/:id/summary', payeeController.getPayeeSummary);
router.put('/:id',  payeeController.updatePayee);
router.delete('/:id', payeeController.deletePayee);

module.exports = router;
