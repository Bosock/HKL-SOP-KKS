/* ============ Verwaltung ============ */
function allMatGerEntries(){ const out=[]; DB.standards.forEach(std=>{ (std.rubriken||[]).forEach((r,ri)=>{ if(r.typ!=='material'&&r.typ!=='geraete') return; (r.sub_bereiche||[]).forEach((sb,si)=>{ (sb.eintraege||[]).forEach((e,ei)=>{ if(e.natur==='ueberschrift') return; out.push({e,cid:cidOf(std.id,ri,si,ei),std,rubrik:r.name}); }); }); }); }); return out; }
function computeUkList(){ const cnt=new Map(); const first=new Map(); let i=0;
  allMatGerEntries().forEach(x=>{ const uk=canonUk(x.e,x.cid); if(!uk) return; cnt.set(uk,(cnt.get(uk)||0)+1); if(!first.has(uk)) first.set(uk,i++); });
  let names=[...cnt.keys()]; names.sort((a,b)=>{ const oa=ukMetaOf(a).order!=null?ukMetaOf(a).order:first.get(a); const ob=ukMetaOf(b).order!=null?ukMetaOf(b).order:first.get(b); return oa-ob; });
  UK_LIST=names; return {names,cnt}; }
function collectUncertain(){ const out=[]; allMatGerEntries().forEach(x=>{ if(qeGet(x.e,x.cid,'hidden')===true) return; const unc=(x.e.natur_konfidenz==='mittel'||x.e.natur_konfidenz==='niedrig'); if(unc||overrides[x.cid]) out.push(x); }); return out; }
function collectHidden(){ const byCid=[]; const byMat=[]; const byStd=[]; const byRub=[];
  DB.standards.forEach(std=>{ (std.rubriken||[]).forEach((r,ri)=>{ (r.sub_bereiche||[]).forEach((sb,si)=>{ (sb.eintraege||[]).forEach((e,ei)=>{ const cid=cidOf(std.id,ri,si,ei); if(QE.cid[cid]&&QE.cid[cid].hidden){ byCid.push({cid,e,std,rubrik:r.name}); } }); }); }); });
  Object.keys(QE.mat).forEach(mk=>{ if(QE.mat[mk]&&QE.mat[mk].hidden) byMat.push(mk); });
  DB.standards.forEach(s=>{ if(stdHidden(s)) byStd.push(s); });
  Object.keys(RUBE).forEach(k=>{ if(!RUBE[k]||!RUBE[k].hidden) return; const sid=k.split('|')[0]; const part=k.slice(sid.length+1); const s=DB.standards.find(x=>x.id===sid); if(!s) return;
    let r=null; if(part.indexOf('nr:')===0){ r=s.rubriken.find(x=>x.__nrid===part.slice(3)); } else { r=s.rubriken[+part]; }
    byRub.push({key:k,std:s,name:(RUBE[k].name)||(r?r.name:part)}); });
  return {byCid,byMat,byStd,byRub}; }
function restoreStd(id){ if(STDE[id]){ delete STDE[id].hidden; if(Object.keys(STDE[id]).length===0) delete STDE[id]; } saveSTDE(); renderAdmin(); toast('Standard wieder sichtbar'); }
function restoreRub(key){ if(RUBE[key]){ delete RUBE[key].hidden; if(Object.keys(RUBE[key]).length===0) delete RUBE[key]; } saveRUBE(); renderAdmin(); toast('Rubrik wieder sichtbar'); }
function restoreCid(cid){ if(QE.cid[cid]){ delete QE.cid[cid].hidden; if(Object.keys(QE.cid[cid]).length===0) delete QE.cid[cid]; } saveQE(); buildMaterialIndex(); renderAdmin(); toast('Wiederhergestellt'); }
function hideCid(cid){ (QE.cid[cid]=QE.cid[cid]||{}).hidden=true; saveQE(); buildMaterialIndex(); renderAdmin(); toast('Ausgeblendet'); }

