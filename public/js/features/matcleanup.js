/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — GEFÜHRTER AUFRÄUM-ASSISTENT (Standards entmischen)

   Die Standard-Einträge sind verdichteter HKL-Jargon aus der Word-Vorlage: EIN
   Satz mischt Produkt + Menge + Verwendung + Bedingung + Standort + Alternative.
   Dieser Assistent geht sie durch, zeigt den ROH-Text und daneben die
   Zerlegung (features/zerlegung.js) — und der Mensch bestätigt oder korrigiert.

   Drei Entscheidungen prägen die Bedienung:

   ① EINMAL ENTSCHEIDEN, ÜBERALL GÜLTIG. Gearbeitet wird an TEXTEN, nicht an
      Stellen. „OP-Lampengriff" steht 46× im Bestand — das ist EINE Entscheidung,
      nicht 46. Der Zähler zeigt jeweils, für wie viele Stellen sie gilt.

   ② WICHTIGES ZUERST. Die Warteschlange sortiert nach Wirkung: erst die
      unklaren Fälle (dort steht heute ein Satz als Materialname), dann die
      häufigsten. Wer nach zehn Minuten aufhört, hat die zehn Minuten mit den
      wirksamsten Fällen verbracht.

   ③ WAS NICHT VERSTANDEN WURDE, STEHT OBEN. Der „Rest" ist kein Kleingedrucktes,
      sondern die eigentliche Frage an den Menschen. Und die Spur zeigt auf
      Wunsch, WARUM die Zerlegung so entschieden hat — dieselbe Idee wie der
      „Warum so?"-Inspektor am Eintrag.

   Nicht-destruktiv: Die Standards bleiben unangetastet. Bestätigungen liegen in
   `hkl_zerlegung` und sind einzeln zurücknehmbar; danach gilt wieder der alte
   material_key.
   ───────────────────────────────────────────────────────────── */

let CLEANUP = {};   /* Alt-Vorschläge aus data/cleanup_suggestions.json (Rückfallebene) */
let CLEANUP_DONE = (typeof loadJSON==='function') ? loadJSON('hkl_cleanup_done', {}) : {};
let cleanupIdx = 0;
let cleanupFilter = 'offen';   /* 'offen' | 'alle' */

function cleanupSetData(obj){ CLEANUP = (obj && obj.vorschlaege) ? obj.vorschlaege : (obj || {}); }
function cleanupSaveDone(){ if(typeof saveJSON==='function') saveJSON('hkl_cleanup_done', CLEANUP_DONE); }
function cleanupCount(){ return CLEANUP ? Object.keys(CLEANUP).length : 0; }

/* ===== Reine Helfer (testbar) ===== */
function cleanupSuggest(key){ return (CLEANUP && key && CLEANUP[key]) || null; }
function cleanupIsDone(key){ return !!(CLEANUP_DONE && CLEANUP_DONE[key]); }

/* Alle Material-/Geräte-Zeilen der Standards, gruppiert nach ihrem TEXT.
   Rein bis auf den Zugriff auf DB. Rückgabe je Gruppe:
     { tkey, text, beispiel, stellen, cids, bestaetigt } */
function cleanupGruppen(){
  if(typeof DB==='undefined' || !DB || !DB.standards || typeof cidOf!=='function') return [];
  const m = new Map();
  DB.standards.forEach(std=>{ (std.rubriken||[]).forEach((r,ri)=>{
    if(r.typ!=='material' && r.typ!=='geraete') return;
    (r.sub_bereiche||[]).forEach((sb,si)=>{ (sb.eintraege||[]).forEach((e,ei)=>{
      if(!e || e.natur==='ueberschrift' || e.ist_fliesstext) return;
      const tk = (typeof zerlTextKey==='function') ? zerlTextKey(e) : null;
      if(!tk) return;
      const cid = cidOf(std.id,ri,si,ei);
      if(!m.has(tk)) m.set(tk, { tkey:tk, text:(e.anzeige_text||e.roh_text||''), beispiel:e, stellen:0, cids:[] });
      const g = m.get(tk); g.stellen++; if(g.cids.length<40) g.cids.push(cid);
    }); });
  }); });
  return [...m.values()];
}

/* Warteschlange: was hat der Mensch noch nicht entschieden?
   Sortiert nach Wirkung — unklare Fälle zuerst, dann nach Häufigkeit. */
function cleanupQueue(){
  const alles = cleanupGruppen();
  /* Maßgeblich ist ALLEIN die Zerlegung. `CLEANUP_DONE` ist nur noch ein
     Protokoll aus der Vorgängerfassung — würde es die Warteschlange steuern,
     bliebe eine zurückgenommene Entscheidung fälschlich als „erledigt"
     markiert und der Text ließe sich nie wieder bearbeiten. */
  const offen = alles.filter(g=>{
    if(typeof ZERLDB==='undefined') return false;
    return !ZERLDB[g.tkey];
  });
  const liste = (cleanupFilter==='alle') ? alles : offen;
  return liste.map(g=>{
    const z = (typeof zerlFuer==='function') ? zerlFuer(g.beispiel, null) : null;
    return Object.assign({}, g, { z:z, unklar: !z || z.art==='unklar' || !!z.rest });
  }).sort((a,b)=>{
    if(a.unklar!==b.unklar) return a.unklar ? -1 : 1;   /* Unklares zuerst */
    return (b.stellen-a.stellen) || (a.text||'').localeCompare(b.text||'','de');
  });
}

/* Kennzahlen für die Fortschrittsanzeige. */
function cleanupStats(){
  const alles = cleanupGruppen();
  const entschieden = alles.filter(g=>(typeof ZERLDB!=='undefined' && !!ZERLDB[g.tkey])).length;
  const stellen = alles.reduce((s,g)=>s+g.stellen,0);
  return { total:alles.length, done:entschieden, offen:alles.length-entschieden, stellen:stellen };
}

/* ===== Screen ===== */
function openCleanup(){
  if(typeof ADMIN!=='undefined' && !ADMIN){ if(typeof promptLoginThen==='function'){ promptLoginThen(openCleanup); return; } }
  cleanupIdx=0; renderCleanup(); show('scr-cleanup');
  if(typeof setBar==='function') setBar('Aufräum-Assistent','Produkt · Verwendung · Position trennen',true);
}

function clFeld(id,label,val,ph,hinweis){
  return `<div class="cl-field"><label class="flabel" for="${id}">${esc(label)}</label>
    <input class="loc-input" id="${id}" value="${esc(val==null?'':val)}" placeholder="${esc(ph||'')}">
    ${hinweis?`<div class="cl-hint">${esc(hinweis)}</div>`:''}</div>`;
}

function renderCleanup(){
  const box=$('scr-cleanup'); if(!box) return;
  if(typeof matKeyBereit==='function' && !matKeyBereit()){
    box.innerHTML=`<div class="empty"><div class="ei">📄</div><h3>Zerlegungs-Regeln fehlen</h3>
      <p>Die Datei <code>data/zerlegung.json</code> konnte nicht geladen werden. Ohne sie arbeitet die App wie bisher weiter — der Assistent hat aber nichts, womit er vorschlagen könnte.</p></div>`;
    return;
  }
  const st=cleanupStats(); const q=cleanupQueue();
  const proz = st.total ? Math.round(100*st.done/st.total) : 0;
  const bar=`<div class="banner"><h2>🧹 Aufräum-Assistent</h2>
    <p>Aus jeder verdichteten Zeile wird <b>Produkt</b> (was es ist) · <b>Verwendung</b> (wie viel, wozu, unter welcher Bedingung) · <b>Position</b> (woher). Eine Entscheidung gilt für alle Stellen mit demselben Text. Die Standards bleiben unangetastet.</p>
    <div class="prog"><div class="prog-txt">${st.done} von ${st.total} Texten entschieden (${proz} %) · ${st.stellen} Stellen im Bestand</div>
      <div class="prog-bar"><span style="width:${proz}%"></span></div></div>
    <div class="cl-filter">
      <button type="button" class="btn btn-sec${cleanupFilter==='offen'?' on':''}" onclick="cleanupSetFilter('offen')">Nur offene</button>
      <button type="button" class="btn btn-sec${cleanupFilter==='alle'?' on':''}" onclick="cleanupSetFilter('alle')">Alle zeigen</button>
    </div></div>`;

  if(!q.length){
    box.innerHTML=bar+`<div class="empty"><div class="ei">✅</div><h3>Nichts mehr offen</h3>
      <p>Alle Texte sind entschieden. Neue Zeilen erscheinen hier automatisch.</p>
      <div class="p-actions" style="justify-content:center">
        <button class="btn btn-sec" onclick="mode='care';renderCare();show('scr-care');updateBar()">Zur Materialverwaltung</button>
        ${st.done?`<button class="btn btn-sec" onclick="cleanupResetAll()">Entscheidungen zurücknehmen</button>`:''}</div></div>`;
    return;
  }
  if(cleanupIdx>=q.length) cleanupIdx=0;
  const cur=q[cleanupIdx]; const z=cur.z||{};
  const p=(z.produkt&&z.produkt.name)||'';

  /* Der Rest steht OBEN, nicht im Kleingedruckten — er ist die Frage. */
  const restBlock = z.rest ? `<div class="cl-warn">❓ <b>Nicht zugeordnet:</b> „${esc(z.rest)}"<br>
    <span class="cl-hint">Bitte selbst einsortieren — oder unten „Keine Materialzeile" wählen.</span></div>` : '';

  const artWahl = ['produkt','taetigkeit','hinweis'].map(a=>{
    const lbl={produkt:'📦 Produkt',taetigkeit:'🔧 Tätigkeit',hinweis:'ℹ️ Hinweis'}[a];
    return `<button type="button" class="cl-art${z.art===a?' on':''}" data-a="${a}" onclick="cleanupSetArt(this.dataset.a)">${lbl}</button>`;
  }).join('');

  const spur = (z.spur&&z.spur.length)
    ? `<details class="cl-spur"><summary>Warum so? (${z.spur.length} Schritte)</summary>
       ${z.spur.map(s=>`<div class="cl-spur-row"><span class="cl-spur-s">${esc(s.schritt)}</span><span>${esc(s.wert)}</span></div>`).join('')}</details>`
    : '';

  box.innerHTML=bar+`
    <div class="cl-card">
      <div class="cl-pos">Text ${cleanupIdx+1} von ${q.length} · gilt für <b>${cur.stellen}</b> Stelle${cur.stellen===1?'':'n'}${cur.unklar?' · <span class="cl-flag">unklar</span>':''}</div>
      <div class="cl-roh"><div class="if-l">So steht es heute im Standard</div><div class="cl-roh-t">${esc(cur.text)}</div></div>
      ${restBlock}
      <div class="cl-artrow"><span class="flabel">Was ist das?</span><div class="cl-arts">${artWahl}</div></div>
      <div class="cl-fields" id="clFields">
        ${clFeld('clKern','Produkt',p,'sauberer Produktname','ohne Größe, ohne Zweck, ohne Bedingung')}
        ${clFeld('clGroesse','Größe',z.groesse,'z. B. 6F, 500ml','gehört zu den Merkmalen, nicht in den Namen')}
        ${clFeld('clZiel','Ziel',z.ziel,'z. B. große Coro-Set-Schale')}
        ${clFeld('clZweck','Zweck',z.zweck,'z. B. Fixierung des Gerätes')}
        ${clFeld('clBed','Bedingung',z.bedingung,'z. B. auf Ansage')}
        ${clFeld('clOrt','Herkunft / Standort',z.ort,'z. B. Vorbereitungsraum')}
        ${clFeld('clHinweis','Hinweis',z.hinweis,'z. B. muss an den Defi angeschlossen werden')}
        ${clFeld('clFarbe','Farbe',z.farbe,'z. B. grün')}
        ${clFeld('clPraep','Präparat',z.praeparat,'z. B. Lidocain 1%')}
        ${clFeld('clAlt','Alternative',(z.alternativen||[]).join(' | '),'mit | getrennt')}
      </div>
      ${spur}
      <div class="cl-actions">
        <button class="btn btn-pri" data-k="${esc(cur.tkey)}" onclick="cleanupApply(this.dataset.k)">✓ Übernehmen${cur.stellen>1?` (${cur.stellen} Stellen)`:''}</button>
        <button class="btn btn-sec" onclick="cleanupNext()">Überspringen</button>
        <button class="btn btn-sec" data-k="${esc(cur.tkey)}" onclick="cleanupMarkKein(this.dataset.k)">Keine Materialzeile</button>
      </div>
    </div>`;
  box.dataset.art = z.art || 'unklar';
}

function cleanupSetFilter(f){ cleanupFilter=f; cleanupIdx=0; renderCleanup(); }
function cleanupNext(){ cleanupIdx++; renderCleanup(); }
/* Art umschalten, ohne die bereits getippten Felder zu verlieren. */
function cleanupSetArt(a){
  const box=$('scr-cleanup'); if(!box) return;
  box.dataset.art=a;
  [...box.querySelectorAll('.cl-art')].forEach(b=>b.classList.toggle('on', b.dataset.a===a));
}

/* Liest die Maske. Leere Felder bleiben leer — „leer schlägt falsch" gilt auch
   für das, was der Mensch bewusst nicht ausfüllt. */
function cleanupLesen(){
  const v=(id)=>{ const el=$(id); return el ? el.value.trim() : ''; };
  const box=$('scr-cleanup');
  const art=(box&&box.dataset.art)||'produkt';
  const kern=v('clKern');
  const alt=v('clAlt').split('|').map(s=>s.trim()).filter(Boolean);
  return {
    art: art,
    produkt: (art==='produkt'&&kern) ? { name:kern, slug:(typeof zerlSlug==='function')?zerlSlug(kern):kern.toLowerCase() } : null,
    groesse: v('clGroesse')||null,
    ziel: v('clZiel')||null,
    zweck: v('clZweck')||null,
    bedingung: v('clBed')||null,
    ort: v('clOrt')||null,
    hinweis: v('clHinweis')||null,
    farbe: v('clFarbe')||null,
    praeparat: v('clPraep')||null,
    alternativen: alt,
    rest: null                        /* durch die Entscheidung erledigt */
  };
}

/* Übernehmen: Die Entscheidung gilt ab jetzt für JEDE Stelle mit diesem Text. */
function cleanupApply(tkey){
  if(typeof ADMIN!=='undefined' && !ADMIN){ if(typeof promptLoginThen==='function'){ promptLoginThen(()=>cleanupApply(tkey)); return; } }
  const felder=cleanupLesen();
  if(felder.art==='produkt' && !felder.produkt){ if(typeof toast==='function') toast('Bitte einen Produktnamen eintragen – oder die Art umstellen.',true); return; }
  if(typeof zerlBestaetigen==='function') zerlBestaetigen(tkey, felder);

  /* Ein sauberer Produktkern verdient einen sauberen Stammsatz. Das konnte der
     Assistent schon vorher und bleibt erhalten — nur speist er sich jetzt aus
     der Zerlegung statt aus einem Pass-Through-Vorschlag: Zweck → Verwendung,
     Ort → Lagerort, Hinweis → Hinweis, Alternativen → Alternative.
     Vorhandene Angaben am Stammsatz werden NICHT überschrieben. */
  if(felder.art==='produkt' && felder.produkt){
    const key=felder.produkt.slug;
    let id=(typeof canonId==='function')?canonId(key):null;
    if(!id && typeof matCreateStamm==='function'){
      id=matCreateStamm(felder.produkt.name);
      if(id && typeof matLinkTo==='function') matLinkTo(key,id);
    }
    const rec=(id && typeof GTINDB!=='undefined')?GTINDB[id]:null;
    if(rec){
      if(!rec.name) rec.name=felder.produkt.name;
      if(felder.zweck && !rec.verwendung) rec.verwendung=felder.zweck;
      if(felder.ort && !rec.lagerort) rec.lagerort=felder.ort;
      if(felder.hinweis && !rec.hinweis) rec.hinweis=felder.hinweis;
      if(felder.alternativen && felder.alternativen.length && !rec.alternative) rec.alternative=felder.alternativen.join(' | ');
      if(!rec.kategorie){
        /* Kategorie aus dem Alt-Vorschlagskatalog übernehmen, wenn es einen gibt —
           er ist fachlich gepflegt und soll nicht verloren gehen. */
        const alt=cleanupSuggest(key)||cleanupSuggest((felder.produkt.name||'').toLowerCase());
        rec.kategorie=(alt&&alt.kategorie&&alt.kategorie.indexOf('Kein Material')<0)?alt.kategorie:'Material';
      }
      rec.updatedAt=new Date().toISOString();
      if(typeof saveGtinDB==='function') saveGtinDB();
    }
  }

  CLEANUP_DONE[tkey]=true; cleanupSaveDone();
  const st=cleanupStats();
  if(typeof toast==='function') toast('Übernommen · noch '+st.offen+' offen');
  renderCleanup();
}

/* „Keine Materialzeile": als Hinweis festschreiben. Die Zeile bleibt im
   Standard sichtbar, taucht aber nicht mehr als Material auf. */
function cleanupMarkKein(tkey){
  if(typeof ADMIN!=='undefined' && !ADMIN){ if(typeof promptLoginThen==='function'){ promptLoginThen(()=>cleanupMarkKein(tkey)); return; } }
  if(typeof zerlBestaetigen==='function') zerlBestaetigen(tkey, { art:'hinweis', produkt:null });
  if(typeof toast==='function') toast('Als Hinweis festgehalten – kein Material mehr');
  renderCleanup();
}

function cleanupResetAll(){
  if(typeof confirm==='function' && !confirm('Alle Aufräum-Entscheidungen zurücknehmen? Die Standards und angelegte Stammsätze bleiben erhalten.')) return;
  if(typeof ZERLDB!=='undefined'){ Object.keys(ZERLDB).forEach(k=>delete ZERLDB[k]);
    if(typeof saveZerlDB==='function') saveZerlDB();
    if(typeof matKeyCacheLeeren==='function') matKeyCacheLeeren();
    if(typeof buildMaterialIndex==='function') buildMaterialIndex(); }
  CLEANUP_DONE={}; cleanupSaveDone(); cleanupIdx=0; renderCleanup();
}
