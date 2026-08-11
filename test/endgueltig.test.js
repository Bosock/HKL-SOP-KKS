'use strict';
/* Tests für „Endgültig entfernen".

   Der Betreiber wollte das Sichern beim Löschen loswerden: „das löschen mit
   Back Up muss weg das macht alles komplett umständlich!" Umgesetzt ist die
   zweite von ihm angebotene Fassung — ein Knopf direkt unter „Ausblenden",
   der genau EINE Zeile trifft.

   Geprüft wird deshalb vor allem, dass dieser Knopf hält, was sein Wort
   verspricht, und dass er nicht mehr trifft, als er soll:

   ① Wer nichts entfernt, hat eine leere Liste — und keine Nebenwirkung.
   ② Entfernen wirkt genau auf die eine Kennung, nicht auf ihre Nachbarn.
   ③ Zweimal entfernen legt keinen zweiten Eintrag an (sonst zählte die
      Verwaltung falsch).
   ④ Der eine Weg zurück funktioniert wirklich — und nur für das, was
      tatsächlich entfernt wurde.
   ⑤ Der Stand überlebt einen Neustart, denn er liegt im Speicher und nicht
      im Arbeitsgedächtnis.
*/

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const QUELLE = fs.readFileSync(path.join(ROOT, 'public/js/features/endgueltig.js'), 'utf8');

function umgebung(vorgabe) {
  const store = Object.assign({}, vorgabe || {});
  const ctx = vm.createContext({
    console,
    loadJSON: (k, d) => (k in store) ? JSON.parse(JSON.stringify(store[k])) : d,
    saveJSON: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
    esc: (s) => String(s == null ? '' : s),
    store,
  });
  vm.runInContext(QUELLE, ctx);
  return ctx;
}

test('① ohne Zutun ist nichts entfernt', () => {
  const c = umgebung();
  assert.equal(c.hartAnzahl(), 0);
  assert.equal(c.hartWeg('sop1|0|0|3'), false);
});

test('① ein kaputter Speicherstand wirft die App nicht um', () => {
  const c = umgebung({ hkl_hartweg: { kein: 'array' } });
  assert.equal(c.hartAnzahl(), 0);
  assert.equal(c.hartLoeschen('sop1|0|0|3'), true);
  assert.equal(c.hartAnzahl(), 1);
});

test('② entfernt wird genau die eine Kennung', () => {
  const c = umgebung();
  c.hartLoeschen('sop1|0|0|3');
  assert.equal(c.hartWeg('sop1|0|0|3'), true);
  /* Die Nachbarn in derselben Rubrik bleiben unberührt — die Kennung ist eine
     Position, und ein Löschen, das „ungefähr" trifft, wäre unbrauchbar. */
  assert.equal(c.hartWeg('sop1|0|0|2'), false);
  assert.equal(c.hartWeg('sop1|0|0|4'), false);
  assert.equal(c.hartWeg('sop1|0|1|3'), false);
  assert.equal(c.hartWeg('sop2|0|0|3'), false);
});

test('② eine leere Kennung tut nichts', () => {
  const c = umgebung();
  assert.equal(c.hartLoeschen(''), false);
  assert.equal(c.hartLoeschen(null), false);
  assert.equal(c.hartLoeschen(undefined), false);
  assert.equal(c.hartAnzahl(), 0);
});

test('③ zweimal entfernen bleibt ein Eintrag', () => {
  const c = umgebung();
  c.hartLoeschen('sop1|0|0|3');
  c.hartLoeschen('sop1|0|0|3');
  assert.equal(c.hartAnzahl(), 1);
});

test('④ der eine Weg zurück wirkt', () => {
  const c = umgebung();
  c.hartLoeschen('sop1|0|0|3');
  c.hartLoeschen('sop1|0|0|9');
  assert.equal(c.hartZurueckholen('sop1|0|0|3'), true);
  assert.equal(c.hartWeg('sop1|0|0|3'), false);
  assert.equal(c.hartWeg('sop1|0|0|9'), true, 'die andere bleibt entfernt');
  assert.equal(c.hartAnzahl(), 1);
});

test('④ zurückholen, was nie entfernt wurde, meldet ehrlich „nein"', () => {
  const c = umgebung();
  assert.equal(c.hartZurueckholen('sop1|0|0|3'), false);
  c.hartLoeschen('sop1|0|0|3');
  c.hartZurueckholen('sop1|0|0|3');
  assert.equal(c.hartZurueckholen('sop1|0|0|3'), false, 'zweimal zurückholen ist kein Fehler');
});

test('⑤ der Stand überlebt einen Neustart', () => {
  const c = umgebung();
  c.hartLoeschen('sop1|0|0|3');
  c.hartLoeschen('neu|abc123');
  const gespeichert = c.store.hkl_hartweg;
  assert.deepEqual(JSON.parse(JSON.stringify(gespeichert)), ['sop1|0|0|3', 'neu|abc123']);

  const c2 = umgebung({ hkl_hartweg: gespeichert });
  assert.equal(c2.hartWeg('sop1|0|0|3'), true);
  assert.equal(c2.hartWeg('neu|abc123'), true, 'auch selbst angelegte Zeilen');
  assert.equal(c2.hartAnzahl(), 2);
});

test('⑤ zurückholen wird ebenfalls gespeichert', () => {
  const c = umgebung();
  c.hartLoeschen('sop1|0|0|3');
  c.hartZurueckholen('sop1|0|0|3');
  assert.deepEqual(JSON.parse(JSON.stringify(c.store.hkl_hartweg)), []);
});

test('die Rückfrage verspricht nichts, was sie nicht hält', () => {
  /* „Endgültig" heißt hier: ausgeblendet UND aus der Wiederherstellungsliste.
     Die Quelldatei wird nie beschrieben (Grundsatz ⑦). Steht das nicht im
     Text der Karte, führt der Knopf in die Irre. */
  const karte = QUELLE.slice(QUELLE.indexOf('function hartUiLoeschen'),
    QUELLE.indexOf('function hartPanelHTML'));
  assert.match(karte, /Ausgeblendete Einträge/);
  assert.match(karte, /Quelldatei bleibt unangetastet/);
  assert.match(karte, /Endgültig entfernte Zeilen/, 'der eine Weg zurück wird genannt');
});
