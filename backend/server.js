const http = require('http');
const net = require('net');

const app = require('./app');
const { connectDatabase, disconnectDatabase } = require('./config/database');
const env = require('./config/env');
const logger = require('./config/logger');
const containerService = require('./services/container.service');
const { connectRedis, disconnectRedis } = require('./config/redis');
const metricsService = require('./services/metrics.service');
const { seedCoreData } = require('./services/seed.service');

let server;
let isShuttingDown = false;

function normalizeStartupError(error) {
  if (error?.code === 'EADDRINUSE') {
    const port = env.port;
    const normalized = new Error(
      `Port ${port} is already in use. Stop the process using port ${port} or change PORT in backend/.env.`
    );
    normalized.code = error.code;
    normalized.stack = error.stack;
    return normalized;
  }

  return error;
}

function ensurePortAvailable(port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();

    const cleanup = () => {
      probe.removeListener('error', handleError);
      probe.removeListener('listening', handleListening);
    };

    const handleError = (error) => {
      cleanup();
      reject(normalizeStartupError(error));
    };

    const handleListening = () => {
      probe.close((error) => {
        cleanup();

        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    };

    probe.unref();
    probe.once('error', handleError);
    probe.once('listening', handleListening);
    probe.listen(port);
  });
}

function listen(serverInstance, port) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      serverInstance.removeListener('error', handleError);
      serverInstance.removeListener('listening', handleListening);
    };

    const handleError = (error) => {
      cleanup();
      reject(normalizeStartupError(error));
    };

    const handleListening = () => {
      cleanup();
      resolve();
    };

    serverInstance.once('error', handleError);
    serverInstance.once('listening', handleListening);
    serverInstance.listen(port);
  });
}

async function closeServer() {
  if (!server || !server.listening) {
    server = null;
    return;
  }

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  server = null;
}

async function startServer() {
  await ensurePortAvailable(env.port);
  await connectDatabase();
  await connectRedis();
  await seedCoreData();
  await containerService.initializeContainerLifecycle();

  server = http.createServer(app);
  await listen(server, env.port);

  if (env.metricsEnabled) {
    metricsService.start();
  }

  logger.info(`ByteSky backend listening on port ${env.port}`);
}

async function shutdown(signal, exitCode = 0) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info(`Received ${signal}, shutting down gracefully`);
  metricsService.stop();

  try {
    await closeServer();
  } catch (error) {
    logger.warn('Failed to close HTTP server cleanly', { error: error.message });
  }

  try {
    await disconnectRedis();
  } catch (error) {
    logger.warn('Failed to close Redis cleanly', { error: error.message });
  }

  try {
    await disconnectDatabase();
  } catch (error) {
    logger.warn('Failed to close MongoDB cleanly', { error: error.message });
  }

  process.exit(exitCode);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection', { error: error.message, stack: error.stack });
});
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  shutdown('uncaughtException', 1);
});

startServer().catch(async (error) => {
  logger.error('Failed to start ByteSky backend', { error: error.message, stack: error.stack });
  await shutdown('startupFailure', 1);
});
