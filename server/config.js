/* Zentrale Konfiguration. Alle Werte werden EINMAL beim Laden des Moduls aus
   der Umgebung gelesen (Tests setzen process.env daher VOR dem require). */
'use strict';
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');

const PORT = parseInt(process.env.PORT || '80', 10);
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(ROOT, 'public');
const STATE_DIR = process.env.STATE_DIR || path.join(ROOT, 'state');
const STATE_FILE = path.join(STATE_DIR, 'state.json');
// Care photos are stored as base64 data URLs inside the state blob, so the
// body can get large. 32 MiB gives generous head-room; tune via MAX_BODY.
const MAX_BODY = parseInt(process.env.MAX_BODY || String(32 * 1024 * 1024), 10);

// Rotierende Snapshots von state.json — Schutz vor Datenverlust (Korruption,
// versehentliches Überschreiben eines Schlüssels, Fehl-Merge). Gedrosselt, um
// bei häufigen kleinen Edits nicht die Platte vollzuschreiben.
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(STATE_DIR, 'backups');
const BACKUP_INTERVAL_MS = parseInt(process.env.BACKUP_INTERVAL_MS || String(10 * 60 * 1000), 10); // ≤ 1 Snapshot / 10 min
const BACKUP_KEEP = parseInt(process.env.BACKUP_KEEP || '48', 10); // ~8 h Historie bei voller Aktivität

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL || 'http://localhost:8080/auth/github/callback';

/* Secret zum Signieren der Login-Session (HMAC). Ohne konfiguriertes
   SESSION_SECRET wird beim Start ein zufälliges erzeugt — dann sind vorhandene
   Sessions nach jedem Neustart ungültig (Nutzer müssen sich neu anmelden).
   Für stabile Sessions ein festes SESSION_SECRET in der .env setzen. */
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) {
  console.warn('[config] SESSION_SECRET not set — using a random per-boot secret; logins reset on restart. Set SESSION_SECRET in .env for stable sessions.');
}
/* Cookies nur dann mit Secure-Flag ausliefern, wenn wir hinter TLS laufen
   (erkennbar am https-Callback). Sonst würde der Browser Secure-Cookies über
   http://localhost verwerfen und die lokale OAuth-Entwicklung bräche. */
const COOKIE_SECURE = /^https:/i.test(GITHUB_CALLBACK_URL);

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
  // On-Device-OCR (Tesseract.js, selbst gehostet unter /vendor/tesseract/):
  '.wasm': 'application/wasm',
  // Sprachmodell wird als .gz ausgeliefert und clientseitig (pako) entpackt —
  // daher application/gzip OHNE Content-Encoding (der Browser darf es NICHT
  // automatisch auspacken, sonst scheitert Tesseracts eigener gunzip).
  '.gz':   'application/gzip',
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
  // 'wasm-unsafe-eval' erlaubt AUSSCHLIESSLICH das Kompilieren/Instanziieren von
  // WebAssembly (nötig für die On-Device-OCR mit Tesseract.js) — es ist NICHT
  // das gefährliche 'unsafe-eval' und öffnet weder eval() noch new Function().
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  // blob: für den Tesseract-Web-Worker (je nach Ladeweg als Blob instanziiert).
  "worker-src 'self' blob:",
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
  // Ungenutzte, sensible Browser-Features abschalten. Kamera wird EXPLIZIT für
  // die eigene Herkunft erlaubt (camera=(self)) — für den Etikett-Scanner
  // (getUserMedia) und die Foto-Pflege (<input type=file capture>). Explizit
  // statt implizit (Default wäre ebenfalls self), damit ein Zwischen-Proxy
  // oder eine strengere Browser-Voreinstellung den Kamerazugriff nicht
  // unbeabsichtigt sperrt.
  'Permissions-Policy': 'camera=(self), geolocation=(), microphone=(), payment=()',
};

module.exports = { PORT, PUBLIC_DIR, STATE_DIR, STATE_FILE, MAX_BODY, BACKUP_DIR, BACKUP_INTERVAL_MS, BACKUP_KEEP, MIME, COMPRESSIBLE, SECURITY_HEADERS, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_CALLBACK_URL, SESSION_SECRET, COOKIE_SECURE };
