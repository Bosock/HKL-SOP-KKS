/* ─────────────────────────────────────────────────────────────
   NEUE APP — BARCODE LESEN (auf jedem Gerät)

   Der Barcode auf einem Medizinprodukt trägt die GTIN fehlerfrei — genau die
   Nummer, an der das EU-Register das Produkt erkennt. Deshalb ist „Barcode
   scannen" der erste Schritt der Material-Maske.

   Zwei Leser, eine Schnittstelle:
     · der eingebaute des Browsers (BarcodeDetector) — den hat im Wesentlichen
       nur Android-Chrome;
     · sonst zxing (public/vendor/zxing/, selbst gehostet, erst beim ersten
       Scan geladen) — damit geht es auch auf iPhone, iPad und am PC.

   Zwei Wege, ein Ergebnis:
     · LIVE: Kamera läuft, der Code wird erkannt, sobald er im Bild ist;
     · FOTO: ein Bild aufnehmen oder wählen (Rückfall, wenn die Kamera nicht
       freigegeben ist).
   Übernommen werden nur GTIN (01) und REF (240). Charge und Verfall stehen
   im Code, werden aber verworfen (Grundsatz A2, kern.js naParseGS1).
   ───────────────────────────────────────────────────────────── */
const NA_BC_NATIV = ['data_matrix','code_128','ean_13','ean_8','itf','qr_code','upc_a','upc_e'];
const NA_BC_ZXING = ['DataMatrix','Code128','EAN-13','EAN-8','ITF','QRCode','UPC-A','UPC-E','DataBar','DataBarExpanded'];
const NA_ZXING_PFAD = '/vendor/zxing/';

let naZxingLaedt = null;
function naZxing(){
  if(window.ZXingWASM && window.ZXingWASM.__bereit) return Promise.resolve(window.ZXingWASM);
  if(!naZxingLaedt) naZxingLaedt = new Promise((res, rej)=>{
    const s = document.createElement('script'); s.src = NA_ZXING_PFAD+'zxing-reader.js';
    s.onload = ()=>{ try{
      /* Die WASM-Datei liegt neben dem Skript — nie von einem fremden Server. */
      window.ZXingWASM.prepareZXingModule({ overrides:{ locateFile:(pfad, vor)=>(/\.wasm$/.test(pfad) ? NA_ZXING_PFAD+pfad : vor+pfad) } });
      window.ZXingWASM.__bereit = true; res(window.ZXingWASM);
    }catch(e){ naZxingLaedt = null; rej(e); } };
    s.onerror = ()=>{ naZxingLaedt = null; rej(new Error('Barcode-Leser konnte nicht geladen werden')); };
    document.head.appendChild(s);
  });
  return naZxingLaedt;
}
let naBcNativ = undefined;   /* undefined = noch nicht geprüft, null = gibt es nicht */
async function naBarcodeNativ(){
  if(naBcNativ!==undefined) return naBcNativ;
  naBcNativ = null;
  try{
    if('BarcodeDetector' in window){
      const kann = await window.BarcodeDetector.getSupportedFormats();
      const f = NA_BC_NATIV.filter(x=>kann.indexOf(x)>=0);
      /* Ohne DataMatrix nützt der eingebaute Leser hier nichts: Die meisten
         Etiketten tragen genau den. */
      if(f.indexOf('data_matrix')>=0 && f.indexOf('code_128')>=0) naBcNativ = new window.BarcodeDetector({ formats:f });
    }
  }catch(e){ naBcNativ = null; }
  return naBcNativ;
}

/* Rohtexte aus einer Bildfläche (Canvas). Liefert [] wenn nichts erkannt. */
async function naBarcodeRoh(canvas){
  const nativ = await naBarcodeNativ();
  if(nativ){ try{ const c = await nativ.detect(canvas); if(c && c.length) return c.map(x=>x.rawValue||'').filter(Boolean); }catch(e){ /* weiter mit zxing */ } }
  const Z = await naZxing();
  const daten = canvas.getContext('2d', { willReadFrequently:true }).getImageData(0, 0, canvas.width, canvas.height);
  const r = await Z.readBarcodes(daten, { formats:NA_BC_ZXING, tryHarder:true, tryRotate:true, tryInvert:false, tryDownscale:true, maxNumberOfSymbols:4 });
  return (r||[]).filter(x=>x && x.text && x.isValid!==false).map(x=>x.text);
}
/* Aus Rohtexten das Brauchbare: eine GTIN mit stimmender Prüfziffer gewinnt. */
function naBarcodeDeuten(texte){
  let erst = null;
  for(const t of (texte||[])){
    const s = naParseScan(t);
    if((s.kind==='gs1' || s.kind==='gtin') && naGtinPruefziffer(s.gtin)) return { gtin:s.gtin, itemRef:s.itemRef||'', roh:t };
    if(!erst) erst = { gtin:'', itemRef:'', roh:t };
  }
  return erst;
}
function naBildAufCanvas(bild, kante, faktor){
  const w = bild.naturalWidth || bild.videoWidth || bild.width, h = bild.naturalHeight || bild.videoHeight || bild.height;
  let f = (faktor||1); if(kante) f = Math.min(f, kante/Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w*f)); c.height = Math.max(1, Math.round(h*f));
  const x = c.getContext('2d', { willReadFrequently:true }); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(bild, 0, 0, c.width, c.height);
  return c;
}
/* Barcode aus einem FOTO (data-URL oder Bildadresse). Erst in Originalgröße
   (höchstens 2400 px), dann vergrößert — ein kleiner Strichcode am Rand eines
   Fotos braucht die zweite Runde. Liefert { gtin, itemRef, roh } oder null. */
async function naBarcodeAusBild(quelle){
  const bild = await new Promise((res, rej)=>{ const i = new Image(); i.onload = ()=>res(i); i.onerror = ()=>rej(new Error('Bild nicht lesbar')); i.src = quelle; });
  const gross = Math.max(bild.naturalWidth, bild.naturalHeight);
  const laeufe = [ [2400, 1] ]; if(gross < 2400) laeufe.push([4800, 2]); if(gross < 1700) laeufe.push([4800, 3]);
  let erst = null;
  for(const [kante, faktor] of laeufe){
    const d = naBarcodeDeuten(await naBarcodeRoh(naBildAufCanvas(bild, kante, faktor)));
    if(d && d.gtin) return d;
    if(d && !erst) erst = d;
  }
  return erst;
}

/* ── Live-Scan: Kamera, bis ein Code mit gültiger GTIN im Bild ist ──
   Liefert { gtin, itemRef, roh } · { foto:true } (Nutzer will ein Foto
   machen) · null (abgebrochen). Ohne Kamera sofort { foto:true }. */
function naBarcodeScannen(){
  return new Promise(async fertig=>{
    if(!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia!=='function'){ fertig({ foto:true }); return; }
    let strom = null, zeit = null, zu = false;
    const ov = document.createElement('div'); ov.id = 'naScanOv';
    ov.innerHTML = '<div class="na-scan-kopf"><b>Barcode scannen</b><span id="naScanStand">Kamera wird geöffnet …</span></div>'
      + '<div class="na-scan-bild"><video id="naScanVideo" playsinline muted autoplay></video><div class="na-scan-rahmen"></div></div>'
      + '<div class="na-scan-fuss"><button type="button" class="btn btn-sec" id="naScanZu">Abbrechen</button><button type="button" class="btn btn-sec" id="naScanFoto">📷 Lieber ein Foto</button></div>';
    document.body.appendChild(ov);
    const schliessen = erg=>{ if(zu) return; zu = true; if(zeit) clearTimeout(zeit);
      try{ if(strom) strom.getTracks().forEach(t=>t.stop()); }catch(e){}
      try{ document.body.removeChild(ov); }catch(e){}
      fertig(erg); };
    ov.querySelector('#naScanZu').onclick = ()=>schliessen(null);
    ov.querySelector('#naScanFoto').onclick = ()=>schliessen({ foto:true });
    const stand = t=>{ const s = ov.querySelector('#naScanStand'); if(s) s.textContent = t; };
    try{
      /* getUserMedia als ERSTES nach dem Tipp — ein await davor verbraucht
         auf manchen Geräten die Freigabe durch die Berührung. */
      strom = await navigator.mediaDevices.getUserMedia({ audio:false, video:{ facingMode:{ ideal:'environment' }, width:{ ideal:1920 }, height:{ ideal:1080 } } });
    }catch(e){ schliessen({ foto:true, grund:'Kamera nicht freigegeben' }); return; }
    if(zu){ try{ strom.getTracks().forEach(t=>t.stop()); }catch(e){} return; }
    const video = ov.querySelector('#naScanVideo'); video.srcObject = strom;
    try{ await video.play(); }catch(e){}
    stand('Code ins Bild halten — er wird von selbst erkannt.');
    let n = 0;
    const runde = async ()=>{
      if(zu) return;
      try{
        if(video.videoWidth){
          const d = naBarcodeDeuten(await naBarcodeRoh(naBildAufCanvas(video, 1600, 1)));
          if(d && d.gtin){ try{ if(navigator.vibrate) navigator.vibrate(60); }catch(e){} schliessen(d); return; }
          if(d && d.roh && ++n===8) stand('Code erkannt, aber ohne GTIN. Bitte den Code mit „(01)" oder den Strichcode zeigen.');
        }
      }catch(e){ stand('Leser nicht bereit: '+e.message); }
      zeit = setTimeout(runde, 220);
    };
    runde();
  });
}
