const { z } = require('zod');

const createEmployeeSchema = z.object({
  name:  z.string().min(1, 'Name is required'),
  phone: z
    .string()
    .regex(/^\+?[0-9\s\-()]+$/, 'Invalid phone number format')
    .optional()
    .nullable(),
  role:  z.string().optional().nullable(),
});

const updateEmployeeSchema = z
  .object({
    name:  z.string().min(1).optional(),
    phone: z
      .string()
      .regex(/^\+?[0-9\s\-()]+$/, 'Invalid phone number format')
      .optional()
      .nullable(),
    role:  z.string().optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required for update',
  });

module.exports = { createEmployeeSchema, updateEmployeeSchema };
