/* Request-Dispatch: erst die API-Routen, dann statische Dateien mit
   SPA-Fallback. Unbekannte /api/*-Pfade antworten mit 404-JSON. */
'use strict';
const http = require('http');
const path = require('path');
const { PUBLIC_DIR, SECURITY_HEADERS } = require('./config');
const { sendJSON } = require('./http-util');
const { safeJoin, serveFile } = require('./static');
const routes = require('./routes');

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;

    const route = routes.find(r => r.matches(pathname));
    if (route) { await route.handle(req, res, url); return; }
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

module.exports = { server };
