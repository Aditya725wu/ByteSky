const mongoose = require('mongoose');

const RegionSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  currency: { type: String, default: 'usd', trim: true },
  status: { type: String, enum: ['available', 'limited', 'unavailable'], default: 'available' },
  pricing: {
    compute: { type: Number, default: 1.0 },
    storage: { type: Number, default: 1.0 },
    network: { type: Number, default: 1.0 }
  },
  capacity: { type: Number, default: 100 },
  availableCapacity: { type: Number, default: 100 }
});

module.exports = mongoose.model('Region', RegionSchema);
