/* NEUE APP — Pflichtangaben zum Produkt (Entscheidung 18.11.2026), im echten Browser.

   GTIN, Hersteller und REF muss jedes Material beantworten: mit einem Wert
   oder einem der drei ehrlichen Auswege „gibt es nicht", „unbekannt",
   „nachtragen". Erst dann öffnet sich der Rest der Maske und das Speichern.
   Geprüft wird dazu: die SAP-Nummer (freiwillig, doppelt → „Trotzdem
   anlegen"), die Erinnerung vor dem Speichern (Hersteller, Produktname,
   Produktfoto — keine Pflicht), HIBC-Codes eines Handscanners, alte
   Materialien ohne Pflichtangaben, die Arbeitslisten im Verzeichnis, ein
   eigenes Pflichtfeld des Hauses („＋ Feld für alle Produkte") bis in die
   Kurzerfassung und zurück über die Seite des Merkmals.

   · Die Register sind eine Attrappe, die nichts kennt — der Test geht nie ins Internet.
   · Der BESTAND bleibt Byte für Byte unverändert.

   PFLICHT_BILDER=<ordner> legt Bildschirmfotos dort ab. */
'use strict';
const http = require('http');
const path = require('path');
const { launchBrowser, startServer, reporter } = require('./util');

function ean13(z12) { const z = z12.split('').map(Number); let s = 0; z.forEach((d, i) => { s += d * (i % 2 ? 3 : 1); }); return z12 + ((10 - (s % 10)) % 10); }
const GTIN_B = '0' + ean13('401234567895');
/* HIBC: „+" · Herstellerkennung (4) · Artikelnummer · Verpackungsstufe (1 Ziffer) · Prüfzeichen (mod 43) */
function hibc(rumpf) { const Z = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%'; let n = 0; for (const c of rumpf) n += Z.indexOf(c); return rumpf + Z[n % 43]; }
const HIBC = hibc('+H123ABC1231');
async function json(base, p) { return (await fetch(base + p, { cache: 'no-store' })).json(); }
async function warte(page, fn, arg, ms) { try { await page.waitForFunction(fn, arg, { timeout: ms || 8000 }); return true; } catch (e) { return false; } }
const BILDER = process.env.PFLICHT_BILDER || '';
async function foto(page, name) { if (BILDER) await page.screenshot({ path: path.join(BILDER, name + '.png'), fullPage: true }); }
const blattOffen = (p, re) => warte(p, r => { const s = document.getElementById('naSheet'); return s.classList.contains('show') && new RegExp(r).test(s.textContent); }, re.source);
const blattZu = p => warte(p, () => !document.getElementById('naSheet').classList.contains('show'));

(async () => {
  const r = reporter('neue-app-pflicht');
  const attrappe = http.createServer((req, res) => { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); });
  await new Promise(ok => attrappe.listen(0, '127.0.0.1', ok));
  const reg = 'http://127.0.0.1:' + attrappe.address().port;
  const srv = await startServer({ REGISTER_EUDAMED_URL: reg + '/eudamed', REGISTER_GUDID_URL: reg + '/gudid', REGISTER_PAUSE_MS: '0', REGISTER_NACHFASSEN_MIN: '600' });
  const browser = await launchBrowser();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error' && !/status of 404/.test(m.text())) errs.push(m.text()); });
  p.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
  p.on('dialog', d => { errs.push('NATIVER DIALOG: ' + d.message()); d.dismiss(); });

  await p.goto(srv.base + '/', { waitUntil: 'networkidle' });
  const bestandVorher = JSON.stringify((await json(srv.base, '/api/state')).state);
  await p.evaluate(() => { localStorage.setItem('hkl_raumwahl', 'neuaufbau'); localStorage.setItem('raum:neuaufbau:hkl_authuntil', String(Date.now() + 3600000)); });
  await p.goto(srv.base + '/neu/#/material/neu', { waitUntil: 'networkidle' });
  const sperre = () => p.evaluate(() => { const s = document.getElementById('naSperre'); return s ? s.querySelector('b').textContent : ''; });
  const ausweg = (k, a) => p.click('#naMain [data-na="pflichtAusweg"][data-k="' + k + '"][data-a="' + a + '"]');
  const material = n => p.evaluate(x => { const m = naAlle('material', true).find(y => y.name === x); return m ? JSON.parse(JSON.stringify(m)) : null; }, n);

  /* ── 1. Die Sperre: erst GTIN, Hersteller, REF ── */
  await p.waitForSelector('.na-pflicht');
  r.check('Karte „Pflichtangaben zum Produkt" mit GTIN *, Hersteller *, REF *', /Pflichtangaben zum Produkt/.test(await p.textContent('.na-pflicht h3'))
    && (await p.locator('.na-pflicht [data-pflicht]').count()) === 3 && /GTIN \(Barcode-Nummer\) \*[\s\S]*Hersteller \*[\s\S]*REF \(Bestellnummer des Herstellers\) \*/.test(await p.textContent('.na-pflicht')));
  r.check('je Feld die drei Auswege', (await p.locator('.na-pflicht [data-na="pflichtAusweg"]').count()) === 9
    && /gibt es nicht[\s\S]*unbekannt[\s\S]*nachtragen/.test(await p.textContent('#naAw-gtin')));
  r.check('gesperrt: Noch offen GTIN · Hersteller · REF — kein Name, kein Speichern', (await sperre()) === 'GTIN · Hersteller · REF'
    && !(await p.isVisible('input[data-f="name"]')) && (await p.locator('[data-na="entwSpeichern"], [data-na="entwWeiter"]').count()) === 0 && await p.isVisible('[data-na="entwAbbrechen"]'));
  await foto(p, 'pflicht-1-sperre');

  await ausweg('gtin', 'gibtsnicht');
  r.check('„gibt es nicht" bei der GTIN: angezeigt, offen bleiben Hersteller · REF', (await p.getAttribute('#naAw-gtin [data-a="gibtsnicht"]', 'class')).indexOf(' an') >= 0 && (await sperre()) === 'Hersteller · REF');
  await ausweg('gtin', 'gibtsnicht');
  r.check('noch einmal antippen nimmt den Ausweg zurück', (await sperre()) === 'GTIN · Hersteller · REF' && await p.evaluate(() => !NA_ENTWURF.obj.pflicht));
  await ausweg('gtin', 'gibtsnicht');
  await p.fill('input[data-f="ref"]', 'RX-100');
  r.check('REF eingetragen: die Auswege der REF verschwinden, offen bleibt der Hersteller', (await p.locator('#naAw-ref [data-na="pflichtAusweg"]').count()) === 0 && (await sperre()) === 'Hersteller');
  r.check('… und der Cursor bleibt im REF-Feld', await p.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-f') === 'ref'));
  await ausweg('hersteller', 'unbekannt');
  r.check('alles beantwortet: die Maske öffnet sich (Name im Haus, Speichern, „Speichern und nächstes")', !(await p.isVisible('#naSperre')) && await p.isVisible('input[data-f="name"]')
    && await p.isVisible('[data-na="entwSpeichern"]') && await p.isVisible('[data-na="entwWeiter"]'));
  r.check('„Weitere Produktangaben": Produktname des Herstellers und SAP-Nummer (freiwillig)', /Weitere Produktangaben/.test(await p.textContent('#naMain'))
    && await p.isVisible('input[data-f="handelsname"]') && await p.isVisible('input[data-f="sap"]') && /nach und nach ergänzen/.test(await p.textContent('#naSapStand')));
  await p.fill('input[data-f="ref"]', '');
  r.check('REF wieder leer → wieder gesperrt', (await sperre()) === 'REF' && !(await p.isVisible('input[data-f="name"]')));
  await p.fill('input[data-f="ref"]', 'RX-100');
  r.check('… und wieder offen', await warte(p, () => !document.getElementById('naSperre') && !!document.querySelector('input[data-f="name"]')));
  await foto(p, 'pflicht-2-offen');

  /* ── 2. Erinnerung vor dem Speichern (keine Pflicht), einmal je Maske ── */
  await p.fill('input[data-f="name"]', 'Ablaufschlauch'); await p.fill('input[data-f="sap"]', '000123456');
  await p.click('[data-na="entwSpeichern"]');
  r.check('vor dem Speichern gefragt: Hersteller (unbekannt) · Produktname des Herstellers · Produktfoto', await blattOffen(p, /Vor dem Speichern[\s\S]*Hersteller \(unbekannt\) · Produktname des Herstellers · Produktfoto[\s\S]*Keine Pflicht/));
  await foto(p, 'pflicht-3-erinnerung');
  await p.click('#naSheet.show [data-wert="ergaenzen"]');
  r.check('„Jetzt ergänzen": nichts gespeichert, zurück in der Maske beim Hersteller', (await blattZu(p)) && await p.evaluate(() => naAlle('material').length === 0 && location.hash === '#/material/neu')
    && await warte(p, () => document.activeElement && document.activeElement.getAttribute('data-f') === 'hersteller'));
  await p.click('[data-na="entwSpeichern"]');
  r.check('beim zweiten Speichern keine neue Frage — gespeichert', await warte(p, () => location.hash === '#/material' && naAlle('material').length === 1));
  let m = await material('Ablaufschlauch');
  r.check('gespeichert: Auswege nur, wo kein Wert steht; SAP-Nummer wie getippt', JSON.stringify(m.pflicht) === '{"gtin":"gibtsnicht","hersteller":"unbekannt"}' && m.ref === 'RX-100' && m.sap === '000123456');

  /* ── 3. SAP-Nummer doppelt: Warnung mit „Trotzdem anlegen" ── */
  await p.evaluate(() => naGeh('#/material/neu'));
  await p.fill('input[data-f="gtin"]', GTIN_B); await p.fill('input[data-f="ref"]', 'RX-200'); await ausweg('hersteller', 'nachtragen');
  await p.fill('input[data-f="name"]', 'Ablaufschlauch lang'); await p.fill('input[data-f="sap"]', '123456');
  r.check('SAP-Nummer schon vergeben: sofort sichtbar, mit Verweis (führende Nullen zählen nicht)', /schon bei: Ablaufschlauch/.test(await p.textContent('#naSapStand')));
  await p.click('[data-na="entwSpeichern"]');
  r.check('beim Speichern: „Die SAP-Nummer 123456 steht schon bei „Ablaufschlauch""', await blattOffen(p, /Die SAP-Nummer 123456 steht schon bei „Ablaufschlauch"[\s\S]*Zurück zur Maske[\s\S]*Trotzdem anlegen/));
  await foto(p, 'pflicht-4-sap-doppelt');
  await p.click('#naSheet.show button:has-text("Zurück zur Maske")');
  r.check('„Zurück zur Maske": nichts angelegt', (await blattZu(p)) && await p.evaluate(() => naAlle('material').length === 1));
  await p.click('[data-na="entwSpeichern"]'); await blattOffen(p, /steht schon bei/);
  await p.click('#naSheet.show button:has-text("Trotzdem anlegen")');
  r.check('… danach die Erinnerung (Hersteller nachtragen · Produktname · Produktfoto)', await blattOffen(p, /Vor dem Speichern[\s\S]*Hersteller \(nachtragen\)/));
  await p.click('#naSheet.show [data-wert="speichern"]');
  r.check('„Trotzdem anlegen": beide gespeichert', await warte(p, () => location.hash === '#/material' && naAlle('material').length === 2));
  const lang = await material('Ablaufschlauch lang');
  await p.evaluate(id => naGeh('#/material/' + id), lang.id);
  r.check('am zweiten steht „auch bei Ablaufschlauch"', await warte(p, () => /schon bei: Ablaufschlauch/.test((document.getElementById('naSapStand') || {}).textContent || '')));
  await p.fill('input[data-f="handelsname"]', 'Schlauch L'); await p.click('[data-na="entwSpeichern"]');
  r.check('später speichern, SAP-Nummer unverändert: keine SAP-Frage mehr, nur die Erinnerung', (await blattOffen(p, /Vor dem Speichern/)) && !/steht schon bei/.test(await p.textContent('#naSheet')));
  await p.click('#naSheet.show [data-wert="speichern"]'); await warte(p, () => location.hash === '#/material');

  /* ── 4. Alte Materialien ohne Pflichtangaben ── */
  const altId = await p.evaluate(() => { const x = naSpeichern('material', Object.assign(naStammLeer('material'), { name: 'Altbestand Draht' })); naGeh('#/material'); return x.id; });
  await warte(p, () => !!document.querySelector('[data-na="vzFilter"]'));
  const chips = async () => (await p.$$eval('[data-na="vzFilter"]', l => l.map(b => b.textContent))).join(' | ');
  r.check('Verzeichnis: Arbeitslisten „Pflichtangaben nachtragen (2)", „SAP-Nummer fehlt (1)", „doppelte SAP-Nummer (2)"', (await chips()) === 'Pflichtangaben nachtragen (2) | SAP-Nummer fehlt (1) | doppelte SAP-Nummer (2)');
  await p.click('[data-na="vzFilter"][data-f="sapdoppelt"]');
  const namen = async () => (await p.$$eval('#naVzListe .na-eintrag .na-name', l => l.map(b => b.textContent.trim()))).sort().join(' | ');
  r.check('„doppelte SAP-Nummer" zeigt beide', (await namen()) === 'Ablaufschlauch | Ablaufschlauch lang');
  await p.click('[data-na="vzFilter"][data-f="nachtragen"]');
  r.check('„Pflichtangaben nachtragen": das mit „nachtragen" und das alte ohne Antwort', (await namen()) === 'Ablaufschlauch lang | Altbestand Draht');
  await foto(p, 'pflicht-5-verzeichnis');
  await p.click('[data-na="vzFilter"][data-f="nachtragen"]');
  r.check('noch einmal antippen: wieder alle', (await p.locator('#naVzListe .na-eintrag').count()) === 3);
  await p.evaluate(id => naGeh('#/material/' + id), altId);
  r.check('altes Material öffnet gesperrt — Zusammenführen, Archivieren, Papierkorb bleiben erreichbar', await warte(p, () => !!document.getElementById('naSperre'))
    && (await sperre()) === 'GTIN · Hersteller · REF' && (await p.locator('[data-na="entwSpeichern"]').count()) === 0
    && await p.isVisible('[data-na="entwZusammen"]') && await p.isVisible('[data-na="entwArchiv"]') && await p.isVisible('[data-na="entwLoeschen"]'));
  for (const k of ['gtin', 'hersteller', 'ref']) await ausweg(k, 'nachtragen');
  r.check('nach den Antworten: offen, der Name steht', await p.isVisible('[data-na="entwSpeichern"]') && (await p.inputValue('input[data-f="name"]')) === 'Altbestand Draht');
  await p.click('[data-na="entwSpeichern"]'); await blattOffen(p, /Vor dem Speichern/); await p.click('#naSheet.show [data-wert="speichern"]');
  r.check('gespeichert mit „nachtragen" — bleibt in der Arbeitsliste', await warte(p, id => { const x = naHole('material', id); return x.pflicht && x.pflicht.ref === 'nachtragen' && location.hash === '#/material'; }, altId)
    && /Pflichtangaben nachtragen \(2\)/.test(await chips()));

  /* ── 5. HIBC-Code aus dem Handscanner ── */
  await p.evaluate(() => naGeh('#/material/neu'));
  await p.fill('input[data-f="gtin"]', HIBC);
  r.check('HIBC erkannt: REF übernommen, keine GTIN erfunden, Hinweis', await warte(p, () => NA_ENTWURF.obj.ref === 'ABC123' && NA_ENTWURF.obj.gtin === '' && /HIBC-Code gelesen: REF ABC123 übernommen\. Dieser Code trägt keine GTIN/.test(document.getElementById('naOcrStand').textContent)));
  r.check('… offen bleiben GTIN · Hersteller', (await sperre()) === 'GTIN · Hersteller');
  await ausweg('gtin', 'gibtsnicht'); await ausweg('hersteller', 'gibtsnicht'); await p.fill('input[data-f="name"]', 'Eigenbau-Adapter');
  await p.click('[data-na="entwSpeichern"]');
  r.check('Hersteller „gibt es nicht": die Erinnerung fragt nicht nach dem Hersteller', (await blattOffen(p, /Vor dem Speichern[\s\S]*Produktname des Herstellers · Produktfoto/)) && !/Hersteller \(/.test(await p.textContent('#naSheet')));
  await p.click('#naSheet.show [data-wert="speichern"]'); await warte(p, () => location.hash === '#/material');

  /* ── 6. „＋ Feld für alle Produkte": ein eigenes Pflichtfeld des Hauses ── */
  await p.evaluate(() => naGeh('#/material/neu'));
  await p.click('[data-na="globalDazu"]'); await p.fill('#naAuswQ', 'Herstellungsland');
  await p.click('#naAuswListe .sheet-act:has-text("Herstellungsland")');
  r.check('danach die Frage: Pflichtangabe oder freiwillig', await blattOffen(p, /Für alle Produkte[\s\S]*Als Pflichtangabe[\s\S]*Freiwillig/));
  await p.click('#naSheet.show [data-wert="pflicht"]');
  r.check('„Herstellungsland *" steht bei den Pflichtangaben, mit Auswegen', await warte(p, () => !!document.querySelector('.na-pflicht [data-pflicht="herkunftsland"] input[data-f="merkmale.herkunftsland"]'))
    && (await p.locator('#naAw-herkunftsland [data-na="pflichtAusweg"]').count()) === 3 && (await sperre()) === 'GTIN · Hersteller · REF · Herstellungsland');
  for (const k of ['gtin', 'hersteller', 'ref']) await ausweg(k, 'nachtragen');
  r.check('die drei festen beantwortet — noch gesperrt wegen Herstellungsland', (await sperre()) === 'Herstellungsland');
  await p.fill('input[data-f="merkmale.herkunftsland"]', 'Deutschland');
  r.check('Herstellungsland eingetragen → offen', await warte(p, () => !document.getElementById('naSperre') && !!document.querySelector('input[data-f="name"]')));
  await foto(p, 'pflicht-6-eigenes-feld');
  /* Kurzerfassung: auch das eigene Pflichtfeld wird beantwortet */
  await p.fill('input[data-f="name"]', 'Mapping-Katheter');
  await p.click('details[data-ab="verkn"] > summary'); await p.click('[data-na="verknNeu"]');
  await p.click('#naSheet.show .sheet-act:has-text("Braucht dazu")'); await p.click('#naAuswListe .sheet-act:has-text("Neues Material erfassen")');
  await p.fill('#naKurzName', 'Verbindungskabel kurz'); await p.fill('#naKurzInhalt input[data-f="sap"]', '123456');
  for (const k of ['gtin', 'ref', 'hersteller']) await p.click('#naSheet.show [data-na="kurzAusweg"][data-k="' + k + '"][data-a="nachtragen"]');
  await p.fill('#naKurzInhalt input[data-f="ref"]', 'K-1');   /* erst „nachtragen", dann doch die REF */
  r.check('Kurzerfassung: REF eingetragen → ihre Auswege verschwinden', !(await p.isVisible('#naKAw-ref')));
  await p.click('[data-na="kurzOk"]');
  r.check('Kurzerfassung verlangt auch „Herstellungsland"', /Erst die Pflichtangaben beantworten: Herstellungsland/.test(await p.textContent('#naKurzStand')));
  await foto(p, 'pflicht-7-kurzerfassung');
  await p.click('#naSheet.show [data-na="kurzAusweg"][data-k="herkunftsland"][data-a="unbekannt"]'); await p.click('[data-na="kurzOk"]');
  r.check('Kurzerfassung: SAP-Nummer schon vergeben → gesagt, noch nichts angelegt', /SAP-Nummer 123456 steht schon bei[\s\S]*Noch einmal „Anlegen"/.test(await p.textContent('#naKurzStand'))
    && await p.evaluate(() => !naAlle('material').some(x => x.name === 'Verbindungskabel kurz')));
  await p.click('[data-na="kurzOk"]');
  const kabel = await (async () => { await warte(p, () => naAlle('material').some(x => x.name === 'Verbindungskabel kurz')); return material('Verbindungskabel kurz'); })();
  r.check('kurz erfasst (zweiter Tipp): SAP-Nummer, REF und Antworten gespeichert — kein Ausweg neben der REF, verknüpft', !!kabel && kabel.sap === '123456' && kabel.ref === 'K-1' && !('ref' in kabel.pflicht)
    && kabel.pflicht.herkunftsland === 'unbekannt' && kabel.pflicht.gtin === 'nachtragen'
    && await p.evaluate(id => (NA_ENTWURF.obj.verknuepfungen || []).some(v => v.ziel === id), kabel.id));
  await p.click('[data-na="entwAbbrechen"]'); await p.click('#naSheet.show button:has-text("Verwerfen")'); await warte(p, () => location.hash === '#/material');
  r.check('Verzeichnis: alle anderen müssen das neue Pflichtfeld nachtragen (5)', /Pflichtangaben nachtragen \(5\)/.test(await chips()));
  /* Ansicht (ohne Anmeldung): Pflichtangaben mit dem Ausweg-Wort */
  const ansicht = await p.evaluate(id => { const d = document.createElement('div'); d.innerHTML = naStammAnsicht('material', naHole('material', id)); return d.textContent; }, kabel.id);
  if (process.env.PFLICHT_DEBUG) console.log(ansicht);
  r.check('Ansicht zeigt die Antworten („nachtragen", „unbekannt") und die SAP-Nummer', /GTIN[\s\S]*nachtragen/.test(ansicht) && /Herstellungsland[\s\S]*unbekannt/.test(ansicht) && /SAP-Nummer:\s*123456/.test(ansicht) && /REF:\s*K-1/.test(ansicht));
  /* zurück über die Seite des Merkmals */
  await p.evaluate(() => naGeh('#/liste/merkmale/herkunftsland'));
  r.check('Seite des Merkmals: „Platz in der Material-Maske" — Pflichtangabe', await warte(p, () => /Platz in der Material-Maske[\s\S]*Pflichtangabe/.test(document.getElementById('naMain').textContent)));
  await p.click('[data-na="mmPlatz"]'); await p.click('#naSheet.show [data-wert="aus"]');
  r.check('„Je nach Kategorie": wieder nur bei den Kategorien — die Arbeitsliste schrumpft', await warte(p, () => !naKat().global.some(g => g.mid === 'herkunftsland'))
    && await p.evaluate(() => naAlle('material').filter(o => naPflichtNachtragen(o, naKat()).length).length === 3));

  await p.evaluate(() => naGeh('#/liste/merkmale/steril'));
  r.check('„Steril" hat einen festen Platz — nicht für alle Produkte umstellbar', await warte(p, () => /fester Platz/.test(document.getElementById('naMain').textContent) && !document.querySelector('[data-na="mmPlatz"]')));
  await p.evaluate(() => naGeh('#/liste/merkmale/roentgenfaden'));
  await p.click('[data-na="mmPlatz"]');
  r.check('Ja/Nein-Merkmal: nur freiwillig für alle Produkte, nie Pflicht (leeres Häkchen ≠ „nein")', (await blattOffen(p, /Ja\/Nein-Merkmale nur freiwillig/)) && (await p.locator('#naSheet.show [data-wert="pflicht"]').count()) === 0);
  await p.evaluate(() => naSheetZu(null));

  /* ── 7. Abgleich und die wichtigste Zusage ── */
  await warte(p, () => naAbgleich.offen() === 0, null, 10000);
  const neu = (await json(srv.base, '/api/state?raum=neuaufbau')).state;
  r.check('Server (Neuaufbau): SAP-Nummer und Antworten angekommen', neu['na_m_' + m.id] && neu['na_m_' + m.id].sap === '000123456' && neu['na_m_' + m.id].pflicht.gtin === 'gibtsnicht');
  r.check('Server (Bestand): Byte für Byte unverändert', JSON.stringify((await json(srv.base, '/api/state')).state) === bestandVorher);
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } }); const p2 = await ctx2.newPage(); const errs2 = [];
  p2.on('pageerror', e => errs2.push(e.message));
  await p2.route('**/data/merkmale.json', rt => rt.abort());
  await p2.goto(srv.base + '/', { waitUntil: 'networkidle' });
  await p2.evaluate(() => { localStorage.setItem('hkl_raumwahl', 'neuaufbau'); localStorage.setItem('raum:neuaufbau:hkl_authuntil', String(Date.now() + 3600000)); });
  await p2.goto(srv.base + '/neu/#/material/neu', { waitUntil: 'networkidle' });
  r.check('ohne Merkmal-Katalog (offline, Serverfehler): die Maske baut sich trotzdem auf', await warte(p2, () => !!document.querySelector('.na-pflicht') && !document.querySelector('.na-fehler')) && errs2.length === 0);
  await ctx2.close();
  const fehler = errs.filter(x => !/favicon|ERR_ABORTED|Failed to load resource/.test(x));
  r.check('keine Fehler in der Konsole' + (fehler.length ? ': ' + fehler.slice(0, 3).join(' | ') : ''), fehler.length === 0);
  attrappe.close();
  await r.finish(browser, [srv]);
})().catch(e => { console.error(e); process.exit(1); });
