/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — BEZIEHUNGEN ZWISCHEN PRODUKTEN (Neuaufbau)

   Ein Produkt steht selten allein. Der Fall, an dem das gebaut ist:

     Der Inquiry-10-pol-CS-Katheter (Abbott) braucht dazu das
     Verbindungskabel IBI 1910SA. Beides gibt es neu — und beides gibt es
     resterilisiert von Vanguard.

   Daraus folgen genau zwei Arten von Beziehung:

     🧩 ZUBEHÖR — „braucht dazu". GERICHTET: Der Katheter braucht das Kabel,
        nicht umgekehrt. Am Kabel erscheint die Gegenrichtung („wird
        gebraucht von …") als Auskunft, ohne dass sie gespeichert wird —
        so kann sie nie aus dem Tritt geraten.

     ♻️ AUFBEREITUNG — „ist die aufbereitete Fassung von". Ein Aufbereiter
        wie Vanguard bringt das Produkt als EIGENER Hersteller wieder in
        Verkehr, mit eigenem Etikett und eigener Nummer (MDR Art. 17). Das ist
        deshalb ein ZWEITES Produkt — mit einer Beziehung zum Original. Auch
        hier wird nur eine Richtung gespeichert (am aufbereiteten Produkt);
        das Original zeigt „gibt es auch aufbereitet".

   Wie die Beziehungen später in der Rüstliste erscheinen, ist bewusst noch
   offen — das soll der Test zeigen. Festgehalten werden sie schon jetzt:
   beim Erfassen am Produkt und beim Schreiben eines Standards an der Zeile
   (die Zeile zeigt auf ein Produkt, also gilt die Beziehung dort).

   Gespeichert am Stammsatz:  rec.beziehungen = [ { art, ziel } ]
   ───────────────────────────────────────────────────────────── */

/* ═══════════ 1. Reine Helfer ═══════════ */

const BZH_ARTEN = [
  { key:'zubehoer',     ico:'🧩', vorgabe:'Braucht dazu',              gegen:'Wird gebraucht von' },
  { key:'aufbereitung', ico:'♻️', vorgabe:'Aufbereitete Fassung von',   gegen:'Gibt es auch aufbereitet' },
];
function bzhArt(key){ return BZH_ARTEN.find(a=>a.key===key) || null; }

/* Bereinigte Liste: nur bekannte Arten, keine Dubletten, nie auf sich selbst. */
function bzhNormal(liste, eigeneId){
  const aus = [], gesehen = {};
  (Array.isArray(liste)?liste:[]).forEach(b=>{
    if(!b || !bzhArt(b.art) || !b.ziel || b.ziel===eigeneId) return;
    const k = b.art+'|'+b.ziel;
    if(gesehen[k]) return; gesehen[k] = 1;
    aus.push({ art:b.art, ziel:String(b.ziel) });
  });
  return aus;
}

/* Alle Beziehungen eines Produkts in BEIDE Richtungen:
   { raus:[{art,ziel}], rein:[{art,von}] }. Rein/testbar. */
function bzhVon(db, id){
  const r = db && db[id];
  const raus = bzhNormal(r && r.beziehungen, id).filter(b=>db[b.ziel]);
  const rein = [];
  Object.keys(db||{}).forEach(k=>{
    if(k===id) return;
    bzhNormal(db[k] && db[k].beziehungen, k).forEach(b=>{ if(b.ziel===id) rein.push({ art:b.art, von:k }); });
  });
  return { raus, rein };
}

/* Zubehör, das an einer Stelle noch fehlt: Das Produkt braucht etwas, das
   in derselben Liste nicht vorkommt. Für den Hinweis beim Schreiben eines
   Standards. Rein/testbar. */
function bzhFehlendesZubehoer(db, id, vorhandeneIds){
  const da = {}; (vorhandeneIds||[]).forEach(x=>{ da[x] = 1; });
  return bzhVon(db, id).raus.filter(b=>b.art==='zubehoer' && !da[b.ziel]).map(b=>b.ziel);
}

/* ═══════════ 2. Im Produktformular ═══════════ */

/* Entwurf des offenen Formulars (wird erst mit „Speichern" geschrieben). */
let BZH_ENTWURF = null;   /* { id, liste:[{art,ziel}] } */

function bzhName(id){ const r=(typeof GTINDB!=='undefined')&&GTINDB[id]; return r ? (r.name||r.ref||id) : String(id||''); }

function bzhChipsHTML(){
  if(!BZH_ENTWURF) return '';
  return BZH_ARTEN.map(a=>{
    const l = BZH_ENTWURF.liste.filter(b=>b.art===a.key);
    const chips = l.map(b=>`<span class="bzh-chip">${a.ico} ${esc(bzhName(b.ziel))}<button type="button" aria-label="Beziehung entfernen" data-a="${esc(a.key)}" data-z="${esc(b.ziel)}" onclick="bzhEntfernen(this.dataset.a,this.dataset.z)">✕</button></span>`).join('');
    return `<div class="bzh-zeile"><div class="bzh-l">${esc(a.vorgabe)}</div><div class="bzh-v">${chips||'<span class="hint">—</span>'}
      <button type="button" class="vlink" data-a="${esc(a.key)}" onclick="bzhWaehlen(this.dataset.a)">＋ wählen</button></div></div>`;
  }).join('');
}
function bzhGegenHTML(id){
  if(typeof GTINDB==='undefined' || !id || !GTINDB[id]) return '';
  const rein = bzhVon(GTINDB, id).rein;
  if(!rein.length) return '';
  return BZH_ARTEN.map(a=>{
    const l = rein.filter(b=>b.art===a.key);
    if(!l.length) return '';
    return `<div class="bzh-zeile"><div class="bzh-l">${esc(a.gegen)}</div><div class="bzh-v">${l.map(b=>
      `<button type="button" class="vlink" data-g="${esc(b.von)}" onclick="openScanItem(this.dataset.g,false)">${a.ico} ${esc(bzhName(b.von))}</button>`).join(' ')}</div></div>`;
  }).join('');
}
function bzhFormHTML(r){
  if(typeof neuFrei!=='function' || !neuFrei('beziehungen')) { BZH_ENTWURF = null; return ''; }
  const id = r && r.gtin || '';
  BZH_ENTWURF = { id, liste:bzhNormal(r && r.beziehungen, id) };
  return `<div class="flabel" style="margin-top:12px">BEZIEHUNGEN</div>
    <div id="bzhBox">${bzhChipsHTML()}</div>
    ${bzhGegenHTML(id)}
    <p class="hint">🧩 „Braucht dazu" ist gerichtet: Der Katheter braucht das Kabel. ♻️ „Aufbereitete Fassung von" steht am aufbereiteten Produkt (eigener Hersteller, eigene Nummer) und zeigt aufs Original.</p>`;
}
function bzhNeuZeichnen(){ const b=$('bzhBox'); if(b) b.innerHTML = bzhChipsHTML(); }
function bzhEntfernen(art, ziel){
  if(!BZH_ENTWURF) return;
  BZH_ENTWURF.liste = BZH_ENTWURF.liste.filter(b=>!(b.art===art && b.ziel===ziel));
  bzhNeuZeichnen();
}
function bzhHinzu(art, ziel){
  if(!BZH_ENTWURF || !bzhArt(art) || !ziel) return false;
  if(ziel===BZH_ENTWURF.id){ toast('Ein Produkt kann nicht zu sich selbst gehören.', true); return false; }
  BZH_ENTWURF.liste = bzhNormal(BZH_ENTWURF.liste.concat([{ art, ziel }]), BZH_ENTWURF.id);
  bzhNeuZeichnen();
  return true;
}
/* Was das Formular in den Stammsatz schreibt. */
function bzhFormPatch(id){
  if(!BZH_ENTWURF || typeof neuFrei!=='function' || !neuFrei('beziehungen')) return {};
  return { beziehungen: bzhNormal(BZH_ENTWURF.liste, id) };
}

/* ── Produkt wählen (Blatt mit Suche) ──
   Wird auch beim Schreiben eines Standards benutzt (siehe bzhAusZeile). */
let BZH_WAHL = null;      /* { art, dann(id) } */
function bzhWaehlen(art, dann){
  BZH_WAHL = { art, dann: dann || (id=>bzhHinzu(art, id)) };
  const a = bzhArt(art);
  $('sheet').innerHTML = `<div class="sheet-grip"></div><div class="sheet-title">${a?esc(a.ico+' '+a.vorgabe):'Produkt wählen'}</div>
    <div class="std-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      <input type="search" id="bzhSuche" placeholder="Name, REF, Hersteller, Synonym …" oninput="bzhSucheNeu(this.value)" autocomplete="off"></div>
    <div id="bzhListe">${bzhListeHTML('')}</div>
    <button class="sheet-close" onclick="showSheet(false)">Schließen</button>`;
  showSheet(true);
  setTimeout(()=>{ const i=$('bzhSuche'); if(i) try{ i.focus(); }catch(e){} }, 60);
}
function bzhListeHTML(q){
  const alle = Object.keys(GTINDB||{}).map(k=>GTINDB[k]).filter(r=>r && (!BZH_ENTWURF || r.gtin!==BZH_ENTWURF.id));
  const l = (typeof filterGtin==='function') ? filterGtin(alle, q) : alle;
  if(!l.length) return `<p class="hint" style="margin:10px 4px">${alle.length?'Kein Treffer.':'Noch keine anderen Produkte erfasst.'}</p>`;
  return l.slice(0,80).map(r=>`<button type="button" class="sheet-act" data-g="${esc(r.gtin)}" onclick="bzhGewaehlt(this.dataset.g)">
    <span class="sa-ico">${r.photo?`<img src="${esc(r.photo)}" alt="" style="width:28px;height:28px;object-fit:cover;border-radius:6px">`:'🏷️'}</span>
    <span>${esc(r.name||r.ref||r.gtin)}<span class="sa-sub">${esc([r.hersteller, r.ref?('REF '+r.ref):''].filter(Boolean).join(' · '))}</span></span></button>`).join('');
}
function bzhSucheNeu(q){ const b=$('bzhListe'); if(b) b.innerHTML = bzhListeHTML(q); }
function bzhGewaehlt(id){
  const w = BZH_WAHL; BZH_WAHL = null;
  showSheet(false);
  if(w && w.dann) w.dann(id);
}

/* ═══════════ 3. In der Produktansicht ═══════════ */
function bzhViewHTML(r){
  if(typeof neuFrei!=='function' || !neuFrei('beziehungen') || !r || !r.gtin || typeof GTINDB==='undefined') return '';
  const v = bzhVon(GTINDB, r.gtin);
  if(!v.raus.length && !v.rein.length) return '';
  const link = (id, ico)=>`<button type="button" class="vlink" data-g="${esc(id)}" onclick="openScanItem(this.dataset.g,false)">${ico} ${esc(bzhName(id))}</button>`;
  return BZH_ARTEN.map(a=>{
    const raus = v.raus.filter(b=>b.art===a.key), rein = v.rein.filter(b=>b.art===a.key);
    let h = '';
    if(raus.length) h += `<div class="info-field"><div class="if-l">${esc(a.vorgabe)}</div><div class="if-v">${raus.map(b=>link(b.ziel,a.ico)).join('<br>')}</div></div>`;
    if(rein.length) h += `<div class="info-field"><div class="if-l">${esc(a.gegen)}</div><div class="if-v">${rein.map(b=>link(b.von,a.ico)).join('<br>')}</div></div>`;
    return h;
  }).join('');
}

/* ═══════════ 4. Beim Schreiben eines Standards ═══════════ */

/* Aus dem Schnellmenü einer Zeile (features/quickmenu.js). */
function bzhAusEintrag(art){
  const e = (typeof sheetEntry!=='undefined') ? sheetEntry : null;
  if(!e || !e.material_key){ showSheet(false); return; }
  showSheet(false);
  bzhAusZeile(e.material_key, art, ()=>{ if(typeof reRenderDetail==='function') reRenderDetail(); });
}

/* Beziehung direkt aus einer Zeile heraus festlegen: Die Zeile zeigt auf ein
   Produkt (Zuordnung, features/zuordnen.js) — die Beziehung gehört an dieses
   Produkt und wird sofort gespeichert. */
function bzhAusZeile(materialKey, art, nachher){
  const id = (typeof canonId==='function') ? canonId(materialKey) : null;
  if(!id || !GTINDB[id]){ toast('Diese Zeile ist noch keinem Produkt zugeordnet — erst „🧬 Produkt zuordnen".', true); return; }
  BZH_ENTWURF = null;
  bzhWaehlen(art, (ziel)=>{
    if(ziel===id){ toast('Ein Produkt kann nicht zu sich selbst gehören.', true); return; }
    const r = GTINDB[id];
    const neu = bzhNormal((r.beziehungen||[]).concat([{ art, ziel }]), id);
    GTINDB[id] = mergeGtinRecord(r, { beziehungen:neu }, new Date().toISOString());
    saveGtinDB();
    const a = bzhArt(art);
    toast((a?a.ico+' ':'')+bzhName(id)+' → '+bzhName(ziel));
    if(typeof nachher==='function') nachher();
  });
}
