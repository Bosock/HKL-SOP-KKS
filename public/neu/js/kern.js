/* ─────────────────────────────────────────────────────────────
   NEUE APP — KERN (reine Logik, ohne DOM, ohne Speicher → testbar)

   Das Datenmodell (Entscheidungen des Auftraggebers, 06.11.2026):
     · Stammdaten gelten überall: Material, Gerät (je Gerätetyp ein Eintrag),
       Medikament. Jede Angabe hat GENAU einen Besitzer.
     · Eine Position im Standard gilt nur hier: Verweis auf einen Stammsatz
       ODER eigener Text, dazu Menge, Zusatz, Bereich, „auf Ansage".
     · Feste Kennungen statt Text oder Listenplatz.
     · Alle erweiterbaren Listen (Arten, Kategorien, Bereiche, Hersteller …)
       liegen in EINEM Verzeichnis, mit Anlegedatum, Herkunft und Verwendung.

   Schlüssel im geteilten Zustand des Neuaufbaus (alle mit Präfix na_):
     na_m_<id>  Material        na_g_<id>  Gerätetyp      na_d_<id>  Medikament
     na_s_<id>  Standard        na_b_<id>  Baustein       na_l_<liste>  Liste
     na_ml_<id> Meldung         na_pk_<id> Papierkorb     na_vl_<monat>_<gerät>  Verlauf
   ───────────────────────────────────────────────────────────── */

/* Kennung: Zeit + Zufall, kurz, sortierbar, onclick-sicher. */
function naId(p){ return (p||'x')+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function naJetzt(){ return new Date().toISOString(); }

/* Für Vergleiche falten: klein, Umlaute zur Grundform, nur Buchstaben/Ziffern. */
function naNorm(s){
  return String(s==null?'':s).toLowerCase()
    .replace(/ä/g,'a').replace(/ö/g,'o').replace(/ü/g,'u').replace(/ß/g,'ss')
    .replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}
/* Editierdistanz (klein gehalten, nur für kurze Namen). */
function naDistanz(a,b){
  a=a||''; b=b||''; const m=a.length, n=b.length; if(!m) return n; if(!n) return m;
  let prev=[]; for(let j=0;j<=n;j++) prev[j]=j;
  for(let i=1;i<=m;i++){ const cur=[i];
    for(let j=1;j<=n;j++) cur[j]=Math.min(prev[j]+1, cur[j-1]+1, prev[j-1]+(a[i-1]===b[j-1]?0:1));
    prev=cur; }
  return prev[n];
}
/* „Gibt es das schon?" — gleiche oder ähnliche Namen in einer Liste.
   items: [{id, name, …}]. Rückgabe [{item, grad:'gleich'|'ähnlich'}]. Rein. */
function naAehnliche(name, items){
  const q=naNorm(name); if(!q) return [];
  const out=[];
  (items||[]).forEach(it=>{
    if(!it || it.archiviert) return;
    const n=naNorm(it.name);
    if(!n) return;
    if(n===q){ out.push({ item:it, grad:'gleich' }); return; }
    const kurz=Math.min(n.length,q.length);
    const enthalten = kurz>=4 && (n.indexOf(q)>=0 || q.indexOf(n)>=0);
    const nah = kurz>=5 && naDistanz(n,q) <= (kurz>=10?2:1);
    const ohneKlammer = naNorm(String(it.name).replace(/\(.*?\)/g,''))===naNorm(String(name).replace(/\(.*?\)/g,''));
    if(enthalten || nah || ohneKlammer) out.push({ item:it, grad:'ähnlich' });
  });
  return out.sort((a,b)=>(a.grad===b.grad?0:(a.grad==='gleich'?-1:1)));
}

/* ── GTIN / GS1 ── */
function naGtinPruefziffer(g){
  const s=String(g==null?'':g).trim();
  if(!/^(\d{8}|\d{12,14})$/.test(s)) return false;
  const z=s.split('').map(Number); const pz=z.pop(); let summe=0;
  z.reverse().forEach((d,i)=>{ summe+=d*(i%2===0?3:1); });
  return (10-(summe%10))%10===pz;
}
/* Auf 14 Stellen bringen (GTIN-14), sonst unverändert. */
function naGtinKey(g){ const s=String(g==null?'':g).replace(/\D/g,''); return (s.length>=8 && s.length<14) ? s.padStart(14,'0') : s; }
/* GS1-Zerlegung: behalten wird NUR die GTIN (01) und die Hersteller-REF (240).
   Charge und Verfall werden gelesen, um die Felder sicher zu trennen, aber
   verworfen (Grundsatz A2). */
function naParseGS1(raw){
  let s=String(raw==null?'':raw).replace(/^\]d2|^\]C1|^\]Q3/,'');
  const GS='\u001d'; const out={};
  const FIX={ '00':18,'01':14,'02':14,'11':6,'12':6,'13':6,'15':6,'16':6,'17':6,'20':2 };
  s=s.replace(/\((\d{2,4})\)/g,GS+'$1').replace(/^\u001d/,'');
  let i=0, n=0;
  while(i<s.length && n<30){ n++;
    if(s[i]===GS){ i++; continue; }
    const ai2=s.slice(i,i+2);
    if(FIX[ai2]){ out[ai2]=s.slice(i+2,i+2+FIX[ai2]); i+=2+FIX[ai2]; continue; }
    const ai3=s.slice(i,i+3); const ai=(['240','241','250','251','253','254','400','401','403','410','420','421','710','711','712','713','714'].indexOf(ai3)>=0)?ai3:(['10','21','22','30','37','90','91','92','93','94','95','96','97','98','99'].indexOf(ai2)>=0?ai2:null);
    if(!ai) break;
    const start=i+ai.length; let ende=s.indexOf(GS,start); if(ende<0) ende=s.length;
    out[ai]=s.slice(start,ende); i=ende;
  }
  return { gtin: out['01']||'', itemRef: out['240']||'' };
}
/* Für die Etikett-Erkennung (ocr.js ruft parseScan, wenn vorhanden). */
function naParseScan(raw){
  const s=String(raw==null?'':raw).trim();
  if(/^https?:\/\//i.test(s)) return { kind:'url', url:s };
  if(/^\d{8,14}$/.test(s)) return { kind:'gtin', gtin:naGtinKey(s), itemRef:'' };
  const g=naParseGS1(s);
  return g.gtin ? { kind:'gs1', gtin:naGtinKey(g.gtin), itemRef:g.itemRef } : { kind:'text', text:s };
}

/* ── Mengen und Kosten ──
   „2x", „2 Stk", "2" → 2; „0,5" → 0,5; leer, „1-2", „bei Bedarf" → null
   (unklar). Unklares wird NIE still als 1 gezählt (Befund F1). */
function naMengeZahl(m){
  if(m==null) return null;
  if(typeof m==='number') return (isFinite(m)&&m>0)?m:null;
  const s=String(m).trim().toLowerCase().replace(',','.');
  if(!s) return null;
  if(/\d\s*[-–\/]\s*\d/.test(s)) return null;                 /* Spanne: unklar */
  const t=s.match(/^(\d+(?:\.\d+)?)\s*(x|×|stk\.?|stück|st\.?|pack\.?|pck\.?)?$/);
  if(!t) return null;
  const z=parseFloat(t[1]); return (isFinite(z)&&z>0)?z:null;
}
/* Preis einer Einheit: betrag / bezugsmenge (z. B. 120 € je 10 Stück → 12 €). */
function naStueckpreis(preis){
  if(!preis || preis.betrag==null || preis.betrag==='') return null;
  const b=Number(String(preis.betrag).replace(',','.')); const q=Number(preis.bezugsmenge||1);
  if(!isFinite(b) || !isFinite(q) || q<=0) return null;
  return b/q;
}
/* Plankosten eines Standards. stamm(ref) liefert den Stammsatz zu {typ,id}.
   Rückgabe { summe, vollstaendig, posten:[…], fehlend } — Lücken werden
   benannt, nicht mit 0 oder 1 überdeckt. Rein. */
function naKosten(std, stamm){
  const posten=[]; let summe=0, fehlend=0;
  naPositionen(std).forEach(({pos})=>{
    if(!pos.ref || (pos.ref.typ!=='material' && pos.ref.typ!=='medikament')) return;
    const s=stamm(pos.ref); const menge=naMengeZahl(pos.menge); const preis=s?naStueckpreis(s.preis):null;
    const fehlt = !s ? 'stammsatz' : (menge==null ? 'menge' : (preis==null ? 'preis' : null));
    const betrag = fehlt ? null : menge*preis;
    if(fehlt) fehlend++; else summe+=betrag;
    posten.push({ pos, name:s?s.name:'?', menge, preis, betrag, fehlt });
  });
  return { summe, vollstaendig: fehlend===0, fehlend, posten };
}

/* ── Standards ── */
/* Alle Positionen eines Standards mit Ort. Rein. */
function naPositionen(std){
  const out=[];
  ((std&&std.rubriken)||[]).forEach(r=>(r.abschnitte||[]).forEach(a=>(a.positionen||[]).forEach(p=>out.push({ rubrik:r, abschnitt:a, pos:p }))));
  return out;
}
/* Wo wird ein Stammsatz verwendet? standards: [std]. Rein. */
function naVerwendungen(standards, typ, id){
  const out=[];
  (standards||[]).forEach(s=>naPositionen(s).forEach(x=>{ if(x.pos.ref && x.pos.ref.typ===typ && x.pos.ref.id===id) out.push(Object.assign({ std:s }, x)); }));
  return out;
}
/* Wo wird ein Listeneintrag verwendet? Gibt die Anzahl zurück. Rein. */
function naListenVerwendung(liste, id, daten){
  let n=0; const d=daten||{};
  const standards=d.standards||[], material=d.material||[], geraete=d.geraete||[], medikamente=d.medikamente||[];
  const stamm=[].concat(material,geraete,medikamente);
  if(liste==='arten') standards.forEach(s=>naPositionen(s).forEach(x=>{ if(x.pos.art===id) n++; }));
  else if(liste==='bereiche'){ standards.forEach(s=>naPositionen(s).forEach(x=>{ if(x.pos.bereich===id) n++; })); stamm.forEach(m=>{ if(m.bereich===id) n++; }); }
  else if(liste==='hersteller') stamm.forEach(m=>{ if(m.hersteller===id) n++; });
  else if(liste==='lagerorte') stamm.forEach(m=>{ if(m.lagerort===id) n++; });
  else if(liste==='gruppen') standards.forEach(s=>{ if(s.gruppe===id) n++; });
  else if(liste==='kennzeichen') standards.forEach(s=>{ if((s.kennzeichen||[]).indexOf(id)>=0) n++; });
  else if(liste==='abschnitte') standards.forEach(s=>(s.rubriken||[]).forEach(r=>(r.abschnitte||[]).forEach(a=>{ if(a.name===id) n++; })));
  else if(liste==='rubriken') standards.forEach(s=>(s.rubriken||[]).forEach(r=>{ if(r.name===id) n++; }));
  else if(liste==='darreichung') medikamente.forEach(m=>{ if(m.darreichung===id) n++; });
  else if(liste==='geraetekategorien') geraete.forEach(g=>{ if(g.kategorie===id) n++; });
  else if(liste==='kategorien') material.forEach(m=>{ if(m.kategorie===id) n++; });
  return n;
}

/* Rüstliste (E9): erst nach Bereich (Tischvorbereitung · Eingriffsvorbereitung
   · …), darin nach Lagerort — ein Weg je Ort. „Auf Ansage" ist eine
   MARKIERUNG innerhalb des Bereichs, keine eigene Gruppe. Der Bereich kommt
   von der Position, sonst als Vorgabe vom Stammsatz. Rein. */
function naRuestliste(std, stamm, bereiche){
  const gruppen={}; const reihe=(bereiche||[]).map(b=>b.id);
  naPositionen(std).forEach(({pos})=>{
    if(!pos.ref) return;
    const s=stamm(pos.ref); if(!s) return;
    const b=pos.bereich || s.bereich || '';
    const g=gruppen[b]||(gruppen[b]={ bereich:b, orte:{} });
    const ort=(s.lagerort||'').trim() || '';
    (g.orte[ort]||(g.orte[ort]=[])).push({ pos, name:s.name, menge:pos.menge||'', ansage:!!pos.ansage, typ:pos.ref.typ });
  });
  const keys=Object.keys(gruppen).sort((a,b)=>{ const ia=reihe.indexOf(a), ib=reihe.indexOf(b);
    return (ia<0?999:ia)-(ib<0?999:ib) || a.localeCompare(b); });
  return keys.map(k=>({ bereich:k, orte:Object.keys(gruppen[k].orte).sort((a,b)=>(a===''?1:0)-(b===''?1:0)||a.localeCompare(b,'de'))
    .map(o=>({ ort:o, posten:gruppen[k].orte[o].sort((x,y)=>(x.ansage?1:0)-(y.ansage?1:0)) })) }));
}

/* ── Kategorien & Felder (Material): mitgelieferter Merkmalskatalog
   (data/merkmale.json) + Overlay des Hauses. Overlay:
     { klassen:{ <id>:{ label?, neu?, dazu?, aus?, diff? } },
       merkmale:{ <mid>:{ label, typ, einheit?, werte?, anker? } },
       werte:{ <mid>:[zusätzliche Werte] } }   ← D2: Werte an Ort und Stelle
   Die Quelle wird nie verändert. Rein. */
function naMerkmalMuster(d){
  const esc2=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  if(d.typ==='ja_nein'){ const w=(d.anker&&d.anker.length?d.anker:[d.label]).filter(Boolean); const abbild={};
    w.forEach(x=>{ abbild[String(x).toUpperCase().replace(/\s+/g,' ')]='ja'; });
    return { muster:w.map(x=>'\\b('+esc2(x)+')\\b'), abbild, nur_anker:false, anker:[] }; }
  if(d.typ==='text') return { muster:['^\\s*[:=]?\\s*([A-Za-z0-9ÄÖÜäöü][A-Za-z0-9ÄÖÜäöüß.\\/-]{0,29})'], nur_anker:true };
  return { nur_anker:true };
}
function naKatalog(quelle, tpl){
  if(!quelle || !Array.isArray(quelle.merkmale)) return { klassen:[], merkmale:[], einheiten:{}, ref_grammatik:[] };
  const t=tpl||{}; const kl=t.klassen||{}, mm=t.merkmale||{}, ww=t.werte||{};
  const klassen=(quelle.klassen||[]).map(k=>{ const v=kl[k.id]; if(!v) return k; const n=Object.assign({},k);
    if(v.label) n.label=v.label; if(Array.isArray(v.diff)) n.leit=v.diff.slice(); if(v.archiviert) n.archiviert=true;
    /* zusätzliche Suchwörter und Register-Einordnung für eine vorhandene Kategorie */
    if(Array.isArray(v.worteDazu)) n.worte=(k.worte||[]).concat(v.worteDazu.filter(w=>(k.worte||[]).indexOf(w)<0));
    /* vom Haus festgelegte Suchwörter ersetzen die Vorgabe (Grundsatz A7) */
    if(Array.isArray(v.worte)) n.worte=v.worte.slice();
    if(Array.isArray(v.emdn)) n.emdn=(k.emdn||[]).concat(v.emdn);
    return n; });
  Object.keys(kl).forEach(id=>{ const v=kl[id]; if(!v||!v.neu||klassen.some(k=>k.id===id)) return;
    klassen.push({ id, label:v.label||id, worte:(Array.isArray(v.worte)&&v.worte.length)?v.worte.slice():[String(v.label||id).toLowerCase()], emdn:Array.isArray(v.emdn)?v.emdn.slice():[],
      leit:Array.isArray(v.diff)?v.diff.slice():[], eigen:!v.vorgabe, archiviert:!!v.archiviert, angelegt:v.angelegt||null, wo:v.wo||'' }); });
  const inKlasse=(mid, orig)=>{ const s={}; (orig||[]).forEach(x=>{ s[x]=1; });
    Object.keys(kl).forEach(id=>{ const v=kl[id]||{};
      if(Array.isArray(v.dazu)&&v.dazu.indexOf(mid)>=0) s[id]=1;
      if(Array.isArray(v.aus)&&v.aus.indexOf(mid)>=0) delete s[id]; });
    return Object.keys(s); };
  const merkmale=quelle.merkmale.map(d=>{ const ks=inKlasse(d.id,d.klassen); const extra=ww[d.id]||[];
    if(ks.join('|')===(d.klassen||[]).join('|') && !extra.length) return d;
    const n=Object.assign({},d,{ klassen:ks }); if(extra.length) n.werte=(d.werte||[]).concat(extra.filter(x=>(d.werte||[]).indexOf(x)<0)); return n; });
  Object.keys(mm).forEach(mid=>{ const v=mm[mid]; if(!v||!v.label||merkmale.some(d=>d.id===mid)) return;
    const anker=(Array.isArray(v.anker)&&v.anker.length?v.anker:[v.label]).map(a=>String(a).toLowerCase()).filter(Boolean);
    const d={ id:mid, label:v.label, kurz:v.label, typ:v.typ||'text', einheit:v.einheit||null, rang:35, eigen:true, klassen:inKlasse(mid,[]), anker };
    const w=(Array.isArray(v.werte)?v.werte:[]).concat(ww[mid]||[]); if(w.length) d.werte=w;
    Object.assign(d, naMerkmalMuster(Object.assign({},v,{anker:v.anker}))); if(d.typ!=='ja_nein') d.anker=anker;
    merkmale.push(d); });
  return Object.assign({}, quelle, { klassen, merkmale });
}
/* Felder einer Kategorie: ★ zuerst, dann eigene, dann allgemeine. Rein. */
function naFelder(kat, klasseId){
  const k=((kat&&kat.klassen)||[]).find(x=>x.id===klasseId)||{ leit:[] };
  const diff=Array.isArray(k.leit)?k.leit:[];
  const alle=((kat&&kat.merkmale)||[]).filter(d=>(d.klassen||[]).indexOf(klasseId)>=0||(d.klassen||[]).indexOf('allgemein')>=0);
  const eigen=alle.filter(d=>(d.klassen||[]).indexOf(klasseId)>=0);
  const rang=d=>(d.rang||99);
  return { diff:diff.map(id=>eigen.find(d=>d.id===id)).filter(Boolean),
    weitere:eigen.filter(d=>diff.indexOf(d.id)<0).sort((a,b)=>rang(a)-rang(b)),
    allgemein:alle.filter(d=>(d.klassen||[]).indexOf(klasseId)<0).sort((a,b)=>rang(a)-rang(b)) };
}
/* Hersteller aus dem GTIN-Präfix (eindeutige Nachbarn, ≥ 7 Stellen). Rein. */
function naHerstellerAusGtin(material, gtin){
  const kern=s=>{ s=String(s||'').replace(/\D/g,''); return s.length===14?s.slice(1):(s.length===13?s:''); };
  const k=kern(naGtinKey(gtin)); if(!k) return null;
  let best=0, namen={};
  (material||[]).forEach(r=>{ if(!r||!r.hersteller||!r.gtin) return; const k2=kern(r.gtin); if(!k2||k2===k) return;
    let n=0; while(n<k.length&&k[n]===k2[n]) n++; if(n<7) return;
    if(n>best){ best=n; namen={}; } if(n===best) namen[r.hersteller]=1; });
  const l=Object.keys(namen); return (best>=7&&l.length===1)?{ hersteller:l[0], stellen:best }:null;
}
/* Namensvorschlag: Kategorie + ★-Merkmale. Rein. */
function naNameVorschlag(kategorieLabel, diffDefs, werte){
  const teile=[]; (diffDefs||[]).forEach(d=>{ const v=werte&&werte[d.id]; if(v==null||v==='') return;
    teile.push(String(v)+(d.einheit&&!/[a-zA-Z°%"″]$/.test(String(v))?(' '+d.einheit):'')); });
  const kopf=String(kategorieLabel||'').replace(/\s*\(.*?\)\s*/g,' ').split('/')[0].trim();
  return [kopf].concat(teile).filter(Boolean).join(' · ');
}

/* ── Vorgaben der Listen (Entscheidungen 06.11.2026) ── */
const NA_LISTEN = [
  { key:'arten',            wort:'Arten (was eine Zeile ist)' },
  { key:'kategorien',       wort:'Material-Kategorien & Felder' },
  { key:'bereiche',         wort:'Bereiche (Rüstliste)' },
  { key:'hersteller',       wort:'Hersteller' },
  { key:'lagerorte',        wort:'Lagerorte' },
  { key:'gruppen',          wort:'Gruppen von Standards' },
  { key:'kennzeichen',      wort:'Kennzeichen an Standards' },
  { key:'rubriken',         wort:'Rubrik-Namen' },
  { key:'abschnitte',       wort:'Abschnitt-Namen' },
  { key:'geraetekategorien',wort:'Geräte-Kategorien' },
  { key:'darreichung',      wort:'Darreichungsformen' },
];
/* Arten: verweis = welches Verzeichnis eine Zeile dieser Art meint; haken =
   wird im Saal abgehakt. Erweiterbar über das Auswahlfeld. */
const NA_ARTEN_VORGABE = [
  { id:'material',   name:'Material',       ico:'📦', farbe:'#34c98a', verweis:'material',   haken:true },
  { id:'geraet',     name:'Gerät',          ico:'🖥', farbe:'#e8b34a', verweis:'geraet',     haken:true },
  { id:'medikament', name:'Medikament',     ico:'💊', farbe:'#bd8ce8', verweis:'medikament', haken:true },
  { id:'schritt',    name:'Arbeitsschritt', ico:'👐', farbe:'#5fb0e0', verweis:'',           haken:true },
  { id:'pruefpunkt', name:'Prüfpunkt',      ico:'☑️', farbe:'#5fd0c0', verweis:'',           haken:true },
  { id:'anordnung',  name:'Anordnung',      ico:'🩺', farbe:'#e0795f', verweis:'',           haken:true },
  { id:'hinweis',    name:'Hinweis',        ico:'ℹ️', farbe:'#7f95ab', verweis:'',           haken:false },
  { id:'personal',   name:'Personal',       ico:'👤', farbe:'#c9a24a', verweis:'',           haken:true },
  { id:'aufgabe',    name:'Aufgabe',        ico:'📝', farbe:'#d47fb0', verweis:'',           haken:true },
];
const NA_BEREICHE_VORGABE = [
  { id:'tisch',   name:'Tischvorbereitung' },
  { id:'eingriff',name:'Eingriffsvorbereitung' },
];
const NA_RUBRIKEN_VORGABE = ['Saal und Geräte','Materialien','Patient','Vorbereitung des Tisches','Ablauf der Prozedur'];

/* Ein neuer Standard: leer mit Rubrik-Gerüst, oder Kopie mit neuen Kennungen. */
function naStandardNeu(titel, gruppe, rubrikNamen){
  return { id:naId('s'), titel:String(titel||'').trim(), gruppe:gruppe||'', kennzeichen:[], angelegt:naJetzt(), geaendert:naJetzt(),
    rubriken:(rubrikNamen||[]).map(n=>({ id:naId('r'), name:n, abschnitte:[{ id:naId('a'), name:'', positionen:[] }] })) };
}
function naStandardKopie(std, titel){
  const k=JSON.parse(JSON.stringify(std)); k.id=naId('s'); k.titel=titel||(std.titel+' (Kopie)'); k.angelegt=k.geaendert=naJetzt(); k.kopieVon=std.id;
  (k.rubriken||[]).forEach(r=>{ r.id=naId('r'); (r.abschnitte||[]).forEach(a=>{ a.id=naId('a'); (a.positionen||[]).forEach(p=>{ p.id=naId('p'); }); }); });
  return k;
}
/* Felder, die sich zwischen zwei Fassungen eines Objekts unterscheiden
   (für Verlauf und Wirkungsvorschau). Rein. */
function naUnterschiede(vorher, nachher){
  const out=[]; const keys={}; Object.keys(vorher||{}).forEach(k=>keys[k]=1); Object.keys(nachher||{}).forEach(k=>keys[k]=1);
  Object.keys(keys).forEach(k=>{ if(k==='geaendert'||k==='angelegt') return;
    if(JSON.stringify((vorher||{})[k])!==JSON.stringify((nachher||{})[k])) out.push(k); });
  return out;
}
/* CSV (Semikolon, Excel-tauglich). Rein. */
function naCsv(zeilen){ return zeilen.map(z=>z.map(v=>{ const s=String(v==null?'':v); return /[;"\n]/.test(s)?('"'+s.replace(/"/g,'""')+'"'):s; }).join(';')).join('\r\n'); }

/* ── Bilder ──
   Festlegungen aus der alten App, hier als reine Logik:
     · Ein Bild ist { k, v?, rolle?, titel?, orig?, origV? } — k = Kennung im
       Medienspeicher, v = kleine Vorschau (für Listen und Standards), orig =
       die Kennung VOR dem Zuschneiden/Drehen (damit es ein Zurück gibt).
       Ältere Einträge sind bloße Kennungen; naFotos liest beides.
     · Das ANZEIGEBILD ist das Bild, das in Listen und Standards erscheint.
       Wer eines gewählt hat (★), bekommt genau das. Sonst: das erste
       Produktbild, sonst das erste Bild, das kein Etikett ist, sonst das
       erste. Ein Etikettfoto wird also nie von allein zum Gesicht des
       Materials, nur weil es zuerst aufgenommen wurde. */
const NA_FOTO_ROLLEN = [
  { id:'produkt',    name:'Produkt',    ico:'📦' },
  { id:'etikett',    name:'Etikett',    ico:'🏷' },
  { id:'verpackung', name:'Verpackung', ico:'🗃' },
  { id:'sonstiges',  name:'Sonstiges',  ico:'🖼' },
];
function naFotoRolle(id){ return NA_FOTO_ROLLEN.find(r=>r.id===id) || null; }
function naFotos(o){
  return ((o && o.fotos) || []).map(f=>(typeof f==='string') ? { k:f } : f).filter(f=>f && f.k);
}
function naHauptbild(o){
  const l = naFotos(o); if(!l.length) return null;
  const gewaehlt = o.hauptbild ? l.find(f=>f.k===o.hauptbild) : null;
  return gewaehlt || l.find(f=>f.rolle==='produkt') || l.find(f=>f.rolle!=='etikett') || l[0];
}
/* Bilder zurückschreiben: einheitliche Form, leere Angaben weg, und der
   Zeiger aufs Anzeigebild zeigt nie ins Leere. */
function naFotosSetzen(o, liste){
  o.fotos = (liste||[]).filter(f=>f && f.k).map(f=>{ const n = { k:f.k };
    ['v','rolle','titel','orig','origV'].forEach(p=>{ if(f[p]) n[p] = f[p]; }); return n; });
  if(o.hauptbild && !o.fotos.some(f=>f.k===o.hauptbild)) delete o.hauptbild;
  return o;
}
function naFotoDazu(o, bild, rolle){
  const l = naFotos(o); if(l.some(f=>f.k===bild.k)) return naFotosSetzen(o, l);
  const n = { k:bild.k }; if(bild.v) n.v = bild.v; if(rolle && naFotoRolle(rolle)) n.rolle = rolle;
  return naFotosSetzen(o, l.concat([n]));
}
/* Ein bearbeitetes Bild tritt an die Stelle des alten: Rolle, Unterschrift
   und die Wahl als Anzeigebild bleiben; das Original wird gemerkt. */
function naFotoErsetzen(o, altK, bild){
  if(bild.k===altK) return o;
  /* Das Ergebnis gibt es schon als eigenes Bild: dann fällt nur das alte weg. */
  if(naFotos(o).some(f=>f.k===bild.k)){ const warH = o.hauptbild===altK; naFotoEntfernen(o, altK); if(warH) o.hauptbild = bild.k; return o; }
  const l = naFotos(o).map(f=>{ if(f.k!==altK) return f;
    return Object.assign({}, f, { k:bild.k, v:bild.v||'', orig:f.orig||f.k, origV:f.orig ? (f.origV||'') : (f.v||'') }); });
  const warHaupt = o.hauptbild===altK;
  naFotosSetzen(o, l); if(warHaupt) o.hauptbild = bild.k;
  return o;
}
function naFotoOriginal(o, k){
  const f = naFotos(o).find(x=>x.k===k); if(!f || !f.orig || f.orig===f.k) return o;
  const l = naFotos(o).map(x=>{ if(x.k!==k) return x; const n = Object.assign({}, x, { k:x.orig, v:x.origV||'' }); delete n.orig; delete n.origV; return n; });
  const warHaupt = o.hauptbild===k;
  naFotosSetzen(o, l); if(warHaupt) o.hauptbild = f.orig;
  return o;
}
function naFotoEntfernen(o, k){ return naFotosSetzen(o, naFotos(o).filter(f=>f.k!==k)); }
function naFotoAendern(o, k, aenderung){
  return naFotosSetzen(o, naFotos(o).map(f=>f.k===k ? Object.assign({}, f, aenderung) : f));
}


/* ── Kategorie vorschlagen ──
   Die Kategorie steht nicht mehr am Anfang der Maske: Sie wird aus dem
   abgeleitet, was schon da ist. Zwei Quellen, in dieser Reihenfolge:
     1. die EINORDNUNG aus dem EU-Register (EMDN-Code): der längste passende
        Anfang gewinnt („A0703" vor „A07");
     2. die SUCHWÖRTER der Kategorien im Namen: das längste gefundene Wort
        gewinnt — „Nadelhalter" schlägt so „Nadel".
   Ein Vorschlag, keine Entscheidung: Die Maske zeigt ihn als solchen. Rein. */
function naKategorieVorschlag(kat, a){
  a=a||{}; const klassen=((kat&&kat.klassen)||[]).filter(k=>k && !k.archiviert && k.id!=='allgemein');
  const code=String(a.einordnung||'').replace(/\s/g,'').toUpperCase();
  if(code){ let best=null, len=0;
    klassen.forEach(k=>(k.emdn||[]).forEach(p=>{ p=String(p).toUpperCase(); if(p && code.indexOf(p)===0 && p.length>len){ best=k; len=p.length; } }));
    if(best) return { id:best.id, grund:'einordnung', wort:code }; }
  const text=' '+naNorm([a.name,a.handelsname,a.bezeichnung].filter(Boolean).join(' '))+' ';
  if(text.trim().length<3) return null;
  let best=null, len=0, wort='';
  klassen.forEach(k=>(k.worte||[]).forEach(w=>{ const n=naNorm(w); if(n.length<3) return;
    /* kurze Wörter nur als ganzes Wort (sonst träfe „kit" in „Kittel") */
    const trifft = n.length<5 ? text.indexOf(' '+n+' ')>=0 : text.indexOf(n)>=0;
    if(trifft && n.length>len){ best=k; len=n.length; wort=w; } }));
  return best ? { id:best.id, grund:'wort', wort } : null;
}

/* ── Hersteller: Kurzname fürs Haus aus dem amtlichen Namen ──
   „B. Braun Melsungen AG" → „B. Braun Melsungen", „MEDTRONIC, INC." →
   „Medtronic". Nur ein Vorschlag — der Kurzname ist in der Liste änderbar;
   die Identität hängt an der Registriernummer (SRN), nicht am Wort. Rein. */
function naHerstellerKurz(amtlich){
  let s=String(amtlich==null?'':amtlich).replace(/\s+/g,' ').trim();
  const form=/[,.]?\s+(gmbh\s*&\s*co\.?\s*kg|gmbh|ag|se|kg|inc\.?|incorporated|corp\.?|corporation|ltd\.?|limited|llc|s\.?a\.?s?\.?|s\.?r\.?l\.?|s\.?p\.?a\.?|b\.?v\.?|n\.?v\.?|co\.?|plc|pty|oy|ab|a\/s|k\.?k\.?)$/i;
  for(let i=0;i<3;i++){ const t=s.replace(form,'').replace(/[,.\s]+$/,'').trim(); if(t===s||!t) break; s=t; }
  if(s.length>4 && s===s.toUpperCase() && /[A-ZÄÖÜ]/.test(s))
    s=s.toLowerCase().replace(/(^|[\s\-.&\/])([a-zäöü])/g,(m,a,b)=>a+b.toUpperCase());
  return s;
}

/* ── Hersteller im Etikett-Text finden ──
   Gemessen an zehn echten Etiketten (11.11.2026): Der Herstellername stand in
   8 von 10 gelesenen Texten, gewählt wurde er nur 4-mal — zweimal gewann der
   Lohnfertiger („Manufacturing Site: … Erwin Busch GmbH") statt B. Braun.
   Deshalb:
     1. Zeilen über Fertigungsort, Vertrieb, Import und EU-Bevollmächtigte
        zählen nicht.
     2. Ein Name aus der Herstellerliste des Hauses (Kurzname, amtlicher Name)
        schlägt alles — der längste Treffer gewinnt.
     3. Sonst: ein Firmenname mit Rechtsform (AG, GmbH, Ltd. …); gewählt wird
        der, dessen Kernwort im ganzen Text am häufigsten vorkommt (Logo,
        Anschrift, Internetadresse).
   Liefert { id, name, quelle:'liste' } · { name, quelle:'text' } · null. Rein. */
const NA_HERST_NICHT=/(manufactur\w*\s*s[il]te|herstellungsort|fertigungsort|fabricado|distribu|vertrieb|vertreiber|importad|importer|importeur|authori[sz]ed\s+rep|bevollm|ec\s*rep|reg\.?\s*san|invima|registro|made\s+in|hergestellt\s+in)/i;
const NA_HERST_ALLGEMEIN={ medical:1, medizin:1, medizintechnik:1, gmbh:1, group:1, europe:1, international:1, corporation:1, company:1, limited:1, industries:1, deutschland:1, germany:1, healthcare:1, scientific:0 };
function naHerstellerImText(text, eintraege){
  const zeilen=String(text||'').split(/\n/);
  /* auch die Folgezeile eines „Manufacturing Site:"-Satzes gehört dazu, wenn sie dessen Firma fortsetzt */
  const gilt=zeilen.map((z,i)=>!NA_HERST_NICHT.test(z) && !(i>0 && NA_HERST_NICHT.test(zeilen[i-1]) && !/\b(ag|gmbh|ltd|inc|b\.?v|s\.?a|llc|corp)\b\.?\s*,?\s*$/i.test(zeilen[i-1])));
  const t=' '+naNorm(zeilen.filter((z,i)=>gilt[i]).join(' \n '))+' ';
  const ganz=' '+naNorm(text)+' ';
  let best=null, wert=0;
  (eintraege||[]).forEach(e=>{ if(!e||e.archiviert) return;
    [e.name, e.amtlich, e.amtlich ? naHerstellerKurz(e.amtlich) : ''].forEach(n=>{ const nn=naNorm(n);
      if(nn.replace(/[^a-z]/g,'').length<4) return;
      if(t.indexOf(' '+nn+' ')>=0 && nn.length>wert){ best=e; wert=nn.length; } });
    /* Kernwort (≥ 5 Buchstaben, nicht allgemein) als ganzes Wort — schwächer als der ganze Name */
    [e.name, e.amtlich].forEach(n=>naNorm(n).split(' ').forEach(w=>{ if(w.length<5 || NA_HERST_ALLGEMEIN[w]) return;
      if(t.indexOf(' '+w+' ')>=0 && w.length/2>wert){ best=e; wert=w.length/2; } })); });
  if(best) return { id:best.id, name:best.name, quelle:'liste' };
  const form=/([A-Z0-9][A-Za-z0-9&.'\- ]{1,40}?)[ ,]+(AG|GmbH|Inc\.?|Ltd\.?|LTD\.?|B\.\s?V\.?|BV|S\.\s?A\.?|SAS|S\.p\.A\.?|Corp\.?|Corporation|LLC|SE|KG|Sdn\.?\s*Bhd\.?|CO\.,?\s*LTD\.?)(?![A-Za-z])/;
  const kand={};
  zeilen.forEach((z,i)=>{ if(!gilt[i]) return; const m=z.match(form); if(!m) return;
    let n=(m[1]+' '+m[2]).replace(/^(?:[a-z]{1,3}\s+|[^A-Za-z0-9]+)+/,'').replace(/\s+/g,' ').replace(/[,.]+\s*(?=(?:AG|GmbH|Inc|Ltd|LTD)\b)/,' ').trim();
    if(n.replace(/[^A-Za-z]/g,'').length<4) return;
    const kern=naNorm(n).split(' ').filter(w=>w.length>=4 && !NA_HERST_ALLGEMEIN[w] && !/^(gmbh|corp|inc|ltd)$/.test(w)).sort((a,b)=>b.length-a.length)[0];
    if(!kern) return;
    const zahl=ganz.split(kern).length-1;
    if(!kand[n] || kand[n]<zahl) kand[n]=zahl; });
  const l=Object.keys(kand).sort((a,b)=>kand[b]-kand[a] || a.length-b.length);
  return l.length ? { name:l[0], quelle:'text' } : null;
}

/* ── PZN (Pharmazentralnummer): 7- oder 8-stellig, Prüfziffer Modulo 11 ── */
function naPznOk(p){
  const s=String(p==null?'':p).replace(/^pzn[\s:\-]*/i,'').replace(/\s/g,'');
  if(!/^\d{7,8}$/.test(s)) return false;
  const z=s.split('').map(Number); const pz=z.pop();
  const start=z.length===7?1:2; let summe=0; z.forEach((d,i)=>{ summe+=d*(i+start); });
  const r=summe%11; return r!==10 && r===pz;
}

/* ── Registertreffer in den Entwurf übernehmen ──
   Füllt NUR leere Felder (der Mensch schlägt alles, Grundsatz ③) und merkt
   Quelle und Zeitpunkt (Grundsatz A5). Der Hersteller wird außerhalb
   zugeordnet — er braucht die Herstellerliste. Liefert die Namen der
   gefüllten Felder. Rein. */
function naRegisterAnwenden(o, t){
  const neu=[]; if(!o||!t) return neu;
  if(t.handelsname && !o.handelsname){ o.handelsname=t.handelsname; neu.push('Handelsname'); }
  if(t.ref && !o.ref){ o.ref=t.ref; neu.push('REF'); }
  o.merkmale=o.merkmale||{};
  const setze=(id,wert,wort)=>{ if(wert==null) return; if(o.merkmale[id]==null||o.merkmale[id]===''){ o.merkmale[id]=wert; neu.push(wort); } };
  if(t.steril===true) setze('steril','steril','steril'); else if(t.steril===false) setze('steril','unsteril','unsteril');
  if(t.latex===true) setze('latex','enthält Naturlatex','Latex'); else if(t.latex===false) setze('latex','latexfrei','latexfrei');
  if(t.mehrweg===false) setze('einmalgebrauch',true,'Einmalprodukt');
  o.register={ quelle:t.quelle||'', abgerufen:t.abgerufen||'', einordnung:t.einordnung||'', basisUdi:t.basisUdi||'',
    hersteller:(t.hersteller&&t.hersteller.name)||'', srn:(t.hersteller&&t.hersteller.srn)||'', bezeichnung:t.bezeichnung||'' };
  return neu;
}

/* ── Verknüpfungen zwischen Materialien (Entscheidung E2) ──
   Drei Arten, jede mit Hin- und Gegenrichtung. Gespeichert wird NUR die
   Hinrichtung, am einen Material; die Gegenrichtung wird gelesen, nie
   gespeichert — so können die zwei Seiten nicht auseinanderlaufen.
     ersatz        „stattdessen geht auch" — mit Sorte und Grund
     zubehoer      „braucht dazu"
     aufbereitung  „ist die aufbereitete Fassung von"
   Die vier Sorten von Ersatz hat der Betreiber wörtlich vorgegeben. Sie
   beantworten im Saal: Darf ich einfach greifen, oder muss ich fragen?
   Am Material: o.verknuepfungen = [ { art, ziel, sorte?, grund? } ] */
const NA_VERKN_ARTEN = [
  { id:'ersatz',       ico:'🔁', name:'Ersatz',       hin:'Stattdessen geht auch',      gegen:'Ist Ersatz für' },
  { id:'zubehoer',     ico:'🧩', name:'Zubehör',      hin:'Braucht dazu',               gegen:'Wird gebraucht von' },
  { id:'aufbereitung', ico:'♻️', name:'Aufbereitung', hin:'Aufbereitete Fassung von',   gegen:'Gibt es auch aufbereitet' },
];
const NA_ERSATZ_SORTEN = [
  { id:'gleich',  ico:'🟰', name:'äquivalent',        sub:'eins zu eins nutzbar' },
  { id:'teuer',   ico:'💶', name:'teures Äquivalent', sub:'eins zu eins — aber deutlich teurer, bitte absprechen' },
  { id:'bedingt', ico:'≈',  name:'Alternative',       sub:'nicht gleich — nur unter Bedingungen oder mit Einschränkungen' },
  { id:'reserve', ico:'🧰', name:'Back-Up (Reserve)', sub:'nutzbar, aber nicht optimal' },
];
function naVerknArt(id){ return NA_VERKN_ARTEN.find(a=>a.id===id) || null; }
function naErsatzSorte(id){ return NA_ERSATZ_SORTEN.find(a=>a.id===id) || null; }
/* Bereinigt: nur bekannte Arten, nie auf sich selbst, keine Dubletten. */
function naVerknNormal(liste, eigeneId){
  const aus=[], gesehen={};
  (Array.isArray(liste)?liste:[]).forEach(v=>{
    if(!v || !naVerknArt(v.art) || !v.ziel || v.ziel===eigeneId) return;
    const k=v.art+'|'+v.ziel; if(gesehen[k]) return; gesehen[k]=1;
    const n={ art:v.art, ziel:String(v.ziel) };
    if(v.art==='ersatz' && naErsatzSorte(v.sorte)) n.sorte=v.sorte;
    const g=String(v.grund||'').trim().slice(0,160); if(g) n.grund=g;
    aus.push(n); });
  return aus;
}
/* Beide Richtungen eines Materials. alle: [Material]. Ziele, die es nicht
   (mehr) gibt, fallen heraus. { raus:[{art,sorte,grund,o}], rein:[…] }. Rein. */
function naVerknVon(alle, id){
  const nach={}; (alle||[]).forEach(m=>{ if(m&&m.id) nach[m.id]=m; });
  const ich=nach[id];
  const raus=naVerknNormal(ich&&ich.verknuepfungen, id).filter(v=>nach[v.ziel]).map(v=>Object.assign({}, v, { o:nach[v.ziel] }));
  const rein=[];
  (alle||[]).forEach(m=>{ if(!m||m.id===id) return;
    naVerknNormal(m.verknuepfungen, m.id).forEach(v=>{ if(v.ziel===id) rein.push(Object.assign({}, v, { o:m })); }); });
  return { raus, rein };
}
/* Zubehör, das in einer Liste noch fehlt (für den Hinweis im Standard). Rein. */
function naZubehoerFehlt(alle, id, vorhandeneIds){
  const da={}; (vorhandeneIds||[]).forEach(x=>{ da[x]=1; });
  return naVerknVon(alle, id).raus.filter(v=>v.art==='zubehoer' && !da[v.ziel]).map(v=>v.ziel);
}
/* Beim Zusammenführen zweier Dubletten: Verknüpfungen zeigen auf den
   Verbleibenden. Verändert o, liefert true bei Änderung. Rein. */
function naVerknUmhaengen(o, von, nach){
  const alt=JSON.stringify(o.verknuepfungen||[]);
  const neu=naVerknNormal((o.verknuepfungen||[]).map(v=>v&&v.ziel===von?Object.assign({},v,{ziel:nach}):v), o.id);
  if(JSON.stringify(neu)===alt) return false;
  if(neu.length) o.verknuepfungen=neu; else delete o.verknuepfungen;
  return true;
}

/* ── Was einem Material noch fehlt ──
   KERN-Angaben machen ein Material „vollständig" (Filter im Verzeichnis).
   Der Rest ist Kür und wird in der Maske nur gezählt. Rein. */
function naAngaben(o, kat){
  o=o||{}; const m=o.merkmale||{};
  const f=o.kategorie ? naFelder(kat, o.kategorie) : { diff:[] };
  const voll=v=>!(v==null||v===''||(Array.isArray(v)&&!v.length));
  return [
    { id:'hersteller', wort:'Hersteller',      kern:true,  da:voll(o.hersteller) },
    { id:'nummer',     wort:'GTIN oder REF',   kern:true,  da:voll(o.gtin)||voll(o.ref) },
    { id:'lagerort',   wort:'Lagerort',        kern:true,  da:voll(o.lagerort) },
    { id:'bild',       wort:'Produktbild',     kern:true,  da:naFotos(o).some(x=>x.rolle!=='etikett') },
    { id:'kategorie',  wort:'Kategorie',       kern:true,  da:voll(o.kategorie) },
    { id:'merkmale',   wort:'★-Merkmale',      kern:false, da:f.diff.length>0 && f.diff.every(d=>voll(m[d.id])) },
    { id:'steril',     wort:'Steril-Angabe',   kern:false, da:voll(m.steril) },
    { id:'handelsname',wort:'Handelsname',     kern:false, da:voll(o.handelsname) },
    { id:'verwendung', wort:'Verwendung',      kern:false, da:voll(o.verwendung) },
    { id:'suchwoerter',wort:'Suchwörter',      kern:false, da:voll(o.suchwoerter) },
    { id:'packung',    wort:'Packungsgröße',   kern:false, da:voll(o.packung) },
    { id:'verknuepft', wort:'Verknüpfungen',   kern:false, da:voll(o.verknuepfungen) },
  ];
}
function naFehlt(o, kat){ return naAngaben(o, kat).filter(a=>a.kern && !a.da).map(a=>a.wort); }

/* Eine neue Größe desselben Produkts: alles übernehmen, was die Familie
   teilt — nicht das, was nur dieses eine Stück kennzeichnet. Rein. */
function naVariante(o){
  const k=JSON.parse(JSON.stringify(o||{}));
  k.id=naId('m'); ['gtin','ref','pzn','fotos','hauptbild','register','verknuepfungen','angelegt','angelegtAuf','geaendert','archiviert'].forEach(f=>{ delete k[f]; });
  k.gtin=''; k.ref=''; k.fotos=[]; k.varianteVon=o.id;
  return k;
}
