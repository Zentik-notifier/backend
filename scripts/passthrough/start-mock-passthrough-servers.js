#!/usr/bin/env node

/**
 * Start two mock passthrough servers used in CI e2e tests.
 *
 * Each server exposes:
 *   POST /api/v1/notifications/notify-external
 * and expects an Authorization: Bearer <token> header.
 * It responds with JSON and x-token-* headers simulating usage stats.
 */

const { createMockPassthroughServer } = require('./mock-server');

async function main() {
  const server1Port = Number(process.env.PASSTHROUGH_SERVER1_PORT || 4101);
  const server2Port = Number(process.env.PASSTHROUGH_SERVER2_PORT || 4102);

  const server1Token = process.env.PASSTHROUGH_SERVER1_TOKEN || process.env.PUSH_PASSTHROUGH_TOKEN || 'sat_mock_passthrough_1';
  const server2Token = process.env.PASSTHROUGH_SERVER2_TOKEN || 'sat_mock_passthrough_2';

  const server1 = createMockPassthroughServer({
    name: 'mock-passthrough-1',
    port: server1Port,
    expectedToken: server1Token,
    maxCalls: Number(process.env.PASSTHROUGH_SERVER1_MAX_CALLS || 100),
  });

  const server2 = createMockPassthroughServer({
    name: 'mock-passthrough-2',
    port: server2Port,
    expectedToken: server2Token,
    maxCalls: Number(process.env.PASSTHROUGH_SERVER2_MAX_CALLS || 5),
  });

  await Promise.all([server1.listen(), server2.listen()]);

  // Simple readiness line for CI logs
  console.log(`mock-passthrough-1 listening on http://localhost:${server1Port}/api/v1/notifications/notify-external`);
  console.log(`mock-passthrough-2 listening on http://localhost:${server2Port}/api/v1/notifications/notify-external`);

  // Keep process alive
  process.stdin.resume();
}

main().catch((err) => {
  console.error('Failed to start mock passthrough servers:', err);
  process.exit(1);
});
