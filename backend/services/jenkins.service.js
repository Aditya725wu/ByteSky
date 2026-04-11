const fs = require('fs/promises');
const http = require('http');
const https = require('https');
const path = require('path');

const env = require('../config/env');
const docker = require('./docker.service');
const ApiError = require('../utils/ApiError');
const {
  buildLoopbackServiceUrl,
  buildMarketplaceServiceUrl,
  normalizePrefix,
  resolveServiceBindHost
} = require('../utils/marketplaceAccess');

const JENKINS_NAME_PREFIX = 'bytesky-jenkins-';
const JENKINS_PROJECT_PATH = '/workspace/bytesky-cloud';
const JENKINS_DATA_ROOT = path.resolve(__dirname, '..', 'data', 'jenkins');
const JENKINS_BOOTSTRAP_DIR = path.resolve(__dirname, '..', 'jenkins', 'init.groovy.d');
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

function getJenkinsContainerName(userId) {
  return `${JENKINS_NAME_PREFIX}${String(userId).slice(-6)}`;
}

function getJenkinsHomeDir(userId) {
  return path.join(JENKINS_DATA_ROOT, String(userId));
}

function sanitizeDockerError(error) {
  const statusCode = error?.statusCode;
  const reason = error?.reason || error?.json?.message || error?.message || 'Docker operation failed';
  const normalizedReason = String(reason);

  if (statusCode === 404) {
    return 'Docker resource not found.';
  }

  if (normalizedReason.includes('Cannot connect to the Docker daemon') || normalizedReason.includes('connect ENOENT')) {
    return 'Docker is not running or the Docker daemon is unavailable.';
  }

  if (normalizedReason.toLowerCase().includes('permission denied')) {
    return 'Docker permission denied for the backend process.';
  }

  if (normalizedReason.toLowerCase().includes('port is already allocated')) {
    return `Port ${env.jenkinsHostPort} is already in use. Stop the existing Jenkins service or free that port first.`;
  }

  return normalizedReason.trim();
}

function sanitizeJenkinsRequestError(error) {
  const message = String(error?.message || error || 'Jenkins request failed');

  if (message.includes('ECONNREFUSED') || message.includes('socket hang up')) {
    return 'Jenkins is still starting up. Try again in a moment.';
  }

  if (message.toLowerCase().includes('timed out')) {
    return 'Jenkins did not respond in time.';
  }

  return message;
}

function toApiError(error, fallbackStatus = 503) {
  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError(error?.statusCode || fallbackStatus, sanitizeDockerError(error));
}

async function ensureImage(image) {
  try {
    await docker.getImage(image).inspect();
    return;
  } catch (error) {
    if (error?.statusCode !== 404) {
      throw toApiError(error);
    }
  }

  const stream = await docker.pull(image);
  await new Promise((resolve, reject) => {
    docker.modem.followProgress(stream, (error) => {
      if (error) {
        reject(toApiError(error));
        return;
      }

      resolve();
    });
  });
}

function buildDefaultBuildState(overrides = {}) {
  return {
    status: 'not_built',
    label: 'Not built yet',
    result: null,
    number: null,
    url: '',
    building: false,
    timestamp: null,
    durationMs: null,
    message: 'No Jenkins builds have run yet.',
    ...overrides
  };
}

function normalizeBuildStatus(result, building) {
  if (building) {
    return 'running';
  }

  switch (String(result || '').toUpperCase()) {
    case 'SUCCESS':
      return 'success';
    case 'FAILURE':
      return 'failed';
    case 'UNSTABLE':
      return 'unstable';
    case 'ABORTED':
      return 'aborted';
    default:
      return 'unknown';
  }
}

function buildLabelFromStatus(status) {
  switch (status) {
    case 'running':
      return 'Running';
    case 'success':
      return 'Success';
    case 'failed':
      return 'Failed';
    case 'unstable':
      return 'Unstable';
    case 'aborted':
      return 'Aborted';
    case 'queued':
      return 'Queued';
    case 'initializing':
      return 'Initializing';
    case 'ready':
      return 'Ready';
    case 'not_built':
      return 'Not built yet';
    default:
      return 'Unknown';
  }
}

function mapBuildPayload(payload) {
  if (!payload) {
    return buildDefaultBuildState();
  }

  const status = normalizeBuildStatus(payload.result, payload.building);
  return buildDefaultBuildState({
    status,
    label: buildLabelFromStatus(status),
    result: payload.result || null,
    number: typeof payload.number === 'number' ? payload.number : null,
    url: payload.url || '',
    building: Boolean(payload.building),
    timestamp: payload.timestamp || null,
    durationMs: payload.duration || null,
    message: payload.description || ''
  });
}

function formatJenkinsService(userId, details, options = {}) {
  const running = Boolean(details?.State?.Running);
  const containerName = details?.Name?.replace(/^\//, '') || getJenkinsContainerName(userId);
  const build = options.build || buildDefaultBuildState();

  return {
    id: 'jenkins-cicd',
    type: 'jenkins',
    name: 'Jenkins CI/CD',
    category: 'developer-tools',
    image: env.jenkinsImage,
    description: 'Continuous integration and delivery pipeline server',
    icon: 'CI',
    containerId: details?.Id || '',
    containerName,
    port: env.jenkinsHostPort,
    hostPort: env.jenkinsHostPort,
    containerPort: env.jenkinsContainerPort,
    url: getJenkinsPublicUrl(),
    jobName: env.jenkinsJobName,
    status: running ? 'running' : 'stopped',
    running,
    ready: Boolean(options.ready),
    readyMessage: options.readyMessage || (running ? 'Jenkins is starting up.' : 'Jenkins is stopped.'),
    build
  };
}

function parseResponseBody(body, contentType) {
  if (!body) {
    return null;
  }

  if (String(contentType || '').includes('application/json')) {
    try {
      return JSON.parse(body);
    } catch (_error) {
      return null;
    }
  }

  return body;
}

function getJenkinsJobPath(jobName) {
  return String(jobName)
    .split('/')
    .filter(Boolean)
    .map((segment) => `job/${encodeURIComponent(segment)}`)
    .join('/');
}

function getJenkinsAuthHeader() {
  const encoded = Buffer.from(`${env.jenkinsAdminUser}:${env.jenkinsAdminPassword}`).toString('base64');
  return `Basic ${encoded}`;
}

function getJenkinsPublicUrl() {
  if (env.jenkinsPublicUrl) {
    return env.jenkinsPublicUrl;
  }

  return buildMarketplaceServiceUrl({
    baseUrl: env.appBaseUrl || 'http://localhost',
    port: env.jenkinsHostPort,
    path: env.jenkinsPublicPath,
    mode: env.marketplaceUrlMode
  });
}

function getJenkinsInternalUrl() {
  if (env.jenkinsInternalUrl) {
    return env.jenkinsInternalUrl;
  }

  if (String(env.marketplaceUrlMode).toLowerCase() === 'path') {
    return buildLoopbackServiceUrl(env.jenkinsHostPort, env.jenkinsPublicPath);
  }

  return buildLoopbackServiceUrl(env.jenkinsHostPort, '/');
}

function getJenkinsRuntimeOptions() {
  const options = [];
  const existingOptions = String(env.jenkinsOpts || '').trim();

  if (existingOptions) {
    options.push(existingOptions);
  }

  if (String(env.marketplaceUrlMode).toLowerCase() === 'path' && !existingOptions.includes('--prefix=')) {
    options.push(`--prefix=${normalizePrefix(env.jenkinsPublicPath)}`);
  }

  return options.filter(Boolean).join(' ').trim();
}

function requestJenkins(pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const internalUrl = getJenkinsInternalUrl();
    const baseUrl = new URL(internalUrl.endsWith('/') ? internalUrl : `${internalUrl}/`);
    const requestUrl = new URL(pathname.replace(/^\//, ''), baseUrl);
    const query = options.query || {};

    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        requestUrl.searchParams.set(key, String(value));
      }
    });

    const payload = options.body
      ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
      : null;
    const headers = {
      Authorization: getJenkinsAuthHeader(),
      ...(options.headers || {})
    };

    if (payload && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const client = requestUrl.protocol === 'https:' ? https : http;
    const req = client.request(
      requestUrl,
      {
        method: options.method || 'GET',
        headers
      },
      (res) => {
        const chunks = [];

        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const rawBody = Buffer.concat(chunks).toString('utf8');
          const data = parseResponseBody(rawBody, res.headers['content-type']);
          const expectedStatuses = options.expectedStatuses || [200];

          if (!expectedStatuses.includes(res.statusCode)) {
            const message = typeof data === 'string' && data.trim()
              ? data.trim()
              : data?.message
                || data?.error
                || `Jenkins request failed with status ${res.statusCode}`;
            reject(new ApiError(res.statusCode || 502, message));
            return;
          }

          resolve({
            statusCode: res.statusCode || 200,
            headers: res.headers,
            data
          });
        });
      }
    );

    req.on('error', (error) => reject(new ApiError(503, sanitizeJenkinsRequestError(error))));
    req.setTimeout(options.timeoutMs || 10000, () => {
      req.destroy(new Error('Jenkins request timed out.'));
    });

    if (payload) {
      req.write(payload);
    }

    req.end();
  });
}

async function ensureJenkinsFilesystem(userId) {
  const homeDir = getJenkinsHomeDir(userId);
  await fs.mkdir(homeDir, { recursive: true });
  await fs.mkdir(JENKINS_BOOTSTRAP_DIR, { recursive: true });
  return { homeDir };
}

async function inspectJenkinsContainer(userId) {
  const containerName = getJenkinsContainerName(userId);

  try {
    const directContainer = docker.getContainer(containerName);
    const directDetails = await directContainer.inspect();
    return { container: directContainer, details: directDetails };
  } catch (error) {
    if (error?.statusCode !== 404) {
      throw toApiError(error);
    }
  }

  try {
    const containers = await docker.listContainers({ all: true });
    const existing = containers.find((container) => {
      const names = container.Names || [];
      const usesManagedName = names.some((name) => name.replace(/^\//, '') === containerName);
      const usesJenkinsImage = String(container.Image || '').toLowerCase().startsWith(env.jenkinsImage.toLowerCase());
      const bindsPort8081 = (container.Ports || []).some((port) => port.PublicPort === env.jenkinsHostPort);

      return usesManagedName || (usesJenkinsImage && bindsPort8081);
    });

    if (!existing) {
      return null;
    }

    const container = docker.getContainer(existing.Id);
    const details = await container.inspect();
    return { container, details };
  } catch (error) {
    throw toApiError(error);
  }
}

async function waitForJenkinsReady(timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      await requestJenkins('/api/json', { expectedStatuses: [200], timeoutMs: 8000 });
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 4000));
    }
  }

  throw lastError || new ApiError(503, 'Jenkins is still starting up.');
}

async function fetchJenkinsCrumb() {
  try {
    const response = await requestJenkins('/crumbIssuer/api/json', {
      expectedStatuses: [200, 404],
      timeoutMs: 8000
    });

    if (response.statusCode === 404 || !response.data?.crumbRequestField || !response.data?.crumb) {
      return null;
    }

    return {
      field: response.data.crumbRequestField,
      value: response.data.crumb
    };
  } catch (error) {
    if (error.statusCode === 404) {
      return null;
    }

    throw error;
  }
}

async function fetchLastBuild() {
  const jobPath = getJenkinsJobPath(env.jenkinsJobName);

  try {
    const response = await requestJenkins(`/${jobPath}/lastBuild/api/json`, {
      expectedStatuses: [200, 404],
      timeoutMs: 8000
    });

    if (response.statusCode === 404) {
      return buildDefaultBuildState();
    }

    return mapBuildPayload(response.data);
  } catch (error) {
    if (error.statusCode === 404) {
      return buildDefaultBuildState();
    }

    throw error;
  }
}

async function getJenkinsServiceStatus(userId) {
  const jenkins = await inspectJenkinsContainer(userId);
  if (!jenkins) {
    return formatJenkinsService(userId, null, {
      ready: false,
      readyMessage: 'Jenkins is not running.',
      build: buildDefaultBuildState()
    });
  }

  if (!jenkins.details?.State?.Running) {
    return formatJenkinsService(userId, jenkins.details, {
      ready: false,
      readyMessage: 'Jenkins is stopped.',
      build: buildDefaultBuildState()
    });
  }

  try {
    await requestJenkins('/api/json', { expectedStatuses: [200], timeoutMs: 8000 });
    const build = await fetchLastBuild();
    return formatJenkinsService(userId, jenkins.details, {
      ready: true,
      readyMessage: 'Jenkins is ready.',
      build
    });
  } catch (error) {
    return formatJenkinsService(userId, jenkins.details, {
      ready: false,
      readyMessage: error.message || 'Jenkins is still starting up.',
      build: buildDefaultBuildState({
        status: 'initializing',
        label: 'Initializing',
        message: error.message || 'Jenkins is still starting up.'
      })
    });
  }
}

async function launchJenkinsService(userId) {
  await ensureImage(env.jenkinsImage);
  const { homeDir } = await ensureJenkinsFilesystem(userId);

  let jenkins = await inspectJenkinsContainer(userId);
  if (jenkins && !jenkins.details?.State?.Running) {
    try {
      await jenkins.container.remove({ force: true });
      jenkins = null;
    } catch (error) {
      throw toApiError(error);
    }
  }

  if (!jenkins) {
    try {
      const runtimeOptions = getJenkinsRuntimeOptions();
      const container = await docker.createContainer({
        name: getJenkinsContainerName(userId),
        Image: env.jenkinsImage,
        Env: [
          'JAVA_OPTS=-Djenkins.install.runSetupWizard=false',
          ...(runtimeOptions ? [`JENKINS_OPTS=${runtimeOptions}`] : []),
          `BYTESKY_JENKINS_ADMIN_USER=${env.jenkinsAdminUser}`,
          `BYTESKY_JENKINS_ADMIN_PASSWORD=${env.jenkinsAdminPassword}`,
          `BYTESKY_JENKINS_JOB_NAME=${env.jenkinsJobName}`,
          `BYTESKY_JENKINS_BUILD_TOKEN=${env.jenkinsBuildToken}`,
          `BYTESKY_PROJECT_DIR=${JENKINS_PROJECT_PATH}`,
          `BYTESKY_GIT_REPO_URL=${env.jenkinsGitRepoUrl}`,
          `BYTESKY_GIT_BRANCH=${env.jenkinsGitBranch}`
        ],
        ExposedPorts: {
          [`${env.jenkinsContainerPort}/tcp`]: {}
        },
        Labels: {
          'bytesky.managed': 'true',
          'bytesky.service': 'jenkins',
          'bytesky.userId': String(userId)
        },
        HostConfig: {
          PortBindings: {
            [`${env.jenkinsContainerPort}/tcp`]: [{
              HostIp: resolveServiceBindHost(env.marketplaceBindHost),
              HostPort: String(env.jenkinsHostPort)
            }]
          },
          Binds: [
            `${homeDir}:/var/jenkins_home`,
            `${JENKINS_BOOTSTRAP_DIR}:/var/jenkins_home/init.groovy.d:ro`,
            `${PROJECT_ROOT}:${JENKINS_PROJECT_PATH}:ro`
          ],
          AutoRemove: false
        }
      });

      await container.start();
      jenkins = await inspectJenkinsContainer(userId);
    } catch (error) {
      throw toApiError(error);
    }
  } else if (!jenkins.details?.State?.Running) {
    try {
      await jenkins.container.start();
      jenkins = await inspectJenkinsContainer(userId);
    } catch (error) {
      throw toApiError(error);
    }
  }

  const service = await getJenkinsServiceStatus(userId);
  return {
    containerId: service.containerId,
    status: service.status,
    service
  };
}

async function stopJenkinsService(userId) {
  const jenkins = await inspectJenkinsContainer(userId);
  if (!jenkins) {
    const service = formatJenkinsService(userId, null, {
      ready: false,
      readyMessage: 'Jenkins is not running.',
      build: buildDefaultBuildState()
    });
    return {
      containerId: '',
      status: service.status,
      service
    };
  }

  try {
    if (jenkins.details?.State?.Running) {
      await jenkins.container.stop({ t: 10 });
    }
  } catch (error) {
    throw toApiError(error);
  }

  const refreshed = await inspectJenkinsContainer(userId);
  const service = formatJenkinsService(userId, refreshed?.details || jenkins.details, {
    ready: false,
    readyMessage: 'Jenkins is stopped.',
    build: buildDefaultBuildState()
  });

  return {
    containerId: service.containerId,
    status: service.status,
    service
  };
}

async function triggerJenkinsBuild(userId) {
  const service = await getJenkinsServiceStatus(userId);
  if (!service.running) {
    throw new ApiError(409, 'Jenkins is not running. Launch the service first.');
  }

  if (!service.ready) {
    await waitForJenkinsReady();
  }

  const crumb = await fetchJenkinsCrumb();
  const headers = crumb ? { [crumb.field]: crumb.value } : {};
  const jobPath = getJenkinsJobPath(env.jenkinsJobName);
  const response = await requestJenkins(`/${jobPath}/build`, {
    method: 'POST',
    query: { token: env.jenkinsBuildToken },
    headers,
    expectedStatuses: [201, 302],
    timeoutMs: 10000
  });

  return {
    jobName: env.jenkinsJobName,
    queueUrl: response.headers.location || '',
    status: 'queued',
    message: 'Jenkins build triggered successfully.'
  };
}

module.exports = {
  getJenkinsServiceStatus,
  launchJenkinsService,
  stopJenkinsService,
  triggerJenkinsBuild
};
