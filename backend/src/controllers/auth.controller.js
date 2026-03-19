const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { registerSchema, loginSchema } = require('../validators/auth.validator');

const SALT_ROUNDS = 10;
const JWT_EXPIRES_IN = '7d';

// POST /auth/register
const register = async (req, res) => {
  // Validate input
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const { name, phone, password, role } = result.data;

  // Check for duplicate phone
  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    return res.status(409).json({ error: 'Phone number already registered' });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  // Create user
  const user = await prisma.user.create({
    data: { name, phone, password: hashedPassword, role: role || 'ADMIN' },
    select: { id: true, name: true, phone: true, role: true, currency: true, locale: true, createdAt: true },
  });

  // Issue token
  const token = jwt.sign(
    { sub: user.id, phone: user.phone },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return res.status(201).json({ user, token });
};

// POST /auth/login
const login = async (req, res) => {
  // Validate input
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const { phone, password } = result.data;

  // Look up user
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid phone or password' });
  }

  // Compare password
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid phone or password' });
  }

  // Issue token
  const token = jwt.sign(
    { sub: user.id, phone: user.phone },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  const { password: _pw, ...userWithoutPassword } = user;

  return res.status(200).json({ user: userWithoutPassword, token });
};

module.exports = { register, login };
