const { z } = require('zod');

const dateField = z
  .string()
  .datetime({ offset: true })
  .or(z.string().date());

const createExpenseSchema = z.object({
  projectId:  z.string().uuid('Invalid project ID'),
  blockId:    z.string().uuid('Invalid block ID').optional().nullable(),
  category:   z.string().min(1, 'Category is required'),
  expenseType: z.enum(['CAPEX', 'OPEX']).optional(),
  amount:     z.number().positive('Amount must be a positive number'),
  date:       dateField,
  isRecurring: z.boolean().optional(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional().nullable(),
  note:       z.string().optional().nullable(),
  receiptUrl: z.string().url('Invalid receipt URL').optional().nullable(),
  payee:      z.string().optional().nullable(),
  payeeId:    z.string().uuid('Invalid payee ID').optional().nullable(),
});

const updateExpenseSchema = z
  .object({
    blockId:    z.string().uuid('Invalid block ID').optional().nullable(),
    category:   z.string().min(1).optional(),
    expenseType: z.enum(['CAPEX', 'OPEX']).optional(),
    amount:     z.number().positive().optional(),
    date:       dateField.optional(),
    isRecurring: z.boolean().optional(),
    frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional().nullable(),
    note:       z.string().optional().nullable(),
    receiptUrl: z.string().url('Invalid receipt URL').optional().nullable(),
    payee:      z.string().optional().nullable(),
    payeeId:    z.string().uuid('Invalid payee ID').optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required for update',
  });

module.exports = { createExpenseSchema, updateExpenseSchema };
