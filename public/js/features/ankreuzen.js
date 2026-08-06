/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — ANKREUZEN STATT ABTIPPEN

   Einen neuen Standard aufzubauen hieß bisher: für jede Zeile das Formular
   öffnen, den Namen tippen, Kategorie wählen, speichern, wieder von vorn.
   Bei einer Materialrubrik sind das vierzig Mal dieselbe Handbewegung — für
   Material, das in der App längst steht. Getippt wird dabei nicht nur
   langsam, sondern auch anders: „Radialschleuse 6 F" neben „Radialschleuse
   6F" ist der Anfang genau der Dublettenarbeit, die anderswo mühsam wieder
   aufgeräumt wird.

   Der Betreiber dazu, schon vor längerem: „Ankreuzen statt Abtippen."

   Dieser Baustein legt in JEDE Rubrik einen Mehrfach-Wähler: eine Liste
   dessen, was es schon gibt, mit Suchfeld und Häkchen. Einmal ankreuzen,
   einmal einfügen.

   ── Woher die Liste kommt ──
   Nicht aus einem gepflegten Katalog, den erst jemand füllen müsste, sondern
   aus dem BESTAND selbst — und passend zur Sorte der Rubrik:

     Material · Geräte  →  der kanonische Materialbestand (features/pflege.js
                           gruppiert ihn bereits: ein Material, ein Eintrag,
                           egal unter wie vielen Wortlauten es dasteht)
                           PLUS die Katalog-Positionen
     Ablauf · Sonstige  →  die Zeilentexte der Ablauf-Rubriken, nach
                           Schreibweise zusammengefasst

   Sortiert wird nach HÄUFIGKEIT: Was im Haus oft vorkommt, wird auch hier
   meistens gesucht. Der frühere Weg „⬇ Aus Katalog übernehmen" ist darin
   aufgegangen — er konnte nur eine Position auf einmal und kannte nur den
   Katalog, also den kleinsten der drei Töpfe.

   ── Was hier NICHT passiert ──
   Es wird nichts zusammengeführt, umbenannt oder verschoben. Angekreuzt
   entsteht ein ganz normaler eigener Eintrag, wie ihn auch das Formular
   anlegt — mit demselben Namen und damit demselben Materialschlüssel wie das
   Vorbild. Genau deshalb hängen Foto, Preis und Maße sofort mit dran, ohne
   dass jemand etwas verknüpfen müsste.
   ───────────────────────────────────────────────────────────── */

let ANK = null;          /* offener Wähler: {sid, ri, sorte, rname} */
let ankWahl = {};        /* key → true */
let ankSuche = '';

/* Material und Geräte sind EINE Sorte: In beiden steht ein Ding, das man
   anfassen kann. Ablauf und Sonstiges sind die andere: dort stehen Handgriffe. */
function ankSorte(typ){ return (typ==='material' || typ==='geraete') ? 'material' : 'ablauf'; }

/* Der Bestand je Sorte. Ein voller Durchlauf über 4.475 Zeilen ist nicht
   gratis — gerechnet wird deshalb einmal und bis zur nächsten Datenänderung
   behalten. */
let ankCache = {};
function ankCacheLeeren(){ ankCache = {}; }
function ankBestand(sorte){
  if(ankCache[sorte]) return ankCache[sorte];
  const liste = (sorte==='material') ? ankMaterialBestand() : ankAblaufBestand();
  liste.sort((a,b)=> (b.n-a.n) || (a.name||'').localeCompare(b.name||'','de'));
  ankCache[sorte] = liste;
  return liste;
}

/* Materialien: der kanonische Bestand. Dass „Radialschleuse 6F" hier EINMAL
   steht und nicht elfmal, ist keine Kosmetik — eine Liste mit elf gleichen
   Zeilen wäre unbenutzbar. */
function ankMaterialBestand(){
  const aus = [];
  const mats = (typeof pfMaterialien==='function') ? pfMaterialien() : [];
  mats.forEach(m=>{
    const st = m.stellen && m.stellen[0];
    aus.push({ key:'m:'+m.key, name:m.name,
      nat: (st && typeof effNatur==='function') ? effNatur(st.e, st.cid) : 'material',
      uk:  (st && typeof canonUk==='function')  ? (canonUk(st.e, st.cid)||'') : '',
      n: m.vorkommen || 1, quelle:'bestand',
      wo: (m.standards||[]).length });
  });
  /* Katalog-Positionen: gepflegte Vorlagen, die (noch) nirgends stehen. */
  const kat = (typeof CATALOG==='object' && CATALOG && Array.isArray(CATALOG.items)) ? CATALOG.items : [];
  const da = new Set(aus.map(x=>String(x.name||'').trim().toLowerCase()));
  kat.forEach(it=>{
    const nm = String(it.name||'').trim(); if(!nm) return;
    if(da.has(nm.toLowerCase())) return;      /* im Bestand schon vorhanden */
    aus.push({ key:'k:'+it.id, name:nm, nat:it.nat||'material', uk:it.uk||'',
      menge:it.menge||'', sizeTyp:it.sizeTyp||'', sizeVal:it.sizeVal||'',
      n:0, quelle:'katalog', wo:0 });
  });
  return aus;
}

/* Handgriffe: was in den Ablauf-Rubriken steht, nach Schreibweise
   zusammengefasst (derselbe Schlüssel wie bei den Bausteinen — „Coro-Set" und
   „Coro Set" sind dasselbe). */
function ankAblaufBestand(){
  const map = new Map();
  if(typeof DB==='undefined' || !DB || !DB.standards || typeof cidOf!=='function') return [];
  DB.standards.forEach(s=>{
    if(typeof stdHidden==='function' && stdHidden(s)) return;
    (s.rubriken||[]).forEach((r,ri)=>{
      if(r.typ==='material' || r.typ==='geraete') return;
      (r.sub_bereiche||[]).forEach((sb,si)=>{ (sb.eintraege||[]).forEach((e,ei)=>{
        if(!e || e.natur==='ueberschrift' || e.ist_fliesstext) return;
        const cid = cidOf(s.id,ri,si,ei);
        if(typeof qeGet==='function' && qeGet(e,cid,'hidden')===true) return;
        const nm = (typeof qeGet==='function' && qeGet(e,cid,'name')!==undefined)
          ? qeGet(e,cid,'name') : (e.anzeige_text||'');
        if(!nm) return;
        const k = (typeof bauSlug==='function') ? bauSlug(nm) : String(nm).toLowerCase();
        if(!k) return;
        let t = map.get(k);
        if(!t){ t = { key:'a:'+k, name:nm, n:0, quelle:'bestand', stds:new Set(),
          nat:(typeof effNatur==='function')?effNatur(e,cid):(e.natur||'ablauf'),
          uk:(typeof canonUk==='function')?(canonUk(e,cid)||''):'' }; map.set(k,t); }
        t.n++; t.stds.add(s.id);
      }); });
    });
  });
  return [...map.values()].map(t=>({ key:t.key, name:t.name, nat:t.nat, uk:t.uk,
    n:t.n, quelle:t.quelle, wo:t.stds.size }));
}

function ankFinden(key){
  if(!ANK) return null;
  return ankBestand(ANK.sorte).find(x=>x.key===key) || null;
}

/* ═══════════ Einfügen ═══════════ */

/* Angekreuzt entsteht ein ganz normaler eigener Eintrag — derselbe Weg wie im
   Formular, damit es hinterher keinen Unterschied gibt zwischen „getippt" und
   „angekreuzt". */
function ankEinfuegen(sid, ri, keys){
  if(typeof ADDITIONS==='undefined' || !ADDITIONS || typeof makeAddEntry!=='function') return 0;
  /* Erst sammeln, dann anhängen: Sonst bliebe bei „nichts angekreuzt" ein
     leerer Topf im Speicher stehen — unsichtbar, aber eine Unwahrheit. */
  const neu = [];
  (keys||[]).forEach(k=>{
    const it = ankFinden(k); if(!it) return;
    neu.push(makeAddEntry({ name:it.name, nat:it.nat||'material', uk:it.uk||'',
      menge:it.menge||'', sizeTyp:it.sizeTyp||'', sizeVal:it.sizeVal||'',
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
  ankCacheLeeren();
  if(typeof pfCacheLeeren==='function') pfCacheLeeren();
  return n;
}

/* ═══════════ Der Wähler ═══════════ */

function ankOeffnen(ri){
  if(typeof ADMIN!=='undefined' && !ADMIN){ if(typeof promptLoginThen==='function'){ promptLoginThen(()=>ankOeffnen(ri)); return; } }
  if(typeof curStd==='undefined' || !curStd) return;
  const r = (curStd.rubriken||[])[ri]; if(!r) return;
  ANK = { sid:curStd.id, ri, sorte:ankSorte(r.typ),
    rname:(typeof rubName==='function')?rubName(r,ri):(r.name||'') };
  ankWahl = {}; ankSuche = '';
  ankZeichnen();
  if(typeof showSheet==='function') showSheet(true);
}

function ankZeichnen(){
  if(!ANK) return;
  const wort = (ANK.sorte==='material') ? 'Material' : 'Handgriffe';
  const h = `<div class="sheet-grip"></div>
    <div class="sheet-title">☑ Ankreuzen statt Abtippen</div>
    <div class="sheet-name">${esc(ANK.rname)}</div>
    <p class="why-help">Alles, was in der App schon steht — ${esc(wort)}, nach Häufigkeit sortiert. Ankreuzen, einfügen, fertig. Ein angekreuzter Eintrag trägt denselben Namen wie sein Vorbild und damit auch dessen Foto, Maße und Preis.</p>
    <input type="text" id="ankSuche" class="txtinp" style="width:100%" placeholder="Suchen …"
      value="${esc(ankSuche)}" oninput="ankUiSuche(this.value)">
    <div id="ankListe" class="ank-liste">${ankListeHTML()}</div>
    <div class="p-actions" style="padding:10px 4px 4px">
      <button class="btn btn-sec" onclick="ankAbbrechen()">Abbrechen</button>
      <button class="btn btn-pri" id="ankBtn" onclick="ankUiEinfuegen()" disabled>Nichts gewählt</button></div>`;
  $('sheet').innerHTML = h;
  ankKnopfAuffrischen();
}

function ankListeHTML(){
  if(!ANK) return '';
  const alle = ankBestand(ANK.sorte);
  const q = String(ankSuche||'').trim().toLowerCase();
  const treffer = q ? alle.filter(x=>String(x.name||'').toLowerCase().indexOf(q)>=0) : alle;
  if(!treffer.length){
    return `<p class="hint" style="padding:6px 4px">${alle.length
      ? 'Nichts gefunden. Ein Eintrag, den es noch nirgends gibt, wird über „＋ Eintrag hinzufügen" angelegt.'
      : 'In der App steht dafür noch nichts. Der erste Eintrag dieser Art wird über „＋ Eintrag hinzufügen" getippt.'}</p>`;
  }
  /* Gewähltes bleibt IMMER sichtbar, auch wenn die Suche es gerade
     ausschließt — sonst kreuzt man an, tippt weiter und glaubt, es sei weg. */
  const gewaehltAusserhalb = alle.filter(x=>ankWahl[x.key] && treffer.indexOf(x)<0);
  const zeile = (x)=>{
    const info = (typeof natOf==='function') ? natOf(x.nat) : {label:'',color:'#888'};
    const sub = [ (x.quelle==='katalog') ? 'aus dem Katalog'
                : (x.n>1 ? (x.n+'× im Bestand'+(x.wo>1?(' · '+x.wo+' Standards'):'')) : 'einmal im Bestand'),
                  x.uk||'' ].filter(Boolean).join(' · ');
    return `<label class="ank-zeile${ankWahl[x.key]?' on':''}">
      <input type="checkbox" value="${esc(x.key)}" ${ankWahl[x.key]?'checked':''} onchange="ankSchalten(this.value,this.checked)">
      <span class="ank-farbe" style="background:${esc(info.color||'#888')}"></span>
      <span class="ank-haupt"><span class="ank-n">${esc(x.name)}</span>
        <span class="ank-s">${esc(sub)}</span></span></label>`;
  };
  return (gewaehltAusserhalb.length
      ? `<div class="bez-sec">Bereits angekreuzt</div>` + gewaehltAusserhalb.map(zeile).join('')
      : '')
    + (gewaehltAusserhalb.length ? `<div class="bez-sec">Treffer</div>` : '')
    + treffer.slice(0,200).map(zeile).join('')
    + (treffer.length>200 ? `<p class="hint" style="padding:6px 4px">… und ${treffer.length-200} weitere. Suchbegriff eingeben.</p>` : '');
}

function ankUiSuche(v){
  ankSuche = v||'';
  /* NUR die Liste neu bauen: Ein Neuaufbau des ganzen Sheets nähme dem
     Suchfeld den Fokus, und nach jedem Buchstaben neu hineintippen zu müssen
     wäre unbenutzbar. */
  const box = $('ankListe'); if(box) box.innerHTML = ankListeHTML();
}
function ankSchalten(key, an){
  if(an) ankWahl[key]=true; else delete ankWahl[key];
  const el = $('ankListe') && $('ankListe').querySelector('input[value="'+(window.CSS&&CSS.escape?CSS.escape(key):key)+'"]');
  if(el && el.closest) el.closest('.ank-zeile').classList.toggle('on', !!an);
  ankKnopfAuffrischen();
}
function ankKnopfAuffrischen(){
  const btn = $('ankBtn'); if(!btn) return;
  const n = Object.keys(ankWahl).filter(k=>ankWahl[k]).length;
  btn.textContent = n ? ('Einfügen ('+n+')') : 'Nichts gewählt';
  btn.disabled = !n;
}
function ankAbbrechen(){ ANK=null; ankWahl={}; ankSuche=''; if(typeof showSheet==='function') showSheet(false); }
function ankUiEinfuegen(){
  if(!ANK) return;
  const keys = Object.keys(ankWahl).filter(k=>ankWahl[k]);
  const n = ankEinfuegen(ANK.sid, ANK.ri, keys);
  ANK=null; ankWahl={}; ankSuche='';
  if(typeof showSheet==='function') showSheet(false);
  if(typeof reRenderDetail==='function') reRenderDetail();
  if(typeof toast==='function') toast(n ? (n+' Eintr'+(n===1?'ag':'äge')+' eingefügt') : 'Nichts eingefügt');
}
