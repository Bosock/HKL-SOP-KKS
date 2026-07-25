/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — MATERIAL-DATENHELFER (Zeilen, Verknüpfung, Zusammenführung)
   Die Bildschirm-Darstellung liegt seit der Konsolidierung in
   features/matcenter.js (Material-Zentrale). Hier bleiben nur die
   DATEN-Helfer, die von dort (und aus dem Standard heraus) benutzt werden —
   eine zweite Hub-Oberfläche wäre ein Divergenz-Risiko und ist entfernt.

   FRÜHER (historisch):
   Führt die früher getrennten Material-Menüs zusammen: „Material pflegen"
   (Foto/Lagerort/Preis), den „Etikett-Scanner" (Barcode-Stammsatz mit Maßen &
   eigenen Eigenschaften) und die „Materialzusammenführung" (Destillation).

   EIN Bildschirm listet jedes Material mit Foto, Vorkommen (WO es benutzt wird)
   und Status; ein Tipp öffnet EINEN Editor (der reiche Stammsatz-Editor aus
   scanner.js) mit Scan 📷, OCR, Foto-Zuschnitt, Maßen, eigenen Eigenschaften,
   Preis und Lagerort. Duplikate lassen sich direkt zusammenführen. Aus einem
   Eintrag im Standard öffnet „Material verwalten" denselben Editor.

   Der Stammsatz (GTINDB, inkl. manueller „m:…") ist die EINZIGE Quelle der
   Identität; `hkl_matlink` verbindet Vorkommen (material_key) → Stammsatz.
   Alt-Daten aus „Material pflegen" (hkl_care/hkl_prod) werden beim ersten
   Öffnen nicht-destruktiv in den Stammsatz übernommen. */

/* material_key → Set der Standard-Titel, in denen es vorkommt.
   GECACHT: Diese Karte wurde früher bei jedem Aufruf neu über ALLE Standards
   berechnet (Übersicht, Suche, Zentrale) — bei 4.475 Einträgen unnötig teuer.
   buildMaterialIndex() verwirft den Cache, wenn sich die Daten ändern. */
let matStdMapCache=null;
function invalidateMatCaches(){ matStdMapCache=null;
  if(typeof mcRowCache!=='undefined') mcRowCache=null;
  if(typeof mcEntryCache!=='undefined') mcEntryCache=null; }
function matStdMap(){ if(matStdMapCache) return matStdMapCache;
  const m={};
  if(typeof DB==='undefined'||!DB||!DB.standards) return m;
  DB.standards.forEach(s=>{ const t=(typeof stdTitel==='function')?stdTitel(s):(s.titel||s.id);
    (s.rubriken||[]).forEach(r=>{ if(r.typ!=='material'&&r.typ!=='geraete') return;
      (r.sub_bereiche||[]).forEach(sb=>(sb.eintraege||[]).forEach(e=>{ const k=e.material_key;
        if(!k) return; (m[k]=m[k]||new Set()).add(t); })); }); });
  matStdMapCache=m; return m; }

/* Seed für einen neuen Stammsatz aus den Alt-Pflegedaten (Foto, Lagerort,
   Hersteller, REF, Verwendung, Preis) — verlustfreie Übernahme. */
function matSeedFromCare(key,name){
  const c=(typeof careMem==='object'&&careMem&&careMem[key])||{};
  const p=(typeof PROD==='object'&&PROD&&PROD[key])||{};
  const seed={}; if(name) seed.name=name;
  if(p.hersteller) seed.hersteller=p.hersteller;
  if(p.ref) seed.ref=p.ref;
  if(p.verwendung) seed.verwendung=p.verwendung;
  if(p.preis!=null) seed.preis=p.preis;
  if(c.photo) seed.photo=c.photo;
  if(c.loc) seed.lagerort=c.loc;
  return seed; }

/* Baut die vereinheitlichte Materialliste: alle Vorkommen aus den Standards
   (MAT_INDEX) + „nur gescannte" Stammsätze ohne Vorkommen. Rein datenbezogen. */
function matHubRows(){
  const stdMap=matStdMap();
  const cId=(k)=>(typeof canonId==='function')?canonId(k):null;
  const rows=(typeof MAT_INDEX!=='undefined'?MAT_INDEX:[]).map(m=>{
    const id=cId(m.key); const c=id&&typeof GTINDB!=='undefined'?GTINDB[id]:null;
    const care=(typeof careMem==='object'&&careMem&&careMem[m.key])||null;
    const prod=(typeof PROD==='object'&&PROD&&PROD[m.key])||null;
    const photo=(c&&c.photo)||(care&&care.photo)||null;
    const status=id?'linked':((care||prod)?'part':'open');
    return { kind:'mat', key:m.key, name:(c&&c.name)||m.name, typ:m.typ,
      vorkommen:m.vorkommen, photo, status, stds:[...(stdMap[m.key]||[])] };
  });
  /* Stammsätze, die (noch) keinem Vorkommen zugeordnet sind (rein gescannt). */
  const linked=new Set((typeof MATLINK==='object'&&MATLINK)?Object.values(MATLINK):[]);
  const orphans=(typeof GTINDB==='object'&&GTINDB?Object.keys(GTINDB):[])
    .filter(g=>!linked.has(g)).map(g=>GTINDB[g])
    .map(r=>({ kind:'stamm', key:r.gtin, name:r.name||r.ref||r.gtin, typ:'material',
      vorkommen:0, photo:r.photo||null, status:'stammonly', stds:[] }));
  return rows.concat(orphans);
}

function matHubStatusTag(s){
  if(s==='linked') return `<span class="mat-sub ok"><span class="dot dot-ok"></span>Stammsatz</span>`;
  if(s==='stammonly') return `<span class="mat-sub ok"><span class="dot dot-ok"></span>erfasst</span>`;
  if(s==='part') return `<span class="mat-sub open"><span class="dot dot-open"></span>teilgepflegt</span>`;
  return `<span class="mat-sub open"><span class="dot dot-open"></span>offen</span>`;
}
/* Öffnet den EINEN Editor für ein Vorkommen (material_key). Ist das Material
   schon verknüpft → dessen Stammsatz bearbeiten. Sonst einen NEUEN Stammsatz
   transient vorbereiten (aus Name + Alt-Pflegedaten) — er wird erst BEIM
   SPEICHERN angelegt und verknüpft (scanPendingLinkKey), damit bloßes Öffnen
   die Datenbank nicht mit leeren Stammsätzen füllt. */
function openMaterial(key){
  if(typeof ADMIN!=='undefined' && !ADMIN){ if(typeof promptLoginThen==='function'){ promptLoginThen(()=>openMaterial(key)); return; } }
  const id=(typeof canonId==='function')?canonId(key):null;
  if(id){ if(typeof openScanItem==='function') openScanItem(id,true); return; }
  const m=(typeof MAT_INDEX!=='undefined'?MAT_INDEX:[]).find(x=>x.key===key);
  const name=(m&&m.name)||key;
  const gid='m:'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  if(typeof scanPendingLinkKey!=='undefined') scanPendingLinkKey=key;
  if(typeof renderScanItemForm==='function'){
    renderScanItemForm(Object.assign({ gtin:gid, manual:true, props:{} }, matSeedFromCare(key,name)));
    show('scr-scan-item'); if(typeof setBar==='function') setBar(name,'Bearbeiten',true);
  }
}
/* Neues Material ohne Barcode: manuellen Stammsatz-Editor öffnen (persistiert
   erst beim Speichern — die m:-ID wird schon vergeben). */
function matHubNew(){
  if(typeof ADMIN!=='undefined' && !ADMIN){ if(typeof promptLoginThen==='function'){ promptLoginThen(()=>matHubNew()); return; } }
  const id='m:'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  if(typeof renderScanItemForm==='function'){ renderScanItemForm({ gtin:id, manual:true, props:{} });
    show('scr-scan-item'); if(typeof setBar==='function') setBar('Neues Material','Bearbeiten',true); }
}
/* Duplikat-Gruppe im Hub zusammenführen (wie im Verwaltungs-Panel, re-rendert
   aber den Hub). */
function matHubMerge(gi){
  const list=(typeof matDistinctList==='function')?matDistinctList():[];
  const groups=(typeof matSuggestGroups==='function')?matSuggestGroups(list):[]; const g=groups[gi]; if(!g||!g.length) return;
  let id=null; for(const k of g){ const c=(typeof canonId==='function')?canonId(k):null; if(c){ id=c; break; } }
  if(!id){ const first=list.find(x=>x.key===g[0]); id=(typeof matCreateStamm==='function')?matCreateStamm(first?first.name:g[0], first?matSeedFromCare(g[0],first.name):null):null; }
  if(!id) return;
  g.forEach(k=>{ if(typeof matLinkTo==='function') matLinkTo(k,id); });
  if(typeof buildMaterialIndex==='function') buildMaterialIndex();
  if(typeof renderMatCenter==='function') renderMatCenter();
  if(typeof toast==='function') toast(g.length+' Vorkommen zusammengeführt');
}
