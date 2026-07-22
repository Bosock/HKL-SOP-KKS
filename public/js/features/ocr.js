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
/* Levenshtein-Distanz (Anzahl Editier-Schritte zwischen zwei Wörtern). Für
   OCR-tolerante Marken-Erkennung („Medironic" → „Medtronic"). Rein & testbar. */
function levenshtein(a,b){ a=a||''; b=b||''; const m=a.length, n=b.length;
  if(!m) return n; if(!n) return m;
  let prev=new Array(n+1); for(let j=0;j<=n;j++) prev[j]=j;
  for(let i=1;i<=m;i++){ const cur=[i];
    for(let j=1;j<=n;j++){ const cost=a.charCodeAt(i-1)===b.charCodeAt(j-1)?0:1;
      cur[j]=Math.min(prev[j]+1, cur[j-1]+1, prev[j-1]+cost); }
    prev=cur; }
  return prev[n]; }
/* Typische OCR-Zeichenverwechslungen in EINEM Ziffern-Kontext (z. B. GTIN)
   glätten: O/Q→0, I/l/|→1, S→5, B→8, Z→2, g/q→9. Rein & testbar. NUR auf reine
   Zahlenfelder anwenden — bei alphanumerischer REF wäre das falsch. */
function ocrFixDigits(s){ return String(s==null?'':s)
  .replace(/[OoQ]/g,'0').replace(/[Il|]/g,'1').replace(/[Ss]/g,'5')
  .replace(/B/g,'8').replace(/[Zz]/g,'2').replace(/[gq]/g,'9'); }

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
    'Abiomed',
    'Sterimed','Peter Surgical','Ethicon','Johnson','Natec','MedAlliance'];
  let m;

  /* REF: „REF", „REF OEM:", „REF Catalog No.", „Cat.-Nr." … — Rauschwörter
     (OEM / Catalog No.) zwischen Marke und Wert überspringen. */
  m = raw.match(/\bREF\b\s*(?:OEM\b\s*)?[:.]?\s*(?:CAT(?:ALOG(?:UE)?)?\.?\s*(?:NO\.?|NUMBER|NUMMER|NR\.?)?\s*[:.]?\s*)?([A-Za-z0-9][A-Za-z0-9\-\/*.]{2,})/i)
   || raw.match(/\b(?:CAT(?:ALOG(?:UE)?)?\.?\s*NO\.?|MODEL|ARTIKEL(?:-?\s*NR)?|ART\.?-?\s*NR|BESTELL(?:-?\s*NR)?)\b[:.\s]*([A-Za-z0-9][A-Za-z0-9\-\/*.]{2,})/i);
  if(m) out.ref=m[1].replace(/[.,]+$/,'');
  /* Fallback: manche Etiketten führen die Bestell-/Katalognummer nur mit „#"
     (z. B. Edwards „# S3UCM223"). Nur ein Buchstaben+Ziffern-Code, damit keine
     Fußnoten-„#" o. Ä. hängen bleiben. */
  if(!out.ref){ m = raw.match(/(?:^|[\n\s])#\s*([A-Za-z][A-Za-z0-9][A-Za-z0-9\-]{2,})/);
    if(m && /\d/.test(m[1])) out.ref=m[1].replace(/[.,]+$/,''); }
  /* LOT / Charge (auch „LOT OEM:") */
  m = raw.match(/\b(?:LOT|CHARGE|BATCH)\b\s*(?:OEM\b\s*)?[:.]?\s*([A-Za-z0-9][A-Za-z0-9\-\/]{1,})/i);
  if(m) out.lot=m[1].replace(/[.,]+$/,'');

  /* Hersteller: bekannte Marken wort-genau, längster Treffer gewinnt … */
  let best='';
  BRANDS.forEach(b=>{ if(new RegExp('\\b'+reEsc(b)+'\\b','i').test(raw) && b.length>best.length) best=b; });
  /* … sonst OCR-tolerant: einzelne Wörter gegen (Ein-Wort-)Marken mit kleiner
     Editier-Distanz abgleichen — fängt Tippfehler wie „Medironic" ab. Kurze
     Marken (<5) bleiben außen vor, um Fehlgriffe zu vermeiden. */
  if(!best){
    const toks=[...new Set(raw.split(/[^A-Za-zÄÖÜäöü]+/).filter(x=>x.length>=5))];
    for(const b of BRANDS){ if(b.indexOf(' ')>=0 || b.length<5) continue;
      const bl=b.toLowerCase(); const maxd=b.length>=8?2:1;
      if(toks.some(tk=>Math.abs(tk.length-b.length)<=maxd && levenshtein(tk.toLowerCase(),bl)<=maxd)){ best=b; break; } }
  }
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
  /* … sonst: Hersteller aus dem GTIN-Präfix ableiten (manche Etiketten – z. B.
     Boston-EP-Kabel – nennen die Marke nur im Barcode). Nur bekannte, eindeutige
     GS1-Präfixe, direkt an „GTIN"/„(01)". */
  if(!out.hersteller){ const gm=raw.match(/(?:GTIN|\(01\))\D{0,3}0?([0-9OIlSBZoQgq]{12,13})/i);
    if(gm){ const g=ocrFixDigits(gm[1]);
      if(/^8714729/.test(g)) out.hersteller='Boston Scientific';
      else if(/^5414734/.test(g)) out.hersteller='Abbott'; } }

  /* French: Zahl + F/Fr/French (z. B. 6F, 6 Fr, 7.5 French, x8F) */
  m = raw.match(/(\d{1,2}(?:[.,]\d)?)\s?F(?:r|rench)?\b/i);
  if(m) out.french=m[1].replace(',', '.')+'F';
  /* … sonst F-Präfix („F5" = 5 French, z. B. B. Braun „CORODYN P1 F5"). F muss
     ein eigenständiges Token sein (Wortanfang, direkt Ziffer), damit „REF 5…"
     o. Ä. nicht getroffen wird. */
  if(!out.french){ m = raw.match(/(?:^|\s)F(\d{1,2}(?:[.,]\d)?)(?=\s|$)/);
    if(m) out.french=m[1].replace(',', '.')+'F'; }
  /* Länge in cm */
  m = raw.match(/(\d{1,3}(?:[.,]\d+)?)\s?cm\b/i);
  if(m) out.laenge=m[1].replace('.', ',')+' cm';
  /* … sonst in Metern („3 m (10ft)") → in cm umrechnen. „mm" schließt der
     Look-ahead aus; plausibler Bereich 0,5–6 m, damit keine Streuwerte greifen. */
  if(!out.laenge){ m = raw.match(/\b(\d(?:[.,]\d+)?)\s?m\b(?!m)/i);
    if(m){ const cm=Math.round(parseFloat(m[1].replace(',','.'))*100); if(cm>=50&&cm<=600) out.laenge=cm+' cm'; } }
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
  /* Führenden Markennamen aus einer Namenszeile entfernen („ETHICON MONOCRYL
     PLUS" → „MONOCRYL PLUS"), damit der Produktname übrig bleibt. */
  const stripBrand=(s)=>{ let t=s; if(best) t=t.replace(new RegExp('^'+reEsc(best)+'[\\s,:®™-]*','i'),'').trim(); return t; };
  let nm='';
  for(const ln of lines){
    if(/[™®]/.test(ln)){ let c=ln.replace(/[™®]/g,'').replace(/\s+/g,' ').trim();
      /* Feld-Tails auf derselben Zeile abschneiden („MONOCRYL PLUS REF MCP496"
         → „MONOCRYL PLUS") und danach den führenden Markennamen entfernen. */
      c=c.replace(/\b(REF|LOT|GTIN|UDI|SN|CE)\b.*$/i,'').trim();
      c=stripBrand(c).replace(/[.,;:]+$/,'').trim();
      if(c.length>=3 && !(best && c.toUpperCase()===best.toUpperCase())){ nm=c; break; } }
  }
  if(!nm){
    for(const ln of lines){
      if(/\b(REF|LOT|CHARGE|BATCH|SN|GTIN|EC\s?REP|STERILE?|LATEX|QTY|MD|UDI|CAT(?:ALOG)?|MODEL|P\/N|PN|REV)\b/i.test(ln)) continue;
      /* Naht-Zeilen ausschließen: „# Katalognr.", USP-Stärke „1 (4 Ph. Eur.)",
         Nadelzeile mit Krümmung „5/8c" — das ist nicht der Produktname. */
      if(/^\s*#/.test(ln) || /\bPh\.?\s*Eur/i.test(ln) || /\b[1-9]\/[1-9]\s?c?\b/.test(ln) || /^\s*\d{1,2}(?:-0)?\s*\(/.test(ln)) continue;
      const letters=(ln.match(/[A-Za-zÄÖÜäöü]/g)||[]).length;
      /* Marken-™/® vor dem Vergleich entfernen — sonst rutscht „Bioptimal™"
         (= Hersteller mit ™) fälschlich als Produktname durch. */
      const cc=stripBrand(ln.replace(/[™®]/g,'').replace(/\s+/g,' ').trim());
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
  /* Naht-Stärke (USP), erkennbar am „(… Ph. Eur.)"-Zusatz: „1 (4 Ph. Eur.)",
     „4-0 (1.5 Ph. Eur.)". Als erste Eigenschaft (wichtigste Größe der Naht). */
  if((pm=raw.match(/\b(\d{1,2}(?:-0)?|\d\/0)\s*\(\s*[\d.,]+\s*(?:Ph\.?\s*Eur|metric)/i))) props.push('Stärke '+pm[1]);
  /* Faden-Struktur & Resorbierbarkeit (Nahtmaterial). */
  if(/\bMONOFIL/i.test(raw)) props.push('monofil');
  else if(/\bBRAIDED\b/i.test(raw)||/\bGEFLOCHTEN\b/i.test(raw)||/\btress[eé]/i.test(raw)) props.push('geflochten');
  if(/\bNON[-\s]?ABSORB/i.test(raw)||/\bNICHT\s+RESORB/i.test(raw)||/\bNON\s+R[eé]SORB/i.test(raw)) props.push('nicht resorbierbar');
  else if(/\bABSORBABLE\b/i.test(raw)||/\bRESORBIERBAR\b/i.test(raw)||/\br[eé]sorbable\b/i.test(raw)) props.push('resorbierbar');
  /* Nadel: Krümmung (½, ⅜, ⅝ …) und – wenn am Zeilenanfang – der Nadelcode
     (PS-2, UR-5 …). Nur auf der Nadelzeile (Krümmung + „mm"). */
  for(const ln of lines){ const cv=ln.match(/\b([1-9]\/[1-9])\s?c?\b/);
    if(cv && /\d+\s?mm\b/i.test(ln)){ const nd=ln.match(/^\s*([A-Za-z]{1,4}(?:[- ]?\d{1,2})?)\b/);
      props.push('Nadel '+((nd&&nd[1]&&!/^\d/.test(nd[1]))?nd[1].trim()+' ':'')+cv[1]); break; } }
  if((pm=raw.match(/\b((?:EXTRA[- ]?LARGE|LARGE|MEDIUM|SMALL|STANDARD)\s+CURVE)\b/i))) props.push(titleCase(pm[1]));
  if(/\bF[-\s]?TYPE\b/i.test(raw)) props.push('F-Type');
  if(/\bJ[-\s]?TIP\b/i.test(raw) || /\bJ-?SPITZE\b/i.test(raw)) props.push('J-Tip');
  if(/\bNON[-\s]?PYROGEN/i.test(raw)) props.push('non-pyrogen');
  if(/\bSTEERABLE\b/i.test(raw) || /\bSTEUERBAR/i.test(raw) || /\bLENKBAR/i.test(raw)) props.push('steuerbar');
  if(/\bIRRIGATED\b/i.test(raw) || /\bGESP[ÜU]LT\b/i.test(raw) || /\bIRRIGIERT\b/i.test(raw)) props.push('gespült');
  if(/\bWITH\s+BALLOON\b/i.test(raw) || /\bMIT\s+BALLON/i.test(raw) || /\bBALLON(?:KATHETER)?\b/i.test(raw)) props.push('mit Ballon');
  /* Latex nur bei POSITIVEM Hinweis — „does not contain … latex", „latex-free",
     „non-latex", „latexfrei" dürfen NICHT als Latex zählen. */
  if(/\bLATEX\b/i.test(raw) && !/(LATEX[-\s]?FREE|LATEXFREI|NON[-\s]?LATEX|(?:NOT|DOES\s+NOT|KEIN|NO|OHNE)\b[^.\n]{0,30}LATEX)/i.test(raw)) props.push('Latex');
  if(/\bHYDROPHIL/i.test(raw)) props.push('hydrophil');
  if(/\bREMANUFACTURED\b/i.test(raw) || /\bREPROCESSED\b/i.test(raw) || /\bAUFBEREITET\b/i.test(raw) || /\bWIEDERAUFBEREITET\b/i.test(raw)) props.push('aufbereitet');
  if((pm=raw.match(/\b(\d(?:[-–]\d){1,3})\s?mm\b/))) props.push('Abstand '+pm[1].replace(/–/g,'-')+' mm');   /* 1-4-1 mm */
  /* Elektrodenabstand als Einzelwert („Electrode spacing (10mm)"). */
  if((pm=raw.match(/ELECTRODE\s+SPACING[^0-9]{0,8}(\d{1,2})\s?mm/i)) || (pm=raw.match(/ELEKTRODEN?[-\s]?ABSTAND[^0-9]{0,8}(\d{1,2})\s?mm/i))) props.push('Elektrodenabstand '+pm[1]+' mm');
  /* Führungsdraht-Kompatibilität in Zoll (z. B. .038″, .035″, .014″) — häufig
     die „MAX. GUIDEWIRE O.D.". Nur .0xx″ (echte Drahtstärken) — so wird ein
     Schleusen-Außenmaß wie .318″ NICHT fälschlich als Draht gelesen. */
  if((pm=raw.match(/(\.0\d{2})\s?["″”’'`]/))) props.push('Draht ' + pm[1].replace('.', '0,') + '″');
  /* Kurvenwinkel in Grad (z. B. 50°) bei steuerbaren/geformten Kathetern. */
  if((pm=raw.match(/\b(\d{2,3})\s?°/))) props.push(pm[1]+'° Kurve');
  /* Polzahl: „4p", „10-polig", „10 pin/pins", „Anzahl Pins 10". */
  if((pm=raw.match(/\b(\d{1,2})[-\s]?(?:polig|pol|pins?)\b/i)) || (pm=raw.match(/\bANZAHL\s+PINS?\D{0,4}(\d{1,2})\b/i)) || (pm=raw.match(/\b(\d{1,2})\s?p\b/))) props.push(pm[1]+'-polig');
  if(props.length) out.weitere=props.join(' · ');

  return out;
}

/* ═══════════════════════════════════════════════════════════════
   BILD-VORVERARBEITUNG (State of the Art)
   Vor der Texterkennung wird das Foto aufbereitet — das ist der größte Hebel
   für die Genauigkeit bei echten Handyfotos:
   1) Graustufen (Farbe hilft der Texterkennung nicht, kostet nur).
   2) ADAPTIVE Binarisierung nach Bradley/Roth (2007): jedes Pixel wird mit dem
      Mittelwert seiner UMGEBUNG verglichen (nicht mit einem globalen Wert).
      Das ist robust gegen ungleichmäßiges Licht, Reflexe und Schatten auf
      glänzenden Etiketten/Folien — dort versagt ein globaler Schwellwert (Otsu).
      Ein Integralbild macht den Umgebungs-Mittelwert je Pixel in O(1) berechenbar.
   Quellen: Bradley & Roth, „Adaptive Thresholding using the Integral Image",
   J. Graphics Tools 12(2), 2007; Tesseract-Doku (ImproveQuality).
   Die Kernfunktionen sind rein (arbeiten auf Zahl-Arrays, kein DOM) → testbar.
   ═══════════════════════════════════════════════════════════════ */

/* RGBA-Pixel (Uint8-Array r,g,b,a,…) → Graustufen (Luminanz), n = Pixelzahl. */
function ocrGrayscale(rgba, n){
  const gray=new Uint8ClampedArray(n);
  for(let i=0;i<n;i++){ const p=i*4;
    gray[i]=(rgba[p]*0.299 + rgba[p+1]*0.587 + rgba[p+2]*0.114)|0; }
  return gray;
}
/* Adaptive Binarisierung (Bradley): Pixel wird SCHWARZ (0), wenn es spürbar
   dunkler ist als der Mittelwert seines Fensters (~ Bildbreite/8), sonst WEISS
   (255). `t` = erlaubte Abweichung in Prozent (Standard 15). Rein & testbar. */
function ocrBradleyThreshold(gray, w, h, opts){
  opts=opts||{};
  const S=Math.max(2, Math.round(opts.window || (w/8))); const half=(S/2)|0;
  const t=(opts.t!=null?opts.t:15)/100;
  const out=new Uint8ClampedArray(w*h);
  /* Integralbild: integ[Y*(w+1)+X] = Summe aller Pixel mit y<Y und x<X.
     Float64 gegen Überlauf bei großen Bildern. */
  const iw=w+1; const integ=new Float64Array(iw*(h+1));
  for(let y=0;y<h;y++){ let rowsum=0;
    for(let x=0;x<w;x++){ rowsum+=gray[y*w+x];
      integ[(y+1)*iw+(x+1)] = integ[y*iw+(x+1)] + rowsum; } }
  for(let y=0;y<h;y++){
    const y1=Math.max(0,y-half), y2=Math.min(h-1,y+half);
    for(let x=0;x<w;x++){
      const x1=Math.max(0,x-half), x2=Math.min(w-1,x+half);
      const count=(x2-x1+1)*(y2-y1+1);
      const sum = integ[(y2+1)*iw+(x2+1)] - integ[y1*iw+(x2+1)]
                - integ[(y2+1)*iw+x1]     + integ[y1*iw+x1];
      out[y*w+x] = (gray[y*w+x]*count <= sum*(1-t)) ? 0 : 255;
    }
  }
  return out;
}
/* Schärfe-Maß = Varianz des Laplace-Filters. Höher = schärfer/kontrastreicher.
   Dient als Qualitätshinweis („zu unscharf?"). Rein & testbar. */
function ocrSharpness(gray, w, h){
  if(w<3||h<3) return 0;
  let sum=0,sum2=0,n=0;
  for(let y=1;y<h-1;y++) for(let x=1;x<w-1;x++){
    const i=y*w+x;
    const lap=4*gray[i]-gray[i-1]-gray[i+1]-gray[i-w]-gray[i+w];
    sum+=lap; sum2+=lap*lap; n++;
  }
  const mean=sum/n; return sum2/n - mean*mean;
}
let _ocrSharp=null;   /* Schärfe des zuletzt vorverarbeiteten Bildes (Qualitätshinweis) */
/* Bereitet ein Foto (data-URL) für die OCR auf: passende Auflösung → Graustufen
   → adaptive Binarisierung. Fällt bei jedem Fehler aufs Originalbild zurück. */
function ocrPreprocess(dataUrl, cb){
  const img=new Image();
  img.onload=()=>{ try{
    let w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
    if(!w||!h){ cb(dataUrl); return; }
    /* Auflösung: riesige Fotos runter-, kleine hochskalieren, damit die Schrift
       genug Pixel hat (Best Practice: kleine Bilder VOR der OCR vergrößern). */
    const MAXED=2200, MIN=1500; const longest=Math.max(w,h); let scale=1;
    if(longest>MAXED) scale=MAXED/longest; else if(longest<MIN) scale=Math.min(2, MIN/longest);
    w=Math.round(w*scale); h=Math.round(h*scale);
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    const ctx=c.getContext('2d'); ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    ctx.drawImage(img,0,0,w,h);
    const id=ctx.getImageData(0,0,w,h);
    const gray=ocrGrayscale(id.data, w*h);
    _ocrSharp=ocrSharpness(gray, w, h);
    const bin=ocrBradleyThreshold(gray, w, h, {t:15});
    for(let i=0;i<w*h;i++){ const p=i*4; id.data[p]=id.data[p+1]=id.data[p+2]=bin[i]; id.data[p+3]=255; }
    ctx.putImageData(id,0,0);
    cb(c.toDataURL('image/png'));   /* PNG: verlustfrei fürs Schwarz-Weiß-Bild */
  }catch(e){ cb(dataUrl); } };
  img.onerror=()=>cb(dataUrl); img.src=dataUrl;
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
       zuverlässiger als der Einzelblock-Modus. user_defined_dpi hilft der
       Engine bei der internen Skalierung kleiner Schrift. */
    try{ await worker.setParameters({ tessedit_pageseg_mode:'3', preserve_interword_spaces:'1', user_defined_dpi:'300' }); }catch(e){}
    let res=await worker.recognize(image);
    let text=(res&&res.data&&res.data.text)||'';
    let conf=(res&&res.data&&res.data.confidence)||0;
    /* Wurde kaum Text gefunden, zweiter Versuch als EIN gleichmäßiger Block
       (PSM 6) — hilft bei Etiketten mit einem großen zentralen Textblock. Das
       ergiebigere Ergebnis gewinnt. */
    const dense=(s)=>String(s||'').replace(/\s/g,'').length;
    if(dense(text) < 24){
      try{ await worker.setParameters({ tessedit_pageseg_mode:'6' });
        const r2=await worker.recognize(image);
        if(dense(r2&&r2.data&&r2.data.text) > dense(text)){ text=r2.data.text; conf=r2.data.confidence||conf; }
      }catch(e){}
    }
    return { text, confidence:Math.round(conf) };
  } finally { try{ await worker.terminate(); }catch(e){} }
}
/* Liest zusätzlich einen Barcode aus DEMSELBEN Foto (falls die native
   BarcodeDetector-API vorhanden ist). Der Barcode trägt GTIN und teils die REF
   (GS1 AI 240/241) EXAKT — während OCR sie nur schätzt. So wird der Barcode zur
   „Wahrheit" für diese Felder (Barcode-OCR-Fusion). */
async function ocrBarcodeFromImage(dataUrl){
  try{
    if(typeof window==='undefined' || !('BarcodeDetector' in window)) return null;
    const formats=(typeof SCAN_FORMATS!=='undefined')?SCAN_FORMATS:undefined;
    const det=new window.BarcodeDetector(formats?{formats}:undefined);
    const img=await new Promise((res,rej)=>{ const im=new Image(); im.onload=()=>res(im); im.onerror=rej; im.src=dataUrl; });
    const codes=await det.detect(img);
    if(codes&&codes.length){ const c=codes[0];
      if(typeof parseScan==='function') return parseScan(c.rawValue||'', c.format||''); }
  }catch(e){}
  return null;
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
async function ocrProcess(dataUrl){
  ocrBusy(true, 'OCR startet …');
  try{
    /* 1) Foto aufbereiten (Graustufen + adaptive Binarisierung). */
    _ocrSharp=null;
    const img=await new Promise((res)=>{ ocrPreprocess(dataUrl,res); });
    /* 2) Text erkennen (getunte Engine, Konfidenz). */
    const ocr=await runLabelOCR(img,(m)=>{ const pct=(m.progress!=null)?Math.round(m.progress*100):null;
      ocrBusy(true, ocrStatusLabel(m.status)+(pct!=null?(' '+pct+' %'):' …')); });
    const fields=extractLabelFields(ocr.text);
    /* 3) Barcode-Fusion: Barcode aus DEMSELBEN Originalfoto lesen; seine REF
       (und GTIN) sind exakt und schlagen die OCR-Schätzung. */
    let barcode=null;
    try{ barcode=await ocrBarcodeFromImage(dataUrl); }catch(e){}
    if(barcode){
      if(barcode.itemRef){ fields.ref=barcode.itemRef; }                 /* Barcode-REF gewinnt */
      const gi=$('scGtin'); const g=barcode.gtin;
      if(gi && g && !gi.value.trim()){ gi.value=(typeof gtinKey==='function'?gtinKey(g):g); }
    }
    const filled=ocrFillForm(fields);
    ocrBusy(false);
    const got=Object.keys(filled);
    const bcMsg=(barcode&&(barcode.itemRef||barcode.gtin))?' · Barcode gelesen':'';
    if(got.length){
      let msg='Erkannt: '+got.map(ocrFieldLabel).join(', ')+bcMsg+' – bitte prüfen.';
      /* Qualitätshinweis: geringe Konfidenz ODER sehr unscharfes Bild. */
      if((ocr.confidence!=null && ocr.confidence<55) || (_ocrSharp!=null && _ocrSharp<40))
        msg+=' ⚠ Bild schwierig – bei Fehlern schärfer/gerader & näher fotografieren.';
      toast(msg);
    }
    else if(bcMsg){ toast('Barcode gelesen – Text unsicher. Bitte Felder prüfen/ergänzen.'); }
    else { toast('Kein Text sicher erkannt. Bitte näher/schärfer fotografieren oder manuell eingeben.', true); }
    /* Charge/LOT wird bewusst NICHT gemeldet: reine Identifikations- &
       Eigenschaftssammlung, keine Chargenverfolgung. */
  }catch(e){ ocrBusy(false); toast('OCR fehlgeschlagen: '+((e&&e.message)||e), true); }
}
