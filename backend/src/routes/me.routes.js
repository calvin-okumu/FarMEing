const { Router } = require('express');
const { getMe, updateMe } = require('../controllers/me.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = Router();

router.use(authenticate);

router.get('/', getMe);
router.patch('/', updateMe);

module.exports = router;
