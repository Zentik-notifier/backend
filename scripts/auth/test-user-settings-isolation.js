#!/usr/bin/env node

/**
 * E2E tests: user settings are never fetchable by another user.
 * Verifies that REST GET /users/settings and GraphQL userSettings
 * always return only the authenticated user's settings.
 *
 * Environment: BASE_URL, TOKEN (user A, e.g. admin)
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error('❌ TOKEN environment variable is required');
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
      Object.keys(options.headers).forEach((k) => req.setHeader(k, options.headers[k]));
    }
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function graphqlRequest(query, variables, authToken) {
  const res = await fetchHttp(`${BASE_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const payload = res.data ? JSON.parse(res.data) : {};
  return { httpStatus: res.status, payload };
}

async function registerAndLoginUser(prefix) {
  const suffix = Date.now().toString(36).slice(-6);
  const username = `${prefix}-${suffix}`.slice(0, 30);
  const email = `${username}@example.com`;
  const password = 'E2eSettingsIso1!';

  const registerRes = await fetchHttp(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username, password }),
  });
  if (registerRes.status < 200 || registerRes.status >= 300) {
    console.error('❌ Failed to register user:', registerRes.status, registerRes.data);
    process.exit(1);
  }

  const loginRes = await fetchHttp(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (loginRes.status < 200 || loginRes.status >= 300) {
    console.error('❌ Failed to login user:', loginRes.status, loginRes.data);
    process.exit(1);
  }
  const loginPayload = JSON.parse(loginRes.data || '{}');
  const jwt = loginPayload.accessToken;
  if (!jwt) {
    console.error('❌ Login response missing accessToken');
    process.exit(1);
  }
  return { username, email, jwt };
}

async function main() {
  console.log('\n🔒 User settings isolation E2E\n');

  const userA = { jwt: TOKEN };
  const upsertMutation = `
    mutation UpsertUserSetting($input: UpsertUserSettingInput!) {
      upsertUserSetting(input: $input) {
        id
        configType
        valueText
        userId
      }
    }
  `;
  const listQuery = `
    query UserSettings($deviceId: String) {
      userSettings(deviceId: $deviceId) {
        id
        configType
        valueText
        userId
      }
    }
  `;

  console.log('1. User A creates a setting (GraphQL)...');
  const createResult = await graphqlRequest(
    upsertMutation,
    {
      input: {
        configType: 'Timezone',
        valueText: 'UserA-Only-Timezone-E2E-' + Date.now(),
      },
    },
    userA.jwt,
  );
  if (createResult.httpStatus >= 400 || createResult.payload.errors) {
    console.error('   ❌ upsertUserSetting as A failed:', JSON.stringify(createResult.payload, null, 2));
    process.exit(1);
  }
  const settingA = createResult.payload.data?.upsertUserSetting;
  if (!settingA?.id) {
    console.error('   ❌ upsertUserSetting did not return setting:', createResult.payload);
    process.exit(1);
  }
  console.log('   ✅ Setting created:', settingA.id);

  console.log('2. User B registers and fetches settings (REST + GraphQL)...');
  const userB = await registerAndLoginUser('settings-iso-b');

  const restRes = await fetchHttp(`${BASE_URL}/users/settings`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${userB.jwt}` },
  });
  if (restRes.status >= 400) {
    console.error('   ❌ REST GET /users/settings as B failed:', restRes.status, restRes.data);
    process.exit(1);
  }
  const restSettings = JSON.parse(restRes.data || '[]');
  const foundInRest = restSettings.some((s) => s.id === settingA.id);
  if (foundInRest) {
    console.error('   ❌ User B must not see User A\'s setting via REST. Setting A id:', settingA.id);
    process.exit(1);
  }
  console.log('   ✅ REST: B does not see A\'s setting');

  const gqlResult = await graphqlRequest(listQuery, {}, userB.jwt);
  if (gqlResult.httpStatus >= 400 || gqlResult.payload.errors) {
    console.error('   ❌ GraphQL userSettings as B failed:', JSON.stringify(gqlResult.payload, null, 2));
    process.exit(1);
  }
  const gqlSettings = gqlResult.payload.data?.userSettings ?? [];
  const foundInGql = gqlSettings.some((s) => s.id === settingA.id);
  if (foundInGql) {
    console.error('   ❌ User B must not see User A\'s setting via GraphQL. Setting A id:', settingA.id);
    process.exit(1);
  }
  console.log('   ✅ GraphQL: B does not see A\'s setting');

  console.log('3. User B creates own setting and sees only it...');
  const createB = await graphqlRequest(
    upsertMutation,
    {
      input: {
        configType: 'Language',
        valueText: 'UserB-Only-Lang-E2E-' + Date.now(),
      },
    },
    userB.jwt,
  );
  if (createB.httpStatus >= 400 || createB.payload.errors) {
    console.error('   ❌ upsertUserSetting as B failed:', JSON.stringify(createB.payload, null, 2));
    process.exit(1);
  }
  const settingB = createB.payload.data?.upsertUserSetting;
  if (!settingB?.id) {
    console.error('   ❌ B upsert did not return setting');
    process.exit(1);
  }

  const gqlBList = await graphqlRequest(listQuery, {}, userB.jwt);
  const listB = gqlBList.payload.data?.userSettings ?? [];
  const bSeesA = listB.some((s) => s.id === settingA.id);
  const bSeesOwn = listB.some((s) => s.id === settingB.id);
  if (bSeesA) {
    console.error('   ❌ B must not see A\'s setting in own list');
    process.exit(1);
  }
  if (!bSeesOwn) {
    console.error('   ❌ B must see own setting in list');
    process.exit(1);
  }
  console.log('   ✅ B sees only own setting');

  console.log('\n✅ User settings isolation E2E passed.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
