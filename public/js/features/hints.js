/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — HINWEISE / BANNER
   Freie Hinweistexte, die sich wie ein Eintrag darstellen (aber ohne
   Checkbox) und den ganzen Block einfärben können. Einfügbar auf drei
   Ebenen: Übersicht (scope 'overview'), je Standard ('std' → key=<stdId>)
   und je Rubrik ('rub' → key=<stdId>|<rubrikIndex>).
     HINTS = { overview:[…], std:{<id>:[…]}, rub:{<id|ri>:[…]} }
     hint  = { id, text, color? }   (Textfarbe automatisch nach Kontrast)
   ───────────────────────────────────────────────────────────── */
function loadHints(){ const h=loadJSON('hkl_hints',{overview:[],std:{},rub:{}});
  if(!Array.isArray(h.overview)) h.overview=[]; if(!h.std||typeof h.std!=='object') h.std={}; if(!h.rub||typeof h.rub!=='object') h.rub={}; return h; }
let HINTS=loadHints(); function saveHints(){ saveJSON('hkl_hints',HINTS); }

function hintsFor(scope,key,create){
  if(scope==='overview'){ if(create&&!Array.isArray(HINTS.overview)) HINTS.overview=[]; return HINTS.overview||[]; }
  const bag = scope==='std' ? (HINTS.std||(HINTS.std={})) : (HINTS.rub||(HINTS.rub={}));
  if(create && !bag[key]) bag[key]=[]; return bag[key]||[]; }

/* Ein Hinweis-Banner (wie ein Eintrag, ohne Checkbox). */
function hintBannerHTML(h,scope,key){ const fill=h.color||''; let style='', cls='hint-banner';
  if(fill){ const t=pickTextColor(fill); style=`--e-fill:${esc(fill)};--e-fill-text:${t};--e-fill-bd:${t}`; cls+=' filled'; }
  const adminBtns=ADMIN?`<span class="hint-actions"><button type="button" onclick="editHint('${scope}','${esc(key)}','${esc(h.id)}')" aria-label="Hinweis bearbeiten">✎</button><button type="button" onclick="deleteHintConfirm('${scope}','${esc(key)}','${esc(h.id)}')" aria-label="Hinweis löschen">🗑</button></span>`:'';
  return `<div class="${cls}" style="${style}"><div class="hb-ico">💡</div><div class="hb-text">${esc(h.text).replace(/\n/g,'<br>')}</div>${adminBtns}</div>`; }

/* Kompletter Hinweis-Block einer Ebene: alle Banner + (Admin) „＋ Hinweis". */
function hintsBlockHTML(scope,key){ let h=''; hintsFor(scope,key).forEach(x=>{ h+=hintBannerHTML(x,scope,key); });
  if(ADMIN) h+=`<button type="button" class="add-hint-btn" onclick="addHint('${scope}','${esc(key)}')">＋ Hinweis / Banner</button>`; return h; }

function scopeBack(scope,key){ return ()=>{
  if(scope==='overview'){ setMode('use'); renderStandards($('searchInput')?$('searchInput').value:''); show('scr-standards'); updateBar(); return; }
  if(scope==='std'){ openStandard(key,true); return; }
  const p=(key||'').split('|'); const sid=p[0], ri=+p[1];
  if(sid){ openStandard(sid,true); openRubrik(ri); } }; }

function addHint(scope,key){ if(!ADMIN) return; openHintForm(scope,key,null); }
function editHint(scope,key,id){ if(!ADMIN) return; openHintForm(scope,key,id); }
function deleteHintConfirm(scope,key,id){ if(!ADMIN) return; if(!confirm('Diesen Hinweis löschen?')) return;
  const list=hintsFor(scope,key); const i=list.findIndex(x=>x.id===id); if(i>=0) list.splice(i,1); saveHints();
  const b=scopeBack(scope,key); if(b) b(); toast('Hinweis gelöscht'); }

function pickHintColor(el,val){ const w=$('hColorWrap'); if(!w) return; w.dataset.color=val||'';
  w.querySelectorAll('.cp-sw,.cp-none').forEach(b=>b.classList.remove('sel'));
  if(el&&el.classList&&(el.classList.contains('cp-sw')||el.classList.contains('cp-none'))) el.classList.add('sel'); }

function openHintForm(scope,key,id){ const list=hintsFor(scope,key); const h=id?list.find(x=>x.id===id):null;
  const curText=h?h.text:''; const curColor=h?(h.color||''):'';
  const html=`<div class="pcard">
    <div class="form-grp"><div class="flabel">Hinweistext</div><textarea class="loc-input" id="hText" rows="3" placeholder="z. B. Vor Beginn Gerät kalibrieren · gilt nur für Notfälle …">${esc(curText)}</textarea></div>
    <div class="form-grp"><div class="flabel">Farbe (optional)</div>
      <div class="colorpick" id="hColorWrap" data-color="${esc(curColor)}">
        <button type="button" class="cp-none ${!curColor?'sel':''}" onclick="pickHintColor(this,'')">ohne</button>
        ${UK_PALETTE.map(c=>`<button type="button" class="cp-sw ${curColor===c?'sel':''}" style="background:${c}" onclick="pickHintColor(this,'${c}')"></button>`).join('')}
        <input type="color" class="cp-inp" value="${esc(curColor||'#e8b34a')}" oninput="pickHintColor(this,this.value)">
      </div>
      <p class="hint">Färbt den ganzen Hinweis; die Textfarbe wird automatisch lesbar gewählt.</p></div>
    <div class="p-actions"><button class="btn btn-sec" onclick="closeForm()">Abbrechen</button><button class="btn btn-pri" onclick="saveHintForm('${scope}','${esc(key)}',${h?`'${esc(h.id)}'`:'null'})">Speichern</button></div>
  </div>`;
  formCtx={desc:{kind:'hint'}, back:scopeBack(scope,key)};
  $('scr-form').innerHTML=html; show('scr-form'); setBar(h?'Hinweis bearbeiten':'Neuer Hinweis','',true); }

function saveHintForm(scope,key,id){ const text=$('hText').value.trim(); if(!text){ toast('Bitte einen Text eingeben',true); return; }
  const color=($('hColorWrap').dataset.color||'')||null; const list=hintsFor(scope,key,true);
  if(id){ const hh=list.find(x=>x.id===id); if(hh){ hh.text=text; hh.color=color; } }
  else { list.push({ id:newAid(), text, color }); }
  saveHints(); toast('Hinweis gespeichert'); const b=formCtx&&formCtx.back; formCtx=null; if(b) b(); }
