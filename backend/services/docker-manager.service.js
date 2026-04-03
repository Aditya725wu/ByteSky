const docker = require('./docker.service');
const ApiError = require('../utils/ApiError');

const POSTGRES_IMAGE = 'postgres';
const POSTGRES_NAME_PREFIX = 'bytesky-postgres-';
const POSTGRES_HOST_PORT = 5432;
const POSTGRES_CONTAINER_PORT = 5432;
const POSTGRES_ENV = {
  POSTGRES_USER: 'admin',
  POSTGRES_PASSWORD: 'admin123',
  POSTGRES_DB: 'mydb'
};
const METABASE_IMAGE = 'metabase/metabase';
const METABASE_CONTAINER_NAME = 'metabase';
const METABASE_HOST_PORT = 3005;
const METABASE_CONTAINER_PORT = 3000;
const METABASE_URL = `http://localhost:${METABASE_HOST_PORT}`;
const REDIS_IMAGE = 'redis';
const REDIS_CONTAINER_NAME = 'bytesky-redis';
const REDIS_HOST_PORT = 6379;
const REDIS_CONTAINER_PORT = 6379;
const VM_IMAGE = 'dorowu/ubuntu-desktop-lxde-vnc';
const VM_CONTAINER_NAME = 'vm';
const VM_HOST_PORT = 6080;
const VM_CONTAINER_PORT = 80;
const VM_URL = `http://localhost:${VM_HOST_PORT}`;

function getPostgresContainerName(userId) {
  return `${POSTGRES_NAME_PREFIX}${String(userId).slice(-6)}`;
}

function sanitizeDockerError(error, options = {}) {
  const statusCode = error?.statusCode;
  const reason = error?.reason || error?.json?.message || error?.message || 'Docker operation failed';
  const port = options.port || POSTGRES_HOST_PORT;
  const serviceName = options.serviceName || 'Docker service';

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
    return `Port ${port} is already in use. Stop the existing ${serviceName} container or free that port first.`;
  }

  return reason.trim();
}

function toApiError(error, fallbackStatus = 503, options = {}) {
  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError(error?.statusCode || fallbackStatus, sanitizeDockerError(error, options));
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

function formatContainer(container) {
  const names = (container.Names || []).map((name) => name.replace(/^\//, ''));
  const running = container.State === 'running';

  return {
    id: container.Id,
    name: names[0] || container.Id.slice(0, 12),
    image: container.Image,
    status: running ? 'running' : 'stopped',
    rawStatus: container.Status || '',
    ports: (container.Ports || []).map((port) => ({
      privatePort: port.PrivatePort,
      publicPort: port.PublicPort || null,
      type: port.Type
    }))
  };
}

function formatPostgresService(userId, details) {
  const running = Boolean(details?.State?.Running);
  const containerName = details?.Name?.replace(/^\//, '') || getPostgresContainerName(userId);

  return {
    id: 'postgresql',
    type: 'postgres',
    name: 'PostgreSQL',
    category: 'database',
    image: POSTGRES_IMAGE,
    description: 'Relational database service',
    icon: 'DB',
    containerId: details?.Id || '',
    containerName,
    port: POSTGRES_HOST_PORT,
    hostPort: POSTGRES_HOST_PORT,
    containerPort: POSTGRES_CONTAINER_PORT,
    status: running ? 'running' : 'stopped',
    running,
    connection: {
      host: 'localhost',
      port: POSTGRES_HOST_PORT,
      user: POSTGRES_ENV.POSTGRES_USER,
      password: POSTGRES_ENV.POSTGRES_PASSWORD,
      database: POSTGRES_ENV.POSTGRES_DB
    }
  };
}

function formatMetabaseService(details) {
  const running = Boolean(details?.State?.Running);
  const containerName = details?.Name?.replace(/^\//, '') || METABASE_CONTAINER_NAME;

  return {
    id: 'metabase-analytics',
    type: 'metabase',
    name: 'Metabase Analytics',
    category: 'analytics',
    image: METABASE_IMAGE,
    description: 'Data analytics and dashboard tool',
    icon: 'MB',
    containerId: details?.Id || '',
    containerName,
    port: METABASE_HOST_PORT,
    hostPort: METABASE_HOST_PORT,
    containerPort: METABASE_CONTAINER_PORT,
    url: METABASE_URL,
    status: running ? 'running' : 'stopped',
    running
  };
}

function formatRedisService(details) {
  const running = Boolean(details?.State?.Running);
  const containerName = details?.Name?.replace(/^\//, '') || REDIS_CONTAINER_NAME;

  return {
    id: 'redis-cache',
    type: 'redis',
    name: 'Redis Cache',
    category: 'cache',
    image: REDIS_IMAGE,
    description: 'In-memory cache layer for fast API responses',
    icon: 'RD',
    containerId: details?.Id || '',
    containerName,
    port: REDIS_HOST_PORT,
    hostPort: REDIS_HOST_PORT,
    containerPort: REDIS_CONTAINER_PORT,
    status: running ? 'running' : 'stopped',
    running,
    connection: {
      host: 'localhost',
      port: REDIS_HOST_PORT
    }
  };
}

function formatVmService(details) {
  const running = Boolean(details?.State?.Running);
  const containerName = details?.Name?.replace(/^\//, '') || VM_CONTAINER_NAME;

  return {
    id: 'ubuntu-vm',
    type: 'vm',
    name: 'Ubuntu VM',
    category: 'compute',
    image: VM_IMAGE,
    description: 'Browser-based virtual machine (compute service)',
    icon: 'VM',
    containerId: details?.Id || '',
    containerName,
    port: VM_HOST_PORT,
    hostPort: VM_HOST_PORT,
    containerPort: VM_CONTAINER_PORT,
    url: VM_URL,
    status: running ? 'running' : 'stopped',
    running,
    stateMessage: running ? 'Running' : 'No active VM'
  };
}

async function inspectPostgresContainer(userId) {
  const containerName = getPostgresContainerName(userId);

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
      const usesPostgresImage = String(container.Image || '').toLowerCase().startsWith(POSTGRES_IMAGE);
      const bindsPort5432 = (container.Ports || []).some((port) => port.PublicPort === POSTGRES_HOST_PORT);

      return usesManagedName || (usesPostgresImage && bindsPort5432);
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

async function inspectMetabaseContainer() {
  try {
    const directContainer = docker.getContainer(METABASE_CONTAINER_NAME);
    const directDetails = await directContainer.inspect();
    return { container: directContainer, details: directDetails };
  } catch (error) {
    if (error?.statusCode !== 404) {
      throw toApiError(error, 503, { port: METABASE_HOST_PORT, serviceName: 'Metabase' });
    }
  }

  try {
    const containers = await docker.listContainers({ all: true });
    const existing = containers.find((container) => {
      const names = container.Names || [];
      const usesManagedName = names.some((name) => name.replace(/^\//, '') === METABASE_CONTAINER_NAME);
      const usesMetabaseImage = String(container.Image || '').toLowerCase().startsWith(METABASE_IMAGE.toLowerCase());
      const bindsPort3005 = (container.Ports || []).some((port) => port.PublicPort === METABASE_HOST_PORT);

      return usesManagedName || (usesMetabaseImage && bindsPort3005);
    });

    if (!existing) {
      return null;
    }

    const container = docker.getContainer(existing.Id);
    const details = await container.inspect();
    return { container, details };
  } catch (error) {
    throw toApiError(error, 503, { port: METABASE_HOST_PORT, serviceName: 'Metabase' });
  }
}

async function inspectRedisContainer() {
  try {
    const directContainer = docker.getContainer(REDIS_CONTAINER_NAME);
    const directDetails = await directContainer.inspect();
    return { container: directContainer, details: directDetails };
  } catch (error) {
    if (error?.statusCode !== 404) {
      throw toApiError(error, 503, { port: REDIS_HOST_PORT, serviceName: 'Redis' });
    }
  }

  try {
    const containers = await docker.listContainers({ all: true });
    const existing = containers.find((container) => {
      const names = container.Names || [];
      const usesManagedName = names.some((name) => name.replace(/^\//, '') === REDIS_CONTAINER_NAME);
      const usesRedisImage = String(container.Image || '').toLowerCase().startsWith(REDIS_IMAGE);
      const bindsPort6379 = (container.Ports || []).some((port) => port.PublicPort === REDIS_HOST_PORT);

      return usesManagedName || (usesRedisImage && bindsPort6379);
    });

    if (!existing) {
      return null;
    }

    const container = docker.getContainer(existing.Id);
    const details = await container.inspect();
    return { container, details };
  } catch (error) {
    throw toApiError(error, 503, { port: REDIS_HOST_PORT, serviceName: 'Redis' });
  }
}

async function inspectVmContainer() {
  try {
    const directContainer = docker.getContainer(VM_CONTAINER_NAME);
    const directDetails = await directContainer.inspect();
    return { container: directContainer, details: directDetails };
  } catch (error) {
    if (error?.statusCode !== 404) {
      throw toApiError(error, 503, { port: VM_HOST_PORT, serviceName: 'Ubuntu VM' });
    }
  }

  try {
    const containers = await docker.listContainers({ all: true });
    const existing = containers.find((container) => {
      const names = container.Names || [];
      const usesManagedName = names.some((name) => name.replace(/^\//, '') === VM_CONTAINER_NAME);
      const usesVmImage = String(container.Image || '').toLowerCase().startsWith(VM_IMAGE.toLowerCase());
      const bindsPort6080 = (container.Ports || []).some((port) => port.PublicPort === VM_HOST_PORT);

      return usesManagedName || (usesVmImage && bindsPort6080);
    });

    if (!existing) {
      return null;
    }

    const container = docker.getContainer(existing.Id);
    const details = await container.inspect();
    return { container, details };
  } catch (error) {
    throw toApiError(error, 503, { port: VM_HOST_PORT, serviceName: 'Ubuntu VM' });
  }
}

async function listDockerContainers(userId) {
  try {
    const containers = await docker.listContainers({ all: true });
    const [postgres, metabase, redis, vm] = await Promise.all([
      inspectPostgresContainer(userId),
      inspectMetabaseContainer(),
      inspectRedisContainer(),
      inspectVmContainer()
    ]);

    return {
      containers: containers.map(formatContainer),
      postgres: formatPostgresService(userId, postgres?.details),
      metabase: formatMetabaseService(metabase?.details),
      redis: formatRedisService(redis?.details),
      vm: formatVmService(vm?.details)
    };
  } catch (error) {
    throw toApiError(error);
  }
}

async function runPostgresContainer(userId) {
  await ensureImage(POSTGRES_IMAGE);

  let postgres = await inspectPostgresContainer(userId);
  if (!postgres) {
    const container = await docker.createContainer({
      name: getPostgresContainerName(userId),
      Image: POSTGRES_IMAGE,
      Env: Object.entries(POSTGRES_ENV).map(([key, value]) => `${key}=${value}`),
      ExposedPorts: {
        [`${POSTGRES_CONTAINER_PORT}/tcp`]: {}
      },
      Labels: {
        'bytesky.managed': 'true',
        'bytesky.service': 'postgres',
        'bytesky.userId': String(userId)
      },
      HostConfig: {
        PortBindings: {
          [`${POSTGRES_CONTAINER_PORT}/tcp`]: [{ HostIp: '0.0.0.0', HostPort: String(POSTGRES_HOST_PORT) }]
        },
        AutoRemove: false
      }
    });

    await container.start();
    postgres = await inspectPostgresContainer(userId);
  } else if (!postgres.details?.State?.Running) {
    try {
      await postgres.container.start();
    } catch (error) {
      throw toApiError(error);
    }
    postgres = await inspectPostgresContainer(userId);
  }

  const service = formatPostgresService(userId, postgres?.details);
  return {
    containerId: service.containerId,
    status: service.status,
    service
  };
}

async function runMetabaseContainer() {
  await ensureImage(METABASE_IMAGE);

  let metabase = await inspectMetabaseContainer();
  if (!metabase) {
    try {
      const container = await docker.createContainer({
        name: METABASE_CONTAINER_NAME,
        Image: METABASE_IMAGE,
        ExposedPorts: {
          [`${METABASE_CONTAINER_PORT}/tcp`]: {}
        },
        Labels: {
          'bytesky.managed': 'true',
          'bytesky.service': 'metabase'
        },
        HostConfig: {
          PortBindings: {
            [`${METABASE_CONTAINER_PORT}/tcp`]: [{ HostIp: '0.0.0.0', HostPort: String(METABASE_HOST_PORT) }]
          },
          AutoRemove: false
        }
      });

      await container.start();
      metabase = await inspectMetabaseContainer();
    } catch (error) {
      throw toApiError(error, 503, { port: METABASE_HOST_PORT, serviceName: 'Metabase' });
    }
  } else if (!metabase.details?.State?.Running) {
    try {
      await metabase.container.start();
    } catch (error) {
      throw toApiError(error, 503, { port: METABASE_HOST_PORT, serviceName: 'Metabase' });
    }
    metabase = await inspectMetabaseContainer();
  }

  const service = formatMetabaseService(metabase?.details);
  return {
    containerId: service.containerId,
    status: service.status,
    service
  };
}

async function runRedisContainer() {
  await ensureImage(REDIS_IMAGE);

  let redis = await inspectRedisContainer();
  if (!redis) {
    try {
      const container = await docker.createContainer({
        name: REDIS_CONTAINER_NAME,
        Image: REDIS_IMAGE,
        ExposedPorts: {
          [`${REDIS_CONTAINER_PORT}/tcp`]: {}
        },
        Labels: {
          'bytesky.managed': 'true',
          'bytesky.service': 'redis'
        },
        HostConfig: {
          PortBindings: {
            [`${REDIS_CONTAINER_PORT}/tcp`]: [{ HostIp: '0.0.0.0', HostPort: String(REDIS_HOST_PORT) }]
          },
          AutoRemove: false
        }
      });

      await container.start();
      redis = await inspectRedisContainer();
    } catch (error) {
      throw toApiError(error, 503, { port: REDIS_HOST_PORT, serviceName: 'Redis' });
    }
  } else if (!redis.details?.State?.Running) {
    try {
      await redis.container.start();
    } catch (error) {
      throw toApiError(error, 503, { port: REDIS_HOST_PORT, serviceName: 'Redis' });
    }
    redis = await inspectRedisContainer();
  }

  const service = formatRedisService(redis?.details);
  return {
    containerId: service.containerId,
    status: service.status,
    service
  };
}

async function runVmContainer() {
  await ensureImage(VM_IMAGE);

  let vm = await inspectVmContainer();
  if (!vm) {
    try {
      const container = await docker.createContainer({
        name: VM_CONTAINER_NAME,
        Image: VM_IMAGE,
        ExposedPorts: {
          [`${VM_CONTAINER_PORT}/tcp`]: {}
        },
        Labels: {
          'bytesky.managed': 'true',
          'bytesky.service': 'vm'
        },
        HostConfig: {
          PortBindings: {
            [`${VM_CONTAINER_PORT}/tcp`]: [{ HostIp: '0.0.0.0', HostPort: String(VM_HOST_PORT) }]
          },
          AutoRemove: false
        }
      });

      await container.start();
      vm = await inspectVmContainer();
    } catch (error) {
      throw toApiError(error, 503, { port: VM_HOST_PORT, serviceName: 'Ubuntu VM' });
    }
  } else if (!vm.details?.State?.Running) {
    try {
      await vm.container.start();
    } catch (error) {
      throw toApiError(error, 503, { port: VM_HOST_PORT, serviceName: 'Ubuntu VM' });
    }
    vm = await inspectVmContainer();
  }

  const service = formatVmService(vm?.details);
  return {
    containerId: service.containerId,
    status: service.status,
    service
  };
}

async function startDockerContainer(containerId) {
  if (!containerId) {
    throw new ApiError(400, 'Container id is required');
  }

  try {
    const container = docker.getContainer(containerId);
    const details = await container.inspect();

    if (!details?.State?.Running) {
      await container.start();
    }

    const refreshed = await container.inspect();
    return {
      containerId: refreshed.Id,
      status: refreshed.State?.Running ? 'running' : 'stopped'
    };
  } catch (error) {
    throw toApiError(error);
  }
}

async function stopDockerContainer(containerId) {
  if (!containerId) {
    throw new ApiError(400, 'Container id is required');
  }

  try {
    const container = docker.getContainer(containerId);
    const details = await container.inspect();

    if (details?.State?.Running) {
      await container.stop({ t: 5 });
    }

    const refreshed = await container.inspect();
    return {
      containerId: refreshed.Id,
      status: refreshed.State?.Running ? 'running' : 'stopped'
    };
  } catch (error) {
    throw toApiError(error);
  }
}

module.exports = {
  listDockerContainers,
  runMetabaseContainer,
  runPostgresContainer,
  runRedisContainer,
  runVmContainer,
  startDockerContainer,
  stopDockerContainer
};
