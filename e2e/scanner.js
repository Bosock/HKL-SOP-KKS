/* ETIKETT-SCANNER end-to-end: treibt den kompletten Fluss ohne echte Kamera,
   indem onDecode(rawCode, format) mit realistischen GS1-DataMatrix-Strings
   direkt aufgerufen wird (die Kamera liefert im Betrieb genau diesen rawValue).
   Geprüft: Parser im echten Browser · unbekannter Scan → Formular · Speichern →
   Produktdatenbank · erneuter Scan → Wiedererkennung · Server-Persistenz. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

const GTIN = '04012345678901';
const GS1_NEW = '01' + GTIN + '17261130' + '10LOT9';   // + Verfall 2026-11-30 + LOT
const GS1_AGAIN = '01' + GTIN + '17270101';            // derselbe Artikel, anderer Verfall

(async () => {
  const r = reporter('scanner');
  const srv = await startServer({ BACKUP_INTERVAL_MS: '100' });
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);

  // 1) Reine Parser laufen im echten Browser-Realm (nicht nur im vm-Test).
  const p = await A.page.evaluate((gs1) => {
    const r = parseScan(gs1, 'data_matrix');
    return { kind: r.kind, gtin: r.gtin, expiry: formatGs1Date(r.expiry), lot: r.lot,
             key: gtinKey('4012345678901'), supported: typeof scannerSupported() === 'boolean' };
  }, GS1_NEW);
  r.check('parseScan erkennt GS1-DataMatrix', p.kind === 'gs1' && p.gtin === GTIN);
  r.check('formatGs1Date liefert ISO-Verfall', p.expiry === '2026-11-30');
  r.check('LOT variabel gelesen', p.lot === 'LOT9');
  r.check('gtinKey normalisiert EAN-13 → 14', p.key === GTIN);
  r.check('scannerSupported() ohne Absturz', p.supported === true);

  // 2) Unbekannter Scan → Vorbefülltes Formular (als Admin).
  const step2 = await A.page.evaluate((gs1) => {
    doLogin('1234567');
    openScanHub();
    const hub = document.getElementById('scr-scan').classList.contains('active');
    onDecode(gs1, 'data_matrix');
    const html = document.getElementById('scr-scan-item').innerHTML;
    return {
      hubActive: hub,
      formActive: document.getElementById('scr-scan-item').classList.contains('active'),
      hasRefField: !!document.getElementById('scRef'),
      showsScan: /LOT9/.test(html) && /2026-11-30/.test(html),
    };
  }, GS1_NEW);
  r.check('openScanHub zeigt den Hub', step2.hubActive);
  r.check('unbekannter Scan öffnet das Formular', step2.formActive && step2.hasRefField);
  r.check('Scan-Infos (LOT/Verfall) im Formular sichtbar', step2.showsScan);

  // 3) Ausfüllen + Speichern → Produktdatensatz unter GTIN-Schlüssel.
  const saved = await A.page.evaluate((gtin) => {
    document.getElementById('scHersteller').value = 'Terumo';
    document.getElementById('scRef').value = 'RG5J40';
    document.getElementById('scName').value = 'Radialschleuse 6F';
    document.getElementById('scFrench').value = '6F';
    saveScanItem(gtin);
    const rec = GTINDB[gtin];
    return !!(rec && rec.ref === 'RG5J40' && rec.hersteller === 'Terumo' && rec.french === '6F');
  }, GTIN);
  r.check('Speichern legt Datensatz unter GTIN an', saved);

  // openScanHub() läuft nach 500 ms Timeout → auf die Liste warten.
  await A.page.waitForTimeout(750);
  const inList = await A.page.evaluate(() => /Radialschleuse 6F/.test(document.getElementById('scr-scan').innerHTML));
  r.check('Produkt erscheint in der Datenbankliste', inList);

  // 4) Erneuter Scan desselben Artikels → Wiedererkennung (Ansicht statt Formular).
  const again = await A.page.evaluate((gs1) => {
    onDecode(gs1, 'data_matrix');
    const el = document.getElementById('scr-scan-item');
    return { viewActive: el.classList.contains('active'),
             showsHersteller: /Terumo/.test(el.innerHTML),
             isView: /Bearbeiten/.test(el.innerHTML) && !document.getElementById('scRef') };
  }, GS1_AGAIN);
  r.check('bekannter Scan zeigt den Datensatz (Ansicht)', again.viewActive && again.showsHersteller && again.isView);

  // 5) Server-Persistenz: hkl_gtin wurde geflusht und trägt den Datensatz.
  let ok = false;
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const S = (await A.page.evaluate(async () => (await fetch('/api/state', { cache: 'no-store' })).json())).state || {};
    if (S.hkl_gtin && S.hkl_gtin[GTIN] && S.hkl_gtin[GTIN].ref === 'RG5J40') { ok = true; break; }
    await A.page.waitForTimeout(400);
  }
  r.check('Server hat hkl_gtin gespeichert', ok);

  // 6) Gerät B liest den Produktdatensatz frisch vom Server.
  const B = await bootPage(browser, srv.base);
  await B.page.waitForTimeout(600);
  const onB = await B.page.evaluate((gtin) => !!(GTINDB && GTINDB[gtin] && GTINDB[gtin].ref === 'RG5J40'), GTIN);
  r.check('Gerät B sieht das gescannte Produkt', onB);

  r.check('keine Konsolenfehler (A+B)', A.errs.length + B.errs.length === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
