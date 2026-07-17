/* ============ Ebene 1: Standards ============ */
function renderStandards(query){ const box=$('scr-standards'); const q=(query||'').trim().toLowerCase(); const groups={};
  DB.standards.forEach(s=>{ const hid=stdHidden(s); if(hid&&!ADMIN) return; const t=stdTitel(s), g=stdGruppe(s);
    if(q && !(t||'').toLowerCase().includes(q) && !(g||'').toLowerCase().includes(q)) return; (groups[g]=groups[g]||[]).push(s); });
  const keys=groupSort(Object.keys(groups));
  let html=hintsBlockHTML('overview','');
  html+=ADMIN?`<button class="sheet-pick-btn" style="margin:0 0 12px" onclick="openStandardForm(null)">＋ Neuer Standard</button>`:'';
  if(keys.length===0){
    /* Die Startsuche findet nur Titel/Gruppen. Bei 0 Treffern die globale
       Inhaltssuche anbieten, sonst lernt man fälschlich „gibt es nicht"
       (UX-Audit M2). Query via data-Attribut, nicht als Inline-Literal. */
    box.innerHTML=html+`<div class="empty"><div class="ei">🔍</div><h3>Kein Standard gefunden</h3><p>Für „${esc(query)}" gibt es keinen Titel-Treffer.</p><button type="button" class="sheet-pick-btn" style="margin-top:12px" data-q="${esc(query)}" onclick="openGlobalSearch(this.dataset.q)">🔎 In allen Inhalten suchen</button></div>`; return; }
  keys.forEach(g=>{ html+=`<div class="grp">${esc(g)}<span class="ln"></span></div>`;
    groups[g].forEach(s=>{ const hid=stdHidden(s); html+=`<div class="std" style="${hid?'opacity:.55;':''}" onclick="openStandard('${esc(s.id)}')"><span class="std-badge">${esc(stdGruppe(s))}</span><div class="std-main"><div class="std-title">${esc(stdTitel(s))}${hid?' <span style="font-size:11px;color:var(--warn)">ausgeblendet</span>':''}${s.__new&&ADMIN?' <span style="font-size:11px;color:var(--accent)">neu</span>':''}</div><div class="std-file">${esc(s.dateiname)}</div></div><span class="chev">›</span></div>`; }); });
  /* Technik-Hinweis nur für Admins — Endnutzerinnen irritiert er (UX H7). */
  if(ADMIN) html+=`<div class="qr-hint">Jeder Standard ist per Direktlink erreichbar:<br>…/index.html#/std/<b>id</b> — Grundlage für QR-Code.</div>`;
  box.innerHTML=html;
}

