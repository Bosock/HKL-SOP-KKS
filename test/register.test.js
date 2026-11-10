'use strict';
/* Tests für die Register-Abfrage (server/register.js, server/routes/register.js).

   Die fremden Dienste werden durch eine Attrappe ersetzt (lokaler HTTP-Server,
   Adressen per Umgebung) — der Test geht nie ins Internet. Die Antworten der
   Attrappe sind gekürzte ECHTE Antworten vom 10.11.2026. */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'hkl-register-'));

/* Echte Antworten, gekürzt. */
const EUDAMED_HAHN = { value: [{ TRADE_NAME: 'Discofix® C', REFERENCE: '16494C', LATEX: 0.0, STERILE: 1.0, REUSABLE: 0.0, PRIMARY_DI: '04022495787309',
  BASIC_UDI: '40392390000030642E', DEVICE_NAME: 'Discofix C Stopcocks and Manifolds Gamma', NOMENCLATURE_CODE: ' A0703', MF_SRN: 'DE-MF-000000201', MF_NAME: 'B. Braun Melsungen AG' }] };
const EUDAMED_KABEL = { value: [{ TRADE_NAME: 'NA', REFERENCE: 'IBI-85954', LATEX: 0.0, STERILE: 1.0, REUSABLE: null, NOMENCLATURE_CODE: 'L0317', MF_SRN: 'BE-MF-000000001', MF_NAME: 'Abbott Medical' }] };
const GUDID_ORION = { gudid: { device: { brandName: 'IntellaMap Orion', versionModelNumber: 'M004RC64S0', catalogNumber: 'M004RC64S0', companyName: 'BOSTON SCIENTIFIC CORPORATION',
  deviceDescription: null, singleUse: true, labeledContainsNRL: false, labeledNoNRL: true, sterilization: { deviceSterile: true, sterilizationPriorToUse: false } } } };

const G_HAHN = '04022495787309', G_ORION = '08714729841968', G_NICHTS = '00884450456309', G_AUSFALL = '04012345678901';
/* EUDAMED fällt aus, GUDID kennt das Produkt · und eine GTIN, die niemand kennt. */
const G_HALB = '04012345678918', G_LEER = '04012345678925';
const zaehler = { eudamed: 0, gudid: 0 };
let attrappe, R, route;

test.before(async () => {
  attrappe = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const json = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.pathname === '/eudamed/udi') {
      zaehler.eudamed++;
      const g = u.searchParams.get('PRIMARY_DI');
      if (u.searchParams.get('format') !== 'json' || u.searchParams.get('api-version') !== 'v1.0') return json(400, { message: 'Required parameter format missing.' });
      if (g === G_AUSFALL || g === G_HALB) return json(500, { message: 'Internal server error' });
      return json(200, g === G_HAHN ? EUDAMED_HAHN : { value: [] });
    }
    if (u.pathname === '/gudid') {
      zaehler.gudid++;
      const g = u.searchParams.get('di');
      if (g === G_AUSFALL) return json(500, { error: 'kaputt' });
      return (g === G_ORION || g === G_HALB) ? json(200, GUDID_ORION) : json(404, { error: 'No device found for DI ' + g });
    }
    json(404, {});
  });
  await new Promise(r => attrappe.listen(0, '127.0.0.1', r));
  const basis = 'http://127.0.0.1:' + attrappe.address().port;
  process.env.STATE_DIR = path.join(TMP, 'state');
  process.env.REGISTER_EUDAMED_URL = basis + '/eudamed/udi';
  process.env.REGISTER_GUDID_URL = basis + '/gudid';
  process.env.REGISTER_PAUSE_MS = '0';
  R = require('../server/register');
  route = require('../server/routes/register');
});
test.after(async () => { await R.flush(); await new Promise(r => attrappe.close(r)); fs.rmSync(TMP, { recursive: true, force: true }); });

/* Die Route ohne echten Server aufrufen. */
function rufe(pfad, method) {
  return new Promise(resolve => {
    const req = { method: method || 'GET', headers: {} };
    const res = { code: 0, kopf: {}, writeHead(c, h) { this.code = c; this.kopf = h || {}; }, end(b) { resolve({ code: this.code, body: b ? JSON.parse(b.toString()) : null, roh: b }); } };
    const url = new URL(pfad, 'http://x');
    Promise.resolve(route.handle(req, res, url)).catch(e => resolve({ code: 599, body: { error: e.message } }));
  });
}

test('GTIN: Prüfziffer und Auffüllen auf 14 Stellen', () => {
  assert.equal(R.gtinOk(G_HAHN), true);
  assert.equal(R.gtinOk('04022495787300'), false);
  assert.equal(R.gtinOk('4022495787309'), true);         /* 13-stellig, dieselbe Nummer */
  assert.equal(R.gtinOk('abc'), false);
  assert.equal(R.gtinOk(''), false);
  assert.equal(R.gtin14('4022495787309'), G_HAHN);
});

test('EUDAMED-Antwort lesen: Hersteller mit SRN, Handelsname, REF, steril/Latex/Mehrweg, Einordnung', () => {
  const t = R.ausEudamed(EUDAMED_HAHN);
  assert.deepEqual(t, { quelle: 'EUDAMED', hersteller: { name: 'B. Braun Melsungen AG', srn: 'DE-MF-000000201' }, handelsname: 'Discofix® C',
    bezeichnung: 'Discofix C Stopcocks and Manifolds Gamma', ref: '16494C', steril: true, latex: false, mehrweg: false, einordnung: 'A0703', basisUdi: '40392390000030642E' });
  /* „NA" ist kein Handelsname; fehlende Angaben bleiben leer statt falsch (Grundsatz ①). */
  const k = R.ausEudamed(EUDAMED_KABEL);
  assert.equal(k.handelsname, ''); assert.equal(k.mehrweg, null);
  assert.equal(R.ausEudamed({ value: [] }), null);
  assert.equal(R.ausEudamed(null), null);
});

test('GUDID-Antwort lesen', () => {
  const t = R.ausGudid(GUDID_ORION);
  assert.equal(t.quelle, 'GUDID'); assert.equal(t.hersteller.name, 'BOSTON SCIENTIFIC CORPORATION'); assert.equal(t.hersteller.srn, '');
  assert.equal(t.ref, 'M004RC64S0'); assert.equal(t.handelsname, 'IntellaMap Orion');
  assert.equal(t.steril, true); assert.equal(t.latex, false); assert.equal(t.mehrweg, false);
  assert.equal(R.ausGudid({ error: 'No device found' }), null);
});

test('Abfrage: erst EUDAMED, sonst GUDID; Treffer kommen beim zweiten Mal aus dem Zwischenspeicher', async () => {
  const a = await R.abfragen(G_HAHN);
  assert.equal(a.treffer.quelle, 'EUDAMED'); assert.equal(a.ausCache, false); assert.ok(a.treffer.abgerufen);
  const vorher = Object.assign({}, zaehler);
  const b = await R.abfragen('4022495787309');           /* 13-stellig → dieselbe GTIN */
  assert.equal(b.ausCache, true); assert.equal(b.treffer.ref, '16494C');
  assert.deepEqual(zaehler, vorher);                      /* kein zweiter Gang ins Netz */

  const c = await R.abfragen(G_ORION);
  assert.equal(c.treffer.quelle, 'GUDID');
  await R.flush();
  const datei = JSON.parse(fs.readFileSync(R.CACHE_DATEI, 'utf8'));
  assert.ok(datei[G_HAHN].treffer && datei[G_ORION].treffer);
});

test('Abfrage: „nicht gefunden" wird gemerkt, ein Ausfall nicht', async () => {
  const n = await R.abfragen(G_NICHTS);
  assert.equal(n.treffer, null); assert.equal(n.fehler, undefined);
  const v = Object.assign({}, zaehler);
  assert.equal((await R.abfragen(G_NICHTS)).ausCache, true);
  assert.deepEqual(zaehler, v);

  const f = await R.abfragen(G_AUSFALL);
  assert.equal(f.treffer, null); assert.equal(f.fehler, 'Register nicht erreichbar');
  const w = zaehler.eudamed;
  await R.abfragen(G_AUSFALL);
  assert.equal(zaehler.eudamed, w + 1);                   /* wird beim nächsten Mal wieder versucht */
});

test('Zwischenspeicher: Treffer 30 Tage, Fehlanzeige 24 Stunden', () => {
  const jetzt = Date.now();
  assert.equal(R.frisch({ t: jetzt - 29 * 864e5, treffer: {} }, jetzt), true);
  assert.equal(R.frisch({ t: jetzt - 31 * 864e5, treffer: {} }, jetzt), false);
  assert.equal(R.frisch({ t: jetzt - 23 * 36e5, treffer: null }, jetzt), true);
  assert.equal(R.frisch({ t: jetzt - 25 * 36e5, treffer: null }, jetzt), false);
  assert.equal(R.frisch(null, jetzt), false);
});

test('Ausfall eines Registers: das zweite antwortet, der Treffer gilt nur vorläufig, das ausgefallene pausiert', async () => {
  assert.equal(R.gtinOk(G_HALB), true); assert.equal(R.gtinOk(G_LEER), true);
  process.env.REGISTER_PAUSE_MS = '60000';
  try {
    const a = await R.abfragen(G_HALB);
    assert.equal(a.treffer.quelle, 'GUDID'); assert.equal(a.fehler, undefined);
    await R.flush();
    const e = JSON.parse(fs.readFileSync(R.CACHE_DATEI, 'utf8'))[G_HALB];
    assert.equal(e.vorlaeufig, true);
    assert.equal(R.frisch(e, e.t + 23 * 36e5), true);
    assert.equal(R.frisch(e, e.t + 25 * 36e5), false);       /* nach einem Tag wird EUDAMED wieder gefragt */
    /* Während der Pause wird EUDAMED übersprungen — der Scan wartet kein Zeitlimit ab. */
    const v = Object.assign({}, zaehler);
    const b = await R.abfragen(G_LEER);
    assert.equal(zaehler.eudamed, v.eudamed); assert.equal(zaehler.gudid, v.gudid + 1);
    assert.equal(b.treffer, null); assert.equal(b.fehler, 'Register nicht erreichbar');   /* nicht „steht nirgends": EUDAMED hat nicht geantwortet */
    await R.flush();
    assert.equal(JSON.parse(fs.readFileSync(R.CACHE_DATEI, 'utf8'))[G_LEER], undefined);   /* „nicht gefunden" ist nicht gesichert → nicht gemerkt */
  } finally { process.env.REGISTER_PAUSE_MS = '0'; R._reset(); }
});

test('Route: nur GET, nur gültige GTIN', async () => {
  assert.equal((await rufe('/api/register?gtin=' + G_HAHN)).body.treffer.handelsname, 'Discofix® C');
  assert.equal((await rufe('/api/register?gtin=04022495787300')).code, 400);
  assert.equal((await rufe('/api/register')).code, 400);
  assert.equal((await rufe('/api/register?gtin=http://boese.example')).code, 400);
  assert.equal(route.matches('/api/register'), true);
  assert.equal(route.matches('/api/registerx'), false);
  const post = await new Promise(resolve => { const res = { writeHead(c) { this.c = c; }, end() { resolve(this.c); } }; route.handle({ method: 'POST', headers: {} }, res, new URL('http://x/api/register?gtin=' + G_HAHN)); });
  assert.equal(post, 405);
});
