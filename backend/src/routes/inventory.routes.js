const { Router } = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const { createInventorySchema, updateInventorySchema } = require('../validators/inventory.validator');
const {
  createInventoryItem,
  listInventoryItems,
  updateInventoryItem,
  deleteInventoryItem,
} = require('../controllers/inventory.controller');

const router = Router();

router.use(authenticate);

router.post('/', validateRequest(createInventorySchema), createInventoryItem);
router.get('/:projectId', listInventoryItems);
router.put('/:id', validateRequest(updateInventorySchema), updateInventoryItem);
router.delete('/:id', deleteInventoryItem);

module.exports = router;
