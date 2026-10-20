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
   Zweitpasswort, der Live-Schalter, das Band über allem, solange man NICHT im
   Live-Raum ist, und der Weg hinaus.

   Das Zweitpasswort ist — wie das Verwaltungspasswort — Komfort, keine
   Sicherheit (Grundsatz A9): Es hält Kolleginnen davon ab, versehentlich im
   Testraum zu landen oder versehentlich umzuschalten. Gegen Absicht schützt
   es nicht.
   ───────────────────────────────────────────────────────────── */

/* ═══════════ 1. Das Zweitpasswort ═══════════ */

/* Vorgabe ist „abcdefg". Wird es in der Verwaltung geändert, liegt der neue
   Fingerabdruck im geteilten Zustand des BESTANDS (Schlüssel hkl_raumpw) und
   gilt auf jedem Gerät. Gespeichert wird nur der Fingerabdruck (pwHash,
   core/config.js), nie das Wort — und zwar als JSON (saveJSON), nicht als
   roher Text: Der Abgleich (core/sync.js) schickt nur, was sich als JSON lesen
   lässt; ein roher Text bliebe still auf diesem einen Gerät liegen.
   Der Server prüft beim Live-Schalter gegen denselben Fingerabdruck
   (server/raeume.js, erwarteterFingerabdruck) — die Vorgabe steht dort
   wortgleich. */
const RAUM_PW_VORGABE = 'abcdefg';
function raumPwFingerabdruck(){ const v=loadJSON('hkl_raumpw', null); return (typeof v==='string' && v) ? v : pwHash(RAUM_PW_VORGABE); }
function raumPwStimmt(pw){ return !!pw && pwHash(pw)===raumPwFingerabdruck(); }
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
   irgendeiner Variablen stehen.
   Wer in den LIVE-Raum geht, behält keine eigene Wahl: Das Gerät folgt dann
   wieder dem Zeiger des Servers (und damit jedem späteren Umschalten). Nur
   ein Raum, der gerade NICHT live ist, wird als eigene Wahl gemerkt. */
async function raumWechseln(id, sitzungBis){
  const wahl = (id===raumLiveGemerkt()) ? null : id;
  if(!raumWaehlen(wahl, sitzungBis)){
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

/* Hinaus geht es immer ohne Passwort — wer drin ist, darf auch gehen. Hinaus
   heißt: in den Raum, der gerade live ist. */
function raumVerlassen(){
  const live = raumLiveGemerkt();
  toast(live==='bestand' ? 'Zurück zum Bestand …' : 'Zum '+RAEUME_DEF[live].titel+' (live) …');
  raumWechseln(live, 0);
}

/* Ist der Neuaufbau live, bleibt der alte Bestand unverändert erhalten —
   zum Nachsehen ohne Passwort (die Verwaltung, in der dieser Knopf steht, ist
   ohnehin nur angemeldet erreichbar). */
function raumBestandAnsehen(){
  toast('Der alte Bestand wird geöffnet …');
  raumWechseln('bestand', 0);
}

/* ═══════════ 2b. Live schalten ═══════════ */

/* „Live" ist der Raum, mit dem jedes Gerät ohne eigene Raumwahl arbeitet —
   also das Labor. Der Schalter setzt den Zeiger auf dem Server (PUT
   /api/raeume); die Geräte folgen beim nächsten Start oder Aufwecken bzw.
   nach zwei Minuten Ruhe (core/sync.js). Daten werden dabei NICHT bewegt:
   Jeder Raum behält seinen Stand, Zurückschalten ist dieselbe Handbewegung.
   Verlangt werden das Passwort des Neuaufbaus (der Server prüft es, nicht
   dieses Gerät — im Neuaufbau kennt es den Fingerabdruck des Bestands gar
   nicht) und ein Häkchen als Bestätigung. */
let raumLiveLaeuft = false;
async function raumLiveSchalten(ziel){
  if(raumLiveLaeuft || !raumBekannt(ziel)) return;
  const f = $('raumPwLive'), ok = $('raumLiveOk');
  const pw = f ? f.value : '';
  if(!pw){ toast('Bitte das Passwort des Neuaufbaus eingeben.', true); if(f) f.focus(); return; }
  if(!ok || !ok.checked){ toast('Bitte zuerst mit dem Häkchen bestätigen, dass alle Geräte umschalten sollen.', true); return; }
  raumLiveLaeuft = true;
  let r = null, j = null;
  try{
    r = await fetch('/api/raeume', { method:'PUT', cache:'no-store', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ live:ziel, pw:pwHash(pw) }) });
    try{ j = await r.json(); }catch(e){ j = null; }
  }catch(e){ r = null; }
  raumLiveLaeuft = false;
  if(!r){ toast('Server nicht erreichbar — es wurde nichts umgeschaltet.', true); return; }
  if(r.status===403){ toast('Passwort für den Neuaufbau stimmt nicht.', true); if(f){ f.value=''; f.focus(); } return; }
  if(!r.ok || !j || j.live!==ziel){ toast('Umschalten fehlgeschlagen (HTTP '+r.status+') — es bleibt, wie es war.', true); return; }
  raumLiveMerken(ziel);
  try{ if(typeof diagLog==='function') diagLog('system','Live geschaltet: '+ziel); }catch(e){}
  const titel = RAEUME_DEF[ziel].titel;
  if(RAUM.id!==ziel){
    /* Wer umschaltet, geht mit. */
    toast('Live ist jetzt der '+titel+' — dieses Gerät wechselt mit …');
    raumWechseln(ziel, Date.now()+AUTH_TTL);
    return;
  }
  /* Schon im neuen Live-Raum: keine eigene Wahl mehr nötig, Band weg. */
  if(RAUM.wahl) raumWaehlen(null);
  toast('Live ist jetzt der '+titel+'. Die Geräte im Labor wechseln beim nächsten Start oder Aufwecken.');
  raumLeisteZeigen();
  raumKarteNeu();
}

/* ═══════════ 3. Das Band — überall, wo man NICHT im Live-Raum ist ═══════════ */

/* Außerhalb des Live-Raums steht über allem ein farbiges Band. Es sitzt IN
   der Kopfzeile (die beim Blättern stehen bleibt) und ist damit auf jedem
   Bildschirm zu sehen — niemand soll im Zweifel sein, in welchem Raum er
   gerade etwas ändert. Dazu Fenstertitel und Statusleistenfarbe.
   Im Live-Raum gibt es kein Band: Das ist die App, wie alle sie benutzen.
   Ist also der Neuaufbau live geschaltet, verschwindet sein Band — und wer
   den alten Bestand ansieht, bekommt eines.
   Wird beim Start und nach jedem Blick auf den Live-Zeiger aufgerufen
   (core/sync.js) und bringt das Band jeweils auf den Stand. */
const RAUM_FARBE = { neuaufbau:'#7a2e8e', bestand:'#6b4f12' };
function raumLeisteZeigen(){
  const live = raumLiveGemerkt();
  const da = $('raumLeiste');
  const praefix = RAUM.titel+' · ';
  const meta = document.querySelector('meta[name="theme-color"]');
  if(RAUM.id===live){
    if(da) da.remove();
    try{ document.documentElement.classList.remove('raum-nicht-live'); }catch(e){}
    try{ if(document.title.indexOf(praefix)===0) document.title = document.title.slice(praefix.length); }catch(e){}
    try{ if(meta && meta.dataset.vorher){ meta.setAttribute('content', meta.dataset.vorher); delete meta.dataset.vorher; } }catch(e){}
    return;
  }
  try{ document.documentElement.classList.add('raum-nicht-live'); }catch(e){}
  const kopf = document.querySelector('header.bar');
  if(kopf && !da){
    const neu = RAUM.id==='neuaufbau';
    const el = document.createElement('div');
    el.id = 'raumLeiste';
    el.className = 'raum-leiste' + (neu ? '' : ' rl-alt');
    el.setAttribute('role','status');
    const sub = neu ? ' · getrennter Raum — der Bestand bleibt unberührt'
                    : ' · nicht live — live ist der '+RAEUME_DEF[live].titel;
    el.innerHTML = `<span class="rl-ico" aria-hidden="true">${neu?'🧪':'🗄️'}</span>`
      + `<span class="rl-txt"><b>${esc(RAUM.titel.toUpperCase())}</b><span class="rl-sub">${esc(sub)}</span></span>`
      + ((neu && typeof notizOeffnen==='function') ? `<button type="button" class="rl-btn" id="notizBtn" onclick="notizOeffnen()">📝 Notiz</button>` : '')
      + `<button type="button" class="rl-btn" title="Zum Live-Raum (${esc(RAEUME_DEF[live].titel)})" onclick="raumVerlassen()">Verlassen</button>`;
    kopf.insertBefore(el, kopf.firstChild);
    if(typeof notizZaehlerZeigen==='function') notizZaehlerZeigen();
  }
  try{ if(document.title.indexOf(praefix)!==0) document.title = praefix+document.title; }catch(e){}
  try{ if(meta){ if(!meta.dataset.vorher) meta.dataset.vorher = meta.getAttribute('content')||''; meta.setAttribute('content', RAUM_FARBE[RAUM.id]||'#7a2e8e'); } }catch(e){}
}

/* ═══════════ 4. Die Karte in der Verwaltung ═══════════ */

/* Stand auf dem Server (Live-Zeiger, Zahl der Schlüssel, letzte Änderung) —
   wird beim Aufklappen nachgeladen, nicht bei jedem Zeichnen. Meldet der
   Server einen anderen Live-Raum als gemerkt, wird die Karte neu gezeichnet:
   Was sie anbietet, hängt davon ab. */
let RAUMINFO = null;
async function raumInfoLaden(){
  try{
    const r = await fetch('/api/raeume', { cache:'no-store' });
    if(!r.ok) throw new Error('HTTP '+r.status);
    RAUMINFO = await r.json();
  }catch(e){ RAUMINFO = { fehler:true }; }
  if(RAUMINFO && raumBekannt(RAUMINFO.live) && RAUMINFO.live!==raumLiveGemerkt()){
    raumLiveMerken(RAUMINFO.live);
    raumLeisteZeigen();
    raumKarteNeu();
    return;
  }
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
  const seit = i.geaendert ? ' · umgeschaltet am '+new Date(i.geaendert).toLocaleString('de-DE') : '';
  return `<div class="frg-feld"><span>Datenbereiche im Neuaufbau</span><b>${n.schluessel}</b></div>
    <div class="frg-feld"><span>Zuletzt geändert</span><b>${esc(wann)}</b></div>
    <p class="hint" style="margin-top:6px">Live ist auf dem Server: <b>${esc(i.live==='neuaufbau'?'Neuaufbau':'Bestand')}</b>${esc(seit)}</p>`;
}
/* Karte neu zeichnen und wieder aufklappen (renderAdmin zeichnet alles zu). */
function raumKarteNeu(){
  if(typeof renderAdmin!=='function' || !$('raumKarte')) return;
  renderAdmin();
  setTimeout(()=>{ const d=$('raumKarte'); if(d) d.open=true; }, 30);
}

/* Der Live-Schalter: schaltet immer auf den Raum, der gerade NICHT live ist. */
function raumLiveHTML(){
  const live = raumLiveGemerkt();
  const ziel = (live==='bestand') ? 'neuaufbau' : 'bestand';
  const knopf = (ziel==='neuaufbau') ? 'Neuaufbau live schalten' : 'Bestand wieder live schalten';
  const wirkung = (ziel==='neuaufbau')
    ? 'Danach arbeiten alle Geräte ohne eigene Raumwahl — also das Labor — mit dem Neuaufbau. Sie wechseln beim nächsten Start oder Aufwecken, sonst nach zwei Minuten Ruhe; wer gerade tippt, wird nicht unterbrochen, sondern sieht ein Band mit dem Knopf zum Wechseln. Der Bestand bleibt dabei unverändert erhalten.'
    : 'Danach arbeiten alle Geräte ohne eigene Raumwahl wieder mit dem Bestand — mit genau dem Stand, den er beim Umschalten hatte. Was im Neuaufbau entstanden ist, bleibt dort erhalten.';
  return `<details class="raum-aendern" id="raumLiveKarte"><summary>Live schalten · live ist derzeit der ${esc(RAEUME_DEF[live].titel)}</summary>
    <p class="hint">${esc(wirkung)} Zurückschalten geht jederzeit mit demselben Knopf.</p>
    <input type="password" class="txtinp" style="width:100%" id="raumPwLive" placeholder="Passwort des Neuaufbaus" autocomplete="off">
    <label class="tgl" style="margin-top:6px"><span>Ja — ab jetzt soll der <b>${esc(RAEUME_DEF[ziel].titel)}</b> für alle live sein.</span><input type="checkbox" id="raumLiveOk"></label>
    <div class="p-actions" style="margin-top:8px"><button class="btn btn-live" id="raumLiveBtn" data-ziel="${ziel}" onclick="raumLiveSchalten(this.dataset.ziel)">${esc(knopf)}</button></div>
  </details>`;
}

function raumPwAendernHTML(){
  return `<details class="raum-aendern" id="raumPwAendern"><summary>Passwort des Neuaufbaus ändern</summary>
    <input type="password" class="txtinp" style="width:100%;margin-top:6px" id="raumPwAlt" placeholder="bisheriges Passwort" autocomplete="off">
    <input type="password" class="txtinp" style="width:100%;margin-top:6px" id="raumPwAend1" placeholder="neues Passwort" autocomplete="off">
    <input type="password" class="txtinp" style="width:100%;margin-top:6px" id="raumPwAend2" placeholder="neues Passwort wiederholen" autocomplete="off">
    <div class="p-actions" style="margin-top:8px"><button class="btn btn-sec" onclick="raumPwAendernAusPanel()">Passwort ändern</button></div>
  </details>`;
}

function raumPanelHTML(){
  const keys = 'neuaufbau raum zweiter raum test testraum leer neu aufbauen zweites passwort live schalten liveschalten umschalten live-raum';
  const live = raumLiveGemerkt();
  const info = `<div id="raumInfo" style="margin-top:10px">${raumInfoHTML()}</div>`;
  const auf = `ontoggle="if(this.open)raumInfoLaden()"`;
  if(RAUM.id!=='bestand'){
    const istLive = (live===RAUM.id);
    const kopf = istLive
      ? `<p class="hint"><b>Der Neuaufbau ist live.</b> Alle Geräte ohne eigene Raumwahl arbeiten hier. Der alte Bestand ist unverändert erhalten — zum Ansehen oder um ihn wieder live zu schalten.</p>`
      : `<p class="hint">Alles, was du hier anlegst — Standards, Material, Bilder —, liegt in einem eigenen Bereich auf dem Server mit eigenen Sicherungen. Der Bestand und die Kolleginnen im Labor merken davon nichts.</p>
      <p class="hint">Mitgeliefert ist nur das Wissen der App selbst: Herstellerliste fürs Etikett-Lesen, Merkmalskatalog (French, Länge …) und die Zerlegungsregeln. Keine Standards, kein Material, keine Bilder des Bestands.</p>`;
    const weg = istLive
      ? `<button class="btn btn-sec" onclick="raumBestandAnsehen()">Alten Bestand ansehen</button>`
      : `<button class="btn btn-pri" onclick="raumVerlassen()">Zurück zum Bestand</button>`;
    return `<details class="vpanel" id="raumKarte" data-keys="${keys} verlassen zurück bestand" ${auf}>${vsum('🧪','Neuaufbau', istLive?'Der Neuaufbau ist live — der alte Bestand bleibt erhalten':'Du bist im Neuaufbau — hier ist alles vom Bestand getrennt', istLive?'live':'aktiv')}<div class="vpanel-body">
      ${kopf}
      <div class="flabel" style="margin-top:10px">Neuerungen, die hier schon laufen</div>
      ${NEU_FUNKTIONEN.map(f=>`<div class="frg-feld"><span>${esc(f.titel)}</span><b>${NEUFREI[f.key]===true?'auch im Bestand':'nur hier'}</b></div>`).join('')}
      <div class="p-actions">${weg}</div>
      ${info}
      ${raumLiveHTML()}
    </div></details>`;
  }
  let body;
  if(live==='bestand'){
    body = `<p class="hint">Ein zweiter, vollständig getrennter Raum: eigene Daten, eigene Sicherungen, eigene Bilder auf dem Server. Er beginnt <b>leer</b> — keine Standards, kein Material, keine Bilder. Was dort geschieht, erreicht den Bestand nicht; hier im Labor wird ungestört weitergearbeitet.</p>
      <div class="flabel" style="margin-top:10px">Passwort für den Neuaufbau</div>
      <input type="password" class="txtinp" style="width:100%" id="raumPwEin" autocomplete="off" onkeydown="if(event.key==='Enter')raumBetretenAusPanel()">
      <div class="p-actions" style="margin-top:8px"><button class="btn btn-pri" onclick="raumBetretenAusPanel()">Neuaufbau betreten</button></div>`;
  } else {
    body = `<p class="hint"><b>Live ist der Neuaufbau.</b> Du siehst den alten Bestand — mit dem Stand, den er beim Umschalten hatte. Was du hier änderst, erreicht den Live-Betrieb nicht.</p>
      <div class="p-actions" style="margin-top:8px"><button class="btn btn-pri" onclick="raumVerlassen()">Zum Neuaufbau (live)</button></div>`;
  }
  body += raumPwAendernHTML() + info + raumLiveHTML() + raumFreigabenHTML();
  return `<details class="vpanel" id="raumKarte" data-keys="${keys}" ${auf}>${vsum('🧪','Neuaufbau', live==='bestand'?'Zweiter, leerer Raum zum Neuaufbau — getrennt vom Bestand, mit eigenem Passwort':'Der Neuaufbau ist live — du siehst den alten Bestand', live==='bestand'?'':'live')}<div class="vpanel-body">${body}</div></details>`;
}
