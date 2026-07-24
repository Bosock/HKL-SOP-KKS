/* ============ Ebene 1: Übersicht (Standards | Anleitungen) ============
   Die Startseite trägt zwei Inhaltsarten: Standards (Eingriffe) und
   Anleitungen (Aufgaben). Der Umschalter oben trennt sie sauber; die
   Sortierung (Bereich · A–Z · Favoriten · meistgenutzt · zuletzt · Kosten)
   gilt für beide. Siehe features/listview.js. */
function renderStandards(query){ const box=$('scr-standards'); const q=(query||'').trim().toLowerCase();
  let html=hintsBlockHTML('overview','');
  html+=(typeof segBarHTML==='function')?segBarHTML():'';

  /* ---- Bereich „Anleitungen" ---- */
  if(typeof curSeg!=='undefined' && curSeg==='anleitung'){
    if(ADMIN) html+=`<button class="sheet-pick-btn" style="margin:0 0 12px" onclick="guideNew()">＋ Neue Anleitung</button>`;
    html+=(typeof guideRowsHTML==='function')?guideRowsHTML(query):'';
    box.innerHTML=html; return;
  }

  /* ---- Bereich „Standards" ---- */
  html+=ADMIN?`<button class="sheet-pick-btn" style="margin:0 0 12px" onclick="openStandardForm(null)">＋ Neuer Standard</button>`:'';
  const list=[];
  DB.standards.forEach(s=>{ const hid=stdHidden(s); if(hid&&!ADMIN) return; const t=stdTitel(s), g=stdGruppe(s);
    if(q && !(t||'').toLowerCase().includes(q) && !(g||'').toLowerCase().includes(q)) return;
    list.push({ id:s.id, titel:t, gruppe:g, std:s, hidden:hid }); });
  if(!list.length){
    /* Die Startsuche findet nur Titel/Gruppen. Bei 0 Treffern die globale
       Inhaltssuche anbieten, sonst lernt man fälschlich „gibt es nicht"
       (UX-Audit M2). Query via data-Attribut, nicht als Inline-Literal. */
    box.innerHTML=html+`<div class="empty"><div class="ei">🔍</div><h3>Kein Standard gefunden</h3><p>Für „${esc(query)}" gibt es keinen Titel-Treffer.</p><button type="button" class="sheet-pick-btn" style="margin-top:12px" data-q="${esc(query)}" onclick="openGlobalSearch(this.dataset.q)">🔎 In allen Inhalten suchen</button></div>`; return; }

  /* Kosten nur berechnen, wenn danach sortiert wird (spart Arbeit je Render). */
  const sortKey=(typeof curSort!=='undefined')?curSort:'gruppe';
  if(sortKey==='kosten'&&typeof stdPlankosten==='function'){
    list.forEach(x=>{ try{ x.kosten=stdPlankosten(x.std).total||0; }catch(e){ x.kosten=0; } });
  }
  const row=(x)=>{
    const fav=(typeof favBtnHTML==='function')?favBtnHTML(x.id):'';
    const kost=(sortKey==='kosten'&&x.kosten)?`<span class="std-kost">${esc(fmtEUR(x.kosten))}</span>`:'';
    /* Tippen = öffnen, langes Tippen = Bearbeiten-Menü (Admin) — beides über den
       Halte-Detektor (attachHoldNav), daher data-sid statt Inline-onclick. */
    return `<div class="std" style="${x.hidden?'opacity:.55;':''}" data-sid="${esc(x.id)}"><span class="std-badge">${esc(x.gruppe)}</span><div class="std-main"><div class="std-title">${esc(x.titel)}${x.hidden?' <span style="font-size:11px;color:var(--warn)">ausgeblendet</span>':''}${x.std.__new&&ADMIN?' <span style="font-size:11px;color:var(--accent)">neu</span>':''}</div><div class="std-file">${esc(x.std.dateiname)}</div></div>${kost}${fav}<span class="chev">›</span></div>`;
  };
  if(sortKey==='gruppe'){
    const groups={}; list.forEach(x=>{ (groups[x.gruppe]=groups[x.gruppe]||[]).push(x); });
    groupSort(Object.keys(groups)).forEach(g=>{
      html+=`<div class="grp">${esc(g)}<span class="ln"></span></div>`;
      groups[g].forEach(x=>{ html+=row(x); }); });
  } else {
    html+=((typeof sortItems==='function')?sortItems(list,sortKey):list).map(row).join('');
  }
  /* Technik-Hinweis nur für Admins — Endnutzerinnen irritiert er (UX H7). */
  if(ADMIN) html+=`<div class="qr-hint">Jeder Standard ist per Direktlink erreichbar:<br>…/index.html#/std/<b>id</b> — Grundlage für QR-Code.</div>`;
  box.innerHTML=html;
}
