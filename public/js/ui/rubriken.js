/* ============ Ebene 2: Rubriken ============ */
function openStandard(id,replace,silent){ const s=DB.standards.find(x=>x.id===id); if(!s){ toast('Standard nicht gefunden',true); return; }
  curStd=s;
  if(!silent){ if(!replace){ nav.push({lvl:'std',id}); try{ history.pushState({d:1,id},'','#/std/'+id); }catch(e){} } else { try{ history.replaceState({d:1,id},'','#/std/'+id); }catch(e){} } }
  let html='';
  if(ADMIN){
    const hiddenNow=stdHidden(s);
    html+=`<div class="banner" style="padding:12px 14px"><div style="display:flex;flex-wrap:wrap;gap:7px;align-items:center">
      <span style="font-size:12px;font-weight:700;color:var(--text-dim)">STANDARD${s.__new?' · <span style="color:var(--accent)">App-eigen</span>':''}${hiddenNow?' · <span style="color:var(--warn)">ausgeblendet</span>':''}</span>
      <span style="flex:1"></span>
      <button class="btn btn-sec" style="flex:0 0 auto;min-height:40px;padding:8px 11px;font-size:12.5px" onclick="editStandard()">✏ Titel/Gruppe</button>
      <button class="btn btn-sec" style="flex:0 0 auto;min-height:40px;padding:8px 11px;font-size:12.5px" onclick="toggleStdHidden()">${hiddenNow?'↩ Einblenden':'🗑 Ausblenden'}</button>
      ${s.__new?`<button class="btn btn-sec" style="flex:0 0 auto;min-height:40px;padding:8px 11px;font-size:12.5px;color:var(--danger)" onclick="deleteNewStandard()">🗑 Löschen</button>`:''}
      <button class="btn btn-sec" style="flex:0 0 auto;min-height:40px;padding:8px 11px;font-size:12.5px" onclick="addRubrik()">＋ Rubrik</button>
    </div></div>`;
  }
  const vis=(s.rubriken||[]).map((r,i)=>({r,i})).sort((a,b)=>rubOrd(a.r,a.i)-rubOrd(b.r,b.i));
  vis.forEach(({r,i})=>{
    const hid=rubHidden(r,i); if(hid&&!ADMIN) return;
    const count=(r.sub_bereiche||[]).reduce((n,sb)=>n+(sb.eintraege?sb.eintraege.filter(e=>e.natur!=='ueberschrift').length:0),0)+newEntriesFor(r,i).length;
    const adminBtns=ADMIN?`<span style="display:flex;gap:5px;flex:0 0 auto" onclick="event.stopPropagation()">
      <button class="icon-btn" style="width:34px;height:34px;font-size:13px" onclick="renameRubrik(${i})">✏</button>
      <button class="icon-btn" style="width:34px;height:34px;font-size:13px" onclick="moveRubrik(${i},-1)">▲</button>
      <button class="icon-btn" style="width:34px;height:34px;font-size:13px" onclick="moveRubrik(${i},1)">▼</button>
      <button class="icon-btn" style="width:34px;height:34px;font-size:13px" onclick="toggleRubHidden(${i})">${hid?'↩':'🗑'}</button></span>`:'';
    html+=`<div class="rub ${r.typ}" style="${hid?'opacity:.55;':''}" onclick="openRubrik(${i})"><div class="rub-ico">${rubIconEff(r,i)}</div><div class="rub-main"><div class="rub-name">${esc(rubName(r,i))}${hid?' <span style="font-size:10px;color:var(--warn)">ausgeblendet</span>':''}${r.__nrid&&ADMIN?' <span style="font-size:10px;color:var(--accent)">neu</span>':''}</div><div class="rub-meta">${count} Einträge</div></div>${adminBtns}<span class="rub-pill pill-${r.typ}">${typLabel(r.typ)}</span></div>`; });
  $('scr-rubriken').innerHTML=html||`<div class="empty"><div class="ei">📄</div><h3>Keine Rubriken</h3><p>Über „＋ Rubrik" anlegen.</p></div>`;
  show('scr-rubriken'); setBar(stdTitel(s),stdGruppe(s)+' · '+(s.rubriken||[]).length+' Rubriken',true); $('searchWrap').style.display='none';
}

