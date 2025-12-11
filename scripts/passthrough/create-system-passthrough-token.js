#!/usr/bin/env node

/**
 * Create a System Access Token with `passthrough` scope on a target backend.
 *
 * Requires:
 * - BASE_URL (e.g. http://localhost:4000/api/v1)
 * - ADMIN_USERS, ADMIN_DEFAULT_PASSWORD (for /auth/login)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000/api/v1';
const ADMIN_USERS = process.env.ADMIN_USERS || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'admin';

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

async function loginAdmin() {
  const identifier = ADMIN_USERS.split(',').map((s) => s.trim())[0];
  if (!identifier) throw new Error('No ADMIN_USERS configured');

  const body = JSON.stringify({ username: identifier, password: ADMIN_PASSWORD });

  const res = await fetchHttp(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Login failed: ${res.status} - ${res.data}`);
  }

  const payload = JSON.parse(res.data || '{}');
  return payload.accessToken;
}

async function createSystemToken(jwt) {
  const query = `
    mutation CreateSystemToken($scopes: [String!]) {
      createSystemToken(maxCalls: 1000, scopes: $scopes) {
        id
        rawToken
      }
    }
  `;

  const res = await fetchHttp(`${BASE_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ query, variables: { scopes: ['passthrough'] } }),
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`GraphQL error: ${res.status} - ${res.data}`);
  }

  const payload = JSON.parse(res.data || '{}');
  if (payload.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(payload.errors)}`);
  }

  return payload.data?.createSystemToken;
}

async function main() {
  console.log(`Creating passthrough System Access Token on ${BASE_URL}...`);
  const jwt = await loginAdmin();
  const token = await createSystemToken(jwt);

  if (!token?.rawToken) {
    throw new Error('No rawToken returned from createSystemToken');
  }

  console.log('System Access Token created:');
  console.log(`ID: ${token.id}`);
  console.log(`RAW TOKEN: ${token.rawToken}`);

  if (process.env.GITHUB_ENV) {
    const fs = require('fs');
    fs.appendFileSync(process.env.GITHUB_ENV, `PUSH_PASSTHROUGH_TOKEN=${token.rawToken}\n`);
  }
}

main().catch((err) => {
  console.error('Failed to create passthrough System Access Token:', err);
  process.exit(1);
});
