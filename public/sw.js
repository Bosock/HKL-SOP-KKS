/* ─────────────────────────────────────────────────────────────
   SERVICE WORKER — Offline-Fähigkeit
   Cacht die App-Shell (HTML/CSS/JS/Icons) und die Standards-Daten, damit
   die App auch ohne Netz startet und bedienbar bleibt. Der Server-Sync
   (/api/state) läuft weiterhin ausschließlich übers Netz – der Store hält
   den letzten Stand lokal (localStorage), siehe js/core/sync.js.

   Update-Modell: CACHE_VERSION erhöhen (oder Shell-Liste ändern) → beim
   nächsten Laden installiert der Browser die neue Version, activate löscht
   die alten Caches atomar. Kein erzwungener Reload → keine verlorenen
   Eingaben; die frische Shell greift beim nächsten App-Start.
   ───────────────────────────────────────────────────────────── */
'use strict';

const CACHE_VERSION = 'v5';
const SHELL_CACHE = 'hkl-shell-' + CACHE_VERSION;
const RUNTIME_CACHE = 'hkl-runtime-' + CACHE_VERSION;

/* App-Shell: alles, was index.html zum Starten braucht. Bleibt in Sync mit
   den <script>-Tags in index.html. */
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/core/store.js',
  'js/core/config.js',
  'js/core/color.js',
  'js/features/auth.js',
  'js/features/additions.js',
  'js/features/pricing.js',
  'js/features/hints.js',
  'js/features/catalog.js',
  'js/core/labels.js',
  'js/data/demo-data.js',
  'js/core/app-state.js',
  'js/data/load.js',
  'js/ui/nav.js',
  'js/ui/standards.js',
  'js/ui/rubriken.js',
  'js/ui/detail.js',
  'js/features/care.js',
  'js/ui/catalog.js',
  'js/ui/admin.js',
  'js/features/backup.js',
  'js/ui/forms.js',
  'js/ui/chrome.js',
  'js/features/quickmenu.js',
  'js/features/search.js',
  'js/features/glossary.js',
  'js/core/sync.js',
  'js/core/pwa.js',
  'js/main.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

const DATA_PATH = '/data/hkl_standards_export.json';

/* Precache tolerant: ein einzelnes fehlendes Asset (z. B. nach Umbenennung)
   darf die Installation nicht komplett verhindern. */
async function precache() {
  const cache = await caches.open(SHELL_CACHE);
  await Promise.all(SHELL.map(async (url) => {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res && res.ok) await cache.put(url, res.clone());
    } catch (e) { /* offline/instabil – nächster Fetch versucht es erneut */ }
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, RUNTIME_CACHE]);
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith('hkl-') && !keep.has(n)).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

/* Cache-first mit Hintergrund-Revalidierung – für große, selten geänderte
   Ressourcen (Standards-JSON): sofort offline verfügbar, aktualisiert still. */
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) {
    fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); }).catch(() => {});
    return cached;
  }
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

/* Stale-while-revalidate – für App-Shell-Assets: sofort aus dem Cache,
   Aktualisierung im Hintergrund fürs nächste Laden. */
async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; });
  if (cached) { network.catch(() => {}); return cached; }
  return network;
}

/* Navigationen network-first: online immer frische index.html, offline die
   gecachte Shell (Single-Page-App → jede Route rendert dieselbe Shell). */
async function navigate(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put('index.html', res.clone());
    return res;
  } catch (e) {
    return (await cache.match('index.html')) || (await cache.match('./')) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                      // Sync-PUTs etc. ans Netz
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;       // Fremd-Origins nicht anfassen
  if (url.pathname.startsWith('/api/')) return;          // Server-State immer live

  if (req.mode === 'navigate') { event.respondWith(navigate(req)); return; }
  if (url.pathname === DATA_PATH) { event.respondWith(cacheFirst(req, RUNTIME_CACHE)); return; }
  event.respondWith(staleWhileRevalidate(req, SHELL_CACHE));
});
