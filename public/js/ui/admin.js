/* ============ Verwaltung ============ */
function allMatGerEntries(){ const out=[]; DB.standards.forEach(std=>{ (std.rubriken||[]).forEach((r,ri)=>{ if(r.typ!=='material'&&r.typ!=='geraete') return; (r.sub_bereiche||[]).forEach((sb,si)=>{ (sb.eintraege||[]).forEach((e,ei)=>{ if(e.natur==='ueberschrift') return; out.push({e,cid:cidOf(std.id,ri,si,ei),std,rubrik:r.name}); }); }); }); }); return out; }
function computeUkList(){ const cnt=new Map(); const first=new Map(); let i=0;
  allMatGerEntries().forEach(x=>{ const uk=canonUk(x.e,x.cid); if(!uk) return; cnt.set(uk,(cnt.get(uk)||0)+1); if(!first.has(uk)) first.set(uk,i++); });
  let names=[...cnt.keys()]; names.sort((a,b)=>{ const oa=ukMetaOf(a).order!=null?ukMetaOf(a).order:first.get(a); const ob=ukMetaOf(b).order!=null?ukMetaOf(b).order:first.get(b); return oa-ob; });
  UK_LIST=names; return {names,cnt}; }
function collectUncertain(){ const out=[]; allMatGerEntries().forEach(x=>{ if(qeGet(x.e,x.cid,'hidden')===true) return; const unc=(x.e.natur_konfidenz==='mittel'||x.e.natur_konfidenz==='niedrig'); if(unc||naturKorrigiert(x.cid)) out.push(x); }); return out; }
/* cid → {e,std,rubrik} für die Anzeige regel-ausgeblendeter Einträge. */
function locateCid(cid){ try{ const e=findEntry(cid); if(!e) return null;
  if(cid.indexOf('new|')===0){ const std=DB.standards.find(x=>x.id===cidStd(cid)); return std?{e,std,rubrik:'Eigene Einträge'}:null; }
  const p=cid.split('|'); const std=DB.standards.find(x=>x.id===p[0]); if(!std) return null; const r=std.rubriken[+p[1]]; return {e,std,rubrik:r?r.name:''}; }
  catch(_){ return null; } }
function collectHidden(){ const byCid=[]; const byMat=[]; const byStd=[]; const byRub=[];
  const seenCid=new Set(), seenMat=new Set();
  DB.standards.forEach(std=>{ (std.rubriken||[]).forEach((r,ri)=>{ (r.sub_bereiche||[]).forEach((sb,si)=>{ (sb.eintraege||[]).forEach((e,ei)=>{ const cid=cidOf(std.id,ri,si,ei); if(QE.cid[cid]&&QE.cid[cid].hidden){ byCid.push({cid,e,std,rubrik:r.name}); seenCid.add(cid); } }); }); }); });
  Object.keys(QE.mat).forEach(mk=>{ if(QE.mat[mk]&&QE.mat[mk].hidden){ byMat.push(mk); seenMat.add(mk); } });
  /* Regel-Ausblendungen (EIN Schreibweg): 📍 Stelle → byCid, 🌐 alle → byMat.
     📄 Standard / 🗂 Gruppe sind bewusste Sammel-Regeln → nur im 🧾 Journal. */
  if(typeof rulesActive==='function') rulesActive(RULES).forEach(r=>{
    if(!r.ziel||r.ziel.art!=='material'||r.prop!=='hidden'||r.wert!==true||!r.wo) return;
    if(r.wo.art==='stelle'){ const cid=r.wo.wert; if(seenCid.has(cid)) return; const loc=locateCid(cid); if(loc){ byCid.push({cid,e:loc.e,std:loc.std,rubrik:loc.rubrik}); seenCid.add(cid); } }
    else if(r.wo.art==='alle'){ const mk=r.ziel.key; if(!seenMat.has(mk)){ byMat.push(mk); seenMat.add(mk); } }
  });
  DB.standards.forEach(s=>{ if(stdHidden(s)) byStd.push(s); });
  Object.keys(RUBE).forEach(k=>{ if(!RUBE[k]||!RUBE[k].hidden) return; const sid=k.split('|')[0]; const part=k.slice(sid.length+1); const s=DB.standards.find(x=>x.id===sid); if(!s) return;
    let r=null; if(part.indexOf('nr:')===0){ r=s.rubriken.find(x=>x.__nrid===part.slice(3)); } else { r=s.rubriken[+part]; }
    byRub.push({key:k,std:s,name:(RUBE[k].name)||(r?r.name:part)}); });
  return {byCid,byMat,byStd,byRub}; }
function restoreStd(id){ if(STDE[id]){ delete STDE[id].hidden; if(Object.keys(STDE[id]).length===0) delete STDE[id]; } saveSTDE(); renderAdmin(); toast('Standard wieder sichtbar'); }
function restoreRub(key){ if(RUBE[key]){ delete RUBE[key].hidden; if(Object.keys(RUBE[key]).length===0) delete RUBE[key]; } saveRUBE(); renderAdmin(); toast('Rubrik wieder sichtbar'); }
function restoreCid(cid){ if(QE.cid[cid]){ delete QE.cid[cid].hidden; if(Object.keys(QE.cid[cid]).length===0) delete QE.cid[cid]; }
  /* Regel-Ausblendung an dieser Stelle mit-zurücknehmen (EIN Schreibweg). */
  if(typeof rulesActive==='function') rulesActive(RULES).forEach(r=>{ if(r.prop==='hidden'&&r.wert===true&&r.wo&&r.wo.art==='stelle'&&r.wo.wert===cid) revokeRule(r.id); });
  saveQE(); buildMaterialIndex(); renderAdmin(); toast('Wiederhergestellt'); }
function hideCid(cid){ (QE.cid[cid]=QE.cid[cid]||{}).hidden=true; saveQE(); buildMaterialIndex(); renderAdmin(); toast('Ausgeblendet'); }

