'use strict';
/* Tests für die Verbesserungen der Etikett-Erkennung (2026-11):
   Bildaufbereitung bei schwierigem Licht, Zuschnitt auf die günstige
   Schriftgröße, Symbol-Nachlese (REF-Kästchen), gewichtete REF-Abstimmung,
   „leer schlägt falsch" bei der REF, Qualitätshinweise, Mehrfachfotos und
   die tolerante Klassenerkennung.

   Wie client-helpers.test.js: Die Funktionen werden aus dem ECHTEN Quelltext
   gezogen (keine Kopien, die auseinanderlaufen) und im Sandkasten geprüft.
   Die Wirkung mit der echten Engine misst e2e/messen-ocr.js. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PUBLIC = path.join(__dirname, '..', 'public');
const SRC = ['js/features/ocr.js', 'js/features/matref.js', 'js/features/ocrwizard.js']
  .map(f => fs.readFileSync(path.join(PUBLIC, f), 'utf8')).join('\n');

function extractFn(name) {
  const sig = SRC.indexOf('function ' + name + '(');
  assert.notEqual(sig, -1, `function ${name} nicht gefunden`);
  let depth = 0;
  for (let j = SRC.indexOf('{', sig); j < SRC.length; j++) {
    if (SRC[j] === '{') depth++;
    else if (SRC[j] === '}') { depth--; if (depth === 0) return SRC.slice(sig, j + 1); }
  }
  throw new Error('Klammern unausgeglichen: ' + name);
}

const NAMEN = ['levenshtein', 'ocrFixDigits', 'extractLabelFields', 'ocrStretch', 'ocrBoxBlur', 'ocrRauschen',
  'ocrSchattenAusgleich', 'ocrAufbereiten', 'ocrZuschnitt', 'ocrLinksVon', 'ocrMarkerArt', 'ocrRefTokens',
  'ocrBandTokens', 'ocrRefEntscheid', 'ocrRefStimmen', 'ocrVoteFields', 'ocrQualitaetsHinweise', 'ocrNochEinFoto',
  'ocrZusammenfuehren', 'ocrLesungWort', 'refCanon', 'refPlausible', 'wizHinweise'];
const ctx = vm.createContext({});
vm.runInContext(
  "const REF_STOPP = ['STERILE','LOT','BATCH','QTY'];\n" +
  "const OCR_LESUNG_WORT = { voll:'Volltext', fein:'Feinlesung', ref:'REF-Streifen', symbol:'Symbol-Nachlese', kontrast:'Kontrast' };\n" +
  "const OCR_REF_MINDESTSICHERHEIT = 65;\n" +
  NAMEN.map(extractFn).join('\n') +
  '\n;globalThis.__F = {' + NAMEN.join(',') + '};', ctx);
const F = ctx.__F;

/* ── Auswertung des Etikett-Texts ─────────────────────────────────────── */

test('REF im ISO-Kästchen: der mitgelesene Rand („REF|", „[REF]") stört nicht mehr', () => {
  assert.equal(F.extractLabelFields('TERUMO\nREF| RSA60K10SQ\nLOT 231104A').ref, 'RSA60K10SQ');
  assert.equal(F.extractLabelFields('[REF] M0045000CL0\n[LOT] 33781593').ref, 'M0045000CL0');
  assert.equal(F.extractLabelFields('|REF| 451-506H0').ref, '451-506H0');
  assert.equal(F.extractLabelFields('LOT| 231104A').lot, '231104A');
});

test('Freie Muster: Maße, Postleitzahl und LOT werden NIE zum REF-Kandidaten', () => {
  const txt = 'Abbott\n 1001782\n LOT| 4012291\n.014" (0.36 mm) 190cm J-Tip\nAbbott Vascular, Santa Clara, CA 95054 USA\n6Fr 10cm 2-5-2mm';
  const toks = F.ocrRefTokens(txt).map(k => k.tok);
  for (const schlecht of ['10cm', '190cm', '6Fr', '2-5-2mm', '95054', '4012291']) {
    assert.ok(!toks.includes(schlecht), schlecht + ' darf kein Kandidat sein: ' + toks.join(','));
  }
  assert.ok(toks.includes('1001782'), 'die echte Nummer bleibt Kandidat');
});

test('French mit Lesefehler („SF (1.67 mm)") wird nur mit passender mm-Gegenprobe gelesen', () => {
  assert.equal(F.extractLabelFields('SF (1.67 mm) 100 cm').french, '5F');
  assert.equal(F.extractLabelFields('BF (2.67 mm)').french, '8F');
  /* Gegenprobe passt nicht → leer (leer schlägt falsch) */
  assert.equal(F.extractLabelFields('SF (2.90 mm)').french, '');
  /* ohne mm-Angabe keine Vermutung */
  assert.equal(F.extractLabelFields('SF Katheter').french, '');
});

test('Einheiten: „crn"/„rnm" hinter einer Ziffer werden zu cm/mm', () => {
  const f = F.extractLabelFields('7F 115 crn\nOD 2.0 rnm');
  assert.equal(f.laenge, '115 cm');
  assert.equal(f.dAussen, '2,0 mm');
});

/* ── REF-Entscheidung: leer schlägt falsch ───────────────────────────── */

const bestand = (bekannt) => (roh) => {
  const k = String(roh).toUpperCase().replace(/O/g, '0');
  const t = bekannt.find(b => b.toUpperCase().replace(/O/g, '0') === k);
  return t ? { ref: t, wie: 'zeichenklasse', sicher: true, kandidaten: [t] } : { ref: roh, wie: 'roh', sicher: false, kandidaten: [] };
};

test('REF mit Marker kommt ins Feld, auch wenn sie in keinem Bestand steht', () => {
  const e = F.ocrRefEntscheid('RSA60K10SQ', [{ tok: 'RSA60K10SQ', score: 100 }], bestand([]));
  assert.equal(e.ref, 'RSA60K10SQ');
});

test('Freies Muster OHNE Marker bleibt draußen — nur als Vorschlag', () => {
  const e = F.ocrRefEntscheid('', [{ tok: 'RSA60K10SQ', score: 40 }, { tok: 'X12', score: 40 }], bestand([]));
  assert.equal(e.ref, '');
  assert.deepEqual(Array.from(e.info.vorschlaege), ['RSA60K10SQ', 'X12']);
});

test('Freies Muster, das sich SICHER gegen den Bestand auflöst, darf ins Feld', () => {
  const e = F.ocrRefEntscheid('', [{ tok: 'M004SOOO', score: 40 }], bestand(['M004S000']));
  assert.equal(e.ref, 'M004S000');
  assert.equal(e.info.sicher, true);
});

test('Streifen-Lesung: Kästchenrand als „I"/„1" wird verworfen, die Nummer bleibt', () => {
  assert.deepEqual(Array.from(F.ocrBandTokens('IREFI 1001782').map(k => k.tok)), ['1001782']);
  assert.equal(F.ocrBandTokens('REF RSA60K10SQ')[0].score, 95);
});

test('REF-Abstimmung gewichtet mit der Wort-Sicherheit statt blind „die erste"', () => {
  const st = F.ocrRefStimmen([
    { quelle: 'ref', text: 'REF RSAGOK10SQ', words: [{ text: 'RSAGOK10SQ', conf: 41 }] },
    { quelle: 'voll', text: 'REF] RSA60K10SQ', words: [{ text: 'RSA60K10SQ', conf: 93 }] },
  ]);
  assert.equal(st[0].tok, 'RSA60K10SQ');
});

test('Symbol-Nachlese: REF/LOT tolerant erkannt, Schlüssel statt Fachwort', () => {
  assert.equal(F.ocrMarkerArt('[REF]'), 'ref');
  assert.equal(F.ocrMarkerArt('R3F'), 'ref');
  assert.equal(F.ocrMarkerArt('L0T'), 'lot');
  assert.equal(F.ocrMarkerArt('ISNI'), 'sn');
  assert.equal(F.ocrMarkerArt('MMTOT'), '');
  const r = F.ocrLinksVon({ x0: 300, y0: 100, x1: 600, y1: 140 }, 1000, 800);
  assert.ok(r.left + r.width < 300 && r.width >= 40 * 1.2, 'Ausschnitt liegt links der Nummer');
  assert.ok(r.top >= 90 && r.top + r.height <= 150, 'knapp in der Höhe');
  assert.equal(F.ocrLinksVon({ x0: 5, y0: 100, x1: 300, y1: 140 }, 1000, 800), null, 'kein Platz links → nichts');
});

/* ── Bildaufbereitung ─────────────────────────────────────────────────── */

/* Testbild: weißes Etikett mit schwarzen Strichen, rechts im Schatten. */
function etikettBild(w, h, schatten, rauschen) {
  const g = new Uint8ClampedArray(w * h); let s = 7;
  const rnd = () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const strich = (x % 20 < 3) && (y % 30 < 20);
    let v = strich ? 30 : 235;
    if (schatten) v *= 1 - 0.7 * (x / w);
    if (rauschen) v += (rnd() - 0.5) * 2 * rauschen;
    g[y * w + x] = v;
  }
  return g;
}

test('Rauschschätzung: sauberes Bild ≈ 0, verrauschtes deutlich höher', () => {
  const sauber = F.ocrRauschen(etikettBild(200, 120, false, 0), 200, 120);
  const laut = F.ocrRauschen(etikettBild(200, 120, false, 30), 200, 120);
  assert.ok(sauber < 2, 'sauber: ' + sauber);
  assert.ok(laut > 6, 'verrauscht: ' + laut);
});

test('Schattenausgleich: Papier links und rechts wird gleich hell, Schrift bleibt dunkel', () => {
  const w = 400, h = 120;
  const aus = F.ocrSchattenAusgleich(etikettBild(w, h, true, 0), w, h);
  const papier = (x) => aus[60 * w + x];          /* y=60 liegt zwischen zwei Strichreihen? → Zeile 25 ist Papier */
  const zeile = 25;                                 /* y%30=25 → kein Strich */
  const links = aus[zeile * w + 10], rechts = aus[zeile * w + 390];
  assert.ok(Math.abs(links - rechts) < 25, `Papier links ${links}, rechts ${rechts}`);
  assert.ok(aus[5 * w + 381] < 120, 'Strich im Schatten bleibt dunkel: ' + aus[5 * w + 381]);
  assert.ok(papier(10) >= 0);
});

test('Kastenweichzeichner: glättet, ändert die Bildgröße nicht', () => {
  const g = new Uint8ClampedArray([0, 0, 255, 0, 0, 0, 0, 255, 0, 0]);
  const b = F.ocrBoxBlur(g, 5, 2, 1);
  assert.equal(b.length, 10);
  assert.ok(b[2] < 255 && b[1] > 0);
  assert.equal(F.ocrBoxBlur(g, 5, 2, 0), g, 'Radius 0 → unverändert');
});

test('Zuschnitt: Rahmen um die sicheren Wörter + mittlere Wort-Höhe', () => {
  const w = (x, y, conf, text = 'ABCD') => ({ text, conf, bbox: { x0: x, y0: y, x1: x + 100, y1: y + 20 } });
  const z = F.ocrZuschnitt([w(1000, 1000, 90), w(1200, 1050, 88), w(1000, 1100, 80), w(1100, 1150, 70), w(10, 10, 20, '~~')], 4000, 3000);
  assert.equal(z.hMed, 20);
  assert.ok(z.x > 900 && z.x < 1000 && z.x + z.w > 1300, 'Rahmen um die Wörter, unsichere ignoriert');
  assert.equal(F.ocrZuschnitt([w(1, 1, 90)], 100, 100), null, 'zu wenig Sicheres → kein Zuschnitt');
});

/* ── Qualität und Mehrfachfotos ───────────────────────────────────────── */

test('Qualitätshinweise: konkret je Ursache, still bei gutem Bild', () => {
  assert.deepEqual(Array.from(F.ocrQualitaetsHinweise({ hell: 140, rauschen: 1, grell: 0.01, texthoehe: 40, schaerfe: 200, konfidenz: 90 })), []);
  assert.match(F.ocrQualitaetsHinweise({ rauschen: 14 })[0], /Wenig Licht/);
  assert.match(F.ocrQualitaetsHinweise({ grell: 0.3 })[0], /Spiegelung/);
  assert.match(F.ocrQualitaetsHinweise({ texthoehe: 12 })[0], /näher heran/);
  assert.match(F.ocrQualitaetsHinweise({ schaerfe: 10 })[0], /Unscharf/);
});

test('Weiteres Foto wird angeboten, wenn die REF fehlt — nicht bei sicherem Ergebnis', () => {
  const gut = { fields: { ref: 'X1', hersteller: 'Terumo', french: '6F' }, refInfo: { sicher: true, wie: 'exakt' }, qualitaet: [{}] };
  assert.equal(F.ocrNochEinFoto(gut), false);
  assert.equal(F.ocrNochEinFoto({ fields: { hersteller: 'Terumo', french: '6F' }, refInfo: { sicher: false }, qualitaet: [{}] }), true);
});

test('Mehrere Fotos: die Mehrheit über alle Aufnahmen entscheidet', () => {
  const foto = (ref, conf, fr) => ({ lesungen: [{ quelle: 'voll', text: `TERUMO\nREF ${ref}\n${fr} 10 cm`, confidence: conf,
    words: [{ text: ref, conf }] }], barcode: null, markerLot: [], quali: { konfidenz: conf } });
  const erg = F.ocrZusammenfuehren([foto('RSAGOK10SQ', 60, '6F'), foto('RSA60K10SQ', 85, '6F'), foto('RSA60K10SQ', 80, '8F')]);
  assert.equal(erg.fields.ref, 'RSA60K10SQ');
  assert.equal(erg.fields.french, '6F');
  assert.equal(erg.fotos, 3);
  assert.equal(erg.qualitaet.length, 3);
});

test('Mehrere Fotos: als LOT erkannte Nummer wird nie zur REF', () => {
  const erg = F.ocrZusammenfuehren([{ lesungen: [{ quelle: 'voll', text: 'Abbott\n 4012291', confidence: 80, words: [] }],
    markerLot: ['4012291'], quali: {} }]);
  assert.equal(erg.fields.ref, '');
  assert.ok(!(erg.refInfo.vorschlaege || []).includes('4012291'));
});

test('Assistent sammelt Hinweise aller Fotos ohne Doppelungen', () => {
  ctx.ocrQualitaetsHinweise = F.ocrQualitaetsHinweise;
  const h = F.wizHinweise({ erg: { qualitaet: [{ rauschen: 14 }, { rauschen: 12, texthoehe: 10 }] } });
  assert.equal(h.length, 2);
});

test('Unsicher gelesene REF (nicht im Bestand) wird nur vorgeschlagen, nicht eingetragen', () => {
  const foto = (conf) => ({ lesungen: [{ quelle: 'voll', text: 'REF M0045000CLO', confidence: conf,
    words: [{ text: 'M0045000CLO', conf }] }], markerLot: [], quali: {} });
  const unsicher = F.ocrZusammenfuehren([foto(46)]);
  assert.equal(unsicher.fields.ref, '');
  assert.equal(unsicher.refInfo.unsicherGelesen, true);
  assert.equal(unsicher.refInfo.vorschlaege[0], 'M0045000CLO');
  const sicher = F.ocrZusammenfuehren([foto(92)]);
  assert.equal(sicher.fields.ref, 'M0045000CLO');
});

test('Gleiche Fehllesung auf mehreren Fotos macht die REF NICHT sicher', () => {
  const foto = (conf) => ({ lesungen: [{ quelle: 'voll', text: 'REF M0045000CLO', confidence: conf,
    words: [{ text: 'M0045000CLO', conf }] }], markerLot: [], quali: {} });
  assert.equal(F.ocrZusammenfuehren([foto(50), foto(55), foto(52)]).fields.ref, '');
});
