/* E2E: der zweite Ausbau — Bilder überall, Merkmale, Prüfblatt, Schrift,
   Bereiche, Alternativen, Fassungen.

   Diese Suite prüft nicht einzelne Funktionen, sondern die WEGE, die ein
   Mensch dabei geht. Der teuerste Fehler in diesem Ausbau wäre kein Absturz,
   sondern eine Kette, die an einer Stelle abreißt: ein Bild, das man
   hinzufügen, aber nicht mehr vergrößern kann; ein Merkmal, das man setzt,
   aber nicht wiederfindet; ein Prüfblatt, das erscheint und nichts schreibt.
   Genau diese Ketten laufen hier durch. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('ausbau');
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);
  await A.page.evaluate(`doLogin('1234567')`);

  /* ═══════════ 1. Bilder überall: der Anker ═══════════ */
  const anker = await A.page.evaluate(`(async function(){
    const s = DB.standards[0];
    openStandard(s.id);
    const ri = (s.rubriken||[]).findIndex(x=>x.typ==='material');
    if(ri<0) return { kein:true };
    openRubrik(ri);
    // Der Knopf steht in der Rubrik, weil dort ein Übersichtsfoto hingehört.
    const knopf = document.querySelector('#scr-detail .med-plus');
    const vorher = !!knopf;
    if(knopf) knopf.click();
    const sheetDa = /Bilder/.test(document.getElementById('sheet').textContent);

    // Ein echtes Bild erzeugen, hochladen und an den Anker hängen.
    const c = document.createElement('canvas'); c.width=8; c.height=8;
    c.getContext('2d').fillStyle='#3d9be0'; c.getContext('2d').fillRect(0,0,8,8);
    const blob = await new Promise(ok=>c.toBlob(ok,'image/png'));
    const k = await medHochladen(blob);
    const a = medAnkRub(s.id, ri);
    medEintragen(a, k, null, 'klein');
    medTextSetzen(k, 'Übersicht Tisch');
    medDetailSetzen(k, 'Von links: Spülung, Manifold, Y-Konnektor.');
    openRubrik(ri, true);
    const html = document.getElementById('scr-detail').innerHTML;

    // Größe nachträglich ändern — der Kern des Wunsches.
    medGroesseSetzen(a, k, 'gross', null);
    openRubrik(ri, true);
    const nachher = document.getElementById('scr-detail').innerHTML;

    return { kein:false, vorher, sheetDa, sid:s.id, ri, k,
      klein: html.indexOf('med-klein')>=0,
      gross: nachher.indexOf('med-gross')>=0 && nachher.indexOf('med-klein')<0,
      zoom: nachher.indexOf('data-zoom')>=0,
      det: nachher.indexOf('Manifold')>=0 };
  })()`);
  r.check('an einer Rubrik gibt es einen Weg zum Bild', !anker.kein && anker.vorher && anker.sheetDa);
  r.check('ein Bild am Anker erscheint klein', anker.klein);
  r.check('… und lässt sich nachträglich auf groß umstellen', anker.gross);
  r.check('… trägt data-zoom (antippen macht groß)', anker.zoom);
  r.check('… und führt die Angaben zum Bild mit', anker.det);

  const lb = await A.page.evaluate(`(function(){
    openLightbox('/api/media/'+${JSON.stringify(anker.k)}, 'Übersicht Tisch', 'Von links: Spülung.');
    const el = document.getElementById('lightbox');
    const det = document.getElementById('lbDet');
    const r1 = { offen: el.classList.contains('show'), cap: document.getElementById('lbCap').textContent,
      detSichtbar: !det.hidden, detText: det.textContent };
    closeLightbox();
    openLightbox('/api/media/'+${JSON.stringify(anker.k)}, 'ohne Angaben', '');
    r1.leerVersteckt = document.getElementById('lbDet').hidden;
    closeLightbox();
    return r1;
  })()`);
  r.check('die Großansicht zeigt Unterschrift und Angaben', lb.offen && /Übersicht/.test(lb.cap) && lb.detSichtbar && /Spülung/.test(lb.detText));
  r.check('… ohne Angaben verschwindet die Fläche ganz', lb.leerVersteckt);

  /* ═══════════ 2. Merkmale an Standards ═══════════ */
  const merk = await A.page.evaluate(`(function(){
    const e = eigAnlegen('sedierungspflichtig','ja');
    const s1 = DB.standards[0].id, s2 = DB.standards[1].id;
    eigSetzen(s1, e.key, true);
    eigSetzen(s2, e.key, false);
    const b = eigBilanz(e.key);
    openStandard(s1, true);
    const kopf = document.getElementById('scr-rubriken').textContent;
    openStandard(s2, true);
    const kopf2 = document.getElementById('scr-rubriken').textContent;
    // Umbenennen darf die Vergaben nicht verlieren.
    eigAendern(e.key,'wort','Sedierung nötig');
    const nachUmbenennen = eigStandards(e.key).length;
    return { key:e.key, ja:b.ja, nein:b.nein, ohne:b.ohne, summe:b.ja+b.nein+b.ohne, gesamt:b.gesamt,
      imKopf: /sedierungspflichtig/.test(kopf), neinNichtImKopf: !/sedierungspflichtig/.test(kopf2),
      nachUmbenennen, s1, s2 };
  })()`);
  r.check('ein Merkmal erscheint als Chip im Standardkopf', merk.imKopf);
  r.check('… ein ausdrückliches Nein erzeugt keinen Chip', merk.neinNichtImKopf);
  r.check(`… und die Bilanz zählt „ohne Angabe" mit (${merk.ja}/${merk.nein}/${merk.ohne} von ${merk.gesamt})`,
    merk.summe === merk.gesamt && merk.ohne > 0);
  r.check('Umbenennen behält alle Vergaben', merk.nachUmbenennen === 1);

  const facet = await A.page.evaluate(`(function(){
    facCacheLeeren();
    const arten = facArten().map(a=>a.key);
    const leiste = facBauen(facPosten(), {});
    return { hatEig: arten.indexOf('eig:'+${JSON.stringify(merk.key)})>=0,
      inLeiste: leiste.some(x=>x.key==='eig:'+${JSON.stringify(merk.key)}) };
  })()`);
  r.check('das Merkmal wird zu einer Facette der Übersicht', facet.hatEig);

  /* ═══════════ 3. Reichweite: das Merkmal als Stufe ═══════════ */
  const rw = await A.page.evaluate(`(function(){
    // Ohne Freigabe darf das Merkmal NICHT im Reichweitenmenü stehen.
    let mk=null, cid=null;
    DB.standards.forEach(s=>(s.rubriken||[]).forEach((rr,ri)=>(rr.sub_bereiche||[]).forEach((sb,si)=>(sb.eintraege||[]).forEach((e,ei)=>{
      if(!cid && s.id===${JSON.stringify(merk.s1)} && e.material_key){ mk=e.material_key; cid=cidOf(s.id,ri,si,ei); } }))));
    if(!cid) return { kein:true };
    const ohne = rwStufen(cid, mk).map(x=>x.key);
    eigAendern(${JSON.stringify(merk.key)},'alsReichweite',true);
    const mit = rwStufen(cid, mk).map(x=>x.key);
    return { kein:false, cid, mk,
      vorher: ohne.indexOf('eig:'+${JSON.stringify(merk.key)})<0,
      nachher: mit.indexOf('eig:'+${JSON.stringify(merk.key)})>=0,
      stufen: mit };
  })()`);
  r.check('ein nicht freigegebenes Merkmal steht NICHT im Reichweitenmenü', !rw.kein && rw.vorher);
  r.check('… nach der Freigabe schon', rw.nachher);

  /* ═══════════ 4. Prüfblatt: je Feld eine eigene Reichweite ═══════════ */
  const pruef = await A.page.evaluate(`(function(){
    const cid = ${JSON.stringify(rw.cid)};
    openStandard(cidStd(cid), true);
    openEntryForm({kind:'editBase', cid});
    document.getElementById('fName').value = 'AUSBAU-Name';
    document.getElementById('fSpez').value = 'AUSBAU-Spez';
    saveEntryForm();
    const t1 = document.getElementById('sheet').textContent;
    const zeilen = document.querySelectorAll('#sheet .pb-zeile').length;
    // Zeile 2 auf „überall" stellen — Zeile 1 bleibt „nur hier".
    pbScopeSetzen(1, 'mat');
    const chips = [...document.querySelectorAll('#sheet .pb-scope')].map(b=>b.textContent.trim());
    document.querySelector('#sheet .btn-pri').click();
    const akt = rulesActive(RULES).filter(x=>x.ziel && x.ziel.key===${JSON.stringify(rw.mk)});
    const name = akt.find(x=>x.prop==='name'), spez = akt.find(x=>x.prop==='spez');
    return { pruefblatt:/Prüfen und speichern/.test(t1), zeilen, chips,
      nameWo: name && name.wo.art, spezWo: spez && spez.wo.art };
  })()`);
  r.check('das Prüfblatt erscheint vor dem Speichern', pruef.pruefblatt);
  r.check('… mit einer Zeile je geändertem Feld', pruef.zeilen === 2);
  r.check('… und getrennten Reichweiten je Zeile', /Nur hier/.test(pruef.chips[0]||'') && /Überall/.test(pruef.chips[1]||''));
  r.check('DAS ENTSCHEIDENDE: jedes Feld wird mit SEINER Reichweite geschrieben',
    pruef.nameWo === 'stelle' && pruef.spezWo === 'alle');

  /* ═══════════ 5. Schrift und Auszeichnung ═══════════ */
  const schrift = await A.page.evaluate(`(function(){
    const roh = txsText('**CAVE** bei <Winkel>');
    const zeilen = txsText('**offen\\nzu** Ende');
    const stil = txsKlassen({g:'xl', f:true});
    const vorgabe = txsKlassen({g:'m', f:false});
    return { fett: roh.indexOf('<span class="tx-fett">CAVE</span>')>=0,
      escaped: roh.indexOf('&lt;Winkel&gt;')>=0,
      keinUeberZeilen: zeilen.indexOf('tx-fett')<0,
      stil, vorgabe };
  })()`);
  r.check('ein Wort in Sternchen wird fett', schrift.fett);
  r.check('… und spitze Klammern bleiben Text', schrift.escaped);
  r.check('… eine Auszeichnung reicht nie über eine Zeile hinweg', schrift.keinUeberZeilen);
  r.check('Zeilenstil ergibt Klassen, die Vorgabe keine', schrift.stil === 'tx-xl tx-fett' && schrift.vorgabe === '');

  /* ═══════════ 6. Bereiche — die zweite Sicht ═══════════ */
  const bereich = await A.page.evaluate(`(function(){
    const b1 = berAnlegen('steriler Tisch');
    const b2 = berAnlegen('Umfeld');
    const cid = ${JSON.stringify(rw.cid)};
    const e = findEntry(cid);
    sheetEntry = e; sheetCid = cid;
    sheetPending = { kind:'bereich', value:b1.key };
    applyPending('cid');
    const gesetzt = berVon(findEntry(cid), cid);
    const karte = entryCardHTML(findEntry(cid), cid, true);
    const gr = berGruppen(cidStd(cid));
    return { zwei: berListe().length===2, gesetzt: gesetzt && gesetzt.key===b1.key,
      badge: karte.indexOf('steriler Tisch')>=0,
      gruppen: gr.length, ohneGruppe: gr.some(g=>!g.bereich) };
  })()`);
  r.check('Bereiche lassen sich anlegen', bereich.zwei);
  r.check('… einem Eintrag zuweisen', bereich.gesetzt);
  r.check('… und stehen als Chip an der Zeile', bereich.badge);
  r.check('… die zweite Sicht gruppiert, „ohne Bereich" bleibt sichtbar', bereich.gruppen >= 1 && bereich.ohneGruppe);

  /* ═══════════ 7. Alternativen ═══════════ */
  const alt = await A.page.evaluate(`(function(){
    const cid = ${JSON.stringify(rw.cid)};
    const e = findEntry(cid);
    const k1 = altKey(e, cid);
    const liste = altMaterialListe().filter(m=>m.key!==k1);
    if(!liste.length) return { kein:true };
    const g = altAnlegen('Statt Testmaterial', k1, 'Testmaterial');
    altGliedHinzu(g.id, liste[0].key, liste[0].name, 'wenn nicht vorhanden');
    const anMir = altFuerZeile(e, cid);
    const badge = altBadgeHTML(e, cid);
    // Und am ANDEREN Glied muss dieselbe Gruppe stehen.
    const andere = altGruppenFuer(liste[0].key);
    // Eine Gruppe mit einem Glied ist keine Gruppe mehr.
    altGliedWeg(g.id, liste[0].key);
    const weg = altGruppeOf(g.id);
    return { kein:false, anMir:anMir.length, badge: badge.indexOf('oder')>=0,
      andere: andere.length, aufgeloest: weg===null };
  })()`);
  r.check('eine Austauschgruppe erscheint an der Zeile', !alt.kein && alt.anMir === 1 && alt.badge);
  r.check('… und genauso am anderen Material', alt.andere === 1);
  r.check('… eine Gruppe mit nur einem Glied löst sich auf', alt.aufgeloest);

  const zweig = await A.page.evaluate(`(function(){
    const sid = ${JSON.stringify(merk.s1)};
    const s = DB.standards.find(x=>x.id===sid);
    const ri = (s.rubriken||[]).findIndex(x=>x.typ==='material');
    const abschnitte = zwgAbschnitteVon(sid, ri);
    if(!abschnitte.length) return { kein:true };
    zwgZweigHinzu(sid, ri, 'RF');
    zwgZweigHinzu(sid, ri, 'Kryo');
    zwgAbschnittSetzen(sid, ri, abschnitte[0], 'rf');
    const ohneWahl = zwgAbschnittSichtbar(sid, ri, abschnitte[0]);
    zwgWaehlen(sid, ri, 'kryo');
    const mitKryo = zwgAbschnittSichtbar(sid, ri, abschnitte[0]);
    zwgWaehlen(sid, ri, 'rf');
    const mitRf = zwgAbschnittSichtbar(sid, ri, abschnitte[0]);
    zwgWaehlen(sid, ri, '');
    const leiste = zwgLeisteHTML(sid, ri);
    return { kein:false, ohneWahl, mitKryo, mitRf, leiste: leiste.indexOf('Kryo')>=0 };
  })()`);
  r.check('OHNE Wahl bleiben alle Zweige sichtbar', !zweig.kein && zweig.ohneWahl);
  r.check('… mit der falschen Wahl verschwindet der Abschnitt', zweig.mitKryo === false);
  r.check('… mit der richtigen ist er wieder da', zweig.mitRf === true);
  r.check('… und der Umschalter steht am Kopf der Rubrik', zweig.leiste);

  /* ═══════════ 8. Fassung festschreiben ═══════════ */
  const fas = await A.page.evaluate(`(function(){
    const sid = ${JSON.stringify(merk.s1)};
    const v = fasVorschau(sid);
    const aktVorher = rulesActive(RULES).length;
    const f = fasFestschreiben(sid, 'E2E-Fassung');
    const aktNachher = rulesActive(RULES).length;
    const cid = ${JSON.stringify(rw.cid)};
    const nachFest = qeGet(findEntry(cid), cid, 'name');
    // Verwerfen: der Stand davor gilt wieder.
    fasVerwerfen(f.id);
    const nachVerwerfen = qeGet(findEntry(cid), cid, 'name');
    return { stellen:v.stellen, felder:v.felder, regeln:v.regeln.length,
      aktVorher, aktNachher, nachFest, nachVerwerfen,
      imJournal: FAS.length===1, verworfen: !!FAS[0].verworfen };
  })()`);
  r.check(`die Vorschau zählt echte Zahlen (${fas.stellen} Stellen, ${fas.felder} Angaben)`, fas.stellen > 0 && fas.felder > 0);
  r.check('Festschreiben arbeitet die Regeln ein (weniger aktive Regeln)', fas.aktNachher < fas.aktVorher);
  r.check('… der festgeschriebene Wert gilt weiter', fas.nachFest === 'AUSBAU-Name');
  r.check('DAS ENTSCHEIDENDE: Verwerfen nimmt die Fassung zurück', fas.nachVerwerfen !== 'AUSBAU-Name');
  r.check('… und die Fassung bleibt im Journal lesbar', fas.imJournal && fas.verworfen);

  /* ═══════════ 9. Nichts davon im Weg, wenn es niemand nutzt ═══════════ */
  const leer = await A.page.evaluate(`(function(){
    // Alles Neue wieder wegräumen und prüfen, dass die App aussieht wie vorher.
    EIG = []; saveJSON('hkl_eigenschaften', EIG);
    EIGSTD = {}; saveJSON('hkl_stdeigen', EIGSTD);
    BEREICHE = []; saveJSON('hkl_bereiche', BEREICHE);
    ALTG = []; saveJSON('hkl_altgruppen', ALTG);
    MEDANK = {}; saveJSON('hkl_medienanker', MEDANK);
    facCacheLeeren(); altMaterialCacheLeeren();
    const s = DB.standards[0];
    openStandard(s.id, true);
    const kopf = document.getElementById('scr-rubriken').innerHTML;
    return { keineChips: kopf.indexOf('eig-chip')<0,
      keinBereich: kopf.indexOf('ber-chip')<0,
      kopfDa: kopf.length > 200 };
  })()`);
  r.check('ohne gepflegte Merkmale/Bereiche steht nichts Leeres herum', leer.keineChips && leer.keinBereich && leer.kopfDa);

  /* ═══════════ 10. Befunde der Systemanalyse ═══════════ */
  const analyse = await A.page.evaluate(`(async function(){
    // (a) Prüfblatt: „für alle Zeilen dieselbe Reichweite"
    const s = DB.standards[0];
    let cid=null;
    s.rubriken.some((rb,ri)=>{ if(rb.typ!=='material') return false;
      return (rb.sub_bereiche||[]).some((sb,si)=>(sb.eintraege||[]).some((e,ei)=>{
        if(!e||!e.material_key) return false; cid=cidOf(s.id,ri,si,ei); return true; })); });
    curStd = s;
    let alleKnopf=false, gesetzt=false;
    if(cid){
      pbOeffnen(cid, [{prop:'name',value:'A1',vorher:'x'},{prop:'mengeVal',value:'2x',vorher:null}], 'cid', ()=>{});
      alleKnopf = document.getElementById('sheet').innerHTML.indexOf('Für alle Zeilen dieselbe Reichweite')>=0;
      pbScopeAlleWahl();
      const knopf = [...document.querySelectorAll('#sheet .sheet-pick-btn')].pop();
      if(knopf) knopf.click();
      gesetzt = new Set(PB.zeilen.map(z=>z.scope)).size===1 && PB.zeilen[0].scope!=='cid';
      pbAbbrechen();
    }
    // (b) Baustein-Kategorien: umbenennen und entfernen
    const k = bauKatAnlegen('E2E-Kat');
    openBausteinAdmin();
    const leisteVorher = document.getElementById('scr-bausteine').innerHTML;
    bauUiKatVerwalten();
    const verwaltungDa = document.getElementById('scr-bausteine').innerHTML.indexOf('bau-katverw')>=0;
    bauUiKatFeld(k.key,'wort','E2E-Umbenannt');
    const neuerName = (bauKatOf(k.key)||{}).wort;
    const schluesselGleich = !!bauKatOf(k.key);
    bauUiKatWeg(k.key);                     // erst fragen
    const fragt = document.getElementById('scr-bausteine').innerHTML.indexOf('Wirklich?')>=0;
    bauUiKatWeg(k.key);                     // dann tun
    const weg = !bauKatOf(k.key);
    // (c) Merkmals-Abdeckung im Produktblatt
    let abdeckung = 'kein Katalog';
    if(typeof MERKKAT!=='undefined' && MERKKAT && (MERKKAT.klassen||[]).length){
      const kl = MERKKAT.klassen[0];
      GTINDB['m:e2eabd'] = { gtin:'m:e2eabd', manual:true, name:'E2E', klasse:kl.id, merkmale:{} };
      openScanItem('m:e2eabd', false);
      const t = document.getElementById('scr-scan-item').textContent;
      abdeckung = /von \\d+ Merkmalen erfasst/.test(t) ? 'da' : 'fehlt';
      delete GTINDB['m:e2eabd'];
    }
    return { alleKnopf, gesetzt, verwaltungDa, neuerName, schluesselGleich, fragt, weg, abdeckung,
      leisteVorher: leisteVorher.length>0 };
  })()`);
  r.check('Prüfblatt: „für alle Zeilen dieselbe Reichweite" ist erreichbar', analyse.alleKnopf);
  r.check('… und setzt wirklich alle Zeilen auf eine Reichweite', analyse.gesetzt);
  r.check('Baustein-Kategorien lassen sich verwalten', analyse.verwaltungDa);
  r.check('… umbenennen, ohne den Schlüssel zu verlieren', analyse.neuerName === 'E2E-Umbenannt' && analyse.schluesselGleich);
  r.check('… und entfernen — mit Rückfrage, ohne natives Fenster', analyse.fragt && analyse.weg);
  r.check('Produktblatt nennt die Merkmals-Abdeckung („x von y erfasst")', analyse.abdeckung !== 'fehlt');

  /* Der Zerlegungs-Speicher hängt an POSITIONEN. Er wird seit der
     Systemanalyse nur noch in rebuildDB() verworfen (statt bei jedem
     buildMaterialIndex — das kostete 300 ms je Speichern). Diese Prüfung hält
     die Zusage fest: Nach einer Löschung, die alle folgenden Zeilen
     verschiebt, stimmen die kanonischen Schlüssel weiterhin. */
  const cache = await A.page.evaluate(`(function(){
    const quelle = DB.standards[0];
    const neuId = stdDuplicate(quelle.id, 'E2E Cache-Pruefung', 'E2E');
    if(!neuId) return { kein:true };
    const std = DB.standards.find(x=>x.id===neuId);
    let ri=-1, si=-1;
    (std.rubriken||[]).some((rb,i)=>(rb.sub_bereiche||[]).some((sb,j)=>{
      if((sb.eintraege||[]).length>=3){ ri=i; si=j; return true; } return false; }));
    if(ri<0) return { kein:true };
    const vorher = std.rubriken[ri].sub_bereiche[si].eintraege
      .map((e,ei)=>({ text:(e.anzeige_text||''), key: effMatKey(e, cidOf(neuId,ri,si,ei)) })).slice(1);
    ownDeleteEntry(cidOf(neuId,ri,si,0));
    const std2 = DB.standards.find(x=>x.id===neuId);
    const nachher = std2.rubriken[ri].sub_bereiche[si].eintraege
      .map((e,ei)=>({ text:(e.anzeige_text||''), key: effMatKey(e, cidOf(neuId,ri,si,ei)) }));
    matKeyCacheLeeren();
    const frisch = std2.rubriken[ri].sub_bereiche[si].eintraege
      .map((e,ei)=>effMatKey(e, cidOf(neuId,ri,si,ei)));
    return { kein:false, n:vorher.length,
      textGleich: JSON.stringify(vorher.map(x=>x.text))===JSON.stringify(nachher.map(x=>x.text)),
      keyGleich:  JSON.stringify(vorher.map(x=>x.key)) ===JSON.stringify(nachher.map(x=>x.key)),
      wieFrisch:  JSON.stringify(nachher.map(x=>x.key))===JSON.stringify(frisch) };
  })()`);
  r.check(`nach einer Loeschung ruecken die Zeilen auf (${cache.n} geprueft)`, !cache.kein && cache.textGleich);
  r.check('… und ihre kanonischen Schluessel wandern korrekt mit', cache.keyGleich);
  r.check('DER SPEICHER-VERTRAG: gecacht = frisch gerechnet', cache.wieFrisch);

  r.check('keine Konsolenfehler', A.errs.length === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
