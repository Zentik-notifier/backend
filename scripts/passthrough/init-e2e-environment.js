#!/usr/bin/env node

/**
 * Initialize full E2E environment for GitHub Actions:
 * - Ensure Postgres databases for two servers (A and B)
 * - Start two real backend servers on ports 3000 and 4000
 * - Wait for health on both
 * - Create admin access token and a test bucket on Server A
 * - Create System Access Token with `passthrough` scope on Server B
 * - Configure Server A to use Server B as PushNotificationsPassthroughServer
 *
 * Exports the following to $GITHUB_ENV when available:
 * - SERVER_A_PID, SERVER_B_PID (from start-two-backend-servers.js)
 * - TOKEN (access token on Server A)
 * - BUCKET_ID (bucket on Server A)
 * - PUSH_PASSTHROUGH_TOKEN (SAT raw token on Server B)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { spawn } = require('child_process');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 5432);
const DB_USERNAME = process.env.DB_USERNAME || 'zentik_user';
const DB_PASSWORD = process.env.DB_PASSWORD || 'zentik_password';
const POSTGRES_DB = process.env.POSTGRES_DB || 'zentik_test';

const ADMIN_USERS = process.env.ADMIN_USERS || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'admin';

const BASE_URL_A = process.env.BASE_URL_A || 'http://localhost:3000/api/v1';
const BASE_URL_B = process.env.BASE_URL_B || 'http://localhost:4000/api/v1';

function log(msg) {
  console.log(`[e2e-init] ${msg}`);
}

async function ensureDatabases() {
  log(`Ensuring databases zentik_test_a and zentik_test_b on ${DB_HOST}:${DB_PORT}...`);
  const client = new Client({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USERNAME,
    password: DB_PASSWORD,
    database: POSTGRES_DB,
  });

  await client.connect();
  try {
    await client.query('CREATE DATABASE zentik_test_a;').catch(() => {});
    await client.query('CREATE DATABASE zentik_test_b;').catch(() => {});
  } finally {
    await client.end();
  }
  log('Databases ready.');
}

function runNodeScript(scriptPath, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptPath], {
      cwd: path.join(__dirname, '../..'),
      env: {
        ...process.env,
        ...extraEnv,
      },
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(scriptPath)} exited with code ${code}`));
    });
    child.on('error', reject);
  });
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
  return payload.accessToken;
}

async function createAccessTokenOnA(jwt) {
  log('Creating admin access token on Server A...');
  const res = await fetchHttp(`${BASE_URL_A}/access-tokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      name: 'CI Admin Token',
      storeToken: true,
      scopes: [],
    }),
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Failed to create access token on A: ${res.status} - ${res.data}`);
  }

  const payload = JSON.parse(res.data || '{}');
  if (!payload.token) {
    throw new Error('Access token response on A is missing token field');
  }
  return payload.token;
}

async function createBucketOnA(accessToken) {
  log('Creating test bucket with magic code on Server A...');
  const timestamp = Date.now();
  const res = await fetchHttp(`${BASE_URL_A}/buckets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      name: `CI Test Bucket ${timestamp}`,
      description: 'Bucket for CI tests',
      generateIconWithInitials: true,
      generateMagicCode: true,
    }),
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Failed to create bucket on A: ${res.status} - ${res.data}`);
  }

  const payload = JSON.parse(res.data || '{}');
  const bucketId = payload.id;
  if (!bucketId) {
    throw new Error('Bucket creation on A did not return id');
  }

  // Optional: verify magic code exists via GraphQL
  try {
    await new Promise((r) => setTimeout(r, 2000));
    const gqlRes = await fetchHttp(`${BASE_URL_A}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query:
          'query GetBucket($id: String!) { bucket(id: $id) { id name userBucket { magicCode } } }',
        variables: { id: bucketId },
      }),
    });

    const gqlPayload = JSON.parse(gqlRes.data || '{}');
    const magicCode = gqlPayload.data?.bucket?.userBucket?.magicCode;
    if (magicCode) {
      log(`Bucket magic code present: ${String(magicCode).slice(0, 8)}...`);
    } else {
      log('Warning: bucket magic code not found yet; some tests may rely on it.');
    }
  } catch (err) {
    log(`Warning: failed to verify magic code: ${err.message}`);
  }

  return bucketId;
}

function appendEnv(key, value) {
  if (!value) return;
  if (process.env.GITHUB_ENV) {
    fs.appendFileSync(process.env.GITHUB_ENV, `${key}=${value}\n`);
  }
  process.env[key] = value;
}

async function createSystemPassthroughTokenOnB() {
  log('Creating passthrough System Access Token on Server B...');

  const jwt = await loginAdmin(BASE_URL_B);

  const query = `
    mutation CreateSystemToken($scopes: [String!]) {
      createSystemToken(maxCalls: 1000, scopes: $scopes) {
        id
        rawToken
      }
    }
  `;

  const res = await fetchHttp(`${BASE_URL_B}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ query, variables: { scopes: ['passthrough'] } }),
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`GraphQL error on B: ${res.status} - ${res.data}`);
  }

  const payload = JSON.parse(res.data || '{}');
  if (payload.errors) {
    throw new Error(`GraphQL errors on B: ${JSON.stringify(payload.errors)}`);
  }

  const token = payload.data?.createSystemToken;
  if (!token?.rawToken) {
    throw new Error('No rawToken returned from createSystemToken on B');
  }

  log(`Created System Access Token on B (id=${token.id})`);
  appendEnv('PUSH_PASSTHROUGH_TOKEN', token.rawToken);
  return token.rawToken;
}

async function configurePassthroughSettingsOnA(passthroughToken) {
  log('Configuring passthrough settings on Server A...');

  const jwt = await loginAdmin(BASE_URL_A);

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
        configType: 'PushNotificationsPassthroughServer',
        valueText: BASE_URL_B,
      },
      {
        configType: 'PushPassthroughToken',
        valueText: passthroughToken,
      },
    ],
  };

  const res = await fetchHttp(`${BASE_URL_A}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`GraphQL error on A: ${res.status} - ${res.data}`);
  }

  const payload = JSON.parse(res.data || '{}');
  if (payload.errors) {
    throw new Error(`GraphQL errors on A: ${JSON.stringify(payload.errors)}`);
  }

  const updated = payload.data?.batchUpdateServerSettings;
  log(`Updated passthrough settings on A: ${JSON.stringify(updated)}`);
}

async function main() {
  log('Initializing E2E environment...');

  // Ensure JWT secret
  if (!process.env.JWT_SECRET) {
    const crypto = require('crypto');
    const secret = crypto.randomBytes(32).toString('hex');
    appendEnv('JWT_SECRET', secret);
    log('Generated random JWT_SECRET');
  }

  await ensureDatabases();

  // Start two real backend servers (A and B) and wait for health
  await runNodeScript('scripts/passthrough/start-two-backend-servers.js', {
    DB_TYPE: process.env.DB_TYPE || 'postgres',
    DB_HOST: DB_HOST,
    DB_PORT: String(DB_PORT),
    DB_USERNAME,
    DB_PASSWORD,
    DB_SSL: process.env.DB_SSL || 'false',
    DB_SYNCHRONIZE: process.env.DB_SYNCHRONIZE || 'true',
    DB_DROP_SCHEMA: process.env.DB_DROP_SCHEMA || 'false',
    ADMIN_USERS,
    ADMIN_DEFAULT_PASSWORD: ADMIN_PASSWORD,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    NODE_ENV: process.env.NODE_ENV || 'test',
    DB_NAME_A: 'zentik_test_a',
    DB_NAME_B: 'zentik_test_b',
  });

  log('Servers A and B are up. Creating admin token and bucket on A...');

  // Admin token + bucket on Server A
  const adminJwtA = await loginAdmin(BASE_URL_A);
  const accessToken = await createAccessTokenOnA(adminJwtA);
  const bucketId = await createBucketOnA(accessToken);

  appendEnv('TOKEN', accessToken);
  appendEnv('BUCKET_ID', bucketId);

  const passthroughToken = await createSystemPassthroughTokenOnB();
  await configurePassthroughSettingsOnA(passthroughToken);

  log('E2E environment initialization completed successfully.');
}

main().catch((err) => {
  console.error('[e2e-init] FAILED:', err);
  process.exit(1);
});
