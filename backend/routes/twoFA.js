const express = require('express');
const router = express.Router();
const TwoFA = require('../models/TwoFA');
const User = require('../models/User');
const auth = require('../middleware/auth');
const QRCode = require('qrcode');

// Setup 2FA
router.post('/setup', auth, async (req, res) => {
  try {
    let twoFA = await TwoFA.findOne({ user: req.user.id });
    
    if (!twoFA) {
      twoFA = new TwoFA({ user: req.user.id });
      const otpauthUrl = twoFA.generateSecret();
      await twoFA.save();
      
      const qrCode = await QRCode.toDataURL(otpauthUrl);
      res.json({ secret: twoFA.secret, qrCode, backupCodes: twoFA.backupCodes });
    } else {
      const otpauthUrl = `otpauth://totp/ByteSky:${req.user.email}?secret=${twoFA.secret}&issuer=ByteSky`;
      const qrCode = await QRCode.toDataURL(otpauthUrl);
      res.json({ secret: twoFA.secret, qrCode, enabled: twoFA.enabled });
    }
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Verify & Enable 2FA
router.post('/verify', auth, async (req, res) => {
  try {
    const { token } = req.body;
    const twoFA = await TwoFA.findOne({ user: req.user.id });
    
    if (!twoFA) return res.status(400).json({ msg: '2FA not setup' });
    
    const isValid = twoFA.verifyToken(token);
    if (isValid) {
      twoFA.enabled = true;
      await twoFA.save();
      res.json({ msg: '2FA enabled successfully' });
    } else {
      res.status(400).json({ msg: 'Invalid token' });
    }
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Disable 2FA
router.post('/disable', auth, async (req, res) => {
  try {
    const { token, backupCode } = req.body;
    const twoFA = await TwoFA.findOne({ user: req.user.id });
    
    if (!twoFA || !twoFA.enabled) return res.status(400).json({ msg: '2FA not enabled' });
    
    const isValid = twoFA.verifyToken(token) || twoFA.backupCodes.includes(backupCode);
    if (isValid) {
      twoFA.enabled = false;
      await twoFA.save();
      res.json({ msg: '2FA disabled successfully' });
    } else {
      res.status(400).json({ msg: 'Invalid token or backup code' });
    }
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Check 2FA Status
router.get('/status', auth, async (req, res) => {
  try {
    const twoFA = await TwoFA.findOne({ user: req.user.id });
    res.json({ enabled: twoFA?.enabled || false });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;