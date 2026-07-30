/* ============ Laden ============ */
async function load(){
  applyNatConfig();
  applyDesign();
  try{ const res=await fetch(DATA_URL,{cache:'no-store'}); if(!res.ok) throw new Error('HTTP '+res.status); DB=await res.json(); if(!DB||!Array.isArray(DB.standards)) throw new Error('Struktur ungültig'); }
  catch(e){ DB=DEMO; setTimeout(()=>toast('Keine Standards-Datei gefunden – Demodaten aktiv',true),400); }
  DB_BASE=DB; rebuildDB(); /* eigene Standards/Einträge (Server) + App-eigene Standards (lokal) über die Basis legen */
  buildMaterialIndex(); checkAdminHash(); applyAdminUI(); try{ history.replaceState({d:0},''); }catch(e){} applyDeepLink(); renderStandards(); updateBar();
  loadMaterialData();  /* Referenz-Katalog + Aufräum-Vorschläge (tolerant, nicht blockierend) */
}

/* Lädt die mitgelieferten Material-Datendateien (Baustein 1+2). Bewusst NACH dem
   Render und tolerant: fehlt eine Datei, bleibt die App voll bedienbar. */
async function loadMaterialData(){
  try{ const r=await fetch('data/material_catalog.json',{cache:'no-store'}); if(r.ok && typeof catSetData==='function') catSetData(await r.json()); }catch(e){}
  try{ const r=await fetch('data/cleanup_suggestions.json',{cache:'no-store'}); if(r.ok && typeof cleanupSetData==='function') cleanupSetData(await r.json()); }catch(e){}
  try{ const r=await fetch('data/merkmale.json',{cache:'no-store'}); if(r.ok && typeof merkSetData==='function') merkSetData(await r.json()); }catch(e){}
  try{ const r=await fetch('data/zerlegung.json',{cache:'no-store'}); if(r.ok && typeof zerlSetData==='function') zerlSetData(await r.json()); }catch(e){}
  /* WICHTIG: Diese Kataloge kommen NACH dem ersten Rendern an. Bis dahin hat
     buildMaterialIndex() für jede Stelle „keine Zerlegung" zwischengespeichert
     — und würde das behalten. Also: Speicher verwerfen und den Materialindex
     neu aufbauen, sonst wirkt der Zerlegungs-Katalog erst beim nächsten Start.
     (Genau dieser Fehler ist im End-to-End-Test aufgefallen, nicht im
     Unit-Test: In Node lag der Katalog immer schon vor.) */
  if(typeof matKeyCacheLeeren==='function'){
    matKeyCacheLeeren();
    if(typeof buildMaterialIndex==='function') buildMaterialIndex();
    try{ if(typeof mode!=='undefined' && mode==='use' && typeof nav!=='undefined' && !nav.length && typeof renderStandards==='function') renderStandards($('searchInput')?$('searchInput').value:''); }catch(e){}
  }
}

/* ============ Material-Index ============ */
function buildMaterialIndex(){
  if(typeof invalidateMatCaches==='function') invalidateMatCaches();
  const map=new Map();
  DB.standards.forEach(std=>{ (std.rubriken||[]).forEach((rub,ri)=>{ (rub.sub_bereiche||[]).forEach((sb,si)=>{ (sb.eintraege||[]).forEach((e,ei)=>{
    if(e.ist_fliesstext) return; const cid=cidOf(std.id,ri,si,ei); if(qeGet(e,cid,'hidden')===true) return; const nat=effNatur(e,cid);
    if(!natOf(nat).beschaffbar) return;
    /* Identität kommt aus der Zerlegung, wenn es eine gibt — sonst wie bisher
       aus material_key. Eine als Tätigkeit erkannte Zeile („Raumkontrolle")
       liefert KEINEN Schlüssel und taucht damit nicht mehr als Material auf. */
    const key=(typeof effMatKey==='function')?effMatKey(e,cid):e.material_key; if(!key) return;
    const z=(typeof zerlFuer==='function')?zerlFuer(e,cid):null;
    const anz=(z&&z.art==='produkt'&&z.produkt)?z.produkt.name:(e.anzeige_text||key);
    if(!map.has(key)) map.set(key,{key,name:anz,typ:nat,vorkommen:0,groessen:e.groessen||[]}); map.get(key).vorkommen++;
  }); }); }); });
  MAT_INDEX=[...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'de'));
}

