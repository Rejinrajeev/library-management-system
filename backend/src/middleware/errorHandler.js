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

  // Postgres foreign_key_violation. In practice this means the JWT's user id
  // no longer exists (e.g. the database was reseeded after the token was
  // issued) — every write that references req.user.id already validates its
  // other foreign keys (book/copy/loan existence) before reaching an INSERT.
  if (err.code === '23503') {
    return res.status(401).json({
      error: { code: 'STALE_SESSION', message: 'Your session refers to an account that no longer exists. Please log out and log in again.' },
    });
  }

  // Postgres invalid_text_representation, e.g. a non-numeric id compared
  // against an integer column. Routes validate ids before querying, but this
  // is a defense-in-depth backstop so a gap fails clean instead of as a 500.
  if (err.code === '22P02') {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request data.' } });
  }

  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } });
}

module.exports = { notFoundHandler, errorHandler };
