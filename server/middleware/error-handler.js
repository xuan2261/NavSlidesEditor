/**
 * Centralized error handler middleware.
 * Must be registered after all routes.
 */
function errorHandler(err, req, res, _next) {
  console.error('[Server Error]', err.message || err);

  // Multer file-size / file-type errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large (max 100 MB)' });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
}

module.exports = { errorHandler };
