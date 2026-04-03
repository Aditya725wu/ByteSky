const env = require('../config/env');
const mongoose = require('mongoose');

const { pingRedis } = require('../config/redis');

function live(_req, res) {
  return res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
}

async function ready(_req, res) {
  const mongoReady = mongoose.connection.readyState === 1;
  const redisReady = await pingRedis();

  const payload = {
    status: mongoReady ? 'ready' : 'degraded',
    checks: {
      mongo: mongoReady,
      redis: redisReady
    },
    timestamp: new Date().toISOString()
  };

  return res.status(mongoReady ? 200 : 503).json(payload);
}

async function summary(_req, res) {
  const mongoReady = mongoose.connection.readyState === 1;
  const redisReady = await pingRedis();

  return res.json({
    status: mongoReady ? 'OK' : 'DEGRADED',
    message: 'ByteSky API is running',
    services: {
      database: mongoReady ? 'up' : 'down',
      cache: redisReady ? 'up' : 'down'
    },
    timestamp: new Date().toISOString()
  });
}

function clientConfig(_req, res) {
  return res.json({
    appBaseUrl: env.appBaseUrl || '',
    corsOrigins: env.corsOrigins.includes('*') ? [] : env.corsOrigins,
    googleClientId: env.googleClientId || '',
    googleAuthEnabled: Boolean(env.googleClientId)
  });
}

module.exports = {
  clientConfig,
  live,
  ready,
  summary
};
