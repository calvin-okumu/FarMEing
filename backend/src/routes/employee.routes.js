const { Router } = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const { createEmployeeSchema, updateEmployeeSchema } = require('../validators/employee.validator');
const {
  createEmployee,
  listEmployees,
  updateEmployee,
  deleteEmployee,
  getEmployeeBalance,
} = require('../controllers/employee.controller');

const router = Router();

router.use(authenticate);

router.post('/', validateRequest(createEmployeeSchema), createEmployee);
router.get('/', listEmployees);
router.get('/:id/balance', getEmployeeBalance);
router.put('/:id', validateRequest(updateEmployeeSchema), updateEmployee);
router.delete('/:id', deleteEmployee);

module.exports = router;
