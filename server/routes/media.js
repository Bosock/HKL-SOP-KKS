/* /api/media — Bilder einzeln ablegen und ausliefern (siehe server/media.js).

     POST /api/media            Rumpf = Bilddaten, Content-Type = Bildart
                                → { kennung, art, groesse, neu }
     GET  /api/media/<kennung>  → das Bild (unbegrenzt zwischenspeicherbar)
     GET  /api/media            → { anzahl, bytes, bilder:[…] }  (Bestand)
     DELETE /api/media/<kennung>→ { geloescht:true|false }

   Die Kennung ist der Inhalts-Fingerabdruck; dieselbe Kennung liefert für
   immer denselben Inhalt. Deshalb `immutable` im Cache-Control — im Labor
   heißt das: ein einmal geladenes Bild kostet nie wieder Netz. */
'use strict';
const media = require('../media');
const { sendJSON, readBody, maybeGzip } = require('../http-util');
const { SECURITY_HEADERS } = require('../config');

function kennungAus(pathname) {
  const rest = pathname.slice('/api/media'.length).replace(/^\/+/, '');
  return rest || null;
}

async function handle(req, res, url) {
  const kennung = kennungAus(url.pathname);

  if (req.method === 'GET' || req.method === 'HEAD') {
    if (!kennung) {
      const b = media.bestand();
      sendJSON(req, res, 200, { anzahl: b.length, bytes: b.reduce((n, x) => n + x.groesse, 0), bilder: b });
      return;
    }
    if (!media.istKennung(kennung)) { sendJSON(req, res, 400, { error: 'bad id' }); return; }
    const t = media.lesen(kennung);
    if (!t) { sendJSON(req, res, 404, { error: 'not found' }); return; }
    const headers = Object.assign({
      'Content-Type': t.art,
      /* Der Inhalt kann sich unter dieser Adresse nie ändern. */
      'Cache-Control': 'public, max-age=31536000, immutable',
      'ETag': '"' + kennung + '"',
    }, SECURITY_HEADERS);
    maybeGzip(req, res, 200, headers, t.daten, t.art);
    return;
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const art = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    let body;
    try { body = await readBody(req); }
    catch (e) {
      if (e.code === 'TOO_LARGE') { sendJSON(req, res, 413, { error: 'payload too large' }); return; }
      sendJSON(req, res, 400, { error: 'read error' }); return;
    }
    try {
      const erg = media.ablegen(body, art);
      sendJSON(req, res, erg.neu ? 201 : 200, erg);
    } catch (e) {
      if (e.code === 'ART')   { sendJSON(req, res, 415, { error: 'unsupported media type', erlaubt: Object.keys(media.ARTEN) }); return; }
      if (e.code === 'GROSS') { sendJSON(req, res, 413, { error: 'media too large', max: media.MAX_BILD }); return; }
      if (e.code === 'LEER')  { sendJSON(req, res, 400, { error: 'empty body' }); return; }
      sendJSON(req, res, 500, { error: 'write failed' });
    }
    return;
  }

  if (req.method === 'DELETE') {
    if (!media.istKennung(kennung)) { sendJSON(req, res, 400, { error: 'bad id' }); return; }
    sendJSON(req, res, 200, { geloescht: media.loeschen(kennung) });
    return;
  }

  res.writeHead(405, Object.assign({ 'Allow': 'GET, POST, PUT, DELETE' }, SECURITY_HEADERS));
  res.end('method not allowed');
}

module.exports = {
  matches: pathname => pathname === '/api/media' || pathname.startsWith('/api/media/'),
  handle,
};
