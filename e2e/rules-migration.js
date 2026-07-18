/* VERWALTUNGSPOLITIK Stufe 2/3 end-to-end: EIN Schreibweg + Lazy-Migration.
   Beweise:
     A. 📍 „Nur hier" schreibt eine Stelle-Regel und MIGRIERT den Alt-Wert
        (QE.cid) weg.
     B. 🌐 „Überall" schreibt eine alle-Regel; sie wirkt in einem anderen
        Standard.
     C. Kaskade: die Stelle-Regel schlägt die alle-Regel an ihrer Stelle.
     D. Reset nimmt NUR die Stelle-Regel zurück → die alle-Regel greift wieder.
     E. „Einstufung prüfen" (setNatur/reassignEntry) schreibt denselben
        Regel-Weg (Stelle), nicht mehr overrides/reassign.
     F. Rückwärtskompatibilität: reiner Alt-Wert ohne Regeln löst korrekt auf. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('rules-migration');
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);

  const pick = await A.page.evaluate(() => {
    doLogin('1234567');
    const occ = new Map();
    DB.standards.forEach(s => (s.rubriken || []).forEach((rub, ri) => (rub.sub_bereiche || []).forEach((sb, si) => (sb.eintraege || []).forEach((e, ei) => {
      if (!e.material_key || e.ist_fliesstext || e.natur === 'ueberschrift') return;
      const k = e.material_key; if (!occ.has(k)) occ.set(k, []);
      occ.get(k).push({ cid: cidOf(s.id, ri, si, ei), sid: s.id });
    }))));
    for (const [k, l] of occ) { const sids = new Set(l.map(o => o.sid)); if (sids.size >= 2) { const a = l[0]; const b = l.find(o => o.sid !== a.sid); return { key: k, a, b }; } }
    return null;
  });
  r.check('Testmaterial (≥2 Standards) gefunden', !!pick);
  if (!pick) { await r.finish(browser, [srv]); return; }

  // A) Alt-Wert vorhanden → 📍 Nur hier schreibt Stelle-Regel + migriert Alt-Wert
  const a = await A.page.evaluate((p) => {
    openStandard(p.a.sid, true);
    const e = findEntry(p.a.cid);
    (QE.cid[p.a.cid] = QE.cid[p.a.cid] || {}).color = '#legacy0'; saveQE(); // simulierter Alt-Wert
    openSheet(p.a.cid); sheetPending = { kind: 'color', value: '#stelle1' }; applyPending('cid');
    const rule = rulesActive(RULES).find(x => x.wo.art === 'stelle' && x.prop === 'color' && x.wo.wert === p.a.cid);
    return { val: qeGet(findEntry(p.a.cid), p.a.cid, 'color'), rule: !!rule, legacyGone: !(QE.cid[p.a.cid] && QE.cid[p.a.cid].color !== undefined) };
  }, pick);
  r.check('📍 Nur hier erzeugt eine Stelle-Regel', a.rule);
  r.check('📍 Regel-Wert greift (#stelle1)', a.val === '#stelle1');
  r.check('Lazy-Migration: Alt-Wert (QE.cid) entfernt', a.legacyGone);

  // B) 🌐 Überall (confirm auto-akzeptiert) → alle-Regel, wirkt woanders
  const b = await A.page.evaluate((p) => {
    openSheet(p.a.cid); sheetPending = { kind: 'color', value: '#alle1' }; applyPending('mat');
    return {
      rule: rulesActive(RULES).some(x => x.wo.art === 'alle' && x.prop === 'color'),
      here: qeGet(findEntry(p.a.cid), p.a.cid, 'color'),
      other: qeGet(findEntry(p.b.cid), p.b.cid, 'color'),
    };
  }, pick);
  r.check('🌐 Überall erzeugt eine alle-Regel', b.rule);
  r.check('alle-Regel wirkt in anderem Standard (#alle1)', b.other === '#alle1');
  // C) Kaskade
  r.check('Kaskade: 📍 Stelle schlägt 🌐 alle an ihrer Stelle', b.here === '#stelle1');

  // D) Reset an der Stelle → alle-Regel greift wieder
  const d = await A.page.evaluate((p) => {
    openSheet(p.a.cid); sheetResetEntry();
    return { val: qeGet(findEntry(p.a.cid), p.a.cid, 'color'), stelleGone: !rulesActive(RULES).some(x => x.wo.art === 'stelle' && x.prop === 'color' && x.wo.wert === p.a.cid), alleStays: rulesActive(RULES).some(x => x.wo.art === 'alle' && x.prop === 'color') };
  }, pick);
  r.check('Reset nimmt NUR die Stelle-Regel zurück', d.stelleGone && d.alleStays);
  r.check('nach Reset greift die alle-Regel wieder (#alle1)', d.val === '#alle1');

  // E) „Einstufung prüfen" schreibt Regeln (Stelle), nicht overrides/reassign
  const e = await A.page.evaluate((p) => {
    const ent = findEntry(p.a.cid);
    const otherNat = natList().map(n => n.key).find(k => k !== 'ueberschrift' && k !== effNatur(ent, p.a.cid)) || 'geraet';
    setNatur(p.a.cid, otherNat);
    const natRule = rulesActive(RULES).some(x => x.wo.art === 'stelle' && x.prop === 'natur' && x.wo.wert === p.a.cid);
    const noLegacyNat = overrides[p.a.cid] === undefined;
    reassignEntry(p.a.cid, 'E2E-UK');
    const ukRule = rulesActive(RULES).some(x => x.wo.art === 'stelle' && x.prop === 'uk' && x.wo.wert === p.a.cid);
    return { natRule, noLegacyNat, effNat: effNatur(findEntry(p.a.cid), p.a.cid), want: otherNat, ukRule, uk: canonUk(findEntry(p.a.cid), p.a.cid) };
  }, pick);
  r.check('Einstufung prüfen → Kategorie als Stelle-Regel (nicht overrides)', e.natRule && e.noLegacyNat);
  r.check('Kategorie-Regel wirkt (effNatur)', e.effNat === e.want);
  r.check('Einstufung prüfen → Unterkategorie als Stelle-Regel', e.ukRule && e.uk === 'E2E-UK');

  // F) Rückwärtskompatibilität: reiner Alt-Wert ohne Regel löst korrekt auf
  const f = await A.page.evaluate((p) => {
    const cid = p.b.cid; // an dieser Stelle liegt (außer der alle-Regel) nichts
    (QE.cid[cid] = QE.cid[cid] || {}).spez = 'ALT'; saveQE();
    const v = qeGet(findEntry(cid), cid, 'spez');
    delete QE.cid[cid].spez; if (!Object.keys(QE.cid[cid]).length) delete QE.cid[cid]; saveQE();
    return v;
  }, pick);
  r.check('Rückwärtskompatibel: Alt-Wert ohne Regel greift', f === 'ALT');

  r.check('keine Konsolenfehler', A.errs.length === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
