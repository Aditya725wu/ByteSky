const mongoose = require('mongoose');

const env = require('./env');
const logger = require('./logger');

async function connectDatabase() {
  mongoose.set('strictQuery', true);

  await mongoose.connect(env.mongoUri);
  logger.info(`MongoDB connected to ${env.mongoUri}`);
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info('MongoDB connection closed');
  }
}

module.exports = {
  connectDatabase,
  disconnectDatabase
};
