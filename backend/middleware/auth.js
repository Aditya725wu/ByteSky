const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../services/token.service');
const authSessionService = require('../services/auth-session.service');

async function authenticate(req, _res, next) {
  const authHeader = req.header('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return next(new ApiError(401, 'No token, authorization denied'));
  }

  try {
    const decoded = verifyToken(token);
    const session = await authSessionService.resolveAuthSession({
      userId: decoded.user.id,
      rawToken: token,
      decodedToken: decoded,
      req
    });

    req.session = authSessionService.sanitizeAuthSession(session, session.sessionId);
    req.user = {
      ...decoded.user,
      sessionId: session.sessionId
    };
    req.auth = req.user;
    return next();
  } catch (error) {
    if (error instanceof ApiError) {
      return next(error);
    }

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
