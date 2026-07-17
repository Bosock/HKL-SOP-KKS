/* BACKEND-ANBINDUNG, Kernbeweis: Gerät A schreibt über die REALEN
   Save-Funktionen aller 13 geteilten Feature-Module → Server (/api/state) →
   Gerät B (frischer Kontext) liest denselben Stand. Prüft damit jede
   Funktionsgruppe end-to-end gegen das Backend. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('backend-roundtrip');
  const srv = await startServer({ BACKUP_INTERVAL_MS: '100' });
  const browser = await launchBrowser();

  const A = await bootPage(browser, srv.base);
  const marker = 'T' + Date.now();

  const written = await A.page.evaluate((marker) => {
    doLogin('1234567');
    let cid = null, e = null;
    outer:
    for (const s of DB.standards) for (let ri = 0; ri < (s.rubriken || []).length; ri++) {
      const rub = s.rubriken[ri];
      for (let si = 0; si < (rub.sub_bereiche || []).length; si++)
        for (let ei = 0; ei < (rub.sub_bereiche[si].eintraege || []).length; ei++) {
          const en = rub.sub_bereiche[si].eintraege[ei];
          if (en.natur !== 'ueberschrift' && !en.ist_fliesstext) { cid = cidOf(s.id, ri, si, ei); e = findEntry(cid); if (e) break outer; }
        }
    }
    const stdId = DB.standards[0].id;
    GLOSSARY.push({ id: 'g_' + marker, term: 'ACT_' + marker, def: 'Activated Clotting Time' }); saveGlossary();
    SUGGESTIONS.push({ id: 's_' + marker, sid: stdId, cid, entryName: 'X', to: 'Neu_' + marker, note: 'n', by: 'Test', created: today(), status: 'pending', votes: {} }); saveSuggestions();
    if (e && cid) qeSet('cid', e, cid, 'name', 'QE_' + marker);
    STDE[stdId] = Object.assign({}, STDE[stdId], { version: '9.' + marker.slice(-3), status: 'Freigegeben' }); saveSTDE();
    PROD['mat_' + marker] = { preis: 12.5 }; saveProd();
    HINTS.overview = HINTS.overview || []; HINTS.overview.push({ id: 'h_' + marker, text: 'Hinweis_' + marker }); saveHints();
    careMem['care_' + marker] = { loc: 'Schrank_' + marker }; saveJSON('hkl_care', careMem);
    CATALOG.items = CATALOG.items || []; CATALOG.items.push({ id: 'c_' + marker, name: 'Kat_' + marker }); saveCatalog();
    ADDITIONS.standards = ADDITIONS.standards || []; ADDITIONS.standards.push({ id: 'a_' + marker, titel: 'Add_' + marker, gruppe: 'G' }); saveAdditions();
    TXT.appTitle = 'Klinik_' + marker; saveTXT();
    DESIGN.accent = '#abcdef'; saveDESIGN();
    settings.spez = false; saveJSON('hkl_settings', settings);
    GTINDB['gt_' + marker] = mergeGtinRecord(null, { gtin: 'gt_' + marker, hersteller: 'Terumo', ref: 'REF_' + marker, french: '6F' }, new Date().toISOString()); saveGtinDB();
    return { cid, stdId, ver: STDE[stdId].version };
  }, marker);
  r.ok('Gerät A: 13 reale Save-Funktionen ausgeführt');

  // Warten, bis der Sync alle Marker auf den Server geflusht hat.
  let S = {};
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    S = (await A.page.evaluate(async () => (await fetch('/api/state', { cache: 'no-store' })).json())).state || {};
    if ((S.hkl_glossary || []).some(x => x.id === 'g_' + marker) && S.hkl_txt && S.hkl_txt.appTitle === 'Klinik_' + marker
        && S.hkl_prod && S.hkl_prod['mat_' + marker]) break;
    await new Promise(x => setTimeout(x, 400));
  }
  const serverChecks = [
    ['hkl_glossary', (S.hkl_glossary || []).some(x => x.id === 'g_' + marker)],
    ['hkl_suggestions', (S.hkl_suggestions || []).some(x => x.id === 's_' + marker)],
    ['hkl_qedits', !!(S.hkl_qedits && S.hkl_qedits.cid && S.hkl_qedits.cid[written.cid] && S.hkl_qedits.cid[written.cid].name === 'QE_' + marker)],
    ['hkl_stdedits', !!(S.hkl_stdedits && S.hkl_stdedits[written.stdId] && S.hkl_stdedits[written.stdId].version === written.ver)],
    ['hkl_prod', !!(S.hkl_prod && S.hkl_prod['mat_' + marker] && S.hkl_prod['mat_' + marker].preis === 12.5)],
    ['hkl_hints', ((S.hkl_hints && S.hkl_hints.overview) || []).some(x => x.id === 'h_' + marker)],
    ['hkl_care', !!(S.hkl_care && S.hkl_care['care_' + marker] && S.hkl_care['care_' + marker].loc === 'Schrank_' + marker)],
    ['hkl_catalog', ((S.hkl_catalog && S.hkl_catalog.items) || []).some(x => x.id === 'c_' + marker)],
    ['hkl_additions', ((S.hkl_additions && S.hkl_additions.standards) || []).some(x => x.id === 'a_' + marker)],
    ['hkl_txt', !!(S.hkl_txt && S.hkl_txt.appTitle === 'Klinik_' + marker)],
    ['hkl_design', !!(S.hkl_design && S.hkl_design.accent === '#abcdef')],
    ['hkl_settings', !!(S.hkl_settings && S.hkl_settings.spez === false)],
    ['hkl_gtin', !!(S.hkl_gtin && S.hkl_gtin['gt_' + marker] && S.hkl_gtin['gt_' + marker].ref === 'REF_' + marker)],
  ];
  for (const [k, ok] of serverChecks) r.check('Server hat ' + k, ok);

  const B = await bootPage(browser, srv.base);
  await B.page.waitForTimeout(500);
  const b = await B.page.evaluate((a) => {
    const { marker, cid, stdId, ver } = a;
    return {
      glossary: (GLOSSARY || []).some(x => x.id === 'g_' + marker),
      suggestions: (SUGGESTIONS || []).some(x => x.id === 's_' + marker),
      qe: !!(QE && QE.cid && QE.cid[cid] && QE.cid[cid].name === 'QE_' + marker),
      stde: !!(STDE && STDE[stdId] && STDE[stdId].version === ver),
      prod: !!(PROD && PROD['mat_' + marker] && PROD['mat_' + marker].preis === 12.5),
      hints: ((HINTS && HINTS.overview) || []).some(x => x.id === 'h_' + marker),
      care: !!(careMem && careMem['care_' + marker] && careMem['care_' + marker].loc === 'Schrank_' + marker),
      catalog: ((CATALOG && CATALOG.items) || []).some(x => x.id === 'c_' + marker),
      additions: ((ADDITIONS && ADDITIONS.standards) || []).some(x => x.id === 'a_' + marker),
      txt: txt('appTitle') === 'Klinik_' + marker,
      design: !!(DESIGN && DESIGN.accent === '#abcdef'),
      settings: !!(settings && settings.spez === false),
      gtin: !!(GTINDB && GTINDB['gt_' + marker] && GTINDB['gt_' + marker].ref === 'REF_' + marker),
    };
  }, { marker, cid: written.cid, stdId: written.stdId, ver: written.ver });
  for (const k of Object.keys(b)) r.check('Gerät B synchron: ' + k, b[k]);

  r.check('keine Konsolenfehler (A+B)', A.errs.length + B.errs.length === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
