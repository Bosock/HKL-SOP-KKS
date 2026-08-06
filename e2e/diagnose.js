/* END-TO-END: Fehler- und Problemanalyse — und die Regression, die sie
   aufgedeckt hat.

   Der Anlass: Anleitungen ließen sich auf dem HANDY nicht öffnen. Am
   Schreibtisch (Maus) funktionierte alles — deshalb fiel es keinem Test auf.
   Ursache: Der Halte-Detektor der Übersicht kannte nur `data-sid`
   (Standards). Bei einer Anleitungs-Zeile (`data-gid`) konnte er nichts tun,
   unterdrückte den Tipp aber trotzdem — der Browser feuerte dann kein
   `click`, und das Inline-onclick der Zeile kam nie zum Zug.

   Diese Suite prüft daher BEIDE Eingabewege getrennt (Touch UND Maus) und
   danach die Diagnose-Werkzeuge, die solche Fälle künftig sichtbar machen. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

/* Tippen wie auf einem Touchgerät — nicht wie mit der Maus. Genau dieser
   Unterschied war der blinde Fleck. */
const TIPP = `(el) => {
  const t = (typ) => { const ev = new TouchEvent(typ, { bubbles:true, cancelable:true,
      touches: typ==='touchend' ? [] : [new Touch({identifier:1,target:el,clientX:50,clientY:50})],
      changedTouches: [new Touch({identifier:1,target:el,clientX:50,clientY:50})] });
    el.dispatchEvent(ev); return ev; };
  t('touchstart'); const ende = t('touchend');
  /* Der Browser feuert click nur, wenn touchend NICHT unterdrückt wurde. */
  if (!ende.defaultPrevented) el.click();
  return ende.defaultPrevented;
}`;

(async () => {
  const r = reporter('diagnose');
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);

  // ─────────── Regression: Anleitung per FINGER öffnen ───────────
  const touch = await A.page.evaluate((tippSrc) => {
    const tipp = eval('(' + tippSrc + ')');
    doLogin('1234567');
    GUIDES = [{ id: 'g1', titel: 'ACT-Gerät: Chargennummer eingeben', bereich: 'Geräte',
      schritte: [{ id: 's1', text: 'Menü öffnen' }, { id: 's2', text: 'Charge eintippen' }] }];
    saveGuides();
    curSeg = 'anleitung'; renderStandards(''); show('scr-standards');
    const row = document.querySelector('#scr-standards .std[data-gid]');
    if (!row) return { keineZeile: true };
    tipp(row);
    return { keineZeile: false,
      screen: (document.querySelector('.screen.active') || {}).id,
      offen: (typeof curGuide !== 'undefined' && !!curGuide) ? curGuide.id : null,
      schritteSichtbar: document.querySelectorAll('#scr-guide .g-step').length };
  }, TIPP);
  if (touch.keineZeile) { r.fail('Anleitungs-Zeile in der Übersicht (nicht gefunden)'); }
  else {
    r.check('Anleitung lässt sich mit dem FINGER öffnen', touch.screen === 'scr-guide' && touch.offen === 'g1');
    r.check('… und zeigt ihre Schritte', touch.schritteSichtbar === 2);
  }

  // Kurz warten: Nach einer Berührung ignoriert die App Mausereignisse für
  // 700 ms (Geisterklick-Schutz auf Touchgeräten, siehe ghostMouse()). Ohne
  // diese Pause würde der Maus-Test genau daran scheitern — und zwar zu Recht.
  await new Promise(res => setTimeout(res, 800));

  // ─────────── Derselbe Weg mit der Maus — genau EINMAL ───────────
  // Eine echte Maus sendet mousedown → mouseup → click. Anleitungen und
  // Standards laufen beide über den Halte-Detektor und müssen sich hier
  // gleich verhalten; ein zusätzliches Inline-onclick würde die Anleitung
  // doppelt öffnen.
  const maus = await A.page.evaluate(() => {
    const klick = (el) => ['mousedown', 'mouseup', 'click'].forEach(typ =>
      el.dispatchEvent(new MouseEvent(typ, { bubbles: true, cancelable: true, clientX: 50, clientY: 50 })));
    curSeg = 'anleitung'; renderStandards(''); show('scr-standards');
    let n = 0; const orig = window.openGuide;
    window.openGuide = function () { n++; return orig.apply(this, arguments); };
    klick(document.querySelector('#scr-standards .std[data-gid]'));
    window.openGuide = orig;
    const nachAnleitung = (document.querySelector('.screen.active') || {}).id;
    // Gegenprobe: Standards verhalten sich identisch.
    setMode('use'); curSeg = 'standard'; renderStandards(''); show('scr-standards');
    klick(document.querySelector('#scr-standards .std[data-sid]'));
    return { n, nachAnleitung, nachStandard: (document.querySelector('.screen.active') || {}).id };
  });
  r.check('Maus-Klick öffnet die Anleitung ebenfalls', maus.nachAnleitung === 'scr-guide');
  r.check('… und zwar genau einmal (kein doppelter Weg)', maus.n === 1);
  r.check('Anleitungen und Standards verhalten sich gleich', maus.nachStandard === 'scr-rubriken');

  // ─────────── Standards dürfen davon unberührt bleiben ───────────
  const std = await A.page.evaluate((tippSrc) => {
    const tipp = eval('(' + tippSrc + ')');
    curSeg = 'standard'; renderStandards(''); show('scr-standards');
    const row = document.querySelector('#scr-standards .std[data-sid]');
    if (!row) return { keineZeile: true };
    const verhindert = tipp(row);
    return { keineZeile: false, verhindert,
      screen: (document.querySelector('.screen.active') || {}).id };
  }, TIPP);
  if (std.keineZeile) { r.fail('Standard-Zeile (nicht gefunden)'); }
  else {
    r.check('Standard öffnet sich per Finger weiterhin', std.screen === 'scr-rubriken');
    r.check('… und der Halte-Detektor beansprucht den Tipp (kein Geisterklick)', std.verhindert === true);
  }

  // ─────────── Schalter INNERHALB einer Zeile (dieselbe Fehlerklasse) ───────────
  // Ein Schalter in einer Zeile (⭐ Favorit, 🧬 Material) muss vom
  // Halte-Detektor ausgenommen sein. Sonst beansprucht dieser den Tipp auf der
  // ganzen Zeile — der Schalter tut nichts, und stattdessen passiert das, was
  // die Zeile tut (öffnen bzw. abhaken).
  const schalter = await A.page.evaluate((tippSrc) => {
    const tipp = eval('(' + tippSrc + ')');
    doLogin('1234567');
    // a) ⭐ in der Übersicht darf NICHT öffnen
    setMode('use'); curSeg = 'standard'; curSort = 'alpha';
    FAV = {}; saveFav(); renderStandards(''); show('scr-standards');
    const row = document.querySelector('#scr-standards .std[data-sid]');
    const sid = row.dataset.sid;
    tipp(row.querySelector('.fav-btn'));
    const stern = { fav: !!FAV[sid], screen: (document.querySelector('.screen.active') || {}).id };

    // b) der Material-Schalter am Eintrag darf NICHT abhaken
    let link = { uebersprungen: true };
    setMode('use');
    const std = DB.standards.find(s => (s.rubriken || []).some(rb =>
      (rb.sub_bereiche || []).some(sb => (sb.eintraege || []).some(e => e.material_key))));
    if (std) {
      openStandard(std.id);
      const ri = std.rubriken.findIndex(rb => (rb.sub_bereiche || []).some(sb =>
        (sb.eintraege || []).some(e => e.material_key)));
      openRubrik(ri);
      // ein zugeordnetes Material erzwingen, damit der Schalter erscheint
      const zeile = document.querySelector('#scr-detail .entry-row[data-cid]');
      if (zeile) {
        const e = findEntry(zeile.dataset.cid);
        if (e && e.material_key) {
          GTINDB['m:linktest'] = { gtin: 'm:linktest', manual: true, name: 'Linktest' };
          saveGtinDB(); matLinkTo(e.material_key, 'm:linktest'); buildMaterialIndex(); openRubrik(ri);
        }
      }
      const btn = document.querySelector('#scr-detail .entry-canon-btn');
      if (btn) {
        const cid = btn.closest('.entry-row').dataset.cid;
        checks = {}; saveChecks();
        tipp(btn);
        link = { uebersprungen: false, abgehakt: !!checks[cid],
          screen: (document.querySelector('.screen.active') || {}).id };
      }
    }
    return { stern, link };
  }, TIPP);
  r.check('⭐ in der Zeile schaltet den Favoriten, statt zu öffnen',
    schalter.stern.fav === true && schalter.stern.screen === 'scr-standards');
  if (schalter.link.uebersprungen) { r.fail('Material-Schalter am Eintrag (kein zugeordnetes Material gefunden)'); }
  else {
    r.check('der Material-Schalter am Eintrag hakt NICHT versehentlich ab', schalter.link.abgehakt === false);
    r.check('… sondern öffnet den Produkt-Stammsatz', schalter.link.screen === 'scr-scan-item');
  }

  // ─────────── Selbsttest erkennt „Zeile ohne Weg hinein" ───────────
  const test = await A.page.evaluate(() => {
    setMode('use');
    const NAME = 'Übersichtszeilen sind bedienbar';
    const vorher = diagChecks().find(c => c.titel === NAME);
    // Genau den behobenen Fehler nachstellen: Zeile mit unbekanntem Attribut.
    document.getElementById('scr-standards').insertAdjacentHTML('beforeend',
      '<div class="std" data-xyz="unbekannt"><div class="std-main">Zeile ohne Weg hinein</div></div>');
    const nachher = diagChecks().find(c => c.titel === NAME);
    renderStandards(''); // aufräumen
    return { vorherOk: vorher.ok, nachherOk: nachher.ok, info: nachher.info,
      hilfe: !!nachher.hilfe, anzahl: diagChecks().length };
  });
  r.check('Selbsttest läuft und ist grün, wenn alles stimmt', test.vorherOk === true && test.anzahl >= 8);
  r.check('Selbsttest ENTDECKT eine unerreichbare Zeile', test.nachherOk === false && /ohne Handler/.test(test.info));
  r.check('… und erklärt, was das bedeutet', test.hilfe === true);

  // ─────────── Technische Fehler landen automatisch im Protokoll ───────────
  const auto = await A.page.evaluate(async () => {
    DIAG = []; saveJSON('hkl_diag', DIAG);
    // 1) Fehlermeldung der App (roter Toast)
    toast('Bitte eine gültige GTIN (Barcode-Nummer) angeben.', true);
    // 2) echter, unbehandelter JavaScript-Fehler
    window.dispatchEvent(new ErrorEvent('error', { message: 'Testfehler: x is not defined',
      filename: '/js/features/test.js', lineno: 42, error: new Error('Testfehler') }));
    // 3) Fehlerschauer — darf das Protokoll nicht fluten
    for (let i = 0; i < 200; i++) toast('Immer derselbe Fehler', true);
    const schauer = DIAG.find(e => e.text === 'Immer derselbe Fehler');
    return { anzahl: DIAG.length, arten: DIAG.map(e => e.art),
      hatToast: DIAG.some(e => /GTIN/.test(e.text)),
      hatJsFehler: DIAG.some(e => e.art === 'fehler' && /Testfehler/.test(e.text)),
      schauerN: schauer && schauer.n, hatWo: !!(DIAG[0] && DIAG[0].wo) };
  });
  r.check('Fehler-Meldungen der App werden protokolliert', auto.hatToast === true);
  r.check('Unbehandelte JavaScript-Fehler werden protokolliert', auto.hatJsFehler === true);
  r.check('200 gleiche Fehler ergeben EINEN Eintrag mit Zähler', auto.schauerN === 200 && auto.anzahl <= 5);
  r.check('Jeder Eintrag weiß, wo er passiert ist', auto.hatWo === true);

  // ─────────── Der gefühlte Fehler: „Problem melden" ───────────
  const melden = await A.page.evaluate(() => {
    DIAG = []; saveJSON('hkl_diag', DIAG);
    setMode('use'); curSeg = 'anleitung'; renderStandards(''); show('scr-standards');
    diagMeldenForm();
    const offen = !!document.querySelector('#diagSheet.show');
    document.getElementById('diagWunsch').value = 'eine Anleitung öffnen';
    document.getElementById('diagWas').value = 'nichts passiert, sie geht nicht auf';
    diagMeldenSave();
    const e = DIAG[0] || {};
    return { offen, zu: !document.querySelector('#diagSheet.show'),
      art: e.art, text: e.text, wunsch: e.wunsch, wo: e.wo, weg: e.weg, geraet: e.geraet };
  });
  r.check('„Problem melden" öffnet und schließt sich', melden.offen && melden.zu);
  r.check('Die Meldung landet als eigener Eintragstyp', melden.art === 'meldung');
  r.check('Absicht und Beobachtung werden getrennt festgehalten',
    /nichts passiert/.test(melden.text || '') && /Anleitung öffnen/.test(melden.wunsch || ''));
  r.check('Der technische Zusammenhang hängt automatisch dran (Bildschirm · Weg · Gerät)',
    !!melden.wo && !!melden.weg && !!melden.geraet);

  // ─────────── Melden geht auch OHNE Anmeldung ───────────
  const ohneLogin = await A.page.evaluate(() => {
    adminLogout();
    const menue = (function () { openMenu(); const h = document.getElementById('sheet').innerHTML; showSheet(false); return h; })();
    return { melden: /Problem melden/.test(menue), diagnose: /Diagnose &amp; Fehler|Diagnose & Fehler/.test(menue) };
  });
  r.check('Jeder darf ein Problem melden (auch ohne Anmeldung)', ohneLogin.melden === true);
  r.check('Das Protokoll selbst sieht nur die Verwaltung', ohneLogin.diagnose === false);

  // ─────────── Bericht zum Kopieren ───────────
  const bericht = await A.page.evaluate(() => {
    doLogin('1234567');
    openDiag();
    const txt = diagBerichtText(diagBerichtDaten());
    return { txt, screen: (document.querySelector('.screen.active') || {}).id,
      reiter: document.querySelectorAll('#scr-diag .mc-tab').length };
  });
  r.check('Diagnose-Bildschirm mit zwei Registern', bericht.screen === 'scr-diag' && bericht.reiter === 2);
  r.check('Bericht nennt Selbsttest, Gerät und Befunde',
    /SELBSTTEST:/.test(bericht.txt) && /Gerät:/.test(bericht.txt) && /PROTOKOLL/.test(bericht.txt));
  r.check('Bericht ist kurz genug zum Verschicken (< 20 000 Zeichen)', bericht.txt.length < 20000);

  // ─────────── Das Protokoll erreicht alle Geräte ───────────
  const geteilt = await A.page.evaluate(() => ({
    inSync: SHARED_KEYS.includes('hkl_diag'),
    nichtImBackup: !BACKUP_KEYS.includes('hkl_diag'),
  }));
  r.check('Meldungen laufen geräteübergreifend an einem Ort zusammen', geteilt.inSync === true);
  r.check('Ein Backup spielt keine alten Fehlerprotokolle zurück', geteilt.nichtImBackup === true);

  r.check('keine Konsolen-/Seitenfehler', A.errs.filter(e => !/favicon/i.test(e)).length === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
