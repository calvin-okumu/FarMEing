const { z } = require('zod');

const createWorkEntrySchema = z.object({
  projectId:  z.string().uuid(),
  employeeId: z.string().uuid(),
  activity:   z.string().min(1, 'Activity is required'),
  date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  daysWorked: z.number().positive('Days worked must be positive'),
  ratePerDay: z.number().nonnegative('Rate per day cannot be negative'),
  notes:      z.string().optional().nullable(),
});

const updateWorkEntrySchema = z.object({
  activity:   z.string().min(1).optional(),
  date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  daysWorked: z.number().positive().optional(),
  ratePerDay: z.number().nonnegative().optional(),
  notes:      z.string().optional().nullable(),
  isPaid:     z.boolean().optional(),
});

module.exports = {
  createWorkEntrySchema,
  updateWorkEntrySchema,
};
