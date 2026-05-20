const { z } = require('zod');

const createInvitationSchema = z.object({
  projectId: z.string().uuid(),
  role: z.enum(['MANAGER', 'VIEWER']),
});

const joinProjectSchema = z.object({
  inviteCode: z.string().min(6),
});

module.exports = { createInvitationSchema, joinProjectSchema };
