const dockerManagerService = require('../services/docker-manager.service');

async function listContainers(req, res) {
  const result = await dockerManagerService.listDockerContainers(req.user.id);
  return res.json({ success: true, ...result });
}

async function runPostgres(req, res) {
  const result = await dockerManagerService.runPostgresContainer(req.user.id);
  return res.status(201).json({ success: true, ...result });
}

async function runMetabase(_req, res) {
  const result = await dockerManagerService.runMetabaseContainer();
  return res.status(201).json({ success: true, ...result });
}

async function runRedis(_req, res) {
  const result = await dockerManagerService.runRedisContainer();
  return res.status(201).json({ success: true, ...result });
}

async function runVm(_req, res) {
  const result = await dockerManagerService.runVmContainer();
  return res.status(201).json({ success: true, ...result });
}

async function startContainer(req, res) {
  const result = await dockerManagerService.startDockerContainer(req.params.id);
  return res.json({ success: true, ...result });
}

async function stopContainer(req, res) {
  const result = await dockerManagerService.stopDockerContainer(req.params.id);
  return res.json({ success: true, ...result });
}

module.exports = {
  listContainers,
  runMetabase,
  runPostgres,
  runRedis,
  runVm,
  startContainer,
  stopContainer
};
