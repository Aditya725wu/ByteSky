const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  invoiceNumber: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['Paid', 'Unpaid', 'Overdue'], default: 'Unpaid' },
  dueDate: { type: Date },
  items: [{
    description: String,
    quantity: Number,
    unitPrice: Number,
    total: Number,
    resourceType: String
  }],
  region: { type: String, default: 'us-east-1' },
  usageHours: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  paidAt: { type: Date }
});

module.exports = mongoose.model('Invoice', InvoiceSchema);
