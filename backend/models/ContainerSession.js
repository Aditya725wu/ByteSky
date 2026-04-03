const mongoose = require('mongoose');

const ContainerSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    containerId: { type: String, required: true, unique: true, index: true },
    containerName: { type: String, required: true, unique: true },
    image: { type: String, required: true },
    hostPort: { type: Number, required: true, index: true },
    containerPort: { type: Number, required: true, default: 80 },
    url: { type: String, required: true },
    status: {
      type: String,
      enum: ['running', 'stopped', 'expired', 'error'],
      default: 'running',
      index: true
    },
    expiresAt: { type: Date, required: true, index: true },
    stoppedAt: { type: Date },
    lastError: { type: String, default: '' }
  },
  {
    timestamps: true
  }
);

ContainerSessionSchema.index({ user: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('ContainerSession', ContainerSessionSchema);
