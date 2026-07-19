/* ABSCHNITTE ÜBERALL (Souveränität): eigene Gliederung in JEDER Rubrik.
   Material/Geräte gliedern über Unterkategorie-Sektionen (e2e/souveraen.js);
   ABLAUF-Rubriken gliedern über Überschriften. Diese Suite prüft: eigene
   Überschrift anlegen/umbenennen/löschen, „＋ Eintrag in <Abschnitt>" für
   Basis- UND eigene Abschnitte (seg-Zuordnung), „＋ Neue Kategorie…" direkt
   im Eintrag-Formular, Material-Rubrik unverändert. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');
(async () => {
  const r = reporter('abschnitte');
  const check=(l,c)=>r.check(l,c);
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);

  // Ablauf-Rubrik mit Basis-Abschnitten finden
  const ctx = await A.page.evaluate(() => {
    doLogin('1234567');
    let sid=null, ri=null, baseHead=null;
    DB.standards.forEach(s=>(s.rubriken||[]).forEach((r,i)=>{
      if(sid||r.typ==='material'||r.typ==='geraete') return;
      curStd=s; const seg=ablaufSegments(i); const withHead=seg.blocks.find(b=>b.head);
      if(withHead){ sid=s.id; ri=i; baseHead=withHead.head; }
    }));
    openStandard(sid); openRubrik(ri);
    return { sid, ri, baseHead };
  });
  check('Ablauf-Rubrik mit Basis-Abschnitt gefunden ("'+ctx.baseHead+'")', !!ctx.baseHead);

  // 1) UI zeigt „＋ Abschnitt (Überschrift)" + „＋ Eintrag in <Basis-Abschnitt>"
  const r1 = await A.page.evaluate((c) => {
    const h=$('scr-detail').innerHTML;
    return { addSec: h.indexOf('＋ Abschnitt (Überschrift)')>=0,
             perSec: h.indexOf('＋ Eintrag in „'+c.baseHead+'"')>=0 };
  }, ctx);
  check('Ablauf: „＋ Abschnitt (Überschrift)" vorhanden', r1.addSec);
  check('Ablauf: „＋ Eintrag in Basis-Abschnitt" vorhanden', r1.perSec);

  // 2) Eintrag in BASIS-Abschnitt anlegen → landet in genau diesem Abschnitt
  const r2 = await A.page.evaluate((c) => {
    startAddEntrySeg(c.ri, c.baseHead);
    document.getElementById('fName').value='SEG-BASIS-EINTRAG';
    saveEntryForm();
    const seg=ablaufSegments(c.ri);
    const b=seg.blocks.find(x=>x.head===c.baseHead);
    const inBlock=!!(b&&b.items.some(x=>x.e.anzeige_text==='SEG-BASIS-EINTRAG'));
    // und in der Darstellung: nach der Überschrift, vor der nächsten
    openRubrik(c.ri,true);
    const h=$('scr-detail').innerHTML;
    const iHead=h.indexOf(c.baseHead), iEntry=h.indexOf('SEG-BASIS-EINTRAG');
    return { inBlock, rendered: iHead>=0&&iEntry>iHead };
  }, ctx);
  check('Eintrag landet im gewählten BASIS-Abschnitt (Datenebene)', r2.inBlock);
  check('… und wird unter dessen Überschrift gerendert', r2.rendered);

  // 3) Eigenen Abschnitt anlegen, Eintrag hinein, dann umbenennen
  const r3 = await A.page.evaluate((c) => {
    addSegSectionUI(c.ri);
    document.getElementById('skNewSeg').value='Nachbereitung';
    addSegSectionSave(c.ri);
    const h1=$('scr-detail').innerHTML;
    const secShown=h1.indexOf('Nachbereitung')>=0 && h1.indexOf('＋ Eintrag in „Nachbereitung"')>=0;
    startAddEntrySeg(c.ri,'Nachbereitung');
    document.getElementById('fName').value='SEG-EIGEN-EINTRAG';
    saveEntryForm();
    const seg=ablaufSegments(c.ri); const b=seg.blocks.find(x=>x.head==='Nachbereitung');
    const inOwn=!!(b&&b.items.some(x=>x.e.anzeige_text==='SEG-EIGEN-EINTRAG'));
    const hasTools=!!(b&&b.headAid);
    // umbenennen
    openSegHeadSheet(c.ri,b.headAid);
    document.getElementById('segRenInp').value='Nachbereitung & Doku';
    segHeadRename(c.ri,b.headAid);
    const seg2=ablaufSegments(c.ri); const b2=seg2.blocks.find(x=>x.head==='Nachbereitung & Doku');
    const renamedKeeps=!!(b2&&b2.items.some(x=>x.e.anzeige_text==='SEG-EIGEN-EINTRAG'));
    return { secShown, inOwn, hasTools, renamedKeeps, aid:b2&&b2.headAid };
  }, ctx);
  check('Eigener Abschnitt „Nachbereitung" wird angelegt + angezeigt', r3.secShown);
  check('Eintrag landet im eigenen Abschnitt', r3.inOwn);
  check('Eigener Abschnitt hat ⋯-Verwaltung (headAid)', r3.hasTools);
  check('Umbenennen nimmt die Einträge mit', r3.renamedKeeps);

  // 4) Abschnitt löschen → Einträge bleiben erhalten (rücken ans Ende)
  const r4 = await A.page.evaluate((c,) => {
    window.confirm=()=>true;
    const seg=ablaufSegments(c.ri); const b=seg.blocks.find(x=>x.head==='Nachbereitung & Doku');
    segHeadDelete(c.ri,b.headAid);
    const seg2=ablaufSegments(c.ri);
    const headGone=!seg2.blocks.some(x=>x.head==='Nachbereitung & Doku');
    const entrySurvives=seg2.blocks.some(x=>x.items.some(y=>y.e.anzeige_text==='SEG-EIGEN-EINTRAG'));
    return { headGone, entrySurvives };
  }, ctx);
  check('Abschnitt löschen: Überschrift weg, Einträge bleiben', r4.headGone && r4.entrySurvives);

  // 5) „＋ Neue Kategorie…" im Formular
  const r5 = await A.page.evaluate((c) => {
    startAddEntry ? null : null;
    openEntryForm({kind:'add',sid:c.sid,ri:c.ri,defaultNat:'hinweis'});
    const hasBtn=$('fNatWrap').innerHTML.indexOf('＋ Neu…')>=0;
    natFormNew();
    document.getElementById('natNewInp').value='Hygiene-Check';
    natFormNewSave();
    const sel=$('fNatWrap').dataset.nat;
    const created=natList().some(n=>n.label==='Hygiene-Check');
    document.getElementById('fName').value='KAT-TEST-EINTRAG';
    saveEntryForm();
    let found=null;
    DB.standards.forEach(st=>(st.rubriken||[]).forEach((r,i)=>(r.sub_bereiche||[]).forEach((sb,si)=>(sb.eintraege||[]).forEach((e,ei)=>{ if(e._added&&e.anzeige_text==='KAT-TEST-EINTRAG') found=e; }))));
    return { hasBtn, created, selected: sel===natSlug ? false : !!sel, natur: found&&found.natur, key: sel };
  }, ctx);
  check('Formular hat „＋ Neu…" im Kategorie-Wähler', r5.hasBtn);
  check('Neue Kategorie „Hygiene-Check" wird angelegt', r5.created);
  check('… ist direkt ausgewählt und am gespeicherten Eintrag', r5.natur===r5.key && !!r5.key);

  // 6) Material-Rubrik unverändert (Regression: UK-Abschnitte statt Überschrift-Knopf)
  const r6 = await A.page.evaluate(() => {
    const s=DB.standards.find(st=>(st.rubriken||[]).some(r=>r.typ==='material'));
    const ri=s.rubriken.findIndex(r=>r.typ==='material');
    openStandard(s.id); openRubrik(ri);
    const h=$('scr-detail').innerHTML;
    return h.indexOf('＋ Abschnitt (Reiter)')>=0 && h.indexOf('＋ Abschnitt (Überschrift)')<0;
  });
  check('Material-Rubrik: weiterhin „＋ Abschnitt (Reiter)" (UK-System)', r6);

  check('keine Konsolenfehler', A.errs.length===0);
  await r.finish(browser, [srv]);
})().catch(e=>{console.error('DRIVER',e);process.exit(1);});
