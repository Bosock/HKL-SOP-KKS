/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — GEFÜHRTER AUFRÄUM-ASSISTENT (Standards entmischen)
   Die Standard-Einträge sind verdichteter HKL-Jargon: ein Satz mischt echtes
   Material + Verwendung + Bedingung + Standort + Alternative. Dieser Assistent
   geht Material für Material durch, zeigt den ROH-Text und einen VORSCHLAG
   (public/data/cleanup_suggestions.json): sauberer Material-Kern + Kategorie +
   die ausgelagerten Felder. Der Nutzer bestätigt oder korrigiert mit einem Tipp.

   „Übernehmen" legt einen sauberen Material-Stammsatz an (bzw. verknüpft den
   vorhandenen) mit Name = Kern, Kategorie, Verwendung, Hinweis (=Bedingung),
   Lagerort (=Standort) und Alternative — realisiert also die Trennung
   „Produkt-Infos zum Material, Zusatz-Infos strukturiert daneben". Der Fortschritt
   (erledigte material_keys) liegt in hkl_cleanup_done. Nicht-destruktiv: die
   Standards selbst bleiben unangetastet, es entstehen nur Stammsätze + Verweise.
   ───────────────────────────────────────────────────────────── */

let CLEANUP = {};   /* material_key → { roh, kategorie, kern, verwendung, bedingung, standort, alternative, kein_material } */
let CLEANUP_DONE = (typeof loadJSON==='function') ? loadJSON('hkl_cleanup_done', {}) : {};
let cleanupIdx = 0; /* Position in der aktuellen Warteschlange */

function cleanupSetData(obj){ CLEANUP = (obj && obj.vorschlaege) ? obj.vorschlaege : (obj || {}); }
function cleanupSaveDone(){ if(typeof saveJSON==='function') saveJSON('hkl_cleanup_done', CLEANUP_DONE); }
function cleanupCount(){ return CLEANUP ? Object.keys(CLEANUP).length : 0; }

/* ===== Reine Helfer ===== */
/* Vorschlag zu einem material_key (oder null). Rein. */
function cleanupSuggest(key){ return (CLEANUP && key && CLEANUP[key]) || null; }
/* Ist ein material_key schon aufgeräumt? Rein. */
function cleanupIsDone(key){ return !!(CLEANUP_DONE && CLEANUP_DONE[key]); }

/* Warteschlange: distinkte Materialien (aus dem Standard-Index) mit Vorschlag,
   die noch NICHT erledigt sind — häufigste zuerst. Braucht matDistinctList(). */
function cleanupQueue(){
  const list=(typeof matDistinctList==='function')?matDistinctList():[];
  return list.filter(m=>cleanupSuggest(m.key) && !cleanupIsDone(m.key))
    .map(m=>({ key:m.key, name:m.name, count:m.count||0 }))
    .sort((a,b)=>(b.count-a.count)||(a.name||'').localeCompare(b.name||'','de'));
}
/* Kennzahlen für die Fortschrittsanzeige. */
function cleanupStats(){
  const all=(typeof matDistinctList==='function')?matDistinctList():[];
  const withSug=all.filter(m=>cleanupSuggest(m.key));
  const done=withSug.filter(m=>cleanupIsDone(m.key)).length;
  return { total:withSug.length, done, offen:withSug.length-done };
}

/* ===== Screen ===== */
function openCleanup(){
  if(typeof ADMIN!=='undefined' && !ADMIN){ if(typeof promptLoginThen==='function'){ promptLoginThen(openCleanup); return; } }
  cleanupIdx=0; renderCleanup(); show('scr-cleanup');
  if(typeof setBar==='function') setBar('Aufräum-Assistent','Material entmischen',true);
}
function renderCleanup(){
  const box=$('scr-cleanup'); if(!box) return;
  const st=cleanupStats(); const q=cleanupQueue();
  const bar=`<div class="banner"><h2>🧹 Aufräum-Assistent</h2>
    <p>Aus jedem verdichteten Standard-Eintrag wird sauberes Material + eigene Felder (Verwendung, Bedingung, Standort, Alternative). Prüfe den Vorschlag und übernimm ihn — oder korrigiere ihn vorher. Die Standards bleiben unangetastet.</p>
    <div class="prog"><div class="prog-txt">${st.done} von ${st.total} aufgeräumt${st.offen?` · ${st.offen} offen`:''}</div></div></div>`;
  if(!q.length){
    box.innerHTML=bar+`<div class="empty"><div class="ei">✅</div><h3>Alles aufgeräumt</h3><p>Es sind keine offenen Vorschläge mehr da. Neue Materialien erscheinen hier automatisch, sobald es Vorschläge dazu gibt.</p><div class="p-actions" style="justify-content:center"><button class="btn btn-sec" onclick="mode='care';renderMaterialHub&&renderMaterialHub();show('scr-care')">Zur Materialverwaltung</button>${st.done?`<button class="btn btn-sec" onclick="cleanupResetAll()">Fortschritt zurücksetzen</button>`:''}</div></div>`;
    return;
  }
  if(cleanupIdx>=q.length) cleanupIdx=0;
  const cur=q[cleanupIdx]; const s=cleanupSuggest(cur.key)||{};
  const linked=(typeof canonId==='function')?canonId(cur.key):null;
  const f=(id,label,val,ph)=>`<div class="cl-field"><label class="flabel">${esc(label)}</label><input class="loc-input" id="${id}" value="${esc(val||'')}" placeholder="${esc(ph||'')}"></div>`;
  const katOpts=(typeof MATCAT_KATS!=='undefined'?MATCAT_KATS:[]).map(k=>`<option value="${esc(k)}">`).join('');
  box.innerHTML=bar+`
    <div class="cl-card">
      <div class="cl-pos">Material ${cleanupIdx+1} von ${q.length}${cur.count?` · ${cur.count}× im Standard`:''}${linked?` · <span class="mat-sub ok">bereits Stammsatz</span>`:''}</div>
      <div class="cl-roh"><div class="if-l">Roh-Text aus dem Standard</div><div class="cl-roh-t">${esc(s.roh||cur.name)}</div></div>
      ${s.kein_material?`<div class="cl-warn">⚠️ Das sieht nach <b>kein Material</b> aus (Hinweis/Handlung/Ort). Du kannst es als „kein Material" markieren.</div>`:''}
      <div class="cl-fields">
        ${f('clKern','Material (Kern)',s.kern||cur.name,'sauberer Produktname')}
        <div class="cl-field"><label class="flabel">Kategorie</label><input class="loc-input" id="clKat" value="${esc(s.kategorie&&s.kategorie.indexOf('Kein Material')<0?s.kategorie:'')}" list="clKatList" placeholder="z. B. Nahtmaterial"><datalist id="clKatList">${katOpts}</datalist></div>
        ${f('clVerw','Verwendung',s.verwendung,'z. B. Fixierung des Geräts')}
        ${f('clBed','Bedingung / Hinweis',s.bedingung,'z. B. entfällt oft')}
        ${f('clStand','Standort',s.standort,'z. B. Saal 3 Schrank rechts')}
        ${f('clAlt','Alternative',s.alternative,'z. B. TERUMO TIG 4.0 5F')}
      </div>
      <div class="cl-actions">
        <button class="btn btn-pri" data-k="${esc(cur.key)}" onclick="cleanupApply(this.dataset.k)">✓ Übernehmen</button>
        <button class="btn btn-sec" onclick="cleanupNext()">Überspringen</button>
        <button class="btn btn-sec" data-k="${esc(cur.key)}" onclick="cleanupMarkKein(this.dataset.k)">Kein Material</button>
      </div>
    </div>`;
}
function cleanupNext(){ cleanupIdx++; renderCleanup(); }

/* Übernehmen: sauberen Stammsatz anlegen/verknüpfen und die entmischten Felder
   dort speichern. Danach als erledigt markieren und zum nächsten. */
function cleanupApply(key){
  if(typeof ADMIN!=='undefined' && !ADMIN){ if(typeof promptLoginThen==='function'){ promptLoginThen(()=>cleanupApply(key)); return; } }
  const v=(id)=>{ const el=$(id); return el?el.value.trim():''; };
  const kern=v('clKern')||key;
  let id=(typeof canonId==='function')?canonId(key):null;
  if(!id){ id=(typeof matCreateStamm==='function')?matCreateStamm(kern):null; if(id && typeof matLinkTo==='function') matLinkTo(key,id); }
  const rec=(id && typeof GTINDB!=='undefined')?GTINDB[id]:null;
  if(rec){
    rec.name=kern;
    const kat=v('clKat'); if(kat) rec.kategorie=kat;
    const verw=v('clVerw'); if(verw) rec.verwendung=verw;
    const bed=v('clBed'); if(bed) rec.hinweis=bed;
    const stand=v('clStand'); if(stand && !rec.lagerort) rec.lagerort=stand;
    const alt=v('clAlt'); if(alt) rec.alternative=alt;
    rec.updatedAt=new Date().toISOString();
    if(typeof saveGtinDB==='function') saveGtinDB();
  }
  CLEANUP_DONE[key]=true; cleanupSaveDone();
  if(typeof buildMaterialIndex==='function') buildMaterialIndex();
  if(typeof toast==='function') toast('„'+kern+'" aufgeräumt');
  renderCleanup();
}
/* Als „kein Material" markieren: nur als erledigt vermerken (nicht-destruktiv –
   die Standards bleiben, aber das Material taucht im Assistenten nicht mehr auf). */
function cleanupMarkKein(key){
  if(typeof ADMIN!=='undefined' && !ADMIN){ if(typeof promptLoginThen==='function'){ promptLoginThen(()=>cleanupMarkKein(key)); return; } }
  CLEANUP_DONE[key]=true; cleanupSaveDone();
  if(typeof toast==='function') toast('Als „kein Material" markiert');
  renderCleanup();
}
function cleanupResetAll(){
  if(typeof confirm==='function' && !confirm('Aufräum-Fortschritt zurücksetzen? Bereits angelegte Stammsätze bleiben erhalten.')) return;
  CLEANUP_DONE={}; cleanupSaveDone(); cleanupIdx=0; renderCleanup();
}
