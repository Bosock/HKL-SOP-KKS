/* ON-DEVICE-OCR end-to-end, echter Beweis: Die selbst gehostete Tesseract-
   Engine wird von UNSEREM Server (unter unserer CSP mit WASM) geladen und liest
   echten Text aus einem im Browser gerenderten Etikett-Bild. Prüft damit die
   harten Integrationsrisiken: CSP erlaubt WASM, die vendorten Pfade auflösen,
   und extractLabelFields gewinnt daraus die richtigen Felder.

   Langsamer als die anderen Suiten (lädt ~6 MB + WASM-Init + Erkennung). */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('ocr');
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);

  // 1) Reiner Extraktor im echten Browser.
  const pure = await A.page.evaluate(() => {
    const f = extractLabelFields('TERUMO\nREF RM123456\nLOT 9Z\n6Fr 110 cm');
    return { ref: f.ref, hersteller: f.hersteller, french: f.french, laenge: f.laenge };
  });
  r.check('extractLabelFields (Browser): REF', pure.ref === 'RM123456');
  r.check('extractLabelFields (Browser): Hersteller', pure.hersteller === 'Terumo');
  r.check('extractLabelFields (Browser): French', pure.french === '6F');

  // 1b) Reicheres Etikett: Verwendung + Eigenschaften + Formular-Befüllung.
  const rich = await A.page.evaluate(() => {
    doLogin('1234567');
    const f = extractLabelFields([
      'Boston Scientific', 'IntellaNav MiFi™ XP', 'LARGE CURVE',
      'Temperature Ablation Catheter', 'REF Catalog No. M004EMR4500K20',
      'LOT 33781593', '8F 110cm',
    ].join('\n'));
    // Formular öffnen und NUR leere Felder füllen lassen
    openScanItem('08714729906117', true);
    const filled = ocrFillForm(f);
    const val = (id) => { const el = document.getElementById(id); return el ? el.value : null; };
    // Maße landen jetzt in der EINEN Maßliste (#scSizes) statt in Einzelfeldern.
    const sizeVals = [...document.querySelectorAll('#scSizes .merk-wert')].map(i => i.value);
    return { f, filled, form: { ref: val('scRef'), herst: val('scHersteller'), name: val('scName'), verw: val('scVerw'), sizeVals } };
  });
  r.check('reiches Etikett: REF trotz „Catalog No."', rich.f.ref === 'M004EMR4500K20');
  r.check('reiches Etikett: Verwendung (Gerätetyp) erkannt', rich.f.verwendung === 'Temperature Ablation Catheter');
  r.check('reiches Etikett: Eigenschaft „Large Curve"', /Large Curve/.test(rich.f.weitere || ''));
  r.check('Formular: REF + Hersteller gefüllt', rich.form.ref === 'M004EMR4500K20' && rich.form.herst === 'Boston Scientific');
  r.check('Formular: Verwendung gefüllt (scVerw)', rich.form.verw === 'Temperature Ablation Catheter');
  r.check('Formular: Eigenschaften in Maßliste (Large Curve)', rich.form.sizeVals.some(v => /Large Curve/.test(v)));
  r.check('Formular: French + Länge in Maßliste', rich.form.sizeVals.includes('8F') && rich.form.sizeVals.includes('110 cm'));

  // 2) Echte Engine laden + Text aus einem gerenderten Etikett lesen.
  const ocr = await A.page.evaluate(async () => {
    // Etikett als hochkontrastiges Canvas-Bild rendern (klarer Text → gut lesbar)
    const c = document.createElement('canvas'); c.width = 720; c.height = 360;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#000'; g.textBaseline = 'top';
    g.font = 'bold 52px Arial'; g.fillText('TERUMO', 40, 30);
    g.font = 'bold 46px Arial'; g.fillText('REF RM123456', 40, 120);
    g.font = 'bold 46px Arial'; g.fillText('6Fr 110 cm', 40, 210);
    const dataUrl = c.toDataURL('image/png');

    const t0 = Date.now();
    let ocrRes = { text: '', confidence: 0 };
    try { ocrRes = await runLabelOCR(dataUrl, () => {}); }
    catch (e) { return { error: String((e && e.message) || e) }; }
    const text = (ocrRes && ocrRes.text) || '';
    const fields = extractLabelFields(text);
    return {
      loaded: !!window.Tesseract,
      textLen: text.length,
      confidence: ocrRes.confidence,
      upper: text.toUpperCase(),
      ref: fields.ref, french: fields.french,
      ms: Date.now() - t0,
    };
  });

  if (ocr.error) {
    r.fail('OCR-Engine lief durch (Fehler: ' + ocr.error + ')');
  } else {
    r.check('Tesseract-Engine von /vendor geladen (CSP/WASM ok)', ocr.loaded === true);
    r.check('OCR lieferte Text (' + ocr.textLen + ' Zeichen, ' + ocr.ms + ' ms)', ocr.textLen > 0);
    // Synthetischer, sauberer Text → mindestens ein hochsicheres Token muss sitzen.
    const hit = /TERUMO/.test(ocr.upper || '') || /RM123456/.test(ocr.upper || '') || /110/.test(ocr.upper || '');
    r.check('erkannter Text enthält erwartete Tokens', hit);
    r.check('REF oder French aus echtem OCR extrahiert', !!(ocr.ref || ocr.french));
  }

  // ─────────── 2b) DIE GANZE KETTE auf einem synthetischen Etikett ───────────
  // Beweist im echten Browser: Vorverarbeitung → Volltext → REF-Streifen →
  // Mehrheitsentscheid → Auflösung gegen den Bestand, alles aus EINEM Foto.
  const kette = await A.page.evaluate(async () => {
    doLogin('1234567');
    // Die gesuchte REF steht im Bestand — die Kette muss sie treffen.
    GTINDB['m:kette'] = { gtin: 'm:kette', manual: true, ref: 'RM123456', name: 'Kettentest' };
    saveGtinDB(); refInvalidateIndex();
    const c = document.createElement('canvas'); c.width = 900; c.height = 420;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#000'; g.textBaseline = 'top';
    g.font = 'bold 50px Arial'; g.fillText('TERUMO', 40, 24);
    g.font = 'bold 42px Arial'; g.fillText('REF RM123456', 40, 130);
    g.font = 'bold 42px Arial'; g.fillText('6Fr 110 cm', 40, 240);
    const t0 = Date.now();
    let erg;
    try { erg = await ocrReadLabel(c.toDataURL('image/png'), () => {}); }
    catch (e) { return { error: String((e && e.message) || e) }; }
    return { ref: erg.fields.ref, wie: erg.refInfo && erg.refInfo.wie, lesungen: erg.lesungen,
      french: erg.fields.french, ms: Date.now() - t0 };
  });
  if (kette.error) { r.fail('ocrReadLabel lief durch (Fehler: ' + kette.error + ')'); }
  else {
    r.check('Kette liefert die REF aus dem Bestand (' + kette.ms + ' ms)', kette.ref === 'RM123456');
    r.check('Kette meldet, WIE sie zur REF kam (' + kette.wie + ')',
      ['exakt', 'zeichenklasse', 'gelernt', 'ähnlich', 'roh'].includes(kette.wie));
    r.check('Kette nutzt mehrere Lesungen aus EINEM Foto (' + (kette.lesungen || []).join(' + ') + ')',
      Array.isArray(kette.lesungen) && kette.lesungen.length >= 1 && kette.lesungen.includes('Volltext'));
    r.check('Kette liest auch die Maße mit', kette.french === '6F');
  }

  // ─────────── 3) REF-AUFLÖSUNG: der eigentliche Qualitätshebel ───────────
  // Eine REF muss nicht perfekt gelesen werden, sie muss unterscheidbar sein.
  const aufl = await A.page.evaluate(() => {
    const idx = refIndex(['RM*RG5J40', 'H74904527011']);
    return {
      exakt: refResolve('RM-RG5J40', idx),
      geheilt: refResolve('RM*RGSJ4O', idx),            // OCR-Fehler: S→5, O→0
      unbekannt: refResolve('ZZZZ9999', idx),
      katalogGross: (typeof MATCAT !== 'undefined') ? Object.keys(MATCAT).length : 0,
      bestandGross: refKnownRefs().length,
    };
  });
  r.check('REF-Auflösung: exakter Treffer', aufl.exakt.wie === 'exakt' && aufl.exakt.sicher);
  r.check('REF-Auflösung: OCR-Zeichenfehler (S/5, O/0) wird geheilt',
    aufl.geheilt.ref === 'RM*RG5J40' && aufl.geheilt.sicher === true);
  r.check('REF-Auflösung: Unbekanntes bleibt roh (leer schlägt falsch)',
    aufl.unbekannt.wie === 'roh' && aufl.unbekannt.sicher === false);
  r.check('REF-Bestand umfasst Katalog UND eigene Stammsätze (' + aufl.bestandGross + ')',
    aufl.bestandGross >= aufl.katalogGross && aufl.katalogGross > 100);

  // ─────────── 4) LERNSCHLEIFE: Korrektur wirkt beim nächsten Mal ───────────
  const lern = await A.page.evaluate(() => {
    doLogin('1234567');
    OCRLEARN = {}; saveOcrLearn();
    // So tun, als hätte die OCR gerade „QQ11XY" gelesen …
    ocrLastRead = { roh: 'QQ11XY', wie: 'roh', at: Date.now() };
    // … der Mensch speichert aber „AB99CD".
    ocrLearnFromSave('AB99CD');
    const gelernt = refFromLearn(OCRLEARN, 'QQ11XY');
    const beimNaechstenMal = refBest('QQ11XY');
    // Nichts lernen, wenn richtig gelesen wurde:
    const vorher = Object.keys(OCRLEARN).length;
    ocrLastRead = { roh: 'AB99CD', wie: 'exakt', at: Date.now() };
    ocrLearnFromSave('AB99CD');
    return { gelernt, treffer: beimNaechstenMal.ref, wie: beimNaechstenMal.wie,
      keinLeerlauf: Object.keys(OCRLEARN).length === vorher,
      geteilt: (typeof SHARED_KEYS !== 'undefined') && SHARED_KEYS.includes('hkl_ocrlearn') };
  });
  r.check('Lernschleife: Korrektur wird gemerkt', lern.gelernt === 'AB99CD');
  r.check('Lernschleife: beim nächsten Mal trifft die App sofort',
    lern.treffer === 'AB99CD' && lern.wie === 'gelernt');
  r.check('Lernschleife: richtige Lesungen erzeugen keinen Ballast', lern.keinLeerlauf);
  r.check('Lernschleife wird auf alle Geräte geteilt', lern.geteilt === true);

  // ─────────── 5) GTIN → REF ohne jede Texterkennung ───────────
  const ohneOcr = await A.page.evaluate(async () => {
    doLogin('1234567');
    GTINDB['04012345678901'] = { gtin: '04012345678901', ref: 'BEKANNT1', name: 'Testschleuse', hersteller: 'Terumo' };
    saveGtinDB(); refInvalidateIndex();
    const eigener = await gtinAufloesen('04012345678901');
    // Unbekannte GTIN: darf NICHT hängen und nichts erfinden (offline/ohne Netz).
    const fremd = await gtinAufloesen('09999999999999');
    return { ref: eigener && eigener.ref, herkunft: eigener && eigener.herkunft,
      fremdIstNullOderTreffer: (fremd === null) || !!(fremd && fremd.quelle) };
  });
  r.check('GTIN → REF aus dem eigenen Bestand (kein OCR, kein Netz)',
    ohneOcr.ref === 'BEKANNT1' && ohneOcr.herkunft === 'stammsatz');
  r.check('Unbekannte GTIN blockiert nicht und erfindet nichts', ohneOcr.fremdIstNullOderTreffer);

  // ─────────── 6) Geführte Erfassung: zwei Schritte, Herkunft je Feld ───────────
  const wiz = await A.page.evaluate(() => {
    doLogin('1234567');
    openScanItem('', true);
    ocrWizStart();
    const auf = !!document.querySelector('#ocrWiz.show');
    const schritt1 = document.getElementById('wizBody').textContent;
    // Schritt ② simulieren (ohne Kamera): Ergebnis setzen und weiterblättern
    WIZ.gtin = '04012345678901';
    WIZ.gtinTreffer = { ref: 'BEKANNT1', name: 'Testschleuse', hersteller: 'Terumo', quelle: 'eigener Stammsatz', herkunft: 'stammsatz' };
    WIZ.fields = { ref: 'BEKANNT1', hersteller: 'Terumo', french: '6F' };
    WIZ.refInfo = { wie: 'exakt', sicher: true, kandidaten: [] };
    WIZ.schritt = 2; wizRender();
    const zeilen = wizZusammenfassung(WIZ);
    const text = document.getElementById('wizBody').textContent;
    wizApply();
    const zu = !document.querySelector('#ocrWiz.show');
    const val = (id) => { const el = document.getElementById(id); return el ? el.value : null; };
    const groessen = [...document.querySelectorAll('#scSizes .merk-wert')].map(i => i.value);
    return { auf, schritt1, zeilen, text, zu,
      formRef: val('scRef'), formHerst: val('scHersteller'), formGtin: val('scGtin'), groessen };
  });
  r.check('Assistent öffnet sich mit Schritt 1 (Barcode)', wiz.auf && /Schritt 1 von 3/.test(wiz.schritt1));
  r.check('Assistent bietet „Ein Foto genügt"', /Ein Foto genügt/.test(wiz.schritt1));
  r.check('Ergebnisseite nennt zu jedem Wert die Herkunft',
    wiz.zeilen.length >= 3 && wiz.zeilen.every(z => !!z[2]) && /exakt/.test(wiz.text));
  r.check('Übernehmen füllt Formular + GTIN und schließt den Assistenten',
    wiz.zu && wiz.formRef === 'BEKANNT1' && wiz.formHerst === 'Terumo' && wiz.formGtin === '04012345678901');
  r.check('Maße landen in der Maßliste', wiz.groessen.includes('6F'));

  // ─────────── 7) Vorverarbeitung: keine Auflösung mehr verschenken ───────────
  const pre = await A.page.evaluate(async () => {
    // Ein „Foto" mit 3000 px Kantenlänge – früher wurde auf 2200 heruntergerechnet.
    const c = document.createElement('canvas'); c.width = 3000; c.height = 1500;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 3000, 1500);
    g.fillStyle = '#000'; g.font = 'bold 40px Arial'; g.fillText('REF X1', 40, 80);
    const src = c.toDataURL('image/png');
    const masse = await new Promise(res => ocrRender(src, { modus: 'grau' }, (d, m) => res(m)));
    return { breite: masse && masse.w, grenze: OCR_MAXKANTE };
  });
  r.check('Vorverarbeitung skaliert erst ab ' + pre.grenze + ' px herunter (nicht mehr 2200)',
    pre.grenze >= 3500 && pre.breite === 3000);

  r.check('keine CSP-/Konsolenfehler', A.errs.filter(e => /content security|refused|wasm/i.test(e)).length === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
