import http from 'node:http';
import https from 'node:https';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';
import { loadConfig } from './config.js';
import { createMemoryProvider } from './memoryProvider.js';
import { createGoogleProvider } from './googleProvider.js';
import type { ScheduleProvider } from './types.js';

// One process = API + static hosting for the panel dist. The TSS-1070 kiosk
// mode requires HTTPS, so production runs with TLS_CERT/TLS_KEY set.

const config = loadConfig();
const provider: ScheduleProvider =
  config.provider === 'google'
    ? createGoogleProvider(config.keyFile, config.calendarId)
    : createMemoryProvider();

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon'
};

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(body));
}

async function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function clampMinutes(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(5, Math.min(480, Math.round(n)));
}

async function handleApi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  path: string
): Promise<void> {
  try {
    if (req.method === 'GET' && path === '/api/state') {
      sendJson(res, 200, await provider.getRoomState(Date.now()));
      return;
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      switch (path) {
        case '/api/reserve': {
          const meeting = await provider.reserveNow(
            clampMinutes(body.minutes, 30),
            typeof body.title === 'string' && body.title.trim() ? body.title.trim() : undefined
          );
          sendJson(res, 200, meeting);
          return;
        }
        case '/api/end':
          await provider.endCurrent();
          sendJson(res, 200, { ok: true });
          return;
        case '/api/extend':
          sendJson(res, 200, await provider.extendCurrent(clampMinutes(body.minutes, 15)));
          return;
        case '/api/checkin':
          await provider.checkIn();
          sendJson(res, 200, { ok: true });
          return;
      }
    }
    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    sendJson(res, 409, { error: err instanceof Error ? err.message : String(err) });
  }
}

function handleStatic(res: http.ServerResponse, path: string): void {
  const rel = path === '/' ? 'index.html' : path.slice(1);
  const file = normalize(join(config.staticDir, rel));
  if (!file.startsWith(normalize(config.staticDir)) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
}

const listener: http.RequestListener = (req, res) => {
  const path = (req.url ?? '/').split('?')[0];
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }
  if (path.startsWith('/api/')) {
    void handleApi(req, res, path);
    return;
  }
  if (config.staticDir) {
    handleStatic(res, path);
    return;
  }
  sendJson(res, 404, { error: 'API only — set STATIC_DIR to serve the panel app' });
};

const server =
  config.tlsCert && config.tlsKey
    ? https.createServer(
        { cert: readFileSync(config.tlsCert), key: readFileSync(config.tlsKey) },
        listener
      )
    : http.createServer(listener);

server.listen(config.port, () => {
  const proto = config.tlsCert && config.tlsKey ? 'https' : 'http';
  console.log(
    `[scheduling-backend] ${proto}://0.0.0.0:${config.port} provider=${config.provider}` +
      (config.staticDir ? ` static=${config.staticDir}` : ' (API only)')
  );
});
