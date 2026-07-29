/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — MERKMALE (was ein Material auszeichnet)

   Das Problem, das dieser Baustein löst:
   Bisher hat ein Material EINE Zeile „Spezifikation" als Freitext. Auf dem
   Etikett steht aber ein ganzes Bündel harter Eigenschaften — 6 F, EBU 4.0,
   mit Seitenlöchern, 100 cm, Innendurchmesser 1,80 mm. Solange es keinen Ort
   gibt, an dem diese Merkmale getrennt und typisiert liegen, kann auch die
   beste Texterkennung nichts abliefern: Sie liest richtig und wirft es weg.
   Genau deshalb unterscheidet die App heute eine „Agilis NxT ND" nicht von
   einer „LD" — nicht weil sie schlecht liest, sondern weil sie kein Feld dafür
   hat.

   Der Aufbau in drei Schichten:
     1. IDENTITÄT      — GTIN, REF, Hersteller, Name   (gibt es bereits)
     2. MERKMALE       — typisierte Eigenschaften mit Einheit und Herkunft
     3. KOMPATIBILITÄT — Beziehungen: „passt in", „nimmt auf", „braucht"

   Vier Wege zu einem Merkmal, in absteigender Verlässlichkeit:
     ANKER   Ein beschriftetes Feld: „Outer diameter  2.08 mm". Der Wert steht
             direkt neben seiner Bedeutung — das ist die sicherste Lesung.
     REF     Die Artikelnummer trägt die Variante: LA6EBU40SH = 6 F, EBU 4.0,
             mit Seitenlöchern. Kennt man die Grammatik eines Herstellers,
             braucht man die 1-mm-Kleinschrift gar nicht mehr zu entziffern.
     MUSTER  Freitext auf dem Etikett: „6Fr", „190cm", „STERILE EO".
     MENSCH  Jemand hat es eingetragen oder bestätigt. Schlägt alles.

   Sicherheitsregel wie überall in dieser App: LEER SCHLÄGT FALSCH. Ein Wert
   wird nur gesetzt, wenn er in sein Plausibilitätsfenster passt UND eindeutig
   ist. Widersprechen sich zwei starke Quellen, wird NICHT entschieden — beide
   Kandidaten bleiben stehen und ein Mensch wählt.

   Alle Funktionen hier sind rein: sie bekommen Text und Katalog übergeben und
   fassen weder DOM noch Speicher an. Damit sind sie vollständig testbar
   (test/merkmale.test.js prüft sie an echten Etikettentexten).
   ───────────────────────────────────────────────────────────── */

/* Der Katalog wird beim Start geladen (siehe merkLoad unten). Bis dahin leer —
   die App läuft ohne ihn unverändert weiter. */
let MERKKAT = { merkmale: [], klassen: [], einheiten: {}, ref_grammatik: [], kompatibilitaet: { regeln: [] } };

/* ===== Zahlen und Einheiten ===== */

/* Zahl aus einem Etiketten-Schnipsel. Beherrscht Komma als Dezimaltrennzeichen
   (deutsche Etiketten) und gemischte Brüche wie „1 2/5" (Terumo schreibt
   Nadellängen in Zoll so). Gibt null zurück, wenn nichts Zählbares dasteht. */
function merkZahl(s){
  const t = String(s==null?'':s).trim().replace(/ /g,' ');
  if(!t) return null;
  /* gemischter Bruch: „1 2/5" */
  let m = t.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)/);
  if(m){ const n=+m[2], d=+m[3]; if(d) return +m[1] + n/d; }
  /* reiner Bruch: „2/5" */
  m = t.match(/^(\d+)\s*\/\s*(\d+)/);
  if(m){ const d=+m[2]; if(d) return +m[1]/d; }
  m = t.match(/-?\d+(?:[.,]\d+)?/);
  if(!m) return null;
  const z = parseFloat(m[0].replace(',','.'));
  return isFinite(z) ? z : null;
}

/* Umrechnung in Millimeter. Gauge (G) ist nicht linear und kommt aus einer
   Tabelle; alles andere ist ein Faktor. Unbekannte Einheit → null (nicht raten). */
function merkNachMm(wert, einheit, einheiten){
  const z = (typeof wert==='number') ? wert : merkZahl(wert);
  if(z==null) return null;
  const eh = einheiten || (MERKKAT && MERKKAT.einheiten) || {};
  const e = String(einheit||'').trim();
  const def = eh[e];
  if(!def) return null;
  if(def._tabelle){ const v = def._tabelle[String(Math.round(z))]; return (v==null)?null:v; }
  if(typeof def.mm === 'number') return z * def.mm;
  return null;
}

/* Umrechnung zwischen zwei Längeneinheiten über Millimeter als Drehscheibe.
   Auf drei Nachkommastellen gerundet — mehr Genauigkeit täuscht nur vor. */
function merkKonvert(wert, von, nach, einheiten){
  const mm = merkNachMm(wert, von, einheiten);
  if(mm==null) return null;
  const eh = einheiten || (MERKKAT && MERKKAT.einheiten) || {};
  const ziel = eh[String(nach||'').trim()];
  if(!ziel || typeof ziel.mm !== 'number' || !ziel.mm) return null;
  return Math.round((mm / ziel.mm) * 1000) / 1000;
}

/* Passt ein Zahlenwert in das Plausibilitätsfenster seines Merkmals?
   Das Fenster ist der wichtigste Schutz gegen Unsinn: Auf dem Blazer-Etikett
   stehen „8 mm" (Spitze), „2.5 mm" (Elektrodenabstand), „10.2 cm" und „110 cm"
   nebeneinander. Ohne Fenster landet die Spitzenlänge als Katheterlänge. */
function merkPlausibel(def, wert){
  if(!def) return false;
  const f = def.fenster;
  if(!Array.isArray(f) || f.length!==2) return true;      /* kein Fenster = alles erlaubt */
  const z = (typeof wert==='number') ? wert : merkZahl(wert);
  if(z==null) return false;
  return z >= f[0] && z <= f[1];
}

/* ===== Musterbau ===== */

/* Für Maß-Merkmale genügt oft ein generisches Muster, das aus der Einheit
   folgt. So muss nicht für jedes Merkmal ein eigener Ausdruck gepflegt werden. */
const MERK_EINHEIT_MUSTER = {
  'mm':      '(\\d{1,3}(?:[.,]\\d{1,3})?)\\s*mm',
  'cm':      '(\\d{1,3}(?:[.,]\\d{1,2})?)\\s*(?:±\\s*\\d+(?:[.,]\\d+)?\\s*)?cm',
  'in':      '(\\d?[.,]\\d{2,3})\\s*(?:in\\b|inch|"|″|”)',
  'F':       '\\b(\\d{1,2}(?:[.,]\\d)?)\\s*(?:French|Fr\\.|Fr|F)(?![A-Za-z0-9])',
  'G':       '(\\d{1,2})\\s*G(?![a-zA-Z])',
  'atm':     '(\\d{1,2})\\s*(?:atm)?',
  'psi':     '(\\d{3,4})\\s*psi',
  'ml':      '(\\d{1,4})\\s*ml',
  '%':       '(\\d{1,2}(?:[.,]\\d{1,2})?)\\s*%',
  '°':       '(\\d{1,3})\\s*°',
  'g':       '(\\d{1,2}(?:[.,]\\d)?)\\s*g(?![a-zA-Z])',
  'mosm/l':  '(\\d{3,4})\\s*mosm'
};
function merkEinheitMuster(def){
  if(!def || !def.einheit) return null;
  return MERK_EINHEIT_MUSTER[def.einheit] || null;
}

/* Beschriftetes Zahlenfeld OHNE Einheit: „Lumen  2", „Quantity 1".
   Der Wert steht dann unmittelbar hinter der Beschriftung — deshalb ist dieses
   Muster am Anfang des Fensters verankert und greift nirgends sonst. */
const MERK_ANKER_ZAHL = '^\\s*[:=]?\\s*(\\d{1,4})(?![.,]?\\d*\\s*(?:mm|cm|in|"|%))\\b';

/* Regulären Ausdruck sicher bauen. Ein kaputtes Muster im Katalog (den ein
   Mensch pflegt!) darf die App NIE zum Absturz bringen — es wird still
   übergangen. */
function merkRegex(quelle, flags){
  try { return new RegExp(quelle, flags==null?'i':flags); } catch(_) { return null; }
}

/* Muster laufen normalerweise ohne Rücksicht auf Groß-/Kleinschreibung — auf
   Etiketten steht mal „Sterile", mal „STERILE". Wo die Schreibweise selbst die
   Aussage trägt (Ländernamen, Kürzel wie „SH"), setzt der Katalog `streng`. */
function merkFlags(def, global){
  const f = (def && def.streng) ? '' : 'i';
  return global ? ('g'+f) : f;
}

/* Etikettentext für die Suche vereinheitlichen: Zeilenumbrüche werden zu
   Leerzeichen (ein beschriftetes Feld und sein Wert stehen oft in getrennten
   Zeilen), Mehrfach-Leerzeichen schrumpfen. Die Groß-/Kleinschreibung bleibt,
   damit „SH" nicht mit „sh" aus einem Fließtext verwechselt wird. */
function merkNormText(text){
  return String(text==null?'':text).replace(/[\r\n\t]+/g,' ').replace(/\s{2,}/g,' ').trim();
}

/* ===== Die vier Wege zu einem Merkmal ===== */

/* WEG 1 — ANKER: „Outer diameter 0.082 In 2.08 mm"
   Wir suchen das beschriftende Wort und lesen den Wert im Fenster dahinter.
   Das Fenster ist bewusst kurz (Vorgabe 60 Zeichen): Je weiter weg, desto
   wahrscheinlicher gehört die Zahl zu etwas anderem. */
function merkAnkerFund(text, def, fenster){
  const t = merkNormText(text);
  const anker = (def && def.anker) || [];
  if(!anker.length) return null;
  const weite = fenster || 60;
  const wertMuster = merkEinheitMuster(def);
  const musterListe = [].concat(def.muster || []);
  if(wertMuster) musterListe.push(wertMuster);
  else if(def.typ === 'zahl') musterListe.push(MERK_ANKER_ZAHL);
  if(!musterListe.length) return null;
  const tl = t.toLowerCase();
  for(let i=0;i<anker.length;i++){
    const a = String(anker[i]||'').toLowerCase();
    if(!a) continue;
    let von = 0;
    for(;;){
      const p = tl.indexOf(a, von);
      if(p < 0) break;
      von = p + a.length;
      /* `anker_davor`: Der Wert steht LINKS der Beschriftung. Etiketten drucken
         die Nummer groß und schreiben die Erklärung als Bildunterschrift
         darunter — dann liegt der Wert im Text vor dem Ankerwort. */
      const schnipsel = def.anker_davor
        ? t.slice(Math.max(0, p - weite), p)
        : t.slice(von, von + weite);
      for(let k=0;k<musterListe.length;k++){
        const re = merkRegex(musterListe[k], merkFlags(def, false));
        if(!re) continue;
        const m = schnipsel.match(re);
        if(m){
          const roh = (m[1]!=null ? m[1] : m[0]);
          if(def.typ==='mass' || def.typ==='zahl'){ if(!merkPlausibel(def, roh)) continue; }
          return { wert: roh, treffer: m[0], anker: anker[i], herkunft: 'anker' };
        }
      }
    }
  }
  return null;
}

/* WEG 2 — MUSTER: freistehender Text auf dem Etikett. Unsicherer als der
   Anker, weil niemand dabeigeschrieben hat, was die Zahl bedeutet. Deshalb
   gilt hier das Plausibilitätsfenster besonders streng, und mehrere
   unterschiedliche Treffer machen das Merkmal mehrdeutig statt falsch. */
function merkMusterFund(text, def){
  /* Manche Muster ergeben nur DIREKT hinter ihrer Beschriftung einen Sinn —
     „das Wort nach ‚Made in'" ist ohne den Anker bloß das erste Wort des
     Etiketts. Solche Merkmale markiert der Katalog mit `nur_anker`. */
  if(def && def.nur_anker) return [];
  const t = merkNormText(text);
  const musterListe = [].concat((def && def.muster) || []);
  const out = [];
  const gesehen = {};
  /* Bei geschlossenen Wertelisten (Ja/Nein, Auswahl) sind die Muster bewusst
     von speziell nach allgemein geordnet: „STERILE EO" ist genauer als „STERILE".
     Dort gewinnt das erste greifende Muster, sonst würde derselbe Sachverhalt
     zweimal — und damit scheinbar widersprüchlich — gefunden. Bei Maßen wird
     dagegen alles gesammelt, weil dort echte Mehrdeutigkeit auffallen SOLL. */
  const einTreffer = (def.typ==='ja_nein' || def.typ==='liste');
  for(let k=0;k<musterListe.length;k++){
    const re = merkRegex(musterListe[k], merkFlags(def, true));
    if(!re) continue;
    let m, hatte = false;
    while((m = re.exec(t)) !== null){
      if(m[0]===''){ re.lastIndex++; continue; }
      const roh = (m[1]!=null ? m[1] : m[0]);
      if(def.typ==='mass' || def.typ==='zahl'){ if(!merkPlausibel(def, roh)) continue; }
      const schl = String(roh).toUpperCase().trim();
      hatte = true;
      if(gesehen[schl]) continue;
      gesehen[schl] = true;
      out.push({ wert: roh, treffer: m[0], herkunft: 'muster' });
      if(einTreffer) return out;      /* geschlossene Liste: der erste Treffer ist die Aussage */
    }
    if(hatte && einTreffer) return out;
  }
  /* Merkmal mit fester Werteliste: auch der ausgeschriebene Wert selbst zählt. */
  if(def && Array.isArray(def.werte) && !out.length){
    const tu = t.toUpperCase();
    def.werte.forEach(w=>{
      const wu = String(w).toUpperCase();
      if(!wu || gesehen[wu]) return;
      /* An Wortgrenzen prüfen — sonst fände „PE" sich mitten in „ImPElla"
         und die Schleuse bekäme ein Material, das nirgends draufsteht. */
      const re = merkRegex('(?:^|[^A-Z0-9])' + wu.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '(?:[^A-Z0-9]|$)', '');
      if(re && re.test(tu)){ gesehen[wu]=true; out.push({ wert:w, treffer:w, herkunft:'muster' }); } });
  }
  return out;
}

/* WEG 3 — REF-GRAMMATIK. Die Artikelnummer ist der verlässlichste Text auf
   dem Etikett: Sie steht groß, sie ist bereits gegen den Bestand aufgelöst
   (matref.js), und sie kodiert bei fast jedem Hersteller die Variante.
   Rückgabe: { merkmalId: {wert, herkunft:'ref', grammatik} } */
function merkRefFelder(ref, grammatik){
  const out = {};
  const r = String(ref==null?'':ref).trim().toUpperCase();
  if(!r) return out;
  const liste = grammatik || (MERKKAT && MERKKAT.ref_grammatik) || [];
  for(let i=0;i<liste.length;i++){
    const g = liste[i];
    if(!g || !g.muster) continue;
    const re = merkRegex(g.muster, '');
    if(!re) continue;
    const m = r.match(re);
    if(!m) continue;
    (g.felder||[]).forEach(f=>{
      let roh = m[f.gruppe];
      if(roh==null || roh==='') return;
      /* „wenn" bildet einen Code auf Klartext ab: SH → ja, J → J-Tip */
      if(f.wenn){ const k = String(roh).toUpperCase(); if(!(k in f.wenn)) return; roh = f.wenn[k]; }
      /* „anhaengen" klebt eine zweite Gruppe an (EBU + 40 → EBU40) */
      else if(f.anhaengen!=null && m[f.anhaengen]!=null) roh = roh + (f.trenner||'') + m[f.anhaengen];
      /* „teiler" macht aus 275 die 2,75 mm */
      else if(f.teiler){ const z = merkZahl(roh); if(z==null) return; roh = String(z / f.teiler); }
      /* Führende Nullen aus dem REF-Raster wegräumen: „020" ist 20 mm. */
      if(f.einheit && /^0\d+$/.test(String(roh))){ const z = merkZahl(roh); if(z!=null) roh = String(z); }
      out[f.merkmal] = { wert: roh, herkunft: 'ref', grammatik: g.id, einheit: f.einheit || null };
    });
    break;   /* die erste passende Grammatik gewinnt */
  }
  return out;
}

/* ===== Klassifizierung ===== */

/* Welche Materialart liegt hier? Ohne Klasse wüsste die App nicht, welche
   Merkmale überhaupt gefragt sind — und würde an einer Kompresse nach
   Kurvenformen suchen. Bewertet wird über die Signalwörter der Klasse;
   längere Wörter zählen mehr, weil sie eindeutiger sind. */
function merkKlassifizieren(text, klassen){
  const t = merkNormText(text).toLowerCase();
  const liste = klassen || (MERKKAT && MERKKAT.klassen) || [];
  let beste = null, bestPunkte = 0;
  const alle = [];
  liste.forEach(k=>{
    /* Ausschlusswörter zuerst: „Ablationskatheter" steckt wörtlich in
       „Kryoablationskatheter". Ohne Ausschluss gewänne die HF-Ablation bei
       jedem Kryokatheter. Das ist der Preis dafür, dass Klassen über Wörter
       erkannt werden — und der Katalog löst es ohne Codeänderung. */
    const aus = (k.nicht||[]).some(w=>{ const wl=String(w||'').toLowerCase(); return wl && t.indexOf(wl)>=0; });
    if(aus) return;
    let p = 0;
    (k.worte||[]).forEach(w=>{
      const wl = String(w||'').toLowerCase();
      if(wl && t.indexOf(wl) >= 0) p += wl.length;
    });
    if(p > 0) alle.push({ id:k.id, label:k.label, punkte:p });
    if(p > bestPunkte){ bestPunkte = p; beste = k; }
  });
  alle.sort((a,b)=>b.punkte-a.punkte);
  return { klasse: beste ? beste.id : 'allgemein',
           label: beste ? beste.label : 'Allgemein / nicht zugeordnet',
           sicher: bestPunkte > 0 && (alle.length < 2 || alle[0].punkte > alle[1].punkte * 1.5),
           kandidaten: alle };
}

/* Welche Merkmale gelten für eine Klasse? Merkmale mit der Klasse „allgemein"
   (steril, Latex, Einmalgebrauch …) gelten immer. */
function merkFuerKlasse(katalog, klasseId){
  const kat = katalog || MERKKAT;
  const alle = (kat && kat.merkmale) || [];
  return alle.filter(d=>{
    const ks = d.klassen || [];
    return ks.indexOf(klasseId) >= 0 || ks.indexOf('allgemein') >= 0;
  }).sort((a,b)=> (a.rang||99) - (b.rang||99));
}

/* ===== Zusammenführen ===== */

/* Verlässlichkeitsrang der Quellen. „mensch" gibt es hier nicht — was ein
   Mensch eingetragen hat, wird gar nicht erst überschrieben (das entscheidet
   die aufrufende Stelle, nicht dieser Baustein). */
const MERK_RANG = { anker: 3, ref: 2, muster: 1 };

/* Aus allen Kandidaten eines Merkmals genau ein Ergebnis machen.
   Regeln:
     • Die stärkste Quelle gewinnt.
     • Zwei verschiedene Werte auf derselben Stufe → NICHT entscheiden.
       Das Merkmal kommt als „mehrdeutig" zurück, damit ein Mensch wählt.
     • Ein reiner Mustertreffer ist bei Zahlen nie „sicher" — bei Merkmalen mit
       fester Werteliste oder Ja/Nein dagegen schon, weil dort kaum etwas
       verwechselt werden kann. */
/* Vergleichsschlüssel: Zwei Funde meinen dasselbe, wenn sie sich nur in der
   Schreibweise unterscheiden. „EBU4.0" (Schachtelfront) und „EBU40" (aus der
   REF) sind KEIN Widerspruch. Bei Maßen entscheidet der Zahlenwert, sonst die
   Buchstaben-/Ziffernfolge. */
/* Der Schlüssel trägt immer ein Präfix. Das ist kein Schönheitsfehler: Reine
   Zifferntexte wären für JavaScript Array-Indizes und würden in der
   Reihenfolge der Objektschlüssel numerisch nach vorn sortiert — dann gewänne
   bei `mehrfach:"erste"` nicht der erste Fund, sondern der kleinste Zahlenwert. */
function merkSchluessel(def, wert){
  if(def && (def.typ==='mass' || def.typ==='zahl')){
    const z = merkZahl(wert);
    return (z==null) ? ('k'+String(wert).toUpperCase()) : ('n'+z);
  }
  return 'k' + String(wert==null?'':wert).toUpperCase().replace(/[^A-Z0-9]/g,'');
}

function merkEntscheiden(def, kandidaten){
  const k = (kandidaten||[]).filter(x=>x && x.wert!=null && x.wert!=='');
  if(!k.length) return null;
  /* Nach Bedeutung bündeln, nicht nach Zeichenkette. */
  const gruppen = {};
  k.forEach(x=>{
    const s = merkSchluessel(def, x.wert);
    const g = gruppen[s] || (gruppen[s] = { rang:0, eintraege:[] });
    g.eintraege.push(x);
    const r = MERK_RANG[x.herkunft]||0; if(r > g.rang) g.rang = r;
  });
  let schluessel = Object.keys(gruppen);
  const top = schluessel.reduce((a,s)=>Math.max(a, gruppen[s].rang), 0);
  schluessel = schluessel.filter(s=>gruppen[s].rang===top);

  /* Mehrere echte Bedeutungen auf derselben Stufe. Manche Merkmale haben dafür
     eine fachliche Regel (`mehrfach`): Der Nenndurchmesser eines Drahtes ist
     definitionsgemäß der GRÖSSTE der gefundenen Werte — die kleineren gehören
     zur Spitze. Ohne solche Regel wird NICHT entschieden. */
  if(schluessel.length > 1){
    const regel = def.mehrfach;
    if(regel === 'erste'){
      schluessel = [schluessel.reduce((a,s)=> a===null?s:a, null)];
    } else if(regel === 'max' || regel === 'min'){
      const zahl = s=>merkZahl(gruppen[s].eintraege[0].wert);
      schluessel = [schluessel.reduce((a,s)=>{
        const za=zahl(a), zs=zahl(s);
        if(za==null) return s; if(zs==null) return a;
        return (regel==='max' ? (zs>za?s:a) : (zs<za?s:a));
      })];
    } else {
      return { id:def.id, label:def.label, kurz:def.kurz||def.label, typ:def.typ,
               einheit:def.einheit||null, wert:null, sicher:false, mehrdeutig:true,
               herkunft: gruppen[schluessel[0]].eintraege[0].herkunft,
               kandidaten: schluessel.map(s=>gruppen[s].eintraege[0].wert),
               badge:!!def.badge, warnung:!!def.warnung, rang:def.rang||99 };
    }
  }

  /* Innerhalb der Gruppe gewinnt die ausführlichste Schreibweise — sie kommt
     vom Etikett und ist die, die eine Pflegekraft wiedererkennt. */
  const eintraege = gruppen[schluessel[0]].eintraege;
  const g = eintraege.reduce((a,b)=> String(b.wert).length > String(a.wert).length ? b : a);
  const quelle = eintraege.reduce((a,b)=> (MERK_RANG[b.herkunft]||0) > (MERK_RANG[a.herkunft]||0) ? b : a);
  const festeWerte = (def.typ==='ja_nein' || def.typ==='liste' || Array.isArray(def.werte));
  const sicher = (top >= 2) || (top === 1 && festeWerte);
  return { id:def.id, label:def.label, kurz:def.kurz||def.label, typ:def.typ,
           einheit: quelle.einheit || def.einheit || null,
           wert: g.wert, sicher: sicher, mehrdeutig:false,
           herkunft: quelle.herkunft, treffer: g.treffer||null,
           bestaetigt: eintraege.length > 1,   /* mehrere Wege, gleicher Wert */
           badge: !!def.badge, warnung: !!def.warnung, rang: def.rang||99 };
}

/* Ein Ja/Nein-Merkmal hat getroffen, sobald sein Muster greift — der Treffer
   selbst ist die Aussage („DO NOT REUSE" → ja). Werte mit einer Abbildung
   (`abbild`) werden auf ihren Klartext gebracht. */
function merkWertNormieren(def, roh){
  if(roh==null) return null;
  /* Die Abbildung wird ZUERST befragt — auch bei Ja/Nein. Sonst würde
     „Do not resterilize" zu „resterilisierbar: ja" und damit die Aussage des
     Etiketts ins Gegenteil verkehrt. Genau solche Verneinungen stehen auf
     Medizinprodukt-Etiketten überall. */
  if(def.abbild){
    const k = String(roh).toUpperCase().replace(/[\s\-_]+/g,' ').trim();
    if(k in def.abbild) return def.abbild[k];
  }
  if(def.typ === 'ja_nein'){
    const s = String(roh).toLowerCase();
    if(s==='nein' || s==='ja') return roh;
    return 'ja';
  }
  return roh;
}

/* HAUPTFUNKTION — aus einem Etikettentext (und optional der bereits
   aufgelösten REF) die Merkmale gewinnen.

   Rückgabe:
     { klasse, klasseLabel, klasseSicher, merkmale:[…], mehrdeutig:[…] }

   `merkmale` sind die verwertbaren Funde in Anzeigereihenfolge, `mehrdeutig`
   die, bei denen sich Quellen widersprechen — die gehören in den Dialog, nicht
   in den Datensatz. */
function merkSammeln(text, ref, katalog){
  const kat = katalog || MERKKAT;
  const kl = merkKlassifizieren(text, kat.klassen);
  const defs = merkFuerKlasse(kat, kl.klasse);
  const refFelder = merkRefFelder(ref, kat.ref_grammatik);
  const gut = [], unklar = [];
  defs.forEach(def=>{
    const kand = [];
    const a = merkAnkerFund(text, def);
    if(a) kand.push(a);
    merkMusterFund(text, def).forEach(m=>kand.push(m));
    if(refFelder[def.id]) kand.push(refFelder[def.id]);
    const e = merkEntscheiden(def, kand);
    if(!e) return;
    if(e.mehrdeutig){ unklar.push(e); return; }
    e.wert = merkWertNormieren(def, e.wert);
    gut.push(e);
  });
  /* Merkmale aus der REF-Grammatik, die in dieser Klasse gar nicht vorgesehen
     sind (z. B. „rolle" beim Evolut-Ladesystem), gehen nicht verloren. */
  Object.keys(refFelder).forEach(id=>{
    if(gut.some(x=>x.id===id) || unklar.some(x=>x.id===id)) return;
    if(defs.some(d=>d.id===id)) return;
    const f = refFelder[id];
    gut.push({ id:id, label:id, kurz:id, typ:'text', einheit:f.einheit||null,
               wert:f.wert, sicher:true, mehrdeutig:false, herkunft:'ref', badge:false, warnung:false, rang:80 });
  });
  gut.sort((a,b)=>(a.rang||99)-(b.rang||99));
  return { klasse: kl.klasse, klasseLabel: kl.label, klasseSicher: kl.sicher,
           klasseKandidaten: kl.kandidaten, merkmale: gut, mehrdeutig: unklar };
}

/* ===== Anzeige ===== */

/* Ein Merkmal als kurze Zeile: „AD 6 F". Für die Kachel-/Badge-Darstellung. */
function merkKurzText(m){
  if(!m || m.wert==null || m.wert==='') return '';
  const w = String(m.wert);
  const e = m.einheit ? (' ' + m.einheit) : '';
  /* Ja/Nein braucht keine Einheit und kein „ja" — das Merkmal selbst ist die Aussage. */
  if(m.typ === 'ja_nein') return (w==='nein') ? ('kein ' + (m.kurz||m.label)) : (m.kurz||m.label);
  return (m.kurz||m.label) + ' ' + w + e;
}

/* Die Badges, die in einer Liste unter dem Produktnamen stehen sollen:
   nur Leitmerkmale, höchstens `max` Stück. Mehr macht die Zeile unlesbar. */
function merkBadges(merkmale, max){
  return (merkmale||[]).filter(m=>m.badge && m.wert!=null && m.wert!=='')
    .slice(0, max||5).map(merkKurzText).filter(Boolean);
}

/* Fehlende Leitmerkmale einer Klasse benennen. Das ist die Grundlage für
   „dieses Material ist noch nicht sauber erfasst" — und damit für eine
   Arbeitsliste statt eines Bauchgefühls. */
function merkLuecken(klasseId, merkmale, katalog){
  const kat = katalog || MERKKAT;
  const kl = (kat.klassen||[]).filter(k=>k.id===klasseId)[0];
  if(!kl) return [];
  const da = {};
  (merkmale||[]).forEach(m=>{ if(m.wert!=null && m.wert!=='') da[m.id]=true; });
  return (kl.leit||[]).filter(id=>!da[id]).map(id=>{
    const d = (kat.merkmale||[]).filter(x=>x.id===id)[0];
    return { id:id, label: d ? d.label : id };
  });
}

/* ===== Kompatibilität ===== */

/* Beantwortet „passt das zusammen?" für ein Paar aus zwei Merkmalslisten.
   Alle Vergleiche laufen über Millimeter, damit 6 F und 0,071″ vergleichbar
   werden. Fehlt eine der beiden Angaben, lautet die Antwort „unbekannt" —
   nicht „ja". */
function merkPasst(regel, linksMerkmale, rechtsMerkmale, einheiten){
  const finde = (liste,id)=>{ const a=(liste||[]).filter(m=>m.id===id)[0]; return a||null; };
  const l = finde(linksMerkmale, regel.links.merkmal);
  const r = finde(rechtsMerkmale, regel.rechts.merkmal);
  if(!l || !r || l.wert==null || r.wert==null) return { antwort:'unbekannt', grund:'Angabe fehlt' };
  const lmm = merkNachMm(l.wert, l.einheit, einheiten);
  const rmm = merkNachMm(r.wert, r.einheit, einheiten);
  if(lmm==null || rmm==null) return { antwort:'unbekannt', grund:'Einheit unbekannt' };
  /* `vergleich` gilt wörtlich als „links OP rechts". Beispiel: Ein Katheter
     passt durch eine Schleuse, wenn Katheter-AD ≤ Schleusen-ID. */
  const tol = regel.toleranz_mm || 0;
  let ok;
  if(regel.vergleich === '<=') ok = (lmm <= rmm + tol);
  else if(regel.vergleich === '>=') ok = (lmm + tol >= rmm);
  else ok = (Math.abs(lmm - rmm) <= (tol||0.01));
  return { antwort: ok ? 'ja' : 'nein',
           grund: (Math.round(lmm*100)/100) + ' mm gegen ' + (Math.round(rmm*100)/100) + ' mm' };
}

/* ===== Laden ===== */

/* Der Katalog liegt als Datei bei (public/data/merkmale.json) und ist damit
   ohne Codeänderung pflegbar. Geladen wird er von loadMaterialData() in
   js/data/load.js — im selben Zug wie der Referenz-Katalog, nach dem ersten
   Render und bewusst tolerant: Fehlt die Datei, läuft die App unverändert
   weiter, nur ohne Merkmalserkennung. */
function merkSetData(j){
  if(j && Array.isArray(j.merkmale)) MERKKAT = j;
  return MERKKAT;
}

/* Zahl der Merkmale, die für eine Klasse überhaupt vorgesehen sind — für die
   Anzeige „7 von 12 Merkmalen erfasst" in der Materialverwaltung. */
function merkAbdeckung(klasseId, merkmale, katalog){
  const soll = merkFuerKlasse(katalog || MERKKAT, klasseId).length;
  const ist = (merkmale||[]).filter(m=>m.wert!=null && m.wert!=='').length;
  return { ist: ist, soll: soll, anteil: soll ? Math.round(ist/soll*100) : 0 };
}

/* ═══════════════════════════════════════════════════════════════
   AM MATERIALSTAMMSATZ

   Der Stammsatz bekommt zwei neue Felder:
     r.klasse   — die Materialklasse ('fuehrungskatheter', 'schleuse' …)
     r.merkmale — { merkmalId: Wert } — das, was ein MENSCH eingetragen
                  oder bestätigt hat

   Trennung mit Absicht: Was aus einem Foto stammt, ist ein Vorschlag und
   lebt nur im Erfassungsdialog. Erst wenn jemand speichert, wird daraus ein
   Wert am Stammsatz — und der wird nie wieder automatisch überschrieben.
   ═══════════════════════════════════════════════════════════════ */

/* Die gespeicherten Merkmale eines Stammsatzes als Anzeigeliste — in der
   Reihenfolge des Katalogs, mit Beschriftung, Einheit und Warnkennung. */
function merkAusSatz(r, katalog){
  const kat = katalog || MERKKAT;
  if(!r || !r.merkmale) return [];
  const klasse = r.klasse || 'allgemein';
  const defs = merkFuerKlasse(kat, klasse);
  const out = [];
  const gesehen = {};
  defs.forEach(d=>{
    const v = r.merkmale[d.id];
    if(v==null || v==='') return;
    gesehen[d.id] = true;
    out.push({ id:d.id, label:d.label, kurz:d.kurz||d.label, typ:d.typ,
               einheit:d.einheit||null, wert:v, sicher:true, herkunft:'mensch',
               badge:!!d.badge, warnung:!!d.warnung, rang:d.rang||99 });
  });
  /* Merkmale, die zur Klasse nicht (mehr) passen, gehen nicht verloren —
     sonst verschwände stillschweigend Handarbeit, wenn jemand die Klasse
     ändert. Sie erscheinen hinten, mit ihrer Kennung als Beschriftung. */
  Object.keys(r.merkmale).forEach(id=>{
    if(gesehen[id]) return;
    const v = r.merkmale[id];
    if(v==null || v==='') return;
    const d = (kat.merkmale||[]).filter(x=>x.id===id)[0];
    out.push({ id:id, label:(d?d.label:id), kurz:(d&&d.kurz)||id, typ:(d?d.typ:'text'),
               einheit:(d&&d.einheit)||null, wert:v, sicher:true, herkunft:'mensch',
               badge:false, warnung:!!(d&&d.warnung), rang:95, fremd:true });
  });
  out.sort((a,b)=>(a.rang||99)-(b.rang||99));
  return out;
}

/* Vorschläge aus einem Etikett mit dem verbinden, was schon am Stammsatz
   steht. Regel: Der Mensch schlägt alles. Ein bereits gespeicherter Wert
   wird NIE durch einen Fund überschrieben — er wird höchstens bestätigt.
   Rückgabe: { uebernehmen:[…], bestaetigt:[…], abweichend:[…] } */
function merkAbgleich(gefunden, gespeichert){
  const alt = gespeichert || {};
  const uebernehmen = [], bestaetigt = [], abweichend = [];
  (gefunden||[]).forEach(f=>{
    const a = alt[f.id];
    if(a==null || a===''){ uebernehmen.push(f); return; }
    const gleich = merkSchluessel({typ:f.typ}, a) === merkSchluessel({typ:f.typ}, f.wert);
    if(gleich) bestaetigt.push(f);
    else abweichend.push({ id:f.id, label:f.label, alt:a, neu:f.wert, herkunft:f.herkunft });
  });
  return { uebernehmen: uebernehmen, bestaetigt: bestaetigt, abweichend: abweichend };
}

/* Prüfung beim Speichern: Welche eingetragenen Werte liegen außerhalb ihres
   Plausibilitätsfensters? Das BLOCKIERT nicht — es warnt. Ein Etikett darf
   den Katalog überstimmen, denn das Etikett ist die Wirklichkeit. */
function merkPruefe(werte, klasseId, katalog){
  const kat = katalog || MERKKAT;
  const mahnungen = [];
  Object.keys(werte||{}).forEach(id=>{
    const v = werte[id];
    if(v==null || v==='') return;
    const d = (kat.merkmale||[]).filter(x=>x.id===id)[0];
    if(!d || (d.typ!=='mass' && d.typ!=='zahl')) return;
    if(!merkPlausibel(d, v)){
      mahnungen.push({ id:id, label:d.label, wert:v, fenster:d.fenster,
        text: d.label + ' „' + v + '" liegt außerhalb des üblichen Bereichs ('
              + d.fenster[0] + '–' + d.fenster[1] + (d.einheit?(' '+d.einheit):'') + ')' });
    }
  });
  return mahnungen;
}
