/* NEUE APP (public/neu/, docs/NEUE-APP.md) im echten Browser.

   Bedient wird wie ein Mensch: Passwort getippt, jede Aktion über die
   sichtbaren Schaltflächen. Geprüft werden die Arbeitswege der Verwaltung
   (Material/Gerät/Medikament anlegen, Standard bauen, Listen pflegen,
   Papierkorb, Sicherung), die Sicht der Anwender (abhaken, Rüstliste,
   melden), der Abgleich zwischen zwei Geräten — und die wichtigste Zusage:
   Der BESTAND bleibt Byte für Byte unverändert, und ohne den Raum
   „Neuaufbau" schreibt die neue App nichts.

   NEU_BILDER=<ordner> legt Bildschirmfotos (Handy und PC) dort ab. */
'use strict';
const path = require('path');
const { launchBrowser, startServer, reporter } = require('./util');

function gtinMitPruefziffer(s13) {
  const z = s13.split('').map(Number); let sum = 0;
  z.slice().reverse().forEach((d, i) => { sum += d * (i % 2 === 0 ? 3 : 1); });
  return s13 + ((10 - (sum % 10)) % 10);
}
const GTIN = gtinMitPruefziffer('0401234567890');
const GTIN_FALSCH = GTIN.slice(0, 13) + ((+GTIN[13] + 1) % 10);
async function json(base, p) { return (await fetch(base + p, { cache: 'no-store' })).json(); }
async function warte(page, fn, arg, ms) { try { await page.waitForFunction(fn, arg, { timeout: ms || 8000 }); return true; } catch (e) { return false; } }
async function abgeglichen(page) { return warte(page, () => { const d = document.getElementById('naPunkt'); return d && / ok/.test(d.className) && naAbgleich.offen() === 0; }, null, 10000); }
const BILDER = process.env.NEU_BILDER || '';
async function foto(page, name) { if (BILDER) await page.screenshot({ path: path.join(BILDER, name + '.png'), fullPage: false }); }

async function geraet(browser, base, viewport) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 390, height: 844 } });
  const page = await ctx.newPage(); const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
  page.on('dialog', d => { errs.push('NATIVER DIALOG: ' + d.message()); d.dismiss(); });
  return { ctx, page, errs };
}
async function wahl(page, such, text) {
  await page.fill('#naAuswQ', such);
  await page.click('#naAuswListe .sheet-act:has-text("' + text + '")');
}

(async () => {
  const r = reporter('neue-app');
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await geraet(browser, srv.base);
  const p = A.page;

  /* ── 0. Bestand: keine Umleitung; /neu/ ohne Raum schreibt nichts ── */
  await p.goto(srv.base + '/', { waitUntil: 'networkidle' });
  await warte(p, () => typeof DB !== 'undefined' && DB.standards && DB.standards.length > 0, null, 15000);
  r.check('Bestand: bleibt auf der alten App', new URL(p.url()).pathname === '/');
  const bestandVorher = JSON.stringify((await json(srv.base, '/api/state')).state);
  await p.goto(srv.base + '/neu/', { waitUntil: 'networkidle' });
  const lsVorher = await p.evaluate(() => Object.keys(localStorage).sort().join('|'));
  r.check('neue App ohne Neuaufbau: nur ein Hinweis', await p.evaluate(() => /nur im Neuaufbau/.test(document.body.innerText)));
  await p.waitForTimeout(400);
  r.check('… und kein einziger neuer Schlüssel im Gerätespeicher', await p.evaluate(() => Object.keys(localStorage).sort().join('|')) === lsVorher);

  /* ── 1. Neuaufbau gewählt → die alte Seite leitet in die neue App ── */
  await p.evaluate(() => localStorage.setItem('hkl_raumwahl', 'neuaufbau'));
  await p.goto(srv.base + '/', { waitUntil: 'networkidle' });
  r.check('Neuaufbau: Umleitung nach /neu/', new URL(p.url()).pathname === '/neu/');
  r.check('Leiste „nicht live" sichtbar', await p.isVisible('.na-leiste'));
  r.check('Anwender sieht kein ＋', !(await p.isVisible('.na-plus')));

  /* Anmelden — getippt. Falsches Passwort hält draußen. */
  await p.click('#naAnmelden'); await p.fill('#naAnmeldePw', 'falsch'); await p.click('#naSheet >> text=Anmelden');
  r.check('falsches Passwort: nicht angemeldet', await p.evaluate(() => !naAdmin()));
  await p.fill('#naAnmeldePw', 'abcdefg'); await p.click('#naSheet >> text=Anmelden');
  r.check('Passwort „abcdefg" meldet an', await p.evaluate(() => naAdmin()));

  /* ── 2. Material: alles Wichtige sofort da, Kategorie freiwillig; GTIN mit Prüfziffer, Hersteller an Ort und Stelle ── */
  await p.click('.na-tab:has-text("Material")'); await p.click('.na-plus');
  r.check('Name, GTIN, Hersteller und Lagerort sind sofort da — die Kategorie ist kein Tor', (await p.isVisible('input[data-f="name"]')) && (await p.isVisible('input[data-f="gtin"]'))
    && (await p.isVisible('button[data-f="hersteller"]')) && (await p.isVisible('button[data-f="lagerort"]')) && !(await p.isVisible('button[data-f="kategorie"]')));
  r.check('„fehlt noch" nennt die fünf Kern-Angaben', /Hersteller · GTIN oder REF · Lagerort · Produktbild · Kategorie/.test(await p.textContent('#naFehltZeile')));
  await p.click('details[data-ab="kat"] > summary');
  await p.click('button[data-f="kategorie"]'); await wahl(p, 'Schleuse', 'Schleuse / Introducer');
  r.check('Abschnitt bleibt nach der Wahl aufgeklappt', await p.isVisible('button[data-f="kategorie"]'));
  await p.fill('input[data-f="gtin"]', GTIN_FALSCH);
  r.check('falsche Prüfziffer sofort angezeigt', /Prüfziffer stimmt nicht/.test(await p.textContent('#naGtinStand')));
  await p.fill('input[data-f="gtin"]', GTIN);
  r.check('richtige GTIN bestätigt', /✓/.test(await p.textContent('#naGtinStand')));
  await p.fill('input[data-f="ref"]', 'RSS601');
  await p.click('button[data-f="hersteller"]'); await p.fill('#naAuswQ', 'Terumo');
  await p.click('#naAuswListe >> text=„Terumo" neu anlegen');
  const diff = await p.evaluate(() => naFelder(naKat(), 'schleuse').diff.map(d => d.id));
  await p.fill('input[data-f="merkmale.' + diff[0] + '"]', '6');
  await p.fill('input[data-f="merkmale.' + diff[1] + '"]', '11');
  await p.click('text=Vorschlag aus Kategorie');
  const name = await p.inputValue('input[data-f="name"]');
  r.check('Namensvorschlag aus Kategorie + ★-Merkmalen (' + name + ')', /^Schleuse/.test(name) && /6/.test(name));
  await p.click('button[data-f="lagerort"]'); await p.fill('#naAuswQ', 'Schrank 3'); await p.click('#naAuswListe >> text=„Schrank 3" neu anlegen');
  r.check('Lagerort ist ein Listeneintrag (an Ort und Stelle angelegt)', await p.evaluate(() => naListe('lagerorte').length === 1 && naListeName('lagerorte', NA_ENTWURF.obj.lagerort) === 'Schrank 3'));
  await p.click('details[data-ab="sonst"] > summary');
  await p.click('button[data-f="bereich"]'); await p.click('#naAuswListe >> text=Tischvorbereitung');
  await p.click('details[data-ab="pack"] > summary');
  await p.fill('input[data-f="preis.betrag"]', '120');
  await p.fill('input[data-f="preis.bezugsmenge"]', '10');
  r.check('Stückpreis gerechnet', /12,00/.test(await p.textContent('#naStueckpreis')));
  await foto(p, 'handy-material-maske');
  await p.click('[data-na="entwSpeichern"]');
  r.check('Material gespeichert', await warte(p, () => location.hash === '#/material' && naAlle('material').length === 1));
  const mat = await p.evaluate(() => naAlle('material')[0]);
  r.check('… mit GTIN, REF, Hersteller-Kennung, Merkmalen, Preis', mat.gtin === GTIN && mat.ref === 'RSS601' && /^he/.test(mat.hersteller) && Object.keys(mat.merkmale).length >= 2 && mat.preis.bezugsmenge === 10);

  /* Doppelte GTIN wird abgewiesen. */
  await p.click('.na-plus');
  await p.fill('input[data-f="gtin"]', GTIN);
  r.check('doppelte GTIN wird benannt', /schon/.test(await p.textContent('#naGtinStand')));
  await p.fill('input[data-f="name"]', 'Zweite Schleuse'); await p.click('[data-na="entwSpeichern"]');
  await p.waitForTimeout(300);
  r.check('… und nicht gespeichert', await p.evaluate(() => naAlle('material').length === 1));
  /* Schutz: Eine Maske mit Eingaben verlässt man nicht aus Versehen. */
  await p.click('.na-tab:has-text("Geräte")');
  r.check('Verlassen mit ungespeicherten Eingaben fragt nach', await warte(p, () => /noch nicht gespeichert/.test(document.getElementById('naSheet').textContent) && document.getElementById('naSheet').classList.contains('show')));
  await p.click('#naSheet.show button:has-text("Weiter bearbeiten")');
  r.check('„Weiter bearbeiten": Maske und Eingaben bleiben', (await p.evaluate(() => location.hash)) === '#/material/neu' && (await p.inputValue('input[data-f="name"]')) === 'Zweite Schleuse');
  await p.goBack(); await p.waitForTimeout(250);
  r.check('auch „Zurück" des Geräts fragt — und bleibt in der Maske', (await p.evaluate(() => location.hash)) === '#/material/neu' && await p.evaluate(() => document.getElementById('naSheet').classList.contains('show')));
  await p.click('#naSheet.show button:has-text("Weiter bearbeiten")');
  await p.click('[data-na="entwAbbrechen"]'); await p.click('#naSheet.show button:has-text("Verwerfen")');
  r.check('„Verwerfen" verlässt die Maske', await warte(p, () => location.hash === '#/material' && !NA_ENTWURF));

  /* ── 3. Gerät: ähnlicher Hersteller → Warnung statt Doppelung ── */
  await p.click('.na-tab:has-text("Geräte")'); await p.click('.na-plus');
  await p.fill('input[data-f="name"]', 'Defibrillator Lifepak 20');
  await p.click('button[data-f="hersteller"]'); await p.fill('#naAuswQ', 'Terumo Europe');
  await p.click('#naAuswListe >> text=„Terumo Europe" neu anlegen');
  r.check('Doppelungswarnung im Auswahlfeld', await p.isVisible('#naAuswListe .na-warn'));
  await p.click('#naAuswListe .sheet-act:has-text("Terumo")');
  await p.click('[data-na="entwSpeichern"]');
  const herst = await p.evaluate(() => naListe('hersteller').map(h => h.name));
  r.check('kein zweiter Hersteller angelegt', herst.length === 1);

  /* ── 4. Medikament mit neuer Darreichungsform ── */
  await p.click('.na-tab:has-text("Medikamente")'); await p.click('.na-plus');
  await p.fill('input[data-f="name"]', 'Heparin');
  await p.fill('input[data-f="wirkstoff"]', 'Heparin-Natrium');
  await p.fill('input[data-f="konzentration"]', '5000 I.E./ml');
  await p.click('button[data-f="darreichung"]'); await p.fill('#naAuswQ', 'Ampulle'); await p.click('#naAuswListe >> text=„Ampulle" neu anlegen');
  await p.fill('input[data-f="preis.betrag"]', '2');
  await p.click('[data-na="entwSpeichern"]');
  r.check('Medikament gespeichert', await warte(p, () => naAlle('medikament').length === 1));

  /* ── 5. Standard bauen ── */
  await p.click('.na-tab:has-text("Standards")'); await p.click('.na-plus');
  await p.fill('#naEingabeFeld', 'PCI elektiv'); await p.click('#naSheet >> text=Übernehmen');
  await p.click('#naSheet >> text=Mit den üblichen Rubriken');
  r.check('Editor mit 5 Rubriken', await warte(p, () => /bearbeiten$/.test(location.hash) && document.querySelectorAll('.na-rub').length === 5));
  const neu = n => p.click('[data-na="neuAnlegen"] >> nth=' + n);
  await neu(1); await p.click('#naAuswListe >> text=Material');
  await p.click('#naAuswListe .sheet-act:has-text("Schleuse")'); await p.click('#naSheet >> text=Übernehmen');
  await p.click('[data-na="posBearb"] >> nth=0');
  await p.fill('#naPosMenge', '2x'); await p.check('#naPosAnsage'); await p.click('[data-na="posOk"]');
  await neu(0); await p.click('#naAuswListe >> text=Gerät');
  await p.click('#naAuswListe .sheet-act:has-text("Defibrillator")'); await p.click('#naSheet >> text=Übernehmen');
  await neu(3); await p.click('#naAuswListe >> text=Medikament');
  await p.click('#naAuswListe .sheet-act:has-text("Heparin")'); await p.click('#naSheet >> text=Übernehmen');
  await p.click('.na-pos:has-text("Heparin") [data-na="posBearb"]'); await p.fill('#naPosMenge', '1'); await p.click('[data-na="posOk"]');
  await neu(4); await p.click('#naAuswListe >> text=Arbeitsschritt');
  await p.fill('#naNeuText', 'Punktion\nSchleuse legen'); await p.click('#naSheet >> text=Hinzufügen');
  await neu(4); await p.click('#naAuswListe >> text=Hinweis');
  await p.fill('#naNeuText', 'Allergien abfragen'); await p.click('#naSheet >> text=Hinzufügen');
  const std = await p.evaluate(() => naAlle('standard')[0]);
  r.check('Standard hat 6 Positionen', naPos(std).length === 6);
  const schl = naPos(std).find(x => x.ref && x.ref.typ === 'material');
  r.check('Position: Menge und „auf Ansage" gelten nur hier', schl && schl.menge === '2x' && schl.ansage === true);
  r.check('… der Stammsatz bleibt unberührt', await p.evaluate(() => !('menge' in naAlle('material')[0])));
  await foto(p, 'handy-editor');

  /* ── 6. Ansehen, abhaken, Rüstliste, Kosten ── */
  await p.click('text=👁 Ansehen');
  r.check('5 abhakbare Zeilen (Hinweis ohne Haken)', await p.locator('.na-pos .chk').count() === 5);
  await p.click('.na-pos .chk >> nth=0');
  r.check('Abhaken zählt', /1 von 5/.test(await p.textContent('#naMain')));
  await foto(p, 'handy-standard');
  await p.click('text=🧺 Rüstliste');
  const ruest = await p.textContent('#naMain');
  r.check('Rüstliste: Bereich → Lagerort → „auf Ansage"', /Tischvorbereitung[\s\S]*Schrank 3[\s\S]*auf Ansage/.test(ruest) && /Ohne Bereich/.test(ruest));
  await foto(p, 'handy-ruestliste');
  await p.goBack(); await p.click('text=€ Kosten');
  r.check('Kosten: 2 × 12 € + 1 × 2 € = 26 €', /26,00/.test(await p.textContent('#naMain')));
  r.check('Kosten unvollständig benannt (Gerät zählt nicht, alles hat Preis)', /Vollständig/.test(await p.textContent('#naMain')));
  const dl = p.waitForEvent('download'); await p.click('text=Als CSV'); const csv = await dl;
  r.check('CSV-Export', /Kosten PCI elektiv\.csv$/.test(csv.suggestedFilename()));

  /* ── 7. Server: alles im Neuaufbau, nichts im Bestand ── */
  r.check('abgeglichen', await abgeglichen(p));
  const nb = await json(srv.base, '/api/state?raum=neuaufbau');
  const naKeys = Object.keys(nb.state).filter(k => /^na_/.test(k));
  r.check('Server (Neuaufbau): Material, Gerät, Medikament, Standard, Listen, Verlauf', ['na_m_', 'na_g_', 'na_d_', 'na_s_', 'na_l_hersteller', 'na_vl_'].every(x => naKeys.some(k => k.indexOf(x) === 0)));
  r.check('Server (Bestand): Byte für Byte unverändert', JSON.stringify((await json(srv.base, '/api/state')).state) === bestandVorher);

  /* ── 8. Zweites Gerät (Anwender): sieht alles, meldet „leer" ── */
  const B = await geraet(browser, srv.base);
  await B.page.goto(srv.base + '/', { waitUntil: 'networkidle' });
  await B.page.evaluate(() => localStorage.setItem('hkl_raumwahl', 'neuaufbau'));
  await B.page.goto(srv.base + '/neu/', { waitUntil: 'networkidle' });
  r.check('Gerät B sieht den Standard', await warte(B.page, () => /PCI elektiv/.test(document.getElementById('naMain').innerText)));
  await B.page.click('.na-tab:has-text("Material")'); await B.page.click('.na-eintrag >> nth=0');
  r.check('Anwender: Ansicht ohne Preis', !/12,00|Preis/.test(await B.page.textContent('#naMain')));
  await B.page.click('text=Melden: ist leer');
  await B.page.click('#naSheet >> text=Ist leer'); await B.page.fill('#naEingabeFeld', 'letzte Packung'); await B.page.click('#naSheet >> text=Melden');
  r.check('Meldung abgeglichen', await abgeglichen(B.page));
  await p.evaluate(() => naAbgleich.runde()); await p.waitForTimeout(600);
  await p.click('.na-tab:has-text("Mehr")'); await p.click('text=Meldungen');
  r.check('Verwaltung sieht die Meldung', /letzte Packung/.test(await p.textContent('#naMain')));
  await p.click('.na-eintrag:has-text("leer")'); await p.click('#naSheet >> text=weitergegeben');
  r.check('Stufe „weitergegeben"', await p.evaluate(() => naAlle('meldung')[0].stufe === 'weitergegeben'));

  /* ── 9. Listen-Verzeichnis: umbenennen wirkt überall ── */
  await p.click('#naZurueck'); await p.click('text=Listen-Verzeichnis'); await p.click('text=Hersteller');
  r.check('Verwendung gezählt (2×)', /2× verwendet/.test(await p.textContent('#naMain')));
  await p.click('.na-eintrag:has-text("Terumo")'); await p.click('#naSheet >> text=Umbenennen');
  await p.fill('#naEingabeFeld', 'Terumo Medical'); await p.click('#naSheet >> text=Übernehmen');
  await p.click('.na-tab:has-text("Material")');
  r.check('neuer Name im Verzeichnis', /Terumo Medical/.test(await p.textContent('#naMain')));

  /* ── 10. Papierkorb ── */
  await p.click('.na-eintrag >> nth=0'); await p.click('text=In den Papierkorb'); await p.click('#naSheet button:has-text("In den Papierkorb")');
  await p.click('.na-tab:has-text("Standards")'); await p.click('.std');
  r.check('Position zeigt „im Papierkorb"', /im Papierkorb/.test(await p.textContent('#naMain')));
  await p.click('.na-tab:has-text("Mehr")'); await p.click('text=Papierkorb'); await p.click('.na-eintrag >> nth=0');
  await p.click('#naSheet >> text=Wiederherstellen');
  await p.click('.na-tab:has-text("Standards")'); await p.click('.std');
  r.check('wiederhergestellt: Position zeigt wieder den Namen', !/im Papierkorb/.test(await p.textContent('#naMain')) && /Schleuse/.test(await p.textContent('#naMain')));
  await p.click('.na-tab:has-text("Mehr")'); await p.click('text=Verlauf');
  r.check('Verlauf führt Buch', await p.locator('.na-eintrag').count() >= 10);

  /* ── 11. Sicherung ── */
  await p.click('#naZurueck'); await p.click('text=Sicherung');
  const dl2 = p.waitForEvent('download'); await p.click('text=Sicherung herunterladen'); const sich = await dl2;
  const inhalt = JSON.parse(require('fs').readFileSync(await sich.path(), 'utf8'));
  r.check('Sicherung enthält alle Objekte', inhalt.format === 'hkl-neue-app-sicherung' && Object.keys(inhalt.daten).some(k => /^na_s_/.test(k)));

  /* ── 12. PC: Ziehen im Editor ── */
  const C = await geraet(browser, srv.base, { width: 1400, height: 900 });
  await C.page.goto(srv.base + '/', { waitUntil: 'networkidle' });
  await C.page.evaluate(() => { localStorage.setItem('hkl_raumwahl', 'neuaufbau'); localStorage.setItem('raum:neuaufbau:hkl_authuntil', String(Date.now() + 3600000)); });
  await C.page.goto(srv.base + '/neu/#/s/' + std.id + '/bearbeiten', { waitUntil: 'networkidle' });
  await warte(C.page, () => document.querySelectorAll('.na-pos').length === 6);
  await C.page.dragAndDrop('.na-pos:has-text("Schleuse legen")', '.na-pos:has-text("Punktion")');
  const reihe = await C.page.evaluate(id => naPositionen(naHole('standard', id)).map(x => x.pos.text).filter(Boolean), std.id);
  r.check('Ziehen am PC verschiebt (' + reihe.join(' → ') + ')', reihe[0] === 'Schleuse legen' && reihe[1] === 'Punktion');
  await foto(C.page, 'pc-editor');

  /* ── 13. Zum Schluss: Bestand weiter unverändert und erreichbar ── */
  r.check('abgeglichen (PC)', await abgeglichen(C.page));
  r.check('Server (Bestand) am Ende unverändert', JSON.stringify((await json(srv.base, '/api/state')).state) === bestandVorher);
  r.check('Bestand enthält keinen Schlüssel der neuen App', !Object.keys((await json(srv.base, '/api/state')).state).some(k => /^na_/.test(k)));
  await p.click('.na-tab:has-text("Mehr")'); await p.click('text=Einstellungen');
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle' }), p.click('text=Zurück zum Bestand')]);
  r.check('„Zurück zum Bestand" öffnet die alte App im Bestand', new URL(p.url()).pathname === '/' && await warte(p, () => typeof RAUM !== 'undefined' && RAUM.id === 'bestand' && DB.standards.length > 0, null, 15000));
  await p.evaluate(() => { localStorage.setItem('hkl_raumwahl', 'neuaufbau'); localStorage.setItem('hkl_neu_alt', '1'); });
  await p.goto(srv.base + '/', { waitUntil: 'networkidle' });
  r.check('hkl_neu_alt=1: alte Oberfläche im Neuaufbau bleibt erreichbar', new URL(p.url()).pathname === '/' && await p.evaluate(() => RAUM.id === 'neuaufbau'));
  r.check('Live-Zeiger unberührt (Bestand)', (await json(srv.base, '/api/raeume')).live === 'bestand');

  const fehler = A.errs.concat(B.errs, C.errs).filter(e => !/favicon|ERR_ABORTED|Failed to load resource/.test(e));
  r.check('keine Fehler in der Konsole' + (fehler.length ? ': ' + fehler.slice(0, 3).join(' | ') : ''), fehler.length === 0);

  await r.finish(browser, [srv]);
})().catch(e => { console.error(e); process.exit(1); });

function naPos(std) { const o = []; (std.rubriken || []).forEach(r => (r.abschnitte || []).forEach(a => (a.positionen || []).forEach(p => o.push(p)))); return o; }
