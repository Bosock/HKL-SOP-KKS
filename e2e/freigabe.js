/* END-TO-END: FREIGABE MIT SIEGEL

   Der gefährlichste Satz der App war ein Freigabevermerk, der etwas bestätigt,
   das es so nicht mehr gibt. Geprüft wird deshalb genau das:

     1. Ohne Vermerk behauptet die App nichts.
     2. Freigeben zieht ein Siegel — der Standard gilt als freigegeben.
     3. Der Vermerk steht im Standard und ist AUCH OHNE ANMELDUNG sichtbar.
     4. Eine Änderung im Schnellmenü kippt die Freigabe sofort.
     5. Ein Baustein, der acht Standards anfasst, kippt sie auch.
     6. Die Ansicht sagt, WAS sich geändert hat, und springt zur Stelle.
     7. Erneut freigeben stellt die Gültigkeit her.
     8. Die Übersicht zeigt das Zeichen; die Verwaltung führt die Liste.
     9. Der Rückweg führt in den Standard. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('freigabe');
  const check = (l, c) => r.check(l, c);
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base, { dialogText: 'E2E-Prüferin' });

  const SID = await A.page.evaluate(() => DB.standards[0].id);

  // ═══════════ 1. Ohne Vermerk wird nichts behauptet ═══════════
  const leer = await A.page.evaluate((sid) => {
    setMode('use'); openStandard(sid);
    const s = DB.standards.find(x => x.id === sid);
    return { zustand: frgStatus(s), kopf: frgKopfHTML(s),
      imBild: !!document.querySelector('#scr-rubriken .frg-kopf') };
  }, SID);
  check('ohne Freigabe-Vermerk behauptet die App nichts',
    leer.zustand === 'ohne' && leer.kopf === '' && !leer.imBild);

  // ═══════════ 2./3. Freigeben — und zwar sichtbar für ALLE ═══════════
  const frei = await A.page.evaluate((sid) => {
    doLogin('1234567');
    frgFreigeben(sid, 'Frau Muster', '1.0');
    const s = DB.standards.find(x => x.id === sid);
    /* Abmelden: Die Zeile muss auch OHNE Verwaltungsrechte dastehen. */
    ADMIN = false;
    setMode('use'); openStandard(sid);
    const kopf = document.querySelector('#scr-rubriken .frg-kopf');
    const txt = kopf ? kopf.textContent : '';
    return { zustand: frgStatus(s), n: (STDE[sid].siegel || {}).n || 0,
      sichtbar: !!kopf, txt, klasse: kopf ? kopf.className : '' };
  }, SID);
  check(`Freigeben zieht ein Siegel über ${frei.n} Zeilen`, frei.zustand === 'gueltig' && frei.n > 10);
  check('… und der Vermerk steht im Standard — ohne Anmeldung', frei.sichtbar === true);
  check('… mit Version und Namen', /Freigegeben/.test(frei.txt) && /1\.0/.test(frei.txt) && /Frau Muster/.test(frei.txt));
  check('… und grün abgesetzt', /frg-gueltig/.test(frei.klasse));

  // ═══════════ 4. Eine Änderung kippt die Freigabe ═══════════
  const gekippt = await A.page.evaluate((sid) => {
    doLogin('1234567');
    const s = DB.standards.find(x => x.id === sid);
    /* Erste sichtbare Materialzeile über das Schnellmenü umbenennen. */
    let cid = null;
    (s.rubriken || []).forEach((rr, ri) => (rr.sub_bereiche || []).forEach((sb, si) =>
      (sb.eintraege || []).forEach((e, ei) => { if (!cid && e && !e.ist_fliesstext && e.natur !== 'ueberschrift') cid = cidOf(sid, ri, si, ei); })));
    (QE.cid[cid] = QE.cid[cid] || {}).name = 'E2E-Umbenannt';
    saveQE(); frgCacheLeeren();
    setMode('use'); openStandard(sid);
    const kopf = document.querySelector('#scr-rubriken .frg-kopf');
    return { cid, zustand: frgStatus(s), txt: kopf ? kopf.textContent : '',
      klasse: kopf ? kopf.className : '' };
  }, SID);
  check('eine Umbenennung kippt die Freigabe sofort', gekippt.zustand === 'ueberholt');
  check('… und der Standard sagt das im Kopf', /überholt/.test(gekippt.txt) && /frg-ueberholt/.test(gekippt.klasse));
  check('… und benennt den Umfang', /geänderte oder neue Zeile/.test(gekippt.txt));

  // ═══════════ 6. Was hat sich geändert? Und wo? ═══════════
  const ansicht = await A.page.evaluate((sid) => {
    openFreigabe(sid);
    const box = document.getElementById('scr-freigabe');
    const txt = box.textContent;
    const sprung = box.querySelector('.frg-diff.neu button');
    const cidSprung = sprung ? sprung.dataset.c : null;
    if (sprung) sprung.click();
    return { aktiv0: 'scr-freigabe', txt, cidSprung,
      nach: (document.querySelector('.screen.active') || {}).id,
      zeigtNeu: /geändert \/ neu/.test(txt), zeigtWeg: /entfernt/.test(txt),
      zeigtName: txt.includes('E2E-Umbenannt') };
  }, SID);
  check('die Freigabe-Ansicht listet die Unterschiede', ansicht.zeigtNeu && ansicht.zeigtWeg);
  check('… mit dem neuen Wortlaut', ansicht.zeigtName === true);
  check('… und „Zur Stelle" springt in den Standard', ansicht.nach === 'scr-detail');

  // ═══════════ 5. Ein Baustein kippt mehrere Standards auf einmal ═══════════
  const durchBaustein = await A.page.evaluate(() => {
    const k = bauVorschlaege()[0];
    if (!k) return { kein: true };
    /* Alle betroffenen Standards freigeben … */
    k.standards.forEach(sid => frgFreigeben(sid, 'E2E', '1.0'));
    frgCacheLeeren();
    const vorher = k.standards.filter(sid => frgStatus(DB.standards.find(s => s.id === sid)) === 'gueltig').length;
    /* … dann EINE Zeile im Baustein ändern. */
    const b = bauAnlegen('E2E-Baustein', k.zeilen, k.schluessel);
    bauZeileSetzen(b.id, 0, 'text', 'Vom Baustein geändert');
    frgCacheLeeren();
    const nachher = k.standards.filter(sid => frgStatus(DB.standards.find(s => s.id === sid)) === 'ueberholt').length;
    return { kein: false, betroffen: k.standards.length, vorher, nachher };
  });
  check(`ein Baustein greift in ${durchBaustein.betroffen} Standards …`,
    !durchBaustein.kein && durchBaustein.vorher === durchBaustein.betroffen);
  check('… und kippt dort JEDE Freigabe', durchBaustein.nachher === durchBaustein.betroffen);

  // ═══════════ 7. Erneut freigeben ═══════════
  const erneut = await A.page.evaluate((sid) => {
    openFreigabe(sid);
    const knopf = [...document.querySelectorAll('#scr-freigabe button')]
      .find(b => /freigeben/i.test(b.textContent) && !/zurück/i.test(b.textContent));
    if (knopf) knopf.click();          /* prompt → „E2E-Prüferin" (dialogText) */
    const s = DB.standards.find(x => x.id === sid);
    return { knopf: !!knopf, zustand: frgStatus(s), von: (STDE[sid] || {}).approvedBy };
  }, SID);
  check('erneut freigeben stellt die Gültigkeit her', erneut.knopf && erneut.zustand === 'gueltig');
  check('… und hält fest, wer freigegeben hat', erneut.von === 'E2E-Prüferin');

  // ═══════════ 8. Übersicht und Verwaltung ═══════════
  const uebersicht = await A.page.evaluate(() => {
    /* Einen anderen Standard überholt machen. */
    const sid = DB.standards[1].id;
    frgFreigeben(sid, 'X', '1.0');
    (QE.cid[cidOf(sid, 0, 0, 0)] = {}).name = 'Anders';
    saveQE(); frgCacheLeeren();
    setMode('use'); renderStandards('');
    const zeichen = document.querySelectorAll('#scr-standards .frg-badge').length;
    setMode('admin');
    const adm = document.getElementById('scr-admin').textContent;
    return { zeichen, panel: adm.includes('Freigaben'), bilanz: frgBilanz() };
  });
  check(`die Übersicht markiert die auffälligen Standards (${uebersicht.zeichen})`, uebersicht.zeichen > 0);
  check('die Verwaltung führt die Freigabe-Liste', uebersicht.panel === true);
  check(`… und zählt den Bestand (${uebersicht.bilanz.gueltig} gültig · ${uebersicht.bilanz.ueberholt} überholt)`,
    uebersicht.bilanz.gesamt === 47 && uebersicht.bilanz.ueberholt > 0);

  // ═══════════ 9. Rückweg ═══════════
  const zurueck = await A.page.evaluate((sid) => {
    openFreigabe(sid);
    const vor = (document.querySelector('.screen.active') || {}).id;
    goBack();
    return { vor, nach: (document.querySelector('.screen.active') || {}).id };
  }, SID);
  check('Zurück führt in den Standard', zurueck.vor === 'scr-freigabe' && zurueck.nach === 'scr-rubriken');

  check('keine Konsolenfehler', A.errs.length === 0);
  if (A.errs.length) console.log('   ', A.errs.slice(0, 4));

  await r.finish(browser, [srv]);
})();
