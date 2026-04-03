const express = require('express');

const containerController = require('../controllers/container.controller');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);
router.get('/apache/status', asyncHandler(containerController.getApacheStatus));
router.post('/apache/launch', asyncHandler(containerController.launchApache));
router.post('/apache/stop', asyncHandler(containerController.stopApache));
router.get('/catalog', asyncHandler(containerController.getMarketplaceCatalog));
router.get('/active', asyncHandler(containerController.getActiveSessions));
router.post('/start', asyncHandler(containerController.startContainer));
router.post('/stop', asyncHandler(containerController.stopContainer));

module.exports = router;
