/* SOUVERÄNITÄT end-to-end: überall hinzufügen, verschieben, erweitern.
     A. Inhalte-&-Aufbau-Panel: Baum in der Verwaltung, ＋ Eintrag aus dem Panel.
     B. Verschieben: eigener Eintrag wird ECHT umgehängt; Basis-Eintrag wird
        als Kopie am Ziel angelegt + am Ursprung ausgeblendet (rücknehmbar).
     C. „＋ Neu…": neue Unterkategorie direkt im Prüf-Workflow-Select;
        Datalists für Lagerort/Gruppe (wählen ODER frei tippen).
     D. Eigene Felder: beliebige Zusatz-Infos als Regel (Badge am Eintrag). */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('souveraen');
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);

  const ctx = await A.page.evaluate(() => {
    doLogin('1234567');
    const s1 = DB.standards[0], s2 = DB.standards.find(s => s.id !== s1.id);
    let base = null;
    DB.standards.forEach(s => (s.rubriken || []).forEach((rub, ri) => (rub.sub_bereiche || []).forEach((sb, si) => (sb.eintraege || []).forEach((e, ei) => {
      if (base || !e.material_key || e.ist_fliesstext || e.natur === 'ueberschrift') return;
      base = { cid: cidOf(s.id, ri, si, ei), name: e.anzeige_text, sid: s.id };
    }))));
    return { s1: s1.id, s2: s2.id, base };
  });
  r.check('Testdaten vorhanden (2 Standards + Basis-Eintrag)', !!(ctx.s2 && ctx.base));

  // B1) Eigener Eintrag wird ECHT verschoben
  const b1 = await A.page.evaluate((c) => {
    const key = c.s1 + '|0';
    (ADDITIONS.entries[key] = ADDITIONS.entries[key] || []).push(makeAddEntry({ aid: newAid(), name: 'MoveMe-Eigen', menge: '1x', nat: 'material' }));
    saveAdditions(); rebuildDB();
    let cid = null;
    DB.standards.forEach(s => (s.rubriken || []).forEach((rub, ri) => (rub.sub_bereiche || []).forEach((sb, si) => (sb.eintraege || []).forEach((e, ei) => {
      if (e._added && e.anzeige_text === 'MoveMe-Eigen') cid = cidOf(s.id, ri, si, ei);
    }))));
    if (!cid) return { fail: 'cid' };
    openSheet(cid); moveEntryTo(c.s2, 0);
    const oldGone = !(ADDITIONS.entries[c.s1 + '|0'] || []).some(x => x.anzeige_text === 'MoveMe-Eigen');
    const atTarget = (ADDITIONS.entries[c.s2 + '|0'] || []).some(x => x.anzeige_text === 'MoveMe-Eigen');
    return { oldGone, atTarget };
  }, ctx);
  r.check('B: eigener Eintrag ist am alten Ort weg', b1.oldGone === true);
  r.check('B: … und liegt echt am Ziel (anderer Standard)', b1.atTarget === true);

  // B2) Basis-Eintrag: Kopie am Ziel + Original ausgeblendet
  const b2 = await A.page.evaluate((c) => {
    openSheet(c.base.cid); moveEntryTo(c.s2, 0);
    const copy = (ADDITIONS.entries[c.s2 + '|0'] || []).some(x => x.anzeige_text === c.base.name);
    const hidden = qeGet(findEntry(c.base.cid), c.base.cid, 'hidden') === true;
    const journaled = rulesActive(RULES).some(x => x.prop === 'hidden' && x.wo.art === 'stelle' && x.wo.wert === c.base.cid);
    const inPanel = collectHidden().byCid.some(x => x.cid === c.base.cid);
    return { copy, hidden, journaled, inPanel };
  }, ctx);
  r.check('B: Basis-Eintrag — Kopie liegt am Ziel', b2.copy);
  r.check('B: … Original ausgeblendet (journaliert)', b2.hidden && b2.journaled);
  r.check('B: … und im Panel „Ausgeblendete Einträge" rücknehmbar', b2.inPanel);

  // D) Eigene Felder als Regel + Badge
  const d = await A.page.evaluate((c) => {
    let cid = null; // frischer Material-Eintrag (nicht der verschobene)
    DB.standards.forEach(s => (s.rubriken || []).forEach((rub, ri) => (rub.sub_bereiche || []).forEach((sb, si) => (sb.eintraege || []).forEach((e, ei) => {
      const k = cidOf(s.id, ri, si, ei);
      if (!cid && e.material_key && e.natur !== 'ueberschrift' && k !== c.base.cid) cid = k;
    }))));
    openSheet(cid); renderSheetZusatz();
    document.getElementById('zfName').value = 'Schrank';
    document.getElementById('zfWert').value = 'B3';
    sheetZusatzAdd(); applyPending('cid');
    const eff = qeGet(findEntry(cid), cid, 'zusatz');
    const ok = Array.isArray(eff) && eff.some(f => f.n === 'Schrank' && f.w === 'B3');
    const card = entryCardHTML(findEntry(cid), cid, true);
    const badge = card.indexOf('Schrank: B3') >= 0;
    const journaled = rulesActive(RULES).some(x => x.prop === 'zusatz');
    // Entfernen über dasselbe Sheet
    openSheet(cid); renderSheetZusatz(); sheetZusatzDel(0); applyPending('cid');
    const gone = !(qeGet(findEntry(cid), cid, 'zusatz') || []).length;
    return { ok, badge, journaled, gone };
  }, ctx);
  r.check('D: eigenes Feld wirkt (qeGet zusatz)', d.ok);
  r.check('D: … erscheint als Badge auf der Eintragskarte', d.badge);
  r.check('D: … ist als Regel journaliert', d.journaled);
  r.check('D: Feld wieder entfernbar', d.gone);

  // C) Neue Unterkategorie direkt im Prüf-Workflow-Select
  const cRes = await A.page.evaluate(() => {
    setMode('admin');
    const x = collectUncertain().find(y => y.e.material_key);
    if (!x) return { none: true };
    admUkChange(x.cid, { value: '__neu__' });
    const inp = document.getElementById('admUkNewInp');
    if (!inp) return { opened: false };
    inp.value = 'SouveraenUK';
    admUkNewSave(x.cid);
    return { opened: true, applied: canonUk(findEntry(x.cid), x.cid) === 'SouveraenUK' };
  });
  if (!cRes.none) {
    r.check('C: „＋ Neue Unterkategorie…" öffnet Eingabezeile im Prüf-Workflow', cRes.opened);
    r.check('C: neue Unterkategorie wird zugewiesen', cRes.applied);
  }

  // C2) Datalist für Gruppe im Standard-Formular
  const c2 = await A.page.evaluate(() => {
    openStandardForm(null);
    const dl = document.getElementById('grpList');
    const ok = !!dl && dl.children.length > 0;
    closeForm();
    return ok;
  });
  r.check('C: Gruppen-Datalist im Standard-Formular (wählen oder frei tippen)', c2);

  // A) Inhalte-&-Aufbau-Panel: Baum + ＋ Eintrag aus dem Panel
  const a = await A.page.evaluate((c) => {
    setMode('admin'); admContSid = null; renderAdmin();
    const top = document.body.textContent.indexOf('Inhalte & Aufbau') >= 0;
    admContSid = c.s1; renderAdmin();
    const drill = [...document.querySelectorAll('#scr-admin .uk-actions button')].some(b => b.textContent.indexOf('＋ Eintrag') >= 0);
    admContAddEntry(0);
    const formOpen = !!document.getElementById('fName');
    closeForm(); admContSid = null;
    return { top, drill, formOpen };
  }, ctx);
  r.check('A: Panel „Inhalte & Aufbau" vorhanden', a.top);
  r.check('A: Drill-down zeigt Rubriken mit „＋ Eintrag"', a.drill);
  r.check('A: „＋ Eintrag" öffnet das Eintrags-Formular direkt aus der Verwaltung', a.formOpen);

  r.check('keine Konsolenfehler', A.errs.length === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
