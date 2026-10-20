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
const SHARED_KEYS=['hkl_natcfg','hkl_overrides','hkl_qedits','hkl_reassign','hkl_ukmap','hkl_ukmeta','hkl_settings','hkl_care','hkl_prod','hkl_hints','hkl_glossary','hkl_suggestions','hkl_additions','hkl_catalog',
  /* Inhalte & Anpassungen aus dem Verwaltungsmodus (vom Kollegen) – jetzt ebenfalls zentral geteilt */
  'hkl_newentries','hkl_newstd','hkl_newrub','hkl_rubtpl','hkl_stdedits','hkl_rubedits','hkl_entryorder','hkl_txt','hkl_design','hkl_grpord','hkl_rubicon','hkl_authpw','hkl_uksections',
  /* Produktdatenbank aus dem Etikett-Scanner (GTIN-Schlüssel) + Aufräum-Fortschritt */
  'hkl_gtin','hkl_matlink','hkl_matprops','hkl_cleanup_done',
  /* Anleitungen, konfigurierbare Pop-ups und Arzt-Varianten (Inhalte – geteilt) */
  'hkl_guides','hkl_popups','hkl_variants','hkl_ocrlearn','hkl_diag','hkl_zerlegung','hkl_dubl_ok','hkl_geraete','hkl_bezeichnungen','hkl_bausteine','hkl_funktionen','hkl_medientexte','hkl_medienanker','hkl_stdkopf','hkl_eigenschaften','hkl_stdeigen','hkl_bereiche','hkl_altgruppen','hkl_zweige','hkl_bausammlung','hkl_bausteinkats','hkl_fassungen','hkl_pflegeschritte','hkl_pflegeeigen','hkl_pflegestand','hkl_seiten','hkl_aufgaben','hkl_aktuelles','hkl_aktuellarten','hkl_bestellungen','hkl_bestlern','hkl_bildorte','hkl_hartweg',
  /* Zweitpasswort für den Neuaufbau (features/raum.js) — nur der Fingerabdruck —
     und welche Neuerungen des Neuaufbaus auch im Bestand gelten */
  'hkl_raumpw','hkl_neufrei',
  /* Notizen, die beim Neuaufbau anfallen (features/notizen.js) */
  'hkl_notizen',
  /* Regel-Journal der Verwaltungspolitik (append-only; adopt() VEREINIGT statt zu überschreiben) */
  'hkl_rules'];

/* Übernimmt die (ggf. vom Server aktualisierten) Store-Werte in die
   laufenden Zustandsvariablen. */
function hydrateVars(){
  NATCFG=loadNatCfg();
  overrides=loadJSON('hkl_overrides',{});
  QE=loadJSON('hkl_qedits',{cid:{},mat:{}}); if(!QE.cid)QE.cid={}; if(!QE.mat)QE.mat={};
  reassign=loadJSON('hkl_reassign',{});
  ukMap=loadJSON('hkl_ukmap',{});
  ukMeta=loadJSON('hkl_ukmeta',{});
  UKSEC=loadJSON('hkl_uksections',{});
  settings=Object.assign({menge:true,groessen:true,spez:true,lagerort:true,fliesstext:true,zerlegung:true}, loadJSON('hkl_settings',{}));
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
  if(typeof HARTWEG!=='undefined'){ HARTWEG=loadJSON('hkl_hartweg',[]); if(!Array.isArray(HARTWEG)) HARTWEG=[]; }
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
  if(typeof BESTLERN!=='undefined'){ BESTLERN=loadJSON('hkl_bestlern',{}); if(!BESTLERN||typeof BESTLERN!=='object'||Array.isArray(BESTLERN)) BESTLERN={}; }
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
  /* Freigegebene Neuerungen (features/raum.js) — schaltet sie jemand frei,
     erscheinen sie auf jedem Gerät des Bestands beim nächsten Zeichnen. */
  if(typeof NEUFREI!=='undefined'){ NEUFREI=loadJSON('hkl_neufrei',{}); if(typeof neuFreiNormal==='function') neuFreiNormal(); }
  if(typeof NOTIZEN!=='undefined'){ NOTIZEN=loadJSON('hkl_notizen',[]); if(typeof notizNormal==='function') notizNormal();
    if(typeof notizZaehlerZeigen==='function') notizZaehlerZeigen(); }
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
    /* Der Editor zeichnet sich selbst neu — außer mitten in einem Zug oder
       während getippt wird (features/editor.js). */
    if($('scr-editor')&&$('scr-editor').classList.contains('active')){ if(typeof edAuffrischen==='function') edAuffrischen(); return; }
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
  /* Raum (core/store.js): Für den Bestand ist die Adresse dieselbe wie immer;
     der Neuaufbau nennt sich ausdrücklich (…?raum=neuaufbau). */
  const URL='/api/state'+raumParam();
  let rev=0, dirty=new Set(), timer=null, inflight=false, pending=false, enabled=false, offline=false, fails=0, oversize=false;
  /* ── Raum-Wache ─────────────────────────────────────────────────────────
     Ein Gerät im Neuaufbau darf erst dann mit dem Server tauschen, wenn der
     Server den Raum KENNT. Ein Server ohne Räume (etwa nach dem Zurückspielen
     einer alten Fassung) überginge die Raumangabe und antwortete mit dem
     Bestand — und schlimmer: Er nähme Neuaufbau-Daten als Bestandsdaten an.
     Deshalb: erst bestätigen (GET /api/raeume), dann tauschen; und jede
     Antwort muss den Raum nennen, den das Gerät gemeint hat. Für den Bestand
     gilt die Wache als erfüllt — dort ändert sich nichts. */
  let raumOk=(RAUM.id==='bestand'), raumGesperrt=false;
  function raumFehler(text){ const e=new Error(text); e.raum=true; return e; }
  function antwortRaumPruefen(j){
    if(RAUM.id!=='bestand' && (!j || j.raum!==RAUM.id)){ raumOk=false; throw raumFehler('Antwort ohne Bestätigung des Raums „'+RAUM.titel+'"'); }
  }
  async function raeumeAbfragen(){
    const r=await fetch('/api/raeume',{cache:'no-store'});
    if(!r.ok){ const e=new Error('HTTP '+r.status); e.status=r.status; throw e; }
    return r.json();
  }
  /* Bestätigt den eigenen Raum und folgt — nur auf Geräten ohne eigene Wahl —
     dem Live-Zeiger des Servers. Gibt false zurück, wenn die Seite gleich
     neu lädt (dann soll nichts mehr getauscht werden).
     `neuLaden` false: nur merken und das Band zeigen, nicht neu laden — für
     Blicke im laufenden Betrieb, die niemanden mitten im Tippen aus der
     Arbeit reißen dürfen. */
  async function raumAbgleich(neuLaden){
    let j=null;
    try{ j=await raeumeAbfragen(); }
    catch(e){
      /* Server ohne Räume: Für den Bestand egal (er spricht ihn wie immer an),
         für den Neuaufbau ein Halt — siehe Raum-Wache. */
      if(RAUM.id!=='bestand' && e && e.status===404){ raumGesperrt=true; raumOk=false; }
      if(RAUM.id!=='bestand') throw e;
      return true;
    }
    const liste=(j&&Array.isArray(j.raeume))?j.raeume:[];
    if(RAUM.id!=='bestand'){
      if(!liste.some(x=>x&&x.id===RAUM.id)){ raumGesperrt=true; raumOk=false; throw raumFehler('Server kennt den Raum nicht'); }
      raumOk=true; raumGesperrt=false;
    }
    if(j && raumBekannt(j.live)){
      raumLiveMerken(j.live);
      /* Die eigene Wahl IST jetzt der Live-Raum (er wurde umgeschaltet):
         Wahl aufgeben — das Gerät folgt ab dem nächsten Laden wieder dem
         Zeiger und damit auch einem späteren Zurückschalten. */
      if(RAUM.wahl && RAUM.wahl===j.live) raumWaehlen(null);
      if(!RAUM.gewaehlt && j.live!==RAUM.id && neuLaden!==false){
        try{ if(typeof diagLog==='function') diagLog('system','Live-Raum gewechselt: '+RAUM.id+' → '+j.live); }catch(x){}
        try{ location.reload(); }catch(x){}
        return false;
      }
      /* Das Band („nicht im Live-Raum") hängt am Live-Raum — neu bewerten. */
      try{ if(typeof raumLeisteZeigen==='function') raumLeisteZeigen(); }catch(x){}
    }
    return true;
  }
  function setDot(cls,title,wort){ const d=$('syncDot'); if(d){ d.className='sync-dot '+cls; d.title=title||'Server-Status';
    /* Im „nur lokal"-Zustand Text zeigen: Status muss ohne Hover erkennbar
       sein (Touch) und darf nicht allein an der Farbe hängen (UX-Audit K4).
       Das Wort ist übersteuerbar, weil hinter demselben Pill ZWEI verschiedene
       Lagen stecken: „kein Netz" geht von selbst vorbei, „zu groß" nie. Wer
       das nicht unterscheiden kann, wartet auf eine Verbindung, die längst da
       ist. Der ganze Satz steht weiterhin im Tooltip bzw. im Toast beim
       Antippen (ui/chrome.js). */
    d.textContent=(cls==='local')?(wort||'lokal'):''; } }
  /* Einmaliger Hinweis beim Übergang online→offline; danach spricht das
     „lokal"-Pill. Beim Wiederverbinden zeigt der grüne Punkt den Erfolg. */
  function noteOffline(){ if(offline) return; offline=true;
    try{ if(typeof toast==='function') toast('Keine Verbindung – Änderungen werden lokal gesichert und später übertragen',true); }catch(e){} }
  function payloadFor(keys){ const s={}; keys.forEach(k=>{ const v=store.get(k); if(v!=null){ try{ s[k]=JSON.parse(v); }catch(e){} } }); return s; }

  /* ── Wenn der Server ablehnt, muss die App sagen KÖNNEN, was zu groß ist ──
     Vorher lautete die Meldung „Bitte Fotos verkleinern". Das war ein Rat ins
     Blaue und im Zweifel schlicht falsch: Fotos werden beim Aufnehmen bereits
     auf 1280 px verkleinert (features/care.js), ein Handyfoto schrumpft dabei
     von 8,8 MB auf 327 KB. Wer daraufhin „noch kleiner" macht, sucht an der
     falschen Stelle — und der wirkliche Grund (ein Schlüssel, der zu viele
     Bilder trägt) bleibt unsichtbar.
     Deshalb wird ab jetzt GEMESSEN und BENANNT. */
  function kb(n){ return Math.round(n/1024); }
  function groesseJeSchluessel(keys){
    return keys.map(k=>{ const v=store.get(k); return { k, b:(v==null?0:v.length) }; })
      .sort((a,b)=>b.b-a.b);
  }
  /* Ein Satz, der zum Handeln taugt: Gesamtumfang und der dickste Schlüssel. */
  function zuGrossText(keys, gesamt){
    const gr=groesseJeSchluessel(keys)[0];
    const wo=gr&&gr.b?(' Größter Posten: '+gr.k+' mit '+kb(gr.b)+' KB.'):'';
    return 'Der Server hat '+kb(gesamt)+' KB abgelehnt — lokal gesichert.'+wo
      +' Bilder gehören in den Medienspeicher, nicht in den geteilten Zustand.';
  }
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
    antwortRaumPruefen(j);
    rev=j.rev||0; const st=j.state||{}; adopt(st,false);
    // rein lokale Schlüssel, die der Server noch nicht kennt → Erstbefüllung
    const seed=SHARED_KEYS.filter(k=>store.get(k)!=null && !(k in st));
    return seed;
  }
  async function putKeys(keys){
    if(!keys.length) return false;
    const body=JSON.stringify({baseRev:rev, state:payloadFor(keys)});
    const r=await fetch(URL,{method:'PUT',headers:{'Content-Type':'application/json'},body});
    if(!r.ok){ const err=new Error('HTTP '+r.status); err.status=r.status; err.bytes=body.length; err.keys=keys.slice(); throw err; } const j=await r.json();
    antwortRaumPruefen(j);
    rev=j.rev||rev; return adopt(j.state,true); /* fremde Schlüssel übernehmen (eigene dirty nicht) */
  }
  async function flush(){
    if(!enabled) return;
    if(inflight){ pending=true; return; }
    const keys=[...dirty]; if(!keys.length) return;
    /* Raum-Wache: ohne Bestätigung kein Schreiben (Daten bleiben lokal und in
       `dirty`, der nächste Takt versucht es wieder). */
    if(!raumOk){
      if(raumGesperrt){ setDot('local','Server kennt den Raum „'+RAUM.titel+'“ nicht – nur lokal gesichert'); return; }
      /* Hier nie neu laden: Was gerade geändert wurde, gehört in DIESEN Raum. */
      try{ if(!(await raumAbgleich(false))) return; }
      catch(e){ noteOffline(); setDot('local','Nur lokal – Server nicht erreichbar'); clearTimeout(timer); timer=setTimeout(flush, 15000); return; }
    }
    /* Steht eine Ablehnung im Raum, bleibt sie stehen. Ein „Speichere…" darüber
       würde den einzigen Hinweis verdecken, der zur Lösung führt — und genau
       das ist passiert: Die Diagnose stand da, wurde aber vom nächsten
       Schreibvorgang binnen einer Sekunde überschrieben. */
    dirty.clear(); inflight=true; if(!oversize) setDot('saving','Speichere…');
    try{
      const changed=await putKeys(keys); offline=false; fails=0; oversize=false; setDot('ok','Auf dem Server gespeichert');
      if(changed && dirty.size===0){ hydrateVars(); refreshView(); }
    }catch(e){
      keys.forEach(k=>dirty.add(k));
      if(e && e.status===413){
        // Der Server ist erreichbar und lehnt ab — KEIN Netzfehler. Daher ein
        // langsamer Wiederholtakt statt endlosem 1,5-s-Hämmern mit demselben
        // Payload, und vor allem: eine Meldung, die den Posten BENENNT statt
        // pauschal „Fotos verkleinern" zu raten (siehe zuGrossText).
        oversize=true;
        const text=zuGrossText(e.keys||keys, e.bytes||0);
        setDot('local', text, 'zu groß');
        /* Ins Protokoll, damit der Fall nachher auffindbar ist statt nur als
           Meldung vorbeizuziehen (features/diag.js). */
        try{ if(typeof diagLog==='function') diagLog('fehler', text); }catch(x){}
      } else {
        oversize=false; noteOffline(); fails++; setDot('local','Nur lokal – Server nicht erreichbar');
      }
    }finally{
      inflight=false;
      if(pending||dirty.size){ pending=false; clearTimeout(timer);
        const delay=oversize?60000:(fails>0?Math.min(30000,2000*Math.pow(2,fails-1)):1500); timer=setTimeout(flush,delay); }
    }
  }
  function mark(k){ if(!enabled||!SHARED_KEYS.includes(k)) return; dirty.add(k); if(!offline&&!oversize) setDot('saving','Speichere…'); clearTimeout(timer);
    /* Bei einer Ablehnung nicht im 800-ms-Takt denselben zu großen Umfang
       nachschieben — das erzeugt nur Last und dieselbe Antwort. */
    timer=setTimeout(flush, oversize?60000:800); }
  async function poll(){
    if(!enabled||inflight||dirty.size) return;
    if(raumGesperrt) return;
    try{
      if(!raumOk && !(await raumAbgleich(false))) return;
      const r=await fetch(URL+(URL.indexOf('?')<0?'?':'&')+'since='+rev,{cache:'no-store'}); if(!r.ok) throw new Error('HTTP '+r.status); const j=await r.json();
      antwortRaumPruefen(j);
      offline=false;
      if(j.unchanged){ setDot('ok','Auf dem Server gespeichert'); return; }
      rev=j.rev||rev; const changed=adopt(j.state,true);
      if(changed && !dirty.size){ hydrateVars(); refreshView(); }
      setDot('ok','Auf dem Server gespeichert');
    }catch(e){ noteOffline(); setDot('local','Nur lokal – Server nicht erreichbar'); }
  }
  /* ── Erstbefüllung in Häppchen statt in einem Bissen ──────────────────
     Vorher ging der gesamte lokale Bestand in EINER Anfrage hoch. Auf einem
     Gerät, das schon Material- und Anleitungsfotos trug, konnte allein diese
     eine Anfrage das Limit reißen — und dann kam der zweite Fehler zum Tragen:
     Die Schlüssel standen nie in `dirty`, ein Fehlschlag verlor sie also
     ersatzlos. Das Gerät blieb dauerhaft auf „lokal", ohne dass je wieder ein
     Versuch gestartet wurde. Jetzt wandern sie in kleinen Bündeln, und was
     scheitert, kommt in `dirty` und wird vom normalen Takt erneut versucht. */
  const SEED_BUENDEL = 512*1024;
  async function seedHochladen(keys){
    let buendel=[], summe=0, fehler=0;
    const senden=async()=>{
      if(!buendel.length) return;
      const teil=buendel; buendel=[]; summe=0;
      try{ await putKeys(teil); }
      catch(e){
        fehler++;
        teil.forEach(k=>dirty.add(k));         /* nie verlieren */
        if(e && e.status===413){
          oversize=true;
          const t=zuGrossText(teil, e.bytes||0);
          setDot('local', t, 'zu groß');
          try{ if(typeof diagLog==='function') diagLog('fehler', t); }catch(x){}
        }
      }
    };
    for(const g of groesseJeSchluessel(keys)){
      buendel.push(g.k); summe+=g.b;
      if(summe>=SEED_BUENDEL) await senden();
    }
    await senden();
    if(fehler && dirty.size){ clearTimeout(timer); timer=setTimeout(flush, 3000); }
  }

  async function init(){
    setDot('saving','Verbinde…');
    try{
      if(!(await raumAbgleich())) return;     /* lädt gleich neu (Live-Raum gewechselt) */
      const seed=await pull(); hydrateVars(); offline=false; setDot('ok','Auf dem Server gespeichert');
      if(seed.length) await seedHochladen(seed);
    }catch(e){
      if(raumGesperrt){ setDot('local','Server kennt den Raum „'+RAUM.titel+'“ nicht – nur lokal gesichert');
        try{ if(typeof diagLog==='function') diagLog('fehler','Raum „'+RAUM.titel+'“ vom Server nicht bestätigt – Abgleich angehalten'); }catch(x){}
        return; }
      noteOffline(); setDot('local','Nur lokal – Server nicht erreichbar'); }
  }
  /* Sofort alles Offene an den Server geben (vor einem Raumwechsel). Wartet
     höchstens `ms` Millisekunden — ein Wechsel darf nie am Netz hängen
     bleiben; was nicht ankam, bleibt lokal im Raum und geht beim nächsten
     Betreten hoch. */
  async function leeren(ms){
    clearTimeout(timer);
    const lauf=(async()=>{ while(inflight) await new Promise(r=>setTimeout(r,50)); await flush(); })();
    await Promise.race([lauf, new Promise(r=>setTimeout(r, ms||3000))]);
  }
  /* Wie lange niemand das Gerät bedient haben darf, bevor es von selbst in
     einen neu live geschalteten Raum wechselt. */
  const LIVE_RUHE=120000;
  let bedient=Date.now();
  function start(){ enabled=true; onStoreSet=mark; setInterval(poll,15000);
    if(dirty.size) setTimeout(flush,500); /* z. B. Journal-Vereinigung aus init() nachspielen */
    window.addEventListener('online',()=>{ poll(); if(dirty.size) flush(); });
    /* Beim Aufwachen des Tablets auch den Live-Zeiger nachsehen — nur Geräte
       ohne eigene Raumwahl folgen ihm (siehe raumAbgleich); bei allen
       anderen kommt das Band auf den Stand. */
    document.addEventListener('visibilitychange',()=>{ if(document.hidden) return;
      raumAbgleich().catch(()=>{});
      poll(); });
    /* Auch im laufenden Betrieb jede Minute nach dem Live-Zeiger sehen — ein
       Rechner, auf dem die App den ganzen Tag offen steht, wacht nie auf.
       Wer gerade bedient, wird dabei NICHT neu geladen: Er sieht das Band
       „nicht live" mit dem Knopf zum Wechseln (features/raum.js). Von selbst
       gewechselt wird erst nach zwei Minuten Ruhe und ohne Offenes. */
    ['pointerdown','keydown','input','wheel'].forEach(ev=>{
      try{ window.addEventListener(ev,()=>{ bedient=Date.now(); },{capture:true,passive:true}); }catch(e){} });
    setInterval(()=>{
      if(document.hidden||raumGesperrt) return;
      const ruhig=(Date.now()-bedient>=LIVE_RUHE) && !dirty.size && !inflight;
      raumAbgleich(ruhig).catch(()=>{});
    }, 60000);
  }
  return {init,start,leeren};
})();

