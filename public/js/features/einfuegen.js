/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — EINE GANZE LISTE AUF EINMAL

   Der Betreiber, nachdem er zum ersten Mal einen Standard in der App
   geschrieben hat: „Es ist sehr holprig."

   Das ist es, und der Grund ist zählbar. Ein Standard hat 60 bis 100 Zeilen.
   Für jede einzelne öffnet man das Formular, tippt, speichert, wartet auf den
   Neuaufbau der Liste, öffnet das Formular wieder. Die Liste, die man
   abschreibt, liegt dabei meist schon fertig daneben — in Word, in einer
   Mail, auf einem Zettel, den jemand abfotografiert hat.

   Hier wird sie in EINEM Zug übernommen: einfügen, prüfen, fertig.

   ── Warum ein Prüfschritt dazwischen liegt ──
   Eingefügter Text ist unordentlich. Da stehen Spiegelstriche, Nummern,
   Tabulatoren aus einer Tabelle, Mengen mal vorn und mal hinten, leere Zeilen
   und Überschriften. Ein Werkzeug, das das stillschweigend übernimmt, erzeugt
   60 halbfalsche Zeilen — und die sind teurer als 60 getippte richtige.

   Deshalb: Die Maschine zerlegt und SCHLÄGT VOR, der Mensch sieht jede Zeile
   und entscheidet (Grundsatz ③, Grundsatz ⑨). Was sie nicht sicher erkennt,
   lässt sie stehen, statt zu raten.

   ── Der stille Gewinn ──
   Beim Prüfen wird jede Zeile gegen den vorhandenen Bestand gehalten. Steht
   „Radialschleuse 6F" schon irgendwo, wird GENAU diese Schreibweise
   übernommen. Damit ist die Zeile automatisch dasselbe Material wie ihre 22
   Geschwister — und erbt Foto, Maße und Preis, ohne dass jemand etwas dafür
   tut. Uneinheitliche Schreibweisen sind der teuerste Fehler in diesem
   Datenbestand; hier werden sie gar nicht erst geboren.
   ───────────────────────────────────────────────────────────── */

/* ═══════════ 1. Zerlegen (rein und prüfbar) ═══════════ */

const EINF_MAX = 300;      /* Grenze je Einfügung — darüber ist es ein Import */

/* Was am Zeilenanfang steht und nicht zum Namen gehört:
   Spiegelstriche jeder Art, Aufzählungszeichen, Nummerierungen. */
const EINF_VORNE = /^\s*(?:[-–—•*·▪‣>»]+\s*|\(?\d{1,3}[.)]\s+|\(\d{1,3}\)\s*|[a-zA-Z][.)]\s+)/;

/* Eine Menge am Anfang: „2x", „2 x", „3×", „10 Stk.", „2 St" */
const EINF_MENGE_VORNE = /^\s*(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:[xX×]|St(?:k|ück)?\.?|Stck\.?)?\s+(?=\S)/;
/* … oder am Ende: „Radialschleuse 2x", „Kompressen 10 Stk." */
const EINF_MENGE_HINTEN = /\s+(\d{1,4})\s*(?:[xX×]|St(?:k|ück)?\.?|Stck\.?)\s*$/;

function einfSauber(s){
  return String(s==null?'':s)
    .replace(/ /g,' ')          /* geschütztes Leerzeichen aus Word */
    .replace(/[​-‍﻿]/g,'')
    .replace(/\s+/g,' ')
    .trim();
}

/* Eine einzelne Zeile deuten. Gibt null zurück, wenn nichts übrig bleibt —
   „leer schlägt falsch": lieber keine Zeile als eine namenlose. */
function einfZeile(roh){
  let t = String(roh==null?'':roh).replace(/ /g,' ');
  /* Tabulatoren kommen aus einer Tabelle: die längste Spalte ist der Name,
     eine rein numerische Spalte ist die Menge. */
  let menge = '';
  if(t.indexOf('\t')>=0){
    const sp = t.split('\t').map(einfSauber).filter(Boolean);
    if(!sp.length) return null;
    const zahl = sp.find(x=>/^\d{1,4}(?:\s*(?:[xX×]|St(?:k|ück)?\.?))?$/.test(x));
    if(zahl){ menge = (zahl.match(/\d{1,4}/)||[''])[0]; }
    const rest = sp.filter(x=>x!==zahl);
    t = rest.length ? rest.reduce((a,b)=>b.length>a.length?b:a) : sp[0];
  }
  t = einfSauber(t);
  if(!t) return null;
  t = t.replace(EINF_VORNE, '');
  t = einfSauber(t);
  if(!t) return null;

  /* Eine Überschrift erkennt man am Doppelpunkt am Ende — „Zugang:",
     „Vorbereitung:". Sie wird als Gliederung vorgeschlagen, nicht als
     Material. Ein Doppelpunkt MITTEN in der Zeile zählt nicht. */
  let art = 'zeile';
  if(/[:：]$/.test(t) && !/\d/.test(t.slice(0,-1).slice(-3))){
    art = 'ueberschrift';
    t = einfSauber(t.replace(/[:：]+$/,''));
    if(!t) return null;
  }

  if(art==='zeile' && !menge){
    let m = EINF_MENGE_VORNE.exec(t);
    if(m){ menge = m[1]; t = einfSauber(t.slice(m[0].length)); }
    else { m = EINF_MENGE_HINTEN.exec(t);
      if(m){ menge = m[1]; t = einfSauber(t.slice(0, m.index)); } }
  }
  if(!t) return null;
  /* Eine Zeile, die nur aus einer Menge bestand, hat keinen Namen — „2x"
     allein ist kein Material (Grundsatz ①: leer schlägt falsch). */
  if(/^\d+\s*(?:[xX×]|St(?:k|ück)?\.?|Stck\.?)?$/.test(t)) return null;
  return { name:t, menge:menge||'', art, roh:einfSauber(roh) };
}

/* Der ganze Block. Leerzeilen fallen weg, Dubletten werden MARKIERT statt
   entfernt: In einer Liste darf dasselbe zweimal stehen — aber wer 60 Zeilen
   einfügt, will es sehen. */
function einfZerlegen(text){
  const zeilen = String(text==null?'':text).split(/\r?\n/);
  const out = [];
  const gesehen = Object.create(null);
  zeilen.forEach(z=>{
    if(out.length >= EINF_MAX) return;
    const d = einfZeile(z);
    if(!d) return;
    const s = d.name.toLowerCase();
    d.dublette = !!gesehen[s] && d.art==='zeile';
    gesehen[s] = true;
    out.push(d);
  });
  return out;
}

/* Gegen den Bestand halten: Kennt die App den Namen schon, wird GENAU dessen
   Schreibweise übernommen. Das ist der eigentliche Gewinn — gleiche
   Schreibweise heißt gleiches Material heißt Foto, Maße und Preis inklusive. */
function einfAbgleichen(liste, sorte){
  const bestand = (typeof ankBestand==='function') ? ankBestand(sorte||'material') : [];
  const karte = Object.create(null);
  bestand.forEach(x=>{
    const k = (typeof bauSlug==='function') ? bauSlug(x.name) : String(x.name||'').toLowerCase();
    if(k && !karte[k]) karte[k] = x;
  });
  return (liste||[]).map(d=>{
    if(d.art!=='zeile') return Object.assign({}, d, { bekannt:false });
    const k = (typeof bauSlug==='function') ? bauSlug(d.name) : String(d.name||'').toLowerCase();
    const t = k ? karte[k] : null;
    if(!t) return Object.assign({}, d, { bekannt:false });
    return Object.assign({}, d, { bekannt:true, name:t.name, uk:t.uk||'', nat:t.nat||'' });
  });
}

/* ═══════════ 2. Einfügen ═══════════ */

/* Derselbe Weg wie im Formular und beim Ankreuzen — hinterher gibt es keinen
   Unterschied zwischen „getippt", „angekreuzt" und „eingefügt". */
function einfEinfuegen(sid, ri, zeilen, sorte){
  if(typeof ADDITIONS==='undefined' || !ADDITIONS || typeof makeAddEntry!=='function') return 0;
  const grund = (sorte==='material') ? 'material' : 'ablauf';
  /* Erst sammeln, dann anhängen: sonst bliebe bei „nichts gewählt" ein leerer
     Topf im Speicher stehen. */
  const neu = [];
  (zeilen||[]).forEach(d=>{
    const name = einfSauber(d && d.name);
    if(!name) return;
    neu.push(makeAddEntry({ name,
      nat: (d.art==='ueberschrift') ? 'ueberschrift' : (d.nat || grund),
      uk: d.uk||'', menge: (d.art==='ueberschrift') ? '' : (d.menge||''),
      aid:(typeof newAid==='function')?newAid():('a'+Date.now().toString(36)+neu.length) }));
  });
  const n = neu.length;
  if(!n) return 0;
  const arr = ADDITIONS.entries[sid+'|'+ri] || (ADDITIONS.entries[sid+'|'+ri]=[]);
  neu.forEach(e=>arr.push(e));
  if(typeof saveAdditions==='function') saveAdditions();
  if(typeof rebuildDB==='function') rebuildDB();
  if(typeof buildMaterialIndex==='function') buildMaterialIndex();
  if(typeof computeUkList==='function') computeUkList();
  if(typeof ankCacheLeeren==='function') ankCacheLeeren();
  if(typeof pfCacheLeeren==='function') pfCacheLeeren();
  return n;
}

/* ═══════════ 3. Der Bildschirm ═══════════ */

let EINF = null;         /* {sid, ri, rname, sorte, schritt:'text'|'pruefen', zeilen:[]} */

function einfOeffnen(ri){
  if(typeof ADMIN!=='undefined' && !ADMIN){ if(typeof promptLoginThen==='function'){ promptLoginThen(()=>einfOeffnen(ri)); return; } }
  if(typeof curStd==='undefined' || !curStd) return;
  const r = (curStd.rubriken||[])[ri]; if(!r) return;
  EINF = { sid:curStd.id, ri, sorte:(typeof ankSorte==='function')?ankSorte(r.typ):'material',
    rname:(typeof rubName==='function')?rubName(r,ri):(r.name||''),
    schritt:'text', zeilen:[] };
  einfZeichnen();
  if(typeof showSheet==='function') showSheet(true);
  setTimeout(()=>{ const t=$('einfText'); if(t) t.focus(); }, 60);
}

function einfZeichnen(){
  if(!EINF) return;
  $('sheet').innerHTML = (EINF.schritt==='text') ? einfTextHTML() : einfPruefHTML();
  if(EINF.schritt==='pruefen') einfKnopfAuffrischen();
}

function einfTextHTML(){
  return `<div class="sheet-grip"></div>
    <div class="sheet-title">📋 Liste einfügen</div>
    <div class="sheet-name">${esc(EINF.rname)}</div>
    <p class="why-help">Die fertige Liste aus Word, einer Mail oder einem Zettel hier hineinkopieren — <b>eine Sache je Zeile</b>. Spiegelstriche, Nummern und Mengen („2x Radialschleuse") werden erkannt. Danach siehst du jede Zeile einzeln, bevor irgendetwas entsteht.</p>
    <textarea id="einfText" class="loc-input" rows="10" style="width:100%;font-family:inherit"
      placeholder="2x Radialschleuse 6F&#10;- Führungsdraht 0.035&#10;Kompressen 10 Stk.&#10;&#10;Zugang:&#10;1. Punktion A. radialis"></textarea>
    <div class="p-actions" style="margin-top:10px">
      <button class="btn btn-sec" onclick="einfAbbrechen()">Abbrechen</button>
      <button class="btn btn-pri" onclick="einfUiPruefen()">Zeilen prüfen →</button></div>`;
}

function einfPruefHTML(){
  const z = EINF.zeilen;
  const gewaehlt = z.filter(x=>x.an).length;
  const bekannt = z.filter(x=>x.an && x.bekannt).length;
  const dubl = z.filter(x=>x.an && x.dublette).length;
  const ueber = z.filter(x=>x.an && x.art==='ueberschrift').length;

  let h = `<div class="sheet-grip"></div>
    <div class="sheet-title">📋 ${z.length} Zeile${z.length===1?'':'n'} erkannt</div>
    <div class="sheet-name">${esc(EINF.rname)}</div>
    <div class="sheet-chips">
      <span class="schip">☑ ${gewaehlt} werden eingefügt</span>
      ${bekannt?`<span class="schip">✓ ${bekannt} kennt die App schon</span>`:''}
      ${ueber?`<span class="schip">§ ${ueber} Überschrift${ueber===1?'':'en'}</span>`:''}
      ${dubl?`<span class="schip einf-warn">⚠ ${dubl} doppelt</span>`:''}
    </div>
    <p class="why-help">Alles ist noch änderbar: Name antippen und tippen, Haken wegnehmen, Menge korrigieren. Erst „Einfügen" legt etwas an.</p>`;

  if(!z.length){
    h += `<div class="empty"><div class="ei">📋</div><h3>Nichts erkannt</h3>
      <p>In dem eingefügten Text stand keine brauchbare Zeile. Zurück und noch einmal einfügen — eine Sache je Zeile.</p></div>`;
  }

  h += `<div class="einf-liste">`;
  z.forEach((x,i)=>{
    h += `<div class="einf-zeile${x.an?' on':''}${x.art==='ueberschrift'?' einf-ueber':''}">
      <input type="checkbox" ${x.an?'checked':''} data-i="${i}" onchange="einfSchalten(+this.dataset.i,this.checked)"
        aria-label="Zeile übernehmen">
      <div class="einf-felder">
        <input class="loc-input einf-name" value="${esc(x.name)}" data-i="${i}"
          onchange="einfFeld(+this.dataset.i,'name',this.value)" aria-label="Name">
        <div class="einf-meta">
          ${x.art==='ueberschrift'
            ? `<span class="einf-tag">Überschrift</span>`
            : `<input class="loc-input einf-menge" value="${esc(x.menge)}" placeholder="Menge" data-i="${i}"
                 onchange="einfFeld(+this.dataset.i,'menge',this.value)" aria-label="Menge">`}
          ${x.bekannt?`<span class="einf-tag einf-ok">kennt die App</span>`:''}
          ${x.dublette?`<span class="einf-tag einf-warn">doppelt</span>`:''}
          <button type="button" class="einf-art" data-i="${i}" onclick="einfArtWechseln(+this.dataset.i)">
            ${x.art==='ueberschrift'?'→ als Zeile':'→ als Überschrift'}</button>
        </div>
      </div></div>`;
  });
  h += `</div>
    <div class="p-actions" style="padding:10px 4px 4px">
      <button class="btn btn-sec" onclick="einfZurueck()">← Text ändern</button>
      <button class="btn btn-sec" onclick="einfAlle()">Alle / keine</button>
      <button class="btn btn-pri" id="einfBtn" onclick="einfUiEinfuegen()">Einfügen</button></div>`;
  return h;
}

/* ═══════════ 4. Bedienung ═══════════ */

function einfUiPruefen(){
  if(!EINF) return;
  const t = $('einfText') ? $('einfText').value : '';
  const roh = einfZerlegen(t);
  if(!roh.length){
    if(typeof toast==='function') toast('In dem Text steht keine brauchbare Zeile',true);
    return;
  }
  /* Dubletten kommen ohne Haken herein: Wer sie wirklich will, setzt ihn —
     das ist der seltenere Fall und soll die bewusste Handlung sein. */
  EINF.zeilen = einfAbgleichen(roh, EINF.sorte).map(d=>Object.assign({}, d, { an:!d.dublette }));
  EINF.schritt = 'pruefen';
  einfZeichnen();
}
function einfZurueck(){
  if(!EINF) return;
  const text = EINF.zeilen.map(x=>x.roh).join('\n');
  EINF.schritt = 'text';
  einfZeichnen();
  const t = $('einfText'); if(t){ t.value = text; t.focus(); }
}
function einfSchalten(i, an){
  if(!EINF || !EINF.zeilen[i]) return;
  EINF.zeilen[i].an = !!an;
  einfKnopfAuffrischen();
  const box = $('sheet').querySelectorAll('.einf-zeile')[i];
  if(box) box.classList.toggle('on', !!an);
}
function einfFeld(i, feld, wert){
  if(!EINF || !EINF.zeilen[i]) return;
  const v = einfSauber(wert);
  if(feld==='name' && !v){ if(typeof toast==='function') toast('Ohne Namen geht die Zeile nicht',true); einfZeichnen(); return; }
  EINF.zeilen[i][feld] = v;
  if(feld==='name'){
    /* Nach dem Ändern neu gegen den Bestand halten — vielleicht passt es
       jetzt auf einen vorhandenen Namen. */
    const eine = einfAbgleichen([EINF.zeilen[i]], EINF.sorte)[0];
    EINF.zeilen[i] = Object.assign(EINF.zeilen[i], eine, { an:EINF.zeilen[i].an });
    einfZeichnen();
  }
}
function einfArtWechseln(i){
  if(!EINF || !EINF.zeilen[i]) return;
  const x = EINF.zeilen[i];
  x.art = (x.art==='ueberschrift') ? 'zeile' : 'ueberschrift';
  if(x.art==='ueberschrift'){ x.menge=''; x.bekannt=false; }
  else { EINF.zeilen[i] = Object.assign(x, einfAbgleichen([x], EINF.sorte)[0], { an:x.an }); }
  einfZeichnen();
}
function einfAlle(){
  if(!EINF) return;
  const alle = EINF.zeilen.every(x=>x.an);
  EINF.zeilen.forEach(x=>{ x.an = !alle; });
  einfZeichnen();
}
function einfKnopfAuffrischen(){
  const btn = $('einfBtn'); if(!btn || !EINF) return;
  const n = EINF.zeilen.filter(x=>x.an).length;
  btn.textContent = n ? ('Einfügen ('+n+')') : 'Nichts gewählt';
  btn.disabled = !n;
}
function einfAbbrechen(){ EINF=null; if(typeof showSheet==='function') showSheet(false); }
function einfUiEinfuegen(){
  if(!EINF) return;
  const zeilen = EINF.zeilen.filter(x=>x.an);
  const n = einfEinfuegen(EINF.sid, EINF.ri, zeilen, EINF.sorte);
  EINF = null;
  if(typeof showSheet==='function') showSheet(false);
  if(typeof reRenderDetail==='function') reRenderDetail();
  if(typeof toast==='function') toast(n ? (n+' Zeile'+(n===1?'':'n')+' eingefügt') : 'Nichts eingefügt');
}
