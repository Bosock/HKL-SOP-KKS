/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — AKTUELLES (die Pinnwand)

   Der Betreiber: „Hey, HKL 3 hat grad 'n Notfall aufliegen. Oder HKL 3 ist
   grade aufgrund von Wartungsarbeiten nicht belegt. Oder Achtung, heute
   Wartung vom Medizinproduktehersteller ab zwölf Uhr."

   Alles drei hat dieselbe Bauart: Es gilt JETZT, es gilt für einen ORT, und
   es hört irgendwann auf zu gelten. Genau das ist der Unterschied zu einem
   Hinweis am Standard (features/hints.js), der dauerhaft dort steht.

   ── Die eine Entscheidung, die alles trägt: die Gültigkeit ──
   Jeder Aushang hat ein Ende. Ohne das verwandelt sich eine Pinnwand
   innerhalb von zwei Wochen in eine Tapete, die niemand mehr liest — und
   dann geht der eine Aushang unter, auf den es ankam. Abgelaufenes
   verschwindet automatisch aus der Ansicht, bleibt aber unter „Abgelaufen"
   lesbar; gelöscht wird nichts von allein (Grundsatz ②).

   Voreingestellt ist „bis heute Abend". Das ist die ehrlichste Vorgabe: Was
   länger gilt, sagt man ausdrücklich.

   ── Die Arten gehören dem Haus ──
   Notfall, Wartung, Sperrung, Info sind ausgeliefert — mit Wort, Symbol und
   Farbe, alles änderbar, und eigene Arten kommen dazu (Grundsatz ⑤ / A7).
   Der Code kennt nur den Schlüssel; die Farbe entscheidet, wie laut es ist.
   ───────────────────────────────────────────────────────────── */

/* ═══════════ 1. Die Arten ═══════════ */

const AKT_ARTEN_VORGABE = [
  { key:'notfall',  wort:'Notfall',  symbol:'🚨', farbe:'#e05a5a', laut:true },
  { key:'wartung',  wort:'Wartung',  symbol:'🔧', farbe:'#e0b23d' },
  { key:'sperrung', wort:'Gesperrt', symbol:'⛔', farbe:'#c86a3d' },
  { key:'info',     wort:'Info',     symbol:'ℹ️', farbe:'#3d9be0' },
];

let AKTARTEN = (typeof loadJSON==='function') ? loadJSON('hkl_aktuellarten', []) : [];
if(!Array.isArray(AKTARTEN)) AKTARTEN = [];
function saveAktArten(){ if(typeof saveJSON==='function') saveJSON('hkl_aktuellarten', AKTARTEN); }

function aktArten(){ return AKTARTEN.length ? AKTARTEN.slice().sort((a,b)=>(a.ord||0)-(b.ord||0)) : AKT_ARTEN_VORGABE; }
function aktArt(key){ return aktArten().find(a=>a.key===key) || aktArten()[0]; }
function aktArtenVerselbstaendigen(){
  if(!AKTARTEN.length) AKTARTEN = AKT_ARTEN_VORGABE.map((a,i)=>Object.assign({}, a, { ord:i }));
}
function aktArtSlug(wort){
  const s = String(wort||'').toLowerCase()
    .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  return s || '';
}
function aktArtAnlegen(wort){
  const w = String(wort||'').trim(); if(!w) return null;
  aktArtenVerselbstaendigen();
  let key = aktArtSlug(w); if(!key) return null;
  let n = 2; while(AKTARTEN.some(a=>a.key===key)) key = aktArtSlug(w)+'-'+(n++);
  const a = { key, wort:w, symbol:'📌', farbe:'#8a93a5', ord:AKTARTEN.length };
  AKTARTEN.push(a); saveAktArten(); return a;
}
function aktArtAendern(key, feld, wert){
  aktArtenVerselbstaendigen();
  const a = AKTARTEN.find(x=>x.key===key); if(!a) return false;
  a[feld] = wert; saveAktArten(); return true;
}
function aktArtLoeschen(key){
  aktArtenVerselbstaendigen();
  const i = AKTARTEN.findIndex(x=>x.key===key); if(i<0) return false;
  AKTARTEN.splice(i,1); saveAktArten(); return true;
}

/* ═══════════ 2. Die Aushänge ═══════════ */

let AKTU = (typeof loadJSON==='function') ? loadJSON('hkl_aktuelles', []) : [];
if(!Array.isArray(AKTU)) AKTU = [];
function saveAktu(){ if(typeof saveJSON==='function') saveJSON('hkl_aktuelles', AKTU); }

/* „bis heute Abend" — die ehrliche Vorgabe. */
function aktBisVorgabe(){
  const d = new Date(); d.setHours(23,59,0,0);
  return aktLokalISO(d);
}
/* Für <input type="datetime-local">: ohne Zeitzonen-Anhang, sonst zeigt der
   Browser eine andere Uhrzeit an, als der Mensch eingetippt hat. */
function aktLokalISO(d){
  const p = (n)=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes());
}
function aktZeit(iso){ const d=new Date(iso); return isNaN(d.getTime())?null:d; }

/* Gilt der Aushang JETZT? Rein/testbar — daran hängt die ganze Ansicht. */
function aktGilt(x, jetzt){
  const n = jetzt ? new Date(jetzt) : new Date();
  if(!x) return false;
  const von = x.von ? aktZeit(x.von) : null;
  const bis = x.bis ? aktZeit(x.bis) : null;
  if(von && n < von) return false;      /* noch nicht angefangen */
  if(bis && n > bis) return false;      /* abgelaufen */
  return true;
}
function aktGeltende(jetzt){ return AKTU.filter(x=>aktGilt(x, jetzt)); }
function aktAbgelaufene(jetzt){
  const n = jetzt ? new Date(jetzt) : new Date();
  return AKTU.filter(x=>x.bis && aktZeit(x.bis) && aktZeit(x.bis) < n);
}
function aktKuenftige(jetzt){
  const n = jetzt ? new Date(jetzt) : new Date();
  return AKTU.filter(x=>x.von && aktZeit(x.von) && aktZeit(x.von) > n);
}

function aktNeueId(){ return 'k'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function aktNach(id){ return AKTU.find(x=>x.id===id) || null; }

function aktAnlegen(felder){
  const f = felder || {};
  const wort = String(f.wort||'').trim(); if(!wort) return null;
  const x = { id:aktNeueId(), wort, text:String(f.text||'').trim(),
    art:f.art || aktArten()[0].key, ort:String(f.ort||'').trim(),
    von:f.von || null, bis:f.bis || aktBisVorgabe(),
    erstellt:new Date().toISOString(), kuerzel:(typeof kuerzel==='function')?kuerzel():'' };
  AKTU.unshift(x); saveAktu();
  return x;
}
function aktAendern(id, feld, wert){ const x=aktNach(id); if(!x) return false; x[feld]=wert; saveAktu(); return true; }
function aktLoeschen(id){ const i=AKTU.findIndex(x=>x.id===id); if(i<0) return false; AKTU.splice(i,1); saveAktu(); return true; }
/* Vorzeitig beenden: Ende auf jetzt. Kein Löschen — wer nachliest, soll sehen,
   dass es galt und wann es aufhörte. */
function aktBeenden(id){ return aktAendern(id, 'bis', aktLokalISO(new Date())); }
/* Verlängern um Stunden — der häufigste Handgriff an einer Pinnwand. */
function aktVerlaengern(id, stunden){
  const x = aktNach(id); if(!x) return false;
  const basis = (x.bis && aktZeit(x.bis) && aktZeit(x.bis) > new Date()) ? aktZeit(x.bis) : new Date();
  basis.setHours(basis.getHours() + (Number(stunden)||1));
  return aktAendern(id, 'bis', aktLokalISO(basis));
}

/* Wie lange gilt es noch? Für die Zeile — „noch 2 Std." ist die Auskunft,
   die zählt. */
function aktRest(x, jetzt){
  const n = jetzt ? new Date(jetzt) : new Date();
  const bis = x && x.bis ? aktZeit(x.bis) : null;
  if(!bis) return 'ohne Ende';
  const min = Math.round((bis - n) / 60000);
  if(min < 0) return 'abgelaufen';
  if(min < 60) return 'noch '+min+' Min.';
  const std = Math.round(min/60);
  if(std < 24) return 'noch '+std+' Std.';
  return 'noch '+Math.round(std/24)+' Tage';
}

/* ═══════════ 3. Die Seite ═══════════ */

let aktForm = null;        /* null | 'neu' | <id> */
let aktZeigeAlt = false;

function aktuellSeiteHTML(seite, suche){
  const q = String(suche||'').trim().toLowerCase();
  const istAdmin = (typeof ADMIN!=='undefined') && ADMIN;
  let gilt = aktGeltende();
  let kuenftig = aktKuenftige();
  if(q){
    const f = (x)=>((x.wort||'')+' '+(x.text||'')+' '+(x.ort||'')).toLowerCase().indexOf(q)>=0;
    gilt = gilt.filter(f); kuenftig = kuenftig.filter(f);
  }
  /* Lautes zuerst — ein Notfall steht nicht unter einer Info. */
  const rang = (x)=>{ const a=aktArt(x.art); return a && a.laut ? 0 : 1; };
  gilt = gilt.slice().sort((a,b)=>rang(a)-rang(b) || String(b.erstellt||'').localeCompare(String(a.erstellt||'')));

  let html = `<div class="banner"><h2>📌 ${esc((seite&&seite.wort)||'Aktuelles')}</h2>
    <p>Was gerade gilt: Notfall, Wartung, Sperrung. Jeder Aushang hat ein Ende — sonst wird die Pinnwand zur Tapete, und der eine wichtige geht unter.</p></div>`;

  if(istAdmin && aktForm==='neu') html += aktFormHTML(null);
  else if(istAdmin) html += `<button class="add-entry-btn" onclick="aktUiNeu()">＋ Aushang anlegen</button>`;

  if(!gilt.length && !kuenftig.length){
    html += `<div class="empty"><div class="ei">📌</div><h3>${q?'Nichts gefunden':'Nichts Aktuelles'}</h3>
      <p>${q?'Kein Treffer.':'Kein Notfall, keine Wartung, keine Sperrung. So soll es sein.'}</p></div>`;
  }

  gilt.forEach(x=>{
    if(istAdmin && aktForm===x.id){ html += aktFormHTML(x); return; }
    html += aktKarteHTML(x, istAdmin, false);
  });
  if(kuenftig.length){
    html += `<div class="bez-sec">Angekündigt</div>`;
    kuenftig.forEach(x=>{ html += aktKarteHTML(x, istAdmin, false, true); });
  }

  const alt = aktAbgelaufene();
  if(alt.length){
    html += `<button type="button" class="add-entry-btn" onclick="aktUiAlt()">${aktZeigeAlt?'⌄':'›'} Abgelaufen (${alt.length})</button>`;
    if(aktZeigeAlt) alt.slice(0,40).forEach(x=>{ html += aktKarteHTML(x, istAdmin, true); });
  }
  return html;
}

function aktKarteHTML(x, istAdmin, abgelaufen, kuenftig){
  const a = aktArt(x.art);
  const rest = kuenftig ? ('ab '+aktWann(x.von)) : aktRest(x);
  return `<div class="akt-karte${abgelaufen?' akt-alt':''}${a&&a.laut?' akt-laut':''}" data-i="${esc(x.id)}" style="--akt:${esc((a&&a.farbe)||'#8a93a5')}">
    <div class="akt-kopf">
      <span class="akt-art">${esc((a&&a.symbol)||'📌')} ${esc((a&&a.wort)||'')}</span>
      ${x.ort?`<span class="akt-ort">📍 ${esc(x.ort)}</span>`:''}
      <span class="akt-rest">${esc(rest)}</span>
    </div>
    <div class="akt-wort">${esc(x.wort)}</div>
    ${x.text?`<div class="akt-text">${esc(x.text)}</div>`:''}
    ${(typeof medAnkerHTML==='function')?medAnkerHTML(medAnkAkt(x.id), x.wort):''}
    <div class="akt-fuss">${esc(aktWann(x.erstellt))}${x.kuerzel?(' · '+esc(x.kuerzel)):''}</div>
    ${istAdmin?`<div class="akt-akt">
      ${abgelaufen?'':`<button type="button" data-i="${esc(x.id)}" onclick="aktUiVerlaengern(this.dataset.i,2)">+2 Std.</button>
      <button type="button" data-i="${esc(x.id)}" onclick="aktUiBeenden(this.dataset.i)">Beenden</button>`}
      <button type="button" data-i="${esc(x.id)}" onclick="aktUiBearbeiten(this.dataset.i)">✎</button>
    </div>`:''}</div>`;
}
function aktWann(iso){
  const d = aktZeit(iso); if(!d) return '';
  return (typeof kuerzelZeit==='function') ? kuerzelZeit(d.getTime()) : d.toLocaleString('de-DE');
}

function aktFormHTML(x){
  const arten = aktArten();
  return `<div class="auf-form">
    <div class="flabel">${x?'AUSHANG BEARBEITEN':'NEUER AUSHANG'}</div>
    <input class="loc-input" id="aktWort" placeholder="Worum geht es? z. B. HKL 3 — Notfall aufliegend" value="${esc(x?x.wort:'')}">
    <textarea class="loc-input" id="aktText" rows="2" placeholder="Erklärung (optional)" style="margin-top:8px">${esc(x?x.text:'')}</textarea>
    <div class="form-row" style="margin-top:8px">
      <select class="form-sel" id="aktArt">${arten.map(a=>`<option value="${esc(a.key)}"${x&&x.art===a.key?' selected':''}>${esc(a.symbol)} ${esc(a.wort)}</option>`).join('')}</select>
      <input class="loc-input" id="aktOrt" placeholder="Ort, z. B. HKL 3" value="${esc(x?x.ort:'')}">
    </div>
    <div class="flabel" style="margin-top:8px">GILT BIS</div>
    <input class="loc-input" id="aktBis" type="datetime-local" value="${esc(x?(x.bis||''):aktBisVorgabe())}">
    <p class="hint">Ab wann es gilt, ist meistens „jetzt". Für eine Ankündigung („ab 12 Uhr") das Feld unten ausfüllen.</p>
    <input class="loc-input" id="aktVon" type="datetime-local" value="${esc((x&&x.von)||'')}">
    <div class="p-actions" style="margin-top:10px">
      <button class="btn btn-sec" onclick="aktUiAbbrechen()">Abbrechen</button>
      ${x?`<button class="btn btn-sec" style="color:#d64545" data-i="${esc(x.id)}" onclick="aktUiLoeschen(this.dataset.i)">Löschen</button>`:''}
      <button class="btn btn-pri" data-i="${esc(x?x.id:'')}" onclick="aktUiSpeichern(this.dataset.i)">Speichern</button>
    </div></div>`;
}

/* ── Bedienung ── */
function aktUiNeu(){ aktForm='neu'; seiteAuffrischen(); setTimeout(()=>{ const i=$('aktWort'); if(i) i.focus(); },50); }
function aktUiBearbeiten(id){ aktForm=id; seiteAuffrischen(); }
function aktUiAbbrechen(){ aktForm=null; seiteAuffrischen(); }
function aktUiAlt(){ aktZeigeAlt=!aktZeigeAlt; seiteAuffrischen(); }
function aktUiSpeichern(id){
  const wort = ($('aktWort')&&$('aktWort').value||'').trim();
  if(!wort){ if(typeof toast==='function') toast('Bitte sagen, worum es geht',true); return; }
  const felder = { wort, text:($('aktText')&&$('aktText').value)||'', art:($('aktArt')&&$('aktArt').value)||'',
    ort:($('aktOrt')&&$('aktOrt').value)||'', bis:($('aktBis')&&$('aktBis').value)||null,
    von:($('aktVon')&&$('aktVon').value)||null };
  const tun = ()=>{
    if(id){ Object.keys(felder).forEach(k=>aktAendern(id,k,felder[k])); }
    else aktAnlegen(felder);
    aktForm=null; seiteAuffrischen();
    if(typeof toast==='function') toast(id?'Gespeichert':'Ausgehängt');
  };
  if(typeof kuerzelDannn==='function') kuerzelDannn(tun); else tun();
}
function aktUiLoeschen(id){ aktLoeschen(id); aktForm=null; seiteAuffrischen(); if(typeof toast==='function') toast('Entfernt'); }
function aktUiBeenden(id){ aktBeenden(id); seiteAuffrischen(); if(typeof toast==='function') toast('Beendet — bleibt unter „Abgelaufen" lesbar'); }
function aktUiVerlaengern(id, std){ aktVerlaengern(id, std); seiteAuffrischen(); if(typeof toast==='function') toast('Um '+std+' Stunden verlängert'); }

/* ═══════════ 4. Verwaltung der Arten ═══════════ */

let aktArtNeu = false;
function aktuellPanelHTML(){
  const arten = aktArten();
  const zeilen = arten.map(a=>`<div class="ber-zeile">
      <input class="loc-input ber-sym" value="${esc(a.symbol||'')}" maxlength="4" data-k="${esc(a.key)}"
        onchange="aktPanelFeld(this.dataset.k,'symbol',this.value)" aria-label="Symbol">
      <input class="loc-input" value="${esc(a.wort)}" data-k="${esc(a.key)}"
        onchange="aktPanelFeld(this.dataset.k,'wort',this.value)" aria-label="Wort">
      <input type="color" class="ber-farbe" value="${esc(a.farbe||'#8a93a5')}" data-k="${esc(a.key)}"
        oninput="aktPanelFeld(this.dataset.k,'farbe',this.value)" aria-label="Farbe">
      <div class="ber-akt">
        <button class="${a.laut?'on':''}" data-k="${esc(a.key)}" onclick="aktPanelLaut(this.dataset.k)" title="Laut: steht immer oben">${a.laut?'🔊':'🔈'}</button>
        <button class="dgr" data-k="${esc(a.key)}" onclick="aktPanelWeg(this.dataset.k)">Löschen</button>
      </div></div>`).join('');
  const head = (typeof vsum==='function')
    ? vsum('📌','Arten für „Aktuelles"','Notfall, Wartung, Sperrung … — Wort, Symbol, Farbe, Lautstärke',
           AKTARTEN.length?'angepasst':'')
    : `<summary>📌 Arten</summary>`;
  return `<details class="vpanel" data-keys="aktuelles pinnwand notfall wartung sperrung aushang arten">
    ${head}<div class="vpanel-body">
    <p class="panel-help">Die Arten bestimmen Symbol, Farbe und Rang eines Aushangs. „Laut" heißt: steht immer oben — für den Notfall. Die Aushänge selbst legst du auf der Seite <b>Aktuelles</b> an.</p>
    ${zeilen}
    ${aktArtNeu
      ? `<div class="eig-neu"><input class="loc-input" id="aktArtInp" placeholder="Name, z. B. Personalmangel">
          <div class="p-actions"><button class="btn btn-sec" onclick="aktPanelNeuAb()">Abbrechen</button><button class="btn btn-pri" onclick="aktPanelNeuSpeichern()">Anlegen</button></div></div>`
      : `<div class="p-actions"><button class="btn btn-sec" onclick="aktPanelNeu()">＋ Art anlegen</button></div>`}
    </div></details>`;
}
function aktPanelFeld(key, feld, wert){ aktArtAendern(key, feld, String(wert||'').trim()); if(typeof renderAdmin==='function') renderAdmin(); if(typeof toast==='function') toast('Übernommen'); }
function aktPanelLaut(key){ const a=aktArt(key); aktArtAendern(key,'laut',!(a&&a.laut)); if(typeof renderAdmin==='function') renderAdmin(); }
function aktPanelWeg(key){ aktArtLoeschen(key); if(typeof renderAdmin==='function') renderAdmin(); if(typeof toast==='function') toast('Art entfernt — vorhandene Aushänge bleiben'); }
function aktPanelNeu(){ aktArtNeu=true; if(typeof renderAdmin==='function') renderAdmin(); setTimeout(()=>{ const i=$('aktArtInp'); if(i) i.focus(); },50); }
function aktPanelNeuAb(){ aktArtNeu=false; if(typeof renderAdmin==='function') renderAdmin(); }
function aktPanelNeuSpeichern(){
  const i=$('aktArtInp'); const w=(i&&i.value||'').trim();
  if(!w){ if(typeof toast==='function') toast('Bitte einen Namen eingeben',true); return; }
  aktArtAnlegen(w); aktArtNeu=false;
  if(typeof renderAdmin==='function') renderAdmin();
  if(typeof toast==='function') toast('Art „'+w+'" angelegt');
}
