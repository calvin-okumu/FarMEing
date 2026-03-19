const { Router } = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const {
  createSale,
  listSales,
  updateSale,
  deleteSale,
} = require('../controllers/sale.controller');

const router = Router();

router.use(authenticate);

router.post  ('/',            createSale);   // POST   /sales
router.get   ('/:projectId',  listSales);    // GET    /sales/:projectId
router.put   ('/:id',         updateSale);   // PUT    /sales/:id
router.delete('/:id',         deleteSale);   // DELETE /sales/:id

module.exports = router;
