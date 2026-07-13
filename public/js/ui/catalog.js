/* ============ Katalog (Geräte & Materialien) ============ */
/* Standalone-Übersicht aller angelegten Geräte/Materialien – unabhängig von
   den Standards. Hinzufügen/Bearbeiten/Löschen hier; Übernahme in einen
   Standard über „Aus Katalog übernehmen" in der jeweiligen Rubrik. */
let catalogFilter='alle';
function renderCatalog(){ const box=$('scr-catalog');
  let list=CATALOG.items.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||'','de'));
  if(catalogFilter!=='alle') list=list.filter(it=>(it.nat||'material')===catalogFilter);
  const procNats=natList().filter(n=>n.beschaffbar);
  let html=`<div class="banner"><h2>Katalog</h2><p>Alle Geräte und Materialien an einem Ort – unabhängig von den Standards. Hier anlegen und pflegen; in den Standards über „Aus Katalog übernehmen" einfügen.<br><b>Hinweis:</b> Der Katalog wird zentral auf dem Server gespeichert und auf allen Geräten geteilt.</p></div>
    <button class="add-entry-btn" onclick="openCatalogForm(null)">＋ Neuer Katalog-Eintrag</button>
    <button class="add-entry-btn" onclick="generateCatalogFromStandards()">⟳ Aus Standards generieren</button>`;
  const dupGroups=findCatalogDuplicateGroups(CATALOG.items);
  if(dupGroups.length){ html+=`<button class="add-entry-btn" onclick="mergeCatalogDuplicatesUI()">⧉ ${dupGroups.length} Duplikat-Gruppe(n) zusammenführen</button>`; }
  const filters=[{k:'alle',l:'Alle'}].concat(procNats.map(n=>({k:n.key,l:n.label})));
  if(procNats.length){ html+=`<div class="filter-row">`+filters.map(f=>`<button class="${catalogFilter===f.k?'on':''}" onclick="setCatalogFilter('${esc(f.k)}')">${esc(f.l)}</button>`).join('')+`</div>`; }
  if(!CATALOG.items.length){ html+=`<div class="empty"><div class="ei">📦</div><h3>Katalog ist leer</h3><p>Lege oben Geräte oder Materialien an. Sie stehen dann in jedem Standard zur Übernahme bereit.</p></div>`; }
  else if(!list.length){ html+=`<div class="empty"><div class="ei">🔍</div><h3>Nichts in diesem Filter</h3><p>Wechsle den Filter.</p></div>`; }
  list.forEach(it=>{ const info=natOf(it.nat); const g=(it.sizeVal?[{typ:it.sizeTyp||'dimension',wert:it.sizeVal,roh:it.sizeVal}]:[]);
    const sizes=g.length?' '+sizeBadges(g):''; const ukTag=it.uk?` · ${esc(it.uk)}`:'';
    const mbox=it.menge?`<div class="mbox">${esc(it.menge)}</div>`:'';
    html+=`<div class="mat-row" style="border-left-color:var(--n-${esc(it.nat)})" onclick="openCatalogForm('${esc(it.id)}')">
      <div class="mat-thumb">${info.icon||'📦'}</div>${mbox}
      <div class="mat-main"><div class="mat-name">${esc(it.name)}</div><div class="mat-sub"><span class="mat-sub">${esc(info.label)}${ukTag}${sizes}</span></div></div>
      <button class="icon-btn" style="width:38px;height:38px;flex:0 0 38px;font-size:16px" onclick="event.stopPropagation();deleteCatalogItem('${esc(it.id)}')" aria-label="Löschen">🗑</button></div>`; });
  box.innerHTML=html;
}
/* Übernimmt alle wiederverwendbaren Geräte/Materialien aus den vorhandenen
   Standards in den Katalog – so pflegt man sie danach nur an EINER Stelle. */
function generateCatalogFromStandards(){
  const isB=nat=>natOf(nat).beschaffbar;
  const neu=buildCatalogFromStandards(DB.standards,CATALOG.items,newAid,isB);
  if(!neu.length){ toast('Katalog ist bereits vollständig'); return; }
  if(!confirm(neu.length+' neue Geräte/Materialien aus den Standards in den Katalog übernehmen?')) return;
  neu.forEach(it=>{ CATALOG.items=upsertCatalogItem(CATALOG.items,it); });
  saveCatalog(); renderCatalog(); updateBar(); toast(neu.length+' übernommen');
}
/* Findet Duplikate/fast-gleiche Katalog-Einträge und führt sie nach Rückfrage
   zusammen. Sicher: bereits in Standards übernommene Einträge sind Kopien und
   bleiben unberührt. */
function mergeCatalogDuplicatesUI(){
  const groups=findCatalogDuplicateGroups(CATALOG.items);
  if(!groups.length){ toast('Keine Duplikate gefunden'); return; }
  const total=groups.reduce((n,g)=>n+g.length,0);
  const preview=groups.slice(0,8).map(g=>'• '+g.map(it=>it.name).join(' + ')).join('\n');
  const more=groups.length>8?`\n… und ${groups.length-8} weitere`:'';
  if(!confirm(`${groups.length} Gruppe(n) mit zusammen ${total} fast gleichen Einträgen zusammenführen?\n\n${preview}${more}`)) return;
  const res=mergeCatalogDuplicates(CATALOG.items);
  CATALOG.items=res.items; saveCatalog(); renderCatalog(); updateBar(); toast(res.merged+' Duplikat(e) zusammengeführt');
}
function setCatalogFilter(f){ catalogFilter=f; renderCatalog(); }
function deleteCatalogItem(id){ const it=findCatalogItem(id); if(!it) return; if(!confirm('Katalog-Eintrag „'+it.name+'" löschen? Bereits in Standards übernommene Einträge bleiben erhalten.')) return;
  CATALOG.items=removeCatalogItem(CATALOG.items,id); saveCatalog(); renderCatalog(); updateBar(); toast('Gelöscht'); }

