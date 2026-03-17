const { Router } = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const {
  createBudgetItem,
  listBudgetItems,
  updateBudgetItem,
  deleteBudgetItem,
} = require('../controllers/budget.controller');

const router = Router();

router.use(authenticate);

router.post  ('/',               createBudgetItem);   // POST   /budget
router.get   ('/:projectId',     listBudgetItems);    // GET    /budget/:projectId
router.put   ('/:id',            updateBudgetItem);   // PUT    /budget/:id
router.delete('/:id',            deleteBudgetItem);   // DELETE /budget/:id

module.exports = router;
