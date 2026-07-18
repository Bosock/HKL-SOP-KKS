/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — ON-DEVICE-OCR (Etikett-Text lesen)
   Ergänzt den Barcode-Scanner (scanner.js): Der Barcode liefert die GTIN als
   Schlüssel; die OCR liest aus einem Etikett-FOTO die menschenlesbaren
   Freitext-Felder (REF, Hersteller, French/Länge/Ø) und füllt damit das
   Produktformular vor — der Nutzer bestätigt/korrigiert (OCR ist eine
   Hilfe, nie die letzte Wahrheit).

   Läuft VOLLSTÄNDIG auf dem Gerät: Tesseract.js (WASM) wird selbst gehostet
   unter /vendor/tesseract/ — kein Cloud-Dienst, keine Fremd-Origin, offline
   nach dem ersten Laden. Die Engine wird ERST beim ersten OCR-Aufruf geladen
   (kein Start-Overhead). CSP: `wasm-unsafe-eval` erlaubt nur die WASM-
   Kompilierung (siehe server/config.js).
   ───────────────────────────────────────────────────────────── */

/* ===== Reiner, testbarer Kern: Freitext-Felder aus OCR-Text gewinnen ===== */
/* Nimmt den rohen OCR-Text eines Etiketts und extrahiert Kandidaten für
   REF, LOT, Hersteller (bekannte Marken), Name und Maße. Rein & heuristisch —
   bewusst konservativ (lieber Feld leer lassen als Falsches raten). */
function extractLabelFields(text){
  const out={ ref:'', lot:'', hersteller:'', name:'', french:'', laenge:'', dAussen:'', dInnen:'' };
  if(text==null) return out;
  const raw=String(text);
  const lines=raw.split(/\r?\n/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean);
  const U=raw.toUpperCase();
  let m;

  /* REF / Bestell-/Katalognummer */
  m = raw.match(/\b(?:REF|CAT(?:\.?\s*NO)?|MODEL|ARTIKEL|ART\.?-?\s*NR|BESTELL(?:-?\s*NR)?)\b[:.\s]*([A-Za-z0-9][A-Za-z0-9\-\/*.]{2,})/i);
  if(m) out.ref=m[1].replace(/[.,]+$/,'');
  /* LOT / Charge */
  m = raw.match(/\b(?:LOT|CHARGE|BATCH)\b[:.\s]*([A-Za-z0-9][A-Za-z0-9\-\/]{1,})/i);
  if(m) out.lot=m[1].replace(/[.,]+$/,'');

  /* Hersteller: bekannte Marken (längster Treffer gewinnt, damit „Boston
     Scientific" vor „Cook" o. Ä. sticht) */
  const BRANDS=['Boston Scientific','Terumo','Cordis','Medtronic','Abbott','Biotronik',
    'Merit Medical','Merit','Cook Medical','Cook','B. Braun','B.Braun','Braun','Teleflex',
    'Penumbra','Asahi','Nipro','Edwards','Biosensors','MicroPort','St. Jude','St Jude',
    'Cardinal Health','Cardinal','Argon','Optimed','Balt','Andramed','Angiokard',
    'pfm medical','pfm','Vygon','Rontis','iVascular','Acandis','Gore','Bard'];
  let best='';
  BRANDS.forEach(b=>{ if(U.indexOf(b.toUpperCase())>=0 && b.length>best.length) best=b; });
  if(best) out.hersteller=best;

  /* French: Zahl + F/Fr/French (z. B. 6F, 6 Fr, 7.5 French) */
  m = raw.match(/(\d{1,2}(?:[.,]\d)?)\s?F(?:r|rench)?\b/i);
  if(m) out.french=m[1].replace(',', '.')+'F';
  /* Länge in cm */
  m = raw.match(/(\d{1,3}(?:[.,]\d+)?)\s?cm\b/i);
  if(m) out.laenge=m[1].replace('.', ',')+' cm';
  /* Außendurchmesser: Ø / OD / AD / außen + mm */
  m = raw.match(/(?:Ø|\bOD\b|\bA\.?D\.?|AUSSEN|AUßEN)\D{0,4}(\d{1,2}(?:[.,]\d+)?)\s?mm/i);
  if(m) out.dAussen=m[1].replace('.', ',')+' mm';
  /* Innendurchmesser: ID / innen + mm */
  m = raw.match(/(?:\bID\b|\bI\.?D\.?|INNEN)\D{0,4}(\d{1,2}(?:[.,]\d+)?)\s?mm/i);
  if(m) out.dInnen=m[1].replace('.', ',')+' mm';

  /* Produktname: erste „wortreiche" Zeile ohne Feld-Marker, keine reine Nummer,
     nicht der bloße Markenname */
  for(let i=0;i<lines.length;i++){ const ln=lines[i];
    if(/\b(REF|LOT|CHARGE|BATCH|SN|GTIN|EC\s?REP|STERILE?|LATEX|QTY|MD|UDI)\b/i.test(ln)) continue;
    const letters=(ln.match(/[A-Za-zÄÖÜäöü]/g)||[]).length;
    if(letters>=4 && ln.length>=5 && !/^[\d\s.,\-]+$/.test(ln)){
      if(best && ln.toUpperCase()===best.toUpperCase()) continue;
      out.name=ln; break;
    }
  }
  return out;
}

/* ===== Engine (lazy) ===== */
let _tessLoading=null;
function ensureTesseract(){
  if(typeof window!=='undefined' && window.Tesseract) return Promise.resolve(window.Tesseract);
  if(_tessLoading) return _tessLoading;
  _tessLoading=new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='/vendor/tesseract/tesseract.min.js';
    s.onload=()=>{ window.Tesseract?resolve(window.Tesseract):reject(new Error('Tesseract nicht verfügbar')); };
    s.onerror=()=>{ _tessLoading=null; reject(new Error('OCR-Engine konnte nicht geladen werden')); };
    document.head.appendChild(s);
  });
  return _tessLoading;
}
/* Führt OCR auf einem Bild (data-URL / Blob / Canvas) aus. Alle Pfade sind
   same-origin (offline-fähig, CSP-konform). onProgress bekommt die Tesseract-
   Statusmeldungen. */
async function runLabelOCR(image, onProgress){
  const T=await ensureTesseract();
  const worker=await T.createWorker('eng', 1, {
    workerPath:'/vendor/tesseract/worker.min.js',
    corePath:'/vendor/tesseract/tesseract-core-simd-lstm.js',
    langPath:'/vendor/tesseract/',
    workerBlobURL:false,
    logger:(msg)=>{ if(onProgress && msg && msg.status) onProgress(msg); },
  });
  try{
    try{ await worker.setParameters({ tessedit_pageseg_mode:'6', preserve_interword_spaces:'1' }); }catch(e){}
    const res=await worker.recognize(image);
    return (res && res.data && res.data.text) || '';
  } finally { try{ await worker.terminate(); }catch(e){} }
}

/* ===== UI-Anbindung ===== */
function ocrStatusLabel(s){
  return ({ 'loading tesseract core':'Engine laden','initializing tesseract':'Engine starten',
    'loading language traineddata':'Sprachdaten laden','initializing api':'Vorbereiten',
    'recognizing text':'Text erkennen' })[s] || 'Verarbeiten';
}
function ocrFieldLabel(k){ return ({ref:'REF',hersteller:'Hersteller',name:'Name',french:'French',laenge:'Länge',dAussen:'Ø außen',dInnen:'Ø innen'})[k]||k; }
function ocrBusy(on, msg){
  const el=$('ocrBusy'); if(!el) return;
  el.classList.toggle('show', !!on); el.setAttribute('aria-hidden', on?'false':'true');
  const t=$('ocrBusyMsg'); if(t && msg!=null) t.textContent=msg;
}
/* Füllt NUR leere Formularfelder mit den OCR-Kandidaten (nichts wird
   überschrieben). Gibt die tatsächlich gefüllten Felder zurück. */
function ocrFillForm(f){
  const map={ scRef:'ref', scHersteller:'hersteller', scName:'name', scFrench:'french', scLaenge:'laenge', scDAussen:'dAussen', scDInnen:'dInnen' };
  const filled={};
  Object.keys(map).forEach(id=>{ const el=$(id); const val=f[map[id]];
    if(el && val && !el.value.trim()){ el.value=val; filled[map[id]]=val; el.classList.add('ocr-filled'); } });
  return filled;
}
/* Öffnet die Kamera (natives Foto), liest das Etikett und füllt das Formular. */
function ocrCaptureAndFill(){
  if(!ADMIN){ promptLoginThen(()=>ocrCaptureAndFill()); return; }
  const inp=document.createElement('input');
  inp.type='file'; inp.accept='image/*'; inp.setAttribute('capture','environment'); inp.style.display='none';
  inp.onchange=()=>{ const f=inp.files&&inp.files[0];
    try{ document.body.removeChild(inp); }catch(e){}
    if(!f) return;
    const r=new FileReader(); r.onload=()=>ocrProcess(r.result); r.readAsDataURL(f);
  };
  document.body.appendChild(inp); inp.click();
}
async function ocrProcess(dataUrl){
  ocrBusy(true, 'OCR startet …');
  try{
    /* fürs Tempo vorverkleinern (shrinkPhoto stammt aus care.js) */
    const img=await new Promise((res)=>{ if(typeof shrinkPhoto==='function') shrinkPhoto(dataUrl,res); else res(dataUrl); });
    const text=await runLabelOCR(img,(m)=>{ const pct=(m.progress!=null)?Math.round(m.progress*100):null;
      ocrBusy(true, ocrStatusLabel(m.status)+(pct!=null?(' '+pct+' %'):' …')); });
    const fields=extractLabelFields(text);
    const filled=ocrFillForm(fields);
    ocrBusy(false);
    const got=Object.keys(filled);
    if(got.length){ toast('Erkannt: '+got.map(ocrFieldLabel).join(', ')+' – bitte prüfen.'); }
    else { toast('Kein Text sicher erkannt. Bitte näher/schärfer fotografieren oder manuell eingeben.', true); }
    if(fields.lot){ toast('Charge/LOT erkannt: '+fields.lot); }
  }catch(e){ ocrBusy(false); toast('OCR fehlgeschlagen: '+((e&&e.message)||e), true); }
}
