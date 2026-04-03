const express = require('express');

const router = express.Router();

router.use('/health', require('./health'));
router.use('/auth', require('./auth'));
router.use('/vm', require('./vm.routes'));
router.use('/container', require('./container'));
router.use('/docker', require('./docker'));
router.use('/jenkins', require('./jenkins'));
router.use('/cache', require('./cache'));
router.use('/instances', require('./instances'));
router.use('/billing', require('./billing'));
router.use('/monitoring', require('./monitoring'));
router.use('/storage', require('./storage'));
router.use('/support', require('./support'));
router.use('/tickets', require('./support'));
router.use('/iam', require('./iam'));
router.use('/notifications', require('./notifications'));
router.use('/network', require('./network'));
router.use('/admin', require('./admin'));
router.use('/twoFA', require('./twoFA'));
router.use('/audit', require('./audit'));

module.exports = router;
