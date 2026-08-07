/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — WO BILDER STEHEN DÜRFEN (das Bilder-Register)

   Bilder ließen sich längst an vielen Stellen anhängen und wieder entfernen.
   Was fehlte, war der Schalter davor.

   Der Betreiber: „Bilder müssen überall hinzufügbar oder auch wegnehmbar
   sein … ich möchte das Icon und auch die Bilder allgemein möchte ich
   anschalten oder ausschalten können."

   Zwei verschiedene Wünsche stecken darin, und sie brauchen zwei Schalter:

     ① DIE BILDER. In einer Rubrik mit vierzig Zeilen kann ein Bilderstreifen
        unter jeder Zeile die Liste unlesbar machen. Dann will man die Bilder
        an DIESER Art von Stelle weghaben — aber nicht löschen.
     ② DAS SYMBOL. Auch ohne ein einziges Bild steht im Verwaltungsmodus
        überall ein „🖼 Bild hinzufügen". Wer an einer Stelle grundsätzlich
        keine Bilder will, will auch die Aufforderung dazu nicht sehen.

   Beides ist rücknehmbar und beides löscht nichts: Ausgeschaltete Bilder
   bleiben gespeichert und sind sofort wieder da (Grundsatz ②). Genau deshalb
   ist das hier ein Schalter und keine Löschfunktion.

   ── Wieder dasselbe Muster ──
   Der Code kennt die STELLEN-ARTEN (eine Zeile, eine Rubrik, ein Aushang …).
   Das Haus entscheidet je Art: Bilder an/aus, Symbol an/aus, wie es heißt.
   Ausgeliefert ist alles an — wer nichts einstellt, merkt nichts (Grundsatz ①).
   ───────────────────────────────────────────────────────────── */

/* ═══════════ 1. Die Stellen, die der Code kennt ═══════════ */

const BILD_ORTE = [
  { key:'eintrag',      ico:'🖼', wort:'An einer Zeile',
    sub:'Fotos unter einem Material oder einem Schritt' },
  { key:'rubrik',       ico:'🖼', wort:'An einer Rubrik',
    sub:'Oben in der Rubrik, vor der ersten Zeile' },
  { key:'unterkategorie', ico:'🖼', wort:'An einer Unterkategorie',
    sub:'Am Kopf einer aufklappbaren Gruppe' },
  { key:'abschnitt',    ico:'🖼', wort:'An einem Abschnitt',
    sub:'Am Kopf eines Abschnitts innerhalb der Rubrik' },
  { key:'standardkopf', ico:'🖼', wort:'Im Kopf des Standards',
    sub:'Ganz oben, über allen Rubriken' },
  { key:'aushang',      ico:'🖼', wort:'An einem Aushang',
    sub:'Ein Foto auf der Pinnwand — „so sieht das Gerät gerade aus"' },
];
function bildOrtArt(key){ return BILD_ORTE.find(o=>o.key===key) || null; }

/* Von einer konkreten Stelle auf ihre Art schließen. Anker tragen ihre Art im
   Namen, alles andere ist eine Zeile (die cid). */
function bildArtVonOrt(ort){
  const s = String(ort||'');
  if(s.indexOf('std:')===0) return 'standardkopf';
  if(s.indexOf('rub:')===0) return 'rubrik';
  if(s.indexOf('uk:')===0)  return 'unterkategorie';
  if(s.indexOf('seg:')===0) return 'abschnitt';
  if(s.indexOf('akt:')===0) return 'aushang';
  return 'eintrag';
}

/* ═══════════ 2. Was das Haus daraus macht ═══════════ */

/* { alles:false, orte:{ eintrag:{aus:true, ohneKnopf:true, wort:'…', ico:'…'} } } */
let BILDORTE = (typeof loadJSON==='function') ? loadJSON('hkl_bildorte', {}) : {};
if(!BILDORTE || typeof BILDORTE!=='object') BILDORTE = {};
function saveBildOrte(){ if(typeof saveJSON==='function') saveJSON('hkl_bildorte', BILDORTE); }

function bildOrtRoh(key){ return (BILDORTE.orte && BILDORTE.orte[key]) || {}; }

/* Die aufgelöste Liste — Auslieferungswerte, überschrieben von den eigenen. */
function bildOrte(){
  return BILD_ORTE.map(o=>{
    const e = bildOrtRoh(o.key);
    return { key:o.key, sub:o.sub,
      wort:(e.wort!=null && e.wort!=='') ? e.wort : o.wort,
      ico: (e.ico!=null  && e.ico!=='')  ? e.ico  : o.ico,
      aus:!!e.aus, ohneKnopf:!!e.ohneKnopf };
  });
}
function bildOrtNach(key){ return bildOrte().find(o=>o.key===key) || null; }

/* Der große Schalter: Bilder überhaupt anzeigen. Bewusst getrennt von den
   einzelnen Stellen — „heute mal alles ohne Bilder" ist ein anderer Wunsch als
   „an der Zeile nie". */
function bildAllesAn(){ return !BILDORTE.alles; }
function bildAllesSchalten(an){
  if(an===undefined) an = !bildAllesAn();
  if(an) delete BILDORTE.alles; else BILDORTE.alles = 'aus';
  saveBildOrte(); return bildAllesAn();
}

function bildOrtSetzen(key, feld, wert){
  if(!bildOrtArt(key)) return false;
  BILDORTE.orte = BILDORTE.orte || {};
  const e = BILDORTE.orte[key] = BILDORTE.orte[key] || {};
  const leer = (wert===null || wert===undefined || wert==='' || wert===false);
  if(leer) delete e[feld]; else e[feld] = wert;
  /* Kein Rest: Eine Einstellung, die wieder auf die Vorgabe fällt, hinterlässt
     nichts. Sonst sähe die Verwaltung „angepasst", obwohl alles wie
     ausgeliefert steht. */
  if(!Object.keys(e).length) delete BILDORTE.orte[key];
  if(!Object.keys(BILDORTE.orte).length) delete BILDORTE.orte;
  saveBildOrte(); return true;
}
function bildOrtSchalten(key){
  const o = bildOrtNach(key); if(!o) return false;
  return bildOrtSetzen(key, 'aus', !o.aus);
}
function bildKnopfSchalten(key){
  const o = bildOrtNach(key); if(!o) return false;
  return bildOrtSetzen(key, 'ohneKnopf', !o.ohneKnopf);
}
function bildOrteZuruecksetzen(){ BILDORTE = {}; saveBildOrte(); }
function bildOrteGeaendert(){
  return !!(BILDORTE.alles || (BILDORTE.orte && Object.keys(BILDORTE.orte).length));
}

/* ═══════════ 3. Die zwei Fragen, die der Rest der App stellt ═══════════ */

/* Werden an DIESER Stelle Bilder gezeigt? */
function bildZeigen(ort){
  if(!bildAllesAn()) return false;
  const o = bildOrtNach(bildArtVonOrt(ort));
  return !(o && o.aus);
}
/* Steht an dieser Stelle der Weg zum Hinzufügen? Nur im Verwaltungsmodus —
   und nur, wenn hier überhaupt Bilder gezeigt werden: ein Knopf, der etwas
   anlegt, das man danach nicht sieht, ist eine Falle. */
function bildKnopfZeigen(ort){
  if(typeof ADMIN!=='undefined' && !ADMIN) return false;
  if(!bildZeigen(ort)) return false;
  const o = bildOrtNach(bildArtVonOrt(ort));
  return !(o && o.ohneKnopf);
}
function bildOrtWort(ort){ const o=bildOrtNach(bildArtVonOrt(ort)); return o ? o.wort : 'Bilder'; }
function bildOrtIco(ort){ const o=bildOrtNach(bildArtVonOrt(ort)); return o ? o.ico : '🖼'; }

/* ═══════════ 4. Verwaltung ═══════════ */

function bildortePanelHTML(){
  const alles = bildAllesAn();
  const zeilen = bildOrte().map(o=>{
    const zahl = (typeof bildOrtBestand==='function') ? bildOrtBestand(o.key) : 0;
    return `<div class="fkt-zeile${(!alles||o.aus)?' fkt-aus':''}">
      <div class="fkt-haupt">
        <div class="pf-vz">
          <input class="loc-input pf-vico" value="${esc(o.ico)}" maxlength="4" data-k="${esc(o.key)}"
            onchange="bildPanelFeld(this.dataset.k,'ico',this.value)" aria-label="Symbol">
          <input class="loc-input fkt-name" value="${esc(o.wort)}" data-k="${esc(o.key)}"
            onchange="bildPanelFeld(this.dataset.k,'wort',this.value)" aria-label="Wort">
        </div>
        <div class="fkt-sub">${esc(o.sub)}${zahl?` · ${zahl} Bild${zahl===1?'':'er'} hier`:''}</div>
      </div>
      <div class="fkt-akt">
        <button class="${o.aus?'':'dgr'}" data-k="${esc(o.key)}" onclick="bildPanelSchalten(this.dataset.k)">${o.aus?'Bilder an':'Bilder aus'}</button>
        <button class="${o.ohneKnopf?'':'dgr'}" data-k="${esc(o.key)}" onclick="bildPanelKnopf(this.dataset.k)" title="Der Weg zum Hinzufügen im Verwaltungsmodus">${o.ohneKnopf?'Symbol an':'Symbol aus'}</button>
      </div></div>`;
  }).join('');
  const head = (typeof vsum==='function')
    ? vsum('🏞','Wo Bilder stehen','Je Stelle: Bilder an/aus, Symbol an/aus, wie es heißt',
           bildOrteGeaendert()?'angepasst':'')
    : `<summary>🏞 Wo Bilder stehen</summary>`;
  return `<details class="vpanel" data-keys="bilder fotos bildorte anzeigen ausblenden symbol icon streifen">
    ${head}<div class="vpanel-body">
    <p class="panel-help">Hier wird <b>nichts gelöscht</b>. Ausgeschaltete Bilder bleiben gespeichert und sind sofort wieder da, sobald du den Schalter zurücklegst. „Bilder aus" nimmt sie an dieser Art von Stelle aus der Anzeige; „Symbol aus" nimmt nur den Weg zum Hinzufügen weg — vorhandene Bilder bleiben sichtbar.</p>
    <div class="p-actions" style="margin-bottom:10px">
      <button class="btn ${alles?'btn-sec':'btn-pri'}" onclick="bildPanelAlles()">${alles?'Alle Bilder ausblenden':'Bilder wieder anzeigen'}</button>
    </div>
    ${alles?'':`<div class="hint" style="padding:6px 4px">Bilder sind gerade <b>überall</b> ausgeblendet. Die einzelnen Schalter unten wirken erst wieder, wenn du sie oben einschaltest.</div>`}
    <div class="fkt-liste">${zeilen}</div>
    <div class="p-actions">
      <button class="btn btn-sec" onclick="bildPanelZuruecksetzen()">Auf Auslieferung zurücksetzen</button>
    </div></div></details>`;
}

/* Wie viele Bilder an einer Art von Stelle hängen — damit „aus" nicht wie
   „weg" aussieht: die Zahl bleibt stehen. */
function bildOrtBestand(key){
  let n = 0;
  if(typeof MEDANK!=='undefined' && MEDANK){
    Object.keys(MEDANK).forEach(a=>{
      if(bildArtVonOrt(a)===key) n += (typeof medPaare==='function') ? medPaare(MEDANK[a]).length : 0;
    });
  }
  /* Bilder an Zeilen hängen am Eintrag selbst, nicht an einem Anker — dafür
     muss der Bestand einmal durchlaufen werden. Das passiert nur beim Öffnen
     der Verwaltungskarte, nicht auf dem heißen Weg. */
  if(key==='eintrag' && typeof DB!=='undefined' && DB && DB.standards && typeof cidOf==='function'){
    DB.standards.forEach(s=>{
      (s.rubriken||[]).forEach((r,ri)=>{
        (r.sub_bereiche||[]).forEach((sb,si)=>{ (sb.eintraege||[]).forEach((e,ei)=>{
          if(!e) return;
          const b = (typeof medPaareVonEintrag==='function')
            ? medPaareVonEintrag(e, cidOf(s.id,ri,si,ei)) : [];
          n += b.length;
        }); });
      });
    });
  }
  return n;
}

function bildPanelAuffrischen(){
  if(typeof renderAdmin==='function') renderAdmin();
  if(typeof toast==='function') toast('Übernommen');
}
function bildPanelFeld(key, feld, wert){
  const a = bildOrtArt(key) || {};
  const v = String(wert||'').trim();
  bildOrtSetzen(key, feld, (v === a[feld]) ? '' : v);
  bildPanelAuffrischen();
}
function bildPanelSchalten(key){
  bildOrtSchalten(key);
  if(typeof renderAdmin==='function') renderAdmin();
  const o = bildOrtNach(key);
  if(typeof toast==='function') toast(o && o.aus ? 'Ausgeblendet — die Bilder bleiben gespeichert' : 'Wieder sichtbar');
}
function bildPanelKnopf(key){
  bildKnopfSchalten(key);
  if(typeof renderAdmin==='function') renderAdmin();
  const o = bildOrtNach(key);
  if(typeof toast==='function') toast(o && o.ohneKnopf ? 'Symbol weg — vorhandene Bilder bleiben sichtbar' : 'Symbol wieder da');
}
function bildPanelAlles(){
  const an = bildAllesSchalten();
  if(typeof renderAdmin==='function') renderAdmin();
  if(typeof toast==='function') toast(an ? 'Bilder werden wieder angezeigt' : 'Alle Bilder ausgeblendet — nichts ist gelöscht');
}
function bildPanelZuruecksetzen(){
  bildOrteZuruecksetzen();
  if(typeof renderAdmin==='function') renderAdmin();
  if(typeof toast==='function') toast('Bildstellen auf Auslieferung zurückgesetzt');
}
