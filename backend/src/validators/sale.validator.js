const { z } = require('zod');

const dateField = z
  .string()
  .datetime({ offset: true })
  .or(z.string().date());

const createSaleSchema = z.object({
  projectId:   z.string().uuid('Invalid project ID'),
  blockId:     z.string().uuid('Invalid block ID').optional().nullable(),
  date:        dateField,
  customer:    z.string().optional().nullable(),
  weightSold:  z.number().positive('Weight sold must be positive'),
  unitPrice:   z.number().positive('Unit price must be positive'),
  totalAmount: z.number().positive('Total amount must be positive'),
  receiptUrl:  z.string().url('Invalid receipt URL').optional().nullable(),
  invoiceUrl:  z.string().url('Invalid invoice URL').optional().nullable(),
  notes:       z.string().optional().nullable(),
});

const updateSaleSchema = z
  .object({
    blockId:     z.string().uuid('Invalid block ID').optional().nullable(),
    date:        dateField.optional(),
    customer:    z.string().optional().nullable(),
    weightSold:  z.number().positive().optional(),
    unitPrice:   z.number().positive().optional(),
    totalAmount: z.number().positive().optional(),
    receiptUrl:  z.string().url('Invalid receipt URL').optional().nullable(),
    invoiceUrl:  z.string().url('Invalid invoice URL').optional().nullable(),
    notes:       z.string().optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required for update',
  });

module.exports = { createSaleSchema, updateSaleSchema };
