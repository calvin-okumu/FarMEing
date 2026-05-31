const prisma = require('../lib/prisma');
const { verifyProjectAccess } = require('../lib/project-access');
const crypto = require('crypto');

const MAX_INVITE_CODE_ATTEMPTS = 5;

function buildInviteCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function isInviteCodeConstraintError(error) {
  return (
    error?.name === 'PrismaClientKnownRequestError' &&
    error?.code === 'P2002' &&
    Array.isArray(error?.meta?.target) &&
    error.meta.target.includes('inviteCode')
  );
}

/**
 * OWNER creates a new invitation code for a project.
 */
const createInvitation = async (req, res) => {
  const { projectId, role } = req.validatedData;

  try {
    // Only OWNER can invite others
    const access = await verifyProjectAccess(projectId, req.user.id, res, ['OWNER']);
    if (!access) return;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expire in 7 days

    let invitation = null;

    for (let attempt = 0; attempt < MAX_INVITE_CODE_ATTEMPTS; attempt += 1) {
      try {
        invitation = await prisma.projectInvitation.create({
          data: {
            projectId,
            role,
            inviteCode: buildInviteCode(),
            expiresAt,
          },
        });
        break;
      } catch (error) {
        if (!isInviteCodeConstraintError(error) || attempt === MAX_INVITE_CODE_ATTEMPTS - 1) {
          throw error;
        }
      }
    }

    return res.status(201).json({ invitation });
  } catch (error) {
    console.error('Create Invitation Error:', error);
    return res.status(500).json({ error: 'Failed to create invitation' });
  }
};

/**
 * ANY user joins a project using an invite code.
 */
const joinProject = async (req, res) => {
  const inviteCode = req.validatedData.inviteCode.trim().toUpperCase();

  try {
    const invitation = await prisma.projectInvitation.findUnique({
      where: { inviteCode },
      include: { project: true }
    });

    if (!invitation || invitation.isUsed || invitation.isDeleted || invitation.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired invitation code' });
    }

    if (!invitation.project || invitation.project.isDeleted) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user already has access
    const existingAccess = await prisma.projectAccess.findUnique({
      where: {
        userId_projectId: {
          userId: req.user.id,
          projectId: invitation.projectId
        }
      }
    });

    if (existingAccess && !existingAccess.isDeleted) {
      return res.status(200).json({ message: 'You already have access to this project', project: invitation.project });
    }

    // Fetch joiner details
    const joiner = await prisma.user.findUnique({ where: { id: req.user.id } });

    // Create ProjectAccess and mark invitation as used in a transaction
    if (existingAccess?.isDeleted) {
      await prisma.$transaction([
        prisma.projectAccess.update({
          where: { id: existingAccess.id },
          data: {
            isDeleted: false,
            role: invitation.role,
            userName: joiner?.name,
            userPhone: joiner?.phone,
          },
        }),
        prisma.projectInvitation.update({
          where: { id: invitation.id },
          data: { isUsed: true }
        })
      ]);
    } else {
      await prisma.$transaction([
        prisma.projectAccess.create({
          data: {
            userId:    req.user.id,
            projectId: invitation.projectId,
            role:      invitation.role,
            userName:  joiner?.name,
            userPhone: joiner?.phone,
          }
        }),
        prisma.projectInvitation.update({
          where: { id: invitation.id },
          data: { isUsed: true }
        })
      ]);
    }

    return res.status(201).json({ message: 'Successfully joined project', project: invitation.project });
  } catch (error) {
    console.error('Join Project Error:', error);
    return res.status(500).json({ error: 'Failed to join project' });
  }
};

/**
 * OWNER lists all invitations for a project.
 */
const listInvitations = async (req, res) => {
  const { projectId } = req.params;

  try {
    const access = await verifyProjectAccess(projectId, req.user.id, res, ['OWNER']);
    if (!access) return;

    const invitations = await prisma.projectInvitation.findMany({
      where: {
        projectId,
        isDeleted: false,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ invitations });
  } catch (error) {
    console.error('List Invitations Error:', error);
    return res.status(500).json({ error: 'Failed to list invitations' });
  }
};

/**
 * OWNER deletes/revokes an invitation.
 */
const deleteInvitation = async (req, res) => {
  const { id } = req.params;

  try {
    const invitation = await prisma.projectInvitation.findUnique({
      where: { id },
    });

    if (!invitation || invitation.isDeleted) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Verify user is OWNER of the project
    const access = await verifyProjectAccess(invitation.projectId, req.user.id, res, ['OWNER']);
    if (!access) return;

    await prisma.projectInvitation.update({
      where: { id },
      data: { isDeleted: true },
    });

    return res.json({ message: 'Invitation revoked successfully' });
  } catch (error) {
    console.error('Delete Invitation Error:', error);
    return res.status(500).json({ error: 'Failed to delete invitation' });
  }
};

module.exports = { createInvitation, joinProject, listInvitations, deleteInvitation };
