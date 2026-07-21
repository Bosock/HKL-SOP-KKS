/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — ZENTRALE MATERIALVERWALTUNG (ein Ort für alles)
   Führt die früher getrennten Material-Menüs zusammen: „Material pflegen"
   (Foto/Lagerort/Preis), den „Etikett-Scanner" (Barcode-Stammsatz mit Maßen &
   eigenen Eigenschaften) und die „Materialzusammenführung" (Destillation).

   EIN Bildschirm listet jedes Material mit Foto, Vorkommen (WO es benutzt wird)
   und Status; ein Tipp öffnet EINEN Editor (der reiche Stammsatz-Editor aus
   scanner.js) mit Scan 📷, OCR, Foto-Zuschnitt, Maßen, eigenen Eigenschaften,
   Preis und Lagerort. Duplikate lassen sich direkt zusammenführen. Aus einem
   Eintrag im Standard öffnet „Material verwalten" denselben Editor.

   Der Stammsatz (GTINDB, inkl. manueller „m:…") ist die EINZIGE Quelle der
   Identität; `hkl_matlink` verbindet Vorkommen (material_key) → Stammsatz.
   Alt-Daten aus „Material pflegen" (hkl_care/hkl_prod) werden beim ersten
   Öffnen nicht-destruktiv in den Stammsatz übernommen. */

let matHubQ='';                    /* aktuelle Suche im Hub */
let matHubFilterVal='alle';        /* alle | offen | material | geraet */

/* material_key → Set der Standard-Titel, in denen es vorkommt (ein Durchlauf). */
function matStdMap(){ const m={};
  if(typeof DB==='undefined'||!DB||!DB.standards) return m;
  DB.standards.forEach(s=>{ const t=(typeof stdTitel==='function')?stdTitel(s):(s.titel||s.id);
    (s.rubriken||[]).forEach(r=>{ if(r.typ!=='material'&&r.typ!=='geraete') return;
      (r.sub_bereiche||[]).forEach(sb=>(sb.eintraege||[]).forEach(e=>{ const k=e.material_key;
        if(!k) return; (m[k]=m[k]||new Set()).add(t); })); }); });
  return m; }

/* Seed für einen neuen Stammsatz aus den Alt-Pflegedaten (Foto, Lagerort,
   Hersteller, REF, Verwendung, Preis) — verlustfreie Übernahme. */
function matSeedFromCare(key,name){
  const c=(typeof careMem==='object'&&careMem&&careMem[key])||{};
  const p=(typeof PROD==='object'&&PROD&&PROD[key])||{};
  const seed={}; if(name) seed.name=name;
  if(p.hersteller) seed.hersteller=p.hersteller;
  if(p.ref) seed.ref=p.ref;
  if(p.verwendung) seed.verwendung=p.verwendung;
  if(p.preis!=null) seed.preis=p.preis;
  if(c.photo) seed.photo=c.photo;
  if(c.loc) seed.lagerort=c.loc;
  return seed; }

/* Baut die vereinheitlichte Materialliste: alle Vorkommen aus den Standards
   (MAT_INDEX) + „nur gescannte" Stammsätze ohne Vorkommen. Rein datenbezogen. */
function matHubRows(){
  const stdMap=matStdMap();
  const cId=(k)=>(typeof canonId==='function')?canonId(k):null;
  const rows=(typeof MAT_INDEX!=='undefined'?MAT_INDEX:[]).map(m=>{
    const id=cId(m.key); const c=id&&typeof GTINDB!=='undefined'?GTINDB[id]:null;
    const care=(typeof careMem==='object'&&careMem&&careMem[m.key])||null;
    const prod=(typeof PROD==='object'&&PROD&&PROD[m.key])||null;
    const photo=(c&&c.photo)||(care&&care.photo)||null;
    const status=id?'linked':((care||prod)?'part':'open');
    return { kind:'mat', key:m.key, name:(c&&c.name)||m.name, typ:m.typ,
      vorkommen:m.vorkommen, photo, status, stds:[...(stdMap[m.key]||[])] };
  });
  /* Stammsätze, die (noch) keinem Vorkommen zugeordnet sind (rein gescannt). */
  const linked=new Set((typeof MATLINK==='object'&&MATLINK)?Object.values(MATLINK):[]);
  const orphans=(typeof GTINDB==='object'&&GTINDB?Object.keys(GTINDB):[])
    .filter(g=>!linked.has(g)).map(g=>GTINDB[g])
    .map(r=>({ kind:'stamm', key:r.gtin, name:r.name||r.ref||r.gtin, typ:'material',
      vorkommen:0, photo:r.photo||null, status:'stammonly', stds:[] }));
  return rows.concat(orphans);
}

function matHubStatusTag(s){
  if(s==='linked') return `<span class="mat-sub ok"><span class="dot dot-ok"></span>Stammsatz</span>`;
  if(s==='stammonly') return `<span class="mat-sub ok"><span class="dot dot-ok"></span>erfasst</span>`;
  if(s==='part') return `<span class="mat-sub open"><span class="dot dot-open"></span>teilgepflegt</span>`;
  return `<span class="mat-sub open"><span class="dot dot-open"></span>offen</span>`;
}
function matHubListHTML(){
  let list=matHubRows();
  const f=matHubFilterVal;
  if(f==='offen') list=list.filter(x=>x.status==='open'||x.status==='part');
  else if(f==='material') list=list.filter(x=>x.typ==='material');
  else if(f==='geraet') list=list.filter(x=>x.typ==='geraet');
  const q=(matHubQ||'').trim().toLowerCase();
  if(q) list=list.filter(x=>((x.name||'')+' '+(x.stds||[]).join(' ')).toLowerCase().indexOf(q)>=0);
  list.sort((a,b)=>(a.name||'').localeCompare(b.name||'','de'));
  if(!list.length) return `<div class="empty"><div class="ei">🔍</div><h3>Nichts in diesem Filter</h3><p>Filter wechseln oder oben scannen/anlegen.</p></div>`;
  return list.slice(0,600).map(m=>{
    const thumb=m.photo?`<div class="mat-thumb"><img src="${esc(m.photo)}" alt=""></div>`
      :`<div class="mat-thumb">${(typeof natOf==='function'?natOf(m.typ).icon:'')||(m.kind==='stamm'?'🏷️':'📷')}</div>`;
    const where=m.stds.length?esc(m.stds.slice(0,2).join(', '))+(m.stds.length>2?` +${m.stds.length-2}`:'')
      :(m.kind==='stamm'?'noch keinem Standard zugeordnet':'—');
    const cnt=m.vorkommen?`<span class="mat-count">${m.vorkommen}×</span>`:'';
    const onclick=m.kind==='stamm'?`openScanItem(this.dataset.k,true)`:`openMaterial(this.dataset.k)`;
    return `<div class="mat-row" style="border-left-color:var(--n-${esc(m.typ)})" data-k="${esc(m.key)}" onclick="${onclick}">
      ${thumb}<div class="mat-main"><div class="mat-name">${esc(m.name)}</div>
      <div class="mat-sub">${matHubStatusTag(m.status)} · <span class="vw-ctx" style="display:inline">${where}</span></div></div>${cnt}</div>`;
  }).join('');
}
/* Der zentrale Material-Bildschirm (rendert in den „care"-Screen). */
function renderMaterialHub(){
  const box=$('scr-care'); if(!box) return;
  const rows=matHubRows();
  const total=rows.filter(x=>x.kind==='mat').length;
  const linked=rows.filter(x=>x.kind==='mat'&&x.status==='linked').length;
  const groups=(typeof matSuggestGroups==='function'&&typeof matDistinctList==='function')
    ? matSuggestGroups(matDistinctList()) : [];
  const scanCta=(typeof scannerSupported==='function'&&scannerSupported())
    ? `<button class="scan-cta" onclick="startCam()">📷 Etikett scannen</button>`
    : `<div class="scan-this">Der Live-Scanner braucht Android-Chrome mit Kamerafreigabe. Material lässt sich hier trotzdem anlegen und pflegen.</div>`;
  let dup='';
  if(groups.length){
    const items=groups.slice(0,6).map((g,gi)=>{ const names=g.map(k=>{ const m=MAT_INDEX.find(x=>x.key===k); return m?m.name:k; });
      return `<div class="ukrow" style="border-left-color:var(--accent)"><div class="ukrow-head"><span class="uk-name">${esc(names[0])}</span><span class="uk-count">${g.length}×</span></div>
        <div class="vw-ctx">${names.slice(1).map(esc).join(' · ')||'—'}</div>
        <div class="uk-actions"><button data-i="${gi}" onclick="matHubMerge(+this.dataset.i)">Zusammenführen</button></div></div>`; }).join('');
    dup=`<details class="vpanel" style="margin:10px 0"><summary class="vsum"><span class="vs-ico">🧬</span><span class="vs-txt"><b>${groups.length} mögliche Duplikate</b><span class="vs-sub">gleiche Materialien zu einem Stammsatz zusammenführen</span></span></summary><div class="vpanel-body">${items}</div></details>`;
  }
  const fb=(k,l)=>`<button class="${matHubFilterVal===k?'on':''}" onclick="setMatHubFilter('${k}')">${l}</button>`;
  box.innerHTML=`<div class="banner"><h2>Material</h2><p>Alle Materialien an einem Ort: scannen, fotografieren, Maße & eigene Eigenschaften erfassen, Preise pflegen und gleiche Materialien zusammenführen. Ein Tipp aufs Material öffnet den Editor.<br><b>Hinweis:</b> Alles wird zentral auf dem Server gespeichert und auf allen Geräten geteilt.</p>
      <div class="prog"><div class="prog-txt">${linked} von ${total} mit Stammsatz verknüpft</div></div></div>
    ${scanCta}
    <div id="scanHelp"></div>
    <button class="add-entry-btn" onclick="matHubNew()">＋ Material ohne Barcode anlegen</button>
    ${dup}
    <div class="std-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><input type="search" id="matHubSearch" placeholder="Material, Standard, REF, Hersteller …" value="${esc(matHubQ)}" oninput="matHubSearch(this.value)" autocomplete="off"></div>
    <div class="filter-row">${fb('alle','Alle')}${fb('offen','Offen')}${fb('material','Material')}${fb('geraet','Gerät')}</div>
    <div id="matHubList">${matHubListHTML()}</div>`;
}
function matHubSearch(q){ matHubQ=q||''; const box=$('matHubList'); if(box) box.innerHTML=matHubListHTML(); }
function setMatHubFilter(f){ matHubFilterVal=f; renderMaterialHub(); }

/* Öffnet den EINEN Editor für ein Vorkommen (material_key). Legt bei Bedarf
   einen Stammsatz an (aus Name + Alt-Pflegedaten) und verknüpft ihn. */
function openMaterial(key){
  if(typeof ADMIN!=='undefined' && !ADMIN){ if(typeof promptLoginThen==='function'){ promptLoginThen(()=>openMaterial(key)); return; } }
  let id=(typeof canonId==='function')?canonId(key):null;
  if(!id){ const m=(typeof MAT_INDEX!=='undefined'?MAT_INDEX:[]).find(x=>x.key===key);
    const name=(m&&m.name)||key;
    id=(typeof matCreateStamm==='function')?matCreateStamm(name, matSeedFromCare(key,name)):null;
    if(id&&typeof matLinkTo==='function'){ matLinkTo(key,id); if(typeof buildMaterialIndex==='function') buildMaterialIndex(); } }
  if(id&&typeof openScanItem==='function') openScanItem(id,true);
}
/* Neues Material ohne Barcode: manuellen Stammsatz-Editor öffnen (persistiert
   erst beim Speichern — die m:-ID wird schon vergeben). */
function matHubNew(){
  if(typeof ADMIN!=='undefined' && !ADMIN){ if(typeof promptLoginThen==='function'){ promptLoginThen(()=>matHubNew()); return; } }
  const id='m:'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  if(typeof renderScanItemForm==='function'){ renderScanItemForm({ gtin:id, manual:true, props:{} });
    show('scr-scan-item'); if(typeof setBar==='function') setBar('Neues Material','Bearbeiten',true); }
}
/* Duplikat-Gruppe im Hub zusammenführen (wie im Verwaltungs-Panel, re-rendert
   aber den Hub). */
function matHubMerge(gi){
  const list=(typeof matDistinctList==='function')?matDistinctList():[];
  const groups=(typeof matSuggestGroups==='function')?matSuggestGroups(list):[]; const g=groups[gi]; if(!g||!g.length) return;
  let id=null; for(const k of g){ const c=(typeof canonId==='function')?canonId(k):null; if(c){ id=c; break; } }
  if(!id){ const first=list.find(x=>x.key===g[0]); id=(typeof matCreateStamm==='function')?matCreateStamm(first?first.name:g[0], first?matSeedFromCare(g[0],first.name):null):null; }
  if(!id) return;
  g.forEach(k=>{ if(typeof matLinkTo==='function') matLinkTo(k,id); });
  if(typeof buildMaterialIndex==='function') buildMaterialIndex();
  renderMaterialHub(); if(typeof toast==='function') toast(g.length+' Vorkommen zusammengeführt');
}
