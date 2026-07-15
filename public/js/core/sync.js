/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — SERVER-STATE / SYNC
   Änderungen werden zusätzlich zum localStorage server-seitig unter
   /api/state gespeichert und über alle Geräte hinweg geteilt.

   Modell:
     - Offline-first: localStorage bleibt die sofortige Quelle. Ist der
       Server nicht erreichbar, funktioniert alles wie bisher lokal.
     - Beim Start: Server-Stand laden und übernehmen; rein lokale
       Schlüssel zusätzlich hochspielen (Erstbefüllung).
     - Bei jeder Änderung: nur die geänderten Schlüssel werden an den
       Server geschickt (Top-Level-Merge – zwei Personen können
       *verschiedene* Schlüssel bearbeiten, ohne sich zu überschreiben).
     - Regelmäßiges Polling übernimmt Fremdänderungen, solange man
       selbst nichts Ungespeichertes offen hat.
   ───────────────────────────────────────────────────────────── */
const SHARED_KEYS=['hkl_natcfg','hkl_overrides','hkl_qedits','hkl_reviewed','hkl_reassign','hkl_ukmap','hkl_ukmeta','hkl_settings','hkl_care','hkl_prod','hkl_additions','hkl_catalog',
  /* Inhalte & Anpassungen aus dem Verwaltungsmodus (vom Kollegen) – jetzt ebenfalls zentral geteilt */
  'hkl_newentries','hkl_newstd','hkl_newrub','hkl_stdedits','hkl_rubedits','hkl_entryorder','hkl_txt','hkl_design','hkl_grpord','hkl_rubicon','hkl_authpw'];

/* Übernimmt die (ggf. vom Server aktualisierten) Store-Werte in die
   laufenden Zustandsvariablen. */
function hydrateVars(){
  NATCFG=loadNatCfg();
  overrides=loadJSON('hkl_overrides',{});
  QE=loadJSON('hkl_qedits',{cid:{},mat:{}}); if(!QE.cid)QE.cid={}; if(!QE.mat)QE.mat={};
  reviewed=loadJSON('hkl_reviewed',{});
  reassign=loadJSON('hkl_reassign',{});
  ukMap=loadJSON('hkl_ukmap',{});
  ukMeta=loadJSON('hkl_ukmeta',{});
  settings=Object.assign({menge:true,groessen:true,spez:true,lagerort:true,konfidenz:true,fliesstext:true}, loadJSON('hkl_settings',{}));
  careMem=loadJSON('hkl_care',{});
  PROD=loadJSON('hkl_prod',{});
  ADDITIONS=loadAdditions();
  CATALOG=loadCatalog();
  /* Inhalte & Anpassungen aus dem Verwaltungsmodus (vom Kollegen) neu einlesen */
  NEW=loadJSON('hkl_newentries',[]);
  NEWSTD=loadJSON('hkl_newstd',[]);
  NEWRUB=loadJSON('hkl_newrub',[]);
  STDE=loadJSON('hkl_stdedits',{});
  RUBE=loadJSON('hkl_rubedits',{});
  ENTORD=loadJSON('hkl_entryorder',{});
  TXT=loadJSON('hkl_txt',{});
  DESIGN=loadJSON('hkl_design',{});
  GRPORD=loadJSON('hkl_grpord',[]);
  RUBICON=loadJSON('hkl_rubicon',{});
  rebuildDB(); /* eingehende eigene Standards/Einträge + App-eigene Standards übernehmen */
  applyNatConfig(); applyDesign();
}

/* Rendert die aktuell sichtbare Ansicht neu (nach eingehenden Server-Daten).
   Stört keine offenen Eingaben (Schnellmenü, Material-Detail). */
function refreshView(){
  try{
    if(!DB) return;
    if($('sheet').classList.contains('show')) return;
    buildMaterialIndex();
    if(mode==='admin'){ renderAdmin(); updateBar(); return; }
    if(mode==='catalog'){ if(!formCtx){ renderCatalog(); updateBar(); } return; }
    if(mode==='care'){ if(!$('scr-care-item').classList.contains('active')){ renderCare(); updateBar(); } return; }
    if($('scr-detail').classList.contains('active')){ const top=nav[nav.length-1]; if(top&&top.lvl==='rub'){ const i=top.idx; nav.pop(); openRubrik(i); } }
    else if($('scr-rubriken').classList.contains('active')&&curStd){ openStandard(curStd.id,true); }
    else { renderStandards($('searchInput')?$('searchInput').value:''); }
    updateBar();
  }catch(e){ /* best effort */ }
}

const sync=(()=>{
  const URL='/api/state';
  let rev=0, dirty=new Set(), timer=null, inflight=false, pending=false, enabled=false, offline=false, fails=0;
  function setDot(cls,title){ const d=$('syncDot'); if(d){ d.className='sync-dot '+cls; d.title=title||'Server-Status'; } }
  function payloadFor(keys){ const s={}; keys.forEach(k=>{ const v=store.get(k); if(v!=null){ try{ s[k]=JSON.parse(v); }catch(e){} } }); return s; }
  function adopt(st,skipDirty){ let changed=false; Object.keys(st||{}).forEach(k=>{ if(!SHARED_KEYS.includes(k)) return; if(skipDirty&&dirty.has(k)) return; storeSetQuiet(k, JSON.stringify(st[k])); changed=true; }); return changed; }

  async function pull(){
    const r=await fetch(URL,{cache:'no-store'}); if(!r.ok) throw new Error('HTTP '+r.status); const j=await r.json();
    rev=j.rev||0; const st=j.state||{}; adopt(st,false);
    // rein lokale Schlüssel, die der Server noch nicht kennt → Erstbefüllung
    const seed=SHARED_KEYS.filter(k=>store.get(k)!=null && !(k in st));
    return seed;
  }
  async function putKeys(keys){
    if(!keys.length) return false;
    const body=JSON.stringify({baseRev:rev, state:payloadFor(keys)});
    const r=await fetch(URL,{method:'PUT',headers:{'Content-Type':'application/json'},body});
    if(!r.ok) throw new Error('HTTP '+r.status); const j=await r.json();
    rev=j.rev||rev; return adopt(j.state,true); /* fremde Schlüssel übernehmen (eigene dirty nicht) */
  }
  async function flush(){
    if(!enabled) return;
    if(inflight){ pending=true; return; }
    const keys=[...dirty]; if(!keys.length) return;
    dirty.clear(); inflight=true; setDot('saving','Speichere…');
    try{
      const changed=await putKeys(keys); offline=false; fails=0; setDot('ok','Auf dem Server gespeichert');
      if(changed && dirty.size===0){ hydrateVars(); refreshView(); }
    }catch(e){
      keys.forEach(k=>dirty.add(k)); offline=true; fails++; setDot('local','Nur lokal – Server nicht erreichbar');
    }finally{
      inflight=false;
      if(pending||dirty.size){ pending=false; clearTimeout(timer);
        const delay=fails>0?Math.min(30000,2000*Math.pow(2,fails-1)):1500; timer=setTimeout(flush,delay); }
    }
  }
  function mark(k){ if(!enabled||!SHARED_KEYS.includes(k)) return; dirty.add(k); if(!offline) setDot('saving','Speichere…'); clearTimeout(timer); timer=setTimeout(flush,800); }
  async function poll(){
    if(!enabled||inflight||dirty.size) return;
    try{
      const r=await fetch(URL+'?since='+rev,{cache:'no-store'}); if(!r.ok) throw new Error('HTTP '+r.status); const j=await r.json();
      offline=false;
      if(j.unchanged){ setDot('ok','Auf dem Server gespeichert'); return; }
      rev=j.rev||rev; const changed=adopt(j.state,true);
      if(changed && !dirty.size){ hydrateVars(); refreshView(); }
      setDot('ok','Auf dem Server gespeichert');
    }catch(e){ offline=true; setDot('local','Nur lokal – Server nicht erreichbar'); }
  }
  async function init(){
    setDot('saving','Verbinde…');
    try{
      const seed=await pull(); hydrateVars(); offline=false; setDot('ok','Auf dem Server gespeichert');
      if(seed.length) await putKeys(seed);
    }catch(e){ offline=true; setDot('local','Nur lokal – Server nicht erreichbar'); }
  }
  function start(){ enabled=true; onStoreSet=mark; setInterval(poll,15000);
    window.addEventListener('online',()=>{ poll(); if(dirty.size) flush(); });
    document.addEventListener('visibilitychange',()=>{ if(!document.hidden) poll(); });
  }
  return {init,start};
})();

