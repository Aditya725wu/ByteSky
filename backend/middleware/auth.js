const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../services/token.service');

function authenticate(req, _res, next) {
  const authHeader = req.header('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return next(new ApiError(401, 'No token, authorization denied'));
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded.user;
    req.auth = decoded.user;
    return next();
  } catch (_error) {
    return next(new ApiError(401, 'Token is not valid'));
  }
}

authenticate.authorize = (...roles) => (req, _res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }

  if (roles.length && !roles.includes(req.user.role)) {
    return next(new ApiError(403, 'Forbidden'));
  }

  return next();
};

module.exports = authenticate;
