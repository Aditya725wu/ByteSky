const mongoose = require('mongoose');
const crypto = require('crypto');

const APIKeySchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    key: { type: String, required: true, unique: true },
    secret: { type: String, required: true },
    permissions: [{ type: String }], // e.g., ['instances:read', 'storage:write']
    lastUsed: { type: Date },
    expiresAt: { type: Date },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

// Generate API key pair
APIKeySchema.statics.generateKeyPair = function () {
    const key = 'bsk_' + crypto.randomBytes(16).toString('hex');
    const secret = crypto.randomBytes(32).toString('hex');
    return { key, secret };
};

module.exports = mongoose.model('APIKey', APIKeySchema);