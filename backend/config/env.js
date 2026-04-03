const path = require('path');

const dotenv = require('dotenv');

dotenv.config();

function parseNumber(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

function parseList(value, fallback = []) {
  if (!value) {
    return fallback;
  }

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseNumber(process.env.PORT, 5000),
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  corsOrigins: parseList(process.env.CORS_ORIGIN, ['*']),
  rateLimitWindowMs: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  rateLimitMax: parseNumber(process.env.RATE_LIMIT_MAX, 200),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  trustProxy: parseBoolean(process.env.TRUST_PROXY, true),
  uploadsDir: path.resolve(__dirname, '..', 'uploads'),
  logsDir: path.resolve(__dirname, '..', 'logs'),
  frontendDir: process.env.FRONTEND_DIR
    ? path.resolve(process.env.FRONTEND_DIR)
    : path.resolve(__dirname, '..', '..', 'frontend'),
  logLevel: process.env.LOG_LEVEL || 'info',
  adminSeedEmail: process.env.ADMIN_SEED_EMAIL || 'admin@bytesky.cloud',
  adminSeedPassword: process.env.ADMIN_SEED_PASSWORD || 'ChangeMeImmediately!',
  adminSeedName: process.env.ADMIN_SEED_NAME || 'System Administrator',
  metricsEnabled: parseBoolean(process.env.METRICS_ENABLED, true),
  metricsIntervalMs: parseNumber(process.env.METRICS_INTERVAL_MS, 5000),
  dockerCommand: process.env.DOCKER_COMMAND || 'docker',
  dockerHost: process.env.DOCKER_HOST || '',
  dockerSocketPath:
    process.env.DOCKER_SOCKET_PATH
    || (process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock'),
  containerImage: process.env.CONTAINER_IMAGE || 'nginx:alpine',
  containerInternalPort: parseNumber(process.env.CONTAINER_INTERNAL_PORT, 80),
  containerPublicBaseUrl: process.env.CONTAINER_PUBLIC_BASE_URL || 'http://localhost',
  containerPortRangeStart: parseNumber(process.env.CONTAINER_PORT_RANGE_START, 3001),
  containerPortRangeEnd: parseNumber(process.env.CONTAINER_PORT_RANGE_END, 3099),
  maxContainersPerUser: parseNumber(process.env.MAX_CONTAINERS_PER_USER, 1),
  containerTtlMs: parseNumber(process.env.CONTAINER_TTL_MS, 30 * 60 * 1000),
  vmImage: process.env.VM_IMAGE || 'ubuntu:22.04',
  vmInternalPort: parseNumber(process.env.VM_INTERNAL_PORT, 80),
  vmPublicBaseUrl:
    process.env.VM_PUBLIC_BASE_URL
    || process.env.CONTAINER_PUBLIC_BASE_URL
    || process.env.APP_BASE_URL
    || 'http://localhost',
  vmPortRangeStart:
    parseNumber(process.env.VM_PORT_RANGE_START, 6001),
  vmPortRangeEnd:
    parseNumber(process.env.VM_PORT_RANGE_END, 6099),
  vmTtlMs: parseNumber(process.env.VM_TTL_MS, 30 * 60 * 1000),
  vmMemoryMb: parseNumber(process.env.VM_MEMORY_MB, 256),
  vmCpuLimit: Number(process.env.VM_CPU_LIMIT || 0.5),
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  stripeCurrency: process.env.STRIPE_CURRENCY || 'usd',
  googleClientId: process.env.CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '',
  keycloakBaseUrl: process.env.KEYCLOAK_BASE_URL || 'http://localhost:8080',
  keycloakRealm: process.env.KEYCLOAK_REALM || 'my-cloud',
  keycloakAdminRealm: process.env.KEYCLOAK_ADMIN_REALM || 'master',
  keycloakClientId: process.env.KEYCLOAK_CLIENT_ID || 'admin-cli',
  keycloakClientSecret: process.env.KEYCLOAK_CLIENT_SECRET || '',
  keycloakAdminUsername: process.env.KEYCLOAK_ADMIN_USERNAME || '',
  keycloakAdminPassword: process.env.KEYCLOAK_ADMIN_PASSWORD || '',
  jenkinsUrl: process.env.JENKINS_URL || 'http://localhost:8081',
  jenkinsImage: process.env.JENKINS_IMAGE || 'jenkins/jenkins',
  jenkinsHostPort: parseNumber(process.env.JENKINS_HOST_PORT, 8081),
  jenkinsContainerPort: parseNumber(process.env.JENKINS_CONTAINER_PORT, 8080),
  jenkinsAdminUser: process.env.JENKINS_ADMIN_USER || 'admin',
  jenkinsAdminPassword: process.env.JENKINS_ADMIN_PASSWORD || 'admin123',
  jenkinsJobName: process.env.JENKINS_JOB_NAME || 'bytesky-node-app',
  jenkinsBuildToken: process.env.JENKINS_BUILD_TOKEN || 'bytesky-build-token',
  jenkinsGitRepoUrl: process.env.JENKINS_GIT_REPO_URL || '',
  jenkinsGitBranch: process.env.JENKINS_GIT_BRANCH || 'main'
};

const requiredKeys = ['MONGO_URI', 'JWT_SECRET'];
const missing = requiredKeys.filter((key) => !process.env[key]);

if (missing.length) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

module.exports = env;
