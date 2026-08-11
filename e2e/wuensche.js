/* END-TO-END: DREI WÜNSCHE AUS DER LISTE

   Gemessen wird in BERÜHRUNGEN, nicht in Meinungen. Alle drei Wünsche haben
   dieselbe Begründung: „macht die Arbeit schneller".

   ⑤ Merkmale per Häkchen im Menü
        vorher  ⋯ · „Merkmale" · „Ja" · „Fertig"      = 4
        jetzt   ⋯ · antippen                          = 2   (jedes weitere +1 statt +4)

   ⑩ „Material für den sterilen Tisch" als Häkchen an der Zeile
        vorher  ⋯ · „Bereich" · Bereich · Reichweite  = 4 je Zeile
        jetzt   antippen                              = 1

   ⑥ Ersatzmaterial in vier Sorten
        vorher  gar nicht möglich (nur Freitext)
        jetzt   1 Berührung je Einstufung

   Und weil eine schnelle Fläche ohne Langdruck nach Hausregel A7 unfertig
   ist, wird auch der geprüft: auf dem Häkchen im Menü UND auf dem Häkchen an
   der Zeile. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('wuensche');
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);
  const page = A.page;

  /* Berührungen zählen wie im Messstand: jeder Klick geht über diesen Zähler. */
  let tipps = 0;
  const tipp = async (sel) => {
    const da = await page.evaluate(`(function(){ const el=document.querySelector(${JSON.stringify(sel)});
      if(!el) return false; el.click(); return true; })()`);
    if (da) tipps++;
    return da;
  };
  const halten = async (sel) => {
    for (let i = 0; i < 30; i++) {
      const zu = await page.evaluate(`(function(){ const s=document.getElementById('sheet');
        return !s || !s.classList.contains('show'); })()`);
      if (zu) break;
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(300);
    /* Die erste Fläche, die auch WIRKLICH auf dem Schirm liegt. Zugeklappte
       Untergruppen liefern ein 0×0-Rechteck — ein Druck darauf ginge ins
       Leere und der Test meldete einen Fehler, den es nicht gibt. */
    const box = await page.evaluate(`(function(){
      const alle=[...document.querySelectorAll(${JSON.stringify(sel)})];
      for(const el of alle){
        el.scrollIntoView({block:'center'});
        const b=el.getBoundingClientRect();
        if(b.width>4 && b.height>4) return { x:b.x+b.width/2, y:b.y+b.height/2 };
      }
      return null;
    })()`);
    if (!box) return false;
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    await page.waitForTimeout(750);
    await page.mouse.up();
    await page.waitForTimeout(200);
    return true;
  };

  await page.evaluate(`doLogin('1234567')`);

  /* ═══════════ ⑤ Merkmale per Häkchen ═══════════ */

  const vorbereitet = await page.evaluate(`(function(){
    eigAnlegen('sedierungspflichtig','ja');
    eigAnlegen('Rufbereitschaft','ja');
    eigAnlegen('Vorbereitungszeit','wert');
    const sid = DB.standards[0].id;
    openStandard(sid);
    return { sid };
  })()`);

  tipps = 0;
  await page.evaluate(`openStdSheet(${JSON.stringify(vorbereitet.sid)})`);
  tipps++;                                   /* das ⋯-Menü öffnen zählt mit */
  const menue = await page.evaluate(`(function(){
    const z=[...document.querySelectorAll('#sheet .eig-haken')];
    return { n:z.length, worte:z.map(x=>x.textContent.replace(/\\s+/g,' ').trim()),
      wert:/Vorbereitungszeit/.test(document.getElementById('sheet').textContent) };
  })()`);
  r.check(`die Ja/Nein-Merkmale stehen als Häkchen im Menü (${menue.n})`, menue.n === 2);
  r.check('… Merkmale mit Wert nicht — die kann man nicht ankreuzen',
    !menue.worte.some(w => /Vorbereitungszeit/.test(w)));

  await tipp('#sheet .eig-haken');
  const nachTipp = await page.evaluate(`(function(){
    const z=[...document.querySelectorAll('#sheet .eig-haken')];
    return { an:z[0].classList.contains('on'), aria:z[0].getAttribute('aria-checked'),
      zweite:z[1].classList.contains('on'),
      wert:eigWert(${JSON.stringify(vorbereitet.sid)}, z[0].dataset.k),
      offen:document.getElementById('sheet').classList.contains('show') };
  })()`);
  r.check(`ein Merkmal zuordnen kostet ${tipps} Berührungen (vorher 4)`, tipps === 2);
  r.check('… und es ist wirklich angekommen', nachTipp.wert === true && nachTipp.an && nachTipp.aria === 'true');
  r.check('… das Menü bleibt dabei offen', nachTipp.offen === true);
  r.check('… und nur DIESE Zeile ändert sich', nachTipp.zweite === false);

  await tipp('#sheet .eig-haken:nth-of-type(2)');
  const zweites = await page.evaluate(`(function(){
    const z=[...document.querySelectorAll('#sheet .eig-haken')];
    return { beide: z.every(x=>x.classList.contains('on')) };
  })()`);
  r.check(`ein zweites Merkmal kostet EINE weitere Berührung (${tipps} statt 8)`,
    zweites.beide && tipps === 3);

  const wiederAb = await page.evaluate(`(function(){
    const z=document.querySelector('#sheet .eig-haken'); const k=z.dataset.k;
    z.click();
    return { wert: eigWert(${JSON.stringify(vorbereitet.sid)}, k),
      an: document.querySelector('#sheet .eig-haken').classList.contains('on') };
  })()`);
  r.check('nochmal antippen nimmt es zurück auf „ohne Angabe"',
    wiederAb.wert === undefined && !wiederAb.an);

  /* Ein ausdrückliches NEIN darf nicht als „ohne Angabe" durchgehen. */
  const nein = await page.evaluate(`(function(){
    const k=document.querySelector('#sheet .eig-haken').dataset.k;
    eigSetzen(${JSON.stringify(vorbereitet.sid)}, k, false);
    openStdSheet(${JSON.stringify(vorbereitet.sid)});
    const z=document.querySelector('#sheet .eig-haken');
    return { klasse:z.className, text:z.textContent };
  })()`);
  r.check('ein ausdrückliches Nein steht sichtbar in der Zeile',
    /nein/.test(nein.klasse) && /ausdrücklich nein/.test(nein.text));

  const gehalten1 = await halten('#sheet .eig-haken');
  const merkSheet = await page.evaluate(`(function(){
    const s=document.getElementById('sheet');
    const auf=s.classList.contains('show') && /Merkmal/.test(s.textContent);
    const feld=!!document.getElementById('eigFlWort');
    showSheet(false);
    return { auf, feld };
  })()`);
  r.check('LANGDRUCK auf ein Häkchen öffnet das Merkmal selbst (A7)',
    gehalten1 && merkSheet.auf && merkSheet.feld);

  /* ═══════════ ⑩ Steriler Tisch als Häkchen an der Zeile ═══════════ */

  const ohneBereich = await page.evaluate(`(function(){
    const s = DB.standards.find(x=>(x.rubriken||[]).some(r=>r.typ==='material'));
    const ri = s.rubriken.findIndex(x=>x.typ==='material');
    setMode('admin'); openStandard(s.id); openRubrik(ri);
    return { sid:s.id, ri, haken:document.querySelectorAll('#scr-detail .ber-haken').length };
  })()`);
  r.check('ohne angelegten Bereich steht an keiner Zeile ein Kästchen',
    ohneBereich.haken === 0);

  const mitBereich = await page.evaluate(`(function(){
    const b = berAnlegen('Material für den sterilen Tisch');
    berAendern(b.key,'symbol','🩺');
    openRubrik(${ohneBereich.ri});
    const knoepfe=[...document.querySelectorAll('#scr-detail .ber-haken')];
    return { key:b.key, haken:b.haken, n:knoepfe.length,
      cid:knoepfe.length?knoepfe[0].dataset.cid:null,
      text:knoepfe.length?knoepfe[0].textContent.replace(/\\s+/g,' ').trim():'' };
  })()`);
  r.check(`der erste Bereich bekommt das Häkchen und steht an ${mitBereich.n} Materialzeilen`,
    mitBereich.haken === true && mitBereich.n > 3);
  r.check('… mit Symbol und Wort des Hauses', /🩺/.test(mitBereich.text) && /sterilen Tisch/.test(mitBereich.text));

  tipps = 0;
  await tipp('#scr-detail .ber-haken');
  const gesetzt = await page.evaluate(`(function(){
    const el=[...document.querySelectorAll('#scr-detail .ber-haken')].find(x=>x.dataset.cid===${JSON.stringify(mitBereich.cid)});
    const e=findEntry(${JSON.stringify(mitBereich.cid)});
    return { an:el?el.classList.contains('on'):false, gesetzt:berHatHaken(e,${JSON.stringify(mitBereich.cid)}),
      mk:e.material_key||'' };
  })()`);
  r.check(`eine Zeile zuordnen kostet ${tipps} Berührung (vorher 4)`, tipps === 1 && gesetzt.gesetzt);
  r.check('… und man sieht es sofort an der Zeile', gesetzt.an === true);

  /* DAS ENTSCHEIDENDE am Wunsch: „das kann von Standard zu Standard und von
     Material zu Material variieren". Also darf dasselbe Material anderswo
     NICHT mitgesetzt werden. */
  const anderswo = await page.evaluate(`(function(){
    const mk = ${JSON.stringify(gesetzt.mk)};
    if(!mk) return { kein:true };
    let treffer=null;
    DB.standards.forEach(s=>(s.rubriken||[]).forEach((r,ri)=>(r.sub_bereiche||[]).forEach((sb,si)=>(sb.eintraege||[]).forEach((e,ei)=>{
      if(treffer||!e||e.material_key!==mk) return;
      const cid=cidOf(s.id,ri,si,ei);
      if(cid!==${JSON.stringify(mitBereich.cid)}) treffer={ cid, e };
    }))));
    if(!treffer) return { kein:true };
    return { kein:false, cid:treffer.cid, gesetzt: berHatHaken(treffer.e, treffer.cid) };
  })()`);
  r.check('dasselbe Material an ANDERER Stelle bleibt unberührt',
    anderswo.kein || anderswo.gesetzt === false);

  const zweiteSicht = await page.evaluate(`(function(){
    openRuestliste(${JSON.stringify(ohneBereich.sid)});
    ruestSichtSetzen('bereich');
    const f=[...document.querySelectorAll('#scr-ruest .rl-fach-t')].map(x=>x.textContent.replace(/\\s+/g,' ').trim());
    ruestSichtSetzen('ablauf');
    const ab=[...document.querySelectorAll('#scr-ruest .rl-fach-t')].map(x=>x.textContent.replace(/\\s+/g,' ').trim());
    return { f, ab };
  })()`);
  r.check(`die zweite Sicht ordnet nach Tisch und Rest (${zweiteSicht.f.join(' · ')})`,
    zweiteSicht.f.some(t => /sterilen Tisch/.test(t)) && zweiteSicht.f.some(t => /weiteres Material/.test(t)));
  r.check('… und die erste Sicht ist unverändert die alte',
    zweiteSicht.ab.some(t => /Lager|Tisch|Ansage/.test(t)) && !zweiteSicht.ab.some(t => /weiteres Material/.test(t)));

  /* Die Untergruppen sind ausgeliefert zugeklappt (`.uksec.collapsed` mit
     `display:none` im Rumpf). Zum Drücken muss die Zeile wirklich auf dem
     Schirm liegen — sonst misst der Test ein 0×0-Rechteck und meldete einen
     Fehler, den es nicht gibt. Aufgeklappt wird über den eigenen Kopf der
     Gruppe, nicht über eine im Test gesetzte Klasse. */
  await page.evaluate(`(function(){ openStandard(${JSON.stringify(ohneBereich.sid)}); openRubrik(${ohneBereich.ri});
    const k=document.querySelector('#scr-detail .uksec.collapsed .uksec-head'); if(k) k.click(); })()`);
  const gehalten2 = await halten('#scr-detail .ber-haken');
  const berSheet = await page.evaluate(`(function(){
    const s=document.getElementById('sheet');
    const auf=s.classList.contains('show') && /Bereich/.test(s.textContent);
    const feld=!!document.getElementById('berFlWort');
    showSheet(false);
    return { auf, feld };
  })()`);
  r.check('LANGDRUCK auf das Häkchen öffnet den Bereich selbst (A7)',
    gehalten2 && berSheet.auf && berSheet.feld);

  /* ═══════════ ⑥ Ersatzmaterial in vier Sorten ═══════════ */

  const alt = await page.evaluate(`(function(){
    const cid = ${JSON.stringify(mitBereich.cid)};
    openSheet(cid); sheetGo('alt');
    const leer = document.getElementById('sheet').textContent;
    altUiNeu();
    const kand = document.querySelector('#sheet .sheet-pick-btn');
    const name = kand ? kand.textContent : '';
    if(kand) kand.click();
    const sorten = [...document.querySelectorAll('#sheet .alt-sorte-btn')].map(b=>b.textContent.replace(/\\s+/g,' ').trim());
    const offen = /einstufen/.test(document.getElementById('sheet').textContent);
    return { leer:/Noch keine Alternative/.test(leer), name, sorten, offen };
  })()`);
  r.check('an einer Zeile ohne Ersatz steht der Weg zur Austauschgruppe', alt.leer);
  r.check(`die vier Sorten stehen zur Wahl (${alt.sorten.join(' · ')})`, alt.sorten.length === 4);
  r.check('… mit den Worten des Betreibers',
    alt.sorten.some(s => /^🟰 äquivalent$/.test(s)) &&
    alt.sorten.some(s => /teures Äquivalent/.test(s)) &&
    alt.sorten.some(s => /Back-Up/.test(s)));
  r.check('eine frische Alternative ist sichtbar NICHT eingestuft', alt.offen === true);

  tipps = 0;
  await tipp('#sheet .alt-sorte-btn:nth-of-type(2)');
  const eingestuft = await page.evaluate(`(function(){
    const an=[...document.querySelectorAll('#sheet .alt-sorte-btn')].filter(b=>b.classList.contains('on'));
    const rang=[...document.querySelectorAll('#sheet .alt-rang')].map(x=>x.textContent.trim());
    return { n:an.length, wort:an.length?an[0].textContent.replace(/\\s+/g,' ').trim():'', rang };
  })()`);
  r.check(`einstufen kostet ${tipps} Berührung`, tipps === 1 && eingestuft.n === 1);
  r.check(`… und die Sorte steht danach in der Zeile (${eingestuft.rang.join(' · ')})`,
    eingestuft.rang.some(t => /teures Äquivalent/.test(t)));

  const imSaal = await page.evaluate(`(function(){
    showSheet(false); setMode('use'); openStandard(${JSON.stringify(ohneBereich.sid)}); openRubrik(${ohneBereich.ri});
    const b=[...document.querySelectorAll('#scr-detail .alt-chip')].map(x=>x.textContent.replace(/\\s+/g,' ').trim());
    return b;
  })()`);
  r.check(`im Saal steht die Sorte am Badge (${imSaal.join(' · ')})`,
    imSaal.length > 0 && imSaal.some(t => /💶/.test(t)));

  r.check('keine Konsolenfehler', A.errs.length === 0);
  if (A.errs.length) console.log('   ', A.errs.slice(0, 4));

  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
