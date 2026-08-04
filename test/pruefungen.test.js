'use strict';
/* Tests für die beiden Grundsatz-Prüfungen in `npm run check`
   (scripts/pruefungen/…, beschrieben in docs/GRUNDSAETZE.md, Teil C).

   Eine Prüfung, die falschen Alarm schlägt, wird nach der dritten Meldung
   abgeschaltet — und ist dann schlimmer als keine. Deshalb prüft diese Suite
   vor allem, was NICHT gemeldet werden darf: Maschinenschlüssel, Tastennamen,
   DOM-Fehlernamen, Vorkommen in Kommentaren, begründete Einzelfälle.

   Und sie prüft die Ratsche: Die Altlastenliste darf nur schrumpfen. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const quelltext = require(path.join(ROOT, 'scripts/pruefungen/quelltext'));
const eingabe = require(path.join(ROOT, 'scripts/pruefungen/eingabefenster'));
const fachwort = require(path.join(ROOT, 'scripts/pruefungen/fachwort'));
const check = require(path.join(ROOT, 'scripts/check'));

/* Legt eine Wegwerf-Datei an und gibt Wurzel + relativen Pfad zurück. */
let lfd = 0;
function mitDatei(inhalt) {
  const wurzel = fs.mkdtempSync(path.join(os.tmpdir(), 'hkl-pruef-'));
  const verz = path.join(wurzel, 'js');
  fs.mkdirSync(verz, { recursive: true });
  const name = 'probe' + (++lfd) + '.js';
  fs.writeFileSync(path.join(verz, name), inhalt, 'utf8');
  return { wurzel, rel: 'js/' + name };
}

/* ═══════════════ 1. Kommentare abstreifen ═══════════════ */

test('Blockkommentar über mehrere Zeilen wird nicht als Code gelesen', () => {
  const z = quelltext.ohneKommentar('a = 1; /* prompt(', false);
  assert.equal(z.offen, true);
  assert.ok(z.code.indexOf('prompt') < 0);
  const z2 = quelltext.ohneKommentar('noch im Kommentar */ b = 2;', true);
  assert.equal(z2.offen, false);
  assert.ok(z2.code.indexOf('b = 2') >= 0);
});

test('„//" in einer Zeichenkette beendet nicht die Zeile (URLs)', () => {
  const z = quelltext.ohneKommentar("const u='https://beispiel.de'; x==='Ja';", false);
  assert.ok(z.code.indexOf("x==='Ja'") >= 0, 'der Code hinter der URL bleibt erhalten');
});

/* ═══════════════ 2. Eingabefenster ═══════════════ */

test('prompt() und confirm() werden gefunden', () => {
  const { wurzel } = mitDatei("function f(){ const a=prompt('x'); if(confirm('y')) return a; }");
  const p = eingabe.pruefe(wurzel, 'js', {});
  assert.equal(p.length, 1);
  assert.ok(/2 Vorkommen/.test(p[0]));
});

test('promptLogin() und obj.confirm() zählen nicht mit', () => {
  const { wurzel } = mitDatei("promptLogin(); dialog.confirm(); meinPrompt();");
  assert.equal(eingabe.pruefe(wurzel, 'js', {}).length, 0);
});

test('prompt() in einem Kommentar ist kein Fund', () => {
  const { wurzel } = mitDatei("/* früher stand hier prompt('x') */\nconst a=1;");
  assert.equal(eingabe.pruefe(wurzel, 'js', {}).length, 0);
});

test('Altlast in der erlaubten Höhe ist still, eine mehr bricht ab', () => {
  const a = mitDatei("prompt('a');");
  assert.equal(eingabe.pruefe(a.wurzel, 'js', { [a.rel]: 1 }).length, 0);
  const b = mitDatei("prompt('a'); prompt('b');");
  assert.equal(eingabe.pruefe(b.wurzel, 'js', { [b.rel]: 1 }).length, 1);
});

test('die Ratsche greift auch nach unten: beseitigte Altlast muss abgetragen werden', () => {
  const { wurzel, rel } = mitDatei("prompt('a');");
  const p = eingabe.pruefe(wurzel, 'js', { [rel]: 3 });
  assert.equal(p.length, 1);
  assert.ok(/nur noch 1 statt 3/.test(p[0]));
  assert.ok(/auf 1 setzen/.test(p[0]), 'die neue Zahl steht in der Meldung');
});

test('begründete Ausnahme: /* eingabe:ok */ in derselben Zeile', () => {
  const { wurzel } = mitDatei("confirm('x'); /* eingabe:ok — Begründung */");
  assert.equal(eingabe.pruefe(wurzel, 'js', {}).length, 0);
});

/* ═══════════════ 3. Fachwort im Vergleich ═══════════════ */

const menschenwort = fachwort.istMenschenwort;

test('ein Menschenwort erkennt man an Großbuchstabe, Leerzeichen oder Umlaut', () => {
  ['Freigegeben', 'Kein Material', 'bestätigt', 'REF-Streifen', 'In Prüfung']
    .forEach(w => assert.ok(menschenwort(w), w + ' sollte als Menschenwort gelten'));
});

test('Maschinenschlüssel dieses Projekts gelten NICHT als Menschenwort', () => {
  ['material', 'geraete', 'mengeVal', 'editBase', 'scr-rubriken', 'new|', 'uk',
   '', '1', '—', 'a|0|0|0'].forEach(w => assert.ok(!menschenwort(w), w + ' ist ein Schlüssel'));
});

test('Begriffe des Browsers gelten NICHT als Menschenwort', () => {
  ['Enter', 'Escape', 'ArrowLeft', 'NotAllowedError', 'IMG', 'POST']
    .forEach(w => assert.ok(!menschenwort(w), w + ' gehört dem Browser'));
});

test('ein Vergleich gegen ein Menschenwort wird gemeldet — auf beiden Seiten', () => {
  const a = mitDatei("if(m.status==='Freigegeben'){}");
  assert.equal(fachwort.pruefe(a.wurzel, 'js', {}).length, 1);
  const b = mitDatei("if('Kein Material'!==x.kategorie){}");
  assert.equal(fachwort.pruefe(b.wurzel, 'js', {}).length, 1);
  const c = mitDatei("if(t.indexOf('Vorbereitungsraum')>=0){}");
  assert.equal(fachwort.pruefe(c.wurzel, 'js', {}).length, 1);
});

test('der Umweg über eine Konstante wird ebenfalls gemeldet', () => {
  const { wurzel } = mitDatei("const FREI='Freigegeben';\nfunction f(m){ return m.status!==FREI; }");
  const p = fachwort.pruefe(wurzel, 'js', {});
  assert.equal(p.length, 1);
  assert.ok(/über FREI/.test(p[0]));
});

test('eine Konstante, gegen die nie verglichen wird, ist nur eine Bezeichnung', () => {
  const { wurzel } = mitDatei("const WORT='Freigegeben';\nfunction f(){ return WORT; }");
  assert.equal(fachwort.pruefe(wurzel, 'js', {}).length, 0);
});

test('Anzeigetext ohne Vergleich wird nicht gemeldet', () => {
  const { wurzel } = mitDatei("h += '<b>Freigegeben am</b>' + esc(m.at);");
  assert.equal(fachwort.pruefe(wurzel, 'js', {}).length, 0);
});

test('begründete Ausnahme: die Marke darf im Kommentarblock darüber stehen', () => {
  const { wurzel } = mitDatei(
    "/* fachwort:ok — fester Wert aus der mitgelieferten Datei,\n" +
    "   keine Anzeige-Bezeichnung. */\n" +
    "const unb=(r.katstatus!=='bestätigt');");
  assert.equal(fachwort.pruefe(wurzel, 'js', {}).length, 0);
});

test('eine Leerzeile trennt die Begründung vom Code — dann gilt sie nicht mehr', () => {
  const { wurzel } = mitDatei("/* fachwort:ok — Begründung */\n\nconst u=(x!=='bestätigt');");
  assert.equal(fachwort.pruefe(wurzel, 'js', {}).length, 1);
});

/* ═══════════════ 4. Der Bestand selbst ═══════════════ */

test('die Altlastenliste ist gültiges JSON und hat beide Zweige', () => {
  const alt = check.altlasten();
  assert.ok(alt.eingabefenster && typeof alt.eingabefenster === 'object');
  assert.ok(alt.fachwort && typeof alt.fachwort === 'object');
});

test('kein Fachwort mehr im Vergleich — der Zweig ist leer und bleibt leer', () => {
  const alt = check.altlasten();
  assert.equal(Object.keys(alt.fachwort).length, 0,
    'Neue Fachwort-Altlasten gehören behoben, nicht geduldet.');
});

test('die neuen Bausteine kommen ohne native Eingabefenster aus', () => {
  const alt = check.altlasten().eingabefenster;
  ['public/js/features/bausteine.js', 'public/js/features/freigabe.js',
   'public/js/features/facetten.js', 'public/js/features/ruestliste.js']
    .forEach(f => assert.ok(!alt[f], f + ' darf keine Altlast haben'));
});

test('das ganze Projekt ist gegen die Altlastenliste sauber', () => {
  assert.deepEqual(check.grundsatzProblems(), []);
});
