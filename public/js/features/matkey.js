/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — KANONISCHER MATERIALSCHLÜSSEL (die Brücke)

   Die Zerlegung (features/zerlegung.js) findet den sauberen Produktkern einer
   Standard-Zeile. Damit das etwas NÜTZT, muss der Rest der App diesen Kern als
   Identität benutzen — Materialindex, Stammsatz-Verknüpfung, Preise,
   Materialpflege, Merkmale, Suche.

   Genau hier liegt die Gefahr. Ein Wechsel der Identität würde jede vorhandene
   Verknüpfung verwaisen lassen: `hkl_matlink` zeigt von material_key auf einen
   Stammsatz, `hkl_prod` hält Preise je material_key, `hkl_care` Fotos und
   Lagerorte, `QE.mat` die Änderungen mit Reichweite „🌐 alle". Wer den
   Schlüssel einfach austauscht, verliert all das still.

   Deshalb migriert dieser Baustein NICHTS. Er legt eine Auflösungsebene davor:

     effMatKey(e, cid)   → der kanonische Schlüssel (zerlegt, wenn vorhanden)
     matKeyLesen(store, e, cid)
                         → liest einen Alt-Speicher über ALLE Schreibweisen,
                           die auf denselben kanonischen Schlüssel zeigen

   Ergebnis: Zwei Zeilen, die bisher „hämostaseventil map 152" und
   „hämostaseventil map152" hießen, sind ab sofort EIN Material — und der Preis,
   der unter der einen Schreibweise gepflegt wurde, gilt für beide. Nichts
   wurde umgeschrieben; alles bleibt rücknehmbar, indem man die Zerlegung
   verwirft.

   Der bestätigte Stand liegt in `hkl_zerlegung` (cid → bestätigte Felder).
   Ohne Eintrag dort gilt der Vorschlag der Zerlegung; ohne Zerlegung gilt der
   alte material_key. Drei Stufen, in dieser Reihenfolge — nie eine Lücke.
   ───────────────────────────────────────────────────────────── */

/* cid → vom Menschen bestätigte Zerlegung. Server-geteilt. */
let ZERLDB = (typeof loadJSON==='function') ? loadJSON('hkl_zerlegung', {}) : {};
if(!ZERLDB || typeof ZERLDB!=='object') ZERLDB = {};
function saveZerlDB(){ if(typeof saveJSON==='function') saveJSON('hkl_zerlegung', ZERLDB); }

/* Zerlegungen sind rein, aber nicht gratis: Bei 4.475 Einträgen darf pro
   Bildaufbau nicht alles neu geparst werden. Der Zwischenspeicher wird
   verworfen, sobald sich Daten ändern (matKeyCacheLeeren). */
let matKeyCache = null;      /* cid → kanonischer Schlüssel */
let matKeyZerlCache = null;  /* cid → vereinte Zerlegung */
let matKeyAltCache = null;   /* kanonisch → Set der Alt-Schlüssel */

function matKeyCacheLeeren(){ matKeyCache = null; matKeyZerlCache = null; matKeyAltCache = null; }

/* Ist der Baustein überhaupt einsatzbereit? Fehlt die Katalogdatei, verhält
   sich die App exakt wie vorher — das ist die Rückfallebene. */
function matKeyBereit(){
  if(typeof zerlege!=='function' || typeof ZERLKAT==='undefined' || !ZERLKAT) return false;
  /* Leere Listen sind KEIN Katalog. Der Vorgabewert im Modul ist bewusst leer,
     damit die App auch ohne die Datei startet — dann darf sich die Brücke aber
     nicht als einsatzbereit melden, sonst fällt niemand auf material_key
     zurück und der Assistent zeigt eine leere Maske statt einer Erklärung. */
  const verben = (ZERLKAT.taetigkeit && ZERLKAT.taetigkeit.verben) || [];
  return Array.isArray(ZERLKAT.putzen) && ZERLKAT.putzen.length>0 && verben.length>0;
}

/* Schlüssel für eine Bestätigung, die für JEDES Vorkommen desselben Textes
   gilt. „OP-Lampengriff" steht 46× im Bestand — wer das einmal entscheidet,
   soll es nicht 46× entscheiden müssen.

   Damit hat die Zerlegung dieselbe Reichweiten-Logik wie der Rest der App:
     📍 diese Stelle  → ZERLDB[cid]
     🌐 überall       → ZERLDB['t:<Text>']
   Die Stelle schlägt das Überall — wie bei QE.cid vor QE.mat. */
function zerlTextKey(e){
  if(!e) return null;
  const t = e.anzeige_text || e.roh_text || '';
  if(!t || typeof zerlSlug!=='function') return null;
  const s = zerlSlug(t);
  return s ? ('t:'+s) : null;
}

/* Die geltende Zerlegung einer Stelle: Vorschlag der Engine, überlagert von
   dem, was ein Mensch bestätigt hat. Der Mensch schlägt alles. */
function zerlFuer(e, cid){
  if(!e) return null;
  if(!matKeyZerlCache) matKeyZerlCache = {};
  if(cid && Object.prototype.hasOwnProperty.call(matKeyZerlCache, cid)) return matKeyZerlCache[cid];
  let erg = null;
  if(matKeyBereit()){
    const vorschlag = zerlege(e, ZERLKAT);
    /* Reichweite: die Stelle vor dem Überall. */
    const tk = zerlTextKey(e);
    const bestaetigt = (cid && ZERLDB[cid]) || (tk && ZERLDB[tk]) || null;
    erg = (typeof zerlVereinen==='function') ? zerlVereinen(vorschlag, bestaetigt) : vorschlag;
  }
  if(cid) matKeyZerlCache[cid] = erg;
  return erg;
}

/* Der kanonische Materialschlüssel einer Stelle.
   ① bestätigte oder vorgeschlagene Zerlegung mit Produktkern
   ② sonst der alte material_key
   ③ sonst nichts (die Zeile ist kein Material) */
function effMatKey(e, cid){
  if(!e) return null;
  if(cid){
    if(!matKeyCache) matKeyCache = {};
    if(Object.prototype.hasOwnProperty.call(matKeyCache, cid)) return matKeyCache[cid];
  }
  let key = null;
  const z = zerlFuer(e, cid);
  if(z && z.art==='produkt' && z.produkt && z.produkt.slug) key = z.produkt.slug;
  else if(z && z.art==='taetigkeit') key = null;     /* ein Tun ist kein Material */
  else key = e.material_key || null;
  if(cid) matKeyCache[cid] = key;
  return key;
}

/* Alle Alt-Schreibweisen, die auf denselben kanonischen Schlüssel führen.
   Damit findet ein Preis, der unter „hämostaseventil map 152" gepflegt wurde,
   auch die Zeile „Hämostaseventil MAP152". */
function matAltKeys(kanonisch){
  if(!kanonisch) return [];
  if(!matKeyAltCache){
    matKeyAltCache = {};
    if(typeof DB!=='undefined' && DB && DB.standards && typeof cidOf==='function'){
      DB.standards.forEach(std=>{ (std.rubriken||[]).forEach((r,ri)=>{
        (r.sub_bereiche||[]).forEach((sb,si)=>{ (sb.eintraege||[]).forEach((e,ei)=>{
          if(!e || !e.material_key) return;
          const k = effMatKey(e, cidOf(std.id,ri,si,ei));
          if(!k || k===e.material_key) return;
          (matKeyAltCache[k] = matKeyAltCache[k] || {})[e.material_key] = true;
        }); });
      }); });
    }
  }
  return Object.keys(matKeyAltCache[kanonisch] || {});
}

/* Liest einen nach material_key indizierten Alt-Speicher (MATLINK, PROD,
   careMem, QE.mat …) über den kanonischen Schlüssel UND alle Alt-Schreibweisen.
   Der kanonische Schlüssel gewinnt — wer neu pflegt, pflegt kanonisch. */
function matKeyLesen(store, kanonisch){
  if(!store || !kanonisch) return undefined;
  if(store[kanonisch]!==undefined) return store[kanonisch];
  const alt = matAltKeys(kanonisch);
  for(let i=0;i<alt.length;i++){ if(store[alt[i]]!==undefined) return store[alt[i]]; }
  return undefined;
}

/* Bestätigen: was der Mensch im Assistenten entschieden hat, festschreiben. */
function zerlBestaetigen(cid, felder){
  if(!cid) return;
  ZERLDB[cid] = Object.assign({}, ZERLDB[cid]||{}, felder||{});
  saveZerlDB(); matKeyCacheLeeren();
  if(typeof buildMaterialIndex==='function') buildMaterialIndex();
}
/* Verwerfen: zurück auf den Vorschlag (und damit ggf. auf den alten Schlüssel). */
function zerlVerwerfen(cid){
  if(cid in ZERLDB){ delete ZERLDB[cid]; saveZerlDB(); matKeyCacheLeeren();
    if(typeof buildMaterialIndex==='function') buildMaterialIndex(); }
}
/* Wie viele Stellen hat ein Mensch schon bestätigt? Für die Fortschrittsanzeige. */
function zerlBestaetigtAnzahl(){ return Object.keys(ZERLDB).length; }

/* ═══ Auswertung über den Bestand ════════════════════════════ */

/* Was bringt die Zerlegung? Vorher/Nachher in einem Aufruf — die Grundlage der
   Fortschrittsanzeige in der Materialzentrale. */
/* Wichtig für die ehrliche Lesart: `produktKeys` zählt NUR die Zeilen, die die
   Zerlegung sicher einem Produkt zuordnen konnte. `neuKeys` zählt zusätzlich
   die Zeilen, die auf ihren alten Satz-Schlüssel zurückfallen, weil die
   Zerlegung unklar blieb — das ist der Zustand, den die App heute anzeigt.
   Die Lücke zwischen beiden Zahlen IST die Arbeit, die im Aufräum-Assistenten
   auf einen Menschen wartet. Sie zu verschweigen wäre eine Schönfärberei. */
function matKeyBilanz(){
  const b = { eintraege:0, altKeys:0, neuKeys:0, produktKeys:0, rueckfall:0,
    taetigkeiten:0, unklar:0, zusammengefasst:0, offen:0 };
  if(typeof DB==='undefined' || !DB || !DB.standards || typeof cidOf!=='function') return b;
  const alt = {}, neu = {}, prod = {};
  DB.standards.forEach(std=>{ (std.rubriken||[]).forEach((r,ri)=>{
    if(r.typ!=='material' && r.typ!=='geraete') return;
    (r.sub_bereiche||[]).forEach((sb,si)=>{ (sb.eintraege||[]).forEach((e,ei)=>{
      if(!e || e.natur==='ueberschrift' || e.ist_fliesstext) return;
      b.eintraege++;
      if(e.material_key) alt[e.material_key] = true;
      const cid = cidOf(std.id,ri,si,ei);
      const z = zerlFuer(e, cid);
      if(z && z.art==='taetigkeit'){ b.taetigkeiten++; return; }
      if(z && z.art==='produkt' && z.produkt){ prod[z.produkt.slug] = true; }
      else { b.unklar++; b.rueckfall++; }
      const k = effMatKey(e, cid);
      if(k) neu[k] = true;
    }); });
  }); });
  b.altKeys = Object.keys(alt).length;
  b.neuKeys = Object.keys(neu).length;
  b.produktKeys = Object.keys(prod).length;
  b.zusammengefasst = Math.max(0, b.altKeys - b.produktKeys);
  b.offen = b.unklar;
  return b;
}
