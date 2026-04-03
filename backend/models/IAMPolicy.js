const mongoose = require('mongoose');

const IAMPolicySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  policyName: { type: String, required: true },
  permissions: [{
    resource: String,
    actions: [String] // e.g., ['create', 'read', 'update', 'delete']
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('IAMPolicy', IAMPolicySchema);