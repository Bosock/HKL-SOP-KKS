'use strict';
/* Tests für die Register-Abfrage (server/register.js, server/routes/register.js).

   Die fremden Dienste werden durch eine Attrappe ersetzt (lokaler HTTP-Server,
   Adressen per Umgebung) — der Test geht nie ins Internet. Die Antworten der
   Attrappe sind gekürzte ECHTE Antworten vom 10.11.2026; ihre Störungen sind
   die am 13.11.2026 gemessenen: EUDAMED meldet für JEDES Produkt prompt
   „404 Data not found" oder antwortet gar nicht. */

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
const EUDAMED_SPRITZE = { value: [{ TRADE_NAME: 'Injekt® Luer Solo', REFERENCE: '4606051V', LATEX: 0.0, STERILE: 1.0, REUSABLE: 0.0, NOMENCLATURE_CODE: 'A020102010102', MF_SRN: 'DE-MF-000000201', MF_NAME: 'B. Braun Melsungen AG' }] };
const GUDID_ORION = { gudid: { device: { brandName: 'IntellaMap Orion', versionModelNumber: 'M004RC64S0', catalogNumber: 'M004RC64S0', companyName: 'BOSTON SCIENTIFIC CORPORATION',
  deviceDescription: null, singleUse: true, labeledContainsNRL: false, labeledNoNRL: true, sterilization: { deviceSterile: true, sterilizationPriorToUse: false } } } };

const G_HAHN = '04022495787309', G_ORION = '08714729841968', G_NICHTS = '00884450456309', G_AUSFALL = '04012345678901';
/* Eine erfundene, gültige GTIN je Fall — so stören sich die Tests nicht über den Zwischenspeicher. */
function G(n) { const b = '0401234' + String(600000 + n); let s = 0; b.split('').map(Number).reverse().forEach((d, i) => { s += d * (i % 2 === 0 ? 3 : 1); }); return b + ((10 - (s % 10)) % 10); }
const G_HALB = G(1), G_LEER = G(2), G_ZUVIEL = G(3), G_LEER2 = G(4), G_SPRITZE = G(5), G_ALT = G(6), G_FRUEHER = G(7), G_HAENGT = G(8), G_SPAETER = G(9), G_BEIDE = G(10), G_WEG = G(11);

const zaehler = { eudamed: 0, gudid: 0 };
/* Was die Attrappe von EUDAMED gerade tut: '' (gesund) · 'leer' (kennt nichts
   mehr, Störung d) · 'haengt' (antwortet nicht, Störung b) */
let stoerung = '';
const eudamedKennt = { [G_HAHN]: EUDAMED_HAHN, [G_SPRITZE]: EUDAMED_SPRITZE, [G_ALT]: EUDAMED_SPRITZE, [G_FRUEHER]: EUDAMED_SPRITZE, [G_BEIDE]: EUDAMED_SPRITZE };
const haengend = [];
let attrappe, R, route;

test.before(async () => {
  attrappe = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const json = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    /* So antwortet die echte Schnittstelle auf eine unbekannte GTIN: 404, kein JSON. */
    const nichtGefunden = () => { res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(' Data not found '); };
    if (u.pathname === '/eudamed/udi') {
      zaehler.eudamed++;
      const g = u.searchParams.get('PRIMARY_DI');
      if (u.searchParams.get('format') !== 'json' || u.searchParams.get('api-version') !== 'v1.0') return json(400, { message: 'Required parameter format missing.' });
      if (stoerung === 'haengt' || g === G_HAENGT) { haengend.push(res); return; }
      if (stoerung === 'leer') return nichtGefunden();
      if (g === G_AUSFALL || g === G_HALB) return json(500, { message: 'Internal server error' });
      if (g === G_ZUVIEL) { res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '120' }); res.end('{}'); return; }
      return eudamedKennt[g] ? json(200, eudamedKennt[g]) : nichtGefunden();
    }
    if (u.pathname === '/gudid') {
      zaehler.gudid++;
      const g = u.searchParams.get('di');
      if (g === G_AUSFALL) return json(500, { error: 'kaputt' });
      return (g === G_ORION || g === G_HALB || g === G_BEIDE) ? json(200, GUDID_ORION) : json(404, { error: 'No device found for DI ' + g });
    }
    json(404, {});
  });
  await new Promise(r => attrappe.listen(0, '127.0.0.1', r));
  const basis = 'http://127.0.0.1:' + attrappe.address().port;
  process.env.STATE_DIR = path.join(TMP, 'state');
  process.env.REGISTER_EUDAMED_URL = basis + '/eudamed/udi';
  process.env.REGISTER_GUDID_URL = basis + '/gudid';
  process.env.REGISTER_PAUSE_MS = '0';
  process.env.REGISTER_TIMEOUT_MS = '400';        /* „hängt" kostet im Test 0,4 s statt 20 s */
  process.env.REGISTER_NACHFASSEN = '0';          /* kein Zeitgeber — der Test ruft nachfassen() selbst */
  process.env.REGISTER_PRUEF_GTIN = G_HAHN;       /* die Gegenprobe fragt nach dem Hahn */
  R = require('../server/register');
  route = require('../server/routes/register');
});
test.after(async () => { await R.flush(); haengend.forEach(r => { try { r.destroy(); } catch (e) { /* schon zu */ } }); if (attrappe.closeAllConnections) attrappe.closeAllConnections(); await new Promise(r => attrappe.close(r)); fs.rmSync(TMP, { recursive: true, force: true }); });

/* Die Route ohne echten Server aufrufen. */
function rufe(pfad, method) {
  return new Promise(resolve => {
    const req = { method: method || 'GET', headers: {} };
    const res = { code: 0, kopf: {}, writeHead(c, h) { this.code = c; this.kopf = h || {}; }, end(b) { resolve({ code: this.code, body: b ? JSON.parse(b.toString()) : null, roh: b }); } };
    const url = new URL(pfad, 'http://x');
    Promise.resolve(route.handle(req, res, url)).catch(e => resolve({ code: 599, body: { error: e.message } }));
  });
}
/* Wie nach einem Neustart des Servers: Zustand vergessen, Zwischenspeicher von der Platte. */
async function neuStart() { await R.flush(); R._reset(); stoerung = ''; }
async function datei() { await R.flush(); return JSON.parse(fs.readFileSync(R.CACHE_DATEI, 'utf8')); }
/* Leerer Zwischenspeicher — damit das Nachfragen nur sieht, was der Test selbst angelegt hat. */
async function leeren() { await R.flush(); fs.mkdirSync(path.dirname(R.CACHE_DATEI), { recursive: true }); fs.writeFileSync(R.CACHE_DATEI, '{}'); R._reset(); stoerung = ''; }
async function dateiAendern(fn) { const d = await datei(); fn(d); fs.writeFileSync(R.CACHE_DATEI, JSON.stringify(d)); R._reset(); }
const eudamedStand = () => R.zustand().register.find(x => x.name === 'EUDAMED');

test('GTIN: Prüfziffer und Auffüllen auf 14 Stellen', () => {
  assert.equal(R.gtinOk(G_HAHN), true);
  assert.equal(R.gtinOk('04022495787300'), false);
  assert.equal(R.gtinOk('4022495787309'), true);         /* 13-stellig, dieselbe Nummer */
  assert.equal(R.gtinOk('abc'), false);
  assert.equal(R.gtinOk(''), false);
  assert.equal(R.gtin14('4022495787309'), G_HAHN);
  [G_HALB, G_LEER, G_ZUVIEL, G_SPRITZE, G_HAENGT].forEach(g => assert.equal(R.gtinOk(g), true));
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
  const d = await datei();
  assert.ok(d[G_HAHN].treffer && d[G_ORION].treffer);
  assert.equal(d[G_ORION].vorlaeufig, undefined);         /* EUDAMED hat ehrlich „nicht gefunden" gesagt → gilt 30 Tage */
});

test('Abfrage: gesicherte Fehlanzeige wird gemerkt, ein Ausfall nicht', async () => {
  const n = await R.abfragen(G_NICHTS);
  assert.equal(n.treffer, null); assert.equal(n.fehler, undefined);
  const v = Object.assign({}, zaehler);
  assert.equal((await R.abfragen(G_NICHTS)).ausCache, true);
  assert.deepEqual(zaehler, v);
  assert.equal((await datei())[G_NICHTS].sicher, true);

  const f = await R.abfragen(G_AUSFALL);
  assert.equal(f.treffer, null); assert.equal(f.fehler, 'Register nicht erreichbar');
  const w = zaehler.eudamed;
  await R.abfragen(G_AUSFALL);
  assert.equal(zaehler.eudamed, w + 1);                   /* wird beim nächsten Mal wieder versucht */
});

test('Zwischenspeicher: Treffer 30 Tage, gesicherte Fehlanzeige 24 Stunden, ungesicherte gar nicht', () => {
  const jetzt = Date.now();
  assert.equal(R.frisch({ t: jetzt - 29 * 864e5, treffer: {} }, jetzt), true);
  assert.equal(R.frisch({ t: jetzt - 31 * 864e5, treffer: {} }, jetzt), false);
  assert.equal(R.frisch({ t: jetzt - 23 * 36e5, treffer: null, sicher: true }, jetzt), true);
  assert.equal(R.frisch({ t: jetzt - 25 * 36e5, treffer: null, sicher: true }, jetzt), false);
  /* Einträge aus der Zeit vor der Gegenprobe und offene Einträge gelten nicht. */
  assert.equal(R.frisch({ t: jetzt - 1000, treffer: null }, jetzt), false);
  assert.equal(R.frisch({ t: jetzt - 1000, treffer: null, offen: { n: 1, ab: jetzt } }, jetzt), false);
  assert.equal(R.frisch(null, jetzt), false);
});

test('Störung „Data not found für alles": zählt als Ausfall, wird nicht gemerkt, der Server holt es nach', async () => {
  await leeren();
  stoerung = 'leer';
  const a = await R.abfragen(G_SPRITZE);                  /* EUDAMED führt die Spritze — und behauptet gerade das Gegenteil */
  assert.equal(a.treffer, null);
  assert.equal(a.fehler, 'Register nicht erreichbar');    /* NICHT „steht in keinem Register" */
  const e = (await datei())[G_SPRITZE];
  assert.equal(e.sicher, undefined); assert.equal(R.frisch(e), false);
  assert.equal(e.offen.n, 1);                             /* vorgemerkt zum Nachfragen */
  assert.equal(e.gudidLeer, true);                        /* GUDID hat ehrlich geantwortet */
  const z = eudamedStand();
  assert.equal(z.zustand, 'gestoert'); assert.match(z.grund, /nicht gefunden.*auch für Produkte/);

  /* Solange die Störung dauert, bringt auch das Nachfragen nichts — und GUDID wird nicht erneut bemüht. */
  const g0 = zaehler.gudid;
  assert.equal(await R.nachfassen({ sofort: true }), 1);
  assert.equal(zaehler.gudid, g0);
  assert.equal((await datei())[G_SPRITZE].offen.n, 2);

  /* EUDAMED ist zurück: Der Server fragt von selbst nach, der Treffer liegt bereit. */
  stoerung = '';
  assert.equal(await R.nachfassen({ sofort: true }), 1);
  const v = Object.assign({}, zaehler);
  const b = await R.abfragen(G_SPRITZE);
  assert.equal(b.ausCache, true); assert.equal(b.treffer.ref, '4606051V'); assert.equal(b.treffer.quelle, 'EUDAMED');
  assert.deepEqual(zaehler, v);
  assert.equal((await datei())[G_SPRITZE].offen, undefined);
  assert.equal(eudamedStand().zustand, 'ok');
  assert.equal(await R.nachfassen({ sofort: true }), 0);  /* nichts mehr offen */
});

test('Störung „antwortet nicht": Zeitlimit, GUDID wird trotzdem gefragt, EUDAMED gilt als gestört', async () => {
  await neuStart();
  const a = await R.abfragen(G_HAENGT);
  assert.equal(a.treffer, null); assert.equal(a.fehler, 'Register nicht erreichbar');
  assert.match(eudamedStand().grund, /Zeitlimit/);
  assert.equal(R.zustand().register.find(x => x.name === 'GUDID').zustand, 'ok');
});

test('Ein Treffer geht nie verloren: abgelaufen + Störung → der alte Treffer; und „nicht gefunden" ersetzt ihn nicht', async () => {
  await leeren();
  await R.abfragen(G_ALT); await R.abfragen(G_FRUEHER);
  /* Beide Treffer 31 Tage alt machen. */
  await dateiAendern(d => { d[G_ALT].t -= 31 * 864e5; d[G_FRUEHER].t -= 31 * 864e5; });
  stoerung = 'leer';
  const a = await R.abfragen(G_ALT);
  assert.equal(a.treffer.ref, '4606051V'); assert.equal(a.veraltet, true); assert.equal(a.fehler, undefined);
  const e = (await datei())[G_ALT];
  assert.ok(e.treffer && e.offen);                        /* Treffer behalten, Auffrischen vorgemerkt */
  /* EUDAMED gesund, führt das Produkt aber nicht mehr: Die Angaben bleiben. */
  stoerung = ''; delete eudamedKennt[G_FRUEHER];
  const b = await R.abfragen(G_FRUEHER);
  assert.equal(b.treffer.ref, '4606051V'); assert.equal(b.fehler, undefined);
  assert.ok((await datei())[G_FRUEHER].treffer);
});

test('Falsche Fehlanzeigen aus der Zeit vor der Gegenprobe heilen von selbst', async () => {
  await neuStart();
  /* So stand es am 13.11.2026 im Zwischenspeicher des Servers: „nicht gefunden", ungesichert. */
  await dateiAendern(d => { d[G_BEIDE] = { t: Date.now() - 3600e3, treffer: null }; });
  const a = await R.abfragen(G_BEIDE);
  assert.equal(a.ausCache, false); assert.equal(a.treffer.quelle, 'EUDAMED');
});

test('Ausfall eines Registers: das zweite antwortet, der Treffer gilt nur vorläufig, das ausgefallene pausiert', async () => {
  await leeren();
  process.env.REGISTER_PAUSE_MS = '60000';
  try {
    const a = await R.abfragen(G_HALB);
    assert.equal(a.treffer.quelle, 'GUDID'); assert.equal(a.fehler, undefined);
    const e = (await datei())[G_HALB];
    assert.equal(e.vorlaeufig, true);
    assert.equal(e.offen.n, 1);                              /* EUDAMED wird nachgefragt */
    assert.equal(R.frisch(e, e.t + 23 * 36e5), true);
    assert.equal(R.frisch(e, e.t + 25 * 36e5), false);       /* nach einem Tag wird EUDAMED auch auf Anfrage wieder gefragt */
    assert.ok(eudamedStand().pauseBis);
    /* Während der Pause wird EUDAMED übersprungen — der Scan wartet kein Zeitlimit ab. */
    const v = Object.assign({}, zaehler);
    const b = await R.abfragen(G_LEER);
    assert.equal(zaehler.eudamed, v.eudamed); assert.equal(zaehler.gudid, v.gudid + 1);
    assert.equal(b.treffer, null); assert.equal(b.fehler, 'Register nicht erreichbar');   /* nicht „steht nirgends": EUDAMED hat nicht geantwortet */
    const l = (await datei())[G_LEER];
    assert.equal(l.sicher, undefined); assert.ok(l.offen);   /* nicht als Fehlanzeige gemerkt, sondern zum Nachfragen */
    /* Der vorläufige Treffer bleibt beim Nachfragen stehen, solange EUDAMED fehlt — ohne GUDID erneut zu fragen. */
    const g0 = zaehler.gudid; const t0 = e.treffer.abgerufen;
    await R.nachfassen({ sofort: true });
    assert.equal(zaehler.gudid, g0);
    assert.equal((await datei())[G_HALB].treffer.abgerufen, t0);
  } finally { process.env.REGISTER_PAUSE_MS = '0'; await neuStart(); }
});

test('429 von EUDAMED: die verlangte Wartezeit wird eingehalten, GUDID wird trotzdem gefragt', async () => {
  await neuStart();
  const a = await R.abfragen(G_ZUVIEL);
  assert.equal(a.treffer, null); assert.equal(a.fehler, 'Register nicht erreichbar');
  assert.match(eudamedStand().grund, /429/);
  const v = Object.assign({}, zaehler);
  await R.abfragen(G_LEER2);
  assert.equal(zaehler.eudamed, v.eudamed);      /* EUDAMED pausiert (Retry-After: 120 s) — auch ohne eigene Pause */
  assert.equal(zaehler.gudid, v.gudid + 1);
  await neuStart();
});

test('Nachfragen: Abstände wachsen, nach 20 Versuchen ist Schluss; eine Fehlanzeige wird einmal überprüft', async () => {
  const j = 1e12;
  assert.deepEqual(R.naechsterVersuch(null, j), { n: 1, ab: j + 2 * 60000 });
  assert.deepEqual(R.naechsterVersuch({ offen: { n: 1 } }, j), { n: 2, ab: j + 5 * 60000 });
  assert.deepEqual(R.naechsterVersuch({ offen: { n: 7 } }, j), { n: 8, ab: j + 360 * 60000 });
  assert.deepEqual(R.naechsterVersuch({ offen: { n: 12 } }, j), { n: 13, ab: j + 360 * 60000 });
  assert.equal(R.naechsterVersuch({ offen: { n: 20 } }, j), null);

  await leeren();
  const a = await R.abfragen(G_SPAETER);                  /* steht (noch) in keinem Register */
  assert.equal(a.treffer, null); assert.equal(a.fehler, undefined);
  const e = (await datei())[G_SPAETER];
  assert.equal(e.sicher, true); assert.equal(e.offen.einmal, true);
  assert.ok(e.offen.ab > Date.now() + 50 * 60000);        /* in einer Stunde */
  eudamedKennt[G_SPAETER] = EUDAMED_SPRITZE;              /* inzwischen eingetragen */
  await R.nachfassen({ sofort: true });
  const b = await R.abfragen(G_SPAETER);
  assert.equal(b.ausCache, true); assert.equal(b.treffer.ref, '4606051V');
  /* … und bleibt es bei der Fehlanzeige, wird kein zweites Mal nachgesehen. */
  const c = await R.abfragen(G_WEG);
  assert.equal(c.treffer, null);
  await R.nachfassen({ sofort: true });
  const w = (await datei())[G_WEG];
  assert.equal(w.sicher, true); assert.equal(w.offen, undefined);
});

test('Drosselung: höchstens 15 Abfragen je Minute', async () => {
  await neuStart();
  const ergebnisse = [];
  for (let i = 0; i < 16; i++) ergebnisse.push(await R.abfragen(G(100 + i)));
  assert.equal(ergebnisse.slice(0, 15).every(e => !/zu viele/.test(e.fehler || '')), true);
  assert.match(ergebnisse[15].fehler, /zu viele/);
  await neuStart();
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

test('Route /api/register/zustand: Zustand ohne GTIN; „pruefen" fragt beide Register mit einem bekannten Produkt', async () => {
  await leeren();
  await R.abfragen(G_HAHN); await R.abfragen(G_ORION); await R.abfragen(G_NICHTS); await R.abfragen(G_AUSFALL);
  await neuStart();                                       /* wie nach einem Neustart: Zustand unbekannt, Gemerktes bleibt */
  assert.equal(route.matches('/api/register/zustand'), true);
  const a = await rufe('/api/register/zustand');
  assert.equal(a.code, 200); assert.equal(a.body.an, true);
  assert.deepEqual(a.body.register.map(x => x.name + ':' + x.zustand), ['EUDAMED:unbekannt', 'GUDID:unbekannt']);
  assert.deepEqual(a.body.gemerkt, { treffer: 2, nichts: 1 }); assert.equal(a.body.offen, 1);
  assert.equal(/\d{12,14}/.test(JSON.stringify(a.body).replace(/"\d{4}-\d\d-\d\dT[^"]*"/g, '')), false);   /* keine GTIN */

  stoerung = 'leer';
  const b = await rufe('/api/register/zustand?pruefen=1');
  assert.equal(b.body.register[0].zustand, 'gestoert'); assert.match(b.body.register[0].grund, /nicht gefunden/);
  assert.equal(b.body.register[1].zustand, 'ok');
  /* Höchstens alle 20 s wirklich prüfen. */
  const v = Object.assign({}, zaehler);
  await rufe('/api/register/zustand?pruefen=1');
  assert.deepEqual(zaehler, v);
  await neuStart();
  const c = await rufe('/api/register/zustand?pruefen=1');
  assert.deepEqual(c.body.register.map(x => x.zustand), ['ok', 'ok']);
});
