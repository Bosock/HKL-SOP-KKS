/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — FOTO-EDITOR (Zuschneiden + Drehen)
   Wiederverwendbarer Overlay-Editor: openPhotoEditor(dataUrl, cb) zeigt das
   Bild, lässt es in 90°-Schritten drehen und mit einem Rechteck zuschneiden.
   cb(ergebnisDataUrl) liefert das bearbeitete Bild; cb(null) = Abbruch.
   Läuft rein clientseitig (Canvas), kein Upload. Genutzt von „Material
   pflegen" (care.js) und dem Etikett-Produkt (scanner.js).
   ───────────────────────────────────────────────────────────── */

/* Reine, testbare Geometrie: aus Natur-Größe, Rotation (0/90/180/270) und
   Auswahl-Rechteck (Bruchteile 0..1 der GEDREHTEN Ansicht) die Pixel-Maße des
   Ergebnisses (und der gedrehten Vollansicht) berechnen. */
function photoCropDims(natW, natH, rot, sel){
  rot=(((rot||0)%360)+360)%360;
  natW=Math.max(1,natW|0); natH=Math.max(1,natH|0);
  const rw=(rot===90||rot===270)?natH:natW;
  const rh=(rot===90||rot===270)?natW:natH;
  const cl=(v)=>Math.max(0,Math.min(1,(v==null?0:v)));
  sel=sel||{}; const x=cl(sel.x), y=cl(sel.y);
  const w=cl(sel.w==null?1:sel.w), h=cl(sel.h==null?1:sel.h);
  const sx=Math.round(x*rw), sy=Math.round(y*rh);
  const sw=Math.max(1,Math.round(Math.min(w,1-x)*rw));
  const sh=Math.max(1,Math.round(Math.min(h,1-y)*rh));
  return { rw, rh, sx, sy, sw, sh };
}
/* Wendet Rotation + Zuschnitt auf ein geladenes <img> an → data-URL (JPEG). */
function photoApply(img, rot, sel){
  const d=photoCropDims(img.naturalWidth||img.width, img.naturalHeight||img.height, rot, sel);
  const full=document.createElement('canvas'); full.width=d.rw; full.height=d.rh;
  const fx=full.getContext('2d'); fx.save();
  const r=(((rot||0)%360)+360)%360;
  if(r===90){ fx.translate(d.rw,0); fx.rotate(Math.PI/2); }
  else if(r===180){ fx.translate(d.rw,d.rh); fx.rotate(Math.PI); }
  else if(r===270){ fx.translate(0,d.rh); fx.rotate(3*Math.PI/2); }
  fx.drawImage(img,0,0); fx.restore();
  const out=document.createElement('canvas'); out.width=d.sw; out.height=d.sh;
  out.getContext('2d').drawImage(full, d.sx, d.sy, d.sw, d.sh, 0,0, d.sw, d.sh);
  return out.toDataURL('image/jpeg',0.9);
}

let _peOv=null;
function openPhotoEditor(dataUrl, cb){
  if(!dataUrl){ cb&&cb(null); return; }
  const img=new Image();
  img.onload=()=>{ try{ _peBuild(img, cb); }catch(e){ cb&&cb(dataUrl); } };
  img.onerror=()=>cb&&cb(dataUrl);   /* Dekodieren fehlgeschlagen → Original */
  img.src=dataUrl;
}
function _peBuild(img, cb){
  if(_peOv){ try{ document.body.removeChild(_peOv); }catch(e){} _peOv=null; }
  const ov=document.createElement('div'); _peOv=ov; ov.id='photoEditOv';
  ov.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.94);display:flex;flex-direction:column';
  const bar=document.createElement('div');
  bar.style.cssText='display:flex;gap:8px;justify-content:center;align-items:center;padding:12px;flex-wrap:wrap;background:rgba(0,0,0,.5)';
  bar.innerHTML='<button type="button" class="btn btn-sec" id="peRot" style="min-width:auto">↻ Drehen</button>'
    +'<button type="button" class="btn btn-sec" id="peReset" style="min-width:auto">⤢ Ganzes Bild</button>'
    +'<button type="button" class="btn btn-sec" id="peCancel" style="min-width:auto">Abbrechen</button>'
    +'<button type="button" class="btn btn-pri" id="peApply" style="min-width:auto">✓ Übernehmen</button>';
  const hint=document.createElement('div');
  hint.textContent='Rahmen ziehen zum Zuschneiden · Ecken zum Verkleinern';
  hint.style.cssText='text-align:center;color:#ccc;font-size:12.5px;padding:0 12px 8px';
  const stage=document.createElement('div');
  stage.style.cssText='flex:1;position:relative;overflow:hidden;touch-action:none;user-select:none';
  const cv=document.createElement('canvas'); cv.style.cssText='position:absolute;left:0;top:0';
  const box=document.createElement('div');
  box.style.cssText='position:absolute;border:2px solid #fff;box-shadow:0 0 0 9999px rgba(0,0,0,.5);box-sizing:border-box;cursor:move';
  ['nw','ne','sw','se'].forEach(h=>{ const d=document.createElement('div'); d.dataset.h=h; d.className='pe-h';
    d.style.cssText='position:absolute;width:26px;height:26px;background:#fff;border-radius:50%;box-shadow:0 0 3px rgba(0,0,0,.6);'
      +(h[0]==='n'?'top:-13px;':'bottom:-13px;')+(h[1]==='w'?'left:-13px;':'right:-13px;');
    box.appendChild(d); });
  stage.appendChild(cv); stage.appendChild(box);
  ov.appendChild(bar); ov.appendChild(hint); ov.appendChild(stage);
  document.body.appendChild(ov);

  const st={ rot:0, sel:{x:0.04,y:0.04,w:0.92,h:0.92}, disp:null };
  const rotatedDims=()=>{ const r=st.rot,nw=img.naturalWidth,nh=img.naturalHeight; return (r===90||r===270)?{w:nh,h:nw}:{w:nw,h:nh}; };
  function layout(){
    const rd=rotatedDims(); const sw=stage.clientWidth||1, sh=stage.clientHeight||1;
    const scale=Math.min(sw/rd.w, sh/rd.h)||1; const dw=Math.max(1,Math.round(rd.w*scale)), dh=Math.max(1,Math.round(rd.h*scale));
    const ox=Math.round((sw-dw)/2), oy=Math.round((sh-dh)/2);
    cv.width=rd.w; cv.height=rd.h; cv.style.width=dw+'px'; cv.style.height=dh+'px'; cv.style.left=ox+'px'; cv.style.top=oy+'px';
    const cx=cv.getContext('2d'); cx.clearRect(0,0,rd.w,rd.h); cx.save(); const r=st.rot;
    if(r===90){ cx.translate(rd.w,0); cx.rotate(Math.PI/2); }
    else if(r===180){ cx.translate(rd.w,rd.h); cx.rotate(Math.PI); }
    else if(r===270){ cx.translate(0,rd.h); cx.rotate(3*Math.PI/2); }
    cx.drawImage(img,0,0); cx.restore();
    st.disp={ox,oy,dw,dh}; drawBox();
  }
  function drawBox(){ const {ox,oy,dw,dh}=st.disp, s=st.sel;
    box.style.left=(ox+s.x*dw)+'px'; box.style.top=(oy+s.y*dh)+'px'; box.style.width=(s.w*dw)+'px'; box.style.height=(s.h*dh)+'px'; }
  let drag=null;
  const pt=(e)=>{ const r=stage.getBoundingClientRect(); const t=(e.touches&&e.touches[0])||e; return {x:t.clientX-r.left,y:t.clientY-r.top}; };
  const toFrac=(p)=>{ const {ox,oy,dw,dh}=st.disp; return {x:(p.x-ox)/dw, y:(p.y-oy)/dh}; };
  stage.addEventListener('pointerdown',(e)=>{ if(!st.disp) return; const f=toFrac(pt(e)); const s=st.sel;
    if(e.target&&e.target.classList&&e.target.classList.contains('pe-h')){ drag={mode:'resize',h:e.target.dataset.h}; }
    else if(f.x>=s.x&&f.x<=s.x+s.w&&f.y>=s.y&&f.y<=s.y+s.h){ drag={mode:'move',fx:f.x-s.x,fy:f.y-s.y}; }
    else drag=null;
    if(drag){ try{ stage.setPointerCapture(e.pointerId); }catch(_){} } });
  stage.addEventListener('pointermove',(e)=>{ if(!drag||!st.disp) return; const f=toFrac(pt(e)); const s=st.sel; const cl=(v)=>Math.max(0,Math.min(1,v)); const min=0.06;
    if(drag.mode==='move'){ s.x=cl(f.x-drag.fx); s.y=cl(f.y-drag.fy); if(s.x+s.w>1)s.x=1-s.w; if(s.y+s.h>1)s.y=1-s.h; }
    else { let x1=s.x,y1=s.y,x2=s.x+s.w,y2=s.y+s.h;
      if(drag.h[1]==='w') x1=cl(f.x); else x2=cl(f.x);
      if(drag.h[0]==='n') y1=cl(f.y); else y2=cl(f.y);
      if(x2-x1<min){ if(drag.h[1]==='w')x1=x2-min; else x2=x1+min; }
      if(y2-y1<min){ if(drag.h[0]==='n')y1=y2-min; else y2=y1+min; }
      s.x=cl(Math.min(x1,x2)); s.y=cl(Math.min(y1,y2)); s.w=Math.min(1-s.x,Math.abs(x2-x1)); s.h=Math.min(1-s.y,Math.abs(y2-y1)); }
    drawBox(); });
  const end=()=>{ drag=null; };
  stage.addEventListener('pointerup',end); stage.addEventListener('pointercancel',end);
  const onResize=()=>layout();
  function close(){ window.removeEventListener('resize',onResize); try{ document.body.removeChild(ov); }catch(e){} if(_peOv===ov)_peOv=null; }
  document.getElementById('peRot').onclick=()=>{ st.rot=(st.rot+90)%360; st.sel={x:0.04,y:0.04,w:0.92,h:0.92}; layout(); };
  document.getElementById('peReset').onclick=()=>{ st.sel={x:0,y:0,w:1,h:1}; drawBox(); };
  document.getElementById('peCancel').onclick=()=>{ close(); cb&&cb(null); };
  document.getElementById('peApply').onclick=()=>{ let out; try{ out=photoApply(img, st.rot, st.sel); }catch(e){ out=null; } close(); cb&&cb(out); };
  window.addEventListener('resize',onResize);
  /* Layout nach dem Einhängen (Stage hat dann Maße). */
  if(typeof requestAnimationFrame==='function') requestAnimationFrame(layout); else setTimeout(layout,0);
}
