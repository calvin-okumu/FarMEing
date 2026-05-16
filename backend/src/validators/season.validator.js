const { z } = require('zod');

const createSeasonSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()).optional().nullable(),
});

const updateSeasonSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  startDate: z.string().or(z.date()).optional(),
  endDate: z.string().or(z.date()).optional().nullable(),
  isDeleted: z.boolean().optional(),
});

module.exports = {
  createSeasonSchema,
  updateSeasonSchema,
};
