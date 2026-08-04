/* E2E: Bilder an jedem Eintrag (features/medien.js + /api/media).

   Geprüft wird der ganze Weg, den ein Mensch im Saal geht: Bild hochladen →
   an die Zeile hängen → in der Liste sehen → groß ansehen → über die
   Reichweite an ALLEN Stellen desselben Materials zeigen → wieder entfernen.
   Dazu die zwei Eigenschaften, die den ganzen Umbau begründet haben: Das Bild
   liegt NICHT im geteilten Zustand, und seine Adresse ist unveränderlich. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('medien');
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);
  await A.page.evaluate(`doLogin('1234567')`);

  /* Ein winziges, echtes PNG im Browser erzeugen und hochladen. */
  const hoch = await A.page.evaluate(`(async function(){
    const c = document.createElement('canvas'); c.width=8; c.height=8;
    const g = c.getContext('2d'); g.fillStyle='#3d9be0'; g.fillRect(0,0,8,8);
    const blob = await new Promise(ok=>c.toBlob(ok,'image/png'));
    const k1 = await medHochladen(blob);
    const k2 = await medHochladen(blob);   /* derselbe Inhalt */
    const a = await fetch(medUrl(k1));
    return { k1, k2, ok:a.ok, art:a.headers.get('content-type'),
             cache:a.headers.get('cache-control') };
  })()`);
  r.check('Bild wird hochgeladen und bekommt eine Kennung', /^[0-9a-f]{32}$/.test(hoch.k1));
  r.check('derselbe Inhalt bekommt dieselbe Kennung (kein zweiter Platz)', hoch.k1 === hoch.k2);
  r.check('das Bild ist unter seiner Kennung abrufbar', hoch.ok && hoch.art === 'image/png');
  r.check('… und darf unbegrenzt zwischengespeichert werden', /immutable/.test(hoch.cache || ''));

  /* An eine Zeile hängen — über denselben Weg wie Name und Menge. */
  const dran = await A.page.evaluate(`(function(){
    const s = DB.standards[0];
    let cid=null, mk=null;
    (s.rubriken||[]).forEach((rr,ri)=>(rr.sub_bereiche||[]).forEach((sb,si)=>(sb.eintraege||[]).forEach((e,ei)=>{
      if(!cid && e && e.material_key && !e.ist_fliesstext && e.natur!=='ueberschrift'){ cid=cidOf(s.id,ri,si,ei); mk=e.material_key; }
    })));
    if(!cid) return { none:true };
    medEintragen(cid, ${JSON.stringify(hoch.k1)}, 'cid');
    const e = findEntry(cid);
    return { cid, mk, n: medVonEintrag(e,cid).length };
  })()`);
  r.check('Bild hängt an der Zeile', dran.n === 1);

  const sicht = await A.page.evaluate(`(function(){
    const p = ${JSON.stringify(dran.cid)}.split('|');
    setMode('use'); openStandard(p[0]); openRubrik(+p[1]);
    const zeile = document.getElementById('e-'+${JSON.stringify(dran.cid)});
    const img = zeile && zeile.querySelector('.med-streifen img');
    return { da: !!img, src: img ? img.getAttribute('src') : '' };
  })()`);
  r.check('das Bild erscheint als Streifen an der Zeile', sicht.da);
  r.check('… und zeigt auf /api/media/<Kennung>', /\/api\/media\/[0-9a-f]{32}/.test(sicht.src));

  /* Der entscheidende Punkt des ganzen Umbaus: Im geteilten Zustand — dem,
     was bei JEDER Änderung komplett zum Server wandert — steht das Kürzel und
     nicht das Bild. Geprüft wird über ALLE geteilten Schlüssel, weil ein Bild
     an einem Material als Regel im Journal landet und nicht in hkl_qedits. */
  const zustand = await A.page.evaluate(`(function(){
    const alles = {};
    SHARED_KEYS.forEach(k=>{ const v=store.get(k); if(v!=null) alles[k]=v; });
    const roh = JSON.stringify(alles);
    return { hatKennung: roh.indexOf(${JSON.stringify(hoch.k1)})>=0,
             hatBilddaten: roh.indexOf('data:image')>=0, laenge: roh.length };
  })()`);
  r.check('im geteilten Zustand steht die Kennung …', zustand.hatKennung);
  r.check('… und KEINE Bilddaten (' + zustand.laenge + ' Zeichen gesamt)', !zustand.hatBilddaten);

  /* Reichweite: dasselbe Material an allen Stellen. */
  const weit = await A.page.evaluate(`(function(){
    const cid = ${JSON.stringify(dran.cid)}, mk = ${JSON.stringify(dran.mk)};
    const e = findEntry(cid);
    sheetEntry=e; sheetCid=cid;
    medEintragen(cid, ${JSON.stringify(hoch.k1)}, 'mat');
    let treffer=0;
    DB.standards.forEach(s=>(s.rubriken||[]).forEach((rr,ri)=>(rr.sub_bereiche||[]).forEach((sb,si)=>(sb.eintraege||[]).forEach((x,ei)=>{
      if(x && x.material_key===mk && medVonEintrag(x, cidOf(s.id,ri,si,ei)).length) treffer++;
    }))));
    const journal = rulesActive(RULES).some(x=>x.prop==='bilder');
    return { treffer, journal };
  })()`);
  r.check('„überall" zeigt das Bild an allen Stellen des Materials (' + weit.treffer + ')', weit.treffer >= 1);
  r.check('… und steht als Regel im Journal (rücknehmbar)', weit.journal);

  /* Beschriftung + Entfernen. */
  const rest = await A.page.evaluate(`(function(){
    medTextSetzen(${JSON.stringify(hoch.k1)}, 'Coro-Set, geöffnet');
    const txt = medText(${JSON.stringify(hoch.k1)});
    const cid = ${JSON.stringify(dran.cid)};
    medEntfernen(cid, ${JSON.stringify(hoch.k1)}, 'cid');
    return { txt, weg: medVonEintrag(findEntry(cid), cid).length === 0 };
  })()`);
  r.check('Bildunterschrift wird gespeichert', rest.txt === 'Coro-Set, geöffnet');
  r.check('Bild lässt sich von der Zeile entfernen', rest.weg);

  /* Kaputte Werte dürfen nie ein kaputtes Bild werden („leer schlägt falsch"). */
  const robust = await A.page.evaluate(`(function(){
    return { a: medListe(null).length, b: medListe(['nope', 42, null]).length,
             c: medListe(['`+'a'.repeat(32)+`']).length };
  })()`);
  r.check('unbrauchbare Werte werden verworfen statt angezeigt', robust.a === 0 && robust.b === 0 && robust.c === 1);

  /* Verwaltung: der Bestand. */
  const panel = await A.page.evaluate(`(async function(){
    await medBestandLaden();
    setMode('admin');
    return { anzahl: MEDBESTAND && MEDBESTAND.anzahl,
             sichtbar: /Bilder/.test(document.getElementById('scr-admin').textContent) };
  })()`);
  r.check('Verwaltung zeigt den Bilderbestand (' + panel.anzahl + ')', panel.anzahl >= 1);
  r.check('… als eigene Karte', panel.sichtbar);

  r.check('keine Konsolenfehler', A.errs.length === 0);
  if (A.errs.length) console.error(A.errs.slice(0, 5).join('\n'));

  await r.finish(browser, [srv]);
})().catch(e => { console.error(e); process.exit(1); });
