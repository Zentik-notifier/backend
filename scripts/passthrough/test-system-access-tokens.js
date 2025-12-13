#!/usr/bin/env node

/**
 * E2E tests for System Access Tokens used via /notifications/notify-external.
 *
 * Scenarios:
 * - Token with maxCalls = 0 (unlimited):
 *   - Request succeeds at HTTP level.
 *   - X-Token-* headers are present with expected values.
 * - Token with finite maxCalls:
 *   - With calls < maxCalls: headers reflect current usage (calls, maxCalls, remaining).
 *   - With calls >= maxCalls: guard rejects the request (401) and no headers are added.
 * - Token not found (non-existing sat_...):
 *   - Guard rejects the request (401/403) and no headers are added.
 *
 * NOTE: In this E2E environment push providers are not configured, so the
 * application does not automatically increment `calls`. We therefore adjust
 * the `calls` field directly in the database to simulate usage and focus on
 * testing:
 * - Header generation in SystemAccessTokenStatsInterceptor.
 * - Enforcement logic in SystemAccessTokenGuard (maxCalls threshold).
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { Client } = require('pg');

const BASE_URL_B = process.env.BASE_URL_B || 'http://localhost:4000/api/v1';

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 5432);
const DB_USERNAME = process.env.DB_USERNAME || 'zentik_user';
const DB_PASSWORD = process.env.DB_PASSWORD || 'zentik_password';
const DB_NAME_B = process.env.DB_NAME_B || 'zentik_test_b';

const ADMIN_USERS = process.env.ADMIN_USERS || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'admin';

function log(msg) {
  console.log(`[sat-e2e] ${msg}`);
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

async function loginAdminB() {
  const identifier = ADMIN_USERS.split(',').map((s) => s.trim())[0];
  if (!identifier) throw new Error('No ADMIN_USERS configured');

  log(`Logging in admin on Server B as ${identifier}...`);
  const res = await fetchHttp(`${BASE_URL_B}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: identifier, password: ADMIN_PASSWORD }),
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Login failed on B: ${res.status} - ${res.data}`);
  }

  const payload = JSON.parse(res.data || '{}');
  return payload.accessToken;
}

async function registerNonAdminUserB() {
  const crypto = require('crypto');
  const suffix = crypto.randomBytes(4).toString('hex');

  const email = `sat-e2e-${suffix}@example.com`;
  const username = `sat_e2e_${suffix}`;
  const password = 'SatE2E!123';

  log(`Registering non-admin user on Server B as ${email}/${username}...`);
  const res = await fetchHttp(`${BASE_URL_B}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      username,
      password,
      firstName: 'SAT',
      lastName: 'E2E',
      locale: 'en',
    }),
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`User registration failed on B: ${res.status} - ${res.data}`);
  }

  const payload = JSON.parse(res.data || '{}');
  if (!payload.accessToken || !payload.user || !payload.user.id) {
    throw new Error('Registration response missing accessToken or user.id');
  }

  log(`Registered non-admin user on B with id=${payload.user.id}`);
  return { jwt: payload.accessToken, userId: payload.user.id };
}

async function graphqlRequestB(jwt, query, variables) {
  const res = await fetchHttp(`${BASE_URL_B}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`GraphQL error ${res.status}: ${res.data || res.statusText}`);
  }

  const body = JSON.parse(res.data || '{}');
  if (body.errors && body.errors.length) {
    throw new Error(`GraphQL errors: ${JSON.stringify(body.errors)}`);
  }
  return body.data;
}

async function createSystemToken(jwt, maxCalls, description) {
  log(`Creating system token on B (maxCalls=${maxCalls})...`);
  const query = `
    mutation CreateSystemToken($maxCalls: Float!, $description: String, $scopes: [String!]) {
      createSystemToken(maxCalls: $maxCalls, description: $description, scopes: $scopes) {
        id
        maxCalls
        calls
        totalCalls
        lastResetAt
        rawToken
      }
    }
  `;

  const data = await graphqlRequestB(jwt, query, {
    maxCalls,
    description,
    scopes: ['passthrough'],
  });

  const rec = data?.createSystemToken;
  if (!rec || !rec.rawToken) {
    throw new Error('createSystemToken did not return rawToken');
  }

  log(`Created SAT id=${rec.id} maxCalls=${rec.maxCalls}`);
  return rec;
}

async function getSystemToken(jwt, id) {
  const query = `
    query GetSystemToken($id: String!) {
      getSystemToken(id: $id) {
        id
        maxCalls
        calls
        totalCalls
        lastResetAt
      }
    }
  `;
  const data = await graphqlRequestB(jwt, query, { id });
  return data?.getSystemToken;
}

async function callNotifyExternal(rawToken) {
  // Use WEB platform because web push service gracefully handles missing config
  const body = {
    platform: 'WEB',
    payload: {
      title: 'SAT E2E test',
      body: 'Testing system access token usage',
      url: '/',
      notificationId: 'sat-e2e',
      actions: [],
    },
    deviceData: {
      endpoint: 'https://example.com/fcm/send/dummy',
      p256dh: 'dummy_p256dh',
      auth: 'dummy_auth',
      publicKey: 'dummy_public',
      privateKey: 'dummy_private',
    },
  };

  const res = await fetchHttp(`${BASE_URL_B}/notifications/notify-external`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${rawToken}`,
    },
    body: JSON.stringify(body),
  });

  return res;
}

async function callNotifyExternalIos(rawToken) {
  // Use IOS platform to exercise APNs path (payloadTooLarge mock, etc.)
  const body = {
    platform: 'IOS',
    payload: {
      payload: {
        aps: {
          alert: { title: 'SAT E2E iOS', body: 'Testing payloadTooLarge via passthrough' },
          sound: 'default',
        },
      },
      priority: 10,
      topic: 'com.apocaliss92.zentik',
    },
    deviceData: {
      token: 'sat-e2e-ios-mock-token',
    },
  };

  const res = await fetchHttp(`${BASE_URL_B}/notifications/notify-external`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${rawToken}`,
    },
    body: JSON.stringify(body),
  });

  return res;
}

async function withDbClient(fn) {
  const client = new Client({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USERNAME,
    password: DB_PASSWORD,
    database: DB_NAME_B,
  });

  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function setTokenCalls(id, calls) {
  return withDbClient(async (client) => {
    log(`Setting token ${id} calls=${calls} (and totalCalls=${calls}) in DB B...`);
    await client.query(
      'UPDATE "system_access_tokens" SET "calls" = $1, "totalCalls" = $1 WHERE "id" = $2',
      [calls, id],
    );
  });
}

function expect(cond, message) {
  if (!cond) {
    throw new Error(message);
  }
}

async function testUnlimitedToken(jwt) {
  log('--- Test: maxCalls = 0 (unlimited) ---');
  const sat = await createSystemToken(jwt, 0, 'E2E unlimited token');

  const res = await callNotifyExternal(sat.rawToken);
  log(`notify-external (unlimited) HTTP status=${res.status}`);

  expect(res.status >= 200 && res.status < 300, 'notify-external should respond with 2xx for unlimited token');

  const headers = res.headers || {};
  const h = Object.keys(headers).reduce((acc, k) => {
    acc[k.toLowerCase()] = headers[k];
    return acc;
  }, {});

  expect(!!h['x-token-id'], 'x-token-id header must be present');
  expect(h['x-token-maxcalls'] !== undefined, 'x-token-maxcalls header must be present');
  expect(h['x-token-calls'] !== undefined, 'x-token-calls header must be present');
  expect(h['x-token-totalcalls'] !== undefined, 'x-token-totalcalls header must be present');

  // For maxCalls = 0, remaining header should be omitted (treated as unlimited)
  expect(h['x-token-remaining'] === undefined, 'x-token-remaining must be absent for unlimited tokens');

  const dbToken = await getSystemToken(jwt, sat.id);
  expect(dbToken && dbToken.maxCalls === 0, 'DB token must have maxCalls = 0');
  // Calls may still be 0 because providers are not configured; ensure it is not negative
  expect(dbToken && dbToken.calls >= 0, 'DB token calls must be >= 0');

  log('✔ Unlimited token headers and DB state verified.');
}

async function testLimitedTokenWithRemaining(jwt) {
  log('--- Test: finite maxCalls with remaining > 0 ---');
  const sat = await createSystemToken(jwt, 3, 'E2E limited token');

  // Simulate that the token has already been used once (calls = 1)
  await setTokenCalls(sat.id, 1);

  const res = await callNotifyExternal(sat.rawToken);
  log(`notify-external (limited, calls=1) HTTP status=${res.status}`);

  expect(res.status >= 200 && res.status < 300, 'notify-external should respond with 2xx while token still has remaining calls');

  const headers = res.headers || {};
  const h = Object.keys(headers).reduce((acc, k) => {
    acc[k.toLowerCase()] = headers[k];
    return acc;
  }, {});

  expect(!!h['x-token-id'], 'x-token-id header must be present');
  expect(h['x-token-maxcalls'] === '3' || h['x-token-maxcalls'] === 3, 'x-token-maxcalls must be 3');
  expect(h['x-token-calls'] === '1' || h['x-token-calls'] === 1, 'x-token-calls must be 1');
  expect(h['x-token-remaining'] === '2' || h['x-token-remaining'] === 2, 'x-token-remaining must be 2 when maxCalls=3 & calls=1');

  const dbToken = await getSystemToken(jwt, sat.id);
  expect(dbToken && dbToken.maxCalls === 3, 'DB token must have maxCalls = 3');
  expect(dbToken && dbToken.calls === 1, 'DB token calls must be 1');

  log('✔ Limited token headers and DB state (remaining > 0) verified.');

  return sat; // return for exhaustion test
}

async function testTokenExhausted(jwt, sat) {
  log('--- Test: token exhausted (remaining = 0) ---');

  // Simulate that the token has reached its maxCalls
  await setTokenCalls(sat.id, sat.maxCalls || 3);

  const res = await callNotifyExternal(sat.rawToken);
  log(`notify-external (exhausted) HTTP status=${res.status}`);

  // When calls >= maxCalls, SystemAccessTokenGuard should reject the token
  expect(res.status === 401 || res.status === 403, 'Exhausted token must be rejected with 401/403');

  const headers = res.headers || {};
  const hCount = Object.keys(headers).filter((k) => k.toLowerCase().startsWith('x-token-')).length;
  expect(hCount === 0, 'No X-Token-* headers should be present when guard rejects the token');

  const dbToken = await getSystemToken(jwt, sat.id);
  expect(dbToken && dbToken.calls >= sat.maxCalls, 'DB token calls must be >= maxCalls after exhaustion simulation');

  log('✔ Exhausted token is not accepted and headers are not returned.');
}

async function testNonExistingToken() {
  log('--- Test: non-existing token ---');

  // Create a random-looking sat_ token that is guaranteed not to exist
  const crypto = require('crypto');
  const raw = crypto.randomBytes(24).toString('hex');
  const fakeToken = `sat_${raw}`;

  const res = await callNotifyExternal(fakeToken);
  log(`notify-external (non-existing token) HTTP status=${res.status}`);

  // Guard must reject because validateSystemToken will not find a match
  expect(res.status === 401 || res.status === 403, 'Non-existing token must be rejected with 401/403');

  const headers = res.headers || {};
  const hCount = Object.keys(headers).filter((k) => k.toLowerCase().startsWith('x-token-')).length;
  expect(hCount === 0, 'No X-Token-* headers should be present for non-existing tokens');

  log('✔ Non-existing token is rejected and no headers are returned.');
}

async function testPayloadTooLargeDoesNotIncrementCalls(adminJwt) {
  log('--- Test: payloadTooLarge via passthrough does not increment calls ---');

  // Create a fresh token with some maxCalls and ensure calls = 0
  const sat = await createSystemToken(adminJwt, 5, 'E2E payloadTooLarge token');
  await setTokenCalls(sat.id, 0);

  const before = await getSystemToken(adminJwt, sat.id);
  expect(before && before.calls === 0, 'Precondition: calls must start at 0');

  const res = await callNotifyExternalIos(sat.rawToken);
  log(`notify-external (ios, payloadTooLarge) HTTP status=${res.status}`);

  let body = null;
  try {
    body = JSON.parse(res.data || '{}');
  } catch (e) {
    log(`Failed to parse notify-external iOS response JSON: ${e.message}`);
  }

  // In payloadTooLarge mock mode the APNs send should fail and report success=false
  if (body) {
    log(`[sat-e2e] notify-external iOS response: ${JSON.stringify(body)}`);
  }

  expect(body && body.success === false, 'notify-external iOS should report success=false when APNs send fails (e.g., PayloadTooLarge)');

  const after = await getSystemToken(adminJwt, sat.id);
  expect(after && after.calls === before.calls, 'Token calls must not increase when passthrough APNs send fails');
  expect(after && after.totalCalls === before.totalCalls, 'Token totalCalls must not increase when passthrough APNs send fails');

  log('✔ PayloadTooLarge via passthrough does not increment SAT call counters.');
}

async function testNonAdminCannotUpdateTokenScopes(adminJwt) {
  log('--- Test: only admin can update token scopes ---');

  // Register a non-admin user on Server B
  const { jwt: userJwt, userId } = await registerNonAdminUserB();

  // Create a system token with requesterId bound to this user
  const createMutation = `
    mutation CreateSystemToken($maxCalls: Float!, $description: String, $requesterId: String, $scopes: [String!]) {
      createSystemToken(maxCalls: $maxCalls, description: $description, requesterId: $requesterId, scopes: $scopes) {
        id
        scopes
        requester { id }
      }
    }
  `;

  const createData = await graphqlRequestB(adminJwt, createMutation, {
    maxCalls: 10,
    description: 'E2E token bound to requester',
    requesterId: userId,
    scopes: ['passthrough'],
  });

  const created = createData && createData.createSystemToken;
  expect(created && created.id, 'Admin must be able to create system token for requester');

  // Attempt to update scopes as the requester (non-admin user)
  const updateMutation = `
    mutation UpdateSystemToken($id: String!, $scopes: [String!]) {
      updateSystemToken(id: $id, scopes: $scopes) {
        id
        scopes
      }
    }
  `;

  let updateFailed = false;
  try {
    await graphqlRequestB(userJwt, updateMutation, {
      id: created.id,
      scopes: ['passthrough', 'extra-scope'],
    });
  } catch (err) {
    updateFailed = true;
    const msg = String(err && err.message ? err.message : err);
    log(`Expected failure updating token scopes as non-admin: ${msg}`);
    expect(
      msg.toLowerCase().includes('forbidden') ||
        msg.toLowerCase().includes('access denied') ||
        msg.toLowerCase().includes('not authorized'),
      'Non-admin scope update should fail with a forbidden/unauthorized error',
    );
  }

  expect(updateFailed, 'Non-admin user should not be able to update system token scopes');

  // Verify from admin that scopes did NOT change
  const getQuery = `
    query GetSystemToken($id: String!) {
      getSystemToken(id: $id) {
        id
        scopes
        requester { id }
      }
    }
  `;

  const after = await graphqlRequestB(adminJwt, getQuery, { id: created.id });
  const token = after && after.getSystemToken;
  expect(token && Array.isArray(token.scopes), 'Admin must be able to read token scopes');
  expect(
    token.scopes.length === 1 && token.scopes[0] === 'passthrough',
    'Token scopes must remain unchanged when non-admin update is rejected',
  );

  expect(
    token && token.requester && token.requester.id === userId,
    'Token requester must remain bound to the non-admin user',
  );

  log('✔ Only admins can update system token scopes; requester cannot.');
}

async function main() {
  log('Starting System Access Token E2E tests against Server B...');

  const jwt = await loginAdminB();

  await testUnlimitedToken(jwt);
  const limitedSat = await testLimitedTokenWithRemaining(jwt);
  await testTokenExhausted(jwt, limitedSat);
  await testNonExistingToken();
  await testNonAdminCannotUpdateTokenScopes(jwt);
  await testPayloadTooLargeDoesNotIncrementCalls(jwt);

  log('All System Access Token E2E tests completed successfully.');
}

main().catch((err) => {
  console.error('[sat-e2e] ❌ Failure:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
