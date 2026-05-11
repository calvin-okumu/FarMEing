const prisma = require('./prisma');

/**
 * Checks if a user has access to a specific project.
 * @param {string} projectId 
 * @param {string} userId 
 * @param {string[]} allowedRoles - Optional list of required roles (e.g. ['OWNER', 'MANAGER'])
 * @returns {Promise<{ hasAccess: boolean, role: string|null, project: object|null }>}
 */
const checkProjectAccess = async (projectId, userId, allowedRoles = []) => {
  const access = await prisma.projectAccess.findFirst({
    where: { projectId, userId },
    include: { project: true }
  });

  if (!access || access.project.isDeleted) {
    return { hasAccess: false, role: null, project: null };
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(access.role)) {
    return { hasAccess: false, role: access.role, project: access.project };
  }

  return { hasAccess: true, role: access.role, project: access.project };
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
