const mongoose = require('mongoose');

const AuthSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: String, required: true, unique: true, index: true },
    deviceLabel: { type: String, default: 'Unknown device' },
    browser: { type: String, default: 'Unknown browser' },
    os: { type: String, default: 'Unknown OS' },
    deviceType: { type: String, default: 'unknown' },
    userAgent: { type: String, default: '' },
    ipAddress: { type: String, default: '' },
    locationLabel: { type: String, default: 'Unknown location' },
    status: {
      type: String,
      enum: ['active', 'revoked', 'expired'],
      default: 'active',
      index: true
    },
    lastActiveAt: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date },
    revokedBy: { type: String, default: '' },
    revokedReason: { type: String, default: '' }
  },
  {
    timestamps: true
  }
);

AuthSessionSchema.index({ user: 1, status: 1, lastActiveAt: -1 });
AuthSessionSchema.index({ user: 1, sessionId: 1 }, { unique: true });

module.exports = mongoose.model('AuthSession', AuthSessionSchema);
