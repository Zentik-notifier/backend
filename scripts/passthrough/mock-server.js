const http = require('http');

function createMockPassthroughServer({
  name,
  port,
  basePath = '/api/v1',
  expectedToken,
  maxCalls = 100,
}) {
  const usageByToken = new Map();

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);

    if (req.method !== 'POST' || url.pathname !== `${basePath}/notifications/notify-external`) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, message: 'Not found' }));
      return;
    }

    const auth = req.headers['authorization'] || '';
    const token = auth.startsWith('Bearer ') ? auth.substring('Bearer '.length) : null;

    if (!token || (expectedToken && token !== expectedToken)) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, message: 'Unauthorized: invalid passthrough token' }));
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        // basic protection
        req.destroy();
      }
    });

    req.on('end', () => {
      let payload;
      try {
        payload = body ? JSON.parse(body) : {};
      } catch {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, message: 'Invalid JSON body' }));
        return;
      }

      const now = new Date();
      const stats = usageByToken.get(token) || {
        id: `${name || 'token'}-${token.slice(0, 8)}`,
        calls: 0,
        maxCalls,
        totalCalls: 0,
        lastReset: now.toISOString(),
      };

      stats.calls += 1;
      stats.totalCalls += 1;
      stats.lastReset = stats.lastReset || now.toISOString();
      usageByToken.set(token, stats);

      const remaining = stats.maxCalls - stats.calls;

      // headers modelled after SystemTokenUsageStats
      res.setHeader('x-token-id', stats.id);
      res.setHeader('x-token-calls', String(stats.calls));
      res.setHeader('x-token-maxcalls', String(stats.maxCalls));
      res.setHeader('x-token-totalcalls', String(stats.totalCalls));
      res.setHeader('x-token-lastreset', stats.lastReset);
      res.setHeader('x-token-remaining', String(remaining));

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          success: true,
          message: `${name || 'mock-server'} accepted notification`,
          platform: payload?.platform || null,
          receivedAt: now.toISOString(),
        }),
      );
    });
  });

  return {
    listen: () =>
      new Promise((resolve, reject) => {
        server.listen(port, () => resolve(server));
        server.on('error', reject);
      }),
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      }),
  };
}

module.exports = { createMockPassthroughServer };
