/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — FACETTIERTE ÜBERSICHT

   Die Startseite war eine Liste von 47 Titeln mit Bindestrichen:

       Transfemoral - Edwards - SAPIEN 3 Ultra
       Transfemoral - Medtronic - Evolut FX+
       Rhythmia - Re-PVI
       Schrittmacher - AAI - VVI

   Wer eine Prozedur vorbereitet, sucht darin nicht nach einem Titel, sondern
   nach Merkmalen: „TAVI, transfemoral, Edwards". Der Titel trägt diese Merkmale
   längst — aber als Fließtext, aneinandergehängt mit Strichen. Man kann sie
   lesen, aber nicht danach greifen.

   ── Was dieser Baustein tut ──
   Er zerlegt den Titel an den Bindestrichen und macht aus den Teilen
   auswählbare Merkmale. Aus einer Liste von 47 wird ein Weg in drei Griffen:
   Bereich → Art → Hersteller.

   ── Woher die Bedeutung kommt (und woher NICHT) ──
   Im Quelltext steht kein einziges Fachwort. Die Zuordnung entsteht aus Daten,
   die die Verwaltung selbst pflegt:

     · der BEREICH ist die vorhandene Gruppe des Standards
     · HERSTELLER ist ein Titelteil, der in der Herstellerliste steht
       (public/data/bezeichnungen.json → im Verwaltungsmodus änderbar).
       Steht ein Lieferant nicht darin, ist sein Name eben ein Merkmal wie
       jedes andere — nichts wird geraten.
     · was übrig bleibt, wird nach seiner STELLE im Titel eingeordnet:
       der erste Teil ist die „Art", die weiteren sind „Ausprägungen".
     · der ZUSTAND kommt aus der Freigabe (features/freigabe.js)

   Auch die Namen der Merkmale sind nur Vorgaben und über die Bezeichnungen
   änderbar — „Art" heißt im TAVI-Bereich vielleicht besser „Zugang".

   ── Warum die Trennung am Bindestrich so vorsichtig ist ──
   „Re-PVI", „S-ICD", „CRT-D", „Mitra-Clip", „Event-Recorder" enthalten alle
   einen Bindestrich, der KEINE Trennung ist. Getrennt wird deshalb nur an
   einem Strich mit Leerraum an mindestens einer Seite — das trifft
   „Transfemoral - Edwards" und auch „LAA- Abbott", aber nie „Re-PVI".

   ── Wie die Merkmale sich gegenseitig einschränken ──
   Jede Auswahl schränkt die übrigen Merkmale ein: Nach „TAVI" bietet „Art" nur
   noch Transfemoral · Transapikal · Transaxillär. Und die Zähler zeigen immer,
   wie viele Standards eine Auswahl übrig lässt — eine Auswahl, die auf null
   führt, wird gar nicht erst angeboten.
   ───────────────────────────────────────────────────────────── */

/* ═══════════ 1. Reine Zerlegung ═══════════ */

/* Titel → Teile. Getrennt wird an einem Strich mit Leerraum an mindestens
   einer Seite. Rein. */
function facTeile(titel){
  return String(titel==null?'':titel)
    .split(/\s+[-–—]\s*|\s*[-–—]\s+/)
    .map(x=>x.trim()).filter(Boolean);
}

/* Vergleichsform für den Abgleich mit der Herstellerliste. Rein. */
function facNorm(s){
  return String(s==null?'':s).toLowerCase()
    .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
    .replace(/[^a-z0-9]+/g,'');
}

/* Trennt die Teile in Hersteller und Rest. `liste` ist die gepflegte
   Herstellerliste — ohne sie ist einfach kein Teil ein Hersteller. Rein. */
function facHersteller(teile, liste){
  const idx = new Map();
  (liste||[]).forEach(h=>{ const n=facNorm(h); if(n) idx.set(n,h); });
  const hersteller = [], rest = [];
  (teile||[]).forEach(t=>{ const h=idx.get(facNorm(t)); if(h) hersteller.push(h); else rest.push(t); });
  return { hersteller, rest };
}

/* Die Merkmale EINES Standards. `kontext` liefert Gruppe, Titel, Zustand und
   Herstellerliste — damit bleibt die Funktion rein und prüfbar. */
function facVonStandard(std, kontext){
  const k = kontext||{};
  const titel = k.titel || (std&&std.titel) || '';
  const { hersteller, rest } = facHersteller(facTeile(titel), k.hersteller||[]);
  return {
    gruppe: k.gruppe ? [k.gruppe] : [],
    hersteller,
    art: rest.length ? [rest[0]] : [],
    auspraegung: rest.slice(1),
    zustand: k.zustand ? [k.zustand] : [],
  };
}

/* Die Merkmalsarten. Reihenfolge = Reihenfolge auf dem Bildschirm.
   Die Namen sind Vorgaben; `facLabel` lässt sie überschreiben. */
const FAC_ARTEN = [
  { key:'gruppe',      vorgabe:'Bereich' },
  { key:'art',         vorgabe:'Art' },
  { key:'hersteller',  vorgabe:'Hersteller' },
  { key:'auspraegung', vorgabe:'Ausprägung' },
  { key:'zustand',     vorgabe:'Freigabe' },
];
function facLabel(key){
  const d = FAC_ARTEN.find(x=>x.key===key);
  const vorgabe = d ? d.vorgabe : key;
  return (typeof bezWert==='function') ? bezWert('facetten', key, vorgabe) : vorgabe;
}

/* Passt ein Standard zur Auswahl? Innerhalb einer Merkmalsart gilt ODER,
   zwischen den Arten UND. Rein. */
function facPasst(merkmale, wahl){
  const w = wahl||{};
  return FAC_ARTEN.every(a=>{
    const gewaehlt = w[a.key]||[];
    if(!gewaehlt.length) return true;
    const hat = (merkmale&&merkmale[a.key])||[];
    return gewaehlt.some(g=>hat.indexOf(g)>=0);
  });
}

/* Baut die Merkmalsleiste: je Art die Werte mit ihrer Trefferzahl UNTER
   Berücksichtigung der übrigen Auswahl (echte Facettensuche — eine Auswahl,
   die auf null führt, wird gar nicht erst angeboten). Rein.

   `posten` ist eine Liste {id, merkmale}. */
function facBauen(posten, wahl){
  const w = wahl||{};
  const aus = [];
  FAC_ARTEN.forEach(a=>{
    /* Für die Zähler DIESER Art zählt die Auswahl aller ANDEREN Arten. */
    const ohneMich = {}; Object.keys(w).forEach(k=>{ if(k!==a.key) ohneMich[k]=w[k]; });
    const zaehler = new Map();
    (posten||[]).forEach(p=>{
      if(!facPasst(p.merkmale, ohneMich)) return;
      ((p.merkmale&&p.merkmale[a.key])||[]).forEach(v=>zaehler.set(v,(zaehler.get(v)||0)+1));
    });
    const gewaehlt = w[a.key]||[];
    const werte = [...zaehler.entries()]
      .map(([wert,n])=>({ wert, n, an:gewaehlt.indexOf(wert)>=0 }))
      .sort((x,y)=> (y.n-x.n) || String(x.wert).localeCompare(String(y.wert),'de'));
    /* Eine Art, die nur EINEN Wert kennt, unterscheidet nichts — es sei denn,
       sie ist gerade ausgewählt (dann muss man sie zurücknehmen können). */
    if(werte.length>1 || gewaehlt.length) aus.push({ key:a.key, label:facLabel(a.key), werte });
  });
  return aus;
}

function facAnzahlGewaehlt(wahl){
  return FAC_ARTEN.reduce((n,a)=>n+(((wahl||{})[a.key]||[]).length),0);
}

/* ═══════════ 2. Zustand (gerätelokal) ═══════════

   Die Merkmalsauswahl ist eine ANSICHT, kein Inhalt: Wer im EPU-Saal steht,
   filtert anders als die Leitung. Sie bleibt deshalb auf dem Gerät und wird
   nicht geteilt. Damit niemand später ein Standard „vermisst", steht über der
   Liste immer sichtbar, wie viele von wie vielen gerade übrig sind. */
let FACWAHL = (typeof loadJSON==='function') ? loadJSON('hkl_facetten', {}) : {};
if(!FACWAHL || typeof FACWAHL!=='object' || Array.isArray(FACWAHL)) FACWAHL = {};
FAC_ARTEN.forEach(a=>{ if(!Array.isArray(FACWAHL[a.key])) FACWAHL[a.key]=[]; });
function saveFacWahl(){ if(typeof saveJSON==='function') saveJSON('hkl_facetten', FACWAHL); }

let facMehr = {};   /* key → true: alle Werte dieser Art zeigen */
let facLetzteFacetten = null;  /* zuletzt gezeichnete Leiste (Klick per Index) */
const FAC_ZEIGE = 8;

/* Merkmale aller sichtbaren Standards — mit den Angaben aus der App. */
function facPosten(){
  if(typeof DB==='undefined' || !DB || !DB.standards) return [];
  const hersteller = (typeof bezHersteller==='function') ? bezHersteller() : [];
  return DB.standards
    .filter(s=>!(typeof stdHidden==='function' && stdHidden(s)) || (typeof ADMIN!=='undefined' && ADMIN))
    .map(s=>{
      const zustand = (typeof frgStatus==='function') ? frgStatus(s) : '';
      const zLabel = (zustand && zustand!=='ohne' && typeof frgText==='function')
        ? (frgText(zustand).kurz||'') : '';
      return { id:s.id, std:s, merkmale: facVonStandard(s, {
        titel: (typeof stdTitel==='function') ? stdTitel(s) : s.titel,
        gruppe: (typeof stdGruppe==='function') ? stdGruppe(s) : s.gruppe,
        hersteller, zustand: zLabel }) };
    });
}

/* Die Standard-IDs, die zur Auswahl passen (null = keine Auswahl aktiv). */
function facTrefferIds(){
  if(!facAnzahlGewaehlt(FACWAHL)) return null;
  const ids = {};
  facPosten().forEach(p=>{ if(facPasst(p.merkmale, FACWAHL)) ids[p.id]=true; });
  return ids;
}

function facWaehle(key, wert){
  if(!FACWAHL[key]) FACWAHL[key]=[];
  const i = FACWAHL[key].indexOf(wert);
  if(i>=0) FACWAHL[key].splice(i,1); else FACWAHL[key].push(wert);
  saveFacWahl();
  if(typeof renderStandards==='function') renderStandards($('searchInput')?$('searchInput').value:'');
}
function facZuruecksetzen(){
  FAC_ARTEN.forEach(a=>{ FACWAHL[a.key]=[]; });
  facMehr = {};
  saveFacWahl();
  if(typeof renderStandards==='function') renderStandards($('searchInput')?$('searchInput').value:'');
}
function facMehrZeigen(key){ facMehr[key]=!facMehr[key];
  if(typeof renderStandards==='function') renderStandards($('searchInput')?$('searchInput').value:''); }

/* ═══════════ 3. Anzeige ═══════════ */

function facBarHTML(){
  const posten = facPosten();
  if(posten.length<4) return '';           /* bei einer Handvoll lohnt kein Filter */
  const facetten = facBauen(posten, FACWAHL);
  facLetzteFacetten = facetten;   /* die Werte werden per Index angeklickt, siehe unten */
  if(!facetten.length) return '';
  const gewaehlt = facAnzahlGewaehlt(FACWAHL);
  const treffer = gewaehlt ? posten.filter(p=>facPasst(p.merkmale, FACWAHL)).length : posten.length;

  let h = `<div class="facbar">`;
  /* Immer sichtbar, sobald gefiltert wird: wie viele von wie vielen. Sonst
     „fehlt" später ein Standard, ohne dass jemand den Filter im Sinn hat. */
  if(gewaehlt){
    h += `<div class="fac-aktiv"><span><b>${treffer}</b> von ${posten.length} Standards</span>
      <button class="fac-reset" onclick="facZuruecksetzen()">Filter zurücksetzen ✕</button></div>`;
  }
  facetten.forEach(f=>{
    const alle = !!facMehr[f.key];
    const zeig = alle ? f.werte : f.werte.slice(0, FAC_ZEIGE);
    const rest = f.werte.length - zeig.length;
    h += `<div class="fac-reihe"><span class="fac-name">${esc(f.label)}</span><div class="fac-chips">`;
    zeig.forEach((v,i)=>{
      const idx = f.werte.indexOf(v);
      h += `<button class="facchip${v.an?' on':''}" data-f="${esc(f.key)}" data-i="${idx}"
        aria-pressed="${v.an?'true':'false'}"
        onclick="facWaehleIdx(this.dataset.f,+this.dataset.i)">${esc(v.wert)}<span class="fac-n">${v.n}</span></button>`;
    });
    if(rest>0 || alle) h += `<button class="facchip fac-more" data-f="${esc(f.key)}" onclick="facMehrZeigen(this.dataset.f)">${alle?'weniger':('＋'+rest)}</button>`;
    h += `</div></div>`;
  });
  h += `</div>`;
  return h;
}

/* Werte kommen aus den Daten und dürfen nicht als Freitext ins onclick
   (esc() macht kein Apostroph attributsicher, siehe ARCHITECTURE.md
   „Altlasten") — daher der Umweg über den Index. */
function facWaehleIdx(key, idx){
  const f = (facLetzteFacetten||[]).find(x=>x.key===key);
  if(!f || !f.werte[idx]) return;
  facWaehle(key, f.werte[idx].wert);
}
