const { Router } = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const {
  createEmployee,
  listEmployees,
  updateEmployee,
  deleteEmployee,
  getEmployeeBalance,
} = require('../controllers/employee.controller');

const router = Router();

router.use(authenticate);

router.post  ('/',              createEmployee);       // POST   /employees
router.get   ('/',              listEmployees);        // GET    /employees
router.get   ('/:id/balance',   getEmployeeBalance);   // GET    /employees/:id/balance  (before /:id)
router.put   ('/:id',           updateEmployee);       // PUT    /employees/:id
router.delete('/:id',           deleteEmployee);       // DELETE /employees/:id

module.exports = router;
