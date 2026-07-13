/* ---- Zustand ---- */
let NATCFG=loadNatCfg();
let DB=null, DB_BASE=null, MAT_INDEX=[], nav=[], mode='use', curStd=null, careFilter='alle';
let formCtx=null; /* aktuell offenes Hinzufügen-/Bearbeiten-Formular (Rücksprung) */
let ADDITIONS=loadAdditions();
let CATALOG=loadCatalog();
let admNat='alle', admState='offen';
let careMem=loadJSON('hkl_care',{});
let checks=loadChecks();
let overrides=loadJSON('hkl_overrides',{});
/* QE = Schnellmenü-Änderungen. cid = nur dieser Eintrag; mat = dieses Material überall. */
let QE=loadJSON('hkl_qedits',{cid:{},mat:{}}); if(!QE.cid)QE.cid={}; if(!QE.mat)QE.mat={};
function saveQE(){ saveJSON('hkl_qedits',QE); }
function qeGet(e,cid,prop){ const c=QE.cid[cid]; if(c&&c[prop]!==undefined) return c[prop]; const mk=e&&e.material_key; if(mk){ const m=QE.mat[mk]; if(m&&m[prop]!==undefined) return m[prop]; } return undefined; }
function qeSet(scope,e,cid,prop,val){ if(scope==='mat'&&e.material_key){ (QE.mat[e.material_key]=QE.mat[e.material_key]||{})[prop]=val; } else { (QE.cid[cid]=QE.cid[cid]||{})[prop]=val; } saveQE(); }
/* Rollentrennung per Anmeldung (Hamburger-Menü). Sitzung überlebt bis 1 h Inaktivität. */
let ADMIN=authValid();
function applyAdminUI(){ const mr=$('modesRow'); if(mr) mr.style.display='none'; if(!ADMIN&&mode!=='use') setMode('use'); const mb=$('menuBtn'); if(mb) mb.textContent='☰'; }
function checkAdminHash(){ if((location.hash||'')!=='#admin') return; try{ location.hash=''; }catch(e){} if(!ADMIN) promptLogin(); }
function doLogin(pw){ if(checkPw(pw)){ ADMIN=true; store.set('hkl_authuntil', String(Date.now()+AUTH_TTL)); applyAdminUI(); return true; } return false; }
function promptLogin(){ const pw=prompt('Passwort für den Verwaltungsmodus:'); if(pw==null) return; if(doLogin(pw)){ showSheet(false); toast('Angemeldet – Verwaltungsmodus aktiv'); setMode('admin'); } else { toast('Falsches Passwort',true); } }
function promptLoginThen(cb){ const pw=prompt('Du bist nicht berechtigt, Änderungen durchzuführen.\nBitte Passwort eingeben:'); if(pw==null) return; if(doLogin(pw)){ toast('Angemeldet'); if(cb) cb(); } else { toast('Falsches Passwort',true); } }
function changePw(){ const o=prompt('Aktuelles Passwort:'); if(o==null) return; if(!checkPw(o)){ toast('Aktuelles Passwort falsch',true); return; } const n1=prompt('Neues Passwort:'); if(n1==null||!n1.trim()){ toast('Abgebrochen'); return; } const n2=prompt('Neues Passwort bestätigen:'); if(n2==null) return; if(n1!==n2){ toast('Bestätigung stimmt nicht überein',true); return; } setAuthPw(n1.trim()); toast('Passwort geändert'); }
function adminLogout(){ ADMIN=false; store.set('hkl_authuntil','0'); applyAdminUI(); showSheet(false); setMode('use'); toast('Abgemeldet'); }
function openMenu(){ let h=`<div class="sheet-grip"></div><div class="sheet-title">Menü${ADMIN?' · angemeldet':''}</div>`;
  h+=sAct('📋','Alle Standards','Übersicht',"menuGo('use')");
  if(ADMIN){ h+=sAct('🛠️','Verwaltung','Einstellungen & Bearbeitung',"menuGo('admin')");
    h+=sAct('📦','Material pflegen','Fotos & Lagerorte',"menuGo('care')");
    h+=sAct('🔑','Passwort ändern','',"changePw()");
    h+=sAct('🚪','Abmelden','Verwaltungsmodus beenden',"adminLogout()"); }
  else { h+=sAct('🔒','Anmelden','Verwaltung freischalten',"promptLogin()"); }
  h+=sAct('◐','Ansicht hell/dunkel','',"toggleTheme();showSheet(false)");
  h+=`<button class="sheet-close" onclick="showSheet(false)">Schließen</button>`;
  $('sheet').innerHTML=h; showSheet(true); }
function menuGo(m){ showSheet(false); setMode(m); }
/* Selbst angelegte Einträge (App-eigene, existieren in keiner Word-Datei) */
let NEW=loadJSON('hkl_newentries',[]);
function saveNEW(){ saveJSON('hkl_newentries',NEW); }
/* App-eigene Standards & Rubriken + Bearbeitungs-Overrides + Eintrag-Reihenfolge */
let NEWSTD=loadJSON('hkl_newstd',[]);   function saveNEWSTD(){ saveJSON('hkl_newstd',NEWSTD); }
let NEWRUB=loadJSON('hkl_newrub',[]);   function saveNEWRUB(){ saveJSON('hkl_newrub',NEWRUB); }
let STDE=loadJSON('hkl_stdedits',{});   function saveSTDE(){ saveJSON('hkl_stdedits',STDE); }
let RUBE=loadJSON('hkl_rubedits',{});   function saveRUBE(){ saveJSON('hkl_rubedits',RUBE); }
let ENTORD=loadJSON('hkl_entryorder',{}); function saveENTORD(){ saveJSON('hkl_entryorder',ENTORD); }
/* ===== Paket 4: App-Gestalt ===== */
const TXT_DEF={ appTitle:'HKL Standards', careTitle:'Materialwirtschaft', careIntro:'Jedes Produkt einmal pflegen: Foto und Lagerort. Deine Angaben gelten überall, wo dieses Material vorkommt.', pruefTitle:'Einstufung prüfen' };
let TXT=loadJSON('hkl_txt',{}); function saveTXT(){ saveJSON('hkl_txt',TXT); }
function txt(k){ return (TXT[k]!==undefined && TXT[k]!=='')?TXT[k]:(TXT_DEF[k]||''); }
let DESIGN=loadJSON('hkl_design',{}); function saveDESIGN(){ saveJSON('hkl_design',DESIGN); }
function hexA(hex,a){ hex=(hex||'').replace('#',''); if(hex.length===3) hex=hex.split('').map(c=>c+c).join(''); const r=parseInt(hex.slice(0,2),16)||0,g=parseInt(hex.slice(2,4),16)||0,b=parseInt(hex.slice(4,6),16)||0; return 'rgba('+r+','+g+','+b+','+a+')'; }
function applyDesign(){ const root=document.documentElement;
  if(DESIGN.accent){ root.style.setProperty('--accent',DESIGN.accent); root.style.setProperty('--accent-deep',DESIGN.accent); }
  if(DESIGN.size){ root.style.setProperty('--size',DESIGN.size); root.style.setProperty('--size-bg',hexA(DESIGN.size,0.12)); root.style.setProperty('--size-bd',hexA(DESIGN.size,0.34)); }
  const zoom={normal:'1',gross:'1.15',wand:'1.35'}[DESIGN.scale||'normal']; try{ if(document.body&&document.body.style) document.body.style.zoom=zoom; }catch(e){} }
let GRPORD=loadJSON('hkl_grpord',[]); function saveGRPORD(){ saveJSON('hkl_grpord',GRPORD); }
let RUBICON=loadJSON('hkl_rubicon',{}); function saveRUBICON(){ saveJSON('hkl_rubicon',RUBICON); }
function groupSort(keys){ return keys.slice().sort((a,b)=>{ let ia=GRPORD.indexOf(a), ib=GRPORD.indexOf(b); if(ia<0)ia=1e6; if(ib<0)ib=1e6; if(ia!==ib) return ia-ib; return a.localeCompare(b,'de'); }); }
function distinctGroups(){ const s=new Set(); DB.standards.forEach(x=>s.add(stdGruppe(x))); return groupSort([...s]); }
function moveGroup(name,dir){ const list=distinctGroups(); const i=list.indexOf(name); const j=i+dir; if(i<0||j<0||j>=list.length) return; const t=list[i]; list[i]=list[j]; list[j]=t; GRPORD=list; saveGRPORD(); renderAdmin(); }
function distinctRubrics(){ const s=new Set(); DB.standards.forEach(std=>(std.rubriken||[]).forEach(r=>s.add(r.name))); return [...s].sort((a,b)=>a.localeCompare(b,'de')); }
function rubIconEff(r,i){ return RUBICON[r.name] || rubrikIcon(rubName(r,i), r.typ); }
function editRubIcon(name){ if(!ADMIN) return; const cur=RUBICON[name]||''; const v=prompt('Symbol (Emoji) für Rubriken namens „'+name+'":',cur); if(v==null) return; if(v.trim()==='') delete RUBICON[name]; else RUBICON[name]=v.trim(); saveRUBICON(); renderAdmin(); }
function setDesign(k,v){ DESIGN[k]=v; saveDESIGN(); applyDesign(); renderAdmin(); }
function resetDesign(){ DESIGN={}; saveDESIGN(); const root=document.documentElement; ['--accent','--accent-deep','--size','--size-bg','--size-bd'].forEach(x=>root.style.removeProperty(x)); try{ if(document.body&&document.body.style) document.body.style.zoom='1'; }catch(e){} applyNatConfig(); renderAdmin(); toast('Design zurückgesetzt'); }
function setTxt(k,v){ if(v.trim()==='') delete TXT[k]; else TXT[k]=v; saveTXT(); updateBar(); renderAdmin(); }
function resetTxt(){ TXT={}; saveTXT(); updateBar(); renderAdmin(); toast('Texte zurückgesetzt'); }
function newStdToObj(n){ return { id:'ns:'+n.id, dateiname:'(App-eigen)', titel:n.titel, gruppe:n.gruppe||'EIGENE', __new:true, rubriken:[
  { name:'Materialien', typ:'material', sub_bereiche:[{name:null,eintraege:[]}] },
  { name:'Ablauf', typ:'sonstige', sub_bereiche:[{name:null,eintraege:[]}] } ] }; }
function newRubToObj(n){ return { name:n.name, typ:n.typ||'sonstige', __nrid:n.id, sub_bereiche:[{name:null,eintraege:[]}] }; }
function mergeCustomIntoDB(){ NEWSTD.forEach(n=>{ if(!DB.standards.find(s=>s.id==='ns:'+n.id)) DB.standards.push(newStdToObj(n)); });
  NEWRUB.forEach(n=>{ const s=DB.standards.find(x=>x.id===n.std); if(s && !s.rubriken.find(r=>r.__nrid===n.id)) s.rubriken.push(newRubToObj(n)); }); }
function stdTitel(s){ return (STDE[s.id]&&STDE[s.id].titel)||s.titel; }
function stdGruppe(s){ return (STDE[s.id]&&STDE[s.id].gruppe)||s.gruppe; }
function stdHidden(s){ return !!(STDE[s.id]&&STDE[s.id].hidden); }
function rubKey(r,idx){ return curStd.id+'|'+(r.__nrid?('nr:'+r.__nrid):idx); }
function rubName(r,idx){ const e=RUBE[rubKey(r,idx)]; return (e&&e.name)||r.name; }
function rubHidden(r,idx){ const e=RUBE[rubKey(r,idx)]; return !!(e&&e.hidden); }
function rubOrd(r,idx){ const e=RUBE[rubKey(r,idx)]; return (e&&e.ord!=null)?e.ord:idx; }
function newStandard(){ if(!ADMIN) return; const t=prompt('Titel des neuen Standards:',''); if(t==null||!t.trim()) return; const g=prompt('Gruppe (z. B. CRM, EPU, PCI …):','EIGENE')||'EIGENE';
  const id='s'+Date.now().toString(36)+Math.floor(Math.random()*10000); NEWSTD.push({id,titel:t.trim(),gruppe:g.trim()||'EIGENE'}); saveNEWSTD(); mergeCustomIntoDB(); renderStandards(); toast('Standard angelegt'); }
function editStandard(){ if(!ADMIN||!curStd) return; const t=prompt('Titel:',stdTitel(curStd)); if(t==null) return; const g=prompt('Gruppe:',stdGruppe(curStd)); if(g==null) return;
  STDE[curStd.id]=Object.assign({},STDE[curStd.id],{titel:(t.trim()||stdTitel(curStd)),gruppe:(g.trim()||stdGruppe(curStd))}); saveSTDE(); openStandard(curStd.id,true); toast('Standard aktualisiert'); }
function toggleStdHidden(){ if(!ADMIN||!curStd) return; const h=!stdHidden(curStd); if(h&&!confirm('Standard ausblenden? Kolleginnen sehen ihn dann nicht mehr; Wiederherstellung in Verwaltung → Ausgeblendete Einträge.')) return;
  STDE[curStd.id]=Object.assign({},STDE[curStd.id],{hidden:h}); saveSTDE(); toast(h?'Standard ausgeblendet':'Standard wieder sichtbar'); openStandard(curStd.id,true); }
function deleteNewStandard(){ if(!ADMIN||!curStd||!curStd.__new) return; if(!confirm('Diesen App-eigenen Standard endgültig löschen (samt seiner Einträge)?')) return;
  const nid=curStd.id.slice(3); NEWSTD=NEWSTD.filter(x=>x.id!==nid); saveNEWSTD();
  NEW=NEW.filter(x=>x.std!==curStd.id); saveNEW(); NEWRUB=NEWRUB.filter(x=>x.std!==curStd.id); saveNEWRUB();
  const i=DB.standards.findIndex(s=>s.id===curStd.id); if(i>=0) DB.standards.splice(i,1);
  nav=[]; location.hash=''; setMode('use'); toast('Standard gelöscht'); }
function addRubrik(){ if(!ADMIN||!curStd) return; const nm=prompt('Name der neuen Rubrik:',''); if(nm==null||!nm.trim()) return;
  const ty=(prompt('Typ: material / geraete / sonstige','sonstige')||'sonstige').trim().toLowerCase(); const typ=(ty==='material'||ty==='geraete')?ty:'sonstige';
  const id='r'+Date.now().toString(36)+Math.floor(Math.random()*10000); NEWRUB.push({id,std:curStd.id,name:nm.trim(),typ}); saveNEWRUB(); mergeCustomIntoDB(); openStandard(curStd.id,true); toast('Rubrik angelegt'); }
function renameRubrik(idx){ if(!ADMIN) return; const r=curStd.rubriken[idx]; const nn=prompt('Rubrik umbenennen:',rubName(r,idx)); if(nn==null||!nn.trim()) return;
  const k=rubKey(r,idx); RUBE[k]=Object.assign({},RUBE[k],{name:nn.trim()}); saveRUBE(); openStandard(curStd.id,true); }
function toggleRubHidden(idx){ if(!ADMIN) return; const r=curStd.rubriken[idx]; const k=rubKey(r,idx); const h=!rubHidden(r,idx);
  if(r.__nrid&&h){ if(!confirm('App-eigene Rubrik endgültig löschen (samt Einträgen)?')) return; NEWRUB=NEWRUB.filter(x=>x.id!==r.__nrid); saveNEWRUB(); NEW=NEW.filter(x=>!(x.std===curStd.id&&x.rub==='nr:'+r.__nrid)); saveNEW(); const i=curStd.rubriken.indexOf(r); if(i>=0) curStd.rubriken.splice(i,1); delete RUBE[k]; saveRUBE(); openStandard(curStd.id,true); toast('Rubrik gelöscht'); return; }
  RUBE[k]=Object.assign({},RUBE[k],{hidden:h}); saveRUBE(); openStandard(curStd.id,true); toast(h?'Rubrik ausgeblendet':'Rubrik wieder sichtbar'); }
function moveRubrik(idx,dir){ if(!ADMIN) return; const vis=curStd.rubriken.map((r,i)=>({r,i})).sort((a,b)=>rubOrd(a.r,a.i)-rubOrd(b.r,b.i));
  const pos=vis.findIndex(x=>x.i===idx); const j=pos+dir; if(j<0||j>=vis.length) return;
  vis.forEach((x,k)=>{ const key=rubKey(x.r,x.i); RUBE[key]=Object.assign({},RUBE[key],{ord:k}); });
  const a=vis[pos], b=vis[j]; const ka=rubKey(a.r,a.i), kb=rubKey(b.r,b.i); const t=RUBE[ka].ord; RUBE[ka].ord=RUBE[kb].ord; RUBE[kb].ord=t; saveRUBE(); openStandard(curStd.id,true); }
function newToEntry(n){ return { roh_text:n.name, anzeige_text:n.name, menge:n.menge||null, menge_zahl:null, natur:n.natur||'material', natur_konfidenz:'hoch', natur_merkmale:[], natur_manuell:null, unterkategorie:n.uk||null, spalte:null, groessen:[], spezifikation:null, zusatz_markierung:null, material_key:null, ist_fliesstext:false, __new:true }; }
function addNewEntry(idxKey,uk,natur){ if(!ADMIN) return; const name=prompt('Name des neuen Eintrags:',''); if(name==null||!name.trim()) return; const menge=prompt('Menge (z. B. 1x — leer lassen = keine):','');
  const id='n'+Date.now().toString(36)+Math.floor(Math.random()*10000);
  NEW.push({id, std:curStd.id, rub:idxKey, uk:(uk||null), name:name.trim(), menge:(menge&&menge.trim())?menge.trim():null, natur:natur||'material'});
  saveNEW(); toast('Eintrag angelegt'); reRenderDetail(); }
function rubIdxKey(r,idx){ return r.__nrid?('nr:'+r.__nrid):idx; }
function newEntriesFor(r,idx){ const key=rubIdxKey(r,idx); return NEW.filter(n=>n.std===curStd.id && String(n.rub)===String(key)); }
function orderKeyFor(idx,uk){ const r=curStd.rubriken[idx]; return curStd.id+'|'+rubIdxKey(r,idx)+'|'+(uk||''); }
function sortByOrder(list,key){ const ord=ENTORD[key]; if(!ord||!ord.length) return list;
  return list.slice().sort((a,b)=>{ let pa=ord.indexOf(a.cid), pb=ord.indexOf(b.cid); if(pa<0)pa=1e6+list.indexOf(a); if(pb<0)pb=1e6+list.indexOf(b); return pa-pb; }); }
function collectGroupCids(idx,uk){ const r=curStd.rubriken[idx]; const isMatGer=(r.typ==='material'||r.typ==='geraete'); const out=[];
  (r.sub_bereiche||[]).forEach((sb,si)=>{ (sb.eintraege||[]).forEach((e,ei)=>{ if(e.natur==='ueberschrift') return; if(settings.fliesstext===false&&e.ist_fliesstext) return;
    const cid=cidOf(curStd.id,idx,si,ei); if(qeGet(e,cid,'hidden')===true) return;
    if(isMatGer){ if((canonUk(e,cid)||'')!==(uk||'')) return; } out.push({e,cid}); }); });
  newEntriesFor(r,idx).forEach(n=>{ const cid='new|'+n.id; const e=newToEntry(n); if(qeGet(e,cid,'hidden')===true) return;
    if(isMatGer){ if((canonUk(e,cid)||'')!==(uk||'')) return; } out.push({e,cid}); });
  return sortByOrder(out, orderKeyFor(idx,uk)); }
function ablaufSegments(idx){ const r=curStd.rubriken[idx]; const blocks=[]; const segOf={}; let seg=-1; let cur=null;
  const startSeg=(head)=>{ seg++; cur={head:head||null, segId:'seg'+seg, items:[]}; blocks.push(cur); };
  (r.sub_bereiche||[]).forEach((sb,si)=>{ if(sb.name) startSeg(sb.name);
    (sb.eintraege||[]).forEach((e,ei)=>{ const cid=cidOf(curStd.id,idx,si,ei);
      if(e.natur==='ueberschrift'){ startSeg(e.anzeige_text||e.roh_text); return; }
      if(settings.fliesstext===false&&e.ist_fliesstext) return;
      if(qeGet(e,cid,'hidden')===true) return;
      if(!cur) startSeg(null); cur.items.push({e,cid}); segOf[cid]=cur.segId; }); });
  const news=newEntriesFor(r,idx);
  if(news.length){ const nb={head:null,segId:'segnew',items:[]};
    news.forEach(n=>{ const cid='new|'+n.id; const e=newToEntry(n); if(qeGet(e,cid,'hidden')===true) return; nb.items.push({e,cid}); segOf[cid]='segnew'; });
    if(nb.items.length) blocks.push(nb); }
  blocks.forEach(b=>{ b.items=sortByOrder(b.items, orderKeyFor(idx,b.segId)); });
  return {blocks, segOf}; }
function moveEntry(dir){ const cid=sheetCid, e=sheetEntry; if(!cid||!e) return; const top=nav[nav.length-1]; if(!top||top.lvl!=='rub'){ showSheet(false); return; }
  const idx=top.idx; const r=curStd.rubriken[idx]; const isMatGer=(r.typ==='material'||r.typ==='geraete'); let list, okey;
  if(isMatGer){ const uk=canonUk(e,cid)||''; list=collectGroupCids(idx,uk).map(x=>x.cid); okey=orderKeyFor(idx,uk); }
  else { const seg=ablaufSegments(idx); const segId=seg.segOf[cid]; if(!segId){ showSheet(false); return; } const b=seg.blocks.find(x=>x.segId===segId); list=b.items.map(x=>x.cid); okey=orderKeyFor(idx,segId); }
  const pos=list.indexOf(cid); const j=pos+dir; if(pos<0||j<0||j>=list.length){ toast(dir<0?'Schon ganz oben':'Schon ganz unten'); return; }
  const t=list[pos]; list[pos]=list[j]; list[j]=t; ENTORD[okey]=list; saveENTORD(); showSheet(false); reRenderDetail(); }
let reviewed=loadJSON('hkl_reviewed',{});
let reassign=loadJSON('hkl_reassign',{});
let ukMap=loadJSON('hkl_ukmap',{});
let ukMeta=loadJSON('hkl_ukmeta',{});
let settings=Object.assign({menge:true,groessen:true,spez:true,lagerort:true,konfidenz:true,fliesstext:true}, loadJSON('hkl_settings',{}));
let collapsed={};
let UK_LIST=[];

function loadChecks(){ try{ const raw=store.get('hkl_checks'); if(!raw) return {}; const o=JSON.parse(raw); if(o.date!==today()){ store.set('hkl_checks',JSON.stringify({date:today(),checks:{}})); return {}; } return o.checks||{}; }catch(e){ return {}; } }
function saveChecks(){ store.set('hkl_checks',JSON.stringify({date:today(),checks:checks})); }

const cidOf=(sid,ri,si,ei)=>sid+'|'+ri+'|'+si+'|'+ei;
const effNatur=(e,cid)=>overrides[cid]||(e.material_key&&QE.mat[e.material_key]&&QE.mat[e.material_key].natur)||e.natur_manuell||e.natur;
const isHandled=(cid)=>!!reviewed[cid]||!!overrides[cid];
function rawUk(e,cid){ if(cid in reassign) return reassign[cid]; if(e.material_key&&QE.mat[e.material_key]&&('uk' in QE.mat[e.material_key])) return QE.mat[e.material_key].uk; return e.unterkategorie; }
function canonUk(e,cid){ const r=rawUk(e,cid); if(r==null||r==='') return null; return ukMap[r]||r; }
function ukMetaOf(name){ return ukMeta[name]||{}; }
function ukColorOf(name,idx){ const m=ukMetaOf(name); if(m.color) return m.color; return UK_PALETTE[(idx>=0?idx:0)%UK_PALETTE.length]; }
function ukIconOf(name){ const m=ukMetaOf(name); return m.icon||ukKeywordIcon(name); }

