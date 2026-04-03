const jenkinsService = require('../services/jenkins.service');

async function getStatus(req, res) {
  const service = await jenkinsService.getJenkinsServiceStatus(req.user.id);
  return res.json({ success: true, service });
}

async function launch(req, res) {
  const result = await jenkinsService.launchJenkinsService(req.user.id);
  return res.status(201).json({ success: true, ...result });
}

async function stop(req, res) {
  const result = await jenkinsService.stopJenkinsService(req.user.id);
  return res.json({ success: true, ...result });
}

async function build(req, res) {
  const result = await jenkinsService.triggerJenkinsBuild(req.user.id);
  return res.status(201).json({ success: true, ...result });
}

module.exports = {
  getStatus,
  launch,
  stop,
  build
};
