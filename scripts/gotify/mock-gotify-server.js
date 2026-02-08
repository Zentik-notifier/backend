#!/usr/bin/env node

/**
 * Mock Gotify server for E2E tests.
 * - POST /message?token=<token> → Records JSON body and returns { id: 1 }; emits 'publish'.
 *
 * Usage:
 *   const { createMockGotifyServer } = require('./mock-gotify-server');
 *   const mock = createMockGotifyServer({ port: 9998 });
 *   mock.events.on('publish', (data) => { ... });
 *   await mock.listen();
 *   await mock.close();
 */

const http = require('http');
const { EventEmitter } = require('events');

function createMockGotifyServer({ port = 9998, validToken = null } = {}) {
  const events = new EventEmitter();
  const published = [];

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '', `http://localhost:${port}`);
    const pathname = url.pathname.replace(/^\/+/, '');
    const token = url.searchParams.get('token');

    if (req.method === 'POST' && pathname === 'message') {
      if (validToken != null && token !== validToken) {
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        let payload;
        try {
          payload = JSON.parse(body || '{}');
        } catch {
          payload = { message: body };
        }
        const record = { token, payload };
        published.push(record);
        events.emit('publish', record);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: published.length }));
      });
      return;
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  let listening = false;

  return {
    events,
    published: () => [...published],
    clearPublished: () => published.length = 0,

    listen() {
      return new Promise((resolve, reject) => {
        if (listening) return resolve();
        server.listen(port, () => {
          listening = true;
          resolve();
        });
        server.on('error', reject);
      });
    },

    close() {
      return new Promise((resolve) => {
        if (!listening) return resolve();
        server.close(() => {
          listening = false;
          resolve();
        });
      });
    },
  };
}

module.exports = { createMockGotifyServer };
