const { z } = require('zod');

const VALID_CATEGORIES = ['seeds', 'fertilizer', 'pesticide', 'equipment', 'other'];

const createInventorySchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  name:      z.string().min(1, 'Name is required'),
  category:  z.string().min(1, 'Category is required'),
  quantity:  z.number().positive('Quantity must be a positive number'),
  unit:      z.string().min(1, 'Unit is required'),
  unitCost:  z.number().nonnegative('Unit cost must be zero or greater'),
  usedQty:   z.number().nonnegative('Used quantity cannot be negative').optional(),
  notes:     z.string().optional().nullable(),
  payee:     z.string().optional().nullable(),
  payeeId:   z.string().uuid('Invalid payee ID').optional().nullable(),
  // totalCost is excluded — always computed server-side
});

const updateInventorySchema = z
  .object({
    name:     z.string().min(1).optional(),
    category: z.string().min(1).optional(),
    quantity: z.number().positive().optional(),
    unit:     z.string().min(1).optional(),
    unitCost: z.number().nonnegative().optional(),
    usedQty:  z.number().nonnegative('Used quantity cannot be negative').optional(),
    notes:    z.string().optional().nullable(),
    payee:    z.string().optional().nullable(),
    payeeId:  z.string().uuid('Invalid payee ID').optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required for update',
  })
  .refine(
    (data) => {
      // Cross-field check deferred to controller where we have existing values
      return true;
    }
  );

module.exports = { createInventorySchema, updateInventorySchema };
