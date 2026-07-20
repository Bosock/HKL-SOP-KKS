/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — ON-DEVICE-OCR (Etikett-Text lesen)
   Ergänzt den Barcode-Scanner (scanner.js): Der Barcode liefert die GTIN als
   Schlüssel; die OCR liest aus einem Etikett-FOTO so viele menschenlesbare
   Freitext-Felder wie möglich (REF, Hersteller, Produktname, Verwendung/
   Gerätetyp, Maße French/Länge/Ø sowie besondere Eigenschaften wie Kurventyp,
   Spitze, Elektroden) und füllt damit das Produktformular vor — der Nutzer
   bestätigt/korrigiert (OCR ist eine Hilfe, nie die letzte Wahrheit).

   Läuft VOLLSTÄNDIG auf dem Gerät: Tesseract.js (WASM) wird selbst gehostet
   unter /vendor/tesseract/ — kein Cloud-Dienst, keine Fremd-Origin, offline
   nach dem ersten Laden. Die Engine wird ERST beim ersten OCR-Aufruf geladen
   (kein Start-Overhead). CSP: `wasm-unsafe-eval` erlaubt nur die WASM-
   Kompilierung (siehe server/config.js).
   ───────────────────────────────────────────────────────────── */

/* ===== Reiner, testbarer Kern: Freitext-Felder aus OCR-Text gewinnen ===== */
/* Nimmt den rohen OCR-Text eines Etiketts und extrahiert Kandidaten für REF,
   LOT, Hersteller, Name, Verwendung (Gerätetyp), Maße (French/Länge/Ø) und
   besondere Eigenschaften (Kurve, Spitze, Elektroden). Rein & heuristisch —
   bewusst konservativ (lieber Feld leer lassen als Falsches raten).
   Selbstenthaltend (alle Helfer lokal), damit die Unit-Tests die Funktion
   isoliert prüfen können. */
function extractLabelFields(text){
  const out={ ref:'', lot:'', hersteller:'', name:'', verwendung:'', french:'', laenge:'', dAussen:'', dInnen:'', weitere:'' };
  if(text==null) return out;
  const raw=String(text);
  const lines=raw.split(/\r?\n/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean);
  const reEsc=(s)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const titleCase=(s)=>String(s||'').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
  /* Bekannte Hersteller (Kardiologie/EP + allgemein). Längster Treffer gewinnt,
     damit „Boston Scientific" vor „Cook" sticht; wort-genau (kein Teilstring). */
  const BRANDS=['Boston Scientific','St. Jude Medical','St. Jude','St Jude',
    'Abbott','Medtronic','Biotronik','Biosense Webster','Johnson & Johnson',
    'Baylis Medical','Baylis','Masimo','Osypka','Vanguard','Irvine Biomedical',
    'Terumo','Cordis','Merit Medical','Merit','Cook Medical','Cook',
    'B. Braun','B.Braun','Braun','Teleflex','Penumbra','Asahi','Nipro','Edwards',
    'Biosensors','MicroPort','Japan Lifeline','Lifetech','Cardinal Health','Cardinal',
    'Argon','Optimed','Balt','Andramed','Angiokard','pfm medical','pfm','Vygon',
    'Rontis','iVascular','Acandis','Gore','Bard'];
  let m;

  /* REF: „REF", „REF OEM:", „REF Catalog No.", „Cat.-Nr." … — Rauschwörter
     (OEM / Catalog No.) zwischen Marke und Wert überspringen. */
  m = raw.match(/\bREF\b\s*(?:OEM\b\s*)?[:.]?\s*(?:CAT(?:ALOG)?\.?\s*(?:NO\.?)?\s*[:.]?\s*)?([A-Za-z0-9][A-Za-z0-9\-\/*.]{2,})/i)
   || raw.match(/\b(?:CAT(?:ALOG)?\.?\s*NO\.?|MODEL|ARTIKEL(?:-?\s*NR)?|ART\.?-?\s*NR|BESTELL(?:-?\s*NR)?)\b[:.\s]*([A-Za-z0-9][A-Za-z0-9\-\/*.]{2,})/i);
  if(m) out.ref=m[1].replace(/[.,]+$/,'');
  /* LOT / Charge (auch „LOT OEM:") */
  m = raw.match(/\b(?:LOT|CHARGE|BATCH)\b\s*(?:OEM\b\s*)?[:.]?\s*([A-Za-z0-9][A-Za-z0-9\-\/]{1,})/i);
  if(m) out.lot=m[1].replace(/[.,]+$/,'');

  /* Hersteller: bekannte Marken wort-genau, längster Treffer gewinnt … */
  let best='';
  BRANDS.forEach(b=>{ if(new RegExp('\\b'+reEsc(b)+'\\b','i').test(raw) && b.length>best.length) best=b; });
  if(best) out.hersteller=best;
  /* … sonst Fallback: Firmenname mit Rechtsform (GmbH/AG/Inc/…), aber KEINE
     EC-REP-/Vertriebs-/Koordinations-Zeile (das ist nicht der Hersteller). */
  if(!out.hersteller){
    for(const ln of lines){
      if(/\b(REP|AUTHORIZED|AUTORIS|COORDINATION|DISTRIBUT|IMPORT|VERTRIEB)\b/i.test(ln)) continue;
      const mm=ln.match(/^([A-Z0-9][A-Za-z0-9.&'\- ]{1,38}?\s(?:GmbH|AG|Inc\.?|Ltd\.?|LLC|BVBA|Corp(?:oration)?\.?|Company|Co\.|S\.A\.|S\.p\.A\.|N\.V\.|B\.V\.))\b/);
      if(mm){ out.hersteller=mm[1].replace(/\s+/g,' ').trim(); break; }
    }
  }

  /* French: Zahl + F/Fr/French (z. B. 6F, 6 Fr, 7.5 French, x8F) */
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

  /* Produktname: bevorzugt die Zeile mit ™/® (Markenname wie „Supreme™",
     „IntellaNav MiFi™ XP") — außer sie ist selbst der Hersteller; sonst erste
     „wortreiche" Zeile ohne Feld-Marker/reine Nummer. Wird VOR der Verwendung
     bestimmt, damit eine kombinierte „Name + Gerätetyp"-Zeile als Name zählt. */
  let nm='';
  for(const ln of lines){
    if(/[™®]/.test(ln)){ const c=ln.replace(/[™®]/g,'').replace(/\s+/g,' ').trim();
      if(c.length>=3 && !/\b(REF|LOT|GTIN|UDI|STERILE?)\b/i.test(c) && !(best && c.toUpperCase().indexOf(best.toUpperCase())>=0)){ nm=c; break; } }
  }
  if(!nm){
    for(const ln of lines){
      if(/\b(REF|LOT|CHARGE|BATCH|SN|GTIN|EC\s?REP|STERILE?|LATEX|QTY|MD|UDI|CAT(?:ALOG)?|MODEL)\b/i.test(ln)) continue;
      const letters=(ln.match(/[A-Za-zÄÖÜäöü]/g)||[]).length;
      if(letters>=4 && ln.length>=5 && !/^[\d\s.,\-]+$/.test(ln)){
        if(best && ln.toUpperCase()===best.toUpperCase()) continue;
        nm=ln.replace(/[.,;:]+$/,''); break;
      }
    }
  }
  out.name=nm;

  /* Verwendung / Gerätetyp: beschreibende Kategorie-Zeile (Katheter, Schleuse,
     Sensor, Kabel, Draht, Ablation …) — die knappste passende Zeile, die NICHT
     schon der Produktname ist. */
  const TYPE=/(katheter|catheter|cath[eé]ter|schleuse|sheath|introducer|dilatator|dilator|sensor|kabel|cable|f[üu]hrungsdraht|guidewire|draht|wire|ballon|balloon|stent|elektrode|electrode|ablations?|diagnostic|diagnostik|mapping|oximeter|adapter|kan[üu]le|cannula|nadel|needle|spritze|syringe|okklud|occlud)/i;
  for(const ln of lines){
    if(/\b(REF|LOT|GTIN|UDI|SN|EC\s?REP|STERILE?|CHARGE|BATCH)\b/i.test(ln)) continue;
    if(ln===out.name) continue;
    if(TYPE.test(ln) && ln.length<=52 && (ln.match(/[A-Za-zÄÖÜäöü]/g)||[]).length>=5){ out.verwendung=ln.replace(/[.,;:]+$/,''); break; }
  }

  /* Besondere Eigenschaften: Kurventyp, Spitzentyp, Elektroden-Muster/-Zahl,
     Pyrogenität. Mehrere per „ · " zusammengefasst. */
  const props=[]; let pm;
  if((pm=raw.match(/\b((?:EXTRA[- ]?LARGE|LARGE|MEDIUM|SMALL|STANDARD)\s+CURVE)\b/i))) props.push(titleCase(pm[1]));
  if(/\bF[-\s]?TYPE\b/i.test(raw)) props.push('F-Type');
  if(/\bJ[-\s]?TIP\b/i.test(raw) || /\bJ-?SPITZE\b/i.test(raw)) props.push('J-Tip');
  if(/\bNON[-\s]?PYROGEN/i.test(raw)) props.push('non-pyrogen');
  if(/\bSTEERABLE\b/i.test(raw) || /\bSTEUERBAR/i.test(raw) || /\bLENKBAR/i.test(raw)) props.push('steuerbar');
  if((pm=raw.match(/\b(\d(?:[-–]\d){1,3})\s?mm\b/))) props.push('Abstand '+pm[1].replace(/–/g,'-')+' mm');   /* 1-4-1 mm */
  if((pm=raw.match(/\b(\d{1,2})\s?p\b/))) props.push(pm[1]+'-polig');                                         /* 4p */
  if(props.length) out.weitere=props.join(' · ');

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
    /* pageseg 3 = automatische Segmentierung: liest ein GANZES Etikett mit
       Titel, mehreren Spalten und verstreuten Feldern (REF, Hersteller, Maße)
       zuverlässiger als der frühere Einzelblock-Modus 6. */
    try{ await worker.setParameters({ tessedit_pageseg_mode:'3', preserve_interword_spaces:'1' }); }catch(e){}
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
function ocrFieldLabel(k){ return ({ref:'REF',hersteller:'Hersteller',name:'Name',verwendung:'Verwendung',french:'French',laenge:'Länge',dAussen:'Ø außen',dInnen:'Ø innen',weitere:'Eigenschaften'})[k]||k; }
function ocrBusy(on, msg){
  const el=$('ocrBusy'); if(!el) return;
  el.classList.toggle('show', !!on); el.setAttribute('aria-hidden', on?'false':'true');
  const t=$('ocrBusyMsg'); if(t && msg!=null) t.textContent=msg;
}
/* Füllt NUR leere Formularfelder mit den OCR-Kandidaten (nichts wird
   überschrieben). Gibt die tatsächlich gefüllten Felder zurück. */
function ocrFillForm(f){
  const map={ scRef:'ref', scHersteller:'hersteller', scName:'name', scVerw:'verwendung', scFrench:'french', scLaenge:'laenge', scDAussen:'dAussen', scDInnen:'dInnen', scWeitere:'weitere' };
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
/* Für OCR auf ~2000 px längste Kante bringen: kleiner Text (REF, Maße) braucht
   mehr Auflösung als die 1280-px-Fotopflege — aber Handy-Rohbilder (4000 px+)
   kosten unnötig Zeit. Nur verkleinern, nie hochskalieren. */
function ocrPrescale(dataUrl, cb){ const MAX=2000; const img=new Image();
  img.onload=()=>{ try{
    let w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
    if(!w||!h){ cb(dataUrl); return; }
    if(Math.max(w,h)<=MAX){ cb(dataUrl); return; }
    const f=MAX/Math.max(w,h); w=Math.round(w*f); h=Math.round(h*f);
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    c.getContext('2d').drawImage(img,0,0,w,h);
    cb(c.toDataURL('image/jpeg',0.9));
  }catch(e){ cb(dataUrl); } };
  img.onerror=()=>cb(dataUrl); img.src=dataUrl; }
async function ocrProcess(dataUrl){
  ocrBusy(true, 'OCR startet …');
  try{
    /* auf OCR-freundliche Auflösung bringen (mehr Detail als die Fotopflege) */
    const img=await new Promise((res)=>{ ocrPrescale(dataUrl,res); });
    const text=await runLabelOCR(img,(m)=>{ const pct=(m.progress!=null)?Math.round(m.progress*100):null;
      ocrBusy(true, ocrStatusLabel(m.status)+(pct!=null?(' '+pct+' %'):' …')); });
    const fields=extractLabelFields(text);
    const filled=ocrFillForm(fields);
    ocrBusy(false);
    const got=Object.keys(filled);
    if(got.length){ toast('Erkannt: '+got.map(ocrFieldLabel).join(', ')+' – bitte prüfen.'); }
    else { toast('Kein Text sicher erkannt. Bitte näher/schärfer fotografieren oder manuell eingeben.', true); }
    /* Charge/LOT wird bewusst NICHT gemeldet: reine Identifikations- &
       Eigenschaftssammlung, keine Chargenverfolgung. */
  }catch(e){ ocrBusy(false); toast('OCR fehlgeschlagen: '+((e&&e.message)||e), true); }
}
