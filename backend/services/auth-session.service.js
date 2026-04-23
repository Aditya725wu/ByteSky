const crypto = require('crypto');

const AuthSession = require('../models/AuthSession');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const { signToken } = require('./token.service');

const SESSION_TOUCH_INTERVAL_MS = 60 * 1000;
const DEFAULT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function parseDurationMs(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  const raw = String(value || '').trim().toLowerCase();
  if (!raw) {
    return DEFAULT_TOKEN_TTL_MS;
  }

  const match = raw.match(/^(\d+)\s*([smhdw])?$/);
  if (!match) {
    return DEFAULT_TOKEN_TTL_MS;
  }

  const amount = Number(match[1]);
  const unit = match[2] || 'ms';

  switch (unit) {
    case 's':
      return amount * 1000;
    case 'm':
      return amount * 60 * 1000;
    case 'h':
      return amount * 60 * 60 * 1000;
    case 'd':
      return amount * 24 * 60 * 60 * 1000;
    case 'w':
      return amount * 7 * 24 * 60 * 60 * 1000;
    default:
      return amount;
  }
}

function resolveTokenExpiryDate() {
  return new Date(Date.now() + parseDurationMs(env.jwtExpiresIn));
}

function normalizeIpAddress(ipAddress = '') {
  return String(ipAddress || '').replace(/^::ffff:/, '').trim();
}

function isPrivateIp(ipAddress = '') {
  const normalized = normalizeIpAddress(ipAddress);
  if (!normalized) {
    return false;
  }

  if (normalized === '127.0.0.1' || normalized === '::1') {
    return true;
  }

  if (/^10\./.test(normalized)) {
    return true;
  }

  if (/^192\.168\./.test(normalized)) {
    return true;
  }

  return /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized);
}

function parseUserAgent(userAgent = '') {
  const value = String(userAgent || '').toLowerCase();

  let browser = 'Unknown browser';
  if (value.includes('edg/')) {
    browser = 'Edge';
  } else if (value.includes('opr/') || value.includes('opera')) {
    browser = 'Opera';
  } else if (value.includes('chrome/') && !value.includes('edg/') && !value.includes('opr/')) {
    browser = 'Chrome';
  } else if (value.includes('firefox/')) {
    browser = 'Firefox';
  } else if (value.includes('safari/') && !value.includes('chrome/')) {
    browser = 'Safari';
  } else if (value.includes('msie') || value.includes('trident/')) {
    browser = 'Internet Explorer';
  }

  let os = 'Unknown OS';
  let deviceType = 'desktop';

  if (value.includes('android')) {
    os = 'Android';
    deviceType = 'mobile';
  } else if (value.includes('iphone')) {
    os = 'iPhone';
    deviceType = 'mobile';
  } else if (value.includes('ipad')) {
    os = 'iPad';
    deviceType = 'tablet';
  } else if (value.includes('windows nt')) {
    os = 'Windows';
  } else if (value.includes('mac os x')) {
    os = 'macOS';
  } else if (value.includes('linux')) {
    os = 'Linux';
  }

  if (value.includes('mobile') && deviceType === 'desktop') {
    deviceType = 'mobile';
  }

  return {
    browser,
    deviceType,
    os
  };
}

function getClientIp(req) {
  const forwardedFor = req.get?.('x-forwarded-for');
  if (forwardedFor) {
    return normalizeIpAddress(forwardedFor.split(',')[0].trim());
  }

  return normalizeIpAddress(req.ip || req.socket?.remoteAddress || '');
}

function getDeviceMetadata(req) {
  const userAgent = req.get?.('user-agent') || 'Unknown browser';
  const { browser, deviceType, os } = parseUserAgent(userAgent);
  const ipAddress = getClientIp(req);
  const locationLabel = ipAddress
    ? (isPrivateIp(ipAddress) ? 'Private network' : `IP ${ipAddress}`)
    : 'Unknown location';

  return {
    browser,
    deviceLabel: `${browser} on ${os}`,
    deviceType,
    expiresAt: resolveTokenExpiryDate(),
    ipAddress,
    locationLabel,
    os,
    userAgent
  };
}

function buildSessionInsertData(userId, sessionId, req, expiresAt = null) {
  const metadata = getDeviceMetadata(req);

  return {
    user: userId,
    sessionId,
    deviceLabel: metadata.deviceLabel,
    browser: metadata.browser,
    os: metadata.os,
    deviceType: metadata.deviceType,
    userAgent: metadata.userAgent,
    ipAddress: metadata.ipAddress,
    locationLabel: metadata.locationLabel,
    status: 'active',
    lastActiveAt: new Date(),
    expiresAt: expiresAt || metadata.expiresAt
  };
}

function getSessionIdFromToken(rawToken, decodedToken = {}) {
  if (decodedToken?.jti) {
    return String(decodedToken.jti);
  }

  return crypto.createHash('sha256').update(String(rawToken || '')).digest('hex');
}

function sanitizeAuthSession(session, currentSessionId = null) {
  if (!session) {
    return null;
  }

  return {
    sessionId: session.sessionId,
    deviceLabel: session.deviceLabel || 'Unknown device',
    browser: session.browser || 'Unknown browser',
    os: session.os || 'Unknown OS',
    deviceType: session.deviceType || 'unknown',
    ipAddress: session.ipAddress || '',
    locationLabel: session.locationLabel || 'Unknown location',
    status: session.status || 'active',
    createdAt: session.createdAt,
    lastActiveAt: session.lastActiveAt,
    expiresAt: session.expiresAt,
    revokedAt: session.revokedAt || null,
    revokedBy: session.revokedBy || '',
    revokedReason: session.revokedReason || '',
    isCurrent: Boolean(currentSessionId && session.sessionId === currentSessionId)
  };
}

async function createAuthSession(userId, req, options = {}) {
  const sessionId = options.sessionId || crypto.randomUUID();
  return AuthSession.create(buildSessionInsertData(userId, sessionId, req, options.expiresAt));
}

async function ensureAuthSession(userId, req, options = {}) {
  const sessionId = options.sessionId || crypto.randomUUID();
  const insertData = buildSessionInsertData(userId, sessionId, req, options.expiresAt);

  try {
    return await AuthSession.findOneAndUpdate(
      { user: userId, sessionId },
      { $setOnInsert: insertData },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );
  } catch (error) {
    if (error?.code === 11000) {
      return AuthSession.findOne({ user: userId, sessionId });
    }

    throw error;
  }
}

async function issueAuthSession(user, req) {
  const session = await createAuthSession(user._id || user.id, req);
  const token = signToken(user, session.sessionId);
  return { session, token };
}

async function touchAuthSession(session, req) {
  if (!session) {
    return session;
  }

  const metadata = getDeviceMetadata(req);
  const now = new Date();
  const lastActiveAt = session.lastActiveAt ? new Date(session.lastActiveAt) : null;
  const shouldTouch =
    !lastActiveAt
    || (now.getTime() - lastActiveAt.getTime()) >= SESSION_TOUCH_INTERVAL_MS
    || session.userAgent !== metadata.userAgent
    || session.ipAddress !== metadata.ipAddress
    || session.locationLabel !== metadata.locationLabel
    || session.deviceLabel !== metadata.deviceLabel
    || session.browser !== metadata.browser
    || session.os !== metadata.os
    || session.deviceType !== metadata.deviceType;

  if (!shouldTouch) {
    return session;
  }

  session.lastActiveAt = now;
  session.userAgent = metadata.userAgent;
  session.ipAddress = metadata.ipAddress;
  session.locationLabel = metadata.locationLabel;
  session.deviceLabel = metadata.deviceLabel;
  session.browser = metadata.browser;
  session.os = metadata.os;
  session.deviceType = metadata.deviceType;
  if (session.status === 'expired' && session.expiresAt && new Date(session.expiresAt).getTime() > now.getTime()) {
    session.status = 'active';
  }

  await session.save();
  return session;
}

async function resolveAuthSession({ userId, rawToken, decodedToken, req }) {
  const sessionId = getSessionIdFromToken(rawToken, decodedToken);
  const isLegacyToken = !decodedToken?.jti;
  let session = await AuthSession.findOne({ user: userId, sessionId });

  if (!session && isLegacyToken) {
    session = await ensureAuthSession(userId, req, { sessionId });
  }

  if (!session) {
    throw new ApiError(401, 'Session is no longer active');
  }

  if (session.status === 'revoked' || session.revokedAt) {
    throw new ApiError(401, 'Session has been revoked');
  }

  if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
    session.status = 'expired';
    session.revokedAt = session.revokedAt || new Date();
    session.revokedBy = session.revokedBy || 'system';
    session.revokedReason = session.revokedReason || 'expired';
    await session.save();
    throw new ApiError(401, 'Session has expired');
  }

  await touchAuthSession(session, req);
  return session;
}

async function listAuthSessions(userId, currentSessionId = null) {
  const now = new Date();
  const sessions = await AuthSession.find({
    user: userId,
    status: 'active',
    expiresAt: { $gt: now }
  }).sort({ lastActiveAt: -1, createdAt: -1 });

  const sanitizedSessions = sessions.map((session) => sanitizeAuthSession(session, currentSessionId));
  sanitizedSessions.sort((a, b) => {
    if (a.isCurrent && !b.isCurrent) return -1;
    if (!a.isCurrent && b.isCurrent) return 1;

    const aTime = new Date(a.lastActiveAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.lastActiveAt || b.createdAt || 0).getTime();
    return bTime - aTime;
  });

  return sanitizedSessions;
}

async function revokeAuthSession(userId, sessionId, reason = 'manual_revoke', revokedBy = 'self') {
  if (!sessionId) {
    throw new ApiError(400, 'Session ID is required');
  }

  const session = await AuthSession.findOne({ user: userId, sessionId });
  if (!session) {
    return null;
  }

  if (session.status !== 'revoked') {
    session.status = 'revoked';
    session.revokedAt = new Date();
    session.revokedBy = revokedBy;
    session.revokedReason = reason;
    await session.save();
  }

  return session;
}

async function revokeCurrentAuthSession(userId, sessionId, reason = 'logout') {
  return revokeAuthSession(userId, sessionId, reason, 'self');
}

async function revokeOtherAuthSessions(userId, currentSessionId, reason = 'password_change') {
  const filter = {
    user: userId,
    status: 'active'
  };

  if (currentSessionId) {
    filter.sessionId = { $ne: currentSessionId };
  }

  const result = await AuthSession.updateMany(filter, {
    $set: {
      status: 'revoked',
      revokedAt: new Date(),
      revokedBy: 'system',
      revokedReason: reason
    }
  });

  return result.modifiedCount || result.nModified || 0;
}

module.exports = {
  createAuthSession,
  issueAuthSession,
  listAuthSessions,
  resolveAuthSession,
  revokeAuthSession,
  revokeCurrentAuthSession,
  revokeOtherAuthSessions,
  sanitizeAuthSession,
  touchAuthSession
};
