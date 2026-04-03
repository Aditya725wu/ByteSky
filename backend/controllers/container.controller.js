const containerService = require('../services/container.service');

async function getActiveSessions(req, res, next) {
  try {
    const sessions = await containerService.getActiveSessions(req.user.id);
    return res.json({ success: true, sessions });
  } catch (error) {
    return next(error);
  }
}

async function getMarketplaceCatalog(_req, res, next) {
  try {
    const services = await containerService.getMarketplaceCatalog();
    return res.json({ success: true, services });
  } catch (error) {
    return next(error);
  }
}

async function getApacheStatus(req, res, next) {
  try {
    const service = await containerService.getApacheServiceStatus(req.user.id);
    return res.json({ success: true, service });
  } catch (error) {
    return next(error);
  }
}

async function launchApache(req, res, next) {
  try {
    const service = await containerService.launchApacheService(req.user.id);
    return res.status(201).json({ success: true, service });
  } catch (error) {
    return next(error);
  }
}

async function startContainer(req, res, next) {
  try {
    const result = await containerService.startContainerForUser(req.user.id, req.body || {}, req);
    return res.status(201).json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
}

async function stopApache(req, res, next) {
  try {
    const service = await containerService.stopApacheService(req.user.id);
    return res.json({ success: true, service });
  } catch (error) {
    return next(error);
  }
}

async function stopContainer(req, res, next) {
  try {
    const result = await containerService.stopContainerForUser(req.user.id, req.body || {}, req);
    return res.json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getApacheStatus,
  getActiveSessions,
  getMarketplaceCatalog,
  launchApache,
  startContainer,
  stopApache,
  stopContainer
};
