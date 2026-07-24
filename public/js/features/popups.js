/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — KONFIGURIERBARE POP-UP-DIALOGE
   Zweck: An bestimmten Stellen soll die App nachfragen — z. B. beim Abhaken von
   „ACT bestimmen" nach dem gemessenen Wert, oder beim Öffnen eines Standards ein
   Sicherheitshinweis. Solche Abfragen sind je Haus/Arbeitsweise verschieden,
   deshalb sind sie KOMPLETT ÜBER EINE OBERFLÄCHE konfigurierbar — es muss nie
   Code angefasst werden.

   Ein Pop-up besteht aus vier frei einstellbaren Teilen:
     1. AUSLÖSER  — welches Ereignis (abhaken / Häkchen entfernen / Standard bzw.
                    Anleitung öffnen) und wofür es gilt (alles, Textmuster,
                    ein bestimmter Standard/eine Anleitung).
     2. AUSSEHEN  — Titel, Text, Stil (Frage / Warnung / Hinweis).
     3. FELDER    — beliebig viele eigene Eingaben je Pop-up (Text, Zahl,
                    Auswahl, Ja/Nein) mit Pflicht-Kennzeichnung.
     4. AKTIONEN  — Beschriftung und Wirkung von Bestätigen und Ablehnen
                    (nichts / Häkchen entfernen / Häkchen setzen).

   Antworten landen in einem Protokoll (hkl_popup_log, gedeckelt), damit
   Eingaben wie ein ACT-Wert nachvollziehbar bleiben.
   ───────────────────────────────────────────────────────────── */

let POPUPS = loadJSON('hkl_popups', []);
if(!Array.isArray(POPUPS)) POPUPS = [];
function savePopups(){ saveJSON('hkl_popups', POPUPS); }
let POPUP_LOG = loadJSON('hkl_popup_log', []);
if(!Array.isArray(POPUP_LOG)) POPUP_LOG = [];
function savePopupLog(){ saveJSON('hkl_popup_log', POPUP_LOG); }

let popupEditId = null;      /* im Editor offenes Pop-up */
let popupActive = null;      /* gerade angezeigtes Pop-up + Kontext */

const POPUP_EREIGNISSE = [
  { key:'check',             label:'Eintrag wird abgehakt' },
  { key:'uncheck',           label:'Häkchen wird entfernt' },
  { key:'standard-oeffnen',  label:'Standard wird geöffnet' },
  { key:'anleitung-oeffnen', label:'Anleitung wird geöffnet' },
];
const POPUP_ZIELE = [
  { key:'alle',      label:'überall' },
  { key:'text',      label:'wenn der Text … enthält' },
  { key:'standard',  label:'nur in einem bestimmten Standard' },
  { key:'anleitung', label:'nur in einer bestimmten Anleitung' },
];
const POPUP_FELDTYPEN = [
  { key:'text',   label:'Text' },
  { key:'zahl',   label:'Zahl' },
  { key:'auswahl',label:'Auswahl' },
  { key:'janein', label:'Ja / Nein' },
];
const POPUP_AKTIONEN = [
  { key:'nichts',          label:'nichts weiter tun' },
  { key:'haken-entfernen', label:'Häkchen wieder entfernen' },
  { key:'haken-setzen',    label:'Häkchen setzen' },
];

/* ===== Reine, testbare Helfer ===== */
function popupNewId(){ return 'pp:'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }

/* Passt ein Pop-up auf den Auslöser-Kontext? ctx = {ereignis, titel, sid, gid}.
   Rein/testbar — Kern der ganzen Konfigurierbarkeit. */
function popupMatches(p, ctx){
  if(!p || !ctx || p.aktiv===false) return false;
  if(p.ereignis !== ctx.ereignis) return false;
  const ziel=p.zielTyp||'alle';
  if(ziel==='alle') return true;
  if(ziel==='text'){
    const muster=(p.zielWert||'').trim().toLowerCase();
    if(!muster) return false;
    return String(ctx.titel||'').toLowerCase().indexOf(muster)>=0;
  }
  if(ziel==='standard')  return !!ctx.sid && ctx.sid===p.zielWert;
  if(ziel==='anleitung') return !!ctx.gid && ctx.gid===p.zielWert;
  return false;
}
/* Alle passenden, aktiven Pop-ups zu einem Kontext. Rein. */
function popupsFor(ctx){ return (POPUPS||[]).filter(p=>popupMatches(p,ctx)); }
/* Prüft die Pflichtfelder gegen die eingegebenen Antworten. Liefert die Liste
   der fehlenden Feld-Labels (leer = alles gut). Rein/testbar. */
function popupMissing(p, antworten){
  const out=[];
  ((p&&p.felder)||[]).forEach(f=>{
    if(!f.pflicht) return;
    const v=antworten?antworten[f.id]:undefined;
    if(v===undefined || v===null || String(v).trim()==='') out.push(f.label||'Feld');
  });
  return out;
}
/* Optionen eines Auswahlfelds („a, b, c" → ['a','b','c']). Rein/testbar. */
function popupOptions(f){ return String((f&&f.optionen)||'').split(',').map(s=>s.trim()).filter(Boolean); }

/* ===== Anzeige (Laufzeit) ===== */
/* Zentraler Auslöser: wird von toggleCheck / toggleGuideCheck / openStandard /
   openGuide aufgerufen. Zeigt das erste passende Pop-up. */
function popupFire(ctx){
  if(popupActive) return;                       /* nie zwei übereinander */
  const list=popupsFor(ctx);
  if(!list.length) return;
  popupShow(list[0], ctx);
}
function popupEnsureBox(){
  let el=document.getElementById('popupOv');
  if(el) return el;
  el=document.createElement('div');
  el.id='popupOv'; el.className='pop-ov'; el.setAttribute('aria-hidden','true'); el.setAttribute('role','dialog');
  el.innerHTML=`<div class="pop-box" id="popupBox"></div>`;
  document.body.appendChild(el);
  return el;
}
function popupShow(p, ctx){
  const ov=popupEnsureBox(); const box=ov.querySelector('#popupBox');
  popupActive={ p, ctx };
  const stil=p.stil||'frage';
  const felder=((p.felder)||[]).map(f=>{
    const id='popf_'+f.id;
    const lab=`<div class="flabel">${esc(f.label||'Feld')}${f.pflicht?' *':''}</div>`;
    if(f.typ==='auswahl'){
      const opts=popupOptions(f).map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join('');
      return lab+`<select class="form-sel" id="${esc(id)}" style="width:100%"><option value="">– bitte wählen –</option>${opts}</select>`;
    }
    if(f.typ==='janein'){
      return lab+`<select class="form-sel" id="${esc(id)}" style="width:100%"><option value="">– bitte wählen –</option><option value="ja">Ja</option><option value="nein">Nein</option></select>`;
    }
    const mode=(f.typ==='zahl')?' inputmode="decimal"':'';
    return lab+`<input class="loc-input" id="${esc(id)}"${mode} placeholder="${esc(f.platzhalter||'')}">`;
  }).join('');
  box.className='pop-box pop-'+esc(stil);
  box.innerHTML=`
    <div class="pop-head"><span class="pop-ico">${stil==='warnung'?'⚠️':(stil==='info'?'ℹ️':'❓')}</span>${esc(p.titel||'Frage')}</div>
    ${p.text?`<div class="pop-text">${esc(p.text).replace(/\n/g,'<br>')}</div>`:''}
    ${felder?`<div class="pop-felder">${felder}</div>`:''}
    <div class="pop-actions">
      ${p.abZeigen===false?'':`<button type="button" class="btn btn-sec" onclick="popupAnswer(false)">${esc(p.abLabel||'Abbrechen')}</button>`}
      <button type="button" class="btn btn-pri" onclick="popupAnswer(true)">${esc(p.okLabel||'Bestätigen')}</button>
    </div>`;
  ov.classList.add('show'); ov.setAttribute('aria-hidden','false');
  const first=box.querySelector('input,select'); if(first) setTimeout(()=>{ try{ first.focus(); }catch(e){} },60);
}
function popupClose(){ const ov=document.getElementById('popupOv'); if(ov){ ov.classList.remove('show'); ov.setAttribute('aria-hidden','true'); }
  popupActive=null; }
/* Antwort verarbeiten: Pflichtfelder prüfen, protokollieren, Aktion ausführen. */
function popupAnswer(ok){
  const cur=popupActive; if(!cur) return;
  const { p, ctx } = cur;
  const antworten={};
  ((p.felder)||[]).forEach(f=>{ const el=document.getElementById('popf_'+f.id); if(el) antworten[f.id]=el.value; });
  if(ok){
    const fehlt=popupMissing(p, antworten);
    if(fehlt.length){ toast('Bitte ausfüllen: '+fehlt.join(', '), true); return; }
  }
  /* Protokoll (gedeckelt, damit der Speicher nicht wächst). */
  POPUP_LOG.push({ ts:new Date().toISOString(), id:p.id, name:p.name||p.titel||'',
    ereignis:ctx.ereignis||'', bezug:ctx.titel||'', entscheidung:ok?'bestätigt':'abgelehnt', antworten });
  if(POPUP_LOG.length>500) POPUP_LOG=POPUP_LOG.slice(-500);
  savePopupLog();
  const aktion = ok ? (p.okAktion||'nichts') : (p.abAktion||'nichts');
  popupClose();
  popupRunAction(aktion, ctx);
}
/* Führt die konfigurierte Folge-Aktion aus. */
function popupRunAction(aktion, ctx){
  if(aktion==='haken-entfernen' && ctx && ctx.cid){
    delete checks[ctx.cid]; saveChecks();
    const el=$('e-'+ctx.cid); if(el) el.classList.remove('done');
    if(ctx.quelle==='anleitung' && typeof renderGuide==='function' && curGuide) renderGuide();
  }
  else if(aktion==='haken-setzen' && ctx && ctx.cid){
    checks[ctx.cid]=true; saveChecks();
    const el=$('e-'+ctx.cid); if(el) el.classList.add('done');
    if(ctx.quelle==='anleitung' && typeof renderGuide==='function' && curGuide) renderGuide();
  }
}

/* ===== Konfigurations-Oberfläche (kein Code nötig) ===== */
function openPopupAdmin(){ if(!ADMIN){ promptLoginThen(openPopupAdmin); return; }
  popupEditId=null; renderPopupAdmin(); show('scr-popups');
  setBar('Pop-up-Dialoge', POPUPS.length+' konfiguriert', true); }
function renderPopupAdmin(){
  const box=$('scr-popups'); if(!box) return;
  if(popupEditId){ box.innerHTML=popupEditHTML(); return; }
  const rows=(POPUPS||[]).map(p=>{
    const ev=(POPUP_EREIGNISSE.find(x=>x.key===p.ereignis)||{}).label||p.ereignis||'';
    const zt=(POPUP_ZIELE.find(x=>x.key===(p.zielTyp||'alle'))||{}).label||'';
    const ziel=(p.zielTyp==='text')?(zt+' „'+(p.zielWert||'')+'"'):zt;
    return `<div class="ukrow" style="border-left-color:${p.aktiv===false?'var(--line)':'var(--accent)'}">
      <div class="ukrow-head"><span class="uk-name">${esc(p.name||p.titel||'(ohne Namen)')}</span>
        <span class="uk-count">${p.aktiv===false?'aus':'aktiv'}</span></div>
      <div class="vw-ctx">${esc(ev)} · ${esc(ziel)}${(p.felder||[]).length?(' · '+(p.felder||[]).length+' Feld(er)'):''}</div>
      <div class="uk-actions">
        <button data-id="${esc(p.id)}" onclick="popupEdit(this.dataset.id)">Bearbeiten</button>
        <button data-id="${esc(p.id)}" onclick="popupToggleActive(this.dataset.id)">${p.aktiv===false?'Aktivieren':'Deaktivieren'}</button>
        <button data-id="${esc(p.id)}" onclick="popupTest(this.dataset.id)">Vorschau</button>
        <button data-id="${esc(p.id)}" onclick="popupDelete(this.dataset.id)">🗑</button>
      </div></div>`;
  }).join('');
  box.innerHTML=`<div class="banner"><h2>Pop-up-Dialoge</h2>
      <p>Lege fest, wann die App nachfragen soll – z. B. beim Abhaken von „ACT" nach dem gemessenen Wert. Auslöser, Text, Eingabefelder und die Wirkung der Knöpfe sind hier frei einstellbar; es muss nichts programmiert werden.</p></div>
    <button class="add-entry-btn" onclick="popupNew()">＋ Neues Pop-up</button>
    ${rows||`<div class="empty"><div class="ei">💬</div><h3>Noch keine Pop-ups</h3><p>Mit „＋ Neues Pop-up" die erste Abfrage anlegen.</p></div>`}
    ${POPUP_LOG.length?`<button class="add-entry-btn" onclick="openPopupLog()">📋 Antwort-Protokoll (${POPUP_LOG.length})</button>`:''}`;
}
function popupNew(){ const p={ id:popupNewId(), name:'', aktiv:true, ereignis:'check', zielTyp:'text', zielWert:'',
    titel:'', text:'', stil:'frage', felder:[], okLabel:'Bestätigen', okAktion:'nichts',
    abLabel:'Abbrechen', abAktion:'haken-entfernen', abZeigen:true };
  POPUPS.push(p); savePopups(); popupEditId=p.id; renderPopupAdmin(); }
function popupEdit(id){ popupEditId=id; renderPopupAdmin(); }
function popupById(id){ return (POPUPS||[]).find(p=>p.id===id)||null; }
function popupEditHTML(){
  const p=popupById(popupEditId); if(!p) return '';
  const sel=(arr,cur,idAttr)=>`<select class="form-sel" id="${idAttr}" style="width:100%">`+
    arr.map(o=>`<option value="${esc(o.key)}"${o.key===cur?' selected':''}>${esc(o.label)}</option>`).join('')+`</select>`;
  const stdOpts=(typeof DB!=='undefined'&&DB&&DB.standards?DB.standards:[]).map(s=>`<option value="${esc(s.id)}"${p.zielWert===s.id?' selected':''}>${esc(stdTitel(s))}</option>`).join('');
  const gOpts=(typeof GUIDES!=='undefined'?GUIDES:[]).map(g=>`<option value="${esc(g.id)}"${p.zielWert===g.id?' selected':''}>${esc(g.titel||'')}</option>`).join('');
  let zielFeld='';
  if(p.zielTyp==='text') zielFeld=`<input class="loc-input" id="ppZielWert" placeholder="z. B. ACT" value="${esc(p.zielWert||'')}">`;
  else if(p.zielTyp==='standard') zielFeld=`<select class="form-sel" id="ppZielWert" style="width:100%"><option value="">– Standard wählen –</option>${stdOpts}</select>`;
  else if(p.zielTyp==='anleitung') zielFeld=`<select class="form-sel" id="ppZielWert" style="width:100%"><option value="">– Anleitung wählen –</option>${gOpts}</select>`;
  const felder=(p.felder||[]).map((f,i)=>`
    <div class="pf-row">
      <div class="pf-head">Feld ${i+1}
        <div class="ges-tools">
          <button type="button" class="icon-btn" data-i="${i}" onclick="popupMoveField(+this.dataset.i,-1)">▲</button>
          <button type="button" class="icon-btn" data-i="${i}" onclick="popupMoveField(+this.dataset.i,1)">▼</button>
          <button type="button" class="icon-btn" data-i="${i}" onclick="popupDelField(+this.dataset.i)">🗑</button>
        </div></div>
      <input class="loc-input pf-label" data-i="${i}" placeholder="Beschriftung, z. B. ACT-Wert (Sek.)" value="${esc(f.label||'')}">
      <select class="form-sel pf-typ" data-i="${i}" style="width:100%">${POPUP_FELDTYPEN.map(t=>`<option value="${esc(t.key)}"${t.key===f.typ?' selected':''}>${esc(t.label)}</option>`).join('')}</select>
      ${f.typ==='auswahl'?`<input class="loc-input pf-opt" data-i="${i}" placeholder="Optionen, mit Komma getrennt" value="${esc(f.optionen||'')}">`:''}
      <label class="g-check"><input type="checkbox" class="pf-pflicht" data-i="${i}" ${f.pflicht?'checked':''}> Pflichtfeld</label>
    </div>`).join('');
  return `<div class="pcard">
    <div class="pc-name">Pop-up bearbeiten</div>
    <div class="flabel">NAME (nur für die Verwaltung)</div><input class="loc-input" id="ppName" placeholder="z. B. ACT-Wert abfragen" value="${esc(p.name||'')}">
    <label class="g-check"><input type="checkbox" id="ppAktiv" ${p.aktiv===false?'':'checked'}> aktiv</label>

    <div class="pc-sec">1 · Auslöser</div>
    <div class="flabel">WANN</div>${sel(POPUP_EREIGNISSE,p.ereignis,'ppEreignis')}
    <div class="flabel">WOFÜR</div>${sel(POPUP_ZIELE,p.zielTyp||'alle','ppZielTyp')}
    ${zielFeld?`<div style="margin-top:8px">${zielFeld}</div>`:''}
    <p class="hint">Beispiel: „Eintrag wird abgehakt" + „wenn der Text … enthält" + „ACT" – dann erscheint das Pop-up bei jedem Abhaken eines Eintrags, in dem „ACT" vorkommt.</p>

    <div class="pc-sec">2 · Aussehen</div>
    <div class="flabel">TITEL</div><input class="loc-input" id="ppTitel" placeholder="z. B. ACT-Wert dokumentieren" value="${esc(p.titel||'')}">
    <div class="flabel">TEXT</div><textarea class="loc-input" id="ppText" rows="2" placeholder="Erklärender Satz (optional)">${esc(p.text||'')}</textarea>
    <div class="flabel">STIL</div>${sel([{key:'frage',label:'Frage (neutral)'},{key:'warnung',label:'Warnung (rot)'},{key:'info',label:'Hinweis (blau)'}],p.stil||'frage','ppStil')}

    <div class="pc-sec">3 · Eingabefelder</div>
    <div id="ppFelder">${felder||'<p class="hint">Keine Felder – das Pop-up fragt dann nur nach Bestätigung.</p>'}</div>
    <button type="button" class="add-btn" onclick="popupAddField()">＋ Feld</button>

    <div class="pc-sec">4 · Knöpfe &amp; Wirkung</div>
    <div class="flabel">BESTÄTIGEN – BESCHRIFTUNG</div><input class="loc-input" id="ppOkLabel" value="${esc(p.okLabel||'Bestätigen')}">
    <div class="flabel">BESTÄTIGEN – WIRKUNG</div>${sel(POPUP_AKTIONEN,p.okAktion||'nichts','ppOkAktion')}
    <label class="g-check"><input type="checkbox" id="ppAbZeigen" ${p.abZeigen===false?'':'checked'}> Ablehnen-Knopf anzeigen</label>
    <div class="flabel">ABLEHNEN – BESCHRIFTUNG</div><input class="loc-input" id="ppAbLabel" value="${esc(p.abLabel||'Abbrechen')}">
    <div class="flabel">ABLEHNEN – WIRKUNG</div>${sel(POPUP_AKTIONEN,p.abAktion||'nichts','ppAbAktion')}

    <div class="p-actions" style="margin-top:14px">
      <button class="btn btn-sec" onclick="popupCloseEdit()">Zurück</button>
      <button class="btn btn-sec" onclick="popupSaveForm(true)">Vorschau</button>
      <button class="btn btn-pri" onclick="popupSaveForm()">Speichern</button>
    </div></div>`;
}
/* Formular → Objekt (ohne Speichern), damit Feld-Änderungen nicht verloren gehen. */
function popupReadForm(){
  const p=popupById(popupEditId); if(!p) return null;
  const v=(id)=>{ const el=$(id); return el?el.value:undefined; };
  const c=(id)=>{ const el=$(id); return el?!!el.checked:undefined; };
  if(v('ppName')!==undefined) p.name=v('ppName').trim();
  if(c('ppAktiv')!==undefined) p.aktiv=c('ppAktiv');
  if(v('ppEreignis')!==undefined) p.ereignis=v('ppEreignis');
  if(v('ppZielTyp')!==undefined) p.zielTyp=v('ppZielTyp');
  if(v('ppZielWert')!==undefined) p.zielWert=v('ppZielWert').trim();
  if(v('ppTitel')!==undefined) p.titel=v('ppTitel').trim();
  if(v('ppText')!==undefined) p.text=v('ppText');
  if(v('ppStil')!==undefined) p.stil=v('ppStil');
  if(v('ppOkLabel')!==undefined) p.okLabel=v('ppOkLabel').trim()||'Bestätigen';
  if(v('ppOkAktion')!==undefined) p.okAktion=v('ppOkAktion');
  if(c('ppAbZeigen')!==undefined) p.abZeigen=c('ppAbZeigen');
  if(v('ppAbLabel')!==undefined) p.abLabel=v('ppAbLabel').trim()||'Abbrechen';
  if(v('ppAbAktion')!==undefined) p.abAktion=v('ppAbAktion');
  document.querySelectorAll('#ppFelder .pf-row').forEach((row,i)=>{
    const f=(p.felder||[])[i]; if(!f) return;
    const l=row.querySelector('.pf-label'); if(l) f.label=l.value.trim();
    const t=row.querySelector('.pf-typ'); if(t) f.typ=t.value;
    const o=row.querySelector('.pf-opt'); if(o) f.optionen=o.value.trim();
    const pf=row.querySelector('.pf-pflicht'); if(pf) f.pflicht=!!pf.checked;
  });
  return p;
}
function popupAddField(){ const p=popupReadForm(); if(!p) return;
  (p.felder=p.felder||[]).push({ id:'f'+Date.now().toString(36)+Math.random().toString(36).slice(2,4), label:'', typ:'text', pflicht:false, optionen:'' });
  savePopups(); renderPopupAdmin(); }
function popupDelField(i){ const p=popupReadForm(); if(!p||!p.felder[i]) return;
  p.felder.splice(i,1); savePopups(); renderPopupAdmin(); }
function popupMoveField(i,dir){ const p=popupReadForm(); if(!p) return; const j=i+dir;
  if(j<0||j>=p.felder.length) return; const t=p.felder[i]; p.felder[i]=p.felder[j]; p.felder[j]=t;
  savePopups(); renderPopupAdmin(); }
function popupSaveForm(preview){ const p=popupReadForm(); if(!p) return;
  if(!p.titel){ toast('Bitte einen Titel angeben.',true); return; }
  savePopups();
  if(preview){ popupShow(p,{ ereignis:p.ereignis, titel:'(Vorschau)', vorschau:true }); return; }
  toast('Pop-up gespeichert'); popupEditId=null; renderPopupAdmin(); }
function popupCloseEdit(){ popupReadForm(); savePopups(); popupEditId=null; renderPopupAdmin(); }
function popupToggleActive(id){ const p=popupById(id); if(!p) return; p.aktiv=(p.aktiv===false); savePopups(); renderPopupAdmin(); }
function popupTest(id){ const p=popupById(id); if(!p) return; popupShow(p,{ ereignis:p.ereignis, titel:'(Vorschau)', vorschau:true }); }
function popupDelete(id){ const p=popupById(id); if(!p) return;
  if(!confirm('Pop-up „'+(p.name||p.titel||'')+'" löschen?')) return;
  POPUPS=POPUPS.filter(x=>x.id!==id); savePopups(); popupEditId=null; renderPopupAdmin(); toast('Pop-up gelöscht'); }
/* Antwort-Protokoll (z. B. dokumentierte ACT-Werte). */
function openPopupLog(){ if(!ADMIN) return;
  const rows=POPUP_LOG.slice().reverse().slice(0,200).map(l=>{
    const ant=Object.keys(l.antworten||{}).map(k=>esc(String(l.antworten[k]))).filter(Boolean).join(' · ');
    return `<div class="ukrow"><div class="ukrow-head"><span class="uk-name">${esc(l.name||'')}</span>
      <span class="uk-count">${esc((l.ts||'').slice(0,16).replace('T',' '))}</span></div>
      <div class="vw-ctx">${esc(l.bezug||'')} · ${esc(l.entscheidung||'')}${ant?' · '+ant:''}</div></div>`; }).join('');
  $('scr-popups').innerHTML=`<div class="banner"><h2>Antwort-Protokoll</h2><p>Die letzten Antworten aus den Pop-up-Dialogen.</p></div>
    <div class="p-actions"><button class="btn btn-sec" onclick="renderPopupAdmin()">Zurück</button>
    <button class="btn btn-sec" onclick="popupLogClear()">Protokoll leeren</button></div>${rows||'<p class="hint">Noch keine Antworten.</p>'}`; }
function popupLogClear(){ if(!confirm('Antwort-Protokoll leeren?')) return; POPUP_LOG=[]; savePopupLog(); renderPopupAdmin(); toast('Protokoll geleert'); }
