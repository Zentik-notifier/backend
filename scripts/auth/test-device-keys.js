#!/usr/bin/env node

/**
 * Script test: register device should return expected keys and persist expected keys in DB.
 *
 * Assumptions:
 * - Backend is already running and reachable.
 * - DB connection env vars point to the SAME DB used by the running backend.
 *
 * Env:
 * - BASE_URL (default http://localhost:3000/api/v1)
 * - ADMIN_USERS (default "admin")
 * - ADMIN_DEFAULT_PASSWORD (default "admin")
 * - DB_HOST (default localhost)
 * - DB_PORT (default 5432)
 * - DB_USERNAME (default zentik_user)
 * - DB_PASSWORD (default zentik_password)
 * - DB_DATABASE (fallback POSTGRES_DB)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { Client } = require('pg');

const BASE_URL = process.env.BASE_URL || process.env.BASE_URL_A || 'http://localhost:3000/api/v1';
const ADMIN_USERS = process.env.ADMIN_USERS || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'admin';

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 5432);
const DB_USERNAME = process.env.DB_USERNAME || 'zentik_user';
const DB_PASSWORD = process.env.DB_PASSWORD || 'zentik_password';
const DB_DATABASE = process.env.DB_DATABASE || process.env.POSTGRES_DB;

function log(msg) {
  console.log(`[test-device-keys] ${msg}`);
}

function fail(msg, err) {
  console.error(`[test-device-keys] ERROR: ${msg}`);
  if (err) console.error(err);
  process.exit(1);
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

async function loginAdmin() {
  const identifier = ADMIN_USERS.split(',').map((s) => s.trim())[0];
  if (!identifier) throw new Error('No ADMIN_USERS configured');

  const res = await fetchHttp(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: identifier, password: ADMIN_PASSWORD }),
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Login failed: ${res.status} - ${res.data}`);
  }

  const payload = JSON.parse(res.data || '{}');
  if (!payload.accessToken) {
    throw new Error('Login response missing accessToken');
  }

  return payload.accessToken;
}

async function gql(accessToken, query, variables) {
  const res = await fetchHttp(`${BASE_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`GraphQL HTTP error: ${res.status} - ${res.data}`);
  }

  const body = JSON.parse(res.data || '{}');
  if (body.errors?.length) {
    throw new Error(`GraphQL errors: ${JSON.stringify(body.errors)}`);
  }

  return body.data;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function verifyDb(deviceId, expected) {
  if (!DB_DATABASE) {
    throw new Error('DB_DATABASE (or POSTGRES_DB) is required to verify DB');
  }

  const client = new Client({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USERNAME,
    password: DB_PASSWORD,
    database: DB_DATABASE,
  });

  await client.connect();
  try {
    const q = 'SELECT "id","userId","deviceToken","platform","publicKey","privateKey" FROM "user_devices" WHERE "id" = $1';
    const { rows } = await client.query(q, [deviceId]);
    assert(rows.length === 1, `Device not found in DB for id=${deviceId}`);

    const row = rows[0];
    assert(row.userId === expected.userId, `DB userId mismatch: ${row.userId} != ${expected.userId}`);
    assert(row.deviceToken === expected.deviceToken, `DB deviceToken mismatch: ${row.deviceToken} != ${expected.deviceToken}`);
    assert(row.platform === expected.platform, `DB platform mismatch: ${row.platform} != ${expected.platform}`);

    if (expected.platform === 'IOS') {
      // Expected behavior for iOS in UsersService.registerDevice:
      // - publicKey is saved in DB
      // - privateKey is NOT saved in DB (returned once to device)
      assert(typeof row.publicKey === 'string' && row.publicKey.length > 0, 'DB publicKey should be a non-empty string (iOS)');
      assert(row.privateKey === null || row.privateKey === undefined || row.privateKey === '', 'DB privateKey should be empty/null for iOS');
    } else if (expected.platform === 'WEB') {
      // Expected behavior for WEB in UsersService.registerDevice:
      // - publicKey is saved in DB
      // - privateKey is saved in DB
      // - response returns publicKey and strips privateKey
      assert(typeof row.publicKey === 'string' && row.publicKey.length > 0, 'DB publicKey should be a non-empty string (WEB)');
      assert(typeof row.privateKey === 'string' && row.privateKey.length > 0, 'DB privateKey should be a non-empty string (WEB)');
    } else {
      throw new Error(`Unsupported platform for DB verification: ${expected.platform}`);
    }

    return row;
  } finally {
    await client.end();
  }
}

async function runScenario(accessToken, platform) {
  const deviceToken = `script-test-${platform.toLowerCase()}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const input = {
    deviceToken,
    platform,
    deviceName: `${platform} (script)`,
    deviceModel: platform === 'WEB' ? 'Browser' : 'iPhone',
    osVersion: platform === 'WEB' ? '0.0.0' : '15.0',
  };

  // For WEB, include a minimal subscriptionFields payload (optional, but closer to real usage)
  if (platform === 'WEB') {
    input.subscriptionFields = {
      endpoint: `https://example.invalid/push/${deviceToken}`,
      p256dh: 'test-p256dh',
      auth: 'test-auth',
    };
  }

  const data = await gql(
    accessToken,
    `mutation RegisterDevice($input: RegisterDeviceDto!) {
      registerDevice(input: $input) {
        id
        userId
        deviceToken
        platform
        deviceName
        deviceModel
        osVersion
        publicKey
        privateKey
      }
    }`,
    { input },
  );

  const device = data?.registerDevice;
  assert(device && device.id, `Missing registerDevice response (${platform})`);

  assert(device.deviceToken === deviceToken, `Response deviceToken mismatch (${platform})`);
  assert(device.platform === platform, `Response platform mismatch (${platform})`);

  if (platform === 'IOS') {
    assert(typeof device.privateKey === 'string' && device.privateKey.length > 0, 'Response privateKey should be non-empty string (iOS)');
    // Service strips publicKey from iOS response; GraphQL may surface it as null.
    assert(device.publicKey === null || device.publicKey === undefined || device.publicKey === '', 'Response publicKey should be null/empty (iOS)');
  } else if (platform === 'WEB') {
    assert(typeof device.publicKey === 'string' && device.publicKey.length > 0, 'Response publicKey should be non-empty string (WEB)');
    // Service strips privateKey from WEB response; GraphQL may surface it as null.
    assert(device.privateKey === null || device.privateKey === undefined || device.privateKey === '', 'Response privateKey should be null/empty (WEB)');
  }

  const row = await verifyDb(device.id, {
    userId: device.userId,
    deviceToken: device.deviceToken,
    platform: device.platform,
  });

  if (platform === 'IOS') {
    assert(row.publicKey !== device.privateKey, 'DB publicKey should not equal response privateKey (iOS)');
  } else if (platform === 'WEB') {
    assert(row.publicKey === device.publicKey, 'DB publicKey should equal response publicKey (WEB)');
    assert(row.privateKey !== device.publicKey, 'DB privateKey should not equal response publicKey (WEB)');
  }

  log(`✅ OK (${platform}): response keys + DB keys verified`);
}

async function main() {
  log(`BASE_URL=${BASE_URL}`);
  log(`DB=${DB_USERNAME}@${DB_HOST}:${DB_PORT}/${DB_DATABASE || '(missing DB_DATABASE)'}`);

  const accessToken = await loginAdmin();

  await runScenario(accessToken, 'IOS');
  await runScenario(accessToken, 'WEB');

  log('✅ ALL OK');
}

main().catch((err) => fail(err.message || 'Script failed', err));
