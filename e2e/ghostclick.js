/* GEISTER-KLICK-Regression (Android-Kompatibilitäts-Mausereignisse).
   Ursache zweier Live-Bugs: Nach jedem Finger-Tipp feuert Android zusätzlich
   Maus-Ereignisse an derselben Position. Rendert der Tap eine neue Ansicht,
   trafen diese die NEUE Liste → „Standard wählen springt direkt in eine
   Rubrik" und „Häkchen erscheinen ohne Nutzer-Aktion". Der Test simuliert
   exakt diese Ereigniskette (Touch-Tap + Maus-Paar hinterher) und prüft
   zusätzlich, dass gewollte Bedienung (Abhaken, Long-Press, ⋯-Buttons,
   reine Maus am Desktop) unangetastet bleibt. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');
const wait = ms => new Promise(r => setTimeout(r, ms));

/* Android-Tipp: echte Touch-Ereignisse, danach die Kompatibilitäts-
   Mausereignisse an derselben Position (Verhalten ohne preventDefault). */
async function androidTap(page, x, y) {
  await page.touchscreen.tap(x, y);
  await wait(30);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
}

(async () => {
  const r = reporter('ghostclick');
  const srv = await startServer();
  const browser = await launchBrowser();

  /* ── Touch-Gerät ── */
  const A = await bootPage(browser, srv.base, { hasTouch: true });

  // 1) Tipp auf einen Standard bleibt in der Rubriken-ÜBERSICHT
  const p = await A.page.evaluate(() => {
    const rw = document.querySelector('#scr-standards .std');
    const b = rw.getBoundingClientRect();
    return { x: b.left + b.width * 0.35, y: b.top + b.height / 2 };
  });
  await androidTap(A.page, p.x, p.y);
  await wait(120);
  const s1 = await A.page.evaluate(() => ({
    active: [...document.querySelectorAll('.screen.active')].map(x => x.id).join(','),
    checks: Object.keys(checks).length,
  }));
  r.check('Tipp auf Standard bleibt in der Übersicht (kein Geistersprung)', s1.active === 'scr-rubriken');

  // 2) Tipp auf eine Rubrik erzeugt KEIN Geister-Häkchen
  const q = await A.page.evaluate(() => {
    checks = {}; saveChecks();
    const rw = document.querySelector('#scr-rubriken .rub');
    const b = rw.getBoundingClientRect();
    return { x: b.left + b.width * 0.35, y: b.top + b.height / 2 };
  });
  await androidTap(A.page, q.x, q.y);
  await wait(120);
  const s2 = await A.page.evaluate(() => ({
    active: [...document.querySelectorAll('.screen.active')].map(x => x.id).join(','),
    checks: Object.keys(checks).length,
  }));
  r.check('Tipp auf Rubrik öffnet die Rubrik', s2.active === 'scr-detail');
  r.check('… ohne Geister-Häkchen (nur Nutzer haken ab)', s2.checks === 0);

  // 3) Bewusstes Abhaken per Tipp funktioniert weiter (hin und zurück)
  const e1 = await A.page.evaluate(() => {
    const el = document.querySelector('#scr-detail .entry-row');
    const b = el.getBoundingClientRect();
    return { x: b.left + b.width * 0.5, y: b.top + b.height / 2 };
  });
  await A.page.touchscreen.tap(e1.x, e1.y); await wait(80);
  const c1 = await A.page.evaluate(() => Object.keys(checks).length);
  await A.page.touchscreen.tap(e1.x, e1.y); await wait(80);
  const c2 = await A.page.evaluate(() => Object.keys(checks).length);
  r.check('bewusstes Abhaken per Tipp funktioniert', c1 === 1 && c2 === 0);

  // 4) Long-Press öffnet das Menü (kein Abhaken, kein Geisterklick ins Menü)
  await A.page.evaluate(() => { doLogin('1234567'); });
  const cdp = await A.ctx.newCDPSession(A.page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: e1.x, y: e1.y }] });
  await wait(650);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await wait(120);
  const lp = await A.page.evaluate(() => ({ sheet: document.getElementById('sheet').classList.contains('show'), checks: Object.keys(checks).length }));
  r.check('Long-Press öffnet Menü, ohne abzuhaken', lp.sheet === true && lp.checks === 0);
  await A.page.evaluate(() => showSheet(false));

  // 5) ⋯-Button (inline onclick) funktioniert weiter per Touch
  await A.page.evaluate(() => { openStandard(curStd.id, true); });
  await wait(60);
  const dots = await A.page.evaluate(() => {
    const b = document.querySelector('#scr-rubriken .rub-menu-btn'); if (!b) return null;
    const r2 = b.getBoundingClientRect(); return { x: r2.left + r2.width / 2, y: r2.top + r2.height / 2 };
  });
  if (dots) {
    await A.page.touchscreen.tap(dots.x, dots.y); await wait(120);
    const dsheet = await A.page.evaluate(() => document.getElementById('sheet').classList.contains('show'));
    r.check('⋯-Button (Rubrik-Menü) öffnet weiterhin per Touch', dsheet === true);
  }

  /* ── Maus-Gerät (Desktop) ── */
  const B = await bootPage(browser, srv.base);
  const pB = await B.page.evaluate(() => {
    const rw = document.querySelector('#scr-standards .std');
    const b = rw.getBoundingClientRect();
    return { x: b.left + b.width * 0.35, y: b.top + b.height / 2 };
  });
  await B.page.mouse.move(pB.x, pB.y); await B.page.mouse.down(); await B.page.mouse.up();
  await wait(100);
  const bScr = await B.page.evaluate(() => [...document.querySelectorAll('.screen.active')].map(x => x.id).join(','));
  r.check('Maus (Desktop): Klick öffnet die Standard-Übersicht', bScr === 'scr-rubriken');

  r.check('keine Konsolenfehler (Touch)', A.errs.length === 0);
  r.check('keine Konsolenfehler (Maus)', B.errs.length === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
