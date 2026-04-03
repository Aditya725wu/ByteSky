const express = require('express');

const jenkinsController = require('../controllers/jenkins.controller');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);
router.get('/status', asyncHandler(jenkinsController.getStatus));
router.post('/launch', asyncHandler(jenkinsController.launch));
router.post('/stop', asyncHandler(jenkinsController.stop));
router.post('/build', asyncHandler(jenkinsController.build));

module.exports = router;
