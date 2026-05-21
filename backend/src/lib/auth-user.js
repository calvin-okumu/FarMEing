const prisma = require('./prisma');

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

const LEGACY_AUTH_USER_SELECT = {
  id: true,
  name: true,
  phone: true,
  currency: true,
  locale: true,
  isDeleted: true,
  createdAt: true,
};

function isMissingRoleColumnError(error) {
  return (
    error?.name === 'PrismaClientKnownRequestError' &&
    typeof error.message === 'string' &&
    error.message.includes('The column') &&
    error.message.includes('role') &&
    error.message.includes('does not exist')
  );
}

function withLegacyRole(user, fallbackRole = 'ADMIN') {
  if (!user) {
    return null;
  }

  return {
    ...user,
    role: fallbackRole,
  };
}

async function findAuthUserByPhone(phone, options = {}) {
  const { includePassword = false } = options;
  const select = {
    ...AUTH_USER_SELECT,
    ...(includePassword ? { password: true } : {}),
  };

  try {
    const user = await prisma.user.findUnique({ where: { phone }, select });
    if (!user || user.isDeleted) return null;
    return user;
  } catch (error) {
    if (!isMissingRoleColumnError(error)) {
      throw error;
    }

    const legacyUser = await prisma.user.findUnique({
      where: { phone },
      select: {
        ...LEGACY_AUTH_USER_SELECT,
        ...(includePassword ? { password: true } : {}),
      },
    });

    const user = withLegacyRole(legacyUser);
    if (!user || user.isDeleted) return null;
    return user;
  }
}

async function findAuthUserById(id) {
  try {
    const user = await prisma.user.findUnique({ where: { id }, select: AUTH_USER_SELECT });
    if (!user || user.isDeleted) return null;
    return user;
  } catch (error) {
    if (!isMissingRoleColumnError(error)) {
      throw error;
    }

    const legacyUser = await prisma.user.findUnique({
      where: { id },
      select: LEGACY_AUTH_USER_SELECT,
    });

    const user = withLegacyRole(legacyUser);
    if (!user || user.isDeleted) return null;
    return user;
  }
}

async function createAuthUser({ name, phone, password, role }) {
  try {
    return await prisma.user.create({
      data: { name, phone, password, role: role || 'ADMIN' },
      select: AUTH_USER_SELECT,
    });
  } catch (error) {
    if (!isMissingRoleColumnError(error)) {
      throw error;
    }

    const legacyUser = await prisma.user.create({
      data: { name, phone, password },
      select: LEGACY_AUTH_USER_SELECT,
    });

    return withLegacyRole(legacyUser, role || 'ADMIN');
  }
}

module.exports = {
  createAuthUser,
  findAuthUserById,
  findAuthUserByPhone,
};
