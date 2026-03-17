const { Router } = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  getProjectSummary,
} = require('../controllers/project.controller');

const router = Router();

// All routes require a valid JWT
router.use(authenticate);

router.post  ('/',           createProject);
router.get   ('/',           listProjects);
router.get   ('/:id/summary', getProjectSummary);  // before /:id to avoid shadowing
router.get   ('/:id',        getProject);
router.put   ('/:id',        updateProject);
router.delete('/:id',        deleteProject);

module.exports = router;
