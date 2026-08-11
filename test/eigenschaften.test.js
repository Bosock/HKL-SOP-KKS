'use strict';
/* Tests für Merkmale an Standards (public/js/features/eigenschaften.js).

   Zwei Dinge dürfen hier niemals passieren:

   ① Ein Merkmal umbenennen darf die VERGABEN nicht verlieren. Genau daran
      sterben Merkmalslisten sonst: Der Schlüssel wird aus dem Wort gebildet,
      jemand korrigiert einen Tippfehler — und alle 47 Zuordnungen sind weg.
   ② Die Zählung muss „ohne Angabe" mitzählen. „12 von 47" wäre eine Lüge,
      solange 32 Standards nie gefragt wurden (Grundsatz ①).
*/

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'public/js/features/eigenschaften.js'), 'utf8');

function umgebung(vorgabe, standards) {
  const store = Object.assign({ hkl_eigenschaften: [], hkl_stdeigen: {} }, vorgabe || {});
  const ctx = vm.createContext({
    console,
    loadJSON: (k, d) => (k in store) ? JSON.parse(JSON.stringify(store[k])) : d,
    saveJSON: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
    esc: (s) => String(s == null ? '' : s),
    stdTitel: (s) => s.titel,
    DB: { standards: standards || [] },
    ADMIN: true,
    window: undefined,
  });
  vm.runInContext(SRC + `
    ;globalThis.__f = {
      slug:eigSlug, anlegen:eigAnlegen, aendern:eigAendern, loeschen:eigLoeschen,
      verschieben:eigVerschieben, liste:eigListe, of:eigOf,
      kopfListe:eigKopfListe, reichweiten:eigReichweiten,
      wert:eigWert, setzen:eigSetzen, standards:eigStandards, hat:eigHat,
      bilanz:eigBilanz, chips:eigChips, kopfHTML:eigKopfHTML, arten:EIG_ARTEN,
      hakenListe:eigHakenListe, hakenZeile:eigHakenZeile, hakenHTML:eigHakenHTML
    };
    ;globalThis.__store = () => ({ eig: EIG, std: EIGSTD });
  `, ctx);
  return { f: ctx.__f, store, holen: ctx.__store };
}

const STDS = [
  { id: 's1', titel: 'Koronarangiografie' },
  { id: 's2', titel: 'MitraClip' },
  { id: 's3', titel: 'Schrittmacher' },
  { id: 's4', titel: 'EPU' },
];

/* ═══ Definition ═══ */

test('ein Merkmal bekommt einen Schlüssel aus dem Wort', () => {
  const { f } = umgebung();
  const e = f.anlegen('sedierungspflichtig', 'ja');
  assert.equal(e.key, 'sedierungspflichtig');
  assert.equal(e.art, 'ja');
  assert.equal(e.alsReichweite, false, 'nicht jedes Merkmal gehört ins Reichweitenmenü');
});

test('Umlaute und Sonderzeichen werden zu einem sauberen Schlüssel', () => {
  const { f } = umgebung();
  assert.equal(f.slug('Größe / Zugang'), 'groesse-zugang');
  assert.equal(f.slug('Rufbereitschaft!'), 'rufbereitschaft');
});

test('zwei gleichnamige Merkmale bekommen verschiedene Schlüssel', () => {
  const { f } = umgebung();
  const a = f.anlegen('Zugang', 'ja');
  const b = f.anlegen('Zugang', 'ja');
  assert.notEqual(a.key, b.key);
});

test('DAS ENTSCHEIDENDE: Umbenennen behält alle Vergaben', () => {
  const { f } = umgebung(null, STDS);
  const e = f.anlegen('sedierungpflichtig', 'ja');   /* mit Tippfehler */
  f.setzen('s1', e.key, true);
  f.setzen('s2', e.key, true);
  f.aendern(e.key, 'wort', 'sedierungspflichtig');   /* Tippfehler korrigiert */
  assert.equal(f.of(e.key).wort, 'sedierungspflichtig');
  assert.equal(f.standards(e.key).length, 2, 'die Zuordnungen hängen am Schlüssel, nicht am Wort');
});

test('Löschen räumt auch die Vergaben weg', () => {
  const { f, holen } = umgebung(null, STDS);
  const e = f.anlegen('Testmerkmal', 'ja');
  f.setzen('s1', e.key, true);
  f.loeschen(e.key);
  assert.equal(f.of(e.key), null);
  assert.equal(JSON.stringify(holen().std).indexOf(e.key), -1,
    'sonst tauchte der Wert beim nächsten gleichnamigen Merkmal wieder auf');
});

test('Merkmale lassen sich ordnen', () => {
  const { f } = umgebung();
  f.anlegen('A', 'ja'); const b = f.anlegen('B', 'ja'); f.anlegen('C', 'ja');
  f.verschieben(b.key, -1);
  assert.equal(f.liste().map(x => x.wort).join(''), 'BAC');
  assert.equal(f.verschieben(f.liste()[0].key, -1), false, 'über den Rand hinaus passiert nichts');
});

/* ═══ Vergabe ═══ */

test('„ohne Angabe" ist ein eigener Zustand, kein Nein', () => {
  const { f } = umgebung(null, STDS);
  const e = f.anlegen('sedierungspflichtig', 'ja');
  f.setzen('s1', e.key, true);
  f.setzen('s2', e.key, false);
  assert.equal(f.wert('s1', e.key), true);
  assert.equal(f.wert('s2', e.key), false);
  assert.equal(f.wert('s3', e.key), undefined);
  assert.equal(f.hat('s2', e.key), false, 'ein ausdrückliches Nein trägt das Merkmal nicht');
  assert.equal(f.hat('s3', e.key), false);
});

test('ein zurückgenommener Wert verschwindet ganz', () => {
  const { f, holen } = umgebung(null, STDS);
  const e = f.anlegen('x', 'ja');
  f.setzen('s1', e.key, true);
  f.setzen('s1', e.key, undefined);
  assert.equal('s1' in holen().std, false, 'kein leerer Rest');
});

test('Werte-Merkmale halten Text', () => {
  const { f } = umgebung(null, STDS);
  const e = f.anlegen('Vorbereitungszeit', 'wert');
  f.setzen('s1', e.key, '45 min');
  assert.equal(f.wert('s1', e.key), '45 min');
  assert.equal(f.standards(e.key, '45 min').length, 1);
  assert.equal(f.standards(e.key, '90 min').length, 0);
});

/* ═══ Ehrlich zählen ═══ */

test('DIE ZWEITE ENTSCHEIDENDE: die Bilanz zählt „ohne Angabe" mit', () => {
  const { f } = umgebung(null, STDS);
  const e = f.anlegen('sedierungspflichtig', 'ja');
  f.setzen('s1', e.key, true);
  f.setzen('s2', e.key, true);
  f.setzen('s3', e.key, false);
  const b = f.bilanz(e.key);
  assert.equal(b.gesamt, 4);
  assert.equal(b.ja, 2);
  assert.equal(b.nein, 1);
  assert.equal(b.ohne, 1);
  assert.equal(b.ja + b.nein + b.ohne, b.gesamt, 'die Summe muss aufgehen');
});

test('bei Auswahl-Merkmalen zeigt die Bilanz die Verteilung', () => {
  const { f } = umgebung(null, STDS);
  const e = f.anlegen('Zugang', 'auswahl');
  f.aendern(e.key, 'werte', 'radial · femoral');
  f.setzen('s1', e.key, 'radial');
  f.setzen('s2', e.key, 'radial');
  f.setzen('s3', e.key, 'femoral');
  const b = f.bilanz(e.key);
  assert.equal(b.verteilung.radial, 2);
  assert.equal(b.verteilung.femoral, 1);
  assert.equal(b.ohne, 1);
});

/* ═══ Reichweite und Anzeige ═══ */

test('nur ausdrücklich freigegebene Merkmale erscheinen im Reichweitenmenü', () => {
  const { f } = umgebung();
  const a = f.anlegen('sedierungspflichtig', 'ja');
  f.anlegen('Vorbereitungszeit', 'wert');
  assert.equal(f.reichweiten().length, 0, 'sonst wäre die Liste nach zwanzig Merkmalen unbenutzbar');
  f.aendern(a.key, 'alsReichweite', true);
  assert.equal(f.reichweiten().map(x => x.key).join(''), a.key);
});

test('ein „stilles" Merkmal steht nicht im Kopf und nicht in der Übersicht', () => {
  const { f } = umgebung(null, STDS);
  const a = f.anlegen('sichtbar', 'ja');
  const b = f.anlegen('intern', 'ja');
  f.aendern(b.key, 'zeigen', 'still');
  assert.equal(f.kopfListe().map(x => x.key).join(''), a.key);
});

test('Chips zeigen nur gesetzte Merkmale — kein „ohne Angabe" im Saal', () => {
  const { f } = umgebung(null, STDS);
  const a = f.anlegen('sedierungspflichtig', 'ja');
  const b = f.anlegen('Vorbereitungszeit', 'wert');
  f.anlegen('nicht vergeben', 'ja');
  f.setzen('s1', a.key, true);
  f.setzen('s1', b.key, '45 min');
  const c = f.chips('s1');
  assert.equal(c.length, 2);
  assert.equal(c[1].text, 'Vorbereitungszeit: 45 min', 'Wert-Merkmale zeigen Wort und Wert');
});

test('ein ausdrückliches Nein erzeugt keinen Chip', () => {
  const { f } = umgebung(null, STDS);
  const a = f.anlegen('sedierungspflichtig', 'ja');
  f.setzen('s1', a.key, false);
  assert.equal(f.chips('s1').length, 0);
});


/* ═══ Häkchen direkt im Menü ═══
   „Merkmale sollen über das Menü mit einer Checkbox einem standard zugeordnet
   werden … macht die Arbeit schneller." Der Gewinn ist gezählt: eine
   Berührung statt vier. Geprüft wird deshalb vor allem, dass das Häkchen
   nichts VERSPRICHT, was es nicht halten kann. */

test('ankreuzen kann man nur Ja/Nein-Merkmale', () => {
  const { f } = umgebung(null, STDS);
  f.anlegen('sedierungspflichtig', 'ja');
  f.anlegen('Vorbereitungszeit', 'wert');
  f.anlegen('Zugang', 'auswahl');
  assert.deepEqual(f.hakenListe().map(x => x.key), ['sedierungspflichtig']);
});

test('ein stilles Merkmal steht auch nicht im Menü', () => {
  const { f } = umgebung(null, STDS);
  const a = f.anlegen('sedierungspflichtig', 'ja');
  f.aendern(a.key, 'zeigen', 'still');
  assert.equal(f.hakenListe().length, 0);
  assert.equal(f.hakenHTML('s1'), '', 'ohne ankreuzbare Merkmale gar kein Block');
});

test('die Zeile zeigt drei Zustände — und behauptet nie einen vierten', () => {
  const { f } = umgebung(null, STDS);
  const a = f.anlegen('sedierungspflichtig', 'ja');

  const ohne = f.hakenZeile('s1', f.of(a.key));
  assert.match(ohne, /aria-checked="false"/);
  assert.ok(!/ausdrücklich nein/.test(ohne), 'ohne Angabe ist kein Nein');

  f.setzen('s1', a.key, true);
  const ja = f.hakenZeile('s1', f.of(a.key));
  assert.match(ja, /aria-checked="true"/);
  assert.match(ja, /eig-haken on/);

  /* Ein gepflegtes NEIN muss man SEHEN — sonst kreuzt jemand an, was jemand
     anderes ausdrücklich verneint hat, und merkt es nicht. */
  f.setzen('s1', a.key, false);
  const nein = f.hakenZeile('s1', f.of(a.key));
  assert.match(nein, /eig-haken nein/);
  assert.match(nein, /ausdrücklich nein/);
  assert.match(nein, /aria-checked="false"/);
});

test('jede Zeile trägt die Kennung, an der der Langdruck hängt (A7)', () => {
  const { f } = umgebung(null, STDS);
  const a = f.anlegen('sedierungspflichtig', 'ja');
  const html = f.hakenHTML('s2');
  assert.match(html, new RegExp('data-k="' + a.key + '"'));
  assert.match(html, /data-s="s2"/);
  assert.match(html, /onclick="eigHakenTippen\(/);
});
