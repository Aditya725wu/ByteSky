const express = require('express');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const router = express.Router();

const User = require('../models/User');
const Instance = require('../models/Instance');
const Invoice = require('../models/Invoice');
const Ticket = require('../models/Ticket');
const AuditLog = require('../models/AuditLog');
const Metric = require('../models/Metric');
const auth = require('../middleware/auth');

const ALLOWED_TICKET_STATUS = new Set(['open', 'in-progress', 'closed', 'resolved']);
const ALLOWED_TICKET_PRIORITY = new Set(['low', 'medium', 'high']);
const ALLOWED_USER_ROLES = new Set(['user', 'admin', 'developer', 'viewer']);
const uploadsDir = path.join(__dirname, '..', 'uploads', 'tickets');

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

const adminOnly = async (req, res, next) => {
  const currentUser = await User.findById(req.user.id).select('role');
  if (!currentUser || currentUser.role !== 'admin') {
    return res.status(403).json({ msg: 'Admin access required' });
  }
  return next();
};

router.get('/analytics', auth, adminOnly, async (_req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ role: 'user' });
    const totalInstances = await Instance.countDocuments();
    const runningInstances = await Instance.countDocuments({ status: 'running' });

    const totalRevenue = await Invoice.aggregate([
      { $match: { status: 'Paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const monthlyRevenue = await Invoice.aggregate([
      {
        $match: {
          status: 'Paid',
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalTickets = await Ticket.countDocuments();
    const openTickets = await Ticket.countDocuments({ status: 'open' });
    const inProgressTickets = await Ticket.countDocuments({ status: 'in-progress' });
    const closedTickets = await Ticket.countDocuments({ status: { $in: ['closed', 'resolved'] } });

    const ticketsPerDay = await Ticket.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const revenueByRegion = await Invoice.aggregate([
      { $match: { status: 'Paid' } },
      { $group: { _id: '$region', total: { $sum: '$amount' } } }
    ]);

    const topUsers = await Invoice.aggregate([
      { $match: { status: 'Paid' } },
      { $group: { _id: '$user', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          pipeline: [
            { $project: { _id: 1, name: 1, email: 1, role: 1 } }
          ],
          as: 'user'
        }
      }
    ]);

    const totalMetrics = await Metric.countDocuments();
    const auditLogsCount = await AuditLog.countDocuments();

    return res.json({
      totalUsers,
      activeUsers,
      totalInstances,
      runningInstances,
      totalRevenue: totalRevenue[0]?.total || 0,
      monthlyRevenue: monthlyRevenue[0]?.total || 0,
      totalTickets,
      openTickets,
      inProgressTickets,
      closedTickets,
      ticketsPerDay,
      revenueByRegion,
      topUsers,
      systemHealth: {
        totalMetrics,
        auditLogsCount,
        status: 'healthy'
      }
    });
  } catch (err) {
    return res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

router.get('/users', auth, adminOnly, async (_req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

router.put('/users/:id', auth, adminOnly, async (req, res) => {
  try {
    const { role } = req.body;
    if (!ALLOWED_USER_ROLES.has((role || '').toLowerCase())) {
      return res.status(400).json({ msg: 'Invalid role' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    if (req.params.id === req.user.id && role !== 'admin') {
      return res.status(400).json({ msg: 'You cannot remove your own admin role' });
    }

    const oldRole = user.role;
    user.role = role.toLowerCase();
    await user.save();

    await AuditLog.create({
      user: req.user.id,
      action: 'ADMIN_USER_ROLE_UPDATED',
      resource: 'User',
      resourceId: user._id,
      details: { oldRole, newRole: user.role }
    });

    return res.json({ msg: 'User updated', user });
  } catch (err) {
    return res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

router.delete('/users/:id', auth, adminOnly, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ msg: 'You cannot delete your own account' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    await AuditLog.create({
      user: req.user.id,
      action: 'USER_BANNED',
      resource: 'User',
      resourceId: req.params.id,
      details: {
        bannedUser: user.email,
        reason: 'Admin action'
      }
    });

    await User.findByIdAndDelete(req.params.id);
    await Instance.deleteMany({ owner: req.params.id });
    await Invoice.deleteMany({ user: req.params.id });

    return res.json({ msg: 'User deleted and resources removed' });
  } catch (err) {
    return res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

router.get('/tickets', auth, adminOnly, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 50);
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.status && ALLOWED_TICKET_STATUS.has(req.query.status)) query.status = req.query.status;
    if (req.query.priority && ALLOWED_TICKET_PRIORITY.has(req.query.priority)) query.priority = req.query.priority;
    if (req.query.assignedTo) {
      if (!mongoose.Types.ObjectId.isValid(req.query.assignedTo)) {
        return res.status(400).json({ msg: 'Invalid assignedTo filter' });
      }
      query.assignedTo = req.query.assignedTo;
    }
    if (req.query.search) {
      const regex = new RegExp(req.query.search.trim(), 'i');
      query.$or = [{ subject: regex }, { description: regex }];
    }

    const [tickets, total] = await Promise.all([
      Ticket.find(query)
        .populate('user', 'name email role')
        .populate('assignedTo', 'name email role')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      Ticket.countDocuments(query)
    ]);

    return res.json({
      data: tickets,
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

router.put('/tickets/:id', auth, adminOnly, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ msg: 'Ticket not found' });

    const updates = {};
    if (req.body.status) {
      if (!ALLOWED_TICKET_STATUS.has(req.body.status)) return res.status(400).json({ msg: 'Invalid status' });
      updates.status = req.body.status;
    }
    if (req.body.priority) {
      if (!ALLOWED_TICKET_PRIORITY.has(req.body.priority)) return res.status(400).json({ msg: 'Invalid priority' });
      updates.priority = req.body.priority;
    }
    if (req.body.assignedTo !== undefined) {
      if (req.body.assignedTo === null || req.body.assignedTo === '') {
        updates.assignedTo = null;
      } else {
        const assigneeId = String(req.body.assignedTo).trim();
        if (!mongoose.Types.ObjectId.isValid(assigneeId)) {
          return res.status(400).json({ msg: 'Invalid assignee id' });
        }
        const assignee = await User.findById(assigneeId).select('_id');
        if (!assignee) {
          return res.status(400).json({ msg: 'Assignee user not found' });
        }
        updates.assignedTo = assigneeId;
      }
    }

    const historyItems = [];
    ['status', 'priority', 'assignedTo'].forEach((field) => {
      if (updates[field] !== undefined && String(ticket[field] || '') !== String(updates[field] || '')) {
        historyItems.push({
          actor: req.user.id,
          action: `Admin updated ${field}`,
          field,
          oldValue: String(ticket[field] || ''),
          newValue: String(updates[field] || '')
        });
      }
    });

    Object.assign(ticket, updates);
    if (historyItems.length) ticket.history.push(...historyItems);
    await ticket.save();

    await AuditLog.create({
      user: req.user.id,
      action: 'ADMIN_TICKET_UPDATED',
      resource: 'Ticket',
      resourceId: ticket._id,
      details: updates
    });

    return res.json({ msg: 'Ticket updated', ticket });
  } catch (err) {
    return res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

router.delete('/tickets/:id', auth, adminOnly, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ msg: 'Ticket not found' });

    removeTicketFiles(ticket);
    await Ticket.findByIdAndDelete(req.params.id);

    await AuditLog.create({
      user: req.user.id,
      action: 'ADMIN_TICKET_DELETED',
      resource: 'Ticket',
      resourceId: req.params.id,
      details: { subject: ticket.subject }
    });

    return res.json({ msg: 'Ticket deleted' });
  } catch (err) {
    return res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

router.get('/resources', auth, adminOnly, async (_req, res) => {
  try {
    const instances = await Instance.find().populate('owner', 'email name');
    const invoices = await Invoice.find().populate('user', 'email name');
    return res.json({ instances, invoices });
  } catch (err) {
    return res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

router.get('/audit-logs', auth, adminOnly, async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const logs = await AuditLog
      .find()
      .populate('user', 'email name')
      .sort({ timestamp: -1 })
      .limit(parseInt(limit, 10));
    return res.json(logs);
  } catch (err) {
    return res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

module.exports = router;
