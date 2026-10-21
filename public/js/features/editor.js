/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — EDITOR AM PC (Neuaufbau)

   Der Wunsch, wörtlich: „Mich stört der Moduszwang und das Nicht-Ziehen
   zwischen den Rubriken." Am Handy ist die bestehende Bedienung richtig —
   tippen hakt ab, langes Tippen öffnet das Menü, Sortieren ist ein eigener,
   ruhiger Modus. Am PC ist sie zu eng: Ein Standard entsteht dort, indem man
   aus einem Vorrat zusammenstellt und dann in Ruhe ordnet.

   Deshalb ein EIGENER Bildschirm, der sich zweiteilt:

     links  die BIBLIOTHEK — Material (die erfassten Produkte), Geräte,
            Bausteine, Freitext, und Rubriken anderer Standards als Vorlage
     rechts der STANDARD — ALLE Rubriken untereinander, mit ihren Abschnitten

   Grob zusammenstellen per ANKREUZEN: Ein Haken links legt das Produkt im
   gerade gewählten Ziel (Rubrik/Abschnitt, rechts violett umrandet) an; Haken
   weg nimmt es wieder heraus. Feinarbeit per ZIEHEN — am Griff ⠿, ohne
   Modus, innerhalb eines Abschnitts, zwischen Abschnitten, zwischen Rubriken,
   und aus der Bibliothek direkt an die Stelle, an die es gehört.

   ── Was beim Verschieben nicht verrutschen darf ──
   Die App merkt sich vieles über die POSITION einer Zeile (die „cid": Standard
   | Rubrik | Bereich | Platz): Mengen- und Namensänderungen, Regeln „nur
   hier", Häkchen, Arzt-Varianten, bestätigte Zerlegungen. Wer eine Zeile
   verschiebt, ändert ihre Position — und ohne Gegenmaßnahme bliebe ihre
   Änderung am alten Platz liegen und träfe die Zeile, die dort nachrückt.
   edUmzug() zieht deshalb bei JEDER Änderung alle diese Speicher mit um,
   Zeile für Zeile über ihre feste Kennung (_aid). Regeln werden dabei nicht
   umgeschrieben (das Journal ist nur fortschreibbar), sondern am alten Platz
   zurückgenommen und am neuen neu gesetzt — der Umzug steht im Journal.

   ── Format ──
   Der Editor arbeitet auf den EIGENEN Daten des Standards (features/
   additions.js): Die Reihenfolge der Zeilen ist ihre Reihenfolge im Datensatz,
   kein Überzug darüber. Das ist das „App-Format", in dem die Standards im
   Neuaufbau entstehen sollen — nicht mehr das Word-Format mit Überzügen.

   Nur für Standards, die im Neuaufbau angelegt wurden; nur am breiten
   Bildschirm angeboten. Am Handy bleibt alles, wie es ist.
   ───────────────────────────────────────────────────────────── */

/* ═══════════ 1. Reine Helfer (testbar) ═══════════ */

/* Schlüssel eines Speichers umschreiben (alte cid → neue cid).
     map       { alt: neu | null }  (null = Zeile ist weg)
     praefixe  betroffene Bereiche ('sid|ri|')
     bekannt   alle cids, die VOR der Änderung eine Zeile waren
   Was in einem betroffenen Bereich liegt, aber zu keiner Zeile gehörte
   (Rest einer früher gelöschten Zeile), fällt dabei weg — sonst träfe es die
   nächste Zeile, die an diesen Platz rückt. */
function edUmschluesseln(obj, map, praefixe, bekannt){
  const aus = {};
  Object.keys(obj||{}).forEach(k=>{
    const betroffen = praefixe.some(p=>k.indexOf(p)===0);
    if(!betroffen){ aus[k] = obj[k]; return; }
    if(Object.prototype.hasOwnProperty.call(map, k)){ const n = map[k]; if(n) aus[n] = obj[k]; return; }
    if(bekannt && bekannt.has(k)) aus[k] = obj[k];
  });
  return aus;
}

/* Eine Liste von Kennungen, in die ein Block an eine Stelle gesetzt wird.
   ziel: { vor:aid } | { nach:aid } | { index:n } — fehlt das Bezugsziel
   (weil es selbst im Block steckt), landet der Block am Ende. Rein. */
function edListeSetzen(liste, block, ziel){
  const rest = liste.filter(a=>block.indexOf(a)<0);
  let i = rest.length;
  if(ziel && ziel.vor!=null){ const j = rest.indexOf(ziel.vor); if(j>=0) i = j; }
  else if(ziel && ziel.nach!=null){ const j = rest.indexOf(ziel.nach); if(j>=0) i = j+1; }
  else if(ziel && ziel.index!=null){ i = Math.max(0, Math.min(rest.length, ziel.index)); }
  return rest.slice(0,i).concat(block, rest.slice(i));
}

/* ═══════════ 2. Zustand und Zugang ═══════════ */

let ED = null;   /* { sid, ziel:{ri,g}, tab, q, quellStd, zug } */

function edMoeglich(){ return (typeof neuFrei==='function' && neuFrei('editor')) && typeof ADMIN!=='undefined' && ADMIN; }
function edBreit(){ return (typeof window!=='undefined' ? (window.innerWidth||0) : 0) >= 900; }
/* Der Datensatz des Standards selbst (nur eigene Standards). */
function edQuelle(sid){ return (typeof ADDITIONS!=='undefined' && ADDITIONS.standards || []).find(s=>s.id===sid) || null; }

/* Der Einstieg im Standard (rubriken.js). Am schmalen Bildschirm gar nicht. */
function edKnopfHTML(s){
  if(!s || !edMoeglich() || !edBreit() || !edQuelle(s.id)) return '';
  return `<div class="ed-einstieg"><button class="btn btn-pri" data-s="${esc(s.id)}" onclick="edOeffnen(this.dataset.s)">🖥 Im Editor bearbeiten</button>
    <span class="hint">Bibliothek links, Standard rechts — ankreuzen und ziehen, auch zwischen Rubriken.</span></div>`;
}

function edOeffnen(sid){
  if(!edMoeglich()){ toast('Der Editor ist hier nicht freigegeben.', true); return; }
  if(!edQuelle(sid)){ toast('Den Editor gibt es für Standards, die im Neuaufbau angelegt wurden.', true); return; }
  const s = DB.standards.find(x=>x.id===sid); if(!s){ toast('Standard nicht gefunden', true); return; }
  curStd = s;
  if(!ED || ED.sid!==sid) ED = { sid, ziel:null, tab:'material', q:'', quellStd:null, zug:null };
  if(typeof sortBeenden==='function') sortBeenden();
  edNormalisieren();
  if(!ED.ziel || !curStd.rubriken[ED.ziel.ri]) ED.ziel = edStartZiel();
  edZeichnen();
  show('scr-editor');
  setBar(stdTitel(curStd), 'Editor', true);
  const sw = $('searchWrap'); if(sw) sw.style.display = 'none';
}
function edSchliessen(){
  edZugAbbrechen();
  const sid = ED && ED.sid;
  if(sid && typeof openStandard==='function') openStandard(sid, true); else setMode('use');
}
/* Erstes Ziel: die erste Material-Rubrik, sonst die erste überhaupt. */
function edStartZiel(){
  const rs = edRubriken();
  const m = rs.find(x=>x.r.typ==='material') || rs[0];
  return m ? { ri:m.i, g:'' } : { ri:0, g:'' };
}
function edZiel(ri, g){ if(!ED) return; ED.ziel = { ri:+ri, g:String(g==null?'':g) }; edZeichnen(); }

/* ═══════════ 3. Das Modell eines Standards ═══════════ */

function edRubriken(){ return (curStd.rubriken||[]).map((r,i)=>({r,i})).sort((a,b)=>rubOrd(a.r,a.i)-rubOrd(b.r,b.i)); }
function edListe(ri){ return ADDITIONS.entries[ED.sid+'|'+ri] || []; }
function edSi0(ri){ const q = edQuelle(ED.sid); const r = q && q.rubriken && q.rubriken[ri]; return (r && Array.isArray(r.sub_bereiche)) ? r.sub_bereiche.length : 0; }
function edCid(ri, ei){ return cidOf(ED.sid, ri, edSi0(ri), ei); }
function edIstMatGer(ri){ const r = curStd.rubriken[ri]; return !!r && (r.typ==='material' || r.typ==='geraete'); }

/* Die Abschnitte einer Rubrik — so, wie die normale Ansicht sie zeigt.
   Material/Geräte: nach Unterkategorie (auch leer angelegte). Ablauf: die
   Überschriften-Zeilen teilen die Liste. Ausgeblendete Zeilen erscheinen
   (blass) mit — im Editor soll nichts unsichtbar verloren gehen. */
function edGruppen(ri){
  const liste = edListe(ri);
  const reihen = liste.map((e,ei)=>({ e, ei, cid:edCid(ri,ei) }));
  if(edIstMatGer(ri)){
    const uks = [''];
    reihen.forEach(x=>{ x.g = canonUk(x.e, x.cid) || ''; if(uks.indexOf(x.g)<0) uks.push(x.g); });
    (declaredUksFor(ri)||[]).forEach(u=>{ if(uks.indexOf(u)<0) uks.push(u); });
    return uks.map(uk=>({ key:uk, titel:uk||'ohne Abschnitt', kopf:null, reihen:reihen.filter(x=>x.g===uk) }));
  }
  const gruppen = [{ key:'', titel:'Anfang', kopf:null, reihen:[] }];
  reihen.forEach(x=>{
    if(x.e.natur==='ueberschrift'){ gruppen.push({ key:x.e._aid, titel:x.e.anzeige_text||x.e.roh_text||'Abschnitt', kopf:x, reihen:[] }); return; }
    x.g = gruppen[gruppen.length-1].key;
    gruppen[gruppen.length-1].reihen.push(x);
  });
  return gruppen;
}

/* Einmal beim Öffnen: Was die normale Ansicht über `seg` einem Abschnitt
   zuschlägt, wird an seinen Platz gelegt — danach ist die Reihenfolge im
   Datensatz genau die, die man sieht. Fehlende Kennungen werden ergänzt. */
function edNormalisieren(){
  const neu = {};
  let kennungNeu = false;
  (curStd.rubriken||[]).forEach((r,ri)=>{
    const l = edListe(ri);
    l.forEach(e=>{ if(!e._aid){ e._aid = newAid(); kennungNeu = true; } });
    if(edIstMatGer(ri) || !l.some(e=>e.seg)) return;
    const ohne = l.filter(e=>!e.seg || e.natur==='ueberschrift');
    const mitSeg = l.filter(e=>e.seg && e.natur!=='ueberschrift');
    mitSeg.forEach(e=>{
      const kopf = ohne.findIndex(x=>x.natur==='ueberschrift' && (x.anzeige_text||x.roh_text)===e.seg);
      let i = ohne.length;
      if(kopf>=0){ i = kopf+1; while(i<ohne.length && ohne[i].natur!=='ueberschrift') i++; }
      ohne.splice(i, 0, e);
      e.seg = null;
    });
    neu[ri] = ohne;
  });
  if(Object.keys(neu).length) edAnwenden(neu);
  else if(kennungNeu) saveAdditions();
}

/* ═══════════ 4. Der eine Schreibweg ═══════════ */

/* Neue Zeilenlisten übernehmen: { ri: [Einträge in Reihenfolge] }.
   Zieht ALLE positionsabhängigen Speicher nach (siehe Kopf). */
function edAnwenden(neu){
  const sid = ED.sid;
  const betroffen = Object.keys(neu).map(Number);
  const vorher = {}, bekannt = new Set();
  betroffen.forEach(ri=>{ edListe(ri).forEach((e,ei)=>{ const c = edCid(ri,ei); vorher[e._aid] = c; bekannt.add(c); }); });
  betroffen.forEach(ri=>{
    const key = sid+'|'+ri;
    if(neu[ri] && neu[ri].length) ADDITIONS.entries[key] = neu[ri]; else delete ADDITIONS.entries[key];
  });
  const nachher = {};
  betroffen.forEach(ri=>{ edListe(ri).forEach((e,ei)=>{ nachher[e._aid] = edCid(ri,ei); }); });
  const map = {};
  Object.keys(vorher).forEach(aid=>{ const a = vorher[aid], n = nachher[aid] || null; if(a!==n) map[a] = n; });
  const praefixe = betroffen.map(ri=>sid+'|'+ri+'|');
  edUmzug(map, praefixe, bekannt);
  /* Die Reihenfolge steht jetzt im Datensatz — eine gespeicherte Sortierung
     darüber würde sie nur verdecken. */
  let ordWeg = false;
  Object.keys(ENTORD).forEach(k=>{ if(praefixe.some(p=>k.indexOf(p)===0)){ delete ENTORD[k]; ordWeg = true; } });
  if(ordWeg) saveENTORD();
  saveAdditions();
  rebuildDB();
  if(typeof buildMaterialIndex==='function') buildMaterialIndex();
  curStd = DB.standards.find(x=>x.id===sid) || curStd;
}

/* Speichert nur, wenn sich wirklich etwas geändert hat. */
function edGeaendert(vorher, nachher){ try{ return JSON.stringify(vorher)!==JSON.stringify(nachher); }catch(e){ return true; } }
function edUmzug(map, praefixe, bekannt){
  const um = o=>edUmschluesseln(o, map, praefixe, bekannt);
  let n;
  n = um(QE.cid);      if(edGeaendert(QE.cid, n)){ QE.cid = n; saveQE(); }
  n = um(overrides);   if(edGeaendert(overrides, n)){ overrides = n; saveJSON('hkl_overrides', overrides); }
  n = um(reassign);    if(edGeaendert(reassign, n)){ reassign = n; saveJSON('hkl_reassign', reassign); }
  if(typeof checks!=='undefined'){ n = um(checks); if(edGeaendert(checks, n)){ checks = n; if(typeof saveChecks==='function') saveChecks(); } }
  if(typeof ZERLDB!=='undefined'){ n = um(ZERLDB); if(edGeaendert(ZERLDB, n)){ ZERLDB = n; if(typeof saveZerlDB==='function') saveZerlDB(); } }
  if(typeof VARIANTS!=='undefined' && VARIANTS && VARIANTS.data){
    let geaendert = false;
    Object.keys(VARIANTS.data).forEach(a=>{ const d = VARIANTS.data[a]; if(!d) return;
      ['qe','hidden'].forEach(f=>{ if(!d[f]) return; const x = um(d[f]); if(edGeaendert(d[f], x)){ d[f] = x; geaendert = true; } }); });
    if(geaendert && typeof saveVariants==='function') saveVariants();
  }
  /* Regeln „nur an dieser Stelle": zurücknehmen und am neuen Platz neu
     setzen. Verwaiste (ohne Zeile) werden zurückgenommen. */
  if(typeof RULES!=='undefined' && typeof rulesActive==='function' && typeof revokeRule==='function' && typeof addRule==='function'){
    rulesActive(RULES).slice().forEach(r=>{
      if(!r || !r.wo || r.wo.art!=='stelle') return;
      const c = String(r.wo.wert||'');
      if(!praefixe.some(p=>c.indexOf(p)===0)) return;
      if(Object.prototype.hasOwnProperty.call(map, c)){
        revokeRule(r.id);
        if(map[c]) addRule(r.ziel, { art:'stelle', wert:map[c] }, r.prop, r.wert, r.notiz||null);
      } else if(!bekannt.has(c)) revokeRule(r.id);
    });
  }
}

/* ═══════════ 5. Operationen ═══════════ */

function edAidListe(ri){ return edListe(ri).map(e=>e._aid); }
/* Der Block, der mit einer Zeile wandert: bei einer Ablauf-Überschrift der
   ganze Abschnitt, sonst die Zeile allein. */
function edBlock(ri, aid){
  const l = edListe(ri); const i = l.findIndex(e=>e._aid===aid); if(i<0) return [];
  if(edIstMatGer(ri) || l[i].natur!=='ueberschrift') return [aid];
  const block = [aid];
  for(let k=i+1; k<l.length && l[k].natur!=='ueberschrift'; k++) block.push(l[k]._aid);
  return block;
}
/* Wohin genau? Aus einem Ziel {ri,g,vor|nach|ende} eine Position in der
   flachen Liste machen. */
function edPosition(ri, ziel, block){
  if(ziel.vor!=null && block.indexOf(ziel.vor)<0) return { vor:ziel.vor };
  if(ziel.nach!=null && block.indexOf(ziel.nach)<0){
    /* Hinter eine Ablauf-Überschrift heißt: an den ANFANG ihres Abschnitts. */
    return { nach:ziel.nach };
  }
  const gruppen = edGruppen(ri);
  const g = gruppen.find(x=>x.key===String(ziel.g==null?'':ziel.g)) || gruppen[0];
  const rest = g.reihen.filter(x=>block.indexOf(x.e._aid)<0);
  if(rest.length) return { nach:rest[rest.length-1].e._aid };
  if(g.kopf && block.indexOf(g.kopf.e._aid)<0) return { nach:g.kopf.e._aid };
  /* Leerer Abschnitt ohne Kopf („Anfang" bzw. „ohne Abschnitt"). */
  if(!edIstMatGer(ri)) return { index:0 };
  return { index:edListe(ri).length };
}
/* Nach dem Einsetzen in eine Material-Rubrik: Abschnitt festschreiben.
   Eine Stelle-Änderung des Abschnitts (Schnellmenü) würde die Wahl sonst
   überdecken — sie wird für diese Zeile aufgehoben. */
function edAbschnittSetzen(ri, aid, g){
  if(!edIstMatGer(ri)) return;
  const l = edListe(ri); const ei = l.findIndex(e=>e._aid===aid); if(ei<0) return;
  const e = l[ei];
  e.unterkategorie = g || null;
  const cid = edCid(ri, ei);
  if(cid in reassign){ delete reassign[cid]; saveJSON('hkl_reassign', reassign); }
  if(typeof hasStelleRule==='function' && hasStelleRule(cid,'uk') && typeof rulesActive==='function')
    rulesActive(RULES).forEach(r=>{ if(r.wo && r.wo.art==='stelle' && r.wo.wert===cid && r.prop==='uk') revokeRule(r.id); });
}

/* Zeile (bzw. Abschnitt) verschieben. */
function edVerschieben(vonRi, aid, ziel){
  const block = edBlock(vonRi, aid); if(!block.length) return false;
  const zielRi = +ziel.ri;
  const obj = {}; edListe(vonRi).forEach(e=>{ obj[e._aid] = e; });
  const blockObj = block.map(a=>obj[a]);
  /* Eine Ablauf-Überschrift wird in einer Material-Rubrik zum Abschnitt —
     dort sind Abschnitte Unterkategorien, keine Zeilen. */
  if(edIstMatGer(zielRi) && blockObj[0] && blockObj[0].natur==='ueberschrift'){
    const name = blockObj[0].anzeige_text || blockObj[0].roh_text || 'Abschnitt';
    blockObj.shift(); block.shift();
    if(typeof addUkSectionName==='function') addUkSectionName(zielRi, name);
    blockObj.forEach(e=>{ e.unterkategorie = name; });
    ziel = { ri:zielRi, g:name, ende:true };
    if(!blockObj.length){ const rest = edListe(vonRi).filter(e=>e._aid!==aid); edAnwenden({ [vonRi]:rest }); return true; }
  }
  const neu = {};
  if(vonRi===zielRi){
    const pos = edPosition(zielRi, ziel, block);
    const ids = edListeSetzen(edAidListe(zielRi), block, pos);
    neu[zielRi] = ids.map(a=>obj[a]);
  } else {
    neu[vonRi] = edListe(vonRi).filter(e=>block.indexOf(e._aid)<0);
    const zobj = {}; edListe(zielRi).forEach(e=>{ zobj[e._aid] = e; }); blockObj.forEach(e=>{ zobj[e._aid] = e; });
    const pos = edPosition(zielRi, ziel, block);
    const ids = edListeSetzen(edAidListe(zielRi), block, pos);
    neu[zielRi] = ids.map(a=>zobj[a]);
    /* Ablauf ↔ Material: Abschnitts-Zuordnungen der alten Welt lösen. */
    blockObj.forEach(e=>{ e.seg = null; if(!edIstMatGer(zielRi)) e.unterkategorie = null; });
  }
  edAnwenden(neu);
  if(edIstMatGer(zielRi)) blockObj.forEach(e=>edAbschnittSetzen(zielRi, e._aid, String(ziel.g==null?'':ziel.g)));
  if(edIstMatGer(zielRi)){ saveAdditions(); rebuildDB(); curStd = DB.standards.find(x=>x.id===ED.sid) || curStd; }
  ED.ziel = { ri:zielRi, g:String(ziel.g==null?'':ziel.g) };
  return true;
}

/* Neue Einträge an ein Ziel setzen. */
function edEinsetzen(ziel, eintraege){
  const zielRi = +ziel.ri;
  const g = String(ziel.g==null?'':ziel.g);
  eintraege.forEach(e=>{ if(!e._aid) e._aid = newAid(); if(edIstMatGer(zielRi) && e.natur!=='ueberschrift') e.unterkategorie = g || null; e.seg = null; });
  const block = eintraege.map(e=>e._aid);
  const obj = {}; edListe(zielRi).forEach(e=>{ obj[e._aid] = e; }); eintraege.forEach(e=>{ obj[e._aid] = e; });
  const pos = edPosition(zielRi, ziel, block);
  const ids = edListeSetzen(edAidListe(zielRi), block, pos);
  edAnwenden({ [zielRi]:ids.map(a=>obj[a]) });
  ED.ziel = { ri:zielRi, g };
}

function edEntfernen(ri, aid){
  const block = edBlock(+ri, aid);
  const l = edListe(+ri);
  const istKopf = block.length>1;
  /* Eine Überschrift weg — ihre Zeilen bleiben (sie rutschen in den
     Abschnitt davor). Nur die Überschrift selbst verschwindet. */
  const weg = istKopf ? [aid] : block;
  edAnwenden({ [+ri]:l.filter(e=>weg.indexOf(e._aid)<0) });
}

/* Menge direkt in der Zeile. */
function edMenge(ri, aid, wert){
  const l = edListe(+ri); const ei = l.findIndex(x=>x._aid===aid); if(ei<0) return;
  const e = l[ei];
  const v = String(wert||'').trim();
  e.menge = v || null;
  const z = parseInt(v, 10); e.menge_zahl = isFinite(z) ? z : null;
  /* Im Editor ist die Menge die der Zeile selbst. Eine frühere Änderung
     „nur hier" (Schnellmenü) würde sie verdecken — sie wird aufgehoben. */
  const cid = edCid(+ri, ei);
  if(QE.cid[cid] && QE.cid[cid].mengeVal!==undefined){ delete QE.cid[cid].mengeVal; if(!Object.keys(QE.cid[cid]).length) delete QE.cid[cid]; saveQE(); }
  if(typeof hasStelleRule==='function' && hasStelleRule(cid,'mengeVal'))
    rulesActive(RULES).forEach(r=>{ if(r.wo && r.wo.art==='stelle' && r.wo.wert===cid && r.prop==='mengeVal') revokeRule(r.id); });
  saveAdditions(); rebuildDB(); curStd = DB.standards.find(x=>x.id===ED.sid) || curStd;
}
/* ▲ ▼ — dieselbe Arbeit ohne Ziehen (Tastatur, Handschuhe). Gezählt wird
   in der Reihenfolge, die man SIEHT: Am Anfang eines Abschnitts führt ▲ ans
   Ende des Abschnitts davor. */
function edSchritt(ri, aid, richtung){
  ri = +ri;
  const folge = [];
  edGruppen(ri).forEach(g=>g.reihen.forEach(x=>folge.push({ g:g.key, aid:x.e._aid })));
  const i = folge.findIndex(x=>x.aid===aid); if(i<0) return;
  const j = i + (richtung<0 ? -1 : 1);
  if(j<0 || j>=folge.length){ toast(richtung<0?'Schon ganz oben':'Schon ganz unten'); return; }
  const nb = folge[j];
  /* Innerhalb des Abschnitts: am Nachbarn vorbei. Über die Grenze: ans Ende
     des vorigen bzw. an den Anfang des nächsten Abschnitts. */
  const grenze = nb.g !== folge[i].g;
  const ziel = richtung<0
    ? (grenze ? { ri, g:nb.g, nach:nb.aid } : { ri, g:nb.g, vor:nb.aid })
    : (grenze ? { ri, g:nb.g, vor:nb.aid } : { ri, g:nb.g, nach:nb.aid });
  edVerschieben(ri, aid, ziel);
  edZeichnen();
}

/* Auffrischen, wenn ein anderes Gerät etwas geändert hat — nie mitten im
   Zug und nie, während in einem Feld des Editors getippt wird. */
function edAuffrischen(){
  if(!ED || ED.zug) return;
  const fokus = document.activeElement;
  if(fokus && fokus.closest && fokus.closest('#scr-editor') && /^(INPUT|TEXTAREA|SELECT)$/.test(fokus.tagName)) return;
  const s = DB.standards.find(x=>x.id===ED.sid); if(!s) return;
  curStd = s; edZeichnen();
}

/* ── Rubriken und Abschnitte ── */
function edRubrikNeu(){
  const n = ($('edRubName')||{}).value || '';
  const typ = ($('edRubTyp')||{}).value || 'material';
  const name = n.trim(); if(!name){ toast('Bitte einen Namen für die Rubrik', true); return; }
  const q = edQuelle(ED.sid); if(!q) return;
  q.rubriken.push({ name, typ:(typ==='material'||typ==='geraete'||typ==='ablauf')?typ:'sonstige', sub_bereiche:[] });
  saveAdditions(); rebuildDB(); curStd = DB.standards.find(x=>x.id===ED.sid) || curStd;
  ED.ziel = { ri:q.rubriken.length-1, g:'' };
  edZeichnen(); toast('Rubrik „'+name+'" angelegt');
}
function edRubrikUmbenennen(ri, name){
  const q = edQuelle(ED.sid); const v = String(name||'').trim();
  if(!q || !q.rubriken[ri] || !v) return;
  q.rubriken[ri].name = v;
  const k = rubKey(curStd.rubriken[ri], ri);
  if(RUBE[k] && RUBE[k].name){ delete RUBE[k].name; saveRUBE(); }
  saveAdditions(); rebuildDB(); curStd = DB.standards.find(x=>x.id===ED.sid) || curStd;
  edZeichnen();
}
function edRubrikRang(ri, richtung){
  const vis = edRubriken();
  const pos = vis.findIndex(x=>x.i===+ri); const j = pos + (richtung<0?-1:1);
  if(pos<0) return;
  if(j<0 || j>=vis.length){ toast(richtung<0?'Rubrik steht schon ganz oben':'Rubrik steht schon ganz unten'); return; }
  const um = vis.slice(); const t = um[pos]; um[pos] = um[j]; um[j] = t;
  um.forEach((x,k)=>{ const key = rubKey(x.r, x.i); RUBE[key] = Object.assign({}, RUBE[key], { ord:k }); });
  saveRUBE(); edZeichnen();
}
function edAbschnittNeu(ri){
  const inp = $('edAbs-'+ri); const name = (inp && inp.value || '').trim();
  if(!name){ toast('Bitte einen Namen für den Abschnitt', true); return; }
  if(edIstMatGer(+ri)){
    if(typeof addUkSectionName==='function') addUkSectionName(+ri, name);
    ED.ziel = { ri:+ri, g:name };
    edZeichnen();
  } else {
    const kopf = makeAddEntry({ aid:newAid(), name, nat:'ueberschrift' });
    edEinsetzen({ ri:+ri, g:'', index:edListe(+ri).length }, [kopf]);
    ED.ziel = { ri:+ri, g:kopf._aid };
    edZeichnen();
  }
}

/* ═══════════ 6. Aus der Bibliothek ═══════════ */

function edNatFuer(ri){ return (curStd.rubriken[ri] && curStd.rubriken[ri].typ==='geraete') ? 'geraet' : 'material'; }
/* Eine Zeile, die auf ein PRODUKT zeigt — nicht auf ein Wort. Der Name kommt
   lebendig vom Produkt (produktNameFuer, features/produkt.js). */
function edEintragProdukt(id, ri){
  const r = GTINDB[id]; if(!r) return null;
  const e = makeAddEntry({ aid:newAid(), name:(r.name||r.ref||id), nat:edNatFuer(ri) });
  e.material_key = 'produkt:'+id;
  e.produkt = id;
  if(typeof matLinkTo==='function') matLinkTo(e.material_key, id);
  return e;
}
function edEintragGeraet(k, ri){
  const g = (typeof GERAETE!=='undefined' && GERAETE[k]) || null; if(!g) return null;
  const e = makeAddEntry({ aid:newAid(), name:(g.name||k), nat:'geraet' });
  e.material_key = k;
  return e;
}
function edEintraegeBaustein(id, ri){
  const b = (typeof BAUSTEINE!=='undefined' ? BAUSTEINE : []).find(x=>x.id===id); if(!b) return [];
  return (b.zeilen||[]).filter(z=>z && z.text).map(z=>{
    const nat = z.natur || (edIstMatGer(ri) ? edNatFuer(ri) : 'hinweis');
    const e = makeAddEntry({ aid:newAid(), name:z.text, menge:z.menge||'', nat, uk:(edIstMatGer(ri)?(z.uk||''):'') });
    return e;
  });
}
function edEintragFrei(){
  const t = ($('edFreiText')||{}).value || ''; const nat = ($('edFreiNat')||{}).value || 'material';
  const name = t.trim(); if(!name){ toast('Bitte einen Text eingeben', true); return null; }
  return makeAddEntry({ aid:newAid(), name, nat });
}
/* Rubrik eines ANDEREN Standards als Vorlage: alle Zeilen kopieren (neue
   Kennungen — die Kopie ist ab jetzt eigenständig). */
function edEintraegeVorlage(sid, ri){
  const quelle = ADDITIONS.entries[sid+'|'+ri] || [];
  return quelle.map(e=>Object.assign(JSON.parse(JSON.stringify(e)), { _aid:newAid(), seg:null }));
}

/* Ankreuzen: Ist das Produkt im Ziel? */
function edProduktImZiel(id){
  if(!ED || !ED.ziel) return false;
  return edListe(ED.ziel.ri).some(e=>e.produkt===id);
}
function edProduktImStandard(id){
  return edRubriken().some(({i})=>edListe(i).some(e=>e.produkt===id));
}
function edKreuz(id, an){
  if(!ED || !ED.ziel) return;
  const ri = ED.ziel.ri;
  if(an){
    if(edProduktImZiel(id)) return;
    const e = edEintragProdukt(id, ri); if(!e) return;
    edEinsetzen({ ri, g:ED.ziel.g, ende:true }, [e]);
    edHinweisZubehoer(id);
  } else {
    const weg = edListe(ri).filter(e=>e.produkt===id).map(e=>e._aid);
    if(!weg.length) return;
    edAnwenden({ [ri]:edListe(ri).filter(e=>weg.indexOf(e._aid)<0) });
  }
  edZeichnen();
}
/* Einfügen per Knopf (Geräte, Bausteine, Freitext, Vorlagen). */
function edDazu(art, id, zusatz){
  if(!ED || !ED.ziel) return;
  const ri = ED.ziel.ri;
  let neu = [];
  if(art==='geraet'){ const e = edEintragGeraet(id, ri); if(e) neu = [e]; }
  else if(art==='baustein') neu = edEintraegeBaustein(id, ri);
  else if(art==='frei'){ const e = edEintragFrei(); if(e){ neu = [e]; const t=$('edFreiText'); if(t) t.value=''; } }
  else if(art==='vorlage') neu = edEintraegeVorlage(id, +zusatz);
  else if(art==='produkt'){ const e = edEintragProdukt(id, ri); if(e) neu = [e]; }
  if(!neu.length) return;
  edEinsetzen({ ri, g:ED.ziel.g, ende:true }, neu);
  edZeichnen();
  toast(neu.length===1 ? 'Eingefügt' : (neu.length+' Zeilen eingefügt'));
}

/* Zubehör: Braucht ein Produkt etwas, das im Standard fehlt? Dann als
   Hinweis an der Zeile — und ein Tipp nimmt es gleich mit. Wie Zubehör in
   der Rüstliste erscheinen soll, ist bewusst noch offen. */
function edStandardProdukte(){ const ids = []; edRubriken().forEach(({i})=>edListe(i).forEach(e=>{ if(e.produkt) ids.push(e.produkt); })); return ids; }
function edFehlend(id){ return (typeof bzhFehlendesZubehoer==='function' && typeof GTINDB!=='undefined') ? bzhFehlendesZubehoer(GTINDB, id, edStandardProdukte()) : []; }
function edHinweisZubehoer(id){
  const f = edFehlend(id);
  if(f.length) setTimeout(()=>toast('🧩 '+bzhName(id)+' braucht dazu: '+f.map(bzhName).join(', ')+' — an der Zeile mit einem Tipp ergänzen'), 400);
}
function edZubehoerDazu(ri, aid, zielId){
  const e = edEintragProdukt(zielId, +ri); if(!e) return;
  const quelle = edListe(+ri).find(x=>x._aid===aid);
  const g = quelle ? (edIstMatGer(+ri) ? (canonUk(quelle, edCid(+ri, edListe(+ri).indexOf(quelle)))||'') : '') : '';
  edEinsetzen({ ri:+ri, g, nach:aid }, [e]);
  edZeichnen();
}
/* Beziehung aus der Zeile heraus festlegen (features/beziehungen.js). */
function edBeziehung(ri, aid, art){
  const e = edListe(+ri).find(x=>x._aid===aid); if(!e) return;
  if(typeof bzhAusZeile==='function') bzhAusZeile(e.material_key, art, edZeichnen);
}

/* ═══════════ 7. Zeichnen ═══════════ */

function edZeichnen(){
  const box = $('scr-editor'); if(!box || !ED) return;
  const links = $('edLinks'); const scrollL = links ? links.scrollTop : 0;
  const rechts = $('edRechts'); const scrollR = rechts ? rechts.scrollTop : 0;
  box.innerHTML = `<div class="ed-wrap">
    <aside class="ed-links" id="edLinks" aria-label="Bibliothek">${edBibliothekHTML()}</aside>
    <section class="ed-rechts" id="edRechts" aria-label="Standard">${edStandardHTML()}</section>
  </div>`;
  const l2 = $('edLinks'), r2 = $('edRechts');
  if(l2) l2.scrollTop = scrollL; if(r2) r2.scrollTop = scrollR;
}
function edBibliothekNeu(){ const l=$('edBibListe'); if(l) l.innerHTML = edBibListeHTML(); }

function edZielText(){
  if(!ED || !ED.ziel || !curStd.rubriken[ED.ziel.ri]) return '—';
  const r = curStd.rubriken[ED.ziel.ri];
  const g = edGruppen(ED.ziel.ri).find(x=>x.key===ED.ziel.g);
  return rubName(r, ED.ziel.ri) + (g && g.key ? ' › '+g.titel : '');
}
const ED_TABS = [
  { key:'material',  label:'📦 Material' },
  { key:'geraete',   label:'🖥 Geräte' },
  { key:'bausteine', label:'🧱 Bausteine' },
  { key:'frei',      label:'✍️ Freitext' },
  { key:'vorlagen',  label:'📋 Vorlagen' },
];
function edTab(t){ if(!ED) return; ED.tab = t; ED.q = ''; edZeichnen(); }
function edSuche(q){ if(!ED) return; ED.q = q||''; edBibliothekNeu(); }
const edSucheEntprellt = debounce(q=>edSuche(q), 200);

function edBibliothekHTML(){
  const tabs = ED_TABS.map(t=>`<button type="button" class="${ED.tab===t.key?'on':''}" aria-pressed="${ED.tab===t.key?'true':'false'}" data-t="${esc(t.key)}" onclick="edTab(this.dataset.t)">${esc(t.label)}</button>`).join('');
  const suche = (ED.tab==='material'||ED.tab==='geraete'||ED.tab==='bausteine')
    ? `<div class="std-search ed-suche"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><input type="search" value="${esc(ED.q)}" placeholder="Suchen …" oninput="edSucheEntprellt(this.value)" autocomplete="off"></div>` : '';
  return `<div class="ed-bib-kopf">
      <div class="ed-ziel">Ziel: <b>${esc(edZielText())}</b><span class="hint"> — rechts antippen, um es zu ändern</span></div>
      <div class="filter-row ed-tabs">${tabs}</div>${suche}</div>
    <div id="edBibListe">${edBibListeHTML()}</div>`;
}
function edGriff(art, id, label, zusatz){
  return `<button type="button" class="ed-griff" aria-label="Ziehen: ${esc(label)}" data-art="${esc(art)}" data-id="${esc(id)}" data-z="${esc(zusatz==null?'':String(zusatz))}" data-l="${esc(label)}" onpointerdown="edZugAusBib(event,this)">⠿</button>`;
}
function edBibListeHTML(){
  const q = (ED.q||'').trim().toLowerCase();
  if(ED.tab==='material'){
    const alle = Object.keys(GTINDB||{}).map(k=>GTINDB[k]).filter(Boolean);
    if(!alle.length) return `<div class="empty"><div class="ei">📦</div><h3>Noch kein Material</h3><p>Material entsteht über „📷 Material erfassen" (Scannen, Etikett, Produkt). Danach steht es hier zum Ankreuzen.</p>
      <button type="button" class="sheet-pick-btn" onclick="openScanHub()">📷 Material erfassen</button></div>`;
    const l = (typeof filterGtin==='function') ? filterGtin(alle, q) : alle;
    if(!l.length) return `<p class="hint ed-leerhinweis">Kein Treffer.</p>`;
    return l.slice().sort((a,b)=>String(a.name||a.ref||'').localeCompare(String(b.name||b.ref||''),'de')).map(r=>{
      const drin = edProduktImZiel(r.gtin), woanders = !drin && edProduktImStandard(r.gtin);
      const label = r.name||r.ref||r.gtin;
      return `<div class="ed-bib-item${drin?' drin':''}">
        <label class="ed-kreuz"><input type="checkbox" ${drin?'checked':''} data-id="${esc(r.gtin)}" onchange="edKreuz(this.dataset.id,this.checked)" aria-label="${esc(label)} im Ziel"></label>
        <span class="ed-thumb">${r.photo?`<img src="${esc(r.photo)}" alt="">`:'🏷️'}</span>
        <span class="ed-bib-txt"><span class="ed-bib-name">${esc(label)}</span><span class="ed-bib-sub">${esc([r.hersteller, r.ref?('REF '+r.ref):''].filter(Boolean).join(' · '))}${woanders?' · <span class="tag">schon im Standard</span>':''}</span></span>
        ${edGriff('produkt', r.gtin, label)}</div>`;
    }).join('');
  }
  if(ED.tab==='geraete'){
    const keys = Object.keys((typeof GERAETE!=='undefined'&&GERAETE)||{});
    const l = keys.map(k=>({ k, g:GERAETE[k] })).filter(x=>x.g && (!q || ((x.g.name||x.k)+' '+(x.g.hersteller||'')+' '+(x.g.saal||'')).toLowerCase().indexOf(q)>=0));
    if(!l.length) return `<div class="empty"><div class="ei">🖥</div><h3>${keys.length?'Kein Treffer':'Noch keine Geräte'}</h3><p>Geräte werden in „🧬 Material &amp; Einträge → 🖥 Geräte" angelegt.</p></div>`;
    return l.map(x=>`<div class="ed-bib-item"><span class="ed-thumb">🖥</span>
      <span class="ed-bib-txt"><span class="ed-bib-name">${esc(x.g.name||x.k)}</span><span class="ed-bib-sub">${esc([x.g.hersteller,x.g.saal].filter(Boolean).join(' · '))}</span></span>
      <button type="button" class="ed-plus" data-id="${esc(x.k)}" onclick="edDazu('geraet',this.dataset.id)" aria-label="Einfügen">＋</button>${edGriff('geraet', x.k, x.g.name||x.k)}</div>`).join('');
  }
  if(ED.tab==='bausteine'){
    const l = (typeof BAUSTEINE!=='undefined'?BAUSTEINE:[]).filter(b=>b && (!q || String(b.name||'').toLowerCase().indexOf(q)>=0));
    if(!l.length) return `<div class="empty"><div class="ei">🧱</div><h3>Noch keine Bausteine</h3><p>Bausteine sind wiederkehrende Folgen von Zeilen (z. B. „Tischvorbereitung"). Angelegt werden sie in der Verwaltung unter „Bausteine".</p></div>`;
    return l.map(b=>`<div class="ed-bib-item"><span class="ed-thumb">🧱</span>
      <span class="ed-bib-txt"><span class="ed-bib-name">${esc(b.name||'Baustein')}</span><span class="ed-bib-sub">${(b.zeilen||[]).length} Zeilen</span></span>
      <button type="button" class="ed-plus" data-id="${esc(b.id)}" onclick="edDazu('baustein',this.dataset.id)" aria-label="Einfügen">＋</button>${edGriff('baustein', b.id, b.name||'Baustein')}</div>`).join('');
  }
  if(ED.tab==='frei'){
    const nats = (typeof natList==='function') ? natList() : [];
    /* Die Art passt sich dem Ziel an: in „Ablauf" ist eine neue Zeile meist
       ein Schritt, kein Material. */
    const zr = ED.ziel && curStd.rubriken[ED.ziel.ri];
    const vorwahl = !zr ? 'material' : (zr.typ==='geraete' ? 'geraet' : (zr.typ==='material' ? 'material' : 'hinweis'));
    return `<div class="ed-frei">
      <div class="flabel">Neue Zeile</div>
      <input class="loc-input" id="edFreiText" placeholder="z. B. Patient aufklären · 2x Kompressen" onkeydown="if(event.key==='Enter')edDazu('frei','')">
      <select class="form-sel" id="edFreiNat">${nats.map(n=>`<option value="${esc(n.key)}"${n.key===vorwahl?' selected':''}>${esc((n.icon||'')+' '+n.label)}</option>`).join('')}</select>
      <div class="p-actions"><button class="btn btn-pri" onclick="edDazu('frei','')">＋ Ins Ziel</button></div>
      <p class="hint">Tipp: Für Material lieber das erfasste Produkt ankreuzen (Reiter 📦) — dann zeigt die Zeile auf das Produkt und nicht nur auf ein Wort.</p></div>`;
  }
  /* Vorlagen: Rubriken anderer eigener Standards. */
  const andere = (ADDITIONS.standards||[]).filter(s=>s.id!==ED.sid);
  if(!andere.length) return `<div class="empty"><div class="ei">📋</div><h3>Keine Vorlagen</h3><p>Sobald es weitere Standards gibt, lassen sich ihre Rubriken hier als Vorlage übernehmen.</p></div>`;
  return andere.map(s=>`<div class="ed-vorlage"><div class="ed-bib-name">${esc(s.titel)}</div>${(s.rubriken||[]).map((r,ri)=>{
      const n = (ADDITIONS.entries[s.id+'|'+ri]||[]).length; if(!n) return '';
      return `<div class="ed-bib-item"><span class="ed-bib-txt"><span>${esc(r.name)}</span><span class="ed-bib-sub">${n} Zeilen</span></span>
        <button type="button" class="ed-plus" data-id="${esc(s.id)}" data-z="${ri}" onclick="edDazu('vorlage',this.dataset.id,this.dataset.z)" aria-label="Übernehmen">＋</button>${edGriff('vorlage', s.id, s.titel+' › '+r.name, ri)}</div>`; }).join('')}</div>`).join('');
}

function edStandardHTML(){
  const s = curStd;
  let h = `<div class="ed-std-kopf"><div><b>${esc(stdTitel(s))}</b><span class="hint"> · ${esc(stdGruppe(s))}</span></div>
    <button class="btn btn-sec" onclick="edSchliessen()">✓ Fertig</button></div>`;
  edRubriken().forEach(({r,i})=>{
    const zielR = ED.ziel && ED.ziel.ri===i;
    const gruppen = edGruppen(i);
    const n = edListe(i).filter(e=>e.natur!=='ueberschrift').length;
    h += `<section class="ed-rub${zielR?' ziel':''}" data-ri="${i}">
      <header class="ed-rub-kopf">
        <span class="ed-rub-ico">${rubIconEff(r,i)}</span>
        <input class="ed-rub-name" value="${esc(rubName(r,i))}" data-ri="${i}" onchange="edRubrikUmbenennen(+this.dataset.ri,this.value)" aria-label="Name der Rubrik">
        <span class="ed-n">${n}</span>
        <button type="button" class="ed-mini" data-ri="${i}" onclick="edRubrikRang(+this.dataset.ri,-1)" aria-label="Rubrik nach oben">▲</button>
        <button type="button" class="ed-mini" data-ri="${i}" onclick="edRubrikRang(+this.dataset.ri,1)" aria-label="Rubrik nach unten">▼</button>
      </header>`;
    gruppen.forEach(g=>{
      const zielG = zielR && ED.ziel.g===g.key;
      const kopfZeile = g.kopf
        ? `<div class="ed-gruppe-kopf" data-ri="${i}" data-g="${esc(g.key)}" onclick="edZiel(this.dataset.ri,this.dataset.g)">
            <button type="button" class="ed-griff" aria-label="Abschnitt ziehen" data-ri="${i}" data-aid="${esc(g.kopf.e._aid)}" onpointerdown="event.stopPropagation();edZugAusZeile(event,this)">⠿</button>
            <span class="ed-g-titel">${esc(g.titel)}</span><span class="ed-n">${g.reihen.length}</span>
            <button type="button" class="ed-mini" data-ri="${i}" data-aid="${esc(g.kopf.e._aid)}" onclick="event.stopPropagation();edEntfernen(this.dataset.ri,this.dataset.aid)" aria-label="Überschrift entfernen (Zeilen bleiben)">✕</button></div>`
        : `<div class="ed-gruppe-kopf" data-ri="${i}" data-g="${esc(g.key)}" onclick="edZiel(this.dataset.ri,this.dataset.g)"><span class="ed-g-titel">${esc(g.titel)}</span><span class="ed-n">${g.reihen.length}</span></div>`;
      h += `<div class="ed-gruppe${zielG?' ziel':''}" data-ri="${i}" data-g="${esc(g.key)}">${kopfZeile}
        ${g.reihen.map(x=>edZeileHTML(i, x)).join('')}
        ${g.reihen.length?'':`<div class="ed-leer" data-ri="${i}" data-g="${esc(g.key)}" onclick="edZiel(this.dataset.ri,this.dataset.g)">hierher ziehen — oder links ankreuzen</div>`}
      </div>`;
    });
    h += `<div class="ed-abs-neu"><input class="loc-input" id="edAbs-${i}" placeholder="${edIstMatGer(i)?'Neuer Abschnitt (z. B. Schleusen)':'Neue Überschrift (z. B. Punktion)'}" data-ri="${i}" onkeydown="if(event.key==='Enter')edAbschnittNeu(this.dataset.ri)">
      <button type="button" class="btn btn-sec" data-ri="${i}" onclick="edAbschnittNeu(this.dataset.ri)">＋ ${edIstMatGer(i)?'Abschnitt':'Überschrift'}</button></div></section>`;
  });
  h += `<div class="ed-rub-neu"><div class="flabel">Neue Rubrik</div>
    <input class="loc-input" id="edRubName" placeholder="z. B. Medikamente">
    <select class="form-sel" id="edRubTyp"><option value="material">Material</option><option value="geraete">Geräte</option><option value="ablauf">Ablauf</option><option value="sonstige">Sonstiges</option></select>
    <button class="btn btn-sec" onclick="edRubrikNeu()">＋ Rubrik</button></div>`;
  return h;
}

function edZeileHTML(ri, x){
  const e = x.e, cid = x.cid;
  const nat = effNatur(e, cid); const info = natOf(nat);
  const verborgen = (typeof qeGet==='function' && qeGet(e,cid,'hidden')===true);
  const dn = qeGet(e,cid,'name');
  const name = (dn!==undefined) ? dn : ((typeof produktNameFuer==='function' && produktNameFuer(e)) || e.anzeige_text || e.roh_text || '');
  const mv = qeGet(e,cid,'mengeVal'); const menge = (mv!==undefined) ? mv : (e.menge||'');
  const prod = e.produkt && GTINDB[e.produkt];
  const fehlt = prod ? edFehlend(e.produkt) : [];
  const zub = fehlt.map(id=>`<button type="button" class="ed-zub" data-ri="${ri}" data-aid="${esc(e._aid)}" data-z="${esc(id)}" onclick="edZubehoerDazu(this.dataset.ri,this.dataset.aid,this.dataset.z)" title="Fehlt im Standard — antippen fügt es hinzu">🧩 braucht ${esc(bzhName(id))} ＋</button>`).join('');
  const bzh = (prod && typeof neuFrei==='function' && neuFrei('beziehungen'))
    ? `<button type="button" class="ed-mini" data-ri="${ri}" data-aid="${esc(e._aid)}" onclick="edBeziehung(this.dataset.ri,this.dataset.aid,'zubehoer')" title="Zubehör festlegen" aria-label="Zubehör festlegen">🧩</button>
       <button type="button" class="ed-mini" data-ri="${ri}" data-aid="${esc(e._aid)}" onclick="edBeziehung(this.dataset.ri,this.dataset.aid,'aufbereitung')" title="Aufbereitete Fassung festlegen" aria-label="Aufbereitung festlegen">♻️</button>` : '';
  return `<div class="ed-zeile${verborgen?' verborgen':''}" data-ri="${ri}" data-aid="${esc(e._aid)}" data-g="${esc(x.g||'')}" style="border-left-color:${esc(info.color||'#888')}">
    <button type="button" class="ed-griff" aria-label="Zeile ziehen" data-ri="${ri}" data-aid="${esc(e._aid)}" onpointerdown="edZugAusZeile(event,this)">⠿</button>
    <input class="ed-menge" value="${esc(menge)}" placeholder="Menge" data-ri="${ri}" data-aid="${esc(e._aid)}" onchange="edMenge(this.dataset.ri,this.dataset.aid,this.value)" aria-label="Menge">
    <span class="ed-name" data-ri="${ri}" data-aid="${esc(e._aid)}" ondblclick="edZeileBearbeiten(this.dataset.ri,this.dataset.aid)" title="Doppelklick: bearbeiten">${esc(info.icon||'')} ${esc(name)}${prod?' <span class="ed-prod" title="zeigt auf ein Produkt">🧬</span>':''}${verborgen?' <span class="hint">(ausgeblendet)</span>':''}</span>
    ${zub}${bzh}
    <button type="button" class="ed-mini" data-ri="${ri}" data-aid="${esc(e._aid)}" onclick="edSchritt(this.dataset.ri,this.dataset.aid,-1)" aria-label="Nach oben">▲</button>
    <button type="button" class="ed-mini" data-ri="${ri}" data-aid="${esc(e._aid)}" onclick="edSchritt(this.dataset.ri,this.dataset.aid,1)" aria-label="Nach unten">▼</button>
    <button type="button" class="ed-mini ed-weg" data-ri="${ri}" data-aid="${esc(e._aid)}" onclick="edEntfernen(this.dataset.ri,this.dataset.aid);edZeichnen()" aria-label="Zeile entfernen">✕</button>
  </div>`;
}
/* Doppelklick: das normale Eintragsformular — zurück geht es in den Editor. */
function edZeileBearbeiten(ri, aid){
  if(typeof openEntryForm!=='function') return;
  const sid = ED.sid;
  openEntryForm({ kind:'editAdd', sid, ri:+ri, aid, back:()=>edOeffnen(sid) });
}

/* ═══════════ 8. Ziehen ═══════════
   Zeiger-Ereignisse statt der Drag-and-Drop-Schnittstelle des Browsers: So
   geht es mit Maus, Stift und Finger gleich, und die Ereignisse hängen am
   DOKUMENT (siehe features/sortieren.js — ein umgehängter Knoten verliert
   seine Zeigerbindung). Ein schwebendes Schild folgt dem Zeiger; eine Linie
   zeigt, wo es landet. Esc bricht ab. */
function edZugAusZeile(ev, el){
  const ri = +el.dataset.ri, aid = el.dataset.aid;
  const f = edListe(ri).find(e=>e._aid===aid);
  edZugStart(ev, { art:'zeile', ri, aid }, f ? (f.anzeige_text||f.roh_text||'Zeile') : 'Zeile');
}
function edZugAusBib(ev, el){
  edZugStart(ev, { art:el.dataset.art, id:el.dataset.id, z:el.dataset.z }, el.dataset.l||'');
}
function edZugStart(ev, quelle, label){
  if(!ED || (ev.button!=null && ev.button>0)) return;
  ev.preventDefault();
  edZugAbbrechen();
  const geist = document.createElement('div');
  geist.className = 'ed-geist'; geist.textContent = label;
  document.body.appendChild(geist);
  const marker = document.createElement('div');
  marker.className = 'ed-marker'; marker.id = 'edMarker';
  document.body.appendChild(marker);
  ED.zug = { quelle, geist, marker, id:ev.pointerId, ziel:null, gruppeEl:null };
  document.body.classList.add('ed-zieht');
  document.addEventListener('pointermove', edZugBewegen, { passive:false });
  document.addEventListener('pointerup', edZugEnde);
  document.addEventListener('pointercancel', edZugAbbrechen);
  document.addEventListener('keydown', edZugTaste);
  edZugBewegen(ev);
}
function edZugTaste(ev){ if(ev.key==='Escape') edZugAbbrechen(); }
function edZugAbmelden(){
  document.removeEventListener('pointermove', edZugBewegen);
  document.removeEventListener('pointerup', edZugEnde);
  document.removeEventListener('pointercancel', edZugAbbrechen);
  document.removeEventListener('keydown', edZugTaste);
}
function edZugAbbrechen(){
  edZugAbmelden();
  if(ED && ED.zug){
    const z = ED.zug;
    if(z.geist && z.geist.parentNode) z.geist.parentNode.removeChild(z.geist);
    if(z.marker && z.marker.parentNode) z.marker.parentNode.removeChild(z.marker);
    if(z.gruppeEl) z.gruppeEl.classList.remove('ed-drop');
    ED.zug = null;
  }
  if(typeof document!=='undefined' && document.body) document.body.classList.remove('ed-zieht');
}
function edZielAus(el, y){
  if(!el || !el.closest) return null;
  const rechts = el.closest('#edRechts'); if(!rechts) return null;
  const zeile = el.closest('.ed-zeile');
  if(zeile){ const r = zeile.getBoundingClientRect(); const vor = y < r.top + r.height/2;
    return vor ? { ri:+zeile.dataset.ri, g:zeile.dataset.g, vor:zeile.dataset.aid, el:zeile, kante:'oben' }
               : { ri:+zeile.dataset.ri, g:zeile.dataset.g, nach:zeile.dataset.aid, el:zeile, kante:'unten' }; }
  const gr = el.closest('.ed-gruppe');
  if(gr) return { ri:+gr.dataset.ri, g:gr.dataset.g, ende:true, el:gr, kante:'gruppe' };
  /* Über dem Kopf einer Rubrik: in den ersten Abschnitt; darunter (beim
     Feld für neue Abschnitte): ans Ende des letzten. */
  const rub = el.closest('.ed-rub');
  if(rub){
    const gs = rub.querySelectorAll('.ed-gruppe');
    const g = el.closest('.ed-rub-kopf') ? gs[0] : gs[gs.length-1];
    if(g) return { ri:+rub.dataset.ri, g:g.dataset.g, ende:true, el:g, kante:'gruppe' };
    return { ri:+rub.dataset.ri, g:'', ende:true, el:rub, kante:'gruppe' };
  }
  return null;
}
function edZugBewegen(ev){
  const z = ED && ED.zug; if(!z) return;
  if(ev.pointerId!==undefined && z.id!==undefined && ev.pointerId!==z.id) return;
  if(ev.cancelable) ev.preventDefault();
  z.geist.style.left = (ev.clientX+14)+'px'; z.geist.style.top = (ev.clientY+10)+'px';
  const ziel = edZielAus(document.elementFromPoint(ev.clientX, ev.clientY), ev.clientY);
  z.ziel = ziel;
  if(z.gruppeEl){ z.gruppeEl.classList.remove('ed-drop'); z.gruppeEl = null; }
  if(!ziel){ z.marker.style.display = 'none'; }
  else if(ziel.kante==='gruppe'){ z.marker.style.display = 'none'; ziel.el.classList.add('ed-drop'); z.gruppeEl = ziel.el; }
  else { const r = ziel.el.getBoundingClientRect();
    z.marker.style.display = 'block'; z.marker.style.left = r.left+'px'; z.marker.style.width = r.width+'px';
    z.marker.style.top = ((ziel.kante==='oben' ? r.top : r.bottom) - 2)+'px'; }
  /* Am Rand der rechten Spalte mitlaufen. */
  const rechts = $('edRechts');
  if(rechts){ const rr = rechts.getBoundingClientRect();
    if(ev.clientY < rr.top+40) rechts.scrollTop -= 14; else if(ev.clientY > rr.bottom-40) rechts.scrollTop += 14; }
}
function edZugEnde(ev){
  const z = ED && ED.zug; if(!z) return;
  if(ev && ev.pointerId!==undefined && z.id!==undefined && ev.pointerId!==z.id) return;
  const ziel = z.ziel, q = z.quelle;
  edZugAbbrechen();
  if(!ziel) return;
  const zielRein = { ri:ziel.ri, g:ziel.g, vor:ziel.vor, nach:ziel.nach, ende:ziel.ende };
  if(q.art==='zeile'){
    /* Auf sich selbst (oder, bei einem Abschnitt, in den eigenen Block) —
       das ist kein Zug. */
    const block = edBlock(q.ri, q.aid);
    if(block.indexOf(ziel.vor)>=0 || block.indexOf(ziel.nach)>=0) return;
    if(ziel.ende && q.ri===ziel.ri && String(ziel.g)===String(q.aid)) return;
    if(edVerschieben(q.ri, q.aid, zielRein)) toast('Verschoben');
  } else {
    let neu = [];
    if(q.art==='produkt'){ const e = edEintragProdukt(q.id, ziel.ri); if(e) neu = [e]; }
    else if(q.art==='geraet'){ const e = edEintragGeraet(q.id, ziel.ri); if(e) neu = [e]; }
    else if(q.art==='baustein') neu = edEintraegeBaustein(q.id, ziel.ri);
    else if(q.art==='vorlage') neu = edEintraegeVorlage(q.id, +q.z);
    if(!neu.length) return;
    edEinsetzen(zielRein, neu);
    if(q.art==='produkt') edHinweisZubehoer(q.id);
    toast(neu.length===1 ? 'Eingefügt' : (neu.length+' Zeilen eingefügt'));
  }
  edZeichnen();
}
