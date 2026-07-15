/* Prüft die Offline-Logik von public/sw.js in einer nachgebauten
   Service-Worker-Umgebung (kein Browser nötig):
     - install precacht die App-Shell,
     - Navigationen fallen offline auf die gecachte index.html zurück,
     - die Standards-Daten kommen offline aus dem Runtime-Cache,
     - /api/* und Nicht-GET bleiben unangetastet (gehen ans Netz). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BASE = 'http://localhost/';
const norm = (k) => (typeof k === 'string' ? new URL(k, BASE).href : k.url);
const mkRes = (id, ok = true) => ({ ok, _id: id, clone() { return this; } });

function makeEnv() {
  const stores = new Map();
  class FakeCache {
    constructor() { this.m = new Map(); }
    async match(k) { return this.m.get(norm(k)); }
    async put(k, v) { this.m.set(norm(k), v); }
  }
  const caches = {
    async open(n) { if (!stores.has(n)) stores.set(n, new FakeCache()); return stores.get(n); },
    async keys() { return [...stores.keys()]; },
    async delete(n) { return stores.delete(n); },
  };
  const handlers = {};
  const self = {
    location: { origin: 'http://localhost' },
    registration: { scope: BASE },
    addEventListener(type, fn) { handlers[type] = fn; },
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };
  // fetchImpl ist umschaltbar, um online/offline zu simulieren.
  const box = { fetchImpl: null };
  const sandbox = {
    self, caches, URL, console,
    Response: { error: () => mkRes('Response.error', false) },
    // Echtes fetch() wirft nie synchron – es liefert immer ein Promise,
    // das bei Fehlern rejected. Genau so modellieren wir es hier.
    fetch: (...a) => { try { return Promise.resolve(box.fetchImpl(...a)); } catch (e) { return Promise.reject(e); } },
  };
  const code = fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8');
  vm.runInNewContext(code, sandbox);

  async function fire(type, event) { await handlers[type](event); return event; }
  async function install() {
    const waits = [];
    await fire('install', { waitUntil: (p) => waits.push(p) });
    await Promise.all(waits);
  }
  async function activate() {
    const waits = [];
    await fire('activate', { waitUntil: (p) => waits.push(p) });
    await Promise.all(waits);
  }
  async function doFetch(req) {
    let responded;
    await fire('fetch', { request: req, respondWith: (p) => { responded = p; } });
    return responded === undefined ? { passthrough: true } : { res: await responded };
  }
  return { box, stores, install, activate, doFetch, caches };
}

test('install precaches the app shell', async () => {
  const env = makeEnv();
  env.box.fetchImpl = (input) => mkRes('shell:' + input);
  await env.install();
  const shell = env.stores.get('hkl-shell-v4');
  assert.ok(shell, 'shell cache exists');
  assert.ok(shell.m.has('http://localhost/index.html'), 'index.html precached');
  assert.ok(shell.m.has('http://localhost/css/app.css'), 'css precached');
  assert.ok(shell.m.has('http://localhost/js/main.js'), 'main.js precached');
  assert.ok(shell.m.has('http://localhost/'), 'root precached');
});

test('navigation falls back to cached index.html when offline', async () => {
  const env = makeEnv();
  env.box.fetchImpl = (input) => mkRes('shell:' + input);
  await env.install();
  env.box.fetchImpl = () => { throw new Error('offline'); };
  const { res } = await env.doFetch({ method: 'GET', url: 'http://localhost/rubriken/42', mode: 'navigate' });
  assert.strictEqual(res._id, 'shell:index.html');
});

test('navigation is network-first when online (and refreshes cache)', async () => {
  const env = makeEnv();
  env.box.fetchImpl = (input) => mkRes('shell:' + input);
  await env.install();
  env.box.fetchImpl = () => mkRes('NAV_FRESH');
  const { res } = await env.doFetch({ method: 'GET', url: 'http://localhost/', mode: 'navigate' });
  assert.strictEqual(res._id, 'NAV_FRESH');
});

test('standards data is served from runtime cache when offline', async () => {
  const env = makeEnv();
  env.box.fetchImpl = (input) => mkRes('shell:' + input);
  await env.install();
  const dataReq = { method: 'GET', url: 'http://localhost/data/hkl_standards_export.json', mode: 'cors' };
  // online: caches the data
  env.box.fetchImpl = () => mkRes('DATA_ONLINE');
  const first = await env.doFetch(dataReq);
  assert.strictEqual(first.res._id, 'DATA_ONLINE');
  // offline: still serves the cached copy
  env.box.fetchImpl = () => { throw new Error('offline'); };
  const second = await env.doFetch(dataReq);
  assert.strictEqual(second.res._id, 'DATA_ONLINE');
});

test('/api requests are never intercepted', async () => {
  const env = makeEnv();
  env.box.fetchImpl = (input) => mkRes('shell:' + input);
  await env.install();
  const r = await env.doFetch({ method: 'GET', url: 'http://localhost/api/state', mode: 'cors' });
  assert.strictEqual(r.passthrough, true);
});

test('non-GET and cross-origin requests pass through', async () => {
  const env = makeEnv();
  env.box.fetchImpl = (input) => mkRes('shell:' + input);
  await env.install();
  const put = await env.doFetch({ method: 'PUT', url: 'http://localhost/api/state', mode: 'cors' });
  assert.strictEqual(put.passthrough, true);
  const cross = await env.doFetch({ method: 'GET', url: 'https://cdn.example/x.js', mode: 'cors' });
  assert.strictEqual(cross.passthrough, true);
});

test('activate drops stale hkl caches, keeps current ones', async () => {
  const env = makeEnv();
  env.box.fetchImpl = (input) => mkRes('shell:' + input);
  await env.install();
  await env.caches.open('hkl-shell-v3'); // simulate an old generation
  await env.activate();
  const names = await env.caches.keys();
  assert.ok(!names.includes('hkl-shell-v3'), 'old cache removed');
  assert.ok(names.includes('hkl-shell-v4'), 'current shell cache kept');
});

test('sw.js SHELL list stays in sync with index.html <script> tags', () => {
  // Same footgun the README warns about, enforced mechanically: every module
  // index.html loads must be precached, and nothing may linger in SHELL that
  // index.html no longer loads.
  const { shellSyncProblems } = require('../scripts/check.js');
  const problems = shellSyncProblems();
  assert.deepStrictEqual(problems, [], problems.join('\n'));
});
