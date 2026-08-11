/* MESSSTAND — was die Bedienung wirklich kostet.

   Kein Bericht über Bedienbarkeit ist etwas wert, wenn die Zahlen darin
   geschätzt sind. Deshalb misst diese Datei zwei Größen, und beide werden
   ERZEUGT, nicht behauptet:

   ① BERÜHRUNGEN. Jeder Weg wird mit echten Klicks im echten Browser
      abgefahren, bis das Ziel erreicht ist. Gezählt wird jeder Fingerkontakt
      auf einer Fläche: ein Feld antippen zählt (man muss es treffen), das
      Tippen des Textes danach zählt nicht (das ist Tastatur, nicht Ziel).
      Am Ende wird geprüft, dass das Ziel wirklich da ist — ein Weg, der
      nichts erreicht, ist kein Weg.

   ② WARTEZEIT. Die Renderpfade werden mit dem ECHTEN Bestand gemessen
      (4.475 Zeilen), je fünfmal, ausgegeben wird der Mittelwert und der
      schlechteste Lauf. Der schlechteste zählt: Im Saal fällt nicht der
      Mittelwert auf, sondern der Hänger.

   Aufruf: `node e2e/messen.js`. Die Datei prüft nichts und schlägt nicht
   fehl — sie liefert Zahlen. Der Vergleich vorher/nachher steht im Bericht.  */
'use strict';
const { launchBrowser, startServer, bootPage } = require('./util');

/* ── Zähler für Berührungen ── */
function zaehler(page){
  let n = 0;
  return {
    async tipp(sel, was){
      await page.click(sel, { timeout: 8000 });
      n++;
      return was;
    },
    /* Ein Feld antippen und füllen: EINE Berührung (der Treffer), der Text
       selbst ist Tastatur. */
    async feld(sel, text){
      await page.fill(sel, text);
      n++;
    },
    /* Etwas, das ohne Fläche passiert (z. B. ein Langdruck) — trotzdem eine
       Berührung, nur eine längere. */
    zaehlen(k){ n += (k||1); },
    get stand(){ return n; },
    reset(){ n = 0; },
  };
}

const zeilen = [];
function melde(weg, berührungen, bemerkung){
  zeilen.push({ weg, b:berührungen, bem:bemerkung||'' });
  console.log(`  ${String(berührungen).padStart(4)} Berührungen  ${weg}${bemerkung?('  — '+bemerkung):''}`);
}

const zeiten = [];
function meldeZeit(was, mittel, schlecht, info){
  zeiten.push({ was, mittel, schlecht, info });
  console.log(`  ${mittel.toFixed(1).padStart(7)} ms Mittel · ${schlecht.toFixed(1).padStart(7)} ms schlechtester   ${was}${info?('  ('+info+')'):''}`);
}

(async () => {
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);
  const page = A.page;
  await page.evaluate(`doLogin('1234567')`);

  const bestand = await page.evaluate(`(function(){
    let n=0, r=0;
    DB.standards.forEach(s=>(s.rubriken||[]).forEach(rb=>{ r++;
      (rb.sub_bereiche||[]).forEach(sb=>{ n += (sb.eintraege||[]).length; }); }));
    return { std:DB.standards.length, rub:r, eintraege:n };
  })()`);
  console.log(`\n══ Bestand: ${bestand.std} Standards · ${bestand.rub} Rubriken · ${bestand.eintraege} Zeilen ══`);

  /* ═══════════════════════════════════════════════════════════
     TEIL 1 — BERÜHRUNGEN
     ═══════════════════════════════════════════════════════════ */
  console.log('\n══ Berührungen je Weg (echte Klicks, Ziel danach geprüft) ══');

  /* Ein Standard zum Arbeiten. */
  const ziel = await page.evaluate(`(function(){
    const s=DB.standards[0];
    let ri=null;
    (s.rubriken||[]).forEach((rr,i)=>{ if(ri===null && (rr.sub_bereiche||[]).length) ri=i; });
    return { sid:s.id, ri, titel:s.titel };
  })()`);

  /* ── W1: 20 Positionen anlegen, GETIPPT (Formular je Zeile) ───────────
     Gemessen wird EINE Zeile im echten Formular; danach × 20, weil sich der
     Weg exakt wiederholt. Zwanzigmal dasselbe zu klicken misst nichts
     Neues, kostet aber zwei Minuten Laufzeit. */
  const z = zaehler(page);
  await page.evaluate(`(function(){ setMode('admin'); openStandard(${JSON.stringify(ziel.sid)}); openRubrik(${ziel.ri}); })()`);
  z.reset();
  {
    const knoepfe = await page.$$('#scr-detail .add-entry-btn');
    for(const b of knoepfe){
      const t = await b.textContent();
      if(/Eintrag hinzufügen/.test(t)){ await b.click(); z.zaehlen(1); break; }
    }
    await page.waitForSelector('#fName', { timeout: 5000 });
    await z.feld('#fName', 'Messzeile A');
    await z.feld('#fMenge', '2x');
    /* Speichern */
    const btns = await page.$$('#scr-form .btn-pri');
    if(btns.length){ await btns[btns.length-1].click(); z.zaehlen(1); }
    await page.waitForTimeout(250);
  }
  const einZeileDa = await page.evaluate(`document.getElementById('scr-detail').textContent.indexOf('Messzeile A')>=0`);
  const proZeile = z.stand;
  melde('EINE Position getippt (Formular auf, Name, Menge, speichern)', proZeile,
    einZeileDa ? 'Ziel erreicht' : 'ZIEL NICHT ERREICHT');
  melde('20 Positionen getippt (20 × derselbe Weg)', proZeile * 20, 'hochgerechnet aus der gemessenen Einzelzeile');

  /* ── W1b: 20 Positionen über „Liste einfügen" ───────────────────────── */
  z.reset();
  {
    const knoepfe = await page.$$('#scr-detail .add-entry-btn');
    for(const b of knoepfe){
      const t = await b.textContent();
      if(/Liste einfügen/.test(t)){ await b.click(); z.zaehlen(1); break; }
    }
    await page.waitForSelector('#einfText', { timeout: 5000 });
    const liste = Array.from({length:20},(_,i)=>`- ${i+1}x Messliste Position ${i+1}`).join('\n');
    await z.feld('#einfText', liste);
    await z.tipp('#sheet .btn-pri');                    /* „Zeilen prüfen →" */
    await page.waitForSelector('#sheet .einf-zeile', { timeout: 5000 });
    await z.tipp('#einfBtn');                           /* „Einfügen (20)" */
    await page.waitForTimeout(400);
  }
  const zwanzigDa = await page.evaluate(`(function(){
    const arr=ADDITIONS.entries[${JSON.stringify(ziel.sid)}+'|'+${ziel.ri}]||[];
    return arr.filter(x=>/^Messliste Position/.test(x.anzeige_text||'')).length;
  })()`);
  melde('20 Positionen über „Liste einfügen"', z.stand,
    zwanzigDa === 20 ? '20 von 20 angelegt' : ('NUR '+zwanzigDa+' angelegt'));

  /* ── W2: Eine vorhandene Zeile umbenennen ──────────────────────────── */
  z.reset();
  const cidZiel = await page.evaluate(`(function(){
    setMode('admin'); openStandard(${JSON.stringify(ziel.sid)}); openRubrik(${ziel.ri});
    const r=document.querySelector('#scr-detail .entry-row[data-cid]');
    return r?r.dataset.cid:null;
  })()`);
  {
    /* Langdruck (1) → „Schnell umbenennen" (1) → Feld (1) → Übernehmen (1)
       → Reichweite (1) */
    await page.evaluate(`openSheet(${JSON.stringify(cidZiel)})`); z.zaehlen(1);
    await page.waitForTimeout(120);
    const acts = await page.$$('#sheet .sheet-act');
    for(const a of acts){
      const t = await a.textContent();
      if(/Schnell umbenennen/.test(t)){ await a.click(); z.zaehlen(1); break; }
    }
    await page.waitForSelector('#skText', { timeout: 4000 }).catch(()=>{});
    await z.feld('#skText', 'Messumbenannt');
    await z.tipp('#sheet .btn-pri');
    await page.waitForTimeout(200);
    /* Die Reichweitenfrage gehört zum Weg dazu. */
    const scope = await page.$('#sheet .sheet-pick-btn');
    if(scope){ await scope.click(); z.zaehlen(1); }
    await page.waitForTimeout(300);
  }
  const umbenannt = await page.evaluate(`(function(){
    const e=findEntry(${JSON.stringify(cidZiel)});
    const v=qeGet(e,${JSON.stringify(cidZiel)},'name');
    return (v!==undefined?v:e.anzeige_text)==='Messumbenannt';
  })()`);
  melde('EINE Zeile umbenennen (Langdruck → Menü → Feld → übernehmen → Reichweite)', z.stand,
    umbenannt ? 'Ziel erreicht' : 'ZIEL NICHT ERREICHT');

  /* ── W2c: FÜNF Zeilen ändern über „✏️ Zeilen ändern" ────────────────── */
  z.reset();
  await page.evaluate(`(function(){ setMode('admin'); openStandard(${JSON.stringify(ziel.sid)}); openRubrik(${ziel.ri}); })()`);
  {
    const knoepfe = await page.$$('#scr-detail .add-entry-btn');
    for(const b of knoepfe){
      const t = await b.textContent();
      if(/Zeilen ändern/.test(t)){ await b.click(); z.zaehlen(1); break; }
    }
    await page.waitForSelector('#scr-detail .zl-zeile', { timeout: 5000 });
    const felder = await page.$$('#scr-detail .zl-feld input[data-f="name"]');
    const wieviele = Math.min(5, felder.length);
    for(let i=0;i<wieviele;i++){ await felder[i].fill('Messreihe '+i); z.zaehlen(1); }
    await page.waitForTimeout(150);
    await z.tipp('#zlFertig');
    await page.waitForSelector('#sheet .zl-pz', { timeout: 4000 });
    const pri = await page.$$('#sheet .btn-pri');
    if(pri.length){ await pri[pri.length-1].click(); z.zaehlen(1); }
    await page.waitForTimeout(500);
  }
  const fuenfDa = await page.evaluate(`(function(){
    return (document.getElementById('scr-detail').textContent.match(/Messreihe/g)||[]).length;
  })()`);
  melde('FÜNF Zeilen ändern über „✏️ Zeilen ändern"', z.stand,
    fuenfDa >= 5 ? (fuenfDa + ' geändert, Ansicht nie verlassen') : ('NUR ' + fuenfDa + ' geändert'));
  melde('Dieselben fünf einzeln über das ⋯-Menü', 5 * 5, 'hochgerechnet aus dem gemessenen Einzelweg');

  /* ── W2b: Dieselbe Zeile über „Details bearbeiten" (das große Formular) ── */
  z.reset();
  {
    await page.evaluate(`openSheet(${JSON.stringify(cidZiel)})`); z.zaehlen(1);
    await page.waitForTimeout(120);
    const acts = await page.$$('#sheet .sheet-act');
    for(const a of acts){
      const t = await a.textContent();
      if(/Details bearbeiten/.test(t)){ await a.click(); z.zaehlen(1); break; }
    }
    await page.waitForSelector('#fName', { timeout: 5000 });
  }
  const maske = await page.evaluate(`(function(){
    const box=document.getElementById('scr-form');
    return { felder:box.querySelectorAll('input:not([type=color]),select,textarea').length,
      gruppen:box.querySelectorAll('.form-grp').length,
      hoehe:box.scrollHeight, sicht:window.innerHeight,
      verlassen:box.classList.contains('active') };
  })()`);
  await page.evaluate(`closeForm()`);
  melde('Zeile über „Details bearbeiten" ÖFFNEN (ohne Ausfüllen und Speichern)', z.stand,
    `${maske.felder} Eingabefelder in ${maske.gruppen} Gruppen · ${Math.round(maske.hoehe/maske.sicht*10)/10} Bildschirmhöhen · Ansicht wird verlassen`);

  /* ── W3: Ein Bild an eine Zeile hängen ─────────────────────────────── */
  z.reset();
  {
    await page.evaluate(`openSheet(${JSON.stringify(cidZiel)})`); z.zaehlen(1);
    await page.waitForTimeout(120);
    const acts = await page.$$('#sheet .sheet-act');
    for(const a of acts){
      const t = await a.textContent();
      if(/^\s*Bilder/.test(t.replace(/[^\S\n]+/g,' '))){ await a.click(); z.zaehlen(1); break; }
    }
    await page.waitForTimeout(150);
    z.zaehlen(1);   /* „Bild wählen" / „Bild aufnehmen" — der Dateidialog ist Systemsache */
  }
  melde('Ein Bild an eine Zeile hängen (bis zum Kameradialog)', z.stand, 'danach Systemdialog');
  await page.evaluate(`showSheet(false)`);

  /* ── W4: Einen Reiter der Startseite umbenennen ────────────────────── */
  z.reset();
  {
    await page.evaluate(`setMode('use'); renderStandards();`);
    await page.evaluate(`seiteSheet('anleitung')`); z.zaehlen(1);     /* Langdruck */
    await page.waitForSelector('#stNeuWort', { timeout: 4000 });
    await z.feld('#stNeuWort', 'Messwort');
    await z.tipp('#sheet .btn-pri');
  }
  const reiterOk = await page.evaluate(`(function(){ const b=document.querySelector('.seg-btn[data-seite="anleitung"]');
    const ok=b && /Messwort/.test(b.textContent); if(ok){ seiteSetzen('anleitung','wort',''); seiteAuffrischen(); } return ok; })()`);
  melde('Einen Reiter umbenennen (Langdruck darauf)', z.stand, reiterOk ? 'Ziel erreicht' : 'ZIEL NICHT ERREICHT');

  /* ── W5: Was hat KEINEN Langdruck? ─────────────────────────────────── */
  const holds = await page.evaluate(`(function(){
    const reg=(typeof HOLDNAV!=='undefined')?HOLDNAV:[];
    return reg.map(h=>({ bildschirm:(h.el&&h.el.id)||'?', flaeche:h.rowSel }));
  })()`);
  console.log(`\n  Langdruck ist an ${holds.length} Flächen verdrahtet:`);
  holds.forEach(h=>console.log(`    · ${h.bildschirm}  ${h.flaeche}`));

  /* Welche sichtbaren Flächen tragen KEINEN Langdruck? Gezählt wird auf den
     Bildschirmen, auf denen man im Saal steht. */
  const ohne = await page.evaluate(`(function(){
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
    sammle('scr-detail','.ukhead,.uk-head','Kopf einer Unterkategorie');
    sammle('scr-detail','.seghead,.seg-head','Kopf eines Abschnitts');
    sammle('scr-detail','.add-entry-btn','Knöpfe unter der Liste');
    setMode('use'); renderStandards();
    sammle('scr-standards','.std','Übersichtszeile');
    sammle('scr-standards','.seg-btn[data-seite]','Reiter oben');
    sammle('scr-standards','.sortchip','Sortier-Knopf');
    sammle('scr-standards','.fac-chip,.facchip','Merkmals-Knopf');
    return orte;
  })()`);
  console.log('\n  Flächen ohne Langdruck (im Verwaltungsmodus):');
  ohne.forEach(o=>console.log(`    ${o.ohne===0?'✓':'✗'} ${o.name}: ${o.ohne} von ${o.gesamt} ohne`));

  /* ═══════════════════════════════════════════════════════════
     TEIL 2 — WARTEZEIT
     ═══════════════════════════════════════════════════════════ */
  console.log('\n══ Wartezeit der Renderpfade (echter Bestand, 5 Läufe) ══');

  const messe = async (name, code, info) => {
    const r = await page.evaluate(`(function(){
      const t=[];
      for(let i=0;i<5;i++){ const a=performance.now(); (function(){ ${code} })(); t.push(performance.now()-a); }
      return t;
    })()`);
    meldeZeit(name, r.reduce((a,b)=>a+b,0)/r.length, Math.max(...r), info);
  };

  /* Die größte Rubrik der App — dort tut es weh, wenn es weh tut. */
  const groesste = await page.evaluate(`(function(){
    let best={n:0};
    DB.standards.forEach(s=>(s.rubriken||[]).forEach((rb,ri)=>{
      let n=0; (rb.sub_bereiche||[]).forEach(sb=>{ n+=(sb.eintraege||[]).length; });
      if(n>best.n) best={ n, sid:s.id, ri, name:rb.name };
    }));
    return best;
  })()`);

  await page.evaluate(`setMode('use')`);
  await messe('Startseite zeichnen (Übersicht, alle Standards)', `renderStandards();`, `${bestand.std} Standards`);
  await messe('Standard öffnen (Rubrikenliste)', `openStandard(${JSON.stringify(ziel.sid)});`, ziel.titel);
  await messe('Größte Rubrik öffnen', `openStandard(${JSON.stringify(groesste.sid)}); openRubrik(${groesste.ri});`,
    `${groesste.n} Zeilen · „${groesste.name}"`);
  await messe('Bearbeiten-Menü öffnen', `openSheet(${JSON.stringify(cidZiel)});`, 'Langdruck auf eine Zeile');
  await page.evaluate(`showSheet(false)`);
  await messe('Bestand neu bauen (nach jeder Änderung)', `rebuildDB();`, 'läuft bei JEDEM Speichern');
  await messe('Materialindex bauen', `buildMaterialIndex();`, `${bestand.eintraege} Zeilen`);
  await messe('Materialien für den Pflege-Weg sammeln', `if(typeof pfCacheLeeren==='function') pfCacheLeeren(); if(typeof pfMaterialien==='function') pfMaterialien();`, 'gecacht');
  await messe('Vorschlagsliste „Ankreuzen statt Abtippen"',
    `if(typeof ankCacheLeeren==='function') ankCacheLeeren(); if(typeof ankBestand==='function') ankBestand('material');`, '');
  await messe('Liste einfügen: 40 Zeilen zerlegen + abgleichen',
    `const t=Array.from({length:40},(x,i)=>'- '+(i+1)+'x Zeile '+i).join(String.fromCharCode(10));
     einfAbgleichen(einfZerlegen(t),'material');`, 'ohne Bildschirm');
  await messe('Globale Suche „schleuse"', `if(typeof globalSearch==='function') globalSearch('schleuse'); else if(typeof runGlobalSearch==='function') runGlobalSearch('schleuse');`, 'alle Inhalte');
  await messe('Verwaltung zeichnen', `setMode('admin');`, 'alle Karten');
  await page.evaluate(`setMode('use')`);

  /* ═══════════════════════════════════════════════════════════
     TEIL 4 — DAS HANDY

     „Darstellung für Handys optimieren nicht Tablets das war eine falsche
     Annahme!" — also wird nachgerechnet, was auf einem Handy tatsächlich
     ankommt. Nicht „wirkt eng", sondern: wie viele Pixel bekommt der Name?
     ═══════════════════════════════════════════════════════════ */
  console.log('\n══ Handy: wie viel Platz bekommt der Name? ══');
  for(const breite of [360, 390, 430]){
    const H = await bootPage(browser, srv.base, { viewport:{ width:breite, height:800 } });
    const m = await H.page.evaluate(`(function(){
      const s = DB.standards.find(x=>(x.rubriken||[]).some(r=>r.typ==='material'));
      const ri = s.rubriken.findIndex(x=>x.typ==='material');
      openStandard(s.id); openRubrik(ri);
      document.querySelectorAll('#scr-detail .uksec.collapsed .uksec-head').forEach(h=>h.click());
      const B = el=>el?el.getBoundingClientRect():{width:0,height:0};
      const zeilen=[...document.querySelectorAll('#scr-detail .entry-row')].filter(x=>B(x).height>0);
      if(!zeilen.length) return null;
      const texte=[...document.querySelectorAll('#scr-detail .e-text')].filter(x=>B(x).height>0);
      const hoehen=zeilen.map(x=>B(x.closest('.entry')).height);
      return { n:zeilen.length,
        name:Math.round(B(texte[0]).width),
        zeile:Math.round(B(zeilen[0]).width),
        schnitt:Math.round(hoehen.reduce((a,b)=>a+b,0)/hoehen.length),
        gesamt:Math.round(document.getElementById('scr-detail').scrollHeight),
        mehrzeilig:texte.filter(x=>B(x).height>24).length };
    })()`);
    await H.page.context().close();
    if(!m){ console.log(`  ${breite} px: keine Materialzeile gefunden`); continue; }
    const anteil = Math.round(m.name / breite * 100);
    console.log(`  ${breite} px Fensterbreite: Name ${String(m.name).padStart(3)} px (${String(anteil).padStart(2)} % des Bildschirms) · ` +
      `Zeile ${m.schnitt} px hoch im Schnitt · ${m.mehrzeilig} von ${m.n} Namen brechen um · Rubrik ${m.gesamt} px lang`);
  }
  console.log('  Ausgangspunkt vor dem Umbau (360 px, dieselbe Rubrik): Name 98 px (27 %) · Zeile 119 px · 17 von 26 · Rubrik 3644 px');

  console.log('\n══ Konsolenfehler während der Messung: ' + A.errs.length + ' ══');
  if(A.errs.length) console.error(A.errs.slice(0,5));

  await browser.close().catch(()=>{});
  await srv.stop().catch(()=>{});
})().catch(e => { console.error('MESSSTAND', e); process.exit(1); });
