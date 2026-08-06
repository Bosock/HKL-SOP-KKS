/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — REIHENFOLGE ZIEHEN

   Die Reihenfolge einer Rubrik ließ sich bisher nur über das ⋯-Menü ändern:
   Menü öffnen, „⬆ Nach oben", Menü schließt, Ansicht baut sich neu auf —
   und das je Position einmal. Eine Zeile von Platz 20 auf Platz 2 zu bringen
   waren achtzehn solcher Runden. Der Wunsch war entsprechend alt:
   „Reihenfolge einzelner Einträge ziehen."

   ── Warum ein eigener MODUS und nicht einfach ein Ziehen an der Zeile ──
   Die Eintragszeile ist schon dreifach belegt: kurz tippen hakt ab, lang
   halten öffnet das ⋯-Menü, die kleinen Schalter darin tun ihr Eigenes. Ein
   viertes Verhalten auf derselben Fläche wäre keine Bedienung mehr, sondern
   ein Ratespiel — besonders mit Handschuhen. Also: „↕ Reihenfolge ändern"
   schaltet die Rubrik in eine ZWEITE, ruhige Ansicht. Dort bedeutet Ziehen
   genau eines, und sonst passiert nichts. „✓ Fertig" bringt die normale
   Ansicht zurück.

   ── Ziehen UND Knöpfe ──
   Gezogen wird am Griff (⠿). Daneben stehen ⬆ ⬇ und ⤒ ⤓. Das ist kein
   Zaudern: Ziehen ist schnell, wenn es klappt — mit dicken Handschuhen auf
   einem beschlagenen Tablet klappt es nicht immer, und dann muss es trotzdem
   gehen. Dieselbe Reihenfolge lässt sich außerdem per Tastatur bedienen, was
   ein reines Ziehen nie könnte.

   ── Was NICHT geht, und warum das richtig ist ──
   Über eine Gruppengrenze hinweg lässt sich nichts ziehen. Die Reihenfolge
   ist je Abschnitt gespeichert (`ENTORD`, Schlüssel aus `orderKeyFor`) — eine
   Zeile in einen anderen Abschnitt zu bewegen ist keine Sortierung, sondern
   ein Wechsel der Unterkategorie bzw. ein Verschieben. Dafür gibt es das
   ⋯-Menü, und dort steht auch, was dabei passiert. Die Gruppen sind deshalb
   sichtbar getrennt, statt dass ein Zug stillschweigend nichts bewirkt.

   Die Quelldatei wird nicht angefasst: Gespeichert wird eine Liste von
   Kennungen je Abschnitt (Grundsatz ⑦).
   ───────────────────────────────────────────────────────────── */

/* ═══════════ 1. Reine Umordnung (testbar, ohne Bildschirm) ═══════════ */

/* Ein Element von einer Position an eine andere. Ziele außerhalb der Liste
   werden an den Rand gezogen, statt den Vorgang scheitern zu lassen — wer
   über das Ende hinauszieht, meint „ganz nach unten". */
function sortVerschieben(liste, von, nach){
  const arr = (liste||[]).slice();
  if(!arr.length || von<0 || von>=arr.length) return arr;
  const ziel = Math.max(0, Math.min(arr.length-1, nach));
  if(ziel === von) return arr;
  const x = arr.splice(von,1)[0];
  arr.splice(ziel,0,x);
  return arr;
}
/* Dasselbe, aber über die Kennung und in Worten: hoch · runter · anfang · ende. */
function sortRang(liste, cid, richtung){
  const arr = (liste||[]).slice();
  const i = arr.indexOf(cid);
  if(i<0) return arr;
  let nach = i;
  if(richtung==='hoch') nach = i-1;
  else if(richtung==='runter') nach = i+1;
  else if(richtung==='anfang') nach = 0;
  else if(richtung==='ende') nach = arr.length-1;
  return sortVerschieben(arr, i, nach);
}

/* ═══════════ 2. Zustand ═══════════ */

let sortRi = null;          /* Rubrik im Sortiermodus (Index) — null = aus */
let sortZug = null;         /* laufender Zug: {el, box, okey} */

function sortAktiv(){ return sortRi !== null; }
function sortAktivFuer(idx){ return sortRi === idx; }

function sortAn(idx){
  if(typeof ADMIN!=='undefined' && !ADMIN){ if(typeof promptLoginThen==='function'){ promptLoginThen(()=>sortAn(idx)); return; } }
  sortRi = idx;
  if(typeof openRubrik==='function') openRubrik(idx, true);
}
function sortAus(){
  const idx = sortRi; sortRi = null; sortZug = null;
  if(idx!==null && typeof openRubrik==='function') openRubrik(idx, true);
}
/* Beim Verlassen der Rubrik still aufräumen (kein Neuzeichnen — wer das
   aufruft, wechselt ohnehin die Ansicht). Der Sortiermodus ist ein
   Arbeitszustand wie ein offenes Formular, kein Merkmal der Rubrik: Wer später
   zurückkommt, will die normale Ansicht sehen und nicht rätseln, warum die
   Zeilen anders aussehen. */
function sortBeenden(){ sortRi = null; sortZug = null; }

/* ═══════════ 3. Die Gruppen ═══════════ */

/* Eine Gruppe ist genau das, was EINE gespeicherte Reihenfolge hat: bei
   Material/Geräten die Unterkategorie, sonst der Abschnitt. Genau deshalb
   kann nicht darüber hinweg gezogen werden. */
function sortGruppen(idx){
  if(typeof curStd==='undefined' || !curStd) return [];
  const r = (curStd.rubriken||[])[idx]; if(!r) return [];
  const istMatGer = (r.typ==='material' || r.typ==='geraete');
  const aus = [];
  if(istMatGer){
    const gesehen = [];
    const merke = (e, cid)=>{
      if(!e || e.natur==='ueberschrift') return;
      if(typeof qeGet==='function' && qeGet(e,cid,'hidden')===true) return;
      const uk = (typeof canonUk==='function') ? (canonUk(e,cid)||'') : '';
      if(gesehen.indexOf(uk)<0) gesehen.push(uk);
    };
    (r.sub_bereiche||[]).forEach((sb,si)=>{ (sb.eintraege||[]).forEach((e,ei)=>{
      merke(e, cidOf(curStd.id,idx,si,ei)); }); });
    if(typeof newEntriesFor==='function'){
      newEntriesFor(r,idx).forEach(n=>{ merke(newToEntry(n), 'new|'+n.id); });
    }
    gesehen.forEach(uk=>{
      const items = (typeof collectGroupCids==='function') ? collectGroupCids(idx,uk) : [];
      if(items.length) aus.push({ okey:orderKeyFor(idx,uk), titel:uk||'ohne Abschnitt', items });
    });
  } else {
    const seg = (typeof ablaufSegments==='function') ? ablaufSegments(idx) : {blocks:[]};
    (seg.blocks||[]).forEach(b=>{
      if(b.items && b.items.length) aus.push({ okey:orderKeyFor(idx,b.segId), titel:b.head||'ohne Überschrift', items:b.items });
    });
  }
  return aus;
}

/* Die gespeicherte Reihenfolge einer Gruppe festschreiben. */
function sortSchreiben(okey, cids){
  if(!okey || !Array.isArray(cids) || !cids.length) return false;
  if(typeof ENTORD==='undefined') return false;
  ENTORD[okey] = cids.slice();
  if(typeof saveENTORD==='function') saveENTORD();
  return true;
}

/* ═══════════ 4. Die Ansicht ═══════════ */

function sortRender(idx){
  const box = $('scr-detail'); if(!box) return;
  const r = curStd.rubriken[idx];
  const gruppen = sortGruppen(idx);
  const name = (typeof rubName==='function') ? rubName(r,idx) : (r.name||'');

  let h = `<div class="banner srt-kopf"><h2>↕ Reihenfolge ändern</h2>
    <p>Am Griff <b>⠿</b> ziehen — oder die Knöpfe benutzen. Sortiert wird <b>innerhalb eines Abschnitts</b>; in einen anderen Abschnitt kommt eine Zeile über „⋯ → Unterkategorie" bzw. „⋯ → Verschieben".</p>
    <div class="p-actions"><button class="btn btn-pri" onclick="sortAus()">✓ Fertig</button></div></div>`;

  if(!gruppen.length){
    h += `<div class="empty"><div class="ei">↕</div><h3>Nichts zu sortieren</h3><p>In dieser Rubrik steht keine sichtbare Zeile.</p></div>`;
    box.innerHTML = h; show('scr-detail');
    if(typeof setBar==='function') setBar(name, 'Reihenfolge', true);
    return;
  }

  gruppen.forEach(g=>{
    h += `<div class="srt-gruppe" data-okey="${esc(g.okey)}">
      <div class="srt-titel">${esc(g.titel)} <span class="srt-n">${g.items.length}</span></div>`;
    g.items.forEach(x=>{
      const dn = (typeof qeGet==='function' && qeGet(x.e,x.cid,'name')!==undefined) ? qeGet(x.e,x.cid,'name') : (x.e.anzeige_text||'');
      const mengeRoh = (typeof qeGet==='function' && qeGet(x.e,x.cid,'mengeVal')!==undefined) ? qeGet(x.e,x.cid,'mengeVal') : x.e.menge;
      const nat = (typeof effNatur==='function') ? effNatur(x.e,x.cid) : (x.e.natur||'');
      const farbe = (typeof natOf==='function') ? (natOf(nat).color||'#888') : '#888';
      h += `<div class="srt-zeile" data-cid="${esc(x.cid)}">
        <button type="button" class="srt-griff" aria-label="Zum Ziehen halten">⠿</button>
        <span class="srt-farbe" style="background:${esc(farbe)}"></span>
        <span class="srt-text">${mengeRoh?`<span class="srt-menge">${esc(mengeRoh)}</span>`:''}${esc(dn)}</span>
        <span class="srt-akt">
          <button type="button" data-o="${esc(g.okey)}" data-c="${esc(x.cid)}" onclick="sortUiRang(this.dataset.o,this.dataset.c,'anfang')" aria-label="Ganz nach oben">⤒</button>
          <button type="button" data-o="${esc(g.okey)}" data-c="${esc(x.cid)}" onclick="sortUiRang(this.dataset.o,this.dataset.c,'hoch')" aria-label="Nach oben">⬆</button>
          <button type="button" data-o="${esc(g.okey)}" data-c="${esc(x.cid)}" onclick="sortUiRang(this.dataset.o,this.dataset.c,'runter')" aria-label="Nach unten">⬇</button>
          <button type="button" data-o="${esc(g.okey)}" data-c="${esc(x.cid)}" onclick="sortUiRang(this.dataset.o,this.dataset.c,'ende')" aria-label="Ganz nach unten">⤓</button>
        </span></div>`;
    });
    h += `</div>`;
  });
  h += `<button class="add-entry-btn" onclick="sortAus()">✓ Fertig — zurück zur Rubrik</button>`;
  box.innerHTML = h;
  show('scr-detail');
  if(typeof setBar==='function') setBar(name, 'Reihenfolge ändern', true);
  sortZiehenBinden();
}

/* ── Knöpfe ── */
function sortUiRang(okey, cid, richtung){
  const g = sortGruppen(sortRi).find(x=>x.okey===okey); if(!g) return;
  const liste = g.items.map(x=>x.cid);
  const i = liste.indexOf(cid);
  if((richtung==='hoch'||richtung==='anfang') && i===0){ if(typeof toast==='function') toast('Schon ganz oben'); return; }
  if((richtung==='runter'||richtung==='ende') && i===liste.length-1){ if(typeof toast==='function') toast('Schon ganz unten'); return; }
  sortSchreiben(okey, sortRang(liste, cid, richtung));
  sortRender(sortRi);
}

/* ── Ziehen ──
   Bewusst über Zeiger-Ereignisse und echtes Umhängen der Zeilen: Die native
   Drag-and-Drop-Schnittstelle des Browsers gibt es auf Android-Tablets nicht,
   und eine Rechnung mit Verschiebungen wäre ein zweiter Zustand neben dem
   DOM — mit allen Gelegenheiten, dass beide auseinanderlaufen. Am Ende wird
   schlicht abgelesen, in welcher Folge die Zeilen stehen. */
function sortZiehenBinden(){
  const box = $('scr-detail'); if(!box) return;
  [...box.querySelectorAll('.srt-griff')].forEach(griff=>{
    griff.addEventListener('pointerdown', sortZiehStart);
  });
}
/* WICHTIG, und teuer gelernt: Die Ereignisse hängen am DOKUMENT, nicht am
   Griff. Beim Ziehen wird die Zeile per insertBefore umgehängt — ein Knoten,
   der aus dem Baum genommen und neu eingesetzt wird, VERLIERT seine
   Zeigerbindung (setPointerCapture, und bei Berührung die stillschweigende
   Bindung an das Ziel). Danach kam kein `pointerup` mehr am Griff an: Der Zug
   endete nie, und gespeichert wurde nichts. Am Dokument sieht man jedes
   Ereignis, unabhängig davon, wohin der Knoten gewandert ist. */
function sortZiehStart(ev){
  const griff = ev.currentTarget;
  const zeile = griff.closest('.srt-zeile');
  const gruppe = zeile && zeile.closest('.srt-gruppe');
  if(!zeile || !gruppe) return;
  ev.preventDefault();
  sortZug = { el:zeile, box:gruppe, okey:gruppe.dataset.okey, griff, id:ev.pointerId };
  zeile.classList.add('zieht');
  try{ if(navigator.vibrate) navigator.vibrate(10); }catch(e){}
  document.addEventListener('pointermove', sortZiehen, { passive:false });
  document.addEventListener('pointerup', sortZiehEnde);
  document.addEventListener('pointercancel', sortZiehEnde);
}
function sortZiehen(ev){
  if(!sortZug) return;
  if(ev.pointerId!==undefined && ev.pointerId!==sortZug.id) return;   /* zweiter Finger zieht nicht mit */
  if(ev.cancelable) ev.preventDefault();
  const unter = document.elementFromPoint(ev.clientX, ev.clientY);
  const ziel = unter && unter.closest ? unter.closest('.srt-zeile') : null;
  /* Nur innerhalb derselben Gruppe — über die Grenze hinweg gibt es keine
     gemeinsame Reihenfolge, die man ändern könnte. */
  if(ziel && ziel!==sortZug.el && ziel.parentElement===sortZug.box){
    const r = ziel.getBoundingClientRect();
    const nachUnten = ev.clientY > (r.top + r.height/2);
    sortZug.box.insertBefore(sortZug.el, nachUnten ? ziel.nextSibling : ziel);
  }
  sortRandScrollen(ev.clientY);
}
/* Am Rand mitlaufen — sonst endet jeder Zug am Bildschirmrand. */
function sortRandScrollen(y){
  const h = (typeof window!=='undefined' && window.innerHeight) ? window.innerHeight : 800;
  const el = $('main') || document.scrollingElement || document.documentElement;
  if(!el || typeof el.scrollBy!=='function') return;
  if(y < 90) el.scrollBy(0, -14);
  else if(y > h-90) el.scrollBy(0, 14);
}
function sortZiehEnde(ev){
  if(!sortZug) return;
  if(ev && ev.pointerId!==undefined && ev.pointerId!==sortZug.id) return;
  const { el, box, okey } = sortZug;
  document.removeEventListener('pointermove', sortZiehen, { passive:false });
  document.removeEventListener('pointerup', sortZiehEnde);
  document.removeEventListener('pointercancel', sortZiehEnde);
  el.classList.remove('zieht');
  sortZug = null;
  const cids = [...box.querySelectorAll('.srt-zeile')].map(z=>z.dataset.cid).filter(Boolean);
  const vorher = (typeof ENTORD!=='undefined' && ENTORD[okey]) ? ENTORD[okey].join('|') : '';
  sortSchreiben(okey, cids);
  sortRender(sortRi);
  /* Nur melden, wenn sich wirklich etwas geändert hat — ein Griff, den man
     nur kurz berührt hat, ist keine Änderung und braucht keine Meldung. */
  if(vorher !== cids.join('|') && typeof toast==='function') toast('Reihenfolge gespeichert');
}
