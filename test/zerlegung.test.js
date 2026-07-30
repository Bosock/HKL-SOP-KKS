'use strict';
/* Tests für die Zerlegung (public/js/features/zerlegung.js).

   Besonderheit dieser Suite — wie schon beim Merkmalskatalog: Die Prüfmuster
   sind KEINE erfundenen Beispiele. Es sind wörtlich abgeschriebene Zeilen aus
   public/data/hkl_standards_export.json, also genau der Text, der heute im
   Herzkatheterlabor auf dem Tablet steht.

   Damit prüft die Suite das, worauf es ankommt — ob die Zerlegung an den
   echten Word-Erbschaften trägt — und nicht, ob eine ausgedachte Zeichenkette
   zu einem ausgedachten Muster passt.

   Am Ende steht ein Gesamtlauf über ALLE 1.827 nicht-Fließtext-Einträge mit
   Mindestquoten. Wer eine Regel in zerlegung.json kaputt macht, sieht es hier
   sofort — auch wenn die Einzelfälle noch grün sind. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const KAT = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/zerlegung.json'), 'utf8'));
const SRC = fs.readFileSync(path.join(ROOT, 'public/js/features/zerlegung.js'), 'utf8');

const ctx = vm.createContext({ console });
vm.runInContext(SRC + `
;globalThis.__Z = { zerlege, zerlPutz, zerlKlammern, zerlKlammerKlasse, zerlTaetigkeit,
  zerlHandlungsWort, zerlBedingung, zerlOrt, zerlZiel, zerlZweck, zerlAlternativen,
  zerlDosis, zerlSlug, zerlKernPlausibel, zerlKurz, zerlFelder, zerlVereinen,
  zerlBilanz, zerlSetData };
;globalThis.__setKat = (k)=>{ ZERLKAT = k; };`, ctx);
const Z = ctx.__Z;
ctx.__setKat(KAT);

/* Bequemer Aufruf: nur der Anzeigetext, optional Menge und Unterkategorie. */
const zerl = (text, menge, uk) => Z.zerlege({ anzeige_text: text, menge: menge || null, unterkategorie: uk || null }, KAT);

/* ═══════════════════════════════════════════════════════════════
   1. Der Fall, der alles ausgelöst hat: EIN Wirkstoff, FÜNF Materialien
   ═══════════════════════════════════════════════════════════════ */

test('Heparin: Produkt, Dosis und Ziel werden getrennt', () => {
  /* Echte Zeile. Heute ist das ein eigenes „Material" namens
     „1ml heparin in die große coro-set-schale". */
  const z = zerl('1ml Heparin in die große Coro-Set-Schale');
  assert.equal(z.art, 'produkt');
  /* Der Wirkstoff ist das Produkt. Die Menge ist Verwendung, nicht Identität —
     sonst sind „1ml Heparin" und „2ml Heparin" zwei verschiedene Materialien. */
  assert.equal(z.produkt.name, 'Heparin');
  assert.equal(z.groesse, '1ml');
  assert.equal(z.ziel, 'große Coro-Set-Schale');
});

test('Heparin-Varianten fallen auf denselben Produktkern zusammen', () => {
  /* Der Kern von „1ml Heparin in die …" und „2ml Heparin in die …" darf sich
     nur in der Dosis unterscheiden — nicht in der Identität. */
  const a = zerl('1ml Heparin in die große Coro-Set-Schale');
  const b = zerl('2ml Heparin in die große Coro-Set-Schale');
  assert.equal(a.produkt.slug, b.produkt.slug, 'EIN Material');
  assert.notEqual(a.groesse, b.groesse, 'zwei Mengen');
  assert.equal(a.ziel, b.ziel);
});

/* ═══════════════════════════════════════════════════════════════
   2. Import-Artefakte: „(en)" ist keine Produkteigenschaft
   ═══════════════════════════════════════════════════════════════ */

test('Perfusor(en): die Pluralklammer wird verworfen, nicht gespeichert', () => {
  const z = zerl('Perfusor(en) für Sedierung');
  assert.equal(z.art, 'produkt');
  assert.equal(z.produkt.name, 'Perfusor');
  assert.equal(z.zweck, 'Sedierung');
  /* Nirgendwo darf „en" als Wert auftauchen — 25× steht es heute als
     Spezifikation in der App. */
  assert.equal(z.farbe, null);
  assert.equal(z.praeparat, null);
  assert.ok(!(z.erlaeuterung || []).includes('en'));
  assert.ok(z.spur.some(s => /Artefakt/.test(s.schritt)));
});

test('zerlKlammerKlasse erkennt die bekannten Import-Artefakte', () => {
  ['en', 'e', 'n', 's', 'innen'].forEach(a => {
    assert.equal(Z.zerlKlammerKlasse(a, KAT), 'artefakt', a);
  });
});

/* ═══════════════════════════════════════════════════════════════
   3. Tätigkeiten sind keine Geräte
   ═══════════════════════════════════════════════════════════════ */

test('Raumkontrolle ist eine Tätigkeit, kein Gerät', () => {
  /* 44× im Bestand — der viertgrößte „Gerätebestand" des Hauses. */
  const z = zerl('Raumkontrolle');
  assert.equal(z.art, 'taetigkeit');
  assert.equal(z.produkt, null);
});

test('Infinitiv am Zeilenende macht die Zeile zur Tätigkeit', () => {
  const z = zerl('Tuchfixierung für OP-Tuch-Stange am Kopfteil montieren');
  assert.equal(z.art, 'taetigkeit');
  assert.equal(z.produkt, null);
});

test('C-Bogen-Fall: der Zweck darf das Verb nicht verdecken', () => {
  /* Regression. Zuerst wurde „auf die rechte Seite rotieren" vom Ziel-Muster
     verschluckt und die Zeile als PRODUKT ausgegeben. Deshalb prüft die
     Zerlegung die Tätigkeit nach dem Zweck, aber vor dem Ziel. */
  const z = zerl('C-Bogen 90° um die eigene Achse auf die rechte Seite rotieren für Implantation / Aggregat links!');
  assert.equal(z.art, 'taetigkeit');
  assert.equal(z.produkt, null);
});

test('Handlungswort im Satz rettet vor „unklar"', () => {
  const z = zerl('Dreifache Wischdesinfektion des OP-Gebietes mit Softasept® N gefärbt');
  assert.equal(z.art, 'taetigkeit');
  assert.ok(z.rest, 'die Zeile bleibt sichtbar');
  assert.equal(z.sicher, false, 'aber sie gilt nicht als gesichert');
});

test('ein Produktname mit Handlungswort-Anteil bleibt Produkt', () => {
  const z = zerl('Sterile Abdeckung groß');
  assert.equal(z.art, 'produkt');
  assert.equal(z.produkt.name, 'Sterile Abdeckung groß');
});

/* ═══════════════════════════════════════════════════════════════
   4. Die Klammer trägt sechs verschiedene Sachverhalte
   ═══════════════════════════════════════════════════════════════ */

test('Klammer = Farbe', () => {
  const z = zerl('20 Luer-Solo (grüne) Spritze', '1x', 'Material aus dem Raum');
  assert.equal(z.farbe, 'grüne');
  assert.equal(z.produkt.name, '20 Luer-Solo Spritze');
});

test('Klammer = Präparat', () => {
  const z = zerl('Lokale (Lidocain 1%)', '1x', 'Material aus dem Vorbereitungsraum');
  assert.equal(z.praeparat, 'Lidocain 1%');
  assert.equal(z.produkt.name, 'Lokale');
});

test('Klammer = Standort', () => {
  const z = zerl('7F Peel-Off-Schleuse (Saal 3 Schrank rechts an der Wand)', '1x', 'Material aus dem Raum');
  assert.equal(z.ort, 'Saal 3 Schrank rechts an der Wand');
  assert.equal(z.produkt.name, 'Peel-Off-Schleuse');
  assert.equal(z.groesse, '7F');
});

test('Klammer = Anweisung', () => {
  const z = zerl('Programmer neben Notfallwagen (muss an den Defi angeschlossen werden)');
  assert.equal(z.hinweis, 'muss an den Defi angeschlossen werden');
  assert.equal(z.art, 'produkt');
  assert.ok(!z.produkt.name.includes('muss'));
});

test('Klammer = Bedingung', () => {
  const z = zerl('0er ETHIBONDEXCEL™ für die Fixierung des Gerätes (entfällt oft)');
  assert.equal(z.bedingung, 'entfällt oft');
  assert.equal(z.zweck, 'die Fixierung des Gerätes');
  assert.equal(z.produkt.name, 'ETHIBONDEXCEL™');
  assert.equal(z.groesse, '0er');
});

test('Klammer = Erläuterung (nicht raten, benennen)', () => {
  const z = zerl('Ultraschallgerät mit Linear-Schallkopf (Gefäß-Schallkopf)');
  assert.ok(z.erlaeuterung.includes('Gefäß-Schallkopf'));
  assert.equal(z.produkt.name, 'Ultraschallgerät mit Linear-Schallkopf');
});

test('Klammer = Maß', () => {
  assert.equal(Z.zerlKlammerKlasse('6F', KAT), 'mass');
  assert.equal(Z.zerlKlammerKlasse('150cm', KAT), 'mass');
});

/* ═══════════════════════════════════════════════════════════════
   5. Zwei Produkte in einer Zeile
   ═══════════════════════════════════════════════════════════════ */

test('Sauerstoffbrille / Maske sind zwei Dinge', () => {
  const z = zerl('Sauerstoffbrille / Maske');
  assert.equal(z.produkt.name, 'Sauerstoffbrille');
  assert.equal(z.alternativen.length, 1);
  assert.equal(z.alternativen[0], 'Maske');
});

test('„oder" trennt ebenfalls', () => {
  const z = zerl('4-0er MONOCRYL™ Hautnaht oder Steri-Strips™', '1x', 'Material auf Ansage');
  assert.equal(z.produkt.name, 'MONOCRYL™ Hautnaht');
  assert.equal(z.groesse, '4-0er');
  assert.ok(z.alternativen.includes('Steri-Strips™'));
});

test('Maßbrüche werden NICHT getrennt', () => {
  /* „4/0" ist eine Nahtstärke, kein „4 oder 0". */
  const z = Z.zerlAlternativen('4/0 Prolene Naht', KAT);
  assert.equal(z.weitere.length, 0);
  assert.equal(z.erste, '4/0 Prolene Naht');
});

test('gleiche Schleuse in drei Größen ist EIN Produkt', () => {
  /* Der teuerste Einzelbefund der Analyse: Solange die Größe im Namen steht,
     ist jede Größe ein eigenes Material — mit eigenem Foto, eigenem Preis,
     eigenem Merkmalssatz. Die Größe gehört zu den Merkmalen. */
  const a = zerl('6F Peel-Off-Schleuse');
  const b = zerl('7F Peel-Off-Schleuse');
  const c = zerl('9F Peel-Off-Schleuse');
  assert.equal(a.produkt.slug, b.produkt.slug);
  assert.equal(b.produkt.slug, c.produkt.slug);
  assert.equal(a.groesse, '6F');
  assert.equal(c.groesse, '9F');
});

test('die Größe wird abgetrennt, aber nie verschluckt', () => {
  const z = zerl('500ml NaCl-Flasche');
  assert.equal(z.produkt.name, 'NaCl-Flasche');
  assert.equal(z.groesse, '500ml');
  assert.ok(z.mass.includes('500ml'), 'sie steht bei den Maßen');
  assert.ok(z.spur.some(s => s.schritt === 'Größe'), 'und in der Spur');
});

test('eine reine Größenangabe bleibt unangetastet', () => {
  /* Aus „500ml" allein darf kein leerer Produktname werden. */
  const z = zerl('500ml');
  assert.equal(z.groesse, null);
  assert.ok(z.produkt === null || z.produkt.name === '500ml');
});

test('Zahlen, die zum Namen gehören, bleiben stehen', () => {
  const z = zerl('Hochdruck-3-Wegehahn');
  assert.equal(z.groesse, null);
  assert.equal(z.produkt.name, 'Hochdruck-3-Wegehahn');
});

/* ═══════════════════════════════════════════════════════════════
   6. Ort — aus dem Text und aus der Unterkategorie
   ═══════════════════════════════════════════════════════════════ */

test('Ort aus dem Text', () => {
  const z = zerl('Benötigte Klappen aus dem Keller holen');
  assert.equal(z.art, 'taetigkeit', 'holen ist ein Tun');
});

test('Ort aus der Unterkategorie wird als solcher vermerkt', () => {
  const z = zerl('Coro-Set', '1x', 'Material aus dem Vorbereitungsraum');
  assert.equal(z.ort, 'Vorbereitungsraum');
  assert.ok(z.spur.some(s => /Unterkategorie/.test(s.schritt)),
    'der Mensch muss sehen, dass die Angabe aus der Gruppe stammt');
});

test('„Material auf Ansage" ist eine Bedingung, kein Ort', () => {
  const z = zerl('Ampulle Fentanyl', '1x', 'Material auf Ansage');
  assert.equal(z.ort, null);
  assert.equal(z.bedingung, 'auf Ansage');
});

/* ═══════════════════════════════════════════════════════════════
   7. Nichts verschlucken
   ═══════════════════════════════════════════════════════════════ */

test('unverstandene Zeilen kommen als Rest zurück, nicht als Produkt', () => {
  const z = zerl('500ml NaCl Infusion mit 1,7ml Adenosin (Adrekar) versetzen. Anschließend einen MiniSpike');
  assert.notEqual(z.art, 'produkt');
  assert.ok(z.rest, 'der Text bleibt sichtbar');
});

test('leerer Text erfindet nichts', () => {
  const z = zerl('');
  assert.equal(z.art, 'unklar');
  assert.equal(z.produkt, null);
});

test('kein Eintrag: keine Ausnahme', () => {
  assert.doesNotThrow(() => Z.zerlege(null, KAT));
  assert.equal(Z.zerlege(null, KAT).art, 'unklar');
});

test('ohne Katalog stürzt nichts ab', () => {
  const leer = { putzen: [], artefakte: [], taetigkeit: {}, bedingung: {}, anweisung: {},
    ort: {}, ziel: {}, zweck: {}, alternative: {}, menge: {}, farbe: {}, praeparat: {},
    eigenschaft: {}, mass: {}, kern: {}, art_regeln: {} };
  const z = Z.zerlege({ anzeige_text: 'Coro-Set' }, leer);
  assert.equal(z.art, 'produkt');
  assert.equal(z.produkt.name, 'Coro-Set');
});

test('kaputtes Muster im Katalog bremst nicht die ganze Zerlegung', () => {
  const kaputt = JSON.parse(JSON.stringify(KAT));
  kaputt.ziel.muster = ['\\b(unbalanced'];
  assert.doesNotThrow(() => Z.zerlege({ anzeige_text: 'Coro-Set' }, kaputt));
});

/* ═══════════════════════════════════════════════════════════════
   8. Putzen und Schlüsselbildung
   ═══════════════════════════════════════════════════════════════ */

test('Word-Reste werden entfernt', () => {
  assert.equal(Z.zerlPutz('9. 🔲 Wischdesinfektion', KAT), 'Wischdesinfektion');
  assert.equal(Z.zerlPutz('  Coro-Set   Schale ', KAT), 'Coro-Set Schale');
});

test('zerlSlug macht Schreibvarianten vergleichbar', () => {
  assert.equal(Z.zerlSlug('Hämostaseventil MAP 152'), Z.zerlSlug('Hämostaseventil MAP152'));
  assert.equal(Z.zerlSlug('JR 4 Diagnostikkatheter'), Z.zerlSlug('JR4 Diagnostikkatheter'));
  assert.equal(Z.zerlSlug('Mersilene™'), 'mersilene');
});

test('zerlSlug macht aus einem Tippfehler KEIN Synonym', () => {
  /* „Coro" und „Koro" sind verschieden — das ist ein Tippfehler und gehört in
     die Dublettenprüfung, nicht in die Normalisierung. Sonst verschwindet der
     Fehler still, statt korrigiert zu werden. */
  assert.notEqual(Z.zerlSlug('Coro-Set-Schale'), Z.zerlSlug('Koro-Set-Schale'));
});

test('zerlKernPlausibel lehnt Sätze ab', () => {
  assert.equal(Z.zerlKernPlausibel('Coro-Set', KAT).ok, true);
  assert.equal(Z.zerlKernPlausibel('', KAT).ok, false);
  assert.equal(Z.zerlKernPlausibel('nach dem die Flüssigkeiten mit Heparin versetzt sind das überschüssige', KAT).ok, false);
  assert.equal(Z.zerlKernPlausibel('die große Schale', KAT).ok, false, 'beginnt mit Artikel');
});

/* ═══════════════════════════════════════════════════════════════
   9. Der Mensch schlägt alles
   ═══════════════════════════════════════════════════════════════ */

test('zerlVereinen: Bestätigtes wird nie überschrieben', () => {
  const vorschlag = zerl('Lokale (Lidocain 1%)', '1x');
  const bestaetigt = { produkt: { name: 'Lidocain 1 % Ampulle', slug: 'lidocain 1 ampulle' } };
  const v = Z.zerlVereinen(vorschlag, bestaetigt);
  assert.equal(v.produkt.name, 'Lidocain 1 % Ampulle');
  assert.equal(v.praeparat, 'Lidocain 1%', 'Leeres füllt der Vorschlag');
  assert.equal(v.quelle, 'mensch');
  assert.equal(v.sicher, true);
});

test('zerlVereinen ohne Bestätigung liefert den Vorschlag', () => {
  const vorschlag = zerl('Coro-Set');
  const v = Z.zerlVereinen(vorschlag, null);
  assert.equal(v.quelle, 'vorschlag');
  assert.equal(v.produkt.name, 'Coro-Set');
});

/* ═══════════════════════════════════════════════════════════════
   10. Anzeige
   ═══════════════════════════════════════════════════════════════ */

test('zerlKurz fasst eine Zerlegung in einer Zeile zusammen', () => {
  const z = zerl('1ml Heparin in die große Coro-Set-Schale');
  const s = Z.zerlKurz(z);
  assert.ok(s.includes('Heparin'));
  assert.ok(s.includes('→'), 'das Ziel wird als Pfeil gezeigt');
});

test('zerlKurz kennzeichnet Tätigkeit und Unklares', () => {
  assert.ok(Z.zerlKurz(zerl('Raumkontrolle')).startsWith('🔧'));
  assert.ok(Z.zerlKurz(zerl('')).startsWith('❓'));
});

test('zerlFelder zählt, was gefüllt wurde', () => {
  const f = Z.zerlFelder(zerl('0er ETHIBONDEXCEL™ für die Fixierung des Gerätes (entfällt oft)', '1x'));
  assert.ok(f.includes('produkt') && f.includes('zweck') && f.includes('bedingung') && f.includes('menge'));
});

/* ═══════════════════════════════════════════════════════════════
   11. GESAMTLAUF über den echten Bestand
   ═══════════════════════════════════════════════════════════════ */

const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/hkl_standards_export.json'), 'utf8'));
const ALLE = [];
DB.standards.forEach(s => (s.rubriken || []).forEach(r => (r.sub_bereiche || []).forEach(sb =>
  (sb.eintraege || []).forEach(e => {
    if (!e.ist_fliesstext && ['material', 'geraet', 'medikament'].includes(e.natur)) ALLE.push(e);
  }))));

test('Gesamtlauf: der echte Bestand wird verarbeitet', () => {
  assert.ok(ALLE.length > 1500, `erwartet >1500 Einträge, gefunden ${ALLE.length}`);
  const zs = ALLE.map(e => Z.zerlege(e, KAT));
  const b = Z.zerlBilanz(zs);

  /* Mindestquoten. Sie dürfen steigen, aber nicht fallen — eine Regeländerung,
     die den Bestand schlechter zerlegt, fällt hier auf. */
  assert.ok(b.quote >= 95, `Zuordnungsquote ${b.quote} % (erwartet ≥ 95 %)`);
  assert.ok(b.produkt / b.gesamt >= 0.85, `Produktanteil ${(100 * b.produkt / b.gesamt).toFixed(0)} % (erwartet ≥ 85 %)`);
  assert.ok(b.taetigkeit >= 100, `Tätigkeiten ${b.taetigkeit} (erwartet ≥ 100 — sie stehen heute als Geräte im Bestand)`);
  assert.ok(b.felder / b.gesamt >= 2.0,
    `Ø ${(b.felder / b.gesamt).toFixed(1)} Felder je Eintrag (erwartet ≥ 2.0 — vorher war es genau 1: der Name)`);
});

test('Gesamtlauf: keine Zerlegung wirft eine Ausnahme', () => {
  assert.doesNotThrow(() => ALLE.forEach(e => Z.zerlege(e, KAT)));
});

test('Gesamtlauf: jedes Produkt hat einen nicht-leeren Schlüssel', () => {
  const zs = ALLE.map(e => Z.zerlege(e, KAT)).filter(z => z.art === 'produkt');
  const ohne = zs.filter(z => !z.produkt || !z.produkt.slug);
  assert.equal(ohne.length, 0, `${ohne.length} Produkte ohne Schlüssel`);
});

test('Gesamtlauf: die Zerlegung verkürzt die Identität deutlich', () => {
  /* Der eigentliche Zweck: aus Sätzen werden Produkte. Gemessen an der
     mittleren Wortzahl des Schlüssels gegenüber dem alten material_key. */
  const mitKey = ALLE.filter(e => e.material_key);
  const altWoerter = mitKey.reduce((s, e) => s + String(e.material_key).split(/\s+/).length, 0) / mitKey.length;
  const zs = mitKey.map(e => Z.zerlege(e, KAT)).filter(z => z.art === 'produkt');
  const neuWoerter = zs.reduce((s, z) => s + z.produkt.slug.split(/\s+/).length, 0) / zs.length;
  assert.ok(neuWoerter < altWoerter,
    `neuer Schlüssel Ø ${neuWoerter.toFixed(2)} Wörter, alter Ø ${altWoerter.toFixed(2)} — er muss kürzer sein`);
});

test('Gesamtlauf: „Raumkontrolle" ist nirgends mehr ein Produkt', () => {
  const zs = ALLE.filter(e => /Raumkontrolle/i.test(e.anzeige_text || '')).map(e => Z.zerlege(e, KAT));
  assert.ok(zs.length >= 40, `erwartet ≥ 40 Vorkommen, gefunden ${zs.length}`);
  assert.equal(zs.filter(z => z.art === 'produkt').length, 0);
});

test('Gesamtlauf: das Artefakt „en" taucht in keinem Feld auf', () => {
  const zs = ALLE.map(e => Z.zerlege(e, KAT));
  const treffer = zs.filter(z =>
    z.farbe === 'en' || z.praeparat === 'en' || z.bedingung === 'en' ||
    (z.erlaeuterung || []).includes('en') || (z.eigenschaften || []).includes('en'));
  assert.equal(treffer.length, 0, `${treffer.length}× steht „en" noch als Wert`);
});
