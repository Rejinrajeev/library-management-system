const ApiError = require('../utils/ApiError');

function notFoundHandler(req, res, next) {
  next(new ApiError(404, 'NOT_FOUND', 'Route not found.'));
}

function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }

  // Postgres unique_violation
  if (err.code === '23505') {
    return res.status(409).json({ error: { code: 'CONFLICT', message: 'That value already exists.' } });
  }

  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } });
}

module.exports = { notFoundHandler, errorHandler };
