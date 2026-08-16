/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — PRODUKT ZUORDNEN (die Verknüpfung, sichtbar gemacht)

   Der Betreiber: „für mich ist die Verknüpfung in der App überhaupt nicht
   intuitiv und transparent möglich … die Funktionalität ist nicht so wie ich
   es brauche."

   Das war belegbar, und zwar an drei Stellen:

   ① DIE ZENTRALE KONNTE NICHT, WAS SIE VERSPRACH. Die Material-Zentrale nennt
      fünf Tätigkeiten — erfassen, pflegen, ZUORDNEN, ordnen, prüfen. Zuordnen
      war nicht dabei: `openMaterial()` öffnete den vorhandenen Stammsatz oder
      legte einen NEUEN an. Eine Zeile mit einem BEREITS VORHANDENEN Stammsatz
      zu verbinden ging dort nicht — auch dann nicht, wenn beide in derselben
      Liste untereinanderstanden (der auf Vorrat gescannte Stammsatz und die
      Zeile ohne Produkt). Man sah beide und kam nicht ran.

   ② DER EINZIGE ECHTE WEG WAR UNBEDIENBAR. Explizit verknüpfen und lösen ging
      nur in der Verwaltungskarte „Materialzusammenführung": ein Klappmenü je
      Material über ALLE Stammsätze, ohne Suche, ohne Foto, ohne REF, nur Name —
      und gedeckelt auf die ersten 300 Materialien. Am Handy ist das keine
      Bedienung mehr.

   ③ ES PASSIERTE STILL. Ein `onchange` schrieb sofort. Kein Prüfblatt, keine
      Rückmeldung, was das für die 46 Fundstellen bedeutet — obwohl die App bei
      jeder anderen weit reichenden Änderung ausdrücklich nachfragt.

   ── Was dieser Baustein tut ──
   EIN Blatt, das von überall gleich aussieht und aus drei Richtungen erreichbar
   ist: aus der Material-Zentrale, aus dem Standard heraus am Eintrag, und aus
   der Verwaltungskarte. Es beantwortet vier Fragen an einer Stelle:

       WAS IST JETZT?      der aktuelle Stand, mit Foto und REF — oder ehrlich
                           „noch kein Produkt zugeordnet"
       WAS PASST?          Vorschläge nach Namensähnlichkeit; gescannte
                           Stammsätze ohne Zeile stehen bewusst obenan, denn
                           genau die will man anhängen
       WAS GIBT ES SONST?  die Suche über alle Stammsätze — Name, REF, GTIN,
                           Hersteller — statt eines Klappmenüs
       WAS BEWIRKT DAS?    vor dem Schreiben, nicht danach: an wie vielen
                           Stellen die Zuordnung gilt und was sich dort ändert

   ── Zwei Entscheidungen, die den Ton setzen ──

   BESTÄTIGEN STATT SOFORT SCHREIBEN. Ein Tipp auf ein Produkt wählt es nur aus;
   geschrieben wird erst nach einer zweiten, ausdrücklichen Bestätigung, die die
   Wirkung benennt. Das ist dasselbe Versprechen wie beim Prüfblatt der
   Reichweite (features/reichweite.js) — eine Änderung, die hunderte Stellen
   trifft, darf nicht aus Versehen passieren.

   LÖSEN IST EIN KNOPF, KEIN LISTENEINTRAG. „— nicht verknüpft —" in einem
   Klappmenü ist kein Rückweg. Wer sich nicht traut zu verknüpfen, weil er nicht
   weiß, wie er wieder herauskommt, verknüpft gar nicht.

   ── Was hier NICHT passiert ──
   Nichts wird automatisch zugeordnet. Ein Tippfehler und eine echte Variante
   sehen gleich aus („Navitor 23"/„Navitor 25"), und nur ein Mensch kennt den
   Unterschied — dieselbe Begründung wie bei den Dubletten-Vorschlägen. Die
   Maschine sortiert, der Mensch entscheidet.
   ───────────────────────────────────────────────────────────── */

let zuKey      = null;   /* material_key, um den es gerade geht */
let zuName     = '';     /* Anzeigename der Zeile (für Vorschläge und Überschrift) */
let zuQ        = '';     /* Suchtext in der Produktliste */
let zuPending  = null;   /* Stammsatz-ID, deren Zuordnung auf Bestätigung wartet */
let zuLoesenAn = false;  /* Lösen wartet auf Bestätigung */
let zuZurueck  = null;   /* Funktion für „Zurück" (z. B. ins Eintrags-Menü) */
let zuNachher  = null;   /* Neuzeichnen des Bildschirms darunter */

/* ═══════════ 1. Lesen ═══════════ */

function zuStammListe(){
  if(typeof GTINDB!=='object' || !GTINDB) return [];
  return Object.keys(GTINDB).map(k=>GTINDB[k]).filter(Boolean);
}
function zuStammName(r){ return (r && (r.name || r.ref || r.gtin)) || ''; }
/* Zweite Zeile eines Produkts: was es unterscheidbar macht. */
function zuStammZeile2(r){
  if(!r) return '';
  return [r.hersteller, r.ref?('REF '+r.ref):null, r.french, r.laenge]
    .filter(Boolean).join(' · ');
}
/* Aktuell verknüpfte Stammsatz-ID eines material_key (über die Brücke, also
   inklusive Alt-Schreibweisen). */
function zuAktuelleId(key){
  return (typeof canonId==='function') ? canonId(key) : null;
}
/* An wie vielen Stellen im Bestand dieses Material vorkommt. */
function zuWirkung(key){
  if(typeof MAT_INDEX==='undefined' || !Array.isArray(MAT_INDEX)) return 0;
  const m=MAT_INDEX.find(x=>x.key===key);
  return (m && m.vorkommen) || 0;
}
/* Welche Stammsätze an KEINER Zeile hängen — die will man am ehesten anhängen. */
function zuVerwaiste(){
  if(typeof MATLINK!=='object' || !MATLINK) return new Set();
  const belegt=new Set(Object.values(MATLINK));
  return new Set(zuStammListe().map(r=>r.gtin).filter(g=>!belegt.has(g)));
}

/* Vorschläge: Stammsätze, die zu diesem Namen passen könnten.
   Rein genug zum Testen (nur Lesen), Reihenfolge: stärkste Ähnlichkeit zuerst.
   Ein verwaister Stammsatz bekommt einen kleinen Bonus — nicht weil er
   ähnlicher wäre, sondern weil er der wahrscheinlichere Kandidat ist: Er wurde
   gescannt und wartet seither darauf, einer Zeile zugeordnet zu werden. */
function zuVorschlaege(name, aktuelleId, grenze){
  const min=(grenze===undefined)?0.55:grenze;
  if(typeof matNormName!=='function' || typeof matAehnlich!=='function') return [];
  const norm=matNormName(name||'');
  if(!norm) return [];
  const waisen=zuVerwaiste();
  const aus=[];
  zuStammListe().forEach(r=>{
    if(!r || !r.gtin || r.gtin===aktuelleId) return;
    const naehe=matAehnlich(norm, matNormName(zuStammName(r)));
    const waise=waisen.has(r.gtin);
    if(naehe<min && !(waise && naehe>=0.35)) return;
    aus.push({ id:r.gtin, rec:r, naehe, waise,
      grund: waise ? 'gescannt, hängt noch an keiner Zeile' : 'ähnlicher Name' });
  });
  aus.sort((a,b)=> (b.naehe + (b.waise?0.08:0)) - (a.naehe + (a.waise?0.08:0)) );
  return aus.slice(0,6);
}

/* Freitextsuche über alle Stammsätze: Name, REF, GTIN, Hersteller. */
function zuSuchen(q, aktuelleId){
  q=(q||'').trim().toLowerCase();
  let list=zuStammListe().filter(r=>r && r.gtin && r.gtin!==aktuelleId);
  if(q){
    list=list.filter(r=>{
      const heu=[r.name,r.ref,r.gtin,r.hersteller,r.verwendung].filter(Boolean).join(' ').toLowerCase();
      return heu.indexOf(q)>=0;
    });
  }
  list.sort((a,b)=>zuStammName(a).localeCompare(zuStammName(b),'de'));
  return list;
}

/* ═══════════ 2. Öffnen ═══════════ */

/* key      material_key der Zeile
   opts     { name, zurueck, nachher } */
function zuOeffnen(key, opts){
  if(!key) return;
  if(typeof ADMIN!=='undefined' && !ADMIN){
    if(typeof promptLoginThen==='function'){ promptLoginThen(()=>zuOeffnen(key,opts)); return; }
  }
  opts=opts||{};
  zuKey=key;
  zuName=opts.name || (function(){
    if(typeof MAT_INDEX!=='undefined' && Array.isArray(MAT_INDEX)){
      const m=MAT_INDEX.find(x=>x.key===key); if(m) return m.name;
    }
    return key;
  })();
  zuQ=''; zuPending=null; zuLoesenAn=false;
  zuZurueck=opts.zurueck||null;
  zuNachher=opts.nachher||null;
  zuZeichnen();
  if(typeof showSheet==='function') showSheet(true);
}

/* ═══════════ 3. Zeichnen ═══════════ */

function zuKandidatHTML(r, naehe, grund){
  const foto=r.photo?`<img src="${esc(r.photo)}" alt="" style="width:34px;height:34px;object-fit:cover;border-radius:5px;flex:0 0 auto">`
                    :`<span style="width:34px;height:34px;border-radius:5px;background:var(--card2,rgba(127,127,127,.16));display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto">🏷️</span>`;
  const z2=zuStammZeile2(r);
  /* Die Prozentzahl steht nur da, wenn sie etwas behauptet. Bei einer Zeile,
     die noch der ungeteilte Word-Satz ist („11F Terumo Schleuse [Saal 1 …]"),
     liegt die Namensähnlichkeit naturgemäß niedrig — der Vorschlag lebt dann
     vom zweiten Grund („gescannt, hängt noch an keiner Zeile"). Eine große
     „35 %" daneben würde denselben Vorschlag entwerten, den sie erklärt. */
  const pct=(naehe!==undefined&&naehe!==null&&naehe>=0.6)?`<span class="ps-sub">${Math.round(naehe*100)} %</span>`:'';
  return `<button type="button" class="sheet-pick-btn" data-g="${esc(r.gtin)}" onclick="zuWaehlen(this.dataset.g)"
      style="display:flex;gap:10px;align-items:center;text-align:left">
      ${foto}
      <span style="flex:1;min-width:0">
        <span style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(zuStammName(r))}</span>
        ${z2?`<span class="ps-sub" style="display:block">${esc(z2)}</span>`:''}
        ${grund?`<span class="ps-sub" style="display:block">${esc(grund)}</span>`:''}
      </span>${pct}</button>`;
}

function zuListeHTML(){
  const akt=zuAktuelleId(zuKey);
  const treffer=zuSuchen(zuQ, akt);
  if(!treffer.length) return `<p class="hint">Kein Produkt gefunden. Über „Neues Produkt aus dieser Zeile" legst du eines an.</p>`;
  const zeig=treffer.slice(0,40);
  let h=`<div class="sheet-pick">`+zeig.map(r=>zuKandidatHTML(r)).join('')+`</div>`;
  if(treffer.length>zeig.length) h+=`<div class="foot">${zeig.length} von ${treffer.length} — tippe weiter, um einzugrenzen.</div>`;
  return h;
}

function zuZeichnen(){
  const sheet=(typeof $==='function')?$('sheet'):null; if(!sheet) return;
  const akt=zuAktuelleId(zuKey);
  const aktRec=(akt && typeof GTINDB==='object' && GTINDB)?GTINDB[akt]:null;
  const n=zuWirkung(zuKey);
  const stellen=n===1?'1 Stelle':n+' Stellen';

  let h=`<div class="sheet-grip"></div>
    <div class="sheet-title">Produkt zuordnen</div>
    <div class="sheet-name">${esc(zuName)}</div>`;
  if(typeof sChips==='function') h+=sChips(['🎯 gilt an '+esc(stellen), '🌐 überall']);

  /* ── Bestätigungsschritt: nichts wurde bisher geschrieben ── */
  if(zuPending){
    const r=(typeof GTINDB==='object'&&GTINDB)?GTINDB[zuPending]:null;
    h+=`<div class="form-grp"><div class="flabel">Bitte bestätigen</div>
      <p class="why-help">„${esc(zuName)}" wird dem Produkt <b>${esc(zuStammName(r))}</b> zugeordnet.
      Das gilt für <b>${esc(stellen)}</b> im Bestand: Foto, Maße, Preis und Lagerort des Produkts
      erscheinen dort ab sofort. <b>Der Text der Zeilen ändert sich nicht</b> — und die Zuordnung
      lässt sich jederzeit wieder lösen.</p>
      <div class="p-actions">
        <button class="btn btn-pri" onclick="zuBestaetigen()">Ja, zuordnen</button>
        <button class="btn btn-sec" onclick="zuAbbrechen()">Abbrechen</button>
      </div></div>
      <button class="sheet-close" onclick="zuAbbrechen()">Zurück</button>`;
    sheet.innerHTML=h; return;
  }
  if(zuLoesenAn){
    h+=`<div class="form-grp"><div class="flabel">Verknüpfung lösen?</div>
      <p class="why-help">Die Verbindung zu <b>${esc(zuStammName(aktRec))}</b> wird entfernt.
      Das Produkt bleibt erhalten, die ${esc(stellen)} im Bestand bleiben ebenfalls —
      nur Foto, Maße und Preis erscheinen dort nicht mehr.</p>
      <div class="p-actions">
        <button class="btn btn-pri" onclick="zuLoesenBestaetigen()">Ja, lösen</button>
        <button class="btn btn-sec" onclick="zuAbbrechen()">Abbrechen</button>
      </div></div>
      <button class="sheet-close" onclick="zuAbbrechen()">Zurück</button>`;
    sheet.innerHTML=h; return;
  }

  /* ── Was ist jetzt? ── */
  h+=`<div class="flabel" style="margin-top:10px">Jetzt zugeordnet</div>`;
  if(aktRec){
    h+=`<div class="sheet-pick">${zuKandidatHTML(aktRec, null, 'aktuelle Zuordnung').replace('onclick="zuWaehlen(this.dataset.g)"','onclick="zuStammOeffnen(this.dataset.g)"')}</div>
      <div class="sheet-pick"><button type="button" class="sheet-pick-btn" onclick="zuLoesenFragen()">↩ Zuordnung aufheben <span class="ps-sub">· Zeile und Produkt bleiben erhalten</span></button></div>`;
  } else {
    h+=`<p class="hint">Noch kein Produkt zugeordnet. Ohne Zuordnung erreichen Foto, Maße, Preis
      und Lagerort diese ${esc(stellen)} nicht.</p>`;
  }

  /* ── Was passt? ── */
  const vor=zuVorschlaege(zuName, akt);
  if(vor.length){
    h+=`<div class="flabel" style="margin-top:14px">Vorschläge (${vor.length})</div>
      <p class="why-help">Nach Ähnlichkeit sortiert. Nichts davon ist automatisch zugeordnet —
      ein Tippfehler und eine echte Variante sehen gleich aus.</p>
      <div class="sheet-pick">`+vor.map(v=>zuKandidatHTML(v.rec, v.naehe, v.grund)).join('')+`</div>`;
  }

  /* ── Was gibt es sonst? ── */
  h+=`<div class="flabel" style="margin-top:14px">Alle Produkte</div>
    <div class="std-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      <input type="search" id="zuSuchfeld" placeholder="Name, REF, GTIN, Hersteller …" value="${esc(zuQ)}" oninput="zuSuchEingabe(this.value)" autocomplete="off"></div>
    <div id="zuListe">${zuListeHTML()}</div>`;

  h+=`<div class="sheet-pick" style="margin-top:12px">
      <button type="button" class="sheet-pick-btn" onclick="zuNeuAnlegen()">＋ Neues Produkt aus dieser Zeile <span class="ps-sub">· Name wird übernommen</span></button>
      <button type="button" class="sheet-pick-btn" onclick="zuScannen()">📷 Etikett scannen und zuordnen</button>
    </div>`;

  h+=`<button class="sheet-close" onclick="zuSchliessen()">${zuZurueck?'Zurück':'Schließen'}</button>`;
  sheet.innerHTML=h;
}

/* Nur die Trefferliste neu zeichnen — sonst verliert das Suchfeld den Fokus
   und die Tastatur klappt bei jedem Zeichen zu (auf dem Handy unbenutzbar). */
function zuSuchEingabe(v){
  zuQ=v||'';
  const box=(typeof $==='function')?$('zuListe'):null;
  if(box) box.innerHTML=zuListeHTML();
}

/* ═══════════ 4. Handeln ═══════════ */

function zuWaehlen(id){ if(!id) return; zuPending=id; zuLoesenAn=false; zuZeichnen(); }
function zuAbbrechen(){ zuPending=null; zuLoesenAn=false; zuZeichnen(); }
function zuLoesenFragen(){ zuLoesenAn=true; zuPending=null; zuZeichnen(); }

/* Gemeinsamer Abschluss jeder Änderung: Zwischenspeicher leeren, Index neu
   bauen, den Bildschirm darunter auffrischen. Ohne das steht die alte Anzeige
   noch da und man glaubt, es habe nicht funktioniert. */
function zuAufgeraeumt(){
  if(typeof matKeyCacheLeeren==='function') matKeyCacheLeeren();
  if(typeof invalidateMatCaches==='function') invalidateMatCaches();
  if(typeof buildMaterialIndex==='function') buildMaterialIndex();
  if(typeof zuNachher==='function'){ try{ zuNachher(); }catch(e){} }
}

function zuBestaetigen(){
  const id=zuPending; if(!id || !zuKey) return;
  if(typeof matLinkTo==='function') matLinkTo(zuKey, id);
  zuPending=null;
  zuAufgeraeumt();
  const r=(typeof GTINDB==='object'&&GTINDB)?GTINDB[id]:null;
  if(typeof toast==='function') toast('Zugeordnet: '+zuStammName(r));
  zuSchliessen();
}

function zuLoesenBestaetigen(){
  if(!zuKey) return;
  /* Über die Brücke gelesen, aber gelöst wird der EIGENE Eintrag: matUnlink
     greift auf den rohen Schlüssel. Zeigt die Verknüpfung über eine
     Alt-Schreibweise, muss auch die weg — sonst ist sie nach dem Neuaufbau
     wieder da und das Lösen wirkte folgenlos. */
  if(typeof matUnlink==='function') matUnlink(zuKey);
  if(typeof matAltKeys==='function' && typeof matUnlink==='function'){
    try{ matAltKeys(zuKey).forEach(alt=>{ if(alt!==zuKey) matUnlink(alt); }); }catch(e){}
  }
  zuLoesenAn=false;
  zuAufgeraeumt();
  if(typeof toast==='function') toast('Verknüpfung gelöst');
  zuZeichnen();
}

/* Neues Produkt aus dieser Zeile: nutzt denselben Weg wie bisher
   (openMaterial → Entwurf, angelegt beim Speichern), damit es genau EINE
   Neuanlage gibt und nicht zwei, die auseinanderlaufen. */
function zuNeuAnlegen(){
  const k=zuKey, nm=zuName;
  zuSchliessenStumm();
  if(typeof openMaterial==='function') openMaterial(k, nm);
}

/* Etikett scannen: Der Scanner verknüpft beim Speichern mit dieser Zeile
   (scanPendingLinkKey) — derselbe Mechanismus wie aus der Zentrale heraus. */
function zuScannen(){
  const k=zuKey;
  zuSchliessenStumm();
  if(typeof scanPendingLinkKey!=='undefined') scanPendingLinkKey=k;
  if(typeof openScanHub==='function') openScanHub();
  else if(typeof startCam==='function') startCam();
}

function zuStammOeffnen(id){
  zuSchliessenStumm();
  if(typeof openScanItem==='function') openScanItem(id, true);
}

function zuSchliessenStumm(){
  const z=zuZurueck; zuKey=null; zuZurueck=null; zuNachher=null; zuPending=null; zuLoesenAn=false;
  if(typeof showSheet==='function') showSheet(false);
  return z;
}

function zuSchliessen(){
  const z=zuZurueck;
  zuKey=null; zuZurueck=null; zuNachher=null; zuPending=null; zuLoesenAn=false; zuQ='';
  if(typeof z==='function'){ z(); return; }
  if(typeof showSheet==='function') showSheet(false);
}

/* Einstieg aus dem Eintrags-Menü heraus (features/quickmenu.js). Der Rückweg
   führt ins Menü zurück, nicht ins Nichts. */
function zuAusEintrag(){
  const e=(typeof sheetEntry!=='undefined')?sheetEntry:null;
  const cid=(typeof sheetCid!=='undefined')?sheetCid:null;
  zuAusZeile(e, cid, ()=>{ if(typeof renderSheetMain==='function') renderSheetMain(); });
}

/* Einstieg vom Anhänger „🧬 kein Produkt" an der Zeile. Hier gibt es kein Menü,
   in das man zurückkehren könnte — also schließt das Blatt einfach. */
function zuAusCid(cid){
  const e=(typeof findEntry==='function')?findEntry(cid):null;
  zuAusZeile(e, cid, null);
}

function zuAusZeile(e, cid, zurueck){
  if(!e) return;
  const key=(typeof effMatKey==='function')?effMatKey(e,cid):e.material_key;
  if(!key){ if(typeof toast==='function') toast('Diese Zeile führt kein Material',true); return; }
  const dn=(typeof qeGet==='function')?qeGet(e,cid,'name'):undefined;
  zuOeffnen(key, {
    name:(dn!==undefined?dn:e.anzeige_text)||key,
    zurueck:zurueck,
    /* Die offene Rubrik steht im Navigationsweg — sie neu zu zeichnen ist der
       einzige Weg, die Foto- und Produktangaben an der Zeile aufzufrischen. */
    nachher:()=>{
      if(typeof openRubrik!=='function' || typeof nav==='undefined' || !Array.isArray(nav)) return;
      const r=nav.slice().reverse().find(x=>x && x.lvl==='rub');
      if(r && r.idx!=null) openRubrik(r.idx, true);
    },
  });
}
