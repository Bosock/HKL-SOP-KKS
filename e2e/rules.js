/* VERWALTUNGSPOLITIK (Stufe 1) end-to-end: Regel-Journal + Kaskade + Sammel-
   Änderung mit Treffervorschau + Rücknahme + Inspektor — gegen echten Server.
   Kernbeweise:
     1. Reichweiten-Dialog zeigt 4 Stufen MIT Trefferzahlen.
     2. Eine Gruppen-Regel wirkt in einem ANDEREN Standard derselben Gruppe,
        aber nicht außerhalb der Gruppe.
     3. Kaskade: 📍-Alt-Wert (QE.cid) schlägt die Gruppen-Regel.
     4. Journal listet die Regel; Rücknahme (revoke) macht die Massenänderung
        mit einem Schritt rückgängig — das Journal bleibt (Audit).
     5. Inspektor „Warum so?" zeigt Herkunft & Gewinner.
     6. Server-Roundtrip: Gerät B sieht Regel + Wirkung; Vereinigung zweier
        Journale verliert nichts. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('rules');
  const srv = await startServer({ BACKUP_INTERVAL_MS: '100' });
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);

  // Testobjekt wählen: ein Material, das in ≥2 Standards DERSELBEN Gruppe
  // vorkommt (für den Gruppen-Beweis); dazu möglichst ein Vorkommen in einer
  // ANDEREN Gruppe (Negativ-Beweis).
  const pick = await A.page.evaluate(() => {
    doLogin('1234567');
    const occ = new Map(); // key → [{cid, sid, grp}]
    DB.standards.forEach(s => { const grp = stdGruppe(s);
      (s.rubriken || []).forEach((rub, ri) => (rub.sub_bereiche || []).forEach((sb, si) => (sb.eintraege || []).forEach((e, ei) => {
        if (!e.material_key || e.ist_fliesstext || e.natur === 'ueberschrift') return;
        const k = e.material_key; if (!occ.has(k)) occ.set(k, []);
        occ.get(k).push({ cid: cidOf(s.id, ri, si, ei), sid: s.id, grp });
      })));
    });
    let best = null;
    for (const [k, list] of occ) {
      const byGrp = new Map();
      list.forEach(o => { if (!byGrp.has(o.grp)) byGrp.set(o.grp, new Set()); byGrp.get(o.grp).add(o.sid); });
      for (const [g, sids] of byGrp) {
        if (sids.size >= 2) {
          const inGrp = list.filter(o => o.grp === g);
          const a = inGrp[0];
          const b = inGrp.find(o => o.sid !== a.sid);
          const out = list.find(o => o.grp !== g) || null;
          const cand = { key: k, grp: g, a, b, out };
          if (!best || (out && !best.out)) best = cand;
          if (best && best.out) break;
        }
      }
      if (best && best.out) break;
    }
    return best;
  });
  r.check('Testmaterial gefunden (≥2 Standards in einer Gruppe)', !!pick);
  if (!pick) { await r.finish(browser, [srv]); return; }

  // 1) Reichweiten-Dialog: 4 Stufen mit Trefferzahlen
  const dlg = await A.page.evaluate((p) => {
    openStandard(p.a.sid, true);
    openSheet(p.a.cid);
    sheetPending = { kind: 'color', value: '#a1b2c3' };
    askScope();
    const t = document.getElementById('sheet').textContent;
    return { hier: /Nur hier/.test(t), std: /In diesem Standard/.test(t), grp: /In der Gruppe/.test(t), alle: /Überall/.test(t), hits: /betrifft \d+/.test(t) };
  }, pick);
  r.check('Dialog zeigt 📍/📄/🗂/🌐', dlg.hier && dlg.std && dlg.grp && dlg.alle);
  r.check('Dialog zeigt Trefferzahlen („betrifft N…")', dlg.hits);

  // 2) Gruppen-Regel anwenden (confirm wird von bootPage auto-bestätigt)
  const applied = await A.page.evaluate((p) => {
    applyPending('grp');
    const act = rulesActive(RULES);
    const eA = findEntry(p.a.cid), eB = findEntry(p.b.cid);
    return {
      ruleCount: act.length,
      wo: act[0] && act[0].wo,
      von: act[0] && act[0].von,
      hereVal: qeGet(eA, p.a.cid, 'color'),
      otherStdVal: qeGet(eB, p.b.cid, 'color'),
      outVal: p.out ? qeGet(findEntry(p.out.cid), p.out.cid, 'color') : null,
    };
  }, pick);
  r.check('Regel im Journal (1 aktiv, Reichweite Gruppe, mit Urheber)',
    applied.ruleCount === 1 && applied.wo && applied.wo.art === 'gruppe' && !!applied.von);
  r.check('Regel wirkt an der Ursprungsstelle', applied.hereVal === '#a1b2c3');
  r.check('Regel wirkt in ANDEREM Standard derselben Gruppe', applied.otherStdVal === '#a1b2c3');
  if (pick.out) r.check('außerhalb der Gruppe unverändert', applied.outVal !== '#a1b2c3');

  // 3) Kaskade: 📍 Stelle (Alt-Speicher) schlägt die Gruppen-Regel
  const cascade = await A.page.evaluate((p) => {
    const e = findEntry(p.a.cid);
    qeSet('cid', e, p.a.cid, 'color', '#0f0f0f');
    const local = qeGet(e, p.a.cid, 'color');
    delete QE.cid[p.a.cid]; saveQE();
    const back = qeGet(e, p.a.cid, 'color');
    return { local, back };
  }, pick);
  r.check('Kaskade: 📍 hier schlägt 🗂 Gruppe', cascade.local === '#0f0f0f');
  r.check('Kaskade: nach Entfernen von 📍 gilt wieder die Regel', cascade.back === '#a1b2c3');

  // 4) Inspektor „Warum so?"
  const why = await A.page.evaluate((p) => {
    openSheet(p.a.cid); openWhySheet();
    const t = document.getElementById('sheet').textContent;
    const win = document.querySelector('#sheet .why-row.win');
    showSheet(false);
    return { hasTitle: /Warum so\?/.test(t), hasQuelle: /Quelldatei/.test(t), hasGrp: /Gruppe/.test(t), winFarbe: win ? win.textContent : '' };
  }, pick);
  r.check('Inspektor zeigt Kaskade (Quelldatei + Gruppen-Regel)', why.hasTitle && why.hasQuelle && why.hasGrp);

  // 5) Journal-Panel + Rücknahme
  const journal = await A.page.evaluate((p) => {
    setMode('admin');
    const txt = document.getElementById('scr-admin').textContent;
    const listed = /Regeln & Journal/.test(txt) && /Farbe/.test(txt);
    const id = rulesActive(RULES)[0].id;
    revokeRule(id);
    const e = findEntry(p.a.cid);
    return { listed, activeAfter: rulesActive(RULES).length, journalLen: RULES.length, valAfter: qeGet(e, p.a.cid, 'color') };
  }, pick);
  r.check('Verwaltung listet 🧾 Regeln & Journal mit der Regel', journal.listed);
  r.check('Rücknahme: 0 aktive Regeln, Wirkung weg', journal.activeAfter === 0 && journal.valAfter === undefined);
  r.check('Journal bleibt vollständig (set + revoke = Audit-Trail)', journal.journalLen === 2);

  // 6) Vereinigung (Sync-Kern): nichts geht verloren
  const uni = await A.page.evaluate(() => {
    const a = [{ id: 'rX', ts: '2026-01-01T00:00:00Z', op: 'set' }];
    const b = [{ id: 'rY', ts: '2026-01-02T00:00:00Z', op: 'set' }];
    return rulesUnion(a, b).length === 2 && rulesUnion(rulesUnion(a, b), a).length === 2;
  });
  r.check('rulesUnion vereinigt verlustfrei (Browser-Realm)', uni);

  // 7) Server-Roundtrip: Journal (set+revoke) liegt auf dem Server; Gerät B liest es
  let onServer = false;
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const S = (await A.page.evaluate(async () => (await fetch('/api/state', { cache: 'no-store' })).json())).state || {};
    if (Array.isArray(S.hkl_rules) && S.hkl_rules.length === 2) { onServer = true; break; }
    await A.page.waitForTimeout(400);
  }
  r.check('Server hat das Regel-Journal (2 Ereignisse)', onServer);

  const B = await bootPage(browser, srv.base);
  await B.page.waitForTimeout(600);
  const onB = await B.page.evaluate((p) => ({
    len: RULES.length, active: rulesActive(RULES).length,
    val: qeGet(findEntry(p.a.cid), p.a.cid, 'color'),
  }), pick);
  r.check('Gerät B: Journal synchron (2 Ereignisse, 0 aktiv, keine Wirkung)',
    onB.len === 2 && onB.active === 0 && onB.val === undefined);

  r.check('keine Konsolenfehler (A+B)', A.errs.length + B.errs.length === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
