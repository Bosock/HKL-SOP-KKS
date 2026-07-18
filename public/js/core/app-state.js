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
/* Kaskade (Verwaltungspolitik): EIN Resolver über Regeln (📍 Stelle > 📄 Standard
   > 🗂 Gruppe > 🌐 alle) UND die Alt-Speicher als Rand (Stelle=QE.cid, alle=QE.mat).
   Ohne Regeln identisch zum früheren Verhalten (QE.cid vor QE.mat). */
function qeGet(e,cid,prop){
  if(typeof ruleResolve!=='function'){ const c=QE.cid[cid]; if(c&&c[prop]!==undefined) return c[prop]; const mk=e&&e.material_key; if(mk){ const m=QE.mat[mk]; if(m&&m[prop]!==undefined) return m[prop]; } return undefined; }
  const lg={}; const c=QE.cid[cid]; if(c&&c[prop]!==undefined) lg.stelle=c[prop];
  const mk=e&&e.material_key; const m=mk&&QE.mat[mk]; if(m&&m[prop]!==undefined) lg.alle=m[prop];
  return ruleResolve(e,cid,prop,lg); }
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
  h+=sAct('🔎','Globale Suche','Material, Gerät, Synonym …',"showSheet(false);openGlobalSearch()");
  h+=sAct('📖','Abkürzungsglossar','Begriffe nachschlagen',"showSheet(false);openGlossary()");
  { const pend=(typeof pendingSuggestions==='function')?pendingSuggestions().length:0;
    h+=sAct('✍️','Änderungsvorschläge',pend?(pend+' offen'):'ansehen & bewerten',"showSheet(false);openSuggestions()"); }
  h+=sAct('📷','Etikett scannen','Produkt per Barcode erfassen & finden',"showSheet(false);openScanHub()");
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
/* Rubrik-Vorlagen mit Geltungsbereich: erscheinen automatisch in allen
   passenden Standards. { id, name, typ, scope:'std'|'groups'|'all',
   std?:<id>, groups?:[...] } */
let RUBTPL=loadJSON('hkl_rubtpl',[]);   function saveRubTpl(){ saveJSON('hkl_rubtpl',RUBTPL); }
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
/* Per INDEX statt Name aufgerufen (Freitext gehört nicht in onclick – esc()
   escaped kein Apostroph, siehe ARCHITECTURE.md „Altlasten"). */
function moveGroup(i,dir){ const list=distinctGroups(); const j=i+dir; if(i<0||i>=list.length||j<0||j>=list.length) return; const t=list[i]; list[i]=list[j]; list[j]=t; GRPORD=list; saveGRPORD(); renderAdmin(); }
function distinctRubrics(){ const s=new Set(); DB.standards.forEach(std=>(std.rubriken||[]).forEach(r=>s.add(r.name))); return [...s].sort((a,b)=>a.localeCompare(b,'de')); }
function rubIconEff(r,i){ return RUBICON[r.name] || rubrikIcon(rubName(r,i), r.typ); }
/* Per INDEX in distinctRubrics() aufgerufen (kein Freitext in onclick). */
function editRubIcon(i){ if(!ADMIN) return; const name=distinctRubrics()[i]; if(name==null) return; const cur=RUBICON[name]||''; const v=prompt('Symbol (Emoji) für Rubriken namens „'+name+'":',cur); if(v==null) return; if(v.trim()==='') delete RUBICON[name]; else RUBICON[name]=v.trim(); saveRUBICON(); renderAdmin(); }
function setDesign(k,v){ DESIGN[k]=v; saveDESIGN(); applyDesign(); renderAdmin(); }
function resetDesign(){ DESIGN={}; saveDESIGN(); const root=document.documentElement; ['--accent','--accent-deep','--size','--size-bg','--size-bd'].forEach(x=>root.style.removeProperty(x)); try{ if(document.body&&document.body.style) document.body.style.zoom='1'; }catch(e){} applyNatConfig(); renderAdmin(); toast('Design zurückgesetzt'); }
function setTxt(k,v){ if(v.trim()==='') delete TXT[k]; else TXT[k]=v; saveTXT(); updateBar(); renderAdmin(); }
function resetTxt(){ TXT={}; saveTXT(); updateBar(); renderAdmin(); toast('Texte zurückgesetzt'); }
function newStdToObj(n){ return { id:'ns:'+n.id, dateiname:'(App-eigen)', titel:n.titel, gruppe:n.gruppe||'EIGENE', __new:true, rubriken:[
  { name:'Materialien', typ:'material', sub_bereiche:[{name:null,eintraege:[]}] },
  { name:'Ablauf', typ:'sonstige', sub_bereiche:[{name:null,eintraege:[]}] } ] }; }
function newRubToObj(n){ return { name:n.name, typ:n.typ||'sonstige', __nrid:n.id, sub_bereiche:[{name:null,eintraege:[]}] }; }
function tplRubToObj(t){ return { name:t.name, typ:t.typ||'sonstige', __tplid:t.id, sub_bereiche:[{name:null,eintraege:[]}] }; }
/* Gilt eine Rubrik-Vorlage für diesen Standard? (rein/testbar) */
function rubTplMatches(tpl,stdId,grp){ if(!tpl) return false;
  if(tpl.scope==='all') return true;
  if(tpl.scope==='std') return tpl.std===stdId;
  if(tpl.scope==='groups') return Array.isArray(tpl.groups)&&tpl.groups.indexOf(grp)>=0;
  return false; }
/* Legt App-eigene Standards/Rubriken + Rubrik-Vorlagen über das DB. WICHTIG:
   nie das (ggf. mit DB_BASE geteilte) Standard-Objekt mutieren – sonst
   „wandern" eingefügte Rubriken in die Basis und Einträge gehen beim nächsten
   rebuildDB verloren. Betroffene Standards werden daher geklont. */
function mergeCustomIntoDB(){ NEWSTD.forEach(n=>{ if(!DB.standards.find(s=>s.id==='ns:'+n.id)) DB.standards.push(newStdToObj(n)); });
  if(!NEWRUB.length && !RUBTPL.length) return;
  DB.standards=DB.standards.map(s=>{ const grp=stdGruppe(s); const add=[];
    NEWRUB.forEach(n=>{ if(n.std===s.id && !((s.rubriken||[]).find(r=>r.__nrid===n.id)) && !add.find(r=>r.__nrid===n.id)) add.push(newRubToObj(n)); });
    RUBTPL.forEach(t=>{ if(rubTplMatches(t,s.id,grp) && !((s.rubriken||[]).find(r=>r.__tplid===t.id)) && !add.find(r=>r.__tplid===t.id)) add.push(tplRubToObj(t)); });
    if(!add.length) return s; return Object.assign({},s,{rubriken:(s.rubriken||[]).concat(add)}); }); }
function stdTitel(s){ return (STDE[s.id]&&STDE[s.id].titel)||s.titel; }
function stdGruppe(s){ return (STDE[s.id]&&STDE[s.id].gruppe)||s.gruppe; }
function stdHidden(s){ return !!(STDE[s.id]&&STDE[s.id].hidden); }
function rubKey(r,idx){ return curStd.id+'|'+(r.__tplid?('tpl:'+r.__tplid):(r.__nrid?('nr:'+r.__nrid):idx)); }
function rubName(r,idx){ const e=RUBE[rubKey(r,idx)]; return (e&&e.name)||r.name; }
function rubHidden(r,idx){ const e=RUBE[rubKey(r,idx)]; return !!(e&&e.hidden); }
function rubOrd(r,idx){ const e=RUBE[rubKey(r,idx)]; return (e&&e.ord!=null)?e.ord:idx; }
/* Standards werden ausschließlich über das Formular-System (openStandardForm →
   ADDITIONS) angelegt; das frühere prompt-basierte newStandard() wurde bei der
   Konsolidierung entfernt. */
function editStandard(){ if(!ADMIN||!curStd) return; const t=prompt('Titel:',stdTitel(curStd)); if(t==null) return; const g=prompt('Gruppe:',stdGruppe(curStd)); if(g==null) return;
  STDE[curStd.id]=Object.assign({},STDE[curStd.id],{titel:(t.trim()||stdTitel(curStd)),gruppe:(g.trim()||stdGruppe(curStd))}); saveSTDE(); openStandard(curStd.id,true); toast('Standard aktualisiert'); }
function toggleStdHidden(){ if(!ADMIN||!curStd) return; const h=!stdHidden(curStd); if(h&&!confirm('Standard ausblenden? Kolleginnen sehen ihn dann nicht mehr; Wiederherstellung in Verwaltung → Ausgeblendete Einträge.')) return;
  STDE[curStd.id]=Object.assign({},STDE[curStd.id],{hidden:h}); saveSTDE(); toast(h?'Standard ausgeblendet':'Standard wieder sichtbar'); openStandard(curStd.id,true); }
function deleteNewStandard(){ if(!ADMIN||!curStd||!curStd.__new) return; if(!confirm('Diesen App-eigenen Standard endgültig löschen (samt seiner Einträge)?')) return;
  const nid=curStd.id.slice(3); NEWSTD=NEWSTD.filter(x=>x.id!==nid); saveNEWSTD();
  NEW=NEW.filter(x=>x.std!==curStd.id); saveNEW(); NEWRUB=NEWRUB.filter(x=>x.std!==curStd.id); saveNEWRUB();
  const i=DB.standards.findIndex(s=>s.id===curStd.id); if(i>=0) DB.standards.splice(i,1);
  nav=[]; location.hash=''; setMode('use'); toast('Standard gelöscht'); }
/* Öffnet das Rubrik-Formular (Name, Typ, Geltungsbereich). Ersetzt das frühere
   prompt-basierte Anlegen; neue Rubriken sind jetzt Vorlagen mit Geltungsbereich. */
function addRubrik(){ if(!ADMIN||!curStd) return; openRubrikForm(null); }
function makeRubTpl(f){ const id=f.id||('t'+Date.now().toString(36)+Math.floor(Math.random()*10000));
  const typ=(f.typ==='material'||f.typ==='geraete')?f.typ:'sonstige';
  const scope=(f.scope==='groups'||f.scope==='all')?f.scope:'std';
  const tpl={id,name:(f.name||'').trim(),typ,scope};
  if(scope==='std') tpl.std=f.std||(curStd&&curStd.id)||null;
  if(scope==='groups') tpl.groups=(f.groups||[]).slice();
  return tpl; }
function saveRubrikTpl(f){ const tpl=makeRubTpl(f); const i=RUBTPL.findIndex(t=>t.id===tpl.id);
  if(i>=0) RUBTPL[i]=tpl; else RUBTPL.push(tpl); saveRubTpl(); rebuildDB(); }
function deleteRubTpl(id){ RUBTPL=RUBTPL.filter(t=>t.id!==id); saveRubTpl(); rebuildDB(); }
/* Schaltet eine Vorlage für eine Gruppe an/aus (Matrix-Zelle). Die Gruppe wird
   über ihren Index geliefert (kein Freitext im onclick – esc()-Caveat). */
function toggleTplGroup(id,gi){ const t=RUBTPL.find(x=>x.id===id); if(!t) return; const grp=distinctGroups()[gi]; if(grp==null) return;
  if(t.scope==='all'){ /* „alle" auf konkrete Gruppen herunterbrechen, dann die eine entfernen */
    t.scope='groups'; t.groups=distinctGroups().filter(g=>g!==grp); delete t.std; }
  else if(t.scope==='groups'){ t.groups=t.groups||[]; const i=t.groups.indexOf(grp); if(i>=0) t.groups.splice(i,1); else t.groups.push(grp); }
  else { /* std → groups mit dieser einen Gruppe */ t.scope='groups'; t.groups=[grp]; delete t.std; }
  saveRubTpl(); rebuildDB(); renderAdmin(); }
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
/* Einträge werden ausschließlich über das Formular-System (startAddEntry →
   ADDITIONS) angelegt; das frühere prompt-basierte addNewEntry() wurde bei der
   Konsolidierung entfernt. Bestehende Alt-Einträge (NEW) werden weiterhin
   angezeigt (newEntriesFor), aber nicht mehr neu erzeugt. */
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
const effNatur=(e,cid)=>{ if(typeof ruleResolve!=='function') return overrides[cid]||(e.material_key&&QE.mat[e.material_key]&&QE.mat[e.material_key].natur)||e.natur_manuell||e.natur;
  const lg={}; if(overrides[cid]!==undefined) lg.stelle=overrides[cid]; const mk=e.material_key; if(mk&&QE.mat[mk]&&QE.mat[mk].natur!==undefined) lg.alle=QE.mat[mk].natur;
  const v=ruleResolve(e,cid,'natur',lg); return (v!==undefined&&v!==null&&v!=='')?v:(e.natur_manuell||e.natur); };
const isHandled=(cid)=>!!reviewed[cid]||!!overrides[cid];
function rawUk(e,cid){ if(typeof ruleResolve!=='function'){ if(cid in reassign) return reassign[cid]; if(e.material_key&&QE.mat[e.material_key]&&('uk' in QE.mat[e.material_key])) return QE.mat[e.material_key].uk; return e.unterkategorie; }
  const lg={}; if(cid in reassign) lg.stelle=reassign[cid]; const mk=e.material_key; if(mk&&QE.mat[mk]&&('uk' in QE.mat[mk])) lg.alle=QE.mat[mk].uk;
  const v=ruleResolve(e,cid,'uk',lg); return (v!==undefined)?v:e.unterkategorie; }
function canonUk(e,cid){ const r=rawUk(e,cid); if(r==null||r==='') return null; return ukMap[r]||r; }
function ukMetaOf(name){ return ukMeta[name]||{}; }
function ukColorOf(name,idx){ const m=ukMetaOf(name); if(m.color) return m.color; return UK_PALETTE[(idx>=0?idx:0)%UK_PALETTE.length]; }
function ukIconOf(name){ const m=ukMetaOf(name); return m.icon||ukKeywordIcon(name); }

