const { Router } = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const {
  createHarvest,
  listHarvests,
  updateHarvest,
  deleteHarvest,
} = require('../controllers/harvest.controller');

const router = Router();

router.use(authenticate);

router.post  ('/',            createHarvest);   // POST   /harvests
router.get   ('/:projectId',  listHarvests);    // GET    /harvests/:projectId
router.put   ('/:id',         updateHarvest);   // PUT    /harvests/:id
router.delete('/:id',         deleteHarvest);   // DELETE /harvests/:id

module.exports = router;
