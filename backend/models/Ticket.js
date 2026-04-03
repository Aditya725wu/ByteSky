const mongoose = require('mongoose');

const AttachmentSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  fileName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  url: { type: String, default: '' }
}, { _id: false });

const TicketMessageSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, trim: true, default: '' },
  attachments: { type: [AttachmentSchema], default: [] }
}, { timestamps: { createdAt: true, updatedAt: false } });

const TicketHistorySchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true, trim: true },
  field: { type: String, default: '', trim: true },
  oldValue: { type: String, default: '' },
  newValue: { type: String, default: '' }
}, { timestamps: { createdAt: true, updatedAt: false } });

const TicketSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true, trim: true, minlength: 3, maxlength: 180 },
  description: { type: String, required: true, trim: true, minlength: 5, maxlength: 4000 },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  status: { type: String, enum: ['open', 'in-progress', 'closed', 'resolved'], default: 'open' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  attachments: { type: [AttachmentSchema], default: [] },
  messages: { type: [TicketMessageSchema], default: [] },
  history: { type: [TicketHistorySchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('Ticket', TicketSchema);
