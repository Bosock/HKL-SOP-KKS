/* ─────────────────────────────────────────────────────────────
   NEUE APP — STAMMDATEN: Material · Geräte · Medikamente

   Ein Verzeichnis je Art, EINE Maske je Art. Stammdaten gelten überall: Wer
   hier etwas ändert, ändert es in jedem Standard, der den Eintrag verwendet —
   deshalb zeigt das Speichern vorher, wo es wirkt (Wirkungsvorschau).

   Material: erst die Kategorie (sie bestimmt die Felder), dann Etikett/GTIN/
   REF/Hersteller, dann die Merkmale. GTIN und REF werden nie geraten: Die
   GTIN muss ihre Prüfziffer bestehen, eine unsicher gelesene REF wird nur
   vorgeschlagen. Eine GTIN gibt es genau einmal.
   ───────────────────────────────────────────────────────────── */
/* ocr.js fragt nach diesen beiden, wenn vorhanden (Barcode im Etikettfoto). */
function parseScan(raw){ return naParseScan(raw); }
function gtinKey(g){ return naGtinKey(g); }

const NA_STAMM_FELDER = {
  material:   { liste:'#/material',   neu:'#/material/neu' },
  geraet:     { liste:'#/geraet',     neu:'#/geraet/neu' },
  medikament: { liste:'#/medikament', neu:'#/medikament/neu' },
};
function naStammSub(typ, o){
  const t = [];
  if(typ==='material'){ const k = naKat().klassen.find(x=>x.id===o.kategorie); if(k) t.push(k.label);
    if(o.hersteller) t.push(naListeName('hersteller', o.hersteller)); if(o.ref) t.push('REF '+o.ref); }
  if(typ==='geraet'){ if(o.kategorie) t.push(naListeName('geraetekategorien', o.kategorie)); if(o.hersteller) t.push(naListeName('hersteller', o.hersteller)); if(o.modell) t.push(o.modell); }
  if(typ==='medikament'){ if(o.wirkstoff) t.push(o.wirkstoff); if(o.konzentration) t.push(o.konzentration); if(o.darreichung) t.push(naListeName('darreichung', o.darreichung)); }
  if(o.lagerort) t.push('📍 '+o.lagerort);
  return t.filter(Boolean).join(' · ');
}
function naStammSuchtext(typ, o){ return naNorm([o.name, naStammSub(typ,o), o.gtin, o.ref, o.notiz, o.hinweis].concat(Object.keys(o.merkmale||{}).map(k=>o.merkmale[k])).join(' ')); }

/* ── Verzeichnis ── */
let NA_VZ_Q = { material:'', geraet:'', medikament:'' };
function naSichtVerzeichnis(typ){
  const T = NA_TYPEN[typ];
  return { titel:T.mehr, pfad: naAlle(typ).length+' Einträge', tab:typ, plus: naAdmin() ? { na:'geh', ziel:NA_STAMM_FELDER[typ].neu } : null,
    html: '<input class="na-suche" type="search" id="naVzQ" placeholder="'+esc(T.mehr)+' suchen (Name, REF, GTIN, Ort …)" value="'+esc(NA_VZ_Q[typ])+'" data-na-ein="vzSuche" data-typ="'+typ+'">'
      + '<div id="naVzListe">'+naVerzeichnisListe(typ)+'</div>' };
}
function naVerzeichnisListe(typ){
  const q = naNorm(NA_VZ_Q[typ]); const T = NA_TYPEN[typ];
  const alle = naAlle(typ, naAdmin());
  const treffer = q ? alle.filter(o=>naStammSuchtext(typ,o).indexOf(q)>=0) : alle;
  if(!alle.length) return naLeer(T.ico, 'Noch keine '+T.mehr, naAdmin() ? 'Mit ＋ unten rechts den ersten Eintrag anlegen.' : 'Die Verwaltung legt die Einträge an.');
  if(!treffer.length) return naLeer('🔎', 'Nichts gefunden', 'Andere Schreibweise versuchen.');
  const daten = naVerwendungDaten();
  return treffer.slice(0, 300).map(o=>{
    const n = naVerwendungen(daten.standards, typ, o.id).length;
    const hb = naHauptbild(o);
    const bild = hb ? '<img class="na-bild" loading="lazy" alt="" src="'+esc(naBildSrc(hb, true))+'">' : '<span class="na-ico">'+T.ico+'</span>';
    return '<div class="na-eintrag'+(o.archiviert?' archiv':'')+'" data-na="geh" data-ziel="#/'+typ+'/'+esc(o.id)+'">'+bild
      + '<div class="na-haupt"><div class="na-name">'+esc(o.name||'(ohne Namen)')+(o.archiviert?' · archiviert':'')+'</div><div class="na-sub">'+esc(naStammSub(typ,o))+'</div></div>'
      + '<div class="na-rechts">'+(n ? (n+'× verwendet') : '')+'</div></div>';
  }).join('') + (treffer.length>300 ? '<div class="na-dim">… weitere — bitte genauer suchen.</div>' : '');
}
naEin('vzSuche', (v, d)=>{ NA_VZ_Q[d.typ] = v; const l = $('naVzListe'); if(l) l.innerHTML = naVerzeichnisListe(d.typ); });

/* ── Ansicht für Anwender ── */
function naStammAnsicht(typ, o){
  const T = NA_TYPEN[typ]; let h = '<div class="na-karte">';
  h += naFotoReihe(o);
  h += '<h3>'+T.ico+' '+esc(o.name)+'</h3><div class="na-dim">'+esc(naStammSub(typ,o))+'</div>';
  const zeile = (l, w)=>w ? '<div style="margin-top:6px"><span class="na-l" style="display:inline">'+esc(l)+':</span> '+w+'</div>' : '';
  if(typ==='material'){
    h += zeile('GTIN', o.gtin ? '<span class="na-mono">'+esc(o.gtin)+'</span>' : '') + zeile('REF', o.ref ? '<span class="na-mono">'+esc(o.ref)+'</span>' : '');
    const kat = naKat(); const defs = kat.merkmale || [];
    Object.keys(o.merkmale||{}).forEach(mid=>{ const d = defs.find(x=>x.id===mid); const v = o.merkmale[mid]; if(v==null || v==='') return;
      h += zeile(d ? d.label : mid, esc(String(v===true?'ja':v)+(d && d.einheit && d.typ!=='ja_nein' ? ' '+d.einheit : ''))); });
  }
  if(o.bereich) h += zeile('Bereich', esc(naListeName('bereiche', o.bereich)));
  if(o.hinweis || o.notiz) h += '<div class="na-info">'+esc(o.hinweis || o.notiz)+'</div>';
  h += '</div>';
  h += '<button class="sheet-act" data-na="melden" data-typ="'+typ+'" data-id="'+esc(o.id)+'"><span class="sa-ico">📣</span><span>Melden: ist leer · fehlt · defekt<span class="sa-sub">Geht an die Verwaltung. Es wird nichts bestellt.</span></span></button>';
  h += naVerwendetIn(typ, o.id);
  return h;
}
function naVerwendetIn(typ, id){
  const daten = naVerwendungDaten();
  const v = naVerwendungen(daten.standards, typ, id);
  if(!v.length) return '<div class="na-h">Verwendet in</div><div class="na-dim">Noch in keinem Standard.</div>';
  const je = {}; v.forEach(x=>{ (je[x.std.id] = je[x.std.id] || { std:x.std, n:0 }).n++; });
  return '<div class="na-h">Verwendet in '+Object.keys(je).length+' Standard(s)</div>' + Object.keys(je).map(k=>{ const x = je[k]; const istB = !NA.standard[k];
    return '<div class="na-eintrag" data-na="geh" data-ziel="'+(istB ? '#/b/' : '#/s/')+esc(k)+'"><span class="na-ico">'+(istB?'🧩':'📋')+'</span><div class="na-haupt"><div class="na-name">'+esc(istB ? (naHole('baustein',k)||{}).name : x.std.titel)+'</div></div><div class="na-rechts">'+x.n+'×</div></div>'; }).join('');
}

/* ── Die Maske ── */
let NA_ENTWURF = null;   /* { typ, obj, neu, ocr } */
function naSichtStamm(typ, id){
  const T = NA_TYPEN[typ];
  if(id==='neu'){
    if(!naAdmin()) return { titel:'Neu anlegen', html: naLeer('🔒','Nur in der Verwaltung','Bitte oben anmelden.') };
    if(!NA_ENTWURF || NA_ENTWURF.typ!==typ || !NA_ENTWURF.neu) NA_ENTWURF = { typ, neu:true, obj: naStammLeer(typ) };
  } else {
    const o = naHole(typ, id);
    if(!o) return { titel:T.wort, html: naLeer('❓','Nicht gefunden', naImPapierkorb(typ,id) ? 'Der Eintrag liegt im Papierkorb (Mehr → Papierkorb).' : 'Vielleicht auf einem anderen Gerät gelöscht.') };
    if(!naAdmin()) return { titel:o.name, pfad:T.wort, html: naStammAnsicht(typ, o) };
    if(!NA_ENTWURF || NA_ENTWURF.typ!==typ || NA_ENTWURF.obj.id!==id) NA_ENTWURF = { typ, neu:false, obj: JSON.parse(JSON.stringify(o)) };
  }
  return { titel: NA_ENTWURF.neu ? (T.wort+' anlegen') : (NA_ENTWURF.obj.name || T.wort), pfad: NA_ENTWURF.neu ? 'Neu' : 'Bearbeiten', bearbeitung:true, html: naStammForm() };
}
function naStammLeer(typ){
  const o = { id: naId(typ[0]), name:'', lagerort:'', bereich:'', fotos:[] };
  if(typ==='material') Object.assign(o, { kategorie:'', gtin:'', ref:'', hersteller:'', merkmale:{}, preis:{ betrag:'', bezugsmenge:1 }, notiz:'' });
  if(typ==='geraet') Object.assign(o, { kategorie:'', hersteller:'', modell:'', hinweis:'' });
  if(typ==='medikament') Object.assign(o, { wirkstoff:'', konzentration:'', darreichung:'', preis:{ betrag:'', bezugsmenge:1 }, hinweis:'' });
  return o;
}
function naWert(o, pfad){ return pfad.split('.').reduce((a,k)=>(a==null ? undefined : a[k]), o); }
function naWertSetzen(o, pfad, v){ const t = pfad.split('.'); let a = o; t.slice(0,-1).forEach(k=>{ if(a[k]==null || typeof a[k]!=='object') a[k] = {}; a = a[k]; }); a[t[t.length-1]] = v; }
function naF(label, inner, hilfe, extra){ return '<div class="na-feld"'+(extra||'')+'><label>'+esc(label)+'</label>'+inner+(hilfe ? '<div class="na-hilfe">'+hilfe+'</div>' : '')+'</div>'; }
function naT(f, opt){ opt = opt||{}; const v = naWert(NA_ENTWURF.obj, f);
  return '<input type="'+(opt.typ||'text')+'" data-na-ein="entw" data-f="'+f+'" value="'+esc(v==null?'':v)+'" placeholder="'+esc(opt.ph||'')+'"'+(opt.mono?' class="na-mono"':'')+(opt.extra||'')+' autocomplete="off">'; }
function naW(f, liste, opt){ opt = opt||{}; const v = naWert(NA_ENTWURF.obj, f);
  const name = liste==='kategorien' ? ((naKat().klassen.find(k=>k.id===v)||{}).label || '') : naListeName(liste, v);
  return '<button class="na-wahl" data-na="entwWahl" data-f="'+f+'" data-liste="'+liste+'">'+(name ? esc(name) : '<span class="na-leer">'+esc(opt.ph||'wählen …')+'</span>')+'</button>'; }

function naStammForm(){
  const E = NA_ENTWURF, o = E.obj, typ = E.typ; let h = '';
  if(typ==='material'){
    h += naF('Kategorie (bestimmt die Felder)', naW('kategorie','kategorien',{ ph:'zuerst wählen …' }));
    if(o.kategorie){
      h += '<div class="na-karte"><h3>Etikett</h3><div class="na-zeile"><button class="na-knopf pri" data-na="etikett">📷 Etikett fotografieren und lesen</button><button class="na-knopf" data-na="scanText">⌨ Barcode-Text</button></div>'
        + '<div id="naOcrStand" class="na-dim" style="margin-top:6px">'+esc((E.ocr && E.ocr.stand) || 'Liest GTIN, REF, Hersteller und Merkmale. Alles bleibt prüfbar.')+'</div>'
        + (E.ocr && E.ocr.refVorschlaege && E.ocr.refVorschlaege.length ? '<div class="na-warn">REF unsicher gelesen — bitte die richtige antippen oder selbst eintragen:<div class="na-chips" style="margin-top:6px">'+E.ocr.refVorschlaege.map(r=>'<button class="na-chip" data-na="refNehmen" data-ref="'+esc(r)+'">'+esc(r)+'</button>').join('')+'</div></div>' : '')
        + '</div>';
      h += naF('GTIN (Barcode-Nummer)', naT('gtin',{ mono:true, ph:'z. B. 05414734… (8–14 Ziffern)', extra:' inputmode="numeric"' }), '<span id="naGtinStand">'+naGtinStand(o.gtin)+'</span>');
      h += naF('REF (Bestellnummer des Herstellers)', naT('ref',{ mono:true, ph:'genau wie auf dem Etikett' }));
      h += naF('Hersteller', naW('hersteller','hersteller'), '<span id="naHerstVor">'+naHerstVorHtml(o)+'</span>');
      h += naMerkmalFelder();
      h += naF('Name', naT('name',{ ph:'so, wie man es im Saal sucht' }), '<button class="na-chip" data-na="nameVorschlag">Vorschlag aus Kategorie und ★-Merkmalen</button>');
    }
  }
  if(typ==='geraet'){
    h += naF('Name (Gerätetyp)', naT('name',{ ph:'z. B. Defibrillator Lifepak 20' }), 'Ein Eintrag je Modell — nicht je Seriennummer.');
    h += naF('Kategorie', naW('kategorie','geraetekategorien'));
    h += naF('Hersteller', naW('hersteller','hersteller'));
    h += naF('Modell', naT('modell'));
    h += naF('Hinweis', '<textarea data-na-ein="entw" data-f="hinweis">'+esc(o.hinweis||'')+'</textarea>', 'Kalibrier-/Kontrollwerte sind erlaubt — keine Patientenwerte (Grundsatz A1).');
  }
  if(typ==='medikament'){
    h += naF('Name (Handelsname)', naT('name'));
    h += naF('Wirkstoff', naT('wirkstoff'));
    h += naF('Konzentration / Stärke', naT('konzentration',{ ph:'z. B. 5000 I.E./ml' }));
    h += naF('Darreichung', naW('darreichung','darreichung'));
    h += naF('Hinweis', '<textarea data-na-ein="entw" data-f="hinweis">'+esc(o.hinweis||'')+'</textarea>');
  }
  if(typ!=='material' || o.kategorie){
    h += '<div class="na-zwei">' + naF('Lagerort', naT('lagerort',{ ph:'z. B. Schrank 3, Fach B' })) + naF('Bereich (Vorgabe für die Rüstliste)', naW('bereich','bereiche',{ ph:'— keiner —' })) + '</div>';
    h += naFotoFeld();
    if(typ!=='geraet'){
      const sp = naStueckpreis(o.preis);
      h += '<div class="na-karte"><h3>Preis <span class="na-dim">(nur Verwaltung · Sachkostenüberblick)</span></h3><div class="na-zwei">'
        + naF('Preis in €', naT('preis.betrag',{ ph:'z. B. 120,00', extra:' inputmode="decimal"' }))
        + naF('… für wie viele Stück', naT('preis.bezugsmenge',{ typ:'number', extra:' min="1" inputmode="numeric"' }))
        + '</div><div class="na-dim">Stückpreis: <b id="naStueckpreis">'+naEuro(sp)+'</b></div></div>';
    }
    if(typ==='material') h += naF('Notiz', '<textarea data-na-ein="entw" data-f="notiz">'+esc(o.notiz||'')+'</textarea>');
    h += '<div id="naDoppel"></div>';
    h += '<div class="na-zeile" style="margin:14px 0"><button class="btn btn-sec" data-na="entwAbbrechen">Abbrechen</button><button class="btn btn-pri" data-na="entwSpeichern">Speichern</button></div>';
    if(!E.neu){
      h += '<div class="na-zeile"><button class="na-knopf" data-na="entwZusammen">⇉ Dublette: zusammenführen</button><button class="na-knopf" data-na="entwArchiv">'+(o.archiviert?'Zurückholen':'Archivieren')+'</button><button class="na-knopf weg" data-na="entwLoeschen">In den Papierkorb</button></div>';
      h += naVerwendetIn(typ, o.id);
      h += '<div class="na-dim" style="margin-top:10px">Angelegt '+esc(naDatum(o.angelegt))+(o.angelegtAuf?' auf '+esc(o.angelegtAuf):'')+' · geändert '+esc(naDatum(o.geaendert))+'</div>';
    }
  } else {
    h += '<div class="na-zeile" style="margin:14px 0"><button class="btn btn-sec" data-na="entwAbbrechen">Abbrechen</button></div>';
  }
  return h;
}
/* Hersteller-Vorschlag aus dem GTIN-Präfix — erscheint, sobald die GTIN stimmt. */
function naHerstVorHtml(o){
  if(o.hersteller || !o.gtin || !naGtinPruefziffer(o.gtin)) return '';
  const vor = naHerstellerAusGtin(naAlle('material',true).filter(m=>m.id!==o.id), o.gtin);
  return vor ? '<button class="na-chip" data-na="herstellerNehmen" data-id="'+esc(vor.hersteller)+'">Vorschlag aus der GTIN: '+esc(naListeName('hersteller',vor.hersteller))+' übernehmen</button>' : '';
}
function naGtinStand(g){
  g = String(g||'').trim(); if(!g) return 'Leer lassen, wenn es keine gibt.';
  if(!/^\d+$/.test(g)) return '<span class="na-falsch">Nur Ziffern.</span>';
  if(!naGtinPruefziffer(g)) return '<span class="na-falsch">✗ Prüfziffer stimmt nicht — bitte jede Ziffer prüfen.</span>';
  const k = naGtinKey(g); const doppelt = naAlle('material', true).find(m=>m.id!==NA_ENTWURF.obj.id && m.gtin && naGtinKey(m.gtin)===k);
  if(doppelt) return '<span class="na-falsch">Diese GTIN hat schon: </span><a href="#/material/'+esc(doppelt.id)+'">'+esc(doppelt.name)+'</a>';
  return '<span class="na-ok">✓ Prüfziffer stimmt</span>';
}
function naMerkmalFelder(){
  const o = NA_ENTWURF.obj; const kat = naKat(); const f = naFelder(kat, o.kategorie);
  const feld = d=>{
    const v = (o.merkmale||{})[d.id]; const lab = (f.diff.indexOf(d)>=0 ? '★ ' : '')+d.label+(d.einheit && d.typ!=='ja_nein' && String(d.label).indexOf('('+d.einheit+')')<0 ? ' ('+d.einheit+')' : '');
    if(d.typ==='ja_nein') return '<div class="na-feld"><label><input type="checkbox" data-na-wechsel="entwHaken" data-f="merkmale.'+esc(d.id)+'"'+(v===true||v==='ja'?' checked':'')+'> '+esc(lab)+'</label></div>';
    if(d.typ==='liste') return naF(lab, '<button class="na-wahl" data-na="merkWahl" data-mid="'+esc(d.id)+'">'+(v ? esc(v) : '<span class="na-leer">wählen …</span>')+'</button>');
    return naF(lab, naT('merkmale.'+d.id, { extra: (d.typ==='mass'||d.typ==='zahl') ? ' inputmode="decimal"' : '' }), d.hinweis ? esc(d.hinweis) : '');
  };
  let h = '<div class="na-karte"><h3>Merkmale</h3>';
  if(!f.diff.length && !f.weitere.length) h += '<div class="na-dim">Diese Kategorie hat noch keine eigenen Felder.</div>';
  h += f.diff.map(feld).join('') + f.weitere.map(feld).join('');
  if(f.allgemein.length) h += '<details><summary class="na-dim" style="cursor:pointer;margin:6px 0">Allgemeine Felder ('+f.allgemein.length+')</summary>'+f.allgemein.map(feld).join('')+'</details>';
  h += '<button class="na-knopf klein" data-na="merkNeu">＋ Feld zu dieser Kategorie</button></div>';
  return h;
}

/* ── Eingaben ── */
naEin('entw', (v, d)=>{
  if(!NA_ENTWURF) return;
  naWertSetzen(NA_ENTWURF.obj, d.f, v);
  if(d.f==='gtin'){ const s = $('naGtinStand'); if(s) s.innerHTML = naGtinStand(v); const h = $('naHerstVor'); if(h) h.innerHTML = naHerstVorHtml(NA_ENTWURF.obj); }
  if(d.f.indexOf('preis.')===0){ const s = $('naStueckpreis'); if(s) s.textContent = naEuro(naStueckpreis(NA_ENTWURF.obj.preis)); }
});
naEin('entwHaken', (v, d)=>{ if(NA_ENTWURF) naWertSetzen(NA_ENTWURF.obj, d.f, v ? true : ''); });
function naFormNeu(){ const y = window.scrollY; naZeigen(); window.scrollTo(0, y); }
naAkt('entwWahl', async d=>{
  if(!NA_ENTWURF) return;
  const E = NA_ENTWURF; const T = NA_TYPEN[E.typ];
  const w = await naAuswahl({ titel: naListeWort(d.liste), liste:d.liste, gewaehlt: naWert(E.obj, d.f), neu:true, wo: T.wort+': '+(E.obj.name||'neu'), leer: d.f==='kategorie' ? null : '— keine Angabe —' });
  if(w==null || NA_ENTWURF!==E) return;
  naWertSetzen(E.obj, d.f, w);
  naFormNeu();
});
naAkt('herstellerNehmen', d=>{ if(!NA_ENTWURF) return; NA_ENTWURF.obj.hersteller = d.id; naFormNeu(); });
naAkt('refNehmen', d=>{ if(!NA_ENTWURF) return; NA_ENTWURF.obj.ref = d.ref; if(NA_ENTWURF.ocr) NA_ENTWURF.ocr.refVorschlaege = []; naFormNeu(); });
naAkt('nameVorschlag', ()=>{
  const o = NA_ENTWURF && NA_ENTWURF.obj; if(!o) return;
  const kat = naKat(); const k = kat.klassen.find(x=>x.id===o.kategorie); const f = naFelder(kat, o.kategorie);
  const v = naNameVorschlag(k ? k.label : '', f.diff, o.merkmale);
  if(!v){ toast('Erst Kategorie und ★-Merkmale ausfüllen.', true); return; }
  o.name = v; naFormNeu();
});
naAkt('merkWahl', async d=>{
  const E = NA_ENTWURF; if(!E) return;
  const def = (naKat().merkmale||[]).find(x=>x.id===d.mid); if(!def) return;
  const items = (def.werte||[]).map(w=>({ id:w, name:w }));
  const w = await naAuswahl({ titel:def.label, items, gewaehlt:(E.obj.merkmale||{})[d.mid], neu:true, leer:'— leer —',
    anlegen: name=>{ const tpl = JSON.parse(JSON.stringify(naKatTpl())); tpl.werte = tpl.werte || {};
      tpl.werte[d.mid] = (tpl.werte[d.mid]||[]).concat([name]); naKatTplSpeichern(tpl, 'Wert „'+name+'" bei „'+def.label+'" angelegt'); return name; } });
  if(w==null || NA_ENTWURF!==E) return;
  E.obj.merkmale = E.obj.merkmale || {}; E.obj.merkmale[d.mid] = w; naFormNeu();
});
naAkt('merkNeu', async ()=>{
  const E = NA_ENTWURF; if(!E || !E.obj.kategorie) return;
  const label = await naEingabe('Neues Feld für diese Kategorie', { platzhalter:'z. B. Kurvenform', hilfe:'Das Feld gilt danach für alle Materialien dieser Kategorie.' });
  if(!label) return;
  const vorhanden = (naKat().merkmale||[]).find(m=>naNorm(m.label)===naNorm(label));
  const tpl = JSON.parse(JSON.stringify(naKatTpl())); tpl.klassen = tpl.klassen || {}; tpl.merkmale = tpl.merkmale || {};
  const mid = vorhanden ? vorhanden.id : ('m_'+naNorm(label).replace(/\s+/g,'_').slice(0,20)+'_'+naId('').slice(-4));
  if(!vorhanden) tpl.merkmale[mid] = { label, typ:'text', angelegt:naJetzt() };
  const k = tpl.klassen[E.obj.kategorie] = Object.assign({}, tpl.klassen[E.obj.kategorie] || {});
  k.dazu = (k.dazu||[]).filter(x=>x!==mid).concat([mid]);
  naKatTplSpeichern(tpl, 'Feld „'+label+'" zur Kategorie');
  toast(vorhanden ? 'Vorhandenes Feld „'+vorhanden.label+'" zugeordnet' : 'Feld „'+label+'" angelegt');
  naFormNeu();
});
/* ── Bilder am Stammsatz ──
   EIN Feld in der Maske (kein eigenes Menü), für Material, Gerät und
   Medikament dasselbe: aufnehmen oder aus den Fotos wählen, gleich
   zuschneiden und drehen, eines als Anzeigebild wählen. Regeln: kern.js. */
function naFotoReihe(o){
  const l = naFotos(o); if(!l.length) return '';
  const hb = naHauptbild(o); const reihe = [hb].concat(l.filter(f=>f.k!==hb.k));
  return '<div class="na-fotos">'+reihe.map(f=>'<img alt="'+esc(f.titel||'')+'" loading="lazy" data-zoom data-gross="'+esc(naBildSrc(f))+'" data-cap="'+esc(f.titel||o.name||'')+'" src="'+esc(naBildSrc(f, true))+'">').join('')+'</div>';
}
function naFotoFeld(){
  const E = NA_ENTWURF, o = E.obj; const l = naFotos(o); const hb = naHauptbild(o);
  const kacheln = l.map(f=>{ const r = naFotoRolle(f.rolle); const haupt = hb && hb.k===f.k;
    return '<button type="button" class="na-foto'+(haupt?' haupt':'')+'" data-na="fotoBlatt" data-k="'+esc(f.k)+'" aria-label="Bild bearbeiten'+(haupt?' (Anzeigebild)':'')+'">'
      + '<img alt="'+esc(f.titel||'Foto')+'" loading="lazy" src="'+esc(naBildSrc(f, true))+'">'
      + (haupt ? '<span class="na-foto-marke">★ Anzeigebild</span>' : '')
      + (r ? '<span class="na-foto-rolle" title="'+esc(r.name)+'">'+r.ico+'</span>' : '')+'</button>'; }).join('');
  let offen = false;
  if(!E.neu){ const alt = naHole(E.typ, o.id) || {}; offen = JSON.stringify([naFotos(alt), alt.hauptbild||'']) !== JSON.stringify([l, o.hauptbild||'']); }
  return naF('Bilder', '<div class="na-fotos">'+kacheln+'</div>'
    + '<div class="na-zeile"><button class="na-knopf" data-na="fotoAuf">📷 Foto aufnehmen</button><button class="na-knopf" data-na="fotoWahl">🖼 Aus Fotos wählen</button></div>',
    (l.length ? 'Bild antippen: zuschneiden, drehen, als Anzeigebild wählen. Das Anzeigebild erscheint in Listen und in den Standards.' : 'Nach der Aufnahme lässt sich das Bild gleich zuschneiden und drehen.')
    + (offen ? ' <b class="na-falsch">Bildänderungen sind noch nicht gespeichert — unten „Speichern".</b>' : ''));
}
/* Ein neues Bild: (auf Wunsch) erst zuschneiden/drehen, dann ablegen. */
async function naFotoNeu(E, dataUrl, rolle, mitEditor){
  let bild = dataUrl;
  if(mitEditor){ bild = await naBildBearbeiten(dataUrl); if(!bild) return false; }
  toast('Bild wird gespeichert …');
  const b = await naBildHochladen(bild);
  if(NA_ENTWURF!==E) return false;
  naFotoDazu(E.obj, b, rolle); return true;
}
naAkt('fotoAuf', async ()=>{
  const E = NA_ENTWURF; if(!E) return;
  const f = await naDateiWaehlen('kamera'); if(!f) return;
  try{ if(await naFotoNeu(E, await naDateiAlsDataUrl(f), 'produkt', true)){ toast('Bild hinzugefügt'); naFormNeu(); } }
  catch(e){ toast(e.message, true); }
});
/* Mehrere auf einmal wandern direkt ins Feld (jedes einzeln durch den Editor
   zu schicken wäre eine Zumutung) — dort einzeln nachbearbeitbar. */
naAkt('fotoWahl', async ()=>{
  const E = NA_ENTWURF; if(!E) return;
  const dateien = await naBilderWaehlen(); if(!dateien.length) return;
  let n = 0;
  try{ for(const f of dateien){ if(await naFotoNeu(E, await naDateiAlsDataUrl(f), 'produkt', dateien.length===1)) n++; } }
  catch(e){ toast(e.message, true); }
  if(n){ toast(n===1 ? 'Bild hinzugefügt' : n+' Bilder hinzugefügt'); naFormNeu(); }
});
function naFotoBlatt(k){
  const E = NA_ENTWURF; if(!E) return;
  const f = naFotos(E.obj).find(x=>x.k===k); if(!f){ naSheetZu(null); return; }
  const hb = naHauptbild(E.obj); const haupt = hb && hb.k===k; const kk = esc(k);
  naSheetAuf('<div class="sheet-title">Bild</div>'
    + '<img class="na-foto-gross" alt="" data-zoom data-cap="'+esc(f.titel||E.obj.name||'')+'" src="'+esc(naBildSrc(f))+'">'
    + '<button class="sheet-act" data-na="fotoSchnitt" data-k="'+kk+'"><span class="sa-ico">✂</span><span>Zuschneiden / drehen</span></button>'
    + (haupt ? '<div class="na-info">★ Das ist das Anzeigebild: So erscheint der Eintrag in Listen und in den Standards.</div>'
        : '<button class="sheet-act" data-na="fotoHaupt" data-k="'+kk+'"><span class="sa-ico">★</span><span>Als Anzeigebild wählen<span class="sa-sub">erscheint in Listen und in den Standards</span></span></button>')
    + '<div class="na-l" style="margin-top:10px">Was zeigt das Bild?</div><div class="na-chips" style="margin-bottom:10px">'
    + NA_FOTO_ROLLEN.map(r=>'<button class="na-chip'+(f.rolle===r.id?' an':'')+'" data-na="fotoRolle" data-k="'+kk+'" data-r="'+r.id+'">'+r.ico+' '+esc(r.name)+'</button>').join('')+'</div>'
    + naF('Bildunterschrift (freiwillig)', '<input type="text" value="'+esc(f.titel||'')+'" placeholder="z. B. Ansicht von oben" data-na-ein="fotoTitel" data-k="'+kk+'" autocomplete="off">')
    + (f.orig && f.orig!==f.k ? '<button class="sheet-act" data-na="fotoOriginal" data-k="'+kk+'"><span class="sa-ico">↺</span><span>Original wiederherstellen<span class="sa-sub">Zuschnitt und Drehung zurücknehmen</span></span></button>' : '')
    + '<button class="sheet-act danger" data-na="fotoWeg" data-k="'+kk+'"><span class="sa-ico">✕</span><span>Bild entfernen</span></button>'
    + '<button class="btn btn-sec" style="width:100%;margin-top:4px" data-na="sheetZu">Fertig</button>');
}
naAkt('fotoBlatt', d=>naFotoBlatt(d.k));
naAkt('fotoHaupt', d=>{ const E = NA_ENTWURF; if(!E) return; E.obj.hauptbild = d.k; naFormNeu(); naFotoBlatt(d.k); });
naAkt('fotoRolle', d=>{ const E = NA_ENTWURF; if(!E) return;
  const f = naFotos(E.obj).find(x=>x.k===d.k); if(!f) return;
  naFotoAendern(E.obj, d.k, { rolle: f.rolle===d.r ? '' : d.r }); naFormNeu(); naFotoBlatt(d.k); });
naEin('fotoTitel', (v, d)=>{ const E = NA_ENTWURF; if(E) naFotoAendern(E.obj, d.k, { titel: String(v||'').trim().slice(0, 80) }); });
naAkt('fotoSchnitt', async d=>{
  const E = NA_ENTWURF; if(!E) return;
  const f = naFotos(E.obj).find(x=>x.k===d.k); if(!f) return;
  naSheetZu(null);
  const erg = await naBildBearbeiten(naBildSrc(f));
  if(NA_ENTWURF!==E) return;
  if(!erg){ naFotoBlatt(d.k); return; }
  try{ toast('Bild wird gespeichert …'); const b = await naBildHochladen(erg);
    if(NA_ENTWURF!==E) return;
    naFotoErsetzen(E.obj, d.k, b); naFormNeu(); naFotoBlatt(b.k); toast('Bild geändert'); }
  catch(e){ toast(e.message, true); }
});
naAkt('fotoOriginal', d=>{ const E = NA_ENTWURF; if(!E) return;
  const f = naFotos(E.obj).find(x=>x.k===d.k); if(!f || !f.orig) return;
  const ziel = f.orig; naFotoOriginal(E.obj, d.k); naFormNeu(); naFotoBlatt(ziel); toast('Original wiederhergestellt'); });
naAkt('fotoWeg', async d=>{ const E = NA_ENTWURF; if(!E) return;
  if(!(await naFrage('Dieses Bild entfernen?', { ja:'Entfernen', gefahr:true }))){ if(NA_ENTWURF===E) naFotoBlatt(d.k); return; }
  if(NA_ENTWURF!==E) return;
  naFotoEntfernen(E.obj, d.k); naFormNeu(); });

/* ── Etikett lesen (ocr.js + merkmale.js aus der alten App, unverändert) ── */
function naOcrStand(t){ if(NA_ENTWURF){ NA_ENTWURF.ocr = Object.assign(NA_ENTWURF.ocr||{}, { stand:t }); } const s = $('naOcrStand'); if(s) s.textContent = t; }
function naEtikettUebernehmen(E, erg){
  const o = E.obj; const neu = [];
  const gtin = erg.gtin || '';
  if(gtin && !o.gtin && naGtinPruefziffer(gtin)){ o.gtin = gtin; neu.push('GTIN'); }
  const f = erg.fields || {};
  if(f.ref && !o.ref){ o.ref = f.ref; neu.push('REF'); }
  E.ocr = Object.assign(E.ocr||{}, { refVorschlaege: (!o.ref && erg.refInfo && erg.refInfo.vorschlaege) ? erg.refInfo.vorschlaege.slice(0,4) : [] });
  if(f.hersteller && !o.hersteller){
    const tr = naAehnliche(f.hersteller, naListe('hersteller'));
    const g = tr.find(t=>t.grad==='gleich') || tr[0];
    if(g){ o.hersteller = g.item.id; neu.push('Hersteller'); }
    else E.ocr.herstellerNeu = f.hersteller;
  }
  if(erg.text && typeof merkSammeln==='function'){
    const m = merkSammeln(erg.text, o.ref || f.ref || '', naKat(), o.kategorie);
    o.merkmale = o.merkmale || {};
    (m.merkmale||[]).forEach(x=>{ if(o.merkmale[x.id]==null || o.merkmale[x.id]===''){ o.merkmale[x.id] = x.wert; neu.push(x.kurz||x.label||x.id); } });
  }
  return neu;
}
naAkt('etikett', async ()=>{
  const E = NA_ENTWURF; if(!E) return;
  const f = await naDateiWaehlen(); if(!f) return;
  const url = await naDateiAlsDataUrl(f);
  naOcrStand('Etikett wird gelesen … (das dauert einige Sekunden)');
  try{
    const foto = await ocrLeseFotoEinzeln(url, t=>naOcrStand('Etikett wird gelesen … '+t));
    const erg = ocrZusammenfuehren([foto]);
    if(NA_ENTWURF!==E) return;
    const neu = naEtikettUebernehmen(E, erg);
    /* Das Etikettfoto bleibt als Bild erhalten — mit der Rolle „Etikett", damit
       es nicht von allein zum Anzeigebild wird. */
    try{ naFotoDazu(E.obj, await naBildHochladen(url), 'etikett'); }catch(e){ /* Foto ist Zugabe */ }
    naOcrStand(neu.length ? ('Übernommen: '+neu.join(', ')+'. Bitte prüfen.') : 'Nichts Sicheres gelesen — bitte von Hand eintragen.'
      + (E.ocr.herstellerNeu ? ' Hersteller gelesen: „'+E.ocr.herstellerNeu+'" (noch nicht in der Liste).' : ''));
    naFormNeu();
  }catch(e){ naOcrStand('Lesen fehlgeschlagen: '+e.message); }
});
naAkt('scanText', async ()=>{
  const E = NA_ENTWURF; if(!E) return;
  const t = await naEingabe('Barcode-Inhalt', { platzhalter:'z. B. (01)05414734…(240)…', hilfe:'Text eines Barcode-Scanners einfügen. Übernommen werden nur GTIN (01) und REF (240) — Charge und Verfall nie.' });
  if(!t) return;
  const s = naParseScan(t);
  if(s.kind==='text' || s.kind==='url'){ toast('Darin steht keine GTIN.', true); return; }
  if(!naGtinPruefziffer(s.gtin)){ toast('GTIN im Barcode hat eine falsche Prüfziffer.', true); return; }
  E.obj.gtin = s.gtin; if(s.itemRef) E.obj.ref = s.itemRef; naFormNeu();
});

/* ── Speichern mit Prüfungen ── */
async function naStammPruefen(E){
  const o = E.obj, typ = E.typ;
  o.name = String(o.name||'').trim();
  if(!o.name){ toast('Bitte einen Namen eintragen.', true); return false; }
  if(typ==='material'){
    o.gtin = String(o.gtin||'').replace(/\s/g,''); o.ref = String(o.ref||'').trim();
    if(o.gtin && !naGtinPruefziffer(o.gtin)){ toast('GTIN: Prüfziffer stimmt nicht. Bitte korrigieren oder leeren.', true); return false; }
    if(o.gtin){ const k = naGtinKey(o.gtin); const d = naAlle('material', true).find(m=>m.id!==o.id && m.gtin && naGtinKey(m.gtin)===k);
      if(d){ toast('Diese GTIN gehört schon zu „'+d.name+'".', true); return false; } }
    if(o.ref && o.hersteller){ const d = naAlle('material', true).find(m=>m.id!==o.id && m.hersteller===o.hersteller && naNorm(m.ref)===naNorm(o.ref));
      if(d && !(await naFrage('Gleiche REF beim gleichen Hersteller gibt es schon: „'+d.name+'". Trotzdem speichern?', { ja:'Trotzdem speichern' }))) return false; }
  }
  const andere = naAlle(typ, true).filter(x=>x.id!==o.id);
  const tr = naAehnliche(o.name, andere);
  const gleich = tr.find(t=>t.grad==='gleich');
  if(gleich && !(await naFrage('„'+gleich.item.name+'" gibt es schon. Wirklich einen zweiten Eintrag mit diesem Namen?', { ja:'Ja, zweiter Eintrag', mehr:'Meist ist es besser, den vorhandenen Eintrag zu verwenden.' }))) return false;
  if(!E.neu){
    const alt = naHole(typ, o.id);
    /* Fotos, Notiz und Preis ändern keine Zeile im Standard — dafür keine Rückfrage. */
    const felder = naUnterschiede(alt, o).filter(f=>['fotos','hauptbild','notiz','preis'].indexOf(f)<0);
    const v = naVerwendungen(naVerwendungDaten().standards, typ, o.id);
    const stds = v.map(x=>x.std.titel || (naHole('baustein',x.std.id)||{}).name).filter((x,i,a)=>a.indexOf(x)===i);
    if(felder.length && stds.length && !(await naFrage('Diese Änderung wirkt in '+stds.length+' Standard(s).', { ja:'Überall übernehmen', mehr: esc(stds.slice(0,8).join(' · ')+(stds.length>8?' …':'')) }))) return false;
  }
  return true;
}
naAkt('entwSpeichern', async ()=>{
  const E = NA_ENTWURF; if(!E) return;
  if(!(await naStammPruefen(E))) return;
  if(E.typ==='material' && E.obj.preis) E.obj.preis.bezugsmenge = Math.max(1, +E.obj.preis.bezugsmenge || 1);
  naFotosSetzen(E.obj, naFotos(E.obj));   /* einheitliche Bildform, auch für ältere Einträge */
  naSpeichern(E.typ, E.obj);
  NA_ENTWURF = null; toast('Gespeichert');
  const zurueck = NA_RUECKSPRUNG; NA_RUECKSPRUNG = null;
  if(zurueck && zurueck.fertig) zurueck.fertig({ typ:E.typ, id:E.obj.id });
  else naGeh('#/'+E.typ);
});
naAkt('entwAbbrechen', ()=>{ const E = NA_ENTWURF; NA_ENTWURF = null; const z = NA_RUECKSPRUNG; NA_RUECKSPRUNG = null;
  if(z && z.abbruch) z.abbruch(); else naGeh('#/'+(E ? E.typ : 'material')); });
naAkt('entwArchiv', ()=>{ const E = NA_ENTWURF; if(!E) return; const o = naHole(E.typ, E.obj.id); o.archiviert = !o.archiviert;
  naSpeichern(E.typ, o, o.archiviert ? 'archiviert' : 'zurückgeholt'); NA_ENTWURF = null; toast(o.archiviert ? 'Archiviert — bleibt in den Standards sichtbar, wird aber nicht mehr angeboten.' : 'Zurückgeholt'); naZeigen(); });
naAkt('entwLoeschen', async ()=>{
  const E = NA_ENTWURF; if(!E) return;
  const v = naVerwendungen(naVerwendungDaten().standards, E.typ, E.obj.id);
  const ok = await naFrage('„'+E.obj.name+'" in den Papierkorb legen?', { ja:'In den Papierkorb', gefahr:true,
    mehr: v.length ? ('Er wird noch '+v.length+'× in Standards verwendet. Diese Zeilen zeigen danach „im Papierkorb", bis er wiederhergestellt oder ersetzt wird.') : 'Aus dem Papierkorb lässt er sich wiederherstellen.' });
  if(!ok) return;
  naLoeschen(E.typ, E.obj.id); NA_ENTWURF = null; toast('Im Papierkorb'); naGeh('#/'+E.typ);
});

/* Dublette auflösen: Alle Verwendungen zeigen danach auf den anderen
   Eintrag; dieser geht in den Papierkorb (wiederherstellbar). */
function naStammZusammenfuehren(typ, von, nach){
  let n = 0;
  naStandards().concat(naAlle('baustein', true)).forEach(o=>{ let m = 0;
    naPositionenAlle(o).forEach(p=>{ if(p.ref && p.ref.typ===typ && p.ref.id===von){ p.ref = { typ, id:nach }; m++; } });
    if(m){ n += m; naSpeichern(o.rubriken ? 'standard' : 'baustein', o, 'Dublette zusammengeführt'); } });
  naAlle('meldung', true).forEach(m=>{ if(m.ref && m.ref.typ===typ && m.ref.id===von){ m.ref = { typ, id:nach }; naSpeichern('meldung', m); } });
  naLoeschen(typ, von);
  return n;
}
naAkt('entwZusammen', async ()=>{
  const E = NA_ENTWURF; if(!E) return;
  const items = naAlle(E.typ).filter(x=>x.id!==E.obj.id);
  const tr = naAehnliche(E.obj.name, items).map(t=>t.item.id);
  items.sort((a,b)=>(tr.indexOf(a.id)<0?1:0)-(tr.indexOf(b.id)<0?1:0));
  const nach = await naAuswahl({ titel:'„'+E.obj.name+'" ist dasselbe wie …', items: items.map(x=>({ id:x.id, name:x.name, sub:(tr.indexOf(x.id)>=0?'ähnlich · ':'')+naStammSub(E.typ, x) })) });
  if(!nach) return;
  const ziel = naHole(E.typ, nach);
  const v = naVerwendungen(naVerwendungDaten().standards, E.typ, E.obj.id).length;
  if(!(await naFrage('„'+E.obj.name+'" in „'+ziel.name+'" überführen?', { ja:'Zusammenführen', mehr: v+' Verwendung(en) zeigen danach auf „'+esc(ziel.name)+'". Der Eintrag „'+esc(E.obj.name)+'" geht in den Papierkorb.' }))) return;
  const n = naStammZusammenfuehren(E.typ, E.obj.id, nach);
  NA_ENTWURF = null; toast(n+' Verwendung(en) umgehängt'); naGeh('#/'+E.typ+'/'+nach);
});

/* Aus dem Standard heraus „neu erfassen": nach dem Speichern zurück. */
let NA_RUECKSPRUNG = null;
function naStammNeuAusStandard(typ, fertig, abbruch, name){
  NA_ENTWURF = { typ, neu:true, obj: naStammLeer(typ) };
  if(name) NA_ENTWURF.obj.name = name;
  NA_RUECKSPRUNG = { fertig, abbruch };
  naGeh('#/'+typ+'/neu');
}

/* ── Melden (Grundsatz A2: Meldung, keine Bestellung) ── */
naAkt('melden', async d=>{
  const o = naHole(d.typ, d.id); if(!o) return;
  const was = await naSheetAuf('<div class="sheet-title">Melden</div><div class="sheet-name">'+esc(o.name)+'</div>'
    + ['leer','fehlt','defekt','sonstiges'].map(w=>'<button class="sheet-act" data-na="sheetWert" data-wert="'+w+'"><span class="sa-ico">'+({leer:'∅',fehlt:'❔',defekt:'⚠',sonstiges:'✎'})[w]+'</span><span>'+({leer:'Ist leer',fehlt:'Fehlt',defekt:'Defekt',sonstiges:'Sonstiges'})[w]+'</span></button>').join('')
    + '<div class="na-dim">Die Meldung geht an die Verwaltung. Die App bestellt nichts.</div>');
  if(!was) return;
  const notiz = await naEingabe('Kurze Notiz (freiwillig)', { platzhalter:'z. B. „letzte Packung angebrochen"', ok:'Melden' });
  if(notiz==null) return;
  const m = { id:naId('ml'), ref:{ typ:d.typ, id:d.id }, name:o.name, was, notiz, stufe:'gemeldet', schritte:[{ stufe:'gemeldet', t:naJetzt(), wer:naGeraetName() }] };
  naSpeichern('meldung', m, 'gemeldet: '+was);
  toast('Gemeldet');
});
