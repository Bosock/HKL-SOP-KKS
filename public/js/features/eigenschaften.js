/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — EIGENSCHAFTEN AN STANDARDS

   Ein Eingriff ist gleichzeitig sedierungspflichtig, Rechtsherz, Implantat
   und Rufbereitschaft. Ein BAUM kann das nicht abbilden — er ordnet jedes
   Ding an genau einen Platz. Eine FACETTE kann es: sie beschreibt aus einer
   Achse, und ein Ding trägt beliebig viele.

   Deshalb ist „sedierungspflichtig" hier keine Kategorie, sondern eine
   Eigenschaft. Zwei kleine Speicher, streng getrennt:

       hkl_eigenschaften   WAS es überhaupt gibt   (Definition)
       hkl_stdeigen        WER es hat              (Vergabe)

   Diese Bauform ist in der App nicht neu: NATCFG (Kategorien) und MATPROPS
   (Materialeigenschaften) sind genauso gebaut. Das dritte Vorkommen desselben
   Musters ist ein gutes Zeichen, keine Erfindung.

   ── Drei Arten, mehr nicht ──
     ja       Ja/Nein — der Normalfall („sedierungspflichtig")
     wert     freie Angabe („Vorbereitungszeit: 45 min")
     auswahl  aus einer gepflegten Liste („Zugang: radial · femoral")
   Mehr wäre Formularbau, und den pflegt niemand.

   ── Wozu es zählt ──
   ① Chips im Standardkopf — „was der Standard alles beinhaltet"
   ② Merkmal in der Übersicht (features/facetten.js) — danach filtern
   ③ eine ZÄHLUNG („wie viele sedierungspflichtige Eingriffe habe ich")
   ④ eine REICHWEITE: „alle mit dieser Eigenschaft gleichzeitig ändern"

   ④ ist nicht für jede Eigenschaft sinnvoll — deshalb entscheidet das Haus je
   Eigenschaft mit einem Schalter, ob sie im Reichweitenmenü auftaucht. Sonst
   wäre die Liste dort nach zwanzig Merkmalen unbenutzbar.

   ── Ehrlich zählen ──
   Gezählt wird IMMER mit „ohne Angabe". „12 von 47" wäre eine Lüge, solange
   32 Standards nie gefragt wurden (Grundsatz ①: leer schlägt falsch).
   ───────────────────────────────────────────────────────────── */

/* ═══════════ 1. Definition ═══════════ */

const EIG_ARTEN = ['ja','wert','auswahl'];
const EIG_ART_RUECKFALL = { ja:'Ja / Nein', wert:'Freie Angabe', auswahl:'Auswahl aus Liste' };
function eigArtWort(a){
  const tab = (typeof bezWert==='function') ? (bezWert('eigenschaftsarten','werte',null)||EIG_ART_RUECKFALL) : EIG_ART_RUECKFALL;
  return tab[a] || EIG_ART_RUECKFALL[a] || a;
}

let EIG = (typeof loadJSON==='function') ? loadJSON('hkl_eigenschaften', []) : [];
if(!Array.isArray(EIG)) EIG = [];
function saveEig(){ if(typeof saveJSON==='function') saveJSON('hkl_eigenschaften', EIG); }

let EIGSTD = (typeof loadJSON==='function') ? loadJSON('hkl_stdeigen', {}) : {};
if(!EIGSTD || typeof EIGSTD!=='object') EIGSTD = {};
function saveEigStd(){ if(typeof saveJSON==='function') saveJSON('hkl_stdeigen', EIGSTD); }

/* Schlüssel aus einem Wort. Der Schlüssel ist unveränderlich — wer das Wort
   später ändert, verliert seine Vergaben NICHT. Genau daran scheitern
   Merkmalslisten sonst. */
function eigSlug(text){
  let s = String(text==null?'':text).toLowerCase();
  s = s.replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
  try{ s = s.normalize('NFD').replace(/[̀-ͯ]/g,''); }catch(e){}
  s = s.replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40);
  return s || ('e'+Date.now().toString(36));
}
function eigListe(){ return EIG.slice().sort((a,b)=>(a.ord||0)-(b.ord||0)); }
function eigOf(key){ return EIG.find(x=>x.key===key) || null; }
function eigKopfListe(){ return eigListe().filter(x=>x.zeigen!=='still'); }
/* Nur diese Eigenschaften erscheinen im Reichweitenmenü. */
function eigReichweiten(){ return eigListe().filter(x=>!!x.alsReichweite); }

function eigAnlegen(wort, art){
  const w = String(wort||'').trim(); if(!w) return null;
  let key = eigSlug(w); let n = 2;
  while(eigOf(key)) key = eigSlug(w)+'-'+(n++);
  const e = { key, wort:w, symbol:'🏷️', farbe:'', art:(EIG_ARTEN.indexOf(art)>=0?art:'ja'),
    werte:[], zeigen:'kopf', alsReichweite:false, ord:EIG.length };
  EIG.push(e); saveEig(); return e;
}
function eigAendern(key, feld, wert){
  const e = eigOf(key); if(!e) return false;
  if(feld==='werte') e.werte = Array.isArray(wert)?wert:String(wert||'').split(/\s*[·,;|]\s*/).filter(Boolean);
  else if(feld==='alsReichweite') e.alsReichweite = !!wert;
  else e[feld] = wert;
  saveEig(); return true;
}
/* Löschen entfernt die Definition UND die Vergaben — sonst blieben unsichtbare
   Werte an den Standards hängen, die beim nächsten gleichnamigen Merkmal
   wieder auftauchen würden. */
function eigLoeschen(key){
  EIG = EIG.filter(x=>x.key!==key); saveEig();
  Object.keys(EIGSTD).forEach(sid=>{ if(EIGSTD[sid] && key in EIGSTD[sid]){
    delete EIGSTD[sid][key]; if(!Object.keys(EIGSTD[sid]).length) delete EIGSTD[sid]; } });
  saveEigStd();
}
function eigVerschieben(key, richtung){
  const l = eigListe(); const i = l.findIndex(x=>x.key===key); const j = i+(richtung<0?-1:1);
  if(i<0 || j<0 || j>=l.length) return false;
  const t=l[i]; l[i]=l[j]; l[j]=t;
  l.forEach((x,n)=>{ const e=eigOf(x.key); if(e) e.ord=n; });
  saveEig(); return true;
}

/* ═══════════ 2. Vergabe ═══════════ */

/* Der Wert einer Eigenschaft an einem Standard.
   `undefined` heißt ausdrücklich „ohne Angabe" — und das ist ein eigener,
   zählbarer Zustand, kein Nein. */
function eigWert(sid, key){
  const m = EIGSTD[sid]; if(!m) return undefined;
  return (key in m) ? m[key] : undefined;
}
function eigSetzen(sid, key, wert){
  if(!sid || !eigOf(key)) return false;
  const m = EIGSTD[sid] = EIGSTD[sid] || {};
  if(wert===undefined || wert===null || wert===''){ delete m[key]; }
  else m[key] = wert;
  if(!Object.keys(m).length) delete EIGSTD[sid];
  saveEigStd();
  if(typeof facCacheLeeren==='function') facCacheLeeren();
  return true;
}
/* Alle Standards, die eine Eigenschaft tragen. Bei `ja` zählt nur ein echtes
   Ja; bei den anderen Arten jeder gesetzte Wert (oder ein bestimmter). */
function eigStandards(key, wert){
  const out = [];
  Object.keys(EIGSTD).forEach(sid=>{
    const v = eigWert(sid, key);
    if(v===undefined) return;
    if(wert!==undefined){ if(String(v)!==String(wert)) return; }
    else if(v===false) return;
    out.push(sid);
  });
  return out;
}
/* Trägt DIESER Standard die Eigenschaft? (für die Reichweiten-Auflösung) */
function eigHat(sid, key){ const v=eigWert(sid,key); return v!==undefined && v!==false; }

/* Die ehrliche Bilanz einer Eigenschaft. */
function eigBilanz(key){
  const e = eigOf(key); const alle = (typeof DB!=='undefined'&&DB&&DB.standards) ? DB.standards : [];
  const b = { gesamt:alle.length, ja:0, nein:0, ohne:0, verteilung:{} };
  alle.forEach(s=>{
    const v = eigWert(s.id, key);
    if(v===undefined){ b.ohne++; return; }
    if(e && e.art==='ja'){ if(v===false) b.nein++; else b.ja++; return; }
    b.ja++;
    const w = String(v);
    b.verteilung[w] = (b.verteilung[w]||0)+1;
  });
  return b;
}

/* ═══════════ 3. Anzeige am Standard ═══════════ */

/* Die Chip-Reihe im Standardkopf. Nur gesetzte Merkmale — ein „ohne Angabe"
   gehört in die Verwaltung, nicht in den Saal. */
function eigChips(sid){
  const out = [];
  eigKopfListe().forEach(e=>{
    const v = eigWert(sid, e.key);
    if(v===undefined || v===false) return;
    const text = (e.art==='ja') ? e.wort : (e.wort+': '+String(v));
    out.push({ e, text });
  });
  return out;
}
function eigKopfHTML(s){
  if(!s) return '';
  const chips = eigChips(s.id);
  const admin = (typeof ADMIN!=='undefined') && ADMIN;
  if(!chips.length && !admin) return '';
  const inner = chips.map(c=>
    `<span class="eig-chip"${c.e.farbe?` style="--eig:${esc(c.e.farbe)}"`:''}>${esc(c.e.symbol||'🏷️')} ${esc(c.text)}</span>`).join('');
  const knopf = admin
    ? `<button type="button" class="eig-edit" data-s="${esc(s.id)}" onclick="eigSheet(this.dataset.s)">${chips.length?'✎ Merkmale':'＋ Merkmale'}</button>`
    : '';
  return `<div class="eig-leiste">${inner}${knopf}</div>`;
}

/* Merkmale eines Standards setzen — als Sheet, damit man den Standard im Blick
   behält. Kein natives Eingabefenster (Grundsatz ⑧). */
function eigSheet(sid){
  if(typeof ADMIN!=='undefined' && !ADMIN){ if(typeof promptLoginThen==='function'){ promptLoginThen(()=>eigSheet(sid)); return; } }
  const liste = eigListe();
  const s = (typeof DB!=='undefined'&&DB&&DB.standards) ? DB.standards.find(x=>x.id===sid) : null;
  let h = `<div class="sheet-grip"></div><div class="sheet-title">Merkmale</div>
    <div class="sheet-name">${esc(s?stdTitel(s):sid)}</div>`;
  if(!liste.length){
    h += `<p class="hint" style="padding:0 4px">Noch keine Merkmale angelegt. Sie entstehen in der Verwaltung unter „🏷️ Merkmale an Standards" — dort legt das Haus fest, welche es gibt.</p>`;
  }
  h += `<div class="eig-form">`;
  liste.forEach(e=>{
    const v = eigWert(sid, e.key);
    h += `<div class="eig-zeile"><div class="eig-lbl">${esc(e.symbol||'🏷️')} ${esc(e.wort)}</div>`;
    if(e.art==='ja'){
      const knopf=(w,txt,an)=>`<button type="button" class="eig-w${an?' on':''}" data-s="${esc(sid)}" data-k="${esc(e.key)}" data-v="${esc(w)}" onclick="eigUiJa(this.dataset.s,this.dataset.k,this.dataset.v)">${esc(txt)}</button>`;
      h += `<div class="eig-wahl">${knopf('ja','Ja',v===true)}${knopf('nein','Nein',v===false)}${knopf('','ohne Angabe',v===undefined)}</div>`;
    } else if(e.art==='auswahl'){
      const opts = ['<option value="">— ohne Angabe —</option>'].concat((e.werte||[]).map(w=>`<option value="${esc(w)}" ${String(v)===String(w)?'selected':''}>${esc(w)}</option>`)).join('');
      h += `<select class="form-sel" data-s="${esc(sid)}" data-k="${esc(e.key)}" onchange="eigUiWert(this.dataset.s,this.dataset.k,this.value)">${opts}</select>`;
    } else {
      h += `<input class="loc-input" value="${esc(v===undefined?'':String(v))}" placeholder="Angabe" data-s="${esc(sid)}" data-k="${esc(e.key)}" onchange="eigUiWert(this.dataset.s,this.dataset.k,this.value)">`;
    }
    h += `</div>`;
  });
  h += `</div>`;
  h += `<button class="sheet-close" onclick="showSheet(false);if(typeof openStandard==='function'&&curStd)openStandard(curStd.id,true)">Fertig</button>`;
  $('sheet').innerHTML = h;
  if(typeof showSheet==='function') showSheet(true);
}
function eigUiJa(sid, key, wahl){
  eigSetzen(sid, key, wahl==='ja' ? true : (wahl==='nein' ? false : undefined));
  eigSheet(sid);
}

/* ═══════════ 3b. Häkchen direkt im Menü ═══════════

   „Merkmale sollen über das Menü mit einer Checkbox einem standard zugeordnet
   werden … macht die Arbeit schneller."

   Vorher waren es für EIN Merkmal vier Berührungen: ⋯ öffnen · „Merkmale" ·
   „Ja" · „Fertig". Und jede Wahl zeichnete die ganze Karte neu. Jetzt steht
   das Häkchen im Menü selbst: ⋯ öffnen · antippen. Beim zweiten und dritten
   Merkmal ist es je EINE Berührung mehr statt vier.

   ── Was ein Häkchen kann und was nicht ──
   Ein „ja"-Merkmal kennt DREI Zustände: Ja, ausdrückliches Nein, und „nie
   gefragt". Ein Häkchen kennt zwei. Das Antippen schaltet deshalb zwischen
   „Ja" und „ohne Angabe" — die beiden, die man im Alltag braucht.

   Ein ausdrückliches NEIN wird nicht heimlich verschluckt: Es steht als ✕ in
   der Zeile, und gesetzt wird es weiterhin über „Merkmale" im selben Menü.
   Ein Häkchen, das ein gepflegtes Nein beim Antippen still in „ohne Angabe"
   verwandelte, würde Wissen vernichten (Grundsatz ①: leer schlägt falsch).

   ── Warum nur „ja"-Merkmale ──
   „Vorbereitungszeit: 45 min" lässt sich nicht ankreuzen. Merkmale mit Wert
   oder Auswahl bleiben in der Karte „Merkmale" — dort gehören sie hin.

   ── A7 ──
   Langes Tippen auf eine Häkchen-Zeile öffnet die Einstellung DIESES Merkmals
   (Wort, Symbol, ausblenden) — nicht ein Untermenü irgendwo anders. */

/* Die Merkmale, die sich ankreuzen lassen. `zeigen:'still'` heißt: nicht im
   Kopf und nicht in der Übersicht — dann auch nicht hier. */
function eigHakenListe(){ return eigKopfListe().filter(e=>e.art==='ja'); }

function eigHakenZeile(sid, e){
  const v = eigWert(sid, e.key);
  const an = v===true, nein = v===false;
  const zeichen = an ? '✓' : (nein ? '✕' : '');
  return `<button type="button" class="eig-haken${an?' on':''}${nein?' nein':''}"
    role="checkbox" aria-checked="${an?'true':'false'}"
    data-s="${esc(sid)}" data-k="${esc(e.key)}"
    onclick="eigHakenTippen(this.dataset.s,this.dataset.k)">
    <span class="eig-hk-box" aria-hidden="true">${zeichen}</span>
    <span class="eig-hk-wort">${esc(e.symbol||'🏷️')} ${esc(e.wort)}</span>
    ${nein?'<span class="eig-hk-sub">ausdrücklich nein</span>':''}</button>`;
}
function eigHakenHTML(sid){
  const liste = eigHakenListe();
  if(!liste.length) return '';
  return `<div class="eig-haken-block">${liste.map(e=>eigHakenZeile(sid,e)).join('')}</div>`;
}

/* Antippen. Aufgefrischt wird NUR die eine Zeile — die Karte neu zu zeichnen
   würde bei jedem Häkchen nach oben springen, und wer fünf Merkmale vergibt,
   sucht danach fünfmal seine Stelle wieder. */
function eigHakenTippen(sid, key){
  const an = eigWert(sid, key)===true;
  eigSetzen(sid, key, an ? undefined : true);
  const e = eigOf(key); if(!e) return;
  if(typeof document==='undefined') return;
  const zeilen = document.querySelectorAll('.eig-haken');
  for(let i=0;i<zeilen.length;i++){
    const z = zeilen[i];
    if(z.dataset.s!==String(sid) || z.dataset.k!==String(key)) continue;
    const neu = document.createElement('div');
    neu.innerHTML = eigHakenZeile(sid, e);
    if(neu.firstElementChild) z.replaceWith(neu.firstElementChild);
  }
}

/* Langdruck: die Einstellung DIESES Merkmals. Bewusst NICHT über
   features/funktionen.js — ein Merkmal hat sein Wort und sein Symbol schon
   selbst. Zwei Speicher für denselben Namen wären zwei Wahrheiten. */
let eigFlaeche = null;
function eigFlaecheSheet(key){
  if(typeof ADMIN!=='undefined' && !ADMIN) return;
  if(!eigOf(key)) return;
  eigFlaeche = key;
  eigFlaecheZeichnen();
  if(typeof showSheet==='function') showSheet(true);
}
function eigFlaecheZeichnen(){
  const e = eigOf(eigFlaeche); if(!e || typeof $!=='function' || !$('sheet')) return;
  const b = eigBilanz(e.key);
  $('sheet').innerHTML = `<div class="sheet-grip"></div><div class="sheet-title">Merkmal</div>
    <div class="sheet-name">${esc(e.symbol||'🏷️')} ${esc(e.wort)}</div>
    <p class="why-help">Gilt überall: im Kopf jedes Standards, in der Übersicht und in dieser Liste. Vergeben ist es an ${b.ja} von ${b.gesamt} Standards.</p>
    <div class="form-grp"><div class="flabel">Wort</div>
      <input class="loc-input" id="eigFlWort" value="${esc(e.wort)}"></div>
    <div class="form-grp"><div class="flabel">Symbol</div>
      <input class="loc-input" id="eigFlIco" value="${esc(e.symbol||'')}" maxlength="4"></div>
    <div class="p-actions"><button class="btn btn-pri" onclick="eigFlaecheSpeichern()">Übernehmen</button></div>
    <div class="sheet-pick" style="margin-top:10px">
      <button class="sheet-pick-btn" onclick="eigFlaecheSchalten()">🚫 Aus Kopf, Übersicht und Menü nehmen</button>
    </div>
    <p class="hint" style="padding:8px 4px">Die Vergaben bleiben dabei erhalten. Ganz löschen geht nur in der Verwaltung unter „💤 Merkmale an Standards" — dort steht auch, wie viele Standards es trägt.</p>
    <button class="sheet-close" onclick="showSheet(false)">Schließen</button>`;
}
function eigFlaecheSpeichern(){
  const e = eigOf(eigFlaeche); if(!e) return;
  const w = ($('eigFlWort') && $('eigFlWort').value || '').trim();
  const i = ($('eigFlIco')  && $('eigFlIco').value  || '').trim();
  if(w) eigAendern(e.key, 'wort', w);
  eigAendern(e.key, 'symbol', i || '🏷️');
  if(typeof facCacheLeeren==='function') facCacheLeeren();
  if(typeof showSheet==='function') showSheet(false);
  eigNachAenderung();
  if(typeof toast==='function') toast('Übernommen');
}
function eigFlaecheSchalten(){
  const e = eigOf(eigFlaeche); if(!e) return;
  eigAendern(e.key, 'zeigen', e.zeigen==='still' ? 'kopf' : 'still');
  if(typeof facCacheLeeren==='function') facCacheLeeren();
  if(typeof showSheet==='function') showSheet(false);
  eigNachAenderung();
  if(typeof toast==='function') toast(e.zeigen==='still' ? 'Aus der Anzeige genommen — in der Verwaltung erreichbar' : 'Wieder sichtbar');
}
/* Nach einer Änderung am Merkmal: das Menü steht noch auf demselben Standard,
   also dieselbe Karte neu — sonst zeigte sie das alte Wort. */
function eigNachAenderung(){
  if(typeof curStd!=='undefined' && curStd && typeof openStandard==='function') openStandard(curStd.id, true);
  if(typeof renderStandards==='function' && typeof curSeg!=='undefined') renderStandards();
}
function eigUiWert(sid, key, wert){
  eigSetzen(sid, key, String(wert||'').trim() || undefined);
}

/* ═══════════ 4. Verwaltung ═══════════ */

let eigForm = null;   /* {art:'neu'} — offene Eingabefläche statt prompt() */

function eigPanelHTML(){
  const liste = eigListe();
  const head = (typeof vsum==='function')
    ? vsum('💤','Merkmale an Standards','Eigenschaften wie „sedierungspflichtig" — anlegen, zählen, als Reichweite freigeben', liste.length?(liste.length+' angelegt'):'')
    : `<summary>🏷️ Merkmale an Standards</summary>`;
  let h = `<details class="vpanel" data-keys="merkmale eigenschaften facetten sedierung sedierungspflichtig attribute kennzeichen statistik zählen reichweite">
    ${head}<div class="vpanel-body">
    <p class="panel-help">Ein Merkmal ist <b>keine Kategorie</b>: Ein Eingriff trägt beliebig viele. Merkmale erscheinen im Standardkopf, lassen sich in der Übersicht filtern, werden hier gezählt — und können als <b>Reichweite</b> dienen („alle sedierungspflichtigen Eingriffe gleichzeitig ändern").</p>`;

  if(!liste.length) h += `<p class="hint">Noch kein Merkmal angelegt.</p>`;

  liste.forEach(e=>{
    const b = eigBilanz(e.key);
    const zahlen = (e.art==='ja')
      ? `${b.ja} ja · ${b.nein} ausdrücklich nein · ${b.ohne} ohne Angabe`
      : `${b.ja} mit Angabe · ${b.ohne} ohne Angabe`;
    const vert = Object.keys(b.verteilung).sort().map(w=>`<span class="schip">${esc(w)}: ${b.verteilung[w]}</span>`).join('');
    h += `<div class="eig-karte">
      <div class="eig-kopf">
        <input class="loc-input eig-sym" value="${esc(e.symbol||'')}" maxlength="4" data-k="${esc(e.key)}" onchange="eigUiFeld(this.dataset.k,'symbol',this.value)" aria-label="Symbol">
        <input class="loc-input eig-wort" value="${esc(e.wort)}" data-k="${esc(e.key)}" onchange="eigUiFeld(this.dataset.k,'wort',this.value)" aria-label="Bezeichnung">
        <select class="form-sel" data-k="${esc(e.key)}" onchange="eigUiFeld(this.dataset.k,'art',this.value)" aria-label="Art">
          ${EIG_ARTEN.map(a=>`<option value="${esc(a)}" ${e.art===a?'selected':''}>${esc(eigArtWort(a))}</option>`).join('')}
        </select>
      </div>
      ${e.art==='auswahl'?`<input class="loc-input" value="${esc((e.werte||[]).join(' · '))}" placeholder="Werte, getrennt durch ·" data-k="${esc(e.key)}" onchange="eigUiFeld(this.dataset.k,'werte',this.value)">`:''}
      <div class="eig-zahlen">${esc(zahlen)}${vert?`<div class="eig-vert">${vert}</div>`:''}</div>
      <div class="eig-schalter">
        <label class="eig-chk"><input type="checkbox" ${e.zeigen!=='still'?'checked':''} data-k="${esc(e.key)}" onchange="eigUiFeld(this.dataset.k,'zeigen',this.checked?'kopf':'still')"> im Standardkopf und in der Übersicht zeigen</label>
        <label class="eig-chk"><input type="checkbox" ${e.alsReichweite?'checked':''} data-k="${esc(e.key)}" onchange="eigUiFeld(this.dataset.k,'alsReichweite',this.checked)"> als Reichweite anbieten (Sammeländerung)</label>
      </div>
      <div class="eig-akt">
        <button data-k="${esc(e.key)}" onclick="eigUiVerschieben(this.dataset.k,-1)" aria-label="nach oben">⬆</button>
        <button data-k="${esc(e.key)}" onclick="eigUiVerschieben(this.dataset.k,1)" aria-label="nach unten">⬇</button>
        <button data-k="${esc(e.key)}" onclick="eigUiListe(this.dataset.k)">Standards zeigen</button>
        <button class="dgr" data-k="${esc(e.key)}" onclick="eigUiLoeschen(this.dataset.k)">Löschen</button>
      </div>
      <div class="eig-treffer" id="eigTreffer-${esc(e.key)}"></div>
    </div>`;
  });

  h += (eigForm && eigForm.art==='neu')
    ? `<div class="eig-neu"><input class="loc-input" id="eigNeuInp" placeholder="Name des Merkmals, z. B. sedierungspflichtig">
        <div class="p-actions"><button class="btn btn-sec" onclick="eigUiAbbrechen()">Abbrechen</button><button class="btn btn-pri" onclick="eigUiAnlegenSpeichern()">Anlegen</button></div></div>`
    : `<div class="p-actions"><button class="btn btn-sec" onclick="eigUiAnlegen()">＋ Merkmal anlegen</button></div>`;

  h += `</div></details>`;
  return h;
}
function eigUiAnlegen(){ eigForm={art:'neu'}; if(typeof renderAdmin==='function') renderAdmin();
  setTimeout(()=>{ const i=$('eigNeuInp'); if(i) i.focus(); },50); }
function eigUiAbbrechen(){ eigForm=null; if(typeof renderAdmin==='function') renderAdmin(); }
function eigUiAnlegenSpeichern(){
  const i = $('eigNeuInp'); const w = (i&&i.value||'').trim();
  if(!w){ if(typeof toast==='function') toast('Bitte einen Namen eingeben',true); return; }
  eigAnlegen(w,'ja'); eigForm=null;
  if(typeof renderAdmin==='function') renderAdmin();
  if(typeof toast==='function') toast('Merkmal „'+w+'" angelegt');
}
function eigUiFeld(key, feld, wert){
  eigAendern(key, feld, wert);
  if(feld==='art'||feld==='werte'||feld==='zeigen'||feld==='alsReichweite'){ if(typeof renderAdmin==='function') renderAdmin(); }
  if(typeof facCacheLeeren==='function') facCacheLeeren();
  if(typeof toast==='function') toast('Übernommen');
}
function eigUiVerschieben(key, richtung){ if(eigVerschieben(key,richtung) && typeof renderAdmin==='function') renderAdmin(); }
function eigUiLoeschen(key){
  const e = eigOf(key); if(!e) return;
  const n = eigStandards(key).length;
  const box = $('eigTreffer-'+key); if(!box) return;
  box.innerHTML = `<div class="eig-warn">Merkmal „${esc(e.wort)}" löschen? ${n?('Es ist an '+n+' Standard(s) vergeben; diese Angaben verschwinden mit.'):'Es ist nirgends vergeben.'}
    <div class="p-actions"><button class="btn btn-sec" data-k="${esc(key)}" onclick="eigUiListe(this.dataset.k)">Abbrechen</button>
    <button class="btn btn-pri" data-k="${esc(key)}" onclick="eigLoeschen(this.dataset.k);renderAdmin();toast('Merkmal gelöscht')">Endgültig löschen</button></div></div>`;
}
function eigUiListe(key){
  const box = $('eigTreffer-'+key); if(!box) return;
  const sids = eigStandards(key);
  if(!sids.length){ box.innerHTML = `<p class="hint">Noch keinem Standard zugeordnet.</p>`; return; }
  box.innerHTML = sids.map(sid=>{
    const s = DB.standards.find(x=>x.id===sid);
    const v = eigWert(sid,key);
    return `<button class="eig-treff" data-s="${esc(sid)}" onclick="showSheet(false);setMode('use');openStandard(this.dataset.s)">${esc(s?stdTitel(s):sid)}${(v!==true)?` <span class="ps-sub">${esc(String(v))}</span>`:''}</button>`;
  }).join('');
}
