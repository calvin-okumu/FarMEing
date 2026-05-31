const prisma = require('../lib/prisma');

const AUTH_USER_SELECT = {
  id: true,
  name: true,
  phone: true,
  role: true,
  currency: true,
  locale: true,
  isDeleted: true,
  createdAt: true,
};

const getMe = async (req, res) => {
  return res.json({ user: req.user });
};

const updateMe = async (req, res) => {
  const allowed = ['name', 'currency', 'locale'];
  const updates = {};

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates[key] = req.body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updates,
      select: AUTH_USER_SELECT,
    });

    return res.json({ user });
  } catch (error) {
    console.error('Update Me Error:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
};

module.exports = { getMe, updateMe };
