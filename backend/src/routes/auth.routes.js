const { Router } = require('express');
const { register, login } = require('../controllers/auth.controller');

const router = Router();

// POST /auth/register
router.post('/register', register);

// POST /auth/login
router.post('/login', login);

module.exports = router;
