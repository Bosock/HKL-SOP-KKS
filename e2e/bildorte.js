/* E2E: Wo Bilder stehen dürfen (features/bildorte.js).

   Die Schalterlogik selbst deckt test/bildorte.test.js ab. Hier geht es um
   das, was ein Sandkasten nicht zeigen kann: Verschwindet das Bild WIRKLICH
   aus der Ansicht — und kommt es wirklich zurück?

     · Ist ausgeliefert alles so wie vorher?
     · „Bilder aus" an einer Art → das Bild ist im Bildschirm weg, die Bilder
       der anderen Arten stehen noch da.
     · „Symbol aus" → das Bild bleibt, nur der Weg zum Hinzufügen fällt weg.
       (Der Unterschied zwischen den zwei Schaltern ist der ganze Punkt.)
     · Der ⋯-Punkt „Bilder" verschwindet mit dem Symbol — sonst legte man
       Bilder an, die niemand sieht.
     · Und die Zusage, die über allem steht: Ausschalten LÖSCHT NICHTS.
     · Neu: ein Aushang auf der Pinnwand darf ein Foto tragen.

   Alles läuft über echte Bilder auf dem echten Server — sonst prüfte diese
   Suite nur, ob Zeichenketten zusammenpassen. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('bildorte');
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);
  await A.page.evaluate(`doLogin('1234567')`);

  /* ═══════════ 1. Ausgeliefert ist alles an ═══════════ */
  const aus = await A.page.evaluate(`(function(){
    return { alles:bildAllesAn(), n:bildOrte().length,
      keinerAus:bildOrte().every(o=>!o.aus && !o.ohneKnopf),
      geaendert:bildOrteGeaendert(),
      zeigtZeile:bildZeigen('S|0|0|0'), zeigtRubrik:bildZeigen('rub:S|0') };
  })()`);
  r.check(`ausgeliefert sind alle ${aus.n} Stellen an`, aus.alles && aus.keinerAus && aus.n === 6);
  r.check('… und nichts ist gespeichert', !aus.geaendert);
  r.check('… Bilder werden überall gezeigt', aus.zeigtZeile && aus.zeigtRubrik);

  /* ═══════════ 2. Ein echtes Bild an eine Zeile UND an eine Rubrik ═══════════ */
  const vorbereitet = await A.page.evaluate(`(async function(){
    const c=document.createElement('canvas'); c.width=8; c.height=8;
    c.getContext('2d').fillStyle='#3d9be0'; c.getContext('2d').fillRect(0,0,8,8);
    const blob=await new Promise(ok=>c.toBlob(ok,'image/png'));
    const k=await medHochladen(blob);
    const s=DB.standards[0];
    let cid=null, ri=null;
    (s.rubriken||[]).forEach((rr,i)=>(rr.sub_bereiche||[]).forEach((sb,si)=>(sb.eintraege||[]).forEach((e,ei)=>{
      if(!cid && e && !e.ist_fliesstext && e.natur!=='ueberschrift'){ cid=cidOf(s.id,i,si,ei); ri=i; }
    })));
    if(!cid) return { kein:true };
    medEintragen(cid, k, 'cid');
    medAnkerSchreiben(medAnkRub(s.id, ri), [{k, g:'klein'}]);
    setMode('use'); openStandard(s.id); openRubrik(ri);
    return { kein:false, k, cid, ri, sid:s.id,
      zeile:document.querySelectorAll('#e-'+CSS.escape(cid)+' .med-streifen img').length,
      anker:document.querySelectorAll('#scr-detail .med-anker img').length };
  })()`);
  r.check('ein Bild hängt an der Zeile und ist sichtbar', !vorbereitet.kein && vorbereitet.zeile === 1);
  r.check('ein Bild hängt an der Rubrik und ist sichtbar', vorbereitet.anker >= 1);

  /* ═══════════ 3. „Bilder aus" an der ZEILE ═══════════ */
  const zeileAus = await A.page.evaluate(`(function(){
    bildOrtSchalten('eintrag');
    openRubrik(${vorbereitet.ri});
    return { zeile:document.querySelectorAll('#e-'+CSS.escape(${JSON.stringify(vorbereitet.cid)})+' .med-streifen img').length,
      anker:document.querySelectorAll('#scr-detail .med-anker img').length,
      /* Der Speicher ist unangetastet. */
      nochGespeichert:medVonEintrag(findEntry(${JSON.stringify(vorbereitet.cid)}), ${JSON.stringify(vorbereitet.cid)}).length };
  })()`);
  r.check('„Bilder aus" nimmt das Bild an der ZEILE aus der Ansicht', zeileAus.zeile === 0);
  r.check('… die Bilder der Rubrik stehen unberührt weiter da', zeileAus.anker >= 1);
  r.check('… und gelöscht ist nichts', zeileAus.nochGespeichert === 1);

  /* Der ⋯-Punkt muss mitverschwinden. */
  const menue = await A.page.evaluate(`(function(){
    openSheet(${JSON.stringify(vorbereitet.cid)});
    const ohne = document.getElementById('sheet').textContent;
    bildOrtSchalten('eintrag');            /* wieder an */
    openRubrik(${vorbereitet.ri});
    openSheet(${JSON.stringify(vorbereitet.cid)});
    const mit = document.getElementById('sheet').textContent;
    showSheet(false);
    return { ohneBilder:!/Bilder/.test(ohne), mitBildern:/Bilder/.test(mit),
      wiederDa:document.querySelectorAll('#e-'+CSS.escape(${JSON.stringify(vorbereitet.cid)})+' .med-streifen img').length };
  })()`);
  r.check('mit dem Symbol verschwindet auch „⋯ → Bilder"', menue.ohneBilder);
  r.check('… und kommt mit ihm zurück', menue.mitBildern);
  r.check('DER KERN: nach dem Wiedereinschalten ist das Bild sofort wieder da', menue.wiederDa === 1);

  /* ═══════════ 4. „Symbol aus" — der andere Schalter ═══════════ */
  const symbolAus = await A.page.evaluate(`(function(){
    bildKnopfSchalten('rubrik');
    openRubrik(${vorbereitet.ri});
    const bilder=document.querySelectorAll('#scr-detail .med-anker img').length;
    const knopf=document.querySelectorAll('#scr-detail .med-anker .med-plus').length;
    bildKnopfSchalten('rubrik');
    openRubrik(${vorbereitet.ri});
    return { bilder, knopf, knopfWiederDa:document.querySelectorAll('#scr-detail .med-plus').length>0 };
  })()`);
  r.check('„Symbol aus" lässt die Bilder stehen …', symbolAus.bilder >= 1);
  r.check('… und nimmt nur den Weg zum Hinzufügen weg', symbolAus.knopf === 0);
  r.check('… rückgängig kommt der Weg zurück', symbolAus.knopfWiederDa);

  /* ═══════════ 5. Der große Schalter ═══════════ */
  const allesAus = await A.page.evaluate(`(function(){
    bildAllesSchalten(false);
    openRubrik(${vorbereitet.ri});
    const n=document.querySelectorAll('#scr-detail img[data-zoom]').length;
    const knoepfe=document.querySelectorAll('#scr-detail .med-plus').length;
    bildAllesSchalten(true);
    openRubrik(${vorbereitet.ri});
    return { n, knoepfe, wieder:document.querySelectorAll('#scr-detail img[data-zoom]').length };
  })()`);
  r.check('„Alle Bilder ausblenden" räumt den Bildschirm leer', allesAus.n === 0 && allesAus.knoepfe === 0);
  r.check('… und ein Tipp bringt alles zurück', allesAus.wieder >= 2);

  /* ═══════════ 6. Neu: ein Foto am Aushang der Pinnwand ═══════════ */
  const pinn = await A.page.evaluate(`(function(){
    const s=seiteAnlegen('aktuelles'); curSeg=s.id;
    const x=aktAnlegen({ wort:'HKL 3 — Spritzenpumpe defekt', art:'wartung' });
    medAnkerSchreiben(medAnkAkt(x.id), [{k:${JSON.stringify(vorbereitet.k)}, g:'mittel'}]);
    setMode('use'); seiteAuffrischen();
    return { seite:s.id, id:x.id,
      karte:document.querySelectorAll('#scr-standards .akt-karte').length,
      bild:document.querySelectorAll('#scr-standards .akt-karte .med-anker img').length,
      istAnker:medIstAnker(medAnkAkt(x.id)), art:bildArtVonOrt(medAnkAkt(x.id)) };
  })()`);
  r.check('ein Aushang trägt ein Foto — „so sieht das Gerät gerade aus"',
    pinn.karte === 1 && pinn.bild === 1);
  r.check('… und zählt als eigene Stellen-Art „Aushang"',
    pinn.istAnker && pinn.art === 'aushang');

  const pinnAus = await A.page.evaluate(`(function(){
    bildOrtSchalten('aushang');
    seiteAuffrischen();
    const weg=document.querySelectorAll('#scr-standards .akt-karte .med-anker img').length;
    const karteBleibt=document.querySelectorAll('#scr-standards .akt-karte').length;
    bildOrtSchalten('aushang'); seiteAuffrischen();
    return { weg, karteBleibt, wieder:document.querySelectorAll('#scr-standards .akt-karte .med-anker img').length,
      bestand:bildOrtBestand('aushang') };
  })()`);
  r.check('auch am Aushang lässt sich das Bild abschalten …', pinnAus.weg === 0 && pinnAus.karteBleibt === 1);
  r.check('… ohne den Aushang selbst anzutasten, und es kommt zurück',
    pinnAus.wieder === 1 && pinnAus.bestand === 1);

  /* ═══════════ 7. Die Verwaltung ═══════════ */
  const panel = await A.page.evaluate(`(function(){
    setMode('admin');
    const box=document.getElementById('scr-admin');
    const p=[...box.querySelectorAll('.vpanel')].find(d=>/Wo Bilder stehen/.test(d.textContent));
    if(!p) return { kein:true };
    return { kein:false,
      zeilen:p.querySelectorAll('.fkt-zeile').length,
      schalter:/Bilder aus/.test(p.textContent),
      symbolschalter:/Symbol aus/.test(p.textContent),
      grossSchalter:/Alle Bilder ausblenden/.test(p.textContent),
      zusage:/nichts gelöscht/.test(p.textContent),
      zahl:/Bild(er)? hier/.test(p.textContent) };
  })()`);
  r.check('die Karte „Wo Bilder stehen" steht in der Verwaltung', !panel.kein && panel.zeilen === 6);
  r.check('… mit beiden Schaltern je Stelle', panel.schalter && panel.symbolschalter);
  r.check('… dem großen Schalter darüber', panel.grossSchalter);
  r.check('… der Zusage, dass nichts gelöscht wird', panel.zusage);
  r.check('… und der Zahl der Bilder, die dort liegen', panel.zahl);

  const umbenannt = await A.page.evaluate(`(function(){
    bildPanelFeld('rubrik','wort','Fotos der Rubrik');
    bildPanelFeld('rubrik','ico','📸');
    setMode('use'); openStandard(${JSON.stringify(vorbereitet.sid)}); openRubrik(${vorbereitet.ri});
    const knopf=document.querySelector('#scr-detail .med-plus');
    const text=knopf?knopf.textContent:'';
    bildPanelZuruecksetzen();
    setMode('use'); openStandard(${JSON.stringify(vorbereitet.sid)}); openRubrik(${vorbereitet.ri});
    const zurueck=document.querySelector('#scr-detail .med-plus');
    return { text, zurueck:zurueck?zurueck.textContent:'', geaendert:bildOrteGeaendert(),
      bilderDa:document.querySelectorAll('#scr-detail .med-anker img').length };
  })()`);
  r.check('das Symbol lässt sich umbenennen und wirkt am Ort', /📸/.test(umbenannt.text));
  r.check('„Auf Auslieferung zurücksetzen" stellt alles her',
    !umbenannt.geaendert && /🖼/.test(umbenannt.zurueck));
  r.check('… und die Bilder haben das alles unbeschadet überstanden', umbenannt.bilderDa >= 1);

  /* ═══════════ 8. Der Zustand überlebt einen Neustart ═══════════ */
  await A.page.evaluate(`(function(){ bildOrtSchalten('eintrag'); bildAllesSchalten(false); })()`);
  await A.page.waitForTimeout(600);
  const B = await bootPage(browser, srv.base);
  const neu = await B.page.evaluate(`(function(){
    return { alles:bildAllesAn(), zeile:!bildOrtNach('eintrag').aus, geaendert:bildOrteGeaendert() };
  })()`);
  r.check('die Einstellung überlebt einen Neustart und gilt am zweiten Gerät',
    neu.alles === false && neu.zeile === false && neu.geaendert);

  r.check('keine Konsolenfehler', A.errs.length === 0 && B.errs.length === 0);
  if (A.errs.length) console.error(A.errs.slice(0, 5));
  if (B.errs.length) console.error(B.errs.slice(0, 5));
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
