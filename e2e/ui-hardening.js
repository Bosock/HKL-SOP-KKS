/* UI-Härtung: Apostrophe in Freitext-Namen (Gruppe, Unterkategorie) dürfen
   nichts zerbrechen; Foto-Verkleinerung; Druck-Export ohne Steuerzeichen. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('ui-hardening');
  const srv = await startServer();
  const browser = await launchBrowser();
  const { page, errs } = await bootPage(browser, srv.base, { dialogText: '🔧' });

  const res = await page.evaluate(async () => {
    const out = {};
    doLogin('1234567');

    // Fixtures mit Apostroph: Gruppe + Unterkategorie
    const s0 = DB.standards[0];
    STDE[s0.id] = Object.assign({}, STDE[s0.id], { gruppe: "L'Apostroph" }); saveSTDE();
    let cid = null, e = null, ri = -1, sid = null;
    outer:
    for (const s of DB.standards) for (let i = 0; i < (s.rubriken || []).length; i++) {
      const rub = s.rubriken[i]; if (rub.typ !== 'material' && rub.typ !== 'geraete') continue;
      for (let si = 0; si < (rub.sub_bereiche || []).length; si++)
        for (let ei = 0; ei < (rub.sub_bereiche[si].eintraege || []).length; ei++) {
          const en = rub.sub_bereiche[si].eintraege[ei];
          if (en.natur !== 'ueberschrift' && !en.ist_fliesstext) { cid = cidOf(s.id, i, si, ei); e = en; ri = i; sid = s.id; break outer; }
        }
    }
    reassign[cid] = "O'Brien-Schrank"; saveJSON('hkl_reassign', reassign);

    // 1) Verwaltung rendert + Gruppen-Pfeil (Index-basiert) funktioniert
    setMode('admin');
    out.adminRendered = /Verwaltung/.test(document.getElementById('scr-admin').innerHTML);
    const before = distinctGroups().join('|');
    const arrow = [...document.querySelectorAll('#scr-admin .uk-actions .icon')].find(b => b.textContent === '▼');
    if (arrow) arrow.click();
    out.groupMoveWorks = distinctGroups().length < 2 || distinctGroups().join('|') !== before;

    // 2) Schnellmenü-UK-Picker mit Apostroph-UK (Index-basiert)
    openStandard(sid, true); openRubrik(ri);
    openSheet(cid); renderSheetUk();
    const btn = [...document.getElementById('sheet').querySelectorAll('.sheet-pick-btn')].find(b => b.textContent.indexOf("O'Brien-Schrank") >= 0);
    out.ukBtnFound = !!btn;
    if (btn) { btn.click();
      const scope = [...document.getElementById('sheet').querySelectorAll('.sheet-pick-btn')].find(b => b.textContent.indexOf('Nur hier') >= 0);
      if (scope) scope.click();
      out.ukApplied = canonUk(e, cid) === "O'Brien-Schrank"; }

    // 3) Zu-/Aufklappen der Apostroph-UK (data-Attribut statt Inline-Literal)
    openRubrik(ri, true);
    const head = [...document.querySelectorAll('#scr-detail .uksec-head')].find(h => h.textContent.indexOf("O'Brien") >= 0);
    out.ukSectionFound = !!head;
    if (head) { const was = head.parentElement.classList.contains('collapsed'); head.click();
      const head2 = [...document.querySelectorAll('#scr-detail .uksec-head')].find(h => h.textContent.indexOf("O'Brien") >= 0);
      out.ukToggled = head2 && head2.parentElement.classList.contains('collapsed') !== was; }

    // 4) Foto-Verkleinerung (Neuaufnahme-Pfad)
    const c = document.createElement('canvas'); c.width = 2000; c.height = 1500;
    const g = c.getContext('2d'); g.fillStyle = '#3d9be0'; g.fillRect(0, 0, 2000, 1500);
    const big = c.toDataURL('image/png');
    const small = await new Promise(res2 => shrinkPhoto(big, res2));
    const dim = await new Promise(res2 => { const im = new Image(); im.onload = () => res2(Math.max(im.width, im.height)); im.src = small; });
    out.photoShrunk = small.length < big.length && small.indexOf('data:image/jpeg') === 0 && dim <= 1280;

    // 5) Druck-Export: Dokument entsteht, keine Steuerzeichen im Markup
    window.print = () => {};
    openStandard(sid, true); printStandard();
    const pr = document.getElementById('printRoot').innerHTML;
    out.printOk = /pr-doc/.test(pr) && /pr-row/.test(pr) && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(pr);
    window.dispatchEvent(new Event('afterprint'));
    return out;
  });

  r.check('Verwaltung rendert mit Apostroph-Gruppe', res.adminRendered);
  r.check('Gruppen-Verschieben (Index) funktioniert', res.groupMoveWorks);
  r.check("UK-Picker findet O'Brien-Schrank", res.ukBtnFound);
  r.check('UK-Zuweisung greift', res.ukApplied);
  r.check('UK-Abschnitt rendert', res.ukSectionFound);
  r.check('UK auf-/zuklappen (data-Attribut) funktioniert', res.ukToggled);
  r.check('Foto wird verkleinert (JPEG, ≤1280px)', res.photoShrunk);
  r.check('Druck-HTML sauber (keine Steuerzeichen)', res.printOk);
  r.check('keine Konsolenfehler', errs.length === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
