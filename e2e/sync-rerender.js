/* Sync-Effizienz: die eigene Bearbeitung erreicht den Server, löst aber KEIN
   überflüssiges refreshView() aus; eine Fremdänderung (direkter PUT eines
   anderen „Geräts") MUSS eines auslösen und übernommen werden. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('sync-rerender');
  const srv = await startServer();
  const browser = await launchBrowser();
  const { page, errs } = await bootPage(browser, srv.base);
  await page.waitForTimeout(400);

  await page.evaluate(() => { window.__rv = 0; const o = window.refreshView; window.refreshView = function () { window.__rv++; return o.apply(this, arguments); }; });

  const marker = 'RV' + Date.now();
  await page.evaluate(m => { doLogin('1234567'); TXT.appTitle = 'Eigen_' + m; saveTXT(); }, marker);

  let ownOnServer = false;
  for (let i = 0; i < 30; i++) {
    const j = await page.evaluate(async () => (await fetch('/api/state', { cache: 'no-store' })).json());
    if (j.state && j.state.hkl_txt && String(j.state.hkl_txt.appTitle || '').startsWith('Eigen_')) { ownOnServer = true; break; }
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(600);
  const rvOwn = await page.evaluate(() => window.__rv);
  r.check('eigene Bearbeitung erreicht den Server', ownOnServer);
  r.check('… löst aber KEIN Re-Rendering aus (0)', rvOwn === 0);

  await page.evaluate(async m => { await fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: { hkl_glossary: [{ id: 'fx', term: 'FX_' + m, def: 'd' }] } }) }); }, marker);
  let foreignSeen = false;
  for (let i = 0; i < 40; i++) {
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    if (await page.evaluate(m => Array.isArray(GLOSSARY) && GLOSSARY.some(x => x.term === 'FX_' + m), marker)) { foreignSeen = true; break; }
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(300);
  const rvForeign = await page.evaluate(() => window.__rv);
  r.check('Fremdänderung wird übernommen', foreignSeen);
  r.check('… und rendert genau dann neu (≥1)', rvForeign >= 1);

  r.check('keine Konsolenfehler', errs.length === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
