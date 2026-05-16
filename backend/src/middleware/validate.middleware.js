/**
 * Middleware to validate request body against a Zod schema.
 * @param {import('zod').ZodSchema} schema 
 */
const validateRequest = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }
  req.validatedData = result.data;
  next();
};

module.exports = { validateRequest };
