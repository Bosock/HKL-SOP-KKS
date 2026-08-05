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

/* ── Darstellungsgröße ─────────────────────────────────────────
   Ein Bild trägt seine Größe nicht in sich: Dasselbe Foto ist an einer
   Materialzeile ein Symbol und in einer Anleitung eine ganze Seite. Die Größe
   gehört deshalb an die STELLE, an der das Bild hängt — und sie muss sich
   jederzeit ändern lassen, ohne das Bild neu aufzunehmen.

   Die Wörter dazu stehen nicht im Quelltext (Grundsatz ④): sie kommen aus
   data/bezeichnungen.json → Zweig `mediengroessen` und sind in der Verwaltung
   änderbar. Der Code kennt nur die Schlüssel. */
const MED_GROESSEN = ['klein','mittel','gross'];
const MED_GROESSE_VORGABE = 'klein';
const MED_GROESSE_RUECKFALL = { klein:'Klein — wie ein Symbol', mittel:'Mittel — halbe Breite', gross:'Groß — volle Breite' };
function medGroesseWort(g){
  const tab = (typeof bezWert==='function') ? (bezWert('mediengroessen','werte',null)||MED_GROESSE_RUECKFALL) : MED_GROESSE_RUECKFALL;
  return tab[g] || MED_GROESSE_RUECKFALL[g] || g;
}
function medGroesseGueltig(g){ return MED_GROESSEN.indexOf(g)>=0 ? g : MED_GROESSE_VORGABE; }

/* Die Bildliste einer Stelle als PAARE {k,g} — Kennung und Darstellungsgröße.
   Beide Schreibweisen werden gelesen: die alte flache Liste ['<kennung>', …]
   und die neue ['{k,g}', …]. Deshalb braucht es keinen Migrationslauf; eine
   alte Liste bekommt einfach die Vorgabegröße.
   „Leer schlägt falsch": Was nicht sicher eine Kennung ist, fliegt raus,
   statt als kaputtes Bild zu erscheinen. */
function medPaare(wert){
  if(!Array.isArray(wert)) return [];
  const out = [];
  wert.forEach(x=>{
    const k = String((x && x.k!==undefined) ? x.k : (x||''));
    if(!medIstKennung(k)) return;
    out.push({ k, g: medGroesseGueltig(x && x.g) });
  });
  return out.slice(0, MED_MAX_PRO_ZEILE);
}
/* Nur die Kennungen (für Vergleiche und Zählungen). */
function medListe(wert){ return medPaare(wert).map(p=>p.k); }

/* Die wirksamen Bilder einer Zeile (mit der ganzen Kaskade dahinter). */
function medVonEintrag(e, cid){
  if(typeof qeGet!=='function') return [];
  return medListe(qeGet(e, cid, 'bilder'));
}
function medPaareVonEintrag(e, cid){
  if(typeof qeGet!=='function') return [];
  return medPaare(qeGet(e, cid, 'bilder'));
}

/* ── Angaben zum Bild ──────────────────────────────────────────
   Sie liegen getrennt von den Stellen: eine Kennung, eine Beschreibung,
   überall gleich. Sonst müsste man dieselbe Unterschrift an 23 Stellen
   pflegen.

   Der Wert darf ein Text sein (Altbestand: nur die Unterschrift) oder ein
   Satz {t,d} — Unterschrift und ausführliche Angaben. Gelesen wird beides. */
let MEDTXT = (typeof loadJSON==='function') ? loadJSON('hkl_medientexte', {}) : {};
function saveMedTxt(){ if(typeof saveJSON==='function') saveJSON('hkl_medientexte', MEDTXT); }
function medSatz(kennung){
  const v = MEDTXT && MEDTXT[kennung];
  if(!v) return { t:'', d:'' };
  if(typeof v==='string') return { t:v, d:'' };
  return { t:String(v.t||''), d:String(v.d||'') };
}
function medText(kennung){ return medSatz(kennung).t; }
function medDetail(kennung){ return medSatz(kennung).d; }
function medHatDetail(kennung){ const s=medSatz(kennung); return !!(s.t||s.d); }
function medTextSetzen(kennung, text){
  if(!medIstKennung(kennung)) return;
  const s = medSatz(kennung); s.t = String(text||'').trim();
  medSatzSchreiben(kennung, s);
}
function medDetailSetzen(kennung, text){
  if(!medIstKennung(kennung)) return;
  const s = medSatz(kennung); s.d = String(text||'').trim();
  medSatzSchreiben(kennung, s);
}
function medSatzSchreiben(kennung, s){
  if(!s.t && !s.d) delete MEDTXT[kennung];
  else if(!s.d) MEDTXT[kennung] = s.t;          /* schlanke Form, solange sie reicht */
  else MEDTXT[kennung] = { t:s.t, d:s.d };
  saveMedTxt();
}

/* ── Anker: Bilder an Stellen, die kein Eintrag sind ───────────
   Ein Bild soll überall hinkönnen — an den Kopf eines Standards, an eine
   Rubrik, an einen Abschnitt. Diese Stellen haben keinen Eintrag und damit
   keine Regel-Kaskade; sie SIND jeweils genau eine Stelle. Deshalb liegen
   ihre Bilder in einem eigenen, flachen Speicher, nach Ankerschlüssel:

     std:<sid>                Kopf eines Standards
     rub:<sid>|<ri>           eine Rubrik
     uk:<sid>|<ri>|<name>     ein Abschnitt (Material/Geräte)
     seg:<sid>|<ri>|<name>    ein Abschnitt (Ablauf)

   Der Anker ist absichtlich eine Zeichenkette: Kommt morgen eine weitere
   Stelle dazu, braucht es keinen neuen Speicher und keine neue Funktion. */
let MEDANK = (typeof loadJSON==='function') ? loadJSON('hkl_medienanker', {}) : {};
if(!MEDANK || typeof MEDANK!=='object') MEDANK = {};
function saveMedAnk(){ if(typeof saveJSON==='function') saveJSON('hkl_medienanker', MEDANK); }
function medAnkStd(sid){ return 'std:'+sid; }
function medAnkRub(sid, ri){ return 'rub:'+sid+'|'+ri; }
function medAnkUk(sid, ri, uk){ return 'uk:'+sid+'|'+ri+'|'+uk; }
function medAnkSeg(sid, ri, seg){ return 'seg:'+sid+'|'+ri+'|'+seg; }
function medAnkerPaare(anker){ return medPaare(MEDANK[anker]); }
function medAnkerSchreiben(anker, paare){
  if(!anker) return false;
  if(paare && paare.length) MEDANK[anker] = paare.map(p=>({k:p.k, g:p.g}));
  else delete MEDANK[anker];
  saveMedAnk(); return true;
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

/* Ein „Ort" ist entweder eine Zeile (cid) oder ein Anker. Beide werden gleich
   bedient — ein Menü, zwei Kontexte (Grundsatz ⑥). Ist `ort` ein Anker,
   entfällt die Reichweitenfrage: der Anker IST die Stelle. */
function medIstAnker(ort){ return typeof ort==='string' && /^(std|rub|uk|seg):/.test(ort); }
function medOrtPaare(ort){
  if(medIstAnker(ort)) return medAnkerPaare(ort);
  const e = (typeof findEntry==='function') ? findEntry(ort) : null;
  return e ? medPaareVonEintrag(e, ort) : [];
}
function medOrtSchreiben(ort, paare, reichweite){
  if(medIstAnker(ort)) return medAnkerSchreiben(ort, paare);
  const e = (typeof findEntry==='function') ? findEntry(ort) : null;
  if(!e) return false;
  return medSchreiben(ort, e, paare, reichweite);
}

/* Hängt eine Kennung an einen Ort. reichweite: 'cid'|'std'|'grp'|'mat'.
   Bei Zeilen ist der Weg bewusst derselbe wie bei Name und Menge — über
   sheetPending und applyPending, damit die Änderung im Journal steht und
   rücknehmbar ist. */
function medEintragen(ort, kennung, reichweite, groesse){
  if(!medIstKennung(kennung)) return false;
  const bisher = medOrtPaare(ort);
  if(bisher.some(p=>p.k===kennung)) return true;
  const neu = bisher.concat([{ k:kennung, g:medGroesseGueltig(groesse) }]).slice(0, MED_MAX_PRO_ZEILE);
  return medOrtSchreiben(ort, neu, reichweite);
}
function medEntfernen(ort, kennung, reichweite){
  return medOrtSchreiben(ort, medOrtPaare(ort).filter(p=>p.k!==kennung), reichweite);
}
function medVerschieben(ort, kennung, richtung, reichweite){
  const l = medOrtPaare(ort).slice();
  const i = l.findIndex(p=>p.k===kennung); const j = i + (richtung<0?-1:1);
  if(i<0 || j<0 || j>=l.length) return false;
  const t=l[i]; l[i]=l[j]; l[j]=t;
  return medOrtSchreiben(ort, l, reichweite);
}
/* Die Darstellungsgröße EINES Bildes an EINEM Ort ändern — jederzeit,
   nachträglich, ohne das Bild anzufassen. */
function medGroesseSetzen(ort, kennung, groesse, reichweite){
  const l = medOrtPaare(ort).map(p=> p.k===kennung ? { k:p.k, g:medGroesseGueltig(groesse) } : p);
  return medOrtSchreiben(ort, l, reichweite);
}
/* Der eine Schreibweg. Ohne Reichweite (oder ohne Regel-Ziel) gilt „nur hier".

   applyPending() schließt das Menü, wenn es fertig ist — das ist beim
   Umbenennen richtig (man ist fertig), beim Bilderpflegen aber falsch: Wer
   drei Bilder sortiert, will nach jedem Schritt wieder die Bilderliste sehen.
   Deshalb merkt sich der Aufrufer die Kennung und öffnet das Menü danach an
   derselben Stelle wieder (medSheetZurueck). */
function medSchreiben(cid, e, paare, reichweite){
  const wert = (paare && paare.length) ? paare.map(p=>({k:p.k, g:p.g})) : null;   /* leer = Eigenschaft entfällt */
  if(typeof applyPending==='function' && typeof sheetPending!=='undefined' && reichweite){
    sheetEntry = e; sheetCid = cid;
    sheetPending = { kind:'bilder', value:wert };
    applyPending(reichweite);
    return true;
  }
  if(typeof qeSet==='function'){ qeSet('cid', e, cid, 'bilder', wert); return true; }
  return false;
}

/* Zurück in die Bilderliste desselben Ortes. */
function medSheetZurueck(ort){
  if(!ort) return;
  if(medIstAnker(ort)){ medAnkerSheet(ort); return; }
  if(typeof openSheet!=='function') return;
  openSheet(ort);
  renderSheetBilder();
}

/* ═══════════ 5. Anzeige ═══════════ */

/* EIN Bild an EINER Stelle. Die Größe entscheidet über die Darstellung:
   „klein" reiht sich als Symbol in eine Zeile ein, „mittel" und „groß" stehen
   als eigener Block darunter — wie in einer Anleitung.

   Jedes Bild trägt data-zoom: der zentrale Klick-Melder (features/lightbox.js)
   öffnet es groß samt Angaben. Damit gilt an JEDER Stelle in der App dieselbe
   Regel — antippen macht groß. Kein eigener onclick, kein zweites Verhalten. */
function medBildHTML(p){
  const s = medSatz(p.k);
  const alt = s.t || 'Bild';
  const cap = s.t ? `<div class="med-cap">${esc(s.t)}</div>` : '';
  const lupe = s.d ? `<span class="med-info" aria-hidden="true">ℹ</span>` : '';
  return `<figure class="med-bild med-${esc(p.g)}">
    <img src="${esc(medUrl(p.k))}" alt="${esc(alt)}" loading="lazy" decoding="async"
      data-zoom data-cap="${esc(s.t)}" data-det="${esc(s.d)}">${lupe}${cap}</figure>`;
}

/* Alle Bilder einer Stelle: erst die kleinen als Streifen, dann die großen als
   Blöcke. Die Trennung ist wichtig — sonst zerreißt ein großes Bild die Reihe
   der kleinen. */
function medPaareHTML(paare){
  if(!paare || !paare.length) return '';
  const klein = paare.filter(p=>p.g==='klein');
  const gross = paare.filter(p=>p.g!=='klein');
  let h = '';
  if(klein.length) h += `<div class="med-streifen">` + klein.map(medBildHTML).join('') + `</div>`;
  if(gross.length) h += `<div class="med-bloecke">` + gross.map(medBildHTML).join('') + `</div>`;
  return h;
}

/* Der Bilderstreifen unter einer Zeile. */
function medStreifenHTML(e, cid){ return medPaareHTML(medPaareVonEintrag(e, cid)); }

/* Die Bilder eines Ankers (Standardkopf, Rubrik, Abschnitt) — plus, im
   Verwaltungsmodus, der Weg zum Hinzufügen. Ohne Bild und ohne Verwaltung
   entsteht KEIN Markup: eine leere Fläche wäre eine stumme Aufforderung. */
function medAnkerHTML(anker, titel){
  const paare = medAnkerPaare(anker);
  const admin = (typeof ADMIN!=='undefined') && ADMIN;
  if(!paare.length && !admin) return '';
  const knopf = admin
    ? `<button type="button" class="med-plus" data-a="${esc(anker)}" data-t="${esc(titel||'')}"
         onclick="medAnkerSheet(this.dataset.a,this.dataset.t)">🖼 ${paare.length?('Bilder ('+paare.length+')'):'Bild hinzufügen'}</button>`
    : '';
  return `<div class="med-anker">${medPaareHTML(paare)}${knopf}</div>`;
}

/* Groß ansehen — über die vorhandene Lightbox, damit es sich anfühlt wie
   überall sonst in der App. */
function medGross(kennung){
  const s = medSatz(kennung);
  if(typeof openLightbox==='function') openLightbox(medUrl(kennung), s.t, s.d);
  else { try{ window.open(medUrl(kennung),'_blank','noopener'); }catch(e){} }
}

/* ═══════════ 6. Bedienung im Schnellmenü ═══════════ */

/* Der Ort, dessen Bilder gerade bearbeitet werden: eine cid oder ein Anker.
   Ein Zustand für beide Wege — sonst gäbe es zwei Bildverwaltungen, die
   auseinanderlaufen. */
let medOrt = null;
let medOrtTitel = '';

/* Die Bildverwaltung EINES Ortes — als Seite des Bearbeiten-Menüs, wie
   „Farbe wählen" oder „Unterkategorie". */
function medListeHTML(ort){
  const paare = medOrtPaare(ort);
  const warte = medWarteAnzahl;
  let h = `<div class="sheet-chips"><span class="schip">🖼 ${paare.length} Bild${paare.length===1?'':'er'}</span>${warte?`<span class="schip">⏳ ${warte} wartet auf Netz</span>`:''}</div>`;
  if(!paare.length) h += `<p class="hint" style="padding:0 4px">Noch kein Bild. „Bild aufnehmen" öffnet die Kamera, „Bild wählen" die Galerie. Eine Bildfolge (GIF) bleibt bewegt.</p>`;
  h += `<div class="med-liste">`;
  paare.forEach(p=>{
    const s = medSatz(p.k);
    const groessen = MED_GROESSEN.map(g=>
      `<button type="button" class="med-gr${g===p.g?' on':''}" data-k="${esc(p.k)}" data-g="${esc(g)}"
        onclick="medUiGroesse(this.dataset.k,this.dataset.g)">${esc(medGroesseWort(g))}</button>`).join('');
    h += `<div class="med-zeile">
      <img src="${esc(medUrl(p.k))}" alt="" loading="lazy" data-zoom data-cap="${esc(s.t)}" data-det="${esc(s.d)}">
      <div class="med-felder">
        <input class="loc-input" value="${esc(s.t)}" placeholder="Bildunterschrift (gilt überall)"
          data-k="${esc(p.k)}" onchange="medUiText(this.dataset.k,this.value)">
        <textarea class="loc-input med-det" rows="2" placeholder="Angaben zum Bild — erscheinen in der Großansicht"
          data-k="${esc(p.k)}" onchange="medUiDetail(this.dataset.k,this.value)">${esc(s.d)}</textarea>
        <div class="med-groessen" role="group" aria-label="Darstellungsgröße">${groessen}</div>
      </div>
      <div class="med-akt">
        <button data-k="${esc(p.k)}" onclick="medUiVerschieben(this.dataset.k,-1)" aria-label="nach oben">⬆</button>
        <button data-k="${esc(p.k)}" onclick="medUiVerschieben(this.dataset.k,1)" aria-label="nach unten">⬇</button>
        <button class="dgr" data-k="${esc(p.k)}" onclick="medUiEntfernen(this.dataset.k)">Entfernen</button>
      </div></div>`;
  });
  h += `</div>`;
  h += `<div class="sheet-pick">
      <button class="sheet-pick-btn" onclick="medUiAufnehmen(true)">📷 Bild aufnehmen</button>
      <button class="sheet-pick-btn" onclick="medUiAufnehmen(false)">🖼 Bild wählen (auch GIF)</button>
    </div>`;
  return h;
}

function renderSheetBilder(){
  const e = sheetEntry, cid = sheetCid; if(!e) return;
  medOrt = cid; medOrtTitel = '';
  const h = `<div class="sheet-grip"></div><div class="sheet-title">Bilder</div>
    <div class="sheet-name">${esc((qeGet(e,cid,'name')!==undefined?qeGet(e,cid,'name'):e.anzeige_text)||'')}</div>`
    + medListeHTML(cid)
    + `<button class="sheet-close" onclick="renderSheetMain()">Zurück</button>`;
  $('sheet').innerHTML = h;
}

/* Dieselbe Verwaltung für einen Anker — Standardkopf, Rubrik, Abschnitt. */
function medAnkerSheet(anker, titel){
  if(typeof ADMIN!=='undefined' && !ADMIN){ if(typeof promptLoginThen==='function'){ promptLoginThen(()=>medAnkerSheet(anker,titel)); return; } }
  medOrt = anker; medOrtTitel = titel || medOrtTitel || '';
  const h = `<div class="sheet-grip"></div><div class="sheet-title">Bilder</div>
    <div class="sheet-name">${esc(medOrtTitel)}</div>`
    + medListeHTML(anker)
    + `<button class="sheet-close" onclick="showSheet(false);reRenderDetail()">Fertig</button>`;
  $('sheet').innerHTML = h;
  if(typeof showSheet==='function') showSheet(true);
}

/* Wie viele Bilder gerade auf Netz warten (für die Anzeige). */
let medWarteAnzahl = 0;
function medWarteZaehlen(){
  medWarteAlle().then(a=>{ medWarteAnzahl = (a||[]).length; }).catch(()=>{ medWarteAnzahl = 0; });
}

/* Ein Bild aufnehmen oder wählen. `kamera` schaltet die Rückkamera direkt an —
   im Saal der Normalfall. */
function medUiAufnehmen(kamera){
  const ort = medOrt;
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  if(kamera) inp.setAttribute('capture','environment');
  inp.onchange = async ()=>{
    const datei = inp.files && inp.files[0]; if(!datei) return;
    if(typeof toast==='function') toast('Bild wird vorbereitet …');
    let blob;
    try{ blob = await medVerkleinern(datei); }
    catch(err){ if(typeof toast==='function') toast('Das ist kein lesbares Bild',true); return; }
    medUiUebernehmen(ort, blob);
  };
  inp.click();
}

/* Nach dem Verkleinern: Reichweite fragen — genau wie bei jeder anderen
   Eigenschaft. Ein Anker IST die Stelle, und eine Zeile ohne Regel-Ziel hat
   kein geteiltes Ziel: beide Male entfällt die Frage. */
function medUiUebernehmen(ort, blob){
  medNeu = { ort, blob };
  if(medIstAnker(ort)){ medUiSpeichern('cid'); return; }
  const e = (typeof findEntry==='function') ? findEntry(ort) : null; if(!e){ medNeu=null; return; }
  if(!e.material_key){ medUiSpeichern('cid'); return; }
  sheetEntry = e; sheetCid = ort;
  let h = `<div class="sheet-grip"></div><div class="sheet-title">Wo soll das Bild erscheinen?</div>`;
  h += `<div class="sheet-chips"><span class="schip">👥 gilt auf allen Geräten</span></div><div class="sheet-pick">`;
  h += `<button class="sheet-pick-btn" onclick="medUiSpeichern('cid')">📍 Nur hier <span class="ps-sub">· nur an dieser Stelle</span></button>`;
  const sid = (typeof cidStd==='function') ? cidStd(ort) : null;
  const grp = (sid && typeof stdGruppeById==='function') ? stdGruppeById(sid) : null;
  if(sid) h += `<button class="sheet-pick-btn" onclick="medUiSpeichern('std')">📄 In diesem Standard</button>`;
  if(grp) h += `<button class="sheet-pick-btn" onclick="medUiSpeichern('grp')">🗂 In der Gruppe „${esc(grp)}"</button>`;
  h += `<button class="sheet-pick-btn" onclick="medUiSpeichern('mat')">🌐 Überall, wo dieses Material steht</button>`;
  h += `</div><button class="sheet-close" onclick="renderSheetBilder()">Abbrechen</button>`;
  $('sheet').innerHTML = h;
}

let medNeu = null;   /* {ort, blob} — das gerade aufgenommene Bild */

async function medUiSpeichern(reichweite){
  const n = medNeu; medNeu = null;
  if(!n) return;
  try{
    const kennung = await medHochladen(n.blob);
    medEintragen(n.ort, kennung, reichweite, MED_GROESSE_VORGABE);
    if(typeof toast==='function') toast('Bild hinzugefügt');
  }catch(err){
    /* Kein Netz → in die Warteschlange. Das Bild ist NICHT verloren, und das
       muss auch dastehen — sonst tippt jemand dreimal. */
    try{
      await medWarteAnlegen({ id:'m'+Date.now()+Math.random().toString(16).slice(2,8),
        cid:n.ort, blob:n.blob, reichweite: reichweite||'cid', seit:new Date().toISOString() });
      medWarteZaehlen();
      if(typeof toast==='function') toast('Kein Netz — das Bild geht hoch, sobald die Verbindung da ist');
    }catch(e2){
      if(typeof toast==='function') toast('Bild konnte nicht gespeichert werden',true);
    }
  }
  medSheetZurueck(n.ort);
  if(typeof reRenderDetail==='function') reRenderDetail();
}

function medUiEntfernen(kennung){
  const ort = medOrt; if(!ort) return;
  medEntfernen(ort, kennung, 'cid');
  medSheetZurueck(ort);
  if(typeof toast==='function') toast('Bild von dieser Stelle entfernt');
}
function medUiVerschieben(kennung, richtung){
  const ort = medOrt; if(!ort) return;
  if(!medVerschieben(ort, kennung, richtung, 'cid')) return;
  medSheetZurueck(ort);
}
/* Größe ändern — nachträglich, jederzeit, ohne das Bild anzufassen. */
function medUiGroesse(kennung, groesse){
  const ort = medOrt; if(!ort) return;
  medGroesseSetzen(ort, kennung, groesse, 'cid');
  medSheetZurueck(ort);
  if(typeof reRenderDetail==='function') reRenderDetail();
}
function medUiText(kennung, text){
  medTextSetzen(kennung, text);
  if(typeof reRenderDetail==='function') reRenderDetail();
}
function medUiDetail(kennung, text){
  medDetailSetzen(kennung, text);
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
