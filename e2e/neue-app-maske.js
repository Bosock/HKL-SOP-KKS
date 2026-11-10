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
};
async function json(base, p) { return (await fetch(base + p, { cache: 'no-store' })).json(); }
async function warte(page, fn, arg, ms) { try { await page.waitForFunction(fn, arg, { timeout: ms || 8000 }); return true; } catch (e) { return false; } }
const BILDER = process.env.MASKE_BILDER || '';
async function foto(page, name) { if (BILDER) await page.screenshot({ path: path.join(BILDER, name + '.png'), fullPage: true }); }
const blattOffen = (p, re) => warte(p, r => { const s = document.getElementById('naSheet'); return s.classList.contains('show') && new RegExp(r).test(s.textContent); }, re.source);

(async () => {
  const r = reporter('neue-app-maske');
  const zaehler = { eudamed: 0, gudid: 0 };
  const attrappe = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'); const antwort = (c, o) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.pathname === '/eudamed') { zaehler.eudamed++; const g = u.searchParams.get('PRIMARY_DI');
      if (g === G(E_AUSFALL)) return antwort(500, { message: 'Internal server error' });
      return antwort(200, { value: EUDAMED[g] ? [EUDAMED[g]] : [] }); }
    if (u.pathname === '/gudid') { zaehler.gudid++; if (u.searchParams.get('di') === G(E_AUSFALL)) return antwort(500, {}); return antwort(404, { error: 'No device found' }); }
    antwort(404, {});
  });
  await new Promise(ok => attrappe.listen(0, '127.0.0.1', ok));
  const reg = 'http://127.0.0.1:' + attrappe.address().port;
  const srv = await startServer({ REGISTER_EUDAMED_URL: reg + '/eudamed', REGISTER_GUDID_URL: reg + '/gudid' });
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
  r.check('Register nicht erreichbar: gesagt, GTIN bleibt', await warte(p, () => /nicht erreichbar/.test(document.getElementById('naOcrStand').textContent)) && (await entwurf()).gtin === G(E_AUSFALL));

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
