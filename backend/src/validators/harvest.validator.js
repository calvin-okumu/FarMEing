const { z } = require('zod');

const dateField = z
  .string()
  .datetime({ offset: true })
  .or(z.string().date());

const createHarvestSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  blockId:   z.string().uuid('Block ID is required'),

  crop:      z.string().min(1, 'Crop name is required'),
  date:      dateField,
  weight:    z.number().positive('Weight must be positive'),
  rejectedWeight: z.number().nonnegative('Rejected weight cannot be negative').optional().nullable(),
  rejectedReason: z.string().optional().nullable(),
  unit:      z.string().default('kg'),
  quality:   z.string().optional().nullable(),
  notes:     z.string().optional().nullable(),
}).refine(data => (data.rejectedWeight || 0) <= data.weight, {
  message: "Rejected weight cannot exceed total collected weight",
  path: ["rejectedWeight"],
});

const updateHarvestSchema = z
  .object({
    blockId: z.string().uuid('Invalid block ID').optional().nullable(),
    crop:    z.string().min(1).optional(),
    date:    dateField.optional(),
    weight:  z.number().positive().optional(),
    rejectedWeight: z.number().nonnegative().optional().nullable(),
    rejectedReason: z.string().optional().nullable(),
    unit:    z.string().optional(),
    quality: z.string().optional().nullable(),
    notes:   z.string().optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required for update',
  });

module.exports = { createHarvestSchema, updateHarvestSchema };
