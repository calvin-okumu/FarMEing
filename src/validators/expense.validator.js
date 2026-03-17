const { z } = require('zod');

const dateField = z
  .string()
  .datetime({ offset: true })
  .or(z.string().date());

const createExpenseSchema = z.object({
  projectId:  z.string().uuid('Invalid project ID'),
  category:   z.string().min(1, 'Category is required'),
  amount:     z.number().positive('Amount must be a positive number'),
  date:       dateField,
  note:       z.string().optional().nullable(),
  receiptUrl: z.string().url('Invalid receipt URL').optional().nullable(),
});

const updateExpenseSchema = z
  .object({
    category:   z.string().min(1).optional(),
    amount:     z.number().positive().optional(),
    date:       dateField.optional(),
    note:       z.string().optional().nullable(),
    receiptUrl: z.string().url('Invalid receipt URL').optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required for update',
  });

module.exports = { createExpenseSchema, updateExpenseSchema };
