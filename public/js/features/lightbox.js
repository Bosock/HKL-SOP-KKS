/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — FOTO-DETAILANSICHT (Lightbox mit Zoom)
   App-weit nutzbar: jedes Foto (Anleitungsschritt, Material-Stammsatz,
   Eintrag) lässt sich groß und zoombar ansehen. Im OP/HKL zählt genau das:
   ein Aufbau-Foto muss man heranziehen können, bis das Detail erkennbar ist.

   Bedienung: Tippen öffnet · Doppeltippen zoomt · zwei Finger (Pinch) zoomt
   stufenlos · Ziehen verschiebt · ✕ / Escape / Tippen auf den Hintergrund
   schließt. Das Overlay wird beim ersten Aufruf erzeugt (kein Markup in
   index.html nötig) und danach wiederverwendet.
   ───────────────────────────────────────────────────────────── */

let lbScale = 1, lbX = 0, lbY = 0;              /* aktuelle Transformation */
let lbDragging = false, lbSX = 0, lbSY = 0;     /* Ziehen (Maus/Finger) */
let lbPinchDist = 0, lbPinchScale = 1;          /* Pinch-Ausgangswerte */
let lbLastFocus = null;                         /* Fokus vor dem Öffnen (wird zurückgegeben) */

/* Grenzen für den Zoom – unter 1 sähe das Bild verloren aus, über 6 wird es
   unscharf und man verliert die Orientierung. Rein/testbar. */
function lbClampScale(s){ return Math.max(1, Math.min(6, s)); }
/* Abstand zweier Berührungspunkte (für Pinch). Rein/testbar. */
function lbTouchDist(t1, t2){
  const dx=(t1.clientX-t2.clientX), dy=(t1.clientY-t2.clientY);
  return Math.sqrt(dx*dx + dy*dy);
}

/* Erzeugt (einmalig) das Overlay und liefert es zurück. */
function lbEnsure(){
  let el=document.getElementById('lightbox');
  if(el) return el;
  el=document.createElement('div');
  el.id='lightbox'; el.className='lb'; el.setAttribute('aria-hidden','true');
  el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true'); el.setAttribute('aria-label','Foto in Großansicht');
  el.innerHTML=`<div class="lb-bar">
      <span class="lb-cap" id="lbCap"></span>
      <button type="button" class="lb-btn" id="lbZoomOut" aria-label="Verkleinern">－</button>
      <button type="button" class="lb-btn" id="lbZoomIn" aria-label="Vergrößern">＋</button>
      <button type="button" class="lb-btn lb-close" aria-label="Schließen">✕</button>
    </div>
    <div class="lb-stage" id="lbStage"><img class="lb-img" id="lbImg" alt=""></div>
    <div class="lb-hint">Doppeltippen oder zwei Finger zum Zoomen · Ziehen zum Verschieben</div>`;
  document.body.appendChild(el);

  const stage=el.querySelector('#lbStage');
  const img=el.querySelector('#lbImg');
  /* Hintergrund/✕ schließt – ein Tipp aufs Bild selbst nicht (sonst schließt
     es beim Verschieben versehentlich). */
  el.addEventListener('click',(ev)=>{ if(ev.target===el||ev.target===stage||ev.target.classList.contains('lb-close')) closeLightbox(); });
  el.querySelector('#lbZoomIn').addEventListener('click',(ev)=>{ ev.stopPropagation(); lbZoom(0.5); });
  el.querySelector('#lbZoomOut').addEventListener('click',(ev)=>{ ev.stopPropagation(); lbZoom(-0.5); });

  /* Doppeltippen: zwischen 1× und 2.5× umschalten. */
  let lastTap=0;
  img.addEventListener('click',(ev)=>{ ev.stopPropagation();
    const now=Date.now();
    if(now-lastTap<300){ lbScale=(lbScale>1)?1:2.5; if(lbScale===1){ lbX=0; lbY=0; } lbApply(); }
    lastTap=now; });

  /* Mausrad-Zoom (Desktop/Wandmonitor). */
  stage.addEventListener('wheel',(ev)=>{ ev.preventDefault(); lbZoom(ev.deltaY<0?0.3:-0.3); }, {passive:false});

  /* Ziehen mit der Maus. */
  img.addEventListener('mousedown',(ev)=>{ if(lbScale<=1) return; ev.preventDefault(); lbDragging=true; lbSX=ev.clientX-lbX; lbSY=ev.clientY-lbY; });
  window.addEventListener('mousemove',(ev)=>{ if(!lbDragging) return; lbX=ev.clientX-lbSX; lbY=ev.clientY-lbSY; lbApply(); });
  window.addEventListener('mouseup',()=>{ lbDragging=false; });

  /* Finger: einer verschiebt, zwei zoomen (Pinch). */
  stage.addEventListener('touchstart',(ev)=>{
    if(ev.touches.length===2){ lbPinchDist=lbTouchDist(ev.touches[0],ev.touches[1]); lbPinchScale=lbScale; }
    else if(ev.touches.length===1 && lbScale>1){ lbDragging=true; lbSX=ev.touches[0].clientX-lbX; lbSY=ev.touches[0].clientY-lbY; }
  }, {passive:true});
  stage.addEventListener('touchmove',(ev)=>{
    if(ev.touches.length===2 && lbPinchDist>0){ ev.preventDefault();
      const d=lbTouchDist(ev.touches[0],ev.touches[1]);
      lbScale=lbClampScale(lbPinchScale*(d/lbPinchDist));
      if(lbScale===1){ lbX=0; lbY=0; }
      lbApply(); }
    else if(lbDragging && ev.touches.length===1){ ev.preventDefault();
      lbX=ev.touches[0].clientX-lbSX; lbY=ev.touches[0].clientY-lbSY; lbApply(); }
  }, {passive:false});
  stage.addEventListener('touchend',()=>{ lbDragging=false; lbPinchDist=0; }, {passive:true});

  /* Escape schließt (Desktop). */
  document.addEventListener('keydown',(ev)=>{ if(ev.key==='Escape' && el.classList.contains('show')) closeLightbox(); });
  return el;
}

function lbApply(){ const img=document.getElementById('lbImg'); if(!img) return;
  img.style.transform='translate('+lbX+'px,'+lbY+'px) scale('+lbScale+')';
  img.style.cursor=(lbScale>1)?'grab':'zoom-in'; }
function lbZoom(delta){ lbScale=lbClampScale(lbScale+delta); if(lbScale===1){ lbX=0; lbY=0; } lbApply(); }

/* Öffnet ein Bild groß. src = dataURL/Pfad, caption = optionale Bildunterschrift. */
function openLightbox(src, caption){
  if(!src) return;
  const el=lbEnsure();
  const img=el.querySelector('#lbImg'); const cap=el.querySelector('#lbCap');
  lbScale=1; lbX=0; lbY=0;
  img.src=src; img.alt=caption||'Foto';
  if(cap) cap.textContent=caption||'';
  lbApply();
  el.classList.add('show'); el.setAttribute('aria-hidden','false');
  /* Fokus in den Dialog holen und beim Schließen zurückgeben (Tastatur/
     Screenreader dürfen nicht im Hintergrund hängen bleiben). */
  try{ lbLastFocus=document.activeElement; }catch(e){ lbLastFocus=null; }
  const close=el.querySelector('.lb-close'); if(close) setTimeout(()=>{ try{ close.focus(); }catch(e){} },30);
}
function closeLightbox(){ const el=document.getElementById('lightbox'); if(!el) return;
  el.classList.remove('show'); el.setAttribute('aria-hidden','true');
  const img=el.querySelector('#lbImg'); if(img) img.src='';
  if(lbLastFocus){ try{ lbLastFocus.focus(); }catch(e){} lbLastFocus=null; } }

/* Delegierter Klick-Handler: jedes Bild mit [data-zoom] öffnet die Lightbox.
   So brauchen einzelne Ansichten keinen eigenen onclick — sie setzen nur das
   Attribut. Wird von main.js einmalig registriert. */
function initLightbox(){
  document.addEventListener('click',(ev)=>{
    const t=ev.target;
    if(!t || t.tagName!=='IMG') return;
    if(!t.hasAttribute('data-zoom')) return;
    ev.preventDefault(); ev.stopPropagation();
    openLightbox(t.getAttribute('src'), t.getAttribute('data-cap')||'');
  }, true);
}
