const express = require('express');

const cacheController = require('../controllers/cache.controller');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);
router.post('/set', asyncHandler(cacheController.setCacheValue));
router.get('/get/:key', asyncHandler(cacheController.getCacheValue));

module.exports = router;
