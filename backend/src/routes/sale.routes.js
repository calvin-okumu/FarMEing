const { Router } = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const { createSaleSchema, updateSaleSchema } = require('../validators/sale.validator');
const {
  createSale,
  listSales,
  updateSale,
  deleteSale,
} = require('../controllers/sale.controller');

const router = Router();

router.use(authenticate);

router.post('/', validateRequest(createSaleSchema), createSale);
router.get('/:projectId', listSales);
router.put('/:id', validateRequest(updateSaleSchema), updateSale);
router.delete('/:id', deleteSale);

module.exports = router;
