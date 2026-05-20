const { z } = require('zod');

const createProjectSchema = z.object({
  name:      z.string().min(1, 'Name is required'),
  crop:      z.string().min(1, 'Crop is required'),
  cropVariety: z.string().optional().nullable(),
  landSize:  z.number().positive('Land size must be a positive number'),
  landUnit:  z.string().optional(),          // defaults to "acres" in DB
  startDate: z.string().datetime({ offset: true }).or(z.string().date()),
  endDate:   z.string().datetime({ offset: true }).or(z.string().date()).optional().nullable(),
  expectedYield: z.number().nonnegative('Expected yield cannot be negative').optional().nullable(),
  status: z.enum(['PLANNING', 'ACTIVE', 'HARVESTED', 'CLOSED']).optional(),
  seasonId:  z.string().uuid('Invalid season ID').optional().nullable(),
  numberOfBlocks: z.number().int().min(0).max(26).optional().nullable(),
  notes:     z.string().optional().nullable(),
  contractUrl: z.string().url('Invalid contract URL').optional().nullable(),
});


// All fields optional for PATCH-style updates
const updateProjectSchema = createProjectSchema.partial();

module.exports = { createProjectSchema, updateProjectSchema };
