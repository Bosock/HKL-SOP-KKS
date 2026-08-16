/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — ANLEITUNGEN (How-to neben den Standards)
   Standards beschreiben EINEN EINGRIFF (Material + Phasen, Matrix-artig).
   Anleitungen beschreiben EINE AUFGABE, Schritt für Schritt: „Rhythmia-Anlage
   aufbauen", „ACT-Gerät: Chargennummer eingeben", „Sondermaterial bestellen",
   „monatliche Kontrolle". Fachlich sind das zwei Inhaltsarten (SOP vs.
   Arbeitsanweisung) — sie werden bewusst NICHT vermischt, teilen sich aber
   Engine, Suche, Häkchen und Sortierung.

   Aufbau einer Anleitung:
     { id, titel, bereich, kurz, intervall, notfall, schritte:[…], … }
   Ein Schritt: { id, text, bild, warn, tipp } — Foto optional und über die
   Lightbox vergrößerbar; „warn"/„tipp" sind abgesetzte Kästen, damit der
   Handlungsfluss knapp bleibt und Hintergrund nicht dazwischenfunkt.

   Häkchen: Anleitungen sind auch als Live-Checkliste benutzbar; die Häkchen
   laufen über denselben (gerätelokalen, täglich zurückgesetzten) Speicher wie
   die Standards, mit dem Schlüssel 'g|<id>|<schritt>'.
   ───────────────────────────────────────────────────────────── */

let GUIDES = loadJSON('hkl_guides', []);
if(!Array.isArray(GUIDES)) GUIDES = [];
function saveGuides(){ saveJSON('hkl_guides', GUIDES); }
let curGuide = null;            /* aktuell geöffnete Anleitung */
let guideEditId = null;         /* im Editor bearbeitete Anleitung */

/* Bereiche = Gruppierung der Anleitungen (analog zur `gruppe` der Standards). */
const GUIDE_BEREICHE = ['Aufbau & Vorbereitung','Gerät bedienen','Bestellen & Material',
  'Regelmäßige Aufgaben','Patient & Ablauf','Notfall','Hinweise'];
/* Intervalle für wiederkehrende Aufgaben. Das Feld ist bewusst schon da, damit
   die später gewünschte Erinnerung/Benachrichtigung daran andocken kann. */
const GUIDE_INTERVALLE = ['','täglich','wöchentlich','monatlich','quartalsweise','jährlich','bei Bedarf'];

/* ===== Reine, testbare Helfer ===== */
/* Neue ID für Anleitung/Schritt. */
function guideNewId(p){ return (p||'g')+':'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
/* Häkchen-Schlüssel eines Schritts (wie cidOf bei Standards). Rein. */
function guideCid(gid, sid){ return 'g|'+gid+'|'+sid; }
/* Rang eines Intervalls für die „Fällig"-Sortierung (kleiner = häufiger).
   Rein/testbar. */
function intervalRank(iv){
  const order={'täglich':1,'wöchentlich':2,'monatlich':3,'quartalsweise':4,'jährlich':5,'bei Bedarf':6};
  return order[iv||''] || 99;
}
/* Anleitung nach ID. Rein (liest GUIDES). */
function guideById(id){ return (GUIDES||[]).find(g=>g.id===id) || null; }
/* Sichtbare Anleitungen (ausgeblendete nur für Admin). Rein. */
function guideList(){ return (GUIDES||[]).filter(g=>!g.hidden || (typeof ADMIN!=='undefined'&&ADMIN)); }
/* Volltextsuche in Anleitungen (Titel, Bereich, Kurztext, Schritt-Texte).
   Liefert [{id,titel,bereich,treffer}]. Rein/testbar. */
function guideSearch(q){
  q=(q||'').trim().toLowerCase(); if(!q) return [];
  const out=[];
  guideList().forEach(g=>{
    const inHead=((g.titel||'')+' '+(g.bereich||'')+' '+(g.kurz||'')).toLowerCase().indexOf(q)>=0;
    const hits=(g.schritte||[]).filter(s=>((s.text||'')+' '+(s.warn||'')+' '+(s.tipp||'')).toLowerCase().indexOf(q)>=0);
    if(inHead || hits.length) out.push({ id:g.id, titel:g.titel||'', bereich:g.bereich||'', treffer:hits.length, kopf:inHead });
  });
  return out;
}
/* Fortschritt einer Anleitung: wie viele Schritte sind abgehakt? Rein. */
function guideProgress(g){ const st=(g&&g.schritte)||[];
  const done=st.filter(s=>typeof checks!=='undefined'&&checks[guideCid(g.id,s.id)]).length;
  return { done, total:st.length }; }

/* ===== Übersicht (wird von renderStandards im Bereich „Anleitungen" genutzt) ===== */
function guideRowsHTML(query){
  const q=(query||'').trim().toLowerCase();
  let list=guideList().map(g=>({ id:g.id, titel:g.titel||'(ohne Titel)', gruppe:g.bereich||'Sonstige',
    kurz:g.kurz||'', notfall:!!g.notfall, intervall:g.intervall||'', faelligRang:intervalRank(g.intervall),
    schritte:(g.schritte||[]).length }));
  if(q) list=list.filter(x=>(x.titel+' '+x.gruppe+' '+x.kurz).toLowerCase().indexOf(q)>=0);
  if(!list.length){
    return `<div class="empty"><div class="ei">📘</div><h3>${q?'Keine Anleitung gefunden':'Noch keine Anleitungen'}</h3>
      <p>${q?('Für „'+esc(query)+'" gibt es keinen Treffer.'):'Anleitungen erklären eine Aufgabe Schritt für Schritt – Aufbau, Gerätebedienung, Bestellen, regelmäßige Kontrollen.'}</p></div>`;
  }
  const row=(x)=>{
    const badge=x.notfall?`<span class="std-badge nf">🚨 Notfall</span>`:`<span class="std-badge">${esc(x.gruppe)}</span>`;
    const sub=[x.schritte?(x.schritte+' Schritte'):'noch leer', x.intervall?('⏰ '+x.intervall):''].filter(Boolean).join(' · ');
    /* KEIN Inline-onclick: Tippen und langes Halten laufen — wie bei den
       Standards — über den Halte-Detektor (attachHoldNav in quickmenu.js),
       der auf `data-gid` reagiert. Zwei parallele Wege würden die Anleitung
       am Schreibtisch doppelt öffnen. */
    return `<div class="std${x.notfall?' std-nf':''}" data-gid="${esc(x.id)}">
      ${badge}<div class="std-main"><div class="std-title">${esc(x.titel)}</div>
      <div class="std-file">${esc(sub)}${x.kurz?' · '+esc(x.kurz):''}</div></div>
      ${favBtnHTML(x.id)}<span class="chev">›</span></div>`;
  };
  /* Nach Bereich gruppieren – oder flach, wenn eine andere Sortierung aktiv ist. */
  if(curSort==='gruppe'){
    const groups={}; list.forEach(x=>{ (groups[x.gruppe]=groups[x.gruppe]||[]).push(x); });
    return Object.keys(groups).sort((a,b)=>{
        const ia=GUIDE_BEREICHE.indexOf(a), ib=GUIDE_BEREICHE.indexOf(b);
        return (ia<0?99:ia)-(ib<0?99:ib) || a.localeCompare(b,'de'); })
      .map(g=>`<div class="grp">${esc(g)}<span class="ln"></span></div>`+
        sortItems(groups[g],'alpha').map(row).join('')).join('');
  }
  return sortItems(list,curSort).map(row).join('');
}

/* ===== Detailansicht einer Anleitung ===== */
function openGuide(id){
  const g=guideById(id); if(!g) return;
  curGuide=g; if(typeof noteUsage==='function') noteUsage(id);
  nav=[{lvl:'guide',id}];
  try{ history.pushState({d:1,guide:id},''); }catch(e){}
  renderGuide();
  const sw=$('searchWrap'); if(sw) sw.style.display='none';
  /* Auslöser „Anleitung geöffnet" (konfigurierbare Pop-ups). */
  if(typeof popupFire==='function') popupFire({ ereignis:'anleitung-oeffnen', titel:g.titel||'', gid:id });
}
function renderGuide(){
  const g=curGuide; if(!g) return;
  const p=guideProgress(g);
  const steps=(g.schritte||[]);
  let html='';
  if(g.notfall) html+=`<div class="g-nf">🚨 Notfall-Anleitung – Schritte in der angegebenen Reihenfolge abarbeiten.</div>`;
  html+=`<div class="banner"><h2>${esc(g.titel||'Anleitung')}</h2>
    ${g.kurz?`<p>${esc(g.kurz)}</p>`:''}
    <div class="g-meta">
      <span class="tag">${esc(g.bereich||'Sonstige')}</span>
      ${g.intervall?`<span class="tag tag-iv">⏰ ${esc(g.intervall)}</span>`:''}
      ${steps.length?`<span class="tag">${p.done}/${p.total} erledigt</span>`:''}
    </div></div>`;
  if(!steps.length){
    html+=`<div class="empty"><div class="ei">📝</div><h3>Noch keine Schritte</h3><p>${ADMIN?'Über „Bearbeiten" die ersten Schritte anlegen.':'Diese Anleitung ist noch nicht befüllt.'}</p></div>`;
  } else {
    steps.forEach((s,i)=>{
      const cid=guideCid(g.id,s.id); const done=checks[cid]?' done':'';
      const img=s.bild?`<div class="g-img"><img src="${esc(s.bild)}" data-zoom data-cap="${esc('Schritt '+(i+1)+': '+(s.text||'').slice(0,60))}" alt="Schritt ${i+1}"></div>`:'';
      html+=`<div class="g-step${done}" id="e-${esc(cid)}" data-gcid="${esc(cid)}" onclick="toggleGuideCheck(this.dataset.gcid)">
        <div class="g-num">${i+1}</div>
        <div class="g-body">
          <div class="g-text">${esc(s.text||'').replace(/\n/g,'<br>')}</div>
          ${img}
          ${s.warn?`<div class="g-warn">⚠️ ${esc(s.warn)}</div>`:''}
          ${s.tipp?`<div class="g-tipp">💡 ${esc(s.tipp)}</div>`:''}
        </div>
        <div class="chk">✓</div></div>`;
    });
  }
  const admin=ADMIN?`<div class="p-actions" style="margin-top:14px">
      <button class="btn btn-sec" data-gid="${esc(g.id)}" onclick="openGuideEdit(this.dataset.gid)">✎ Bearbeiten</button>
      <button class="btn btn-sec" data-gid="${esc(g.id)}" onclick="openDupGuideForm(this.dataset.gid)">⧉ Duplizieren</button>
      <button class="btn btn-sec" style="color:#d64545" data-gid="${esc(g.id)}" onclick="guideDelete(this.dataset.gid)">🗑 Löschen</button>
    </div>`:'';
  const reset=p.done?`<div class="chk-reset"><span class="cr-count">${p.done} abgehakt</span><button type="button" class="cr-btn" onclick="guideResetChecks()">↺ Alle zurücksetzen</button></div>`:'';
  $('scr-guide').innerHTML=reset+html+admin;
  show('scr-guide');
  setBar(g.titel||'Anleitung', (g.bereich||'')+(steps.length?' · '+steps.length+' Schritte':''), true);
}
function toggleGuideCheck(cid){
  checks[cid]=!checks[cid]; if(!checks[cid]) delete checks[cid]; saveChecks();
  const el=$('e-'+cid); if(el) el.classList.toggle('done',!!checks[cid]);
  /* Auslöser fürs Pop-up-System (abhaken / Häkchen entfernen). */
  if(typeof popupFire==='function'){
    const g=curGuide; const parts=String(cid).split('|'); const st=g&&(g.schritte||[]).find(s=>s.id===parts[2]);
    popupFire({ ereignis: checks[cid]?'check':'uncheck', titel:(st&&st.text)||'', cid, gid:g&&g.id, quelle:'anleitung' });
  }
  const g=curGuide; if(g){ const p=guideProgress(g); setBar(g.titel||'Anleitung',(g.bereich||'')+' · '+p.done+'/'+p.total+' erledigt',true); }
}
function guideResetChecks(){ const g=curGuide; if(!g) return;
  const cids=(g.schritte||[]).map(s=>guideCid(g.id,s.id)).filter(c=>checks[c]);
  if(!cids.length){ toast('Keine Häkchen gesetzt'); return; }
  if(!confirm('Alle '+cids.length+' Häkchen dieser Anleitung zurücksetzen?')) return;
  cids.forEach(c=>delete checks[c]); saveChecks(); renderGuide(); toast(cids.length+' Häkchen zurückgesetzt'); }

/* ===== Editor ===== */
function guideNew(){ if(!ADMIN){ promptLoginThen(guideNew); return; }
  const g={ id:guideNewId('g'), titel:'', bereich:GUIDE_BEREICHE[0], kurz:'', intervall:'', notfall:false,
    schritte:[], createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
  GUIDES.push(g); saveGuides(); openGuideEdit(g.id); }
function openGuideEdit(id){ if(!ADMIN){ promptLoginThen(()=>openGuideEdit(id)); return; }
  const g=guideById(id); if(!g) return; guideEditId=id; renderGuideEdit(); show('scr-guide-edit');
  setBar(g.titel||'Neue Anleitung','Bearbeiten',true); }
function renderGuideEdit(){
  const g=guideById(guideEditId); if(!g) return;
  const ber=GUIDE_BEREICHE.map(b=>`<option value="${esc(b)}"${(g.bereich===b)?' selected':''}>${esc(b)}</option>`).join('');
  const iv=GUIDE_INTERVALLE.map(v=>`<option value="${esc(v)}"${(g.intervall===v)?' selected':''}>${v?esc(v):'– kein Intervall –'}</option>`).join('');
  const steps=(g.schritte||[]).map((s,i)=>`
    <div class="gedit-step">
      <div class="ges-head"><span class="g-num">${i+1}</span>
        <div class="ges-tools">
          <button type="button" class="icon-btn" data-i="${i}" onclick="guideMoveStep(+this.dataset.i,-1)" aria-label="nach oben">▲</button>
          <button type="button" class="icon-btn" data-i="${i}" onclick="guideMoveStep(+this.dataset.i,1)" aria-label="nach unten">▼</button>
          <button type="button" class="icon-btn" data-i="${i}" onclick="guideDelStep(+this.dataset.i)" aria-label="löschen">🗑</button>
        </div></div>
      <textarea class="loc-input ges-text" data-i="${i}" rows="2" placeholder="Was ist zu tun?">${esc(s.text||'')}</textarea>
      <div class="ges-photo">
        ${s.bild?`<img src="${esc(s.bild)}" data-zoom data-cap="Schritt ${i+1}" alt="">`:''}
        <button type="button" class="btn btn-sec" data-i="${i}" onclick="guideStepPhoto(+this.dataset.i)">📷 ${s.bild?'Foto ändern':'Foto hinzufügen'}</button>
        ${s.bild?`<button type="button" class="btn btn-sec" data-i="${i}" onclick="guideStepPhotoDel(+this.dataset.i)">Foto entfernen</button>`:''}
      </div>
      <input class="loc-input ges-warn" data-i="${i}" placeholder="⚠️ Warnung (optional)" value="${esc(s.warn||'')}">
      <input class="loc-input ges-tipp" data-i="${i}" placeholder="💡 Tipp / Hintergrund (optional)" value="${esc(s.tipp||'')}">
    </div>`).join('');
  $('scr-guide-edit').innerHTML=`<div class="pcard">
    <div class="pc-name">Anleitung bearbeiten</div>
    <div class="flabel">TITEL *</div><input class="loc-input" id="gTitel" placeholder="z. B. Rhythmia-Anlage aufbauen" value="${esc(g.titel||'')}">
    <div class="flabel">BEREICH</div><select class="form-sel" id="gBereich" style="width:100%">${ber}</select>
    <div class="flabel">KURZBESCHREIBUNG</div><input class="loc-input" id="gKurz" placeholder="Ein Satz, worum es geht" value="${esc(g.kurz||'')}">
    <div class="flabel">INTERVALL (für regelmäßige Aufgaben)</div><select class="form-sel" id="gIntervall" style="width:100%">${iv}</select>
    <label class="g-check"><input type="checkbox" id="gNotfall" ${g.notfall?'checked':''}> 🚨 Notfall-Anleitung (hervorgehoben)</label>
    <div class="flabel" style="margin-top:14px">SCHRITTE</div>
    <div id="gSteps">${steps||'<p class="hint">Noch keine Schritte – unten den ersten anlegen.</p>'}</div>
    <button type="button" class="add-btn" onclick="guideAddStep()">＋ Schritt</button>
    <div class="p-actions" style="margin-top:14px">
      <button class="btn btn-sec" onclick="guideCancelEdit()">Abbrechen</button>
      <button class="btn btn-pri" onclick="guideSaveForm()">Speichern</button>
    </div></div>`;
}
/* Liest die Formularfelder in das Objekt (ohne zu speichern) — damit beim
   Hinzufügen/Verschieben eines Schritts keine Eingabe verloren geht. */
function guideReadForm(){
  const g=guideById(guideEditId); if(!g) return null;
  const v=(id)=>{ const el=$(id); return el?el.value:undefined; };
  if(v('gTitel')!==undefined) g.titel=v('gTitel').trim();
  if(v('gBereich')!==undefined) g.bereich=v('gBereich');
  if(v('gKurz')!==undefined) g.kurz=v('gKurz').trim();
  if(v('gIntervall')!==undefined) g.intervall=v('gIntervall');
  const nf=$('gNotfall'); if(nf) g.notfall=!!nf.checked;
  document.querySelectorAll('#gSteps .gedit-step').forEach((box,i)=>{
    const s=(g.schritte||[])[i]; if(!s) return;
    const t=box.querySelector('.ges-text'); if(t) s.text=t.value.trim();
    const w=box.querySelector('.ges-warn'); if(w) s.warn=w.value.trim();
    const p=box.querySelector('.ges-tipp'); if(p) s.tipp=p.value.trim();
  });
  return g;
}
function guideAddStep(){ const g=guideReadForm(); if(!g) return;
  (g.schritte=g.schritte||[]).push({ id:guideNewId('s'), text:'', bild:null, warn:'', tipp:'' });
  saveGuides(); renderGuideEdit(); }
function guideDelStep(i){ const g=guideReadForm(); if(!g||!g.schritte[i]) return;
  if(!confirm('Schritt '+(i+1)+' löschen?')) return;
  g.schritte.splice(i,1); saveGuides(); renderGuideEdit(); }
function guideMoveStep(i,dir){ const g=guideReadForm(); if(!g) return;
  const j=i+dir; if(j<0||j>=g.schritte.length) return;
  const t=g.schritte[i]; g.schritte[i]=g.schritte[j]; g.schritte[j]=t;
  saveGuides(); renderGuideEdit(); }
function guideStepPhoto(i){ const g=guideReadForm(); if(!g||!g.schritte[i]) return;
  let inp=$('gPhotoInp');
  if(!inp){ inp=document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.id='gPhotoInp'; inp.style.display='none'; document.body.appendChild(inp); }
  inp.onchange=(ev)=>{ const f=ev.target.files&&ev.target.files[0]; if(!f) return;
    const rd=new FileReader();
    rd.onload=()=>{ const apply=(src)=>{
        const setze=(wert)=>{ const gg=guideById(guideEditId); if(gg&&gg.schritte[i]){ gg.schritte[i].bild=wert; saveGuides(); renderGuideEdit(); } };
        /* Das Foto geht in den MEDIENSPEICHER, nicht in den geteilten Zustand.
           Vorher stand es als base64 in `hkl_guides` — und weil beim Speichern
           IMMER der ganze Schlüssel wandert, wuchs mit jedem Schritt-Foto der
           Umfang JEDER weiteren Speicherung. Gemessen: ein verkleinertes
           Handyfoto wiegt 327 KB base64; drei davon reißen ein 1-MB-Limit, wie
           es Umkehr-Proxys voreingestellt haben. Genau daran ist das Speichern
           im Labor gescheitert („Daten zu groß für den Server").
           Material- und Bestellfotos gehen diesen Weg längst (features/
           medien.js) — die Anleitungen sind bei der Umstellung übersehen
           worden. Im Zustand steht jetzt nur noch die Adresse. */
        if(typeof medFotoSichern==='function'){
          medFotoSichern(src).then(u=>setze(u||src)).catch(()=>setze(src));
        } else setze(src);
      };
      if(typeof openPhotoEditor==='function'){ openPhotoEditor(rd.result,(edited)=>{ if(edited==null) return;
        if(typeof shrinkPhoto==='function') shrinkPhoto(edited,apply); else apply(edited); }); }
      else if(typeof shrinkPhoto==='function') shrinkPhoto(rd.result,apply);
      else apply(rd.result); };
    rd.readAsDataURL(f); try{ ev.target.value=''; }catch(e){} };
  inp.click(); }
function guideStepPhotoDel(i){ const g=guideReadForm(); if(!g||!g.schritte[i]) return;
  g.schritte[i].bild=null; saveGuides(); renderGuideEdit(); }
function guideSaveForm(){ const g=guideReadForm(); if(!g) return;
  if(!g.titel){ toast('Bitte einen Titel angeben.',true); return; }
  g.updatedAt=new Date().toISOString(); saveGuides();
  toast('Anleitung gespeichert'); curGuide=g; renderGuide(); }
function guideCancelEdit(){ const g=guideById(guideEditId);
  /* Frisch angelegte, komplett leere Anleitung beim Abbrechen wieder entfernen. */
  if(g && !g.titel && !(g.schritte||[]).length){ GUIDES=GUIDES.filter(x=>x.id!==g.id); saveGuides(); guideEditId=null;
    curSeg='anleitung'; renderStandards(); show('scr-standards'); updateBar(); return; }
  if(g){ curGuide=g; renderGuide(); } }
function guideDelete(id){ if(!ADMIN){ promptLoginThen(()=>guideDelete(id)); return; }
  const g=guideById(id); if(!g) return;
  if(!confirm('Anleitung „'+(g.titel||'')+'" endgültig löschen?')) return;
  GUIDES=GUIDES.filter(x=>x.id!==id); saveGuides(); curGuide=null; guideEditId=null;
  curSeg='anleitung'; nav=[]; renderStandards(); show('scr-standards'); updateBar(); toast('Anleitung gelöscht'); }
