const logger = require('../config/logger');

module.exports = function errorHandler(error, req, res, _next) {
  const statusCode = error.statusCode || 500;

  logger.error('Request failed', {
    message: error.message,
    stack: error.stack,
    method: req.method,
    path: req.originalUrl
  });

  return res.status(statusCode).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && error.stack ? { stack: error.stack } : {})
  });
};
