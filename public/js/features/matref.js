/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — REF-AUFLÖSUNG (der eigentliche Trick hinter guter Etikett-Erkennung)

   Ausgangslage: Eine OCR liest eine Artikelnummer selten Zeichen für Zeichen
   perfekt. „8FR-B4O" statt „8FR-B40", „RM*RGSJ4O" statt „RM*RG5J40". Wer eine
   Artikelnummer als Freitext behandelt, verliert genau hier.

   Der Ansatz: Eine REF muss nicht PERFEKT gelesen werden — sie muss nur
   UNTERSCHEIDBAR sein. Deshalb wird eine gelesene REF gegen die Menge der
   BEKANNTEN REFs aufgelöst (Referenz-Katalog + eigene Stammsätze + gelernte
   Korrekturen), und zwar in drei Stufen wachsender Toleranz:

     1. exakt              — die gelesene REF steht so im Bestand
     2. Zeichenklasse      — O/0/Q, I/1/L, S/5, B/8, Z/2, G/6 gelten als
                             dasselbe Zeichen. „B4O" trifft damit „840".
     3. ähnlich            — kleine Editier-Distanz (1 Fehler bei kurzen,
                             2 bei langen REFs).

   Sicherheitsregel: Eine Auflösung gilt NUR, wenn sie EINDEUTIG ist. Kollidieren
   zwei bekannte REFs auf derselben Stufe, wird nichts aufgelöst — die Rohlesung
   bleibt stehen. „Leer/roh schlägt falsch."

   Zusätzlich die LERNSCHLEIFE: Korrigiert ein Mensch eine OCR-Lesung, wird das
   Paar (Rohlesung → richtige REF) gemerkt. Beim nächsten Mal gewinnt es sofort.
   Die App wird also mit jeder Nutzung besser — auch bei Produkten, die in
   KEINEM Katalog stehen.

   Alle Kernfunktionen sind rein (arbeiten auf übergebenen Listen) → testbar.
   Geteilter Zustand: `hkl_ocrlearn` (in SHARED_KEYS + BACKUP_KEYS).
   ───────────────────────────────────────────────────────────── */

/* ===== Reine Helfer ===== */

/* Kanonische Form: Großschrift, nur A–Z0–9. Identisch zu catNormRef, hier
   eigenständig, damit das Modul für sich testbar bleibt. */
function refCanon(s){ return String(s==null?'':s).toUpperCase().replace(/[^A-Z0-9]/g,''); }

/* Zeichenklassen: Zeichen, die eine OCR in serifenloser Etikettenschrift
   regelmäßig verwechselt, werden auf EINEN Vertreter abgebildet. Bewusst
   konservativ — nur Paare, die wirklich gleich aussehen. */
const REF_KLASSE = { O:'0', Q:'0', D:'0', I:'1', L:'1', S:'5', B:'8', Z:'2', G:'6' };
/* Schlüssel für den Zeichenklassen-Vergleich. „B4O" und „840" ergeben denselben. */
function refClassKey(s){
  const c=refCanon(s); let out='';
  for(let i=0;i<c.length;i++){ const ch=c.charAt(i); out += (REF_KLASSE[ch]||ch); }
  return out;
}

/* Editier-Distanz (Levenshtein) auf den Zeichenklassen-Schlüsseln: Zeichen
   derselben Klasse kosten nichts, alles andere einen Schritt. Rein/testbar. */
function refDistance(a,b){
  const x=refClassKey(a), y=refClassKey(b);
  const m=x.length, n=y.length;
  if(!m) return n; if(!n) return m;
  let prev=new Array(n+1); for(let j=0;j<=n;j++) prev[j]=j;
  for(let i=1;i<=m;i++){ const cur=[i];
    for(let j=1;j<=n;j++){ const cost=(x.charCodeAt(i-1)===y.charCodeAt(j-1))?0:1;
      cur[j]=Math.min(prev[j]+1, cur[j-1]+1, prev[j-1]+cost); }
    prev=cur; }
  return prev[n];
}

/* Erlaubte Editier-Distanz nach Länge: kurze REFs dürfen sich kaum irren
   (sonst trifft alles auf alles), lange vertragen zwei Fehler. */
function refTolerance(len){ if(len<5) return 0; if(len<8) return 1; return 2; }

/* Ist ein Text-Schnipsel überhaupt eine plausible Artikelnummer?
   Kriterien: ≥4 Zeichen, mindestens eine Ziffer (reine Buchstabenwörter sind
   Produktnamen, keine REFs), nicht nur Ziffern in Datums-/Jahreslänge, und
   kein bekanntes Etiketten-Schlagwort. Rein/testbar. */
const REF_STOPP = ['STERILE','STERILIZE','LATEX','SINGLE','USE','ONLY','MADE','GERMANY','IRELAND','QTY','LOT','BATCH','SERIAL','EXPIRY','CAUTION','WARNING','CONTENTS','LOTNO','REFNO','LOTNR'];
function refPlausible(tok){
  const c=refCanon(tok);
  if(c.length<4 || c.length>24) return false;
  if(!/[0-9]/.test(c)) return false;                    /* Produktnamen raus */
  if(REF_STOPP.indexOf(c)>=0) return false;
  if(/^(19|20)\d{2}$/.test(c)) return false;            /* Jahreszahl */
  if(/^\d{12,14}$/.test(c)) return false;               /* das ist eine GTIN, keine REF */
  return true;
}

/* Baut einen Index über bekannte REFs: exakter Schlüssel und Zeichenklassen-
   Schlüssel, jeweils auf die Liste der Original-REFs. Mehrfach belegte
   Klassen-Schlüssel bleiben mehrfach belegt — das ist genau das Kollisions-
   Signal, an dem später eine Auflösung abgelehnt wird. Rein/testbar. */
function refIndex(refs){
  const exakt={}, klasse={};
  (refs||[]).forEach(r=>{
    const orig=String(r==null?'':r).trim(); if(!orig) return;
    const c=refCanon(orig); if(c.length<4) return;
    if(!exakt[c]) exakt[c]=orig;
    const k=refClassKey(orig);
    (klasse[k]=klasse[k]||[]).push(orig);
  });
  return { exakt, klasse, liste:Object.keys(exakt).map(k=>exakt[k]) };
}

/* Löst eine (womöglich fehlerhaft gelesene) REF gegen einen refIndex auf.
   Liefert IMMER ein Objekt:
     { ref, wie, sicher, kandidaten }
   wie: 'exakt' | 'zeichenklasse' | 'ähnlich' | 'roh' | 'mehrdeutig'
   sicher: true nur bei exakt/zeichenklasse-eindeutig — das Formular darf den
   Wert dann ohne Rückfrage setzen. Rein/testbar. */
function refResolve(raw, idx){
  const roh=String(raw==null?'':raw).trim();
  const c=refCanon(roh);
  const leer={ ref:roh, wie:'roh', sicher:false, kandidaten:[] };
  if(!idx || c.length<4) return leer;

  /* 1) exakt */
  if(idx.exakt[c]) return { ref:idx.exakt[c], wie:'exakt', sicher:true, kandidaten:[idx.exakt[c]] };

  /* 2) Zeichenklasse — nur wenn genau EIN bekannter Eintrag darauf passt */
  const kk=refClassKey(roh); const treffer=idx.klasse[kk]||[];
  const eindeutig=[...new Set(treffer.map(refCanon))];
  if(eindeutig.length===1) return { ref:idx.exakt[eindeutig[0]]||treffer[0], wie:'zeichenklasse', sicher:true, kandidaten:[treffer[0]] };
  if(eindeutig.length>1) return { ref:roh, wie:'mehrdeutig', sicher:false, kandidaten:treffer.slice(0,5) };

  /* 3) ähnlich — bester Treffer innerhalb der Toleranz, muss allein stehen */
  const tol=refTolerance(c.length);
  if(tol>0){
    let beste=[], bestD=tol+1;
    idx.liste.forEach(cand=>{
      const cc=refCanon(cand);
      if(Math.abs(cc.length-c.length)>tol) return;      /* schnelle Vorauswahl */
      const d=refDistance(c, cc);
      if(d<bestD){ bestD=d; beste=[cand]; }
      else if(d===bestD && beste.indexOf(cand)<0) beste.push(cand);
    });
    if(bestD<=tol && beste.length===1) return { ref:beste[0], wie:'ähnlich', sicher:false, kandidaten:beste };
    if(bestD<=tol && beste.length>1) return { ref:roh, wie:'mehrdeutig', sicher:false, kandidaten:beste.slice(0,5) };
  }
  return leer;
}

/* Wie zuverlässig war die Auflösung? Kurzer Text für die Oberfläche. Rein. */
function refWieLabel(wie){
  return ({ 'exakt':'im Bestand gefunden', 'zeichenklasse':'Zeichen korrigiert (0/O, 1/I, 5/S …)',
    'ähnlich':'ähnliche REF im Bestand – bitte prüfen', 'mehrdeutig':'mehrere passende REFs – bitte auswählen',
    'roh':'so gelesen (nicht im Bestand)' })[wie] || '';
}

/* ===== Zustand: Lernschleife ===== */
/* OCRLEARN[klassenSchluesselDerRohlesung] = { ref, n, at } */
let OCRLEARN = (typeof loadJSON==='function') ? loadJSON('hkl_ocrlearn',{}) : {};
function saveOcrLearn(){ if(typeof saveJSON==='function') saveJSON('hkl_ocrlearn', OCRLEARN); }

/* Merkt sich: „so gelesen → das war in Wahrheit diese REF". Rein genug zum
   Testen, wenn man die Map übergibt. */
function refLearnInto(map, roh, ref){
  const k=refClassKey(roh), v=String(ref==null?'':ref).trim();
  if(!k || k.length<4 || !v) return map;
  const alt=map[k];
  map[k]={ ref:v, n:(alt&&alt.ref===v?(alt.n||1)+1:1), at:new Date().toISOString() };
  return map;
}
function refLearn(roh, ref){ refLearnInto(OCRLEARN, roh, ref); saveOcrLearn(); }
/* Nachschlagen in der Lernschleife (liefert die REF oder ''). Rein/testbar. */
function refFromLearn(map, roh){ const e=(map||{})[refClassKey(roh)]; return (e&&e.ref)||''; }

/* ===== Anbindung an die App-Daten ===== */
/* Alle REFs, die die App kennt: Referenz-Katalog (public/data/material_catalog.json),
   eigene Stammsätze (GTINDB) und die Materialien aus den Standards. Der Katalog
   deckt NICHT alles ab — deshalb kommen die selbst gepflegten Stammsätze
   gleichberechtigt dazu, und jede Korrektur erweitert den Bestand über die
   Lernschleife. */
let _refIdxCache=null, _refIdxSize=-1;
function refKnownRefs(){
  const out=[];
  if(typeof MATCAT!=='undefined' && MATCAT) Object.keys(MATCAT).forEach(k=>{ const e=MATCAT[k]; if(e&&e.ref) out.push(e.ref); else out.push(k); });
  if(typeof GTINDB!=='undefined' && GTINDB) Object.keys(GTINDB).forEach(k=>{ const r=GTINDB[k]; if(r&&r.ref) out.push(r.ref); });
  if(typeof PROD!=='undefined' && PROD) Object.keys(PROD).forEach(k=>{ const r=PROD[k]; if(r&&r.ref) out.push(r.ref); });
  return out;
}
/* Gecachter Index (die Liste ändert sich nur beim Anlegen/Ändern von Material). */
function refCurrentIndex(){
  const n=refKnownRefs().length;
  if(_refIdxCache && n===_refIdxSize) return _refIdxCache;
  _refIdxSize=n; _refIdxCache=refIndex(refKnownRefs());
  return _refIdxCache;
}
function refInvalidateIndex(){ _refIdxCache=null; _refIdxSize=-1; }

/* Der eine Aufruf, den die OCR benutzt: Rohlesung → beste REF mit Begründung.
   Reihenfolge: gelernte Korrektur schlägt alles, danach der Bestandsabgleich. */
function refBest(roh){
  const gelernt=refFromLearn(OCRLEARN, roh);
  if(gelernt) return { ref:gelernt, wie:'gelernt', sicher:true, kandidaten:[gelernt] };
  return refResolve(roh, refCurrentIndex());
}
