/* VERWALTUNGSPOLITIK — Regressionsschutz für den EINEN Schreibweg an zwei
   Stellen, die früher die Alt-Speicher (QE/overrides) als Signal lasen und
   nach der Vereinheitlichung Regel-Änderungen übersahen:

   A) Ausblenden über das Schnellmenü (Regel-Pfad, prop 'hidden'):
      - der Eintrag ist unsichtbar (qeGet),
      - er erscheint im Panel „Ausgeblendete Einträge" (collectHidden),
      - restoreCid macht ihn wieder sichtbar (Regel wird zurückgenommen).
      Dasselbe für „🌐 überall" → collectHidden.byMat + restoreMat.

   B) Kategorie-Korrektur über setNatur (Regel-Pfad, prop 'natur'):
      - zählt im Prüf-Workflow als „korrigiert"/„erledigt"
        (naturKorrigiert/isHandled), obwohl sie NICHT in overrides liegt. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('rules-hidden');
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);

  const ready = await A.page.evaluate(() => {
    doLogin('1234567');
    return typeof collectHidden === 'function' && typeof restoreCid === 'function' && typeof naturKorrigiert === 'function';
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
    openSheet(x.cid); sheetPending = { kind: 'hidden', value: true }; applyPending('mat'); // confirm auto-akzeptiert
    const inByMat = collectHidden().byMat.includes(x.e.material_key);
    restoreMat(x.e.material_key);
    const ruleGone = !rulesActive(RULES).some(z => z.ziel.key === x.e.material_key && z.prop === 'hidden' && z.wo.art === 'alle');
    return { mk: x.e.material_key, inByMat, ruleGone };
  }, a.cid);
  if (!b.none) {
    r.check('🌐 „überall"-Ausblenden erscheint unter byMat', b.inByMat);
    r.check('restoreMat nimmt die „überall"-Regel zurück', b.ruleGone);
  }

  // B) Kategorie-Korrektur via setNatur zählt als korrigiert/erledigt
  const c = await A.page.evaluate(() => {
    const x = allMatGerEntries().find(y => y.e.material_key && y.e.natur !== 'ueberschrift');
    if (!x) return { none: true };
    const base = x.e.natur_manuell || x.e.natur;
    const other = natList().map(n => n.key).find(k => k !== 'ueberschrift' && k !== base) || 'geraet';
    const pre = naturKorrigiert(x.cid);
    setNatur(x.cid, other);
    const post = { korr: naturKorrigiert(x.cid), handled: isHandled(x.cid), noLegacy: overrides[x.cid] === undefined };
    setNatur(x.cid, base); // zurück
    const after = naturKorrigiert(x.cid);
    return { none: false, pre, post, after };
  });
  if (!c.none) {
    r.check('vor Korrektur: nicht korrigiert', !c.pre);
    r.check('setNatur-Korrektur zählt als „korrigiert" (ohne overrides)', c.post.korr && c.post.noLegacy);
    r.check('… und als „erledigt" im Prüf-Workflow', c.post.handled);
    r.check('Zurück auf Basis: wieder nicht korrigiert', !c.after);
  }

  r.check('keine Konsolenfehler', A.errs.length === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
