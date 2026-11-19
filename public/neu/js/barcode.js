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
/* Code 39: die klassische Strichcode-Form des HIBC (viele ältere Etiketten). */
const NA_BC_NATIV = ['data_matrix','code_128','code_39','ean_13','ean_8','itf','qr_code','upc_a','upc_e'];
const NA_BC_ZXING = ['DataMatrix','Code128','Code39','EAN-13','EAN-8','ITF','QRCode','UPC-A','UPC-E','DataBar','DataBarExpanded'];
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
    /* HIBC: keine GTIN, aber die REF — besser als nichts, eine GTIN gewinnt trotzdem */
    if(s.kind==='hibc' && (!erst || !erst.itemRef)) erst = { gtin:'', itemRef:s.itemRef, roh:t, hibc:true };
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
    if(d && (!erst || (!erst.itemRef && d.itemRef))) erst = d;   /* ein HIBC (mit REF) schlägt einen Code ohne alles */
  }
  return erst;
}

/* ── Kamera: wählen, merken, einstellen ──
   1. Öffnen wie bisher („hintere Kamera") — oder die gemerkte Kamera dieses
      Geräts. Das ist der erste Schritt nach dem Tipp (Freigabe, s. u.).
   2. Erst jetzt kennt der Browser die Namen der Kameras: Ist eine besser
      geeignete da (naKameraReihenfolge, kern.js), wird auf sie gewechselt.
   3. Autofokus „laufend", wo die Kamera es anbietet; bei den virtuellen
      iPhone-Kameras der Zoom, der dem normalen Bildausschnitt entspricht.
   4. Die Kamera, mit der ein Code gelesen wurde, merkt sich das Gerät
      (nalokal_kamera) und öffnet sie beim nächsten Mal direkt.
   5. „Kamera wechseln" geht die hinteren Kameras durch (und merkt die Wahl). */
const NA_KAMERA_MERK = 'nalokal_kamera';
function naKameraGemerkt(){ const k = loadJSON(NA_KAMERA_MERK, null); return (k && k.id) ? k : null; }
function naKameraMerken(k){ store.set(NA_KAMERA_MERK, JSON.stringify(k && k.id ? { id:k.id, label:k.label||'', t:naJetzt() } : null)); }
function naVideoWunsch(id){
  return { audio:false, video: Object.assign(id ? { deviceId:{ exact:id } } : { facingMode:{ ideal:'environment' } }, { width:{ ideal:1920 }, height:{ ideal:1080 } }) };
}
const NA_VIRTUELL = /triple|dreifach|dual[\s-]?wide|dual[\s-]?weitwinkel/i;
/* Der Zielrahmen in Anteilen der Bildfläche (wie .na-scan-rahmen in neu.css). */
const NA_SCAN_RAHMEN = { l:0.08, r:0.92, o:0.26, u:0.74 };

/* ── Live-Scan: Kamera, bis ein Code mit gültiger GTIN im Bild ist ──
   Liefert { gtin, itemRef, roh } · { foto:true } (Nutzer will ein Foto
   machen) · null (abgebrochen). Ohne Kamera-Schnittstelle sofort
   { foto:true }; ist die Kamera nur nicht freigegeben, bleibt das Fenster
   offen und bietet das Foto an.
   Gelesen wird abwechselnd der ZIELRAHMEN in voller Auflösung (zwei von drei
   Runden — kleine Codes brauchen jedes Pixel) und das ganze Bild verkleinert. */
function naBarcodeScannen(){
  return new Promise(async fertig=>{
    if(!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia!=='function'){ fertig({ foto:true }); return; }
    let strom = null, zeit = null, zu = false;
    const K = { liste:[], id:'', label:'', faehig:{}, zoom:1, licht:false, seit:0, wechselt:false };
    const ov = document.createElement('div'); ov.id = 'naScanOv';
    ov.innerHTML = '<div class="na-scan-kopf"><b>Barcode scannen</b><span id="naScanStand">Kamera wird geöffnet …</span></div>'
      + '<div class="na-scan-bild"><video id="naScanVideo" playsinline muted autoplay></video><div class="na-scan-rahmen"></div>'
      + '<div class="na-scan-werkzeug"><button type="button" class="na-scan-k" id="naScanWechsel" hidden>⟳ Kamera wechseln</button><button type="button" class="na-scan-k" id="naScanZoom" hidden>2×</button><button type="button" class="na-scan-k" id="naScanLicht" hidden>💡 Licht</button></div>'
      + '<div class="na-scan-info" id="naScanInfo"></div></div>'
      + '<div class="na-scan-fuss"><button type="button" class="btn btn-sec" id="naScanZu">Abbrechen</button><button type="button" class="btn btn-sec" id="naScanFoto">📷 Lieber ein Foto</button></div>';
    document.body.appendChild(ov);
    const stopp = st=>{ try{ if(st) st.getTracks().forEach(t=>t.stop()); }catch(e){} };
    const schliessen = erg=>{ if(zu) return; zu = true; if(zeit) clearTimeout(zeit); stopp(strom);
      try{ document.body.removeChild(ov); }catch(e){}
      fertig(erg); };
    ov.querySelector('#naScanZu').onclick = ()=>schliessen(null);
    ov.querySelector('#naScanFoto').onclick = ()=>schliessen({ foto:true });
    const stand = t=>{ const s = ov.querySelector('#naScanStand'); if(s) s.textContent = t; };
    const video = ov.querySelector('#naScanVideo');
    const spur = ()=>strom && strom.getVideoTracks ? strom.getVideoTracks()[0] : null;
    const einstellen = async c=>{ const t = spur(); if(!t || !t.applyConstraints) return false;
      try{ await t.applyConstraints({ advanced:[c] }); return true; }catch(e){ try{ await t.applyConstraints(c); return true; }catch(x){ return false; } } };
    /* Was die Kamera kann — und die Knöpfe danach. */
    const faehig = async ()=>{
      const t = spur(); if(!t) return;
      const set = t.getSettings ? t.getSettings() : {}; K.id = set.deviceId || K.id || '';
      const eintrag = K.liste.find(k=>k.id===K.id); K.label = (eintrag && eintrag.label) || t.label || '';
      K.faehig = {}; try{ K.faehig = t.getCapabilities ? (t.getCapabilities() || {}) : {}; }catch(e){}
      const fm = K.faehig.focusMode || [];
      if(fm.indexOf('continuous')>=0) await einstellen({ focusMode:'continuous' });
      const z = K.faehig.zoom; K.zoom = (set.zoom || 1);
      /* Virtuelle iPhone-Kamera ohne „1 = Weitwinkel": Zoom 2 zeigt den normalen Ausschnitt (sonst Ultraweitwinkel, Code winzig). */
      if(z && NA_VIRTUELL.test(K.label) && z.min>=1 && z.max>=2 && await einstellen({ zoom:2 })) K.zoom = 2;
      const zb = ov.querySelector('#naScanZoom'); zb.hidden = !(z && z.max>=1.5); zb.textContent = K.zoom>=1.5 ? '1×' : '2×';
      const lb = ov.querySelector('#naScanLicht'); lb.hidden = !K.faehig.torch; K.licht = false; lb.classList.remove('an');
      const wb = ov.querySelector('#naScanWechsel'); const i = K.liste.findIndex(k=>k.id===K.id);
      wb.hidden = K.liste.length<2; wb.textContent = '⟳ Kamera wechseln'+(K.liste.length>1 ? ' ('+((i<0?0:i)+1)+'/'+K.liste.length+')' : '');
      info();
    };
    const info = ()=>{ const t = spur(); const set = t && t.getSettings ? t.getSettings() : {};
      const teile = [K.label || 'Kamera', (set.width && set.height) ? set.width+'×'+set.height : '',
        (K.faehig.focusMode||[]).indexOf('continuous')>=0 ? 'Autofokus' : '', K.zoom>=1.5 ? 'Zoom '+(Math.round(K.zoom*10)/10)+'×' : '', K.licht ? 'Licht an' : ''].filter(Boolean);
      const el = ov.querySelector('#naScanInfo'); if(el) el.textContent = teile.join(' · '); };
    /* Auf eine andere Kamera wechseln (Kennung). Misslingt es, bleibt die alte. */
    const wechseln = async id=>{
      if(K.wechselt || zu) return false; K.wechselt = true;
      const alt = strom; let neu = null;
      try{ stopp(alt); neu = await navigator.mediaDevices.getUserMedia(naVideoWunsch(id)); }
      catch(e){ try{ neu = await navigator.mediaDevices.getUserMedia(naVideoWunsch(K.id)); }catch(x){ neu = null; } }
      K.wechselt = false;
      if(zu){ stopp(neu); return false; }
      if(!neu){ stand('Diese Kamera ließ sich nicht öffnen.'); return false; }
      strom = neu; video.srcObject = strom; try{ await video.play(); }catch(e){}
      await faehig(); K.seit = Date.now(); return true;
    };
    ov.querySelector('#naScanWechsel').onclick = async ()=>{
      if(K.liste.length<2) return; const i = K.liste.findIndex(k=>k.id===K.id); const n = K.liste[(i+1) % K.liste.length];
      stand('Kamera wird gewechselt …');
      if(await wechseln(n.id)){ naKameraMerken({ id:K.id, label:K.label }); stand('Code ins Bild halten — er wird von selbst erkannt.'); }
    };
    ov.querySelector('#naScanZoom').onclick = async ()=>{
      const z = K.faehig.zoom; if(!z) return; const ziel = K.zoom>=1.5 ? Math.max(z.min||1, 1) : Math.min(2, z.max);
      if(await einstellen({ zoom:ziel })){ K.zoom = ziel; ov.querySelector('#naScanZoom').textContent = K.zoom>=1.5 ? '1×' : '2×'; info();
        if(K.zoom>=1.5) stand('Zoom 2× — das Handy etwas weiter weg halten (20–30 cm).'); }
    };
    ov.querySelector('#naScanLicht').onclick = async ()=>{
      if(await einstellen({ torch:!K.licht })){ K.licht = !K.licht; ov.querySelector('#naScanLicht').classList.toggle('an', K.licht); info(); }
    };
    /* Antippen ins Bild: einmal scharfstellen (wo die Kamera es kann), dann wieder laufend. */
    video.addEventListener('click', async ev=>{
      const fm = K.faehig.focusMode || []; if(fm.indexOf('single-shot')<0) return;
      const r = video.getBoundingClientRect(); const pkt = { x:(ev.clientX-r.left)/r.width, y:(ev.clientY-r.top)/r.height };
      await einstellen(K.faehig.pointsOfInterest ? { pointsOfInterest:[pkt], focusMode:'single-shot' } : { focusMode:'single-shot' });
      setTimeout(()=>{ if(!zu && fm.indexOf('continuous')>=0) einstellen({ focusMode:'continuous' }); }, 1500);
    });

    let gemerkt = naKameraGemerkt();
    try{
      /* getUserMedia als ERSTES nach dem Tipp — ein await davor verbraucht
         auf manchen Geräten die Freigabe durch die Berührung. */
      try{ strom = await navigator.mediaDevices.getUserMedia(naVideoWunsch(gemerkt && gemerkt.id)); }
      catch(e){
        /* Die gemerkte Kamera gibt es nicht mehr (anderes Gerät, Kennung neu) → vergessen, normal öffnen. */
        if(!gemerkt || e.name==='NotAllowedError' || e.name==='SecurityError') throw e;
        naKameraMerken(null); gemerkt = null; strom = await navigator.mediaDevices.getUserMedia(naVideoWunsch(''));
      }
    }catch(e){
      /* Nicht still zum Foto wechseln: Der Tipp auf den Knopf ist die frische
         Berührung, die iPhone und iPad für den Foto-Dialog verlangen. */
      ov.classList.add('ohne-kamera');
      stand('Die Kamera ist für diese Seite nicht freigegeben. Stattdessen ein Foto vom Barcode aufnehmen:');
      const fb = ov.querySelector('#naScanFoto'); fb.textContent = '📷 Foto vom Barcode'; fb.className = 'btn btn-pri';
      return;
    }
    if(zu){ stopp(strom); return; }
    video.srcObject = strom;
    try{ await video.play(); }catch(e){}
    /* Jetzt (mit Freigabe) die Kameras mit Namen — und, wenn nichts gemerkt ist, die beste nehmen. */
    try{ const g = (await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
      K.liste = naKameraReihenfolge(g.map(d=>({ id:d.deviceId, label:d.label }))); }catch(e){ K.liste = []; }
    await faehig();
    if(!gemerkt && K.liste.length>1 && K.liste[0].label){
      const best = K.liste[0], jetzt = K.liste.find(k=>k.id===K.id);
      if(best.id!==K.id && (!jetzt || best.rang>jetzt.rang)){ stand('Passende Kamera wird gewählt …'); await wechseln(best.id); }
    }
    if(zu) return;
    stand('Code ins Bild halten — er wird von selbst erkannt.');
    K.seit = Date.now();
    let n = 0, hibc = null, hibcSeit = 0, hinweis = false;
    const treffer = d=>{ try{ if(navigator.vibrate) navigator.vibrate(60); }catch(e){}
      if(K.id) naKameraMerken({ id:K.id, label:K.label });   /* diese Kamera hat gelesen → nächstes Mal gleich sie */
      schliessen(d); };
    const runde = async ()=>{
      if(zu) return;
      try{
        if(video.videoWidth && !K.wechselt){
          /* zwei von drei Runden: der Zielrahmen in voller Auflösung; die dritte: das ganze Bild */
          const ganz = (n % 3)===2;
          const c = ganz ? naBildAufCanvas(video, 1600, 1) : naBildAusschnitt(video, naRahmenImVideo(video.videoWidth, video.videoHeight, video.clientWidth, video.clientHeight, NA_SCAN_RAHMEN), 1600);
          n++;
          const d = naBarcodeDeuten(await naBarcodeRoh(c));
          if(d && d.gtin){ if(!d.itemRef && hibc) d.itemRef = hibc.itemRef; treffer(d); return; }
          /* HIBC (nur REF): noch kurz weitersuchen — trägt das Etikett auch eine GTIN, gewinnt sie. */
          if(d && d.hibc && !hibc){ hibc = d; hibcSeit = Date.now(); stand('HIBC-Code erkannt — einen Augenblick, vielleicht steht auch eine GTIN auf dem Etikett …'); }
          if(hibc && Date.now()-hibcSeit > 1200){ treffer(hibc); return; }
          if(d && d.roh && !hibc && n>=8 && !hinweis) stand('Code erkannt, aber ohne GTIN. Bitte den Code mit „(01)" oder den Strichcode zeigen.');
          /* Nach 4 s ohne Treffer: sagen, was meist hilft. */
          if(!hibc && !hinweis && Date.now()-K.seit > 4000){ hinweis = true;
            stand('Wird es nicht scharf? Das Handy etwas weiter weg halten (10–20 cm)'+(K.faehig.zoom ? ', „2×" probieren' : '')+(K.liste.length>1 ? ' — oder „Kamera wechseln".' : '.')); }
        }
      }catch(e){ stand('Leser nicht bereit: '+e.message); }
      zeit = setTimeout(runde, 180);
    };
    runde();
  });
}
/* Ein Ausschnitt des Videos als Bildfläche, höchstens `kante` Pixel lang. */
function naBildAusschnitt(video, a, kante){
  if(!a || a.w<16 || a.h<16) return naBildAufCanvas(video, kante, 1);
  const f = Math.min(1, (kante||1600)/Math.max(a.w, a.h));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(a.w*f)); c.height = Math.max(1, Math.round(a.h*f));
  const x = c.getContext('2d', { willReadFrequently:true }); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  x.drawImage(video, a.x, a.y, a.w, a.h, 0, 0, c.width, c.height);
  return c;
}
