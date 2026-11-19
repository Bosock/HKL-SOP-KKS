/* NEUE APP — Maßangaben umrechnen (kern.js naMassUmrechnung), im echten Browser.

   Eingetragen wird nur in der Einheit des Merkmals; darunter (live beim
   Tippen), in der Ansicht und in der Suche stehen die anderen Einheiten:
   Durchmesser mm · Zoll · French (Gauge als Außen-Ø), Länge mm auch in cm.
   Ballon-/Stentgrößen und cm-Längen bleiben ohne Umrechnung. Die Art der
   Umrechnung ist je Merkmal auf seiner Seite änderbar.
   Der BESTAND bleibt Byte für Byte unverändert. */
'use strict';
const { launchBrowser, startServer, reporter } = require('./util');
async function json(base, p) { return (await fetch(base + p, { cache: 'no-store' })).json(); }
async function warte(page, fn, arg, ms) { try { await page.waitForFunction(fn, arg, { timeout: ms || 8000 }); return true; } catch (e) { return false; } }

(async () => {
  const r = reporter('neue-app-masse');
  const srv = await startServer();
  const browser = await launchBrowser();
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
  p.on('dialog', d => { errs.push('NATIVER DIALOG: ' + d.message()); d.dismiss(); });
  await p.goto(srv.base + '/', { waitUntil: 'networkidle' });
  const bestandVorher = JSON.stringify((await json(srv.base, '/api/state')).state);
  await p.evaluate(() => { localStorage.setItem('hkl_raumwahl', 'neuaufbau'); localStorage.setItem('raum:neuaufbau:hkl_authuntil', String(Date.now() + 3600000)); });
  await p.goto(srv.base + '/neu/#/material/neu', { waitUntil: 'networkidle' });

  /* ── 1. Führungsdraht: Durchmesser in Zoll eingetragen ── */
  for (const k of ['gtin', 'hersteller', 'ref']) await p.click('[data-na="pflichtAusweg"][data-k="' + k + '"][data-a="nachtragen"]');
  await p.fill('input[data-f="name"]', 'Terumo Glidewire');
  await p.evaluate(() => { NA_ENTWURF.obj.kategorie = 'fuehrungsdraht'; NA_ENTWURF.katAuto = null; NA_ENTWURF.offen.kat = true; NA_ENTWURF.offen.weit = true; naFormNeu(); });
  await p.waitForSelector('input[data-f="merkmale.draht_in"]');
  r.check('Feld „Drahtdurchmesser" bleibt in Zoll (in) — ohne Umrechnung, solange leer', /\(in\)/.test(await p.textContent('.na-feld:has(input[data-f="merkmale.draht_in"]) label')) && (await p.textContent('#naUmr-draht_in')) === '');
  await p.fill('input[data-f="merkmale.draht_in"]', '0,035');
  r.check('beim Tippen: „= 0,89 mm · 2,7 F"', await warte(p, () => document.getElementById('naUmr-draht_in').textContent === '= 0,89 mm · 2,7 F'));
  await p.fill('input[data-f="merkmale.draht_in"]', '.038');
  r.check('… und sofort neu: „.038" → „= 0,97 mm · 2,9 F"', await warte(p, () => document.getElementById('naUmr-draht_in').textContent === '= 0,97 mm · 2,9 F'));
  await p.fill('input[data-f="merkmale.draht_in"]', '0,035');
  r.check('… der Wert selbst bleibt, wie getippt (nichts doppelt gespeichert)', await p.evaluate(() => JSON.stringify(NA_ENTWURF.obj.merkmale) === '{"draht_in":"0,035"}'));
  await p.fill('input[data-f="merkmale.draht_laenge_cm"]', '260');
  r.check('Länge in cm: keine Umrechnung (nur mm → cm)', !(await p.$('#naUmr-draht_laenge_cm')) || (await p.textContent('#naUmr-draht_laenge_cm')) === '');
  await p.click('[data-na="entwSpeichern"]');
  if (await warte(p, () => document.getElementById('naSheet').classList.contains('show') && /Vor dem Speichern/.test(document.getElementById('naSheet').textContent))) await p.click('#naSheet.show [data-wert="speichern"]');
  await warte(p, () => location.hash === '#/material');
  const draht = await p.evaluate(() => naAlle('material').find(m => m.name === 'Terumo Glidewire'));
  r.check('gespeichert: draht_in = „0,035" (in der Einheit des Merkmals)', draht && draht.merkmale.draht_in === '0,035' && draht.merkmale.draht_laenge_cm === '260');
  /* Ansicht (z. B. aus einem Standard) */
  const ansicht = await p.evaluate(id => { const d = document.createElement('div'); d.innerHTML = naStammAnsicht('material', naHole('material', id)); return d.textContent; }, draht.id);
  r.check('Ansicht: „0,035 in = 0,89 mm · 2,7 F", Länge „260 cm" ohne Zusatz', /Drahtdurchmesser:\s*0,035 in = 0,89 mm · 2,7 F/.test(ansicht) && /Drahtlänge:\s*260 cm(?! =)/.test(ansicht));
  /* Suche über die Umrechnung */
  await p.fill('#naVzQ', '2,7 F');
  r.check('Suche „2,7 F" findet den 0,035″-Draht', await warte(p, () => /Terumo Glidewire/.test(document.getElementById('naVzListe').textContent)));
  await p.fill('#naVzQ', '0,89 mm');
  r.check('Suche „0,89 mm" auch', await warte(p, () => /Terumo Glidewire/.test(document.getElementById('naVzListe').textContent)));
  await p.fill('#naVzQ', '');

  /* ── 2. Kanüle (Gauge), Schleuse (French), Nadellänge (mm), Ballon (mm, ohne) ── */
  const ids = await p.evaluate(() => {
    const leer = naStammLeer('material'); const pf = { gtin:'nachtragen', hersteller:'nachtragen', ref:'nachtragen' };
    const a = naSpeichern('material', Object.assign({}, leer, { id:naId('m'), name:'Punktionskanüle 18G', kategorie:'transseptal', merkmale:{ nadel_g:'18', nadel_laenge_mm:'70', id_mm:'1,1' }, pflicht:pf }));
    const b = naSpeichern('material', Object.assign({}, naStammLeer('material'), { id:naId('m'), name:'Radialschleuse', kategorie:'schleuse', merkmale:{ schleuse_fr:'6', draht_max_in:'.025' }, pflicht:pf }));
    const c = naSpeichern('material', Object.assign({}, naStammLeer('material'), { id:naId('m'), name:'NC-Ballon 3,0', kategorie:'ballon', merkmale:{ ballon_mm:'3,0', ballon_laenge_mm:'15' }, pflicht:pf }));
    return { a:a.id, b:b.id, c:c.id };
  });
  const text = id => p.evaluate(i => { const d = document.createElement('div'); d.innerHTML = naStammAnsicht('material', naHole('material', i)); return d.textContent; }, id);
  const ta = await text(ids.a), tb = await text(ids.b), tc = await text(ids.c);
  r.check('Kanüle: 18 G = 1,27 mm · 0,050″ · 3,8 F (Außen-Ø); Nadellänge 70 mm = 7 cm; Innen-Ø 1,1 mm = 0,043″ · 3,3 F',
    /18 G = 1,27 mm · 0,050″ · 3,8 F \(Außen-Ø\)/.test(ta) && /70 mm = 7 cm/.test(ta) && /1,1 mm = 0,043″ · 3,3 F/.test(ta));
  r.check('Schleuse: 6 F = 2 mm · 0,079″; max. Draht .025 in = 0,64 mm · 1,9 F', /6 F = 2 mm · 0,079″/.test(tb) && /\.025 in = 0,64 mm · 1,9 F/.test(tb));
  r.check('Ballon: Durchmesser ohne Umrechnung, Länge 15 mm = 1,5 cm', /Ballondurchmesser:\s*3,0 mm(?! =)/.test(tc) && /15 mm = 1,5 cm/.test(tc));

  /* ── 3. Seite des Merkmals: Umrechnung sehen und ändern ── */
  await p.evaluate(() => naGeh('#/liste/merkmale/kurvenradius_mm'));
  r.check('Merkmal-Seite: „Umrechnung: nicht umrechnen" (Vorgabe für den Kurvenradius)', await warte(p, () => /Umrechnung\s*nicht umrechnen[\s\S]*Vorgabe/.test(document.getElementById('naMain').textContent)));
  await p.click('[data-na="mmMass"]');
  r.check('Blatt mit drei Arten', (await p.locator('#naSheet.show [data-na="sheetWert"]').count()) === 3);
  await p.click('#naSheet.show [data-wert="laenge"]');
  r.check('auf „Länge" gestellt: im Katalog des Hauses gemerkt, Seite zeigt „vom Haus festgelegt"', await warte(p, () => naKatTpl().merkmale.kurvenradius_mm.mass === 'laenge' && /Länge: mm auch in cm[\s\S]*vom Haus festgelegt/.test(document.getElementById('naMain').textContent)));
  await p.evaluate(() => naGeh('#/liste/merkmale/draht_in'));
  r.check('Drahtdurchmesser: „Durchmesser … mm · Zoll · French" mit Beispiel', await warte(p, () => /Umrechnung\s*Durchmesser \(Draht, Katheter, Schleuse, Nadel\): mm · Zoll · French[\s\S]*0,035″ = 0,89 mm · 2,7 F/.test(document.getElementById('naMain').textContent)));

  await warte(p, () => naAbgleich.offen() === 0, null, 10000);
  r.check('Server (Bestand): Byte für Byte unverändert', JSON.stringify((await json(srv.base, '/api/state')).state) === bestandVorher);
  r.check('keine Fehler' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''), errs.length === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error(e); process.exit(1); });
