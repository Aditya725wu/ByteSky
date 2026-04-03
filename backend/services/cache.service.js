const { getRedisClient } = require('../config/redis');

function getClient() {
  const client = getRedisClient();
  return client && client.isOpen ? client : null;
}

function isCacheAvailable() {
  return Boolean(getClient());
}

function getBucketsCacheKey(userId) {
  return `buckets:${userId}`;
}

async function getCachedValue(key) {
  const client = getClient();
  if (!client) {
    return null;
  }

  const value = await client.get(key);
  if (value === null) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return value;
  }
}

async function setCachedValue(key, value, ttlSeconds = 60) {
  const client = getClient();
  if (!client) {
    return false;
  }

  const normalizedTtl = Number.isFinite(Number(ttlSeconds)) && Number(ttlSeconds) > 0
    ? Number(ttlSeconds)
    : 60;
  const payload = typeof value === 'string' ? value : JSON.stringify(value);

  await client.set(key, payload, { EX: normalizedTtl });
  return true;
}

async function deleteCachedValue(key) {
  const client = getClient();
  if (!client) {
    return false;
  }

  await client.del(key);
  return true;
}

module.exports = {
  deleteCachedValue,
  getBucketsCacheKey,
  getCachedValue,
  isCacheAvailable,
  setCachedValue
};
