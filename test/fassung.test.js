'use strict';
/* Tests für das Festschreiben (public/js/features/fassung.js).

   Festschreiben ist die Handlung, bei der man sich irrt — man macht sie
   selten, und sie nimmt einem hinterher die Einzel-Rücknahme weg. Also muss
   genau zweierlei belastbar sein:

   ① Die geltende Fassung ist eindeutig. Bei zwei Fassungen desselben
      Standards muss IMMER die neuere gewinnen, und eine verworfene darf
      niemals mehr zählen.
   ② Verwerfen muss den Stand davor wiederherstellen — sonst wäre der
      Fehlgriff dauerhaft, und das ist der eine Punkt, an dem ich dem
      Betreiber widersprochen habe.
*/

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'public/js/features/fassung.js'), 'utf8');

function umgebung(vorgabe) {
  const store = Object.assign({ hkl_fassungen: [] }, vorgabe || {});
  const ctx = vm.createContext({
    console,
    loadJSON: (k, d) => (k in store) ? JSON.parse(JSON.stringify(store[k])) : d,
    saveJSON: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
    esc: (s) => String(s == null ? '' : s),
    window: undefined,
    setTimeout: () => {},
  });
  vm.runInContext(SRC + `
    ;globalThis.__f = {
      geltende:fasGeltende, fuer:fasFuerStandard, alle:fasAlleFuer,
      wert:fasWert, hat:fasHat, verwerfen:fasVerwerfen, felder:FAS_FELDER,
      roh:()=>FAS, setzen:(l)=>{ FAS=l; saveFas(); }
    };
  `, ctx);
  return { f: ctx.__f, store };
}

const F1 = { id: 'f1', ts: '2026-01-10T10:00:00Z', sid: 's1', wort: 'Januar',
  werte: { 's1|0|0|1': { name: 'Alt' } }, regeln: ['r1'] };
const F2 = { id: 'f2', ts: '2026-03-01T10:00:00Z', sid: 's1', wort: 'März',
  werte: { 's1|0|0|1': { name: 'Neu' }, 's1|0|0|2': { mengeVal: '2x' } }, regeln: ['r2', 'r3'] };
const F3 = { id: 'f3', ts: '2026-02-01T10:00:00Z', sid: 's2', wort: 'Februar',
  werte: { 's2|0|0|0': { name: 'Zweiter' } }, regeln: [] };

/* ═══ Welche Fassung gilt? ═══ */

test('bei zwei Fassungen desselben Standards gilt die neuere', () => {
  const { f } = umgebung({ hkl_fassungen: [F1, F2] });
  const g = f.geltende();
  assert.equal(g.length, 1);
  assert.equal(g[0].id, 'f2');
  assert.equal(f.wert('s1|0|0|1', 'name'), 'Neu');
});

test('die Reihenfolge im Speicher ändert nichts — es zählt der Zeitstempel', () => {
  const { f } = umgebung({ hkl_fassungen: [F2, F1] });
  assert.equal(f.fuer('s1').id, 'f2');
});

test('jeder Standard hat seine eigene geltende Fassung', () => {
  const { f } = umgebung({ hkl_fassungen: [F1, F2, F3] });
  assert.equal(f.geltende().length, 2);
  assert.equal(f.fuer('s2').id, 'f3');
  assert.equal(f.fuer('s3'), null);
});

test('eine Stelle ohne Fassung liefert undefined, nicht null', () => {
  const { f } = umgebung({ hkl_fassungen: [F2] });
  assert.equal(f.wert('s1|9|9|9', 'name'), undefined, 'undefined heißt „nichts gesagt" — null wäre ein Wert');
  assert.equal(f.wert('s1|0|0|1', 'menge'), undefined);
  assert.equal(f.hat('s1|0|0|1'), true);
  assert.equal(f.hat('s1|9|9|9'), false);
});

/* ═══ Verwerfen ═══ */

test('DAS ENTSCHEIDENDE: Verwerfen stellt den Stand davor wieder her', () => {
  const { f } = umgebung({ hkl_fassungen: [F1, F2] });
  assert.equal(f.wert('s1|0|0|1', 'name'), 'Neu');
  f.verwerfen('f2');
  assert.equal(f.wert('s1|0|0|1', 'name'), 'Alt', 'die vorige Fassung gilt wieder');
  assert.equal(f.wert('s1|0|0|2', 'mengeVal'), undefined, 'was nur in f2 stand, ist weg');
});

test('nach dem Verwerfen der letzten Fassung gilt wieder die Quelldatei', () => {
  const { f } = umgebung({ hkl_fassungen: [F2] });
  f.verwerfen('f2');
  assert.equal(f.fuer('s1'), null);
  assert.equal(f.wert('s1|0|0|1', 'name'), undefined);
});

test('eine verworfene Fassung bleibt im Journal lesbar', () => {
  const { f } = umgebung({ hkl_fassungen: [F1, F2] });
  f.verwerfen('f2');
  assert.equal(f.roh().length, 2, 'nichts wird gelöscht — Nachvollziehbarkeit');
  assert.equal(!!f.roh().find(x => x.id === 'f2').verworfen, true);
  assert.equal(f.alle('s1').length, 2, 'die Historie zeigt beide');
});

test('eine unbekannte Fassung zu verwerfen tut nichts', () => {
  const { f } = umgebung({ hkl_fassungen: [F2] });
  assert.equal(f.verwerfen('gibtsnicht'), false);
  assert.equal(f.fuer('s1').id, 'f2');
});

/* ═══ Was eingefroren wird ═══ */

test('die Fassung deckt die inhaltlichen Felder ab, nicht die Ansicht', () => {
  const { f } = umgebung();
  ['name', 'mengeVal', 'groessen', 'spez', 'natur', 'uk', 'hidden', 'stil', 'bereich', 'bilder']
    .forEach(p => assert.equal(f.felder.indexOf(p) >= 0, true, p + ' fehlt'));
  /* Häkchen und Ansichtseinstellungen sind kein Inhalt des Standards. */
  ['checks', 'collapsed', 'settings'].forEach(p =>
    assert.equal(f.felder.indexOf(p), -1, p + ' gehört nicht in eine Fassung'));
});

test('mehrere Standards überlagern sich nicht', () => {
  const { f } = umgebung({ hkl_fassungen: [F2, F3] });
  assert.equal(f.wert('s1|0|0|1', 'name'), 'Neu');
  assert.equal(f.wert('s2|0|0|0', 'name'), 'Zweiter');
});
