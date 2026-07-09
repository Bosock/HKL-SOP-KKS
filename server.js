/* ============================================================
   HKL Standards — backend server (zero dependencies)

   Replaces the previous static nginx image. It does two jobs:

     1. Serves the single-page app (index.html) and the standards
        data (data/*.json) with gzip, cache and security headers —
        i.e. everything the old nginx.conf did.

     2. Provides a tiny persistence API so that edits made in the web
        interface (categories, corrections, renames, sub-categories,
        display settings, material care) survive on the SERVER and are
        shared across all devices — not just in one browser's
        localStorage.

   State is a single JSON document persisted to STATE_DIR/state.json on
   a Docker volume, so it outlives container redeploys. Writes are a
   top-level key merge (last write wins per key) which keeps concurrent
   editors from clobbering each other's *different* keys.
   ============================================================ */
'use strict';
const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '80', 10);
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(__dirname, 'public');
const STATE_DIR = process.env.STATE_DIR || path.join(__dirname, 'state');
const STATE_FILE = path.join(STATE_DIR, 'state.json');
// Care photos are stored as base64 data URLs inside the state blob, so the
// body can get large. 32 MiB gives generous head-room; tune via MAX_BODY.
const MAX_BODY = parseInt(process.env.MAX_BODY || String(32 * 1024 * 1024), 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.txt':  'text/plain; charset=utf-8',
};
const COMPRESSIBLE = /^(text\/|application\/(json|javascript|xml)|image\/svg)/;
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

/* ---------- state (in-memory cache + write-through) ---------- */
let STATE = { rev: 0, updatedAt: null, state: {} };
let writeChain = Promise.resolve(); // serialise writes to the state file

async function loadState() {
  try {
    const raw = await fsp.readFile(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.state && typeof parsed.state === 'object') {
      STATE = { rev: parsed.rev || 0, updatedAt: parsed.updatedAt || null, state: parsed.state };
    }
    console.log(`[state] loaded rev=${STATE.rev} keys=${Object.keys(STATE.state).length}`);
  } catch (e) {
    if (e.code === 'ENOENT') console.log('[state] no existing state file — starting empty');
    else console.error('[state] failed to load, starting empty:', e.message);
    STATE = { rev: 0, updatedAt: null, state: {} };
  }
}

// Atomic-ish write: write to a temp file then rename over the target.
function persist() {
  const snapshot = JSON.stringify(STATE);
  writeChain = writeChain.then(async () => {
    const tmp = STATE_FILE + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
    await fsp.writeFile(tmp, snapshot, 'utf8');
    await fsp.rename(tmp, STATE_FILE);
  }).catch(err => console.error('[state] write failed:', err.message));
  return writeChain;
}

/* ---------- helpers ---------- */
function sendJSON(req, res, code, obj) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  const headers = Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  }, SECURITY_HEADERS);
  maybeGzip(req, res, code, headers, body, 'application/json');
}

function maybeGzip(req, res, code, headers, body, contentType) {
  const ae = req.headers['accept-encoding'] || '';
  if (body.length >= 1024 && /\bgzip\b/.test(ae) && COMPRESSIBLE.test(contentType)) {
    zlib.gzip(body, (err, gz) => {
      if (err) { headers['Content-Length'] = body.length; res.writeHead(code, headers); res.end(body); return; }
      headers['Content-Encoding'] = 'gzip';
      headers['Vary'] = 'Accept-Encoding';
      headers['Content-Length'] = gz.length;
      res.writeHead(code, headers);
      res.end(req.method === 'HEAD' ? undefined : gz);
    });
  } else {
    headers['Content-Length'] = body.length;
    res.writeHead(code, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error('payload too large'), { code: 'TOO_LARGE' })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/* ---------- API: /api/state ---------- */
async function handleState(req, res, url) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    const since = parseInt(url.searchParams.get('since') || '', 10);
    if (Number.isFinite(since) && since === STATE.rev) {
      sendJSON(req, res, 200, { rev: STATE.rev, unchanged: true });
      return;
    }
    sendJSON(req, res, 200, { rev: STATE.rev, updatedAt: STATE.updatedAt, state: STATE.state });
    return;
  }
  if (req.method === 'PUT' || req.method === 'POST') {
    let body;
    try { body = await readBody(req); }
    catch (e) {
      if (e.code === 'TOO_LARGE') { sendJSON(req, res, 413, { error: 'payload too large' }); return; }
      sendJSON(req, res, 400, { error: 'read error' }); return;
    }
    let payload;
    try { payload = JSON.parse(body.toString('utf8') || '{}'); }
    catch (e) { sendJSON(req, res, 400, { error: 'invalid JSON' }); return; }
    const incoming = payload && typeof payload.state === 'object' && payload.state ? payload.state : null;
    if (!incoming) { sendJSON(req, res, 400, { error: 'missing state object' }); return; }
    // Top-level key merge: only the keys the client sends are replaced.
    // Keys another client changed but this client did not send stay intact.
    STATE.state = Object.assign({}, STATE.state, incoming);
    STATE.rev += 1;
    STATE.updatedAt = new Date().toISOString();
    persist();
    // Return the full authoritative state so the client converges on any
    // keys other editors changed in the meantime.
    sendJSON(req, res, 200, { rev: STATE.rev, updatedAt: STATE.updatedAt, state: STATE.state });
    return;
  }
  res.writeHead(405, Object.assign({ 'Allow': 'GET, PUT, POST' }, SECURITY_HEADERS));
  res.end('method not allowed');
}

/* ---------- static files ---------- */
function safeJoin(root, reqPath) {
  const decoded = decodeURIComponent(reqPath.split('?')[0]);
  const p = path.normalize(path.join(root, decoded));
  if (p !== root && !p.startsWith(root + path.sep)) return null; // path traversal guard
  return p;
}

async function serveFile(req, res, filePath, { spaFallback = true } = {}) {
  let stat;
  try {
    stat = await fsp.stat(filePath);
    if (stat.isDirectory()) { filePath = path.join(filePath, 'index.html'); stat = await fsp.stat(filePath); }
  } catch (e) {
    if (spaFallback) { return serveFile(req, res, path.join(PUBLIC_DIR, 'index.html'), { spaFallback: false }); }
    res.writeHead(404, SECURITY_HEADERS); res.end('not found'); return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const headers = Object.assign({ 'Content-Type': type }, SECURITY_HEADERS);
  // index.html and data files change on redeploy — always revalidate.
  if (ext === '.html' || filePath.includes(path.sep + 'data' + path.sep)) headers['Cache-Control'] = 'no-cache';
  else headers['Cache-Control'] = 'public, max-age=3600';
  let body;
  try { body = await fsp.readFile(filePath); }
  catch (e) { res.writeHead(500, SECURITY_HEADERS); res.end('read error'); return; }
  maybeGzip(req, res, 200, headers, body, type);
}

/* ---------- router ---------- */
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;

    if (pathname === '/healthz') {
      res.writeHead(200, Object.assign({ 'Content-Type': 'text/plain' }, SECURITY_HEADERS));
      res.end('ok\n');
      return;
    }
    if (pathname === '/api/state') { await handleState(req, res, url); return; }
    if (pathname.startsWith('/api/')) { sendJSON(req, res, 404, { error: 'unknown endpoint' }); return; }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, SECURITY_HEADERS); res.end('method not allowed'); return;
    }
    const filePath = safeJoin(PUBLIC_DIR, pathname === '/' ? '/index.html' : pathname);
    if (!filePath) { res.writeHead(400, SECURITY_HEADERS); res.end('bad path'); return; }
    await serveFile(req, res, filePath);
  } catch (e) {
    console.error('[req] error:', e && e.message);
    if (!res.headersSent) { res.writeHead(500, SECURITY_HEADERS); res.end('server error'); }
  }
});

async function main() {
  await fsp.mkdir(STATE_DIR, { recursive: true });
  await loadState();
  server.listen(PORT, () => console.log(`[server] listening on :${PORT} (public=${PUBLIC_DIR}, state=${STATE_FILE})`));
}

['SIGTERM', 'SIGINT'].forEach(sig => process.on(sig, () => {
  console.log(`[server] ${sig} — flushing state and exiting`);
  writeChain.finally(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}));

main().catch(err => { console.error('[server] fatal:', err); process.exit(1); });
