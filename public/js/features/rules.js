/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — REGELWERK (Verwaltungspolitik, Stufe 1)
   Umsetzung von docs/konzepte/2026-07-17-verwaltungspolitik-revision.md:

   EINE Änderung = EIN unveränderliches Regel-Ereignis im append-only
   Journal `hkl_rules` (geteilt + im Backup):
     { id, ts, von, op:'set'|'revoke', ref?, ziel:{art:'material',key},
       wo:{art:'stelle'|'standard'|'gruppe'|'alle', wert?}, prop, wert }

   Grundsätze (State of the Art: CSS-Kaskade · GPO/RSoP · Feature-Flags ·
   Event-Sourcing/ALCOA):
     - Nie löschen/überschreiben: Rücknahme ist ein 'revoke'-Ereignis →
       lückenloser Audit-Trail und Ein-Klick-Rückgängig, auch für
       Massenänderungen.
     - EINE Kaskade: 📍 Stelle > 📄 Standard > 🗂 Gruppe > 🌐 alle;
       bei gleicher Reichweite gewinnt die neuere Regel. Die Alt-Speicher
       bleiben als Rand der Kaskade lesbar (Stelle=QE.cid/overrides/reassign,
       alle=QE.mat) — Strangler, kein Big-Bang.
     - Sync als VEREINIGUNG (rulesUnion in core/sync.js adopt): zwei Geräte,
       die gleichzeitig Regeln anlegen, überschreiben einander nicht.
     - Treffervorschau VOR dem Anwenden („betrifft N Vorkommen in
       M Standards") + Inspektor („Warum so?") für Transparenz.
   ───────────────────────────────────────────────────────────── */

/* ===== Reiner, testbarer Kern ===== */

/* Aktive Regeln = 'set'-Ereignisse, die kein 'revoke' referenziert. */
function rulesActive(list){ const rev=new Set((list||[]).filter(r=>r&&r.op==='revoke'&&r.ref).map(r=>r.ref));
  return (list||[]).filter(r=>r&&r.op==='set'&&!rev.has(r.id)); }

/* Vereinigung zweier Journale (per id, deterministisch nach ts/id sortiert).
   Append-only ⇒ Vereinigung ist verlustfrei, idempotent und kommutativ. */
function rulesUnion(a,b){ const m=new Map();
  (a||[]).concat(b||[]).forEach(r=>{ if(r&&r.id&&!m.has(r.id)) m.set(r.id,r); });
  return [...m.values()].sort((x,y)=>(x.ts===y.ts)?((x.id<y.id)?-1:1):((x.ts<y.ts)?-1:1)); }

/* Kaskaden-Rang der Reichweite (höher = spezifischer = gewinnt). */
function ruleRank(wo){ return ({stelle:4,standard:3,gruppe:2,alle:1})[(wo&&wo.art)||'']||0; }

/* Gewinnt Regel a gegen Regel b? Spezifischere Reichweite zuerst,
   bei Gleichstand die neuere (ts), zuletzt id (Determinismus). */
function ruleBeats(a,b){ const ra=ruleRank(a.wo), rb=ruleRank(b.wo);
  if(ra!==rb) return ra>rb; if(a.ts!==b.ts) return a.ts>b.ts; return a.id>b.id; }

/* ===== Zustand + Index ===== */
let RULES=loadJSON('hkl_rules',[]);
let RULES_IDX=null; /* Map 'materialKey|prop' → aktive Regeln */
function rebuildRulesIndex(){ RULES_IDX=new Map();
  rulesActive(RULES).forEach(r=>{ if(!r.ziel||r.ziel.art!=='material'||!r.ziel.key||!r.prop) return;
    const k=r.ziel.key+'|'+r.prop; if(!RULES_IDX.has(k)) RULES_IDX.set(k,[]); RULES_IDX.get(k).push(r); }); }
rebuildRulesIndex();
function saveRules(){ saveJSON('hkl_rules',RULES); rebuildRulesIndex(); }

/* ===== Kontext-Helfer ===== */
/* Standard-ID aus einer cid (sid|ri|si|ei bzw. 'new|<id>'). */
function cidStd(cid){ if(!cid) return null;
  if(cid.indexOf('new|')===0){ const n=(typeof NEW!=='undefined'?NEW:[]).find(x=>('new|'+x.id)===cid); return n?n.std:null; }
  const i=cid.indexOf('|'); return i>0?cid.slice(0,i):null; }
function stdGruppeById(sid){ if(!sid||!DB||!DB.standards) return null; const s=DB.standards.find(x=>x.id===sid); return s?stdGruppe(s):null; }

/* Wer legt die Regel an? GitHub-Login (falls angemeldet), sonst Geräte-ID. */
function ruleActor(){ try{ if(typeof currentGithubUser!=='undefined'&&currentGithubUser&&currentGithubUser.login) return 'github:'+currentGithubUser.login; }catch(e){}
  let v=store.get('hkl_voterid'); if(!v){ v='d'+Math.random().toString(36).slice(2,10); store.set('hkl_voterid',v); } return 'gerät:'+v; }

/* ===== Der Kaskaden-Vorschalter =====
   Liefert den Regel-Wert für (Eintrag, Stelle, Eigenschaft) oder undefined.
   Wird von qeGet/effNatur/rawUk ZWISCHEN Stelle (Alt) und „alle" (Alt)
   konsultiert — genau die Kaskadenposition von Standard-/Gruppen-Regeln. */
function ruleGet(e,cid,prop){
  if(!RULES_IDX||!e||!e.material_key) return undefined;
  const lst=RULES_IDX.get(e.material_key+'|'+prop); if(!lst||!lst.length) return undefined;
  const sid=cidStd(cid); if(!sid) return undefined;
  let grp=null, grpKnown=false, best=null;
  for(const r of lst){
    if(r.wo.art==='standard'){ if(r.wo.wert!==sid) continue; }
    else if(r.wo.art==='gruppe'){ if(!grpKnown){ grp=stdGruppeById(sid); grpKnown=true; } if(!grp||r.wo.wert!==grp) continue; }
    else if(r.wo.art!=='alle') continue; /* 'stelle'-Regeln kommen erst in Stufe 2 */
    if(!best||ruleBeats(r,best)) best=r;
  }
  return best?best.wert:undefined;
}

/* ===== Regeln anlegen / zurücknehmen ===== */
function newRuleId(){ return 'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function addRule(ziel,wo,prop,wert,notiz){
  RULES.push({ id:newRuleId(), ts:new Date().toISOString(), von:ruleActor(), op:'set', ziel, wo, prop, wert, notiz:notiz||null });
  saveRules(); buildMaterialIndex(); if(prop==='uk') computeUkList(); }
function revokeRule(id){ const r=RULES.find(x=>x.id===id&&x.op==='set'); if(!r) return;
  RULES.push({ id:newRuleId(), ts:new Date().toISOString(), von:ruleActor(), op:'revoke', ref:id });
  saveRules(); buildMaterialIndex(); computeUkList(); }

/* ===== Treffervorschau (RSoP-Prinzip): was würde eine Regel erfassen? ===== */
function ruleHits(materialKey,wo){ const stds=new Set(); let n=0;
  if(DB&&DB.standards) DB.standards.forEach(s=>{
    if(wo.art==='standard'&&s.id!==wo.wert) return;
    if(wo.art==='gruppe'&&stdGruppe(s)!==wo.wert) return;
    (s.rubriken||[]).forEach(r=>(r.sub_bereiche||[]).forEach(sb=>(sb.eintraege||[]).forEach(e=>{
      if(e.material_key===materialKey&&!e.ist_fliesstext&&e.natur!=='ueberschrift'){ n++; stds.add(s.id); } })));
  });
  return { vorkommen:n, standards:[...stds] }; }

/* ===== Anzeige-Helfer ===== */
function rulePropLabel(p){ return ({name:'Name',natur:'Kategorie',uk:'Unterkategorie',color:'Farbe',important:'Wichtig-Markierung',mengeHi:'Zahl-Hervorhebung',mengeVal:'Menge',groessen:'Größen',spez:'Spezifikation',hidden:'Sichtbarkeit'})[p]||p; }
function ruleWertLabel(prop,wert){
  if(prop==='natur') return natOf(wert).label;
  if(prop==='hidden') return wert?'ausgeblendet':'sichtbar';
  if(prop==='uk') return (wert===''||wert==null)?'— ohne —':String(wert);
  if(prop==='groessen') return (Array.isArray(wert)&&wert.length)?wert.map(g=>g.wert).join(', '):'keine';
  if(prop==='color') return wert?String(wert):'keine Farbe';
  if(wert==null||wert==='') return 'entfernt';
  if(wert===true) return 'an'; if(wert===false) return 'aus';
  return String(wert); }
function ruleWoLabel(wo){ if(!wo) return '';
  if(wo.art==='standard'){ const s=DB&&DB.standards.find(x=>x.id===wo.wert); return '📄 '+(s?stdTitel(s):wo.wert); }
  if(wo.art==='gruppe') return '🗂 Gruppe „'+(wo.wert||'')+'"';
  if(wo.art==='alle') return '🌐 überall';
  return '📍 nur hier'; }
function ruleVonLabel(v){ return (v||'').replace('github:','').replace('gerät:','Gerät '); }
function ruleDatum(ts){ return (ts||'').slice(0,10); }

/* ===== Verwaltungs-Panel: 🧾 Regeln & Journal ===== */
function rulesPanelHTML(){
  const act=rulesActive(RULES); const revoked=RULES.filter(r=>r.op==='revoke').length;
  let h=`<details class="vpanel" data-keys="regeln journal historie protokoll änderungen aenderungen rückgängig rueckgaengig sammel massen bulk gruppe wer wann"><summary>🧾 Regeln & Journal <span class="vp-hint">${act.length} aktiv</span></summary><div class="vpanel-body">
    <p class="panel-help">Jede Sammel-Änderung (Standard-, Gruppen- oder Überall-Reichweite) ist eine <b>Regel</b>: sichtbar, wer sie wann angelegt hat, und mit einem Tipp <b>rücknehmbar</b>. Nichts wird gelöscht — Zurücknehmen ist ein eigener Journaleintrag (Nachvollziehbarkeit).</p>`;
  if(!act.length) h+=`<p class="hint">Noch keine Regeln. Sammel-Änderungen entstehen im Bearbeiten-Menü eines Eintrags über „Wo soll es gelten?" → <b>In diesem Standard</b>, <b>In der Gruppe</b> oder <b>Überall</b>.</p>`;
  act.slice().reverse().slice(0,50).forEach(r=>{
    h+=`<div class="rule-row"><div class="rule-main"><b>${esc(rulePropLabel(r.prop))}</b> → ${esc(ruleWertLabel(r.prop,r.wert))}<div class="rule-ctx">${esc(r.ziel.key)}</div>
      <div class="rule-meta"><span class="schip">${esc(ruleWoLabel(r.wo))}</span><span class="schip">👥 alle Geräte</span> · ${esc(ruleVonLabel(r.von))} · ${esc(ruleDatum(r.ts))}</div></div>
      <button class="btn btn-sec rule-undo" data-id="${esc(r.id)}" onclick="revokeRule(this.dataset.id);renderAdmin();toast('Regel zurückgenommen')">↺ Zurücknehmen</button></div>`; });
  if(act.length>50) h+=`<p class="hint">Zeige die 50 neuesten von ${act.length} aktiven Regeln.</p>`;
  if(revoked) h+=`<p class="hint">${revoked} zurückgenommene Regel(n) bleiben im Journal erhalten (Audit).</p>`;
  h+=`</div></details>`; return h; }

/* ===== Inspektor: „Warum so?" (CSS-Computed-Styles-/RSoP-Prinzip) =====
   Zeigt je Eigenschaft die komplette Kaskade: Gewinner markiert, überstimmte
   Quellen durchgestrichen, Regeln mit Urheber/Datum + Rücknahme. */
function whyChain(e,cid,prop){
  const rows=[]; const mk=e.material_key;
  /* 📍 Stelle (Alt-Speicher) */
  let hier;
  if(prop==='natur') hier=overrides[cid];
  else if(prop==='uk') hier=(cid in reassign)?(reassign[cid]==null?'':reassign[cid]):undefined;
  else hier=(QE.cid[cid]||{})[prop];
  if(hier!==undefined) rows.push({src:'📍 nur hier', wert:hier});
  /* 📄/🗂/🌐 Regeln */
  const lst=(mk&&RULES_IDX&&RULES_IDX.get(mk+'|'+prop))||[]; const sid=cidStd(cid); const grp=sid?stdGruppeById(sid):null;
  lst.filter(r=>(r.wo.art==='standard'&&r.wo.wert===sid)||(r.wo.art==='gruppe'&&grp&&r.wo.wert===grp)||(r.wo.art==='alle'))
     .sort((a,b)=>ruleBeats(a,b)?-1:1)
     .forEach(r=>rows.push({src:ruleWoLabel(r.wo), wert:r.wert, rule:r}));
  /* 🌐 „überall" (Alt-Speicher) */
  let alle;
  if(prop==='natur') alle=mk&&QE.mat[mk]&&QE.mat[mk].natur;
  else if(prop==='uk') alle=(mk&&QE.mat[mk]&&('uk' in QE.mat[mk]))?QE.mat[mk].uk:undefined;
  else alle=mk?((QE.mat[mk]||{})[prop]):undefined;
  if(alle!==undefined&&alle!==null||(prop==='uk'&&alle!==undefined)) rows.push({src:'🌐 überall (Alt)', wert:alle});
  /* Quelldatei */
  let basis;
  if(prop==='natur') basis=e.natur_manuell||e.natur;
  else if(prop==='uk') basis=e.unterkategorie;
  else if(prop==='name') basis=e.anzeige_text;
  else if(prop==='mengeVal') basis=e.menge;
  else if(prop==='groessen') basis=e.groessen;
  else if(prop==='spez') basis=Array.isArray(e.spezifikation)?e.spezifikation.join(' | '):e.spezifikation;
  else basis=undefined;
  rows.push({src:'Quelldatei', wert:basis, basis:true});
  return rows; }
function openWhySheet(){ const e=sheetEntry, cid=sheetCid; if(!e) return;
  const props=['name','natur','uk','color','mengeVal','hidden'];
  let h=`<div class="sheet-grip"></div><div class="sheet-title">🔍 Warum so?</div><div class="sheet-name">${esc(qeGet(e,cid,'name')!==undefined?qeGet(e,cid,'name'):e.anzeige_text)}</div>
    <p class="why-help">Je Eigenschaft von oben nach unten: die erste Zeile <b>gewinnt</b>, durchgestrichene werden überstimmt. Regeln lassen sich hier direkt zurücknehmen.</p>`;
  props.forEach(p=>{
    const rows=whyChain(e,cid,p);
    /* nur zeigen, wenn es außer der Quelldatei etwas gibt ODER die Quelle einen Wert hat */
    if(rows.length===1&&(rows[0].wert==null||rows[0].wert===''||(Array.isArray(rows[0].wert)&&!rows[0].wert.length))) return;
    h+=`<div class="why-prop">${esc(rulePropLabel(p))}</div>`;
    rows.forEach((row,i)=>{
      const val=ruleWertLabel(p,row.wert);
      const undo=row.rule?`<button class="why-undo" data-id="${esc(row.rule.id)}" onclick="revokeRule(this.dataset.id);openWhySheet();toast('Regel zurückgenommen')">↺</button>`:'';
      const meta=row.rule?`<span class="why-meta">${esc(ruleVonLabel(row.rule.von))} · ${esc(ruleDatum(row.rule.ts))}</span>`:'';
      h+=`<div class="why-row ${i===0?'win':'lose'}"><span class="why-src">${esc(row.src)}</span><span class="why-val">${esc(val)}</span>${meta}${undo}</div>`; });
  });
  h+=`<button class="sheet-close" onclick="renderSheetMain()">Zurück</button>`;
  $('sheet').innerHTML=h; showSheet(true); }
