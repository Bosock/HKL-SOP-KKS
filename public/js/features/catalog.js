/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — KATALOG (Geräte- & Material-Übersicht)
   Ein von den Standards unabhängiger Bestand aller Geräte und
   Materialien. Hier legt man Einträge einmalig an und pflegt sie;
   an anderer Stelle (in den Rubriken der Standards) lassen sie sich
   per „Aus Katalog übernehmen" einfügen. Gespeichert unter dem
   Schlüssel `hkl_catalog` und – wie alle Änderungen – zentral auf
   dem Server geteilt.
     { items:[ {id,name,nat,menge,sizeTyp,sizeVal,uk} … ] }
   ───────────────────────────────────────────────────────────── */
function loadCatalog(){ const c=loadJSON('hkl_catalog',{items:[]}); if(!c||typeof c!=='object'||!Array.isArray(c.items)) return {items:[]}; return c; }
function saveCatalog(){ saveJSON('hkl_catalog',CATALOG); }
/* Baut aus den Formularfeldern ein normalisiertes Katalog-Objekt. Rein
   (kein DOM/Store) – daher testbar. `f.id` muss übergeben werden. */
function makeCatalogItem(f){ const name=(f.name||'').trim(); const menge=(f.menge||'').trim(); const val=(f.sizeVal||'').trim(); const uk=(f.uk||'').trim();
  return { id:f.id, name, nat:f.nat||'material', menge:menge||null, sizeTyp:val?(f.sizeTyp||'dimension'):null, sizeVal:val||null, uk:uk||null }; }
/* Übersetzt ein Katalog-Objekt in ein Formular-Objekt (für Bearbeiten und
   für die Übernahme in Standards, die makeAddEntry füttert). Rein/testbar. */
function catalogToForm(item){ return { name:item.name||'', menge:item.menge||'', nat:item.nat||'material', sizeTyp:item.sizeTyp||'', sizeVal:item.sizeVal||'', uk:item.uk||'' }; }
/* Fügt ein Katalog-Objekt ein oder ersetzt das mit gleicher id. Gibt ein
   NEUES Array zurück (mutiert `items` nicht). Rein/testbar. */
function upsertCatalogItem(items,item){ const arr=(items||[]).slice(); const i=arr.findIndex(x=>x.id===item.id); if(i>=0) arr[i]=item; else arr.push(item); return arr; }
/* Entfernt das Katalog-Objekt mit dieser id. Gibt ein NEUES Array zurück. Rein/testbar. */
function removeCatalogItem(items,id){ return (items||[]).filter(x=>x.id!==id); }
/* Kanonischer Vergleichsschlüssel für „fast gleiche" Texte: Kleinschreibung,
   Umlaute gefaltet, alle Nicht-Alphanumerischen (Leerzeichen/Satzzeichen)
   entfernt. So gelten „Radial-Schleuse", „Radial Schleuse" und
   „radialschleuse" als derselbe Name. Rein/testbar. */
function canonCatalogName(s){ return (s==null?'':''+s).toLowerCase()
  .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
  .replace(/[^a-z0-9]+/g,''); }
/* Gruppiert Katalog-Einträge, die als Duplikate/fast-gleich gelten: gleiche
   Natur + gleicher kanonischer Name + gleiche kanonische Größe. Unterschiedliche
   Größen bleiben absichtlich getrennt (sonst ginge Info verloren). Rückgabe:
   Array von Gruppen (je ≥2 Einträge), Reihenfolge stabil nach erstem Auftreten.
   Einträge ohne Name werden nicht gruppiert. Rein/testbar. */
function findCatalogDuplicateGroups(items){
  const map=new Map(); const order=[];
  (items||[]).forEach(it=>{ const cn=canonCatalogName(it.name); if(!cn) return;
    const key=(it.nat||'material')+'|'+cn+'|'+canonCatalogName(it.sizeVal);
    if(!map.has(key)){ map.set(key,[]); order.push(key); } map.get(key).push(it); });
  return order.map(k=>map.get(k)).filter(g=>g.length>1);
}
/* Führt eine Gruppe gleicher Einträge zu EINEM zusammen: behält id, Name und
   Natur des ersten Eintrags, füllt fehlende Felder (menge/sizeVal/sizeTyp/uk)
   aus den weiteren Einträgen (erster nicht-leerer gewinnt). Rein/testbar. */
function mergeCatalogGroup(group){
  const g=(group||[]).slice(); const base=Object.assign({},g[0]);
  const filled=v=>v!=null&&v!=='';
  const firstWith=k=>g.find(it=>filled(it[k]));
  if(!filled(base.menge)){ const s=firstWith('menge'); base.menge=s?s.menge:null; }
  if(!filled(base.sizeVal)){ const s=firstWith('sizeVal'); if(s){ base.sizeVal=s.sizeVal; base.sizeTyp=s.sizeTyp||'dimension'; } else { base.sizeVal=null; base.sizeTyp=null; } }
  else if(!filled(base.sizeTyp)){ base.sizeTyp='dimension'; }
  if(!filled(base.uk)){ const s=firstWith('uk'); base.uk=s?s.uk:null; }
  return base;
}
/* Führt ALLE Duplikat-Gruppen zusammen. Behält die Array-Reihenfolge: der erste
   Eintrag jeder Gruppe wird durch das zusammengeführte Objekt ersetzt, die
   übrigen entfernt. Rückgabe {items,merged,groups}: neues Array, Zahl entfernter
   Einträge, Zahl der Gruppen. Rein/testbar. */
function mergeCatalogDuplicates(items){
  const groups=findCatalogDuplicateGroups(items);
  if(!groups.length) return { items:(items||[]).slice(), merged:0, groups:0 };
  const remove=new Set(); const mergedById=new Map(); let merged=0;
  groups.forEach(g=>{ mergedById.set(g[0].id,mergeCatalogGroup(g)); for(let i=1;i<g.length;i++){ remove.add(g[i].id); merged++; } });
  const out=[];
  (items||[]).forEach(it=>{ if(remove.has(it.id)) return; out.push(mergedById.has(it.id)?mergedById.get(it.id):it); });
  return { items:out, merged, groups:groups.length };
}
/* Erzeugt aus allen Standards eine Liste wiederverwendbarer Katalog-Objekte,
   damit ein Gerät/Material nur EINMAL zentral im Katalog gepflegt werden muss.
   Es werden nur beschaffbare Naturen (Geräte/Material) aus den Rubriken
   „geraete"/„material" berücksichtigt und über `nat|material_key` (bzw. Name)
   dedupliziert; die erste gefundene Größe dient als Vorgabe. Einträge, die es
   dem Namen nach (gleiche nat) schon im Katalog gibt, werden übersprungen.
   Rein/testbar: `newId` liefert eindeutige IDs, `isBeschaffbar(nat)` entscheidet
   über die Aufnahme. Rückgabe: neue Katalog-Objekte (Form wie makeCatalogItem). */
function buildCatalogFromStandards(standards,existing,newId,isBeschaffbar){
  const norm=s=>(s||'').trim().toLowerCase();
  const have=new Set((existing||[]).map(it=>(it.nat||'material')+'|'+norm(it.name)));
  const seen=new Set(); const out=[];
  (standards||[]).forEach(std=>{ (std.rubriken||[]).forEach(r=>{
    if(r.typ!=='material'&&r.typ!=='geraete') return;
    (r.sub_bereiche||[]).forEach(sb=>{ (sb.eintraege||[]).forEach(e=>{
      if(e.ist_fliesstext||e.natur==='ueberschrift') return;
      const nat=e.natur||'material'; if(!isBeschaffbar(nat)) return;
      const name=(e.anzeige_text||e.material_key||'').trim(); if(!name) return;
      const dedup=nat+'|'+(e.material_key?norm(e.material_key):norm(name));
      if(seen.has(dedup)) return; seen.add(dedup);
      if(have.has(nat+'|'+norm(name))) return; /* schon im Katalog gepflegt */
      const g=(e.groessen&&e.groessen[0])||null;
      out.push({ id:newId(), name, nat, menge:null,
        sizeTyp:g?(g.typ||'dimension'):null, sizeVal:g?(g.wert||g.roh||null):null, uk:null });
    }); });
  }); });
  return out;
}
function findCatalogItem(id){ return CATALOG.items.find(x=>x.id===id)||null; }

