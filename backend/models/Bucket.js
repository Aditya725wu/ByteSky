const mongoose = require('mongoose');

const BucketSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  region: { type: String, required: true, trim: true },
  storageClass: { type: String, default: 'standard' },
  versioning: { type: Boolean, default: false },
  isPublic: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

BucketSchema.index({ user: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Bucket', BucketSchema);
