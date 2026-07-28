const { stripControlChars } = require('../utils/strip-control-chars')

/**
 * Centralized error handler middleware.
 * Must be registered after all routes.
 */
function errorHandler(err, req, res, _next) {
  // An error message can carry attacker-influenced bytes (a filename, parsed
  // document content). Strip them before they reach the operator's terminal or
  // a client that prints the parsed response.
  const message = stripControlChars(err?.message || '').replace(/\s+/g, ' ').trim()
  console.error('[Server Error]', message || err)

  // Multer file-size / file-type errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large (max 100 MB)' })
  }

  const status = err.status || err.statusCode || 500
  res.status(status).json({ error: message || 'Internal server error' })
}

module.exports = { errorHandler }
