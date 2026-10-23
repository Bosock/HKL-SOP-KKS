/* ============================================================
   HKL Standards v4 — Logik
   ============================================================ */
const DATA_URL='data/hkl_standards_export.json';
/* Hook: wird nach jedem store.set(key) aufgerufen. Der Server-Sync-Baustein
   hängt sich hier ein, um geänderte Schlüssel an /api/state zu schicken. */
let onStoreSet=null;
/* ─────────────────────────────────────────────────────────────
   RÄUME — Bestand und Neuaufbau (Gegenstück zu server/raeume.js)

   Die App kennt zwei vollständig getrennte Datenbestände. Der BESTAND ist
   das, womit im Labor gearbeitet wird. Der NEUAUFBAU beginnt leer — ohne die
   eingelesenen Standards, ohne Material, ohne Bilder — und ist nur über ein
   zweites Passwort in der Verwaltung zu betreten.

   Auf dem Gerät trennt ein PRÄFIX die beiden: Jeder Schlüssel des
   Neuaufbaus liegt als „raum:neuaufbau:hkl_…" im Speicher, die des Bestands
   unverändert als „hkl_…". Weil ALLE Zugriffe auf den Gerätespeicher durch
   `store` laufen (npm run check erzwingt das), genügt diese eine Stelle: Kein
   Baustein der App muss wissen, in welchem Raum er gerade arbeitet.

   Welcher Raum gilt, entscheidet sich einmal beim Laden der Seite:
     1. eine bewusste Wahl auf diesem Gerät (Zweitpasswort bzw. „alten
        Bestand ansehen"),
     2. sonst der Raum, den der Server zuletzt als „live" gemeldet hat,
     3. sonst der Bestand.
   Ein Raumwechsel lädt die Seite neu — nie wird im laufenden Betrieb
   umgeschaltet, sonst hielte ein Baustein noch Daten des alten Raums.
   ───────────────────────────────────────────────────────────── */
const RAEUME_DEF={
  bestand:  { titel:'Bestand',   basis:true,  praefix:'' },
  neuaufbau:{ titel:'Neuaufbau', basis:false, praefix:'raum:neuaufbau:' },
};
/* Diese beiden Schlüssel liegen bewusst AUSSERHALB jedes Raums: Sie wählen
   den Raum erst aus. */
const RAUM_WAHL_KEY='hkl_raumwahl';
const RAUM_LIVE_KEY='hkl_liveraum';
function raumRoh(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function raumBekannt(x){ return !!x && Object.prototype.hasOwnProperty.call(RAEUME_DEF,x); }
const RAUM=(()=>{
  const w=raumRoh(RAUM_WAHL_KEY), l=raumRoh(RAUM_LIVE_KEY);
  const gewaehlt=raumBekannt(w);
  const id=gewaehlt?w:(raumBekannt(l)?l:'bestand');
  const d=RAEUME_DEF[id];
  /* neu = hier laufen die Neuerungen, die (noch) nur dem Neuaufbau gehören.
     wahl = die bewusste Wahl dieses Geräts (null: es folgt dem Live-Raum). */
  return Object.freeze({ id, titel:d.titel, basis:d.basis, praefix:d.praefix, gewaehlt, wahl:gewaehlt?w:null, neu:id!=='bestand' });
})();
/* Raumangabe für Anfragen an den Server. Für den Bestand LEER — seine
   Anfragen sehen exakt so aus wie vor der Einführung der Räume. */
function raumParam(trenner){ return RAUM.id==='bestand' ? '' : ((trenner||'?')+'raum='+encodeURIComponent(RAUM.id)); }
/* Raum wechseln: nur die Wahl wird gesetzt, der Wechsel selbst geschieht beim
   Neuladen (siehe oben). `id` null heißt: keine eigene Wahl, dem Live-Raum
   folgen. `sitzungBis` meldet im Zielraum gleich an — wer das Zweitpasswort
   kennt, muss nicht noch ein drittes Mal tippen. */
function raumWaehlen(id, sitzungBis){
  try{
    if(id){
      if(!raumBekannt(id)) return false;
      localStorage.setItem(RAUM_WAHL_KEY, id);
    } else {
      localStorage.removeItem(RAUM_WAHL_KEY);
    }
    const ziel = id || raumLiveGemerkt();
    if(sitzungBis && ziel!=='bestand') localStorage.setItem(RAEUME_DEF[ziel].praefix+'hkl_authuntil', String(sitzungBis));
    return true;
  }catch(e){ return false; }
}
/* Der Live-Raum, wie ihn der Server zuletzt gemeldet hat (Vorgabe: Bestand). */
function raumLiveGemerkt(){ const l=raumRoh(RAUM_LIVE_KEY); return raumBekannt(l) ? l : 'bestand'; }
/* Den gemeldeten Live-Raum merken — nur schreiben, wenn er sich ändert. */
function raumLiveMerken(id){
  try{ if(raumBekannt(id) && localStorage.getItem(RAUM_LIVE_KEY)!==id) localStorage.setItem(RAUM_LIVE_KEY, id); }catch(e){}
}

/* Speicher-Wrapper um localStorage mit zwei Absicherungen:
   1. localStorage von Anfang an gesperrt (z. B. Privatmodus) → reiner
      Arbeitsspeicher-Betrieb (mem).
   2. localStorage läuft im BETRIEB voll (QuotaExceeded, typisch: viele
      Fotos): der Wert bleibt in der mem-Überlagerung erhalten und get()
      liefert ihn weiter aus. Vorher las get() am vollen localStorage den
      ALTEN Wert → die Eingabe war sofort und still verloren (QA-Befund P1).
      Zusätzlich wird die Nutzerin gewarnt (höchstens 1×/Minute).
   Jeder Schlüssel bekommt das Präfix des aktuellen Raums (siehe oben). */
const store=(()=>{ let mem={},ok=false,warnedAt=0; const P=RAUM.praefix; try{localStorage.setItem('__t','1');localStorage.removeItem('__t');ok=true;}catch(e){ok=false;}
  function quotaWarn(){ const now=Date.now(); if(now-warnedAt<60000) return; warnedAt=now;
    try{ if(typeof toast==='function') toast('Gerätespeicher voll – Änderungen halten nur bis zum Neuladen. Bitte alte Fotos entfernen.',true); }catch(e){} }
  return {
    get(k){ const pk=P+k; if(pk in mem) return mem[pk]; try{ return ok?localStorage.getItem(pk):null; }catch(e){ return null; } },
    set(k,v){ const pk=P+k; let stored=false;
      if(ok){ try{ localStorage.setItem(pk,v); stored=true; delete mem[pk]; }catch(e){ quotaWarn(); } }
      if(!stored) mem[pk]=v;
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
/* Entprellt einen Aufruf: erst wenn ms lang nichts mehr kam, wird ausgeführt.
   Für „Suche während des Tippens" — ohne das läuft die Suche bei JEDEM Zeichen
   über alle Standards (bei 47 Standards / 4.475 Einträgen spürbar). 300 ms ist
   der gängige Kompromiss aus Reaktion und Last. */
function debounce(fn,ms){ let t=null;
  return function(){ const a=arguments, self=this;
    if(t) clearTimeout(t);
    t=setTimeout(()=>{ t=null; fn.apply(self,a); }, ms==null?300:ms); }; }
function loadJSON(k,def){ try{ const r=store.get(k); return r?JSON.parse(r):def; }catch(e){ return def; } }
function saveJSON(k,v){ store.set(k,JSON.stringify(v)); }

