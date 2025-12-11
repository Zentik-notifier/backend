#!/usr/bin/env node

/**
 * E2E tests for role-based access control.
 *
 * Goals:
 * - Verify that admin-only REST/GraphQL endpoints are accessible with ADMIN credentials.
 * - Verify that the same endpoints are NOT accessible with non-admin credentials (USER role).
 *
 * Environment variables:
 * - BASE_URL  (e.g. http://localhost:3000/api/v1)
 * - TOKEN     (admin access token zat_... with ADMIN role)
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
  const base = `${prefix}-${suffix}`;
  const username = base.slice(0, 30);
  const email = `${username}@example.com`;
  const password = 'E2eRoleUser1!';

  console.log(`   🧑 Registering non-admin user ${email}...`);
  const registerRes = await fetchHttp(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username, password }),
  });

  if (registerRes.status < 200 || registerRes.status >= 300) {
    console.error('   ❌ Failed to register user:', registerRes.status, registerRes.data);
    process.exit(1);
  }

  console.log('   ✅ User registered');

  console.log('   🔑 Logging in user...');
  const loginRes = await fetchHttp(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (loginRes.status < 200 || loginRes.status >= 300) {
    console.error('   ❌ Failed to login user:', loginRes.status, loginRes.data);
    process.exit(1);
  }

  const loginPayload = JSON.parse(loginRes.data || '{}');
  const userJwt = loginPayload.accessToken;
  if (!userJwt) {
    console.error('   ❌ Login response missing accessToken');
    process.exit(1);
  }

  console.log('   ✅ User JWT obtained');
  return { username, email, jwt: userJwt };
}

async function expectAdminOnlyRest({ method, path, description }) {
  console.log(`\n[REST] ${description} (${method} ${path})`);

  // Call as admin (TOKEN should be an access token with ADMIN role)
  const adminRes = await fetchHttp(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
  });

  console.log(`   👑 Admin call status: ${adminRes.status}`);
  if (adminRes.status >= 400) {
    console.error(`   ❌ Expected admin to access ${path}, got status ${adminRes.status}`);
    console.error('      Body:', adminRes.data);
    process.exit(1);
  }

  // Call as non-admin user
  const nonAdmin = await registerAndLoginUser('role-rest');
  const userRes = await fetchHttp(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${nonAdmin.jwt}`,
    },
  });

  console.log(`   🙅 Non-admin call status: ${userRes.status}`);
  if (userRes.status !== 403 && userRes.status !== 401) {
    console.error(
      `   ❌ Expected non-admin to be forbidden (401/403) on ${path}, got status ${userRes.status}`,
    );
    console.error('      Body:', userRes.data);
    process.exit(1);
  }

  console.log('   ✅ Admin-only REST endpoint correctly protected');
}

async function expectAdminOnlyGraphql({ description, query, variables }) {
  console.log(`\n[GraphQL] ${description}`);

  // Call as admin
  const adminResult = await graphqlRequest(query, variables, TOKEN);
  console.log(
    `   👑 Admin GraphQL httpStatus=${adminResult.httpStatus}, errors=${
      adminResult.payload.errors ? 'yes' : 'no'
    }`,
  );

  if (adminResult.httpStatus < 200 || adminResult.httpStatus >= 300 || adminResult.payload.errors) {
    console.error('   ❌ Expected admin GraphQL call to succeed, got:', adminResult);
    process.exit(1);
  }

  // Call as non-admin
  const nonAdmin = await registerAndLoginUser('role-gql');
  const userResult = await graphqlRequest(query, variables, nonAdmin.jwt);
  console.log(
    `   🙅 Non-admin GraphQL httpStatus=${userResult.httpStatus}, errors=${
      userResult.payload.errors ? JSON.stringify(userResult.payload.errors) : 'none'
    }`,
  );

  // For GraphQL, admin-only guard should surface as an error (e.g., Unauthorized/Forbidden)
  if (!userResult.payload.errors || userResult.httpStatus === 200) {
    console.error('   ❌ Expected non-admin GraphQL call to be rejected, got:', userResult);
    process.exit(1);
  }

  console.log('   ✅ Admin-only GraphQL operation correctly protected');
}

async function runRoleBasedAccessTests() {
  console.log('\n' + '═'.repeat(80));
  console.log('🧪 ROLE-BASED ACCESS E2E TESTS');
  console.log('═'.repeat(80));
  console.log(`\n📋 Configuration:`);
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Admin token: ${TOKEN.substring(0, 20)}...`);

  // REST admin-only examples
  console.log('\n' + '─'.repeat(80));
  console.log('1) REST admin-only endpoints');

  await expectAdminOnlyRest({
    method: 'GET',
    path: '/users',
    description: 'Get all users (UsersController.getAllUsers)',
  });

  await expectAdminOnlyRest({
    method: 'GET',
    path: '/server-manager/settings',
    description: 'Get all server settings (ServerManagerController.getAllSettings)',
  });

  await expectAdminOnlyRest({
    method: 'GET',
    path: '/server-manager/logs',
    description: 'Get logs (ServerManagerController.getLogs)',
  });

  await expectAdminOnlyRest({
    method: 'GET',
    path: '/server-manager/files',
    description: 'List server files (FilesAdminController.list)',
  });

  await expectAdminOnlyRest({
    method: 'GET',
    path: '/system-access-tokens',
    description: 'List system access tokens (SystemAccessTokenController.list)',
  });

  await expectAdminOnlyRest({
    method: 'GET',
    path: '/system-access-token-requests',
    description: 'List SAT requests (SystemAccessTokenRequestController.findAll)',
  });

  await expectAdminOnlyRest({
    method: 'GET',
    path: '/oauth-providers',
    description: 'Get all OAuth providers (OAuthProvidersController.findAll)',
  });

  // GraphQL admin-only example: server manager resolver (settings)
  console.log('\n' + '─'.repeat(80));
  console.log('2) GraphQL admin-only operations');

  await expectAdminOnlyGraphql({
    description: 'serverSettings (ServerManagerResolver)',
    query: `
      query GetServerSettings {
        serverSettings {
          configType
          valueText
        }
      }
    `,
    variables: {},
  });

    await expectAdminOnlyGraphql({
      description: 'logs (ServerManagerResolver)',
      query: `
        query GetLogs {
          logs(input: { page: 1, limit: 10 }) {
            total
          }
        }
      `,
      variables: {},
    });

  console.log('\n✅ All role-based access checks passed.');
}

runRoleBasedAccessTests().catch((err) => {
  console.error('\n❌ Role-based access tests failed:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
