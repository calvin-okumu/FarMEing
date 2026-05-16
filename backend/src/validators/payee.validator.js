const { z } = require('zod');

const createPayeeSchema = z.object({
  name:     z.string().min(1, 'Name is required'),
  phone:    z.string().optional().nullable(),
  email:    z.string().email('Invalid email address').optional().nullable(),
  address:  z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  notes:    z.string().optional().nullable(),
});

const updatePayeeSchema = z.object({
  name:     z.string().min(1, 'Name is required').optional(),
  phone:    z.string().optional().nullable(),
  email:    z.string().email('Invalid email address').optional().nullable(),
  address:  z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  notes:    z.string().optional().nullable(),
});

module.exports = {
  createPayeeSchema,
  updatePayeeSchema,
};
