/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — GLOBALE VOLLTEXTSUCHE
   Durchsucht ALLE Standards (Einträge, Synonyme, Spezifikation) und
   springt zum Treffer. Weil jedes Material ein Eintrag ist, liefert die
   Suche zugleich die „Rückwärtssuche": ein Materialname zeigt alle
   Standards/Rubriken, in denen es vorkommt (nach Standard gruppiert).
   Erreichbar über das ☰-Menü.
   ───────────────────────────────────────────────────────────── */

/* Reine Suche über das aktuelle DB. Nutzt nur globale Stores (qeGet), NICHT
   die curStd-gebundenen Helfer (rubName/rubHidden) – daher hier r.name direkt. */
function searchGlobal(q){ const res=[]; q=(q||'').trim().toLowerCase(); if(!q||!DB) return res;
  DB.standards.forEach(s=>{ if(stdHidden(s)&&!ADMIN) return; const stdT=stdTitel(s), grp=stdGruppe(s);
    (s.rubriken||[]).forEach((r,ri)=>{
      (r.sub_bereiche||[]).forEach((sb,si)=>{ (sb.eintraege||[]).forEach((e,ei)=>{
        if(e.natur==='ueberschrift') return; const cid=cidOf(s.id,ri,si,ei); if(qeGet(e,cid,'hidden')===true) return;
        const dn=qeGet(e,cid,'name'); const name=((dn!==undefined?dn:e.anzeige_text)||'');
        const synQe=qeGet(e,cid,'synonyms'); const synV=(synQe!==undefined&&synQe!==null)?synQe:(e.synonyms||[]);
        const syn=Array.isArray(synV)?synV:[];
        const spQe=qeGet(e,cid,'spez'); const spRaw=(spQe!==undefined)?spQe:e.spezifikation; const sp=Array.isArray(spRaw)?spRaw.join(' '):(spRaw||'');
        const hay=(name+' '+syn.join(' ')+' '+sp).toLowerCase();
        if(hay.indexOf(q)<0) return;
        const synHit=syn.find(x=>String(x).toLowerCase().indexOf(q)>=0)&&!name.toLowerCase().includes(q);
        res.push({sid:s.id, std:stdT, grp, ri, rubrik:r.name||'', cid, name, syn:synHit?syn.find(x=>String(x).toLowerCase().indexOf(q)>=0):null});
      }); }); });
  });
  return res; }

/* Optionaler preset-Text (z. B. Weiterreichen der erfolglosen Startsuche –
   UX-Audit M2): Feld vorbefüllen und sofort suchen. */
function openGlobalSearch(preset){ showSheet(false);
  formCtx=null; mode='use'; nav=[]; /* Zurück führt sauber zur Übersicht */
  const html=`<div class="std-search gsearch"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><input type="search" id="gSearchInput" placeholder="Alles durchsuchen – Material, Gerät, Synonym …" oninput="globalSearch(this.value)" autocomplete="off"></div><div id="gSearchResults"><div class="empty"><div class="ei">🔎</div><h3>Globale Suche</h3><p>Findet jeden Eintrag über alle Standards – und zeigt zu einem Material alle Eingriffe, in denen es vorkommt.</p></div></div>`;
  $('scr-search').innerHTML=html; show('scr-search'); setBar('Globale Suche','über alle Standards',true);
  $('searchWrap').style.display='none';
  if(preset&&String(preset).trim()){ const i=$('gSearchInput'); if(i){ i.value=preset; } globalSearch(preset); }
  setTimeout(()=>{ const i=$('gSearchInput'); if(i) i.focus(); },50); }

/* Sucht in der Material-Stammdatenbank (Etikett-Scanner/Stammsätze): Name, REF,
   Hersteller, Kategorie, Lagerort. Liefert die Stammsätze. Rein/testbar. */
function searchMaterialStamm(q){
  q=(q||'').trim().toLowerCase(); if(!q || typeof GTINDB==='undefined' || !GTINDB) return [];
  return Object.keys(GTINDB).map(k=>GTINDB[k]).filter(r=>r &&
    [r.name,r.ref,r.hersteller,r.kategorie,r.lagerort,r.gtin].filter(Boolean).join(' ').toLowerCase().indexOf(q)>=0);
}
/* Zählt, in wie vielen Standards ein Material-Stammsatz vorkommt (über MATLINK).
   Damit beantwortet die Suche „welcher Standard nutzt dieses Material?". Rein. */
function stammUsedIn(stammId){
  if(typeof MATLINK==='undefined' || !MATLINK || typeof DB==='undefined' || !DB) return [];
  const keys=Object.keys(MATLINK).filter(k=>MATLINK[k]===stammId);
  if(!keys.length) return [];
  const set=new Set();
  DB.standards.forEach(s=>{ if(stdHidden(s)&&!ADMIN) return;
    (s.rubriken||[]).forEach(r=>(r.sub_bereiche||[]).forEach(sb=>(sb.eintraege||[]).forEach(e=>{
      if(e.material_key && keys.indexOf(e.material_key)>=0) set.add(stdTitel(s)); }))); });
  return [...set];
}

/* Ergebnisdarstellung: UNTEREINANDER mit großen, deutlichen Trennern je Typ —
   Standards, Anleitungen, Material. So sieht man sofort, was wozu gehört
   (statt alles in einem Topf). */
function globalSearch(q){ const box=$('gSearchResults'); if(!box) return;
  if(!(q||'').trim()){ box.innerHTML=`<div class="empty"><div class="ei">🔎</div><h3>Globale Suche</h3><p>Findet alles auf einmal: Einträge in Standards, Anleitungen und Material-Stammsätze – nach Art getrennt aufgelistet.</p></div>`; return; }
  const res=searchGlobal(q);
  const guides=(typeof guideSearch==='function')?guideSearch(q):[];
  const mats=searchMaterialStamm(q);
  if(!res.length && !guides.length && !mats.length){
    box.innerHTML=`<div class="empty"><div class="ei">🔍</div><h3>Kein Treffer</h3><p>„${esc(q)}" wurde nirgends gefunden.</p></div>`; return; }

  const sect=(ico,title,sub)=>`<div class="gs-sect"><span class="gs-sect-ico">${ico}</span><span class="gs-sect-t">${esc(title)}</span><span class="gs-sect-s">${esc(sub)}</span></div>`;
  let html=`<div class="srch-count">${res.length+guides.length+mats.length} Treffer</div>`;

  /* 1) Standards — nach Standard gruppiert (Rückwärtssuche Material → Eingriffe) */
  if(res.length){
    const byStd=new Map();
    res.forEach(h=>{ if(!byStd.has(h.sid)) byStd.set(h.sid,{std:h.std,grp:h.grp,hits:[]}); byStd.get(h.sid).hits.push(h); });
    html+=sect('📋','Standards',res.length+' Treffer in '+byStd.size+' Standard'+(byStd.size>1?'s':''));
    byStd.forEach((g,sid)=>{
      html+=`<div class="gs-std"><span class="gs-badge">${esc(g.grp)}</span>${esc(g.std)}</div>`;
      g.hits.forEach(h=>{ html+=`<div class="srch-hit" data-sid="${esc(h.sid)}" data-ri="${h.ri}" data-cid="${esc(h.cid)}" onclick="jumpGlobal(this.dataset.sid,+this.dataset.ri,this.dataset.cid)"><div class="sh-name">${esc(h.name)}</div><div class="sh-ctx">${esc(h.rubrik)}${h.syn?' · Synonym: '+esc(h.syn):''}</div></div>`; });
    });
  }
  /* 2) Anleitungen */
  if(guides.length){
    html+=sect('📘','Anleitungen',guides.length+' Treffer');
    guides.forEach(g=>{ const sub=[g.bereich, g.treffer?(g.treffer+' Schritt(e)'):''].filter(Boolean).join(' · ');
      html+=`<div class="srch-hit" data-gid="${esc(g.id)}" onclick="openGuide(this.dataset.gid)"><div class="sh-name">${esc(g.titel)}</div><div class="sh-ctx">${esc(sub)}</div></div>`; });
  }
  /* 3) Material-Stammsätze — mit „wird genutzt in …" */
  if(mats.length){
    html+=sect('🧬','Material',mats.length+' Stammsätze');
    mats.slice(0,60).forEach(r=>{
      const used=stammUsedIn(r.gtin);
      const sub=[r.hersteller, r.ref?('REF '+r.ref):'', r.kategorie].filter(Boolean).join(' · ');
      const uses=used.length?`<div class="sh-uses">wird genutzt in: ${esc(used.slice(0,4).join(', '))}${used.length>4?' +'+(used.length-4):''}</div>`:'';
      html+=`<div class="srch-hit" data-g="${esc(r.gtin)}" onclick="openScanItem(this.dataset.g,false)"><div class="sh-name">${esc(r.name||r.ref||r.gtin)}</div><div class="sh-ctx">${esc(sub)}</div>${uses}</div>`; });
  }
  box.innerHTML=html; }

/* Öffnet den Standard und springt zum Eintrag (nutzt jumpToHit aus rubriken.js). */
function jumpGlobal(sid,ri,cid){ openStandard(sid); jumpToHit(cid,ri); }
