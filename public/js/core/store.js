/* ============================================================
   HKL Standards v4 — Logik
   ============================================================ */
const DATA_URL='data/hkl_standards_export.json';
/* Hook: wird nach jedem store.set(key) aufgerufen. Der Server-Sync-Baustein
   hängt sich hier ein, um geänderte Schlüssel an /api/state zu schicken. */
let onStoreSet=null;
/* Speicher-Wrapper um localStorage mit zwei Absicherungen:
   1. localStorage von Anfang an gesperrt (z. B. Privatmodus) → reiner
      Arbeitsspeicher-Betrieb (mem).
   2. localStorage läuft im BETRIEB voll (QuotaExceeded, typisch: viele
      Fotos): der Wert bleibt in der mem-Überlagerung erhalten und get()
      liefert ihn weiter aus. Vorher las get() am vollen localStorage den
      ALTEN Wert → die Eingabe war sofort und still verloren (QA-Befund P1).
      Zusätzlich wird die Nutzerin gewarnt (höchstens 1×/Minute). */
const store=(()=>{ let mem={},ok=false,warnedAt=0; try{localStorage.setItem('__t','1');localStorage.removeItem('__t');ok=true;}catch(e){ok=false;}
  function quotaWarn(){ const now=Date.now(); if(now-warnedAt<60000) return; warnedAt=now;
    try{ if(typeof toast==='function') toast('Gerätespeicher voll – Änderungen halten nur bis zum Neuladen. Bitte alte Fotos entfernen.',true); }catch(e){} }
  return {
    get(k){ if(k in mem) return mem[k]; try{ return ok?localStorage.getItem(k):null; }catch(e){ return null; } },
    set(k,v){ let stored=false;
      if(ok){ try{ localStorage.setItem(k,v); stored=true; delete mem[k]; }catch(e){ quotaWarn(); } }
      if(!stored) mem[k]=v;
      if(onStoreSet){try{onStoreSet(k);}catch(_){}} } }; })();
/* schreibt in den Store OHNE den Sync-Hook auszulösen (für eingehende
   Server-Daten – sonst würden wir Fremdänderungen sofort zurückspielen). */
function storeSetQuiet(k,v){ const h=onStoreSet; onStoreSet=null; try{ store.set(k,v); } finally { onStoreSet=h; } }
const $=(id)=>document.getElementById(id);
/* escaped auch ' (&#39;) — Wurzelursache der Apostroph-Fehlerklasse (QA P2).
   Damit sind interpolierte Werte in HTML-Text, "-Attributen UND '-Kontexten
   sicher. Die Regel aus ARCHITECTURE.md (kein Freitext in onclick-Literale)
   gilt trotzdem weiter — Defense in depth. */
const esc=(s)=>(s==null?'':String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
const today=()=>new Date().toISOString().slice(0,10);
function loadJSON(k,def){ try{ const r=store.get(k); return r?JSON.parse(r):def; }catch(e){ return def; } }
function saveJSON(k,v){ store.set(k,JSON.stringify(v)); }

