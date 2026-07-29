/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — GEFÜHRTE ETIKETT-ERFASSUNG (zwei Fotos, ein Weg)

   Warum zwei Fotos? Weil Barcode und Klartext gegensätzliche Aufnahmen
   brauchen: Der Barcode will NAH und formatfüllend (sonst zu wenig Pixel je
   Modul), das Etikett will die GANZE Fläche (sonst fehlen Felder). Ein
   einziges Foto ist immer ein Kompromiss zulasten beider.

   Deshalb: ein geführter Dialog mit genau ZWEI Schritten —
     ① Barcode   → GTIN exakt aus dem Code (keine Texterkennung nötig);
                   daraus REF/Name/Hersteller über den eigenen Bestand, den
                   Referenz-Katalog und (falls nötig) AccessGUDID.
     ② Etikett   → alles, was NUR im Klartext steht: Maße, Kurventyp,
                   Verwendung, Produktname.
   Beides ist einzeln überspringbar, und wer nur EIN Foto machen will, nimmt
   „Ein Foto genügt" — dann läuft dieselbe Kette auf einer einzigen Aufnahme.

   Am Ende steht eine Übersicht mit Herkunftsangabe je Feld. Übernommen wird
   nur, was der Nutzer sieht und bestätigt — und nur in LEERE Formularfelder.
   ───────────────────────────────────────────────────────────── */

/* Zustand des laufenden Dialogs. */
let WIZ=null;

/* ===== Reine, testbare Helfer ===== */

/* Die Schritte des Dialogs — Titel und Erklärung an EINER Stelle. */
const WIZ_SCHRITTE = [
  { id:'barcode', titel:'Barcode fotografieren',
    hilfe:'Ganz nah an den Barcode oder den DataMatrix-Code (das kleine Quadrat). Der Code darf das Bild ruhig ausfüllen — daraus kommt die Produktnummer exakt, ganz ohne Texterkennung.' },
  { id:'etikett', titel:'Etikett fotografieren',
    hilfe:'Jetzt das ganze Etikett, möglichst gerade von oben und formatfüllend. Daraus werden REF, Hersteller, Maße und Eigenschaften gelesen.' },
  { id:'pruefen', titel:'Ergebnis prüfen',
    hilfe:'Alles noch einmal ansehen. Übernommen wird nur, was hier steht — und nur in leere Felder.' },
];
function wizSchritt(i){ return WIZ_SCHRITTE[i]||WIZ_SCHRITTE[WIZ_SCHRITTE.length-1]; }

/* Fortschritt für die Anzeige. Rein/testbar. */
function wizFortschritt(w){
  const i=(w&&w.schritt)||0;
  return { nr:Math.min(i+1, WIZ_SCHRITTE.length), gesamt:WIZ_SCHRITTE.length, id:wizSchritt(i).id };
}

/* Baut die Ergebnis-Übersicht als [Feld, Wert, Herkunft]-Tripel. Zeigt NUR
   gefundene Werte („leer schlägt falsch"). Rein/testbar. */
function wizZusammenfassung(w){
  if(!w) return [];
  const out=[];
  if(w.gtin) out.push(['GTIN', w.gtin, 'Barcode (exakt)']);
  const f=w.fields||{};
  const herkunftRef=w.barcodeRef ? 'Barcode (exakt)'
    : (w.gtinTreffer && w.gtinTreffer.ref && w.gtinTreffer.ref===f.ref) ? w.gtinTreffer.quelle
    : (w.refInfo && w.refInfo.wie && w.refInfo.wie!=='roh') ? ('Etikett · '+refWieLabel(w.refInfo.wie))
    : 'Etikett (gelesen)';
  if(f.ref) out.push(['REF / Bestellnr.', f.ref, herkunftRef]);
  const rest=[['hersteller','Hersteller'],['name','Produktname'],['verwendung','Verwendung'],
    ['french','French'],['laenge','Länge'],['dAussen','Ø außen'],['dInnen','Ø innen'],['weitere','Eigenschaften']];
  rest.forEach(([k,label])=>{
    if(!f[k]) return;
    const ausLookup=w.gtinTreffer && (w.gtinTreffer[k]===f[k]);
    out.push([label, f[k], ausLookup?w.gtinTreffer.quelle:'Etikett (gelesen)']);
  });
  return out;
}

/* Hat der Dialog überhaupt etwas gefunden? Rein/testbar. */
function wizHatErgebnis(w){ return wizZusammenfassung(w).length>0; }

/* ===== Dialog-Gerüst (DOM) ===== */
function wizEnsure(){
  let el=document.getElementById('ocrWiz');
  if(el) return el;
  el=document.createElement('div');
  el.id='ocrWiz'; el.className='wiz'; el.setAttribute('aria-hidden','true');
  el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true'); el.setAttribute('aria-label','Geführte Etikett-Erfassung');
  el.innerHTML='<div class="wiz-card"><div class="wiz-body" id="wizBody"></div></div>';
  document.body.appendChild(el);
  document.addEventListener('keydown',(ev)=>{ if(ev.key==='Escape' && el.classList.contains('show')) wizClose(); });
  return el;
}
function wizClose(){
  const el=document.getElementById('ocrWiz'); if(!el) return;
  el.classList.remove('show'); el.setAttribute('aria-hidden','true');
  if(WIZ && WIZ.lastFocus){ try{ WIZ.lastFocus.focus(); }catch(e){} }
  WIZ=null;
}

/* Startet den geführten Dialog. Wird aus dem Material-Editor aufgerufen. */
function ocrWizStart(){
  if(typeof ADMIN!=='undefined' && !ADMIN){ if(typeof promptLoginThen==='function'){ promptLoginThen(()=>ocrWizStart()); return; } }
  let fokus=null; try{ fokus=document.activeElement; }catch(e){}
  WIZ={ schritt:0, gtin:'', gtinTreffer:null, barcodeRef:'', fields:{}, refInfo:null,
        kandidaten:[], fotoBarcode:null, fotoEtikett:null, meldung:'', busy:false, lastFocus:fokus };
  const el=wizEnsure();
  el.classList.add('show'); el.setAttribute('aria-hidden','false');
  wizRender();
}

function wizRender(){
  const box=document.getElementById('wizBody'); if(!box||!WIZ) return;
  const s=wizSchritt(WIZ.schritt); const fp=wizFortschritt(WIZ);
  const punkte=WIZ_SCHRITTE.map((x,i)=>`<span class="wiz-dot${i===WIZ.schritt?' on':''}${i<WIZ.schritt?' done':''}"></span>`).join('');
  const kopf=`<div class="wiz-head">
      <div class="wiz-steps" aria-hidden="true">${punkte}</div>
      <div class="wiz-title">Schritt ${fp.nr} von ${fp.gesamt} · ${esc(s.titel)}</div>
      <button type="button" class="wiz-x" onclick="wizClose()" aria-label="Abbrechen">✕</button>
    </div>`;
  let inhalt='';
  if(WIZ.busy){
    inhalt=`<div class="wiz-busy"><div class="ocr-spin"></div><div class="wiz-busy-msg">${esc(WIZ.meldung||'Verarbeiten …')}</div></div>`;
  } else if(s.id==='barcode'){
    const treffer=WIZ.gtin?wizTrefferHTML():'';
    inhalt=`<p class="wiz-help">${esc(s.hilfe)}</p>
      ${WIZ.fotoBarcode?`<div class="wiz-shot"><img src="${esc(WIZ.fotoBarcode)}" alt="Aufnahme des Barcodes" data-zoom data-cap="Barcode-Aufnahme"></div>`:''}
      ${treffer}
      <div class="wiz-actions">
        <button type="button" class="btn btn-pri" onclick="wizShoot('barcode')">📷 ${WIZ.gtin?'Neu aufnehmen':'Barcode aufnehmen'}</button>
        <button type="button" class="btn btn-sec" onclick="wizNext()">${WIZ.gtin?'Weiter zum Etikett':'Überspringen'}</button>
      </div>
      <button type="button" class="wiz-link" onclick="wizShoot('beides')">Ein Foto genügt mir – Barcode und Etikett zusammen</button>`;
  } else if(s.id==='etikett'){
    inhalt=`<p class="wiz-help">${esc(s.hilfe)}</p>
      ${WIZ.fotoEtikett?`<div class="wiz-shot"><img src="${esc(WIZ.fotoEtikett)}" alt="Aufnahme des Etiketts" data-zoom data-cap="Etikett-Aufnahme"></div>`:''}
      ${WIZ.gtin?`<div class="wiz-ok">✓ GTIN ${esc(WIZ.gtin)} steht bereits fest.</div>`:''}
      <div class="wiz-actions">
        <button type="button" class="btn btn-pri" onclick="wizShoot('etikett')">📷 ${WIZ.fotoEtikett?'Neu aufnehmen':'Etikett aufnehmen'}</button>
        <button type="button" class="btn btn-sec" onclick="wizNext()">${WIZ.fotoEtikett?'Weiter':'Überspringen'}</button>
      </div>`;
  } else {
    inhalt=wizPruefenHTML();
  }
  box.innerHTML=kopf+inhalt;
}

/* Was der GTIN-Nachschlag ergeben hat (oder eben nicht). */
function wizTrefferHTML(){
  const t=WIZ.gtinTreffer;
  if(!t) return `<div class="wiz-ok">✓ GTIN <b>${esc(WIZ.gtin)}</b> gelesen.<div class="wiz-sub">Zu dieser Nummer ist noch nichts hinterlegt – das Etikett-Foto im nächsten Schritt liefert die Details.</div></div>`;
  const zeilen=[['REF',t.ref],['Produkt',t.name],['Hersteller',t.hersteller]].filter(x=>x[1])
    .map(x=>`<div class="info-field"><div class="if-l">${esc(x[0])}</div><div class="if-v">${esc(x[1])}</div></div>`).join('');
  const unbest=(t.herkunft==='accessgudid');
  return `<div class="wiz-ok">✓ GTIN <b>${esc(WIZ.gtin)}</b> gelesen und aufgelöst.
    ${unbest?'<span class="cat-badge-unb">unbestätigt</span>':''}
    ${zeilen}<div class="cat-src">Quelle: ${esc(t.quelle||'')}</div></div>`;
}

/* Ergebnisseite mit Herkunft je Feld + Auswahl bei mehrdeutiger REF. */
function wizPruefenHTML(){
  const zeilen=wizZusammenfassung(WIZ);
  const merkTeil=wizMerkHTML();
  if(!zeilen.length && !merkTeil){
    return `<div class="wiz-leer"><div class="ei">🔍</div><h3>Nichts sicher erkannt</h3>
      <p>Lieber leer als falsch. Bitte näher, gerader und bei besserem Licht fotografieren – oder die Felder von Hand ausfüllen.</p></div>
      <div class="wiz-actions"><button type="button" class="btn btn-sec" onclick="wizBack()">Zurück</button><button type="button" class="btn btn-pri" onclick="wizClose()">Schließen</button></div>`;
  }
  const rows=zeilen.map(z=>`<div class="wiz-row"><div class="wiz-l">${esc(z[0])}</div><div class="wiz-v">${esc(z[1])}</div><div class="wiz-q">${esc(z[2])}</div></div>`).join('');
  const mehrdeutig=(WIZ.refInfo && WIZ.refInfo.wie==='mehrdeutig' && WIZ.refInfo.kandidaten.length)
    ? `<div class="wiz-wahl"><div class="wiz-wahl-t">Mehrere passende REFs im Bestand – bitte auswählen:</div>
       ${WIZ.refInfo.kandidaten.map(k=>`<button type="button" class="wiz-chip" data-r="${esc(k)}" onclick="wizPickRef(this.dataset.r)">${esc(k)}</button>`).join('')}</div>`
    : '';
  const fotoAdd=(WIZ.fotoEtikett||WIZ.fotoBarcode)
    ? `<label class="wiz-check"><input type="checkbox" id="wizFotoAdd" checked> Aufnahmen als Materialfotos übernehmen</label>` : '';
  return `<div class="wiz-list">${rows}</div>${mehrdeutig}${merkTeil}${fotoAdd}
    <p class="wiz-note">Alle Werte sind Vorschläge. Übernommen wird nur in <b>leere</b> Felder – bereits Eingetragenes bleibt unangetastet.</p>
    <div class="wiz-actions">
      <button type="button" class="btn btn-sec" onclick="wizBack()">Zurück</button>
      <button type="button" class="btn btn-pri" onclick="wizApply()">Übernehmen</button>
    </div>`;
}


/* ═══ MERKMALE im Assistenten ═══════════════════════════════════
   Derselbe Etikettentext, zweite Auswertung: diesmal nach typisierten
   Eigenschaften (features/merkmale.js). Kostet keine zusätzliche Aufnahme —
   der Volltext liegt aus der Texterkennung schon vor. */

/* Auswertung (neu) anstoßen. Wird auch nach einer REF-Wahl erneut gerufen,
   weil die REF-Grammatik ein anderes Ergebnis liefern kann. */
function wizMerkAuswerten(){
  if(!WIZ) return;
  if(typeof merkSammeln!=='function' || typeof MERKKAT==='undefined'
     || !MERKKAT || !(MERKKAT.merkmale||[]).length){ WIZ.merk=null; return; }
  const erg = merkSammeln(WIZ.text||'', (WIZ.fields&&WIZ.fields.ref)||'', MERKKAT);
  /* Vom Menschen bereits getroffene Wahlen bei einer Neuauswertung behalten. */
  const gewaehlt = (WIZ.merk && WIZ.merk.gewaehlt) || {};
  Object.keys(gewaehlt).forEach(id=>{
    const drin = erg.merkmale.some(m=>m.id===id);
    if(!drin) erg.merkmale.push(gewaehlt[id]);
    erg.mehrdeutig = erg.mehrdeutig.filter(x=>x.id!==id);
  });
  erg.gewaehlt = gewaehlt;
  erg.verworfen = (WIZ.merk && WIZ.merk.verworfen) || {};
  erg.merkmale = erg.merkmale.filter(m=>!erg.verworfen[m.id]);
  /* Weggeklicktes bleibt weg — auch als Frage. Wer „weglassen" gedrückt hat,
     will nicht nach einer REF-Wahl dieselbe Frage erneut gestellt bekommen. */
  erg.mehrdeutig = erg.mehrdeutig.filter(x=>!erg.verworfen[x.id]);
  erg.merkmale.sort((a,b)=>(a.rang||99)-(b.rang||99));
  WIZ.merk = erg;
}

/* Mehrdeutiges Merkmal: der Mensch entscheidet (7 F Schaft oder 8 F Spitze?). */
function wizPickMerk(id, wert){
  if(!WIZ || !WIZ.merk) return;
  const def = (MERKKAT.merkmale||[]).filter(d=>d.id===id)[0];
  const m = { id:id, label:(def?def.label:id), kurz:(def&&def.kurz)||id,
              typ:(def?def.typ:'text'), einheit:(def&&def.einheit)||null,
              wert:wert, sicher:true, herkunft:'mensch',
              badge:!!(def&&def.badge), warnung:!!(def&&def.warnung), rang:(def&&def.rang)||99 };
  WIZ.merk.gewaehlt[id]=m;
  WIZ.merk.merkmale=WIZ.merk.merkmale.filter(x=>x.id!==id).concat([m]);
  WIZ.merk.merkmale.sort((a,b)=>(a.rang||99)-(b.rang||99));
  WIZ.merk.mehrdeutig=WIZ.merk.mehrdeutig.filter(x=>x.id!==id);
  wizRender();
}

/* Einzelnen Vorschlag verwerfen — wer ihn falsch findet, soll ihn wegklicken
   können, statt hinterher im Formular aufzuräumen. */
function wizDropMerk(id){
  if(!WIZ || !WIZ.merk) return;
  WIZ.merk.verworfen[id]=true;
  delete WIZ.merk.gewaehlt[id];
  WIZ.merk.merkmale=WIZ.merk.merkmale.filter(x=>x.id!==id);
  WIZ.merk.mehrdeutig=WIZ.merk.mehrdeutig.filter(x=>x.id!==id);
  wizRender();
}

/* Der Merkmalsteil der Prüfseite. */
function wizMerkHTML(){
  const w=WIZ&&WIZ.merk;
  if(!w) return '';
  const kl=(MERKKAT.klassen||[]).filter(k=>k.id===w.klasse)[0];
  const klZeile = (w.klasse && w.klasse!=='allgemein')
    ? `<div class="wiz-row"><div class="wiz-l">Materialklasse</div><div class="wiz-v">${esc(kl?kl.label:w.klasse)}</div><div class="wiz-q">${w.klasseSicher?'aus dem Etikett':'unsicher – bitte prüfen'}</div></div>`
    : `<div class="wiz-row"><div class="wiz-l">Materialklasse</div><div class="wiz-v">—</div><div class="wiz-q">nicht erkannt</div></div>`;
  const quelle = h => h==='anker' ? 'beschriftetes Feld' : h==='ref' ? 'aus der REF' : h==='mensch' ? 'von Ihnen gewählt' : 'Etikett (gelesen)';
  const rows = (w.merkmale||[]).map(m=>{
    const v = esc(String(m.wert)+(m.einheit?(' '+m.einheit):''));
    const q = quelle(m.herkunft) + (m.bestaetigt?' · bestätigt':'');
    return `<div class="wiz-row"><div class="wiz-l">${esc(m.label)}</div><div class="wiz-v"${m.warnung?' style="color:#d64545;font-weight:600"':''}>${v}</div>
      <div class="wiz-q">${esc(q)} <button type="button" class="wiz-drop" data-m="${esc(m.id)}" onclick="wizDropMerk(this.dataset.m)" aria-label="Vorschlag verwerfen">✕</button></div></div>`;
  }).join('');
  const wahl = (w.mehrdeutig||[]).map(u=>
    `<div class="wiz-wahl"><div class="wiz-wahl-t">${esc(u.label)}: Das Etikett nennt mehrere Werte – bitte auswählen:</div>
      ${Array.from(u.kandidaten||[]).map(k=>`<button type="button" class="wiz-chip" data-m="${esc(u.id)}" data-v="${esc(k)}" onclick="wizPickMerk(this.dataset.m,this.dataset.v)">${esc(String(k))}</button>`).join('')}
      <button type="button" class="wiz-chip wiz-chip-skip" data-m="${esc(u.id)}" onclick="wizDropMerk(this.dataset.m)">weglassen</button></div>`).join('');
  const luecken = (w.klasse && typeof merkLuecken==='function') ? merkLuecken(w.klasse, w.merkmale, MERKKAT) : [];
  const luHtml = luecken.length ? `<p class="wiz-note">Nicht auf dem Etikett gefunden: ${esc(luecken.map(l=>l.label).join(' · '))} – bitte von Hand ergänzen.</p>` : '';
  if(!rows && !wahl) return `<div class="wiz-merk-t">MERKMALE</div>${klZeile}<p class="wiz-note">Keine typisierten Merkmale erkannt.</p>`;
  return `<div class="wiz-merk-t">MERKMALE</div><div class="wiz-list">${klZeile}${rows}</div>${wahl}${luHtml}`;
}

/* ===== Ablauf ===== */
function wizBusy(on, msg){ if(!WIZ) return; WIZ.busy=!!on; WIZ.meldung=msg||''; wizRender(); }
function wizNext(){ if(!WIZ) return; WIZ.schritt=Math.min(WIZ.schritt+1, WIZ_SCHRITTE.length-1); wizRender(); }
function wizBack(){ if(!WIZ) return; WIZ.schritt=Math.max(0, WIZ.schritt-1); wizRender(); }

/* Öffnet die Kamera und verarbeitet das Bild je nach Schritt. */
function wizShoot(art){
  const inp=document.createElement('input');
  inp.type='file'; inp.accept='image/*'; inp.setAttribute('capture','environment'); inp.style.display='none';
  inp.onchange=()=>{ const f=inp.files&&inp.files[0];
    try{ document.body.removeChild(inp); }catch(e){}
    if(!f) return;
    const r=new FileReader();
    r.onload=()=>{ if(art==='barcode') wizDoBarcode(r.result); else wizDoEtikett(r.result, art==='beides'); };
    r.readAsDataURL(f);
  };
  document.body.appendChild(inp); inp.click();
}

/* Schritt ①: Barcode lesen und die Nummer auflösen. */
async function wizDoBarcode(dataUrl){
  if(!WIZ) return;
  WIZ.fotoBarcode=dataUrl;
  wizBusy(true,'Barcode lesen …');
  let code=null;
  try{ code=await ocrBarcodeFromImage(dataUrl); }catch(e){}
  if(!code || !(code.gtin||code.itemRef)){
    WIZ.busy=false;
    WIZ.gtin=''; WIZ.gtinTreffer=null;
    wizRender();
    toast('Kein Barcode erkannt. Näher heran, mehr Licht – oder diesen Schritt überspringen.', true);
    return;
  }
  WIZ.gtin=code.gtin?((typeof gtinKey==='function')?gtinKey(code.gtin):code.gtin):'';
  if(code.itemRef){ WIZ.barcodeRef=code.itemRef; WIZ.fields.ref=code.itemRef; }
  if(WIZ.gtin && typeof gtinAufloesen==='function'){
    wizBusy(true,'Nummer nachschlagen …');
    try{
      const t=await gtinAufloesen(WIZ.gtin);
      if(t){ WIZ.gtinTreffer=t;
        if(t.ref && !WIZ.fields.ref) WIZ.fields.ref=t.ref;
        if(t.name && !WIZ.fields.name) WIZ.fields.name=t.name;
        if(t.hersteller && !WIZ.fields.hersteller) WIZ.fields.hersteller=t.hersteller; }
    }catch(e){}
  }
  WIZ.busy=false; WIZ.schritt=1; wizRender();
}

/* Schritt ②: Etikett lesen. `auchBarcode` = das eine Foto soll beides leisten. */
async function wizDoEtikett(dataUrl, auchBarcode){
  if(!WIZ) return;
  WIZ.fotoEtikett=dataUrl;
  wizBusy(true,'Etikett lesen …');
  try{
    const erg=await ocrReadLabel(dataUrl, (t)=>{ if(WIZ){ WIZ.meldung=t; wizRender(); } });
    /* Felder zusammenführen: was schon feststeht (Barcode/Nachschlag) bleibt. */
    Object.keys(erg.fields||{}).forEach(k=>{ if(erg.fields[k] && !WIZ.fields[k]) WIZ.fields[k]=erg.fields[k]; });
    WIZ.refInfo=erg.refInfo||null; WIZ.kandidaten=erg.kandidaten||[];
    WIZ.rohRef=erg.refRoh||'';
    WIZ.confidence=erg.confidence; WIZ.schaerfe=erg.schaerfe;
    if(auchBarcode && erg.gtin && !WIZ.gtin){
      WIZ.gtin=erg.gtin; WIZ.fotoBarcode=WIZ.fotoBarcode||dataUrl;
      if(typeof gtinAufloesen==='function'){
        try{ const t=await gtinAufloesen(WIZ.gtin); if(t){ WIZ.gtinTreffer=t;
          if(t.ref && !WIZ.fields.ref) WIZ.fields.ref=t.ref; } }catch(e){}
      }
    }
    if(erg.barcode && erg.barcode.itemRef){ WIZ.barcodeRef=erg.barcode.itemRef; WIZ.fields.ref=erg.barcode.itemRef; }
    /* MERKMALE: Denselben Etikettentext noch einmal auswerten — diesmal nach
       typisierten Eigenschaften. Der Volltext liegt schon vor, das kostet
       nichts extra. Die aufgelöste REF geht mit ein, damit die REF-Grammatik
       greifen kann (LA6EBU40SH → 6 F · EBU 4.0 · Seitenlöcher). */
    WIZ.text=erg.text||'';
    wizMerkAuswerten();
  }catch(e){ toast('Etikett konnte nicht gelesen werden: '+((e&&e.message)||e), true); }
  WIZ.busy=false; WIZ.schritt=2; wizRender();
}

/* Mehrdeutige REF: der Nutzer entscheidet — und die App lernt daraus. */
function wizPickRef(ref){
  if(!WIZ) return;
  WIZ.fields.ref=ref;
  WIZ.refInfo={ ref, wie:'gewählt', sicher:true, kandidaten:[] };
  if(WIZ.rohRef && typeof refLearn==='function') refLearn(WIZ.rohRef, ref);
  wizMerkAuswerten();     /* andere REF → andere Grammatik → andere Merkmale */
  wizRender();
}

/* Übernahme ins Formular: füllt NUR leere Felder (ocrFillForm) und hängt die
   Aufnahmen optional an die Fotogalerie des Materials. */
function wizApply(){
  if(!WIZ) return;
  const fotosAn=(()=>{ const c=document.getElementById('wizFotoAdd'); return c?c.checked:false; })();
  const gi=(typeof $==='function')?$('scGtin'):document.getElementById('scGtin');
  if(gi && WIZ.gtin && !gi.value.trim()) gi.value=WIZ.gtin;
  const filled=(typeof ocrFillForm==='function')?ocrFillForm(WIZ.fields):{};
  /* Lernschleife vorbereiten: was die OCR roh gelesen hat, merken. */
  if(typeof ocrLastRead!=='undefined') ocrLastRead={ roh:WIZ.rohRef||'', wie:(WIZ.refInfo&&WIZ.refInfo.wie)||'roh', at:Date.now() };
  const bilder=[WIZ.fotoEtikett, WIZ.fotoBarcode].filter(Boolean);
  const merkVor=WIZ.merk;
  wizClose();
  if(typeof catCheckForm==='function') catCheckForm();
  if(fotosAn && bilder.length && typeof scanGalerieAddMany==='function') scanGalerieAddMany(bilder);
  /* Merkmale zuletzt: Der Klassenwechsel baut die Felder neu auf, deshalb
     erst nach ocrFillForm. */
  let merkInfo={ gefuellt:[], abweichend:[] };
  if(merkVor && typeof scanMerkUebernehmen==='function') merkInfo=scanMerkUebernehmen(merkVor);
  const n=Object.keys(filled).length, mn=merkInfo.gefuellt.length;
  const teile=[];
  if(n) teile.push(n+' Feld'+(n===1?'':'er'));
  if(mn) teile.push(mn+' Merkmal'+(mn===1?'':'e'));
  toast(teile.length?('Übernommen: '+teile.join(' und ')+' – bitte prüfen.'):'Nichts zu übernehmen (Felder bereits gefüllt).');
  /* Abweichungen NICHT stillschweigend auflösen: Was schon eingetragen war,
     bleibt stehen — der Unterschied wird aber benannt. */
  if(merkInfo.abweichend.length){
    const a=merkInfo.abweichend[0];
    setTimeout(()=>toast('Abweichung: '+a.label+' steht als „'+a.alt+'", das Etikett sagt „'+a.neu+'". Eingetragenes bleibt.'
      +(merkInfo.abweichend.length>1?(' (und '+(merkInfo.abweichend.length-1)+' weitere)'):''), true), 900);
  }
}
