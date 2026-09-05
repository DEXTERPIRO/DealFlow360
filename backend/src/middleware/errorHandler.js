/**
 * Centralized error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('💥 Unhandled Error:', err);

  const statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

module.exports = errorHandler;
