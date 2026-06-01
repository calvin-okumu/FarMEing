const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { authenticate } = require('../middleware/auth.middleware');

// All report routes are protected
router.use(authenticate);

router.get('/project/:id/pdf', reportController.generateProjectReport);
router.get('/project/:id/excel', reportController.generateProjectExcelReport);
router.get('/full-backup/excel', reportController.generateFullUserExcelBackup);

module.exports = router;
