/* ============ Ebene 3: Detail ============ */
function sizeBadges(g){ if(!settings.groessen||!g||!g.length) return ''; return g.map(x=>`<span class="size-badge"><span class="st">${esc(sizeLabel(x.typ))}</span>${esc(x.wert)}</span>`).join(''); }
function specTags(spez){ if(!settings.spez||!spez) return ''; const arr=Array.isArray(spez)?spez:[spez]; return arr.map(s=>{ const loc=/^Standort:/i.test(s); return `<span class="tag ${loc?'tag-loc':'tag-spec'}">${loc?'📍 '+esc(s.replace(/^Standort:\s*/i,'')):esc(s)}</span>`; }).join(''); }

/* Eintrag-Karte. NEU: Farbe und Symbol kommen aus der Kategorien-Konfiguration (natOf). */
function entryCardHTML(e,cid,isMatGer){
  const nat=effNatur(e,cid); const info=natOf(nat); const done=checks[cid]?'done':'';
  const showThumb=!!info.beschaffbar;
  const care=showThumb?careMem[e.material_key]:null;
  const thumb=care&&care.photo?`<div class="e-thumb"><img src="${care.photo}" alt=""></div>`:(showThumb?`<div class="e-thumb">📷</div>`:'');
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
  let meta=''; meta+=sizeBadges(groessenEff); meta+=specTags(spezEff);
  if(ADMIN&&e.__new) meta+=`<span class="tag" style="color:var(--accent);background:rgba(61,155,224,.13)">neu</span>`;
  if(settings.lagerort&&showThumb) meta+= care&&care.loc?`<span class="tag tag-loc">📍 ${esc(care.loc)}</span>`:`<span class="tag tag-loc missing">📍 kein Lagerort</span>`;
  if(e.zusatz_markierung&&e.zusatz_markierung.fundstelle) meta+=`<span class="tag tag-zusatz">${esc(e.zusatz_markierung.fundstelle)}</span>`;
  const zus=qeGet(e,cid,'zusatz'); if(Array.isArray(zus)) zus.forEach(f=>{ if(f&&f.n) meta+=`<span class="tag tag-zusatz">${esc(f.n)}${f.w?': '+esc(f.w):''}</span>`; });
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
    let groups=[...groupsMap.values()];
    groups.forEach(g=>{ g.entries=sortByOrder(g.entries, orderKeyFor(idx,(g.uk||''))); });
    groups.sort((a,b)=>{ const oa=(a.uk&&ukMetaOf(a.uk).order!=null)?ukMetaOf(a.uk).order:a.first; const ob=(b.uk&&ukMetaOf(b.uk).order!=null)?ukMetaOf(b.uk).order:b.first; return oa-ob; });
    const named=groups.filter(g=>g.uk); const nullG=groups.find(g=>!g.uk);
    if(nullG && named.length===0){ nullG.entries.forEach(x=>{ html+=entryCardHTML(x.e,x.cid,true); }); }
    else {
      if(nullG){ nullG.entries.forEach(x=>{ html+=entryCardHTML(x.e,x.cid,true); }); }
      named.forEach((g)=>{ const gidx=UK_LIST.indexOf(g.uk); const col=ukColorOf(g.uk,gidx>=0?gidx:g.first); const ico=ukIconOf(g.uk);
        const ckey=idx+':'+g.uk; const isCol=(collapsed[ckey]!==false); /* Untergruppen sind standardmäßig zugeklappt */
        /* ckey enthält den UK-Namen (Freitext) → per data-Attribut übergeben,
           nicht als Inline-String-Literal (esc() escaped kein Apostroph). */
        html+=`<div class="uksec ${isCol?'collapsed':''}" style="--uk:${col}"><div class="uksec-head" data-k="${esc(ckey)}" onclick="toggleUk(this.dataset.k)"><span class="uksec-ico">${ico}</span><span class="uksec-name">${esc(g.uk)}</span><span class="uksec-count">${g.entries.length}</span><span class="uksec-arrow">▾</span></div><div class="uksec-body">`;
        g.entries.forEach(x=>{ html+=entryCardHTML(x.e,x.cid,true); });
        html+=`</div></div>`;
      });
    }
  } else {
    const {blocks}=ablaufSegments(idx);
    blocks.forEach(b=>{ if(b.head) html+=`<div class="sub-head">${esc(b.head)}</div>`;
      b.items.forEach(x=>{ html+=entryCardHTML(x.e,x.cid,false); }); });
  }
  const body=html||`<div class="empty"><div class="ei">📄</div><h3>Keine Einträge</h3><p>Diese Rubrik enthält keine Positionen.</p></div>`;
  const adoptBtn=isMatGer?`<button class="add-entry-btn" onclick="startAdoptCatalog()">⬇ Aus Katalog übernehmen</button>`:'';
  const chkN=rubrikCids(idx).filter(c=>checks[c]).length;
  const resetBar=chkN?`<div class="chk-reset"><span class="cr-count">${chkN} abgehakt</span><button type="button" class="cr-btn" onclick="clearRubrikChecks(${idx})">↺ Alle zurücksetzen</button></div>`:'';
  $('scr-detail').innerHTML=hintsBlockHTML('rub',curStd.id+'|'+idx)+resetBar+body+`<button class="add-entry-btn" onclick="startAddEntry()">＋ Eintrag hinzufügen</button>`+adoptBtn;
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

