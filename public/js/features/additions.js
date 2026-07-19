/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — EIGENE INHALTE (Hinzufügen / Bearbeiten)
   Neue Standards und neue Material-/Geräte-Einträge werden in einer
   eigenen Ebene `hkl_additions` gespeichert und beim Laden über die
   (unveränderte) JSON-Basis gelegt. So bleiben die Quelldaten intakt,
   die Ergänzungen werden aber wie normale Inhalte angezeigt und – wie
   alle Änderungen – zentral auf dem Server geteilt.
     { standards:[ …vollständige Standard-Objekte… ],
       entries:{ "<stdId>|<rubrikIndex>": [ …neue Einträge… ] } }
   ───────────────────────────────────────────────────────────── */
function loadAdditions(){ const a=loadJSON('hkl_additions',{standards:[],entries:{}}); if(!Array.isArray(a.standards)) a.standards=[]; if(!a.entries||typeof a.entries!=='object') a.entries={}; return a; }
function saveAdditions(){ saveJSON('hkl_additions',ADDITIONS); }
/* Eindeutige, für onclick-Interpolation ungefährliche IDs ([a-z0-9] only). */
function newAid(){ return 'a'+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
/* Wie natSlug, aber gegen eine beliebige Menge belegter IDs. `taken` ist ein
   Set oder ein Objekt; Ergebnis ist immer [a-z0-9_]+ (onclick-sicher). */
function addSlug(title,taken){ let base=(title||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')||'std';
  const has=k=>taken&&(taken.has?taken.has(k):(k in taken)); let k=base,i=2; while(has(k)){k=base+'_'+i;i++;} return k; }
/* Zerlegt eine Freitext-Synonymliste (Komma/Semikolon-getrennt) in ein
   bereinigtes Array. Rein (kein DOM/Store) – daher testbar. */
function parseSyn(str){ if(Array.isArray(str)) return str.map(s=>String(s).trim()).filter(Boolean);
  return String(str||'').split(/[,;]+/).map(s=>s.trim()).filter(Boolean); }
/* Baut aus den Formularfeldern ein normalisiertes Eintrags-Objekt. Rein
   (kein DOM/Store) – daher testbar. `f.aid` muss übergeben werden. */
function makeAddEntry(f){ const name=(f.name||'').trim(); const menge=(f.menge||'').trim();
  const mz=menge?parseInt(menge,10):null;
  /* Merkmale-Editor liefert die Größen als LISTE; die Ein-Feld-Form
     (sizeTyp/sizeVal, z. B. Katalog-Übernahme) bleibt als Fallback. */
  const val=(f.sizeVal||'').trim();
  const groessen=(Array.isArray(f.groessen)&&f.groessen.length)
    ?f.groessen.map(g=>({typ:(g.typ||'dimension'),wert:g.wert,roh:g.roh||g.wert}))
    :(val?[{typ:(f.sizeTyp||'dimension'),wert:val,roh:val}]:[]);
  const zusatz=(Array.isArray(f.zusatz)&&f.zusatz.length)?f.zusatz.map(x=>({n:x.n,w:x.w||''})):null;
  const uk=(f.uk||'').trim()||null; const spez=(f.spez||'').trim()||null;
  const syn=parseSyn(f.synonyms);
  return { roh_text:name, anzeige_text:name, menge:menge||null, menge_zahl:Number.isFinite(mz)?mz:null,
    natur:f.nat||'material', natur_konfidenz:'hoch', natur_merkmale:[], natur_manuell:null, unterkategorie:uk,
    /* Überschriften sind Gliederung, kein Material — kein material_key,
       sonst griffen Material-Regeln auf Abschnittstitel. */
    spalte:0, groessen, spezifikation:spez, zusatz_markierung:null, material_key:(f.nat==='ueberschrift')?null:(name?name.toLowerCase():null),
    color:(f.color||'').trim()||null, why:(f.why||'').trim()||null, synonyms:syn.length?syn:null, zusatz,
    /* Abschnitts-Zuordnung in Ablauf-Rubriken („＋ Eintrag in <Abschnitt>"). */
    seg:(f.seg||null),
    ist_fliesstext:false, _added:true, _aid:f.aid }; }
/* Legt die Ergänzungen über die Basis. Rein (base+add rein, neues DB raus). */
function mergeAdditions(base,add){
  const inject=(std)=>{ const rubs=std.rubriken||[]; let cloned=false;
    const newRubs=rubs.map((r,ri)=>{ const extra=add.entries[std.id+'|'+ri]; if(!extra||!extra.length) return r; cloned=true;
      return Object.assign({},r,{sub_bereiche:(r.sub_bereiche||[]).concat([{name:null,_added:true,eintraege:extra}])}); });
    return cloned?Object.assign({},std,{rubriken:newRubs}):std; };
  const baseStds=(base.standards||[]).map(inject);
  const addStds=(add.standards||[]).map(inject);
  return Object.assign({},base,{standards:baseStds.concat(addStds)}); }
/* Baut das sichtbare DB neu aus Basis + Ergänzungen und hält curStd frisch. */
function rebuildDB(){ if(!DB_BASE){ return; } DB=mergeAdditions(DB_BASE,ADDITIONS); mergeCustomIntoDB();
  if(curStd){ const c=DB.standards.find(s=>s.id===curStd.id); if(c) curStd=c; } }
function findAddEntry(sid,ri,aid){ const arr=ADDITIONS.entries[sid+'|'+ri]||[]; return arr.find(x=>x._aid===aid)||null; }

