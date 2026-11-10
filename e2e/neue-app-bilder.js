/* NEUE APP — BILDER am Stammsatz (public/neu, docs/NEUE-APP.md).

   Festgelegt war (alte App): Bilder lassen sich zuschneiden und drehen, eines
   ist das Bild, das in Listen und Standards erscheint, und Antippen macht
   groß. Geprüft wird das am echten Bedienweg — Datei wählen, Editor bedienen,
   Kachel antippen — und am Ergebnis: Maße des abgelegten Bildes, Eintrag im
   Stammsatz, Bild an der Zeile im Standard.

   NEU_BILDER=<ordner> legt Bildschirmfotos dort ab. */
'use strict';
const path = require('path');
const { launchBrowser, startServer, reporter } = require('./util');
const { ETIKETTEN, rendernImBrowser } = require('./ocr-etiketten');

const BILDER = process.env.NEU_BILDER || '';
async function foto(page, name) { if (BILDER) await page.screenshot({ path: path.join(BILDER, name + '.png') }); }
async function warte(page, fn, arg, ms) { try { await page.waitForFunction(fn, arg, { timeout: ms || 8000 }); return true; } catch (e) { return false; } }
/* Ein Testbild als Datei: links rot, rechts blau (damit Drehen nachweisbar ist). */
async function bildDatei(page, w, h, name) {
  const b64 = await page.evaluate(([w, h]) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    x.fillStyle = '#d22'; x.fillRect(0, 0, w / 2, h); x.fillStyle = '#22d'; x.fillRect(w / 2, 0, w / 2, h); return c.toDataURL('image/png').split(',')[1]; }, [w, h]);
  return { name: name || 'bild.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') };
}
async function masse(page, src) { return page.evaluate(s => new Promise(res => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.onerror = () => res(null); i.src = s; }), src); }
async function waehle(page, knopf, dateien) { const fc = page.waitForEvent('filechooser'); await page.click(knopf); await (await fc).setFiles(dateien); }
const entwurf = page => page.evaluate(() => ({ fotos: naFotos(NA_ENTWURF.obj), haupt: (naHauptbild(NA_ENTWURF.obj) || {}).k || '', gewaehlt: NA_ENTWURF.obj.hauptbild || '' }));
const marke = page => page.evaluate(() => { const l = [...document.querySelectorAll('.na-foto')]; return l.findIndex(e => e.classList.contains('haupt')); });

(async () => {
  const r = reporter('neue-app-bilder');
  const srv = await startServer();
  const browser = await launchBrowser();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
  p.on('dialog', d => { errs.push('NATIVER DIALOG: ' + d.message()); d.dismiss(); });
  await p.goto(srv.base + '/', { waitUntil: 'networkidle' });
  await p.evaluate(() => { localStorage.setItem('hkl_raumwahl', 'neuaufbau'); localStorage.setItem('raum:neuaufbau:hkl_authuntil', String(Date.now() + 3600000)); });
  await p.goto(srv.base + '/neu/#/material/neu', { waitUntil: 'networkidle' });
  await p.click('button[data-f="kategorie"]'); await p.fill('#naAuswQ', 'Schleuse'); await p.click('#naAuswListe .sheet-act:has-text("Schleuse / Introducer")');
  await p.fill('input[data-f="name"]', 'Schleuse 6F');

  /* ── 1. Aufnehmen → Editor öffnet sofort → drehen → übernehmen ── */
  await waehle(p, '[data-na="fotoAuf"]', await bildDatei(p, 400, 300));
  r.check('nach der Aufnahme öffnet der Editor (zuschneiden/drehen)', await warte(p, () => !!document.getElementById('photoEditOv')));
  await p.click('#peRot'); await p.click('#peApply');
  r.check('Bild erscheint als Kachel', await warte(p, () => document.querySelectorAll('.na-foto').length === 1));
  let e = await entwurf(p);
  const m1 = await masse(p, await p.evaluate(k => naBildSrc({ k }), e.fotos[0].k));
  r.check('gedreht und auf den Rahmen zugeschnitten (400×300 → ' + (m1 || []).join('×') + ')', m1 && m1[0] === 276 && m1[1] === 368);
  r.check('Vorschau klein abgelegt, Rolle „Produkt"', !!e.fotos[0].v && e.fotos[0].v !== e.fotos[0].k && e.fotos[0].rolle === 'produkt');
  const mv = await masse(p, await p.evaluate(k => naBildUrl(k), e.fotos[0].v));
  r.check('Vorschau höchstens 320 Pixel (' + (mv || []).join('×') + ')', mv && Math.max(mv[0], mv[1]) <= 320);
  r.check('das einzige Bild ist das Anzeigebild', await marke(p) === 0 && /Anzeigebild/.test(await p.textContent('.na-foto.haupt')));

  /* Abbrechen im Editor: kein Bild kommt hinzu. */
  await waehle(p, '[data-na="fotoAuf"]', await bildDatei(p, 200, 200));
  await warte(p, () => !!document.getElementById('photoEditOv')); await p.click('#peCancel');
  await p.waitForTimeout(300);
  r.check('Abbrechen im Editor fügt nichts hinzu', (await entwurf(p)).fotos.length === 1);

  /* ── 2. Aus den Fotos wählen (ein Bild → Editor, ganzes Bild) ── */
  await waehle(p, '[data-na="fotoWahl"]', await bildDatei(p, 300, 300));
  await warte(p, () => !!document.getElementById('photoEditOv')); await p.click('#peReset'); await p.click('#peApply');
  r.check('zweites Bild da', await warte(p, () => document.querySelectorAll('.na-foto').length === 2));
  e = await entwurf(p);
  const m2 = await masse(p, await p.evaluate(k => naBildSrc({ k }), e.fotos[1].k));
  r.check('„Ganzes Bild" lässt die Maße (300×300)', m2 && m2[0] === 300 && m2[1] === 300);

  /* ── 3. Anzeigebild: Regel und Wahl ── */
  await p.click('.na-foto >> nth=0');
  r.check('Antippen öffnet das Bild-Blatt in der Maske (kein eigenes Menü)', await p.isVisible('#naSheet.show .na-foto-gross') && new URL(p.url()).hash === '#/material/neu');
  await p.click('#naSheet [data-na="fotoRolle"][data-r="etikett"]');
  r.check('ein Etikettfoto wird nicht von allein Anzeigebild → das Produktbild rückt vor', await marke(p) === 1);
  await p.click('#naSheet [data-na="fotoHaupt"]');
  r.check('★ wählt ausdrücklich — auch ein Etikett', await marke(p) === 0 && (await entwurf(p)).gewaehlt === e.fotos[0].k);
  await p.click('#naSheet >> text=Fertig');
  await p.click('.na-foto >> nth=1'); await p.click('#naSheet [data-na="fotoHaupt"]');
  await p.fill('#naSheet [data-na-ein="fotoTitel"]', 'Ansicht von oben');
  await p.click('#naSheet >> text=Fertig');
  r.check('Wahl wechselt auf das zweite Bild', await marke(p) === 1);
  await foto(p, 'bilder-maske');

  /* ── 4. Mehrere auf einmal: ohne Editor ── */
  await waehle(p, '[data-na="fotoWahl"]', [await bildDatei(p, 120, 80, 'a.png'), await bildDatei(p, 80, 120, 'b.png')]);
  r.check('zwei Bilder auf einmal kommen ohne Editor hinzu', await warte(p, () => document.querySelectorAll('.na-foto').length === 4) && !(await p.isVisible('#photoEditOv')));

  /* ── 5. Entfernen (mit Rückfrage) ── */
  await p.click('.na-foto >> nth=3'); await p.click('#naSheet [data-na="fotoWeg"]'); await p.click('#naSheet button:has-text("Entfernen")');
  r.check('Bild entfernt', await warte(p, () => document.querySelectorAll('.na-foto').length === 3));

  /* ── 6. Speichern: Stammsatz, Liste, Server ── */
  e = await entwurf(p);
  await p.click('[data-na="entwSpeichern"]');
  r.check('gespeichert', await warte(p, () => location.hash === '#/material' && naAlle('material').length === 1));
  const mat = await p.evaluate(() => naAlle('material')[0]);
  r.check('Stammsatz: 3 Bilder, Anzeigebild, Unterschrift, Rollen', mat.fotos.length === 3 && mat.hauptbild === e.fotos[1].k && mat.fotos[1].titel === 'Ansicht von oben' && mat.fotos[0].rolle === 'etikett');
  r.check('Liste zeigt die VORSCHAU des Anzeigebilds', await p.evaluate(v => (document.querySelector('.na-eintrag img.na-bild') || {}).src.indexOf(v) >= 0, mat.fotos[1].v));
  await warte(p, () => naAbgleich.offen() === 0, null, 10000);
  const srvMat = (await (await fetch(srv.base + '/api/state?raum=neuaufbau')).json()).state['na_m_' + mat.id];
  r.check('Server kennt Bilder und Anzeigebild', srvMat && srvMat.hauptbild === mat.hauptbild && srvMat.fotos.length === 3);

  /* ── 7. Vorhandenes Bild zuschneiden, Hinweis „nicht gespeichert", Original zurück ── */
  await p.click('.na-eintrag'); await p.click('.na-foto >> nth=1');
  await p.click('#naSheet [data-na="fotoSchnitt"]');
  await warte(p, () => !!document.getElementById('photoEditOv')); await p.click('#peRot'); await p.click('#peApply');
  r.check('bearbeitetes Bild ersetzt das alte, bleibt Anzeigebild', await warte(p, k => { const o = NA_ENTWURF && NA_ENTWURF.obj; return o && o.hauptbild && o.hauptbild !== k && naFotos(o)[1].orig === k; }, mat.hauptbild));
  r.check('Maske sagt: Bildänderungen noch nicht gespeichert', /noch nicht gespeichert/.test(await p.textContent('#naMain')));
  r.check('Blatt bietet „Original wiederherstellen"', await p.isVisible('#naSheet [data-na="fotoOriginal"]'));
  await p.click('#naSheet [data-na="fotoOriginal"]');
  r.check('Original zurück: Kennung und Anzeigebild wie vorher', await p.evaluate(k => NA_ENTWURF.obj.hauptbild === k && naFotos(NA_ENTWURF.obj)[1].k === k && !naFotos(NA_ENTWURF.obj)[1].orig, mat.hauptbild));
  await p.click('#naSheet >> text=Fertig');
  r.check('… und der Hinweis ist wieder weg', !/noch nicht gespeichert/.test(await p.textContent('#naMain')));
  await p.click('[data-na="entwAbbrechen"]');

  /* ── 8. Im Standard: Anzeigebild an der Zeile, Antippen macht groß ── */
  const sid = await p.evaluate(mid => { const s = naStandardNeu('PCI', '', ['Materialien']);
    s.rubriken[0].abschnitte[0].positionen.push({ id: naId('p'), art: 'material', ref: { typ: 'material', id: mid }, menge: '1x' });
    naSpeichern('standard', s); naGeh('#/s/' + s.id); return s.id; }, mat.id);
  const zeile = await p.evaluate(() => { const i = document.querySelector('.na-pos img.na-pbild'); return i ? { src: i.getAttribute('src'), gross: i.getAttribute('data-gross') } : null; });
  r.check('Zeile im Standard zeigt die Vorschau des Anzeigebilds', zeile && zeile.src.indexOf(mat.fotos[1].v) >= 0 && zeile.gross.indexOf(mat.hauptbild) >= 0);
  await p.click('.na-pos img.na-pbild');
  r.check('Antippen öffnet die Großansicht mit dem GROSSEN Bild', await p.evaluate(k => { const l = document.getElementById('lightbox'); return !!l && l.classList.contains('show') && document.getElementById('lbImg').src.indexOf(k) >= 0; }, mat.hauptbild));
  await foto(p, 'bilder-standard-gross');
  await p.click('#lightbox .lb-close');
  r.check('Großansicht schließt, der Standard bleibt', await p.evaluate(id => !document.getElementById('lightbox').classList.contains('show') && location.hash === '#/s/' + id, sid));
  await foto(p, 'bilder-standard');
  await p.evaluate(id => naGeh('#/s/' + id + '/ruest'), sid);
  r.check('Rüstliste zeigt das Bild ebenfalls', await p.locator('.na-pos img.na-pbild').count() === 1);
  await p.evaluate(id => naGeh('#/s/' + id + '/bearbeiten'), sid);
  r.check('Editor zeigt das Bild; es stört das Ziehen nicht (draggable=false)', await p.evaluate(() => { const i = document.querySelector('.na-pos img.na-pbild'); return !!i && i.getAttribute('draggable') === 'false'; }));

  /* ── 9. Anwender: Bilder ansehen, Anzeigebild zuerst ── */
  await p.evaluate(mid => { naAbmelden(); naGeh('#/material/' + mid); }, mat.id);
  const reihe = await p.evaluate(() => [...document.querySelectorAll('#naMain .na-fotos img')].map(i => i.getAttribute('data-gross')));
  r.check('Anwender-Ansicht: Anzeigebild steht vorn, keine Bearbeitung', reihe.length === 3 && reihe[0].indexOf(mat.hauptbild) >= 0 && !(await p.isVisible('[data-na="fotoAuf"]')));

  /* ── 10. Ältere Einträge (bloße Kennungen) bleiben lesbar und werden beim Wählen umgestellt ── */
  await p.evaluate(m => { store.set('hkl_authuntil', String(Date.now() + 3600000));
    naSpeichern('material', { id: 'alt1', name: 'Alt-Eintrag', kategorie: 'schleuse', gtin: '', ref: '', hersteller: '', merkmale: {}, fotos: [m.fotos[0].k, m.fotos[2].k] }); naGeh('#/material/alt1'); }, mat);
  r.check('alter Eintrag: zwei Kacheln, die erste ist Anzeigebild', await p.locator('.na-foto').count() === 2 && await marke(p) === 0);
  await p.click('.na-foto >> nth=1'); await p.click('#naSheet [data-na="fotoHaupt"]'); await p.click('#naSheet >> text=Fertig'); await p.click('[data-na="entwSpeichern"]');
  r.check('… nach der Wahl gespeichert in der neuen Form', await warte(p, k => { const o = naHole('material', 'alt1'); return o && o.hauptbild === k && typeof o.fotos[0] === 'object'; }, mat.fotos[2].k));

  /* ── 11. Etikett lesen: das Etikettfoto wird Bild mit Rolle „Etikett", nicht Anzeigebild ── */
  await p.evaluate(mid => naGeh('#/material/' + mid), mat.id);
  const spec = ETIKETTEN.find(x => x.id === 'schleuse');
  const etikett = await p.evaluate(rendernImBrowser, { spec, stoerung: 'sauber', seed: 7 });
  const b64 = String(etikett.dataUrl || etikett).split(',')[1];
  await p.evaluate(() => { NA_ENTWURF.obj.ref = ''; });
  await waehle(p, '[data-na="etikett"]', { name: 'etikett.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') });
  const gelesen = await warte(p, () => NA_ENTWURF && naFotos(NA_ENTWURF.obj).length === 4, null, 120000);
  e = await entwurf(p);
  r.check('Etikett gelesen, Foto angehängt', gelesen);
  r.check('… mit Rolle „Etikett", Anzeigebild unverändert', gelesen && e.fotos[3].rolle === 'etikett' && e.haupt === mat.hauptbild);
  r.check('… und die REF vom Etikett steht im Feld (' + (await p.inputValue('input[data-f="ref"]')) + ')', (await p.inputValue('input[data-f="ref"]')) === spec.wahr.ref);

  const fehler = errs.filter(x => !/favicon|ERR_ABORTED|Failed to load resource/.test(x));
  r.check('keine Fehler in der Konsole' + (fehler.length ? ': ' + fehler.slice(0, 3).join(' | ') : ''), fehler.length === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error(e); process.exit(1); });
