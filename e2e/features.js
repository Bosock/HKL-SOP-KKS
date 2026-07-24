/* END-TO-END: die vier neuen Bausteine im echten Browser.
     A) Anleitungen  – Umschalter, anlegen, Schritte, abhaken, Foto-Zoom
     B) Pop-ups      – visuell konfiguriert, löst beim Abhaken aus, Pflichtfeld,
                       Aktion „Häkchen wieder entfernen"
     C) Varianten    – Arzt anlegen, Abweichung setzen, Anzeige + Ausblenden
     D) Suche        – Ergebnisse nach Typ getrennt (Standards/Anleitungen/Material)
   Kein Mock: alles läuft gegen die echte App unter dem echten Server. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('features');
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);

  // ─────────── A) Anleitungen ───────────
  const guide = await A.page.evaluate(() => {
    doLogin('1234567');
    setSeg('anleitung');
    const segShown = !!document.querySelector('.segbar .seg-btn.on');
    guideNew();                                   // legt an + öffnet Editor
    const g = GUIDES[GUIDES.length - 1];
    document.getElementById('gTitel').value = 'Rhythmia-Anlage aufbauen';
    document.getElementById('gKurz').value = 'Aufbau im Saal';
    guideAddStep(); guideAddStep();
    const boxes = document.querySelectorAll('#gSteps .gedit-step');
    boxes[0].querySelector('.ges-text').value = 'Konsole einschalten';
    boxes[0].querySelector('.ges-warn').value = 'Erst Netzstecker prüfen';
    boxes[1].querySelector('.ges-text').value = 'Patientenkabel anschließen';
    guideSaveForm();
    const saved = guideById(g.id);
    // Detailansicht: Schritte da? Abhaken?
    const stepEls = document.querySelectorAll('#scr-guide .g-step').length;
    const cid = guideCid(saved.id, saved.schritte[0].id);
    toggleGuideCheck(cid);
    return { segShown, id: saved.id, titel: saved.titel, steps: saved.schritte.length,
      warn: saved.schritte[0].warn, stepEls, checked: !!checks[cid],
      progress: guideProgress(saved) };
  });
  r.check('Anleitungen: Bereichs-Umschalter vorhanden', guide.segShown === true);
  r.check('Anleitung angelegt und gespeichert', guide.titel === 'Rhythmia-Anlage aufbauen');
  r.check('Zwei Schritte gespeichert (inkl. Warnung)', guide.steps === 2 && /Netzstecker/.test(guide.warn || ''));
  r.check('Detailansicht zeigt die Schritte', guide.stepEls === 2);
  r.check('Schritt abhakbar (Live-Checkliste)', guide.checked === true && guide.progress.done === 1);

  // Foto-Zoom: Lightbox öffnet sich mit einem Bild
  const lb = await A.page.evaluate(() => {
    openLightbox('data:image/gif;base64,R0lGODlhAQABAAAAACw=', 'Testbild');
    const el = document.getElementById('lightbox');
    const shown = el && el.classList.contains('show');
    const cap = document.getElementById('lbCap').textContent;
    closeLightbox();
    return { shown: !!shown, cap, closed: !el.classList.contains('show') };
  });
  r.check('Foto-Detailansicht öffnet (Lightbox) …', lb.shown === true && lb.cap === 'Testbild');
  r.check('… und schließt wieder', lb.closed === true);

  // ─────────── B) Pop-ups ───────────
  const pop = await A.page.evaluate(() => {
    // Pop-up rein über die Konfigurations-Oberfläche anlegen
    openPopupAdmin(); popupNew();
    const p = POPUPS[POPUPS.length - 1];
    document.getElementById('ppName').value = 'ACT-Wert abfragen';
    document.getElementById('ppEreignis').value = 'check';
    document.getElementById('ppZielTyp').value = 'text';
    document.getElementById('ppZielWert').value = 'ACT';
    document.getElementById('ppTitel').value = 'ACT-Wert dokumentieren';
    document.getElementById('ppAbAktion').value = 'haken-entfernen';
    popupAddField();                                   // ein eigenes Feld
    const row = document.querySelector('#ppFelder .pf-row');
    row.querySelector('.pf-label').value = 'ACT-Wert (Sek.)';
    row.querySelector('.pf-pflicht').checked = true;
    popupSaveForm();
    const saved = popupById(p.id);

    // Auslösen: Kontext wie beim Abhaken eines Eintrags namens „ACT bestimmen"
    popupFire({ ereignis: 'check', titel: 'ACT bestimmen', cid: 'test|cid', quelle: 'standard' });
    checks['test|cid'] = true;                          // simulierter Haken
    const shown = document.getElementById('popupOv').classList.contains('show');
    const titleShown = document.querySelector('#popupBox .pop-head').textContent;
    // Pflichtfeld leer → Bestätigen darf NICHT durchgehen
    popupAnswer(true);
    const stillOpen = document.getElementById('popupOv').classList.contains('show');
    // Ablehnen → konfigurierte Aktion „Häkchen wieder entfernen"
    popupAnswer(false);
    const closed = !document.getElementById('popupOv').classList.contains('show');
    return { name: saved.name, felder: saved.felder.length, pflicht: saved.felder[0].pflicht,
      shown, titleShown, stillOpen, closed, hakenWeg: !checks['test|cid'], log: POPUP_LOG.length };
  });
  r.check('Pop-up visuell konfiguriert (Name/Feld/Pflicht)', pop.name === 'ACT-Wert abfragen' && pop.felder === 1 && pop.pflicht === true);
  r.check('Pop-up löst beim passenden Text aus', pop.shown === true && /ACT-Wert dokumentieren/.test(pop.titleShown));
  r.check('Pflichtfeld verhindert das Bestätigen', pop.stillOpen === true);
  r.check('Ablehnen führt die konfigurierte Aktion aus (Häkchen entfernt)', pop.closed === true && pop.hakenWeg === true);
  r.check('Antwort wird protokolliert', pop.log > 0);

  // ─────────── C) Arzt-Varianten ───────────
  const vari = await A.page.evaluate(() => {
    const sid = DB.standards[0].id;
    openStandard(sid);
    // Arzt anlegen
    openVariantAdmin();
    document.getElementById('varNewName').value = 'Dr. Tscheban';
    varAdd();
    const arzt = VARIANTS.aerzte[VARIANTS.aerzte.length - 1];
    // Abweichung setzen: ersten Eintrag der ersten Rubrik umbenennen
    const s = DB.standards.find(x => x.id === sid);
    let cid = null, basisName = null;
    (s.rubriken || []).some((rub, ri) => (rub.sub_bereiche || []).some((sb, si) =>
      (sb.eintraege || []).some((e, ei) => {
        if (e.natur === 'ueberschrift' || e.ist_fliesstext) return false;
        cid = cidOf(s.id, ri, si, ei); basisName = e.anzeige_text; return true; })));
    varBucket(arzt.id).qe[cid] = { name: 'Spezial-Naht (Tscheban)', hinweis: 'bevorzugt 2-0' };
    saveVariants();
    setVariant(arzt.id);
    const aktiv = varActive();
    const geaendert = varChanged(cid);
    const angezeigt = varGet(cid, 'name');
    const diff = varDiffCount(arzt.id, sid);
    // Ausblenden testen
    varBucket(arzt.id).hidden[cid] = true; saveVariants();
    const versteckt = varHidden(cid);
    delete varBucket(arzt.id).hidden[cid]; saveVariants();
    setVariant('');                                   // zurück auf Standard
    const zurueck = varGet(cid, 'name');
    return { arzt: arzt.name, kurz: arzt.kurz, aktiv: aktiv && aktiv.name, geaendert,
      angezeigt, basisName, diff, versteckt, zurueck };
  });
  r.check('Arzt angelegt (mit Kürzel)', vari.arzt === 'Dr. Tscheban' && vari.kurz === 'TSC');
  r.check('Variante aktiv und Abweichung erkannt', vari.aktiv === 'Dr. Tscheban' && vari.geaendert === true);
  r.check('Variante überschreibt den Eintragstext', vari.angezeigt === 'Spezial-Naht (Tscheban)' && vari.angezeigt !== vari.basisName);
  r.check('Abweichungen werden gezählt', vari.diff >= 1);
  r.check('Variante kann Einträge ausblenden', vari.versteckt === true);
  r.check('Zurück auf „Standard" zeigt wieder das Original', vari.zurueck === undefined);

  // ─────────── D) Suche mit Typ-Trennern ───────────
  const search = await A.page.evaluate(() => {
    openGlobalSearch('Rhythmia');
    const sects = [...document.querySelectorAll('#gSearchResults .gs-sect .gs-sect-t')].map(e => e.textContent);
    const guideHit = !!document.querySelector('#gSearchResults .srch-hit[data-gid]');
    // Material-Sektion: Stammsatz anlegen und erneut suchen
    GTINDB['m:such'] = { gtin: 'm:such', manual: true, name: 'IntellaNav StablePoint', hersteller: 'Boston', ref: 'M004' };
    saveGtinDB();
    globalSearch('IntellaNav');
    const sects2 = [...document.querySelectorAll('#gSearchResults .gs-sect .gs-sect-t')].map(e => e.textContent);
    const matHit = !!document.querySelector('#gSearchResults .srch-hit[data-g]');
    return { sects, guideHit, sects2, matHit };
  });
  r.check('Suche trennt nach Typ mit großen Abschnitten', search.sects.includes('Anleitungen'));
  r.check('Anleitung erscheint als eigener Treffer', search.guideHit === true);
  r.check('Material-Stammsätze bekommen eine eigene Sektion', search.sects2.includes('Material') && search.matHit === true);

  r.check('keine Konsolen-/Seitenfehler', A.errs.filter(e => !/favicon/i.test(e)).length === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
