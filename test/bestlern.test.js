'use strict';
/* Tests für die mitwachsende Bestell-Datenbank (public/js/features/bestellungen.js).

   Der Betreiber: „Da die Materialien immer wiederkehrend sind und dem Material,
   das verbraucht wird, entsprechen, wäre es sinnvoll, kontinuierlich
   abzugleichen — damit man irgendwann ohne Foto die Bestelldaten hat."

   Der gewählte Weg ist „Bestätigung zuerst": Jeder Scan legt einen VORSCHLAG
   (material_key ↔ GTIN) ab, aber erst wenn ein Mensch ihn bestätigt, wird
   daraus eine echte Verknüpfung (MATLINK) — und erst dann zahlt die Datenbank
   ohne Foto aus. Geprüft wird genau das, was die Datenbank zuverlässig hält:

   ① Ein Vorschlag zahlt NICHT aus. Ohne Bestätigung gibt es keine Bestelldaten
      (leer schlägt falsch) — sonst würde ein einzelner Fehlscan zur „Wahrheit".
   ② Bestätigen verlinkt über dieselbe Brücke wie die Materialzentrale (MATLINK),
      und ab da stehen REF/Hersteller sofort da.
   ③ Ein Widerspruch (schon verlinkt, aber ein anderes Produkt gescannt) wird
      erkannt und nie still übernommen.
   ④ Verworfenes kommt nicht wieder.
   ⑤ Die Einzahlung in den Stammsatz überschreibt nie ein gepflegtes Feld.
*/

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const lies = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* Zwei wiederkehrende Materialien aus „den Standards". */
const MATS = [
  { key: 'fk-ebu',   name: 'Führungskatheter EBU 3.5' },
  { key: 'schleuse', name: 'Schleusenset 6F' },
];

function umgebung(seedGtin, seedLink) {
  const store = {};
  if(seedLink) store.hkl_matlink = seedLink;
  const GTINDB = Object.assign({}, seedGtin || {});
  const ctx = vm.createContext({
    console,
    loadJSON: (k, d) => (k in store) ? JSON.parse(JSON.stringify(store[k])) : d,
    saveJSON: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
    esc: (s) => String(s == null ? '' : s),
    $: () => null,
    ADMIN: true,
    GTINDB,
    saveGtinDB: () => { store.hkl_gtin = JSON.parse(JSON.stringify(GTINDB)); },
    /* Foto anhängen ohne Dubletten — wie scanner.js/matPhotoAdd. */
    matPhotoAdd: (list, src, titel) => { const s=String(src||''); const arr=(list||[]).slice();
      if(!s || arr.some(x=>x&&x.src===s)) return arr; arr.push({src:s,titel:titel||''}); return arr; },
    pfMaterialien: () => MATS.map(m => ({ key:m.key, name:m.name, vorkommen:1 })),
  });
  /* Die echte Brücke material_key → Stammsatz (MATLINK/canonId) mitladen. */
  vm.runInContext(lies('public/js/features/matkey.js'), ctx);
  vm.runInContext(lies('public/js/features/materials.js'), ctx);
  vm.runInContext(lies('public/js/features/bestellungen.js'), ctx);
  vm.runInContext(`globalThis.__x = {
    erfassen: bestLernErfassen, bestaetigen: bestLernBestaetigen, verwerfen: bestLernVerwerfen,
    status: bestLernStatus, vorschlag: bestVorschlag, daten: bestBestelldaten,
    offen: bestLernOffen, verlinkt: bestVerlinkt, nameZuKey: bestNameZuKey,
    einzahlen: bestStammEinzahlen, db: () => GTINDB, link: () => MATLINK,
    lern: () => BESTLERN, store: () => (${JSON.stringify(null)}) };`, ctx);
  return { x: ctx.__x, store, ctx, GTINDB };
}

/* Ein Stammsatz, wie ihn ein Scan hinterlässt. */
const STAMM = { '04012345': { gtin:'04012345', name:'Launcher EBU 3.5', ref:'LA35EBU', hersteller:'Medtronic', lagerort:'Schrank 2' } };

/* ═══ ① Ein Vorschlag zahlt nicht aus ═══ */

test('ein Scan legt einen Vorschlag ab — mehr nicht', () => {
  const { x } = umgebung(STAMM);
  x.erfassen('fk-ebu', '04012345', { name:'Launcher EBU 3.5', ref:'LA35EBU' });
  assert.equal(x.status('fk-ebu'), 'vorschlag');
});

test('ohne Bestätigung gibt es keine Bestelldaten — leer schlägt falsch', () => {
  const { x } = umgebung(STAMM);
  x.erfassen('fk-ebu', '04012345', {});
  assert.equal(x.daten('fk-ebu'), null, 'ein bloßer Vorschlag ist keine Wahrheit');
  assert.equal(x.verlinkt('fk-ebu'), null);
});

test('der Vorschlag nennt das gescannte Produkt', () => {
  const { x } = umgebung(STAMM);
  x.erfassen('fk-ebu', '04012345', { name:'Launcher EBU 3.5' });
  const v = x.vorschlag('fk-ebu');
  assert.equal(v.gtin, '04012345');
  assert.equal(v.n, 1);
});

/* ═══ ② Bestätigen verlinkt und zahlt aus ═══ */

test('bestätigen setzt die Verknüpfung über MATLINK', () => {
  const { x } = umgebung(STAMM);
  x.erfassen('fk-ebu', '04012345', {});
  x.bestaetigen('fk-ebu', '04012345');
  assert.equal(x.status('fk-ebu'), 'verlinkt');
  assert.equal(x.verlinkt('fk-ebu'), '04012345');
});

test('… und ab da stehen REF, Hersteller und Lagerort sofort da', () => {
  const { x } = umgebung(STAMM);
  x.erfassen('fk-ebu', '04012345', {});
  x.bestaetigen('fk-ebu', '04012345');
  const d = x.daten('fk-ebu');
  assert.equal(d.ref, 'LA35EBU');
  assert.equal(d.hersteller, 'Medtronic');
  assert.equal(d.lagerort, 'Schrank 2');
  assert.equal(d.gtin, '04012345');
});

test('ein bestätigter Vorschlag verschwindet aus den Offenen', () => {
  const { x } = umgebung(STAMM);
  x.erfassen('fk-ebu', '04012345', {});
  x.bestaetigen('fk-ebu', '04012345');
  assert.equal(x.offen().length, 0);
});

/* ═══ ③ Widerspruch ═══ */

test('ein anderes Produkt an einem verlinkten Material ist ein Widerspruch', () => {
  const { x } = umgebung(Object.assign({ '09999999': { gtin:'09999999', name:'Fremdfabrikat', ref:'XX' } }, STAMM),
    { 'fk-ebu': '04012345' });
  x.erfassen('fk-ebu', '09999999', { name:'Fremdfabrikat' });
  assert.equal(x.status('fk-ebu'), 'widerspruch');
  const v = x.vorschlag('fk-ebu');
  assert.equal(v.gtin, '09999999', 'der Widerspruch nennt das neue, abweichende Produkt');
});

test('der Widerspruch wird nie still übernommen — die alte Verknüpfung bleibt', () => {
  const { x } = umgebung(STAMM, { 'fk-ebu': '04012345' });
  x.erfassen('fk-ebu', '09999999', {});
  assert.equal(x.verlinkt('fk-ebu'), '04012345', 'nur ein Mensch darf umhängen');
  assert.equal(x.daten('fk-ebu').gtin, '04012345');
});

/* ═══ ④ Verworfenes ═══ */

test('ein verworfener Vorschlag kommt nicht wieder', () => {
  const { x } = umgebung(STAMM);
  x.erfassen('fk-ebu', '04012345', {});
  x.verwerfen('fk-ebu', '04012345');
  assert.equal(x.status('fk-ebu'), 'leer');
  assert.equal(x.erfassen('fk-ebu', '04012345', {}), false, 'derselbe Fehlscan nervt nicht erneut');
  assert.equal(x.status('fk-ebu'), 'leer');
});

/* ═══ ⑤ Einzahlung in den Stammsatz ═══ */

test('ein Scan legt einen neuen Stammsatz an — mit Foto', () => {
  const { x } = umgebung({});
  x.einzahlen('04012345', { name:'Launcher EBU 3.5', ref:'LA35EBU', hersteller:'Medtronic', herkunft:'accessgudid', foto:'data:img,A' });
  const r = x.db()['04012345'];
  assert.equal(r.name, 'Launcher EBU 3.5');
  assert.equal(r.ref, 'LA35EBU');
  assert.equal(r.photo, 'data:img,A');
  assert.equal(r.fotos.length, 1);
  assert.match(r.quelle||'', /AccessGUDID/, 'Netz-Herkunft ist als unbestätigt erkennbar');
});

test('die Einzahlung überschreibt NIE ein schon gepflegtes Feld', () => {
  const { x } = umgebung({ '04012345': { gtin:'04012345', name:'Von Hand gepflegt', ref:'ECHT', hersteller:null, fotos:[], photo:null } });
  x.einzahlen('04012345', { name:'Aus dem Netz', ref:'NETZ', hersteller:'Medtronic', foto:'data:img,B' });
  const r = x.db()['04012345'];
  assert.equal(r.name, 'Von Hand gepflegt', 'der gepflegte Name bleibt');
  assert.equal(r.ref, 'ECHT', 'die gepflegte REF bleibt');
  assert.equal(r.hersteller, 'Medtronic', 'nur das leere Feld wird gefüllt');
  assert.equal(r.photo, 'data:img,B', 'ein fehlendes Foto darf dazukommen');
});

test('zweimal dasselbe Foto bleibt einmal', () => {
  const { x } = umgebung({});
  x.einzahlen('04012345', { name:'X', foto:'data:img,A' });
  x.einzahlen('04012345', { name:'X', foto:'data:img,A' });
  assert.equal(x.db()['04012345'].fotos.length, 1);
});

/* ═══ Zähler, Namen, Persistenz ═══ */

test('zwei Scans desselben Paares zählen hoch', () => {
  const { x } = umgebung(STAMM);
  x.erfassen('fk-ebu', '04012345', {});
  x.erfassen('fk-ebu', '04012345', {});
  assert.equal(x.vorschlag('fk-ebu').n, 2);
});

test('die Prüfliste nennt den Materialnamen aus den Standards', () => {
  const { x } = umgebung(STAMM);
  x.erfassen('fk-ebu', '04012345', { name:'Launcher EBU 3.5' });
  const o = x.offen();
  assert.equal(o.length, 1);
  assert.equal(o[0].name, 'Führungskatheter EBU 3.5', 'gezeigt wird, wie es im Saal heißt');
  assert.equal(o[0].status, 'vorschlag');
});

test('der Name aus dem Feld findet den Materialschlüssel', () => {
  const { x } = umgebung(STAMM);
  assert.equal(x.nameZuKey('Führungskatheter EBU 3.5'), 'fk-ebu');
  assert.equal(x.nameZuKey('  führungskatheter ebu 3.5 '), 'fk-ebu', 'Groß-/Kleinschreibung und Rand egal');
  assert.equal(x.nameZuKey('gibtsnicht'), null);
});

test('das Journal überlebt einen Neustart', () => {
  const { x, store } = umgebung(STAMM);
  x.erfassen('fk-ebu', '04012345', {});
  assert.ok(store.hkl_bestlern, 'der Vorschlag wurde gespeichert');
  /* Frische Umgebung mit demselben Speicher: der Vorschlag ist wieder da. */
  const zwei = umgebung(STAMM);
  vm.runInContext('BESTLERN = ' + JSON.stringify(store.hkl_bestlern) + ';', zwei.ctx);
  assert.equal(zwei.x.status('fk-ebu'), 'vorschlag');
});
