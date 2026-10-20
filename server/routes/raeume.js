/* /api/raeume — Auskunft über die Räume und der Live-Schalter (server/raeume.js).

   GET  → { live:'bestand', geaendert, raeume:[ { id, titel, basis, rev, updatedAt, schluessel } ] }
   PUT  { live:'neuaufbau'|'bestand', pw:'<Fingerabdruck>' } → { live, geaendert }

   `live` ist der Zeiger aus raeume.json. Ein Gerät, das keinem Raum fest
   zugeordnet ist, richtet sich beim Start und beim Aufwachen danach
   (public/js/core/sync.js). Der Zeiger lenkt keine Anfrage um — ohne
   Raumangabe bleibt jede Anfrage beim Bestand.

   Umschalten verlangt das Passwort des Neuaufbaus (als Fingerabdruck) und
   wird mit Zeitpunkt in raeume.json festgehalten. Falsches Passwort → 403,
   unbekannter Raum → 400. */
'use strict';
const state = require('../state');
const raeume = require('../raeume');
const { sendJSON, readBody } = require('../http-util');
const { SECURITY_HEADERS } = require('../config');

function zeigerGeaendert() {
  try { return JSON.parse(require('fs').readFileSync(raeume.ZEIGER_DATEI, 'utf8')).geaendert || null; }
  catch (e) { return null; }
}

async function handle(req, res) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    const liste = Object.keys(raeume.RAEUME).map(id => {
      const r = raeume.RAEUME[id];
      const s = state.raum(id).getState();
      return { id, titel: r.titel, basis: r.basis, rev: s.rev, updatedAt: s.updatedAt, schluessel: Object.keys(s.state).length };
    });
    sendJSON(req, res, 200, { live: raeume.liveRaum(), geaendert: zeigerGeaendert(), raeume: liste });
    return;
  }
  if (req.method === 'PUT' || req.method === 'POST') {
    let body;
    try { body = await readBody(req); }
    catch (e) { sendJSON(req, res, e.code === 'TOO_LARGE' ? 413 : 400, { error: 'read error' }); return; }
    let p;
    try { p = JSON.parse(body.toString('utf8') || '{}'); }
    catch (e) { sendJSON(req, res, 400, { error: 'invalid JSON' }); return; }
    if (!p || !raeume.istRaum(p.live)) { sendJSON(req, res, 400, { error: 'unknown room' }); return; }
    const erwartet = raeume.erwarteterFingerabdruck(state.raum(raeume.STANDARD).getState().state);
    if (typeof p.pw !== 'string' || p.pw !== erwartet) { sendJSON(req, res, 403, { error: 'Passwort stimmt nicht' }); return; }
    try {
      const neu = raeume.liveSetzen(p.live);
      console.log(`[raeume] live → ${neu.live}`);
      sendJSON(req, res, 200, { live: neu.live, geaendert: neu.geaendert });
    } catch (e) {
      sendJSON(req, res, 500, { error: 'write failed' });
    }
    return;
  }
  res.writeHead(405, Object.assign({ 'Allow': 'GET, PUT, POST' }, SECURITY_HEADERS));
  res.end('method not allowed');
}

module.exports = {
  matches: pathname => pathname === '/api/raeume',
  handle,
};
