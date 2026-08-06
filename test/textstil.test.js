'use strict';
/* Tests für Schriftgröße und Auszeichnung (public/js/features/textstil.js).

   Die gefährliche Stelle ist die Auszeichnung einzelner Wörter: Sie erzeugt
   HTML aus Text, den Menschen getippt haben — und ein Teil dieses Textes
   stammt aus Word-Dateien, die niemand geprüft hat. Wird zuerst ausgezeichnet
   und danach entschärft (oder gar nicht entschärft), wird aus einem
   Standardtext ausführbares Markup.

   Deshalb prüft die erste Gruppe genau diese Reihenfolge. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'public/js/features/textstil.js'), 'utf8');

/* esc() wie in der App (public/js/core/store.js). */
function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function umgebung(bez) {
  const ctx = vm.createContext({
    console,
    esc: escHtml,
    bezWert: (zweig, feld, rueckfall) => (bez && bez[zweig] && bez[zweig][feld] !== undefined) ? bez[zweig][feld] : rueckfall,
    qeGet: () => undefined,
    window: undefined,
  });
  vm.runInContext(SRC + `
    ;globalThis.__f = {
      text:txsText, hat:txsHatAuszeichnung, norm:txsNorm, klassen:txsKlassen,
      istVorgabe:txsIstVorgabe, beschreibung:txsBeschreibung,
      gueltig:txsGroesseGueltig, wort:txsGroesseWort, ausz:txsAuszeichnungen,
      groessen:TXS_GROESSEN, vorgabe:TXS_VORGABE
    };
  `, ctx);
  return ctx.__f;
}

/* ═══ Sicherheit: erst entschärfen, dann auszeichnen ═══ */

test('DAS ENTSCHEIDENDE: Markup aus dem Text wird entschärft, nicht ausgeführt', () => {
  const f = umgebung();
  const h = f.text('<script>böse()</script>');
  assert.equal(h.indexOf('<script') , -1, 'kein echtes Skript-Tag im Ergebnis');
  assert.equal(h.indexOf('&lt;script&gt;') >= 0, true);
});

test('spitze Klammern im Text bleiben Text, auch mit Auszeichnung daneben', () => {
  const f = umgebung();
  const h = f.text('Winkel <90° bei **CAVE** beachten');
  assert.equal(h.indexOf('&lt;90') >= 0, true);
  assert.equal(h.indexOf('<span class="tx-fett">CAVE</span>') >= 0, true);
});

test('Anführungszeichen im Text zerstören kein Attribut', () => {
  const f = umgebung();
  const h = f.text('Größe "6F"');
  assert.equal(h.indexOf('&quot;6F&quot;') >= 0, true);
});

/* ═══ Auszeichnung ═══ */

test('ein Wort zwischen Sternchen wird fett', () => {
  const f = umgebung();
  assert.equal(f.text('**CAVE** Schmerzreaktion'), '<span class="tx-fett">CAVE</span> Schmerzreaktion');
});

test('das längere Zeichenpaar gewinnt — sonst frisst ein Stern das Sternpaar', () => {
  const f = umgebung({ auszeichnungen: { werte: [
    { auf: '*', zu: '*', klasse: 'tx-s', wort: 'klein' },
    { auf: '**', zu: '**', klasse: 'tx-fett', wort: 'fett' }
  ] } });
  assert.equal(f.text('**fett**'), '<span class="tx-fett">fett</span>');
});

test('eine Auszeichnung reicht nicht über Zeilen hinweg', () => {
  const f = umgebung();
  const h = f.text('**offen\nnächste Zeile** Ende');
  assert.equal(h.indexOf('tx-fett'), -1, 'ein vergessenes Zeichen darf nicht den halben Standard fetten');
});

test('ein einzelnes Zeichen ohne Gegenstück bleibt stehen', () => {
  const f = umgebung();
  assert.equal(f.text('2 ** 3'), '2 ** 3');
});

test('mehrere Auszeichnungen in einem Satz', () => {
  const f = umgebung();
  const h = f.text('**CAVE** und __wichtig__ und ~nebensache~');
  assert.equal(h.indexOf('tx-fett') > 0, true);
  assert.equal(h.indexOf('tx-l') > 0, true);
  assert.equal(h.indexOf('tx-s') > 0, true);
});

test('die Zeichen kommen aus der Konfiguration, nicht aus dem Quelltext', () => {
  const f = umgebung({ auszeichnungen: { werte: [
    { auf: '<<', zu: '>>', klasse: 'tx-fett', wort: 'fett' }
  ] } });
  assert.equal(f.text('<<Hinweis>>'), '<span class="tx-fett">Hinweis</span>');
  assert.equal(f.text('**nicht mehr fett**'), '**nicht mehr fett**');
});

test('eine unvollständige Regel wird verworfen statt still nichts zu tun', () => {
  const f = umgebung({ auszeichnungen: { werte: [
    { auf: '**', zu: '', klasse: 'tx-fett' },
    { auf: '__', zu: '__', klasse: 'tx-l', wort: 'groß' }
  ] } });
  assert.equal(f.ausz().length, 1);
  assert.equal(f.text('__groß__').indexOf('tx-l') > 0, true);
});

test('eine leere Konfiguration fällt auf die Vorgaben zurück', () => {
  const f = umgebung({ auszeichnungen: { werte: [] } });
  assert.equal(f.text('**x**').indexOf('tx-fett') >= 0, true);
});

test('txsHatAuszeichnung erkennt, ob im Text etwas hervorgehoben ist', () => {
  const f = umgebung();
  assert.equal(f.hat('**CAVE** beachten'), true);
  assert.equal(f.hat('nichts besonderes'), false);
});

/* ═══ Stil einer Zeile ═══ */

test('ein fehlender oder kaputter Stil ergibt immer einen vollständigen Satz', () => {
  const f = umgebung();
  assert.equal(f.norm(undefined).g, f.vorgabe);
  assert.equal(f.norm(null).f, false);
  assert.equal(f.norm('unfug').g, f.vorgabe);
  assert.equal(f.norm({ g: 'riesig' }).g, f.vorgabe, 'eine unbekannte Größe zerlegt die Anzeige nicht');
});

test('die Vorgabe erzeugt keine Klasse — sonst stünde an jeder Zeile Ballast', () => {
  const f = umgebung();
  assert.equal(f.klassen({ g: 'm', f: false }), '');
  assert.equal(f.istVorgabe({ g: 'm', f: false }), true);
});

test('Größe und Gewicht ergeben zusammen zwei Klassen', () => {
  const f = umgebung();
  assert.equal(f.klassen({ g: 'xl', f: true }), 'tx-xl tx-fett');
  assert.equal(f.klassen({ g: 'm', f: true }), 'tx-fett');
});

test('alle Größen sind gültig und haben ein Wort', () => {
  const f = umgebung();
  f.groessen.forEach(g => {
    assert.equal(f.gueltig(g), g);
    assert.equal(typeof f.wort(g), 'string');
    assert.equal(f.wort(g).length > 0, true);
  });
});

test('die Wörter der Größen kommen aus der Konfiguration', () => {
  const f = umgebung({ schriftgroessen: { werte: { s: 'Winzig', m: 'Standard', l: 'Riesig', xl: 'Plakat' } } });
  assert.equal(f.wort('xl'), 'Plakat');
  assert.equal(f.beschreibung({ g: 'xl', f: true }), 'Plakat · fett');
});
