/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — ZEILEN ÄNDERN, OHNE DIE ANSICHT ZU VERLASSEN

   Der Betreiber, nach dem ersten selbst geschriebenen Standard: „Es ist sehr
   holprig." Der Messstand (e2e/messen.js) sagt, woran das liegt:

     · Eine Zeile umbenennen kostete: Zeile halten → Menü → „Schnell
       umbenennen" → Eingabe → speichern → Reichweite. Sechs Berührungen,
       zweimal Bildschirmwechsel — für ein einziges Wort.
     · „Details bearbeiten" öffnet ein Formular mit 7 Eingabefeldern in 10
       Gruppen über 1,8 Bildschirmhöhen — und VERLÄSST die Rubrik. Wer zehn
       Zeilen durchsieht, verliert zehnmal seinen Platz in der Liste.
     · Die Schnellbearbeitungen liefen über prompt(). In installierten PWAs
       erscheint dort auf mehreren Android-Chrome-Versionen kein Fenster: Der
       Weg kam am Tablet im Saal überhaupt nicht an.

   Hier wird die Rubrik selbst zum Formular. Man sieht die Liste, in der man
   arbeitet, und ändert darin — ohne sie zu verlassen.

   ── Warum ein eigener MODUS (wie beim Sortieren) ──
   Die Eintragszeile ist bereits dreifach belegt: kurz tippen hakt ab, lang
   halten öffnet das ⋯-Menü, die Schalter darin tun ihr Eigenes. Ein viertes
   Verhalten auf derselben Fläche wäre mit Handschuhen ein Ratespiel. Also
   schaltet „✏️ Zeilen ändern" in eine zweite, ruhige Ansicht. Dort bedeutet
   ein Tipp auf ein Feld genau eines: dieses Feld ändern.

   ── Warum nur DREI Felder ──
   Name, Menge, Spezifikation. Das sind die, die man beim LESEN einer Liste
   korrigiert („heißt anders", „zweimal", „nur femoral"). Kategorie, Größen,
   Farbe, Warum und Synonyme sind Entscheidungen, keine Korrekturen — die
   gehören ins volle Formular, das es weiterhin gibt. Ein Inline-Formular mit
   allem wäre wieder das Formular, nur an anderer Stelle.

   ── Nichts wird geschrieben, bevor es jemand gesehen hat ──
   Getippt wird in einen ENTWURF. „✓ Fertig" öffnet ein Prüfblatt über ALLE
   Änderungen auf einmal: je Zeile vorher → nachher, dazu die Reichweite.
   Voreingestellt ist „nur hier" — die engste Stufe. Erst „Übernehmen"
   schreibt, und zwar über denselben Weg wie jede andere Änderung
   (Regel-Journal, rücknehmbar).
   ───────────────────────────────────────────────────────────── */

/* ═══════════ 1. Der Entwurf (rein und testbar) ═══════════ */

/* Welche Felder inline änderbar sind. Der Schlüssel ist der, unter dem die
   Änderung im Journal landet — kein Fachwort im Vergleich (Grundsatz ④). */
const ZEIL_FELDER = [
  { key:'name',     prop:'name',     wort:'Bezeichnung',    kurz:'Name' },
  { key:'menge',    prop:'mengeVal', wort:'Menge',          kurz:'Menge' },
  { key:'spez',     prop:'spez',     wort:'Spezifikation',  kurz:'Zusatz' },
];

/* Der aktuelle Wert eines Feldes an einer Stelle — mit der ganzen Kaskade
   dahinter, damit im Entwurf steht, was der Mensch WIRKLICH sieht. */
function zeilWert(e, cid, feld){
  if(!e) return '';
  if(feld==='name'){
    const v = (typeof qeGet==='function') ? qeGet(e,cid,'name') : undefined;
    return String((v!==undefined ? v : e.anzeige_text) || '');
  }
  if(feld==='menge'){
    const v = (typeof qeGet==='function') ? qeGet(e,cid,'mengeVal') : undefined;
    return String((v!==undefined ? v : e.menge) || '');
  }
  if(feld==='spez'){
    const v = (typeof qeGet==='function') ? qeGet(e,cid,'spez') : undefined;
    if(v!==undefined) return String(v||'');
    return String((Array.isArray(e.spezifikation) ? e.spezifikation.join(' | ') : e.spezifikation) || '');
  }
  return '';
}

/* Der Entwurf: cid → { feld: neuerWert }. Es steht NUR drin, was sich
   wirklich unterscheidet — sonst zeigte das Prüfblatt Änderungen an, die
   keine sind, und die Reichweitenfrage würde bedeutungslos. */
let ZEIL = {};

function zeilSetzen(entwurf, cid, feld, neu, alt){
  const d = entwurf || {};
  const n = String(neu==null ? '' : neu).trim();
  const a = String(alt==null ? '' : alt).trim();
  if(n === a){
    if(d[cid]){ delete d[cid][feld]; if(!Object.keys(d[cid]).length) delete d[cid]; }
    return d;
  }
  d[cid] = d[cid] || {};
  d[cid][feld] = n;
  return d;
}
/* Wie viele Felder sind geändert? (Nicht: wie viele Zeilen — eine Zeile mit
   drei Änderungen sind drei Entscheidungen.) */
function zeilAnzahl(entwurf){
  let n = 0;
  Object.keys(entwurf||{}).forEach(cid=>{ n += Object.keys(entwurf[cid]||{}).length; });
  return n;
}
function zeilZeilen(entwurf){ return Object.keys(entwurf||{}).length; }
function zeilVerworfen(entwurf, cid, feld){
  const d = entwurf || {};
  if(!d[cid]) return d;
  delete d[cid][feld];
  if(!Object.keys(d[cid]).length) delete d[cid];
  return d;
}

/* ═══════════ 2. Der Modus ═══════════ */

let zeilRi = null;
function zeilAktiv(){ return zeilRi !== null; }
function zeilAktivFuer(idx){ return zeilRi === idx; }

function zeilAn(idx){
  if(typeof ADMIN!=='undefined' && !ADMIN){ if(typeof promptLoginThen==='function'){ promptLoginThen(()=>zeilAn(idx)); return; } }
  zeilRi = idx; ZEIL = {};
  if(typeof openRubrik==='function') openRubrik(idx, true);
}
/* Verlassen OHNE zu speichern. Ein voller Entwurf wird nicht stillschweigend
   weggeworfen — das wäre genau die Art Verlust, die niemand bemerkt, bis er
   fehlt (Grundsatz ②). */
function zeilAus(){
  if(zeilAnzahl(ZEIL) > 0){ zeilVerwerfenFragen(); return; }
  const idx = zeilRi; zeilRi = null; ZEIL = {};
  if(idx!==null && typeof openRubrik==='function') openRubrik(idx, true);
}
/* Beim Verlassen der Rubrik still aufräumen — wie der Sortiermodus ist auch
   dieser ein Arbeitszustand, kein Merkmal der Rubrik. */
function zeilBeenden(){ zeilRi = null; ZEIL = {}; }

/* ═══════════ 3. Die Zeilen dieser Rubrik ═══════════ */

/* Flach, in der Reihenfolge der Anzeige. Überschriften und ausgeblendete
   Zeilen fallen heraus: An einer Überschrift gibt es keine Menge, und was
   ausgeblendet ist, soll man nicht versehentlich pflegen. */
function zeilListe(idx){
  if(typeof curStd==='undefined' || !curStd) return [];
  const r = (curStd.rubriken||[])[idx]; if(!r) return [];
  const aus = [];
  (r.sub_bereiche||[]).forEach((sb,si)=>{
    (sb.eintraege||[]).forEach((e,ei)=>{
      if(!e || e.natur==='ueberschrift' || e.ist_fliesstext) return;
      const cid = (typeof cidOf==='function') ? cidOf(curStd.id, idx, si, ei) : null;
      if(!cid) return;
      if(typeof qeGet==='function' && qeGet(e,cid,'hidden')===true) return;
      aus.push({ cid, e });
    });
  });
  /* Eigene Einträge (features/additions.js) stehen mit in der Rubrik und
     müssen genauso änderbar sein — sonst wäre ausgerechnet das, was man
     selbst angelegt hat, das Unbeweglichste. */
  if(typeof newEntriesFor==='function'){
    (newEntriesFor(r, idx)||[]).forEach(n=>{
      const cid = 'new|' + n.id;
      const e = (typeof findEntry==='function') ? findEntry(cid) : null;
      if(e) aus.push({ cid, e });
    });
  }
  return aus;
}

/* ═══════════ 4. Zeichnen ═══════════ */

function zeilRender(idx){
  const box = $('scr-detail'); if(!box) return;
  const r = curStd.rubriken[idx];
  const liste = zeilListe(idx);
  const n = zeilAnzahl(ZEIL);

  let h = `<div class="banner zl-kopf"><h2>✏️ Zeilen ändern</h2>
    <p>Direkt in der Liste tippen — die Rubrik bleibt, wo sie ist. Geändert wird erst, wenn du unten auf „Fertig" gehst; dort steht dann alles noch einmal mit <b>vorher → nachher</b>.</p>
    <div class="p-actions">
      <button class="btn btn-sec" onclick="zeilAus()">Abbrechen</button>
      <button class="btn btn-pri" id="zlFertig" onclick="zeilPruefen()"${n?'':' disabled'}>${n?('✓ Fertig ('+n+')'):'✓ Fertig'}</button></div></div>`;

  if(!liste.length){
    h += `<div class="empty"><div class="ei">✏️</div><h3>Nichts zu ändern</h3>
      <p>In dieser Rubrik steht keine sichtbare Zeile. Über „＋ Eintrag hinzufügen" oder „📋 Liste einfügen" kommt etwas hinein.</p></div>`;
    box.innerHTML = h; show('scr-detail'); return;
  }

  h += `<div class="zl-liste">`;
  liste.forEach(({cid, e})=>{
    const ent = ZEIL[cid] || {};
    const feld = (f)=>{
      const jetzt = zeilWert(e, cid, f.key);
      const wert = (ent[f.key]!==undefined) ? ent[f.key] : jetzt;
      const dran = (ent[f.key]!==undefined);
      return `<label class="zl-feld${dran?' zl-dran':''}">
        <span class="zl-lab">${esc(f.kurz)}</span>
        <input class="loc-input" type="text" value="${esc(wert)}"
          data-c="${esc(cid)}" data-f="${esc(f.key)}"
          placeholder="${esc(f.wort)}"
          oninput="zeilUiFeld(this.dataset.c,this.dataset.f,this.value)">
      </label>`;
    };
    const nat = (typeof effNatur==='function' && typeof natOf==='function') ? natOf(effNatur(e,cid)) : null;
    const geaendert = Object.keys(ent).length;
    h += `<div class="zl-zeile${geaendert?' zl-zeile-dran':''}" data-cid="${esc(cid)}">
      <span class="zl-farbe" style="background:${esc((nat&&nat.color)||'#888')}"></span>
      <div class="zl-felder">${ZEIL_FELDER.map(feld).join('')}</div>
      <button type="button" class="zl-zurueck" data-c="${esc(cid)}" onclick="zeilUiZeileZurueck(this.dataset.c)"
        aria-label="Änderungen dieser Zeile zurücknehmen">↺</button>
    </div>`;
  });
  h += `</div>`;
  box.innerHTML = h;
  if(typeof show==='function') show('scr-detail');
  if(typeof setBar==='function') setBar('✏️ ' + ((typeof rubName==='function')?rubName(r,idx):(r.name||'')), curStd.titel, true);
}

/* ═══════════ 5. Bedienung ═══════════ */

/* Beim Tippen wird NUR der Knopf aufgefrischt, nicht die Liste: Ein
   Neuaufbau nähme dem Feld den Fokus, und nach jedem Buchstaben neu
   hineinzutippen wäre unbenutzbar. */
function zeilUiFeld(cid, feld, wert){
  const t = zeilListe(zeilRi).find(x=>x.cid===cid);
  if(!t) return;
  ZEIL = zeilSetzen(ZEIL, cid, feld, wert, zeilWert(t.e, cid, feld));
  zeilKnopfAuffrischen();
  const box = $('scr-detail');
  const zeile = box && box.querySelector('.zl-zeile[data-cid="'+((window.CSS&&CSS.escape)?CSS.escape(cid):cid)+'"]');
  if(zeile) zeile.classList.toggle('zl-zeile-dran', !!ZEIL[cid]);
  const inp = zeile && zeile.querySelector('input[data-f="'+feld+'"]');
  if(inp && inp.closest) inp.closest('.zl-feld').classList.toggle('zl-dran', !!(ZEIL[cid] && ZEIL[cid][feld]!==undefined));
}
function zeilKnopfAuffrischen(){
  const btn = $('zlFertig'); if(!btn) return;
  const n = zeilAnzahl(ZEIL);
  btn.textContent = n ? ('✓ Fertig ('+n+')') : '✓ Fertig';
  btn.disabled = !n;
}
function zeilUiZeileZurueck(cid){
  if(ZEIL[cid]) delete ZEIL[cid];
  if(zeilRi!==null) zeilRender(zeilRi);
  if(typeof toast==='function') toast('Zeile zurückgesetzt');
}
function zeilVerwerfenFragen(){
  const n = zeilAnzahl(ZEIL);
  $('sheet').innerHTML = `<div class="sheet-grip"></div><div class="sheet-title">Änderungen verwerfen?</div>
    <p class="why-help">${n} Änderung${n===1?'':'en'} ${n===1?'ist':'sind'} noch nicht übernommen. Verwirfst du sie, ist die Liste wieder wie vorher.</p>
    <div class="p-actions" style="margin-top:12px">
      <button class="btn btn-sec" onclick="showSheet(false)">Weiter bearbeiten</button>
      <button class="btn btn-pri" onclick="zeilVerwerfen()">Verwerfen</button></div>`;
  if(typeof showSheet==='function') showSheet(true);
}
function zeilVerwerfen(){
  const idx = zeilRi; zeilRi = null; ZEIL = {};
  if(typeof showSheet==='function') showSheet(false);
  if(idx!==null && typeof openRubrik==='function') openRubrik(idx, true);
  if(typeof toast==='function') toast('Verworfen — nichts geändert');
}

/* ═══════════ 6. Das Prüfblatt über ALLE Änderungen ═══════════ */

/* Gewählte Reichweite für den ganzen Stapel. Voreingestellt die engste —
   wer weiter will, sagt es ausdrücklich. */
let zeilScope = 'cid';

/* Alle Änderungen als flache Liste, in der Reihenfolge der Anzeige. */
function zeilAenderungen(idx, entwurf){
  const d = entwurf || ZEIL;
  const aus = [];
  zeilListe(idx).forEach(({cid, e})=>{
    const ent = d[cid]; if(!ent) return;
    ZEIL_FELDER.forEach(f=>{
      if(ent[f.key]===undefined) return;
      aus.push({ cid, e, feld:f.key, prop:f.prop, wort:f.wort,
        name: zeilWert(e, cid, 'name'),
        vorher: zeilWert(e, cid, f.key),
        nachher: ent[f.key],
        mk: e.material_key || null });
    });
  });
  return aus;
}

function zeilPruefen(){
  if(zeilRi===null) return;
  const aend = zeilAenderungen(zeilRi, ZEIL);
  if(!aend.length){ if(typeof toast==='function') toast('Nichts geändert'); return; }
  zeilScope = 'cid';
  zeilPruefblattZeichnen();
  if(typeof showSheet==='function') showSheet(true);
}

function zeilPruefblattZeichnen(){
  const aend = zeilAenderungen(zeilRi, ZEIL);
  if(!aend.length){ if(typeof showSheet==='function') showSheet(false); return; }
  /* Die Reichweiten-Treppe wird an der ERSTEN Zeile mit geteiltem Material
     gebildet — die Stufen (Standard/Gruppe/alle) sind für alle dieselben,
     nur die Trefferzahlen unterscheiden sich. Zeilen ohne geteiltes Material
     können ohnehin nur „nur hier". */
  const mitMk = aend.find(a=>a.mk);
  const stufen = (mitMk && typeof rwStufen==='function') ? rwStufen(mitMk.cid, mitMk.mk) : [];
  const nurHier = aend.filter(a=>!a.mk).length;

  let h = `<div class="sheet-grip"></div><div class="sheet-title">Übernehmen?</div>
    <div class="sheet-chips"><span class="schip">${aend.length} Änderung${aend.length===1?'':'en'}</span>
      <span class="schip">${zeilZeilen(ZEIL)} Zeile${zeilZeilen(ZEIL)===1?'':'n'}</span>
      ${nurHier?`<span class="schip">${nurHier} nur hier möglich</span>`:''}</div>
    <div class="zl-pruef">`;
  aend.forEach((a,i)=>{
    h += `<div class="zl-pz">
      <div class="zl-pz-kopf">${esc(a.name)} <span class="zl-pz-feld">${esc(a.wort)}</span></div>
      <div class="zl-pz-werte">
        <span class="zl-vor">${esc(a.vorher||'—')}</span>
        <span class="zl-pfeil">→</span>
        <span class="zl-nach">${esc(a.nachher||'—')}</span>
      </div>
      <button type="button" class="zl-pz-weg" data-i="${i}" onclick="zeilUiWeg(+this.dataset.i)"
        aria-label="Diese Änderung doch nicht">✕</button></div>`;
  });
  h += `</div>`;

  if(stufen.length > 1){
    h += `<div class="flabel" style="margin-top:10px">WIE WEIT SOLL DAS GELTEN?</div>
      <p class="hint" style="padding:0 4px 6px">Gilt für alle Änderungen oben, soweit die Zeile ein geteiltes Material trägt.</p>
      <div class="sheet-pick">`;
    stufen.forEach(st=>{
      h += `<button class="sheet-pick-btn${zeilScope===st.key?' on':''}" data-s="${esc(st.key)}"
        onclick="zeilUiScope(this.dataset.s)">${st.ico} ${esc(st.lang||st.wort)}
        <span class="ps-sub">· ${esc(st.langSub||st.sub||'')}</span></button>`;
    });
    h += `</div>`;
  }

  h += `<div class="p-actions" style="margin-top:12px">
      <button class="btn btn-sec" onclick="zeilZurueckZurListe()">← Weiter bearbeiten</button>
      <button class="btn btn-pri" onclick="zeilSpeichern()">Übernehmen</button></div>`;
  $('sheet').innerHTML = h;
}
function zeilUiScope(key){ zeilScope = key || 'cid'; zeilPruefblattZeichnen(); }
function zeilUiWeg(i){
  const aend = zeilAenderungen(zeilRi, ZEIL);
  const a = aend[i]; if(!a) return;
  ZEIL = zeilVerworfen(ZEIL, a.cid, a.feld);
  if(!zeilAnzahl(ZEIL)){ zeilZurueckZurListe(); return; }
  zeilPruefblattZeichnen();
}
function zeilZurueckZurListe(){
  if(typeof showSheet==='function') showSheet(false);
  if(zeilRi!==null) zeilRender(zeilRi);
}

/* Geschrieben wird über denselben Weg wie jede andere Änderung: applyPending()
   in features/quickmenu.js. Damit landet alles im Regel-Journal und bleibt
   rücknehmbar — ein zweiter Schreibweg wäre ein zweites Verhalten, das
   irgendwann auseinanderläuft (Grundsatz ⑥). */
function zeilSpeichern(){
  const idx = zeilRi;
  const aend = zeilAenderungen(idx, ZEIL);
  if(!aend.length){ zeilZurueckZurListe(); return; }
  let n = 0;
  aend.forEach(a=>{
    const wert = (a.feld==='name') ? a.nachher : (a.nachher==='' ? null : a.nachher);
    if(a.feld==='name' && !String(a.nachher||'').trim()) return;   /* leer schlägt falsch */
    if(typeof sheetEntry!=='undefined'){
      sheetEntry = a.e; sheetCid = a.cid;
      sheetPending = { kind:a.prop, value:wert };
      /* `true` = bereits bestätigt: Das Prüfblatt IST die Bestätigung, und
         eine zweite Rückfrage je Zeile wäre bei zwanzig Änderungen eine
         Zumutung. */
      if(typeof applyPending==='function'){ applyPending(a.mk ? zeilScope : 'cid', true); n++; }
    }
  });
  zeilRi = null; ZEIL = {};
  if(typeof showSheet==='function') showSheet(false);
  if(idx!==null && typeof openRubrik==='function') openRubrik(idx, true);
  if(typeof toast==='function')
    toast(n ? (n+' Änderung'+(n===1?'':'en')+' übernommen — rücknehmbar unter 🧾 Regeln & Journal') : 'Nichts übernommen');
}
