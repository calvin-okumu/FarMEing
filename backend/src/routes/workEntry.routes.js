const { Router } = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const {
  createWorkEntry,
  listWorkEntries,
  updateWorkEntry,
  deleteWorkEntry,
  getWorkEntriesByEmployee,
  getWorkEntriesByActivity,
} = require('../controllers/workEntry.controller');

const router = Router();

router.use(authenticate);

router.post  ('/',                      createWorkEntry);
router.get   ('/:projectId',             listWorkEntries);
router.get   ('/:projectId/by-employee', getWorkEntriesByEmployee);
router.get   ('/:projectId/by-activity', getWorkEntriesByActivity);
router.put   ('/:id',                    updateWorkEntry);
router.delete('/:id',                    deleteWorkEntry);

module.exports = router;
