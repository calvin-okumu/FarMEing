const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { authenticate } = require('../middleware/auth.middleware');

// All report routes are protected
router.use(authenticate);

router.get('/project/:id/pdf', reportController.generateProjectReport);

module.exports = router;
