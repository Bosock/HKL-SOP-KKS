/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — DIE ZWEITE PERSPEKTIVE AUFS MATERIAL

   „Die Standards sind schon so geschrieben, dass es quasi eine Rüstliste ist.
   Ich möchte aber differenzieren können nach: das ist Material für den
   sterilen Tisch, und das ist Material, was du so drumherum brauchst."

   Das ist eine ZWEITE ACHSE, keine weitere Kategorie. Die vorhandenen Achsen
   sind bereits vergeben:

     natur           WAS es ist        Material · Gerät · Handgriff · Hinweis
     unterkategorie  WO im Standard    „Material auf Ansage", „aus dem Lager"
     BEREICH (neu)   WOHIN es kommt    steriler Tisch · Umfeld · Anästhesie

   Alle drei gelten gleichzeitig. Ein 6F-Schleusenset ist Material (natur),
   steht unter „Zugang" (unterkategorie) und gehört auf den sterilen Tisch
   (bereich). Wer das in eine Achse presst, verliert zwei Informationen.

   ── Warum das über dieselbe Kaskade läuft ──
   Der Bereich ist eine Eigenschaft der Zeile wie Name, Menge oder Farbe. Also
   nimmt er denselben Weg: 📍 nur hier · 📄 Standard · 🗂 Gruppe · 🏷 Merkmal ·
   🌐 überall. Wer einmal sagt „Kompressen gehören überall auf den sterilen
   Tisch", hat es an allen 60 Stellen gesagt. Kein zweiter Mechanismus,
   keine zweite Denkweise (Grundsatz ⑥).

   ── Die Bereiche selbst gehören dem Haus ──
   Welche es gibt, wie sie heißen, welches Symbol und welche Farbe sie tragen:
   alles in der Verwaltung, nichts im Quelltext. Ausgeliefert wird bewusst
   NICHTS — ein Haus, das mit „steriler Tisch / Umfeld" nichts anfangen kann,
   soll nicht erst etwas wegräumen müssen (Grundsatz ①).
   ───────────────────────────────────────────────────────────── */

/* ═══════════ 1. Die Bereiche ═══════════ */

let BEREICHE = (typeof loadJSON==='function') ? loadJSON('hkl_bereiche', []) : [];
if(!Array.isArray(BEREICHE)) BEREICHE = [];
function saveBereiche(){ if(typeof saveJSON==='function') saveJSON('hkl_bereiche', BEREICHE); }

const BER_PALETTE = ['#34c98a','#5fb0e0','#e8b34a','#bd8ce8','#e0795f','#5fd0c0'];

function berSlug(text){
  let s = String(text==null?'':text).toLowerCase();
  s = s.replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
  s = s.replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,32);
  return s || ('b'+Date.now().toString(36));
}
function berListe(){ return BEREICHE.slice().sort((a,b)=>(a.ord||0)-(b.ord||0)); }
function berOf(key){ return BEREICHE.find(x=>x.key===key) || null; }
function berAnlegen(wort){
  const w = String(wort||'').trim(); if(!w) return null;
  let key = berSlug(w); let n = 2;
  while(berOf(key)) key = berSlug(w)+'-'+(n++);
  const b = { key, wort:w, symbol:'📍', farbe:BER_PALETTE[BEREICHE.length % BER_PALETTE.length], ord:BEREICHE.length,
    /* Der ERSTE angelegte Bereich wird automatisch der mit dem Häkchen am
       Material. Sonst müsste man nach dem Anlegen noch einen Schalter suchen,
       von dem man nichts weiß — und der häufigste Fall ist genau dieser eine
       („Material für den sterilen Tisch"). Umhängen geht jederzeit. */
    haken: !BEREICHE.some(x=>x.haken===true) };
  BEREICHE.push(b); saveBereiche(); return b;
}
function berAendern(key, feld, wert){ const b=berOf(key); if(!b) return false; b[feld]=wert; saveBereiche(); return true; }
function berLoeschen(key){ BEREICHE = BEREICHE.filter(x=>x.key!==key); saveBereiche(); }
function berVerschieben(key, richtung){
  const l = berListe(); const i=l.findIndex(x=>x.key===key); const j=i+(richtung<0?-1:1);
  if(i<0 || j<0 || j>=l.length) return false;
  const t=l[i]; l[i]=l[j]; l[j]=t;
  l.forEach((x,n)=>{ const b=berOf(x.key); if(b) b.ord=n; });
  saveBereiche(); return true;
}

/* ═══════════ 2. Der Bereich einer Zeile ═══════════ */

/* Läuft über die normale Kaskade — deshalb hier nur ein Aufruf und keine
   eigene Auflösung. Ein unbekannter Schlüssel (Bereich gelöscht) gilt als
   „ohne": lieber keine Angabe als eine falsche. */
function berVon(e, cid){
  if(typeof qeGet!=='function') return null;
  const v = qeGet(e, cid, 'bereich');
  if(!v) return null;
  return berOf(String(v));
}
function berBadgeHTML(e, cid){
  const b = berVon(e, cid);
  if(!b) return '';
  /* Im Verwaltungsmodus zeigt das Häkchen selbst schon Symbol und Wort dieses
     einen Bereichs — dann stünde der Chip zweimal nebeneinander. */
  if(b.haken===true && (typeof ADMIN!=='undefined') && ADMIN) return '';
  return `<span class="ber-chip" style="--ber:${esc(b.farbe||'#5fb0e0')}">${esc(b.symbol||'📍')} ${esc(b.wort)}</span>`;
}

/* ═══════════ 2b. Das Häkchen am Material ═══════════

   „dazu soll nur eine kleine Checkbox beim Material vorhanden sein welche
   genau das aussagt. wichtig das kann von Standard zu Standard und von
   Material zu Material variieren daher eine Einstellung die spezifisch ist."

   Über „⋯ → Bereich" waren das vier Berührungen je Zeile: Menü öffnen,
   „Bereich", den Bereich wählen, die Reichweite bestätigen. Bei 40 Materialien
   in einem Standard sind das 160. Mit dem Häkchen ist es EINE.

   ── Warum ohne Reichweiten-Frage ──
   Weil der Betreiber genau das gesagt hat: Die Zuordnung variiert von Standard
   zu Standard und von Material zu Material. Das Häkchen schreibt deshalb immer
   nur DIESE Stelle. Wer „Kompressen gehören überall auf den sterilen Tisch"
   meint, nimmt weiterhin „⋯ → Bereich" — dort steht die ganze Treppe.

   ── Warum nur EIN Bereich am Häkchen hängt ──
   Ein Häkchen ist ja/nein. Drei Bereiche bräuchten drei Häkchen und wären
   wieder eine Liste. Der Bereich mit dem Häkchen ist der, den man hundertmal
   am Tag vergibt; alle anderen bleiben im Menü. */

function berHakenBereich(){ return BEREICHE.find(b=>b.haken===true) || null; }
function berHakenSetzen(key){
  BEREICHE.forEach(b=>{ b.haken = (b.key===key); });
  saveBereiche();
}

/* Trägt DIESE Zeile den Häkchen-Bereich? */
function berHatHaken(e, cid){
  const b = berHakenBereich(); if(!b) return false;
  const jetzt = berVon(e, cid);
  return !!(jetzt && jetzt.key===b.key);
}

function berHakenHTML(e, cid, beschaffbar){
  if(typeof ADMIN==='undefined' || !ADMIN) return '';
  if(!beschaffbar) return '';                 /* ein Handgriff kommt nicht auf den Tisch */
  const b = berHakenBereich(); if(!b) return '';
  const an = berHatHaken(e, cid);
  return `<button type="button" class="ber-haken${an?' on':''}" role="checkbox" aria-checked="${an?'true':'false'}"
    style="--ber:${esc(b.farbe||'#5fb0e0')}" data-cid="${esc(cid)}"
    onclick="berHakenTippen(this.dataset.cid)"
    ><span class="bh-box" aria-hidden="true">${an?'✓':''}</span>${esc(b.symbol||'📍')} ${esc(b.wort)}</button>`;
}

/* Antippen. Aufgefrischt wird NUR diese eine Zeile: Die Rubrik neu zu zeichnen
   kostet bei 58 Einträgen spürbar Zeit und springt an den Anfang zurück —
   wer eine Liste durchhakt, verliert dann bei jedem Häkchen seine Stelle. */
function berHakenTippen(cid){
  const b = berHakenBereich(); if(!b) return;
  const e = (typeof findEntry==='function') ? findEntry(cid) : null; if(!e) return;
  const an = berHatHaken(e, cid);
  const neu = an ? null : b.key;
  /* Derselbe Schreibweg wie im Menü, nur ohne Rückfrage — Reichweite „nur
     diese Stelle" (features/quickmenu.js → applyPending). */
  const ziel = (typeof ruleZiel==='function') ? ruleZiel(e) : (e.material_key?{art:'material',key:e.material_key}:null);
  if(ziel && typeof addRule==='function'){
    addRule(ziel, {art:'stelle',wert:cid}, 'bereich', neu);
  } else if(typeof qeSet==='function'){
    qeSet('cid', e, cid, 'bereich', neu);
  }
  if(typeof document==='undefined') return;
  const zeilen = document.querySelectorAll('.ber-haken');
  for(let i=0;i<zeilen.length;i++){
    const z = zeilen[i];
    if(z.dataset.cid!==String(cid)) continue;
    const box = document.createElement('div');
    box.innerHTML = berHakenHTML(e, cid, true);
    if(box.firstElementChild) z.replaceWith(box.firstElementChild);
  }
}

/* A7: Langdruck auf das Häkchen öffnet den Bereich selbst. */
let berFlaeche = null;
function berFlaecheSheet(key){
  if(typeof ADMIN!=='undefined' && !ADMIN) return;
  if(!berOf(key)) return;
  berFlaeche = key; berFlaecheZeichnen();
  if(typeof showSheet==='function') showSheet(true);
}
function berFlaecheZeichnen(){
  const b = berOf(berFlaeche); if(!b || typeof $!=='function' || !$('sheet')) return;
  const andere = berListe().filter(x=>x.key!==b.key);
  $('sheet').innerHTML = `<div class="sheet-grip"></div><div class="sheet-title">Bereich</div>
    <div class="sheet-name">${esc(b.symbol||'📍')} ${esc(b.wort)}</div>
    <p class="why-help">Das Häkchen am Material setzt genau diesen Bereich — und nur an der einen Stelle, an der es steht. Alle anderen Bereiche stehen weiter unter „⋯ → Bereich", dort mit der ganzen Reichweiten-Treppe.</p>
    <div class="form-grp"><div class="flabel">Wort</div>
      <input class="loc-input" id="berFlWort" value="${esc(b.wort)}"></div>
    <div class="form-grp"><div class="flabel">Symbol</div>
      <input class="loc-input" id="berFlIco" value="${esc(b.symbol||'')}" maxlength="4"></div>
    <div class="p-actions"><button class="btn btn-pri" onclick="berFlaecheSpeichern()">Übernehmen</button></div>
    ${andere.length?`<div class="sheet-pick" style="margin-top:10px">
      <div class="flabel" style="padding:0 4px 4px">Häkchen stattdessen auf</div>
      ${andere.map(x=>`<button class="sheet-pick-btn" data-k="${esc(x.key)}" onclick="berFlaecheUmhaengen(this.dataset.k)">${esc(x.symbol||'📍')} ${esc(x.wort)}</button>`).join('')}
    </div>`:''}
    <p class="hint" style="padding:8px 4px">Weitere Bereiche anlegen, umsortieren oder löschen: Verwaltung → „📍 Bereiche".</p>
    <button class="sheet-close" onclick="showSheet(false)">Schließen</button>`;
}
function berFlaecheSpeichern(){
  const b = berOf(berFlaeche); if(!b) return;
  const w = ($('berFlWort') && $('berFlWort').value || '').trim();
  const i = ($('berFlIco')  && $('berFlIco').value  || '').trim();
  if(w) berAendern(b.key, 'wort', w);
  berAendern(b.key, 'symbol', i || '📍');
  if(typeof showSheet==='function') showSheet(false);
  if(typeof reRenderDetail==='function') reRenderDetail();
  if(typeof toast==='function') toast('Übernommen');
}
function berFlaecheUmhaengen(key){
  berHakenSetzen(key);
  if(typeof showSheet==='function') showSheet(false);
  if(typeof reRenderDetail==='function') reRenderDetail();
  if(typeof toast==='function') toast('Häkchen hängt jetzt an „'+((berOf(key)||{}).wort||'')+'"');
}

/* Alle Zeilen eines Standards nach Bereich gruppiert — die Grundlage für die
   zweite Sicht in der Rüstliste. „ohne Angabe" ist eine eigene Gruppe und
   steht am Ende: Was nicht zugeordnet ist, muss auffallen, nicht verschwinden. */
function berGruppen(sid){
  const gruppen = new Map();
  berListe().forEach(b=>gruppen.set(b.key, { bereich:b, zeilen:[] }));
  gruppen.set('', { bereich:null, zeilen:[] });
  if(typeof DB==='undefined' || !DB || !DB.standards) return [...gruppen.values()];
  const s = DB.standards.find(x=>x.id===sid); if(!s) return [...gruppen.values()];
  (s.rubriken||[]).forEach((r,ri)=>{
    if(r.typ!=='material' && r.typ!=='geraete') return;
    (r.sub_bereiche||[]).forEach((sb,si)=>{
      (sb.eintraege||[]).forEach((e,ei)=>{
        if(!e || e.natur==='ueberschrift' || e.ist_fliesstext) return;
        const cid = cidOf(sid, ri, si, ei);
        if(typeof qeGet==='function' && qeGet(e,cid,'hidden')===true) return;
        const b = berVon(e, cid);
        const topf = gruppen.get(b?b.key:'');
        if(topf) topf.zeilen.push({ e, cid, rubrik:r.name });
      });
    });
  });
  return [...gruppen.values()].filter(g=>g.zeilen.length);
}

/* ═══════════ 3. Bedienung im Schnellmenü ═══════════ */

function renderSheetBereich(){
  const e = sheetEntry, cid = sheetCid; if(!e) return;
  const jetzt = berVon(e, cid);
  const liste = berListe();
  let h = `<div class="sheet-grip"></div><div class="sheet-title">Bereich</div>
    <div class="sheet-name">${esc((typeof qeGet==='function'&&qeGet(e,cid,'name')!==undefined)?qeGet(e,cid,'name'):(e.anzeige_text||''))}</div>`;
  h += `<p class="why-help">Wohin gehört dieses Material? Das ist eine <b>zweite Sicht</b> neben Kategorie und Abschnitt — beide bleiben, wie sie sind.</p>`;
  if(!liste.length){
    h += `<p class="hint" style="padding:0 4px">Noch kein Bereich angelegt. Das Haus legt sie in der Verwaltung unter „📍 Bereiche" an — zum Beispiel „steriler Tisch" und „Umfeld".</p>`;
  }
  h += `<div class="sheet-pick">`;
  liste.forEach(b=>{
    h += `<button class="sheet-pick-btn${(jetzt&&jetzt.key===b.key)?' sel':''}" data-k="${esc(b.key)}" onclick="berUiSetzen(this.dataset.k)">${esc(b.symbol||'📍')} ${esc(b.wort)}</button>`;
  });
  h += `<button class="sheet-pick-btn${jetzt?'':' sel'}" onclick="berUiSetzen('')">— ohne Angabe —</button>`;
  h += `</div><button class="sheet-close" onclick="renderSheetMain()">Zurück</button>`;
  $('sheet').innerHTML = h;
}
function berUiSetzen(key){
  if(typeof sheetPending==='undefined') return;
  sheetPending = { kind:'bereich', value: key || null };
  if(typeof askScope==='function') askScope();
}

/* ═══════════ 4. Verwaltung ═══════════ */

let berForm = null;

function bereichePanelHTML(){
  const liste = berListe();
  const head = (typeof vsum==='function')
    ? vsum('📍','Bereiche','Zweite Sicht aufs Material — steriler Tisch, Umfeld, …', liste.length?(liste.length+' angelegt'):'')
    : `<summary>📍 Bereiche</summary>`;
  let h = `<details class="vpanel" data-keys="bereich bereiche steriler tisch umfeld anästhesie anaesthesie sicht perspektive rüstliste ruestliste">
    ${head}<div class="vpanel-body">
    <p class="panel-help">Ein Bereich sagt, <b>wohin</b> ein Material kommt — nicht was es ist (Kategorie) und nicht wo es im Standard steht (Abschnitt). Alle drei gelten gleichzeitig. Vergeben wird der Bereich am Eintrag über „⋯ → Bereich", mit der üblichen Reichweite.</p>`;
  if(!liste.length) h += `<p class="hint">Noch kein Bereich angelegt. Übliche erste Schritte: „steriler Tisch" und „Umfeld".</p>`;
  liste.forEach(b=>{
    h += `<div class="ber-zeile">
      <input class="loc-input ber-sym" value="${esc(b.symbol||'')}" maxlength="4" data-k="${esc(b.key)}" onchange="berUiFeld(this.dataset.k,'symbol',this.value)" aria-label="Symbol">
      <input class="loc-input" value="${esc(b.wort)}" data-k="${esc(b.key)}" onchange="berUiFeld(this.dataset.k,'wort',this.value)" aria-label="Bezeichnung">
      <input type="color" class="ber-farbe" value="${esc(b.farbe||'#5fb0e0')}" data-k="${esc(b.key)}" oninput="berUiFeld(this.dataset.k,'farbe',this.value)" aria-label="Farbe">
      <div class="ber-akt">
        <button class="${b.haken===true?'on':''}" data-k="${esc(b.key)}" onclick="berUiHaken(this.dataset.k)">${b.haken===true?'☑ Häkchen am Material':'☐ Häkchen am Material'}</button>
        <button data-k="${esc(b.key)}" onclick="berUiVerschieben(this.dataset.k,-1)" aria-label="nach oben">⬆</button>
        <button data-k="${esc(b.key)}" onclick="berUiVerschieben(this.dataset.k,1)" aria-label="nach unten">⬇</button>
        <button class="dgr" data-k="${esc(b.key)}" onclick="berUiLoeschen(this.dataset.k)">Löschen</button>
      </div></div>`;
  });
  h += berForm
    ? `<div class="eig-neu"><input class="loc-input" id="berNeuInp" placeholder="Name des Bereichs, z. B. steriler Tisch">
        <div class="p-actions"><button class="btn btn-sec" onclick="berUiAbbrechen()">Abbrechen</button><button class="btn btn-pri" onclick="berUiAnlegenSpeichern()">Anlegen</button></div></div>`
    : `<div class="p-actions"><button class="btn btn-sec" onclick="berUiAnlegen()">＋ Bereich anlegen</button></div>`;
  h += `</div></details>`;
  return h;
}
function berUiAnlegen(){ berForm=true; if(typeof renderAdmin==='function') renderAdmin();
  setTimeout(()=>{ const i=$('berNeuInp'); if(i) i.focus(); },50); }
function berUiAbbrechen(){ berForm=null; if(typeof renderAdmin==='function') renderAdmin(); }
function berUiAnlegenSpeichern(){
  const i=$('berNeuInp'); const w=(i&&i.value||'').trim();
  if(!w){ if(typeof toast==='function') toast('Bitte einen Namen eingeben',true); return; }
  berAnlegen(w); berForm=null;
  if(typeof renderAdmin==='function') renderAdmin();
  if(typeof toast==='function') toast('Bereich „'+w+'" angelegt');
}
function berUiFeld(key,feld,wert){ berAendern(key,feld,wert); if(typeof toast==='function') toast('Übernommen'); }
/* Genau EIN Bereich trägt das Häkchen am Material. Nochmal auf denselben zu
   tippen nimmt es weg — dann ist die Zuordnung wieder nur über „⋯ → Bereich"
   zu haben, und die Zeilen bleiben frei von Kästchen. */
function berUiHaken(key){
  const b = berOf(key); if(!b) return;
  if(b.haken===true){ b.haken=false; saveBereiche(); }
  else berHakenSetzen(key);
  if(typeof renderAdmin==='function') renderAdmin();
  if(typeof toast==='function') toast(b.haken===true ? 'Häkchen an „'+b.wort+'"' : 'Kein Häkchen mehr am Material');
}
function berUiVerschieben(key,richtung){ if(berVerschieben(key,richtung) && typeof renderAdmin==='function') renderAdmin(); }
function berUiLoeschen(key){
  berLoeschen(key);
  if(typeof renderAdmin==='function') renderAdmin();
  /* Die Vergaben bleiben in den Regeln stehen — sie zeigen dann ins Leere und
     gelten als „ohne Angabe". Das ist Absicht: Wer den Bereich versehentlich
     löscht und neu anlegt, bekommt seine Zuordnungen zurück. */
  if(typeof toast==='function') toast('Bereich gelöscht — vergebene Zuordnungen bleiben erhalten');
}
