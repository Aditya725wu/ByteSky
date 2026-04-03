const mongoose = require('mongoose');

const VPCSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  cidr: { type: String, default: '10.0.0.0/16' },
  region: { type: String, required: true },
  subnets: [{
    name: String,
    cidr: String,
    availabilityZone: String,
    type: { type: String, enum: ['public', 'private'], default: 'public' }
  }],
  status: { type: String, enum: ['available', 'pending'], default: 'available' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('VPC', VPCSchema);