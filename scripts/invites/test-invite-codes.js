#!/usr/bin/env node

/**
 * E2E tests for invite codes (bucket access invites).
 *
 * Scenarios covered:
 * - Limited invite (maxUses > 0):
 *   - Redeem within limit (multiple different users) succeeds.
 *   - Redeem beyond limit fails with appropriate error.
 * - Unlimited invite (maxUses = null):
 *   - Multiple different users can redeem successfully.
 * - Expired invite:
 *   - Redeem before expiration succeeds.
 *   - Redeem after expiration fails with appropriate error.
 * - Invalid invite code:
 *   - Redeem unknown code fails with "Invalid invite code".
 * - Already-has-permissions:
 *   - Same user tries to redeem the same invite code twice and the second redemption fails.
 *
 * Environment variables:
 * - BASE_URL  (e.g. http://localhost:3000/api/v1)
 * - TOKEN     (admin access token zat_... with ADMIN on BUCKET_ID)
 * - BUCKET_ID (bucket which admin has ADMIN permission on)
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const TOKEN = process.env.TOKEN;
const BUCKET_ID = process.env.BUCKET_ID;

if (!TOKEN) {
  console.error('❌ TOKEN environment variable is required');
  process.exit(1);
}

if (!BUCKET_ID) {
  console.error('❌ BUCKET_ID environment variable is required');
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

async function graphqlRequest(query, variables, authToken = TOKEN) {
  const res = await fetchHttp(`${BASE_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
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

async function registerAndLoginUser(prefix) {
  const timestamp = Date.now();
  const username = `${prefix}-${timestamp}`;
  const email = `${username}@example.com`;
  const password = 'E2eInviteUser1!';

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
  return { username, email, password, jwt: userJwt };
}

async function createInviteCode({ maxUses, expiresInMs, permissions = ['READ', 'WRITE'] }) {
  console.log(`\n🧾 Creating invite code (maxUses=${maxUses ?? 'unlimited'}, expiresInMs=${expiresInMs ?? 'none'})...`);

  let expiresAt = null;
  if (typeof expiresInMs === 'number') {
    expiresAt = new Date(Date.now() + expiresInMs).toISOString();
  }

  const mutation = `
    mutation CreateInvite($input: CreateInviteCodeInput!) {
      createInviteCode(input: $input) {
        id
        code
        resourceType
        resourceId
        permissions
        maxUses
        usageCount
      }
    }
  `;

  const input = {
    resourceType: 'BUCKET',
    resourceId: BUCKET_ID,
    permissions,
  };

  if (maxUses !== undefined && maxUses !== null) {
    input.maxUses = maxUses;
  }
  if (expiresAt) {
    input.expiresAt = expiresAt;
  }

  const data = await graphqlRequest(mutation, { input });
  const invite = data?.createInviteCode;
  if (!invite || !invite.code) {
    console.error('   ❌ Failed to create invite code, unexpected response:', JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log(`   ✅ Invite code created: code=${invite.code}, id=${invite.id}`);
  return invite;
}

async function fetchInviteCodeById(id) {
  const query = `
    query GetInvite($id: String!) {
      inviteCode(id: $id) {
        id
        code
        maxUses
        usageCount
      }
    }
  `;

  const data = await graphqlRequest(query, { id });
  return data?.inviteCode;
}

async function redeemInviteCodeAsUser(jwt, code, expected) {
  const { expectedSuccess, expectedErrorContains, description } = expected;
  console.log(`\n➡️  Redeeming invite code as ${description} (expected success=${expectedSuccess})...`);

  const mutation = `
    mutation RedeemInvite($input: RedeemInviteCodeInput!) {
      redeemInviteCode(input: $input) {
        success
        error
        resourceType
        resourceId
        permissions
      }
    }
  `;

  const data = await graphqlRequest(mutation, { input: { code } }, jwt);
  const result = data?.redeemInviteCode;
  if (!result) {
    console.error('   ❌ redeemInviteCode returned no result');
    process.exit(1);
  }

  console.log(`   ↪ success=${result.success}, error=${result.error || 'none'}`);

  if (result.success !== expectedSuccess) {
    console.error(`   ❌ Expected success=${expectedSuccess}, got ${result.success}`);
    process.exit(1);
  }

  if (expectedErrorContains) {
    if (!result.error || !result.error.includes(expectedErrorContains)) {
      console.error(
        `   ❌ Expected error to contain "${expectedErrorContains}", got: ${result.error || 'none'}`,
      );
      process.exit(1);
    }
  }

  if (expectedSuccess) {
    if (result.resourceType !== 'BUCKET' || result.resourceId !== BUCKET_ID) {
      console.error(
        `   ❌ Expected resourceType=BUCKET and resourceId=${BUCKET_ID}, got:`,
        result.resourceType,
        result.resourceId,
      );
      process.exit(1);
    }
  }

  console.log('   ✅ Redemption result as expected');
  return result;
}

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runInviteCodeTests() {
  console.log('\n' + '═'.repeat(80));
  console.log('🧪 INVITE CODES E2E TESTS');
  console.log('═'.repeat(80));
  console.log(`\n📋 Configuration:`);
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Token: ${TOKEN.substring(0, 20)}...`);
  console.log(`   Bucket ID: ${BUCKET_ID}`);

  // 1) Limited invite (maxUses = 2)
  console.log('\n' + '─'.repeat(80));
  console.log('1) Limited invite (maxUses = 2)');

  const limitedInvite = await createInviteCode({ maxUses: 2 });

  // Two different users redeem successfully
  const user1 = await registerAndLoginUser('invite-limited-1');
  await redeemInviteCodeAsUser(user1.jwt, limitedInvite.code, {
    expectedSuccess: true,
    expectedErrorContains: null,
    description: 'user1 (first redemption within limit)',
  });

  const user2 = await registerAndLoginUser('invite-limited-2');
  await redeemInviteCodeAsUser(user2.jwt, limitedInvite.code, {
    expectedSuccess: true,
    expectedErrorContains: null,
    description: 'user2 (second redemption within limit)',
  });

  // Third user should hit maxUses limit
  const user3 = await registerAndLoginUser('invite-limited-3');
  await redeemInviteCodeAsUser(user3.jwt, limitedInvite.code, {
    expectedSuccess: false,
    expectedErrorContains: 'Invite code has reached maximum uses',
    description: 'user3 (beyond maxUses)',
  });

  const limitedFromDb = await fetchInviteCodeById(limitedInvite.id);
  if (!limitedFromDb || limitedFromDb.usageCount !== 2) {
    console.error(
      `   ❌ Expected limited invite usageCount=2, got: ${limitedFromDb ? limitedFromDb.usageCount : 'undefined'}`,
    );
    process.exit(1);
  }
  console.log('   ✅ Limited invite usageCount correctly updated to 2');

  // 2) Unlimited invite (maxUses = null)
  console.log('\n' + '─'.repeat(80));
  console.log('2) Unlimited invite (maxUses = null)');

  const unlimitedInvite = await createInviteCode({ maxUses: null });

  const u1 = await registerAndLoginUser('invite-unlimited-1');
  await redeemInviteCodeAsUser(u1.jwt, unlimitedInvite.code, {
    expectedSuccess: true,
    expectedErrorContains: null,
    description: 'u1 (unlimited 1)',
  });

  const u2 = await registerAndLoginUser('invite-unlimited-2');
  await redeemInviteCodeAsUser(u2.jwt, unlimitedInvite.code, {
    expectedSuccess: true,
    expectedErrorContains: null,
    description: 'u2 (unlimited 2)',
  });

  const unlimitedFromDb = await fetchInviteCodeById(unlimitedInvite.id);
  if (!unlimitedFromDb || unlimitedFromDb.usageCount !== 2 || unlimitedFromDb.maxUses !== null) {
    console.error(
      `   ❌ Expected unlimited invite usageCount=2 and maxUses=null, got: usageCount=${
        unlimitedFromDb ? unlimitedFromDb.usageCount : 'undefined'
      }, maxUses=${unlimitedFromDb ? unlimitedFromDb.maxUses : 'undefined'}`,
    );
    process.exit(1);
  }
  console.log('   ✅ Unlimited invite usageCount and maxUses correctly set');

  // 3) Already-has-permissions: same user tries to redeem twice
  console.log('\n' + '─'.repeat(80));
  console.log('3) Already-has-permissions scenario');

  const dupUser = await registerAndLoginUser('invite-dup');
  const dupInvite = await createInviteCode({ maxUses: 5 });

  await redeemInviteCodeAsUser(dupUser.jwt, dupInvite.code, {
    expectedSuccess: true,
    expectedErrorContains: null,
    description: 'dupUser first redemption',
  });

  await redeemInviteCodeAsUser(dupUser.jwt, dupInvite.code, {
    expectedSuccess: false,
    expectedErrorContains: 'You already have all the permissions this invite code would grant',
    description: 'dupUser second redemption (should fail)',
  });

  // 4) Expired invite: short TTL
  console.log('\n' + '─'.repeat(80));
  console.log('4) Expired invite scenario');

  const expireInvite = await createInviteCode({ maxUses: 5, expiresInMs: 2000 });

  const expUser1 = await registerAndLoginUser('invite-exp-1');
  await redeemInviteCodeAsUser(expUser1.jwt, expireInvite.code, {
    expectedSuccess: true,
    expectedErrorContains: null,
    description: 'expUser1 before expiration',
  });

  console.log('   ⏲ Waiting for invite to expire...');
  await delay(3000);

  const expUser2 = await registerAndLoginUser('invite-exp-2');
  await redeemInviteCodeAsUser(expUser2.jwt, expireInvite.code, {
    expectedSuccess: false,
    expectedErrorContains: 'Invite code has expired',
    description: 'expUser2 after expiration',
  });

  // 5) Invalid invite code
  console.log('\n' + '─'.repeat(80));
  console.log('5) Invalid invite code scenario');

  const invalidUser = await registerAndLoginUser('invite-invalid');
  await redeemInviteCodeAsUser(invalidUser.jwt, 'INVALIDCODE1234', {
    expectedSuccess: false,
    expectedErrorContains: 'Invalid invite code',
    description: 'invalid code redemption',
  });

  console.log('\n✅ All invite code scenarios tested successfully.');
}

runInviteCodeTests().catch((err) => {
  console.error('\n❌ Invite code tests failed:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
