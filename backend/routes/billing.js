const express = require('express');
const Stripe = require('stripe');

const Invoice = require('../models/Invoice');
const User = require('../models/User');
const Instance = require('../models/Instance');
const AuditLog = require('../models/AuditLog');
const auth = require('../middleware/auth');
const pdfGenerator = require('../utils/pdfGenerator');
const env = require('../config/env');
const { resolveCurrencyCode } = require('../utils/currency');

const router = express.Router();

function getStripeClient() {
  if (!env.stripeSecretKey) {
    return null;
  }

  return new Stripe(env.stripeSecretKey);
}

function canAccessInvoice(invoice, userId) {
  return invoice.user.toString() === userId;
}

function getInvoiceCurrency(invoice) {
  return resolveCurrencyCode(invoice?.currency || invoice?.region || 'us-east-1');
}

function getCheckoutCurrency(invoices = []) {
  const currencies = [...new Set(invoices.map(getInvoiceCurrency))];
  return currencies.length === 1 ? currencies[0] : env.stripeCurrency;
}

async function markInvoicesPaid(invoices, userId, metadata = {}) {
  const paidAt = new Date();

  for (const invoice of invoices) {
    invoice.status = 'Paid';
    invoice.paidAt = paidAt;
    await invoice.save();

    await AuditLog.create({
      user: userId,
      action: 'INVOICE_PAID',
      resource: 'Invoice',
      resourceId: invoice._id.toString(),
      details: {
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        paidAt,
        ...metadata
      }
    });
  }
}

router.get('/config', auth, async (_req, res) => {
  res.json({
    enabled: Boolean(env.stripePublishableKey && env.stripeSecretKey),
    publishableKey: env.stripePublishableKey,
    currency: env.stripeCurrency
  });
});

router.get('/', auth, async (req, res) => {
  try {
    const invoices = await Invoice.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

router.get('/:id/pdf', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ msg: 'Invoice not found' });
    if (!canAccessInvoice(invoice, req.user.id)) return res.status(401).json({ msg: 'Not authorized' });

    const user = await User.findById(req.user.id);
    const filePath = await pdfGenerator.generateInvoicePDF(invoice, user);
    res.download(filePath, `invoice-${invoice.invoiceNumber}.pdf`);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/checkout-session', auth, async (req, res) => {
  try {
    const stripe = getStripeClient();
    if (!stripe || !env.stripePublishableKey) {
      return res.status(503).json({ msg: 'Stripe is not configured on the server' });
    }

    const invoiceIds = Array.isArray(req.body?.invoiceIds)
      ? req.body.invoiceIds.filter(Boolean)
      : [];

    const query = invoiceIds.length
      ? { user: req.user.id, _id: { $in: invoiceIds }, status: 'Unpaid' }
      : { user: req.user.id, status: 'Unpaid' };

    const invoices = await Invoice.find(query).sort({ createdAt: -1 });
    if (!invoices.length) {
      return res.status(400).json({ msg: 'No unpaid invoices found' });
    }

    const successUrl = `${env.appBaseUrl}/?page=billing&payment=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${env.appBaseUrl}/?page=billing&payment=cancelled`;

    const user = await User.findById(req.user.id).select('email');

    const checkoutCurrency = getCheckoutCurrency(invoices);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: user?.email || undefined,
      client_reference_id: req.user.id,
      payment_method_types: ['card'],
      line_items: invoices.map((invoice) => ({
        quantity: 1,
        price_data: {
          currency: checkoutCurrency,
          product_data: {
            name: invoice.description,
            description: `Invoice ${invoice.invoiceNumber}`
          },
          unit_amount: Math.round(invoice.amount * 100)
        }
      })),
      metadata: {
        userId: req.user.id,
        invoiceIds: invoices.map((invoice) => invoice._id.toString()).join(',')
      }
    });

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url
    });
  } catch (err) {
    res.status(500).json({ msg: 'Unable to create Stripe checkout session', error: err.message });
  }
});

router.post('/checkout-confirm', auth, async (req, res) => {
  try {
    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(503).json({ msg: 'Stripe is not configured on the server' });
    }

    const sessionId = req.body?.sessionId;
    if (!sessionId) {
      return res.status(400).json({ msg: 'sessionId is required' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session || session.payment_status !== 'paid') {
      return res.status(400).json({ msg: 'Payment has not been completed' });
    }

    if (session.metadata?.userId !== req.user.id) {
      return res.status(403).json({ msg: 'Payment session does not belong to this user' });
    }

    const invoiceIds = String(session.metadata?.invoiceIds || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    const invoices = await Invoice.find({
      user: req.user.id,
      _id: { $in: invoiceIds },
      status: 'Unpaid'
    });

    await markInvoicesPaid(invoices, req.user.id, {
      paymentProvider: 'stripe',
      stripeSessionId: session.id,
      paymentIntentId: session.payment_intent
    });

    res.json({
      success: true,
      msg: 'Payment confirmed successfully',
      paidInvoices: invoices.length
    });
  } catch (err) {
    res.status(500).json({ msg: 'Unable to confirm Stripe payment', error: err.message });
  }
});

router.post('/:id/pay', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ msg: 'Invoice not found' });
    if (!canAccessInvoice(invoice, req.user.id)) return res.status(401).json({ msg: 'Not authorized' });

    await markInvoicesPaid([invoice], req.user.id, { paymentProvider: 'manual' });
    res.json({ msg: 'Payment successful', invoice });
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

router.get('/usage/summary', auth, async (req, res) => {
  try {
    const instances = await Instance.find({ owner: req.user.id });

    let totalHours = 0;
    let totalCost = 0;

    instances.forEach((inst) => {
      const endTime = inst.endTime || new Date();
      const startTime = inst.startTime || inst.createdAt;
      const hours = (endTime - startTime) / (1000 * 60 * 60);
      totalHours += hours;
      totalCost += hours * inst.hourlyRate;
    });

    res.json({
      totalInstances: instances.length,
      totalHours: totalHours.toFixed(2),
      totalCost: totalCost.toFixed(2),
      currency: resolveCurrencyCode(instances[0]?.region || 'us-east-1'),
      instances: instances.map((i) => ({
        name: i.name,
        hours: ((i.endTime || new Date()) - (i.startTime || i.createdAt)) / (1000 * 60 * 60)
      }))
    });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
