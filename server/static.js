/* Statische Auslieferung aus PUBLIC_DIR: MIME, Cache-Header, ETag/304,
   gzip und SPA-Fallback auf index.html. */
'use strict';
const fsp = require('fs').promises;
const path = require('path');
const { PUBLIC_DIR, MIME, SECURITY_HEADERS } = require('./config');
const { maybeGzip } = require('./http-util');

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
  // App-Dateien (HTML/JS/CSS) und Daten ändern sich beim Redeploy — immer
  // revalidieren, damit nach einem Deploy nie alte JS-Module mit neuem HTML
  // gemischt werden. Der ETag unten macht die Revalidierung billig (304).
  const appAsset = ext === '.html' || ext === '.js' || ext === '.css' || filePath.includes(path.sep + 'data' + path.sep);
  headers['Cache-Control'] = appAsset ? 'no-cache' : 'public, max-age=3600';
  const etag = `W/"${stat.size}-${Math.floor(stat.mtimeMs)}"`;
  headers['ETag'] = etag;
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers);
    res.end();
    return;
  }
  let body;
  try { body = await fsp.readFile(filePath); }
  catch (e) { res.writeHead(500, SECURITY_HEADERS); res.end('read error'); return; }
  maybeGzip(req, res, 200, headers, body, type);
}

module.exports = { safeJoin, serveFile };
