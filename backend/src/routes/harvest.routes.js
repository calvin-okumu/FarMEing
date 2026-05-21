const { Router } = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const { createHarvestSchema, updateHarvestSchema } = require('../validators/harvest.validator');
const {
  createHarvest,
  listHarvests,
  updateHarvest,
  deleteHarvest,
} = require('../controllers/harvest.controller');

const router = Router();

router.use(authenticate);

router.post('/', validateRequest(createHarvestSchema), createHarvest);
router.get('/:projectId', listHarvests);
router.put('/:id', validateRequest(updateHarvestSchema), updateHarvest);
router.delete('/:id', deleteHarvest);

module.exports = router;
