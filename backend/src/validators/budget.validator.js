const { z } = require('zod');

const createBudgetItemSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  category:  z.string().min(1, 'Category is required'),
  name:      z.string().min(1, 'Name is required'),
  quantity:  z.number().positive('Quantity must be a positive number'),
  unit:      z.string().min(1, 'Unit is required'),
  unitPrice: z.number().nonnegative('Unit price must be zero or greater'),
  notes:     z.string().optional().nullable(),
  // `total` is intentionally excluded — always computed server-side
});

const updateBudgetItemSchema = z.object({
  category:  z.string().min(1).optional(),
  name:      z.string().min(1).optional(),
  quantity:  z.number().positive().optional(),
  unit:      z.string().min(1).optional(),
  unitPrice: z.number().nonnegative().optional(),
  notes:     z.string().optional().nullable(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field is required for update' }
);

module.exports = { createBudgetItemSchema, updateBudgetItemSchema };
