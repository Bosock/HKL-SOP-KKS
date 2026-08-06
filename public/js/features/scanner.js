/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — ETIKETT-SCANNER & PRODUKTDATENBANK
   Zweck: eine INFORMATIONSSAMMLUNG, die das im Standard verwendete Material
   möglichst eindeutig identifiziert und seine Eigenschaften schnell greifbar
   macht — KEINE Materialwirtschaft/Chargenverfolgung. Charge/LOT und
   Verfallsdatum sind daher bewusst irrelevant (werden aus dem Code zwar
   geparst, aber nicht gespeichert/angezeigt).
   „Kamera hinhalten → Barcode/UDI-DataMatrix wird erkannt": aus dem Code kommt
   exakt und offline die GTIN (weltweit eindeutige Produkt-Nummer) als
   DB-Schlüssel — derselbe Artikel liefert immer dieselbe GTIN → die
   Produktdatenbank gruppiert und organisiert sich von selbst.

   Aufteilung:
     - Der Barcode (native BarcodeDetector-API, Android-Chrome) trägt die GTIN,
       NICHT die menschenlesbare REF oder den Herstellernamen. Die GTIN ist der
       DB-Schlüssel; die Freitext-Felder werden EINMAL pro GTIN erfasst.
     - Das Erfassen dieser Felder unterstützt zusätzlich On-Device-OCR aus einem
       Etikett-Foto (features/ocr.js, Tesseract.js/WASM, selbst gehostet) — sie
       füllt das Formular vor, der Nutzer bestätigt.
     - Fehlt die BarcodeDetector-API, bleibt die Datenbank durchsuchbar und
       (als Admin) manuell pflegbar; die Foto-OCR funktioniert unabhängig davon.

   Geteilter Zustand: `hkl_gtin` (in SHARED_KEYS + BACKUP_KEYS).
     GTINDB[gtin] = { gtin, hersteller, ref, name, verwendung,
                      french, laenge, dAussen, dInnen, weitere,
                      lagerort, preis, photo, createdAt, updatedAt }
   ───────────────────────────────────────────────────────────── */

/* ===== Reine, testbare Helfer (kein DOM/Store) ===== */

/* Parst eine GS1-Element-Zeichenkette (aus GS1-DataMatrix/-Barcode) in ihre
   Application Identifiers. Verarbeitet FNC1/GS-Trenner (ASCII 29) und feste
   wie variable Feldlängen. Liefert {gtin,lot,expiry,serial,prodDate,qty,
   itemRef,extra} oder null, wenn nichts Erkennbares gefunden wurde. */
function parseGS1(raw){
  if(raw==null) return null;
  let s=String(raw);
  s=s.replace(/^\][A-Za-z0-9]{2}/,'');           /* AIM-Symbologie-Kennung, z. B. ]d2 ]C1 ]Q3 ]e0 */
  const GS='\u001d';
  while(s.charAt(0)===GS) s=s.slice(1);           /* führendes FNC1 abstreifen */
  const FIXED={'00':18,'01':14,'02':14,'03':14,'04':16,'11':6,'12':6,'13':6,'14':6,'15':6,'16':6,'17':6,'18':6,'19':6,'20':2};
  const VAR2={'10':1,'21':1,'22':1,'30':1,'37':1,'90':1,'91':1,'92':1,'93':1,'94':1,'95':1,'96':1,'97':1,'98':1,'99':1};
  const VAR3={'235':1,'240':1,'241':1,'242':1,'243':1,'250':1,'251':1,'253':1,'254':1,'255':1,'400':1,'401':1,'402':1,'403':1,'420':1,'421':1,'422':1,'423':1,'424':1,'425':1,'426':1};
  const out={}; let i=0, guard=0, recognized=false;
  function put(ai,val){
    if(ai==='01'||ai==='02'){ if(!out.gtin) out.gtin=val; }
    else if(ai==='10') out.lot=val;
    else if(ai==='21') out.serial=val;
    else if(ai==='17') out.expiry=val;
    else if(ai==='11') out.prodDate=val;
    else if(ai==='15'||ai==='16') out.bestBefore=val;
    else if(ai==='00') out.sscc=val;
    else if(ai==='30'||ai==='37') out.qty=val;
    else if(ai==='240'||ai==='241'){ if(!out.itemRef) out.itemRef=val; }   /* trägt teils die Hersteller-REF */
    else { (out.extra=(out.extra||{}))[ai]=val; }
  }
  while(i<s.length && guard++<64){
    if(s.charAt(i)===GS){ i++; continue; }
    const a2=s.slice(i,i+2), a3=s.slice(i,i+3), a4=s.slice(i,i+4);
    let ai=null, fixed=0, variable=false;
    if(/^\d{2}$/.test(a2) && FIXED.hasOwnProperty(a2)){ ai=a2; fixed=FIXED[a2]; }
    else if(/^\d{2}$/.test(a2) && VAR2.hasOwnProperty(a2)){ ai=a2; variable=true; }
    else if(/^\d{3}$/.test(a3) && VAR3.hasOwnProperty(a3)){ ai=a3; variable=true; }
    else if(/^3[1-6]\d\d$/.test(a4)){ ai=a4; fixed=6; }                    /* Maß-AIs 31xx–36xx (6 Ziffern) */
    else if(/^\d{2}$/.test(a2)){ ai=a2; variable=true; }                    /* unbekannt → als variabel annehmen */
    else break;
    i+=ai.length;
    let val;
    if(variable){ let j=s.indexOf(GS,i); if(j<0) j=s.length; val=s.slice(i,j); i=(j<s.length?j+1:j); }
    else { val=s.slice(i,i+fixed); i+=fixed; }
    if(val===''){ continue; }
    recognized=true; put(ai,val);
  }
  return recognized?out:null;
}

/* Formt ein GS1-Datum (YYMMDD) in ein lesbares ISO-Datum (YYYY-MM-DD). Tag „00"
   bedeutet laut GS1 „Monatsende" → letzter Tag des Monats. */
function formatGs1Date(v){
  const s=String(v==null?'':v);
  if(!/^\d{6}$/.test(s)) return s;
  const yy=parseInt(s.slice(0,2),10), mm=parseInt(s.slice(2,4),10), dd=parseInt(s.slice(4,6),10);
  if(mm<1||mm>12) return s;
  const year=2000+yy;                              /* Gleitfenster vereinfacht: Verfallsdaten liegen nahe Zukunft */
  const day=(dd===0)? new Date(year,mm,0).getDate() : dd;
  const p=(n)=>(n<10?'0':'')+n;
  return year+'-'+p(mm)+'-'+p(day);
}

/* Normalisiert eine GTIN/EAN/UPC auf die kanonische 14-stellige Form, damit
   derselbe Artikel (ob als EAN-13 oder GTIN-14 gescannt) denselben DB-Schlüssel
   ergibt. Nicht-numerische Codes bleiben unverändert (getrimmt). */
function gtinKey(g){
  if(g==null) return '';
  let s=String(g).trim();
  if(/^\d{8,14}$/.test(s)){ s=s.replace(/^0+/,''); if(s==='') s='0'; while(s.length<14) s='0'+s; return s; }
  return s;
}

/* Hier stand bis zum 04.08.2026 eine Funktion expiryStatus(), die zu einem
   Verfallsdatum „abgelaufen / bald / ok" berechnete. Sie wurde nirgends
   aufgerufen — sie war der Anfang einer Bestandsführung, und die ist in
   dieser App ausdrücklich ausgeschlossen (docs/GRUNDSAETZE.md, Regel A2:
   „Verfallsdatum und Charge sind irrelevant"). Entfernt, damit der Code die
   Vorgabe nicht stillschweigend unterläuft.

   Der GS1-Zerleger liest die Felder für Charge (AI 10) und Verfall (AI 17)
   weiterhin — er muss sie erkennen, um sie von der Produktnummer zu trennen.
   Behalten wird davon nichts (siehe handleScan). */

/* Ordnet ein rohes Scan-Ergebnis einer Bedeutung zu: GS1 (mit AIs), reine
   GTIN/EAN, URL (QR) oder Freitext. format ist der BarcodeDetector-Formatname. */
function parseScan(raw, format){
  const s=(raw==null?'':String(raw));
  const looksGs1 = s.indexOf('\u001d')>=0 || /^\][A-Za-z0-9]{2}/.test(s) || /^01\d{13,14}/.test(s) || format==='data_matrix';
  if(looksGs1){ const g=parseGS1(s); if(g && (g.gtin||g.lot||g.expiry||g.serial)) return Object.assign({kind:'gs1'}, g); }
  if(/^https?:\/\//i.test(s)) return {kind:'url', url:s, raw:s};
  if(/^\d{8,14}$/.test(s)) return {kind:'gtin', gtin:s, raw:s};
  return {kind:'text', text:s, raw:s};
}

/* Legt/aktualisiert einen Produktdatensatz (unveränderlich zusammengeführt):
   vorhandene Felder werden vom patch überschrieben, Zeitstempel gepflegt. */
function mergeGtinRecord(prev, patch, nowIso){
  const base = prev || { createdAt: nowIso, scanCount: 0 };
  const rec = Object.assign({}, base, patch||{});
  if(!rec.createdAt) rec.createdAt = nowIso;
  rec.updatedAt = nowIso;
  return rec;
}

/* Volltext-Filter über Produktdatensätze (Name, REF, Hersteller, GTIN,
   Verwendung). Leere Suche = alle. Reine Funktion (testbar). */
function filterGtin(list, q){
  q=(q||'').trim().toLowerCase();
  const arr=(list||[]).slice();
  if(!q) return arr;
  return arr.filter(r=>((r.name||'')+' '+(r.ref||'')+' '+(r.hersteller||'')+' '+(r.gtin||'')+' '+(r.verwendung||'')).toLowerCase().indexOf(q)>=0);
}

/* Gruppiert Produktdatensätze nach Hersteller (alphabetisch), Einträge je
   Gruppe nach Name/REF/GTIN sortiert. Akzeptiert Array oder DB-Map. */
function gtinGroups(list){
  const arr=Array.isArray(list)?list.slice():Object.keys(list||{}).map(k=>list[k]);
  const groups={};
  arr.forEach(r=>{ const h=((r.hersteller||'').trim())||'Ohne Hersteller'; (groups[h]=groups[h]||[]).push(r); });
  return Object.keys(groups).sort((a,b)=>a.localeCompare(b,'de')).map(h=>({
    hersteller:h,
    items:groups[h].sort((x,y)=>(((x.name||x.ref||x.gtin||'')+'')).localeCompare(((y.name||y.ref||y.gtin||'')+''),'de'))
  }));
}

/* Baut die Maß-Chips eines Produkts als [Label, Wert]-Paare (French, Länge,
   Ø außen/innen, weitere). Reine Funktion. */
function gtinBadges(r){
  const b=[];
  if(r.french) b.push(['Fr', r.french]);
  if(r.laenge) b.push(['Länge', r.laenge]);
  if(r.dAussen) b.push(['Ø außen', r.dAussen]);
  if(r.dInnen) b.push(['Ø innen', r.dInnen]);
  if(r.weitere) b.push(['Maß', r.weitere]);
  return b;
}
/* EIN einheitliches Maß-System für das Material: liefert die typisierten Größen
   als Liste {typ,wert} — aus der neuen `groessen`-Liste PLUS den alten festen
   Feldern (french/laenge/Ø/weitere), solange diese noch existieren (OCR/Import).
   So gibt es genau EINE Maßliste (wie beim Eintrag), ohne Altbestand zu
   verlieren. Rein/testbar. */
function matSizeList(r){
  const out=[]; if(!r) return out;
  if(Array.isArray(r.groessen)) r.groessen.forEach(g=>{ if(g&&g.wert) out.push({typ:g.typ||'dimension',wert:g.wert}); });
  const add=(typ,wert)=>{ if(wert) out.push({typ,wert:String(wert)}); };
  add('french', r.french); add('laenge', r.laenge);
  if(r.dAussen) add('durchmesser', 'außen '+r.dAussen);
  if(r.dInnen) add('durchmesser', 'innen '+r.dInnen);
  add('dimension', r.weitere);
  return out;
}

/* ===== Fotogalerie eines Materials ===== */
/* Ein Bild reicht selten: Verpackung, Etikett, das ausgepackte Produkt, der
   Anschluss, der Lagerort im Regal — im HKL hilft jedes davon beim
   Wiedererkennen. Der Stammsatz führt deshalb eine LISTE von Fotos.
   `photo` (Einzelbild) bleibt als Vorschaubild bestehen und ist immer das
   erste Bild der Liste — so bleiben alle Altbestände und alle Listenansichten
   unverändert nutzbar. Rein & testbar. */
function matPhotos(r){
  if(!r) return [];
  const out=[];
  const push=(src,titel)=>{ const s=String(src||''); if(!s) return;
    if(out.some(x=>x.src===s)) return; out.push({ src:s, titel:titel||'' }); };
  if(Array.isArray(r.fotos)) r.fotos.forEach(f=>{ if(typeof f==='string') push(f,''); else if(f) push(f.src, f.titel); });
  push(r.photo,'');                       /* Alt-Einzelfoto nie verlieren */
  return out;
}
/* Foto anhängen (ohne Dubletten). Liefert eine NEUE Liste. Rein. */
function matPhotoAdd(list, src, titel){
  const s=String(src||''); const arr=(list||[]).slice();
  if(!s || arr.some(x=>x&&x.src===s)) return arr;
  arr.push({ src:s, titel:titel||'' }); return arr;
}
/* Foto entfernen. Rein. */
function matPhotoDel(list, i){ const arr=(list||[]).slice(); if(i<0||i>=arr.length) return arr; arr.splice(i,1); return arr; }
/* Foto zum Vorschaubild machen (nach vorn holen). Rein. */
function matPhotoMain(list, i){ const arr=(list||[]).slice(); if(i<=0||i>=arr.length) return arr;
  const [x]=arr.splice(i,1); arr.unshift(x); return arr; }

/* ===== Zustand ===== */
let GTINDB=loadJSON('hkl_gtin',{}); function saveGtinDB(){ saveJSON('hkl_gtin',GTINDB); }
let scanGalerie=[];                                 /* Fotoliste des gerade offenen Editors */
let lastScanInfo=null;                              /* transiente Info des letzten Scans (LOT/Verfall/Serie) */
let scanPendingLinkKey=null;                        /* material_key, der beim nächsten Speichern mit dem Stammsatz verknüpft wird (Materialverwaltung) */
let scanStream=null, scanTimer=null, scanDetector=null, scanBusy=false, scanTorchOn=false;
const SCAN_FORMATS=['data_matrix','qr_code','code_128','ean_13','ean_8','upc_a','upc_e','code_39','itf','codabar'];

/* ===== Kamera / Live-Erkennung (BarcodeDetector) ===== */
function scannerSupported(){
  return typeof window!=='undefined' && 'BarcodeDetector' in window
    && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia==='function';
}
/* Ordnet den DOMException-Namen von getUserMedia() einer konkreten,
   handlungsleitenden Meldung zu — der vorherige Catch-All („nicht freigegeben
   oder nicht verfügbar") verschluckte die eigentliche Ursache und ließ weder
   Nutzer noch Support erkennen, ob Berechtigung, Hardware oder Belegung das
   Problem war. */
function camErrorMessage(e){
  const n=e&&e.name;
  if(n==='NotAllowedError'||n==='SecurityError') return 'Kamerazugriff blockiert – so gibst du die Kamera frei (Schritte unten).';
  if(n==='NotFoundError'||n==='OverconstrainedError') return 'Keine passende Kamera gefunden. Gerät ohne Rückkamera? Unten manuell suchen/anlegen.';
  if(n==='NotReadableError'||n==='TrackStartError') return 'Kamera wird gerade von einer anderen App oder einem anderen Tab benutzt. Diese schließen und erneut versuchen.';
  if(!location.protocol.startsWith('https')&&location.hostname!=='localhost') return 'Kamera braucht eine sichere Verbindung (https). Bitte über https aufrufen.';
  return 'Kamera nicht freigegeben oder nicht verfügbar (' + (n||'unbekannter Fehler') + ').';
}
/* Echten Berechtigungs-Zustand abfragen (Chromium/Samsung: unterstützt;
   Firefox kennt „camera" nicht → null). Damit lässt sich „einmal blockiert"
   von „noch nie gefragt" unterscheiden und die Hilfe passend formulieren. */
function cameraPermissionState(){
  try{ if(navigator.permissions&&navigator.permissions.query)
    return navigator.permissions.query({name:'camera'}).then(s=>s&&s.state).catch(()=>null); }catch(e){}
  return Promise.resolve(null);
}
function isSamsungBrowser(){ return /SamsungBrowser/i.test((navigator&&navigator.userAgent)||''); }
/* Browsergerechte Freigabe-Schritte. Bewusst OHNE Verweis auf ein bestimmtes
   Symbol (Samsung Internet zeigt kein 🔒), sondern über das Menü — das gibt es
   in jedem Browser. */
function camHelpSteps(){
  const host=location.hostname;
  if(isSamsungBrowser()) return [
    'Samsung Internet: unten auf das Menü ☰ tippen → „Einstellungen".',
    '„Websites und Downloads" → „Website-Berechtigungen" → „Kamera".',
    '„'+host+'" auf „Erlauben" stellen (bzw. aus „Blockiert" entfernen).',
    'Diese Seite neu laden und erneut „📷 Etikett scannen" tippen.'
  ];
  return [
    'Chrome: oben rechts ⋮-Menü → „Einstellungen" → „Website-Einstellungen" → „Kamera".',
    'Unter „Blockiert" den Eintrag „'+host+'" antippen → „Zulassen".',
    '(Oder in der Adressleiste links auf das Seiten-Info-/Schloss-Symbol → „Berechtigungen" → „Kamera" → „Zulassen".)',
    'Seite neu laden und erneut „📷 Etikett scannen" tippen.'
  ];
}
/* Liefert den Hilfe-Slot des gerade sichtbaren Screens (siehe showCamHelp). */
function scanHelpSlot(){
  const act=document.querySelector('.screen.active');
  return (act&&act.querySelector('.scan-help-slot'))||document.querySelector('.scan-help-slot');
}
/* Dauerhaft sichtbarer Hilfe-Block im Scan-Hub (statt flüchtigem Toast), damit
   man die Schritte in Ruhe befolgen kann. */
function showCamHelp(reason){
  /* Alle Screens liegen gleichzeitig im DOM — eine feste ID traf daher immer
     den ERSTEN Treffer (ggf. in einem unsichtbaren Screen) und die Hilfe blieb
     unsichtbar. Deshalb: Slot per Klasse suchen, und zwar im AKTIVEN Screen. */
  const box=scanHelpSlot(); if(!box) return;
  const steps=camHelpSteps().map(s=>`<li style="margin:4px 0">${esc(s)}</li>`).join('');
  box.innerHTML=`<div style="border:1px solid var(--warn);background:rgba(224,90,90,.12);border-radius:14px;padding:14px 16px;margin:12px 0">
    <div style="font-weight:800;color:var(--warn);margin-bottom:6px">📷 Kamera für diese Seite blockiert</div>
    <p style="margin:0 0 8px;color:var(--text)">${esc(reason)} Der Browser fragt nicht erneut, solange die Kamera blockiert ist — sie muss einmal manuell freigegeben werden:</p>
    <ol style="margin:0 0 10px;padding-left:20px;color:var(--text)">${steps}</ol>
    <button class="btn btn-pri" onclick="startCam()">📷 Erneut versuchen</button>
  </div>`;
  try{ box.scrollIntoView({behavior:'smooth',block:'center'}); }catch(e){}
}
/* Kamera-Fehler behandeln: kurzer Toast + (bei Berechtigungssperre) dauerhafte,
   browsergerechte Anleitung. */
function camFail(e){
  toast(camErrorMessage(e),true);
  const n=e&&e.name;
  if(n==='NotAllowedError'||n==='SecurityError'){
    cameraPermissionState().then(st=>{
      showCamHelp(st==='denied'
        ? 'Die Kamera-Berechtigung steht auf „blockiert".'
        : 'Der Kamerazugriff wurde abgelehnt.');
    });
  }
}
async function startCam(){
  if(!scannerSupported()){ toast('Live-Scanner auf diesem Gerät nicht verfügbar. Bitte Produkt unten suchen oder (als Admin) manuell anlegen.',true); return; }
  /* WICHTIG (Ursache „Kamerazugriff blockiert" trotz Freigabe): getUserMedia()
     MUSS die ERSTE asynchrone Aktion nach dem Tippen sein. Ein vorheriges
     `await` (z. B. BarcodeDetector.getSupportedFormats()) verbraucht die
     transiente Nutzer-Aktivierung — Android-Chrome bricht getUserMedia dann
     ohne Berechtigungs-Dialog mit NotAllowedError ab. Also erst die Kamera
     anfordern, den Detektor DANACH einrichten. */
  let stream=null;
  try{ stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false}); }
  catch(e){
    /* Manche Geräte werfen OverconstrainedError schon bei "ideal" (z. B. nur
       eine Kamera vorhanden) — mit gelockerten Constraints erneut versuchen,
       bevor endgültig aufgegeben wird. */
    if(e&&e.name==='OverconstrainedError'){
      try{ stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false}); }
      catch(e2){ camFail(e2); return; }
    } else { camFail(e); return; }
  }
  scanStream=stream;
  /* Detektor jetzt einrichten (Formate erst nach erteilter Berechtigung). */
  let formats=SCAN_FORMATS.slice();
  try{ const supp=await window.BarcodeDetector.getSupportedFormats(); if(supp&&supp.length){ const inter=SCAN_FORMATS.filter(f=>supp.indexOf(f)>=0); formats=inter.length?inter:supp; } }catch(e){}
  try{ scanDetector=new window.BarcodeDetector({formats}); }
  catch(e){ try{ scanDetector=new window.BarcodeDetector(); }catch(e2){ stopCam(); toast('Scanner-Start fehlgeschlagen.',true); return; } }
  const v=$('scanVideo'); if(!v){ stopCam(); return; }
  v.srcObject=scanStream; v.setAttribute('playsinline','true'); v.muted=true;
  try{ await v.play(); }catch(e){}
  scanTorchOn=false; updateTorchBtn();
  const cam=$('scanCam'); if(cam){ cam.classList.add('show'); cam.setAttribute('aria-hidden','false'); }
  scanBusy=false; scanLoop();
}
function scanLoop(){
  const v=$('scanVideo');
  const run=async()=>{
    if(!scanStream) return;
    if(!scanBusy && v && v.readyState>=2 && scanDetector){
      scanBusy=true;
      try{
        const codes=await scanDetector.detect(v);
        if(codes&&codes.length){ const c=codes[0]; scanBusy=false; onDecode(c.rawValue||'', c.format||''); return; }
      }catch(e){ /* vorübergehender Dekodierfehler → weiterscannen */ }
      scanBusy=false;
    }
    scanTimer=setTimeout(run,220);
  };
  run();
}
function stopCam(){
  if(scanTimer){ clearTimeout(scanTimer); scanTimer=null; }
  if(scanStream){ try{ scanStream.getTracks().forEach(t=>t.stop()); }catch(e){} scanStream=null; }
  const v=$('scanVideo'); if(v){ try{ v.pause(); }catch(e){} try{ v.srcObject=null; }catch(e){} }
  const cam=$('scanCam'); if(cam){ cam.classList.remove('show'); cam.setAttribute('aria-hidden','true'); }
  scanBusy=false; scanTorchOn=false;
}
async function toggleTorch(){
  if(!scanStream) return;
  const track=scanStream.getVideoTracks()[0]; if(!track) return;
  let caps={}; try{ caps=track.getCapabilities?track.getCapabilities():{}; }catch(e){}
  if(!caps.torch){ toast('Taschenlampe auf diesem Gerät nicht verfügbar.'); return; }
  scanTorchOn=!scanTorchOn;
  try{ await track.applyConstraints({advanced:[{torch:scanTorchOn}]}); updateTorchBtn(); }
  catch(e){ scanTorchOn=!scanTorchOn; }
}
function updateTorchBtn(){ const b=$('scanTorch'); if(b) b.classList.toggle('on',scanTorchOn); }

/* Ein Code wurde erkannt: Kamera stoppen, deuten, passend weiterleiten. */
function onDecode(raw, fmt){
  stopCam();
  try{ if(navigator.vibrate) navigator.vibrate(60); }catch(e){}
  const parsed=parseScan(raw, fmt);
  if(parsed.kind==='url'){
    if(confirm('Der Code enthält einen Link:\n'+parsed.url+'\n\nÖffnen?')){ try{ window.open(parsed.url,'_blank','noopener'); }catch(e){} }
    return;
  }
  const gtin = parsed.gtin ? gtinKey(parsed.gtin) : '';
  if(!gtin){ toast('Kein Produkt-Barcode erkannt (keine GTIN). Bitte erneut scannen.',true); return; }
  /* Diese App ist eine Material-Informationssammlung, KEINE Chargen-/Verfalls-
     verwaltung: Charge/LOT und Verfallsdatum aus dem Code sind hier bewusst
     irrelevant und werden nicht gespeichert/angezeigt. Aus dem Scan behalten
     wir nur die GTIN (Identität) und eine evtl. mitcodierte Hersteller-REF (240)
     als Vorbefüllhilfe fürs Formular. */
  lastScanInfo={ gtin, itemRef:parsed.itemRef||'' };
  if(GTINDB[gtin]) openScanItem(gtin,false);       /* bekannt → Datensatz zeigen */
  else openScanItem(gtin,true);                    /* neu → Formular vorbefüllt */
}

/* ===== Ansichten ===== */
function openScanHub(){
  showSheet(false); formCtx=null; scanPendingLinkKey=null;   /* Abbrechen/Zurück verwirft eine offene Neuanlage-Verknüpfung */
  /* Aus der zentralen Materialverwaltung (mode 'care') heraus geöffnet →
     dorthin zurück (Editor „Abbrechen"/„Speichern" landet wieder im Hub). */
  if(mode==='care' && typeof renderMatCenter==='function'){
    renderMatCenter(); show('scr-care');
    setBar('Material', (typeof MAT_INDEX!=='undefined'?MAT_INDEX.length:0)+' Materialien', false);
    const sw=$('searchWrap'); if(sw) sw.style.display='none'; return;
  }
  mode='use'; nav=[];
  renderScanHub('');
  show('scr-scan');
  setBar('Etikett-Scanner', Object.keys(GTINDB).length+' Produkte', true);
  const sw=$('searchWrap'); if(sw) sw.style.display='none';
}
function renderScanHub(q){
  const cta = scannerSupported()
    ? `<button class="scan-cta" onclick="startCam()">📷 Etikett scannen</button>`
    : `<div class="scan-this">Der Live-Scanner braucht Android-Chrome mit Kamerafreigabe und ist auf diesem Gerät nicht verfügbar. Die Produktdatenbank lässt sich hier trotzdem durchsuchen${ADMIN?' und manuell pflegen':''}.</div>`;
  const manual = ADMIN ? `<button class="add-entry-btn" onclick="openScanItem('',true)">＋ Produkt ohne Scan anlegen</button>` : '';
  const search = `<div class="std-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><input type="search" id="gtinSearchInput" placeholder="Produkt, REF, Hersteller, GTIN …" value="${esc(q||'')}" oninput="scanSearch(this.value)" autocomplete="off"></div>`;
  /* Slot für die dauerhafte Kamera-Freigabe-Hilfe (showCamHelp bei Sperre). */
  $('scr-scan').innerHTML = cta + `<div class="scan-help-slot"></div>` + manual + search + `<div id="gtinList">${scanListHTML(q)}</div>`;
}
function scanListHTML(q){
  const all=Object.keys(GTINDB).map(k=>GTINDB[k]);
  if(!all.length){ return `<div class="empty"><div class="ei">🏷️</div><h3>Noch keine Produkte</h3><p>${scannerSupported()?'Tippe auf „📷 Etikett scannen" und halte die Kamera an den Barcode auf der Verpackung.':'Es wurden noch keine Produkte erfasst.'}</p></div>`; }
  const list=filterGtin(all,q);
  if(!list.length){ return `<div class="empty"><div class="ei">🔍</div><h3>Kein Treffer</h3><p>„${esc(q)}" ist nicht in der Produktdatenbank.</p></div>`; }
  return gtinGroups(list).map(g=>`<div class="grp">${esc(g.hersteller)}</div>`+g.items.map(scanRowHTML).join('')).join('');
}
function scanSearch(q){ const box=$('gtinList'); if(box) box.innerHTML=scanListHTML(q); }
function badgeSpans(pairs){ return pairs.map(b=>`<span class="size-badge"><span class="st">${esc(b[0])}</span>${esc(b[1])}</span>`).join(''); }
function scanRowHTML(r){
  const badges=(typeof sizeBadges==='function')?sizeBadges(matSizeList(r)):badgeSpans(gtinBadges(r));
  const sub=[r.ref?('REF '+r.ref):'', r.gtin?('GTIN '+r.gtin):''].filter(Boolean).join(' · ');
  const thumb=r.photo?`<div class="mat-thumb"><img src="${esc(r.photo)}" alt=""></div>`:`<div class="mat-thumb">🏷️</div>`;
  return `<div class="mat-row" data-g="${esc(r.gtin)}" onclick="openScanItem(this.dataset.g,false)">${thumb}<div class="mat-main"><div class="mat-name">${esc(r.name||r.ref||r.gtin||'Produkt')}</div><div class="mat-sub"><span class="gtin-mono">${esc(sub)}</span></div>${badges?`<div class="e-meta" style="margin-top:6px">${badges}</div>`:''}</div></div>`;
}
/* Wohin führt das ‹ aus dem Produktblatt/Editor zurück?

   Das Produktblatt ist von SECHS Stellen aus erreichbar: Materialzentrale,
   Scan-Hub, Katalog, Verwaltung, dem Material-Badge an einem Eintrag und dem
   Schnellmenü im Standard. „Zurück" heißt je nachdem etwas anderes — deshalb
   wird die Herkunft beim ÖFFNEN festgehalten, statt sie hinterher zu raten.

   Vorher lief die Rückkehr in eine Sackgasse: goBack() prüfte auf einen
   Bildschirm (`scr-care-item`), der nie aktiv wird, und kehrte wirkungslos
   zurück. Der ‹-Knopf war sichtbar und tat nichts. */
let scanHerkunft = null;

function scanMerkeHerkunft(){
  const akt = document.querySelector('.screen.active');
  const id = akt ? akt.id : '';
  /* Wechsel zwischen Ansicht und Bearbeiten: die ursprüngliche Herkunft gilt weiter. */
  if(id==='scr-scan-item') return;
  if(id==='scr-scan') scanHerkunft='hub';
  else if(id==='scr-care') scanHerkunft='zentrale';
  else if(id==='scr-catalog') scanHerkunft='katalog';
  else if(id==='scr-detail'||id==='scr-rubriken') scanHerkunft='standard';
  else if(id==='scr-admin') scanHerkunft='verwaltung';
  else scanHerkunft = (typeof mode!=='undefined' && mode==='care') ? 'zentrale' : 'uebersicht';
}

/* Führt die Rückkehr aus. Gibt true zurück, wenn sie behandelt wurde. */
function scanZurueck(){
  switch(scanHerkunft){
    case 'hub':
      if(typeof openScanHub==='function'){ openScanHub(); return true; }
      break;
    case 'katalog':
      if(typeof setMode==='function'){ setMode('catalog'); return true; }
      break;
    case 'verwaltung':
      if(typeof setMode==='function'){ setMode('admin'); return true; }
      break;
    case 'standard': {
      /* Zurück in den Standard, aus dem heraus geöffnet wurde. */
      const top=(typeof nav!=='undefined' && nav.length)?nav[nav.length-1]:null;
      if(top && top.lvl==='rub' && typeof openRubrik==='function'){ openRubrik(top.idx,true); return true; }
      if(top && top.lvl==='std' && typeof openStandard==='function' && typeof curStd!=='undefined' && curStd){
        openStandard(curStd.id,true); return true; }
      if(typeof setMode==='function'){ setMode('use'); return true; }
      break;
    }
    case 'uebersicht':
      if(typeof setMode==='function'){ setMode('use'); return true; }
      break;
  }
  /* Vorgabe: die Materialzentrale — von dort kommt der Weg am häufigsten. */
  if(typeof renderMatCenter==='function'){
    mode='care'; renderMatCenter(); show('scr-care');
    if(typeof updateBar==='function') updateBar();
    return true;
  }
  return false;
}

function openScanItem(gArg, edit){
  if(edit && !ADMIN){ promptLoginThen(()=>openScanItem(gArg,true)); return; }
  scanMerkeHerkunft();
  scanPendingLinkKey=null;   /* direkter Aufruf ist keine „lege-neu-und-verknüpfe"-Aktion */
  const key=gArg?gtinKey(gArg):'';
  const r = key ? (GTINDB[key]||{gtin:key}) : {gtin:''};
  if(edit) renderScanItemForm(r); else renderScanItemView(r);
  show('scr-scan-item');
  setBar(r.name||r.ref||(key?('GTIN '+key):'Neues Produkt'), edit?'Bearbeiten':'Produkt', true);
}
/* Fotos in der Produktansicht: das erste groß, die weiteren als antippbare
   Streifen-Vorschau. Jedes Bild trägt [data-zoom] → Lightbox (features/lightbox.js). */
function scanViewGalerieHTML(r){
  const fotos=matPhotos(r);
  if(!fotos.length) return '';
  const haupt=fotos[0];
  const weitere=fotos.slice(1).map((f,i)=>`<img class="gal-strip-img" src="${esc(f.src)}" alt="${esc(f.titel||('Foto '+(i+2)))}" data-zoom data-cap="${esc(f.titel||'')}">`).join('');
  return `<div class="gal-view">
    <div class="gal-view-main"><img src="${esc(haupt.src)}" alt="${esc(haupt.titel||'Produktfoto')}" data-zoom data-cap="${esc(haupt.titel||'')}"></div>
    ${haupt.titel?`<div class="gal-cap-view">${esc(haupt.titel)}</div>`:''}
    ${weitere?`<div class="gal-strip">${weitere}</div>`:''}
    ${fotos.length>1?`<div class="gal-hint">${fotos.length} Fotos · antippen zum Vergrößern</div>`:''}
  </div>`;
}
function renderScanItemView(r){
  const badges=(typeof sizeBadges==='function')?sizeBadges(matSizeList(r)):badgeSpans(gtinBadges(r));
  const rows=[
    ['Hersteller', r.hersteller],
    ['Kategorie', r.kategorie],
    ['REF / Bestellnr.', r.ref],
    ['Verwendung', r.verwendung],
    ['Hinweis / Bedingung', r.hinweis],
    ['Alternative', r.alternative],
  ].concat((typeof MATPROPS!=='undefined'?MATPROPS:[]).map(p=>[p.label, r.props&&r.props[p.key]]))
   .concat([
    ['Lagerort', r.lagerort],
    ['Stückpreis', (r.preis!=null?fmtEUR(r.preis):'')],
  ]).filter(x=>x[1]).map(x=>`<div class="info-field"><div class="if-l">${esc(x[0])}</div><div class="if-v">${esc(x[1])}</div></div>`).join('');
  const rescan = scannerSupported()?`<div class="p-actions" style="margin-top:10px"><button class="btn btn-sec" onclick="startCam()">📷 Nächstes scannen</button></div>`:'';
  $('scr-scan-item').innerHTML=`<div class="pcard">
    <div class="pc-name">${esc(r.name||r.ref||'Produkt')}</div>
    <div class="pc-ctx">${r.manual?'Manueller Stammsatz':`<span class="gtin-mono">GTIN ${esc(r.gtin)}</span>`}</div>
    ${scanViewGalerieHTML(r)}
    ${badges?`<div class="info-field"><div class="if-l">Maße</div><div class="if-v">${badges}</div></div>`:''}
    ${rows}
    ${scanMerkViewHTML(r)}
    ${(typeof catInfoBlockHTML==='function')?catInfoBlockHTML(r):''}
    <div class="p-actions"><button class="btn btn-sec" onclick="openScanHub()">Zur Liste</button><button class="btn btn-pri" data-g="${esc(r.gtin)}" onclick="openScanItem(this.dataset.g,true)">Bearbeiten</button></div>
    ${rescan}
  </div>`;
}
function renderScanItemForm(r){
  const g=r.gtin||'';
  scanGalerie=matPhotos(r);                    /* Fotoliste in den Editor laden */
  const refHint=(!r.ref && lastScanInfo && lastScanInfo.gtin===g && lastScanInfo.itemRef)?lastScanInfo.itemRef:'';
  const del=(g && GTINDB[g])?`<div class="p-actions" style="margin-top:10px"><button class="btn btn-sec" style="color:#d64545" data-g="${esc(g)}" onclick="deleteScanItem(this.dataset.g)">Aus Datenbank löschen</button></div>`:'';
  $('scr-scan-item').innerHTML=`<div class="pcard">
    <div class="pc-name">${r.manual?'Material-Stammsatz (ohne Barcode)':(g?('GTIN '+esc(g)):'Neues Produkt')}</div>
    <div class="scope-note">🎯 Gilt für <b>dieses Material überall</b> – in jedem Standard, in dem es vorkommt. Was nur an EINER Stelle anders sein soll (z. B. die Menge), gehört an den Eintrag.</div>
    ${g?'':`<div class="flabel">GTIN (Barcode-Nummer) *</div><input class="loc-input" id="scGtin" inputmode="numeric" placeholder="z. B. 04012345678901" value="">`}
    <button type="button" class="scan-cta ocr-cta" onclick="ocrWizStart()">📸 Geführte Erfassung – Barcode &amp; Etikett</button>
    <div class="ocr-hint">Führt in zwei Schritten durch die Aufnahme: erst der Barcode (Produktnummer exakt, ohne Texterkennung), dann das Etikett (REF, Hersteller, Maße). Ein Foto genügt auch. Alle Werte bitte prüfen.</div>
    <div class="p-actions" style="margin-top:4px"><button type="button" class="btn btn-sec" onclick="ocrCaptureAndFill()">Nur ein Etikett-Foto lesen</button></div>
    <div class="flabel" style="margin-top:12px">FOTOS</div>
    <div id="scGallery">${scanGalerieHTML()}</div>
    <input type="file" id="scanFileInp" accept="image/*" multiple style="display:none" onchange="scanOnPhoto(event)">
    <p class="hint">Beliebig viele Fotos: Verpackung, Etikett, ausgepacktes Produkt, Anschluss, Regalplatz. Das erste Bild ist das Vorschaubild in allen Listen; jedes Bild lässt sich antippen und vergrößern.</p>
    <div class="flabel" style="margin-top:12px">HERSTELLER *</div><input class="loc-input" id="scHersteller" placeholder="z. B. Terumo" value="${esc(r.hersteller||'')}">
    <div class="flabel">REF / BESTELLNR. *</div><input class="loc-input" id="scRef" placeholder="z. B. RM*RG5J40" value="${esc(r.ref||refHint||'')}" oninput="if(typeof catCheckForm==='function')catCheckForm()">
    <div id="catMatch" style="display:none"></div>
    <input type="hidden" id="catHold" value="${r.katspecs?esc(JSON.stringify({specs:r.katspecs,ref:r.katref||'',quelle:r.katquelle||'',status:r.katstatus||'unbestätigt'})):''}">
    <div class="flabel">KATEGORIE</div><input class="loc-input" id="scKat" placeholder="z. B. Schleuse / Introducer" value="${esc(r.kategorie||'')}" list="catKatList">
    <datalist id="catKatList">${(typeof MATCAT_KATS!=='undefined'?MATCAT_KATS:[]).map(k=>`<option value="${esc(k)}">`).join('')}</datalist>
    <div class="flabel">PRODUKTNAME</div><input class="loc-input" id="scName" placeholder="z. B. Radialschleuse 6F" value="${esc(r.name||'')}">
    <div class="flabel">VERWENDUNG</div><input class="loc-input" id="scVerw" placeholder="z. B. radialer Zugang" value="${esc(r.verwendung||'')}">
    <div class="flabel" style="margin-top:12px">MASSE / GRÖSSEN</div>
    <div id="scSizes">${matSizeList(r).map(scSizeRowHTML).join('')}</div>
    <button type="button" class="add-btn" onclick="scanAddSize()">＋ Maß</button>
    <p class="hint">Alle Maße frei mit Typ — z. B. Stärke 4-0 · Länge 45 cm · Fr 6 · Ø 2,6 mm. Ersetzt die früheren Einzelfelder; gilt für das ganze Material.</p>
    <div id="scProps">${MATPROPS.map(p=>`<div class="flabel">${esc((p.label||'').toUpperCase())}</div><input class="loc-input" data-pk="${esc(p.key)}" value="${esc((r.props&&r.props[p.key])||'')}">`).join('')}</div>
    <div class="p-actions" style="margin-top:8px"><button type="button" class="btn btn-sec" onclick="scanAddPropUI()">＋ Eigenschaft (z. B. Tip Load)</button></div>
    <div class="form-row" id="scNewPropRow" style="display:none;margin-top:8px"><input class="loc-input" id="scNewPropInp" placeholder="Name der Eigenschaft"><button type="button" class="add-btn" onclick="scanAddPropSave()">Anlegen</button></div>
    ${scanMerkFormHTML(r)}
    <div class="flabel" style="margin-top:12px">LAGERORT</div><input class="loc-input" id="scLoc" placeholder="z. B. Regal A · Fach 3" value="${esc(r.lagerort||'')}">
    <div class="flabel">STÜCKPREIS € (optional)</div><input class="loc-input" id="scPreis" inputmode="decimal" placeholder="z. B. 12,50" value="${esc(r.preis!=null?String(r.preis).replace('.',','):'')}">
    <div class="p-actions"><button class="btn btn-sec" onclick="openScanHub()">Abbrechen</button><button class="btn btn-pri" data-g="${esc(g)}" onclick="saveScanItem(this.dataset.g)">Speichern</button></div>
    ${del}
  </div>
  <div class="foot">Die GTIN kommt aus dem Barcode und ist der Schlüssel: REF, Hersteller und Maße einmal erfassen — bei jedem weiteren Scan sind sie sofort da. Alles wird zentral gespeichert und auf allen Geräten geteilt.</div>`;
  if(typeof catCheckForm==='function') catCheckForm();   /* Referenz-Katalog: Treffer zur vorhandenen REF gleich anzeigen */
}
/* Eigene Eigenschaft (Schema-erweiternd, z. B. „Tip Load") anlegen — erscheint
   danach bei JEDEM Produkt als Feld. Inline-Zeile statt prompt(). */
function scanAddPropUI(){ const r=$('scNewPropRow'); if(!r) return; r.style.display='';
  const i=$('scNewPropInp'); if(i){ i.focus(); i.onkeydown=(e)=>{ if(e.key==='Enter'){ e.preventDefault(); scanAddPropSave(); } }; } }
function scanAddPropSave(){ const i=$('scNewPropInp'); const label=(i&&i.value||'').trim(); if(!label) return;
  const key=matPropAdd(label); const box=$('scProps');
  if(box && !box.querySelector('[data-pk="'+key+'"]')){ box.insertAdjacentHTML('beforeend', `<div class="flabel">${esc(label.toUpperCase())}</div><input class="loc-input" data-pk="${esc(key)}" value="">`); }
  const row=$('scNewPropRow'); if(row){ row.style.display='none'; if(i) i.value=''; }
  toast('Eigenschaft „'+label+'" angelegt – erscheint jetzt bei jedem Produkt'); }
function scanReadProps(){ const props={}; document.querySelectorAll('#scProps input[data-pk]').forEach(el=>{ const v=(el.value||'').trim(); if(v) props[el.dataset.pk]=v; }); return props; }
/* Maß-Zeilen des Material-Editors (eine typisierte Größenliste — dasselbe Muster
   wie beim Eintrag, damit es EIN Maß-System gibt). */
function scSizeRowHTML(g){ const types=(typeof SIZE_TYPES!=='undefined')?SIZE_TYPES:['dimension'];
  const opts=types.map(t=>`<option value="${esc(t)}" ${g&&g.typ===t?'selected':''}>${esc(typeof sizeLabel==='function'?sizeLabel(t):t)}</option>`).join('');
  return `<div class="form-row merk-row" style="margin-bottom:8px"><select class="form-sel merk-typ" style="flex:0 0 96px">${opts}</select><input class="loc-input merk-wert" placeholder="z. B. 6F, 45cm, 4-0" value="${esc(g?g.wert:'')}"><button type="button" class="merk-del" style="flex:0 0 44px;border-radius:10px;border:1px solid var(--line);background:var(--surface-2);color:var(--text)" onclick="this.closest('.merk-row').remove()" aria-label="Maß entfernen">✕</button></div>`; }
function scanAddSize(){ const box=$('scSizes'); if(box) box.insertAdjacentHTML('beforeend', scSizeRowHTML(null)); }
function scanReadSizes(){ const box=$('scSizes'); if(!box) return [];
  return [...box.querySelectorAll('.merk-row')].map(r=>({typ:(r.querySelector('.merk-typ').value||'dimension'),wert:r.querySelector('.merk-wert').value.trim()})).filter(g=>g.wert).map(g=>({typ:g.typ,wert:g.wert,roh:g.wert})); }
/* ===== Fotogalerie im Editor ===== */
function _scanShrink(d,cb){ if(typeof shrinkPhoto==='function') shrinkPhoto(d,cb); else cb(d); }
/* Kachelraster: erstes Bild trägt die Marke „Vorschau". */
function scanGalerieHTML(){
  const kacheln=scanGalerie.map((f,i)=>`<div class="gal-item">
      <img src="${esc(f.src)}" alt="${esc(f.titel||('Foto '+(i+1)))}" data-zoom data-cap="${esc(f.titel||'')}">
      ${i===0?'<span class="gal-main">Vorschau</span>':''}
      <div class="gal-tools">
        ${i>0?`<button type="button" title="Als Vorschaubild" aria-label="Als Vorschaubild" onclick="scanGalerieMain(${i})">★</button>`:''}
        <button type="button" title="Zuschneiden / drehen" aria-label="Zuschneiden oder drehen" onclick="scanGalerieEdit(${i})">✂</button>
        <button type="button" title="Entfernen" aria-label="Foto entfernen" onclick="scanGalerieDel(${i})">✕</button>
      </div>
      <input class="gal-cap" placeholder="Bildunterschrift (optional)" value="${esc(f.titel||'')}" oninput="scanGalerieCap(${i}, this.value)">
    </div>`).join('');
  return `<div class="gal-grid">${kacheln}<button type="button" class="gal-add" onclick="$('scanFileInp').click()"><span class="ph-ico">📷</span><span class="ph-sub">Foto hinzufügen</span></button></div>`;
}
function scanGalerieRender(){ const box=$('scGallery'); if(box) box.innerHTML=scanGalerieHTML(); }
/* Ein Bild anhängen. Es erscheint SOFORT in der Galerie (sonst wirkt die App
   beim Hinzufügen träge) und wird im Hintergrund verkleinert — das Verkleinern
   braucht einen Bild-Ladevorgang und wäre sonst ein Wettlauf mit dem
   Speichern-Knopf. */
function scanGalerieAdd(src, titel){
  const vorher=scanGalerie.length;
  scanGalerie=matPhotoAdd(scanGalerie, src, titel);
  if(scanGalerie.length===vorher) return;              /* Dublette – nichts zu tun */
  const i=scanGalerie.length-1;
  scanGalerieRender();
  _scanShrink(src,(klein)=>{ const f=scanGalerie[i];
    if(f && f.src===src && klein && klein!==src){ f.src=klein; scanGalerieRender(); } });
}
/* Mehrere Bilder anhängen (z. B. die Aufnahmen des geführten Dialogs). */
function scanGalerieAddMany(list, titel){ (list||[]).filter(Boolean).forEach(src=>scanGalerieAdd(src, titel)); }
function scanGalerieDel(i){ scanGalerie=matPhotoDel(scanGalerie,i); scanGalerieRender(); }
function scanGalerieMain(i){ scanGalerie=matPhotoMain(scanGalerie,i); scanGalerieRender(); }
function scanGalerieCap(i, v){ if(scanGalerie[i]) scanGalerie[i].titel=(v||'').trim(); }
function scanGalerieEdit(i){ const f=scanGalerie[i]; if(!f) return;
  openPhotoEditor(f.src,(edited)=>{ if(edited==null) return; _scanShrink(edited,(klein)=>{ scanGalerie[i]={src:klein,titel:f.titel||''}; scanGalerieRender(); }); }); }
/* Mehrfachauswahl aus der Dateiauswahl: jedes Bild einzeln durch den
   Foto-Editor zu schicken wäre eine Zumutung — nur bei EINEM Bild wird der
   Editor geöffnet, mehrere wandern direkt in die Galerie (dort einzeln
   nachbearbeitbar). */
function scanOnPhoto(ev){
  const files=[...((ev.target&&ev.target.files)||[])]; if(!files.length) return;
  try{ ev.target.value=''; }catch(e){}
  if(files.length===1){
    const r=new FileReader();
    r.onload=()=>{ openPhotoEditor(r.result,(edited)=>{ if(edited==null) return; scanGalerieAdd(edited); }); };
    r.readAsDataURL(files[0]); return;
  }
  const bilder=[]; let i=0;
  (function step(){
    if(i>=files.length){ scanGalerieAddMany(bilder); return; }
    const r=new FileReader(); r.onload=()=>{ bilder.push(r.result); i++; step(); }; r.onerror=()=>{ i++; step(); };
    r.readAsDataURL(files[i]);
  })();
}
/* Vorschaubild = erstes Bild der Galerie (Kompatibilität zu `photo`). */
function scanCurrentPhoto(){ return (scanGalerie[0]&&scanGalerie[0].src)||null; }
/* Von der OCR/vom Assistenten aufgerufen, wenn dort ein Foto entstanden ist. */
function scanSetPhoto(photo){ scanGalerieAdd(photo); }
function saveScanItem(gArg){
  if(!ADMIN){ promptLoginThen(()=>saveScanItem(gArg)); return; }
  let g=gArg?gtinKey(gArg):'';
  if(!g){ const gi=$('scGtin'); g=gi?gtinKey(gi.value.trim()):''; }
  /* Manueller Stammsatz (Schlüssel „m:…") braucht keine GTIN — er wird über
     Name/REF identifiziert (Material-Destillation ohne Barcode). */
  const manual=/^m:/.test(g);
  if(!manual && (!g || !/^\d{8,}$/.test(g))){ toast('Bitte eine gültige GTIN (Barcode-Nummer, nur Ziffern) angeben.',true); return; }
  const val=(id)=>{ const el=$(id); return el?el.value.trim():''; };
  const hersteller=val('scHersteller'), ref=val('scRef');
  if(manual){ if(!val('scName') && !hersteller && !ref){ toast('Bitte mindestens einen Produktnamen (oder Hersteller/REF) angeben.',true); return; } }
  else if(!hersteller && !ref){ toast('Bitte mindestens Hersteller oder REF angeben.',true); return; }
  const preis=parsePreis(val('scPreis'));
  const patch={ gtin:g, hersteller:hersteller||null, ref:ref||null, name:val('scName')||null, verwendung:val('scVerw')||null,
    kategorie:val('scKat')||null,
    groessen:scanReadSizes(),
    /* Alt-Einzelfelder auf null: sie sind jetzt in der Maßliste (matSizeList) aufgegangen. */
    french:null, laenge:null, dAussen:null, dInnen:null, weitere:null,
    lagerort:val('scLoc')||null, preis:(preis==null?null:preis),
    fotos:scanGalerie.slice(), photo:scanCurrentPhoto(), props:scanReadProps() };
  /* Merkmale (typisiert, je Materialklasse). Unplausible Werte werden gemeldet,
     aber NICHT abgelehnt: Das Etikett ist die Wirklichkeit, der Katalog nur
     unsere Erwartung. Wer eine 300-cm-Schleuse hat, soll sie eintragen können. */
  if(scanMerkBereit()){
    const kl=$('scMerkKlasse'); const mw=scanReadMerkmale();
    patch.klasse = (kl && kl.value) || null;
    patch.merkmale = Object.keys(mw).length ? mw : null;
    const mahn = merkPruefe(mw, patch.klasse, MERKKAT);
    if(mahn.length) toast(mahn[0].text + (mahn.length>1?(' (und '+(mahn.length-1)+' weitere)'):''), true);
  }
  /* LERNSCHLEIFE: Hat die OCR gerade etwas anderes gelesen als hier gespeichert
     wird, merkt sich die App das Paar — beim nächsten Mal trifft sie sofort.
     Genau das macht die Erkennung auch bei Produkten besser, die in KEINEM
     Katalog stehen. */
  ocrLearnFromSave(ref);
  /* Referenz-Katalog: übernommene Plattform-Specs (unbestätigt) am Stammsatz sichern. */
  const kh=(typeof catReadHold==='function')?catReadHold():null;
  if(kh && kh.specs && Object.keys(kh.specs).length){
    patch.katspecs=kh.specs; patch.katref=kh.ref||null; patch.katquelle=kh.quelle||null;
    /* fachwort:ok — 'bestätigt' ist der feste Wert aus data/material_catalog.json,
       keine Anzeige-Bezeichnung (vgl. matcatalog.js). */
    patch.katstatus=(GTINDB[g]&&GTINDB[g].katstatus==='bestätigt')?'bestätigt':(kh.status||'unbestätigt');
  }
  GTINDB[g]=mergeGtinRecord(GTINDB[g], patch, new Date().toISOString());
  saveGtinDB();
  if(typeof refInvalidateIndex==='function') refInvalidateIndex();   /* neue REF ist ab sofort auflösbar */
  /* Aus der Materialverwaltung „neu angelegt" → jetzt (erst beim Speichern, nicht
     schon beim Öffnen) das Vorkommen mit dem Stammsatz verknüpfen. */
  if(scanPendingLinkKey && typeof matLinkTo==='function'){ matLinkTo(scanPendingLinkKey, g); scanPendingLinkKey=null; if(typeof buildMaterialIndex==='function') buildMaterialIndex(); }
  toast('Produkt gespeichert');
  setTimeout(()=>{ openScanHub(); }, 500);
}
function deleteScanItem(gArg){
  if(!ADMIN){ promptLoginThen(()=>deleteScanItem(gArg)); return; }
  const g=gtinKey(gArg); const r=GTINDB[g]; if(!r) return;
  if(!confirm('Produkt „'+(r.name||r.ref||g)+'" endgültig aus der Datenbank löschen?')) return;
  delete GTINDB[g]; saveGtinDB(); toast('Produkt gelöscht'); openScanHub();
}

/* ═══ MERKMALE am Produkt — Anzeige und Editor ═══════════════════
   Der Merkmalskatalog (features/merkmale.js + data/merkmale.json) bekommt hier
   seinen Platz in der Oberfläche. Bis dahin lagen typisierte Eigenschaften
   nirgends: „6 F · EBU 4.0 · mit Seitenlöchern" passte in kein Feld.
   Fehlt der Katalog (Datei nicht geladen), erscheint der Block gar nicht —
   die Maske bleibt genau wie vorher. */

/* Ist der Merkmalskatalog verfügbar? */
function scanMerkBereit(){
  return typeof MERKKAT!=='undefined' && MERKKAT && Array.isArray(MERKKAT.merkmale) && MERKKAT.merkmale.length>0;
}

/* Anzeige im Produktblatt: Leitmerkmale als Badges, Warnmerkmale rot,
   darunter die Lückenliste als Arbeitsauftrag. */
function scanMerkViewHTML(r){
  if(!scanMerkBereit() || !r) return '';
  const liste = merkAusSatz(r, MERKKAT);
  const klasse = r.klasse || '';
  if(!liste.length && !klasse) return '';
  const kl = (MERKKAT.klassen||[]).filter(k=>k.id===klasse)[0];
  const zeilen = liste.map(m=>{
    const wert = esc(String(m.wert) + (m.einheit?(' '+m.einheit):''));
    const warn = m.warnung ? ' style="color:#d64545;font-weight:600"' : '';
    return `<div class="info-field"><div class="if-l">${esc(m.label)}</div><div class="if-v"${warn}>${wert}</div></div>`;
  }).join('');
  const luecken = klasse ? merkLuecken(klasse, liste, MERKKAT) : [];
  const luHtml = luecken.length
    ? `<p class="hint">Noch nicht erfasst: ${esc(luecken.map(l=>l.label).join(' · '))}</p>` : '';
  return `<div class="flabel" style="margin-top:12px">MERKMALE${kl?(' · '+esc(kl.label)):''}</div>${zeilen||'<p class="hint">Noch keine Merkmale erfasst.</p>'}${luHtml}`;
}

/* Ein Eingabefeld je Merkmal — passend zum Typ. Geschlossene Wertelisten und
   Ja/Nein bekommen eine Auswahl, damit gar nicht erst Schreibvarianten
   entstehen; alles andere ein Textfeld mit Einheit als Platzhalter. */
function scanMerkFeldHTML(d, wert){
  const v = (wert==null?'':String(wert));
  const kopf = `<div class="flabel">${esc((d.label||'').toUpperCase())}${d.einheit?(' <span style="opacity:.6">('+esc(d.einheit)+')</span>'):''}</div>`;
  if(d.typ==='ja_nein'){
    return kopf+`<select class="form-sel merk-f" data-mid="${esc(d.id)}">
      <option value=""${v===''?' selected':''}>— unbekannt —</option>
      <option value="ja"${v==='ja'?' selected':''}>ja</option>
      <option value="nein"${v==='nein'?' selected':''}>nein</option></select>`;
  }
  if(d.typ==='liste' && Array.isArray(d.werte) && d.werte.length){
    const opts = d.werte.map(w=>`<option value="${esc(w)}"${v===w?' selected':''}>${esc(w)}</option>`).join('');
    const fremd = (v && d.werte.indexOf(v)<0) ? `<option value="${esc(v)}" selected>${esc(v)}</option>` : '';
    return kopf+`<select class="form-sel merk-f" data-mid="${esc(d.id)}"><option value="">— unbekannt —</option>${opts}${fremd}</select>`;
  }
  const ph = d.einheit ? ('z. B. 6 (in '+d.einheit+')') : '';
  return kopf+`<input class="loc-input merk-f" data-mid="${esc(d.id)}" placeholder="${esc(ph)}" value="${esc(v)}">`;
}

/* Die Felder zur gewählten Klasse. Getrennt in Leitmerkmale (stehen offen)
   und allgemeine Angaben (steril, Latex, CE … — zugeklappt), sonst scrollt
   man sich bei jedem Produkt durch zwanzig Felder. */
function scanMerkFelderHTML(klasseId, werte){
  if(!scanMerkBereit()) return '';
  const w = werte||{};
  const defs = merkFuerKlasse(MERKKAT, klasseId||'allgemein');
  const vorn = defs.filter(d=>(d.rang||99) < 40);
  const hinten = defs.filter(d=>(d.rang||99) >= 40);
  const bau = list => list.map(d=>scanMerkFeldHTML(d, w[d.id])).join('');
  const belegtHinten = hinten.some(d=>w[d.id]);
  return bau(vorn) + (hinten.length
    ? `<details class="merk-mehr"${belegtHinten?' open':''}><summary>Weitere Angaben (${hinten.length})</summary>${bau(hinten)}</details>`
    : '');
}

/* Editor-Block: Klassenwahl + Felder. Beim Wechsel der Klasse werden die
   bereits eingetippten Werte mitgenommen — niemand soll Arbeit verlieren,
   nur weil er die Klasse korrigiert. */
function scanMerkFormHTML(r){
  if(!scanMerkBereit()) return '';
  const klasse = (r&&r.klasse) || '';
  const opts = (MERKKAT.klassen||[]).filter(k=>k.id!=='allgemein')
    .map(k=>`<option value="${esc(k.id)}"${k.id===klasse?' selected':''}>${esc(k.label)}</option>`).join('');
  return `<div class="flabel" style="margin-top:12px">MERKMALE</div>
    <select class="form-sel" id="scMerkKlasse" onchange="scanMerkKlasseWechsel()">
      <option value="">— Materialklasse wählen —</option>${opts}</select>
    <p class="hint">Die Klasse bestimmt, welche Merkmale gefragt sind: ein Draht hat keine Kurvenform, eine Kompresse keinen Berstdruck. Leer lassen ist erlaubt — dann erscheinen nur die allgemeinen Angaben.</p>
    <div id="scMerkFelder">${scanMerkFelderHTML(klasse, (r&&r.merkmale)||{})}</div>`;
}
function scanMerkKlasseWechsel(){
  const sel=$('scMerkKlasse'), box=$('scMerkFelder');
  if(!sel||!box) return;
  box.innerHTML = scanMerkFelderHTML(sel.value, scanReadMerkmale());
}
/* Alle ausgefüllten Merkmalsfelder einsammeln. Leere Felder werden NICHT
   gespeichert — „leer" ist eine Aussage, „" ist keine. */
function scanReadMerkmale(){
  const out={};
  document.querySelectorAll('#scMerkFelder .merk-f[data-mid]').forEach(el=>{
    const v=(el.value||'').trim();
    if(v) out[el.dataset.mid]=v;
  });
  return out;
}

/* Merkmale aus dem Foto-Assistenten ins Formular übernehmen.
   Regel wie bei ocrFillForm: NUR leere Felder werden gefüllt. Was ein Mensch
   schon eingetragen hat, bleibt unangetastet — Abweichungen werden gemeldet,
   nicht aufgelöst (merkAbgleich).
   Rückgabe: { klasse, gefuellt:[…], abweichend:[…] } */
function scanMerkUebernehmen(merk){
  if(!scanMerkBereit() || !merk) return { klasse:null, gefuellt:[], abweichend:[] };
  const sel=$('scMerkKlasse');
  if(!sel) return { klasse:null, gefuellt:[], abweichend:[] };

  /* Klasse nur setzen, wenn noch keine gewählt ist. Eine vom Menschen
     gewählte Klasse ist eine Entscheidung, kein Vorschlag. */
  let klasse = sel.value;
  if(!klasse && merk.klasse && merk.klasse!=='allgemein'){
    klasse = merk.klasse; sel.value = klasse;
    /* Felder der neuen Klasse aufbauen, dabei Eingetipptes mitnehmen. */
    const box=$('scMerkFelder');
    if(box) box.innerHTML = scanMerkFelderHTML(klasse, scanReadMerkmale());
  }

  /* Abgleich gegen das, was im Formular schon steht. */
  const vorhanden = scanReadMerkmale();
  const ab = merkAbgleich(merk.merkmale||[], vorhanden);
  const gefuellt=[];
  ab.uebernehmen.forEach(m=>{
    const el=document.querySelector('#scMerkFelder .merk-f[data-mid="'+m.id+'"]');
    if(!el) return;                                  /* Merkmal gehört nicht zur Klasse */
    if((el.value||'').trim()) return;                /* doppelt gesichert: nie überschreiben */
    el.value = String(m.wert);
    gefuellt.push(m.label);
  });
  return { klasse: klasse||null, gefuellt: gefuellt, abweichend: ab.abweichend };
}
