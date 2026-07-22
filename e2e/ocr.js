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

  r.check('keine CSP-/Konsolenfehler', A.errs.filter(e => /content security|refused|wasm/i.test(e)).length === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
