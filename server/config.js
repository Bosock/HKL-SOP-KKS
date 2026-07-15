/* Zentrale Konfiguration. Alle Werte werden EINMAL beim Laden des Moduls aus
   der Umgebung gelesen (Tests setzen process.env daher VOR dem require). */
'use strict';
const path = require('path');

const ROOT = path.join(__dirname, '..');

const PORT = parseInt(process.env.PORT || '80', 10);
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(ROOT, 'public');
const STATE_DIR = process.env.STATE_DIR || path.join(ROOT, 'state');
const STATE_FILE = path.join(STATE_DIR, 'state.json');
// Care photos are stored as base64 data URLs inside the state blob, so the
// body can get large. 32 MiB gives generous head-room; tune via MAX_BODY.
const MAX_BODY = parseInt(process.env.MAX_BODY || String(32 * 1024 * 1024), 10);

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL || 'http://localhost:8080/auth/github/callback';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
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

/* Content-Security-Policy — eng gefasst, aber verträglich mit dem bewussten
   Design der App (Inline-`onclick=`-Handler und Inline-`style=`-Attribute im
   generierten Markup, Foto-Pflege als data:-URLs). Konkret:
     - default/connect/font/manifest/worker: nur 'self' (keine Fremd-Origins;
       alle fetch()-Aufrufe gehen an /api bzw. /auth, alles same-origin).
     - script/style: 'unsafe-inline' ist nötig, weil das Markup Handler und
       Stile inline referenziert. KEIN 'unsafe-eval' — die App nutzt weder
       eval() noch new Function() (per Grep verifiziert), daher bleibt das
       gefährlichste Schlupfloch zu.
     - img: 'self' + data:/blob: für die base64-Fotos der Materialpflege.
     - object-src 'none', base-uri/form-action 'self', frame-ancestors 'self'
       (deckungsgleich mit X-Frame-Options) — härtet gegen Clickjacking,
       <base>-Hijacking und Formular-Exfiltration. */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ');

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': CSP,
  // Browser ignorieren HSTS über http (nur über https honoriert) — daher
  // gefahrlos immer mitzusenden. Ohne includeSubDomains, um andere
  // (evtl. http-only) Subdomains von kardio.wiki nicht mitzureißen.
  'Strict-Transport-Security': 'max-age=15552000',
  // Ungenutzte, sensible Browser-Features abschalten. Kamera bleibt bewusst
  // unerwähnt (= Default self), damit die Foto-Pflege via <input type=file
  // capture> unangetastet bleibt.
  'Permissions-Policy': 'geolocation=(), microphone=(), payment=()',
};

module.exports = { PORT, PUBLIC_DIR, STATE_DIR, STATE_FILE, MAX_BODY, MIME, COMPRESSIBLE, SECURITY_HEADERS, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_CALLBACK_URL };
