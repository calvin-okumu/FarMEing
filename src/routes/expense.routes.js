const { Router } = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const {
  createExpense,
  listExpenses,
  updateExpense,
  deleteExpense,
} = require('../controllers/expense.controller');

const router = Router();

router.use(authenticate);

router.post  ('/',            createExpense);   // POST   /expenses
router.get   ('/:projectId',  listExpenses);    // GET    /expenses/:projectId
router.put   ('/:id',         updateExpense);   // PUT    /expenses/:id
router.delete('/:id',         deleteExpense);   // DELETE /expenses/:id

module.exports = router;
