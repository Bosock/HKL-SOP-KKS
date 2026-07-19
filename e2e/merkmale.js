/* MERKMALE am Eintrag (Konzept docs/KONZEPT-MERKMALE.md):
   Die Eintrag-Maske kann beliebig viele GRÖSSEN (typisiert) und EIGENE
   MERKMALE (Name+Wert, z. B. Struktur: geflochten, Nadel: 5/8) anlegen.
   Prüft: kein Datenverlust bei Mehrfach-Größen, Reichweiten-Frage nur bei
   echten Änderungen, „Überall"-Ausrollung, eigener Eintrag ohne
   Schein-Frage, Badges, Namens-Datalist. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');
(async () => {
  const r = reporter('merkmale');
  const check=(l,c)=>r.check(l,c);
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);

  // 1) KEIN Datenverlust: Eintrag mit MEHREREN Basis-Größen → Maske zeigt alle
  const r1 = await A.page.evaluate(() => {
    doLogin('1234567');
    let cid=null,n=0;
    DB.standards.forEach(s=>(s.rubriken||[]).forEach((r,ri)=>(r.sub_bereiche||[]).forEach((sb,si)=>(sb.eintraege||[]).forEach((e,ei)=>{
      if(!cid && e.material_key && (e.groessen||[]).length>=2){ cid=cidOf(s.id,ri,si,ei); n=e.groessen.length; }
    }))));
    if(!cid) return { none:true };
    const sid=cidStd(cid); openStandard(sid); openRubrik(+cid.split('|')[1]);
    openEntryForm({kind:'editBase',cid});
    const rows=document.querySelectorAll('#fSizes .merk-row').length;
    // Speichern OHNE Änderung → keine Reichweiten-Frage, keine Regel
    saveEntryForm();
    const sheetAfterNoop=document.getElementById('sheet').classList.contains('show');
    const kept=(qeGet(findEntry(cid),cid,'groessen')!==undefined?qeGet(findEntry(cid),cid,'groessen'):findEntry(cid).groessen).length;
    return { none:false, base:n, rows, sheetAfterNoop, kept, cid };
  });
  if(r1.none){ console.log('  (kein Mehrfach-Größen-Eintrag in den Daten — Teil 1 übersprungen)'); }
  else {
    check('Maske zeigt ALLE '+r1.base+' Größen ('+r1.rows+' Zeilen)', r1.rows===r1.base);
    check('Speichern ohne Änderung: keine Reichweiten-Frage (keine Schein-Regel)', r1.sheetAfterNoop===false);
    check('KEIN Datenverlust: alle '+r1.base+' Größen bleiben erhalten', r1.kept===r1.base);
  }

  // 2) Größe + eigene Merkmale ergänzen → Reichweiten-Frage → „Nur hier" → Badges
  const r2 = await A.page.evaluate(() => {
    let cid=null; const cnt={};
    DB.standards.forEach(s=>(s.rubriken||[]).forEach(r=>(r.sub_bereiche||[]).forEach(sb=>(sb.eintraege||[]).forEach(e=>{ if(e.material_key&&e.natur!=='ueberschrift'){(cnt[e.material_key]=cnt[e.material_key]||new Set()).add(s.id);} }))));
    const mk=Object.keys(cnt).find(k=>cnt[k].size>=2);
    DB.standards.forEach(s=>(s.rubriken||[]).forEach((r,ri)=>(r.sub_bereiche||[]).forEach((sb,si)=>(sb.eintraege||[]).forEach((e,ei)=>{ if(!cid&&e.material_key===mk) cid=cidOf(s.id,ri,si,ei); }))));
    const sid=cidStd(cid); openStandard(sid); openRubrik(+cid.split('|')[1]);
    openEntryForm({kind:'editBase',cid});
    // Größe hinzufügen
    merkAddSize();
    const sRows=document.querySelectorAll('#fSizes .merk-row');
    const last=sRows[sRows.length-1];
    last.querySelector('.merk-typ').value='laenge'; last.querySelector('.merk-wert').value='45cm';
    // Zwei eigene Merkmale
    merkAddZus(); merkAddZus();
    const zRows=document.querySelectorAll('#fZus .merk-row');
    zRows[0].querySelector('.merk-name').value='Struktur'; zRows[0].querySelector('.merk-zwert').value='geflochten';
    zRows[1].querySelector('.merk-name').value='Nadel'; zRows[1].querySelector('.merk-zwert').value='5/8';
    saveEntryForm();
    const sheet=document.getElementById('sheet');
    const asks=sheet.classList.contains('show');
    const props=sheet.innerHTML.indexOf('Größen')>=0 && sheet.innerHTML.indexOf('Eigene Felder')>=0;
    applyEditScope('cid');
    const e=findEntry(cid);
    const gro=qeGet(e,cid,'groessen')||[]; const zus=qeGet(e,cid,'zusatz')||[];
    const card=entryCardHTML(e,cid,true);
    return { asks, props,
      hasLen: gro.some(g=>g.wert==='45cm'&&g.typ==='laenge'),
      hasZus: zus.some(f=>f.n==='Struktur'&&f.w==='geflochten')&&zus.some(f=>f.n==='Nadel'&&f.w==='5/8'),
      badges: card.indexOf('45cm')>=0 && card.indexOf('Struktur: geflochten')>=0 && card.indexOf('Nadel: 5/8')>=0,
      journaled: rulesActive(RULES).some(x=>x.prop==='zusatz'&&x.wo&&x.wo.art==='stelle'&&x.wo.wert===cid), cid, mk };
  });
  check('Speichern fragt Reichweite (Änderungen: Größen + Eigene Felder)', r2.asks && r2.props);
  check('Größe „Länge 45cm" zusätzlich gespeichert', r2.hasLen);
  check('Eigene Merkmale (Struktur, Nadel) gespeichert', r2.hasZus);
  check('Badges am Eintrag: 45cm · Struktur: geflochten · Nadel: 5/8', r2.badges);
  check('… als Regel journaliert (rücknehmbar)', r2.journaled);

  // 3) „Überall": Merkmal auf alle Vorkommen des Materials ausrollen
  const r3 = await A.page.evaluate((prev) => {
    window.confirm=()=>true;
    let cid2=null; // ZWEITES Vorkommen desselben Materials (anderer Standard)
    DB.standards.forEach(s=>(s.rubriken||[]).forEach((r,ri)=>(r.sub_bereiche||[]).forEach((sb,si)=>(sb.eintraege||[]).forEach((e,ei)=>{
      const c=cidOf(s.id,ri,si,ei); if(!cid2&&e.material_key===prev.mk&&c!==prev.cid) cid2=c; }))));
    const sid=cidStd(prev.cid); openStandard(sid); openRubrik(+prev.cid.split('|')[1]);
    openEntryForm({kind:'editBase',cid:prev.cid});
    merkAddZus();
    const zRows=document.querySelectorAll('#fZus .merk-row');
    const last=zRows[zRows.length-1];
    last.querySelector('.merk-name').value='MHD-Kontrolle'; last.querySelector('.merk-zwert').value='monatlich';
    saveEntryForm(); applyEditScope('mat');
    const e2=findEntry(cid2); const zus2=qeGet(e2,cid2,'zusatz')||[];
    return { rolled: zus2.some(f=>f.n==='MHD-Kontrolle') };
  }, r2);
  check('„Überall": Merkmal erscheint auch am anderen Vorkommen (anderer Standard)', r3.rolled);

  // 4) Eigener Eintrag: mehrere Größen + Merkmale direkt, ohne Reichweiten-Frage
  const r4 = await A.page.evaluate(() => {
    const s=DB.standards.find(st=>(st.rubriken||[]).some(r=>r.typ==='material'));
    const ri=s.rubriken.findIndex(r=>r.typ==='material');
    openStandard(s.id); openRubrik(ri);
    openEntryForm({kind:'add',sid:s.id,ri,defaultNat:'material'});
    document.getElementById('fName').value='Prolene-Test-Naht';
    merkAddSize(); merkAddSize();
    const sr=document.querySelectorAll('#fSizes .merk-row');
    sr[0].querySelector('.merk-typ').value='naht'; sr[0].querySelector('.merk-wert').value='4-0';
    sr[1].querySelector('.merk-typ').value='laenge'; sr[1].querySelector('.merk-wert').value='45cm';
    merkAddZus();
    document.querySelector('#fZus .merk-name').value='Struktur';
    document.querySelector('#fZus .merk-zwert').value='monofil';
    saveEntryForm();
    const noSheet=!document.getElementById('sheet').classList.contains('show');
    let found=null,fcid=null;
    DB.standards.forEach(st=>(st.rubriken||[]).forEach((r,i)=>(r.sub_bereiche||[]).forEach((sb,si)=>(sb.eintraege||[]).forEach((e,ei)=>{ if(e._added&&e.anzeige_text==='Prolene-Test-Naht'){ found=e; fcid=cidOf(st.id,i,si,ei); } }))));
    const card=found?entryCardHTML(found,fcid,true):'';
    return { noSheet, sizes: found?found.groessen.length:0, zus: !!(found&&found.zusatz&&found.zusatz.length),
      badges: card.indexOf('4-0')>=0&&card.indexOf('45cm')>=0&&card.indexOf('Struktur: monofil')>=0 };
  });
  check('Eigener Eintrag: direkt gespeichert, keine (sinnlose) Reichweiten-Frage', r4.noSheet);
  check('… mit 2 Größen (Stärke 4-0 + Länge 45cm)', r4.sizes===2);
  check('… und eigenem Merkmal, alle Badges sichtbar', r4.zus && r4.badges);

  // 5) Namens-Datalist lernt verwendete Merkmal-Namen
  const r5 = await A.page.evaluate(() => {
    const names=usedZusatzNames();
    return names.indexOf('Struktur')>=0 && names.indexOf('Nadel')>=0;
  });
  check('Datalist schlägt verwendete Merkmal-Namen vor (Struktur, Nadel)', r5);

  check('keine Konsolenfehler', A.errs.length===0);
  await r.finish(browser, [srv]);
})().catch(e=>{console.error('DRIVER',e);process.exit(1);});
