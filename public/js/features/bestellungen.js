/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — BESTELLUNGEN („ist leer" melden statt hinlaufen)

   Der Betreiber: „Wenn jemand sieht, oh, da ist der Führungskatheter leer,
   den müsste man bestellen, dann muss man nicht extra zu 'ner Person
   hinrennen und sagen, hey, hör mal, der ist leer — sondern das schreibt man
   in die App. Und wenn das bestellt wurde, kann eine Person abhaken und mit
   'nem Kürzel das abhaken."

   ── Drei Zustände, weil es drei Fragen sind ──
     GEMELDET  „ist leer"        — wer hat es gesehen, wann
     BESTELLT  „ist raus"        — wer hat bestellt, wann
     GELIEFERT „ist da"          — wer hat eingeräumt, wann

   Zwei Zustände wären zu wenig: Zwischen „bestellt" und „da" liegen im
   Zweifel Tage, und genau in dieser Lücke fragt jemand zum zweiten Mal nach.
   Vier wären zu viel — für den Saal zählt nur, ob man sich darauf verlassen
   kann, dass es kommt.

   Jeder Schritt trägt Kürzel und Uhrzeit (features/kuerzel.js).

   ── Das Material ist verknüpft, aber nicht Bedingung ──
   Wer aus der Materialzentrale meldet, hängt den kanonischen Schlüssel dran;
   dann stehen Hersteller, REF und Lagerort mit da, und die Bestellung ist
   eindeutig. Wer im Saal nur „Führungskatheter EBU 3.5" tippt, soll das aber
   auch dürfen — eine Meldung, die an einer Pflicht scheitert, wird nicht
   gemacht, und dann steht das Regal leer (Grundsatz ①: leer schlägt falsch).

   Nichts wird gelöscht: Geliefertes wandert in „Erledigt" und bleibt
   nachlesbar. Wer wissen will, wie oft etwas ausgeht, findet es dort.
   ───────────────────────────────────────────────────────────── */

const BEST_STUFEN = ['gemeldet', 'bestellt', 'geliefert'];

/* Die Wörter gehören dem Haus (data/bezeichnungen.json → bestellstufen). */
const BEST_WORT_RUECKFALL = {
  gemeldet:  { wort:'gemeldet',  tu:'Bestellt',  symbol:'📣' },
  bestellt:  { wort:'bestellt',  tu:'Geliefert', symbol:'🛒' },
  geliefert: { wort:'geliefert', tu:'',          symbol:'✅' },
};
function bestWort(stufe, feld){
  const eigen = (typeof bezWert==='function') ? bezWert('bestellstufen', stufe, null) : null;
  if(eigen && eigen[feld]) return eigen[feld];
  const r = BEST_WORT_RUECKFALL[stufe] || {};
  return r[feld] || '';
}

let BEST = (typeof loadJSON==='function') ? loadJSON('hkl_bestellungen', []) : [];
if(!Array.isArray(BEST)) BEST = [];
function saveBest(){ if(typeof saveJSON==='function') saveJSON('hkl_bestellungen', BEST); }

/* Transiente Scan-Ergebnisse für das gerade offene Formular. */
let bestScanState = { gtin: null, foto: null };

function bestNeueId(){ return 'b'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function bestNach(id){ return BEST.find(b=>b.id===id) || null; }

/* Der Zustand einer Meldung. Rein/testbar — die ganze Ansicht hängt daran. */
function bestStufe(b){
  if(!b) return 'gemeldet';
  if(b.geliefert) return 'geliefert';
  if(b.bestellt)  return 'bestellt';
  return 'gemeldet';
}
function bestOffen(){ return BEST.filter(b=>bestStufe(b)!=='geliefert'); }
function bestErledigt(){ return BEST.filter(b=>bestStufe(b)==='geliefert'); }

function bestMelden(felder){
  const f = felder || {};
  const wort = String(f.wort||'').trim();
  if(!wort) return null;
  const b = { id:bestNeueId(), wort,
    matKey:f.matKey || null,
    gtin:f.gtin || null,
    foto:f.foto || null,
    menge:String(f.menge||'').trim(),
    notiz:String(f.notiz||'').trim(),
    dringend:!!f.dringend,
    gemeldet:(typeof kuerzelHaken==='function') ? kuerzelHaken() : { ts:new Date().toISOString(), kuerzel:'' },
    bestellt:null, geliefert:null };
  BEST.unshift(b); saveBest();
  return b;
}
function bestAendern(id, feld, wert){ const b=bestNach(id); if(!b) return false; b[feld]=wert; saveBest(); return true; }
function bestLoeschen(id){ const i=BEST.findIndex(b=>b.id===id); if(i<0) return false; BEST.splice(i,1); saveBest(); return true; }

/* Einen Schritt weiter. Gibt die neue Stufe zurück (oder null). */
function bestWeiter(id, kuerzelWert){
  const b = bestNach(id); if(!b) return null;
  const haken = { ts:new Date().toISOString(), kuerzel:String(kuerzelWert||'').trim() };
  const stufe = bestStufe(b);
  if(stufe==='gemeldet'){ b.bestellt = haken; saveBest(); return 'bestellt'; }
  if(stufe==='bestellt'){ b.geliefert = haken; saveBest(); return 'geliefert'; }
  return null;
}
/* Einen Schritt zurück — ein Fehlgriff darf nicht bedeuten, dass die Meldung
   neu getippt werden muss. */
function bestZurueck(id){
  const b = bestNach(id); if(!b) return null;
  const stufe = bestStufe(b);
  if(stufe==='geliefert'){ b.geliefert=null; saveBest(); return 'bestellt'; }
  if(stufe==='bestellt'){ b.bestellt=null; saveBest(); return 'gemeldet'; }
  return null;
}

/* Angaben zum verknüpften Material — Hersteller, REF, Lagerort. Ohne
   Verknüpfung leer, ohne dass etwas fehlschlägt. */
function bestMaterial(b){
  if(!b) return null;
  if(b.matKey && typeof canonOf==='function'){ const r=canonOf(b.matKey); if(r) return r; }
  /* Fallback: direkte GTIN-Suche, wenn der Scan eine Nummer geliefert hat. */
  if(b.gtin && typeof GTINDB!=='undefined' && GTINDB[b.gtin]) return GTINDB[b.gtin];
  return null;
}
function bestMatZeile(b){
  const r = bestMaterial(b); if(!r) return '';
  return [r.hersteller, r.ref?('REF '+r.ref):'', r.lagerort?('📍 '+r.lagerort):''].filter(Boolean).join(' · ');
}

/* ═══════════ Die Seite ═══════════ */

let bestForm = null;      /* null | 'neu' | <id> */
let bestZeigeAlt = false;

function bestSeiteHTML(seite, suche){
  const q = String(suche||'').trim().toLowerCase();
  let offen = bestOffen();
  if(q) offen = offen.filter(b=>((b.wort||'')+' '+(b.notiz||'')).toLowerCase().indexOf(q)>=0);
  /* Dringendes zuerst, dann das Älteste — was am längsten wartet, ist am
     ehesten vergessen worden. */
  offen = offen.slice().sort((a,b)=>{
    if(!!a.dringend !== !!b.dringend) return a.dringend ? -1 : 1;
    return String((a.gemeldet&&a.gemeldet.ts)||'').localeCompare(String((b.gemeldet&&b.gemeldet.ts)||''));
  });

  const n1 = offen.filter(b=>bestStufe(b)==='gemeldet').length;
  const n2 = offen.filter(b=>bestStufe(b)==='bestellt').length;

  let html = `<div class="banner"><h2>🛒 ${esc((seite&&seite.wort)||'Bestellungen')}</h2>
    <p>„Ist leer" hier melden statt hinlaufen. Jeder Schritt trägt Kürzel und Uhrzeit — <b>${n1} zu bestellen</b>, <b>${n2} unterwegs</b>.</p>
    <div class="auf-wer">Dein Kürzel: <button type="button" class="auf-krz" onclick="bestUiKuerzel()">${esc(kuerzel()||'— antippen —')}</button></div></div>`;

  if(bestForm==='neu') html += bestFormHTML(null);
  else html += `<button class="add-entry-btn" onclick="bestUiNeu()">＋ „ist leer" melden</button>`;

  if(!offen.length){
    html += `<div class="empty"><div class="ei">🛒</div><h3>${q?'Nichts gefunden':'Nichts offen'}</h3>
      <p>${q?'Kein Treffer.':'Keine offene Meldung. Wer etwas leer sieht, meldet es oben.'}</p></div>`;
  }

  offen.forEach(b=>{
    if(bestForm===b.id){ html += bestFormHTML(b); return; }
    html += bestKarteHTML(b, false);
  });

  const alt = bestErledigt();
  if(alt.length){
    html += `<button type="button" class="add-entry-btn" onclick="bestUiAlt()">${bestZeigeAlt?'⌄':'›'} Erledigt (${alt.length})</button>`;
    if(bestZeigeAlt) alt.slice(0,40).forEach(b=>{ html += bestKarteHTML(b, true); });
  }
  return html;
}

function bestKarteHTML(b, alt){
  const stufe = bestStufe(b);
  const matZeile = bestMatZeile(b);
  const weiterWort = bestWort(stufe, 'tu');
  const schritt = (wo, k)=> k ? `<span class="best-schritt on">${esc(bestWort(wo,'symbol'))} ${esc(bestWort(wo,'wort'))} · ${esc(kuerzelVermerk(k))}</span>`
                              : `<span class="best-schritt">${esc(bestWort(wo,'symbol'))} ${esc(bestWort(wo,'wort'))}</span>`;
  const foto = b.foto ? `<img class="best-karte-foto" src="${esc(b.foto)}" alt="Foto" data-zoom data-cap="${esc(b.wort)}">` : '';
  return `<div class="best-karte best-${esc(stufe)}${alt?' best-alt':''}${b.dringend?' best-dringend':''}" data-i="${esc(b.id)}">
    <div class="best-kopf">
      ${foto}
      <span class="best-wort">${b.dringend?'❗ ':''}${esc(b.wort)}${b.menge?` <span class="best-menge">${esc(b.menge)}</span>`:''}</span>
    </div>
    ${matZeile?`<div class="best-mat">${esc(matZeile)}</div>`:''}
    ${b.notiz?`<div class="best-notiz">${esc(b.notiz)}</div>`:''}
    <div class="best-spur">${schritt('gemeldet',b.gemeldet)}${schritt('bestellt',b.bestellt)}${schritt('geliefert',b.geliefert)}</div>
    <div class="best-akt">
      ${weiterWort?`<button type="button" class="btn btn-pri" data-i="${esc(b.id)}" onclick="bestUiWeiter(this.dataset.i)">${esc(weiterWort)}</button>`:''}
      ${(stufe!=='gemeldet')?`<button type="button" class="btn btn-sec" data-i="${esc(b.id)}" onclick="bestUiZurueck(this.dataset.i)">↺</button>`:''}
      <button type="button" class="btn btn-sec" data-i="${esc(b.id)}" onclick="bestUiBearbeiten(this.dataset.i)">✎</button>
    </div></div>`;
}

function bestFormHTML(b){
  /* Vorschlagsliste aus dem echten Materialbestand — angekreuzt statt
     abgetippt, damit die Meldung eindeutig ist (features/ankreuzen.js liefert
     dieselbe Liste an anderer Stelle). */
  const mats = (typeof pfMaterialien==='function') ? pfMaterialien() : [];
  const liste = mats.slice()
    .sort((a,x)=>(x.vorkommen||0)-(a.vorkommen||0))
    .slice(0, 400)
    .map(m=>`<option value="${esc(m.name)}" data-k="${esc(m.key)}">`).join('');
  /* Beim Bearbeiten das gespeicherte Foto laden, beim Neuanlegen den Scan-Zustand. */
  const fotoSrc = bestScanState.foto || (b && b.foto) || '';
  const fotoBox = fotoSrc
    ? `<div id="bestFotoBox"><img class="best-scan-foto" src="${esc(fotoSrc)}" alt="Foto" data-zoom data-cap="Foto">
        <button type="button" class="btn btn-sec best-foto-clear" onclick="bestScanLoeschen()">✕</button></div>`
    : `<div id="bestFotoBox"></div>`;
  return `<div class="auf-form">
    <div class="flabel">${b?'MELDUNG BEARBEITEN':'WAS IST LEER?'}</div>
    <div class="best-scan-reihe">
      <input class="loc-input" id="bestWort" list="bestMatList" placeholder="Material — tippen oder aus der Liste wählen" value="${esc(b?b.wort:'')}">
      <button type="button" class="btn btn-sec" onclick="bestScanFoto()" title="Etikett fotografieren — GTIN wird automatisch gelesen">📷</button>
    </div>
    <datalist id="bestMatList">${liste}</datalist>
    ${fotoBox}
    <div class="form-row" style="margin-top:8px">
      <input class="loc-input" id="bestMenge" placeholder="Menge (optional)" value="${esc(b?b.menge:'')}" style="flex:0 0 40%">
      <label class="g-check" style="margin:0"><input type="checkbox" id="bestDringend" ${b&&b.dringend?'checked':''}> dringend</label>
    </div>
    <input class="loc-input" id="bestNotiz" placeholder="Hinweis (optional), z. B. „letzte Packung offen"" value="${esc(b?b.notiz:'')}" style="margin-top:8px">
    <div class="p-actions" style="margin-top:10px">
      <button class="btn btn-sec" onclick="bestUiAbbrechen()">Abbrechen</button>
      ${b?`<button class="btn btn-sec" style="color:#d64545" data-i="${esc(b.id)}" onclick="bestUiLoeschen(this.dataset.i)">Löschen</button>`:''}
      <button class="btn btn-pri" data-i="${esc(b?b.id:'')}" onclick="bestUiSpeichern(this.dataset.i)">${b?'Speichern':'Melden'}</button>
    </div></div>`;
}

/* ── Bedienung ── */
function bestUiNeu(){ bestScanState={gtin:null,foto:null}; bestForm='neu'; seiteAuffrischen(); setTimeout(()=>{ const i=$('bestWort'); if(i) i.focus(); },50); }
function bestUiBearbeiten(id){ bestScanState={gtin:null,foto:null}; bestForm=id; seiteAuffrischen(); }
function bestUiAbbrechen(){ bestScanState={gtin:null,foto:null}; bestForm=null; seiteAuffrischen(); }
function bestUiAlt(){ bestZeigeAlt=!bestZeigeAlt; seiteAuffrischen(); }
function bestUiKuerzel(){ if(typeof kuerzelFragen==='function') kuerzelFragen(()=>seiteAuffrischen()); }
function bestUiSpeichern(id){
  const wort = ($('bestWort')&&$('bestWort').value||'').trim();
  if(!wort){ if(typeof toast==='function') toast('Bitte sagen, was leer ist',true); return; }
  /* Steht der Name genau so im Bestand, wird der kanonische Schlüssel
     mitgenommen — dann sind Hersteller, REF und Lagerort eindeutig. */
  let matKey = null;
  if(typeof pfMaterialien==='function'){
    const t = pfMaterialien().find(m=>String(m.name||'').trim().toLowerCase()===wort.toLowerCase());
    if(t) matKey = t.key;
  }
  const felder = { wort, menge:($('bestMenge')&&$('bestMenge').value)||'',
    notiz:($('bestNotiz')&&$('bestNotiz').value)||'',
    dringend:!!($('bestDringend')&&$('bestDringend').checked),
    matKey,
    gtin: bestScanState.gtin || (id ? (bestNach(id)||{}).gtin : null) || null,
    foto: bestScanState.foto || (id ? (bestNach(id)||{}).foto : null) || null };
  const tun = ()=>{
    if(id){ Object.keys(felder).forEach(k=>bestAendern(id,k,felder[k])); }
    else bestMelden(felder);
    bestScanState={gtin:null,foto:null}; bestForm=null; seiteAuffrischen();
    if(typeof toast==='function') toast(id?'Gespeichert':'Gemeldet — im anderen Saal sofort sichtbar');
  };
  if(typeof kuerzelDannn==='function') kuerzelDannn(tun); else tun();
}
function bestUiLoeschen(id){ bestLoeschen(id); bestScanState={gtin:null,foto:null}; bestForm=null; seiteAuffrischen(); if(typeof toast==='function') toast('Meldung entfernt'); }
function bestUiWeiter(id){
  kuerzelDannn(()=>{
    const neu = bestWeiter(id, kuerzel());
    seiteAuffrischen();
    if(typeof toast==='function') toast(neu ? ('Jetzt '+bestWort(neu,'wort')) : 'Schon erledigt');
  });
}
function bestUiZurueck(id){ const neu=bestZurueck(id); seiteAuffrischen(); if(typeof toast==='function') toast(neu?('Zurück auf '+bestWort(neu,'wort')):'Nicht möglich'); }

/* ── Etikett fotografieren — GTIN lesen, Name übernehmen ── */
function bestScanFoto(){
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.setAttribute('capture', 'environment'); inp.style.display = 'none';
  inp.onchange = () => {
    const f = inp.files && inp.files[0];
    try { document.body.removeChild(inp); } catch(e) {}
    if(!f) return;
    const r = new FileReader();
    r.onload = () => bestScanVerarbeiten(r.result);
    r.readAsDataURL(f);
  };
  document.body.appendChild(inp); inp.click();
}

async function bestScanVerarbeiten(dataUrl){
  bestScanState.foto = dataUrl;
  /* Foto sofort zeigen, ohne die ganze Seite neu zu bauen. */
  const box = $('bestFotoBox');
  if(box) box.innerHTML = `<img class="best-scan-foto" src="${esc(dataUrl)}" alt="Foto" data-zoom data-cap="Foto">
    <button type="button" class="btn btn-sec best-foto-clear" onclick="bestScanLoeschen()">✕</button>`;
  if(typeof toast==='function') toast('Barcode lesen …');

  let code = null;
  if(typeof ocrBarcodeFromImage==='function'){
    try{ code = await ocrBarcodeFromImage(dataUrl); }catch(e){}
  }
  if(!code || !code.gtin){
    if(typeof toast==='function') toast('Kein Barcode gefunden — Name bitte von Hand eintragen.', true);
    return;
  }

  const gtin = (typeof gtinKey==='function') ? gtinKey(code.gtin) : String(code.gtin);
  bestScanState.gtin = gtin;

  /* Name aus eigenem Stammsatz, dann Katalog, dann Netz. */
  let name = '';
  const rec = (typeof GTINDB!=='undefined') ? GTINDB[gtin] : null;
  if(rec) name = rec.name || rec.ref || '';
  if(!name && typeof gtinAufloesen==='function'){
    try{ const t = await gtinAufloesen(gtin); if(t) name = t.name || t.ref || ''; }catch(e){}
  }

  const inp = $('bestWort');
  if(inp && name && !inp.value.trim()) inp.value = name;
  if(typeof toast==='function') toast(name ? ('Erkannt: ' + name) : ('GTIN ' + gtin + ' — Name bitte prüfen'));
}

function bestScanLoeschen(){
  bestScanState.foto = null; bestScanState.gtin = null;
  const box = $('bestFotoBox'); if(box) box.innerHTML = '';
}

/* Aus dem Material heraus melden — der kurze Weg aus der Materialzentrale
   und aus dem Pflege-Weg. */
function bestAusMaterial(matKey, name){
  const s = (typeof seitenAlle==='function') ? seitenAlle().find(x=>x.art==='bestellungen') : null;
  if(!s){ if(typeof toast==='function') toast('Es gibt keine Bestell-Seite — in der Verwaltung unter „Seiten" anlegen',true); return; }
  kuerzelDannn(()=>{
    bestMelden({ wort:String(name||matKey||'').trim(), matKey:matKey||null });
    if(typeof curSeg!=='undefined') curSeg = s.id;
    if(typeof setMode==='function') setMode('use');
    seiteAuffrischen();
    if(typeof toast==='function') toast('Gemeldet');
  });
}
