const ApiError = require('./ApiError');

const POSITIVE_INT = /^\d+$/;

// Postgres throws a raw 22P02 (invalid_text_representation) if a non-numeric
// string is compared against an integer column, which the error handler maps
// to a generic 500. Routes must reject bad ids before they ever reach a query.
function parsePositiveInt(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string' && POSITIVE_INT.test(value)) return Number(value);
  return null;
}

// Middleware for routes with a numeric :id param.
function requireIdParam(paramName = 'id') {
  return (req, res, next) => {
    if (parsePositiveInt(req.params[paramName]) === null) {
      return next(new ApiError(400, 'VALIDATION_ERROR', `${paramName} must be a positive integer.`));
    }
    next();
  };
}

module.exports = { parsePositiveInt, requireIdParam };
