/* ============ Ebene 3: Detail ============ */
function sizeBadges(g){ if(!settings.groessen||!g||!g.length) return ''; return g.map(x=>`<span class="size-badge"><span class="st">${esc(sizeLabel(x.typ))}</span>${esc(x.wert)}</span>`).join(''); }
function specTags(spez){ if(!settings.spez||!spez) return ''; const arr=Array.isArray(spez)?spez:[spez]; return arr.map(s=>{ const loc=/^Standort:/i.test(s); return `<span class="tag ${loc?'tag-loc':'tag-spec'}">${loc?'📍 '+esc(s.replace(/^Standort:\s*/i,'')):esc(s)}</span>`; }).join(''); }

/* Eintrag-Karte. NEU: Farbe und Symbol kommen aus der Kategorien-Konfiguration (natOf). */
function entryCardHTML(e,cid,isMatGer){
  const nat=effNatur(e,cid); const info=natOf(nat); const done=checks[cid]?'done':'';
  const showThumb=!!info.beschaffbar;
  const care=showThumb?careMem[e.material_key]:null;
  /* Destillation: ist das Material einem Produkt-Stammsatz zugeordnet, gewinnt
     dessen Foto/Identität (canonOf). Der Eintragstext bleibt unverändert. */
  const canon=(showThumb&&e.material_key&&typeof canonOf==='function')?canonOf(e.material_key):null;
  const thumbSrc=(canon&&canon.photo)||(care&&care.photo)||'';
  /* Auch das Produktfoto ist ein Bild: Antippen macht es groß (data-zoom,
     features/lightbox.js). Eine Regel für alle Bilder der App — sonst müsste
     man sich merken, welches Bild sich vergrößern lässt und welches nicht. */
  const thumbCap=canon?((canon.name||canon.ref||canon.gtin)||''):(e.anzeige_text||'');
  const thumb=thumbSrc?`<div class="e-thumb"><img src="${esc(thumbSrc)}" alt="${esc(thumbCap)}" data-zoom data-cap="${esc(thumbCap)}"></div>`:(showThumb?`<div class="e-thumb">📷</div>`:'');
  /* ZERLEGUNG (features/zerlegung.js): Ist der Text im Aufräum-Assistenten
     BESTÄTIGT worden, zeigt die Karte den sauberen Produktnamen und hängt
     Verwendung und Position als eigene Angaben daneben — statt alles in einem
     Word-Satz zu lassen.

     Drei Sicherungen, weil das die Anzeige im Saal betrifft:
       ① Nur BESTÄTIGTES. Ein bloßer Vorschlag ändert nichts an der Anzeige —
          eine automatische Zerlegung kann falsch sein, und im Saal wird nach
          dem Text gearbeitet.
       ② Der Originalsatz geht nie verloren: Er steht als Titel an der Zeile
          und lässt sich im Schnellmenü unter „Warum so?" nachlesen.
       ③ Abschaltbar (Anzeige-Einstellungen → „Aufgeräumte Anzeige"). */
  const zerl=(settings.zerlegung!==false && typeof zerlFuer==='function')?zerlFuer(e,cid):null;
  const zerlAn=!!(zerl && zerl.quelle==='mensch');
  const zProd=(zerlAn && zerl.art==='produkt' && zerl.produkt)?zerl.produkt.name:null;
  const dn=qeGet(e,cid,'name');
  let name=(dn!==undefined?dn:(zProd||e.anzeige_text));
  const mv=qeGet(e,cid,'mengeVal'); let mengeEff=(mv!==undefined?mv:e.menge);
  /* Arztspezifische Variante liegt GANZ OBEN auf der Kaskade: Wer eine Variante
     angewählt hat, sieht deren Werte — der Standard darunter bleibt unberührt. */
  const vName=(typeof varGet==='function')?varGet(cid,'name'):undefined;
  const vMenge=(typeof varGet==='function')?varGet(cid,'menge'):undefined;
  const vHinweis=(typeof varGet==='function')?varGet(cid,'hinweis'):undefined;
  if(vName!==undefined) name=vName;
  if(vMenge!==undefined) mengeEff=vMenge;
  const varBadge=(typeof varBadgeHTML==='function')?varBadgeHTML(cid):'';
  const hasEdit=!!( (QE.cid[cid]&&Object.keys(QE.cid[cid]).length) || overrides[cid] || (cid in reassign) || (e.material_key&&QE.mat[e.material_key]&&Object.keys(QE.mat[e.material_key]).length) || (typeof hasStelleRule==='function'&&hasStelleRule(cid)) );
  const editBtn=ADMIN?`<button type="button" class="entry-edit-btn${hasEdit?' edited':''}" title="${hasEdit?'Bearbeiten (angepasst)':'Bearbeiten'}" aria-label="Eintrag bearbeiten">✎</button>`:'';
  /* Sichtbarer Aktions-Einstieg für ALLE (UX-Audit K1): Admin → Schnellmenü,
     sonst → „Änderung vorschlagen". Der Long-Press bleibt als Abkürzung. */
  const menuBtn=`<button type="button" class="entry-menu-btn" title="${ADMIN?'Aktionen':'Änderung vorschlagen'}" aria-label="${ADMIN?'Aktionen zu diesem Eintrag':'Änderung zu diesem Eintrag vorschlagen'}">⋯</button>`;
  const important=qeGet(e,cid,'important')===true; const accent=qeGet(e,cid,'color'); const mHi=mengeHiEff(e,cid,mengeEff);
  /* Menge/Größen/Spezifikation sind über das Bearbeiten-Formular und das Schnellmenü überschreibbar. */
  const gv=qeGet(e,cid,'groessen'); const groessenEff=(gv!==undefined?gv:e.groessen);
  const sv=qeGet(e,cid,'spez'); const spezEff=(sv!==undefined)?(sv?sv:null):e.spezifikation;
  /* Ist das Material einem Produkt zugeordnet (canon), liefert DIESES die Maße
     und Eigenschaften — EINE Quelle, keine Doppelung mit den Eintragswerten.
     Der Standard-Hinweis (Spezifikation) bleibt am Eintrag. */
  let meta='';
  if(canon){ meta+=sizeBadges((typeof matSizeList==='function')?matSizeList(canon):(canon.groessen||[])); }
  else { meta+=sizeBadges(groessenEff); }
  meta+=specTags(spezEff);
  if(ADMIN&&e.__new) meta+=`<span class="tag" style="color:var(--accent);background:rgba(61,155,224,.13)">neu</span>`;
  const locEff=(canon&&canon.lagerort)||(care&&care.loc)||'';
  const istTaetigkeit=!!(zerlAn && zerl.art==='taetigkeit');
  /* Ort aus der Zerlegung geht dem Alt-Lagerort vor — er steht am Text, nicht
     am Stammsatz, und ist damit die genauere Angabe für DIESE Stelle. */
  const ortEff=(zerlAn && zerl.ort)?zerl.ort:locEff;
  if(settings.lagerort&&showThumb&&!istTaetigkeit) meta+= ortEff?`<span class="tag tag-loc">📍 ${esc(ortEff)}</span>`:`<span class="tag tag-loc missing">📍 kein Lagerort</span>`;
  /* Das Material als antippbarer Badge — OHNE Kettensymbol. Dass „Vorkommen im
     Standard" und „Material" intern zwei Dinge sind, ist eine
     Implementierungsfrage; sie gehört nicht in den Saal. Angezeigt wird der
     Produktname nur, wenn er vom Text der Zeile abweicht — sonst stünde er
     zweimal nebeneinander. */
  if(canon){ const cn=canon.name||canon.ref||canon.gtin;
    const anders=String(cn||'').trim().toLowerCase()!==String(name||'').trim().toLowerCase();
    if(anders) meta+=`<button type="button" class="tag tag-canon entry-canon-btn" data-g="${esc(canon.gtin)}" style="color:var(--accent);background:rgba(61,155,224,.13);border:0;cursor:pointer">🧬 ${esc(cn)}</button>`; }
  /* Fehlt das Produkt, steht das NUR im Verwaltungsmodus da. Im Saal wäre es
     Lärm — dort zählt, was auf dem Tisch liegt, nicht wie die App ihre Daten
     verbindet (siehe den Absatz oben). Für die Pflege ist es dagegen genau die
     Auskunft, die bisher fehlte: An welcher Zeile hängt noch kein Produkt? */
  if(!canon && showThumb && typeof ADMIN!=='undefined' && ADMIN && typeof zuOeffnen==='function')
    meta+=`<button type="button" class="tag tag-loc missing entry-zuordnen-btn" data-cid="${esc(cid)}"
      style="border:0;cursor:pointer" title="Produkt zuordnen">🧬 kein Produkt</button>`;
  /* Verwendung und Position aus der bestätigten Zerlegung — jede Angabe an
     ihrem eigenen Platz, statt zusammengeschoben im Namen. */
  if(zerlAn){
    if(zerl.groesse) meta+=`<span class="size-badge"><span class="st">Größe</span>${esc(zerl.groesse)}</span>`;
    if(zerl.ziel)      meta+=`<span class="tag tag-ziel">→ ${esc(zerl.ziel)}</span>`;
    if(zerl.zweck)     meta+=`<span class="tag tag-zweck">für ${esc(zerl.zweck)}</span>`;
    if(zerl.bedingung) meta+=`<span class="tag tag-bed">⏱ ${esc(zerl.bedingung)}</span>`;
    if(zerl.praeparat) meta+=`<span class="tag tag-spec">${esc(zerl.praeparat)}</span>`;
    if(zerl.farbe)     meta+=`<span class="tag tag-spec">${esc(zerl.farbe)}</span>`;
    (zerl.alternativen||[]).forEach(a=>{ meta+=`<span class="tag tag-alt">oder ${esc(a)}</span>`; });
    if(zerl.hinweis)   meta+=`<span class="tag tag-warn">⚠ ${esc(zerl.hinweis)}</span>`;
  }
  /* Zweite Sicht (features/bereiche.js) und Austauschgruppen
     (features/alternativen.js). Beides gehört an die Zeile, nicht in ein
     Untermenü: Im Saal muss man sofort lesen können, wohin etwas gehört und
     was stattdessen geht. */
  if(typeof berBadgeHTML==='function') meta+=berBadgeHTML(e,cid);
  /* Das Häkchen „Material für den sterilen Tisch" steht im Verwaltungsmodus
     direkt an der Zeile — eine Berührung statt vier über das Menü. Es
     erscheint nur bei beschaffbarem Material und nur, wenn das Haus einen
     Bereich dafür bestimmt hat (features/bereiche.js). */
  if(typeof berHakenHTML==='function') meta+=berHakenHTML(e,cid,isMatGer);
  if(typeof altBadgeHTML==='function') meta+=altBadgeHTML(e,cid);
  if(e.zusatz_markierung&&e.zusatz_markierung.fundstelle) meta+=`<span class="tag tag-zusatz">${esc(e.zusatz_markierung.fundstelle)}</span>`;
  /* Eigenschaften: ist das Material zugeordnet (canon), kommen sie vom Produkt
     (EINE Quelle). Sonst die Eintrags-Merkmale (e.zusatz / Overlay). */
  if(canon){ (typeof MATPROPS!=='undefined'?MATPROPS:[]).forEach(p=>{ const v=canon.props&&canon.props[p.key]; if(v) meta+=`<span class="tag tag-zusatz">${esc(p.label)}: ${esc(v)}</span>`; }); }
  else { const zvv=qeGet(e,cid,'zusatz'); const zus=(zvv!==undefined&&zvv!==null)?zvv:e.zusatz;
    if(Array.isArray(zus)) zus.forEach(f=>{ if(f&&f.n) meta+=`<span class="tag tag-zusatz">${esc(f.n)}${f.w?': '+esc(f.w):''}</span>`; }); }
  const uncertain=(e.natur_konfidenz==='mittel'||e.natur_konfidenz==='niedrig');
  const conf=(settings.konfidenz&&uncertain&&!isHandled(cid))?`<span class="conf" title="Automatik unsicher (${esc(e.natur_konfidenz)}) – in Verwaltung prüfbar">⚠</span>`:'';
  const mbox = settings.menge ? (mengeEff?`<div class="mbox${mHi?' hi':''}">${esc(mengeEff)}</div>`:`<div class="mbox empty"></div>`) : '';
  /* Das Kategorie-Symbol ist einzeln abschaltbar — je Kategorie über das
     Funktionsregister (Bereich `natico`), langes Tippen auf die Zeile führt
     über „Kategorie ändern" dorthin. Der Betreiber: „das Icon für Material
     oder Geräte usw. muss ebenfalls individuell anzeigbar oder ausgeblendet
     werden können".

     Es geht dabei nicht um Geschmack, sondern um Platz: Auf einem Handy
     kostet die Symbolspalte in JEDER Zeile Breite, die dem Namen fehlt. Wer
     ohnehin nur Material in einer Rubrik hat, braucht das Symbol nicht. */
  const icoAus = (typeof fktAus==='function') && fktAus('natico', nat);
  const ico = (isMatGer && !icoAus)?`<div class="e-ico">${info.icon||'•'}</div>`:'';
  const cls = (isMatGer?'':'step')+(important?' important':'');
  /* Schriftgröße/Gewicht dieser Zeile und Auszeichnungen im Text
     (features/textstil.js). Beides ist abschaltbar-frei: Ohne das Modul
     bleibt die Zeile wie sie war. */
  const stil=(typeof txsVon==='function')?txsVon(e,cid):null;
  const stilCls=(stil&&typeof txsKlassen==='function')?txsKlassen(stil):'';
  const nameHTML=(typeof txsText==='function')?txsText(name):esc(name);
  /* Farbe: Kategoriefarbe als Vollrahmen; frei gewählte Farbe (accent bzw. für
     eigene Einträge e.color) füllt den ganzen Eintrag – Textfarbe automatisch
     nach Kontrast (pickTextColor). */
  const fill=(accent!==undefined)?accent:e.color; const catCol=isMatGer?`var(--n-${esc(nat)})`:`var(--n-hinweis)`;
  let style, filledCls='';
  if(fill){ const t=pickTextColor(fill); style=`--e-col:${esc(fill)};--e-fill:${esc(fill)};--e-fill-text:${t};--e-fill-bd:${t}`; filledCls=' filled'; }
  else { style=`--e-col:${catCol}`; }
  /* Arzt-Hinweis als eigener, farbig abgesetzter Zusatz (nicht in den
     Standardtext gemischt — man muss sehen, was arztspezifisch ist). */
  if(vHinweis!==undefined){ const va=(typeof varActive==='function')?varActive():null;
    meta+=`<span class="tag tag-var" style="--vcol:${esc((va&&va.farbe)||'#8b5cf6')}">${esc((va&&(va.kurz||varKurz(va.name)))||'')}: ${esc(vHinweis)}</span>`; }
  const star = important?`<span class="imp-star">⭐</span>`:'';
  const addedTag = e._added?`<span class="added-tag">neu</span>`:'';
  /* „Warum"-Wissensfeld: aufklappbares 💡-Detail (für alle sichtbar, im Admin
     über das Bearbeiten-Formular pflegbar). */
  const whyQe=qeGet(e,cid,'why'); const why=(((whyQe!==undefined&&whyQe!==null)?whyQe:(e.why||''))||'').toString();
  const whyBtn=why?`<button type="button" class="entry-why-btn" aria-label="Warum – Hintergrund anzeigen" aria-expanded="false" title="Warum?">💡</button>`:'';
  const whyPanel=why?`<div class="e-why"><span class="ew-lbl">Warum</span>${esc(why).replace(/\n/g,'<br>')}</div>`:'';
  const varCls=varBadge?' var-changed':'';
  /* data-cid an der Zeile: Der Halte-Detektor liest die Kennung direkt aus dem
     Attribut, statt sie aus der DOM-id zurückzurechnen. Zeilen OHNE data-cid
     (z. B. reine Anzeige-Zeilen einer Arzt-Variante) sind damit ausdrücklich
     nicht bedienbar — der Selektor selbst drückt den Vertrag aus. */
  /* Eine bestätigte TÄTIGKEIT ist kein Material: kein Foto, kein Lagerort-Hinweis,
     dafür ein sichtbares Werkzeug-Zeichen. „Raumkontrolle" hört auf, wie ein
     Artikel auszusehen, den man aus dem Schrank holt. */
  const istTun=!!(zerlAn && zerl.art==='taetigkeit');
  const tunIco=istTun?`<span class="tun-ico" title="Tätigkeit – kein Material">🔧</span>`:'';
  /* Der Originalsatz bleibt an der Zeile hängen (Titel), auch wenn oben der
     saubere Produktname steht. Nichts verschwindet. */
  const rohTitel=(zProd && zProd!==e.anzeige_text)?` title="${esc(e.anzeige_text)}"`:'';
  /* Bilder an der Zeile (features/medien.js). Sie stehen UNTER dem Text, nicht
     daneben: Im Saal wird die Liste gelesen, nicht betrachtet — wer ein Bild
     braucht, findet es, wer keins braucht, verliert keine Zeile Übersicht. */
  const bilder=(typeof medStreifenHTML==='function')?medStreifenHTML(e,cid):'';
  /* ── WARUM DIE ANGABEN UNTER DER ZEILE STEHEN UND NICHT NEBEN IHR ──
     Gemessen auf einem Handy (360 px): Von 360 px blieben dem Namen 98 —
     27 %. Der Rest ging an Häkchen, Menge, Symbol, Bild, Abstände und den
     ⋯-Knopf. Die Angaben (Größe, Lagerort, Bereich, Alternativen …) standen
     dabei INNERHALB derselben schmalen Spalte und brachen deshalb auf drei
     und vier Zeilen um — bei 115 px Zeilenhöhe, während rechts daneben
     nichts stand. Genau das war gemeint mit „es wird viel freier Platz
     nicht genutzt".

     Jetzt sind `.e-meta` und der Bilderstreifen GESCHWISTER der Zeile, nicht
     Kinder ihrer Textspalte: Sie haben die volle Breite des Eintrags.

     Die Kennung wandert mit — der Halte-Detektor (features/quickmenu.js)
     hört auf `.entry-row[data-cid], .e-meta[data-cid]`. Tippen und Halten
     wirken damit auf der Angabenzeile genau wie vorher; ohne das wäre der
     Umbau ein stiller Verlust an Bedienbarkeit. */
  return `<div class="entry ${cls}${filledCls}${varCls} ${done}${istTun?' tun':''}" id="e-${esc(cid)}" style="${style}"><div class="entry-row" data-cid="${esc(cid)}"${rohTitel}><div class="chk">✓</div>${mbox}${ico}${showThumb?thumb:''}<div class="e-main"><div class="e-top"><div class="e-text${stilCls?' '+stilCls:''}">${star}${tunIco}${nameHTML}${varBadge}${addedTag}</div>${conf}${whyBtn}${editBtn}${menuBtn}</div></div></div>${meta?`<div class="e-meta" data-cid="${esc(cid)}">${meta}</div>`:''}${bilder}${whyPanel}</div>`;
}

function openRubrik(idx,silent){ const r=curStd.rubriken[idx]; if(!silent){ nav.push({lvl:'rub',idx}); try{ history.pushState({d:2,id:curStd.id,idx},''); }catch(e){} }
  /* Sortiermodus: eine zweite, ruhige Ansicht derselben Rubrik. Die
     Eintragszeile ist schon dreifach belegt (tippen, halten, Schalter) — ein
     viertes Verhalten darauf wäre ein Ratespiel (features/sortieren.js). */
  if(typeof sortAktivFuer==='function' && sortAktivFuer(idx)){ sortRender(idx); return; }
  /* Änderungsmodus: dieselbe Rubrik, aber die Zeilen sind Felder. Die Ansicht
     wird dafür NICHT verlassen — genau das war das Holprige daran, eine
     Liste durchzusehen (features/zeilen.js). */
  if(typeof zeilAktivFuer==='function' && zeilAktivFuer(idx)){ zeilRender(idx); return; }
  const isMatGer=(r.typ==='material'||r.typ==='geraete'); let html='';
  /* Bilder an der Rubrik selbst (features/medien.js): ein Übersichtsfoto des
     Tisches gehört an die Rubrik, nicht an eine einzelne Zeile. */
  if(typeof medAnkerHTML==='function') html+=medAnkerHTML(medAnkRub(curStd.id,idx), rubName(r,idx));
  /* Verfahrenszweige (features/alternativen.js): „Ablation ◉ RF ○ Kryo".
     Ohne Wahl bleibt alles sichtbar — wer nichts entschieden hat, darf nicht
     die Hälfte des Standards verlieren. */
  if(typeof zwgLeisteHTML==='function') html+=zwgLeisteHTML(curStd.id,idx);
  if(isMatGer){
    let lg=''; natList().forEach(n=>{ lg+=`<div class="lg-row"><span class="lg-swatch" style="background:${n.color}"></span>${esc(n.label)}</div>`; });
    html+=`<details class="legend"><summary>◐ Farb-Legende</summary><div class="legend-body">
      <div class="lg-row"><span class="lg-mbox">2×</span>Menge (Stückzahl, links)</div>${lg}
      <div class="lg-row"><span class="lg-size">6F</span>Größe (French, Länge, Ø, Volumen …)</div>
      <div class="lg-row"><span style="color:var(--warn)">⚠</span>Automatik unsicher – in Verwaltung prüfbar</div></div></details>`;
  }
  if(isMatGer){
    const groupsMap=new Map(); let appear=0;
    (r.sub_bereiche||[]).forEach((sb,si)=>{ (sb.eintraege||[]).forEach((e,ei)=>{
      if(e.natur==='ueberschrift') return; if(settings.fliesstext===false && e.ist_fliesstext) return;
      const cid=cidOf(curStd.id,idx,si,ei); if(qeGet(e,cid,'hidden')===true) return;
      if(typeof varHidden==='function' && varHidden(cid)) return;   /* von der Arzt-Variante ausgeblendet */
      const uk=canonUk(e,cid); const gkey=uk||'\u0000null';
      if(!groupsMap.has(gkey)){ groupsMap.set(gkey,{uk:uk,first:appear++,entries:[]}); }
      groupsMap.get(gkey).entries.push({e,cid});
    }); });
    /* Selbst angelegte Einträge dieses Standards/dieser Rubrik einbinden */
    newEntriesFor(r,idx).forEach(n=>{
      const cid='new|'+n.id; const e=newToEntry(n); if(qeGet(e,cid,'hidden')===true) return;
      const uk=canonUk(e,cid); const gkey=uk||'\u0000null';
      if(!groupsMap.has(gkey)){ groupsMap.set(gkey,{uk:uk,first:appear++,entries:[]}); }
      groupsMap.get(gkey).entries.push({e,cid});
    });
    /* Selbst angelegte Abschnitte („Reiter") auch dann zeigen, wenn noch kein
       Eintrag sie trägt — als leere, befüllbare Sektion. */
    declaredUksFor(idx).forEach(uk=>{ if(!uk) return; if(!groupsMap.has(uk)) groupsMap.set(uk,{uk:uk,first:appear++,entries:[]}); });
    let groups=[...groupsMap.values()];
    groups.forEach(g=>{ g.entries=sortByOrder(g.entries, orderKeyFor(idx,(g.uk||''))); });
    groups.sort((a,b)=>{ const oa=(a.uk&&ukMetaOf(a.uk).order!=null)?ukMetaOf(a.uk).order:a.first; const ob=(b.uk&&ukMetaOf(b.uk).order!=null)?ukMetaOf(b.uk).order:b.first; return oa-ob; });
    const named=groups.filter(g=>g.uk); const nullG=groups.find(g=>!g.uk);
    if(nullG && named.length===0){ nullG.entries.forEach(x=>{ html+=entryCardHTML(x.e,x.cid,true); }); }
    else {
      if(nullG){ nullG.entries.forEach(x=>{ html+=entryCardHTML(x.e,x.cid,true); }); }
      const declared=declaredUksFor(idx);
      named.forEach((g)=>{
        /* Leere Abschnitte nur im Verwaltungsmodus zeigen (Gerüst zum Befüllen);
           Endnutzer sehen leere Reiter nicht. */
        if(!g.entries.length && !ADMIN) return;
        if(typeof zwgAbschnittSichtbar==='function' && !zwgAbschnittSichtbar(curStd.id,idx,g.uk)) return;
        const gidx=UK_LIST.indexOf(g.uk); const col=ukColorOf(g.uk,gidx>=0?gidx:g.first); const ico=ukIconOf(g.uk);
        const ckey=idx+':'+g.uk; const isEmpty=!g.entries.length; const isCol=isEmpty?false:(collapsed[ckey]!==false); /* Untergruppen sind standardmäßig zugeklappt; leere offen */
        const isDecl=declared.indexOf(g.uk)>=0;
        /* ckey/UK-Name sind Freitext → per data-Attribut übergeben,
           nicht als Inline-String-Literal (esc() escaped kein Apostroph). */
        html+=`<div class="uksec ${isCol?'collapsed':''}" style="--uk:${col}"><div class="uksec-head" data-k="${esc(ckey)}" onclick="toggleUk(this.dataset.k)"><span class="uksec-ico">${ico}</span><span class="uksec-name">${esc(g.uk)}</span><span class="uksec-count">${g.entries.length}</span><span class="uksec-arrow">▾</span></div><div class="uksec-body">`;
        if(typeof medAnkerHTML==='function') html+=medAnkerHTML(medAnkUk(curStd.id,idx,g.uk), g.uk);
        g.entries.forEach(x=>{ html+=entryCardHTML(x.e,x.cid,true); });
        if(ADMIN){ html+=`<button class="add-entry-btn uksec-add" data-ri="${idx}" data-uk="${esc(g.uk)}" onclick="event.stopPropagation();startAddEntryUk(+this.dataset.ri,this.dataset.uk)">＋ Eintrag in „${esc(g.uk)}"</button>`;
          if(isDecl&&isEmpty) html+=`<button class="add-entry-btn uksec-del" data-ri="${idx}" data-uk="${esc(g.uk)}" onclick="event.stopPropagation();removeUkSectionUI(+this.dataset.ri,this.dataset.uk)">Abschnitt entfernen</button>`; }
        html+=`</div></div>`;
      });
    }
  } else {
    const {blocks}=ablaufSegments(idx);
    blocks.forEach(b=>{
      if(b.head && typeof zwgAbschnittSichtbar==='function' && !zwgAbschnittSichtbar(curStd.id,idx,b.head)) return;
      if(b.head){
        /* Eigene Überschriften bekommen ein ⋯ (umbenennen/löschen). */
        const tools=(ADMIN&&b.headAid)?`<button type="button" class="icon-btn" style="width:30px;height:30px;font-size:15px;margin-left:8px;vertical-align:middle" data-ri="${idx}" data-aid="${esc(b.headAid)}" onclick="openSegHeadSheet(+this.dataset.ri,this.dataset.aid)" aria-label="Abschnitt bearbeiten">⋯</button>`:'';
        html+=`<div class="sub-head">${esc(b.head)}${tools}</div>`;
        if(typeof medAnkerHTML==='function') html+=medAnkerHTML(medAnkSeg(curStd.id,idx,b.head), b.head); }
      b.items.forEach(x=>{ html+=entryCardHTML(x.e,x.cid,false); });
      /* „＋ Eintrag in <Abschnitt>" für JEDEN benannten Abschnitt — auch die
         aus der Quelldatei (Souveränität: überall hinzufügen können). */
      if(ADMIN&&b.head) html+=`<button class="add-entry-btn uksec-add" data-ri="${idx}" data-seg="${esc(b.head)}" onclick="startAddEntrySeg(+this.dataset.ri,this.dataset.seg)">＋ Eintrag in „${esc(b.head)}"</button>`;
    });
  }
  /* Zusätzliche Einträge der aktiven Arzt-Variante – als eigener, klar
     gekennzeichneter Block ans Ende, damit Standard und Ergänzung trennbar
     bleiben. */
  if(typeof varAdded==='function'){
    const extra=varAdded(curStd.id,idx).filter(x=>x&&x.name);
    if(extra.length){ const va=(typeof varActive==='function')?varActive():null;
      html+=`<div class="var-extra" style="--vcol:${esc((va&&va.farbe)||'#8b5cf6')}">
        <div class="vx-head">＋ zusätzlich für ${esc((va&&va.name)||'diese Variante')}</div>`;
      extra.forEach(x=>{ html+=`<div class="entry step var-changed" style="--e-col:${esc((va&&va.farbe)||'#8b5cf6')}"><div class="entry-row"><div class="chk">✓</div>${x.menge?`<div class="mbox">${esc(x.menge)}</div>`:'<div class="mbox empty"></div>'}<div class="e-main"><div class="e-top"><div class="e-text">${esc(x.name)}<span class="var-badge" style="--vcol:${esc((va&&va.farbe)||'#8b5cf6')}">${esc((va&&(va.kurz||varKurz(va.name)))||'')}</span></div></div></div></div></div>`; });
      html+=`</div>`; }
  }
  const body=html||`<div class="empty"><div class="ei">📄</div><h3>Keine Einträge</h3><p>Diese Rubrik enthält keine Positionen.</p></div>`;
  /* DIE KNÖPFE UNTER DER LISTE — jeder mit SCHLÜSSEL.
     Der Messstand zählte hier sechs Flächen ohne Langdruck: Sie ließen sich
     weder umbenennen noch ausblenden, obwohl Hausregel A7 genau das verlangt.
     Jetzt trägt jeder Knopf seinen Schlüssel (`data-k`), sein Wort und sein
     Symbol kommen aus dem Funktionsregister (Bereich `rubknopf`), und langes
     Tippen darauf öffnet seine Einstellung. Wer im Labor „Bausteine" nie
     benutzt, nimmt den Knopf weg — ohne Entwickler. */
  const rk=(key, icoVor, wortVor, aufruf, da)=>{
    if(!da) return '';
    if(typeof fktAus==='function' && fktAus('rubknopf', key)) return '';
    const ico=(typeof fktWert==='function')?fktWert('rubknopf',key,'ico',icoVor):icoVor;
    const wort=(typeof fktWert==='function')?fktWert('rubknopf',key,'wort',wortVor):wortVor;
    return `<button class="add-entry-btn" data-k="${esc(key)}" data-r="${idx}" data-s="${esc(curStd.id)}" onclick="${aufruf}">${esc(ico)} ${esc(wort)}</button>`;
  };
  const neuBtn=rk('eintrag','＋','Eintrag hinzufügen','startAddEntry()', ADMIN);
  /* „Ankreuzen statt Abtippen" (features/ankreuzen.js) hat „⬇ Aus Katalog
     übernehmen" abgelöst: Der alte Weg konnte EINE Position auf einmal und
     kannte nur den Katalog — den kleinsten der vorhandenen Töpfe. Der neue
     kreuzt mehrere an und zieht aus dem ganzen Bestand. */
  const adoptBtn=rk('ankreuzen','☑','Ankreuzen statt Abtippen','ankOeffnen(+this.dataset.r)',
    ADMIN&&typeof ankOeffnen==='function');
  /* Der größte Zeitgewinn beim SCHREIBEN eines Standards: Die fertige Liste
     liegt fast immer schon irgendwo (Word, Mail, abfotografierter Zettel).
     „Liste einfügen" übernimmt sie in einem Zug (features/einfuegen.js). */
  const listBtn=rk('liste','📋','Liste einfügen','einfOeffnen(+this.dataset.r)',
    ADMIN&&typeof einfOeffnen==='function');
  /* In DIESER Rubrik stehen die Bausteine dieser Rubrik — ankreuzen,
     einfügen, fertig (features/bausteine.js). */
  const bauBtn=rk('bausteine','🧱','Bausteine einfügen',"bauEinfuegenSheet(this.dataset.s,+this.dataset.r,'')",
    ADMIN&&typeof bauEinfuegenSheet==='function');
  /* Der gemessene Weg: Eine Zeile umbenennen kostete sechs Berührungen und
     zwei Bildschirmwechsel. Hier bleibt man in der Liste (features/zeilen.js). */
  const zeilBtn=rk('zeilen','✏️','Zeilen ändern','zeilAn(+this.dataset.r)',
    ADMIN&&typeof zeilAn==='function');
  const sortBtn=rk('sortieren','↕','Reihenfolge ändern','sortAn(+this.dataset.r)',
    ADMIN&&typeof sortAn==='function');
  /* Eigene Abschnitte in JEDER Rubrik anlegbar (Souveränität): bei Material/
     Geräte als Unterkategorie-Sektion, in Ablauf-Rubriken als Überschrift. */
  const sectionBtn=isMatGer
    ? rk('abschnitt','＋','Abschnitt (Reiter)','addUkSectionUI(+this.dataset.r)', ADMIN)
    : rk('abschnitt','＋','Abschnitt (Überschrift)','addSegSectionUI(+this.dataset.r)', ADMIN);
  const chkN=rubrikCids(idx).filter(c=>checks[c]).length;
  const resetBar=chkN?`<div class="chk-reset"><span class="cr-count">${chkN} abgehakt</span><button type="button" class="cr-btn" onclick="clearRubrikChecks(${idx})">↺ Alle zurücksetzen</button></div>`:'';
  $('scr-detail').innerHTML=hintsBlockHTML('rub',curStd.id+'|'+idx)+resetBar+body+neuBtn+adoptBtn+listBtn+bauBtn+zeilBtn+sortBtn+sectionBtn;
  show('scr-detail'); setBar(r.name,curStd.titel+' · '+curStd.gruppe,true);
}
/* Sammelt alle abhakbaren cids einer Rubrik (Basis- + eigene Einträge). */
function rubrikCids(idx){ const r=curStd.rubriken[idx]; if(!r) return []; const out=[];
  (r.sub_bereiche||[]).forEach((sb,si)=>{ (sb.eintraege||[]).forEach((e,ei)=>{ if(e.natur==='ueberschrift') return; out.push(cidOf(curStd.id,idx,si,ei)); }); });
  newEntriesFor(r,idx).forEach(n=>out.push('new|'+n.id));
  return out; }
/* Entfernt auf einmal alle gesetzten Häkchen dieser Rubrik (nur lokal – Checks
   sind gerätespezifisch, hkl_checks). */
function clearRubrikChecks(idx){ const cids=rubrikCids(idx); const set=cids.filter(c=>checks[c]);
  if(!set.length){ toast('Keine Häkchen gesetzt'); return; }
  if(!confirm('Alle '+set.length+' Häkchen dieser Rubrik zurücksetzen?')) return;
  set.forEach(c=>{ delete checks[c]; }); saveChecks(); reRenderDetail(); toast(set.length+' Häkchen zurückgesetzt'); }
/* Startet das Hinzufügen eines Eintrags in der aktuell offenen Rubrik.
   Liest Standard/Rubrik aus dem Navigationszustand (keine Nutzertexte im onclick). */
function startAddEntry(){ const top=nav[nav.length-1]; if(!top||top.lvl!=='rub'||!curStd) return;
  const r=curStd.rubriken[top.idx]; const defaultNat=r.typ==='geraete'?'geraet':(r.typ==='material'?'material':'hinweis');
  openEntryForm({kind:'add',sid:curStd.id,ri:top.idx,defaultNat}); }
/* Eintrag direkt in einen bestimmten Abschnitt (Unterkategorie) anlegen –
   das UK-Feld ist vorbelegt. */
function startAddEntryUk(idx,uk){ if(!ADMIN||!curStd) return; const r=curStd.rubriken[idx]; if(!r) return;
  const defaultNat=r.typ==='geraete'?'geraet':(r.typ==='material'?'material':'hinweis');
  openEntryForm({kind:'add',sid:curStd.id,ri:idx,defaultNat,defaultUk:uk}); }
/* Eingabe-Sheet für einen neuen Abschnitt („Reiter") – bewusst KEIN prompt(),
   das in installierten PWAs (standalone) lautlos null liefert (M1). */
function addUkSectionUI(idx){ if(!ADMIN||!curStd) return;
  const h=`<div class="sheet-grip"></div><div class="sheet-title">Neuer Abschnitt (Reiter)</div>
    <input type="text" id="skNewSec" class="txtinp" style="width:100%" placeholder="Name, z. B. Material aus dem Vorbereitungsraum">
    <div class="sheet-pick" style="margin-top:12px"><button class="sheet-pick-btn" data-ri="${idx}" onclick="addUkSectionSave(+this.dataset.ri)">Anlegen</button></div>
    <button class="sheet-close" onclick="showSheet(false)">Abbrechen</button>`;
  $('sheet').innerHTML=h; showSheet(true);
  const inp=$('skNewSec'); if(inp){ setTimeout(()=>inp.focus(),50); inp.onkeydown=(ev)=>{ if(ev.key==='Enter'){ ev.preventDefault(); addUkSectionSave(idx); } }; }
}
function addUkSectionSave(idx){ const inp=$('skNewSec'); const nm=(inp&&inp.value||'').trim(); if(!nm) return;
  if(!addUkSectionName(idx,nm)){ toast('Abschnitt nicht anlegbar',true); return; }
  showSheet(false); reRenderDetail(); toast('Abschnitt angelegt'); }
function removeUkSectionUI(idx,uk){ if(!ADMIN) return;
  if(!confirm('Leeren Abschnitt „'+uk+'" entfernen?')) return;
  removeUkSectionName(idx,uk); reRenderDetail(); toast('Abschnitt entfernt'); }

/* ── Abschnitte in ABLAUF-Rubriken: eigene Überschriften (Konzept
   „Abschnitte überall"). Eine eigene Überschrift ist ein added Eintrag mit
   natur 'ueberschrift'; ablaufSegments macht daraus einen Abschnitt. */
function startAddEntrySeg(idx,seg){ if(!ADMIN||!curStd) return;
  openEntryForm({kind:'add',sid:curStd.id,ri:idx,defaultNat:'hinweis',defaultSeg:seg}); }
function addSegSectionUI(idx){ if(!ADMIN||!curStd) return;
  const h=`<div class="sheet-grip"></div><div class="sheet-title">Neuer Abschnitt (Überschrift)</div>
    <input type="text" id="skNewSeg" class="txtinp" style="width:100%" placeholder="Name, z. B. Nachbereitung">
    <div class="sheet-pick" style="margin-top:12px"><button class="sheet-pick-btn" data-ri="${idx}" onclick="addSegSectionSave(+this.dataset.ri)">Anlegen</button></div>
    <button class="sheet-close" onclick="showSheet(false)">Abbrechen</button>`;
  $('sheet').innerHTML=h; showSheet(true);
  const inp=$('skNewSeg'); if(inp){ setTimeout(()=>inp.focus(),50); inp.onkeydown=(ev)=>{ if(ev.key==='Enter'){ ev.preventDefault(); addSegSectionSave(idx); } }; }
}
function addSegSectionSave(idx){ const inp=$('skNewSeg'); const nm=(inp&&inp.value||'').trim(); if(!nm) return;
  const key=curStd.id+'|'+idx; const arr=ADDITIONS.entries[key]||(ADDITIONS.entries[key]=[]);
  arr.push(makeAddEntry({name:nm,nat:'ueberschrift',aid:newAid()}));
  saveAdditions(); rebuildDB(); showSheet(false); reRenderDetail(); toast('Abschnitt angelegt'); }
function openSegHeadSheet(idx,aid){ if(!ADMIN||!curStd) return; const e=findAddEntry(curStd.id,idx,aid); if(!e) return;
  const h=`<div class="sheet-grip"></div><div class="sheet-title">Abschnitt „${esc(e.anzeige_text)}"</div>
    <input type="text" id="segRenInp" class="txtinp" style="width:100%" value="${esc(e.anzeige_text)}">
    <div class="sheet-pick" style="margin-top:12px">
      <button class="sheet-pick-btn" data-ri="${idx}" data-aid="${esc(aid)}" onclick="segHeadRename(+this.dataset.ri,this.dataset.aid)">Umbenennen</button>
      <button class="sheet-pick-btn" data-ri="${idx}" data-aid="${esc(aid)}" onclick="segHeadDelete(+this.dataset.ri,this.dataset.aid)">🗑 Abschnitt löschen</button>
    </div><button class="sheet-close" onclick="showSheet(false)">Abbrechen</button>`;
  $('sheet').innerHTML=h; showSheet(true); }
function segHeadRename(idx,aid){ const e=findAddEntry(curStd.id,idx,aid); const inp=$('segRenInp'); const nm=(inp&&inp.value||'').trim(); if(!e||!nm) return;
  const old=e.anzeige_text; e.anzeige_text=nm; e.roh_text=nm;
  /* Zuordnungen der Abschnitts-Einträge mit umziehen. */
  (ADDITIONS.entries[curStd.id+'|'+idx]||[]).forEach(x=>{ if(x.seg===old) x.seg=nm; });
  saveAdditions(); rebuildDB(); showSheet(false); reRenderDetail(); toast('Abschnitt umbenannt'); }
function segHeadDelete(idx,aid){ const e=findAddEntry(curStd.id,idx,aid); if(!e) return;
  if(!confirm('Abschnitt „'+e.anzeige_text+'" löschen? Die Einträge darin bleiben erhalten und rücken ans Ende der Rubrik.')) return;
  const key=curStd.id+'|'+idx; ADDITIONS.entries[key]=(ADDITIONS.entries[key]||[]).filter(x=>x._aid!==aid);
  if(!ADDITIONS.entries[key].length) delete ADDITIONS.entries[key];
  saveAdditions(); rebuildDB(); showSheet(false); reRenderDetail(); toast('Abschnitt gelöscht'); }
/* Die Einzel-Übernahme aus dem Katalog (startAdoptCatalog / adoptCatalogItem)
   ist ersatzlos entfernt: Sie konnte EINE Position auf einmal und kannte nur
   den Katalog. „☑ Ankreuzen statt Abtippen" (features/ankreuzen.js) kann
   beides besser und zieht zusätzlich aus dem tatsächlichen Bestand — den
   Katalog eingeschlossen. Zwei Wege für dieselbe Absicht nebeneinander
   stehen zu lassen wäre die teurere Entscheidung gewesen. */
function toggleUk(ckey){ collapsed[ckey]=(collapsed[ckey]===false)?true:false; const top=nav[nav.length-1]; if(top&&top.lvl==='rub'){ openRubrik(top.idx,true); } }
function toggleCheck(cid){ checks[cid]=!checks[cid]; if(!checks[cid]) delete checks[cid]; saveChecks(); const el=$('e-'+cid); if(el) el.classList.toggle('done',!!checks[cid]);
  /* Konfigurierbare Pop-up-Dialoge: Abhaken/Entfernen ist der häufigste
     Auslöser („beim Abhaken von ACT nach dem Wert fragen"). */
  if(typeof popupFire==='function'){ const e=(typeof findEntry==='function')?findEntry(cid):null;
    const nm=(e&&(e.anzeige_text||e.roh_text))||'';
    popupFire({ ereignis: checks[cid]?'check':'uncheck', titel:nm, cid, sid:(curStd&&curStd.id)||'', quelle:'standard' }); }
  /* Einmaliger Hinweis (pro Gerät) auf den täglichen Reset — sonst wundert man
     sich am nächsten Morgen, wohin die Häkchen sind (UX-Audit K4c). */
  if(checks[cid] && !store.get('hkl_hint_daily')){ store.set('hkl_hint_daily','1'); toast('Häkchen gelten für heute – morgen starten sie automatisch leer.'); } }

function goBack(){ if(formCtx){ closeForm(); return; }
  /* Der Sortiermodus ist eine Ebene für sich: ‹ verlässt ihn, statt aus der
     Rubrik herauszuspringen — sonst stünde man plötzlich zwei Ebenen höher. */
  if(typeof sortAktiv==='function' && sortAktiv()){ sortAus(); return; }
  if(typeof zeilAktiv==='function' && zeilAktiv()){ zeilAus(); return; }
  /* Neue Ansichten (Anleitungen, Pop-up-Verwaltung, Varianten): jeweils genau
     eine Ebene zurück, statt bis zur Übersicht durchzufallen. */
  const act=(id)=>{ const el=$(id); return el&&el.classList.contains('active'); };
  if(act('scr-guide-edit')){ if(typeof guideCancelEdit==='function') guideCancelEdit(); return; }
  if(act('scr-variant-edit')){ if(typeof varEditBack==='function') varEditBack(); return; }
  if(act('scr-popups')){ if(typeof popupEditId!=='undefined'&&popupEditId){ popupCloseEdit(); return; } setMode('use'); return; }
  if(act('scr-variants')){ setMode('use'); return; }
  if(act('scr-diag')){ setMode('use'); return; }
  if(act('scr-bausteine')){ setMode('admin'); return; }
  if(act('scr-funktionen')){ setMode('admin'); return; }
  if(act('scr-freigabe')){ if(typeof frgSid!=='undefined' && frgSid) openStandard(frgSid); else setMode('admin'); return; }
  if(act('scr-ruest')){ if(typeof ruestSid!=='undefined' && ruestSid) openStandard(ruestSid); else setMode('use'); return; }
  /* Aufräum-Assistent: eingeengt (aus dem Pflege-Weg) führt ‹ dorthin zurück,
     sonst wie bisher in die Materialzentrale. */
  if(act('scr-cleanup')){ if(typeof cleanupFokus!=='undefined' && cleanupFokus && typeof cleanupFokusZurueck==='function'){ cleanupFokusZurueck(); return; }
    mode='care'; renderCare(); show('scr-care'); updateBar(); return; }
  if(act('scr-pflege')){ if(typeof pflegeVerlassen==='function'){ pflegeVerlassen(); return; } setMode('use'); return; }
  if(act('scr-guide')){ nav=[]; if(typeof curSeg!=='undefined') curSeg='anleitung';
    renderStandards(); show('scr-standards'); updateBar();
    const sw=$('searchWrap'); if(sw) sw.style.display='block'; return; }
  /* Produktblatt/Editor: eine Ebene zurück dorthin, wo es geöffnet wurde
     (features/scanner.js merkt sich die Herkunft beim Öffnen).
     Früher stand hier eine Prüfung auf `scr-care-item` — einen Bildschirm, den
     niemand je aktiviert. Die Bedingung war immer falsch, der Zweig kehrte
     wirkungslos zurück, und der sichtbare ‹-Knopf tat im Material-Editor
     nichts. Eine Sackgasse, aus der nur das ☰-Menü herausführte. */
  if(act('scr-scan-item')){ if(typeof scanZurueck==='function' && scanZurueck()) return; }
  if(act('scr-scan')){ setMode('use'); return; }
  /* Materialzentrale selbst: wie die übrigen Verwaltungsansichten in die Übersicht. */
  if(mode==='care'){ setMode('use'); return; }
  if(nav.length>0){ try{ history.back(); }catch(e){ } return; }
  setMode('use'); }
function gotoState(st){ const d=(st&&st.d)||0;
  formCtx=null; mode='use';
  let s=null; if(d>=1&&st&&st.id) s=DB.standards.find(x=>x.id===st.id);
  if(d<=0||(d>=1&&!s)){ nav=[]; $('searchWrap').style.display='block'; renderStandards(); show('scr-standards'); updateBar(); return; }
  curStd=s;
  if(d===1){ nav=[{lvl:'std',id:st.id}]; $('searchWrap').style.display='none'; openStandard(st.id,false,true); }
  else { nav=[{lvl:'std',id:st.id},{lvl:'rub',idx:st.idx}]; $('searchWrap').style.display='none'; openRubrik(st.idx,true); } }

