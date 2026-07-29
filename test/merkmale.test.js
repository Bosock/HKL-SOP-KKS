'use strict';
/* Tests für den Merkmals-Baustein (public/js/features/merkmale.js).

   Besonderheit dieser Suite: Die Prüfmuster sind KEINE erfundenen Beispiele.
   Es sind die tatsächlichen Etikettentexte von 16 Produkten aus dem Herzkatheter-
   labor, abgeschrieben von Fotos der echten Verpackungen. Damit prüft die Suite
   das, worauf es ankommt — ob der Merkmalskatalog an realen Etiketten trägt —
   und nicht, ob eine ausgedachte Zeichenkette zu einem ausgedachten Muster passt.

   Geprüft wird gegen den mitgelieferten Katalog public/data/merkmale.json.
   Wer dort ein Muster kaputt macht, sieht es hier sofort. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const KAT = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/merkmale.json'), 'utf8'));

/* Das Modul im Sandkasten auswerten und seine Funktionen herausreichen.
   Es fasst weder DOM noch Speicher an, deshalb genügt ein leerer Kontext. */
const SRC = fs.readFileSync(path.join(ROOT, 'public/js/features/merkmale.js'), 'utf8');
const ctx = vm.createContext({ fetch: undefined, console });
vm.runInContext(SRC + `
;globalThis.__M = { merkZahl, merkNachMm, merkKonvert, merkPlausibel, merkNormText,
  merkAnkerFund, merkMusterFund, merkRefFelder, merkKlassifizieren, merkFuerKlasse,
  merkEntscheiden, merkSchluessel, merkSammeln, merkKurzText, merkBadges, merkLuecken,
  merkPasst, merkWertNormieren };
;globalThis.__setKat = (k)=>{ MERKKAT = k; };`, ctx);
const M = ctx.__M;
ctx.__setKat(KAT);

/* ═══════════════════════════════════════════════════════════════
   ECHTE ETIKETTEN (abgeschrieben von Produktfotos aus dem HKL)
   ═══════════════════════════════════════════════════════════════ */
const ETIKETT = {

  launcher: {
    name: 'Medtronic Launcher Führungskatheter 6Fr EBU4.0 SH',
    ref: 'LA6EBU40SH',
    text: `Launcher GUIDE CATHETER
      en Guide Catheter / da Guidekateter / de Führungskatheter / fr Cathéter-guide
      6Fr
      0.071 in
      EBU4.0
      SH
      (01)00763000565985
      (240)LA6EBU40SH
      Medtronic Launcher LOT 233153761
      REF Catalog number LA6EBU40SH
      LOT Lot number 233153761
      Use-by date 2028-01-27
      Date of manufacture 2026-01-27
      MD Medical device
      Consult instructions for use or consult electronic instructions for use
      Contains hazardous substances 7440-48-4
      Do not reuse
      STERILE EO Sterilized using ethylene oxide
      Keep away from sunlight
      Quantity :1
      USA Rx Only For US audiences only
      Inner diameter 0.071 In 1.80 mm
      Outer diameter 0.082 In 2.08 mm
      Length 100 cm
      Medtronic M025142C001 Rev C
      Manufactured In: Medtronic Mexico S de R.L. de CV Tijuana Baja California Mexico
      Made In Mexico
      Medtronic, Inc. 710 Medtronic Parkway Minneapolis MN 55432 USA
      EC REP Medtronic B.V. Earl Bakkenstraat 10 6422 PJ Heerlen The Netherlands
      CE 0123`
  },

  blazer: {
    name: 'Boston Scientific Blazer II XP Ablationskatheter 8mm/8F',
    ref: 'M004EPT4500THK20',
    text: `Boston Scientific
      8mm x8F (2.67mm)
      Blazer II XP
      LARGE CURVE / STD DISTAL
      Temperature Ablation Catheter
      Thermischer Ablationskatheter, Catetere per ablazione termica
      Contents (1)
      2.5mm 8mm 8F (2.67mm) 10.2cm
      110cm 7F (2.33mm)
      Non-Pyrogenic
      GTIN 08714729268406
      REF Catalog No. M004EPT4500THK20
      LOT 38086399`
  },

  gaia: {
    name: 'ASAHI Gaia Next 2 PCI-Führungsdraht 0.014" 190 cm',
    ref: 'AH14R020P',
    text: `ASAHI Gaia Next 2 Pre-shape
      PCI Guide Wire
      Coated with SLIP-COAT coating.
      Ø0.36mm/Tip Ø0.30mm (Ø0.014"/Tip Ø0.012")
      190cm
      Radiopaque Length 15cm
      Hydrophilic Coating 40cm
      REF AH14R020P
      2028-08
      ASAHI INTECC PCI Guide Wire ASAHI Gaia Next 2 0.014"/0.012" X 190cm
      REF AH14R020P LOT 250917A201 GS1-128
      (01)14547327116838 (17)280831 (10)250917A201
      Contains Co (cobalt)
      MD STERILE EO
      CE 0344
      Made in THAILAND`
  },

  guideliner: {
    name: 'Teleflex GuideLiner V3 7F Verlängerungskatheter',
    ref: '5572',
    text: `GuideLiner V3 catheter 7F
      REF 5572 (IPN927020)
      en Catheter / de Katheter
      1X Catheter Teleflex
      150cm 17cm 4mm 25cm 95cm 105cm MARKER
      CAS # 7440-48-4
      GLID 0.062" (1.57mm)
      MD
      GCID ≥ 0.078" (1.98mm)
      0.075" (1.90mm) 2mm
      Rx only STERILE EO
      LOT 73C2600527
      2028-03-17
      Teleflex Medical LLC Morrisville NC 27560 USA
      CE 2797
      UDI (01)20841156110465 (17)280317 (11)260317 (10)73C2600527
      Product of Mexico Packaged in Mexico`
  },

  corodyn: {
    name: 'B.Braun Corodyn P1 F5 Einschwemmkatheter',
    ref: '5011590',
    text: `1 CORODYN P1 F5 110CM PUR
      UDI (01)04046964552670(17)280318(11)260320(10)26C20844
      External Diameter 5 F /1.65 mm
      Usable Length 110 cm
      Tip shape SOFTJ
      Lumen 2
      Material PUR
      Recommended Guide wire size 0.025" /0.63 mm
      REF 5011590 LOT 26C20844
      B.BRAUN Manufactured in Poland B. Braun Melsungen AG 34209 Melsungen Germany
      SYRINGE PA DISTAL LUMEN BALLOON LENGTH
      LATEX MR MD STERILE EO RxOnly
      Balloon-Einschwemmkatheter zur Wedge-Druck-Überwachung
      Monitoring Wedge Pressure Balloon Flotation Catheter
      CE 0123`
  },

  nacl: {
    name: 'B.Braun NaCl 0,9 % 500 ml Spüllösung',
    ref: '',
    text: `0,9% 500 ml
      Solution for Irrigation. Not for Injection.
      CE 0123
      GTIN: 04030539076739
      LOT 261228001
      2029.02
      STERILE
      5°C 25°C
      B.BRAUN B. Braun Melsungen AG 34209 Melsungen, Germany
      MD UDI`
  },

  sterofundin: {
    name: 'B.Braun Sterofundin ISO 500 ml',
    ref: '',
    text: `Sterofundin ISO 1/1 E ISO
      B.BRAUN Pharmazeutischer Unternehmer B. Braun Melsungen AG 34209 Melsungen, Deutschland
      Infusionslösung
      Zur intravenösen Anwendung
      500 ml
      1000 ml enthalten: Natriumchlorid 6,8 g Kaliumchlorid 0,3 g
      Magnesiumchlorid-Hexahydrat 0,2 g Calciumchlorid-Dihydrat 0,37 g
      Natriumacetat-Trihydrat 3,27 g Äpfelsäure 0,67 g
      Elektrolyte: mmol/l Natrium 145 Kalium 4 Calcium 2,5 Magnesium 1
      L-Äpfelsäure 5 Chlorid 127 Acetat 24
      Osmolarität 309 mosm/l
      pH 5,1 - 5,9
      Wasser für Injektionszwecke, Natriumhydroxid
      DE: Apothekenpflichtig AT: Rezept- und apothekenpflichtig
      DE: 60452.00.00 AT Z.Nr.: 1 - 26228
      Nicht im Kühlschrank lagern oder einfrieren.
      Nur zur einmaligen Verwendung.
      Ch.-B.: 26201814 Verwendbar bis: 04.2029`
  },

  supraflex: {
    name: 'SMT Supraflex Cruz NEVO Sirolimus-Stent 2,75 × 20 mm',
    ref: 'FGTO275020',
    text: `Sahajanand Medical Technologies Limited
      SUPRAFLEX CRUZ NEVO 2.75 mm x 20 mm
      REF FGTO275020
      SN (21)S25TOAWHS275020154
      LOT (10)S25TOAWHAE
      GTIN/UDI: (01)08904442301379(17)270831(10)S25TOAWHAE
      SUPRAFLEX CRUZ NEVO SIROLIMUS ELUTING COBALT CHROMIUM CORONARY STENT SYSTEM
      Sirolimus Eluting Cobalt Chromium Coronary Stent System
      Rapid Exchange stent delivery system
      20mm 21mm 25cm Wire Exit 0.95 mm 0.72 mm 1400mm
      0.36 mm (0.014")
      Min. Guiding Catheter > 5F 1F = 0.33mm
      COMPLIANCE CHART Pressure [atm] NP 10 2.76 RBP 16 2.93
      Dilatation limit(mm) 4.25 mm
      Store at 20°C to 30°C
      CE 2460
      2025-09 (17)2027-08`
  },

  radifocus: {
    name: 'Terumo Radifocus Introducer II 5 Fr',
    ref: 'RM*RF5J16PQ',
    text: `RADIFOCUS STERILE EO
      TERUMO RADIFOCUS INTRODUCER II Introducer Fr.5
      REF : RM*RF5J16PQ M coat
      A 16cm
      B 0.025" (MIN. 0.65mm)
      C 1.78mm (MIN. 1.65mm)
      D 0.025" (MAX. 0.64mm)
      E 80cm
      F 20G (0.90mm)
      G 1 2/5" (35mm)
      SPRING METALLIC Contents 1
      Do not resterilize Do not reuse
      LOT : 241021VA 2027-03-31 EXP
      TERUMO CORPORATION TOKYO JAPAN MADE IN VIETNAM
      (01)08935221225326(17)270331(10)241021VA
      CE 0197`
  },

  trevisio: {
    name: 'Abbott Amplatzer Trevisio 12F 80 cm 45°',
    ref: '9-ATV12F45/80',
    text: `Abbott 45°
      Amplatzer Trevisio
      Intravascular Delivery System
      12F 80 cm
      UDI (01)05415067030955(17)280229(10)10752054
      2028-02-29
      REF 9-ATV12F45/80
      LOT 10752054
      3.99 mm/0.157 in 4.80 mm/0.189 in 80 cm
      PHT DEHP
      LATEX Does not contain natural rubber latex components
      STERILE EO
      CE 2797
      Abbott Medical Plymouth MN USA
      Made in USA`
  },

  freezor: {
    name: 'Medtronic Freezor Xtra Kryoablationskatheter 7Fr',
    ref: '217F3',
    text: `Medtronic Freezor Xtra 217F3
      REF 217F3 MD LOT 28526 # 217F3
      2028-02-09 2026-02-09
      Package contents: 1x Cardiac Cryoablation Catheter Product documentation
      108 cm
      2.3 mm 7 Fr
      6 mm 2.5-5.0-2.5 mm 55 mm
      en Cardiac Cryoablation Catheter
      de Kardialer Kryoablationskatheter`
  },

  arcticfront: {
    name: 'Medtronic Arctic Front Advance Pro 28 mm Kryoballon',
    ref: 'AFAPRO28',
    text: `Medtronic Arctic Front Advance Pro AFAPRO28
      REF AFAPRO28 MD LOT 28814 # AFAPRO28
      2028-02-26 2026-02-26
      Package contents: 1x Cardiac Cryoablation Catheter Product documentation
      3.5 mm (0.14 in) 10.5 Fr
      95.0±2.0 cm (37.40±0.80 in)
      28 mm (1.10 in)
      en Cardiac Cryoablation Catheter
      de Kardialer Kryoablationskatheter`
  },

  hahnbank: {
    name: 'Angiokard HD-Hahnbank 2-fach',
    ref: '1783510',
    text: `REF 1783510
      L&R REF: 160 259
      HD-Hahnbank 2-fach ON
      max. 500 psi
      LOT 261828 0088
      2026-04-28
      (01)04055384755554(17)280831(10)2618280088
      (240)160259
      VE: 1 Pck 2028-08-31
      ANGIOKARD Medizintechnik GmbH an L&R Company Industriestr. 15 D-26446 Friedeburg
      Made in Czech Republic
      MD STERILE EO 10°C 30°C
      CE 0482`
  },

  telacomp: {
    name: 'Hartmann Telacomp Kompresse 10 × 10 cm',
    ref: '452235',
    text: `Telacomp
      REF 452 235
      10 cm x 10 cm
      17# 12
      x240 (12 x 20)
      HARTMANN REF 452 235 UDI
      LOT 699706009
      USE BY: 2031-03-01 MANUFACTURED ON: 2026-03-01
      (01)04052199230207(11)260301(17)310301(10)699706009`
  },

  evolut: {
    name: 'Medtronic Evolut FX Loading System',
    ref: 'L-EVOLUTFX-2329',
    text: `Medtronic Evolut FX
      REF L-EVOLUTFX-2329
      en Loading System / de Ladesystem / cs Zasouvaci systém
      2028-03-30 2026-03-31 LOT 0013363517
      EVOLUTFX-23 EVOLUTFX-26 EVOLUTFX-29
      D-EVOLUTFX-2329
      Quantity :1
      STERILE EO MD
      CE 0344
      Medtronic CoreValve LLC Santa Ana CA 92705 USA
      Medtronic Ireland, Parkmore Business Park West, Galway, Ireland Country of Origin: Ireland`
  }
};

/* Kleiner Helfer: ein Merkmal aus dem Ergebnis herausgreifen. */
function m(erg, id){ return (erg.merkmale||[]).filter(x=>x.id===id)[0] || null; }
function wert(erg, id){ const f = m(erg, id); return f ? f.wert : undefined; }
function istMehrdeutig(erg, id){ return (erg.mehrdeutig||[]).some(x=>x.id===id); }

/* ═══════════════════════════════════════════════════════════════
   1. Zahlen und Einheiten
   ═══════════════════════════════════════════════════════════════ */
test('merkZahl liest Komma, Punkt und gemischte Brüche', () => {
  assert.equal(M.merkZahl('2,75'), 2.75);
  assert.equal(M.merkZahl('0.071'), 0.071);
  assert.equal(M.merkZahl('110 cm'), 110);
  assert.equal(M.merkZahl('1 2/5'), 1.4);      // Terumo schreibt Nadellängen so
  assert.equal(M.merkZahl('2/5'), 0.4);
  assert.equal(M.merkZahl(''), null);
  assert.equal(M.merkZahl('STERILE'), null);
});

test('merkNachMm rechnet French, Zoll und Gauge korrekt um', () => {
  assert.ok(Math.abs(M.merkNachMm(6, 'F', KAT.einheiten) - 2.0) < 0.01);       // 6 F = 2,00 mm
  assert.ok(Math.abs(M.merkNachMm(0.014, 'in', KAT.einheiten) - 0.3556) < 0.001);
  assert.equal(M.merkNachMm(20, 'G', KAT.einheiten), 0.90);                     // 20 G laut Terumo-Etikett
  assert.equal(M.merkNachMm(5, 'Unsinn', KAT.einheiten), null);                 // nicht raten
});

test('merkKonvert dreht zwischen Einheiten', () => {
  assert.ok(Math.abs(M.merkKonvert(0.071, 'in', 'mm', KAT.einheiten) - 1.803) < 0.01);
  assert.ok(Math.abs(M.merkKonvert(2.67, 'mm', 'F', KAT.einheiten) - 8.01) < 0.05);
});

test('merkPlausibel schützt vor der Verwechslung von mm und cm', () => {
  const laenge = KAT.merkmale.filter(x=>x.id==='nutzlaenge_cm')[0];
  assert.equal(M.merkPlausibel(laenge, 110), true);
  assert.equal(M.merkPlausibel(laenge, 8), false);      // 8 mm Spitze ist keine Katheterlänge
  const spitze = KAT.merkmale.filter(x=>x.id==='spitze_mm')[0];
  assert.equal(M.merkPlausibel(spitze, 8), true);
  assert.equal(M.merkPlausibel(spitze, 110), false);
});

/* ═══════════════════════════════════════════════════════════════
   2. Klassifizierung — welche Materialart liegt hier?
   ═══════════════════════════════════════════════════════════════ */
test('jedes Etikett landet in seiner Materialklasse', () => {
  const erwartet = {
    launcher: 'fuehrungskatheter', blazer: 'ablation_rf', gaia: 'fuehrungsdraht',
    guideliner: 'guide_extension', corodyn: 'einschwemmkatheter', nacl: 'loesung',
    sterofundin: 'loesung', supraflex: 'stent', radifocus: 'schleuse',
    trevisio: 'schleuse', freezor: 'ablation_kryo', arcticfront: 'ablation_kryo',
    hahnbank: 'zubehoer_druck', telacomp: 'textil', evolut: 'zubehoer_implantat'
  };
  Object.keys(erwartet).forEach(k=>{
    const kl = M.merkKlassifizieren(ETIKETT[k].text, KAT.klassen);
    assert.equal(kl.klasse, erwartet[k], `${ETIKETT[k].name}: erkannt als ${kl.klasse}`);
  });
});

/* ═══════════════════════════════════════════════════════════════
   3. REF-Grammatik — Varianten aus der Artikelnummer
   ═══════════════════════════════════════════════════════════════ */
test('REF-Grammatik löst die Medtronic-Launcher-Variante auf', () => {
  const f = M.merkRefFelder('LA6EBU40SH', KAT.ref_grammatik);
  assert.equal(f.ad_fr.wert, '6');
  assert.equal(f.kurvenform.wert, 'EBU40');
  assert.equal(f.seitenloecher.wert, 'ja');
});

test('REF-Grammatik unterscheidet Seitenlöcher von ohne', () => {
  assert.equal(M.merkRefFelder('LA6EBU40MS', KAT.ref_grammatik).seitenloecher.wert, 'nein');
});

test('REF-Grammatik liest Stentmaß, Schleusenwinkel und Kryoballon', () => {
  const stent = M.merkRefFelder('FGTO275020', KAT.ref_grammatik);
  assert.equal(stent.stent_mm.wert, '2.75');
  assert.equal(stent.stent_laenge_mm.wert, '20');

  const sheath = M.merkRefFelder('9-ATV12F45/80', KAT.ref_grammatik);
  assert.equal(sheath.schleuse_fr.wert, '12');
  assert.equal(sheath.winkel_grad.wert, '45');
  assert.equal(sheath.schleuse_laenge_cm.wert, '80');

  assert.equal(M.merkRefFelder('AFAPRO28', KAT.ref_grammatik).ballon_mm.wert, '28');
  assert.equal(M.merkRefFelder('RM*RF5J16PQ', KAT.ref_grammatik).spitzenform.wert, 'J-Tip');
});

test('REF-Grammatik trennt Lade- von Einführsystem', () => {
  assert.equal(M.merkRefFelder('L-EVOLUTFX-2329', KAT.ref_grammatik).rolle.wert, 'Loading-System');
  assert.equal(M.merkRefFelder('D-EVOLUTFX-2329', KAT.ref_grammatik).rolle.wert, 'Delivery-System');
});

test('unbekannte REF liefert nichts statt Unsinn', () => {
  assert.deepEqual(Object.keys(M.merkRefFelder('IRGENDWAS123', KAT.ref_grammatik)), []);
  assert.deepEqual(Object.keys(M.merkRefFelder('', KAT.ref_grammatik)), []);
});

/* ═══════════════════════════════════════════════════════════════
   4. Beschriftete Felder (Anker) — die sicherste Lesung
   ═══════════════════════════════════════════════════════════════ */
test('Anker liest den Wert neben seiner Beschriftung, nicht irgendeine Zahl', () => {
  const def = id => KAT.merkmale.filter(x=>x.id===id)[0];
  const t = ETIKETT.launcher.text;
  assert.equal(M.merkAnkerFund(t, def('id_mm')).wert, '1.80');
  assert.equal(M.merkAnkerFund(t, def('od_mm')).wert, '2.08');
  assert.equal(M.merkAnkerFund(t, def('nutzlaenge_cm')).wert, '100');
});

test('Anker findet auch beschriftete Zahlen ohne Einheit', () => {
  const lumen = KAT.merkmale.filter(x=>x.id==='lumenzahl')[0];
  const f = M.merkAnkerFund(ETIKETT.corodyn.text, lumen);
  assert.equal(f.wert, '2');
  assert.equal(f.herkunft, 'anker');
});

test('Anker zünden nicht mitten in einem Wort', () => {
  // "i.d." darf nicht in "rapid" oder "guide" anschlagen
  const idm = KAT.merkmale.filter(x=>x.id==='id_mm')[0];
  assert.equal(M.merkAnkerFund('Rapid Exchange guide 12,5 mm Ballon', idm), null);
});

/* ═══════════════════════════════════════════════════════════════
   5. Vollständige Auswertung echter Etiketten
   ═══════════════════════════════════════════════════════════════ */
test('Launcher: Größe, Kurve, Seitenlöcher, Lumen und Länge', () => {
  const e = M.merkSammeln(ETIKETT.launcher.text, ETIKETT.launcher.ref, KAT);
  assert.equal(e.klasse, 'fuehrungskatheter');
  assert.equal(wert(e, 'ad_fr'), '6');
  assert.equal(wert(e, 'kurvenform'), 'EBU4.0');          // lesbare Schreibweise vom Etikett …
  assert.equal(m(e, 'kurvenform').herkunft, 'ref');       // … Sicherheit aus der REF
  assert.equal(m(e, 'kurvenform').bestaetigt, true);      // beide Wege, gleiche Aussage
  assert.equal(wert(e, 'seitenloecher'), 'ja');
  assert.equal(wert(e, 'id_mm'), '1.80');
  assert.equal(wert(e, 'od_mm'), '2.08');
  assert.equal(wert(e, 'nutzlaenge_cm'), '100');
  assert.equal(wert(e, 'steril'), 'steril (EO)');
  assert.equal(wert(e, 'einmalgebrauch'), 'ja');
  assert.equal(wert(e, 'gefahrstoff'), '7440-48-4');
  assert.equal(wert(e, 'ce_stelle'), '0123');
});

test('Blazer: 8-mm-Spitze, große Kurve — und die Schaft/Spitzen-Falle wird NICHT geraten', () => {
  const e = M.merkSammeln(ETIKETT.blazer.text, ETIKETT.blazer.ref, KAT);
  assert.equal(e.klasse, 'ablation_rf');
  assert.equal(wert(e, 'spitze_mm'), '8');
  assert.equal(wert(e, 'kurve_groesse'), 'LARGE');
  assert.equal(wert(e, 'distal_form'), 'STD DISTAL');
  assert.equal(wert(e, 'nutzlaenge_cm'), '110');
  // Auf dem Etikett stehen 7F (Schaft) UND 8F (Spitze). Genau das darf die App
  // nicht entscheiden — sie fragt.
  assert.equal(istMehrdeutig(e, 'ad_fr'), true);
  assert.equal(wert(e, 'ad_fr'), undefined);
  const unklar = (e.mehrdeutig||[]).filter(x=>x.id==='ad_fr')[0];
  // Hinweis: Arrays aus dem vm-Sandkasten sind nicht referenzgleich mit denen
  // dieses Realms — deshalb wird der Inhalt verglichen, nicht die Struktur.
  assert.equal(Array.from(unklar.kandidaten).map(String).sort().join(','), '7,8');
});

test('Gaia: Drahtstärke ist die größte Angabe, Spitze zählt nicht als Nennmaß', () => {
  const e = M.merkSammeln(ETIKETT.gaia.text, ETIKETT.gaia.ref, KAT);
  assert.equal(e.klasse, 'fuehrungsdraht');
  assert.equal(M.merkZahl(wert(e, 'draht_in')), 0.014);   // nicht 0.012 (das ist die Spitze)
  assert.equal(wert(e, 'draht_laenge_cm'), '190');
  assert.equal(wert(e, 'roentgen_laenge_cm'), '15');
  assert.equal(wert(e, 'beschichtung'), 'SLIP-COAT (hydrophil)');
  assert.equal(wert(e, 'kernmaterial'), 'Kobalt-Legierung');
  assert.equal(wert(e, 'spitzenform'), 'vorgeformt');
});

test('GuideLiner: Innenlumen und die Anforderung an den Führungskatheter', () => {
  const e = M.merkSammeln(ETIKETT.guideliner.text, ETIKETT.guideliner.ref, KAT);
  assert.equal(e.klasse, 'guide_extension');
  assert.equal(wert(e, 'ad_fr'), '7');
  assert.equal(wert(e, 'id_mm'), '1.57');                 // GLID
  assert.equal(wert(e, 'min_guiding_id_mm'), '1.98');     // GCID — die Kompatibilitätsfrage
  assert.equal(wert(e, 'gefahrstoff'), '7440-48-4');
});

test('Corodyn: das vorbildliche Etikett — alle sechs Felder kommen an', () => {
  const e = M.merkSammeln(ETIKETT.corodyn.text, ETIKETT.corodyn.ref, KAT);
  assert.equal(e.klasse, 'einschwemmkatheter');
  assert.equal(wert(e, 'ad_fr'), '5');
  assert.equal(wert(e, 'nutzlaenge_cm'), '110');
  assert.equal(wert(e, 'spitzenform'), 'Soft-J');
  assert.equal(wert(e, 'lumenzahl'), '2');
  assert.equal(wert(e, 'material'), 'PUR');
  assert.equal(M.merkZahl(wert(e, 'draht_empf_in')), 0.025);
});

test('NaCl-Spüllösung: „Not for Injection" wird als Warnmerkmal erfasst', () => {
  const e = M.merkSammeln(ETIKETT.nacl.text, ETIKETT.nacl.ref, KAT);
  assert.equal(e.klasse, 'loesung');
  assert.equal(wert(e, 'verwendungszweck'), 'zur Spülung (NICHT zur Injektion)');
  assert.equal(m(e, 'verwendungszweck').warnung, true);
  assert.equal(wert(e, 'volumen_ml'), '500');
  assert.equal(M.merkZahl(wert(e, 'konzentration_pct')), 0.9);
});

test('Sterofundin: Osmolarität, pH und Zulassungsnummer', () => {
  const e = M.merkSammeln(ETIKETT.sterofundin.text, ETIKETT.sterofundin.ref, KAT);
  assert.equal(e.klasse, 'loesung');
  assert.equal(wert(e, 'osmolaritaet'), '309');
  assert.equal(wert(e, 'ph_wert'), '5,1 - 5,9');
  assert.equal(wert(e, 'zulassungsnummer'), '60452.00.00');
  assert.equal(wert(e, 'apothekenpflichtig'), 'ja');
  assert.equal(wert(e, 'einmalgebrauch'), 'ja');
  // 500 ml Flasche gegen "1000 ml enthalten" — hier ist Nachfragen richtig
  assert.equal(istMehrdeutig(e, 'volumen_ml'), true);
});

test('Supraflex: Stentmaß, Wirkstoff, Drücke und Mindest-Guiding', () => {
  const e = M.merkSammeln(ETIKETT.supraflex.text, ETIKETT.supraflex.ref, KAT);
  assert.equal(e.klasse, 'stent');
  assert.equal(M.merkZahl(wert(e, 'stent_mm')), 2.75);
  assert.equal(M.merkZahl(wert(e, 'stent_laenge_mm')), 20);
  assert.equal(wert(e, 'wirkstoff'), 'Sirolimus');
  assert.equal(wert(e, 'plattform_material'), 'Kobalt-Chrom');
  assert.equal(wert(e, 'np_atm'), '10');
  assert.equal(wert(e, 'rbp_atm'), '16');
  assert.equal(wert(e, 'min_guiding_fr'), '5');
  assert.equal(wert(e, 'system_rx_otw'), 'Rapid Exchange (RX)');
});

test('Radifocus: die REF schlägt die vieldeutige Zahlensuppe auf dem Etikett', () => {
  const e = M.merkSammeln(ETIKETT.radifocus.text, ETIKETT.radifocus.ref, KAT);
  assert.equal(e.klasse, 'schleuse');
  assert.equal(wert(e, 'schleuse_fr'), '5');
  assert.equal(wert(e, 'schleuse_laenge_cm'), '16');   // 16 cm Schleuse, nicht 80 cm Draht
  assert.equal(m(e, 'schleuse_laenge_cm').herkunft, 'ref');
  assert.equal(wert(e, 'spitzenform'), 'J-Tip');
  assert.equal(wert(e, 'nadel_g'), '20');
  assert.equal(wert(e, 'beschichtung'), 'M coat (hydrophil)');
});

test('Trevisio: Winkel als echtes Variantenmerkmal, latexfrei erkannt', () => {
  const e = M.merkSammeln(ETIKETT.trevisio.text, ETIKETT.trevisio.ref, KAT);
  assert.equal(wert(e, 'schleuse_fr'), '12');
  assert.equal(wert(e, 'winkel_grad'), '45');
  assert.equal(wert(e, 'schleuse_laenge_cm'), '80');
  assert.equal(wert(e, 'latex'), 'latexfrei');
  assert.equal(wert(e, 'dehp'), 'ja');
});

test('Kryokatheter werden nicht mit HF-Ablation verwechselt', () => {
  // „Ablationskatheter" steckt wörtlich in „Kryoablationskatheter" — ohne
  // Ausschlusswörter gewönne die falsche Klasse und damit der falsche
  // Merkmalssatz.
  const f = M.merkSammeln(ETIKETT.freezor.text, ETIKETT.freezor.ref, KAT);
  assert.equal(f.klasse, 'ablation_kryo');
  assert.equal(wert(f, 'ad_fr'), '7');           // aus "7 Fr", nicht aus REF "217F3"
  assert.equal(wert(f, 'nutzlaenge_cm'), '108');

  const a = M.merkSammeln(ETIKETT.arcticfront.text, ETIKETT.arcticfront.ref, KAT);
  assert.equal(a.klasse, 'ablation_kryo');
  assert.equal(wert(a, 'ballon_mm'), '28');
  assert.equal(m(a, 'ballon_mm').herkunft, 'ref');
  assert.equal(wert(a, 'nutzlaenge_cm'), '95.0');  // "95.0±2.0 cm"
  assert.equal(wert(a, 'ad_fr'), '10.5');
});

test('was nur als Zeichnungsmaß dasteht, wird als Lücke gemeldet statt geraten', () => {
  // Beim Freezor steht die 6-mm-Spitze ausschließlich als Bemaßungspfeil in der
  // technischen Zeichnung — ohne beschriftendes Wort. Genau dafür gibt es die
  // Lückenliste: Die App behauptet nichts, sie sagt, was noch fehlt.
  const f = M.merkSammeln(ETIKETT.freezor.text, ETIKETT.freezor.ref, KAT);
  const l = M.merkLuecken(f.klasse, f.merkmale, KAT).map(x=>x.id);
  assert.ok(l.indexOf('spitze_mm') >= 0, 'Spitzenlänge fehlt und muss als Lücke erscheinen');
  assert.ok(l.indexOf('ballon_mm') >= 0);
  assert.equal(l.indexOf('nutzlaenge_cm'), -1, 'die Länge wurde gelesen und ist keine Lücke');
});

test('Hahnbank: Anzahl Hähne und Druckfestigkeit als Warnmerkmal', () => {
  const e = M.merkSammeln(ETIKETT.hahnbank.text, ETIKETT.hahnbank.ref, KAT);
  assert.equal(e.klasse, 'zubehoer_druck');
  assert.equal(wert(e, 'anzahl_haehne'), '2');
  assert.equal(wert(e, 'max_druck_psi'), '500');
  assert.equal(m(e, 'max_druck_psi').warnung, true);
});

test('Telacomp: Maß, Fädigkeit und Packungsinhalt', () => {
  const e = M.merkSammeln(ETIKETT.telacomp.text, ETIKETT.telacomp.ref, KAT);
  assert.equal(e.klasse, 'textil');
  assert.equal(wert(e, 'masse_cm'), '10 cm x 10 cm');
  assert.equal(wert(e, 'faedigkeit'), '17');
  assert.equal(wert(e, 'stueck_packung'), '240');
});

test('Evolut: Zubehör behält seine Rolle, auch ohne passende Merkmalsklasse', () => {
  const e = M.merkSammeln(ETIKETT.evolut.text, ETIKETT.evolut.ref, KAT);
  assert.equal(wert(e, 'rolle'), 'Loading-System');
  assert.equal(wert(e, 'steril'), 'steril (EO)');
});

test('Verneinungen auf dem Etikett werden nicht ins Gegenteil verkehrt', () => {
  // „Do not resterilize" heißt NICHT „resterilisierbar: ja".
  const e = M.merkSammeln(ETIKETT.radifocus.text, ETIKETT.radifocus.ref, KAT);
  assert.equal(wert(e, 'resterilisierbar'), 'nein');
  assert.equal(wert(e, 'einmalgebrauch'), 'ja');
});

test('Merkmale mit `nur_anker` greifen nicht irgendwo im Fließtext', () => {
  // Das Herkunftsland ist das Wort nach „Made in" — ohne den Anker wäre es
  // schlicht das erste Wort des Etiketts („Boston", „Medtronic" …).
  ['launcher','corodyn','radifocus','trevisio'].forEach(k=>{
    const e = M.merkSammeln(ETIKETT[k].text, ETIKETT[k].ref, KAT);
    const l = m(e, 'herkunftsland');
    if(l) assert.equal(l.herkunft, 'anker', k + ': Herkunftsland darf nur am Anker hängen');
  });
  const bs = M.merkSammeln(ETIKETT.blazer.text, ETIKETT.blazer.ref, KAT);
  assert.equal(m(bs, 'herkunftsland'), null, 'ohne „Made in" bleibt das Feld leer');
});

test('`streng` unterscheidet Groß- und Kleinschreibung, wo sie die Aussage trägt', () => {
  const e = M.merkSammeln(ETIKETT.launcher.text, ETIKETT.launcher.ref, KAT);
  assert.equal(wert(e, 'herkunftsland'), 'Mexico');   // nicht „Mexico Medtronic"
  const g = M.merkSammeln(ETIKETT.guideliner.text, ETIKETT.guideliner.ref, KAT);
  assert.equal(m(g, 'seitenloecher'), null, '„sh" in Fließtext ist kein Seitenloch-Vermerk');
});

/* ═══════════════════════════════════════════════════════════════
   6. Der Kern des Ganzen: Varianten werden unterscheidbar
   ═══════════════════════════════════════════════════════════════ */
test('zwei Varianten derselben Produktfamilie ergeben verschiedene Merkmale', () => {
  const nd = M.merkSammeln(ETIKETT.launcher.text.replace(/LA6EBU40SH/g,'LA6EBU35SH').replace(/EBU4\.0/g,'EBU3.5'), 'LA6EBU35SH', KAT);
  const ld = M.merkSammeln(ETIKETT.launcher.text, 'LA6EBU40SH', KAT);
  assert.notEqual(wert(nd,'kurvenform'), wert(ld,'kurvenform'));
  assert.equal(wert(nd,'kurvenform'), 'EBU3.5');
  assert.equal(wert(ld,'kurvenform'), 'EBU4.0');
  // …und ohne Seitenlöcher wäre es wieder ein anderes Produkt
  const ms = M.merkSammeln(ETIKETT.launcher.text.replace(/LA6EBU40SH/g,'LA6EBU40MS').replace(/\bSH\b/g,'MS'), 'LA6EBU40MS', KAT);
  assert.equal(wert(ms,'seitenloecher'), 'nein');
});

/* ═══════════════════════════════════════════════════════════════
   7. Lücken und Anzeige
   ═══════════════════════════════════════════════════════════════ */
test('merkLuecken benennt die fehlenden Leitmerkmale', () => {
  const e = M.merkSammeln(ETIKETT.guideliner.text, ETIKETT.guideliner.ref, KAT);
  const l = M.merkLuecken(e.klasse, e.merkmale, KAT).map(x=>x.id);
  assert.ok(l.indexOf('arbeitslaenge_cm') >= 0, 'Arbeitslänge steht nicht auf dem Etikett und fehlt zu Recht');
  assert.equal(l.indexOf('id_mm'), -1, 'Innendurchmesser wurde gefunden und darf keine Lücke sein');
});

test('merkBadges liefert nur Leitmerkmale und begrenzt die Zeile', () => {
  const e = M.merkSammeln(ETIKETT.launcher.text, ETIKETT.launcher.ref, KAT);
  const b = M.merkBadges(e.merkmale, 4);
  assert.equal(b.length, 4);
  assert.equal(b[0], 'AD 6 F');
  assert.ok(b.join(' ').indexOf('EBU4.0') >= 0);
});

test('merkKurzText schreibt Ja/Nein-Merkmale als Aussage, nicht als „ja"', () => {
  assert.equal(M.merkKurzText({ kurz:'SH', label:'Seitenlöcher', typ:'ja_nein', wert:'ja' }), 'SH');
  assert.equal(M.merkKurzText({ kurz:'SH', label:'Seitenlöcher', typ:'ja_nein', wert:'nein' }), 'kein SH');
  assert.equal(M.merkKurzText({ kurz:'L', label:'Länge', typ:'mass', wert:'100', einheit:'cm' }), 'L 100 cm');
});

/* ═══════════════════════════════════════════════════════════════
   8. Kompatibilität — „passt das zusammen?"
   ═══════════════════════════════════════════════════════════════ */
test('Kompatibilität: passt der GuideLiner in den Launcher?', () => {
  const ext  = M.merkSammeln(ETIKETT.guideliner.text, ETIKETT.guideliner.ref, KAT);
  const guid = M.merkSammeln(ETIKETT.launcher.text, ETIKETT.launcher.ref, KAT);
  const regel = KAT.kompatibilitaet.regeln.filter(r=>r.id==='extension_in_guiding')[0];
  // GuideLiner 7F braucht ID ≥ 1,98 mm; der 6F-Launcher hat 1,80 mm → nein.
  const r = M.merkPasst(regel, ext.merkmale, guid.merkmale, KAT.einheiten);
  assert.equal(r.antwort, 'nein');
  // Mit einem größeren Führungskatheter (2,06 mm Innenlumen) geht es.
  const gross = [{ id:'id_mm', wert:'2.06', einheit:'mm' }];
  assert.equal(M.merkPasst(regel, ext.merkmale, gross, KAT.einheiten).antwort, 'ja');
});

test('Kompatibilität: welcher Draht passt in den Corodyn?', () => {
  const kath = M.merkSammeln(ETIKETT.corodyn.text, ETIKETT.corodyn.ref, KAT);
  const regel = KAT.kompatibilitaet.regeln.filter(r=>r.id==='draht_in_katheter')[0];
  // Corodyn nimmt 0,025"; ein 0,014"-Draht passt, ein 0,035"-Draht nicht.
  assert.equal(M.merkPasst(regel, kath.merkmale, [{id:'draht_in',wert:'0.014',einheit:'in'}], KAT.einheiten).antwort, 'ja');
  assert.equal(M.merkPasst(regel, kath.merkmale, [{id:'draht_in',wert:'0.035',einheit:'in'}], KAT.einheiten).antwort, 'nein');
});

test('Kompatibilität antwortet „unbekannt" statt zu raten', () => {
  const regel = KAT.kompatibilitaet.regeln.filter(r=>r.id==='draht_in_katheter')[0];
  assert.equal(M.merkPasst(regel, [], [{id:'draht_in',wert:'0.014',einheit:'in'}], KAT.einheiten).antwort, 'unbekannt');
});

/* ═══════════════════════════════════════════════════════════════
   9. Katalog-Hygiene — der Katalog wird von Menschen gepflegt
   ═══════════════════════════════════════════════════════════════ */
test('jedes Merkmal hat Kennung, Beschriftung, Typ und mindestens eine Klasse', () => {
  const ids = {};
  KAT.merkmale.forEach(d=>{
    assert.ok(d.id && d.label && d.typ, `unvollständiges Merkmal: ${JSON.stringify(d).slice(0,80)}`);
    assert.ok(Array.isArray(d.klassen) && d.klassen.length, `${d.id} hat keine Klasse`);
    assert.ok(!ids[d.id], `Merkmal ${d.id} ist doppelt`);
    ids[d.id] = true;
  });
});

test('alle Muster im Katalog sind gültige reguläre Ausdrücke', () => {
  const pruefe = (s, wo) => { try { new RegExp(s, 'i'); } catch(e){ assert.fail(`${wo}: ${s} → ${e.message}`); } };
  KAT.merkmale.forEach(d=>(d.muster||[]).forEach(s=>pruefe(s, d.id)));
  KAT.ref_grammatik.forEach(g=>pruefe(g.muster, 'ref_grammatik/'+g.id));
});

test('jede Klasse verweist nur auf Merkmale, die es gibt', () => {
  const ids = {}; KAT.merkmale.forEach(d=>ids[d.id]=true);
  const ausGrammatik = {}; KAT.ref_grammatik.forEach(g=>(g.felder||[]).forEach(f=>ausGrammatik[f.merkmal]=true));
  KAT.klassen.forEach(k=>(k.leit||[]).forEach(id=>{
    assert.ok(ids[id] || ausGrammatik[id] || id==='passt_zu', `Klasse ${k.id} nennt unbekanntes Leitmerkmal ${id}`);
  }));
});

test('jede Klasse eines Merkmals ist eine echte Klasse', () => {
  const ids = {}; KAT.klassen.forEach(k=>ids[k.id]=true);
  KAT.merkmale.forEach(d=>d.klassen.forEach(k=>assert.ok(ids[k], `${d.id} nennt unbekannte Klasse ${k}`)));
});

test('ein kaputtes Muster legt die App nicht lahm', () => {
  const kaputt = { id:'test', label:'Test', typ:'text', muster:['([unvollständig'] };
  assert.equal(M.merkMusterFund('irgendein Text', kaputt).length, 0);
  assert.equal(M.merkAnkerFund('irgendein Text', Object.assign({anker:['irgend']}, kaputt)), null);
});

test('leerer Text liefert leere Merkmale statt Unsinn', () => {
  const e = M.merkSammeln('', '', KAT);
  assert.equal(e.klasse, 'allgemein');
  assert.equal(e.merkmale.length, 0);
});
