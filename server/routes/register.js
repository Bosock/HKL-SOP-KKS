/* /api/register — amtliche Stammdaten zu einer GTIN (server/register.js).

     GET /api/register?gtin=<8–14 Ziffern>
       → 200 { gtin, treffer:{ quelle, hersteller:{name,srn}, handelsname,
                bezeichnung, ref, steril, latex, mehrweg, einordnung,
                basisUdi, abgerufen } | null, ausCache, fehler?,
                veraltet?, nachfassen? }
              fehler      Register nicht erreichbar / zu viele Abfragen
              veraltet    alter Treffer, das Auffrischen ist gescheitert
              nachfassen  der Server fragt von selbst weiter
       → 400 { error }   GTIN fehlt oder Prüfziffer falsch
       → 503 { error }   Abfrage abgeschaltet (REGISTER=0)

     GET /api/register/zustand            Zustand der Register (nur lesen)
     GET /api/register/zustand?pruefen=1  … vorher beide Register mit einem
                                          bekannten Produkt fragen (höchstens
                                          alle 20 s)
       → 200 { an, nachfassen, jetzt, register:[{ name, zustand:'ok'|
                'gestoert'|'unbekannt', seit, erfolg, fehler, grund,
                pauseBis }], gemerkt:{ treffer, nichts }, offen, naechstes }

   Nur GET, nur Ziffern, feste Zieladressen — die Route kann nicht dazu
   gebracht werden, irgendeine andere Adresse aufzurufen. */
'use strict';
const register = require('../register');
const { sendJSON } = require('../http-util');
const { SECURITY_HEADERS } = require('../config');

async function handle(req, res, url) {
  if (req.method !== 'GET') {
    res.writeHead(405, Object.assign({ 'Allow': 'GET' }, SECURITY_HEADERS));
    res.end('method not allowed'); return;
  }
  if (url.pathname === '/api/register/zustand') {
    const pruefen = register.AN && url.searchParams.get('pruefen') === '1';
    sendJSON(req, res, 200, pruefen ? await register.pruefen() : register.zustand()); return;
  }
  if (!register.AN) { sendJSON(req, res, 503, { error: 'Register-Abfrage ist abgeschaltet' }); return; }
  const gtin = String(url.searchParams.get('gtin') || '').trim();
  if (!register.gtinOk(gtin)) { sendJSON(req, res, 400, { error: 'GTIN fehlt oder die Prüfziffer stimmt nicht' }); return; }
  sendJSON(req, res, 200, await register.abfragen(gtin));
}

module.exports = {
  matches: pathname => pathname === '/api/register' || pathname === '/api/register/zustand',
  handle,
};
