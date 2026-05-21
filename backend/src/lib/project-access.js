const prisma = require('./prisma');

const OWNER_ROLE = 'OWNER';

const ensureOwnerAccess = async (projectId, userId) => {
  if (!prisma.projectAccess) {
    return null;
  }

  return prisma.projectAccess.upsert({
    where: {
      userId_projectId: {
        userId,
        projectId,
      },
    },
    create: {
      userId,
      projectId,
      role: OWNER_ROLE,
    },
    update: {
      role: OWNER_ROLE,
    },
  });
};

/**
 * Checks if a user has access to a specific project.
 * @param {string} projectId 
 * @param {string} userId 
 * @param {string[]} allowedRoles - Optional list of required roles (e.g. ['OWNER', 'MANAGER'])
 * @returns {Promise<{ hasAccess: boolean, role: string|null, project: object|null }>}
 */
const checkProjectAccess = async (projectId, userId, allowedRoles = []) => {
  const access = prisma.projectAccess
    ? await prisma.projectAccess.findFirst({
        where: { projectId, userId },
        include: { project: true }
      })
    : null;

  if (access && !access.project.isDeleted) {
    if (allowedRoles.length > 0 && !allowedRoles.includes(access.role)) {
      return { hasAccess: false, role: access.role, project: access.project };
    }

    return { hasAccess: true, role: access.role, project: access.project };
  }

  const project = await prisma.farmProject.findUnique({ where: { id: projectId } });

  if (!project || project.isDeleted || project.userId !== userId) {
    return { hasAccess: false, role: null, project: null };
  }

  await ensureOwnerAccess(projectId, userId);

  if (allowedRoles.length > 0 && !allowedRoles.includes(OWNER_ROLE)) {
    return { hasAccess: false, role: OWNER_ROLE, project };
  }

  return { hasAccess: true, role: OWNER_ROLE, project };
};

/**
 * Helper to handle the response for access checks in controllers.
 * Returns the access object if successful, or sends an error response and returns null.
 */
const verifyProjectAccess = async (projectId, userId, res, allowedRoles = []) => {
  const { hasAccess, role, project } = await checkProjectAccess(projectId, userId, allowedRoles);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }

  if (!hasAccess) {
    res.status(403).json({ error: 'Permission denied' });
    return null;
  }

  return { role, project };
};

module.exports = {
  checkProjectAccess,
  verifyProjectAccess,
};
