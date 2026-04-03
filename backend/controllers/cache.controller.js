const cacheService = require('../services/cache.service');

async function setCacheValue(req, res) {
  if (!cacheService.isCacheAvailable()) {
    return res.status(503).json({ success: false, message: 'Redis is not connected' });
  }

  const { key, value, ttl } = req.body || {};
  if (!key) {
    return res.status(400).json({ success: false, message: 'Cache key is required' });
  }

  const normalizedTtl = Number.isFinite(Number(ttl)) && Number(ttl) > 0 ? Number(ttl) : 60;
  await cacheService.setCachedValue(key, value, normalizedTtl);

  return res.status(201).json({
    success: true,
    key,
    ttl: normalizedTtl,
    value
  });
}

async function getCacheValue(req, res) {
  if (!cacheService.isCacheAvailable()) {
    return res.status(503).json({ success: false, message: 'Redis is not connected' });
  }

  const value = await cacheService.getCachedValue(req.params.key);
  if (value === null) {
    return res.status(404).json({ success: false, message: 'Cache key not found' });
  }

  return res.json({
    success: true,
    key: req.params.key,
    value
  });
}

module.exports = {
  getCacheValue,
  setCacheValue
};
