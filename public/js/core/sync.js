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
const SHARED_KEYS=['hkl_natcfg','hkl_overrides','hkl_qedits','hkl_reviewed','hkl_reassign','hkl_ukmap','hkl_ukmeta','hkl_settings','hkl_care','hkl_prod','hkl_hints','hkl_glossary','hkl_suggestions','hkl_additions','hkl_catalog',
  /* Inhalte & Anpassungen aus dem Verwaltungsmodus (vom Kollegen) – jetzt ebenfalls zentral geteilt */
  'hkl_newentries','hkl_newstd','hkl_newrub','hkl_rubtpl','hkl_stdedits','hkl_rubedits','hkl_entryorder','hkl_txt','hkl_design','hkl_grpord','hkl_rubicon','hkl_authpw','hkl_uksections',
  /* Produktdatenbank aus dem Etikett-Scanner (GTIN-Schlüssel) + Aufräum-Fortschritt */
  'hkl_gtin','hkl_matlink','hkl_matprops','hkl_cleanup_done',
  /* Anleitungen, konfigurierbare Pop-ups und Arzt-Varianten (Inhalte – geteilt) */
  'hkl_guides','hkl_popups','hkl_variants','hkl_ocrlearn','hkl_diag','hkl_zerlegung','hkl_dubl_ok','hkl_geraete','hkl_bezeichnungen','hkl_bausteine','hkl_funktionen','hkl_medientexte','hkl_medienanker','hkl_stdkopf','hkl_eigenschaften','hkl_stdeigen','hkl_bereiche','hkl_altgruppen','hkl_zweige','hkl_bausammlung','hkl_bausteinkats','hkl_fassungen','hkl_pflegeschritte','hkl_pflegeeigen','hkl_pflegestand','hkl_seiten','hkl_aufgaben','hkl_aktuelles','hkl_aktuellarten','hkl_bestellungen','hkl_bildorte',
  /* Regel-Journal der Verwaltungspolitik (append-only; adopt() VEREINIGT statt zu überschreiben) */
  'hkl_rules'];

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
  UKSEC=loadJSON('hkl_uksections',{});
  settings=Object.assign({menge:true,groessen:true,spez:true,lagerort:true,konfidenz:true,fliesstext:true,zerlegung:true}, loadJSON('hkl_settings',{}));
  careMem=loadJSON('hkl_care',{});
  PROD=loadJSON('hkl_prod',{});
  GTINDB=loadJSON('hkl_gtin',{});
  if(typeof OCRLEARN!=='undefined') OCRLEARN=loadJSON('hkl_ocrlearn',{});
  if(typeof DIAG!=='undefined'){ DIAG=loadJSON('hkl_diag',[]); if(!Array.isArray(DIAG)) DIAG=[]; }
  if(typeof refInvalidateIndex==='function') refInvalidateIndex();   /* REF-Bestand hat sich geändert */
  MATLINK=loadJSON('hkl_matlink',{});
  MATPROPS=loadJSON('hkl_matprops',[]); if(!Array.isArray(MATPROPS)) MATPROPS=[];
  if(typeof CLEANUP_DONE!=='undefined') CLEANUP_DONE=loadJSON('hkl_cleanup_done',{});
  if(typeof ZERLDB!=='undefined'){ ZERLDB=loadJSON('hkl_zerlegung',{}); if(!ZERLDB||typeof ZERLDB!=='object') ZERLDB={};
    if(typeof matKeyCacheLeeren==='function') matKeyCacheLeeren(); }
  if(typeof GERAETE!=='undefined'){ GERAETE=loadJSON('hkl_geraete',{}); if(!GERAETE||typeof GERAETE!=='object') GERAETE={}; }
  if(typeof BAUSTEINE!=='undefined'){ BAUSTEINE=loadJSON('hkl_bausteine',[]); if(!Array.isArray(BAUSTEINE)) BAUSTEINE=[];
    if(typeof bauCacheLeeren==='function') bauCacheLeeren(); }
  /* Sammelmappe und Kategorien der Baustein-Bibliothek: Wer am Tablet im Saal
     sammelt, macht am Rechner weiter. */
  if(typeof BAUSAM!=='undefined'){ BAUSAM=loadJSON('hkl_bausammlung',[]); if(!Array.isArray(BAUSAM)) BAUSAM=[]; }
  if(typeof BAUKAT!=='undefined'){ BAUKAT=loadJSON('hkl_bausteinkats',[]); if(!Array.isArray(BAUKAT)) BAUKAT=[]; }
  /* Festgeschriebene Fassungen (features/fassung.js) — sie sind die Grundlage
     der Standards und müssen auf jedem Gerät dieselben sein. */
  if(typeof FAS!=='undefined'){ FAS=loadJSON('hkl_fassungen',[]); if(!Array.isArray(FAS)) FAS=[]; FAS_IDX=null; }
  /* Menü- und Karten-Einstellungen (features/funktionen.js) — sie gelten für
     alle Geräte, deshalb kommen sie beim Sync mit. */
  if(typeof FKT!=='undefined'){ FKT=loadJSON('hkl_funktionen',{});
    if(typeof fktNormalisieren==='function') fktNormalisieren(); }
  /* Bildunterschriften: eine Kennung, eine Unterschrift — überall gleich. */
  if(typeof MEDTXT!=='undefined'){ MEDTXT=loadJSON('hkl_medientexte',{}); }
  /* Bilder an Standardkopf, Rubrik und Abschnitt (features/medien.js). */
  if(typeof MEDANK!=='undefined'){ MEDANK=loadJSON('hkl_medienanker',{}); if(!MEDANK||typeof MEDANK!=='object') MEDANK={}; }
  if(typeof BILDORTE!=='undefined'){ BILDORTE=loadJSON('hkl_bildorte',{}); if(!BILDORTE||typeof BILDORTE!=='object') BILDORTE={}; }
  /* Bauplan des Standardkopfes (features/stdkopf.js). */
  if(typeof KOPF!=='undefined'){ KOPF=loadJSON('hkl_stdkopf',{}); if(!KOPF||typeof KOPF!=='object') KOPF={}; }
  /* Merkmale an Standards: Definition und Vergabe (features/eigenschaften.js). */
  if(typeof EIG!=='undefined'){ EIG=loadJSON('hkl_eigenschaften',[]); if(!Array.isArray(EIG)) EIG=[]; }
  if(typeof EIGSTD!=='undefined'){ EIGSTD=loadJSON('hkl_stdeigen',{}); if(!EIGSTD||typeof EIGSTD!=='object') EIGSTD={};
    if(typeof facCacheLeeren==='function') facCacheLeeren(); }
  /* Zweite Sicht aufs Material (features/bereiche.js) und Alternativen
     (features/alternativen.js). Die ZWEIGWAHL bleibt bewusst lokal: Sie gilt
     für den Fall, der hier gerade läuft. */
  if(typeof BEREICHE!=='undefined'){ BEREICHE=loadJSON('hkl_bereiche',[]); if(!Array.isArray(BEREICHE)) BEREICHE=[]; }
  if(typeof ALTG!=='undefined'){ ALTG=loadJSON('hkl_altgruppen',[]); if(!Array.isArray(ALTG)) ALTG=[];
    if(typeof altMaterialCacheLeeren==='function') altMaterialCacheLeeren(); }
  if(typeof ZWG!=='undefined'){ ZWG=loadJSON('hkl_zweige',{}); if(!ZWG||typeof ZWG!=='object') ZWG={}; }
  /* Pflege-Weg (features/pflege.js): Schrittliste, eigene Schritte und der
     Stand je Material. Wer am Tablet im Saal ein Foto ergänzt, soll am
     Rechner nicht dieselbe Zeile noch einmal vorgelegt bekommen. */
  if(typeof PFL!=='undefined'){ PFL=loadJSON('hkl_pflegeschritte',{}); if(!PFL||typeof PFL!=='object') PFL={}; }
  if(typeof PFLEIGEN!=='undefined'){ PFLEIGEN=loadJSON('hkl_pflegeeigen',[]); if(!Array.isArray(PFLEIGEN)) PFLEIGEN=[]; }
  if(typeof PFSTAND!=='undefined'){ PFSTAND=loadJSON('hkl_pflegestand',{}); if(!PFSTAND||typeof PFSTAND!=='object') PFSTAND={};
    if(typeof pfCacheLeeren==='function') pfCacheLeeren(); }
  if(typeof ankCacheLeeren==='function') ankCacheLeeren();
  /* Startseiten-Register und die drei neuen Seitenarten (features/seiten.js).
     Eine Bestellung, die am anderen Gerät gemeldet wurde, muss hier ankommen —
     sonst rennt doch wieder jemand durch vier Türen. */
  if(typeof SEITEN!=='undefined'){ SEITEN=loadJSON('hkl_seiten',[]); if(!Array.isArray(SEITEN)) SEITEN=[]; }
  if(typeof AUFG!=='undefined'){ AUFG=loadJSON('hkl_aufgaben',[]); if(!Array.isArray(AUFG)) AUFG=[]; }
  if(typeof AKTU!=='undefined'){ AKTU=loadJSON('hkl_aktuelles',[]); if(!Array.isArray(AKTU)) AKTU=[]; }
  if(typeof AKTARTEN!=='undefined'){ AKTARTEN=loadJSON('hkl_aktuellarten',[]); if(!Array.isArray(AKTARTEN)) AKTARTEN=[]; }
  if(typeof BEST!=='undefined'){ BEST=loadJSON('hkl_bestellungen',[]); if(!Array.isArray(BEST)) BEST=[]; }
  /* Die Symbole der Kopfleiste hängen an denselben Einstellungen — schaltet
     sie jemand am anderen Gerät ab, muss das hier ankommen. */
  if(typeof fktKopfAnwenden==='function') try{ fktKopfAnwenden(); }catch(e){}
  if(typeof frgCacheLeeren==='function') frgCacheLeeren();
  if(typeof BEZ!=='undefined'){ BEZ=loadJSON('hkl_bezeichnungen',{}); if(!BEZ||typeof BEZ!=='object') BEZ={}; }
  if(typeof GUIDES!=='undefined'){ GUIDES=loadJSON('hkl_guides',[]); if(!Array.isArray(GUIDES)) GUIDES=[]; }
  if(typeof POPUPS!=='undefined'){ POPUPS=loadJSON('hkl_popups',[]); if(!Array.isArray(POPUPS)) POPUPS=[]; }
  if(typeof VARIANTS!=='undefined'){ VARIANTS=loadJSON('hkl_variants',{aerzte:[],data:{}});
    if(!VARIANTS||typeof VARIANTS!=='object') VARIANTS={aerzte:[],data:{}};
    if(!Array.isArray(VARIANTS.aerzte)) VARIANTS.aerzte=[]; if(!VARIANTS.data) VARIANTS.data={}; }
  RULES=loadJSON('hkl_rules',[]); rebuildRulesIndex();
  HINTS=loadHints();
  GLOSSARY=loadGlossary();
  SUGGESTIONS=loadSuggestions();
  ADDITIONS=loadAdditions();
  CATALOG=loadCatalog();
  /* Inhalte & Anpassungen aus dem Verwaltungsmodus (vom Kollegen) neu einlesen */
  NEW=loadJSON('hkl_newentries',[]);
  NEWSTD=loadJSON('hkl_newstd',[]);
  NEWRUB=loadJSON('hkl_newrub',[]);
  RUBTPL=loadJSON('hkl_rubtpl',[]);
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
    /* offene Such-/Glossar-/Vorschlags-Ansichten nicht wegrendern (analog Material-Detail) */
    if($('scr-search').classList.contains('active')||$('scr-glossary').classList.contains('active')||$('scr-suggest').classList.contains('active')) return;
    /* Scanner-Hub/-Formular nicht wegrendern (analog zu Suche/Glossar) */
    if($('scr-scan').classList.contains('active')||$('scr-scan-item').classList.contains('active')) return;
    /* Neue Ansichten mit offenen Eingaben ebenso in Ruhe lassen: Anleitungs-
       Editor, Pop-up-Konfiguration, Varianten-Editor, Aufräum-Assistent. */
    const busy=['scr-guide','scr-guide-edit','scr-popups','scr-variants','scr-variant-edit','scr-cleanup','scr-form','scr-diag'];
    if(busy.some(id=>{ const el=$(id); return el&&el.classList.contains('active'); })) return;
    buildMaterialIndex();
    if(mode==='admin'){ renderAdmin(); updateBar(); return; }
    if(mode==='catalog'){ if(!formCtx){ renderCatalog(); updateBar(); } return; }
    if(mode==='care'){ renderCare(); updateBar(); return; }
    if($('scr-detail').classList.contains('active')){ const top=nav[nav.length-1]; if(top&&top.lvl==='rub'){ const i=top.idx; nav.pop(); openRubrik(i); } }
    else if($('scr-rubriken').classList.contains('active')&&curStd){ openStandard(curStd.id,true); }
    else { renderStandards($('searchInput')?$('searchInput').value:''); }
    updateBar();
  }catch(e){ /* best effort */ }
}

const sync=(()=>{
  const URL='/api/state';
  let rev=0, dirty=new Set(), timer=null, inflight=false, pending=false, enabled=false, offline=false, fails=0, oversize=false;
  function setDot(cls,title){ const d=$('syncDot'); if(d){ d.className='sync-dot '+cls; d.title=title||'Server-Status';
    /* Im „nur lokal"-Zustand Text zeigen: Status muss ohne Hover erkennbar
       sein (Touch) und darf nicht allein an der Farbe hängen (UX-Audit K4). */
    d.textContent=(cls==='local')?'lokal':''; } }
  /* Einmaliger Hinweis beim Übergang online→offline; danach spricht das
     „lokal"-Pill. Beim Wiederverbinden zeigt der grüne Punkt den Erfolg. */
  function noteOffline(){ if(offline) return; offline=true;
    try{ if(typeof toast==='function') toast('Keine Verbindung – Änderungen werden lokal gesichert und später übertragen',true); }catch(e){} }
  function payloadFor(keys){ const s={}; keys.forEach(k=>{ const v=store.get(k); if(v!=null){ try{ s[k]=JSON.parse(v); }catch(e){} } }); return s; }
  /* Übernimmt eingehende Server-Werte in den Store. Nur WIRKLICH abweichende
     Werte werden geschrieben und als Änderung gemeldet – so löst das Zurück-
     spiegeln der gerade selbst gespeicherten Schlüssel kein überflüssiges
     hydrateVars()/refreshView() aus (kein Flackern/Fokusverlust beim Tippen).
     Client wie Server serialisieren über JSON.stringify, daher sind die Strings
     vergleichbar; im Zweifel (String ungleich) wird geschrieben – nie zu wenig. */
  function adopt(st,skipDirty){ let changed=false; Object.keys(st||{}).forEach(k=>{ if(!SHARED_KEYS.includes(k)) return; if(skipDirty&&dirty.has(k)) return;
    /* Regel-Journal: append-only ⇒ VEREINIGUNG statt Ersetzen. Zwei Geräte,
       die gleichzeitig Regeln anlegen, verlieren so keine Ereignisse. Fehlen
       dem Server lokale Ereignisse, wird der vereinigte Stand zurückgespielt. */
    if(k==='hkl_rules'){
      let inc=st[k]; if(!Array.isArray(inc)) inc=[];
      const merged=rulesUnion(loadJSON('hkl_rules',[]), inc);
      const nextS=JSON.stringify(merged);
      if(store.get(k)!==nextS){ storeSetQuiet(k,nextS); changed=true; }
      if(merged.length>inc.length){ dirty.add(k); clearTimeout(timer); timer=setTimeout(flush,800); }
      return;
    }
    const next=JSON.stringify(st[k]); if(store.get(k)===next) return; storeSetQuiet(k, next); changed=true; }); return changed; }

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
    if(!r.ok){ const err=new Error('HTTP '+r.status); err.status=r.status; throw err; } const j=await r.json();
    rev=j.rev||rev; return adopt(j.state,true); /* fremde Schlüssel übernehmen (eigene dirty nicht) */
  }
  async function flush(){
    if(!enabled) return;
    if(inflight){ pending=true; return; }
    const keys=[...dirty]; if(!keys.length) return;
    dirty.clear(); inflight=true; setDot('saving','Speichere…');
    try{
      const changed=await putKeys(keys); offline=false; fails=0; oversize=false; setDot('ok','Auf dem Server gespeichert');
      if(changed && dirty.size===0){ hydrateVars(); refreshView(); }
    }catch(e){
      keys.forEach(k=>dirty.add(k));
      if(e && e.status===413){
        // Zustand größer als das Server-Limit (MAX_BODY) – typischerweise zu
        // viele/große Material-Fotos. KEIN Netzfehler: der Server ist erreichbar
        // und lehnt ab. Daher klare, handlungsleitende Meldung und langsamer
        // Wiederholtakt statt endlosem 1,5-s-Hämmern mit demselben Payload.
        oversize=true; setDot('local','Daten zu groß für den Server – lokal gesichert. Bitte Fotos verkleinern.');
      } else {
        oversize=false; noteOffline(); fails++; setDot('local','Nur lokal – Server nicht erreichbar');
      }
    }finally{
      inflight=false;
      if(pending||dirty.size){ pending=false; clearTimeout(timer);
        const delay=oversize?60000:(fails>0?Math.min(30000,2000*Math.pow(2,fails-1)):1500); timer=setTimeout(flush,delay); }
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
    }catch(e){ noteOffline(); setDot('local','Nur lokal – Server nicht erreichbar'); }
  }
  async function init(){
    setDot('saving','Verbinde…');
    try{
      const seed=await pull(); hydrateVars(); offline=false; setDot('ok','Auf dem Server gespeichert');
      if(seed.length) await putKeys(seed);
    }catch(e){ noteOffline(); setDot('local','Nur lokal – Server nicht erreichbar'); }
  }
  function start(){ enabled=true; onStoreSet=mark; setInterval(poll,15000);
    if(dirty.size) setTimeout(flush,500); /* z. B. Journal-Vereinigung aus init() nachspielen */
    window.addEventListener('online',()=>{ poll(); if(dirty.size) flush(); });
    document.addEventListener('visibilitychange',()=>{ if(!document.hidden) poll(); });
  }
  return {init,start};
})();

