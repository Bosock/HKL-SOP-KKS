/* NEUE APP — die Material-Maske nach dem Umbau (public/neu/js/stamm.js,
   barcode.js, server/register.js), im echten Browser.

   Geprüft wird der Weg, den ein Mensch am Schrank geht: Barcode scannen →
   das EU-Register füllt Hersteller, Handelsname und REF → Name, Lagerort →
   speichern und das nächste. Dazu: Verknüpfungen mit Kurzerfassung (das
   zweite Material entsteht, ohne die Maske zu verlassen), der Schutz vor dem
   Verlassen, Variante, „unvollständig" im Verzeichnis, Zubehör-Frage und
   Ersatz-Hinweis im Standard.

   · Die Register sind eine Attrappe (lokaler HTTP-Server, Adressen per
     Umgebung) — der Test geht nie ins Internet.
   · Die Kamera ist eine Zeichenfläche mit einem echten EAN-13-Strichcode:
     gelesen wird er vom wirklichen Barcode-Leser (public/vendor/zxing/).
   · Der BESTAND bleibt Byte für Byte unverändert.

   MASKE_BILDER=<ordner> legt Bildschirmfotos dort ab. */
'use strict';
const http = require('http');
const path = require('path');
const { launchBrowser, startServer, reporter } = require('./util');

function ean13(z12) { const z = z12.split('').map(Number); let s = 0; z.forEach((d, i) => { s += d * (i % 2 ? 3 : 1); }); return z12 + ((10 - (s % 10)) % 10); }
const E_HAHN = '4022495787309';                    /* echte GTIN (B. Braun Discofix C) */
const E_ZWEI = ean13('401234567890');
const E_FREMD = ean13('401234567891');             /* steht in keinem Register */
const E_AUSFALL = ean13('401234567892');
const E_ALT = ean13('401234567893');             /* steht in keinem Register (für „Nachholen") */
const E_STOER = ean13('401234567894');           /* steht in EUDAMED — wird während einer Störung gefragt */
const G = e => '0' + e;
/* Strichfolge eines EAN-13 (95 Module). */
function eanBits(code) {
  const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
  const R = L.map(x => x.split('').map(b => b === '1' ? '0' : '1').join(''));
  const Gc = R.map(x => x.split('').reverse().join(''));
  const P = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'][+code[0]];
  let b = '101';
  for (let i = 1; i <= 6; i++) b += (P[i - 1] === 'L' ? L : Gc)[+code[i]];
  b += '01010';
  for (let i = 7; i <= 12; i++) b += R[+code[i]];
  return b + '101';
}
const EUDAMED = {
  [G(E_HAHN)]: { TRADE_NAME: 'Discofix® C', REFERENCE: '16494C', LATEX: 0.0, STERILE: 1.0, REUSABLE: 0.0, BASIC_UDI: '40392390000030642E', DEVICE_NAME: 'Discofix C Stopcocks and Manifolds Gamma', NOMENCLATURE_CODE: ' A0703', MF_SRN: 'DE-MF-000000201', MF_NAME: 'B. Braun Melsungen AG' },
  [G(E_ZWEI)]: { TRADE_NAME: 'Hahnbank 3-fach', REFERENCE: 'HB-3', LATEX: 0.0, STERILE: 1.0, REUSABLE: 0.0, NOMENCLATURE_CODE: 'A0703', MF_SRN: 'DE-MF-000000201', MF_NAME: 'B. Braun Melsungen AG' },
  [G(E_STOER)]: { TRADE_NAME: 'Injekt® Luer Solo', REFERENCE: '4606051V', LATEX: 0.0, STERILE: 1.0, REUSABLE: 0.0, NOMENCLATURE_CODE: 'A020102010102', MF_SRN: 'DE-MF-000000201', MF_NAME: 'B. Braun Melsungen AG' },
};
async function json(base, p) { return (await fetch(base + p, { cache: 'no-store' })).json(); }
async function warte(page, fn, arg, ms) { try { await page.waitForFunction(fn, arg, { timeout: ms || 8000 }); return true; } catch (e) { return false; } }
const BILDER = process.env.MASKE_BILDER || '';
async function foto(page, name) { if (BILDER) await page.screenshot({ path: path.join(BILDER, name + '.png'), fullPage: true }); }
const blattOffen = (p, re) => warte(p, r => { const s = document.getElementById('naSheet'); return s.classList.contains('show') && new RegExp(r).test(s.textContent); }, re.source);

(async () => {
  const r = reporter('neue-app-maske');
  const zaehler = { eudamed: 0, gudid: 0 };
  /* ausfall: E_AUSFALL bringt beide Register zum Fehler (Schritt 9) · stoerung: EUDAMED meldet für
     JEDES Produkt „404 Data not found" — so gemessen am 13.11.2026 (Schritt 12e). */
  const lage = { ausfall: true, stoerung: false };
  const attrappe = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'); const antwort = (c, o) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    const nichtGefunden = () => { res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(' Data not found '); };   /* wie die echte Schnittstelle */
    if (u.pathname === '/eudamed') { zaehler.eudamed++; const g = u.searchParams.get('PRIMARY_DI');
      if (lage.stoerung) return nichtGefunden();
      if (lage.ausfall && g === G(E_AUSFALL)) return antwort(500, { message: 'Internal server error' });
      return EUDAMED[g] ? antwort(200, { value: [EUDAMED[g]] }) : nichtGefunden(); }
    if (u.pathname === '/gudid') { zaehler.gudid++; if (lage.ausfall && u.searchParams.get('di') === G(E_AUSFALL)) return antwort(500, {}); return antwort(404, { error: 'No device found' }); }
    antwort(404, {});
  });
  await new Promise(ok => attrappe.listen(0, '127.0.0.1', ok));
  const reg = 'http://127.0.0.1:' + attrappe.address().port;
  /* Gegenprobe mit dem Hahn (den die Attrappe kennt); keine Pausen; selbsttätiges Nachfragen erst nach
     10 Stunden — es sei denn, das Register meldet sich zurück (Schritt 12e). */
  const srv = await startServer({ REGISTER_EUDAMED_URL: reg + '/eudamed', REGISTER_GUDID_URL: reg + '/gudid', REGISTER_PRUEF_GTIN: G(E_HAHN), REGISTER_PAUSE_MS: '0', REGISTER_NACHFASSEN_MIN: '600' });
  const browser = await launchBrowser();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error' && !/status of 500|status of 404/.test(m.text())) errs.push(m.text()); });
  p.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
  p.on('dialog', d => { errs.push('NATIVER DIALOG: ' + d.message()); d.dismiss(); });

  await p.goto(srv.base + '/', { waitUntil: 'networkidle' });
  const bestandVorher = JSON.stringify((await json(srv.base, '/api/state')).state);
  await p.evaluate(() => { localStorage.setItem('hkl_raumwahl', 'neuaufbau'); localStorage.setItem('raum:neuaufbau:hkl_authuntil', String(Date.now() + 3600000)); });
  await p.goto(srv.base + '/neu/#/material/neu', { waitUntil: 'networkidle' });

  /* Die „Kamera": eine Zeichenfläche. window.__kamera = Strichfolge | '' (leeres Bild) | 'nein' (nicht freigegeben). */
  await p.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 960; c.height = 540; const x = c.getContext('2d'); let t = 0;
    window.__zeichne = (bits, ziel) => { const k = ziel || x; const w = k.canvas.width, h = k.canvas.height;
      k.fillStyle = '#fff'; k.fillRect(0, 0, w, h);
      if (bits) { const m = 6, links = (w - bits.length * m) / 2; k.fillStyle = '#000'; for (let i = 0; i < bits.length; i++) if (bits[i] === '1') k.fillRect(links + i * m, h * 0.2, m, h * 0.6); } };
    setInterval(() => { if (window.__kamera === 'nein') return; window.__zeichne(window.__kamera || ''); x.fillStyle = (t++ % 2) ? '#fefefe' : '#fff'; x.fillRect(0, 0, 2, 2); }, 120);
    navigator.mediaDevices.getUserMedia = async () => { if (window.__kamera === 'nein') throw new DOMException('verweigert', 'NotAllowedError'); return c.captureStream(10); };
  });
  const kamera = bits => p.evaluate(b => { window.__kamera = b; }, bits);
  const eanDatei = async code => { const url = await p.evaluate(b => { const c = document.createElement('canvas'); c.width = 900; c.height = 420; window.__zeichne(b, c.getContext('2d')); return c.toDataURL('image/png'); }, eanBits(code));
    return { name: 'barcode.png', mimeType: 'image/png', buffer: Buffer.from(url.split(',')[1], 'base64') }; };
  const entwurf = () => p.evaluate(() => JSON.parse(JSON.stringify(NA_ENTWURF.obj)));
  const stand = () => p.textContent('#naOcrStand');

  /* ── 1. Scannen: Der echte Leser liest den Strichcode, das Register füllt die Maske ── */
  r.check('Maske beginnt mit „Erkennen": Barcode scannen und Etikett lesen', (await p.isVisible('[data-na="scan"]')) && (await p.isVisible('[data-na="etikett"]')) && (await p.isVisible('input[data-f="name"]')));
  await kamera(eanBits(E_HAHN));
  await p.click('[data-na="scan"]');
  r.check('Live-Bild erscheint', await warte(p, () => !!document.getElementById('naScanOv')));
  r.check('Strichcode erkannt, Fenster schließt von selbst', await warte(p, () => !document.getElementById('naScanOv') && NA_ENTWURF.obj.gtin, null, 20000));
  r.check('Register gefragt und übernommen', await warte(p, () => /EUDAMED.*übernommen/.test(document.getElementById('naOcrStand').textContent), null, 10000));
  let e = await entwurf();
  r.check('GTIN 14-stellig mit Prüfziffer (' + e.gtin + ')', e.gtin === G(E_HAHN));
  r.check('aus dem Register: Handelsname, REF, steril, latexfrei, Einmalprodukt', e.handelsname === 'Discofix® C' && e.ref === '16494C' && e.merkmale.steril === 'steril' && e.merkmale.latex === 'latexfrei' && e.merkmale.einmalgebrauch === true);
  const her = await p.evaluate(id => naListeEintrag('hersteller', id), e.hersteller);
  r.check('Hersteller: Kurzname fürs Haus, amtlicher Name und Registriernummer (' + (her || {}).name + ')', her && her.name === 'B. Braun Melsungen' && her.amtlich === 'B. Braun Melsungen AG' && her.srn === 'DE-MF-000000201');
  r.check('Quelle und Status sichtbar: „noch nicht bestätigt"', /EUDAMED[\s\S]*noch nicht bestätigt/.test(await p.textContent('.na-info.na-offen')) && !e.register.bestaetigt);
  r.check('Kategorie vorgeschlagen (aus der Einordnung A0703)', e.kategorie === 'infusion' && /Infusion/.test(await p.textContent('details[data-ab="kat"] > summary')));
  r.check('Der Name im Haus bleibt leer — der Handelsname wird nur angeboten', e.name === '' && await p.isVisible('#naNameVor [data-na="nameNehmen"]'));
  await foto(p, 'maske-1-nach-scan');

  /* ── 2. Name mit Vorschlägen aus dem Haus; Lagerort als Liste ── */
  await p.fill('input[data-f="name"]', '3-Wege');
  r.check('Namensvorschläge beim Tippen', await warte(p, () => Array.from(document.querySelectorAll('#naNameVor [data-na="nameNehmen"]')).some(b => b.textContent === '3-Wege-Hahn')));
  await p.click('#naNameVor [data-na="nameNehmen"]:text-is("3-Wege-Hahn")');
  r.check('Vorschlag übernommen', (await p.inputValue('input[data-f="name"]')) === '3-Wege-Hahn');
  await p.click('button[data-f="lagerort"]'); await p.fill('#naAuswQ', 'Schrank 1'); await p.click('#naAuswListe >> text=„Schrank 1" neu anlegen');
  r.check('„fehlt noch" nennt nur noch das Produktbild', /fehlt noch: Produktbild\./.test(await p.textContent('#naFehltZeile')));

  /* ── 3. Neue Felder: Verwendung, Suchwörter, PZN (mit Prüfziffer), Packung und Preis ── */
  await p.click('details[data-ab="verw"] > summary');
  await p.fill('textarea[data-f="verwendung"]', 'Druckmessung, Kontrastmittelgabe');
  await p.fill('input[data-f="suchwoerter"]', 'Dreiwegehahn, Hahnbank');
  await p.fill('input[data-f="pzn"]', '03295092');
  r.check('falsche PZN sofort angezeigt', /stimmt nicht/.test(await p.textContent('#naPznStand')));
  await p.click('[data-na="entwSpeichern"]'); await p.waitForTimeout(300);
  r.check('… und nicht gespeichert', await p.evaluate(() => naAlle('material').length === 0 && !!NA_ENTWURF));
  const pzn = await p.evaluate(() => { for (let i = 0; i < 10; i++) if (naPznOk('0329509' + i)) return '0329509' + i; return ''; });
  await p.fill('input[data-f="pzn"]', pzn);
  r.check('richtige PZN bestätigt', /✓/.test(await p.textContent('#naPznStand')));
  await p.click('details[data-ab="pack"] > summary');
  await p.fill('input[data-f="packung"]', '50'); await p.fill('input[data-f="preis.betrag"]', '25');
  await p.click('[data-na="preisPackung"]');
  r.check('„Preis gilt für die Packung": Stückpreis 0,50 €', /0,50/.test(await p.textContent('#naStueckpreis')) && (await entwurf()).preis.bezugsmenge === 50);

  /* ── 4. Verknüpfung „braucht dazu" — das zweite Material entsteht in der Kurzerfassung ── */
  await p.click('details[data-ab="verkn"] > summary'); await p.click('[data-na="verknNeu"]');
  r.check('drei Arten zur Wahl', (await p.locator('#naSheet.show .sheet-act').count()) === 3);
  await p.click('#naSheet.show .sheet-act:has-text("Braucht dazu")');
  await p.click('#naAuswListe .sheet-act:has-text("Neues Material erfassen")');
  r.check('Kurzerfassung öffnet als Blatt — die Maske bleibt dahinter', (await blattOffen(p, /kurz erfassen/)) && await p.evaluate(() => location.hash === '#/material/neu' && NA_ENTWURF.obj.name === '3-Wege-Hahn'));
  await p.click('[data-na="kurzOk"]');
  r.check('ohne Namen wird nichts angelegt', /Namen eintragen/.test(await p.textContent('#naKurzStand')) && await p.evaluate(() => naAlle('material').length === 0));
  await p.fill('#naKurzName', 'Verlängerung 30 cm'); await p.click('[data-na="kurzOk"]');
  r.check('Zubehör angelegt und verknüpft; Eingaben der Maske unverändert', await warte(p, () => naAlle('material').length === 1 && (NA_ENTWURF.obj.verknuepfungen || []).length === 1 && NA_ENTWURF.obj.name === '3-Wege-Hahn' && NA_ENTWURF.obj.packung === '50'));
  r.check('Zeile nennt Art und Material', /Braucht dazu[\s\S]*Verlängerung 30 cm/.test(await p.textContent('details[data-ab="verkn"]')));

  /* ── 5. Ersatz: Kurzerfassung per FOTO vom Barcode, mit Sorte und Grund ── */
  await kamera('');   /* die Kamera sieht nichts — der Nutzer weicht auf ein Foto aus */
  await p.click('[data-na="verknNeu"]'); await p.click('#naSheet.show .sheet-act:has-text("Stattdessen geht auch")');
  await p.click('#naAuswListe .sheet-act:has-text("Neues Material erfassen")');
  await p.click('[data-na="kurzScan"]'); await p.waitForSelector('#naScanFoto');
  const fc = p.waitForEvent('filechooser'); await p.click('#naScanFoto'); await (await fc).setFiles(await eanDatei(E_ZWEI));
  r.check('Barcode aus dem Foto gelesen, Register gefüllt', await warte(p, g => NA_KURZ && NA_KURZ.o.gtin === g && NA_KURZ.o.handelsname === 'Hahnbank 3-fach' && NA_KURZ.o.ref === 'HB-3', G(E_ZWEI), 20000));
  r.check('derselbe Hersteller wird wiedererkannt (an der Registriernummer), nicht doppelt angelegt', await p.evaluate(() => naListe('hersteller', true).length === 1));
  await p.click('[data-na="kurzName"]');
  await foto(p, 'maske-2-kurzerfassung');
  await p.click('[data-na="kurzOk"]');
  r.check('danach die Frage nach der Sorte', await blattOffen(p, /Welche Art von Ersatz/));
  r.check('vier Sorten', (await p.locator('#naSheet.show [data-na="verknSorte"]').count()) === 4);
  await p.fill('#naVkGrund', 'nur bei Lieferengpass'); await p.click('#naSheet.show [data-na="verknSorte"][data-s="teuer"]');
  e = await entwurf();
  r.check('Ersatz mit Sorte und Grund am Material', e.verknuepfungen.length === 2 && e.verknuepfungen[1].art === 'ersatz' && e.verknuepfungen[1].sorte === 'teuer' && e.verknuepfungen[1].grund === 'nur bei Lieferengpass');
  const kurz = await p.evaluate(() => naAlle('material').find(m => m.name === 'Hahnbank 3-fach'));
  r.check('kurz Erfasstes: gespeichert, mit Kategorie-Vorschlag, Registerdaten noch NICHT bestätigt', kurz && kurz.kategorie === 'infusion' && kurz.register && !kurz.register.bestaetigt && kurz.ref === 'HB-3');

  /* Eine GTIN, die es schon gibt: kein zweites Material, das vorhandene wird verknüpft. */
  await p.click('[data-na="verknNeu"]'); await p.click('#naSheet.show .sheet-act:has-text("Aufbereitete Fassung von")');
  await p.click('#naAuswListe .sheet-act:has-text("Neues Material erfassen")');
  await p.fill('#naKurzInhalt input[data-f="gtin"]', G(E_ZWEI));
  r.check('Kurzerfassung erkennt die vorhandene GTIN', await warte(p, () => /gibt es schon/.test(document.getElementById('naKurzInhalt').textContent)));
  await p.click('[data-na="kurzVorhanden"]');
  r.check('… und verknüpft das Vorhandene (kein drittes Material)', await warte(p, () => (NA_ENTWURF.obj.verknuepfungen || []).length === 3 && naAlle('material').length === 2));
  await p.click('[data-na="verknWeg"][data-i="2"]');
  r.check('Verknüpfung entfernt', (await entwurf()).verknuepfungen.length === 2);
  await foto(p, 'maske-3-verknuepfungen');

  /* ── 6. Speichern und nächstes: Lagerort bleibt, alles andere ist leer ── */
  await p.click('[data-na="entwWeiter"]');
  r.check('gespeichert, neue leere Maske', await warte(p, () => naAlle('material').length === 3 && NA_ENTWURF && NA_ENTWURF.neu && NA_ENTWURF.obj.name === '' && location.hash === '#/material/neu'));
  const hahn = await p.evaluate(() => naAlle('material').find(m => m.name === '3-Wege-Hahn'));
  e = await entwurf();
  r.check('Lagerort steht noch, Hersteller und GTIN nicht', e.lagerort === hahn.lagerort && !e.hersteller && !e.gtin && await p.evaluate(() => naLagerortName(NA_ENTWURF.obj) === 'Schrank 1'));
  r.check('Stammsatz: Registerdaten mit dem Speichern bestätigt; neue Felder gespeichert', !!hahn.register.bestaetigt && hahn.register.quelle === 'EUDAMED' && hahn.pzn === pzn && hahn.packung === '50' && hahn.suchwoerter === 'Dreiwegehahn, Hahnbank' && /Druckmessung/.test(hahn.verwendung));
  r.check('leere Maske lässt sich ohne Rückfrage verlassen', await (async () => { await p.click('.na-tab:has-text("Geräte")'); return warte(p, () => location.hash === '#/geraet'); })());

  /* ── 7. Dieselbe GTIN noch einmal gescannt: der Weg führt zum vorhandenen Eintrag ── */
  await p.click('.na-tab:has-text("Material")'); await p.click('.na-plus');
  await kamera(eanBits(E_HAHN)); await p.click('[data-na="scan"]');
  r.check('doppelte GTIN beim Scannen benannt', await blattOffen(p, /gehört schon zu „3-Wege-Hahn"/));
  await p.click('#naSheet.show button:has-text("Diesen Eintrag öffnen")');
  r.check('… und der vorhandene Eintrag öffnet', await warte(p, id => location.hash === '#/material/' + id, hahn.id));
  r.check('gespeicherter Eintrag: Register „bestätigt"', /bestätigt \d\d\.\d\d\.\d{4}/.test(await p.textContent('.na-karte .na-info')) && !(await p.isVisible('.na-info.na-offen')));

  /* ── 8. Variante: Familie bleibt, Nummern nicht ── */
  await p.click('[data-na="entwVariante"]');
  r.check('Variante öffnet als neues Material mit Hinweis', await warte(p, () => location.hash === '#/material/neu' && NA_ENTWURF.neu && /Variante von „3-Wege-Hahn"/.test(document.getElementById('naMain').textContent)));
  e = await entwurf();
  r.check('übernommen: Name, Hersteller, Kategorie, Lagerort — leer: GTIN, REF, Bilder, Verknüpfungen', e.name === '3-Wege-Hahn' && e.hersteller === hahn.hersteller && e.kategorie === 'infusion' && e.lagerort === hahn.lagerort && !e.gtin && !e.ref && !e.verknuepfungen && e.varianteVon === hahn.id);

  /* ── 9. Scanner-Text im GTIN-Feld; Ausfall und Fehlanzeige des Registers ── */
  await p.fill('input[data-f="gtin"]', '(01)' + G(E_FREMD) + '(17)280630(10)LOT123(240)REF-77');
  r.check('Text eines Handscanners: GTIN und REF übernommen, Charge und Verfall nie', await warte(p, g => NA_ENTWURF.obj.gtin === g && NA_ENTWURF.obj.ref === 'REF-77' && !/LOT123|280630/.test(JSON.stringify(NA_ENTWURF.obj)), G(E_FREMD)));
  await p.click('[data-na="registerHolen"]');
  r.check('Fehlanzeige wird gesagt, nichts erfunden', await warte(p, () => /steht dazu nichts/.test(document.getElementById('naOcrStand').textContent)) && !(await entwurf()).register);
  /* Die Antwort des Registers darf nicht stören, wenn schon getippt wird. */
  await p.fill('input[data-f="gtin"]', G(E_HAHN).slice(0, 13)); await p.focus('input[data-f="name"]');
  await p.evaluate(() => { const f = document.querySelector('input[data-f="name"]'); f.setSelectionRange(3, 3); naFormNeu(); });
  r.check('Neuzeichnen lässt Cursor und Feld, in dem getippt wird', await p.evaluate(() => { const a = document.activeElement; return a && a.getAttribute('data-f') === 'name' && a.selectionStart === 3; }));
  await p.fill('input[data-f="gtin"]', G(E_AUSFALL)); await p.click('[data-na="registerHolen"]');
  r.check('Register antwortet nicht: gesagt (mit „der Server fragt von selbst weiter"), GTIN bleibt', await warte(p, () => /antwortet gerade nicht[\s\S]*fragt von selbst weiter/.test(document.getElementById('naOcrStand').textContent)) && (await entwurf()).gtin === G(E_AUSFALL));
  lage.ausfall = false;

  /* Kamera nicht freigegeben → das Fenster bietet das Foto an. */
  await p.fill('input[data-f="gtin"]', ''); await kamera('nein');
  await p.click('[data-na="scan"]');
  r.check('Kamera verweigert: Hinweis und Foto-Knopf statt stiller Abbruch', await warte(p, () => { const o = document.getElementById('naScanOv'); return o && o.classList.contains('ohne-kamera') && /nicht freigegeben/.test(o.textContent); }));
  await p.click('#naScanZu');
  r.check('Abbrechen schließt den Scanner', !(await p.isVisible('#naScanOv')));
  await p.click('[data-na="entwAbbrechen"]'); await p.click('#naSheet.show button:has-text("Verwerfen")');
  await warte(p, () => location.hash === '#/material');

  /* ── 10. Verzeichnis: „unvollständig"; Gegenrichtung der Verknüpfung ── */
  r.check('Filter „unvollständig (3)"', /unvollständig \(3\)/.test(await p.textContent('[data-na="vzOffen"]')));
  r.check('Zeile sagt, was fehlt', /fehlt: .*Produktbild/.test(await p.textContent('.na-eintrag:has-text("3-Wege-Hahn")')));
  await p.fill('#naVzQ', 'Dreiwegehahn');
  r.check('Suche findet über Suchwörter', (await p.locator('#naVzListe .na-eintrag').count()) === 1 && /3-Wege-Hahn/.test(await p.textContent('#naVzListe')));
  await p.fill('#naVzQ', '');
  await p.click('.na-eintrag:has-text("Verlängerung 30 cm")'); await p.click('details[data-ab="verkn"] > summary');
  r.check('am Zubehör steht die Gegenrichtung (nur gelesen)', /Wird gebraucht von[\s\S]*3-Wege-Hahn/.test(await p.textContent('details[data-ab="verkn"] .na-vk.fremd')));
  await p.click('[data-na="entwAbbrechen"]');

  /* ── 11. Im Standard: Zubehör wird angeboten, Ersatz steht an der Zeile ── */
  const sid = await p.evaluate(() => { const s = naStandardNeu('Koronarangiographie', '', ['Materialien']); naSpeichern('standard', s); naGeh('#/s/' + s.id + '/bearbeiten'); return s.id; });
  await p.click('[data-na="neuAnlegen"]'); await p.click('#naAuswListe >> text=Material');
  await p.click('#naAuswListe .sheet-act:has-text("3-Wege-Hahn")'); await p.click('#naSheet >> text=Übernehmen');
  r.check('„Dazu gehört noch Zubehör" nennt die Verlängerung', (await blattOffen(p, /Dazu gehört noch Zubehör/)) && /Verlängerung 30 cm/.test(await p.textContent('#naSheet')));
  await p.click('#naSheet.show button:has-text("Hinzufügen")');
  r.check('Zubehör als zweite Position — erst nach der Zustimmung', await warte(p, id => naPositionen(naHole('standard', id)).length === 2, sid));
  await p.evaluate(id => naGeh('#/s/' + id), sid);
  r.check('Zeile zeigt „Ersatz"', (await p.locator('.na-pos .na-chip.ersatz').count()) === 1);
  await p.click('.na-pos:has-text("3-Wege-Hahn") .na-ptext');
  r.check('Antippen zeigt Ersatz mit Sorte und Grund', (await blattOffen(p, /Stattdessen geht auch/)) && /Hahnbank 3-fach[\s\S]*teures Äquivalent — nur bei Lieferengpass/.test(await p.textContent('#naSheet')));
  await foto(p, 'maske-4-standard-ersatz');
  await p.evaluate(() => naSheetZu(null));

  /* ── 12. Dublette zusammenführen: Verknüpfungen zeigen auf den Verbleibenden ── */
  const ids = await p.evaluate(() => { const f = n => naAlle('material').find(m => m.name === n).id; return { hahn: f('3-Wege-Hahn'), bank: f('Hahnbank 3-fach'), verl: f('Verlängerung 30 cm') }; });
  const neuId = await p.evaluate(() => naSpeichern('material', Object.assign(naStammLeer('material'), { name: 'Hahnbank dreifach' })).id);
  await p.evaluate(a => naStammZusammenfuehren('material', a.von, a.nach), { von: ids.bank, nach: neuId });
  r.check('Ersatz zeigt nach dem Zusammenführen auf den verbleibenden Eintrag', await p.evaluate(a => { const v = naHole('material', a.hahn).verknuepfungen; return v.some(x => x.art === 'ersatz' && x.ziel === a.neu && x.sorte === 'teuer') && !v.some(x => x.ziel === a.bank); }, { hahn: ids.hahn, bank: ids.bank, neu: neuId }));

  /* ── 12b. Kategorien gehören dem Haus: Suchwörter ändern, Vorgabe zurückholen (A7) ── */
  await p.evaluate(() => naGeh('#/liste/kategorien'));
  await p.click('.na-eintrag:has-text("Infusion / Leitung / Hahn")');
  r.check('Kategorie im Listen-Verzeichnis: „Suchwörter ändern" zeigt die Vorgabe', (await blattOffen(p, /Suchwörter ändern/)) && /hahn/i.test(await p.textContent('#naSheet')));
  await p.click('#naSheet.show [data-wert="worte"]');
  await p.fill('#naEingabeFeld', 'Discofix, Hahnbank, xy'); await p.click('#naSheet.show [data-na="eingabeOk"]');
  r.check('eigene Suchwörter gespeichert (zu kurze verworfen)', await warte(p, () => JSON.stringify(naKatTpl().klassen.infusion.worte) === '["discofix","hahnbank"]'));
  await p.evaluate(() => naGeh('#/material/neu')); await p.fill('input[data-f="name"]', 'Discofix C neu');
  r.check('… und die Maske schlägt danach vor', await warte(p, () => NA_ENTWURF.obj.kategorie === 'infusion'));
  await p.click('[data-na="entwAbbrechen"]'); await p.click('#naSheet.show button:has-text("Verwerfen")');
  await p.evaluate(() => naGeh('#/liste/kategorien')); await p.click('.na-eintrag:has-text("Infusion / Leitung / Hahn")');
  await p.click('#naSheet.show [data-wert="worteVorgabe"]');
  r.check('Vorgabe zurückgeholt', await warte(p, () => !('worte' in (naKatTpl().klassen.infusion || {})) && naKat().klassen.find(k => k.id === 'infusion').worte.length > 2));

  /* ── 12c. Nachholen: Materialien, die ohne Registerdaten erfasst wurden (z. B. während eines Ausfalls) ── */
  const nach = await p.evaluate(a => {
    const x = naSpeichern('material', Object.assign(naStammLeer('material'), { name: 'Alt erfasst A', gtin: a.zwei, ref: 'EIGENE-REF' }));
    const y = naSpeichern('material', Object.assign(naStammLeer('material'), { name: 'Alt erfasst B', gtin: a.fremd }));
    naGeh('#/material'); return { x: x.id, y: y.id };
  }, { zwei: G(E_ZWEI), fremd: G(E_ALT) });
  r.check('Verzeichnis bietet „Aus dem Register ergänzen (2)"', /Aus dem Register ergänzen \(2\)/.test(await p.textContent('#naMain')));
  await p.click('[data-na="registerNachholen"]'); await p.click('#naSheet.show button:has-text("Nachschlagen")');
  r.check('nachgeholt: leere Felder gefüllt, eigene REF bleibt, Status „noch nicht bestätigt"', await warte(p, a => { const x = naHole('material', a.x);
    return !NA_NACHHOLEN && x.handelsname === 'Hahnbank 3-fach' && x.ref === 'EIGENE-REF' && !!x.hersteller && x.kategorie === 'infusion' && x.register && x.register.quelle === 'EUDAMED' && !x.register.bestaetigt; }, nach, 30000));
  r.check('… und ohne Treffer bleibt alles leer (nichts erfunden)', await p.evaluate(a => { const y = naHole('material', a.y); return !y.register && !y.hersteller && !y.ref; }, nach));
  r.check('danach bietet das Verzeichnis nur noch den Rest an', /Aus dem Register ergänzen \(1\)/.test(await p.textContent('#naMain')));

  /* ── 12d. Merkmale suchen und zuordnen — das Beispiel vom 12.11.2026: ein Kabel und seine Resterilisation ── */
  await p.evaluate(() => naGeh('#/material/neu'));
  await p.fill('input[data-f="name"]', 'Inquiry 1910-SA Verbindungskabel');
  r.check('Kategorie steht sichtbar beim Namen (Vorschlag „Kabel")', await warte(p, () => /Kategorie: Kabel/.test(document.getElementById('naKatZeile').textContent) && NA_ENTWURF.obj.kategorie === 'kabel'));
  await p.evaluate(() => { NA_ENTWURF.offen.kat = true; naFormNeu(); });
  await p.click('[data-na="merkSuchen"]'); await p.fill('#naAuswQ', 'Resterilisation');
  const gefunden = await p.$$eval('#naAuswListe .sheet-act', l => l.map(b => b.textContent));
  r.check('„Resterilisation" findet die passenden Merkmale über Suchwörter (' + gefunden.length + ')', ['Aufbereitungs-Zyklus', 'Zulässige Wiederverwendungen', 'Resterilisierbar'].every(w => gefunden.some(t => t.indexOf(w) >= 0)));
  await p.click('#naAuswListe .sheet-act:has-text("Aufbereitungs-Zyklus")');
  r.check('danach die Frage „Gilt für …" mit drei Stufen', (await blattOffen(p, /Gilt für/)) && (await p.locator('#naSheet.show .sheet-act').count()) === 3);
  await p.click('#naSheet.show .sheet-act:has-text("als Kern-Merkmal")');
  r.check('gilt jetzt für alle Kabel als Kern ★ — und steht in der Maske', await warte(p, () => naFelder(naKat(), 'kabel').diff.some(d => d.id === 'aufbereitung_zyklus') && !!document.querySelector('input[data-f="merkmale.aufbereitung_zyklus"]')));
  await p.fill('input[data-f="merkmale.aufbereitung_zyklus"]', '3 von 20');
  /* nur dieses Material */
  await p.click('[data-na="merkSuchen"]'); await p.fill('#naAuswQ', 'Herstellungsland'); await p.click('#naAuswListe .sheet-act:has-text("Herstellungsland")');
  await p.click('#naSheet.show .sheet-act:has-text("nur dieses Material")');
  r.check('„nur dieses Material": Feld erscheint unter „Nur bei diesem Material", die Kategorie bleibt unverändert', await warte(p, () => !!document.querySelector('input[data-f="merkmale.herkunftsland"]') && /Nur bei diesem Material/.test(document.getElementById('naMain').textContent) && !naFelder(naKat(), 'kabel').weitere.some(d => d.id === 'herkunftsland')));
  await p.fill('input[data-f="merkmale.herkunftsland"]', 'Costa Rica');
  /* ein ganz neues Merkmal */
  await p.click('[data-na="merkSuchen"]'); await p.fill('#naAuswQ', 'Steckerfarbe'); await p.click('#naAuswListe >> text=„Steckerfarbe" neu anlegen');
  await p.click('#naSheet.show .sheet-act:has-text("Text")'); await p.click('#naSheet.show [data-wert="weiter"]');
  const neuMid = await p.evaluate(() => (naKat().merkmale.find(d => d.label === 'Steckerfarbe') || {}).id);
  r.check('neues Merkmal angelegt und allen Kabeln zugeordnet', !!neuMid && await p.evaluate(mid => naFelder(naKat(), 'kabel').weitere.some(d => d.id === mid) && !!document.querySelector('input[data-f="merkmale.' + mid + '"]'), neuMid));
  await p.click('[data-na="entwSpeichern"]');
  await warte(p, () => location.hash === '#/material');
  const kabelId = await p.evaluate(() => naAlle('material').find(m => /Inquiry/.test(m.name)).id);
  await p.evaluate(id => naGeh('#/material/' + id), kabelId);
  r.check('nach dem Speichern: der Einzelwert bleibt sichtbar, die Kategorie-Merkmale auch', await warte(p, () => !!document.querySelector('input[data-f="merkmale.herkunftsland"]') && document.querySelector('input[data-f="merkmale.aufbereitung_zyklus"]').value === '3 von 20'));
  await p.click('[data-na="entwAbbrechen"]');
  /* Überblick im Listen-Verzeichnis: dieselben Daten */
  await p.evaluate(() => naGeh('#/liste/kategorien'));
  await p.click('.na-eintrag:has-text("Kabel / Verbindung")'); await p.click('#naSheet.show .sheet-act:has-text("Merkmale dieser Kategorie")');
  r.check('Listen-Verzeichnis zeigt die Merkmale der Kategorie mit Kern ★ und Nutzung', await warte(p, () => /Kern ★/.test(document.getElementById('naMain').textContent) && /Aufbereitungs-Zyklus/.test(document.getElementById('naMain').textContent) && /1 von 1/.test(document.getElementById('naMain').textContent)));
  await p.click('.na-eintrag:has-text("Aufbereitungs-Zyklus")'); await p.click('#naSheet.show .sheet-act:has-text("Kein Kern-Merkmal mehr")');
  r.check('… und dort zurückstufen', await warte(p, () => !naFelder(naKat(), 'kabel').diff.some(d => d.id === 'aufbereitung_zyklus') && naFelder(naKat(), 'kabel').weitere.some(d => d.id === 'aufbereitung_zyklus')));
  await p.click('.na-eintrag:has-text("Aufbereitungs-Zyklus")'); await p.click('#naSheet.show .sheet-act:has-text("Suchwörter ändern")');
  await p.fill('#naEingabeFeld', 'zyklus, resterilisation, autoklav'); await p.click('#naSheet.show [data-na="eingabeOk"]');
  r.check('eigene Suchwörter für ein Merkmal', await warte(p, () => (naKat().merkmale.find(d => d.id === 'aufbereitung_zyklus').such || []).indexOf('autoklav') >= 0));
  /* Neue Kategorie mit den Merkmalen einer anderen */
  await p.evaluate(() => naGeh('#/liste/kategorien'));
  await p.click('[data-na="listeNeu"]'); await p.fill('#naEingabeFeld', 'EPU-Kabel'); await p.click('#naSheet.show [data-na="eingabeOk"]');
  await p.fill('#naAuswQ', 'Kabel'); await p.click('#naAuswListe .sheet-act:has-text("Kabel / Verbindung")');
  r.check('„EPU-Kabel" beginnt mit den Merkmalen von „Kabel" (eine Kopie)', await warte(p, () => { const k = naKat().klassen.find(x => x.label === 'EPU-Kabel'); if (!k) return false;
    const a = naFelder(naKat(), k.id), b = naFelder(naKat(), 'kabel'); return a.diff.length === b.diff.length && a.weitere.length === b.weitere.length && /\/liste\/kategorien\//.test(location.hash); }));

  /* ── 12f. Merkmale im Listen-Verzeichnis: alle sehen, suchen, ändern (13.11.2026) ── */
  const eingabe = async t => { await p.fill('#naEingabeFeld', t); await p.click('#naSheet.show [data-na="eingabeOk"]'); };
  const merkmal = id => p.evaluate(i => { const d = naKat().merkmale.find(x => x.id === i); return d ? JSON.parse(JSON.stringify(d)) : null; }, id);
  const seite = async id => { await p.evaluate(i => naGeh('#/liste/merkmale/' + encodeURIComponent(i)), id); await p.waitForTimeout(150); };
  await p.evaluate(() => naGeh('#/listen'));
  r.check('Listen-Verzeichnis: Zeile „Merkmale (Material)" mit Anzahl, gleich unter den Kategorien', await warte(p, () => { const z = Array.from(document.querySelectorAll('#naMain .na-eintrag')); const i = z.findIndex(x => /Material-Kategorien/.test(x.textContent));
    return i >= 0 && z[i + 1] && /Merkmale \(Material\)/.test(z[i + 1].textContent) && /\d{2,3} Merkmale/.test(z[i + 1].textContent); }));
  await p.click('[data-ziel="#/liste/merkmale"]');
  const anzahl = await p.evaluate(() => naKat().merkmale.filter(d => !d.archiviert).length);
  r.check('Liste zeigt alle Merkmale (' + anzahl + ') mit Art und Kategorien', anzahl >= 100 && (await p.locator('#naMlListe .na-eintrag').count()) === anzahl
    && /Maß \(F\)[\s\S]*★ Diagnostikkatheter/.test(await p.textContent('#naMlListe .na-eintrag[data-ziel="#/liste/merkmale/ad_fr"]')));
  await p.fill('#naMlQ', 'resteril');
  r.check('Suche findet über Suchwörter („resteril" → Zulässige Wiederverwendungen)', await warte(p, () => { const n = Array.from(document.querySelectorAll('#naMlListe .na-name')).map(x => x.textContent);
    return n.length > 0 && n.length < 10 && n.some(t => /Zulässige Wiederverwendungen/.test(t)); }));
  await p.fill('#naMlQ', 'kurven'); await p.click('#naMlListe .na-eintrag[data-ziel="#/liste/merkmale/kurve_groesse"]');
  r.check('Seite des Merkmals: Angaben, Auswahlwerte, Kategorien, Etikett-Erkennung', await warte(p, () => { const t = document.getElementById('naMain').textContent;
    return /Mitgeliefertes Merkmal/.test(t) && /Auswahlwerte \(6\)/.test(t) && /Kategorien \(2\)/.test(t) && /Etikett-Erkennung/.test(t) && /fest — die Etikett-Erkennung/.test(t); }));
  await foto(p, '13-merkmal');
  /* Name ändern → wirkt in der Maske; unter dem alten Namen weiter zu finden; Vorgabe zurückholen */
  await p.click('[data-na="mmName"]'); await eingabe('Krümmung');
  r.check('umbenannt: Katalog trägt den neuen Namen, die Vorgabe bleibt bekannt', await warte(p, () => { const d = naKat().merkmale.find(x => x.id === 'kurve_groesse'); return d.label === 'Krümmung' && d.vorgabeLabel === 'Kurvengröße' && /Vorgabe: Kurvengröße/.test(document.getElementById('naMain').textContent); }));
  await p.click('[data-na="mmHinweis"]'); await eingabe('wie auf dem Etikett');
  await p.click('[data-na="mmWertNeu"]'); await eingabe('XXL');
  await p.click('[data-na="mmWert"][data-w="SMALL"]'); await p.click('#naSheet.show [data-wert="weg"]');
  r.check('Hinweis, neuer Wert, ausgeblendeter Wert der Vorgabe', await warte(p, () => { const d = naKat().merkmale.find(x => x.id === 'kurve_groesse');
    return d.hinweis === 'wie auf dem Etikett' && d.werte.indexOf('XXL') >= 0 && d.werte.indexOf('SMALL') < 0 && /wird nicht mehr angeboten/.test(document.getElementById('naMain').textContent); }));
  /* Kategorie zuordnen — von der Seite des Merkmals aus */
  await p.click('[data-na="mmKatDazu"]'); await p.fill('#naAuswQ', 'Kabel'); await p.click('#naAuswListe .sheet-act:has-text("Kabel / Verbindung")');
  await p.click('#naSheet.show [data-wert="weiter"]');
  r.check('Kategorie zugeordnet: „Kabel" führt das Merkmal jetzt', await warte(p, () => naFelder(naKat(), 'kabel').weitere.some(d => d.id === 'kurve_groesse') && /Kategorien \(3\)/.test(document.getElementById('naMain').textContent)));
  /* … und in der Maske eines Kabels: neuer Name, Hinweis, Werte */
  const probeKabel = await p.evaluate(() => naSpeichern('material', Object.assign(naStammLeer('material'), { name: 'Probe-Kabel', kategorie: 'kabel', merkmale: { kurve_groesse: 'LARGE' } })).id);
  await p.evaluate(i => naGeh('#/material/' + i), probeKabel);
  await warte(p, () => !!NA_ENTWURF && NA_ENTWURF.obj.name === 'Probe-Kabel');
  await p.evaluate(() => { NA_ENTWURF.offen.kat = true; NA_ENTWURF.offen.weit = true; naFormNeu(); });
  r.check('Maske: Feld heißt „Krümmung", zeigt den Hinweis', await warte(p, () => { const b = document.querySelector('[data-na="merkWahl"][data-mid="kurve_groesse"]'); const f = b && b.closest('.na-feld');
    return !!f && /Krümmung/.test(f.textContent) && /wie auf dem Etikett/.test(f.textContent) && !/Kurvengröße/.test(f.textContent); }));
  await p.click('[data-na="merkWahl"][data-mid="kurve_groesse"]');
  const angeboten = await p.$$eval('#naAuswListe .sheet-act', l => l.map(b => b.textContent.trim()));
  r.check('Maske: Auswahl bietet XXL an, SMALL nicht mehr', angeboten.some(t => /XXL/.test(t)) && !angeboten.some(t => /^.?\s*SMALL/.test(t)) && angeboten.some(t => /MEDIUM/.test(t)));
  await p.click('#naSheet.show [data-na="sheetZu"]').catch(() => {}); await p.keyboard.press('Escape').catch(() => {});
  await p.evaluate(() => { if (document.getElementById('naSheet').classList.contains('show')) naSheetZu(null); });
  await p.click('[data-na="entwAbbrechen"]'); if (await p.isVisible('#naSheet.show button:has-text("Verwerfen")')) await p.click('#naSheet.show button:has-text("Verwerfen")');
  /* Wert umbenennen: ändert auch das Material, bei dem er eingetragen ist */
  await seite('kurve_groesse');
  await p.click('[data-na="mmWert"][data-w="LARGE"]');
  r.check('Blatt des Werts sagt, bei wie vielen Materialien er steht', /1×/.test(await p.textContent('#naSheet.show')));
  await p.click('#naSheet.show [data-wert="um"]'); await eingabe('GROSS');
  r.check('Wert umbenannt — auch beim Material', await warte(p, i => naHole('material', i).merkmale.kurve_groesse === 'GROSS' && naKat().merkmale.find(x => x.id === 'kurve_groesse').werte.indexOf('GROSS') >= 0
    && naKat().merkmale.find(x => x.id === 'kurve_groesse').werte.indexOf('LARGE') < 0, probeKabel));
  /* Archivieren: weg aus Maske und Suche, der Wert am Material bleibt sichtbar; zurückholen */
  await p.click('[data-na="mmArchiv"]'); await p.click('#naSheet.show button:has-text("Archivieren")');
  r.check('archiviert: nicht mehr in der Kategorie, nicht mehr in der Merkmal-Suche — der Wert am Material bleibt', await warte(p, i => { const kat = naKat(); const f = naFelder(kat, 'kabel');
    return !f.diff.concat(f.weitere).some(d => d.id === 'kurve_groesse') && !naMerkmalItems(kat, 'kabel').some(x => x.id === 'kurve_groesse')
      && naFelderMaterial(kat, naHole('material', i)).einzel.some(d => d.id === 'kurve_groesse') && /Archiviert\./.test(document.getElementById('naMain').textContent); }, probeKabel));
  await p.evaluate(() => naGeh('#/liste/merkmale')); await p.fill('#naMlQ', '');
  r.check('Liste: Filter „archiviert (1)" erscheint', await warte(p, () => /archiviert \(1\)/.test(document.querySelector('#naMain .na-chips').textContent) && /geändert \(\d+\)/.test(document.querySelector('#naMain .na-chips').textContent)));
  await p.click('[data-na="mlFilter"][data-f="archiv"]'); await p.click('#naMlListe .na-eintrag:has-text("Krümmung")');
  await p.click('[data-na="mmArchiv"]');
  r.check('zurückgeholt: wieder in der Kategorie', await warte(p, () => naFelder(naKat(), 'kabel').weitere.some(d => d.id === 'kurve_groesse')));
  /* Vorgabe zurückholen: Name, Hinweis, Werte wie geliefert — die Kategorie bleibt */
  await p.click('[data-na="mmVorgabe"]');
  r.check('Rückfrage nennt, was verworfen wird', /Name, Hinweis, Werte/.test(await p.textContent('#naSheet.show')));
  await p.click('#naSheet.show button:has-text("Zurückholen")');
  const zurueck = await merkmal('kurve_groesse');
  r.check('Vorgabe zurück: Name, Hinweis, Werte wie geliefert — die Zuordnung zu „Kabel" bleibt', zurueck.label === 'Kurvengröße' && !zurueck.hinweis && zurueck.werte.indexOf('SMALL') >= 0 && zurueck.werte.indexOf('XXL') < 0
    && zurueck.klassen.indexOf('kabel') >= 0 && !(await p.isVisible('[data-na="mmVorgabe"]')));
  /* Neues Merkmal aus der Liste: Auswahl; danach Art, Einheit, Löschen */
  await p.evaluate(() => naGeh('#/liste/merkmale'));
  await p.click('[data-na="mlNeu"]'); await eingabe('Steckerfarbe');
  r.check('Doppelung: „Steckerfarbe" gibt es schon (aus Schritt 12d) — die App fragt nach, statt still doppelt anzulegen', await blattOffen(p, /Ähnlich: „Steckerfarbe"/));
  await p.click('#naSheet.show [data-na="sheetZu"]');
  await p.click('[data-na="mlNeu"]'); await eingabe('Zugentlastung');
  r.check('Neues Merkmal: vier Arten zur Wahl, darunter „Auswahl"', (await blattOffen(p, /Neues Merkmal/)) && (await p.locator('#naSheet.show .sheet-act').count()) === 4);
  await p.click('#naSheet.show [data-wert="liste"]');
  r.check('angelegt und gleich auf seiner Seite: eigenes Merkmal, noch ohne Kategorie', await warte(p, () => /^#\/liste\/merkmale\/m_/.test(location.hash) && /Eigenes Merkmal des Hauses/.test(document.getElementById('naMain').textContent)
    && /Noch keiner Kategorie zugeordnet/.test(document.getElementById('naMain').textContent) && !!document.querySelector('[data-na="mmLoeschen"]')));
  const eigenId = await p.evaluate(() => decodeURIComponent(location.hash.split('/').pop()));
  await p.click('[data-na="mmArt"]'); await p.click('#naSheet.show [data-wert="zahl"]');
  await warte(p, () => !!document.querySelector('[data-na="mmEinheit"]'));
  await p.click('[data-na="mmEinheit"]'); await eingabe('cm');
  r.check('eigenes Merkmal: Art und Einheit änderbar', await warte(p, i => { const d = naKat().merkmale.find(x => x.id === i); return !!d && d.typ === 'zahl' && d.einheit === 'cm'; }, eigenId));
  await p.click('[data-na="mmLoeschen"]'); await p.click('#naSheet.show button:has-text("Löschen")');
  r.check('gelöscht (unbenutzt): weg aus dem Katalog, zurück in der Liste', await warte(p, i => !naKat().merkmale.some(x => x.id === i) && location.hash === '#/liste/merkmale', eigenId));
  /* Querverweis aus der Kategorie */
  await p.evaluate(() => naGeh('#/liste/kategorien/kabel'));
  await p.click('#naMain .na-eintrag[data-na="katMerkmal"][data-mid="kurve_groesse"]'); await p.click('#naSheet.show .sheet-act:has-text("Merkmal ansehen und ändern")');
  r.check('aus der Kategorie führt ein Tipp zur Seite des Merkmals', await warte(p, () => location.hash === '#/liste/merkmale/kurve_groesse' && !document.getElementById('naSheet').classList.contains('show')));
  /* aufräumen: die Probe-Zuordnung und das Probe-Material wieder weg */
  await p.evaluate(i => { naMerkmalKategorieSetzen('kabel', 'kurve_groesse', 'aus'); naLoeschen('material', i); }, probeKabel);

  /* ── 12e. Störung der EU-Schnittstelle (13.11.2026): Sie meldet für JEDES Produkt „nicht gefunden" ── */
  lage.stoerung = true;
  await p.evaluate(() => naGeh('#/material/neu'));
  await p.fill('input[data-f="gtin"]', G(E_STOER)); await p.click('[data-na="registerHolen"]');
  r.check('Störung: „antwortet gerade nicht", NICHT „steht dazu nichts" — nichts wird erfunden', await warte(p, () => { const t = document.getElementById('naOcrStand').textContent;
    return /antwortet gerade nicht[\s\S]*fragt von selbst weiter/.test(t) && !/steht dazu nichts/.test(t); }, null, 15000) && !(await entwurf()).register);
  await p.click('[data-na="entwAbbrechen"]'); await p.click('#naSheet.show button:has-text("Verwerfen")');
  await p.evaluate(() => naGeh('#/einstellungen'));
  r.check('Einstellungen zeigen: EUDAMED gestört, mit Grund; offene Abfragen holt der Server nach', await warte(p, () => { const n = document.getElementById('naRegStand'); const t = n ? n.textContent : '';
    return /EUDAMED \(EU\) ist gestört/.test(t) && /nicht gefunden.*auch für Produkte/.test(t) && /Abfragen? offen/.test(t) && /fragt von selbst weiter/.test(t); }, null, 10000));
  await foto(p, '12-register-gestoert');
  lage.stoerung = false;
  await p.click('[data-na="registerPruefen"]');
  r.check('„Jetzt prüfen": EUDAMED antwortet wieder', await warte(p, () => /✓ EUDAMED \(EU\) antwortet/.test(document.getElementById('naRegStand').textContent), null, 20000));
  /* Das Register ist zurück → der Server fragt von selbst nach, was liegen blieb. */
  let nachgeholt = false;
  for (let i = 0; i < 80 && !nachgeholt; i++) { nachgeholt = (await json(srv.base, '/api/register/zustand')).offen === 0; if (!nachgeholt) await new Promise(ok => setTimeout(ok, 500)); }
  const vorS = zaehler.eudamed + zaehler.gudid;
  const st = await json(srv.base, '/api/register?gtin=' + G(E_STOER));
  r.check('der Server hat von selbst nachgefragt: Der Treffer liegt bereit, ohne neue Anfrage', nachgeholt && st.ausCache === true && !!st.treffer && st.treffer.ref === '4606051V' && zaehler.eudamed + zaehler.gudid === vorS);
  await foto(p, '12-register-wieder-da');

  /* ── 13. Register abschaltbar (Einstellungen, für alle Geräte) ── */
  await p.evaluate(() => naGeh('#/einstellungen'));
  await p.uncheck('input[data-na-wechsel="registerAn"]');
  r.check('Einstellung gespeichert', await p.evaluate(() => naEinstellung('register', true) === false));
  const vor = zaehler.eudamed + zaehler.gudid;
  await p.evaluate(() => naGeh('#/material/neu'));
  await kamera(eanBits(E_FREMD)); await p.click('[data-na="scan"]');
  r.check('abgeschaltet: GTIN wird übernommen, das Register nicht gefragt', (await warte(p, g => NA_ENTWURF && NA_ENTWURF.obj.gtin === g && /abgeschaltet/.test(document.getElementById('naOcrStand').textContent), G(E_FREMD), 20000)) && zaehler.eudamed + zaehler.gudid === vor);
  await p.click('[data-na="entwAbbrechen"]'); await p.click('#naSheet.show button:has-text("Verwerfen")');

  /* ── 14. Abgleich und die wichtigste Zusage ── */
  await warte(p, () => naAbgleich.offen() === 0, null, 10000);
  const neu = (await json(srv.base, '/api/state?raum=neuaufbau')).state;
  r.check('Server (Neuaufbau): Material, Lagerorte, Hersteller mit Registriernummer, Einstellung', !!neu['na_m_' + ids.hahn] && neu.na_l_lagerorte.eintraege.length === 1 && neu.na_l_hersteller.eintraege[0].srn === 'DE-MF-000000201' && neu.na_l_einstellungen.werte.register === false);
  r.check('Server (Bestand): Byte für Byte unverändert', JSON.stringify((await json(srv.base, '/api/state')).state) === bestandVorher);
  const fehler = errs.filter(x => !/favicon|ERR_ABORTED|Failed to load resource/.test(x));
  r.check('keine Fehler in der Konsole' + (fehler.length ? ': ' + fehler.slice(0, 3).join(' | ') : ''), fehler.length === 0);
  attrappe.close();
  await r.finish(browser, [srv]);
})().catch(e => { console.error(e); process.exit(1); });
