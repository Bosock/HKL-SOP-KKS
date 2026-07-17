/* Verifiziert die Quick-Win-Fixes aus UX-Audit + QA-Gutachten:
   K2 Zoom frei · H1a 🔎-Kopfleiste · M2 Such-Fallback · K1 ⋯-Button (beide
   Rollen) · K4 „lokal"-Pill + Offline-Hinweis · K4c Tagesreset-Hinweis ·
   P1 Quota-Warnung + Lese-Fallback · Altfoto-Migration · H2 Kontraste. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('quickwins');
  const srv = await startServer();
  const browser = await launchBrowser();
  const { page, errs } = await bootPage(browser, srv.base);

  // --- K2: Zoom nicht mehr gesperrt ---
  const meta = await page.evaluate(() => document.querySelector('meta[name=viewport]').content);
  r.check('K2 Zoom frei (kein user-scalable=no)', !/user-scalable\s*=\s*no|maximum-scale/i.test(meta));

  // --- H1a: 🔎 in der Kopfleiste öffnet globale Suche ---
  await page.click('#searchBtn');
  r.check('H1a 🔎 öffnet globale Suche', await page.evaluate(() =>
    document.getElementById('scr-search').classList.contains('active') && !!document.getElementById('gSearchInput')));

  // --- M2: Startsuche ohne Treffer bietet Inhalts-Suche an ---
  await page.evaluate(() => { setMode('use'); renderStandards("Xyz'Quark"); });
  await page.click('#scr-standards [data-q]');
  const m2 = await page.evaluate(() => ({
    active: document.getElementById('scr-search').classList.contains('active'),
    q: (document.getElementById('gSearchInput') || {}).value,
  }));
  r.check('M2 Fallback übergibt Suchtext (inkl. Apostroph!)', m2.active && m2.q === "Xyz'Quark");

  // --- K4c: erster Haken → Tagesreset-Hinweis ---
  const daily = await page.evaluate(() => new Promise(res => {
    setMode('use');
    const s = DB.standards.find(x => (x.rubriken || []).some(rr => rr.typ === 'material' || rr.typ === 'geraete'));
    openStandard(s.id, true);
    openRubrik(s.rubriken.findIndex(rr => rr.typ === 'material' || rr.typ === 'geraete'));
    const orig = window.toast; let msg = null;
    window.toast = (m, e) => { msg = m; orig(m, e); };
    const cid = document.querySelector('#scr-detail .entry').id.replace(/^e-/, '');
    toggleCheck(cid);
    window.toast = orig;
    res({ msg, flag: store.get('hkl_hint_daily'), checked: !!checks[cid] });
  }));
  r.check('K4c Tagesreset-Hinweis beim ersten Haken', /heute/.test(daily.msg || '') && daily.flag === '1' && daily.checked);

  // --- K1: ⋯-Button — Nicht-Admin → Vorschlagsformular ---
  await page.click('#scr-detail .entry-menu-btn');
  r.check('K1 ⋯ (Nicht-Admin) öffnet Vorschlagsformular', await page.evaluate(() =>
    document.getElementById('scr-form').classList.contains('active') && !!document.getElementById('pgTo')));

  // --- K1: ⋯-Button — Admin → Schnellmenü ---
  await page.evaluate(() => { doLogin('1234567'); if (typeof closeForm === 'function') closeForm(); });
  await page.evaluate(() => { const s = curStd || DB.standards[0]; openStandard(s.id, true); openRubrik((s.rubriken || []).findIndex(rr => rr.typ === 'material' || rr.typ === 'geraete')); });
  await page.click('#scr-detail .entry-menu-btn');
  r.check('K1 ⋯ (Admin) öffnet Bearbeiten-Menü', await page.evaluate(() =>
    document.getElementById('sheet').classList.contains('show') && /Bearbeiten/.test(document.getElementById('sheet').textContent)));
  // §3: Menü ist in vier Fächer gegliedert (Inhalt · Darstellung · Organisation · Gefahrenzone)
  r.check('§3 Bearbeiten-Menü in 4 Fächer gegliedert', await page.evaluate(() =>
    ['Inhalt', 'Darstellung', 'Organisation', 'Gefahrenzone'].every(g =>
      [...document.querySelectorAll('#sheet .sheet-group .sg-t')].some(x => x.textContent === g))));
  await page.evaluate(() => showSheet(false));

  // §3: Standard- und Rubrik-Menü im gleichen gegliederten Muster
  r.check('§3 Standard-Menü gegliedert (Bearbeiten)', await page.evaluate(() => {
    openStdSheet();
    const ok = document.getElementById('sheet').classList.contains('show')
      && /Standard bearbeiten/.test(document.getElementById('sheet').textContent)
      && [...document.querySelectorAll('#sheet .sg-t')].some(x => x.textContent === 'Gefahrenzone');
    showSheet(false); return ok;
  }));
  r.check('§3 Rubrik-Menü gegliedert (Bearbeiten)', await page.evaluate(() => {
    openRubSheet(0);
    const titles = [...document.querySelectorAll('#sheet .sg-t')].map(x => x.textContent);
    const ok = document.getElementById('sheet').classList.contains('show')
      && /Rubrik bearbeiten/.test(document.getElementById('sheet').textContent)
      && ['Inhalt', 'Organisation', 'Gefahrenzone'].every(g => titles.includes(g));
    showSheet(false); return ok;
  }));

  // Lange-Tippen (Halten ≈500 ms) erreicht das Menü auf jeder Ebene
  await page.evaluate(() => setMode('use'));
  await page.waitForTimeout(150);
  const sBox = await page.evaluate(() => { const el = document.querySelector('#scr-standards .std'); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + 18) }; });
  let stdHold = false;
  if (sBox) { await page.mouse.move(sBox.x, sBox.y); await page.mouse.down(); await page.waitForTimeout(650);
    stdHold = await page.evaluate(() => document.getElementById('sheet').classList.contains('show') && /Standard bearbeiten/.test(document.getElementById('sheet').textContent));
    await page.mouse.up(); await page.evaluate(() => showSheet(false)); }
  r.check('Lange-Tippen auf Standard-Karte öffnet Standard-Menü', stdHold);

  const rBox = await page.evaluate(() => { const s = DB.standards[0]; openStandard(s.id, true); const el = document.querySelector('#scr-rubriken .rub'); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + 18) }; });
  let rubHold = false;
  if (rBox) { await page.mouse.move(rBox.x, rBox.y); await page.mouse.down(); await page.waitForTimeout(650);
    rubHold = await page.evaluate(() => document.getElementById('sheet').classList.contains('show') && /Rubrik bearbeiten/.test(document.getElementById('sheet').textContent));
    await page.mouse.up(); await page.evaluate(() => showSheet(false)); }
  r.check('Lange-Tippen auf Rubrik öffnet Rubrik-Menü', rubHold);

  // Wirkungs-Chips (§1/A) im Menü sichtbar
  r.check('Wirkungs-Chips im Bearbeiten-Menü', await page.evaluate(() => {
    openStdSheet(DB.standards[0].id);
    const ok = document.querySelector('#sheet .sheet-chips .schip') != null; showSheet(false); return ok;
  }));

  // --- P1: Quota voll → Warnung + Wert bleibt lesbar (mem-Überlagerung) ---
  const quota = await page.evaluate(() => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function () { throw new DOMException('QuotaExceededError'); };
    const t = window.toast; let warned = null; window.toast = (m, e) => { warned = m; t(m, e); };
    TXT.probe = 'QUOTA_OK'; saveTXT();                     // reale Save-Funktion
    const readable = (loadJSON('hkl_txt', {}) || {}).probe === 'QUOTA_OK';
    Storage.prototype.setItem = orig; window.toast = t;
    TXT.probe2 = 'BACK'; saveTXT();                        // Speicher wieder frei → persistiert
    const persisted = (JSON.parse(localStorage.getItem('hkl_txt')) || {}).probe2 === 'BACK';
    return { warned, readable, persisted };
  });
  r.check('P1 Quota-Warnung erscheint', /speicher voll/i.test(quota.warned || ''));
  r.check('P1 Wert bleibt trotz Quota LESBAR (vorher still verloren)', quota.readable);
  r.check('P1 nach Freiwerden wird wieder persistiert', quota.persisted);

  // --- Altfoto-Migration: übergroßes Bestandsfoto wird nachverkleinert ---
  const mig = await page.evaluate(() => new Promise(res => {
    const c = document.createElement('canvas'); c.width = 1800; c.height = 1400;
    const g = c.getContext('2d'); const im = g.createImageData(1800, 1400);
    for (let i = 0; i < im.data.length; i++) im.data[i] = (Math.random() * 256) | 0;  // Rauschen → schlecht komprimierbar
    g.putImageData(im, 0, 0);
    const big = c.toDataURL('image/png');
    careMem['legacy_photo'] = { loc: 'Altbestand', photo: big }; saveJSON('hkl_care', careMem);
    migrateCarePhotos(() => {
      const after = careMem['legacy_photo'].photo;
      res({ before: big.length, after: after.length, shrunk: after.length < big.length && after.indexOf('data:image/jpeg') === 0 });
    });
  }));
  r.check(`Altfoto-Migration verkleinert Bestand (${Math.round(mig.before / 1024)}KB→${Math.round(mig.after / 1024)}KB)`, mig.shrunk);

  // --- H2: Kontraste der vorher durchgefallenen Selektoren ≥ 4.5:1 ---
  const contrast = await page.evaluate(() => {
    const lum = c => { const m = c.match(/\d+(\.\d+)?/g).map(Number); const l = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * l(m[0]) + 0.7152 * l(m[1]) + 0.0722 * l(m[2]); };
    const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    setMode('use'); renderStandards('');
    const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)') return c; } return getComputedStyle(document.body).backgroundColor; };
    const probe = sel => { const el = document.querySelector(sel); return el ? cr(getComputedStyle(el).color, bgOf(el)) : null; };
    return { stdFile: probe('.std-file'), grp: probe('.grp') };
  });
  r.check(`H2 Kontrast .std-file ${contrast.stdFile.toFixed(2)}:1 ≥ 4.5`, contrast.stdFile >= 4.5);
  r.check(`H2 Kontrast .grp ${contrast.grp.toFixed(2)}:1 ≥ 4.5`, contrast.grp >= 4.5);

  // --- K4: Server stoppen → Offline-Hinweis + „lokal"-Pill mit Text ---
  // Erst ausstehende Flushes grün werden lassen und den Toast-Fänger VOR dem
  // Stopp installieren — sonst verpasst ein früher Flush-Fehler die Messung.
  await page.waitForFunction(() => /\bok\b/.test(document.getElementById('syncDot').className), { timeout: 8000 });
  await page.evaluate(() => { const t = window.toast; window.__offMsg = null;
    window.toast = (m, e) => { if (/verbindung/i.test(m || '')) window.__offMsg = m; t(m, e); }; });
  await srv.stop();
  const offline = await page.evaluate(() => new Promise(res => {
    document.dispatchEvent(new Event('visibilitychange'));   // stößt poll() an
    setTimeout(() => { const d = document.getElementById('syncDot');
      res({ msg: window.__offMsg, label: d.textContent, cls: d.className, role: d.getAttribute('role') }); }, 1500);
  }));
  r.check('K4 Offline-Hinweis (Toast) beim Übergang', /keine verbindung/i.test(offline.msg || ''));
  r.check('K4 Status-Pill zeigt Text „lokal" (nicht nur Farbe)', offline.label === 'lokal' && /local/.test(offline.cls));
  r.check('K4 Statuselement hat role=status (Screenreader)', offline.role === 'status');

  const realErrs = errs.filter(e => !/Failed to load resource|ERR_CONNECTION|net::/i.test(e)); // Offline-Fetches sind hier Absicht
  r.check('keine echten Konsolenfehler', realErrs.length === 0);
  await r.finish(browser, []);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
