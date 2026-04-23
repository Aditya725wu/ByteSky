const jwt = require('jsonwebtoken');

const env = require('../config/env');

function signToken(user, sessionId) {
  const payload = {
    user: {
      id: user.id || user._id.toString(),
      role: user.role
    }
  };

  const options = { expiresIn: env.jwtExpiresIn };
  if (sessionId) {
    options.jwtid = sessionId;
  }

  return jwt.sign(payload, env.jwtSecret, options);
}

function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

module.exports = {
  signToken,
  verifyToken
};
