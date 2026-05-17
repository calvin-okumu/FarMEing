const { z } = require('zod');

const createWorkEntrySchema = z.object({
  projectId:   z.string().uuid(),
  blockId:     z.string().uuid().optional().nullable(),
  employeeId:  z.string().uuid(),
  activity:    z.string().min(1, 'Activity is required'),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  daysWorked:  z.number().positive('Days worked must be positive'),
  ratePerDay:  z.number().nonnegative('Rate per day cannot be negative'),
  hoursWorked: z.number().nonnegative().optional().nullable(),
  imageUrl:    z.string().optional().nullable(),
  locationLat: z.number().optional().nullable(),
  locationLng: z.number().optional().nullable(),
  status:      z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING'),
  isRecurring: z.boolean().default(false),
  frequency:   z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional().nullable(),
  notes:       z.string().optional().nullable(),
});

const updateWorkEntrySchema = z.object({
  blockId:     z.string().uuid().optional().nullable(),
  activity:    z.string().min(1).optional(),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  daysWorked:  z.number().positive().optional(),
  ratePerDay:  z.number().nonnegative().optional(),
  hoursWorked: z.number().nonnegative().optional().nullable(),
  imageUrl:    z.string().optional().nullable(),
  status:      z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  notes:       z.string().optional().nullable(),
  isPaid:      z.boolean().optional(),
});

module.exports = {
  createWorkEntrySchema,
  updateWorkEntrySchema,
};
