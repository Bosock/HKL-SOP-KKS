/* EDITOR AM PC (features/editor.js) — im echten Browser, am breiten Schirm.

   Geprüft wird, was der Wunsch war, und das, woran er scheitern könnte:
     · Ankreuzen legt eine Zeile an, die auf das PRODUKT zeigt (nicht auf ein
       Wort); Haken weg nimmt sie wieder heraus.
     · Ziehen ohne Modus: aus der Bibliothek an eine Stelle, zwischen
       Rubriken, in einen Abschnitt.
     · Das, was beim Verschieben verrutschen könnte: Änderungen „nur hier"
       (Schnellmenü-Speicher und Regeln) wandern mit ihrer Zeile mit und
       treffen nie die Nachbarzeile, die nachrückt.
     · Die normale Ansicht zeigt danach dieselbe Reihenfolge wie der Editor.
     · Zubehör: der Hinweis an der Zeile, ein Tipp ergänzt es.
     · Am Handy erscheint der Editor gar nicht. */
'use strict';
const { launchBrowser, startServer, reporter } = require('./util');

async function neuaufbauSeite(browser, base, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
  await page.goto(base + '/');
  await page.evaluate(() => { localStorage.setItem('hkl_raumwahl', 'neuaufbau'); localStorage.setItem('raum:neuaufbau:hkl_authuntil', String(Date.now() + 3600000)); });
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof RAUM !== 'undefined' && RAUM.id === 'neuaufbau' && DB && typeof onStoreSet === 'function', null, { timeout: 15000 });
  return { ctx, page, errs };
}
/* Zieht mit echten Zeiger-Ereignissen von einem Griff auf ein Ziel. */
async function ziehen(page, vonSel, nachSel, wo) {
  /* Beide Enden sichtbar machen — die rechte Spalte scrollt für sich. Das
     Ziel in die MITTE: Am Rand läuft die Spalte beim Ziehen absichtlich mit,
     und dann stünde unter dem Zeiger am Ende etwas anderes. */
  await page.locator(nachSel).first().evaluate(el => el.scrollIntoView({ block: 'center' }));
  await page.locator(vonSel).first().scrollIntoViewIfNeeded();
  const a = await page.locator(vonSel).first().boundingBox();
  const b = await page.locator(nachSel).first().boundingBox();
  const zx = b.x + b.width / 2;
  const zy = wo === 'oben' ? b.y + 4 : (wo === 'unten' ? b.y + b.height - 4 : b.y + b.height / 2);
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(a.x + (zx - a.x) * i / 8, a.y + (zy - a.y) * i / 8);
  await page.mouse.up();
  await page.waitForTimeout(250);
}

(async () => {
  const r = reporter('editor');
  const srv = await startServer();
  const browser = await launchBrowser();
  const { page, errs } = await neuaufbauSeite(browser, srv.base, { width: 1400, height: 900 });

  const G = { inq: '04015630006127', kab: '04015630099990', sch: '04015630011112' };
  await page.evaluate((G) => {
    const now = new Date().toISOString();
    GTINDB[G.inq] = mergeGtinRecord(null, { gtin: G.inq, name: 'Inquiry 10-pol CS-Katheter', hersteller: 'Abbott', ref: 'IBI-81610', beziehungen: [{ art: 'zubehoer', ziel: G.kab }] }, now);
    GTINDB[G.kab] = mergeGtinRecord(null, { gtin: G.kab, name: 'IBI 1910SA Verbindungskabel', hersteller: 'Abbott', ref: 'IBI1910SA' }, now);
    GTINDB[G.sch] = mergeGtinRecord(null, { gtin: G.sch, name: 'Radialschleuse 6F', hersteller: 'Terumo', ref: 'RM*RG5J40' }, now);
    saveGtinDB();
    addStandard('EPU Test', 'EPU');
  }, G);
  const sid = await page.evaluate(() => ADDITIONS.standards[0].id);
  await page.evaluate((sid) => openStandard(sid), sid);
  r.check('am breiten Schirm: Einstieg „Im Editor bearbeiten"', await page.locator('text=Im Editor bearbeiten').count() === 1);
  await page.click('text=Im Editor bearbeiten');
  await page.waitForSelector('#edRechts');
  r.check('Editor geteilt: Bibliothek links, Standard rechts', await page.locator('#edLinks').isVisible() && await page.locator('#edRechts').isVisible());
  r.check('volle Breite (nicht die schmale Handy-Spalte)', (await page.locator('#edRechts').boundingBox()).width > 600);

  /* ── Ankreuzen ── */
  await page.click('.ed-bib-item:has-text("Inquiry") input[type=checkbox]');
  await page.waitForTimeout(200);
  const nachKreuz = await page.evaluate((sid) => { const l = ADDITIONS.entries[sid + '|1'] || []; return { n: l.length, e: l[0], link: MATLINK[l[0] && l[0].material_key] }; }, sid);
  r.check('Ankreuzen legt die Zeile im Ziel (Material) an', nachKreuz.n === 1);
  r.check('… und sie zeigt auf das Produkt (GTIN), nicht auf ein Wort', nachKreuz.e.produkt === G.inq && nachKreuz.link === G.inq);
  r.check('Zubehör-Hinweis an der Zeile („braucht …")', await page.locator('.ed-zub:has-text("1910SA")').count() === 1);
  await page.click('.ed-zub:has-text("1910SA")');
  const zub = await page.evaluate((sid) => (ADDITIONS.entries[sid + '|1'] || []).map(e => e.produkt), sid);
  r.check('ein Tipp ergänzt das Zubehör direkt dahinter', zub.length === 2 && zub[1] === G.kab);
  r.check('… danach kein Hinweis mehr', await page.locator('.ed-zub').count() === 0);
  await page.click('.ed-bib-item:has-text("Radialschleuse") input[type=checkbox]');
  await page.click('.ed-bib-item:has-text("Radialschleuse") input[type=checkbox]');
  r.check('Haken weg nimmt die Zeile wieder heraus', await page.evaluate((sid) => (ADDITIONS.entries[sid + '|1'] || []).every(e => e.produkt !== '04015630011112'), sid));

  /* ── Was nicht verrutschen darf ──
     Am Kabel (Platz 2) liegt eine Änderung „nur hier" — als Schnellmenü-
     Speicher UND als Regel. Danach wird die Zeile DAVOR (der Katheter) in eine
     andere Rubrik gezogen: Das Kabel rückt auf Platz 1. */
  const vorher = await page.evaluate((sid) => {
    const l = ADDITIONS.entries[sid + '|1']; const kab = l[1];
    const cidAlt = cidOf(sid, 1, 0, 1);
    (QE.cid[cidAlt] = QE.cid[cidAlt] || {}).mengeVal = '3x'; saveQE();
    addRule({ art: 'material', key: kab.material_key }, { art: 'stelle', wert: cidAlt }, 'spez', 'nur am Kabel');
    return { cidAlt, kabAid: kab._aid };
  }, sid);
  await page.evaluate(() => edZeichnen());
  await ziehen(page, '.ed-zeile:has-text("Inquiry") .ed-griff', '.ed-rub[data-ri="0"] .ed-leer');
  const nachZug = await page.evaluate(({ sid, kabAid }) => {
    const l0 = ADDITIONS.entries[sid + '|0'] || [], l1 = ADDITIONS.entries[sid + '|1'] || [];
    const kabEi = l1.findIndex(e => e._aid === kabAid);
    const cidNeu = cidOf(sid, 1, 0, kabEi);
    const kab = l1[kabEi];
    return { r0: l0.map(e => e.produkt), r1: l1.map(e => e.produkt), cidNeu,
      mengeNeu: QE.cid[cidNeu] && QE.cid[cidNeu].mengeVal, mengeAlt: QE.cid[cidOf(sid, 1, 0, 1)] && QE.cid[cidOf(sid, 1, 0, 1)].mengeVal,
      spez: qeGet(kab, cidNeu, 'spez'),
      inq0: (ADDITIONS.entries[sid + '|0'] || [])[0] };
  }, { sid, kabAid: vorher.kabAid });
  r.check('Ziehen zwischen Rubriken: Katheter jetzt in „Saal und Geräte"', nachZug.r0.length === 1 && nachZug.r0[0] === G.inq);
  r.check('… das Kabel ist nachgerückt (Platz 1)', nachZug.r1.length === 1 && nachZug.r1[0] === G.kab && nachZug.cidNeu !== vorher.cidAlt);
  r.check('Menge „nur hier" wandert mit dem Kabel', nachZug.mengeNeu === '3x');
  r.check('… und bleibt nicht am alten Platz liegen', nachZug.mengeAlt === undefined);
  r.check('Regel „nur hier" wandert mit (zurückgenommen + neu gesetzt)', nachZug.spez === 'nur am Kabel');
  const sZeile = await page.evaluate((sid) => { const e = ADDITIONS.entries[sid + '|0'][0]; return qeGet(e, cidOf(sid, 0, 0, 0), 'spez'); }, sid);
  r.check('… und trifft NICHT die Zeile, die jetzt dort steht, wo das Kabel war', sZeile === undefined);

  /* ── Aus der Bibliothek ziehen, in einen Abschnitt ── */
  await page.fill('#edAbs-1', 'Schleusen');
  await page.click('.ed-rub[data-ri="1"] .ed-abs-neu button');
  await ziehen(page, '.ed-bib-item:has-text("Radialschleuse") .ed-griff', '.ed-gruppe[data-ri="1"][data-g="Schleusen"]');
  const absch = await page.evaluate((sid) => (ADDITIONS.entries[sid + '|1'] || []).map(e => ({ p: e.produkt, uk: e.unterkategorie })), sid);
  r.check('aus der Bibliothek in den Abschnitt „Schleusen" gezogen', absch.some(x => x.p === '04015630011112' && x.uk === 'Schleusen'));

  /* ── Ablauf: Überschriften und Zeilen, ziehen vor eine Zeile ── */
  await page.evaluate(() => edTab('frei'));
  await page.evaluate(() => edZiel(2, ''));
  for (const t of ['Patient lagern', 'Punktion vorbereiten']) {
    await page.fill('#edFreiText', t); await page.click('.ed-frei button');
  }
  await page.fill('#edAbs-2', 'Punktion');
  await page.click('.ed-rub[data-ri="2"] .ed-abs-neu button');
  await ziehen(page, '.ed-zeile:has-text("Punktion vorbereiten") .ed-griff', '.ed-gruppe[data-ri="2"]:has-text("Punktion") .ed-leer');
  const ablauf = await page.evaluate((sid) => (ADDITIONS.entries[sid + '|2'] || []).map(e => (e.natur === 'ueberschrift' ? '#' : '') + e.anzeige_text), sid);
  r.check('Ablauf: Zeile in den Abschnitt „Punktion" gezogen', JSON.stringify(ablauf) === JSON.stringify(['Patient lagern', '#Punktion', 'Punktion vorbereiten']));
  await page.click('.ed-zeile:has-text("Punktion vorbereiten") button[aria-label="Nach oben"]');
  const hoch = await page.evaluate((sid) => (ADDITIONS.entries[sid + '|2'] || []).map(e => (e.natur === 'ueberschrift' ? '#' : '') + e.anzeige_text), sid);
  r.check('▲ am Anfang eines Abschnitts: ans Ende des Abschnitts davor', JSON.stringify(hoch) === JSON.stringify(['Patient lagern', 'Punktion vorbereiten', '#Punktion']));

  /* ── Menge direkt in der Zeile ── */
  await page.fill('.ed-zeile:has-text("Radialschleuse") .ed-menge', '2x');
  await page.press('.ed-zeile:has-text("Radialschleuse") .ed-menge', 'Tab');
  r.check('Menge direkt in der Zeile', await page.evaluate((sid) => (ADDITIONS.entries[sid + '|1'] || []).some(e => e.produkt === '04015630011112' && e.menge === '2x'), sid));

  /* ── Die normale Ansicht zeigt dasselbe ── */
  await page.click('.ed-std-kopf button');
  await page.waitForSelector('#scr-rubriken.active');
  await page.evaluate(() => openRubrik(2));
  const ansicht = await page.evaluate(() => [...document.querySelectorAll('#scr-detail .e-text')].map(x => x.textContent.trim()));
  r.check('normale Ansicht: dieselbe Reihenfolge wie im Editor', ansicht.length === 2 && /Patient lagern/.test(ansicht[0]) && /Punktion vorbereiten/.test(ansicht[1]));
  await page.evaluate(() => openRubrik(1));
  const mat = await page.evaluate(() => document.querySelector('#scr-detail').textContent);
  r.check('normale Ansicht: Produktname an der Zeile, Abschnitt „Schleusen"', /Radialschleuse 6F/.test(mat) && /Schleusen/.test(mat));
  await page.evaluate((G) => { GTINDB[G.sch].name = 'Glidesheath Slender 6F'; saveGtinDB(); openRubrik(1); }, G);
  r.check('Produkt umbenannt → die Zeile folgt (sie zeigt aufs Produkt)', /Glidesheath Slender 6F/.test(await page.evaluate(() => document.querySelector('#scr-detail').textContent)));

  r.check('keine Konsolenfehler' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''), errs.length === 0);

  /* ── Am Handy: kein Editor ── */
  const handy = await neuaufbauSeite(browser, srv.base, { width: 390, height: 844 });
  await handy.page.evaluate((sid) => openStandard(sid), sid);
  r.check('am Handy erscheint der Editor nicht (Bedienung bleibt, wie sie ist)', await handy.page.locator('text=Im Editor bearbeiten').count() === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
