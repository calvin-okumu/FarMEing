const prisma = require('../lib/prisma');
const { verifyProjectAccess } = require('../lib/project-access');
const crypto = require('crypto');

/**
 * OWNER creates a new invitation code for a project.
 */
const createInvitation = async (req, res) => {
  const { projectId, role } = req.validatedData;

  try {
    // Only OWNER can invite others
    const access = await verifyProjectAccess(projectId, req.user.id, res, ['OWNER']);
    if (!access) return;

    // Generate a unique 8-character code
    const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expire in 7 days

    const invitation = await prisma.projectInvitation.create({
      data: {
        projectId,
        role,
        inviteCode,
        expiresAt,
      },
    });

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
  const { inviteCode } = req.validatedData;

  try {
    const invitation = await prisma.projectInvitation.findUnique({
      where: { inviteCode },
      include: { project: true }
    });

    if (!invitation || invitation.isUsed || invitation.isDeleted || invitation.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired invitation code' });
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

    if (existingAccess) {
      // Mark invitation as used anyway if it was valid
      await prisma.projectInvitation.update({
        where: { id: invitation.id },
        data: { isUsed: true }
      });
      return res.status(200).json({ message: 'You already have access to this project', project: invitation.project });
    }

    // Create ProjectAccess and mark invitation as used in a transaction
    await prisma.$transaction([
      prisma.projectAccess.create({
        data: {
          userId: req.user.id,
          projectId: invitation.projectId,
          role: invitation.role,
        }
      }),
      prisma.projectInvitation.update({
        where: { id: invitation.id },
        data: { isUsed: true }
      })
    ]);

    return res.status(201).json({ message: 'Successfully joined project', project: invitation.project });
  } catch (error) {
    console.error('Join Project Error:', error);
    return res.status(500).json({ error: 'Failed to join project' });
  }
};

module.exports = { createInvitation, joinProject };
