/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — BILDER AN JEDEM EINTRAG

   Der Wunsch war klar: „ich möchte zu jedem einzelnen Eintrag Bilder bei
   Bedarf hinzufügen können — nicht nur Material, sondern überall."

   ── Die Entscheidung, die vorher fallen musste (Weg B) ──
   Bis hierher gab es Fotos nur an Materialien, und sie lagen als base64 IM
   geteilten Zustand. Der wandert bei JEDER Änderung komplett zum Server —
   auch beim Umbenennen eines einzelnen Wortes. Ein verkleinertes Foto wiegt
   rund 250 KB; bekäme nur jede zehnte der ~4.500 Zeilen ein Bild, wären das
   über 100 MB gegen eine Grenze von 32 MiB. Der Weg war also nicht „etwas
   knapp", sondern eine Sackgasse mit Datum.

   Deshalb liegen Bilder jetzt EINZELN auf dem Server (/api/media,
   server/media.js). Im geteilten Zustand steht nur die Kennung — 32 Zeichen
   statt 250 KB. Eine Textänderung bleibt eine Textänderung.

   ── Warum die Bilder über dieselbe Reichweiten-Treppe laufen ──
   Ein Bild ist eine Eigenschaft der Zeile wie Name oder Menge. Also nimmt es
   denselben Weg: 📍 nur hier · 📄 in diesem Standard · 🗂 in der Gruppe ·
   🌐 überall. Wer ein Foto des Coro-Sets aufnimmt, kann es mit einem Tipp an
   allen 23 Stellen zeigen lassen, an denen ein Coro-Set steht. Kein zweites
   Menü, keine zweite Frage, keine zweite Denkweise (Grundsatz ⑥).

   ── Ohne Netz ──
   Aufgenommene Bilder warten in einer Warteschlange im Gerät (IndexedDB, weil
   der localStorage für Bilder zu klein ist) und gehen hoch, sobald wieder
   Netz da ist. Bereits hochgeladene Bilder liegen im Cache des Service
   Workers und sind offline sichtbar — ihre Adresse ändert sich nie, weil die
   Kennung der Fingerabdruck des Inhalts ist.
   ───────────────────────────────────────────────────────────── */

/* ═══════════ 1. Reine Helfer ═══════════ */

const MED_MAX_KANTE = 1280;    /* Fotos werden vorher verkleinert */
const MED_QUALITAET = 0.72;
const MED_MAX_PRO_ZEILE = 12;

/* Kennung → Adresse. Eine Kennung bezeichnet für immer denselben Inhalt. */
function medUrl(kennung){ return '/api/media/' + encodeURIComponent(String(kennung||'')); }

/* Ist das eine gültige Kennung (32 Hexstellen)? */
function medIstKennung(k){ return /^[0-9a-f]{32}$/.test(String(k||'')); }

/* Die Bildliste einer Zeile — immer ein Array, immer nur gültige Kennungen.
   „Leer schlägt falsch": Was nicht sicher eine Kennung ist, fliegt raus,
   statt als kaputtes Bild zu erscheinen. */
function medListe(wert){
  if(!Array.isArray(wert)) return [];
  return wert.map(x=>String(x&&x.k!==undefined?x.k:x||'')).filter(medIstKennung).slice(0, MED_MAX_PRO_ZEILE);
}

/* Die wirksamen Bilder einer Zeile (mit der ganzen Kaskade dahinter). */
function medVonEintrag(e, cid){
  if(typeof qeGet!=='function') return [];
  return medListe(qeGet(e, cid, 'bilder'));
}

/* Beschriftungen liegen getrennt von den Zeilen — eine Kennung, eine
   Bildunterschrift, überall gleich. Sonst müsste man dieselbe Unterschrift an
   23 Stellen pflegen. */
let MEDTXT = (typeof loadJSON==='function') ? loadJSON('hkl_medientexte', {}) : {};
function saveMedTxt(){ if(typeof saveJSON==='function') saveJSON('hkl_medientexte', MEDTXT); }
function medText(kennung){ return (MEDTXT && MEDTXT[kennung]) || ''; }
function medTextSetzen(kennung, text){
  if(!medIstKennung(kennung)) return;
  const t = String(text||'').trim();
  if(t) MEDTXT[kennung] = t; else delete MEDTXT[kennung];
  saveMedTxt();
}

/* ═══════════ 2. Warteschlange (ohne Netz) ═══════════ */

/* Bewusst IndexedDB und nicht localStorage: Ein Foto belegt dort ein
   Vielfaches des Platzes, den der gesamte übrige Zustand braucht — ein
   einziges Bild könnte den Speicher sprengen und dabei ECHTE Daten
   verdrängen. IndexedDB ist der dafür vorgesehene Ort und um Größenordnungen
   größer. */
const MED_DB = 'hkl-medien';
const MED_LADEN = 'warteschlange';
let _medDb = null;
function medDb(){
  if(_medDb) return _medDb;
  _medDb = new Promise((ok, nein)=>{
    if(typeof indexedDB==='undefined'){ nein(new Error('kein IndexedDB')); return; }
    const a = indexedDB.open(MED_DB, 1);
    a.onupgradeneeded = ()=>{ const db=a.result; if(!db.objectStoreNames.contains(MED_LADEN)) db.createObjectStore(MED_LADEN, {keyPath:'id'}); };
    a.onsuccess = ()=>ok(a.result);
    a.onerror  = ()=>nein(a.error);
  });
  return _medDb;
}
function medTx(modus, fn){
  return medDb().then(db=>new Promise((ok, nein)=>{
    const tx = db.transaction(MED_LADEN, modus);
    const st = tx.objectStore(MED_LADEN);
    let erg; try{ erg = fn(st); }catch(e){ nein(e); return; }
    tx.oncomplete = ()=>ok(erg && erg.result!==undefined ? erg.result : erg);
    tx.onerror = ()=>nein(tx.error);
  }));
}
function medWarteAnlegen(satz){ return medTx('readwrite', st=>st.put(satz)); }
function medWarteAlle(){ return medTx('readonly', st=>st.getAll()); }
function medWarteWeg(id){ return medTx('readwrite', st=>st.delete(id)); }

/* ═══════════ 3. Aufnehmen und Hochladen ═══════════ */

/* Ein Bild verkleinern. Gibt einen Blob zurück (kein base64 — der wäre ein
   Drittel größer und müsste für den Upload wieder zerlegt werden). */
function medVerkleinern(datei){
  return new Promise((ok, nein)=>{
    const leser = new FileReader();
    leser.onerror = ()=>nein(new Error('Datei nicht lesbar'));
    leser.onload = ()=>{
      const bild = new Image();
      bild.onerror = ()=>nein(new Error('Kein Bild'));
      bild.onload = ()=>{
        /* Bewegtbilder (GIF) NICHT durch die Leinwand schicken — dabei bliebe
           nur das erste Einzelbild übrig, und genau die Bildfolge war
           gewünscht. */
        if(datei.type==='image/gif'){ ok(datei); return; }
        const s = Math.min(1, MED_MAX_KANTE/Math.max(bild.width, bild.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(bild.width*s));
        c.height= Math.max(1, Math.round(bild.height*s));
        const g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(bild, 0, 0, c.width, c.height);
        c.toBlob(b=>{ b ? ok(b) : nein(new Error('Verkleinern fehlgeschlagen')); }, 'image/jpeg', MED_QUALITAET);
      };
      bild.src = leser.result;
    };
    leser.readAsDataURL(datei);
  });
}

/* Hochladen. Gibt die Kennung zurück — oder wirft, damit der Aufrufer das
   Bild in die Warteschlange legen kann. */
async function medHochladen(blob){
  const antwort = await fetch('/api/media', { method:'POST', headers:{'Content-Type':blob.type||'image/jpeg'}, body:blob });
  if(!antwort.ok){
    let t=''; try{ t=(await antwort.json()).error||''; }catch(e){}
    const f = new Error(t || ('HTTP '+antwort.status)); f.status = antwort.status; throw f;
  }
  const j = await antwort.json();
  return j.kennung;
}

/* Die Warteschlange abarbeiten. Wird beim Start, bei „wieder online" und nach
   jedem erfolgreichen Upload versucht. Gibt zurück, wie viele durchkamen. */
let medFlushLaeuft = false;
async function medWarteschlangeAbarbeiten(){
  if(medFlushLaeuft) return 0;
  medFlushLaeuft = true;
  let fertig = 0;
  try{
    const alle = await medWarteAlle();
    for(const satz of (alle||[])){
      try{
        const kennung = await medHochladen(satz.blob);
        medEintragen(satz.cid, kennung, satz.reichweite);
        await medWarteWeg(satz.id);
        fertig++;
      }catch(e){
        /* 4xx heißt: dieses Bild wird auch beim nächsten Versuch nicht
           angenommen (zu groß, falsche Art). Es aus der Schlange nehmen, sonst
           blockiert es alle nachfolgenden auf ewig. */
        if(e && e.status && e.status>=400 && e.status<500){ await medWarteWeg(satz.id); }
        else break;   /* offline → später weiter */
      }
    }
  }catch(e){}
  medFlushLaeuft = false;
  if(fertig && typeof reRenderDetail==='function') reRenderDetail();
  return fertig;
}

/* ═══════════ 4. Eintragen (über die Reichweiten-Treppe) ═══════════ */

/* Hängt eine Kennung an eine Zeile. reichweite: 'cid'|'std'|'grp'|'mat'.
   Der Weg ist bewusst derselbe wie bei Name und Menge — über sheetPending und
   applyPending, damit die Änderung im Journal steht und rücknehmbar ist. */
function medEintragen(cid, kennung, reichweite){
  if(!medIstKennung(kennung)) return false;
  const e = (typeof findEntry==='function') ? findEntry(cid) : null;
  if(!e) return false;
  const bisher = medVonEintrag(e, cid);
  if(bisher.indexOf(kennung)>=0) return true;
  const neu = bisher.concat([kennung]).slice(0, MED_MAX_PRO_ZEILE);
  return medSchreiben(cid, e, neu, reichweite);
}
function medEntfernen(cid, kennung, reichweite){
  const e = (typeof findEntry==='function') ? findEntry(cid) : null;
  if(!e) return false;
  const neu = medVonEintrag(e, cid).filter(k=>k!==kennung);
  return medSchreiben(cid, e, neu, reichweite);
}
function medVerschieben(cid, kennung, richtung, reichweite){
  const e = (typeof findEntry==='function') ? findEntry(cid) : null;
  if(!e) return false;
  const l = medVonEintrag(e, cid).slice();
  const i = l.indexOf(kennung); const j = i + (richtung<0?-1:1);
  if(i<0 || j<0 || j>=l.length) return false;
  const t=l[i]; l[i]=l[j]; l[j]=t;
  return medSchreiben(cid, e, l, reichweite);
}
/* Der eine Schreibweg. Ohne Reichweite (oder ohne Regel-Ziel) gilt „nur hier".

   applyPending() schließt das Menü, wenn es fertig ist — das ist beim
   Umbenennen richtig (man ist fertig), beim Bilderpflegen aber falsch: Wer
   drei Bilder sortiert, will nach jedem Schritt wieder die Bilderliste sehen.
   Deshalb merkt sich der Aufrufer die Kennung und öffnet das Menü danach an
   derselben Stelle wieder (medSheetZurueck). */
function medSchreiben(cid, e, liste, reichweite){
  const wert = liste.length ? liste : null;   /* leer = Eigenschaft entfällt */
  if(typeof applyPending==='function' && typeof sheetPending!=='undefined' && reichweite){
    sheetEntry = e; sheetCid = cid;
    sheetPending = { kind:'bilder', value:wert };
    applyPending(reichweite);
    return true;
  }
  if(typeof qeSet==='function'){ qeSet('cid', e, cid, 'bilder', wert); return true; }
  return false;
}

/* Zurück in die Bilderliste derselben Zeile. */
function medSheetZurueck(cid){
  if(!cid || typeof openSheet!=='function') return;
  openSheet(cid);
  renderSheetBilder();
}

/* ═══════════ 5. Anzeige ═══════════ */

/* Der Bilderstreifen unter einer Zeile. Klein, damit er die Liste nicht
   sprengt; antippen öffnet groß. */
function medStreifenHTML(e, cid){
  const l = medVonEintrag(e, cid);
  if(!l.length) return '';
  return `<div class="med-streifen">` + l.map(k=>
    `<button type="button" class="med-mini" data-k="${esc(k)}" data-c="${esc(cid)}" onclick="medGross(this.dataset.k,this.dataset.c)" aria-label="Bild ansehen">
      <img src="${esc(medUrl(k))}" alt="${esc(medText(k)||'Bild zum Eintrag')}" loading="lazy">
    </button>`).join('') + `</div>`;
}

/* Groß ansehen — über die vorhandene Lightbox, damit es sich anfühlt wie
   überall sonst in der App. */
function medGross(kennung, cid){
  const txt = medText(kennung);
  if(typeof openLightbox==='function') openLightbox(medUrl(kennung), txt);
  else { try{ window.open(medUrl(kennung),'_blank','noopener'); }catch(e){} }
}

/* ═══════════ 6. Bedienung im Schnellmenü ═══════════ */

/* Die Bildverwaltung EINER Zeile — als Seite des Bearbeiten-Menüs, wie
   „Farbe wählen" oder „Unterkategorie". */
function renderSheetBilder(){
  const e = sheetEntry, cid = sheetCid; if(!e) return;
  const l = medVonEintrag(e, cid);
  const warte = medWarteAnzahl;
  let h = `<div class="sheet-grip"></div><div class="sheet-title">Bilder</div>
    <div class="sheet-name">${esc((qeGet(e,cid,'name')!==undefined?qeGet(e,cid,'name'):e.anzeige_text)||'')}</div>`;
  h += `<div class="sheet-chips"><span class="schip">🖼 ${l.length} Bild${l.length===1?'':'er'}</span>${warte?`<span class="schip">⏳ ${warte} wartet auf Netz</span>`:''}</div>`;
  if(!l.length) h += `<p class="hint" style="padding:0 4px">Noch kein Bild. „Bild aufnehmen" öffnet die Kamera, „Bild wählen" die Galerie. Eine Bildfolge (GIF) bleibt bewegt.</p>`;
  h += `<div class="med-liste">`;
  l.forEach((k,i)=>{
    h += `<div class="med-zeile">
      <img src="${esc(medUrl(k))}" alt="" loading="lazy" onclick="medGross('${esc(k)}')">
      <input class="loc-input" value="${esc(medText(k))}" placeholder="Bildunterschrift (gilt überall)"
        data-k="${esc(k)}" onchange="medUiText(this.dataset.k,this.value)">
      <div class="med-akt">
        <button data-k="${esc(k)}" onclick="medUiVerschieben(this.dataset.k,-1)" aria-label="nach oben">⬆</button>
        <button data-k="${esc(k)}" onclick="medUiVerschieben(this.dataset.k,1)" aria-label="nach unten">⬇</button>
        <button class="dgr" data-k="${esc(k)}" onclick="medUiEntfernen(this.dataset.k)">Entfernen</button>
      </div></div>`;
  });
  h += `</div>`;
  h += `<div class="sheet-pick">
      <button class="sheet-pick-btn" onclick="medUiAufnehmen(true)">📷 Bild aufnehmen</button>
      <button class="sheet-pick-btn" onclick="medUiAufnehmen(false)">🖼 Bild wählen (auch GIF)</button>
    </div>
    <button class="sheet-close" onclick="renderSheetMain()">Zurück</button>`;
  $('sheet').innerHTML = h;
}

/* Wie viele Bilder gerade auf Netz warten (für die Anzeige). */
let medWarteAnzahl = 0;
function medWarteZaehlen(){
  medWarteAlle().then(a=>{ medWarteAnzahl = (a||[]).length; }).catch(()=>{ medWarteAnzahl = 0; });
}

/* Ein Bild aufnehmen oder wählen. `kamera` schaltet die Rückkamera direkt an —
   im Saal der Normalfall. */
function medUiAufnehmen(kamera){
  const cid = sheetCid;
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  if(kamera) inp.setAttribute('capture','environment');
  inp.onchange = async ()=>{
    const datei = inp.files && inp.files[0]; if(!datei) return;
    if(typeof toast==='function') toast('Bild wird vorbereitet …');
    let blob;
    try{ blob = await medVerkleinern(datei); }
    catch(err){ if(typeof toast==='function') toast('Das ist kein lesbares Bild',true); return; }
    medUiUebernehmen(cid, blob);
  };
  inp.click();
}

/* Nach dem Verkleinern: Reichweite fragen — genau wie bei jeder anderen
   Eigenschaft. Bei Zeilen ohne Regel-Ziel entfällt die Frage (nur hier). */
function medUiUebernehmen(cid, blob){
  const e = (typeof findEntry==='function') ? findEntry(cid) : null; if(!e) return;
  medNeu = { cid, blob };
  if(!e.material_key){ medUiSpeichern('cid'); return; }
  sheetEntry = e; sheetCid = cid;
  let h = `<div class="sheet-grip"></div><div class="sheet-title">Wo soll das Bild erscheinen?</div>`;
  h += `<div class="sheet-chips"><span class="schip">👥 gilt auf allen Geräten</span></div><div class="sheet-pick">`;
  h += `<button class="sheet-pick-btn" onclick="medUiSpeichern('cid')">📍 Nur hier <span class="ps-sub">· nur an dieser Stelle</span></button>`;
  const sid = (typeof cidStd==='function') ? cidStd(cid) : null;
  const grp = (sid && typeof stdGruppeById==='function') ? stdGruppeById(sid) : null;
  if(sid) h += `<button class="sheet-pick-btn" onclick="medUiSpeichern('std')">📄 In diesem Standard</button>`;
  if(grp) h += `<button class="sheet-pick-btn" onclick="medUiSpeichern('grp')">🗂 In der Gruppe „${esc(grp)}"</button>`;
  h += `<button class="sheet-pick-btn" onclick="medUiSpeichern('mat')">🌐 Überall, wo dieses Material steht</button>`;
  h += `</div><button class="sheet-close" onclick="renderSheetBilder()">Abbrechen</button>`;
  $('sheet').innerHTML = h;
}

let medNeu = null;   /* {cid, blob} — das gerade aufgenommene Bild */

async function medUiSpeichern(reichweite){
  const n = medNeu; medNeu = null;
  if(!n) return;
  try{
    const kennung = await medHochladen(n.blob);
    medEintragen(n.cid, kennung, reichweite);
    if(typeof toast==='function') toast('Bild hinzugefügt');
  }catch(err){
    /* Kein Netz → in die Warteschlange. Das Bild ist NICHT verloren, und das
       muss auch dastehen — sonst tippt jemand dreimal. */
    try{
      await medWarteAnlegen({ id:'m'+Date.now()+Math.random().toString(16).slice(2,8),
        cid:n.cid, blob:n.blob, reichweite: reichweite||'cid', seit:new Date().toISOString() });
      medWarteZaehlen();
      if(typeof toast==='function') toast('Kein Netz — das Bild geht hoch, sobald die Verbindung da ist');
    }catch(e2){
      if(typeof toast==='function') toast('Bild konnte nicht gespeichert werden',true);
    }
  }
  medSheetZurueck(n.cid);
  if(typeof reRenderDetail==='function') reRenderDetail();
}

function medUiEntfernen(kennung){
  const cid = sheetCid; if(!cid) return;
  medEntfernen(cid, kennung, 'cid');
  medSheetZurueck(cid);
  if(typeof toast==='function') toast('Bild von dieser Zeile entfernt');
}
function medUiVerschieben(kennung, richtung){
  const cid = sheetCid; if(!cid) return;
  if(!medVerschieben(cid, kennung, richtung, 'cid')) return;
  medSheetZurueck(cid);
}
function medUiText(kennung, text){
  medTextSetzen(kennung, text);
  if(typeof reRenderDetail==='function') reRenderDetail();
}

/* ═══════════ 7. Verwaltung: der Bestand ═══════════ */

let MEDBESTAND = null;
async function medBestandLaden(){
  try{
    const a = await fetch('/api/media');
    if(!a.ok) throw new Error('HTTP '+a.status);
    MEDBESTAND = await a.json();
  }catch(e){ MEDBESTAND = { fehler:true }; }
  if(typeof renderAdmin==='function' && $('scr-admin') && $('scr-admin').classList.contains('active')) renderAdmin();
}

function medienPanelHTML(){
  const b = MEDBESTAND;
  const badge = (b && !b.fehler) ? (b.anzahl+' Bilder · '+medMB(b.bytes)) : '';
  return `<details class="vpanel" data-keys="bilder foto fotos bildfolge gif medien speicher platz">
    ${vsum('🖼','Bilder','Bilder an Einträgen — Bestand, Platzbedarf und Aufräumen',badge)}
    <div class="vpanel-body">
    <p class="hint">Bilder liegen einzeln auf dem Server, nicht im geteilten Zustand. Deshalb bleibt die App auch mit tausenden Bildern so schnell wie heute — beim Bearbeiten wandert nur ein 32-Zeichen-Kürzel mit, nicht das Bild.</p>
    ${(b && !b.fehler)
      ? `<div class="frg-feld"><span>Bilder gespeichert</span><b>${b.anzahl}</b></div>
         <div class="frg-feld"><span>Platzbedarf</span><b>${medMB(b.bytes)}</b></div>`
      : `<p class="hint">${b&&b.fehler?'Der Bestand konnte nicht gelesen werden (kein Netz?).':'Noch nicht geladen.'}</p>`}
    <div class="p-actions"><button class="btn btn-sec" onclick="medBestandLaden()">Bestand aktualisieren</button>
      <button class="btn btn-sec" onclick="medWarteschlangeAbarbeiten().then(n=>toast(n?(n+' Bilder nachgereicht'):'Nichts wartet'))">Wartende Bilder nachreichen</button></div>
    <p class="hint">Ein aus einer Zeile entferntes Bild wird NICHT sofort gelöscht — dasselbe Bild kann an anderen Stellen hängen, und ein Foto ist teurer wiederzubeschaffen als aufzubewahren.</p>
    </div></details>`;
}
function medMB(n){ const m=(Number(n)||0)/1048576; return (m<0.1?Math.round((Number(n)||0)/1024)+' KB':m.toFixed(1)+' MB'); }

/* Beim Start: wartende Bilder zählen und, wenn Netz da ist, nachreichen. */
if(typeof window!=='undefined'){
  window.addEventListener('online', ()=>{ medWarteschlangeAbarbeiten(); });
  setTimeout(()=>{ medWarteZaehlen(); medWarteschlangeAbarbeiten(); }, 1500);
}
