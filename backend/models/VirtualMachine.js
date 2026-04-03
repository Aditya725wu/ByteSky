const mongoose = require('mongoose');

const VirtualMachineSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    containerId: { type: String, required: true, unique: true, index: true },
    containerName: { type: String, required: true, unique: true },
    image: { type: String, required: true },
    port: { type: Number, required: true, index: true },
    internalPort: { type: Number, required: true, default: 3000 },
    url: { type: String, default: '' },
    status: {
      type: String,
      enum: ['creating', 'running', 'stopped', 'expired', 'error'],
      default: 'creating',
      index: true
    },
    createdAt: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date, required: true, index: true },
    stoppedAt: { type: Date },
    lastError: { type: String, default: '' }
  },
  {
    versionKey: false,
    timestamps: {
      createdAt: false,
      updatedAt: true
    }
  }
);

VirtualMachineSchema.index({ userId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('VirtualMachine', VirtualMachineSchema);
