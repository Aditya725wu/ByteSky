const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

function parseBaseUrl(baseUrl) {
  try {
    return new URL(baseUrl);
  } catch (_error) {
    return new URL('http://localhost');
  }
}

function isLoopbackHostname(hostname) {
  return LOOPBACK_HOSTNAMES.has(String(hostname || '').toLowerCase());
}

function normalizePath(pathValue, options = {}) {
  const { trailingSlash = true } = options;
  const trimmed = String(pathValue || '/').trim();

  if (!trimmed || trimmed === '/') {
    return '/';
  }

  const cleaned = trimmed.replace(/^\/+|\/+$/g, '');
  return `/${cleaned}${trailingSlash ? '/' : ''}`;
}

function normalizePrefix(pathValue) {
  return normalizePath(pathValue, { trailingSlash: false });
}

function resolveMarketplaceUrlMode(mode, baseUrl) {
  const normalized = String(mode || 'auto').trim().toLowerCase();

  if (normalized === 'path' || normalized === 'port') {
    return normalized;
  }

  const parsed = parseBaseUrl(baseUrl);
  return isLoopbackHostname(parsed.hostname) ? 'port' : 'path';
}

function buildMarketplaceServiceUrl({ baseUrl, port, path = '/', mode = 'auto', protocol } = {}) {
  const parsed = parseBaseUrl(baseUrl);
  parsed.search = '';
  parsed.hash = '';

  const effectiveProtocol = protocol || parsed.protocol || (Number(port) === 443 ? 'https:' : 'http:');
  parsed.protocol = effectiveProtocol;

  if (resolveMarketplaceUrlMode(mode, baseUrl) === 'path' && path) {
    parsed.port = '';
    parsed.pathname = normalizePath(path);
    return parsed.toString();
  }

  parsed.port = port ? String(port) : '';
  parsed.pathname = '/';
  return parsed.toString().replace(/\/$/, '');
}

function buildLoopbackServiceUrl(port, path = '/') {
  const parsed = new URL('http://127.0.0.1');
  parsed.port = String(port);
  parsed.pathname = normalizePath(path);
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}

function getMarketplaceServiceHost(baseUrl) {
  return parseBaseUrl(baseUrl).hostname || 'localhost';
}

function resolveServiceBindHost(bindHost) {
  return String(bindHost || '0.0.0.0').trim() || '0.0.0.0';
}

module.exports = {
  buildLoopbackServiceUrl,
  buildMarketplaceServiceUrl,
  getMarketplaceServiceHost,
  isLoopbackHostname,
  normalizePath,
  normalizePrefix,
  parseBaseUrl,
  resolveMarketplaceUrlMode,
  resolveServiceBindHost
};
