const express = require('express');

const authController = require('../controllers/auth.controller');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/register', asyncHandler(authController.register));
router.post('/login', asyncHandler(authController.login));
router.post('/google', asyncHandler(authController.googleLogin));
router.get('/me', auth, asyncHandler(authController.getCurrentUser));
router.patch('/profile', auth, asyncHandler(authController.updateProfile));
router.patch('/password', auth, asyncHandler(authController.changePassword));

module.exports = router;
