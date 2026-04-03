const fs = require('fs');

const { createLogger, format, transports } = require('winston');

const env = require('./env');

fs.mkdirSync(env.logsDir, { recursive: true });

const logger = createLogger({
  level: env.logLevel,
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: {
    service: 'bytesky-backend',
    environment: env.nodeEnv
  },
  transports: [
    new transports.File({ filename: `${env.logsDir}/error.log`, level: 'error' }),
    new transports.File({ filename: `${env.logsDir}/combined.log` })
  ]
});

logger.add(
  new transports.Console({
    format: format.combine(format.colorize(), format.simple())
  })
);

logger.stream = {
  write(message) {
    logger.http(message.trim());
  }
};

module.exports = logger;
