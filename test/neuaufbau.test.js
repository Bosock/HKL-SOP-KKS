'use strict';
/* Reine Helfer des Neuaufbaus: Produkt-Stammsatz (features/produkt.js),
   Beziehungen (features/beziehungen.js), Editor (features/editor.js) und
   Notizen (features/notizen.js).

   Die Module werden so geladen, wie der Browser sie lädt — als Skripte im
   selben Namensraum —, mit den wenigen Nachbarn, die die reinen Funktionen
   brauchen (gtinKey, matPhotos, matSizeList aus scanner.js). */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const lies = (f) => fs.readFileSync(path.join(ROOT, 'public/js', f), 'utf8');

function umgebung() {
  const ctx = vm.createContext({
    console, TextEncoder, TextDecoder, Uint8Array, Uint32Array, DataView, ArrayBuffer,
    loadJSON: (k, d) => d, saveJSON: () => {},
    debounce: (fn) => fn, setTimeout: () => {},
    esc: (s) => String(s == null ? '' : s),
    RAUM: { id: 'neuaufbau', neu: true, basis: false, titel: 'Neuaufbau' },
    neuFrei: () => true,
    document: undefined, window: undefined,
  });
  /* scanner.js bringt gtinKey/matPhotos/matSizeList mit; der Rest der Datei
     braucht beim Laden nur loadJSON. */
  ['features/scanner.js', 'features/produkt.js', 'features/beziehungen.js', 'features/editor.js', 'features/notizen.js']
    .forEach(f => vm.runInContext(lies(f), ctx, { filename: f }));
  return ctx;
}
const U = umgebung();
/* Werte aus dem vm-Kontext haben eigene Array-/Object-Prototypen — verglichen
   wird deshalb der Inhalt (über JSON), nicht die Herkunft. */
const J = (x) => JSON.parse(JSON.stringify(x));
const gleich = (ist, soll, msg) => assert.deepEqual(J(ist), J(soll), msg);

/* ═══ Prüfziffer ═══ */
test('GTIN-Prüfziffer: gültige Nummern (8, 12, 13, 14 Stellen)', () => {
  for (const g of ['04015630006120', '4015630006120', '14015630006127', '00850000412347', '96385074', '036000291452'])
    assert.equal(U.gtinPruefzifferOk(g), true, g);
});
test('GTIN-Prüfziffer: Tippfehler und Zahlendreher fallen auf', () => {
  for (const g of ['04015630006121', '04015630006102', '4015630006', 'abc', '', null])
    assert.equal(U.gtinPruefzifferOk(g), false, String(g));
});

/* ═══ REF als Zweitschlüssel ═══ */
test('REF-Dubletten: gleiche REF in anderer Schreibweise, nicht das eigene Produkt', () => {
  const db = { a: { gtin: 'a', ref: 'IBI-81610' }, b: { gtin: 'b', ref: 'ibi 81610' }, c: { gtin: 'c', ref: 'IBI1910SA' } };
  gleich(U.refDubletten(db, 'IBI 81610', 'a').map(r => r.gtin), ['b']);
  assert.equal(U.refDubletten(db, '', 'a').length, 0, 'leere REF ist nie eine Dublette');
});

/* ═══ Synonyme ═══ */
test('Synonyme: getrennt, ohne Dubletten, ohne den Namen selbst', () => {
  gleich(U.produktSynonyme('CS-Katheter, Coronarsinus-Katheter; cs-katheter\nInquiry', 'Inquiry'), ['CS-Katheter', 'Coronarsinus-Katheter']);
  gleich(U.produktSynonyme('', 'x'), []);
});

/* ═══ Verpackungsstufen ═══ */
test('Verpackungsstufen: bereinigt, sortiert, höchstens eine Bestelleinheit', () => {
  const l = U.packungenNormal([
    { gtin: '24015630006124', menge: '40', bestell: true },
    { gtin: '14015630006127', menge: 10, bestell: true },
    { gtin: '14015630006127', menge: 12 },          // Dublette
    { gtin: '', menge: 5 },                          // ohne GTIN
    { gtin: '34015630006121', menge: 1 },            // keine Verpackung
  ]);
  gleich(l.map(p => [p.gtin, p.menge]), [['14015630006127', 10], ['24015630006124', 40]]);
  assert.equal(l.filter(p => p.bestell).length, 1);
});
test('Verpackungsstufe finden: Karton-GTIN führt zum Produkt der Einheit', () => {
  const db = { '04015630006120': { gtin: '04015630006120', packungen: [{ gtin: '14015630006127', menge: 10 }] } };
  const t = U.packungFinden(db, '14015630006127');
  assert.equal(t.id, '04015630006120');
  assert.equal(t.packung.menge, 10);
  assert.equal(U.packungFinden(db, '1401563000612'), null, 'ohne Treffer: null');
});
test('Bestelleinheit: markiert, sonst die kleinste Verpackung', () => {
  assert.equal(U.packungBestell({ packungen: [{ gtin: '24015630006124', menge: 40 }, { gtin: '14015630006127', menge: 10 }] }).menge, 10);
  assert.equal(U.packungBestell({ packungen: [{ gtin: '24015630006124', menge: 40, bestell: true }, { gtin: '14015630006127', menge: 10 }] }).menge, 40);
  assert.equal(U.packungBestell({}), null);
});

/* ═══ AccessGUDID ═══ */
test('AccessGUDID: Einheiten je Verpackung werden durch die Ebenen gerechnet', () => {
  const st = U.gudidStufen({ gudid: { device: { identifiers: { identifier: [
    { deviceId: '04015630006120', deviceIdType: 'Primary' },
    { deviceId: '14015630006127', deviceIdType: 'Package', containsDINumber: '04015630006120', pkgQuantity: 10, pkgType: 'Box' },
    { deviceId: '24015630006124', deviceIdType: 'Package', containsDINumber: '14015630006127', pkgQuantity: 4, pkgType: 'Case' },
  ] } } } });
  assert.equal(st.primaer, '04015630006120');
  gleich(st.stufen.map(s => [s.gtin, s.menge, s.art]), [['14015630006127', 10, 'Box'], ['24015630006124', 40, 'Case']]);
});
test('AccessGUDID: einzelne Kennung (kein Array) und fehlende Angaben', () => {
  const st = U.gudidStufen({ device: { identifiers: { identifier: { deviceId: '4015630006120', deviceIdType: 'Primary' } } } });
  assert.equal(st.primaer, '04015630006120', 'GTIN auf 14 Stellen normalisiert');
  gleich(st.stufen, []);
  assert.equal(U.gudidStufen(null), null);
  assert.equal(U.gudidStufen({ gudid: { device: {} } }), null);
});

/* ═══ Export ═══ */
test('Bildnamen außerhalb der App: GTIN_REF_rolle, je Rolle durchgezählt', () => {
  const rec = { gtin: '04015630006120', ref: 'IBI-81610', fotos: [
    { src: 'a', rolle: 'etikett' }, { src: 'b', rolle: 'produkt' }, { src: 'c', rolle: 'etikett' }, { src: 'd' }] };
  gleich(U.produktBildNamen(rec).map(x => x.name), [
    '04015630006120_IBI-81610_etikett.jpg', '04015630006120_IBI-81610_produkt.jpg',
    '04015630006120_IBI-81610_etikett_2.jpg', '04015630006120_IBI-81610_foto.jpg']);
  assert.equal(U.produktBildName({ gtin: 'm:abc', manual: true, ref: 'RM*RG5J40' }, 'produkt', 1, '.png'), 'ohneGTIN-abc_RM-RG5J40_produkt.png');
});
test('CSV: Semikolon-Zellen, Anführungszeichen nur wo nötig', () => {
  assert.equal(U.csvText([['a', 'b;c', 'd"e'], ['1', '', 'x\ny']]), 'a;"b;c";"d""e"\r\n1;;"x\ny"');
});
test('Export-Tabelle: Packungsgröße, Bestell-GTIN, Packungspreis, Zubehör', () => {
  const db = {
    '04015630006120': { gtin: '04015630006120', ref: 'IBI-81610', name: 'Inquiry', hersteller: 'Abbott', preis: 189.5,
      synonyme: ['CS-Katheter'], packungen: [{ gtin: '14015630006127', menge: 10, bestell: true }],
      beziehungen: [{ art: 'zubehoer', ziel: '04015630099993' }] },
    '04015630099993': { gtin: '04015630099993', ref: 'IBI1910SA', name: 'Kabel', hersteller: 'Abbott' },
  };
  const z = U.produktExportZeilen(db, id => db[id].name);
  assert.equal(z.length, 3);
  const inq = z.find(r => r[0] === '04015630006120');
  const k = z[0];                         /* die Kopfzeile */
  assert.equal(inq[k.indexOf('Packungsgröße (Stück)')], '10');
  assert.equal(inq[k.indexOf('GTIN Bestelleinheit')], '14015630006127');
  assert.equal(inq[k.indexOf('Packungspreis EUR')], '1895,00');
  assert.equal(inq[k.indexOf('Braucht dazu')], 'Kabel');
  const kab = z.find(r => r[0] === '04015630099993');
  assert.equal(kab[k.indexOf('Packungsgröße (Stück)')], '1', 'ohne Verpackungsstufe: die Einheit');
  assert.equal(kab[k.indexOf('Packungspreis EUR')], '', 'ohne Preis kein Packungspreis');
});

/* ═══ ZIP ═══ */
/* Liest ein ZIP zurück: Inhaltsverzeichnis → Dateien, Prüfsummen. */
function zipLesen(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let ende = buf.length - 22;
  assert.equal(dv.getUint32(ende, true), 0x06054b50, 'Endsatz');
  const n = dv.getUint16(ende + 10, true), vzPos = dv.getUint32(ende + 16, true);
  const aus = []; let p = vzPos;
  for (let i = 0; i < n; i++) {
    assert.equal(dv.getUint32(p, true), 0x02014b50, 'Verzeichniseintrag');
    const crc = dv.getUint32(p + 16, true), groesse = dv.getUint32(p + 24, true), nl = dv.getUint16(p + 28, true), lokal = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.slice(p + 46, p + 46 + nl));
    assert.equal(dv.getUint32(lokal, true), 0x04034b50, 'lokaler Kopf');
    const lnl = dv.getUint16(lokal + 26, true);
    const daten = buf.slice(lokal + 30 + lnl, lokal + 30 + lnl + groesse);
    aus.push({ name, daten, crc });
    p += 46 + nl;
  }
  return aus;
}
test('ZIP: lesbar, Namen in UTF-8, Prüfsummen stimmen', () => {
  const bild = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5]);
  const zip = U.zipErstellen([{ name: 'material.csv', daten: '﻿GTIN;REF\r\n1;ä' }, { name: 'bilder/04015630006120_IBI-81610_etikett.jpg', daten: bild }], new Date(2026, 9, 20, 12, 30, 10));
  const d = zipLesen(Buffer.from(zip));
  gleich(d.map(x => x.name), ['material.csv', 'bilder/04015630006120_IBI-81610_etikett.jpg']);
  gleich([...d[1].daten], [...bild]);
  d.forEach(x => assert.equal(x.crc, U.crc32(x.daten)));
  assert.equal(U.crc32(new TextEncoder().encode('123456789')), 0xCBF43926, 'CRC-32 Normwert');
});

/* ═══ Beziehungen ═══ */
test('Beziehungen: bereinigt — keine unbekannte Art, keine Dublette, nie auf sich selbst', () => {
  gleich(U.bzhNormal([{ art: 'zubehoer', ziel: 'b' }, { art: 'zubehoer', ziel: 'b' }, { art: 'quatsch', ziel: 'c' }, { art: 'zubehoer', ziel: 'a' }], 'a'),
    [{ art: 'zubehoer', ziel: 'b' }]);
});
test('Beziehungen: beide Richtungen, gespeichert nur eine', () => {
  const db = { kat: { beziehungen: [{ art: 'zubehoer', ziel: 'kab' }] }, kab: {}, kabV: { beziehungen: [{ art: 'aufbereitung', ziel: 'kab' }] } };
  gleich(U.bzhVon(db, 'kat').raus, [{ art: 'zubehoer', ziel: 'kab' }]);
  gleich(U.bzhVon(db, 'kab').rein.map(x => x.art + ':' + x.von).sort(), ['aufbereitung:kabV', 'zubehoer:kat']);
});
test('Zubehör, das im Standard fehlt', () => {
  const db = { kat: { beziehungen: [{ art: 'zubehoer', ziel: 'kab' }, { art: 'zubehoer', ziel: 'stecker' }] }, kab: {}, stecker: {} };
  gleich(U.bzhFehlendesZubehoer(db, 'kat', ['kat', 'kab']), ['stecker']);
  gleich(U.bzhFehlendesZubehoer(db, 'kat', ['kat', 'kab', 'stecker']), []);
});

/* ═══ Editor: nichts verrutscht ═══ */
test('Umschlüsseln: Änderungen wandern mit ihrer Zeile, Reste verwaister Plätze fallen weg', () => {
  const vorher = { 's|1|0|0': 'A', 's|1|0|1': 'B', 's|1|0|7': 'Rest einer gelöschten Zeile', 's|2|0|0': 'andere Rubrik', 'x|1|0|0': 'anderer Standard' };
  const map = { 's|1|0|0': null, 's|1|0|1': 's|1|0|0' };        // A weg, B rückt nach
  const bekannt = new Set(['s|1|0|0', 's|1|0|1']);
  gleich(U.edUmschluesseln(vorher, map, ['s|1|'], bekannt),
    { 's|1|0|0': 'B', 's|2|0|0': 'andere Rubrik', 'x|1|0|0': 'anderer Standard' });
});
test('Umschlüsseln: Tausch zweier Zeilen geht nicht verloren', () => {
  const vorher = { 's|1|0|0': 'A', 's|1|0|1': 'B' };
  const map = { 's|1|0|0': 's|1|0|1', 's|1|0|1': 's|1|0|0' };
  gleich(U.edUmschluesseln(vorher, map, ['s|1|'], new Set(Object.keys(vorher))), { 's|1|0|1': 'A', 's|1|0|0': 'B' });
});
test('Einsetzen: vor, hinter, an Position — der Block bleibt zusammen', () => {
  gleich(U.edListeSetzen(['a', 'b', 'c', 'd'], ['d'], { vor: 'b' }), ['a', 'd', 'b', 'c']);
  gleich(U.edListeSetzen(['a', 'b', 'c', 'd'], ['a', 'b'], { nach: 'c' }), ['c', 'a', 'b', 'd']);
  gleich(U.edListeSetzen(['a', 'b'], ['x'], { index: 0 }), ['x', 'a', 'b']);
  gleich(U.edListeSetzen(['a', 'b'], ['x'], { vor: 'fehlt' }), ['a', 'b', 'x'], 'unbekanntes Ziel: ans Ende');
});

/* ═══ Notizen ═══ */
test('Notizen als Datei: nach Art gegliedert, erledigt abgehakt, mit Ort', () => {
  const md = U.notizMarkdown([
    { art: 'wunsch', text: 'Zubehör in der Rüstliste', t: '2026-10-20T10:00:00Z', kontext: { std: { titel: 'TAVI' }, rubrik: 'Material' } },
    { art: 'fehler', text: 'Knopf zu klein', erledigt: true, t: '2026-10-21T10:00:00Z', kontext: {} },
  ]);
  assert.match(md, /## 💡 Wunsch\n\n- \[ \] Zubehör in der Rüstliste — 📍 Standard „TAVI" › Rubrik „Material" \(2026-10-20\)/);
  assert.match(md, /## 🐞 Fehler\n\n- \[x\] Knopf zu klein/);
});
