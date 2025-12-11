#!/usr/bin/env node

/**
 * Configure server-side settings so that Server A uses Server B
 * as passthrough push notifications server.
 *
 * Requires:
 * - BASE_URL_A (e.g. http://localhost:3000/api/v1)
 * - PASSTHROUGH_SERVER_URL (e.g. http://localhost:4000/api/v1)
 * - PUSH_PASSTHROUGH_TOKEN (SAT raw token created on server B)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const BASE_URL_A = process.env.BASE_URL_A || 'http://localhost:3000/api/v1';
const ADMIN_USERS = process.env.ADMIN_USERS || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'admin';
const PASSTHROUGH_SERVER_URL = process.env.PASSTHROUGH_SERVER_URL || 'http://localhost:4000/api/v1';
const PASSTHROUGH_TOKEN = process.env.PUSH_PASSTHROUGH_TOKEN;

if (!PASSTHROUGH_TOKEN) {
  console.error('PUSH_PASSTHROUGH_TOKEN is required');
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

async function loginAdmin(baseUrl) {
  const identifier = ADMIN_USERS.split(',').map((s) => s.trim())[0];
  const res = await fetchHttp(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: identifier, password: ADMIN_PASSWORD }),
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Login failed: ${res.status} - ${res.data}`);
  }

  const payload = JSON.parse(res.data || '{}');
  return payload.accessToken;
}

async function batchUpdateSettings(jwt, baseUrl) {
  const query = `
    mutation BatchUpdate($settings: [BatchUpdateSettingInput!]!) {
      batchUpdateServerSettings(settings: $settings) {
        configType
        valueText
      }
    }
  `;

  const variables = {
    settings: [
      {
        configType: 'PushNotificationsPassthroughServer',
        valueText: PASSTHROUGH_SERVER_URL,
      },
      {
        configType: 'PushPassthroughToken',
        valueText: PASSTHROUGH_TOKEN,
      },
    ],
  };

  const res = await fetchHttp(`${baseUrl}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`GraphQL error: ${res.status} - ${res.data}`);
  }

  const payload = JSON.parse(res.data || '{}');
  if (payload.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(payload.errors)}`);
  }

  return payload.data?.batchUpdateServerSettings;
}

async function main() {
  console.log(`Configuring passthrough settings on ${BASE_URL_A}...`);
  const jwt = await loginAdmin(BASE_URL_A);
  const updated = await batchUpdateSettings(jwt, BASE_URL_A);
  console.log('Updated settings:', updated);
}

main().catch((err) => {
  console.error('Failed to configure passthrough settings:', err);
  process.exit(1);
});
