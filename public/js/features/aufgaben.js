/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — AUFGABEN (was ansteht, und wer es erledigt hat)

   Der Betreiber: „Wenn vier Katheterlabore vorhanden sind und die räumlich
   getrennt sind, dann steht die Aufgabe irgendwie im Raum. Jeder weiß das,
   aber keiner weiß, ob's gemacht wurde oder wer's gemacht hat."

   Das ist keine Kalenderfunktion. Es ist eine Auskunft: IST ES GETAN, UND VON
   WEM. Danach ist alles hier gebaut.

   ── Drei Entscheidungen ──

   ① DER HAKEN TRÄGT EINEN NAMEN UND EINE UHRZEIT.
      „erledigt · 14:20 · MB" beantwortet die Frage, wegen der man sonst durch
      vier Türen läuft. Ein Haken ohne beides wäre nur eine halbe Antwort.
      Das Kürzel ist gerätelokal und frei getippt (features/kuerzel.js) —
      keine Anmeldung, kein Verzeichnis, kein Zugriffsprotokoll.

   ② WIEDERKEHRENDE AUFGABEN RECHNEN VORWÄRTS, NICHT RÜCKWÄRTS.
      Abgehakt wird IMMER die aktuelle Fälligkeit; die nächste entsteht daraus.
      Wer den Wochencheck einen Tag zu spät macht, bekommt nicht sofort den
      nächsten — er bekommt ihn eine Woche nach dem Soll-Termin. Sonst wandert
      der Termin bei jeder Verspätung nach hinten, und nach einem Jahr liegt
      der „Montagscheck" am Donnerstag.

   ③ DIE HISTORIE BLEIBT.
      Jeder Haken wird angehängt, nichts überschrieben. „Wann wurde das
      zuletzt gemacht, und wie oft fiel es aus?" ist die zweite Frage, die im
      Saal gestellt wird — und ohne Verlauf nicht beantwortbar.

   Aufgaben sind INHALT, kein Programm: Sie werden in der App angelegt und
   sind geteilt. Der Takt kommt aus einer Liste, deren Wörter das Haus ändern
   kann (data/bezeichnungen.json → aufgabentakte).
   ───────────────────────────────────────────────────────────── */

/* ═══════════ 1. Der Takt ═══════════ */

/* `tage` ist die Schrittweite für die nächste Fälligkeit; 0 heißt „einmalig".
   Monat und Jahr rechnen über den Kalender, nicht über 30/365 — sonst wandert
   der Monatserste. */
const AUF_TAKTE_RUECKFALL = [
  { key:'einmal',      wort:'einmalig',       tage:0 },
  { key:'taeglich',    wort:'täglich',        tage:1 },
  { key:'woechentlich',wort:'wöchentlich',    tage:7 },
  { key:'zweiwoechig', wort:'alle zwei Wochen', tage:14 },
  { key:'monatlich',   wort:'monatlich',      monate:1 },
  { key:'quartal',     wort:'vierteljährlich',monate:3 },
  { key:'halbjahr',    wort:'halbjährlich',   monate:6 },
  { key:'jaehrlich',   wort:'jährlich',       monate:12 },
];
function aufTakte(){
  const eigen = (typeof bezWert==='function') ? bezWert('aufgabentakte','werte',null) : null;
  if(Array.isArray(eigen) && eigen.length){
    return eigen.map(x=>({ key:x.key, wort:x.wort, tage:x.tage, monate:x.monate }))
      .filter(x=>x.key && x.wort);
  }
  return AUF_TAKTE_RUECKFALL;
}
function aufTakt(key){ return aufTakte().find(t=>t.key===key) || aufTakte()[0]; }

/* ── Datumsrechnung, rein und testbar ── */
function aufHeute(){ const d=new Date(); return aufDatum(d); }
function aufDatum(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function aufLese(iso){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso||''));
  if(!m) return null;
  const d = new Date(+m[1], +m[2]-1, +m[3]);
  return isNaN(d.getTime()) ? null : d;
}
/* Die nächste Fälligkeit — vom SOLL-Termin aus, nicht vom Erledigungstag.
   Liegt der neue Termin schon wieder in der Vergangenheit (lange nicht
   gemacht), wird so lange weitergeschaltet, bis er in der Zukunft liegt:
   Sonst stünden nach drei Monaten Pause zwölf offene Wochenchecks da, und
   niemand hakt zwölfmal ab. */
function aufNaechste(faellig, taktKey, heute){
  const t = aufTakt(taktKey);
  if(!t || (!t.tage && !t.monate)) return null;          /* einmalig: fertig */
  let d = aufLese(faellig) || aufLese(heute) || new Date();
  const grenze = aufLese(heute) || new Date();
  let schutz = 0;
  do {
    if(t.monate){ const tag=d.getDate(); d = new Date(d.getFullYear(), d.getMonth()+t.monate, 1);
      /* 31. → in einem kürzeren Monat auf dessen letzten Tag */
      const letzter = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
      d.setDate(Math.min(tag, letzter)); }
    else d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + t.tage);
    schutz++;
  } while(d <= grenze && schutz < 400);
  return aufDatum(d);
}
/* Wie dringend? Rein — die Anzeige hängt daran und die Sortierung auch. */
function aufStand(a, heute){
  const h = heute || aufHeute();
  if(!a || !a.faellig) return { key:'ohne', wort:'ohne Termin', rang:5 };
  const d = aufLese(a.faellig), hd = aufLese(h);
  if(!d || !hd) return { key:'ohne', wort:'ohne Termin', rang:5 };
  const tage = Math.round((d - hd) / 86400000);
  if(tage < 0)  return { key:'ueber', wort:(-tage===1?'1 Tag überfällig':(-tage)+' Tage überfällig'), rang:0, tage };
  if(tage === 0) return { key:'heute', wort:'heute fällig', rang:1, tage };
  if(tage === 1) return { key:'morgen', wort:'morgen fällig', rang:2, tage };
  if(tage <= 7)  return { key:'woche', wort:'in '+tage+' Tagen', rang:3, tage };
  return { key:'spaeter', wort:'in '+tage+' Tagen', rang:4, tage };
}

/* ═══════════ 2. Der Bestand ═══════════ */

let AUFG = (typeof loadJSON==='function') ? loadJSON('hkl_aufgaben', []) : [];
if(!Array.isArray(AUFG)) AUFG = [];
function saveAufg(){ if(typeof saveJSON==='function') saveJSON('hkl_aufgaben', AUFG); }

function aufNeueId(){ return 'a'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function aufNach(id){ return AUFG.find(a=>a.id===id) || null; }

function aufAnlegen(felder){
  const f = felder || {};
  const wort = String(f.wort||'').trim();
  if(!wort) return null;
  const a = { id:aufNeueId(), wort,
    beschreibung:String(f.beschreibung||'').trim(),
    ort:String(f.ort||'').trim(),
    takt:f.takt || 'woechentlich',
    faellig:f.faellig || aufHeute(),
    seite:f.seite || null,          /* an welcher Seite sie hängt (null = alle) */
    verlauf:[], erledigt:false };
  AUFG.push(a); saveAufg();
  return a;
}
function aufAendern(id, feld, wert){
  const a = aufNach(id); if(!a) return false;
  a[feld] = wert; saveAufg(); return true;
}
function aufLoeschen(id){
  const i = AUFG.findIndex(a=>a.id===id); if(i<0) return false;
  AUFG.splice(i,1); saveAufg(); return true;
}

/* Abhaken. Der Kern: Der Haken wird ANGEHÄNGT, und bei wiederkehrenden
   Aufgaben entsteht daraus die nächste Fälligkeit. */
function aufAbhaken(id, kuerzelWert, heute){
  const a = aufNach(id); if(!a) return null;
  const eintrag = { ts:new Date().toISOString(), kuerzel:String(kuerzelWert||'').trim(), fuer:a.faellig };
  if(!Array.isArray(a.verlauf)) a.verlauf = [];
  a.verlauf.push(eintrag);
  if(a.verlauf.length > 200) a.verlauf = a.verlauf.slice(-200);   /* nicht endlos wachsen */
  const naechste = aufNaechste(a.faellig, a.takt, heute || aufHeute());
  if(naechste){ a.faellig = naechste; a.erledigt = false; }
  else { a.erledigt = true; }
  saveAufg();
  return eintrag;
}
/* Zurücknehmen: der letzte Haken verschwindet, die Fälligkeit geht zurück auf
   den Termin, für den er galt. Ein Fehlgriff darf nicht bedeuten, dass man
   eine Woche wartet. */
function aufZuruecknehmen(id){
  const a = aufNach(id); if(!a || !Array.isArray(a.verlauf) || !a.verlauf.length) return false;
  const letzter = a.verlauf.pop();
  if(letzter && letzter.fuer) a.faellig = letzter.fuer;
  a.erledigt = false;
  saveAufg(); return true;
}
function aufLetzter(a){
  const v = (a && a.verlauf) || [];
  return v.length ? v[v.length-1] : null;
}
/* Die Aufgaben EINER Seite (null/leer = alle). */
function aufgabenFuer(seite){
  const sid = seite && seite.id;
  return AUFG.filter(a => !a.seite || !sid || a.seite === sid);
}
function aufgabenOffen(seite){
  return aufgabenFuer(seite).filter(a=>!a.erledigt);
}
/* Sortiert: das Überfällige zuerst, danach nach Termin. Wer hereinschaut,
   sieht zuerst, was brennt. */
function aufgabenSortiert(seite, heute){
  const h = heute || aufHeute();
  return aufgabenFuer(seite).slice().sort((a,b)=>{
    if(!!a.erledigt !== !!b.erledigt) return a.erledigt ? 1 : -1;
    const ra = aufStand(a,h).rang, rb = aufStand(b,h).rang;
    if(ra !== rb) return ra - rb;
    return String(a.faellig||'').localeCompare(String(b.faellig||''));
  });
}

/* ═══════════ 3. Die Seite ═══════════ */

let aufForm = null;      /* offenes Formular: null | 'neu' | <id> */
let aufVerlaufAuf = null;

function aufgabenSeiteHTML(seite, suche){
  const h = aufHeute();
  const q = String(suche||'').trim().toLowerCase();
  let liste = aufgabenSortiert(seite, h);
  if(q) liste = liste.filter(a=>((a.wort||'')+' '+(a.ort||'')+' '+(a.beschreibung||'')).toLowerCase().indexOf(q)>=0);
  const istAdmin = (typeof ADMIN!=='undefined') && ADMIN;

  const ueber = liste.filter(a=>!a.erledigt && aufStand(a,h).key==='ueber').length;
  const heute = liste.filter(a=>!a.erledigt && aufStand(a,h).key==='heute').length;

  let html = `<div class="banner"><h2>✅ ${esc((seite&&seite.wort)||'Aufgaben')}</h2>
    <p>Was ansteht — und wer es erledigt hat. Ein Haken trägt Uhrzeit und Kürzel, damit im anderen Saal niemand nachfragen muss.</p>
    ${(ueber||heute)?`<div class="auf-bilanz">${ueber?`<span class="auf-warn">${ueber} überfällig</span>`:''}${heute?`<span class="auf-heute">${heute} heute</span>`:''}</div>`:''}
    <div class="auf-wer">Dein Kürzel: <button type="button" class="auf-krz" onclick="aufUiKuerzel()">${esc(kuerzel()||'— antippen —')}</button></div></div>`;

  if(istAdmin && aufForm==='neu') html += aufFormHTML(null, seite);
  else if(istAdmin) html += `<button class="add-entry-btn" onclick="aufUiNeu()">＋ Aufgabe anlegen</button>`;

  if(!liste.length){
    return html + `<div class="empty"><div class="ei">✅</div><h3>${q?'Nichts gefunden':'Keine Aufgabe'}</h3>
      <p>${q?'Kein Treffer für die Suche.':'Hier steht, was regelmäßig zu tun ist — Wochencheck, Wartung, Bestellrunde. Lege die erste an.'}</p></div>`;
  }

  liste.forEach(a=>{
    if(istAdmin && aufForm===a.id){ html += aufFormHTML(a, seite); return; }
    const st = aufStand(a, h);
    const letzt = aufLetzter(a);
    const takt = aufTakt(a.takt);
    html += `<div class="auf-karte auf-${esc(st.key)}${a.erledigt?' auf-fertig':''}">
      <button type="button" class="auf-haken" data-i="${esc(a.id)}" onclick="aufUiHaken(this.dataset.i)"
        aria-label="Als erledigt melden">${a.erledigt?'✓':'○'}</button>
      <div class="auf-haupt" data-i="${esc(a.id)}">
        <div class="auf-wort">${esc(a.wort)}</div>
        <div class="auf-meta">
          <span class="auf-stand">${esc(a.erledigt?'abgeschlossen':st.wort)}</span>
          ${a.ort?`<span class="auf-ort">📍 ${esc(a.ort)}</span>`:''}
          <span class="auf-takt">${esc(takt.wort)}</span>
        </div>
        ${a.beschreibung?`<div class="auf-text">${esc(a.beschreibung)}</div>`:''}
        ${letzt?`<div class="auf-zuletzt">zuletzt ${esc(kuerzelVermerk(letzt))}</div>`:'<div class="auf-zuletzt auf-nie">noch nie erledigt</div>'}
        ${(aufVerlaufAuf===a.id)?aufVerlaufHTML(a):''}
      </div>
      <div class="auf-akt">
        <button type="button" data-i="${esc(a.id)}" onclick="aufUiVerlauf(this.dataset.i)" aria-label="Verlauf">${aufVerlaufAuf===a.id?'⌄':'🕘'}</button>
        ${istAdmin?`<button type="button" data-i="${esc(a.id)}" onclick="aufUiBearbeiten(this.dataset.i)" aria-label="Bearbeiten">✎</button>`:''}
      </div></div>`;
  });
  return html;
}

function aufVerlaufHTML(a){
  const v = ((a && a.verlauf) || []).slice().reverse().slice(0, 20);
  if(!v.length) return `<div class="auf-verlauf"><span class="hint">Noch kein Eintrag.</span></div>`;
  return `<div class="auf-verlauf">`
    + v.map(x=>`<div class="auf-vz">${esc(kuerzelVermerk(x))}${x.fuer?`<span class="auf-vf">für ${esc(x.fuer)}</span>`:''}</div>`).join('')
    + (a.verlauf.length>1?`<button type="button" class="auf-vzurueck" data-i="${esc(a.id)}" onclick="aufUiZurueck(this.dataset.i)">↺ letzten Haken zurücknehmen</button>`:'')
    + `</div>`;
}

function aufFormHTML(a, seite){
  const takte = aufTakte();
  const neu = !a;
  return `<div class="auf-form">
    <div class="flabel">${neu?'NEUE AUFGABE':'AUFGABE BEARBEITEN'}</div>
    <input class="loc-input" id="aufWort" placeholder="Was ist zu tun? z. B. Notfallwagen prüfen" value="${esc(a?a.wort:'')}">
    <input class="loc-input" id="aufOrt" placeholder="Wo? z. B. HKL 3 (optional)" value="${esc(a?a.ort:'')}" style="margin-top:8px">
    <textarea class="loc-input" id="aufText" rows="2" placeholder="Erklärung (optional)" style="margin-top:8px">${esc(a?a.beschreibung:'')}</textarea>
    <div class="form-row" style="margin-top:8px">
      <select class="form-sel" id="aufTakt">${takte.map(t=>`<option value="${esc(t.key)}"${(a&&a.takt===t.key)||(!a&&t.key==='woechentlich')?' selected':''}>${esc(t.wort)}</option>`).join('')}</select>
      <input class="loc-input" id="aufFaellig" type="date" value="${esc(a?a.faellig:aufHeute())}">
    </div>
    <div class="p-actions" style="margin-top:10px">
      <button class="btn btn-sec" onclick="aufUiAbbrechen()">Abbrechen</button>
      ${a?`<button class="btn btn-sec" style="color:#d64545" data-i="${esc(a.id)}" onclick="aufUiLoeschen(this.dataset.i)">Löschen</button>`:''}
      <button class="btn btn-pri" data-i="${esc(a?a.id:'')}" data-s="${esc((seite&&seite.id)||'')}" onclick="aufUiSpeichern(this.dataset.i,this.dataset.s)">Speichern</button>
    </div></div>`;
}

/* ── Bedienung ── */
function aufUiNeu(){ aufForm='neu'; seiteAuffrischen(); setTimeout(()=>{ const i=$('aufWort'); if(i) i.focus(); },50); }
function aufUiBearbeiten(id){ aufForm=id; seiteAuffrischen(); }
function aufUiAbbrechen(){ aufForm=null; seiteAuffrischen(); }
function aufUiSpeichern(id, seitenId){
  const wort = ($('aufWort')&&$('aufWort').value||'').trim();
  if(!wort){ if(typeof toast==='function') toast('Bitte sagen, was zu tun ist',true); return; }
  const felder = { wort, ort:($('aufOrt')&&$('aufOrt').value)||'', beschreibung:($('aufText')&&$('aufText').value)||'',
    takt:($('aufTakt')&&$('aufTakt').value)||'woechentlich', faellig:($('aufFaellig')&&$('aufFaellig').value)||aufHeute(),
    seite:seitenId||null };
  if(id){ Object.keys(felder).forEach(k=>{ if(k!=='seite') aufAendern(id,k,felder[k]); }); }
  else aufAnlegen(felder);
  aufForm=null; seiteAuffrischen();
  if(typeof toast==='function') toast(id?'Gespeichert':'Aufgabe angelegt');
}
function aufUiLoeschen(id){ aufLoeschen(id); aufForm=null; seiteAuffrischen(); if(typeof toast==='function') toast('Aufgabe entfernt'); }
function aufUiVerlauf(id){ aufVerlaufAuf = (aufVerlaufAuf===id)?null:id; seiteAuffrischen(); }
function aufUiZurueck(id){ if(aufZuruecknehmen(id)){ seiteAuffrischen(); if(typeof toast==='function') toast('Haken zurückgenommen'); } }
function aufUiKuerzel(){ if(typeof kuerzelFragen==='function') kuerzelFragen(()=>seiteAuffrischen()); }
function aufUiHaken(id){
  const a = aufNach(id); if(!a) return;
  if(a.erledigt){ aufZuruecknehmen(id); seiteAuffrischen(); if(typeof toast==='function') toast('Wieder offen'); return; }
  kuerzelDannn(()=>{
    const e = aufAbhaken(id, kuerzel());
    seiteAuffrischen();
    if(typeof toast==='function') toast(e ? ('Erledigt · '+kuerzelVermerk(e)) : 'Nicht gefunden');
  });
}
