/* FOTO-EDITOR (Zuschneiden/Drehen) + Einbindung in Scanner-Produkt & Material-
   pflege. Prüft: Editor-Overlay öffnet/schließt, „Übernehmen" liefert ein
   bearbeitetes Bild, Drehen ändert die Ausmaße, und das Foto landet sowohl im
   Etikett-Produkt (GTINDB.photo) als auch bei „Material pflegen" (careMem). */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');
(async () => {
  const r = reporter('photoedit');
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);

  // 1) openPhotoEditor: Overlay öffnet, „Übernehmen" liefert data-URL, schließt.
  const flow = await A.page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 60; c.height = 40;
    c.getContext('2d').fillStyle = '#0a0'; c.getContext('2d').fillRect(0, 0, 60, 40);
    const src = c.toDataURL('image/png');
    const p = new Promise((res) => openPhotoEditor(src, res));
    await new Promise(r => requestAnimationFrame(() => r()));
    await new Promise(r => setTimeout(r, 40));
    const opened = !!document.getElementById('photoEditOv');
    document.getElementById('peApply').click();
    const result = await p;
    const closed = !document.getElementById('photoEditOv');
    return { opened, closed, isJpeg: typeof result === 'string' && result.indexOf('data:image/jpeg') === 0 };
  });
  r.check('Foto-Editor öffnet als Overlay', flow.opened);
  r.check('„Übernehmen" liefert ein bearbeitetes Bild (JPEG data-URL)', flow.isJpeg);
  r.check('Editor schließt nach Übernehmen', flow.closed);

  // 2) Abbrechen liefert null und schließt.
  const cancel = await A.page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 30; c.height = 30; c.getContext('2d').fillRect(0, 0, 30, 30);
    const p = new Promise((res) => openPhotoEditor(c.toDataURL('image/png'), res));
    await new Promise(r => setTimeout(r, 40));
    document.getElementById('peCancel').click();
    const res = await p;
    return { nulled: res === null, closed: !document.getElementById('photoEditOv') };
  });
  r.check('Abbrechen liefert null und schließt', cancel.nulled && cancel.closed);

  // 3) Drehen ändert die Ausmaße (photoApply über photoCropDims).
  const rot = await A.page.evaluate(() => {
    const d0 = photoCropDims(120, 80, 0, { x: 0, y: 0, w: 1, h: 1 });
    const d90 = photoCropDims(120, 80, 90, { x: 0, y: 0, w: 1, h: 1 });
    return { normal: d0.rw === 120 && d0.rh === 80, rotated: d90.rw === 80 && d90.rh === 120 };
  });
  r.check('Drehen vertauscht Breite/Höhe', rot.normal && rot.rotated);

  // 4) Scanner-Produkt: Foto setzen → Speichern → GTINDB.photo + Thumbnail.
  const scan = await A.page.evaluate(async () => {
    doLogin('1234567'); GTINDB = {}; saveGtinDB();
    openScanItem('04012345678901', true);
    const c = document.createElement('canvas'); c.width = 20; c.height = 20; c.getContext('2d').fillStyle = '#08f'; c.getContext('2d').fillRect(0, 0, 20, 20);
    scanSetPhoto(c.toDataURL('image/jpeg'));
    document.getElementById('scHersteller').value = 'Terumo';
    document.getElementById('scRef').value = 'RG5J40';
    saveScanItem('04012345678901');
    const rec = GTINDB['04012345678901'];
    return { hasPhoto: !!(rec && rec.photo && rec.photo.indexOf('data:image') === 0), rowHasImg: /<img/.test(scanRowHTML(rec)) };
  });
  r.check('Scanner-Produkt speichert Foto (GTINDB.photo)', scan.hasPhoto);
  r.check('Produktliste zeigt Foto-Thumbnail', scan.rowHasImg);

  // 5) Scanner-Formular hat die FOTOGALERIE (mehrere Bilder je Material) mit
  //    Datei-Auswahl und Werkzeugen je Kachel.
  const form = await A.page.evaluate(() => {
    openScanItem('04012345678901', true);
    const html = document.getElementById('scr-scan-item').innerHTML;
    return {
      galerie: !!document.getElementById('scGallery'),
      kacheln: document.querySelectorAll('#scGallery .gal-item').length,
      addBtn: !!document.querySelector('#scGallery .gal-add'),
      crop: /Zuschneiden \/ drehen/.test(html),
      fileInp: !!document.getElementById('scanFileInp'),
      mehrfach: !!(document.getElementById('scanFileInp') || {}).multiple,
      zoombar: !!document.querySelector('#scGallery .gal-item img[data-zoom]'),
    };
  });
  r.check('Scanner-Formular: Fotogalerie mit vorhandenem Bild', form.galerie && form.kacheln === 1);
  r.check('Galerie: „Foto hinzufügen" + Mehrfachauswahl', form.addBtn && form.fileInp && form.mehrfach);
  r.check('Galerie: Kachel-Werkzeuge (Zuschneiden/drehen)', form.crop);
  r.check('Galerie: Bilder sind vergrößerbar (Lightbox)', form.zoombar);

  // 5b) Mehrere Fotos je Material: hinzufügen, umsortieren, speichern.
  const multi = await A.page.evaluate(() => {
    const mk = (farbe) => { const c = document.createElement('canvas'); c.width = 12; c.height = 12;
      const g = c.getContext('2d'); g.fillStyle = farbe; g.fillRect(0, 0, 12, 12); return c.toDataURL('image/jpeg'); };
    openScanItem('04012345678901', true);
    const vorher = scanGalerie.length;
    scanGalerie = matPhotoAdd(scanGalerie, mk('#0a0'), 'Etikett');
    scanGalerie = matPhotoAdd(scanGalerie, mk('#a00'), 'Anschluss');
    scanGalerieRender();
    const kacheln = document.querySelectorAll('#scGallery .gal-item').length;
    // zweites Bild zum Vorschaubild machen
    scanGalerieMain(1);
    const neuesHaupt = scanGalerie[0].titel;
    saveScanItem('04012345678901');
    const rec = GTINDB['04012345678901'];
    return { vorher, kacheln, neuesHaupt,
      gespeichert: (rec.fotos || []).length,
      vorschauIstErstes: rec.photo === (rec.fotos || [])[0].src,
      titelErhalten: (rec.fotos || []).some(f => f.titel === 'Anschluss') };
  });
  r.check('Galerie: mehrere Fotos je Material', multi.vorher === 1 && multi.kacheln === 3);
  r.check('Galerie: „★" macht ein Bild zum Vorschaubild', multi.neuesHaupt === 'Etikett');
  r.check('Galerie: alle Fotos werden gespeichert', multi.gespeichert === 3);
  r.check('Galerie: photo bleibt das erste Bild (Listen unverändert)', multi.vorschauIstErstes);
  r.check('Galerie: Bildunterschriften bleiben erhalten', multi.titelErhalten);

  // 6) KONSOLIDIERUNG: Die alte „Material pflegen“-Maske ist entfernt — Fotos
  //    haben jetzt EIN Zuhause (den Material-Stammsatz). Alt-Fotos dürfen dabei
  //    nicht verloren gehen: sie bleiben lesbar und wandern per Übernahme in
  //    den Stammsatz (mcMigrateLegacy).
  const care = await A.page.evaluate(() => {
    const m = (typeof MAT_INDEX !== 'undefined' && MAT_INDEX[0]) ? MAT_INDEX[0] : null;
    if (!m) return { skip: true };
    const alteMaskeWeg = (typeof openCare === 'undefined') && (typeof saveCare === 'undefined');
    const c = document.createElement('canvas'); c.width = 16; c.height = 16; c.getContext('2d').fillRect(0, 0, 16, 16);
    careMem[m.key] = { loc: 'Alt-Regal', photo: c.toDataURL('image/jpeg') };
    saveJSON('hkl_care', careMem);
    const offenVorher = mcLegacyPending().care;
    mcMigrateLegacy();
    const id = canonId(m.key); const rec = id ? GTINDB[id] : null;
    return { skip: false, alteMaskeWeg, offenVorher,
      imStammsatz: !!(rec && rec.photo && rec.photo.indexOf('data:image') === 0),
      altErhalten: !!(careMem[m.key] && careMem[m.key].photo) };
  });
  if (!care.skip) {
    r.check('Alte „Material pflegen“-Maske ist entfernt (eine Foto-Quelle)', care.alteMaskeWeg);
    r.check('Alt-Foto wird als offen erkannt', care.offenVorher >= 1);
    r.check('Alt-Foto landet im Material-Stammsatz', care.imStammsatz);
    r.check('Alt-Daten bleiben erhalten (kein Datenverlust)', care.altErhalten);
  }

  r.check('keine Konsolenfehler', A.errs.length === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
