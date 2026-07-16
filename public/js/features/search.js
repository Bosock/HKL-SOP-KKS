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

function openGlobalSearch(){ showSheet(false);
  formCtx=null; mode='use'; nav=[]; /* Zurück führt sauber zur Übersicht */
  const html=`<div class="std-search gsearch"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><input type="search" id="gSearchInput" placeholder="Alles durchsuchen – Material, Gerät, Synonym …" oninput="globalSearch(this.value)" autocomplete="off"></div><div id="gSearchResults"><div class="empty"><div class="ei">🔎</div><h3>Globale Suche</h3><p>Findet jeden Eintrag über alle Standards – und zeigt zu einem Material alle Eingriffe, in denen es vorkommt.</p></div></div>`;
  $('scr-search').innerHTML=html; show('scr-search'); setBar('Globale Suche','über alle Standards',true);
  $('searchWrap').style.display='none'; setTimeout(()=>{ const i=$('gSearchInput'); if(i) i.focus(); },50); }

function globalSearch(q){ const box=$('gSearchResults'); if(!box) return;
  if(!(q||'').trim()){ box.innerHTML=`<div class="empty"><div class="ei">🔎</div><h3>Globale Suche</h3><p>Findet jeden Eintrag über alle Standards – und zeigt zu einem Material alle Eingriffe, in denen es vorkommt.</p></div>`; return; }
  const res=searchGlobal(q);
  if(!res.length){ box.innerHTML=`<div class="empty"><div class="ei">🔍</div><h3>Kein Treffer</h3><p>„${esc(q)}" wurde in keinem Standard gefunden.</p></div>`; return; }
  /* nach Standard gruppieren (= Rückwärtssuche Material → Eingriffe) */
  const byStd=new Map();
  res.forEach(h=>{ if(!byStd.has(h.sid)) byStd.set(h.sid,{std:h.std,grp:h.grp,hits:[]}); byStd.get(h.sid).hits.push(h); });
  let html=`<div class="srch-count">${res.length} Treffer in ${byStd.size} Standard${byStd.size>1?'s':''}</div>`;
  byStd.forEach((g,sid)=>{
    html+=`<div class="gs-std"><span class="gs-badge">${esc(g.grp)}</span>${esc(g.std)}</div>`;
    g.hits.forEach(h=>{ html+=`<div class="srch-hit" onclick="jumpGlobal('${esc(h.sid)}',${h.ri},'${esc(h.cid)}')"><div class="sh-name">${esc(h.name)}</div><div class="sh-ctx">${esc(h.rubrik)}${h.syn?' · Synonym: '+esc(h.syn):''}</div></div>`; });
  });
  box.innerHTML=html; }

/* Öffnet den Standard und springt zum Eintrag (nutzt jumpToHit aus rubriken.js). */
function jumpGlobal(sid,ri,cid){ openStandard(sid); jumpToHit(cid,ri); }
