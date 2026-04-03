const express = require('express');

const asyncHandler = require('../middleware/asyncHandler');
const healthController = require('../controllers/health.controller');

const router = express.Router();

router.get('/', asyncHandler(healthController.summary));
router.get('/client-config', asyncHandler(healthController.clientConfig));
router.get('/live', asyncHandler(healthController.live));
router.get('/ready', asyncHandler(healthController.ready));

module.exports = router;
