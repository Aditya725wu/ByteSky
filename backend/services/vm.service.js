const net = require('net');
const http = require('http');

const docker = require('./docker.service');
const AuditLog = require('../models/AuditLog');
const VirtualMachine = require('../models/VirtualMachine');
const env = require('../config/env');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');

const cleanupTimers = new Map();
const MARKETPLACE_IMAGES = {
  ubuntu: {
    id: 'ubuntu-2204',
    name: 'Ubuntu',
    category: 'compute',
    description: 'General-purpose Linux workspace container for shell access, tooling, and lightweight tasks.',
    icon: '🐧',
    exposeUrl: true,
    internalPort: 3000,
    cmd: [
      'node',
      '-e',
      "require('http').createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('<!doctype html><html><head><title>ByteSky Sandbox</title><style>body{font-family:system-ui;padding:2rem;background:#0f172a;color:#e2e8f0}h1{margin:0 0 1rem;font-size:2rem}p{color:#cbd5e1;max-width:48rem;line-height:1.6}.badge{display:inline-block;margin-bottom:1rem;padding:.35rem .7rem;border-radius:999px;background:#2563eb;color:white;font-size:.85rem}</style></head><body><span class=\"badge\">ByteSky Sandbox</span><h1>Browser VM Ready</h1><p>Your Node.js-based browser sandbox is running and reachable from the web console.</p></body></html>'); }).listen(process.env.PORT || 3000, '0.0.0.0');"
    ],
    env: ['PORT=3000']
  },
  node: {
    id: 'node-18',
    name: 'Node.js',
    category: 'developer-tools',
    description: 'Developer runtime container with Node.js 18 for builds, scripts, and app development.',
    icon: '🟢',
    exposeUrl: false,
    internalPort: null,
    cmd: ['bash', '-lc', 'while true; do sleep 3600; done'],
    env: []
  },
  mongo: {
    id: 'mongo-7',
    name: 'MongoDB',
    category: 'database',
    description: 'Document database service container ready for application storage and local development.',
    icon: '🍃',
    exposeUrl: false,
    internalPort: 27017,
    cmd: null,
    env: []
  },
  redis: {
    id: 'redis-7',
    name: 'Redis',
    category: 'cache',
    description: 'In-memory data store container for caching, queues, and fast key-value workloads.',
    icon: '🧠',
    exposeUrl: false,
    internalPort: 6379,
    cmd: null,
    env: []
  },
  mysql: {
    id: 'mysql-8',
    name: 'MySQL',
    category: 'database',
    description: 'Relational database service container preconfigured for local development use.',
    icon: '🗄️',
    exposeUrl: false,
    internalPort: 3306,
    cmd: null,
    env: ['MYSQL_ROOT_PASSWORD=byteskyroot', 'MYSQL_DATABASE=bytesky']
  }
};
const ALLOWED_IMAGES = new Set(Object.keys(MARKETPLACE_IMAGES));
const DEFAULT_VM_IMAGE = ALLOWED_IMAGES.has(getImageFamily(env.vmImage)) ? env.vmImage : 'ubuntu:22.04';
const DEFAULT_INTERNAL_PORT = 80;

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

  return reason.trim();
}

function toApiError(error, fallbackStatus = 503) {
  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError(error?.statusCode || fallbackStatus, sanitizeDockerError(error));
}

function buildVmUrl(port) {
  const base = new URL(env.vmPublicBaseUrl);
  base.port = String(port);
  return base.toString().replace(/\/$/, '');
}

async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen(port, '0.0.0.0', () => {
      server.close(() => resolve(true));
    });
  });
}

async function findAvailablePort() {
  const activeVms = await VirtualMachine.find({ status: 'running' }).select('port');
  const reservedPorts = new Set(activeVms.map((vm) => vm.port));

  for (let port = env.vmPortRangeStart; port <= env.vmPortRangeEnd; port += 1) {
    if (reservedPorts.has(port)) {
      continue;
    }

    const available = await isPortAvailable(port);
    if (available) {
      return port;
    }
  }

  throw new ApiError(503, 'No available ports for new VMs.');
}

async function recordAuditLog(entry) {
  try {
    await AuditLog.create(entry);
  } catch (error) {
    logger.warn('VM audit log failed', { action: entry.action, error: error.message });
  }
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

function getImageFamily(image) {
  return String(image || '').split(':')[0].toLowerCase();
}

async function listMarketplaceImages() {
  const images = await docker.listImages();
  const available = new Map();

  images.forEach((image) => {
    (image.RepoTags || []).forEach((tag) => {
      const family = getImageFamily(tag);
      if (ALLOWED_IMAGES.has(family)) {
        const spec = MARKETPLACE_IMAGES[family];
        available.set(tag, {
          id: `${spec.id}-${tag.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`,
          name: spec.name,
          image: tag,
          description: spec.description,
          category: spec.category,
          icon: spec.icon,
          status: 'available'
        });
      }
    });
  });

  return Array.from(available.values()).sort((a, b) => a.name.localeCompare(b.name));
}

async function waitForRunningContainer(containerId) {
  const container = docker.getContainer(containerId);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const details = await container.inspect();
    if (details?.State?.Running) {
      return details;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new ApiError(503, 'Container failed to reach running state');
}

async function waitForHttpReady(url, timeoutMs = 120000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const isReady = await new Promise((resolve) => {
      const request = http.get(
        url,
        { timeout: 3000 },
        (response) => {
          response.resume();
          resolve(response.statusCode >= 200 && response.statusCode < 500);
        }
      );

      request.on('timeout', () => {
        request.destroy();
        resolve(false);
      });

      request.on('error', () => resolve(false));
    });

    if (isReady) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new ApiError(504, 'VM container started but the web service did not become ready in time');
}

function getMarketplaceSpec(image) {
  return MARKETPLACE_IMAGES[getImageFamily(image)] || null;
}

function serializeVm(vm) {
  return {
    id: vm._id,
    userId: vm.userId,
    containerId: vm.containerId,
    containerName: vm.containerName,
    image: vm.image,
    port: vm.port,
    status: vm.status,
    url: vm.url,
    accessUrl: vm.url,
    shellReady: vm.status === 'running',
    createdAt: vm.createdAt,
    expiresAt: vm.expiresAt,
    stoppedAt: vm.stoppedAt
  };
}

function clearCleanup(containerId) {
  const timer = cleanupTimers.get(containerId);
  if (timer) {
    clearTimeout(timer);
    cleanupTimers.delete(containerId);
  }
}

function scheduleCleanup(vm) {
  if (!vm?.containerId || !vm?.expiresAt) {
    return;
  }

  clearCleanup(vm.containerId);

  const delay = Math.max(new Date(vm.expiresAt).getTime() - Date.now(), 0);
  const timer = setTimeout(async () => {
    try {
      await deleteVmForUser(vm.userId, vm.containerId, null, {
        status: 'expired',
        reason: 'Auto-deleted after timeout'
      });
    } catch (error) {
      logger.error('VM auto-cleanup failed', { containerId: vm.containerId, error: error.message });
    }
  }, delay);

  cleanupTimers.set(vm.containerId, timer);
}

async function removeContainer(containerId) {
  const container = docker.getContainer(containerId);

  try {
    await container.stop({ t: 5 });
  } catch (error) {
    if (error?.statusCode !== 304 && error?.statusCode !== 404) {
      logger.warn('VM stop failed', { containerId, error: sanitizeDockerError(error) });
    }
  }

  try {
    await container.remove({ force: true });
  } catch (error) {
    if (error?.statusCode !== 404) {
      logger.warn('VM remove failed', { containerId, error: sanitizeDockerError(error) });
    }
  }
}

async function initializeVmLifecycle() {
  const activeVms = await VirtualMachine.find({ status: 'running' });

  for (const vm of activeVms) {
    if (new Date(vm.expiresAt).getTime() <= Date.now()) {
      await deleteVmForUser(vm.userId, vm.containerId, null, {
        status: 'expired',
        reason: 'Expired during startup recovery'
      });
      continue;
    }

    scheduleCleanup(vm);
  }
}

async function listUserVms(userId) {
  const vms = await VirtualMachine.find({
    userId,
    status: 'running',
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });

  return vms.map(serializeVm);
}

async function createVmForUser(userId, payload = {}, req) {
  const activeVmCount = await VirtualMachine.countDocuments({
    userId,
    status: 'running',
    expiresAt: { $gt: new Date() }
  });

  if (activeVmCount >= env.maxContainersPerUser) {
    throw new ApiError(429, `VM limit reached. Max allowed: ${env.maxContainersPerUser}`);
  }

  const image = (payload.image || DEFAULT_VM_IMAGE).trim();
  const spec = getMarketplaceSpec(image);
  if (!spec) {
    throw new ApiError(400, `Unsupported image. Allowed images: ${Array.from(ALLOWED_IMAGES).join(', ')}`);
  }

  const needsPort = Boolean(spec?.internalPort);
  const port = needsPort ? await findAvailablePort() : 0;
  const containerName = `bytesky-vm-${String(userId).slice(-6)}-${Date.now()}`;
  const expiresAt = new Date(Date.now() + env.vmTtlMs);
  const internalPort = spec?.internalPort || env.vmInternalPort || DEFAULT_INTERNAL_PORT;
  const accessUrl = needsPort && spec?.exposeUrl ? buildVmUrl(port) : '';

  await ensureImage(image);

  const vm = await VirtualMachine.create({
    userId,
    containerId: `pending-${Date.now()}`,
    containerName,
    image,
    port,
    internalPort,
    url: accessUrl,
    status: 'creating',
    expiresAt
  });

  try {
    const container = await docker.createContainer({
      name: containerName,
      Image: image,
      ...(spec?.cmd ? { Cmd: spec.cmd } : {}),
      Env: spec?.env || [],
      ...(needsPort
        ? {
            ExposedPorts: {
              [`${internalPort}/tcp`]: {}
            }
          }
        : {}),
      WorkingDir: '/root',
      Tty: false,
      AttachStdin: false,
      AttachStdout: false,
      AttachStderr: false,
      Labels: {
        'bytesky.managed': 'true',
        'bytesky.userId': String(userId),
        'bytesky.image': image,
        'bytesky.kind': 'marketplace-service'
      },
      HostConfig: {
        ...(needsPort
          ? {
              PortBindings: {
                [`${internalPort}/tcp`]: [{ HostIp: '0.0.0.0', HostPort: String(port) }]
              }
            }
          : {}),
        Memory: env.vmMemoryMb * 1024 * 1024,
        NanoCpus: Math.floor(env.vmCpuLimit * 1e9),
        Privileged: false,
        AutoRemove: false,
        NetworkMode: 'bridge',
        PidsLimit: 128
      }
    });

    await container.start();
    await waitForRunningContainer(container.id);
    if (accessUrl) {
      await waitForHttpReady(vm.url);
    }

    vm.containerId = container.id;
    vm.status = 'running';
    await vm.save();

    scheduleCleanup(vm);

    await recordAuditLog({
      user: userId,
      action: 'VM_CREATED',
      resource: 'VirtualMachine',
      details: {
        containerId: container.id,
        image,
        port,
        expiresAt
      },
      ipAddress: req?.ip,
      userAgent: req?.get?.('user-agent')
    });

    logger.info('VM created', { userId, containerId: container.id, port, image });

    return {
      containerId: vm.containerId,
      port: vm.port,
      url: vm.url,
      accessUrl: vm.url,
      vm: serializeVm(vm)
    };
  } catch (error) {
    vm.status = 'error';
    vm.lastError = sanitizeDockerError(error);
    vm.containerId = vm.containerId.startsWith('pending-') ? vm.containerName : vm.containerId;
    await vm.save();
    throw toApiError(error);
  }
}

async function deleteVmForUser(userId, containerId, req, options = {}) {
  if (!containerId) {
    throw new ApiError(400, 'containerId is required');
  }

  const vm = await VirtualMachine.findOne({
    userId,
    containerId
  });

  if (!vm) {
    throw new ApiError(404, 'VM not found');
  }

  clearCleanup(vm.containerId);
  await removeContainer(vm.containerId);

  vm.status = options.status || 'stopped';
  vm.stoppedAt = new Date();
  vm.lastError = options.reason || '';
  await vm.save();

  await recordAuditLog({
    user: userId,
    action: 'VM_DELETED',
    resource: 'VirtualMachine',
    details: {
      containerId: vm.containerId,
      port: vm.port,
      status: vm.status
    },
    ipAddress: req?.ip,
    userAgent: req?.get?.('user-agent')
  });

  logger.info('VM deleted', { userId, containerId: vm.containerId, status: vm.status });

  return {
    containerId: vm.containerId,
    port: vm.port,
    status: vm.status,
    vm: serializeVm(vm)
  };
}

async function execInVmForUser(userId, containerId, payload = {}, req) {
  if (!containerId) {
    throw new ApiError(400, 'containerId is required');
  }

  const command = String(payload.command || '').trim();
  if (!command) {
    throw new ApiError(400, 'command is required');
  }

  const vm = await VirtualMachine.findOne({
    userId,
    containerId,
    status: 'running'
  });

  if (!vm) {
    throw new ApiError(404, 'Running VM not found');
  }

  try {
    const container = docker.getContainer(containerId);
    const exec = await container.exec({
      AttachStdout: true,
      AttachStderr: true,
      Cmd: ['bash', '-lc', command],
      WorkingDir: '/root',
      Tty: false
    });

    const stream = await exec.start({ hijack: true, stdin: false });
    let output = '';

    await new Promise((resolve, reject) => {
      container.modem.demuxStream(
        stream,
        {
          write(chunk) {
            output += chunk.toString();
          }
        },
        {
          write(chunk) {
            output += chunk.toString();
          }
        }
      );

      stream.on('end', resolve);
      stream.on('error', reject);
    });

    const execInspect = await exec.inspect();

    await recordAuditLog({
      user: userId,
      action: 'VM_COMMAND_EXECUTED',
      resource: 'VirtualMachine',
      details: {
        containerId,
        command,
        exitCode: execInspect.ExitCode
      },
      ipAddress: req?.ip,
      userAgent: req?.get?.('user-agent')
    });

    return {
      containerId,
      command,
      exitCode: execInspect.ExitCode,
      output: output.trim()
    };
  } catch (error) {
    throw toApiError(error);
  }
}

module.exports = {
  createVmForUser,
  deleteVmForUser,
  execInVmForUser,
  initializeVmLifecycle,
  listMarketplaceImages,
  listUserVms,
  serializeVm
};
