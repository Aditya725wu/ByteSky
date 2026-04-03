const mongoose = require('mongoose');

const LoadBalancerSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['application', 'network'], default: 'application' },
  region: { type: String, required: true },
  vpc: { type: mongoose.Schema.Types.ObjectId, ref: 'VPC' },
  targets: [{
    instance: { type: mongoose.Schema.Types.ObjectId, ref: 'Instance' },
    port: Number,
    healthStatus: { type: String, enum: ['healthy', 'unhealthy', 'unknown'], default: 'unknown' }
  }],
  listener: {
    protocol: { type: String, default: 'HTTP' },
    port: { type: Number, default: 80 }
  },
  dnsName: { type: String },
  status: { type: String, enum: ['active', 'provisioning', 'failed'], default: 'provisioning' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LoadBalancer', LoadBalancerSchema);