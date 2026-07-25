/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — ARZTSPEZIFISCHE VARIANTEN
   Ein Standard beschreibt das Vorgehen des Hauses. In der Praxis will aber
   Dr. X eine andere Naht, eine andere Schleusengröße oder einen Extra-Schritt.
   Bisher landete das entweder gar nicht in der App oder verwässerte den
   eigentlichen Standard.

   Lösung: Der Standard bleibt UNANGETASTET. Darüber liegt je Arzt eine dünne
   Variante („Overlay"), die drei Dinge kann:
       · einen Eintrag ÄNDERN  (Name, Menge, Hinweis)
       · einen Eintrag AUSBLENDEN
       · einen Eintrag ERGÄNZEN
   Umgeschaltet wird über Reiter im Kopf des Standards („Standard | Dr. X").
   Jede Abweichung ist deutlich markiert (farbiger Rahmen + Kürzel-Badge), damit
   man immer sieht, was Standard ist und was arztspezifisch — nahtlos integriert,
   aber klar unterscheidbar.

   Der aktive Arzt ist GERÄTELOKAL (jeder arbeitet gerade bei einem anderen),
   die Varianten-Inhalte selbst werden geteilt.
   ───────────────────────────────────────────────────────────── */

let VARIANTS = loadJSON('hkl_variants', { aerzte:[], data:{} });
if(!VARIANTS || typeof VARIANTS!=='object') VARIANTS={ aerzte:[], data:{} };
if(!Array.isArray(VARIANTS.aerzte)) VARIANTS.aerzte=[];
if(!VARIANTS.data || typeof VARIANTS.data!=='object') VARIANTS.data={};
function saveVariants(){ saveJSON('hkl_variants', VARIANTS); }
let curVariant = store.get('hkl_curvariant') || '';   /* '' = reiner Standard */
let variantEditSid = null;

const VAR_FARBEN = ['#8b5cf6','#0ea5e9','#f59e0b','#10b981','#ec4899','#ef4444'];

/* ===== Reine, testbare Helfer ===== */
function varNewId(){ return 'v:'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
/* Arzt-Datensatz nach ID. Rein. */
function varArzt(id){ return (VARIANTS.aerzte||[]).find(a=>a.id===id)||null; }
/* Aktive Variante (oder null, wenn reiner Standard). Rein. */
function varActive(){ return curVariant?varArzt(curVariant):null; }
/* Overlay-Topf eines Arztes (anlegen, falls nötig). */
function varBucket(id){ const d=VARIANTS.data[id]||(VARIANTS.data[id]={qe:{},hidden:{},added:{}});
  if(!d.qe) d.qe={}; if(!d.hidden) d.hidden={}; if(!d.added) d.added={}; return d; }
/* Kürzel aus einem Namen ableiten („Dr. Tscheban" → „TSC"). Rein/testbar. */
function varKurz(name){
  const s=String(name||'').replace(/(^|\s)(dr\.?|prof\.?|med\.?)(\s|$)/gi,' ').trim();
  if(!s) return '??';
  const w=s.split(/\s+/).filter(Boolean);
  if(w.length>=2) return (w[0][0]+w[w.length-1][0]).toUpperCase();
  return s.slice(0,3).toUpperCase();
}
/* Variantenwert für einen Eintrag (nur wenn eine Variante aktiv ist). Rein. */
function varGet(cid, prop){
  if(!curVariant) return undefined;
  const d=VARIANTS.data[curVariant]; if(!d||!d.qe) return undefined;
  const o=d.qe[cid]; if(!o) return undefined;
  const v=o[prop];
  return (v===undefined||v===null||v==='')?undefined:v;
}
/* Blendet die aktive Variante diesen Eintrag aus? Rein. */
function varHidden(cid){ if(!curVariant) return false;
  const d=VARIANTS.data[curVariant]; return !!(d&&d.hidden&&d.hidden[cid]); }
/* Weicht dieser Eintrag in der aktiven Variante ab? Rein. */
function varChanged(cid){ if(!curVariant) return false;
  const d=VARIANTS.data[curVariant]; if(!d) return false;
  const o=d.qe&&d.qe[cid];
  return !!(o && Object.keys(o).some(k=>o[k]!==undefined&&o[k]!==null&&o[k]!==''));
}
/* Zusätzliche Einträge der Variante für (Standard, Rubrik). Rein. */
function varAdded(sid, ri){ if(!curVariant) return [];
  const d=VARIANTS.data[curVariant]; if(!d||!d.added) return [];
  return (d.added[sid+'|'+ri]||[]).slice(); }
/* Anzahl der Abweichungen eines Arztes in einem Standard. Rein/testbar. */
function varDiffCount(arztId, sid){
  const d=VARIANTS.data[arztId]; if(!d) return 0;
  let n=0;
  Object.keys(d.qe||{}).forEach(cid=>{ if(cid.indexOf(sid+'|')===0){
    const o=d.qe[cid]; if(o&&Object.keys(o).some(k=>o[k])) n++; } });
  Object.keys(d.hidden||{}).forEach(cid=>{ if(cid.indexOf(sid+'|')===0 && d.hidden[cid]) n++; });
  Object.keys(d.added||{}).forEach(k=>{ if(k.indexOf(sid+'|')===0) n+=(d.added[k]||[]).length; });
  return n;
}

/* ===== Umschalten ===== */
function setVariant(id){
  curVariant=id||''; store.set('hkl_curvariant',curVariant);
  if(curVariant && !varArzt(curVariant)){ curVariant=''; store.set('hkl_curvariant',''); }
  /* Aktuelle Ansicht neu aufbauen. */
  const top=nav[nav.length-1];
  if(top&&top.lvl==='rub'&&typeof openRubrik==='function') openRubrik(top.idx,true);
  else if(curStd&&typeof openStandard==='function') openStandard(curStd.id,true);
  const a=varActive();
  toast(a?('Ansicht: '+a.name):'Ansicht: Standard');
}
/* Reiter-Leiste („Standard | Dr. X | …") für den Kopf eines Standards. */
function varBarHTML(sid){
  const aerzte=VARIANTS.aerzte||[];
  if(!aerzte.length && !ADMIN) return '';
  const tab=(id,label,sub,farbe)=>{
    const on=(curVariant===id);
    const st=(id&&farbe)?` style="--vcol:${esc(farbe)}"`:'';
    return `<button class="vtab${on?' on':''}"${st} role="tab" aria-selected="${on?'true':'false'}" tabindex="${on?'0':'-1'}" data-v="${esc(id)}" onclick="setVariant(this.dataset.v)">
      <span class="vtab-l">${esc(label)}</span>${sub?`<span class="vtab-s">${esc(sub)}</span>`:''}</button>`;
  };
  let h=`<div class="vartabs" role="tablist" aria-label="Standard oder arztspezifische Variante">`+tab('','Standard','Haus-Vorgabe','');
  aerzte.forEach(a=>{ const n=varDiffCount(a.id,sid); h+=tab(a.id,a.name,n?(n+' abweichend'):'wie Standard',a.farbe); });
  h+=`</div>`;
  if(ADMIN){ h+=`<div class="var-admin">
      <button class="vlink" onclick="openVariantAdmin()">👤 Ärzte verwalten</button>
      ${curVariant?`<button class="vlink" data-s="${esc(sid)}" onclick="openVariantEdit(this.dataset.s)">✎ Abweichungen bearbeiten</button>`:''}
    </div>`; }
  const a=varActive();
  if(a) h+=`<div class="var-note" style="--vcol:${esc(a.farbe||'#8b5cf6')}">Du siehst die Variante <b>${esc(a.name)}</b>. Abweichungen sind farbig markiert; alles andere entspricht dem Standard.</div>`;
  return h;
}
/* Badge an einem abweichenden Eintrag. */
function varBadgeHTML(cid){
  const a=varActive(); if(!a) return '';
  if(!varChanged(cid)) return '';
  return `<span class="var-badge" style="--vcol:${esc(a.farbe||'#8b5cf6')}">${esc(a.kurz||varKurz(a.name))}</span>`;
}

/* ===== Ärzte verwalten ===== */
function openVariantAdmin(){ if(!ADMIN){ promptLoginThen(openVariantAdmin); return; }
  renderVariantAdmin(); show('scr-variants'); setBar('Ärzte & Varianten',(VARIANTS.aerzte||[]).length+' angelegt',true); }
function renderVariantAdmin(){
  const box=$('scr-variants'); if(!box) return;
  const rows=(VARIANTS.aerzte||[]).map((a,i)=>`
    <div class="ukrow" style="border-left-color:${esc(a.farbe||'#8b5cf6')}">
      <div class="ukrow-head"><span class="uk-name">${esc(a.name)}</span><span class="uk-count">${esc(a.kurz||varKurz(a.name))}</span></div>
      <div class="uk-actions">
        <button data-i="${i}" onclick="varRename(+this.dataset.i)">Umbenennen</button>
        <button data-i="${i}" onclick="varRecolor(+this.dataset.i)">Farbe</button>
        <button data-i="${i}" onclick="varDelete(+this.dataset.i)">🗑 Löschen</button>
      </div></div>`).join('');
  box.innerHTML=`<div class="banner"><h2>Ärzte &amp; Varianten</h2>
      <p>Lege die Ärztinnen und Ärzte an, für die es abweichende Vorgehensweisen gibt. Im Standard erscheinen sie als Reiter neben „Standard"; dort lassen sich Einträge ändern, ausblenden oder ergänzen – der Standard selbst bleibt unverändert.</p></div>
    <div class="form-row" style="margin-bottom:12px">
      <input class="loc-input" id="varNewName" placeholder="Name, z. B. Dr. Tscheban">
      <button class="add-btn" onclick="varAdd()">Anlegen</button>
    </div>
    ${rows||`<div class="empty"><div class="ei">👤</div><h3>Noch keine Ärzte</h3><p>Oben den ersten Namen eintragen.</p></div>`}`;
  const inp=$('varNewName'); if(inp) inp.onkeydown=(e)=>{ if(e.key==='Enter'){ e.preventDefault(); varAdd(); } };
}
function varAdd(){ const inp=$('varNewName'); const name=(inp&&inp.value||'').trim(); if(!name){ toast('Bitte einen Namen eingeben.',true); return; }
  const a={ id:varNewId(), name, kurz:varKurz(name), farbe:VAR_FARBEN[(VARIANTS.aerzte||[]).length%VAR_FARBEN.length] };
  VARIANTS.aerzte.push(a); varBucket(a.id); saveVariants(); renderVariantAdmin(); toast('„'+name+'" angelegt'); }
function varRename(i){ const a=(VARIANTS.aerzte||[])[i]; if(!a) return;
  const n=prompt('Name:',a.name); if(n==null||!n.trim()) return;
  a.name=n.trim(); a.kurz=varKurz(a.name); saveVariants(); renderVariantAdmin(); }
function varRecolor(i){ const a=(VARIANTS.aerzte||[])[i]; if(!a) return;
  const cur=VAR_FARBEN.indexOf(a.farbe); a.farbe=VAR_FARBEN[(cur+1)%VAR_FARBEN.length]; saveVariants(); renderVariantAdmin(); }
function varDelete(i){ const a=(VARIANTS.aerzte||[])[i]; if(!a) return;
  if(!confirm('„'+a.name+'" mit allen Abweichungen löschen? Der Standard bleibt unverändert.')) return;
  VARIANTS.aerzte.splice(i,1); delete VARIANTS.data[a.id];
  if(curVariant===a.id){ curVariant=''; store.set('hkl_curvariant',''); }
  saveVariants(); renderVariantAdmin(); toast('Gelöscht'); }

/* ===== Abweichungen eines Standards bearbeiten ===== */
function openVariantEdit(sid){ if(!ADMIN){ promptLoginThen(()=>openVariantEdit(sid)); return; }
  if(!curVariant){ toast('Erst oben einen Arzt auswählen.',true); return; }
  variantEditSid=sid||(curStd&&curStd.id); renderVariantEdit(); show('scr-variant-edit');
  const a=varActive(); setBar('Abweichungen',(a?a.name:'')+' · '+(curStd?stdTitel(curStd):''),true); }
function renderVariantEdit(){
  const box=$('scr-variant-edit'); if(!box) return;
  const a=varActive(); const s=DB.standards.find(x=>x.id===variantEditSid);
  if(!a||!s){ box.innerHTML='<p class="hint">Kein Arzt/Standard gewählt.</p>'; return; }
  const d=varBucket(a.id);
  let html=`<div class="banner"><h2>Abweichungen für ${esc(a.name)}</h2>
    <p>Bei „${esc(stdTitel(s))}“: Einträge umbenennen, Menge ändern, einen Hinweis ergänzen oder ausblenden. Leere Felder = wie im Standard.</p></div>`;
  (s.rubriken||[]).forEach((r,ri)=>{
    if(rubHidden(r,ri)) return;
    const items=[];
    (r.sub_bereiche||[]).forEach((sb,si)=>{ (sb.eintraege||[]).forEach((e,ei)=>{
      if(e.natur==='ueberschrift'||e.ist_fliesstext) return;
      items.push({ e, cid:cidOf(s.id,ri,si,ei) }); }); });
    if(!items.length && !varAdded(s.id,ri).length) return;
    html+=`<div class="grp">${esc(rubName(r,ri))}<span class="ln"></span></div>`;
    items.forEach(({e,cid})=>{
      const o=(d.qe&&d.qe[cid])||{}; const hid=!!(d.hidden&&d.hidden[cid]);
      html+=`<div class="ve-row${hid?' ve-hidden':''}">
        <div class="ve-base">${esc(e.anzeige_text||'')}${e.menge?` <span class="ve-m">${esc(e.menge)}</span>`:''}</div>
        <div class="ve-fields">
          <input class="loc-input ve-name" data-cid="${esc(cid)}" placeholder="anderer Name (optional)" value="${esc(o.name||'')}">
          <input class="loc-input ve-menge" data-cid="${esc(cid)}" placeholder="andere Menge" value="${esc(o.menge||'')}">
          <input class="loc-input ve-hinweis" data-cid="${esc(cid)}" placeholder="Hinweis für ${esc(a.kurz||'')}" value="${esc(o.hinweis||'')}">
          <label class="g-check"><input type="checkbox" class="ve-hide" data-cid="${esc(cid)}" ${hid?'checked':''}> ausblenden</label>
        </div></div>`;
    });
    varAdded(s.id,ri).forEach((x,xi)=>{
      html+=`<div class="ve-row ve-add">
        <div class="ve-base">＋ zusätzlich (nur ${esc(a.kurz||'')})</div>
        <div class="ve-fields">
          <input class="loc-input va-name" data-ri="${ri}" data-i="${xi}" placeholder="Bezeichnung" value="${esc(x.name||'')}">
          <input class="loc-input va-menge" data-ri="${ri}" data-i="${xi}" placeholder="Menge" value="${esc(x.menge||'')}">
          <button type="button" class="icon-btn" data-ri="${ri}" data-i="${xi}" onclick="varDelAdded(+this.dataset.ri,+this.dataset.i)">🗑</button>
        </div></div>`;
    });
    html+=`<button type="button" class="add-btn" data-ri="${ri}" onclick="varAddEntry(+this.dataset.ri)">＋ zusätzlicher Eintrag in „${esc(rubName(r,ri))}"</button>`;
  });
  html+=`<div class="p-actions" style="margin-top:16px">
    <button class="btn btn-sec" onclick="varEditBack()">Zurück</button>
    <button class="btn btn-pri" onclick="varSaveEdit()">Speichern</button></div>`;
  box.innerHTML=html;
}
/* Formular → Overlay (ohne Speichern), damit „＋" nichts verwirft. */
function varReadEdit(){
  const a=varActive(); if(!a) return null; const d=varBucket(a.id);
  document.querySelectorAll('#scr-variant-edit .ve-name').forEach(el=>{
    const cid=el.dataset.cid; const o=d.qe[cid]||(d.qe[cid]={}); o.name=el.value.trim(); });
  document.querySelectorAll('#scr-variant-edit .ve-menge').forEach(el=>{
    const cid=el.dataset.cid; const o=d.qe[cid]||(d.qe[cid]={}); o.menge=el.value.trim(); });
  document.querySelectorAll('#scr-variant-edit .ve-hinweis').forEach(el=>{
    const cid=el.dataset.cid; const o=d.qe[cid]||(d.qe[cid]={}); o.hinweis=el.value.trim(); });
  document.querySelectorAll('#scr-variant-edit .ve-hide').forEach(el=>{
    const cid=el.dataset.cid; if(el.checked) d.hidden[cid]=true; else delete d.hidden[cid]; });
  document.querySelectorAll('#scr-variant-edit .va-name').forEach(el=>{
    const arr=d.added[variantEditSid+'|'+el.dataset.ri]; const x=arr&&arr[+el.dataset.i]; if(x) x.name=el.value.trim(); });
  document.querySelectorAll('#scr-variant-edit .va-menge').forEach(el=>{
    const arr=d.added[variantEditSid+'|'+el.dataset.ri]; const x=arr&&arr[+el.dataset.i]; if(x) x.menge=el.value.trim(); });
  /* Leere Überlagerungen aufräumen, damit „abweichend" ehrlich bleibt. */
  Object.keys(d.qe).forEach(cid=>{ const o=d.qe[cid];
    if(!o || !Object.keys(o).some(k=>o[k])) delete d.qe[cid]; });
  return d;
}
function varAddEntry(ri){ const a=varActive(); if(!a) return; varReadEdit(); const d=varBucket(a.id);
  const key=variantEditSid+'|'+ri; (d.added[key]=d.added[key]||[]).push({ id:'va'+Date.now().toString(36), name:'', menge:'' });
  saveVariants(); renderVariantEdit(); }
function varDelAdded(ri,i){ const a=varActive(); if(!a) return; varReadEdit(); const d=varBucket(a.id);
  const key=variantEditSid+'|'+ri; if(d.added[key]) d.added[key].splice(i,1);
  if(d.added[key] && !d.added[key].length) delete d.added[key];
  saveVariants(); renderVariantEdit(); }
function varSaveEdit(){ varReadEdit(); saveVariants(); toast('Abweichungen gespeichert');
  if(curStd&&typeof openStandard==='function'){ openStandard(curStd.id,true); } }
function varEditBack(){ varReadEdit(); saveVariants();
  if(curStd&&typeof openStandard==='function') openStandard(curStd.id,true); }
