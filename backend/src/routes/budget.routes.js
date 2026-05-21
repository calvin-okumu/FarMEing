const { Router } = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const { createBudgetItemSchema, updateBudgetItemSchema } = require('../validators/budget.validator');
const {
  createBudgetItem,
  listBudgetItems,
  updateBudgetItem,
  deleteBudgetItem,
} = require('../controllers/budget.controller');

const router = Router();

router.use(authenticate);

router.post('/', validateRequest(createBudgetItemSchema), createBudgetItem);
router.get('/:projectId', listBudgetItems);
router.put('/:id', validateRequest(updateBudgetItemSchema), updateBudgetItem);
router.delete('/:id', deleteBudgetItem);

module.exports = router;
