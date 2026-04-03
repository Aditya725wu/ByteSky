const mongoose = require('mongoose');

const InstanceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  os: { type: String, required: true },
  size: { type: String, required: true },
  region: { type: String, default: 'us-east-1' },
  vpcId: { type: mongoose.Schema.Types.ObjectId, ref: 'VPC' },
  vpcName: { type: String },
  subnetId: { type: String },
  subnetName: { type: String },
  subnetCidr: { type: String },
  subnetType: { type: String, enum: ['public', 'private'] },
  availabilityZone: { type: String },
  privateIp: { type: String },
  securityGroup: { type: String, default: 'default' },
  status: { 
    type: String, 
    enum: ['provisioning', 'running', 'stopped', 'terminated'], 
    default: 'provisioning' 
  },
  ip: { type: String },
  cost: { type: Number, required: true },
  hourlyRate: { type: Number, default: 0.0068 },
  startTime: { type: Date },
  endTime: { type: Date },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  metrics: [{
    cpu: Number,
    ram: Number,
    networkIn: Number,
    networkOut: Number,
    timestamp: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }  // Auto-updates on save
});

// REMOVED problematic pre('save') middleware - not needed with default: Date.now

module.exports = mongoose.model('Instance', InstanceSchema);
