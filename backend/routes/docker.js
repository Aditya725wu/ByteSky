const express = require('express');

const dockerController = require('../controllers/docker.controller');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);
router.get('/containers', asyncHandler(dockerController.listContainers));
router.post('/run-metabase', asyncHandler(dockerController.runMetabase));
router.post('/run-postgres', asyncHandler(dockerController.runPostgres));
router.post('/run-redis', asyncHandler(dockerController.runRedis));
router.post('/run-vm', asyncHandler(dockerController.runVm));
router.post('/start/:id', asyncHandler(dockerController.startContainer));
router.post('/stop/:id', asyncHandler(dockerController.stopContainer));

module.exports = router;
