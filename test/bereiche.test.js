'use strict';
/* Tests für die zweite Sicht aufs Material (public/js/features/bereiche.js)
   und für das Häkchen, das der Betreiber sich gewünscht hat:

   „es soll eine zweite Ansicht vorhanden sein, die das Material nach der
   Kategorie „Material für den sterilen Tisch" und „weiteres Material" ordnet
   dazu soll nur eine kleine Checkbox beim Material vorhanden sein … wichtig
   das kann von Standard zu Standard und von Material zu Material variieren
   daher eine Einstellung die spezifisch ist."

   Daran hängen drei Zusagen, die hier geprüft werden:

   ① Das Häkchen hängt an GENAU EINEM Bereich — sonst wäre es keine
      Checkbox mehr, sondern wieder eine Liste.
   ② Es schreibt nur die eine Stelle. Eine Sammel-Reichweite wäre bequem und
      falsch: Dasselbe Material gehört im einen Standard auf den Tisch und im
      anderen nicht.
   ③ Wo das Häkchen steht, steht der Chip NICHT nochmal — doppelte Anzeige
      derselben Angabe kostet in jeder Zeile Platz.
*/

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'public/js/features/bereiche.js'), 'utf8');

/* Der Bereich einer Zeile kommt aus der Kaskade (qeGet). Für den Test wird sie
   durch eine schlichte Tabelle je Kennung ersetzt — geprüft wird bereiche.js,
   nicht die Kaskade. */
function umgebung(vorgabe, admin) {
  const store = Object.assign({}, vorgabe || {});
  const werte = {};
  const ctx = vm.createContext({
    console,
    loadJSON: (k, d) => (k in store) ? JSON.parse(JSON.stringify(store[k])) : d,
    saveJSON: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
    esc: (s) => String(s == null ? '' : s),
    qeGet: (e, cid, feld) => (feld === 'bereich') ? werte[cid] : undefined,
    qeSet: (scope, e, cid, feld, wert) => { werte[cid] = wert; },
    ADMIN: admin !== false,
    DB: { standards: [] },
    werte,
    __store: store,
  });
  vm.runInContext(SRC, ctx);
  return ctx;
}

const E = { anzeige_text: 'Schleusenset 6F' };

/* ═══ ① Ein Bereich trägt das Häkchen ═══ */

test('der erste angelegte Bereich bekommt das Häkchen', () => {
  const c = umgebung();
  const b = c.berAnlegen('Material für den sterilen Tisch');
  assert.equal(b.haken, true);
  assert.equal(c.berHakenBereich().key, b.key);
});

test('der zweite bekommt es nicht — sonst wären es zwei Häkchen', () => {
  const c = umgebung();
  c.berAnlegen('steriler Tisch');
  const b2 = c.berAnlegen('Umfeld');
  assert.equal(b2.haken, false);
  assert.equal(c.berHakenBereich().wort, 'steriler Tisch');
});

test('umhängen nimmt es dem alten weg', () => {
  const c = umgebung();
  const b1 = c.berAnlegen('steriler Tisch');
  const b2 = c.berAnlegen('Umfeld');
  c.berHakenSetzen(b2.key);
  assert.equal(c.berHakenBereich().key, b2.key);
  assert.equal(c.berOf(b1.key).haken, false);
});

test('ohne Bereich gibt es kein Häkchen — und keinen leeren Kasten', () => {
  const c = umgebung();
  assert.equal(c.berHakenBereich(), null);
  assert.equal(c.berHakenHTML(E, 's1|0|0|0', true), '');
});

/* ═══ ② Die Zeile ═══ */

test('das Häkchen steht nur an beschaffbarem Material', () => {
  const c = umgebung();
  c.berAnlegen('steriler Tisch');
  assert.equal(c.berHakenHTML(E, 's1|0|0|0', false), '', 'ein Handgriff kommt nicht auf den Tisch');
  assert.ok(c.berHakenHTML(E, 's1|0|0|0', true).indexOf('ber-haken') >= 0);
});

test('… und nur im Verwaltungsmodus', () => {
  const c = umgebung(null, false);
  c.berAnlegen('steriler Tisch');
  assert.equal(c.berHakenHTML(E, 's1|0|0|0', true), '');
});

test('es trägt die Kennung, an der Tipp und Langdruck hängen (A7)', () => {
  const c = umgebung();
  c.berAnlegen('steriler Tisch');
  const h = c.berHakenHTML(E, 's1|0|0|7', true);
  assert.match(h, /data-cid="s1\|0\|0\|7"/);
  assert.match(h, /onclick="berHakenTippen\(/);
  assert.match(h, /role="checkbox"/);
  assert.match(h, /aria-checked="false"/);
});

test('gesetzt sieht man es an Klasse und aria-checked', () => {
  const c = umgebung();
  const b = c.berAnlegen('steriler Tisch');
  c.werte['s1|0|0|0'] = b.key;
  const h = c.berHakenHTML(E, 's1|0|0|0', true);
  assert.match(h, /ber-haken on/);
  assert.match(h, /aria-checked="true"/);
  assert.equal(c.berHatHaken(E, 's1|0|0|0'), true);
});

/* ═══ ③ Keine doppelte Anzeige ═══ */

test('wo das Häkchen steht, steht der Chip nicht nochmal', () => {
  const c = umgebung();
  const b = c.berAnlegen('steriler Tisch');
  c.werte['s1|0|0|0'] = b.key;
  assert.equal(c.berBadgeHTML(E, 's1|0|0|0'), '', 'im Verwaltungsmodus zeigt das Häkchen es schon');
});

test('… im Saal (ohne Verwaltung) steht er sehr wohl da', () => {
  const c = umgebung(null, false);
  const b = c.berAnlegen('steriler Tisch');
  c.werte['s1|0|0|0'] = b.key;
  assert.match(c.berBadgeHTML(E, 's1|0|0|0'), /steriler Tisch/);
});

test('ein ANDERER Bereich bleibt als Chip sichtbar', () => {
  const c = umgebung();
  c.berAnlegen('steriler Tisch');
  const b2 = c.berAnlegen('Umfeld');
  c.werte['s1|0|0|0'] = b2.key;
  assert.match(c.berBadgeHTML(E, 's1|0|0|0'), /Umfeld/);
});

/* ═══ Der Speicher hält ═══ */

test('das Häkchen überlebt einen Neustart', () => {
  const c = umgebung();
  c.berAnlegen('steriler Tisch');
  const b2 = c.berAnlegen('Umfeld');
  c.berHakenSetzen(b2.key);
  const c2 = umgebung({ hkl_bereiche: c.__store.hkl_bereiche });
  assert.equal(c2.berHakenBereich().wort, 'Umfeld');
});

test('ein gelöschter Bereich lässt keine halbe Zuordnung zurück', () => {
  const c = umgebung();
  const b = c.berAnlegen('steriler Tisch');
  c.werte['s1|0|0|0'] = b.key;
  c.berLoeschen(b.key);
  /* Die Vergabe bleibt bewusst stehen (versehentlich gelöscht ⇒ wieder da),
     zeigt aber ins Leere und gilt als „ohne Angabe". */
  assert.equal(c.berVon(E, 's1|0|0|0'), null);
  assert.equal(c.berBadgeHTML(E, 's1|0|0|0'), '');
  assert.equal(c.berHatHaken(E, 's1|0|0|0'), false);
});
