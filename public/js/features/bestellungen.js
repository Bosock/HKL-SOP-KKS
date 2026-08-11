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

/* ─────────────────────────────────────────────────────────────
   DIE MITWACHSENDE BESTELL-DATENBANK (Rückkopplung, „Bestätigung zuerst")

   Der Betreiber: „Da die Materialien immer wiederkehrend sind und dem
   Material, das verbraucht wird, entsprechen, wäre es sinnvoll, kontinuierlich
   abzugleichen — damit man irgendwann ohne Foto die Bestelldaten hat."

   Der Befund: Die verlässliche Bestell-Datenbank existiert längst — sie heißt
   GTINDB (Produkt-Stammsätze) + MATLINK (material_key → Stammsatz). Der
   Bestell-Scan behielt GTIN und Foto aber nur an der EINZELNEN Bestellung; das
   Gelernte versickerte. Jetzt zahlt jeder Scan in den gemeinsamen Stamm ein.

   Vier Takte:
     ① Einzahlung  Jeder Scan legt/ergänzt den Stammsatz (nur leere Felder) und
                   hängt das Foto dort an — wiederverwendbar. Das Paar
                   material_key ↔ GTIN wird als VORSCHLAG notiert.
     ② Reifung     Ein Vorschlag bleibt Vorschlag, bis ein MENSCH ihn einmal
                   bestätigt (→ echte MATLINK-Verknüpfung). „Bestätigung zuerst":
                   maximale Zuverlässigkeit. Ein Widerspruch (schon verlinkt,
                   aber ein anderes Produkt gescannt) wird nie still übernommen,
                   sondern vorgelegt.
     ③ Auszahlung  Ist einmal bestätigt, steht REF/Hersteller/Lagerort/GTIN beim
                   nächsten „ist leer" sofort da — ganz ohne Foto.
     ④ Prüffläche  Ein Admin-Panel zeigt offene Vorschläge und Widersprüche zum
                   Bestätigen oder Verwerfen. Der Mensch behält die Hoheit.

   Grundsatz ①: „leer schlägt falsch" — nichts wird geraten, nichts überschrieben,
   alles ist rücknehmbar (MATLINK ist eine reine Verweis-Ebene).
   ───────────────────────────────────────────────────────────── */

let BESTLERN = (typeof loadJSON==='function') ? loadJSON('hkl_bestlern', {}) : {};
if(!BESTLERN || typeof BESTLERN!=='object' || Array.isArray(BESTLERN)) BESTLERN = {};
function saveBestlern(){ if(typeof saveJSON==='function') saveJSON('hkl_bestlern', BESTLERN); }

/* Der schon bestätigte Stammsatz-Schlüssel eines Materials (oder null). Nutzt
   die bestehende Brücke MATLINK/canonId — dieselbe, die die Materialzentrale
   pflegt. So profitiert die Bestellung von jeder dort gemachten Verknüpfung. */
function bestVerlinkt(matKey){
  if(!matKey) return null;
  if(typeof canonId==='function') return canonId(matKey) || null;
  if(typeof MATLINK!=='undefined' && MATLINK && MATLINK[matKey]) return MATLINK[matKey];
  return null;
}

/* Zustand eines Materials in der Lern-Datenbank. Rein/testbar.
     'verlinkt'    Ein bestätigter Stammsatz steht — Auszahlung möglich.
     'widerspruch' Verlinkt, aber ein ANDERES Produkt wurde gescannt.
     'vorschlag'   Noch nicht verlinkt, aber ein Scan liegt als Vorschlag vor.
     'leer'        Nichts bekannt. */
function bestLernStatus(matKey){
  const linked = bestVerlinkt(matKey);
  const e = BESTLERN[matKey];
  const vor = (e && e.vor) ? Object.keys(e.vor) : [];
  if(linked){
    return vor.some(g=>g!==linked) ? 'widerspruch' : 'verlinkt';
  }
  return vor.length ? 'vorschlag' : 'leer';
}

/* Der stärkste offene Vorschlag (häufigster Scan), der NICHT der schon
   verlinkte ist. Für die Auszahlungs-Zeile und das Prüf-Panel. */
function bestVorschlag(matKey){
  const e = BESTLERN[matKey]; if(!e || !e.vor) return null;
  const linked = bestVerlinkt(matKey);
  const paare = Object.keys(e.vor).filter(g=>g!==linked).map(g=>Object.assign({ gtin:g }, e.vor[g]));
  if(!paare.length) return null;
  paare.sort((a,b)=>(b.n||0)-(a.n||0) || String(b.letzt||'').localeCompare(String(a.letzt||'')));
  return paare[0];
}

/* ① Einzahlung: ein gesehenes Paar material_key ↔ GTIN als Vorschlag notieren.
   Bereits Verworfenes wird nicht erneut vorgeschlagen. Rein bis auf den
   Speicher. */
function bestLernErfassen(matKey, gtin, info){
  if(!matKey || !gtin) return false;
  const f = info || {};
  let e = BESTLERN[matKey];
  if(!e){ e = BESTLERN[matKey] = { vor:{}, weg:[] }; }
  if(!e.vor) e.vor = {}; if(!Array.isArray(e.weg)) e.weg = [];
  if(e.weg.indexOf(gtin) >= 0) return false;   /* schon einmal verworfen */
  const now = new Date().toISOString();
  const v = e.vor[gtin] || { n:0, erst:now };
  v.n += 1; v.letzt = now;
  if(f.name && !v.name) v.name = f.name;
  if(f.ref && !v.ref) v.ref = f.ref;
  if(f.hersteller && !v.hersteller) v.hersteller = f.hersteller;
  e.vor[gtin] = v; saveBestlern();
  return true;
}

/* ② Reifung durch Bestätigung: aus dem Vorschlag wird eine echte Verknüpfung.
   Ab jetzt zahlt die Datenbank ohne Foto aus. */
function bestLernBestaetigen(matKey, gtin){
  if(!matKey || !gtin) return false;
  if(typeof matLinkTo==='function') matLinkTo(matKey, gtin);
  const e = BESTLERN[matKey];
  if(e && e.vor && e.vor[gtin]) delete e.vor[gtin];   /* erfüllt — raus aus den Offenen */
  saveBestlern();
  return true;
}

/* Einen Vorschlag verwerfen: kommt in die „weg"-Liste, damit er nicht wieder
   auftaucht. Ein Fehlscan soll nicht ewig nerven. */
function bestLernVerwerfen(matKey, gtin){
  if(!matKey || !gtin) return false;
  let e = BESTLERN[matKey];
  if(!e){ e = BESTLERN[matKey] = { vor:{}, weg:[] }; }
  if(!e.vor) e.vor = {}; if(!Array.isArray(e.weg)) e.weg = [];
  if(e.vor[gtin]) delete e.vor[gtin];
  if(e.weg.indexOf(gtin) < 0) e.weg.push(gtin);
  saveBestlern();
  return true;
}

/* ③ Auszahlung: die verlässlichen Bestelldaten eines Materials — nur aus einem
   BESTÄTIGTEN Stammsatz. Ohne Bestätigung: null (leer schlägt falsch). */
function bestBestelldaten(matKey){
  const id = bestVerlinkt(matKey); if(!id) return null;
  const r = (typeof GTINDB!=='undefined' && GTINDB) ? GTINDB[id] : null;
  if(!r) return null;
  return { id, gtin:(/^\d+$/.test(String(id))?id:(r.gtin&&/^\d+$/.test(String(r.gtin))?r.gtin:null)),
    name:r.name||'', ref:r.ref||'', hersteller:r.hersteller||'', lagerort:r.lagerort||'' };
}

/* ④ Die Prüfliste: alle Materialien mit offenem Vorschlag oder Widerspruch,
   Häufigstes zuerst. Grundlage für das Admin-Panel und die Zähler. Braucht die
   Materialliste aus den Standards (pfMaterialien). */
function bestLernOffen(){
  const mats = (typeof pfMaterialien==='function') ? pfMaterialien() : [];
  const nameOf = {}; mats.forEach(m=>{ nameOf[m.key] = m.name || m.key; });
  const out = [];
  Object.keys(BESTLERN).forEach(matKey=>{
    const st = bestLernStatus(matKey);
    if(st!=='vorschlag' && st!=='widerspruch') return;
    const v = bestVorschlag(matKey); if(!v) return;
    const prod = (typeof GTINDB!=='undefined' && GTINDB && GTINDB[v.gtin]) ? GTINDB[v.gtin] : null;
    out.push({ matKey, status:st,
      name: nameOf[matKey] || (v.name) || matKey,
      gtin: v.gtin, n: v.n||1,
      produkt: (prod&&prod.name)||v.name||'', ref:(prod&&prod.ref)||v.ref||'',
      hersteller:(prod&&prod.hersteller)||v.hersteller||'',
      altId: bestVerlinkt(matKey) || null });
  });
  return out.sort((a,b)=> (a.status===b.status ? (b.n-a.n) : (a.status==='widerspruch'?-1:1)) );
}

/* Transiente Scan-Ergebnisse für das gerade offene Formular. */
let bestScanState = { gtin: null, foto: null, name:'', ref:'', hersteller:'' };

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

  /* ④ Prüffläche (nur Admin): offene Vorschläge und Widersprüche bestätigen. */
  html += bestLernPanelHTML();

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
      <input class="loc-input" id="bestWort" list="bestMatList" placeholder="Material — tippen oder aus der Liste wählen" value="${esc(b?b.wort:'')}" onchange="bestDatenZeigen()" oninput="bestDatenZeigen()">
      <button type="button" class="btn btn-sec" onclick="bestScanFoto()" title="Etikett fotografieren — GTIN wird automatisch gelesen">📷</button>
    </div>
    <datalist id="bestMatList">${liste}</datalist>
    <div id="bestDaten"></div>
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
function bestScanReset(){ bestScanState = { gtin:null, foto:null, name:'', ref:'', hersteller:'' }; }
function bestUiNeu(){ bestScanReset(); bestForm='neu'; seiteAuffrischen(); setTimeout(()=>{ const i=$('bestWort'); if(i) i.focus(); },50); }
function bestUiBearbeiten(id){ bestScanReset(); bestForm=id; seiteAuffrischen(); setTimeout(()=>{ if(typeof bestDatenZeigen==='function') bestDatenZeigen(); },50); }
function bestUiAbbrechen(){ bestScanReset(); bestForm=null; seiteAuffrischen(); }
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
  const gtin = bestScanState.gtin || (id ? (bestNach(id)||{}).gtin : null) || null;
  const felder = { wort, menge:($('bestMenge')&&$('bestMenge').value)||'',
    notiz:($('bestNotiz')&&$('bestNotiz').value)||'',
    dringend:!!($('bestDringend')&&$('bestDringend').checked),
    matKey, gtin,
    foto: bestScanState.foto || (id ? (bestNach(id)||{}).foto : null) || null };
  const tun = ()=>{
    if(id){ Object.keys(felder).forEach(k=>bestAendern(id,k,felder[k])); }
    else bestMelden(felder);
    /* ① Einzahlung: Name↔GTIN als Vorschlag notieren, sofern beides feststeht
       und noch nicht bestätigt verlinkt. Das ist die Saat für „ohne Foto". */
    if(matKey && gtin && bestLernStatus(matKey)!=='verlinkt'){
      bestLernErfassen(matKey, gtin, { name:bestScanState.name, ref:bestScanState.ref, hersteller:bestScanState.hersteller });
    }
    bestScanReset(); bestForm=null; seiteAuffrischen();
    if(typeof toast==='function') toast(id?'Gespeichert':'Gemeldet — im anderen Saal sofort sichtbar');
  };
  if(typeof kuerzelDannn==='function') kuerzelDannn(tun); else tun();
}
function bestUiLoeschen(id){ bestLoeschen(id); bestScanReset(); bestForm=null; seiteAuffrischen(); if(typeof toast==='function') toast('Meldung entfernt'); }
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

  /* Name/REF/Hersteller: eigener Stammsatz zuerst, dann Katalog, dann Netz.
     Die Auflösung liefert die Herkunft mit — Netz-Treffer sind „unbestätigt". */
  let name = '', ref = '', hersteller = '', herkunft = 'stammsatz';
  const rec = (typeof GTINDB!=='undefined') ? GTINDB[gtin] : null;
  if(rec){ name = rec.name || ''; ref = rec.ref || ''; hersteller = rec.hersteller || ''; }
  if((!name || !ref || !hersteller) && typeof gtinAufloesen==='function'){
    try{ const t = await gtinAufloesen(gtin);
      if(t){ if(!name) name = t.name || ''; if(!ref) ref = t.ref || ''; if(!hersteller) hersteller = t.hersteller || '';
        herkunft = t.herkunft || herkunft; }
    }catch(e){}
  }

  bestScanState.name = name; bestScanState.ref = ref; bestScanState.hersteller = hersteller;

  /* ① Einzahlung in den gemeinsamen Stamm: Stammsatz anlegen/ergänzen (nur
     leere Felder) und das Foto dort anhängen — ab jetzt für jeden nutzbar,
     nicht nur an dieser einen Bestellung. */
  bestStammEinzahlen(gtin, { name, ref, hersteller, herkunft, foto:dataUrl });

  const inp = $('bestWort');
  if(inp && name && !inp.value.trim()) inp.value = name;
  /* Der Name steht jetzt vielleicht fest → prüfen, ob es schon verlässliche
     Bestelldaten oder einen früheren Vorschlag gibt. */
  if(typeof bestDatenZeigen==='function') bestDatenZeigen();
  if(typeof toast==='function') toast(name ? ('Erkannt: ' + name + (ref?(' · REF '+ref):'')) : ('GTIN ' + gtin + ' — Name bitte prüfen'));
}

/* Legt einen Stammsatz zu einer GTIN an oder ergänzt ihn — ausschließlich leere
   Felder, nie überschreibend. Web-Treffer werden als „unbestätigt" markiert.
   Das Foto kommt an die Fotoliste des Stammsatzes (matPhotoAdd, ohne Dubletten).
   So wächst dieselbe Produktdatenbank, die auch der Etikett-Scanner pflegt. */
function bestStammEinzahlen(gtin, f){
  if(!gtin || typeof GTINDB==='undefined') return null;
  f = f || {};
  const now = new Date().toISOString();
  let r = GTINDB[gtin];
  if(!r){
    r = GTINDB[gtin] = { gtin, name:'', hersteller:null, ref:null, verwendung:null,
      french:null, laenge:null, dAussen:null, dInnen:null, weitere:null,
      lagerort:null, preis:null, photo:null, fotos:[], props:{},
      createdAt:now, updatedAt:now };
    /* Ein frisch aus dem Netz geborener Satz ist unbestätigt — bis ihn jemand
       im Etikett-Scanner prüft. */
    if(f.herkunft && f.herkunft!=='stammsatz') r.quelle = (f.herkunft==='katalog') ? 'Referenz-Katalog' : 'AccessGUDID (NLM)';
  }
  if(f.name && !r.name) r.name = f.name;
  if(f.ref && !r.ref) r.ref = f.ref;
  if(f.hersteller && !r.hersteller) r.hersteller = f.hersteller;
  if(f.foto){
    if(typeof matPhotoAdd==='function'){ r.fotos = matPhotoAdd(r.fotos, f.foto, 'Bestell-Scan'); }
    if(!r.photo) r.photo = f.foto;
  }
  r.updatedAt = now;
  if(typeof saveGtinDB==='function') saveGtinDB();
  return r;
}

function bestScanLoeschen(){
  bestScanState.foto = null; bestScanState.gtin = null;
  bestScanState.name = ''; bestScanState.ref = ''; bestScanState.hersteller = '';
  const box = $('bestFotoBox'); if(box) box.innerHTML = '';
}

/* Löst den eingetippten/gewählten Namen zu einem material_key auf (exakter
   Treffer im Bestand). */
function bestNameZuKey(wort){
  const w = String(wort||'').trim().toLowerCase(); if(!w) return null;
  if(typeof pfMaterialien!=='function') return null;
  const t = pfMaterialien().find(m=>String(m.name||'').trim().toLowerCase()===w);
  return t ? t.key : null;
}

/* ③ Auszahlung im Formular: sobald der Name feststeht, zeigen wir, was die
   Datenbank schon weiß. Bestätigt → verlässliche Zeile, GTIN wandert
   automatisch mit (kein Foto nötig). Nur Vorschlag → als solcher benannt,
   mit einem Knopf zum Übernehmen. Leer → nichts (leer schlägt falsch). */
function bestDatenZeigen(){
  const slot = $('bestDaten'); if(!slot) return;
  const wort = ($('bestWort') && $('bestWort').value) || '';
  const key = bestNameZuKey(wort);
  if(!key){ slot.innerHTML = ''; return; }
  const d = bestBestelldaten(key);
  if(d){
    /* Verlässlich: die GTIN an die Bestellung hängen, ohne Foto. Ein frisch
       gescanntes Foto bleibt aber erhalten, wenn eins gemacht wurde. */
    if(!bestScanState.gtin && d.id) bestScanState.gtin = d.id;
    const teile = [d.hersteller, d.ref?('REF '+d.ref):'', d.gtin?('GTIN '+d.gtin):''].filter(Boolean).join(' · ');
    slot.innerHTML = `<div class="best-daten best-daten-ok">✓ Bestelldaten bekannt${teile?(' — '+esc(teile)):''}<span class="best-daten-sub">kein Foto nötig</span></div>`;
    return;
  }
  const v = bestVorschlag(key);
  if(v){
    const prod = (typeof GTINDB!=='undefined' && GTINDB && GTINDB[v.gtin]) ? GTINDB[v.gtin] : null;
    const wer = (prod&&prod.name)||v.name||('GTIN '+v.gtin);
    slot.innerHTML = `<div class="best-daten best-daten-vor">📎 Vorschlag aus früherem Scan: <b>${esc(wer)}</b>
      <button type="button" class="btn btn-sec best-daten-btn" data-k="${esc(key)}" data-g="${esc(v.gtin)}" onclick="bestVorschlagUebernehmen(this.dataset.k,this.dataset.g)">übernehmen</button>
      <span class="best-daten-sub">wird als Bestelldatum bestätigt</span></div>`;
    return;
  }
  slot.innerHTML = '';
}

/* Aus dem Formular heraus einen Vorschlag bestätigen (Reifung ②). Danach ist
   das Material verlinkt und die Zeile zeigt die verlässlichen Daten. */
function bestVorschlagUebernehmen(key, gtin){
  bestLernBestaetigen(key, gtin);
  bestScanState.gtin = gtin;
  bestDatenZeigen();
  if(typeof toast==='function') toast('Bestätigt — ab jetzt ohne Foto');
}

/* ── ④ Prüffläche: das Admin-Panel ──────────────────────────────────────────
   Nur für Angemeldete. Hier reift der Vorschlag zur verlässlichen Verknüpfung.
   Ein Widerspruch (schon verlinkt, aber ein anderes Produkt gescannt) steht
   oben und rot — genau der Fall, den man nicht still übernehmen darf. */
let bestZeigeLern = false;
function bestUiLernPanel(){ bestZeigeLern = !bestZeigeLern; seiteAuffrischen(); }

function bestLernPanelHTML(){
  if(typeof ADMIN==='undefined' || !ADMIN) return '';
  const offen = bestLernOffen();
  if(!offen.length) return '';
  const kopf = `<button type="button" class="add-entry-btn" onclick="bestUiLernPanel()">${bestZeigeLern?'⌄':'›'} Bestell-Stammdaten prüfen (${offen.length})</button>`;
  if(!bestZeigeLern) return kopf;
  const zeilen = offen.map(o=>{
    const prod = [o.produkt, o.ref?('REF '+o.ref):'', o.hersteller].filter(Boolean).join(' · ');
    const wid = (o.status==='widerspruch');
    return `<div class="best-lern-zeile${wid?' best-lern-wid':''}">
      <div class="best-lern-txt">
        <div class="best-lern-name">${wid?'⚠ ':''}${esc(o.name)}</div>
        <div class="best-lern-prod">${wid?'schon verlinkt — neuer Scan: ':''}${esc(prod||('GTIN '+o.gtin))}${o.n>1?` · ${o.n}×`:''}</div>
      </div>
      <div class="best-lern-akt">
        <button type="button" class="btn btn-pri" data-k="${esc(o.matKey)}" data-g="${esc(o.gtin)}" onclick="bestUiLernBestaetigen(this.dataset.k,this.dataset.g)">Bestätigen</button>
        <button type="button" class="btn btn-sec" data-k="${esc(o.matKey)}" data-g="${esc(o.gtin)}" onclick="bestUiLernVerwerfen(this.dataset.k,this.dataset.g)">Verwerfen</button>
      </div></div>`;
  }).join('');
  return kopf + `<div class="best-lern-panel">
    <p class="best-lern-hilfe">Bestätigt = das Material bekommt ab sofort seine Bestelldaten ohne Foto. Verworfen = der Scan war ein Versehen und taucht nicht wieder auf.</p>
    ${zeilen}</div>`;
}

function bestUiLernBestaetigen(key, gtin){
  bestLernBestaetigen(key, gtin);
  seiteAuffrischen();
  if(typeof toast==='function') toast('Bestätigt — dieses Material braucht ab jetzt kein Foto mehr');
}
function bestUiLernVerwerfen(key, gtin){
  bestLernVerwerfen(key, gtin);
  seiteAuffrischen();
  if(typeof toast==='function') toast('Vorschlag verworfen');
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
