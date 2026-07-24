/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — ÜBERSICHT: BEREICHE (Standards | Anleitungen), SORTIERUNG,
   FAVORITEN & NUTZUNG
   Die Startseite trägt jetzt ZWEI Inhaltsarten: die bisherigen Standards
   (Eingriffe) und die neuen Anleitungen (Aufbau, Gerätebedienung, Bestellen,
   regelmäßige Aufgaben …). Beide teilen sich Übersicht, Suche und Sortierung —
   getrennt über einen Umschalter, damit die Arten nicht vermischt werden.

   Sortierung ist umstellbar: nach Gruppe (wie bisher), Alphabet, Favoriten,
   meistgenutzt, zuletzt geöffnet und – nur bei Standards – nach Plankosten.
   „Objektive" Sortierungen gelten für alle, persönliche (Favorit/Nutzung)
   liegen bewusst GERÄTELOKAL, weil sie pro Person verschieden sind.
   ───────────────────────────────────────────────────────────── */

let curSeg = 'standard';                          /* 'standard' | 'anleitung' */
let curSort = store.get('hkl_sort') || 'gruppe';  /* siehe SORTS */
let FAV = loadJSON('hkl_fav', {});                /* id → true (gerätelokal) */
let USAGE = loadJSON('hkl_usage', {});            /* id → {n, last} (gerätelokal) */
function saveFav(){ saveJSON('hkl_fav', FAV); }
function saveUsage(){ saveJSON('hkl_usage', USAGE); }

/* Verfügbare Sortierungen. `nur` grenzt ein, wo eine Sortierung Sinn ergibt. */
const SORTS = [
  { key:'gruppe', label:'Bereich',        ico:'🗂' },
  { key:'alpha',  label:'A–Z',            ico:'🔤' },
  { key:'fav',    label:'Favoriten',      ico:'⭐' },
  { key:'oft',    label:'Meistgenutzt',   ico:'🔥' },
  { key:'neu',    label:'Zuletzt',        ico:'🕘' },
  { key:'kosten', label:'Kosten',         ico:'💶', nur:'standard' },
  { key:'faellig',label:'Fällig',         ico:'⏰', nur:'anleitung' },
];
function sortsFor(seg){ return SORTS.filter(s=>!s.nur || s.nur===seg); }

/* ===== Reine, testbare Helfer ===== */
/* Ist die Sortierung im aktuellen Bereich erlaubt? Sonst fällt sie auf
   'gruppe' zurück (z. B. „Kosten" beim Wechsel zu Anleitungen). Rein. */
function sortValid(key, seg){ const s=SORTS.find(x=>x.key===key); if(!s) return 'gruppe';
  if(s.nur && s.nur!==seg) return 'gruppe'; return key; }
/* Favorit-Status. Rein (liest FAV). */
function isFav(id){ return !!(FAV && FAV[id]); }
/* Nutzungszahl / letzter Zugriff. Rein (liest USAGE). */
function usageOf(id){ const u=(USAGE&&USAGE[id])||{}; return { n:u.n||0, last:u.last||0 }; }

/* Sortiert eine Liste {id, titel, gruppe, kosten?, faellig?} nach dem Schlüssel.
   Rein/testbar — kein DOM, keine Globals außer FAV/USAGE. */
function sortItems(list, key){
  const arr=(list||[]).slice();
  const byTitle=(a,b)=>(a.titel||'').localeCompare(b.titel||'','de');
  if(key==='alpha') return arr.sort(byTitle);
  if(key==='fav')   return arr.sort((a,b)=>{ const fa=isFav(a.id)?0:1, fb=isFav(b.id)?0:1; return fa!==fb?fa-fb:byTitle(a,b); });
  if(key==='oft')   return arr.sort((a,b)=>{ const d=usageOf(b.id).n-usageOf(a.id).n; return d!==0?d:byTitle(a,b); });
  if(key==='neu')   return arr.sort((a,b)=>{ const d=usageOf(b.id).last-usageOf(a.id).last; return d!==0?d:byTitle(a,b); });
  if(key==='kosten')return arr.sort((a,b)=>{ const d=(b.kosten||0)-(a.kosten||0); return d!==0?d:byTitle(a,b); });
  if(key==='faellig')return arr.sort((a,b)=>{ const d=(a.faelligRang||99)-(b.faelligRang||99); return d!==0?d:byTitle(a,b); });
  return arr.sort(byTitle);   /* 'gruppe' gruppiert außerhalb; innerhalb A–Z */
}

/* ===== Zustand-Operationen ===== */
function setSeg(seg){ curSeg=(seg==='anleitung')?'anleitung':'standard';
  curSort=sortValid(curSort,curSeg);
  if(typeof renderStandards==='function') renderStandards();
  if(typeof updateBar==='function') updateBar(); }
function setSort(key){ curSort=sortValid(key,curSeg); store.set('hkl_sort',curSort);
  if(typeof renderStandards==='function') renderStandards(); }
function toggleFav(id){ if(FAV[id]) delete FAV[id]; else FAV[id]=true; saveFav();
  if(typeof renderStandards==='function') renderStandards(); }
/* Nutzung zählen (beim Öffnen eines Standards/einer Anleitung). */
function noteUsage(id){ if(!id) return; const u=USAGE[id]||(USAGE[id]={n:0,last:0});
  u.n=(u.n||0)+1; u.last=Date.now(); saveUsage(); }

/* Umschalter + Sortierleiste als HTML (wird von renderStandards eingebunden). */
function segBarHTML(){
  const cnt=(typeof DB!=='undefined'&&DB&&DB.standards)?DB.standards.filter(s=>!stdHidden(s)||ADMIN).length:0;
  const gcnt=(typeof guideList==='function')?guideList().length:0;
  const b=(key,label,n)=>`<button class="seg-btn${curSeg===key?' on':''}" onclick="setSeg('${key}')">${label}<span class="seg-n">${n}</span></button>`;
  const sorts=sortsFor(curSeg).map(s=>`<button class="sortchip${curSort===s.key?' on':''}" onclick="setSort('${s.key}')" title="${esc(s.label)}">${s.ico} ${esc(s.label)}</button>`).join('');
  return `<div class="segbar">${b('standard','📋 Standards',cnt)}${b('anleitung','📘 Anleitungen',gcnt)}</div>
    <div class="sortbar">${sorts}</div>`;
}
/* ⭐-Schalter für eine Zeile (Freitext bleibt außerhalb des onclick). */
function favBtnHTML(id){ return `<button type="button" class="fav-btn${isFav(id)?' on':''}" data-fid="${esc(id)}" onclick="event.stopPropagation();toggleFav(this.dataset.fid)" aria-label="Favorit">${isFav(id)?'★':'☆'}</button>`; }
