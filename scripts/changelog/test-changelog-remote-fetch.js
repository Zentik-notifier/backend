#!/usr/bin/env node

/**
 * E2E test for ChangelogRemoteServer setting using two real backend servers.
 *
 * Scenario:
 * - Server B hosts the real changelog data (no ChangelogRemoteServer override).
 * - Server A is configured with ChangelogRemoteServer pointing to Server B.
 * - Reading /changelogs (and /changelogs/:id) on Server A should proxy to Server B
 *   and return the changelogs created on Server B.
 *
 * Preconditions (usually provided by scripts/passthrough/init-e2e-environment.js):
 * - Postgres databases zentik_test_a and zentik_test_b exist.
 * - Two backend servers are running:
 *   - Server A on http://localhost:3000/api/v1
 *   - Server B on http://localhost:4000/api/v1
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const BASE_URL_A = process.env.BASE_URL_A || 'http://localhost:3000/api/v1';
const BASE_URL_B = process.env.BASE_URL_B || 'http://localhost:4000/api/v1';

const ADMIN_USERS = process.env.ADMIN_USERS || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'admin';

function log(msg) {
  console.log(`[changelog-e2e] ${msg}`);
}

async function fetchHttp(url, options = {}) {
  const https = require('https');
  const http = require('http');
  const { URL } = require('url');

  const urlObj = new URL(url);
  const client = urlObj.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        res.data = data;
        res.status = res.statusCode;
        resolve(res);
      });
    });
    req.on('error', reject);

    if (options.headers) {
      Object.keys(options.headers).forEach((key) => {
        req.setHeader(key, options.headers[key]);
      });
    }

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }

    req.end();
  });
}

async function loginAdmin(baseUrl) {
  const identifier = ADMIN_USERS.split(',').map((s) => s.trim())[0];
  if (!identifier) throw new Error('No ADMIN_USERS configured');

  log(`Logging in admin on ${baseUrl} as ${identifier}...`);
  const res = await fetchHttp(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: identifier, password: ADMIN_PASSWORD }),
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Login failed (${baseUrl}): ${res.status} - ${res.data}`);
  }

  const payload = JSON.parse(res.data || '{}');
  if (!payload.accessToken) {
    throw new Error('Login response missing accessToken');
  }
  return payload.accessToken;
}

async function createChangelogOnB(jwtB) {
  log('Creating changelog entry on Server B...');
  const timestamp = Date.now();

  const res = await fetchHttp(`${BASE_URL_B}/changelogs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwtB}`,
    },
    body: JSON.stringify({
      iosVersion: '1.0.0-remote-e2e',
      androidVersion: '1.0.0-remote-e2e',
      uiVersion: '1.0.0-remote-e2e',
      backendVersion: '1.0.0-remote-e2e',
      description: `Remote E2E changelog ${timestamp}`,
    }),
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Failed to create changelog on B: ${res.status} - ${res.data}`);
  }

  const payload = JSON.parse(res.data || '{}');
  if (!payload.id) {
    throw new Error('Changelog creation on B did not return id');
  }

  log(`Created changelog on B with id=${payload.id}`);
  return payload;
}

async function configureChangelogRemoteOnA(jwtA) {
  log(`Configuring ChangelogRemoteServer on Server A to ${BASE_URL_B}...`);

  const query = `
    mutation BatchUpdate($settings: [BatchUpdateSettingInput!]!) {
      batchUpdateServerSettings(settings: $settings) {
        configType
        valueText
      }
    }
  `;

  const variables = {
    settings: [
      {
        configType: 'ChangelogRemoteServer',
        valueText: BASE_URL_B,
      },
    ],
  };

  const res = await fetchHttp(`${BASE_URL_A}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwtA}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`GraphQL error on A: ${res.status} - ${res.data}`);
  }

  const body = JSON.parse(res.data || '{}');
  if (body.errors && body.errors.length) {
    throw new Error(`GraphQL errors on A: ${JSON.stringify(body.errors)}`);
  }

  const updated = body.data?.batchUpdateServerSettings || [];
  const entry = updated.find((s) => s.configType === 'ChangelogRemoteServer');
  if (!entry || entry.valueText !== BASE_URL_B) {
    throw new Error(`ChangelogRemoteServer not updated correctly on A: ${JSON.stringify(updated)}`);
  }

  log('ChangelogRemoteServer configured on A.');
}

async function assertRemoteFetchFromA(changelogOnB) {
  log('Fetching /changelogs from Server A (should proxy to B)...');
  const resList = await fetchHttp(`${BASE_URL_A}/changelogs`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (resList.status !== 200) {
    throw new Error(`/changelogs on A returned status ${resList.status}: ${resList.data}`);
  }

  const list = JSON.parse(resList.data || '[]');
  if (!Array.isArray(list)) {
    throw new Error(`/changelogs on A did not return an array: ${resList.data}`);
  }

  const found = list.find((c) => c.id === changelogOnB.id);
  if (!found) {
    throw new Error(`Changelog created on B (id=${changelogOnB.id}) not found via /changelogs on A`);
  }

  log('Changelog present in list on A. Verifying detail fetch...');

  const resDetail = await fetchHttp(`${BASE_URL_A}/changelogs/${changelogOnB.id}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (resDetail.status !== 200) {
    throw new Error(`/changelogs/${changelogOnB.id} on A returned status ${resDetail.status}: ${resDetail.data}`);
  }

  const detail = JSON.parse(resDetail.data || '{}');
  if (!detail || detail.id !== changelogOnB.id) {
    throw new Error('Detail fetch on A did not return the expected changelog');
  }

  log('Remote changelog fetching from A to B verified successfully.');
}

async function main() {
  try {
    log('Starting ChangelogRemoteServer E2E test...');

    const jwtA = await loginAdmin(BASE_URL_A);
    const jwtB = await loginAdmin(BASE_URL_B);

    const changelogOnB = await createChangelogOnB(jwtB);

    await configureChangelogRemoteOnA(jwtA);

    await assertRemoteFetchFromA(changelogOnB);

    log('✅ All ChangelogRemoteServer E2E checks passed.');
    process.exit(0);
  } catch (err) {
    console.error('❌ ChangelogRemoteServer E2E test failed:', err);
    process.exit(1);
  }
}

main();
