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
    'Abbott Medical','Abbott','Medtronic','Biotronik','Biosense Webster','Johnson & Johnson',
    'Baylis Medical','Baylis','Masimo','Osypka','Vanguard','Irvine Biomedical',
    'Terumo','Cordis','Merit Medical','Merit','Cook Medical','Cook Incorporated','Cook',
    'B. Braun','B.Braun','Braun','Teleflex','Penumbra','Asahi','Nipro','Edwards',
    'Biosensors','MicroPort','Japan Lifeline','Lifetech','Cardinal Health','Cardinal',
    'Argon','Optimed','Balt','Andramed','Angiokard','pfm medical','pfm','Vygon',
    'Rontis','iVascular','Acandis','Gore','Bard','Bioptimal','Biomerics','Biosense',
    'Sterimed','Peter Surgical','Ethicon','Johnson','Natec','MedAlliance'];
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
  /* Durchmesser direkt am French: „6F 2.00 mm", „5F(1.7mm)", „8.5F 2.80 mm"
     bzw. „2.9 mm (8.6F)" — die mm-Angabe ist dann der (Außen-)Durchmesser.
     Nur ergänzen, wenn nicht schon über Ø/OD erkannt. */
  if(!out.dAussen){
    let dm = raw.match(/\d{1,2}(?:[.,]\d)?\s?F(?:r|rench)?\b[\s(]{0,3}(\d(?:[.,]\d+)?)\s?mm/i)
          || raw.match(/(\d(?:[.,]\d+)?)\s?mm\s*\(\s*\d{1,2}(?:[.,]\d)?\s?F/i);
    if(dm) out.dAussen=dm[1].replace('.', ',')+' mm';
  }
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
      if(/\b(REF|LOT|CHARGE|BATCH|SN|GTIN|EC\s?REP|STERILE?|LATEX|QTY|MD|UDI|CAT(?:ALOG)?|MODEL|P\/N|PN|REV)\b/i.test(ln)) continue;
      const letters=(ln.match(/[A-Za-zÄÖÜäöü]/g)||[]).length;
      /* Marken-™/® vor dem Vergleich entfernen — sonst rutscht „Bioptimal™"
         (= Hersteller mit ™) fälschlich als Produktname durch. */
      const cc=ln.replace(/[™®]/g,'').replace(/\s+/g,' ').trim();
      if(letters>=4 && cc.length>=5 && !/^[\d\s.,\-]+$/.test(cc)){
        if(best && cc.toUpperCase()===best.toUpperCase()) continue;
        nm=cc.replace(/[.,;:]+$/,''); break;
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
  if(/\bWITH\s+BALLOON\b/i.test(raw) || /\bMIT\s+BALLON/i.test(raw) || /\bBALLON(?:KATHETER)?\b/i.test(raw)) props.push('mit Ballon');
  if(/\bLATEX\b/i.test(raw) && !/\bLATEX[-\s]?FREE\b/i.test(raw) && !/\bLATEXFREI\b/i.test(raw)) props.push('Latex');
  if((pm=raw.match(/\b(\d(?:[-–]\d){1,3})\s?mm\b/))) props.push('Abstand '+pm[1].replace(/–/g,'-')+' mm');   /* 1-4-1 mm */
  /* Elektrodenabstand als Einzelwert („Electrode spacing (10mm)"). */
  if((pm=raw.match(/ELECTRODE\s+SPACING[^0-9]{0,8}(\d{1,2})\s?mm/i)) || (pm=raw.match(/ELEKTRODEN?[-\s]?ABSTAND[^0-9]{0,8}(\d{1,2})\s?mm/i))) props.push('Elektrodenabstand '+pm[1]+' mm');
  /* Führungsdraht-Kompatibilität in Zoll (z. B. .038″, .035″, .014″) — häufig
     die „MAX. GUIDEWIRE O.D.". Nur .0xx″ (echte Drahtstärken) — so wird ein
     Schleusen-Außenmaß wie .318″ NICHT fälschlich als Draht gelesen. */
  if((pm=raw.match(/(\.0\d{2})\s?["″”’'`]/))) props.push('Draht ' + pm[1].replace('.', '0,') + '″');
  /* Kurvenwinkel in Grad (z. B. 50°) bei steuerbaren/geformten Kathetern. */
  if((pm=raw.match(/\b(\d{2,3})\s?°/))) props.push(pm[1]+'° Kurve');
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
  const textMap={ scRef:'ref', scHersteller:'hersteller', scName:'name', scVerw:'verwendung' };
  const filled={};
  Object.keys(textMap).forEach(id=>{ const el=$(id); const val=f[textMap[id]];
    if(el && val && !el.value.trim()){ el.value=val; filled[textMap[id]]=val; el.classList.add('ocr-filled'); } });
  /* Maße gehen jetzt in die EINE Maßliste (#scSizes) als Zeilen — nicht mehr in
     feste Einzelfelder. Bestehende Werte werden nicht gedoppelt. */
  const sizeMap=[['french','french',''],['laenge','laenge',''],['dAussen','durchmesser','außen '],['dInnen','durchmesser','innen '],['weitere','dimension','']];
  const box=$('scSizes');
  if(box){ const existing=[...box.querySelectorAll('.merk-wert')].map(i=>(i.value||'').trim().toLowerCase());
    sizeMap.forEach(([key,typ,prefix])=>{ const val=f[key]; if(!val) return; const wert=prefix+val;
      if(existing.indexOf(wert.toLowerCase())>=0) return;
      if(typeof scanAddSize==='function'){ scanAddSize(); const rows=box.querySelectorAll('.merk-row'); const row=rows[rows.length-1];
        if(row){ row.querySelector('.merk-typ').value=typ; row.querySelector('.merk-wert').value=wert; row.querySelector('.merk-wert').classList.add('ocr-filled'); filled[key]=val; } } }); }
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
