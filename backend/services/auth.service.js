const crypto = require('crypto');

const { OAuth2Client } = require('google-auth-library');

const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const { signToken } = require('./token.service');

const googleClient = env.googleClientId ? new OAuth2Client(env.googleClientId) : null;

async function writeAuditLog(entry) {
  try {
    await AuditLog.create(entry);
  } catch (error) {
    logger.warn('Audit log write failed', { error: error.message, action: entry.action });
  }
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    authProvider: user.authProvider || 'local',
    avatar: user.avatar || ''
  };
}

async function register(payload, req) {
  const name = payload?.name?.trim();
  const email = payload?.email?.trim().toLowerCase();
  const password = payload?.password;

  if (!name || !email || !password) {
    throw new ApiError(400, 'Please fill all fields');
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(400, 'User already exists');
  }

  const user = await User.create({ name, email, password, role: 'user' });

  await writeAuditLog({
    user: user._id,
    action: 'USER_REGISTERED',
    resource: 'User',
    resourceId: user._id,
    details: { email, name },
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });

  return {
    token: signToken(user),
    user: sanitizeUser(user)
  };
}

async function login(payload, req) {
  const email = payload?.email?.trim().toLowerCase();
  const password = payload?.password;

  if (!email || !password) {
    throw new ApiError(400, 'Please fill all fields');
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(400, 'Invalid Credentials');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    await writeAuditLog({
      action: 'LOGIN_FAILED',
      details: { email, reason: 'Invalid password' },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    throw new ApiError(400, 'Invalid Credentials');
  }

  user.lastLogin = new Date();
  await user.save();

  await writeAuditLog({
    user: user._id,
    action: 'USER_LOGIN',
    resource: 'User',
    resourceId: user._id,
    details: { email, role: user.role },
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });

  return {
    token: signToken(user),
    user: sanitizeUser(user)
  };
}

async function googleLogin(payload, req) {
  if (!googleClient || !env.googleClientId) {
    throw new ApiError(503, 'Google authentication is not configured on the server');
  }

  const credential = payload?.credential;
  if (!credential) {
    throw new ApiError(400, 'Google credential is required');
  }

  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: env.googleClientId
    });
  } catch (_error) {
    throw new ApiError(401, 'Invalid Google credential');
  }

  const profile = ticket.getPayload();
  if (!profile?.email || !profile?.sub) {
    throw new ApiError(400, 'Google profile is missing required fields');
  }

  const email = profile.email.toLowerCase();
  let user = await User.findOne({ email });

  if (!user) {
    user = await User.create({
      name: profile.name || email.split('@')[0],
      email,
      password: crypto.randomBytes(24).toString('hex'),
      role: 'user',
      authProvider: 'google',
      googleId: profile.sub,
      avatar: profile.picture || '',
      lastLogin: new Date()
    });

    await writeAuditLog({
      user: user._id,
      action: 'USER_REGISTERED_GOOGLE',
      resource: 'User',
      resourceId: user._id,
      details: { email, provider: 'google' },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
  } else {
    user.lastLogin = new Date();

    if (!user.googleId) {
      user.googleId = profile.sub;
    }

    user.authProvider = 'google';

    if (profile.picture) {
      user.avatar = profile.picture;
    }

    if (profile.name) {
      user.name = profile.name;
    }

    await user.save();
  }

  await writeAuditLog({
    user: user._id,
    action: 'USER_LOGIN_GOOGLE',
    resource: 'User',
    resourceId: user._id,
    details: { email, provider: 'google' },
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });

  return {
    token: signToken(user),
    user: sanitizeUser(user)
  };
}

async function updateProfile(userId, payload, req) {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const name = payload?.name?.trim();
  const email = payload?.email?.trim().toLowerCase();

  if (name) {
    user.name = name;
  }

  if (email && email !== user.email.toLowerCase()) {
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      throw new ApiError(400, 'Email already in use');
    }

    user.email = email;
  }

  await user.save();

  await writeAuditLog({
    user: user._id,
    action: 'USER_UPDATED',
    resource: 'User',
    resourceId: user._id,
    details: { name: user.name, email: user.email },
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });

  return {
    msg: 'Profile updated',
    user: sanitizeUser(user)
  };
}

async function changePassword(userId, payload, req) {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const currentPassword = payload?.currentPassword;
  const newPassword = payload?.newPassword;

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'Current password and new password are required');
  }

  if (newPassword.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters');
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  if (currentPassword === newPassword) {
    throw new ApiError(400, 'Choose a different password');
  }

  user.password = newPassword;
  await user.save();

  await writeAuditLog({
    user: user._id,
    action: 'USER_PASSWORD_CHANGED',
    resource: 'User',
    resourceId: user._id,
    details: { email: user.email },
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });

  return {
    msg: 'Password changed successfully'
  };
}

async function getCurrentUser(userId) {
  const user = await User.findById(userId).select('-password');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return {
    user: sanitizeUser(user)
  };
}

module.exports = {
  changePassword,
  getCurrentUser,
  googleLogin,
  login,
  register,
  updateProfile
};
