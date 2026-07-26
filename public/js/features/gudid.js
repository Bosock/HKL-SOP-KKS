/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — GTIN → REF OHNE OCR (AccessGUDID)

   Der Grundgedanke: Die beste Texterkennung ist die, die man nicht braucht.
   Auf jedem Medizinprodukt steht die Artikelnummer bereits maschinenlesbar im
   Barcode — nur eben als GTIN, nicht als menschenlesbare REF. Die Brücke
   zwischen beiden schlägt die öffentliche Geräte-Datenbank der US National
   Library of Medicine:

     https://accessgudid.nlm.nih.gov/api/v2/devices/lookup.json?di=<GTIN>

   Frei, ohne Konto, ohne Schlüssel. Sie liefert zur GTIN unter anderem die
   Katalognummer (= REF), den Markennamen und die Herstellerfirma. Für ein
   Herzkatheterlabor mit überwiegend US-/EU-Ware deckt das einen großen Teil
   des Sortiments — und zwar EXAKT statt geraten.

   Grundsätze:
     - Es wird NUR nachgeschlagen, wenn eine GTIN vorliegt (Barcode).
     - Ergebnisse sind „unbestätigt (AccessGUDID)" — wie alle Web-Quellen.
       Sie füllen nur LEERE Felder und werden nie automatisch als Wahrheit
       gespeichert.
     - Offline-fest: kein Netz → kein Treffer → die App arbeitet normal weiter.
       Jeder Treffer wird gerätelokal zwischengespeichert (`hkl_gudid`), damit
       derselbe Artikel offline sofort wieder auflösbar ist.
   Reine Helfer (URL bauen, Antwort auswerten) sind DOM-frei → testbar.
   ───────────────────────────────────────────────────────────── */

const GUDID_BASIS='https://accessgudid.nlm.nih.gov/api/v2/devices/lookup.json';
const GUDID_TIMEOUT=8000;

/* Nachschlage-URL zu einer GTIN (Device Identifier). Rein/testbar. */
function gudidUrl(gtin){
  const g=String(gtin==null?'':gtin).trim();
  return GUDID_BASIS+'?di='+encodeURIComponent(g);
}

/* Ist die GTIN überhaupt nachschlagbar? Nur reine Ziffernfolgen in GTIN-Länge.
   Rein/testbar. */
function gudidLookupfaehig(gtin){ return /^\d{8,14}$/.test(String(gtin==null?'':gtin).trim()); }

/* Wertet die Antwort aus. Die API verschachtelt das Gerät je nach Endpunkt
   unterschiedlich — deshalb tolerant beide Wege prüfen. Liefert
   { ref, name, hersteller, beschreibung, quelle } oder null. Rein/testbar. */
function gudidExtract(json){
  if(!json || typeof json!=='object') return null;
  const d = (json.gudid && json.gudid.device) || json.device || (json.gudid||null);
  if(!d || typeof d!=='object') return null;
  const s=(v)=>{ const t=(v==null?'':String(v)).trim(); return (t && t.toLowerCase()!=='null')?t:''; };
  /* Katalognummer = die menschenlesbare REF auf dem Etikett. Fällt sie aus,
     ist die Versions-/Modellnummer der übliche Ersatz. */
  const ref = s(d.catalogNumber) || s(d.versionModelNumber);
  const name = s(d.brandName) || s(d.deviceDescription);
  const hersteller = s(d.companyName);
  if(!ref && !name && !hersteller) return null;
  return { ref, name, hersteller, beschreibung:s(d.deviceDescription), quelle:'AccessGUDID (NLM)' };
}

/* ===== Gerätelokaler Zwischenspeicher ===== */
/* Bewusst NICHT im geteilten Zustand: es sind abgeleitete Fremddaten. Was davon
   wirklich zählt, landet beim Übernehmen im Stammsatz — und der wird geteilt. */
let GUDID_CACHE = (typeof loadJSON==='function') ? loadJSON('hkl_gudid',{}) : {};
function gudidCacheSave(){ if(typeof saveJSON==='function') saveJSON('hkl_gudid', GUDID_CACHE); }
function gudidFromCache(gtin){ const e=GUDID_CACHE[String(gtin||'')]; return (e&&e.treffer)||null; }

/* Schlägt eine GTIN nach. Liefert immer ein Promise auf das Treffer-Objekt
   oder null (nie ein rejectetes Promise — ein fehlender Treffer ist normal).
   Negativ-Treffer werden ebenfalls gemerkt, damit dieselbe unbekannte GTIN
   nicht bei jedem Scan erneut das Netz belastet. */
function gudidLookup(gtin){
  const g=String(gtin==null?'':gtin).trim();
  if(!gudidLookupfaehig(g)) return Promise.resolve(null);
  if(Object.prototype.hasOwnProperty.call(GUDID_CACHE,g)) return Promise.resolve(gudidFromCache(g));
  if(typeof fetch!=='function') return Promise.resolve(null);
  if(typeof navigator!=='undefined' && navigator.onLine===false) return Promise.resolve(null);

  let ctrl=null, timer=null;
  try{ ctrl=new AbortController(); timer=setTimeout(()=>{ try{ ctrl.abort(); }catch(e){} }, GUDID_TIMEOUT); }catch(e){}
  return fetch(gudidUrl(g), Object.assign({ method:'GET', mode:'cors', credentials:'omit' }, ctrl?{signal:ctrl.signal}:{}))
    .then(r=>r.ok?r.json():null)
    .then(j=>{
      const t=gudidExtract(j);
      GUDID_CACHE[g]={ treffer:t, at:new Date().toISOString() }; gudidCacheSave();
      return t;
    })
    .catch(()=>null)
    .then(v=>{ if(timer) clearTimeout(timer); return v; });
}

/* Bequemer Gesamtweg „GTIN → Produktdaten": erst der EIGENE Bestand (offline,
   exakt, kostenlos), dann der Referenz-Katalog, erst danach das Netz.
   Liefert { ref, name, hersteller, quelle, herkunft } oder null.
   herkunft: 'stammsatz' | 'katalog' | 'accessgudid' */
function gtinAufloesen(gtin){
  const g=(typeof gtinKey==='function')?gtinKey(gtin):String(gtin||'');
  /* 1) Eigener Stammsatz — der beste Fall: schon einmal erfasst. */
  if(typeof GTINDB!=='undefined' && GTINDB && GTINDB[g]){
    const r=GTINDB[g];
    if(r.ref||r.name||r.hersteller)
      return Promise.resolve({ ref:r.ref||'', name:r.name||'', hersteller:r.hersteller||'', quelle:'eigener Stammsatz', herkunft:'stammsatz' });
  }
  /* 2) Referenz-Katalog (falls er eine GTIN führt). */
  if(typeof MATCAT!=='undefined' && MATCAT){
    const hit=Object.keys(MATCAT).map(k=>MATCAT[k]).find(e=>e && e.gtin && String(e.gtin)===String(g));
    if(hit) return Promise.resolve({ ref:hit.ref||'', name:hit.name||'', hersteller:hit.hersteller||'', quelle:hit.quelle||'Referenz-Katalog', herkunft:'katalog' });
  }
  /* 3) AccessGUDID (Netz, unbestätigt). Die rohe Ziffernfolge ohne führende
     Nullen ist die übliche DI-Schreibweise. */
  const di=String(g).replace(/^0+/,'') || g;
  return gudidLookup(di).then(t=>t?Object.assign({herkunft:'accessgudid'}, t):null);
}
