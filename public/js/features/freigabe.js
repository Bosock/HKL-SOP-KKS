/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — FREIGABE MIT SIEGEL

   Die App konnte an einem Standard schon vorher „Version 1.2 · Freigegeben ·
   durch Frau X am 12.03." vermerken. Das ist genau so lange richtig, wie danach
   niemand etwas ändert — und geändert wird hier ununterbrochen: eine Menge im
   Schnellmenü, eine Unterkategorie, eine Regel mit Reichweite „🌐 alle", ein
   Baustein, der acht Standards auf einmal anfasst.

   Damit stand die gefährlichste Zeile der ganzen App im Kopf des Standards:
   ein Freigabevermerk, der etwas bestätigt, das es so nicht mehr gibt. Wer im
   Labor „Freigegeben" liest, verlässt sich darauf.

   ── Was dieser Baustein ändert ──
   Bei der Freigabe wird ein SIEGEL gezogen: ein Fingerabdruck dessen, was zu
   diesem Zeitpunkt im Standard steht — Zeile für Zeile, mit den WIRKSAMEN
   Werten (also nach Umbenennungen, Regeln, Bausteinen), nicht mit dem Rohtext.

   Danach lässt sich jederzeit vergleichen. Drei Antworten sind möglich:

       ✅ gültig      Inhalt ist unverändert seit der Freigabe
       ⚠️ überholt    seit der Freigabe wurde geändert — und zwar HIER
       📝 Entwurf     nie freigegeben (oder Freigabe zurückgenommen)

   Und — das ist der eigentliche Punkt — das steht nicht in der Verwaltung,
   sondern im Standard selbst, für ALLE sichtbar. Ein Vermerk, den nur die
   Leitung sieht, schützt niemanden.

   ── Was das Siegel NICHT ist ──
   Keine Unterschrift im Rechtssinn und kein Zugriffsschutz: Es ist im Browser
   gerechnet und liegt im geteilten Zustand. Es beantwortet genau eine Frage,
   die heute niemand beantworten kann — „ist das noch der Stand, der freigegeben
   wurde?" — und beantwortet sie ehrlich. Die technische Absicherung des
   Zugangs (Stufe 0) ist davon unberührt und weiterhin offen.

   ── Warum ein Fingerabdruck je Zeile und nicht einer fürs Ganze ──
   Ein einziger Hash sagt nur „irgendetwas ist anders". Eine Liste je Zeile sagt
   „diese drei Stellen sind anders" — und genau das braucht, wer die Freigabe
   erneuern soll. Zusätzlich zum Fingerabdruck wird eine kurze Beschriftung
   mitgeführt; nur so lässt sich auch benennen, was ENTFERNT wurde (dafür gibt
   es im aktuellen Stand ja keine Zeile mehr).
   ───────────────────────────────────────────────────────────── */

/* ═══════════ 1. Reine Helfer ═══════════ */

/* DJB2 → 8 Hexstellen. Kein kryptographischer Anspruch (siehe Kopf): Es geht
   um „hat sich etwas geändert?", nicht um Fälschungssicherheit. */
function frgHash(str){
  let h = 5381;
  const s = String(str==null?'':str);
  for(let i=0;i<s.length;i++) h = (((h<<5)+h) + s.charCodeAt(i)) | 0;
  return (h>>>0).toString(16).padStart(8,'0');
}

const FRG_TRENN = '\u001f';   /* Feldtrenner in der Zeilen-Signatur */
const FRG_LABEL_MAX = 44;

/* Was ein Mensch an einer Zeile liest — mit den WIRKSAMEN Werten. Rein, wenn
   man die Auflöser als vorhanden ansieht (qeGet/effNatur/canonUk arbeiten alle
   über die cid, nicht über den gerade offenen Standard). */
function frgZeilenSignatur(e, cid){
  if(!e) return '';
  const q = (p) => (typeof qeGet==='function') ? qeGet(e,cid,p) : undefined;
  const oder = (v, fb) => (v!==undefined ? v : fb);
  const name = oder(q('name'), e.anzeige_text||'');
  const menge = oder(q('mengeVal'), e.menge||'');
  const gr = oder(q('groessen'), e.groessen||[]);
  const grS = Array.isArray(gr) ? gr.map(x=>x&&x.wert).filter(Boolean).join('/') : String(gr||'');
  const spezRoh = Array.isArray(e.spezifikation) ? e.spezifikation.join('|') : (e.spezifikation||'');
  const spez = oder(q('spez'), spezRoh);
  let nat = e.natur||'';
  try{ if(typeof effNatur==='function') nat = effNatur(e,cid); }catch(err){}
  let uk = e.unterkategorie||'';
  try{ if(typeof canonUk==='function') uk = canonUk(e,cid)||''; }catch(err){}
  return [name,menge,grS,spez,nat,uk].join(FRG_TRENN);
}

/* Kurze Beschriftung für die Liste „was ist weggefallen". */
function frgLabel(sig){
  const erst = String(sig||'').split(FRG_TRENN)[0] || '(ohne Text)';
  return erst.length>FRG_LABEL_MAX ? (erst.slice(0,FRG_LABEL_MAX-1)+'…') : erst;
}

/* Alle Zeilen eines Standards in Anzeige-Reihenfolge, mit Signatur.
   Arzt-Varianten bleiben bewusst außen vor: Sie sind Abweichungen EINES Arztes,
   nicht der Stand des Hauses. */
function frgZeilen(std){
  const aus = [];
  if(!std) return aus;
  const rubs = (std.rubriken||[]).map((r,i)=>({r,i}))
    .sort((a,b)=>{ const oa=(typeof rubOrd==='function')?rubOrd(a.r,a.i,std):a.i;
      const ob=(typeof rubOrd==='function')?rubOrd(b.r,b.i,std):b.i; return oa-ob; });
  rubs.forEach(({r,i:ri})=>{
    if(typeof rubHidden==='function' && rubHidden(r,ri,std)) return;
    const rn = (typeof rubName==='function') ? rubName(r,ri,std) : (r.name||'');
    aus.push({ cid:std.id+'|r'+ri, sig:'§RUBRIK§'+rn, label:rn });
    (r.sub_bereiche||[]).forEach((sb,si)=>{
      (sb.eintraege||[]).forEach((e,ei)=>{
        if(!e) return;
        const cid = std.id+'|'+ri+'|'+si+'|'+ei;
        if(typeof qeGet==='function' && qeGet(e,cid,'hidden')===true) return;
        const sig = frgZeilenSignatur(e,cid);
        aus.push({ cid, sig, label:frgLabel(sig) });
      });
    });
    /* Alt-Bestand „selbst angelegte Einträge" (NEW) hängt nicht im DB-Baum. */
    if(typeof NEW!=='undefined' && Array.isArray(NEW)){
      const key = (typeof rubIdxKey==='function') ? rubIdxKey(r,ri) : ri;
      NEW.filter(n=>n.std===std.id && String(n.rub)===String(key)).forEach(n=>{
        const cid = 'new|'+n.id;
        const e = (typeof newToEntry==='function') ? newToEntry(n) : null;
        if(!e) return;
        if(typeof qeGet==='function' && qeGet(e,cid,'hidden')===true) return;
        const sig = frgZeilenSignatur(e,cid);
        aus.push({ cid, sig, label:frgLabel(sig) });
      });
    }
  });
  return aus;
}

/* Die Zeilenliste wird je Bildaufbau vielfach gebraucht — in der Übersicht für
   alle 47 Standards. Sie ist rein, also darf sie gepuffert werden; der Puffer
   fällt, sobald sich Daten ändern (frgCacheLeeren, u. a. aus rebuildDB). */
let frgCache = null;
function frgCacheLeeren(){ frgCache = null; }
function frgZeilenVon(std){
  if(!std || !std.id) return frgZeilen(std);
  if(!frgCache) frgCache = {};
  if(!frgCache[std.id]) frgCache[std.id] = frgZeilen(std);
  return frgCache[std.id];
}

/* Das Siegel: Fingerabdruck + Beschriftung je Zeile, als kompakte Liste. */
function frgSiegelBauen(std, meta){
  const z = frgZeilen(std);
  const m = meta||{};
  return { at:m.at||(typeof today==='function'?today():''), von:m.von||'',
    version:m.version||'', n:z.length,
    z: z.map(x=>frgHash(x.sig)+' '+x.label) };
}

/* Vergleicht ein Siegel mit dem aktuellen Stand. Rein (Siegel + Zeilenliste).
     neu     Stellen, die es so bei der Freigabe nicht gab (mit cid → anspringbar)
     weg     Zeilen, die bei der Freigabe da waren und heute fehlen (nur Text)
     reihenfolge  gleiche Zeilen, andere Anordnung */
function frgAbgleich(siegel, zeilen){
  const jetzt = (zeilen||[]).map(x=>({ cid:x.cid, label:x.label, h:frgHash(x.sig) }));
  if(!siegel || !Array.isArray(siegel.z)) return { ohne:true, gleich:false, neu:[], weg:[], reihenfolge:false };
  const alt = siegel.z.map(s=>({ h:String(s).slice(0,8), label:String(s).slice(9) }));

  const zaehl = (arr)=>{ const m=new Map(); arr.forEach(x=>m.set(x.h,(m.get(x.h)||0)+1)); return m; };
  const altN = zaehl(alt), jetztN = zaehl(jetzt);

  const rest = new Map(altN);
  const neu = [];
  jetzt.forEach(x=>{ const c=rest.get(x.h)||0; if(c>0) rest.set(x.h,c-1); else neu.push({cid:x.cid,label:x.label}); });

  const rest2 = new Map(jetztN);
  const weg = [];
  alt.forEach(x=>{ const c=rest2.get(x.h)||0; if(c>0) rest2.set(x.h,c-1); else weg.push({label:x.label}); });

  const gleicheMenge = (neu.length===0 && weg.length===0);
  const reihenfolge = gleicheMenge && alt.map(x=>x.h).join('') !== jetzt.map(x=>x.h).join('');
  return { ohne:false, gleich:(gleicheMenge && !reihenfolge), neu, weg, reihenfolge };
}

/* Zustand eines Standards als EIN Wort. Rein bis auf STDE/DB-Zugriff.
     'ohne'      kein Freigabe-Vermerk gepflegt
     'entwurf'   Vermerk vorhanden, aber nicht freigegeben
     'gueltig'   freigegeben und inhaltlich unverändert
     'ueberholt' freigegeben, seither geändert
     'abgelaufen' Gültigkeit ist verstrichen */
const FRG_FREI = 'Freigegeben';
function frgMeta(std){ return (typeof STDE!=='undefined' && STDE && std && STDE[std.id]) ? STDE[std.id] : {}; }

function frgStatus(std, heute){
  const m = frgMeta(std);
  const hat = !!(m.status || m.version || m.validFrom || m.validTo || m.siegel);
  if(!hat) return 'ohne';
  if(m.status!==FRG_FREI) return 'entwurf';
  const h = heute || (typeof today==='function' ? today() : '');
  if(m.validTo && h && String(m.validTo) < String(h)) return 'abgelaufen';
  if(!m.siegel) return 'ueberholt';   /* freigegeben, aber ohne Nachweis, worauf */
  return frgAbgleich(m.siegel, frgZeilenVon(std)).gleich ? 'gueltig' : 'ueberholt';
}

const FRG_TEXTE = {
  ohne:      { ico:'', kurz:'', lang:'' },
  entwurf:   { ico:'📝', kurz:'Entwurf', lang:'Dieser Standard ist nicht freigegeben.' },
  gueltig:   { ico:'✅', kurz:'Freigegeben', lang:'Inhalt unverändert seit der Freigabe.' },
  ueberholt: { ico:'⚠️', kurz:'Freigabe überholt', lang:'Seit der Freigabe wurde der Inhalt geändert.' },
  abgelaufen:{ ico:'⏳', kurz:'Gültigkeit abgelaufen', lang:'Der Gültigkeitszeitraum ist verstrichen.' },
};
function frgText(zustand){ return FRG_TEXTE[zustand] || FRG_TEXTE.ohne; }

/* ═══════════ 2. Freigeben und zurücknehmen ═══════════ */

function frgFreigeben(sid, von, version){
  if(typeof DB==='undefined' || !DB || !DB.standards) return false;
  const std = DB.standards.find(x=>x.id===sid); if(!std) return false;
  const m = Object.assign({}, STDE[sid]);
  m.status = FRG_FREI;
  if(version!=null && String(version).trim()!=='') m.version = String(version).trim();
  m.approvedBy = String(von||'').trim() || (typeof voterName==='function' ? voterName() : '');
  m.approvedAt = (typeof today==='function') ? today() : '';
  frgCacheLeeren();
  m.siegel = frgSiegelBauen(std, { at:m.approvedAt, von:m.approvedBy, version:m.version });
  STDE[sid] = m;
  if(typeof saveSTDE==='function') saveSTDE();
  return true;
}

/* Zurücknehmen heißt: Der Vermerk verschwindet, nicht die Version. Ein
   Standard ohne gültige Freigabe darf nicht so aussehen, als hätte er eine. */
function frgZurueckziehen(sid){
  if(!STDE[sid]) return false;
  const m = Object.assign({}, STDE[sid]);
  m.status = 'Entwurf';
  delete m.siegel; delete m.approvedBy; delete m.approvedAt;
  STDE[sid] = m;
  if(typeof saveSTDE==='function') saveSTDE();
  return true;
}

/* Überblick für die Leitung: Wie steht es um den ganzen Bestand? */
function frgBilanz(heute){
  const aus = { gesamt:0, ohne:0, entwurf:0, gueltig:0, ueberholt:0, abgelaufen:0 };
  if(typeof DB==='undefined' || !DB || !DB.standards) return aus;
  DB.standards.forEach(s=>{
    if(typeof stdHidden==='function' && stdHidden(s)) return;
    aus.gesamt++;
    aus[frgStatus(s, heute)]++;
  });
  return aus;
}

/* ═══════════ 3. Anzeige ═══════════ */

/* Die Zeile im Kopf eines Standards — für ALLE sichtbar, nicht nur für die
   Verwaltung. Wer im Labor „Freigegeben" liest, verlässt sich darauf; wer
   nichts liest, soll wenigstens die Warnung sehen. */
function frgKopfHTML(std){
  const z = frgStatus(std);
  if(z==='ohne') return '';
  const m = frgMeta(std);
  const t = frgText(z);
  const bits = [];
  if(m.version) bits.push('Version '+m.version);
  if(z==='gueltig' || z==='ueberholt' || z==='abgelaufen'){
    if(m.approvedAt) bits.push('freigegeben am '+m.approvedAt);
    if(m.approvedBy) bits.push('durch '+m.approvedBy);
  }
  if(m.validTo) bits.push('gültig bis '+m.validTo);

  let extra = '';
  if(z==='ueberholt'){
    const d = m.siegel ? frgAbgleich(m.siegel, frgZeilenVon(std)) : null;
    if(d && !d.ohne){
      const teile = [];
      if(d.neu.length) teile.push(d.neu.length+' geänderte oder neue Zeile'+(d.neu.length===1?'':'n'));
      if(d.weg.length) teile.push(d.weg.length+' entfernte Zeile'+(d.weg.length===1?'':'n'));
      if(d.reihenfolge) teile.push('geänderte Reihenfolge');
      if(teile.length) extra = teile.join(' · ');
    } else if(!m.siegel){
      extra = 'ohne Nachweis, welcher Stand freigegeben wurde';
    }
  }
  const knopf = (typeof ADMIN!=='undefined' && ADMIN)
    ? `<button class="vlink" data-s="${esc(std.id)}" onclick="openFreigabe(this.dataset.s)">Freigabe prüfen</button>` : '';
  return `<div class="frg-kopf frg-${esc(z)}">
    <span class="frg-ico">${t.ico}</span>
    <span class="frg-txt"><b>${esc(t.kurz)}</b>${bits.length?' · '+esc(bits.join(' · ')):''}${extra?`<span class="frg-extra">${esc(extra)}</span>`:''}</span>
    ${knopf}</div>`;
}

/* Kleines Zeichen für die Übersicht — nur wenn es etwas zu sagen gibt. */
function frgBadgeHTML(std){
  const z = frgStatus(std);
  if(z==='ohne' || z==='gueltig') return '';
  const t = frgText(z);
  return `<span class="frg-badge frg-${esc(z)}" title="${esc(t.lang)}">${t.ico} ${esc(t.kurz)}</span>`;
}

/* ═══════════ 4. Bildschirm „Freigabe" ═══════════ */

let frgSid = null;

function openFreigabe(sid){
  if(typeof ADMIN!=='undefined' && !ADMIN){ if(typeof promptLoginThen==='function') promptLoginThen(()=>openFreigabe(sid)); return; }
  frgSid = sid || (typeof curStd!=='undefined' && curStd ? curStd.id : null);
  if(!frgSid) return;
  renderFreigabe(); show('scr-freigabe');
  const s = DB.standards.find(x=>x.id===frgSid);
  if(typeof setBar==='function') setBar('Freigabe', s?stdTitel(s):'', true);
}

function frgUiFreigeben(){
  const s = DB.standards.find(x=>x.id===frgSid); if(!s) return;
  const m = frgMeta(s);
  const von = prompt('Wer gibt frei? (Name oder Kürzel)', m.approvedBy || (typeof voterName==='function'?voterName():''));
  if(von==null) return;
  if(!String(von).trim()){ toast('Ohne Namen keine Freigabe',true); return; }
  const ver = prompt('Version (z. B. 1.3):', m.version || '1.0');
  if(ver==null) return;
  frgFreigeben(frgSid, von, ver);
  renderFreigabe();
  toast('Freigegeben — der Stand ist versiegelt');
}

function frgUiZurueck(){
  const s = DB.standards.find(x=>x.id===frgSid); if(!s) return;
  if(!confirm('Freigabe von „'+stdTitel(s)+'" zurücknehmen?\n\nDer Standard erscheint danach überall als Entwurf. Der Inhalt bleibt unverändert.')) return;
  frgZurueckziehen(frgSid); renderFreigabe(); toast('Freigabe zurückgenommen');
}

function frgZurStelle(cid){
  const p = String(cid||'').split('|');
  if(p.length<2) return;
  if(typeof setMode==='function') setMode('use');
  if(typeof openStandard==='function') openStandard(p[0]);
  if(p.length>=4 && typeof openRubrik==='function'){
    openRubrik(+p[1]);
    setTimeout(()=>{ const el=$('e-'+cid); if(el&&el.scrollIntoView) try{ el.scrollIntoView({block:'center'}); }catch(e){} }, 60);
  }
}

function renderFreigabe(){
  const box = $('scr-freigabe'); if(!box || !frgSid) return;
  const s = DB.standards.find(x=>x.id===frgSid);
  if(!s){ box.innerHTML = `<div class="empty"><div class="ei">🏷</div><h3>Standard nicht gefunden</h3></div>`; return; }
  const m = frgMeta(s);
  const z = frgStatus(s);
  const t = frgText(z);

  let h = `<div class="banner"><h2>🏷 Freigabe</h2>
    <p><b>${esc(stdTitel(s))}</b></p>
    <p>Eine Freigabe gilt für einen <b>bestimmten Stand</b>. Deshalb wird beim Freigeben ein Siegel gezogen — ein Fingerabdruck des Inhalts. Ändert danach jemand etwas, sagt die App das, statt weiter „Freigegeben" anzuzeigen.</p></div>`;

  h += `<div class="frg-kopf frg-${esc(z)}" style="margin:0 0 12px">
    <span class="frg-ico">${t.ico||'•'}</span>
    <span class="frg-txt"><b>${esc(t.kurz||'Keine Angaben')}</b><span class="frg-extra">${esc(t.lang||'Für diesen Standard ist keine Version und keine Freigabe gepflegt.')}</span></span></div>`;

  h += `<div class="bez-sec">Vermerk</div>
    <div class="frg-feld"><span>Version</span><b>${esc(m.version||'—')}</b></div>
    <div class="frg-feld"><span>Status</span><b>${esc(m.status||'—')}</b></div>
    <div class="frg-feld"><span>Freigegeben am</span><b>${esc(m.approvedAt||'—')}</b></div>
    <div class="frg-feld"><span>Durch</span><b>${esc(m.approvedBy||'—')}</b></div>
    <div class="frg-feld"><span>Gültig ab</span><b>${esc(m.validFrom||'—')}</b></div>
    <div class="frg-feld"><span>Gültig bis</span><b>${esc(m.validTo||'—')}</b></div>
    <div class="frg-feld"><span>Siegel</span><b>${m.siegel?esc(m.siegel.n+' Zeilen versiegelt'):'—'}</b></div>`;

  if(z==='ueberholt' && m.siegel){
    const d = frgAbgleich(m.siegel, frgZeilenVon(s));
    h += `<div class="bez-sec">Was sich seit der Freigabe geändert hat</div>`;
    if(d.reihenfolge) h += `<p class="hint">Dieselben Zeilen, aber in anderer Reihenfolge.</p>`;
    if(!d.neu.length && !d.weg.length && !d.reihenfolge) h += `<p class="hint">Kein Unterschied gefunden.</p>`;
    d.neu.slice(0,60).forEach(x=>{ h += `<div class="frg-diff neu">
      <span class="frg-diff-t">geändert / neu</span><span class="frg-diff-x">${esc(x.label)}</span>
      <button class="vlink" data-c="${esc(x.cid)}" onclick="frgZurStelle(this.dataset.c)">Zur Stelle</button></div>`; });
    d.weg.slice(0,60).forEach(x=>{ h += `<div class="frg-diff weg">
      <span class="frg-diff-t">entfernt</span><span class="frg-diff-x">${esc(x.label)}</span></div>`; });
    if(d.neu.length>60 || d.weg.length>60) h += `<p class="hint">Es werden die ersten 60 je Art gezeigt.</p>`;
  }

  h += `<div class="p-actions" style="margin-top:14px">
      <button class="btn btn-pri" onclick="frgUiFreigeben()">${z==='gueltig'?'Erneut freigeben':'Freigeben'}</button>
      ${m.status?`<button class="btn btn-sec" onclick="frgUiZurueck()">Freigabe zurücknehmen</button>`:''}
      <button class="btn btn-sec" data-s="${esc(frgSid)}" onclick="openStandardForm2Meta(this.dataset.s)">Version & Gültigkeit</button>
    </div>
    <p class="hint">Das Siegel ist im Browser gerechnet und liegt im geteilten Zustand — es ist keine Unterschrift im Rechtssinn und kein Zugriffsschutz. Es beantwortet eine einzige Frage: <b>Ist das noch der Stand, der freigegeben wurde?</b></p>`;
  box.innerHTML = h;
}

/* Brücke zum vorhandenen Formular (Version, Gültigkeitszeitraum). */
function openStandardForm2Meta(sid){
  const s = DB.standards.find(x=>x.id===sid); if(!s) return;
  if(typeof curStd!=='undefined') curStd = s;
  if(typeof openStdMetaForm==='function') openStdMetaForm();
}

/* Karte in der Verwaltung: der Bestand auf einen Blick. */
function freigabePanelHTML(){
  const b = frgBilanz();
  const offen = b.ueberholt + b.abgelaufen;
  const badge = b.gesamt ? (offen ? (offen+' zu prüfen') : (b.gueltig+' gültig')) : '';
  const zeile = (k, label, ico)=>b[k]?`<div class="frg-feld"><span>${ico} ${label}</span><b>${b[k]}</b></div>`:'';
  let liste = '';
  if(typeof DB!=='undefined' && DB && DB.standards){
    DB.standards.filter(s=>!(typeof stdHidden==='function' && stdHidden(s)))
      .map(s=>({s, z:frgStatus(s)}))
      .filter(x=>x.z==='ueberholt' || x.z==='abgelaufen')
      .slice(0,40)
      .forEach(x=>{ const t=frgText(x.z);
        liste += `<div class="ukrow"><div class="ukrow-head"><span class="uk-name">${t.ico} ${esc(stdTitel(x.s))}</span><span class="uk-count">${esc(t.kurz)}</span></div>
          <div class="uk-actions"><button data-s="${esc(x.s.id)}" onclick="openFreigabe(this.dataset.s)">Prüfen</button></div></div>`; });
  }
  return `<details class="vpanel" data-keys="freigabe freigeben version gültigkeit gueltigkeit status entwurf siegel geprüft qm revision">
    ${vsum('🏷','Freigaben','Zeigt, welche Standards freigegeben sind — und wo sich seit der Freigabe etwas geändert hat',badge)}
    <div class="vpanel-body">
    <p class="hint">Eine Freigabe gilt für einen bestimmten Stand. Beim Freigeben zieht die App ein Siegel; ändert danach jemand etwas, erscheint der Standard überall als „Freigabe überholt" statt weiterhin als freigegeben.</p>
    ${zeile('gueltig','freigegeben und unverändert','✅')}
    ${zeile('ueberholt','seit der Freigabe geändert','⚠️')}
    ${zeile('abgelaufen','Gültigkeit verstrichen','⏳')}
    ${zeile('entwurf','Entwurf / in Prüfung','📝')}
    ${zeile('ohne','ohne Freigabe-Vermerk','·')}
    ${liste?`<div class="bez-sec">Zu prüfen</div>${liste}`:''}
    </div></details>`;
}
