/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — DUPLIZIEREN (Standards & Anleitungen)

   Zweck: Ein neuer Standard entsteht in der Praxis fast nie auf einem weißen
   Blatt, sondern aus einem bestehenden. „VVI-ICD" → „DDD-ICD" ist zu 80 %
   dasselbe. Wer das abtippen muss, legt keine neuen Standards an.

   ── Die fünf Eigenschaften, die eine brauchbare Kopie haben MUSS ──

   1. VOLLSTÄNDIG UNABHÄNGIG. Nach dem Duplizieren gibt es keine Verbindung
      mehr zum Original. Ändert jemand später das Original, ändert sich die
      Kopie NICHT — und umgekehrt. Für ein SOP ist alles andere gefährlich.

   2. SIE SIEHT AUS WIE DAS ORIGINAL. Ein Eintrag zeigt selten seinen
      Rohtext: Name, Menge, Größen, Kategorie und Unterkategorie können durch
      Regeln und Anpassungen überlagert sein. Kopiert wird deshalb der
      EFFEKTIVE Stand — das, was man auf dem Bildschirm sieht.

   3. ALLES IST ECHT LÖSCHBAR. Am Original kann man Rubriken und Einträge nur
      AUSBLENDEN (die Basis-Daten bleiben unangetastet — das ist bei den
      importierten Standards richtig so). In einer Kopie wäre das falsch: Was
      man beim Aufbau eines neuen Standards wegwirft, soll weg sein. Deshalb
      ist die Kopie ein vollwertiger eigener Standard, in dem Löschen wirklich
      löscht.

   4. KEINE GESCHICHTE WIRD MITKOPIERT. Häkchen, Nutzungszähler, Favoriten,
      Prüf-Vermerke, Freigabe und Version bleiben zurück. Eine Kopie ist ein
      ENTWURF, kein freigegebenes Dokument. Alles andere wäre eine
      Freigabe-Fälschung.

   5. RUBRIK-VORLAGEN WERDEN AUFGELÖST. Eine Rubrik mit Geltungsbereich
      („erscheint in allen Standards der Gruppe X") darf in der Kopie KEINE
      Vorlage bleiben — sonst würde ein Umbenennen oder Löschen in der Kopie
      auf fremde Standards durchschlagen. In der Kopie wird daraus eine ganz
      normale eigene Rubrik.

   Was mitkommt: Struktur, Texte, Mengen, Größen, Kategorien, Unterkategorien,
   Hervorhebungen, Farben, „Warum"-Begründungen, Synonyme, Material-
   Verknüpfungen (damit die Material-Quersuche die Kopie sofort findet) und
   die Arzt-Varianten.

   Für Anleitungen gilt dasselbe, nur einfacher: Anleitungen sind ohnehin
   immer App-eigen, dort ist Löschen schon immer echtes Löschen.
   ───────────────────────────────────────────────────────────── */

/* ===== Reine, testbare Helfer ===== */

/* Titel einer Kopie, ohne Dubletten: „Kopie von X", dann „… (2)", „… (3)".
   Rein & testbar. */
function dupTitel(basis, vorhandene){
  const b=String(basis==null?'':basis).trim() || 'Ohne Titel';
  const genommen=new Set((vorhandene||[]).map(t=>String(t==null?'':t).trim().toLowerCase()));
  let kand='Kopie von '+b;
  if(!genommen.has(kand.toLowerCase())) return kand;
  for(let n=2;n<200;n++){ const k=kand+' ('+n+')'; if(!genommen.has(k.toLowerCase())) return k; }
  return kand+' ('+Date.now().toString(36)+')';
}

/* Strukturelle Tiefkopie (nur JSON-Daten — genau das, was hier vorkommt).
   Bewusst ohne structuredClone: die Kopie soll GARANTIERT frei von
   Verweisen auf die Basisdaten sein, auch bei exotischen Eingaben. Rein. */
function dupDeep(x){
  if(x===null || typeof x!=='object') return x;
  if(Array.isArray(x)) return x.map(dupDeep);
  const out={}; Object.keys(x).forEach(k=>{ out[k]=dupDeep(x[k]); });
  return out;
}

/* Neue, kollisionsfreie Kennung. */
function dupNewId(praefix){ return (praefix||'d')+Date.now().toString(36)+Math.floor(Math.random()*100000).toString(36); }

/* Zieht positionsabhängige Overlay-Schlüssel nach, wenn in einem eigenen
   Standard ein Eintrag WIRKLICH gelöscht wurde.

   Hintergrund: Eine cid ist „<std>|<rubrik>|<abschnitt>|<index>". Löscht man
   den Eintrag an Index 3, rutschen 4,5,6 … eine Position nach vorn — ihre
   Anpassungen (Name, Farbe, Häkchen …) würden sonst am falschen Eintrag
   kleben. Diese Funktion bildet eine Schlüssel-Map auf die neuen Indizes ab:
   der gelöschte Schlüssel fällt weg, alle dahinter rücken um eins auf.
   Rein & testbar. */
function dupCidShift(map, sid, ri, si, geloeschtEi){
  const out={};
  const praefix=sid+'|'+ri+'|'+si+'|';
  Object.keys(map||{}).forEach(k=>{
    if(k.indexOf(praefix)!==0){ out[k]=map[k]; return; }
    const rest=k.slice(praefix.length);
    const ei=parseInt(rest,10);
    if(!/^\d+$/.test(rest) || !isFinite(ei)){ out[k]=map[k]; return; }
    if(ei===geloeschtEi) return;                       /* der gelöschte selbst */
    out[praefix+(ei>geloeschtEi?(ei-1):ei)]=map[k];
  });
  return out;
}

/* Zählt, was eine Kopie umfasst — für die Rückmeldung an den Nutzer. Rein. */
function dupZaehlung(rubriken){
  let rub=0, eintraege=0;
  (rubriken||[]).forEach(r=>{ rub++;
    (r.sub_bereiche||[]).forEach(sb=>{ eintraege+=(sb.eintraege||[]).length; }); });
  return { rubriken:rub, eintraege };
}

/* ===== Den EFFEKTIVEN Stand eines Standards einfrieren ===== */

/* Eigenschaften, die nur als Overlay existieren (kein Feld am Eintrag). Sie
   werden für die neue cid übernommen, damit die Kopie identisch aussieht. */
const DUP_OVERLAY_PROPS=['important','color','why','synonyms','zusatz','mengeHi'];

/* Baut aus einem Standard die EFFEKTIVE Rubriken-Struktur (das, was man auf
   dem Bildschirm sieht) und liefert nebenbei die Zuordnung alte cid → neue
   cid, damit der Aufrufer Overlays und Varianten umhängen kann. */
function stdEffektiv(std, neueSid){
  const paare=[];                       /* {altCid, neuCid} je kopiertem Eintrag */
  const rubriken=[];
  const sichtbar=(std.rubriken||[]).map((r,i)=>({r,i}))
    .filter(x=>!rubHidden(x.r,x.i,std))
    .sort((a,b)=>rubOrd(a.r,a.i,std)-rubOrd(b.r,b.i,std));

  sichtbar.forEach(({r,i})=>{
    const neuR={ name:rubName(r,i,std), typ:r.typ||'sonstige', sub_bereiche:[] };
    const neueRi=rubriken.length;

    (r.sub_bereiche||[]).forEach((sb,si)=>{
      const neuSb={ name:sb.name||null, eintraege:[] };
      const neueSi=neuR.sub_bereiche.length;
      (sb.eintraege||[]).forEach((e,ei)=>{
        const altCid=cidOf(std.id, i, si, ei);
        /* Eigenschaft 4: Ausgeblendetes wandert nicht mit — wer es
           ausgeblendet hat, wollte es nicht sehen. */
        if(qeGet(e, altCid, 'hidden')===true) return;
        const neuE=dupEintrag(e, altCid);
        const neuCid=cidOf(neueSid, neueRi, neueSi, neuSb.eintraege.length);
        neuSb.eintraege.push(neuE);
        paare.push({ alt:altCid, neu:neuCid, e });
      });
      neuR.sub_bereiche.push(neuSb);
    });

    /* Alt-Einträge aus dem früheren „NEW"-Topf gehören sichtbar dazu. */
    if(typeof NEW!=='undefined' && Array.isArray(NEW)){
      const key=r.__nrid?('nr:'+r.__nrid):i;
      const alt=NEW.filter(n=>n.std===std.id && String(n.rub)===String(key));
      if(alt.length){
        if(!neuR.sub_bereiche.length) neuR.sub_bereiche.push({name:null,eintraege:[]});
        const ziel=neuR.sub_bereiche[0];
        const neueSi=0;
        alt.forEach(n=>{
          const altCid='new|'+n.id;
          const e=newToEntry(n);
          if(qeGet(e, altCid, 'hidden')===true) return;
          const neuE=dupEintrag(e, altCid);
          const neuCid=cidOf(neueSid, neueRi, neueSi, ziel.eintraege.length);
          ziel.eintraege.push(neuE);
          paare.push({ alt:altCid, neu:neuCid, e });
        });
      }
    }
    if(!neuR.sub_bereiche.length) neuR.sub_bereiche.push({name:null,eintraege:[]});
    rubriken.push(neuR);
  });
  return { rubriken, paare };
}

/* Ein einzelner Eintrag mit eingefrorenen effektiven Werten (Eigenschaft 2). */
function dupEintrag(e, altCid){
  const n=dupDeep(e);
  const nimm=(prop, fallback)=>{ const v=qeGet(e, altCid, prop); return (v===undefined)?fallback:v; };
  n.anzeige_text = nimm('name', e.anzeige_text);
  n.roh_text     = n.anzeige_text;             /* der Rohtext des Originals ist für die Kopie ohne Wert */
  n.menge        = nimm('mengeVal', e.menge);
  const gr       = nimm('groessen', e.groessen);
  n.groessen     = Array.isArray(gr)?dupDeep(gr):(e.groessen||[]);
  const sp       = nimm('spez', e.spezifikation);
  n.spezifikation= (sp===undefined?null:sp);
  /* Kategorie & Unterkategorie aufgelöst festschreiben. */
  try{ n.natur = effNatur(e, altCid) || e.natur; }catch(err){ n.natur = e.natur; }
  n.natur_manuell = null;
  try{ const uk=rawUk(e, altCid); n.unterkategorie = (uk===undefined?e.unterkategorie:uk); }
  catch(err){ n.unterkategorie = e.unterkategorie; }
  /* Herkunftsmerkmale der Erkennung sind für eine Kopie ohne Bedeutung. */
  n.natur_konfidenz='hoch'; n.natur_merkmale=[];
  /* Kennzeichen des Quell-Systems abstreifen — die Kopie ist app-eigen. */
  delete n._added; delete n._aid; delete n.__new;
  return n;
}

/* ===== Standard duplizieren ===== */

function stdDuplicate(sid, titel, gruppe){
  const src=(typeof DB!=='undefined'&&DB) ? DB.standards.find(s=>s.id===sid) : null;
  if(!src) return null;
  const neuId=dupNewId('k');
  const neueSid='ns:'+neuId;
  const { rubriken, paare } = stdEffektiv(src, neueSid);

  /* Eigenschaft 3: Die Kopie ist ein vollwertiger eigener Standard mit
     EIGENER Struktur — deshalb trägt der NEWSTD-Eintrag seine Rubriken
     selbst (siehe newStdToObj). Erst dadurch ist echtes Löschen möglich. */
  NEWSTD.push({ id:neuId, titel:(titel||'').trim()||dupTitel(stdTitel(src), DB.standards.map(stdTitel)),
    gruppe:(gruppe||'').trim()||stdGruppe(src)||'EIGENE',
    rubriken, kopieVon:sid, kopieVonTitel:stdTitel(src), erstelltAm:new Date().toISOString() });
  saveNEWSTD();

  /* Overlays der EINZELNEN STELLE mitnehmen (Hervorhebung, Farbe, Warum,
     Synonyme, Zusatzfelder, Mengen-Hervorhebung). Material-weite Regeln
     werden bewusst NICHT eingefroren: sie greifen über den material_key
     weiterhin von selbst — sonst würde die Kopie von künftigen
     Material-Änderungen abgeschnitten. */
  paare.forEach(({alt, neu, e})=>{
    const ziel={};
    DUP_OVERLAY_PROPS.forEach(p=>{ const v=qeGet(e, alt, p); if(v!==undefined && v!==null && v!=='') ziel[p]=dupDeep(v); });
    if(Object.keys(ziel).length) QE.cid[neu]=ziel;
  });
  saveQE();

  /* Arzt-Varianten mitnehmen (sie gehören zum Inhalt des Standards). */
  if(typeof VARIANTS!=='undefined' && VARIANTS && VARIANTS.data){
    let ver=false;
    Object.keys(VARIANTS.data).forEach(arzt=>{
      const d=VARIANTS.data[arzt]; if(!d) return;
      if(d.qe){ paare.forEach(({alt,neu})=>{ if(d.qe[alt]){ d.qe[neu]=dupDeep(d.qe[alt]); ver=true; } }); }
      if(d.add && d.add[sid]){ d.add[neueSid]=dupDeep(d.add[sid]); ver=true; }
    });
    if(ver && typeof saveVariants==='function') saveVariants();
  }

  rebuildDB();
  if(typeof buildMaterialIndex==='function') buildMaterialIndex();
  if(typeof computeUkList==='function') computeUkList();
  return neueSid;
}

/* ===== Anleitung duplizieren ===== */
function guideDuplicate(gid, titel){
  const g=(typeof guideById==='function')?guideById(gid):null;
  if(!g) return null;
  const neu=dupDeep(g);
  neu.id=dupNewId('g');
  neu.titel=(titel||'').trim() || dupTitel(g.titel, GUIDES.map(x=>x.titel));
  /* Eigenschaft 4: Schritte bekommen frische Kennungen, damit die Häkchen des
     Originals nicht mitkommen (sie hängen an <Anleitung>|<Schritt>). */
  neu.schritte=(neu.schritte||[]).map(s=>Object.assign({}, s, { id:dupNewId('s') }));
  neu.kopieVon=gid; neu.erstelltAm=new Date().toISOString();
  GUIDES.push(neu); saveGuides();
  return neu.id;
}

/* ===== Echtes Löschen & Hinzufügen in eigenen Standards ===== */

/* Der NEWSTD-Datensatz zu einer Standard-Kennung („ns:…") oder null. */
function ownStd(sid){
  if(!sid || String(sid).indexOf('ns:')!==0) return null;
  const nid=String(sid).slice(3);
  return (typeof NEWSTD!=='undefined'?NEWSTD:[]).find(x=>x.id===nid) || null;
}
/* Trägt dieser Standard seine Struktur selbst? Nur dann ist echtes Löschen
   möglich (Alt-Bestand ohne `rubriken` behält das feste Gerüst). */
function ownHatStruktur(sid){ const n=ownStd(sid); return !!(n && Array.isArray(n.rubriken)); }

/* Eintrag WIRKLICH löschen (nur in eigenen Standards). Zieht die
   positionsabhängigen Overlays nach, damit nichts verrutscht. */
function ownDeleteEntry(cid){
  const p=String(cid||'').split('|');
  if(p.length!==4) return false;
  const sid=p[0], ri=+p[1], si=+p[2], ei=+p[3];
  const n=ownStd(sid); if(!n || !Array.isArray(n.rubriken)) return false;
  let liste;
  try{ liste=n.rubriken[ri].sub_bereiche[si].eintraege; }catch(err){ return false; }
  if(!Array.isArray(liste) || !liste[ei]) return false;
  liste.splice(ei,1);
  saveNEWSTD();
  /* Alle positionsabhängigen Töpfe nachziehen. */
  QE.cid   = dupCidShift(QE.cid,   sid, ri, si, ei); saveQE();
  overrides= dupCidShift(overrides,sid, ri, si, ei); saveJSON('hkl_overrides',overrides);
  reassign = dupCidShift(reassign, sid, ri, si, ei); saveJSON('hkl_reassign',reassign);
  reviewed = dupCidShift(reviewed, sid, ri, si, ei); saveJSON('hkl_reviewed',reviewed);
  if(typeof checks!=='undefined'){ checks=dupCidShift(checks, sid, ri, si, ei); if(typeof saveChecks==='function') saveChecks(); }
  if(typeof VARIANTS!=='undefined' && VARIANTS && VARIANTS.data){
    Object.keys(VARIANTS.data).forEach(a=>{ const d=VARIANTS.data[a]; if(d&&d.qe) d.qe=dupCidShift(d.qe, sid, ri, si, ei); });
    if(typeof saveVariants==='function') saveVariants();
  }
  rebuildDB();
  if(typeof buildMaterialIndex==='function') buildMaterialIndex();
  return true;
}

/* Rubrik (Segment) WIRKLICH löschen — samt ihrer Einträge. */
function ownDeleteRubrik(sid, ri){
  const n=ownStd(sid); if(!n || !Array.isArray(n.rubriken)) return false;
  if(ri<0 || ri>=n.rubriken.length) return false;
  n.rubriken.splice(ri,1); saveNEWSTD();
  /* Overlays der gelöschten und der nachrückenden Rubriken bereinigen: die
     Rubrik-Indizes verschieben sich, deshalb wird für diesen Standard alles
     Positionsabhängige verworfen statt falsch zugeordnet. */
  const wegRaeumen=(map)=>{ const out={}; Object.keys(map||{}).forEach(k=>{ if(k.indexOf(sid+'|')!==0) out[k]=map[k]; }); return out; };
  QE.cid   = wegRaeumen(QE.cid);   saveQE();
  overrides= wegRaeumen(overrides);saveJSON('hkl_overrides',overrides);
  reassign = wegRaeumen(reassign); saveJSON('hkl_reassign',reassign);
  reviewed = wegRaeumen(reviewed); saveJSON('hkl_reviewed',reviewed);
  if(typeof checks!=='undefined'){ checks=wegRaeumen(checks); if(typeof saveChecks==='function') saveChecks(); }
  Object.keys(RUBE||{}).forEach(k=>{ if(k.indexOf(sid+'|')===0) delete RUBE[k]; }); saveRUBE();
  rebuildDB();
  if(typeof buildMaterialIndex==='function') buildMaterialIndex();
  return true;
}

/* Rubrik (Segment) hinzufügen — direkt in die eigene Struktur, nicht als
   Vorlage. Damit ist sie sofort wieder echt löschbar. */
function ownAddRubrik(sid, name, typ){
  const n=ownStd(sid); if(!n || !Array.isArray(n.rubriken)) return false;
  const t=(typ==='material'||typ==='geraete'||typ==='ablauf')?typ:'sonstige';
  n.rubriken.push({ name:(name||'Neues Segment').trim()||'Neues Segment', typ:t,
    sub_bereiche:[{name:null,eintraege:[]}] });
  saveNEWSTD(); rebuildDB();
  return true;
}

/* ═══════════════════════════════════════════════════════════════
   OBERFLÄCHE
   Bewusst als Formular statt prompt(): In installierten PWAs sind
   prompt()-Dialoge unzuverlässig, und für „schnell einen neuen Standard
   bauen" braucht man Titel UND Gruppe in einem Rutsch.
   ═══════════════════════════════════════════════════════════════ */

/* Standard duplizieren — Titel und Gruppe vorbelegt, ein Tipp auf Speichern. */
function openDupStdForm(sid){
  if(!ADMIN){ promptLoginThen(()=>openDupStdForm(sid)); return; }
  const s=sid?DB.standards.find(x=>x.id===sid):curStd;
  if(!s){ toast('Kein Standard ausgewählt',true); return; }
  const vorschlag=dupTitel(stdTitel(s), DB.standards.map(stdTitel));
  const z=dupZaehlung(stdEffektiv(s,'vorschau').rubriken);
  const gruppen=[...new Set(DB.standards.map(stdGruppe).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de'));
  $('scr-form').innerHTML=`<div class="pcard">
    <div class="pc-name">⧉ Standard duplizieren</div>
    <div class="scope-note">Es entsteht eine <b>vollständig eigenständige Kopie</b> von „${esc(stdTitel(s))}“.
      Spätere Änderungen am Original wirken sich <b>nicht</b> auf die Kopie aus – und umgekehrt.</div>
    <div class="dup-sum">Übernommen werden <b>${z.rubriken} Segmente</b> mit <b>${z.eintraege} Einträgen</b>,
      so wie sie jetzt angezeigt werden (inklusive Anpassungen, Kategorien und Material-Verknüpfungen).</div>
    <div class="flabel" style="margin-top:12px">TITEL *</div>
    <input class="loc-input" id="dupTitel" value="${esc(vorschlag)}" placeholder="z. B. DDD-ICD Implantation">
    <div class="flabel">GRUPPE</div>
    <input class="loc-input" id="dupGruppe" value="${esc(stdGruppe(s)||'')}" list="dupGrpList" placeholder="Bereich in der Übersicht">
    <datalist id="dupGrpList">${gruppen.map(g=>`<option value="${esc(g)}">`).join('')}</datalist>
    <p class="hint"><b>Nicht</b> mitkopiert werden Häkchen, Nutzungszahlen, Favoriten, Prüf-Vermerke
      sowie Version und Freigabe – die Kopie startet als Entwurf. In der Kopie ist Löschen
      <b>echtes Löschen</b>: Was du nicht brauchst, wirfst du einfach weg.</p>
    <div class="p-actions">
      <button class="btn btn-sec" onclick="closeForm()">Abbrechen</button>
      <button class="btn btn-pri" data-s="${esc(s.id)}" onclick="dupStdSave(this.dataset.s)">Kopie anlegen</button>
    </div></div>`;
  formCtx={desc:{kind:'dupstd'}, back:()=>openStandard(s.id,true)};
  show('scr-form'); setBar('Duplizieren', stdTitel(s), true);
}
function dupStdSave(sid){
  const titel=(($('dupTitel')||{}).value||'').trim();
  if(!titel){ toast('Bitte einen Titel angeben.',true); return; }
  const gruppe=(($('dupGruppe')||{}).value||'').trim();
  const neu=stdDuplicate(sid, titel, gruppe);
  if(!neu){ toast('Duplizieren fehlgeschlagen.',true); return; }
  formCtx=null;
  const z=dupZaehlung((ownStd(neu)||{}).rubriken);
  toast('Kopie angelegt – '+z.rubriken+' Segmente, '+z.eintraege+' Einträge. Jetzt anpassen.');
  openStandard(neu, true);
}

/* Titel & Gruppe ändern — ersetzt die zwei prompt()-Dialoge. */
function openStdRenameForm(){
  if(!ADMIN||!curStd){ return; }
  const s=curStd;
  const gruppen=[...new Set(DB.standards.map(stdGruppe).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de'));
  $('scr-form').innerHTML=`<div class="pcard">
    <div class="pc-name">Titel &amp; Gruppe</div>
    <div class="flabel">TITEL *</div>
    <input class="loc-input" id="stdTitelInp" value="${esc(stdTitel(s))}">
    <div class="flabel">GRUPPE</div>
    <input class="loc-input" id="stdGruppeInp" value="${esc(stdGruppe(s)||'')}" list="stdGrpList">
    <datalist id="stdGrpList">${gruppen.map(g=>`<option value="${esc(g)}">`).join('')}</datalist>
    <div class="flabel">BESCHREIBUNG (optional)</div>
    <textarea class="loc-input" id="stdBeschrInp" rows="4" placeholder="Kurz: worum geht es in diesem Standard? Erscheint oben im Kopf.">${esc((typeof stdBeschreibung==='function')?stdBeschreibung(s):'')}</textarea>
    <p class="hint">Gilt für alle Geräte. Die Quelldatei bleibt unverändert. Ob und wo die Beschreibung erscheint, steuert „🧱 Standardkopf" in der Verwaltung.</p>
    <div class="p-actions">
      <button class="btn btn-sec" onclick="closeForm()">Abbrechen</button>
      <button class="btn btn-pri" onclick="stdRenameSave()">Speichern</button>
    </div></div>`;
  formCtx={desc:{kind:'stdrename'}, back:()=>openStandard(s.id,true)};
  show('scr-form'); setBar('Titel & Gruppe', stdTitel(s), true);
}
function stdRenameSave(){
  if(!ADMIN||!curStd) return;
  const t=(($('stdTitelInp')||{}).value||'').trim();
  if(!t){ toast('Der Titel darf nicht leer sein.',true); return; }
  const g=(($('stdGruppeInp')||{}).value||'').trim();
  const b=(($('stdBeschrInp')||{}).value||'').trim();
  const s=curStd;
  /* Bei einem eigenen Standard direkt am Datensatz — sonst als Overlay.
     Die Beschreibung liegt IMMER in STDE: sie ist eine Angabe ZUM Standard,
     keine Struktur, und muss auch an Standards aus der Quelldatei hängen. */
  const own=ownStd(s.id);
  if(own){ own.titel=t; if(g) own.gruppe=g; saveNEWSTD(); rebuildDB(); }
  else { STDE[s.id]=Object.assign({},STDE[s.id],{titel:t, gruppe:g||stdGruppe(s)}); }
  const meta=Object.assign({}, STDE[s.id]);
  if(b) meta.beschreibung=b; else delete meta.beschreibung;
  STDE[s.id]=meta; saveSTDE();
  formCtx=null; toast('Standard aktualisiert'); openStandard(s.id,true);
}

/* Segment (Rubrik) in einem eigenen Standard hinzufügen. */
function ownAddRubrikUI(){
  if(!ADMIN||!curStd) return;
  if(!ownHatStruktur(curStd.id)){ toast('Nur in eigenen Standards möglich.',true); return; }
  const s=curStd;
  const typen=[['material','Material'],['geraete','Geräte & Saal'],['ablauf','Ablauf'],['sonstige','Sonstiges']];
  $('scr-form').innerHTML=`<div class="pcard">
    <div class="pc-name">＋ Segment hinzufügen</div>
    <div class="flabel">NAME *</div>
    <input class="loc-input" id="ownRubName" placeholder="z. B. Nachsorge">
    <div class="flabel">ART</div>
    <select class="form-sel" id="ownRubTyp" style="width:100%">${typen.map(t=>`<option value="${t[0]}">${esc(t[1])}</option>`).join('')}</select>
    <p class="hint">Das Segment gehört nur zu diesem Standard und lässt sich jederzeit wieder
      <b>endgültig löschen</b> – anders als bei den importierten Standards, wo nur ausgeblendet wird.</p>
    <div class="p-actions">
      <button class="btn btn-sec" onclick="closeForm()">Abbrechen</button>
      <button class="btn btn-pri" onclick="ownAddRubrikSave()">Anlegen</button>
    </div></div>`;
  formCtx={desc:{kind:'ownrub'}, back:()=>openStandard(s.id,true)};
  show('scr-form'); setBar('Segment hinzufügen', stdTitel(s), true);
}
function ownAddRubrikSave(){
  if(!ADMIN||!curStd) return;
  const name=(($('ownRubName')||{}).value||'').trim();
  if(!name){ toast('Bitte einen Namen angeben.',true); return; }
  const typ=(($('ownRubTyp')||{}).value||'sonstige');
  if(ownAddRubrik(curStd.id, name, typ)){ formCtx=null; toast('Segment „'+name+'" angelegt'); openStandard(curStd.id,true); }
}

/* Anleitung duplizieren — dieselbe Zusage, nur schlanker. */
function openDupGuideForm(gid){
  if(!ADMIN){ promptLoginThen(()=>openDupGuideForm(gid)); return; }
  const g=guideById(gid||(curGuide&&curGuide.id));
  if(!g){ toast('Keine Anleitung ausgewählt',true); return; }
  const vorschlag=dupTitel(g.titel, GUIDES.map(x=>x.titel));
  const n=(g.schritte||[]).length;
  $('scr-form').innerHTML=`<div class="pcard">
    <div class="pc-name">⧉ Anleitung duplizieren</div>
    <div class="scope-note">Es entsteht eine <b>eigenständige Kopie</b> von „${esc(g.titel)}“ mit
      <b>${n} Schritt${n===1?'':'en'}</b> – Texte, Fotos, Warnungen und Tipps inklusive.</div>
    <div class="flabel" style="margin-top:12px">TITEL *</div>
    <input class="loc-input" id="dupGTitel" value="${esc(vorschlag)}">
    <p class="hint">Die abgehakten Schritte des Originals kommen <b>nicht</b> mit – die Kopie startet frisch.</p>
    <div class="p-actions">
      <button class="btn btn-sec" onclick="closeForm()">Abbrechen</button>
      <button class="btn btn-pri" data-g="${esc(g.id)}" onclick="dupGuideSave(this.dataset.g)">Kopie anlegen</button>
    </div></div>`;
  formCtx={desc:{kind:'dupguide'}, back:()=>openGuide(g.id)};
  show('scr-form'); setBar('Duplizieren', g.titel||'Anleitung', true);
}
function dupGuideSave(gid){
  const titel=(($('dupGTitel')||{}).value||'').trim();
  if(!titel){ toast('Bitte einen Titel angeben.',true); return; }
  const neu=guideDuplicate(gid, titel);
  if(!neu){ toast('Duplizieren fehlgeschlagen.',true); return; }
  formCtx=null; toast('Kopie angelegt – jetzt anpassen.');
  openGuideEdit(neu);
}
