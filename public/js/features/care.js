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
    html+=`<div class="mat-row" style="border-left-color:var(--n-${esc(m.typ)})" onclick="openCare('${esc(m.key)}')">${thumb}<div class="mat-main"><div class="mat-name">${esc(m.name)}</div><div class="mat-sub">${st}${sizes}</div></div><span class="mat-count">${m.vorkommen}×</span></div>`; });
  box.innerHTML=html;
}
function setCareFilter(f){ careFilter=f; renderCare(); }
function openCare(key){ const m=MAT_INDEX.find(x=>x.key===key); if(!m) return; const c=careMem[key]||{};
  const sizes=m.groessen&&m.groessen.length?`<div class="info-field"><div class="if-l">Größen (automatisch erkannt)</div><div class="if-v">${sizeBadges(m.groessen)}</div></div>`:'';
  const photoInner=c.photo?`<img src="${c.photo}" style="width:100%;height:100%;object-fit:cover" alt="">`:`<div class="ph-ico">📷</div><div class="ph-sub">Foto aufnehmen oder wählen</div>`;
  $('scr-care-item').innerHTML=`<div class="pcard"><div class="pc-name">${esc(m.name)}</div><div class="pc-ctx">Kommt in ${m.vorkommen} Standard(s) vor · ${esc(natOf(m.typ).label)}</div>${sizes}
    <div class="flabel">FOTO</div><div class="photo-zone" onclick="$('fileInp').click()" id="photoZone">${photoInner}</div>
    <input type="file" id="fileInp" accept="image/*" style="display:none" onchange="onPhoto(event,'${esc(key)}')">
    <div class="flabel">LAGERORT</div><input class="loc-input" id="locInp" placeholder="z. B. Vorbereitungsraum · Regal A" value="${esc(c.loc||'')}">
    <div class="p-actions"><button class="btn btn-sec" onclick="goBack()">Zurück</button><button class="btn btn-pri" onclick="saveCare('${esc(key)}')">Speichern</button></div></div>
    <div class="foot">Foto und Lagerort werden zentral auf dem Server gespeichert und auf allen Geräten geteilt.</div>`;
  show('scr-care-item'); setBar(m.name,'Material pflegen',true);
}
function onPhoto(ev,key){ const f=ev.target.files&&ev.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ const z=$('photoZone'); if(z){ z.innerHTML=`<img src="${r.result}" style="width:100%;height:100%;object-fit:cover" alt="">`; z.dataset.photo=r.result; } }; r.readAsDataURL(f); }
function saveCare(key){ const loc=$('locInp').value.trim(); const z=$('photoZone'); const photo=(z&&z.dataset.photo)||(careMem[key]&&careMem[key].photo)||null;
  if(!loc&&!photo){ delete careMem[key]; } else { careMem[key]={loc,photo}; }
  saveJSON('hkl_care',careMem); toast('Gespeichert'); setTimeout(()=>{ renderCare(); show('scr-care'); updateBar(); },600); }

