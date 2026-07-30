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

/* Ähnlichkeit zweier Schlüssel als Wert zwischen 0 und 1 (Levenshtein,
   längennormiert). Rein. `levenshtein` liegt in features/ocr.js. */
function matAehnlich(a, b){
  a = String(a||''); b = String(b||'');
  if(!a || !b) return 0;
  if(a === b) return 1;
  const max = Math.max(a.length, b.length);
  if(typeof levenshtein !== 'function') return 0;
  return 1 - (levenshtein(a, b) / max);
}

/* BEINAH-Dubletten: Paare, die sich nur um Tippfehler unterscheiden.
   `matSuggestGroups` findet sie prinzipbedingt NICHT — es vergleicht die
   Normalform, und „coro"/„koro" oder „distal"/„disatal" haben verschiedene
   Normalformen. Genau das sind aber die Fälle, die im Bestand vorkommen:

     blazer ii xp large curve std distal  ↔  … std disatal
     große coro-set-schale …              ↔  große koro-set-schale …
     jr 4 diagnostikkatheter              ↔  jr4 diagnostikkatheter

   Jedes Paar ist heute zwei Materialien mit getrennter Pflege, getrenntem
   Foto, getrenntem Preis. Bewusst NICHT automatisch zusammengeführt — ein
   Tippfehler und eine echte Variante sehen gleich aus („Navitor 23"/„Navitor 25"),
   und nur ein Mensch kennt den Unterschied. Deshalb: Vorschlagsliste.

   Eingabe [{key,name,count}] → [{a,b,aName,bName,naehe,wirkung}], stärkste
   Ähnlichkeit zuerst. Rein. */
function matDubletten(list, minNaehe){
  const schwelle = (minNaehe==null) ? 0.88 : minNaehe;
  const xs = (list||[]).filter(x=>x && x.key);
  const paare = [];
  for(let i=0;i<xs.length;i++){
    for(let j=i+1;j<xs.length;j++){
      const a=xs[i], b=xs[j];
      /* Nur ähnlich LANGE Schlüssel vergleichen — das spart den teuren
         Abstand für offensichtlich Verschiedenes (quadratische Schleife). */
      if(Math.abs(a.key.length-b.key.length) > 4) continue;
      const n = matAehnlich(a.key, b.key);
      if(n < schwelle || n === 1) continue;
      paare.push({ a:a.key, b:b.key, aName:a.name||a.key, bName:b.name||b.key,
        naehe:Math.round(n*1000)/1000, wirkung:(a.count||0)+(b.count||0) });
    }
  }
  return paare.sort((x,y)=>(y.naehe-x.naehe)||(y.wirkung-x.wirkung));
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
  const id=canonId(materialKey); if(!id) return null; return GTINDB[id]||null; }
/* Liest die Verknüpfung über den kanonischen Schlüssel UND alle Alt-Schreib-
   weisen (features/matkey.js). So findet eine Zeile, die früher „map 152"
   hieß, den Stammsatz, der unter „map152" verknüpft wurde — ohne dass
   irgendetwas umgeschrieben werden musste. */
function canonId(materialKey){ if(!materialKey) return null;
  if(MATLINK[materialKey]) return MATLINK[materialKey];
  if(typeof matKeyLesen==='function'){ const v=matKeyLesen(MATLINK, materialKey); if(v) return v; }
  return null; }
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
