'use strict';
/* Tests für das Regelwerk (public/js/features/rules.js) — und besonders für
   das zweite Ziel, das dazugekommen ist.

   Der Befund des Betreibers: „die Reichweiten Einstellung bei Änderungen bevor
   gespeichert wird können nicht angepasst werden!"

   Die Ursache lag tiefer als in der Oberfläche: Eine Regel konnte sich nur auf
   ein MATERIAL beziehen. Zeilen ohne `material_key` — Handgriffe, Hinweise,
   „Checkliste ausfüllen" — hatten deshalb kein Ziel, und der Knopf im
   Prüfblatt war für sie dauerhaft ausgegraut. Jetzt gibt es ein zweites Ziel:
   den TEXT der Zeile.

   Geprüft wird genau das, was dabei schiefgehen könnte:

   ① Für Zeilen MIT Material ändert sich nichts. Alte Journale lösen exakt wie
      vorher auf — sonst hätte dieser Umbau still Daten uminterpretiert.
   ② Die beiden Schlüsselräume vermischen sich nicht. Eine Textregel darf nie
      ein Produkt treffen, dessen Name zufällig gleich lautet.
   ③ Die Trefferzahl sagt die Wahrheit. Sie steht im Prüfblatt VOR dem
      Speichern — eine Zahl, die danach nicht stimmt, ist schlimmer als keine.
   ④ Die Kaskade gilt unverändert: 📍 Stelle schlägt 📄 Standard schlägt
      🗂 Gruppe schlägt 🌐 überall, bei Gleichstand die neuere Regel.
   ⑤ Zurücknehmen funktioniert auch für das neue Ziel.
*/

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'public/js/features/rules.js'), 'utf8');

/* Ein kleiner, überschaubarer Bestand: zwei Standards in zwei Gruppen.
   „Raumkontrolle" steht dreimal und trägt NIE ein Material — genau der Fall,
   um den es geht. Das Schleusenset trägt einen Materialschlüssel. */
const STANDARDS = [
  { id: 's1', gruppe: 'HKL', rubriken: [{ sub_bereiche: [{ eintraege: [
    { anzeige_text: 'Raumkontrolle', natur: 'handgriff' },
    { anzeige_text: 'Schleusenset 6F', natur: 'material', material_key: 'schleusenset-6f' },
    { anzeige_text: 'Raumkontrolle', natur: 'handgriff' },
  ] }] }] },
  { id: 's2', gruppe: 'EPU', rubriken: [{ sub_bereiche: [{ eintraege: [
    { anzeige_text: 'Raumkontrolle', natur: 'handgriff' },
    { anzeige_text: 'Schleusenset 6F', natur: 'material', material_key: 'schleusenset-6f' },
    { anzeige_text: 'Zwischenüberschrift', natur: 'ueberschrift' },
  ] }] }] },
];

function umgebung() {
  const store = {};
  const ctx = vm.createContext({
    console,
    loadJSON: (k, d) => (k in store) ? JSON.parse(JSON.stringify(store[k])) : d,
    saveJSON: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
    store: { get: () => 'testgerät', set: () => {} },
    esc: (s) => String(s == null ? '' : s),
    DB: { standards: STANDARDS },
    stdGruppe: (s) => s.gruppe,
    buildMaterialIndex: () => {},
    computeUkList: () => {},
    natOf: (n) => ({ label: n }),
    stdTitel: (s) => s.titel || s.id,
    __store: store,
  });
  vm.runInContext(SRC, ctx);
  vm.runInContext('globalThis.__rules = () => RULES;', ctx);
  return ctx;
}

const HANDGRIFF = STANDARDS[0].rubriken[0].sub_bereiche[0].eintraege[0];
const MATERIAL = STANDARDS[0].rubriken[0].sub_bereiche[0].eintraege[1];
const cid = (s, i) => s + '|0|0|' + i;

/* ═══ Das Ziel einer Regel ═══ */

test('eine Zeile mit Material zielt aufs Material', () => {
  const c = umgebung();
  assert.deepEqual(JSON.parse(JSON.stringify(c.ruleZiel(MATERIAL))),
    { art: 'material', key: 'schleusenset-6f' });
});

test('eine Zeile ohne Material zielt auf ihren Text', () => {
  const c = umgebung();
  const z = c.ruleZiel(HANDGRIFF);
  assert.equal(z.art, 'text');
  assert.match(z.key, /^t:/, 'Textschlüssel tragen ein Präfix');
  assert.match(z.key, /raumkontrolle/);
});

test('gleicher Text ⇒ gleicher Schlüssel, anderer Text ⇒ anderer', () => {
  const c = umgebung();
  const a = c.ruleTextKey({ anzeige_text: 'Raumkontrolle' });
  const b = c.ruleTextKey({ anzeige_text: 'raumkontrolle' });
  const x = c.ruleTextKey({ anzeige_text: 'Rufbereitschaft' });
  assert.equal(a, b, 'Groß- und Kleinschreibung trennen nicht');
  assert.notEqual(a, x);
});

test('eine Zeile ganz ohne Text hat kein Ziel — und bleibt ehrlich bei „nur hier"', () => {
  const c = umgebung();
  assert.equal(c.ruleZiel({ anzeige_text: '' }), null);
  assert.equal(c.ruleZielKey({}), null);
});

/* ═══ ② Die Schlüsselräume vermischen sich nicht ═══ */

test('eine Textregel trifft NIE eine Zeile mit Material', () => {
  const c = umgebung();
  /* Ein Produkt, das genauso heißt wie der Handgriff — der gemeine Fall. */
  const gemein = { anzeige_text: 'Raumkontrolle', natur: 'material', material_key: 'raumkontrolle' };
  assert.equal(c.ruleZiel(gemein).art, 'material');
  const tk = c.ruleTextKey(HANDGRIFF);
  assert.notEqual(tk, 'raumkontrolle', 'das Präfix hält die Räume auseinander');
});

/* ═══ ③ Die Trefferzahl ═══ */

test('die Vorschau zählt Textzeilen richtig', () => {
  const c = umgebung();
  const tk = c.ruleZielKey(HANDGRIFF);
  const alle = c.ruleHits(tk, { art: 'alle' });
  assert.equal(alle.vorkommen, 3, 'dreimal „Raumkontrolle" im Bestand');
  assert.equal(alle.standards.length, 2);

  const nurS1 = c.ruleHits(tk, { art: 'standard', wert: 's1' });
  assert.equal(nurS1.vorkommen, 2);

  const nurEPU = c.ruleHits(tk, { art: 'gruppe', wert: 'EPU' });
  assert.equal(nurEPU.vorkommen, 1);
});

test('… und Materialzeilen weiterhin genauso wie vorher', () => {
  const c = umgebung();
  assert.equal(c.ruleHits('schleusenset-6f', { art: 'alle' }).vorkommen, 2);
  assert.equal(c.ruleHits('schleusenset-6f', { art: 'standard', wert: 's2' }).vorkommen, 1);
});

test('Überschriften und Fließtext zählen nicht mit', () => {
  const c = umgebung();
  const tk = c.ruleTextKey({ anzeige_text: 'Zwischenüberschrift' });
  assert.equal(c.ruleHits(tk, { art: 'alle' }).vorkommen, 0);
});

test('ohne Schlüssel gibt es keine Treffer statt aller Treffer', () => {
  const c = umgebung();
  assert.equal(c.ruleHits(null, { art: 'alle' }).vorkommen, 0);
});

/* ═══ ④ Die Kaskade ═══ */

test('eine Textregel „überall" wirkt an jeder gleichlautenden Zeile', () => {
  const c = umgebung();
  const tk = c.ruleZielKey(HANDGRIFF);
  c.addRule({ art: 'text', key: tk }, { art: 'alle' }, 'name', 'Raum kontrollieren');
  assert.equal(c.ruleResolve(HANDGRIFF, cid('s1', 0), 'name'), 'Raum kontrollieren');
  assert.equal(c.ruleResolve(STANDARDS[1].rubriken[0].sub_bereiche[0].eintraege[0], cid('s2', 0), 'name'),
    'Raum kontrollieren');
});

test('… und die Stelle schlägt das Überall', () => {
  const c = umgebung();
  const tk = c.ruleZielKey(HANDGRIFF);
  c.addRule({ art: 'text', key: tk }, { art: 'alle' }, 'name', 'überall');
  c.addRule({ art: 'text', key: tk }, { art: 'stelle', wert: cid('s1', 0) }, 'name', 'nur hier');
  assert.equal(c.ruleResolve(HANDGRIFF, cid('s1', 0), 'name'), 'nur hier');
  assert.equal(c.ruleResolve(HANDGRIFF, cid('s1', 2), 'name'), 'überall',
    'die Nachbarzeile bleibt bei der weiten Regel');
});

test('… der Standard schlägt die Gruppe', () => {
  const c = umgebung();
  const tk = c.ruleZielKey(HANDGRIFF);
  c.addRule({ art: 'text', key: tk }, { art: 'gruppe', wert: 'HKL' }, 'name', 'Gruppe');
  c.addRule({ art: 'text', key: tk }, { art: 'standard', wert: 's1' }, 'name', 'Standard');
  assert.equal(c.ruleResolve(HANDGRIFF, cid('s1', 0), 'name'), 'Standard');
});

test('eine Materialzeile bleibt von Textregeln unberührt', () => {
  const c = umgebung();
  const tk = c.ruleZielKey(HANDGRIFF);
  c.addRule({ art: 'text', key: tk }, { art: 'alle' }, 'name', 'Raum kontrollieren');
  assert.equal(c.ruleResolve(MATERIAL, cid('s1', 1), 'name'), undefined);
});

test('der Alt-Speicher bleibt der Rand der Kaskade', () => {
  const c = umgebung();
  const tk = c.ruleZielKey(HANDGRIFF);
  /* Ein Alt-Wert an der Stelle gilt — bis eine echte Regel gleicher
     Reichweite dazukommt (Lazy-Migration). */
  assert.equal(c.ruleResolve(HANDGRIFF, cid('s1', 0), 'name', { stelle: 'alt' }), 'alt');
  c.addRule({ art: 'text', key: tk }, { art: 'stelle', wert: cid('s1', 0) }, 'name', 'neu');
  assert.equal(c.ruleResolve(HANDGRIFF, cid('s1', 0), 'name', { stelle: 'alt' }), 'neu');
});

/* ═══ ⑤ Zurücknehmen ═══ */

test('eine Textregel lässt sich zurücknehmen', () => {
  const c = umgebung();
  const tk = c.ruleZielKey(HANDGRIFF);
  c.addRule({ art: 'text', key: tk }, { art: 'alle' }, 'name', 'weg damit');
  const r = c.__rules().find(x => x.op === 'set');
  c.revokeRule(r.id);
  assert.equal(c.ruleResolve(HANDGRIFF, cid('s1', 0), 'name'), undefined);
  assert.ok(c.__rules().length >= 2, 'nichts wird gelöscht — die Rücknahme ist ein eigenes Ereignis');
});

test('„Änderungen zurücksetzen" trifft auch Textregeln an dieser Stelle', () => {
  const c = umgebung();
  const tk = c.ruleZielKey(HANDGRIFF);
  c.addRule({ art: 'text', key: tk }, { art: 'stelle', wert: cid('s1', 0) }, 'name', 'hier');
  c.addRule({ art: 'text', key: tk }, { art: 'alle' }, 'name', 'überall');
  c.revokeStelleRules(tk, cid('s1', 0), 'name');
  assert.equal(c.ruleResolve(HANDGRIFF, cid('s1', 0), 'name'), 'überall',
    'nur die Stelle wird zurückgenommen, die Sammel-Regel bleibt');
});

test('das Journal überlebt einen Neustart samt neuem Ziel', () => {
  const c = umgebung();
  const tk = c.ruleZielKey(HANDGRIFF);
  c.addRule({ art: 'text', key: tk }, { art: 'alle' }, 'name', 'bleibt');
  const c2 = umgebung();
  /* Frische Umgebung, aber dasselbe Journal: der Speicher wird neu gelesen. */
  vm.runInContext('RULES = ' + JSON.stringify(c.__store.hkl_rules) + '; rebuildRulesIndex();', c2);
  assert.equal(c2.ruleResolve(HANDGRIFF, cid('s1', 0), 'name'), 'bleibt');
});
