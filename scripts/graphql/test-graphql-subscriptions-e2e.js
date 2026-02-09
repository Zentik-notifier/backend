#!/usr/bin/env node

/**
 * E2E tests for message stream transports: SSE and long poll.
 * GET /messages/stream (SSE), GET /messages/poll (long poll), and root shortcuts /stream, /poll.
 *
 * Prerequisites: Backend running (e.g. after npm run e2e:init-environment).
 * Env: BASE_URL (e.g. http://localhost:3000/api/v1), TOKEN, BUCKET_ID.
 * Run: node scripts/graphql/test-graphql-subscriptions-e2e.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const TOKEN = process.env.TOKEN;
const BUCKET_ID = process.env.BUCKET_ID;
const SUBSCRIPTION_TIMEOUT_MS = Number(process.env.SUBSCRIPTION_TIMEOUT_MS || 10000);

if (!TOKEN) {
  console.error('TOKEN environment variable is required');
  process.exit(1);
}
if (!BUCKET_ID) {
  console.error('BUCKET_ID environment variable is required');
  process.exit(1);
}

const http = require('http');
const https = require('https');
const { URL } = require('url');
const { EventSource } = require('eventsource');

function log(msg) {
  console.log(`[e2e-subscriptions] ${msg}`);
}

function toError(err) {
  if (err instanceof Error) return err;
  if (Array.isArray(err)) return new Error(`GraphQL errors: ${JSON.stringify(err)}`);
  return new Error(String(err));
}

async function fetchHttp(url, options = {}) {
  const urlObj = new URL(url);
  const client = urlObj.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.request(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    }, (res) => {
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

async function graphql(query, variables, token = TOKEN) {
  const res = await fetchHttp(`${BASE_URL}/graphql`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({ query, variables }),
  });
  const payload = res.data ? JSON.parse(res.data) : {};
  if (payload.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(payload.errors)}`);
  }
  return payload.data;
}

async function ensureDevice() {
  const query = `
    query UserDevices {
      userDevices { id platform deviceToken }
    }
  `;
  const data = await graphql(query);
  const devices = data?.userDevices || [];
  if (devices.length > 0) return;
  const deviceToken = `e2e-subscriptions-${Date.now()}`;
  const mutation = `
    mutation RegisterDevice($input: RegisterDeviceDto!) {
      registerDevice(input: $input) { id platform deviceToken }
    }
  `;
  await graphql(mutation, {
    input: {
      platform: 'IOS',
      deviceToken,
      deviceName: 'E2E Subscriptions',
      deviceModel: 'iPhone Simulator',
    },
  });
  log('Registered test device for notification subscriptions');
}

async function runTest(name, fn) {
  try {
    await fn();
    log(`OK ${name}`);
  } catch (err) {
    const e = toError(err);
    log(`FAIL ${name}: ${e.message}`);
    throw e;
  }
}

async function main() {
  await ensureDevice();

  const bucketData = await graphql(
    `query GetBucket($id: String!) { bucket(id: $id) { id name } }`,
    { id: BUCKET_ID }
  );
  const bucketName = bucketData?.bucket?.name;
  if (!bucketName) throw new Error('Bucket name not found for BUCKET_ID');

  await runTest('SSE /messages/stream (EventSource, ntfy-style open+message)', async () => {
    const streamUrl = `${BASE_URL}/messages/stream`;
    const { messageId, event, openReceived } = await createMessageAndWaitForSseWithEventSource(streamUrl, SUBSCRIPTION_TIMEOUT_MS);
    if (!openReceived) throw new Error('SSE expected open event (ntfy-style)');
    if (!event || event.type !== 'message' || !event.data) {
      throw new Error(`SSE expected message event, got ${JSON.stringify(event)}`);
    }
    const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    if (data.id !== messageId) {
      throw new Error(`SSE message id mismatch: expected ${messageId}, got ${data.id}`);
    }
    if (data.event !== 'message') throw new Error(`SSE data.event expected "message", got ${data.event}`);
  });

  await runTest('SSE /stream shortcut (EventSource, ntfy-style)', async () => {
    const streamUrl = `${BASE_URL}/stream`;
    const { messageId, event, openReceived } = await createMessageAndWaitForSseWithEventSource(streamUrl, SUBSCRIPTION_TIMEOUT_MS);
    if (!openReceived) throw new Error('SSE /stream expected open event');
    if (!event || event.type !== 'message' || !event.data) {
      throw new Error(`SSE /stream expected message event, got ${JSON.stringify(event)}`);
    }
    const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    if (data.id !== messageId) {
      throw new Error(`SSE /stream message id mismatch: expected ${messageId}, got ${data.id}`);
    }
  });

  await runTest('SSE /messages/stream filtered by bucket name', async () => {
    const streamUrl = `${BASE_URL}/messages/stream?bucketId=${encodeURIComponent(bucketName)}`;
    const { messageId, event, openReceived } = await createMessageAndWaitForSseWithEventSource(streamUrl, SUBSCRIPTION_TIMEOUT_MS);
    if (!openReceived) throw new Error('SSE (by name) expected open event');
    if (!event || event.type !== 'message' || !event.data) {
      throw new Error(`SSE (by name) expected message event, got ${JSON.stringify(event)}`);
    }
    const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    if (data.id !== messageId) {
      throw new Error(`SSE (by name) message id mismatch: expected ${messageId}, got ${data.id}`);
    }
  });

  await runTest('Long poll /messages/poll returns message_created after create', async () => {
    const since = 0;
    const created = await graphql(
      `mutation CreateMessage($input: CreateMessageDto!) { createMessage(input: $input) { id } }`,
      {
        input: {
          bucketId: BUCKET_ID,
          title: `E2E poll ${Date.now()}`,
          deliveryType: 'NORMAL',
          body: 'E2E long poll test',
        },
      }
    );
    const messageId = created?.createMessage?.id;
    if (!messageId) throw new Error('createMessage did not return message id');
    await new Promise((r) => setTimeout(r, 500));
    const res = await fetchHttp(`${BASE_URL}/messages/poll?since=${since}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (res.status !== 200) {
      throw new Error(`poll returned ${res.status}: ${res.data}`);
    }
    const body = JSON.parse(res.data || '{}');
    const events = body.events || [];
    const createdEvent = events.find((e) => e.type === 'message_created' && e.message?.id === messageId);
    if (!createdEvent) {
      throw new Error(`poll did not return message_created for ${messageId}, got ${JSON.stringify(events)}`);
    }
  });

  await runTest('Long poll /messages/poll filtered by bucket name', async () => {
    const since = 0;
    const created = await graphql(
      `mutation CreateMessage($input: CreateMessageDto!) { createMessage(input: $input) { id } }`,
      {
        input: {
          bucketId: BUCKET_ID,
          title: `E2E poll by name ${Date.now()}`,
          deliveryType: 'NORMAL',
          body: 'E2E long poll by bucket name',
        },
      }
    );
    const messageId = created?.createMessage?.id;
    if (!messageId) throw new Error('createMessage did not return message id');
    await new Promise((r) => setTimeout(r, 500));
    const res = await fetchHttp(
      `${BASE_URL}/messages/poll?since=${since}&bucketId=${encodeURIComponent(bucketName)}`,
      { method: 'GET', headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    if (res.status !== 200) throw new Error(`poll (by name) returned ${res.status}: ${res.data}`);
    const body = JSON.parse(res.data || '{}');
    const events = body.events || [];
    const createdEvent = events.find((e) => e.type === 'message_created' && e.message?.id === messageId);
    if (!createdEvent) {
      throw new Error(`poll (by name) did not return message_created for ${messageId}, got ${JSON.stringify(events)}`);
    }
  });

  await runTest('Long poll /poll shortcut returns message_created after create', async () => {
    const since = 0;
    const created = await graphql(
      `mutation CreateMessage($input: CreateMessageDto!) { createMessage(input: $input) { id } }`,
      {
        input: {
          bucketId: BUCKET_ID,
          title: `E2E poll root ${Date.now()}`,
          deliveryType: 'NORMAL',
          body: 'E2E long poll root test',
        },
      }
    );
    const messageId = created?.createMessage?.id;
    if (!messageId) throw new Error('createMessage did not return message id');
    await new Promise((r) => setTimeout(r, 500));
    const res = await fetchHttp(`${BASE_URL}/poll?since=${since}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (res.status !== 200) {
      throw new Error(`/poll returned ${res.status}: ${res.data}`);
    }
    const body = JSON.parse(res.data || '{}');
    const events = body.events || [];
    const createdEvent = events.find((e) => e.type === 'message_created' && e.message?.id === messageId);
    if (!createdEvent) {
      throw new Error(`/poll did not return message_created for ${messageId}, got ${JSON.stringify(events)}`);
    }
  });

  await runTest('SSE /messages/stream for shared bucket (not owned by user)', async () => {
    const ts = Date.now();
    const otherUsername = `e2e-stream-other-${ts}`;
    const otherPassword = 'E2eStreamOther1!';
    const registerRes = await fetchHttp(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `${otherUsername}@example.com`,
        username: otherUsername,
        password: otherPassword,
      }),
    });
    if (registerRes.status < 200 || registerRes.status >= 300) {
      throw new Error(`Register other user failed: ${registerRes.status} ${registerRes.data}`);
    }
    const loginRes = await fetchHttp(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: otherUsername, password: otherPassword }),
    });
    if (loginRes.status < 200 || loginRes.status >= 300) {
      throw new Error(`Login other user failed: ${loginRes.status}`);
    }
    const jwt = JSON.parse(loginRes.data || '{}').accessToken;
    if (!jwt) throw new Error('No JWT for other user');
    const tokenRes = await fetchHttp(`${BASE_URL}/access-tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ name: 'E2E Stream Other', storeToken: true, scopes: [] }),
    });
    if (tokenRes.status < 200 || tokenRes.status >= 300) {
      throw new Error(`Create access token for other user failed: ${tokenRes.status}`);
    }
    const otherToken = JSON.parse(tokenRes.data || '{}').token;
    if (!otherToken) throw new Error('No token for other user');
    const bucketData = await graphql(
      `mutation CreateBucket($input: CreateBucketDto!) { createBucket(input: $input) { id name } }`,
      {
        input: {
          name: `E2E shared stream bucket ${ts}`,
          generateIconWithInitials: true,
          generateMagicCode: false,
        },
      },
      otherToken
    );
    const sharedBucketId = bucketData?.createBucket?.id;
    if (!sharedBucketId) throw new Error('Other user createBucket did not return id');
    await graphql(
      `mutation RegisterDevice($input: RegisterDeviceDto!) { registerDevice(input: $input) { id } }`,
      {
        input: {
          platform: 'IOS',
          deviceToken: `e2e-stream-other-${ts}`,
          deviceName: 'E2E Stream Other',
          deviceModel: 'iPhone',
        },
      },
      otherToken
    );
    const meData = await graphql(`query { me { username } }`);
    const firstUserUsername = meData?.me?.username;
    if (!firstUserUsername) throw new Error('me.username not found');
    await graphql(
      `mutation ShareBucket($input: GrantEntityPermissionInput!) {
        shareBucket(input: $input) { id }
      }`,
      {
        input: {
          resourceType: 'BUCKET',
          resourceId: sharedBucketId,
          username: firstUserUsername,
          permissions: ['READ', 'WRITE'],
        },
      },
      otherToken
    );
    const streamUrl = `${BASE_URL}/messages/stream?bucketId=${encodeURIComponent(sharedBucketId)}`;
    const { messageId, event, openReceived } = await createMessageAndWaitForSseWithEventSource(
      streamUrl,
      SUBSCRIPTION_TIMEOUT_MS,
      sharedBucketId,
      otherToken
    );
    if (!openReceived) throw new Error('SSE (shared bucket) expected open event');
    if (!event || event.type !== 'message' || !event.data) {
      throw new Error(`SSE (shared bucket) expected message event, got ${JSON.stringify(event)}`);
    }
    const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    if (data.id !== messageId) {
      throw new Error(`SSE (shared bucket) message id mismatch: expected ${messageId}, got ${data.id}`);
    }
  });

  log('All stream E2E tests passed.');
}

function createMessageAndWaitForSseWithEventSource(
  streamUrl,
  timeoutMs,
  bucketIdForCreate = BUCKET_ID,
  createMessageToken = TOKEN
) {
  return new Promise((resolve, reject) => {
    const state = { messageId: null, messageEvent: null, openReceived: false, resolved: false };
    const doResolve = () => {
      if (state.resolved) return;
      if (state.messageId && state.messageEvent && state.messageEvent.id === state.messageId) {
        state.resolved = true;
        es.close();
        resolve({
          messageId: state.messageId,
          event: state.messageEvent,
          openReceived: state.openReceived,
        });
      }
    };
    const es = new EventSource(streamUrl, {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          headers: { ...(init?.headers || {}), Authorization: `Bearer ${TOKEN}` },
        }),
    });
    es.addEventListener('open', () => {
      state.openReceived = true;
    });
    es.addEventListener('message', (event) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.id) {
          state.messageEvent = { type: 'message', data: event.data, id: data.id };
          doResolve();
        }
      } catch (_) {}
    });
    es.addEventListener('error', () => {
      es.close();
    });
    setTimeout(() => {
      graphql(
        `mutation CreateMessage($input: CreateMessageDto!) { createMessage(input: $input) { id } }`,
        {
          input: {
            bucketId: bucketIdForCreate,
            title: `E2E SSE ${Date.now()}`,
            deliveryType: 'NORMAL',
            body: 'E2E SSE test',
          },
        },
        createMessageToken
      )
        .then((data) => {
          state.messageId = data?.createMessage?.id || null;
          doResolve();
        })
        .catch(reject);
    }, 800);
    setTimeout(() => {
      es.close();
      if (!state.resolved) {
        reject(new Error(`SSE (EventSource): no message event within ${timeoutMs}ms`));
      }
    }, timeoutMs);
  });
}

main().catch((err) => {
  const e = toError(err);
  console.error('[e2e-subscriptions]', e.message);
  process.exit(1);
});
