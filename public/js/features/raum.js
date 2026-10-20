/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — NEUAUFBAU (der zweite Raum)

   Wozu: Der Bestand läuft im Labor jeden Tag. Daneben soll die App von
   Grund auf neu eingerichtet werden können — leer, ohne die eingelesenen
   Word-Standards, ohne Material, ohne Bilder —, um zu sehen, wie ein Haus mit
   ihr anfinge, und um die Standards gleich im Format der App statt im alten
   Word-Format aufzubauen. Ob am Ende alles, einzelne Stücke oder nichts davon
   in den Bestand übergeht, entscheidet der Test.

   Die Trennung selbst liegt NICHT hier, sondern an zwei Stellen, die jede
   Anfrage passieren muss:
     · auf dem Gerät: core/store.js (Präfix je Raum, eine einzige Stelle)
     · auf dem Server: server/raeume.js (eigener Ordner je Raum)
   Hier steht nur, was man SIEHT und BEDIENT: die Karte in der Verwaltung, das
   Zweitpasswort, die Leiste, die im Neuaufbau nie verschwindet, und der Weg
   hinaus.

   Das Zweitpasswort ist — wie das Verwaltungspasswort — Komfort, keine
   Sicherheit (Grundsatz A9): Es hält Kolleginnen davon ab, versehentlich im
   Testraum zu landen. Gegen Absicht schützt es nicht.
   ───────────────────────────────────────────────────────────── */

/* ═══════════ 1. Das Zweitpasswort ═══════════ */

/* Liegt im geteilten Zustand des BESTANDS (Schlüssel hkl_raumpw): einmal
   festgelegt, gilt es auf jedem Gerät. Nur der Fingerabdruck wird gespeichert
   (pwHash, core/config.js), nie das Wort.
   Gespeichert wird er als JSON (saveJSON), nicht als roher Text: Der Abgleich
   (core/sync.js) schickt nur, was sich als JSON lesen lässt — ein roher Text
   bliebe still auf diesem einen Gerät liegen. */
function raumPwFingerabdruck(){ const v=loadJSON('hkl_raumpw', null); return (typeof v==='string' && v) ? v : null; }
function raumPwGesetzt(){ return !!raumPwFingerabdruck(); }
function raumPwStimmt(pw){ return !!pw && raumPwGesetzt() && pwHash(pw)===raumPwFingerabdruck(); }
function raumPwSetzen(pw){ saveJSON('hkl_raumpw', pwHash(pw)); }

/* Mindestens vier Zeichen — ein leeres oder einstelliges Passwort wäre nur
   eine zusätzliche Taste, kein Riegel. */
const RAUM_PW_MIN = 4;
function raumPwPruefeNeu(a, b){
  if(!a || a.trim().length < RAUM_PW_MIN) return 'Bitte mindestens '+RAUM_PW_MIN+' Zeichen.';
  if(a !== b) return 'Die beiden Eingaben stimmen nicht überein.';
  if(typeof checkPw==='function' && checkPw(a)) return 'Bitte ein ANDERES Passwort als das der Verwaltung.';
  return '';
}

/* ═══════════ 1b. Neuerungen und ihre Freigabe ═══════════ */

/* Was im Neuaufbau NEU gebaut wird, erscheint zunächst NUR dort. Der Bestand
   sieht davon nichts — bis eine Neuerung hier ausdrücklich für ihn
   freigegeben wird. So lässt sich stückweise übernehmen, was sich im Test
   bewährt hat, ohne den Rest mitzunehmen.
   Jeder Baustein fragt nur `neuFrei('<schlüssel>')`; die Wörter hier sind
   Beschreibung, der Schlüssel trägt die Bedeutung (Grundsatz ④). */
const NEU_FUNKTIONEN = [
  { key:'fotorollen',     titel:'Bildrollen am Produkt',       text:'Jedes Foto trägt seine Rolle: Etikett, Produkt, Verpackung. Schnellknöpfe „Etikett fotografieren" und „Produkt fotografieren".' },
  { key:'synonyme',       titel:'Synonyme am Produkt',         text:'Andere Bezeichnungen, unter denen ein Produkt gefunden wird.' },
  { key:'refpruefung',    titel:'REF als Zweitschlüssel',      text:'Warnt, bevor dieselbe Bestellnummer an einem zweiten Produkt gespeichert wird.' },
  { key:'verpackung',     titel:'Verpackungsstufen',           text:'Karton-GTIN mit Stückzahl an der Einheit; ein gescannter Karton findet sein Produkt; Prüfziffer bei Handeingabe; Hinweise aus AccessGUDID.' },
  { key:'materialexport', titel:'Material-Export (Excel/SAP)', text:'Tabelle mit GTIN, REF, Name, Hersteller, Packungsgröße, Preisen — wahlweise mit allen Bildern als ZIP.' },
  { key:'editor',         titel:'Editor am PC',                text:'Geteilter Bildschirm: Bibliothek links, Standard rechts — ankreuzen und ziehen, auch zwischen Rubriken.' },
  { key:'beziehungen',    titel:'Zubehör & Aufbereitung',      text:'„braucht dazu" und „neu ↔ aufbereitet" zwischen Produkten festhalten.' },
];
/* Freigaben liegen im geteilten Zustand des BESTANDS (hkl_neufrei). */
let NEUFREI = loadJSON('hkl_neufrei', {});
function neuFreiNormal(){ if(!NEUFREI || typeof NEUFREI!=='object' || Array.isArray(NEUFREI)) NEUFREI = {}; }
neuFreiNormal();
function neuFrei(key){
  if(RAUM.neu) return true;
  neuFreiNormal();
  return NEUFREI[key]===true;
}
/* Freigaben verwalten nur, wer das Zweitpasswort kennt — die Karte ist für
   alle Angemeldeten sichtbar, die Schalter erst nach dem Passwort. Die
   Entsperrung gilt bis zum Neuladen. */
let raumFreigabeOffen = false;
function raumFreigabeEntsperren(){
  const f = $('raumPwFrei');
  if(!raumPwStimmt(f ? f.value : '')){ toast('Passwort für den Neuaufbau stimmt nicht.', true); return; }
  raumFreigabeOffen = true;
  if(typeof renderAdmin==='function') renderAdmin();
  setTimeout(()=>{ const d=$('raumFreigaben'); if(d){ d.open=true; const karte=d.closest('details.vpanel'); if(karte) karte.open=true;
    try{ d.scrollIntoView({block:'center'}); }catch(e){} } }, 50);
}
function raumFreigabeSetzen(key, an){
  if(!raumFreigabeOffen || RAUM.neu) return;
  if(!NEU_FUNKTIONEN.some(f=>f.key===key)) return;
  neuFreiNormal();
  if(an) NEUFREI[key] = true; else delete NEUFREI[key];
  saveJSON('hkl_neufrei', NEUFREI);
  toast(an ? 'Für den Bestand freigegeben' : 'Im Bestand wieder ausgeblendet');
}
function raumFreigabenHTML(){
  neuFreiNormal();
  const n = NEU_FUNKTIONEN.filter(f=>NEUFREI[f.key]===true).length;
  let h = `<details class="raum-aendern" id="raumFreigaben"><summary>Neuerungen für den Bestand freigeben (${n} von ${NEU_FUNKTIONEN.length})</summary>`;
  if(!raumFreigabeOffen){
    h += `<p class="hint">Was im Neuaufbau neu entsteht, bleibt dort, bis es hier einzeln freigegeben wird. Dazu das Passwort des Neuaufbaus:</p>
      <input type="password" class="txtinp" style="width:100%" id="raumPwFrei" autocomplete="off" onkeydown="if(event.key==='Enter')raumFreigabeEntsperren()">
      <div class="p-actions" style="margin-top:8px"><button class="btn btn-sec" onclick="raumFreigabeEntsperren()">Freigaben anzeigen</button></div>`;
  } else {
    h += `<p class="hint">Eingeschaltet = erscheint auch im Bestand, für alle. Ausschalten blendet es wieder aus; Daten gehen dabei nicht verloren.</p>`;
    NEU_FUNKTIONEN.forEach(f=>{
      h += `<label class="tgl"><span><b>${esc(f.titel)}</b><br><span class="hint">${esc(f.text)}</span></span>
        <input type="checkbox" ${NEUFREI[f.key]===true?'checked':''} data-k="${esc(f.key)}" onchange="raumFreigabeSetzen(this.dataset.k,this.checked)"></label>`;
    });
  }
  return h + '</details>';
}

/* ═══════════ 2. Betreten und Verlassen ═══════════ */

/* Wechselt den Raum: Wahl setzen, Offenes an den Server geben, neu laden.
   Neu laden ist Absicht — jeder Baustein der App liest seine Daten beim
   Start; ein Wechsel im laufenden Betrieb ließe Reste des alten Raums in
   irgendeiner Variablen stehen. */
async function raumWechseln(id, sitzungBis){
  if(!raumWaehlen(id, sitzungBis)){
    toast('Dieses Gerät kann sich die Raumwahl nicht merken (Speicher gesperrt, z. B. Privatmodus).', true);
    return false;
  }
  try{ if(typeof sync!=='undefined' && sync.leeren) await sync.leeren(2500); }catch(e){}
  try{ location.reload(); }catch(e){}
  return true;
}

function raumBetretenAusPanel(){
  const f = $('raumPwEin');
  const pw = f ? f.value : '';
  if(!raumPwStimmt(pw)){ toast('Passwort für den Neuaufbau stimmt nicht.', true); if(f){ f.value=''; f.focus(); } return; }
  toast('Neuaufbau wird geöffnet …');
  raumWechseln('neuaufbau', Date.now()+AUTH_TTL);
}

function raumFestlegenAusPanel(){
  const a = ($('raumPwNeu1')||{}).value || '';
  const b = ($('raumPwNeu2')||{}).value || '';
  const fehler = raumPwPruefeNeu(a, b);
  if(fehler){ toast(fehler, true); return; }
  raumPwSetzen(a.trim());
  toast('Passwort festgelegt — Neuaufbau wird geöffnet …');
  raumWechseln('neuaufbau', Date.now()+AUTH_TTL);
}

function raumPwAendernAusPanel(){
  const alt = ($('raumPwAlt')||{}).value || '';
  const a = ($('raumPwAend1')||{}).value || '';
  const b = ($('raumPwAend2')||{}).value || '';
  if(!raumPwStimmt(alt)){ toast('Bisheriges Passwort stimmt nicht.', true); return; }
  const fehler = raumPwPruefeNeu(a, b);
  if(fehler){ toast(fehler, true); return; }
  raumPwSetzen(a.trim());
  toast('Passwort für den Neuaufbau geändert');
  if(typeof renderAdmin==='function') renderAdmin();
}

/* Hinaus geht es immer ohne Passwort — wer drin ist, darf auch gehen. */
function raumVerlassen(){
  toast('Zurück zum Bestand …');
  raumWechseln('bestand', 0);
}

/* ═══════════ 3. Die Leiste, die nie verschwindet ═══════════ */

/* Im Neuaufbau steht über allem ein farbiges Band. Es sitzt IN der Kopfzeile
   (die beim Blättern stehen bleibt) und ist damit auf jedem Bildschirm zu
   sehen — niemand soll im Zweifel sein, in welchem Raum er gerade etwas
   ändert. Dazu Fenstertitel und Statusleistenfarbe. */
function raumLeisteZeigen(){
  if(RAUM.id==='bestand') return;
  try{ document.documentElement.classList.add('im-neuaufbau'); }catch(e){}
  const kopf = document.querySelector('header.bar');
  if(kopf && !$('raumLeiste')){
    const el = document.createElement('div');
    el.id = 'raumLeiste';
    el.className = 'raum-leiste';
    el.setAttribute('role','status');
    el.innerHTML = `<span class="rl-ico" aria-hidden="true">🧪</span>`
      + `<span class="rl-txt"><b>${esc(RAUM.titel.toUpperCase())}</b><span class="rl-sub"> · getrennter Raum — der Bestand bleibt unberührt</span></span>`
      + ((typeof notizOeffnen==='function') ? `<button type="button" class="rl-btn" id="notizBtn" onclick="notizOeffnen()">📝 Notiz</button>` : '')
      + `<button type="button" class="rl-btn" onclick="raumVerlassen()">Verlassen</button>`;
    kopf.insertBefore(el, kopf.firstChild);
    if(typeof notizZaehlerZeigen==='function') notizZaehlerZeigen();
  }
  try{ if(document.title.indexOf(RAUM.titel)!==0) document.title = RAUM.titel+' · '+document.title; }catch(e){}
  try{ const m=document.querySelector('meta[name="theme-color"]'); if(m) m.setAttribute('content','#7a2e8e'); }catch(e){}
}

/* ═══════════ 4. Die Karte in der Verwaltung ═══════════ */

/* Stand des Neuaufbaus auf dem Server (Zahl der Schlüssel, letzte Änderung)
   — wird beim Aufklappen nachgeladen, nicht bei jedem Zeichnen. */
let RAUMINFO = null;
async function raumInfoLaden(){
  try{
    const r = await fetch('/api/raeume', { cache:'no-store' });
    if(!r.ok) throw new Error('HTTP '+r.status);
    RAUMINFO = await r.json();
  }catch(e){ RAUMINFO = { fehler:true }; }
  const el = $('raumInfo');
  if(el) el.innerHTML = raumInfoHTML();
}
function raumInfoHTML(){
  const i = RAUMINFO;
  if(!i) return '<span class="hint">Stand auf dem Server wird geladen …</span>';
  if(i.fehler) return '<span class="hint">Stand auf dem Server nicht abrufbar (kein Netz?).</span>';
  const n = (i.raeume||[]).find(r=>r && r.id==='neuaufbau');
  if(!n) return '<span class="hint">Der Server kennt den Neuaufbau nicht.</span>';
  const wann = n.updatedAt ? new Date(n.updatedAt).toLocaleString('de-DE') : 'noch nie';
  const live = (i.live==='neuaufbau') ? ' · <b>live geschaltet</b>' : '';
  return `<div class="frg-feld"><span>Datenbereiche im Neuaufbau</span><b>${n.schluessel}</b></div>
    <div class="frg-feld"><span>Zuletzt geändert</span><b>${esc(wann)}</b></div>
    <p class="hint" style="margin-top:6px">Live ist derzeit: <b>${esc(i.live==='neuaufbau'?'Neuaufbau':'Bestand')}</b>${live}</p>`;
}

function raumPanelHTML(){
  const keys = 'neuaufbau raum zweiter raum test testraum leer neu aufbauen zweites passwort';
  if(RAUM.id!=='bestand'){
    return `<details class="vpanel" data-keys="${keys} verlassen zurück bestand">${vsum('🧪','Neuaufbau','Du bist im Neuaufbau — hier ist alles vom Bestand getrennt','aktiv')}<div class="vpanel-body">
      <p class="hint">Alles, was du hier anlegst — Standards, Material, Bilder —, liegt in einem eigenen Bereich auf dem Server mit eigenen Sicherungen. Der Bestand und die Kolleginnen im Labor merken davon nichts.</p>
      <p class="hint">Mitgeliefert ist nur das Wissen der App selbst: Herstellerliste fürs Etikett-Lesen, Merkmalskatalog (French, Länge …) und die Zerlegungsregeln. Keine Standards, kein Material, keine Bilder des Bestands.</p>
      <div class="flabel" style="margin-top:10px">Neuerungen, die hier schon laufen</div>
      ${NEU_FUNKTIONEN.map(f=>`<div class="frg-feld"><span>${esc(f.titel)}</span><b>${NEUFREI[f.key]===true?'auch im Bestand':'nur hier'}</b></div>`).join('')}
      <div class="p-actions"><button class="btn btn-pri" onclick="raumVerlassen()">Zurück zum Bestand</button></div>
    </div></details>`;
  }
  let body = `<p class="hint">Ein zweiter, vollständig getrennter Raum: eigene Daten, eigene Sicherungen, eigene Bilder auf dem Server. Er beginnt <b>leer</b> — keine Standards, kein Material, keine Bilder. Was dort geschieht, erreicht den Bestand nicht; hier im Labor wird ungestört weitergearbeitet.</p>`;
  if(raumPwGesetzt()){
    body += `<div class="flabel" style="margin-top:10px">Passwort für den Neuaufbau</div>
      <input type="password" class="txtinp" style="width:100%" id="raumPwEin" autocomplete="off" onkeydown="if(event.key==='Enter')raumBetretenAusPanel()">
      <div class="p-actions" style="margin-top:8px"><button class="btn btn-pri" onclick="raumBetretenAusPanel()">Neuaufbau betreten</button></div>
      <details class="raum-aendern"><summary>Passwort ändern</summary>
        <input type="password" class="txtinp" style="width:100%;margin-top:6px" id="raumPwAlt" placeholder="bisheriges Passwort" autocomplete="off">
        <input type="password" class="txtinp" style="width:100%;margin-top:6px" id="raumPwAend1" placeholder="neues Passwort" autocomplete="off">
        <input type="password" class="txtinp" style="width:100%;margin-top:6px" id="raumPwAend2" placeholder="neues Passwort wiederholen" autocomplete="off">
        <div class="p-actions" style="margin-top:8px"><button class="btn btn-sec" onclick="raumPwAendernAusPanel()">Passwort ändern</button></div>
      </details>`;
  } else {
    body += `<p class="hint"><b>Noch kein Passwort festgelegt.</b> Lege es jetzt fest — danach ist der Neuaufbau nur damit zu betreten. Es muss sich vom Passwort der Verwaltung unterscheiden.</p>
      <input type="password" class="txtinp" style="width:100%" id="raumPwNeu1" placeholder="Passwort für den Neuaufbau" autocomplete="off">
      <input type="password" class="txtinp" style="width:100%;margin-top:6px" id="raumPwNeu2" placeholder="wiederholen" autocomplete="off" onkeydown="if(event.key==='Enter')raumFestlegenAusPanel()">
      <div class="p-actions" style="margin-top:8px"><button class="btn btn-pri" onclick="raumFestlegenAusPanel()">Festlegen und betreten</button></div>`;
  }
  body += `<div id="raumInfo" style="margin-top:10px">${raumInfoHTML()}</div>`;
  if(raumPwGesetzt()) body += raumFreigabenHTML();
  return `<details class="vpanel" data-keys="${keys}" ontoggle="if(this.open)raumInfoLaden()">${vsum('🧪','Neuaufbau','Zweiter, leerer Raum zum Neuaufbau — getrennt vom Bestand, mit eigenem Passwort')}<div class="vpanel-body">${body}</div></details>`;
}
