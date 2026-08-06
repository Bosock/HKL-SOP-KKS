/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — DER PFLEGE-WEG (ein Material nach dem anderen)

   Die Werkzeuge waren alle da: der Aufräum-Assistent entmischt den Satz aus
   der Word-Vorlage, der Material-Editor nimmt Hersteller, REF, Maße und Preis
   auf, die geführte Erfassung liest das Etikett, die Galerie hält das Foto,
   die Dublettenliste räumt Schreibweisen zusammen. Sie lagen nur an vier
   Orten, und keiner davon wusste vom anderen: Wer eine Zeile aufgeräumt
   hatte, stand danach wieder in der Warteschlange des Assistenten — und das
   Foto zu genau diesem Material fehlte weiterhin, ohne dass es jemand sagte.

   Der Betreiber dazu: „Ich möchte systematisch durch alle Materialien gehen,
   während ich die App benutze … das Für und Oder wegmachen und nur das reine
   Material dastehen haben. Und gleichzeitig die Felder richtig befüllen und
   Etiketten scannen, ein Bild vom Produkt machen. Das muss alles kohärent,
   reibungslos ineinandergreifen."

   Dieser Baustein ist die Klammer. Er baut kein einziges Werkzeug neu — er
   führt sie in einer Abfolge vor, Material für Material, und bringt jedes
   zurück an die Stelle, an der man war.

   ── Drei Entscheidungen prägen den Weg ──

   ① DIE EINHEIT IST DAS MATERIAL, nicht die Zeile und nicht der Text.
      „Radialschleuse 6F" steht 11× im Bestand, hinter drei verschiedenen
      Sätzen aus der Vorlage. Das ist EIN Material, das EINMAL gepflegt wird.
      Der kanonische Schlüssel (features/matkey.js) leistet genau das; der
      Pflege-Weg gruppiert danach. Der Aufräum-Assistent arbeitet weiterhin
      an TEXTEN — er ist deshalb der erste Schritt eines Materials und nicht
      ein eigener Weg daneben.

   ② WAS ERLEDIGT IST, WIRD ABGELESEN, NICHT ABGEHAKT.
      Ob ein Foto da ist, weiß der Stammsatz. Ein zweiter, von Hand gepflegter
      Haken daneben würde irgendwann etwas anderes behaupten als die Daten
      (Grundsatz ⑨). Gespeichert wird nur, was sich NICHT ablesen lässt: die
      Entscheidung eines Menschen, dass ein Schritt für dieses Material
      entfällt („diese Kompresse hat keine REF"), und die Häkchen eigener
      Schritte, die es im Datenmodell gar nicht gibt.

   ③ DIE SCHRITTE SIND EINE LISTE, KEIN ABLAUF IM QUELLTEXT.
      Jeder Schritt lässt sich umbenennen, verschieben, ausblenden — und man
      kann eigene hinzufügen („im Lagersystem angelegt"). Der Code kennt nur
      die PRÜFUNG hinter einem Schritt; das Wort, die Reihenfolge und das
      Ob kommen aus der Einstellung (Grundsatz ⑤ / A7). Dieselbe Bauart wie
      der Standardkopf (features/stdkopf.js) und das Funktionsregister.

   Nicht-destruktiv: Dieser Baustein schreibt selbst nichts an Standards oder
   Stammsätzen. Er öffnet die vorhandenen Werkzeuge; die schreiben wie bisher.
   ───────────────────────────────────────────────────────────── */

/* ═══════════ 1. Die Schritte ═══════════ */

/* Jeder Schritt trägt:
     offen(m)  → ist an diesem Material noch etwas zu tun?
     tun(m)    → welches vorhandene Werkzeug wird geöffnet?
     stand(m)  → eine kurze, ehrliche Auskunft für die Zeile
   `art:'hand'` heißt: es gibt keine Daten, an denen man es ablesen könnte —
   dann zählt allein das Häkchen des Menschen. */
const PF_SCHRITTE = [
  { key:'text', ico:'🧹', wort:'Text aufräumen',
    sub:'Produkt vom Satz trennen — „für", „oder", Menge und Zweck heraus',
    offen:(m)=> pfZerlegungBereit() && m.texteOffen.length>0,
    stand:(m)=> !pfZerlegungBereit() ? 'Zerlegungs-Regeln fehlen'
      : (m.texteOffen.length ? (m.texteOffen.length+' Text'+(m.texteOffen.length===1?'':'e')+' warten') : 'entmischt'),
    tun:(m)=> pfZumAufraeumen(m) },

  { key:'name', ico:'🔤', wort:'Produktname',
    sub:'wie das Produkt wirklich heißt — ohne Größe, ohne Zweck',
    offen:(m)=> !(m.rec && m.rec.name),
    stand:(m)=> (m.rec && m.rec.name) ? m.rec.name : 'noch kein Stammsatz',
    tun:(m)=> pfZumMaterial(m,'scName') },

  { key:'etikett', ico:'🏷️', wort:'Etikett: Hersteller & REF',
    sub:'einmal scannen — danach ist es bei jedem weiteren Scan sofort da',
    offen:(m)=> !(m.rec && m.rec.hersteller) || !(m.rec && m.rec.ref),
    stand:(m)=> m.rec ? [m.rec.hersteller, m.rec.ref?('REF '+m.rec.ref):''].filter(Boolean).join(' · ') || 'nichts erfasst' : 'nichts erfasst',
    tun:(m)=> pfZumMaterial(m,'scHersteller') },

  { key:'foto', ico:'📷', wort:'Produktfoto',
    sub:'Verpackung, ausgepacktes Produkt, Regalplatz — beliebig viele',
    offen:(m)=> !pfHatFoto(m.rec),
    stand:(m)=>{ const n=pfFotoZahl(m.rec); return n ? (n+' Foto'+(n===1?'':'s')) : 'kein Bild'; },
    tun:(m)=> pfZumMaterial(m,'scGallery') },

  { key:'kategorie', ico:'🗃️', wort:'Kategorie',
    sub:'z. B. Schleuse / Introducer — ordnet das Material im Bestand ein',
    offen:(m)=> !(m.rec && m.rec.kategorie),
    stand:(m)=> (m.rec && m.rec.kategorie) || 'ohne',
    tun:(m)=> pfZumMaterial(m,'scKat') },

  { key:'lagerort', ico:'📍', wort:'Lagerort',
    sub:'wo es im Haus steht — die häufigste Frage im Saal',
    offen:(m)=> !(m.rec && m.rec.lagerort),
    stand:(m)=> (m.rec && m.rec.lagerort) || 'unbekannt',
    tun:(m)=> pfZumMaterial(m,'scLoc') },

  { key:'bereich', ico:'🧭', wort:'Bereich',
    sub:'steriler Tisch oder Umfeld — die zweite Sicht aufs Material',
    /* Sind noch gar keine Bereiche angelegt, gibt es hier nichts zu
       entscheiden. Der Schritt erscheint dann nicht (Grundsatz ①: eine leere
       Frage ist schlimmer als keine). */
    offen:(m)=> pfBereicheDa() && !pfBereichVon(m),
    stand:(m)=>{ const b=pfBereichVon(m); return b ? (b.symbol+' '+b.wort) : (pfBereicheDa()?'nicht zugeordnet':'keine Bereiche angelegt'); },
    tun:(m)=> pfZumBereich(m) },

  { key:'preis', ico:'💶', wort:'Stückpreis',
    sub:'Grundlage der Plankosten je Standard',
    offen:(m)=> !(m.rec && m.rec.preis!=null && m.rec.preis!==''),
    stand:(m)=> (m.rec && m.rec.preis!=null && m.rec.preis!=='')
      ? ((typeof fmtEUR==='function')?fmtEUR(m.rec.preis):String(m.rec.preis)) : 'ohne Preis',
    tun:(m)=> pfZumMaterial(m,'scPreis') },
];

function pfZerlegungBereit(){ return typeof matKeyBereit==='function' && matKeyBereit(); }
function pfHatFoto(rec){ return !!(rec && (rec.photo || (Array.isArray(rec.fotos) && rec.fotos.length))); }
function pfFotoZahl(rec){
  if(!rec) return 0;
  if(Array.isArray(rec.fotos) && rec.fotos.length) return rec.fotos.length;
  return rec.photo ? 1 : 0;
}
function pfBereicheDa(){ return typeof berListe==='function' && berListe().length>0; }
/* Der Bereich hängt am Eintrag (mit Kaskade). Für das Material zählt: ist er
   irgendwo gesetzt? Sonst müsste man 11 Zeilen einzeln nachsehen. */
function pfBereichVon(m){
  if(typeof berVon!=='function') return null;
  for(let i=0;i<m.stellen.length;i++){
    const b = berVon(m.stellen[i].e, m.stellen[i].cid);
    if(b) return b;
  }
  return null;
}

/* ═══════════ 2. Die Einstellung ═══════════ */

let PFL = (typeof loadJSON==='function') ? loadJSON('hkl_pflegeschritte', {}) : {};
if(!PFL || typeof PFL!=='object') PFL = {};
/* Eigene Schritte: reine Handhaken, die es im Datenmodell nicht gibt. */
let PFLEIGEN = (typeof loadJSON==='function') ? loadJSON('hkl_pflegeeigen', []) : [];
if(!Array.isArray(PFLEIGEN)) PFLEIGEN = [];
/* Was ein Mensch entschieden hat: „entfällt" je Material und Schritt, die
   Haken eigener Schritte, und „von Hand abgeschlossen". */
let PFSTAND = (typeof loadJSON==='function') ? loadJSON('hkl_pflegestand', {}) : {};
if(!PFSTAND || typeof PFSTAND!=='object') PFSTAND = {};

function savePfl(){ if(typeof saveJSON==='function') saveJSON('hkl_pflegeschritte', PFL); }
function savePflEigen(){ if(typeof saveJSON==='function') saveJSON('hkl_pflegeeigen', PFLEIGEN); }
function savePfStand(){ if(typeof saveJSON==='function') saveJSON('hkl_pflegestand', PFSTAND); }

function pflWert(key, feld, vorgabe){
  const k = PFL[key];
  if(k && k[feld]!==undefined && k[feld]!==null && k[feld]!=='') return k[feld];
  return vorgabe;
}
function pflAus(key){ return !!(PFL[key] && PFL[key].aus); }
function pflSetzen(key, feld, wert){
  const leer = (wert===null || wert===undefined || wert==='' || wert===false);
  if(leer){ if(PFL[key]){ delete PFL[key][feld]; if(!Object.keys(PFL[key]).length) delete PFL[key]; } }
  else { (PFL[key]=PFL[key]||{})[feld]=wert; }
  savePfl();
}
function pflZuruecksetzen(){ PFL = {}; savePfl(); }
function pflGeaendert(){ return Object.keys(PFL||{}).length>0 || PFLEIGEN.length>0; }

/* Ein eigener Schritt ist ein Handhaken. Der Schlüssel entsteht einmal aus dem
   Wort und bleibt danach unverändert — sonst verlöre ein Tippfehler-Korrektur
   sämtliche gesetzten Haken. */
function pflEigenSchluessel(wort){
  const s = String(wort||'').toLowerCase()
    .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  return s ? ('eigen-'+s) : '';
}
function pflEigenAnlegen(wort, sub, ico){
  const w = String(wort||'').trim(); if(!w) return null;
  let key = pflEigenSchluessel(w); if(!key) return null;
  let n = 2; while(PFLEIGEN.some(x=>x.key===key) || PF_SCHRITTE.some(x=>x.key===key)){ key = pflEigenSchluessel(w)+'-'+(n++); }
  const s = { key, wort:w, sub:String(sub||'').trim(), ico:String(ico||'').trim()||'✓' };
  PFLEIGEN.push(s); savePflEigen();
  return s;
}
function pflEigenLoeschen(key){
  const i = PFLEIGEN.findIndex(x=>x.key===key); if(i<0) return false;
  PFLEIGEN.splice(i,1); savePflEigen();
  return true;
}

/* Die geltende Schrittliste: eingebaute + eigene, in der eingestellten
   Reihenfolge, ohne die ausgeblendeten. */
function pflAlleSchritte(){
  const eingebaut = PF_SCHRITTE.map(s=>({ key:s.key, art:'auto', ico:s.ico, wort:s.wort, sub:s.sub,
    offen:s.offen, stand:s.stand, tun:s.tun }));
  const eigen = PFLEIGEN.map(s=>({ key:s.key, art:'hand', ico:s.ico||'✓', wort:s.wort, sub:s.sub||'',
    offen:()=>true, stand:()=>'von Hand', tun:null, eigen:true }));
  return eingebaut.concat(eigen);
}
function pflListe(){
  return pflAlleSchritte()
    .map((s,i)=>({ s, ord:Number(pflWert(s.key,'ord', i)) }))
    .filter(x=> !pflAus(x.s.key))
    .sort((a,b)=> a.ord - b.ord)
    .map(x=> Object.assign({}, x.s, {
      ico:  pflWert(x.s.key,'ico',  x.s.ico),
      wort: pflWert(x.s.key,'wort', x.s.wort),
      sub:  pflWert(x.s.key,'sub',  x.s.sub) }));
}

/* ── Stand je Material ── */
function pfStandVon(key){ return (key && PFSTAND[key]) || {}; }
function pfEntfaellt(key, schritt){ const st=pfStandVon(key); return !!(st.entfaellt && st.entfaellt[schritt]); }
function pfHandHaken(key, schritt){ const st=pfStandVon(key); return !!(st.hand && st.hand[schritt]); }
function pfFertigVon(key){ return pfStandVon(key).fertig || null; }

function pfStandSetzen(key, feld, schritt, wert){
  if(!key) return;
  const st = PFSTAND[key] = PFSTAND[key] || {};
  if(schritt===null){
    if(wert) st[feld] = wert; else delete st[feld];
  } else {
    const f = st[feld] = st[feld] || {};
    if(wert) f[schritt] = wert; else delete f[schritt];
    if(!Object.keys(f).length) delete st[feld];
  }
  if(!Object.keys(st).length) delete PFSTAND[key];
  savePfStand();
}
function pfEntfaelltSchalten(key, schritt){
  pfStandSetzen(key,'entfaellt',schritt, pfEntfaellt(key,schritt) ? null : new Date().toISOString());
}
function pfHandSchalten(key, schritt){
  pfStandSetzen(key,'hand',schritt, pfHandHaken(key,schritt) ? null : new Date().toISOString());
}
function pfFertigSchalten(key){
  pfStandSetzen(key,'fertig',null, pfFertigVon(key) ? null : new Date().toISOString());
}

/* Der Zustand EINES Schrittes an EINEM Material. Eine von vier Antworten —
   mehr braucht die Zeile nicht, und weniger wäre unehrlich. */
function pfSchrittZustand(m, s){
  if(pfEntfaellt(m.key, s.key)) return 'entfaellt';
  if(s.art==='hand') return pfHandHaken(m.key, s.key) ? 'fertig' : 'offen';
  let offen = false;
  try{ offen = !!s.offen(m); }catch(e){ offen = false; }
  return offen ? 'offen' : 'fertig';
}
/* Die offenen Schritte eines Materials. */
function pfLuecken(m){ return pflListe().filter(s=>pfSchrittZustand(m,s)==='offen'); }
/* Ist das Material durch? Entweder alles erledigt/entfallen — oder ein Mensch
   hat es abgeschlossen (etwa weil es das Produkt gar nicht mehr gibt). */
function pfIstFertig(m){ return !!pfFertigVon(m.key) || pfLuecken(m).length===0; }

/* ═══════════ 3. Der Bestand ═══════════ */

let pfCache = null;
function pfCacheLeeren(){ pfCache = null; }

/* Alle Materialien des Bestandes, gruppiert nach dem KANONISCHEN Schlüssel.
   Ausgeblendete Zeilen und Tätigkeiten fallen heraus — an ihnen ist nichts zu
   pflegen. */
function pfMaterialien(){
  if(pfCache) return pfCache;
  const map = new Map();
  if(typeof DB!=='undefined' && DB && DB.standards && typeof cidOf==='function'){
    DB.standards.forEach(s=>{
      if(typeof stdHidden==='function' && stdHidden(s)) return;
      (s.rubriken||[]).forEach((r,ri)=>{
        if(r.typ!=='material' && r.typ!=='geraete') return;
        (r.sub_bereiche||[]).forEach((sb,si)=>{ (sb.eintraege||[]).forEach((e,ei)=>{
          if(!e || e.natur==='ueberschrift' || e.ist_fliesstext) return;
          const cid = cidOf(s.id,ri,si,ei);
          if(typeof qeGet==='function' && qeGet(e,cid,'hidden')===true) return;
          const k = (typeof effMatKey==='function') ? effMatKey(e,cid) : (e.material_key||null);
          if(!k) return;
          let t = map.get(k);
          if(!t){ t = { key:k, namen:new Map(), roh:[], texteOffen:[], stellen:[], stds:new Set() }; map.set(k,t); }
          t.stellen.push({ cid, e, sid:s.id });
          t.stds.add(s.id);
          const nm = (typeof qeGet==='function' && qeGet(e,cid,'name')!==undefined) ? qeGet(e,cid,'name') : (e.anzeige_text||'');
          if(nm) t.namen.set(nm, (t.namen.get(nm)||0)+1);
          const roh = (e.roh_text || e.anzeige_text || '').trim();
          if(roh && t.roh.indexOf(roh)<0 && t.roh.length<6) t.roh.push(roh);
          /* Offene Texte: der Aufräum-Assistent entscheidet je TEXT. Offen ist
             ein Text, für den weder die Stelle noch der Text selbst bestätigt
             wurde. */
          if(typeof zerlTextKey==='function'){
            const tk = zerlTextKey(e);
            if(tk && typeof ZERLDB!=='undefined' && !ZERLDB[tk] && !ZERLDB[cid] && t.texteOffen.indexOf(tk)<0) t.texteOffen.push(tk);
          }
        }); });
      });
    });
  }
  pfCache = [...map.values()].map(t=>{
    const rec = (typeof canonOf==='function') ? canonOf(t.key) : null;
    /* Der Name: was der Stammsatz sagt, sonst der häufigste Anzeigename. */
    let haeufigster = '', best = -1;
    t.namen.forEach((n,nm)=>{ if(n>best){ best=n; haeufigster=nm; } });
    return { key:t.key, name:(rec&&rec.name)||haeufigster||t.key, rec,
      roh:t.roh, texteOffen:t.texteOffen, stellen:t.stellen,
      vorkommen:t.stellen.length, standards:[...t.stds] };
  });
  return pfCache;
}

/* Der Ausschnitt, an dem gerade gearbeitet wird. */
function pfImUmfang(umfang){
  const alle = pfMaterialien();
  if(!umfang || umfang.art==='alle') return alle;
  if(umfang.art==='standard') return alle.filter(m=>m.standards.indexOf(umfang.wert)>=0);
  return alle;
}
/* Die Arbeitsliste. „Wichtiges zuerst" heißt hier: was am häufigsten
   vorkommt, wirkt am meisten — dieselbe Lesart wie im Aufräum-Assistenten. */
function pfListe(umfang, nurOffene, sortierung){
  let liste = pfImUmfang(umfang).slice();
  if(nurOffene) liste = liste.filter(m=>!pfIstFertig(m));
  if(sortierung==='name') liste.sort((a,b)=>(a.name||'').localeCompare(b.name||'','de'));
  else liste.sort((a,b)=> (b.vorkommen-a.vorkommen) || (a.name||'').localeCompare(b.name||'','de'));
  return liste;
}
/* Kennzahlen für die Fortschrittsanzeige — über den UMFANG, nicht über alles:
   Wer einen Standard durcharbeitet, will dessen Fortschritt sehen. */
function pfStats(umfang){
  const liste = pfImUmfang(umfang);
  let fertig = 0, schritteOffen = 0;
  liste.forEach(m=>{ const l = pfLuecken(m); if(!l.length || pfFertigVon(m.key)) fertig++; schritteOffen += l.length; });
  return { gesamt:liste.length, fertig, offen:liste.length-fertig, schritteOffen };
}

/* ═══════════ 4. Der Weg ═══════════ */

/* Läuft gerade ein Pflege-Weg? Der Rückweg der Werkzeuge fragt danach. */
let pfAktiv = null;        /* {umfang, key} */
let pfSort = (typeof store==='object'&&store&&store.get) ? (store.get('hkl_pflege_sort')||'wirkung') : 'wirkung';
let pfNurOffene = !((typeof store==='object'&&store&&store.get) && store.get('hkl_pflege_alle')==='1');

function pflegeLaeuft(){ return !!pfAktiv; }

/* Einstieg. `opt.umfang` grenzt ein (ganzer Bestand oder ein Standard),
   `opt.key` springt direkt zu einem bestimmten Material — das ist der Weg
   „⋯ → Pflege-Weg ab hier" mitten im Standard. */
function openPflege(opt){
  if(typeof ADMIN!=='undefined' && !ADMIN){
    if(typeof promptLoginThen==='function'){ promptLoginThen(()=>openPflege(opt)); return; }
  }
  const o = opt || {};
  pfCacheLeeren();
  pfAktiv = { umfang: o.umfang || (pfAktiv&&pfAktiv.umfang) || {art:'alle'}, key: o.key || null };
  /* Direkt angesprungenes Material: es muss sichtbar sein, auch wenn es
     bereits fertig ist — sonst landet man wortlos woanders. */
  if(o.key && pfIstFertigKey(o.key)) pfSetzeNurOffene(false);
  if(!pfAktiv.key){
    const liste = pfListe(pfAktiv.umfang, pfNurOffene, pfSort);
    pfAktiv.key = liste.length ? liste[0].key : null;
  }
  renderPflege();
  show('scr-pflege');
  pfBarSetzen();
}
function pfIstFertigKey(key){ const m = pfMaterialien().find(x=>x.key===key); return m ? pfIstFertig(m) : false; }
function pfBarSetzen(){
  if(typeof setBar!=='function') return;
  setBar('Pflege-Weg', pfUmfangWort(pfAktiv&&pfAktiv.umfang), true);
}
function pfUmfangWort(umfang){
  if(!umfang || umfang.art==='alle') return 'alle Materialien';
  if(umfang.art==='standard'){
    const s = (typeof DB!=='undefined'&&DB) ? DB.standards.find(x=>x.id===umfang.wert) : null;
    return s ? (typeof stdTitel==='function'?stdTitel(s):s.titel) : 'ein Standard';
  }
  return 'alle Materialien';
}
function pfSetzeNurOffene(v){
  pfNurOffene = !!v;
  if(typeof store==='object'&&store&&store.set) store.set('hkl_pflege_alle', v?'':'1');
}

/* Zurück in den Weg — von jedem Werkzeug aus. Gibt true zurück, wenn der Weg
   läuft und die Rückkehr übernommen wurde. */
function pflegeRueckkehr(){
  if(!pfAktiv) return false;
  pfCacheLeeren();
  renderPflege();
  show('scr-pflege');
  pfBarSetzen();
  return true;
}
/* Den Weg verlassen: dorthin, wo er begonnen hat. */
function pflegeVerlassen(){
  const u = pfAktiv && pfAktiv.umfang;
  pfAktiv = null;
  if(u && u.art==='standard' && typeof openStandard==='function' && typeof DB!=='undefined' && DB.standards.some(s=>s.id===u.wert)){
    openStandard(u.wert, true); return;
  }
  if(typeof renderMatCenter==='function'){
    if(typeof mode!=='undefined') mode='care';
    renderMatCenter(); show('scr-care');
    if(typeof updateBar==='function') updateBar();
    return;
  }
  if(typeof setMode==='function') setMode('use');
}

function pfAktuelles(){
  const liste = pfListe(pfAktiv?pfAktiv.umfang:null, pfNurOffene, pfSort);
  if(!liste.length) return { liste:[], m:null, i:-1 };
  let i = pfAktiv&&pfAktiv.key ? liste.findIndex(x=>x.key===pfAktiv.key) : 0;
  if(i<0) i = 0;
  return { liste, m:liste[i], i };
}
function pfGeheZu(delta){
  const { liste, i } = pfAktuelles();
  if(!liste.length) return;
  const j = Math.min(liste.length-1, Math.max(0, i+delta));
  pfAktiv.key = liste[j].key;
  renderPflege();
  const box = $('scr-pflege'); if(box && box.scrollIntoView) try{ box.scrollIntoView({block:'start'}); }catch(e){}
}
function pfSpringeZu(key){ if(!pfAktiv) return; pfAktiv.key = key; renderPflege(); }

/* ── Die Übergänge in die Werkzeuge ── */

/* Aufräum-Assistent, aber NUR für diesen einen Text. Ohne die Einengung
   landete man in der allgemeinen Warteschlange und verlöre das Material. */
function pfZumAufraeumen(m){
  const tk = m.texteOffen[0];
  if(!tk || typeof openCleanupFokus!=='function'){ if(typeof toast==='function') toast('Der Aufräum-Assistent ist nicht verfügbar',true); return; }
  openCleanupFokus(tk);
}
/* Material-Editor, aufgeschlagen an der Stelle, um die es geht. */
function pfZumMaterial(m, anker){
  if(typeof openMaterial!=='function') return;
  openMaterial(m.key, m.name);
  if(!anker) return;
  setTimeout(()=>{ const el=$(anker); if(el && el.scrollIntoView){ try{ el.scrollIntoView({block:'center'}); }catch(e){} } }, 80);
}
/* Bereich: das ist eine Eigenschaft der ZEILE mit Reichweite — also über das
   gewohnte ⋯-Menü, damit „gilt überall" genau das Übliche bedeutet. */
function pfZumBereich(m){
  const st = m.stellen[0];
  if(!st || typeof openSheet!=='function'){ if(typeof toast==='function') toast('Kein Vorkommen gefunden',true); return; }
  if(typeof curStd!=='undefined' && typeof DB!=='undefined'){
    const s = DB.standards.find(x=>x.id===st.sid); if(s) curStd = s;
  }
  openSheet(st.cid);
  if(typeof renderSheetBereich==='function') renderSheetBereich();
}

/* ═══════════ 5. Der Bildschirm ═══════════ */

function renderPflege(){
  const box = $('scr-pflege'); if(!box) return;
  const umfang = pfAktiv ? pfAktiv.umfang : {art:'alle'};
  const st = pfStats(umfang);
  const proz = st.gesamt ? Math.round(100*st.fertig/st.gesamt) : 0;
  const { liste, m, i } = pfAktuelles();

  const sortBtn = (k,l)=>`<button type="button" class="btn btn-sec${pfSort===k?' on':''}" data-k="${esc(k)}" onclick="pfUiSort(this.dataset.k)">${esc(l)}</button>`;
  const kopf = `<div class="banner"><h2>🧹 Pflege-Weg</h2>
    <p>Ein Material nach dem anderen: <b>Text aufräumen</b>, <b>Felder füllen</b>, <b>Etikett scannen</b>, <b>Foto machen</b>. Jeder Schritt öffnet das passende Werkzeug und bringt dich hierher zurück. Die Standards bleiben unangetastet.</p>
    <div class="prog"><div class="prog-txt">${st.fertig} von ${st.gesamt} Materialien fertig (${proz} %) · ${st.schritteOffen} Schritte offen · Umfang: ${esc(pfUmfangWort(umfang))}</div>
      <div class="prog-bar"><span style="width:${proz}%"></span></div></div>
    <div class="pf-filter">
      <button type="button" class="btn btn-sec${pfNurOffene?' on':''}" onclick="pfUiNurOffene(true)">Nur offene</button>
      <button type="button" class="btn btn-sec${pfNurOffene?'':' on'}" onclick="pfUiNurOffene(false)">Alle zeigen</button>
      ${sortBtn('wirkung','Nach Wirkung')}${sortBtn('name','Nach Name')}
      ${(umfang&&umfang.art!=='alle')?`<button type="button" class="btn btn-sec" onclick="pfUiUmfangAlle()">Auf den ganzen Bestand ausweiten</button>`:''}
    </div></div>`;

  if(!liste.length){
    box.innerHTML = kopf + `<div class="empty"><div class="ei">✅</div><h3>${st.gesamt?'Nichts mehr offen':'Kein Material im Umfang'}</h3>
      <p>${st.gesamt?'Alle Materialien in diesem Umfang sind durchgepflegt. Neue Zeilen erscheinen hier automatisch.':'In diesem Umfang steht keine Materialzeile. Umfang ausweiten oder einen anderen Standard wählen.'}</p>
      <div class="p-actions" style="justify-content:center">
        <button class="btn btn-sec" onclick="pflegeVerlassen()">Zurück</button>
        ${st.gesamt&&pfNurOffene?`<button class="btn btn-sec" onclick="pfUiNurOffene(false)">Alle noch einmal ansehen</button>`:''}</div></div>`;
    return;
  }

  box.innerHTML = kopf + pfKarteHTML(m, i, liste.length);
}

function pfKarteHTML(m, i, n){
  const schritte = pflListe();
  const offen = pfLuecken(m).length;
  const fertigVonHand = pfFertigVon(m.key);
  const wo = m.standards.length;

  /* Vorher/Nachher: links der Satz aus der Vorlage, rechts das Material.
     Genau diese Gegenüberstellung ist die Arbeit — sie muss man sehen. */
  const rohBlock = m.roh.length
    ? `<div class="pf-vgl">
        <div class="pf-vgl-s"><div class="if-l">So steht es im Standard</div>
          ${m.roh.map(t=>`<div class="pf-roh">${esc(t)}</div>`).join('')}</div>
        <div class="pf-vgl-p">→</div>
        <div class="pf-vgl-s"><div class="if-l">Daraus geworden</div>
          <div class="pf-name">${esc(m.name)}</div>
          ${m.texteOffen.length?`<div class="pf-warn">noch nicht entmischt</div>`:''}</div>
      </div>`
    : `<div class="pf-name">${esc(m.name)}</div>`;

  const foto = pfHatFoto(m.rec)
    ? `<div class="pf-foto"><img src="${esc(m.rec.photo || (m.rec.fotos&&m.rec.fotos[0]&&m.rec.fotos[0].src) || '')}" alt="${esc(m.name)}" data-zoom data-cap="${esc(m.name)}"></div>`
    : '';

  const zeilen = schritte.map(s=>{
    const z = pfSchrittZustand(m, s);
    let auskunft = '';
    try{ auskunft = String(s.stand(m)||''); }catch(e){ auskunft = ''; }
    const marke = (z==='fertig') ? '✓' : (z==='entfaellt' ? '–' : '○');
    const tunBtn = (s.art==='hand')
      ? `<button class="btn btn-sec" data-s="${esc(s.key)}" onclick="pfUiHand(this.dataset.s)">${pfHandHaken(m.key,s.key)?'↺ Haken weg':'✓ Erledigt'}</button>`
      : (z==='offen' ? `<button class="btn btn-pri" data-s="${esc(s.key)}" onclick="pfUiTun(this.dataset.s)">Öffnen</button>`
                     : `<button class="btn btn-sec" data-s="${esc(s.key)}" onclick="pfUiTun(this.dataset.s)">Ansehen</button>`);
    return `<div class="pf-schritt ${esc(z)}">
      <span class="pf-marke" aria-hidden="true">${marke}</span>
      <span class="pf-s-ico" aria-hidden="true">${s.ico}</span>
      <span class="pf-s-main"><span class="pf-s-w">${esc(s.wort)}</span>
        <span class="pf-s-sub">${esc(z==='entfaellt' ? 'entfällt für dieses Material' : (auskunft||s.sub))}</span></span>
      <span class="pf-s-akt">${tunBtn}
        <button class="btn btn-sec pf-weg" data-s="${esc(s.key)}" onclick="pfUiEntfaellt(this.dataset.s)">${pfEntfaellt(m.key,s.key)?'↺ gilt wieder':'entfällt'}</button>
      </span></div>`;
  }).join('');

  const stdListe = m.standards.slice(0,3).map(sid=>{
    const s = (typeof DB!=='undefined'&&DB)?DB.standards.find(x=>x.id===sid):null;
    return s ? ((typeof stdTitel==='function')?stdTitel(s):s.titel) : sid;
  }).join(', ');

  return `<div class="pf-karte">
    <div class="pf-pos">Material ${i+1} von ${n} · <b>${m.vorkommen}×</b> in ${wo} Standard${wo===1?'':'s'}${offen?` · <span class="pf-flag">${offen} offen</span>`:' · <span class="pf-ok">fertig</span>'}</div>
    ${rohBlock}
    ${foto}
    <div class="pf-wo">${esc(stdListe)}${m.standards.length>3?` +${m.standards.length-3}`:''}</div>
    <div class="pf-liste">${zeilen}</div>
    ${fertigVonHand?`<div class="pf-hand">Von Hand abgeschlossen — offene Schritte gelten als erledigt.</div>`:''}
    <div class="pf-nav">
      <button class="btn btn-sec" onclick="pfUiZurueck()" ${i<=0?'disabled':''}>◀ Vorheriges</button>
      <button class="btn btn-sec" onclick="pfUiFertig()">${fertigVonHand?'↺ Wieder öffnen':'✓ Material fertig'}</button>
      <button class="btn btn-pri" onclick="pfUiWeiter()" ${i>=n-1?'disabled':''}>Nächstes ▶</button>
    </div>
    <div class="pf-nav2">
      <button class="btn btn-sec" onclick="pfUiAlleZeigen()">Liste öffnen</button>
      <button class="btn btn-sec" onclick="pflegeVerlassen()">Weg beenden</button>
    </div>
    ${pfSprungHTML(m)}
  </div>`;
}

/* Die Sprungliste: sie ist zugeklappt, weil der Weg von einem Material zum
   nächsten führt — aber wer ein bestimmtes sucht, soll nicht durchblättern. */
let pfListeOffen = false;
function pfSprungHTML(cur){
  if(!pfListeOffen) return '';
  const liste = pfListe(pfAktiv?pfAktiv.umfang:null, pfNurOffene, pfSort);
  const zeilen = liste.slice(0,300).map(m=>{
    const l = pfLuecken(m).length;
    const ist = (m.key===cur.key);
    return `<button type="button" class="pf-sprung${ist?' on':''}" data-k="${esc(m.key)}" onclick="pfUiSpringe(this.dataset.k)">
      <span class="pf-sp-n">${esc(m.name)}</span>
      <span class="pf-sp-s">${m.vorkommen}× · ${l?(l+' offen'):'fertig'}</span></button>`;
  }).join('');
  return `<div class="pf-sprungliste">${zeilen}${liste.length>300?`<div class="hint">… und ${liste.length-300} weitere.</div>`:''}</div>`;
}

/* ── Bedienung ── */
function pfUiSort(k){ pfSort=k; if(typeof store==='object'&&store&&store.set) store.set('hkl_pflege_sort',k); renderPflege(); }
function pfUiNurOffene(v){ pfSetzeNurOffene(v); renderPflege(); }
function pfUiUmfangAlle(){ if(!pfAktiv) return; pfAktiv.umfang={art:'alle'}; renderPflege(); pfBarSetzen(); }
function pfUiZurueck(){ pfGeheZu(-1); }
function pfUiWeiter(){ pfGeheZu(1); }
function pfUiSpringe(key){ pfListeOffen=false; pfSpringeZu(key); }
function pfUiAlleZeigen(){ pfListeOffen=!pfListeOffen; renderPflege(); }
function pfUiTun(schritt){
  const { m } = pfAktuelles(); if(!m) return;
  const s = pflListe().find(x=>x.key===schritt); if(!s || !s.tun) return;
  s.tun(m);
}
function pfUiEntfaellt(schritt){
  const { m } = pfAktuelles(); if(!m) return;
  pfEntfaelltSchalten(m.key, schritt);
  renderPflege();
  if(typeof toast==='function') toast(pfEntfaellt(m.key,schritt)?'Schritt entfällt für dieses Material':'Schritt gilt wieder');
}
function pfUiHand(schritt){
  const { m } = pfAktuelles(); if(!m) return;
  pfHandSchalten(m.key, schritt);
  renderPflege();
}
/* „Fertig" springt weiter — wer abschließt, will das nächste Material sehen.
   Beim Wieder-Öffnen bleibt man stehen. */
function pfUiFertig(){
  const { m, i, liste } = pfAktuelles(); if(!m) return;
  const warFertig = !!pfFertigVon(m.key);
  pfFertigSchalten(m.key);
  if(warFertig){ renderPflege(); if(typeof toast==='function') toast('Wieder offen'); return; }
  if(typeof toast==='function') toast('Material abgeschlossen');
  /* Bei „nur offene" rutscht das erledigte Material aus der Liste — dann steht
     an derselben Stelle schon das nächste. */
  if(pfNurOffene){
    const rest = pfListe(pfAktiv?pfAktiv.umfang:null, true, pfSort);
    pfAktiv.key = rest.length ? rest[Math.min(i, rest.length-1)].key : null;
    renderPflege(); return;
  }
  if(i<liste.length-1) pfGeheZu(1); else renderPflege();
}

/* ═══════════ 6. Verwaltung ═══════════ */

let pflNeuOffen = false;
let pflLoeschFrage = null;   /* Rückfrage ohne natives Fenster (Grundsatz ⑧) */

function pflegePanelHTML(){
  const st = pfStats({art:'alle'});
  const zeilen = pflAlleSchritte()
    .map((s,i)=>({ s, ord:Number(pflWert(s.key,'ord', i)) }))
    .sort((a,b)=>a.ord-b.ord)
    .map(({s})=>{
      const aus = pflAus(s.key);
      const wort = pflWert(s.key,'wort', s.wort);
      const sub  = pflWert(s.key,'sub',  s.sub);
      const ico  = pflWert(s.key,'ico',  s.ico);
      return `<div class="fkt-zeile${aus?' fkt-aus':''}">
        <div class="fkt-haupt">
          <div class="pf-vz">
            <input class="loc-input pf-vico" value="${esc(ico)}" maxlength="4" data-k="${esc(s.key)}"
              onchange="pflUiFeld(this.dataset.k,'ico',this.value)" aria-label="Symbol">
            <input class="loc-input fkt-name" value="${esc(wort)}" data-k="${esc(s.key)}"
              onchange="pflUiFeld(this.dataset.k,'wort',this.value)" aria-label="Bezeichnung">
          </div>
          <input class="loc-input pf-vsub" value="${esc(sub)}" data-k="${esc(s.key)}"
            onchange="pflUiFeld(this.dataset.k,'sub',this.value)" aria-label="Erklärung">
          <div class="fkt-sub">${s.art==='hand'?'eigener Schritt · wird von Hand abgehakt':'wird an den Daten abgelesen'}</div>
        </div>
        <div class="fkt-akt">
          <button data-k="${esc(s.key)}" onclick="pflUiVerschieben(this.dataset.k,-1)" aria-label="nach oben">⬆</button>
          <button data-k="${esc(s.key)}" onclick="pflUiVerschieben(this.dataset.k,1)" aria-label="nach unten">⬇</button>
          <button class="${aus?'':'dgr'}" data-k="${esc(s.key)}" onclick="pflUiSchalten(this.dataset.k)">${aus?'Einblenden':'Ausblenden'}</button>
          ${s.eigen?`<button class="dgr" data-k="${esc(s.key)}" onclick="pflUiLoeschFragen(this.dataset.k)">Löschen</button>`:''}
        </div>
        ${(pflLoeschFrage===s.key)?`<div class="pf-frage">Schritt „${esc(wort)}" entfernen? Bereits gesetzte Haken bleiben gespeichert und gelten wieder, falls der Schritt erneut angelegt wird.
          <div class="p-actions"><button class="btn btn-sec" onclick="pflUiLoeschAbbrechen()">Abbrechen</button>
          <button class="btn btn-pri" data-k="${esc(s.key)}" onclick="pflUiEigenLoeschen(this.dataset.k)">Entfernen</button></div></div>`:''}
        </div>`;
    }).join('');

  const neu = pflNeuOffen
    ? `<div class="eig-neu">
        <input class="loc-input" id="pflNeuWort" placeholder="Name des Schrittes, z. B. im Lagersystem angelegt">
        <input class="loc-input" id="pflNeuSub" placeholder="Erklärung (optional)">
        <input class="loc-input" id="pflNeuIco" placeholder="Symbol (optional)" maxlength="4">
        <p class="hint">Ein eigener Schritt hat keine Daten, an denen er sich ablesen ließe — er wird je Material von Hand abgehakt.</p>
        <div class="p-actions"><button class="btn btn-sec" onclick="pflUiNeuAbbrechen()">Abbrechen</button><button class="btn btn-pri" onclick="pflUiNeuSpeichern()">Anlegen</button></div></div>`
    : `<div class="p-actions"><button class="btn btn-sec" onclick="pflUiNeu()">＋ Eigenen Schritt anlegen</button></div>`;

  const head = (typeof vsum==='function')
    ? vsum('🧹','Pflege-Weg','Die Schritte, die ein Material durchläuft — Wortlaut, Reihenfolge, an/aus',
           [pflGeaendert()?'angepasst':'', st.gesamt?(st.fertig+'/'+st.gesamt+' fertig'):''].filter(Boolean).join(' · '))
    : `<summary>🧹 Pflege-Weg</summary>`;

  return `<details class="vpanel" data-keys="pflege pflegeweg material aufräumen aufraeumen etikett scannen foto lagerort schritte durchgehen systematisch">
    ${head}<div class="vpanel-body">
    <p class="panel-help">Der Pflege-Weg geht <b>Material für Material</b> durch den Bestand und öffnet je Schritt das vorhandene Werkzeug. Jeder Schritt lässt sich <b>umbenennen</b>, <b>verschieben</b> und <b>ausblenden</b>; eigene Schritte kommen als Handhaken dazu — ohne Programmierung. Ein Schritt, der für ein bestimmtes Material keinen Sinn hat, wird dort auf „entfällt" gesetzt.</p>
    <div class="fkt-liste">${zeilen}</div>
    ${neu}
    <div class="p-actions">
      <button class="btn btn-pri" onclick="openPflege({umfang:{art:'alle'}})">🧹 Pflege-Weg starten</button>
      <button class="btn btn-sec" onclick="pflUiZuruecksetzen()">Auf Auslieferung zurücksetzen</button>
    </div>
    </div></details>`;
}

function pflUiFeld(key, feld, wert){
  const s = pflAlleSchritte().find(x=>x.key===key); if(!s) return;
  const v = String(wert||'').trim();
  pflSetzen(key, feld, (v===String(s[feld]||'')) ? '' : v);
  if(typeof toast==='function') toast('Übernommen');
}
function pflUiSchalten(key){
  pflSetzen(key,'aus', !pflAus(key));
  if(typeof renderAdmin==='function') renderAdmin();
  if(typeof toast==='function') toast(pflAus(key)?'Schritt ausgeblendet':'Schritt wieder sichtbar');
}
function pflUiVerschieben(key, richtung){
  const liste = pflAlleSchritte()
    .map((s,i)=>({ key:s.key, ord:Number(pflWert(s.key,'ord', i)) }))
    .sort((a,b)=>a.ord-b.ord);
  const i = liste.findIndex(x=>x.key===key); const j = i + (richtung<0?-1:1);
  if(i<0 || j<0 || j>=liste.length) return;
  const t = liste[i]; liste[i] = liste[j]; liste[j] = t;
  liste.forEach((x,n)=>pflSetzen(x.key,'ord', n));
  if(typeof renderAdmin==='function') renderAdmin();
}
function pflUiNeu(){ pflNeuOffen=true; if(typeof renderAdmin==='function') renderAdmin();
  setTimeout(()=>{ const i=$('pflNeuWort'); if(i) i.focus(); },50); }
function pflUiNeuAbbrechen(){ pflNeuOffen=false; if(typeof renderAdmin==='function') renderAdmin(); }
function pflUiNeuSpeichern(){
  const w=($('pflNeuWort')&&$('pflNeuWort').value||'').trim();
  if(!w){ if(typeof toast==='function') toast('Bitte einen Namen eingeben',true); return; }
  const s=pflEigenAnlegen(w, ($('pflNeuSub')&&$('pflNeuSub').value)||'', ($('pflNeuIco')&&$('pflNeuIco').value)||'');
  pflNeuOffen=false;
  if(typeof renderAdmin==='function') renderAdmin();
  if(typeof toast==='function') toast(s?('Schritt „'+w+'" angelegt'):'Konnte nicht angelegt werden');
}
function pflUiLoeschFragen(key){ pflLoeschFrage=key; if(typeof renderAdmin==='function') renderAdmin(); }
function pflUiLoeschAbbrechen(){ pflLoeschFrage=null; if(typeof renderAdmin==='function') renderAdmin(); }
function pflUiEigenLoeschen(key){
  pflLoeschFrage=null;
  if(!pflEigenLoeschen(key)) return;
  if(typeof renderAdmin==='function') renderAdmin();
  if(typeof toast==='function') toast('Schritt entfernt');
}
function pflUiZuruecksetzen(){
  pflZuruecksetzen();
  if(typeof renderAdmin==='function') renderAdmin();
  if(typeof toast==='function') toast('Pflege-Weg auf Auslieferung zurückgesetzt — eigene Schritte bleiben');
}

/* ═══════════ 7. Einstiege von außen ═══════════ */

/* „⋯ → Pflege-Weg ab hier" an einer Zeile im Standard: derselbe Weg, aber er
   beginnt bei genau dem Material, das man gerade vor sich hat. */
function pflegeAbZeile(cid, e){
  const k = (typeof effMatKey==='function') ? effMatKey(e, cid) : (e && e.material_key);
  if(!k){ if(typeof toast==='function') toast('Diese Zeile ist kein Material',true); return; }
  const sid = (typeof cidStd==='function') ? cidStd(cid) : String(cid).split('|')[0];
  openPflege({ umfang:{art:'standard', wert:sid}, key:k });
}
function pflegeFuerStandard(sid){ openPflege({ umfang:{art:'standard', wert:sid} }); }
