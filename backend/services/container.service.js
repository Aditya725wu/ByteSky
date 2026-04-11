const docker = require('./docker.service');
const vmService = require('./vm.service');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const APACHE_IMAGE = 'httpd';
const APACHE_NAME_PREFIX = 'bytesky-apache-';
const APACHE_HOST_PORT = 8080;
const APACHE_CONTAINER_PORT = 80;
function parsePublicBaseUrl(baseUrl) {
  try {
    return new URL(baseUrl);
  } catch (_error) {
    return new URL('http://localhost');
  }
}

function buildPublicServiceUrl(baseUrl, port, options = {}) {
  const parsed = parsePublicBaseUrl(baseUrl);
  parsed.protocol = options.protocol || (port === 443 ? 'https:' : 'http:');
  parsed.port = String(port);
  parsed.pathname = '/';
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

function getApacheContainerName(userId) {
  return `${APACHE_NAME_PREFIX}${String(userId).slice(-6)}`;
}

function sanitizeDockerError(error) {
  const statusCode = error?.statusCode;
  const reason = error?.reason || error?.json?.message || error?.message || 'Docker operation failed';

  if (statusCode === 404) {
    return 'Docker resource not found.';
  }

  if (reason.includes('Cannot connect to the Docker daemon') || reason.includes('connect ENOENT')) {
    return 'Docker is not running or the Docker daemon is unavailable.';
  }

  if (reason.toLowerCase().includes('permission denied')) {
    return 'Docker permission denied for the backend process.';
  }

  if (reason.toLowerCase().includes('port is already allocated')) {
    return `Port ${APACHE_HOST_PORT} is already in use. Stop the existing Apache container or free that port first.`;
  }

  return reason.trim();
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

async function inspectApacheContainer(userId) {
  const containerName = getApacheContainerName(userId);

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
      const usesApacheImage = String(container.Image || '').toLowerCase().startsWith(APACHE_IMAGE);
      const bindsPort8080 = (container.Ports || []).some((port) => port.PublicPort === APACHE_HOST_PORT);

      return usesManagedName || (usesApacheImage && bindsPort8080);
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

function formatApacheService(userId, details) {
  const running = Boolean(details?.State?.Running);
  const containerName = details?.Name?.replace(/^\//, '') || getApacheContainerName(userId);
  const url = buildPublicServiceUrl(env.containerPublicBaseUrl || env.appBaseUrl, APACHE_HOST_PORT);

  return {
    id: 'apache-server',
    name: 'Apache Server',
    category: 'web',
    image: APACHE_IMAGE,
    description: 'Web hosting server',
    icon: '🌐',
    containerId: details?.Id || '',
    containerName,
    url,
    hostPort: APACHE_HOST_PORT,
    containerPort: APACHE_CONTAINER_PORT,
    status: running ? 'Running' : 'Stopped',
    running
  };
}

async function getActiveSessions(userId) {
  const vms = await vmService.listUserVms(userId);

  return vms.map((vm) => ({
    id: vm.id,
    containerId: vm.containerId,
    containerName: vm.containerName,
    image: vm.image,
    hostPort: vm.port,
    port: vm.port,
    url: vm.url,
    status: vm.status,
    expiresAt: vm.expiresAt,
    createdAt: vm.createdAt
  }));
}

async function getMarketplaceCatalog() {
  return vmService.listMarketplaceImages();
}

async function getApacheServiceStatus(userId) {
  const apache = await inspectApacheContainer(userId);
  return formatApacheService(userId, apache?.details);
}

async function launchApacheService(userId) {
  await ensureImage(APACHE_IMAGE);

  let apache = await inspectApacheContainer(userId);
  if (!apache) {
    const container = await docker.createContainer({
      name: getApacheContainerName(userId),
      Image: APACHE_IMAGE,
      ExposedPorts: {
        [`${APACHE_CONTAINER_PORT}/tcp`]: {}
      },
      Labels: {
        'bytesky.managed': 'true',
        'bytesky.service': 'apache',
        'bytesky.userId': String(userId)
      },
      HostConfig: {
        PortBindings: {
          [`${APACHE_CONTAINER_PORT}/tcp`]: [{ HostIp: '0.0.0.0', HostPort: String(APACHE_HOST_PORT) }]
        },
        AutoRemove: false
      }
    });

    await container.start();
    apache = await inspectApacheContainer(userId);
    return formatApacheService(userId, apache?.details);
  }

  if (!apache.details?.State?.Running) {
    try {
      await apache.container.start();
    } catch (error) {
      throw toApiError(error);
    }
    apache = await inspectApacheContainer(userId);
  }

  return formatApacheService(userId, apache?.details);
}

async function stopApacheService(userId) {
  const apache = await inspectApacheContainer(userId);
  if (!apache) {
    return formatApacheService(userId, null);
  }

  if (apache.details?.State?.Running) {
    try {
      await apache.container.stop({ t: 5 });
    } catch (error) {
      if (error?.statusCode !== 304) {
        throw toApiError(error);
      }
    }
  }

  const refreshed = await inspectApacheContainer(userId);
  return formatApacheService(userId, refreshed?.details);
}

async function startContainerForUser(userId, payload, req) {
  const result = await vmService.createVmForUser(userId, payload || {}, req);

  return {
    containerId: result.containerId,
    url: result.url,
    accessUrl: result.accessUrl,
    session: {
      ...result.vm,
      hostPort: result.port
    }
  };
}

async function stopContainerForUser(userId, payload, req) {
  const result = await vmService.deleteVmForUser(userId, payload?.containerId || payload?.sessionId, req);

  return {
    containerId: result.containerId,
    session: {
      ...result.vm,
      hostPort: result.port
    }
  };
}

async function initializeContainerLifecycle() {
  await vmService.initializeVmLifecycle();
}

module.exports = {
  getApacheServiceStatus,
  getActiveSessions,
  getMarketplaceCatalog,
  initializeContainerLifecycle,
  launchApacheService,
  startContainerForUser,
  stopApacheService,
  stopContainerForUser
};
