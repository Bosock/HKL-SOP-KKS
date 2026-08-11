'use strict';
/* Tests für die facettierte Übersicht (public/js/features/facetten.js).

   Der Erkennungsteil läuft am ECHTEN Bestand: Die 47 Titel sind genau das, was
   die Zerlegung tragen muss — samt der Stolperstellen „Re-PVI", „S-ICD",
   „Mitra-Clip" (Bindestriche, die keine Trennung sind) und „LAA- Abbott"
   (Leerraum nur auf einer Seite). */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function gleich(ist, soll, msg){ assert.deepEqual(JSON.parse(JSON.stringify(ist)), soll, msg); }

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'public/js/features/facetten.js'), 'utf8');
const ECHT = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/hkl_standards_export.json'), 'utf8'));
const BEZ = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/bezeichnungen.json'), 'utf8'));
const HERSTELLER = (BEZ.hersteller && BEZ.hersteller.werte) || [];

function umgebung(standards){
  const store = {};
  const ctx = vm.createContext({
    console,
    loadJSON: (k, d) => (k in store) ? JSON.parse(JSON.stringify(store[k])) : d,
    saveJSON: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
    DB: { standards: standards || [] },
    esc: (s) => String(s),
    ADMIN: false,
  });
  vm.runInContext(`
    function stdTitel(s){ return s.titel; }
    function stdGruppe(s){ return s.gruppe; }
    function stdHidden(){ return false; }
    function bezHersteller(){ return ${JSON.stringify(HERSTELLER)}; }
  `, ctx);
  vm.runInContext(SRC, ctx);
  return ctx;
}

/* ═══════════════════════════════════════════════════════════════
   1. Trennen — und vor allem: NICHT trennen
   ═══════════════════════════════════════════════════════════════ */

test('am Strich mit Leerraum wird getrennt', () => {
  const F = umgebung([]);
  gleich(F.facTeile('Transfemoral - Edwards - SAPIEN 3 Ultra'),
    ['Transfemoral', 'Edwards', 'SAPIEN 3 Ultra']);
  /* Leerraum nur auf EINER Seite genügt — so steht es im Bestand. */
  gleich(F.facTeile('LAA- Abbott'), ['LAA', 'Abbott']);
  gleich(F.facTeile('Konventionell - Cryo-PVI - Stationär Saal 1'),
    ['Konventionell', 'Cryo-PVI', 'Stationär Saal 1']);
});

test('ein Strich MITTEN im Wort trennt nicht', () => {
  const F = umgebung([]);
  ['Re-PVI', 'S-ICD', 'CRT-D', 'VVI-ICD', 'Mitra-Clip', 'Event-Recorder Implantation',
   'PFO+ASD', 'Evolut FX+', '4-0er MONOCRYL'].forEach(t=>{
    gleich(F.facTeile(t), [t], t + ' wurde zerrissen');
  });
});

test('leerer Titel ergibt keine Teile', () => {
  const F = umgebung([]);
  gleich(F.facTeile(''), []);
  gleich(F.facTeile(null), []);
  gleich(F.facTeile('   -  '), []);
});

/* ═══════════════════════════════════════════════════════════════
   2. Hersteller kommen aus der gepflegten Liste — nicht aus dem Code
   ═══════════════════════════════════════════════════════════════ */

test('ein Titelteil aus der Herstellerliste wird als Hersteller erkannt', () => {
  const F = umgebung([]);
  const r = F.facHersteller(['Transfemoral', 'Edwards', 'SAPIEN 3 Ultra'], HERSTELLER);
  gleich(r.hersteller, ['Edwards']);
  gleich(r.rest, ['Transfemoral', 'SAPIEN 3 Ultra']);
});

test('ohne Liste ist kein Teil ein Hersteller — es wird nichts geraten', () => {
  const F = umgebung([]);
  const r = F.facHersteller(['Transfemoral', 'Edwards'], []);
  gleich(r.hersteller, []);
  gleich(r.rest, ['Transfemoral', 'Edwards']);
});

test('Schreibweise ist egal', () => {
  const F = umgebung([]);
  gleich(F.facHersteller(['edwards'], ['Edwards']).hersteller, ['Edwards']);
  gleich(F.facHersteller(['Boston  Scientific'], ['Boston Scientific']).hersteller, ['Boston Scientific']);
});

/* ═══════════════════════════════════════════════════════════════
   3. Merkmale eines Standards
   ═══════════════════════════════════════════════════════════════ */

test('aus einem Bindestrich-Titel werden greifbare Merkmale', () => {
  const F = umgebung([]);
  const m = F.facVonStandard({}, { titel:'Transfemoral - Edwards - SAPIEN 3 Ultra',
    gruppe:'TAVI', hersteller:HERSTELLER, zustand:'Freigegeben' });
  gleich(m.gruppe, ['TAVI']);
  gleich(m.hersteller, ['Edwards']);
  gleich(m.art, ['Transfemoral']);
  gleich(m.auspraegung, ['SAPIEN 3 Ultra']);
  gleich(m.zustand, ['Freigegeben']);
});

test('ein Titel ohne Strich hat nur eine Art', () => {
  const F = umgebung([]);
  const m = F.facVonStandard({}, { titel:'Perikardpunktion', gruppe:'SOS', hersteller:HERSTELLER });
  gleich(m.art, ['Perikardpunktion']);
  gleich(m.auspraegung, []);
  gleich(m.hersteller, []);
  gleich(m.zustand, []);
});

test('mehrere Ausprägungen bleiben einzeln greifbar', () => {
  const F = umgebung([]);
  const m = F.facVonStandard({}, { titel:'Schrittmacher - AAI - VVI', gruppe:'CRM', hersteller:HERSTELLER });
  gleich(m.art, ['Schrittmacher']);
  gleich(m.auspraegung, ['AAI', 'VVI']);
});

/* ═══════════════════════════════════════════════════════════════
   4. Auswählen: ODER innerhalb, UND zwischen den Merkmalsarten
   ═══════════════════════════════════════════════════════════════ */

const M = (g, a, h) => ({ gruppe:[g], art:[a], hersteller:h?[h]:[], auspraegung:[], zustand:[] });

test('ohne Auswahl passt alles', () => {
  const F = umgebung([]);
  assert.equal(F.facPasst(M('TAVI','Transfemoral','Edwards'), {}), true);
  assert.equal(F.facPasst(M('TAVI','Transfemoral','Edwards'), { gruppe:[] }), true);
});

test('innerhalb einer Art gilt ODER', () => {
  const F = umgebung([]);
  const m = M('TAVI','Transfemoral','Edwards');
  assert.equal(F.facPasst(m, { gruppe:['TAVI','EPU'] }), true);
  assert.equal(F.facPasst(m, { gruppe:['EPU','CRM'] }), false);
});

test('zwischen den Arten gilt UND', () => {
  const F = umgebung([]);
  const m = { gruppe:['TAVI'], zustand:['Freigegeben'] };
  assert.equal(F.facPasst(m, { gruppe:['TAVI'], zustand:['Freigegeben'] }), true);
  assert.equal(F.facPasst(m, { gruppe:['TAVI'], zustand:['Entwurf'] }), false);
});

/* ═══════════════════════════════════════════════════════════════
   5. Die Leiste — am ECHTEN Bestand
   ═══════════════════════════════════════════════════════════════ */

function echtePosten(F){
  return ECHT.standards.map(s=>({ id:s.id, merkmale: F.facVonStandard(s, {
    titel:s.titel, gruppe:s.gruppe, hersteller:HERSTELLER, zustand:'' }) }));
}

/* Der Betreiber hat „Art", „Hersteller" und „Ausprägung" aus der Leiste
   genommen: „der Bereich reicht als Filter!" Diese Prüfung hält das fest —
   sie schlägt an, wenn die drei über eine Hintertür zurückkommen. */
test('die Leiste zeigt nur den Bereich — die geratenen Merkmale sind raus', () => {
  const F = umgebung(ECHT.standards);
  const f = F.facBauen(echtePosten(F), {});
  const keys = f.map(x=>x.key);
  gleich(keys, ['gruppe']);
  assert.equal(f[0].werte.length, 8, 'acht Bereiche: ' + f[0].werte.length);
  ['art','hersteller','auspraegung'].forEach(k=>
    assert.equal(f.find(x=>x.key===k), undefined, k + ' gehört nicht mehr in die Leiste'));
});

test('EIN Griff führt von 47 auf fünf Standards', () => {
  const F = umgebung(ECHT.standards);
  const posten = echtePosten(F);
  const uebrig = (wahl)=>posten.filter(p=>F.facPasst(p.merkmale, wahl)).length;
  assert.equal(uebrig({}), 47);
  assert.equal(uebrig({ gruppe:['TAVI'] }), 5);
  /* Weiter geht es über die SUCHE oder über gepflegte Merkmale — nicht über
     eine aus dem Titel geratene Unterteilung. */
});

test('die gewählte Reihe bleibt vollständig — sonst käme man nicht zurück', () => {
  const F = umgebung(ECHT.standards);
  const f = F.facBauen(echtePosten(F), { gruppe:['TAVI'] });
  /* Die Zähler der GEWÄHLTEN Art rechnen ohne die eigene Auswahl — sonst
     könnte man nie zu einem anderen Bereich wechseln. */
  const grp = f.find(x=>x.key==='gruppe');
  assert.equal(grp.werte.length, 8);
  assert.equal(grp.werte.find(x=>x.wert==='TAVI').an, true);
});

test('eine Auswahl, die auf null führt, wird nicht angeboten', () => {
  const F = umgebung(ECHT.standards);
  const f = F.facBauen(echtePosten(F), { gruppe:['TAVI'] });
  f.forEach(x=>x.werte.forEach(v=>assert.ok(v.n > 0, x.key + '/' + v.wert + ' hätte 0 Treffer')));
});

test('die gewählte Art bleibt stehen — sonst käme man nicht zurück', () => {
  const F = umgebung(ECHT.standards);
  const f = F.facBauen(echtePosten(F), { gruppe:['Klappen'] });
  assert.ok(f.find(x=>x.key==='gruppe'));
});

test('die Werte stehen nach Häufigkeit, dann alphabetisch', () => {
  const F = umgebung(ECHT.standards);
  const f = F.facBauen(echtePosten(F), {});
  const w = f.find(x=>x.key==='gruppe').werte;
  for(let i=1;i<w.length;i++){
    assert.ok(w[i-1].n >= w[i].n, 'Reihenfolge stimmt nicht bei ' + w[i].wert);
  }
});

test('gezählt wird, was ausgewählt ist', () => {
  const F = umgebung([]);
  assert.equal(F.facAnzahlGewaehlt({}), 0);
  assert.equal(F.facAnzahlGewaehlt({ gruppe:['TAVI','CRM'], zustand:['Freigegeben'] }), 3);
  assert.equal(F.facAnzahlGewaehlt(null), 0);
});

/* ═══════════════════════════════════════════════════════════════
   6. Benennbarkeit und Randfälle
   ═══════════════════════════════════════════════════════════════ */

test('die Merkmalsnamen sind Vorgaben, keine festen Wörter', () => {
  const F = umgebung([]);
  assert.equal(F.facLabel('gruppe'), 'Bereich');
  assert.equal(F.facLabel('zustand'), 'Freigabe');
  /* Mit einer eigenen Bezeichnung gewinnt diese. */
  vm.runInContext(`function bezWert(zweig,feld,rueckfall){ return (zweig==='facetten'&&feld==='gruppe')?'Fachgebiet':rueckfall; }`, F);
  assert.equal(F.facLabel('gruppe'), 'Fachgebiet');
  assert.equal(F.facLabel('zustand'), 'Freigabe');
});

test('leerer Bestand, leere Eingaben: kein Absturz', () => {
  const F = umgebung([]);
  gleich(F.facBauen(null, null), []);
  gleich(F.facBauen([], {}), []);
  gleich(F.facPosten(), []);
  assert.equal(F.facTrefferIds(), null);
  assert.equal(F.facBarHTML(), '');
  gleich(F.facVonStandard(null, null).art, []);
});

test('die Leiste erscheint erst, wenn es etwas zu unterscheiden gibt', () => {
  const wenige = ECHT.standards.slice(0, 3);
  const F = umgebung(wenige);
  assert.equal(F.facBarHTML(), '', 'bei drei Standards lohnt kein Filter');
  const G = umgebung(ECHT.standards);
  const h = G.facBarHTML();
  assert.ok(h.includes('facbar'));
  assert.ok(h.includes('TAVI'));
  assert.ok(!h.includes('Filter zurücksetzen'), 'ohne Auswahl kein Zurücksetzen');
});

test('sobald gefiltert wird, steht dort, wie viele von wie vielen', () => {
  const F = umgebung(ECHT.standards);
  F.facWaehle('gruppe', 'TAVI');
  const h = F.facBarHTML();
  assert.ok(/<b>5<\/b> von 47/.test(h), h.slice(0, 300));
  assert.ok(h.includes('Filter zurücksetzen'));
  const ids = F.facTrefferIds();
  assert.equal(Object.keys(ids).length, 5);
  F.facZuruecksetzen();
  assert.equal(F.facTrefferIds(), null);
});
