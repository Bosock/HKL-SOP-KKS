/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — MATERIAL-STAMM (Destillation + Zuordnung + Eigenschaften)
   Trennt Identität (Stammsatz = GTINDB-Produkt bzw. manueller Stammsatz) vom
   Vorkommen im Standard. `hkl_matlink` ordnet material_key → Stammsatz-ID zu
   (reine Verweis-Ebene, nicht-destruktiv, rücknehmbar). `hkl_matprops` ist ein
   wachsendes Schema eigener Eigenschaften (z. B. „Tip Load"), das an jedem
   Stammsatz als Feld erscheint. Siehe docs/KONZEPT-MATERIALSTAMM.md.
   ───────────────────────────────────────────────────────────── */

let MATLINK=loadJSON('hkl_matlink',{});     /* material_key -> Stammsatz-ID (gtin oder 'm:...') */
let MATPROPS=loadJSON('hkl_matprops',[]);   /* [{key,label}] – wachsendes Eigenschaften-Schema */
if(!Array.isArray(MATPROPS)) MATPROPS=[];
function saveMatlink(){ saveJSON('hkl_matlink',MATLINK); }
function saveMatprops(){ saveJSON('hkl_matprops',MATPROPS); }

/* ===== Reine, testbare Helfer ===== */
/* Schlüssel aus einem Eigenschafts-Label ([a-z0-9_], gegen Kollisionen). */
function matPropSlug(label, taken){
  let base=(label||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')||'prop';
  const has=(k)=>Array.isArray(taken)?taken.some(p=>p.key===k):false;
  let k=base,i=2; while(has(k)){ k=base+'_'+i; i++; } return k;
}
/* Normalform eines Materialnamens für die Duplikat-Erkennung: Größen/Einheiten
   raus, Sonderzeichen zu Leerzeichen, Tokens eindeutig + sortiert. Rein. */
function matNormName(s){
  s=(s||'').toString().toLowerCase();
  s=s.replace(/\b\d+([.,]\d+)?\s?(f|fr|french|ch|cm|mm|m|ml|g|gg|zoll|in|inch)\b/g,' ');
  s=s.replace(/\b\d+([.,]\d+)?\b/g,' ');
  s=s.replace(/[^a-z0-9äöüß]+/g,' ').trim();
  const stop=new Set(['der','die','das','und','für','fur','mit','aus','zur','zum','im','st','pcs','stk']);
  const toks=[...new Set(s.split(/\s+/).filter(t=>t.length>1&&!stop.has(t)))].sort();
  return toks.join(' ');
}
/* Gruppen von material_keys mit gleicher Normalform (Kandidaten fürs
   Zusammenführen). Eingabe: [{key,name}] → [[key,key,...]] (Größe ≥ 2). Rein. */
function matSuggestGroups(list){
  const m=new Map();
  (list||[]).forEach(x=>{ const n=matNormName(x.name); if(!n) return; if(!m.has(n)) m.set(n,[]); m.get(n).push(x.key); });
  return [...m.values()].filter(g=>g.length>=2);
}

/* Distinkte Material-Vorkommen (nach material_key) aus allen Standards, mit
   Anzeigename + Häufigkeit. Grundlage für Zusammenführung/Destillation. Braucht
   DB (app-state); ohne DB leere Liste. */
function matDistinctList(){
  if(typeof DB==='undefined'||!DB||!DB.standards) return [];
  const m=new Map();
  DB.standards.forEach(std=>{ (std.rubriken||[]).forEach(r=>{
    if(r.typ!=='material'&&r.typ!=='geraete') return;
    (r.sub_bereiche||[]).forEach(sb=>{ (sb.eintraege||[]).forEach(e=>{
      if(!e||!e.material_key||e.natur==='ueberschrift'||e.ist_fliesstext) return;
      const k=e.material_key; if(!m.has(k)) m.set(k,{key:k,name:(e.anzeige_text||k),count:0});
      m.get(k).count++;
    }); });
  }); });
  return [...m.values()].sort((a,b)=>(a.name||'').localeCompare(b.name||'','de'));
}

/* ===== Zustand-Operationen ===== */
function matPropAdd(label){ label=(label||'').trim(); if(!label) return null;
  const ex=MATPROPS.find(p=>(p.label||'').toLowerCase()===label.toLowerCase()); if(ex) return ex.key;
  const key=matPropSlug(label, MATPROPS); MATPROPS.push({key,label}); saveMatprops(); return key; }
/* Stammsatz zu einem material_key (oder null). Braucht GTINDB (scanner.js). */
function canonOf(materialKey){ if(!materialKey||typeof GTINDB==='undefined') return null;
  const id=MATLINK[materialKey]; if(!id) return null; return GTINDB[id]||null; }
function canonId(materialKey){ return (materialKey&&MATLINK[materialKey])||null; }
function matLinkTo(materialKey, id){ if(!materialKey||!id) return; MATLINK[materialKey]=id; saveMatlink(); }
function matUnlink(materialKey){ if(materialKey in MATLINK){ delete MATLINK[materialKey]; saveMatlink(); } }
/* Legt einen manuellen Stammsatz (ohne Barcode) aus einem Namen an und gibt
   dessen ID zurück. Wird in GTINDB als normales Produkt geführt (Schlüssel
   'm:...'), damit Anzeige/Bearbeiten/Sync identisch funktionieren. */
function matCreateStamm(name, seed){ if(typeof GTINDB==='undefined') return null;
  const id='m:'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const now=new Date().toISOString();
  GTINDB[id]=Object.assign({ gtin:id, manual:true, name:(name||'').trim()||'Material',
    hersteller:null, ref:null, verwendung:null, french:null, laenge:null,
    dAussen:null, dInnen:null, weitere:null, lagerort:null, preis:null, photo:null,
    props:{}, createdAt:now, updatedAt:now }, seed||{});
  if(typeof saveGtinDB==='function') saveGtinDB();
  return id; }
