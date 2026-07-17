/* ============ Pflege ============ */
function renderCare(){ const box=$('scr-care'); let list=MAT_INDEX;
  if(careFilter==='offen') list=MAT_INDEX.filter(m=>!careMem[m.key]);
  if(careFilter==='material') list=MAT_INDEX.filter(m=>m.typ==='material');
  if(careFilter==='geraet') list=MAT_INDEX.filter(m=>m.typ==='geraet');
  const done=MAT_INDEX.filter(m=>careMem[m.key]).length; const pct=MAT_INDEX.length?Math.round(done/MAT_INDEX.length*100):0;
  let html=`<div class="banner"><h2>${esc(txt('careTitle'))}</h2><p>${esc(txt('careIntro'))}<br><b>Hinweis:</b> Foto und Lagerort werden zentral auf dem Server gespeichert und auf allen Geräten geteilt.</p><div class="prog"><div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div><div class="prog-txt">${done} von ${MAT_INDEX.length} gepflegt (${pct} %)</div></div></div>
  <div class="filter-row"><button class="${careFilter==='alle'?'on':''}" onclick="setCareFilter('alle')">Alle</button><button class="${careFilter==='offen'?'on':''}" onclick="setCareFilter('offen')">Offen</button><button class="${careFilter==='material'?'on':''}" onclick="setCareFilter('material')">Material</button><button class="${careFilter==='geraet'?'on':''}" onclick="setCareFilter('geraet')">Gerät</button></div>`;
  if(list.length===0) html+=`<div class="empty"><div class="ei">✓</div><h3>Nichts in diesem Filter</h3><p>Wechsle den Filter.</p></div>`;
  list.forEach(m=>{ const c=careMem[m.key]; const thumb=c&&c.photo?`<div class="mat-thumb"><img src="${c.photo}" alt=""></div>`:`<div class="mat-thumb">${natOf(m.typ).icon||'📷'}</div>`;
    const st=c?`<span class="mat-sub ok"><span class="dot dot-ok"></span>Gepflegt${c.loc?' · '+esc(c.loc):''}</span>`:`<span class="mat-sub open"><span class="dot dot-open"></span>Offen</span>`;
    const sizes=m.groessen&&m.groessen.length?' '+sizeBadges(m.groessen):'';
    /* material_key ist Freitext (kann ' enthalten) → data-Attribut statt
       Inline-String-Literal (esc() macht den Wert Attribut-sicher). */
    html+=`<div class="mat-row" style="border-left-color:var(--n-${esc(m.typ)})" data-k="${esc(m.key)}" onclick="openCare(this.dataset.k)">${thumb}<div class="mat-main"><div class="mat-name">${esc(m.name)}</div><div class="mat-sub">${st}${sizes}</div></div><span class="mat-count">${m.vorkommen}×</span></div>`; });
  box.innerHTML=html;
}
function setCareFilter(f){ careFilter=f; renderCare(); }
function openCare(key){ const m=MAT_INDEX.find(x=>x.key===key); if(!m) return; const c=careMem[key]||{}; const pd=PROD[key]||{};
  const sizes=m.groessen&&m.groessen.length?`<div class="info-field"><div class="if-l">Größen (automatisch erkannt)</div><div class="if-v">${sizeBadges(m.groessen)}</div></div>`:'';
  const photoInner=c.photo?`<img src="${c.photo}" style="width:100%;height:100%;object-fit:cover" alt="">`:`<div class="ph-ico">📷</div><div class="ph-sub">Foto aufnehmen oder wählen</div>`;
  $('scr-care-item').innerHTML=`<div class="pcard"><div class="pc-name">${esc(m.name)}</div><div class="pc-ctx">Kommt in ${m.vorkommen} Standard(s) vor · ${esc(natOf(m.typ).label)}</div>${sizes}
    <div class="flabel">FOTO</div><div class="photo-zone" onclick="$('fileInp').click()" id="photoZone">${photoInner}</div>
    <input type="file" id="fileInp" accept="image/*" style="display:none" data-k="${esc(key)}" onchange="onPhoto(event,this.dataset.k)">
    <div class="flabel">LAGERORT</div><input class="loc-input" id="locInp" placeholder="z. B. Vorbereitungsraum · Regal A" value="${esc(c.loc||'')}">
    <div class="flabel" style="margin-top:14px">HERSTELLER (optional)</div><input class="loc-input" id="prodHersteller" placeholder="z. B. Terumo" value="${esc(pd.hersteller||'')}">
    <div class="flabel">REF / BESTELLNR. (optional)</div><input class="loc-input" id="prodRef" placeholder="z. B. RM*RG5J40" value="${esc(pd.ref||'')}">
    <div class="flabel">VERWENDUNG (optional)</div><input class="loc-input" id="prodVerw" placeholder="z. B. femoraler Zugang" value="${esc(pd.verwendung||'')}">
    <div class="flabel">STÜCKPREIS € (optional)</div><input class="loc-input" id="prodPreis" inputmode="decimal" placeholder="z. B. 12,50" value="${esc(pd.preis!=null?String(pd.preis).replace('.',','):'')}">
    <div class="p-actions"><button class="btn btn-sec" onclick="goBack()">Zurück</button><button class="btn btn-pri" data-k="${esc(key)}" onclick="saveCare(this.dataset.k)">Speichern</button></div></div>
    <div class="foot">Foto, Lagerort und Preisangaben werden zentral auf dem Server gespeichert und auf allen Geräten geteilt. Aus den Stückpreisen werden die Plankosten je Standard berechnet.</div>`;
  show('scr-care-item'); setBar(m.name,'Material pflegen',true);
}
/* Verkleinert ein Foto clientseitig (max. Kante 1280px, JPEG ~82 %), bevor es
   als data-URL in den geteilten Zustand wandert. Ohne das wären Handyfotos
   4–16 MB Base64 pro Bild: wenige Fotos füllen das Server-Limit (MAX_BODY)
   und jede Synchronisation überträgt alle Fotos an alle Geräte. Schlägt das
   Dekodieren fehl (exotisches Format), bleibt das Original der Fallback. */
function shrinkPhoto(dataUrl,cb){ const MAX=1280; const img=new Image();
  img.onload=()=>{ try{
      let w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
      if(!w||!h){ cb(dataUrl); return; }
      if(w>MAX||h>MAX){ const f=MAX/Math.max(w,h); w=Math.round(w*f); h=Math.round(h*f); }
      const c=document.createElement('canvas'); c.width=w; c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      const out=c.toDataURL('image/jpeg',0.82);
      /* nur übernehmen, wenn wirklich kleiner – sonst Original behalten */
      cb(out.length<dataUrl.length?out:dataUrl);
    }catch(e){ cb(dataUrl); } };
  img.onerror=()=>cb(dataUrl);
  img.src=dataUrl; }
function onPhoto(ev,key){ const f=ev.target.files&&ev.target.files[0]; if(!f) return; const r=new FileReader();
  r.onload=()=>{ shrinkPhoto(r.result,(photo)=>{ const z=$('photoZone'); if(z){ z.innerHTML=`<img src="${photo}" style="width:100%;height:100%;object-fit:cover" alt="">`; z.dataset.photo=photo; } }); };
  r.readAsDataURL(f); }

/* Verkleinert einmalig ALT-Fotos, die vor Einführung der automatischen
   Verkleinerung in Originalgröße gespeichert wurden (QA-Befund P1: solche
   Bestände füllen Geräte-Quota und Server-Limit). Läuft im Leerlauf nach dem
   Start, ein Foto je Tick; idempotent über die Größenprüfung; das Ergebnis
   wird geteilt gespeichert — EIN Gerät saniert damit den Bestand für alle. */
const CARE_PHOTO_MAX=400000; /* ~300 KB Base64 – darüber wird nachverkleinert */
function migrateCarePhotos(done){
  let changed=false;
  const keys=Object.keys(careMem).filter(k=>careMem[k]&&careMem[k].photo&&careMem[k].photo.length>CARE_PHOTO_MAX);
  let i=0;
  (function step(){
    if(i>=keys.length){ if(changed) saveJSON('hkl_care',careMem); if(done) done({migrated:changed?keys.length:0}); return; }
    const k=keys[i++];
    try{ shrinkPhoto(careMem[k].photo,(small)=>{ if(small&&small.length<careMem[k].photo.length){ careMem[k].photo=small; changed=true; } setTimeout(step,120); }); }
    catch(e){ setTimeout(step,120); }
  })();
}
function saveCare(key){ const loc=$('locInp').value.trim(); const z=$('photoZone'); const photo=(z&&z.dataset.photo)||(careMem[key]&&careMem[key].photo)||null;
  if(!loc&&!photo){ delete careMem[key]; } else { careMem[key]={loc,photo}; }
  saveJSON('hkl_care',careMem);
  /* Preisstammdaten (eigener Schlüssel hkl_prod) */
  const hersteller=$('prodHersteller').value.trim(); const ref=$('prodRef').value.trim();
  const verwendung=$('prodVerw').value.trim(); const preis=parsePreis($('prodPreis').value);
  if(!hersteller&&!ref&&!verwendung&&preis==null){ delete PROD[key]; }
  else { PROD[key]={hersteller:hersteller||null,ref:ref||null,verwendung:verwendung||null,preis:(preis==null?null:preis)}; }
  saveProd();
  toast('Gespeichert'); setTimeout(()=>{ renderCare(); show('scr-care'); updateBar(); },600); }

