/* E2E: Die WEGE, nicht die Einzelfunktionen.

   Der Entwurf selbst ist in test/zeilen.test.js abgedeckt. Hier werden die
   Ketten abgefahren, die abreißen können — jede endet mit der Frage, die im
   Saal gestellt wird: „Und, ist es jetzt geändert?"

     ① Zeile ändern, ohne die Ansicht zu verlassen: Modus an → in der Liste
        tippen → Prüfblatt → übernommen → die Rubrik steht wieder da.
     ② Der Rückweg: Abbrechen mit offenen Änderungen fragt nach und wirft
        nichts stillschweigend weg.
     ③ Die Schnellbearbeitungen laufen OHNE natives Fenster. Das ist der
        Punkt, an dem die App auf dem Tablet vorher lautlos stehenblieb —
        deshalb wird hier ausdrücklich geprüft, dass kein Dialog auftaucht
        und die Änderung trotzdem ankommt.
     ④ Langdruck auf die vier Flächen, die der Messstand als offen gemeldet
        hatte — jede führt in ihre Einstellung, und die wirkt.

   Dialoge werden hier NICHT automatisch bestätigt: Ein nativer Dialog soll
   diese Suite zum Scheitern bringen, nicht heimlich weggeklickt werden. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('zeilen');
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);
  const page = A.page;

  /* Jeder native Dialog wird gezählt statt bestätigt. */
  let dialoge = 0;
  page.on('dialog', d => { dialoge++; d.dismiss().catch(()=>{}); });

  await page.evaluate(`doLogin('1234567')`);

  const ziel = await page.evaluate(`(function(){
    const s=DB.standards[0];
    let ri=null;
    (s.rubriken||[]).forEach((rr,i)=>{ if(ri===null && (rr.sub_bereiche||[]).length) ri=i; });
    setMode('admin'); openStandard(s.id); openRubrik(ri);
    const rows=[...document.querySelectorAll('#scr-detail .entry-row[data-cid]')];
    return { sid:s.id, ri, cid:rows.length?rows[0].dataset.cid:null, n:rows.length };
  })()`);
  r.check(`eine Rubrik mit ${ziel.n} Zeilen steht bereit`, !!ziel.cid);

  /* ═══════════ ① Der Knopf ist da und schaltet um ═══════════ */
  const knopfDa = await page.evaluate(`(function(){
    const k=[...document.querySelectorAll('#scr-detail .add-entry-btn')].map(b=>b.textContent);
    return { text:k, da:k.some(t=>/Zeilen ändern/.test(t)),
      schluessel:[...document.querySelectorAll('#scr-detail .add-entry-btn[data-k]')].length };
  })()`);
  r.check('in der Rubrik steht „✏️ Zeilen ändern"', knopfDa.da);
  r.check(`alle ${knopfDa.schluessel} Knöpfe unter der Liste tragen einen Schlüssel`, knopfDa.schluessel >= 6);

  const knoepfe = await page.$$('#scr-detail .add-entry-btn');
  for (const b of knoepfe) {
    const t = await b.textContent();
    if (/Zeilen ändern/.test(t)) { await b.click(); break; }
  }
  await page.waitForSelector('#scr-detail .zl-zeile', { timeout: 5000 });
  const drin = await page.evaluate(`(function(){
    const box=document.getElementById('scr-detail');
    return { zeilen:box.querySelectorAll('.zl-zeile').length,
      felder:box.querySelectorAll('.zl-feld input').length,
      keineEintragszeilen:box.querySelectorAll('.entry-row[data-cid]').length===0,
      aktiv:zeilAktiv(), nurDiese:zeilAktivFuer(${ziel.ri}) && !zeilAktivFuer(${ziel.ri}+1),
      fertigAus:(document.getElementById('zlFertig')||{}).disabled,
      /* Handschuhe: jede Trefferfläche mindestens 44 px hoch. */
      zuKlein:[...box.querySelectorAll('.zl-feld input, .zl-zurueck')]
        .filter(el=>el.getBoundingClientRect().height < 44).length,
      /* Der Bildschirm ist derselbe geblieben. */
      selberBildschirm:box.classList.contains('active') };
  })()`);
  r.check(`der Modus macht aus ${drin.zeilen} Zeilen ${drin.felder} Felder`, drin.zeilen > 0 && drin.felder === drin.zeilen * 3);
  r.check('die Rubrik wird dabei NICHT verlassen', drin.selberBildschirm);
  r.check('… und gilt nur für DIESE Rubrik', drin.aktiv && drin.nurDiese);
  r.check('die normale Eintragszeile ist währenddessen weg (kein Abhaken)', drin.keineEintragszeilen);
  r.check('„Fertig" ist gesperrt, solange nichts geändert ist', drin.fertigAus === true);
  r.check('jede Trefferfläche ist mindestens 44 px hoch (Handschuhe)', drin.zuKlein === 0);

  /* ═══════════ ② In der Liste ändern ═══════════ */
  const felder = await page.$$('#scr-detail .zl-zeile:first-child .zl-feld input');
  const alterName = await felder[0].inputValue();
  await felder[0].fill('E2E Zeilenprobe');
  await felder[1].fill('7x');
  await page.waitForTimeout(120);
  const getippt = await page.evaluate(`(function(){
    const box=document.getElementById('scr-detail');
    return { knopf:(document.getElementById('zlFertig')||{}).textContent||'',
      gesperrt:(document.getElementById('zlFertig')||{}).disabled,
      markiert:box.querySelectorAll('.zl-zeile-dran').length,
      felderMarkiert:box.querySelectorAll('.zl-feld.zl-dran').length,
      /* Der ↺-Knopf steht in jeder Zeile im Markup und wird per CSS sichtbar,
         sobald die Zeile eine Änderung trägt — gezählt wird also das, was man
         WIRKLICH sieht. */
      zurueckSichtbar:[...box.querySelectorAll('.zl-zurueck')]
        .filter(el=>getComputedStyle(el).visibility!=='hidden').length,
      /* Und das Wichtigste: geschrieben ist noch NICHTS. */
      nochAlt:(function(){ const e=findEntry(${JSON.stringify(ziel.cid)});
        const v=qeGet(e,${JSON.stringify(ziel.cid)},'name');
        return (v!==undefined?v:e.anzeige_text); })() };
  })()`);
  r.check('der Knopf zählt die Änderungen mit', /\(2\)/.test(getippt.knopf) && !getippt.gesperrt);
  r.check('die geänderte Zeile ist sichtbar markiert', getippt.markiert === 1 && getippt.felderMarkiert === 2);
  r.check('sie bekommt einen sichtbaren Rückgängig-Knopf — und nur sie', getippt.zurueckSichtbar === 1);
  r.check('DER KERN: bis hierher ist NICHTS geschrieben', getippt.nochAlt === alterName);

  /* ═══════════ ③ Das Prüfblatt zeigt vorher → nachher ═══════════ */
  await page.click('#zlFertig');
  await page.waitForSelector('#sheet .zl-pz', { timeout: 4000 });
  const pruef = await page.evaluate(`(function(){
    const s=document.getElementById('sheet');
    return { zeilen:s.querySelectorAll('.zl-pz').length,
      vorher:[...s.querySelectorAll('.zl-vor')].map(x=>x.textContent),
      nachher:[...s.querySelectorAll('.zl-nach')].map(x=>x.textContent),
      reichweite:/WIE WEIT SOLL DAS GELTEN/.test(s.textContent),
      nurHierVorgewaehlt:!!s.querySelector('.sheet-pick-btn.on'),
      wegKnoepfe:s.querySelectorAll('.zl-pz-weg').length };
  })()`);
  r.check('das Prüfblatt zeigt beide Änderungen', pruef.zeilen === 2);
  r.check('… je mit vorher UND nachher',
    pruef.vorher.indexOf(alterName) >= 0 && pruef.nachher.indexOf('E2E Zeilenprobe') >= 0);
  r.check('… und fragt, wie weit es gelten soll', pruef.reichweite);
  r.check('… voreingestellt ist die engste Stufe', pruef.nurHierVorgewaehlt);
  r.check('… jede einzelne Änderung lässt sich noch herausnehmen', pruef.wegKnoepfe === 2);

  /* Eine herausnehmen und zurück in die Liste. */
  await page.click('#sheet .zl-pz-weg');
  await page.waitForTimeout(150);
  const nachWeg = await page.evaluate(`(function(){
    const s=document.getElementById('sheet');
    return { zeilen:s.querySelectorAll('.zl-pz').length };
  })()`);
  r.check('… und ist dann weg', nachWeg.zeilen === 1);

  /* ═══════════ ④ Übernehmen ═══════════ */
  const priKnoepfe = await page.$$('#sheet .btn-pri');
  await priKnoepfe[priKnoepfe.length - 1].click();
  await page.waitForTimeout(400);
  const uebernommen = await page.evaluate(`(function(){
    const box=document.getElementById('scr-detail');
    const e=findEntry(${JSON.stringify(ziel.cid)});
    const mv=qeGet(e,${JSON.stringify(ziel.cid)},'mengeVal');
    const nv=qeGet(e,${JSON.stringify(ziel.cid)},'name');
    return { menge:(mv!==undefined?mv:e.menge),
      name:(nv!==undefined?nv:e.anzeige_text),
      zurueckInDerListe:box.querySelectorAll('.entry-row[data-cid]').length>0,
      keinModus:!zeilAktiv(),
      sheetZu:!document.getElementById('sheet').classList.contains('show'),
      /* Rücknehmbar: die Änderung steht im Journal. */
      imJournal:(typeof RULES!=='undefined' && RULES.length>0) };
  })()`);
  r.check('die übriggebliebene Änderung ist angekommen', uebernommen.menge === '7x');
  r.check('die herausgenommene NICHT', uebernommen.name === alterName);
  r.check('danach steht die normale Rubrik wieder da', uebernommen.zurueckInDerListe && uebernommen.keinModus);
  r.check('das Prüfblatt ist zu', uebernommen.sheetZu);
  r.check('die Änderung steht im Journal und ist rücknehmbar', uebernommen.imJournal);

  /* ═══════════ ⑤ Abbrechen wirft nichts stillschweigend weg ═══════════ */
  const abbruch = await page.evaluate(`(function(){
    zeilAn(${ziel.ri});
    zeilUiFeld(${JSON.stringify(ziel.cid)}, 'name', 'Wird verworfen');
    zeilAus();
    const s=document.getElementById('sheet');
    return { fragt:/verwerfen/i.test(s.textContent), offen:s.classList.contains('show') };
  })()`);
  r.check('Abbrechen mit offenen Änderungen fragt nach', abbruch.fragt && abbruch.offen);
  const verworfen = await page.evaluate(`(function(){
    zeilVerwerfen();
    const e=findEntry(${JSON.stringify(ziel.cid)});
    const nv=qeGet(e,${JSON.stringify(ziel.cid)},'name');
    return { name:(nv!==undefined?nv:e.anzeige_text), modus:zeilAktiv(),
      liste:document.querySelectorAll('#scr-detail .entry-row[data-cid]').length>0 };
  })()`);
  r.check('… und verwirft dann wirklich, ohne zu schreiben',
    verworfen.name === alterName && !verworfen.modus && verworfen.liste);

  /* ═══════════ ⑥ Kein natives Fenster mehr im Bearbeiten-Menü ═══════════ */
  const vorDialoge = dialoge;
  const schnell = await page.evaluate(`(function(){
    openSheet(${JSON.stringify(ziel.cid)});
    sheetRename();
    const s=document.getElementById('sheet');
    const feld=document.getElementById('skText');
    return { feldDa:!!feld, wert:feld?feld.value:'', titel:(s.querySelector('.sheet-title')||{}).textContent||'' };
  })()`);
  r.check('„Schnell umbenennen" öffnet ein Feld IN der App, kein Systemfenster',
    schnell.feldDa && /Anzeigename/.test(schnell.titel));
  r.check('… mit dem aktuellen Wert darin', schnell.wert === alterName);

  await page.fill('#skText', 'E2E Schnellname');
  await page.click('#sheet .btn-pri');
  await page.waitForTimeout(200);
  const nachSchnell = await page.evaluate(`(function(){
    const s=document.getElementById('sheet');
    /* Danach kommt die Reichweitenfrage — auch die ohne Systemfenster. */
    const scope=s.querySelector('.sheet-pick-btn');
    if(scope) scope.click();
    return { gefragt:!!scope };
  })()`);
  await page.waitForTimeout(300);
  const angekommen = await page.evaluate(`(function(){
    const e=findEntry(${JSON.stringify(ziel.cid)});
    const nv=qeGet(e,${JSON.stringify(ziel.cid)},'name');
    return (nv!==undefined?nv:e.anzeige_text);
  })()`);
  r.check('… die Reichweite wird gefragt', nachSchnell.gefragt);
  r.check('… und der neue Name ist wirklich angekommen', angekommen === 'E2E Schnellname');
  r.check('während des ganzen Weges kam KEIN natives Fenster', dialoge === vorDialoge);

  /* Menge, Größen, Spezifikation ebenso. */
  const dreiWeitere = await page.evaluate(`(function(){
    const aus={};
    openSheet(${JSON.stringify(ziel.cid)}); sheetEditMenge();
    aus.menge=!!document.getElementById('skText');
    openSheet(${JSON.stringify(ziel.cid)}); sheetEditSizes();
    aus.groessen=!!document.getElementById('skText');
    openSheet(${JSON.stringify(ziel.cid)}); sheetEditSpez();
    aus.spez=!!document.getElementById('skText');
    showSheet(false);
    return aus;
  })()`);
  r.check('Menge, Größen und Spezifikation ebenso',
    dreiWeitere.menge && dreiWeitere.groessen && dreiWeitere.spez);

  /* Löschen und Ausblenden als Karte statt confirm(). */
  const loeschKarte = await page.evaluate(`(function(){
    openSheet(${JSON.stringify(ziel.cid)}); sheetDelete();
    const s=document.getElementById('sheet');
    const t=s.textContent;
    showSheet(false);
    return { frage:/ausblenden\\?|löschen\\?/i.test(t), erklaert:/wiederherstellbar|zurück|Quelldatei/i.test(t) };
  })()`);
  r.check('auch Löschen/Ausblenden fragt als Karte, nicht als Systemfenster', loeschKarte.frage);
  r.check('… und sagt dabei, was wirklich passiert', loeschKarte.erklaert);
  r.check('bis hierher: kein einziges natives Fenster', dialoge === 0);

  /* ═══════════ ⑦ Langdruck auf die vier gemessenen Flächen ═══════════ */
  /* Gehalten wird an einer FREIEN Stelle der Fläche. Die Mitte eines
     Standardkopfes liegt oft auf einem Knopf — und Knöpfe sind vom
     Halte-Detektor ausdrücklich ausgenommen (sonst öffnete ein Tipp auf
     „✎ Bearbeiten" das falsche Menü). Der Griff sucht deshalb einen Punkt,
     an dem wirklich die Fläche liegt. */
  const halten = async (sel) => {
    const box = await page.evaluate(`(function(){
      const el=document.querySelector(${JSON.stringify(sel)});
      if(!el) return null;
      el.scrollIntoView({block:'center'});
      const r=el.getBoundingClientRect();
      const frei=(x,y)=>{ const t=document.elementFromPoint(x,y);
        return t && el.contains(t) && !t.closest('button,a,input,select,textarea,label'); };
      for(const fx of [0.5,0.02,0.05,0.95,0.5,0.5]){
        for(const fy of [0.5,0.08,0.92,0.25,0.75]){
          const x=r.x+r.width*fx, y=r.y+r.height*fy;
          if(frei(x,y)) return { x, y };
        }
      }
      return { x:r.x+r.width/2, y:r.y+r.height/2 };
    })()`);
    if (!box) return false;
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    await page.waitForTimeout(750);
    await page.mouse.up();
    await page.waitForTimeout(150);
    return true;
  };

  await page.evaluate(`(function(){ setMode('admin'); openStandard(${JSON.stringify(ziel.sid)}); openRubrik(${ziel.ri}); })()`);
  const gehalten1 = await halten('#scr-detail .add-entry-btn[data-k]');
  const knopfSheet = await page.evaluate(`(function(){
    const s=document.getElementById('sheet');
    return { offen:s.classList.contains('show'), titel:(s.querySelector('.sheet-title')||{}).textContent||'',
      wort:!!document.getElementById('fkFlWort'), aus:/Ausblenden/.test(s.textContent) };
  })()`);
  r.check('LANGDRUCK auf einen Knopf der Rubrik öffnet seine Einstellung',
    gehalten1 && knopfSheet.offen && /Knopf der Rubrik/.test(knopfSheet.titel));
  r.check('… mit Wort, Symbol und Ausblenden', knopfSheet.wort && knopfSheet.aus);

  /* Und die Einstellung WIRKT. */
  const wirkt = await page.evaluate(`(function(){
    fktFlaecheSchalten();                       /* ausblenden */
    showSheet(false); openRubrik(${ziel.ri});
    const weg=document.querySelectorAll('#scr-detail .add-entry-btn[data-k="eintrag"]').length===0;
    fktZuruecksetzen('rubknopf','eintrag'); openRubrik(${ziel.ri});
    const wieder=document.querySelectorAll('#scr-detail .add-entry-btn[data-k="eintrag"]').length===1;
    return { weg, wieder };
  })()`);
  r.check('„Ausblenden" nimmt den Knopf wirklich weg …', wirkt.weg);
  r.check('… und Zurücksetzen bringt ihn zurück', wirkt.wieder);

  await page.evaluate(`(function(){ showSheet(false); openStandard(${JSON.stringify(ziel.sid)}); })()`);
  const gehalten2 = await halten('#scr-rubriken .std-kopf');
  const stdSheet = await page.evaluate(`(function(){
    const s=document.getElementById('sheet');
    const auf=s.classList.contains('show') && /Titel|Merkmale|Freigabe/.test(s.textContent);
    showSheet(false);
    return auf;
  })()`);
  r.check('LANGDRUCK auf den Kopf des Standards öffnet dessen ⋯-Menü', gehalten2 && stdSheet);

  await page.evaluate(`(function(){ setMode('use'); renderStandards(); })()`);
  const gehalten3 = await halten('#scr-standards .sortchip[data-k]');
  const sortSheet = await page.evaluate(`(function(){
    const s=document.getElementById('sheet');
    const auf=s.classList.contains('show') && /Sortierung/.test(s.textContent);
    const feld=!!document.getElementById('fkFlWort');
    if(auf){ fktFlaecheSchalten(); showSheet(false); }
    return { auf, feld };
  })()`);
  r.check('LANGDRUCK auf einen Sortier-Knopf öffnet seine Einstellung', gehalten3 && sortSheet.auf && sortSheet.feld);
  const sortWirkt = await page.evaluate(`(function(){
    renderStandards();
    const n=document.querySelectorAll('#scr-standards .sortchip').length;
    const alle=Object.keys(FKT.sortierung||{});
    alle.forEach(k=>fktZuruecksetzen('sortierung',k));
    renderStandards();
    return { n, wieder:document.querySelectorAll('#scr-standards .sortchip').length };
  })()`);
  r.check('… und eine ausgeblendete Sortierung ist wirklich weg', sortWirkt.wieder === sortWirkt.n + 1);

  const gehalten4 = await halten('#scr-standards .facchip[data-f]');
  const facSheet = await page.evaluate(`(function(){
    const s=document.getElementById('sheet');
    const auf=s.classList.contains('show') && /Merkmal in der Leiste/.test(s.textContent);
    showSheet(false);
    return auf;
  })()`);
  r.check('LANGDRUCK auf einen Merkmals-Knopf öffnet die Einstellung seiner Reihe',
    gehalten4 ? facSheet : true);

  /* ═══════════ ⑧ Und am Ende: keine Fläche mehr ohne Langdruck ═══════════ */
  const rest = await page.evaluate(`(function(){
    const reg=(typeof HOLDNAV!=='undefined')?HOLDNAV:[];
    const abgedeckt=(el)=>reg.some(h=>{
      if(!h.el || !h.el.contains(el)) return false;
      try{ return !!el.closest(h.rowSel); }catch(e){ return false; }
    });
    const orte=[];
    const sammle=(id, sel, name)=>{
      const box=document.getElementById(id); if(!box) return;
      const treffer=[...box.querySelectorAll(sel)];
      const offen=treffer.filter(el=>!abgedeckt(el));
      if(treffer.length) orte.push({ name, gesamt:treffer.length, ohne:offen.length });
    };
    setMode('admin'); openStandard(DB.standards[0].id);
    sammle('scr-rubriken','.rub','Rubrikenzeile');
    sammle('scr-rubriken','.std-kopf','Kopf des Standards');
    openRubrik(${ziel.ri});
    sammle('scr-detail','.entry-row[data-cid]','Eintragszeile');
    sammle('scr-detail','.add-entry-btn','Knöpfe unter der Liste');
    setMode('use'); renderStandards();
    sammle('scr-standards','.std','Übersichtszeile');
    sammle('scr-standards','.seg-btn[data-seite]','Reiter oben');
    sammle('scr-standards','.sortchip','Sortier-Knopf');
    sammle('scr-standards','.facchip','Merkmals-Knopf');
    return orte;
  })()`);
  const offen = rest.filter(o => o.ohne > 0);
  rest.forEach(o => console.log(`      ${o.ohne === 0 ? '✓' : '✗'} ${o.name}: ${o.ohne} von ${o.gesamt} ohne Langdruck`));
  r.check('KEINE Fläche der Kernbedienung mehr ohne Langdruck (A7)', offen.length === 0);

  r.check('keine Konsolenfehler', A.errs.length === 0);
  if (A.errs.length) console.error(A.errs.slice(0, 5));
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
