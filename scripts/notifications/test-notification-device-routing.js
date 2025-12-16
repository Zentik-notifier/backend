#!/usr/bin/env node

/**
 * E2E script (GitHub Actions job: test-scripts)
 *
 * Goal:
 * - Create multiple devices for primary user
 * - Create a secondary user + at least one device
 * - Send messages to bucket types (private/user, public, admin if present)
 * - Assert notifications are created for the expected devices and buckets
 *
 * Env:
 * - BASE_URL  (default: http://localhost:3000/api/v1)
 * - TOKEN     (required, access token for primary user)
 * - BUCKET_ID (required, private/user bucket id for primary user)
 *
 * Optional:
 * - NOTIF_INITIAL_DELAY_MS (default 1200)
 * - NOTIF_POLL_INTERVAL_MS (default 500)
 * - NOTIF_TIMEOUT_MS       (default 20000)
 */

const request = require('supertest');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const TOKEN = process.env.TOKEN;
const BUCKET_ID = process.env.BUCKET_ID;

const NOTIF_INITIAL_DELAY_MS = Number(process.env.NOTIF_INITIAL_DELAY_MS || 2000);
const NOTIF_POLL_INTERVAL_MS = Number(process.env.NOTIF_POLL_INTERVAL_MS || 1500);
const NOTIF_TIMEOUT_MS = Number(process.env.NOTIF_TIMEOUT_MS || 20000);

if (!TOKEN) {
  console.error('❌ TOKEN environment variable is required');
  process.exit(1);
}

if (!BUCKET_ID) {
  console.error('❌ BUCKET_ID environment variable is required');
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function graphqlRequest(query, variables = {}, authToken, extraHeaders = {}) {
  const maxRetries = 6;
  let attempt = 0;

  while (true) {
    const res = await fetchHttp(`${BASE_URL}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        ...extraHeaders,
      },
      body: JSON.stringify({ query, variables }),
    });

    const payload = JSON.parse(res.data || '{}');
    const errors = payload?.errors || null;

    const isThrottled =
      res.status === 429 ||
      (Array.isArray(errors) && errors.some((e) => String(e?.message || '').includes('ThrottlerException')));

    if (isThrottled && attempt < maxRetries) {
      const backoffMs = Math.min(1500 * Math.pow(2, attempt), 12000);
      await sleep(backoffMs);
      attempt++;
      continue;
    }

    if (res.status < 200 || res.status >= 300) {
      throw new Error(`GraphQL HTTP error: ${res.status} - ${res.data || res.statusText}`);
    }

    if (errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(errors)}`);
    }

    return payload.data;
  }
}

async function registerDevice(authToken, input) {
  const mutation = `
    mutation RegisterDevice($input: RegisterDeviceDto!) {
      registerDevice(input: $input) {
        id
        platform
        deviceName
        deviceToken
      }
    }
  `;

  const data = await graphqlRequest(mutation, { input }, authToken);
  return data.registerDevice;
}

async function listUserDevices(authToken) {
  const query = `
    query UserDevices {
      userDevices {
        id
        platform
        deviceName
        deviceToken
      }
    }
  `;

  const data = await graphqlRequest(query, {}, authToken);
  return data.userDevices || [];
}

async function ensureDevice(authToken, desired) {
  const devices = await listUserDevices(authToken);
  const existing = devices.find((d) => d.deviceToken === desired.deviceToken);
  if (existing) return existing;
  return registerDevice(authToken, desired);
}

async function createPublicBucket() {
  console.log('\n📦 Creating public bucket for notification routing tests...');

  const res = await fetchHttp(`${BASE_URL}/buckets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({
      name: `E2E Public Bucket (notif routing) ${Date.now()}`,
      description: 'Public bucket for notification routing tests',
      isPublic: true,
      isProtected: false,
      generateIconWithInitials: true,
      generateMagicCode: true,
    }),
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Failed to create public bucket: ${res.status} - ${res.data}`);
  }

  const payload = JSON.parse(res.data || '{}');
  if (!payload?.id) throw new Error('Public bucket creation did not return id');

  console.log(`   ✅ Public bucket created: ${payload.id}`);
  return payload.id;
}

async function findAdminBucketId() {
  const query = `
    query Buckets {
      buckets {
        id
        isAdmin
        isPublic
      }
    }
  `;

  const data = await graphqlRequest(query, {}, TOKEN);
  const buckets = data?.buckets || [];
  const admin = buckets.find((b) => b.isAdmin);
  return admin?.id || null;
}

async function registerSecondaryUser() {
  const username = `e2e-notif-user-${Date.now()}`;
  const email = `${username}@example.com`;
  const password = 'E2eNotifUser1!';

  console.log(`\n👤 Registering secondary user: ${email}...`);

  const registerRes = await fetchHttp(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username, password }),
  });

  if (registerRes.status < 200 || registerRes.status >= 300) {
    throw new Error(`Failed to register secondary user: ${registerRes.status} - ${registerRes.data}`);
  }

  console.log('   ✅ Secondary user registered');

  console.log('   🔑 Logging in secondary user...');
  const loginRes = await fetchHttp(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (loginRes.status < 200 || loginRes.status >= 300) {
    throw new Error(`Failed to login secondary user: ${loginRes.status} - ${loginRes.data}`);
  }

  const loginPayload = JSON.parse(loginRes.data || '{}');
  const jwt = loginPayload.accessToken;
  if (!jwt) throw new Error('Secondary user login did not return accessToken');

  console.log('   ✅ Secondary user JWT obtained');

  return { username, email, jwt };
}

async function shareBucketWithUser(username) {
  const mutation = `
    mutation ShareBucket($input: GrantEntityPermissionInput!) {
      shareBucket(input: $input) {
        id
        permissions
      }
    }
  `;

  const input = {
    resourceType: 'BUCKET',
    resourceId: BUCKET_ID,
    username,
    permissions: ['READ', 'WRITE'],
  };

  await graphqlRequest(mutation, { input }, TOKEN);
}

async function createMessage(authToken, bucketId, title) {
  const agent = request(BASE_URL);
  const res = await agent
    .post('/messages')
    .set('Authorization', `Bearer ${authToken}`)
    .send({
      title,
      body: `E2E message generated at ${new Date().toISOString()}`,
      deliveryType: 'NORMAL',
      bucketId,
    });

  if (res.status !== 201) {
    throw new Error(`Expected 201 from POST /messages, got ${res.status}: ${JSON.stringify(res.body)}`);
  }

  const messageId = res.body?.message?.id ?? res.body?.id;
  if (!messageId) {
    throw new Error(`POST /messages response missing message id: ${JSON.stringify(res.body)}`);
  }

  return { id: messageId };
}

async function waitForNotificationForMessage({ authToken, deviceToken, messageId, expectedBucketId }) {
  await sleep(NOTIF_INITIAL_DELAY_MS);
  const started = Date.now();

  const query = `
    query Notifications {
      notifications {
        id
        message {
          id
          bucketId
        }
        userDeviceId
      }
    }
  `;

  let waitMs = Math.max(800, NOTIF_POLL_INTERVAL_MS);

  while (Date.now() - started < NOTIF_TIMEOUT_MS) {
    const data = await graphqlRequest(query, {}, authToken, { deviceToken });
    const notifications = data?.notifications || [];
    const match = notifications.find((n) => n?.message?.id === messageId);
    if (match) {
      if (expectedBucketId && match?.message?.bucketId !== expectedBucketId) {
        throw new Error(
          `Notification bucket mismatch for message ${messageId}: expected ${expectedBucketId}, got ${match?.message?.bucketId}`,
        );
      }
      return match;
    }

    await sleep(waitMs);
    waitMs = Math.min(Math.round(waitMs * 1.5), 4000);
  }

  return null;
}

async function assertNotificationAbsentForMessage({ authToken, deviceToken, messageId, timeoutMs = 5000 }) {
  // Avoid tight polling to prevent throttling: wait a bit, then check a couple of times.
  const started = Date.now();
  const query = `
    query Notifications {
      notifications {
        id
        message { id bucketId }
      }
    }
  `;

  // Initial delay
  await sleep(Math.min(2000, timeoutMs));
  const attempts = 3;
  for (let i = 0; i < attempts && Date.now() - started < timeoutMs; i++) {
    const data = await graphqlRequest(query, {}, authToken, { deviceToken });
    const notifications = data?.notifications || [];
    const match = notifications.find((n) => n?.message?.id === messageId);
    if (match) {
      throw new Error(
        `Unexpected notification found for message ${messageId} on deviceToken=${String(deviceToken).slice(0, 10)}...`,
      );
    }
    await sleep(400);
  }
}

async function run() {
  console.log('\n' + '═'.repeat(80));
  console.log('🧪 NOTIFICATIONS DEVICE ROUTING E2E (scripts)');
  console.log('═'.repeat(80));
  console.log(`\n📋 Configuration:`);
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Primary token: ${TOKEN.substring(0, 20)}...`);
  console.log(`   Private/user bucket ID: ${BUCKET_ID}`);

  // 1) Create primary user devices
  const ts = Date.now();
  const primaryIosToken = `ci-primary-ios-${ts}`;
  const primaryWebToken = `ci-primary-web-${ts}`;

  console.log('\n📱 Ensuring primary user has multiple devices...');
  const primaryIos = await ensureDevice(TOKEN, {
    deviceName: 'CI Primary iOS',
    deviceModel: 'iPhone Simulator',
    osVersion: '17.0',
    platform: 'IOS',
    deviceToken: primaryIosToken,
  });
  const primaryWeb = await ensureDevice(TOKEN, {
    deviceName: 'CI Primary Web',
    deviceModel: 'Chrome',
    osVersion: '120.0',
    platform: 'WEB',
    deviceToken: primaryWebToken,
    publicKey: `ci-vapid-pub-${ts}`,
    subscriptionFields: {
      endpoint: `https://example.invalid/push/${ts}`,
      p256dh: `p256dh-${ts}`,
      auth: `auth-${ts}`,
    },
  });

  console.log(`   ✅ Primary devices: iOS=${primaryIos.id}, WEB=${primaryWeb.id}`);

  // 2) Create secondary user + device
  const secondary = await registerSecondaryUser();
  const secondaryIosToken = `ci-secondary-ios-${ts}`;

  console.log('\n📱 Ensuring secondary user has a device...');
  const secondaryIos = await ensureDevice(secondary.jwt, {
    deviceName: 'CI Secondary iOS',
    deviceModel: 'iPhone Simulator',
    osVersion: '17.0',
    platform: 'IOS',
    deviceToken: secondaryIosToken,
  });
  console.log(`   ✅ Secondary device: iOS=${secondaryIos.id}`);

  // 3) Private bucket: only primary user should receive
  console.log('\n' + '─'.repeat(80));
  console.log('🔒 Case A: private/user bucket -> only primary devices');

  const msgPrivate = await createMessage(TOKEN, BUCKET_ID, `[E2E notif routing] private bucket ${ts}`);
  console.log(`   ➕ Message created: ${msgPrivate.id}`);

  const n1 = await waitForNotificationForMessage({
    authToken: TOKEN,
    deviceToken: primaryIosToken,
    messageId: msgPrivate.id,
    expectedBucketId: BUCKET_ID,
  });
  const n2 = await waitForNotificationForMessage({
    authToken: TOKEN,
    deviceToken: primaryWebToken,
    messageId: msgPrivate.id,
    expectedBucketId: BUCKET_ID,
  });

  if (!n1 || !n2) {
    throw new Error('Expected notifications for primary devices on private bucket, but not all were found');
  }

  await assertNotificationAbsentForMessage({
    authToken: secondary.jwt,
    deviceToken: secondaryIosToken,
    messageId: msgPrivate.id,
  });

  console.log('   ✅ Private bucket routing OK (primary yes, secondary no)');

  // 4) Shared bucket: primary + secondary should receive
  console.log('\n' + '─'.repeat(80));
  console.log('👥 Case B: shared bucket -> primary + secondary devices');

  console.log(`   🔗 Sharing bucket ${BUCKET_ID} with secondary user (${secondary.username})...`);
  await shareBucketWithUser(secondary.username);
  console.log('   ✅ Bucket shared');

  const msgShared = await createMessage(TOKEN, BUCKET_ID, `[E2E notif routing] shared bucket ${ts}`);
  console.log(`   ➕ Message created: ${msgShared.id}`);

  const s1 = await waitForNotificationForMessage({
    authToken: TOKEN,
    deviceToken: primaryIosToken,
    messageId: msgShared.id,
    expectedBucketId: BUCKET_ID,
  });
  const s2 = await waitForNotificationForMessage({
    authToken: TOKEN,
    deviceToken: primaryWebToken,
    messageId: msgShared.id,
    expectedBucketId: BUCKET_ID,
  });
  const s3 = await waitForNotificationForMessage({
    authToken: secondary.jwt,
    deviceToken: secondaryIosToken,
    messageId: msgShared.id,
    expectedBucketId: BUCKET_ID,
  });

  if (!s1 || !s2 || !s3) {
    throw new Error('Expected notifications for all devices on shared bucket, but not all were found');
  }

  console.log('   ✅ Shared bucket routing OK (primary yes, secondary yes)');

  // 5) Public bucket: at least primary devices should receive + correct bucket id
  console.log('\n' + '─'.repeat(80));
  console.log('🌐 Case C: public bucket -> notifications tied to correct bucket');

  const publicBucketId = await createPublicBucket();
  const msgPublic = await createMessage(TOKEN, publicBucketId, `[E2E notif routing] public bucket ${ts}`);
  console.log(`   ➕ Message created: ${msgPublic.id}`);

  const p1 = await waitForNotificationForMessage({
    authToken: TOKEN,
    deviceToken: primaryIosToken,
    messageId: msgPublic.id,
    expectedBucketId: publicBucketId,
  });
  const p2 = await waitForNotificationForMessage({
    authToken: TOKEN,
    deviceToken: primaryWebToken,
    messageId: msgPublic.id,
    expectedBucketId: publicBucketId,
  });

  if (!p1 || !p2) {
    throw new Error('Expected notifications for primary devices on public bucket, but not all were found');
  }

  console.log('   ✅ Public bucket routing OK (primary devices, correct bucket)');

  // 6) Admin bucket: if present, primary devices should receive + correct bucket id
  console.log('\n' + '─'.repeat(80));
  console.log('🛡️  Case D: admin bucket -> notifications tied to correct bucket (if present)');

  const adminBucketId = await findAdminBucketId();
  if (!adminBucketId) {
    console.log('   ⚠️ No admin bucket found; skipping admin bucket routing assertions.');
  } else {
    console.log(`   ✅ Admin bucket found: ${adminBucketId}`);
    const msgAdmin = await createMessage(TOKEN, adminBucketId, `[E2E notif routing] admin bucket ${ts}`);
    console.log(`   ➕ Message created: ${msgAdmin.id}`);

    const a1 = await waitForNotificationForMessage({
      authToken: TOKEN,
      deviceToken: primaryIosToken,
      messageId: msgAdmin.id,
      expectedBucketId: adminBucketId,
    });
    const a2 = await waitForNotificationForMessage({
      authToken: TOKEN,
      deviceToken: primaryWebToken,
      messageId: msgAdmin.id,
      expectedBucketId: adminBucketId,
    });

    if (!a1 || !a2) {
      throw new Error('Expected notifications for primary devices on admin bucket, but not all were found');
    }

    console.log('   ✅ Admin bucket routing OK (primary devices, correct bucket)');
  }

  console.log('\n✅ Notifications device routing E2E PASSED');
}

run().catch((err) => {
  console.error('\n❌ Notifications device routing E2E FAILED');
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
