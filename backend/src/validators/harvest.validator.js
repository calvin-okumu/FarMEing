const { z } = require('zod');

const dateField = z
  .string()
  .datetime({ offset: true })
  .or(z.string().date());

const createHarvestSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  crop:      z.string().min(1, 'Crop name is required'),
  date:      dateField,
  weight:    z.number().positive('Weight must be positive'),
  unit:      z.string().default('kg'),
  quality:   z.string().optional().nullable(),
  notes:     z.string().optional().nullable(),
});

const updateHarvestSchema = z
  .object({
    crop:    z.string().min(1).optional(),
    date:    dateField.optional(),
    weight:  z.number().positive().optional(),
    unit:    z.string().optional(),
    quality: z.string().optional().nullable(),
    notes:   z.string().optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required for update',
  });

module.exports = { createHarvestSchema, updateHarvestSchema };
