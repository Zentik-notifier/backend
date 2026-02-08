#!/usr/bin/env node

/**
 * E2E tests for Gotify integration:
 * - Publish: message -> Gotify (mock receives POST /message?token=)
 * - Forbidden: user without share cannot link bucket to owner's Gotify system
 *
 * Prerequisites: Backend running, TOKEN (admin). Optional: GOTIFY_MOCK_PORT (default 9998).
 * Run: node scripts/gotify/test-gotify-e2e.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const TOKEN = process.env.TOKEN;
const GOTIFY_MOCK_PORT = Number(process.env.GOTIFY_MOCK_PORT || 9998);
const MOCK_BASE = `http://localhost:${GOTIFY_MOCK_PORT}`;
const HTTP_TIMEOUT_MS = Number(process.env.GOTIFY_E2E_HTTP_TIMEOUT_MS || 25000);
const GOTIFY_E2E_TOKEN = 'e2e-gotify-app-token';

if (!TOKEN) {
  console.error('❌ TOKEN environment variable is required');
  process.exit(1);
}

const { createMockGotifyServer } = require('./mock-gotify-server');
const http = require('http');
const https = require('https');
const { URL } = require('url');

function log(msg) {
  console.log(`[e2e] ${msg}`);
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label || 'Request'} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

async function fetchHttp(url, options = {}) {
  const urlObj = new URL(url);
  const client = urlObj.protocol === 'https:' ? https : http;
  const { timeoutMs = HTTP_TIMEOUT_MS, ...requestOptions } = options;
  const promise = new Promise((resolve, reject) => {
    const req = client.request(url, requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        res.data = data;
        res.status = res.statusCode;
        resolve(res);
      });
    });
    req.on('error', reject);
    if (requestOptions.headers) {
      Object.keys(requestOptions.headers).forEach((k) => req.setHeader(k, requestOptions.headers[k]));
    }
    if (requestOptions.body !== undefined) {
      req.write(typeof requestOptions.body === 'string' ? requestOptions.body : JSON.stringify(requestOptions.body));
    }
    req.end();
  });
  return withTimeout(promise, timeoutMs, `HTTP ${urlObj.pathname || url}`);
}

async function graphql(query, variables, token) {
  const res = await fetchHttp(`${BASE_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const payload = res.data ? JSON.parse(res.data) : {};
  return { status: res.status, payload };
}

async function createExternalNotifySystem(token, baseUrl = MOCK_BASE, opts = {}) {
  const mutation = `
    mutation CreateExternalNotifySystem($input: CreateExternalNotifySystemDto!) {
      createExternalNotifySystem(input: $input) {
        id
        name
        baseUrl
        type
      }
    }
  `;
  const input = {
    type: 'Gotify',
    name: `E2E Gotify ${Date.now()}`,
    baseUrl,
    authToken: opts.authToken ?? GOTIFY_E2E_TOKEN,
  };
  const result = await graphql(mutation, { input }, token);
  if (result.status >= 400 || result.payload.errors) {
    throw new Error(JSON.stringify(result.payload));
  }
  return result.payload.data.createExternalNotifySystem;
}

async function createBucket(token, opts = {}) {
  const mutation = `
    mutation CreateBucket($input: CreateBucketDto!) {
      createBucket(input: $input) {
        id
        name
        externalNotifySystem { id }
        externalSystemChannel
      }
    }
  `;
  const input = {
    name: opts.name || `E2E Bucket ${Date.now()}`,
    generateIconWithInitials: true,
    generateMagicCode: false,
  };
  if (opts.externalNotifySystemId != null) input.externalNotifySystemId = opts.externalNotifySystemId;
  if (opts.externalSystemChannel != null) input.externalSystemChannel = opts.externalSystemChannel;
  if (opts.externalSystemAuthToken != null) input.externalSystemAuthToken = opts.externalSystemAuthToken;
  const result = await graphql(mutation, { input }, token);
  if (result.status >= 400 || result.payload.errors) {
    throw new Error(JSON.stringify(result.payload));
  }
  return result.payload.data.createBucket;
}

async function updateBucketLink(token, bucketId, externalNotifySystemId, externalSystemChannel) {
  const mutation = `
    mutation UpdateBucket($id: String!, $input: UpdateBucketDto!) {
      updateBucket(id: $id, input: $input) {
        id
        externalSystemChannel
      }
    }
  `;
  const result = await graphql(
    mutation,
    {
      id: bucketId,
      input: {
        externalNotifySystemId: externalNotifySystemId || null,
        externalSystemChannel: externalSystemChannel ?? null,
      },
    },
    token,
  );
  return result;
}

async function sendMessage(token, bucketId, title, body) {
  const res = await fetchHttp(`${BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: title || `E2E msg ${Date.now()}`,
      body: body || 'E2E body',
      bucketId,
      deliveryType: 'NORMAL',
    }),
  });
  return { status: res.status, data: res.data };
}

async function registerAndLogin(prefix) {
  const suffix = Date.now().toString(36).slice(-6);
  const username = `${prefix}-${suffix}`.slice(0, 30);
  const email = `${username}@example.com`;
  const password = 'GotifyE2ePass1!';

  const registerRes = await fetchHttp(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username, password }),
  });
  if (registerRes.status < 200 || registerRes.status >= 300) {
    throw new Error(`Register failed: ${registerRes.status} ${registerRes.data}`);
  }

  const loginRes = await fetchHttp(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (loginRes.status < 200 || loginRes.status >= 300) {
    throw new Error(`Login failed: ${loginRes.status}`);
  }
  const loginPayload = JSON.parse(loginRes.data || '{}');
  return { username, jwt: loginPayload.accessToken };
}

async function shareExternalNotifySystem(ownerToken, systemId, username, permissions) {
  const mutation = `
    mutation ShareExternalNotifySystem($input: GrantEntityPermissionInput!) {
      shareExternalNotifySystem(input: $input) {
        id
      }
    }
  `;
  const result = await graphql(
    mutation,
    {
      input: {
        resourceType: 'EXTERNAL_NOTIFY_SYSTEM',
        resourceId: systemId,
        username,
        permissions: permissions || ['READ'],
      },
    },
    ownerToken,
  );
  return result;
}

async function unshareExternalNotifySystem(ownerToken, systemId, username) {
  const mutation = `
    mutation UnshareExternalNotifySystem($input: RevokeEntityPermissionInput!) {
      unshareExternalNotifySystem(input: $input)
    }
  `;
  const result = await graphql(
    mutation,
    {
      input: {
        resourceType: 'EXTERNAL_NOTIFY_SYSTEM',
        resourceId: systemId,
        username,
      },
    },
    ownerToken,
  );
  return result;
}

async function runTests() {
  console.log('\n' + '═'.repeat(80));
  console.log('🧪 GOTIFY E2E TESTS');
  console.log('═'.repeat(80));
  console.log(`BASE_URL=${BASE_URL}  MOCK=${MOCK_BASE}\n`);

  const mock = createMockGotifyServer({ port: GOTIFY_MOCK_PORT });
  await mock.listen();

  mock.events.on('publish', (p) => {
    log(`Mock received publish: ${p.payload?.title || p.payload?.message?.slice(0, 40)}`);
  });

  try {
    log('Creating ExternalNotifySystem (Gotify) and bucket...');
    const system = await createExternalNotifySystem(TOKEN);
    const bucket = await createBucket(TOKEN, {
      externalNotifySystemId: system.id,
      externalSystemChannel: 'e2e-channel',
      externalSystemAuthToken: GOTIFY_E2E_TOKEN,
    });
    const systemId = system.id;
    const bucketId = bucket.id;
    log(`System ${systemId} created, bucket ${bucketId} linked`);

    console.log('\n' + '─'.repeat(80));
    console.log('1) Publish: send message -> mock receives POST /message?token=');
    mock.clearPublished();
    const sendRes = await sendMessage(TOKEN, bucketId, 'E2E Gotify Publish', 'Body from backend');
    if (sendRes.status < 200 || sendRes.status >= 300) {
      throw new Error(`Send message failed: ${sendRes.status} ${sendRes.data}`);
    }
    await new Promise((r) => setTimeout(r, 800));
    const published = mock.published();
    if (published.length === 0) {
      throw new Error('Mock did not receive any publish');
    }
    const lastPub = published[published.length - 1];
    if (lastPub.payload?.message !== 'Body from backend' || lastPub.payload?.title !== 'E2E Gotify Publish') {
      throw new Error(`Unexpected publish: ${JSON.stringify(lastPub)}`);
    }
    if (lastPub.token !== GOTIFY_E2E_TOKEN) {
      throw new Error(`Expected token ${GOTIFY_E2E_TOKEN}, got ${lastPub.token}`);
    }
    console.log('   ✅ Publish test passed: mock received message');

    console.log('\n' + '─'.repeat(80));
    console.log('2) Forbidden: user without share cannot link bucket to Gotify system');
    const userC = await registerAndLogin('gotify-forbid-c');
    const bucketC = await createBucket(userC.jwt);
    const linkC = await updateBucketLink(userC.jwt, bucketC.id, systemId, null);
    if (linkC.status < 400 && !linkC.payload.errors) {
      throw new Error('User C should NOT be able to link bucket (no share)');
    }
    const isForbidden =
      linkC.status === 403 ||
      (linkC.payload.errors && linkC.payload.errors.some((e) => e.message && e.message.includes('permission')));
    if (!isForbidden) {
      throw new Error('Expected 403 or permission error: ' + JSON.stringify(linkC.payload));
    }
    console.log('   ✅ User C correctly forbidden to link bucket');

    console.log('\n' + '─'.repeat(80));
    console.log('3) Sharing: user B can link bucket after share');
    const userB = await registerAndLogin('gotify-share-b');
    const shareRes = await shareExternalNotifySystem(TOKEN, systemId, userB.username, ['READ']);
    if (shareRes.status >= 400 || shareRes.payload.errors) {
      throw new Error('Share failed: ' + JSON.stringify(shareRes.payload));
    }
    const bucketB = await createBucket(userB.jwt);
    const linkB = await updateBucketLink(userB.jwt, bucketB.id, systemId, null);
    if (linkB.status >= 400 || linkB.payload.errors) {
      throw new Error('User B should be able to link bucket after share: ' + JSON.stringify(linkB.payload));
    }
    console.log('   ✅ User B linked bucket after share');

    console.log('\n✅ All Gotify E2E tests passed.');
  } finally {
    await mock.close();
  }
}

const RUN_TIMEOUT_MS = Number(process.env.GOTIFY_E2E_RUN_TIMEOUT_MS || 60000);

function runWithTimeout(fn, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`E2E run timed out after ${ms}ms`)), ms);
    fn().then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

runWithTimeout(runTests, RUN_TIMEOUT_MS).catch((err) => {
  console.error('\n❌ Gotify E2E failed:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
