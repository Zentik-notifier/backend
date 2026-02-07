#!/usr/bin/env node

/**
 * E2E tests for NTFY integration:
 * - Publish: message -> NTFY (mock receives POST)
 * - Subscribe: mock emits SSE message -> backend creates message in bucket
 * - Sharing: share ExternalNotifySystem with user B; B can link bucket and use; after unshare B cannot use
 * - Forbidden: user without share cannot link bucket to owner's system
 *
 * Prerequisites: Backend running, TOKEN (admin). Optional: NTFY_MOCK_PORT (default 9999).
 * Run: node scripts/ntfy/test-ntfy-e2e.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const TOKEN = process.env.TOKEN;
const NTFY_MOCK_PORT = Number(process.env.NTFY_MOCK_PORT || 9999);
const MOCK_BASE = `http://localhost:${NTFY_MOCK_PORT}`;

if (!TOKEN) {
  console.error('❌ TOKEN environment variable is required');
  process.exit(1);
}

const { createMockNtfyServer } = require('./mock-ntfy-server');
const http = require('http');
const https = require('https');
const { URL } = require('url');

function log(msg) {
  console.log(`[e2e] ${msg}`);
}

async function fetchHttp(url, options = {}) {
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
      Object.keys(options.headers).forEach((k) => req.setHeader(k, options.headers[k]));
    }
    if (options.body !== undefined) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

function fetchHttpStatusOnly(url, options = {}) {
  const urlObj = new URL(url);
  const client = urlObj.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.request(url, options, (res) => {
      res.status = res.statusCode;
      res.destroy();
      resolve(res);
    });
    req.on('error', reject);
    if (options.headers) {
      Object.keys(options.headers).forEach((k) => req.setHeader(k, options.headers[k]));
    }
    req.end();
  });
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
    type: 'NTFY',
    name: `E2E NTFY ${Date.now()}`,
    baseUrl,
  };
  if (opts.authToken != null) input.authToken = opts.authToken;
  if (opts.authUser != null) input.authUser = opts.authUser;
  if (opts.authPassword != null) input.authPassword = opts.authPassword;
  const result = await graphql(mutation, { input }, token);
  if (result.status >= 400 || result.payload.errors) {
    throw new Error(JSON.stringify(result.payload));
  }
  return result.payload.data.createExternalNotifySystem;
}

async function createBucket(token) {
  const mutation = `
    mutation CreateBucket($input: CreateBucketDto!) {
      createBucket(input: $input) {
        id
        name
      }
    }
  `;
  const result = await graphql(
    mutation,
    {
      input: {
        name: `E2E Bucket ${Date.now()}`,
        generateIconWithInitials: true,
        generateMagicCode: false,
      },
    },
    token,
  );
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

async function getMessagesForBucket(token, bucketId) {
  const query = `
    query GetBucket($id: String!) {
      bucket(id: $id) {
        messages {
          id
          title
          body
          createdAt
        }
      }
    }
  `;
  const result = await graphql(query, { id: bucketId }, token);
  if (result.payload.errors || !result.payload.data?.bucket) {
    return [];
  }
  return result.payload.data.bucket.messages || [];
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

async function registerAndLogin(prefix) {
  const suffix = Date.now().toString(36).slice(-6);
  const username = `${prefix}-${suffix}`.slice(0, 30);
  const email = `${username}@example.com`;
  const password = 'NtfyE2ePass1!';

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

async function reloadNtfySubscriptions(token) {
  const res = await fetchHttp(`${BASE_URL}/external-notify-systems/reload-ntfy-subscriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status !== 200) {
    throw new Error(`Reload failed: ${res.status} ${res.data}`);
  }
  log('Reloaded NTFY subscriptions');
}

async function runTests() {
  console.log('\n' + '═'.repeat(80));
  console.log('🧪 NTFY E2E TESTS');
  console.log('═'.repeat(80));
  console.log(`BASE_URL=${BASE_URL}  MOCK=${MOCK_BASE}\n`);

  const mock = createMockNtfyServer({ port: NTFY_MOCK_PORT });
  await mock.listen();

  const publishReceived = [];
  mock.events.on('publish', (p) => {
    publishReceived.push(p);
    log(`Mock received publish: ${p.topic} - ${p.headers?.title || p.body?.slice(0, 40)}`);
  });

  try {
    log('Creating ExternalNotifySystem and bucket (owner = admin)...');
    const system = await createExternalNotifySystem(TOKEN);
    const bucket = await createBucket(TOKEN);
    const systemId = system.id;
    const bucketId = bucket.id;
    const topic = 'e2e-ntfy-topic';

    const linkResult = await updateBucketLink(TOKEN, bucketId, systemId, topic);
    if (linkResult.status >= 400 || linkResult.payload.errors) {
      throw new Error('Failed to link bucket to system: ' + JSON.stringify(linkResult.payload));
    }
    log(`System ${systemId} created, bucket ${bucketId} linked to topic ${topic}`);

    await reloadNtfySubscriptions(TOKEN);
    await new Promise((r) => setTimeout(r, 1500));

    console.log('\n' + '─'.repeat(80));
    console.log('1) Publish: send message -> mock receives POST');
    mock.clearPublished();
    const sendRes = await sendMessage(TOKEN, bucketId, 'E2E Publish Test', 'Body from backend');
    if (sendRes.status < 200 || sendRes.status >= 300) {
      throw new Error(`Send message failed: ${sendRes.status} ${sendRes.data}`);
    }
    await new Promise((r) => setTimeout(r, 800));
    const published = mock.published();
    if (published.length === 0) {
      throw new Error('Mock did not receive any publish');
    }
    const lastPub = published[published.length - 1];
    if (lastPub.topic !== topic || !lastPub.body.includes('Body from backend')) {
      throw new Error(`Unexpected publish: ${JSON.stringify(lastPub)}`);
    }
    console.log('   ✅ Publish test passed: mock received message');

    console.log('\n' + '─'.repeat(80));
    console.log('2) Subscribe: mock emits message -> backend creates message in bucket');
    const messagesBefore = await getMessagesForBucket(TOKEN, bucketId);
    mock.emitIncoming(topic, {
      title: 'From NTFY',
      message: 'Incoming from mock NTFY',
      priority: 3,
    });
    await new Promise((r) => setTimeout(r, 2000));
    const messagesAfter = await getMessagesForBucket(TOKEN, bucketId);
    const newOnes = messagesAfter.filter(
      (m) => !messagesBefore.some((b) => b.id === m.id)
    );
    if (newOnes.length === 0) {
      throw new Error('No new message created after mock emit (is backend subscribed? Run reload after linking bucket)');
    }
    const fromNtfy = newOnes.find((m) => m.body && m.body.includes('Incoming from mock'));
    if (!fromNtfy) {
      throw new Error('New message content mismatch: ' + JSON.stringify(newOnes));
    }
    console.log('   ✅ Subscribe test passed: backend created message from NTFY');

    console.log('\n' + '─'.repeat(80));
    console.log('3) Sharing: share system with user B; B can link bucket');
    const userB = await registerAndLogin('ntfy-share-b');
    const shareRes = await shareExternalNotifySystem(TOKEN, systemId, userB.username, ['READ']);
    if (shareRes.status >= 400 || shareRes.payload.errors) {
      throw new Error('Share failed: ' + JSON.stringify(shareRes.payload));
    }
    const bucketB = await createBucket(userB.jwt);
    const linkB = await updateBucketLink(userB.jwt, bucketB.id, systemId, 'e2e-topic-b');
    if (linkB.status >= 400 || linkB.payload.errors) {
      throw new Error('User B should be able to link bucket after share: ' + JSON.stringify(linkB.payload));
    }
    console.log('   ✅ User B linked bucket after share');

    console.log('\n' + '─'.repeat(80));
    console.log('4) Forbidden: user C (no share) cannot link bucket to system');
    const userC = await registerAndLogin('ntfy-forbid-c');
    const bucketC = await createBucket(userC.jwt);
    const linkC = await updateBucketLink(userC.jwt, bucketC.id, systemId, 'e2e-topic-c');
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
    console.log('5) Unshare: after unshare, B cannot link another bucket to system');
    await unshareExternalNotifySystem(TOKEN, systemId, userB.username);
    const bucketB2 = await createBucket(userB.jwt);
    const linkB2 = await updateBucketLink(userB.jwt, bucketB2.id, systemId, 'e2e-topic-b2');
    if (linkB2.status < 400 && !linkB2.payload.errors) {
      throw new Error('User B should NOT be able to link after unshare');
    }
    const isForbiddenB =
      linkB2.status === 403 ||
      (linkB2.payload.errors && linkB2.payload.errors.some((e) => e.message && e.message.includes('permission')));
    if (!isForbiddenB) {
      throw new Error('Expected 403 or permission error after unshare: ' + JSON.stringify(linkB2.payload));
    }
    console.log('   ✅ After unshare, B correctly forbidden to link new bucket');

    console.log('\n' + '─'.repeat(80));
    console.log('6) Subscription change: new topic receives messages after link (auto refresh)');
    const topic2 = 'e2e-ntfy-topic-new';
    const bucket2 = await createBucket(TOKEN);
    const link2Res = await updateBucketLink(TOKEN, bucket2.id, systemId, topic2);
    if (link2Res.status >= 400 || link2Res.payload.errors) {
      throw new Error('Failed to link second bucket to new topic: ' + JSON.stringify(link2Res.payload));
    }
    await new Promise((r) => setTimeout(r, 2000));
    const messagesBeforeTopic2 = await getMessagesForBucket(TOKEN, bucket2.id);
    mock.emitIncoming(topic2, {
      title: 'Subscription change test',
      message: 'Message on new topic after auto refresh',
      priority: 3,
    });
    await new Promise((r) => setTimeout(r, 2000));
    const messagesAfterTopic2 = await getMessagesForBucket(TOKEN, bucket2.id);
    const newOnTopic2 = messagesAfterTopic2.filter(
      (m) => !messagesBeforeTopic2.some((b) => b.id === m.id)
    );
    if (newOnTopic2.length === 0) {
      throw new Error('No message on new topic after subscription change (auto refresh on link should have added topic)');
    }
    const fromTopic2 = newOnTopic2.find((m) => m.body && m.body.includes('Message on new topic after auto refresh'));
    if (!fromTopic2) {
      throw new Error('New topic message content mismatch: ' + JSON.stringify(newOnTopic2));
    }
    console.log('   ✅ Subscription change test passed: new topic received message after link');

    console.log('\n' + '─'.repeat(80));
    console.log('7) Same server: topic A without auth, topic B with auth');
    const authMockPort = NTFY_MOCK_PORT + 1;
    const MOCK_AUTH_BASE = `http://localhost:${authMockPort}`;
    const authMock = createMockNtfyServer({
      port: authMockPort,
      auth: { bearer: 'e2e-auth-secret' },
      publicTopics: ['topic-a'],
    });
    await authMock.listen();
    try {
      const system1 = await createExternalNotifySystem(TOKEN, MOCK_AUTH_BASE, {});
      const bucket1 = await createBucket(TOKEN);
      const link1 = await updateBucketLink(TOKEN, bucket1.id, system1.id, 'topic-a');
      if (link1.status >= 400 || link1.payload.errors) {
        throw new Error('User 1 link failed: ' + JSON.stringify(link1.payload));
      }
      const user2 = await registerAndLogin('ntfy-auth-u2');
      const system2 = await createExternalNotifySystem(user2.jwt, MOCK_AUTH_BASE, {
        authToken: 'e2e-auth-secret',
      });
      const bucket2 = await createBucket(user2.jwt);
      const link2 = await updateBucketLink(user2.jwt, bucket2.id, system2.id, 'topic-b');
      if (link2.status >= 400 || link2.payload.errors) {
        throw new Error('User 2 link failed: ' + JSON.stringify(link2.payload));
      }
      await reloadNtfySubscriptions(TOKEN);
      await new Promise((r) => setTimeout(r, 2000));

      const resA = await fetchHttpStatusOnly(`${MOCK_AUTH_BASE}/topic-a/sse`, { method: 'GET' });
      if (resA.status !== 200) {
        throw new Error(`Topic A without auth should return 200, got ${resA.status}`);
      }

      const resB = await fetchHttpStatusOnly(`${MOCK_AUTH_BASE}/topic-b/sse`, { method: 'GET' });
      if (resB.status !== 401) {
        throw new Error(`Topic B without auth should return 401, got ${resB.status}`);
      }

      const beforeA = await getMessagesForBucket(TOKEN, bucket1.id);
      authMock.emitIncoming('topic-a', {
        title: 'No auth topic',
        message: 'Message on topic A without auth',
        priority: 3,
      });
      await new Promise((r) => setTimeout(r, 2000));
      const afterA = await getMessagesForBucket(TOKEN, bucket1.id);
      const newA = afterA.filter((m) => !beforeA.some((b) => b.id === m.id));
      if (newA.length === 0 || !newA.some((m) => m.body && m.body.includes('Message on topic A without auth'))) {
        throw new Error('User 1 bucket should receive message on topic A (no auth)');
      }

      const beforeB = await getMessagesForBucket(user2.jwt, bucket2.id);
      authMock.emitIncoming('topic-b', {
        title: 'Auth topic',
        message: 'Message on topic B with auth',
        priority: 3,
      });
      await new Promise((r) => setTimeout(r, 2000));
      const afterB = await getMessagesForBucket(user2.jwt, bucket2.id);
      const newB = afterB.filter((m) => !beforeB.some((b) => b.id === m.id));
      if (newB.length === 0 || !newB.some((m) => m.body && m.body.includes('Message on topic B with auth'))) {
        throw new Error('User 2 bucket should receive message on topic B (with auth subscription)');
      }

      console.log('   ✅ Topic A passes without auth; topic B does not pass without auth; both receive when using correct auth');
    } finally {
      await authMock.close();
    }

    console.log('\n✅ All NTFY E2E tests passed.');
  } finally {
    await mock.close();
  }
}

runTests().catch((err) => {
  console.error('\n❌ NTFY E2E failed:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
