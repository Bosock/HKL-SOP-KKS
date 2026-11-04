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
  /* Typische Verlesungen von Einheiten glätten — NUR direkt hinter einer
     Ziffer, damit kein Wort im Fließtext verändert wird: „rn" wird oft für
     „m" gelesen („110 crn", „2.0 rnm"). */
  const roh0=String(text);
  const raw=roh0.replace(/(\d)\s?crn\b/g,'$1 cm').replace(/(\d)\s?(?:rnm|mrn|rnrn)\b/g,'$1 mm');
  const lines=raw.split(/\r?\n/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean);
  const reEsc=(s)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const titleCase=(s)=>String(s||'').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
  /* Bekannte Hersteller (Kardiologie/EP + allgemein). Längster Treffer gewinnt,
     damit „Boston Scientific" vor „Cook" sticht; wort-genau (kein Teilstring). */
  /* Herstellerliste: seit der Konfigurierbarkeits-Überarbeitung DATEN, nicht
     Code (core/labels.js → data/bezeichnungen.json, pflegbar in der
     Verwaltung). Ein neuer Lieferant im Haus ist ein Alltagsereignis und darf
     kein Entwicklerticket sein. Der Rückfall greift, wenn labels.js fehlt. */
  const BRANDS=(typeof bezHersteller==='function')?bezHersteller():['Boston Scientific','Abbott','Medtronic','Terumo','Cordis','Biotronik','Edwards','Baylis Medical','Cook Medical','B. Braun'];
  let m;

  /* REF: „REF", „REF OEM:", „REF Catalog No.", „Cat.-Nr." … — Rauschwörter
     (OEM / Catalog No.) zwischen Marke und Wert überspringen.
     Das REF-Symbol nach ISO 15223 ist ein KÄSTCHEN um das Wort. Die Engine
     liest dessen Rand als „|", „]" oder „)" mit: „REF| RSA60K10SQ",
     „[REF] M0045000CL0". Ohne diese Toleranz fiel die REF auf fast JEDEM
     echten Etikett durch (Messstand e2e/messen-ocr.js, 2026-11). */
  m = raw.match(/\bREF\b\s*[\]|)]*\s*(?:OEM\b\s*)?[:.]?\s*(?:CAT(?:ALOG(?:UE)?)?\.?\s*(?:NO\.?|NUMBER|NUMMER|NR\.?)?\s*[:.]?\s*)?([A-Za-z0-9][A-Za-z0-9\-\/*.]{2,})/i)
   || raw.match(/\b(?:CAT(?:ALOG(?:UE)?)?\.?\s*NO\.?|MODEL|ARTIKEL(?:-?\s*NR)?|ART\.?-?\s*NR|BESTELL(?:-?\s*NR)?)\b[\]|):.\s]*([A-Za-z0-9][A-Za-z0-9\-\/*.]{2,})/i);
  if(m) out.ref=m[1].replace(/[.,]+$/,'');
  /* Fallback: manche Etiketten führen die Bestell-/Katalognummer nur mit „#"
     (z. B. Edwards „# S3UCM223"). Nur ein Buchstaben+Ziffern-Code, damit keine
     Fußnoten-„#" o. Ä. hängen bleiben. */
  if(!out.ref){ m = raw.match(/(?:^|[\n\s])#\s*([A-Za-z][A-Za-z0-9][A-Za-z0-9\-]{2,})/);
    if(m && /\d/.test(m[1])) out.ref=m[1].replace(/[.,]+$/,''); }
  /* LOT / Charge (auch „LOT OEM:") */
  m = raw.match(/\b(?:LOT|CHARGE|BATCH)\b\s*[\]|)]*\s*(?:OEM\b\s*)?[:.]?\s*([A-Za-z0-9][A-Za-z0-9\-\/]{1,})/i);
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
  /* … sonst OCR-verlesene Ziffer vor dem F („SF (1.67 mm)" = 5F) — aber NUR
     mit Gegenprobe: French ist definiert als 3 × Außendurchmesser in mm. Steht
     der mm-Wert daneben und passt er (±0,15 mm), ist die Lesart belegt.
     Ohne Gegenprobe bleibt das Feld leer — leer schlägt falsch. */
  if(!out.french){ const re=/(?:^|[\s(])([0-9OoQSsIlBZ]{1,2}(?:[.,][0-9OoSsIlBZ])?)\s?F(?:r|rench)?\b[\s(]{0,3}(\d(?:[.,]\d+)?)\s?mm/g;
    let fm; while((fm=re.exec(raw))){ const fr=parseFloat(ocrFixDigits(fm[1]).replace(',','.'));
      const mm=parseFloat(fm[2].replace(',','.'));
      if(isFinite(fr) && isFinite(mm) && fr>=2 && fr<=30 && Math.abs(fr/3-mm)<=0.15){ out.french=String(fr)+'F'; break; } } }
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
/* Kontrastspreizung auf Perzentile: Die dunkelsten `lowPct` % werden zu 0, die
   hellsten `highPct` % zu 255, dazwischen linear gedehnt. Das hebt blasse,
   grau-auf-grau gedruckte Etikettenschrift an, OHNE sie — anders als eine
   harte Binarisierung — auf zwei Werte zu zwingen. Die LSTM-Engine von
   Tesseract ist auf Graustufen trainiert und liest gedehnte Graubilder
   messbar besser als plattgeschwellte. Rein & testbar. */
function ocrStretch(gray, n, opts){
  opts=opts||{};
  const lowPct=(opts.lowPct!=null?opts.lowPct:2)/100;
  const highPct=(opts.highPct!=null?opts.highPct:98)/100;
  if(!n || n<=0) return gray;
  const hist=new Uint32Array(256);
  for(let i=0;i<n;i++) hist[gray[i]]++;
  let acc=0, lowV=0, highV=255;
  for(let v=0;v<256;v++){ acc+=hist[v]; if(acc>=n*lowPct){ lowV=v; break; } }
  acc=0;
  for(let v=0;v<256;v++){ acc+=hist[v]; if(acc>=n*highPct){ highV=v; break; } }
  if(highV<=lowV) return gray;                       /* einfarbiges Bild – nichts zu dehnen */
  const span=highV-lowV;
  const out=new Uint8ClampedArray(n);
  for(let i=0;i<n;i++){ const v=Math.round((gray[i]-lowV)*255/span);
    out[i]=v<0?0:(v>255?255:v); }
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

/* ── Aufbereitung für schwieriges Licht (2026-11) ──────────────────────
   Gemessen am Messstand (e2e/messen-ocr.js): Bei wenig Licht scheitert die
   Erkennung nicht an der Auflösung, sondern am RAUSCHEN des Sensors — die
   Kontrastspreizung hebt es mit dem Text zusammen an. Und ein Schatten über
   dem Etikett macht einen globalen Schwellwert unbrauchbar. Daher, in dieser
   Reihenfolge:
     1) Rauschen schätzen (robust, Immerkær-Kern mit Median statt Mittel).
     2) Nur wenn nötig weichzeichnen — so wenig wie möglich, damit dünne
        Striche (die „8") nicht zerlaufen.
     3) Schattenausgleich: den Papierhintergrund schätzen (heller Anteil je
        Kachel, geglättet) und das Bild durch ihn teilen. Danach ist das
        Etikett überall gleich hell — im Schatten wie unter der Lampe.
     4) Kontrastspreizung wie bisher.
   Alle Funktionen sind rein (Zahl-Arrays, kein DOM) → testbar. */

/* Kastenweichzeichner, separabel über laufende Summen: O(n) unabhängig vom
   Radius. Zweimal angewendet ≈ Gauß. Rein & testbar. */
function ocrBoxBlur(gray, w, h, r){
  r=Math.round(r||0); if(r<1||w<2||h<2) return gray;
  const n=2*r+1, tmp=new Float32Array(w*h), out=new Uint8ClampedArray(w*h);
  for(let y=0;y<h;y++){ const o=y*w; let acc=0;
    for(let x=-r;x<=r;x++) acc+=gray[o+Math.min(w-1,Math.max(0,x))];
    for(let x=0;x<w;x++){ tmp[o+x]=acc/n;
      acc+=gray[o+Math.min(w-1,x+r+1)]-gray[o+Math.max(0,x-r)]; } }
  for(let x=0;x<w;x++){ let acc=0;
    for(let y=-r;y<=r;y++) acc+=tmp[Math.min(h-1,Math.max(0,y))*w+x];
    for(let y=0;y<h;y++){ out[y*w+x]=Math.round(acc/n);
      acc+=tmp[Math.min(h-1,y+r+1)*w+x]-tmp[Math.max(0,y-r)*w+x]; } }
  return out;
}

/* Rauschstärke σ (Graustufen) nach Immerkær (1996), robust gemacht: statt
   des Mittelwerts der Filterantwort deren MEDIAN — Textkanten sind auf
   einem Etikett eine Minderheit und verfälschen ihn kaum. Für Gaußrauschen
   gilt median|v| = 0,6745·6σ. Rein & testbar. */
function ocrRauschen(gray, w, h){
  if(w<3||h<3) return 0;
  const hist=new Uint32Array(1024); let n=0;
  for(let y=1;y<h-1;y+=2) for(let x=1;x<w-1;x+=2){ const i=y*w+x;
    const v=gray[i-w-1]-2*gray[i-w]+gray[i-w+1]-2*gray[i-1]+4*gray[i]-2*gray[i+1]+gray[i+w-1]-2*gray[i+w]+gray[i+w+1];
    const a=Math.min(1023, Math.abs(v)); hist[a]++; n++; }
  let acc=0;
  for(let v=0;v<1024;v++){ acc+=hist[v]; if(acc>=n/2) return v/(0.6745*6); }
  return 0;
}

/* Schattenausgleich: Hintergrund je Kachel schätzen (90. Perzentil = das
   Papier, nicht die Schrift), Kachelgitter glätten (Ausreißer in fetter
   Schrift auffüllen, dann mitteln), bilinear
   auf jedes Pixel ziehen und das Bild durch den Hintergrund teilen.
   Rein & testbar. */
function ocrSchattenAusgleich(gray, w, h){
  if(w<8||h<8) return gray;
  const B=Math.max(16, Math.round(Math.min(w,h)/40));
  const gw=Math.ceil(w/B), gh=Math.ceil(h/B);
  let grid=new Float32Array(gw*gh);
  const hist=new Uint32Array(256);
  for(let gy=0;gy<gh;gy++) for(let gx=0;gx<gw;gx++){
    hist.fill(0); let n=0;
    const y0=gy*B, y1=Math.min(h,y0+B), x0=gx*B, x1=Math.min(w,x0+B);
    for(let y=y0;y<y1;y+=2) for(let x=x0;x<x1;x+=2){ hist[gray[y*w+x]]++; n++; }
    let acc=0, v=255; const ziel=n*0.9;
    for(let k=0;k<256;k++){ acc+=hist[k]; if(acc>=ziel){ v=k; break; } }
    grid[gy*gw+gx]=v;
  }
  /* Kachel mitten in fetter Schrift: deutlich dunkler als ihr hellster
     Nachbar → durch diesen ersetzen. NUR dann — ein pauschales Maximum
     verschöbe bei einem Schattenverlauf alles zur hellen Seite. */
  const fuelle=new Float32Array(gw*gh);
  for(let y=0;y<gh;y++) for(let x=0;x<gw;x++){ let m=0;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ const yy=y+dy, xx=x+dx;
      if(yy<0||yy>=gh||xx<0||xx>=gw) continue; if(grid[yy*gw+xx]>m) m=grid[yy*gw+xx]; }
    const v=grid[y*gw+x]; fuelle[y*gw+x]=(v<0.7*m)?m:v; }
  grid=new Float32Array(gw*gh);
  for(let y=0;y<gh;y++) for(let x=0;x<gw;x++){ let sum=0, c=0;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ const yy=y+dy, xx=x+dx;
      if(yy<0||yy>=gh||xx<0||xx>=gw) continue; sum+=fuelle[yy*gw+xx]; c++; }
    grid[y*gw+x]=sum/c; }
  const out=new Uint8ClampedArray(w*h);
  for(let y=0;y<h;y++){ const fy=Math.min(gh-1, Math.max(0,(y+0.5)/B-0.5)); const y0=Math.floor(fy), y1=Math.min(gh-1,y0+1), ty=fy-y0;
    for(let x=0;x<w;x++){ const fx=Math.min(gw-1, Math.max(0,(x+0.5)/B-0.5)); const x0=Math.floor(fx), x1=Math.min(gw-1,x0+1), tx=fx-x0;
      const bg=(grid[y0*gw+x0]*(1-tx)+grid[y0*gw+x1]*tx)*(1-ty)+(grid[y1*gw+x0]*(1-tx)+grid[y1*gw+x1]*tx)*ty;
      out[y*w+x]=Math.min(255, Math.round(gray[y*w+x]*255/Math.max(8,bg))); } }
  return out;
}

/* Die ganze Aufbereitung für schwieriges Licht. Rein & testbar.
   Rückgabe { px, rauschen } — rauschen geht in die Qualitätsprüfung. */
function ocrAufbereiten(gray, w, h){
  const sigma=ocrRauschen(gray, w, h);
  let px=gray;
  if(sigma>2.5){ const r=sigma>9?2:1; px=ocrBoxBlur(ocrBoxBlur(px,w,h,r),w,h,r); }
  px=ocrSchattenAusgleich(px, w, h);
  px=ocrStretch(px, w*h, { lowPct:1, highPct:99 });
  return { px, rauschen:sigma };
}

/* Auflösungs-Grenzen. WICHTIGE KORREKTUR gegenüber der ersten Fassung: die
   Obergrenze lag bei 2200 px. Ein aktuelles Handyfoto hat ~4000 px Kantenlänge
   — die Verkleinerung warf also fast die Hälfte der linearen Auflösung weg.
   Genau die kleine REF-Schrift (1–2 mm auf dem Etikett) fiel dadurch unter die
   Erkennungsschwelle, während grobe Elemente (Logo, Produktname) unversehrt
   blieben. Das erklärt „er liest alles, nur die REF nicht". */
const OCR_MAXKANTE=3600, OCR_MINKANTE=1600;
/* Feinlesung: Zielhöhe eines Wortrahmens in Pixeln. Die LSTM-Engine rechnet
   jede Zeile intern auf 36 px Höhe um; Großbuchstaben von ~20–30 px liegen
   im günstigsten Bereich (Tesseract-Forum, Messreihe W. Dotkom 2018:
   Fehlerquote hängt vor allem an der Versalhöhe in Pixeln). Ein Wortrahmen
   mit Ober-/Unterlänge ist etwa 1,3 × Versalhöhe. Bestätigt am Messstand. */
const OCR_ZIEL_HOEHE=40, OCR_GRENZE_PX=4200;

/* Bereitet ein Foto (data-URL) für die OCR auf und liefert die Bildmaße mit.
     modus 'grau'   → Graustufen + Kontrastspreizung
     modus 'binaer' → zusätzlich adaptive Binarisierung nach Bradley
     modus 'licht'  → Aufbereitung für schwieriges Licht (Standard, s. o.)
     modus 'licht-binaer' → 'licht' + Bradley (zweite Meinung)
     rechteck {x,y,w,h} (Originalpixel) → nur diesen Ausschnitt
     faktor   → fester Maßstab gegenüber dem Original (Feinlesung)
   cb(dataUrl, {w,h,faktor,ox,oy,hell,rauschen}). Fällt bei jedem Fehler aufs
   Originalbild zurück. */
function ocrRender(dataUrl, opts, cb){
  opts=opts||{};
  const img=new Image();
  img.onload=()=>{ try{
    const W=img.naturalWidth||img.width, H=img.naturalHeight||img.height;
    if(!W||!H){ cb(dataUrl,null); return; }
    const q=opts.rechteck||{ x:0, y:0, w:W, h:H };
    const rx=Math.max(0,Math.round(q.x)), ry=Math.max(0,Math.round(q.y));
    const rw=Math.max(1,Math.min(W-rx,Math.round(q.w))), rh=Math.max(1,Math.min(H-ry,Math.round(q.h)));
    let scale;
    if(opts.faktor) scale=opts.faktor;
    else { const MAXED=opts.max||OCR_MAXKANTE, MIN=OCR_MINKANTE; const longest=Math.max(rw,rh); scale=1;
      if(longest>MAXED) scale=MAXED/longest; else if(longest<MIN) scale=Math.min(2, MIN/longest); }
    if(Math.max(rw,rh)*scale>OCR_GRENZE_PX) scale=OCR_GRENZE_PX/Math.max(rw,rh);
    const w=Math.max(1,Math.round(rw*scale)), h=Math.max(1,Math.round(rh*scale));
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    const ctx=c.getContext('2d'); ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    ctx.drawImage(img,rx,ry,rw,rh,0,0,w,h);
    const id=ctx.getImageData(0,0,w,h);
    let px=ocrGrayscale(id.data, w*h);
    let hell=0, grell=0; for(let i=0;i<px.length;i+=7){ hell+=px[i]; if(px[i]>=250) grell++; }
    hell=hell/Math.ceil(px.length/7); grell=grell/Math.ceil(px.length/7);
    if(!opts.rechteck) _ocrSharp=ocrSharpness(px, w, h);
    let rauschen=null;
    if(opts.modus==='licht' || opts.modus==='licht-binaer'){ const a=ocrAufbereiten(px, w, h); px=a.px; rauschen=a.rauschen; }
    else px=ocrStretch(px, w*h, {});                  /* blasse Schrift anheben */
    if(opts.modus==='binaer' || opts.modus==='licht-binaer') px=ocrBradleyThreshold(px, w, h, {t:15});
    for(let i=0;i<w*h;i++){ const p=i*4; id.data[p]=id.data[p+1]=id.data[p+2]=px[i]; id.data[p+3]=255; }
    ctx.putImageData(id,0,0);
    cb(c.toDataURL('image/png'), { w, h, faktor:scale, ox:rx, oy:ry, hell:Math.round(hell), grell, rauschen });   /* PNG: verlustfrei */
  }catch(e){ cb(dataUrl,null); } };
  img.onerror=()=>cb(dataUrl,null); img.src=dataUrl;
}

/* Wo steht der Text, und wie groß ist er? Aus den Wortrahmen einer ersten
   Lesung: Rahmen um alle sicher gelesenen Wörter (mit Rand) und die mittlere
   Wort-Höhe. Damit wird das Etikett ausgeschnitten und auf die günstigste
   Schriftgröße gebracht — ein kleines Etikett im großen Bild wird so groß
   gezogen, ein formatfüllendes verkleinert (das mittelt auch Rauschen weg).
   Liefert null, wenn zu wenig sicher gelesen wurde. Rein & testbar. */
function ocrZuschnitt(words, bildW, bildH){
  if(!Array.isArray(words) || !bildW || !bildH) return null;
  const gut=words.filter(w=>w && w.bbox && (w.conf||0)>=50 && /[A-Za-z0-9]{2,}/.test(String(w.text||'')));
  if(gut.length<4) return null;
  const hs=gut.map(w=>w.bbox.y1-w.bbox.y0).filter(x=>x>0).sort((a,b)=>a-b);
  if(!hs.length) return null;
  const hMed=hs[Math.floor(hs.length/2)];
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  gut.forEach(w=>{ x0=Math.min(x0,w.bbox.x0); y0=Math.min(y0,w.bbox.y0); x1=Math.max(x1,w.bbox.x1); y1=Math.max(y1,w.bbox.y1); });
  const rand=hMed*2.5;
  x0=Math.max(0,Math.floor(x0-rand)); y0=Math.max(0,Math.floor(y0-rand));
  x1=Math.min(bildW,Math.ceil(x1+rand)); y1=Math.min(bildH,Math.ceil(y1+rand));
  return { x:x0, y:y0, w:x1-x0, h:y1-y0, hMed };
}

/* ═══════════════════════════════════════════════════════════════
   REF-KANDIDATEN UND MEHRHEITSENTSCHEID
   Statt EINER Lesung zu vertrauen, sammeln wir mehrere Hypothesen aus
   demselben EINEN Foto (verschiedene Aufbereitungen, verschiedene Segmentier-
   Modi, ein gezielter Ausschnitt) und lassen sie gegeneinander antreten. Das
   ist der Multi-Frame-Gedanke aus dem Scanner-Bau — nur ohne den Nutzer zu
   mehreren Fotos zu zwingen.
   ═══════════════════════════════════════════════════════════════ */

/* Alle plausiblen REF-Kandidaten aus einem Etikett-Text, mit Bewertung.
   Höher = vertrauenswürdiger. Ein ausdrücklicher „REF"-Marker wiegt am
   schwersten, ein freistehendes Buchstaben-Ziffern-Muster am wenigsten.
   Rein & testbar (nutzt refPlausible, wenn vorhanden). */
function ocrRefTokens(text){
  const raw=String(text==null?'':text);
  const out=[];
  const add=(tok, score, quelle)=>{
    let t=String(tok||'').replace(/[.,;:]+$/,'').trim();
    if(!t) return;
    if(typeof refPlausible==='function' && !refPlausible(t)) return;
    const vorh=out.find(o=>o.tok.toUpperCase()===t.toUpperCase());
    if(vorh){ if(score>vorh.score){ vorh.score=score; vorh.quelle=quelle; } return; }
    out.push({ tok:t, score, quelle });
  };
  let m;
  /* 1) ausdrücklicher REF-Marker (auch „REF OEM:", „REF Catalog No.") */
  const reRef=/\bREF\b\s*[\]|)]*\s*(?:OEM\b\s*)?[:.]?\s*(?:CAT(?:ALOG(?:UE)?)?\.?\s*(?:NO\.?|NUMBER|NUMMER|NR\.?)?\s*[:.]?\s*)?([A-Za-z0-9][A-Za-z0-9\-\/*.]{2,})/ig;
  while((m=reRef.exec(raw))) add(m[1], 100, 'REF');
  /* 2) gleichwertige Marker anderer Hersteller */
  const reAlt=/\b(?:CAT(?:ALOG(?:UE)?)?\.?\s*NO\.?|MODEL|REORDER(?:\s*NO\.?)?|ARTIKEL(?:-?\s*NR)?|ART\.?-?\s*NR|BESTELL(?:-?\s*NR)?|P\/N|PN)\b[\]|):.\s]*([A-Za-z0-9][A-Za-z0-9\-\/*.]{2,})/ig;
  while((m=reAlt.exec(raw))) add(m[1], 90, 'Katalognr.');
  /* 3) „#"-Schreibweise (z. B. Edwards „# S3UCM223") */
  const reHash=/(?:^|[\n\s])#\s*([A-Za-z][A-Za-z0-9][A-Za-z0-9\-]{2,})/g;
  while((m=reHash.exec(raw))) add(m[1], 70, '#');
  /* 4) freie Tokens mit REF-typischem Muster (Buchstaben UND Ziffern gemischt).
     Was erkennbar KEINE REF ist, fliegt vorher raus — sonst landete „10cm",
     „2-5-2mm" oder die Postleitzahl aus der Herstelleradresse im REF-Feld
     (Messstand: auf 3 von 4 Etiketten passiert). Ausgeschlossen: Maße mit
     Einheit, Bereiche, der Wert hinter LOT/SN/(10)/(17), und Zeilen, die
     eine Anschrift sind. */
  const nichtRef={};
  const reLot=/\b(?:LOT|CHARGE|BATCH|SN|S\/N|SERIAL)\b\s*[\]|)]*\s*[:.]?\s*([A-Za-z0-9][A-Za-z0-9\-\/]{1,})/ig;
  while((m=reLot.exec(raw))) nichtRef[m[1].toUpperCase()]=1;
  const reAi=/\((?:10|11|17|21)\)\s*([A-Za-z0-9]{2,})/g;
  while((m=reAi.exec(raw))) nichtRef[m[1].toUpperCase()]=1;
  const istAnschrift=(ln)=>/\b(USA|U\.S\.A|GERMANY|DEUTSCHLAND|BELGIUM|IRELAND|NETHERLANDS|SWITZERLAND|FRANCE|ITALY|JAPAN|CHINA|MEXICO|COSTA RICA|INC\.?|CORP\.?|CORPORATION|GMBH|LTD\.?|N\.V\.|B\.V\.|S\.A\.|LLC|STR\.|STRASSE|STRAßE|STREET|AVENUE|AVE\.?|ROAD|DRIVE)\b/i.test(ln) || /\b[A-Z]{2}\s\d{5}\b/.test(ln) || /\b\d{4,5}\s+[A-Z][a-z]/.test(ln);
  const istMass=(t)=>/^\d+(?:[.,]\d+)?(?:mm|cm|m|ml|µl|ul|l|f|fr|french|in|inch|ft|g|kg|mg|mmhg|atm|bar|psi|h|min|s|°|°c|v|w|mhz|khz)$/i.test(t) || /^\d+(?:[.,]\d+)?(?:[-–x×]\d+(?:[.,]\d+)?)+(?:mm|cm|m)?$/i.test(t);
  const toks=[];
  raw.split(/\r?\n/).forEach(ln=>{ if(!istAnschrift(ln)) ln.split(/[\s|]+/).forEach(t=>toks.push(t)); });
  toks.forEach(t=>{
    const clean=t.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9\-\/*.]+$/g,'');
    if(!clean) return;
    if(nichtRef[clean.toUpperCase()] || istMass(clean)) return;
    const hatBuchst=/[A-Za-z]/.test(clean), hatZiffer=/\d/.test(clean);
    if(hatBuchst && hatZiffer) add(clean, 40, 'Muster');
    else if(hatZiffer && /^\d{5,11}$/.test(clean)) add(clean, 20, 'Zahl');
  });
  return out.sort((a,b)=>b.score-a.score || a.tok.length-b.tok.length);
}

/* Kandidaten aus dem gezielt gelesenen REF-STREIFEN. Der Streifen beginnt am
   Marker; alles rechts davon IST die Artikelnummer. Weil die Whitelist keine
   Klammern kennt, kommt der Kästchenrand dort als „I"/„1" an („IREFI 1001782")
   — der Marker-Regex greift dann nicht. Deshalb: Marker-Token verwerfen, die
   übrigen plausiblen Tokens mit hoher Bewertung (95) übernehmen. Rein. */
function ocrBandTokens(bandText){
  const out=[];
  String(bandText==null?'':bandText).split(/\s+/).forEach(t=>{
    const c=t.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9\-\/*]+$/g,'');
    if(!c || /^[I1l|\[(]*(REF|CAT|LOT|MODEL)[I1l|\])]*[:.]?$/i.test(c)) return;
    if(typeof refPlausible==='function' && !refPlausible(c)) return;
    if(out.some(o=>o.tok===c)) return;
    out.push({ tok:c, score:95, quelle:'REF-Streifen' });
  });
  return out.slice(0,2);
}

/* Welche REF kommt ins Formular? Rein & testbar.
   Regel (Grundsatz „leer schlägt falsch"):
   - Eine REF mit ausdrücklichem Marker („REF", „CAT NO", „#" …, Bewertung
     ≥ 70) darf ins Feld — auch wenn sie in keinem Bestand steht (neue
     Produkte). Lässt sie sich nicht auflösen, werden die übrigen MARKER-
     Lesungen probiert (die zweite Lesung hat oft recht).
   - Ein freies Muster ohne Marker („M004…", „1001782") kommt NUR ins Feld,
     wenn es sich SICHER gegen den Bestand auflöst. Sonst bleibt das Feld
     leer, und die besten drei stehen als antippbare Vorschläge bereit.
   best(roh) → {ref, wie, sicher, kandidaten} (refBest) oder null. */
function ocrRefEntscheid(feldRef, kandidaten, best){
  const kand=Array.isArray(kandidaten)?kandidaten:[];
  const marker=kand.filter(k=>k.score>=70);
  const frei=kand.filter(k=>k.score<70);
  const loese=(t)=>best?best(t):{ ref:t, wie:'roh', sicher:false, kandidaten:[] };
  let roh=String(feldRef||'').trim() || (marker[0]&&marker[0].tok) || '';
  if(roh){
    let info=loese(roh);
    if(!info.sicher){
      for(const k of marker.slice(0,6)){ if(k.tok===roh) continue;
        const alt=loese(k.tok); if(alt.sicher){ info=alt; roh=k.tok; break; } }
    }
    return { ref:info.ref||roh, roh, info:Object.assign({ vorschlaege:[] }, info) };
  }
  for(const k of frei.slice(0,6)){
    const alt=loese(k.tok);
    if(alt.sicher) return { ref:alt.ref, roh:k.tok, info:Object.assign({ vorschlaege:[] }, alt) };
  }
  return { ref:'', roh:'', info:{ ref:'', wie:'roh', sicher:false, kandidaten:[],
    vorschlaege:frei.slice(0,3).map(k=>k.tok) } };
}

/* Mehrheitsentscheid über mehrere Feldsätze (aus mehreren Lesungen desselben
   Fotos). Je Feld gewinnt der Wert, den die meisten Lesungen liefern; bei
   Gleichstand die Lesung mit der höheren Priorität (= früher in der Liste).
   Leere Werte stimmen nicht mit ab. Rein & testbar. */
function ocrVoteFields(saetze){
  const list=(saetze||[]).filter(Boolean);
  const out={};
  if(!list.length) return out;
  const keys={}; list.forEach(s=>Object.keys(s).forEach(k=>{ keys[k]=1; }));
  Object.keys(keys).forEach(k=>{
    const stimmen=[];
    list.forEach((s,i)=>{
      const v=(s[k]==null?'':String(s[k])).trim(); if(!v) return;
      const e=stimmen.find(x=>x.v.toUpperCase()===v.toUpperCase());
      if(e) e.n++; else stimmen.push({ v, n:1, i });
    });
    if(!stimmen.length){ out[k]=''; return; }
    stimmen.sort((a,b)=>(b.n-a.n)||(a.i-b.i));
    out[k]=stimmen[0].v;
  });
  return out;
}

/* Findet auf Basis der Wort-Rahmen einer ersten Lesung den BILDAUSSCHNITT, in
   dem die REF steht: das Wort „REF" (oder ein gleichwertiger Marker) plus der
   Streifen rechts davon bis zum Bildrand, mit etwas Luft nach oben/unten.
   Dieser Streifen wird danach als EINZELNE TEXTZEILE (PSM 7) mit Zeichen-
   Whitelist neu gelesen — die Engine sucht dann nicht mehr in einem Etiketten-
   Wimmelbild, sondern liest genau eine Zeile. Grösster Einzeleffekt der ganzen
   Kette. Liefert {x,y,w,h} in Bildpixeln oder null. Rein & testbar. */
function ocrRefBand(words, bildW, bildH){
  if(!Array.isArray(words) || !bildW || !bildH) return null;
  /* Der Rand des ISO-Kästchens hängt oft am Wort: „[REF]", „REF|", „(REF". */
  const istMarker=(t)=>/^(REF|CAT|CATALOG|MODEL|P\/N|PN|REORDER)$/i.test(String(t||'').trim().replace(/^[\[|(]+|[\]|):.]+$/g,''));
  let marker=null;
  for(const w of words){ if(w && w.bbox && istMarker(w.text)){ marker=w; break; } }
  if(!marker) return null;
  const b=marker.bbox;
  const zh=Math.max(1, (b.y1-b.y0));                  /* Zeilenhöhe als Maßstab */
  const y0=Math.max(0, Math.round(b.y0 - zh*0.7));
  const y1=Math.min(bildH, Math.round(b.y1 + zh*0.7));
  const x0=Math.max(0, Math.round(b.x0 - zh*0.3));
  const x1=bildW;                                      /* bis zum rechten Rand */
  if((x1-x0)<24 || (y1-y0)<10) return null;
  return { x:x0, y:y0, w:(x1-x0), h:(y1-y0) };
}

/* Zeichenvorrat für Code-Felder. Kleinbuchstaben sind auf Etiketten-Codes
   praktisch nie zu finden — sie auszuschließen entfernt eine ganze Ebene
   möglicher Verwechslungen (l/1, o/0, s/5). */
const OCR_REF_WHITELIST='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/*.';

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
/* Der Worker wird WIEDERVERWENDET. Vorher wurde er je Lesung neu erzeugt und
   sofort beendet — bei mehreren Durchgängen (Graustufe, Binär, REF-Streifen)
   hieße das, die WASM-Engine und das Sprachmodell jedes Mal neu zu laden.
   Ein Worker für die ganze Sitzung, nach Leerlauf beendet. */
let _ocrWorker=null, _ocrWorkerIdle=null, _ocrLogger=null;
function ocrSetLogger(f){ _ocrLogger=(typeof f==='function')?f:null; }
async function ocrGetWorker(){
  if(_ocrWorker){ if(_ocrWorkerIdle){ clearTimeout(_ocrWorkerIdle); _ocrWorkerIdle=null; } return _ocrWorker; }
  const T=await ensureTesseract();
  _ocrWorker=await T.createWorker('eng', 1, {
    workerPath:'/vendor/tesseract/worker.min.js',
    corePath:'/vendor/tesseract/tesseract-core-simd-lstm.js',
    langPath:'/vendor/tesseract/',
    workerBlobURL:false,
    logger:(msg)=>{ if(_ocrLogger && msg && msg.status) _ocrLogger(msg); },
  });
  return _ocrWorker;
}
/* Nach getaner Arbeit den Speicher wieder freigeben — aber erst nach einer
   Ruhephase, damit das nächste Etikett sofort loslegen kann. */
function ocrReleaseWorker(delay){
  if(!_ocrWorker) return;
  if(_ocrWorkerIdle) clearTimeout(_ocrWorkerIdle);
  _ocrWorkerIdle=setTimeout(()=>{ const w=_ocrWorker; _ocrWorker=null; _ocrWorkerIdle=null;
    try{ if(w) w.terminate(); }catch(e){} }, delay==null?60000:delay);
}

/* Holt die Einzelwörter samt Rahmen aus einem Tesseract-Ergebnis. Je nach
   Ausgabeform liegen sie flach (data.words) oder verschachtelt in
   blocks › paragraphs › lines › words. Beides bedienen. Rein. */
function ocrWordsOf(data){
  if(!data) return [];
  const raus=(w)=>({ text:(w&&w.text)||'', conf:(w&&w.confidence)||0, bbox:(w&&w.bbox)||null });
  if(Array.isArray(data.words) && data.words.length) return data.words.map(raus);
  const out=[];
  (data.blocks||[]).forEach(b=>(b.paragraphs||[]).forEach(p=>(p.lines||[]).forEach(l=>(l.words||[]).forEach(w=>out.push(raus(w))))));
  return out;
}

/* EIN Erkennungsdurchgang mit gezielten Parametern.
     psm         – Segmentierungsmodus (3 = ganze Seite, 6 = ein Block, 7 = eine Zeile)
     whitelist   – erlaubter Zeichenvorrat (für Code-Felder)
     woerterbuch – false schaltet die Wörterbücher AB. Für Artikelnummern
                   entscheidend: sonst „korrigiert" die Engine Codes zu
                   englischen Wörtern, die es auf dem Etikett gar nicht gibt.
     rechteck    – {left,top,width,height}: nur diesen Ausschnitt lesen. */
async function ocrRun(image, opts){
  opts=opts||{};
  const worker=await ocrGetWorker();
  const p={
    tessedit_pageseg_mode:String(opts.psm||3),
    preserve_interword_spaces:'1',
    user_defined_dpi:'300',
    /* Wörterbücher/Sprachmodell abschaltbar — siehe oben. */
    load_system_dawg:(opts.woerterbuch===false)?'0':'1',
    load_freq_dawg:(opts.woerterbuch===false)?'0':'1',
    load_punc_dawg:(opts.woerterbuch===false)?'0':'1',
    load_number_dawg:(opts.woerterbuch===false)?'0':'1',
    tessedit_char_whitelist:opts.whitelist||'',
  };
  try{ await worker.setParameters(p); }catch(e){}
  const args=opts.rechteck?{ rectangle:opts.rechteck }:{};
  let res;
  try{ res=await worker.recognize(image, args, { text:true, blocks:true }); }
  catch(e){ res=await worker.recognize(image, args); }
  const d=(res&&res.data)||{};
  return { text:d.text||'', confidence:Math.round(d.confidence||0), words:ocrWordsOf(d) };
}
/* Textdichte (Zeichen ohne Leerraum) — Maß dafür, ob ein Durchgang etwas
   Brauchbares geliefert hat. Rein & testbar. */
function ocrDichte(s){ return String(s==null?'':s).replace(/\s/g,'').length; }

/* Kompatibler Kurzweg (eine Lesung, automatische Segmentierung mit Rückfall auf
   Block-Modus). Wird vom geführten Dialog und von Alt-Aufrufen genutzt. */
async function runLabelOCR(image, onProgress){
  ocrSetLogger(onProgress);
  try{
    let r=await ocrRun(image, { psm:3, woerterbuch:false });
    if(ocrDichte(r.text)<24){
      const r2=await ocrRun(image, { psm:6, woerterbuch:false });
      if(ocrDichte(r2.text)>ocrDichte(r.text)) r=r2;
    }
    return { text:r.text, confidence:r.confidence, words:r.words };
  } finally { ocrSetLogger(null); ocrReleaseWorker(); }
}

/* ═══════════════════════════════════════════════════════════════
   DIE GESAMTE LESE-KETTE (ein oder mehrere Fotos desselben Etiketts)
   Reihenfolge nach dem Grundsatz „das sicherste Signal zuerst". Je Foto
   (ocrLeseFoto):
     0) Barcode aus demselben Foto  → GTIN exakt, oft auch die REF (GS1 AI 240)
     1) Volltext auf dem für schwieriges Licht aufbereiteten Bild
        (Rauschminderung · Schattenausgleich · Kontrastspreizung), PSM 3
     2) Feinlesung: Etikett ausschneiden, auf die günstige Schriftgröße
        bringen, erneut lesen (nur wenn es sich lohnt)
     3) Gezielter REF-Streifen, PSM 7 + Whitelist
     4) Symbol-Nachlese: steht eine Nummer ohne Beschriftung da, wird links
        daneben das ISO-Symbol gelesen (REF bestätigt, LOT schließt aus)
     5) Zweite Meinung (binarisiert) — nur wenn bisher dünn oder ohne REF
   Danach über ALLE Fotos (ocrZusammenfuehren):
     6) Mehrheitsentscheid je Feld; REF gewichtet mit der Wort-Sicherheit
     7) REF gegen den Bestand auflösen (matref.js); unsicher Gelesenes
        nur vorschlagen — leer schlägt falsch
   Liefert ein Ergebnisobjekt; verändert NICHTS am Formular.
   Gemessen: e2e/messen-ocr.js · Begründung: docs/KONZEPT-OCR.md §7.
   ═══════════════════════════════════════════════════════════════ */
/* Die Lesedurchgänge werden im Code über SCHLÜSSEL unterschieden, das Wort
   dient nur der Anzeige (Grundsatz ④ — wer die Bezeichnung ändert, darf nicht
   die Reihenfolge der Abstimmung ändern). */
const OCR_LESUNG_WORT = { voll:'Volltext', fein:'Feinlesung', ref:'REF-Streifen', symbol:'Symbol-Nachlese', kontrast:'Kontrast' };
function ocrLesungWort(k){ return OCR_LESUNG_WORT[k] || String(k||''); }

/* Messschalter für den Messstand (e2e/messen-ocr.js): 'alt' = Kette wie bis
   Oktober 2026 (nur Graustufe, kein Zuschnitt, keine Symbol-Nachlese), 'neu'
   = aktuelle Kette. Im Betrieb immer 'neu'; der Schalter existiert, damit
   jede künftige Änderung gegen denselben Ausgangspunkt gemessen werden kann. */
const OCR_VERSUCH={ modus:'neu' };
/* Unter dieser Lese-Sicherheit (0–100) wird eine REF, die in keinem Bestand
   steht, nicht eingetragen, sondern nur vorgeschlagen. Vorläufig am Messstand
   geeicht (falsche Lesungen ≤ 59, richtige meist ≥ 66) — mit echten
   Etikettfotos nachzueichen. */
const OCR_REF_MINDESTSICHERHEIT=65;

/* Der Bildausschnitt LINKS neben einem Wort — dort steht auf Etiketten das
   Symbol (REF/LOT im Kästchen nach ISO 15223). Rein & testbar. */
function ocrLinksVon(bbox, bildW, bildH){
  if(!bbox || !bildW || !bildH) return null;
  const hg=Math.max(1, bbox.y1-bbox.y0);
  const x1=Math.round(bbox.x0-Math.max(2, hg*0.12));
  const x0=Math.max(0, Math.round(x1-hg*3.0));
  /* Knapp in der Höhe: Mit mehr Luft ragt die Nachbarzeile (oft das LOT-
     Kästchen direkt darunter) in den Ausschnitt und verdirbt die Lesung. */
  const y0=Math.max(0, Math.round(bbox.y0-hg*0.15)), y1=Math.min(bildH, Math.round(bbox.y1+hg*0.15));
  if(x1-x0 < hg*1.2 || y1-y0 < 8) return null;
  return { left:x0, top:y0, width:x1-x0, height:y1-y0 };
}
/* Welches Symbol wurde im Ausschnitt gelesen? Schlüssel 'ref' | 'lot' | 'sn' | ''.
   Tolerant gegen die typischen Lesefehler am Kästchen (R3F, L0T). Rein. */
function ocrMarkerArt(text){
  const t=String(text==null?'':text).toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(/R[E3]F/.test(t)) return 'ref';
  if(/L[O0Q]T/.test(t)) return 'lot';
  if(/^[I1]?SN[I1]?$/.test(t)) return 'sn';
  return '';
}

/* REF-Abstimmung über alle Lesungen (aller Fotos), GEWICHTET mit der
   Wort-Sicherheit der Engine. Ein reiner Mehrheitsentscheid stand bei zwei
   Lesungen 1:1 und nahm dann blind die erste — am Messstand oft die
   schlechtere. Jetzt zählt, wie sicher die Engine das Wort gelesen hat.
   lesungen: [{text, words, quelle, markerRef}] → [{tok, gewicht, n}]. Rein. */
function ocrRefStimmen(lesungen){
  const topf={};
  (lesungen||[]).forEach(l=>{
    const werte=[];
    const f=extractLabelFields(l.text||'');
    if(f.ref) werte.push(f.ref);
    if(l.quelle==='ref'){ const b=ocrBandTokens(l.text||''); if(b[0]) werte.push(b[0].tok); }
    (l.markerRef||[]).forEach(t=>werte.push(t));
    const gesehen={};
    werte.forEach(v=>{
      const k=String(v).toUpperCase(); if(gesehen[k]) return; gesehen[k]=1;
      const wd=(l.words||[]).find(w=>String(w.text||'').toUpperCase().indexOf(k)>=0);
      const g=Math.max(1, wd ? (wd.conf||0) : (l.confidence||50));
      if(!topf[k]) topf[k]={ tok:v, gewicht:0, n:0 };
      topf[k].gewicht+=g; topf[k].n++;
    });
  });
  return Object.keys(topf).map(k=>topf[k]).sort((a,b)=>(b.gewicht-a.gewicht)||(b.n-a.n));
}

/* EIN Foto lesen: alle Durchgänge, noch ohne Entscheidung. Liefert die
   Lesungen, den Barcode und Messwerte für die Qualitätsprüfung. */
async function ocrLeseFoto(dataUrl, sag){
  const neu=(OCR_VERSUCH.modus!=='alt');
  const lesungen=[]; const quali={};
  sag('Barcode suchen …');
  let barcode=null;
  try{ barcode=await ocrBarcodeFromImage(dataUrl); }catch(e){}

  /* 1) Volltext auf dem aufbereiteten Gesamtbild. */
  sag('Bild aufbereiten …');
  const grund=await new Promise(res=>ocrRender(dataUrl,{ modus:neu?'licht':'grau' },(d,m)=>res({img:d,masse:m})));
  if(grund.masse){ quali.hell=grund.masse.hell; quali.grell=grund.masse.grell; quali.rauschen=grund.masse.rauschen; }
  let haupt={ text:'', confidence:0, words:[] };
  try{ haupt=await ocrRun(grund.img, { psm:3, woerterbuch:false }); }catch(e){}
  if(haupt.text) lesungen.push({ text:haupt.text, confidence:haupt.confidence, words:haupt.words, quelle:'voll' });
  let basis={ img:grund.img, masse:grund.masse, words:haupt.words, text:haupt.text };

  /* 2) Feinlesung: Etikett ausschneiden und auf die günstigste Schriftgröße
     bringen. Kostet einen Durchgang — aber nur, wenn es sich lohnt. */
  if(neu && grund.masse){
    const z=ocrZuschnitt(haupt.words, grund.masse.w, grund.masse.h);
    if(z){
      const f0=grund.masse.faktor||1;
      quali.texthoehe=Math.round(z.hMed/f0);                       /* in Originalpixeln */
      const s=Math.max(0.6, Math.min(2.5, OCR_ZIEL_HOEHE/z.hMed));
      const anteil=(z.w*z.h)/(grund.masse.w*grund.masse.h);
      if(anteil<0.7 || Math.abs(s-1)>0.2){
        sag('Etikett fein lesen …');
        const rechteck={ x:grund.masse.ox+z.x/f0, y:grund.masse.oy+z.y/f0, w:z.w/f0, h:z.h/f0 };
        const fein=await new Promise(res=>ocrRender(dataUrl,{ modus:'licht', rechteck, faktor:f0*s },(d,m)=>res({img:d,masse:m})));
        try{
          const r=await ocrRun(fein.img, { psm:3, woerterbuch:false });
          if(r.text){ lesungen.push({ text:r.text, confidence:r.confidence, words:r.words, quelle:'fein' });
            if(r.confidence>=haupt.confidence-5) basis={ img:fein.img, masse:fein.masse, words:r.words, text:r.text, rechteck }; }
        }catch(e){}
      }
    }
  }

  /* 3) Gezielter REF-Streifen auf dem besten Bild. */
  let bandText='';
  const band=basis.masse?ocrRefBand(basis.words, basis.masse.w, basis.masse.h):null;
  if(band){
    sag('REF-Feld genau lesen …');
    try{
      const r=await ocrRun(basis.img, { psm:7, woerterbuch:false, whitelist:OCR_REF_WHITELIST,
        rechteck:{ left:band.x, top:band.y, width:band.w, height:band.h } });
      bandText=r.text||'';
      if(bandText.trim()) lesungen.push({ text:bandText, confidence:r.confidence, words:r.words, quelle:'ref' });
    }catch(e){}
  }

  /* 4) Symbol-Nachlese: Das REF-Kästchen wird von der Seitenanalyse oft als
     Grafik verworfen — übrig bleibt eine Nummer ohne Beschriftung. Dann wird
     links neben den besten Code-Kandidaten gezielt nachgesehen, welches
     Symbol dort steht. REF bestätigt die Nummer, LOT schließt sie aus. */
  const markerRef=[], markerLot=[];
  const alles=lesungen.map(l=>l.text).join('\n');
  if(neu && basis.masse && !ocrRefTokens(alles).some(k=>k.score>=70)){
    const frei=ocrRefTokens(basis.text||'').filter(k=>k.score<70).slice(0,3);
    for(const k of frei){
      const wd=(basis.words||[]).find(w=>w.bbox && String(w.text||'').indexOf(k.tok)>=0);
      const rr=wd?ocrLinksVon(wd.bbox, basis.masse.w, basis.masse.h):null;
      if(!rr) continue;
      sag('Symbol neben der Nummer prüfen …');
      try{
        /* PSM 8 = „ein Wort". Am Messstand 16/16 Symbole erkannt, PSM 7
           („eine Zeile") nur 12/16 — der Kästchenrand stört dort mehr. */
        const wl='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123';
        let r=await ocrRun(basis.img, { psm:8, woerterbuch:false, whitelist:wl, rechteck:rr });
        if(!ocrMarkerArt(r.text)) r=await ocrRun(basis.img, { psm:13, woerterbuch:false, whitelist:wl, rechteck:rr });
        const art=ocrMarkerArt(r.text);
        if(art==='ref'){ markerRef.push(k.tok); break; }
        if(art==='lot' || art==='sn') markerLot.push(k.tok);
      }catch(e){}
    }
  }
  if(markerRef.length) lesungen.push({ text:'', confidence:90, words:[], quelle:'symbol', markerRef });

  /* 5) Zweite Meinung (binarisiert) — nur wenn bisher dünn oder ohne REF. */
  const refBisher=ocrRefTokens(bandText+'\n'+alles).filter(k=>k.score>=70);
  if(ocrDichte(basis.text)<40 || (!refBisher.length && !markerRef.length)){
    sag('Zweite Lesung (Kontrast) …');
    try{
      const opt=neu ? { modus:'licht-binaer', rechteck:basis.rechteck, faktor:basis.rechteck?basis.masse.faktor:undefined } : { modus:'binaer' };
      const bin=await new Promise(res=>ocrRender(dataUrl,opt,(d)=>res(d)));
      const r=await ocrRun(bin, { psm:6, woerterbuch:false });
      if(r.text) lesungen.push({ text:r.text, confidence:r.confidence, words:r.words, quelle:'kontrast' });
    }catch(e){}
  }
  const confs=lesungen.filter(l=>l.quelle==='voll'||l.quelle==='fein').map(l=>l.confidence||0);
  quali.konfidenz=confs.length?Math.max.apply(null,confs):0;
  quali.schaerfe=_ocrSharp;
  return { lesungen, barcode, markerLot, quali };
}

/* Was am Foto verbessert werden kann — konkret und in der Sprache des
   Labors. Wird gezeigt, wenn das Ergebnis unsicher ist, zusammen mit dem
   Angebot, ein weiteres Foto aufzunehmen. Schwellen am Messstand geprüft:
   Die neue Aufbereitung verkraftet viel, deshalb meldet sich die Prüfung
   erst, wenn es wirklich eng wird. q = quali EINES Fotos. Rein & testbar. */
function ocrQualitaetsHinweise(q){
  const out=[];
  if(!q) return out;
  if(q.rauschen!=null && q.rauschen>9) out.push('Wenig Licht – das Bild rauscht. Mehr Licht hilft am meisten; eine Lampe schräg von der Seite, nicht frontal (sonst spiegelt die Folie).');
  else if(q.hell!=null && q.hell<45) out.push('Sehr dunkel – mehr Licht hilft am meisten.');
  if(q.grell!=null && q.grell>0.12) out.push('Spiegelung auf der Folie – das Handy leicht kippen, Blitz aus.');
  if(q.texthoehe!=null && q.texthoehe<18) out.push('Schrift sehr klein im Bild – näher heran (etwa 10–15 cm), Etikett bildfüllend.');
  if(q.schaerfe!=null && q.schaerfe<40) out.push('Unscharf – Handy ruhig halten und vor dem Auslösen kurz auf das Etikett tippen.');
  if(!out.length && q.konfidenz!=null && q.konfidenz<60) out.push('Schwer lesbar – gerade von oben fotografieren, ohne Schatten der Hand.');
  return out;
}
/* Ist das Ergebnis so unsicher, dass ein weiteres Foto lohnt? Rein. */
function ocrNochEinFoto(erg){
  if(!erg) return false;
  const refOk=erg.refInfo && (erg.refInfo.sicher || (erg.fields && erg.fields.ref && erg.refInfo.wie!=='roh'));
  const viele=['hersteller','french','laenge','name'].filter(k=>erg.fields && erg.fields[k]).length>=2;
  const hinweise=(erg.qualitaet||[]).some(q=>ocrQualitaetsHinweise(q).length);
  return !(erg.fields && erg.fields.ref) || (!refOk && hinweise) || !viele;
}

/* Die Lesungen ALLER Fotos zu einem Ergebnis zusammenführen.
   Je Feld Mehrheitsentscheid über alle Lesungen; die REF gewichtet mit der
   Wort-Sicherheit (ocrRefStimmen) und danach gegen den Bestand aufgelöst
   (ocrRefEntscheid). Der Barcode schlägt jede Schätzung. */
function ocrZusammenfuehren(fotos){
  const lesungen=[]; let barcode=null; const lotAus={};
  (fotos||[]).forEach(f=>{ (f.lesungen||[]).forEach(l=>lesungen.push(l));
    if(!barcode && f.barcode && (f.barcode.gtin||f.barcode.itemRef)) barcode=f.barcode;
    (f.markerLot||[]).forEach(t=>{ lotAus[String(t).toUpperCase()]=1; }); });
  /* Reihenfolge = Rang bei Gleichstand: gezielte Lesungen zuerst. */
  const RANG={ ref:0, symbol:1, fein:2, voll:3, kontrast:4 };
  const sortiert=lesungen.filter(l=>l.text).sort((a,b)=>(RANG[a.quelle]||9)-(RANG[b.quelle]||9));
  const fields=ocrVoteFields(sortiert.map(l=>extractLabelFields(l.text)));
  const stimmen=ocrRefStimmen(lesungen).filter(st=>!lotAus[String(st.tok).toUpperCase()]);
  const gesamttext=sortiert.map(l=>l.text).join('\n');
  const bandText=lesungen.filter(l=>l.quelle==='ref').map(l=>l.text).join('\n');
  const frei=ocrRefTokens(gesamttext).filter(k=>!lotAus[k.tok.toUpperCase()]);
  const kandidaten=stimmen.map(st=>({ tok:st.tok, score:100, quelle:'REF' }))
    .concat(ocrBandTokens(bandText), frei)
    .filter((k,i,a)=>a.findIndex(x=>x.tok.toUpperCase()===k.tok.toUpperCase())===i)
    .sort((a,b)=>b.score-a.score);
  const ent=ocrRefEntscheid(stimmen[0]?stimmen[0].tok:'', kandidaten, (typeof refBest==='function')?refBest:null);
  let refInfo=ent.info; fields.ref=ent.ref;
  const conf=lesungen.length?Math.round(lesungen.reduce((s,l)=>s+(l.confidence||0),0)/lesungen.length):0;
  let gtin='';
  if(barcode){
    if(barcode.gtin) gtin=(typeof gtinKey==='function')?gtinKey(barcode.gtin):barcode.gtin;
    if(barcode.itemRef){ fields.ref=barcode.itemRef; refInfo={ ref:barcode.itemRef, wie:'barcode', sicher:true, kandidaten:[], vorschlaege:[] }; }
  }
  const q=(fotos||[]).map(f=>f.quali||{});
  /* Wie sicher hat die Engine die gewählte REF gelesen (mittlere Wort-
     Sicherheit über alle Lesungen, 0–100)? Für den Prüfhinweis im Assistenten. */
  const gew=stimmen.find(st=>String(st.tok).toUpperCase()===String(ent.roh||'').toUpperCase());
  const refLeseSicherheit=gew?Math.round(gew.gewicht/gew.n):null;
  /* Unsicher gelesen UND nicht im Bestand bestätigt → nicht eintragen,
     sondern zum Antippen anbieten. Am Messstand hatten ALLE falsch gelesenen
     REFs eine Lese-Sicherheit ≤ 59, die richtigen fast alle ≥ 79. Ein
     Fingertipp zum Bestätigen ist billiger als eine falsche REF im Stamm. */
  /* KEINE Ausnahme für „auf mehreren Fotos gleich gelesen": Dieselbe Schrift
     führt zum selben Irrtum (O statt 0 auf allen drei Aufnahmen — am
     Messstand belegt). Übereinstimmung ist dort kein Beleg. */
  if(fields.ref && refInfo && !refInfo.sicher && refInfo.wie==='roh'
     && refLeseSicherheit!=null && refLeseSicherheit<OCR_REF_MINDESTSICHERHEIT){
    const alt=stimmen.map(st=>st.tok).filter(t=>t!==fields.ref).slice(0,2);
    refInfo=Object.assign({}, refInfo, { vorschlaege:[fields.ref].concat(alt), unsicherGelesen:true });
    fields.ref='';
  }
  return { fields, refInfo, refRoh:ent.roh, refLeseSicherheit, kandidaten, gtin, barcode, text:gesamttext,
    confidence:conf, schaerfe:q.length?q[0].schaerfe:null, qualitaet:q, fotos:(fotos||[]).length,
    lesungen:lesungen.map(l=>ocrLesungWort(l.quelle)) };
}

/* Mehrere Fotos DESSELBEN Etiketts gemeinsam lesen. Jede Aufnahme hat andere
   Fehler (Rauschen, Glanz an anderer Stelle, andere Schärfe) — die Mehrheit
   über alle Aufnahmen ist verlässlicher als jede einzelne. */
async function ocrReadLabels(dataUrls, onStatus){
  const liste=(dataUrls||[]).filter(Boolean);
  const sag=(t)=>{ if(typeof onStatus==='function') onStatus(t); };
  ocrSetLogger((m)=>{ const pct=(m.progress!=null)?Math.round(m.progress*100):null;
    sag(ocrStatusLabel(m.status)+(pct!=null?(' '+pct+' %'):' …')); });
  const fotos=[];
  try{
    for(let i=0;i<liste.length;i++){
      const vor=liste.length>1?('Foto '+(i+1)+'/'+liste.length+': '):'';
      fotos.push(await ocrLeseFoto(liste[i], (t)=>sag(vor+t)));
    }
  } finally { ocrSetLogger(null); ocrReleaseWorker(); }
  return ocrZusammenfuehren(fotos);
}
/* Ein einzelnes Foto lesen, OHNE zusammenzuführen — der Assistent hält die
   Ergebnisse je Foto, damit beim zweiten und dritten Foto nicht alles neu
   gelesen werden muss. Zusammenführen dann mit ocrZusammenfuehren(). */
async function ocrLeseFotoEinzeln(dataUrl, onStatus){
  const sag=(t)=>{ if(typeof onStatus==='function') onStatus(t); };
  ocrSetLogger((m)=>{ const pct=(m.progress!=null)?Math.round(m.progress*100):null;
    sag(ocrStatusLabel(m.status)+(pct!=null?(' '+pct+' %'):' …')); });
  try{ return await ocrLeseFoto(dataUrl, sag); }
  finally { ocrSetLogger(null); ocrReleaseWorker(); }
}
/* Ein Foto — kompatibler Einstieg für den Einzelknopf und Alt-Aufrufe. */
async function ocrReadLabel(dataUrl, onStatus){ return ocrReadLabels([dataUrl], onStatus); }

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
/* Letzte Lesung — Grundlage für die LERNSCHLEIFE: Trägt der Nutzer beim
   Speichern eine andere REF ein als gelesen, merkt sich die App das Paar
   (siehe ocrLearnFromSave in scanner.js). */
let ocrLastRead=null;

async function ocrProcess(dataUrl){
  ocrBusy(true, 'OCR startet …');
  try{
    _ocrSharp=null;
    const erg=await ocrReadLabel(dataUrl, (t)=>ocrBusy(true,t));
    ocrLastRead={ roh:erg.refRoh||'', wie:(erg.refInfo&&erg.refInfo.wie)||'roh', at:Date.now() };

    /* GTIN ins Formular — und, falls die REF noch fehlt, den kostenlosen
       Nachschlageweg gehen (eigener Stammsatz → Katalog → AccessGUDID). */
    if(erg.gtin){
      const gi=$('scGtin'); if(gi && !gi.value.trim()) gi.value=erg.gtin;
      if(!erg.fields.ref && typeof gtinAufloesen==='function'){
        ocrBusy(true,'Nummer nachschlagen …');
        try{
          const t=await gtinAufloesen(erg.gtin);
          if(t){ if(t.ref) erg.fields.ref=t.ref;
            if(t.name && !erg.fields.name) erg.fields.name=t.name;
            if(t.hersteller && !erg.fields.hersteller) erg.fields.hersteller=t.hersteller;
            erg.nachschlag=t; }
        }catch(e){}
      }
    }
    const filled=ocrFillForm(erg.fields);
    ocrBusy(false);
    /* Referenz-Katalog gleich zur (neuen) REF prüfen. */
    if(typeof catCheckForm==='function') catCheckForm();
    ocrMeldung(erg, filled);
  }catch(e){ ocrBusy(false); toast('OCR fehlgeschlagen: '+((e&&e.message)||e), true); }
}

/* LERNSCHLEIFE — beim Speichern eines Stammsatzes aufgerufen.
   Weicht die gespeicherte REF von der zuletzt GELESENEN ab, war die Lesung
   falsch und der Mensch hat sie korrigiert. Genau dieses Paar ist Gold wert:
   Beim nächsten Foto desselben Etiketts trifft die App sofort — unabhängig
   davon, ob das Produkt in irgendeinem Katalog steht.
   Bewusst zeitlich begrenzt: nur eine Korrektur, die zur aktuellen Erfassung
   gehört (30 Minuten), wird gelernt. */
const OCR_LERN_FENSTER=30*60*1000;
function ocrLearnFromSave(refFinal){
  try{
    if(!ocrLastRead || !ocrLastRead.roh) return;
    if(Date.now()-(ocrLastRead.at||0) > OCR_LERN_FENSTER){ ocrLastRead=null; return; }
    const ziel=String(refFinal||'').trim();
    const roh=ocrLastRead.roh;
    ocrLastRead=null;
    if(!ziel) return;
    if(typeof refCanon!=='function' || typeof refLearn!=='function') return;
    if(refCanon(roh)===refCanon(ziel)) return;          /* richtig gelesen – nichts zu lernen */
    refLearn(roh, ziel);
  }catch(e){}
}

/* Rückmeldung an den Nutzer — sagt EHRLICH, wie sicher das Ergebnis ist.
   Getrennt gehalten, damit der geführte Dialog dieselbe Sprache spricht. */
function ocrMeldung(erg, filled){
  const got=Object.keys(filled||{});
  const teile=[];
  if(erg.barcode && (erg.barcode.gtin||erg.barcode.itemRef)) teile.push('Barcode gelesen');
  if(erg.nachschlag) teile.push('REF aus '+erg.nachschlag.quelle);
  else if(erg.refInfo && erg.refInfo.sicher && erg.refInfo.wie!=='roh') teile.push('REF '+refWieLabel(erg.refInfo.wie));
  if(got.length) teile.push('Erkannt: '+got.map(ocrFieldLabel).join(', '));
  if(!teile.length){ toast('Kein Text sicher erkannt. Bitte näher/schärfer fotografieren oder manuell eingeben.', true); return; }
  let msg=teile.join(' · ')+' – bitte prüfen.';
  if(erg.refInfo && erg.refInfo.wie==='mehrdeutig' && erg.refInfo.kandidaten.length)
    msg+=' Mögliche REFs: '+erg.refInfo.kandidaten.join(', ');
  else if(erg.refInfo && !erg.fields.ref && (erg.refInfo.vorschlaege||[]).length)
    msg+=' REF nicht sicher – vielleicht: '+erg.refInfo.vorschlaege.join(', ');
  const hinweise=(erg.qualitaet||[]).map(ocrQualitaetsHinweise)[0]||[];
  if(hinweise.length && ocrNochEinFoto(erg)) msg+=' ⚠ '+hinweise[0];
  else if((erg.confidence!=null && erg.confidence<55) || (erg.schaerfe!=null && erg.schaerfe<40))
    msg+=' ⚠ Bild schwierig – schärfer/gerader & näher fotografieren.';
  toast(msg);
}
