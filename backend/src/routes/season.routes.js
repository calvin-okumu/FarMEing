const { Router } = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const { createSeasonSchema, updateSeasonSchema } = require('../validators/season.validator');
const seasonController = require('../controllers/season.controller');

const router = Router();

// All routes require a valid JWT
router.use(authenticate);

router.post('/', validateRequest(createSeasonSchema), seasonController.createSeason);
router.get('/', seasonController.listSeasons);
router.put('/:id', validateRequest(updateSeasonSchema), seasonController.updateSeason);
router.delete('/:id', seasonController.deleteSeason);

module.exports = router;
