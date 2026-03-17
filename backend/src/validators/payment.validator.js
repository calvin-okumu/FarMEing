const { z } = require('zod');

const dateField = z
  .string()
  .datetime({ offset: true })
  .or(z.string().date());

const createPaymentSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  amount:     z.number().positive('Amount must be a positive number'),
  date:       dateField,
  note:       z.string().optional().nullable(),
});

module.exports = { createPaymentSchema };
