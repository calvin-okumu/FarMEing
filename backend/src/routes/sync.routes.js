const express = require('express');
const router = express.Router();
const syncController = require('../controllers/sync.controller');
const { authenticate } = require('../middleware/auth.middleware');

// All sync routes are protected
router.get('/pull', authenticate, syncController.pull);
router.post('/push', authenticate, syncController.push);

module.exports = router;
