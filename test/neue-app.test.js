'use strict';
/* Tests für die NEUE APP (public/neu, docs/NEUE-APP.md):
   · die reine Logik in public/neu/js/kern.js,
   · die Umleitung in public/js/core/store.js — sie darf NUR im Neuaufbau
     greifen; im Bestand ändert sich nichts. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const KAT = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/merkmale.json'), 'utf8'));
const KERN = fs.readFileSync(path.join(ROOT, 'public/neu/js/kern.js'), 'utf8');
const ctx = vm.createContext({ console });
vm.runInContext(KERN + `
;globalThis.__K = { naNorm, naAehnliche, naGtinPruefziffer, naGtinKey, naParseGS1, naParseScan, naMengeZahl,
  naStueckpreis, naKosten, naPositionen, naVerwendungen, naListenVerwendung, naRuestliste, naKatalog, naFelder,
  naHerstellerAusGtin, naNameVorschlag, naStandardNeu, naStandardKopie, naUnterschiede, naCsv,
  NA_ARTEN_VORGABE, NA_BEREICHE_VORGABE, NA_RUBRIKEN_VORGABE };`, ctx);
const K = ctx.__K;
const plain = v => JSON.parse(JSON.stringify(v));

function gtin(s13){ const z = s13.split('').map(Number); let s = 0; z.slice().reverse().forEach((d,i)=>{ s += d*(i%2===0?3:1); }); return s13 + ((10-(s%10))%10); }

/* ── Doppelungen ── */
test('Ähnlichkeit: gleich, ähnlich, verschieden', () => {
  const items = [{ id:'a', name:'Terumo' }, { id:'b', name:'Boston Scientific' }, { id:'c', name:'Abbott (Vascular)' }];
  assert.equal(K.naAehnliche('terumo', items)[0].grad, 'gleich');
  assert.equal(K.naAehnliche('Terumo Europe', items)[0].item.id, 'a');
  assert.equal(K.naAehnliche('Boston Scientifc', items)[0].item.id, 'b');   /* Tippfehler */
  assert.equal(K.naAehnliche('Abbott', items)[0].item.id, 'c');              /* ohne Klammer */
  assert.equal(K.naAehnliche('Medtronic', items).length, 0);
  assert.equal(K.naAehnliche('Terumo', [{ id:'x', name:'Terumo', archiviert:true }]).length, 0);
});

/* ── GTIN ── */
test('GTIN: Prüfziffer, 14-stellig, GS1 ohne Charge/Verfall', () => {
  const g = gtin('0401234567890');
  assert.equal(K.naGtinPruefziffer(g), true);
  assert.equal(K.naGtinPruefziffer(g.slice(0,13) + ((+g[13]+1)%10)), false);
  assert.equal(K.naGtinPruefziffer('abc'), false);
  assert.equal(K.naGtinKey('4012345678901'), '04012345678901');
  const s = K.naParseGS1('(01)' + g + '(17)261231(10)LOT42(240)RSS601');
  assert.deepEqual(plain(s), { gtin:g, itemRef:'RSS601' });
  assert.equal(K.naParseScan(g).kind, 'gtin');
  assert.equal(K.naParseScan('Hallo').kind, 'text');
});

/* ── Mengen und Kosten ── */
test('Menge: Unklares ist null, nie 1', () => {
  assert.equal(K.naMengeZahl('2x'), 2);
  assert.equal(K.naMengeZahl('2 Stk'), 2);
  assert.equal(K.naMengeZahl('0,5'), 0.5);
  assert.equal(K.naMengeZahl(''), null);
  assert.equal(K.naMengeZahl('1-2'), null);
  assert.equal(K.naMengeZahl('bei Bedarf'), null);
  assert.equal(K.naStueckpreis({ betrag:'120', bezugsmenge:10 }), 12);
  assert.equal(K.naStueckpreis({ betrag:'' }), null);
});
test('Kosten: Summe und benannte Lücken', () => {
  const std = K.naStandardNeu('T', '', ['Materialien']);
  const pos = std.rubriken[0].abschnitte[0].positionen;
  pos.push({ id:'p1', art:'material', ref:{ typ:'material', id:'m1' }, menge:'2x' });
  pos.push({ id:'p2', art:'material', ref:{ typ:'material', id:'m2' }, menge:'1-2' });
  pos.push({ id:'p3', art:'medikament', ref:{ typ:'medikament', id:'d1' }, menge:'1' });
  pos.push({ id:'p4', art:'geraet', ref:{ typ:'geraet', id:'g1' }, menge:'1' });
  const stamm = { m1:{ name:'A', preis:{ betrag:120, bezugsmenge:10 } }, m2:{ name:'B', preis:{ betrag:5 } }, d1:{ name:'C' } };
  const k = K.naKosten(std, r => stamm[r.id]);
  assert.equal(k.summe, 24);
  assert.equal(k.fehlend, 2);
  assert.equal(k.vollstaendig, false);
  assert.deepEqual(plain(k.posten.map(p => p.fehlt)), [null, 'menge', 'preis']);   /* Gerät zählt nicht */
});

/* ── Verwendung, Listen, Rüstliste ── */
test('Verwendungen und Listenverwendung', () => {
  const s = K.naStandardNeu('S', 'g1', ['R']); s.kennzeichen = ['k1'];
  s.rubriken[0].abschnitte[0].positionen.push({ id:'p', art:'material', ref:{ typ:'material', id:'m1' }, bereich:'tisch' });
  assert.equal(K.naVerwendungen([s], 'material', 'm1').length, 1);
  assert.equal(K.naVerwendungen([s], 'material', 'm2').length, 0);
  const d = { standards:[s], material:[{ id:'m1', hersteller:'h1', bereich:'tisch', kategorie:'schleuse' }] };
  assert.equal(K.naListenVerwendung('arten', 'material', d), 1);
  assert.equal(K.naListenVerwendung('bereiche', 'tisch', d), 2);
  assert.equal(K.naListenVerwendung('hersteller', 'h1', d), 1);
  assert.equal(K.naListenVerwendung('gruppen', 'g1', d), 1);
  assert.equal(K.naListenVerwendung('kennzeichen', 'k1', d), 1);
  assert.equal(K.naListenVerwendung('rubriken', 'R', d), 1);
  assert.equal(K.naListenVerwendung('kategorien', 'schleuse', d), 1);
});
test('Rüstliste: Bereich → Lagerort; Ansage markiert und zuletzt; Position schlägt Stammsatz', () => {
  const s = K.naStandardNeu('S', '', ['R']); const p = s.rubriken[0].abschnitte[0].positionen;
  p.push({ id:'1', ref:{ typ:'material', id:'a' }, ansage:true });
  p.push({ id:'2', ref:{ typ:'material', id:'b' } });
  p.push({ id:'3', ref:{ typ:'material', id:'c' }, bereich:'tisch' });
  p.push({ id:'4', text:'nur Text' });
  const st = { a:{ name:'A', bereich:'eingriff', lagerort:'S1' }, b:{ name:'B', bereich:'eingriff', lagerort:'S1' }, c:{ name:'C', bereich:'eingriff' } };
  const r = plain(K.naRuestliste(s, x => st[x.id], K.NA_BEREICHE_VORGABE));
  assert.deepEqual(r.map(g => g.bereich), ['tisch', 'eingriff']);
  assert.deepEqual(r[1].orte[0].posten.map(x => [x.name, x.ansage]), [['B', false], ['A', true]]);
  assert.equal(r[0].orte[0].ort, '');
});

/* ── Katalog ── */
test('Katalog-Overlay: eigene Kategorie, Feld dazu, Wert dazu; Quelle unverändert', () => {
  const vorher = JSON.stringify(KAT);
  const tpl = { klassen:{ k_x:{ neu:true, label:'Testklasse' }, schleuse:{ dazu:['m_eig'] } },
    merkmale:{ m_eig:{ label:'Eigenes', typ:'text' } }, werte:{ kurve_groesse:['XXL'] } };
  const kat = K.naKatalog(KAT, tpl);
  assert.ok(kat.klassen.some(k => k.id==='k_x' && k.eigen));
  const f = K.naFelder(kat, 'schleuse');
  assert.ok(f.weitere.concat(f.diff).some(d => d.id==='m_eig'));
  assert.ok(f.diff.length >= 3);
  assert.ok(kat.merkmale.find(m => m.id==='kurve_groesse').werte.includes('XXL'));
  assert.equal(JSON.stringify(KAT), vorher);
  assert.equal(K.naKatalog(null, tpl).klassen.length, 0);
});
test('Hersteller aus GTIN-Präfix und Namensvorschlag', () => {
  const m = [{ hersteller:'h1', gtin:gtin('0401234567890') }];
  assert.equal(K.naHerstellerAusGtin(m, gtin('0401234567111')).hersteller, 'h1');
  assert.equal(K.naHerstellerAusGtin(m, gtin('0999999999999')), null);
  const defs = [{ id:'a', einheit:'F' }, { id:'b', einheit:'cm' }];
  assert.equal(K.naNameVorschlag('Schleuse / Introducer', defs, { a:'6', b:'11' }), 'Schleuse · 6 F · 11 cm');
});

/* ── Standards ── */
test('Kopie bekommt neue Kennungen überall', () => {
  const s = K.naStandardNeu('A', '', ['R1', 'R2']);
  s.rubriken[0].abschnitte[0].positionen.push({ id:'p1', text:'x' });
  const k = K.naStandardKopie(s, 'B');
  assert.notEqual(k.id, s.id); assert.equal(k.titel, 'B'); assert.equal(k.kopieVon, s.id);
  assert.notEqual(k.rubriken[0].id, s.rubriken[0].id);
  assert.notEqual(k.rubriken[0].abschnitte[0].positionen[0].id, 'p1');
  assert.equal(s.rubriken[0].abschnitte[0].positionen[0].id, 'p1');   /* Original unverändert */
  assert.deepEqual(plain(K.naUnterschiede({ a:1, b:2, geaendert:1 }, { a:1, b:3, geaendert:2 })), ['b']);
  assert.equal(K.naCsv([['a;b', 'c"d']]), '"a;b";"c""d"');
});
test('Vorgaben: Hinweis wird nicht abgehakt; Bereiche Tisch und Eingriff', () => {
  assert.equal(K.NA_ARTEN_VORGABE.find(a => a.id==='hinweis').haken, false);
  assert.deepEqual(plain(K.NA_BEREICHE_VORGABE.map(b => b.name)), ['Tischvorbereitung', 'Eingriffsvorbereitung']);
});

/* ── Umleitung in store.js: nur im Neuaufbau ── */
function storeLaden(ls, pfad){
  const umgeleitet = [];
  const lsObj = { getItem:k => (k in ls ? ls[k] : null), setItem:(k,v) => { ls[k] = String(v); }, removeItem:k => { delete ls[k]; } };
  const c = vm.createContext({ localStorage:lsObj, window:{ stop(){} }, URL,
    location:{ pathname:pfad, href:'http://h' + pfad, replace:u => umgeleitet.push(u) }, document:{} });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'public/js/core/store.js'), 'utf8'), c);
  return umgeleitet;
}
test('store.js: Bestand wird NIE umgeleitet', () => {
  assert.deepEqual(storeLaden({}, '/'), []);
  assert.deepEqual(storeLaden({ hkl_liveraum:'bestand' }, '/'), []);
  assert.deepEqual(storeLaden({ hkl_raumwahl:'bestand', hkl_liveraum:'neuaufbau' }, '/'), []);
});
test('store.js: Neuaufbau → /neu/, außer dort selbst oder mit hkl_neu_alt', () => {
  assert.deepEqual(storeLaden({ hkl_raumwahl:'neuaufbau' }, '/'), ['http://h/neu/']);
  assert.deepEqual(storeLaden({ hkl_liveraum:'neuaufbau' }, '/index.html'), ['http://h/neu/']);
  assert.deepEqual(storeLaden({ hkl_raumwahl:'neuaufbau' }, '/neu/'), []);
  assert.deepEqual(storeLaden({ hkl_raumwahl:'neuaufbau', hkl_neu_alt:'1' }, '/'), []);
});
