/* ============ Formulare: Hinzufügen / Bearbeiten ============ */
const SIZE_TYPES=['french','laenge','durchmesser','volumen','dimension','naht','groesse_kuerzel','typcode','durchmesser+french'];
function closeForm(){ if(!formCtx) return; const b=formCtx.back; formCtx=null; if(b) b(); }
function natPickHTML(sel,onlyProc){ const items=onlyProc?natList().filter(n=>n.beschaffbar):natList(); return `<div class="natpick" id="fNatWrap" data-nat="${esc(sel)}">`+items.map(n=>`<button type="button" data-nat="${esc(n.key)}" style="color:${n.color}" class="${n.key===sel?'sel':''}" onclick="pickNat(this)">${esc(n.icon||'•')} ${esc(n.label)}</button>`).join('')+`</div>`; }
function pickNat(btn){ const p=btn.parentElement; p.querySelectorAll('button').forEach(b=>b.classList.remove('sel')); btn.classList.add('sel'); p.dataset.nat=btn.dataset.nat; }
function sizeTypOptionsHTML(sel){ return `<option value="">— keine Größe —</option>`+SIZE_TYPES.map(t=>`<option value="${esc(t)}" ${t===sel?'selected':''}>${esc(sizeLabel(t))}</option>`).join(''); }

/* Liest die effektiven (ggf. per Overlay bearbeiteten) Feldwerte eines
   Eintrags in ein Formular-Objekt. Bei Basis-Einträgen `cid` mitgeben. */
function entryToForm(e,cid){ const hasCid=(cid!==undefined&&cid!==null);
  const gv=hasCid?qeGet(e,cid,'groessen'):undefined; const groessen=(gv!==undefined?gv:e.groessen)||[]; const g=groessen[0]||null;
  const nv=hasCid?qeGet(e,cid,'name'):undefined; const name=(nv!==undefined?nv:e.anzeige_text)||'';
  const mvv=hasCid?qeGet(e,cid,'mengeVal'):undefined; const menge=(mvv!==undefined?mvv:e.menge)||'';
  const nat=hasCid?effNatur(e,cid):(e.natur||'material');
  const uk=hasCid?(canonUk(e,cid)||''):(e.unterkategorie||'');
  const spv=hasCid?qeGet(e,cid,'spez'):undefined; const spezRaw=(spv!==undefined)?spv:e.spezifikation;
  const spez=Array.isArray(spezRaw)?spezRaw.join(' | '):(spezRaw||'');
  const cv=hasCid?qeGet(e,cid,'color'):undefined; const color=(cv!==undefined&&cv!==null)?cv:(e.color||'');
  const wv=hasCid?qeGet(e,cid,'why'):undefined; const why=(wv!==undefined&&wv!==null)?wv:(e.why||'');
  const yv=hasCid?qeGet(e,cid,'synonyms'):undefined; const synRaw=(yv!==undefined&&yv!==null)?yv:e.synonyms;
  const synonyms=Array.isArray(synRaw)?synRaw.join(', '):(synRaw||'');
  return {name,menge,nat,sizeTyp:g?g.typ:'',sizeVal:g?g.wert:'',uk,spez,color,why,synonyms}; }

/* desc: {kind:'add',sid,ri,defaultNat} | {kind:'editAdd',sid,ri,aid} | {kind:'editBase',cid}
        | {kind:'catalog'} | {kind:'editCatalog',id}
   optional desc.back overschreibt den Rücksprung (Standard: zurück zur Rubrik). */
function openEntryForm(desc){
  const isCatalog=(desc.kind==='catalog'||desc.kind==='editCatalog');
  let cur={name:'',menge:'',nat:desc.defaultNat||'material',sizeTyp:'',sizeVal:'',uk:desc.defaultUk||'',spez:'',color:''}; let title='Eintrag hinzufügen';
  if(desc.kind==='editAdd'){ const e=findAddEntry(desc.sid,desc.ri,desc.aid); if(!e){ toast('Eintrag nicht gefunden',true); return; } cur=entryToForm(e); title='Eintrag bearbeiten'; }
  else if(desc.kind==='editBase'){ const e=findEntry(desc.cid); if(!e){ toast('Eintrag nicht gefunden',true); return; } cur=entryToForm(e,desc.cid); title='Eintrag bearbeiten'; }
  else if(desc.kind==='editCatalog'){ const it=findCatalogItem(desc.id); if(!it){ toast('Katalog-Eintrag nicht gefunden',true); return; } cur=catalogToForm(it); title='Katalog-Eintrag bearbeiten'; }
  else if(desc.kind==='catalog'){ title='Katalog-Eintrag hinzufügen'; }
  computeUkList(); const ukOpts=UK_LIST.map(u=>`<option value="${esc(u)}"></option>`).join('');
  /* Wissensfelder (nur für Einträge, nicht für Katalog-Positionen): „Warum"
     erklärt die Entscheidung/Hintergrund (aufklappbar am Eintrag), „Synonyme"
     verbessern die Auffindbarkeit in der globalen Suche. */
  const knowledge=isCatalog?'':`
    <div class="form-grp"><div class="flabel">Warum? (optional)</div><textarea class="loc-input" id="fWhy" rows="3" placeholder="Hintergrund/Begründung – z. B. „Wischdesinfektion mit Kompressen, weil bei Implantaten vorgeschrieben."">${esc(cur.why||'')}</textarea><p class="hint">Erscheint als aufklappbares 💡-Detail am Eintrag – gut für Einarbeitung & Nachvollziehbarkeit.</p></div>
    <div class="form-grp"><div class="flabel">Synonyme (optional)</div><input class="loc-input" id="fSyn" placeholder="z. B. Schleuse, Introducer, Sheath" value="${esc(cur.synonyms||'')}"><p class="hint">Komma-getrennt. Werden bei der globalen Suche mitgefunden.</p></div>`;
  const h=`<div class="pcard">
    <div class="form-grp"><div class="flabel">Bezeichnung</div><input class="loc-input" id="fName" placeholder="z. B. Radialschleuse" value="${esc(cur.name)}"></div>
    <div class="form-grp"><div class="flabel">Menge (optional)</div><input class="loc-input" id="fMenge" placeholder="z. B. 2x" value="${esc(cur.menge)}"></div>
    <div class="form-grp"><div class="flabel">Kategorie</div>${natPickHTML(cur.nat,isCatalog)}</div>
    <div class="form-grp"><div class="flabel">Größe (optional)</div><div class="form-row"><select class="form-sel" id="fSizeTyp">${sizeTypOptionsHTML(cur.sizeTyp)}</select><input class="loc-input" id="fSizeVal" placeholder="z. B. 6F" value="${esc(cur.sizeVal)}"></div></div>
    <div class="form-grp"><div class="flabel">Unterkategorie (optional)</div><input class="loc-input" id="fUk" list="fUkList" placeholder="z. B. Material auf Ansage" value="${esc(cur.uk)}"><datalist id="fUkList">${ukOpts}</datalist></div>
    <div class="form-grp"><div class="flabel">Spezifikation / Hinweis (optional)</div><input class="loc-input" id="fSpez" placeholder="z. B. femoral · für CS-Katheter" value="${esc(cur.spez||'')}"><p class="hint">Erscheint als farbige Markierung am Eintrag – z. B. „femoral" oder „für CS-Katheter".</p></div>
    ${knowledge}
    <div class="form-grp"><div class="flabel">Farbe (optional)</div>
      <div class="colorpick" id="fColorWrap" data-color="${esc(cur.color||'')}">
        <button type="button" class="cp-none ${!cur.color?'sel':''}" onclick="pickEntryColor(this,'')">ohne</button>
        ${UK_PALETTE.map(c=>`<button type="button" class="cp-sw ${cur.color===c?'sel':''}" style="background:${c}" onclick="pickEntryColor(this,'${c}')"></button>`).join('')}
        <input type="color" class="cp-inp" value="${esc(cur.color||'#3d9be0')}" oninput="pickEntryColor(this,this.value)">
      </div>
      <p class="hint">Färbt den ganzen Eintrag; die Textfarbe wird automatisch lesbar gewählt.</p></div>
    <div class="p-actions"><button class="btn btn-sec" onclick="closeForm()">Abbrechen</button><button class="btn btn-pri" onclick="saveEntryForm()">Speichern</button></div>
  </div>`;
  const crumb=isCatalog?'Katalog':(curStd?curStd.titel:'');
  formCtx={desc, back: desc.back||(()=>reRenderDetail())};
  $('scr-form').innerHTML=h; show('scr-form'); setBar(title, crumb, true); }
/* Öffnet das Formular für einen Katalog-Eintrag (neu oder bearbeiten). */
function openCatalogForm(id){ const back=()=>{ renderCatalog(); show('scr-catalog'); updateBar(); }; openEntryForm(id?{kind:'editCatalog',id,back}:{kind:'catalog',back}); }

function pickEntryColor(el,val){ const w=$('fColorWrap'); if(!w) return; w.dataset.color=val||'';
  w.querySelectorAll('.cp-sw,.cp-none').forEach(b=>b.classList.remove('sel'));
  if(el&&el.classList&&(el.classList.contains('cp-sw')||el.classList.contains('cp-none'))) el.classList.add('sel'); }
function readEntryForm(){ return { name:$('fName').value, menge:$('fMenge').value, nat:($('fNatWrap').dataset.nat||'material'), sizeTyp:$('fSizeTyp').value, sizeVal:$('fSizeVal').value, uk:$('fUk').value, spez:$('fSpez').value, color:($('fColorWrap').dataset.color||''),
  why:($('fWhy')?$('fWhy').value:''), synonyms:($('fSyn')?$('fSyn').value:'') }; }
function saveEntryForm(){ const f=readEntryForm(); if(!f.name.trim()){ toast('Bitte eine Bezeichnung eingeben',true); return; }
  const d=formCtx&&formCtx.desc; if(!d) return;
  if(d.kind==='add'){ const key=d.sid+'|'+d.ri; const arr=ADDITIONS.entries[key]||(ADDITIONS.entries[key]=[]); arr.push(makeAddEntry(Object.assign({},f,{aid:newAid()}))); saveAdditions(); rebuildDB(); buildMaterialIndex(); toast('Eintrag hinzugefügt'); }
  else if(d.kind==='editAdd'){ const e=findAddEntry(d.sid,d.ri,d.aid); if(e){ Object.assign(e,makeAddEntry(Object.assign({},f,{aid:d.aid}))); saveAdditions(); rebuildDB(); buildMaterialIndex(); toast('Gespeichert'); } }
  else if(d.kind==='editBase'){
    /* Reichweiten-Nachfrage (Betreiber-Wunsch: IMMER gefragt werden): bei
       Material-/Geräte-Einträgen (geteiltes material_key) fragen, ob die
       Änderung nur hier, im Standard, in der Eingriffsgruppe oder überall
       gelten soll. Ohne material_key (eigene Einträge, Hinweise) gibt es kein
       geteiltes Ziel → wie bisher nur an dieser Stelle. */
    const e=findEntry(d.cid); const changes=entryFormChanges(d.cid,f);
    if(e&&e.material_key&&changes.length){ editScopePending={cid:d.cid,changes}; renderEditScopeSheet(d.cid); showSheet(true); return; }
    applyBaseEntryEdit(d.cid,f); toast(changes.length?'Gespeichert':'Keine Änderung'); }
  else if(d.kind==='catalog'){ CATALOG.items=upsertCatalogItem(CATALOG.items,makeCatalogItem(Object.assign({},f,{id:newAid()}))); saveCatalog(); toast('Zum Katalog hinzugefügt'); }
  else if(d.kind==='editCatalog'){ CATALOG.items=upsertCatalogItem(CATALOG.items,makeCatalogItem(Object.assign({},f,{id:d.id}))); saveCatalog(); toast('Gespeichert'); }
  closeForm(); }

/* Schreibt Formularwerte als Overlay auf einen Basis-Eintrag (nur an dieser Stelle). */
function applyBaseEntryEdit(cid,f){ const e=findEntry(cid); if(!e) return;
  qeSet('cid',e,cid,'name',f.name.trim());
  const menge=f.menge.trim(); qeSet('cid',e,cid,'mengeVal',menge||null);
  const val=f.sizeVal.trim(); qeSet('cid',e,cid,'groessen', val?[{typ:f.sizeTyp||'dimension',wert:val,roh:val}]:[]);
  const spez=(f.spez||'').trim(); qeSet('cid',e,cid,'spez', spez||null);
  const color=(f.color||'').trim(); qeSet('cid',e,cid,'color', color||null);
  const why=(f.why||'').trim(); qeSet('cid',e,cid,'why', why||null);
  const syn=parseSyn(f.synonyms); qeSet('cid',e,cid,'synonyms', syn.length?syn:null);
  if(f.nat===e.natur){ if(overrides[cid]){ delete overrides[cid]; saveJSON('hkl_overrides',overrides); } } else { overrides[cid]=f.nat; saveJSON('hkl_overrides',overrides); }
  const uk=f.uk.trim(); reassign[cid]=(uk||null); saveJSON('hkl_reassign',reassign);
  saveQE(); buildMaterialIndex(); computeUkList(); }

/* Ermittelt, welche Eigenschaften das Formular gegenüber dem aktuellen
   (effektiven) Stand ändert – Grundlage für die Reichweiten-Anwendung. Nur
   geänderte Felder werden zu Regeln, damit das Journal nicht mit
   Nicht-Änderungen zuläuft. */
function entryFormChanges(cid,f){ const e=findEntry(cid); if(!e) return []; const cur=entryToForm(e,cid); const ch=[];
  const nName=(f.name||'').trim(); if(nName!==(cur.name||'')) ch.push({prop:'name',value:nName});
  const nMenge=(f.menge||'').trim()||null; if((nMenge||'')!==(cur.menge||'')) ch.push({prop:'mengeVal',value:nMenge});
  const nSizeVal=(f.sizeVal||'').trim(); const nGro=nSizeVal?[{typ:f.sizeTyp||'dimension',wert:nSizeVal,roh:nSizeVal}]:[];
  const curGroStr=cur.sizeVal?((cur.sizeTyp||'dimension')+'|'+cur.sizeVal):''; const nGroStr=nSizeVal?((f.sizeTyp||'dimension')+'|'+nSizeVal):'';
  if(nGroStr!==curGroStr) ch.push({prop:'groessen',value:nGro});
  const nSpez=(f.spez||'').trim()||null; if((nSpez||'')!==(cur.spez||'')) ch.push({prop:'spez',value:nSpez});
  const nColor=(f.color||'').trim()||null; if((nColor||'')!==(cur.color||'')) ch.push({prop:'color',value:nColor});
  const nNat=f.nat||'material'; if(nNat!==cur.nat) ch.push({prop:'natur',value:nNat});
  const nUk=(f.uk||'').trim(); if(nUk!==(cur.uk||'')) ch.push({prop:'uk',value:nUk});
  const nWhy=(f.why||'').trim()||null; if((nWhy||'')!==(cur.why||'')) ch.push({prop:'why',value:nWhy});
  const nSyn=parseSyn(f.synonyms); const curSyn=cur.synonyms?parseSyn(cur.synonyms):[]; if(JSON.stringify(nSyn)!==JSON.stringify(curSyn)) ch.push({prop:'synonyms',value:(nSyn.length?nSyn:null)});
  return ch; }
/* Reichweiten-Sheet fürs Bearbeiten-Formular: vier Stufen mit Treffervorschau
   (📍 nur hier · 📄 Standard · 🗂 Eingriffsgruppe · 🌐 überall). Dieselbe
   Governance-Treppe wie im Schnellmenü (askScope), nur für mehrere geänderte
   Eigenschaften auf einmal. */
function renderEditScopeSheet(cid){ const e=findEntry(cid); if(!e){ showSheet(false); return; }
  const sid=cidStd(cid); const grp=sid?stdGruppeById(sid):null;
  const hs=sid?ruleHits(e.material_key,{art:'standard',wert:sid}):null;
  const hg=grp?ruleHits(e.material_key,{art:'gruppe',wert:grp}):null;
  const ha=ruleHits(e.material_key,{art:'alle'});
  const props=((editScopePending&&editScopePending.changes)||[]).map(c=>rulePropLabel(c.prop)).join(', ');
  let h=`<div class="sheet-grip"></div><div class="sheet-title">Wo soll die Änderung gelten?</div>`;
  h+=`<div class="sheet-chips"><span class="schip">✎ ${esc(props||'Änderung')}</span><span class="schip">👥 gilt auf allen Geräten</span></div><div class="sheet-pick">`;
  h+=`<button class="sheet-pick-btn" onclick="applyEditScope('cid')">📍 Nur hier <span class="ps-sub">· nur an dieser Stelle</span></button>`;
  if(sid&&hs) h+=`<button class="sheet-pick-btn" onclick="applyEditScope('std')">📄 In diesem Standard <span class="ps-sub">· betrifft ${hs.vorkommen}× hier</span></button>`;
  if(grp&&hg) h+=`<button class="sheet-pick-btn" onclick="applyEditScope('grp')">🗂 In der Gruppe „${esc(grp)}" <span class="ps-sub">· betrifft ${hg.vorkommen}× in ${hg.standards.length} Standards</span></button>`;
  h+=`<button class="sheet-pick-btn" onclick="applyEditScope('mat')">🌐 Überall <span class="ps-sub">· betrifft ${ha.vorkommen}× in ${ha.standards.length} Standards</span></button>`;
  h+=`</div><button class="sheet-close" onclick="showSheet(false)">Abbrechen</button>`;
  $('sheet').innerHTML=h; }
/* Wendet alle geänderten Eigenschaften als Regeln in der gewählten Reichweite
   an (EIN Schreibweg, journaliert, rücknehmbar). Weite Reichweiten (Gruppe/
   überall) werden mit Trefferzahl bestätigt. */
function applyEditScope(scope){ const p=editScopePending; if(!p){ showSheet(false); return; }
  const e=findEntry(p.cid); if(!e||!e.material_key){ showSheet(false); return; }
  const sid=cidStd(p.cid); const grp=sid?stdGruppeById(sid):null; let wo;
  if(scope==='cid') wo={art:'stelle',wert:p.cid};
  else if(scope==='std'){ if(!sid){ toast('Standard nicht bestimmbar',true); return; } wo={art:'standard',wert:sid}; }
  else if(scope==='grp'){ if(!grp){ toast('Gruppe nicht bestimmbar',true); return; } wo={art:'gruppe',wert:grp}; }
  else wo={art:'alle'};
  if(scope==='grp'||scope==='mat'){ const hits=ruleHits(e.material_key,wo); const ziel=(scope==='grp')?('die Gruppe „'+grp+'"'):'ALLE Standards';
    if(!confirm('Änderung für '+ziel+' anwenden?\n\nBetrifft '+hits.vorkommen+' Vorkommen in '+hits.standards.length+' Standard(s).\nRückgängig jederzeit: Verwaltung → 🧾 Regeln & Journal.')) return; }
  p.changes.forEach(c=>{ addRule({art:'material',key:e.material_key}, wo, c.prop, c.value); });
  if(wo.art==='stelle') p.changes.forEach(c=>clearLegacyAt(e,p.cid,'stelle',c.prop));
  else if(wo.art==='alle') p.changes.forEach(c=>clearLegacyAt(e,p.cid,'alle',c.prop));
  buildMaterialIndex(); computeUkList(); editScopePending=null; showSheet(false);
  const b=formCtx&&formCtx.back; formCtx=null;
  toast(scope==='cid'?'Gespeichert':'Sammel-Änderung übernommen — rücknehmbar unter 🧾 Regeln & Journal');
  if(b) b(); else reRenderDetail(); }

function deleteAddEntry(sid,ri,aid){ const key=sid+'|'+ri; const arr=ADDITIONS.entries[key]; if(!arr) return; ADDITIONS.entries[key]=arr.filter(x=>x._aid!==aid); if(!ADDITIONS.entries[key].length) delete ADDITIONS.entries[key]; saveAdditions(); rebuildDB(); buildMaterialIndex(); }

/* ---- Eigene Standards ---- */
function openStandardForm(id){ const s=id?ADDITIONS.standards.find(x=>x.id===id):null; const title=s?'Standard bearbeiten':'Neuer Standard';
  const h=`<div class="pcard">
    <div class="form-grp"><div class="flabel">Titel</div><input class="loc-input" id="sTitel" placeholder="z. B. Koronarangiografie" value="${esc(s?s.titel:'')}"></div>
    <div class="form-grp"><div class="flabel">Gruppe</div><input class="loc-input" id="sGruppe" list="grpList" placeholder="z. B. HKL — vorhandene wählen oder neue tippen" value="${esc(s?s.gruppe:'Eigene')}">
    <datalist id="grpList">${distinctGroups().map(g=>`<option value="${esc(g)}">`).join('')}</datalist></div>
    <p class="hint">Ein neuer Standard erhält die Rubriken „Saal und Geräte", „Material" und „Ablauf". Einträge fügst du danach in der jeweiligen Rubrik über „＋ Eintrag hinzufügen" hinzu.</p>
    <div class="p-actions"><button class="btn btn-sec" onclick="closeForm()">Abbrechen</button><button class="btn btn-pri" onclick="saveStandardForm(${s?`'${esc(s.id)}'`:'null'})">Speichern</button></div>
  </div>`;
  const back=(mode==='admin')?(()=>{ renderAdmin(); show('scr-admin'); updateBar(); }):(()=>{ setMode('use'); renderStandards($('searchInput')?$('searchInput').value:''); show('scr-standards'); updateBar(); });
  formCtx={desc:{kind:'std'}, back};
  $('scr-form').innerHTML=h; show('scr-form'); setBar(title,mode==='admin'?'Verwaltung':'Neuer Standard',true); }
function saveStandardForm(id){ const titel=$('sTitel').value.trim(); const gruppe=$('sGruppe').value.trim(); if(!titel){ toast('Bitte einen Titel eingeben',true); return; }
  if(id){ updateStandard(id,titel,gruppe); toast('Gespeichert'); } else { addStandard(titel,gruppe); toast('Standard angelegt'); } closeForm(); }

/* ---- Rubrik-Vorlagen (Name, Typ, Geltungsbereich) ---- */
function openRubrikForm(id){ const t=id?RUBTPL.find(x=>x.id===id):null;
  const curName=t?t.name:''; const curTyp=t?t.typ:'sonstige'; const curScope=t?t.scope:'std'; const curGroups=(t&&t.groups)||[];
  const grps=distinctGroups();
  const typOpt=(v,l)=>`<option value="${v}" ${curTyp===v?'selected':''}>${l}</option>`;
  const scopeBtn=(v,l,sub)=>`<button type="button" class="scope-btn ${curScope===v?'sel':''}" data-scope="${v}" onclick="pickRubScope(this)"><b>${esc(l)}</b><span class="scope-sub">${esc(sub)}</span></button>`;
  const grpChecks=grps.length?grps.map(g=>`<label class="grpchk"><input type="checkbox" value="${esc(g)}" ${curGroups.indexOf(g)>=0?'checked':''}><span>${esc(g)}</span></label>`).join(''):'<p class="hint">Noch keine Gruppen vorhanden.</p>';
  const h=`<div class="pcard">
    <div class="form-grp"><div class="flabel">Name der Rubrik</div><input class="loc-input" id="rName" placeholder="z. B. Notfallmaterial" value="${esc(curName)}"></div>
    <div class="form-grp"><div class="flabel">Typ</div><select class="form-sel" id="rTyp" style="width:100%">${typOpt('material','Material')}${typOpt('geraete','Geräte')}${typOpt('sonstige','Ablauf / Sonstige')}</select></div>
    <div class="form-grp"><div class="flabel">Wo soll die Rubrik erscheinen?</div>
      <div class="scope-pick" id="rScope" data-scope="${curScope}">
        ${scopeBtn('std','Nur dieser Standard',curStd?curStd.titel:'einzeln')}
        ${scopeBtn('groups','Bestimmte Gruppen','Mehrfachauswahl')}
        ${scopeBtn('all','Alle Eingriffe','jeder Standard')}
      </div>
      <div class="grp-checks" id="rGroups" style="${curScope==='groups'?'':'display:none'}">${grpChecks}</div>
      <p class="hint">„Bestimmte Gruppen" oder „Alle Eingriffe" lassen die Rubrik automatisch in jedem passenden Standard erscheinen – dort wird sie einzeln befüllt. Später zentral steuerbar unter „Rubriken-Vorlagen".</p>
    </div>
    <div class="p-actions"><button class="btn btn-sec" onclick="closeForm()">Abbrechen</button><button class="btn btn-pri" onclick="saveRubrikForm(${t?`'${esc(t.id)}'`:'null'})">Speichern</button></div>
  </div>`;
  const back=(mode==='admin')?(()=>{ renderAdmin(); show('scr-admin'); updateBar(); }):(()=>{ if(curStd){ openStandard(curStd.id,true); } else { setMode('use'); } });
  formCtx={desc:{kind:'rubtpl'}, back};
  $('scr-form').innerHTML=h; show('scr-form'); setBar(t?'Rubrik bearbeiten':'Neue Rubrik', mode==='admin'?'Verwaltung':(curStd?curStd.titel:''), true); }
function pickRubScope(btn){ const p=btn.parentElement; p.querySelectorAll('.scope-btn').forEach(b=>b.classList.remove('sel')); btn.classList.add('sel'); p.dataset.scope=btn.dataset.scope;
  const g=$('rGroups'); if(g) g.style.display=(btn.dataset.scope==='groups')?'':'none'; }
function readRubrikForm(){ const scope=($('rScope').dataset.scope)||'std'; const groups=[...document.querySelectorAll('#rGroups input:checked')].map(x=>x.value);
  return { name:$('rName').value, typ:$('rTyp').value, scope, groups }; }
function saveRubrikForm(id){ const f=readRubrikForm(); if(!f.name.trim()){ toast('Bitte einen Namen eingeben',true); return; }
  if(f.scope==='groups' && !f.groups.length){ toast('Bitte mindestens eine Gruppe wählen',true); return; }
  saveRubrikTpl(Object.assign({},f,{id:(id||undefined), std:(curStd&&curStd.id)}));
  toast(id?'Rubrik gespeichert':'Rubrik angelegt'); const b=formCtx&&formCtx.back; formCtx=null; if(b) b(); }
/* ---- Version & Freigabe eines Standards (nur Verwaltung sichtbar) ---- */
function openStdMetaForm(){ if(!ADMIN||!curStd) return; const s=curStd; const m=STDE[s.id]||{};
  const statuses=['Entwurf','In Prüfung','Freigegeben','Veraltet'];
  const opts=statuses.map(x=>`<option value="${esc(x)}" ${m.status===x?'selected':''}>${esc(x)}</option>`).join('');
  const html=`<div class="pcard">
    <div class="form-grp"><div class="flabel">Version</div><input class="loc-input" id="mVer" placeholder="z. B. 1.2" value="${esc(m.version||'')}"></div>
    <div class="form-grp"><div class="flabel">Status / Freigabe</div><select class="form-sel" id="mStatus" style="width:100%"><option value="">— kein —</option>${opts}</select></div>
    <div class="form-grp"><div class="flabel">Gültig ab (optional)</div><input class="loc-input" id="mFrom" type="date" value="${esc(m.validFrom||'')}"></div>
    <div class="form-grp"><div class="flabel">Gültig bis (optional)</div><input class="loc-input" id="mTo" type="date" value="${esc(m.validTo||'')}"></div>
    <p class="hint">Nur im Verwaltungsmodus sichtbar. Version & Freigabe erscheinen auch im PDF-Kopf, wenn gesetzt.</p>
    <div class="p-actions"><button class="btn btn-sec" onclick="closeForm()">Abbrechen</button><button class="btn btn-pri" onclick="saveStdMeta()">Speichern</button></div>
  </div>`;
  formCtx={desc:{kind:'stdmeta'}, back:()=>openStandard(s.id,true)};
  $('scr-form').innerHTML=html; show('scr-form'); setBar('Version & Freigabe',stdTitel(s),true); }
function saveStdMeta(){ if(!ADMIN||!curStd) return; const s=curStd;
  const upd={ version:($('mVer').value||'').trim(), status:($('mStatus').value||'').trim(), validFrom:($('mFrom').value||'').trim(), validTo:($('mTo').value||'').trim() };
  ['version','status','validFrom','validTo'].forEach(k=>{ if(!upd[k]) delete upd[k]; });
  upd.approvedBy=(typeof voterName==='function'?voterName():'Verwaltung'); upd.approvedAt=today();
  STDE[s.id]=Object.assign({},STDE[s.id],upd); saveSTDE(); const b=formCtx&&formCtx.back; formCtx=null; toast('Version & Freigabe gespeichert'); if(b) b(); }
function addStandard(titel,gruppe){ const taken={}; (DB?DB.standards:[]).forEach(s=>taken[s.id]=1); ADDITIONS.standards.forEach(s=>taken[s.id]=1); const id=addSlug(titel,taken);
  ADDITIONS.standards.push({ id, titel:titel.trim(), gruppe:(gruppe||'').trim()||'Eigene', dateiname:'(manuell angelegt)', _added:true, rubriken:[
    {name:'Saal und Geräte', typ:'geraete', sub_bereiche:[]}, {name:'Material', typ:'material', sub_bereiche:[]}, {name:'Ablauf', typ:'ablauf', sub_bereiche:[]} ] });
  saveAdditions(); rebuildDB(); buildMaterialIndex(); return id; }
function updateStandard(id,titel,gruppe){ const s=ADDITIONS.standards.find(x=>x.id===id); if(!s) return; if(titel&&titel.trim())s.titel=titel.trim(); if(gruppe&&gruppe.trim())s.gruppe=gruppe.trim(); saveAdditions(); rebuildDB(); }
function deleteStandard(id){ ADDITIONS.standards=ADDITIONS.standards.filter(x=>x.id!==id); Object.keys(ADDITIONS.entries).forEach(k=>{ if(k.split('|')[0]===id) delete ADDITIONS.entries[k]; }); saveAdditions(); rebuildDB(); buildMaterialIndex(); }
function confirmDeleteStandard(id){ const s=ADDITIONS.standards.find(x=>x.id===id); if(!s) return; if(!confirm('Standard „'+s.titel+'" mitsamt eigenen Einträgen löschen? Das kann nicht rückgängig gemacht werden.')) return; deleteStandard(id); if(curStd&&curStd.id===id) curStd=null; renderAdmin(); toast('Standard gelöscht'); }
function openStandardById(id){ setMode('use'); openStandard(id); }

