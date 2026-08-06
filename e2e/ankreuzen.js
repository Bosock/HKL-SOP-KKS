/* E2E: Ankreuzen statt Abtippen — auf beiden Ebenen.

   ZEILE:     „☑ Ankreuzen statt Abtippen" in jeder Rubrik. Mehrere Häkchen,
              ein Einfügen, aus dem tatsächlichen Bestand.
   BAUSTEIN:  Beim Anlegen eines Standards ganze Bausteine ankreuzen — und
              zwar so, dass jeder in SEINER Heimatrubrik landet.

   Der teure Fehler wäre hier nicht ein Absturz, sondern ein Eintrag, der
   anders heißt als sein Vorbild: Dann hinge weder Foto noch Preis daran, und
   die Dublettenliste hätte einen Fall mehr. Deshalb prüft diese Suite am
   Ende immer den ANGEKOMMENEN Eintrag, nicht nur die Meldung. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('ankreuzen');
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);
  await A.page.evaluate(`doLogin('1234567')`);

  /* ═══════════ 1. Der Bestand hinter dem Wähler ═══════════ */
  const best = await A.page.evaluate(`(function(){
    const mat = ankBestand('material');
    const abl = ankBestand('ablauf');
    // Jedes Material genau einmal?
    const namen = mat.map(x=>x.name.toLowerCase());
    const doppelt = namen.filter((n,i)=>namen.indexOf(n)!==i).length;
    // Sortierung nach Häufigkeit
    let absteigend = true;
    for(let i=1;i<mat.length;i++){ if(mat[i].n > mat[i-1].n){ absteigend=false; break; } }
    return { mat:mat.length, abl:abl.length, doppelt, absteigend,
      sorten: ankSorte('material')==='material' && ankSorte('geraete')==='material'
           && ankSorte('ablauf')==='ablauf' && ankSorte('sonstige')==='ablauf',
      erste: mat[0]?mat[0].name:'', ersteN: mat[0]?mat[0].n:0 };
  })()`);
  r.check(`der Materialbestand steht zur Auswahl (${best.mat} Zeilen)`, best.mat > 50);
  r.check(`… jedes Material genau EINMAL (0 Dubletten)`, best.doppelt === 0);
  r.check(`… nach Häufigkeit sortiert (oben „${best.erste}", ${best.ersteN}×)`, best.absteigend && best.ersteN > 1);
  r.check(`Handgriffe sind eine eigene Liste (${best.abl} Zeilen)`, best.abl > 10);
  r.check('Material/Geräte und Ablauf/Sonstiges sind je EINE Sorte', best.sorten);

  /* ═══════════ 2. Der Wähler in einer Materialrubrik ═══════════ */
  const auf = await A.page.evaluate(`(function(){
    const s = DB.standards[0];
    openStandard(s.id);
    const ri = (s.rubriken||[]).findIndex(x=>x.typ==='material');
    if(ri<0) return { kein:true };
    openRubrik(ri);
    /* Über den TEXT suchen, nicht über data-r: In der Rubrik stehen mehrere
       Knöpfe mit demselben Attribut (Bausteine einfügen trägt es auch). */
    const knoepfe = [...document.querySelectorAll('#scr-detail .add-entry-btn')];
    const knopfDa = knoepfe.some(b=>/Ankreuzen/.test(b.textContent));
    // Der alte Einzelweg ist wirklich weg.
    const altWeg = (typeof startAdoptCatalog==='undefined') && (typeof adoptCatalogItem==='undefined');
    ankOeffnen(ri);
    const sheet = document.getElementById('sheet');
    const offen = sheet.classList.contains('show');
    const zeilen = sheet.querySelectorAll('.ank-zeile').length;
    const suchfeld = !!document.getElementById('ankSuche');
    const btn = document.getElementById('ankBtn');
    return { kein:false, sid:s.id, ri, knopfDa, altWeg, offen, zeilen, suchfeld,
      gesperrt: !!(btn && btn.disabled) };
  })()`);
  r.check('in der Rubrik steht der Weg zum Ankreuzen', !auf.kein && auf.knopfDa);
  r.check('der alte Einzel-Weg „Aus Katalog übernehmen" ist ersatzlos entfernt', auf.altWeg);
  r.check(`der Wähler öffnet sich mit Liste und Suchfeld (${auf.zeilen} sichtbar)`, auf.offen && auf.zeilen > 0 && auf.suchfeld);
  r.check('ohne Häkchen lässt er sich nicht auslösen', auf.gesperrt);

  /* ═══════════ 3. Suchen, ankreuzen, einfügen ═══════════ */
  const tat = await A.page.evaluate(`(function(){
    // Zwei Materialien wählen, die es in DIESER Rubrik noch nicht gibt.
    const rub = curStd.rubriken[${auf.ri}];
    const drin = new Set();
    (rub.sub_bereiche||[]).forEach(sb=>(sb.eintraege||[]).forEach(e=>{
      if(e && e.anzeige_text) drin.add(e.anzeige_text.trim().toLowerCase()); }));
    const frei = ankBestand('material').filter(x=>!drin.has(x.name.trim().toLowerCase())).slice(0,2);
    if(frei.length<2) return { kein:true };

    // Erst suchen — die Liste muss sich verkleinern, ohne das Feld zu verlieren.
    const vorher = document.querySelectorAll('#ankListe .ank-zeile').length;
    ankUiSuche(frei[0].name.slice(0,6));
    const gefiltert = document.querySelectorAll('#ankListe .ank-zeile').length;
    const feldDa = !!document.getElementById('ankSuche');

    // Ankreuzen, dann weitersuchen: Angekreuztes muss sichtbar bleiben.
    ankSchalten(frei[0].key, true);
    ankUiSuche(frei[1].name.slice(0,6));
    const bleibtSichtbar = document.getElementById('ankListe').textContent.indexOf(frei[0].name)>=0;
    ankSchalten(frei[1].key, true);
    const btnText = document.getElementById('ankBtn').textContent;

    ankUiEinfuegen();
    // Angekommen?
    const s2 = DB.standards.find(x=>x.id===${JSON.stringify(auf.sid)});
    const jetzt = [];
    (s2.rubriken[${auf.ri}].sub_bereiche||[]).forEach(sb=>(sb.eintraege||[]).forEach(e=>{
      if(e && e.anzeige_text) jetzt.push({ n:e.anzeige_text, add:!!e._added, mk:e.material_key }); }));
    const a1 = jetzt.find(x=>x.n===frei[0].name);
    const a2 = jetzt.find(x=>x.n===frei[1].name);
    return { kein:false, vorher, gefiltert, feldDa, bleibtSichtbar, btnText,
      beideDa: !!(a1&&a2), eigen: !!(a1&&a1.add),
      schluessel: !!(a1 && a1.mk===frei[0].name.toLowerCase()),
      zu: !document.getElementById('sheet').classList.contains('show'),
      namen:[frei[0].name, frei[1].name] };
  })()`);
  r.check(`die Suche filtert (${tat.vorher} → ${tat.gefiltert}) und behält das Feld`, !tat.kein && tat.gefiltert < tat.vorher && tat.feldDa);
  r.check('Angekreuztes bleibt sichtbar, auch wenn die Suche es ausschließt', tat.bleibtSichtbar);
  r.check(`der Knopf zählt mit („${tat.btnText}")`, /2/.test(tat.btnText));
  r.check('beide Einträge sind in der Rubrik angekommen', tat.beideDa && tat.zu);
  r.check('… als eigene Einträge (die Quelldatei bleibt unangetastet)', tat.eigen);
  r.check('… mit demselben Materialschlüssel wie das Vorbild', tat.schluessel);

  /* ═══════════ 4. In einer Ablauf-Rubrik stehen Handgriffe ═══════════ */
  const abl = await A.page.evaluate(`(function(){
    let ziel=null;
    DB.standards.some(s=>(s.rubriken||[]).some((rb,ri)=>{
      if(rb.typ==='material'||rb.typ==='geraete') return false;
      ziel={sid:s.id, ri}; return true; }));
    if(!ziel) return { kein:true };
    openStandard(ziel.sid); openRubrik(ziel.ri);
    ankOeffnen(ziel.ri);
    const txt = document.getElementById('ankListe').textContent;
    const matNamen = ankBestand('material').map(x=>x.name);
    // Kein reiner Materialname in der Handgriff-Liste (Stichprobe über die
    // zehn häufigsten — die stünden ganz oben, wenn die Sorte falsch wäre).
    const ablNamen = new Set(ankBestand('ablauf').map(x=>x.name));
    const vermischt = matNamen.slice(0,10).filter(n=>ablNamen.has(n)).length;
    const ergebnis = { kein:false, hatZeilen: document.querySelectorAll('.ank-zeile').length>0,
      vermischt, wort: txt.length>0 };
    ankAbbrechen();
    return ergebnis;
  })()`);
  r.check('auch eine Ablauf-Rubrik hat einen Wähler', !abl.kein && abl.hatZeilen);
  r.check('Material und Handgriffe werden nicht vermischt', abl.vermischt === 0);

  /* ═══════════ 5. Bausteine beim ANLEGEN eines Standards ═══════════ */
  const bau = await A.page.evaluate(`(function(){
    // Zwei Bausteine mit verschiedener Heimat bauen (wie über die Sammelmappe).
    const s = DB.standards[0];
    let matCid=null, ablCid=null;
    (s.rubriken||[]).forEach((rb,ri)=>{
      (rb.sub_bereiche||[]).forEach((sb,si)=>(sb.eintraege||[]).forEach((e,ei)=>{
        if(!e || e.natur==='ueberschrift') return;
        const cid = cidOf(s.id,ri,si,ei);
        if((rb.typ==='material') && !matCid) matCid=cid;
        if((rb.typ!=='material'&&rb.typ!=='geraete') && !ablCid) ablCid=cid;
      }));
    });
    if(!matCid) return { kein:true };
    bauSammlungLeeren();
    bauSammeln(matCid);
    const b1 = bauAusSammlung('E2E Material-Baustein', []);
    let b2 = null;
    if(ablCid){ bauSammeln(ablCid); b2 = bauAusSammlung('E2E Ablauf-Baustein', []); }
    // Eine Heimat erfinden, die es im frischen Standard NICHT gibt.
    b1.rubrik = 'E2E-Heimatrubrik'; saveBausteine();
    return { kein:false, b1:b1.id, b2:b2?b2.id:null,
      heimat1:b1.rubrik, heimat2:b2?b2.rubrik:'' };
  })()`);
  r.check('zwei Bausteine mit Heimatrubrik angelegt', !bau.kein);

  const form = await A.page.evaluate(`(function(){
    setMode('use');
    openStandardForm(null);
    const html = document.getElementById('scr-form').innerHTML;
    const blockDa = html.indexOf('Bausteine übernehmen')>=0;
    const heimatDa = html.indexOf('E2E-Heimatrubrik')>=0;
    const leer = (typeof bauStdWahlIds==='function') ? bauStdWahlIds().length : -1;
    // Ankreuzen und die Bilanz mitlesen.
    bauStdUiSchalten(${JSON.stringify(bau.b1)}, true);
    ${bau.b2 ? `bauStdUiSchalten(${JSON.stringify(bau.b2)}, true);` : ''}
    const bilanz = (document.getElementById('bauStdBilanz')||{}).textContent||'';
    document.getElementById('sTitel').value = 'E2E Angekreuzt';
    document.getElementById('sGruppe').value = 'E2E';
    saveStandardForm(null);
    const neu = DB.standards.find(x=>x.titel==='E2E Angekreuzt');
    if(!neu) return { blockDa, heimatDa, leer, bilanz, angelegt:false };
    const rubs = (neu.rubriken||[]).map((rb,ri)=>({ name:rb.name, typ:rb.typ, ri,
      n:(rb.sub_bereiche||[]).reduce((a,sb)=>a+(sb.eintraege||[]).length,0) }));
    return { blockDa, heimatDa, leer, bilanz, angelegt:true, sid:neu.id, rubs,
      nachher: (typeof bauStdWahlIds==='function') ? bauStdWahlIds().length : -1 };
  })()`);
  r.check('das Formular „Neuer Standard" bietet die Bausteine an', form.blockDa);
  r.check('… gruppiert nach ihrer Heimatrubrik', form.heimatDa);
  r.check('… und startet ohne Altlasten aus einem früheren Besuch', form.leer === 0);
  r.check(`… die Bilanz nennt Zahlen („${(form.bilanz||'').slice(0,60)}")`, /Baustein/.test(form.bilanz || ''));
  r.check('der Standard entsteht', form.angelegt);

  const heimat = (form.rubs || []).find(x => x.name === 'E2E-Heimatrubrik');
  r.check('DIE ZUORDNUNG: die fehlende Heimatrubrik wurde angelegt', !!heimat);
  r.check('… und der Baustein steht darin, nicht irgendwo', !!heimat && heimat.n > 0);
  r.check('… mit der Art, die zu seinen Zeilen passt', !!heimat && (heimat.typ === 'material' || heimat.typ === 'geraete'));
  if (bau.b2) {
    const zweite = (form.rubs || []).find(x => x.name === bau.heimat2);
    r.check(`der zweite Baustein fand seine vorhandene Heimat („${bau.heimat2}")`, !!zweite && zweite.n > 0);
  }
  r.check('die Auswahl ist nach dem Speichern geleert', form.nachher === 0);

  /* ═══════════ 6. Nichts angekreuzt bleibt genau wie vorher ═══════════ */
  const ohne = await A.page.evaluate(`(function(){
    openStandardForm(null);
    document.getElementById('sTitel').value = 'E2E Leer';
    document.getElementById('sGruppe').value = 'E2E';
    saveStandardForm(null);
    const neu = DB.standards.find(x=>x.titel==='E2E Leer');
    if(!neu) return { angelegt:false };
    const n = (neu.rubriken||[]).reduce((a,rb)=>a+(rb.sub_bereiche||[]).reduce((b,sb)=>b+(sb.eintraege||[]).length,0),0);
    return { angelegt:true, rubriken:(neu.rubriken||[]).length, eintraege:n };
  })()`);
  r.check('ohne Häkchen entsteht der Standard wie eh und je (3 Rubriken, leer)',
    ohne.angelegt && ohne.rubriken === 3 && ohne.eintraege === 0);

  r.check('keine Konsolenfehler', A.errs.length === 0);
  if (A.errs.length) console.error(A.errs.slice(0, 5));
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
