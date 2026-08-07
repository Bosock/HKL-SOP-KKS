/* ============ Schnellmenü (Long-Press) ============ */
let sheetCid=null, sheetEntry=null, sheetPending=null;
function showSheet(on){ $('sheet').classList.toggle('show',on); $('sheetOv').classList.toggle('show',on); if(!on){ sheetCid=null; sheetEntry=null; sheetPending=null; } }
function openSheet(cid){ const e=findEntry(cid); if(!e) return; sheetCid=cid; sheetEntry=e; sheetPending=null; renderSheetMain(); showSheet(true); }
function sAct(ico,label,sub,fn,cls){ return `<button class="sheet-act ${cls||''}" onclick="${fn}"><span class="sa-ico">${ico}</span><span>${esc(label)}<span class="sa-sub">${esc(sub)}</span></span></button>`; }
/* Abschnitts-Überschrift im Bearbeiten-Menü (Gruppierung nach Absicht statt
   flacher Liste — QM-Konzept §3: Inhalt · Darstellung · Organisation ·
   Gefahrenzone). */
function sGroup(title,sub){ return `<div class="sheet-group"><span class="sg-t">${esc(title)}</span>${sub?`<span class="sg-s">${esc(sub)}</span>`:''}</div>`; }
/* Wirkungs-Chips (QM-Konzept §1/A): zeigen WO die Änderungen wirken und WER sie
   sieht — einmal gelernt, überall wiedererkannt. Nur feste, sichere Literale. */
function sChips(arr){ return `<div class="sheet-chips">`+arr.map(c=>`<span class="schip">${c}</span>`).join('')+`</div>`; }
/* Der Sammler für ein Bearbeiten-Menü kommt aus features/funktionen.js und
   wendet die Einstellungen des Hauses an (ausblenden, umbenennen, umsortieren).
   Fehlt das Modul, bleibt das Menü trotzdem vollständig bedienbar — die
   Kern-Bedienung darf nie an einer Komfortfunktion hängen. */
function sheetBauer(bereich){
  if(typeof fktSheetBauer==='function') return fktSheetBauer(bereich);
  return { _h:'',
    gruppe(k,titel,sub){ if(titel) this._h += sGroup(titel,sub); },
    akt(k,ico,label,sub,fn,cls){ this._h += sAct(ico,label,sub,fn,cls); },
    html(){ return this._h; } };
}
/* Das Bearbeiten-Menü zeigt nur, was für DIESES Element sinnvoll ist, gegliedert
   in vier feste Fächer. Material-/Gerätespezifisches (Größen, Spezifikation,
   Unterkategorie, Katalog) erscheint nur bei beschaffbaren Einträgen. */
function renderSheetMain(){ const e=sheetEntry, cid=sheetCid; if(!e) return;
  const dn=qeGet(e,cid,'name'); const name=(dn!==undefined?dn:e.anzeige_text);
  const imp=qeGet(e,cid,'important')===true; const cur=natOf(effNatur(e,cid));
  const isMat=!!cur.beschaffbar;
  const mengeEffRaw=(qeGet(e,cid,'mengeVal')!==undefined?qeGet(e,cid,'mengeVal'):e.menge);
  const mHi=mengeHiEff(e,cid,mengeEffRaw);
  const menge=mengeEffRaw||'keine Menge';
  const groessen=(function(){const g=qeGet(e,cid,'groessen')!==undefined?qeGet(e,cid,'groessen'):e.groessen; return (g&&g.length)?g.map(x=>x.wert).join(', '):'keine';})();
  const spez=(function(){const s=qeGet(e,cid,'spez'); const v=(s!==undefined)?s:(Array.isArray(e.spezifikation)?e.spezifikation.join(' | '):e.spezifikation); return v||'keine';})();
  let h=`<div class="sheet-grip"></div><div class="sheet-title">Bearbeiten · ${esc(cur.label)}${e._added?' · eigener Eintrag':''}</div><div class="sheet-name">${esc(name)}</div>`;
  h+=sChips(['📍 dieser Eintrag', '👥 alle Geräte']);

  /* Jede Aktion trägt einen SCHLÜSSEL und läuft über den Sammler aus
     features/funktionen.js. Damit lässt sich jeder einzelne Punkt dieses
     Menüs in der Verwaltung ausblenden, umbenennen, mit eigenem Symbol
     versehen und innerhalb seiner Gruppe umsortieren — ohne Programmierung
     (docs/GRUNDSAETZE.md, Regel A7). Die Namen hier sind Auslieferungswerte,
     nicht die Wahrheit. */
  const S = sheetBauer('eintrag');

  S.gruppe('kopf','','');
  /* Inspektor (Kaskade sichtbar machen): warum sieht dieser Eintrag so aus? */
  S.akt('warum','🔍','Warum so?','zeigt, woher Name, Kategorie, Farbe & Co. kommen','openWhySheet()');
  /* Gehört die Zeile zu einem Baustein, muss das VOR der Änderung dastehen —
     sonst entsteht hier eine Abweichung, von der niemand etwas weiß. */
  if(typeof bauFuerCid==='function'){ const bs=bauFuerCid(cid);
    if(bs.length){ const b=bs[0].baustein; const n=bauVorkommen(b.id).length;
      S.akt('baustein','⛓️','Gehört zum Baustein „'+b.name+'"','steht an '+n+' Stellen — dort pflegen gilt überall','showSheet(false);openBausteinAdmin()'); } }

  S.gruppe('inhalt','Inhalt','Was der Eintrag ist');
  S.akt('details','✏️','Details bearbeiten','Name, Menge, Größe, Kategorie, Warum …','sheetEditDetails()');
  S.akt('umbenennen','🔤','Schnell umbenennen','nur den Anzeigenamen','sheetRename()');
  S.akt('menge','#️⃣','Menge ändern',menge,'sheetEditMenge()');
  if(isMat){
    S.akt('groessen','📏','Größen bearbeiten',groessen,'sheetEditSizes()');
    S.akt('spez','🧷','Spezifikation bearbeiten',spez,'sheetEditSpez()');
  }

  S.gruppe('darstellung','Darstellung','Wie er auffällt');
  S.akt('wichtig','⭐',imp?'Wichtig-Markierung entfernen':'Als wichtig markieren',imp?'aktuell markiert':'hervorheben',"sheetToggle('important')");
  S.akt('mengehi','🔢',mHi?'Zahl normal anzeigen':'Zahl/Menge hervorheben',(qeGet(e,cid,'mengeHi')!==undefined?'manuell übersteuert · ':'automatisch bei ≠1x · ')+(mengeEffRaw?'Menge '+mengeEffRaw:'keine Menge'),"sheetToggle('mengeHi')");
  S.akt('farbe','🎨','Farblich absetzen','eigene Akzentfarbe',"sheetGo('color')");
  if(typeof txsVon==='function'){ const stil=txsVon(e,cid);
    S.akt('schrift','🔠','Schrift & Auszeichnung', txsBeschreibung(stil)+(txsHatAuszeichnung(name)?' · Wörter hervorgehoben':''), "sheetGo('stil')"); }
  /* Bilder gibt es an JEDER Zeile, nicht nur an Material — ein Handgriff ist
     genauso erklärungsbedürftig wie ein Produkt (features/medien.js). */
  /* Ist das Bild-Symbol an dieser Art von Stelle abgeschaltet
     (features/bildorte.js), fällt auch dieser Punkt weg — sonst legte man
     Bilder an, die danach niemand sieht. */
  if(typeof medVonEintrag==='function' && (typeof bildKnopfZeigen!=='function' || bildKnopfZeigen(cid))){
    const nb=medVonEintrag(e,cid).length;
    S.akt('bilder','🖼️','Bilder', nb?(nb+' Bild'+(nb===1?'':'er')+' — ansehen, ergänzen, ordnen'):'Foto, Bildfolge oder Skizze hinzufügen', "sheetGo('bilder')"); }

  S.gruppe('organisation','Organisation','Wohin er gehört');
  S.akt('kategorie','🏷️','Kategorie ändern',cur.label,"sheetGo('cat')");
  if(isMat){ S.akt('uk','🗂️','Unterkategorie ändern','Gruppe zuweisen',"sheetGo('uk')"); }
  if(isMat&&typeof berVon==='function'){ const b=berVon(e,cid);
    S.akt('bereich','📍','Bereich', b?(b.symbol+' '+b.wort):'steriler Tisch, Umfeld …', "sheetGo('bereich')"); }
  if(isMat&&typeof altFuerZeile==='function'){ const t=altFuerZeile(e,cid);
    S.akt('alternativen','⇄','Alternativen', t.length?(t.length===1?'1 Austauschgruppe':(t.length+' Austauschgruppen')):'was geht stattdessen?', "sheetGo('alt')"); }
  /* EIN Punkt statt zweier Zustände: „verknüpft" und „nicht verknüpft" waren
     eine Datenmodell-Entscheidung, die in die Bedienung durchgeschlagen ist.
     Ein Material ist ein Material — openMaterial() legt den Stammsatz beim
     ersten Öffnen still an, falls es noch keinen gibt. */
  if(isMat&&e.material_key){ const cn=(typeof canonOf==='function')?canonOf(e.material_key):null;
    const fehlt=cn?[(cn.photo?null:'Foto'),(cn.lagerort?null:'Lagerort')].filter(Boolean):null;
    S.akt('material','🧬','Material öffnen',
      cn ? (fehlt.length?('es fehlt: '+fehlt.join(' und ')):'vollständig gepflegt') : 'Angaben, Etikett scannen, Foto',
      'matManage()'); }
  /* Der geschlossene Weg: nicht ein Werkzeug öffnen, sondern von hier an
     Material für Material durchgehen (features/pflege.js). */
  if(isMat&&typeof pflegeAbZeile==='function'){
    S.akt('pflege','🧹','Pflege-Weg ab hier','dieses Material fertig pflegen, dann das nächste','sheetPflegeWeg()'); }
  /* Der kürzeste Weg von „ist leer" zur Meldung: im Saal gesehen, hier
     gemeldet, im anderen Saal sofort sichtbar (features/bestellungen.js). */
  if(isMat&&typeof bestAusMaterial==='function'){
    S.akt('bestellen','🛒','„ist leer" melden','landet auf der Bestell-Seite — mit Kürzel und Uhrzeit','sheetBestellen()'); }
  S.akt('eigenefelder','＋','Eigene Felder','Zusatz-Infos als Badges am Eintrag',"sheetGo('zusatz')");
  S.akt('verschieben','📦','Verschieben','in andere Rubrik oder anderen Standard','renderSheetMove()');
  S.akt('hoch','⬆','Nach oben','Reihenfolge in der Gruppe','moveEntry(-1)');
  S.akt('runter','⬇','Nach unten','Reihenfolge in der Gruppe','moveEntry(1)');
  if(isMat){ S.akt('katalog','📥','In Katalog aufnehmen','für andere Standards verfügbar','sheetAddToCatalog()'); }
  if(typeof bauSammeln==='function'){ const drin=bauSammelt(cid); const n=bauSammelZahl();
    S.akt('sammeln', drin?'🧺':'＋', drin?'Aus der Baustein-Mappe nehmen':'In Baustein übernehmen',
      n?(n+' Zeile'+(n===1?'':'n')+' gesammelt'):'sammeln und später zu einem Baustein machen',
      'bauUiSammelnZeile()'); }

  S.gruppe('gefahr','Gefahrenzone','Entfernen & zurücksetzen');
  if(e._added){ S.akt('loeschen','🗑️','Endgültig löschen','eigenen Eintrag entfernen','sheetDeleteAdded()','danger'); }
  else { S.akt('loeschen','🗑️','Ausblenden / Löschen','aus der Anzeige entfernen','sheetDelete()','danger'); }
  S.akt('zuruecksetzen','↺','Änderungen zurücksetzen','für diesen Eintrag','sheetResetEntry()');

  h+=S.html();
  h+=`<button class="sheet-close" onclick="showSheet(false)">Schließen</button>`;
  $('sheet').innerHTML=h;
}

/* ── Gegliedertes Menü für einen STANDARD (Titelzeile bearbeiten) ──
   Gleiches Muster wie das Eintrags-Menü (§3): fasst die früher verstreuten
   Admin-Buttons in einem kontextsensitiven Sheet zusammen. */
function openStdSheet(id){ if(!ADMIN) return; if(id){ const t=DB.standards.find(x=>x.id===id); if(t) curStd=t; } if(!curStd) return; const s=curStd; const hid=stdHidden(s);
  let h=`<div class="sheet-grip"></div><div class="sheet-title">Standard bearbeiten${s.__new?' · App-eigen':''}</div><div class="sheet-name">${esc(stdTitel(s))}</div>`;
  h+=sChips(['📄 dieser Standard', '👥 alle Geräte']);
  const S = sheetBauer('standard');
  S.gruppe('inhalt','Inhalt','Titel, Gruppe & Freigabe');
  S.akt('titel','✏️','Titel & Gruppe','Name und Zuordnung','showSheet(false);openStdRenameForm()');
  S.akt('merkmale','🏷','Merkmale', (typeof eigChips==='function'&&eigChips(s.id).length)?(eigChips(s.id).length+' vergeben'):'z. B. sedierungspflichtig', 'eigSheet(curStd.id)');
  if(typeof bildKnopfZeigen!=='function' || bildKnopfZeigen(medAnkStd(s.id)))
    S.akt('bilder','🖼️','Bilder am Standard', (typeof medAnkerPaare==='function'&&medAnkerPaare(medAnkStd(s.id)).length)?(medAnkerPaare(medAnkStd(s.id)).length+' Bilder'):'Fotos im Kopf des Standards', 'medAnkerSheet(medAnkStd(curStd.id), stdTitel(curStd))');
  S.akt('freigabe','🏷️','Freigabe prüfen & erteilen','Siegel, Version, Gültigkeit','showSheet(false);openFreigabe(curStd.id)');
  if(typeof fasSheet==='function'){ const f=fasFuerStandard(s.id);
    S.akt('festschreiben','📚','Stand festschreiben', f?('Fassung „'+f.wort+'" gilt'):'die App wird zur Grundlage', 'fasSheet(curStd.id)'); }
  if(typeof pflegeFuerStandard==='function'){ const p=(typeof pfStats==='function')?pfStats({art:'standard',wert:s.id}):null;
    S.akt('pflege','🧹','Pflege-Weg für diesen Standard',
      p?(p.offen?(p.offen+' von '+p.gesamt+' Materialien offen'):(p.gesamt+' Materialien — alle gepflegt')):'Material für Material durchgehen',
      'showSheet(false);pflegeFuerStandard(curStd.id)'); }
  S.gruppe('kopieren','Neuen Standard daraus machen','Kopieren statt abtippen');
  S.akt('duplizieren','⧉','Duplizieren','vollständige, unabhängige Kopie als Entwurf','showSheet(false);openDupStdForm()');
  if(typeof ownHatStruktur==='function' && ownHatStruktur(s.id)){
    S.akt('segment','＋','Segment hinzufügen','neue Rubrik in diesem eigenen Standard','showSheet(false);ownAddRubrikUI()'); }
  S.gruppe('gefahr','Gefahrenzone','Ausblenden & löschen');
  S.akt('ausblenden',hid?'↩️':'🗑️',hid?'Wieder einblenden':'Ausblenden',hid?'für alle wieder sichtbar':'aus der Nutzung nehmen (wiederherstellbar)','showSheet(false);toggleStdHidden()',hid?'':'danger');
  if(s.__new){ S.akt('endgueltig','🗑️','Endgültig löschen','App-eigenen Standard samt Einträgen entfernen','showSheet(false);deleteNewStandard()','danger'); }
  h+=S.html();
  h+=`<button class="sheet-close" onclick="showSheet(false)">Schließen</button>`;
  $('sheet').innerHTML=h; showSheet(true);
}

/* ── Gegliedertes Menü für eine RUBRIK (Kopf bearbeiten) ── */
function openRubSheet(idx){ if(!ADMIN||!curStd) return; const r=curStd.rubriken[idx]; if(!r) return; const hid=rubHidden(r,idx); const isTpl=!!r.__tplid;
  let h=`<div class="sheet-grip"></div><div class="sheet-title">Rubrik bearbeiten${isTpl?' · Vorlage':(r.__nrid?' · eigene':'')}</div><div class="sheet-name">${esc(rubName(r,idx))}</div>`;
  h+=sChips(['🗂 diese Rubrik', '👥 alle Geräte']);
  const S = sheetBauer('rubrik');
  S.gruppe('inhalt','Inhalt','Name & Symbol');
  S.akt('umbenennen','✏️','Umbenennen','nur diese Rubrik in diesem Standard','showSheet(false);renameRubrik('+idx+')');
  S.akt('symbol','🔣','Symbol ändern','gilt für ALLE Rubriken dieses Namens','showSheet(false);editRubIconFor('+idx+')');
  S.gruppe('organisation','Organisation','Reihenfolge & Geltung');
  S.akt('hoch','⬆','Nach oben','Reihenfolge im Standard','showSheet(false);moveRubrik('+idx+',-1)');
  S.akt('runter','⬇','Nach unten','Reihenfolge im Standard','showSheet(false);moveRubrik('+idx+',1)');
  if(isTpl){ S.akt('geltung','🌐','Geltungsbereich','in welchen Standards die Rubrik erscheint','showSheet(false);openRubrikForm(\''+esc(r.__tplid)+'\')'); }
  S.gruppe('gefahr','Gefahrenzone','Häkchen & Ausblenden');
  S.akt('haken','♻️','Häkchen zurücksetzen','die Tages-Häkchen dieser Rubrik','showSheet(false);clearRubrikChecks('+idx+')');
  const echtWeg=(typeof ownHatStruktur==='function' && ownHatStruktur(curStd.id) && !r.__nrid && !r.__tplid);
  S.akt('ausblenden',hid?'↩️':'🗑️',
    hid?'Wieder einblenden':((r.__nrid||echtWeg)?'Endgültig löschen':'Ausblenden'),
    hid?'':((r.__nrid||echtWeg)?'Segment samt Einträgen entfernen':'aus der Anzeige nehmen (wiederherstellbar)'),
    'showSheet(false);toggleRubHidden('+idx+')', hid?'':'danger');
  h+=S.html();
  h+=`<button class="sheet-close" onclick="showSheet(false)">Schließen</button>`;
  $('sheet').innerHTML=h; showSheet(true);
}
/* Symbol (Emoji) genau DIESER Rubrik ändern (RUBICON ist nach Rubrik-Name
   indiziert – anders als editRubIcon, das den Verwaltungs-Index nutzt). */
function editRubIconFor(idx){ if(!ADMIN||!curStd) return; const r=curStd.rubriken[idx]; if(!r) return; const name=rubName(r,idx);
  const cur=RUBICON[name]||''; const v=prompt('Symbol (Emoji) für Rubriken namens „'+name+'":',cur); if(v==null) return;
  if(v.trim()==='') delete RUBICON[name]; else RUBICON[name]=v.trim(); saveRUBICON(); openStandard(curStd.id,true); toast('Symbol geändert'); }

/* Öffnet das Bearbeiten-Formular direkt für eine cid (vom ✎-Button und vom
   Schnellmenü genutzt – eine gemeinsame Stelle statt doppelter Logik). */
function editEntry(cid){ const e=findEntry(cid); if(!e) return;
  if(e._added){ const p=cid.split('|'); openEntryForm({kind:'editAdd',sid:p[0],ri:+p[1],aid:e._aid,back:()=>reRenderDetail()}); }
  else { openEntryForm({kind:'editBase',cid,back:()=>reRenderDetail()}); } }
function sheetEditDetails(){ const cid=sheetCid, e=sheetEntry; if(!e) return; showSheet(false); editEntry(cid); }
/* Erst merken, dann schließen: showSheet(false) räumt sheetCid/sheetEntry ab. */
function sheetBestellen(){ const e=sheetEntry, cid=sheetCid; if(!e) return;
  const nm=(typeof qeGet==='function'&&qeGet(e,cid,'name')!==undefined)?qeGet(e,cid,'name'):(e.anzeige_text||'');
  const mk=(typeof effMatKey==='function')?effMatKey(e,cid):e.material_key;
  showSheet(false);
  if(typeof bestAusMaterial==='function') bestAusMaterial(mk, nm); }

function sheetPflegeWeg(){ const cid=sheetCid, e=sheetEntry; if(!e) return; showSheet(false);
  if(typeof pflegeAbZeile==='function') pflegeAbZeile(cid,e); }
function sheetDeleteAdded(){ const cid=sheetCid, e=sheetEntry; if(!e||!e._added) return; if(!confirm('Diesen eigenen Eintrag endgültig löschen? Das kann nicht rückgängig gemacht werden.')) return;
  const p=cid.split('|'); deleteAddEntry(p[0],+p[1],e._aid); showSheet(false); toast('Gelöscht'); reRenderDetail(); }
/* Übernimmt den aktuellen Eintrag (mit effektiven Werten) in den Katalog. */
function sheetAddToCatalog(){ const cid=sheetCid, e=sheetEntry; if(!e) return; const f=entryToForm(e,cid);
  if(!f.name||!f.name.trim()){ toast('Kein Name vorhanden',true); return; }
  const dup=CATALOG.items.some(it=>(it.name||'').trim().toLowerCase()===f.name.trim().toLowerCase()&&(it.nat||'material')===(f.nat||'material'));
  if(dup){ showSheet(false); toast('Schon im Katalog',true); return; }
  CATALOG.items=upsertCatalogItem(CATALOG.items,makeCatalogItem(Object.assign({},f,{id:newAid()}))); saveCatalog(); showSheet(false); toast('In Katalog aufgenommen'); }
function sheetGo(state){ if(state==='cat') renderSheetCat(); else if(state==='uk') renderSheetUk(); else if(state==='color') renderSheetColor(); else if(state==='zusatz') renderSheetZusatz(); else if(state==='bilder') renderSheetBilder(); else if(state==='stil') renderSheetStil(); else if(state==='bereich') renderSheetBereich(); else if(state==='alt') renderSheetAlternative(); }

/* ── Verschieben (Souveränität): Eintrag in andere Rubrik/anderen Standard ──
   Eigene Einträge (additions/NEW) werden ECHT umgehängt; Basis-Einträge aus
   der Quelldatei können nicht wandern → Kopie als eigener Eintrag am Ziel +
   Original ausblenden (beides rücknehmbar: Ausgeblendete Einträge/Journal). */
function renderSheetMove(sid){ const e=sheetEntry; if(!e) return;
  let h=`<div class="sheet-grip"></div><div class="sheet-title">📦 Verschieben — ${sid?'Rubrik wählen':'Standard wählen'}</div><div class="sheet-pick">`;
  if(!sid){
    DB.standards.forEach(s=>{ if(stdHidden(s)) return;
      h+=`<button class="sheet-pick-btn" data-sid="${esc(s.id)}" onclick="renderSheetMove(this.dataset.sid)">${esc(stdTitel(s))} <span class="ps-sub">· ${esc(stdGruppe(s))}</span></button>`; });
  } else {
    const s=DB.standards.find(x=>x.id===sid);
    (s?s.rubriken:[]).forEach((r,ri)=>{
      const cnt=(r.sub_bereiche||[]).reduce((n,sb)=>n+((sb.eintraege||[]).filter(x=>x.natur!=='ueberschrift').length),0);
      h+=`<button class="sheet-pick-btn" data-sid="${esc(sid)}" data-ri="${ri}" onclick="moveEntryTo(this.dataset.sid,+this.dataset.ri)">${esc(r.name)} <span class="ps-sub">· ${cnt} Einträge</span></button>`; });
  }
  h+=`</div><button class="sheet-close" onclick="${sid?'renderSheetMove()':'renderSheetMain()'}">Zurück</button>`;
  $('sheet').innerHTML=h; }

/* Die frühere Verknüpfungs-Oberfläche (renderSheetLink & Zubehör) ist
   entfernt. Sie war die letzte Stelle, an der die Naht des Datenmodells in
   der Bedienung stand — „Produkt wählen", „Verknüpfung lösen", eine eigene
   Suchliste — und seit „🧬 Material öffnen" führte kein Weg mehr dorthin.
   Toter Code, der aussieht, als sei er in Benutzung, ist eine Falle für den
   nächsten, der ihn liest. Das Lösen einer Zuordnung bleibt möglich:
   Verwaltung → 🧬 Materialzusammenführung, Zuordnung auf „—" setzen. */

/* Öffnet aus dem Standard heraus den EINEN zentralen Material-Editor
   (materialhub.js) für dieses Vorkommen — legt bei Bedarf den Stammsatz an. */
function matManage(){ const e=sheetEntry; if(!e||!e.material_key){ showSheet(false); return; } const mk=e.material_key; showSheet(false); if(typeof openMaterial==='function') openMaterial(mk); }
function moveEntryTo(targetSid,targetRi){ const e=sheetEntry, cid=sheetCid; if(!e||!cid) return;
  const tgt=DB.standards.find(s=>s.id===targetSid); if(!tgt||!tgt.rubriken[targetRi]){ toast('Ziel nicht gefunden',true); return; }
  if(cid.indexOf('new|')===0){
    const n=NEW.find(x=>('new|'+x.id)===cid);
    if(n){ n.std=targetSid; n.rub=String(rubIdxKey(tgt.rubriken[targetRi],targetRi)); saveNEW(); }
  } else if(e._added&&e._aid){
    const p=cid.split('|'); const oldKey=p[0]+'|'+p[1];
    const arr=ADDITIONS.entries[oldKey]||[]; const i=arr.findIndex(x=>x._aid===e._aid);
    if(i>=0){ const obj=arr.splice(i,1)[0]; if(!arr.length) delete ADDITIONS.entries[oldKey];
      const nk=targetSid+'|'+targetRi; (ADDITIONS.entries[nk]=ADDITIONS.entries[nk]||[]).push(obj); saveAdditions(); }
  } else {
    /* Basis-Eintrag: Kopie mit den EFFEKTIVEN Werten (inkl. deiner Regeln) */
    const name=(qeGet(e,cid,'name')!==undefined?qeGet(e,cid,'name'):e.anzeige_text)||'';
    const clone=makeAddEntry({ aid:newAid(), name,
      menge:(qeGet(e,cid,'mengeVal')!==undefined?qeGet(e,cid,'mengeVal'):e.menge)||'',
      nat:effNatur(e,cid), uk:canonUk(e,cid)||'',
      spez:(function(){const s=qeGet(e,cid,'spez'); if(s!==undefined) return s||''; return (Array.isArray(e.spezifikation)?e.spezifikation.join(' | '):e.spezifikation)||'';})(),
      color:(qeGet(e,cid,'color')||''), why:e.why||'', synonyms:e.synonyms||[] });
    clone.groessen=((qeGet(e,cid,'groessen')!==undefined?qeGet(e,cid,'groessen'):e.groessen)||[]).slice();
    const nk=targetSid+'|'+targetRi; (ADDITIONS.entries[nk]=ADDITIONS.entries[nk]||[]).push(clone); saveAdditions();
    if(e.material_key&&typeof addRule==='function') addRule({art:'material',key:e.material_key},{art:'stelle',wert:cid},'hidden',true);
    else { (QE.cid[cid]=QE.cid[cid]||{}).hidden=true; saveQE(); }
  }
  rebuildDB(); buildMaterialIndex(); computeUkList(); showSheet(false);
  toast('Verschoben nach „'+stdTitel(tgt)+' → '+tgt.rubriken[targetRi].name+'" — rücknehmbar'); reRenderDetail(); }

/* ── Eigene Felder (Souveränität): beliebige Zusatz-Infos am Eintrag ──
   Gespeichert als Regel-Eigenschaft 'zusatz' (Liste {n,w}) → volle
   Reichweiten-Wahl, Journal, „Warum so?" und Geräte-Sync inklusive. */
function renderSheetZusatz(){ const e=sheetEntry, cid=sheetCid; if(!e) return;
  const cur=(qeGet(e,cid,'zusatz')||[]);
  let h=`<div class="sheet-grip"></div><div class="sheet-title">＋ Eigene Felder</div>
    <p class="why-help">Eigene Zusatz-Infos (z. B. „Schrank: B3" oder „nur bei ICD"), die als Badge am Eintrag erscheinen. Du wählst gleich, wo sie gelten.</p>`;
  cur.forEach((f,i)=>{ h+=`<div class="why-row"><span class="why-src">${esc(f.n)}</span><span class="why-val">${esc(f.w||'')}</span><button class="why-undo" data-i="${i}" onclick="sheetZusatzDel(+this.dataset.i)">✕</button></div>`; });
  h+=`<input type="text" id="zfName" class="txtinp" style="width:100%;margin-top:10px" placeholder="Feldname, z. B. Schrank">
    <input type="text" id="zfWert" class="txtinp" style="width:100%;margin-top:8px" placeholder="Wert, z. B. B3 (optional)">
    <div class="sheet-pick" style="margin-top:12px"><button class="sheet-pick-btn" onclick="sheetZusatzAdd()">＋ Feld hinzufügen</button></div>
    <button class="sheet-close" onclick="renderSheetMain()">Zurück</button>`;
  $('sheet').innerHTML=h; const inp=$('zfName'); if(inp) setTimeout(()=>inp.focus(),50); }
function sheetZusatzAdd(){ const n=($('zfName')&&$('zfName').value||'').trim(); const w=($('zfWert')&&$('zfWert').value||'').trim();
  if(!n) return; const arr=(qeGet(sheetEntry,sheetCid,'zusatz')||[]).slice(); arr.push({n,w});
  sheetPending={kind:'zusatz',value:arr}; askScope(); }
function sheetZusatzDel(i){ const arr=(qeGet(sheetEntry,sheetCid,'zusatz')||[]).slice(); arr.splice(i,1);
  sheetPending={kind:'zusatz',value:arr}; askScope(); }
function renderSheetCat(){ let h=`<div class="sheet-grip"></div><div class="sheet-title">Kategorie wählen</div><div class="sheet-pick">`;
  natList().forEach(n=>{ h+=`<button class="sheet-pick-btn" onclick="sheetSetNatur('${esc(n.key)}')"><span style="width:14px;height:14px;border-radius:4px;background:${n.color};display:inline-block"></span>${esc(n.label)}</button>`; });
  h+=`<button class="sheet-pick-btn" onclick="sheetNewNatur()">＋ Neue Kategorie…</button></div><button class="sheet-close" onclick="renderSheetMain()">Zurück</button>`;
  $('sheet').innerHTML=h; }
function sheetSetNatur(key){ sheetPending={kind:'natur',value:key}; askScope(); }
/* Eingabe-Sheet statt prompt() — gleicher Grund wie sheetNewUk (M1). */
function sheetNewNatur(){
  const h=`<div class="sheet-grip"></div><div class="sheet-title">Neue Kategorie</div>
    <input type="text" id="skNewNat" class="txtinp" style="width:100%" placeholder="Name, z. B. Verbrauchsmaterial">
    <div class="sheet-pick" style="margin-top:12px"><button class="sheet-pick-btn" onclick="sheetNewNaturSave()">Anlegen</button></div>
    <button class="sheet-close" onclick="renderSheetMain()">Abbrechen</button>`;
  $('sheet').innerHTML=h;
  const inp=$('skNewNat'); if(inp){ setTimeout(()=>inp.focus(),50); inp.onkeydown=(ev)=>{ if(ev.key==='Enter'){ ev.preventDefault(); sheetNewNaturSave(); } }; }
}
function sheetNewNaturSave(){ const inp=$('skNewNat'); const label=(inp&&inp.value||'').trim(); if(!label) return;
  const key=natSlug(label); const color=UK_PALETTE[NATCFG.order.length%UK_PALETTE.length];
  NATCFG.items[key]={key,label,color,icon:'🏷️',builtin:false,beschaffbar:false}; NATCFG.order.push(key); saveNatCfg(); applyNatConfig();
  sheetPending={kind:'natur',value:key}; askScope(); }
function renderSheetUk(){ computeUkList(); let h=`<div class="sheet-grip"></div><div class="sheet-title">Unterkategorie wählen</div><div class="sheet-pick">`;
  /* Per INDEX in UK_LIST (−1 = ohne): UK-Namen sind Freitext und gehören
     nicht in onclick-String-Literale (esc() escaped kein Apostroph). */
  h+=`<button class="sheet-pick-btn" onclick="sheetSetUk(-1)">— ohne —</button>`;
  UK_LIST.forEach((u,i)=>{ h+=`<button class="sheet-pick-btn" onclick="sheetSetUk(${i})">${ukIconOf(u)} ${esc(u)}</button>`; });
  h+=`<button class="sheet-pick-btn" onclick="sheetNewUk()">＋ Neue Unterkategorie…</button></div><button class="sheet-close" onclick="renderSheetMain()">Zurück</button>`;
  $('sheet').innerHTML=h; }
function sheetSetUk(i){ const val=(i<0)?'':(UK_LIST[i]!=null?UK_LIST[i]:''); sheetPending={kind:'uk',value:val}; askScope(); }
/* Eingabe-Sheet statt prompt(): in installierten PWA-Fenstern (manifest
   display:"standalone") liefert window.prompt() auf manchen Android-Chrome-
   Versionen KEINEN Dialog, sondern sofort null — „Neue Unterkategorie"
   schlug dadurch lautlos fehl. Eigenes Eingabefeld statt nativem Dialog (M1). */
function sheetNewUk(){
  const h=`<div class="sheet-grip"></div><div class="sheet-title">Neue Unterkategorie</div>
    <input type="text" id="skNewUk" class="txtinp" style="width:100%" placeholder="Name, z. B. Katheter">
    <div class="sheet-pick" style="margin-top:12px"><button class="sheet-pick-btn" onclick="sheetNewUkSave()">Anlegen</button></div>
    <button class="sheet-close" onclick="renderSheetUk()">Abbrechen</button>`;
  $('sheet').innerHTML=h;
  const inp=$('skNewUk'); if(inp){ setTimeout(()=>inp.focus(),50); inp.onkeydown=(ev)=>{ if(ev.key==='Enter'){ ev.preventDefault(); sheetNewUkSave(); } }; }
}
function sheetNewUkSave(){ const inp=$('skNewUk'); const nm=(inp&&inp.value||'').trim(); if(!nm) return; sheetPending={kind:'uk',value:nm}; askScope(); }
function renderSheetColor(){ let h=`<div class="sheet-grip"></div><div class="sheet-title">Farbe wählen</div><div class="sheet-colorrow">`;
  UK_PALETTE.forEach(c=>{ h+=`<span class="sheet-sw" style="background:${c}" onclick="sheetSetColor('${c}')"></span>`; });
  h+=`<input type="color" class="sheet-colorinp" value="#e8b34a" onchange="sheetSetColor(this.value)"></div>`;
  h+=`<button class="sheet-pick-btn" onclick="sheetSetColor(null)">Farbe entfernen</button><button class="sheet-close" onclick="renderSheetMain()">Zurück</button>`;
  $('sheet').innerHTML=h; }
function sheetSetColor(val){ sheetPending={kind:'color',value:val}; askScope(); }
function sheetRename(){ const e=sheetEntry,cid=sheetCid; const dn=qeGet(e,cid,'name'); const cur=(dn!==undefined?dn:e.anzeige_text); const nn=prompt('Neuer Anzeigename:',cur); if(nn==null||!nn.trim()) return; sheetPending={kind:'name',value:nn.trim()}; askScope(); }
function sheetToggle(prop){ const e=sheetEntry,cid=sheetCid;
  /* mengeHi hat einen automatischen Grundzustand (≠1x); der Umschalter muss
     IMMER den gerade angezeigten (effektiven) Zustand umkehren — sonst
     bleibt „Zahl normal anzeigen" bei automatisch hervorgehobenen Einträgen
     wirkungslos (M10, Übersteuerung). */
  const cur=(prop==='mengeHi')?mengeHiEff(e,cid,(qeGet(e,cid,'mengeVal')!==undefined?qeGet(e,cid,'mengeVal'):e.menge)):qeGet(e,cid,prop)===true;
  sheetPending={kind:prop,value:!cur}; askScope(); }
/* Reichweiten-Wahl (Verwaltungspolitik-Kaskade): vier ehrliche Stufen mit
   TREFFERVORSCHAU direkt an jeder Option — Sammel-Änderung ist kein eigenes
   Werkzeug, sondern zwei weitere Knöpfe im vertrauten Dialog. */
function askScope(){ const e=sheetEntry, cid=sheetCid; if(!e.material_key){ applyPending('cid'); return; }
  /* Die Stufen kommen aus der gemeinsamen Treppe (features/reichweite.js) —
     dieselbe Liste wie im Bearbeiten-Formular, inklusive der Merkmals-
     Reichweiten („alle mit sedierungspflichtig"). */
  const stufen=(typeof rwStufen==='function')?rwStufen(cid,e.material_key):[];
  let h=`<div class="sheet-grip"></div><div class="sheet-title">Wo soll es gelten?</div>`;
  h+=`<div class="sheet-chips"><span class="schip">👥 gilt auf allen Geräten</span></div><div class="sheet-pick">`;
  stufen.forEach(x=>{ h+=`<button class="sheet-pick-btn" data-s="${esc(x.key)}" onclick="applyPending(this.dataset.s)">${x.ico} ${esc(x.lang||x.wort)} <span class="ps-sub">· ${esc(x.langSub||x.sub||'')}</span></button>`; });
  h+=`</div><button class="sheet-close" onclick="renderSheetMain()">Abbrechen</button>`;
  $('sheet').innerHTML=h; }
/* Weite Reichweiten werden bestätigt — als KARTE, nicht als natives Fenster:
   confirm() erscheint in installierten PWAs auf mehreren Android-Chrome-
   Versionen gar nicht, und die Sammel-Änderung fiele lautlos aus (Grundsatz ⑧). */
function askScopeBestaetigen(scope){
  const e=sheetEntry, cid=sheetCid; const s=(typeof rwStufe==='function')?rwStufe(cid,e.material_key,scope):null;
  if(!s){ applyPending(scope); return; }
  const n=s.hits?s.hits.vorkommen:0, m=s.hits?s.hits.standards.length:0;
  let h=`<div class="sheet-grip"></div><div class="sheet-title">Sammel-Änderung bestätigen</div>`;
  h+=`<p class="why-help">Die Änderung wirkt auf <b>${s.ico} ${esc(s.wort)}</b> — das sind <b>${n} Vorkommen</b> in ${m} Standard${m===1?'':'s'}. Rückgängig jederzeit unter 🧾 Regeln &amp; Journal.</p>`;
  h+=`<div class="p-actions" style="padding:6px 4px">
    <button class="btn btn-sec" onclick="askScope()">Zurück</button>
    <button class="btn btn-pri" data-s="${esc(scope)}" onclick="applyPending(this.dataset.s,true)">Ja, anwenden</button></div>`;
  $('sheet').innerHTML=h; }
/* EIN Schreibweg (Verwaltungspolitik Stufe 2/3): jede Reichweite eines
   MATERIAL-Eintrags wird zur Regel im Journal (📍 Stelle · 📄 Standard ·
   🗂 Gruppe · 🌐 alle) — rückverfolgbar, rücknehmbar, im Inspektor sichtbar.
   Der abgelöste Alt-Wert wird migriert (clearLegacyAt). Weite Reichweiten
   (Gruppe/alle) werden mit Trefferzahl bestätigt (Governance-Treppe).
   Einträge OHNE material_key haben kein Regel-Ziel → Alt-Pfad („nur hier"). */
function applyPending(scope,bestaetigt){ const e=sheetEntry,cid=sheetCid,p=sheetPending; if(!e||!p){ showSheet(false); return; }
  const mk=e.material_key;
  if(mk){
    const stufe=(typeof rwStufe==='function')?rwStufe(cid,mk,scope):null;
    const wo=stufe?stufe.wo:{art:'stelle',wert:cid};
    if(stufe && stufe.weit && !bestaetigt){ askScopeBestaetigen(scope); return; }
    addRule({art:'material',key:mk}, wo, p.kind, p.value);
    if(wo.art==='stelle') clearLegacyAt(e,cid,'stelle',p.kind);
    else if(wo.art==='alle') clearLegacyAt(e,cid,'alle',p.kind);
    buildMaterialIndex(); if(p.kind==='uk') computeUkList();
    sheetPending=null; showSheet(false);
    toast((scope==='cid')?'Übernommen':'Sammel-Änderung übernommen — rücknehmbar unter 🧾 Regeln & Journal'); reRenderDetail(); return;
  }
  /* Kein material_key → Alt-Pfad (nur „hier" möglich) */
  if(p.kind==='natur'){ overrides[cid]=p.value; saveJSON('hkl_overrides',overrides); buildMaterialIndex(); }
  else if(p.kind==='uk'){ reassign[cid]=(p.value===''?null:p.value); saveJSON('hkl_reassign',reassign); computeUkList(); }
  else { qeSet('cid',e,cid,p.kind,p.value); if(p.kind==='name'||p.kind==='color'||p.kind==='hidden'){ buildMaterialIndex(); } }
  sheetPending=null; showSheet(false); toast('Übernommen'); reRenderDetail(); }
function sheetEditMenge(){ const e=sheetEntry,cid=sheetCid; const mv=qeGet(e,cid,'mengeVal'); const cur=(mv!==undefined?mv:e.menge)||''; const nn=prompt('Neue Menge (z. B. 2x — leer lassen = keine Menge):',cur); if(nn==null) return; const val=nn.trim()===''?null:nn.trim(); sheetPending={kind:'mengeVal',value:val}; askScope(); }
function guessSizeTyp(t){ const s=t.toLowerCase(); if(/f(r|rench)?$/.test(s)&&/\d/.test(s)) return 'french'; if(/cm$/.test(s)) return 'laenge'; if(/mm$/.test(s)) return 'durchmesser'; if(/(ml|l)$/.test(s)&&/\d/.test(s)) return 'volumen'; if(/\dx\d/.test(s)) return 'dimension'; if(/er$/.test(s)) return 'naht'; return 'typcode'; }
function parseSizesInput(text){ return (text||'').split(/[,;]+/).map(t=>t.trim()).filter(Boolean).map(t=>({typ:guessSizeTyp(t),wert:t,roh:t})); }
function sheetEditSizes(){ const e=sheetEntry,cid=sheetCid; const gv=qeGet(e,cid,'groessen'); const cur=((gv!==undefined?gv:e.groessen)||[]).map(g=>g.wert).join(', ');
  const nn=prompt('Größen, durch Komma getrennt (z. B. 6F, 260cm — leer = keine):',cur); if(nn==null) return;
  sheetPending={kind:'groessen',value:parseSizesInput(nn)}; askScope(); }
function sheetEditSpez(){ const e=sheetEntry,cid=sheetCid; const sv=qeGet(e,cid,'spez');
  const cur=(sv!==undefined)?(sv||''):((Array.isArray(e.spezifikation)?e.spezifikation.join(' | '):e.spezifikation)||'');
  const nn=prompt('Spezifikation (Klammerzusatz/Standort — leer = keine):',cur); if(nn==null) return;
  sheetPending={kind:'spez',value:(nn.trim()===''?null:nn.trim())}; askScope(); }
function sheetDelete(){
  if(sheetCid&&sheetCid.indexOf('new|')===0){ if(!confirm('Diesen selbst angelegten Eintrag endgültig löschen?')) return;
    const id=sheetCid.slice(4); const i=NEW.findIndex(x=>x.id===id); if(i>=0){ NEW.splice(i,1); saveNEW(); }
    if(QE.cid[sheetCid]) delete QE.cid[sheetCid]; if(overrides[sheetCid]){ delete overrides[sheetCid]; saveJSON('hkl_overrides',overrides); }
    saveQE(); showSheet(false); toast('Gelöscht'); reRenderDetail(); return; }
  /* In einem EIGENEN Standard (Kopie/Neuanlage mit eigener Struktur) gibt es
     keine Quelldatei, die man schonen müsste — dort ist Löschen echtes
     Löschen. Genau das braucht man beim Aufbau eines neuen Standards. */
  if(typeof ownHatStruktur==='function' && sheetCid && ownHatStruktur(sheetCid.split('|')[0])){
    if(!confirm('Diesen Eintrag endgültig löschen? In einem eigenen Standard ist das nicht wiederherstellbar.')) return;
    if(ownDeleteEntry(sheetCid)){ showSheet(false); toast('Eintrag gelöscht'); reRenderDetail(); }
    return; }
  if(!confirm('Diesen Eintrag ausblenden? Er verschwindet aus der Anzeige und der Materialpflege, bleibt aber über „Verwaltung → Ausgeblendete Einträge" wiederherstellbar. Die Quelldatei wird nicht verändert.')) return; sheetPending={kind:'hidden',value:true}; askScope(); }
/* Setzt NUR die Änderungen an dieser Stelle zurück: 📍-Regeln (revoke) + die
   Alt-Speicher an diesem cid. Standard-/Gruppen-/Überall-Regeln bleiben — die
   sind bewusste Sammel-Entscheidungen und werden im 🧾 Journal zurückgenommen. */
function sheetResetEntry(){ const cid=sheetCid, e=sheetEntry;
  if(QE.cid[cid]) delete QE.cid[cid]; if(overrides[cid]!==undefined){ delete overrides[cid]; saveJSON('hkl_overrides',overrides); } if(cid in reassign){ delete reassign[cid]; saveJSON('hkl_reassign',reassign); }
  if(e&&e.material_key&&typeof rulesActive==='function'){ rulesActive(RULES).forEach(r=>{ if(r.ziel&&r.ziel.key===e.material_key&&r.wo&&r.wo.art==='stelle'&&r.wo.wert===cid) revokeRule(r.id); }); }
  saveQE(); buildMaterialIndex(); computeUkList(); showSheet(false); toast('Zurückgesetzt'); reRenderDetail(); }
/* Nach einer Änderung genau den Bildschirm auffrischen, auf dem man steht.
   Das Bearbeiten-Menü ist EIN Menü in zwei Kontexten (Grundsatz ⑥) — es wird
   aus der Rubrikansicht UND aus der Verwaltung geöffnet. Früher zeichnete es
   nur die Rubrikansicht neu; in der Verwaltung blieb der alte Stand stehen und
   sah aus, als sei nichts passiert. */
function reRenderDetail(){
  try{
    if($('scr-admin') && $('scr-admin').classList.contains('active') && typeof renderAdmin==='function'){ renderAdmin(); return; }
    if($('scr-care') && $('scr-care').classList.contains('active') && typeof renderMatCenter==='function'){ renderMatCenter(); return; }
    /* Dritter Kontext: der Pflege-Weg. Das Bereich-Menü wird von dort aus
       geöffnet — ohne diesen Zweig spränge die Ansicht danach in die Rubrik
       und der Weg wäre abgerissen. */
    if($('scr-pflege') && $('scr-pflege').classList.contains('active') && typeof renderPflege==='function'){
      if(typeof pfCacheLeeren==='function') pfCacheLeeren();
      renderPflege(); return; }
  }catch(e){}
  const top=nav[nav.length-1]; if(top&&top.lvl==='rub'){ openRubrik(top.idx,true); } }
$('sheetOv').addEventListener('click',()=>showSheet(false));

/* ── Geister-Klick-Schutz (Ursache der Bugs „springt beim Standard-Wählen
   direkt in eine Rubrik" und „Häkchen erscheinen von selbst"): Android feuert
   nach jedem Finger-Tipp zusätzlich Kompatibilitäts-MAUS-Ereignisse an
   derselben Bildschirmposition. Rendert der Tap eine neue Ansicht, treffen
   diese Maus-Ereignisse die NEUE Liste (Standard→Rubrik→Eintrag) und lösten
   dort ein zweites Tippen aus. Der frühere Schutz (lastTouch) war pro
   Container privat und griff deshalb container-übergreifend nicht.
   Zwei Schichten: (1) EIN geteilter Zeitstempel für ALLE Halte-Detektoren —
   nach jedem Touch werden Maus-Ereignisse überall 700 ms ignoriert;
   (2) preventDefault auf dem konsumierten touchend unterdrückt die
   Kompatibilitäts-Ereignisse (inkl. click auf onclick-Elemente) an der
   Quelle. Nicht konsumierte Touches (Scroll, Buttons via ignoreSel) bleiben
   unangetastet, deren native Klicks funktionieren weiter. */
let touchGuardTs=0;
function ghostMouse(){ return Date.now()-touchGuardTs<700; }

/* Die eigenen Schalter INNERHALB einer Eintragszeile. Sie müssen vom
   Halte-Detektor ausgenommen werden — sonst beansprucht er den Tipp auf der
   ganzen Zeile, hakt ab und unterdrückt den nativen Klick, sodass der
   Schalter selbst nie zum Zug kommt. An EINER Stelle gepflegt, damit ein
   neuer Schalter nicht wieder vergessen wird. */
const ENTRY_BTNS='.entry-edit-btn,.entry-why-btn,.entry-menu-btn,.entry-canon-btn';

/* Die sichtbaren Schalter einer Eintragszeile (Delegation am Bildschirm).
   Das Tippen/Halten der ZEILE selbst behandelt der gemeinsame Halte-Detektor
   weiter unten — früher lag hier eine zweite, fast identische Kopie davon. */
(function attachEntryButtons(){ const el=$('scr-detail');
  /* Sichtbarer ✎-Button: öffnet direkt das Bearbeiten-Formular (kein Abhaken). */
  el.addEventListener('click',e=>{ const b=(e.target&&e.target.closest)?e.target.closest('.entry-edit-btn'):null; if(!b) return; e.preventDefault(); e.stopPropagation(); const entry=b.closest('.entry'); if(!entry||!entry.id) return; const cid=entry.id.replace(/^e-/,''); if(ADMIN){ refreshAuth(); editEntry(cid); } else { promptLoginThen(()=>editEntry(cid)); } });
  /* ⋯-Button (für alle sichtbar): Admin → Schnellmenü, sonst → Vorschlag.
     Ersetzt die Unsichtbarkeit des Long-Press als einzigem Einstieg (UX K1). */
  el.addEventListener('click',e=>{ const b=(e.target&&e.target.closest)?e.target.closest('.entry-menu-btn'):null; if(!b) return; e.preventDefault(); e.stopPropagation(); const entry=b.closest('.entry'); if(!entry||!entry.id) return; const cid=entry.id.replace(/^e-/,''); if(ADMIN){ refreshAuth(); openSheet(cid); } else { openProposeForm(cid); } });
  /* 💡-Button: klappt das „Warum"-Detail auf/zu (für alle, kein Abhaken). */
  el.addEventListener('click',e=>{ const b=(e.target&&e.target.closest)?e.target.closest('.entry-why-btn'):null; if(!b) return; e.preventDefault(); e.stopPropagation(); const entry=b.closest('.entry'); if(!entry) return; const open=entry.classList.toggle('show-why'); b.setAttribute('aria-expanded',open?'true':'false'); });
  /* Material-Badge: öffnet das Material (kein Abhaken). */
  el.addEventListener('click',e=>{ const b=(e.target&&e.target.closest)?e.target.closest('.entry-canon-btn'):null; if(!b) return; e.preventDefault(); e.stopPropagation(); const g=b.dataset.g; if(g&&typeof openScanItem==='function') openScanItem(g,false); });
})();

/* Generischer Halte-Detektor für Listen mit eigener Navigation: kurzes Tippen
   = öffnen, langes Halten (≈500 ms) = Bearbeiten-Menü. Damit ist das gegliederte
   Menü auf JEDER Ebene per Long-Press erreichbar — Standard-Übersicht, Rubriken-
   Liste und (separat) Einträge. Delegation am persistenten Container. */
/* Register der aktiven Halte-Detektoren. Der Selbsttest (features/diag.js)
   liest daraus, WELCHE Daten-Attribute eine Zeile tragen muss, damit sie sich
   überhaupt öffnen lässt — so fällt „Zeile ohne Weg hinein" künftig auf,
   statt still zu scheitern. */
const HOLDNAV = [];
function attachHoldNav(el, opts){ if(!el) return; let timer=null,sx=0,sy=0,fired=false,cur=null,active=false;
  HOLDNAV.push({ el, rowSel:opts.rowSel, keys:(opts.keys||[]), ignoreSel:(opts.ignoreSel||'') });
  function row(t){ if(!t||!t.closest) return null; if(opts.ignoreSel && t.closest(opts.ignoreSel)) return null; return t.closest(opts.rowSel); }
  function down(x,y,t){ const rw=row(t); if(!rw) return; cur=rw; sx=x; sy=y; fired=false; active=true; clearTimeout(timer);
    timer=setTimeout(()=>{ fired=true; try{ if(navigator.vibrate) navigator.vibrate(15); }catch(e){} if(opts.onHold) opts.onHold(cur); },500); }
  function move(x,y){ if(!active) return; if(Math.abs(x-sx)>10||Math.abs(y-sy)>10){ clearTimeout(timer); active=false; } }
  /* Liefert TRUE, wenn der Tipp tatsächlich behandelt wurde. Wichtig für den
     Touch-Pfad unten: nur ein WIRKLICH behandelter Tipp darf den nativen Klick
     unterdrücken. */
  function up(){ if(!active) return false; clearTimeout(timer); active=false;
    if(fired){ fired=false; return true; }
    return !!(cur && opts.onTap && opts.onTap(cur)); }
  el.addEventListener('touchstart',e=>{ touchGuardTs=Date.now(); const t=e.touches[0]; down(t.clientX,t.clientY,e.target); },{passive:true});
  el.addEventListener('touchmove',e=>{ const t=e.touches[0]; move(t.clientX,t.clientY); },{passive:true});
  /* FEHLER, den das gekostet hat (Anleitungen ließen sich auf dem Handy nicht
     öffnen): Früher wurde JEDER Tipp auf eine passende Zeile unterdrückt —
     auch wenn onTap gar nichts tun konnte. Der Browser feuerte dann kein
     `click`, und ein Inline-`onclick=` auf der Zeile kam nie zum Zug. Am
     Schreibtisch (Maus) fiel das nicht auf, weil mouseup nichts unterdrückt.
     Jetzt wird nur unterdrückt, was auch behandelt wurde. */
  el.addEventListener('touchend',e=>{ touchGuardTs=Date.now(); const behandelt=up(); if(behandelt&&e.cancelable){ try{ e.preventDefault(); }catch(_){} } });
  el.addEventListener('touchcancel',()=>{ clearTimeout(timer); active=false; });
  el.addEventListener('mousedown',e=>{ if(ghostMouse()) return; down(e.clientX,e.clientY,e.target); });
  el.addEventListener('mousemove',e=>{ if(ghostMouse()) return; move(e.clientX,e.clientY); });
  el.addEventListener('mouseup',()=>{ if(ghostMouse()) return; up(); });
  el.addEventListener('mouseleave',()=>{ clearTimeout(timer); active=false; });
}
(function attachListHolds(){
  /* Die Übersicht trägt ZWEI Zeilenarten mit derselben Klasse `.std`:
     Standards (data-sid) und Anleitungen (data-gid). Der Halte-Detektor muss
     beide kennen — sonst verschluckt er den Tipp auf Anleitungen. */
  /* ignoreSel ist PFLICHT, sobald in einer Zeile eigene Schalter sitzen: Der
     Detektor beansprucht den Tipp auf der ganzen Zeile und unterdrückt danach
     den nativen Klick — ein `event.stopPropagation()` im Inline-onclick des
     Schalters kommt gar nicht erst zum Zug, weil der Detektor am CONTAINER
     lauscht (Delegation), nicht an der Zeile. Ohne diese Ausnahme öffnete ein
     Tipp auf ⭐ am Handy den Standard, statt den Favoriten zu setzen. */
  /* Die Reiter oben: kurz tippen wechselt, lang halten BEARBEITET. Damit ist
     die letzte Fläche der App direkt änderbar — kein Weg über die Verwaltung
     (features/seiten.js). Ein eigener Detektor, weil die Reiter im selben
     Bildschirm stecken wie die Standardliste, aber anders reagieren. */
  attachHoldNav($('scr-standards'), { rowSel:'.seg-btn[data-seite]', keys:['seite'],
    onTap:rw=>{ const id=rw.dataset.seite; if(!id) return false;
      if(typeof setSeg==='function') setSeg(id); return true; },
    onHold:rw=>{ const id=rw.dataset.seite;
      if(id && ADMIN && typeof seiteSheet==='function'){ refreshAuth(); seiteSheet(id); } } });
  attachHoldNav($('scr-standards'), { rowSel:'.std', keys:['sid','gid'], ignoreSel:'.fav-btn',
    onTap:rw=>{
      const sid=rw.dataset.sid; if(sid){ openStandard(sid); return true; }
      const gid=rw.dataset.gid; if(gid&&typeof openGuide==='function'){ openGuide(gid); return true; }
      return false;
    },
    onHold:rw=>{
      const sid=rw.dataset.sid; if(sid&&ADMIN){ refreshAuth(); openStdSheet(sid); return; }
      const gid=rw.dataset.gid; if(gid&&ADMIN&&typeof openGuideEdit==='function'){ refreshAuth(); openGuideEdit(gid); }
    } });
  /* Die Karten der neuen Seiten: langes Halten bearbeitet — dieselbe Geste wie
     überall sonst („im Verwaltungsmodus tippe ich lange irgendwo drauf und
     kann bearbeiten, was ich will"). Kurz tippen tut hier NICHTS: Die Karten
     tragen ihre eigenen Schalter (Haken, „bestellt", „Beenden"), und ein
     zweites Verhalten auf derselben Fläche wäre ein Fehlgriff-Erzeuger.
     Deshalb liefert onTap `false` — der native Klick geht durch. */
  attachHoldNav($('scr-standards'), { rowSel:'.auf-karte,.akt-karte,.best-karte',
    ignoreSel:'button,input,textarea,select,label,a', keys:['i'],
    onTap:()=>false,
    onHold:rw=>{
      if(typeof ADMIN==='undefined' || !ADMIN) return;
      const id=rw.dataset.i; if(!id) return;
      refreshAuth();
      if(rw.classList.contains('auf-karte') && typeof aufUiBearbeiten==='function') aufUiBearbeiten(id);
      else if(rw.classList.contains('akt-karte') && typeof aktUiBearbeiten==='function') aktUiBearbeiten(id);
      else if(rw.classList.contains('best-karte') && typeof bestUiBearbeiten==='function') bestUiBearbeiten(id);
    } });
  attachHoldNav($('scr-rubriken'), { rowSel:'.rub', ignoreSel:'.rub-menu-btn', keys:['ri'],
    onTap:rw=>{ const i=rw.dataset.ri; if(i==null) return false; openRubrik(+i); return true; },
    onHold:rw=>{ const i=rw.dataset.ri; if(i!=null&&ADMIN){ refreshAuth(); openRubSheet(+i); } } });
  /* Einträge: kurz tippen = abhaken, halten = Bearbeiten-Menü (bzw. Vorschlag).
     Nutzt jetzt denselben Detektor wie die anderen Ebenen — vorher lag hier
     eine eigene, fast identische Umsetzung, in der die Rückmeldung „behandelt"
     und der Material-Schalter fehlten. Der Selektor `[data-cid]` grenzt bewusst auf
     ECHTE Eintragszeilen ein; reine Anzeige-Zeilen (Arzt-Varianten) tragen
     keine Kennung und sind damit ausdrücklich nicht bedienbar. */
  attachHoldNav($('scr-detail'), { rowSel:'.entry-row[data-cid]', ignoreSel:ENTRY_BTNS, keys:['cid'],
    onTap:rw=>{ const cid=rw.dataset.cid; if(!cid) return false; toggleCheck(cid); return true; },
    onHold:rw=>{ const cid=rw.dataset.cid; if(!cid) return;
      if(ADMIN){ refreshAuth(); openSheet(cid); } else { openProposeForm(cid); } } });
})();

/* Sammeln aus dem Schnellmenü heraus (features/bausteine.js). Das Menü bleibt
   offen und frischt nur den Zähler auf — man sammelt mehrere Zeilen
   hintereinander, und jedes Mal das Menü zu schließen wäre eine Zumutung. */
function bauUiSammelnZeile(){
  const cid = sheetCid; if(!cid || typeof bauSammeln!=='function') return;
  bauSammeln(cid);
  renderSheetMain();
  if(typeof toast==='function') toast(bauSammelt(cid) ? ('Gesammelt — '+bauSammelZahl()+' in der Mappe') : 'Aus der Mappe genommen');
}
