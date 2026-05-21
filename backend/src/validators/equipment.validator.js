const { z } = require('zod');

const createEquipmentSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string(),
  type: z.string(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  purchaseDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  purchasePrice: z.number().optional(),
  status: z.enum(['OPERATIONAL', 'MAINTENANCE', 'BROKEN', 'DISPOSED']),
  notes: z.string().optional(),
});

const updateEquipmentSchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  purchaseDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  purchasePrice: z.number().optional(),
  status: z.enum(['OPERATIONAL', 'MAINTENANCE', 'BROKEN', 'DISPOSED']).optional(),
  notes: z.string().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field is required for update',
});

module.exports = { createEquipmentSchema, updateEquipmentSchema };
