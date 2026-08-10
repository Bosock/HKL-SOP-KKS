/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — DER KOPF EINES STANDARDS ALS BAUPLAN

   Der Kopf eines Standards war eine feste Abfolge im Quelltext: erst die
   Varianten-Leiste, dann der Freigabe-Kasten, dann der Verwaltungsbalken,
   dann die Plankosten. Wer daran etwas ändern wollte — eine Zeile weg, eine
   andere Reihenfolge, ein eigenes Wort — brauchte einen Entwickler. Genau das
   verbietet Grundsatz ⑤ / A7.

   Jetzt ist der Kopf eine LISTE VON BAUSTEINEN. Jeder trägt:
       an/aus · eigenes Wort · Reihenfolge
   und wird in der Verwaltung unter „🧱 Standardkopf" gepflegt.

   Der Code kennt nur die Schlüssel (`titel`, `freigabe`, …) — die Wörter
   kommen aus der Einstellung oder aus dem Rückfall. Das ist dieselbe Bauart
   wie das Funktionsregister (features/funktionen.js); wer eines von beiden
   versteht, versteht auch das andere (Grundsatz ⑥).

   ── Was NICHT abschaltbar ist ──
   Nichts. Auch ein völlig leerer Kopf ist erlaubt: Der Titel steht ohnehin in
   der Kopfleiste, und wer den Kopf leer räumt, will das. Bleibt der Bereich
   leer, entsteht kein Markup — keine leere Fläche, die wie ein Fehler aussieht.
   ───────────────────────────────────────────────────────────── */

/* ═══════════ 1. Die Bausteine des Kopfes ═══════════ */

/* `tun(s)` liefert HTML oder ''. Ein Baustein, der nichts zu sagen hat, sagt
   nichts — er hinterlässt keine leere Zeile. `nur:'admin'` blendet ihn für
   Nutzer aus, ohne dass die Einstellung das leisten müsste. */
const KOPF_BAUSTEINE = [
  { key:'varianten', wort:'Arzt-Varianten',   sub:'Reiter „Standard | Dr. X"',
    tun:(s)=> (typeof varBarHTML==='function') ? varBarHTML(s.id) : '' },

  { key:'freigabe',  wort:'Freigabe-Vermerk', sub:'Zustand, Version, Gültigkeit',
    tun:(s)=> (typeof frgKopfHTML==='function') ? frgKopfHTML(s) : '' },

  { key:'eigenschaften', wort:'Merkmale',     sub:'z. B. sedierungspflichtig',
    tun:(s)=> (typeof eigKopfHTML==='function') ? eigKopfHTML(s) : '' },

  { key:'titel',     wort:'Titel & Gruppe',   sub:'noch einmal groß im Inhalt',
    tun:(s)=> `<div class="kopf-titel"><div class="kt-name">${esc(stdTitel(s))}</div><div class="kt-grp">${esc(stdGruppe(s))}</div></div>` },

  { key:'beschreibung', wort:'Beschreibung',  sub:'freier Text am Standard',
    tun:(s)=>{ const t=stdBeschreibung(s); return t ? `<div class="kopf-text">${stdKopfAbsatz(t)}</div>` : ''; } },

  { key:'bild',      wort:'Bilder',           sub:'Fotos am Standard selbst',
    tun:(s)=> (typeof medAnkerHTML==='function') ? medAnkerHTML(medAnkStd(s.id), stdTitel(s)) : '' },

  { key:'hinweis',   wort:'Hinweis-Banner',   sub:'gepflegte Hinweise zum Standard',
    tun:(s)=> (typeof hintsBlockHTML==='function') ? hintsBlockHTML('std', s.id) : '' },

  { key:'zaehler',   wort:'Umfang',           sub:'Rubriken und Einträge in Zahlen',
    tun:(s)=>{ const z=stdUmfang(s);
      return `<div class="kopf-zahlen"><span class="schip">🗂 ${z.rubriken} Rubriken</span><span class="schip">📋 ${z.eintraege} Einträge</span>${z.bilder?`<span class="schip">🖼 ${z.bilder} Bilder</span>`:''}</div>`; } },

  { key:'verwaltung',wort:'Verwaltungsbalken',sub:'Bearbeiten · ＋ Rubrik', nur:'admin',
    tun:(s)=> stdVerwaltungHTML(s) },

  { key:'kosten',    wort:'Plankosten',       sub:'Summe der hinterlegten Preise', nur:'admin',
    tun:(s)=> stdKostenHTML(s) }
];

/* ═══════════ 2. Die Einstellung ═══════════ */

let KOPF = (typeof loadJSON==='function') ? loadJSON('hkl_stdkopf', {}) : {};
if(!KOPF || typeof KOPF!=='object') KOPF = {};
function saveKopf(){ if(typeof saveJSON==='function') saveJSON('hkl_stdkopf', KOPF); }

function kopfWert(key, feld, vorgabe){
  const k = KOPF[key];
  if(k && k[feld]!==undefined && k[feld]!==null && k[feld]!=='') return k[feld];
  return vorgabe;
}
function kopfAus(key){ return !!(KOPF[key] && KOPF[key].aus); }
function kopfSetzen(key, feld, wert){
  const leer = (wert===null || wert===undefined || wert==='' || wert===false);
  if(leer){ if(KOPF[key]){ delete KOPF[key][feld]; if(!Object.keys(KOPF[key]).length) delete KOPF[key]; } }
  else { (KOPF[key]=KOPF[key]||{})[feld]=wert; }
  saveKopf();
}
function kopfZuruecksetzen(){ KOPF = {}; saveKopf(); }
function kopfGeaendert(){ return Object.keys(KOPF||{}).length>0; }

/* Die Bausteine in geltender Reihenfolge. Wer keine eigene Reihenfolge
   vergeben hat, behält die ausgelieferte — deshalb der Index als Rückfall. */
function kopfListe(istAdmin){
  return KOPF_BAUSTEINE
    .map((b,i)=>({ b, ord: Number(kopfWert(b.key,'ord', i)) }))
    .filter(x=> !kopfAus(x.b.key))
    .filter(x=> x.b.nur!=='admin' || istAdmin)
    .sort((a,b2)=> a.ord - b2.ord)
    .map(x=>x.b);
}

/* ═══════════ 3. Der Kopf selbst ═══════════ */

function stdKopfHTML(s){
  if(!s) return '';
  const istAdmin = (typeof ADMIN!=='undefined') && ADMIN;
  let h = '';
  kopfListe(istAdmin).forEach(b=>{
    let teil = '';
    try{ teil = b.tun(s) || ''; }catch(e){ teil = ''; }
    if(teil) h += teil;
  });
  /* Eine Hülle mit der Kennung des Standards. Daran erkennt der Halte-Detektor
     (features/quickmenu.js), dass der ganze Kopf bedienbar ist: langes Tippen
     darauf öffnet das ⋯-Menü des Standards.

     Warum die HÜLLE und nicht die einzelnen Bausteine: Der Kopf ist ein
     Bauplan — welche Bausteine er zeigt, entscheidet das Haus. Eine Kennung
     an jedem einzelnen müsste bei jedem neuen Baustein nachgetragen werden
     und würde genau dann vergessen. */
  return h ? `<div class="std-kopf" data-sid="${esc(s.id)}">${h}</div>` : '';
}

/* ── Helfer der einzelnen Bausteine ── */

/* Freier Beschreibungstext am Standard. Liegt in den Standard-Angaben (STDE),
   damit er dem Standard folgt und nicht einem Gerät. */
function stdBeschreibung(s){
  const m = (typeof STDE!=='undefined' && STDE) ? (STDE[s.id]||{}) : {};
  return String(m.beschreibung||'').trim();
}
/* Absätze erhalten, alles andere entschärfen — der Text kommt von Menschen. */
function stdKopfAbsatz(t){
  return String(t||'').split(/\n{2,}/).map(p=>`<p>${esc(p).replace(/\n/g,'<br>')}</p>`).join('');
}

function stdUmfang(s){
  let eintraege = 0, bilder = 0;
  (s.rubriken||[]).forEach((r,ri)=>{
    (r.sub_bereiche||[]).forEach((sb,si)=>{
      (sb.eintraege||[]).forEach((e,ei)=>{
        if(!e || e.natur==='ueberschrift') return;
        eintraege++;
        if(typeof medVonEintrag==='function' && typeof cidOf==='function'){
          bilder += medVonEintrag(e, cidOf(s.id,ri,si,ei)).length;
        }
      });
    });
  });
  return { rubriken:(s.rubriken||[]).length, eintraege, bilder };
}

function stdVerwaltungHTML(s){
  const hiddenNow = (typeof stdHidden==='function') ? stdHidden(s) : false;
  return `<div class="banner" style="padding:12px 14px"><div style="display:flex;flex-wrap:wrap;gap:7px;align-items:center">
    <span style="font-size:12px;font-weight:700;color:var(--text-dim)">${esc(kopfWert('verwaltung','kopf','STANDARD'))}${s.__new?' · <span style="color:var(--accent)">App-eigen</span>':''}${hiddenNow?' · <span style="color:var(--warn)">ausgeblendet</span>':''}</span>
    <span style="flex:1"></span>
    <button class="btn btn-sec" style="flex:0 0 auto;min-height:40px;padding:8px 13px;font-size:12.5px" onclick="openStdSheet()">✎ Bearbeiten</button>
    <button class="btn btn-sec" style="flex:0 0 auto;min-height:40px;padding:8px 13px;font-size:12.5px" onclick="addRubrik()">＋ Rubrik</button>
  </div></div>`;
}

function stdKostenHTML(s){
  if(typeof stdPlankosten!=='function') return '';
  const pk = stdPlankosten(s);
  if(!pk || !pk.items) return '';
  const miss = pk.items - pk.priced;
  return `<div class="banner cost-banner"><div class="cost-total"><span class="cost-lbl">${esc(kopfWert('kosten','wort','Plankosten'))}</span><span class="cost-val">${fmtEUR(pk.total)}</span></div>
    <div class="cost-sub">${pk.priced}/${pk.items} Materialien mit Preis${miss>0?` · ${miss} ohne Preis (in „Material pflegen" ergänzen)`:''}</div></div>`;
}

/* ═══════════ 4. Verwaltung ═══════════ */

function kopfPanelHTML(){
  const istAdmin = true;
  const zeilen = KOPF_BAUSTEINE
    .map((b,i)=>({ b, ord:Number(kopfWert(b.key,'ord', i)) }))
    .sort((a,c)=>a.ord-c.ord)
    .map(({b})=>{
      const aus = kopfAus(b.key);
      const wort = kopfWert(b.key,'wort', b.wort);
      return `<div class="fkt-zeile${aus?' fkt-aus':''}">
        <div class="fkt-haupt">
          <input class="loc-input fkt-name" value="${esc(wort)}" data-k="${esc(b.key)}"
            onchange="kopfUiWort(this.dataset.k,this.value)" aria-label="Bezeichnung">
          <div class="fkt-sub">${esc(b.sub)}${b.nur==='admin'?' · nur Verwaltung':''}</div>
        </div>
        <div class="fkt-akt">
          <button data-k="${esc(b.key)}" onclick="kopfUiVerschieben(this.dataset.k,-1)" aria-label="nach oben">⬆</button>
          <button data-k="${esc(b.key)}" onclick="kopfUiVerschieben(this.dataset.k,1)" aria-label="nach unten">⬇</button>
          <button class="${aus?'':'dgr'}" data-k="${esc(b.key)}" onclick="kopfUiSchalten(this.dataset.k)">${aus?'Einblenden':'Ausblenden'}</button>
        </div></div>`;
    }).join('');
  const head = (typeof vsum==='function')
    ? vsum('🪧','Standardkopf','Was oben in einem Standard steht — Reihenfolge, Wortlaut, an/aus', kopfGeaendert()?'angepasst':'')
    : `<summary>🧱 Standardkopf</summary>`;
  return `<details class="vpanel" data-keys="standardkopf kopf oben titel freigabe merkmale beschreibung bilder plankosten reihenfolge">
    ${head}<div class="vpanel-body">
    <p class="panel-help">Der Kopf eines Standards ist eine Liste von Bausteinen. Jeder lässt sich <b>umbenennen</b>, <b>verschieben</b> und <b>ausblenden</b> — ohne Programmierung. Ein Baustein ohne Inhalt erscheint gar nicht erst.</p>
    <div class="fkt-liste">${zeilen}</div>
    <div class="p-actions"><button class="btn btn-sec" onclick="kopfUiZuruecksetzen()">Auf Auslieferung zurücksetzen</button></div>
    </div></details>`;
}

function kopfUiWort(key, wert){
  const b = KOPF_BAUSTEINE.find(x=>x.key===key); if(!b) return;
  kopfSetzen(key,'wort', (String(wert||'').trim()===b.wort) ? '' : String(wert||'').trim());
  if(typeof toast==='function') toast('Bezeichnung übernommen');
}
function kopfUiSchalten(key){
  kopfSetzen(key,'aus', !kopfAus(key));
  if(typeof renderAdmin==='function') renderAdmin();
  if(typeof toast==='function') toast(kopfAus(key)?'Ausgeblendet':'Wieder sichtbar');
}
function kopfUiVerschieben(key, richtung){
  const liste = KOPF_BAUSTEINE
    .map((b,i)=>({ key:b.key, ord:Number(kopfWert(b.key,'ord', i)) }))
    .sort((a,b)=>a.ord-b.ord);
  const i = liste.findIndex(x=>x.key===key); const j = i + (richtung<0?-1:1);
  if(i<0 || j<0 || j>=liste.length) return;
  const t = liste[i]; liste[i] = liste[j]; liste[j] = t;
  liste.forEach((x,n)=>kopfSetzen(x.key,'ord', n));
  if(typeof renderAdmin==='function') renderAdmin();
}
function kopfUiZuruecksetzen(){
  kopfZuruecksetzen();
  if(typeof renderAdmin==='function') renderAdmin();
  if(typeof toast==='function') toast('Standardkopf auf Auslieferung zurückgesetzt');
}
