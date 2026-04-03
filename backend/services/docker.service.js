const Docker = require('dockerode');

const env = require('../config/env');

function buildDockerConnectionOptions() {
  if (env.dockerHost) {
    const host = env.dockerHost.replace(/^tcp:\/\//, 'http://');
    const url = new URL(host);

    return {
      host: url.hostname,
      port: Number(url.port || 2375),
      protocol: url.protocol.replace(':', '')
    };
  }

  return {
    socketPath: env.dockerSocketPath
  };
}

const docker = new Docker(buildDockerConnectionOptions());

module.exports = docker;
