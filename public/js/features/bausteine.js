/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — WIEDERKEHRENDE HANDLUNGSFOLGEN

   Die 47 Standards sind aus Word-Dateien entstanden, die voneinander
   abgeschrieben wurden. Wer einen neuen Eingriff beschrieb, kopierte die
   nächstähnliche Datei und änderte, was anders ist. Das Ergebnis: Derselbe
   Aufbau steht vielfach im Bestand — und wenn sich ein Produkt ändert, muss
   ihn jemand an allen Stellen von Hand nachziehen. Genau da entstehen die
   Standards, die sich widersprechen.

   ── Was gemessen wurde, und was dabei WIDERLEGT wurde ──
   Die naheliegende Annahme war: „Rubriken wiederholen sich, also macht man
   Rubrik-Vorlagen." Die Messung sagt etwas anderes. Auf Rubrik-Ebene ist die
   Überschneidung klein (12–24 %, oft nur 0–2 gemeinsame Zeilen) — jede Rubrik
   hat ihren Eingriffs-Anteil. Die Wiederholung sitzt eine Ebene tiefer, in
   ZUSAMMENHÄNGENDEN FOLGEN von Zeilen:

       „Kleiner Tisch · Coro-Set · 500ml NaCl-Flasche"       in 14 Standards
       „Kopfhaube · EKG · SpO2 · …" (11 Zeilen)              in  8 Standards
       der Aufbau des Ablations-Turms (14 Zeilen)            in  4 Standards

   Über den ganzen Bestand: 1.345 von 2.375 Materialzeilen stecken in einer
   Folge, die in mindestens drei Standards gleich vorkommt. Der Baustein ist
   deshalb eine FOLGE, keine Rubrik.

   ── Wie ein Baustein gebaut ist ──
   Ein Baustein hat zwei getrennte Teile, und diese Trennung ist der Kern:

       schluessel  die Vergleichsform der Original-Zeilen (eingefroren)
                   → daran werden die Vorkommen im Bestand WIEDERGEFUNDEN
       zeilen      der gewollte Inhalt (Text, Menge, weglassen?)
                   → das, was der Mensch pflegt

   Weil der Schlüssel eingefroren ist, verliert ein Baustein seine Vorkommen
   NICHT, wenn man eine Zeile umbenennt. Das ist der Unterschied zwischen
   „einmal ändern, überall gültig" und „einmal ändern, danach findet es sich
   nicht mehr wieder".

   ── Wie die Änderung wirkt ──
   Über die Ebene, die es schon gibt: QE.cid — dieselbe Ablage, in die auch das
   Schnellmenü schreibt. Der Baustein erfindet KEINE vierte Auflösungsebene.
   Er schreibt an jede Fundstelle genau das, was er soll, und merkt sich, was
   er geschrieben hat (`gesetzt`). Deshalb ist alles rücknehmbar: `bauLoesen`
   entfernt exakt die eigenen Einträge und lässt fremde stehen.

   Die Basisdaten (public/data/hkl_standards_export.json) werden dabei nicht
   angefasst — wie überall in dieser App.

   ── Was der Baustein zusätzlich sichtbar macht ──
   Wenn jemand an EINER Stelle abweicht, ist das kein Fehler: Vielleicht braucht
   dieser eine Eingriff wirklich etwas anderes. Aber es muss auffallen.
   `bauAbweichungen` listet genau diese Stellen — das ist das Pflege-Instrument
   für die Leitung: „Der Baustein sagt X, an drei Stellen steht Y."
   ───────────────────────────────────────────────────────────── */

/* ═══════════ 1. Reine Erkennung (ohne DB, ohne Speicher) ═══════════ */

/* Vergleichsform einer Zeile. Absichtlich hart: Groß/Klein, Umlaute,
   Bindestriche und Leerzeichen dürfen kein Unterschied sein — sonst zerfällt
   dieselbe Folge in zwei, nur weil einmal „Coro-Set" und einmal „Coro Set"
   getippt wurde. */
function bauSlug(text){
  let s = String(text==null?'':text).toLowerCase();
  s = s.replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
  try{ s = s.normalize('NFD').replace(/[\u0300-\u036f]/g,''); }catch(e){}
  return s.replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}

const BAU_TRENN = '§';          /* Trenner im Folgen-Schlüssel */
const BAU_MIN_LAENGE = 3;            /* kürzer ist keine „Folge", sondern Zufall */
const BAU_MIN_STANDARDS = 3;         /* zweimal ist noch kein Muster */
const BAU_MAX_LAENGE = 40;

/* Zerlegt den Bestand in vergleichbare Blöcke: je Unterbereich eine Liste von
   Zeilen. Überschriften und Fließtext zählen nicht mit — sie sind Gliederung,
   nicht Inhalt. Die echten Positionen (`ei`) bleiben erhalten, damit eine
   Fundstelle später wieder auf die cid zeigt. Rein. */
function bauBloecke(standards){
  const out = [];
  (standards||[]).forEach(s=>{
    if(!s || !s.id) return;
    (s.rubriken||[]).forEach((r,ri)=>{
      (r.sub_bereiche||[]).forEach((sb,si)=>{
        const zeilen = [];
        (sb.eintraege||[]).forEach((e,ei)=>{
          if(!e || e.ist_fliesstext || e.natur==='ueberschrift') return;
          const slug = bauSlug(e.anzeige_text);
          if(!slug) return;
          zeilen.push({ ei, slug, text:e.anzeige_text, menge:e.menge||null,
            natur:e.natur||'material', uk:e.unterkategorie||null });
        });
        if(zeilen.length) out.push({ sid:s.id, titel:s.titel||s.id, ri, si,
          rubrik:(r.name||''), typ:(r.typ||'sonstige'), zeilen });
      });
    });
  });
  return out;
}

/* Alle zusammenhängenden Folgen, die in mindestens `minStandards` Standards
   gleich vorkommen. Rein. */
function bauFolgen(bloecke, opt){
  const o = opt||{};
  const minL = o.minLaenge||BAU_MIN_LAENGE;
  const minS = o.minStandards||BAU_MIN_STANDARDS;
  const maxL = o.maxLaenge||BAU_MAX_LAENGE;
  const map = new Map();
  (bloecke||[]).forEach(b=>{
    const n = b.zeilen.length;
    for(let i=0;i<n;i++){
      const bis = Math.min(maxL, n-i);
      for(let L=minL;L<=bis;L++){
        const teil = b.zeilen.slice(i,i+L);
        const key = teil.map(x=>x.slug).join(BAU_TRENN);
        let m = map.get(key);
        if(!m){ m = { laenge:L, zeilen:teil, vorkommen:[], standards:new Set() }; map.set(key,m); }
        m.vorkommen.push({ sid:b.sid, titel:b.titel, ri:b.ri, si:b.si,
          rubrik:b.rubrik, typ:b.typ, eis:teil.map(x=>x.ei) });
        m.standards.add(b.sid);
      }
    }
  });
  const aus = [];
  map.forEach((m,key)=>{
    if(m.standards.size < minS) return;
    aus.push({ key, schluessel:key.split(BAU_TRENN), laenge:m.laenge,
      zeilen:m.zeilen.map(z=>({ slug:z.slug, text:z.text, menge:z.menge, natur:z.natur, uk:z.uk })),
      vorkommen:m.vorkommen, standards:[...m.standards],
      ersparnis:(m.vorkommen.length-1)*m.laenge });
  });
  return aus;
}

/* Wegwerfen, was nur ein Ausschnitt einer ebenso häufigen längeren Folge ist.
   „Coro-Set · NaCl" ist keine eigene Erkenntnis, wenn „Coro-Set · NaCl ·
   Kornzange" genauso oft vorkommt. Rein. */
function bauMaximal(kand){
  const alle = kand||[];
  return alle.filter(x=>!alle.some(y=>
    y!==x && y.laenge>x.laenge && y.standards.length>=x.standards.length &&
    y.key.indexOf(x.key)>=0));
}

/* Gierige Auswahl ohne Überschneidung: Die stärkste Folge zuerst; danach zählt
   eine Fundstelle nur noch, wenn keine ihrer Zeilen schon vergeben ist. So
   entsteht eine Liste, die sich der Mensch der Reihe nach vornehmen kann,
   statt zehn Varianten derselben Stelle. Rein. */
function bauGreedy(kand, opt){
  const minS = (opt&&opt.minStandards)||BAU_MIN_STANDARDS;
  const belegt = new Set();
  const aus = [];
  (kand||[]).slice()
    .sort((a,b)=> (b.ersparnis-a.ersparnis) || (b.laenge-a.laenge) || a.key.localeCompare(b.key))
    .forEach(k=>{
      const frei = k.vorkommen.filter(v=>!v.eis.some(ei=>belegt.has(v.sid+'|'+v.ri+'|'+v.si+'|'+ei)));
      const stds = new Set(frei.map(v=>v.sid));
      if(stds.size < minS) return;
      frei.forEach(v=>v.eis.forEach(ei=>belegt.add(v.sid+'|'+v.ri+'|'+v.si+'|'+ei)));
      aus.push(Object.assign({}, k, { vorkommen:frei, standards:[...stds],
        ersparnis:(frei.length-1)*k.laenge }));
    });
  return aus;
}

/* Der ganze Weg: Bestand → Vorschlagsliste. Rein (bekommt die Standards). */
function bauKandidaten(standards, opt){
  return bauGreedy(bauMaximal(bauFolgen(bauBloecke(standards), opt)), opt);
}

/* Namensvorschlag. Der Mensch benennt um — das hier muss nur wiedererkennbar
   sein, nicht schön. Rein. */
function bauTitelVorschlag(zeilen){
  const z = zeilen||[];
  if(!z.length) return 'Baustein';
  const kopf = z.slice(0,2).map(x=>String(x.text||'').trim()).filter(Boolean).join(' · ');
  const rest = z.length-2;
  return (rest>0 ? kopf+' +'+rest : kopf).slice(0,90) || 'Baustein';
}

/* Findet alle Fundstellen eines Schlüssels im aktuellen Bestand. Rein.

   Absichtlich OHNE die Überschneidungsregel aus `bauGreedy`: Die Regel dient
   nur der Vorschlagsliste (sie hält sie kurz und überschneidungsfrei). Ist ein
   Baustein erst einmal angelegt, gilt er überall, wo seine Folge wörtlich
   steht — auch dort, wo der Vorschlagslauf ihn zugunsten einer stärkeren Folge
   fallengelassen hätte. */
function bauFinden(schluessel, standards){
  return bauFindenIn(schluessel, bauBloecke(standards));
}
/* Dieselbe Suche auf schon zerlegten Blöcken — damit bei zehn Bausteinen der
   Bestand nicht zehnmal zerlegt wird. Rein. */
function bauFindenIn(schluessel, bloecke){
  const sch = schluessel||[];
  if(!sch.length) return [];
  const key = sch.join(BAU_TRENN);
  const aus = [];
  (bloecke||[]).forEach(b=>{
    const slugs = b.zeilen.map(x=>x.slug);
    for(let i=0;i+sch.length<=slugs.length;i++){
      if(slugs.slice(i,i+sch.length).join(BAU_TRENN)!==key) continue;
      aus.push({ sid:b.sid, titel:b.titel, ri:b.ri, si:b.si, rubrik:b.rubrik,
        eis:b.zeilen.slice(i,i+sch.length).map(x=>x.ei) });
    }
  });
  return aus;
}

/* Wie oft steht DIESE eine Zeile im Bestand — und in wie vielen Standards?
   Die Antwort gehört an jede Änderung: Wer „Coro-Set" umbenennt und die
   Reichweite „🌐 alle" wählt, ändert 14 Standards. Rein. */
function bauTextReichweite(text, standards){
  const slug = bauSlug(text);
  const aus = { stellen:0, standards:0 };
  if(!slug) return aus;
  const stds = new Set();
  bauBloecke(standards).forEach(b=>b.zeilen.forEach(z=>{
    if(z.slug!==slug) return; aus.stellen++; stds.add(b.sid); }));
  aus.standards = stds.size;
  return aus;
}

/* ═══════════ 2. Der Speicher ═══════════ */

/* [{ id, name, schluessel:[slug], zeilen:[{slug,text,menge,natur,uk,weg}],
      angelegt, gesetzt:{ cid:[prop,…] } }]  — server-geteilt. */
let BAUSTEINE = (typeof loadJSON==='function') ? loadJSON('hkl_bausteine', []) : [];
if(!Array.isArray(BAUSTEINE)) BAUSTEINE = [];
function saveBausteine(){ if(typeof saveJSON==='function') saveJSON('hkl_bausteine', BAUSTEINE); }

/* IDs nur aus [a-z0-9] — sie landen in onclick-Attributen. */
function bauNeueId(){ return 'b'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function bauNach(id){ return BAUSTEINE.find(b=>b.id===id)||null; }

/* Fundstellen und Vorschläge werden je Bildaufbau mehrfach gebraucht und sind
   teuer (n-Gramme über 2.375 Zeilen). Der Zwischenspeicher fällt, sobald sich
   Daten ändern. */
let bauVorkCache = null, bauKandCache = null, bauBloeckCache = null;
function bauCacheLeeren(){ bauVorkCache = null; bauKandCache = null; bauBloeckCache = null; }

function bauStandards(){ return (typeof DB!=='undefined' && DB && DB.standards) ? DB.standards : []; }
function bauBloeckeJetzt(){ if(!bauBloeckCache) bauBloeckCache = bauBloecke(bauStandards()); return bauBloeckCache; }

function bauVorkommen(id){
  const b = bauNach(id); if(!b) return [];
  if(!bauVorkCache) bauVorkCache = {};
  if(!bauVorkCache[id]) bauVorkCache[id] = bauFindenIn(b.schluessel, bauBloeckeJetzt());
  return bauVorkCache[id];
}

function bauVorschlaege(){
  if(!bauKandCache){
    /* Schon angelegte Bausteine nicht noch einmal vorschlagen. */
    const schon = new Set(BAUSTEINE.map(b=>(b.schluessel||[]).join(BAU_TRENN)));
    bauKandCache = bauGreedy(bauMaximal(bauFolgen(bauBloeckeJetzt()))).filter(k=>!schon.has(k.key));
  }
  return bauKandCache;
}

/* ═══════════ 3. Anlegen, ändern, wirken ═══════════ */

function bauAnlegen(name, zeilen, schluessel){
  const z = (zeilen||[]).map(x=>({ slug:x.slug||bauSlug(x.text), text:x.text,
    menge:x.menge||null, natur:x.natur||'material', uk:x.uk||null, weg:!!x.weg }));
  if(!z.length) return null;
  const b = { id:bauNeueId(), name:(name||bauTitelVorschlag(z)).trim()||bauTitelVorschlag(z),
    schluessel:(schluessel&&schluessel.length)?schluessel.slice():z.map(x=>x.slug),
    zeilen:z, angelegt:Date.now(), gesetzt:{} };
  BAUSTEINE.push(b); saveBausteine(); bauCacheLeeren();
  return b;
}

function bauUmbenennen(id, name){
  const b = bauNach(id); if(!b) return false;
  const n = String(name||'').trim(); if(!n) return false;
  b.name = n; saveBausteine(); return true;
}

/* Löschen heißt: erst die eigenen Spuren entfernen, dann den Baustein. Sonst
   bliebe eine Umbenennung an 14 Stellen stehen, ohne dass noch irgendwo steht,
   woher sie kam. */
function bauLoeschen(id){
  bauLoesen(id);
  const i = BAUSTEINE.findIndex(b=>b.id===id);
  if(i<0) return false;
  BAUSTEINE.splice(i,1); saveBausteine(); bauCacheLeeren();
  return true;
}

/* Was SOLL an einer Fundstelle stehen? Vergleicht den Baustein mit dem
   Original-Eintrag und liefert nur die echten Abweichungen. Rein (bekommt den
   Eintrag übergeben) — „leer schlägt falsch": Wo nichts abweicht, wird nichts
   geschrieben. */
function bauSollWerte(zeile, e){
  const soll = {};
  if(!zeile) return soll;
  if(zeile.weg){ soll.hidden = true; return soll; }
  const basisText = e ? (e.anzeige_text||'') : '';
  const t = String(zeile.text==null?'':zeile.text).trim();
  if(t && t!==basisText) soll.name = t;
  const basisMenge = e ? (e.menge||null) : null;
  const m = (zeile.menge==null||zeile.menge==='') ? null : String(zeile.menge).trim();
  if(m!==basisMenge) soll.mengeVal = m;
  return soll;
}

/* Die drei Eigenschaften, die ein Baustein steuert. Alles andere (Farbe,
   Kategorie, Unterkategorie, eigene Felder) bleibt ihm fremd und wird nie
   angefasst. */
const BAU_FELDER = ['name','mengeVal','hidden'];

/* Trägt den Baustein an allen Fundstellen ein — und GLEICHT sie an.
   „Durchsetzen" heißt: Nach dem Lauf steht an jeder Fundstelle das, was im
   Baustein steht. Eine Abweichung, die jemand von Hand eingetragen hat, wird
   dabei überschrieben — das ist der Sinn der Sache, und die Abweichungsliste
   zeigt vorher, was das genau bedeutet.

   Damit das trotzdem umkehrbar bleibt, merkt sich der Baustein zu jedem Feld,
   was VORHER dastand (`gesetzt[cid][feld].alt`). `bauLoesen` stellt genau das
   wieder her — auch fremde Eintragungen, die er überschrieben hat. */
function bauAnwenden(id){
  const b = bauNach(id); if(!b) return { stellen:0, felder:0 };
  if(typeof QE==='undefined' || !QE || !QE.cid) return { stellen:0, felder:0 };
  const alt = b.gesetzt||{};
  const neu = {};
  let stellen = 0, felder = 0;
  bauVorkommen(id).forEach(v=>{
    v.eis.forEach((ei,idx)=>{
      const z = b.zeilen[idx]; if(!z) return;
      const cid = v.sid+'|'+v.ri+'|'+v.si+'|'+ei;
      const e = (typeof findEntry==='function') ? findEntry(cid) : null;
      const soll = bauSollWerte(z, e);
      let hier = 0;
      BAU_FELDER.forEach(p=>{
        const wollen = soll[p];                                     /* undefined = hier soll nichts stehen */
        const jetzt = QE.cid[cid] ? QE.cid[cid][p] : undefined;
        const eigen = alt[cid] && alt[cid][p];                      /* stand das schon von UNS? */
        if(wollen===jetzt){ if(eigen) (neu[cid]=neu[cid]||{})[p] = eigen; return; }
        /* Der Wert vor unserem allerersten Eingriff — nicht unser eigener. */
        const vorher = eigen ? eigen.alt : jetzt;
        if(wollen===undefined){
          if(QE.cid[cid]){ delete QE.cid[cid][p]; if(!Object.keys(QE.cid[cid]).length) delete QE.cid[cid]; }
        } else {
          QE.cid[cid] = QE.cid[cid]||{};
          QE.cid[cid][p] = wollen;
        }
        felder++; hier++;
        /* Nur merken, was wir wirklich verantworten: entweder steht jetzt
           unser Wert da, oder wir haben einen fremden entfernt. */
        if(wollen!==undefined || vorher!==undefined) (neu[cid]=neu[cid]||{})[p] = { alt:vorher };
      });
      if(hier) stellen++;
    });
  });
  b.gesetzt = neu;
  if(typeof saveQE==='function') saveQE();
  saveBausteine();
  if(typeof buildMaterialIndex==='function') buildMaterialIndex();
  return { stellen, felder };
}

/* Nimmt zurück, was der Baustein angerichtet hat — und stellt dabei wieder her,
   was er überschrieben hat. Fremde Felder bleiben unberührt. */
function bauLoesen(id){
  const b = bauNach(id); if(!b) return 0;
  let n = 0;
  const g = b.gesetzt||{};
  if(typeof QE!=='undefined' && QE && QE.cid){
    Object.keys(g).forEach(cid=>{
      Object.keys(g[cid]||{}).forEach(p=>{
        const vorher = g[cid][p] ? g[cid][p].alt : undefined;
        if(vorher===undefined){ if(QE.cid[cid]) delete QE.cid[cid][p]; }
        else { QE.cid[cid] = QE.cid[cid]||{}; QE.cid[cid][p] = vorher; }
        n++;
      });
      if(QE.cid[cid] && !Object.keys(QE.cid[cid]).length) delete QE.cid[cid];
    });
    if(typeof saveQE==='function') saveQE();
  }
  b.gesetzt = {}; saveBausteine();
  if(typeof buildMaterialIndex==='function') buildMaterialIndex();
  return n;
}

/* Eine Zeile des Bausteins ändern. Der Schlüssel bleibt unberührt — die
   Fundstellen gehen dadurch NICHT verloren. */
function bauZeileSetzen(id, idx, feld, wert){
  const b = bauNach(id); if(!b) return false;
  const z = b.zeilen[idx]; if(!z) return false;
  if(feld==='text'){ const t=String(wert==null?'':wert).trim(); if(!t) return false; z.text = t; }
  else if(feld==='menge'){ const m=String(wert==null?'':wert).trim(); z.menge = m||null; }
  else if(feld==='weg'){ z.weg = !!wert; }
  else return false;
  saveBausteine();
  bauAnwenden(id);
  return true;
}

/* Wo weicht der Bestand vom Baustein ab? Das ist die Pflege-Ansicht: Nicht
   jede Abweichung ist ein Fehler, aber jede muss auffallen. */
function bauAbweichungen(id){
  const b = bauNach(id); if(!b) return [];
  const aus = [];
  bauVorkommen(id).forEach(v=>{
    v.eis.forEach((ei,idx)=>{
      const z = b.zeilen[idx]; if(!z) return;
      const cid = v.sid+'|'+v.ri+'|'+v.si+'|'+ei;
      const e = (typeof findEntry==='function') ? findEntry(cid) : null;
      if(!e) return;
      const q = (p)=>(typeof qeGet==='function') ? qeGet(e,cid,p) : undefined;
      const nm = q('name');
      const ist = (nm!==undefined) ? nm : (e.anzeige_text||'');
      const mv = q('mengeVal');
      const istMenge = (mv!==undefined) ? mv : (e.menge||null);
      const versteckt = q('hidden')===true;
      const sollText = String(z.text==null?'':z.text).trim();
      const sollMenge = (z.menge==null||z.menge==='') ? null : String(z.menge).trim();
      if(z.weg){ if(!versteckt) aus.push({ cid, sid:v.sid, titel:v.titel, idx, was:'sichtbar', ist, soll:'(weggelassen)' }); return; }
      if(versteckt){ aus.push({ cid, sid:v.sid, titel:v.titel, idx, was:'versteckt', ist:'(ausgeblendet)', soll:sollText }); return; }
      if(String(ist).trim()!==sollText) aus.push({ cid, sid:v.sid, titel:v.titel, idx, was:'text', ist, soll:sollText });
      else if((istMenge||null)!==sollMenge) aus.push({ cid, sid:v.sid, titel:v.titel, idx, was:'menge', ist:(istMenge||'—'), soll:(sollMenge||'—') });
    });
  });
  return aus;
}

/* Zu welchen Bausteinen gehört diese eine Stelle? Für den Hinweis im
   Schnellmenü: „Diese Zeile gehört zum Baustein X — er steht in 8 Standards." */
function bauFuerCid(cid){
  const aus = [];
  BAUSTEINE.forEach(b=>{
    bauVorkommen(b.id).forEach(v=>{
      const i = v.eis.map(ei=>v.sid+'|'+v.ri+'|'+v.si+'|'+ei).indexOf(cid);
      if(i>=0) aus.push({ baustein:b, idx:i });
    });
  });
  return aus;
}

/* Einen Baustein in einen Standard EINFÜGEN — der eigentliche Zeitgewinn beim
   Anlegen eines neuen Standards. Die Zeilen werden als eigene Ergänzungen
   angelegt (hkl_additions), nicht in die Basisdaten geschrieben. */
function bauEinfuegen(id, sid, ri){
  const b = bauNach(id); if(!b) return 0;
  if(typeof ADDITIONS==='undefined' || !ADDITIONS || typeof makeAddEntry!=='function') return 0;
  const key = sid+'|'+ri;
  const arr = ADDITIONS.entries[key] || (ADDITIONS.entries[key]=[]);
  let n = 0;
  b.zeilen.forEach(z=>{
    if(z.weg) return;
    arr.push(makeAddEntry({ name:z.text, menge:z.menge||'', nat:z.natur||'material',
      uk:z.uk||'', aid:(typeof newAid==='function')?newAid():('b'+(n+1)+Date.now().toString(36)) }));
    n++;
  });
  if(typeof saveAdditions==='function') saveAdditions();
  if(typeof rebuildDB==='function') rebuildDB();
  if(typeof buildMaterialIndex==='function') buildMaterialIndex();
  bauCacheLeeren();
  return n;
}

/* Kennzahlen für die Kopfzeile. */
function bauBilanz(){
  let stellen = 0, abw = 0;
  const stds = new Set();
  BAUSTEINE.forEach(b=>{
    const v = bauVorkommen(b.id);
    v.forEach(x=>{ stellen += x.eis.length; stds.add(x.sid); });
    abw += bauAbweichungen(b.id).length;
  });
  return { bausteine:BAUSTEINE.length, stellen, standards:stds.size, abweichungen:abw };
}

/* ═══════════ 4. Bildschirm ═══════════

   Die Ansicht hat bewusst zwei Hälften, und sie sind nicht gleichwertig:

     OBEN   die angelegten Bausteine — das Arbeitsgerät. Hier wird gepflegt,
            hier stehen die Abweichungen, hier wird eingefügt.
     UNTEN  die gefundenen Wiederholungen — der Vorschlag. Nichts davon wirkt,
            bevor ein Mensch es anlegt („Der Mensch schlägt alles").

   Der Suchlauf (n-Gramme über den ganzen Bestand) kostet dreistellige
   Millisekunden. Er läuft deshalb nicht beim Start der App, sondern erst hier
   — und sein Ergebnis bleibt bis zur nächsten Datenänderung liegen. */

let bauMehr = false;      /* Vorschlagsliste ganz zeigen? */
const BAU_ZEIGE = 12;

function openBausteinAdmin(){
  if(typeof ADMIN!=='undefined' && !ADMIN){ if(typeof promptLoginThen==='function') promptLoginThen(openBausteinAdmin); return; }
  bauForm = null;   /* nichts Halboffenes aus einem früheren Besuch */
  renderBausteine(); show('scr-bausteine');
  if(typeof setBar==='function') setBar('Bausteine', BAUSTEINE.length+' angelegt', true);
}

/* Bedien-Hüllen: ändern → wirken → neu zeichnen → Rückmeldung. */
function bauUiSetzen(id, idx, feld, wert){
  if(!bauZeileSetzen(id, idx, feld, wert)){ toast('Nicht übernommen',true); renderBausteine(); return; }
  renderBausteine(); toast('Übernommen — überall, wo der Baustein steht');
}
function bauUiAnwenden(id){ const r=bauAnwenden(id); renderBausteine();
  toast(r.stellen?('Eingetragen an '+r.stellen+' Stellen'):'Nichts einzutragen — der Bestand entspricht schon dem Baustein'); }
function bauUiLoesen(id){ const n=bauLoesen(id); renderBausteine();
  toast(n?(n+' eigene Eintragungen zurückgenommen'):'Nichts zurückzunehmen'); }
/* Offene Eingabefläche: {art:'umbenennen'|'loeschen'|'anlegen', id, i}.
   Bewusst KEIN prompt()/confirm(): In installierten PWAs erscheint dort auf
   mehreren Android-Chrome-Versionen kein Fenster, der Aufruf liefert sofort
   null — Anlegen und Umbenennen wären auf genau den Geräten lautlos
   ausgefallen, auf denen im Saal gearbeitet wird (Grundsatz ⑧). */
let bauForm = null;

function bauFormSchliessen(){ bauForm=null; renderBausteine(); }
function bauFormFokus(){ const i=$('bauFormName'); if(i){ setTimeout(()=>{ i.focus(); if(i.select) i.select(); },50); } }

function bauUiUmbenennen(id){ const b=bauNach(id); if(!b) return;
  bauForm={art:'umbenennen', id, wert:b.name}; renderBausteine(); bauFormFokus(); }
function bauUiUmbenennenSpeichern(id){
  const v=($('bauFormName')&&$('bauFormName').value||'');
  if(!bauUmbenennen(id,v)){ toast('Name darf nicht leer sein',true); const i=$('bauFormName'); if(i) i.focus(); return; }
  bauForm=null; renderBausteine(); toast('Umbenannt'); }

function bauUiLoeschen(id){ const b=bauNach(id); if(!b) return;
  bauForm={art:'loeschen', id}; renderBausteine(); }
function bauUiLoeschenBestaetigen(id){
  bauLoeschen(id); bauForm=null; renderBausteine(); toast('Baustein gelöscht'); }

function bauUiAnlegen(i){
  const k = bauVorschlaege()[i]; if(!k) return;
  bauForm={art:'anlegen', i, wert:bauTitelVorschlag(k.zeilen)}; renderBausteine(); bauFormFokus(); }
function bauUiAnlegenSpeichern(i){
  const k = bauVorschlaege()[i]; if(!k) return;
  const name=($('bauFormName')&&$('bauFormName').value||'').trim();
  if(!name){ toast('Bitte einen Namen eingeben',true); const el=$('bauFormName'); if(el) el.focus(); return; }
  const b = bauAnlegen(name, k.zeilen, k.schluessel);
  if(!b){ toast('Konnte nicht angelegt werden',true); return; }
  bauForm=null; renderBausteine();
  toast('Angelegt — steht an '+bauVorkommen(b.id).length+' Stellen');
}

/* Eingabefläche für einen Namen — an Ort und Stelle, nicht in einem Fenster. */
function bauNameFormHTML(titel, hinweis, wert, jaText, jaFn){
  return `<div class="pcard" style="margin-top:10px">
    <div class="bez-sec" style="margin-top:0">${esc(titel)}</div>
    ${hinweis?`<p class="hint">${esc(hinweis)}</p>`:''}
    <input class="loc-input" id="bauFormName" style="width:100%" value="${esc(wert||'')}" placeholder="Name des Bausteins">
    <div class="p-actions"><button class="btn btn-sec" onclick="bauFormSchliessen()">Abbrechen</button>
      <button class="btn btn-pri" onclick="${jaFn}">${esc(jaText)}</button></div></div>`;
}
function bauUiEinfuegen(id){
  const sel=$('bauZielStd_'+id), rsel=$('bauZielRub_'+id);
  if(!sel||!rsel){ return; }
  const sid=sel.value, ri=parseInt(rsel.value,10);
  if(!sid || !(ri>=0)){ toast('Bitte Standard und Rubrik wählen',true); return; }
  const n=bauEinfuegen(id, sid, ri);
  renderBausteine();
  toast(n?(n+' Zeilen eingefügt'):'Nichts eingefügt',!n);
}
/* Rubrikliste zum gewählten Standard nachziehen (ohne Neuaufbau der Seite). */
function bauZielStdWechsel(id){
  const sel=$('bauZielStd_'+id), rsel=$('bauZielRub_'+id); if(!sel||!rsel) return;
  rsel.innerHTML = bauRubrikOptionen(sel.value);
}
/* Angezeigter Name eines Standards (Umbenennung schlägt den Rohtitel). */
function bauStdName(s){ if(!s) return ''; return (typeof stdTitel==='function') ? stdTitel(s) : (s.titel||s.id); }
function bauRubrikOptionen(sid){
  const s = bauStandards().find(x=>x.id===sid);
  if(!s) return '<option value="">—</option>';
  return (s.rubriken||[]).map((r,ri)=>{
    const nm = (typeof rubName==='function') ? rubName(r,ri,s) : (r.name||('Rubrik '+(ri+1)));
    return `<option value="${ri}">${esc(nm)}</option>`;
  }).join('') || '<option value="">—</option>';
}
function bauUiMehr(){ bauMehr = !bauMehr; renderBausteine(); }
/* Von einer Abweichung direkt an die Stelle springen. */
function bauZurStelle(cid){
  const p = String(cid||'').split('|'); if(p.length<4) return;
  if(typeof setMode==='function') setMode('use');
  if(typeof openStandard==='function') openStandard(p[0]);
  if(typeof openRubrik==='function') openRubrik(+p[1]);
  setTimeout(()=>{ const el=$('e-'+cid); if(el&&el.scrollIntoView) try{ el.scrollIntoView({block:'center'}); }catch(e){} }, 60);
}

function bauZeileHTML(b, z, i){
  return `<div class="bau-z${z.weg?' weg':''}">
    <input class="loc-input bau-menge" value="${esc(z.menge||'')}" placeholder="Menge"
      data-b="${esc(b.id)}" data-i="${i}" onchange="bauUiSetzen(this.dataset.b,+this.dataset.i,'menge',this.value)">
    <input class="loc-input bau-text" value="${esc(z.text||'')}"
      data-b="${esc(b.id)}" data-i="${i}" onchange="bauUiSetzen(this.dataset.b,+this.dataset.i,'text',this.value)">
    <label class="bau-weg" title="Diese Zeile überall weglassen">
      <input type="checkbox" ${z.weg?'checked':''} data-b="${esc(b.id)}" data-i="${i}"
        onchange="bauUiSetzen(this.dataset.b,+this.dataset.i,'weg',this.checked)"><span>weglassen</span></label>
  </div>`;
}

function bauKarteHTML(b){
  const vor = bauVorkommen(b.id);
  const stds = [...new Set(vor.map(v=>v.sid))];
  const abw = bauAbweichungen(b.id);
  const titelVon = (sid)=>{ const s=bauStandards().find(x=>x.id===sid); return s?bauStdName(s):sid; };
  const stdListe = stds.map(titelVon).sort((a,b2)=>String(a).localeCompare(String(b2),'de'));

  /* Eine offene Eingabefläche darf nicht hinter einer zugeklappten Karte
     verschwinden — der Neuaufbau der Seite würde sie sonst schließen. */
  const offen = !!(bauForm && bauForm.id===b.id);
  let h = `<details class="vpanel bau-karte"${offen?' open':''}>
    <summary><span class="vp-ico">⛓️</span><span class="vp-txt">
      <span class="vp-title">${esc(b.name)}</span>
      <span class="vp-desc">${b.zeilen.length} Zeilen · steht in ${stds.length} Standard${stds.length===1?'':'s'} (${vor.length} Fundstelle${vor.length===1?'':'n'})</span>
    </span>${abw.length?`<span class="vp-badge warn">${abw.length} weichen ab</span>`:`<span class="vp-badge">einheitlich</span>`}</summary>
    <div class="vpanel-body">`;

  if(!vor.length){
    h += `<p class="hint">Dieser Baustein findet zurzeit keine Fundstelle im Bestand. Das passiert, wenn die zugehörigen Zeilen ausgeblendet oder umgebaut wurden. Der Baustein bleibt erhalten — Du kannst ihn weiterhin in einen Standard einfügen.</p>`;
  }

  h += `<p class="hint">Was Du hier änderst, gilt an <b>allen ${vor.length} Fundstellen</b>. Geändert wird nur die Anzeige — die Standards selbst bleiben unangetastet, und „Lösen" nimmt jede eigene Eintragung wieder zurück.</p>`;
  h += `<div class="bau-zeilen">${b.zeilen.map((z,i)=>bauZeileHTML(b,z,i)).join('')}</div>`;

  if(abw.length){
    h += `<div class="bez-sec">Abweichungen im Bestand</div>
      <p class="hint">Nicht jede Abweichung ist ein Fehler — vielleicht braucht genau dieser Eingriff etwas anderes. Auffallen muss sie trotzdem.</p>`;
    h += abw.slice(0,25).map(a=>`<div class="bau-abw">
        <span class="bau-abw-std">${esc(titelVon(a.sid))}</span>
        <span class="bau-abw-ist">${esc(String(a.ist||''))}</span>
        <span class="bau-abw-pfeil">↔</span>
        <span class="bau-abw-soll">${esc(String(a.soll||''))}</span>
        <button class="vlink" data-c="${esc(a.cid)}" onclick="bauZurStelle(this.dataset.c)">Zur Stelle</button>
      </div>`).join('');
    if(abw.length>25) h += `<p class="hint">… und ${abw.length-25} weitere.</p>`;
    h += `<div class="p-actions"><button class="btn btn-pri" data-b="${esc(b.id)}" onclick="bauUiAnwenden(this.dataset.b)">Baustein überall durchsetzen</button></div>`;
  }

  /* Die Rubrikliste muss zu dem Standard passen, der im ersten Feld WIRKLICH
     ausgewählt ist — und das ist der erste der SORTIERTEN Liste, nicht der
     erste im Bestand. */
  const nachTitel = bauStandards().slice()
    .sort((a,c)=>String(bauStdName(a)).localeCompare(String(bauStdName(c)),'de'));
  h += `<div class="bez-sec">In einen Standard einfügen</div>
    <p class="hint">Legt die ${b.zeilen.filter(z=>!z.weg).length} Zeilen als neue Einträge an — der schnelle Weg, einen neuen Standard aufzubauen, ohne ihn abzuschreiben.</p>
    <div class="bau-ziel">
      <select class="loc-input" id="bauZielStd_${esc(b.id)}" data-b="${esc(b.id)}" onchange="bauZielStdWechsel(this.dataset.b)">
        ${nachTitel.map(s=>`<option value="${esc(s.id)}">${esc(bauStdName(s))}</option>`).join('')}
      </select>
      <select class="loc-input" id="bauZielRub_${esc(b.id)}">${bauRubrikOptionen((nachTitel[0]||{}).id)}</select>
      <button class="btn btn-sec" data-b="${esc(b.id)}" onclick="bauUiEinfuegen(this.dataset.b)">Einfügen</button>
    </div>`;

  if(stdListe.length) h += `<p class="hint">Steht in: ${stdListe.map(esc).join(' · ')}</p>`;

  if(bauForm && bauForm.id===b.id && bauForm.art==='umbenennen'){
    h += bauNameFormHTML('Baustein umbenennen','Der Name ist nur eine Beschriftung — die Fundstellen bleiben dieselben.',
      bauForm.wert, 'Speichern', "bauUiUmbenennenSpeichern('"+esc(b.id)+"')");
  } else if(bauForm && bauForm.id===b.id && bauForm.art==='loeschen'){
    h += `<div class="pcard" style="margin-top:10px">
      <div class="bez-sec" style="margin-top:0">Baustein „${esc(b.name)}" löschen?</div>
      <p class="hint">Eigene Eintragungen an den ${vor.length} Fundstellen werden dabei zurückgenommen. Die Standards selbst bleiben unverändert.</p>
      <div class="p-actions"><button class="btn btn-sec" onclick="bauFormSchliessen()">Abbrechen</button>
        <button class="btn btn-dgr" data-b="${esc(b.id)}" onclick="bauUiLoeschenBestaetigen(this.dataset.b)">Ja, löschen</button></div></div>`;
  } else {
    h += `<div class="p-actions">
      <button class="btn btn-sec" data-b="${esc(b.id)}" onclick="bauUiAnwenden(this.dataset.b)">Durchsetzen</button>
      <button class="btn btn-sec" data-b="${esc(b.id)}" onclick="bauUiLoesen(this.dataset.b)">Lösen</button>
      <button class="btn btn-sec" data-b="${esc(b.id)}" onclick="bauUiUmbenennen(this.dataset.b)">Umbenennen</button>
      <button class="btn btn-dgr" data-b="${esc(b.id)}" onclick="bauUiLoeschen(this.dataset.b)">Löschen</button>
    </div>`;
  }
  h += `</div></details>`;
  return h;
}

function bauVorschlagHTML(k, i){
  const titelVon = (sid)=>{ const s=bauStandards().find(x=>x.id===sid); return s?bauStdName(s):sid; };
  const offen = !!(bauForm && bauForm.art==='anlegen' && bauForm.i===i);
  return `<details class="vpanel bau-vor"${offen?' open':''}>
    <summary><span class="vp-ico">🔁</span><span class="vp-txt">
      <span class="vp-title">${esc(bauTitelVorschlag(k.zeilen))}</span>
      <span class="vp-desc">${k.laenge} Zeilen · gleich in ${k.standards.length} Standards</span>
    </span><span class="vp-badge">${k.ersparnis} Zeilen doppelt gepflegt</span></summary>
    <div class="vpanel-body">
      <div class="bau-vorz">${k.zeilen.map(z=>`<div class="bau-vz"><span class="bau-vm">${esc(z.menge||'')}</span><span>${esc(z.text)}</span></div>`).join('')}</div>
      <p class="hint">Steht in: ${k.standards.map(s=>esc(titelVon(s))).join(' · ')}</p>
      ${(bauForm && bauForm.art==='anlegen' && bauForm.i===i)
        ? bauNameFormHTML('Als Baustein anlegen','Der Name steht später in jedem Standard, in dem der Baustein gefunden wird.', bauForm.wert, 'Anlegen', 'bauUiAnlegenSpeichern('+i+')')
        : `<div class="p-actions"><button class="btn btn-pri" data-i="${i}" onclick="bauUiAnlegen(+this.dataset.i)">Als Baustein anlegen</button></div>`}
    </div></details>`;
}

function renderBausteine(){
  const box = $('scr-bausteine'); if(!box) return;
  const bil = bauBilanz();

  let h = `<div class="banner"><h2>⛓️ Bausteine</h2>
    <p>Die Standards sind voneinander abgeschrieben. Derselbe Aufbau steht deshalb vielfach im Bestand — und muss vielfach nachgezogen werden, wenn sich etwas ändert. Ein <b>Baustein</b> ist eine wiederkehrende Folge von Zeilen: einmal benennen, einmal pflegen, überall gültig.</p>
    <div class="rl-bilanz"><span><b>${bil.bausteine}</b> Bausteine</span><span>${bil.stellen} Fundstellen</span><span>in ${bil.standards} Standards</span>${bil.abweichungen?`<span class="warn"><b>${bil.abweichungen}</b> Abweichungen</span>`:''}</div></div>`;

  if(BAUSTEINE.length){
    h += `<div class="bez-sec">Deine Bausteine</div>`;
    h += BAUSTEINE.map(bauKarteHTML).join('');
  }

  const vs = bauVorschlaege();
  h += `<div class="bez-sec">Gefundene Wiederholungen</div>`;
  if(!vs.length){
    h += `<p class="hint">Keine weiteren Folgen gefunden, die in mindestens ${BAU_MIN_STANDARDS} Standards gleich vorkommen.</p>`;
  } else {
    const gesamt = vs.reduce((n,k)=>n+k.ersparnis,0);
    h += `<p class="hint">${vs.length} Folgen kommen mehrfach vor. Zusammen werden dadurch <b>${gesamt} Zeilen doppelt gepflegt</b>. Es wirkt nichts davon, bevor Du es anlegst.</p>`;
    const zeig = bauMehr ? vs : vs.slice(0, BAU_ZEIGE);
    h += zeig.map((k,i)=>bauVorschlagHTML(k,i)).join('');
    if(vs.length>BAU_ZEIGE) h += `<div class="p-actions"><button class="btn btn-sec" onclick="bauUiMehr()">${bauMehr?'Weniger zeigen':('Alle '+vs.length+' zeigen')}</button></div>`;
  }
  box.innerHTML = h;
}

/* Karte in der Verwaltung. Absichtlich schlank: Der teure Suchlauf startet
   erst, wenn jemand die Ansicht öffnet — nicht bei jedem Aufbau der
   Verwaltungsseite. */
function bausteinPanelHTML(){
  const bil = bauBilanz();
  const badge = bil.bausteine ? (bil.bausteine+' angelegt') : 'noch keine';
  return `<details class="vpanel" data-keys="bausteine baustein folge folgen wiederholung doppelt kopie kopien vorlage einmal ändern aendern abweichung">
    ${vsum('⛓️','Bausteine','Wiederkehrende Folgen von Zeilen einmal benennen und einmal pflegen — statt sie in jedem Standard nachzuziehen',badge)}
    <div class="vpanel-body">
    <p class="hint">Die Standards sind voneinander abgeschrieben. Derselbe Aufbau steht deshalb vielfach im Bestand. Ein Baustein fasst so eine Folge zusammen: einmal ändern, überall gültig — und wo im Bestand abgewichen wird, steht es dort schwarz auf weiß.</p>
    ${bil.bausteine?`<p class="hint"><b>${bil.stellen}</b> Fundstellen in <b>${bil.standards}</b> Standards${bil.abweichungen?` · <b>${bil.abweichungen}</b> Abweichungen`:' · einheitlich'}.</p>`:''}
    <div class="p-actions"><button class="btn btn-pri" onclick="openBausteinAdmin()">Bausteine öffnen</button></div>
    </div></details>`;
}
