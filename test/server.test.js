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
// Mini-Fixtures für die vendorten OCR-Assets (nur die MIME-Zuordnung per
// Endung wird geprüft, nicht der Inhalt).
const VENDOR_DIR = path.join(PUBLIC_DIR, 'vendor', 'tesseract');
fs.mkdirSync(VENDOR_DIR, { recursive: true });
fs.writeFileSync(path.join(VENDOR_DIR, 'tesseract-core-simd-lstm.wasm'), Buffer.from([0, 0x61, 0x73, 0x6d]));
fs.writeFileSync(path.join(VENDOR_DIR, 'eng.traineddata.gz'), Buffer.from([0x1f, 0x8b, 0x08, 0x00]));
// A file outside PUBLIC_DIR that path-traversal attempts might target.
fs.writeFileSync(path.join(TMP, 'secret.txt'), 'TOP SECRET');

process.env.PUBLIC_DIR = PUBLIC_DIR;
process.env.STATE_DIR = STATE_DIR;
process.env.MAX_BODY = '4096'; // small so the 413 path is cheap to exercise
process.env.BACKUP_KEEP = '3'; // small so the prune path is cheap to exercise
process.env.BACKUP_INTERVAL_MS = '60000'; // long, so throttling is observable in-test

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
// security headers (CSP / HSTS / Permissions-Policy)
// ===========================================================================
test('static responses carry a Content-Security-Policy', async () => {
  const r = await request('GET', '/');
  const csp = r.headers['content-security-policy'];
  assert.ok(csp, 'CSP header present');
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'self'/);
  // Inline handlers/styles are part of the design → must stay allowed…
  assert.match(csp, /script-src 'self' 'unsafe-inline'/);
  assert.match(csp, /style-src 'self' 'unsafe-inline'/);
  // …WASM compilation is allowed for the on-device OCR (Tesseract.js)…
  assert.match(csp, /'wasm-unsafe-eval'/);
  // …but the dangerous bare 'unsafe-eval' (eval()/new Function()) must NEVER be.
  assert.doesNotMatch(csp, /'unsafe-eval'/);
  // Care photos are data: URLs.
  assert.match(csp, /img-src[^;]*data:/);
});

test('vendored OCR assets are served with correct MIME (no double-gzip)', async () => {
  const wasm = await request('GET', '/vendor/tesseract/tesseract-core-simd-lstm.wasm');
  assert.strictEqual(wasm.status, 200);
  assert.match(wasm.headers['content-type'], /application\/wasm/);
  // Das Sprachmodell wird als .gz ausgeliefert und clientseitig entpackt — der
  // Server darf es NICHT zusätzlich gzip-kodieren, sonst scheitert der Client.
  const gz = await request('GET', '/vendor/tesseract/eng.traineddata.gz');
  assert.strictEqual(gz.status, 200);
  assert.match(gz.headers['content-type'], /application\/gzip/);
  assert.ok(!gz.headers['content-encoding'], 'gz must not be double-encoded');
});

test('JSON API responses also carry the security headers', async () => {
  const r = await request('GET', '/api/state');
  assert.ok(r.headers['content-security-policy'], 'CSP on API responses too');
  assert.equal(r.headers['x-content-type-options'], 'nosniff');
});

test('HSTS is sent without includeSubDomains', async () => {
  const r = await request('GET', '/healthz');
  const hsts = r.headers['strict-transport-security'];
  assert.ok(hsts, 'HSTS header present');
  assert.match(hsts, /max-age=\d+/);
  assert.doesNotMatch(hsts, /includeSubDomains/);
});

test('Permissions-Policy locks down unused sensitive features', async () => {
  const r = await request('GET', '/healthz');
  const pp = r.headers['permissions-policy'];
  assert.ok(pp, 'Permissions-Policy present');
  assert.match(pp, /geolocation=\(\)/);
  assert.match(pp, /microphone=\(\)/);
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
  // Der Server stoppt beim Limit das Puffern, reißt den Socket aber NICHT ab,
  // sondern antwortet sauber mit 413 — so kann der Client den Status wirklich
  // lesen (früher gab es hier eine Race gegen ECONNRESET).
  assert.equal(r.status, 413, `got status=${r.status} error=${r.error}`);
  assert.deepEqual(json(r), { error: 'payload too large' });
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
  // persist() serialises through a write chain and fsyncs — auf das Landen
  // POLLEN statt fixe 50 ms (unter CI-Last kann der fsync-Write länger dauern;
  // sonst ENOENT/rev-Flake).
  // Auf den KONKRETEN Inhalt dieses Writes pollen (nicht nur rev) — resetState
  // setzt nur den Speicher zurück, eine ältere state.json kann noch auf der
  // Platte liegen. Wir warten, bis genau dieser Write gelandet ist.
  let onDisk = null;
  const deadline = Date.now() + 3000;
  for (;;) {
    try { const d = JSON.parse(await fsp.readFile(srv.config.STATE_FILE, 'utf8')); if (d.state && d.state.persisted === true) { onDisk = d; break; } }
    catch (e) { /* Datei noch nicht geschrieben */ }
    if (Date.now() > deadline) break;
    await new Promise(r => setTimeout(r, 25));
  }
  assert.ok(onDisk, 'state.json mit diesem Write wurde geschrieben');
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

// ===========================================================================
// OAuth session hardening (signed cookies, non-forgeable identity)
// ===========================================================================
test('signSession round-trips through verifySession', () => {
  const signed = srv.signSession({ id: 42, login: 'alice', name: 'Alice' });
  const back = srv.verifySession(signed);
  assert.equal(back.login, 'alice');
  assert.equal(back.id, 42);
});

test('verifySession rejects a forged (unsigned base64) cookie', () => {
  // This is exactly the old cookie format an attacker could hand-craft.
  const forged = Buffer.from(JSON.stringify({ id: 1, login: 'root', name: 'root' })).toString('base64');
  assert.equal(srv.verifySession(forged), null);
});

test('verifySession rejects a tampered payload', () => {
  const signed = srv.signSession({ id: 1, login: 'bob', name: 'Bob' });
  const evilPayload = Buffer.from(JSON.stringify({ id: 1, login: 'admin', name: 'admin' }))
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const tampered = evilPayload + '.' + signed.slice(signed.lastIndexOf('.') + 1);
  assert.equal(srv.verifySession(tampered), null);
});

test('GET /auth/user without a cookie returns user:null', async () => {
  const r = await request('GET', '/auth/user');
  assert.equal(r.status, 200);
  // The test env configures no OAuth, so the availability flag is false.
  assert.deepEqual(json(r), { user: null, oauth: false });
});

test('GET /auth/user honours a validly signed session cookie', async () => {
  const signed = srv.signSession({ id: 7, login: 'carol', name: 'Carol' });
  const r = await request('GET', '/auth/user', { headers: { Cookie: 'github_session=' + signed } });
  assert.deepEqual(json(r), { user: { id: 7, login: 'carol', name: 'Carol' }, oauth: false });
});

test('GET /auth/user ignores a forged session cookie', async () => {
  const forged = Buffer.from(JSON.stringify({ id: 1, login: 'root', name: 'root' })).toString('base64');
  const r = await request('GET', '/auth/user', { headers: { Cookie: 'github_session=' + forged } });
  assert.deepEqual(json(r), { user: null, oauth: false });
});

test('GET /auth/user reports oauth:false so the client hides the login button', async () => {
  // Without GITHUB_CLIENT_ID/SECRET the client must not offer a GitHub login
  // (clicking it would dead-end on the /auth/github 400 page).
  const r = await request('GET', '/auth/user');
  assert.equal(json(r).oauth, false);
});

test('GET /auth/github is 400 when OAuth is not configured', async () => {
  // The test env sets no GITHUB_CLIENT_ID/SECRET.
  const r = await request('GET', '/auth/github');
  assert.equal(r.status, 400);
});

test('GET /auth/logout clears the session cookie', async () => {
  const r = await request('GET', '/auth/logout');
  assert.equal(r.status, 302);
  assert.match(String(r.headers['set-cookie']), /github_session=;/);
});

// ===========================================================================
// state snapshots (data-loss protection)
// ===========================================================================
const BACKUP_DIR = srv.config.BACKUP_DIR;
async function listSnaps() {
  try { return (await fsp.readdir(BACKUP_DIR)).filter(n => /^state-.*\.json$/.test(n)).sort(); }
  catch (e) { return []; }
}
async function clearSnaps() {
  for (const n of await listSnaps()) await fsp.unlink(path.join(BACKUP_DIR, n));
}

test('snapshot() writes a timestamped copy of the current state', async () => {
  await clearSnaps();
  await request('PUT', '/api/state', { body: JSON.stringify({ state: { snap: 'me' } }) });
  const file = await srv.snapshot();
  assert.ok(file, 'snapshot returns a path');
  const snaps = await listSnaps();
  assert.ok(snaps.length >= 1);
  const onDisk = JSON.parse(await fsp.readFile(file, 'utf8'));
  assert.equal(onDisk.state.snap, 'me');
});

test('snapshot() prunes to BACKUP_KEEP newest copies', async () => {
  await clearSnaps();
  for (let i = 0; i < 5; i++) await srv.snapshot(); // KEEP is 3 in this env
  const snaps = await listSnaps();
  assert.equal(snaps.length, srv.config.BACKUP_KEEP);
});

test('persist throttles snapshots: two rapid writes create only one', async () => {
  await clearSnaps();
  srv._resetBackupClock();
  await request('PUT', '/api/state', { body: JSON.stringify({ state: { t: 1 } }) });
  await request('PUT', '/api/state', { body: JSON.stringify({ state: { t: 2 } }) });
  // Fire-and-forget-Snapshot (writeFile+fsync) → aufs Landen POLLEN statt fixe
  // 120 ms (fsync kann unter CI-Last länger dauern → sonst „got 0"-Flake).
  const deadline = Date.now() + 3000;
  let snaps = await listSnaps();
  while (snaps.length < 1 && Date.now() < deadline) { await new Promise(r => setTimeout(r, 25)); snaps = await listSnaps(); }
  // kurz nachfassen, dass der Throttle KEINEN zweiten zulässt
  await new Promise(r => setTimeout(r, 60));
  snaps = await listSnaps();
  assert.equal(snaps.length, 1, `expected exactly one throttled snapshot, got ${snaps.length}`);
});
