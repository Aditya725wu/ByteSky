const mongoose = require('mongoose');
const speakeasy = require('speakeasy');

const TwoFASchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  secret: { type: String, required: true },
  enabled: { type: Boolean, default: false },
  backupCodes: [String],
  createdAt: { type: Date, default: Date.now }
});

TwoFASchema.methods.generateSecret = function() {
  const secret = speakeasy.generateSecret({ length: 20 });
  this.secret = secret.base32;
  return secret.otpauth_url;
};

TwoFASchema.methods.verifyToken = function(token) {
  return speakeasy.totp.verify({
    secret: this.secret,
    encoding: 'base32',
    token: token
  });
};

module.exports = mongoose.model('TwoFA', TwoFASchema);