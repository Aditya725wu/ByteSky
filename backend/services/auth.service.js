const crypto = require('crypto');

const { OAuth2Client } = require('google-auth-library');

const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const { signToken } = require('./token.service');
const loginAlertService = require('./login-alert.service');

const googleClient = env.googleClientId ? new OAuth2Client(env.googleClientId) : null;
const MAX_KNOWN_LOGIN_DEVICES = 20;
const GOOGLE_VERIFY_TIMEOUT_MS = 10000;

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
    avatar: user.avatar || '',
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
    twoFAEnabled: Boolean(user.twoFAEnabled),
    loginAlerts: sanitizeLoginAlerts(user.loginAlerts)
  };
}

function sanitizeLoginAlerts(loginAlerts = {}) {
  return {
    emailOnNewDevice: loginAlerts.emailOnNewDevice !== false,
    emailOnFailedLogin: loginAlerts.emailOnFailedLogin === true
  };
}

function getClientDeviceId(req) {
  const rawDeviceId = req.get?.('x-bytesky-device-id') || '';
  const deviceId = String(rawDeviceId).trim();

  if (!deviceId || deviceId.length > 128) {
    return '';
  }

  return deviceId;
}

function getIpAddress(req) {
  const forwardedFor = req.get?.('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || '';
}

function getLoginDeviceSnapshot(req) {
  const deviceId = getClientDeviceId(req);
  const userAgent = req.get?.('user-agent') || 'Unknown';
  const fingerprintSource = deviceId ? `device:${deviceId}` : `agent:${userAgent}`;
  const fingerprint = crypto.createHash('sha256').update(fingerprintSource).digest('hex');

  return {
    fingerprint,
    deviceId,
    userAgent,
    ipAddress: getIpAddress(req)
  };
}

function rememberLoginDevice(user, req) {
  const snapshot = getLoginDeviceSnapshot(req);
  const now = new Date();
  const knownDevices = Array.isArray(user.knownLoginDevices) ? user.knownLoginDevices : [];
  const existingDevice = knownDevices.find((device) => device.fingerprint === snapshot.fingerprint);

  if (existingDevice) {
    existingDevice.userAgent = snapshot.userAgent;
    existingDevice.ipAddress = snapshot.ipAddress;
    existingDevice.lastSeenAt = now;
    user.markModified('knownLoginDevices');
    return { isNewDevice: false, snapshot };
  }

  knownDevices.push({
    ...snapshot,
    firstSeenAt: now,
    lastSeenAt: now
  });

  user.knownLoginDevices = knownDevices
    .sort((a, b) => new Date(a.lastSeenAt).getTime() - new Date(b.lastSeenAt).getTime())
    .slice(-MAX_KNOWN_LOGIN_DEVICES);
  user.markModified('knownLoginDevices');

  return { isNewDevice: true, snapshot };
}

async function verifyGoogleCredential(credential) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new ApiError(504, 'Google authentication timed out. Check server outbound internet access to Google.'));
    }, GOOGLE_VERIFY_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      googleClient.verifyIdToken({
        idToken: credential,
        audience: env.googleClientId
      }),
      timeout
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
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
  rememberLoginDevice(user, req);
  user.lastLogin = new Date();
  await user.save();

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
      user: user._id,
      action: 'LOGIN_FAILED',
      resource: 'User',
      resourceId: user._id,
      details: { email, reason: 'Invalid password' },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    await loginAlertService.notifyFailedLogin(user, req);

    throw new ApiError(400, 'Invalid Credentials');
  }

  const { isNewDevice } = rememberLoginDevice(user, req);
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

  if (isNewDevice) {
    await loginAlertService.notifyNewDeviceLogin(user, req);
  }

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
    ticket = await verifyGoogleCredential(credential);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    logger.warn('Google credential verification failed', { error: error.message });
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
    rememberLoginDevice(user, req);
    await user.save();

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
    const { isNewDevice } = rememberLoginDevice(user, req);
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

    if (isNewDevice) {
      await loginAlertService.notifyNewDeviceLogin(user, req);
    }
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

async function getLoginAlertPreferences(userId) {
  const user = await User.findById(userId).select('loginAlerts');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return {
    loginAlerts: sanitizeLoginAlerts(user.loginAlerts)
  };
}

async function updateLoginAlertPreferences(userId, payload, req) {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const currentPreferences = sanitizeLoginAlerts(user.loginAlerts);
  const nextPreferences = {
    emailOnNewDevice: typeof payload?.emailOnNewDevice === 'boolean'
      ? payload.emailOnNewDevice
      : currentPreferences.emailOnNewDevice,
    emailOnFailedLogin: typeof payload?.emailOnFailedLogin === 'boolean'
      ? payload.emailOnFailedLogin
      : currentPreferences.emailOnFailedLogin
  };

  user.loginAlerts = nextPreferences;
  await user.save();

  await writeAuditLog({
    user: user._id,
    action: 'USER_LOGIN_ALERTS_UPDATED',
    resource: 'User',
    resourceId: user._id,
    details: nextPreferences,
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });

  return {
    msg: 'Login alert preferences updated',
    loginAlerts: sanitizeLoginAlerts(user.loginAlerts),
    user: sanitizeUser(user)
  };
}

module.exports = {
  changePassword,
  getCurrentUser,
  getLoginAlertPreferences,
  googleLogin,
  login,
  register,
  updateLoginAlertPreferences,
  updateProfile
};
