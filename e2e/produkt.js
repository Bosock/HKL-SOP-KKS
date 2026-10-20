/* PRODUKT ERFASSEN IM NEUAUFBAU (features/produkt.js, beziehungen.js,
   notizen.js) — im echten Browser.

   Der Weg, um den es geht: Barcode → Etikett-Foto → Produkt-Foto → Name,
   Synonyme. Dazu die Schlüssel (GTIN der Einheit, REF als Zweitschlüssel),
   die Verpackungsstufen (Karton-GTIN mit Stückzahl — auch aus AccessGUDID),
   die Beziehungen (Zubehör, Aufbereitung), der Export für Excel/SAP und der
   Notiz-Knopf. Und: Im Bestand erscheint davon nichts, bis es freigegeben
   wird. */
'use strict';
const fs = require('fs');
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
const PNG2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
/* Gültige GTINs (Prüfziffer stimmt). */
const G = { inq: '04015630006120', kab: '04015630099993', karton: '14015630006127', kiste: '24015630006124' };

async function neuaufbau(browser, base, vorher) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  /* Abfangen VOR dem ersten Laden: Danach steuert der Service Worker die
     Seite, und Playwright sähe die Anfrage sonst nicht mehr. */
  if (vorher) await vorher(page);
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
  await page.goto(base + '/');
  await page.evaluate(() => { localStorage.setItem('hkl_raumwahl', 'neuaufbau'); localStorage.setItem('raum:neuaufbau:hkl_authuntil', String(Date.now() + 3600000)); });
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof RAUM !== 'undefined' && RAUM.id === 'neuaufbau' && DB && typeof onStoreSet === 'function', null, { timeout: 15000 });
  return { ctx, page, errs };
}
async function speichern(page) {
  await page.click('#scr-scan-item button:has-text("Speichern")');
  await page.waitForTimeout(900);
}

(async () => {
  const r = reporter('produkt');
  const srv = await startServer();
  const browser = await launchBrowser();
  /* AccessGUDID nachgestellt: Die Kiste (24…) enthält 4 Kartons (14…) zu je
     10 Einheiten (04…). Gefragt wird nach der Kiste. */
  const { page, errs } = await neuaufbau(browser, srv.base, (p) => p.route('https://accessgudid.nlm.nih.gov/**', route => {
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ gudid: { device: {
        brandName: 'Inquiry', catalogNumber: 'IBI-81610', companyName: 'Abbott Medical',
        identifiers: { identifier: [
          { deviceId: G.inq, deviceIdType: 'Primary' },
          { deviceId: G.karton, deviceIdType: 'Package', containsDINumber: G.inq, pkgQuantity: 10, pkgType: 'Box' },
          { deviceId: G.kiste, deviceIdType: 'Package', containsDINumber: G.karton, pkgQuantity: 4, pkgType: 'Case' },
        ] } } } }) });
  }));

  /* ── 1. Gescannt wird die KISTE ── */
  await page.evaluate((g) => { lastScanInfo = { gtin: g, itemRef: '' }; openScanItem(g, true); }, G.kiste);
  await page.waitForSelector('#pdGudid .pd-gudid-box', { timeout: 8000 });
  const hinweis = await page.locator('#pdGudid').textContent();
  r.check('AccessGUDID erkennt: das ist eine Verpackung mit 40 Stück', /Verpackung mit 40 Stück/.test(hinweis) && hinweis.includes(G.inq));
  await page.click('#pdGudid button:has-text("Unter der Einheit anlegen")');
  await page.waitForTimeout(300);
  const einheit = await page.evaluate(() => ({ g: document.querySelector('#scr-scan-item [data-g]').dataset.g,
    pack: produktPackLesen() }));
  r.check('… das Formular wechselt zur GTIN der EINHEIT', einheit.g === G.inq);
  r.check('… mit der Kiste als Verpackungsstufe (40 Stück)', einheit.pack.some(p => p.gtin.replace(/^0+/, '') === G.kiste.replace(/^0+/, '') && +p.menge === 40));
  await page.waitForSelector('#pdGudid .pd-gudid-box', { timeout: 8000 });
  await page.click('#pdGudid button:has-text("Verpackungsstufen übernehmen")');
  await page.click('#pdGudid button:has-text("In leere Felder übernehmen")');
  r.check('weitere Stufe (Karton, 10) und Angaben aus AccessGUDID übernommen',
    await page.evaluate(() => produktPackLesen().some(p => +p.menge === 10)) && await page.inputValue('#scRef') === 'IBI-81610');

  /* ── 2. Fotos mit Rolle, Name, Synonyme ── */
  r.check('Schnellknöpfe „Etikett fotografieren" / „Produkt fotografieren"',
    await page.locator('.gal-schnell button:has-text("Etikett fotografieren")').count() === 1 && await page.locator('.gal-schnell button:has-text("Produkt fotografieren")').count() === 1);
  await page.evaluate(([a, b]) => { scanGalerieAdd(a, '', 'etikett'); scanGalerieAdd(b, '', 'produkt'); }, [PNG, PNG2]);
  await page.waitForTimeout(800);
  r.check('jedes Bild zeigt seine Rolle', await page.evaluate(() => [...document.querySelectorAll('.gal-rolle')].map(s => s.value).join(',')) === 'etikett,produkt');
  await page.fill('#scName', 'Inquiry 10-pol CS-Katheter');
  await page.fill('#pdSyn', 'CS-Katheter, Coronarsinus-Katheter, cs-katheter');
  await page.fill('#scHersteller', 'Abbott');
  await page.fill('#scPreis', '189,50');
  await page.evaluate(() => { const z = [...document.querySelectorAll('#pdPack .pd-pack')].find(x => x.querySelector('.pd-pack-m').value === '10'); z.querySelector('input[type=radio]').checked = true; });
  await speichern(page);
  const inq = await page.evaluate((g) => GTINDB[g], G.inq);
  r.check('gespeichert unter der GTIN der Einheit', !!inq && inq.ref === 'IBI-81610');
  r.check('Synonyme ohne Dubletten', JSON.stringify(inq.synonyme) === JSON.stringify(['CS-Katheter', 'Coronarsinus-Katheter']));
  r.check('Bilder liegen im Medienspeicher des Neuaufbaus, mit Rolle',
    inq.fotos.length === 2 && inq.fotos.every(f => /\/api\/media\/[0-9a-f]{32}\?raum=neuaufbau/.test(f.src)) && inq.fotos[0].rolle === 'etikett' && inq.fotos[1].rolle === 'produkt');
  r.check('Verpackungsstufen: Karton 10 (Bestelleinheit) und Kiste 40',
    inq.packungen.length === 2 && inq.packungen[0].menge === 10 && inq.packungen[0].bestell === true && inq.packungen[1].menge === 40);
  r.check('Suche findet das Produkt über ein Synonym', await page.evaluate(() => filterGtin(Object.values(GTINDB), 'coronarsinus').length === 1));

  /* ── 3. Den Karton scannen → das Produkt der Einheit ── */
  await page.evaluate((g) => onDecode('01' + g, 'data_matrix'), G.karton);
  await page.waitForTimeout(300);
  r.check('gescannter Karton führt zum Produkt der Einheit (kein zweites Produkt)',
    await page.evaluate((g) => document.querySelector('#scr-scan-item .pc-name').textContent.includes('Inquiry') && !GTINDB[gtinKey(g)], G.karton));

  /* ── 4. REF als Zweitschlüssel, Prüfziffer, Verpackung schon vergeben ── */
  await page.evaluate((g) => openScanItem(g, true), G.kab);
  await page.fill('#scHersteller', 'Abbott');
  await page.fill('#scName', 'IBI 1910SA Verbindungskabel');
  await page.fill('#scRef', 'ibi 81610');
  await page.dispatchEvent('#scRef', 'input');
  r.check('REF-Dublette wird sofort gemeldet (auch in anderer Schreibweise)', /steht schon an/.test(await page.locator('#pdRefWarn').textContent()));
  await speichern(page);
  r.check('… und blockiert das Speichern, bis bewusst bestätigt', await page.evaluate((g) => !GTINDB[g], G.kab) && await page.locator('#pdRefOk').count() === 1);
  await page.fill('#scRef', 'IBI1910SA');
  await page.evaluate(() => produktPackNeu({ gtin: '14015630006128', menge: 5 }));
  await speichern(page);
  r.check('falsche Prüfziffer in einer Verpackungsstufe wird abgewiesen', await page.evaluate((g) => !GTINDB[g], G.kab));
  await page.evaluate((k) => { document.querySelector('#pdPack .pd-pack').remove(); produktPackNeu({ gtin: k, menge: 5 }); }, G.karton);
  await speichern(page);
  r.check('eine Karton-GTIN, die schon einem anderen Produkt gehört, wird abgewiesen', await page.evaluate((g) => !GTINDB[g], G.kab));
  await page.evaluate(() => document.querySelector('#pdPack .pd-pack').remove());

  /* ── 5. Beziehungen ── */
  r.check('Formular: Beziehungen (🧩 braucht dazu · ♻️ aufbereitet)', await page.locator('#bzhBox .bzh-zeile').count() === 2);
  await speichern(page);
  r.check('Kabel gespeichert', await page.evaluate((g) => !!GTINDB[g], G.kab));
  await page.evaluate((g) => openScanItem(g, true), G.inq);
  await page.click('#bzhBox .bzh-zeile:first-child button.vlink');
  await page.waitForSelector('#bzhListe');
  await page.click('#bzhListe .sheet-act:has-text("Verbindungskabel")');
  r.check('Zubehör gewählt (Chip im Formular)', /Verbindungskabel/.test(await page.locator('#bzhBox').textContent()));
  await speichern(page);
  r.check('gespeichert: der Katheter braucht das Kabel', await page.evaluate(([a, b]) => (GTINDB[a].beziehungen || []).some(x => x.art === 'zubehoer' && x.ziel === b), [G.inq, G.kab]));
  await page.evaluate((g) => openScanItem(g, false), G.kab);
  r.check('am Kabel steht die Gegenrichtung („wird gebraucht von")', /Wird gebraucht von[\s\S]*Inquiry/.test(await page.locator('#scr-scan-item').textContent()));

  /* ── 6. Export für Excel/SAP ── */
  await page.evaluate(() => setMode('care'));
  r.check('Materialzentrale: Knopf „Export für Excel/SAP"', await page.locator('button:has-text("Export für Excel/SAP")').count() === 1);
  await page.click('button:has-text("Export für Excel/SAP")');
  const [csvDl] = await Promise.all([page.waitForEvent('download'), page.click('.sheet-act:has-text("Nur die Tabelle")')]);
  const csv = fs.readFileSync(await csvDl.path(), 'utf8');
  const zeilen = csv.replace(/^﻿/, '').split('\r\n');
  r.check('CSV: Kopf mit GTIN, REF, Name, Hersteller, Packungsgröße, Preisen', /^GTIN \(Einheit\);REF;Name;Hersteller;Kategorie;Synonyme;Stückpreis EUR;Packungsgröße \(Stück\);GTIN Bestelleinheit;Packungspreis EUR/.test(zeilen[0]));
  const inqZeile = zeilen.find(z => z.startsWith(G.inq)) || '';
  r.check('CSV: Packungsgröße 10, Packungspreis 1895,00, Zubehör benannt', inqZeile.includes(';189,50;10;' + G.karton + ';1895,00;') && /IBI 1910SA Verbindungskabel/.test(inqZeile));
  r.check('CSV: Bildnamen GTIN_REF_rolle', inqZeile.includes(G.inq + '_IBI-81610_etikett.jpg') && inqZeile.includes(G.inq + '_IBI-81610_produkt.jpg'));
  await page.click('button:has-text("Export für Excel/SAP")');
  const [zipDl] = await Promise.all([page.waitForEvent('download'), page.click('.sheet-act:has-text("Tabelle + alle Bilder")')]);
  const zip = fs.readFileSync(await zipDl.path());
  const zipText = zip.toString('latin1');
  r.check('ZIP: gültige Datei mit Tabelle und benannten Bildern', zip.slice(0, 4).toString('hex') === '504b0304' && zipText.includes('material.csv')
    && zipText.includes('bilder/' + G.inq + '_IBI-81610_etikett.jpg') && zipText.includes('bilder/' + G.inq + '_IBI-81610_produkt.jpg'));

  /* ── 7. Notiz ── */
  await page.evaluate((g) => openScanItem(g, false), G.inq);
  await page.click('#notizBtn');
  await page.fill('#notizText', 'Verpackungsstufen auch in der Rüstliste anzeigen?');
  await page.click('#sheet .filter-row button:has-text("Frage")');
  await page.click('button:has-text("Notiz speichern")');
  const notiz = await page.evaluate(() => NOTIZEN[0]);
  r.check('Notiz gespeichert — mit Art und Ort (Produkt)', notiz && notiz.art === 'frage' && /Rüstliste/.test(notiz.text) && notiz.kontext.produkt === G.inq);
  r.check('Knopf zählt offene Notizen', /Notiz · 1/.test(await page.locator('#notizBtn').textContent()));
  await page.evaluate(() => setMode('admin'));
  r.check('Verwaltung: Karte „Notizen" listet sie', /Rüstliste/.test(await page.locator('#notizKarte').textContent()));
  const [mdDl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => notizExport())]);
  r.check('Notizen als Datei', /# Notizen aus dem Neuaufbau[\s\S]*❓ Frage[\s\S]*Rüstliste/.test(fs.readFileSync(await mdDl.path(), 'utf8')));

  r.check('keine Konsolenfehler' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''), errs.length === 0);

  /* ── 8. Im Bestand: nichts davon — bis es freigegeben wird ── */
  const b = await bootPage(browser, srv.base);
  await b.page.evaluate(() => { doLogin('1234567'); raumPwSetzen('testraum'); openScanItem('04012345678901', true); });
  const vorFrei = await b.page.evaluate(() => ({ syn: !!document.getElementById('pdSyn'), pack: !!document.getElementById('pdPack'), rollen: document.querySelectorAll('.gal-schnell').length, bzh: !!document.getElementById('bzhBox'), gudid: !!document.getElementById('pdGudid'), leiste: !!document.getElementById('raumLeiste') }));
  r.check('Bestand: Produktformular wie immer (keine Neuerung sichtbar)', !vorFrei.syn && !vorFrei.pack && !vorFrei.rollen && !vorFrei.bzh && !vorFrei.gudid && !vorFrei.leiste);
  await b.page.evaluate(() => setMode('admin'));
  await b.page.evaluate(() => { const d = [...document.querySelectorAll('#scr-admin details.vpanel')].find(x => x.querySelector('.vp-title').textContent === 'Neuaufbau'); d.open = true; document.getElementById('raumFreigaben').open = true; });
  await b.page.fill('#raumPwFrei', 'falsch');
  await b.page.click('button:has-text("Freigaben anzeigen")');
  r.check('Freigaben nur mit dem Zweitpasswort', await b.page.locator('#raumFreigaben input[type=checkbox]').count() === 0);
  await b.page.evaluate(() => { document.querySelector('#raumFreigaben').open = true; });
  await b.page.fill('#raumPwFrei', 'testraum');
  await b.page.click('button:has-text("Freigaben anzeigen")');
  await b.page.waitForTimeout(150);
  r.check('… dann je Neuerung ein Schalter', await b.page.locator('#raumFreigaben input[type=checkbox]').count() === 7);
  await b.page.check('#raumFreigaben input[data-k="synonyme"]');
  await b.page.evaluate(() => openScanItem('04012345678901', true));
  r.check('freigegebene Neuerung (Synonyme) erscheint jetzt auch im Bestand', await b.page.evaluate(() => !!document.getElementById('pdSyn') && !document.getElementById('pdPack')));
  await b.page.waitForTimeout(1500);
  const frei = (await (await fetch(srv.base + '/api/state')).json()).state.hkl_neufrei || {};
  r.check('Freigabe liegt im geteilten Zustand des Bestands (auf dem Server)', frei.synonyme === true);
  const nbFrei = (await (await fetch(srv.base + '/api/state?raum=neuaufbau')).json()).state.hkl_neufrei;
  r.check('… und nicht im Neuaufbau', nbFrei === undefined);

  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
