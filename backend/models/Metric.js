const mongoose = require('mongoose');

const MetricSchema = new mongoose.Schema({
  instance: { type: mongoose.Schema.Types.ObjectId, ref: 'Instance', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  cpu: { type: Number, required: true },
  ram: { type: Number, required: true },
  networkIn: { type: Number, default: 0 },
  networkOut: { type: Number, default: 0 },
  diskRead: { type: Number, default: 0 },
  diskWrite: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now }
});

// TTL index - auto delete metrics older than 30 days
MetricSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });
MetricSchema.index({ instance: 1, timestamp: -1 });

module.exports = mongoose.model('Metric', MetricSchema);