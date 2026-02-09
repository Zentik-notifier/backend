#!/usr/bin/env node

/**
 * E2E tests for GraphQL subscriptions (graphql-ws) and alternative transports (SSE, long poll).
 * Subscriptions: notificationCreated, notificationUpdated, notificationDeleted,
 * messageCreated, messageDeleted, bucketCreated, bucketUpdated, bucketDeleted.
 * Also: GET /messages/stream (SSE), GET /messages/poll (long poll), and root shortcuts /stream, /poll.
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
const ws = require('ws');
const { createClient } = require('graphql-ws');
const { EventSource } = require('eventsource');

const wsUrl = BASE_URL.replace(/^http/, 'ws') + '/graphql';

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

function createWsClient() {
  return createClient({
    url: wsUrl,
    webSocketImpl: ws,
    connectionParams: {
      Authorization: `Bearer ${TOKEN}`,
    },
  });
}

function subscribeAndWaitForOne(client, subscriptionQuery, subscriptionName) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error(`${subscriptionName}: no event received within ${SUBSCRIPTION_TIMEOUT_MS}ms`));
    }, SUBSCRIPTION_TIMEOUT_MS);
    const unsubscribe = client.subscribe(
      { query: subscriptionQuery },
      {
        next: (value) => {
          clearTimeout(timeout);
          unsubscribe();
          resolve(value);
        },
        error: (err) => {
          clearTimeout(timeout);
          reject(toError(err));
        },
        complete: () => {},
      }
    );
  });
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
  log('Connecting to ' + wsUrl);
  const client = createWsClient();

  await runTest('notificationCreated + messageCreated', async () => {
    const sub = `
      subscription {
        notificationCreated { id title message { id } }
      }
    `;
    const msgSub = `
      subscription {
        messageCreated { id title bucketId }
      }
    `;
    const notifPromise = subscribeAndWaitForOne(client, sub, 'notificationCreated');
    const msgPromise = subscribeAndWaitForOne(client, msgSub, 'messageCreated');
    const mutation = `
      mutation CreateMessage($input: CreateMessageDto!) {
        createMessage(input: $input) { id title bucketId }
      }
    `;
    const created = await graphql(mutation, {
      input: {
        bucketId: BUCKET_ID,
        title: `E2E sub ${Date.now()}`,
        deliveryType: 'NORMAL',
        body: 'E2E subscription test',
      },
    });
    if (!created?.createMessage?.id) {
      throw new Error('createMessage did not return message id');
    }
    const [notifPayload, msgPayload] = await Promise.all([notifPromise, msgPromise]);
    if (!notifPayload?.data?.notificationCreated?.id) {
      throw new Error('notificationCreated payload missing id');
    }
    if (!msgPayload?.data?.messageCreated?.id || msgPayload.data.messageCreated.id !== created.createMessage.id) {
      throw new Error('messageCreated payload mismatch');
    }
    return { messageId: created.createMessage.id, notificationId: notifPayload.data.notificationCreated.id };
  });

  let lastNotificationId;
  let lastMessageId;
  await runTest('notificationCreated returns notification id for later tests', async () => {
    const sub = `subscription { notificationCreated { id } }`;
    const notifPromise = subscribeAndWaitForOne(client, sub, 'notificationCreated');
    const msgPromise = subscribeAndWaitForOne(client, 'subscription { messageCreated { id } }', 'messageCreated');
    await graphql(
      `mutation CreateMessage($input: CreateMessageDto!) { createMessage(input: $input) { id } }`,
      {
        input: { bucketId: BUCKET_ID, title: `E2E sub ref ${Date.now()}`, deliveryType: 'NORMAL', body: 'Ref' },
      }
    );
    const [n, m] = await Promise.all([notifPromise, msgPromise]);
    lastNotificationId = n?.data?.notificationCreated?.id;
    lastMessageId = m?.data?.messageCreated?.id;
    if (!lastNotificationId || !lastMessageId) {
      throw new Error('Missing notification or message id for later tests');
    }
  });

  await runTest('notificationUpdated', async () => {
    const sub = `subscription { notificationUpdated { id readAt } }`;
    const updatedPromise = subscribeAndWaitForOne(client, sub, 'notificationUpdated');
    await graphql(`mutation MarkAsRead($id: String!) { markNotificationAsRead(id: $id) { id readAt } }`, {
      id: lastNotificationId,
    });
    const payload = await updatedPromise;
    if (!payload?.data?.notificationUpdated?.id) {
      throw new Error('notificationUpdated payload missing id');
    }
  });

  await runTest('notificationDeleted', async () => {
    const sub = `subscription { notificationDeleted }`;
    const deletedPromise = subscribeAndWaitForOne(client, sub, 'notificationDeleted');
    await graphql(`mutation DeleteNotification($id: String!) { deleteNotification(id: $id) }`, {
      id: lastNotificationId,
    });
    const payload = await deletedPromise;
    if (payload?.data?.notificationDeleted !== lastNotificationId) {
      throw new Error(`notificationDeleted expected ${lastNotificationId}, got ${payload?.data?.notificationDeleted}`);
    }
  });

  await runTest('messageDeleted', async () => {
    const sub = `subscription { messageDeleted }`;
    const deletedPromise = subscribeAndWaitForOne(client, sub, 'messageDeleted');
    await graphql(`mutation DeleteMessage($id: String!) { deleteMessage(id: $id) }`, { id: lastMessageId });
    const payload = await deletedPromise;
    if (payload?.data?.messageDeleted !== lastMessageId) {
      throw new Error(`messageDeleted expected ${lastMessageId}, got ${payload?.data?.messageDeleted}`);
    }
  });

  let tempBucketId;
  await runTest('bucketCreated', async () => {
    const sub = `subscription { bucketCreated { id name } }`;
    const createdPromise = subscribeAndWaitForOne(client, sub, 'bucketCreated');
    const data = await graphql(
      `mutation CreateBucket($input: CreateBucketDto!) { createBucket(input: $input) { id name } }`,
      { input: { name: `E2E sub bucket ${Date.now()}`, generateIconWithInitials: true, generateMagicCode: false } }
    );
    tempBucketId = data?.createBucket?.id;
    if (!tempBucketId) {
      throw new Error('createBucket did not return bucket id');
    }
    const payload = await createdPromise;
    if (!payload?.data?.bucketCreated?.id || payload.data.bucketCreated.id !== tempBucketId) {
      throw new Error('bucketCreated payload mismatch');
    }
  });

  await runTest('bucketUpdated', async () => {
    const sub = `subscription { bucketUpdated { id name } }`;
    const updatedPromise = subscribeAndWaitForOne(client, sub, 'bucketUpdated');
    const newName = `E2E sub bucket updated ${Date.now()}`;
    await graphql(
      `mutation UpdateBucket($id: String!, $input: UpdateBucketDto!) { updateBucket(id: $id, input: $input) { id name } }`,
      { id: tempBucketId, input: { name: newName } }
    );
    const payload = await updatedPromise;
    if (!payload?.data?.bucketUpdated?.id || payload.data.bucketUpdated.name !== newName) {
      throw new Error('bucketUpdated payload mismatch');
    }
  });

  await runTest('bucketDeleted', async () => {
    const sub = `subscription { bucketDeleted }`;
    const deletedPromise = subscribeAndWaitForOne(client, sub, 'bucketDeleted');
    await graphql(`mutation DeleteBucket($id: String!) { deleteBucket(id: $id) }`, { id: tempBucketId });
    const payload = await deletedPromise;
    if (payload?.data?.bucketDeleted !== tempBucketId) {
      throw new Error(`bucketDeleted expected ${tempBucketId}, got ${payload?.data?.bucketDeleted}`);
    }
  });

  await client.dispose();

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

  log('All subscription E2E tests passed.');
}

function createMessageAndWaitForSseWithEventSource(streamUrl, timeoutMs) {
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
            bucketId: BUCKET_ID,
            title: `E2E SSE ${Date.now()}`,
            deliveryType: 'NORMAL',
            body: 'E2E SSE test',
          },
        }
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
