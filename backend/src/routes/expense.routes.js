const { Router } = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const { createExpenseSchema, updateExpenseSchema } = require('../validators/expense.validator');
const {
  createExpense,
  listExpenses,
  updateExpense,
  deleteExpense,
} = require('../controllers/expense.controller');

const router = Router();

router.use(authenticate);

router.post('/', validateRequest(createExpenseSchema), createExpense);
router.get('/:projectId', listExpenses);
router.put('/:id', validateRequest(updateExpenseSchema), updateExpense);
router.delete('/:id', deleteExpense);

module.exports = router;
