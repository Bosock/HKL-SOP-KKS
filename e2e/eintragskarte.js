/* END-TO-END: DIE EINTRAGSKARTE NACH DEN ANMERKUNGEN DES BETREIBERS

   Grundlage sind handschriftliche Anmerkungen auf einem Bildschirmauszug der
   Rubrik „Saal und Geräte“ („Die Anordnung muss besser sein — siehe Pfeile“).
   Sechs Änderungen und die restlose Entfernung des Einstufungs-Konzepts. Diese
   Prüfung hält jede einzelne fest, damit keine davon still zurückkommt:

     ① senkrecht mittig statt oben bündig
     ② kein Konfidenz-Warnzeichen mehr
     ③ kein Kategorie-Symbol mehr in der Zeile
     ④ Lagerort als einteiliger Banner RECHTS — und nur, wenn es ihn gibt
     ⑤ Kästchen mittig
     ⑥ Foto größer (48 px) und mittig

   Der Punkt, der am leichtesten zurückfällt, ist ④: Der frühere Platzhalter
   „kein Lagerort“ stand an jeder zweiten Zeile und kostete eine zweite Reihe,
   ohne etwas zu sagen. Deshalb wird hier BEIDES geprüft — dass er bei
   hinterlegtem Ort erscheint UND dass er sonst restlos fehlt. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('eintragskarte');
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);
  await A.page.evaluate(() => { doLogin('1234567'); });

  /* Eine Rubrik mit beschaffbarem Material öffnen. */
  const auf = await A.page.evaluate(() => {
    for (const s of DB.standards) {
      for (let ri = 0; ri < (s.rubriken || []).length; ri++) {
        const hat = (s.rubriken[ri].sub_bereiche || []).some(sb =>
          (sb.eintraege || []).some(e => e.material_key && natOf(effNatur(e, '')).beschaffbar !== false));
        if (hat) { openStandard(s.id, true); openRubrik(ri, true); return { sid: s.id, ri }; }
      }
    }
    return null;
  });
  r.check('Rubrik mit Material geöffnet', !!auf);

  /* ── ①⑤⑥ Anordnung und Maße ─────────────────────────────────── */
  const mass = await A.page.evaluate(() => {
    const row = document.querySelector('#scr-detail .entry-row');
    const chk = row.querySelector('.chk');
    const thumb = row.querySelector('.e-thumb');
    const cs = getComputedStyle(row);
    return {
      ausrichtung: cs.alignItems,
      chkOben: getComputedStyle(chk).marginTop,
      thumbBreite: thumb ? Math.round(thumb.getBoundingClientRect().width) : null,
      thumbHoehe: thumb ? Math.round(thumb.getBoundingClientRect().height) : null,
      /* Mittig heißt messbar: die Mitte des Kästchens liegt auf der Mitte der Zeile. */
      versatz: (() => {
        const a = chk.getBoundingClientRect(), b = row.getBoundingClientRect();
        return Math.abs((a.top + a.height / 2) - (b.top + b.height / 2));
      })(),
    };
  });
  r.check('① Zeile richtet senkrecht mittig aus', mass.ausrichtung === 'center');
  r.check('⑤ Kästchen sitzt mittig (Versatz ' + mass.versatz.toFixed(1) + ' px)', mass.versatz < 1.5);
  r.check('⑥ Foto misst 48 px', mass.thumbBreite === 48 && mass.thumbHoehe === 48);

  /* ── ②③ Was aus der Zeile verschwunden ist ───────────────────── */
  const weg = await A.page.evaluate(() => {
    const scr = document.getElementById('scr-detail');
    return {
      ico: scr.querySelectorAll('.e-ico').length,
      conf: scr.querySelectorAll('.conf').length,
      warnZeichen: (scr.innerHTML.match(/⚠/g) || []).length,
      platzhalter: /kein Lagerort/.test(scr.innerHTML),
    };
  });
  r.check('③ kein Kategorie-Symbol mehr in der Zeile', weg.ico === 0);
  r.check('② kein Konfidenz-Warnzeichen mehr', weg.conf === 0);
  r.check('④ kein Platzhalter „kein Lagerort“ mehr', !weg.platzhalter);

  /* ── ④ Der Lagerort: rechts, einteilig, nur wenn hinterlegt ──── */
  const ort = await A.page.evaluate(() => {
    const el = document.querySelector('#scr-detail .entry-row[data-cid]');
    const cid = el.dataset.cid;
    const e = findEntry(cid);
    const vorher = document.querySelectorAll('#scr-detail .e-loc').length;

    /* Einen Lagerort hinterlegen — über denselben Weg wie die App: Stammsatz. */
    const id = matCreateStamm('Prüfprodukt Lagerort', { lagerort: 'Lager 3 · Fach B' });
    matLinkTo(e.material_key, id);   /* die Karte liest den ROHEN Schlüssel */
    matKeyCacheLeeren(); buildMaterialIndex();
    openRubrik(+cid.split('|')[1], true);

    const loc = document.querySelector('#scr-detail .e-loc');
    if (!loc) return { vorher, gefunden: false };
    const row = loc.closest('.entry-row');
    const rr = row.getBoundingClientRect(), lr = loc.getBoundingClientRect();
    const text = row.querySelector('.e-text').getBoundingClientRect();
    return {
      vorher, gefunden: true,
      inDerZeile: !!row,                                   /* nicht in der Angabenzeile darunter */
      rechtsVomText: lr.left > text.right - 1,
      naheAmRand: (rr.right - lr.right) < 90,              /* rechts, vor den Knöpfen */
      einZeilig: Math.round(lr.height) < 30,
      inhalt: loc.textContent.trim(),
    };
  });
  r.check('④ ohne hinterlegten Ort erscheint kein Banner', ort.vorher === 0);
  r.check('④ mit hinterlegtem Ort erscheint einer', ort.gefunden);
  if (ort.gefunden) {
    r.check('… und zwar IN der Zeile, nicht darunter', ort.inDerZeile);
    r.check('… rechts vom Text und nah am rechten Rand', ort.rechtsVomText && ort.naheAmRand);
    r.check('… einteilig, ohne Umbruch', ort.einZeilig);
    r.check('… und er nennt den Ort', /Lager 3/.test(ort.inhalt));
  }

  /* ── Das Einstufungs-Konzept ist restlos entfernt ─────────────── */
  const konzept = await A.page.evaluate(() => {
    setMode('admin'); renderAdmin();
    const adm = document.getElementById('scr-admin').innerHTML;
    return {
      helfer: ['collectUncertain', 'isHandled', 'naturKorrigiert', 'toggleReviewed', 'admPruefMenue']
        .filter(n => typeof window[n] === 'function'),
      panel: /Einstufung/.test(adm),
      schalter: /Konfidenz/.test(adm),
      einstellung: Object.prototype.hasOwnProperty.call(settings, 'konfidenz'),
      geteilt: SHARED_KEYS.indexOf('hkl_reviewed') >= 0 || BACKUP_KEYS.indexOf('hkl_reviewed') >= 0,
    };
  });
  r.check('Einstufung: keine Helfer mehr im Programm', konzept.helfer.length === 0);
  r.check('… keine Verwaltungskarte mehr', !konzept.panel);
  r.check('… kein Schalter in den Anzeige-Einstellungen', !konzept.schalter && !konzept.einstellung);
  r.check('… und kein Speicherschlüssel mehr im Abgleich', !konzept.geteilt);

  r.check('keine Konsolenfehler', A.errs.length === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
