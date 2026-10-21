/* NEUAUFBAU — der zweite Raum im echten Browser (features/raum.js,
   core/store.js, server/raeume.js).

   Die Zusage, um die es geht, ist eine einzige: Was im Neuaufbau geschieht,
   berührt den Bestand nicht. Geprüft wird sie an allen drei Stellen, an
   denen sie brechen könnte:
     · die state.json des Bestands auf dem Server (Byte für Byte),
     · die Bilder (eigener Ordner, aus dem Bestand nicht abrufbar),
     · der Gerätespeicher (kein einziger Bestands-Schlüssel ändert sich).
   Dazu der Weg hinein (Zweitpasswort), die Leiste, der Weg hinaus — und die
   Falle, die beim späteren Live-Schalten zuschnappen würde: Ein Gerät mit
   Bestandsdaten darf sie NICHT in den Neuaufbau „zurückbefüllen". */
'use strict';
const fs = require('fs');
const path = require('path');
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

const PNG_ROT = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

async function warte(page, fn, arg, ms) {
  try { await page.waitForFunction(fn, arg, { timeout: ms || 10000 }); return true; } catch (e) { return false; }
}
async function json(base, p) { return (await fetch(base + p, { cache: 'no-store' })).json(); }
function bestandsSchluessel(page) {
  return page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i);
    if (!k.startsWith('raum:')) o[k] = localStorage.getItem(k); } return o; });
}

(async () => {
  const r = reporter('neuaufbau');
  const srv = await startServer();
  const browser = await launchBrowser();
  const { page, ctx, errs } = await bootPage(browser, srv.base);

  /* ── 1. Im Bestand: anmelden, etwas ändern, Karte finden ── */
  await page.evaluate(() => { doLogin('1234567'); TXT.appTitle = 'Bestand-Titel'; saveTXT(); });
  await warte(page, () => document.getElementById('syncDot').className.includes('ok'));
  const anzahlBestand = await page.evaluate(() => DB.standards.length);
  r.check('Bestand lädt die mitgelieferten Standards (' + anzahlBestand + ')', anzahlBestand > 10);
  r.check('im Bestand keine Leiste', await page.evaluate(() => !document.getElementById('raumLeiste')));

  await page.evaluate(() => setMode('admin'));
  const karte = await page.evaluate(() => [...document.querySelectorAll('#scr-admin .vp-title')].some(t => t.textContent === 'Neuaufbau'));
  r.check('Verwaltung zeigt die Karte „Neuaufbau"', karte);

  /* Zweitpasswort festlegen: zu kurz, verschieden, gleich dem Verwaltungspasswort → abgelehnt */
  await page.evaluate(() => { const d = [...document.querySelectorAll('#scr-admin details.vpanel')].find(x => x.querySelector('.vp-title').textContent === 'Neuaufbau'); d.open = true; });
  const pruef = await page.evaluate(() => [raumPwPruefeNeu('ab', 'ab'), raumPwPruefeNeu('geheim1', 'geheim2'), raumPwPruefeNeu('1234567', '1234567'), raumPwPruefeNeu('geheim1', 'geheim1')]);
  r.check('zu kurz / verschieden / gleich dem Verwaltungspasswort werden abgewiesen', !!pruef[0] && !!pruef[1] && !!pruef[2] && pruef[3] === '');

  await page.fill('#raumPwNeu1', 'testraum');
  await page.fill('#raumPwNeu2', 'testraum');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }), page.click('text=Festlegen und betreten')]);
  await warte(page, () => typeof RAUM !== 'undefined' && typeof onStoreSet === 'function' && DB);

  /* ── 2. Im Neuaufbau ── */
  const nb = await page.evaluate(() => ({ id: RAUM.id, std: DB.standards.length, leiste: !!document.getElementById('raumLeiste'),
    leisteText: (document.getElementById('raumLeiste') || {}).textContent || '', titel: document.title, admin: ADMIN,
    leer: (document.querySelector('#scr-standards .empty h3') || {}).textContent || '' }));
  r.check('nach dem Passwort im Neuaufbau', nb.id === 'neuaufbau');
  r.check('Neuaufbau ist LEER (keine Standards)', nb.std === 0);
  r.check('Startseite sagt „Noch kein Standard" statt „nicht gefunden"', /Noch kein Standard/.test(nb.leer));
  r.check('Leiste sichtbar und benannt', nb.leiste && /NEUAUFBAU/.test(nb.leisteText) && /Verlassen/.test(nb.leisteText));
  r.check('Fenstertitel nennt den Raum', /^Neuaufbau/.test(nb.titel));
  r.check('direkt angemeldet (kein drittes Passwort)', nb.admin === true);
  r.check('kein Referenzkatalog geladen', await page.evaluate(() => typeof CATDATA === 'undefined' || !CATDATA || !Object.keys(CATDATA.eintraege || CATDATA || {}).length));
  const amPasswort = await json(srv.base, '/api/state');
  r.check('das Zweitpasswort liegt im Bestand (nur Fingerabdruck)', typeof amPasswort.state.hkl_raumpw === 'string' && amPasswort.state.hkl_raumpw !== 'testraum');

  /* Ausgangslage des Bestands festhalten — ab hier darf sich daran nichts ändern. */
  const bestandVorher = await json(srv.base, '/api/state');
  const dateiVorher = fs.readFileSync(path.join(srv.stateDir, 'state.json'), 'utf8');
  const lokalVorher = await bestandsSchluessel(page);

  /* Arbeit im Neuaufbau: Standard anlegen, Titel ändern, Bild ablegen */
  const bild = await page.evaluate(async (src) => {
    addStandard('Testablauf Neuaufbau', 'Test');
    TXT.appTitle = 'Neuaufbau-Titel'; saveTXT();
    return medFotoAblegen(src, { roh: true });
  }, PNG_ROT);
  await warte(page, () => document.getElementById('syncDot').className.includes('ok'), null, 8000);
  await page.waitForTimeout(1200);
  const nbServer = await json(srv.base, '/api/state?raum=neuaufbau');
  r.check('Neuaufbau-Daten liegen im Neuaufbau-Raum des Servers', nbServer.raum === 'neuaufbau'
    && (nbServer.state.hkl_additions || {}).standards && nbServer.state.hkl_additions.standards.some(s => s.titel === 'Testablauf Neuaufbau')
    && nbServer.state.hkl_txt && nbServer.state.hkl_txt.appTitle === 'Neuaufbau-Titel');
  r.check('Bildadresse nennt den Raum', /\/api\/media\/[0-9a-f]{32}\?raum=neuaufbau$/.test(bild || ''));
  const kennung = (/\/api\/media\/([0-9a-f]{32})/.exec(bild || '') || [])[1];
  r.check('Bild im Medienordner des Neuaufbaus', !!kennung && fs.existsSync(path.join(srv.stateDir, 'raeume', 'neuaufbau', 'media', kennung + '.png')));
  r.check('Bild NICHT im Medienordner des Bestands', !!kennung && !fs.existsSync(path.join(srv.stateDir, 'media', kennung + '.png')));
  r.check('Bestand liefert das Bild nicht aus (404)', (await fetch(srv.base + '/api/media/' + kennung)).status === 404);

  const bestandNachher = await json(srv.base, '/api/state');
  r.check('Bestand auf dem Server: Revision unverändert', bestandNachher.rev === bestandVorher.rev);
  r.check('Bestand auf dem Server: Inhalt unverändert', JSON.stringify(bestandNachher.state) === JSON.stringify(bestandVorher.state));
  r.check('state.json des Bestands Byte für Byte gleich', fs.readFileSync(path.join(srv.stateDir, 'state.json'), 'utf8') === dateiVorher);
  const lokalNachher = await bestandsSchluessel(page);
  const geaendert = Object.keys(Object.assign({}, lokalVorher, lokalNachher)).filter(k => lokalVorher[k] !== lokalNachher[k]);
  r.check('Gerätespeicher: kein Bestands-Schlüssel verändert' + (geaendert.length ? ' (' + geaendert.join(', ') + ')' : ''), geaendert.length === 0);
  r.check('Gerätespeicher: Neuaufbau-Schlüssel tragen das Präfix', await page.evaluate(() => localStorage.getItem('raum:neuaufbau:hkl_additions') !== null));

  /* ── 3. Hinaus über die Leiste ── */
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }), page.click('#raumLeiste button:has-text("Verlassen")')]);
  await warte(page, () => typeof RAUM !== 'undefined' && DB && DB.standards.length > 0);
  const zurueck = await page.evaluate(() => ({ id: RAUM.id, leiste: !!document.getElementById('raumLeiste'), titel: TXT.appTitle,
    eigener: DB.standards.some(s => s.titel === 'Testablauf Neuaufbau') }));
  r.check('„Verlassen" führt in den Bestand', zurueck.id === 'bestand' && !zurueck.leiste);
  r.check('Bestand sieht nichts vom Neuaufbau', zurueck.titel === 'Bestand-Titel' && !zurueck.eigener);

  /* ── 4. Wieder hinein: falsches Passwort hält draußen, richtiges öffnet den alten Stand ── */
  await page.evaluate(() => setMode('admin'));
  await page.evaluate(() => { const d = [...document.querySelectorAll('#scr-admin details.vpanel')].find(x => x.querySelector('.vp-title').textContent === 'Neuaufbau'); d.open = true; });
  await page.fill('#raumPwEin', 'falsch');
  await page.click('text=Neuaufbau betreten');
  await page.waitForTimeout(400);
  r.check('falsches Zweitpasswort: bleibt im Bestand', await page.evaluate(() => RAUM.id === 'bestand' && localStorage.getItem('hkl_raumwahl') === null));
  await page.fill('#raumPwEin', 'testraum');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }), page.click('text=Neuaufbau betreten')]);
  await warte(page, () => typeof RAUM !== 'undefined' && RAUM.id === 'neuaufbau' && DB && DB.standards.length === 1);
  r.check('richtiges Zweitpasswort: der Neuaufbau ist so, wie er verlassen wurde',
    await page.evaluate(() => RAUM.id === 'neuaufbau' && DB.standards.length === 1 && TXT.appTitle === 'Neuaufbau-Titel'));

  /* ── 5. Die Falle beim Live-Schalten ──
     Ein Kollegen-Gerät (eigener Browser-Kontext) arbeitet im Bestand und hat
     dort lokale Daten. Wird der Neuaufbau live geschaltet, folgt es — und darf
     dabei KEINEN Bestands-Schlüssel in den Neuaufbau hochladen. */
  const kollege = await bootPage(browser, srv.base);
  await kollege.page.evaluate(() => { doLogin('1234567'); overrides['nur-im-bestand'] = { x: 1 }; saveJSON('hkl_overrides', overrides); });
  await warte(kollege.page, () => document.getElementById('syncDot').className.includes('ok'));
  const nbVorSchalter = await json(srv.base, '/api/state?raum=neuaufbau');
  fs.writeFileSync(path.join(srv.stateDir, 'raeume.json'), JSON.stringify({ live: 'neuaufbau' }));
  await kollege.page.reload({ waitUntil: 'networkidle' });
  const folgt = await warte(kollege.page, () => typeof RAUM !== 'undefined' && RAUM.id === 'neuaufbau' && DB && typeof onStoreSet === 'function', null, 15000);
  r.check('Kollegen-Gerät folgt dem Live-Zeiger in den Neuaufbau', folgt);
  await kollege.page.waitForTimeout(1500);
  const nbNachSchalter = await json(srv.base, '/api/state?raum=neuaufbau');
  r.check('… ohne Bestandsdaten in den Neuaufbau zu tragen (keine Erstbefüllung)',
    !nbNachSchalter.state.hkl_overrides && nbNachSchalter.rev === nbVorSchalter.rev);
  r.check('… und sieht den Neuaufbau', await kollege.page.evaluate(() => DB.standards.length === 1 && !!document.getElementById('raumLeiste')));
  r.check('der Live-Zeiger lenkt Anfragen ohne Raum NICHT um (Bestand bleibt Bestand)',
    !!(await json(srv.base, '/api/state')).state.hkl_overrides['nur-im-bestand']);

  /* Zeiger zurück: Das Gerät kehrt zurück und findet seinen Bestand unverändert. */
  fs.writeFileSync(path.join(srv.stateDir, 'raeume.json'), JSON.stringify({ live: 'bestand' }));
  await kollege.page.reload({ waitUntil: 'networkidle' });
  const zurueckLive = await warte(kollege.page, () => typeof RAUM !== 'undefined' && RAUM.id === 'bestand' && DB && DB.standards.length > 10, null, 15000);
  r.check('Zeiger zurück: Gerät ist wieder im Bestand', zurueckLive);
  r.check('… mit seinen lokalen Bestandsdaten', await kollege.page.evaluate(() => !!(overrides['nur-im-bestand'])));

  const echt = errs.concat(kollege.errs).filter(e => !/favicon/i.test(e));
  r.check('keine Konsolenfehler' + (echt.length ? ': ' + echt.slice(0, 3).join(' | ') : ''), echt.length === 0);
  await ctx.close();
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
