const cors = require('cors');
const express = require('express');
const fs = require('fs');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const logger = require('./config/logger');
const apiRoutes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

const app = express();

app.set('trust proxy', env.trustProxy ? 1 : false);

const corsOptions = env.corsOrigins.includes('*')
  ? { origin: true, credentials: true }
  : {
      origin(origin, callback) {
        if (!origin || env.corsOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error('CORS origin not allowed'));
      },
      credentials: true
    };

const apiLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => env.nodeEnv === 'development' && req.path.startsWith('/storage'),
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
});

app.use(helmet({
  crossOriginOpenerPolicy: {
    policy: 'same-origin-allow-popups'
  }
}));
app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev', { stream: logger.stream }));

app.use('/api', apiLimiter, apiRoutes);
app.use('/uploads', express.static(env.uploadsDir));

const frontendExists = fs.existsSync(env.frontendDir);
if (frontendExists) {
  app.use(express.static(env.frontendDir));
}

app.use((req, res, next) => {
  if (req.method !== 'GET' || !frontendExists || req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }

  return res.sendFile(path.join(env.frontendDir, 'index.html'));
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
