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
      <button class="btn btn-sec" style="flex:0 0 auto;min-height:40px;padding:8px 11px;font-size:12.5px" onclick="openStdMetaForm()">🏷 Version/Freigabe</button>
      <button class="btn btn-sec" style="flex:0 0 auto;min-height:40px;padding:8px 11px;font-size:12.5px" onclick="toggleStdHidden()">${hiddenNow?'↩ Einblenden':'🗑 Ausblenden'}</button>
      ${s.__new?`<button class="btn btn-sec" style="flex:0 0 auto;min-height:40px;padding:8px 11px;font-size:12.5px;color:var(--danger)" onclick="deleteNewStandard()">🗑 Löschen</button>`:''}
      <button class="btn btn-sec" style="flex:0 0 auto;min-height:40px;padding:8px 11px;font-size:12.5px" onclick="addRubrik()">＋ Rubrik</button>
    </div></div>`;
    const m=STDE[s.id]||{}; const metaBits=[m.version?('Version '+m.version):'', m.status||'', m.validFrom?('gültig ab '+m.validFrom):'', m.validTo?('bis '+m.validTo):''].filter(Boolean);
    if(metaBits.length) html+=`<div class="std-meta-line">🏷 ${esc(metaBits.join(' · '))}${m.approvedBy?` · zuletzt: ${esc(m.approvedBy)}`:''}</div>`;
    const pk=stdPlankosten(s);
    if(pk.items>0){ const miss=pk.items-pk.priced;
      html+=`<div class="banner cost-banner"><div class="cost-total"><span class="cost-lbl">Plankosten</span><span class="cost-val">${fmtEUR(pk.total)}</span></div>
        <div class="cost-sub">${pk.priced}/${pk.items} Materialien mit Preis${miss>0?` · ${miss} ohne Preis (in „Material pflegen" ergänzen)`:''}</div></div>`; }
  }
  const vis=(s.rubriken||[]).map((r,i)=>({r,i})).sort((a,b)=>rubOrd(a.r,a.i)-rubOrd(b.r,b.i));
  let listHtml='';
  vis.forEach(({r,i})=>{
    const hid=rubHidden(r,i); if(hid&&!ADMIN) return;
    const count=(r.sub_bereiche||[]).reduce((n,sb)=>n+(sb.eintraege?sb.eintraege.filter(e=>e.natur!=='ueberschrift').length:0),0)+newEntriesFor(r,i).length;
    const adminBtns=ADMIN?`<span style="display:flex;gap:5px;flex:0 0 auto" onclick="event.stopPropagation()">
      <button class="icon-btn" style="width:34px;height:34px;font-size:13px" onclick="renameRubrik(${i})">✏</button>
      <button class="icon-btn" style="width:34px;height:34px;font-size:13px" onclick="moveRubrik(${i},-1)">▲</button>
      <button class="icon-btn" style="width:34px;height:34px;font-size:13px" onclick="moveRubrik(${i},1)">▼</button>
      <button class="icon-btn" style="width:34px;height:34px;font-size:13px" onclick="toggleRubHidden(${i})">${hid?'↩':'🗑'}</button></span>`:'';
    listHtml+=`<div class="rub ${r.typ}" style="${hid?'opacity:.55;':''}" onclick="openRubrik(${i})"><div class="rub-ico">${rubIconEff(r,i)}</div><div class="rub-main"><div class="rub-name">${esc(rubName(r,i))}${hid?' <span style="font-size:10px;color:var(--warn)">ausgeblendet</span>':''}${r.__nrid&&ADMIN?' <span style="font-size:10px;color:var(--accent)">neu</span>':''}</div><div class="rub-meta">${count} Einträge</div></div>${adminBtns}<span class="rub-pill pill-${r.typ}">${typLabel(r.typ)}</span></div>`; });
  const searchBox=`<div class="std-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><input type="search" id="stdSearchInput" placeholder="In diesem Standard suchen (Material, Gerät …)" oninput="stdSearch(this.value)" autocomplete="off"></div>`;
  const listBody=listHtml||`<div class="empty"><div class="ei">📄</div><h3>Keine Rubriken</h3><p>Über „＋ Rubrik" anlegen.</p></div>`;
  $('scr-rubriken').innerHTML=html+hintsBlockHTML('std',s.id)+searchBox+`<div id="stdSearchResults" style="display:none"></div><div id="stdRubList">${listBody}</div><button class="add-entry-btn print-btn" onclick="printStandard()">🖨 Als PDF drucken / exportieren</button>`;
  show('scr-rubriken'); setBar(stdTitel(s),stdGruppe(s)+' · '+(s.rubriken||[]).length+' Rubriken',true); $('searchWrap').style.display='none';
}

/* Suche innerhalb des aktuellen Standards über alle Rubriken/Kategorien. */
function searchStandard(q){ const res=[]; q=(q||'').trim().toLowerCase(); if(!q||!curStd) return res;
  (curStd.rubriken||[]).forEach((r,ri)=>{ (r.sub_bereiche||[]).forEach((sb,si)=>{ (sb.eintraege||[]).forEach((e,ei)=>{
    if(e.natur==='ueberschrift') return; const cid=cidOf(curStd.id,ri,si,ei); if(qeGet(e,cid,'hidden')===true) return;
    const dn=qeGet(e,cid,'name'); const name=(dn!==undefined?dn:e.anzeige_text)||'';
    if(!name.toLowerCase().includes(q)) return;
    const uk=canonUk(e,cid); const loc=(e.material_key&&careMem[e.material_key]&&careMem[e.material_key].loc)||null;
    res.push({cid,ri,name,rubrik:rubName(r,ri),uk,loc}); }); }); });
  return res; }
function stdSearch(q){ const results=$('stdSearchResults'), list=$('stdRubList'); if(!results||!list) return;
  if(!(q||'').trim()){ results.innerHTML=''; results.style.display='none'; list.style.display=''; return; }
  const res=searchStandard(q); list.style.display='none'; results.style.display='';
  if(!res.length){ results.innerHTML=`<div class="empty"><div class="ei">🔍</div><h3>Kein Treffer</h3><p>„${esc(q)}" ist in diesem Standard nicht hinterlegt.</p></div>`; return; }
  results.innerHTML=`<div class="srch-count">${res.length} Treffer</div>`+res.map(x=>`<div class="srch-hit" onclick="jumpToHit('${esc(x.cid)}',${x.ri})"><div class="sh-name">${esc(x.name)}</div><div class="sh-ctx">${esc(x.rubrik)}${x.uk?' · '+esc(x.uk):''} · ${x.loc?'📍 '+esc(x.loc):'📍 kein Lagerort'}</div></div>`).join(''); }
/* Öffnet die Rubrik, klappt die passende Untergruppe auf, springt zum Eintrag und hebt ihn hervor. */
function jumpToHit(cid,ri){ openRubrik(ri);
  const e=findEntry(cid); const uk=e?(canonUk(e,cid)||''):''; if(uk){ collapsed[ri+':'+uk]=false; const top=nav[nav.length-1]; if(top&&top.lvl==='rub') openRubrik(top.idx,true); }
  setTimeout(()=>{ const el=$('e-'+cid); if(el){ el.scrollIntoView({behavior:'smooth',block:'center'}); el.classList.add('flash'); setTimeout(()=>{ if(el) el.classList.remove('flash'); },1600); } },80); }

