/* HTTP-Grundbausteine: JSON-Antworten, optionales gzip, Body-Lesen mit Limit. */
'use strict';
const zlib = require('zlib');
const { MAX_BODY, COMPRESSIBLE, SECURITY_HEADERS } = require('./config');

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
    let size = 0; const chunks = []; let done = false;
    req.on('data', c => {
      if (done) return;              // nach dem Limit: weitere Chunks verwerfen
      size += c.length;
      if (size > MAX_BODY) {
        done = true;
        // NICHT req.destroy() aufrufen: das würde den Socket abreißen, bevor der
        // Handler sauber 413 senden kann (Client sähe nur ERR_EMPTY_RESPONSE).
        // Wir hören auf zu puffern und lassen den Handler ordentlich antworten.
        reject(Object.assign(new Error('payload too large'), { code: 'TOO_LARGE' }));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => { if (!done) resolve(Buffer.concat(chunks)); });
    req.on('error', e => { if (!done) { done = true; reject(e); } });
  });
}

module.exports = { sendJSON, maybeGzip, readBody };
