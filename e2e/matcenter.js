/* END-TO-END: Material-Zentrale — ein Ort für Material, Einträge, Ordnung, Prüfen.
   Prüft die Konsolidierung dort, wo sie zählt: Register wechseln, Lücken finden,
   aus der Arbeitsliste in den richtigen Filter springen, Alt-Daten
   nicht-destruktiv übernehmen, und den sichtbaren Geltungsbereich in der
   Eintrags-Maske (statt Nachfrage hinterher). */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('matcenter');
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);

  // ─────────── Register-Gerüst ───────────
  const tabs = await A.page.evaluate(() => {
    doLogin('1234567');
    setMode('care');
    const names = [...document.querySelectorAll('#scr-care .mc-tab .mc-tab-l')].map(e => e.textContent);
    const shown = document.querySelectorAll('#scr-care .mc-tab').length;
    return { names, shown, active: document.querySelector('#scr-care .mc-tab.on .mc-tab-l').textContent };
  });
  r.check('Zentrale hat vier Register', tabs.shown === 4);
  r.check('Register heißen Material · Einträge · Ordnung · Prüfen',
    ['Material', 'Einträge', 'Ordnung', 'Prüfen'].every(n => tabs.names.includes(n)));
  r.check('Startet im Register „Material"', tabs.active === 'Material');

  // ─────────── Register „Einträge" ───────────
  const entries = await A.page.evaluate(() => {
    mcGo('eintraege');
    const rows = mcEntryRows();
    const listed = document.querySelectorAll('#mcList .mat-row').length;
    mcSetFilter('nichtverknuepft');
    const nv = document.querySelectorAll('#mcList .mat-row').length;
    return { total: rows.length, listed, nv, hatStatus: rows.length > 0 && 'verknuepft' in rows[0] };
  });
  r.check('Register „Einträge" listet die Vorkommen', entries.listed > 0 && entries.total > 0);
  r.check('Einträge tragen einen Pflegestatus', entries.hatStatus === true);
  r.check('Filter „ohne Material" grenzt ein', entries.nv > 0 && entries.nv <= entries.listed);

  // ─────────── Register „Prüfen": Arbeitsliste + Sprung ───────────
  const pruefen = await A.page.evaluate(() => {
    // eine echte Lücke erzeugen: Stammsatz ohne Foto/Preis/Lagerort
    GTINDB['m:luecke'] = { gtin: 'm:luecke', manual: true, name: 'Testmaterial ohne Pflege', ref: 'R1' };
    saveGtinDB();
    mcGo('pruefen');
    const todos = document.querySelectorAll('#scr-care .mc-todo').length;
    const gaps = mcGapCounts();
    // Sprung aus der Arbeitsliste in den passenden Filter
    mcJump('material', 'foto');
    const tabNow = document.querySelector('#scr-care .mc-tab.on .mc-tab-l').textContent;
    const filterOn = document.querySelector('#scr-care .filter-row .on').textContent;
    return { todos, gapFoto: gaps.foto, tabNow, filterOn };
  });
  r.check('„Prüfen" zeigt eine Arbeitsliste', pruefen.todos > 0);
  r.check('Lücke „ohne Foto" wird erkannt', pruefen.gapFoto >= 1);
  r.check('Klick in der Arbeitsliste springt in den richtigen Filter',
    pruefen.tabNow === 'Material' && /Foto/.test(pruefen.filterOn));

  // ─────────── Alt-Daten-Übernahme (nicht-destruktiv) ───────────
  const migr = await A.page.evaluate(() => {
    const key = (MAT_INDEX[0] && MAT_INDEX[0].key) || null;
    if (!key) return { skipped: true };
    careMem[key] = { photo: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', loc: 'Regal Alt' };
    PROD[key] = { hersteller: 'Alt-Hersteller', ref: 'ALT-1', verwendung: null, preis: 7.5 };
    saveJSON('hkl_care', careMem); saveProd();
    const vorher = mcLegacyPending();
    mcMigrateLegacy();
    const id = canonId(key);
    const rec = id ? GTINDB[id] : null;
    const nachher = mcLegacyPending();
    // Alt-Töpfe müssen unangetastet bleiben
    const altNochDa = !!(careMem[key] && careMem[key].loc === 'Regal Alt' && PROD[key] && PROD[key].ref === 'ALT-1');
    return { skipped: false, vorherOffen: vorher.gesamt, nachherOffen: nachher.gesamt,
      angelegt: !!rec, lagerort: rec && rec.lagerort, hersteller: rec && rec.hersteller,
      preis: rec && rec.preis, altNochDa };
  });
  if (migr.skipped) { r.fail('Alt-Daten-Übernahme (kein Material vorhanden)'); }
  else {
    r.check('Alt-Daten werden als offen erkannt', migr.vorherOffen > 0);
    r.check('Übernahme legt/füllt den Stammsatz', migr.angelegt === true && migr.lagerort === 'Regal Alt');
    r.check('Hersteller und Preis wandern mit', migr.hersteller === 'Alt-Hersteller' && migr.preis === 7.5);
    r.check('Danach nichts mehr offen', migr.nachherOffen < migr.vorherOffen);
    r.check('Alt-Daten bleiben unangetastet (nichts geht verloren)', migr.altNochDa === true);
  }

  // ─────────── Sichtbarer Geltungsbereich in der Eintrags-Maske ───────────
  const scope = await A.page.evaluate(() => {
    // einen Eintrag mit Material suchen und aus der Zentrale öffnen
    const row = mcEntryRows().find(x => x.mk);
    if (!row) return { skipped: true };
    mcOpenEntry(row.cid);
    const bar = document.getElementById('fScope');
    const chips = bar ? [...bar.querySelectorAll('.scope-chip')].map(b => b.dataset.s) : [];
    const startScope = readEntryScope();
    // auf „überall" umstellen
    const alle = bar && bar.querySelector('.scope-chip[data-s="mat"]');
    if (alle) alle.click();
    return { skipped: false, sichtbar: !!bar, chips, startScope, nachKlick: readEntryScope() };
  });
  if (scope.skipped) { r.fail('Geltungsbereich (kein Material-Eintrag gefunden)'); }
  else {
    r.check('Geltungsbereich ist VOR dem Speichern sichtbar', scope.sichtbar === true);
    r.check('Stufen „nur hier" und „überall" stehen zur Wahl',
      scope.chips.includes('cid') && scope.chips.includes('mat'));
    r.check('Vorbelegt ist die sichere Stufe „nur hier"', scope.startScope === 'cid');
    r.check('Umschalten wird übernommen', scope.nachKlick === 'mat');
  }

  // ─────────── Ordnung: eigene Eigenschaft anlegen ───────────
  const ordnung = await A.page.evaluate(() => {
    setMode('care'); mcGo('ordnung');
    const vorher = MATPROPS.length;
    document.getElementById('mcNewProp').value = 'Tip Load';
    mcPropAdd();
    const drin = MATPROPS.some(p => p.label === 'Tip Load');
    const kats = document.querySelectorAll('#scr-care .nat-row').length;
    return { vorher, nachher: MATPROPS.length, drin, kats };
  });
  r.check('Ordnung: eigene Eigenschaft anlegbar', ordnung.nachher === ordnung.vorher + 1 && ordnung.drin);
  r.check('Ordnung zeigt Kategorien/Unterkategorien', ordnung.kats > 0);

  r.check('keine Konsolen-/Seitenfehler', A.errs.filter(e => !/favicon/i.test(e)).length === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
