#!/usr/bin/env node

/**
 * E2E script (GitHub Actions job: test-scripts)
 *
 * Goal:
 * - Create additional admin users + regular users
 * - Register at least one device per user
 * - Send a message to the admin bucket and assert that all ADMIN users receive a notification
 * - Send a message to a public bucket and assert that all users (admins + regular) receive a notification
 *
 * Env:
 * - BASE_URL (default: http://localhost:3000/api/v1)
 * - TOKEN    (required) admin access token (zat_...) exported by e2e:init-environment
 *
 * Optional timings:
 * - NOTIF_INITIAL_DELAY_MS (default 1200)
 * - NOTIF_POLL_INTERVAL_MS (default 500)
 * - NOTIF_TIMEOUT_MS       (default 20000)
 */

const request = require('supertest');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const TOKEN = process.env.TOKEN;

const NOTIF_INITIAL_DELAY_MS = Number(process.env.NOTIF_INITIAL_DELAY_MS || 1200);
const NOTIF_POLL_INTERVAL_MS = Number(process.env.NOTIF_POLL_INTERVAL_MS || 500);
const NOTIF_TIMEOUT_MS = Number(process.env.NOTIF_TIMEOUT_MS || 20000);

if (!TOKEN) {
  console.error('❌ TOKEN environment variable is required');
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

async function graphqlRequest(query, variables = {}, authToken = TOKEN, extraHeaders = {}) {
  const res = await fetchHttp(`${BASE_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
      ...extraHeaders,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`GraphQL HTTP error: ${res.status} - ${res.data || res.statusText}`);
  }

  const payload = JSON.parse(res.data || '{}');
  if (payload.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(payload.errors)}`);
  }

  return payload.data;
}

async function adminCreateUser({ email, username, password }) {
  const mutation = `
    mutation AdminCreateUser($input: AdminCreateUserInput!) {
      adminCreateUser(input: $input) {
        id
        email
        username
        role
      }
    }
  `;

  const data = await graphqlRequest(mutation, {
    input: {
      email,
      username,
      password,
      skipEmailConfirmation: true,
    },
  });

  if (!data?.adminCreateUser?.id) {
    throw new Error('adminCreateUser did not return a user id');
  }

  return data.adminCreateUser;
}

async function updateUserRole(userId, role) {
  const mutation = `
    mutation UpdateUserRole($input: UpdateUserRoleInput!) {
      updateUserRole(input: $input) {
        id
        role
      }
    }
  `;

  const data = await graphqlRequest(mutation, { input: { userId, role } });
  return data?.updateUserRole;
}

async function login(username, password) {
  const res = await fetchHttp(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Login failed: ${res.status} - ${res.data}`);
  }

  const payload = JSON.parse(res.data || '{}');
  if (!payload.accessToken) {
    throw new Error('Login did not return accessToken');
  }

  return payload.accessToken; // JWT
}

async function createAccessTokenFromJwt(jwt, name) {
  const res = await fetchHttp(`${BASE_URL}/access-tokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ name, storeToken: true, scopes: [] }),
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Failed to create access token: ${res.status} - ${res.data}`);
  }

  const payload = JSON.parse(res.data || '{}');
  if (!payload.token) {
    throw new Error('Access token response missing token');
  }

  return payload.token; // zat_
}

async function listUserDevices(authToken) {
  const query = `
    query UserDevices {
      userDevices {
        id
        deviceToken
        platform
        deviceName
      }
    }
  `;

  const data = await graphqlRequest(query, {}, authToken);
  return data?.userDevices || [];
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
  return data?.registerDevice;
}

async function ensureDevice(authToken, desired) {
  const devices = await listUserDevices(authToken);
  const existing = devices.find((d) => d.deviceToken === desired.deviceToken);
  if (existing) return existing;
  return registerDevice(authToken, desired);
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

async function createPublicBucket() {
  const ts = Date.now();
  const res = await fetchHttp(`${BASE_URL}/buckets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({
      name: `E2E Public Bucket (broadcast) ${ts}`,
      description: 'Public bucket for broadcast tests',
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
  return payload.id;
}

async function createMessage(bucketId, title) {
  const agent = request(BASE_URL);
  const res = await agent
    .post('/messages')
    .set('Authorization', `Bearer ${TOKEN}`)
    .send({
      title,
      body: title,
      bucketId,
      deliveryType: 'NORMAL',
    });

  if (res.status !== 201) {
    throw new Error(`Expected 201 from POST /messages, got ${res.status}: ${JSON.stringify(res.body)}`);
  }

  const messageId = res.body?.message?.id ?? res.body?.id;
  if (!messageId) {
    throw new Error(`POST /messages response missing message id: ${JSON.stringify(res.body)}`);
  }

  return messageId;
}

async function waitForNotificationByMessageId(authToken, deviceToken, messageId) {
  await sleep(NOTIF_INITIAL_DELAY_MS);
  const started = Date.now();

  const query = `
    query GetNotificationsForUser {
      notifications {
        id
        createdAt
        message { id }
      }
    }
  `;

  while (Date.now() - started < NOTIF_TIMEOUT_MS) {
    const data = await graphqlRequest(query, {}, authToken, { deviceToken });
    const notifications = data?.notifications || [];
    const found = notifications.find((n) => n?.message?.id === messageId);
    if (found) return found;
    await sleep(NOTIF_POLL_INTERVAL_MS);
  }

  return null;
}

async function main() {
  console.log('\n' + '═'.repeat(80));
  console.log('🧪 ADMIN + PUBLIC BUCKET BROADCAST TESTS');
  console.log('═'.repeat(80));
  console.log(`\n📋 Configuration:`);
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Token: ${TOKEN.substring(0, 20)}...`);

  const ts = Date.now();

  // 1) Ensure we have an admin bucket (seeded)
  console.log('\n🔎 Looking for admin bucket...');
  const adminBucketId = await findAdminBucketId();
  if (!adminBucketId) {
    throw new Error('No admin bucket found (isAdmin=true). Ensure admin-bucket seed runs in e2e environment.');
  }
  console.log(`   ✅ Admin bucket: ${adminBucketId}`);

  // 2) Create a dedicated public bucket for this test
  console.log('\n📦 Creating a public bucket for broadcast tests...');
  const publicBucketId = await createPublicBucket();
  console.log(`   ✅ Public bucket: ${publicBucketId}`);

  // 3) Prepare users
  console.log('\n👥 Creating users (2 admins, 2 regular)...');

  const usersToCreate = [
    { kind: 'ADMIN', username: `e2e-admin-a-${ts}`, email: `e2e-admin-a-${ts}@example.com`, password: 'E2eAdminA1!' },
    { kind: 'ADMIN', username: `e2e-admin-b-${ts}`, email: `e2e-admin-b-${ts}@example.com`, password: 'E2eAdminB1!' },
    { kind: 'USER', username: `e2e-user-a-${ts}`, email: `e2e-user-a-${ts}@example.com`, password: 'E2eUserA1!' },
    { kind: 'USER', username: `e2e-user-b-${ts}`, email: `e2e-user-b-${ts}@example.com`, password: 'E2eUserB1!' },
  ];

  const created = [];
  for (const u of usersToCreate) {
    const user = await adminCreateUser(u);
    created.push({ ...u, id: user.id, role: user.role });
  }

  for (const u of created.filter((x) => x.kind === 'ADMIN')) {
    await updateUserRole(u.id, 'ADMIN');
  }

  console.log(`   ✅ Users created: ${created.length}`);

  // 4) Create tokens + devices for each created user
  console.log('\n📱 Creating access tokens and registering one device per user...');

  const userContexts = [];

  // Include the base admin (the one behind TOKEN)
  const baseAdminDeviceToken = `e2e-base-admin-ios-${ts}`;
  await ensureDevice(TOKEN, {
    platform: 'IOS',
    deviceToken: baseAdminDeviceToken,
    deviceName: 'E2E Base Admin iOS',
  });
  userContexts.push({
    label: 'base-admin',
    kind: 'ADMIN',
    authToken: TOKEN,
    deviceToken: baseAdminDeviceToken,
  });

  for (const u of created) {
    const jwt = await login(u.username, u.password);
    const accessToken = await createAccessTokenFromJwt(jwt, `E2E Broadcast Token ${u.username}`);

    const deviceToken = `e2e-${u.username}-ios-${ts}`;
    await ensureDevice(accessToken, {
      platform: 'IOS',
      deviceToken,
      deviceName: `E2E ${u.kind} iOS`,
    });

    userContexts.push({
      label: u.username,
      kind: u.kind,
      authToken: accessToken,
      deviceToken,
    });
  }

  const adminContexts = userContexts.filter((u) => u.kind === 'ADMIN');
  const allContexts = userContexts;

  console.log(`   ✅ Devices ready: admins=${adminContexts.length}, totalUsers=${allContexts.length}`);

  // 5) ADMIN bucket broadcast
  console.log('\n' + '─'.repeat(80));
  console.log('🧪 Case A: Admin bucket → notifications to ALL admins');

  const adminMsgId = await createMessage(adminBucketId, `[E2E broadcast] admin bucket ${ts}`);
  console.log(`   ➕ Message created: ${adminMsgId}`);

  for (const ctx of adminContexts) {
    const notif = await waitForNotificationByMessageId(ctx.authToken, ctx.deviceToken, adminMsgId);
    if (!notif) {
      throw new Error(`Expected ADMIN notification on ${ctx.label} (deviceToken ${ctx.deviceToken}) for message ${adminMsgId}, but none found.`);
    }
    console.log(`   ✅ Admin notified: ${ctx.label} (notification ${notif.id})`);
  }

  // 6) PUBLIC bucket broadcast
  console.log('\n' + '─'.repeat(80));
  console.log('🧪 Case B: Public bucket → notifications to ALL users');

  const publicMsgId = await createMessage(publicBucketId, `[E2E broadcast] public bucket ${ts}`);
  console.log(`   ➕ Message created: ${publicMsgId}`);

  for (const ctx of allContexts) {
    const notif = await waitForNotificationByMessageId(ctx.authToken, ctx.deviceToken, publicMsgId);
    if (!notif) {
      throw new Error(`Expected PUBLIC notification on ${ctx.label} (deviceToken ${ctx.deviceToken}) for message ${publicMsgId}, but none found.`);
    }
    console.log(`   ✅ User notified: ${ctx.label} (notification ${notif.id})`);
  }

  console.log('\n✅ Broadcast tests passed.');
}

main().catch((err) => {
  console.error('\n❌ Broadcast tests failed:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
