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
  if(!zeilen.length){
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
  return `<div class="wiz-list">${rows}</div>${mehrdeutig}${fotoAdd}
    <p class="wiz-note">Alle Werte sind Vorschläge. Übernommen wird nur in <b>leere</b> Felder – bereits Eingetragenes bleibt unangetastet.</p>
    <div class="wiz-actions">
      <button type="button" class="btn btn-sec" onclick="wizBack()">Zurück</button>
      <button type="button" class="btn btn-pri" onclick="wizApply()">Übernehmen</button>
    </div>`;
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
  }catch(e){ toast('Etikett konnte nicht gelesen werden: '+((e&&e.message)||e), true); }
  WIZ.busy=false; WIZ.schritt=2; wizRender();
}

/* Mehrdeutige REF: der Nutzer entscheidet — und die App lernt daraus. */
function wizPickRef(ref){
  if(!WIZ) return;
  WIZ.fields.ref=ref;
  WIZ.refInfo={ ref, wie:'gewählt', sicher:true, kandidaten:[] };
  if(WIZ.rohRef && typeof refLearn==='function') refLearn(WIZ.rohRef, ref);
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
  wizClose();
  if(typeof catCheckForm==='function') catCheckForm();
  if(fotosAn && bilder.length && typeof scanGalerieAddMany==='function') scanGalerieAddMany(bilder);
  const n=Object.keys(filled).length;
  toast(n?('Übernommen: '+n+' Feld'+(n===1?'':'er')+' – bitte prüfen.'):'Nichts zu übernehmen (Felder bereits gefüllt).');
}
