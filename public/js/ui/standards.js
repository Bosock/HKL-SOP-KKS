/* ============ Ebene 1: Standards ============ */
function renderStandards(query){ const box=$('scr-standards'); const q=(query||'').trim().toLowerCase(); const groups={};
  DB.standards.forEach(s=>{ const hid=stdHidden(s); if(hid&&!ADMIN) return; const t=stdTitel(s), g=stdGruppe(s);
    if(q && !(t||'').toLowerCase().includes(q) && !(g||'').toLowerCase().includes(q)) return; (groups[g]=groups[g]||[]).push(s); });
  const keys=groupSort(Object.keys(groups));
  let html=ADMIN?`<button class="sheet-pick-btn" style="margin:0 0 12px" onclick="newStandard()">＋ Neuer Standard (App-eigen)</button>`:'';
  if(keys.length===0){ box.innerHTML=html+`<div class="empty"><div class="ei">🔍</div><h3>Kein Standard gefunden</h3><p>Für „${esc(query)}" gibt es keinen Treffer.</p></div>`; return; }
  keys.forEach(g=>{ html+=`<div class="grp">${esc(g)}<span class="ln"></span></div>`;
    groups[g].forEach(s=>{ const hid=stdHidden(s); html+=`<div class="std" style="${hid?'opacity:.55;':''}" onclick="openStandard('${esc(s.id)}')"><span class="std-badge">${esc(stdGruppe(s))}</span><div class="std-main"><div class="std-title">${esc(stdTitel(s))}${hid?' <span style="font-size:10px;color:var(--warn)">ausgeblendet</span>':''}${s.__new&&ADMIN?' <span style="font-size:10px;color:var(--accent)">neu</span>':''}</div><div class="std-file">${esc(s.dateiname)}</div></div><span class="chev">›</span></div>`; }); });
  html+=`<div class="qr-hint">Jeder Standard ist per Direktlink erreichbar:<br>…/index.html#/std/<b>id</b> — Grundlage für QR-Code.</div>`;
  box.innerHTML=html;
}

