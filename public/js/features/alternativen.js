/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — ALTERNATIVEN

   Zwei Wünsche, die gleich klingen und es nicht sind:

   ① „Beim LAA gibt es eine Merit-Medical-Schleuse, die soll standardmäßig
      genutzt werden. Wenn die nicht da ist oder es ein schwerer Fall ist,
      gibt es auch eine Schwartz SL1 von Abbott."
      → Das ist eine Beziehung zwischen MATERIALIEN. Sie gehört ans Material
        und muss an jeder Zeile sichtbar sein, an der eines davon steht.

   ② „Wenn wir eine AVNRT machen, gibt es die alternative Therapievariante,
      dass wir statt mit RF mit Kryo arbeiten."
      → Das ist ein ZWEIG IM VERFAHREN. Nicht ein Material ersetzt ein
        anderes, sondern ein ganzer Abschnitt tritt an die Stelle eines
        anderen — mit eigenem Material und eigenem Ablauf.

   Beides in einen Mechanismus zu pressen wäre der klassische Fehler. Deshalb
   zwei Bauformen in einer Datei — sie gehören fachlich zusammen, technisch
   nicht.

   ── ① Austauschgruppen ──
   Eine Gruppe ist eine geordnete Liste von Materialien: Rang 1 ist der
   Standard, Rang 2+ sind die Alternativen, jede mit ihrem Grund („wenn nicht
   vorhanden", „bei schwierigem Fall"). Eine Gruppe statt gerichteter Paare,
   weil es sonst bei drei Produkten sechs Beziehungen wären — und weil die
   Frage „was nehme ich stattdessen" immer die ganze Gruppe meint.

   Angezeigt wird sie an JEDEM Glied. Wer auf der Schwartz-Zeile steht, sieht
   auch, dass die Merit der Standard ist. Eine Kategorie wäre hier falsch: Sie
   wäre eine Schublade, in die im Saal niemand schaut.

   ── ② Verfahrenszweige ──
   Ein Zweig hängt an einem ABSCHNITT (Unterkategorie oder Überschrift). Oben
   in der Rubrik steht ein Umschalter; die Abschnitte der nicht gewählten
   Zweige verschwinden. Die Wahl ist gerätelokal — sie gilt für den Fall, der
   heute läuft, nicht für den Standard.

   Wichtig: Ohne Wahl sind ALLE Zweige sichtbar. „Leer schlägt falsch" — wer
   nichts entschieden hat, soll alles sehen und nicht versehentlich die Hälfte
   des Standards verlieren.
   ───────────────────────────────────────────────────────────── */

/* ═══════════ 1. Austauschgruppen (Material) ═══════════ */

let ALTG = (typeof loadJSON==='function') ? loadJSON('hkl_altgruppen', []) : [];
if(!Array.isArray(ALTG)) ALTG = [];
function saveAltG(){ if(typeof saveJSON==='function') saveJSON('hkl_altgruppen', ALTG); }

function altNeueId(){ return 'g'+Date.now().toString(36)+Math.random().toString(36).slice(2,5); }

/* Der Materialschlüssel einer Zeile — kanonisch, wenn die Zerlegung ihn
   kennt, sonst der alte. Damit greift die Gruppe auch über verschiedene
   Schreibweisen desselben Produkts hinweg. */
function altKey(e, cid){
  if(!e) return null;
  if(typeof effMatKey==='function'){ const k=effMatKey(e,cid); if(k) return k; }
  return e.material_key || null;
}

function altGruppeOf(id){ return ALTG.find(g=>g.id===id) || null; }
/* Alle Gruppen, in denen dieses Material vorkommt. Mehr als eine ist erlaubt:
   Ein Führungsdraht kann in einer Gruppe „Standarddraht" und in einer anderen
   „Notfall" stehen. */
function altGruppenFuer(key){
  if(!key) return [];
  return ALTG.filter(g=>(g.glieder||[]).some(x=>x.key===key));
}
function altAnlegen(wort, ersterKey, ersterName){
  const g = { id:altNeueId(), wort:String(wort||'').trim()||'Austauschgruppe',
    glieder: ersterKey ? [{ key:ersterKey, name:ersterName||ersterKey, hinweis:'' }] : [] };
  ALTG.push(g); saveAltG(); return g;
}
function altGliedHinzu(id, key, name, hinweis){
  const g = altGruppeOf(id); if(!g || !key) return false;
  if((g.glieder||[]).some(x=>x.key===key)) return false;
  (g.glieder=g.glieder||[]).push({ key, name:name||key, hinweis:hinweis||'' });
  saveAltG(); return true;
}
function altGliedWeg(id, key){
  const g = altGruppeOf(id); if(!g) return false;
  g.glieder = (g.glieder||[]).filter(x=>x.key!==key);
  /* Eine Gruppe mit einem einzigen Glied ist keine Gruppe mehr — sie
     verschwindet, statt als Rest herumzuliegen. */
  if(g.glieder.length < 2) ALTG = ALTG.filter(x=>x.id!==id);
  saveAltG(); return true;
}
function altGliedHinweis(id, key, hinweis){
  const g = altGruppeOf(id); if(!g) return false;
  const x = (g.glieder||[]).find(y=>y.key===key); if(!x) return false;
  x.hinweis = String(hinweis||'').trim(); saveAltG(); return true;
}
function altGliedVerschieben(id, key, richtung){
  const g = altGruppeOf(id); if(!g) return false;
  const l = g.glieder||[]; const i = l.findIndex(x=>x.key===key); const j = i+(richtung<0?-1:1);
  if(i<0 || j<0 || j>=l.length) return false;
  const t=l[i]; l[i]=l[j]; l[j]=t; saveAltG(); return true;
}
function altGruppeLoeschen(id){ ALTG = ALTG.filter(g=>g.id!==id); saveAltG(); }

/* Was steht an dieser Zeile als Alternative zur Verfügung?
   Liefert [{gruppe, ich, andere:[…]}] — `ich` ist mein Glied (für den Rang),
   `andere` sind die übrigen. */
function altFuerZeile(e, cid){
  const key = altKey(e, cid); if(!key) return [];
  return altGruppenFuer(key).map(g=>{
    const glieder = g.glieder||[];
    const i = glieder.findIndex(x=>x.key===key);
    return { gruppe:g, ich:glieder[i], rang:i, andere:glieder.filter((x,n)=>n!==i) };
  });
}
/* Der Badge an der Zeile. Am Standard (Rang 0) steht „oder …", an einer
   Alternative steht, wovon sie die Alternative ist — beides muss man im Saal
   sofort lesen können. */
function altBadgeHTML(e, cid){
  const treffer = altFuerZeile(e, cid);
  if(!treffer.length) return '';
  return treffer.map(t=>{
    const erste = t.andere[0];
    if(!erste) return '';
    const wort = (t.rang===0)
      ? ('oder '+erste.name + (t.andere.length>1 ? (' +'+(t.andere.length-1)) : ''))
      : ('Alternative zu '+t.gruppe.glieder[0].name);
    return `<button type="button" class="tag tag-alt alt-chip" data-g="${esc(t.gruppe.id)}" onclick="event.stopPropagation();altSheet(this.dataset.g)">⇄ ${esc(wort)}</button>`;
  }).join('');
}

/* Die Gruppe ansehen: alle Glieder mit Rang und Grund. */
function altSheet(id){
  const g = altGruppeOf(id); if(!g) return;
  let h = `<div class="sheet-grip"></div><div class="sheet-title">⇄ ${esc(g.wort)}</div>`;
  h += `<p class="why-help">Diese Materialien sind gegeneinander austauschbar. Das <b>erste</b> ist der Standard, die übrigen sind Alternativen mit ihrem Grund.</p>`;
  h += `<div class="alt-liste">`;
  (g.glieder||[]).forEach((x,i)=>{
    h += `<div class="alt-zeile">
      <span class="alt-rang">${i===0?'Standard':'Alternative'}</span>
      <span class="alt-name">${esc(x.name)}</span>
      ${x.hinweis?`<span class="alt-hinweis">${esc(x.hinweis)}</span>`:''}
      <button type="button" class="alt-oeffnen" data-k="${esc(x.key)}" onclick="altOeffnen(this.dataset.k)">Material öffnen</button>
    </div>`;
  });
  h += `</div>`;
  if(typeof ADMIN!=='undefined' && ADMIN){
    h += `<button class="sheet-pick-btn" data-g="${esc(g.id)}" onclick="altBearbeiten(this.dataset.g)">✎ Gruppe bearbeiten</button>`;
  }
  h += `<button class="sheet-close" onclick="showSheet(false)">Schließen</button>`;
  $('sheet').innerHTML = h;
  if(typeof showSheet==='function') showSheet(true);
}
function altOeffnen(key){
  if(typeof showSheet==='function') showSheet(false);
  if(typeof openMaterial==='function') openMaterial(key);
  else if(typeof toast==='function') toast('Materialansicht nicht verfügbar',true);
}

/* Aus einer Zeile heraus eine Alternative pflegen. */
function renderSheetAlternative(){
  const e = sheetEntry, cid = sheetCid; if(!e) return;
  const key = altKey(e, cid);
  const name = (typeof qeGet==='function' && qeGet(e,cid,'name')!==undefined) ? qeGet(e,cid,'name') : (e.anzeige_text||'');
  let h = `<div class="sheet-grip"></div><div class="sheet-title">⇄ Alternativen</div><div class="sheet-name">${esc(name)}</div>`;
  if(!key){
    h += `<p class="hint" style="padding:0 4px">Diese Zeile trägt kein Material — Alternativen gibt es nur zwischen Materialien.</p>`;
    h += `<button class="sheet-close" onclick="renderSheetMain()">Zurück</button>`;
    $('sheet').innerHTML = h; return;
  }
  const treffer = altFuerZeile(e, cid);
  if(treffer.length){
    treffer.forEach(t=>{
      h += `<div class="alt-karte"><div class="alt-kopf">${esc(t.gruppe.wort)}</div>`;
      (t.gruppe.glieder||[]).forEach((x,i)=>{
        const ich = x.key===key;
        h += `<div class="alt-zeile${ich?' ich':''}">
          <span class="alt-rang">${i===0?'Standard':'Alternative'}</span>
          <span class="alt-name">${esc(x.name)}${ich?' · diese Zeile':''}</span>
          <input class="loc-input alt-grund" value="${esc(x.hinweis||'')}" placeholder="Grund, z. B. wenn nicht vorhanden"
            data-g="${esc(t.gruppe.id)}" data-k="${esc(x.key)}" onchange="altUiHinweis(this.dataset.g,this.dataset.k,this.value)">
          <div class="alt-akt">
            <button data-g="${esc(t.gruppe.id)}" data-k="${esc(x.key)}" onclick="altUiVerschieben(this.dataset.g,this.dataset.k,-1)" aria-label="nach oben">⬆</button>
            <button class="dgr" data-g="${esc(t.gruppe.id)}" data-k="${esc(x.key)}" onclick="altUiWeg(this.dataset.g,this.dataset.k)">Entfernen</button>
          </div></div>`;
      });
      h += `<button class="sheet-pick-btn" data-g="${esc(t.gruppe.id)}" onclick="altUiWaehlen(this.dataset.g)">＋ Material zu dieser Gruppe</button>`;
      h += `</div>`;
    });
  } else {
    h += `<p class="why-help">Noch keine Alternative hinterlegt. Eine Austauschgruppe sagt: „Statt <b>${esc(name)}</b> geht auch …" — und sie ist danach an jeder Zeile beider Materialien sichtbar.</p>`;
    h += `<button class="sheet-pick-btn" onclick="altUiNeu()">＋ Austauschgruppe anlegen</button>`;
  }
  h += `<button class="sheet-close" onclick="renderSheetMain()">Zurück</button>`;
  $('sheet').innerHTML = h;
}
function altUiNeu(){
  const e = sheetEntry, cid = sheetCid; if(!e) return;
  const key = altKey(e, cid); if(!key) return;
  const name = (typeof qeGet==='function' && qeGet(e,cid,'name')!==undefined) ? qeGet(e,cid,'name') : (e.anzeige_text||'');
  const g = altAnlegen('Statt '+name, key, name);
  altUiWaehlen(g.id);
}
/* Zweites Material wählen — aus dem vorhandenen Materialbestand, damit keine
   Zeichenkette getippt werden muss, die nirgends existiert. */
function altUiWaehlen(gid, suche){
  const g = altGruppeOf(gid); if(!g) return;
  const q = String(suche||'').trim().toLowerCase();
  const drin = new Set((g.glieder||[]).map(x=>x.key));
  const kandidaten = altMaterialListe().filter(m=>!drin.has(m.key) && (!q || m.name.toLowerCase().indexOf(q)>=0)).slice(0,40);
  let h = `<div class="sheet-grip"></div><div class="sheet-title">Material zu „${esc(g.wort)}"</div>
    <input type="text" class="txtinp" style="width:100%" placeholder="Material suchen …" value="${esc(suche||'')}"
      data-g="${esc(gid)}" oninput="altUiWaehlen(this.dataset.g,this.value)">
    <div class="sheet-pick" style="margin-top:8px">`;
  if(!kandidaten.length) h += `<p class="hint">Kein passendes Material gefunden.</p>`;
  kandidaten.forEach(m=>{
    h += `<button class="sheet-pick-btn" data-g="${esc(gid)}" data-k="${esc(m.key)}" data-n="${esc(m.name)}" onclick="altUiHinzu(this.dataset.g,this.dataset.k,this.dataset.n)">${esc(m.name)}<span class="ps-sub">${esc(m.wo||'')}</span></button>`;
  });
  h += `</div><button class="sheet-close" onclick="renderSheetAlternative()">Zurück</button>`;
  $('sheet').innerHTML = h;
  const inp = $('sheet').querySelector('.txtinp'); if(inp && suche!==undefined){ try{ inp.focus(); inp.setSelectionRange(inp.value.length,inp.value.length); }catch(e){} }
}
/* Der Materialbestand: je kanonischem Schlüssel EIN Eintrag, mit dem Namen,
   der am häufigsten dafür steht. */
let _altMatCache = null;
function altMaterialCacheLeeren(){ _altMatCache = null; }
function altMaterialListe(){
  if(_altMatCache) return _altMatCache;
  const map = new Map();
  if(typeof DB!=='undefined' && DB && DB.standards && typeof cidOf==='function'){
    DB.standards.forEach(s=>(s.rubriken||[]).forEach((r,ri)=>(r.sub_bereiche||[]).forEach((sb,si)=>(sb.eintraege||[]).forEach((e,ei)=>{
      if(!e || e.natur==='ueberschrift' || e.ist_fliesstext) return;
      const cid = cidOf(s.id,ri,si,ei);
      const k = altKey(e, cid); if(!k) return;
      const nm = (typeof qeGet==='function' && qeGet(e,cid,'name')!==undefined) ? qeGet(e,cid,'name') : (e.anzeige_text||k);
      const t = map.get(k) || { key:k, name:nm, n:0, stds:new Set() };
      t.n++; t.stds.add(s.id);
      map.set(k, t);
    }))));
  }
  _altMatCache = [...map.values()]
    .map(t=>({ key:t.key, name:t.name, wo:t.n+'× in '+t.stds.size+' Standard'+(t.stds.size===1?'':'s') }))
    .sort((a,b)=>a.name.localeCompare(b.name,'de'));
  return _altMatCache;
}
function altUiHinzu(gid, key, name){
  altGliedHinzu(gid, key, name, '');
  renderSheetAlternative();
  if(typeof reRenderDetail==='function') reRenderDetail();
  if(typeof toast==='function') toast('Zur Austauschgruppe hinzugefügt');
}
function altUiHinweis(gid, key, text){ altGliedHinweis(gid, key, text); if(typeof reRenderDetail==='function') reRenderDetail(); }
function altUiVerschieben(gid, key, richtung){ if(altGliedVerschieben(gid,key,richtung)){ renderSheetAlternative(); if(typeof reRenderDetail==='function') reRenderDetail(); } }
function altUiWeg(gid, key){
  altGliedWeg(gid, key);
  renderSheetAlternative();
  if(typeof reRenderDetail==='function') reRenderDetail();
  if(typeof toast==='function') toast('Entfernt');
}
function altBearbeiten(gid){
  /* Aus der Ansicht heraus in die Pflege — nur, wenn wir an einer Zeile
     stehen; sonst fehlt der Bezug. */
  if(typeof sheetEntry!=='undefined' && sheetEntry) renderSheetAlternative();
  else altSheet(gid);
}

/* ═══════════ 2. Verfahrenszweige ═══════════ */

/* ZWG[sid|ri] = { wort, zweige:[{key,wort}], abschnitte:{ '<abschnitt>':'<zweigKey>' } } */
let ZWG = (typeof loadJSON==='function') ? loadJSON('hkl_zweige', {}) : {};
if(!ZWG || typeof ZWG!=='object') ZWG = {};
function saveZwg(){ if(typeof saveJSON==='function') saveJSON('hkl_zweige', ZWG); }

/* Die Wahl ist gerätelokal: Sie gilt für den Fall, der heute läuft — nicht
   für den Standard und nicht für die Kollegin im anderen Saal. */
let ZWGWAHL = (typeof loadJSON==='function') ? loadJSON('hkl_zweigwahl', {}) : {};
if(!ZWGWAHL || typeof ZWGWAHL!=='object') ZWGWAHL = {};
function saveZwgWahl(){ if(typeof saveJSON==='function') saveJSON('hkl_zweigwahl', ZWGWAHL); }

function zwgKey(sid, ri){ return sid+'|'+ri; }
function zwgOf(sid, ri){ return ZWG[zwgKey(sid,ri)] || null; }
function zwgAnlegen(sid, ri, wort){
  const k = zwgKey(sid,ri);
  ZWG[k] = ZWG[k] || { wort:String(wort||'').trim()||'Verfahren', zweige:[], abschnitte:{} };
  saveZwg(); return ZWG[k];
}
function zwgZweigHinzu(sid, ri, wort){
  const z = zwgAnlegen(sid, ri, null); const w = String(wort||'').trim(); if(!w) return null;
  let key = w.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || ('z'+z.zweige.length);
  while(z.zweige.some(x=>x.key===key)) key += '2';
  z.zweige.push({ key, wort:w }); saveZwg(); return z;
}
function zwgZweigWeg(sid, ri, key){
  const z = zwgOf(sid,ri); if(!z) return false;
  z.zweige = (z.zweige||[]).filter(x=>x.key!==key);
  Object.keys(z.abschnitte||{}).forEach(a=>{ if(z.abschnitte[a]===key) delete z.abschnitte[a]; });
  if(!z.zweige.length) delete ZWG[zwgKey(sid,ri)];
  saveZwg(); return true;
}
function zwgAbschnittSetzen(sid, ri, abschnitt, zweigKey){
  const z = zwgOf(sid,ri); if(!z) return false;
  if(zweigKey) (z.abschnitte=z.abschnitte||{})[abschnitt] = zweigKey;
  else if(z.abschnitte) delete z.abschnitte[abschnitt];
  saveZwg(); return true;
}
function zwgWahl(sid, ri){ return ZWGWAHL[zwgKey(sid,ri)] || ''; }
function zwgWaehlen(sid, ri, key){
  const k = zwgKey(sid,ri);
  if(key) ZWGWAHL[k] = key; else delete ZWGWAHL[k];
  saveZwgWahl();
  if(typeof reRenderDetail==='function') reRenderDetail();
}

/* Ist dieser Abschnitt gerade sichtbar?
   OHNE Wahl sind ALLE Zweige sichtbar — wer nichts entschieden hat, soll
   alles sehen und nicht die Hälfte des Standards verlieren. */
function zwgAbschnittSichtbar(sid, ri, abschnitt){
  const z = zwgOf(sid,ri); if(!z || !z.zweige || !z.zweige.length) return true;
  const gehoert = (z.abschnitte||{})[abschnitt];
  if(!gehoert) return true;                 /* nicht zugeordnet → immer sichtbar */
  const gewaehlt = zwgWahl(sid, ri);
  if(!gewaehlt) return true;
  return gehoert === gewaehlt;
}

/* Der Umschalter am Kopf der Rubrik. */
function zwgLeisteHTML(sid, ri){
  const z = zwgOf(sid, ri);
  const admin = (typeof ADMIN!=='undefined') && ADMIN;
  if((!z || !z.zweige || !z.zweige.length) && !admin) return '';
  if(!z || !z.zweige || !z.zweige.length){
    return `<div class="zwg-leiste"><button type="button" class="zwg-pflege" data-s="${esc(sid)}" data-r="${ri}" onclick="zwgSheet(this.dataset.s,+this.dataset.r)">⑂ Verfahrenszweige einrichten</button></div>`;
  }
  const gewaehlt = zwgWahl(sid, ri);
  let h = `<div class="zwg-leiste"><span class="zwg-wort">⑂ ${esc(z.wort)}</span>`;
  h += `<button type="button" class="zwg-b${gewaehlt?'':' on'}" data-s="${esc(sid)}" data-r="${ri}" onclick="zwgWaehlen(this.dataset.s,+this.dataset.r,'')">alle</button>`;
  z.zweige.forEach(x=>{
    h += `<button type="button" class="zwg-b${gewaehlt===x.key?' on':''}" data-s="${esc(sid)}" data-r="${ri}" data-k="${esc(x.key)}" onclick="zwgWaehlen(this.dataset.s,+this.dataset.r,this.dataset.k)">${esc(x.wort)}</button>`;
  });
  if(admin) h += `<button type="button" class="zwg-pflege" data-s="${esc(sid)}" data-r="${ri}" onclick="zwgSheet(this.dataset.s,+this.dataset.r)">✎</button>`;
  h += `</div>`;
  return h;
}

/* Pflege: Zweige benennen und Abschnitte zuordnen. */
function zwgSheet(sid, ri, abschnitte){
  if(typeof ADMIN!=='undefined' && !ADMIN) return;
  const z = zwgOf(sid, ri);
  const liste = abschnitte || zwgAbschnitteVon(sid, ri);
  let h = `<div class="sheet-grip"></div><div class="sheet-title">⑂ Verfahrenszweige</div>`;
  h += `<p class="why-help">Ein Zweig ist eine <b>Verfahrensvariante</b> — etwa Ablation mit RF oder mit Kryo. Abschnitte, die zu einem Zweig gehören, erscheinen nur, wenn dieser Zweig gewählt ist. Ohne Wahl bleibt alles sichtbar.</p>`;
  h += `<div class="form-grp"><div class="flabel">Bezeichnung der Entscheidung</div>
    <input class="loc-input" id="zwgWort" value="${esc(z?z.wort:'')}" placeholder="z. B. Ablationsverfahren"
      data-s="${esc(sid)}" data-r="${ri}" onchange="zwgUiWort(this.dataset.s,+this.dataset.r,this.value)"></div>`;
  h += `<div class="flabel" style="margin-top:8px">Zweige</div><div class="zwg-liste">`;
  (z&&z.zweige||[]).forEach(x=>{
    h += `<div class="zwg-zeile"><span>${esc(x.wort)}</span>
      <button class="dgr" data-s="${esc(sid)}" data-r="${ri}" data-k="${esc(x.key)}" onclick="zwgUiWeg(this.dataset.s,+this.dataset.r,this.dataset.k)">Entfernen</button></div>`;
  });
  h += `</div>`;
  h += `<div class="form-row" style="margin-top:6px"><input class="loc-input" id="zwgNeu" placeholder="Neuer Zweig, z. B. Kryo">
    <button type="button" class="add-btn" data-s="${esc(sid)}" data-r="${ri}" onclick="zwgUiNeu(this.dataset.s,+this.dataset.r)">Anlegen</button></div>`;
  if(z && z.zweige && z.zweige.length && liste.length){
    h += `<div class="flabel" style="margin-top:12px">Welcher Abschnitt gehört zu welchem Zweig?</div>`;
    liste.forEach(a=>{
      const jetzt = (z.abschnitte||{})[a] || '';
      h += `<div class="zwg-zuo"><span>${esc(a)}</span>
        <select class="form-sel" data-s="${esc(sid)}" data-r="${ri}" data-a="${esc(a)}" onchange="zwgUiZuordnen(this.dataset.s,+this.dataset.r,this.dataset.a,this.value)">
          <option value="">— immer sichtbar —</option>
          ${z.zweige.map(x=>`<option value="${esc(x.key)}" ${jetzt===x.key?'selected':''}>${esc(x.wort)}</option>`).join('')}
        </select></div>`;
    });
  }
  h += `<button class="sheet-close" onclick="showSheet(false);reRenderDetail()">Fertig</button>`;
  $('sheet').innerHTML = h;
  if(typeof showSheet==='function') showSheet(true);
}
/* Alle Abschnittsnamen einer Rubrik — Unterkategorien und Überschriften. */
function zwgAbschnitteVon(sid, ri){
  const aus = new Set();
  if(typeof DB==='undefined' || !DB || !DB.standards) return [];
  const s = DB.standards.find(x=>x.id===sid); if(!s) return [];
  const r = (s.rubriken||[])[ri]; if(!r) return [];
  (r.sub_bereiche||[]).forEach((sb,si)=>(sb.eintraege||[]).forEach((e,ei)=>{
    if(!e) return;
    if(e.natur==='ueberschrift'){ if(e.anzeige_text) aus.add(e.anzeige_text); return; }
    const cid = (typeof cidOf==='function') ? cidOf(sid,ri,si,ei) : null;
    const uk = (cid && typeof canonUk==='function') ? canonUk(e,cid) : (e.unterkategorie||'');
    if(uk) aus.add(uk);
  }));
  return [...aus];
}
function zwgUiWort(sid, ri, wort){ const z=zwgAnlegen(sid,ri,wort); z.wort=String(wort||'').trim()||'Verfahren'; saveZwg(); }
function zwgUiNeu(sid, ri){
  const i = $('zwgNeu'); const w = (i&&i.value||'').trim();
  if(!w){ if(typeof toast==='function') toast('Bitte einen Namen eingeben',true); return; }
  zwgZweigHinzu(sid, ri, w); zwgSheet(sid, ri);
}
function zwgUiWeg(sid, ri, key){ zwgZweigWeg(sid, ri, key); zwgSheet(sid, ri); }
function zwgUiZuordnen(sid, ri, abschnitt, key){ zwgAbschnittSetzen(sid, ri, abschnitt, key); }

/* ═══════════ 3. Verwaltung ═══════════ */

function altPanelHTML(){
  const head = (typeof vsum==='function')
    ? vsum('⇄','Austauschgruppen','Material, das gegeneinander ersetzt werden kann', ALTG.length?(ALTG.length+' Gruppen'):'')
    : `<summary>⇄ Austauschgruppen</summary>`;
  let h = `<details class="vpanel" data-keys="alternative alternativen austausch ersatz statt oder substitution schleuse">
    ${head}<div class="vpanel-body">
    <p class="panel-help">Eine Austauschgruppe sagt: „Statt A geht auch B." Das <b>erste</b> Material ist der Standard, die übrigen sind Alternativen mit ihrem Grund. Angezeigt wird die Gruppe an <b>jeder</b> Zeile jedes beteiligten Materials — angelegt wird sie dort über „⋯ → ⇄ Alternativen".</p>`;
  if(!ALTG.length) h += `<p class="hint">Noch keine Austauschgruppe angelegt.</p>`;
  ALTG.forEach(g=>{
    h += `<div class="alt-karte"><div class="alt-kopf">${esc(g.wort)}</div>`;
    (g.glieder||[]).forEach((x,i)=>{
      h += `<div class="alt-zeile"><span class="alt-rang">${i===0?'Standard':'Alternative'}</span>
        <span class="alt-name">${esc(x.name)}</span>${x.hinweis?`<span class="alt-hinweis">${esc(x.hinweis)}</span>`:''}</div>`;
    });
    h += `<div class="p-actions"><button class="btn btn-sec" data-g="${esc(g.id)}" onclick="altGruppeLoeschen(this.dataset.g);renderAdmin();toast('Gruppe gelöscht')">Gruppe löschen</button></div></div>`;
  });
  h += `</div></details>`;
  return h;
}
