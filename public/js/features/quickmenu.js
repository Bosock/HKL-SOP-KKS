/* ============ Schnellmenü (Long-Press) ============ */
let sheetCid=null, sheetEntry=null, sheetPending=null;
function showSheet(on){ $('sheet').classList.toggle('show',on); $('sheetOv').classList.toggle('show',on); if(!on){ sheetCid=null; sheetEntry=null; sheetPending=null; } }
function openSheet(cid){ const e=findEntry(cid); if(!e) return; sheetCid=cid; sheetEntry=e; sheetPending=null; renderSheetMain(); showSheet(true); }
function sAct(ico,label,sub,fn,cls){ return `<button class="sheet-act ${cls||''}" onclick="${fn}"><span class="sa-ico">${ico}</span><span>${esc(label)}<span class="sa-sub">${esc(sub)}</span></span></button>`; }
/* Abschnitts-Überschrift im Bearbeiten-Menü (Gruppierung nach Absicht statt
   flacher Liste — QM-Konzept §3: Inhalt · Darstellung · Organisation ·
   Gefahrenzone). */
function sGroup(title,sub){ return `<div class="sheet-group"><span class="sg-t">${esc(title)}</span>${sub?`<span class="sg-s">${esc(sub)}</span>`:''}</div>`; }
/* Wirkungs-Chips (QM-Konzept §1/A): zeigen WO die Änderungen wirken und WER sie
   sieht — einmal gelernt, überall wiedererkannt. Nur feste, sichere Literale. */
function sChips(arr){ return `<div class="sheet-chips">`+arr.map(c=>`<span class="schip">${c}</span>`).join('')+`</div>`; }
/* Das Bearbeiten-Menü zeigt nur, was für DIESES Element sinnvoll ist, gegliedert
   in vier feste Fächer. Material-/Gerätespezifisches (Größen, Spezifikation,
   Unterkategorie, Katalog) erscheint nur bei beschaffbaren Einträgen. */
function renderSheetMain(){ const e=sheetEntry, cid=sheetCid; if(!e) return;
  const dn=qeGet(e,cid,'name'); const name=(dn!==undefined?dn:e.anzeige_text);
  const imp=qeGet(e,cid,'important')===true; const cur=natOf(effNatur(e,cid));
  const isMat=!!cur.beschaffbar;
  const mengeEffRaw=(qeGet(e,cid,'mengeVal')!==undefined?qeGet(e,cid,'mengeVal'):e.menge);
  const mHi=mengeHiEff(e,cid,mengeEffRaw);
  const menge=mengeEffRaw||'keine Menge';
  const groessen=(function(){const g=qeGet(e,cid,'groessen')!==undefined?qeGet(e,cid,'groessen'):e.groessen; return (g&&g.length)?g.map(x=>x.wert).join(', '):'keine';})();
  const spez=(function(){const s=qeGet(e,cid,'spez'); const v=(s!==undefined)?s:(Array.isArray(e.spezifikation)?e.spezifikation.join(' | '):e.spezifikation); return v||'keine';})();
  let h=`<div class="sheet-grip"></div><div class="sheet-title">Bearbeiten · ${esc(cur.label)}${e._added?' · eigener Eintrag':''}</div><div class="sheet-name">${esc(name)}</div>`;
  h+=sChips(['📍 dieser Eintrag', '👥 alle Geräte']);
  /* Inspektor (Kaskade sichtbar machen): warum sieht dieser Eintrag so aus? */
  h+=sAct('🔍','Warum so?','zeigt, woher Name, Kategorie, Farbe & Co. kommen','openWhySheet()');

  /* ── Inhalt ── */
  h+=sGroup('Inhalt','Was der Eintrag ist');
  h+=sAct('✏️','Details bearbeiten','Name, Menge, Größe, Kategorie, Warum …','sheetEditDetails()');
  h+=sAct('🔤','Schnell umbenennen','nur den Anzeigenamen','sheetRename()');
  h+=sAct('#️⃣','Menge ändern',menge,'sheetEditMenge()');
  if(isMat){
    h+=sAct('📏','Größen bearbeiten',groessen,'sheetEditSizes()');
    h+=sAct('🧷','Spezifikation bearbeiten',spez,'sheetEditSpez()');
  }

  /* ── Darstellung (Hervorheben gebündelt) ── */
  h+=sGroup('Darstellung','Wie er auffällt');
  h+=sAct('⭐',imp?'Wichtig-Markierung entfernen':'Als wichtig markieren',imp?'aktuell markiert':'hervorheben',"sheetToggle('important')");
  h+=sAct('🔢',mHi?'Zahl normal anzeigen':'Zahl/Menge hervorheben',(qeGet(e,cid,'mengeHi')!==undefined?'manuell übersteuert · ':'automatisch bei ≠1x · ')+(mengeEffRaw?'Menge '+mengeEffRaw:'keine Menge'),"sheetToggle('mengeHi')");
  h+=sAct('🎨','Farblich absetzen','eigene Akzentfarbe',"sheetGo('color')");

  /* ── Organisation ── */
  h+=sGroup('Organisation','Wohin er gehört');
  h+=sAct('🏷️','Kategorie ändern',cur.label,"sheetGo('cat')");
  if(isMat){ h+=sAct('🗂️','Unterkategorie ändern','Gruppe zuweisen',"sheetGo('uk')"); }
  h+=sAct('⬆','Nach oben','Reihenfolge in der Gruppe','moveEntry(-1)');
  h+=sAct('⬇','Nach unten','Reihenfolge in der Gruppe','moveEntry(1)');
  if(isMat){ h+=sAct('📥','In Katalog aufnehmen','für andere Standards verfügbar','sheetAddToCatalog()'); }

  /* ── Gefahrenzone ── */
  h+=sGroup('Gefahrenzone','Entfernen & zurücksetzen');
  if(e._added){ h+=sAct('🗑️','Endgültig löschen','eigenen Eintrag entfernen','sheetDeleteAdded()','danger'); }
  else { h+=sAct('🗑️','Ausblenden / Löschen','aus der Anzeige entfernen','sheetDelete()','danger'); }
  h+=sAct('↺','Änderungen zurücksetzen','für diesen Eintrag','sheetResetEntry()');

  h+=`<button class="sheet-close" onclick="showSheet(false)">Schließen</button>`;
  $('sheet').innerHTML=h;
}

/* ── Gegliedertes Menü für einen STANDARD (Titelzeile bearbeiten) ──
   Gleiches Muster wie das Eintrags-Menü (§3): fasst die früher verstreuten
   Admin-Buttons in einem kontextsensitiven Sheet zusammen. */
function openStdSheet(id){ if(!ADMIN) return; if(id){ const t=DB.standards.find(x=>x.id===id); if(t) curStd=t; } if(!curStd) return; const s=curStd; const hid=stdHidden(s);
  let h=`<div class="sheet-grip"></div><div class="sheet-title">Standard bearbeiten${s.__new?' · App-eigen':''}</div><div class="sheet-name">${esc(stdTitel(s))}</div>`;
  h+=sChips(['📄 dieser Standard', '👥 alle Geräte']);
  h+=sGroup('Inhalt','Titel, Gruppe & Freigabe');
  h+=sAct('✏️','Titel & Gruppe','Name und Zuordnung','showSheet(false);editStandard()');
  h+=sAct('🏷️','Version & Freigabe','Status und Gültigkeit','showSheet(false);openStdMetaForm()');
  h+=sGroup('Gefahrenzone','Ausblenden & löschen');
  h+=sAct(hid?'↩️':'🗑️',hid?'Wieder einblenden':'Ausblenden',hid?'für alle wieder sichtbar':'aus der Nutzung nehmen (wiederherstellbar)','showSheet(false);toggleStdHidden()',hid?'':'danger');
  if(s.__new){ h+=sAct('🗑️','Endgültig löschen','App-eigenen Standard samt Einträgen entfernen','showSheet(false);deleteNewStandard()','danger'); }
  h+=`<button class="sheet-close" onclick="showSheet(false)">Schließen</button>`;
  $('sheet').innerHTML=h; showSheet(true);
}

/* ── Gegliedertes Menü für eine RUBRIK (Kopf bearbeiten) ── */
function openRubSheet(idx){ if(!ADMIN||!curStd) return; const r=curStd.rubriken[idx]; if(!r) return; const hid=rubHidden(r,idx); const isTpl=!!r.__tplid;
  let h=`<div class="sheet-grip"></div><div class="sheet-title">Rubrik bearbeiten${isTpl?' · Vorlage':(r.__nrid?' · eigene':'')}</div><div class="sheet-name">${esc(rubName(r,idx))}</div>`;
  h+=sChips(['🗂 diese Rubrik', '👥 alle Geräte']);
  h+=sGroup('Inhalt','Name & Symbol');
  h+=sAct('✏️','Umbenennen','nur diese Rubrik in diesem Standard','showSheet(false);renameRubrik('+idx+')');
  h+=sAct('🔣','Symbol ändern','gilt für ALLE Rubriken dieses Namens','showSheet(false);editRubIconFor('+idx+')');
  h+=sGroup('Organisation','Reihenfolge & Geltung');
  h+=sAct('⬆','Nach oben','Reihenfolge im Standard','showSheet(false);moveRubrik('+idx+',-1)');
  h+=sAct('⬇','Nach unten','Reihenfolge im Standard','showSheet(false);moveRubrik('+idx+',1)');
  if(isTpl){ h+=sAct('🌐','Geltungsbereich','in welchen Standards die Rubrik erscheint','showSheet(false);openRubrikForm(\''+esc(r.__tplid)+'\')'); }
  h+=sGroup('Gefahrenzone','Häkchen & Ausblenden');
  h+=sAct('♻️','Häkchen zurücksetzen','die Tages-Häkchen dieser Rubrik','showSheet(false);clearRubrikChecks('+idx+')');
  h+=sAct(hid?'↩️':'🗑️',hid?'Wieder einblenden':(r.__nrid?'Endgültig löschen':'Ausblenden'),hid?'':(r.__nrid?'eigene Rubrik samt Einträgen':'aus der Anzeige nehmen (wiederherstellbar)'),'showSheet(false);toggleRubHidden('+idx+')',hid?'':'danger');
  h+=`<button class="sheet-close" onclick="showSheet(false)">Schließen</button>`;
  $('sheet').innerHTML=h; showSheet(true);
}
/* Symbol (Emoji) genau DIESER Rubrik ändern (RUBICON ist nach Rubrik-Name
   indiziert – anders als editRubIcon, das den Verwaltungs-Index nutzt). */
function editRubIconFor(idx){ if(!ADMIN||!curStd) return; const r=curStd.rubriken[idx]; if(!r) return; const name=rubName(r,idx);
  const cur=RUBICON[name]||''; const v=prompt('Symbol (Emoji) für Rubriken namens „'+name+'":',cur); if(v==null) return;
  if(v.trim()==='') delete RUBICON[name]; else RUBICON[name]=v.trim(); saveRUBICON(); openStandard(curStd.id,true); toast('Symbol geändert'); }

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
  /* Per INDEX in UK_LIST (−1 = ohne): UK-Namen sind Freitext und gehören
     nicht in onclick-String-Literale (esc() escaped kein Apostroph). */
  h+=`<button class="sheet-pick-btn" onclick="sheetSetUk(-1)">— ohne —</button>`;
  UK_LIST.forEach((u,i)=>{ h+=`<button class="sheet-pick-btn" onclick="sheetSetUk(${i})">${ukIconOf(u)} ${esc(u)}</button>`; });
  h+=`<button class="sheet-pick-btn" onclick="sheetNewUk()">＋ Neue Unterkategorie…</button></div><button class="sheet-close" onclick="renderSheetMain()">Zurück</button>`;
  $('sheet').innerHTML=h; }
function sheetSetUk(i){ const val=(i<0)?'':(UK_LIST[i]!=null?UK_LIST[i]:''); sheetPending={kind:'uk',value:val}; askScope(); }
function sheetNewUk(){ const nm=prompt('Name der neuen Unterkategorie:',''); if(nm==null||!nm.trim()) return; sheetPending={kind:'uk',value:nm.trim()}; askScope(); }
function renderSheetColor(){ let h=`<div class="sheet-grip"></div><div class="sheet-title">Farbe wählen</div><div class="sheet-colorrow">`;
  UK_PALETTE.forEach(c=>{ h+=`<span class="sheet-sw" style="background:${c}" onclick="sheetSetColor('${c}')"></span>`; });
  h+=`<input type="color" class="sheet-colorinp" value="#e8b34a" onchange="sheetSetColor(this.value)"></div>`;
  h+=`<button class="sheet-pick-btn" onclick="sheetSetColor(null)">Farbe entfernen</button><button class="sheet-close" onclick="renderSheetMain()">Zurück</button>`;
  $('sheet').innerHTML=h; }
function sheetSetColor(val){ sheetPending={kind:'color',value:val}; askScope(); }
function sheetRename(){ const e=sheetEntry,cid=sheetCid; const dn=qeGet(e,cid,'name'); const cur=(dn!==undefined?dn:e.anzeige_text); const nn=prompt('Neuer Anzeigename:',cur); if(nn==null||!nn.trim()) return; sheetPending={kind:'name',value:nn.trim()}; askScope(); }
function sheetToggle(prop){ const e=sheetEntry,cid=sheetCid;
  /* mengeHi hat einen automatischen Grundzustand (≠1x); der Umschalter muss
     IMMER den gerade angezeigten (effektiven) Zustand umkehren — sonst
     bleibt „Zahl normal anzeigen" bei automatisch hervorgehobenen Einträgen
     wirkungslos (M10, Übersteuerung). */
  const cur=(prop==='mengeHi')?mengeHiEff(e,cid,(qeGet(e,cid,'mengeVal')!==undefined?qeGet(e,cid,'mengeVal'):e.menge)):qeGet(e,cid,prop)===true;
  sheetPending={kind:prop,value:!cur}; askScope(); }
/* Reichweiten-Wahl (Verwaltungspolitik-Kaskade): vier ehrliche Stufen mit
   TREFFERVORSCHAU direkt an jeder Option — Sammel-Änderung ist kein eigenes
   Werkzeug, sondern zwei weitere Knöpfe im vertrauten Dialog. */
function askScope(){ const e=sheetEntry, cid=sheetCid; if(!e.material_key){ applyPending('cid'); return; }
  const sid=cidStd(cid); const grp=sid?stdGruppeById(sid):null;
  const hs=sid?ruleHits(e.material_key,{art:'standard',wert:sid}):null;
  const hg=grp?ruleHits(e.material_key,{art:'gruppe',wert:grp}):null;
  const ha=ruleHits(e.material_key,{art:'alle'});
  let h=`<div class="sheet-grip"></div><div class="sheet-title">Wo soll es gelten?</div>`;
  h+=`<div class="sheet-chips"><span class="schip">👥 gilt auf allen Geräten</span></div><div class="sheet-pick">`;
  h+=`<button class="sheet-pick-btn" onclick="applyPending('cid')">📍 Nur hier <span class="ps-sub">· nur an dieser Stelle</span></button>`;
  if(sid&&hs) h+=`<button class="sheet-pick-btn" onclick="applyPending('std')">📄 In diesem Standard <span class="ps-sub">· betrifft ${hs.vorkommen}× hier</span></button>`;
  if(grp&&hg) h+=`<button class="sheet-pick-btn" onclick="applyPending('grp')">🗂 In der Gruppe „${esc(grp)}" <span class="ps-sub">· betrifft ${hg.vorkommen}× in ${hg.standards.length} Standards</span></button>`;
  h+=`<button class="sheet-pick-btn" onclick="applyPending('mat')">🌐 Überall <span class="ps-sub">· betrifft ${ha.vorkommen}× in ${ha.standards.length} Standards</span></button>`;
  h+=`</div><button class="sheet-close" onclick="renderSheetMain()">Abbrechen</button>`;
  $('sheet').innerHTML=h; }
/* EIN Schreibweg (Verwaltungspolitik Stufe 2/3): jede Reichweite eines
   MATERIAL-Eintrags wird zur Regel im Journal (📍 Stelle · 📄 Standard ·
   🗂 Gruppe · 🌐 alle) — rückverfolgbar, rücknehmbar, im Inspektor sichtbar.
   Der abgelöste Alt-Wert wird migriert (clearLegacyAt). Weite Reichweiten
   (Gruppe/alle) werden mit Trefferzahl bestätigt (Governance-Treppe).
   Einträge OHNE material_key haben kein Regel-Ziel → Alt-Pfad („nur hier"). */
function applyPending(scope){ const e=sheetEntry,cid=sheetCid,p=sheetPending; if(!e||!p){ showSheet(false); return; }
  const mk=e.material_key;
  if(mk){
    const sid=cidStd(cid); const grp=sid?stdGruppeById(sid):null;
    let wo=null;
    if(scope==='cid') wo={art:'stelle',wert:cid};
    else if(scope==='std'){ if(!sid){ toast('Standard nicht bestimmbar',true); return; } wo={art:'standard',wert:sid}; }
    else if(scope==='grp'){ if(!grp){ toast('Gruppe nicht bestimmbar',true); return; } wo={art:'gruppe',wert:grp}; }
    else wo={art:'alle'};
    if(scope==='grp'||scope==='mat'){ const hits=ruleHits(mk,wo);
      const ziel=(scope==='grp')?('die Gruppe „'+grp+'"'):'ALLE Standards';
      if(!confirm('Sammel-Änderung für '+ziel+' anwenden?\n\nBetrifft '+hits.vorkommen+' Vorkommen in '+hits.standards.length+' Standard(s).\nRückgängig jederzeit: Verwaltung → 🧾 Regeln & Journal.')) return; }
    addRule({art:'material',key:mk}, wo, p.kind, p.value);
    if(wo.art==='stelle') clearLegacyAt(e,cid,'stelle',p.kind);
    else if(wo.art==='alle') clearLegacyAt(e,cid,'alle',p.kind);
    buildMaterialIndex(); if(p.kind==='uk') computeUkList();
    sheetPending=null; showSheet(false);
    toast((scope==='cid')?'Übernommen':'Sammel-Änderung übernommen — rücknehmbar unter 🧾 Regeln & Journal'); reRenderDetail(); return;
  }
  /* Kein material_key → Alt-Pfad (nur „hier" möglich) */
  if(p.kind==='natur'){ overrides[cid]=p.value; saveJSON('hkl_overrides',overrides); buildMaterialIndex(); }
  else if(p.kind==='uk'){ reassign[cid]=(p.value===''?null:p.value); saveJSON('hkl_reassign',reassign); computeUkList(); }
  else { qeSet('cid',e,cid,p.kind,p.value); if(p.kind==='name'||p.kind==='color'||p.kind==='hidden'){ buildMaterialIndex(); } }
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
/* Setzt NUR die Änderungen an dieser Stelle zurück: 📍-Regeln (revoke) + die
   Alt-Speicher an diesem cid. Standard-/Gruppen-/Überall-Regeln bleiben — die
   sind bewusste Sammel-Entscheidungen und werden im 🧾 Journal zurückgenommen. */
function sheetResetEntry(){ const cid=sheetCid, e=sheetEntry;
  if(QE.cid[cid]) delete QE.cid[cid]; if(overrides[cid]!==undefined){ delete overrides[cid]; saveJSON('hkl_overrides',overrides); } if(cid in reassign){ delete reassign[cid]; saveJSON('hkl_reassign',reassign); }
  if(e&&e.material_key&&typeof rulesActive==='function'){ rulesActive(RULES).forEach(r=>{ if(r.ziel&&r.ziel.key===e.material_key&&r.wo&&r.wo.art==='stelle'&&r.wo.wert===cid) revokeRule(r.id); }); }
  saveQE(); buildMaterialIndex(); computeUkList(); showSheet(false); toast('Zurückgesetzt'); reRenderDetail(); }
function reRenderDetail(){ const top=nav[nav.length-1]; if(top&&top.lvl==='rub'){ openRubrik(top.idx,true); } }
$('sheetOv').addEventListener('click',()=>showSheet(false));

/* Long-Press per Ereignisdelegation: kurz=abhaken, halten=Menü, bewegen=blättern */
(function attachLongPress(){ const el=$('scr-detail'); let timer=null,sx=0,sy=0,fired=false,curCid=null,active=false,lastTouch=0;
  function cidFromTarget(t){ const row=(t&&t.closest)?t.closest('.entry-row'):null; if(!row) return null; const entry=row.closest('.entry'); if(!entry||!entry.id) return null; return entry.id.replace(/^e-/,''); }
  function down(x,y,t){ if(t&&t.closest&&(t.closest('.entry-edit-btn')||t.closest('.entry-why-btn')||t.closest('.entry-menu-btn'))) return; const cid=cidFromTarget(t); if(!cid) return; curCid=cid; sx=x; sy=y; fired=false; active=true; clearTimeout(timer); timer=setTimeout(()=>{ fired=true; try{ if(navigator.vibrate) navigator.vibrate(15); }catch(e){} if(ADMIN){ refreshAuth(); openSheet(curCid); } else { openProposeForm(curCid); } },500); }
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
  /* ⋯-Button (für alle sichtbar): Admin → Schnellmenü, sonst → Vorschlag.
     Ersetzt die Unsichtbarkeit des Long-Press als einzigem Einstieg (UX K1). */
  el.addEventListener('click',e=>{ const b=(e.target&&e.target.closest)?e.target.closest('.entry-menu-btn'):null; if(!b) return; e.preventDefault(); e.stopPropagation(); const entry=b.closest('.entry'); if(!entry||!entry.id) return; const cid=entry.id.replace(/^e-/,''); if(ADMIN){ refreshAuth(); openSheet(cid); } else { openProposeForm(cid); } });
  /* 💡-Button: klappt das „Warum"-Detail auf/zu (für alle, kein Abhaken). */
  el.addEventListener('click',e=>{ const b=(e.target&&e.target.closest)?e.target.closest('.entry-why-btn'):null; if(!b) return; e.preventDefault(); e.stopPropagation(); const entry=b.closest('.entry'); if(!entry) return; const open=entry.classList.toggle('show-why'); b.setAttribute('aria-expanded',open?'true':'false'); });
})();

/* Generischer Halte-Detektor für Listen mit eigener Navigation: kurzes Tippen
   = öffnen, langes Halten (≈500 ms) = Bearbeiten-Menü. Damit ist das gegliederte
   Menü auf JEDER Ebene per Long-Press erreichbar — Standard-Übersicht, Rubriken-
   Liste und (separat) Einträge. Delegation am persistenten Container. */
function attachHoldNav(el, opts){ if(!el) return; let timer=null,sx=0,sy=0,fired=false,cur=null,active=false,lastTouch=0;
  function row(t){ if(!t||!t.closest) return null; if(opts.ignoreSel && t.closest(opts.ignoreSel)) return null; return t.closest(opts.rowSel); }
  function down(x,y,t){ const rw=row(t); if(!rw) return; cur=rw; sx=x; sy=y; fired=false; active=true; clearTimeout(timer);
    timer=setTimeout(()=>{ fired=true; try{ if(navigator.vibrate) navigator.vibrate(15); }catch(e){} if(opts.onHold) opts.onHold(cur); },500); }
  function move(x,y){ if(!active) return; if(Math.abs(x-sx)>10||Math.abs(y-sy)>10){ clearTimeout(timer); active=false; } }
  function up(){ if(!active) return; clearTimeout(timer); active=false; if(fired){ fired=false; return; } if(cur&&opts.onTap) opts.onTap(cur); }
  el.addEventListener('touchstart',e=>{ lastTouch=Date.now(); const t=e.touches[0]; down(t.clientX,t.clientY,e.target); },{passive:true});
  el.addEventListener('touchmove',e=>{ const t=e.touches[0]; move(t.clientX,t.clientY); },{passive:true});
  el.addEventListener('touchend',()=>{ lastTouch=Date.now(); up(); });
  el.addEventListener('touchcancel',()=>{ clearTimeout(timer); active=false; });
  el.addEventListener('mousedown',e=>{ if(Date.now()-lastTouch<700) return; down(e.clientX,e.clientY,e.target); });
  el.addEventListener('mousemove',e=>{ if(Date.now()-lastTouch<700) return; move(e.clientX,e.clientY); });
  el.addEventListener('mouseup',()=>{ if(Date.now()-lastTouch<700) return; up(); });
  el.addEventListener('mouseleave',()=>{ clearTimeout(timer); active=false; });
}
(function attachListHolds(){
  attachHoldNav($('scr-standards'), { rowSel:'.std',
    onTap:rw=>{ const id=rw.dataset.sid; if(id) openStandard(id); },
    onHold:rw=>{ const id=rw.dataset.sid; if(id&&ADMIN){ refreshAuth(); openStdSheet(id); } } });
  attachHoldNav($('scr-rubriken'), { rowSel:'.rub', ignoreSel:'.rub-menu-btn',
    onTap:rw=>{ const i=rw.dataset.ri; if(i!=null) openRubrik(+i); },
    onHold:rw=>{ const i=rw.dataset.ri; if(i!=null&&ADMIN){ refreshAuth(); openRubSheet(+i); } } });
})();

