const Instance = require('../models/Instance');
const Metric = require('../models/Metric');
const logger = require('../config/logger');
const env = require('../config/env');

let timer = null;
let isProcessing = false;

async function collectMetrics() {
  if (isProcessing) {
    return;
  }

  isProcessing = true;

  try {
    const runningInstances = await Instance.find({ status: 'running' });

    for (const inst of runningInstances) {
      if (!inst.hourlyRate || inst.hourlyRate <= 0) {
        continue;
      }

      const metric = await Metric.create({
        instance: inst._id,
        user: inst.owner,
        cpu: Math.floor(Math.random() * 80) + 10,
        ram: Math.floor(Math.random() * 60) + 20,
        networkIn: Number((Math.random() * 5).toFixed(2)),
        networkOut: Number((Math.random() * 2).toFixed(2)),
        diskRead: Number((Math.random() * 100).toFixed(2)),
        diskWrite: Number((Math.random() * 50).toFixed(2))
      });

      await Instance.updateOne(
        { _id: inst._id },
        {
          $push: {
            metrics: {
              $each: [{
                cpu: metric.cpu,
                ram: metric.ram,
                networkIn: metric.networkIn,
                networkOut: metric.networkOut,
                timestamp: metric.timestamp
              }],
              $position: 0,
              $slice: 50
            }
          },
          $set: { updatedAt: new Date() }
        }
      );
    }
  } catch (error) {
    logger.error('Metrics simulation failed', { error: error.message });
  } finally {
    isProcessing = false;
  }
}

function start() {
  if (timer) {
    return;
  }

  timer = setInterval(collectMetrics, env.metricsIntervalMs);
  logger.info(`Metrics worker started with interval ${env.metricsIntervalMs}ms`);
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    logger.info('Metrics worker stopped');
  }
}

module.exports = {
  start,
  stop
};
