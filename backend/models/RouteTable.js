const mongoose = require('mongoose');

const RouteTableSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vpc: { type: mongoose.Schema.Types.ObjectId, ref: 'VPC', required: true },
  name: { type: String, required: true },
  isMain: { type: Boolean, default: false },
  routes: [{
    destination: { type: String, required: true },
    target: { type: String, required: true },
    targetType: {
      type: String,
      enum: ['local', 'internet-gateway', 'nat-gateway', 'vpc-peering', 'custom'],
      default: 'local'
    }
  }],
  associatedSubnets: [{
    subnetId: { type: String, required: true },
    subnetName: { type: String, required: true },
    cidr: { type: String, required: true }
  }],
  status: { type: String, enum: ['active', 'pending'], default: 'active' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RouteTable', RouteTableSchema);
