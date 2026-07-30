/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — GERÄTE-STAMM

   Bisher wird ein Rhythmia-System exakt wie ein 11er-Skalpell modelliert:
   ein Name, ein Foto, ein Lagerort, ein Preis. Das geht an der Sache vorbei.

   Ein Verbrauchsartikel ist eine SORTE — man nimmt irgendeinen aus der Schachtel.
   Ein Gerät ist ein EXEMPLAR: Es steht in einem bestimmten Saal, hat eine
   Inventarnummer, eine Bedienanleitung, einen Prüftermin und jemanden, den man
   anruft, wenn es nicht geht. Diese Fragen stellt im Labor jede Schicht — und
   die App konnte sie bisher nicht beantworten.

   Was dieser Baustein NICHT tut:
     · Keine Wartungsverwaltung. Wir speichern den Termin, nicht den Prozess.
     · Keine Ausfall-/Störungshistorie. Dafür gibt es die Diagnose-Meldungen.
     · Keine Bestandsführung. Das bleibt ausdrücklich außerhalb der App.

   Die Trennung Gerät/Tätigkeit kommt aus der Zerlegung: „Raumkontrolle" steht
   44× als Gerät im Bestand und ist keins. Erst dadurch wird die Geräteliste
   überhaupt brauchbar.

   Ein Gerätesatz hängt am kanonischen Materialschlüssel (features/matkey.js),
   damit die Verknüpfung dieselbe Identität benutzt wie alles andere.
   ───────────────────────────────────────────────────────────── */

let GERAETE = (typeof loadJSON==='function') ? loadJSON('hkl_geraete', {}) : {};
if(!GERAETE || typeof GERAETE!=='object') GERAETE = {};
function saveGeraete(){ if(typeof saveJSON==='function') saveJSON('hkl_geraete', GERAETE); }

/* Die Felder eines Gerätesatzes. Als DATEN, nicht als Formularcode — so lässt
   sich ein Feld ergänzen, ohne die Maske anzufassen. */
const GERAET_FELDER = [
  { key:'name',       label:'Bezeichnung',      ph:'z. B. Rhythmia HDx',              leit:true },
  { key:'hersteller', label:'Hersteller',       ph:'z. B. Boston Scientific' },
  { key:'modell',     label:'Modell / Typ',     ph:'z. B. HDx' },
  { key:'inventarnr', label:'Inventarnummer',   ph:'Nummer der Medizintechnik',       leit:true },
  { key:'seriennr',   label:'Seriennummer',     ph:'vom Typenschild' },
  { key:'saal',       label:'Saal',             ph:'z. B. Saal 1',                    leit:true },
  { key:'standort',   label:'Standort im Raum', ph:'z. B. links neben dem Schaltraum' },
  { key:'ansprech',   label:'Ansprechpartner',  ph:'wen anrufen, wenn es nicht geht', leit:true },
  { key:'telefon',    label:'Telefon',          ph:'Durchwahl' },
  { key:'pruef_int',  label:'Prüfintervall (Monate)', ph:'z. B. 12',       typ:'zahl' },
  { key:'pruef_letzte',label:'Letzte Prüfung',  ph:'JJJJ-MM-TT',                      typ:'datum' },
  { key:'anleitung',  label:'Anleitung',        ph:'Anleitung aus der App verknüpfen', typ:'guide' },
  { key:'hinweis',    label:'Hinweis',          ph:'was man wissen muss' },
];

/* ===== Reine, testbare Helfer ===== */

/* Nächster Prüftermin aus letzter Prüfung + Intervall. Ohne beides: null.
   Rein — kein Zugriff auf Speicher oder Uhr außer dem übergebenen Datum. */
function geraetNaechstePruefung(rec){
  if(!rec) return null;
  const int = parseInt(rec.pruef_int, 10);
  const letzte = rec.pruef_letzte;
  if(!isFinite(int) || int<=0 || !letzte) return null;
  const d = new Date(letzte);
  if(isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + int);
  return d.toISOString().slice(0,10);
}

/* Status des Prüftermins: 'ok' | 'bald' | 'faellig' | 'unbekannt'.
   `heute` wird übergeben, damit der Test nicht von der Systemuhr abhängt. */
function geraetPruefStatus(rec, heute){
  const n = geraetNaechstePruefung(rec);
  if(!n) return 'unbekannt';
  const h = heute || (new Date().toISOString().slice(0,10));
  if(n < h) return 'faellig';
  const grenze = new Date(h); grenze.setMonth(grenze.getMonth()+1);
  return (n <= grenze.toISOString().slice(0,10)) ? 'bald' : 'ok';
}

/* Welche der wichtigen Angaben fehlen? Die Lückenliste ist der Arbeitsauftrag —
   dieselbe Idee wie beim Merkmalskatalog. */
function geraetLuecken(rec){
  if(!rec) return GERAET_FELDER.filter(f=>f.leit).map(f=>f.label);
  return GERAET_FELDER.filter(f=>f.leit && !String(rec[f.key]==null?'':rec[f.key]).trim()).map(f=>f.label);
}

/* Ist überhaupt etwas eingetragen? Ein leerer Satz soll nicht als „gepflegt"
   zählen, nur weil er existiert. */
function geraetGepflegt(rec){
  if(!rec) return false;
  return GERAET_FELDER.some(f=>f.key!=='name' && String(rec[f.key]==null?'':rec[f.key]).trim());
}

/* Kurzzeile für Listen: Saal · Inventarnummer · Prüfstatus. */
function geraetKurz(rec, heute){
  if(!rec) return '';
  const teile = [];
  if(rec.saal) teile.push(rec.saal);
  if(rec.inventarnr) teile.push('Inv. '+rec.inventarnr);
  const st = geraetPruefStatus(rec, heute);
  if(st==='faellig') teile.push('Prüfung überfällig');
  else if(st==='bald') teile.push('Prüfung bald');
  return teile.join(' · ');
}

/* ===== Zustand ===== */
function geraetFuer(key){ return (key && GERAETE[key]) || null; }
function geraetSetzen(key, felder){
  if(!key) return null;
  const now = new Date().toISOString();
  const rec = Object.assign({ key:key, createdAt:now }, GERAETE[key]||{}, felder||{}, { updatedAt:now });
  GERAETE[key] = rec; saveGeraete();
  return rec;
}
function geraetLoeschen(key){ if(key in GERAETE){ delete GERAETE[key]; saveGeraete(); } }

/* Alle Geräte-Zeilen aus den Standards — nach kanonischem Schlüssel gruppiert.
   Tätigkeiten sind hier bereits heraus (die Zerlegung liefert für sie keinen
   Schlüssel), deshalb ist diese Liste erstmals eine echte Geräteliste. */
function geraetListe(){
  if(typeof DB==='undefined' || !DB || !DB.standards || typeof cidOf!=='function') return [];
  const m = new Map();
  DB.standards.forEach(std=>{ (std.rubriken||[]).forEach((r,ri)=>{
    (r.sub_bereiche||[]).forEach((sb,si)=>{ (sb.eintraege||[]).forEach((e,ei)=>{
      if(!e || e.ist_fliesstext || e.natur==='ueberschrift') return;
      const cid = cidOf(std.id,ri,si,ei);
      const nat = (typeof effNatur==='function') ? effNatur(e,cid) : e.natur;
      if(nat!=='geraet') return;
      const key = (typeof effMatKey==='function') ? effMatKey(e,cid) : e.material_key;
      if(!key) return;                       /* Tätigkeit — kein Gerät */
      const z = (typeof zerlFuer==='function') ? zerlFuer(e,cid) : null;
      const name = (z && z.produkt && z.produkt.name) || e.anzeige_text || key;
      if(!m.has(key)) m.set(key, { key:key, name:name, vorkommen:0, standards:new Set() });
      const g = m.get(key); g.vorkommen++; g.standards.add(std.id);
    }); });
  }); });
  return [...m.values()]
    .map(g=>Object.assign(g, { standards:g.standards.size, rec:geraetFuer(g.key) }))
    .sort((a,b)=>(b.vorkommen-a.vorkommen)||a.name.localeCompare(b.name,'de'));
}

/* Kennzahlen für die Übersicht. */
function geraetBilanz(heute){
  const l = geraetListe();
  const b = { gesamt:l.length, gepflegt:0, ohneSaal:0, ohneInventar:0, pruefFaellig:0, pruefBald:0 };
  l.forEach(g=>{
    if(geraetGepflegt(g.rec)) b.gepflegt++;
    if(!g.rec || !g.rec.saal) b.ohneSaal++;
    if(!g.rec || !g.rec.inventarnr) b.ohneInventar++;
    const st = geraetPruefStatus(g.rec, heute);
    if(st==='faellig') b.pruefFaellig++; else if(st==='bald') b.pruefBald++;
  });
  return b;
}
