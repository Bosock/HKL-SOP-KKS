/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — RÜSTLISTE (Stufe 2.2)

   Die Frage, die im Labor vor jedem Eingriff gestellt wird, lautet nicht
   „was steht im Standard?", sondern:

       Was hole ich WOHER — und in welcher Reihenfolge?

   Der Standard beantwortet das nicht. Er ist nach der Word-Vorlage
   gegliedert: Rubriken wie im Dokument, Material gemischt aus Lager, Saal,
   Vorbereitungsraum und Reserve. Wer aufbaut, läuft deshalb mehrfach
   dieselben Wege.

   Diese Ansicht dreht denselben Bestand auf den Arbeitsablauf:

       🧺 AUS DEM LAGER      nach Standort gebündelt — ein Weg je Ort
       🩺 AUF DEN TISCH      was gerichtet wird
       📢 AUF ANSAGE         Reserve: erst öffnen, wenn es verlangt wird

   Woher die Zuordnung kommt, in dieser Reihenfolge:
     ① bestätigte Zerlegung (features/zerlegung.js) — Ort und Bedingung
        stehen dort als eigene Felder
     ② sonst die Unterkategorie des Eintrags, die den Ort im Namen trägt
        („Material aus dem Vorbereitungsraum", „Material auf Ansage")

   Punkt ② ist der Grund, warum die Rüstliste SOFORT nützt: Sie braucht keine
   Aufräumarbeit, sie liest die Ordnung, die in den Standards ohnehin schon
   steckt — nur bisher als Text und nicht als Ort.

   Die Häkchen sind DIESELBEN wie im Standard (checks[cid]). Wer beim Rüsten
   abhakt, hat es im Standard abgehakt. Zwei Listen zu führen wäre genau die
   Sorte Doppelarbeit, die diese Ansicht abschaffen soll.
   ───────────────────────────────────────────────────────────── */

let ruestSid = null;      /* Standard, dessen Rüstliste gerade offen ist */

/* ===== Reine Helfer ===== */

/* Wohin gehört eine Zeile? 'lager' | 'tisch' | 'ansage'
   Rein — bekommt alles Nötige übergeben. */
function ruestFach(ort, bedingung, unterkategorie){
  const uk = String(unterkategorie==null?'':unterkategorie).toLowerCase();
  if(bedingung) return 'ansage';
  if(uk.indexOf('ansage')>=0) return 'ansage';
  if(ort) return 'lager';
  if(uk.indexOf('lager')>=0 || uk.indexOf('vorbereitungsraum')>=0 || uk.indexOf('keller')>=0) return 'lager';
  return 'tisch';
}

/* Der Ort, unter dem eine Zeile gebündelt wird. Rein. */
function ruestOrt(ort, unterkategorie){
  if(ort) return ort;
  const uk = String(unterkategorie==null?'':unterkategorie).trim();
  if(!uk) return 'Ohne Angabe';
  /* „Material aus dem Vorbereitungsraum" → „Vorbereitungsraum" */
  const m = uk.match(/aus dem\s+(.+)$/i) || uk.match(/aus der\s+(.+)$/i);
  return m ? m[1].trim() : uk;
}

/* Baut die drei Fächer für einen Standard. Braucht DB/cidOf; sonst rein. */
function ruestBauen(sid){
  const s = (typeof DB!=='undefined' && DB && DB.standards)
    ? DB.standards.find(x=>x.id===sid) : null;
  const aus = { lager:{}, tisch:[], ansage:[], gesamt:0, offen:0 };
  if(!s) return aus;
  (s.rubriken||[]).forEach((r,ri)=>{
    if(r.typ!=='material' && r.typ!=='geraete') return;
    if(typeof rubHidden==='function' && rubHidden(r,ri,s)) return;
    (r.sub_bereiche||[]).forEach((sb,si)=>{ (sb.eintraege||[]).forEach((e,ei)=>{
      if(!e || e.ist_fliesstext || e.natur==='ueberschrift') return;
      const cid = cidOf(s.id,ri,si,ei);
      if(typeof qeGet==='function' && qeGet(e,cid,'hidden')===true) return;
      if(typeof varHidden==='function' && varHidden(cid)) return;
      const nat = (typeof effNatur==='function')?effNatur(e,cid):e.natur;
      if(typeof natOf==='function' && !natOf(nat).beschaffbar) return;

      const z = (typeof zerlFuer==='function') ? zerlFuer(e,cid) : null;
      const best = !!(z && z.quelle==='mensch');
      /* Eine bestätigte Tätigkeit wird nicht gerüstet — sie wird getan. */
      if(best && z.art==='taetigkeit') return;

      const name = (best && z.produkt) ? z.produkt.name
        : ((typeof qeGet==='function' && qeGet(e,cid,'name')!==undefined) ? qeGet(e,cid,'name') : e.anzeige_text);
      const menge = (typeof qeGet==='function' && qeGet(e,cid,'mengeVal')!==undefined) ? qeGet(e,cid,'mengeVal') : e.menge;
      const ort = best ? z.ort : null;
      const bed = best ? z.bedingung : null;
      const groesse = best ? z.groesse : null;

      const zeile = { cid, name, menge, groesse, bedingung:bed, nat,
        erledigt: !!(typeof checks!=='undefined' && checks[cid]) };
      aus.gesamt++; if(!zeile.erledigt) aus.offen++;

      const fach = ruestFach(ort, bed, e.unterkategorie);
      if(fach==='lager'){
        const o = ruestOrt(ort, e.unterkategorie);
        (aus.lager[o] = aus.lager[o] || []).push(zeile);
      } else aus[fach].push(zeile);
    }); });
  });
  return aus;
}

/* Kennzahlen für die Kopfzeile. */
function ruestZahlen(l){
  const orte = Object.keys(l.lager||{});
  const imLager = orte.reduce((n,o)=>n+l.lager[o].length,0);
  return { orte:orte.length, lager:imLager, tisch:(l.tisch||[]).length,
    ansage:(l.ansage||[]).length, gesamt:l.gesamt, offen:l.offen };
}

/* ===== Bildschirm ===== */
function openRuestliste(sid){
  ruestSid = sid || (typeof curStd!=='undefined' && curStd ? curStd.id : null);
  if(!ruestSid) return;
  renderRuestliste();
  show('scr-ruest');
  const s = DB.standards.find(x=>x.id===ruestSid);
  if(typeof setBar==='function') setBar('Rüstliste', s?stdTitel(s):'', true);
}

function ruestZeileHTML(z){
  const ico = (typeof natOf==='function') ? (natOf(z.nat).icon||'•') : '•';
  const farbe = `var(--n-${esc(z.nat)})`;
  return `<div class="rl-zeile${z.erledigt?' done':''}" data-cid="${esc(z.cid)}" onclick="ruestHaken(this.dataset.cid)" style="--e-col:${farbe}">
    <span class="rl-chk">✓</span>
    <span class="rl-menge">${z.menge?esc(z.menge):''}</span>
    <span class="rl-ico">${ico}</span>
    <span class="rl-name">${esc(z.name)}${z.groesse?`<span class="rl-gr">${esc(z.groesse)}</span>`:''}</span>
    ${z.bedingung?`<span class="rl-bed">${esc(z.bedingung)}</span>`:''}
  </div>`;
}

function renderRuestliste(){
  const box=$('scr-ruest'); if(!box || !ruestSid) return;
  const l = ruestBauen(ruestSid);
  const z = ruestZahlen(l);
  const s = DB.standards.find(x=>x.id===ruestSid);

  if(!z.gesamt){
    box.innerHTML=`<div class="empty"><div class="ei">🧺</div><h3>Nichts zu rüsten</h3>
      <p>In diesem Standard steht kein beschaffbares Material.</p></div>`;
    return;
  }

  let h=`<div class="banner"><h2>🧺 Rüstliste</h2>
    <p>Derselbe Standard, nach dem Arbeitsablauf sortiert: <b>erst holen, dann richten, Reserve zuletzt</b>. Die Häkchen sind dieselben wie im Standard — was Du hier abhakst, ist dort abgehakt.</p>
    <div class="rl-bilanz"><span><b>${z.offen}</b> offen von ${z.gesamt}</span>
      <span>${z.orte} Wege ins Lager</span><span>${z.tisch} auf den Tisch</span><span>${z.ansage} auf Ansage</span></div></div>`;

  /* ① Lager — nach Ort gebündelt, damit man je Ort EINEN Weg hat. */
  const orte = Object.keys(l.lager).sort((a,b)=>a.localeCompare(b,'de'));
  if(orte.length){
    h+=`<div class="rl-fach"><div class="rl-fach-t">🧺 Aus dem Lager holen</div>`;
    orte.forEach(o=>{
      const zeilen=l.lager[o];
      const offen=zeilen.filter(x=>!x.erledigt).length;
      h+=`<div class="rl-ort"><div class="rl-ort-t">${esc(o)}<span class="rl-ort-n">${offen?offen+' offen':'✓ vollständig'}</span></div>
        ${zeilen.map(ruestZeileHTML).join('')}</div>`;
    });
    h+=`</div>`;
  }
  /* ② Tisch */
  if(l.tisch.length){
    h+=`<div class="rl-fach"><div class="rl-fach-t">🩺 Auf den Tisch</div>${l.tisch.map(ruestZeileHTML).join('')}</div>`;
  }
  /* ③ Auf Ansage — bewusst zuletzt und optisch abgesetzt: Diese Dinge werden
        NICHT vorbereitet, sondern bereitgehalten. Wer sie mit rüstet, öffnet
        Material, das oft ungenutzt verworfen wird. */
  if(l.ansage.length){
    h+=`<div class="rl-fach rl-reserve"><div class="rl-fach-t">📢 Nur auf Ansage</div>
      <p class="rl-hinweis">Nicht vorbereiten — bereithalten. Erst öffnen, wenn es verlangt wird.</p>
      ${l.ansage.map(ruestZeileHTML).join('')}</div>`;
  }
  h+=`<div class="p-actions" style="margin-top:14px">
    <button class="btn btn-sec" data-s="${esc(ruestSid)}" onclick="openStandard(this.dataset.s)">Zum Standard</button>
    <button class="btn btn-sec" onclick="ruestDrucken()">🖨 Drucken</button>
  </div>`;
  box.innerHTML=h;
}

/* Abhaken — derselbe Speicher wie im Standard. */
function ruestHaken(cid){
  if(!cid || typeof checks==='undefined') return;
  if(checks[cid]) delete checks[cid]; else checks[cid]=true;
  if(typeof saveChecks==='function') saveChecks();
  renderRuestliste();
}

/* Druckfassung: dieselbe Gliederung, ohne Bedienelemente. */
function ruestDrucken(){
  const l=ruestBauen(ruestSid); const s=DB.standards.find(x=>x.id===ruestSid);
  const root=$('printRoot'); if(!root) return;
  const zeile=(x)=>`<div class="pr-z">☐ ${esc(x.menge||'')} ${esc(x.name)}${x.groesse?(' · '+esc(x.groesse)):''}${x.bedingung?(' — '+esc(x.bedingung)):''}</div>`;
  let h=`<h1>Rüstliste · ${esc(s?stdTitel(s):'')}</h1>`;
  const orte=Object.keys(l.lager).sort((a,b)=>a.localeCompare(b,'de'));
  if(orte.length){ h+=`<h2>Aus dem Lager holen</h2>`;
    orte.forEach(o=>{ h+=`<h3>${esc(o)}</h3>`+l.lager[o].map(zeile).join(''); }); }
  if(l.tisch.length) h+=`<h2>Auf den Tisch</h2>`+l.tisch.map(zeile).join('');
  if(l.ansage.length) h+=`<h2>Nur auf Ansage (bereithalten)</h2>`+l.ansage.map(zeile).join('');
  root.innerHTML=h;
  try{ window.print(); }catch(e){}
}
