const { z } = require('zod');

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z
    .string()
    .min(7, 'Phone number too short')
    .regex(/^\+?[0-9\s\-()]+$/, 'Invalid phone number format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['ADMIN', 'WORKER']).optional(),
});

const loginSchema = z.object({
  phone: z.string().min(1, 'Phone is required'),
  password: z.string().min(1, 'Password is required'),
});

module.exports = { registerSchema, loginSchema };
