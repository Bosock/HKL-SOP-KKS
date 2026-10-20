/* GET /api/raeume — Auskunft über die Räume (server/raeume.js).

     → { live:'bestand', raeume:[ { id, titel, basis, rev, updatedAt, schluessel } ] }

   `live` ist der Zeiger aus raeume.json. Ein Gerät, das keinem Raum fest
   zugeordnet ist, richtet sich beim Start danach (public/js/core/sync.js).
   Nur lesend: Umgeschaltet wird bewusst NICHT über eine Anfrage, sondern an
   der Datei auf dem Server — ein Live-Wechsel ist eine Entscheidung, kein
   Knopfdruck aus Versehen. */
'use strict';
const state = require('../state');
const raeume = require('../raeume');
const { sendJSON } = require('../http-util');
const { SECURITY_HEADERS } = require('../config');

async function handle(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, Object.assign({ 'Allow': 'GET' }, SECURITY_HEADERS));
    res.end('method not allowed');
    return;
  }
  const liste = Object.keys(raeume.RAEUME).map(id => {
    const r = raeume.RAEUME[id];
    const s = state.raum(id).getState();
    return { id, titel: r.titel, basis: r.basis, rev: s.rev, updatedAt: s.updatedAt, schluessel: Object.keys(s.state).length };
  });
  sendJSON(req, res, 200, { live: raeume.liveRaum(), raeume: liste });
}

module.exports = {
  matches: pathname => pathname === '/api/raeume',
  handle,
};
