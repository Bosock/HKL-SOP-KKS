'use strict';
/* Tests für den Pflege-Weg (public/js/features/pflege.js).

   Der Pflege-Weg ist eine KLAMMER um vorhandene Werkzeuge. Kaputt geht an so
   etwas selten die einzelne Funktion — kaputt geht die Kette. Deshalb prüfen
   diese Tests vor allem die Stellen, an denen die Kette reißen könnte:

   ① Gruppierung: Drei Sätze aus der Word-Vorlage, die dasselbe Produkt
      meinen, müssen EIN Material sein — sonst pflegt man dreimal.
   ② Ehrliche Buchführung: „fertig" wird an den Daten abgelesen, nicht
      abgehakt. Ein Schritt, der offen ist, muss offen bleiben, bis die Daten
      etwas anderes sagen — oder ein Mensch „entfällt" gesagt hat.
   ③ Konfigurierbarkeit: Umbenennen darf keinen Haken verlieren, Ausblenden
      muss den Fortschritt ändern, ein eigener Schritt muss ein Handhaken
      sein und bleiben.
*/

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'public/js/features/pflege.js'), 'utf8');

/* Ein winziger, aber echter Bestand: zwei Standards, ein Material, das in
   beiden vorkommt — unter DREI verschiedenen Wortlauten. */
function standardBestand() {
  const zeile = (text, mk) => ({ anzeige_text: text, roh_text: text, material_key: mk, natur: 'material' });
  return [
    { id: 's1', titel: 'Koronarangiographie', rubriken: [
      { typ: 'material', sub_bereiche: [{ eintraege: [
        zeile('2x Radialschleuse 6F für den radialen Zugang', 'schleuse-6f'),
        zeile('Kompressen steril', 'kompressen'),
      ] }] },
    ] },
    { id: 's2', titel: 'PCI', rubriken: [
      { typ: 'material', sub_bereiche: [{ eintraege: [
        zeile('Radialschleuse 6F (oder Femoral)', 'schleuse-6f-alt'),
        zeile('Raumkontrolle durchführen', null),
      ] }] },
      { typ: 'ablauf', sub_bereiche: [{ eintraege: [ zeile('Patient lagern', 'lagern') ] }] },
    ] },
  ];
}

function umgebung(opt) {
  const o = opt || {};
  const store = Object.assign({}, o.store || {});
  const GTINDB = o.gtin || {};
  /* Die Zerlegung ist hier von Hand gestellt: Beide Schleusen-Zeilen führen
     auf denselben kanonischen Schlüssel. Genau das leistet features/matkey.js
     im Betrieb — hier wird nur das ERGEBNIS eingespeist. */
  const kanon = o.kanon || {
    'schleuse-6f': 'radialschleuse-6f',
    'schleuse-6f-alt': 'radialschleuse-6f',
    'kompressen': 'kompressen',
    'lagern': 'lagern',
  };
  const entschieden = o.entschieden || {};
  const ctx = vm.createContext({
    console,
    loadJSON: (k, d) => (k in store) ? JSON.parse(JSON.stringify(store[k])) : d,
    saveJSON: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
    esc: (s) => String(s == null ? '' : s),
    setTimeout: () => {},
    $: () => null,
    DB: { standards: o.standards || standardBestand() },
    GTINDB,
    ZERLDB: entschieden,
    cidOf: (sid, ri, si, ei) => [sid, ri, si, ei].join('|'),
    cidStd: (cid) => String(cid).split('|')[0],
    effMatKey: (e) => (e && e.material_key) ? (kanon[e.material_key] || e.material_key) : null,
    zerlTextKey: (e) => e ? ('t:' + String(e.anzeige_text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')) : null,
    matKeyBereit: () => o.zerlegungBereit !== false,
    canonOf: (k) => GTINDB[k] || null,
    berListe: () => o.bereiche || [],
    berVon: () => null,
    stdTitel: (s) => s.titel,
    stdHidden: () => false,
    qeGet: () => undefined,
    fmtEUR: (v) => String(v) + ' €',
  });
  vm.runInContext(SRC + `
    ;globalThis.__p = {
      materialien: pfMaterialien, cacheLeeren: pfCacheLeeren,
      liste: pfListe, stats: pfStats, luecken: pfLuecken, fertig: pfIstFertig,
      schritte: pflListe, alleSchritte: pflAlleSchritte,
      zustand: pfSchrittZustand,
      setzen: pflSetzen, aus: pflAus, wert: pflWert,
      entfaellt: pfEntfaelltSchalten, istEntfallen: pfEntfaellt,
      hand: pfHandSchalten, hatHand: pfHandHaken,
      fertigSchalten: pfFertigSchalten, fertigVon: pfFertigVon,
      eigenAnlegen: pflEigenAnlegen, eigenLoeschen: pflEigenLoeschen,
      schluessel: pflEigenSchluessel,
      imUmfang: pfImUmfang, umfangWort: pfUmfangWort,
      abZeile: pflegeAbZeile, laeuft: pflegeLaeuft,
    };
  `, ctx);
  return { p: ctx.__p, store, ctx };
}

/* ═══ ① Gruppierung ═══ */

test('drei Wortlaute, ein Material: gruppiert wird nach dem kanonischen Schlüssel', () => {
  const { p } = umgebung();
  const m = p.materialien();
  const schleuse = m.find(x => x.key === 'radialschleuse-6f');
  assert.ok(schleuse, 'die Schleuse muss als EIN Material erscheinen');
  assert.equal(schleuse.vorkommen, 2, 'beide Vorkommen zählen zu demselben Material');
  assert.equal(schleuse.standards.length, 2, 'sie steht in zwei Standards');
  assert.equal(schleuse.roh.length, 2, 'beide Wortlaute bleiben sichtbar — das ist die Arbeit');
});

test('Zeilen ohne Material und Rubriken ohne Material fallen heraus', () => {
  const { p } = umgebung();
  const keys = p.materialien().map(x => x.key);
  assert.ok(keys.indexOf('kompressen') >= 0);
  assert.ok(keys.indexOf('lagern') < 0, 'die Ablauf-Rubrik ist kein Materialbestand');
  assert.equal(keys.length, 2, 'nur Schleuse und Kompressen');
});

test('ausgeblendete Zeilen erscheinen nicht im Weg', () => {
  const { ctx, p } = umgebung();
  ctx.qeGet = (e, cid, prop) => (prop === 'hidden' && String(cid).indexOf('s1|') === 0) ? true : undefined;
  p.cacheLeeren();
  const schleuse = p.materialien().find(x => x.key === 'radialschleuse-6f');
  assert.equal(schleuse.vorkommen, 1, 'die ausgeblendete Stelle zählt nicht mit');
});

test('der Name kommt aus dem Stammsatz, sobald es einen gibt', () => {
  const { p } = umgebung({ gtin: { 'radialschleuse-6f': { name: 'Radialschleuse 6F Merit' } } });
  const m = p.materialien().find(x => x.key === 'radialschleuse-6f');
  assert.equal(m.name, 'Radialschleuse 6F Merit');
});

test('ohne Stammsatz gilt der häufigste Anzeigename, nicht der Schlüssel', () => {
  const { p } = umgebung();
  const m = p.materialien().find(x => x.key === 'kompressen');
  assert.equal(m.name, 'Kompressen steril');
});

/* ═══ ② Ehrliche Buchführung ═══ */

test('ohne Stammsatz ist jeder ablesbare Schritt offen', () => {
  const { p } = umgebung({ entschieden: {} });
  const m = p.materialien().find(x => x.key === 'kompressen');
  const offen = p.luecken(m).map(s => s.key);
  assert.ok(offen.indexOf('name') >= 0);
  assert.ok(offen.indexOf('foto') >= 0);
  assert.ok(offen.indexOf('etikett') >= 0);
  assert.equal(p.fertig(m), false);
});

test('ein gefülltes Feld schließt seinen Schritt — ohne dass jemand abhakt', () => {
  const { p } = umgebung({ gtin: { kompressen: { name: 'Kompresse 10x10', photo: 'data:x', ref: 'R1',
    hersteller: 'H', kategorie: 'Verbandmittel', lagerort: 'Regal A', preis: 0.4 } } });
  const m = p.materialien().find(x => x.key === 'kompressen');
  /* Über die VM-Grenze hinweg sind Arrays nicht identisch — deshalb über
     JSON vergleichen statt über deepEqual. */
  const offen = p.luecken(m).map(s => s.key);
  assert.equal(JSON.stringify(offen), JSON.stringify(['text']), 'nur der Text ist noch nicht entmischt');
});

test('ein Foto in der Galerie zählt wie ein Vorschaubild', () => {
  const { p } = umgebung({ gtin: { kompressen: { fotos: [{ src: 'data:x' }] } } });
  const m = p.materialien().find(x => x.key === 'kompressen');
  assert.equal(p.zustand(m, p.schritte().find(s => s.key === 'foto')), 'fertig');
});

test('entschiedene Texte schließen den Aufräum-Schritt', () => {
  const roh = 'Kompressen steril';
  const tk = 't:' + roh.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const { p } = umgebung({ entschieden: { [tk]: { art: 'produkt' } } });
  const m = p.materialien().find(x => x.key === 'kompressen');
  assert.equal(m.texteOffen.length, 0);
  assert.equal(p.zustand(m, p.schritte().find(s => s.key === 'text')), 'fertig');
});

test('fehlen die Zerlegungs-Regeln, wird nicht nach einem Text gefragt, den niemand aufräumen kann', () => {
  const { p } = umgebung({ zerlegungBereit: false });
  const m = p.materialien().find(x => x.key === 'kompressen');
  assert.equal(p.zustand(m, p.schritte().find(s => s.key === 'text')), 'fertig',
    'ohne Katalog gibt es hier nichts zu entscheiden — eine leere Frage wäre schlimmer als keine');
});

test('ohne angelegte Bereiche fragt der Bereichs-Schritt nichts', () => {
  const { p } = umgebung();
  const m = p.materialien().find(x => x.key === 'kompressen');
  assert.equal(p.zustand(m, p.schritte().find(s => s.key === 'bereich')), 'fertig');
  const { p: p2 } = umgebung({ bereiche: [{ key: 'steril', wort: 'steriler Tisch', symbol: '🧤' }] });
  const m2 = p2.materialien().find(x => x.key === 'kompressen');
  assert.equal(p2.zustand(m2, p2.schritte().find(s => s.key === 'bereich')), 'offen');
});

test('„entfällt" ist eine Entscheidung des Menschen und schlägt die Daten', () => {
  const { p, store } = umgebung();
  const m = p.materialien().find(x => x.key === 'kompressen');
  const vorher = p.luecken(m).length;
  p.entfaellt('kompressen', 'preis');
  assert.equal(p.istEntfallen('kompressen', 'preis'), true);
  assert.equal(p.luecken(m).length, vorher - 1);
  assert.ok(store.hkl_pflegestand.kompressen.entfaellt.preis, 'die Entscheidung wird gespeichert');
  p.entfaellt('kompressen', 'preis');
  assert.equal(p.istEntfallen('kompressen', 'preis'), false, 'und ist zurücknehmbar');
  assert.equal(store.hkl_pflegestand.kompressen, undefined, 'ohne Inhalt bleibt kein leerer Eintrag zurück');
});

test('„Material fertig" schließt es ab, auch wenn Schritte offen sind — und ist rücknehmbar', () => {
  const { p } = umgebung();
  const m = p.materialien().find(x => x.key === 'kompressen');
  assert.equal(p.fertig(m), false);
  p.fertigSchalten('kompressen');
  assert.equal(p.fertig(m), true);
  assert.ok(p.luecken(m).length > 0, 'die offenen Schritte bleiben sichtbar — nichts wird verschwiegen');
  p.fertigSchalten('kompressen');
  assert.equal(p.fertig(m), false);
});

test('die Kennzahlen zählen über den Umfang, nicht über alles', () => {
  const { p } = umgebung();
  const alle = p.stats({ art: 'alle' });
  assert.equal(alle.gesamt, 2);
  const eins = p.stats({ art: 'standard', wert: 's1' });
  assert.equal(eins.gesamt, 2, 'in s1 stehen Schleuse und Kompressen');
  const zwei = p.stats({ art: 'standard', wert: 's2' });
  assert.equal(zwei.gesamt, 1, 'in s2 steht nur die Schleuse');
  assert.equal(alle.fertig + alle.offen, alle.gesamt, 'fertig und offen ergeben zusammen das Ganze');
});

test('die Arbeitsliste sortiert nach Wirkung, auf Wunsch nach Name', () => {
  const { p } = umgebung({ gtin: { 'radialschleuse-6f': { name: 'Schleuse 6F' } } });
  const wirkung = p.liste({ art: 'alle' }, false, 'wirkung').map(x => x.key);
  assert.equal(wirkung[0], 'radialschleuse-6f', 'zwei Vorkommen schlagen eines');
  const name = p.liste({ art: 'alle' }, false, 'name').map(x => x.key);
  assert.equal(name[0], 'kompressen', '„Kompressen steril" steht vor „Schleuse 6F"');
});

test('„nur offene" blendet abgeschlossene Materialien aus', () => {
  const { p } = umgebung();
  p.fertigSchalten('kompressen');
  assert.equal(p.liste({ art: 'alle' }, true, 'name').length, 1);
  assert.equal(p.liste({ art: 'alle' }, false, 'name').length, 2);
});

/* ═══ ③ Konfigurierbarkeit ═══ */

test('ein ausgeblendeter Schritt fällt aus der Rechnung, nicht nur aus der Anzeige', () => {
  const { p } = umgebung();
  const m = p.materialien().find(x => x.key === 'kompressen');
  const vorher = p.luecken(m).length;
  p.setzen('preis', 'aus', true);
  assert.equal(p.aus('preis'), true);
  assert.ok(!p.schritte().some(s => s.key === 'preis'));
  assert.equal(p.luecken(m).length, vorher - 1);
});

test('Umbenennen ändert das Wort, nicht den Schlüssel', () => {
  const { p } = umgebung();
  p.setzen('foto', 'wort', 'Produktbild aufnehmen');
  const s = p.schritte().find(x => x.key === 'foto');
  assert.equal(s.wort, 'Produktbild aufnehmen');
  assert.equal(s.key, 'foto', 'der Schlüssel bleibt — sonst verlöre man jede Entscheidung dazu');
});

test('die Reihenfolge lässt sich vergeben und wird eingehalten', () => {
  const { p } = umgebung();
  p.setzen('foto', 'ord', -1);
  assert.equal(p.schritte()[0].key, 'foto');
});

test('ein eigener Schritt ist ein Handhaken und bleibt es', () => {
  const { p, store } = umgebung();
  const s = p.eigenAnlegen('Im Lagersystem angelegt', 'SAP-Nummer vergeben', '🗄');
  assert.equal(s.key, 'eigen-im-lagersystem-angelegt');
  const m = p.materialien().find(x => x.key === 'kompressen');
  const schritt = p.schritte().find(x => x.key === s.key);
  assert.equal(schritt.art, 'hand');
  assert.equal(p.zustand(m, schritt), 'offen');
  p.hand('kompressen', s.key);
  assert.equal(p.zustand(m, schritt), 'fertig');
  assert.ok(store.hkl_pflegestand.kompressen.hand[s.key]);
});

test('zwei eigene Schritte mit demselben Wort bekommen verschiedene Schlüssel', () => {
  const { p } = umgebung();
  const a = p.eigenAnlegen('Geprüft', '', '');
  const b = p.eigenAnlegen('Geprüft', '', '');
  assert.notEqual(a.key, b.key);
});

test('ein eigener Schritt ohne Namen entsteht gar nicht erst', () => {
  const { p } = umgebung();
  assert.equal(p.eigenAnlegen('   ', '', ''), null);
  assert.equal(p.eigenAnlegen('!!!', '', ''), null, 'aus reinen Sonderzeichen entsteht kein Schlüssel');
});

test('Löschen eines eigenen Schrittes lässt die gesetzten Haken unangetastet', () => {
  const { p, store } = umgebung();
  const s = p.eigenAnlegen('Geprüft', '', '');
  p.hand('kompressen', s.key);
  assert.equal(p.eigenLoeschen(s.key), true);
  assert.ok(!p.schritte().some(x => x.key === s.key));
  assert.ok(store.hkl_pflegestand.kompressen.hand[s.key], 'der Haken bleibt — versehentliches Löschen kostet nichts');
});

test('Umlaute und ß werden im Schlüssel zu Buchstaben, nicht zu Lücken', () => {
  const { p } = umgebung();
  assert.equal(p.schluessel('Größe geprüft'), 'eigen-groesse-geprueft');
});

test('das Umfangs-Wort ist lesbar, nicht die Kennung', () => {
  const { p } = umgebung();
  assert.equal(p.umfangWort({ art: 'alle' }), 'alle Materialien');
  assert.equal(p.umfangWort({ art: 'standard', wert: 's2' }), 'PCI');
  assert.equal(p.umfangWort({ art: 'standard', wert: 'gibtsnicht' }), 'ein Standard');
});

test('ausgeliefert wird nichts Eingestelltes — die Vorgabe steht im Code', () => {
  const { p, store } = umgebung();
  assert.equal(store.hkl_pflegeschritte, undefined);
  assert.equal(store.hkl_pflegeeigen, undefined);
  assert.ok(p.schritte().length >= 8, 'die eingebauten Schritte sind trotzdem alle da');
});
