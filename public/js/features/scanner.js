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
                      lagerort, preis, createdAt, updatedAt }
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

/* Verfallsstatus relativ zu heute: ''(kein Datum) | 'expired' | 'soon'(≤90 T) |
   'ok'. todayStr optional (YYYY-MM-DD) — reine Funktion für Tests. */
function expiryStatus(dateStr, todayStr){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dateStr||'')) return '';
  const t=/^\d{4}-\d{2}-\d{2}$/.test(todayStr||'')?todayStr:new Date().toISOString().slice(0,10);
  if(dateStr<t) return 'expired';
  const days=(Date.parse(dateStr+'T00:00:00Z')-Date.parse(t+'T00:00:00Z'))/86400000;
  if(days<=90) return 'soon';
  return 'ok';
}

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

/* ===== Zustand ===== */
let GTINDB=loadJSON('hkl_gtin',{}); function saveGtinDB(){ saveJSON('hkl_gtin',GTINDB); }
let lastScanInfo=null;                              /* transiente Info des letzten Scans (LOT/Verfall/Serie) */
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
  if(n==='NotAllowedError'||n==='SecurityError') return 'Kamerazugriff blockiert. In den Website-Einstellungen des Browsers (🔒-Symbol neben der Adresse bzw. „Website-Einstellungen“) Kamera erlauben und erneut versuchen.';
  if(n==='NotFoundError'||n==='OverconstrainedError') return 'Keine passende Kamera gefunden. Gerät ohne Rückkamera? Unten manuell suchen/anlegen.';
  if(n==='NotReadableError'||n==='TrackStartError') return 'Kamera wird gerade von einer anderen App oder einem anderen Tab benutzt. Diese schließen und erneut versuchen.';
  if(!location.protocol.startsWith('https')&&location.hostname!=='localhost') return 'Kamera braucht eine sichere Verbindung (https). Bitte über https aufrufen.';
  return 'Kamera nicht freigegeben oder nicht verfügbar (' + (n||'unbekannter Fehler') + ').';
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
      catch(e2){ toast(camErrorMessage(e2),true); return; }
    } else { toast(camErrorMessage(e),true); return; }
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
  showSheet(false); formCtx=null; mode='use'; nav=[];
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
  $('scr-scan').innerHTML = cta + manual + search + `<div id="gtinList">${scanListHTML(q)}</div>`;
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
  const badges=badgeSpans(gtinBadges(r));
  const sub=[r.ref?('REF '+r.ref):'', r.gtin?('GTIN '+r.gtin):''].filter(Boolean).join(' · ');
  return `<div class="mat-row" data-g="${esc(r.gtin)}" onclick="openScanItem(this.dataset.g,false)"><div class="mat-thumb">🏷️</div><div class="mat-main"><div class="mat-name">${esc(r.name||r.ref||r.gtin||'Produkt')}</div><div class="mat-sub"><span class="gtin-mono">${esc(sub)}</span></div>${badges?`<div class="e-meta" style="margin-top:6px">${badges}</div>`:''}</div></div>`;
}
function openScanItem(gArg, edit){
  if(edit && !ADMIN){ promptLoginThen(()=>openScanItem(gArg,true)); return; }
  const key=gArg?gtinKey(gArg):'';
  const r = key ? (GTINDB[key]||{gtin:key}) : {gtin:''};
  if(edit) renderScanItemForm(r); else renderScanItemView(r);
  show('scr-scan-item');
  setBar(r.name||r.ref||(key?('GTIN '+key):'Neues Produkt'), edit?'Bearbeiten':'Produkt', true);
}
function renderScanItemView(r){
  const badges=badgeSpans(gtinBadges(r));
  const rows=[
    ['Hersteller', r.hersteller],
    ['REF / Bestellnr.', r.ref],
    ['Verwendung', r.verwendung],
    ['Lagerort', r.lagerort],
    ['Stückpreis', (r.preis!=null?fmtEUR(r.preis):'')],
  ].filter(x=>x[1]).map(x=>`<div class="info-field"><div class="if-l">${esc(x[0])}</div><div class="if-v">${esc(x[1])}</div></div>`).join('');
  const rescan = scannerSupported()?`<div class="p-actions" style="margin-top:10px"><button class="btn btn-sec" onclick="startCam()">📷 Nächstes scannen</button></div>`:'';
  $('scr-scan-item').innerHTML=`<div class="pcard">
    <div class="pc-name">${esc(r.name||r.ref||'Produkt')}</div>
    <div class="pc-ctx"><span class="gtin-mono">GTIN ${esc(r.gtin)}</span></div>
    ${badges?`<div class="info-field"><div class="if-l">Maße</div><div class="if-v">${badges}</div></div>`:''}
    ${rows}
    <div class="p-actions"><button class="btn btn-sec" onclick="openScanHub()">Zur Liste</button><button class="btn btn-pri" data-g="${esc(r.gtin)}" onclick="openScanItem(this.dataset.g,true)">Bearbeiten</button></div>
    ${rescan}
  </div>`;
}
function renderScanItemForm(r){
  const g=r.gtin||'';
  const refHint=(!r.ref && lastScanInfo && lastScanInfo.gtin===g && lastScanInfo.itemRef)?lastScanInfo.itemRef:'';
  const del=(g && GTINDB[g])?`<div class="p-actions" style="margin-top:10px"><button class="btn btn-sec" style="color:#d64545" data-g="${esc(g)}" onclick="deleteScanItem(this.dataset.g)">Aus Datenbank löschen</button></div>`:'';
  $('scr-scan-item').innerHTML=`<div class="pcard">
    <div class="pc-name">${g?('GTIN '+esc(g)):'Neues Produkt'}</div>
    ${g?'':`<div class="flabel">GTIN (Barcode-Nummer) *</div><input class="loc-input" id="scGtin" inputmode="numeric" placeholder="z. B. 04012345678901" value="">`}
    <button type="button" class="scan-cta ocr-cta" onclick="ocrCaptureAndFill()">📸 Etikett fotografieren – Felder automatisch ausfüllen</button>
    <div class="ocr-hint">Liest REF, Hersteller und Maße direkt vom Etikett (läuft auf dem Gerät). Bitte die erkannten Werte prüfen.</div>
    <div class="flabel" style="margin-top:12px">HERSTELLER *</div><input class="loc-input" id="scHersteller" placeholder="z. B. Terumo" value="${esc(r.hersteller||'')}">
    <div class="flabel">REF / BESTELLNR. *</div><input class="loc-input" id="scRef" placeholder="z. B. RM*RG5J40" value="${esc(r.ref||refHint||'')}">
    <div class="flabel">PRODUKTNAME</div><input class="loc-input" id="scName" placeholder="z. B. Radialschleuse 6F" value="${esc(r.name||'')}">
    <div class="flabel">VERWENDUNG</div><input class="loc-input" id="scVerw" placeholder="z. B. radialer Zugang" value="${esc(r.verwendung||'')}">
    <div class="flabel" style="margin-top:12px">GRÖSSE (French)</div><input class="loc-input" id="scFrench" placeholder="z. B. 6F" value="${esc(r.french||'')}">
    <div class="flabel">LÄNGE</div><input class="loc-input" id="scLaenge" placeholder="z. B. 110 cm" value="${esc(r.laenge||'')}">
    <div class="flabel">Ø AUSSEN</div><input class="loc-input" id="scDAussen" placeholder="z. B. 2,6 mm" value="${esc(r.dAussen||'')}">
    <div class="flabel">Ø INNEN</div><input class="loc-input" id="scDInnen" placeholder="z. B. 1,8 mm" value="${esc(r.dInnen||'')}">
    <div class="flabel">WEITERE MASSE</div><input class="loc-input" id="scWeitere" placeholder="frei, z. B. Draht 0,035 Zoll" value="${esc(r.weitere||'')}">
    <div class="flabel" style="margin-top:12px">LAGERORT</div><input class="loc-input" id="scLoc" placeholder="z. B. Regal A · Fach 3" value="${esc(r.lagerort||'')}">
    <div class="flabel">STÜCKPREIS € (optional)</div><input class="loc-input" id="scPreis" inputmode="decimal" placeholder="z. B. 12,50" value="${esc(r.preis!=null?String(r.preis).replace('.',','):'')}">
    <div class="p-actions"><button class="btn btn-sec" onclick="openScanHub()">Abbrechen</button><button class="btn btn-pri" data-g="${esc(g)}" onclick="saveScanItem(this.dataset.g)">Speichern</button></div>
    ${del}
  </div>
  <div class="foot">Die GTIN kommt aus dem Barcode und ist der Schlüssel: REF, Hersteller und Maße einmal erfassen — bei jedem weiteren Scan sind sie sofort da. Alles wird zentral gespeichert und auf allen Geräten geteilt.</div>`;
}
function saveScanItem(gArg){
  if(!ADMIN){ promptLoginThen(()=>saveScanItem(gArg)); return; }
  let g=gArg?gtinKey(gArg):'';
  if(!g){ const gi=$('scGtin'); g=gi?gtinKey(gi.value.trim()):''; }
  if(!g || !/^\d{8,}$/.test(g)){ toast('Bitte eine gültige GTIN (Barcode-Nummer, nur Ziffern) angeben.',true); return; }
  const val=(id)=>{ const el=$(id); return el?el.value.trim():''; };
  const hersteller=val('scHersteller'), ref=val('scRef');
  if(!hersteller && !ref){ toast('Bitte mindestens Hersteller oder REF angeben.',true); return; }
  const preis=parsePreis(val('scPreis'));
  const patch={ gtin:g, hersteller:hersteller||null, ref:ref||null, name:val('scName')||null, verwendung:val('scVerw')||null,
    french:val('scFrench')||null, laenge:val('scLaenge')||null, dAussen:val('scDAussen')||null, dInnen:val('scDInnen')||null, weitere:val('scWeitere')||null,
    lagerort:val('scLoc')||null, preis:(preis==null?null:preis) };
  GTINDB[g]=mergeGtinRecord(GTINDB[g], patch, new Date().toISOString());
  saveGtinDB();
  toast('Produkt gespeichert');
  setTimeout(()=>{ openScanHub(); }, 500);
}
function deleteScanItem(gArg){
  if(!ADMIN){ promptLoginThen(()=>deleteScanItem(gArg)); return; }
  const g=gtinKey(gArg); const r=GTINDB[g]; if(!r) return;
  if(!confirm('Produkt „'+(r.name||r.ref||g)+'" endgültig aus der Datenbank löschen?')) return;
  delete GTINDB[g]; saveGtinDB(); toast('Produkt gelöscht'); openScanHub();
}
