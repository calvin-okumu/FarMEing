const { Router } = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const { createWorkEntrySchema, updateWorkEntrySchema } = require('../validators/workEntry.validator');
const {
  createWorkEntry,
  listWorkEntries,
  updateWorkEntry,
  deleteWorkEntry,
  approveWorkEntry,
  getWorkEntriesByEmployee,
  getWorkEntriesByActivity,
} = require('../controllers/workEntry.controller');

const router = Router();

router.use(authenticate);

router.post('/', validateRequest(createWorkEntrySchema), createWorkEntry);
router.get('/:projectId', listWorkEntries);
router.get('/:projectId/by-employee', getWorkEntriesByEmployee);
router.get('/:projectId/by-activity', getWorkEntriesByActivity);
router.put('/:id', validateRequest(updateWorkEntrySchema), updateWorkEntry);
router.patch('/:id/approve', approveWorkEntry);
router.delete('/:id', deleteWorkEntry);

module.exports = router;
