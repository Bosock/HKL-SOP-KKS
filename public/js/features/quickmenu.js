/* ============ Schnellmenü (Long-Press) ============ */
let sheetCid=null, sheetEntry=null, sheetPending=null;
/* Reichweiten-Nachfrage beim Speichern des Bearbeiten-Formulars (mehrere
   geänderte Eigenschaften auf einmal), siehe forms.js. */
let editScopePending=null;
function showSheet(on){ $('sheet').classList.toggle('show',on); $('sheetOv').classList.toggle('show',on); if(!on){ sheetCid=null; sheetEntry=null; sheetPending=null; editScopePending=null; } }
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
  if(isMat&&e.material_key){ const cn=(typeof canonOf==='function')?canonOf(e.material_key):null;
    h+=sAct('🔗', cn?('Verknüpft: '+(cn.name||cn.ref||cn.gtin)):'Mit Produkt verknüpfen', cn?'Stammsatz zeigen / lösen':'Etikett-Produkt zuordnen (destillieren)','renderSheetLink()'); }
  h+=sAct('🧩','Eigene Felder','Zusatz-Infos als Badges am Eintrag',"sheetGo('zusatz')");
  h+=sAct('📦','Verschieben','in andere Rubrik oder anderen Standard','renderSheetMove()');
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
function sheetGo(state){ if(state==='cat') renderSheetCat(); else if(state==='uk') renderSheetUk(); else if(state==='color') renderSheetColor(); else if(state==='zusatz') renderSheetZusatz(); }

/* ── Verschieben (Souveränität): Eintrag in andere Rubrik/anderen Standard ──
   Eigene Einträge (additions/NEW) werden ECHT umgehängt; Basis-Einträge aus
   der Quelldatei können nicht wandern → Kopie als eigener Eintrag am Ziel +
   Original ausblenden (beides rücknehmbar: Ausgeblendete Einträge/Journal). */
function renderSheetMove(sid){ const e=sheetEntry; if(!e) return;
  let h=`<div class="sheet-grip"></div><div class="sheet-title">📦 Verschieben — ${sid?'Rubrik wählen':'Standard wählen'}</div><div class="sheet-pick">`;
  if(!sid){
    DB.standards.forEach(s=>{ if(stdHidden(s)) return;
      h+=`<button class="sheet-pick-btn" data-sid="${esc(s.id)}" onclick="renderSheetMove(this.dataset.sid)">${esc(stdTitel(s))} <span class="ps-sub">· ${esc(stdGruppe(s))}</span></button>`; });
  } else {
    const s=DB.standards.find(x=>x.id===sid);
    (s?s.rubriken:[]).forEach((r,ri)=>{
      const cnt=(r.sub_bereiche||[]).reduce((n,sb)=>n+((sb.eintraege||[]).filter(x=>x.natur!=='ueberschrift').length),0);
      h+=`<button class="sheet-pick-btn" data-sid="${esc(sid)}" data-ri="${ri}" onclick="moveEntryTo(this.dataset.sid,+this.dataset.ri)">${esc(r.name)} <span class="ps-sub">· ${cnt} Einträge</span></button>`; });
  }
  h+=`</div><button class="sheet-close" onclick="${sid?'renderSheetMove()':'renderSheetMain()'}">Zurück</button>`;
  $('sheet').innerHTML=h; }

/* ── Material-Destillation: Vorkommen im Standard einem Produkt-Stammsatz
   zuordnen (siehe docs/KONZEPT-MATERIALSTAMM.md). Nicht-destruktiv & lösbar. */
function _matProdList(){ return (typeof GTINDB==='object'&&GTINDB)?Object.keys(GTINDB).map(k=>GTINDB[k]):[]; }
function matLinkListHTML(prods,q){ const list=(typeof filterGtin==='function')?filterGtin(prods,q):prods;
  if(!list.length) return `<div class="why-help">Noch keine Produkte in der Datenbank — unten neu anlegen.</div>`;
  return list.slice(0,40).map(r=>`<button class="sheet-pick-btn" data-g="${esc(r.gtin)}" onclick="matLinkPick(this.dataset.g)">${r.photo?'🖼 ':'🏷️ '}${esc(r.name||r.ref||r.gtin)}<span class="ps-sub">${esc([r.hersteller,(r.ref?('REF '+r.ref):'')].filter(Boolean).join(' · ')||'—')}</span></button>`).join(''); }
function renderSheetLink(){ const e=sheetEntry; if(!e||!e.material_key){ showSheet(false); return; }
  const mk=e.material_key; const curIdv=(typeof canonId==='function')?canonId(mk):null; const cur=(typeof canonOf==='function')?canonOf(mk):null;
  let h=`<div class="sheet-grip"></div><div class="sheet-title">🔗 Mit Produkt verknüpfen</div>`;
  h+=`<p class="why-help">Ordne dieses Material seinem echten Produkt-Stammsatz zu (Name, Foto, Maße, Eigenschaften). Der Eintrag im Standard bleibt — er bekommt die destillierte Identität. Jederzeit lösbar.</p>`;
  h+=`<button class="scan-cta" style="margin:2px 0 10px" onclick="matManage()">🧬 Material verwalten — scannen, Foto, Maße, Eigenschaften</button>`;
  if(cur){ h+=`<div class="why-row"><span class="why-src">Aktuell</span><span class="why-val">${esc(cur.name||cur.ref||cur.gtin)}</span></div>
    <div class="sheet-pick"><button class="sheet-pick-btn" data-g="${esc(curIdv)}" onclick="matLinkShow(this.dataset.g)">Produkt anzeigen</button><button class="sheet-pick-btn" onclick="matLinkClear()">Verknüpfung lösen</button></div>`; }
  h+=`<div class="sheet-title" style="font-size:14px;margin-top:6px">Produkt wählen</div>
    <input type="text" id="matLinkQ" class="txtinp" style="width:100%" placeholder="Produkt suchen (Name, REF, Hersteller …)" oninput="matLinkFilter(this.value)">
    <div class="sheet-pick" id="matLinkList" style="margin-top:8px">${matLinkListHTML(_matProdList(),'')}</div>
    <button class="sheet-pick-btn" onclick="matLinkNew()">＋ Neuer Stammsatz aus diesem Material</button>
    <button class="sheet-close" onclick="renderSheetMain()">Zurück</button>`;
  $('sheet').innerHTML=h; }
/* Öffnet aus dem Standard heraus den EINEN zentralen Material-Editor
   (materialhub.js) für dieses Vorkommen — legt bei Bedarf den Stammsatz an. */
function matManage(){ const e=sheetEntry; if(!e||!e.material_key){ showSheet(false); return; } const mk=e.material_key; showSheet(false); if(typeof openMaterial==='function') openMaterial(mk); }
function matLinkFilter(q){ const box=$('matLinkList'); if(box) box.innerHTML=matLinkListHTML(_matProdList(),q); }
function matLinkPick(id){ const e=sheetEntry; if(!e||!e.material_key||!id) return; matLinkTo(e.material_key,id); showSheet(false); if(typeof buildMaterialIndex==='function') buildMaterialIndex(); toast('Verknüpft — destilliert'); reRenderDetail(); }
function matLinkClear(){ const e=sheetEntry; if(!e||!e.material_key) return; matUnlink(e.material_key); showSheet(false); toast('Verknüpfung gelöst'); reRenderDetail(); }
function matLinkShow(id){ showSheet(false); if(typeof openScanItem==='function') openScanItem(id,false); }
function matLinkNew(){ const e=sheetEntry; if(!e||!e.material_key){ showSheet(false); return; }
  const nm=(qeGet(e,sheetCid,'name')!==undefined?qeGet(e,sheetCid,'name'):e.anzeige_text)||'';
  const id=matCreateStamm(nm); if(!id){ showSheet(false); return; }
  matLinkTo(e.material_key,id); showSheet(false);
  if(typeof openScanItem==='function') openScanItem(id,true);   /* direkt zum Ausfüllen öffnen */ }
function moveEntryTo(targetSid,targetRi){ const e=sheetEntry, cid=sheetCid; if(!e||!cid) return;
  const tgt=DB.standards.find(s=>s.id===targetSid); if(!tgt||!tgt.rubriken[targetRi]){ toast('Ziel nicht gefunden',true); return; }
  if(cid.indexOf('new|')===0){
    const n=NEW.find(x=>('new|'+x.id)===cid);
    if(n){ n.std=targetSid; n.rub=String(rubIdxKey(tgt.rubriken[targetRi],targetRi)); saveNEW(); }
  } else if(e._added&&e._aid){
    const p=cid.split('|'); const oldKey=p[0]+'|'+p[1];
    const arr=ADDITIONS.entries[oldKey]||[]; const i=arr.findIndex(x=>x._aid===e._aid);
    if(i>=0){ const obj=arr.splice(i,1)[0]; if(!arr.length) delete ADDITIONS.entries[oldKey];
      const nk=targetSid+'|'+targetRi; (ADDITIONS.entries[nk]=ADDITIONS.entries[nk]||[]).push(obj); saveAdditions(); }
  } else {
    /* Basis-Eintrag: Kopie mit den EFFEKTIVEN Werten (inkl. deiner Regeln) */
    const name=(qeGet(e,cid,'name')!==undefined?qeGet(e,cid,'name'):e.anzeige_text)||'';
    const clone=makeAddEntry({ aid:newAid(), name,
      menge:(qeGet(e,cid,'mengeVal')!==undefined?qeGet(e,cid,'mengeVal'):e.menge)||'',
      nat:effNatur(e,cid), uk:canonUk(e,cid)||'',
      spez:(function(){const s=qeGet(e,cid,'spez'); if(s!==undefined) return s||''; return (Array.isArray(e.spezifikation)?e.spezifikation.join(' | '):e.spezifikation)||'';})(),
      color:(qeGet(e,cid,'color')||''), why:e.why||'', synonyms:e.synonyms||[] });
    clone.groessen=((qeGet(e,cid,'groessen')!==undefined?qeGet(e,cid,'groessen'):e.groessen)||[]).slice();
    const nk=targetSid+'|'+targetRi; (ADDITIONS.entries[nk]=ADDITIONS.entries[nk]||[]).push(clone); saveAdditions();
    if(e.material_key&&typeof addRule==='function') addRule({art:'material',key:e.material_key},{art:'stelle',wert:cid},'hidden',true);
    else { (QE.cid[cid]=QE.cid[cid]||{}).hidden=true; saveQE(); }
  }
  rebuildDB(); buildMaterialIndex(); computeUkList(); showSheet(false);
  toast('Verschoben nach „'+stdTitel(tgt)+' → '+tgt.rubriken[targetRi].name+'" — rücknehmbar'); reRenderDetail(); }

/* ── Eigene Felder (Souveränität): beliebige Zusatz-Infos am Eintrag ──
   Gespeichert als Regel-Eigenschaft 'zusatz' (Liste {n,w}) → volle
   Reichweiten-Wahl, Journal, „Warum so?" und Geräte-Sync inklusive. */
function renderSheetZusatz(){ const e=sheetEntry, cid=sheetCid; if(!e) return;
  const cur=(qeGet(e,cid,'zusatz')||[]);
  let h=`<div class="sheet-grip"></div><div class="sheet-title">🧩 Eigene Felder</div>
    <p class="why-help">Eigene Zusatz-Infos (z. B. „Schrank: B3" oder „nur bei ICD"), die als Badge am Eintrag erscheinen. Du wählst gleich, wo sie gelten.</p>`;
  cur.forEach((f,i)=>{ h+=`<div class="why-row"><span class="why-src">${esc(f.n)}</span><span class="why-val">${esc(f.w||'')}</span><button class="why-undo" data-i="${i}" onclick="sheetZusatzDel(+this.dataset.i)">✕</button></div>`; });
  h+=`<input type="text" id="zfName" class="txtinp" style="width:100%;margin-top:10px" placeholder="Feldname, z. B. Schrank">
    <input type="text" id="zfWert" class="txtinp" style="width:100%;margin-top:8px" placeholder="Wert, z. B. B3 (optional)">
    <div class="sheet-pick" style="margin-top:12px"><button class="sheet-pick-btn" onclick="sheetZusatzAdd()">＋ Feld hinzufügen</button></div>
    <button class="sheet-close" onclick="renderSheetMain()">Zurück</button>`;
  $('sheet').innerHTML=h; const inp=$('zfName'); if(inp) setTimeout(()=>inp.focus(),50); }
function sheetZusatzAdd(){ const n=($('zfName')&&$('zfName').value||'').trim(); const w=($('zfWert')&&$('zfWert').value||'').trim();
  if(!n) return; const arr=(qeGet(sheetEntry,sheetCid,'zusatz')||[]).slice(); arr.push({n,w});
  sheetPending={kind:'zusatz',value:arr}; askScope(); }
function sheetZusatzDel(i){ const arr=(qeGet(sheetEntry,sheetCid,'zusatz')||[]).slice(); arr.splice(i,1);
  sheetPending={kind:'zusatz',value:arr}; askScope(); }
function renderSheetCat(){ let h=`<div class="sheet-grip"></div><div class="sheet-title">Kategorie wählen</div><div class="sheet-pick">`;
  natList().forEach(n=>{ h+=`<button class="sheet-pick-btn" onclick="sheetSetNatur('${esc(n.key)}')"><span style="width:14px;height:14px;border-radius:4px;background:${n.color};display:inline-block"></span>${esc(n.label)}</button>`; });
  h+=`<button class="sheet-pick-btn" onclick="sheetNewNatur()">＋ Neue Kategorie…</button></div><button class="sheet-close" onclick="renderSheetMain()">Zurück</button>`;
  $('sheet').innerHTML=h; }
function sheetSetNatur(key){ sheetPending={kind:'natur',value:key}; askScope(); }
/* Eingabe-Sheet statt prompt() — gleicher Grund wie sheetNewUk (M1). */
function sheetNewNatur(){
  const h=`<div class="sheet-grip"></div><div class="sheet-title">Neue Kategorie</div>
    <input type="text" id="skNewNat" class="txtinp" style="width:100%" placeholder="Name, z. B. Verbrauchsmaterial">
    <div class="sheet-pick" style="margin-top:12px"><button class="sheet-pick-btn" onclick="sheetNewNaturSave()">Anlegen</button></div>
    <button class="sheet-close" onclick="renderSheetMain()">Abbrechen</button>`;
  $('sheet').innerHTML=h;
  const inp=$('skNewNat'); if(inp){ setTimeout(()=>inp.focus(),50); inp.onkeydown=(ev)=>{ if(ev.key==='Enter'){ ev.preventDefault(); sheetNewNaturSave(); } }; }
}
function sheetNewNaturSave(){ const inp=$('skNewNat'); const label=(inp&&inp.value||'').trim(); if(!label) return;
  const key=natSlug(label); const color=UK_PALETTE[NATCFG.order.length%UK_PALETTE.length];
  NATCFG.items[key]={key,label,color,icon:'🏷️',builtin:false,beschaffbar:false}; NATCFG.order.push(key); saveNatCfg(); applyNatConfig();
  sheetPending={kind:'natur',value:key}; askScope(); }
function renderSheetUk(){ computeUkList(); let h=`<div class="sheet-grip"></div><div class="sheet-title">Unterkategorie wählen</div><div class="sheet-pick">`;
  /* Per INDEX in UK_LIST (−1 = ohne): UK-Namen sind Freitext und gehören
     nicht in onclick-String-Literale (esc() escaped kein Apostroph). */
  h+=`<button class="sheet-pick-btn" onclick="sheetSetUk(-1)">— ohne —</button>`;
  UK_LIST.forEach((u,i)=>{ h+=`<button class="sheet-pick-btn" onclick="sheetSetUk(${i})">${ukIconOf(u)} ${esc(u)}</button>`; });
  h+=`<button class="sheet-pick-btn" onclick="sheetNewUk()">＋ Neue Unterkategorie…</button></div><button class="sheet-close" onclick="renderSheetMain()">Zurück</button>`;
  $('sheet').innerHTML=h; }
function sheetSetUk(i){ const val=(i<0)?'':(UK_LIST[i]!=null?UK_LIST[i]:''); sheetPending={kind:'uk',value:val}; askScope(); }
/* Eingabe-Sheet statt prompt(): in installierten PWA-Fenstern (manifest
   display:"standalone") liefert window.prompt() auf manchen Android-Chrome-
   Versionen KEINEN Dialog, sondern sofort null — „Neue Unterkategorie"
   schlug dadurch lautlos fehl. Eigenes Eingabefeld statt nativem Dialog (M1). */
function sheetNewUk(){
  const h=`<div class="sheet-grip"></div><div class="sheet-title">Neue Unterkategorie</div>
    <input type="text" id="skNewUk" class="txtinp" style="width:100%" placeholder="Name, z. B. Katheter">
    <div class="sheet-pick" style="margin-top:12px"><button class="sheet-pick-btn" onclick="sheetNewUkSave()">Anlegen</button></div>
    <button class="sheet-close" onclick="renderSheetUk()">Abbrechen</button>`;
  $('sheet').innerHTML=h;
  const inp=$('skNewUk'); if(inp){ setTimeout(()=>inp.focus(),50); inp.onkeydown=(ev)=>{ if(ev.key==='Enter'){ ev.preventDefault(); sheetNewUkSave(); } }; }
}
function sheetNewUkSave(){ const inp=$('skNewUk'); const nm=(inp&&inp.value||'').trim(); if(!nm) return; sheetPending={kind:'uk',value:nm}; askScope(); }
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

/* ── Geister-Klick-Schutz (Ursache der Bugs „springt beim Standard-Wählen
   direkt in eine Rubrik" und „Häkchen erscheinen von selbst"): Android feuert
   nach jedem Finger-Tipp zusätzlich Kompatibilitäts-MAUS-Ereignisse an
   derselben Bildschirmposition. Rendert der Tap eine neue Ansicht, treffen
   diese Maus-Ereignisse die NEUE Liste (Standard→Rubrik→Eintrag) und lösten
   dort ein zweites Tippen aus. Der frühere Schutz (lastTouch) war pro
   Container privat und griff deshalb container-übergreifend nicht.
   Zwei Schichten: (1) EIN geteilter Zeitstempel für ALLE Halte-Detektoren —
   nach jedem Touch werden Maus-Ereignisse überall 700 ms ignoriert;
   (2) preventDefault auf dem konsumierten touchend unterdrückt die
   Kompatibilitäts-Ereignisse (inkl. click auf onclick-Elemente) an der
   Quelle. Nicht konsumierte Touches (Scroll, Buttons via ignoreSel) bleiben
   unangetastet, deren native Klicks funktionieren weiter. */
let touchGuardTs=0;
function ghostMouse(){ return Date.now()-touchGuardTs<700; }

/* Long-Press per Ereignisdelegation: kurz=abhaken, halten=Menü, bewegen=blättern */
(function attachLongPress(){ const el=$('scr-detail'); let timer=null,sx=0,sy=0,fired=false,curCid=null,active=false;
  function cidFromTarget(t){ const row=(t&&t.closest)?t.closest('.entry-row'):null; if(!row) return null; const entry=row.closest('.entry'); if(!entry||!entry.id) return null; return entry.id.replace(/^e-/,''); }
  function down(x,y,t){ if(t&&t.closest&&(t.closest('.entry-edit-btn')||t.closest('.entry-why-btn')||t.closest('.entry-menu-btn'))) return; const cid=cidFromTarget(t); if(!cid) return; curCid=cid; sx=x; sy=y; fired=false; active=true; clearTimeout(timer); timer=setTimeout(()=>{ fired=true; try{ if(navigator.vibrate) navigator.vibrate(15); }catch(e){} if(ADMIN){ refreshAuth(); openSheet(curCid); } else { openProposeForm(curCid); } },500); }
  function move(x,y){ if(!active) return; if(Math.abs(x-sx)>10||Math.abs(y-sy)>10){ clearTimeout(timer); active=false; } }
  function up(){ if(!active) return; clearTimeout(timer); active=false; if(fired){ fired=false; return; } if(curCid) toggleCheck(curCid); }
  el.addEventListener('touchstart',e=>{ touchGuardTs=Date.now(); const t=e.touches[0]; down(t.clientX,t.clientY,e.target); },{passive:true});
  el.addEventListener('touchmove',e=>{ const t=e.touches[0]; move(t.clientX,t.clientY); },{passive:true});
  el.addEventListener('touchend',e=>{ touchGuardTs=Date.now(); const consumed=active; up(); if(consumed&&e.cancelable){ try{ e.preventDefault(); }catch(_){} } });
  el.addEventListener('touchcancel',()=>{ clearTimeout(timer); active=false; });
  el.addEventListener('mousedown',e=>{ if(ghostMouse()) return; down(e.clientX,e.clientY,e.target); });
  el.addEventListener('mousemove',e=>{ if(ghostMouse()) return; move(e.clientX,e.clientY); });
  el.addEventListener('mouseup',()=>{ if(ghostMouse()) return; up(); });
  el.addEventListener('mouseleave',()=>{ clearTimeout(timer); active=false; });
  /* Sichtbarer ✎-Button: öffnet direkt das Bearbeiten-Formular (kein Abhaken). */
  el.addEventListener('click',e=>{ const b=(e.target&&e.target.closest)?e.target.closest('.entry-edit-btn'):null; if(!b) return; e.preventDefault(); e.stopPropagation(); const entry=b.closest('.entry'); if(!entry||!entry.id) return; const cid=entry.id.replace(/^e-/,''); if(ADMIN){ refreshAuth(); editEntry(cid); } else { promptLoginThen(()=>editEntry(cid)); } });
  /* ⋯-Button (für alle sichtbar): Admin → Schnellmenü, sonst → Vorschlag.
     Ersetzt die Unsichtbarkeit des Long-Press als einzigem Einstieg (UX K1). */
  el.addEventListener('click',e=>{ const b=(e.target&&e.target.closest)?e.target.closest('.entry-menu-btn'):null; if(!b) return; e.preventDefault(); e.stopPropagation(); const entry=b.closest('.entry'); if(!entry||!entry.id) return; const cid=entry.id.replace(/^e-/,''); if(ADMIN){ refreshAuth(); openSheet(cid); } else { openProposeForm(cid); } });
  /* 💡-Button: klappt das „Warum"-Detail auf/zu (für alle, kein Abhaken). */
  el.addEventListener('click',e=>{ const b=(e.target&&e.target.closest)?e.target.closest('.entry-why-btn'):null; if(!b) return; e.preventDefault(); e.stopPropagation(); const entry=b.closest('.entry'); if(!entry) return; const open=entry.classList.toggle('show-why'); b.setAttribute('aria-expanded',open?'true':'false'); });
  /* 🔗-Badge: öffnet den verknüpften Produkt-Stammsatz (kein Abhaken). */
  el.addEventListener('click',e=>{ const b=(e.target&&e.target.closest)?e.target.closest('.entry-canon-btn'):null; if(!b) return; e.preventDefault(); e.stopPropagation(); const g=b.dataset.g; if(g&&typeof openScanItem==='function') openScanItem(g,false); });
})();

/* Generischer Halte-Detektor für Listen mit eigener Navigation: kurzes Tippen
   = öffnen, langes Halten (≈500 ms) = Bearbeiten-Menü. Damit ist das gegliederte
   Menü auf JEDER Ebene per Long-Press erreichbar — Standard-Übersicht, Rubriken-
   Liste und (separat) Einträge. Delegation am persistenten Container. */
function attachHoldNav(el, opts){ if(!el) return; let timer=null,sx=0,sy=0,fired=false,cur=null,active=false;
  function row(t){ if(!t||!t.closest) return null; if(opts.ignoreSel && t.closest(opts.ignoreSel)) return null; return t.closest(opts.rowSel); }
  function down(x,y,t){ const rw=row(t); if(!rw) return; cur=rw; sx=x; sy=y; fired=false; active=true; clearTimeout(timer);
    timer=setTimeout(()=>{ fired=true; try{ if(navigator.vibrate) navigator.vibrate(15); }catch(e){} if(opts.onHold) opts.onHold(cur); },500); }
  function move(x,y){ if(!active) return; if(Math.abs(x-sx)>10||Math.abs(y-sy)>10){ clearTimeout(timer); active=false; } }
  function up(){ if(!active) return; clearTimeout(timer); active=false; if(fired){ fired=false; return; } if(cur&&opts.onTap) opts.onTap(cur); }
  el.addEventListener('touchstart',e=>{ touchGuardTs=Date.now(); const t=e.touches[0]; down(t.clientX,t.clientY,e.target); },{passive:true});
  el.addEventListener('touchmove',e=>{ const t=e.touches[0]; move(t.clientX,t.clientY); },{passive:true});
  el.addEventListener('touchend',e=>{ touchGuardTs=Date.now(); const consumed=active; up(); if(consumed&&e.cancelable){ try{ e.preventDefault(); }catch(_){} } });
  el.addEventListener('touchcancel',()=>{ clearTimeout(timer); active=false; });
  el.addEventListener('mousedown',e=>{ if(ghostMouse()) return; down(e.clientX,e.clientY,e.target); });
  el.addEventListener('mousemove',e=>{ if(ghostMouse()) return; move(e.clientX,e.clientY); });
  el.addEventListener('mouseup',()=>{ if(ghostMouse()) return; up(); });
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

