/* 413-Kette Server→Client: Bei Überschreiten von MAX_BODY antwortet der
   Server sauber 413 (kein Socket-Abriss), der Client meldet „zu groß" statt
   „Server nicht erreichbar", behält die Daten lokal und hämmert nicht. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('payload-too-large');
  const srv = await startServer({ MAX_BODY: '2000' });   // winziges Limit erzwingt 413
  const browser = await launchBrowser();
  const { page, errs } = await bootPage(browser, srv.base);

  await page.evaluate(() => { doLogin('1234567'); TXT.appTitle = 'X'.repeat(5000); saveTXT(); });

  let dot = null;
  for (let i = 0; i < 40; i++) {
    dot = await page.evaluate(() => { const d = document.getElementById('syncDot'); return { cls: d.className, title: d.title, label: d.textContent }; });
    if (/zu groß/i.test(dot.title)) break;
    await page.waitForTimeout(200);
  }
  r.check('Client meldet „zu groß" (nicht „nicht erreichbar")', /zu groß/i.test(dot.title) && !/nicht erreichbar/i.test(dot.title));
  r.check('Status-Pill zeigt „lokal"', dot.label === 'lokal');
  r.check('Daten lokal erhalten', await page.evaluate(() => (loadJSON('hkl_txt', {}).appTitle || '').length === 5000));
  r.check('Server hat nichts übernommen (rev=0)', (await page.evaluate(async () => (await fetch('/api/state', { cache: 'no-store' })).json())).rev === 0);

  const real = errs.filter(e => !/413|Payload Too Large/i.test(e));  // der 413-Netzlog ist erwartet
  r.check('keine echten Konsolenfehler', real.length === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
