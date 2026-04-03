const env = require('../config/env');

function normalizeBaseUrl(url = '') {
  return String(url).trim().replace(/\/+$/, '');
}

const keycloakConfig = {
  baseUrl: normalizeBaseUrl(env.keycloakBaseUrl),
  realm: env.keycloakRealm,
  adminRealm: env.keycloakAdminRealm,
  clientId: env.keycloakClientId,
  clientSecret: env.keycloakClientSecret,
  username: env.keycloakAdminUsername,
  password: env.keycloakAdminPassword
};

let cachedToken = null;
let cachedTokenExpiresAt = 0;

function ensureConfigured() {
  if (!keycloakConfig.baseUrl) {
    throw new Error('Keycloak base URL is not configured');
  }

  if (!keycloakConfig.realm) {
    throw new Error('Keycloak realm is not configured');
  }

  if (!keycloakConfig.clientId) {
    throw new Error('Keycloak client ID is not configured');
  }

  const hasPasswordGrant = keycloakConfig.username && keycloakConfig.password;
  const hasClientCredentials = keycloakConfig.clientSecret;

  if (!hasPasswordGrant && !hasClientCredentials) {
    throw new Error('Keycloak admin credentials are not configured');
  }
}

async function requestAdminToken(forceRefresh = false) {
  ensureConfigured();

  const now = Date.now();
  if (!forceRefresh && cachedToken && cachedTokenExpiresAt > now + 30000) {
    return cachedToken;
  }

  const tokenUrl = `${keycloakConfig.baseUrl}/realms/${encodeURIComponent(keycloakConfig.adminRealm)}/protocol/openid-connect/token`;
  const body = new URLSearchParams({
    client_id: keycloakConfig.clientId
  });

  if (keycloakConfig.username && keycloakConfig.password) {
    body.set('grant_type', 'password');
    body.set('username', keycloakConfig.username);
    body.set('password', keycloakConfig.password);
    if (keycloakConfig.clientSecret) {
      body.set('client_secret', keycloakConfig.clientSecret);
    }
  } else {
    body.set('grant_type', 'client_credentials');
    body.set('client_secret', keycloakConfig.clientSecret);
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error_description || payload.error || 'Unable to authenticate with Keycloak';
    throw new Error(message);
  }

  cachedToken = payload.access_token;
  cachedTokenExpiresAt = now + (Number(payload.expires_in || 60) * 1000);
  return cachedToken;
}

async function keycloakRequest(method, resourcePath, body) {
  const performRequest = async (forceRefresh = false) => {
    const accessToken = await requestAdminToken(forceRefresh);
    const response = await fetch(`${keycloakConfig.baseUrl}${resourcePath}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });

    if (response.status === 401 && !forceRefresh) {
      return performRequest(true);
    }

    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (_error) {
        payload = text;
      }
    }

    if (!response.ok) {
      const message = typeof payload === 'string'
        ? payload
        : payload?.errorMessage || payload?.error || payload?.message || `Keycloak request failed (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return payload;
  };

  return performRequest(false);
}

function mapRoleToPolicy(role) {
  return {
    id: role.id || role.name,
    _id: role.id || role.name,
    name: role.name,
    description: role.description || 'Keycloak realm role',
    source: 'keycloak',
    composite: Boolean(role.composite),
    clientRole: Boolean(role.clientRole),
    containerId: role.containerId || null,
    statements: []
  };
}

async function listRealmRoles() {
  const roles = await keycloakRequest(
    'GET',
    `/admin/realms/${encodeURIComponent(keycloakConfig.realm)}/roles`
  );

  return Array.isArray(roles)
    ? roles
      .map(mapRoleToPolicy)
      .sort((a, b) => a.name.localeCompare(b.name))
    : [];
}

async function getRealmRole(roleName) {
  const role = await keycloakRequest(
    'GET',
    `/admin/realms/${encodeURIComponent(keycloakConfig.realm)}/roles/${encodeURIComponent(roleName)}`
  );

  return mapRoleToPolicy(role);
}

async function createRealmRole(roleName) {
  const trimmedName = String(roleName || '').trim();
  if (!trimmedName) {
    throw new Error('Role name is required');
  }

  await keycloakRequest(
    'POST',
    `/admin/realms/${encodeURIComponent(keycloakConfig.realm)}/roles`,
    { name: trimmedName }
  );

  return getRealmRole(trimmedName);
}

async function deleteRealmRole(roleName) {
  const trimmedName = String(roleName || '').trim();
  if (!trimmedName) {
    throw new Error('Role name is required');
  }

  await keycloakRequest(
    'DELETE',
    `/admin/realms/${encodeURIComponent(keycloakConfig.realm)}/roles/${encodeURIComponent(trimmedName)}`
  );
}

module.exports = {
  listRealmRoles,
  createRealmRole,
  deleteRealmRole
};
