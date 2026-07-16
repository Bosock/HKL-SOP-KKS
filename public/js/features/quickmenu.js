/* ============ Schnellmenü (Long-Press) ============ */
let sheetCid=null, sheetEntry=null, sheetPending=null;
function showSheet(on){ $('sheet').classList.toggle('show',on); $('sheetOv').classList.toggle('show',on); if(!on){ sheetCid=null; sheetEntry=null; sheetPending=null; } }
function openSheet(cid){ const e=findEntry(cid); if(!e) return; sheetCid=cid; sheetEntry=e; sheetPending=null; renderSheetMain(); showSheet(true); }
function sAct(ico,label,sub,fn,cls){ return `<button class="sheet-act ${cls||''}" onclick="${fn}"><span class="sa-ico">${ico}</span><span>${esc(label)}<span class="sa-sub">${esc(sub)}</span></span></button>`; }
function renderSheetMain(){ const e=sheetEntry, cid=sheetCid; if(!e) return;
  const dn=qeGet(e,cid,'name'); const name=(dn!==undefined?dn:e.anzeige_text);
  const imp=qeGet(e,cid,'important')===true; const mHi=qeGet(e,cid,'mengeHi')===true; const cur=natOf(effNatur(e,cid));
  let h=`<div class="sheet-grip"></div><div class="sheet-title">Schnellaktion · ${esc(cur.label)}${e._added?' · eigener Eintrag':''}</div><div class="sheet-name">${esc(name)}</div>`;
  h+=sAct('✏️','Details bearbeiten','Name, Menge, Größe, Kategorie …','sheetEditDetails()');
  h+=sAct('🏷️','Kategorie ändern',cur.label,"sheetGo('cat')");
  h+=sAct('✏️','Schnell umbenennen','nur Anzeigename','sheetRename()');
  h+=sAct('⭐',imp?'Wichtig-Markierung entfernen':'Als wichtig markieren',imp?'aktuell markiert':'hervorheben',"sheetToggle('important')");
  h+=sAct('🎨','Farblich absetzen','eigene Akzentfarbe',"sheetGo('color')");
  h+=sAct('#️⃣','Menge ändern',(qeGet(e,cid,'mengeVal')!==undefined?qeGet(e,cid,'mengeVal'):e.menge)||'keine Menge','sheetEditMenge()');
  h+=sAct('📏','Größen bearbeiten',(function(){const g=qeGet(e,cid,'groessen')!==undefined?qeGet(e,cid,'groessen'):e.groessen; return (g&&g.length)?g.map(x=>x.wert).join(', '):'keine';})(),'sheetEditSizes()');
  h+=sAct('🧷','Spezifikation bearbeiten',(function(){const s=qeGet(e,cid,'spez'); const v=(s!==undefined)?s:(Array.isArray(e.spezifikation)?e.spezifikation.join(' | '):e.spezifikation); return v||'keine';})(),'sheetEditSpez()');
  h+=sAct('⬆','Nach oben','Reihenfolge in der Gruppe','moveEntry(-1)');
  h+=sAct('⬇','Nach unten','Reihenfolge in der Gruppe','moveEntry(1)');
  h+=sAct('🔢',mHi?'Zahl normal anzeigen':'Zahl/Menge hervorheben',e.menge?('Menge '+e.menge):'keine Menge',"sheetToggle('mengeHi')");
  h+=sAct('🗂️','Unterkategorie ändern','Gruppe zuweisen',"sheetGo('uk')");
  if(natOf(effNatur(e,cid)).beschaffbar){ h+=sAct('📥','In Katalog aufnehmen','für andere Standards verfügbar','sheetAddToCatalog()'); }
  if(e._added){ h+=sAct('🗑️','Endgültig löschen','eigenen Eintrag entfernen','sheetDeleteAdded()','danger'); }
  else { h+=sAct('🗑️','Ausblenden / Löschen','aus der Anzeige entfernen','sheetDelete()','danger'); }
  h+=sAct('↺','Änderungen zurücksetzen','für diesen Eintrag','sheetResetEntry()');
  h+=`<button class="sheet-close" onclick="showSheet(false)">Schließen</button>`;
  $('sheet').innerHTML=h;
}
/* Öffnet das Bearbeiten-Formular direkt für eine cid (vom ✎-Button und vom
   Schnellmenü genutzt – eine gemeinsame Stelle statt doppelter Logik). */
function editEntry(cid){ const e=findEntry(cid); if(!e) return;
  if(e._added){ const p=cid.split('|'); openEntryForm({kind:'editAdd',sid:p[0],ri:+p[1],aid:e._aid,back:()=>reRenderDetail()}); }
  else { openEntryForm({kind:'editBase',cid,back:()=>reRenderDetail()}); } }
function sheetEditDetails(){ const cid=sheetCid, e=sheetEntry; if(!e) return; showSheet(false); editEntry(cid); }
function sheetDeleteAdded(){ const cid=sheetCid, e=sheetEntry; if(!e||!e._added) return; if(!confirm('Diesen eigenen Eintrag endgültig löschen? Das kann nicht rückgängig gemacht werden.')) return;
  const p=cid.split('|'); deleteAddEntry(p[0],+p[1],e._aid); showSheet(false); toast('Gelöscht'); reRenderDetail(); }
/* Übernimmt den aktuellen Eintrag (mit effektiven Werten) in den Katalog. */
function sheetAddToCatalog(){ const cid=sheetCid, e=sheetEntry; if(!e) return; const f=entryToForm(e,cid);
  if(!f.name||!f.name.trim()){ toast('Kein Name vorhanden',true); return; }
  const dup=CATALOG.items.some(it=>(it.name||'').trim().toLowerCase()===f.name.trim().toLowerCase()&&(it.nat||'material')===(f.nat||'material'));
  if(dup){ showSheet(false); toast('Schon im Katalog',true); return; }
  CATALOG.items=upsertCatalogItem(CATALOG.items,makeCatalogItem(Object.assign({},f,{id:newAid()}))); saveCatalog(); showSheet(false); toast('In Katalog aufgenommen'); }
function sheetGo(state){ if(state==='cat') renderSheetCat(); else if(state==='uk') renderSheetUk(); else if(state==='color') renderSheetColor(); }
function renderSheetCat(){ let h=`<div class="sheet-grip"></div><div class="sheet-title">Kategorie wählen</div><div class="sheet-pick">`;
  natList().forEach(n=>{ h+=`<button class="sheet-pick-btn" onclick="sheetSetNatur('${esc(n.key)}')"><span style="width:14px;height:14px;border-radius:4px;background:${n.color};display:inline-block"></span>${esc(n.label)}</button>`; });
  h+=`<button class="sheet-pick-btn" onclick="sheetNewNatur()">＋ Neue Kategorie…</button></div><button class="sheet-close" onclick="renderSheetMain()">Zurück</button>`;
  $('sheet').innerHTML=h; }
function sheetSetNatur(key){ sheetPending={kind:'natur',value:key}; askScope(); }
function sheetNewNatur(){ const label=prompt('Name der neuen Kategorie:',''); if(label==null||!label.trim()) return; const key=natSlug(label); const color=UK_PALETTE[NATCFG.order.length%UK_PALETTE.length]; NATCFG.items[key]={key,label:label.trim(),color,icon:'🏷️',builtin:false,beschaffbar:false}; NATCFG.order.push(key); saveNatCfg(); applyNatConfig(); sheetPending={kind:'natur',value:key}; askScope(); }
function renderSheetUk(){ computeUkList(); let h=`<div class="sheet-grip"></div><div class="sheet-title">Unterkategorie wählen</div><div class="sheet-pick">`;
  h+=`<button class="sheet-pick-btn" onclick="sheetSetUk('')">— ohne —</button>`;
  UK_LIST.forEach(u=>{ h+=`<button class="sheet-pick-btn" onclick="sheetSetUk('${esc(u)}')">${ukIconOf(u)} ${esc(u)}</button>`; });
  h+=`<button class="sheet-pick-btn" onclick="sheetNewUk()">＋ Neue Unterkategorie…</button></div><button class="sheet-close" onclick="renderSheetMain()">Zurück</button>`;
  $('sheet').innerHTML=h; }
function sheetSetUk(val){ sheetPending={kind:'uk',value:val}; askScope(); }
function sheetNewUk(){ const nm=prompt('Name der neuen Unterkategorie:',''); if(nm==null||!nm.trim()) return; sheetPending={kind:'uk',value:nm.trim()}; askScope(); }
function renderSheetColor(){ let h=`<div class="sheet-grip"></div><div class="sheet-title">Farbe wählen</div><div class="sheet-colorrow">`;
  UK_PALETTE.forEach(c=>{ h+=`<span class="sheet-sw" style="background:${c}" onclick="sheetSetColor('${c}')"></span>`; });
  h+=`<input type="color" class="sheet-colorinp" value="#e8b34a" onchange="sheetSetColor(this.value)"></div>`;
  h+=`<button class="sheet-pick-btn" onclick="sheetSetColor(null)">Farbe entfernen</button><button class="sheet-close" onclick="renderSheetMain()">Zurück</button>`;
  $('sheet').innerHTML=h; }
function sheetSetColor(val){ sheetPending={kind:'color',value:val}; askScope(); }
function sheetRename(){ const e=sheetEntry,cid=sheetCid; const dn=qeGet(e,cid,'name'); const cur=(dn!==undefined?dn:e.anzeige_text); const nn=prompt('Neuer Anzeigename:',cur); if(nn==null||!nn.trim()) return; sheetPending={kind:'name',value:nn.trim()}; askScope(); }
function sheetToggle(prop){ const e=sheetEntry,cid=sheetCid; const cur=qeGet(e,cid,prop)===true; sheetPending={kind:prop,value:!cur}; askScope(); }
function askScope(){ const e=sheetEntry; if(!e.material_key){ applyPending('cid'); return; }
  let h=`<div class="sheet-grip"></div><div class="sheet-title">Wo soll es gelten?</div><div class="sheet-pick">`;
  h+=`<button class="sheet-pick-btn" onclick="applyPending('cid')">📍 Nur hier <span class="ps-sub">· an dieser Stelle</span></button>`;
  h+=`<button class="sheet-pick-btn" onclick="applyPending('mat')">🌐 Überall <span class="ps-sub">· jedes Vorkommen dieses Materials</span></button>`;
  h+=`</div><button class="sheet-close" onclick="renderSheetMain()">Abbrechen</button>`;
  $('sheet').innerHTML=h; }
function applyPending(scope){ const e=sheetEntry,cid=sheetCid,p=sheetPending; if(!e||!p){ showSheet(false); return; }
  if(p.kind==='natur'){ if(scope==='mat'&&e.material_key){ (QE.mat[e.material_key]=QE.mat[e.material_key]||{}).natur=p.value; if(overrides[cid]){ delete overrides[cid]; saveJSON('hkl_overrides',overrides); } } else { overrides[cid]=p.value; saveJSON('hkl_overrides',overrides); } saveQE(); buildMaterialIndex(); }
  else if(p.kind==='uk'){ const val=(p.value===''?'':p.value); if(scope==='mat'&&e.material_key){ (QE.mat[e.material_key]=QE.mat[e.material_key]||{}).uk=val; if(cid in reassign){ delete reassign[cid]; saveJSON('hkl_reassign',reassign); } } else { reassign[cid]=(val===''?null:val); saveJSON('hkl_reassign',reassign); } saveQE(); computeUkList(); }
  else { qeSet(scope,e,cid,p.kind,p.value); if(p.kind==='name'||p.kind==='color'||p.kind==='hidden'){ buildMaterialIndex(); } }
  sheetPending=null; showSheet(false); toast('Übernommen'); reRenderDetail(); }
function sheetEditMenge(){ const e=sheetEntry,cid=sheetCid; const mv=qeGet(e,cid,'mengeVal'); const cur=(mv!==undefined?mv:e.menge)||''; const nn=prompt('Neue Menge (z. B. 2x — leer lassen = keine Menge):',cur); if(nn==null) return; const val=nn.trim()===''?null:nn.trim(); sheetPending={kind:'mengeVal',value:val}; askScope(); }
function guessSizeTyp(t){ const s=t.toLowerCase(); if(/f(r|rench)?$/.test(s)&&/\d/.test(s)) return 'french'; if(/cm$/.test(s)) return 'laenge'; if(/mm$/.test(s)) return 'durchmesser'; if(/(ml|l)$/.test(s)&&/\d/.test(s)) return 'volumen'; if(/\dx\d/.test(s)) return 'dimension'; if(/er$/.test(s)) return 'naht'; return 'typcode'; }
function parseSizesInput(text){ return (text||'').split(/[,;]+/).map(t=>t.trim()).filter(Boolean).map(t=>({typ:guessSizeTyp(t),wert:t,roh:t})); }
function sheetEditSizes(){ const e=sheetEntry,cid=sheetCid; const gv=qeGet(e,cid,'groessen'); const cur=((gv!==undefined?gv:e.groessen)||[]).map(g=>g.wert).join(', ');
  const nn=prompt('Größen, durch Komma getrennt (z. B. 6F, 260cm — leer = keine):',cur); if(nn==null) return;
  sheetPending={kind:'groessen',value:parseSizesInput(nn)}; askScope(); }
function sheetEditSpez(){ const e=sheetEntry,cid=sheetCid; const sv=qeGet(e,cid,'spez');
  const cur=(sv!==undefined)?(sv||''):((Array.isArray(e.spezifikation)?e.spezifikation.join(' | '):e.spezifikation)||'');
  const nn=prompt('Spezifikation (Klammerzusatz/Standort — leer = keine):',cur); if(nn==null) return;
  sheetPending={kind:'spez',value:(nn.trim()===''?null:nn.trim())}; askScope(); }
function sheetDelete(){
  if(sheetCid&&sheetCid.indexOf('new|')===0){ if(!confirm('Diesen selbst angelegten Eintrag endgültig löschen?')) return;
    const id=sheetCid.slice(4); const i=NEW.findIndex(x=>x.id===id); if(i>=0){ NEW.splice(i,1); saveNEW(); }
    if(QE.cid[sheetCid]) delete QE.cid[sheetCid]; if(overrides[sheetCid]){ delete overrides[sheetCid]; saveJSON('hkl_overrides',overrides); }
    saveQE(); showSheet(false); toast('Gelöscht'); reRenderDetail(); return; }
  if(!confirm('Diesen Eintrag ausblenden? Er verschwindet aus der Anzeige und der Materialpflege, bleibt aber über „Verwaltung → Ausgeblendete Einträge" wiederherstellbar. Die Quelldatei wird nicht verändert.')) return; sheetPending={kind:'hidden',value:true}; askScope(); }
function sheetResetEntry(){ const cid=sheetCid; if(QE.cid[cid]) delete QE.cid[cid]; if(overrides[cid]){ delete overrides[cid]; saveJSON('hkl_overrides',overrides); } if(cid in reassign){ delete reassign[cid]; saveJSON('hkl_reassign',reassign); } saveQE(); buildMaterialIndex(); showSheet(false); toast('Zurückgesetzt'); reRenderDetail(); }
function reRenderDetail(){ const top=nav[nav.length-1]; if(top&&top.lvl==='rub'){ openRubrik(top.idx,true); } }
$('sheetOv').addEventListener('click',()=>showSheet(false));

/* Long-Press per Ereignisdelegation: kurz=abhaken, halten=Menü, bewegen=blättern */
(function attachLongPress(){ const el=$('scr-detail'); let timer=null,sx=0,sy=0,fired=false,curCid=null,active=false,lastTouch=0;
  function cidFromTarget(t){ const row=(t&&t.closest)?t.closest('.entry-row'):null; if(!row) return null; const entry=row.closest('.entry'); if(!entry||!entry.id) return null; return entry.id.replace(/^e-/,''); }
  function down(x,y,t){ if(t&&t.closest&&(t.closest('.entry-edit-btn')||t.closest('.entry-why-btn'))) return; const cid=cidFromTarget(t); if(!cid) return; curCid=cid; sx=x; sy=y; fired=false; active=true; clearTimeout(timer); timer=setTimeout(()=>{ fired=true; try{ if(navigator.vibrate) navigator.vibrate(15); }catch(e){} if(ADMIN){ refreshAuth(); openSheet(curCid); } else { openProposeForm(curCid); } },500); }
  function move(x,y){ if(!active) return; if(Math.abs(x-sx)>10||Math.abs(y-sy)>10){ clearTimeout(timer); active=false; } }
  function up(){ if(!active) return; clearTimeout(timer); active=false; if(fired){ fired=false; return; } if(curCid) toggleCheck(curCid); }
  el.addEventListener('touchstart',e=>{ lastTouch=Date.now(); const t=e.touches[0]; down(t.clientX,t.clientY,e.target); },{passive:true});
  el.addEventListener('touchmove',e=>{ const t=e.touches[0]; move(t.clientX,t.clientY); },{passive:true});
  el.addEventListener('touchend',()=>{ lastTouch=Date.now(); up(); });
  el.addEventListener('touchcancel',()=>{ clearTimeout(timer); active=false; });
  el.addEventListener('mousedown',e=>{ if(Date.now()-lastTouch<700) return; down(e.clientX,e.clientY,e.target); });
  el.addEventListener('mousemove',e=>{ if(Date.now()-lastTouch<700) return; move(e.clientX,e.clientY); });
  el.addEventListener('mouseup',()=>{ if(Date.now()-lastTouch<700) return; up(); });
  el.addEventListener('mouseleave',()=>{ clearTimeout(timer); active=false; });
  /* Sichtbarer ✎-Button: öffnet direkt das Bearbeiten-Formular (kein Abhaken). */
  el.addEventListener('click',e=>{ const b=(e.target&&e.target.closest)?e.target.closest('.entry-edit-btn'):null; if(!b) return; e.preventDefault(); e.stopPropagation(); const entry=b.closest('.entry'); if(!entry||!entry.id) return; const cid=entry.id.replace(/^e-/,''); if(ADMIN){ refreshAuth(); editEntry(cid); } else { promptLoginThen(()=>editEntry(cid)); } });
  /* 💡-Button: klappt das „Warum"-Detail auf/zu (für alle, kein Abhaken). */
  el.addEventListener('click',e=>{ const b=(e.target&&e.target.closest)?e.target.closest('.entry-why-btn'):null; if(!b) return; e.preventDefault(); e.stopPropagation(); const entry=b.closest('.entry'); if(!entry) return; const open=entry.classList.toggle('show-why'); b.setAttribute('aria-expanded',open?'true':'false'); });
})();

