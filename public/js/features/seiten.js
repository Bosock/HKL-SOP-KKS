/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — DIE STARTSEITE ALS REGISTER

   Die Leiste oben („📋 Standards | 📘 Anleitungen") war die letzte Fläche der
   App, die fest im Quelltext stand: zwei getippte Knöpfe, ein Umschalter mit
   genau zwei erlaubten Werten. Alles andere ließ sich längst ohne Code
   ändern — ausgerechnet der erste Bildschirm nicht.

   Der Betreiber: „Ich kann das immer noch nicht bearbeiten, und mir geht's
   auch darum, dass ich weitere Seiten anlegen kann."

   ── Die Trennung, um die es geht ──
   Der Code kennt SEITENARTEN. Das Haus legt SEITEN an.

     Seitenart   was der Code kann          (fest, weil es Verhalten ist)
     Seite       was das Haus daraus macht  (Wort, Symbol, Reihenfolge, an/aus)

   Damit ist „ich hätte gern noch einen Reiter" eine Einstellung und kein
   Auftrag an einen Entwickler (Grundsatz ⑤ / Hausregel A7). Und weil jede
   Seitenart mehrfach angelegt werden darf, kann dasselbe Haus zwei
   Aufgaben-Seiten führen — „Täglich" und „Wartung" — ohne dass jemand etwas
   programmiert.

   ── Ausgeliefert wird der Zustand von vorher ──
   Ohne eigene Einstellung stehen genau die zwei Seiten da, die es immer gab,
   unter denselben Kennungen ('standard', 'anleitung'). Wer nichts ändert,
   merkt von diesem Umbau nichts (Grundsatz ①).

   ── Bearbeitet wird durch LANGES TIPPEN auf den Reiter ──
   Nicht über ein Untermenü in der Verwaltung. Die Einstellung gehört dorthin,
   wo das Ding steht.
   ───────────────────────────────────────────────────────────── */

/* ═══════════ 1. Die Seitenarten (das kann der Code) ═══════════ */

/* Jede Art trägt:
     zeichne(seite, suche) → HTML des Listenbereichs
     zaehler(seite)        → Zahl neben dem Reiter (oder '')
     sorten                → welche Sortierungen hier Sinn ergeben
   Die beiden ersten Arten geben an den vorhandenen Code ab; sie sind nur
   deshalb hier gelistet, damit die Leiste EINE Quelle hat. */
const SEITEN_ARTEN = [
  { key:'standards',   ico:'📋', wort:'Standards',   sub:'die Eingriffe',
    eingebaut:true, sorten:['gruppe','alpha','fav','oft','neu','kosten'] },
  { key:'anleitungen', ico:'📘', wort:'Anleitungen', sub:'Aufbau, Geräte, Abläufe',
    eingebaut:true, sorten:['gruppe','alpha','fav','oft','neu','faellig'] },
  { key:'aufgaben',    ico:'✅', wort:'Aufgaben',    sub:'was wann ansteht — und wer es erledigt hat',
    zeichne:(s,q)=> (typeof aufgabenSeiteHTML==='function') ? aufgabenSeiteHTML(s,q) : '',
    zaehler:(s)=> (typeof aufgabenOffen==='function') ? (aufgabenOffen(s).length||'') : '' },
  { key:'aktuelles',   ico:'📌', wort:'Aktuelles',   sub:'Notfall, Wartung, Sperrung — die Pinnwand',
    zeichne:(s,q)=> (typeof aktuellSeiteHTML==='function') ? aktuellSeiteHTML(s,q) : '',
    zaehler:(s)=> (typeof aktGeltende==='function') ? (aktGeltende().length||'') : '' },
  { key:'bestellungen',ico:'🛒', wort:'Bestellungen',sub:'„ist leer" melden statt hinlaufen',
    zeichne:(s,q)=> (typeof bestSeiteHTML==='function') ? bestSeiteHTML(s,q) : '',
    zaehler:(s)=> (typeof bestOffen==='function') ? (bestOffen().length||'') : '' },
];
function seitenArt(key){ return SEITEN_ARTEN.find(a=>a.key===key) || null; }

/* ═══════════ 2. Die Seiten (das macht das Haus daraus) ═══════════ */

/* Ausgelieferte Seiten: exakt der Zustand von vorher. */
const SEITEN_VORGABE = [
  { id:'standard',  art:'standards' },
  { id:'anleitung', art:'anleitungen' },
];

let SEITEN = (typeof loadJSON==='function') ? loadJSON('hkl_seiten', []) : [];
if(!Array.isArray(SEITEN)) SEITEN = [];
function saveSeiten(){ if(typeof saveJSON==='function') saveJSON('hkl_seiten', SEITEN); }

/* Die geltende Liste: eigene Einstellung, sonst die Auslieferung. Eine Seite,
   deren Art es nicht (mehr) gibt, fällt heraus statt die Leiste zu sprengen. */
function seitenAlle(){
  const roh = SEITEN.length ? SEITEN : SEITEN_VORGABE;
  return roh
    .filter(s => s && s.id && seitenArt(s.art))
    .map((s,i) => {
      const a = seitenArt(s.art);
      return { id:s.id, art:s.art, ord:(s.ord!=null?Number(s.ord):i), aus:!!s.aus,
        wort:(s.wort!=null && s.wort!=='') ? s.wort : a.wort,
        ico: (s.ico!=null && s.ico!=='')  ? s.ico  : a.ico,
        sub: a.sub, eingebaut:!!a.eingebaut };
    })
    .sort((a,b)=>a.ord-b.ord);
}
/* Was in der Leiste steht. Ausgeblendete Seiten sind für Nutzer weg — in der
   Verwaltung bleiben sie sichtbar, sonst käme man nie wieder an sie heran. */
function seitenListe(istAdmin){
  const alle = seitenAlle();
  return istAdmin ? alle : alle.filter(s=>!s.aus);
}
function seiteNach(id){ return seitenAlle().find(s=>s.id===id) || null; }

/* Die Seite, die gerade gilt. Zeigt `curSeg` ins Leere (ausgeblendet,
   gelöscht), wird die erste sichtbare genommen — nie ein leerer Bildschirm. */
function seiteAktuell(){
  const sichtbar = seitenListe(typeof ADMIN!=='undefined' && ADMIN);
  if(!sichtbar.length) return null;
  /* Verglichen wird über die KENNUNG, nicht über das Objekt: seitenAlle()
     baut die Seiten bei jedem Aufruf neu zusammen, zwei Aufrufe liefern also
     nie dasselbe Objekt. Ein Vergleich per indexOf() träfe deshalb nie zu —
     und jede Seite fiele stumm auf die erste zurück. */
  const gewaehlt = (typeof curSeg!=='undefined') ? sichtbar.find(s=>s.id===curSeg) : null;
  if(gewaehlt) return gewaehlt;
  const s = sichtbar[0];
  if(typeof curSeg!=='undefined') curSeg = s.id;
  return s;
}
/* Ist die aktuelle Seite von dieser Art? Der übrige Code fragt so statt
   `curSeg==='anleitung'` — sonst bräuchte jede neue Seite eine Code-Änderung. */
function seiteIstArt(art){ const s=seiteAktuell(); return !!(s && s.art===art); }

function seitenNeueId(art){
  const basis = String(art||'seite').slice(0,10);
  let n = 2, id = basis;
  while(seitenAlle().some(s=>s.id===id)) id = basis + '-' + (n++);
  return id;
}
/* Beim ersten Eingriff wird die Auslieferung zu einer echten Liste — vorher
   gibt es nichts zu ändern, weil nichts gespeichert ist. */
function seitenVerselbstaendigen(){
  if(!SEITEN.length) SEITEN = SEITEN_VORGABE.map((s,i)=>({ id:s.id, art:s.art, ord:i }));
}
function seiteAnlegen(art, wort){
  if(!seitenArt(art)) return null;
  seitenVerselbstaendigen();
  const s = { id:seitenNeueId(art), art, ord:SEITEN.length };
  const w = String(wort||'').trim(); if(w) s.wort = w;
  SEITEN.push(s); saveSeiten();
  return s;
}
function seiteSetzen(id, feld, wert){
  seitenVerselbstaendigen();
  const s = SEITEN.find(x=>x.id===id); if(!s) return false;
  const leer = (wert===null || wert===undefined || wert==='' || wert===false);
  if(leer) delete s[feld]; else s[feld] = wert;
  saveSeiten(); return true;
}
function seiteVerschieben(id, richtung){
  seitenVerselbstaendigen();
  const liste = seitenAlle();
  const i = liste.findIndex(s=>s.id===id); const j = i + (richtung<0?-1:1);
  if(i<0 || j<0 || j>=liste.length) return false;
  const t = liste[i]; liste[i] = liste[j]; liste[j] = t;
  liste.forEach((s,n)=>{ const roh = SEITEN.find(x=>x.id===s.id); if(roh) roh.ord = n; });
  saveSeiten(); return true;
}
/* Eine eingebaute Seite lässt sich AUSBLENDEN, aber nicht löschen: Hinter ihr
   stehen Inhalte, die sonst unerreichbar würden. Eine selbst angelegte Seite
   darf weg — ihre Inhalte bleiben im Speicher und kommen zurück, wenn die
   Seite neu angelegt wird (Grundsatz ②). */
function seiteLoeschbar(id){ const s=seiteNach(id); return !!(s && !s.eingebaut); }
function seiteLoeschen(id){
  if(!seiteLoeschbar(id)) return false;
  seitenVerselbstaendigen();
  const i = SEITEN.findIndex(x=>x.id===id); if(i<0) return false;
  SEITEN.splice(i,1); saveSeiten();
  if(typeof curSeg!=='undefined' && curSeg===id) curSeg = (seitenListe(true)[0]||{}).id || 'standard';
  return true;
}
function seitenZuruecksetzen(){ SEITEN = []; saveSeiten(); }
function seitenGeaendert(){ return SEITEN.length > 0; }

/* ═══════════ 3. Die Leiste ═══════════ */

function segBarHTML(){
  const istAdmin = (typeof ADMIN!=='undefined') && ADMIN;
  const seiten = seitenListe(istAdmin);
  const aktiv = seiteAktuell();
  const knopf = (s)=>{
    let n = '';
    const a = seitenArt(s.art);
    if(s.art==='standards') n = (typeof DB!=='undefined'&&DB&&DB.standards) ? DB.standards.filter(x=>!stdHidden(x)||istAdmin).length : '';
    else if(s.art==='anleitungen') n = (typeof guideList==='function') ? guideList().length : '';
    else if(a && a.zaehler){ try{ n = a.zaehler(s); }catch(e){ n = ''; } }
    const an = !!(aktiv && aktiv.id===s.id);
    return `<button class="seg-btn${an?' on':''}${s.aus?' seg-aus':''}" role="tab" data-seite="${esc(s.id)}"
      aria-selected="${an?'true':'false'}" tabindex="${an?'0':'-1'}"
      onclick="setSeg(this.dataset.seite)">${esc(s.ico)} ${esc(s.wort)}${s.aus?' (aus)':''}<span class="seg-n">${esc(String(n||''))}</span></button>`;
  };
  const plus = istAdmin ? `<button type="button" class="seg-btn seg-neu" onclick="seiteNeuSheet()" aria-label="Seite hinzufügen">＋</button>` : '';
  /* Die Sortierungen laufen über dasselbe Register wie alles andere: Wort,
     Symbol und an/aus liegen unter `sortierung` (features/funktionen.js),
     eingestellt wird durch LANGES TIPPEN auf den Knopf. Der Messstand hatte
     hier sechs Flächen ohne Langdruck gezählt. */
  const sorts = (typeof sortsFor==='function' && aktiv)
    ? sortsFor(aktiv).filter(s=>!(typeof fktAus==='function' && fktAus('sortierung', s.key))).map(s=>{
        const ico = (typeof fktWert==='function') ? fktWert('sortierung', s.key, 'ico', s.ico) : s.ico;
        const wort = (typeof fktWert==='function') ? fktWert('sortierung', s.key, 'wort', s.label) : s.label;
        return `<button class="sortchip${curSort===s.key?' on':''}" data-k="${esc(s.key)}" data-w="${esc(s.label)}" data-ico="${esc(s.ico)}" aria-pressed="${curSort===s.key?'true':'false'}" onclick="setSort(this.dataset.k)" title="${esc(wort)}"><span aria-hidden="true">${esc(ico)}</span> ${esc(wort)}</button>`;
      }).join('')
    : '';
  return `<div class="segbar" role="tablist" aria-label="Bereiche der Startseite">${seiten.map(knopf).join('')}${plus}</div>`
    + (sorts ? `<div class="sortbar" role="group" aria-label="Sortierung">${sorts}</div>` : '');
}

/* ═══════════ 4. Bearbeiten — durch langes Tippen auf den Reiter ═══════════ */

function seiteSheet(id){
  if(typeof ADMIN!=='undefined' && !ADMIN) return;
  const s = seiteNach(id); if(!s) return;
  const a = seitenArt(s.art);
  let h = `<div class="sheet-grip"></div><div class="sheet-title">Seite bearbeiten</div>
    <div class="sheet-name">${esc(s.ico)} ${esc(s.wort)}</div>
    <p class="why-help">Art: <b>${esc(a?a.wort:s.art)}</b> — ${esc(a?a.sub:'')}. Die Art liegt fest; Wort, Symbol, Reihenfolge und Sichtbarkeit gehören dir.</p>
    <div class="form-grp"><div class="flabel">Wort</div>
      <input class="loc-input" id="stNeuWort" value="${esc(s.wort)}" placeholder="${esc(a?a.wort:'')}"></div>
    <div class="form-grp"><div class="flabel">Symbol</div>
      <input class="loc-input" id="stNeuIco" value="${esc(s.ico)}" maxlength="4" placeholder="${esc(a?a.ico:'')}"></div>
    <div class="p-actions"><button class="btn btn-pri" data-i="${esc(id)}" onclick="seiteUiSpeichern(this.dataset.i)">Übernehmen</button></div>
    <div class="sheet-pick" style="margin-top:10px">
      <button class="sheet-pick-btn" data-i="${esc(id)}" onclick="seiteUiVerschieben(this.dataset.i,-1)">⬅ Nach links</button>
      <button class="sheet-pick-btn" data-i="${esc(id)}" onclick="seiteUiVerschieben(this.dataset.i,1)">➡ Nach rechts</button>
      <button class="sheet-pick-btn" data-i="${esc(id)}" onclick="seiteUiSchalten(this.dataset.i)">${s.aus?'👁 Wieder einblenden':'🚫 Ausblenden'}</button>`;
  if(seiteLoeschbar(id)){
    h += `<button class="sheet-pick-btn" data-i="${esc(id)}" onclick="seiteUiLoeschen(this.dataset.i)">🗑 Seite entfernen</button>`;
  } else {
    h += `<div class="hint" style="padding:6px 4px">Diese Seite gehört zur Auslieferung und lässt sich nur ausblenden — hinter ihr stehen Inhalte, die sonst unerreichbar wären.</div>`;
  }
  h += `</div><button class="sheet-close" onclick="showSheet(false)">Schließen</button>`;
  $('sheet').innerHTML = h;
  if(typeof showSheet==='function') showSheet(true);
}

function seiteNeuSheet(){
  if(typeof ADMIN!=='undefined' && !ADMIN) return;
  let h = `<div class="sheet-grip"></div><div class="sheet-title">Neue Seite</div>
    <p class="why-help">Wähle, was die Seite TUN soll. Wort und Symbol änderst du danach jederzeit — durch langes Tippen auf den Reiter.</p>
    <div class="sheet-pick">`;
  SEITEN_ARTEN.forEach(a=>{
    h += `<button class="sheet-pick-btn" data-a="${esc(a.key)}" onclick="seiteUiAnlegen(this.dataset.a)">
      ${a.ico} ${esc(a.wort)} <span class="ps-sub">· ${esc(a.sub)}</span></button>`;
  });
  h += `</div><button class="sheet-close" onclick="showSheet(false)">Abbrechen</button>`;
  $('sheet').innerHTML = h;
  if(typeof showSheet==='function') showSheet(true);
}

function seiteAuffrischen(){
  if(typeof renderStandards==='function') renderStandards();
  if(typeof updateBar==='function') updateBar();
}
function seiteUiAnlegen(art){
  const s = seiteAnlegen(art);
  if(typeof showSheet==='function') showSheet(false);
  if(s && typeof curSeg!=='undefined') curSeg = s.id;
  seiteAuffrischen();
  if(typeof toast==='function') toast(s ? ('Seite „'+(s.wort||art)+'" angelegt') : 'Konnte nicht angelegt werden', !s);
}
function seiteUiSpeichern(id){
  const w = ($('stNeuWort') && $('stNeuWort').value || '').trim();
  const i = ($('stNeuIco')  && $('stNeuIco').value  || '').trim();
  const a = seitenArt((seiteNach(id)||{}).art) || {};
  seiteSetzen(id, 'wort', (w===a.wort) ? '' : w);
  seiteSetzen(id, 'ico',  (i===a.ico)  ? '' : i);
  if(typeof showSheet==='function') showSheet(false);
  seiteAuffrischen();
  if(typeof toast==='function') toast('Übernommen');
}
function seiteUiVerschieben(id, richtung){ if(seiteVerschieben(id, richtung)){ seiteSheet(id); seiteAuffrischen(); } }
function seiteUiSchalten(id){
  const s = seiteNach(id); if(!s) return;
  seiteSetzen(id, 'aus', !s.aus);
  seiteSheet(id); seiteAuffrischen();
  if(typeof toast==='function') toast(seiteNach(id).aus ? 'Ausgeblendet — in der Verwaltung bleibt sie sichtbar' : 'Wieder sichtbar');
}
let seiteWeg = null;   /* Rückfrage als Karte, nie als natives Fenster */
function seiteUiLoeschen(id){
  if(seiteWeg !== id){
    seiteWeg = id;
    const s = seiteNach(id);
    $('sheet').innerHTML = `<div class="sheet-grip"></div><div class="sheet-title">Seite entfernen?</div>
      <p class="why-help">„${esc(s?s.wort:'')}" verschwindet aus der Leiste. Die Inhalte dahinter bleiben gespeichert und sind wieder da, sobald du eine Seite dieser Art neu anlegst.</p>
      <div class="p-actions"><button class="btn btn-sec" data-i="${esc(id)}" onclick="seiteWeg=null;seiteSheet(this.dataset.i)">Zurück</button>
      <button class="btn btn-pri" data-i="${esc(id)}" onclick="seiteUiLoeschen(this.dataset.i)">Entfernen</button></div>`;
    return;
  }
  seiteWeg = null;
  seiteLoeschen(id);
  if(typeof showSheet==='function') showSheet(false);
  seiteAuffrischen();
  if(typeof toast==='function') toast('Seite entfernt');
}

/* ═══════════ 5. Zeichnen ═══════════ */

/* Der Listenbereich einer NICHT eingebauten Seite. Die zwei eingebauten
   zeichnet weiterhin ui/standards.js — dort hängen Suche, Merkmalsleiste und
   Sortierung dran, und die sollen nicht zweimal existieren. */
function seitenZeichnen(seite, suche){
  const a = seitenArt(seite && seite.art);
  if(!a || !a.zeichne) return '';
  try{ return a.zeichne(seite, suche) || ''; }
  catch(e){ return `<div class="empty"><div class="ei">⚠</div><h3>Diese Seite lässt sich gerade nicht zeichnen</h3><p>${esc(String(e&&e.message||e))}</p></div>`; }
}

/* ═══════════ 6. Verwaltung ═══════════ */

function seitenPanelHTML(){
  const zeilen = seitenAlle().map(s=>{
    const a = seitenArt(s.art) || {};
    return `<div class="fkt-zeile${s.aus?' fkt-aus':''}">
      <div class="fkt-haupt">
        <div class="pf-vz">
          <input class="loc-input pf-vico" value="${esc(s.ico)}" maxlength="4" data-i="${esc(s.id)}"
            onchange="seitenPanelFeld(this.dataset.i,'ico',this.value)" aria-label="Symbol">
          <input class="loc-input fkt-name" value="${esc(s.wort)}" data-i="${esc(s.id)}"
            onchange="seitenPanelFeld(this.dataset.i,'wort',this.value)" aria-label="Wort">
        </div>
        <div class="fkt-sub">${esc(a.wort||s.art)} — ${esc(a.sub||'')}${s.eingebaut?' · Auslieferung':''}</div>
      </div>
      <div class="fkt-akt">
        <button data-i="${esc(s.id)}" onclick="seiteUiVerschieben(this.dataset.i,-1)" aria-label="nach oben">⬆</button>
        <button data-i="${esc(s.id)}" onclick="seiteUiVerschieben(this.dataset.i,1)" aria-label="nach unten">⬇</button>
        <button class="${s.aus?'':'dgr'}" data-i="${esc(s.id)}" onclick="seiteUiSchalten(this.dataset.i)">${s.aus?'Einblenden':'Ausblenden'}</button>
      </div></div>`;
  }).join('');
  const head = (typeof vsum==='function')
    ? vsum('🗄','Seiten der Startseite','Welche Reiter oben stehen — Wort, Symbol, Reihenfolge, an/aus',
           seitenGeaendert()?'angepasst':'')
    : `<summary>🗄 Seiten</summary>`;
  return `<details class="vpanel" data-keys="seiten reiter startseite tabs standards anleitungen aufgaben aktuelles bestellungen pinnwand">
    ${head}<div class="vpanel-body">
    <p class="panel-help">Die Leiste oben ist eine <b>Liste</b>. Der Code kennt die <i>Arten</i> (was eine Seite tut), du legst die <i>Seiten</i> an. Am schnellsten geht es direkt dort: <b>lang auf einen Reiter tippen</b>. Dieselbe Art darf mehrfach vorkommen — zwei Aufgaben-Seiten „Täglich" und „Wartung" sind eine Einstellung, keine Programmierung.</p>
    <div class="fkt-liste">${zeilen}</div>
    <div class="p-actions">
      <button class="btn btn-sec" onclick="seiteNeuSheet()">＋ Seite anlegen</button>
      <button class="btn btn-sec" onclick="seitenPanelZuruecksetzen()">Auf Auslieferung zurücksetzen</button>
    </div></div></details>`;
}
function seitenPanelFeld(id, feld, wert){
  const s = seiteNach(id); if(!s) return;
  const a = seitenArt(s.art) || {};
  const v = String(wert||'').trim();
  seiteSetzen(id, feld, (v === a[feld]) ? '' : v);
  if(typeof renderAdmin==='function') renderAdmin();
  if(typeof toast==='function') toast('Übernommen');
}
function seitenPanelZuruecksetzen(){
  seitenZuruecksetzen();
  if(typeof curSeg!=='undefined') curSeg = 'standard';
  if(typeof renderAdmin==='function') renderAdmin();
  if(typeof toast==='function') toast('Seiten auf Auslieferung zurückgesetzt');
}
