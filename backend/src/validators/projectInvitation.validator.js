const { z } = require('zod');

const createInvitationSchema = z.object({
  projectId: z.string().min(1),
  role: z.enum(['MANAGER', 'VIEWER']),
});

const joinProjectSchema = z.object({
  inviteCode: z.string().trim().length(8),
});

module.exports = { createInvitationSchema, joinProjectSchema };
