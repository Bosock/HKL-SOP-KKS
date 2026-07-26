/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — DIAGNOSE: FEHLER- UND PROBLEMANALYSE

   Zweck: Die App soll OHNE Entwickler benutzbar und wartbar sein. Dafür
   braucht es eine Stelle, an der man nachsehen kann: „Was ist da gerade
   schiefgelaufen?" — und zwar in zwei Sorten, die beide zählen:

     1. TECHNISCHE FEHLER  — was der Browser meldet (JavaScript-Fehler,
        abgebrochene Netzanfragen, Fehler-Meldungen der App).
     2. GEFÜHLTE FEHLER    — „ich wollte eine Anleitung öffnen und es ging
        nicht". Technisch passiert dabei oft GAR NICHTS — kein Absturz, keine
        Meldung. Genau diese Fälle sind die schwierigsten und die häufigsten.
        Deshalb kann jeder Mensch mit zwei Sätzen ein Problem melden, und die
        App hängt den technischen Zusammenhang selbst an (Bildschirm, Weg
        dorthin, Gerät, letzte Fehler).

   Dazu ein SELBSTTEST, der typische Bruchstellen aktiv prüft, statt auf einen
   Bericht zu warten — inklusive der Prüfung „ist jede Listenzeile überhaupt
   bedienbar?" (genau daran scheiterten die Anleitungen auf dem Handy).

   Am Ende steht ein BERICHT ZUM KOPIEREN: ein kurzer Textblock, den man in
   eine Nachricht oder ein GitHub-Issue einfügen kann. Damit wird aus „geht
   nicht" ein bearbeitbarer Befund.

   Geteilter Zustand: `hkl_diag` (in SHARED_KEYS) — Meldungen und Fehler ALLER
   Geräte laufen an einem Ort zusammen. Bewusst NICHT in BACKUP_KEYS: ein
   Backup soll Inhalte sichern, keine alten Fehlerprotokolle zurückspielen.
   ───────────────────────────────────────────────────────────── */

/* ===== Reine, testbare Helfer ===== */

const DIAG_MAX=150;                 /* Ringpuffer: so viele Einträge, dann fällt der älteste raus */
const DIAG_ARTEN = { fehler:'🛑 Fehler', meldung:'🐞 Gemeldetes Problem', hinweis:'⚠️ Warnung', system:'ℹ️ System' };

/* Kürzt lange Texte auf eine für ein Protokoll sinnvolle Länge. Rein. */
function diagShort(s, n){ const t=String(s==null?'':s).replace(/\s+/g,' ').trim();
  const max=n||300; return t.length>max?(t.slice(0,max-1)+'…'):t; }

/* Erkennungsmerkmal eines Eintrags. Gleiche Art + gleicher Text + gleicher
   Bildschirm = derselbe Fehler, auch wenn er 200-mal auftritt. Rein. */
function diagSig(e){ return [(e&&e.art)||'', diagShort((e&&e.text)||'',120), (e&&e.wo)||''].join('|'); }

/* Fügt einen Eintrag in den Ringpuffer ein — mit ZUSAMMENFASSUNG statt
   Flutung: Ein Fehler, der in einer Schleife 500-mal auftritt, ergibt EINEN
   Eintrag mit Zähler. Ohne das wäre das Protokoll nach dem ersten kaputten
   Render unbrauchbar. Neueste zuerst. Rein & testbar. */
function diagPush(list, eintrag, max){
  const arr=Array.isArray(list)?list.slice():[];
  const sig=diagSig(eintrag);
  const i=arr.findIndex(x=>diagSig(x)===sig);
  if(i>=0){
    const alt=arr.splice(i,1)[0];
    arr.unshift(Object.assign({}, alt, { n:(alt.n||1)+1, zuletzt:eintrag.t||alt.zuletzt||alt.t }));
  } else {
    arr.unshift(Object.assign({ n:1 }, eintrag));
  }
  const cap=max||DIAG_MAX;
  return arr.length>cap?arr.slice(0,cap):arr;
}

/* „vor 3 Minuten" — im Protokoll ist der Abstand wichtiger als die Uhrzeit.
   Rein & testbar (jetzt optional übergebbar). */
function diagAlter(iso, jetzt){
  const t=Date.parse(iso||''); if(!isFinite(t)) return '';
  const s=Math.max(0, Math.round(((jetzt||Date.now())-t)/1000));
  if(s<60) return 'gerade eben';
  const m=Math.round(s/60); if(m<60) return 'vor '+m+' Min.';
  const h=Math.round(m/60); if(h<24) return 'vor '+h+' Std.';
  const d=Math.round(h/24); return 'vor '+d+' Tag'+(d===1?'':'en');
}

/* Zeilen, die niemand öffnen kann: Eine Listenzeile ist nur bedienbar, wenn
   sie entweder ein eigenes onclick trägt ODER ein Daten-Attribut, das der
   zuständige Halte-Detektor kennt. Genau hier lag der Anleitungs-Fehler —
   die Zeilen trugen `data-gid`, der Detektor kannte nur `data-sid`, und auf
   Touch verschluckte er den Tipp. Rein & testbar. */
function diagRowProblems(rows, bekannteKeys){
  const keys=bekannteKeys||[];
  return (rows||[]).filter(r=>{
    if(!r) return false;
    if(r.onclick) return false;                       /* eigener Klick-Handler */
    const d=r.dataset||{};
    return !keys.some(k=>d[k]!=null && d[k]!=='');
  });
}

/* Schalter, die INNERHALB einer Listenzeile sitzen (⭐ Favorit, ⋯ Menü) und
   vom Halte-Detektor nicht ausgenommen sind. Der Detektor lauscht am
   CONTAINER (Delegation) und beansprucht den Tipp auf der ganzen Zeile —
   ein `event.stopPropagation()` im Inline-onclick des Schalters kommt dann
   gar nicht mehr zum Zug, weil der native Klick unterdrückt wird. Ergebnis:
   Der Schalter tut am Handy nichts, stattdessen öffnet sich die Zeile.
   Erwartet Zeilen mit `.querySelectorAll` und `.matches`. Rein & testbar. */
function diagInnerBlocked(rows, ignoreSel){
  const raus=[];
  (rows||[]).forEach(row=>{
    if(!row || !row.querySelectorAll) return;
    [...row.querySelectorAll('button, a[href], [onclick]')].forEach(el=>{
      if(ignoreSel && el.matches && el.matches(ignoreSel)) return;
      if(ignoreSel && el.closest && el.closest(ignoreSel)) return;
      raus.push(el);
    });
  });
  return raus;
}

/* Baut den Bericht zum Kopieren. Reine Textfunktion — nimmt fertige Daten
   entgegen, damit sie ohne Browser prüfbar ist. */
function diagBerichtText(d){
  d=d||{};
  const L=[];
  L.push('HKL-SOP — Diagnosebericht');
  L.push('erstellt: '+(d.jetzt||''));
  if(d.version) L.push('App/Cache: '+d.version);
  if(d.geraet) L.push('Gerät: '+d.geraet);
  if(d.netz) L.push('Verbindung: '+d.netz);
  L.push('');
  if(d.pruefungen && d.pruefungen.length){
    const schlecht=d.pruefungen.filter(p=>!p.ok).length;
    L.push('SELBSTTEST: '+(d.pruefungen.length-schlecht)+'/'+d.pruefungen.length+' in Ordnung');
    d.pruefungen.forEach(p=>L.push('  '+(p.ok?'[ok] ':'[!!] ')+p.titel+(p.info?(' — '+p.info):'')));
    L.push('');
  }
  const eintraege=(d.eintraege||[]);
  if(!eintraege.length){ L.push('PROTOKOLL: keine Einträge.'); }
  else {
    L.push('PROTOKOLL ('+eintraege.length+' Einträge, neueste zuerst):');
    eintraege.forEach(e=>{
      L.push('  ['+(e.art||'')+'] '+(e.t||'')+(e.n>1?(' ×'+e.n):''));
      L.push('    '+diagShort(e.text||'', 400));
      if(e.wo) L.push('    Bildschirm: '+e.wo);
      if(e.wunsch) L.push('    Wollte: '+diagShort(e.wunsch,200));
      if(e.weg) L.push('    Weg: '+diagShort(e.weg,300));
      if(e.stack) L.push('    Technik: '+diagShort(e.stack,300));
    });
  }
  return L.join('\n');
}

/* ===== Zustand ===== */
let DIAG = (typeof loadJSON==='function') ? loadJSON('hkl_diag',[]) : [];
if(!Array.isArray(DIAG)) DIAG=[];
let DIAGWEG=[];                     /* Wegprotokoll (nur im Speicher, wird nicht geteilt) */
let _diagSaveTimer=null, _diagBusy=false;

function diagSave(){
  if(_diagSaveTimer) clearTimeout(_diagSaveTimer);
  /* Gebündelt speichern: ein Fehlerschauer soll nicht 50 Schreibvorgänge
     (und 50 Synchronisationen) auslösen. */
  _diagSaveTimer=setTimeout(()=>{ _diagSaveTimer=null;
    try{ if(typeof saveJSON==='function') saveJSON('hkl_diag', DIAG); }catch(e){} }, 600);
}

/* Der eine Eingang ins Protokoll. `_diagBusy` verhindert Endlosschleifen,
   falls das Protokollieren selbst einen Fehler auslöst. */
function diagLog(art, text, extra){
  if(_diagBusy) return null;
  _diagBusy=true;
  try{
    const e=Object.assign({
      art:art||'fehler',
      text:diagShort(text, 600),
      t:new Date().toISOString(),
      wo:diagWo(),
      weg:DIAGWEG.slice(-8).join(' → '),
    }, extra||{});
    DIAG=diagPush(DIAG, e, DIAG_MAX);
    diagSave();
    if(typeof document!=='undefined' && document.getElementById('scr-diag')
       && document.getElementById('scr-diag').classList.contains('active')) renderDiag();
    return e;
  } catch(err){ return null; }
  finally{ _diagBusy=false; }
}

/* Wo befindet sich der Nutzer gerade? (aktiver Bildschirm + Modus) */
function diagWo(){
  try{
    const s=document.querySelector('.screen.active');
    const m=(typeof mode!=='undefined')?mode:'';
    return (s?s.id:'?')+(m?(' · '+m):'');
  }catch(e){ return '?'; }
}
/* Wegprotokoll: die letzten Stationen. Kurz halten — es geht um Kontext,
   nicht um Überwachung. */
function diagWeg(was){ if(!was) return; DIAGWEG.push(String(was)); if(DIAGWEG.length>25) DIAGWEG.shift(); }

/* ===== Automatische Erfassung ===== */
(function diagHooks(){
  if(typeof window==='undefined') return;

  /* 1) JavaScript-Fehler */
  window.addEventListener('error', (ev)=>{
    try{
      /* Ein fehlgeschlagener Bild-/Skript-Ladevorgang meldet sich ohne
         ev.message — dann ist das Ziel die eigentliche Information. */
      if(ev && ev.target && ev.target!==window && (ev.target.src||ev.target.href)){
        diagLog('hinweis', 'Datei konnte nicht geladen werden: '+(ev.target.src||ev.target.href));
        return;
      }
      const m=(ev&&ev.message)||'Unbekannter Fehler';
      const q=(ev&&ev.filename)?(' ('+String(ev.filename).split('/').slice(-1)[0]+':'+(ev.lineno||'?')+')'):'';
      diagLog('fehler', m+q, { stack:(ev&&ev.error&&ev.error.stack)||'' });
    }catch(e){}
  }, true);

  /* 2) Nicht abgefangene Zusagen (async-Fehler) */
  window.addEventListener('unhandledrejection', (ev)=>{
    try{
      const r=ev&&ev.reason;
      diagLog('fehler', 'Unbehandelter Fehler: '+((r&&r.message)||String(r)), { stack:(r&&r.stack)||'' });
    }catch(e){}
  });

  /* 3) Fehler-Meldungen der App selbst (roter Toast). Das ist die wertvollste
     technische Quelle: Es sind genau die Stellen, an denen die App dem Nutzer
     sagt „das hat nicht geklappt". */
  const origToast=window.toast;
  if(typeof origToast==='function'){
    window.toast=function(msg, err){
      try{ if(err) diagLog('hinweis', String(msg||'')); }catch(e){}
      return origToast.apply(this, arguments);
    };
  }

  /* 4) Wegprotokoll an den beiden Stellen, an denen die App die Ansicht
     wechselt — mehr braucht es nicht, um einen Bericht einzuordnen. */
  const origShow=window.show;
  if(typeof origShow==='function'){
    window.show=function(scr){ try{ diagWeg(scr); }catch(e){} return origShow.apply(this, arguments); };
  }
  const origSetMode=window.setMode;
  if(typeof origSetMode==='function'){
    window.setMode=function(m){ try{ diagWeg('modus:'+m); }catch(e){} return origSetMode.apply(this, arguments); };
  }
})();

/* ===== Selbsttest ===== */
/* Jede Prüfung liefert { ok, info }. Sie müssen NEBENWIRKUNGSFREI sein —
   der Selbsttest darf nichts kaputt machen, was er prüft. */
function diagChecks(){
  const P=[];
  const add=(titel, fn, hilfe)=>{
    let ok=false, info='';
    try{ const r=fn()||{}; ok=!!r.ok; info=r.info||''; }
    catch(e){ ok=false; info='Prüfung selbst fehlgeschlagen: '+((e&&e.message)||e); }
    P.push({ titel, ok, info, hilfe:hilfe||'' });
  };

  add('Alle Bildschirme vorhanden', ()=>{
    const soll=['scr-standards','scr-rubriken','scr-detail','scr-care','scr-scan','scr-scan-item',
      'scr-guide','scr-guide-edit','scr-search','scr-admin','scr-diag'];
    const fehlt=soll.filter(id=>!document.getElementById(id));
    return { ok:!fehlt.length, info:fehlt.length?('fehlt: '+fehlt.join(', ')):(soll.length+' Bildschirme') };
  }, 'Ein fehlender Bildschirm bedeutet: index.html und Code sind auseinandergelaufen.');

  add('Übersichtszeilen sind bedienbar', ()=>{
    /* Genau der Fehler, den die Anleitungen hatten: Zeile da, aber kein Weg
       hinein. Geprüft wird gegen die Attribute, die der Halte-Detektor
       tatsächlich auswertet — nicht gegen eine Wunschliste. */
    const reg=(typeof HOLDNAV!=='undefined')?HOLDNAV:[];
    const problems=[];
    reg.forEach(h=>{
      if(!h.el) return;
      const rows=[...h.el.querySelectorAll(h.rowSel)];
      diagRowProblems(rows, h.keys).forEach(r=>problems.push(h.el.id+' '+h.rowSel));
    });
    return { ok:!problems.length, info:problems.length?(problems.length+' Zeile(n) ohne Handler: '+[...new Set(problems)].join(', ')):'alle Zeilen erreichbar' };
  }, 'Eine Zeile ohne bekanntes Daten-Attribut lässt sich auf dem Handy nicht öffnen (der Halte-Detektor verschluckt den Tipp).');

  add('Schalter in Zeilen erreichbar', ()=>{
    /* Zweite Hälfte derselben Fehlerklasse: Die ZEILE ist bedienbar, aber ein
       Schalter DARIN (⭐, ⋯) wird vom Halte-Detektor mitverschluckt. */
    const reg=(typeof HOLDNAV!=='undefined')?HOLDNAV:[];
    const treffer=[];
    reg.forEach(h=>{
      if(!h.el) return;
      const rows=[...h.el.querySelectorAll(h.rowSel)];
      diagInnerBlocked(rows, h.ignoreSel).forEach(el=>
        treffer.push((h.el.id||'?')+' '+(el.className||el.tagName)));
    });
    const arten=[...new Set(treffer)];
    return { ok:!arten.length, info:arten.length?('verschluckt: '+arten.join(', ')):'alle Schalter frei' };
  }, 'Ein Schalter in einer Zeile braucht eine Ausnahme im Halte-Detektor (ignoreSel) — sonst öffnet ein Tipp darauf am Handy die Zeile, statt zu schalten.');

  add('Anleitungen vollständig', ()=>{
    const g=(typeof GUIDES!=='undefined'&&Array.isArray(GUIDES))?GUIDES:[];
    const leer=g.filter(x=>!(x.schritte||[]).length);
    return { ok:!leer.length, info:g.length?(g.length+' Anleitungen'+(leer.length?(', davon '+leer.length+' ohne Schritte'):'')):'keine Anleitungen angelegt' };
  }, 'Eine Anleitung ohne Schritte öffnet sich zwar, hilft aber niemandem.');

  add('Material-Verknüpfungen heil', ()=>{
    if(typeof MATLINK==='undefined'||typeof GTINDB==='undefined') return { ok:true, info:'nicht geladen' };
    const tot=Object.keys(MATLINK).filter(k=>MATLINK[k]&&!GTINDB[MATLINK[k]]);
    return { ok:!tot.length, info:tot.length?(tot.length+' Verknüpfung(en) zeigen ins Leere'):(Object.keys(MATLINK).length+' Verknüpfungen') };
  }, 'Verwaiste Verknüpfungen entstehen, wenn ein Stammsatz gelöscht wurde. Material-Zentrale → Prüfen.');

  add('Speicherplatz ausreichend', ()=>{
    let bytes=0;
    try{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i);
      bytes+=(k.length+(localStorage.getItem(k)||'').length)*2; } }catch(e){ return { ok:true, info:'nicht messbar' }; }
    const mb=bytes/1048576;
    return { ok:mb<4.2, info:mb.toFixed(2)+' MB belegt (Grenze der Browser meist ~5 MB)' };
  }, 'Wird es eng, helfen weniger/kleinere Fotos oder ein Backup mit anschließendem Aufräumen.');

  add('Verbindung zum Server', ()=>{
    const on=(typeof navigator!=='undefined')?(navigator.onLine!==false):true;
    const dot=document.getElementById('syncDot');
    const st=(dot&&dot.title)||'';
    return { ok:on, info:(on?'online':'offline (die App arbeitet weiter, gleicht später ab)')+(st?(' · '+st):'') };
  }, 'Offline ist kein Fehler — die App speichert lokal und überträgt, sobald wieder Netz da ist.');

  add('Neueste App-Version geladen', ()=>{
    const ctrl=(typeof navigator!=='undefined'&&navigator.serviceWorker)?navigator.serviceWorker.controller:null;
    return { ok:true, info:ctrl?'Offline-Version aktiv':'ohne Offline-Cache (Erststart oder deaktiviert)' };
  }, 'Nach einem Update lädt die App genau einmal selbst neu.');

  add('Keine Fehler in den letzten 24 Stunden', ()=>{
    const grenze=Date.now()-86400000;
    const neu=DIAG.filter(e=>e.art==='fehler' && Date.parse(e.zuletzt||e.t||'')>=grenze);
    return { ok:!neu.length, info:neu.length?(neu.length+' Fehlerart(en), siehe Protokoll'):'sauber' };
  }, 'Details stehen im Register „Protokoll".');

  return P;
}

/* ===== Oberfläche ===== */
let diagTab='protokoll';

function openDiag(){
  diagTab='protokoll';
  renderDiag();
  show('scr-diag');
  setBar('Diagnose', 'Fehler · Meldungen · Selbsttest', true);
  const sw=$('searchWrap'); if(sw) sw.style.display='none';
}
function diagGo(t){ diagTab=t; renderDiag(); }

function renderDiag(){
  const box=$('scr-diag'); if(!box) return;
  const offen=DIAG.filter(e=>e.art==='fehler'||e.art==='meldung').length;
  const reiter=[['protokoll','Protokoll',offen?String(offen):''],['test','Selbsttest','']]
    .map(([k,l,b])=>`<button type="button" class="mc-tab${diagTab===k?' on':''}" role="tab"
       aria-selected="${diagTab===k?'true':'false'}" tabindex="${diagTab===k?'0':'-1'}"
       data-t="${k}" onclick="diagGo(this.dataset.t)"><span class="mc-tab-l">${l}</span>${b?`<span class="mc-tab-n">${esc(b)}</span>`:''}</button>`).join('');
  box.innerHTML=`
    <div class="diag-intro">Hier steht, was schiefgelaufen ist — technisch <b>und</b> gefühlt.
      Etwas funktioniert nicht wie erwartet? Melden, auch wenn keine Fehlermeldung kam.</div>
    <button type="button" class="sheet-pick-btn" style="margin:0 0 12px" onclick="diagMeldenForm()">🐞 Problem melden</button>
    <div class="mc-tabs" role="tablist" aria-label="Diagnose" onkeydown="diagTabKey(event)">${reiter}</div>
    <div id="diagBody">${diagTab==='test'?diagTestHTML():diagProtokollHTML()}</div>`;
}
/* Pfeiltasten zwischen den Reitern (W3C-Tab-Muster wie in der Material-Zentrale). */
function diagTabKey(ev){
  const keys=['protokoll','test']; const i=keys.indexOf(diagTab);
  if(ev.key==='ArrowRight'){ ev.preventDefault(); diagGo(keys[(i+1)%keys.length]); }
  else if(ev.key==='ArrowLeft'){ ev.preventDefault(); diagGo(keys[(i-1+keys.length)%keys.length]); }
}

function diagProtokollHTML(){
  if(!DIAG.length){
    return `<div class="empty"><div class="ei">✅</div><h3>Nichts zu berichten</h3>
      <p>Es sind keine Fehler aufgetreten und keine Probleme gemeldet worden.</p></div>`;
  }
  const zeilen=DIAG.map((e,i)=>{
    const art=DIAG_ARTEN[e.art]||e.art;
    const wann=diagAlter(e.zuletzt||e.t);
    const details=[e.wunsch?('<b>Wollte:</b> '+esc(e.wunsch)):'', e.wo?('<b>Bildschirm:</b> '+esc(e.wo)):'',
      e.weg?('<b>Weg:</b> '+esc(e.weg)):'', e.geraet?('<b>Gerät:</b> '+esc(e.geraet)):'',
      e.stack?('<b>Technik:</b> '+esc(diagShort(e.stack,300))):''].filter(Boolean).join('<br>');
    return `<div class="diag-row diag-${esc(e.art)}">
      <div class="diag-head"><span class="diag-art">${esc(art)}</span>
        ${e.n>1?`<span class="diag-n">${e.n}×</span>`:''}
        <span class="diag-when">${esc(wann)}</span>
        <button type="button" class="diag-del" data-i="${i}" onclick="diagDelete(+this.dataset.i)" aria-label="Eintrag entfernen">✕</button></div>
      <div class="diag-text">${esc(e.text||'')}</div>
      ${details?`<div class="diag-det">${details}</div>`:''}</div>`;
  }).join('');
  return zeilen+`<div class="p-actions" style="margin-top:14px">
      <button class="btn btn-sec" onclick="diagCopy()">📋 Bericht kopieren</button>
      <button class="btn btn-sec" style="color:#d64545" onclick="diagClear()">🗑 Protokoll leeren</button>
    </div>
    <p class="hint">Der Bericht enthält Selbsttest, die letzten Einträge und Angaben zum Gerät —
    er lässt sich direkt in eine Nachricht oder ein GitHub-Issue einfügen.</p>`;
}

function diagTestHTML(){
  const P=diagChecks();
  const schlecht=P.filter(p=>!p.ok).length;
  const kopf=schlecht
    ? `<div class="diag-sum bad">${schlecht} von ${P.length} Prüfungen auffällig</div>`
    : `<div class="diag-sum good">Alle ${P.length} Prüfungen in Ordnung</div>`;
  const zeilen=P.map(p=>`<div class="diag-check${p.ok?'':' bad'}">
      <div class="dc-ico">${p.ok?'✓':'!'}</div>
      <div class="dc-body"><div class="dc-t">${esc(p.titel)}</div>
        ${p.info?`<div class="dc-i">${esc(p.info)}</div>`:''}
        ${(!p.ok&&p.hilfe)?`<div class="dc-h">${esc(p.hilfe)}</div>`:''}</div></div>`).join('');
  return kopf+zeilen+`<div class="p-actions" style="margin-top:14px">
      <button class="btn btn-sec" onclick="diagGo('test')">↻ Erneut prüfen</button>
      <button class="btn btn-sec" onclick="diagCopy()">📋 Bericht kopieren</button>
    </div>`;
}

/* ===== „Problem melden" — der gefühlte Fehler ===== */
function diagMeldenForm(){
  const el=diagSheetEnsure();
  el.querySelector('#diagSheetBody').innerHTML=`
    <div class="wiz-head"><div class="wiz-title">🐞 Problem melden</div>
      <button type="button" class="wiz-x" onclick="diagSheetClose()" aria-label="Abbrechen">✕</button></div>
    <p class="wiz-help">Zwei Sätze genügen. Den technischen Zusammenhang (Bildschirm, Weg dorthin,
      Gerät, letzte Fehler) hängt die App selbst an — du musst nichts davon wissen.</p>
    <div class="flabel">WAS WOLLTEST DU TUN?</div>
    <input class="loc-input" id="diagWunsch" placeholder="z. B. eine Anleitung öffnen">
    <div class="flabel">WAS IST STATTDESSEN PASSIERT?</div>
    <textarea class="loc-input" id="diagWas" rows="3" placeholder="z. B. nichts – die Anleitung geht nicht auf"></textarea>
    <div class="wiz-actions">
      <button type="button" class="btn btn-sec" onclick="diagSheetClose()">Abbrechen</button>
      <button type="button" class="btn btn-pri" onclick="diagMeldenSave()">Melden</button>
    </div>`;
  el.classList.add('show'); el.setAttribute('aria-hidden','false');
  setTimeout(()=>{ const i=document.getElementById('diagWunsch'); if(i) try{ i.focus(); }catch(e){} }, 40);
}
function diagMeldenSave(){
  const wunsch=(($('diagWunsch')||{}).value||'').trim();
  const was=(($('diagWas')||{}).value||'').trim();
  if(!wunsch && !was){ toast('Bitte kurz beschreiben, was nicht funktioniert hat.', true); return; }
  /* Der aktive Bildschirm ist der VORHERIGE — das Melde-Fenster ist ein
     Overlay, kein Bildschirmwechsel. Passt also. */
  diagLog('meldung', was||wunsch, { wunsch, geraet:diagGeraet() });
  diagSheetClose();
  toast('Danke – das Problem ist im Protokoll vermerkt (Menü → 🩺 Diagnose).');
}
function diagGeraet(){
  try{
    const ua=navigator.userAgent||'';
    const kurz=/SamsungBrowser/i.test(ua)?'Samsung Internet':(/Chrome/i.test(ua)?'Chrome':(/Safari/i.test(ua)?'Safari':(/Firefox/i.test(ua)?'Firefox':'Browser')));
    const os=/Android/i.test(ua)?'Android':(/iPhone|iPad/i.test(ua)?'iOS':(/Windows/i.test(ua)?'Windows':(/Mac/i.test(ua)?'macOS':'')));
    return [kurz, os, (window.innerWidth+'×'+window.innerHeight)].filter(Boolean).join(' · ');
  }catch(e){ return ''; }
}
/* Kleines Overlay für das Melde-Formular (nutzt die Assistent-Optik). */
function diagSheetEnsure(){
  let el=document.getElementById('diagSheet');
  if(el) return el;
  el=document.createElement('div');
  el.id='diagSheet'; el.className='wiz'; el.setAttribute('aria-hidden','true');
  el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true'); el.setAttribute('aria-label','Problem melden');
  el.innerHTML='<div class="wiz-card"><div class="wiz-body" id="diagSheetBody"></div></div>';
  document.body.appendChild(el);
  document.addEventListener('keydown',(ev)=>{ if(ev.key==='Escape'&&el.classList.contains('show')) diagSheetClose(); });
  return el;
}
function diagSheetClose(){ const el=document.getElementById('diagSheet'); if(!el) return;
  el.classList.remove('show'); el.setAttribute('aria-hidden','true'); }

/* ===== Bericht / Pflege ===== */
function diagBerichtDaten(){
  return {
    jetzt:new Date().toISOString(),
    version:(typeof APP_VERSION!=='undefined')?APP_VERSION:'',
    geraet:diagGeraet(),
    netz:(typeof navigator!=='undefined'&&navigator.onLine===false)?'offline':'online',
    pruefungen:diagChecks().map(p=>({ ok:p.ok, titel:p.titel, info:p.info })),
    eintraege:DIAG.slice(0,25),
  };
}
function diagCopy(){
  const text=diagBerichtText(diagBerichtDaten());
  const fertig=()=>toast('Bericht kopiert – in eine Nachricht oder ein GitHub-Issue einfügen.');
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(fertig, ()=>diagCopyFallback(text)); return; }
  }catch(e){}
  diagCopyFallback(text);
}
/* Ohne Zwischenablage-Recht (ältere Browser, kein https): Text sichtbar
   machen und markieren, damit man ihn von Hand kopieren kann. */
function diagCopyFallback(text){
  const ta=document.createElement('textarea');
  ta.value=text; ta.style.position='fixed'; ta.style.left='2vw'; ta.style.top='10vh';
  ta.style.width='96vw'; ta.style.height='70vh'; ta.style.zIndex='2000';
  document.body.appendChild(ta); ta.select();
  let ok=false; try{ ok=document.execCommand('copy'); }catch(e){}
  if(ok){ document.body.removeChild(ta); toast('Bericht kopiert.'); }
  else { toast('Bitte den markierten Text kopieren und dann antippen.', true);
    ta.addEventListener('blur',()=>{ try{ document.body.removeChild(ta); }catch(e){} }); }
}
function diagDelete(i){ if(i<0||i>=DIAG.length) return; DIAG.splice(i,1);
  try{ if(typeof saveJSON==='function') saveJSON('hkl_diag', DIAG); }catch(e){}
  renderDiag(); }
function diagClear(){
  if(!confirm('Das gesamte Protokoll leeren? Gemeldete Probleme gehen dabei verloren.')) return;
  DIAG=[]; try{ if(typeof saveJSON==='function') saveJSON('hkl_diag', DIAG); }catch(e){}
  renderDiag(); toast('Protokoll geleert');
}
