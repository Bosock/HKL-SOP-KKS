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
}

/* ============ Material-Index ============ */
function buildMaterialIndex(){
  const map=new Map();
  DB.standards.forEach(std=>{ (std.rubriken||[]).forEach((rub,ri)=>{ (rub.sub_bereiche||[]).forEach((sb,si)=>{ (sb.eintraege||[]).forEach((e,ei)=>{
    if(e.ist_fliesstext) return; const cid=cidOf(std.id,ri,si,ei); if(qeGet(e,cid,'hidden')===true) return; const nat=effNatur(e,cid);
    if(!natOf(nat).beschaffbar) return; const key=e.material_key; if(!key) return;
    if(!map.has(key)) map.set(key,{key,name:e.anzeige_text||key,typ:nat,vorkommen:0,groessen:e.groessen||[]}); map.get(key).vorkommen++;
  }); }); }); });
  MAT_INDEX=[...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'de'));
}

