const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const auth = require('../middleware/auth');

// Get User's Audit Logs
router.get('/', auth, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const logs = await AuditLog.find({ user: req.user.id })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));
    res.json(logs);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;