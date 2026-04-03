const vmService = require('../services/vm.service');

async function createVm(req, res, next) {
  try {
    const result = await vmService.createVmForUser(req.user.id, req.body || {}, req);
    return res.status(201).json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
}

async function deleteVm(req, res, next) {
  try {
    const result = await vmService.deleteVmForUser(req.user.id, req.params.id, req);
    return res.json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
}

async function listActiveVms(req, res, next) {
  try {
    const vms = await vmService.listUserVms(req.user.id);
    return res.json({ success: true, vms });
  } catch (error) {
    return next(error);
  }
}

async function execInVm(req, res, next) {
  try {
    const result = await vmService.execInVmForUser(req.user.id, req.params.id, req.body || {}, req);
    return res.json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createVm,
  deleteVm,
  execInVm,
  listActiveVms
};
