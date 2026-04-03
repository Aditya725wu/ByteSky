const express = require('express');
const router = express.Router();
const User = require('../models/User');
const APIKey = require('../models/APIKey');
const AuditLog = require('../models/AuditLog');
const {
  listRealmRoles,
  createRealmRole,
  deleteRealmRole
} = require('../services/keycloak-admin.service');
const auth = require('../middleware/auth');

// Middleware: Check if user is admin
const requireAdmin = async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (user.role !== 'admin') {
    await AuditLog.create({
      user: req.user.id,
      action: 'UNAUTHORIZED_ACCESS',
      resource: 'IAM',
      details: { attemptedAction: req.path },
      status: 'failure',
      ipAddress: req.ip
    });
    return res.status(403).json({ msg: 'Admin access required' });
  }
  next();
};

// ===== USER MANAGEMENT =====

// Get all users (Admin only)
router.get('/users', auth, requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password -twoFASecret').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Get single user
router.get('/users/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -twoFASecret');
    if (!user) return res.status(404).json({ msg: 'User not found' });

    // Users can only view their own profile or admins can view any
    if (user._id.toString() !== req.user.id) {
      const currentUser = await User.findById(req.user.id);
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ msg: 'Not authorized' });
      }
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Update user role/policies (Admin only)
router.patch('/users/:id', auth, requireAdmin, async (req, res) => {
  try {
    const { role, policies } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (role) user.role = role;
    if (policies) user.policies = policies;

    await user.save();

    await AuditLog.create({
      user: req.user.id,
      action: 'USER_UPDATED',
      resource: 'User',
      resourceId: user._id,
      details: { updatedFields: { role, policies } },
      ipAddress: req.ip
    });

    res.json({ msg: 'User updated', user });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Delete user (Admin only)
router.delete('/users/:id', auth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ msg: 'Cannot delete admin users' });

    // Log before deletion
    await AuditLog.create({
      user: req.user.id,
      action: 'USER_DELETED',
      resource: 'User',
      resourceId: user._id,
      details: { deletedUser: user.email },
      ipAddress: req.ip
    });

    await User.findByIdAndDelete(req.params.id);
    res.json({ msg: 'User deleted' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// ===== POLICY MANAGEMENT =====

// Get all policies
router.get('/policies', auth, async (req, res) => {
  try {
    const policies = await listRealmRoles();
    res.json(policies);
  } catch (err) {
    const status = err.status && err.status >= 400 ? err.status : 500;
    res.status(status).json({ msg: err.message || 'Unable to load policies from Keycloak' });
  }
});

// Create policy (Admin only)
router.post('/policies', auth, requireAdmin, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ msg: 'Policy name is required' });
    }

    const policy = await createRealmRole(name);

    await AuditLog.create({
      user: req.user.id,
      action: 'POLICY_CREATED',
      resource: 'KeycloakRole',
      resourceId: policy.id,
      details: { name },
      ipAddress: req.ip
    });

    res.json({ msg: 'Policy created', policy });
  } catch (err) {
    const status = err.status && err.status >= 400 ? err.status : 500;
    res.status(status).json({ msg: err.message || 'Unable to create policy in Keycloak' });
  }
});

// Delete policy (Admin only)
router.delete('/policies/:name', auth, requireAdmin, async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name || '').trim();
    if (!name) {
      return res.status(400).json({ msg: 'Policy name is required' });
    }

    await deleteRealmRole(name);

    await AuditLog.create({
      user: req.user.id,
      action: 'POLICY_DELETED',
      resource: 'KeycloakRole',
      details: { name },
      ipAddress: req.ip
    });

    res.json({ msg: 'Policy deleted' });
  } catch (err) {
    const status = err.status && err.status >= 400 ? err.status : 500;
    res.status(status).json({ msg: err.message || 'Unable to delete policy from Keycloak' });
  }
});

// ===== API KEY MANAGEMENT =====

// Get user's API keys
router.get('/api-keys', auth, async (req, res) => {
  try {
    const keys = await APIKey.find({ user: req.user.id }).select('-secret');
    res.json(keys);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Create API key
router.post('/api-keys', auth, async (req, res) => {
  try {
    const { name, permissions, expiresAt } = req.body;

    const { key, secret } = APIKey.generateKeyPair();

    const apiKey = new APIKey({
      user: req.user.id,
      name,
      key,
      secret,
      permissions: permissions || ['instances:read', 'storage:read'],
      expiresAt: expiresAt ? new Date(expiresAt) : null
    });

    await apiKey.save();

    await AuditLog.create({
      user: req.user.id,
      action: 'API_KEY_CREATED',
      resource: 'APIKey',
      resourceId: apiKey._id,
      details: { name, key: key.substring(0, 10) + '...' },
      ipAddress: req.ip
    });

    // Return secret ONLY ONCE
    res.json({
      msg: 'API key created - Save your secret key now!',
      apiKey: {
        id: apiKey._id,
        name: apiKey.name,
        key: apiKey.key,
        secret: secret, // ⚠️ Only shown once!
        permissions: apiKey.permissions,
        createdAt: apiKey.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Revoke API key
router.delete('/api-keys/:id', auth, async (req, res) => {
  try {
    const key = await APIKey.findOne({ _id: req.params.id, user: req.user.id });
    if (!key) return res.status(404).json({ msg: 'API key not found' });

    await AuditLog.create({
      user: req.user.id,
      action: 'API_KEY_REVOKED',
      resource: 'APIKey',
      resourceId: key._id,
      details: { name: key.name, key: key.key.substring(0, 10) + '...' },
      ipAddress: req.ip
    });

    await APIKey.findByIdAndDelete(req.params.id);
    res.json({ msg: 'API key revoked' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// ===== AUDIT LOGS =====

// Get audit logs (Admin only, or user's own logs)
router.get('/audit-logs', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const { limit = 100, action, resource } = req.query;

    let query = {};
    if (user.role !== 'admin') {
      query.user = req.user.id; // Users can only see their own logs
    }
    if (action) query.action = action;
    if (resource) query.resource = resource;

    const logs = await AuditLog.find(query)
      .populate('user', 'email name')
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json(logs);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// ===== ROLE-BASED ACCESS CHECK =====

// Check if user has permission
router.post('/check-permission', auth, async (req, res) => {
  try {
    const { action, resource } = req.body;
    const user = await User.findById(req.user.id).populate('policies');

    // Admin has all permissions
    if (user.role === 'admin') {
      return res.json({ allowed: true, reason: 'Admin role' });
    }

    // Check attached policies
    let allowed = false;
    for (const policy of user.policies) {
      for (const statement of policy.statements) {
        if (statement.effect === 'Allow') {
          const actionMatch = statement.actions.some(a =>
            a === action || a === '*' || action.startsWith(a.replace('*', ''))
          );
          const resourceMatch = statement.resources.some(r =>
            r === resource || r === '*' || resource.startsWith(r.replace('*', ''))
          );

          if (actionMatch && resourceMatch) {
            allowed = true;
            break;
          }
        }
      }
      if (allowed) break;
    }

    res.json({ allowed, reason: allowed ? 'Policy match' : 'No matching policy' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
