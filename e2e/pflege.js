/* E2E: der Pflege-Weg (features/pflege.js).

   Der Pflege-Weg ist eine KLAMMER um vier vorhandene Werkzeuge. Getestet wird
   deshalb nicht, ob ein Werkzeug funktioniert — das tun die anderen Suiten —
   sondern ob die KETTE hält:

     Weg öffnen → Schritt öffnet ein Werkzeug → Werkzeug speichert →
     der Weg steht wieder da, beim SELBEN Material, mit einer Lücke weniger.

   Reißt sie an einer Stelle, landet man in der Produktliste oder in der
   allgemeinen Warteschlange des Aufräum-Assistenten — und hat verloren,
   woran man gerade gearbeitet hat. Genau das ist der teure Fehler.

   Dazu die zweite Zusage des Bausteins: Jeder Schritt lässt sich ohne
   Programmierung umbenennen, verschieben, ausblenden — und ein eigener
   Schritt kommt als Handhaken dazu. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('pflege');
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);
  await A.page.evaluate(`doLogin('1234567')`);

  /* ═══════════ 1. Der Bestand: ein Material, nicht viele Zeilen ═══════════ */
  const bestand = await A.page.evaluate(`(function(){
    const m = pfMaterialien();
    const mehrfach = m.filter(x=>x.vorkommen>1).length;
    const mitTexten = m.filter(x=>x.roh.length>1).length;
    const st = pfStats({art:'alle'});
    return { anzahl:m.length, mehrfach, mitTexten,
      summeStimmt: st.fertig+st.offen===st.gesamt,
      gesamtStimmt: st.gesamt===m.length,
      keineTaetigkeit: m.every(x=>!!x.key) };
  })()`);
  r.check(`der Bestand ist nach Material gruppiert (${bestand.anzahl} Materialien)`, bestand.anzahl > 10);
  r.check(`… und fasst Mehrfach-Vorkommen zusammen (${bestand.mehrfach} stehen mehr als einmal)`, bestand.mehrfach > 0);
  r.check(`… mit verschiedenen Wortlauten hinter einem Material (${bestand.mitTexten})`, bestand.mitTexten > 0);
  r.check('fertig + offen ergibt zusammen den ganzen Umfang', bestand.summeStimmt && bestand.gesamtStimmt);
  r.check('kein Material ohne Schlüssel in der Liste', bestand.keineTaetigkeit);

  /* ═══════════ 2. Der Bildschirm: ein Material, seine Schritte ═══════════ */
  const start = await A.page.evaluate(`(function(){
    openPflege({umfang:{art:'alle'}});
    const box = document.getElementById('scr-pflege');
    const aktiv = box.classList.contains('active');
    const html = box.innerHTML;
    const schritte = box.querySelectorAll('.pf-schritt').length;
    return { aktiv, schritte, laeuft: pflegeLaeuft(),
      pos: /Material \\d+ von \\d+/.test(html),
      fortschritt: /Materialien fertig/.test(html),
      vorher: html.indexOf('So steht es im Standard')>=0,
      nachher: html.indexOf('Daraus geworden')>=0,
      key: pfAktuelles().m.key };
  })()`);
  r.check('der Pflege-Weg hat einen eigenen Bildschirm', start.aktiv && start.laeuft);
  r.check('er zeigt, an welcher Stelle im Bestand man steht', start.pos && start.fortschritt);
  r.check('er stellt den Satz aus der Vorlage dem Material gegenüber', start.vorher && start.nachher);
  r.check(`er listet die Schritte (${start.schritte})`, start.schritte >= 5);

  /* ═══════════ 3. DIE KETTE: Material-Editor und zurück ═══════════ */
  const kette = await A.page.evaluate(`(function(){
    // Ein Material ohne Lagerort suchen — daran lässt sich der Weg messen.
    const liste = pfListe({art:'alle'}, true, 'wirkung');
    const m = liste.find(x=>pfLuecken(x).some(s=>s.key==='lagerort')) || liste[0];
    pfAktiv.key = m.key; renderPflege();
    const vorher = pfLuecken(m).length;
    // Schritt „Lagerort" öffnen — das muss den Material-Editor aufschlagen.
    pfUiTun('lagerort');
    const imEditor = document.getElementById('scr-scan-item').classList.contains('active');
    const herkunft = scanHerkunft;
    const feldDa = !!document.getElementById('scLoc');
    return { key:m.key, name:m.name, vorher, imEditor, herkunft, feldDa };
  })()`);
  r.check('ein Schritt öffnet das passende Werkzeug (Material-Editor)', kette.imEditor && kette.feldDa);
  r.check('… und der Editor weiß, dass er aus dem Pflege-Weg kommt', kette.herkunft === 'pflege');

  /* Jetzt wirklich speichern — inklusive der 500-ms-Verzögerung im Editor. */
  await A.page.evaluate(`(function(){
    document.getElementById('scLoc').value = 'Regal E2E · Fach 1';
    const nm = document.getElementById('scName'); if(nm && !nm.value) nm.value = 'E2E-Material';
    const h = document.getElementById('scHersteller'); if(h && !h.value) h.value = 'E2E';
    saveScanItem(document.querySelector('#scr-scan-item .btn-pri').dataset.g);
  })()`);
  await A.page.waitForFunction(
    () => document.getElementById('scr-pflege').classList.contains('active'), { timeout: 5000 }).catch(() => {});

  const zurueck = await A.page.evaluate(`(function(){
    const box = document.getElementById('scr-pflege');
    pfCacheLeeren();
    const m = pfMaterialien().find(x=>x.key===${JSON.stringify(kette.key)});
    return { imWeg: box.classList.contains('active'),
      gleichesMaterial: pfAktiv && pfAktiv.key===${JSON.stringify(kette.key)},
      nachher: m?pfLuecken(m).length:-1,
      lagerort: (m&&m.rec)?m.rec.lagerort:null };
  })()`);
  r.check('DIE KETTE: nach dem Speichern steht der Pflege-Weg wieder da', zurueck.imWeg);
  r.check('… beim SELBEN Material', zurueck.gleichesMaterial);
  r.check(`… mit einer Lücke weniger (${kette.vorher} → ${zurueck.nachher})`, zurueck.nachher < kette.vorher);
  r.check('… und der Lagerort ist wirklich am Stammsatz', zurueck.lagerort === 'Regal E2E · Fach 1');

  /* ═══════════ 4. DIE KETTE: Aufräum-Assistent und zurück ═══════════ */
  const auf = await A.page.evaluate(`(function(){
    const liste = pfListe({art:'alle'}, true, 'wirkung');
    const m = liste.find(x=>x.texteOffen.length>0);
    if(!m) return { kein:true };
    pfAktiv.key = m.key; renderPflege();
    pfUiTun('text');
    const box = document.getElementById('scr-cleanup');
    const q = cleanupQueue();
    return { kein:false, key:m.key, tkey:m.texteOffen[0],
      imAssistenten: box.classList.contains('active'),
      eingeengt: q.length===1 && q[0].tkey===m.texteOffen[0],
      keineFilter: box.innerHTML.indexOf('Nur offene')<0,
      rueckKnopf: box.innerHTML.indexOf('Zurück zum Pflege-Weg')>=0 };
  })()`);
  r.check('der Aufräum-Schritt öffnet den Assistenten', !auf.kein && auf.imAssistenten);
  r.check('… eingeengt auf GENAU diesen Text', auf.eingeengt);
  r.check('… ohne Filter, die aus dem Weg herausführen, aber mit Rückweg', auf.keineFilter && auf.rueckKnopf);

  const aufZurueck = await A.page.evaluate(`(function(){
    document.getElementById('clKern').value = 'E2E-Produktkern';
    cleanupApply(${JSON.stringify(auf.tkey)});
    const imWeg = document.getElementById('scr-pflege').classList.contains('active');
    return { imWeg, fokusWeg: cleanupFokus===null, entschieden: !!ZERLDB[${JSON.stringify(auf.tkey)}] };
  })()`);
  r.check('DIE KETTE: Übernehmen führt in den Pflege-Weg zurück', aufZurueck.imWeg);
  r.check('… die Einengung ist danach aufgehoben', aufZurueck.fokusWeg);
  r.check('… und die Entscheidung steht in der Zerlegung', aufZurueck.entschieden);

  /* ═══════════ 5. „entfällt" — der Mensch schlägt die Daten ═══════════ */
  const entf = await A.page.evaluate(`(function(){
    pfCacheLeeren();
    const liste = pfListe({art:'alle'}, true, 'wirkung');
    const m = liste.find(x=>pfLuecken(x).some(s=>s.key==='preis')) || liste[0];
    pfAktiv.key = m.key; renderPflege();
    const vorher = pfLuecken(m).length;
    pfUiEntfaellt('preis');
    const nachher = pfLuecken(m).length;
    const html = document.getElementById('scr-pflege').innerHTML;
    pfUiEntfaellt('preis');
    return { key:m.key, vorher, nachher, zurueck: pfLuecken(m).length,
      textDa: html.indexOf('entfällt für dieses Material')>=0 };
  })()`);
  r.check('„entfällt" schließt einen Schritt für dieses eine Material', entf.nachher === entf.vorher - 1);
  r.check('… und sagt es auch so', entf.textDa);
  r.check('… und ist zurücknehmbar', entf.zurueck === entf.vorher);

  /* ═══════════ 6. „Material fertig" und die Navigation ═══════════ */
  const nav = await A.page.evaluate(`(function(){
    pfSetzeNurOffene(false);
    const liste = pfListe({art:'alle'}, false, 'name');
    pfAktiv.key = liste[0].key; renderPflege();
    const ersteName = pfAktuelles().m.key;
    pfUiWeiter();
    const zweite = pfAktuelles().m.key;
    pfUiZurueck();
    const wieder = pfAktuelles().m.key;
    // Fertig: das Material fällt aus „nur offene" heraus.
    pfUiFertig();
    const istFertig = !!pfFertigVon(wieder);
    pfSetzeNurOffene(true);
    const inOffen = pfListe({art:'alle'}, true, 'name').some(x=>x.key===wieder);
    pfFertigSchalten(wieder);
    pfSetzeNurOffene(false);
    return { ersteName, zweite, wieder, istFertig, inOffen };
  })()`);
  r.check('vor und zurück bewegen sich im Bestand', nav.zweite !== nav.ersteName && nav.wieder === nav.ersteName);
  r.check('„Material fertig" schließt es ab …', nav.istFertig);
  r.check('… und nimmt es aus der Liste der offenen', !nav.inOffen);

  /* ═══════════ 7. Einstiege: aus der Zeile und aus dem Standard ═══════════ */
  const einstieg = await A.page.evaluate(`(function(){
    // Eine Materialzeile in einem Standard finden.
    let treffer = null;
    DB.standards.some(s=>(s.rubriken||[]).some((rb,ri)=>{
      if(rb.typ!=='material') return false;
      return (rb.sub_bereiche||[]).some((sb,si)=>(sb.eintraege||[]).some((e,ei)=>{
        if(!e || e.natur==='ueberschrift' || !e.material_key) return false;
        treffer = { sid:s.id, cid:cidOf(s.id,ri,si,ei), e }; return true; }));
    }));
    if(!treffer) return { kein:true };
    const erwartet = effMatKey(treffer.e, treffer.cid);
    pflegeAbZeile(treffer.cid, treffer.e);
    const abZeile = { imWeg: document.getElementById('scr-pflege').classList.contains('active'),
      material: pfAktiv.key===erwartet, umfang: pfAktiv.umfang.art==='standard' && pfAktiv.umfang.wert===treffer.sid };
    // Und derselbe Weg für den ganzen Standard.
    pflegeFuerStandard(treffer.sid);
    const nurDieses = pfImUmfang({art:'standard',wert:treffer.sid})
      .every(m=>m.standards.indexOf(treffer.sid)>=0);
    const weniger = pfImUmfang({art:'standard',wert:treffer.sid}).length < pfMaterialien().length;
    // Und das Menü bietet den Weg auch an.
    openSheet(treffer.cid);
    const imMenue = document.getElementById('sheet').textContent.indexOf('Pflege-Weg ab hier')>=0;
    showSheet(false);
    return { kein:false, abZeile, nurDieses, weniger, imMenue, sid:treffer.sid };
  })()`);
  r.check('„Pflege-Weg ab hier" startet bei genau diesem Material', !einstieg.kein && einstieg.abZeile.imWeg && einstieg.abZeile.material);
  r.check('… und grenzt den Umfang auf diesen Standard ein', einstieg.abZeile.umfang);
  r.check('der Standard-Umfang enthält nur dessen Materialien und ist kleiner', einstieg.nurDieses && einstieg.weniger);
  r.check('das ⋯-Menü an der Zeile bietet den Weg an', einstieg.imMenue);

  /* ═══════════ 8. Der Rückweg aus dem Weg heraus ═══════════ */
  const raus = await A.page.evaluate(`(function(){
    openPflege({umfang:{art:'standard',wert:${JSON.stringify(einstieg.sid)}}});
    goBack();
    const imStandard = document.getElementById('scr-rubriken').classList.contains('active');
    const beendet = !pflegeLaeuft();
    openPflege({umfang:{art:'alle'}});
    goBack();
    const inZentrale = document.getElementById('scr-care').classList.contains('active');
    return { imStandard, beendet, inZentrale };
  })()`);
  r.check('‹ führt aus dem Standard-Weg in den Standard zurück', raus.imStandard && raus.beendet);
  r.check('… und aus dem Gesamt-Weg in die Materialzentrale', raus.inZentrale);

  /* ═══════════ 9. Ohne Programmierung änderbar (A7) ═══════════ */
  const cfg = await A.page.evaluate(`(function(){
    openPflege({umfang:{art:'alle'}});
    // Umbenennen
    pflSetzen('foto','wort','Produktbild aufnehmen');
    renderPflege();
    const umbenannt = document.getElementById('scr-pflege').innerHTML.indexOf('Produktbild aufnehmen')>=0;
    // Ausblenden: der Schritt ist weg — und zählt auch nicht mehr mit.
    const m = pfAktuelles().m;
    const vorher = pfLuecken(m).length;
    pflSetzen('preis','aus',true);
    renderPflege();
    const nachher = pfLuecken(m).length;
    const wegAusAnzeige = document.getElementById('scr-pflege').innerHTML.indexOf('Stückpreis')<0;
    // Eigener Schritt: Handhaken
    const eig = pflEigenAnlegen('Im Lagersystem angelegt','SAP-Nummer vergeben','🗄');
    renderPflege();
    const eigenDa = document.getElementById('scr-pflege').innerHTML.indexOf('Im Lagersystem angelegt')>=0;
    const eigenOffen = pfLuecken(m).some(s=>s.key===eig.key);
    pfUiHand(eig.key);
    const eigenFertig = !pfLuecken(m).some(s=>s.key===eig.key);
    // Reihenfolge
    pflSetzen('foto','ord',-1);
    const erster = pflListe()[0].key;
    // Und die Verwaltungskarte gibt es auch.
    renderAdmin();
    const panelDa = document.getElementById('scr-admin').innerHTML.indexOf('Pflege-Weg')>=0;
    // Aufräumen für den Schlusstest
    pflZuruecksetzen(); pflEigenLoeschen(eig.key);
    return { umbenannt, vorher, nachher, wegAusAnzeige, eigenDa, eigenOffen, eigenFertig, erster, panelDa };
  })()`);
  r.check('ein Schritt lässt sich umbenennen', cfg.umbenannt);
  r.check('ein ausgeblendeter Schritt verschwindet aus Anzeige UND Rechnung',
    cfg.wegAusAnzeige && cfg.nachher === cfg.vorher - 1);
  r.check('ein eigener Schritt erscheint und ist ein Handhaken', cfg.eigenDa && cfg.eigenOffen && cfg.eigenFertig);
  r.check('die Reihenfolge lässt sich ändern', cfg.erster === 'foto');
  r.check('die Verwaltung hat eine Karte dafür', cfg.panelDa);

  /* ═══════════ 10. Wer den Weg nicht nutzt, merkt nichts davon ═══════════ */
  const leer = await A.page.evaluate(`(function(){
    PFL={}; savePfl(); PFLEIGEN=[]; savePflEigen(); PFSTAND={}; savePfStand();
    pfCacheLeeren(); pfAktiv=null;
    const s = DB.standards[0];
    openStandard(s.id, true);
    const kopf = document.getElementById('scr-rubriken').innerHTML;
    mode='care'; renderMatCenter(); show('scr-care');
    mcGo('material');
    const zentrale = document.getElementById('scr-care').innerHTML;
    return { keinBalken: kopf.indexOf('pf-karte')<0,
      kopfDa: kopf.length>200,
      knopfDa: zentrale.indexOf('Pflege-Weg')>=0 };
  })()`);
  r.check('im Standard steht nichts vom Pflege-Weg herum', leer.keinBalken && leer.kopfDa);
  r.check('der Einstieg bleibt dort, wo Material gepflegt wird', leer.knopfDa);

  r.check('keine Konsolenfehler', A.errs.length === 0);
  if (A.errs.length) console.error(A.errs.slice(0, 5));
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
