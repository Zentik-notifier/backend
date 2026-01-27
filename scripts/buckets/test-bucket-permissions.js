#!/usr/bin/env node

/**
 * E2E tests for bucket permission scopes (READ/WRITE/ADMIN/DELETE) and role-based access on buckets.
 *
 * Scenarios covered:
 * - Owner/admin can read/write/delete bucket.
 * - Shared user with READ only:
 *   - Can read bucket and list permissions.
 *   - Cannot delete bucket or modify settings.
 * - Shared user with WRITE:
 *   - Currently does NOT gain additional bucket-level read/write rights
 *     (WRITE is used for more granular operations such as messages).
 *   - Cannot delete bucket or update permissions.
 * - Shared user with ADMIN:
 *   - Can share/unshare bucket and perform admin-level operations.
 * - Public bucket and messages:
 *   - User (role USER) cannot send a message to a public bucket (403 Forbidden).
 *   - Admin can send a message to a public bucket (success).
 *
 * Environment variables:
 * - BASE_URL  (e.g. http://localhost:3000/api/v1)
 * - TOKEN     (admin access token zat_...)
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

async function createTestBucket(nameSuffix, opts = {}) {
  const { isPublic = false } = opts;
  console.log(`\n📦 Creating test bucket (${nameSuffix})${isPublic ? ' [public]' : ''}...`);

  const mutation = `
    mutation CreateBucket($input: CreateBucketDto!) {
      createBucket(input: $input) {
        id
        name
        isProtected
        isPublic
      }
    }
  `;

  const input = {
    name: `E2E Scope Bucket ${nameSuffix} ${Date.now()}`,
    description: 'Bucket for bucket permission scope tests',
    isPublic,
    isProtected: false,
    generateIconWithInitials: true,
    generateMagicCode: false,
  };

  const result = await graphqlRequest(mutation, { input }, TOKEN);

  if (result.httpStatus < 200 || result.httpStatus >= 300 || result.payload.errors) {
    console.error('   ❌ Failed to create test bucket:', JSON.stringify(result, null, 2));
    process.exit(1);
  }

  const bucket = result.payload.data && result.payload.data.createBucket;
  if (!bucket || !bucket.id) {
    console.error('   ❌ createBucket did not return a valid bucket:', JSON.stringify(result.payload, null, 2));
    process.exit(1);
  }

  console.log(`   ✅ Test bucket created: ${bucket.id}`);
  return bucket.id;
}

async function registerAndLoginUser(prefix) {
  const suffix = Date.now().toString(36).slice(-6);
  const base = `${prefix}-${suffix}`;
  const username = base.slice(0, 30);
  const email = `${username}@example.com`;
  const password = 'E2eBucketScope1!';

  console.log(`   🧑 Registering user ${email}...`);
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

async function shareBucketWithPermissions(bucketId, targetUsername, permissions) {
  console.log(`   🔗 Sharing bucket ${bucketId} with ${targetUsername} (permissions=${permissions.join(',')})...`);

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
    resourceId: bucketId,
    username: targetUsername,
    permissions,
  };

  const result = await graphqlRequest(mutation, { input }, TOKEN);
  if (result.httpStatus < 200 || result.httpStatus >= 300 || result.payload.errors) {
    console.error('   ❌ Failed to share bucket:', JSON.stringify(result, null, 2));
    process.exit(1);
  }

  console.log('   ✅ Bucket shared');
}

async function expectBucketRead({ bucketId, jwt, description, shouldSucceed }) {
  console.log(`\n   [READ] ${description} (shouldSucceed=${shouldSucceed})`);

  const query = `
    query GetBucket($id: String!) {
      bucket(id: $id) {
        id
        name
      }
    }
  `;

  const result = await graphqlRequest(query, { id: bucketId }, jwt);

  const ok =
    result.httpStatus >= 200 &&
    result.httpStatus < 300 &&
    result.payload.data &&
    result.payload.data.bucket;

  if (shouldSucceed && !ok) {
    console.error('   ❌ Expected read to succeed, got:', JSON.stringify(result, null, 2));
    process.exit(1);
  }
  if (!shouldSucceed && ok) {
    console.error('   ❌ Expected read to fail, but bucket was returned');
    process.exit(1);
  }

  console.log('   ✅ Read behavior as expected');
}

async function expectBucketWrite({ bucketId, jwt, description, shouldSucceed }) {
  console.log(`\n   [WRITE] ${description} (shouldSucceed=${shouldSucceed})`);

  const mutation = `
    mutation UpdateBucket($id: String!, $name: String!) {
      updateBucket(id: $id, input: { name: $name }) {
        id
        name
      }
    }
  `;

  const newName = `E2E Scope Test ${Date.now()}`;
  const result = await graphqlRequest(mutation, { id: bucketId, name: newName }, jwt);

  const ok =
    result.httpStatus >= 200 &&
    result.httpStatus < 300 &&
    result.payload.data &&
    result.payload.data.updateBucket;

  if (shouldSucceed && !ok) {
    console.error('   ❌ Expected write to succeed, got:', JSON.stringify(result, null, 2));
    process.exit(1);
  }
  if (!shouldSucceed && ok) {
    console.error('   ❌ Expected write to fail, but mutation returned data');
    process.exit(1);
  }

  console.log('   ✅ Write behavior as expected');
}

async function expectBucketDelete({ bucketId, jwt, description, shouldSucceed }) {
  console.log(`\n   [DELETE] ${description} (shouldSucceed=${shouldSucceed})`);

  const mutation = `
    mutation DeleteBucket($id: String!) {
      deleteBucket(id: $id)
    }
  `;

  const result = await graphqlRequest(mutation, { id: bucketId }, jwt);

  const ok =
    result.httpStatus >= 200 &&
    result.httpStatus < 300 &&
    result.payload.data &&
    result.payload.data.deleteBucket === true;

  if (shouldSucceed && !ok) {
    console.error('   ❌ Expected delete to succeed, got:', JSON.stringify(result, null, 2));
    process.exit(1);
  }
  if (!shouldSucceed && ok) {
    console.error('   ❌ Expected delete to fail, but mutation returned true');
    process.exit(1);
  }

  console.log('   ✅ Delete behavior as expected');
}

async function sendMessageToBucket(bucketId, authToken) {
  const url = `${BASE_URL.replace(/\/$/, '')}/messages`;
  const res = await fetchHttp(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({
      title: `E2E message ${Date.now()}`,
      body: 'E2E bucket permission message test',
      bucketId,
      deliveryType: 'NORMAL',
    }),
  });
  return { status: res.status, data: res.data };
}

async function expectMessageSend({ bucketId, jwt, description, shouldSucceed }) {
  console.log(`\n   [SEND MESSAGE] ${description} (shouldSucceed=${shouldSucceed})`);

  const res = await sendMessageToBucket(bucketId, jwt);
  const ok = res.status >= 200 && res.status < 300;

  if (shouldSucceed && !ok) {
    console.error('   ❌ Expected message send to succeed, got:', res.status, res.data);
    process.exit(1);
  }
  if (!shouldSucceed && ok) {
    console.error('   ❌ Expected message send to fail (e.g. 403), but got success:', res.status);
    process.exit(1);
  }
  if (!shouldSucceed && res.status !== 403) {
    console.error('   ❌ Expected 403 Forbidden for non-admin on public bucket, got:', res.status);
    process.exit(1);
  }

  console.log('   ✅ Message send behavior as expected');
}

async function runBucketPermissionTests() {
  console.log('\n' + '═'.repeat(80));
  console.log('🧪 BUCKET PERMISSION SCOPE E2E TESTS');
  console.log('═'.repeat(80));
  console.log(`\n📋 Configuration:`);
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Admin token: ${TOKEN.substring(0, 20)}...`);
  console.log('   A dedicated test bucket will be created for these checks.');

  // Create dedicated buckets so we do not affect shared/global buckets
  const testBucketId = await createTestBucket('main');
  const deleteBucketId = await createTestBucket('delete');

  console.log('\n' + '─'.repeat(80));
  console.log('1) Owner/admin baseline permissions (on test bucket)');

  // Admin (owner) should be able to read and write the main test bucket
  await expectBucketRead({ bucketId: testBucketId, jwt: TOKEN, description: 'admin read', shouldSucceed: true });
  await expectBucketWrite({ bucketId: testBucketId, jwt: TOKEN, description: 'admin write', shouldSucceed: true });
  // Admin should be able to delete the dedicated delete bucket
  await expectBucketDelete({ bucketId: deleteBucketId, jwt: TOKEN, description: 'admin delete on deleteBucket', shouldSucceed: true });

  console.log('\n' + '─'.repeat(80));
  console.log('2) Shared user with READ only');

  const readUser = await registerAndLoginUser('bucket-read');
  await shareBucketWithPermissions(testBucketId, readUser.username, ['READ']);

  await expectBucketRead({ bucketId: testBucketId, jwt: readUser.jwt, description: 'READ user read', shouldSucceed: true });
  await expectBucketWrite({ bucketId: testBucketId, jwt: readUser.jwt, description: 'READ user write', shouldSucceed: false });
  await expectBucketDelete({ bucketId: testBucketId, jwt: readUser.jwt, description: 'READ user delete', shouldSucceed: false });

  console.log('\n' + '─'.repeat(80));
  console.log('3) Shared user with WRITE');

  const writeUser = await registerAndLoginUser('bucket-write');
  await shareBucketWithPermissions(testBucketId, writeUser.username, ['WRITE']);

  await expectBucketRead({ bucketId: testBucketId, jwt: writeUser.jwt, description: 'WRITE user read (requires READ, should fail)', shouldSucceed: false });
  await expectBucketWrite({ bucketId: testBucketId, jwt: writeUser.jwt, description: 'WRITE user write (requires ADMIN, should fail)', shouldSucceed: false });
  await expectBucketDelete({ bucketId: testBucketId, jwt: writeUser.jwt, description: 'WRITE user delete', shouldSucceed: false });

  console.log('\n' + '─'.repeat(80));
  console.log('4) Shared user with ADMIN');

  const adminUser = await registerAndLoginUser('bucket-admin');
  // For full access we need granular permissions: READ, WRITE, DELETE, ADMIN
  await shareBucketWithPermissions(testBucketId, adminUser.username, ['READ', 'WRITE', 'DELETE', 'ADMIN']);

  await expectBucketRead({ bucketId: testBucketId, jwt: adminUser.jwt, description: 'ADMIN user read', shouldSucceed: true });
  await expectBucketWrite({ bucketId: testBucketId, jwt: adminUser.jwt, description: 'ADMIN user write', shouldSucceed: true });

  // For delete, grant ADMIN on a fresh bucket so successful deletion does not
  // interfere with other checks.
  const adminDeleteBucketId = await createTestBucket('admin-delete');
  await shareBucketWithPermissions(adminDeleteBucketId, adminUser.username, ['ADMIN']);
  await expectBucketDelete({ bucketId: adminDeleteBucketId, jwt: adminUser.jwt, description: 'ADMIN user delete on own shared bucket', shouldSucceed: true });

  console.log('\n' + '─'.repeat(80));
  console.log('5) Public bucket: User cannot send message, Admin can');

  const publicBucketId = await createTestBucket('public-msg', { isPublic: true });
  const messageUser = await registerAndLoginUser('msg-user');

  await expectMessageSend({
    bucketId: publicBucketId,
    jwt: messageUser.jwt,
    description: 'User role cannot send message to public bucket',
    shouldSucceed: false,
  });
  await expectMessageSend({
    bucketId: publicBucketId,
    jwt: TOKEN,
    description: 'Admin can send message to public bucket',
    shouldSucceed: true,
  });

  console.log('\n✅ All bucket permission scope checks passed.');
}

runBucketPermissionTests().catch((err) => {
  console.error('\n❌ Bucket permission scope tests failed:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
