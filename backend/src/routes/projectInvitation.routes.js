const { Router } = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const { createInvitationSchema, joinProjectSchema } = require('../validators/projectInvitation.validator');
const {
  createInvitation,
  joinProject,
} = require('../controllers/projectInvitation.controller');

const router = Router();

router.use(authenticate);

/**
 * POST /invitations
 * Create a new project invitation code.
 */
router.post('/', validateRequest(createInvitationSchema), createInvitation);

/**
 * POST /invitations/join
 * Join a project using an invite code.
 */
router.post('/join', validateRequest(joinProjectSchema), joinProject);

module.exports = router;
