#!/usr/bin/env node

/**
 * Dummy NTFY server for E2E tests.
 * - GET /topic1,topic2,.../sse → SSE stream; backend subscribes here.
 * - POST /topic → Publish (backend sends here); records payload and emits 'publish'.
 * - emitIncoming(topic, payload) → Inject a message into SSE so backend receives it (simulates external publish).
 *
 * Usage:
 *   const { createMockNtfyServer } = require('./mock-ntfy-server');
 *   const mock = createMockNtfyServer({ port: 9999 });
 *   mock.events.on('publish', (data) => { ... });
 *   await mock.listen();
 *   mock.emitIncoming('my-topic', { title: 'Hi', message: 'Body' });
 *   await mock.close();
 */

const http = require('http');
const { EventEmitter } = require('events');

function createMockNtfyServer({ port = 9999, auth }) {
  const events = new EventEmitter();
  const published = [];
  const sseClients = new Map();

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '', `http://localhost:${port}`);
    const pathname = url.pathname.replace(/^\/+/, '');

    if (auth) {
      const authHeader = req.headers['authorization'] || '';
      const valid =
        (auth.basic && authHeader === `Basic ${auth.basic}`) ||
        (auth.bearer && authHeader === `Bearer ${auth.bearer}`);
      if (!valid) {
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
    }

    if (req.method === 'GET' && pathname.endsWith('/sse')) {
      const topics = pathname.replace(/\/sse$/, '').split(',').map((t) => decodeURIComponent(t));
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      const clientId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sseClients.set(clientId, { res, topics });
      req.on('close', () => sseClients.delete(clientId));
      events.emit('subscribe', { topics, clientId });
      return;
    }

    if (req.method === 'POST' && pathname.length > 0 && !pathname.includes(',')) {
      const topic = decodeURIComponent(pathname);
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        const headers = {
          title: req.headers['x-title'],
          priority: req.headers['x-priority'],
          tags: req.headers['x-tags'],
          click: req.headers['x-click'],
          icon: req.headers['x-icon'],
          attach: req.headers['x-attach'],
        };
        const payload = { topic, body, headers };
        published.push(payload);
        events.emit('publish', payload);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
      });
      return;
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  return {
    events,
    published: () => [...published],
    clearPublished: () => published.length = 0,

    emitIncoming(topic, message) {
      const event = {
        id: `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        time: Math.floor(Date.now() / 1000),
        event: 'message',
        topic,
        title: message.title,
        message: message.message || message.body,
        priority: message.priority ?? 3,
        tags: message.tags,
        click: message.click,
        icon: message.icon,
        attachment: message.attachment,
      };
      const line = `data: ${JSON.stringify(event)}\n\n`;
      for (const [, client] of sseClients) {
        if (client.topics.includes(topic)) {
          client.res.write(line);
        }
      }
      events.emit('incoming', event);
    },

    listen() {
      return new Promise((resolve, reject) => {
        server.listen(port, () => {
          console.log(`[mock-ntfy] Listening on http://localhost:${port}`);
          resolve(server);
        });
        server.on('error', reject);
      });
    },

    close() {
      return new Promise((resolve) => {
        for (const [, client] of sseClients) {
          try {
            client.res.end();
          } catch (_) {}
        }
        sseClients.clear();
        server.close(() => resolve());
      });
    },
  };
}

module.exports = { createMockNtfyServer };

if (require.main === module) {
  const port = Number(process.env.NTFY_MOCK_PORT || 9999);
  const mock = createMockNtfyServer({ port });
  mock.events.on('publish', (p) => console.log('[mock-ntfy] publish', p));
  mock.events.on('subscribe', (s) => console.log('[mock-ntfy] subscribe', s));
  mock.listen().then(() => {
    console.log('Mock NTFY server running. Ctrl+C to stop.');
  });
  process.on('SIGINT', () => mock.close().then(() => process.exit(0)));
}
