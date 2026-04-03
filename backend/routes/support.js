const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const Ticket = require('../models/Ticket');
const Notification = require('../models/Notification');
const User = require('../models/User');
const auth = require('../middleware/auth');

const uploadsDir = path.join(__dirname, '..', 'uploads', 'tickets');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 5 }
});

const ALLOWED_STATUS = new Set(['open', 'in-progress', 'closed', 'resolved']);
const ALLOWED_PRIORITY = new Set(['low', 'medium', 'high']);

async function getCurrentUser(req) {
  return User.findById(req.user.id).select('_id name email role');
}

function isAdmin(user) {
  return user && user.role === 'admin';
}

function normalizeAttachments(files = []) {
  return files.map((file) => ({
    originalName: file.originalname,
    fileName: file.filename,
    mimeType: file.mimetype || 'application/octet-stream',
    size: file.size || 0,
    url: `/uploads/tickets/${file.filename}`
  }));
}

function canAccessTicket(user, ticket) {
  return isAdmin(user) || ticket.user.toString() === user._id.toString();
}

function removeTicketFiles(ticket) {
  const allAttachments = [
    ...(ticket.attachments || []),
    ...(ticket.messages || []).flatMap((m) => m.attachments || [])
  ];

  allAttachments.forEach((attachment) => {
    if (!attachment.fileName) return;
    const filePath = path.join(uploadsDir, attachment.fileName);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (_err) { /* no-op */ }
    }
  });
}

function ticketQueryFor(user) {
  return isAdmin(user) ? {} : { user: user._id };
}

function parsePagination(req) {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 50);
  return { page, limit, skip: (page - 1) * limit };
}

function buildSearchQuery(baseQuery, reqQuery) {
  const query = { ...baseQuery };
  const { status, priority, assignedTo, search } = reqQuery;

  if (status && ALLOWED_STATUS.has(status)) query.status = status;
  if (priority && ALLOWED_PRIORITY.has(priority)) query.priority = priority;
  if (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)) query.assignedTo = assignedTo;

  if (search) {
    const regex = new RegExp(search.trim(), 'i');
    query.$or = [{ subject: regex }];
    if (mongoose.Types.ObjectId.isValid(search.trim())) {
      query.$or.push({ _id: new mongoose.Types.ObjectId(search.trim()) });
    }
  }

  return query;
}

async function notifyAdmins(message, currentUserId) {
  const admins = await User.find({ role: 'admin' }).select('_id');
  const notifications = admins
    .filter((admin) => admin._id.toString() !== currentUserId.toString())
    .map((admin) => ({
      user: admin._id,
      title: 'Support Update',
      message,
      type: 'warning'
    }));

  if (notifications.length) {
    await Notification.insertMany(notifications);
  }
}

router.get('/summary', auth, async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) return res.status(401).json({ msg: 'Unauthorized' });

    const baseQuery = ticketQueryFor(currentUser);
    const [total, open, inProgress, closed] = await Promise.all([
      Ticket.countDocuments(baseQuery),
      Ticket.countDocuments({ ...baseQuery, status: 'open' }),
      Ticket.countDocuments({ ...baseQuery, status: 'in-progress' }),
      Ticket.countDocuments({ ...baseQuery, status: { $in: ['closed', 'resolved'] } })
    ]);

    return res.json({ total, open, inProgress, closed });
  } catch (err) {
    return res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) return res.status(401).json({ msg: 'Unauthorized' });

    const { page, limit, skip } = parsePagination(req);
    const query = buildSearchQuery(ticketQueryFor(currentUser), req.query);

    const [items, total] = await Promise.all([
      Ticket.find(query)
        .populate('user', 'name email')
        .populate('assignedTo', 'name email')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      Ticket.countDocuments(query)
    ]);

    return res.json({
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1)
      }
    });
  } catch (err) {
    return res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) return res.status(401).json({ msg: 'Unauthorized' });

    const ticket = await Ticket.findById(req.params.id)
      .populate('user', 'name email')
      .populate('assignedTo', 'name email')
      .populate('messages.from', 'name email role')
      .populate('history.actor', 'name email role');

    if (!ticket) return res.status(404).json({ msg: 'Ticket not found' });
    if (!canAccessTicket(currentUser, ticket)) return res.status(403).json({ msg: 'Not authorized' });

    return res.json(ticket);
  } catch (err) {
    return res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

router.post('/', auth, upload.array('attachments', 5), async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) return res.status(401).json({ msg: 'Unauthorized' });

    const subject = (req.body.subject || '').trim();
    const description = (req.body.description || '').trim();
    const priority = (req.body.priority || 'medium').trim();

    if (!subject || !description) {
      return res.status(400).json({ msg: 'Subject and description are required' });
    }
    if (!ALLOWED_PRIORITY.has(priority)) {
      return res.status(400).json({ msg: 'Invalid priority value' });
    }

    const attachments = normalizeAttachments(req.files || []);

    const ticket = await Ticket.create({
      user: currentUser._id,
      subject,
      description,
      priority,
      attachments,
      messages: [{ from: currentUser._id, text: description, attachments }],
      history: [{
        actor: currentUser._id,
        action: 'Ticket created',
        field: 'status',
        oldValue: '',
        newValue: 'open'
      }]
    });

    await notifyAdmins(`New ticket #${ticket._id.toString().slice(-6)}: ${ticket.subject}`, currentUser._id);
    return res.status(201).json(ticket);
  } catch (err) {
    return res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) return res.status(401).json({ msg: 'Unauthorized' });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ msg: 'Ticket not found' });
    if (!canAccessTicket(currentUser, ticket)) return res.status(403).json({ msg: 'Not authorized' });

    const updates = {};
    if (typeof req.body.subject === 'string' && req.body.subject.trim()) updates.subject = req.body.subject.trim();
    if (typeof req.body.description === 'string' && req.body.description.trim()) updates.description = req.body.description.trim();
    if (typeof req.body.priority === 'string') {
      if (!ALLOWED_PRIORITY.has(req.body.priority)) {
        return res.status(400).json({ msg: 'Invalid priority value' });
      }
      updates.priority = req.body.priority;
    }
    if (typeof req.body.status === 'string') {
      if (!ALLOWED_STATUS.has(req.body.status)) {
        return res.status(400).json({ msg: 'Invalid status value' });
      }
      updates.status = req.body.status;
    }
    if (req.body.assignedTo !== undefined) {
      if (!isAdmin(currentUser)) return res.status(403).json({ msg: 'Only admins can assign tickets' });
      if (req.body.assignedTo === null || req.body.assignedTo === '') {
        updates.assignedTo = null;
      } else if (mongoose.Types.ObjectId.isValid(req.body.assignedTo)) {
        updates.assignedTo = req.body.assignedTo;
      } else {
        return res.status(400).json({ msg: 'Invalid assignee id' });
      }
    }

    const historyEntries = [];
    ['subject', 'description', 'priority', 'status'].forEach((field) => {
      if (updates[field] !== undefined && String(ticket[field]) !== String(updates[field])) {
        historyEntries.push({
          actor: currentUser._id,
          action: `Updated ${field}`,
          field,
          oldValue: String(ticket[field] ?? ''),
          newValue: String(updates[field] ?? '')
        });
      }
    });
    if (updates.assignedTo !== undefined && String(ticket.assignedTo || '') !== String(updates.assignedTo || '')) {
      historyEntries.push({
        actor: currentUser._id,
        action: 'Updated assignment',
        field: 'assignedTo',
        oldValue: String(ticket.assignedTo || ''),
        newValue: String(updates.assignedTo || '')
      });
    }

    Object.assign(ticket, updates);
    if (historyEntries.length) ticket.history.push(...historyEntries);
    await ticket.save();

    return res.json(ticket);
  } catch (err) {
    return res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

router.post('/:id/replies', auth, upload.array('attachments', 5), async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) return res.status(401).json({ msg: 'Unauthorized' });

    const text = (req.body.message || req.body.text || '').trim();
    if (!text) return res.status(400).json({ msg: 'Reply message is required' });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ msg: 'Ticket not found' });
    if (!canAccessTicket(currentUser, ticket)) return res.status(403).json({ msg: 'Not authorized' });

    const attachments = normalizeAttachments(req.files || []);
    ticket.messages.push({ from: currentUser._id, text, attachments });
    if (ticket.status === 'open') {
      ticket.status = 'in-progress';
      ticket.history.push({
        actor: currentUser._id,
        action: 'Status changed',
        field: 'status',
        oldValue: 'open',
        newValue: 'in-progress'
      });
    }
    ticket.history.push({
      actor: currentUser._id,
      action: 'Reply added',
      field: 'messages',
      oldValue: '',
      newValue: text
    });
    await ticket.save();

    await Notification.create({
      user: ticket.user,
      title: 'Ticket Updated',
      message: `New reply on ticket #${ticket._id.toString().slice(-6)}`,
      type: 'info'
    });

    return res.json(ticket);
  } catch (err) {
    return res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) return res.status(401).json({ msg: 'Unauthorized' });
    if (!isAdmin(currentUser)) return res.status(403).json({ msg: 'Admin access required' });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ msg: 'Ticket not found' });

    removeTicketFiles(ticket);
    await Ticket.findByIdAndDelete(req.params.id);
    return res.json({ msg: 'Ticket deleted' });
  } catch (err) {
    return res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Backward-compatible endpoints
router.post('/:id/reply', auth, upload.array('attachments', 5), async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) return res.status(401).json({ msg: 'Unauthorized' });

    const text = (req.body.message || '').trim();
    if (!text) return res.status(400).json({ msg: 'Reply message is required' });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ msg: 'Ticket not found' });
    if (!canAccessTicket(currentUser, ticket)) return res.status(403).json({ msg: 'Not authorized' });

    const attachments = normalizeAttachments(req.files || []);
    ticket.messages.push({ from: currentUser._id, text, attachments });
    if (ticket.status === 'open') {
      ticket.status = 'in-progress';
    }
    ticket.history.push({
      actor: currentUser._id,
      action: 'Reply added',
      field: 'messages',
      oldValue: '',
      newValue: text
    });
    await ticket.save();
    return res.json(ticket);
  } catch (err) {
    return res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

router.patch('/:id/status', auth, async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) return res.status(401).json({ msg: 'Unauthorized' });

    const status = (req.body.status || '').trim();
    if (!ALLOWED_STATUS.has(status)) return res.status(400).json({ msg: 'Invalid status value' });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ msg: 'Ticket not found' });
    if (!canAccessTicket(currentUser, ticket)) return res.status(403).json({ msg: 'Not authorized' });

    ticket.history.push({
      actor: currentUser._id,
      action: 'Status changed',
      field: 'status',
      oldValue: ticket.status,
      newValue: status
    });
    ticket.status = status;
    await ticket.save();
    return res.json(ticket);
  } catch (err) {
    return res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

module.exports = router;
