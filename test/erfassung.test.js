'use strict';
/* Tests für die geführte Neuanlage (public/js/features/erfassung.js) und die
   dazugehörige Erweiterung des Merkmalskatalogs (merkmale.js).

   Geprüft wird gegen den ECHTEN mitgelieferten Katalog
   public/data/merkmale.json — die Vorlagen je Kategorie sollen an ihm tragen. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const KAT = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/merkmale.json'), 'utf8'));
const SRC = ['public/js/features/merkmale.js', 'public/js/features/erfassung.js']
  .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');

const ctx = vm.createContext({ console, fetch: undefined, loadJSON: () => null, saveJSON: () => {} });
vm.runInContext(SRC + `
;globalThis.__E = { katMitVorlagen, erfFelder, erfKategorien, erfHerstellerAusGtin, erfHerstellerListe,
  erfHerstellerKanon, erfNameVorschlag, erfArtenFuer, erfIstMaterialArt, erfFehlt, erfQuelleWort,
  merkSammeln, merkSetData, erfVorlagenAnwenden,
  get MERKKAT(){ return MERKKAT; }, get KATTPL(){ return KATTPL; }, set KATTPL(v){ KATTPL=v; } };`, ctx);
const E = ctx.__E;
const plain = v => JSON.parse(JSON.stringify(v));

/* ── Kategorien & Felder ─────────────────────────────────────────────── */

test('Katalog ohne Overlay bleibt inhaltlich gleich (Bestand unverändert)', () => {
  const k = E.katMitVorlagen(KAT, {});
  assert.equal(k.klassen.length, KAT.klassen.length);
  assert.equal(k.merkmale.length, KAT.merkmale.length);
  assert.deepEqual(plain(k.merkmale.map(m => m.klassen)), plain(KAT.merkmale.map(m => m.klassen)));
});

test('Neue Kategorie mit eigenem Merkmal — die Quelle wird nicht verändert', () => {
  const vorher = JSON.stringify(KAT);
  const k = E.katMitVorlagen(KAT, {
    klassen: { k_instrument: { label: 'Instrument', neu: true, dazu: ['e_maulform'], diff: ['e_maulform'] } },
    merkmale: { e_maulform: { label: 'Maulform', typ: 'liste', werte: ['gerade', 'gebogen'] } },
  });
  assert.equal(JSON.stringify(KAT), vorher, 'Quelle unverändert');
  const kl = k.klassen.find(x => x.id === 'k_instrument');
  assert.equal(kl.label, 'Instrument');
  const f = E.erfFelder(k, 'k_instrument');
  assert.deepEqual(plain(f.diff.map(d => d.id)), ['e_maulform']);
  assert.ok(f.allgemein.some(d => d.id === 'steril'), 'allgemeine Felder (steril …) gelten immer');
  assert.ok(f.allgemein.some(d => d.id === 'einmalgebrauch'));
});

test('Feld an- und abwählen, ★ (Differenzierung) umstellen', () => {
  const k = E.katMitVorlagen(KAT, { klassen: { ablation_rf: { aus: ['polzahl'], dazu: ['winkel_grad'], diff: ['ad_fr', 'nutzlaenge_cm'] } } });
  const f = E.erfFelder(k, 'ablation_rf');
  const ids = f.diff.concat(f.weitere).map(d => d.id);
  assert.ok(!ids.includes('polzahl'), 'abgewählt');
  assert.ok(ids.includes('winkel_grad'), 'dazugewählt');
  assert.deepEqual(plain(f.diff.map(d => d.id)), ['ad_fr', 'nutzlaenge_cm']);
});

test('Ablationskatheter (HF): die Vorlage fragt die Merkmale aus dem Schaubild ab', () => {
  const f = E.erfFelder(KAT, 'ablation_rf');
  const labels = f.diff.concat(f.weitere).map(d => d.label).join(' | ');
  for (const w of ['Nutzlänge', 'Steuerbar', 'Irrigation', 'Außendurchmesser']) assert.match(labels, new RegExp(w));
});

test('Kategorienliste ohne „Allgemein", alphabetisch', () => {
  const l = E.erfKategorien(KAT).map(k => k.label);
  assert.ok(!E.erfKategorien(KAT).some(k => k.id === 'allgemein'));
  assert.deepEqual(l, l.slice().sort((a, b) => a.localeCompare(b, 'de')));
});

test('Gewählte Kategorie wird gesucht — nicht die geratene; die Vermutung kommt mit', () => {
  E.merkSetData(KAT);
  const text = 'Boston Scientific\nIntellaNav MiFi XP\nTemperature Ablation Catheter\n8F 110 cm Large Curve\nSTERILE EO';
  const frei = E.merkSammeln(text, '', E.MERKKAT);
  assert.equal(frei.klasse, 'ablation_rf');
  const fest = E.merkSammeln(text, '', E.MERKKAT, 'ep_katheter');
  assert.equal(fest.klasse, 'ep_katheter', 'Wahl des Menschen gilt');
  assert.equal(fest.erkannt.klasse, 'ablation_rf', 'Vermutung für den Hinweis');
});

test('Eigenes Merkmal wird hinter seiner Beschriftung auf dem Etikett gefunden', () => {
  E.KATTPL = { klassen: { k_instr: { label: 'Instrument', neu: true, dazu: ['e_laenge', 'e_form', 'e_hm'] } },
    merkmale: {
      e_laenge: { label: 'Gesamtlänge', typ: 'mass', einheit: 'cm' },
      e_form: { label: 'Form', typ: 'text' },
      e_hm: { label: 'Hartmetall', typ: 'ja_nein', anker: ['TC', 'Hartmetall'] } } };
  E.merkSetData(KAT);
  const erg = E.merkSammeln('MAYO-HEGAR Nadelhalter\nGesamtlänge 16 cm\nForm: gerade\nTC\nSTERILE R', '', E.MERKKAT, 'k_instr');
  const w = {}; erg.merkmale.forEach(m => { w[m.id] = m.wert; });
  assert.equal(String(w.e_laenge), '16');
  assert.equal(w.e_form, 'gerade');
  assert.equal(w.e_hm, 'ja');
  E.KATTPL = { klassen: {}, merkmale: {} }; E.merkSetData(KAT);
});

/* ── Kennung ──────────────────────────────────────────────────────────── */

test('Hersteller aus dem GTIN-Präfix — nur bei eindeutigem Nachbarn', () => {
  const db = {
    '08714729906117': { gtin: '08714729906117', hersteller: 'Boston Scientific' },
    '08714729123450': { gtin: '08714729123450', hersteller: 'Boston Scientific' },
    '05414734000012': { gtin: '05414734000012', hersteller: 'Abbott' },
  };
  assert.equal(E.erfHerstellerAusGtin(db, '08714729555551').hersteller, 'Boston Scientific');
  assert.equal(E.erfHerstellerAusGtin(db, '04012345678901'), null, 'fremde Nummer → kein Vorschlag');
  db['08714729999990'] = { gtin: '08714729999990', hersteller: 'Andere GmbH' };
  assert.equal(E.erfHerstellerAusGtin(db, '08714729555551'), null, 'widersprüchliche Nachbarn → kein Vorschlag');
});

test('Herstellerliste ohne Schreibvarianten, gelesene Namen auf die Listen-Schreibweise', () => {
  const l = E.erfHerstellerListe(['Boston Scientific', 'Terumo'], { a: { hersteller: 'boston  scientific' }, b: { hersteller: 'Cordis' } });
  assert.deepEqual(plain(l), ['Boston Scientific', 'Cordis', 'Terumo']);
  assert.equal(E.erfHerstellerKanon('BOSTON SCIENTIFIC', l), 'Boston Scientific');
});

test('Namensvorschlag aus Kategorie + ★-Merkmalen', () => {
  const n = E.erfNameVorschlag('Ablationskatheter (HF)', [{ id: 'ad_fr', einheit: 'F' }, { id: 'kurve', einheit: null }], { ad_fr: '7', kurve: 'Large' });
  assert.equal(n, 'Ablationskatheter · 7 F · Large');
});

test('Was ist das? — im Standard alle Arten, in der Materialverwaltung nur Beschaffbares', () => {
  const liste = [{ key: 'material', beschaffbar: true }, { key: 'geraet', beschaffbar: true }, { key: 'hinweis', beschaffbar: false }];
  assert.equal(E.erfArtenFuer('standard', liste).length, 3);
  assert.deepEqual(plain(E.erfArtenFuer('verwaltung', liste).map(n => n.key)), ['material', 'geraet']);
  assert.equal(E.erfIstMaterialArt({ key: 'material', beschaffbar: true }), true);
  assert.equal(E.erfIstMaterialArt({ key: 'geraet', beschaffbar: true }), false, 'Gerät ist ein Exemplar');
  assert.equal(E.erfIstMaterialArt({ key: 'hinweis', beschaffbar: false }), false);
});

test('Vor dem Speichern: Kategorie, GTIN, REF und Hersteller sind Pflicht', () => {
  assert.deepEqual(plain(E.erfFehlt({ klasse: 'x', gtin: '1', ref: 'R', hersteller: 'H' })), [], 'ohne Prüfziffer-Funktion keine Prüfziffer-Meldung');
  assert.deepEqual(plain(E.erfFehlt({})), ['klasse', 'gtin', 'ref', 'hersteller']);
  assert.deepEqual(plain(E.erfFehlt({ klasse: 'x', ohneGtin: true, ohneRef: true, hersteller: 'H' })), [], 'bewusst ohne GTIN/REF');
});

test('Herkunft: nur der Schlüssel zählt, das Wort ist Anzeige', () => {
  assert.equal(E.erfQuelleWort({ art: 'barcode' }), 'Barcode (exakt)');
  assert.match(E.erfQuelleWort({ art: 'praefix' }), /bitte bestätigen/);
  assert.equal(E.erfQuelleWort({ art: 'nachschlag', text: 'AccessGUDID' }), 'AccessGUDID');
  assert.equal(E.erfQuelleWort(null), '');
});
