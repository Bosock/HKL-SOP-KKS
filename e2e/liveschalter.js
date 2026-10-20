/* LIVE-SCHALTER — der Knopf in der Verwaltung (features/raum.js) und der
   Zeiger auf dem Server (PUT /api/raeume, server/raeume.js).

   Geprüft wird, was beim Umschalten zählt:
     · ohne Passwort, mit falschem Passwort oder ohne Häkchen passiert nichts,
     · mit beidem steht der Zeiger um (mit Verlauf),
     · im Live-Raum gibt es kein Band — außerhalb immer,
     · ein Kollegen-Gerät folgt beim Aufwecken, ohne Bestandsdaten in den
       Neuaufbau zu tragen,
     · ein Gerät, an dem gerade jemand arbeitet, wird NICHT aus der Arbeit
       gerissen: Es zeigt das Band und wechselt erst nach zwei Minuten Ruhe,
     · der alte Bestand bleibt ansehbar und unverändert,
     · zurück geht es mit demselben Knopf — und wer umschaltet, geht mit. */
'use strict';
const fs = require('fs');
const path = require('path');
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

async function warte(page, fn, arg, ms) {
  try { await page.waitForFunction(fn, arg, { timeout: ms || 10000 }); return true; } catch (e) { return false; }
}
/* Warten von außen (Node-Uhr) — für die Seite mit gestellter Uhr, deren
   eigene Zeitgeber der Test vorspult. Fehler während eines Neuladens zählen
   als „noch nicht". */
async function bis(page, fn, ms) {
  const ende = Date.now() + (ms || 10000);
  while (Date.now() < ende) {
    try { if (await page.evaluate(fn)) return true; } catch (e) { /* Seite lädt gerade neu */ }
    await new Promise(r => setTimeout(r, 100));
  }
  return false;
}
async function json(base, p) { return (await fetch(base + p, { cache: 'no-store' })).json(); }
async function live(base) { return (await json(base, '/api/raeume')).live; }
const geladen = () => typeof RAUM !== 'undefined' && typeof DB !== 'undefined' && DB && typeof onStoreSet === 'function';

/* Verwaltung öffnen, Karte und Live-Abschnitt aufklappen. */
async function liveKarte(page) {
  await page.evaluate(() => setMode('admin'));
  await page.evaluate(() => { document.getElementById('raumKarte').open = true; });
  await page.waitForTimeout(400);            /* Stand vom Server nachladen lassen */
  await page.evaluate(() => { document.getElementById('raumKarte').open = true; document.getElementById('raumLiveKarte').open = true; });
}

(async () => {
  const r = reporter('liveschalter');
  const srv = await startServer();
  const browser = await launchBrowser();

  /* ── Ausgangslage: drei Geräte im Bestand ──
     A = Leitung (schaltet), B = Kollegen-Tablet, C = Kollegen-Rechner, auf
     dem gerade gearbeitet wird (mit gestellter Uhr, um zwei Minuten Ruhe
     vorspulen zu können). */
  const A = await bootPage(browser, srv.base);
  await A.page.evaluate(() => { doLogin('1234567'); TXT.appTitle = 'Bestand-Titel'; saveTXT(); });
  await warte(A.page, () => document.getElementById('syncDot').className.includes('ok'));
  await A.page.waitForTimeout(1200);
  const B = await bootPage(browser, srv.base);

  const ctxC = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pC = await ctxC.newPage();
  const errsC = [];
  pC.on('console', m => { if (m.type() === 'error') errsC.push(m.text()); });
  pC.on('pageerror', e => errsC.push('PAGEERR: ' + e.message));
  await pC.clock.install();
  await pC.goto(srv.base + '/', { waitUntil: 'networkidle' });
  r.check('Kollegen-Rechner startet im Bestand', await bis(pC, () => typeof RAUM !== 'undefined' && RAUM.id === 'bestand' && DB && DB.standards.length > 10 && typeof onStoreSet === 'function', 15000));

  r.check('live ist zu Beginn der Bestand', (await live(srv.base)) === 'bestand');
  r.check('im Bestand kein Band', await A.page.evaluate(() => !document.getElementById('raumLeiste')));

  /* ── A betritt den Neuaufbau (Vorgabe „abcdefg") und legt etwas an ── */
  await A.page.evaluate(() => setMode('admin'));
  await A.page.evaluate(() => { document.getElementById('raumKarte').open = true; });
  await A.page.fill('#raumPwEin', 'abcdefg');
  await Promise.all([A.page.waitForNavigation({ waitUntil: 'networkidle' }), A.page.click('text=Neuaufbau betreten')]);
  await warte(A.page, geladen);
  r.check('A ist im Neuaufbau (eigene Wahl), mit Band', await A.page.evaluate(() => RAUM.id === 'neuaufbau' && RAUM.wahl === 'neuaufbau' && !!document.getElementById('raumLeiste')));
  await A.page.evaluate(() => addStandard('Erster Standard im Neuaufbau', 'Test'));
  await warte(A.page, () => document.getElementById('syncDot').className.includes('ok'), null, 8000);
  await A.page.waitForTimeout(1200);
  const bestandDatei = fs.readFileSync(path.join(srv.stateDir, 'state.json'), 'utf8');

  /* ── Ohne Passwort, mit falschem Passwort, ohne Häkchen: nichts ── */
  await liveKarte(A.page);
  r.check('der Knopf bietet „Neuaufbau live schalten" an', /Neuaufbau live schalten/.test(await A.page.locator('#raumLiveBtn').textContent()));
  await A.page.check('#raumLiveOk');
  await A.page.click('#raumLiveBtn');
  await A.page.waitForTimeout(300);
  r.check('ohne Passwort: nichts geschaltet', (await live(srv.base)) === 'bestand');
  await A.page.fill('#raumPwLive', 'falsch');
  await A.page.click('#raumLiveBtn');
  await warte(A.page, () => /stimmt nicht/.test(document.getElementById('toast').textContent), null, 4000);
  r.check('falsches Passwort: der Server lehnt ab, nichts geschaltet', (await live(srv.base)) === 'bestand');
  await A.page.fill('#raumPwLive', '1234567');
  await A.page.click('#raumLiveBtn');
  await A.page.waitForTimeout(500);
  r.check('das Verwaltungspasswort schaltet nicht', (await live(srv.base)) === 'bestand');
  await A.page.fill('#raumPwLive', 'abcdefg');
  await A.page.uncheck('#raumLiveOk');
  await A.page.click('#raumLiveBtn');
  await A.page.waitForTimeout(300);
  r.check('ohne Häkchen: nichts geschaltet', (await live(srv.base)) === 'bestand');

  /* ── Umschalten: A steht schon im Neuaufbau und bleibt dort ── */
  await A.page.check('#raumLiveOk');
  await A.page.click('#raumLiveBtn');
  r.check('mit Passwort und Häkchen: live ist der Neuaufbau', await (async () => {
    for (let i = 0; i < 30; i++) { if ((await live(srv.base)) === 'neuaufbau') return true; await new Promise(x => setTimeout(x, 100)); } return false; })());
  const zeiger = JSON.parse(fs.readFileSync(path.join(srv.stateDir, 'raeume.json'), 'utf8'));
  r.check('der Zeiger hält fest, wann von wo nach wo geschaltet wurde', zeiger.live === 'neuaufbau' && Array.isArray(zeiger.verlauf)
    && zeiger.verlauf.length === 1 && zeiger.verlauf[0].vorher === 'bestand' && !!zeiger.geaendert);
  await warte(A.page, () => !document.getElementById('raumLeiste'), null, 4000);
  r.check('A: im Live-Raum verschwindet das Band, die eigene Wahl entfällt', await A.page.evaluate(() => RAUM.id === 'neuaufbau'
    && !document.getElementById('raumLeiste') && localStorage.getItem('hkl_raumwahl') === null && !/^Neuaufbau ·/.test(document.title)));

  /* A schreibt noch sein Protokoll (Meldungen landen im Raum, in dem A steht)
     — erst danach den Stand des Neuaufbaus festhalten. */
  await A.page.waitForTimeout(1800);
  await warte(A.page, () => document.getElementById('syncDot').className.includes('ok'), null, 6000);

  /* ── B (Tablet) folgt beim Aufwecken ── */
  const nbVorher = await json(srv.base, '/api/state?raum=neuaufbau');
  await B.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  const bFolgt = await bis(B.page, () => typeof RAUM !== 'undefined' && RAUM.id === 'neuaufbau' && DB && typeof onStoreSet === 'function', 15000);
  r.check('B folgt beim Aufwecken in den Neuaufbau', bFolgt);
  await B.page.waitForTimeout(1500);
  r.check('B sieht den Neuaufbau — ohne Band', await B.page.evaluate(() => DB.standards.length === 1 && !document.getElementById('raumLeiste')));
  const nbNachB = await json(srv.base, '/api/state?raum=neuaufbau');
  r.check('B trägt keine Bestandsdaten in den Neuaufbau (keine Erstbefüllung)', nbNachB.rev === nbVorher.rev && !(nbNachB.state.hkl_txt && nbNachB.state.hkl_txt.appTitle === 'Bestand-Titel'));

  /* ── C (Rechner, gerade bedient): erst Band, nach zwei Minuten Ruhe Wechsel ── */
  await pC.evaluate(() => window.dispatchEvent(new Event('pointerdown')));
  await pC.clock.fastForward(61000);
  r.check('C wird mitten in der Arbeit nicht neu geladen, sondern sieht das Band', await bis(pC, () => RAUM.id === 'bestand'
    && !!document.getElementById('raumLeiste') && /nicht live/.test(document.getElementById('raumLeiste').textContent), 8000));
  let cFolgt = false;
  for (let i = 0; i < 3 && !cFolgt; i++) {
    await pC.clock.fastForward(61000);
    cFolgt = await bis(pC, () => typeof RAUM !== 'undefined' && RAUM.id === 'neuaufbau' && typeof onStoreSet === 'function', 6000);
  }
  r.check('… und wechselt nach zwei Minuten Ruhe von selbst', cFolgt);
  r.check('C im Neuaufbau: ohne Band', await bis(pC, () => DB && DB.standards.length === 1 && !document.getElementById('raumLeiste'), 8000));

  r.check('der Bestand ist bis hierher Byte für Byte unberührt', fs.readFileSync(path.join(srv.stateDir, 'state.json'), 'utf8') === bestandDatei);

  /* ── Den alten Bestand ansehen und wieder hinaus ── */
  await A.page.evaluate(() => setMode('admin'));
  await A.page.evaluate(() => { document.getElementById('raumKarte').open = true; });
  await Promise.all([A.page.waitForNavigation({ waitUntil: 'networkidle' }), A.page.click('text=Alten Bestand ansehen')]);
  await warte(A.page, () => typeof RAUM !== 'undefined' && RAUM.id === 'bestand' && DB && DB.standards.length > 10);
  const alt = await A.page.evaluate(() => ({ wahl: RAUM.wahl, titel: TXT.appTitle, leiste: (document.getElementById('raumLeiste') || {}).textContent || '',
    braun: !!document.querySelector('#raumLeiste.rl-alt'), fenster: document.title }));
  r.check('alter Bestand: eigene Wahl, unveränderter Inhalt', alt.wahl === 'bestand' && alt.titel === 'Bestand-Titel');
  r.check('alter Bestand: eigenes Band „nicht live"', alt.braun && /BESTAND/.test(alt.leiste) && /nicht live/.test(alt.leiste) && /^Bestand ·/.test(alt.fenster));
  await Promise.all([A.page.waitForNavigation({ waitUntil: 'networkidle' }), A.page.click('#raumLeiste button:has-text("Verlassen")')]);
  await warte(A.page, () => typeof RAUM !== 'undefined' && RAUM.id === 'neuaufbau' && DB && typeof onStoreSet === 'function');
  r.check('„Verlassen" führt in den Live-Raum, ohne eigene Wahl', await A.page.evaluate(() => RAUM.id === 'neuaufbau' && RAUM.wahl === null && !document.getElementById('raumLeiste')));

  /* ── Zurückschalten: A geht mit in den Bestand ── */
  await liveKarte(A.page);
  r.check('der Knopf bietet jetzt „Bestand wieder live schalten" an', /Bestand wieder live schalten/.test(await A.page.locator('#raumLiveBtn').textContent()));
  await A.page.fill('#raumPwLive', 'abcdefg');
  await A.page.check('#raumLiveOk');
  await Promise.all([A.page.waitForNavigation({ waitUntil: 'networkidle' }), A.page.click('#raumLiveBtn')]);
  await warte(A.page, () => typeof RAUM !== 'undefined' && RAUM.id === 'bestand' && DB && DB.standards.length > 10);
  r.check('zurück: live ist wieder der Bestand', (await live(srv.base)) === 'bestand');
  r.check('wer umschaltet, geht mit — A im Bestand, ohne Band, ohne eigene Wahl', await A.page.evaluate(() => RAUM.id === 'bestand' && RAUM.wahl === null
    && !document.getElementById('raumLeiste') && TXT.appTitle === 'Bestand-Titel'));
  await B.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  r.check('B kehrt beim Aufwecken in den Bestand zurück', await bis(B.page, () => typeof RAUM !== 'undefined' && RAUM.id === 'bestand' && DB && DB.standards.length > 10 && typeof onStoreSet === 'function', 15000));
  await pC.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  r.check('C ebenso', await bis(pC, () => typeof RAUM !== 'undefined' && RAUM.id === 'bestand' && DB && DB.standards.length > 10 && typeof onStoreSet === 'function', 15000));
  const zeiger2 = JSON.parse(fs.readFileSync(path.join(srv.stateDir, 'raeume.json'), 'utf8'));
  r.check('Verlauf: zwei Umschaltungen', zeiger2.verlauf.length === 2 && zeiger2.verlauf[1].live === 'bestand' && zeiger2.verlauf[1].vorher === 'neuaufbau');
  r.check('der Neuaufbau behält, was in ihm entstand', (await json(srv.base, '/api/state?raum=neuaufbau')).state.hkl_additions.standards.some(s => s.titel === 'Erster Standard im Neuaufbau'));

  /* ── Das Verwaltungspasswort gilt auf allen Geräten ──
     Vorher lag es als roher Text im Speicher; der Abgleich übersprang es, eine
     Änderung galt nur auf dem einen Gerät. */
  await A.page.evaluate(() => setAuthPw('neues-pw-7'));
  await warte(A.page, () => document.getElementById('syncDot').className.includes('ok'), null, 6000);
  await A.page.waitForTimeout(1200);
  r.check('geändertes Verwaltungspasswort liegt geteilt auf dem Server (nur Fingerabdruck)',
    (await json(srv.base, '/api/state')).state.hkl_authpw === (await A.page.evaluate(() => pwHash('neues-pw-7'))));
  await B.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  r.check('… und gilt auf dem anderen Gerät, das alte nicht mehr', await bis(B.page, () => checkPw('neues-pw-7') && !checkPw('1234567'), 8000));
  r.check('… der Neuaufbau behält sein eigenes (abcdefg)', !(await json(srv.base, '/api/state?raum=neuaufbau')).state.hkl_authpw);

  /* Die absichtlich falschen Passwörter beantwortet der Server mit 403 — das
     meldet der Browser selbst als Ladefehler; erwartet, nur bei A. */
  const echt = A.errs.filter(e => !/status of 403/.test(e)).concat(B.errs, errsC).filter(e => !/favicon/i.test(e));
  r.check('keine Konsolenfehler' + (echt.length ? ': ' + echt.slice(0, 3).join(' | ') : ''), echt.length === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
