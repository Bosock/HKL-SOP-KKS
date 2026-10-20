/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — NOTIZEN IM NEUAUFBAU

   Der Neuaufbau ist auch ein Notizbuch: Beim Einrichten fällt laufend auf,
   was die künftige App können soll, was stört, was fehlt. Solche Gedanken
   sind flüchtig — wer erst einen Zettel sucht, hat sie verloren.

   Deshalb ein Knopf in der Leiste des Neuaufbaus („📝 Notiz"), der auf JEDEM
   Bildschirm erreichbar ist. Eine Notiz bekommt automatisch mit, WO sie
   entstand: Bildschirm, Standard, Rubrik, offenes Produkt. Später lässt sich
   die Liste durchsehen, abhaken und als Datei sichern — als Grundlage für
   das, was in den Bestand übergehen soll.

   Gespeichert im geteilten Zustand des Neuaufbaus (hkl_notizen): Was am
   Tablet notiert wird, liegt am Rechner bereit.
   ───────────────────────────────────────────────────────────── */

const NOTIZ_ARTEN = [
  { key:'wunsch', ico:'💡', vorgabe:'Wunsch' },
  { key:'fehler', ico:'🐞', vorgabe:'Fehler' },
  { key:'frage',  ico:'❓', vorgabe:'Frage' },
  { key:'inhalt', ico:'📝', vorgabe:'Inhalt' },
];
let NOTIZEN = loadJSON('hkl_notizen', []);
function notizNormal(){ if(!Array.isArray(NOTIZEN)) NOTIZEN = []; }
notizNormal();
function saveNotizen(){ notizNormal(); saveJSON('hkl_notizen', NOTIZEN); }
function notizArt(k){ return NOTIZ_ARTEN.find(a=>a.key===k) || NOTIZ_ARTEN[0]; }
function notizOffen(){ notizNormal(); return NOTIZEN.filter(n=>n && !n.erledigt).length; }

/* Wo bin ich gerade? Nur, was sich ohne Raten sagen lässt. */
function notizKontext(){
  const k = {};
  try{
    const akt = document.querySelector('.screen.active');
    if(akt) k.bildschirm = akt.id;
    const t = $('barTitle'), c = $('barCrumb');
    if(t && t.textContent) k.titel = t.textContent.trim();
    if(c && c.textContent) k.pfad = c.textContent.trim();
    if(typeof mode!=='undefined') k.modus = mode;
    if(typeof curStd!=='undefined' && curStd && (k.bildschirm==='scr-rubriken' || k.bildschirm==='scr-detail' || k.bildschirm==='scr-editor')){
      k.std = { id:curStd.id, titel:(typeof stdTitel==='function'?stdTitel(curStd):curStd.titel) };
      const top = (typeof nav!=='undefined' && nav.length) ? nav[nav.length-1] : null;
      if(top && top.lvl==='rub' && curStd.rubriken && curStd.rubriken[top.idx]) k.rubrik = curStd.rubriken[top.idx].name || ('Rubrik '+(top.idx+1));
    }
    if(k.bildschirm==='scr-scan-item' && typeof scanOffenId!=='undefined' && scanOffenId) k.produkt = scanOffenId;
    k.breite = window.innerWidth || null;
  }catch(e){}
  return k;
}
function notizKontextText(k){
  if(!k) return '';
  const teile = [];
  if(k.std) teile.push('Standard „'+k.std.titel+'"');
  if(k.rubrik) teile.push('Rubrik „'+k.rubrik+'"');
  if(k.produkt){ const r=(typeof GTINDB!=='undefined')&&GTINDB[k.produkt]; teile.push('Produkt „'+(r?(r.name||r.ref||k.produkt):k.produkt)+'"'); }
  if(!teile.length && k.titel) teile.push(k.titel+(k.pfad?(' · '+k.pfad):''));
  return teile.join(' › ');
}

/* ── Erfassen ── */
let notizEntwurf = null;   /* { art, kontext } */
function notizOeffnen(){
  notizEntwurf = { art:'wunsch', kontext:notizKontext() };
  notizBlattZeichnen('');
  showSheet(true);
  setTimeout(()=>{ const t=$('notizText'); if(t) try{ t.focus(); }catch(e){} }, 80);
}
function notizBlattZeichnen(text){
  const e = notizEntwurf; if(!e) return;
  const ort = notizKontextText(e.kontext);
  $('sheet').innerHTML = `<div class="sheet-grip"></div><div class="sheet-title">📝 Notiz zum Neuaufbau</div>
    <div class="filter-row" role="group" aria-label="Art der Notiz">${NOTIZ_ARTEN.map(a=>
      `<button type="button" class="${e.art===a.key?'on':''}" aria-pressed="${e.art===a.key?'true':'false'}" data-k="${esc(a.key)}" onclick="notizArtWahl(this.dataset.k)">${esc(a.ico+' '+a.vorgabe)}</button>`).join('')}</div>
    <textarea class="loc-input" id="notizText" rows="5" style="width:100%" placeholder="Was ist dir aufgefallen? Was soll die künftige App können?">${esc(text||'')}</textarea>
    ${ort?`<p class="hint" style="margin:6px 4px 0">📍 ${esc(ort)}</p>`:''}
    <div class="p-actions" style="margin-top:10px"><button class="btn btn-sec" onclick="showSheet(false)">Abbrechen</button><button class="btn btn-pri" onclick="notizSpeichern()">Notiz speichern</button></div>`;
}
function notizArtWahl(k){
  if(!notizEntwurf) return;
  const t = $('notizText'); const text = t ? t.value : '';
  notizEntwurf.art = notizArt(k).key;
  notizBlattZeichnen(text);
}
function notizSpeichern(){
  const t = $('notizText'); const text = (t && t.value || '').trim();
  if(!text){ toast('Bitte erst etwas notieren.', true); return; }
  const e = notizEntwurf || { art:'wunsch', kontext:notizKontext() };
  notizNormal();
  NOTIZEN.push({ id:'n'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
    t:new Date().toISOString(), art:e.art, text, kontext:e.kontext||{}, erledigt:false });
  saveNotizen();
  notizEntwurf = null;
  showSheet(false);
  notizZaehlerZeigen();
  toast('Notiz gespeichert');
}

/* Zähler offener Notizen am Knopf in der Leiste. */
function notizZaehlerZeigen(){
  const b = $('notizBtn'); if(!b) return;
  const n = notizOffen();
  b.textContent = '📝 Notiz' + (n ? (' · '+n) : '');
}

/* ── Durchsehen (Verwaltung) ── */
let notizFilter = 'offen';
function notizSetzeFilter(f){ notizFilter = f; if(typeof renderAdmin==='function') renderAdmin(); notizKarteOffen(); }
function notizKarteOffen(){ setTimeout(()=>{ const d=$('notizKarte'); if(d) d.open=true; }, 30); }
function notizUmschalten(id){
  notizNormal();
  const n = NOTIZEN.find(x=>x && x.id===id); if(!n) return;
  n.erledigt = !n.erledigt; saveNotizen(); notizZaehlerZeigen();
  if(typeof renderAdmin==='function') renderAdmin(); notizKarteOffen();
}
let notizLoeschFrage = null;
function notizLoeschen(id){
  if(notizLoeschFrage!==id){ notizLoeschFrage = id; if(typeof renderAdmin==='function') renderAdmin(); notizKarteOffen(); return; }
  notizLoeschFrage = null;
  notizNormal();
  NOTIZEN = NOTIZEN.filter(x=>x && x.id!==id); saveNotizen(); notizZaehlerZeigen();
  if(typeof renderAdmin==='function') renderAdmin(); notizKarteOffen();
  toast('Notiz gelöscht');
}
function notizPanelHTML(){
  if(!RAUM.neu) return '';
  notizNormal();
  const fb = (k,l)=>`<button class="${notizFilter===k?'on':''}" aria-pressed="${notizFilter===k?'true':'false'}" onclick="notizSetzeFilter('${k}')">${esc(l)}</button>`;
  const liste = NOTIZEN.filter(n=>n && (notizFilter==='alle' || (notizFilter==='offen' ? !n.erledigt : n.erledigt))).slice().reverse();
  const zeilen = liste.map(n=>{
    const a = notizArt(n.art);
    const wann = n.t ? new Date(n.t).toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short'}) : '';
    const ort = notizKontextText(n.kontext);
    const frage = notizLoeschFrage===n.id;
    return `<div class="ukrow" style="${n.erledigt?'opacity:.6;':''}"><div class="ukrow-head"><span class="uk-name">${esc(a.ico)} ${esc(n.text)}</span></div>
      <div class="vw-ctx">${esc(wann)}${ort?(' · 📍 '+esc(ort)):''}</div>
      <div class="uk-actions"><button data-id="${esc(n.id)}" onclick="notizUmschalten(this.dataset.id)">${n.erledigt?'↺ wieder offen':'✓ erledigt'}</button>
        <button class="icon danger-btn" data-id="${esc(n.id)}" onclick="notizLoeschen(this.dataset.id)">${frage?'Wirklich löschen?':'🗑'}</button></div></div>`;
  }).join('');
  return `<details class="vpanel" id="notizKarte" data-keys="notizen notiz wunsch fehler frage idee neuaufbau">${vsum('📝','Notizen','Was beim Neuaufbau auffällt — mit Ort, abhakbar, als Datei',notizOffen()?(notizOffen()+' offen'):'')}<div class="vpanel-body">
    <div class="filter-row">${fb('offen','Offen')}${fb('erledigt','Erledigt')}${fb('alle','Alle')}</div>
    ${zeilen || '<p class="hint">Keine Notizen in diesem Filter. Solange der Neuaufbau nicht live ist, steht der Knopf „📝 Notiz" in der violetten Leiste auf jedem Bildschirm.</p>'}
    <div class="p-actions"><button class="btn btn-pri" onclick="notizOeffnen()">📝 Neue Notiz</button><button class="btn btn-sec" onclick="notizExport()">Als Datei sichern</button></div>
  </div></details>`;
}

/* Alle Notizen als lesbare Textdatei (Markdown), nach Art gegliedert. */
function notizMarkdown(liste){
  const l = (Array.isArray(liste)?liste:[]).filter(Boolean);
  let md = '# Notizen aus dem Neuaufbau\n\nStand: '+new Date().toLocaleString('de-DE')+' · '+l.length+' Notizen\n';
  NOTIZ_ARTEN.forEach(a=>{
    const teil = l.filter(n=>notizArt(n.art).key===a.key);
    if(!teil.length) return;
    md += '\n## '+a.ico+' '+a.vorgabe+'\n\n';
    teil.forEach(n=>{
      const ort = notizKontextText(n.kontext);
      md += '- ['+(n.erledigt?'x':' ')+'] '+String(n.text).replace(/\n+/g,' ')+(ort?(' — 📍 '+ort):'')+' ('+(n.t||'').slice(0,10)+')\n';
    });
  });
  return md;
}
function notizExport(){
  notizNormal();
  const blob = new Blob([notizMarkdown(NOTIZEN)], { type:'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'neuaufbau-notizen-'+today()+'.md';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url), 4000);
  toast('Notizen gesichert');
}
