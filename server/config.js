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
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

module.exports = { PORT, PUBLIC_DIR, STATE_DIR, STATE_FILE, MAX_BODY, MIME, COMPRESSIBLE, SECURITY_HEADERS };
