const { z } = require('zod');

const addProjectMemberSchema = z.object({
  phone: z.string().min(1, 'Phone number is required'),
  role:  z.enum(['MANAGER', 'VIEWER'], { errorMap: () => ({ message: 'Invalid role. Must be MANAGER or VIEWER' }) }),
});

module.exports = {
  addProjectMemberSchema,
};
