/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — REFERENZ-KATALOG (Web-recherchierte Produkt-Specs)
   Ein mitgelieferter Nachschlage-Katalog (public/data/material_catalog.json),
   Schlüssel = REF (ohne Sonderzeichen, Großschrift). Er speist den Material-
   Editor: REF tippen oder als GS1-REF scannen → Hersteller, Kategorie, Maße und
   Plattform-Specs erscheinen als VORSCHLAG zum Übernehmen.

   Grundsatz (medizinisch bewusst vorsichtig): Alle Katalogwerte sind
   „unbestätigt (Web-Recherche)" — sie werden NIE automatisch als Wahrheit
   gespeichert. Der Nutzer übernimmt sie bewusst; ein Stammsatz führt sie sichtbar
   als „unbestätigt", bis ein Mensch sie mit „Bestätigen" freigibt. Leer schlägt
   falsch: nur belegte Felder stehen im Katalog.
   ───────────────────────────────────────────────────────────── */

let MATCAT = {};        /* normierte REF → { name, hersteller, kategorie, gruppe, untergruppe, ref, masse, specs, quelle, status } */
let MATCAT_KATS = [];   /* Liste der Kategorien (für Auswahl/Datalist im Editor) */

/* Katalogdaten setzen (aus dem geladenen JSON). Tolerant gegenüber Struktur. */
function catSetData(obj){
  MATCAT = (obj && obj.eintraege) ? obj.eintraege : (obj || {});
  MATCAT_KATS = (obj && Array.isArray(obj.kategorien)) ? obj.kategorien : [];
}
function catCount(){ return MATCAT ? Object.keys(MATCAT).length : 0; }

/* ===== Reine, testbare Helfer ===== */
/* REF normalisieren – IDENTISCH zur Generator-Seite (Python norm_ref):
   Großschrift, nur A–Z0–9. So trifft „RM*RG5J40" auf „RMRG5J40". */
function catNormRef(ref){ return String(ref==null?'':ref).toUpperCase().replace(/[^A-Z0-9]/g,''); }

/* Katalog-Treffer zu einer (Roh-)REF oder null. REF <4 Zeichen wird ignoriert
   (zu unspezifisch). Rein (liest MATCAT). */
function catLookup(ref){ const k=catNormRef(ref); if(!k || k.length<4) return null; return MATCAT[k] || null; }

/* Specs eines Eintrags als [label,wert]-Paare (für Anzeige/Preview). Rein. */
function catSpecPairs(entry){ if(!entry || !entry.specs) return [];
  return Object.keys(entry.specs).map(k=>[k, entry.specs[k]]); }
/* Maße eines Eintrags als [label,wert]-Paare. Rein. */
function catMassPairs(entry){ if(!entry || !entry.masse) return [];
  return Object.keys(entry.masse).map(k=>[k, entry.masse[k]]); }

/* ===== Editor-Integration (DOM) ===== */
/* Prüft die aktuelle REF im Editor gegen den Katalog und zeigt (oder leert) den
   Treffer-Hinweis mit „Übernehmen". Wird bei REF-Eingabe und Formular-Aufbau
   aufgerufen. */
function catCheckForm(){
  const box=(typeof $==='function')?$('catMatch'):document.getElementById('catMatch');
  if(!box) return;
  const refEl=document.getElementById('scRef');
  const entry=catLookup(refEl?refEl.value:'');
  if(!entry){ box.innerHTML=''; box.style.display='none'; return; }
  const sp=catSpecPairs(entry).concat(catMassPairs(entry)).slice(0,6)
    .map(p=>`<span class="size-badge"><span class="st">${esc(p[0])}</span>${esc(p[1])}</span>`).join('');
  box.style.display='';
  box.innerHTML=`<div class="cat-hit">
    <div class="cat-hit-head"><span class="cat-badge-unb">unbestätigt</span> Katalog-Treffer</div>
    <div class="cat-hit-name">${esc(entry.name||'')}${entry.hersteller?` · <span class="vw-ctx" style="display:inline">${esc(entry.hersteller)}</span>`:''}</div>
    ${entry.gruppe?`<div class="vw-ctx">${esc(entry.gruppe)}${entry.untergruppe?' › '+esc(entry.untergruppe):''}</div>`:''}
    ${sp?`<div class="e-meta" style="margin-top:6px">${sp}</div>`:''}
    <div class="uk-actions" style="margin-top:8px"><button type="button" onclick="catApplyToForm()">Übernehmen (unbestätigt)</button></div>
    ${entry.quelle?`<div class="cat-src">Quelle: ${esc(entry.quelle)}</div>`:''}
  </div>`;
}

/* Übernimmt den Katalog-Treffer ins Formular: füllt LEERE Felder (Hersteller,
   Name, Kategorie), hängt Maße an die Größenliste und legt die Plattform-Specs
   in den versteckten Halter #catHold (JSON) – sie werden beim Speichern als
   „katspecs" mit Status „unbestätigt" am Stammsatz gesichert. */
function catApplyToForm(){
  const refEl=document.getElementById('scRef'); const entry=catLookup(refEl?refEl.value:'');
  if(!entry){ if(typeof toast==='function') toast('Kein Katalog-Treffer zur REF.'); return; }
  const setIfEmpty=(id,val)=>{ const el=document.getElementById(id); if(el && !el.value.trim() && val) el.value=val; };
  setIfEmpty('scHersteller', entry.hersteller);
  setIfEmpty('scName', entry.name);
  const kat=document.getElementById('scKat'); const katVal=entry.kategorie||entry.gruppe;
  if(kat && !kat.value.trim() && katVal) kat.value=katVal;
  /* Maße an die eine Größenliste anhängen (nur, was noch nicht drinsteht). */
  const box=document.getElementById('scSizes');
  if(box && typeof scanAddSize==='function'){
    const have=[...box.querySelectorAll('.merk-wert')].map(i=>i.value.trim().toLowerCase());
    catMassPairs(entry).forEach(([lab,val])=>{ const v=String(val); if(have.indexOf(v.toLowerCase())<0){
      scanAddSize(); const rows=box.querySelectorAll('.merk-row'); const last=rows[rows.length-1];
      if(last){ const w=last.querySelector('.merk-wert'); if(w) w.value=v; } }});
  }
  /* Plattform-Specs + Quelle in den Halter schreiben (unbestätigt). */
  const hold=document.getElementById('catHold');
  if(hold) hold.value=JSON.stringify({ specs:entry.specs||{}, ref:entry.ref||'', quelle:entry.quelle||'', status:'unbestätigt' });
  if(typeof toast==='function') toast('Katalog übernommen – bitte Werte prüfen (Status: unbestätigt)');
  catCheckForm();
}

/* Liest den Katalog-Halter (#catHold) fürs Speichern. Liefert Objekt oder null. */
function catReadHold(){ const h=document.getElementById('catHold'); if(!h || !h.value) return null;
  try{ return JSON.parse(h.value); }catch(e){ return null; } }

/* Read-only-Block „Katalog-Info (unbestätigt)" für die Produktansicht. Zeigt die
   gespeicherten katspecs + Quelle + einen „Bestätigen"-Button (flippt den Status).
   Liefert HTML-String (leer, wenn nichts da). */
function catInfoBlockHTML(r){
  const ks=r&&r.katspecs; if(!ks || !Object.keys(ks).length) return '';
  const unb=(r.katstatus!=='bestätigt');
  const pairs=Object.keys(ks).map(k=>`<div class="info-field"><div class="if-l">${esc(k)}</div><div class="if-v">${esc(ks[k])}</div></div>`).join('');
  const badge=unb?`<span class="cat-badge-unb">unbestätigt</span>`:`<span class="cat-badge-ok">bestätigt</span>`;
  const btn=(unb && (typeof ADMIN==='undefined'||ADMIN))?`<div class="p-actions" style="margin-top:8px"><button class="btn btn-sec" data-g="${esc(r.gtin||'')}" onclick="catConfirm(this.dataset.g)">✓ Katalog-Werte bestätigen</button></div>`:'';
  return `<div class="cat-info">
    <div class="cat-info-head">${badge} Katalog-Info (Web-recherchiert)</div>
    ${pairs}
    ${r.katquelle?`<div class="cat-src">Quelle: ${esc(r.katquelle)}</div>`:''}
    ${btn}</div>`;
}
/* Katalog-Werte eines Stammsatzes als „bestätigt" markieren. */
function catConfirm(gArg){
  if(typeof ADMIN!=='undefined' && !ADMIN){ if(typeof promptLoginThen==='function'){ promptLoginThen(()=>catConfirm(gArg)); return; } }
  const g=(typeof gtinKey==='function')?gtinKey(gArg):gArg; const r=(typeof GTINDB!=='undefined')?GTINDB[g]:null; if(!r) return;
  r.katstatus='bestätigt'; r.updatedAt=new Date().toISOString();
  if(typeof saveGtinDB==='function') saveGtinDB();
  if(typeof toast==='function') toast('Katalog-Werte bestätigt');
  if(typeof openScanItem==='function') openScanItem(g,false);
}
