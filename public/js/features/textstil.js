/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — SCHRIFTGRÖSSE UND AUSZEICHNUNG

   Zwei verschiedene Wünsche, die man nicht mit einem Werkzeug erschlägt:

   ① EINE ZEILE soll größer oder fetter sein. Das ist eine Eigenschaft der
      Zeile — wie Farbe oder Menge. Also läuft sie über dieselbe Kaskade:
      📍 nur hier · 📄 Standard · 🗂 Gruppe · 🏷 Merkmal · 🌐 überall. Wer die
      Warnzeile eines Materials überall groß haben will, tippt einmal.

   ② EIN WORT im Satz soll hervorstechen („CAVE: nicht am Arm mit Braunüle").
      Dafür wäre eine Eigenschaft der falsche Ort — das Wort steckt im Text.
      Hier hilft eine AUSZEICHNUNG: ein Zeichenpaar um das Wort herum.

   ── Warum Zeichenpaare und kein Formatierungsknopf ──
   Ein Formatierungsknopf braucht einen Editor mit Cursorposition, Auswahl und
   Zwischenzustand. Im Saal wird auf einem Tablet mit Handschuhen getippt. Ein
   Sternchen um ein Wort überlebt jedes Kopieren, jeden Export, jede Suche —
   und ist im Zweifel immer noch lesbar. Das ist der belastbarere Weg.

   ── Und trotzdem ohne Fachwort im Code ──
   WELCHE Zeichen was bedeuten, steht nicht hier, sondern in
   data/bezeichnungen.json → Zweig `auszeichnungen` und ist in der Verwaltung
   änderbar. Wem Sternchen nicht gefallen, ändert sie. Der Code kennt nur die
   Regel „Zeichen auf, Text, Zeichen zu".

   ── Sicherheit vor Bequemlichkeit ──
   Ausgezeichnet wird IMMER auf dem bereits entschärften Text. Erst esc(),
   dann die Zeichenpaare. Ein Text aus einer Word-Datei darf niemals Markup
   werden, nur weil er zufällig eine spitze Klammer enthält.
   ───────────────────────────────────────────────────────────── */

/* ═══════════ 1. Schriftgröße und Gewicht einer Zeile ═══════════ */

const TXS_GROESSEN = ['s','m','l','xl'];
const TXS_VORGABE = 'm';
const TXS_GROESSE_RUECKFALL = { s:'Klein', m:'Normal', l:'Groß', xl:'Sehr groß' };
function txsGroesseWort(g){
  const tab = (typeof bezWert==='function') ? (bezWert('schriftgroessen','werte',null)||TXS_GROESSE_RUECKFALL) : TXS_GROESSE_RUECKFALL;
  return tab[g] || TXS_GROESSE_RUECKFALL[g] || g;
}
function txsGroesseGueltig(g){ return TXS_GROESSEN.indexOf(g)>=0 ? g : TXS_VORGABE; }

/* Der geltende Stil einer Zeile. Immer ein vollständiger Satz — nie
   `undefined`, damit kein Aufrufer eine Fallunterscheidung braucht. */
function txsVon(e, cid){
  let v;
  if(typeof qeGet==='function') v = qeGet(e, cid, 'stil');
  return txsNorm(v);
}
function txsNorm(v){
  if(!v || typeof v!=='object') return { g:TXS_VORGABE, f:false };
  return { g:txsGroesseGueltig(v.g), f: v.f===true };
}
/* Weicht der Stil von der Vorgabe ab? Nur dann lohnt eine Klasse im Markup. */
function txsIstVorgabe(st){ const s=txsNorm(st); return s.g===TXS_VORGABE && !s.f; }
function txsKlassen(st){
  const s = txsNorm(st); const k = [];
  if(s.g!==TXS_VORGABE) k.push('tx-'+s.g);
  if(s.f) k.push('tx-fett');
  return k.join(' ');
}
/* Kurzform für Menü-Untertitel: „Groß · fett" oder „Normal". */
function txsBeschreibung(st){
  const s = txsNorm(st);
  return txsGroesseWort(s.g) + (s.f ? ' · fett' : '');
}

/* ═══════════ 2. Auszeichnung einzelner Wörter ═══════════ */

/* Ein Zeichenpaar und seine Wirkung. Die Klassen sind fest (sie stehen im
   Stylesheet), die ZEICHEN nicht. */
const TXS_AUSZ_RUECKFALL = [
  { auf:'**', zu:'**', klasse:'tx-fett',  wort:'fett' },
  { auf:'__', zu:'__', klasse:'tx-l',     wort:'größer' },
  { auf:'~',  zu:'~',  klasse:'tx-s',     wort:'kleiner' }
];
function txsAuszeichnungen(){
  const v = (typeof bezWert==='function') ? bezWert('auszeichnungen','werte',null) : null;
  if(!Array.isArray(v) || !v.length) return TXS_AUSZ_RUECKFALL;
  /* „Leer schlägt falsch": Eine Regel ohne Zeichen oder ohne Klasse wäre eine
     Falle — sie würde still nichts tun. Solche Zeilen fliegen raus. */
  return v.filter(r=>r && r.auf && r.zu && r.klasse);
}
function txsEscRegex(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }

/* Ein Text mit Auszeichnungen als sicheres HTML.

   Reihenfolge ist entscheidend:
     ① esc()  — der Text wird entschärft
     ② dann erst die Zeichenpaare ersetzen
   Andersherum könnte ein Text mit spitzen Klammern zu Markup werden.

   Die längeren Zeichenpaare zuerst, sonst frisst `*` das `**`. */
function txsText(roh){
  const sicher = (x)=> (typeof esc==='function') ? esc(String(x==null?'':x)) : String(x==null?'':x);
  let t = sicher(roh);
  const regeln = txsAuszeichnungen().slice().sort((a,b)=>String(b.auf).length-String(a.auf).length);
  regeln.forEach(r=>{
    /* Auch die ZEICHEN müssen durch esc(), denn gesucht wird im bereits
       entschärften Text. Wählt das Haus „<<…>>", steht dort längst
       „&lt;&lt;…&gt;&gt;" — ein roher Vergleich fände nie etwas, und die
       Auszeichnung fiele lautlos aus. */
    const auf = txsEscRegex(sicher(r.auf)), zu = txsEscRegex(sicher(r.zu));
    /* Kein Zeilenumbruch dazwischen: Eine Auszeichnung, die über Zeilen
       hinwegreicht, ist fast immer ein vergessenes Zeichen — und würde den
       halben Standard fett machen. */
    const re = new RegExp(auf + '(?!\\s)([^\\n]{1,200}?)(?<!\\s)' + zu, 'g');
    t = t.replace(re, '<span class="'+r.klasse+'">$1</span>');
  });
  return t;
}
/* Enthält ein Text überhaupt eine Auszeichnung? Für den Menü-Untertitel. */
function txsHatAuszeichnung(roh){
  const t = String(roh==null?'':roh);
  return txsAuszeichnungen().some(r=>{
    const re = new RegExp(txsEscRegex(r.auf) + '(?!\\s)([^\\n]{1,200}?)(?<!\\s)' + txsEscRegex(r.zu));
    return re.test(t);
  });
}

/* ═══════════ 3. Bedienung im Schnellmenü ═══════════ */

function renderSheetStil(){
  const e = sheetEntry, cid = sheetCid; if(!e) return;
  const st = txsVon(e, cid);
  const name = (typeof qeGet==='function' && qeGet(e,cid,'name')!==undefined) ? qeGet(e,cid,'name') : e.anzeige_text;
  let h = `<div class="sheet-grip"></div><div class="sheet-title">Schrift &amp; Auszeichnung</div>
    <div class="sheet-name">${esc(name||'')}</div>`;
  h += `<div class="tx-vorschau ${esc(txsKlassen(st))}">${txsText(name||'')}</div>`;

  h += `<div class="tx-abschnitt">Größe dieser Zeile</div><div class="tx-wahl">`;
  TXS_GROESSEN.forEach(g=>{
    h += `<button type="button" class="tx-b${g===st.g?' on':''}" data-g="${esc(g)}" onclick="txsUiGroesse(this.dataset.g)">${esc(txsGroesseWort(g))}</button>`;
  });
  h += `</div>`;

  h += `<div class="tx-abschnitt">Gewicht</div><div class="tx-wahl">
    <button type="button" class="tx-b${st.f?'':' on'}" onclick="txsUiFett(false)">Normal</button>
    <button type="button" class="tx-b${st.f?' on':''}" onclick="txsUiFett(true)"><b>Fett</b></button>
  </div>`;

  h += `<div class="tx-abschnitt">Einzelne Wörter hervorheben</div>`;
  h += `<p class="hint" style="padding:0 4px">Im Text der Zeile — die Zeichen bleiben im Text stehen und überleben Kopieren, Suche und Ausdruck:</p>`;
  h += `<div class="tx-legende">` + txsAuszeichnungen().map(r=>
    `<div class="tx-leg"><code>${esc(r.auf)}Wort${esc(r.zu)}</code> <span class="${esc(r.klasse)}">${esc(r.wort||'')}</span></div>`).join('') + `</div>`;
  h += `<p class="hint" style="padding:0 4px">Welche Zeichen was bedeuten, steht in der Verwaltung unter „Bezeichnungen" und ist änderbar.</p>`;

  if(!txsIstVorgabe(st)) h += `<button class="sheet-pick-btn" onclick="txsUiZuruecksetzen()">↺ Auf Normal zurücksetzen</button>`;
  h += `<button class="sheet-close" onclick="renderSheetMain()">Zurück</button>`;
  $('sheet').innerHTML = h;
}

/* Jede Änderung geht über die Reichweiten-Treppe — ein Schreibweg für alles. */
function txsUiSetzen(neu){
  const e = sheetEntry, cid = sheetCid; if(!e) return;
  const st = txsNorm(Object.assign({}, txsVon(e,cid), neu));
  if(typeof sheetPending!=='undefined'){
    sheetPending = { kind:'stil', value: txsIstVorgabe(st) ? null : st };
    if(typeof askScope==='function'){ askScope(); return; }
  }
  if(typeof qeSet==='function'){ qeSet('cid', e, cid, 'stil', txsIstVorgabe(st)?null:st);
    if(typeof reRenderDetail==='function') reRenderDetail(); }
}
function txsUiGroesse(g){ txsUiSetzen({ g }); }
function txsUiFett(f){ txsUiSetzen({ f: !!f }); }
function txsUiZuruecksetzen(){
  const e = sheetEntry, cid = sheetCid; if(!e) return;
  if(typeof sheetPending!=='undefined'){
    sheetPending = { kind:'stil', value:null };
    if(typeof askScope==='function'){ askScope(); return; }
  }
}
