/**
 * Zod-based request validation middleware.
 * Usage:  router.post('/', validate(schema), handler)
 */
const { ZodError } = require('zod')

/**
 * Returns an Express middleware that validates req.body against a Zod schema.
 * On validation failure, responds with 400 and structured error details.
 */
function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body)
      next()
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: (err.issues || err.errors || []).map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        })
      }
      next(err)
    }
  }
}

module.exports = { validate }
