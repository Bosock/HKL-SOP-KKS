'use strict';
/* Tests für „Reihenfolge ziehen" (public/js/features/sortieren.js).

   Der Kern ist eine reine Umordnung — und genau die ist die gefährliche
   Stelle: Ein Ab-um-eins-Fehler beim Einsetzen verschiebt eine Zeile um zwei
   Plätze oder gar nicht, und weil beides „irgendwie sortiert" aussieht,
   fällt es beim Hinsehen nicht auf. Deshalb wird hier jede Kante geprüft:
   erstes Element hoch, letztes runter, Ziel außerhalb der Liste, unbekannte
   Kennung, leere Liste.

   Zweite Zusage: Es darf nichts verlorengehen. Nach jeder Umordnung muss
   dieselbe Menge an Kennungen dastehen wie vorher — nicht eine weniger.
*/

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'public/js/features/sortieren.js'), 'utf8');

function umgebung() {
  const ENTORD = {};
  const gespeichert = { n: 0 };
  const ctx = vm.createContext({
    console,
    esc: (s) => String(s == null ? '' : s),
    $: () => null,
    ENTORD,
    saveENTORD: () => { gespeichert.n++; },
    toast: () => {},
    document: { querySelectorAll: () => [], elementFromPoint: () => null },
    window: { innerHeight: 800 },
    navigator: {},
  });
  vm.runInContext(SRC + `
    ;globalThis.__s = {
      verschieben: sortVerschieben, rang: sortRang,
      schreiben: sortSchreiben, aktiv: sortAktiv, aktivFuer: sortAktivFuer,
      setzeRi: (v)=>{ sortRi = v; }, holRi: ()=>sortRi,
    };
  `, ctx);
  return { s: ctx.__s, ENTORD, gespeichert };
}

const L = () => ['a', 'b', 'c', 'd', 'e'];
const txt = (arr) => arr.join('');

/* ═══ Die reine Umordnung ═══ */

test('ein Element nach vorn: alles dazwischen rutscht eine Position nach hinten', () => {
  const { s } = umgebung();
  assert.equal(txt(s.verschieben(L(), 3, 1)), 'adbce');
});

test('ein Element nach hinten: alles dazwischen rutscht nach vorn', () => {
  const { s } = umgebung();
  assert.equal(txt(s.verschieben(L(), 1, 3)), 'acdbe');
});

test('ein Schritt hoch tauscht mit dem Nachbarn — nicht mehr', () => {
  const { s } = umgebung();
  assert.equal(txt(s.verschieben(L(), 2, 1)), 'acbde');
});

test('ein Ziel jenseits der Liste landet am Rand, statt zu scheitern', () => {
  const { s } = umgebung();
  assert.equal(txt(s.verschieben(L(), 0, 99)), 'bcdea', 'über das Ende hinaus heißt „ganz nach unten"');
  assert.equal(txt(s.verschieben(L(), 4, -7)), 'eabcd', 'und darunter „ganz nach oben"');
});

test('dieselbe Position lässt die Liste unverändert', () => {
  const { s } = umgebung();
  assert.equal(txt(s.verschieben(L(), 2, 2)), 'abcde');
});

test('eine ungültige Quelle ändert nichts und wirft nicht', () => {
  const { s } = umgebung();
  assert.equal(txt(s.verschieben(L(), -1, 0)), 'abcde');
  assert.equal(txt(s.verschieben(L(), 9, 0)), 'abcde');
  assert.equal(txt(s.verschieben([], 0, 1)), '');
});

test('die Ausgangsliste wird nie verändert — es kommt immer eine neue zurück', () => {
  const { s } = umgebung();
  const original = L();
  s.verschieben(original, 0, 4);
  assert.equal(txt(original), 'abcde', 'sonst hinge ein halb umgeordneter Stand in der Ansicht');
});

test('nach jeder Umordnung steht dieselbe Menge da — nichts geht verloren', () => {
  const { s } = umgebung();
  for (let von = 0; von < 5; von++) {
    for (let nach = -2; nach < 8; nach++) {
      const erg = s.verschieben(L(), von, nach);
      assert.equal(erg.length, 5, `von ${von} nach ${nach}`);
      assert.equal([...new Set(erg)].length, 5, 'und keine Kennung doppelt');
    }
  }
});

/* ═══ Über die Kennung, in Worten ═══ */

test('hoch · runter · anfang · ende tun, was sie heißen', () => {
  const { s } = umgebung();
  assert.equal(txt(s.rang(L(), 'c', 'hoch')), 'acbde');
  assert.equal(txt(s.rang(L(), 'c', 'runter')), 'abdce');
  assert.equal(txt(s.rang(L(), 'd', 'anfang')), 'dabce');
  assert.equal(txt(s.rang(L(), 'b', 'ende')), 'acdeb');
});

test('am Rand passiert nichts Unerwartetes', () => {
  const { s } = umgebung();
  assert.equal(txt(s.rang(L(), 'a', 'hoch')), 'abcde', 'das erste kann nicht höher');
  assert.equal(txt(s.rang(L(), 'e', 'runter')), 'abcde', 'das letzte nicht tiefer');
  assert.equal(txt(s.rang(L(), 'a', 'anfang')), 'abcde');
  assert.equal(txt(s.rang(L(), 'e', 'ende')), 'abcde');
});

test('eine unbekannte Kennung lässt die Liste in Ruhe', () => {
  const { s } = umgebung();
  assert.equal(txt(s.rang(L(), 'gibtsnicht', 'hoch')), 'abcde');
});

test('eine unbekannte Richtung ändert nichts, statt zu raten', () => {
  const { s } = umgebung();
  assert.equal(txt(s.rang(L(), 'c', 'seitwaerts')), 'abcde');
});

/* ═══ Festschreiben ═══ */

test('die Reihenfolge wird je Abschnitt gespeichert', () => {
  const { s, ENTORD, gespeichert } = umgebung();
  assert.equal(s.schreiben('std|0|uk', ['b', 'a']), true);
  assert.equal(JSON.stringify(ENTORD['std|0|uk']), JSON.stringify(['b', 'a']));
  assert.equal(gespeichert.n, 1);
});

test('ohne Abschnitt oder ohne Liste wird nichts geschrieben', () => {
  const { s, ENTORD, gespeichert } = umgebung();
  assert.equal(s.schreiben('', ['a']), false);
  assert.equal(s.schreiben('k', []), false);
  assert.equal(s.schreiben('k', null), false);
  assert.equal(Object.keys(ENTORD).length, 0);
  assert.equal(gespeichert.n, 0, 'kein leerer Speichervorgang');
});

test('die gespeicherte Liste ist eine Kopie — spätere Änderungen wirken nicht zurück', () => {
  const { s, ENTORD } = umgebung();
  const liste = ['a', 'b'];
  s.schreiben('k', liste);
  liste.push('c');
  assert.equal(ENTORD['k'].length, 2);
});

/* ═══ Der Modus ═══ */

test('ausgeliefert ist der Sortiermodus aus', () => {
  const { s } = umgebung();
  assert.equal(s.aktiv(), false);
  assert.equal(s.aktivFuer(0), false);
});

test('der Modus gilt für GENAU eine Rubrik', () => {
  const { s } = umgebung();
  s.setzeRi(2);
  assert.equal(s.aktiv(), true);
  assert.equal(s.aktivFuer(2), true);
  assert.equal(s.aktivFuer(0), false, 'sonst stünde jede Rubrik im Sortiermodus');
});

test('Rubrik 0 ist eine echte Rubrik, nicht „aus"', () => {
  const { s } = umgebung();
  s.setzeRi(0);
  assert.equal(s.aktiv(), true, 'die 0 darf nicht als „nichts" durchgehen');
  assert.equal(s.aktivFuer(0), true);
});
