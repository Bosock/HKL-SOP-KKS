/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — REICHWEITE UND PRÜFBLATT

   Zwei Beschwerden, eine Ursache:

   ① „Ich möchte für jede einzelne Rubrik in diesem Material sagen können, so
      und so weit reichend ist die Änderung." — Bisher galt EINE Reichweite
      für ALLE geänderten Felder eines Vorgangs. Wer den Namen nur hier, die
      Größe aber überall ändern wollte, musste zweimal speichern. Und das
      wusste niemand.

   ② „Was wurde jetzt mit welcher Reichweite wie geändert und was wird
      schlussendlich gespeichert? Das ist bisher nicht gut sichtbar."

   Beides löst dasselbe: ein PRÜFBLATT vor dem Speichern. Es zeigt Zeile für
   Zeile, was sich ändert — vorher, nachher — und wie weit es reicht. Jede
   Zeile trägt ihre EIGENE Reichweite, änderbar mit einem Tipp. Erst danach
   gibt es einen Speichern-Knopf.

   Das ist der Stand der Technik für Massenänderungen: Vorschau vor der
   Ausführung, Rücknahme danach. Die Rücknahme gibt es längst (🧾 Regeln &
   Journal); die Vorschau fehlte.

   ── Warum das verantwortbar ist ──
   Feingranulare Vererbung ist mächtig und wird ohne sichtbares Zeichen zum
   Labyrinth. Deshalb steht die abweichende Reichweite hier IMMER sichtbar am
   Feld, und der Inspektor („🔍 Warum so?") zeigt danach je Eigenschaft die
   ganze Kaskade.

   ── Kein natives Fenster ──
   Die alte Bestätigung war ein confirm(). In installierten PWAs erscheint das
   auf mehreren Android-Chrome-Versionen nicht (Grundsatz ⑧). Das Prüfblatt
   ersetzt es vollständig.
   ───────────────────────────────────────────────────────────── */

/* ═══════════ 1. Die Treppe ═══════════ */

/* Alle Reichweiten, die an DIESER Stelle überhaupt in Frage kommen — mit
   Trefferzahl, damit „überall" keine Überraschung ist.

   Die Merkmals-Stufen (🏷) erscheinen nur, wenn
     · das Merkmal in der Verwaltung dafür freigegeben ist UND
     · dieser Standard das Merkmal auch trägt.
   Sonst stünde dort eine Reichweite, die den Eintrag vor sich selbst
   versteckt — man würde eine Regel anlegen, die hier nicht gilt. */
function rwStufen(cid, mk){
  const aus = [];
  const treffer = (wo)=>{ try{ return (typeof ruleHits==='function') ? ruleHits(mk, wo) : null; }catch(e){ return null; } };
  /* Jede Stufe trägt ZWEI Sprachebenen:
       wort / sub    kurz — für Chips, wo Platz knapp ist
       lang / langSub  ausgeschrieben — für das Menü, wo man entscheidet
     Ein Chip mit „In der Gruppe „HKL" · betrifft 23 Vorkommen in 9 Standards"
     wäre unlesbar; ein Menüpunkt „Gruppe · 23× / 9 Std." wäre zu knapp für
     eine Entscheidung, die 23 Stellen ändert. */
  aus.push({ key:'cid', ico:'📍', wort:'Nur hier', sub:'diese eine Stelle',
    lang:'Nur hier', langSub:'nur an dieser Stelle', wo:{art:'stelle',wert:cid} });

  const sid = (typeof cidStd==='function') ? cidStd(cid) : null;
  if(sid){
    const h = treffer({art:'standard',wert:sid});
    if(h) aus.push({ key:'std', ico:'📄', wort:'Standard', sub:h.vorkommen+'× hier',
      lang:'In diesem Standard', langSub:'betrifft '+h.vorkommen+'× hier',
      wo:{art:'standard',wert:sid}, hits:h });
  }
  const grp = (sid && typeof stdGruppeById==='function') ? stdGruppeById(sid) : null;
  if(grp){
    const h = treffer({art:'gruppe',wert:grp});
    if(h) aus.push({ key:'grp', ico:'🗂', wort:'Gruppe „'+grp+'"', sub:h.vorkommen+'× / '+h.standards.length+' Std.',
      lang:'In der Gruppe „'+grp+'"', langSub:'betrifft '+h.vorkommen+' Vorkommen in '+h.standards.length+' Standards',
      wo:{art:'gruppe',wert:grp}, hits:h, weit:true });
  }
  if(sid && typeof eigReichweiten==='function'){
    eigReichweiten().forEach(e=>{
      if(typeof eigHat==='function' && !eigHat(sid, e.key)) return;
      const wo = {art:'eigenschaft',wert:e.key};
      const h = treffer(wo);
      if(h) aus.push({ key:'eig:'+e.key, ico:'🏷', wort:'alle mit „'+e.wort+'"',
        sub:h.vorkommen+'× / '+h.standards.length+' Std.',
        lang:'In allen mit „'+e.wort+'"', langSub:'betrifft '+h.vorkommen+' Vorkommen in '+h.standards.length+' Standards',
        wo, hits:h, weit:true });
    });
  }
  const ha = treffer({art:'alle'});
  aus.push({ key:'mat', ico:'🌐', wort:'Überall', sub:ha?(ha.vorkommen+'× / '+ha.standards.length+' Std.'):'',
    lang:'Überall', langSub:ha?('betrifft '+ha.vorkommen+' Vorkommen in '+ha.standards.length+' Standards'):'',
    wo:{art:'alle'}, hits:ha, weit:true });
  return aus;
}
function rwStufe(cid, mk, key){
  const l = rwStufen(cid, mk);
  return l.find(x=>x.key===key) || l[0];
}
/* ═══════════ 2. Das Prüfblatt ═══════════ */

/* PB = { cid, mk, zeilen:[{prop, label, vorher, nachher, scope}], fertig }
   `fertig` ist die Rückkehr in den Aufrufer — das Prüfblatt weiß nicht, woher
   es gerufen wurde, und soll es auch nicht wissen. */
let PB = null;

function pbOeffnen(cid, aenderungen, voreinstellung, fertig){
  const e = (typeof findEntry==='function') ? findEntry(cid) : null;
  if(!e || !aenderungen || !aenderungen.length){ if(fertig) fertig(false); return; }
  const vor = voreinstellung || 'cid';
  /* Das Ziel einer Regel ist das Material — und wo es keines gibt, der TEXT
     der Zeile (features/rules.js). Vorher stand hier `e.material_key`, und
     genau deshalb war der Reichweiten-Knopf an jedem Handgriff für immer
     ausgegraut: „die Reichweiten Einstellung … können nicht angepasst
     werden!" */
  const ziel = (typeof ruleZielKey==='function') ? ruleZielKey(e) : (e.material_key||null);
  PB = {
    cid, mk: ziel,
    zeilen: aenderungen.map(c=>({
      prop: c.prop,
      label: (typeof rulePropLabel==='function') ? rulePropLabel(c.prop) : c.prop,
      vorher: c.vorher,
      nachher: c.value,
      scope: ziel ? vor : 'cid'
    })),
    fertig
  };
  pbZeichnen();
  if(typeof showSheet==='function') showSheet(true);
}

function pbWert(prop, wert){
  const t = (typeof ruleWertLabel==='function') ? ruleWertLabel(prop, wert) : String(wert==null?'':wert);
  return t || '—';
}

function pbZeichnen(){
  if(!PB) return;
  const mehrere = new Set(PB.zeilen.map(z=>z.scope)).size > 1;
  const weit = PB.zeilen.some(z=>{ const s=rwStufe(PB.cid, PB.mk, z.scope); return s && s.weit; });

  let h = `<div class="sheet-grip"></div><div class="sheet-title">Prüfen und speichern</div>`;
  h += `<p class="why-help">${PB.zeilen.length===1?'Diese Änderung':'Diese '+PB.zeilen.length+' Änderungen'} ${PB.zeilen.length===1?'wird':'werden'} gespeichert. Jede Zeile kann eine eigene Reichweite haben — tippen zum Ändern.</p>`;
  h += `<div class="pb-liste">`;
  PB.zeilen.forEach((z,i)=>{
    const s = rwStufe(PB.cid, PB.mk, z.scope);
    const zahl = (s && s.hits && s.key!=='cid') ? `<span class="pb-zahl">${s.hits.vorkommen}× in ${s.hits.standards.length} Standard${s.hits.standards.length===1?'':'s'}</span>` : '';
    h += `<div class="pb-zeile">
      <div class="pb-feld">${esc(z.label)}</div>
      <div class="pb-werte"><span class="pb-alt">${esc(pbWert(z.prop, z.vorher))}</span><span class="pb-pfeil">→</span><span class="pb-neu">${esc(pbWert(z.prop, z.nachher))}</span></div>
      <button type="button" class="pb-scope${(s&&s.weit)?' weit':''}" data-i="${i}" onclick="pbScopeWahl(+this.dataset.i)"
        ${PB.mk?'':'disabled title="Diese Zeile hat weder Material noch Text — sie kann nur hier gelten."'}>
        ${esc(s?(s.ico+' '+s.wort):'📍 Nur hier')}</button>
      ${zahl}
    </div>`;
  });
  h += `</div>`;
  /* Der häufige Fall: alle geänderten Felder sollen gleich weit gelten. Ohne
     diesen Knopf musste man jede Zeile einzeln durch ein Untermenü führen —
     bei fünf geänderten Feldern fünfmal. pbScopeAlle() gab es von Anfang an,
     nur den Weg dorthin nicht. */
  if(PB.zeilen.length>1 && PB.mk){
    h += `<div class="p-actions" style="padding:2px 4px 0">
      <button class="btn btn-sec" onclick="pbScopeAlleWahl()">Für alle Zeilen dieselbe Reichweite …</button></div>`;
  }
  if(mehrere) h += `<p class="hint" style="padding:0 4px">Verschiedene Reichweiten in einem Vorgang — das ist gewollt und wird so gespeichert.</p>`;
  if(weit) h += `<p class="pb-warn">Mindestens eine Änderung wirkt über diesen Standard hinaus. Alles bleibt unter <b>🧾 Regeln &amp; Journal</b> rücknehmbar.</p>`;
  h += `<div class="p-actions" style="padding:10px 4px 4px">
      <button class="btn btn-sec" onclick="pbAbbrechen()">Zurück</button>
      <button class="btn btn-pri" onclick="pbSpeichern()">Speichern</button>
    </div>`;
  $('sheet').innerHTML = h;
}

/* Reichweite EINER Zeile wählen. */
function pbScopeWahl(i){
  if(!PB || !PB.zeilen[i] || !PB.mk) return;
  const z = PB.zeilen[i];
  let h = `<div class="sheet-grip"></div><div class="sheet-title">Wie weit gilt „${esc(z.label)}"?</div>`;
  h += `<div class="sheet-chips"><span class="schip">${esc(pbWert(z.prop, z.nachher))}</span><span class="schip">👥 gilt auf allen Geräten</span></div><div class="sheet-pick">`;
  rwStufen(PB.cid, PB.mk).forEach(s=>{
    h += `<button class="sheet-pick-btn${s.key===z.scope?' sel':''}" data-i="${i}" data-s="${esc(s.key)}" onclick="pbScopeSetzen(+this.dataset.i,this.dataset.s)">
      ${s.ico} ${esc(s.lang||s.wort)} <span class="ps-sub">· ${esc(s.langSub||s.sub||'')}</span></button>`;
  });
  h += `</div><button class="sheet-close" onclick="pbZeichnen()">Zurück</button>`;
  $('sheet').innerHTML = h;
}
function pbScopeSetzen(i, key){
  if(!PB || !PB.zeilen[i]) return;
  PB.zeilen[i].scope = key;
  pbZeichnen();
}
/* Eine Reichweite für ALLE Zeilen auf einmal — der häufige Fall bleibt schnell. */
function pbScopeAlle(key){
  if(!PB) return;
  PB.zeilen.forEach(z=>{ z.scope = key; });
  pbZeichnen();
}
/* Die Auswahl dazu — dieselbe Treppe wie je Zeile, damit die Wörter überall
   dieselben sind (Grundsatz ⑥). */
function pbScopeAlleWahl(){
  if(!PB || !PB.mk) return;
  let h = `<div class="sheet-grip"></div><div class="sheet-title">Wie weit gilt alles?</div>`;
  h += `<p class="why-help">Die Wahl gilt für <b>alle ${PB.zeilen.length} Änderungen</b> dieses Vorgangs. Einzelne lassen sich danach noch abweichend setzen.</p>`;
  h += `<div class="sheet-pick">`;
  rwStufen(PB.cid, PB.mk).forEach(s=>{
    h += `<button class="sheet-pick-btn" data-s="${esc(s.key)}" onclick="pbScopeAlle(this.dataset.s)">
      ${s.ico} ${esc(s.lang||s.wort)} <span class="ps-sub">· ${esc(s.langSub||s.sub||'')}</span></button>`;
  });
  h += `</div><button class="sheet-close" onclick="pbZeichnen()">Zurück</button>`;
  $('sheet').innerHTML = h;
}

function pbAbbrechen(){
  const f = PB && PB.fertig; PB = null;
  if(typeof showSheet==='function') showSheet(false);
  if(f) f(false);
}

/* Schreiben: je Zeile genau EINE Regel mit IHRER Reichweite. */
function pbSpeichern(){
  if(!PB) return;
  const e = (typeof findEntry==='function') ? findEntry(PB.cid) : null;
  if(!e){ pbAbbrechen(); return; }
  const cid = PB.cid, mk = PB.mk;
  let n = 0, weit = 0;
  PB.zeilen.forEach(z=>{
    if(!mk){
      /* Weder Material noch Text → es gibt kein Ziel für eine Regel. Der
         Alt-Pfad schreibt an die Stelle, wie eh und je. */
      if(typeof qeSet==='function') qeSet('cid', e, cid, z.prop, z.nachher);
      n++; return;
    }
    const s = rwStufe(cid, mk, z.scope);
    if(!s) return;
    addRule(ruleZiel(e), s.wo, z.prop, z.nachher);
    if(s.wo.art==='stelle') clearLegacyAt(e, cid, 'stelle', z.prop);
    else if(s.wo.art==='alle') clearLegacyAt(e, cid, 'alle', z.prop);
    n++; if(s.weit) weit++;
  });
  if(typeof buildMaterialIndex==='function') buildMaterialIndex();
  if(typeof computeUkList==='function') computeUkList();
  const f = PB.fertig; PB = null;
  if(typeof showSheet==='function') showSheet(false);
  if(typeof toast==='function'){
    toast(weit ? (n+' Änderung'+(n===1?'':'en')+' gespeichert — rücknehmbar unter 🧾 Regeln & Journal')
               : (n===1?'Gespeichert':(n+' Änderungen gespeichert')));
  }
  if(f) f(true);
}
