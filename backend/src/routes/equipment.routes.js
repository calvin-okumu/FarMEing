const { Router } = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const { createEquipmentSchema, updateEquipmentSchema } = require('../validators/equipment.validator');
const {
  createEquipment,
  listEquipments,
  updateEquipment,
  deleteEquipment,
} = require('../controllers/equipment.controller');

const router = Router();

router.use(authenticate);

router.post('/', validateRequest(createEquipmentSchema), createEquipment);
router.get('/:projectId', listEquipments);
router.put('/:id', validateRequest(updateEquipmentSchema), updateEquipment);
router.delete('/:id', deleteEquipment);

module.exports = router;
