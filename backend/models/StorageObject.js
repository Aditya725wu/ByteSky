const mongoose = require('mongoose');

const StorageObjectSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bucket: { type: String, required: true },
  fileName: { type: String, required: true },
  filePath: { type: String },
  fileSize: { type: Number, required: true },
  fileType: { type: String },
  isPublic: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('StorageObject', StorageObjectSchema);
