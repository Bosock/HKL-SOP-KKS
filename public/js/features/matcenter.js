/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — MATERIAL-ZENTRALE (ein Ort für alles)
   Vorher war die Materialpflege über die halbe App verteilt: „Material
   pflegen", „Etikett-Scanner", „Materialzusammenführung", „Einstufung prüfen",
   „Unterkategorien", „Kategorien", „Ausgeblendete Einträge", „Katalog" und der
   Aufräum-Assistent — neun Einstiege für zwei Sachverhalte.

   Denn es gibt nur ZWEI Dinge und EINE Querfrage:
     📦 MATERIAL  — was ein Produkt IST   (Hersteller, REF, Maße, Foto, Preis,
                    Lagerort, Eigenschaften) → gilt einmal, überall gleich
     📄 EINTRAG   — wie es HIER benutzt wird (Menge, Hinweis, Kategorie,
                    Sichtbarkeit) → gilt pro Stelle
     🎯 GELTUNG   — für wen/wo eine Änderung gilt (nur hier · Standard ·
                    Gruppe · überall · je Arzt)

   Danach ist diese Ansicht gegliedert — vier Register statt neun Menüs:
     📦 Material · 📄 Einträge · 🗂 Ordnung · ✅ Prüfen

   „Prüfen" ist der eigentliche Gewinn: eine Arbeitsliste statt Suchen — sie
   sagt, was noch fehlt (Foto, Preis, Lagerort, Verknüpfung, Einstufung) und
   führt mit einem Tipp genau dorthin.
   ───────────────────────────────────────────────────────────── */

let mcTab = 'material';        /* material | eintraege | ordnung | pruefen */
let mcQ = '';                  /* Suche im aktuellen Register */
let mcFilter = 'alle';         /* Filter im Register „Material"/„Einträge" */
let mcRowCache = null;         /* je Vollrender einmal berechnet */
let mcEntryCache = null;       /* dito für die Eintragsliste (voller DB-Durchlauf) */

/* ===== Reine, testbare Helfer ===== */

/* Fehlt an einem Stammsatz etwas Wichtiges? Liefert die Liste der Lücken.
   Rein/testbar — Grundlage der Arbeitsliste im Register „Prüfen". */
function mcMissingOf(rec){
  const out=[];
  if(!rec) return out;
  if(!rec.photo) out.push('foto');
  if(rec.preis==null || rec.preis==='') out.push('preis');
  if(!rec.lagerort) out.push('lagerort');
  if(!rec.ref) out.push('ref');
  if(!rec.kategorie) out.push('kategorie');
  return out;
}
const MC_LUECKEN = [
  { key:'foto',      label:'ohne Foto',      ico:'📷' },
  { key:'preis',     label:'ohne Preis',     ico:'💶' },
  { key:'lagerort',  label:'ohne Lagerort',  ico:'📍' },
  { key:'ref',       label:'ohne REF',       ico:'🔢' },
  { key:'kategorie', label:'ohne Kategorie', ico:'🏷️' },
];

/* Zählt die Lücken über alle Stammsätze. Rein (liest GTINDB). */
function mcGapCounts(){
  const db=(typeof GTINDB==='object'&&GTINDB)?GTINDB:{};
  const counts={ foto:0, preis:0, lagerort:0, ref:0, kategorie:0 };
  Object.keys(db).forEach(k=>{ mcMissingOf(db[k]).forEach(m=>{ counts[m]=(counts[m]||0)+1; }); });
  return counts;
}
/* Wie viele Alt-Datensätze warten noch auf die Übernahme in den Stammsatz?
   (hkl_care = Foto/Lagerort, hkl_prod = Hersteller/REF/Verwendung/Preis,
   hkl_catalog = Katalog-Positionen). Rein/testbar. */
function mcLegacyPending(){
  const care=(typeof careMem==='object'&&careMem)?careMem:{};
  const prod=(typeof PROD==='object'&&PROD)?PROD:{};
  const linked=(k)=>(typeof canonId==='function')?!!canonId(k):false;
  let careOffen=0, prodOffen=0;
  Object.keys(care).forEach(k=>{ const c=care[k]; if(!c) return;
    if((c.photo||c.loc) && !linked(k)) careOffen++; });
  Object.keys(prod).forEach(k=>{ const p=prod[k]; if(!p) return;
    if((p.hersteller||p.ref||p.verwendung||p.preis!=null) && !linked(k)) prodOffen++; });
  const kat=(typeof CATALOG==='object'&&CATALOG&&Array.isArray(CATALOG.items))?CATALOG.items.length:0;
  return { care:careOffen, prod:prodOffen, katalog:kat, gesamt:careOffen+prodOffen };
}
/* Einträge (Vorkommen) mit ihrem Pflegestatus. Rein bezogen auf DB/Stores. */
function mcEntryRows(){
  if(mcEntryCache) return mcEntryCache;          /* je Render nur EIN Durchlauf */
  if(typeof allMatGerEntries!=='function') return [];
  return (mcEntryCache=allMatGerEntries().map(x=>{
    const cid=x.cid;
    const linkedId=(typeof canonId==='function'&&x.e.material_key)?canonId(x.e.material_key):null;
    const hidden=(typeof qeGet==='function')?(qeGet(x.e,cid,'hidden')===true):false;
    const unsicher=(x.e.natur_konfidenz==='mittel'||x.e.natur_konfidenz==='niedrig')
      && (typeof isHandled==='function' ? !isHandled(cid) : true);
    const dn=(typeof qeGet==='function')?qeGet(x.e,cid,'name'):undefined;
    return { cid, name:(dn!==undefined?dn:x.e.anzeige_text)||'', std:(typeof stdTitel==='function')?stdTitel(x.std):x.std.titel,
      stdId:x.std.id, rubrik:x.rubrik||'', mk:x.e.material_key||'', verknuepft:!!linkedId,
      hidden, unsicher, eigen:!!x.e._added };
  }));
}

/* ===== Register-Gerüst ===== */
function renderMatCenter(){
  const box=$('scr-care'); if(!box) return;
  /* Reiter nach W3C-ARIA-Muster „Tabs": role=tab + aria-selected, nur der
     aktive Reiter ist im Tab-Fokus (tabindex), Pfeiltasten wechseln. */
  const tab=(k,ico,label,badge)=>`<button class="mc-tab${mcTab===k?' on':''}" role="tab" id="mctab-${k}"
    aria-selected="${mcTab===k?'true':'false'}" aria-controls="mcPanel" tabindex="${mcTab===k?'0':'-1'}"
    onclick="mcGo('${k}')" onkeydown="mcTabKey(event)">
    <span class="mc-tab-ico" aria-hidden="true">${ico}</span><span class="mc-tab-l">${esc(label)}</span>${badge?`<span class="mc-tab-b">${esc(String(badge))}</span>`:''}</button>`;
  mcEntryCache=null;                              /* Caches je Vollrender frisch */
  const rows=mcRowCache=(typeof matHubRows==='function')?matHubRows():[];
  const offen=rows.filter(x=>x.status==='open'||x.status==='part').length;
  const gaps=mcGapCounts(); const legacy=mcLegacyPending();
  const todo=Object.keys(gaps).reduce((n,k)=>n+gaps[k],0)+legacy.gesamt;
  let html=`<div class="banner"><h2>🧬 Material &amp; Einträge</h2>
    <p>Der eine Ort für alles rund ums Material: erfassen, pflegen, zuordnen, ordnen und prüfen.
    <b>Material</b> = was ein Produkt ist (gilt überall gleich). <b>Eintrag</b> = wie es an einer Stelle benutzt wird.</p></div>
    <div class="mc-tabs" role="tablist" aria-label="Bereiche der Materialverwaltung">
      ${tab('material','📦','Material',rows.length)}
      ${tab('eintraege','📄','Einträge','')}
      ${tab('ordnung','🗂','Ordnung','')}
      ${tab('pruefen','✅','Prüfen',todo||'')}
    </div>`;
  html+=`<div id="mcPanel" role="tabpanel" aria-labelledby="mctab-${mcTab}">`;
  if(mcTab==='material') html+=mcMaterialHTML(offen);
  else if(mcTab==='eintraege') html+=mcEntriesHTML();
  else if(mcTab==='ordnung') html+=mcOrdnungHTML();
  else html+=mcPruefenHTML(gaps,legacy);
  html+=`</div>`;
  box.innerHTML=html;
}
function mcGo(t){ mcTab=t; mcQ=''; mcFilter='alle'; renderMatCenter();
  const el=document.getElementById('mctab-'+t); if(el){ try{ el.focus(); }catch(e){} } }
/* Pfeiltasten-Navigation zwischen den Reitern (ARIA-APG „Tabs"). */
const MC_TABS=['material','eintraege','ordnung','pruefen'];
function mcTabKey(ev){
  const i=MC_TABS.indexOf(mcTab); let j=-1;
  if(ev.key==='ArrowRight') j=(i+1)%MC_TABS.length;
  else if(ev.key==='ArrowLeft') j=(i-1+MC_TABS.length)%MC_TABS.length;
  else if(ev.key==='Home') j=0;
  else if(ev.key==='End') j=MC_TABS.length-1;
  if(j<0) return;
  ev.preventDefault(); mcGo(MC_TABS[j]); }
function mcSearch(q){ mcQ=q||'';
  const box=$('mcList'); if(!box) return;
  box.innerHTML=(mcTab==='eintraege')?mcEntryListHTML():mcMaterialListHTML(); }
function mcSetFilter(f){ mcFilter=f; renderMatCenter(); }
/* Entprellt — die Eintragsliste geht über alle Standards. */
const mcSearchDebounced=debounce((q)=>mcSearch(q),250);

/* ===== Register 1: MATERIAL (Stammsätze) ===== */
function mcMaterialHTML(offen){
  const scanCta=(typeof scannerSupported==='function'&&scannerSupported())
    ? `<button class="scan-cta" onclick="startCam()">📷 Etikett scannen</button>`
    : `<div class="scan-this">Der Live-Scanner braucht Android-Chrome mit Kamerafreigabe. Material lässt sich hier trotzdem anlegen und pflegen.</div>`;
  const fb=(k,l)=>`<button class="${mcFilter===k?'on':''}" aria-pressed="${mcFilter===k?'true':'false'}" onclick="mcSetFilter('${k}')">${esc(l)}</button>`;
  const groups=(typeof matSuggestGroups==='function'&&typeof matDistinctList==='function')
    ? matSuggestGroups(matDistinctList()) : [];
  let dup='';
  if(groups.length){
    dup=`<div class="mc-hint">🧬 ${groups.length} mögliche Duplikate –
      <button class="vlink" onclick="mcGo('pruefen')">im Register „Prüfen" zusammenführen</button></div>`;
  }
  return `${scanCta}<div class="scan-help-slot"></div>
    <div class="mc-actions">
      <button class="add-entry-btn" onclick="matHubNew()">＋ Material anlegen</button>
    </div>
    ${dup}
    <div class="std-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><input type="search" placeholder="Material, Standard, REF, Hersteller …" value="${esc(mcQ)}" oninput="mcSearchDebounced(this.value)" autocomplete="off"></div>
    <div class="filter-row">${fb('alle','Alle')}${fb('offen','Offen ('+offen+')')}${fb('foto','ohne Foto')}${fb('preis','ohne Preis')}${fb('lagerort','ohne Lagerort')}${fb('material','Material')}${fb('geraet','Gerät')}</div>
    <div id="mcList">${mcMaterialListHTML()}</div>`;
}
function mcMaterialListHTML(){
  let list=(mcRowCache||(mcRowCache=(typeof matHubRows==='function')?matHubRows():[])).slice();
  const rec=(x)=>{ const id=(typeof canonId==='function')?canonId(x.key):null;
    return (id&&typeof GTINDB!=='undefined')?GTINDB[id]:(x.kind==='stamm'&&typeof GTINDB!=='undefined'?GTINDB[x.key]:null); };
  if(mcFilter==='offen') list=list.filter(x=>x.status==='open'||x.status==='part');
  else if(mcFilter==='material') list=list.filter(x=>x.typ==='material');
  else if(mcFilter==='geraet') list=list.filter(x=>x.typ==='geraet');
  else if(mcFilter==='foto'||mcFilter==='preis'||mcFilter==='lagerort'){
    list=list.filter(x=>{ const r=rec(x); return r?mcMissingOf(r).indexOf(mcFilter)>=0:true; });
  }
  const q=(mcQ||'').trim().toLowerCase();
  if(q) list=list.filter(x=>((x.name||'')+' '+(x.stds||[]).join(' ')).toLowerCase().indexOf(q)>=0);
  list.sort((a,b)=>(a.name||'').localeCompare(b.name||'','de'));
  if(!list.length) return `<div class="empty"><div class="ei">🔍</div><h3>Nichts in diesem Filter</h3><p>Filter wechseln oder oben scannen/anlegen.</p></div>`;
  return list.slice(0,600).map(m=>{
    const r=rec(m); const miss=r?mcMissingOf(r):[];
    const thumb=m.photo?`<div class="mat-thumb"><img src="${esc(m.photo)}" data-zoom data-cap="${esc(m.name)}" alt=""></div>`
      :`<div class="mat-thumb">${(typeof natOf==='function'?natOf(m.typ).icon:'')||(m.kind==='stamm'?'🏷️':'📷')}</div>`;
    const where=m.stds.length?esc(m.stds.slice(0,2).join(', '))+(m.stds.length>2?` +${m.stds.length-2}`:'')
      :(m.kind==='stamm'?'noch keinem Standard zugeordnet':'—');
    const gaps=miss.length?`<span class="mc-gap">${miss.length} offen</span>`:'';
    const cnt=m.vorkommen?`<span class="mat-count">${m.vorkommen}×</span>`:'';
    const onclick=m.kind==='stamm'?`openScanItem(this.dataset.k,true)`:`openMaterial(this.dataset.k)`;
    return `<div class="mat-row" style="border-left-color:var(--n-${esc(m.typ)})" data-k="${esc(m.key)}" onclick="${onclick}">
      ${thumb}<div class="mat-main"><div class="mat-name">${esc(m.name)}</div>
      <div class="mat-sub">${(typeof matHubStatusTag==='function')?matHubStatusTag(m.status):''} · <span class="vw-ctx" style="display:inline">${where}</span></div></div>${gaps}${cnt}</div>`;
  }).join('');
}

/* ===== Register 2: EINTRÄGE (Vorkommen in den Standards) ===== */
function mcEntriesHTML(){
  const rows=mcEntryRows();
  const nv=rows.filter(r=>!r.verknuepft&&!r.hidden).length;
  const un=rows.filter(r=>r.unsicher&&!r.hidden).length;
  const hi=rows.filter(r=>r.hidden).length;
  const fb=(k,l)=>`<button class="${mcFilter===k?'on':''}" aria-pressed="${mcFilter===k?'true':'false'}" onclick="mcSetFilter('${k}')">${esc(l)}</button>`;
  return `<div class="mc-hint">Hier stehen die <b>Vorkommen</b> in den Standards – also wie ein Material an einer bestimmten Stelle benutzt wird. Ein Tipp öffnet die Eintrags-Maske; dort legst du auch fest, <b>wo</b> die Änderung gelten soll.</div>
    <div class="std-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><input type="search" placeholder="Eintrag, Standard, Rubrik …" value="${esc(mcQ)}" oninput="mcSearchDebounced(this.value)" autocomplete="off"></div>
    <div class="filter-row">${fb('alle','Alle')}${fb('nichtverknuepft','ohne Material ('+nv+')')}${fb('unsicher','Einstufung unsicher ('+un+')')}${fb('ausgeblendet','Ausgeblendet ('+hi+')')}${fb('eigen','Eigene')}</div>
    <div id="mcList">${mcEntryListHTML()}</div>`;
}
function mcEntryListHTML(){
  let rows=mcEntryRows();
  if(mcFilter==='nichtverknuepft') rows=rows.filter(r=>!r.verknuepft&&!r.hidden);
  else if(mcFilter==='unsicher') rows=rows.filter(r=>r.unsicher&&!r.hidden);
  else if(mcFilter==='ausgeblendet') rows=rows.filter(r=>r.hidden);
  else if(mcFilter==='eigen') rows=rows.filter(r=>r.eigen);
  else rows=rows.filter(r=>!r.hidden);
  const q=(mcQ||'').trim().toLowerCase();
  if(q) rows=rows.filter(r=>(r.name+' '+r.std+' '+r.rubrik).toLowerCase().indexOf(q)>=0);
  if(!rows.length) return `<div class="empty"><div class="ei">✓</div><h3>Nichts in diesem Filter</h3><p>Hier ist gerade nichts zu tun.</p></div>`;
  return rows.slice(0,400).map(r=>{
    const tags=[
      r.verknuepft?'<span class="mc-tag ok">🔗 Material</span>':'<span class="mc-tag warn">kein Material</span>',
      r.unsicher?'<span class="mc-tag warn">⚠ Einstufung</span>':'',
      r.hidden?'<span class="mc-tag">ausgeblendet</span>':'',
      r.eigen?'<span class="mc-tag">eigen</span>':'',
    ].filter(Boolean).join('');
    return `<div class="mat-row" data-cid="${esc(r.cid)}" onclick="mcOpenEntry(this.dataset.cid)">
      <div class="mat-main"><div class="mat-name">${esc(r.name)}</div>
      <div class="mat-sub"><span class="vw-ctx" style="display:inline">${esc(r.std)} · ${esc(r.rubrik)}</span></div>
      <div class="e-meta" style="margin-top:5px">${tags}</div></div><span class="chev">›</span></div>`;
  }).join('');
}
/* Öffnet DIE EINE Eintrags-Maske – aus der Zentrale heraus, mit Rückweg hierher. */
function mcOpenEntry(cid){
  if(typeof ADMIN!=='undefined' && !ADMIN){ if(typeof promptLoginThen==='function'){ promptLoginThen(()=>mcOpenEntry(cid)); return; } }
  const e=(typeof findEntry==='function')?findEntry(cid):null; if(!e){ toast('Eintrag nicht gefunden',true); return; }
  /* curStd setzen, damit Reichweite/Regeln den Standard kennen. */
  const sid=(typeof cidStd==='function')?cidStd(cid):String(cid).split('|')[0];
  const s=(typeof DB!=='undefined'&&DB)?DB.standards.find(x=>x.id===sid):null; if(s) curStd=s;
  openEntryForm({ kind:'editBase', cid, back:()=>{ mcTab='eintraege'; renderMatCenter(); show('scr-care'); updateBar(); } });
}

/* ===== Register 3: ORDNUNG (Kategorien · Unterkategorien · Eigenschaften) ===== */
function mcOrdnungHTML(){
  /* Kategorien (NATCFG) */
  let kat=`<div class="mc-sec">🏷️ Kategorien<span class="mc-sec-s">Name, Farbe, Symbol – und was als Material zählt</span></div>`;
  (typeof natList==='function'?natList():[]).forEach(n=>{
    kat+=`<div class="nat-row">
      <input type="color" class="nat-color" value="${esc(n.color)}" data-k="${esc(n.key)}" oninput="setNatColor(this.dataset.k,this.value)">
      <input class="loc-input nat-label" value="${esc(n.label)}" data-k="${esc(n.key)}" onchange="setNatLabel(this.dataset.k,this.value)">
      <button class="icon-btn" data-k="${esc(n.key)}" onclick="editNatIcon(this.dataset.k)" aria-label="Symbol">${n.icon||'•'}</button>
      <label class="g-check" style="margin:0"><input type="checkbox" ${n.beschaffbar?'checked':''} data-k="${esc(n.key)}" onchange="setNatBeschaffbar(this.dataset.k,this.checked)"> Material</label>
    </div>`; });
  kat+=`<div class="nat-foot"><button class="add-btn" onclick="addNat()">＋ Kategorie</button></div>`;

  /* Unterkategorien (ukMeta) */
  const uk=(typeof computeUkList==='function')?computeUkList():{names:[],cnt:new Map()};
  let ukh=`<div class="mc-sec">🗂 Unterkategorien<span class="mc-sec-s">Abschnitte innerhalb der Material-Rubriken</span></div>`;
  if(!uk.names.length) ukh+=`<p class="hint">Noch keine Unterkategorien vergeben.</p>`;
  uk.names.forEach((name,i)=>{
    const c=(typeof ukColorOf==='function')?ukColorOf(name,i):'#888';
    const n=uk.cnt&&uk.cnt.get?(uk.cnt.get(name)||0):0;
    ukh+=`<div class="nat-row">
      <input type="color" class="nat-color" value="${esc(c)}" data-i="${i}" oninput="setUkColor(+this.dataset.i,this.value)">
      <div class="nat-label-static">${esc(name)}<span class="uk-count">${n}×</span></div>
      <button class="icon-btn" data-i="${i}" onclick="renameUk(+this.dataset.i)" aria-label="Umbenennen">✎</button>
    </div>`; });

  /* Eigene Eigenschaften (MATPROPS) — Schema, das an JEDEM Material erscheint */
  let pr=`<div class="mc-sec">🧩 Eigene Eigenschaften<span class="mc-sec-s">Zusatzfelder, die an jedem Material erscheinen (z. B. „Tip Load")</span></div>`;
  const props=(typeof MATPROPS!=='undefined'&&Array.isArray(MATPROPS))?MATPROPS:[];
  if(!props.length) pr+=`<p class="hint">Noch keine eigenen Eigenschaften angelegt.</p>`;
  props.forEach((p,i)=>{ pr+=`<div class="nat-row">
      <div class="nat-label-static">${esc(p.label)}</div>
      <button class="icon-btn" data-i="${i}" onclick="mcPropDelete(+this.dataset.i)" aria-label="Entfernen">🗑</button>
    </div>`; });
  pr+=`<div class="form-row" style="margin-top:8px"><input class="loc-input" id="mcNewProp" placeholder="Name, z. B. Tip Load"><button class="add-btn" onclick="mcPropAdd()">Anlegen</button></div>`;

  return `<div class="mc-hint">Hier legst du die <b>Ordnung</b> fest, nach der Material und Einträge sortiert und dargestellt werden.</div>
    ${kat}${ukh}${pr}`;
}
function mcPropAdd(){ const i=$('mcNewProp'); const label=(i&&i.value||'').trim(); if(!label){ toast('Bitte einen Namen eingeben',true); return; }
  if(typeof matPropAdd==='function'){ matPropAdd(label); renderMatCenter(); toast('Eigenschaft „'+label+'" angelegt'); } }
function mcPropDelete(i){ if(typeof MATPROPS==='undefined'||!MATPROPS[i]) return;
  const p=MATPROPS[i];
  if(!confirm('Eigenschaft „'+p.label+'" entfernen? Bereits erfasste Werte bleiben an den Materialien erhalten, werden aber nicht mehr angezeigt.')) return;
  MATPROPS.splice(i,1); if(typeof saveMatprops==='function') saveMatprops(); renderMatCenter(); toast('Entfernt'); }

/* ===== Register 4: PRÜFEN (Arbeitsliste) ===== */
function mcPruefenHTML(gaps,legacy){
  const rows=mcEntryRows();
  const nichtVerknuepft=rows.filter(r=>!r.verknuepft&&!r.hidden).length;
  const unsicher=rows.filter(r=>r.unsicher&&!r.hidden).length;
  const groups=(typeof matSuggestGroups==='function'&&typeof matDistinctList==='function')
    ? matSuggestGroups(matDistinctList()) : [];
  const cleanupOffen=(typeof cleanupStats==='function')?cleanupStats().offen:0;

  const row=(ico,label,n,sub,action)=>n?`<div class="mc-todo" onclick="${action}">
      <span class="mc-todo-ico">${ico}</span>
      <span class="mc-todo-main"><span class="mc-todo-l">${esc(label)}</span><span class="mc-todo-s">${esc(sub)}</span></span>
      <span class="mc-todo-n">${n}</span><span class="chev">›</span></div>`:'';

  let todo='';
  todo+=row('🔗','Einträge ohne Material',nichtVerknuepft,'einem Stammsatz zuordnen – dann gelten Foto, Maße und Preis überall',"mcJump('eintraege','nichtverknuepft')");
  todo+=row('⚠','Einstufung unsicher',unsicher,'die Automatik war sich bei der Kategorie nicht sicher',"mcJump('eintraege','unsicher')");
  MC_LUECKEN.forEach(l=>{ const n=gaps[l.key]||0;
    const filt=(l.key==='foto'||l.key==='preis'||l.key==='lagerort')?l.key:'alle';
    todo+=row(l.ico,'Material '+l.label,n,'am Material ergänzen',"mcJump('material','"+filt+"')"); });
  todo+=row('🧬','Mögliche Duplikate',groups.length,'gleiche Materialien zu einem Stammsatz zusammenführen',"mcMergeFirst()");
  todo+=row('🧹','Standard-Texte aufräumen',cleanupOffen,'Material vom Text trennen (Verwendung, Bedingung, Standort)',"openCleanup()");

  /* Alt-Daten: einmalige Übernahme in die Stammsätze */
  let migr='';
  if(legacy.gesamt>0 || legacy.katalog>0){
    migr=`<div class="mc-sec">🧱 Alt-Daten übernehmen<span class="mc-sec-s">Einmalig – danach liegt alles an EINER Stelle</span></div>
      <div class="mc-migr">
        <p>Früher wurden Foto/Lagerort und Hersteller/REF/Preis in getrennten Töpfen gepflegt (aus der alten „Material pflegen"-Maske), Katalog-Positionen in einem dritten. Diese Übernahme trägt sie in die Material-Stammsätze ein — <b>nichts wird überschrieben</b>, nur leere Felder werden gefüllt, und die Alt-Daten bleiben unangetastet.</p>
        <ul class="mc-migr-l">
          ${legacy.care?`<li><b>${legacy.care}</b> × Foto/Lagerort aus der alten Pflege</li>`:''}
          ${legacy.prod?`<li><b>${legacy.prod}</b> × Hersteller/REF/Preis aus der alten Pflege</li>`:''}
          ${legacy.katalog?`<li><b>${legacy.katalog}</b> × Katalog-Positionen</li>`:''}
        </ul>
        ${legacy.gesamt?`<button class="btn btn-pri" onclick="mcMigrateLegacy()">Alt-Pflegedaten übernehmen</button>`:''}
        ${legacy.katalog?`<button class="btn btn-sec" onclick="mcMigrateCatalog()">Katalog als Material übernehmen</button>`:''}
      </div>`;
  }
  const nothing=(!todo)?`<div class="empty"><div class="ei">✅</div><h3>Alles gepflegt</h3><p>Keine offenen Lücken – Material und Einträge sind vollständig.</p></div>`:'';
  return `<div class="mc-hint">Diese Liste sagt dir, <b>was noch fehlt</b>. Jede Zeile führt direkt dorthin, wo es sich erledigen lässt.</div>
    ${todo}${nothing}${migr}`;
}
function mcJump(tab,filter){ mcTab=tab; mcFilter=filter||'alle'; mcQ=''; renderMatCenter(); }
function mcMergeFirst(){ if(typeof matHubMerge==='function'){ matHubMerge(0); mcTab='pruefen'; renderMatCenter(); } }

/* ===== Alt-Daten-Übernahme (nicht-destruktiv, wiederholbar) ===== */
/* Füllt LEERE Felder eines Stammsatzes aus einem Alt-Datensatz. Überschreibt
   nie und lässt die Alt-Speicher unangetastet — damit ist die Übernahme
   gefahrlos wiederholbar. */
function mcFillEmpty(rec, seed){
  let changed=false;
  ['name','hersteller','ref','verwendung','lagerort','photo'].forEach(k=>{
    if((rec[k]==null||rec[k]==='') && seed[k]){ rec[k]=seed[k]; changed=true; } });
  if((rec.preis==null||rec.preis==='') && seed.preis!=null){ rec.preis=seed.preis; changed=true; }
  return changed;
}
function mcMigrateLegacy(){
  if(typeof ADMIN!=='undefined' && !ADMIN){ if(typeof promptLoginThen==='function'){ promptLoginThen(mcMigrateLegacy); return; } }
  const keys=new Set([].concat(
    Object.keys((typeof careMem==='object'&&careMem)||{}),
    Object.keys((typeof PROD==='object'&&PROD)||{})));
  let neu=0, ergaenzt=0;
  keys.forEach(k=>{
    const seed=(typeof matSeedFromCare==='function')?matSeedFromCare(k,null):{};
    if(!seed || !Object.keys(seed).length) return;
    let id=(typeof canonId==='function')?canonId(k):null;
    if(!id){
      const m=(typeof MAT_INDEX!=='undefined'?MAT_INDEX:[]).find(x=>x.key===k);
      const name=(m&&m.name)||k;
      id=(typeof matCreateStamm==='function')?matCreateStamm(name, seed):null;
      if(id){ if(typeof matLinkTo==='function') matLinkTo(k,id); neu++; return; }
    }
    const rec=(id&&typeof GTINDB!=='undefined')?GTINDB[id]:null;
    if(rec && mcFillEmpty(rec,seed)){ rec.updatedAt=new Date().toISOString(); ergaenzt++; }
  });
  if(typeof saveGtinDB==='function') saveGtinDB();
  if(typeof buildMaterialIndex==='function') buildMaterialIndex();
  mcRowCache=null; renderMatCenter();
  toast(neu+' neu angelegt · '+ergaenzt+' ergänzt');
}
function mcMigrateCatalog(){
  if(typeof ADMIN!=='undefined' && !ADMIN){ if(typeof promptLoginThen==='function'){ promptLoginThen(mcMigrateCatalog); return; } }
  const items=(typeof CATALOG==='object'&&CATALOG&&Array.isArray(CATALOG.items))?CATALOG.items:[];
  if(!items.length){ toast('Katalog ist leer'); return; }
  if(!confirm(items.length+' Katalog-Positionen als Material-Stammsätze anlegen?\n\nDer Katalog selbst bleibt erhalten; vorhandene Materialien mit gleichem Namen werden übersprungen.')) return;
  const db=(typeof GTINDB==='object'&&GTINDB)?GTINDB:{};
  const vorhanden=new Set(Object.keys(db).map(k=>(db[k].name||'').trim().toLowerCase()).filter(Boolean));
  let n=0;
  items.forEach(it=>{
    const nm=(it.name||'').trim(); if(!nm || vorhanden.has(nm.toLowerCase())) return;
    const seed={ name:nm };
    if(it.sizeVal) seed.groessen=[{typ:it.sizeTyp||'dimension',wert:it.sizeVal,roh:it.sizeVal}];
    if(typeof matCreateStamm==='function' && matCreateStamm(nm,seed)){ vorhanden.add(nm.toLowerCase()); n++; }
  });
  if(typeof buildMaterialIndex==='function') buildMaterialIndex();
  mcRowCache=null; renderMatCenter();
  toast(n+' Katalog-Positionen übernommen');
}
