/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — ZERLEGUNG (Produkt · Verwendung · Position)

   Das Problem, das dieser Baustein löst, ist der Kern der ganzen App:

     „1x 500ml NaCl-Flasche in die große Coro-Set-Schale, auf Ansage"
        ↓        ↓                    ↓                      ↓
      Menge   PRODUKT             VERWENDUNG            BEDINGUNG

   In der Word-Vorlage war das EINE Tabellenzeile. Der Import hat daraus EINEN
   Eintrag mit EINEM Namen gemacht — und der Name wurde zur Identität des
   Materials. Deshalb sind 49 % der Materialschlüssel Sätze statt Produkte,
   deshalb ist Heparin fünf verschiedene Materialien, deshalb ist
   „Raumkontrolle" das viertgrößte Gerät des Hauses.

   Dieser Baustein zieht die Sachverhalte auseinander. Er arbeitet SUBTRAKTIV:
   Was erkannt wird, wird vom Text abgezogen. Was übrig bleibt, ist der
   Produktkern. Was weder abgezogen werden konnte noch als Kern plausibel ist,
   kommt als sichtbarer REST zurück.

   Drei Grundsätze, aus dem Merkmalskatalog übernommen (sie haben dort getragen):

     ① LEER SCHLÄGT FALSCH. Im Zweifel art='unklar' statt geraten.
     ② NICHTS VERSCHLUCKEN. Jedes Zeichen landet entweder in einem Feld oder
        im Rest — ein stiller Verlust wäre schlimmer als eine Lücke.
     ③ DER MENSCH SCHLÄGT ALLES. Die Zerlegung ist ein Vorschlag. Bestätigtes
        wird nie überschrieben.

   Und ein vierter, der für dieses Haus gilt:

     ④ KEIN FACHWORT IM CODE. Verben, Marker, Orte, Präparate, Farben stehen
        ausschließlich in public/data/zerlegung.json und sind ohne
        Programmierung pflegbar.

   Der Baustein fasst weder DOM noch Speicher an — er ist rein und testbar.
   ───────────────────────────────────────────────────────────── */

let ZERLKAT = { putzen:[], artefakte:[], taetigkeit:{verben:[],substantive:[]}, bedingung:{marker:[]},
  anweisung:{marker:[]}, ort:{woerter:[],muster:[],aus_unterkategorie:[]}, ziel:{muster:[]},
  zweck:{muster:[]}, alternative:{trenner:[],nicht_trennen:[]}, menge:{einheiten:[]},
  farbe:{werte:[]}, praeparat:{woerter:[]}, eigenschaft:{werte:[]}, mass:{}, kern:{}, art_regeln:{} };

function zerlSetData(j){ if(j && typeof j==='object') ZERLKAT = j; }

/* ═══ Werkzeug ═══════════════════════════════════════════════ */

/* Regex aus einer Katalogzeichenkette — wirft nie. Ein kaputtes Muster in der
   JSON darf die App nicht anhalten, es soll nur nicht greifen. */
function zerlRegex(quelle, flags){
  try{ return new RegExp(quelle, flags||''); }catch(e){ return null; }
}
/* Für Wortlisten: wortgenau, kein Teiltreffer. Ohne das findet sich „Saal" in
   „Saalpersonal" und „Lager" in „Lagerung". */
function zerlWortRegex(wort, flags){
  const esc = String(wort).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return zerlRegex('(?:^|[^\\wÄÖÜäöüß])(' + esc + ')(?![\\wÄÖÜäöüß])', flags||'i');
}
function zerlNorm(s){ return String(s==null?'':s).replace(/\s+/g,' ').trim(); }

/* Zeichen, die aus der Word-Vorlage stammen und keine Bedeutung tragen. */
function zerlPutz(text, katalog){
  let t = String(text==null?'':text);
  (katalog && katalog.putzen || []).forEach(p=>{
    const rx = zerlRegex(p.muster, 'g'); if(!rx) return;
    t = t.replace(rx, p.ersatz!==undefined ? p.ersatz : '');
  });
  return zerlNorm(t);
}

/* ═══ Klammern ═══════════════════════════════════════════════
   Die Klammer ist das ergiebigste Muster überhaupt (18 % aller Zeilen,
   331 Vorkommen). Sie trägt aber SECHS verschiedene Sachverhalte:
   Farbe · Präparat · Bedingung · Anweisung · Ort · Maß · Erläuterung —
   und in 23 Fällen reinen Import-Müll („(en)" aus „Perfusor(en)").
   Ohne diese Unterscheidung landet alles im Produktnamen. */

function zerlKlammerKlasse(inhalt, katalog){
  const s = zerlNorm(inhalt);
  if(!s) return 'leer';
  const k = katalog || ZERLKAT;

  /* Bekannter Import-Müll zuerst — er darf nicht als Eigenschaft durchgehen. */
  const art = (k.artefakte||[]).filter(a=>String(a.wert).toLowerCase()===s.toLowerCase())[0];
  if(art) return 'artefakt';

  /* Reine Maßangabe („6F", „150cm"). */
  const mrx = zerlRegex((k.mass&&k.mass.muster)||'', 'i');
  if(mrx && mrx.test(s)) return 'mass';

  /* Einzelne Farbe. */
  if((k.farbe&&k.farbe.werte||[]).some(f=>f.toLowerCase()===s.toLowerCase())) return 'farbe';

  /* Bedingung vor Anweisung: „(entfällt oft)" ist eine Regel, kein Befehl. */
  if((k.bedingung&&k.bedingung.marker||[]).some(m=>zerlWortRegex(m).test(s))) return 'bedingung';

  /* Ortsangabe („Saal 3 Schrank rechts an der Wand", „liegt beim Generator"). */
  if((k.ort&&k.ort.woerter||[]).some(w=>zerlWortRegex(w).test(s))) return 'ort';

  /* Anweisung („muss an den Defi angeschlossen werden"). */
  if((k.anweisung&&k.anweisung.marker||[]).some(m=>zerlWortRegex(m).test(s))) return 'anweisung';

  /* Präparat/Wirkstoff („Lidocain 1%", „Buccain 20ml – Bupivacain"). */
  if((k.praeparat&&k.praeparat.woerter||[]).some(w=>zerlWortRegex(w).test(s))) return 'praeparat';

  /* Kurze Sacheigenschaft („steril"). */
  if((k.eigenschaft&&k.eigenschaft.werte||[]).some(w=>zerlWortRegex(w).test(s))) return 'eigenschaft';

  /* Alles Übrige ist eine Erläuterung/Marke — nicht raten, benennen. */
  return 'erlaeuterung';
}

/* Zieht alle Klammern heraus und klassifiziert sie. Der Text kommt ohne
   Klammern zurück; die Teile stehen einzeln zur Verfügung. */
function zerlKlammern(text, katalog){
  const teile = [];
  const rest = String(text==null?'':text).replace(/\(([^()]{1,120})\)/g, (voll, inn)=>{
    const klasse = zerlKlammerKlasse(inn, katalog);
    teile.push({ roh: zerlNorm(inn), klasse: klasse });
    return ' ';
  });
  return { rest: zerlNorm(rest), teile: teile };
}

/* ═══ Einzelne Sachverhalte abziehen ═════════════════════════
   Jede Funktion gibt { rest, wert } zurück: den Text OHNE den erkannten Teil
   und den Teil selbst. So bleibt die Subtraktion nachvollziehbar. */

/* Tätigkeit: Infinitiv am Zeilenende, oder ein Substantiv, das eine Handlung
   benennt. Das ist die folgenreichste Erkennung — sie entscheidet, ob die
   Zeile überhaupt ein Produkt ist. */
function zerlTaetigkeit(text, katalog){
  const k = katalog || ZERLKAT; const t = zerlNorm(text);
  if(!t) return { ist:false, verb:null, unklar:false };
  /* Infinitiv am Ende (optional mit Ausrufezeichen): „… montieren", „… füllen" */
  const verben = (k.taetigkeit&&k.taetigkeit.verben)||[];
  for(let i=0;i<verben.length;i++){
    const rx = zerlRegex('(?:^|[^\\wÄÖÜäöüß])(' + verben[i].replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')\\s*!?\\s*$', 'i');
    if(rx && rx.test(t)) return { ist:true, verb:verben[i], unklar:false };
  }
  /* Handlungs-Substantiv, das die ganze Zeile ausmacht („Raumkontrolle"). */
  const subs = (k.taetigkeit&&k.taetigkeit.substantive)||[];
  for(let i=0;i<subs.length;i++){
    const rx = zerlWortRegex(subs[i].wort);
    if(rx && rx.test(t)){
      /* Nur wenn das Substantiv die Zeile TRÄGT — „Abdeckung" allein ist eine
         Tätigkeit, „Sterile Abdeckung groß" ist ein Produkt. */
      const allein = zerlNorm(t.replace(rx,' ')).split(/\s+/).filter(Boolean).length <= 1;
      if(allein) return { ist:!subs[i].unklar, verb:subs[i].wort, unklar:!!subs[i].unklar };
    }
  }
  return { ist:false, verb:null, unklar:false };
}

/* Steckt IRGENDWO im Text ein Handlungswort (Verb oder Handlungs-Substantiv)?
   Anders als zerlTaetigkeit verlangt das keine Stellung am Zeilenende — es ist
   der schwächere Beleg für „das ist ein Tun", der greift, wenn kein
   brauchbarer Produktkern übrig bleibt. Gibt das Fundwort zurück (oder null). */
function zerlHandlungsWort(text, katalog){
  const k = katalog || ZERLKAT; const t = zerlNorm(text);
  if(!t) return null;
  const subs = (k.taetigkeit&&k.taetigkeit.substantive)||[];
  for(let i=0;i<subs.length;i++){
    if(subs[i].unklar) continue;
    const rx = zerlWortRegex(subs[i].wort); if(rx && rx.test(t)) return subs[i].wort;
  }
  const verben = (k.taetigkeit&&k.taetigkeit.verben)||[];
  for(let i=0;i<verben.length;i++){
    const rx = zerlWortRegex(verben[i]); if(rx && rx.test(t)) return verben[i];
  }
  return null;
}

/* Bedingung: „auf Ansage", „nur bei Bedarf", „abhängig von …" */
function zerlBedingung(text, katalog){
  const k = katalog || ZERLKAT; let t = zerlNorm(text); let wert = null;
  (k.bedingung&&k.bedingung.marker||[]).forEach(m=>{
    if(wert) return;
    const rx = zerlWortRegex(m);
    if(rx && rx.test(t)){
      /* Ab dem Marker bis zum Zeilenende ist die Bedingung. */
      const i = t.toLowerCase().indexOf(m.toLowerCase());
      wert = zerlNorm(t.slice(i));
      t = zerlNorm(t.slice(0,i));
    }
  });
  return { rest:t, wert:wert };
}

/* Ort: „aus dem Keller", „im Schaltraum", „liegt beim Generator" */
function zerlOrt(text, unterkategorie, katalog){
  const k = katalog || ZERLKAT; let t = zerlNorm(text); let wert = null, bed = null;
  (k.ort&&k.ort.muster||[]).forEach(m=>{
    if(wert) return;
    const rx = zerlRegex(m, 'i'); if(!rx) return;
    const g = t.match(rx);
    if(g && g[1]){ wert = zerlNorm(g[1]); t = zerlNorm(t.replace(g[0],' ')); }
  });
  /* Kein Ort im Text? Dann verrät ihn oft die Unterkategorie
     („Material aus dem Vorbereitungsraum"). Das wird als solches vermerkt —
     der Mensch soll sehen, dass die Angabe aus der Gruppe stammt und nicht
     aus der Zeile selbst. */
  let ausUk = false;
  if(!wert && unterkategorie){
    (k.ort&&k.ort.aus_unterkategorie||[]).forEach(r=>{
      if(wert||bed) return;
      if(String(unterkategorie).toLowerCase().indexOf(String(r.enthaelt).toLowerCase())>=0){
        if(r.ort){ wert = r.ort; ausUk = true; }
        if(r.bedingung) bed = r.bedingung;
      }
    });
  }
  return { rest:t, wert:wert, bedingung:bed, ausUk:ausUk };
}

/* Ziel: „in die große Coro-Set-Schale", „an den Infusionsständer" */
function zerlZiel(text, katalog){
  const k = katalog || ZERLKAT; let t = zerlNorm(text); let wert = null;
  (k.ziel&&k.ziel.muster||[]).forEach(m=>{
    if(wert) return;
    const rx = zerlRegex(m, 'i'); if(!rx) return;
    const g = t.match(rx);
    if(g && g[1]){ wert = zerlNorm(g[1]); t = zerlNorm(t.replace(g[0],' ')); }
  });
  return { rest:t, wert:wert };
}

/* Zweck: „für die Fixierung des Gerätes", „als Annaht", „pro Sonde" */
function zerlZweck(text, katalog){
  const k = katalog || ZERLKAT; let t = zerlNorm(text); let wert = null;
  (k.zweck&&k.zweck.muster||[]).forEach(m=>{
    if(wert) return;
    const rx = zerlRegex(m, 'i'); if(!rx) return;
    const g = t.match(rx);
    if(g && g[1]){ wert = zerlNorm(g[1]); t = zerlNorm(t.slice(0, g.index)); }
  });
  return { rest:t, wert:wert };
}

/* Alternativen: „Sauerstoffbrille / Maske", „X ODER Y".
   Maßbrüche („4/0", „ml/h") werden ausdrücklich NICHT getrennt. */
function zerlAlternativen(text, katalog){
  const k = katalog || ZERLKAT; const t = zerlNorm(text);
  if(!t) return { erste:t, weitere:[] };
  const schutz = (k.alternative&&k.alternative.nicht_trennen||[])
    .map(n=>zerlRegex(n.muster,'i')).filter(Boolean);
  const trenner = (k.alternative&&k.alternative.trenner)||[];
  for(let i=0;i<trenner.length;i++){
    const tr = trenner[i];
    const pos = t.indexOf(tr);
    if(pos < 0) continue;
    /* Umgebung des Trenners auf Schutzmuster prüfen. */
    const umfeld = t.slice(Math.max(0,pos-4), Math.min(t.length,pos+tr.length+4));
    if(schutz.some(rx=>rx.test(umfeld))) continue;
    const stuecke = t.split(tr).map(zerlNorm).filter(Boolean);
    if(stuecke.length >= 2) return { erste:stuecke[0], weitere:stuecke.slice(1) };
  }
  return { erste:t, weitere:[] };
}

/* Dosis im Text („5000 I.E.", „500ml") — die führende Stückzahl („1x") hat der
   Import bereits abgetrennt und liegt in e.menge. */
function zerlDosis(text, katalog){
  const k = katalog || ZERLKAT; let t = zerlNorm(text);
  const rx = zerlRegex((k.menge&&k.menge.muster_dosis)||'', 'i');
  if(!rx) return { rest:t, wert:null };
  const g = t.match(rx);
  if(!g) return { rest:t, wert:null };
  return { rest:t, wert: zerlNorm(g[0]) };   /* NICHT abziehen: „500ml NaCl-Flasche" braucht die Angabe im Namen */
}

/* ═══ Der Produktkern ════════════════════════════════════════ */

/* Kanonischer Schlüssel: kleingeschrieben, ohne Marken-, Sonder- und
   Füllzeichen. Das ist die künftige Identität eines Materials — sie muss
   stabil sein gegen „MAP 152"/„MAP152" und „Coro"/„Koro" bleibt bewusst
   verschieden (das ist ein Tippfehler, kein Synonym — der gehört in die
   Dublettenprüfung, nicht in die Normalisierung). */
function zerlSlug(name){
  return String(name==null?'':name)
    .toLowerCase()
    .replace(/[™®©◊]/g,'')
    .replace(/[ ]/g,' ')
    .replace(/[^\wäöüß]+/g,' ')
    /* Leerzeichen ZWISCHEN Buchstabe und Ziffer schließen. Produktcodes werden
       mal mit, mal ohne Lücke geschrieben — im Bestand belegt durch „MAP 152“/
       „MAP152“ und „JR 4“/„JR4“. Das sind keine zwei Produkte. Leerzeichen
       zwischen zwei Wörtern bleiben: „kleiner tisch“ darf nicht „kleinertisch“
       werden. */
    .replace(/([a-zäöüß])\s+(\d)/g, '$1$2')
    .replace(/(\d)\s+([a-zäöüß])/g, '$1$2')
    .replace(/\s+/g,' ')
    .trim();
}

/* Ist der Rest ein plausibler Produktname? */
function zerlKernPlausibel(kern, katalog){
  const k = katalog || ZERLKAT; const t = zerlNorm(kern);
  if(!t) return { ok:false, grund:'leer' };
  if(t.length < ((k.kern&&k.kern.min_zeichen)||2)) return { ok:false, grund:'zu kurz' };
  const woerter = t.split(/\s+/).filter(Boolean).length;
  if(woerter > ((k.kern&&k.kern.max_woerter)||6)) return { ok:false, grund:'zu viele Wörter' };
  const v = (k.kern&&k.kern.verdaechtig||[]).filter(x=>{ const rx=zerlRegex(x.muster,'i'); return rx&&rx.test(t); })[0];
  if(v) return { ok:false, grund:v.grund };
  return { ok:true, grund:null };
}

/* ═══ Die Hauptfunktion ══════════════════════════════════════ */

/* Zerlegt EINEN Eintrag. Erwartet die Felder der Basis-JSON
   (anzeige_text, roh_text, menge, groessen, spezifikation, unterkategorie,
   natur, zusatz_markierung) und gibt einen Vorschlag zurück.

   Rückgabe:
     art          'produkt' | 'taetigkeit' | 'hinweis' | 'unklar'
     sicher       true, wenn nichts unverstanden übrig blieb
     produkt      { name, slug }            — nur bei art='produkt'
     menge        aus e.menge (unverändert übernommen)
     dosis        z. B. '5000 I.E.'
     ziel         'große Coro-Set-Schale'
     zweck        'die Fixierung des Gerätes'
     bedingung    'auf Ansage'
     ort          'Vorbereitungsraum'
     hinweis      'muss an den Defi angeschlossen werden'
     farbe        'grün'
     praeparat    'Lidocain 1%'
     alternativen ['Maske']
     erlaeuterung ['Gefäß-Schallkopf']
     rest         was nicht zugeordnet werden konnte  ← SICHTBAR
     spur         [{schritt, wert}]                    ← nachvollziehbar */
function zerlege(e, katalog){
  const k = katalog || ZERLKAT;
  const z = { art:'unklar', sicher:false, produkt:null, menge:null, dosis:null,
    ziel:null, zweck:null, bedingung:null, ort:null, hinweis:null, farbe:null,
    praeparat:null, mass:[], eigenschaften:[], alternativen:[], erlaeuterung:[],
    rest:null, spur:[], roh:null };
  if(!e) return z;

  const roh = e.anzeige_text || e.roh_text || '';
  z.roh = roh;
  if(!zerlNorm(roh)) return z;

  const spur = (schritt, wert)=>{ if(wert) z.spur.push({ schritt:schritt, wert:String(wert) }); };

  /* ① Putzen */
  let t = zerlPutz(roh, k);
  if(t !== zerlNorm(roh)) spur('geputzt', t);

  /* ② Klammern herausziehen und einsortieren */
  const kl = zerlKlammern(t, k);
  t = kl.rest;
  kl.teile.forEach(p=>{
    switch(p.klasse){
      case 'artefakt':     spur('Import-Artefakt verworfen', p.roh); break;
      case 'farbe':        z.farbe = z.farbe || p.roh; spur('Farbe', p.roh); break;
      case 'praeparat':    z.praeparat = z.praeparat || p.roh; spur('Präparat', p.roh); break;
      case 'bedingung':    z.bedingung = z.bedingung || p.roh; spur('Bedingung (Klammer)', p.roh); break;
      case 'anweisung':    z.hinweis = z.hinweis || p.roh; spur('Hinweis (Klammer)', p.roh); break;
      case 'ort':          z.ort = z.ort || p.roh; spur('Ort (Klammer)', p.roh); break;
      case 'mass':         z.mass.push(p.roh); spur('Maß (Klammer)', p.roh); break;
      case 'eigenschaft':  z.eigenschaften.push(p.roh); spur('Eigenschaft', p.roh); break;
      default:             z.erlaeuterung.push(p.roh); spur('Erläuterung', p.roh);
    }
  });

  /* ③ Tätigkeit — ERSTER Prüfpunkt, solange der Text noch unangetastet ist.
        An echten Daten gefunden: „Benötigte Klappen aus dem Keller holen" und
        „Tuchfixierung für OP-Tuch-Stange am Kopfteil montieren". Dort steht das
        Verb schon jetzt am Ende — die Ort- bzw. Zweck-Muster („aus dem …",
        „für …") würden es gleich mitverschlucken und aus dem Tun ein Produkt
        machen. Deshalb wird hier zuerst gefragt. */
  const ta1 = zerlTaetigkeit(t, k);
  if(ta1.ist){
    z.art = 'taetigkeit'; z.produkt = null; z.rest = zerlNorm(t) || null; z.sicher = true;
    z.menge = e.menge || null;
    spur('Tätigkeit erkannt', ta1.verb);
    return z;
  }

  /* ④ Bedingung aus dem laufenden Text */
  const bed = zerlBedingung(t, k);
  if(bed.wert && !z.bedingung){ z.bedingung = bed.wert; spur('Bedingung', bed.wert); }
  t = bed.rest;

  /* ⑤ Ort — erst im Text, dann aus der Unterkategorie */
  const ort = zerlOrt(t, e.unterkategorie, k);
  if(ort.wert && !z.ort){ z.ort = ort.wert; spur(ort.ausUk?'Ort (aus der Unterkategorie)':'Ort', ort.wert); }
  if(ort.bedingung && !z.bedingung){ z.bedingung = ort.bedingung; spur('Bedingung (Unterkategorie)', ort.bedingung); }
  t = ort.rest;

  /* ⑥ Zweck („für …") vor Ziel — sonst frisst das Ziel-Muster den Zweck. */
  const zw = zerlZweck(t, k);
  if(zw.wert){ z.zweck = zw.wert; spur('Zweck', zw.wert); }
  t = zw.rest;

  /* ⑦ Tätigkeit — ZWEITER Prüfpunkt, nach dem Zweck und vor dem Ziel.
        Grund (ebenfalls an echten Daten gefunden): „C-Bogen … auf die rechte
        Seite rotieren für Implantation" — hier steht das Verb erst nach dem
        Abzug des Zwecks am Ende. Zwei Prüfpunkte decken beide Stellungen ab. */
  const ta = zerlTaetigkeit(t, k);
  if(ta.ist){
    z.art = 'taetigkeit';
    z.produkt = null;
    z.rest = zerlNorm(t) || null;
    z.sicher = true;
    spur('Tätigkeit erkannt', ta.verb);
    z.menge = e.menge || null;
    return z;
  }
  if(ta.unklar) spur('Handlungswort, aber nicht eindeutig', ta.verb);

  /* ⑧ Ziel („in die …") */
  const zi = zerlZiel(t, k);
  if(zi.wert){ z.ziel = zi.wert; spur('Ziel', zi.wert); }
  t = zi.rest;

  /* ⑨ Alternativen trennen */
  const alt = zerlAlternativen(t, k);
  t = alt.erste;
  if(alt.weitere.length){ z.alternativen = alt.weitere; spur('Alternative', alt.weitere.join(' · ')); }

  /* ⑨ Dosis erkennen (nicht abziehen — sie gehört oft zum Namen) */
  const do_ = zerlDosis(t, k);
  if(do_.wert){ z.dosis = do_.wert; spur('Dosis', do_.wert); }

  /* ⑩ Menge aus dem Import übernehmen */
  z.menge = e.menge || null;

  /* ⑪ Der Rest ist der Produktkern — wenn er plausibel ist. */
  const kern = zerlNorm(t);
  const pl = zerlKernPlausibel(kern, k);
  if(pl.ok){
    z.art = 'produkt';
    z.produkt = { name:kern, slug:zerlSlug(kern) };
    z.sicher = true;
    spur('Produktkern', kern);
  } else if(z.hinweis && !kern){
    z.art = 'hinweis'; z.sicher = true;
    spur('reiner Hinweis', z.hinweis);
  } else if(zerlHandlungsWort(kern, k)){
    /* ⑫ Kein brauchbarer Produktkern, aber ein Handlungswort steckt drin:
          „Dreifache Wischdesinfektion des OP-Gebietes mit Softasept® N".
          Das ist ein Tun. Positiver Beleg schlägt Ratlosigkeit — aber die
          Zeile bleibt als Rest sichtbar, damit der Mensch sie sieht. */
    z.art = 'taetigkeit'; z.sicher = false; z.rest = kern || null;
    spur('Tätigkeit (Handlungswort im Satz)', zerlHandlungsWort(kern, k));
  } else {
    /* ⑬ Nichts behaupten. Der Mensch entscheidet — und sieht, woran es lag. */
    z.art = 'unklar'; z.sicher = false; z.rest = kern || null;
    spur('unklar', pl.grund);
  }
  return z;
}

/* ═══ Auswertung über den ganzen Bestand ═════════════════════ */

/* Zusammenfassung einer Zerlegung in einem Satz — für Listen und Vorschauen. */
function zerlKurz(z){
  if(!z) return '';
  if(z.art==='taetigkeit') return '🔧 ' + (z.rest||'Tätigkeit');
  if(z.art==='hinweis')    return 'ℹ️ ' + (z.hinweis||'Hinweis');
  if(z.art!=='produkt' || !z.produkt) return '❓ ' + (z.rest||z.roh||'');
  const teile = [];
  if(z.menge) teile.push(z.menge);
  teile.push(z.produkt.name);
  if(z.ziel) teile.push('→ ' + z.ziel);
  if(z.bedingung) teile.push('· ' + z.bedingung);
  return teile.join(' ');
}

/* Welche Felder hat die Zerlegung gefüllt? Für die Fortschrittsanzeige. */
function zerlFelder(z){
  if(!z) return [];
  const f = [];
  if(z.produkt) f.push('produkt');
  if(z.menge) f.push('menge');
  if(z.dosis) f.push('dosis');
  if(z.ziel) f.push('ziel');
  if(z.zweck) f.push('zweck');
  if(z.bedingung) f.push('bedingung');
  if(z.ort) f.push('ort');
  if(z.hinweis) f.push('hinweis');
  if(z.farbe) f.push('farbe');
  if(z.praeparat) f.push('praeparat');
  if(z.alternativen && z.alternativen.length) f.push('alternativen');
  return f;
}

/* Verschmilzt einen Vorschlag mit einer vom Menschen bestätigten Fassung.
   Der Mensch schlägt alles: bestätigte Felder werden NIE überschrieben,
   der Vorschlag füllt nur, was leer ist. */
function zerlVereinen(vorschlag, bestaetigt){
  const aus = {};
  const felder = ['art','produkt','menge','dosis','ziel','zweck','bedingung','ort',
    'hinweis','farbe','praeparat','alternativen','erlaeuterung','eigenschaften','mass','rest'];
  felder.forEach(f=>{
    const b = bestaetigt && bestaetigt[f];
    const leer = (b===undefined || b===null || b==='' || (Array.isArray(b)&&!b.length));
    aus[f] = leer ? (vorschlag ? vorschlag[f] : null) : b;
  });
  aus.roh = (bestaetigt && bestaetigt.roh) || (vorschlag && vorschlag.roh) || null;
  aus.quelle = (bestaetigt && Object.keys(bestaetigt).length) ? 'mensch' : 'vorschlag';
  aus.sicher = aus.quelle==='mensch' ? true : !!(vorschlag && vorschlag.sicher);
  aus.spur = (vorschlag && vorschlag.spur) || [];
  return aus;
}

/* Kennzahlen über eine Menge von Zerlegungen — was die Sanierung gebracht hat. */
function zerlBilanz(liste){
  const b = { gesamt:0, produkt:0, taetigkeit:0, hinweis:0, unklar:0, mitRest:0, felder:0 };
  (liste||[]).forEach(z=>{
    if(!z) return;
    b.gesamt++;
    if(z.art==='produkt') b.produkt++;
    else if(z.art==='taetigkeit') b.taetigkeit++;
    else if(z.art==='hinweis') b.hinweis++;
    else b.unklar++;
    if(z.rest) b.mitRest++;
    b.felder += zerlFelder(z).length;
  });
  b.quote = b.gesamt ? Math.round(100*(b.gesamt-b.unklar)/b.gesamt) : 0;
  return b;
}
