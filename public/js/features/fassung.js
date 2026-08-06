/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — FASSUNG FESTSCHREIBEN

   „Die App ist die neue Wahrheit, nicht mehr die Word-Datei. Ich möchte im
   Journal endgültige Änderungen festlegen können. Wenn ich sage, das ist
   endgültig, dann ist das der neue Ist-Zustand."

   Das Ziel ist richtig. Die naheliegende Umsetzung — „Rücknahme löschen" —
   wäre es nicht. Was hier gebraucht wird, ist keine gelöschte Rücknahme,
   sondern eine NEUE GRUNDLAGE:

     Der aktuelle wirksame Stand eines Standards wird eingefroren und tritt an
     die Stelle der Quelldatei. Die Regeln, die dahin geführt haben, sind
     danach EINGEARBEITET — sie verschwinden aus der Liste der aktiven Regeln
     und lassen sich einzeln nicht mehr zurücknehmen. Genau das ist gewollt.

   Der Unterschied zur harten Variante: Die ganze FASSUNG bleibt als Stand
   erhalten und wiederherstellbar. Einzel-Rücknahme weg, Katastrophen-Rückweg
   bleibt. Ohne den zweiten Teil wäre ein Fehlgriff beim Festschreiben
   dauerhaft — und Festschreiben ist genau die Handlung, bei der man sich
   irrt, weil man sie selten macht.

   ── Wo die Fassung in der Kaskade steht ──
   Ganz unten, an der Stelle der Quelldatei:

       📍 Stelle  >  📄 Standard  >  🗂 Gruppe / 🏷 Merkmal  >  🌐 alle
                                                             >  📚 FASSUNG
                                                             >  Quelldatei

   Neue Regeln wirken also weiterhin ganz normal darüber. Die Fassung ersetzt
   nur, was vorher die Datei sagte.

   ── Die Quelldatei wird NICHT angefasst ──
   Grundsatz ⑦ gilt weiter: public/data/hkl_standards_export.json bleibt
   unverändert. Die Fassung ist ein eigener, geteilter Speicher. Wer sie
   verwirft, sieht wieder die Datei.
   ───────────────────────────────────────────────────────────── */

/* ═══════════ 1. Zustand ═══════════ */

/* FAS = [{ id, ts, von, sid, wort, werte:{ '<cid>': { prop: wert } },
            regeln:[ruleId], abgeloest?:id }]
   Append-only wie das Regel-Journal: Eine neue Fassung löst die vorige ab,
   löscht sie aber nicht. */
let FAS = (typeof loadJSON==='function') ? loadJSON('hkl_fassungen', []) : [];
if(!Array.isArray(FAS)) FAS = [];
function saveFas(){ if(typeof saveJSON==='function') saveJSON('hkl_fassungen', FAS); FAS_IDX = null; }

/* Schneller Zugriff: cid → {prop: wert} der GELTENDEN Fassung. */
let FAS_IDX = null;
function fasIndex(){
  if(FAS_IDX) return FAS_IDX;
  FAS_IDX = {};
  fasGeltende().forEach(f=>{
    Object.keys(f.werte||{}).forEach(cid=>{
      FAS_IDX[cid] = Object.assign({}, FAS_IDX[cid], f.werte[cid]);
    });
  });
  return FAS_IDX;
}
/* Je Standard gilt die NEUESTE nicht verworfene Fassung. */
function fasGeltende(){
  const jeStd = new Map();
  FAS.forEach(f=>{
    if(f.verworfen) return;
    const alt = jeStd.get(f.sid);
    if(!alt || String(f.ts) > String(alt.ts)) jeStd.set(f.sid, f);
  });
  return [...jeStd.values()];
}
function fasFuerStandard(sid){ return fasGeltende().find(f=>f.sid===sid) || null; }
function fasAlleFuer(sid){ return FAS.filter(f=>f.sid===sid).slice().sort((a,b)=>String(b.ts).localeCompare(String(a.ts))); }

/* Der festgeschriebene Wert einer Stelle — oder undefined. */
function fasWert(cid, prop){
  const m = fasIndex()[cid];
  return (m && prop in m) ? m[prop] : undefined;
}
function fasHat(cid){ return !!fasIndex()[cid]; }

/* ═══════════ 2. Festschreiben ═══════════ */

/* Welche Eigenschaften eine Fassung mitnimmt. Bewusst die INHALTLICHEN —
   Häkchen, Bilder-Warteschlangen und Ansichtseinstellungen gehören nicht
   dazu, sie sind kein Inhalt des Standards. */
const FAS_FELDER = ['name','mengeVal','groessen','zusatz','spez','color','natur','uk','why','synonyms','hidden','important','stil','bereich','bilder'];

/* Was würde festgeschrieben? Vorschau OHNE Nebenwirkung — dieselbe Zahl, die
   danach im Bestätigungstext steht. */
function fasVorschau(sid){
  const werte = {}; const regeln = new Set();
  let stellen = 0, felder = 0;
  if(typeof DB==='undefined' || !DB || !DB.standards) return { werte, regeln:[], stellen, felder };
  const s = DB.standards.find(x=>x.id===sid);
  if(!s) return { werte, regeln:[], stellen, felder };
  (s.rubriken||[]).forEach((r,ri)=>{
    (r.sub_bereiche||[]).forEach((sb,si)=>{
      (sb.eintraege||[]).forEach((e,ei)=>{
        if(!e) return;
        const cid = cidOf(sid, ri, si, ei);
        const satz = {};
        FAS_FELDER.forEach(prop=>{
          /* NUR was von der Quelldatei abweicht — sonst würde eine Fassung
             4.475 unveränderte Werte mitschleppen und der geteilte Zustand
             unnötig aufgehen. */
          const kandidaten = (typeof ruleCandidates==='function')
            ? ruleCandidates(e, cid, prop, (typeof propLegacy==='function')?propLegacy(e,cid,prop):null) : [];
          if(!kandidaten.length) return;
          const gewinner = kandidaten[0];
          if(gewinner.val===undefined) return;
          satz[prop] = gewinner.val; felder++;
          kandidaten.forEach(k=>{ if(k.rule && k.rule.id) regeln.add(k.rule.id); });
        });
        if(Object.keys(satz).length){ werte[cid] = satz; stellen++; }
      });
    });
  });
  return { werte, regeln:[...regeln], stellen, felder };
}

/* Festschreiben. Legt die Fassung an UND arbeitet die beteiligten Regeln ein
   (ein eigenes Journal-Ereignis — nichts wird gelöscht). */
function fasFestschreiben(sid, wort){
  const v = fasVorschau(sid);
  if(!v.stellen) return null;
  const f = {
    id: 'f'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
    ts: new Date().toISOString(),
    von: (typeof ruleActor==='function') ? ruleActor() : '',
    sid, wort: String(wort||'').trim() || ('Fassung vom '+new Date().toISOString().slice(0,10)),
    werte: v.werte, regeln: v.regeln
  };
  FAS.push(f); saveFas();
  /* Die eingearbeiteten Regeln zurücknehmen — mit Vermerk, warum. Sie bleiben
     im Journal lesbar, wirken aber nicht mehr: Ihr Ergebnis steckt jetzt in
     der Fassung. */
  if(typeof revokeRule==='function') v.regeln.forEach(id=>revokeRule(id));
  if(typeof buildMaterialIndex==='function') buildMaterialIndex();
  if(typeof computeUkList==='function') computeUkList();
  return f;
}

/* Eine Fassung verwerfen: der Stand VOR ihr gilt wieder. Das ist der
   Katastrophen-Rückweg — nicht die Einzel-Rücknahme, die es bewusst nicht
   mehr gibt. Die eingearbeiteten Regeln bleiben zurückgenommen; wieder gültig
   wird die Quelldatei bzw. die vorige Fassung. */
function fasVerwerfen(id){
  const f = FAS.find(x=>x.id===id); if(!f) return false;
  f.verworfen = new Date().toISOString();
  saveFas();
  if(typeof buildMaterialIndex==='function') buildMaterialIndex();
  return true;
}

/* ═══════════ 3. Verwaltung ═══════════ */

let fasForm = null;   /* {sid} — offene Eingabefläche */

function fassungPanelHTML(){
  const geltend = fasGeltende();
  const head = (typeof vsum==='function')
    ? vsum('📜','Fassungen','Den erreichten Stand festschreiben — die App wird zur Grundlage', geltend.length?(geltend.length+' festgeschrieben'):'')
    : `<summary>📚 Fassungen</summary>`;
  let h = `<details class="vpanel" data-keys="fassung fassungen festschreiben endgültig endgueltig stand grundlage einarbeiten wahrheit">
    ${head}<div class="vpanel-body">
    <p class="panel-help"><b>Festschreiben</b> friert den erreichten Stand eines Standards ein: Er tritt an die Stelle der ursprünglichen Word-Vorlage. Die Regeln, die dahin geführt haben, gelten dann als <b>eingearbeitet</b> und lassen sich nicht mehr einzeln zurücknehmen — das ist der Sinn.</p>
    <p class="panel-help">Die <b>ganze Fassung</b> bleibt umkehrbar. Einzel-Rücknahme weg, Rückweg bei einem Fehlgriff bleibt. Die Quelldatei wird nie verändert.</p>`;

  if(geltend.length){
    h += `<div class="fas-liste">`;
    geltend.forEach(f=>{
      const s = (typeof DB!=='undefined'&&DB&&DB.standards) ? DB.standards.find(x=>x.id===f.sid) : null;
      const stellen = Object.keys(f.werte||{}).length;
      h += `<div class="fas-zeile"><div class="fas-haupt">
          <b>${esc(s?stdTitel(s):f.sid)}</b>
          <div class="fas-meta">${esc(f.wort)} · ${stellen} Stellen · ${(f.regeln||[]).length} Regeln eingearbeitet · ${esc((f.ts||'').slice(0,10))}${f.von?(' · '+esc((typeof ruleVonLabel==='function')?ruleVonLabel(f.von):f.von)):''}</div>
        </div>
        <button class="btn btn-sec" data-i="${esc(f.id)}" onclick="fasUiVerwerfen(this.dataset.i)">Fassung verwerfen</button></div>`;
    });
    h += `</div>`;
  } else {
    h += `<p class="hint">Noch nichts festgeschrieben. Der Weg dorthin: einen Standard öffnen → <b>⋯ Bearbeiten → 📚 Stand festschreiben</b>.</p>`;
  }
  h += `</div></details>`;
  return h;
}
function fasUiVerwerfen(id){
  fasVerwerfen(id);
  if(typeof renderAdmin==='function') renderAdmin();
  if(typeof toast==='function') toast('Fassung verworfen — der Stand davor gilt wieder');
}

/* Festschreiben aus dem Standard heraus: erst die Vorschau, dann der Knopf.
   Kein natives Fenster (Grundsatz ⑧). */
function fasSheet(sid){
  if(typeof ADMIN!=='undefined' && !ADMIN) return;
  const s = (typeof DB!=='undefined'&&DB&&DB.standards) ? DB.standards.find(x=>x.id===sid) : null;
  const v = fasVorschau(sid);
  const alt = fasFuerStandard(sid);
  let h = `<div class="sheet-grip"></div><div class="sheet-title">📚 Stand festschreiben</div>
    <div class="sheet-name">${esc(s?stdTitel(s):sid)}</div>`;
  if(alt){
    h += `<p class="hint" style="padding:0 4px">Für diesen Standard gilt bereits die Fassung „${esc(alt.wort)}" vom ${esc((alt.ts||'').slice(0,10))}. Eine neue Fassung löst sie ab.</p>`;
  }
  if(!v.stellen){
    h += `<p class="why-help">Es gibt nichts festzuschreiben: Der Standard entspricht genau der Quelldatei — es wurde nichts geändert, was einzufrieren wäre.</p>`;
    h += `<button class="sheet-close" onclick="showSheet(false)">Schließen</button>`;
    $('sheet').innerHTML = h; if(typeof showSheet==='function') showSheet(true); return;
  }
  h += `<p class="why-help">Der erreichte Stand wird zur <b>neuen Grundlage</b> dieses Standards. Was danach passiert:</p>`;
  h += `<div class="fas-bilanz">
    <div><b>${v.stellen}</b> Stellen mit <b>${v.felder}</b> geänderten Angaben werden eingefroren.</div>
    <div><b>${v.regeln.length}</b> Regeln gelten danach als eingearbeitet und sind <b>nicht mehr einzeln</b> rücknehmbar.</div>
    <div>Die ganze Fassung bleibt umkehrbar (Verwaltung → 📚 Fassungen).</div>
    <div>Die Quelldatei bleibt unverändert.</div>
  </div>`;
  h += `<div class="form-grp"><div class="flabel">Bezeichnung dieser Fassung</div>
    <input class="loc-input" id="fasWort" placeholder="z. B. Stand nach Überarbeitung Januar" value=""></div>`;
  h += `<div class="p-actions" style="padding:6px 4px">
    <button class="btn btn-sec" onclick="showSheet(false)">Abbrechen</button>
    <button class="btn btn-pri" data-s="${esc(sid)}" onclick="fasUiFestschreiben(this.dataset.s)">Jetzt festschreiben</button></div>`;
  $('sheet').innerHTML = h;
  if(typeof showSheet==='function') showSheet(true);
  setTimeout(()=>{ const i=$('fasWort'); if(i) i.focus(); },60);
}
function fasUiFestschreiben(sid){
  const i = $('fasWort');
  const f = fasFestschreiben(sid, (i&&i.value)||'');
  if(typeof showSheet==='function') showSheet(false);
  if(!f){ if(typeof toast==='function') toast('Nichts festzuschreiben'); return; }
  if(typeof openStandard==='function') openStandard(sid, true);
  if(typeof toast==='function') toast('Festgeschrieben — '+Object.keys(f.werte||{}).length+' Stellen sind jetzt die Grundlage');
}
