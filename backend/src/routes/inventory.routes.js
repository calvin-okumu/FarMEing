const { Router } = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const {
  createInventoryItem,
  listInventoryItems,
  updateInventoryItem,
  deleteInventoryItem,
} = require('../controllers/inventory.controller');

const router = Router();

router.use(authenticate);

router.post  ('/',            createInventoryItem);   // POST   /inventory
router.get   ('/:projectId',  listInventoryItems);    // GET    /inventory/:projectId
router.put   ('/:id',         updateInventoryItem);   // PUT    /inventory/:id
router.delete('/:id',         deleteInventoryItem);   // DELETE /inventory/:id

module.exports = router;
