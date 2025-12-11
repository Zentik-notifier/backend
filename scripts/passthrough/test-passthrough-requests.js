#!/usr/bin/env node

/**
 * Small e2e-style test that exercises the two mock passthrough servers
 * by sending requests with Bearer tokens and asserting responses.
 *
 * Intended to be run in CI after `start-mock-passthrough-servers.js`.
 */

const http = require('http');

function jsonRequest({ url, method = 'POST', token, body }) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);

    const data = JSON.stringify(body || {});

    const options = {
      hostname: target.hostname,
      port: target.port || 80,
      path: target.pathname + target.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    if (token) {
      options.headers.Authorization = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = raw ? JSON.parse(raw) : null;
        } catch {
          // ignore
        }

        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed,
        });
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  const server1Port = Number(process.env.PASSTHROUGH_SERVER1_PORT || 4101);
  const server2Port = Number(process.env.PASSTHROUGH_SERVER2_PORT || 4102);

  const server1Token = process.env.PASSTHROUGH_SERVER1_TOKEN || process.env.PUSH_PASSTHROUGH_TOKEN || 'sat_mock_passthrough_1';
  const server2Token = process.env.PASSTHROUGH_SERVER2_TOKEN || 'sat_mock_passthrough_2';

  const base1 = `http://localhost:${server1Port}/api/v1/notifications/notify-external`;
  const base2 = `http://localhost:${server2Port}/api/v1/notifications/notify-external`;

  console.log('Testing mock passthrough server #1 ...');
  const res1 = await jsonRequest({
    url: base1,
    token: server1Token,
    body: { platform: 'WEB', payload: { title: 'Test', body: 'Hello' } },
  });

  if (res1.status !== 200 || !res1.body?.success) {
    console.error('Server #1 did not respond with success:', res1);
    process.exit(1);
  }

  if (!res1.headers['x-token-id']) {
    console.error('Server #1 did not return x-token-* headers:', res1.headers);
    process.exit(1);
  }

  console.log('Server #1 OK, x-token-id =', res1.headers['x-token-id']);

  console.log('Testing mock passthrough server #2 ...');
  const res2 = await jsonRequest({
    url: base2,
    token: server2Token,
    body: { platform: 'WEB', payload: { title: 'Test 2', body: 'World' } },
  });

  if (res2.status !== 200 || !res2.body?.success) {
    console.error('Server #2 did not respond with success:', res2);
    process.exit(1);
  }

  if (!res2.headers['x-token-id']) {
    console.error('Server #2 did not return x-token-* headers:', res2.headers);
    process.exit(1);
  }

  console.log('Server #2 OK, x-token-id =', res2.headers['x-token-id']);
  console.log('✅ Passthrough mock servers responded correctly');
}

run().catch((err) => {
  console.error('Passthrough test failed:', err);
  process.exit(1);
});
