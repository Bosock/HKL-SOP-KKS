'use strict';
/* Tests für das Bilder-Register (features/bildorte.js).

   Der Betreiber: „ich möchte das Icon und auch die Bilder allgemein möchte ich
   anschalten oder ausschalten können."

   Zwei Schalter, die man nicht verwechseln darf:
     · „Bilder aus"  → an dieser Art von Stelle werden keine Bilder gezeigt.
     · „Symbol aus"  → nur der Weg zum Hinzufügen fällt weg; vorhandene
                       Bilder bleiben sichtbar.

   Und eine Zusage, die über allem steht: Ein Schalter LÖSCHT NICHTS. Was
   ausgeschaltet wird, ist sofort wieder da, wenn man ihn zurücklegt
   (Grundsatz ②). Genau das prüft die letzte Gruppe.
*/

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const lies = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function reg(vorgabe, admin) {
  const store = Object.assign({}, vorgabe || {});
  const ctx = vm.createContext({
    console,
    loadJSON: (k, d) => (k in store) ? JSON.parse(JSON.stringify(store[k])) : d,
    saveJSON: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
    esc: (s) => String(s == null ? '' : s),
    toast: () => {}, $: () => null,
    ADMIN: admin === undefined ? true : admin,
    MEDANK: {}, DB: { standards: [] }, cidOf: (a, b, c, d) => [a, b, c, d].join('|'),
    medPaare: (v) => Array.isArray(v) ? v : [],
    medPaareVonEintrag: (e) => (e && e.bilder) || [],
  });
  vm.runInContext(lies('public/js/features/bildorte.js'), ctx);
  vm.runInContext(`globalThis.__b = { arten:()=>BILD_ORTE, art:bildOrtArt, vonOrt:bildArtVonOrt,
    orte:bildOrte, nach:bildOrtNach, setzen:bildOrtSetzen, schalten:bildOrtSchalten,
    knopfSchalten:bildKnopfSchalten, allesAn:bildAllesAn, allesSchalten:bildAllesSchalten,
    zeigen:bildZeigen, knopf:bildKnopfZeigen, wort:bildOrtWort, ico:bildOrtIco,
    zuruecksetzen:bildOrteZuruecksetzen, geaendert:bildOrteGeaendert,
    bestand:bildOrtBestand, panel:bildortePanelHTML,
    setAdmin:(v)=>{ ADMIN=v; }, setAnker:(v)=>{ MEDANK=v; }, setDB:(v)=>{ DB=v; } };`, ctx);
  return { b: ctx.__b, store, ctx };
}

/* ═══════════ Ausgeliefert ist alles an ═══════════ */

test('ausgeliefert sind Bilder überall an — und nichts ist gespeichert', () => {
  const { b, store } = reg();
  assert.equal(b.allesAn(), true);
  b.orte().forEach(o => {
    assert.equal(o.aus, false, o.key + ' ist an');
    assert.equal(o.ohneKnopf, false, o.key + ' zeigt sein Symbol');
  });
  assert.equal(store.hkl_bildorte, undefined, 'ohne Eingriff wird nichts geschrieben');
  assert.equal(b.geaendert(), false);
});

test('der Code kennt sechs Stellen-Arten, jede mit Wort, Symbol und Erklärung', () => {
  const { b } = reg();
  assert.equal(b.arten().length, 6);
  b.orte().forEach(o => {
    assert.ok(o.wort && o.wort.length > 3, o.key + ' hat ein Wort');
    assert.ok(o.ico && o.ico.length > 0, o.key + ' hat ein Symbol');
    assert.ok(o.sub && o.sub.length > 10, o.key + ' erklärt sich');
  });
});

/* ═══════════ Von der Stelle auf ihre Art ═══════════ */

test('jeder Anker findet seine Art — und alles andere ist eine Zeile', () => {
  const { b } = reg();
  assert.equal(b.vonOrt('std:S1'), 'standardkopf');
  assert.equal(b.vonOrt('rub:S1|2'), 'rubrik');
  assert.equal(b.vonOrt('uk:S1|2|Schleusen'), 'unterkategorie');
  assert.equal(b.vonOrt('seg:S1|2|Vorbereitung'), 'abschnitt');
  assert.equal(b.vonOrt('akt:k123'), 'aushang');
  assert.equal(b.vonOrt('S1|0|1|4'), 'eintrag', 'eine cid ist eine Zeile');
  assert.equal(b.vonOrt('new|abc'), 'eintrag');
  assert.equal(b.vonOrt(''), 'eintrag', 'auch ohne Stelle wird gezeigt, nicht verschluckt');
});

/* ═══════════ Die zwei Schalter ═══════════ */

test('„Bilder aus" wirkt genau an DIESER Art — nicht an den anderen', () => {
  const { b } = reg();
  b.schalten('eintrag');
  assert.equal(b.zeigen('S1|0|1|4'), false, 'an der Zeile aus');
  assert.equal(b.zeigen('rub:S1|2'), true, 'an der Rubrik weiter an');
  assert.equal(b.zeigen('std:S1'), true);
  b.schalten('eintrag');
  assert.equal(b.zeigen('S1|0|1|4'), true, 'und wieder an');
});

test('„Symbol aus" nimmt den Weg zum Hinzufügen — die Bilder bleiben sichtbar', () => {
  const { b } = reg();
  b.knopfSchalten('rubrik');
  assert.equal(b.zeigen('rub:S1|2'), true, 'DAS ist der Unterschied: Bilder bleiben');
  assert.equal(b.knopf('rub:S1|2'), false, 'nur der Knopf ist weg');
  assert.equal(b.knopf('uk:S1|2|X'), true, 'andere Arten unberührt');
});

test('ist eine Stelle aus, verschwindet auch ihr Knopf — sonst legte man Unsichtbares an', () => {
  const { b } = reg();
  b.schalten('abschnitt');
  assert.equal(b.zeigen('seg:S1|2|V'), false);
  assert.equal(b.knopf('seg:S1|2|V'), false);
});

test('ohne Anmeldung gibt es nie einen Knopf', () => {
  const { b } = reg(null, false);
  assert.equal(b.zeigen('rub:S1|2'), true, 'sehen darf jeder');
  assert.equal(b.knopf('rub:S1|2'), false, 'ändern nicht');
});

test('der große Schalter nimmt alle Bilder auf einmal aus der Anzeige', () => {
  const { b } = reg();
  b.allesSchalten(false);
  assert.equal(b.allesAn(), false);
  ['S1|0|1|4', 'rub:S1|2', 'std:S1', 'akt:k1'].forEach(o => {
    assert.equal(b.zeigen(o), false, o);
    assert.equal(b.knopf(o), false, o + ' auch kein Knopf');
  });
  b.allesSchalten(true);
  assert.equal(b.zeigen('rub:S1|2'), true, 'und alles kommt zurück');
});

test('der große Schalter überstimmt die einzelnen, hebt sie aber nicht auf', () => {
  const { b } = reg();
  b.schalten('eintrag');                 /* Zeile aus */
  b.allesSchalten(false);                /* alles aus */
  b.allesSchalten(true);                 /* alles wieder an */
  assert.equal(b.zeigen('rub:S1|2'), true, 'die Rubrik ist wieder da');
  assert.equal(b.zeigen('S1|0|1|4'), false, 'die einzelne Einstellung gilt weiter');
});

/* ═══════════ Wörter und Symbole gehören dem Haus ═══════════ */

test('Wort und Symbol lassen sich ändern und über den leeren Wert zurücksetzen', () => {
  const { b } = reg();
  b.setzen('rubrik', 'wort', 'Fotos der Rubrik');
  b.setzen('rubrik', 'ico', '📸');
  assert.equal(b.wort('rub:S1|2'), 'Fotos der Rubrik');
  assert.equal(b.ico('rub:S1|2'), '📸');
  b.setzen('rubrik', 'wort', '');
  b.setzen('rubrik', 'ico', '');
  assert.equal(b.wort('rub:S1|2'), 'An einer Rubrik', 'zurück auf die Auslieferung');
  assert.equal(b.ico('rub:S1|2'), '🖼');
});

test('eine unbekannte Art lässt sich nicht einstellen', () => {
  const { b } = reg();
  assert.equal(b.setzen('gibtsnicht', 'wort', 'X'), false);
  assert.equal(b.schalten('gibtsnicht'), false);
});

/* ═══════════ Nichts wird gelöscht ═══════════ */

test('DER KERN: ausschalten löscht nichts — die Bilder sind sofort wieder da', () => {
  const { b, ctx } = reg();
  b.setAnker({ 'rub:S1|2': [{ k: 'a'.repeat(32), g: 'klein' }, { k: 'b'.repeat(32), g: 'gross' }] });
  assert.equal(b.bestand('rubrik'), 2);
  b.schalten('rubrik');
  assert.equal(b.zeigen('rub:S1|2'), false, 'unsichtbar …');
  assert.equal(b.bestand('rubrik'), 2, '… aber noch da');
  assert.equal(ctx.MEDANK['rub:S1|2'].length, 2, 'der Speicher ist unangetastet');
  b.schalten('rubrik');
  assert.equal(b.zeigen('rub:S1|2'), true);
  assert.equal(b.bestand('rubrik'), 2);
});

test('die Verwaltung zählt, was an einer ausgeschalteten Stelle liegt', () => {
  const { b } = reg();
  b.setAnker({ 'std:S1': [{ k: 'c'.repeat(32), g: 'klein' }] , 'akt:k9': [{ k: 'd'.repeat(32), g: 'klein' }] });
  assert.equal(b.bestand('standardkopf'), 1);
  assert.equal(b.bestand('aushang'), 1);
  assert.equal(b.bestand('rubrik'), 0);
  const h = b.panel();
  assert.match(h, /1 Bild hier/, 'die Zahl steht in der Verwaltung');
  assert.match(h, /nichts gelöscht/, 'und die Zusage steht dabei');
});

/* Bilder an ZEILEN hängen nicht an einem Anker, sondern am Eintrag. Sie werden
   deshalb über den Bestand gezählt — die Prüfung hier hält fest, dass dieser
   Weg wirklich gegangen wird und nicht stumm null liefert. */
test('auch Bilder an Zeilen werden gezählt — über den Bestand, nicht über die Anker', () => {
  const { b } = reg();
  b.setDB({ standards: [{ id: 'S1', rubriken: [{ sub_bereiche: [{ eintraege: [
    { bilder: [{ k: 'e'.repeat(32), g: 'klein' }] },
    { bilder: [{ k: 'f'.repeat(32), g: 'klein' }, { k: 'g'.repeat(32), g: 'gross' }] },
    { },
  ] }] }] }] });
  assert.equal(b.bestand('eintrag'), 3);
  assert.equal(b.bestand('rubrik'), 0, 'die Anker bleiben davon unberührt');
});

test('Zurücksetzen bringt die Auslieferung wieder', () => {
  const { b, store } = reg();
  b.schalten('eintrag');
  b.knopfSchalten('rubrik');
  b.allesSchalten(false);
  assert.equal(b.geaendert(), true);
  b.zuruecksetzen();
  assert.equal(b.geaendert(), false);
  assert.equal(b.allesAn(), true);
  b.orte().forEach(o => { assert.equal(o.aus, false); assert.equal(o.ohneKnopf, false); });
  assert.deepEqual(store.hkl_bildorte, {});
});

test('eine Einstellung, die auf die Vorgabe zurückfällt, hinterlässt keinen Rest', () => {
  const { b, store } = reg();
  b.schalten('eintrag');
  b.schalten('eintrag');
  assert.deepEqual(store.hkl_bildorte, {}, 'kein leerer Eintrag bleibt liegen');
  assert.equal(b.geaendert(), false);
});
