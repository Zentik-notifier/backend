#!/usr/bin/env node

/**
 * High-level E2E check: send a notification from Server A,
 * which should use passthrough to Server B via System Access Token.
 *
 * Requires:
 * - BASE_URL_A (e.g. http://localhost:3000/api/v1)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const BASE_URL_A = process.env.BASE_URL_A || 'http://localhost:3000/api/v1';

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

async function main() {
  console.log('Testing passthrough flow from Server A...');

  const res = await fetchHttp(`${BASE_URL_A}/notifications/test-passthrough`, {
    method: 'POST',
  });

  if (res.status < 200 || res.status >= 300) {
    console.error(`Passthrough test endpoint failed: ${res.status} - ${res.data}`);
    process.exit(1);
  }

  console.log('Passthrough test response:', res.data);
}

main().catch((err) => {
  console.error('Passthrough flow test failed:', err);
  process.exit(1);
});
