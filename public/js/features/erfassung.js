/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — GEFÜHRTE NEUANLAGE („Was ist das?" → Kategorie → Kennung →
   Merkmale → Kontrolle)

   Betreiber-Vorgabe (Schaubild „Workflow Einträge", 04.11.2026):
     · JEDER neue Eintrag fragt zuerst, WAS er ist: Material, Gerät,
       Medikament, Hinweis, Anweisung, Überschrift, Personal … — einmal
       antippen (Einfachauswahl), eigene Arten lassen sich direkt anlegen.
     · Nur bei MATERIAL folgen vier Schritte:
         ① Kategorie (Pflicht, VOR jeder GTIN/REF) — mit „＋ Neue Kategorie"
         ② Kennung: GTIN, REF und Hersteller — exakt, mit Quelle
         ③ Merkmale: die Felder DIESER Kategorie, vom Etikett gesucht
         ④ Kontrolle und Speichern
     · Kategorie und Materialklasse sind EIN Feld (klasse = Schlüssel,
       kategorie = Bezeichnung am Stammsatz).

   Was dahinter gegen Doppelarbeit sorgt:
     · EIN Etikettfoto bedient ② und ③ — nichts wird zweimal fotografiert.
     · Steht die GTIN oder REF schon im Bestand, wird der vorhandene
       Stammsatz angeboten statt ein zweiter angelegt.
     · Der Hersteller ist eine Auswahl (keine Schreibvarianten) und wird,
       wo möglich, aus dem GTIN-Präfix früherer Produkte vorgeschlagen.
     · Die Felder je Kategorie sind pflegbar (Kategorien & Felder, auch aus
       Schritt ③ heraus) — ohne Entwickler (Grundsatz A7). Die mitgelieferten
       Vorlagen (data/merkmale.json) bleiben unangetastet; Änderungen liegen
       als Overlay in hkl_kattpl (Grundsatz ⑦).

   Erscheint nur, wo neuFrei('erfassung') gilt — zuerst im Neuaufbau
   (Grundsatz ⑩). Im Bestand bleibt alles wie bisher.
   ───────────────────────────────────────────────────────────── */

/* Ist die geführte Neuanlage hier eingeschaltet? */
function erfAktiv(){ return typeof neuFrei==='function' && neuFrei('erfassung'); }

/* ═══════════ 1. Kategorien & Felder: Overlay über den Merkmalskatalog ═══════════
   KATTPL = {
     klassen:  { <id>: { label?, neu?:true, dazu?:[mid], aus?:[mid], diff?:[mid] } },
     merkmale: { <mid>: { label, typ, einheit?, werte?, anker?:[] } }   // eigene Merkmale
   }
   „diff" sind die Differenzierungsmerkmale — sie unterscheiden Varianten und
   bilden den Namensvorschlag. Ohne eigene Angabe gelten die Leitmerkmale des
   Katalogs (klasse.leit). */
let KATTPL = (typeof loadJSON==='function') ? loadJSON('hkl_kattpl', null) : null;
function kattplNormal(t){
  const o = (t && typeof t==='object' && !Array.isArray(t)) ? t : {};
  if(!o.klassen || typeof o.klassen!=='object' || Array.isArray(o.klassen)) o.klassen = {};
  if(!o.merkmale || typeof o.merkmale!=='object' || Array.isArray(o.merkmale)) o.merkmale = {};
  return o;
}
KATTPL = kattplNormal(KATTPL);

/* Suchmuster für ein EIGENES Merkmal. Bewusst nur „hinter der Beschriftung"
   (nur_anker): ein frei angelegtes Merkmal ohne Beschriftung auf dem Etikett
   zu suchen, ergäbe Zufallstreffer (leer schlägt falsch). Rein. */
function erfMerkmalMuster(d){
  const esc2 = s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  if(d.typ==='ja_nein'){
    const w = (d.anker&&d.anker.length?d.anker:[d.label]).filter(Boolean);
    const abbild = {}; w.forEach(x=>{ abbild[String(x).toUpperCase().replace(/\s+/g,' ')]='ja'; });
    return { muster: w.map(x=>'\\b('+esc2(x)+')\\b'), abbild, nur_anker:false, anker:[] };
  }
  /* Text: genau EIN Wort hinter der Beschriftung. Der Etikettentext kommt
     ohne Zeilenumbrüche an (merkNormText) — ein längeres Muster liefe in die
     nächste Zeile hinein. Ein Wort ist knapp, aber nie falsch zusammengesetzt. */
  if(d.typ==='text') return { muster:['^\\s*[:=]?\\s*([A-Za-z0-9ÄÖÜäöü][A-Za-z0-9ÄÖÜäöüß.\\/-]{0,29})'], nur_anker:true };
  return { nur_anker:true };           /* mass/zahl: Einheiten-/Zahlmuster kommt aus merkmale.js */
}

/* Katalog + Overlay → wirksamer Katalog. Rein & testbar. Die Quelle wird
   nicht verändert. */
function katMitVorlagen(quelle, tpl){
  if(!quelle || !Array.isArray(quelle.merkmale)) return quelle;
  const t = kattplNormal(tpl ? JSON.parse(JSON.stringify(tpl)) : {});
  const kl = t.klassen, mm = t.merkmale;
  const klassen = (quelle.klassen||[]).map(k=>{
    const v = kl[k.id]; if(!v) return k;
    const n = Object.assign({}, k);
    if(v.label) n.label = v.label;
    if(Array.isArray(v.diff)) n.leit = v.diff.slice();
    return n;
  });
  Object.keys(kl).forEach(id=>{
    const v = kl[id];
    if(!v || !v.neu || klassen.some(k=>k.id===id)) return;
    const label = v.label || id;
    klassen.push({ id, label, worte:[String(label).toLowerCase()].concat(Array.isArray(v.worte)?v.worte:[]), leit:Array.isArray(v.diff)?v.diff.slice():[], eigen:true });
  });
  const inKlasse = (mid, orig)=>{
    const s = {}; (orig||[]).forEach(x=>{ s[x]=1; });
    Object.keys(kl).forEach(id=>{ const v=kl[id]||{};
      if(Array.isArray(v.dazu) && v.dazu.indexOf(mid)>=0) s[id]=1;
      if(Array.isArray(v.aus) && v.aus.indexOf(mid)>=0) delete s[id]; });
    return Object.keys(s);
  };
  const merkmale = quelle.merkmale.map(d=>{
    const ks = inKlasse(d.id, d.klassen);
    return (ks.join('|')===(d.klassen||[]).join('|')) ? d : Object.assign({}, d, { klassen:ks });
  });
  Object.keys(mm).forEach(mid=>{
    const v = mm[mid]; if(!v || !v.label || merkmale.some(d=>d.id===mid)) return;
    const anker = (Array.isArray(v.anker)&&v.anker.length ? v.anker : [v.label]).map(a=>String(a).toLowerCase()).filter(Boolean);
    const d = { id:mid, label:v.label, kurz:v.label, typ:v.typ||'text', einheit:v.einheit||null,
      rang:35, eigen:true, klassen:inKlasse(mid, []), anker };
    if(Array.isArray(v.werte) && v.werte.length) d.werte = v.werte.slice();
    Object.assign(d, erfMerkmalMuster(Object.assign({}, v, { anker:v.anker })));
    if(d.typ!=='ja_nein') d.anker = anker;
    merkmale.push(d);
  });
  return Object.assign({}, quelle, { klassen, merkmale });
}
/* Overlay auf den geladenen Katalog legen (nach Laden, Abgleich, Änderung). */
function erfVorlagenAnwenden(){
  KATTPL = kattplNormal(KATTPL);
  if(typeof MERKKAT_QUELLE!=='undefined' && MERKKAT_QUELLE) MERKKAT = katMitVorlagen(MERKKAT_QUELLE, KATTPL);
}
function saveKattpl(){ if(typeof saveJSON==='function') saveJSON('hkl_kattpl', KATTPL); erfVorlagenAnwenden(); }
/* Nach einem Abgleich mit dem Server (core/sync.js). */
function erfVorlagenLaden(){ KATTPL = kattplNormal((typeof loadJSON==='function')?loadJSON('hkl_kattpl', null):null); erfVorlagenAnwenden(); }

/* Alle wählbaren Kategorien (ohne „Allgemein"), alphabetisch. Rein. */
function erfKategorien(kat){
  return ((kat&&kat.klassen)||[]).filter(k=>k && k.id!=='allgemein')
    .slice().sort((a,b)=>String(a.label).localeCompare(String(b.label),'de'));
}
/* Die Felder einer Kategorie: Differenzierungsmerkmale zuerst, dann die
   übrigen eigenen, zuletzt die allgemeinen (steril, Einmal …). Rein. */
function erfFelder(kat, klasseId){
  const k = ((kat&&kat.klassen)||[]).find(x=>x.id===klasseId) || { leit:[] };
  const diff = Array.isArray(k.leit) ? k.leit : [];
  const alle = ((kat&&kat.merkmale)||[]).filter(d=>(d.klassen||[]).indexOf(klasseId)>=0 || (d.klassen||[]).indexOf('allgemein')>=0);
  const rang = d=>(d.rang||99);
  const eigen = alle.filter(d=>(d.klassen||[]).indexOf(klasseId)>=0);
  return {
    diff: diff.map(id=>eigen.find(d=>d.id===id)).filter(Boolean),
    weitere: eigen.filter(d=>diff.indexOf(d.id)<0).sort((a,b)=>rang(a)-rang(b)),
    allgemein: alle.filter(d=>(d.klassen||[]).indexOf(klasseId)<0).sort((a,b)=>rang(a)-rang(b)),
  };
}

/* ═══════════ 2. Reine Helfer der Kennung ═══════════ */

/* Hersteller aus dem GTIN-Präfix: Die vorderen Stellen einer GTIN gehören
   dem Hersteller (GS1-Basisnummer, 7–10 Stellen). Gesucht wird unter den
   schon erfassten Produkten das mit der längsten gemeinsamen Ziffernfolge
   (ab 7 Stellen nach der Indikatorziffer). Nennen alle so nahen Produkte
   denselben Hersteller, ist das der Vorschlag — sonst keiner. Rein. */
function erfHerstellerAusGtin(db, gtin){
  const g = String(gtin||'').replace(/\D/g,'');
  if(g.length<8) return null;
  const kern = s=>{ s=String(s||'').replace(/\D/g,''); return s.length===14 ? s.slice(1) : (s.length===13 ? s : ''); };
  const k = kern(g.length<13 ? ('0'.repeat(13-g.length)+g) : g);
  if(!k) return null;
  let best=0, namen={};
  Object.keys(db||{}).forEach(id=>{
    const r = db[id]; if(!r || !r.hersteller) return;
    const k2 = kern(r.gtin||id); if(!k2 || k2===k) return;
    let n=0; while(n<k.length && k[n]===k2[n]) n++;
    if(n<7) return;
    if(n>best){ best=n; namen={}; }
    if(n===best) namen[String(r.hersteller).trim()]=1;
  });
  const liste = Object.keys(namen);
  return (best>=7 && liste.length===1) ? { hersteller:liste[0], stellen:best } : null;
}

/* Herstellerliste für die Auswahl: gepflegte Liste + bereits verwendete
   Namen, ohne Schreibvarianten (Groß/Klein, Leerzeichen). Rein. */
function erfHerstellerListe(gepflegt, db){
  const out=[], seen={};
  const add=(n)=>{ const s=String(n||'').replace(/\s+/g,' ').trim(); if(!s) return; const k=s.toLowerCase(); if(seen[k]) return; seen[k]=1; out.push(s); };
  (gepflegt||[]).forEach(add);
  Object.keys(db||{}).forEach(id=>{ if(db[id]) add(db[id].hersteller); });
  return out.sort((a,b)=>a.localeCompare(b,'de'));
}
/* Gelesenen Herstellernamen auf die Listen-Schreibweise bringen. Rein. */
function erfHerstellerKanon(name, liste){
  const s=String(name||'').replace(/\s+/g,' ').trim(); if(!s) return '';
  const t=(liste||[]).find(x=>x.toLowerCase()===s.toLowerCase());
  return t || s;
}

/* Namensvorschlag aus Kategorie + Differenzierungsmerkmalen. Rein. */
function erfNameVorschlag(klasseLabel, diffDefs, werte){
  const teile=[];
  (diffDefs||[]).forEach(d=>{ const v=werte&&werte[d.id]; if(v==null||v==='') return;
    teile.push(String(v)+(d.einheit && !/[a-zA-Z°%"″]$/.test(String(v)) ? (' '+d.einheit) : '')); });
  const kopf=String(klasseLabel||'').replace(/\s*\(.*?\)\s*/g,' ').split('/')[0].trim();
  return [kopf].concat(teile).filter(Boolean).join(' · ');
}

/* Welche Arten stehen zur Wahl? Im Standard alle; in der Materialverwaltung
   nur, was beschafft wird (Material, Gerät und eigene beschaffbare). Rein. */
function erfArtenFuer(ort, liste){
  const l=(liste||[]);
  return ort==='verwaltung' ? l.filter(n=>n && n.beschaffbar) : l.slice();
}
/* Läuft diese Art durch die Material-Schritte? Alles Beschaffbare außer dem
   Gerät (das ist ein Exemplar, kein Verbrauchsartikel — features/geraete.js). */
function erfIstMaterialArt(n){ return !!(n && n.beschaffbar && n.key!=='geraet'); }

/* Herkunft eines Wertes als Klartext. Verglichen wird nur der Schlüssel
   (q.art), das Wort dient der Anzeige (Grundsatz ④). Rein. */
function erfQuelleWort(q){
  if(!q || !q.art) return '';
  const w = { barcode:'Barcode (exakt)', hand:'von Hand', bestaetigt:'Etikett · von Ihnen bestätigt',
    praefix:'aus der GTIN (gleiche Herstellernummer wie bereits erfasste Produkte) – bitte bestätigen',
    nachschlag:'Nachschlag' }[q.art];
  if(q.art==='etikett'){
    return (q.wie && q.wie!=='roh' && typeof refWieLabel==='function') ? ('Etikett · '+refWieLabel(q.wie)) : 'Etikett (gelesen) – bitte vergleichen';
  }
  if(q.art==='nachschlag' && q.text) return q.text;
  return w || '';
}

/* Was fehlt vor dem Speichern? Rein. Rückgabe: Liste der Feldschlüssel. */
function erfFehlt(erf){
  const f=[];
  if(!erf || !erf.klasse) f.push('klasse');
  if(!erf || (!erf.ohneGtin && !erf.gtin)) f.push('gtin');
  if(erf && erf.gtin && !erf.ohneGtin && typeof gtinPruefzifferOk==='function' && !gtinPruefzifferOk(erf.gtin)) f.push('pruefziffer');
  if(!erf || (!String(erf.ref||'').trim() && !erf.ohneRef)) f.push('ref');
  if(!erf || !String(erf.hersteller||'').trim()) f.push('hersteller');
  return f;
}

/* ═══════════ 3. Ablauf und Zustand ═══════════ */

let ERF=null;
const ERF_SCHRITTE=[
  { id:'kategorie', titel:'Kategorie' },
  { id:'kennung',   titel:'GTIN · REF · Hersteller' },
  { id:'merkmale',  titel:'Merkmale' },
  { id:'kontrolle', titel:'Kontrolle' },
];
const ERF_MAX_FOTOS=3;

/* Einstieg — aus dem Standard ({ort:'standard', sid, ri, uk, seg}) oder der
   Materialverwaltung ({ort:'verwaltung', gtin?, itemRef?}). */
function erfStart(ziel){
  if(typeof ADMIN!=='undefined' && !ADMIN){ if(typeof promptLoginThen==='function'){ promptLoginThen(()=>erfStart(ziel)); return; } }
  ziel = ziel || { ort:'verwaltung' };
  const arten = erfArtenFuer(ziel.ort, (typeof natList==='function')?natList():[]);
  const vor = ziel.defaultNat || '';
  const knopf = n=>`<button type="button" class="erf-art${n.key===vor?' vor':''}" data-k="${esc(n.key)}" onclick="erfArtWahl(this.dataset.k)">
      <span class="erf-art-i">${esc(n.icon||'•')}</span><span class="erf-art-l">${esc(n.label)}</span></button>`;
  const h=`<div class="sheet-grip"></div><div class="sheet-title">Was ist das?</div>
    <p class="hint" style="margin:0 0 10px">Einmal antippen. Nur bei Material folgen die Schritte Kategorie → GTIN/REF/Hersteller → Merkmale → Kontrolle.</p>
    <div class="erf-arten" role="list">${arten.map(knopf).join('')}</div>
    <button type="button" class="wiz-link" onclick="erfArtNeuZeigen()">＋ Neue Art anlegen</button>
    <div class="form-row" id="erfArtNeu" style="display:none;margin-top:8px"><input class="loc-input" id="erfArtNeuInp" placeholder="z. B. Anweisung, Personal"><button type="button" class="add-btn" onclick="erfArtNeuSpeichern()">Anlegen</button></div>
    <button class="sheet-close" onclick="showSheet(false)">Abbrechen</button>`;
  ERF={ ziel, art:null };
  $('sheet').innerHTML=h; showSheet(true);
}
function erfArtNeuZeigen(){ const r=$('erfArtNeu'); if(r){ r.style.display=''; const i=$('erfArtNeuInp'); if(i) i.focus(); } }
function erfArtNeuSpeichern(){
  const inp=$('erfArtNeuInp'); const label=(inp&&inp.value||'').trim();
  if(!label){ if(inp) inp.focus(); return; }
  const key=natSlug(label);
  const farbe=(typeof UK_PALETTE!=='undefined')?UK_PALETTE[NATCFG.order.length%UK_PALETTE.length]:'#7f95ab';
  NATCFG.items[key]={ key, label, color:farbe, icon:'🏷️', builtin:false, beschaffbar:!!(ERF&&ERF.ziel&&ERF.ziel.ort==='verwaltung') };
  NATCFG.order.push(key); saveNatCfg(); applyNatConfig();
  toast('Art „'+label+'" angelegt');
  erfArtWahl(key);
}
/* Die Art ist gewählt — verzweigen. */
function erfArtWahl(key){
  if(!ERF) return;
  const z=ERF.ziel; const n=natOf(key);
  showSheet(false);
  if(erfIstMaterialArt(n)){ erfMaterialStart(z, key); return; }
  if(z.ort==='standard'){
    openEntryForm({ kind:'add', sid:z.sid, ri:z.ri, defaultNat:key, defaultUk:z.uk||'', defaultSeg:z.seg||null });
    return;
  }
  erfGeraetBlatt(z);
}

/* Gerät aus der Materialverwaltung: vorerst die Leitfelder (Bezeichnung,
   Hersteller, Modell). Ein eigener, genormter Geräte-Ablauf ist mit dem
   Betreiber noch zu klären (Notiz 04.11.2026). */
function erfGeraetBlatt(z){
  const h=`<div class="sheet-grip"></div><div class="sheet-title">Neues Gerät</div>
    <div class="flabel">BEZEICHNUNG *</div><input class="loc-input" id="erfGerName" placeholder="z. B. Rhythmia HDx">
    <div class="flabel">HERSTELLER</div><input class="loc-input" id="erfGerHerst" list="erfHerstListe" placeholder="z. B. Boston Scientific">
    <datalist id="erfHerstListe">${erfHerstellerListe((typeof bezHersteller==='function')?bezHersteller():[], (typeof GTINDB!=='undefined')?GTINDB:{}).map(x=>`<option value="${esc(x)}">`).join('')}</datalist>
    <div class="flabel">MODELL / TYP</div><input class="loc-input" id="erfGerModell" placeholder="z. B. HDx">
    <p class="hint">Weitere Angaben (Inventarnummer, Saal, Prüftermin …) unter Material → Geräte.</p>
    <div class="sheet-pick" style="margin-top:12px"><button class="sheet-pick-btn" onclick="erfGeraetSpeichern()">Gerät anlegen</button></div>
    <button class="sheet-close" onclick="showSheet(false)">Abbrechen</button>`;
  ERF={ ziel:z, art:'geraet' };
  $('sheet').innerHTML=h; showSheet(true);
}
function erfGeraetSpeichern(){
  const v=id=>(($(id)||{}).value||'').trim();
  const name=v('erfGerName'); if(!name){ toast('Bitte eine Bezeichnung eingeben', true); return; }
  const key=name.toLowerCase();
  if(typeof geraetSetzen==='function') geraetSetzen(key, { name, hersteller:v('erfGerHerst'), modell:v('erfGerModell') });
  showSheet(false); toast('Gerät angelegt');
  if(typeof openScanHub==='function') openScanHub();
}

/* ── Material: der Assistent ── */
function erfMaterialStart(ziel, art){
  ERF={ ziel, art, schritt:0, klasse:'', katSuche:'',
    gtin:'', ohneGtin:false, ref:'', ohneRef:false, hersteller:'', name:'', nameVonHand:false,
    quelle:{}, merk:{}, merkQuelle:{}, merkVonHand:{}, mehrdeutig:[], extra:[],
    fotos:[], fotoErg:[], erg:null, text:'', refVorschlaege:[], vorhanden:null, refDup:[], busy:'' };
  if(ziel.gtin){ ERF.gtin=String(ziel.gtin); ERF.quelle.gtin={ art:'barcode' }; }
  if(ziel.itemRef){ ERF.ref=String(ziel.itemRef); ERF.quelle.ref={ art:'barcode' }; }
  erfZeichnen();
  show('scr-form');
}
function erfAbbrechen(){
  const z=ERF&&ERF.ziel; ERF=null;
  if(z && z.ort==='standard' && typeof reRenderDetail==='function') reRenderDetail();
  else if(typeof openScanHub==='function') openScanHub();
}
function erfZurueck(){ if(!ERF) return; if(ERF.schritt===0){ erfAbbrechen(); return; } erfLesen(); ERF.schritt--; erfZeichnen(); }
function erfWeiter(){
  if(!ERF) return; erfLesen();
  const id=ERF_SCHRITTE[ERF.schritt].id;
  if(id==='kategorie' && !ERF.klasse){ toast('Bitte zuerst die Kategorie wählen.', true); return; }
  if(id==='kennung'){
    if(!ERF.ohneGtin && ERF.gtin && typeof gtinPruefzifferOk==='function' && !gtinPruefzifferOk(ERF.gtin)){
      toast('Die GTIN hat eine falsche Prüfziffer – bitte vergleichen (Zahlendreher?).', true); return; }
    if(!ERF.ohneGtin && !ERF.gtin){ toast('Bitte die GTIN erfassen – oder „Keine GTIN auf der Verpackung" ankreuzen.', true); return; }
  }
  ERF.schritt=Math.min(ERF.schritt+1, ERF_SCHRITTE.length-1);
  if(ERF_SCHRITTE[ERF.schritt].id==='merkmale' && !ERF.name && !ERF.nameVonHand) erfNameAuffrischen();
  erfZeichnen();
}

/* Formularfelder des aktuellen Schritts in den Zustand übernehmen. */
function erfLesen(){
  if(!ERF) return;
  const v=id=>{ const el=$(id); return el?String(el.value||'').trim():null; };
  const c=id=>{ const el=$(id); return el?!!el.checked:null; };
  const g=v('erfGtin'); if(g!==null) ERF.gtin=(typeof gtinKey==='function')?gtinKey(g):g;
  const og=c('erfOhneGtin'); if(og!==null) ERF.ohneGtin=og;
  const r=v('erfRef'); if(r!==null){ if(r!==ERF.ref){ ERF.quelle.ref=r?{ art:'hand' }:null; } ERF.ref=r; }
  const or=c('erfOhneRef'); if(or!==null) ERF.ohneRef=or;
  const hs=$('erfHerst');
  if(hs){ let h=String(hs.value||''); if(h==='__neu'){ h=v('erfHerstNeu')||''; }
    if(h!==ERF.hersteller){ ERF.quelle.hersteller=h?{ art:'hand' }:null; } ERF.hersteller=h; }
  const n=v('erfName'); if(n!==null){ if(n!==ERF.name) ERF.nameVonHand=!!n; ERF.name=n; }
  document.querySelectorAll('#erfMerk .merk-f[data-mid]').forEach(el=>{
    const id=el.dataset.mid; const w=String(el.value||'').trim();
    if(w!==(ERF.merk[id]||'')){ ERF.merkVonHand[id]=true; ERF.merkQuelle[id]=w?'von Hand':''; }
    if(w) ERF.merk[id]=w; else delete ERF.merk[id];
  });
}

/* ── Zeichnen ──
   Wiedereintritt abfangen: Wird ein Eingabefeld mit Fokus ersetzt, feuert
   der Browser „blur" und damit „change" — dessen Handler zeichnet erneut,
   mitten im Ersetzen. Deshalb erst den Fokus lösen (das „change" läuft dann
   VOR dem Ersetzen) und einen Nachzügler-Aufruf hinterher ausführen. */
let erfZeichnetGerade=false, erfNochmal=false;
function erfZeichnen(){
  if(erfZeichnetGerade){ erfNochmal=true; return; }
  erfZeichnetGerade=true;
  try{
    const box=$('scr-form'); const a=document.activeElement;
    if(box && a && a!==document.body && box.contains(a) && typeof a.blur==='function') a.blur();
    erfZeichnenJetzt();
  } finally { erfZeichnetGerade=false; }
  if(erfNochmal){ erfNochmal=false; erfZeichnenJetzt(); }
}
function erfZeichnenJetzt(){
  const box=$('scr-form'); if(!box||!ERF) return;
  const s=ERF_SCHRITTE[ERF.schritt];
  const punkte=ERF_SCHRITTE.map((x,i)=>`<span class="wiz-dot${i===ERF.schritt?' on':''}${i<ERF.schritt?' done':''}"></span>`).join('');
  const kl=erfKlasse();
  let inhalt='';
  if(ERF.busy) inhalt=`<div class="wiz-busy"><div class="ocr-spin"></div><div class="wiz-busy-msg">${esc(ERF.busy)}</div></div>`;
  else if(s.id==='kategorie') inhalt=erfKategorieHTML();
  else if(s.id==='kennung') inhalt=erfKennungHTML();
  else if(s.id==='merkmale') inhalt=erfMerkmaleHTML();
  else inhalt=erfKontrolleHTML();
  const fuss=(ERF.busy)?'':`<div class="p-actions erf-fuss">
      <button type="button" class="btn btn-sec" onclick="erfZurueck()">${ERF.schritt===0?'Abbrechen':'Zurück'}</button>
      ${s.id==='kontrolle'?`<button type="button" class="btn btn-pri" onclick="erfSpeichern()">Speichern</button>`
        :(s.id==='kategorie'?'':`<button type="button" class="btn btn-pri" onclick="erfWeiter()">Weiter</button>`)}</div>`;
  box.innerHTML=`<div class="pcard erf">
    <div class="wiz-steps" aria-hidden="true">${punkte}</div>
    <div class="erf-kopf">Schritt ${ERF.schritt+1} von ${ERF_SCHRITTE.length} · ${esc(s.titel)}${kl&&ERF.schritt>0?` <span class="erf-kat">${esc(kl.label)}</span>`:''}</div>
    ${inhalt}${fuss}</div>`;
  if(typeof setBar==='function') setBar('Neues Material', s.titel, true);
}
function erfKlasse(){ return (ERF && ERF.klasse) ? ((MERKKAT.klassen||[]).find(k=>k.id===ERF.klasse)||null) : null; }

/* ① Kategorie */
function erfKategorieHTML(){
  const q=(ERF.katSuche||'').toLowerCase();
  const zahl={}; Object.keys(GTINDB||{}).forEach(id=>{ const k=GTINDB[id]&&GTINDB[id].klasse; if(k) zahl[k]=(zahl[k]||0)+1; });
  const liste=erfKategorien(MERKKAT).filter(k=>!q || String(k.label).toLowerCase().indexOf(q)>=0);
  const zeilen=liste.map(k=>`<button type="button" class="erf-kat-z${k.id===ERF.klasse?' on':''}" data-k="${esc(k.id)}" onclick="erfKategorieWahl(this.dataset.k)">
      <span>${esc(k.label)}</span>${zahl[k.id]?`<span class="erf-kat-n">${zahl[k.id]} erfasst</span>`:''}</button>`).join('');
  return `<p class="wiz-help">Was für ein Material ist es? Die Kategorie bestimmt, welche Merkmale danach auf dem Etikett gesucht werden.</p>
    <div class="std-search"><input type="search" id="erfKatSuche" placeholder="Kategorie suchen …" value="${esc(ERF.katSuche||'')}" oninput="erfKatSuchen(this.value)" autocomplete="off"></div>
    <div class="erf-kat-liste" id="erfKatListe">${zeilen||'<p class="hint">Keine passende Kategorie – unten neu anlegen.</p>'}</div>
    <button type="button" class="wiz-link" onclick="erfKatNeuZeigen()">＋ Neue Kategorie anlegen</button>
    <div class="form-row" id="erfKatNeu" style="display:none;margin-top:8px"><input class="loc-input" id="erfKatNeuInp" placeholder="z. B. Instrument / Nadelhalter" value="${esc(ERF.katSuche||'')}"><button type="button" class="add-btn" onclick="erfKatNeuSpeichern()">Anlegen</button></div>`;
}
function erfKatSuchen(v){
  if(!ERF) return; ERF.katSuche=v||'';
  const alt=$('erfKatSuche'); const pos=alt?alt.selectionStart:null;
  erfZeichnen();
  const neu=$('erfKatSuche'); if(neu){ neu.focus(); try{ if(pos!=null) neu.setSelectionRange(pos,pos); }catch(e){} }
}
function erfKatNeuZeigen(){ const r=$('erfKatNeu'); if(r){ r.style.display=''; const i=$('erfKatNeuInp'); if(i) i.focus(); } }
function erfKatNeuSpeichern(){
  const inp=$('erfKatNeuInp'); const label=(inp&&inp.value||'').trim();
  if(!label){ if(inp) inp.focus(); return; }
  const id=erfKategorieAnlegen(label);
  toast('Kategorie „'+label+'" angelegt – die allgemeinen Felder gelten sofort, weitere lassen sich in Schritt 3 ergänzen.');
  erfKategorieWahl(id);
}
/* Neue Kategorie ins Overlay. Gibt den Schlüssel zurück. */
function erfKategorieAnlegen(label){
  const vergeben={}; (MERKKAT.klassen||[]).forEach(k=>{ vergeben[k.id]=1; }); Object.keys(KATTPL.klassen).forEach(k=>{ vergeben[k]=1; });
  const id='k_'+((typeof addSlug==='function')?addSlug(label, vergeben):String(label).toLowerCase().replace(/[^a-z0-9]+/g,'_'));
  KATTPL.klassen[id]={ label, neu:true, diff:[], dazu:[] };
  saveKattpl();
  return id;
}
function erfKategorieWahl(id){
  if(!ERF) return;
  ERF.klasse=id;
  /* Liegt schon ein Etikett vor (z. B. Kategorie korrigiert), neu auswerten. */
  if(ERF.text) erfMerkAuswerten();
  ERF.schritt=1; erfZeichnen();
}

/* ② Kennung */
function erfKennungHTML(){
  const hl=erfHerstellerListe((typeof bezHersteller==='function')?bezHersteller():[], GTINDB);
  const h=ERF.hersteller||'';
  const inListe=!h || hl.some(x=>x===h);
  const opts=hl.map(x=>`<option value="${esc(x)}"${x===h?' selected':''}>${esc(x)}</option>`).join('');
  const pz=(ERF.gtin && !ERF.ohneGtin && typeof gtinPruefzifferOk==='function') ? gtinPruefzifferOk(ERF.gtin) : null;
  const q=k=>ERF.quelle[k]?`<div class="erf-q">${esc(erfQuelleWort(ERF.quelle[k]))}</div>`:'';
  const vorh=ERF.vorhanden ? (()=>{ const r=GTINDB[ERF.vorhanden]||{};
    return `<div class="erf-vorh"><b>Schon erfasst:</b> ${esc(r.name||r.ref||ERF.vorhanden)}${r.kategorie?` · ${esc(r.kategorie)}`:''}
      <div class="erf-sub">Statt ein zweites Mal anzulegen, das vorhandene Produkt verwenden.</div>
      <button type="button" class="btn btn-pri" onclick="erfVorhandenNehmen()">Dieses Produkt verwenden</button></div>`; })() : '';
  const dup=(ERF.refDup||[]).length ? `<div class="erf-vorh erf-warn"><b>Diese REF steht schon an:</b> ${ERF.refDup.map(r=>esc(r.name||r.ref||r.gtin)).join(', ')}
      <div class="erf-sub">Dasselbe Produkt? Dann verwenden. Sonst einfach weiter.</div>
      <button type="button" class="btn btn-sec" data-g="${esc(ERF.refDup[0].gtin||'')}" onclick="erfVorhandenNehmen(this.dataset.g)">Vorhandenes verwenden</button></div>` : '';
  const vorschl=(!ERF.ref && (ERF.refVorschlaege||[]).length) ? `<div class="wiz-wahl"><div class="wiz-wahl-t">REF nicht sicher gelesen – bitte Zeichen für Zeichen mit dem Etikett vergleichen, Antippen übernimmt:</div>
      ${ERF.refVorschlaege.map(k=>`<button type="button" class="wiz-chip" data-r="${esc(k)}" onclick="erfRefWahl(this.dataset.r)">${esc(k)}</button>`).join('')}</div>` : '';
  const fotos=ERF.fotoErg.length;
  return `<p class="wiz-help">Ein Foto vom Etikett liest GTIN, REF, Hersteller <b>und</b> die Merkmale für Schritt 3 in einem Zug. Die GTIN kommt nur aus dem Barcode – nie aus der Texterkennung.</p>
    <div class="wiz-actions">
      <button type="button" class="btn btn-pri" onclick="erfFoto('etikett')">📷 ${fotos?'Weiteres Etikettfoto':'Etikett fotografieren'}</button>
      <button type="button" class="btn btn-sec" onclick="erfFoto('barcode')">▦ Nur Barcode</button>
    </div>
    ${fotos?`<p class="wiz-note">${fotos} Etikettfoto${fotos>1?'s':''} ausgewertet.</p>`:''}
    ${vorh}
    <div class="flabel">GTIN (BARCODE) *</div>
    <input class="loc-input" id="erfGtin" inputmode="numeric" placeholder="14 Ziffern" value="${esc(ERF.gtin||'')}" onchange="erfGtinGeaendert()" ${ERF.ohneGtin?'disabled':''}>
    ${q('gtin')}${pz===false?'<div class="erf-q erf-rot">Prüfziffer stimmt nicht – Zahlendreher?</div>':(pz===true?'<div class="erf-q erf-ok">Prüfziffer stimmt</div>':'')}
    <label class="wiz-check"><input type="checkbox" id="erfOhneGtin" ${ERF.ohneGtin?'checked':''} onchange="erfLesen();erfZeichnen()"> Keine GTIN auf der Verpackung</label>
    <div class="flabel">REF / BESTELLNUMMER *</div>
    <input class="loc-input" id="erfRef" placeholder="genau wie auf dem Etikett" value="${esc(ERF.ref||'')}" onchange="erfRefGeaendert()" autocapitalize="characters" spellcheck="false">
    ${q('ref')}${vorschl}${dup}
    <label class="wiz-check"><input type="checkbox" id="erfOhneRef" ${ERF.ohneRef?'checked':''}> Keine REF auf dem Etikett</label>
    <div class="flabel">HERSTELLER *</div>
    <select class="form-sel" id="erfHerst" onchange="erfHerstWahl(this.value)">
      <option value="">— Hersteller wählen —</option>${opts}
      ${(!inListe)?`<option value="${esc(h)}" selected>${esc(h)}</option>`:''}
      <option value="__neu">＋ Neuer Hersteller …</option></select>
    <input class="loc-input" id="erfHerstNeu" placeholder="Name des Herstellers" style="display:none;margin-top:6px">
    ${q('hersteller')}`;
}
function erfHerstWahl(v){
  const neu=$('erfHerstNeu'); if(neu){ neu.style.display=(v==='__neu')?'':'none'; if(v==='__neu') neu.focus(); }
}
function erfRefWahl(ref){
  if(!ERF) return; erfLesen();
  if(ERF.erg && ERF.erg.refRoh && typeof refLearn==='function') refLearn(ERF.erg.refRoh, ref);
  ERF.ref=ref; ERF.quelle.ref={ art:'bestaetigt' }; ERF.refVorschlaege=[];
  erfDublettenPruefen(); if(ERF.text) erfMerkAuswerten(); erfZeichnen();
}
function erfRefGeaendert(){ if(!ERF) return; erfLesen(); erfDublettenPruefen(); erfZeichnen(); }
async function erfGtinGeaendert(){
  if(!ERF) return; erfLesen();
  if(!ERF.gtin){ ERF.vorhanden=null; ERF.quelle.gtin=null; erfZeichnen(); return; }
  ERF.quelle.gtin={ art:'hand' };
  /* Prüfziffer und „schon erfasst" sofort zeigen — das Nachschlagen im Netz
     kann bei schlechtem WLAN dauern und darf die Rückmeldung nicht aufhalten. */
  ERF.vorhanden = GTINDB[ERF.gtin] ? ERF.gtin : null;
  erfZeichnen();
  if(typeof gtinPruefzifferOk==='function' && !gtinPruefzifferOk(ERF.gtin)) return;
  await erfGtinAufloesen();
  erfNeuZeichnen();
}
/* Nach einer Wartezeit neu zeichnen, ohne zwischenzeitlich Getipptes zu
   verlieren: erst die Felder einlesen, dann zeichnen. */
function erfNeuZeichnen(){ if(!ERF) return; erfLesen(); erfZeichnen(); }
/* GTIN steht fest: vorhanden? Hersteller aus dem Präfix? Nachschlagen. */
async function erfGtinAufloesen(){
  if(!ERF || !ERF.gtin) return;
  const g=ERF.gtin;
  ERF.vorhanden = GTINDB[g] ? g : null;
  if(!ERF.vorhanden && typeof packungFinden==='function'){ const pk=packungFinden(GTINDB, g); if(pk && GTINDB[pk.id]) ERF.vorhanden=pk.id; }
  if(!ERF.hersteller){ const p=erfHerstellerAusGtin(GTINDB, g);
    if(p){ ERF.hersteller=p.hersteller; ERF.quelle.hersteller={ art:'praefix' }; } }
  if(typeof gtinAufloesen==='function' && !ERF.vorhanden){
    try{ const t=await gtinAufloesen(g);
      if(t && ERF){
        if(t.ref && !ERF.ref){ ERF.ref=t.ref; ERF.quelle.ref={ art:'nachschlag', text:t.quelle||'' }; }
        if(t.hersteller && !ERF.hersteller){ ERF.hersteller=erfHerstellerKanon(t.hersteller, erfHerstellerListe((typeof bezHersteller==='function')?bezHersteller():[], GTINDB)); ERF.quelle.hersteller={ art:'nachschlag', text:t.quelle||'' }; }
        if(t.name && !ERF.name){ ERF.nameVorschlagQuelle=t.name; }
      } }catch(e){}
  }
  erfDublettenPruefen();
}
function erfDublettenPruefen(){
  if(!ERF) return;
  ERF.refDup = (ERF.ref && typeof refDubletten==='function') ? refDubletten(GTINDB, ERF.ref, ERF.gtin||'') : [];
}
/* Vorhandenes Produkt statt Neuanlage. */
function erfVorhandenNehmen(id){
  if(!ERF) return;
  const g=id||ERF.vorhanden; if(!g || !GTINDB[g]) return;
  const z=ERF.ziel; const art=ERF.art; ERF=null;
  if(z.ort==='standard'){ erfInsStandard(z, g, art); toast('Vorhandenes Produkt eingefügt – nichts doppelt angelegt.'); return; }
  if(typeof openScanItem==='function') openScanItem(g,false);
}

/* Foto aufnehmen: 'etikett' (alles lesen) oder 'barcode' (nur der Code). */
function erfFoto(art){
  if(!ERF) return; erfLesen();
  const inp=document.createElement('input');
  inp.type='file'; inp.accept='image/*'; inp.setAttribute('capture','environment'); inp.style.display='none';
  inp.onchange=()=>{ const f=inp.files&&inp.files[0]; try{ document.body.removeChild(inp); }catch(e){}
    if(!f) return; const r=new FileReader(); r.onload=()=>{ if(art==='barcode') erfBarcodeLesen(r.result); else erfEtikettLesen(r.result); }; r.readAsDataURL(f); };
  document.body.appendChild(inp); inp.click();
}
async function erfBarcodeLesen(d){
  if(!ERF) return;
  ERF.busy='Barcode lesen …'; erfZeichnen();
  let code=null; try{ code=(typeof ocrBarcodeFromImage==='function')?await ocrBarcodeFromImage(d):null; }catch(e){}
  if(!ERF) return;
  ERF.busy='';
  if(!code || !(code.gtin||code.itemRef)){ erfZeichnen(); toast('Kein Barcode erkannt. Näher heran, mehr Licht – oder die Nummer eintippen.', true); return; }
  erfBarcodeUebernehmen(code);
  ERF.fotos.push({ src:d, rolle:'etikett' });
  erfZeichnen();
  await erfGtinAufloesen(); erfNeuZeichnen();
}
function erfBarcodeUebernehmen(code){
  if(code.gtin){ ERF.gtin=(typeof gtinKey==='function')?gtinKey(code.gtin):code.gtin; ERF.quelle.gtin={ art:'barcode' }; ERF.ohneGtin=false; }
  if(code.itemRef){ ERF.ref=code.itemRef; ERF.quelle.ref={ art:'barcode' }; }
}
async function erfEtikettLesen(d){
  if(!ERF) return;
  if(ERF.fotoErg.length>=ERF_MAX_FOTOS){ toast('Es werden höchstens '+ERF_MAX_FOTOS+' Etikettfotos ausgewertet.'); return; }
  ERF.busy='Etikett lesen …'; erfZeichnen();
  try{
    const f=await ocrLeseFotoEinzeln(d, (t)=>{ if(ERF){ ERF.busy=t; erfZeichnen(); } });
    if(!ERF) return;
    ERF.fotoErg.push(f); ERF.fotos.push({ src:d, rolle:'etikett' });
    erfAusErgebnis(ocrZusammenfuehren(ERF.fotoErg));
    if(ERF.gtin) await erfGtinAufloesen();
  }catch(e){ toast('Etikett konnte nicht gelesen werden: '+((e&&e.message)||e), true); }
  if(!ERF) return;
  ERF.busy=''; erfZeichnen();
}
/* Ergebnis der Etikett-Erkennung übernehmen — NUR in leere bzw. nicht von
   Hand gesetzte Felder (Grundsatz ③). Auch der Weg für Tests (ohne Kamera). */
function erfAusErgebnis(erg){
  if(!ERF || !erg) return;
  ERF.erg=erg; ERF.text=erg.text||'';
  if(erg.barcode) erfBarcodeUebernehmen(erg.barcode);
  else if(erg.gtin && !ERF.gtin){ ERF.gtin=erg.gtin; ERF.quelle.gtin={ art:'barcode' }; }
  const f=erg.fields||{};
  /* REF vom Etikett nur, wo noch nichts Belastbareres steht (Barcode,
     eigener Bestand, Nachschlag, von Hand) — eine frühere Etikettlesung darf
     die bessere Lesung mehrerer Fotos ersetzen. */
  if(f.ref && (!ERF.ref || (ERF.quelle.ref && ERF.quelle.ref.art==='etikett'))){
    ERF.ref=f.ref; ERF.quelle.ref={ art:'etikett', wie:(erg.refInfo&&erg.refInfo.wie)||'roh' }; }
  ERF.refVorschlaege = (!f.ref && erg.refInfo) ? (erg.refInfo.vorschlaege||[]) : [];
  /* Der Name auf dem Etikett ist ein direkter Beleg, der GTIN-Präfix nur ein
     Schluss — das Etikett gewinnt gegen den Präfix-Vorschlag. */
  if(f.hersteller && (!ERF.hersteller || (ERF.quelle.hersteller && ERF.quelle.hersteller.art==='praefix'))){ ERF.hersteller=erfHerstellerKanon(f.hersteller, erfHerstellerListe((typeof bezHersteller==='function')?bezHersteller():[], GTINDB)); ERF.quelle.hersteller={ art:'etikett', wie:'roh' }; }
  if(f.name) ERF.nameVorschlagQuelle=f.name;
  if(typeof ocrLastRead!=='undefined') ocrLastRead={ roh:erg.refRoh||'', wie:(erg.refInfo&&erg.refInfo.wie)||'roh', at:Date.now() };
  erfDublettenPruefen();
  erfMerkAuswerten();
}
/* Merkmale der gewählten Kategorie auf dem Etikett suchen. */
function erfMerkAuswerten(){
  if(!ERF || !ERF.text || typeof merkSammeln!=='function') return;
  const erg=merkSammeln(ERF.text, ERF.ref||'', MERKKAT, ERF.klasse||null);
  ERF.erkannt = (erg.erkannt && erg.erkannt.sicher && erg.erkannt.klasse!==ERF.klasse && erg.erkannt.klasse!=='allgemein') ? erg.erkannt : null;
  const felder=erfFelder(MERKKAT, ERF.klasse);
  const imFormular={}; [].concat(felder.diff, felder.weitere, felder.allgemein).forEach(d=>{ imFormular[d.id]=1; });
  ERF.extra=[];
  (erg.merkmale||[]).forEach(m=>{
    if(!imFormular[m.id]){ ERF.extra.push(m); return; }
    if(ERF.merkVonHand[m.id]) return;
    ERF.merk[m.id]=String(m.wert);
    ERF.merkQuelle[m.id]=(m.herkunft==='ref')?'aus der REF':(m.herkunft==='anker'?'Etikett · beschriftetes Feld':'Etikett (gelesen)');
  });
  ERF.mehrdeutig=(erg.mehrdeutig||[]).filter(u=>imFormular[u.id] && !ERF.merkVonHand[u.id]);
  if(!ERF.nameVonHand) erfNameAuffrischen();
}
function erfNameAuffrischen(){
  if(!ERF) return;
  const kl=erfKlasse(); const felder=erfFelder(MERKKAT, ERF.klasse);
  const v=erfNameVorschlag(kl?kl.label:'', felder.diff, ERF.merk);
  ERF.name = ERF.nameVorschlagQuelle && !felder.diff.some(d=>ERF.merk[d.id]) ? ERF.nameVorschlagQuelle : v;
}

/* ③ Merkmale */
function erfMerkmaleHTML(){
  const kl=erfKlasse(); const felder=erfFelder(MERKKAT, ERF.klasse);
  const gelesen=ERF.fotoErg.length>0;
  const feld=(d, stern)=>{
    const w=ERF.merk[d.id];
    const qu=ERF.merkQuelle[d.id] || (gelesen && !w ? 'nicht auf dem Etikett gefunden' : '');
    const html=(typeof scanMerkFeldHTML==='function')?scanMerkFeldHTML(d, w):'';
    return `<div class="erf-feld${stern?' erf-diff':''}${(gelesen&&!w)?' erf-leer':''}">${stern?'<span class="erf-stern" title="Unterscheidet Varianten">★</span>':''}${html}${qu?`<div class="erf-q">${esc(qu)}</div>`:''}</div>`;
  };
  /* Offen steht nur, was zählt: die ★-Felder und alles, was einen Wert hat.
     Leere Felder liegen zugeklappt darunter — sonst scrollt man bei jedem
     Material durch zwanzig Felder (Rückmeldung des Betreibers). Vor dem
     ersten Foto stehen die Felder der Kategorie offen, die allgemeinen zu. */
  const hat=d=>!!ERF.merk[d.id];
  const offen=gelesen ? felder.weitere.concat(felder.allgemein).filter(hat) : felder.weitere.concat(felder.allgemein.filter(hat));
  const zu=gelesen ? felder.weitere.concat(felder.allgemein).filter(d=>!hat(d)) : felder.allgemein.filter(d=>!hat(d));
  const wahl=(ERF.mehrdeutig||[]).map(u=>`<div class="wiz-wahl"><div class="wiz-wahl-t">${esc(u.label)}: Das Etikett nennt mehrere Werte – bitte auswählen:</div>
      ${Array.from(u.kandidaten||[]).map(k=>`<button type="button" class="wiz-chip" data-m="${esc(u.id)}" data-v="${esc(k)}" onclick="erfMerkWahl(this.dataset.m,this.dataset.v)">${esc(String(k))}</button>`).join('')}</div>`).join('');
  const falsch=ERF.erkannt ? `<div class="erf-vorh erf-warn">Das Etikett spricht eher für <b>${esc(ERF.erkannt.label)}</b>.
      <button type="button" class="btn btn-sec" data-k="${esc(ERF.erkannt.klasse)}" onclick="erfKategorieWechsel(this.dataset.k)">Kategorie wechseln</button></div>` : '';
  const extra=(ERF.extra||[]).length ? `<details class="merk-mehr"><summary>Außerdem auf dem Etikett (${ERF.extra.length})</summary>
      <p class="hint">Gehört nicht zu den Feldern dieser Kategorie. Fehlt ein Feld, unten „＋ Merkmal" – dann wird es künftig mitgesucht.</p>
      ${ERF.extra.map(m=>`<div class="wiz-row"><div class="wiz-l">${esc(m.label)}</div><div class="wiz-v">${esc(String(m.wert)+(m.einheit?(' '+m.einheit):''))}</div></div>`).join('')}</details>` : '';
  const leerHinweis=(!felder.diff.length && !felder.weitere.length)
    ? `<p class="hint">Für „${esc(kl?kl.label:'')}" sind noch keine eigenen Felder festgelegt – nur die allgemeinen Angaben. Mit „Felder dieser Kategorie" einmal festlegen, dann gelten sie für jedes weitere Material dieser Kategorie.</p>` : '';
  return `<p class="wiz-help">Gesucht werden die Felder dieser Kategorie. ★ = Differenzierungsmerkmal (unterscheidet Varianten und bildet den Namen).</p>
    <div class="wiz-actions"><button type="button" class="btn btn-sec" onclick="erfFoto('etikett')">📷 ${ERF.fotoErg.length?('Weiteres Etikettfoto ('+(ERF.fotoErg.length+1)+'/'+ERF_MAX_FOTOS+')'):'Etikett fotografieren'}</button></div>
    ${falsch}${wahl}${leerHinweis}
    <div id="erfMerk">
      ${felder.diff.map(d=>feld(d,true)).join('')}
      ${offen.map(d=>feld(d,false)).join('')}
      ${zu.length?`<details class="merk-mehr"><summary>${gelesen?'Nicht gefunden – bei Bedarf von Hand':'Weitere Felder'} (${zu.length})</summary>${zu.map(d=>feld(d,false)).join('')}</details>`:''}
    </div>
    ${extra}
    <div class="wiz-actions" style="margin-top:8px">
      <button type="button" class="btn btn-sec" onclick="erfVorlageBlatt(ERF.klasse)">⚙ Felder dieser Kategorie</button>
    </div>
    <div class="flabel" style="margin-top:12px">PRODUKTNAME</div>
    <input class="loc-input" id="erfName" value="${esc(ERF.name||'')}" placeholder="wird aus Kategorie und ★-Merkmalen vorgeschlagen">
    <button type="button" class="wiz-link" onclick="erfNameNeu()">Namen neu vorschlagen</button>`;
}
function erfMerkWahl(id, wert){
  if(!ERF) return; erfLesen();
  ERF.merk[id]=wert; ERF.merkVonHand[id]=true; ERF.merkQuelle[id]='Etikett · von Ihnen gewählt';
  ERF.mehrdeutig=ERF.mehrdeutig.filter(u=>u.id!==id);
  if(!ERF.nameVonHand) erfNameAuffrischen();
  erfZeichnen();
}
function erfNameNeu(){ if(!ERF) return; erfLesen(); ERF.nameVonHand=false; ERF.nameVorschlagQuelle=''; erfNameAuffrischen(); erfZeichnen(); }
function erfKategorieWechsel(id){ if(!ERF) return; erfLesen(); ERF.klasse=id; ERF.erkannt=null; erfMerkAuswerten(); erfZeichnen(); }

/* ④ Kontrolle */
function erfKontrolleHTML(){
  const kl=erfKlasse(); const felder=erfFelder(MERKKAT, ERF.klasse);
  const fehlt=erfFehlt(ERF);
  const zeile=(l,v,q,rot)=>`<div class="wiz-row${rot?' erf-rotz':''}"><div class="wiz-l">${esc(l)}</div><div class="wiz-v">${v?esc(v):'<span class="erf-rot">fehlt</span>'}</div><div class="wiz-q">${esc(q||'')}</div></div>`;
  const art=natOf(ERF.art||'');
  let rows=zeile('Art', art.label, '')+zeile('Kategorie', kl?kl.label:'', '', fehlt.indexOf('klasse')>=0)
    +zeile('GTIN', ERF.ohneGtin?'keine GTIN':ERF.gtin, erfQuelleWort(ERF.quelle.gtin), fehlt.indexOf('gtin')>=0||fehlt.indexOf('pruefziffer')>=0)
    +zeile('REF', ERF.ohneRef&&!ERF.ref?'keine REF':ERF.ref, erfQuelleWort(ERF.quelle.ref), fehlt.indexOf('ref')>=0)
    +zeile('Hersteller', ERF.hersteller, erfQuelleWort(ERF.quelle.hersteller), fehlt.indexOf('hersteller')>=0)
    +zeile('Produktname', ERF.name, ERF.nameVonHand?'von Hand':'Vorschlag');
  [].concat(felder.diff, felder.weitere, felder.allgemein).forEach(d=>{
    const w=ERF.merk[d.id]; if(!w) return;
    rows+=zeile((felder.diff.indexOf(d)>=0?'★ ':'')+d.label, String(w)+(d.einheit&&!/[a-zA-Z°%"″]$/.test(String(w))?(' '+d.einheit):''), ERF.merkQuelle[d.id]);
  });
  const luecken=felder.diff.filter(d=>!ERF.merk[d.id]).map(d=>d.label);
  const fotos=ERF.fotos.length?`<label class="wiz-check"><input type="checkbox" id="erfFotosAn" checked> ${ERF.fotos.length} Aufnahme${ERF.fotos.length>1?'n':''} als Etikettfoto${ERF.fotos.length>1?'s':''} speichern</label>`:'';
  const ziel=ERF.ziel.ort==='standard' ? '<p class="wiz-note">Nach dem Speichern steht das Material als Zeile im Standard – verknüpft mit dem Stammsatz.</p>' : '';
  return `<div class="wiz-list">${rows}</div>
    ${luecken.length?`<p class="wiz-note">Noch leer (★): ${esc(luecken.join(' · '))} – zurück zu Schritt 3 oder später ergänzen.</p>`:''}
    ${fehlt.length?`<p class="wiz-note erf-rot">Bitte ergänzen: ${esc(fehlt.map(erfFehltWort).join(', '))}.</p>`:''}
    ${fotos}${ziel}`;
}
function erfFehltWort(k){ return ({ klasse:'Kategorie', gtin:'GTIN', pruefziffer:'GTIN-Prüfziffer', ref:'REF (oder „Keine REF" ankreuzen)', hersteller:'Hersteller' })[k]||k; }

/* Speichern: Stammsatz anlegen (oder ergänzen), dann — aus dem Standard
   heraus — die Zeile einfügen. */
async function erfSpeichern(){
  if(!ERF) return;
  const fehlt=erfFehlt(ERF);
  if(fehlt.length){ toast('Bitte ergänzen: '+fehlt.map(erfFehltWort).join(', '), true); return; }
  if(!ERF.ohneGtin && GTINDB[ERF.gtin] && !ERF.ueberschreiben){
    ERF.schritt=1; erfZeichnen(); toast('Diese GTIN ist schon erfasst – bitte das vorhandene Produkt verwenden.', true); return; }
  const fotosAn=(()=>{ const c=$('erfFotosAn'); return c?c.checked:true; })();
  const id=ERF.ohneGtin ? ('m:'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)) : ERF.gtin;
  const fotos=[];
  if(fotosAn){ for(const f of ERF.fotos){ const src=(typeof medFotoSichern==='function')?await medFotoSichern(f.src):f.src; fotos.push({ src, titel:'', rolle:f.rolle||'etikett' }); } }
  if(!ERF) return;
  const kl=erfKlasse();
  const patch={ gtin:id, manual:!!ERF.ohneGtin, hersteller:ERF.hersteller||null, ref:ERF.ref||null,
    name:ERF.name||null, klasse:ERF.klasse, kategorie:kl?kl.label:null,
    merkmale:Object.keys(ERF.merk).length?Object.assign({},ERF.merk):null,
    quellen:{ gtin:(ERF.quelle.gtin&&ERF.quelle.gtin.art)||null, ref:(ERF.quelle.ref&&ERF.quelle.ref.art)||null, hersteller:(ERF.quelle.hersteller&&ERF.quelle.hersteller.art)||null } };
  if(fotos.length){ patch.fotos=fotos; patch.photo=fotos[0].src; }
  GTINDB[id]=mergeGtinRecord(GTINDB[id], patch, new Date().toISOString());
  saveGtinDB();
  if(typeof refInvalidateIndex==='function') refInvalidateIndex();
  if(typeof ocrLearnFromSave==='function') ocrLearnFromSave(ERF.ref);
  const z=ERF.ziel, art=ERF.art; ERF=null;
  toast('Material gespeichert');
  if(z.ort==='standard'){ erfInsStandard(z, id, art); return; }
  if(typeof openScanItem==='function') openScanItem(id,false);
}
/* Zeile im Standard, die auf das Produkt zeigt (wie im Editor am PC). */
function erfInsStandard(z, id, art){
  const r=GTINDB[id]; if(!r) return;
  const e=makeAddEntry({ aid:newAid(), name:(r.name||r.ref||id), nat:art||'material', uk:z.uk||'', seg:z.seg||null });
  e.material_key='produkt:'+id; e.produkt=id;
  if(typeof matLinkTo==='function') matLinkTo(e.material_key, id);
  const key=z.sid+'|'+z.ri;
  (ADDITIONS.entries[key]||(ADDITIONS.entries[key]=[])).push(e);
  saveAdditions(); rebuildDB(); buildMaterialIndex();
  if(typeof reRenderDetail==='function') reRenderDetail();
}

/* ═══════════ 4. Kategorien & Felder pflegen (ein Menü, zwei Kontexte) ═══════════
   Geöffnet aus Schritt ③ („⚙ Felder dieser Kategorie") und aus der Verwaltung. */
let erfVorlageId=null;
function erfVorlageBlatt(klasseId){
  if(ERF) erfLesen();
  erfVorlageId=klasseId;
  const kl=(MERKKAT.klassen||[]).find(k=>k.id===klasseId); if(!kl) return;
  const t=KATTPL.klassen[klasseId]||{};
  const felder=erfFelder(MERKKAT, klasseId);
  const drin={}; felder.diff.concat(felder.weitere).forEach(d=>{ drin[d.id]=1; });
  const diff={}; felder.diff.forEach(d=>{ diff[d.id]=1; });
  const alle=(MERKKAT.merkmale||[]).filter(d=>(d.klassen||[]).indexOf('allgemein')<0)
    .slice().sort((a,b)=>(drin[b.id]?1:0)-(drin[a.id]?1:0) || String(a.label).localeCompare(String(b.label),'de'));
  const zeile=d=>`<div class="erf-vz"><label class="erf-vz-l"><input type="checkbox" data-mid="${esc(d.id)}" ${drin[d.id]?'checked':''} onchange="erfVorlageFeld(this.dataset.mid,this.checked)"> ${esc(d.label)}${d.einheit?` <span class="erf-q">(${esc(d.einheit)})</span>`:''}</label>
      <button type="button" class="erf-vz-s${diff[d.id]?' on':''}" data-mid="${esc(d.id)}" onclick="erfVorlageDiff(this.dataset.mid)" title="Differenzierungsmerkmal" ${drin[d.id]?'':'disabled'}>★</button></div>`;
  const einheiten=(typeof MERK_EINHEIT_MUSTER!=='undefined')?Object.keys(MERK_EINHEIT_MUSTER):['mm','cm','F'];
  const h=`<div class="sheet-grip"></div><div class="sheet-title">Felder: ${esc(kl.label)}</div>
    <div class="flabel">NAME DER KATEGORIE</div><div class="form-row"><input class="loc-input" id="erfVlName" value="${esc(t.label||kl.label)}"><button type="button" class="add-btn" onclick="erfVorlageName()">Ändern</button></div>
    <p class="hint">Angehakt = wird bei dieser Kategorie gezeigt und auf dem Etikett gesucht. ★ = unterscheidet Varianten (bildet den Namen). Steril, Einmalgebrauch, Latex u. a. gelten immer.</p>
    <div class="erf-vliste">${alle.map(zeile).join('')}</div>
    <div class="flabel" style="margin-top:12px">＋ NEUES MERKMAL FÜR DIESE KATEGORIE</div>
    <input class="loc-input" id="erfNmLabel" placeholder="Bezeichnung, z. B. Maulform">
    <div class="form-row" style="margin-top:6px">
      <select class="form-sel" id="erfNmTyp"><option value="text">Text</option><option value="mass">Maß mit Einheit</option><option value="zahl">Zahl</option><option value="ja_nein">Ja / Nein</option><option value="liste">Auswahl</option></select>
      <select class="form-sel" id="erfNmEinheit"><option value="">— Einheit —</option>${einheiten.map(e=>`<option value="${esc(e)}">${esc(e)}</option>`).join('')}</select></div>
    <input class="loc-input" id="erfNmWerte" placeholder="nur bei Auswahl: Werte, Komma-getrennt (z. B. gerade, gebogen)" style="margin-top:6px">
    <input class="loc-input" id="erfNmAnker" placeholder="So steht es auf dem Etikett (optional, Komma-getrennt)" style="margin-top:6px">
    <div class="sheet-pick" style="margin-top:8px"><button class="sheet-pick-btn" onclick="erfVorlageNeuesMerkmal()">Merkmal anlegen</button></div>
    <button class="sheet-close" onclick="erfVorlageZu()">Fertig</button>`;
  $('sheet').innerHTML=h; showSheet(true);
}
function erfVorlageZu(){ showSheet(false); if(ERF){ if(ERF.text) erfMerkAuswerten(); erfZeichnen(); } else if(typeof renderAdmin==='function' && $('scr-admin') && $('scr-admin').offsetParent) renderAdmin(); }
function erfVorlageEintrag(id){ return KATTPL.klassen[id] || (KATTPL.klassen[id]={}); }
function erfVorlageFeld(mid, an){
  const id=erfVorlageId; if(!id) return;
  const t=erfVorlageEintrag(id);
  const orig=((typeof MERKKAT_QUELLE!=='undefined'&&MERKKAT_QUELLE&&MERKKAT_QUELLE.merkmale)||[]).find(d=>d.id===mid);
  const vonHaus=!!(orig && (orig.klassen||[]).indexOf(id)>=0);
  t.dazu=(t.dazu||[]).filter(x=>x!==mid); t.aus=(t.aus||[]).filter(x=>x!==mid);
  if(an && !vonHaus) t.dazu.push(mid);
  if(!an && vonHaus) t.aus.push(mid);
  if(!an && Array.isArray(t.diff)) t.diff=t.diff.filter(x=>x!==mid);
  saveKattpl(); erfVorlageBlatt(id);
}
function erfVorlageDiff(mid){
  const id=erfVorlageId; if(!id) return;
  const t=erfVorlageEintrag(id);
  const kl=(MERKKAT.klassen||[]).find(k=>k.id===id)||{};
  const jetzt=Array.isArray(t.diff)?t.diff.slice():(kl.leit||[]).slice();
  t.diff = jetzt.indexOf(mid)>=0 ? jetzt.filter(x=>x!==mid) : jetzt.concat([mid]);
  saveKattpl(); erfVorlageBlatt(id);
}
function erfVorlageName(){
  const id=erfVorlageId; if(!id) return;
  const v=(($('erfVlName')||{}).value||'').trim(); if(!v) return;
  erfVorlageEintrag(id).label=v; saveKattpl(); toast('Kategorie umbenannt'); erfVorlageBlatt(id);
}
function erfVorlageNeuesMerkmal(){
  const id=erfVorlageId; if(!id) return;
  const v=k=>(($(k)||{}).value||'').trim();
  const label=v('erfNmLabel'); if(!label){ toast('Bitte eine Bezeichnung eingeben', true); return; }
  const typ=v('erfNmTyp')||'text';
  if(typ==='mass' && !v('erfNmEinheit')){ toast('Bei einem Maß bitte die Einheit wählen', true); return; }
  const werte=(typeof parseSyn==='function')?parseSyn(v('erfNmWerte')):[];
  if(typ==='liste' && !werte.length){ toast('Bei einer Auswahl bitte die Werte angeben', true); return; }
  const vergeben={}; (MERKKAT.merkmale||[]).forEach(d=>{ vergeben[d.id]=1; });
  const mid='e_'+((typeof addSlug==='function')?addSlug(label, vergeben):label.toLowerCase().replace(/[^a-z0-9]+/g,'_'));
  KATTPL.merkmale[mid]={ label, typ, einheit:(typ==='mass'?v('erfNmEinheit'):null), werte:(typ==='liste'?werte:undefined),
    anker:(typeof parseSyn==='function')?parseSyn(v('erfNmAnker')):[] };
  const t=erfVorlageEintrag(id); t.dazu=(t.dazu||[]).concat([mid]);
  saveKattpl(); toast('Merkmal „'+label+'" angelegt – wird ab jetzt mitgesucht'); erfVorlageBlatt(id);
}

/* Verwaltung: Karte „Kategorien & Felder". */
function erfPanelHTML(){
  if(!erfAktiv() || typeof MERKKAT==='undefined' || !MERKKAT || !(MERKKAT.merkmale||[]).length) return '';
  const liste=erfKategorien(MERKKAT);
  const zeilen=liste.map(k=>{ const f=erfFelder(MERKKAT,k.id);
    return `<div class="ukrow"><div class="ukrow-head"><span class="uk-name">${esc(k.label)}${k.eigen?' <span class="vp-badge">eigen</span>':''}</span><span class="uk-count">${f.diff.length+f.weitere.length} Felder · ${f.diff.length} ★</span></div>
      <div class="uk-actions"><button data-k="${esc(k.id)}" onclick="erfVorlageBlatt(this.dataset.k)">Felder</button></div></div>`; }).join('');
  return `<details class="vpanel" data-keys="kategorie kategorien materialklasse felder merkmale vorlage erfassung neuanlage">${(typeof vsum==='function')?vsum('🗂','Kategorien & Felder','Welche Merkmale je Materialkategorie gesucht und abgefragt werden – ★ unterscheidet Varianten',liste.length):''}<div class="vpanel-body">
    <p class="panel-help">Gilt für die geführte Neuanlage („Was ist das?" → Material). Die mitgelieferten Vorlagen bleiben unangetastet; Änderungen hier sind jederzeit umkehrbar.</p>
    ${zeilen}
    <div class="form-row" style="margin-top:8px"><input class="loc-input" id="erfPanelNeu" placeholder="Neue Kategorie, z. B. Instrument"><button type="button" class="add-btn" onclick="erfPanelNeu()">＋ Kategorie</button></div>
  </div></details>`;
}
function erfPanelNeu(){
  const inp=$('erfPanelNeu'); const label=(inp&&inp.value||'').trim(); if(!label){ if(inp) inp.focus(); return; }
  const id=erfKategorieAnlegen(label); toast('Kategorie angelegt'); erfVorlageBlatt(id);
}
