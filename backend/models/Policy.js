const mongoose = require('mongoose');

const PolicySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String },
    statements: [{
        effect: { type: String, enum: ['Allow', 'Deny'], default: 'Allow' },
        actions: [String], // e.g., ['instances:create', 'instances:read']
        resources: [String], // e.g., ['instances:*', 'storage:bucket-name/*']
        conditions: { type: Object, default: {} }
    }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

PolicySchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Policy', PolicySchema);