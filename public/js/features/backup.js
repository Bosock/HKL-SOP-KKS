/* ============ Datensicherung: Export/Import aller Anpassungen ============ */
const BACKUP_KEYS=['hkl_natcfg','hkl_overrides','hkl_reviewed','hkl_reassign','hkl_ukmap','hkl_ukmeta','hkl_settings','hkl_qedits','hkl_care','hkl_prod','hkl_hints','hkl_glossary','hkl_suggestions','hkl_additions','hkl_catalog','hkl_newentries','hkl_newstd','hkl_newrub','hkl_rubtpl','hkl_stdedits','hkl_rubedits','hkl_entryorder','hkl_txt','hkl_design','hkl_grpord','hkl_rubicon','hkl_authpw','hkl_gtin','hkl_matlink','hkl_matprops','hkl_cleanup_done','hkl_rules','hkl_theme'];
function buildBackup(){ const daten={}; BACKUP_KEYS.forEach(k=>{ const raw=store.get(k); if(raw==null) return; try{ daten[k]=JSON.parse(raw); }catch(e){ daten[k]=raw; } });
  return { __hkl:'hkl-anpassungen', version:1, erstellt:new Date().toISOString(), daten }; }
function applyBackup(obj){ if(!obj||obj.__hkl!=='hkl-anpassungen'||!obj.daten) throw new Error('ungueltig');
  BACKUP_KEYS.forEach(k=>{ if(k in obj.daten){ const v=obj.daten[k]; store.set(k, (typeof v==='string')?v:JSON.stringify(v)); } }); }
function exportBackup(){ try{ const obj=buildBackup(); const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='hkl-anpassungen-'+today()+'.json';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); toast('Sicherung heruntergeladen'); }catch(e){ toast('Export fehlgeschlagen',true); } }
function importBackupFile(ev){ const f=ev.target.files&&ev.target.files[0]; if(!f) return; const r=new FileReader();
  r.onload=()=>{ try{ const obj=JSON.parse(r.result); if(!obj||obj.__hkl!=='hkl-anpassungen'){ toast('Keine gültige Sicherungsdatei',true); return; }
    if(!confirm('Sicherung einspielen? Die aktuellen Anpassungen auf diesem Gerät werden durch die Datei ersetzt.')) return;
    applyBackup(obj); toast('Sicherung eingespielt – App lädt neu'); setTimeout(()=>{ try{ location.reload(); }catch(e){} },700);
  }catch(e){ toast('Datei nicht lesbar',true); } }; r.readAsText(f); }
function restoreMat(mk){ if(QE.mat[mk]){ delete QE.mat[mk].hidden; if(Object.keys(QE.mat[mk]).length===0) delete QE.mat[mk]; }
  /* „Überall"-Ausblendung als Regel mit-zurücknehmen (EIN Schreibweg). */
  if(typeof rulesActive==='function') rulesActive(RULES).forEach(r=>{ if(r.ziel&&r.ziel.key===mk&&r.prop==='hidden'&&r.wert===true&&r.wo&&r.wo.art==='alle') revokeRule(r.id); });
  saveQE(); buildMaterialIndex(); renderAdmin(); toast('Wiederhergestellt'); }

/* Kategorie als „beschaffbar" markieren (fließt in Pflege/Preise/Katalog/Kosten). */
function setNatBeschaffbar(key,val){ if(!NATCFG.items[key]) return; NATCFG.items[key].beschaffbar=!!val; saveNatCfg(); buildMaterialIndex(); renderAdmin(); }
/* Vollständiges Entfernen einer Rubrik-Vorlage (nur zentral in der Matrix). */
function confirmDeleteRubTpl(id){ const t=RUBTPL.find(x=>x.id===id); if(!t) return;
  if(!confirm('Vorlage „'+t.name+'" überall entfernen? Die Rubrik verschwindet aus allen Standards; bereits dort eingetragene Einträge dieser Rubrik gehen verloren.')) return;
  deleteRubTpl(id); renderAdmin(); toast('Vorlage entfernt'); }
/* Baut das „Rubriken-Vorlagen"-Panel mit der Gruppen-Matrix (Häkchentabelle). */
function rubTplPanelHTML(){ const grps=distinctGroups();
  let h=`<details class="vpanel" data-keys="rubriken vorlagen rubrik vorlage geltungsbereich matrix automatisch gruppe">${vsum('🧩','Rubriken-Vorlagen','Legt fest, in welchen Standards eine Rubrik automatisch erscheint',RUBTPL.length||'')}<div class="vpanel-body">
    <p class="panel-help">Rubriken, die in mehreren Standards erscheinen sollen. Ein Häkchen setzt die Rubrik für eine ganze <b>Gruppe</b> (Spalte). Zeilen = Vorlagen. „●" bedeutet: gilt für <b>alle</b> Eingriffe. Anlegen im Standard über „＋ Rubrik" (dort Geltungsbereich wählen) oder hier unten.</p>`;
  if(!RUBTPL.length){ h+=`<p class="hint">Noch keine Vorlagen vorhanden.</p>`; }
  else if(!grps.length){ h+=`<p class="hint">Keine Gruppen vorhanden.</p>`; }
  else {
    h+=`<div class="tbl-wrap"><table class="rubmatrix"><thead><tr><th>Vorlage</th>`+grps.map(g=>`<th>${esc(g)}</th>`).join('')+`<th></th></tr></thead><tbody>`;
    RUBTPL.forEach(t=>{ const isAll=t.scope==='all';
      h+=`<tr><td class="rm-name">${esc(t.name)}<span class="rm-typ">${esc(typLabel(t.typ))}</span>${t.scope==='std'?`<span class="rm-scope">nur 1 Standard</span>`:''}</td>`;
      grps.forEach((g,gi)=>{ const on=(t.scope!=='std')&&rubTplMatches(t,null,g);
        h+=`<td class="rm-cell ${on?'on':''}" onclick="toggleTplGroup('${esc(t.id)}',${gi})">${on?(isAll?'●':'✓'):''}</td>`; });
      h+=`<td class="rm-actions"><button class="icon" onclick="openRubrikForm('${esc(t.id)}')">✏</button><button class="icon danger-btn" onclick="confirmDeleteRubTpl('${esc(t.id)}')">🗑</button></td></tr>`; });
    h+=`</tbody></table></div>`;
  }
  h+=`<div class="nat-foot"><button class="add-btn" onclick="openRubrikForm(null)">＋ Neue Vorlage</button></div></div></details>`;
  return h; }

/* Plankosten je Standard als CSV (Semikolon-getrennt, mit BOM für Excel/Umlaute). */
function exportCostCSV(){ try{
  const rows=[['Standard','Gruppe','Plankosten_EUR','Materialien','mit_Preis']];
  DB.standards.map(s=>({s,pk:stdPlankosten(s)})).filter(x=>x.pk.items>0).sort((a,b)=>b.pk.total-a.pk.total)
    .forEach(x=>rows.push([stdTitel(x.s),stdGruppe(x.s),x.pk.total.toFixed(2).replace('.',','),String(x.pk.items),String(x.pk.priced)]));
  const csv=rows.map(r=>r.map(c=>{ const v=String(c); return /[";\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; }).join(';')).join('\r\n');
  const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='hkl-plankosten-'+today()+'.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  toast('CSV heruntergeladen'); }catch(e){ toast('Export fehlgeschlagen',true); } }

/* Einheitliche Panel-Kopfzeile: Symbol · Titel · Klartext „was es ändert" ·
   optionaler Status-Badge. So sagt JEDES Menü, was es bewirkt (nicht nur eine
   nackte Zahl). Symbol ist fest verdrahtet (nicht zu escapen), Rest escaped. */
function vsum(icon,title,desc,badge){
  const b=(badge!=null&&badge!=='')?`<span class="vp-badge">${esc(String(badge))}</span>`:'';
  return `<summary><span class="vp-ico">${icon}</span><span class="vp-txt"><span class="vp-title">${esc(title)}</span><span class="vp-desc">${esc(desc)}</span></span>${b}</summary>`;
}
function renderAdmin(){ const box=$('scr-admin'); const {names,cnt}=computeUkList();

  /* Admin-Kopf: Modus verlassen */
  let html=`<div class="banner" style="display:flex;align-items:center;gap:12px"><div style="flex:1"><h2 style="margin:0">Verwaltung</h2><p style="margin:2px 0 0">Hier stellst du die App ohne Programmierung ein. Die Bereiche sind in drei Blöcke gegliedert; oben kannst du eine Einstellung direkt suchen. Kolleginnen im Nutzungs-Modus sehen nur die fertigen Standards.</p></div><button class="btn btn-sec" style="flex:0 0 auto;min-height:44px;padding:10px 14px" onclick="adminLogout()">Verlassen</button></div>`;

  /* Einstellungs-Suche (wie in den Handy-Einstellungen): filtert die Panels
     nach Titel + Stichwörtern/Synonymen (QM-Konzept §4B). */
  html+=`<div class="std-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><input type="search" id="admSearchInput" placeholder="Einstellung suchen (z. B. Farbe, Preis, Kategorie …)" oninput="adminSearch(this.value)" autocomplete="off"></div>`;
  html+=`<div id="admNoHit" class="empty" style="display:none"><div class="ei">🔍</div><h3>Kein Treffer</h3><p>Keine Einstellung passt zu deiner Suche.</p></div>`;

  /* ── Panel: Datensicherung ── */
  const pBackup=`<details class="vpanel" data-keys="datensicherung sicherung backup export import daten datei">${vsum('💾','Datensicherung','Speichert alle Anpassungen als Datei — oder spielt eine Sicherung wieder ein')}<div class="vpanel-body">
    <div class="p-actions"><button class="btn btn-pri" onclick="exportBackup()">Sicherung herunterladen</button><button class="btn btn-sec" onclick="$('bkImp').click()">Sicherung einspielen</button></div>
    <input type="file" id="bkImp" accept="application/json,.json" style="display:none" onchange="importBackupFile(event)">
    <p class="hint">Sichert ALLE Anpassungen dieses Geräts in einer Datei (Kategorien, Umbenennungen, Mengen, Größen, neue Einträge, Ausblendungen, Einstellungen). Nicht enthalten: die Tageshaken und der Admin-Status. Empfehlung: nach jeder größeren Pflege-Sitzung exportieren.</p>
  </div></details>`;

  /* ── Panel: Anzeige-Einstellungen ── */
  const tgl=(k,l)=>`<label class="tgl"><span>${l}</span><input type="checkbox" ${settings[k]?'checked':''} onchange="setSetting('${k}',this.checked)"></label>`;
  const anzKeys=['menge','groessen','spez','lagerort','konfidenz','fliesstext']; const anzOn=anzKeys.filter(k=>settings[k]).length;
  const pAnzeige=`<details class="vpanel" data-keys="anzeige einstellungen sichtbar menge größen groessen spezifikation lagerort konfidenz fließtext fliesstext badges">${vsum('👁','Anzeige-Einstellungen','Blendet Zusatzangaben an jedem Eintrag ein/aus (Menge, Größen, Lagerort, Warnung …)',anzOn+'/'+anzKeys.length+' an')}<div class="vpanel-body">
    ${tgl('menge','Menge (Kästchen links)')}${tgl('groessen','Größen-Badges')}${tgl('spez','Spezifikation')}${tgl('lagerort','Lagerort')}${tgl('konfidenz','Konfidenz-Warnung ⚠')}${tgl('fliesstext','Fließtext-Einträge')}
  </div></details>`;

  /* ── Panel: Kostenübersicht (Plankosten je Standard) ── */
  const costRows=DB.standards.map(s=>({s,pk:stdPlankosten(s)})).filter(x=>x.pk.items>0).sort((a,b)=>b.pk.total-a.pk.total);
  const costTotal=costRows.reduce((n,x)=>n+x.pk.total,0);
  let pKosten=`<details class="vpanel" data-keys="kosten kostenübersicht kostenuebersicht preis plankosten euro geld csv">${vsum('💶','Kostenübersicht','Zeigt die Plankosten je Standard (Menge × Stückpreis) — als CSV exportierbar',costRows.length?fmtEUR(costTotal):'')}<div class="vpanel-body">`;
  if(!costRows.length) pKosten+=`<p class="hint">Noch keine Preise erfasst. Stückpreise in „Material pflegen" eintragen – die Plankosten je Standard erscheinen dann hier und als Banner im Standard.</p>`;
  else{
    pKosten+=`<div class="ukrow" style="border-left-color:var(--accent)"><div class="ukrow-head"><span class="uk-name"><b>Gesamt (alle Standards)</b></span><span class="uk-count">${fmtEUR(costTotal)}</span></div></div>`;
    costRows.forEach(x=>{ const miss=x.pk.items-x.pk.priced;
      pKosten+=`<div class="ukrow"><div class="ukrow-head"><span class="uk-name">${esc(stdTitel(x.s))}</span><span class="uk-count">${fmtEUR(x.pk.total)}</span></div><div class="vw-ctx">${esc(stdGruppe(x.s))} · ${x.pk.priced}/${x.pk.items} mit Preis${miss>0?` · ${miss} offen`:''}</div></div>`; });
    pKosten+=`<div class="p-actions"><button class="btn btn-sec" onclick="exportCostCSV()">Als CSV exportieren</button></div>`;
  }
  pKosten+=`<p class="hint">Plankosten = Summe aus Menge × Stückpreis über alle beschaffbaren Materialien/Geräte eines Standards. Materialien ohne Preis zählen als 0.</p></div></details>`;

  /* ── Panel: Eigene Standards ── */
  let pStd=`<details class="vpanel" data-keys="eigene standards standard neu anlegen">${vsum('➕','Eigene Standards','Neue Standards anlegen und selbst erstellte bearbeiten oder löschen',ADDITIONS.standards.length||'')}<div class="vpanel-body">`;
  if(!ADDITIONS.standards.length) pStd+=`<p class="hint">Noch keine eigenen Standards. „＋ Neuer Standard" anlegen – er erscheint dann in der Liste unter „Nutzung".</p>`;
  ADDITIONS.standards.forEach(s=>{ pStd+=`<div class="ukrow"><div class="ukrow-head"><span class="uk-name">${esc(s.titel)}</span><span class="uk-count">${esc(s.gruppe)}</span></div>
    <div class="uk-actions"><button onclick="openStandardById('${esc(s.id)}')">Öffnen</button><button onclick="openStandardForm('${esc(s.id)}')">Bearbeiten</button><button class="icon danger-btn" onclick="confirmDeleteStandard('${esc(s.id)}')">🗑</button></div></div>`; });
  pStd+=`<div class="nat-foot"><button class="add-btn" onclick="openStandardForm(null)">＋ Neuer Standard</button></div>
    <p class="hint">Neue Standards und eigene Einträge werden zentral auf dem Server gespeichert und auf allen Geräten geteilt.</p></div></details>`;

  /* ── Panel: Rubriken-Vorlagen (Geltungsbereich-Matrix) ── */
  const pRubTpl=rubTplPanelHTML();

  /* ── Panel: Design ── */
  const rb=(v,l)=>`<button class="${(DESIGN.scale||'normal')===v?'on':''}" onclick="setDesign('scale','${v}')">${l}</button>`;
  const pDesign=`<details class="vpanel" data-keys="design farbe farben akzent größe groesse schrift schriftgröße wandmonitor aussehen">${vsum('🎨','Design','Ändert Akzentfarbe, Größen-Badge-Farbe und Schriftgröße der ganzen App')}<div class="vpanel-body">
    <div class="tgl"><span>Akzentfarbe</span><input type="color" class="colinp" value="${DESIGN.accent||'#3d9be0'}" onchange="setDesign('accent',this.value)"></div>
    <div class="tgl"><span>Größen-Badge-Farbe</span><input type="color" class="colinp" value="${DESIGN.size||'#21c1d6'}" onchange="setDesign('size',this.value)"></div>
    <div class="flabel" style="margin:12px 0 6px">Schriftgröße / Ansicht</div>
    <div class="filter-row">${rb('normal','Normal')}${rb('gross','Groß')}${rb('wand','Wandmonitor')}</div>
    <button class="reset-btn" style="width:100%;padding:11px;border-radius:9px;border:1px solid var(--line);background:var(--surface-2);color:var(--text-dim);font-weight:650;cursor:pointer" onclick="resetDesign()">Design zurücksetzen</button>
    <p class="hint">Akzent- und Badge-Farbe gelten in heller und dunkler Ansicht. „Wandmonitor" vergrößert die gesamte Darstellung.</p>
  </div></details>`;

  /* ── Panel: Texte ── */
  const ti=(k,l)=>`<div class="flabel" style="margin-top:8px">${l}</div><input class="txtinp" style="width:100%" value="${esc(txt(k))}" onchange="setTxt('${k}',this.value)">`;
  const pTexte=`<details class="vpanel" data-keys="texte text titel banner beschriftung benennung wörter überschrift">${vsum('🔤','Texte','Ändert App-Titel und die Einleitungstexte der Pflege-Ansichten')}<div class="vpanel-body">
    ${ti('appTitle','App-Titel (Startseite)')}${ti('careTitle','Titel „Material pflegen"')}${ti('careIntro','Einleitung „Material pflegen"')}${ti('pruefTitle','Titel „Einstufung prüfen"')}
    <button class="reset-btn" style="margin-top:12px;width:100%;padding:11px;border-radius:9px;border:1px solid var(--line);background:var(--surface-2);color:var(--text-dim);font-weight:650;cursor:pointer" onclick="resetTxt()">Texte zurücksetzen</button>
  </div></details>`;

  /* ── Panel: Gruppen & Symbole ── */
  const grps=distinctGroups(); const rubs=distinctRubrics();
  let pGruppen=`<details class="vpanel" data-keys="gruppen gruppe symbole symbol icon icons reihenfolge startseite">${vsum('📚','Gruppen & Symbole','Ordnet die Gruppen auf der Startseite und wählt die Symbole der Rubriken')}<div class="vpanel-body">
    <div class="flabel">Gruppen-Reihenfolge (Startseite)</div>`;
  if(grps.length===0) pGruppen+=`<p class="hint">Keine Gruppen.</p>`;
  grps.forEach((g,i)=>{ pGruppen+=`<div class="ukrow" style="border-left-color:var(--accent)"><div class="ukrow-head"><span class="uk-name">${esc(g)}</span></div><div class="uk-actions"><button class="icon" onclick="moveGroup(${i},-1)">▲</button><button class="icon" onclick="moveGroup(${i},1)">▼</button></div></div>`; });
  pGruppen+=`<div class="flabel" style="margin-top:14px">Rubrik-Symbole</div>`;
  rubs.forEach((nm,i)=>{ const ic=RUBICON[nm]||rubrikIcon(nm,''); pGruppen+=`<div class="ukrow"><div class="ukrow-head"><span class="uk-ico">${ic}</span><span class="uk-name">${esc(nm)}</span></div><div class="uk-actions"><button onclick="editRubIcon(${i})">Symbol ändern</button></div></div>`; });
  pGruppen+=`<p class="hint">Das Symbol gilt für alle Rubriken dieses Namens (z. B. „Saal und Geräte" in jedem Standard).</p></div></details>`;

  /* ── Panel: Kategorien (Naturen) ── */
  let pKat=`<details class="vpanel" data-keys="kategorien kategorie natur naturen farbe symbol material beschaffbar art">${vsum('🏷️','Kategorien','Name, Farbe und Symbol der Eintrags-Kategorien; legt fest, was als Material zählt',natList().length)}<div class="vpanel-body">`;
  natList().forEach(n=>{
    pKat+=`<div class="natrow" style="border-left-color:${n.color}">
      <div class="natrow-head"><span class="nat-ico">${n.icon}</span><input class="txtinp" value="${esc(n.label)}" onchange="setNatLabel('${esc(n.key)}',this.value)"><input type="color" class="colinp" value="${n.color}" onchange="setNatColor('${esc(n.key)}',this.value)"></div>
      <div class="nat-actions"><button onclick="editNatIcon('${esc(n.key)}')">Symbol: ${n.icon}</button>${n.builtin?'':`<button class="danger-btn" onclick="deleteNat('${esc(n.key)}')">Löschen</button>`}</div>
      <label class="tgl natbesch"><span>zählt als Material (Pflege · Preise · Katalog)</span><input type="checkbox" ${n.beschaffbar?'checked':''} onchange="setNatBeschaffbar('${esc(n.key)}',this.checked)"></label>
    </div>`;
  });
  pKat+=`<div class="nat-foot">${admNewNatOpen
      ? `<input type="text" id="admNewNatInp" class="txtinp" placeholder="Name der neuen Kategorie" style="flex:1;min-width:140px">
         <button class="add-btn" onclick="addNat()">Anlegen</button><button class="reset-btn" onclick="admNewNatOpen=false;renderAdmin()">Abbrechen</button>`
      : `<button class="add-btn" onclick="admNewNatOpen=true;renderAdmin()">＋ Neue Kategorie</button>`}<button class="reset-btn" onclick="resetNatCfg()">Zurücksetzen</button></div>
    <p class="hint">Farbe: auf das Farbfeld tippen (Farbwähler öffnet sich). Name: Feld antippen und tippen. Symbol: Knopf antippen und ein Emoji eingeben. Deine Änderungen wirken sofort überall in der App und werden zentral auf dem Server gespeichert (auf allen Geräten geteilt).</p></div></details>`;

  /* ── Panel: Unterkategorien verwalten ── */
  let pUk=`<details class="vpanel" data-keys="unterkategorien unterkategorie untergruppe materialgruppe farbe zusammenführen zusammenfuehren">${vsum('🗂','Unterkategorien','Material-Unterkategorien benennen, färben, sortieren und zusammenführen',names.length+' Gruppen')}<div class="vpanel-body">`;
  if(names.length===0) pUk+=`<p class="hint">Keine Unterkategorien erkannt.</p>`;
  names.forEach((name,i)=>{ const col=ukColorOf(name,i); const ico=ukIconOf(name);
    const sw=UK_PALETTE.map(c=>`<span class="uk-sw ${c===col?'sel':''}" style="background:${c}" onclick="setUkColor(${i},'${c}')"></span>`).join('');
    pUk+=`<div class="ukrow" style="--uk:${col}"><div class="ukrow-head"><span class="uk-ico">${ico}</span><span class="uk-name">${esc(name)}</span><span class="uk-count">${cnt.get(name)||0}×</span></div>
      <div class="uk-swatches">${sw}</div>
      <div class="uk-actions"><button onclick="renameUk(${i})">Umbenennen / Zusammenführen</button><button class="icon" onclick="moveUk(${i},-1)">▲</button><button class="icon" onclick="moveUk(${i},1)">▼</button></div></div>`; });
  pUk+=`<p class="hint">Tipp: Beim Umbenennen einen bereits vorhandenen Namen eingeben = zwei Gruppen zusammenführen. Einzelne Einträge umhängen: unten in „Einstufung prüfen".</p></div></details>`;

  /* ── Panel: Ausgeblendete Einträge (Wiederherstellung) ── */
  const hid=collectHidden(); const hidTotal=hid.byCid.length+hid.byMat.length+hid.byStd.length+hid.byRub.length;
  let pHidden=`<details class="vpanel" data-keys="ausgeblendete einträge eintraege versteckt wiederherstellen papierkorb gelöscht geloescht">${vsum('🗑','Ausgeblendete Einträge','Ausgeblendete Standards, Rubriken und Einträge wieder sichtbar machen',hidTotal||'')}<div class="vpanel-body">`;
  if(hidTotal===0) pHidden+=`<p class="hint">Nichts ausgeblendet.</p>`;
  hid.byStd.forEach(s=>{ pHidden+=`<div class="ukrow"><div class="ukrow-head"><span class="uk-name">${esc(stdTitel(s))}</span><span class="uk-count">Standard</span></div><div class="uk-actions"><button onclick="restoreStd('${esc(s.id)}')">Wiederherstellen</button></div></div>`; });
  hid.byRub.forEach(x=>{ pHidden+=`<div class="ukrow"><div class="ukrow-head"><span class="uk-name">${esc(x.name)}</span><span class="uk-count">Rubrik</span></div><div class="vw-ctx">${esc(stdTitel(x.std))}</div><div class="uk-actions"><button onclick="restoreRub('${esc(x.key)}')">Wiederherstellen</button></div></div>`; });
  /* material_key ist Freitext (kann ' enthalten) → über data-Attribut statt
     Inline-Argument übergeben; esc() macht den Wert Attribut-sicher ("). */
  hid.byMat.forEach(mk=>{ pHidden+=`<div class="ukrow"><div class="ukrow-head"><span class="uk-name">${esc(mk)}</span><span class="uk-count">überall</span></div><div class="uk-actions"><button data-k="${esc(mk)}" onclick="restoreMat(this.dataset.k)">Wiederherstellen</button></div></div>`; });
  hid.byCid.forEach(x=>{ pHidden+=`<div class="ukrow"><div class="ukrow-head"><span class="uk-name">${esc(x.e.anzeige_text||x.e.roh_text)}</span></div><div class="vw-ctx">${esc(x.std.titel)} · ${esc(x.rubrik)}</div><div class="uk-actions"><button onclick="restoreCid('${esc(x.cid)}')">Wiederherstellen</button></div></div>`; });
  pHidden+=`</div></details>`;

  /* ── Panel: Einstufung prüfen (Prüf-Workflow, jetzt einklappbar) ── */
  const all=collectUncertain(); const done=all.filter(x=>isHandled(x.cid)).length; const pct=all.length?Math.round(done/all.length*100):0;
  const openCount=all.filter(x=>!isHandled(x.cid)).length;
  let list=all;
  if(admState==='offen') list=all.filter(x=>!isHandled(x.cid));
  if(admState==='erledigt') list=all.filter(x=>isHandled(x.cid));
  if(admNat!=='alle') list=list.filter(x=>effNatur(x.e,x.cid)===admNat);
  let pPruef=`<details class="vpanel" data-keys="einstufung prüfen pruefen kategorie konfidenz zuordnung unsicher korrigieren"${openCount?' open':''}>${vsum('🔎',txt('pruefTitle'),'Prüft und korrigiert die automatisch vergebene Kategorie unsicherer Einträge',openCount?openCount+' offen':(all.length?'geprüft ✓':''))}<div class="vpanel-body">`;
  pPruef+=`<p class="panel-help">Unsichere Einträge (mittlere/niedrige Konfidenz). Kategorie korrigieren, Unterkategorie zuweisen oder als „geprüft" bestätigen – dann verschwinden sie aus „Offen". Korrekturen werden zentral gespeichert und auf allen Geräten geteilt.</p><div class="prog"><div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div><div class="prog-txt">${done} von ${all.length} erledigt (${pct} %)</div></div>
  <div class="filter-row"><button class="${admState==='offen'?'on':''}" onclick="setAdmState('offen')">Offen</button><button class="${admState==='erledigt'?'on':''}" onclick="setAdmState('erledigt')">Erledigt</button><button class="${admState==='alle'?'on':''}" onclick="setAdmState('alle')">Alle</button></div>`;
  const natFilters=['alle'].concat(natList().filter(n=>n.key!=='ueberschrift').map(n=>n.key));
  pPruef+=`<div class="filter-row">`+natFilters.map(k=>`<button class="${admNat===k?'on':''}" onclick="setAdmNat('${esc(k)}')">${k==='alle'?'Alle':esc(natOf(k).label)}</button>`).join('')+`</div>`;
  if(list.length===0) pPruef+=`<div class="empty"><div class="ei">✓</div><h3>Nichts zu prüfen</h3><p>In diesem Filter gibt es keine Einträge.</p></div>`;
  list.slice(0,300).forEach(x=>{ const nat=effNatur(x.e,x.cid); const isOv=naturKorrigiert(x.cid); const isRev=!!reviewed[x.cid]; const uk=canonUk(x.e,x.cid); const cur=natOf(nat);
    const setBtns=natList().map(n=>`<button class="${nat===n.key?'sel':''}" style="color:${n.color}" onclick="setNatur('${esc(x.cid)}','${esc(n.key)}')">${esc(n.label)}</button>`).join('');
    const opts=['<option value="">— ohne —</option>'].concat(UK_LIST.map(u=>`<option value="${esc(u)}" ${uk===u?'selected':''}>${esc(u)}</option>`)).concat(['<option value="__neu__">＋ Neue Unterkategorie…</option>']).join('');
    const newUkRow=(admNewUkFor===x.cid)?`<div class="p-actions" style="margin-top:6px"><input type="text" class="txtinp" id="admUkNewInp" placeholder="Name der neuen Unterkategorie" style="flex:1;min-width:120px"><button class="add-btn" data-c="${esc(x.cid)}" onclick="admUkNewSave(this.dataset.c)">Anlegen</button></div>`:'';
    pPruef+=`<div class="vwrow ${isHandled(x.cid)?'done':''}"><div class="vw-txt">${esc(x.e.anzeige_text||x.e.roh_text)}</div><div class="vw-ctx">${esc(x.std.titel)} · ${esc(x.rubrik)} · Konfidenz ${esc(x.e.natur_konfidenz)}${isOv?'<span class="vw-badge override">korrigiert</span>':''}${isRev?'<span class="vw-badge reviewed">geprüft</span>':''}</div>
      ${sizeBadges(x.e.groessen)?`<div class="e-meta" style="margin-top:8px">${sizeBadges(x.e.groessen)}</div>`:''}
      <div class="vw-lbl">Kategorie: <span class="nat-chip" style="color:${cur.color};background:${cur.color}22">${esc(cur.label)}</span></div><div class="vw-set">${setBtns}</div>
      <div class="vw-lbl">Unterkategorie</div><select class="vw-sel" data-c="${esc(x.cid)}" onchange="admUkChange(this.dataset.c,this)">${opts}</select>${newUkRow}
      <div class="vw-foot"><button class="${isRev?'':'done-btn'}" onclick="toggleReviewed('${esc(x.cid)}')">${isRev?'↺ wieder öffnen':'✓ geprüft'}</button><button onclick="hideCid('${esc(x.cid)}')">🗑 Ausblenden</button></div></div>`; });
  if(list.length>300) pPruef+=`<div class="foot">Zeige erste 300 von ${list.length}. Filter nutzen.</div>`;
  pPruef+=`</div></details>`;

  /* ── Panel: Inhalte & Aufbau (Souveränität: der ganze Baum zentral) ── */
  let pInhalt=`<details class="vpanel" data-keys="inhalte aufbau struktur baum standards rubriken einträge eintraege anlegen verschieben hinzufügen hinzufuegen"${admContSid?' open':''}>${vsum('🧱','Inhalte & Aufbau','Alle Standards und Rubriken zentral durchgehen — überall anlegen, öffnen, ergänzen',DB.standards.filter(s=>!stdHidden(s)).length+' Standards')}<div class="vpanel-body">`;
  if(!admContSid){
    pInhalt+=`<p class="panel-help">Standard antippen → seine Rubriken (dort: Einträge hinzufügen oder direkt hineinspringen). Ausblenden/Bearbeiten einzelner Einträge: in der Ansicht per langem Tippen bzw. ⋯.</p>`;
    DB.standards.forEach(s=>{ const hid=stdHidden(s);
      pInhalt+=`<div class="ukrow"${hid?' style="opacity:.55"':''}><div class="ukrow-head"><span class="uk-name">${hid?'🚫 ':''}${esc(stdTitel(s))}</span><span class="uk-count">${esc(stdGruppe(s))}</span></div>
        <div class="uk-actions"><button data-k="${esc(s.id)}" onclick="admContSid=this.dataset.k;renderAdmin()">Rubriken ▸</button><button data-k="${esc(s.id)}" onclick="openStandardById(this.dataset.k)">Öffnen</button></div></div>`; });
    pInhalt+=`<div class="nat-foot"><button class="add-btn" onclick="openStandardForm(null)">＋ Neuer Standard</button></div>`;
  } else {
    const cs=DB.standards.find(x=>x.id===admContSid);
    if(!cs){ admContSid=null; pInhalt+=`<p class="hint">Standard nicht gefunden.</p>`; }
    else {
      pInhalt+=`<div class="p-actions"><button class="btn btn-sec" onclick="admContSid=null;renderAdmin()">← Alle Standards</button></div>
        <p class="panel-help"><b>${esc(stdTitel(cs))}</b> — „＋ Eintrag" legt direkt in der Rubrik an; „Öffnen" springt hinein (dort Bearbeiten/Verschieben/Löschen je Eintrag).</p>`;
      (cs.rubriken||[]).forEach((r,ri)=>{
        const cnt=(r.sub_bereiche||[]).reduce((n,sb)=>n+((sb.eintraege||[]).filter(x=>x.natur!=='ueberschrift').length),0);
        pInhalt+=`<div class="ukrow"><div class="ukrow-head"><span class="uk-name">${esc(r.name)}</span><span class="uk-count">${cnt} Einträge</span></div>
          <div class="uk-actions"><button data-i="${ri}" onclick="admContAddEntry(+this.dataset.i)">＋ Eintrag</button><button data-i="${ri}" onclick="admContOpenRub(+this.dataset.i)">Öffnen</button></div></div>`; });
    }
  }
  pInhalt+=`</div></details>`;

  /* Drei Themenblöcke (QM-Konzept §4B): Inhalte · Aussehen · Daten */
  const sec=(t)=>`<div class="vsec">${esc(t)}</div>`;
  html+=sec('Inhalte pflegen')+pInhalt+pStd+pRubTpl+pKat+pUk+matMergePanelHTML()+pPruef+rulesPanelHTML()+pHidden;
  html+=sec('Aussehen & Anzeige')+pAnzeige+pGruppen+pDesign+pTexte;
  html+=sec('Daten & Sicherung')+pBackup+pKosten;
  box.innerHTML=html;
  if(admNewNatOpen){ const inp=$('admNewNatInp'); if(inp){ inp.focus(); inp.onkeydown=(ev)=>{ if(ev.key==='Enter'){ ev.preventDefault(); addNat(); } }; } }
}
/* ── Panel: Materialzusammenführung (Destillation) ──────────────────────
   Ordnet jedes Material-Vorkommen im Standard seinem echten Produkt-Stammsatz
   (GTINDB-Produkt bzw. manueller Stammsatz) zu und schlägt Duplikate vor
   (gleiche Normalform des Namens). Siehe docs/KONZEPT-MATERIALSTAMM.md. */
function matMergePanelHTML(){
  const list=(typeof matDistinctList==='function')?matDistinctList():[];
  const cId=(k)=>(typeof canonId==='function')?canonId(k):null;
  const cOf=(k)=>(typeof canonOf==='function')?canonOf(k):null;
  const linked=list.filter(x=>cId(x.key)).length;
  const groups=(typeof matSuggestGroups==='function')?matSuggestGroups(list):[];
  const prods=(typeof GTINDB==='object'&&GTINDB)?Object.keys(GTINDB).map(k=>GTINDB[k]):[];
  let p=`<details class="vpanel" data-keys="material zusammenführen zusammenfuehren zusammenführung destillieren destillation stammsatz verknüpfen verknuepfen duplikate produkt scanner etikett">${vsum('🧬','Materialzusammenführung','Gleiche Materialien einem Produkt-Stammsatz zuordnen (destillieren) und Duplikate zusammenführen',list.length?linked+'/'+list.length+' verknüpft':'')}<div class="vpanel-body">`;
  p+=`<p class="panel-help">Materialien aus dem JSON-Import und selbst angelegte sind oft dasselbe. Ordne jedes Vorkommen seinem echten Produkt-Stammsatz zu (Name, Foto, Maße, Eigenschaften) — der Standard bleibt unverändert, bekommt aber die destillierte Identität. Alles rücknehmbar.</p>`;
  if(groups.length){
    p+=`<div class="flabel">Mögliche Duplikate (${groups.length})</div>`;
    groups.forEach((g,gi)=>{ const names=g.map(k=>{ const it=list.find(x=>x.key===k); return it?it.name:k; });
      p+=`<div class="ukrow" style="border-left-color:var(--accent)"><div class="ukrow-head"><span class="uk-name">${esc(names[0])}</span><span class="uk-count">${g.length}×</span></div>
        <div class="vw-ctx">${names.slice(1).map(esc).join(' · ')||'—'}</div>
        <div class="uk-actions"><button data-i="${gi}" onclick="matMergeGroup(+this.dataset.i)">Zu einem Stammsatz zusammenführen</button></div></div>`; });
  }
  p+=`<div class="flabel" style="margin-top:14px">Alle Materialien (${list.length})</div>`;
  if(!list.length) p+=`<p class="hint">Keine Materialien in den Standards gefunden.</p>`;
  const optsFor=(sel)=>['<option value="">— nicht verknüpft —</option>']
     .concat(prods.map(r=>`<option value="${esc(r.gtin)}" ${sel===r.gtin?'selected':''}>${esc(r.name||r.ref||r.gtin)}</option>`))
     .concat([`<option value="__neu__">＋ Neuer Stammsatz aus diesem Material</option>`]).join('');
  list.slice(0,300).forEach(x=>{ const id=cId(x.key); const c=cOf(x.key);
    p+=`<div class="ukrow"><div class="ukrow-head"><span class="uk-name">${c&&c.photo?'🖼 ':''}${esc(x.name)}</span><span class="uk-count">${x.count}×</span></div>
      ${id?`<div class="vw-ctx">🔗 ${esc(c?(c.name||c.ref||c.gtin):id)}</div>`:''}
      <select class="vw-sel" data-k="${esc(x.key)}" onchange="matAdminLink(this.dataset.k,this.value)">${optsFor(id)}</select></div>`; });
  if(list.length>300) p+=`<div class="foot">Zeige erste 300 von ${list.length}. Für weitere zuerst zusammenführen.</div>`;
  p+=`<p class="hint">„Zusammenführen" legt bei Bedarf einen Stammsatz an und verknüpft alle gleichen Vorkommen damit. Über den Etiketten-Scanner reicherst du den Stammsatz danach mit Foto, REF, Maßen und eigenen Eigenschaften an.</p></div></details>`;
  return p;
}
/* Verknüpft/löst ein einzelnes Material-Vorkommen mit einem Stammsatz. */
function matAdminLink(key,val){ if(!key) return;
  if(val===''){ if(typeof matUnlink==='function') matUnlink(key); }
  else if(val==='__neu__'){ const it=(typeof matDistinctList==='function'?matDistinctList():[]).find(x=>x.key===key);
    const id=(typeof matCreateStamm==='function')?matCreateStamm(it?it.name:key):null;
    if(id&&typeof matLinkTo==='function'){ matLinkTo(key,id); buildMaterialIndex(); renderAdmin();
      if(typeof openScanItem==='function') openScanItem(id,true); return; } }
  else if(typeof matLinkTo==='function'){ matLinkTo(key,val); }
  buildMaterialIndex(); renderAdmin(); }
/* Führt eine Duplikat-Gruppe zu EINEM Stammsatz zusammen: nimmt einen bereits
   verknüpften Stammsatz der Gruppe (falls vorhanden), sonst legt einen manuellen
   an, und verknüpft alle Vorkommen der Gruppe damit. */
function matMergeGroup(gi){ const list=(typeof matDistinctList==='function')?matDistinctList():[];
  const groups=(typeof matSuggestGroups==='function')?matSuggestGroups(list):[]; const g=groups[gi]; if(!g||!g.length) return;
  let id=null; for(const k of g){ const c=(typeof canonId==='function')?canonId(k):null; if(c){ id=c; break; } }
  if(!id){ const first=list.find(x=>x.key===g[0]); id=(typeof matCreateStamm==='function')?matCreateStamm(first?first.name:g[0]):null; }
  if(!id) return;
  g.forEach(k=>{ if(typeof matLinkTo==='function') matLinkTo(k,id); });
  buildMaterialIndex(); renderAdmin(); toast(g.length+' Vorkommen zusammengeführt'); }

/* Filtert die Verwaltungs-Panels live nach Titel/Stichwörtern (§4B). Alle
   Suchbegriffe müssen vorkommen; Abschnitts-Überschriften ohne sichtbares
   Panel werden mit ausgeblendet. Kein Re-Render → Panel-Zustände bleiben. */
function adminSearch(q){ q=(q||'').trim().toLowerCase(); const toks=q.split(/\s+/).filter(Boolean);
  const panels=[...document.querySelectorAll('#scr-admin .vpanel')];
  panels.forEach(p=>{ const keys=(p.getAttribute('data-keys')||'').toLowerCase();
    const show=!toks.length||toks.every(t=>keys.indexOf(t)>=0); p.style.display=show?'':'none'; if(toks.length&&show) p.open=true; });
  document.querySelectorAll('#scr-admin .vsec').forEach(s=>{ let n=s.nextElementSibling, any=false;
    while(n && !n.classList.contains('vsec')){ if(n.classList&&n.classList.contains('vpanel')&&n.style.display!=='none') any=true; n=n.nextElementSibling; }
    s.style.display=any?'':'none'; });
  const nh=$('admNoHit'); if(nh) nh.style.display=(toks.length && !panels.some(p=>p.style.display!=='none'))?'':'none';
}
function setSetting(k,v){ settings[k]=v; saveJSON('hkl_settings',settings); }
function setAdmState(s){ admState=s; renderAdmin(); }
function setAdmNat(n){ admNat=n; renderAdmin(); }
/* UK-Auswahl in „Einstufung prüfen": „＋ Neue Unterkategorie…" öffnet eine
   Eingabezeile direkt unter dem Select (statt prompt(), s. addNat). */
function admUkChange(cid,sel){ if(sel.value==='__neu__'){ admNewUkFor=cid; renderAdmin(); const i=$('admUkNewInp'); if(i){ i.focus(); i.onkeydown=(ev)=>{ if(ev.key==='Enter'){ ev.preventDefault(); admUkNewSave(cid); } }; } return; } reassignEntry(cid,sel.value); }
function admUkNewSave(cid){ const inp=$('admUkNewInp'); const v=(inp&&inp.value||'').trim(); if(!v){ if(inp) inp.focus(); return; } admNewUkFor=null; reassignEntry(cid,v); toast('Unterkategorie „'+v+'" angelegt'); }
/* Inhalte-&-Aufbau-Panel: in die Rubrik springen bzw. direkt anlegen. */
function admContOpenRub(ri){ if(!admContSid) return; const sid=admContSid; openStandardById(sid); openRubrik(ri); }
function admContAddEntry(ri){ if(!admContSid) return; openEntryForm({kind:'add', sid:admContSid, ri}); }
/* „Einstufung prüfen" schreibt jetzt denselben Regel-Weg (📍 Stelle) wie das
   Schnellmenü — statt in die Alt-Speicher overrides/reassign. So gibt es EINEN
   Schreibweg (journaliert, rücknehmbar). Nicht-Material-Einträge (kein
   material_key als Regel-Ziel) fallen auf den Alt-Pfad zurück. */
function setNatur(cid,nat){ const e=findEntry(cid); if(!e) return;
  if(e.material_key && typeof addRule==='function'){
    if(e.natur===nat){ revokeStelleRules(e.material_key,cid,'natur'); clearLegacyAt(e,cid,'stelle','natur'); }
    else { addRule({art:'material',key:e.material_key},{art:'stelle',wert:cid},'natur',nat); clearLegacyAt(e,cid,'stelle','natur'); }
    buildMaterialIndex(); renderAdmin(); return; }
  if(e.natur===nat) delete overrides[cid]; else overrides[cid]=nat; saveJSON('hkl_overrides',overrides); buildMaterialIndex(); renderAdmin(); }
function toggleReviewed(cid){ if(reviewed[cid]) delete reviewed[cid]; else reviewed[cid]=true; saveJSON('hkl_reviewed',reviewed); renderAdmin(); }
function reassignEntry(cid,val){ const e=findEntry(cid);
  if(e&&e.material_key && typeof addRule==='function'){
    addRule({art:'material',key:e.material_key},{art:'stelle',wert:cid},'uk',(val===''?'':val)); clearLegacyAt(e,cid,'stelle','uk'); computeUkList(); renderAdmin(); return; }
  if(val==='') reassign[cid]=null; else reassign[cid]=val; saveJSON('hkl_reassign',reassign); computeUkList(); renderAdmin(); }
function findEntry(cid){ if(cid&&cid.indexOf('new|')===0){ const n=NEW.find(x=>('new|'+x.id)===cid); return n?newToEntry(n):null; } const p=cid.split('|'); const s=DB.standards.find(x=>x.id===p[0]); if(!s) return null; try{ return s.rubriken[+p[1]].sub_bereiche[+p[2]].eintraege[+p[3]]; }catch(e){ return null; } }

/* ─── Kategorien-Editor: schreibt in die Konfiguration + speichert ─── */
function setNatLabel(key,val){ if(!NATCFG.items[key]) return; NATCFG.items[key].label=(val||'').trim()||NATCFG.items[key].label; saveNatCfg(); renderAdmin(); }
function setNatColor(key,val){ if(!NATCFG.items[key]) return; NATCFG.items[key].color=val; saveNatCfg(); applyNatConfig(); buildMaterialIndex(); renderAdmin(); }
function editNatIcon(key){ if(!NATCFG.items[key]) return; const cur=NATCFG.items[key].icon||''; const v=prompt('Symbol (Emoji) für diese Kategorie:',cur); if(v==null) return; NATCFG.items[key].icon=(v.trim()||cur); saveNatCfg(); renderAdmin(); }
/* Eingabezeile statt prompt() (M1): window.prompt() liefert in installierten
   PWA-Fenstern (manifest display:"standalone") auf manchen Android-Chrome-
   Versionen keinen Dialog, sondern sofort null — das Anlegen schlug dadurch
   lautlos fehl. Der "＋ Neue Kategorie"-Button öffnet die Zeile direkt
   (admNewNatOpen=true); addNat() liest hier nur noch das Feld aus. */
function addNat(){
  const inp=$('admNewNatInp'); const label=(inp&&inp.value||'').trim();
  if(!label){ if(inp) inp.focus(); return; }
  const key=natSlug(label); const color=UK_PALETTE[NATCFG.order.length%UK_PALETTE.length];
  NATCFG.items[key]={key,label,color,icon:'🏷️',builtin:false,beschaffbar:false}; NATCFG.order.push(key); saveNatCfg(); applyNatConfig();
  admNewNatOpen=false; renderAdmin(); toast('Kategorie angelegt'); }
function deleteNat(key){ if(!NATCFG.items[key]||NATCFG.items[key].builtin) return; if(!confirm('Kategorie „'+NATCFG.items[key].label+'" löschen? Einträge, die du ihr manuell zugewiesen hast, fallen auf ihre ursprüngliche Kategorie zurück.')) return;
  delete NATCFG.items[key]; NATCFG.order=NATCFG.order.filter(k=>k!==key);
  Object.keys(overrides).forEach(cid=>{ if(overrides[cid]===key) delete overrides[cid]; }); saveJSON('hkl_overrides',overrides);
  saveNatCfg(); applyNatConfig(); buildMaterialIndex(); renderAdmin(); toast('Kategorie gelöscht'); }
function resetNatCfg(){ if(!confirm('Alle Kategorie-Anpassungen (Namen, Farben, Symbole, eigene Kategorien) auf die Voreinstellung zurücksetzen?')) return;
  store.set('hkl_natcfg',JSON.stringify({})); NATCFG=loadNatCfg(); saveNatCfg(); applyNatConfig(); buildMaterialIndex(); renderAdmin(); toast('Zurückgesetzt'); }

/* Unterkategorie-Operationen */
function renameUk(i){ const oldName=UK_LIST[i]; if(oldName==null) return;
  const nn=prompt('Unterkategorie umbenennen (vorhandenen Namen eingeben = zusammenführen):',oldName); if(nn==null) return; const newName=nn.trim(); if(!newName||newName===oldName) return;
  Object.keys(ukMap).forEach(raw=>{ if(ukMap[raw]===oldName) ukMap[raw]=newName; }); ukMap[oldName]=newName;
  Object.keys(reassign).forEach(cid=>{ if(reassign[cid]===oldName) reassign[cid]=newName; });
  const metaOld=ukMeta[oldName]; if(metaOld){ if(!ukMeta[newName]) ukMeta[newName]=metaOld; delete ukMeta[oldName]; }
  saveJSON('hkl_ukmap',ukMap); saveJSON('hkl_reassign',reassign); saveJSON('hkl_ukmeta',ukMeta);
  computeUkList(); renderAdmin(); toast('Unterkategorie aktualisiert'); }
function setUkColor(i,color){ const name=UK_LIST[i]; if(name==null) return; ukMeta[name]=Object.assign({},ukMeta[name],{color}); saveJSON('hkl_ukmeta',ukMeta); renderAdmin(); }
function moveUk(i,dir){ computeUkList(); const names=UK_LIST.slice(); const j=i+dir; if(j<0||j>=names.length) return;
  names.forEach((n,k)=>{ ukMeta[n]=Object.assign({},ukMeta[n],{order:k}); });
  const a=names[i], b=names[j]; const oa=ukMeta[a].order; ukMeta[a].order=ukMeta[b].order; ukMeta[b].order=oa;
  saveJSON('hkl_ukmeta',ukMeta); computeUkList(); renderAdmin(); }

