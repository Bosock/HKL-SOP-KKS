/* ─────────────────────────────────────────────────────────────
   BEZEICHNUNGEN UND SYMBOLE

   Bis hierher stand in dieser Datei Fachwissen als Quelltext: eine Kette von
   Schlüsselwörtern für Rubrik- und Abschnittssymbole, eine feste Tabelle für
   Größenarten, drei fest verdrahtete Rubriknamen. Wer davon etwas ändern
   wollte, brauchte einen Entwickler.

   Das widerspricht Grundsatz ⑤ der App („alles konfigurierbar ohne
   Programmierung"). Jetzt liegt alles in public/data/bezeichnungen.json und
   ist über die Verwaltung pflegbar; die Werte hier sind nur noch RÜCKFALL,
   damit die App auch ohne die Datei startet und sich dann exakt wie früher
   verhält.

   Reihenfolge der Auflösung, überall gleich:
     ① von Hand vergeben (z. B. RUBICON für ein bestimmtes Rubriksymbol)
     ② eigene Änderung aus der Verwaltung  (hkl_bezeichnungen)
     ③ mitgelieferte Datei                 (data/bezeichnungen.json)
     ④ Rückfall im Code                    (unten)
   ───────────────────────────────────────────────────────────── */

const UK_PALETTE=['#34c98a','#e8b34a','#bd8ce8','#5fb0e0','#e0795f','#5fd0c0','#c9a24a','#d47fb0'];

/* Mitgelieferte Datei (data/bezeichnungen.json) und die eigenen Änderungen. */
let BEZDAT = null;
let BEZ = (typeof loadJSON==='function') ? loadJSON('hkl_bezeichnungen', {}) : {};
if(!BEZ || typeof BEZ!=='object') BEZ = {};
function bezSetData(j){ if(j && typeof j==='object') BEZDAT = j; }
function saveBez(){ if(typeof saveJSON==='function') saveJSON('hkl_bezeichnungen', BEZ); }

/* Ein Zweig der Konfiguration: eigene Änderung vor Datei vor Rückfall. */
function bezWert(zweig, feld, rueckfall){
  const eigen = BEZ && BEZ[zweig];
  if(eigen && eigen[feld]!==undefined && eigen[feld]!==null) return eigen[feld];
  const datei = BEZDAT && BEZDAT[zweig];
  if(datei && datei[feld]!==undefined && datei[feld]!==null) return datei[feld];
  return rueckfall;
}

/* Erstes passendes Symbol aus einer Regelliste [{enthaelt,symbol}]. */
function bezSymbol(regeln, name, vorgabe){
  const n = String(name==null?'':name).toLowerCase();
  const liste = Array.isArray(regeln)?regeln:[];
  for(let i=0;i<liste.length;i++){
    const w = String(liste[i] && liste[i].enthaelt || '').toLowerCase();
    if(w && n.indexOf(w)>=0) return liste[i].symbol || vorgabe;
  }
  return vorgabe;
}

/* ── Herstellerliste (features/ocr.js) ──────────────────────────
   Der folgenreichste Punkt: Ein neuer Lieferant im Haus ist ein
   Alltagsereignis. Stand die Liste im Code, wurde daraus ein Entwicklerticket
   — und bis dahin blieb das Herstellerfeld beim Scannen leer. */
const BEZ_HERSTELLER_RUECKFALL = ['Boston Scientific','St. Jude Medical','St. Jude','St Jude',
  'Abbott Medical','Abbott','Medtronic','Biotronik','Biosense Webster','Johnson & Johnson',
  'Baylis Medical','Baylis','Masimo','Osypka','Vanguard','Irvine Biomedical',
  'Terumo','Cordis','Merit Medical','Merit','Cook Medical','Cook Incorporated','Cook',
  'B. Braun','B.Braun','Braun','Teleflex','Penumbra','Asahi','Nipro','Edwards',
  'Biosensors','MicroPort','Japan Lifeline','Lifetech','Cardinal Health','Cardinal',
  'Argon','Optimed','Balt','Andramed','Angiokard','pfm medical','pfm','Vygon',
  'Rontis','iVascular','Acandis','Gore','Bard','Bioptimal','Biomerics','Biosense',
  'Abiomed','Sterimed','Peter Surgical','Ethicon','Johnson','Natec','MedAlliance'];
function bezHersteller(){
  const v = bezWert('hersteller','werte',null);
  return (Array.isArray(v) && v.length) ? v : BEZ_HERSTELLER_RUECKFALL;
}

/* ── Größenarten ──────────────────────────────────────────────── */
const BEZ_GROESSEN_RUECKFALL = {french:'Fr',laenge:'Länge',durchmesser:'Ø',volumen:'Vol',dimension:'Maß',naht:'Stärke',groesse_kuerzel:'Größe',typcode:'Typ','durchmesser+french':'Ø·Fr'};
function sizeLabel(t){
  const tab = bezWert('groessenarten','werte',null) || BEZ_GROESSEN_RUECKFALL;
  return tab[t] || BEZ_GROESSEN_RUECKFALL[t] || t || '';
}

/* ── Rubriktypen ──────────────────────────────────────────────── */
const BEZ_TYPEN_RUECKFALL = {material:'Material',geraete:'Geräte',sonstige:'Ablauf'};
function typLabel(t){
  const tab = bezWert('rubriktypen','werte',null) || BEZ_TYPEN_RUECKFALL;
  return tab[t] || BEZ_TYPEN_RUECKFALL[t] || 'Ablauf';
}

/* ── Rubriksymbole ────────────────────────────────────────────── */
const BEZ_RUBRIK_RUECKFALL = [
  {enthaelt:'saal',symbol:'🖥'},{enthaelt:'gerät',symbol:'🖥'},{enthaelt:'gerae',symbol:'🖥'},
  {enthaelt:'notfall',symbol:'🧰'},{enthaelt:'material',symbol:'📦'},{enthaelt:'patient',symbol:'🫀'},
  {enthaelt:'tisch',symbol:'🩺'},{enthaelt:'ablauf',symbol:'📋'},{enthaelt:'prozedur',symbol:'📋'},
  {enthaelt:'bettenwarte',symbol:'🛏'},{enthaelt:'abschließend',symbol:'✔'},{enthaelt:'abschliess',symbol:'✔'}];
function rubrikIcon(name,typ){
  /* Ein von Hand vergebenes Symbol schlägt jede Regel. */
  if(typeof RUBICON!=='undefined' && RUBICON[name]) return RUBICON[name];
  const regeln = bezWert('rubriksymbole','regeln',null) || BEZ_RUBRIK_RUECKFALL;
  const jeTyp  = bezWert('rubriksymbole','je_typ',null) || {material:'📦',geraete:'🖥'};
  const vorgabe= bezWert('rubriksymbole','vorgabe',null) || '📄';
  const gefunden = bezSymbol(regeln, name, null);
  if(gefunden) return gefunden;
  if(jeTyp[typ]) return jeTyp[typ];
  return vorgabe;
}

/* ── Symbole der Material-Abschnitte ──────────────────────────── */
const BEZ_UK_RUECKFALL = [
  {enthaelt:'lager',symbol:'📦'},{enthaelt:'vorbereitungsraum',symbol:'🧰'},{enthaelt:'raum',symbol:'🚪'},
  {enthaelt:'ansage',symbol:'📢'},{enthaelt:'weitere',symbol:'➕'},{enthaelt:'notfall',symbol:'🚨'},
  {enthaelt:'bettenwarte',symbol:'🛏'},{enthaelt:'zugang',symbol:'🩸'},{enthaelt:'aggregat',symbol:'🔋'}];
function ukKeywordIcon(name){
  const regeln = bezWert('unterkategoriesymbole','regeln',null) || BEZ_UK_RUECKFALL;
  const vorgabe= bezWert('unterkategoriesymbole','vorgabe',null) || '🗂';
  return bezSymbol(regeln, name, vorgabe);
}

/* ── Änderungen aus der Verwaltung ────────────────────────────── */
/* Setzt einen Zweig neu. Ein LEERER Wert löscht die eigene Änderung — dann
   gilt wieder die mitgelieferte Datei. So bleibt jede Anpassung rücknehmbar,
   ohne dass jemand die Vorgabewerte kennen muss. */
function bezSetzen(zweig, feld, wert){
  const leer = (wert==null || wert==='' || (Array.isArray(wert)&&!wert.length)
    || (typeof wert==='object' && !Array.isArray(wert) && !Object.keys(wert).length));
  if(leer){ if(BEZ[zweig]){ delete BEZ[zweig][feld]; if(!Object.keys(BEZ[zweig]).length) delete BEZ[zweig]; } }
  else { (BEZ[zweig]=BEZ[zweig]||{})[feld]=wert; }
  saveBez();
}
/* Wurde ein Zweig von Hand geändert? Für die Anzeige „geändert / Vorgabe". */
function bezGeaendert(zweig, feld){
  return !!(BEZ && BEZ[zweig] && BEZ[zweig][feld]!==undefined);
}
