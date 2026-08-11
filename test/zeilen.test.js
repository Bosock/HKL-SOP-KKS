'use strict';
/* Tests für „Zeilen ändern" (features/zeilen.js).

   Der Messstand (e2e/messen.js) hatte gezählt: Eine Zeile umbenennen kostete
   sechs Berührungen und zwei Bildschirmwechsel; „Details bearbeiten" öffnet
   7 Felder über 1,8 Bildschirmhöhen und VERLÄSST die Rubrik.

   Der Entwurf ist der Kern dieses Bausteins, und er ist reine Rechnerei —
   also wird er hier geprüft. Zwei Zusagen tragen alles:

   ① Im Entwurf steht NUR, was sich wirklich unterscheidet. Wer ein Feld
      antippt und es unverändert lässt, hat nichts geändert — sonst zeigte
      das Prüfblatt Änderungen an, die keine sind, und die Reichweitenfrage
      würde bedeutungslos.
   ② Nichts wird geschrieben, bevor es jemand gesehen hat. Der Entwurf ist
      vom Bestand getrennt; erst „Übernehmen" schreibt.
*/

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const lies = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* Ein winziger Bestand: zwei Rubriken, ein geteiltes Material, eine
   Überschrift, eine ausgeblendete Zeile. */
function bestand() {
  return {
    standards: [{
      id: 'S1', titel: 'Testeingriff', gruppe: 'HKL',
      rubriken: [{
        name: 'Material', typ: 'material',
        sub_bereiche: [{
          eintraege: [
            { anzeige_text: 'Radialschleuse 6F', menge: '2x', spezifikation: 'femoral', material_key: 'radialschleuse', natur: 'material' },
            { anzeige_text: 'Führungsdraht', menge: null, spezifikation: null, material_key: 'draht', natur: 'material' },
            { anzeige_text: 'ZUGANG', natur: 'ueberschrift' },
            { anzeige_text: 'Versteckt', material_key: 'weg', natur: 'material' },
          ],
        }],
      }],
    }],
  };
}

function umgebung(versteckt) {
  const DB = bestand();
  const qe = { cid: {} };
  if (versteckt) qe.cid['S1|0|0|3'] = { hidden: true };
  const geschrieben = [];
  const ctx = vm.createContext({
    console, esc: (s) => String(s == null ? '' : s), $: () => null,
    toast: () => {}, setTimeout: () => {}, ADMIN: true, DB,
    curStd: DB.standards[0],
    cidOf: (sid, ri, si, ei) => [sid, ri, si, ei].join('|'),
    qeGet: (e, cid, prop) => (qe.cid[cid] || {})[prop],
    effNatur: (e) => e.natur || 'material',
    natOf: () => ({ color: '#888', label: 'Material' }),
    rubName: (r) => r.name,
    /* Der Schreibweg wird nur beobachtet, nicht ausgeführt. */
    applyPending: (scope, best) => { geschrieben.push({ scope, best, kind: ctx.sheetPending.kind, value: ctx.sheetPending.value, cid: ctx.sheetCid }); },
    sheetEntry: null, sheetCid: null, sheetPending: null,
    showSheet: () => {}, openRubrik: () => {}, show: () => {}, setBar: () => {},
    rwStufen: (cid, mk) => ([
      { key: 'cid', ico: '📍', wort: 'Nur hier', lang: 'Nur hier', langSub: 'diese eine Stelle' },
      { key: 'std', ico: '📄', wort: 'Standard', lang: 'In diesem Standard', langSub: '3× hier' },
    ]),
  });
  vm.runInContext(lies('public/js/features/zeilen.js'), ctx);
  vm.runInContext(`globalThis.__z = { felder:()=>ZEIL_FELDER, wert:zeilWert,
    setzen:zeilSetzen, anzahl:zeilAnzahl, zeilen:zeilZeilen, verworfen:zeilVerworfen,
    liste:zeilListe, aenderungen:(i,d)=>zeilAenderungen(i,d),
    an:zeilAn, aus:zeilAus, beenden:zeilBeenden, aktiv:zeilAktiv, aktivFuer:zeilAktivFuer,
    setRi:(i)=>{ zeilRi=i; }, setEntwurf:(d)=>{ ZEIL=d; }, holEntwurf:()=>ZEIL,
    setScope:(s)=>{ zeilScope=s; }, speichern:zeilSpeichern };`, ctx);
  return { z: ctx.__z, ctx, geschrieben, DB };
}

/* ═══════════ Der Entwurf ═══════════ */

test('drei Felder sind inline änderbar — Name, Menge, Spezifikation', () => {
  const { z } = umgebung();
  const f = z.felder();
  assert.equal(f.length, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(f.map(x => x.key))), ['name', 'menge', 'spez']);
  /* Jedes Feld trägt den Schlüssel, unter dem es im Journal landet. */
  assert.deepEqual(JSON.parse(JSON.stringify(f.map(x => x.prop))), ['name', 'mengeVal', 'spez']);
});

test('der aktuelle Wert kommt aus der Kaskade, nicht aus der Quelldatei', () => {
  const { z, ctx } = umgebung();
  const e = ctx.DB.standards[0].rubriken[0].sub_bereiche[0].eintraege[0];
  assert.equal(z.wert(e, 'S1|0|0|0', 'name'), 'Radialschleuse 6F');
  assert.equal(z.wert(e, 'S1|0|0|0', 'menge'), '2x');
  assert.equal(z.wert(e, 'S1|0|0|0', 'spez'), 'femoral');
  const leer = ctx.DB.standards[0].rubriken[0].sub_bereiche[0].eintraege[1];
  assert.equal(z.wert(leer, 'S1|0|0|1', 'menge'), '', 'kein Wert heißt leerer Text, nicht „null"');
  assert.equal(z.wert(leer, 'S1|0|0|1', 'spez'), '');
});

test('DER KERN: ein unveränderter Wert landet NICHT im Entwurf', () => {
  const { z } = umgebung();
  let d = {};
  d = z.setzen(d, 'S1|0|0|0', 'name', 'Radialschleuse 6F', 'Radialschleuse 6F');
  assert.equal(z.anzahl(d), 0, 'gleich bleibt gleich');
  d = z.setzen(d, 'S1|0|0|0', 'name', '  Radialschleuse 6F  ', 'Radialschleuse 6F');
  assert.equal(z.anzahl(d), 0, 'Leerzeichen am Rand sind keine Änderung');
  d = z.setzen(d, 'S1|0|0|0', 'name', 'Radialschleuse 5F', 'Radialschleuse 6F');
  assert.equal(z.anzahl(d), 1);
});

test('zurück auf den Ausgangswert räumt den Entwurf wieder leer', () => {
  const { z } = umgebung();
  let d = {};
  d = z.setzen(d, 'S1|0|0|0', 'name', 'Anders', 'Radialschleuse 6F');
  d = z.setzen(d, 'S1|0|0|0', 'menge', '3x', '2x');
  assert.equal(z.anzahl(d), 2);
  d = z.setzen(d, 'S1|0|0|0', 'name', 'Radialschleuse 6F', 'Radialschleuse 6F');
  assert.equal(z.anzahl(d), 1, 'nur die Menge bleibt');
  d = z.setzen(d, 'S1|0|0|0', 'menge', '2x', '2x');
  assert.equal(z.anzahl(d), 0);
  assert.deepEqual(JSON.parse(JSON.stringify(d)), {}, 'kein leerer Rest bleibt liegen');
});

test('gezählt werden FELDER, nicht Zeilen — jede Änderung ist eine Entscheidung', () => {
  const { z } = umgebung();
  let d = {};
  d = z.setzen(d, 'S1|0|0|0', 'name', 'A', 'Radialschleuse 6F');
  d = z.setzen(d, 'S1|0|0|0', 'menge', '9x', '2x');
  d = z.setzen(d, 'S1|0|0|1', 'name', 'B', 'Führungsdraht');
  assert.equal(z.anzahl(d), 3, 'drei Änderungen');
  assert.equal(z.zeilen(d), 2, 'in zwei Zeilen');
});

test('eine einzelne Änderung lässt sich zurücknehmen', () => {
  const { z } = umgebung();
  let d = {};
  d = z.setzen(d, 'S1|0|0|0', 'name', 'A', 'Radialschleuse 6F');
  d = z.setzen(d, 'S1|0|0|0', 'menge', '9x', '2x');
  d = z.verworfen(d, 'S1|0|0|0', 'menge');
  assert.equal(z.anzahl(d), 1);
  d = z.verworfen(d, 'S1|0|0|0', 'name');
  assert.deepEqual(JSON.parse(JSON.stringify(d)), {}, 'die leere Zeile bleibt nicht stehen');
});

/* ═══════════ Welche Zeilen überhaupt ═══════════ */

test('Überschriften stehen nicht zur Bearbeitung — dort gibt es keine Menge', () => {
  const { z } = umgebung();
  const l = z.liste(0);
  assert.equal(l.length, 3, 'drei echte Zeilen, die Überschrift fällt heraus');
  assert.equal(JSON.parse(JSON.stringify(l.map(x => x.cid))).indexOf('S1|0|0|2'), -1);
});

test('ausgeblendete Zeilen ebenfalls nicht — sonst pflegt man Unsichtbares', () => {
  const { z } = umgebung(true);
  const l = z.liste(0);
  assert.equal(l.length, 2);
  assert.equal(JSON.parse(JSON.stringify(l.map(x => x.cid))).indexOf('S1|0|0|3'), -1);
});

test('eine Rubrik, die es nicht gibt, liefert nichts statt zu stolpern', () => {
  const { z } = umgebung();
  assert.equal(z.liste(99).length, 0);
});

/* ═══════════ Das Prüfblatt ═══════════ */

test('jede Änderung trägt vorher UND nachher — sonst kann niemand urteilen', () => {
  const { z } = umgebung();
  let d = {};
  d = z.setzen(d, 'S1|0|0|0', 'name', 'Radialschleuse 5F', 'Radialschleuse 6F');
  d = z.setzen(d, 'S1|0|0|1', 'menge', '2x', '');
  const a = JSON.parse(JSON.stringify(z.aenderungen(0, d)));
  assert.equal(a.length, 2);
  assert.equal(a[0].vorher, 'Radialschleuse 6F');
  assert.equal(a[0].nachher, 'Radialschleuse 5F');
  assert.equal(a[0].prop, 'name');
  assert.equal(a[0].name, 'Radialschleuse 6F', 'die Zeile nennt sich beim alten Namen — daran erkennt man sie');
  assert.equal(a[1].vorher, '');
  assert.equal(a[1].nachher, '2x');
  assert.equal(a[1].prop, 'mengeVal');
});

test('die Änderungen stehen in der Reihenfolge der Anzeige', () => {
  const { z } = umgebung();
  let d = {};
  d = z.setzen(d, 'S1|0|0|1', 'name', 'Zweite', 'Führungsdraht');
  d = z.setzen(d, 'S1|0|0|0', 'name', 'Erste', 'Radialschleuse 6F');
  const a = JSON.parse(JSON.stringify(z.aenderungen(0, d)));
  assert.deepEqual(a.map(x => x.nachher), ['Erste', 'Zweite'],
    'sonst sucht man im Prüfblatt, was oben in der Liste stand');
});

test('eine Änderung an einer Zeile ohne geteiltes Material kennt keine Reichweite', () => {
  const { z, ctx } = umgebung();
  delete ctx.DB.standards[0].rubriken[0].sub_bereiche[0].eintraege[1].material_key;
  let d = {};
  d = z.setzen(d, 'S1|0|0|1', 'name', 'Neu', 'Führungsdraht');
  const a = JSON.parse(JSON.stringify(z.aenderungen(0, d)));
  assert.equal(a[0].mk, null, 'ohne geteiltes Material gibt es kein weiteres Ziel');
});

/* ═══════════ Schreiben ═══════════ */

test('DER KERN: geschrieben wird erst beim Übernehmen — und über den EINEN Weg', () => {
  const { z, geschrieben } = umgebung();
  let d = {};
  d = z.setzen(d, 'S1|0|0|0', 'name', 'Radialschleuse 5F', 'Radialschleuse 6F');
  d = z.setzen(d, 'S1|0|0|0', 'spez', '', 'femoral');
  z.setRi(0); z.setEntwurf(d);
  assert.equal(geschrieben.length, 0, 'bis hierher ist nichts geschrieben');
  z.speichern();
  assert.equal(geschrieben.length, 2);
  assert.equal(geschrieben[0].kind, 'name');
  assert.equal(geschrieben[0].value, 'Radialschleuse 5F');
  assert.equal(geschrieben[1].kind, 'spez');
  assert.equal(geschrieben[1].value, null, 'ein leer gemachtes Feld wird zu „keine Angabe", nicht zu leerem Text');
  assert.equal(geschrieben[0].best, true, 'das Prüfblatt IST die Bestätigung — keine zweite Rückfrage je Zeile');
});

test('die gewählte Reichweite gilt für alle Zeilen mit geteiltem Material', () => {
  const { z, geschrieben, ctx } = umgebung();
  delete ctx.DB.standards[0].rubriken[0].sub_bereiche[0].eintraege[1].material_key;
  let d = {};
  d = z.setzen(d, 'S1|0|0|0', 'name', 'A', 'Radialschleuse 6F');
  d = z.setzen(d, 'S1|0|0|1', 'name', 'B', 'Führungsdraht');
  z.setRi(0); z.setEntwurf(d); z.setScope('std');
  z.speichern();
  assert.equal(geschrieben[0].scope, 'std', 'mit geteiltem Material gilt die Wahl');
  assert.equal(geschrieben[1].scope, 'cid', 'ohne geteiltes Material geht nur „nur hier"');
});

test('ein leer gemachter NAME wird übersprungen — leer schlägt falsch', () => {
  const { z, geschrieben } = umgebung();
  let d = {};
  d = z.setzen(d, 'S1|0|0|0', 'name', '', 'Radialschleuse 6F');
  d = z.setzen(d, 'S1|0|0|1', 'name', 'Echt', 'Führungsdraht');
  z.setRi(0); z.setEntwurf(d);
  z.speichern();
  assert.equal(geschrieben.length, 1, 'eine namenlose Zeile entsteht nicht');
  assert.equal(geschrieben[0].value, 'Echt');
});

test('nach dem Übernehmen ist der Modus aus und der Entwurf leer', () => {
  const { z } = umgebung();
  let d = {};
  d = z.setzen(d, 'S1|0|0|0', 'name', 'A', 'Radialschleuse 6F');
  z.setRi(0); z.setEntwurf(d);
  z.speichern();
  assert.equal(z.aktiv(), false);
  assert.deepEqual(JSON.parse(JSON.stringify(z.holEntwurf())), {});
});

test('der Modus gilt für GENAU eine Rubrik', () => {
  const { z } = umgebung();
  z.setRi(0);
  assert.equal(z.aktivFuer(0), true);
  assert.equal(z.aktivFuer(1), false);
  z.beenden();
  assert.equal(z.aktiv(), false);
});

test('Verlassen räumt den Entwurf mit ab — kein Rest für die nächste Rubrik', () => {
  const { z } = umgebung();
  let d = {};
  d = z.setzen(d, 'S1|0|0|0', 'name', 'A', 'Radialschleuse 6F');
  z.setRi(0); z.setEntwurf(d);
  z.beenden();
  assert.deepEqual(JSON.parse(JSON.stringify(z.holEntwurf())), {});
});
