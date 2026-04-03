const { createClient } = require('redis');

const env = require('./env');
const logger = require('./logger');

let client = null;

async function connectRedis() {
  client = createClient({ url: env.redisUrl });

  client.on('error', (error) => {
    logger.error('Redis client error', { error: error.message });
  });

  try {
    await client.connect();
    logger.info(`Redis connected to ${env.redisUrl}`);
    return client;
  } catch (error) {
    logger.warn('Redis connection failed, caching disabled', {
      url: env.redisUrl,
      error: error.message
    });
    client = null;
    return null;
  }
}

async function pingRedis() {
  if (!client || !client.isOpen) {
    return false;
  }

  try {
    const result = await client.ping();
    return result === 'PONG';
  } catch (error) {
    logger.warn('Redis ping failed', { error: error.message });
    return false;
  }
}

async function disconnectRedis() {
  if (client && client.isOpen) {
    await client.quit();
    logger.info('Redis connection closed');
  }
}

function getRedisClient() {
  return client;
}

module.exports = {
  connectRedis,
  disconnectRedis,
  getRedisClient,
  pingRedis
};
