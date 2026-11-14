/* ─────────────────────────────────────────────────────────────
   NEUE APP — STAMMDATEN: Material · Geräte · Medikamente

   Ein Verzeichnis je Art, EINE Maske je Art. Stammdaten gelten überall: Wer
   hier etwas ändert, ändert es in jedem Standard, der den Eintrag verwendet —
   deshalb zeigt das Speichern vorher, wo es wirkt (Wirkungsvorschau).

   Die Material-Maske (Umbau 11/2026) folgt dem, was man in der Hand hat:
     1. ERKENNEN        Barcode scannen → GTIN → EU-Register füllt Hersteller,
                        Handelsname, REF, steril/Latex/Einmal.
     2. DAS WICHTIGSTE  Name im Haus, Hersteller, REF/GTIN, Lagerort, Bild.
     3. MEHR ANGABEN    aufklappbar: Kategorie und Merkmale, Packung und
                        Preis, Verwendung/Suchwörter/PZN, Verknüpfungen.
   Die Kategorie ist ein VORSCHLAG (aus Name oder Register), kein Tor mehr.
   Gespeichert werden kann jederzeit; was zum „vollständig" fehlt, steht über
   den Knöpfen und im Verzeichnis (Filter „unvollständig").

   GTIN und REF werden nie geraten: Die GTIN muss ihre Prüfziffer bestehen,
   eine unsicher gelesene REF wird nur vorgeschlagen. Eine GTIN gibt es genau
   einmal. Registerdaten tragen Quelle und Status (Grundsatz A5): Sie gelten
   erst mit dem Speichern als bestätigt.
   ───────────────────────────────────────────────────────────── */
/* ocr.js fragt nach diesen beiden, wenn vorhanden (Barcode im Etikettfoto). */
function parseScan(raw){ return naParseScan(raw); }
function gtinKey(g){ return naGtinKey(g); }

const NA_STAMM_FELDER = {
  material:   { liste:'#/material',   neu:'#/material/neu' },
  geraet:     { liste:'#/geraet',     neu:'#/geraet/neu' },
  medikament: { liste:'#/medikament', neu:'#/medikament/neu' },
};
/* Vorschläge beim Tippen des Namens (daten/material-namen.json, app.js lädt). */
let NA_NAMEN = [];

function naStammSub(typ, o){
  const t = [];
  if(typ==='material'){ const k = naKat().klassen.find(x=>x.id===o.kategorie); if(k) t.push(k.label);
    if(o.hersteller) t.push(naListeName('hersteller', o.hersteller)); if(o.ref) t.push('REF '+o.ref); }
  if(typ==='geraet'){ if(o.kategorie) t.push(naListeName('geraetekategorien', o.kategorie)); if(o.hersteller) t.push(naListeName('hersteller', o.hersteller)); if(o.modell) t.push(o.modell); }
  if(typ==='medikament'){ if(o.wirkstoff) t.push(o.wirkstoff); if(o.konzentration) t.push(o.konzentration); if(o.darreichung) t.push(naListeName('darreichung', o.darreichung)); }
  const ort = naLagerortName(o); if(ort) t.push('📍 '+ort);
  return t.filter(Boolean).join(' · ');
}
function naStammSuchtext(typ, o){ return naNorm([o.name, o.handelsname, naStammSub(typ,o), o.gtin, o.ref, o.pzn, o.suchwoerter, o.verwendung, o.notiz, o.hinweis].concat(Object.keys(o.merkmale||{}).map(k=>o.merkmale[k])).join(' ')); }

/* ── Verzeichnis ── */
let NA_VZ_Q = { material:'', geraet:'', medikament:'' };
let NA_VZ_OFFEN = false;   /* Material: nur unvollständige zeigen */
function naSichtVerzeichnis(typ){
  const T = NA_TYPEN[typ];
  let filter = '';
  if(typ==='material' && naAdmin()){
    const kat = naKat(); const n = naAlle('material').filter(o=>naFehlt(o, kat).length).length;
    if(!n) NA_VZ_OFFEN = false;
    const nach = naRegisterOffen().length;
    if(n || nach) filter = '<div class="na-chips" style="margin-bottom:8px">'
      + (n ? '<button class="na-chip'+(NA_VZ_OFFEN?' an':'')+'" data-na="vzOffen">unvollständig ('+n+')</button>' : '')
      + (nach ? '<button class="na-chip" data-na="registerNachholen">'+(NA_NACHHOLEN ? '⏳ Register: '+NA_NACHHOLEN.fertig+' von '+NA_NACHHOLEN.n : '↻ Aus dem Register ergänzen ('+nach+')')+'</button>' : '')
      + '</div>';
  }
  return { titel:T.mehr, pfad: naAlle(typ).length+' Einträge', tab:typ, plus: naAdmin() ? { na:'geh', ziel:NA_STAMM_FELDER[typ].neu } : null,
    html: '<input class="na-suche" type="search" id="naVzQ" placeholder="'+esc(T.mehr)+' suchen (Name, REF, GTIN, Ort …)" value="'+esc(NA_VZ_Q[typ])+'" data-na-ein="vzSuche" data-typ="'+typ+'">'
      + filter + '<div id="naVzListe">'+naVerzeichnisListe(typ)+'</div>' };
}
function naVerzeichnisListe(typ){
  const q = naNorm(NA_VZ_Q[typ]); const T = NA_TYPEN[typ];
  const alle = naAlle(typ, naAdmin());
  const zeigeFehlt = typ==='material' && naAdmin(); const kat = zeigeFehlt ? naKat() : null;
  let treffer = q ? alle.filter(o=>naStammSuchtext(typ,o).indexOf(q)>=0) : alle;
  if(zeigeFehlt && NA_VZ_OFFEN) treffer = treffer.filter(o=>!o.archiviert && naFehlt(o, kat).length);
  if(!alle.length) return naLeer(T.ico, 'Noch keine '+T.mehr, naAdmin() ? 'Mit ＋ unten rechts den ersten Eintrag anlegen.' : 'Die Verwaltung legt die Einträge an.');
  if(!treffer.length) return naLeer('🔎', 'Nichts gefunden', 'Andere Schreibweise versuchen.');
  const daten = naVerwendungDaten();
  return treffer.slice(0, 300).map(o=>{
    const n = naVerwendungen(daten.standards, typ, o.id).length;
    const hb = naHauptbild(o);
    const bild = hb ? '<img class="na-bild" loading="lazy" alt="" src="'+esc(naBildSrc(hb, true))+'">' : '<span class="na-ico">'+T.ico+'</span>';
    const fehlt = zeigeFehlt && !o.archiviert ? naFehlt(o, kat) : [];
    return '<div class="na-eintrag'+(o.archiviert?' archiv':'')+'" data-na="geh" data-ziel="#/'+typ+'/'+esc(o.id)+'">'+bild
      + '<div class="na-haupt"><div class="na-name">'+esc(o.name||'(ohne Namen)')+(o.archiviert?' · archiviert':'')+'</div><div class="na-sub">'+esc(naStammSub(typ,o))+'</div>'
      + (fehlt.length ? '<div class="na-sub na-fehlt">fehlt: '+esc(fehlt.join(', '))+'</div>' : '')+'</div>'
      + '<div class="na-rechts">'+(n ? (n+'× verwendet') : '')+'</div></div>';
  }).join('') + (treffer.length>300 ? '<div class="na-dim">… weitere — bitte genauer suchen.</div>' : '');
}
naEin('vzSuche', (v, d)=>{ NA_VZ_Q[d.typ] = v; const l = $('naVzListe'); if(l) l.innerHTML = naVerzeichnisListe(d.typ); });
naAkt('vzOffen', ()=>{ NA_VZ_OFFEN = !NA_VZ_OFFEN; naZeigen(); });

/* ── Verknüpfungen lesen (für Ansicht, Standard und Maske) ── */
function naVerknText(v){ const s = v.art==='ersatz' ? naErsatzSorte(v.sorte) : null; return (s ? s.name : '')+(s && v.grund ? ' — ' : '')+(v.grund||''); }
function naVerknAnsicht(o){
  const x = naVerknVon(naAlle('material', true), o.id); if(!x.raus.length && !x.rein.length) return '';
  const zeile = (v, wort)=>'<div class="na-eintrag" data-na="geh" data-ziel="#/material/'+esc(v.o.id)+'"><span class="na-ico">'+naVerknArt(v.art).ico+'</span><div class="na-haupt"><div class="na-sub">'+esc(wort)+'</div><div class="na-name">'+esc(v.o.name||'(ohne Namen)')+(v.o.archiviert?' · archiviert':'')+'</div>'
    + (naVerknText(v) ? '<div class="na-sub">'+esc(naVerknText(v))+'</div>' : '')+'</div><span class="chev">›</span></div>';
  return '<div class="na-h">Verknüpft</div>' + x.raus.map(v=>zeile(v, naVerknArt(v.art).hin)).join('') + x.rein.map(v=>zeile(v, naVerknArt(v.art).gegen)).join('');
}
/* Hat dieses Material einen eingetragenen Ersatz? (Hinweis an der Zeile im Standard) */
function naHatErsatz(o){ return !!o && naVerknNormal(o.verknuepfungen, o.id).some(v=>v.art==='ersatz' && naHole('material', v.ziel)); }

/* ── Ansicht für Anwender ── */
function naRegisterQuelle(q){ return q==='EUDAMED' ? 'EUDAMED (EU-Register)' : (q==='GUDID' ? 'GUDID (US-Datenbank)' : (q||'Register')); }
function naStammAnsicht(typ, o){
  const T = NA_TYPEN[typ]; let h = '<div class="na-karte">';
  h += naFotoReihe(o);
  h += '<h3>'+T.ico+' '+esc(o.name)+'</h3><div class="na-dim">'+esc(naStammSub(typ,o))+'</div>';
  const zeile = (l, w)=>w ? '<div style="margin-top:6px"><span class="na-l" style="display:inline">'+esc(l)+':</span> '+w+'</div>' : '';
  if(typ==='material'){
    h += zeile('Handelsname', esc(o.handelsname||'')) + zeile('Verwendung', esc(o.verwendung||''));
    h += zeile('GTIN', o.gtin ? '<span class="na-mono">'+esc(o.gtin)+'</span>' : '') + zeile('REF', o.ref ? '<span class="na-mono">'+esc(o.ref)+'</span>' : '') + zeile('PZN', o.pzn ? '<span class="na-mono">'+esc(o.pzn)+'</span>' : '');
    h += zeile('Packung', o.packung ? esc(o.packung)+(naMengeZahl(o.packung) ? ' Stück' : '') : '');
    const kat = naKat(); const defs = kat.merkmale || [];
    Object.keys(o.merkmale||{}).forEach(mid=>{ const d = defs.find(x=>x.id===mid); const v = o.merkmale[mid]; if(v==null || v==='') return;
      h += zeile(d ? d.label : mid, esc(String(v===true?'ja':v)+(d && d.einheit && d.typ!=='ja_nein' ? ' '+d.einheit : ''))); });
  }
  if(o.bereich) h += zeile('Bereich', esc(naListeName('bereiche', o.bereich)));
  if(o.hinweis || o.notiz) h += '<div class="na-info">'+esc(o.hinweis || o.notiz)+'</div>';
  if(typ==='material' && o.register && o.register.quelle) h += '<div class="na-dim" style="margin-top:8px">Produktangaben aus '+esc(naRegisterQuelle(o.register.quelle))+' · '+(o.register.bestaetigt ? 'bestätigt '+esc(naDatum(o.register.bestaetigt)) : 'noch nicht bestätigt')+'</div>';
  h += '</div>';
  if(typ==='material') h += naVerknAnsicht(o);
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

/* ── Der Entwurf ──
   { typ, neu, obj, start, offen, katAuto, ocr, variante }
   start = Abbild beim Öffnen: daran erkennt der Schutz, ob etwas zu verlieren
   ist. offen = welche „Mehr Angaben" aufgeklappt sind (übersteht das
   Neuzeichnen). katAuto = die Kategorie ist ein Vorschlag und darf sich noch
   ändern, solange niemand sie selbst gewählt hat. */
let NA_ENTWURF = null;
/* Abbild zum Vergleichen: Schlüssel sortiert, Leeres weggelassen — damit „Bild
   ersetzt und Original zurück" oder „getippt und wieder gelöscht" nicht als
   Änderung zählt. */
function naAbbild(o){
  return JSON.stringify(o, (k, v)=>{
    if(!v || typeof v!=='object' || Array.isArray(v)) return v;
    const aus = {}; Object.keys(v).sort().forEach(x=>{ if(!(v[x]==null || v[x]==='')) aus[x] = v[x]; }); return aus; });
}
function naEntwurfAnlegen(typ, obj, neu){ return { typ, neu:!!neu, obj, start: naAbbild(obj), offen:{}, katAuto:null }; }
function naEntwurfGeaendert(){ return !!NA_ENTWURF && naAbbild(NA_ENTWURF.obj)!==NA_ENTWURF.start; }
/* Zeigt die Adresse auf die Maske des offenen Entwurfs? */
function naZielIstEntwurf(ziel){
  const E = NA_ENTWURF; if(!E) return false;
  const r = String(ziel||'').replace(/^#\/?/, '').split('/').map(x=>{ try{ return decodeURIComponent(x); }catch(e){ return x; } });
  return r[0]===E.typ && (r[1]===E.obj.id || (r[1]==='neu' && E.neu));
}
function naVerlassenFragen(){
  return naFrage('Die Änderungen sind noch nicht gespeichert.', { ja:'Verwerfen', nein:'Weiter bearbeiten', gefahr:true, mehr:'Beim Verlassen der Maske gehen sie verloren.' });
}
document.addEventListener('toggle', ev=>{ const d = ev.target; if(NA_ENTWURF && d && d.dataset && d.dataset.ab) NA_ENTWURF.offen[d.dataset.ab] = d.open; }, true);

function naSichtStamm(typ, id){
  const T = NA_TYPEN[typ];
  if(id==='neu'){
    if(!naAdmin()) return { titel:'Neu anlegen', html: naLeer('🔒','Nur in der Verwaltung','Bitte oben anmelden.') };
    if(!NA_ENTWURF || NA_ENTWURF.typ!==typ || !NA_ENTWURF.neu) NA_ENTWURF = naEntwurfAnlegen(typ, naStammLeer(typ), true);
  } else {
    const o = naHole(typ, id);
    if(!o) return { titel:T.wort, html: naLeer('❓','Nicht gefunden', naImPapierkorb(typ,id) ? 'Der Eintrag liegt im Papierkorb (Mehr → Papierkorb).' : 'Vielleicht auf einem anderen Gerät gelöscht.') };
    if(!naAdmin()) return { titel:o.name, pfad:T.wort, html: naStammAnsicht(typ, o) };
    if(!NA_ENTWURF || NA_ENTWURF.typ!==typ || NA_ENTWURF.obj.id!==id) NA_ENTWURF = naEntwurfAnlegen(typ, JSON.parse(JSON.stringify(o)), false);
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
  const name = liste==='kategorien' ? ((naKat().klassen.find(k=>k.id===v)||{}).label || '') : (liste==='lagerorte' ? naLagerortName(NA_ENTWURF.obj) : naListeName(liste, v));
  return '<button class="na-wahl" data-na="entwWahl" data-f="'+f+'" data-liste="'+liste+'">'+(name ? esc(name) : '<span class="na-leer">'+esc(opt.ph||'wählen …')+'</span>')+'</button>'; }
/* Ein aufklappbarer Abschnitt unter „Mehr Angaben". */
function naAb(id, titel, stand, inhalt, vorgabeOffen){
  const E = NA_ENTWURF; const offen = (id in E.offen) ? E.offen[id] : !!vorgabeOffen;
  return '<details class="na-ab" data-ab="'+id+'"'+(offen?' open':'')+'><summary><span>'+esc(titel)+'</span><span class="na-ab-n">'+esc(stand||'')+'</span></summary><div class="na-ab-in">'+inhalt+'</div></details>';
}

/* Lagerort: EINE Liste (kein Freitext mehr), an Ort und Stelle erweiterbar. */
function naLagerortFeld(){
  const o = NA_ENTWURF.obj; const zuletzt = store.get('nalokal_lagerort') || '';
  const alt = o.lagerort && !naListeEintrag('lagerorte', o.lagerort);
  let hilfe = '';
  if(alt) hilfe = 'Bisher als freier Text eingetragen — bitte einmal aus der Liste wählen (oder dort neu anlegen).';
  else if(!o.lagerort && zuletzt && naListeEintrag('lagerorte', zuletzt) && !naListeEintrag('lagerorte', zuletzt).archiviert)
    hilfe = '<button class="na-chip" data-na="lagerortZuletzt" data-id="'+esc(zuletzt)+'">wie zuletzt: '+esc(naListeName('lagerorte', zuletzt))+'</button>';
  return naF('Lagerort', naW('lagerort','lagerorte',{ ph:'wählen oder neu anlegen …' }), hilfe);
}

function naStammForm(){
  const E = NA_ENTWURF, o = E.obj, typ = E.typ; let h = '';
  if(typ==='material') h += naMaterialForm();
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
  if(typ!=='material'){
    h += '<div class="na-zwei">' + naLagerortFeld() + naF('Bereich (Vorgabe für die Rüstliste)', naW('bereich','bereiche',{ ph:'— keiner —' })) + '</div>';
    h += naFotoFeld();
    if(typ==='medikament') h += '<div class="na-karte"><h3>Preis <span class="na-dim">(nur Verwaltung · Sachkostenüberblick)</span></h3>'+naPreisFelder()+'</div>';
  }
  h += '<div id="naDoppel"></div>';
  if(typ==='material') h += '<div id="naFehltZeile">'+naFehltHtml()+'</div>';
  h += '<div class="na-zeile" style="margin:14px 0 8px"><button class="btn btn-sec" data-na="entwAbbrechen">Abbrechen</button><button class="btn btn-pri" data-na="entwSpeichern">Speichern</button></div>';
  if(typ==='material' && E.neu && !NA_RUECKSPRUNG) h += '<button class="btn btn-sec" style="width:100%;margin-bottom:14px" data-na="entwWeiter">Speichern und nächstes Material<span class="na-knopf-sub">Lagerort und Bereich bleiben stehen</span></button>';
  if(!E.neu){
    h += '<div class="na-zeile" style="margin-top:6px">'+(typ==='material' ? '<button class="na-knopf" data-na="entwVariante">⧉ Als Variante kopieren</button>' : '')
      + '<button class="na-knopf" data-na="entwZusammen">⇉ Dublette: zusammenführen</button><button class="na-knopf" data-na="entwArchiv">'+(o.archiviert?'Zurückholen':'Archivieren')+'</button><button class="na-knopf weg" data-na="entwLoeschen">In den Papierkorb</button></div>';
    h += naVerwendetIn(typ, o.id);
    h += '<div class="na-dim" style="margin-top:10px">Angelegt '+esc(naDatum(o.angelegt))+(o.angelegtAuf?' auf '+esc(o.angelegtAuf):'')+' · geändert '+esc(naDatum(o.geaendert))+'</div>';
  }
  return h;
}
function naPreisFelder(){
  const sp = naStueckpreis(NA_ENTWURF.obj.preis);
  return '<div class="na-zwei">'
    + naF('Preis in €', naT('preis.betrag',{ ph:'z. B. 120,00', extra:' inputmode="decimal"' }))
    + naF('… für wie viele Stück', naT('preis.bezugsmenge',{ typ:'number', extra:' min="1" inputmode="numeric"' }))
    + '</div><div class="na-dim">Stückpreis: <b id="naStueckpreis">'+naEuro(sp)+'</b></div>';
}
function naFehltHtml(){
  const E = NA_ENTWURF; if(!E || E.typ!=='material') return '';
  const f = naFehlt(E.obj, naKat());
  return f.length ? '<div class="na-info">Für „vollständig" fehlt noch: <b>'+esc(f.join(' · '))+'</b>. Speichern geht trotzdem — das Verzeichnis merkt es sich (Filter „unvollständig").</div>'
    : '<div class="na-info"><span class="na-ok">✓</span> Alle Kern-Angaben sind da.</div>';
}

/* ── Die Material-Maske ── */
const NA_STERIL_IDS = ['steril','einmalgebrauch','einmalpatient','resterilisierbar','latex'];
const NA_NICHT_ALS_MERKMAL = NA_STERIL_IDS.concat(['stueck_packung']);   /* stehen an eigener Stelle */
function naMaterialForm(){
  const E = NA_ENTWURF, o = E.obj; let h = '';
  if(E.variante) h += '<div class="na-warn">Variante von „'+esc(E.variante)+'": Bitte Name, GTIN und REF dieser Größe eintragen. Bilder und Verknüpfungen werden nicht übernommen.</div>';
  /* 1 · Erkennen */
  h += '<div class="na-karte"><h3>Erkennen</h3><div class="na-zeile"><button class="na-knopf pri" data-na="scan">▦ Barcode scannen</button><button class="na-knopf" data-na="etikett">📷 Etikett lesen</button></div>'
    + '<div id="naOcrStand" class="na-dim" style="margin-top:6px">'+esc((E.ocr && E.ocr.stand) || (naEinstellung('register', true) ? 'Der Barcode trägt die GTIN — damit füllt das EU-Register Hersteller, Handelsname und REF. Alles bleibt prüfbar.' : 'Der Barcode trägt GTIN und REF. Alles bleibt prüfbar.'))+'</div>'
    + (E.ocr && E.ocr.refVorschlaege && E.ocr.refVorschlaege.length ? '<div class="na-warn">REF unsicher gelesen — bitte die richtige antippen oder selbst eintragen:<div class="na-chips" style="margin-top:6px">'+E.ocr.refVorschlaege.map(r=>'<button class="na-chip" data-na="refNehmen" data-ref="'+esc(r)+'">'+esc(r)+'</button>').join('')+'</div></div>' : '')
    + naRegisterHtml(o) + '</div>';
  /* 2 · Das Wichtigste */
  h += naF('Name im Haus', naT('name',{ ph:'so, wie man es im Saal sucht' }), '<span id="naNameVor">'+naNameVorHtml()+'</span><div id="naKatZeile">'+naKatZeileHtml()+'</div>');
  h += naF('Handelsname (freiwillig)', naT('handelsname',{ ph:'wie es auf der Packung steht' }));
  h += naF('Hersteller', naW('hersteller','hersteller'), '<span id="naHerstVor">'+naHerstVorHtml(o)+'</span>'
    + (!o.hersteller && E.ocr && E.ocr.herstellerNeu ? ' <button class="na-chip" data-na="herstellerAusEtikett">Vom Etikett: „'+esc(E.ocr.herstellerNeu)+'" übernehmen</button>' : ''));
  h += '<div class="na-zwei">' + naF('REF (Bestellnummer des Herstellers)', naT('ref',{ mono:true, ph:'genau wie auf dem Etikett' }))
    + naF('GTIN (Barcode-Nummer)', naT('gtin',{ mono:true, ph:'8–14 Ziffern — oder Text eines Handscanners' }), '<span id="naGtinStand">'+naGtinStand(o.gtin)+'</span>') + '</div>';
  h += naLagerortFeld();
  h += naFotoFeld();
  /* 3 · Mehr Angaben */
  h += '<div class="na-h">Mehr Angaben <span class="na-dim" style="text-transform:none;letter-spacing:0;font-weight:500">— alles freiwillig</span></div>';
  h += '<div id="naAbKatW">'+naAbKategorie()+'</div>';
  h += naAbSteril() + naAbPackung() + naAbVerwendung() + naAbVerkn() + naAbSonst();
  return h;
}
/* Registerdaten: Quelle und Status sichtbar (Grundsatz A5). */
function naRegisterHtml(o){
  const r = o.register; if(!r || !r.quelle) return '';
  let chip = '';
  if(r.hersteller){ const e = o.hersteller ? naListeEintrag('hersteller', o.hersteller) : null;
    const passt = e && ((r.srn && e.srn===r.srn) || [naNorm(e.name), naNorm(e.amtlich||'')].indexOf(naNorm(r.hersteller))>=0 || naNorm(e.name)===naNorm(naHerstellerKurz(r.hersteller)));
    if(!passt) chip = '<div style="margin-top:6px"><button class="na-chip" data-na="registerHersteller">Hersteller aus dem Register übernehmen</button></div>'; }
  return '<div class="na-info'+(r.bestaetigt?'':' na-offen')+'"><b>Aus '+esc(naRegisterQuelle(r.quelle))+'</b> · abgerufen '+esc(naDatum(r.abgerufen))
    + ' · '+(r.bestaetigt ? 'bestätigt '+esc(naDatum(r.bestaetigt)) : '<b>noch nicht bestätigt</b> — gilt mit dem Speichern als geprüft')
    + (r.hersteller ? '<br>Hersteller laut Register: '+esc(r.hersteller)+(r.srn ? ' <span class="na-mono">('+esc(r.srn)+')</span>' : '') : '')
    + (r.bezeichnung ? '<br>Bezeichnung: '+esc(r.bezeichnung) : '')
    + (r.einordnung ? '<br>Einordnung (EMDN): <span class="na-mono">'+esc(r.einordnung)+'</span>' : '') + chip + '</div>';
}
/* Unter dem Namen: Schreibweisen aus dem Haus, Handelsname aus dem Register,
   und der Hinweis, wenn es das Material schon gibt. */
function naNameVorHtml(){
  const E = NA_ENTWURF, o = E.obj; const q = naNorm(o.name); let h = '';
  const chips = [];
  if(!q){ if(o.handelsname) chips.push(o.handelsname); }
  else if(q.length>=2){
    NA_NAMEN.map(x=>({ x, n:naNorm(x.n) })).filter(y=>y.n!==q && y.n.indexOf(q)>=0)
      .sort((a,b)=>((a.n.indexOf(q)===0?0:1)-(b.n.indexOf(q)===0?0:1)) || (b.x.z-a.x.z)).slice(0, 5).forEach(y=>chips.push(y.x.n));
  }
  if(chips.length) h += '<span class="na-chips">'+chips.map(n=>'<button class="na-chip" data-na="nameNehmen" data-n="'+esc(n)+'">'+esc(n)+'</button>').join('')+'</span>';
  if(q.length>=3){
    const tr = naAehnliche(o.name, naAlle('material', true).filter(m=>m.id!==o.id)).slice(0, 3);
    if(tr.length) h += '<div class="na-gibt">'+(tr[0].grad==='gleich' ? 'Gibt es schon: ' : 'Ähnlich vorhanden: ')+tr.map(t=>'<a href="#/material/'+esc(t.item.id)+'">'+esc(t.item.name)+'</a>').join(' · ')+'</div>';
  }
  if(o.kategorie && !q){ const f = naFelder(naKat(), o.kategorie); const m = o.merkmale || {};
    if(f.diff.some(d=>!(m[d.id]==null || m[d.id]===''))) h += '<button class="na-chip" data-na="nameVorschlag">Vorschlag aus Kategorie und ★-Merkmalen</button>'; }
  return h;
}
/* Hersteller-Vorschlag aus dem GTIN-Präfix — erscheint, sobald die GTIN stimmt. */
function naHerstVorHtml(o){
  if(o.hersteller || !o.gtin || !naGtinPruefziffer(o.gtin)) return '';
  const vor = naHerstellerAusGtin(naAlle('material',true).filter(m=>m.id!==o.id), o.gtin);
  return vor ? '<button class="na-chip" data-na="herstellerNehmen" data-id="'+esc(vor.hersteller)+'">Vorschlag aus der GTIN: '+esc(naListeName('hersteller',vor.hersteller))+' übernehmen</button>' : '';
}
function naGtinDoppelt(g, eigeneId){ const k = naGtinKey(g); return k ? (naAlle('material', true).find(m=>m.id!==eigeneId && m.gtin && naGtinKey(m.gtin)===k) || null) : null; }
function naGtinStand(g){
  g = String(g||'').trim(); if(!g) return 'Leer lassen, wenn es keine gibt.';
  if(!/^\d+$/.test(g)) return /^[\d()\s\[\]A-Za-z0-9.\-\/]+$/.test(g) && /\d{8}/.test(g) ? 'Text eines Scanners? Wird gleich ausgewertet …' : '<span class="na-falsch">Nur Ziffern.</span>';
  if(!naGtinPruefziffer(g)) return '<span class="na-falsch">✗ Prüfziffer stimmt nicht — bitte jede Ziffer prüfen.</span>';
  const o = NA_ENTWURF.obj; const doppelt = naGtinDoppelt(g, o.id);
  if(doppelt) return '<span class="na-falsch">Diese GTIN hat schon: </span><a href="#/material/'+esc(doppelt.id)+'">'+esc(doppelt.name)+'</a>';
  const fragen = naEinstellung('register', true) && !(o.register && o.register.gtin===naGtinKey(g));
  return '<span class="na-ok">✓ Prüfziffer stimmt</span>'+(fragen ? ' <button class="na-chip" data-na="registerHolen">Im EU-Register nachsehen</button>' : '');
}

/* ── Mehr Angaben: die Abschnitte ── */
function naMerkFeld(d, stern){
  const o = NA_ENTWURF.obj; const v = (o.merkmale||{})[d.id];
  const lab = (stern ? '★ ' : '')+d.label+(d.einheit && d.typ!=='ja_nein' && String(d.label).indexOf('('+d.einheit+')')<0 ? ' ('+d.einheit+')' : '');
  if(d.typ==='ja_nein') return '<div class="na-feld"><label><input type="checkbox" data-na-wechsel="entwHaken" data-f="merkmale.'+esc(d.id)+'"'+(v===true||v==='ja'?' checked':'')+'> '+esc(lab)+'</label>'+(d.hinweis ? '<div class="na-hilfe">'+esc(d.hinweis)+'</div>' : '')+'</div>';
  if(d.typ==='liste') return naF(lab, '<button class="na-wahl" data-na="merkWahl" data-mid="'+esc(d.id)+'">'+(v ? esc(v) : '<span class="na-leer">wählen …</span>')+'</button>', d.hinweis ? esc(d.hinweis) : '');
  return naF(lab, naT('merkmale.'+d.id, { extra: (d.typ==='mass'||d.typ==='zahl') ? ' inputmode="decimal"' : '' }), d.hinweis ? esc(d.hinweis) : '');
}
function naKatVorschlagFuer(o){ return naKategorieVorschlag(naKat(), { name:o.name, handelsname:o.handelsname, bezeichnung:o.register && o.register.bezeichnung, einordnung:o.register && o.register.einordnung }); }
/* Kategorie als Vorschlag: bei einem NEUEN Material wird sie gesetzt, solange
   niemand selbst gewählt hat — und folgt dem Namen. Liefert true, wenn sie
   sich geändert hat. Ein vorhandenes Material wird nie still umsortiert. */
function naKatAuto(E){
  if(!E || E.typ!=='material' || !E.neu) return false;
  const o = E.obj; if(o.kategorie && !E.katAuto) return false;
  const v = naKatVorschlagFuer(o); const alt = o.kategorie || '';
  o.kategorie = v ? v.id : ''; E.katAuto = v;
  return alt!==o.kategorie;
}
/* Die Kategorie steht sichtbar beim Namen — ein falscher Vorschlag soll auffallen. */
function naKatZeileHtml(){
  const E = NA_ENTWURF, o = E.obj; if(E.typ!=='material' || !o.kategorie) return '';
  const k = naKat().klassen.find(x=>x.id===o.kategorie); if(!k) return '';
  return '<span class="na-katzeile">Kategorie: <b>'+esc(k.label)+'</b>'+(E.katAuto ? ' (Vorschlag)' : '')+' <button class="na-chip" data-na="katAendern">ändern</button></span>';
}
function naAbKategorie(){
  const E = NA_ENTWURF, o = E.obj; const kat = naKat();
  const k = kat.klassen.find(x=>x.id===o.kategorie); const f = naFelderMaterial(kat, o, E.einzel);
  const ohne = d=>NA_NICHT_ALS_MERKMAL.indexOf(d.id)<0;
  const diff = f.diff.filter(ohne), weitere = f.weitere.filter(ohne), einzel = f.einzel.filter(ohne), allg = f.allgemein.filter(ohne);
  const voll = d=>{ const v = (o.merkmale||{})[d.id]; return !(v==null || v===''); };
  let hilfe = 'Freiwillig. Die Kategorie bestimmt, welche Merkmale erscheinen.';
  if(E.katAuto) hilfe = 'Vorschlag '+(E.katAuto.grund==='einordnung' ? 'aus der Einordnung im Register' : 'wegen „'+esc(E.katAuto.wort)+'"')+' — antippen, um eine andere zu wählen.';
  else if(!o.kategorie){ const v = naKatVorschlagFuer(o); const vk = v && kat.klassen.find(x=>x.id===v.id);
    if(vk) hilfe = '<button class="na-chip" data-na="katNehmen" data-id="'+esc(vk.id)+'">Vorschlag: '+esc(vk.label)+' übernehmen</button>'; }
  let h = naF('Kategorie', naW('kategorie','kategorien',{ ph:'wählen …' }), hilfe);
  if(o.kategorie){
    if(!diff.length && !weitere.length) h += '<div class="na-dim" style="margin-bottom:8px">Diese Kategorie hat noch keine eigenen Merkmale — unten „Merkmal suchen" und für die Kategorie übernehmen.</div>';
    /* Kern-Merkmale ★ stehen offen da; von den weiteren nur die ausgefüllten. */
    h += diff.map(d=>naMerkFeld(d, true)).join('') + weitere.filter(voll).map(d=>naMerkFeld(d, false)).join('');
    const leer = weitere.filter(d=>!voll(d));
    if(leer.length) h += '<details class="na-unter" data-ab="weit"'+(E.offen.weit?' open':'')+'><summary>Weitere Merkmale dieser Kategorie ('+leer.length+')</summary>'+leer.map(d=>naMerkFeld(d, false)).join('')+'</details>';
  }
  if(einzel.length){
    h += '<div class="na-l" style="margin-top:12px">Nur bei diesem Material</div>';
    h += einzel.map(d=>naMerkFeld(d, false) + (o.kategorie && k ? '<div class="na-chips na-nachfeld"><button class="na-chip" data-na="merkGilt" data-mid="'+esc(d.id)+'">für alle „'+esc(k.label)+'" übernehmen …</button></div>' : '')).join('');
  }
  /* „Die App lernt" — als Vorschlag: was bei den anderen Materialien der Kategorie meist ausgefüllt ist. */
  if(o.kategorie && k) naMerkmalVorschlaege(kat, naAlle('material'), o.kategorie, NA_NICHT_ALS_MERKMAL).filter(v=>!einzel.some(d=>d.id===v.id)).slice(0, 3).forEach(v=>{
    h += '<div class="na-info">„'+esc(v.label)+'" ist bei '+v.zahl+' von '+v.n+' Materialien dieser Kategorie ausgefüllt.<div class="na-chips" style="margin-top:6px">'
      + '<button class="na-chip" data-na="merkVorschlagNehmen" data-mid="'+esc(v.id)+'">Für alle „'+esc(k.label)+'" übernehmen</button>'
      + '<button class="na-chip" data-na="merkVorschlagStumm" data-mid="'+esc(v.id)+'">Nicht mehr vorschlagen</button></div></div>'; });
  h += '<button class="na-knopf klein" data-na="merkSuchen">＋ Merkmal suchen oder anlegen</button>';
  if(allg.length) h += '<details class="na-unter" data-ab="allg"'+(E.offen.allg?' open':'')+'><summary>Seltene Angaben ('+allg.length+')</summary>'+allg.map(d=>naMerkFeld(d, false)).join('')+'</details>';
  const stand = (k ? k.label : 'keine')+(diff.length ? ' · ★ '+diff.filter(voll).length+'/'+diff.length : '');
  return naAb('kat', 'Kategorie und Merkmale', stand, h, !!o.kategorie);
}
function naAbSteril(){
  const o = NA_ENTWURF.obj; const defs = naKat().merkmale || []; const m = o.merkmale || {};
  const felder = NA_STERIL_IDS.map(id=>defs.find(d=>d.id===id)).filter(Boolean);
  if(!felder.length) return '';
  const t = []; if(m.steril) t.push(m.steril); if(m.einmalgebrauch===true || m.einmalgebrauch==='ja') t.push('Einmalprodukt'); if(m.latex) t.push(m.latex);
  return naAb('steril', 'Steril · Einmal · Latex', t.join(' · ') || '—', felder.map(d=>naMerkFeld(d, false)).join(''));
}
function naPackChipHtml(){
  const o = NA_ENTWURF.obj; const n = naMengeZahl(o.packung);
  return (n && n>1 && +((o.preis||{}).bezugsmenge||1)!==n) ? '<button class="na-chip" data-na="preisPackung">Der Preis gilt für die ganze Packung ('+esc(String(n))+' Stück)</button>' : '';
}
function naAbPackung(){
  const o = NA_ENTWURF.obj; const sp = naStueckpreis(o.preis);
  const t = []; if(o.packung) t.push(o.packung+(naMengeZahl(o.packung) ? ' Stück' : '')); if(sp!=null) t.push(naEuro(sp)+' je Stück');
  return naAb('pack', 'Packung und Preis', t.join(' · ') || '—',
    naF('Packungsgröße (Stück je Packung)', naT('packung',{ ph:'z. B. 50', extra:' inputmode="numeric"' }), 'Nur zur Auskunft — die App führt keinen Bestand und bestellt nichts.')
    + naPreisFelder() + '<div id="naPackChip" style="margin-top:6px">'+naPackChipHtml()+'</div><div class="na-dim" style="margin-top:6px">Preise sieht nur die Verwaltung (Sachkostenüberblick).</div>');
}
function naPznStand(p){ p = String(p||'').trim(); if(!p) return 'Pharmazentralnummer, falls auf der Packung (7 oder 8 Ziffern).'; return naPznOk(p) ? '<span class="na-ok">✓ Prüfziffer stimmt</span>' : '<span class="na-falsch">✗ Prüfziffer stimmt nicht.</span>'; }
function naAbVerwendung(){
  const o = NA_ENTWURF.obj; const n = [o.verwendung, o.suchwoerter, o.pzn].filter(x=>String(x||'').trim()).length;
  return naAb('verw', 'Verwendung · Suchwörter · PZN', n ? n+' von 3' : '—',
    naF('Verwendung', '<textarea data-na-ein="entw" data-f="verwendung" placeholder="wofür es im Labor gebraucht wird">'+esc(o.verwendung||'')+'</textarea>')
    + naF('Suchwörter', naT('suchwoerter',{ ph:'z. B. Dreiwegehahn, 3-Wege-Hahn, Hahnbank' }), 'Andere Wörter, unter denen man es sucht — mit Komma getrennt.')
    + naF('PZN', naT('pzn',{ mono:true, extra:' inputmode="numeric"' }), '<span id="naPznStand">'+naPznStand(o.pzn)+'</span>'));
}
function naAbSonst(){
  const o = NA_ENTWURF.obj; const t = []; if(o.bereich) t.push(naListeName('bereiche', o.bereich)); if(String(o.notiz||'').trim()) t.push('Notiz');
  return naAb('sonst', 'Bereich · Notiz', t.join(' · ') || '—',
    naF('Bereich (Vorgabe für die Rüstliste)', naW('bereich','bereiche',{ ph:'— keiner —' }))
    + naF('Notiz', '<textarea data-na-ein="entw" data-f="notiz">'+esc(o.notiz||'')+'</textarea>'));
}

/* ── Eingaben ── */
let naGtinZeit = null;
naEin('entw', (v, d)=>{
  const E = NA_ENTWURF; if(!E) return;
  naWertSetzen(E.obj, d.f, v);
  if(E.typ!=='material'){ if(d.f.indexOf('preis.')===0){ const s = $('naStueckpreis'); if(s) s.textContent = naEuro(naStueckpreis(E.obj.preis)); } return; }
  if(d.f==='gtin'){
    const s = $('naGtinStand'); if(s) s.innerHTML = naGtinStand(v); const h = $('naHerstVor'); if(h) h.innerHTML = naHerstVorHtml(E.obj);
    /* Ein Handscanner „tippt" den ganzen Code — erst auswerten, wenn er fertig ist. */
    if(naGtinZeit) clearTimeout(naGtinZeit);
    const roh = String(v).trim();
    if(roh && !/^\d{0,14}$/.test(roh)) naGtinZeit = setTimeout(()=>{
      if(NA_ENTWURF!==E || String(E.obj.gtin).trim()!==roh) return;
      const sc = naParseScan(roh);
      if(sc.kind!=='gs1' || !naGtinPruefziffer(sc.gtin)) return;
      E.obj.gtin = sc.gtin; if(sc.itemRef && !E.obj.ref) E.obj.ref = sc.itemRef;
      naOcrStand('Scanner-Text erkannt: GTIN'+(sc.itemRef ? ' und REF' : '')+' übernommen. Charge und Verfall werden nie gespeichert.'); naFormNeu();
    }, 400);
  }
  if(d.f==='name' || d.f==='handelsname'){
    if(d.f==='name'){ const n = $('naNameVor'); if(n) n.innerHTML = naNameVorHtml(); }
    if(naKatAuto(E)){ const w = $('naAbKatW'); if(w) w.innerHTML = naAbKategorie(); const z = $('naKatZeile'); if(z) z.innerHTML = naKatZeileHtml(); }
  }
  if(d.f.indexOf('merkmale.')===0){ const f = naFelder(naKat(), E.obj.kategorie); const mid = d.f.slice(9);
    if(f.diff.concat(f.weitere).some(x=>x.id===mid)) E.katAuto = null;   /* wer Felder der Kategorie füllt, hat sie angenommen */
    const n = $('naNameVor'); if(n) n.innerHTML = naNameVorHtml(); }
  if(d.f.indexOf('preis.')===0 || d.f==='packung'){ const s = $('naStueckpreis'); if(s) s.textContent = naEuro(naStueckpreis(E.obj.preis)); const c = $('naPackChip'); if(c) c.innerHTML = naPackChipHtml(); }
  if(d.f==='pzn'){ const s = $('naPznStand'); if(s) s.innerHTML = naPznStand(v); }
  const z = $('naFehltZeile'); if(z) z.innerHTML = naFehltHtml();
});
naEin('entwHaken', (v, d)=>{ if(NA_ENTWURF) naWertSetzen(NA_ENTWURF.obj, d.f, v ? true : ''); });
/* Neu zeichnen, ohne den Menschen zu stören: Rollstand UND das Feld, in dem
   gerade getippt wird, bleiben (die Register-Antwort kommt, während man schon
   den Namen schreibt). */
function naFormNeu(){
  const y = window.scrollY; const a = document.activeElement;
  const ein = a && a.getAttribute ? a.getAttribute('data-na-ein') : null; const f = ein ? a.getAttribute('data-f') : null;
  let von = null, bis = null; if(f){ try{ von = a.selectionStart; bis = a.selectionEnd; }catch(e){} }
  naZeigen(); window.scrollTo(0, y);
  if(!f) return;
  const n = Array.from(document.querySelectorAll('#naMain [data-na-ein="'+ein+'"]')).find(x=>x.getAttribute('data-f')===f);
  if(n){ try{ n.focus({ preventScroll:true }); if(von!=null) n.setSelectionRange(von, bis); }catch(e){} }
}
naAkt('entwWahl', async d=>{
  if(!NA_ENTWURF) return;
  const E = NA_ENTWURF; const T = NA_TYPEN[E.typ];
  if(d.liste==='kategorien'){ await naKategorieWaehlen(E); return; }
  const w = await naAuswahl({ titel: naListeWort(d.liste), liste:d.liste, gewaehlt: naWert(E.obj, d.f), neu:true, wo: T.wort+': '+(E.obj.name||'neu'), leer: '— keine Angabe —' });
  if(w==null || NA_ENTWURF!==E) return;
  naWertSetzen(E.obj, d.f, w);
  if(d.f==='kategorie') E.katAuto = null;
  if(d.f==='lagerort' && w) store.set('nalokal_lagerort', w);
  naFormNeu();
});
naAkt('lagerortZuletzt', d=>{ if(!NA_ENTWURF) return; NA_ENTWURF.obj.lagerort = d.id; naFormNeu(); });
naAkt('katNehmen', d=>{ if(!NA_ENTWURF) return; NA_ENTWURF.obj.kategorie = d.id; NA_ENTWURF.katAuto = null; NA_ENTWURF.offen.kat = true; naFormNeu(); });
/* Ein auf dem Etikett gelesener Hersteller, der noch nicht in der Liste steht:
   erst nach ähnlichen Einträgen suchen (Kurzname, amtlicher Name), sonst anlegen. */
naAkt('herstellerAusEtikett', ()=>{ const E = NA_ENTWURF; if(!E || !E.ocr || !E.ocr.herstellerNeu) return;
  const id = naHerstellerAusRegister({ name:E.ocr.herstellerNeu }); if(!id) return;
  E.obj.hersteller = id; E.ocr.herstellerNeu = ''; toast('Hersteller: '+naListeName('hersteller', id)); naFormNeu(); });
naAkt('herstellerNehmen', d=>{ if(!NA_ENTWURF) return; NA_ENTWURF.obj.hersteller = d.id; naFormNeu(); });
naAkt('refNehmen', d=>{ if(!NA_ENTWURF) return; NA_ENTWURF.obj.ref = d.ref; if(NA_ENTWURF.ocr) NA_ENTWURF.ocr.refVorschlaege = []; naFormNeu(); });
naAkt('nameNehmen', d=>{ const E = NA_ENTWURF; if(!E) return; E.obj.name = d.n; naKatAuto(E); naFormNeu(); });
naAkt('nameVorschlag', ()=>{
  const o = NA_ENTWURF && NA_ENTWURF.obj; if(!o) return;
  const kat = naKat(); const k = kat.klassen.find(x=>x.id===o.kategorie); const f = naFelder(kat, o.kategorie);
  const v = naNameVorschlag(k ? k.label : '', f.diff, o.merkmale);
  if(!v){ toast('Erst Kategorie und ★-Merkmale ausfüllen.', true); return; }
  o.name = v; naFormNeu();
});
naAkt('preisPackung', ()=>{ const E = NA_ENTWURF; if(!E) return; const n = naMengeZahl(E.obj.packung); if(!n) return;
  E.obj.preis = E.obj.preis || { betrag:'' }; E.obj.preis.bezugsmenge = n; naFormNeu(); });
naAkt('merkWahl', async d=>{
  const E = NA_ENTWURF; if(!E) return;
  const def = (naKat().merkmale||[]).find(x=>x.id===d.mid); if(!def) return;
  const items = (def.werte||[]).map(w=>({ id:w, name:w }));
  const w = await naAuswahl({ titel:def.label, items, gewaehlt:(E.obj.merkmale||{})[d.mid], neu:true, leer:'— leer —',
    anlegen: name=>{ const tpl = JSON.parse(JSON.stringify(naKatTpl())); tpl.werte = tpl.werte || {};
      tpl.werte[d.mid] = (tpl.werte[d.mid]||[]).concat([name]); naKatTplSpeichern(tpl, 'Wert „'+name+'" bei „'+def.label+'" angelegt'); return name; } });
  if(w==null || NA_ENTWURF!==E) return;
  E.obj.merkmale = E.obj.merkmale || {}; E.obj.merkmale[d.mid] = w;
  if(NA_STERIL_IDS.indexOf(d.mid)<0) E.katAuto = null;
  naFormNeu();
});
/* ── Kategorie wählen oder anlegen ──
   Eine neue Kategorie kann mit den Merkmalen einer vorhandenen beginnen
   („EPU-Kabel" wie „Kabel") — als Kopie, danach unabhängig. */
async function naKategorieAnlegen(name, wo, vonVorschlag){
  const kat = naKat();
  const items = kat.klassen.filter(k=>k.id!=='allgemein' && !k.archiviert).map(k=>{ const f = naFelder(kat, k.id);
    return { id:k.id, name:k.label, sub: (f.diff.length+f.weitere.length)+' Merkmale'+(f.diff.length ? ' · ★ '+f.diff.map(d=>d.label).slice(0,3).join(', ') : '') }; });
  const nah = naAehnliche(name, items).map(t=>t.item.id);
  items.sort((a,b)=>((a.id===vonVorschlag?0:1)-(b.id===vonVorschlag?0:1)) || ((nah.indexOf(a.id)<0?1:0)-(nah.indexOf(b.id)<0?1:0)));
  const von = await naAuswahl({ titel:'„'+name+'": Merkmale übernehmen von …', items, leer:'— leer beginnen —' });
  if(von==null) return null;
  const id = naListeNeu('kategorien', name, wo); if(!id) return null;
  if(von){ const k = kat.klassen.find(x=>x.id===von);
    naKatTplSpeichern(naTplKategorieWie(naKatTpl(), naKat(), id, von), 'Kategorie „'+name+'" mit den Merkmalen von „'+(k ? k.label : von)+'"'); }
  return id;
}
async function naKategorieWaehlen(E){
  const w = await naAuswahl({ titel:'Kategorie', liste:'kategorien', gewaehlt:E.obj.kategorie, neu:true, wo:'Material: '+(E.obj.name||'neu'),
    anlegen: name=>{ naSheetZu({ neu:name }); return null; } });
  if(w==null || w==='' || NA_ENTWURF!==E) return;
  let id = w;
  if(typeof w==='object'){ id = await naKategorieAnlegen(w.neu, 'Material: '+(E.obj.name||'neu'), E.obj.kategorie); if(!id || NA_ENTWURF!==E) return; toast('Kategorie „'+w.neu+'" angelegt'); }
  E.obj.kategorie = id; E.katAuto = null; E.offen.kat = true; naFormNeu();
}
naAkt('katAendern', async ()=>{ const E = NA_ENTWURF; if(E && E.typ==='material') await naKategorieWaehlen(E); });

/* ── Merkmal suchen, anlegen, zuordnen ──
   EIN Knopf in der Maske, DAS Auswahlfeld der App: Es durchsucht alle
   Merkmale — auch über Suchwörter („Resterilisation" findet „Zulässige
   Wiederverwendungen") — und legt Fehlendes an Ort und Stelle an. Danach
   fragt die Maske einmal, für wen das Merkmal gilt. So lernt die App, welche
   Kategorie welche Merkmale braucht: durch eine Entscheidung, nie still. */
function naMerkmalItems(kat, klasseId, ohneIds){
  const kl = {}; kat.klassen.forEach(k=>{ kl[k.id] = k.label; });
  return (kat.merkmale||[]).filter(d=>!d.archiviert && (ohneIds||[]).indexOf(d.id)<0).map(d=>{ const ks = (d.klassen||[]);
    const andere = ks.filter(x=>x!=='allgemein' && x!==klasseId).map(x=>kl[x]||x);
    const wo = ks.indexOf(klasseId)>=0 && klasseId ? 'gehört zu dieser Kategorie' : (ks.indexOf('allgemein')>=0 ? 'für alle Kategorien' : (andere.length ? 'bei: '+andere.slice(0,3).join(', ')+(andere.length>3 ? ' …' : '') : 'noch keiner Kategorie zugeordnet'));
    return { id:d.id, name:d.label+(d.einheit && d.typ!=='ja_nein' && String(d.label).indexOf('('+d.einheit+')')<0 ? ' ('+d.einheit+')' : ''), sub:wo, such:naMerkmalSuchtext(d) }; })
    .sort((a,b)=>a.name.localeCompare(b.name, 'de', { sensitivity:'base' }));
}
/* Neues Merkmal: nur der Name und die Art. Liefert die Kennung oder null. */
async function naMerkmalAnlegen(label){
  label = String(label||'').trim(); if(!label) return null;
  const typ = await naSheetAuf('<div class="sheet-title">Neues Merkmal</div><div class="sheet-name">'+esc(label)+'</div>'
    + '<button class="sheet-act" data-na="sheetWert" data-wert="text"><span class="sa-ico">✎</span><span>Text<span class="sa-sub">z. B. Kurvenform, Farbe</span></span></button>'
    + '<button class="sheet-act" data-na="sheetWert" data-wert="zahl"><span class="sa-ico">#</span><span>Zahl<span class="sa-sub">z. B. Anzahl, Zyklen, Länge — die Einheit lässt sich danach im Listen-Verzeichnis unter „Merkmale" eintragen</span></span></button>'
    + '<button class="sheet-act" data-na="sheetWert" data-wert="liste"><span class="sa-ico">☰</span><span>Auswahl<span class="sa-sub">feste Werte zum Antippen — neue Werte lassen sich beim Ausfüllen anlegen</span></span></button>'
    + '<button class="sheet-act" data-na="sheetWert" data-wert="ja_nein"><span class="sa-ico">☑</span><span>Ja / Nein<span class="sa-sub">ein Häkchen</span></span></button>'
    + '<button class="btn btn-sec" style="width:100%" data-na="sheetZu">Abbrechen</button>');
  if(!typ) return null;
  const tpl = JSON.parse(JSON.stringify(naKatTpl())); tpl.merkmale = tpl.merkmale || {};
  const mid = 'm_'+naNorm(label).replace(/\s+/g,'_').slice(0,20)+'_'+naId('').slice(-4);
  tpl.merkmale[mid] = { label, typ, angelegt:naJetzt() };
  naKatTplSpeichern(tpl, 'Merkmal „'+label+'" angelegt');
  return mid;
}
/* „Gilt für …" — liefert 'einzel' · 'weiter' · 'kern' oder null (abgebrochen). */
function naMerkmalGiltFragen(d, k){
  const n = naAlle('material').filter(m=>m.kategorie===k.id).length;
  return naSheetAuf('<div class="sheet-title">Gilt für …</div><div class="sheet-name">'+esc(d.label)+'</div>'
    + '<button class="sheet-act" data-na="sheetWert" data-wert="einzel"><span class="sa-ico">1</span><span>nur dieses Material</span></button>'
    + '<button class="sheet-act" data-na="sheetWert" data-wert="weiter"><span class="sa-ico">▤</span><span>alle „'+esc(k.label)+'"<span class="sa-sub">erscheint künftig in jeder Maske dieser Kategorie'+(n ? ' ('+n+' Material'+(n===1?'':'ien')+')' : '')+' — darf leer bleiben</span></span></button>'
    + '<button class="sheet-act" data-na="sheetWert" data-wert="kern"><span class="sa-ico">★</span><span>alle „'+esc(k.label)+'", als Kern-Merkmal<span class="sa-sub">steht oben in der Maske und geht in den Namensvorschlag ein</span></span></button>'
    + '<div class="na-dim">Lässt sich jederzeit ändern: Mehr → Listen-Verzeichnis → Material-Kategorien.</div>');
}
function naMerkmalZeigen(mid){
  /* Nie den Cursor hinter ein offenes Blatt setzen: Wer inzwischen ein
     Auswahlfeld geöffnet hat, tippt sonst in das Feld darunter. */
  setTimeout(()=>{ if(naSheetOffen()) return; const f = Array.from(document.querySelectorAll('#naMain [data-f], #naMain [data-mid]')).find(x=>x.getAttribute('data-f')==='merkmale.'+mid || (x.getAttribute('data-na')==='merkWahl' && x.getAttribute('data-mid')===mid));
    if(f){ try{ f.scrollIntoView({ block:'center' }); f.focus({ preventScroll:true }); }catch(e){} } }, 60);
}
function naMerkmalKategorieSetzen(klasseId, mid, stufe){
  const kat = naKat(); const d = kat.merkmale.find(x=>x.id===mid) || { label:mid }; const k = kat.klassen.find(x=>x.id===klasseId) || { label:klasseId };
  naKatTplSpeichern(naTplZuordnen(naKatTpl(), NA_MERKQUELLE, klasseId, mid, stufe),
    stufe==='aus' ? 'Merkmal „'+d.label+'" aus der Kategorie „'+k.label+'" entfernt' : 'Merkmal „'+d.label+'" → Kategorie „'+k.label+'"'+(stufe==='kern' ? ' (Kern ★)' : ''));
}
async function naMerkmalInMaske(E, mid){
  if(NA_STERIL_IDS.indexOf(mid)>=0){ E.offen.steril = true; naFormNeu(); naMerkmalZeigen(mid); toast('Steht unter „Steril · Einmal · Latex".'); return; }
  if(mid==='stueck_packung'){ E.offen.pack = true; naFormNeu(); toast('Steht unter „Packung und Preis" als Packungsgröße.'); return; }
  const kat = naKat(); const d = kat.merkmale.find(x=>x.id===mid); if(!d) return;
  const k = kat.klassen.find(x=>x.id===E.obj.kategorie); const f = naFelder(kat, E.obj.kategorie);
  E.offen.kat = true;
  if(f.diff.concat(f.weitere).some(x=>x.id===mid)){ E.offen.weit = true; naFormNeu(); naMerkmalZeigen(mid); return; }
  let stufe = 'einzel';
  if(k){ stufe = await naMerkmalGiltFragen(d, k); if(!stufe || NA_ENTWURF!==E) return; }
  if(stufe==='einzel') E.einzel = (E.einzel||[]).filter(x=>x!==mid).concat([mid]);
  else { naMerkmalKategorieSetzen(k.id, mid, stufe); E.einzel = (E.einzel||[]).filter(x=>x!==mid); E.katAuto = null; E.offen.weit = true;
    toast('„'+d.label+'" gilt jetzt für alle „'+k.label+'"'+(stufe==='kern' ? ' (Kern ★)' : '')+'.'); }
  naFormNeu(); naMerkmalZeigen(mid);
}
naAkt('merkSuchen', async ()=>{
  const E = NA_ENTWURF; if(!E || E.typ!=='material') return;
  const w = await naAuswahl({ titel:'Merkmal suchen', items:naMerkmalItems(naKat(), E.obj.kategorie), neu:true, wo:'Material-Maske',
    anlegen: name=>{ naSheetZu({ neu:name }); return null; } });
  if(!w || NA_ENTWURF!==E) return;
  let mid = w;
  if(typeof w==='object'){ mid = await naMerkmalAnlegen(w.neu); if(!mid || NA_ENTWURF!==E) return; }
  await naMerkmalInMaske(E, mid);
});
naAkt('merkGilt', async d=>{
  const E = NA_ENTWURF; if(!E || !E.obj.kategorie) return;
  const kat = naKat(); const def = kat.merkmale.find(x=>x.id===d.mid); const k = kat.klassen.find(x=>x.id===E.obj.kategorie); if(!def || !k) return;
  const stufe = await naMerkmalGiltFragen(def, k); if(!stufe || stufe==='einzel' || NA_ENTWURF!==E) return;
  naMerkmalKategorieSetzen(k.id, d.mid, stufe); E.einzel = (E.einzel||[]).filter(x=>x!==d.mid); E.katAuto = null;
  toast('„'+def.label+'" gilt jetzt für alle „'+k.label+'"'+(stufe==='kern' ? ' (Kern ★)' : '')+'.'); naFormNeu(); naMerkmalZeigen(d.mid);
});
naAkt('merkVorschlagNehmen', d=>{ const E = NA_ENTWURF; if(!E || !E.obj.kategorie) return;
  naMerkmalKategorieSetzen(E.obj.kategorie, d.mid, 'weiter'); E.katAuto = null; E.offen.weit = true; toast('Für die Kategorie übernommen'); naFormNeu(); naMerkmalZeigen(d.mid); });
naAkt('merkVorschlagStumm', d=>{ const E = NA_ENTWURF; if(!E || !E.obj.kategorie) return;
  naKatTplSpeichern(naTplStumm(naKatTpl(), E.obj.kategorie, d.mid), 'Vorschlag abgestellt'); naFormNeu(); });
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

/* ── Erkennen: Barcode → GTIN → Register ──
   Der Barcode trägt die GTIN fehlerfrei; mit ihr kennt das EU-Register
   Hersteller, Handelsname und REF. Übernommen wird nur in LEERE Felder. */
function naOcrStand(t){ if(NA_ENTWURF){ NA_ENTWURF.ocr = Object.assign(NA_ENTWURF.ocr||{}, { stand:t }); } const s = $('naOcrStand'); if(s) s.textContent = t; }
/* Scannen (live) oder Foto — liefert { gtin, itemRef } oder null. `stand`
   bekommt die Zwischenmeldungen. Gemeinsam für Maske und Kurzerfassung. */
async function naBarcodeHolen(stand){
  let erg = await naBarcodeScannen();
  if(!erg) return null;
  if(erg.foto){
    const f = await naDateiWaehlen(); if(!f) return null;
    stand('Der Barcode wird im Foto gesucht …');
    try{ erg = await naBarcodeAusBild(await naDateiAlsDataUrl(f)); }
    catch(e){ stand('Foto nicht lesbar: '+e.message); return null; }
    if(!erg || !erg.gtin){ stand(erg && erg.roh ? 'Code gelesen, aber darin steht keine GTIN. Bitte den Code mit „(01)" oder den Strichcode aufnehmen.' : 'Kein Barcode im Foto gefunden — näher heran, gerade und ohne Spiegelung. Oder die GTIN eintippen.'); return null; }
  }
  return erg.gtin ? erg : null;
}
/* ── Registerdaten nachholen (für alle, auf einmal) ──
   Für Materialien mit gültiger GTIN, aber ohne Registerdaten — etwa weil das
   Register beim Erfassen nicht antwortete. Füllt wie die Maske NUR leere
   Felder; die Angaben bleiben „noch nicht bestätigt", bis jemand den Eintrag
   in der Maske speichert (A5). Langsam genug für die Drosselung von EUDAMED. */
let NA_NACHHOLEN = null;
function naRegisterOffen(){
  if(!naAdmin() || !naEinstellung('register', true)) return [];
  return naAlle('material').filter(m=>m.gtin && naGtinPruefziffer(m.gtin) && !(m.register && m.register.quelle));
}
naAkt('registerNachholen', async ()=>{
  if(NA_NACHHOLEN){ toast('Läuft schon: '+NA_NACHHOLEN.fertig+' von '+NA_NACHHOLEN.n); return; }
  const liste = naRegisterOffen(); if(!liste.length) return;
  const ok = await naFrage(liste.length+' Material(ien) im EU-Register nachschlagen?', { ja:'Nachschlagen',
    mehr:'Gefüllt werden nur leere Felder (Hersteller, Handelsname, REF, steril, Latex, Einmal, Kategorie). Die Angaben gelten als „noch nicht bestätigt", bis der Eintrag in der Maske gespeichert wird. Dauer: etwa '+Math.max(1, Math.round(liste.length*5/60))+' Minute(n) — die App bleibt bedienbar.' });
  if(!ok) return;
  const L = NA_NACHHOLEN = { n:liste.length, fertig:0, treffer:0, felder:0, aus:0, vorgemerkt:0 };
  const neuZeichnen = ()=>{ if(!NA_BEARBEITUNG && !naSheetOffen() && /^#\/material\/?$/.test(location.hash)){ const y = window.scrollY; naZeigen(); window.scrollTo(0, y); } };
  neuZeichnen();
  let fehlerFolge = 0;
  for(const alt of liste){
    if(NA_ENTWURF && NA_ENTWURF.obj.id===alt.id){ L.fertig++; continue; }   /* gerade in Bearbeitung: nicht dazwischenfunken */
    const r = await naRegisterFragen(naGtinKey(alt.gtin));
    L.fertig++;
    const m = naHole('material', alt.id);
    if(r.status==='treffer' && m && !(NA_ENTWURF && NA_ENTWURF.obj.id===m.id)){
      const o = JSON.parse(JSON.stringify(m)); const neu = [];
      if(r.treffer.hersteller && r.treffer.hersteller.name && !o.hersteller){ const id = naHerstellerAusRegister(r.treffer.hersteller); if(id){ o.hersteller = id; neu.push('Hersteller'); } }
      naRegisterAnwenden(o, r.treffer).forEach(x=>neu.push(x)); o.register.gtin = naGtinKey(o.gtin);
      if(!o.kategorie){ const v = naKatVorschlagFuer(o); if(v){ o.kategorie = v.id; neu.push('Kategorie'); } }
      naSpeichern('material', o, 'aus dem Register ergänzt'+(neu.length ? ': '+neu.join(', ') : ''));
      L.treffer++; L.felder += neu.length; fehlerFolge = 0;
    } else if(r.status==='fehler' || r.status==='aus'){ L.aus++;
      /* Fragt der Server von selbst weiter, lohnt es, ihm ALLE GTINs zu nennen — der nächste Tipp findet sie dann fertig vor. */
      if(r.nachfassen){ L.vorgemerkt++; fehlerFolge = 0; }
      else if(++fehlerFolge>=2 || r.status==='aus') break; }
    else fehlerFolge = 0;
    neuZeichnen();
    if(!r.ausCache && L.fertig<L.n) await new Promise(ok=>setTimeout(ok, 4500));   /* ≤ 15 je Minute */
  }
  NA_NACHHOLEN = null;
  toast('Register: '+L.treffer+' von '+L.n+' gefunden, '+L.felder+' Angaben ergänzt'+(L.aus ? ' — das Register antwortet gerade nicht. '+(L.vorgemerkt ? 'Der Server fragt von selbst weiter; später noch einmal antippen (Stand: Einstellungen → EU-Register)' : 'Später noch einmal versuchen') : '')+'.', !!L.aus);
  neuZeichnen();
});
async function naRegisterFragen(gtin){
  let zeit = null;
  try{
    const ctl = (typeof AbortController==='function') ? new AbortController() : null;
    if(ctl) zeit = setTimeout(()=>ctl.abort(), 35000);   /* Server: EUDAMED bis 20 s, dann GUDID bis 8 s */
    const r = await fetch('/api/register?gtin='+encodeURIComponent(gtin), { cache:'no-store', signal: ctl ? ctl.signal : undefined });
    if(r.status===503) return { status:'aus' };
    if(!r.ok) return { status:'fehler' };
    const j = await r.json();
    if(j && j.treffer) return { status:'treffer', treffer:j.treffer, ausCache:!!j.ausCache, veraltet:!!j.veraltet };
    return { status: (j && j.fehler) ? 'fehler' : 'nichts', ausCache:!!(j && j.ausCache), nachfassen:!!(j && j.nachfassen) };
  }catch(e){ return { status:'fehler' }; }
  finally{ if(zeit) clearTimeout(zeit); }
}
/* Fragt das Register zur GTIN in o und trägt den Treffer ein. `gueltig`
   prüft nach der Wartezeit, ob die Antwort noch gebraucht wird (null = nein). */
async function naRegisterFuellen(o, gueltig){
  const g = naGtinKey(o.gtin); const r = await naRegisterFragen(g);
  if(gueltig && !gueltig()) return null;
  r.neu = [];
  if(r.status==='treffer'){ const t = r.treffer;
    if(t.hersteller && t.hersteller.name && !o.hersteller){ const id = naHerstellerAusRegister(t.hersteller); if(id){ o.hersteller = id; r.neu.push('Hersteller'); } }
    r.neu = r.neu.concat(naRegisterAnwenden(o, t)); o.register.gtin = g; }
  return r;
}
function naRegisterText(r){
  if(r.status==='treffer') return 'Aus '+naRegisterQuelle(r.treffer.quelle)+' übernommen: '+(r.neu.length ? r.neu.join(', ') : 'nichts Neues — alles war schon eingetragen')+'. Bitte prüfen; mit dem Speichern gilt es als bestätigt.';
  if(r.status==='nichts') return 'GTIN übernommen. Im EU-Register (EUDAMED) und in der US-Datenbank (GUDID) steht dazu nichts — bitte von Hand eintragen.';
  if(r.status==='aus') return 'GTIN übernommen. Die Register-Abfrage ist auf dem Server abgeschaltet.';
  if(r.nachfassen) return 'GTIN übernommen. Das EU-Register antwortet gerade nicht — das liegt am Register, nicht an der App. Der Server fragt von selbst weiter; ruhig ohne diese Angaben speichern und später im Material-Verzeichnis „↻ Aus dem Register ergänzen" antippen.';
  return 'GTIN übernommen. Das Register ist gerade nicht erreichbar — später bei der GTIN „Im EU-Register nachsehen" antippen oder von Hand eintragen.';
}
async function naMaskeRegister(E){
  const g = naGtinKey(E.obj.gtin);
  if(!g || !naGtinPruefziffer(E.obj.gtin)) return;
  if(!naEinstellung('register', true)){ naOcrStand('GTIN übernommen. Die Register-Abfrage ist in den Einstellungen abgeschaltet.'); return; }
  naOcrStand('GTIN gelesen — das EU-Register wird gefragt (meist 2–10 Sekunden; weitertippen geht) …');
  const r = await naRegisterFuellen(E.obj, ()=>NA_ENTWURF===E && naGtinKey(E.obj.gtin)===g);
  if(!r) return;
  naKatAuto(E);
  naOcrStand(naRegisterText(r)); naFormNeu();
}
/* Eine gelesene GTIN in die Maske: Gibt es sie schon, führt der Weg dorthin. */
async function naMaskeGtin(E, gtin, itemRef){
  const o = E.obj; const d = naGtinDoppelt(gtin, o.id);
  if(d){
    const z = NA_RUECKSPRUNG;
    const ok = await naFrage('Diese GTIN gehört schon zu „'+d.name+'".', { ja: z ? 'Diesen Eintrag nehmen' : 'Diesen Eintrag öffnen', nein:'Hier bleiben', mehr:'Eine GTIN gibt es genau einmal — das Material ist schon angelegt.' });
    if(!ok || NA_ENTWURF!==E) return;
    NA_ENTWURF = null; NA_RUECKSPRUNG = null;
    if(z && z.fertig) z.fertig({ typ:'material', id:d.id }); else naGeh('#/material/'+d.id);
    return;
  }
  o.gtin = gtin; if(itemRef && !o.ref) o.ref = itemRef;
  naOcrStand('GTIN gelesen'+(itemRef ? ' (mit REF)' : '')+'.'); naFormNeu();
  await naMaskeRegister(E);
}
naAkt('scan', async ()=>{
  const E = NA_ENTWURF; if(!E || E.typ!=='material') return;
  const erg = await naBarcodeHolen(naOcrStand);
  if(!erg || NA_ENTWURF!==E) return;
  await naMaskeGtin(E, erg.gtin, erg.itemRef);
});
naAkt('registerHolen', async ()=>{ const E = NA_ENTWURF; if(E && E.typ==='material') await naMaskeRegister(E); });
naAkt('registerHersteller', ()=>{ const E = NA_ENTWURF; if(!E || !E.obj.register || !E.obj.register.hersteller) return;
  const id = naHerstellerAusRegister({ name:E.obj.register.hersteller, srn:E.obj.register.srn }); if(id){ E.obj.hersteller = id; naFormNeu(); } });

/* ── Etikett lesen (ocr.js + merkmale.js aus der alten App, unverändert) ──
   Erst der Barcode im Foto (sicher), dann die Texterkennung (für REF und
   Merkmale, wenn kein Barcode da ist oder das Register nichts weiß). */
function naEtikettUebernehmen(E, erg){
  const o = E.obj; const neu = [];
  const gtin = erg.gtin || '';
  if(gtin && !o.gtin && naGtinPruefziffer(gtin) && !naGtinDoppelt(gtin, o.id)){ o.gtin = gtin; neu.push('GTIN'); }
  const f = erg.fields || {};
  if(f.ref && !o.ref){ o.ref = f.ref; neu.push('REF'); }
  E.ocr = Object.assign(E.ocr||{}, { refVorschlaege: (!o.ref && erg.refInfo && erg.refInfo.vorschlaege) ? erg.refInfo.vorschlaege.slice(0,4) : [] });
  if(!o.hersteller){
    /* Erst die Herstellerliste des Hauses im ganzen Text suchen (Fertigungsort,
       Vertrieb und Bevollmächtigte zählen nicht) — kern.js naHerstellerImText. */
    const h = naHerstellerImText(erg.text || '', naListe('hersteller', true));
    if(h && h.id){ o.hersteller = h.id; neu.push('Hersteller'); }
    else if(h && h.name) E.ocr.herstellerNeu = h.name;
    else if(f.hersteller){
      const tr = naAehnliche(f.hersteller, naListe('hersteller'));
      const g = tr.find(t=>t.grad==='gleich') || tr[0];
      if(g){ o.hersteller = g.item.id; neu.push('Hersteller'); }
      else E.ocr.herstellerNeu = f.hersteller;
    }
  }
  if(erg.text && typeof merkSammeln==='function'){
    const m = merkSammeln(erg.text, o.ref || f.ref || '', naKat(), o.kategorie);
    o.merkmale = o.merkmale || {};
    const archiv = {}; naKat().merkmale.forEach(d=>{ if(d.archiviert) archiv[d.id] = 1; });   /* archiviert = wird auch nicht mehr vom Etikett gefüllt */
    (m.merkmale||[]).filter(x=>!archiv[x.id]).forEach(x=>{
      if(x.id==='stueck_packung'){ if(!o.packung && x.wert!=null && x.wert!==''){ o.packung = String(x.wert); neu.push('Packungsgröße'); } return; }
      if(o.merkmale[x.id]==null || o.merkmale[x.id]===''){ o.merkmale[x.id] = x.wert; neu.push(x.kurz||x.label||x.id); } });
  }
  return neu;
}
naAkt('etikett', async ()=>{
  const E = NA_ENTWURF; if(!E) return;
  const f = await naDateiWaehlen(); if(!f) return;
  const url = await naDateiAlsDataUrl(f);
  naOcrStand('Etikett wird gelesen … (das dauert einige Sekunden)');
  const teile = []; let hinweis = '';
  if(!E.obj.gtin){
    try{
      const b = await naBarcodeAusBild(url); if(NA_ENTWURF!==E) return;
      const d = b && b.gtin ? naGtinDoppelt(b.gtin, E.obj.id) : null;
      if(d) hinweis = ' Achtung: Die GTIN im Barcode gehört schon zu „'+d.name+'".';
      else if(b && b.gtin){
        E.obj.gtin = b.gtin; teile.push('GTIN'); if(b.itemRef && !E.obj.ref){ E.obj.ref = b.itemRef; teile.push('REF'); }
        if(naEinstellung('register', true)){
          naOcrStand('Barcode gelesen — das EU-Register wird gefragt …');
          const r = await naRegisterFuellen(E.obj, ()=>NA_ENTWURF===E); if(!r) return;
          r.neu.forEach(x=>teile.push(x));
          if(r.status==='treffer') hinweis += ' Quelle: '+naRegisterQuelle(r.treffer.quelle)+'.';
        }
      }
    }catch(e){ /* ohne Barcode weiter mit der Texterkennung */ }
  }
  try{
    naOcrStand('Etikett wird gelesen … Text');
    const foto = await ocrLeseFotoEinzeln(url, t=>naOcrStand('Etikett wird gelesen … '+t));
    const erg = ocrZusammenfuehren([foto]);
    if(NA_ENTWURF!==E) return;
    naEtikettUebernehmen(E, erg).forEach(x=>{ if(teile.indexOf(x)<0) teile.push(x); });
  }catch(e){ hinweis += ' Texterkennung fehlgeschlagen: '+e.message; }
  if(NA_ENTWURF!==E) return;
  /* Das Etikettfoto bleibt als Bild erhalten — mit der Rolle „Etikett", damit
     es nicht von allein zum Anzeigebild wird. */
  try{ const b = await naBildHochladen(url); if(NA_ENTWURF===E) naFotoDazu(E.obj, b, 'etikett'); }catch(e){ /* Foto ist Zugabe */ }
  if(NA_ENTWURF!==E) return;
  naKatAuto(E);
  naOcrStand((teile.length ? ('Übernommen: '+teile.join(', ')+'. Bitte prüfen.') : 'Nichts Sicheres gelesen — bitte von Hand eintragen.')
    + ((E.ocr && E.ocr.herstellerNeu) ? ' Hersteller gelesen: „'+E.ocr.herstellerNeu+'" (noch nicht in der Liste).' : '') + hinweis);
  naFormNeu();
});

/* ── Verknüpfungen (Entscheidung E2) ──
   Ein Abschnitt der Maske, kein eigenes Menü. Gespeichert wird nur die
   Hinrichtung, an DIESEM Material; die Gegenrichtung wird gelesen. Ein
   Material, das es noch nicht gibt, wird an Ort und Stelle kurz erfasst —
   die Maske bleibt dabei offen. */
function naAbVerkn(){
  const E = NA_ENTWURF, o = E.obj;
  const eigene = naVerknNormal(o.verknuepfungen, o.id);
  const rein = E.neu ? [] : naVerknVon(naAlle('material', true), o.id).rein;
  let h = '';
  eigene.forEach((v, i)=>{ const z = naHole('material', v.ziel); const a = naVerknArt(v.art); const t = naVerknText(v);
    h += '<div class="na-vk"><button type="button" class="na-vk-haupt" data-na="verknBearb" data-i="'+i+'"><span class="na-vk-ico">'+a.ico+'</span><span><span class="na-vk-art">'+esc(a.hin)+'</span>'
      + '<b>'+esc(z ? (z.name||'(ohne Namen)') : '⚠ Eintrag fehlt (Papierkorb?)')+'</b>'+(t ? '<span class="na-vk-art">'+esc(t)+'</span>' : '')+'</span></button>'
      + '<button type="button" class="na-knopf klein weg" data-na="verknWeg" data-i="'+i+'" aria-label="Verknüpfung entfernen">✕</button></div>'; });
  rein.forEach(v=>{ const a = naVerknArt(v.art); const t = naVerknText(v);
    h += '<div class="na-vk fremd"><span class="na-vk-haupt"><span class="na-vk-ico">'+a.ico+'</span><span><span class="na-vk-art">'+esc(a.gegen)+' · eingetragen am anderen Material</span><b>'+esc(v.o.name||'(ohne Namen)')+'</b>'+(t ? '<span class="na-vk-art">'+esc(t)+'</span>' : '')+'</span></span></div>'; });
  if(!eigene.length && !rein.length) h += '<div class="na-dim" style="margin-bottom:8px">Ersatz („stattdessen geht auch"), Zubehör („braucht dazu") oder die aufbereitete Fassung. Fehlt das andere Material noch, wird es hier gleich mit angelegt.</div>';
  h += '<button class="na-knopf" data-na="verknNeu">＋ Verknüpfung</button>';
  return naAb('verkn', 'Verknüpfungen', (eigene.length+rein.length) ? String(eigene.length+rein.length) : '—', h);
}
/* Sorte und Grund eines Ersatzes — ein Blatt. Liefert { sorte, grund } oder null. */
function naErsatzFragen(name, v){
  v = v || {};
  return naSheetAuf('<div class="sheet-title">Welche Art von Ersatz?</div><div class="sheet-name">'+esc(name)+'</div>'
    + naF('Grund oder Bedingung (freiwillig)', '<input type="text" id="naVkGrund" value="'+esc(v.grund||'')+'" placeholder="z. B. nur bei Lieferengpass · anderer Anschluss" maxlength="160" autocomplete="off">')
    + NA_ERSATZ_SORTEN.map(s=>'<button class="sheet-act" data-na="verknSorte" data-s="'+s.id+'"><span class="sa-ico">'+(v.sorte===s.id ? '●' : s.ico)+'</span><span>'+esc(s.name)+'<span class="sa-sub">'+esc(s.sub)+'</span></span></button>').join('')
    + '<button class="btn btn-sec" style="width:100%" data-na="sheetZu">Abbrechen</button>');
}
naAkt('verknSorte', d=>naSheetZu({ sorte:d.s, grund: String(($('naVkGrund')||{}).value||'').trim() }));
naAkt('verknNeu', async ()=>{
  const E = NA_ENTWURF; if(!E || E.typ!=='material') return;
  const art = await naSheetAuf('<div class="sheet-title">Verknüpfung</div><div class="sheet-name">'+esc(E.obj.name||'dieses Material')+' …</div>'
    + NA_VERKN_ARTEN.map(a=>'<button class="sheet-act" data-na="sheetWert" data-wert="'+a.id+'"><span class="sa-ico">'+a.ico+'</span><span>'+esc(a.hin)+' …<span class="sa-sub">'+esc(({ ersatz:'ein anderes Material, das man stattdessen nehmen kann', zubehoer:'ohne das andere Material ist dieses nicht nutzbar', aufbereitung:'dieses ist die wiederaufbereitete Fassung eines Originals' })[a.id])+'</span></span></button>').join(''));
  if(!art || NA_ENTWURF!==E) return;
  const A = naVerknArt(art);
  const schon = naVerknNormal(E.obj.verknuepfungen, E.obj.id).filter(v=>v.art===art).map(v=>v.ziel);
  const items = [{ id:'__neu__', name:'Neues Material erfassen', sub:'Barcode scannen oder nur den Namen eintragen', ico:'＋' }]
    .concat(naAlle('material').filter(m=>m.id!==E.obj.id && schon.indexOf(m.id)<0).map(m=>({ id:m.id, name:m.name||'(ohne Namen)', sub:naStammSub('material', m) })));
  let w = await naAuswahl({ titel:A.hin+' …', items, neu:true, wo:'Verknüpfung', anlegen: name=>{ naSheetZu({ neu:name }); return null; } });
  if(!w || NA_ENTWURF!==E) return;
  if(w==='__neu__') w = { neu:'' };
  let ziel = w;
  if(typeof w==='object'){ ziel = await naKurzerfassung(w.neu); if(!ziel || NA_ENTWURF!==E) return; }
  if(ziel===E.obj.id) return;
  const v = { art, ziel };
  if(art==='ersatz'){
    const s = await naErsatzFragen((naHole('material', ziel)||{}).name || '');
    if(NA_ENTWURF!==E) return;
    if(s){ v.sorte = s.sorte; if(s.grund) v.grund = s.grund; }   /* ohne Antwort: Ersatz ohne Sorte — später nachtragbar */
  }
  E.obj.verknuepfungen = naVerknNormal((E.obj.verknuepfungen||[]).concat([v]), E.obj.id);
  E.offen.verkn = true; naFormNeu();
});
naAkt('verknBearb', async d=>{
  const E = NA_ENTWURF; if(!E) return;
  const l = naVerknNormal(E.obj.verknuepfungen, E.obj.id); const v = l[+d.i]; if(!v) return;
  const z = naHole('material', v.ziel);
  if(v.art!=='ersatz'){ if(z) toast('„'+z.name+'" — zum Entfernen ✕ antippen.'); return; }
  const s = await naErsatzFragen(z ? z.name : '', v);
  if(!s || NA_ENTWURF!==E) return;
  v.sorte = s.sorte; if(s.grund) v.grund = s.grund; else delete v.grund;
  E.obj.verknuepfungen = naVerknNormal(l, E.obj.id); naFormNeu();
});
naAkt('verknWeg', d=>{ const E = NA_ENTWURF; if(!E) return;
  const l = naVerknNormal(E.obj.verknuepfungen, E.obj.id); l.splice(+d.i, 1);
  if(l.length) E.obj.verknuepfungen = l; else delete E.obj.verknuepfungen;
  naFormNeu(); });

/* ── Kurzerfassung: ein zweites Material anlegen, ohne die Maske zu verlassen ──
   Ein Blatt: scannen ODER nur den Namen. Gespeichert wird sofort, bewusst
   unvollständig — das Verzeichnis führt es unter „unvollständig".
   Liefert die Kennung (auch eines schon vorhandenen Materials) oder null. */
let NA_KURZ = null;
function naKurzHtml(){
  const K = NA_KURZ, o = K.o; const her = o.hersteller ? naListeName('hersteller', o.hersteller) : '';
  const info = [her ? 'Hersteller: '+her : '', o.handelsname ? 'Handelsname: '+o.handelsname : ''].filter(Boolean).join(' · ');
  return '<div class="na-zeile"><button class="na-knopf pri" data-na="kurzScan">▦ Barcode scannen</button></div>'
    + '<div class="na-dim" id="naKurzStand" style="margin:6px 0 10px">'+esc(K.stand || 'Der Barcode füllt Hersteller, Handelsname und REF aus dem EU-Register. Oder nur den Namen eintragen.')+'</div>'
    + (K.vorhanden ? '<div class="na-warn">Dieses Material gibt es schon: „'+esc(K.vorhanden.name)+'".<div style="margin-top:8px"><button class="na-knopf pri" data-na="kurzVorhanden">Dieses verknüpfen</button></div></div>' : '')
    + naF('Name im Haus', '<input type="text" id="naKurzName" data-na-ein="kurz" data-f="name" value="'+esc(o.name||'')+'" placeholder="so, wie man es im Saal sucht" autocomplete="off">',
        (!o.name && o.handelsname) ? '<button class="na-chip" data-na="kurzName" data-n="'+esc(o.handelsname)+'">'+esc(o.handelsname)+'</button>' : '')
    + '<div class="na-zwei">' + naF('REF', '<input type="text" class="na-mono" data-na-ein="kurz" data-f="ref" value="'+esc(o.ref||'')+'" autocomplete="off">')
    + naF('GTIN', '<input type="text" class="na-mono" data-na-ein="kurz" data-f="gtin" value="'+esc(o.gtin||'')+'" inputmode="numeric" autocomplete="off">') + '</div>'
    + (info ? '<div class="na-info">'+esc(info)+(o.register ? ' <span class="na-dim">('+esc(naRegisterQuelle(o.register.quelle))+', noch nicht bestätigt)</span>' : '')+'</div>' : '')
    + '<div class="na-dim">Wird als <b>unvollständig</b> angelegt. Lagerort, Bild und alles Weitere später im Verzeichnis (Filter „unvollständig").</div>'
    + '<div class="na-zeile" style="margin-top:12px"><button class="btn btn-sec" data-na="sheetZu">Abbrechen</button><button class="btn btn-pri" data-na="kurzOk">Anlegen und verknüpfen</button></div>';
}
function naKurzNeu(){ const c = $('naKurzInhalt'); if(c && NA_KURZ) c.innerHTML = naKurzHtml(); }
function naKurzStand(t){ if(NA_KURZ) NA_KURZ.stand = t; const s = $('naKurzStand'); if(s) s.textContent = t; }
function naKurzerfassung(name){
  const meins = NA_KURZ = { o: Object.assign(naStammLeer('material'), { name: String(name||'').trim() }), stand:'', vorhanden:null };
  return naSheetAuf('<div class="sheet-title">Neues Material — kurz erfassen</div><div id="naKurzInhalt">'+naKurzHtml()+'</div>')
    .then(w=>{ if(NA_KURZ===meins) NA_KURZ = null; return (typeof w==='string' && w) ? w : null; });
}
naEin('kurz', (v, d)=>{ const K = NA_KURZ; if(!K) return; K.o[d.f] = v;
  if(d.f==='gtin'){ const g = String(v).trim(); const dop = (g && naGtinPruefziffer(g)) ? naGtinDoppelt(g, K.o.id) : null;
    if((dop||null)!==(K.vorhanden||null)){ K.vorhanden = dop; naKurzNeu(); } } });
naAkt('kurzName', d=>{ const K = NA_KURZ; if(!K) return; K.o.name = d.n; naKurzNeu(); });
naAkt('kurzVorhanden', ()=>{ const K = NA_KURZ; if(K && K.vorhanden) naSheetZu(K.vorhanden.id); });
naAkt('kurzScan', async ()=>{
  const K = NA_KURZ; if(!K) return;
  const erg = await naBarcodeHolen(naKurzStand);
  if(!erg || NA_KURZ!==K) return;
  const d = naGtinDoppelt(erg.gtin, K.o.id);
  if(d){ K.vorhanden = d; K.stand = 'Die gescannte GTIN ist schon angelegt.'; naKurzNeu(); return; }
  K.vorhanden = null; K.o.gtin = erg.gtin; if(erg.itemRef && !K.o.ref) K.o.ref = erg.itemRef;
  if(!naEinstellung('register', true)){ K.stand = 'GTIN gelesen.'; naKurzNeu(); return; }
  K.stand = 'GTIN gelesen — das EU-Register wird gefragt …'; naKurzNeu();
  const r = await naRegisterFuellen(K.o, ()=>NA_KURZ===K && naGtinKey(K.o.gtin)===naGtinKey(erg.gtin));
  if(!r) return;
  K.stand = naRegisterText(r).replace(' Bitte prüfen; mit dem Speichern gilt es als bestätigt.', ' Bestätigt wird es später in der vollen Maske.'); naKurzNeu();
});
naAkt('kurzOk', ()=>{
  const K = NA_KURZ; if(!K) return; const o = K.o;
  o.name = String(o.name||'').trim(); o.ref = String(o.ref||'').trim(); o.gtin = String(o.gtin||'').replace(/\s/g,'');
  if(!o.name){ naKurzStand('Bitte einen Namen eintragen'+(o.handelsname ? ' — oder den Handelsnamen antippen.' : '.')); const f = $('naKurzName'); if(f) f.focus(); return; }
  if(o.gtin && !naGtinPruefziffer(o.gtin)){ naKurzStand('GTIN: Die Prüfziffer stimmt nicht. Bitte korrigieren oder leeren.'); return; }
  const dg = o.gtin ? naGtinDoppelt(o.gtin, o.id) : null;
  const dn = naAlle('material', true).find(m=>naNorm(m.name)===naNorm(o.name));
  if(dg || dn){ K.vorhanden = dg || dn; K.stand = dg ? 'Diese GTIN ist schon angelegt.' : 'Ein Material mit diesem Namen gibt es schon.'; naKurzNeu(); return; }
  const v = naKatVorschlagFuer(o); if(v) o.kategorie = v.id;
  naSpeichern('material', o, 'kurz erfasst (für eine Verknüpfung)');
  naSheetZu(o.id);
});

/* ── Speichern mit Prüfungen ── */
const NA_OHNE_WIRKUNG = ['fotos','hauptbild','notiz','preis','register','suchwoerter','verwendung','pzn','packung','verknuepfungen','handelsname','varianteVon'];
async function naStammPruefen(E){
  const o = E.obj, typ = E.typ;
  o.name = String(o.name||'').trim();
  if(!o.name){ toast('Bitte einen Namen eintragen.', true); return false; }
  if(typ==='material'){
    o.gtin = String(o.gtin||'').replace(/\s/g,''); o.ref = String(o.ref||'').trim();
    if(o.gtin && !naGtinPruefziffer(o.gtin)){ toast('GTIN: Prüfziffer stimmt nicht. Bitte korrigieren oder leeren.', true); return false; }
    if(o.gtin){ const d = naGtinDoppelt(o.gtin, o.id);
      if(d){ toast('Diese GTIN gehört schon zu „'+d.name+'".', true); return false; } }
    if(o.pzn!=null){ o.pzn = String(o.pzn).replace(/^pzn[\s:\-]*/i,'').replace(/\s/g,'');
      if(o.pzn && !naPznOk(o.pzn)){ E.offen.verw = true; naFormNeu(); toast('PZN: Prüfziffer stimmt nicht. Bitte korrigieren oder leeren.', true); return false; } }
    if(o.ref && o.hersteller){ const d = naAlle('material', true).find(m=>m.id!==o.id && m.hersteller===o.hersteller && naNorm(m.ref)===naNorm(o.ref));
      if(d && !(await naFrage('Gleiche REF beim gleichen Hersteller gibt es schon: „'+d.name+'". Trotzdem speichern?', { ja:'Trotzdem speichern' }))) return false; }
  }
  const andere = naAlle(typ, true).filter(x=>x.id!==o.id);
  const tr = naAehnliche(o.name, andere);
  const gleich = tr.find(t=>t.grad==='gleich');
  if(gleich && !(await naFrage('„'+gleich.item.name+'" gibt es schon. Wirklich einen zweiten Eintrag mit diesem Namen?', { ja:'Ja, zweiter Eintrag', mehr:'Meist ist es besser, den vorhandenen Eintrag zu verwenden.' }))) return false;
  if(!E.neu){
    const alt = naHole(typ, o.id);
    /* Bilder, Notiz, Preis, Suchwörter … ändern keine Zeile im Standard — dafür keine Rückfrage. */
    const felder = naUnterschiede(alt, o).filter(f=>NA_OHNE_WIRKUNG.indexOf(f)<0);
    const v = naVerwendungen(naVerwendungDaten().standards, typ, o.id);
    const stds = v.map(x=>x.std.titel || (naHole('baustein',x.std.id)||{}).name).filter((x,i,a)=>a.indexOf(x)===i);
    if(felder.length && stds.length && !(await naFrage('Diese Änderung wirkt in '+stds.length+' Standard(s).', { ja:'Überall übernehmen', mehr: esc(stds.slice(0,8).join(' · ')+(stds.length>8?' …':'')) }))) return false;
  }
  return true;
}
/* Prüfen, aufräumen, schreiben. Liefert true, wenn gespeichert wurde. */
async function naEntwurfSichern(E){
  if(!(await naStammPruefen(E))) return false;
  if(NA_ENTWURF!==E) return false;
  const o = E.obj;
  if(o.preis) o.preis.bezugsmenge = Math.max(1, +o.preis.bezugsmenge || 1);
  naFotosSetzen(o, naFotos(o));   /* einheitliche Bildform, auch für ältere Einträge */
  if(E.typ==='material'){
    ['handelsname','suchwoerter','verwendung','pzn','packung'].forEach(f=>{ if(o[f]!=null){ o[f] = String(o[f]).trim(); if(!o[f]) delete o[f]; } });
    const vk = naVerknNormal(o.verknuepfungen, o.id); if(vk.length) o.verknuepfungen = vk; else delete o.verknuepfungen;
    /* Registerdaten gelten mit dem Speichern als geprüft (Grundsatz A5). */
    if(o.register && o.register.quelle && !o.register.bestaetigt) o.register.bestaetigt = naJetzt();
  }
  naSpeichern(E.typ, o);
  return true;
}
naAkt('entwSpeichern', async ()=>{
  const E = NA_ENTWURF; if(!E) return;
  if(!(await naEntwurfSichern(E))) return;
  NA_ENTWURF = null; toast('Gespeichert');
  const zurueck = NA_RUECKSPRUNG; NA_RUECKSPRUNG = null;
  if(zurueck && zurueck.fertig) zurueck.fertig({ typ:E.typ, id:E.obj.id });
  else naGeh('#/'+E.typ);
});
/* Serien-Erfassung: speichern und gleich das nächste — Lagerort und Bereich
   bleiben stehen (ein Schrank wird am Stück erfasst), alles andere ist leer. */
naAkt('entwWeiter', async ()=>{
  const E = NA_ENTWURF; if(!E || !E.neu || E.typ!=='material') return;
  if(!(await naEntwurfSichern(E))) return;
  const neu = naStammLeer('material'); neu.lagerort = E.obj.lagerort || ''; neu.bereich = E.obj.bereich || '';
  NA_ENTWURF = naEntwurfAnlegen('material', neu, true);
  toast('Gespeichert: '+E.obj.name+' — jetzt das nächste');
  naZeigen(); window.scrollTo(0, 0);
});
/* Eine weitere Größe desselben Produkts: Familie übernehmen, Nummern leeren. */
naAkt('entwVariante', ()=>{
  const E = NA_ENTWURF; if(!E || E.neu || E.typ!=='material') return;
  if(naEntwurfGeaendert()){ toast('Bitte erst speichern — dann als Variante kopieren.', true); return; }
  const o = naHole('material', E.obj.id); if(!o) return;
  NA_ENTWURF = Object.assign(naEntwurfAnlegen('material', naVariante(o), true), { variante:o.name });
  NA_RUECKSPRUNG = null;
  naGeh('#/material/neu');
});
naAkt('entwAbbrechen', async ()=>{
  const E = NA_ENTWURF;
  if(E && naEntwurfGeaendert() && !(await naVerlassenFragen())) return;
  if(E && NA_ENTWURF!==E) return;
  NA_ENTWURF = null; const z = NA_RUECKSPRUNG; NA_RUECKSPRUNG = null;
  if(z && z.abbruch) z.abbruch(); else naGeh('#/'+(E ? E.typ : 'material'));
});
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
   Eintrag; dieser geht in den Papierkorb (wiederherstellbar). Verknüpfungen
   wandern mit: Was auf die Dublette zeigte, zeigt auf den Verbleibenden, und
   ihre eigenen Verknüpfungen gehen auf ihn über. */
function naStammZusammenfuehren(typ, von, nach){
  let n = 0;
  naStandards().concat(naAlle('baustein', true)).forEach(o=>{ let m = 0;
    naPositionenAlle(o).forEach(p=>{ if(p.ref && p.ref.typ===typ && p.ref.id===von){ p.ref = { typ, id:nach }; m++; } });
    if(m){ n += m; naSpeichern(o.rubriken ? 'standard' : 'baustein', o, 'Dublette zusammengeführt'); } });
  naAlle('meldung', true).forEach(m=>{ if(m.ref && m.ref.typ===typ && m.ref.id===von){ m.ref = { typ, id:nach }; naSpeichern('meldung', m); } });
  if(typ==='material'){
    const alt = naHole('material', von), ziel = naHole('material', nach);
    if(alt && ziel && (alt.verknuepfungen||[]).length){
      const vk = naVerknNormal((ziel.verknuepfungen||[]).concat(alt.verknuepfungen), nach);
      if(JSON.stringify(vk)!==JSON.stringify(naVerknNormal(ziel.verknuepfungen, nach))){ ziel.verknuepfungen = vk; naSpeichern('material', ziel, 'Verknüpfungen der Dublette übernommen'); }
    }
    naAlle('material', true).forEach(m=>{ if(m.id!==von && naVerknUmhaengen(m, von, nach)) naSpeichern('material', m, 'Verknüpfung umgehängt (Dublette)'); });
  }
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
  const o = naStammLeer(typ); if(name) o.name = name;
  NA_ENTWURF = naEntwurfAnlegen(typ, o, true);
  if(name) naKatAuto(NA_ENTWURF);
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
