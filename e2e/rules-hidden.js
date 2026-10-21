/* VERWALTUNGSPOLITIK — Regressionsschutz für den EINEN Schreibweg an zwei
   Stellen, die früher die Alt-Speicher (QE/overrides) als Signal lasen und
   nach der Vereinheitlichung Regel-Änderungen übersahen:

   A) Ausblenden über das Schnellmenü (Regel-Pfad, prop 'hidden'):
      - der Eintrag ist unsichtbar (qeGet),
      - er erscheint im Panel „Ausgeblendete Einträge" (collectHidden),
      - restoreCid macht ihn wieder sichtbar (Regel wird zurückgenommen).
      Dasselbe für „🌐 überall" → collectHidden.byMat + restoreMat.

   B) Kategorie-Korrektur über setNatur (Regel-Pfad, prop 'natur'):
      - landet als Regel an der STELLE und NICHT im Alt-Speicher `overrides`,
      - wirkt über effNatur, und die Rücknahme räumt sie wieder ab.
      Früher prüfte dieser Abschnitt zusätzlich, dass die Korrektur im
      Prüf-Workflow als „erledigt" zählte. Das Einstufungs-Konzept ist
      entfernt — die Regel-Aussage bleibt. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('rules-hidden');
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);

  const ready = await A.page.evaluate(() => {
    doLogin('1234567');
    return typeof collectHidden === 'function' && typeof restoreCid === 'function' && typeof setNatur === 'function';
  });
  r.check('Admin-Helfer verfügbar', ready);

  // A1) 📍 „nur hier" ausblenden → sichtbar im Panel + wiederherstellbar
  const a = await A.page.evaluate(() => {
    const x = allMatGerEntries().find(y => y.e.material_key && y.e.natur !== 'ueberschrift');
    if (!x) return { none: true };
    openSheet(x.cid); sheetPending = { kind: 'hidden', value: true }; applyPending('cid');
    const hidden = qeGet(findEntry(x.cid), x.cid, 'hidden') === true;
    const inPanel = collectHidden().byCid.some(z => z.cid === x.cid);
    restoreCid(x.cid);
    const backVisible = qeGet(findEntry(x.cid), x.cid, 'hidden') !== true;
    const ruleGone = !rulesActive(RULES).some(z => z.prop === 'hidden' && z.wo.art === 'stelle' && z.wo.wert === x.cid);
    return { cid: x.cid, hidden, inPanel, backVisible, ruleGone };
  });
  r.check('Testeintrag vorhanden', !a.none);
  if (a.none) { await r.finish(browser, [srv]); return; }
  r.check('📍 Regel-Ausblenden macht unsichtbar', a.hidden);
  r.check('… erscheint im Panel „Ausgeblendete Einträge"', a.inPanel);
  r.check('restoreCid macht wieder sichtbar', a.backVisible);
  r.check('… und nimmt die hidden-Regel zurück', a.ruleGone);

  // A2) 🌐 „überall" ausblenden → byMat + restoreMat
  const b = await A.page.evaluate((usedCid) => {
    const x = allMatGerEntries().find(y => y.e.material_key && y.e.natur !== 'ueberschrift' && y.cid !== usedCid);
    if (!x) return { none: true };
    openSheet(x.cid); sheetPending = { kind: 'hidden', value: true }; applyPending('mat');
    document.querySelector('#sheet .btn-pri').click();   // Bestätigungs-Karte (Grundsatz ⑧)
    const inByMat = collectHidden().byMat.includes(x.e.material_key);
    restoreMat(x.e.material_key);
    const ruleGone = !rulesActive(RULES).some(z => z.ziel.key === x.e.material_key && z.prop === 'hidden' && z.wo.art === 'alle');
    return { mk: x.e.material_key, inByMat, ruleGone };
  }, a.cid);
  if (!b.none) {
    r.check('🌐 „überall"-Ausblenden erscheint unter byMat', b.inByMat);
    r.check('restoreMat nimmt die „überall"-Regel zurück', b.ruleGone);
  }

  // B) Kategorie-Korrektur via setNatur schreibt eine Stelle-Regel
  const c = await A.page.evaluate(() => {
    const x = allMatGerEntries().find(y => y.e.material_key && y.e.natur !== 'ueberschrift');
    if (!x) return { none: true };
    const base = effNatur(x.e, x.cid);
    const other = natList().map(n => n.key).find(k => k !== 'ueberschrift' && k !== base) || 'geraet';
    const hatRegel = () => rulesActive(RULES).some(z => z.wo.art === 'stelle' && z.prop === 'natur' && z.wo.wert === x.cid);
    const pre = hatRegel();
    setNatur(x.cid, other);
    const post = { regel: hatRegel(), wirkt: effNatur(findEntry(x.cid), x.cid) === other,
      noLegacy: overrides[x.cid] === undefined };
    setNatur(x.cid, base); // zurück
    const after = effNatur(findEntry(x.cid), x.cid);
    return { none: false, pre, post, after, base };
  });
  if (!c.none) {
    r.check('vor der Korrektur liegt keine Stelle-Regel', !c.pre);
    r.check('setNatur schreibt eine Stelle-Regel (nicht overrides)', c.post.regel && c.post.noLegacy);
    r.check('… und die Regel wirkt (effNatur)', c.post.wirkt);
    r.check('Zurück auf die Ausgangskategorie', c.after === c.base);
  }

  r.check('keine Konsolenfehler', A.errs.length === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
