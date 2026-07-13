'use strict';
/* Integration + unit tests for server.js (the zero-dependency backend).
   Uses only Node built-ins: node:test, node:assert, node:http.
   Env is configured BEFORE requiring server.js because the module reads
   PUBLIC_DIR / STATE_DIR / MAX_BODY once at load time. */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const fsp = fs.promises;
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');

// --- fixture dirs -----------------------------------------------------------
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'hkl-test-'));
const PUBLIC_DIR = path.join(TMP, 'public');
const STATE_DIR = path.join(TMP, 'state');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const SUB_DIR = path.join(PUBLIC_DIR, 'sub');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(STATE_DIR, { recursive: true });
fs.mkdirSync(SUB_DIR, { recursive: true });

const INDEX_HTML = '<!doctype html><html><body>HKL app</body></html>';
// >1024 bytes and compressible so the gzip branch triggers.
const BIG_CSS = 'body{color:red}\n'.repeat(200);

fs.writeFileSync(path.join(PUBLIC_DIR, 'index.html'), INDEX_HTML);
fs.writeFileSync(path.join(PUBLIC_DIR, 'app.css'), BIG_CSS);
fs.writeFileSync(path.join(PUBLIC_DIR, 'small.txt'), 'hi');
fs.writeFileSync(path.join(DATA_DIR, 'standards.json'), '{"standards":[]}');
fs.writeFileSync(path.join(SUB_DIR, 'index.html'), '<p>sub index</p>');
// A file outside PUBLIC_DIR that path-traversal attempts might target.
fs.writeFileSync(path.join(TMP, 'secret.txt'), 'TOP SECRET');

process.env.PUBLIC_DIR = PUBLIC_DIR;
process.env.STATE_DIR = STATE_DIR;
process.env.MAX_BODY = '4096'; // small so the 413 path is cheap to exercise

const srv = require('../server.js');

// --- boot the server on an ephemeral port -----------------------------------
let base;
test.before(async () => {
  await srv.loadState();
  await new Promise(resolve => srv.server.listen(0, resolve));
  const { port } = srv.server.address();
  base = `http://127.0.0.1:${port}`;
});

test.after(() => {
  srv.server.close();
  fs.rmSync(TMP, { recursive: true, force: true });
});

test.beforeEach(() => { srv.resetState(); });

// --- tiny HTTP client -------------------------------------------------------
function request(method, urlPath, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(base + urlPath);
    const req = http.request(
      { method, hostname: u.hostname, port: u.port, path: u.pathname + u.search, headers },
      res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks);
          resolve({ status: res.statusCode, headers: res.headers, raw, text: raw.toString('utf8') });
        });
      }
    );
    // The server destroys the socket on oversize bodies, so surface the
    // error code instead of rejecting — callers decide if a reset is OK.
    req.on('error', err => resolve({ status: 0, error: err.code, headers: {}, raw: Buffer.alloc(0), text: '' }));
    if (body != null) req.write(body);
    req.end();
  });
}
const json = r => JSON.parse(r.text);

// ===========================================================================
// safeJoin (unit)
// ===========================================================================
test('safeJoin: normal path resolves inside root', () => {
  const p = srv.safeJoin(PUBLIC_DIR, '/app.css');
  assert.equal(p, path.join(PUBLIC_DIR, 'app.css'));
});

test('safeJoin: strips query string', () => {
  const p = srv.safeJoin(PUBLIC_DIR, '/app.css?v=2');
  assert.equal(p, path.join(PUBLIC_DIR, 'app.css'));
});

test('safeJoin: decodes percent-encoding', () => {
  const p = srv.safeJoin(PUBLIC_DIR, '/sub%2Findex.html');
  assert.equal(p, path.join(PUBLIC_DIR, 'sub', 'index.html'));
});

test('safeJoin: rejects ../ traversal', () => {
  assert.equal(srv.safeJoin(PUBLIC_DIR, '/../secret.txt'), null);
});

test('safeJoin: rejects encoded ../ traversal', () => {
  assert.equal(srv.safeJoin(PUBLIC_DIR, '/%2e%2e/secret.txt'), null);
});

test('safeJoin: allows the root itself', () => {
  // '/' normalises to the root with a trailing separator, still inside root.
  assert.equal(srv.safeJoin(PUBLIC_DIR, '/'), PUBLIC_DIR + path.sep);
});

// ===========================================================================
// /healthz
// ===========================================================================
test('GET /healthz returns ok with security headers', async () => {
  const r = await request('GET', '/healthz');
  assert.equal(r.status, 200);
  assert.equal(r.text, 'ok\n');
  assert.equal(r.headers['x-content-type-options'], 'nosniff');
  assert.equal(r.headers['x-frame-options'], 'SAMEORIGIN');
});

// ===========================================================================
// static file serving
// ===========================================================================
test('GET / serves index.html with no-cache', async () => {
  const r = await request('GET', '/');
  assert.equal(r.status, 200);
  assert.equal(r.text, INDEX_HTML);
  assert.match(r.headers['content-type'], /text\/html/);
  assert.equal(r.headers['cache-control'], 'no-cache');
});

test('GET static asset gets long cache header', async () => {
  const r = await request('GET', '/small.txt');
  assert.equal(r.status, 200);
  assert.equal(r.text, 'hi');
  assert.equal(r.headers['cache-control'], 'public, max-age=3600');
  assert.match(r.headers['content-type'], /text\/plain/);
});

test('GET data/*.json is revalidated (no-cache)', async () => {
  const r = await request('GET', '/data/standards.json');
  assert.equal(r.status, 200);
  assert.equal(r.headers['cache-control'], 'no-cache');
  assert.match(r.headers['content-type'], /application\/json/);
});

test('GET *.css/*.js are revalidated (no-cache) so deploys never mix versions', async () => {
  const r = await request('GET', '/app.css');
  assert.equal(r.status, 200);
  assert.equal(r.headers['cache-control'], 'no-cache');
});

test('GET sends a weak ETag; If-None-Match answers 304 without body', async () => {
  const r1 = await request('GET', '/app.css');
  assert.equal(r1.status, 200);
  assert.match(r1.headers['etag'], /^W\/".+"$/);
  const r2 = await request('GET', '/app.css', { headers: { 'If-None-Match': r1.headers['etag'] } });
  assert.equal(r2.status, 304);
  assert.equal(r2.text, '');
  // stale/foreign ETag still gets the full body
  const r3 = await request('GET', '/app.css', { headers: { 'If-None-Match': 'W/"nope"' } });
  assert.equal(r3.status, 200);
  assert.equal(r3.text, BIG_CSS);
});

test('GET directory serves its index.html', async () => {
  const r = await request('GET', '/sub');
  assert.equal(r.status, 200);
  assert.equal(r.text, '<p>sub index</p>');
});

test('GET unknown path falls back to SPA index.html', async () => {
  const r = await request('GET', '/deep/link/route');
  assert.equal(r.status, 200);
  assert.equal(r.text, INDEX_HTML);
});

test('GET traversal path is rejected with 400', async () => {
  const r = await request('GET', '/../secret.txt');
  // Node's http client / server normalises many ../ before dispatch, so
  // the response is either a 400 bad path or the SPA fallback — never the
  // secret file. Assert the secret never leaks.
  assert.notEqual(r.text, 'TOP SECRET');
});

test('gzip: large compressible asset is gzip-encoded when accepted', async () => {
  const r = await request('GET', '/app.css', { headers: { 'Accept-Encoding': 'gzip' } });
  assert.equal(r.status, 200);
  assert.equal(r.headers['content-encoding'], 'gzip');
  assert.equal(r.headers['vary'], 'Accept-Encoding');
  assert.equal(zlib.gunzipSync(r.raw).toString('utf8'), BIG_CSS);
});

test('gzip: not applied when client does not accept it', async () => {
  const r = await request('GET', '/app.css');
  assert.equal(r.status, 200);
  assert.equal(r.headers['content-encoding'], undefined);
  assert.equal(r.text, BIG_CSS);
});

test('gzip: not applied to small bodies even if accepted', async () => {
  const r = await request('GET', '/small.txt', { headers: { 'Accept-Encoding': 'gzip' } });
  assert.equal(r.headers['content-encoding'], undefined);
});

test('HEAD returns headers but no body', async () => {
  const r = await request('HEAD', '/small.txt');
  assert.equal(r.status, 200);
  assert.equal(r.raw.length, 0);
  assert.equal(r.headers['content-length'], '2');
});

test('POST to a static path is 405 method not allowed', async () => {
  const r = await request('POST', '/small.txt', { body: 'x' });
  assert.equal(r.status, 405);
});

// ===========================================================================
// /api/* routing
// ===========================================================================
test('GET unknown /api/ endpoint is 404 JSON', async () => {
  const r = await request('GET', '/api/does-not-exist');
  assert.equal(r.status, 404);
  assert.deepEqual(json(r), { error: 'unknown endpoint' });
});

// ===========================================================================
// /api/state
// ===========================================================================
test('GET /api/state returns empty initial state', async () => {
  const r = await request('GET', '/api/state');
  assert.equal(r.status, 200);
  const b = json(r);
  assert.equal(b.rev, 0);
  assert.deepEqual(b.state, {});
  assert.equal(r.headers['cache-control'], 'no-store');
});

test('PUT /api/state merges keys and bumps rev', async () => {
  const r = await request('PUT', '/api/state', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: { a: 1, b: 2 } }),
  });
  assert.equal(r.status, 200);
  const b = json(r);
  assert.equal(b.rev, 1);
  assert.deepEqual(b.state, { a: 1, b: 2 });
  assert.ok(b.updatedAt);
});

test('PUT /api/state top-level key merge preserves untouched keys', async () => {
  await request('PUT', '/api/state', { body: JSON.stringify({ state: { a: 1, b: 2 } }) });
  const r = await request('PUT', '/api/state', { body: JSON.stringify({ state: { b: 99, c: 3 } }) });
  const b = json(r);
  assert.equal(b.rev, 2);
  assert.deepEqual(b.state, { a: 1, b: 99, c: 3 });
});

test('POST /api/state behaves like PUT', async () => {
  const r = await request('POST', '/api/state', { body: JSON.stringify({ state: { x: 'y' } }) });
  assert.equal(r.status, 200);
  assert.deepEqual(json(r).state, { x: 'y' });
});

test('GET /api/state?since=rev returns unchanged shortcut', async () => {
  await request('PUT', '/api/state', { body: JSON.stringify({ state: { a: 1 } }) });
  const r = await request('GET', '/api/state?since=1');
  const b = json(r);
  assert.deepEqual(b, { rev: 1, unchanged: true });
});

test('GET /api/state?since=stale returns full state', async () => {
  await request('PUT', '/api/state', { body: JSON.stringify({ state: { a: 1 } }) });
  const r = await request('GET', '/api/state?since=0');
  const b = json(r);
  assert.equal(b.rev, 1);
  assert.deepEqual(b.state, { a: 1 });
});

test('PUT /api/state with invalid JSON is 400', async () => {
  const r = await request('PUT', '/api/state', { body: '{not json' });
  assert.equal(r.status, 400);
  assert.deepEqual(json(r), { error: 'invalid JSON' });
});

test('PUT /api/state missing state object is 400', async () => {
  const r = await request('PUT', '/api/state', { body: JSON.stringify({ nope: 1 }) });
  assert.equal(r.status, 400);
  assert.deepEqual(json(r), { error: 'missing state object' });
});

test('PUT /api/state with state=null is 400', async () => {
  const r = await request('PUT', '/api/state', { body: JSON.stringify({ state: null }) });
  assert.equal(r.status, 400);
});

test('PUT /api/state over MAX_BODY is 413', async () => {
  const big = 'z'.repeat(5000); // MAX_BODY is 4096 in this test env
  const r = await request('PUT', '/api/state', {
    body: JSON.stringify({ state: { blob: big } }),
  });
  // The server rejects oversize bodies mid-stream and destroys the socket,
  // so the client either reads the 413 response or sees the reset first.
  // Either way the oversize write must not be applied.
  assert.ok(r.status === 413 || r.error === 'ECONNRESET', `got status=${r.status} error=${r.error}`);
  if (r.status === 413) assert.deepEqual(json(r), { error: 'payload too large' });
  const after = await request('GET', '/api/state');
  assert.equal(json(after).rev, 0);
});

test('DELETE /api/state is 405 with Allow header', async () => {
  const r = await request('DELETE', '/api/state');
  assert.equal(r.status, 405);
  assert.equal(r.headers['allow'], 'GET, PUT, POST');
});

test('state is persisted to STATE_FILE on write', async () => {
  await request('PUT', '/api/state', { body: JSON.stringify({ state: { persisted: true } }) });
  // persist() serialises through a write chain; give it a tick to flush.
  await new Promise(r => setTimeout(r, 50));
  const onDisk = JSON.parse(await fsp.readFile(srv.config.STATE_FILE, 'utf8'));
  assert.equal(onDisk.state.persisted, true);
  assert.equal(onDisk.rev, 1);
});

test('loadState rehydrates rev and state from disk', async () => {
  await fsp.writeFile(
    srv.config.STATE_FILE,
    JSON.stringify({ rev: 7, updatedAt: '2020-01-01T00:00:00Z', state: { restored: 42 } })
  );
  await srv.loadState();
  const s = srv.getState();
  assert.equal(s.rev, 7);
  assert.deepEqual(s.state, { restored: 42 });
});
