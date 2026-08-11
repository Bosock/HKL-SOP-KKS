/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — ENDGÜLTIG LÖSCHEN

   Der Betreiber: „das löschen mit Back Up muss weg das macht alles komplett
   umständlich! … oder du machst einen permanent löschen Button unter den
   ausblenden Button… das ist auch ok."

   Umgesetzt ist die zweite Fassung, und zwar aus einem sachlichen Grund: Der
   Schalter „ab jetzt wird nichts mehr gesichert" wirkt auf ALLES, auch auf
   das, was man morgen doch noch braucht — und er wirkt rückwirkend nicht.
   Ein Knopf DIREKT unter „Ausblenden" trifft dagegen genau die eine Zeile,
   die gerade weg soll, und lässt alles andere in Ruhe.

   ── Was „endgültig" hier ehrlicherweise heißt ──
   Die Quelldatei wird nicht angefasst (Grundsatz ⑦) — sie ist die Grundlage
   aller 47 Standards und wird nie beschrieben. „Endgültig" heißt deshalb:
   Die Zeile ist ausgeblendet UND aus der Wiederherstellungsliste genommen.
   Über „Verwaltung → Ausgeblendete Einträge" kommt sie nicht zurück.

   Das steht auch so auf der Rückfrage-Karte. Ein Knopf, der „endgültig"
   verspricht und in Wahrheit einen Papierkorb füllt, wäre schlimmer als gar
   keiner — dann räumt man zweimal auf und weiß beim zweiten Mal nicht, warum
   alles wieder da ist.

   ── Der eine Weg zurück ──
   Es gibt ihn, aber nur an einer Stelle und mit Absicht: „Verwaltung →
   🗑 Endgültig entfernte Zeilen". Wer dort nachsieht, sucht ausdrücklich —
   niemand stolpert versehentlich darüber. Grundsatz ② verlangt, dass nichts
   unwiederbringlich verschwindet, ohne dass es jemand entschieden hat; diese
   Liste ist die Erfüllung, nicht ihr Widerspruch.
   ───────────────────────────────────────────────────────────── */

let HARTWEG = (typeof loadJSON==='function') ? loadJSON('hkl_hartweg', []) : [];
if(!Array.isArray(HARTWEG)) HARTWEG = [];
function saveHartweg(){ if(typeof saveJSON==='function') saveJSON('hkl_hartweg', HARTWEG); }

function hartWeg(cid){ return HARTWEG.indexOf(String(cid||'')) >= 0; }
function hartAnzahl(){ return HARTWEG.length; }

/* Endgültig entfernen. Die Zeile wird zusätzlich ausgeblendet — sonst hinge
   sie an der Anzeige, wenn dieses Modul einmal fehlt. Zwei Wege, dasselbe
   Ergebnis: Der Rückfall bleibt „unsichtbar", nie „plötzlich wieder da". */
function hartLoeschen(cid){
  const c = String(cid||''); if(!c) return false;
  if(!hartWeg(c)){ HARTWEG.push(c); saveHartweg(); }
  return true;
}
function hartZurueckholen(cid){
  const i = HARTWEG.indexOf(String(cid||''));
  if(i < 0) return false;
  HARTWEG.splice(i,1); saveHartweg();
  return true;
}

/* ── Bedienung: der Knopf im Bearbeiten-Menü ── */

function hartUiLoeschen(){
  const cid = (typeof sheetCid!=='undefined') ? sheetCid : null;
  const e = (typeof sheetEntry!=='undefined') ? sheetEntry : null;
  if(!cid || !e) return;
  const name = (typeof qeGet==='function' && qeGet(e,cid,'name')!==undefined) ? qeGet(e,cid,'name') : (e.anzeige_text||'');
  if(typeof sheetFrage!=='function') return;
  sheetFrage('Endgültig entfernen?',
    'Diese Zeile verschwindet aus der Anzeige und aus der Materialpflege — und sie steht danach NICHT unter „Ausgeblendete Einträge" zum Wiederherstellen. Die Quelldatei bleibt unangetastet; zurückholen geht nur über „Verwaltung → Endgültig entfernte Zeilen".',
    'Endgültig entfernen',
    ()=>{
      hartLoeschen(cid);
      /* Zusätzlich ausblenden, damit die Zeile auch ohne dieses Modul weg ist. */
      if(typeof sheetPending!=='undefined' && typeof applyPending==='function'){
        sheetPending = { kind:'hidden', value:true };
        applyPending('cid', true);
      } else if(typeof showSheet==='function') showSheet(false);
      if(typeof reRenderDetail==='function') reRenderDetail();
      if(typeof toast==='function') toast('„'+String(name).slice(0,30)+'" endgültig entfernt');
    }, true);
}

/* ── Verwaltung: der eine Weg zurück ── */

function hartPanelHTML(){
  const zeilen = HARTWEG.map(cid=>{
    const e = (typeof findEntry==='function') ? findEntry(cid) : null;
    const name = e ? ((e.anzeige_text||e.roh_text||cid)) : cid;
    const sid = String(cid).split('|')[0];
    const std = (typeof DB!=='undefined' && DB && DB.standards) ? DB.standards.find(x=>x.id===sid) : null;
    return `<div class="ukrow"><div class="ukrow-head"><span class="uk-name">${esc(String(name).slice(0,80))}</span></div>
      <div class="vw-ctx">${esc(std?(typeof stdTitel==='function'?stdTitel(std):std.titel):sid)}</div>
      <div class="uk-actions"><button data-c="${esc(cid)}" onclick="hartPanelZurueck(this.dataset.c)">Doch zurückholen</button></div></div>`;
  }).join('');
  const head = (typeof vsum==='function')
    /* 🚮 und nicht 🗑: Der Papierkorb gehört den „Ausgeblendeten Einträgen".
       Zwei gleiche Symbole in derselben Liste sind zwei Panels, die man beim
       Suchen verwechselt — e2e/ui-hardening.js prüft das. */
    ? vsum('🚮','Endgültig entfernte Zeilen','Was über „Endgültig entfernen" weg ist — hier und nur hier zurückholbar', hartAnzahl()||'')
    : `<summary>🚮 Endgültig entfernte Zeilen</summary>`;
  return `<details class="vpanel" data-keys="endgültig endgueltig entfernt geloescht gelöscht hart papierkorb zurueckholen">
    ${head}<div class="vpanel-body">
    <p class="panel-help">Diese Zeilen sind bewusst aus der Wiederherstellungsliste genommen worden. Die Quelldatei wurde dabei nicht verändert — deshalb geht es hier trotzdem zurück, wenn jemand es ausdrücklich will.</p>
    ${hartAnzahl() ? `<div class="fkt-liste">${zeilen}</div>` : `<p class="hint">Nichts endgültig entfernt.</p>`}
    </div></details>`;
}
function hartPanelZurueck(cid){
  hartZurueckholen(cid);
  /* Die Ausblendung an dieser Stelle mit zurücknehmen — sonst bliebe die
     Zeile unsichtbar und der Knopf wirkte folgenlos. */
  if(typeof restoreCid==='function'){ try{ restoreCid(cid); }catch(e){} }
  if(typeof renderAdmin==='function') renderAdmin();
  if(typeof toast==='function') toast('Zurückgeholt');
}
