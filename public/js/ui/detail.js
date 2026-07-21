/* ============ Ebene 3: Detail ============ */
function sizeBadges(g){ if(!settings.groessen||!g||!g.length) return ''; return g.map(x=>`<span class="size-badge"><span class="st">${esc(sizeLabel(x.typ))}</span>${esc(x.wert)}</span>`).join(''); }
function specTags(spez){ if(!settings.spez||!spez) return ''; const arr=Array.isArray(spez)?spez:[spez]; return arr.map(s=>{ const loc=/^Standort:/i.test(s); return `<span class="tag ${loc?'tag-loc':'tag-spec'}">${loc?'📍 '+esc(s.replace(/^Standort:\s*/i,'')):esc(s)}</span>`; }).join(''); }

/* Eintrag-Karte. NEU: Farbe und Symbol kommen aus der Kategorien-Konfiguration (natOf). */
function entryCardHTML(e,cid,isMatGer){
  const nat=effNatur(e,cid); const info=natOf(nat); const done=checks[cid]?'done':'';
  const showThumb=!!info.beschaffbar;
  const care=showThumb?careMem[e.material_key]:null;
  /* Destillation: ist das Material einem Produkt-Stammsatz zugeordnet, gewinnt
     dessen Foto/Identität (canonOf). Der Eintragstext bleibt unverändert. */
  const canon=(showThumb&&e.material_key&&typeof canonOf==='function')?canonOf(e.material_key):null;
  const thumbSrc=(canon&&canon.photo)||(care&&care.photo)||'';
  const thumb=thumbSrc?`<div class="e-thumb"><img src="${esc(thumbSrc)}" alt=""></div>`:(showThumb?`<div class="e-thumb">📷</div>`:'');
  const dn=qeGet(e,cid,'name'); const name=(dn!==undefined?dn:e.anzeige_text);
  const mv=qeGet(e,cid,'mengeVal'); const mengeEff=(mv!==undefined?mv:e.menge);
  const hasEdit=!!( (QE.cid[cid]&&Object.keys(QE.cid[cid]).length) || overrides[cid] || (cid in reassign) || (e.material_key&&QE.mat[e.material_key]&&Object.keys(QE.mat[e.material_key]).length) || (typeof hasStelleRule==='function'&&hasStelleRule(cid)) );
  const editBtn=ADMIN?`<button type="button" class="entry-edit-btn${hasEdit?' edited':''}" title="${hasEdit?'Bearbeiten (angepasst)':'Bearbeiten'}" aria-label="Eintrag bearbeiten">✎</button>`:'';
  /* Sichtbarer Aktions-Einstieg für ALLE (UX-Audit K1): Admin → Schnellmenü,
     sonst → „Änderung vorschlagen". Der Long-Press bleibt als Abkürzung. */
  const menuBtn=`<button type="button" class="entry-menu-btn" title="${ADMIN?'Aktionen':'Änderung vorschlagen'}" aria-label="${ADMIN?'Aktionen zu diesem Eintrag':'Änderung zu diesem Eintrag vorschlagen'}">⋯</button>`;
  const important=qeGet(e,cid,'important')===true; const accent=qeGet(e,cid,'color'); const mHi=mengeHiEff(e,cid,mengeEff);
  /* Menge/Größen/Spezifikation sind über das Bearbeiten-Formular und das Schnellmenü überschreibbar. */
  const gv=qeGet(e,cid,'groessen'); const groessenEff=(gv!==undefined?gv:e.groessen);
  const sv=qeGet(e,cid,'spez'); const spezEff=(sv!==undefined)?(sv?sv:null):e.spezifikation;
  /* Ist das Material einem Produkt zugeordnet (canon), liefert DIESES die Maße
     und Eigenschaften — EINE Quelle, keine Doppelung mit den Eintragswerten.
     Der Standard-Hinweis (Spezifikation) bleibt am Eintrag. */
  let meta='';
  if(canon){ meta+=sizeBadges((typeof matSizeList==='function')?matSizeList(canon):(canon.groessen||[])); }
  else { meta+=sizeBadges(groessenEff); }
  meta+=specTags(spezEff);
  if(ADMIN&&e.__new) meta+=`<span class="tag" style="color:var(--accent);background:rgba(61,155,224,.13)">neu</span>`;
  const locEff=(canon&&canon.lagerort)||(care&&care.loc)||'';
  if(settings.lagerort&&showThumb) meta+= locEff?`<span class="tag tag-loc">📍 ${esc(locEff)}</span>`:`<span class="tag tag-loc missing">📍 kein Lagerort</span>`;
  /* Verknüpfter Stammsatz als antippbarer Badge (öffnet die Produktkarte). */
  if(canon){ const cn=canon.name||canon.ref||canon.gtin; meta+=`<button type="button" class="tag tag-canon entry-canon-btn" data-g="${esc(canon.gtin)}" style="color:var(--accent);background:rgba(61,155,224,.13);border:0;cursor:pointer">🔗 ${esc(cn)}</button>`; }
  if(e.zusatz_markierung&&e.zusatz_markierung.fundstelle) meta+=`<span class="tag tag-zusatz">${esc(e.zusatz_markierung.fundstelle)}</span>`;
  /* Eigenschaften: ist das Material zugeordnet (canon), kommen sie vom Produkt
     (EINE Quelle). Sonst die Eintrags-Merkmale (e.zusatz / Overlay). */
  if(canon){ (typeof MATPROPS!=='undefined'?MATPROPS:[]).forEach(p=>{ const v=canon.props&&canon.props[p.key]; if(v) meta+=`<span class="tag tag-zusatz">${esc(p.label)}: ${esc(v)}</span>`; }); }
  else { const zvv=qeGet(e,cid,'zusatz'); const zus=(zvv!==undefined&&zvv!==null)?zvv:e.zusatz;
    if(Array.isArray(zus)) zus.forEach(f=>{ if(f&&f.n) meta+=`<span class="tag tag-zusatz">${esc(f.n)}${f.w?': '+esc(f.w):''}</span>`; }); }
  const uncertain=(e.natur_konfidenz==='mittel'||e.natur_konfidenz==='niedrig');
  const conf=(settings.konfidenz&&uncertain&&!isHandled(cid))?`<span class="conf" title="Automatik unsicher (${esc(e.natur_konfidenz)}) – in Verwaltung prüfbar">⚠</span>`:'';
  const mbox = settings.menge ? (mengeEff?`<div class="mbox${mHi?' hi':''}">${esc(mengeEff)}</div>`:`<div class="mbox empty"></div>`) : '';
  const ico = isMatGer?`<div class="e-ico">${info.icon||'•'}</div>`:'';
  const cls = (isMatGer?'':'step')+(important?' important':'');
  /* Farbe: Kategoriefarbe als Vollrahmen; frei gewählte Farbe (accent bzw. für
     eigene Einträge e.color) füllt den ganzen Eintrag – Textfarbe automatisch
     nach Kontrast (pickTextColor). */
  const fill=(accent!==undefined)?accent:e.color; const catCol=isMatGer?`var(--n-${esc(nat)})`:`var(--n-hinweis)`;
  let style, filledCls='';
  if(fill){ const t=pickTextColor(fill); style=`--e-col:${esc(fill)};--e-fill:${esc(fill)};--e-fill-text:${t};--e-fill-bd:${t}`; filledCls=' filled'; }
  else { style=`--e-col:${catCol}`; }
  const star = important?`<span class="imp-star">⭐</span>`:'';
  const addedTag = e._added?`<span class="added-tag">neu</span>`:'';
  /* „Warum"-Wissensfeld: aufklappbares 💡-Detail (für alle sichtbar, im Admin
     über das Bearbeiten-Formular pflegbar). */
  const whyQe=qeGet(e,cid,'why'); const why=(((whyQe!==undefined&&whyQe!==null)?whyQe:(e.why||''))||'').toString();
  const whyBtn=why?`<button type="button" class="entry-why-btn" aria-label="Warum – Hintergrund anzeigen" aria-expanded="false" title="Warum?">💡</button>`:'';
  const whyPanel=why?`<div class="e-why"><span class="ew-lbl">Warum</span>${esc(why).replace(/\n/g,'<br>')}</div>`:'';
  return `<div class="entry ${cls}${filledCls} ${done}" id="e-${esc(cid)}" style="${style}"><div class="entry-row"><div class="chk">✓</div>${mbox}${ico}${showThumb?thumb:''}<div class="e-main"><div class="e-top"><div class="e-text">${star}${esc(name)}${addedTag}</div>${conf}${whyBtn}${editBtn}${menuBtn}</div>${meta?`<div class="e-meta">${meta}</div>`:''}</div></div>${whyPanel}</div>`;
}

function openRubrik(idx,silent){ const r=curStd.rubriken[idx]; if(!silent){ nav.push({lvl:'rub',idx}); try{ history.pushState({d:2,id:curStd.id,idx},''); }catch(e){} }
  const isMatGer=(r.typ==='material'||r.typ==='geraete'); let html='';
  if(isMatGer){
    let lg=''; natList().forEach(n=>{ lg+=`<div class="lg-row"><span class="lg-swatch" style="background:${n.color}"></span>${esc(n.label)}</div>`; });
    html+=`<details class="legend"><summary>◐ Farb-Legende</summary><div class="legend-body">
      <div class="lg-row"><span class="lg-mbox">2×</span>Menge (Stückzahl, links)</div>${lg}
      <div class="lg-row"><span class="lg-size">6F</span>Größe (French, Länge, Ø, Volumen …)</div>
      <div class="lg-row"><span style="color:var(--warn)">⚠</span>Automatik unsicher – in Verwaltung prüfbar</div></div></details>`;
  }
  if(isMatGer){
    const groupsMap=new Map(); let appear=0;
    (r.sub_bereiche||[]).forEach((sb,si)=>{ (sb.eintraege||[]).forEach((e,ei)=>{
      if(e.natur==='ueberschrift') return; if(settings.fliesstext===false && e.ist_fliesstext) return;
      const cid=cidOf(curStd.id,idx,si,ei); if(qeGet(e,cid,'hidden')===true) return; const uk=canonUk(e,cid); const gkey=uk||'\u0000null';
      if(!groupsMap.has(gkey)){ groupsMap.set(gkey,{uk:uk,first:appear++,entries:[]}); }
      groupsMap.get(gkey).entries.push({e,cid});
    }); });
    /* Selbst angelegte Einträge dieses Standards/dieser Rubrik einbinden */
    newEntriesFor(r,idx).forEach(n=>{
      const cid='new|'+n.id; const e=newToEntry(n); if(qeGet(e,cid,'hidden')===true) return;
      const uk=canonUk(e,cid); const gkey=uk||'\u0000null';
      if(!groupsMap.has(gkey)){ groupsMap.set(gkey,{uk:uk,first:appear++,entries:[]}); }
      groupsMap.get(gkey).entries.push({e,cid});
    });
    /* Selbst angelegte Abschnitte („Reiter") auch dann zeigen, wenn noch kein
       Eintrag sie trägt — als leere, befüllbare Sektion. */
    declaredUksFor(idx).forEach(uk=>{ if(!uk) return; if(!groupsMap.has(uk)) groupsMap.set(uk,{uk:uk,first:appear++,entries:[]}); });
    let groups=[...groupsMap.values()];
    groups.forEach(g=>{ g.entries=sortByOrder(g.entries, orderKeyFor(idx,(g.uk||''))); });
    groups.sort((a,b)=>{ const oa=(a.uk&&ukMetaOf(a.uk).order!=null)?ukMetaOf(a.uk).order:a.first; const ob=(b.uk&&ukMetaOf(b.uk).order!=null)?ukMetaOf(b.uk).order:b.first; return oa-ob; });
    const named=groups.filter(g=>g.uk); const nullG=groups.find(g=>!g.uk);
    if(nullG && named.length===0){ nullG.entries.forEach(x=>{ html+=entryCardHTML(x.e,x.cid,true); }); }
    else {
      if(nullG){ nullG.entries.forEach(x=>{ html+=entryCardHTML(x.e,x.cid,true); }); }
      const declared=declaredUksFor(idx);
      named.forEach((g)=>{
        /* Leere Abschnitte nur im Verwaltungsmodus zeigen (Gerüst zum Befüllen);
           Endnutzer sehen leere Reiter nicht. */
        if(!g.entries.length && !ADMIN) return;
        const gidx=UK_LIST.indexOf(g.uk); const col=ukColorOf(g.uk,gidx>=0?gidx:g.first); const ico=ukIconOf(g.uk);
        const ckey=idx+':'+g.uk; const isEmpty=!g.entries.length; const isCol=isEmpty?false:(collapsed[ckey]!==false); /* Untergruppen sind standardmäßig zugeklappt; leere offen */
        const isDecl=declared.indexOf(g.uk)>=0;
        /* ckey/UK-Name sind Freitext → per data-Attribut übergeben,
           nicht als Inline-String-Literal (esc() escaped kein Apostroph). */
        html+=`<div class="uksec ${isCol?'collapsed':''}" style="--uk:${col}"><div class="uksec-head" data-k="${esc(ckey)}" onclick="toggleUk(this.dataset.k)"><span class="uksec-ico">${ico}</span><span class="uksec-name">${esc(g.uk)}</span><span class="uksec-count">${g.entries.length}</span><span class="uksec-arrow">▾</span></div><div class="uksec-body">`;
        g.entries.forEach(x=>{ html+=entryCardHTML(x.e,x.cid,true); });
        if(ADMIN){ html+=`<button class="add-entry-btn uksec-add" data-ri="${idx}" data-uk="${esc(g.uk)}" onclick="event.stopPropagation();startAddEntryUk(+this.dataset.ri,this.dataset.uk)">＋ Eintrag in „${esc(g.uk)}"</button>`;
          if(isDecl&&isEmpty) html+=`<button class="add-entry-btn uksec-del" data-ri="${idx}" data-uk="${esc(g.uk)}" onclick="event.stopPropagation();removeUkSectionUI(+this.dataset.ri,this.dataset.uk)">Abschnitt entfernen</button>`; }
        html+=`</div></div>`;
      });
    }
  } else {
    const {blocks}=ablaufSegments(idx);
    blocks.forEach(b=>{ if(b.head){
        /* Eigene Überschriften bekommen ein ⋯ (umbenennen/löschen). */
        const tools=(ADMIN&&b.headAid)?`<button type="button" class="icon-btn" style="width:30px;height:30px;font-size:15px;margin-left:8px;vertical-align:middle" data-ri="${idx}" data-aid="${esc(b.headAid)}" onclick="openSegHeadSheet(+this.dataset.ri,this.dataset.aid)" aria-label="Abschnitt bearbeiten">⋯</button>`:'';
        html+=`<div class="sub-head">${esc(b.head)}${tools}</div>`; }
      b.items.forEach(x=>{ html+=entryCardHTML(x.e,x.cid,false); });
      /* „＋ Eintrag in <Abschnitt>" für JEDEN benannten Abschnitt — auch die
         aus der Quelldatei (Souveränität: überall hinzufügen können). */
      if(ADMIN&&b.head) html+=`<button class="add-entry-btn uksec-add" data-ri="${idx}" data-seg="${esc(b.head)}" onclick="startAddEntrySeg(+this.dataset.ri,this.dataset.seg)">＋ Eintrag in „${esc(b.head)}"</button>`;
    });
  }
  const body=html||`<div class="empty"><div class="ei">📄</div><h3>Keine Einträge</h3><p>Diese Rubrik enthält keine Positionen.</p></div>`;
  const adoptBtn=isMatGer?`<button class="add-entry-btn" onclick="startAdoptCatalog()">⬇ Aus Katalog übernehmen</button>`:'';
  /* Eigene Abschnitte in JEDER Rubrik anlegbar (Souveränität): bei Material/
     Geräte als Unterkategorie-Sektion (UKSEC), in Ablauf-Rubriken als eigene
     Überschrift — nur im Verwaltungsmodus. */
  const sectionBtn=ADMIN?(isMatGer
    ?`<button class="add-entry-btn" onclick="addUkSectionUI(${idx})">＋ Abschnitt (Reiter)</button>`
    :`<button class="add-entry-btn" onclick="addSegSectionUI(${idx})">＋ Abschnitt (Überschrift)</button>`):'';
  const chkN=rubrikCids(idx).filter(c=>checks[c]).length;
  const resetBar=chkN?`<div class="chk-reset"><span class="cr-count">${chkN} abgehakt</span><button type="button" class="cr-btn" onclick="clearRubrikChecks(${idx})">↺ Alle zurücksetzen</button></div>`:'';
  $('scr-detail').innerHTML=hintsBlockHTML('rub',curStd.id+'|'+idx)+resetBar+body+`<button class="add-entry-btn" onclick="startAddEntry()">＋ Eintrag hinzufügen</button>`+sectionBtn+adoptBtn;
  show('scr-detail'); setBar(r.name,curStd.titel+' · '+curStd.gruppe,true);
}
/* Sammelt alle abhakbaren cids einer Rubrik (Basis- + eigene Einträge). */
function rubrikCids(idx){ const r=curStd.rubriken[idx]; if(!r) return []; const out=[];
  (r.sub_bereiche||[]).forEach((sb,si)=>{ (sb.eintraege||[]).forEach((e,ei)=>{ if(e.natur==='ueberschrift') return; out.push(cidOf(curStd.id,idx,si,ei)); }); });
  newEntriesFor(r,idx).forEach(n=>out.push('new|'+n.id));
  return out; }
/* Entfernt auf einmal alle gesetzten Häkchen dieser Rubrik (nur lokal – Checks
   sind gerätespezifisch, hkl_checks). */
function clearRubrikChecks(idx){ const cids=rubrikCids(idx); const set=cids.filter(c=>checks[c]);
  if(!set.length){ toast('Keine Häkchen gesetzt'); return; }
  if(!confirm('Alle '+set.length+' Häkchen dieser Rubrik zurücksetzen?')) return;
  set.forEach(c=>{ delete checks[c]; }); saveChecks(); reRenderDetail(); toast(set.length+' Häkchen zurückgesetzt'); }
/* Startet das Hinzufügen eines Eintrags in der aktuell offenen Rubrik.
   Liest Standard/Rubrik aus dem Navigationszustand (keine Nutzertexte im onclick). */
function startAddEntry(){ const top=nav[nav.length-1]; if(!top||top.lvl!=='rub'||!curStd) return;
  const r=curStd.rubriken[top.idx]; const defaultNat=r.typ==='geraete'?'geraet':(r.typ==='material'?'material':'hinweis');
  openEntryForm({kind:'add',sid:curStd.id,ri:top.idx,defaultNat}); }
/* Eintrag direkt in einen bestimmten Abschnitt (Unterkategorie) anlegen –
   das UK-Feld ist vorbelegt. */
function startAddEntryUk(idx,uk){ if(!ADMIN||!curStd) return; const r=curStd.rubriken[idx]; if(!r) return;
  const defaultNat=r.typ==='geraete'?'geraet':(r.typ==='material'?'material':'hinweis');
  openEntryForm({kind:'add',sid:curStd.id,ri:idx,defaultNat,defaultUk:uk}); }
/* Eingabe-Sheet für einen neuen Abschnitt („Reiter") – bewusst KEIN prompt(),
   das in installierten PWAs (standalone) lautlos null liefert (M1). */
function addUkSectionUI(idx){ if(!ADMIN||!curStd) return;
  const h=`<div class="sheet-grip"></div><div class="sheet-title">Neuer Abschnitt (Reiter)</div>
    <input type="text" id="skNewSec" class="txtinp" style="width:100%" placeholder="Name, z. B. Material aus dem Vorbereitungsraum">
    <div class="sheet-pick" style="margin-top:12px"><button class="sheet-pick-btn" data-ri="${idx}" onclick="addUkSectionSave(+this.dataset.ri)">Anlegen</button></div>
    <button class="sheet-close" onclick="showSheet(false)">Abbrechen</button>`;
  $('sheet').innerHTML=h; showSheet(true);
  const inp=$('skNewSec'); if(inp){ setTimeout(()=>inp.focus(),50); inp.onkeydown=(ev)=>{ if(ev.key==='Enter'){ ev.preventDefault(); addUkSectionSave(idx); } }; }
}
function addUkSectionSave(idx){ const inp=$('skNewSec'); const nm=(inp&&inp.value||'').trim(); if(!nm) return;
  if(!addUkSectionName(idx,nm)){ toast('Abschnitt nicht anlegbar',true); return; }
  showSheet(false); reRenderDetail(); toast('Abschnitt angelegt'); }
function removeUkSectionUI(idx,uk){ if(!ADMIN) return;
  if(!confirm('Leeren Abschnitt „'+uk+'" entfernen?')) return;
  removeUkSectionName(idx,uk); reRenderDetail(); toast('Abschnitt entfernt'); }

/* ── Abschnitte in ABLAUF-Rubriken: eigene Überschriften (Konzept
   „Abschnitte überall"). Eine eigene Überschrift ist ein added Eintrag mit
   natur 'ueberschrift'; ablaufSegments macht daraus einen Abschnitt. */
function startAddEntrySeg(idx,seg){ if(!ADMIN||!curStd) return;
  openEntryForm({kind:'add',sid:curStd.id,ri:idx,defaultNat:'hinweis',defaultSeg:seg}); }
function addSegSectionUI(idx){ if(!ADMIN||!curStd) return;
  const h=`<div class="sheet-grip"></div><div class="sheet-title">Neuer Abschnitt (Überschrift)</div>
    <input type="text" id="skNewSeg" class="txtinp" style="width:100%" placeholder="Name, z. B. Nachbereitung">
    <div class="sheet-pick" style="margin-top:12px"><button class="sheet-pick-btn" data-ri="${idx}" onclick="addSegSectionSave(+this.dataset.ri)">Anlegen</button></div>
    <button class="sheet-close" onclick="showSheet(false)">Abbrechen</button>`;
  $('sheet').innerHTML=h; showSheet(true);
  const inp=$('skNewSeg'); if(inp){ setTimeout(()=>inp.focus(),50); inp.onkeydown=(ev)=>{ if(ev.key==='Enter'){ ev.preventDefault(); addSegSectionSave(idx); } }; }
}
function addSegSectionSave(idx){ const inp=$('skNewSeg'); const nm=(inp&&inp.value||'').trim(); if(!nm) return;
  const key=curStd.id+'|'+idx; const arr=ADDITIONS.entries[key]||(ADDITIONS.entries[key]=[]);
  arr.push(makeAddEntry({name:nm,nat:'ueberschrift',aid:newAid()}));
  saveAdditions(); rebuildDB(); showSheet(false); reRenderDetail(); toast('Abschnitt angelegt'); }
function openSegHeadSheet(idx,aid){ if(!ADMIN||!curStd) return; const e=findAddEntry(curStd.id,idx,aid); if(!e) return;
  const h=`<div class="sheet-grip"></div><div class="sheet-title">Abschnitt „${esc(e.anzeige_text)}"</div>
    <input type="text" id="segRenInp" class="txtinp" style="width:100%" value="${esc(e.anzeige_text)}">
    <div class="sheet-pick" style="margin-top:12px">
      <button class="sheet-pick-btn" data-ri="${idx}" data-aid="${esc(aid)}" onclick="segHeadRename(+this.dataset.ri,this.dataset.aid)">Umbenennen</button>
      <button class="sheet-pick-btn" data-ri="${idx}" data-aid="${esc(aid)}" onclick="segHeadDelete(+this.dataset.ri,this.dataset.aid)">🗑 Abschnitt löschen</button>
    </div><button class="sheet-close" onclick="showSheet(false)">Abbrechen</button>`;
  $('sheet').innerHTML=h; showSheet(true); }
function segHeadRename(idx,aid){ const e=findAddEntry(curStd.id,idx,aid); const inp=$('segRenInp'); const nm=(inp&&inp.value||'').trim(); if(!e||!nm) return;
  const old=e.anzeige_text; e.anzeige_text=nm; e.roh_text=nm;
  /* Zuordnungen der Abschnitts-Einträge mit umziehen. */
  (ADDITIONS.entries[curStd.id+'|'+idx]||[]).forEach(x=>{ if(x.seg===old) x.seg=nm; });
  saveAdditions(); rebuildDB(); showSheet(false); reRenderDetail(); toast('Abschnitt umbenannt'); }
function segHeadDelete(idx,aid){ const e=findAddEntry(curStd.id,idx,aid); if(!e) return;
  if(!confirm('Abschnitt „'+e.anzeige_text+'" löschen? Die Einträge darin bleiben erhalten und rücken ans Ende der Rubrik.')) return;
  const key=curStd.id+'|'+idx; ADDITIONS.entries[key]=(ADDITIONS.entries[key]||[]).filter(x=>x._aid!==aid);
  if(!ADDITIONS.entries[key].length) delete ADDITIONS.entries[key];
  saveAdditions(); rebuildDB(); showSheet(false); reRenderDetail(); toast('Abschnitt gelöscht'); }
/* Übernahme aus dem Katalog: Auswahl-Sheet öffnen, ausgewählten Eintrag als
   neuen (eigenen) Eintrag in die aktuell offene Rubrik einfügen. */
function startAdoptCatalog(){ const top=nav[nav.length-1]; if(!top||top.lvl!=='rub'||!curStd) return;
  if(!CATALOG.items.length){ toast('Katalog ist leer – erst im Katalog anlegen',true); return; }
  renderCatalogPickSheet(); showSheet(true); }
function renderCatalogPickSheet(){ const items=CATALOG.items.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||'','de'));
  let h=`<div class="sheet-grip"></div><div class="sheet-title">Aus Katalog übernehmen</div><div class="sheet-pick">`;
  items.forEach(it=>{ const info=natOf(it.nat); const g=(it.sizeVal?[{typ:it.sizeTyp||'dimension',wert:it.sizeVal,roh:it.sizeVal}]:[]); const sizes=g.length?' '+sizeBadges(g):'';
    h+=`<button class="sheet-pick-btn" onclick="adoptCatalogItem('${esc(it.id)}')"><span style="width:14px;height:14px;border-radius:4px;background:${info.color};display:inline-block"></span>${esc(it.name)}<span class="ps-sub">${esc(info.label)}${it.menge?' · '+esc(it.menge):''}${sizes}</span></button>`; });
  h+=`</div><button class="sheet-close" onclick="showSheet(false)">Abbrechen</button>`;
  $('sheet').innerHTML=h; }
function adoptCatalogItem(id){ const it=findCatalogItem(id); const top=nav[nav.length-1];
  if(!it||!top||top.lvl!=='rub'||!curStd){ showSheet(false); return; }
  const key=curStd.id+'|'+top.idx; const arr=ADDITIONS.entries[key]||(ADDITIONS.entries[key]=[]);
  arr.push(makeAddEntry(Object.assign(catalogToForm(it),{aid:newAid()})));
  saveAdditions(); rebuildDB(); buildMaterialIndex(); showSheet(false); toast('Aus Katalog übernommen'); reRenderDetail(); }
function toggleUk(ckey){ collapsed[ckey]=(collapsed[ckey]===false)?true:false; const top=nav[nav.length-1]; if(top&&top.lvl==='rub'){ openRubrik(top.idx,true); } }
function toggleCheck(cid){ checks[cid]=!checks[cid]; if(!checks[cid]) delete checks[cid]; saveChecks(); const el=$('e-'+cid); if(el) el.classList.toggle('done',!!checks[cid]);
  /* Einmaliger Hinweis (pro Gerät) auf den täglichen Reset — sonst wundert man
     sich am nächsten Morgen, wohin die Häkchen sind (UX-Audit K4c). */
  if(checks[cid] && !store.get('hkl_hint_daily')){ store.set('hkl_hint_daily','1'); toast('Häkchen gelten für heute – morgen starten sie automatisch leer.'); } }

function goBack(){ if(formCtx){ closeForm(); return; }
  if(mode==='care'){ if($('scr-care-item').classList.contains('active')){ renderCare(); show('scr-care'); updateBar(); } return; }
  if(nav.length>0){ try{ history.back(); }catch(e){ } return; }
  setMode('use'); }
function gotoState(st){ const d=(st&&st.d)||0;
  formCtx=null; mode='use'; $('mUse').classList.add('on'); if($('mCatalog'))$('mCatalog').classList.remove('on'); $('mCare').classList.remove('on'); $('mAdmin').classList.remove('on');
  let s=null; if(d>=1&&st&&st.id) s=DB.standards.find(x=>x.id===st.id);
  if(d<=0||(d>=1&&!s)){ nav=[]; $('searchWrap').style.display='block'; renderStandards(); show('scr-standards'); updateBar(); return; }
  curStd=s;
  if(d===1){ nav=[{lvl:'std',id:st.id}]; $('searchWrap').style.display='none'; openStandard(st.id,false,true); }
  else { nav=[{lvl:'std',id:st.id},{lvl:'rub',idx:st.idx}]; $('searchWrap').style.display='none'; openRubrik(st.idx,true); } }

