'use strict';
/* Tests für die Freigabe mit Siegel (public/js/features/freigabe.js).

   Die Frage, um die es hier geht, ist keine technische: Ein Standard trägt den
   Vermerk „Freigegeben". Danach ändert jemand eine Menge. Sagt die App das —
   oder behauptet sie weiter, der Stand sei freigegeben?

   Deshalb prüft diese Suite in erster Linie das Verhalten NACH einer Änderung:
   über das Schnellmenü (QE.cid), über eine material-weite Änderung (QE.mat),
   über eine Ausblendung, über eine Umbenennung der Rubrik. Jede davon muss die
   Freigabe kippen. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function gleich(ist, soll, msg){ assert.deepEqual(JSON.parse(JSON.stringify(ist)), soll, msg); }

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'public/js/features/freigabe.js'), 'utf8');
const ECHT = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/hkl_standards_export.json'), 'utf8'));

/* Ein kleiner, nachgebauter Bestand: ein Standard mit zwei Rubriken. */
function zeile(t, m){ return { roh_text:t, anzeige_text:t, menge:m||null, natur:'material',
  natur_konfidenz:'hoch', unterkategorie:'Lager', groessen:[], spezifikation:null,
  material_key:t.toLowerCase(), ist_fliesstext:false }; }
function mini(){
  return [{ id:'a', titel:'Testeingriff', gruppe:'T', dateiname:'a.docx', rubriken:[
    { name:'Material', typ:'material', sub_bereiche:[{ name:null,
      eintraege:[ zeile('Kleiner Tisch','1x'), zeile('Coro-Set','1x'), zeile('NaCl-Flasche','2x') ] }] },
    { name:'Ablauf', typ:'ablauf', sub_bereiche:[{ name:null,
      eintraege:[ zeile('Patient lagern'), zeile('Abdecken') ] }] } ]}];
}

function umgebung(standards){
  const store = {};
  const ctx = vm.createContext({
    console,
    loadJSON: (k, d) => (k in store) ? JSON.parse(JSON.stringify(store[k])) : d,
    saveJSON: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
    DB: { standards: standards || [] },
    QE: { cid:{}, mat:{} },
    STDE: {},
    RUBE: {},
    NEW: [],
    saveSTDE: () => {},
    esc: (s) => String(s),
    today: () => '2026-07-31',
    ADMIN: true,
  });
  /* Die Auflöser der App, hier schlank nachgebaut — genau so weit, wie das
     Siegel sie braucht. */
  vm.runInContext(`
    function qeGet(e,cid,prop){ const c=QE.cid[cid]; if(c&&c[prop]!==undefined) return c[prop];
      const mk=e&&e.material_key; if(mk){ const m=QE.mat[mk]; if(m&&m[prop]!==undefined) return m[prop]; }
      return undefined; }
    function effNatur(e,cid){ const v=qeGet(e,cid,'natur'); return (v!==undefined)?v:(e.natur||''); }
    function canonUk(e,cid){ const v=qeGet(e,cid,'uk'); return (v!==undefined)?v:(e.unterkategorie||''); }
    function rubKey(s,r,i){ return (s?s.id:'')+'|'+i; }
    function rubName(r,i,std){ const e=RUBE[(std?std.id:'')+'|'+i]; return (e&&e.name)||r.name; }
    function rubHidden(r,i,std){ const e=RUBE[(std?std.id:'')+'|'+i]; return !!(e&&e.hidden); }
    function rubOrd(r,i,std){ const e=RUBE[(std?std.id:'')+'|'+i]; return (e&&e.ord!=null)?e.ord:i; }
    function rubIdxKey(r,i){ return i; }
    function newToEntry(n){ return { anzeige_text:n.name, menge:n.menge||null, natur:n.natur||'material',
      unterkategorie:n.uk||null, groessen:[], spezifikation:null, material_key:null }; }
    function stdTitel(s){ return (STDE[s.id]&&STDE[s.id].titel)||s.titel; }
    function stdHidden(s){ return !!(STDE[s.id]&&STDE[s.id].hidden); }
  `, ctx);
  vm.runInContext(SRC, ctx);
  return ctx;
}

/* ═══════════════════════════════════════════════════════════════
   1. Der Fingerabdruck
   ═══════════════════════════════════════════════════════════════ */

test('gleicher Text → gleicher Fingerabdruck, anderer Text → anderer', () => {
  const F = umgebung([]);
  assert.equal(F.frgHash('Coro-Set'), F.frgHash('Coro-Set'));
  assert.notEqual(F.frgHash('Coro-Set'), F.frgHash('Coro-Set '));
  assert.equal(F.frgHash(null), F.frgHash(''));
  assert.equal(F.frgHash('x').length, 8);
});

test('die Signatur einer Zeile enthält alles, was ein Mensch daran liest', () => {
  const F = umgebung([]);
  const e = { anzeige_text:'Coro-Set', menge:'1x', natur:'material', unterkategorie:'Lager',
    groessen:[{typ:'french',wert:'6F'}], spezifikation:'steril' };
  const sig = F.frgZeilenSignatur(e, 'a|0|0|0');
  ['Coro-Set','1x','6F','steril','material','Lager'].forEach(t=>
    assert.ok(sig.includes(t), t + ' fehlt in der Signatur'));
});

test('ohne Eintrag keine Signatur — und kein Absturz', () => {
  const F = umgebung([]);
  assert.equal(F.frgZeilenSignatur(null, 'x'), '');
  gleich(F.frgZeilen(null), []);
});

/* ═══════════════════════════════════════════════════════════════
   2. Das Siegel und der Abgleich
   ═══════════════════════════════════════════════════════════════ */

test('frisch gesiegelt heißt: gültig', () => {
  const F = umgebung(mini());
  assert.ok(F.frgFreigeben('a', 'Frau Muster', '1.0'));
  assert.equal(F.frgStatus(F.DB.standards[0]), 'gueltig');
  const m = F.STDE.a;
  assert.equal(m.status, 'Freigegeben');
  assert.equal(m.version, '1.0');
  assert.equal(m.approvedBy, 'Frau Muster');
  /* 2 Rubriküberschriften + 5 Zeilen */
  assert.equal(m.siegel.n, 7);
});

test('eine Umbenennung im Schnellmenü kippt die Freigabe', () => {
  const F = umgebung(mini());
  F.frgFreigeben('a', 'X', '1.0');
  F.QE.cid['a|0|0|1'] = { name:'Coro-Set XL' };
  F.frgCacheLeeren();
  assert.equal(F.frgStatus(F.DB.standards[0]), 'ueberholt');
  const d = F.frgAbgleich(F.STDE.a.siegel, F.frgZeilen(F.DB.standards[0]));
  assert.equal(d.neu.length, 1);
  assert.equal(d.neu[0].cid, 'a|0|0|1');
  assert.equal(d.neu[0].label, 'Coro-Set XL');
  assert.equal(d.weg.length, 1);
  assert.equal(d.weg[0].label, 'Coro-Set', 'die alte Fassung muss benennbar bleiben');
});

test('eine geänderte MENGE kippt die Freigabe genauso', () => {
  const F = umgebung(mini());
  F.frgFreigeben('a', 'X', '1.0');
  F.QE.cid['a|0|0|2'] = { mengeVal:'5x' };
  F.frgCacheLeeren();
  assert.equal(F.frgStatus(F.DB.standards[0]), 'ueberholt');
});

test('eine Änderung mit Reichweite „überall" (QE.mat) kippt sie auch', () => {
  const F = umgebung(mini());
  F.frgFreigeben('a', 'X', '1.0');
  F.QE.mat['coro-set'] = { uk:'Vorbereitungsraum' };
  F.frgCacheLeeren();
  assert.equal(F.frgStatus(F.DB.standards[0]), 'ueberholt');
});

test('eine ausgeblendete Zeile fällt als „entfernt" auf', () => {
  const F = umgebung(mini());
  F.frgFreigeben('a', 'X', '1.0');
  F.QE.cid['a|0|0|0'] = { hidden:true };
  F.frgCacheLeeren();
  const d = F.frgAbgleich(F.STDE.a.siegel, F.frgZeilen(F.DB.standards[0]));
  assert.equal(d.neu.length, 0);
  assert.equal(d.weg.length, 1);
  assert.equal(d.weg[0].label, 'Kleiner Tisch');
});

test('eine umbenannte RUBRIK kippt die Freigabe', () => {
  const F = umgebung(mini());
  F.frgFreigeben('a', 'X', '1.0');
  F.RUBE['a|1'] = { name:'Durchführung' };
  F.frgCacheLeeren();
  assert.equal(F.frgStatus(F.DB.standards[0]), 'ueberholt');
});

test('eine ausgeblendete Rubrik nimmt ihre Zeilen mit', () => {
  const F = umgebung(mini());
  F.frgFreigeben('a', 'X', '1.0');
  F.RUBE['a|1'] = { hidden:true };
  F.frgCacheLeeren();
  const d = F.frgAbgleich(F.STDE.a.siegel, F.frgZeilen(F.DB.standards[0]));
  assert.equal(d.weg.length, 3, 'Rubrikkopf + zwei Zeilen');
});

test('nur die Reihenfolge geändert: dieselben Zeilen, trotzdem überholt', () => {
  const F = umgebung(mini());
  F.frgFreigeben('a', 'X', '1.0');
  F.RUBE['a|0'] = { ord:9 };          /* Material hinter den Ablauf */
  F.frgCacheLeeren();
  const d = F.frgAbgleich(F.STDE.a.siegel, F.frgZeilen(F.DB.standards[0]));
  assert.equal(d.neu.length, 0);
  assert.equal(d.weg.length, 0);
  assert.equal(d.reihenfolge, true);
  assert.equal(d.gleich, false);
  assert.equal(F.frgStatus(F.DB.standards[0]), 'ueberholt');
});

test('erneut freigeben stellt die Gültigkeit wieder her', () => {
  const F = umgebung(mini());
  F.frgFreigeben('a', 'X', '1.0');
  F.QE.cid['a|0|0|1'] = { name:'Coro-Set XL' };
  F.frgCacheLeeren();
  assert.equal(F.frgStatus(F.DB.standards[0]), 'ueberholt');
  F.frgFreigeben('a', 'Y', '1.1');
  assert.equal(F.frgStatus(F.DB.standards[0]), 'gueltig');
  assert.equal(F.STDE.a.version, '1.1');
  assert.equal(F.STDE.a.approvedBy, 'Y');
});

/* ═══════════════════════════════════════════════════════════════
   3. Zustände
   ═══════════════════════════════════════════════════════════════ */

test('ohne jeden Vermerk wird nichts behauptet', () => {
  const F = umgebung(mini());
  assert.equal(F.frgStatus(F.DB.standards[0]), 'ohne');
  assert.equal(F.frgKopfHTML(F.DB.standards[0]), '');
  assert.equal(F.frgBadgeHTML(F.DB.standards[0]), '');
});

test('Entwurf bleibt Entwurf', () => {
  const F = umgebung(mini());
  F.STDE.a = { status:'Entwurf', version:'0.9' };
  assert.equal(F.frgStatus(F.DB.standards[0]), 'entwurf');
  assert.ok(F.frgKopfHTML(F.DB.standards[0]).includes('Entwurf'));
});

test('abgelaufene Gültigkeit schlägt die Freigabe', () => {
  const F = umgebung(mini());
  F.frgFreigeben('a', 'X', '1.0');
  F.STDE.a.validTo = '2026-01-01';
  assert.equal(F.frgStatus(F.DB.standards[0], '2026-07-31'), 'abgelaufen');
  /* Vor dem Ablaufdatum ist alles in Ordnung. */
  assert.equal(F.frgStatus(F.DB.standards[0], '2025-12-31'), 'gueltig');
});

test('„Freigegeben" ohne Siegel gilt als überholt, nicht als gültig', () => {
  const F = umgebung(mini());
  /* Genau der Altbestand: ein Vermerk aus der Zeit vor dem Siegel. */
  F.STDE.a = { status:'Freigegeben', version:'1.0', approvedBy:'Alt', approvedAt:'2025-01-01' };
  assert.equal(F.frgStatus(F.DB.standards[0]), 'ueberholt');
  assert.ok(F.frgKopfHTML(F.DB.standards[0]).includes('ohne Nachweis'));
});

test('Zurückziehen macht aus der Freigabe wieder einen Entwurf', () => {
  const F = umgebung(mini());
  F.frgFreigeben('a', 'X', '1.0');
  assert.ok(F.frgZurueckziehen('a'));
  assert.equal(F.frgStatus(F.DB.standards[0]), 'entwurf');
  assert.equal(F.STDE.a.siegel, undefined);
  assert.equal(F.STDE.a.version, '1.0', 'die Version bleibt');
  assert.equal(F.frgZurueckziehen('gibtsnicht'), false);
});

/* ═══════════════════════════════════════════════════════════════
   4. Anzeige und Bilanz
   ═══════════════════════════════════════════════════════════════ */

test('der Kopf sagt, WAS sich geändert hat — nicht nur DASS', () => {
  const F = umgebung(mini());
  F.frgFreigeben('a', 'Frau Muster', '1.0');
  const gut = F.frgKopfHTML(F.DB.standards[0]);
  assert.ok(gut.includes('Freigegeben'));
  assert.ok(gut.includes('Frau Muster'));
  assert.ok(gut.includes('Version 1.0'));
  F.QE.cid['a|0|0|1'] = { name:'Anders' };
  F.frgCacheLeeren();
  const schlecht = F.frgKopfHTML(F.DB.standards[0]);
  assert.ok(schlecht.includes('überholt'));
  assert.ok(/1 geänderte oder neue Zeile/.test(schlecht), schlecht);
  assert.ok(/1 entfernte Zeile/.test(schlecht), schlecht);
});

test('das Zeichen in der Übersicht erscheint nur, wenn es etwas zu sagen gibt', () => {
  const F = umgebung(mini());
  F.frgFreigeben('a', 'X', '1.0');
  assert.equal(F.frgBadgeHTML(F.DB.standards[0]), '', 'gültig braucht kein Zeichen');
  F.QE.cid['a|0|0|1'] = { name:'Anders' };
  F.frgCacheLeeren();
  assert.ok(F.frgBadgeHTML(F.DB.standards[0]).includes('überholt'));
});

test('die Bilanz zählt den ganzen Bestand', () => {
  const F = umgebung(mini());
  gleich(F.frgBilanz(), { gesamt:1, ohne:1, entwurf:0, gueltig:0, ueberholt:0, abgelaufen:0 });
  F.frgFreigeben('a', 'X', '1.0');
  gleich(F.frgBilanz(), { gesamt:1, ohne:0, entwurf:0, gueltig:1, ueberholt:0, abgelaufen:0 });
});

/* ═══════════════════════════════════════════════════════════════
   5. Am ECHTEN Bestand — Größe und Laufzeit
   ═══════════════════════════════════════════════════════════════ */

test('jeder echte Standard lässt sich versiegeln', () => {
  const F = umgebung(ECHT.standards);
  let gesamt = 0, groesste = 0;
  ECHT.standards.forEach(s=>{
    const si = F.frgSiegelBauen(s, {});
    assert.ok(si.n > 0, s.id + ' hat keine Zeilen');
    const bytes = JSON.stringify(si).length;
    gesamt += bytes; groesste = Math.max(groesste, bytes);
  });
  /* Das Siegel liegt im geteilten Zustand — es darf nicht ausufern.
     (Server-Grenze MAX_BODY: 32 MiB.) */
  assert.ok(gesamt < 1024*1024, 'alle Siegel zusammen: ' + Math.round(gesamt/1024) + ' KB');
  assert.ok(groesste < 60*1024, 'größtes Siegel: ' + Math.round(groesste/1024) + ' KB');
});

test('unverändert bleibt unverändert — über den ganzen Bestand', () => {
  const F = umgebung(ECHT.standards);
  ECHT.standards.forEach(s=>{
    const si = F.frgSiegelBauen(s, {});
    assert.equal(F.frgAbgleich(si, F.frgZeilen(s)).gleich, true, s.id);
  });
});

test('Randfälle laufen ins Leere statt in einen Fehler', () => {
  const F = umgebung([]);
  gleich(F.frgAbgleich(null, []), { ohne:true, gleich:false, neu:[], weg:[], reihenfolge:false });
  gleich(F.frgAbgleich({}, []), { ohne:true, gleich:false, neu:[], weg:[], reihenfolge:false });
  assert.equal(F.frgFreigeben('gibtsnicht'), false);
  gleich(F.frgBilanz(), { gesamt:0, ohne:0, entwurf:0, gueltig:0, ueberholt:0, abgelaufen:0 });
  assert.equal(F.frgText('quatsch').kurz, '');
});
