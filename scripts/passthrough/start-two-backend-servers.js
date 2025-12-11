#!/usr/bin/env node

/**
 * Start two real backend servers on different ports and databases.
 *
 * This is intended for CI/e2e:
 * - Server A: PORT 3000, DB zentik_test_a
 * - Server B: PORT 4000, DB zentik_test_b
 *
 * Both use the same JWT secret and admin credentials provided by env.
 */

const { spawn } = require('child_process');

function startServer(name, extraEnv, logFile) {
  console.log(`Starting ${name}...`);

  const child = spawn('npm', ['start'], {
    stdio: ['ignore', 'ignore', 'ignore'],
    env: {
      ...process.env,
      ...extraEnv,
    },
  });

  child.unref();

  // Best-effort logging through separate process, so we don't tie up stdio
  if (logFile) {
    const logChild = spawn('sh', ['-c', `tail -F /proc/${child.pid}/fd/1 > ${logFile} 2>&1 || true`], {
      stdio: 'ignore',
    });
    logChild.unref();
  }

  return child.pid;
}

async function waitForHealth(url, timeoutSeconds = 90) {
  const http = require('http');

  function check() {
    return new Promise((resolve) => {
      const req = http.get(url, (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true);
        } else {
          resolve(false);
        }
        res.resume();
      });
      req.on('error', () => resolve(false));
    });
  }

  for (let i = 0; i < timeoutSeconds; i++) {
    const ok = await check();
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.warn('JWT_SECRET is not set; servers may fail to start.');
  }

  const commonEnv = {
    DB_TYPE: process.env.DB_TYPE || 'postgres',
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: process.env.DB_PORT || '5432',
    DB_USERNAME: process.env.DB_USERNAME || 'zentik_user',
    DB_PASSWORD: process.env.DB_PASSWORD || 'zentik_password',
    DB_SSL: process.env.DB_SSL || 'false',
    DB_SYNCHRONIZE: process.env.DB_SYNCHRONIZE || 'true',
    DB_DROP_SCHEMA: process.env.DB_DROP_SCHEMA || 'false',
    ADMIN_USERS: process.env.ADMIN_USERS || 'admin',
    ADMIN_DEFAULT_PASSWORD: process.env.ADMIN_DEFAULT_PASSWORD || 'admin',
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    NODE_ENV: process.env.NODE_ENV || 'test',
  };

  const serverAEnv = {
    ...commonEnv,
    DB_NAME: process.env.DB_NAME_A || 'zentik_test_a',
    PORT: process.env.PORT_A || '3000',
    PUBLIC_BACKEND_URL: process.env.PUBLIC_BACKEND_URL_A || 'http://localhost:3000',
    PUBLIC_UI_URL: process.env.PUBLIC_UI_URL_A || 'http://localhost:3000',
  };

  const serverBEnv = {
    ...commonEnv,
    DB_NAME: process.env.DB_NAME_B || 'zentik_test_b',
    PORT: process.env.PORT_B || '4000',
    PUBLIC_BACKEND_URL: process.env.PUBLIC_BACKEND_URL_B || 'http://localhost:4000',
    PUBLIC_UI_URL: process.env.PUBLIC_UI_URL_B || 'http://localhost:4000',
  };

  const serverAPid = startServer('Server A (port 3000)', serverAEnv, 'server-a.log');
  const serverBPid = startServer('Server B (port 4000)', serverBEnv, 'server-b.log');

  console.log(`SERVER_A_PID=${serverAPid}`);
  console.log(`SERVER_B_PID=${serverBPid}`);

  // Expose PIDs to CI
  if (process.env.GITHUB_ENV) {
    const fs = require('fs');
    fs.appendFileSync(process.env.GITHUB_ENV, `SERVER_A_PID=${serverAPid}\n`);
    fs.appendFileSync(process.env.GITHUB_ENV, `SERVER_B_PID=${serverBPid}\n`);
  }

  console.log('Waiting for servers health...');

  const aOk = await waitForHealth('http://localhost:3000/health');
  const bOk = await waitForHealth('http://localhost:4000/health');

  if (!aOk || !bOk) {
    console.error('One or both servers failed to become healthy in time.');
    process.exit(1);
  }

  console.log('Both servers are healthy.');
}

main().catch((err) => {
  console.error('Failed to start two backend servers:', err);
  process.exit(1);
});
