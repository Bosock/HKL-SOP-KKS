'use strict';
/* Tests für „Liste einfügen" (features/einfuegen.js).

   Der Betreiber, nach dem ersten selbst geschriebenen Standard: „Es ist sehr
   holprig." Ein Standard hat 60 bis 100 Zeilen, und die Liste liegt meist
   schon fertig daneben.

   Diese Datei prüft das Zerlegen — und zwar an dem, was Menschen WIRKLICH
   einfügen: Spiegelstriche aus Word, Nummerierungen, Tabulatoren aus einer
   Tabelle, Mengen mal vorn und mal hinten, geschützte Leerzeichen, leere
   Zeilen, Überschriften.

   Der Maßstab ist dabei nicht „möglichst schlau", sondern:
   ① Was nicht sicher erkannt wird, bleibt stehen — geraten wird nicht.
   ② Eine Zeile ohne Namen entsteht gar nicht erst („leer schlägt falsch").
   ③ Nichts wird stillschweigend zusammengefasst; Dubletten werden GEZEIGT.
*/

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const lies = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function umgebung(bestand) {
  const gelegt = [];
  const ctx = vm.createContext({
    console, esc: (s) => String(s == null ? '' : s), $: () => null,
    toast: () => {}, setTimeout: () => {}, ADMIN: true,
    ankBestand: () => bestand || [],
    bauSlug: (s) => String(s || '').toLowerCase().replace(/[^a-z0-9äöüß]+/g, ' ').trim(),
    ADDITIONS: { entries: {} },
    makeAddEntry: (f) => { gelegt.push(f); return Object.assign({ _gemacht: true }, f); },
    saveAdditions: () => {}, newAid: () => 'a' + gelegt.length,
  });
  vm.runInContext(lies('public/js/features/einfuegen.js'), ctx);
  vm.runInContext(`globalThis.__e = { zerlegen:einfZerlegen, zeile:einfZeile,
    abgleichen:einfAbgleichen, einfuegen:einfEinfuegen, sauber:einfSauber, max:()=>EINF_MAX };`, ctx);
  return { e: ctx.__e, gelegt, ctx };
}
const z = (t) => JSON.parse(JSON.stringify(umgebung().e.zerlegen(t)));

/* ═══════════ Die einfachen Fälle ═══════════ */

test('eine Sache je Zeile — mehr braucht es nicht', () => {
  const l = z('Radialschleuse 6F\nFührungsdraht 0.035\nKompressen');
  assert.equal(l.length, 3);
  assert.deepEqual(l.map(x => x.name), ['Radialschleuse 6F', 'Führungsdraht 0.035', 'Kompressen']);
  assert.ok(l.every(x => x.art === 'zeile' && x.menge === ''));
});

test('leere Zeilen fallen weg, statt leere Einträge zu erzeugen', () => {
  const l = z('Erstes\n\n   \n\t\nZweites\n\n');
  assert.equal(l.length, 2);
  assert.deepEqual(l.map(x => x.name), ['Erstes', 'Zweites']);
});

test('nichts drin heißt nichts raus', () => {
  assert.equal(z('').length, 0);
  assert.equal(z('   \n\n  ').length, 0);
  assert.equal(z(null).length, 0);
  assert.equal(z(undefined).length, 0);
});

/* ═══════════ Was aus Word kommt ═══════════ */

test('Spiegelstriche und Aufzählungszeichen jeder Art fliegen weg', () => {
  const l = z('- Erstes\n– Zweites\n— Drittes\n• Viertes\n* Fünftes\n· Sechstes\n▪ Siebtes\n> Achtes');
  assert.equal(l.length, 8);
  assert.deepEqual(l.map(x => x.name),
    ['Erstes', 'Zweites', 'Drittes', 'Viertes', 'Fünftes', 'Sechstes', 'Siebtes', 'Achtes']);
});

test('Nummerierungen fliegen weg — Ziffern, Klammern, Buchstaben', () => {
  const l = z('1. Punktion\n2) Schleuse\n(3) Draht\na) Katheter\nIII. Nicht erkannt');
  assert.deepEqual(l.slice(0, 4).map(x => x.name), ['Punktion', 'Schleuse', 'Draht', 'Katheter']);
  assert.equal(l[4].name, 'III. Nicht erkannt', 'römisch wird NICHT geraten — lieber stehen lassen');
});

test('ein Bindestrich MITTEN im Namen bleibt', () => {
  const l = z('- Y-Konnektor\nDrei-Wege-Hahn');
  assert.deepEqual(l.map(x => x.name), ['Y-Konnektor', 'Drei-Wege-Hahn']);
});

test('geschützte Leerzeichen und unsichtbare Zeichen aus Word verschwinden', () => {
  const l = z('Radialschleuse 6F\n​Kompressen﻿');
  assert.deepEqual(l.map(x => x.name), ['Radialschleuse 6F', 'Kompressen']);
});

test('doppelte Leerzeichen werden zu einem', () => {
  assert.equal(z('Radialschleuse    6F')[0].name, 'Radialschleuse 6F');
});

/* ═══════════ Mengen ═══════════ */

test('die Menge vorn wird erkannt — in allen Schreibweisen', () => {
  const l = z('2x Radialschleuse\n2 x Draht\n3× Katheter\n10 Stk. Kompressen\n5 St Tupfer\n4 Schleusen');
  assert.deepEqual(l.map(x => x.menge), ['2', '2', '3', '10', '5', '4']);
  assert.deepEqual(l.map(x => x.name),
    ['Radialschleuse', 'Draht', 'Katheter', 'Kompressen', 'Tupfer', 'Schleusen']);
});

test('die Menge hinten wird erkannt', () => {
  const l = z('Radialschleuse 2x\nKompressen 10 Stk.\nDraht 3×');
  assert.deepEqual(l.map(x => x.menge), ['2', '10', '3']);
  assert.deepEqual(l.map(x => x.name), ['Radialschleuse', 'Kompressen', 'Draht']);
});

test('eine Zahl, die zum NAMEN gehört, bleibt am Namen', () => {
  const l = z('Radialschleuse 6F\nFührungsdraht 0.035\nKatheter JR4');
  assert.deepEqual(l.map(x => x.menge), ['', '', ''],
    'nur eine Zahl MIT Stück-Wort oder am Anfang ist eine Menge');
  assert.deepEqual(l.map(x => x.name), ['Radialschleuse 6F', 'Führungsdraht 0.035', 'Katheter JR4']);
});

test('Spiegelstrich UND Menge zusammen', () => {
  const l = z('- 2x Radialschleuse 6F\n1. 3 Stk. Kompressen');
  assert.deepEqual(l.map(x => x.menge), ['2', '3']);
  assert.deepEqual(l.map(x => x.name), ['Radialschleuse 6F', 'Kompressen']);
});

test('eine Zeile, die nur aus einer Zahl besteht, entsteht nicht', () => {
  const l = z('Radialschleuse\n42\n2x\nDraht');
  assert.deepEqual(l.map(x => x.name), ['Radialschleuse', 'Draht']);
});

/* ═══════════ Tabellen ═══════════ */

test('eine Tabelle aus zwei Spalten: Name und Menge finden sich', () => {
  const l = z('Radialschleuse 6F\t2\nFührungsdraht\t1\nKompressen\t10');
  assert.deepEqual(l.map(x => x.name), ['Radialschleuse 6F', 'Führungsdraht', 'Kompressen']);
  assert.deepEqual(l.map(x => x.menge), ['2', '1', '10']);
});

test('… auch wenn die Menge in der ERSTEN Spalte steht', () => {
  const l = z('2\tRadialschleuse 6F\n10 Stk\tKompressen');
  assert.deepEqual(l.map(x => x.name), ['Radialschleuse 6F', 'Kompressen']);
  assert.deepEqual(l.map(x => x.menge), ['2', '10']);
});

test('bei drei Spalten gewinnt die längste als Name — der Rest wird nicht geraten', () => {
  const l = z('Med\tRadialschleuse 6F Terumo\t2');
  assert.equal(l.length, 1);
  assert.equal(l[0].name, 'Radialschleuse 6F Terumo');
  assert.equal(l[0].menge, '2');
});

/* ═══════════ Überschriften ═══════════ */

test('ein Doppelpunkt am Ende macht eine Überschrift', () => {
  const l = z('Zugang:\nPunktion A. radialis\nMaterial:\nSchleuse');
  assert.deepEqual(l.map(x => x.art), ['ueberschrift', 'zeile', 'ueberschrift', 'zeile']);
  assert.deepEqual(l.map(x => x.name), ['Zugang', 'Punktion A. radialis', 'Material', 'Schleuse']);
});

test('ein Doppelpunkt MITTEN in der Zeile macht keine Überschrift', () => {
  const l = z('Hinweis: bitte steril arbeiten');
  assert.equal(l[0].art, 'zeile');
  assert.equal(l[0].name, 'Hinweis: bitte steril arbeiten');
});

test('eine Überschrift trägt keine Menge', () => {
  const l = z('2x Zugang:');
  assert.equal(l[0].art, 'ueberschrift');
  assert.equal(l[0].menge, '', 'sonst stünde an einer Gliederung eine Stückzahl');
});

/* ═══════════ Dubletten ═══════════ */

test('Dubletten werden MARKIERT, nicht entfernt', () => {
  const l = z('Radialschleuse\nDraht\nradialschleuse\nRADIALSCHLEUSE');
  assert.equal(l.length, 4, 'nichts wird verschluckt');
  assert.deepEqual(l.map(x => x.dublette), [false, false, true, true]);
});

test('zwei gleichnamige Überschriften gelten nicht als Dublette', () => {
  const l = z('Vorbereitung:\nVorbereitung:');
  assert.deepEqual(l.map(x => x.dublette), [false, false],
    'Gliederung darf sich wiederholen — Material nicht unbemerkt');
});

/* ═══════════ Die Grenze ═══════════ */

test('sehr lange Listen werden gekappt, statt die App anzuhalten', () => {
  const { e } = umgebung();
  const viele = Array.from({ length: e.max() + 50 }, (_, i) => 'Zeile ' + i).join('\n');
  assert.equal(e.zerlegen(viele).length, e.max());
});

/* ═══════════ Der stille Gewinn: Abgleich mit dem Bestand ═══════════ */

const BESTAND = [
  { key: 'a:radialschleuse 6f', name: 'Radialschleuse 6F', nat: 'material', uk: 'Schleusen' },
  { key: 'a:kompressen', name: 'Kompressen', nat: 'material', uk: '' },
];

test('DER KERN: ein bekannter Name bekommt GENAU die vorhandene Schreibweise', () => {
  const { e } = umgebung(BESTAND);
  const l = e.abgleichen(e.zerlegen('radialschleuse 6f\nKOMPRESSEN\nNeues Ding'), 'material');
  assert.equal(l[0].name, 'Radialschleuse 6F', 'gleiche Schreibweise = gleiches Material');
  assert.equal(l[0].bekannt, true);
  assert.equal(l[0].uk, 'Schleusen', 'die Unterkategorie kommt gleich mit');
  assert.equal(l[1].name, 'Kompressen');
  assert.equal(l[2].name, 'Neues Ding');
  assert.equal(l[2].bekannt, false, 'was neu ist, bleibt wie getippt');
});

test('eine Überschrift wird nie gegen den Materialbestand abgeglichen', () => {
  const { e } = umgebung(BESTAND);
  const l = e.abgleichen(e.zerlegen('Kompressen:'), 'material');
  assert.equal(l[0].art, 'ueberschrift');
  assert.equal(l[0].bekannt, false);
  assert.equal(l[0].name, 'Kompressen');
});

test('ohne Bestand bleibt alles wie eingefügt', () => {
  const { e } = umgebung([]);
  const l = e.abgleichen(e.zerlegen('irgendwas'), 'material');
  assert.equal(l[0].name, 'irgendwas');
  assert.equal(l[0].bekannt, false);
});

/* ═══════════ Einfügen ═══════════ */

test('eingefügt wird über denselben Weg wie getippt und angekreuzt', () => {
  const { e, gelegt, ctx } = umgebung(BESTAND);
  const n = e.einfuegen('S1', 2, [
    { name: 'Radialschleuse 6F', menge: '2', art: 'zeile', uk: 'Schleusen' },
    { name: 'Zugang', menge: '', art: 'ueberschrift' },
  ], 'material');
  assert.equal(n, 2);
  assert.equal(gelegt.length, 2);
  assert.equal(gelegt[0].nat, 'material');
  assert.equal(gelegt[0].menge, '2');
  assert.equal(gelegt[0].uk, 'Schleusen');
  assert.equal(gelegt[1].nat, 'ueberschrift', 'die Gliederung bleibt Gliederung');
  assert.equal(ctx.ADDITIONS.entries['S1|2'].length, 2);
});

test('in einer Ablauf-Rubrik entstehen Ablauf-Zeilen', () => {
  const { e, gelegt } = umgebung([]);
  e.einfuegen('S1', 0, [{ name: 'Punktion', art: 'zeile' }], 'ablauf');
  assert.equal(gelegt[0].nat, 'ablauf');
});

test('nichts gewählt legt auch keinen leeren Topf an', () => {
  const { e, ctx } = umgebung([]);
  assert.equal(e.einfuegen('S1', 3, [], 'material'), 0);
  assert.equal(ctx.ADDITIONS.entries['S1|3'], undefined,
    'sonst stünde im Speicher eine Rubrik mit null Einträgen — unsichtbar, aber unwahr');
});

test('eine Zeile ohne Namen wird beim Einfügen übersprungen', () => {
  const { e, gelegt } = umgebung([]);
  const n = e.einfuegen('S1', 0, [{ name: '  ', art: 'zeile' }, { name: 'Echt', art: 'zeile' }], 'material');
  assert.equal(n, 1);
  assert.equal(gelegt.length, 1);
  assert.equal(gelegt[0].name, 'Echt');
});

/* ═══════════ Ein echtes Beispiel, wie es aus Word kommt ═══════════ */

test('eine ganze Materialliste aus Word — in einem Zug', () => {
  const { e } = umgebung(BESTAND);
  const ausWord = [
    'Material:',
    '',
    '-\t2x Radialschleuse 6F',
    '-\tFührungsdraht 0.035',
    '- 10 Stk. Kompressen',
    '',
    'Ablauf:',
    '1. Punktion A. radialis',
    '2. Schleuse einbringen',
    '3. Draht vorschieben',
  ].join('\n');
  /* Über JSON zurück in diese Welt: Arrays aus dem Sandkasten haben einen
     anderen Prototyp, deepEqual verglüche sonst Welten statt Werte. */
  const l = JSON.parse(JSON.stringify(e.abgleichen(e.zerlegen(ausWord), 'material')));
  assert.equal(l.length, 8, 'zwei Überschriften, sechs Zeilen — kein Rest, keine Leerzeile');
  assert.deepEqual(l.map(x => x.art),
    ['ueberschrift', 'zeile', 'zeile', 'zeile', 'ueberschrift', 'zeile', 'zeile', 'zeile']);
  assert.deepEqual(l.map(x => x.name), ['Material', 'Radialschleuse 6F', 'Führungsdraht 0.035',
    'Kompressen', 'Ablauf', 'Punktion A. radialis', 'Schleuse einbringen', 'Draht vorschieben']);
  assert.deepEqual(l.map(x => x.menge), ['', '2', '', '10', '', '', '', '']);
  assert.equal(l[1].bekannt, true, 'die Schleuse ist die vorhandene');
  assert.equal(l[3].bekannt, true);
  assert.ok(l.every(x => !x.dublette));
});
