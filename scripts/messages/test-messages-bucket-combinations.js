#!/usr/bin/env node

/**
 * E2E tests for message sending across different bucket types and access patterns.
 *
 * Bucket types covered:
 * - Private/user bucket (BUCKET_ID from environment)
 * - Public bucket (created specifically for this test)
 * - Admin bucket (seeded by admin-bucket seed, if present)
 * - Shared bucket (bucket shared with another regular user)
 *
 * Access patterns covered:
 * - Access token + bucketId
 * - Magic code (when available) without explicit Authorization header
 * - Shared user access token + shared bucketId
 *
 * Environment variables:
 * - BASE_URL  (e.g. http://localhost:3000/api/v1)
 * - TOKEN     (access token zat_... with bucket/message scopes)
 * - BUCKET_ID (existing private/user bucket used for other tests)
 */

const request = require('supertest');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const TOKEN = process.env.TOKEN;
const BUCKET_ID = process.env.BUCKET_ID;

const NOTIF_INITIAL_DELAY_MS = Number(process.env.NOTIF_INITIAL_DELAY_MS || 2000);
const NOTIF_POLL_INTERVAL_MS = Number(process.env.NOTIF_POLL_INTERVAL_MS || 1500);
const NOTIF_TIMEOUT_MS = Number(process.env.NOTIF_TIMEOUT_MS || 20000);
const NOTIF_ABSENCE_TIMEOUT_MS = Number(process.env.NOTIF_ABSENCE_TIMEOUT_MS || 3500);

const GRAPHQL_MAX_RETRIES = Number(process.env.GRAPHQL_MAX_RETRIES || 6);
const GRAPHQL_RETRY_BASE_DELAY_MS = Number(process.env.GRAPHQL_RETRY_BASE_DELAY_MS || 250);
const GRAPHQL_RETRY_MAX_DELAY_MS = Number(process.env.GRAPHQL_RETRY_MAX_DELAY_MS || 3000);

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

async function graphqlRequest(query, variables, authToken = TOKEN, extraHeaders = {}) {
  let retryDelay = GRAPHQL_RETRY_BASE_DELAY_MS;

  for (let attempt = 1; attempt <= GRAPHQL_MAX_RETRIES; attempt++) {
    const res = await fetchHttp(`${BASE_URL}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        ...extraHeaders,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (res.status === 429) {
      if (attempt === GRAPHQL_MAX_RETRIES) {
        throw new Error(`GraphQL throttled (HTTP 429) after ${attempt} attempts`);
      }
      await sleep(retryDelay);
      retryDelay = Math.min(Math.floor(retryDelay * 1.8), GRAPHQL_RETRY_MAX_DELAY_MS);
      continue;
    }

    if (res.status < 200 || res.status >= 300) {
      throw new Error(`GraphQL HTTP error: ${res.status} - ${res.data || res.statusText}`);
    }

    let payload;
    try {
      payload = JSON.parse(res.data || '{}');
    } catch (e) {
      throw new Error(`GraphQL invalid JSON response: ${String(e?.message || e)}`);
    }

    const errors = payload?.errors;
    const throttledByGql = Array.isArray(errors) && errors.some((err) => {
      const msg = err?.message || '';
      return typeof msg === 'string' && msg.includes('ThrottlerException');
    });

    if (throttledByGql) {
      if (attempt === GRAPHQL_MAX_RETRIES) {
        throw new Error(`GraphQL throttled (ThrottlerException) after ${attempt} attempts`);
      }
      await sleep(retryDelay);
      retryDelay = Math.min(Math.floor(retryDelay * 1.8), GRAPHQL_RETRY_MAX_DELAY_MS);
      continue;
    }

    if (errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(errors)}`);
    }

    return payload.data;
  }

  throw new Error('GraphQL request failed after retries');
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

async function waitForNotificationByMessageId(authToken, deviceToken, messageId) {
  await sleep(NOTIF_INITIAL_DELAY_MS);
  const started = Date.now();
  let delay = NOTIF_POLL_INTERVAL_MS;

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
    await sleep(delay);
    delay = Math.min(Math.floor(delay * 1.5), 4000);
  }

  return null;
}

async function assertNoNotificationByMessageId(authToken, deviceToken, messageId) {
  const started = Date.now();
  let delay = 500;
  const query = `
    query GetNotificationsForUser {
      notifications {
        id
        message { id }
      }
    }
  `;

  while (Date.now() - started < NOTIF_ABSENCE_TIMEOUT_MS) {
    const data = await graphqlRequest(query, {}, authToken, { deviceToken });
    const notifications = data?.notifications || [];
    const found = notifications.find((n) => n?.message?.id === messageId);
    if (found) {
      throw new Error(`Did NOT expect notification for message ${messageId} on deviceToken ${deviceToken}, but it exists (notification ${found.id}).`);
    }
    await sleep(delay);
    delay = Math.min(Math.floor(delay * 1.4), 1500);
  }
}

async function getBucketWithMagicCode(bucketId) {
  const query = `
    query GetBucket($id: String!) {
      bucket(id: $id) {
        id
        isPublic
        isAdmin
        userBucket {
          magicCode
        }
      }
    }
  `;

  const data = await graphqlRequest(query, { id: bucketId });
  const bucket = data?.bucket;
  if (!bucket) {
    throw new Error(`Bucket ${bucketId} not found via GraphQL`);
  }
  return bucket;
}

async function createPublicBucket() {
  console.log('\n📦 Creating public bucket for message tests...');

  const res = await fetchHttp(`${BASE_URL}/buckets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({
      name: `E2E Public Bucket ${Date.now()}`,
      description: 'Public bucket for messages bucket-combinations tests',
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
  const bucketId = payload.id;
  if (!bucketId) {
    throw new Error('Public bucket creation did not return id');
  }

  console.log(`   ✅ Public bucket created: ${bucketId}`);

  // Fetch magic code via GraphQL
  const bucket = await getBucketWithMagicCode(bucketId);
  const magicCode = bucket.userBucket?.magicCode || null;
  if (magicCode) {
    console.log(`   ✅ Public bucket magic code: ${String(magicCode).slice(0, 8)}...`);
  } else {
    console.log('   ⚠️ Public bucket has no magic code for current user');
  }

  return { id: bucketId, magicCode };
}

async function findAdminBucket() {
  console.log('\n🔎 Looking for admin bucket...');

  const query = `
    query Buckets {
      buckets {
        id
        isPublic
        isAdmin
        userBucket {
          magicCode
        }
      }
    }
  `;

  const data = await graphqlRequest(query, {});
  const buckets = data?.buckets || [];
  const admin = buckets.find((b) => b.isAdmin);

  if (!admin) {
    console.log('   ⚠️ No admin bucket found, admin combinations will be skipped.');
    return null;
  }

  const magicCode = admin.userBucket?.magicCode || null;
  console.log(`   ✅ Admin bucket found: ${admin.id}${magicCode ? ` (magicCode: ${String(magicCode).slice(0, 8)}...)` : ''}`);

  return { id: admin.id, magicCode };
}

async function sendMessageVariant(agent, description, { authToken, body }) {
  console.log(`\n➡️  ${description}`);

  let req = agent.post('/messages');

  if (authToken) {
    req = req.set('Authorization', `Bearer ${authToken}`);
  }

  const res = await req.send({
    title: `Bucket combination test: ${description}`,
    body: `Test message for ${description}`,
    deliveryType: 'NORMAL',
    ...body,
  });

  if (res.status !== 201) {
    console.error(`   ❌ Expected 201, got ${res.status}`);
    console.error('      Body:', JSON.stringify(res.body, null, 2));
    process.exit(1);
  }

  console.log('   ✅ 201 Created');

  const messageId = res.body?.message?.id ?? res.body?.id;
  if (!messageId) {
    console.error('      Response body:', JSON.stringify(res.body, null, 2));
    throw new Error('Expected message id in POST /messages response');
  }

  return messageId;
}

async function runBucketCombinationTests() {
  console.log('\n' + '═'.repeat(80));
  console.log('🧪 MESSAGES BUCKET COMBINATIONS TESTS');
  console.log('═'.repeat(80));
  console.log(`\n📋 Configuration:`);
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Token: ${TOKEN.substring(0, 20)}...`);
  console.log(`   Base bucket ID (private/user): ${BUCKET_ID}`);

  const agent = request(BASE_URL);

  // Prepare per-device notification assertions
  const ts = Date.now();
  const primaryDeviceTokens = {
    ios: `e2e-msg-combo-owner-ios-${ts}`,
    web: `e2e-msg-combo-owner-web-${ts}`,
  };

  console.log('\n📱 Registering owner test devices...');
  await ensureDevice(TOKEN, {
    platform: 'IOS',
    deviceToken: primaryDeviceTokens.ios,
    deviceName: 'E2E Msg Combos Owner iOS',
  });
  await ensureDevice(TOKEN, {
    platform: 'WEB',
    deviceToken: primaryDeviceTokens.web,
    deviceName: 'E2E Msg Combos Owner Web',
    subscriptionFields: {
      endpoint: `https://example.com/e2e/${ts}`,
      p256dh: 'e2e_p256dh_key',
      auth: 'e2e_auth_key',
    },
  });
  console.log('   ✅ Owner devices ready');

  // Private/user bucket from env
  const baseBucket = await getBucketWithMagicCode(BUCKET_ID);
  const privateBucket = {
    id: baseBucket.id,
    magicCode: baseBucket.userBucket?.magicCode || null,
  };

  console.log('\n📦 Base bucket (private/user):');
  console.log(`   id: ${privateBucket.id}`);
  console.log(
    `   magicCode: ${privateBucket.magicCode ? String(privateBucket.magicCode).slice(0, 8) + '...' : 'none'}`,
  );

  // Will hold the shared user's personal magic code for this bucket
  let sharedUserMagicCode = null;

  // Create a dedicated public bucket
  const publicBucket = await createPublicBucket();

  // Try to find admin bucket (seeded)
  const adminBucket = await findAdminBucket();

  // Create a shared bucket by sharing the private bucket with another user
  console.log('\n' + '─'.repeat(80));
  console.log('👥 Preparing shared bucket scenario...');

  // Step 1: register a secondary user
  const sharedUsername = `e2e-shared-${Date.now()}`;
  const sharedEmail = `${sharedUsername}@example.com`;
  const sharedPassword = 'E2eSharedUser1!';

  console.log(`   🧑‍🤝‍🧑 Registering secondary user: ${sharedEmail}...`);
  const registerRes = await fetchHttp(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: sharedEmail,
      username: sharedUsername,
      password: sharedPassword,
    }),
  });

  if (registerRes.status < 200 || registerRes.status >= 300) {
    console.error('   ❌ Failed to register secondary user:', registerRes.status, registerRes.data);
    process.exit(1);
  }

  console.log('   ✅ Secondary user registered');

  // Step 2: share the private bucket with the secondary user (by email)
  console.log('   🔗 Sharing private bucket with secondary user via GraphQL shareBucket...');

  const shareMutation = `
    mutation ShareBucket($input: GrantEntityPermissionInput!) {
      shareBucket(input: $input) {
        id
        permissions
      }
    }
  `;

  const shareInput = {
    resourceType: 'BUCKET',
    resourceId: privateBucket.id,
    // Use username because backend's UsersService.findByIdentifier expects "username" or "email",
    // and the GraphQL GrantEntityPermissionInput maps "username" correctly.
    username: sharedUsername,
    permissions: ['READ', 'WRITE'],
  };

  try {
    await graphqlRequest(shareMutation, { input: shareInput });
    console.log('   ✅ Bucket shared with secondary user');
  } catch (err) {
    console.error('   ❌ Failed to share bucket with secondary user:', err.message);
    process.exit(1);
  }

  // Step 3: login as secondary user and create an access token
  console.log('   🔑 Logging in as secondary user to obtain access token...');

  const loginRes = await fetchHttp(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: sharedUsername, password: sharedPassword }),
  });

  if (loginRes.status < 200 || loginRes.status >= 300) {
    console.error('   ❌ Failed to login secondary user:', loginRes.status, loginRes.data);
    process.exit(1);
  }

  const loginPayload = JSON.parse(loginRes.data || '{}');
  const sharedUserJwt = loginPayload.accessToken;
  if (!sharedUserJwt) {
    console.error('   ❌ Secondary user login did not return accessToken');
    process.exit(1);
  }

  console.log('   ✅ Secondary user JWT obtained');

  console.log('   🎟  Creating access token for secondary user...');
  const accessTokenRes = await fetchHttp(`${BASE_URL}/access-tokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sharedUserJwt}`,
    },
    body: JSON.stringify({
      name: 'E2E Shared User Token',
      storeToken: true,
      scopes: [],
    }),
  });

  if (accessTokenRes.status < 200 || accessTokenRes.status >= 300) {
    console.error('   ❌ Failed to create access token for secondary user:', accessTokenRes.status, accessTokenRes.data);
    process.exit(1);
  }

  const accessTokenPayload = JSON.parse(accessTokenRes.data || '{}');
  const sharedUserToken = accessTokenPayload.token;
  if (!sharedUserToken) {
    console.error('   ❌ Secondary user access token response missing token field');
    process.exit(1);
  }

  console.log('   ✅ Secondary user access token created');

  console.log('   📱 Registering secondary user test device...');
  const sharedUserDeviceToken = `e2e-msg-combo-shared-ios-${ts}`;
  await ensureDevice(sharedUserToken, {
    platform: 'IOS',
    deviceToken: sharedUserDeviceToken,
    deviceName: 'E2E Msg Combos Shared iOS',
  });
  console.log('   ✅ Secondary user device ready');

  console.log('   🔍 Fetching bucket as shared user to verify personal magicCode...');

  const sharedUserBucketData = await graphqlRequest(
    `
      query GetBucketForSharedUser($id: String!) {
        bucket(id: $id) {
          id
          userBucket {
            magicCode
          }
        }
      }
    `,
    { id: privateBucket.id },
    sharedUserToken,
  );

  const sharedUserBucket = sharedUserBucketData?.bucket;
  sharedUserMagicCode = sharedUserBucket?.userBucket?.magicCode || null;

  if (!sharedUserMagicCode) {
    console.error('   ❌ Shared user does not have a magicCode for the shared bucket');
    process.exit(1);
  }

  if (!privateBucket.magicCode) {
    console.error('   ❌ Owner private bucket has no magicCode, cannot verify personal magicCode behavior');
    process.exit(1);
  }

  if (String(sharedUserMagicCode) === String(privateBucket.magicCode)) {
    console.error('   ❌ Expected magicCode for shared user to be different from owner magicCode');
    process.exit(1);
  }

  console.log('   ✅ magicCode is personal per user for the shared bucket');

  console.log('\n' + '─'.repeat(80));
  console.log('📨 Testing combinations...');

  async function assertRouting(label, messageId, { expectOwner, expectShared }) {
    // owner devices
    if (expectOwner) {
      for (const dt of [primaryDeviceTokens.ios, primaryDeviceTokens.web]) {
        const notif = await waitForNotificationByMessageId(TOKEN, dt, messageId);
        if (!notif) {
          throw new Error(`Expected notification for ${label} (message ${messageId}) on owner deviceToken ${dt}, but none found.`);
        }
      }
    } else {
      for (const dt of [primaryDeviceTokens.ios, primaryDeviceTokens.web]) {
        await assertNoNotificationByMessageId(TOKEN, dt, messageId);
      }
    }

    // shared user device
    if (expectShared) {
      const notif = await waitForNotificationByMessageId(sharedUserToken, sharedUserDeviceToken, messageId);
      if (!notif) {
        throw new Error(`Expected notification for ${label} (message ${messageId}) on shared user deviceToken ${sharedUserDeviceToken}, but none found.`);
      }
    } else {
      await assertNoNotificationByMessageId(sharedUserToken, sharedUserDeviceToken, messageId);
    }
  }

  // 1) Private bucket with access token + bucketId
  const m1 = await sendMessageVariant(agent, 'Private bucket + token + bucketId', {
    authToken: TOKEN,
    body: { bucketId: privateBucket.id },
  });
  await assertRouting('Private bucket + token + bucketId', m1, { expectOwner: true, expectShared: true });

  // 2) Private bucket with magicCode (no Authorization header)
  if (privateBucket.magicCode) {
    const m2 = await sendMessageVariant(agent, 'Private bucket + magicCode (no token)', {
      authToken: null,
      body: { magicCode: privateBucket.magicCode },
    });
    await assertRouting('Private bucket + magicCode (no token)', m2, { expectOwner: true, expectShared: true });
  } else {
    console.log('   ⚠️ Skipping private bucket + magicCode (no magicCode available)');
  }

  // 3) Public bucket with access token + bucketId
  const m3 = await sendMessageVariant(agent, 'Public bucket + token + bucketId', {
    authToken: TOKEN,
    body: { bucketId: publicBucket.id },
  });
  await assertRouting('Public bucket + token + bucketId', m3, { expectOwner: true, expectShared: true });

  // 4) Public bucket with magicCode (if available)
  if (publicBucket.magicCode) {
    const m4 = await sendMessageVariant(agent, 'Public bucket + magicCode (no token)', {
      authToken: null,
      body: { magicCode: publicBucket.magicCode },
    });
    await assertRouting('Public bucket + magicCode (no token)', m4, { expectOwner: true, expectShared: true });
  } else {
    console.log('   ⚠️ Skipping public bucket + magicCode (no magicCode available)');
  }

  // 5) Admin bucket with access token + bucketId (if present)
  if (adminBucket) {
    const m5 = await sendMessageVariant(agent, 'Admin bucket + token + bucketId', {
      authToken: TOKEN,
      body: { bucketId: adminBucket.id },
    });
    await assertRouting('Admin bucket + token + bucketId', m5, { expectOwner: true, expectShared: false });

    // 6) Admin bucket with magicCode (if available)
    if (adminBucket.magicCode) {
      const m6 = await sendMessageVariant(agent, 'Admin bucket + magicCode (no token)', {
        authToken: null,
        body: { magicCode: adminBucket.magicCode },
      });
      await assertRouting('Admin bucket + magicCode (no token)', m6, { expectOwner: true, expectShared: false });
    } else {
      console.log('   ⚠️ Skipping admin bucket + magicCode (no magicCode available)');
    }
  }

  // 7) Shared bucket (private bucket shared with another user) using shared user's access token
  const m7 = await sendMessageVariant(agent, 'Shared bucket (private) + shared user token + bucketId', {
    authToken: sharedUserToken,
    body: { bucketId: privateBucket.id },
  });
  await assertRouting('Shared bucket (private) + shared user token + bucketId', m7, { expectOwner: true, expectShared: true });

  // 8) Shared bucket (private) using shared user's personal magicCode (no Authorization header)
  if (sharedUserMagicCode) {
    const m8 = await sendMessageVariant(agent, 'Shared bucket (private) + shared user magicCode (no token)', {
      authToken: null,
      body: { magicCode: sharedUserMagicCode },
    });
    await assertRouting('Shared bucket (private) + shared user magicCode (no token)', m8, { expectOwner: true, expectShared: true });
  }

  console.log('\n✅ All bucket/access combinations tested successfully.');
}

runBucketCombinationTests().catch((err) => {
  console.error('\n❌ Bucket combinations tests failed:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
