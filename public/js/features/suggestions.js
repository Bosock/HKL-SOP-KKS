/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — ÄNDERUNGSVORSCHLÄGE (Kollaboration)
   Kolleg:innen (auch ohne Verwaltungsrecht) schlagen Änderungen an einem
   Eintrag vor. Alle sehen die Vorschläge und bewerten sie mit 👍/👎; nur
   die Verwaltung übernimmt oder lehnt ab. Zentral geteilt über
   hkl_suggestions.
     SUGGESTION = { id, sid, cid, entryName, to, note, by, created,
                    status:'pending'|'accepted'|'rejected', votes:{voterId:±1} }
   Datenschutz-Voreinstellung: es werden nur die Stimm-ANZAHLEN gezeigt,
   nicht wer wie abgestimmt hat.
   ───────────────────────────────────────────────────────────── */
function loadSuggestions(){ const s=loadJSON('hkl_suggestions',[]); return Array.isArray(s)?s:[]; }
let SUGGESTIONS=loadSuggestions();
function saveSuggestions(){ saveJSON('hkl_suggestions',SUGGESTIONS); }

/* Stabile Wähler-Kennung: eingeloggter GitHub-Login, sonst eine zufällige
   Gerätekennung (lokal, nicht geteilt). */
function voterId(){ if(typeof currentGithubUser!=='undefined'&&currentGithubUser&&currentGithubUser.login) return 'gh:'+currentGithubUser.login;
  let v=store.get('hkl_voterid'); if(!v){ v='d'+Math.random().toString(36).slice(2,10); store.set('hkl_voterid',v); } return v; }
function voterName(){ if(typeof currentGithubUser!=='undefined'&&currentGithubUser&&(currentGithubUser.name||currentGithubUser.login)) return currentGithubUser.name||currentGithubUser.login; return 'Kollege'; }
/* Reine Auszählung (testbar): Anzahl 👍 / 👎. */
function voteTally(votes){ let up=0,down=0; const v=votes||{}; Object.keys(v).forEach(k=>{ if(v[k]>0) up++; else if(v[k]<0) down++; }); return {up,down}; }
function pendingSuggestions(){ return SUGGESTIONS.filter(s=>s.status==='pending'); }

/* ---- Vorschlag anlegen (aus dem Eintrag heraus, für alle) ---- */
function openProposeForm(cid){ const e=findEntry(cid); if(!e){ toast('Eintrag nicht gefunden',true); return; }
  const dn=qeGet(e,cid,'name'); const name=(dn!==undefined?dn:e.anzeige_text)||'';
  const sid=(cid.indexOf('new|')===0)?(curStd?curStd.id:''):cid.split('|')[0];
  const html=`<div class="pcard">
    <div class="form-grp"><div class="flabel">Eintrag</div><div class="propose-target">${esc(name)}</div></div>
    <div class="form-grp"><div class="flabel">Neuer Text / Bezeichnung (optional)</div><input class="loc-input" id="pgTo" placeholder="${esc(name)}" value=""></div>
    <div class="form-grp"><div class="flabel">Begründung / was soll geändert werden?</div><textarea class="loc-input" id="pgNote" rows="3" placeholder="z. B. Wir nutzen jetzt 7F statt 6F"></textarea></div>
    <p class="hint">Dein Vorschlag geht an die Verwaltung. Kolleg:innen können ihn sehen und mit 👍 / 👎 bewerten.</p>
    <div class="p-actions"><button class="btn btn-sec" onclick="closeForm()">Abbrechen</button><button class="btn btn-pri" onclick="submitProposal('${esc(cid)}','${esc(sid)}')">Vorschlag senden</button></div>
  </div>`;
  formCtx={desc:{kind:'propose'}, back:()=>reRenderDetail()};
  $('scr-form').innerHTML=html; show('scr-form'); setBar('Änderung vorschlagen',name,true); }
function submitProposal(cid,sid){ const to=($('pgTo').value||'').trim(); const note=($('pgNote').value||'').trim();
  if(!to&&!note){ toast('Bitte etwas eintragen',true); return; }
  const e=findEntry(cid); const dn=e?qeGet(e,cid,'name'):undefined; const name=e?((dn!==undefined?dn:e.anzeige_text)||''):'';
  SUGGESTIONS.push({ id:newAid(), sid, cid, entryName:name, to:to||null, note:note||null, by:voterName(), created:today(), status:'pending', votes:{} });
  saveSuggestions(); const b=formCtx&&formCtx.back; formCtx=null; toast('Vorschlag gesendet – danke!'); if(b) b(); }

/* ---- Übersicht / Bewerten / Verwaltung ---- */
function openSuggestions(){ showSheet(false); formCtx=null; mode='use'; nav=[]; renderSuggestions();
  show('scr-suggest'); setBar('Änderungsvorschläge', pendingSuggestions().length+' offen', true); $('searchWrap').style.display='none'; }
function suggCardHTML(s){ const t=voteTally(s.votes); const mine=(s.votes||{})[voterId()];
  const admin=(ADMIN&&s.status==='pending')?`<div class="sg-admin"><button class="btn btn-pri" onclick="acceptProposal('${esc(s.id)}')">Übernehmen</button><button class="btn btn-sec" onclick="rejectProposal('${esc(s.id)}')">Ablehnen</button></div>`:'';
  const del=(ADMIN&&s.status!=='pending')?`<button class="sg-del" onclick="deleteProposal('${esc(s.id)}')" aria-label="Löschen">🗑</button>`:'';
  const statusTag=(s.status==='pending')?'':`<span class="sg-status ${esc(s.status)}">${s.status==='accepted'?'übernommen':'abgelehnt'}</span>`;
  return `<div class="sg-card ${esc(s.status)}">
    <div class="sg-head"><span class="sg-entry">${esc(s.entryName||'Eintrag')}</span>${statusTag}${del}</div>
    ${s.to?`<div class="sg-to">→ „${esc(s.to)}"</div>`:''}
    ${s.note?`<div class="sg-note">${esc(s.note).replace(/\n/g,'<br>')}</div>`:''}
    <div class="sg-by">von ${esc(s.by||'Kollege')} · ${esc(s.created||'')}</div>
    <div class="sg-vote"><button type="button" class="sg-vbtn ${mine>0?'on':''}" onclick="voteProposal('${esc(s.id)}',1)">👍 ${t.up}</button><button type="button" class="sg-vbtn ${mine<0?'on':''}" onclick="voteProposal('${esc(s.id)}',-1)">👎 ${t.down}</button></div>
    ${admin}
  </div>`; }
function renderSuggestions(){ const pend=SUGGESTIONS.filter(s=>s.status==='pending');
  const done=SUGGESTIONS.filter(s=>s.status!=='pending');
  let h='';
  if(!SUGGESTIONS.length){ h=`<div class="empty"><div class="ei">✍️</div><h3>Keine Vorschläge</h3><p>Kolleg:innen können aus einem Eintrag heraus (lange gedrückt halten) eine Änderung vorschlagen.</p></div>`; }
  else {
    h+=`<div class="srch-count">${pend.length} offen${done.length?(' · '+done.length+' erledigt'):''}</div>`;
    if(pend.length) h+=pend.map(suggCardHTML).join(''); else h+=`<div class="empty"><div class="ei">✅</div><h3>Nichts Offenes</h3><p>Alle Vorschläge sind bearbeitet.</p></div>`;
    if(done.length){ h+=`<div class="gs-std" style="margin-top:16px">Erledigt</div>`+done.map(suggCardHTML).join(''); }
  }
  $('scr-suggest').innerHTML=h; }
function voteProposal(id,dir){ const s=SUGGESTIONS.find(x=>x.id===id); if(!s) return; s.votes=s.votes||{}; const me=voterId();
  if(s.votes[me]===dir) delete s.votes[me]; else s.votes[me]=dir; saveSuggestions(); renderSuggestions(); }
function acceptProposal(id){ if(!ADMIN) return; const s=SUGGESTIONS.find(x=>x.id===id); if(!s) return;
  if(s.to){ const e=findEntry(s.cid); if(e){ qeSet('cid',e,s.cid,'name',s.to); buildMaterialIndex(); } }
  s.status='accepted'; s.resolvedBy=voterName(); s.resolvedAt=today(); saveSuggestions(); renderSuggestions();
  toast(s.to?'Übernommen – Eintrag aktualisiert':'Als übernommen markiert'); }
function rejectProposal(id){ if(!ADMIN) return; const s=SUGGESTIONS.find(x=>x.id===id); if(!s) return;
  s.status='rejected'; s.resolvedBy=voterName(); s.resolvedAt=today(); saveSuggestions(); renderSuggestions(); toast('Abgelehnt'); }
function deleteProposal(id){ if(!ADMIN) return; if(!confirm('Diesen erledigten Vorschlag löschen?')) return;
  SUGGESTIONS=SUGGESTIONS.filter(x=>x.id!==id); saveSuggestions(); renderSuggestions(); }
