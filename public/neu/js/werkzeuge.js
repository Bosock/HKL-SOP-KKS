/* ─────────────────────────────────────────────────────────────
   NEUE APP — MEHR: Listen · Bausteine · Meldungen · Verlauf · Papierkorb ·
   Kosten · Sicherung · Einstellungen
   ───────────────────────────────────────────────────────────── */
function naSichtMehr(){
  const a = naAdmin();
  const z = (ziel, ico, t, sub)=>'<button class="sheet-act" data-na="geh" data-ziel="'+ziel+'"><span class="sa-ico">'+ico+'</span><span>'+esc(t)+(sub?'<span class="sa-sub">'+esc(sub)+'</span>':'')+'</span></button>';
  const offen = naAlle('meldung').filter(m=>m.stufe!=='erledigt').length;
  let h = '';
  h += z('#/meldungen', '📣', 'Meldungen'+(offen?' ('+offen+' offen)':''), 'ist leer · fehlt · defekt — gemeldet · weitergegeben · erledigt');
  h += z('#/bausteine', '🧩', 'Bausteine', 'wiederkehrende Positionsgruppen');
  if(a){
    h += '<div class="na-h">Verwaltung</div>';
    h += z('#/listen', '🗂', 'Listen-Verzeichnis', 'alle Auswahllisten: umbenennen, zusammenführen, archivieren, wo verwendet');
    h += z('#/verlauf', '🕘', 'Verlauf', 'wer hat wann was geändert (je Gerät)');
    h += z('#/papierkorb', '🗑', 'Papierkorb', Object.keys(NA.papierkorb).length+' Einträge');
    h += z('#/kosten', '€', 'Kostenübersicht', 'Plankosten je Standard, CSV für Einkauf und Controlling');
    h += z('#/sicherung', '💾', 'Sicherung', 'alles als Datei sichern oder einspielen');
  }
  h += z('#/einstellungen', '⚙', 'Einstellungen', 'Ansicht · Gerätename · Passwort · EU-Register · Raum');
  return { titel:'Mehr', pfad: a ? 'Verwaltung angemeldet' : 'Anwender', tab:'mehr', html:h };
}

/* ── Listen-Verzeichnis ── */
function naSichtListen(){
  if(!naAdmin()) return { titel:'Listen', html: naLeer('🔒','Nur in der Verwaltung','') };
  return { titel:'Listen-Verzeichnis', zurueck:'#/mehr', html:
    '<div class="na-info">Jede Auswahlliste der App steht hier — und jede lässt sich auch dort erweitern, wo sie gebraucht wird (im Auswahlfeld: tippen, „neu anlegen").</div>'
    + NA_LISTEN.map(l=>'<div class="na-eintrag" data-na="geh" data-ziel="#/liste/'+l.key+'"><span class="na-ico">🗂</span><div class="na-haupt"><div class="na-name">'+esc(l.wort)+'</div><div class="na-sub">'+naListe(l.key).length+' Einträge'+(naListe(l.key,true).length>naListe(l.key).length?' · '+(naListe(l.key,true).length-naListe(l.key).length)+' archiviert':'')+'</div></div><span class="chev">›</span></div>'
        + (l.key==='kategorien' ? naMerkmaleZeile() : '')).join('') };
}
/* Die Merkmale stehen im Verzeichnis gleich unter den Kategorien, zu denen sie gehören. */
function naMerkmaleZeile(){
  const z = naMerkmalZeilen(); const eig = z.filter(x=>x.eigen && !x.archiviert).length, arch = z.filter(x=>x.archiviert).length, ge = z.filter(x=>!x.archiviert && x.geaendert.length).length;
  return '<div class="na-eintrag" data-na="geh" data-ziel="#/liste/merkmale"><span class="na-ico">▤</span><div class="na-haupt"><div class="na-name">Merkmale (Material)</div><div class="na-sub">'+z.filter(x=>!x.archiviert).length+' Merkmale'
    + (eig ? ' · '+eig+' eigene' : '')+(ge ? ' · '+ge+' geändert' : '')+(arch ? ' · '+arch+' archiviert' : '')+' — ansehen, suchen, ändern, Kategorien zuordnen</div></div><span class="chev">›</span></div>';
}
function naSichtListe(key){
  if(!naAdmin()) return { titel:'Liste', html: naLeer('🔒','Nur in der Verwaltung','') };
  const daten = naVerwendungDaten();
  const nameBasiert = key==='rubriken' || key==='abschnitte';
  const e = naListe(key, true);
  const h = '<div class="na-zeile" style="margin-bottom:8px"><button class="na-knopf pri" data-na="listeNeu" data-k="'+key+'">＋ Neu</button></div>'
    + (e.length ? e.map(x=>{ const n = naListenVerwendung(key, nameBasiert ? x.name : x.id, daten);
      return '<div class="na-eintrag'+(x.archiviert?' archiv':'')+'" data-na="listeEintrag" data-k="'+key+'" data-id="'+esc(x.id)+'"><span class="na-ico">'+esc(x.ico||'•')+'</span><div class="na-haupt"><div class="na-name">'+esc(x.name)+(x.archiviert?' · archiviert':'')+'</div>'
        + (x.amtlich || x.srn ? '<div class="na-sub">amtlich: '+esc(x.amtlich||'—')+(x.srn ? ' · <span class="na-mono">'+esc(x.srn)+'</span>' : '')+'</div>' : '')
        + '<div class="na-sub">'+(x.vorgabe ? 'Vorgabe' : ('angelegt '+esc(naDatum(x.angelegt))+(x.wo?' · in: '+esc(x.wo):'')))+'</div></div><div class="na-rechts">'+n+'× verwendet</div></div>'; }).join('') : naLeer('🗂','Noch leer',''));
  return { titel:naListeWort(key), pfad:'Listen-Verzeichnis', zurueck:'#/listen', html:h };
}
naAkt('listeNeu', async d=>{ const n = await naEingabe('Neuer Eintrag: '+naListeWort(d.k)); if(!n) return;
  const tr = naAehnliche(n, naListe(d.k, true));
  if(tr.length && !(await naFrage('Ähnlich: '+tr.slice(0,3).map(t=>'„'+t.item.name+'"').join(', ')+'. Trotzdem neu anlegen?', { ja:'Neu anlegen' }))) return;
  if(d.k==='kategorien'){ const id = await naKategorieAnlegen(n, 'Listen-Verzeichnis'); if(id) naGeh('#/liste/kategorien/'+encodeURIComponent(id)); return; }
  naListeNeu(d.k, n, 'Listen-Verzeichnis', d.k==='arten' ? { ico:'•', farbe:'#7f95ab', verweis:'', haken:true } : null); naZeigen(); });
naAkt('listeEintrag', async d=>{
  const x = naListeEintrag(d.k, d.id); if(!x) return;
  const w = await naSheetAuf('<div class="sheet-title">'+esc(naListeWort(d.k))+'</div><div class="sheet-name">'+esc(x.name)+'</div>'
    + '<button class="sheet-act" data-na="sheetWert" data-wert="umbenennen"><span class="sa-ico">✎</span><span>Umbenennen<span class="sa-sub">wirkt überall, wo der Eintrag verwendet wird</span></span></button>'
    + (d.k==='kategorien' ? '<button class="sheet-act" data-na="geh" data-ziel="#/liste/kategorien/'+esc(encodeURIComponent(d.id))+'"><span class="sa-ico">▤</span><span>Merkmale dieser Kategorie<span class="sa-sub">'+esc(naKatMerkmaleSub(d.id))+'</span></span></button>' + naKatWorteKnopf(d.id) : '')
    + (d.k==='arten' ? '<button class="sheet-act" data-na="sheetWert" data-wert="symbol"><span class="sa-ico">'+esc(x.ico||'•')+'</span><span>Symbol ändern</span></button><button class="sheet-act" data-na="sheetWert" data-wert="haken"><span class="sa-ico">☑</span><span>'+(x.haken===false?'Wird abgehakt':'Wird nicht abgehakt (Hinweis)')+'</span></button>' : '')
    + (NA_LISTE_FELD[d.k] || ['arten','gruppen','kennzeichen'].indexOf(d.k)>=0 ? '<button class="sheet-act" data-na="sheetWert" data-wert="zusammen"><span class="sa-ico">⇉</span><span>Mit anderem Eintrag zusammenführen<span class="sa-sub">alle Verwendungen zeigen danach auf den anderen</span></span></button>' : '')
    + '<button class="sheet-act" data-na="sheetWert" data-wert="archiv"><span class="sa-ico">🗄</span><span>'+(x.archiviert?'Zurückholen':'Archivieren')+'<span class="sa-sub">wird nicht mehr angeboten; Vorhandenes bleibt</span></span></button>');
  if(!w) return;
  if(w==='umbenennen'){ const n = await naEingabe('Neuer Name', { wert:x.name }); if(n && n!==x.name) naListeUmbenennen(d.k, d.id, n); }
  if(w==='symbol'){ const s = await naEingabe('Symbol (ein Emoji)', { wert:x.ico||'' }); if(s) naListeSpeichern(d.k, naListe(d.k,true).map(y=>y.id===d.id?Object.assign({}, y, { ico:s.slice(0,4) }):y), 'Symbol geändert'); }
  if(w==='worte' || w==='worteVorgabe') await naKatWorteAendern(d.id, w==='worteVorgabe');
  if(w==='haken') naListeSpeichern(d.k, naListe(d.k,true).map(y=>y.id===d.id?Object.assign({}, y, { haken: y.haken===false }):y), 'Abhaken geändert');
  if(w==='zusammen'){
    const ziel = await naAuswahl({ titel:'„'+x.name+'" zusammenführen mit …', items: naListe(d.k).filter(y=>y.id!==d.id).map(y=>({ id:y.id, name:y.name })) });
    if(!ziel) return;
    if(!(await naFrage('„'+x.name+'" in „'+naListeName(d.k, ziel)+'" überführen?', { ja:'Zusammenführen', mehr:'Danach ist „'+esc(x.name)+'" archiviert.' }))) return;
    const n = naListeZusammenfuehren(d.k, d.id, ziel); toast(n+' Verwendung(en) umgehängt');
  }
  if(w==='archiv') naListeArchivieren(d.k, d.id, !x.archiviert);
  naZeigen();
});

/* ── Merkmale einer Kategorie (Grundsatz A7) ──
   Derselbe Inhalt wie in der Material-Maske, nur im Überblick: welche
   Merkmale eine Kategorie hat, welche davon Kern (★) sind, wie oft sie
   ausgefüllt werden. Hier wird nichts anders gespeichert als in der Maske. */
function naKatMerkmaleSub(id){ const f = naFelder(naKat(), id); const n = f.diff.length + f.weitere.length;
  return n ? n+' Merkmal'+(n===1?'':'e')+(f.diff.length ? ' · ★ '+f.diff.map(d=>d.label).slice(0,3).join(', ') : '') : 'noch keine'; }
function naSichtKategorie(id){
  if(!naAdmin()) return { titel:'Kategorie', html: naLeer('🔒','Nur in der Verwaltung','') };
  const kat = naKat(); const k = kat.klassen.find(x=>x.id===id);
  if(!k) return { titel:'Kategorie', zurueck:'#/liste/kategorien', html: naLeer('❓','Nicht gefunden','') };
  const f = naFelder(kat, id); const nu = naMerkmalNutzung(naAlle('material'), id);
  const zeile = (d, stern)=>{ const z = nu.zahl[d.id]||0;
    return '<div class="na-eintrag" data-na="katMerkmal" data-k="'+esc(id)+'" data-mid="'+esc(d.id)+'"><span class="na-ico">'+(stern?'★':'▤')+'</span><div class="na-haupt"><div class="na-name">'+esc(d.label)+(d.einheit && d.typ!=='ja_nein' ? ' <span class="na-dim">('+esc(d.einheit)+')</span>' : '')+'</div>'
      + ((d.such||[]).length ? '<div class="na-sub">auch: '+esc(d.such.slice(0,5).join(', '))+'</div>' : '')+'</div><div class="na-rechts">'+(nu.n ? z+' von '+nu.n : '')+'</div></div>'; };
  const vor = naMerkmalVorschlaege(kat, naAlle('material'), id, NA_NICHT_ALS_MERKMAL);
  let h = '<div class="na-info">Diese Merkmale erscheinen in der Maske jedes Materials der Kategorie „'+esc(k.label)+'" — alle freiwillig. ★ = Kern: steht oben und geht in den Namensvorschlag ein. Rechts: bei wie vielen Materialien ausgefüllt.</div>';
  if(k.wie){ const v = kat.klassen.find(x=>x.id===k.wie); if(v) h += '<div class="na-dim" style="margin:-2px 4px 8px">Begonnen mit den Merkmalen von „'+esc(v.label)+'".</div>'; }
  h += '<div class="na-h">Kern ★ ('+f.diff.length+')</div>' + (f.diff.length ? f.diff.map(d=>zeile(d, true)).join('') : '<div class="na-dim">Noch keines.</div>');
  h += '<div class="na-h">Weitere ('+f.weitere.length+')</div>' + (f.weitere.length ? f.weitere.map(d=>zeile(d, false)).join('') : '<div class="na-dim">Keine.</div>');
  vor.forEach(v=>{ h += '<div class="na-info">„'+esc(v.label)+'" ist bei '+v.zahl+' von '+v.n+' Materialien dieser Kategorie ausgefüllt, gehört aber nicht dazu.<div class="na-chips" style="margin-top:6px"><button class="na-chip" data-na="katMerkmalStufe" data-k="'+esc(id)+'" data-mid="'+esc(v.id)+'" data-s="weiter">Übernehmen</button><button class="na-chip" data-na="katMerkmalStumm" data-k="'+esc(id)+'" data-mid="'+esc(v.id)+'">Nicht mehr vorschlagen</button></div></div>'; });
  h += '<div class="na-zeile" style="margin:12px 0"><button class="na-knopf pri" data-na="katMerkmalDazu" data-k="'+esc(id)+'">＋ Merkmal suchen oder anlegen</button></div>';
  h += '<div class="na-dim">Für alle Kategorien gelten außerdem: '+esc(f.allgemein.map(d=>d.label).join(' · '))+'.</div>';
  return { titel:k.label, pfad:'Merkmale der Kategorie', zurueck:'#/liste/kategorien', html:h };
}
naAkt('katMerkmal', async d=>{
  const kat = naKat(); const def = kat.merkmale.find(x=>x.id===d.mid); const k = kat.klassen.find(x=>x.id===d.k); if(!def || !k) return;
  const f = naFelder(kat, d.k); const kern = f.diff.some(x=>x.id===d.mid);
  const w = await naSheetAuf('<div class="sheet-title">Merkmal in „'+esc(k.label)+'"</div><div class="sheet-name">'+esc(def.label)+'</div>'
    + (kern ? '<button class="sheet-act" data-na="sheetWert" data-wert="weiter"><span class="sa-ico">▤</span><span>Kein Kern-Merkmal mehr<span class="sa-sub">bleibt in der Kategorie, steht aber nicht mehr oben</span></span></button>'
            : '<button class="sheet-act" data-na="sheetWert" data-wert="kern"><span class="sa-ico">★</span><span>Als Kern-Merkmal<span class="sa-sub">steht oben in der Maske und geht in den Namensvorschlag ein</span></span></button>')
    + '<button class="sheet-act" data-na="sheetWert" data-wert="such"><span class="sa-ico">🔎</span><span>Suchwörter ändern<span class="sa-sub">'+esc((def.such||[]).length ? def.such.join(', ') : 'noch keine eigenen')+'</span></span></button>'
    + (/^#\/liste\/merkmale\//.test(location.hash)
        ? '<button class="sheet-act" data-na="geh" data-ziel="#/liste/kategorien/'+esc(encodeURIComponent(d.k))+'"><span class="sa-ico">🗂</span><span>Kategorie ansehen<span class="sa-sub">alle Merkmale von „'+esc(k.label)+'"</span></span></button>'
        : '<button class="sheet-act" data-na="geh" data-ziel="#/liste/merkmale/'+esc(encodeURIComponent(d.mid))+'"><span class="sa-ico">▤</span><span>Merkmal ansehen und ändern<span class="sa-sub">Name, Hinweis, Auswahlwerte, alle Kategorien</span></span></button>')
    + '<button class="sheet-act danger" data-na="sheetWert" data-wert="aus"><span class="sa-ico">✕</span><span>Aus dieser Kategorie entfernen<span class="sa-sub">eingetragene Werte bleiben erhalten und erscheinen beim Material als „nur bei diesem Material"</span></span></button>');
  if(!w) return;
  if(w==='such'){ await naMerkmalSuchAendern(d.mid); naZeigen(); return; }
  naMerkmalKategorieSetzen(d.k, d.mid, w); toast(w==='aus' ? 'Entfernt' : (w==='kern' ? 'Kern-Merkmal ★' : 'Weiteres Merkmal')); naZeigen();
});
naAkt('katMerkmalStufe', d=>{ naMerkmalKategorieSetzen(d.k, d.mid, d.s); toast('Übernommen'); naZeigen(); });
naAkt('katMerkmalStumm', d=>{ naKatTplSpeichern(naTplStumm(naKatTpl(), d.k, d.mid), 'Vorschlag abgestellt'); naZeigen(); });
naAkt('katMerkmalDazu', async d=>{
  const kat = naKat(); const k = kat.klassen.find(x=>x.id===d.k); if(!k) return;
  const f = naFelder(kat, d.k); const schon = f.diff.concat(f.weitere).map(x=>x.id).concat(NA_NICHT_ALS_MERKMAL);
  const w = await naAuswahl({ titel:'Merkmal für „'+k.label+'"', items:naMerkmalItems(kat, d.k, schon), neu:true, wo:'Kategorie „'+k.label+'"',
    anlegen: name=>{ naSheetZu({ neu:name }); return null; } });
  if(!w) return;
  let mid = w; if(typeof w==='object'){ mid = await naMerkmalAnlegen(w.neu); if(!mid) return; }
  const def = naKat().merkmale.find(x=>x.id===mid) || { label:mid };
  const stufe = await naMerkmalGiltFragen(def, k);
  if(!stufe) return;
  if(stufe!=='einzel') naMerkmalKategorieSetzen(d.k, mid, stufe);
  naZeigen();
});
/* Suchwörter eines Merkmals: andere Wörter, unter denen man es sucht. */
async function naMerkmalSuchAendern(mid){
  const def = naKat().merkmale.find(x=>x.id===mid); if(!def) return;
  const tpl = JSON.parse(JSON.stringify(naKatTpl())); tpl.such = tpl.such || {};
  const t = await naEingabe('Suchwörter: '+def.label, { wert:(def.such||[]).join(', '), platzhalter:'z. B. resterilisation, zyklen',
    hilfe:'Mit Komma trennen. Wer in der Maske „Merkmal suchen" tippt, findet das Merkmal auch unter diesen Wörtern.' });
  if(t==null) return;
  const liste = []; t.split(/[,;\n]/).map(x=>x.trim().toLowerCase()).filter(x=>x.length>=2).forEach(x=>{ if(liste.indexOf(x)<0) liste.push(x); });
  /* Gespeichert wird, was über die mitgelieferten Suchwörter hinausgeht. */
  const quelle = ((NA_MERKQUELLE && NA_MERKQUELLE.merkmale)||[]).find(x=>x.id===mid); const vorgabe = (quelle && quelle.such) || [];
  const eigen = liste.filter(x=>vorgabe.indexOf(x)<0);
  if(eigen.length) tpl.such[mid] = eigen; else delete tpl.such[mid];
  naKatTplSpeichern(tpl, 'Suchwörter von „'+def.label+'" geändert'); toast('Suchwörter gespeichert');
}

/* ── Merkmale (Listen-Verzeichnis, Grundsatz A7) ──
   ALLE Merkmale an einer Stelle: sehen, suchen, pflegen. Dieselben Merkmale
   wie in der Material-Maske und in „Merkmale dieser Kategorie" — hier nur von
   der anderen Seite: nicht „was hat diese Kategorie?", sondern „was gibt es,
   und wo gilt es?". Gespeichert wird wie überall nur die Abweichung des
   Hauses (naKatTpl); die mitgelieferte Liste bleibt und lässt sich je Merkmal
   zurückholen. */
const NA_MERKMAL_ICO = { mass:'📏', zahl:'#', liste:'☰', text:'✎', ja_nein:'☑' };
const NA_MERKMAL_KURZ = { mass:'Maß', zahl:'Zahl', liste:'Auswahl', text:'Text', ja_nein:'Ja / Nein' };
let NA_ML = { q:'', f:'alle' };
const NA_ML_FILTER = [
  { id:'alle',      wort:'alle',           ok:z=>!z.archiviert },
  { id:'genutzt',   wort:'ausgefüllt',     ok:z=>!z.archiviert && z.zahl>0 },
  { id:'ohne',      wort:'ohne Kategorie', ok:z=>!z.archiviert && !z.allgemein && !z.kategorien.length },
  { id:'eigen',     wort:'eigene',         ok:z=>!z.archiviert && z.eigen },
  { id:'geaendert', wort:'geändert',       ok:z=>!z.archiviert && z.geaendert.length>0 },
  { id:'archiv',    wort:'archiviert',     ok:z=>z.archiviert },
];
function naMerkmalZeilen(){ return naMerkmalListe(naKat(), NA_MERKQUELLE, naKatTpl(), naAlle('material')); }
function naMerkmalDef(mid){ return naKat().merkmale.find(x=>x.id===mid) || null; }
function naMerkmalArtKurz(z){ return (NA_MERKMAL_KURZ[z.typ]||'Text')+(z.einheit ? ' ('+z.einheit+')' : ''); }
function naMerkmalWo(z){
  const n = z.kategorien.length; const namen = z.kategorien.slice(0,3).map(k=>(k.kern?'★ ':'')+k.label).join(', ')+(n>3 ? ' … (+'+(n-3)+')' : '');
  if(z.allgemein) return 'für alle Kategorien'+(n ? ' · eigens bei: '+namen : '');
  return n ? namen : 'keiner Kategorie zugeordnet';
}
function naMerkmalListeHtml(z){
  const q = naNorm(NA_ML.q); const f = NA_ML_FILTER.find(x=>x.id===NA_ML.f) || NA_ML_FILTER[0];
  let t = z.filter(f.ok); if(q) t = t.filter(x=>x.such.indexOf(q)>=0);
  if(!t.length) return naLeer('🔎', 'Nichts gefunden', q ? 'Andere Schreibweise versuchen — oder das Merkmal mit „＋ Neues Merkmal" anlegen.' : 'Kein Merkmal in dieser Auswahl.');
  return t.map(x=>'<div class="na-eintrag'+(x.archiviert?' archiv':'')+'" data-na="geh" data-ziel="#/liste/merkmale/'+esc(encodeURIComponent(x.id))+'"><span class="na-ico">'+(NA_MERKMAL_ICO[x.typ]||'▤')+'</span>'
    + '<div class="na-haupt"><div class="na-name">'+esc(x.label)+(x.archiviert?' · archiviert':'')+'</div>'
    + '<div class="na-sub">'+esc(naMerkmalArtKurz(x))+' · '+esc(naMerkmalWo(x))+'</div>'
    + (x.eigen || x.geaendert.length ? '<div class="na-sub">'+esc(x.eigen ? 'eigenes Merkmal des Hauses' : 'vom Haus geändert: '+x.geaendert.join(', '))+'</div>' : '')
    + '</div><div class="na-rechts">'+(x.zahl ? x.zahl+'× ausgefüllt' : '')+'</div></div>').join('');
}
function naSichtMerkmale(){
  if(!naAdmin()) return { titel:'Merkmale', html: naLeer('🔒','Nur in der Verwaltung','') };
  const z = naMerkmalZeilen();
  if(!NA_ML_FILTER.some(f=>f.id===NA_ML.f && (f.id==='alle' || z.some(f.ok)))) NA_ML.f = 'alle';
  const chips = NA_ML_FILTER.map(f=>{ const n = z.filter(f.ok).length;
    return (n || f.id==='alle') ? '<button class="na-chip'+(NA_ML.f===f.id?' an':'')+'" data-na="mlFilter" data-f="'+f.id+'">'+esc(f.wort)+' ('+n+')</button>' : ''; }).join('');
  const h = '<div class="na-info">Alle Merkmale, die ein Material haben kann. Welche davon eine Maske zeigt, bestimmt die Kategorie des Materials (★ = Kern-Merkmal). Antippen: ansehen und ändern — Name, Hinweis, Auswahlwerte, Suchwörter, Kategorien.</div>'
    + '<div class="na-zeile" style="margin-bottom:8px"><button class="na-knopf pri" data-na="mlNeu">＋ Neues Merkmal</button></div>'
    + '<input class="na-suche" type="search" id="naMlQ" placeholder="Suchen: Name, Suchwort, Kategorie …" value="'+esc(NA_ML.q)+'" data-na-ein="mlSuche" autocomplete="off">'
    + '<div class="na-chips" style="margin-bottom:8px">'+chips+'</div>'
    + '<div id="naMlListe">'+naMerkmalListeHtml(z)+'</div>';
  return { titel:'Merkmale', pfad:z.filter(x=>!x.archiviert).length+' Merkmale', zurueck:'#/listen', html:h };
}
naEin('mlSuche', v=>{ NA_ML.q = v; const l = $('naMlListe'); if(l) l.innerHTML = naMerkmalListeHtml(naMerkmalZeilen()); });
naAkt('mlFilter', d=>{ NA_ML.f = d.f; const y = window.scrollY; naZeigen(); window.scrollTo(0, y); });
naAkt('mlNeu', async ()=>{
  const n = await naEingabe('Neues Merkmal: Name', { wert:NA_ML.q.trim(), platzhalter:'z. B. Kabellänge', hilfe:'Erst suchen lohnt sich: Viele Merkmale gibt es schon unter einem anderen Namen.' });
  if(!n) return;
  const tr = naAehnliche(n, naKat().merkmale.map(d=>({ id:d.id, name:d.label })));
  if(tr.length && !(await naFrage('Ähnlich: '+tr.slice(0,3).map(t=>'„'+t.item.name+'"').join(', ')+'. Trotzdem neu anlegen?', { ja:'Neu anlegen' }))) return;
  const mid = await naMerkmalAnlegen(n); if(mid) naGeh('#/liste/merkmale/'+encodeURIComponent(mid));
});

/* Die Seite EINES Merkmals. */
function naSichtMerkmal(mid){
  if(!naAdmin()) return { titel:'Merkmal', html: naLeer('🔒','Nur in der Verwaltung','') };
  const d = naMerkmalDef(mid); const z = d ? naMerkmalZeilen().find(x=>x.id===mid) : null;
  if(!d || !z) return { titel:'Merkmal', zurueck:'#/liste/merkmale', html: naLeer('❓','Nicht gefunden','Dieses Merkmal gibt es nicht (mehr).') };
  const eigen = z.eigen; const tpl = naKatTpl(); const mat = naAlle('material'); const nu = naMerkmalNutzungAlle(mat); const zw = nu.werte[mid] || {};
  const m = esc(mid); const leer = t=>'<span class="na-leer">'+t+'</span>';
  const feld = (name, wert, akt, sub)=>'<div class="na-eintrag'+(akt?'':' fest')+'"'+(akt ? ' data-na="'+akt+'" data-mid="'+m+'"' : '')+'><div class="na-haupt"><div class="na-sub">'+esc(name)+'</div><div class="na-name">'+wert+'</div>'
    + (sub ? '<div class="na-sub">'+sub+'</div>' : '')+'</div>'+(akt ? '<span class="chev">✎</span>' : '')+'</div>';
  const fest = 'fest — die Etikett-Erkennung rechnet damit';
  let h = '';
  if(d.archiviert) h += '<div class="na-info na-offen"><b>Archiviert.</b> Das Merkmal wird nicht mehr angeboten — weder in der Suche noch in einer Maske. Eingetragene Werte bleiben beim Material sichtbar.</div>';
  h += '<div class="na-info">'+(eigen ? 'Eigenes Merkmal des Hauses'+(d.angelegt ? ', angelegt '+esc(naDatum(d.angelegt)) : '')+'.' : 'Mitgeliefertes Merkmal'+(z.geaendert.length ? ' — vom Haus geändert: '+esc(z.geaendert.join(', ')) : '')+'.')
    + ' '+(z.zahl ? 'Bei <b>'+z.zahl+'</b> Material'+(z.zahl===1?'':'ien')+' ausgefüllt.' : 'Noch bei keinem Material ausgefüllt.')+'</div>';
  if(NA_NICHT_ALS_MERKMAL.indexOf(mid)>=0) h += '<div class="na-info">Steht in der Material-Maske an eigener Stelle: '+(mid==='stueck_packung' ? '„Packung und Preis" (Packungsgröße)' : '„Steril · Einmal · Latex"')+'.</div>';

  h += '<div class="na-h">Angaben</div>';
  h += feld('Name', esc(d.label), 'mmName', d.vorgabeLabel ? 'Vorgabe: '+esc(d.vorgabeLabel) : '');
  h += feld('Art', esc(NA_MERKMAL_ARTEN[d.typ]||d.typ||'Text'), eigen ? 'mmArt' : '', eigen ? '' : fest);
  if(d.typ==='mass' || d.typ==='zahl') h += feld('Einheit', d.einheit ? esc(d.einheit) : leer('keine'), eigen ? 'mmEinheit' : '', eigen ? 'steht hinter dem Namen des Felds und hinter dem Wert' : fest);
  h += feld('Hinweis unter dem Feld', d.hinweis ? esc(d.hinweis) : leer('keiner'), 'mmHinweis', '');
  h += feld('Suchwörter', (d.such||[]).length ? esc(d.such.join(', ')) : leer('keine'), 'mmSuch', 'andere Wörter, unter denen man das Merkmal findet');

  if(d.typ==='liste'){
    const w = d.werte || []; const aus = ((tpl.werteAus||{})[mid]) || [];
    h += '<div class="na-h">Auswahlwerte ('+w.length+')</div>';
    h += w.length ? w.map(x=>'<div class="na-eintrag" data-na="mmWert" data-mid="'+m+'" data-w="'+esc(x)+'"><span class="na-ico">○</span><div class="na-haupt"><div class="na-name">'+esc(x)+'</div></div><div class="na-rechts">'+(zw[x] ? zw[x]+'×' : '')+'</div></div>').join('')
                  : '<div class="na-dim">Noch keine — Werte lassen sich auch beim Ausfüllen in der Maske anlegen.</div>';
    h += aus.map(x=>'<div class="na-eintrag archiv" data-na="mmWert" data-mid="'+m+'" data-w="'+esc(x)+'" data-aus="1"><span class="na-ico">○</span><div class="na-haupt"><div class="na-name">'+esc(x)+'</div><div class="na-sub">Wert der Vorgabe — wird nicht mehr angeboten</div></div><div class="na-rechts">'+(zw[x] ? zw[x]+'×' : '')+'</div></div>').join('');
    const fremd = Object.keys(zw).filter(x=>w.indexOf(x)<0 && aus.indexOf(x)<0);
    if(fremd.length) h += '<div class="na-dim" style="margin:4px">Eingetragen, aber nicht in der Liste: '+esc(fremd.map(x=>x+' ('+zw[x]+'×)').join(', '))+'</div>';
    h += '<div class="na-zeile" style="margin:8px 0"><button class="na-knopf" data-na="mmWertNeu" data-mid="'+m+'">＋ Wert</button></div>';
  } else if(d.typ!=='ja_nein' && z.zahl){
    const top = Object.keys(zw).sort((a,b)=>zw[b]-zw[a] || a.localeCompare(b, 'de', { numeric:true }));
    h += '<div class="na-h">Eingetragene Werte ('+top.length+')</div><div class="na-chips" style="margin:0 4px 8px">'
      + top.slice(0, 20).map(x=>'<span class="na-chip ersatz">'+esc(x+(d.einheit ? ' '+d.einheit : ''))+(zw[x]>1 ? ' · '+zw[x]+'×' : '')+'</span>').join('')+(top.length>20 ? '<span class="na-dim">… und '+(top.length-20)+' weitere</span>' : '')+'</div>';
  }

  h += '<div class="na-h">Kategorien ('+z.kategorien.length+')</div>';
  if(z.allgemein) h += '<div class="na-info">Gilt für <b>alle Kategorien</b>: steht in jeder Material-Maske unter „Seltene Angaben".</div>';
  h += z.kategorien.map(k=>{ const nk = naMerkmalNutzung(mat, k.id);
    return '<div class="na-eintrag" data-na="katMerkmal" data-k="'+esc(k.id)+'" data-mid="'+m+'"><span class="na-ico">'+(k.kern?'★':'▤')+'</span><div class="na-haupt"><div class="na-name">'+esc(k.label)+'</div>'
      + '<div class="na-sub">'+(k.kern ? 'Kern-Merkmal: steht oben in der Maske und geht in den Namensvorschlag ein' : 'weiteres Merkmal')+'</div></div><div class="na-rechts">'+(nk.n ? (nk.zahl[mid]||0)+' von '+nk.n : '')+'</div></div>'; }).join('');
  if(!z.kategorien.length && !z.allgemein) h += '<div class="na-dim" style="margin:4px">Noch keiner Kategorie zugeordnet: Das Merkmal erscheint in keiner Maske von selbst, lässt sich dort aber über „＋ Merkmal suchen oder anlegen" hinzufügen.</div>';
  if(!d.archiviert) h += '<div class="na-zeile" style="margin:8px 0"><button class="na-knopf" data-na="mmKatDazu" data-mid="'+m+'">＋ Kategorie zuordnen</button></div>';

  const mit = mat.filter(o=>{ const v = (o.merkmale||{})[mid]; return !(v==null || v==='' || v===false); });
  h += '<div class="na-h">Ausgefüllt bei ('+mit.length+')</div>';
  h += mit.length ? mit.slice(0, 12).map(o=>{ const v = o.merkmale[mid];
      return '<div class="na-eintrag" data-na="geh" data-ziel="#/material/'+esc(o.id)+'"><span class="na-ico">📦</span><div class="na-haupt"><div class="na-name">'+esc(o.name||'(ohne Namen)')+'</div><div class="na-sub">'+esc(String(v===true?'ja':v)+(d.einheit && d.typ!=='ja_nein' ? ' '+d.einheit : ''))+'</div></div><span class="chev">›</span></div>'; }).join('')
      + (mit.length>12 ? '<div class="na-dim" style="margin:4px">… und '+(mit.length-12)+' weitere.</div>' : '')
    : '<div class="na-dim" style="margin:4px">Bei keinem Material.</div>';

  if(!eigen){ const an = (d.anker||[]).filter(Boolean);
    h += '<details class="na-ab" style="margin-top:14px"><summary><span>Etikett-Erkennung</span><span class="na-ab-n">fest</span></summary><div class="na-ab-in"><div class="na-dim">Daran erkennt die App das Merkmal im Text eines Etiketts. Diese Angaben sind mitgeliefert und hier nicht änderbar.</div>'
      + '<div style="margin-top:6px">Stichwörter: '+(an.length ? esc(an.join(', ')) : '—')+'</div>'
      + (Array.isArray(d.fenster) && d.fenster.length===2 ? '<div>Plausibler Bereich: '+esc(String(d.fenster[0]).replace('.', ','))+' bis '+esc(String(d.fenster[1]).replace('.', ','))+(d.einheit ? ' '+esc(d.einheit) : '')+'</div>' : '')
      + '<div>Eigene Schreibmuster: '+((d.muster||[]).length ? 'ja ('+d.muster.length+')' : 'nein')+'</div></div></details>'; }

  const zurueck = z.geaendert.filter(x=>x!=='Kategorien');
  h += '<div class="na-zeile" style="margin:14px 0;flex-wrap:wrap">'
    + (!eigen && zurueck.length ? '<button class="na-knopf" data-na="mmVorgabe" data-mid="'+m+'">↺ Vorgabe zurückholen</button>' : '')
    + '<button class="na-knopf" data-na="mmArchiv" data-mid="'+m+'">'+(d.archiviert ? '↩ Zurückholen' : '🗄 Archivieren')+'</button>'
    + (eigen && !z.zahl ? '<button class="na-knopf weg" data-na="mmLoeschen" data-mid="'+m+'">Löschen</button>' : '')+'</div>';
  h += '<div class="na-dim">Kennung: <span class="na-mono">'+m+'</span></div>';
  return { titel:d.label, pfad:'Merkmal · '+naMerkmalArtKurz(z), zurueck:'#/liste/merkmale', html:h };
}
function naMerkmalAendern(mid, feld, wert, was){ naKatTplSpeichern(naTplMerkmalSetzen(naKatTpl(), NA_MERKQUELLE, mid, feld, wert), was); }
naAkt('mmName', async d=>{ const def = naMerkmalDef(d.mid); if(!def) return;
  const n = await naEingabe('Name des Merkmals', { wert:def.label, hilfe: def.vorgabeLabel ? 'Vorgabe: „'+def.vorgabeLabel+'". Leer lassen holt sie zurück.' : 'So heißt das Feld in jeder Maske. Eingetragene Werte bleiben, wie sie sind.' });
  if(n==null || n===def.label || (!n && !def.vorgabeLabel)) return;
  const doppelt = n && naKat().merkmale.find(x=>x.id!==d.mid && !x.archiviert && naNorm(x.label)===naNorm(n));
  if(doppelt && !(await naFrage('„'+doppelt.label+'" gibt es schon. Trotzdem so nennen?', { ja:'So nennen', mehr:'Zwei Merkmale mit demselben Namen lassen sich in der Suche nicht unterscheiden.' }))) return;
  naMerkmalAendern(d.mid, 'label', n, 'Merkmal „'+def.label+'" heißt jetzt „'+(n || def.vorgabeLabel)+'"'); toast(n ? 'Umbenannt' : 'Name der Vorgabe zurückgeholt'); naZeigen(); });
naAkt('mmHinweis', async d=>{ const def = naMerkmalDef(d.mid); if(!def) return;
  const t = await naEingabe('Hinweis unter dem Feld: '+def.label, { wert:def.hinweis||'', platzhalter:'z. B. laut Aufbereitungsanweisung des Herstellers', hilfe:'Ein kurzer Satz, der in der Maske unter dem Feld steht. Leer = kein Hinweis.' });
  if(t==null || t===(def.hinweis||'')) return;
  naMerkmalAendern(d.mid, 'hinweis', t, 'Hinweis von „'+def.label+'" geändert'); toast(t ? 'Hinweis gespeichert' : 'Hinweis entfernt'); naZeigen(); });
naAkt('mmEinheit', async d=>{ const def = naMerkmalDef(d.mid); if(!def || !def.eigen) return;
  const t = await naEingabe('Einheit: '+def.label, { wert:def.einheit||'', platzhalter:'z. B. cm, mm, F, ml, Stück', hilfe:'Steht hinter dem Namen des Felds und hinter dem Wert. Leer = keine Einheit.' });
  if(t==null || t===(def.einheit||'')) return;
  naMerkmalAendern(d.mid, 'einheit', t, 'Einheit von „'+def.label+'": '+(t||'keine')); toast('Einheit gespeichert'); naZeigen(); });
naAkt('mmArt', async d=>{ const def = naMerkmalDef(d.mid); if(!def || !def.eigen) return;
  const n = (naMerkmalNutzungAlle(naAlle('material')).zahl[d.mid]) || 0;
  const art = (id, ico, name, sub)=>'<button class="sheet-act" data-na="sheetWert" data-wert="'+id+'"><span class="sa-ico">'+(def.typ===id ? '●' : ico)+'</span><span>'+name+'<span class="sa-sub">'+sub+'</span></span></button>';
  const w = await naSheetAuf('<div class="sheet-title">Art des Merkmals</div><div class="sheet-name">'+esc(def.label)+'</div>'
    + art('text', '✎', 'Text', 'frei getippt') + art('zahl', '#', 'Zahl', 'mit oder ohne Einheit') + art('liste', '☰', 'Auswahl', 'feste Werte zum Antippen') + art('ja_nein', '☑', 'Ja / Nein', 'ein Häkchen')
    + (n ? '<div class="na-dim">Bei '+n+' Material'+(n===1?'':'ien')+' ausgefüllt — die eingetragenen Werte bleiben, wie sie sind.</div>' : ''));
  if(!w || w===def.typ) return;
  naMerkmalAendern(d.mid, 'typ', w, 'Art von „'+def.label+'": '+NA_MERKMAL_KURZ[w]); toast('Art geändert'); naZeigen(); });
naAkt('mmSuch', async d=>{ await naMerkmalSuchAendern(d.mid); naZeigen(); });
naAkt('mmWertNeu', async d=>{ const def = naMerkmalDef(d.mid); if(!def) return;
  const w = await naEingabe('Neuer Wert: '+def.label, { hilfe:'Erscheint in der Maske zur Auswahl.' }); if(!w) return;
  if((def.werte||[]).some(x=>naNorm(x)===naNorm(w))){ toast('Diesen Wert gibt es schon.', true); return; }
  naKatTplSpeichern(naTplWert(naKatTpl(), NA_MERKQUELLE, d.mid, 'dazu', w), 'Wert „'+w+'" bei „'+def.label+'" angelegt'); naZeigen(); });
naAkt('mmWert', async d=>{ const def = naMerkmalDef(d.mid); if(!def) return; const alt = d.w;
  const betroffen = naAlle('material', true).filter(o=>(o.merkmale||{})[d.mid]===alt); const n = betroffen.length;
  const bei = n ? 'bei '+n+' Material'+(n===1?'':'ien')+' eingetragen' : 'bei keinem Material eingetragen';
  const w = await naSheetAuf('<div class="sheet-title">Wert von „'+esc(def.label)+'"</div><div class="sheet-name">'+esc(alt)+'</div>'
    + (d.aus ? '<button class="sheet-act" data-na="sheetWert" data-wert="zurueck"><span class="sa-ico">↩</span><span>Wieder anbieten<span class="sa-sub">'+bei+'</span></span></button>'
      : '<button class="sheet-act" data-na="sheetWert" data-wert="um"><span class="sa-ico">✎</span><span>Umbenennen<span class="sa-sub">'+(n ? 'ändert den Wert auch dort, wo er eingetragen ist ('+n+'×)' : bei)+'</span></span></button>'
      + '<button class="sheet-act danger" data-na="sheetWert" data-wert="weg"><span class="sa-ico">✕</span><span>Nicht mehr anbieten<span class="sa-sub">'+(n ? bei+' — dort bleibt er stehen' : bei)+'</span></span></button>'));
  if(!w) return;
  if(w==='um'){
    const neu = await naEingabe('Wert umbenennen', { wert:alt }); if(!neu || neu===alt) return;
    naKatTplSpeichern(naTplWert(naKatTpl(), NA_MERKQUELLE, d.mid, 'um', alt, neu), 'Wert „'+alt+'" → „'+neu+'" bei „'+def.label+'"');
    betroffen.forEach(o=>{ const c = JSON.parse(JSON.stringify(o)); c.merkmale[d.mid] = neu; naSpeichern('material', c, def.label+': „'+alt+'" → „'+neu+'"'); });
    toast('Umbenannt'+(n ? ' — '+n+' Material'+(n===1?'':'ien')+' angepasst' : ''));
  } else {
    naKatTplSpeichern(naTplWert(naKatTpl(), NA_MERKQUELLE, d.mid, w, alt), 'Wert „'+alt+'" bei „'+def.label+'" '+(w==='weg' ? 'wird nicht mehr angeboten' : 'wird wieder angeboten'));
  }
  naZeigen(); });
naAkt('mmKatDazu', async d=>{ const def = naMerkmalDef(d.mid); if(!def) return; const kat = naKat();
  const frei = kat.klassen.filter(k=>k.id!=='allgemein' && !k.archiviert && (def.klassen||[]).indexOf(k.id)<0);
  const kid = await naAuswahl({ titel:'„'+def.label+'" zuordnen zu …', items: frei.map(k=>({ id:k.id, name:k.label, sub:naKatMerkmaleSub(k.id) })) });
  if(!kid || typeof kid!=='string') return; const k = kat.klassen.find(x=>x.id===kid); if(!k) return;
  const n = naAlle('material').filter(o=>o.kategorie===kid).length;
  const stufe = await naSheetAuf('<div class="sheet-title">„'+esc(def.label)+'" in „'+esc(k.label)+'"</div>'
    + '<button class="sheet-act" data-na="sheetWert" data-wert="weiter"><span class="sa-ico">▤</span><span>Weiteres Merkmal<span class="sa-sub">erscheint künftig in jeder Maske dieser Kategorie'+(n ? ' ('+n+' Material'+(n===1?'':'ien')+')' : '')+' — darf leer bleiben</span></span></button>'
    + '<button class="sheet-act" data-na="sheetWert" data-wert="kern"><span class="sa-ico">★</span><span>Kern-Merkmal<span class="sa-sub">steht oben in der Maske und geht in den Namensvorschlag ein</span></span></button>');
  if(!stufe) return;
  naMerkmalKategorieSetzen(kid, d.mid, stufe); toast('„'+def.label+'" gilt jetzt für alle „'+k.label+'"'+(stufe==='kern' ? ' (Kern ★)' : '')+'.'); naZeigen(); });
naAkt('mmVorgabe', async d=>{ const def = naMerkmalDef(d.mid); if(!def) return;
  const was = naMerkmalGeaendert(naKatTpl(), d.mid);
  if(!(await naFrage('Vorgabe von „'+(def.vorgabeLabel || def.label)+'" zurückholen?', { ja:'Zurückholen', mehr:'Verworfen wird, was das Haus selbst festgelegt hat: '+esc(was.join(', '))+'. Die Zuordnung zu Kategorien und alle eingetragenen Werte bleiben.' }))) return;
  naKatTplSpeichern(naTplMerkmalZurueck(naKatTpl(), d.mid), 'Merkmal „'+def.label+'": Vorgabe zurückgeholt'); toast('Vorgabe zurückgeholt'); naZeigen(); });
naAkt('mmArchiv', async d=>{ const def = naMerkmalDef(d.mid); if(!def) return;
  if(!def.archiviert){ const n = (naMerkmalNutzungAlle(naAlle('material')).zahl[d.mid]) || 0;
    if(!(await naFrage('„'+def.label+'" archivieren?', { ja:'Archivieren', mehr:'Das Merkmal wird nicht mehr angeboten — weder in der Suche noch in einer Maske.'+(n ? ' Bei '+n+' Material'+(n===1?'':'ien')+' bleibt der eingetragene Wert sichtbar.' : '')+' Zurückholen: in der Merkmal-Liste unter „archiviert".' }))) return; }
  naMerkmalAendern(d.mid, 'archiviert', !def.archiviert, 'Merkmal „'+def.label+'" '+(def.archiviert ? 'zurückgeholt' : 'archiviert')); toast(def.archiviert ? 'Zurückgeholt' : 'Archiviert'); naZeigen(); });
naAkt('mmLoeschen', async d=>{ const def = naMerkmalDef(d.mid); if(!def || !def.eigen) return;
  if(naMerkmalNutzungAlle(naAlle('material', true)).zahl[d.mid]){ toast('Das Merkmal ist bei einem Material ausgefüllt — archivieren statt löschen.', true); return; }
  if(!(await naFrage('„'+def.label+'" löschen?', { ja:'Löschen', mehr:'Das eigene Merkmal verschwindet samt seiner Zuordnung zu Kategorien. Es ist bei keinem Material ausgefüllt.' }))) return;
  naKatTplSpeichern(naTplMerkmalLoeschen(naKatTpl(), d.mid), 'Merkmal „'+def.label+'" gelöscht'); toast('Gelöscht'); naGeh('#/liste/merkmale'); });

/* ── Suchwörter einer Kategorie (Grundsatz A7) ──
   An ihnen erkennt die Maske die Kategorie im Namen eines Materials („Hahn" →
   Infusion / Leitung / Hahn). Das Haus legt sie selbst fest; für eine
   mitgelieferte Kategorie lässt sich die Vorgabe jederzeit zurückholen. */
function naKatWorte(id){ const k = naKat().klassen.find(x=>x.id===id); return (k && k.worte) || []; }
function naKatWorteKnopf(id){
  const w = naKatWorte(id); const eigene = Array.isArray(((naKatTpl().klassen||{})[id]||{}).worte);
  const k = naKat().klassen.find(x=>x.id===id) || {};
  return '<button class="sheet-act" data-na="sheetWert" data-wert="worte"><span class="sa-ico">🔎</span><span>Suchwörter ändern<span class="sa-sub">'
    + esc(w.length ? w.slice(0, 12).join(', ')+(w.length>12 ? ' …' : '') : 'keine — wird nie vorgeschlagen')+'</span></span></button>'
    + (eigene && !k.eigen ? '<button class="sheet-act" data-na="sheetWert" data-wert="worteVorgabe"><span class="sa-ico">↺</span><span>Suchwörter der Vorgabe zurückholen</span></button>' : '');
}
async function naKatWorteAendern(id, vorgabe){
  const tpl = JSON.parse(JSON.stringify(naKatTpl())); tpl.klassen = tpl.klassen || {};
  const k = tpl.klassen[id] = Object.assign({}, tpl.klassen[id] || {});
  const name = naListeName('kategorien', id);
  if(vorgabe){ delete k.worte; naKatTplSpeichern(tpl, 'Suchwörter von „'+name+'" auf die Vorgabe zurückgesetzt'); toast('Vorgabe zurückgeholt'); return; }
  const t = await naEingabe('Suchwörter: '+name, { wert: naKatWorte(id).join(', '), platzhalter:'z. B. hahn, dreiwegehahn, discofix',
    hilfe:'Mit Komma trennen. Steht eines dieser Wörter im Namen eines Materials, wird diese Kategorie vorgeschlagen; das längste passende Wort gewinnt. Wörter unter 5 Zeichen zählen nur als ganzes Wort. Leer = nie vorschlagen.' });
  if(t==null) return;
  const liste = []; t.split(/[,;\n]/).map(x=>x.trim().toLowerCase()).filter(x=>x.length>=3).forEach(x=>{ if(liste.indexOf(x)<0) liste.push(x); });
  k.worte = liste;
  naKatTplSpeichern(tpl, 'Suchwörter von „'+name+'" geändert');
  toast(liste.length ? liste.length+' Suchwörter gespeichert' : 'Keine Suchwörter — wird nicht mehr vorgeschlagen');
}

/* ── Meldungen (A2: gemeldet · weitergegeben · erledigt — keine Bestellung) ── */
const NA_STUFEN = ['gemeldet','weitergegeben','erledigt'];
function naSichtMeldungen(){
  const alle = naAlle('meldung').sort((a,b)=>String(b.angelegt).localeCompare(String(a.angelegt)));
  let h = '<div class="na-info">Meldungen kommen von „Melden" an einem Material, Gerät oder Medikament. Die App bestellt nichts — sie hält fest, was gemeldet und weitergegeben wurde.</div>';
  NA_STUFEN.forEach(st=>{
    const l = alle.filter(m=>(m.stufe||'gemeldet')===st); if(!l.length) return;
    h += '<div class="na-h">'+esc(st)+' ('+l.length+')</div>' + l.map(m=>'<div class="na-eintrag" data-na="meldungAkt" data-id="'+esc(m.id)+'"><span class="na-ico">'+(st==='erledigt'?'✓':'📣')+'</span><div class="na-haupt"><div class="na-name">'+esc(m.name)+' — '+esc(m.was)+'</div><div class="na-sub">'+esc(naDatum(m.angelegt))+(m.notiz?' · '+esc(m.notiz):'')+'</div></div></div>').join('');
  });
  if(!alle.length) h += naLeer('📣','Keine Meldungen','');
  return { titel:'Meldungen', zurueck:'#/mehr', html:h };
}
naAkt('meldungAkt', async d=>{
  const m = naHole('meldung', d.id); if(!m) return;
  const i = NA_STUFEN.indexOf(m.stufe||'gemeldet');
  const w = await naSheetAuf('<div class="sheet-name">'+esc(m.name)+' — '+esc(m.was)+'</div>'
    + (m.schritte||[]).map(s=>'<div class="na-dim">'+esc(naDatum(s.t))+' · '+esc(s.stufe)+' · '+esc(s.wer||'')+'</div>').join('')
    + (naAdmin() && i<2 ? '<button class="sheet-act" data-na="sheetWert" data-wert="weiter" style="margin-top:10px"><span class="sa-ico">→</span><span>Als „'+NA_STUFEN[i+1]+'" markieren</span></button>' : '')
    + (m.ref ? '<button class="sheet-act" data-na="geh" data-ziel="#/'+m.ref.typ+'/'+esc(m.ref.id)+'"><span class="sa-ico">'+NA_TYPEN[m.ref.typ].ico+'</span><span>Eintrag öffnen</span></button>' : '')
    + (naAdmin() && i===2 ? '<button class="sheet-act danger" data-na="sheetWert" data-wert="weg"><span class="sa-ico">×</span><span>Meldung entfernen</span></button>' : ''));
  if(w==='weiter'){ m.stufe = NA_STUFEN[i+1]; m.schritte = (m.schritte||[]).concat([{ stufe:m.stufe, t:naJetzt(), wer:naGeraetName() }]); naSpeichern('meldung', m, m.stufe); naVerlauf({ typ:'meldung', id:m.id, titel:m.name, was:m.stufe }); }
  if(w==='weg'){ delete NA.meldung[m.id]; naAbgleich.schreiben(NA_TYPEN.meldung.p+m.id, null); }
  naZeigen();
});

/* ── Verlauf ── */
let NA_VL_Q = '';
function naSichtVerlauf(){
  if(!naAdmin()) return { titel:'Verlauf', html: naLeer('🔒','Nur in der Verwaltung','') };
  return { titel:'Verlauf', zurueck:'#/mehr', html:'<input class="na-suche" type="search" placeholder="Im Verlauf suchen …" value="'+esc(NA_VL_Q)+'" data-na-ein="vlSuche"><div id="naVlListe">'+naVerlaufListe()+'</div>' };
}
function naVerlaufListe(){
  const q = naNorm(NA_VL_Q);
  const alle = naVerlaufAlle().filter(e=>!q || naNorm([e.titel, e.was, e.wer, (NA_TYPEN[e.typ]||{}).wort].join(' ')).indexOf(q)>=0);
  if(!alle.length) return naLeer('🕘','Noch nichts im Verlauf','');
  return alle.slice(0, 400).map(e=>'<div class="na-eintrag" style="cursor:default"><span class="na-ico">'+((NA_TYPEN[e.typ]||{}).ico||'•')+'</span><div class="na-haupt"><div class="na-name">'+esc(e.titel||'')+'</div><div class="na-sub">'+esc(e.was||'')+((e.felder||[]).length?' ('+esc(e.felder.join(', '))+')':'')+'</div></div><div class="na-rechts">'+esc(naDatum(e.t))+'<br>'+esc(e.wer||'')+'</div></div>').join('');
}
naEin('vlSuche', v=>{ NA_VL_Q = v; const l = $('naVlListe'); if(l) l.innerHTML = naVerlaufListe(); });

/* ── Papierkorb ── */
function naSichtPapierkorb(){
  if(!naAdmin()) return { titel:'Papierkorb', html: naLeer('🔒','Nur in der Verwaltung','') };
  const l = Object.keys(NA.papierkorb).map(k=>NA.papierkorb[k]).sort((a,b)=>String(b.geloescht).localeCompare(String(a.geloescht)));
  return { titel:'Papierkorb', zurueck:'#/mehr', html: l.length ? l.map(p=>'<div class="na-eintrag" data-na="pkAkt" data-id="'+esc(p.id)+'"><span class="na-ico">'+((NA_TYPEN[p.typ]||{}).ico||'•')+'</span><div class="na-haupt"><div class="na-name">'+esc(naTitel(p.daten))+'</div><div class="na-sub">'+esc((NA_TYPEN[p.typ]||{}).wort||'')+' · gelöscht '+esc(naDatum(p.geloescht))+' · '+esc(p.von||'')+'</div></div></div>').join('') : naLeer('🗑','Papierkorb ist leer','') };
}
naAkt('pkAkt', async d=>{
  const p = NA.papierkorb[d.id]; if(!p) return;
  const w = await naSheetAuf('<div class="sheet-name">'+esc(naTitel(p.daten))+'</div>'
    + '<button class="sheet-act" data-na="sheetWert" data-wert="zurueck"><span class="sa-ico">↩</span><span>Wiederherstellen<span class="sa-sub">Verwendungen in Standards greifen wieder</span></span></button>'
    + '<button class="sheet-act danger" data-na="sheetWert" data-wert="weg"><span class="sa-ico">×</span><span>Endgültig löschen</span></button>');
  if(w==='zurueck'){ naWiederherstellen(d.id); toast('Wiederhergestellt'); }
  if(w==='weg' && await naFrage('Endgültig löschen? Das lässt sich nicht rückgängig machen.', { ja:'Endgültig löschen', gefahr:true })) naEndgueltig(d.id);
  naZeigen();
});

/* ── Kostenübersicht ── */
function naSichtKostenAlle(){
  if(!naAdmin()) return { titel:'Kosten', html: naLeer('🔒','Nur in der Verwaltung','') };
  const l = naAlle('standard').map(s=>({ s, k:naKostenVon(s) }));
  return { titel:'Kostenübersicht', zurueck:'#/mehr', html:
    '<div class="na-info">Plankosten aus Menge × Stückpreis. Unklare Mengen und fehlende Preise werden als Lücke gezeigt, nie geschätzt. Überblick für Controlling, Einkauf und Chefarzt — die App bestellt nichts.</div>'
    + '<table class="na-tab-tbl"><tr><th>Standard</th><th class="z">Plankosten</th><th class="z">Lücken</th></tr>'
    + l.map(x=>'<tr class="'+(x.k.vollstaendig?'':'luecke')+'"><td><a href="#/s/'+esc(x.s.id)+'/kosten">'+esc(x.s.titel)+'</a></td><td class="z">'+naEuro(x.k.summe)+'</td><td class="z">'+(x.k.fehlend||'')+'</td></tr>').join('')
    + '</table><div style="margin:12px 0"><button class="na-knopf" data-na="kostenCsvAlle">⬇ Alle als CSV (Excel)</button></div>' };
}
naAkt('kostenCsvAlle', ()=>naHerunterladen('Kosten alle Standards.csv', '﻿'+naCsv(naKostenZeilen(naAlle('standard'))), 'text/csv;charset=utf-8'));

/* ── Sicherung ── */
const NA_SICHERUNG_FORMAT = 'hkl-neue-app-sicherung';
function naSicherungDaten(){
  const daten = {}; naAbgleich.schluessel().filter(k=>/^na_/.test(k)).forEach(k=>{ const v = naAbgleich.lesen(k); if(v!=null) daten[k] = v; });
  return { format:NA_SICHERUNG_FORMAT, version:1, erstellt:naJetzt(), geraet:naGeraetName(), daten };
}
let NA_IMPORT = null;
function naSichtSicherung(){
  if(!naAdmin()) return { titel:'Sicherung', html: naLeer('🔒','Nur in der Verwaltung','') };
  let h = '<div class="na-karte"><h3>Sichern</h3><div class="na-dim">Alle Daten der neuen App als eine Datei (ohne Bilder — die liegen auf dem Server und werden dort mitgesichert).</div><div style="margin-top:8px"><button class="na-knopf pri" data-na="sichern">⬇ Sicherung herunterladen</button></div></div>';
  h += '<div class="na-karte"><h3>Einspielen</h3><div class="na-dim">Erst wird gezeigt, was sich ändern würde. Nichts wird ohne Bestätigung überschrieben.</div><div style="margin-top:8px"><button class="na-knopf" data-na="einspielenWahl">Datei wählen …</button></div>';
  if(NA_IMPORT){
    const v = NA_IMPORT.vorschau;
    h += '<div class="na-info" style="margin-top:10px">Datei vom '+esc(naDatum(NA_IMPORT.datei.erstellt))+(NA_IMPORT.datei.geraet?' ('+esc(NA_IMPORT.datei.geraet)+')':'')+': '+v.neu+' neu · '+v.anders+' geändert · '+v.gleich+' gleich · '+v.nurHier+' nur hier vorhanden</div>'
      + '<button class="sheet-act" data-na="einspielen" data-art="zusammen"><span class="sa-ico">⇉</span><span>Zusammenführen<span class="sa-sub">Neues und Geändertes übernehmen; was nur hier ist, bleibt</span></span></button>'
      + '<button class="sheet-act danger" data-na="einspielen" data-art="ersetzen"><span class="sa-ico">⟲</span><span>Ersetzen<span class="sa-sub">Stand der Datei herstellen; '+v.nurHier+' Objekt(e), die nur hier sind, werden entfernt</span></span></button>';
  }
  h += '</div>';
  return { titel:'Sicherung', zurueck:'#/mehr', html:h };
}
naAkt('sichern', ()=>naHerunterladen('HKL neue App Sicherung '+naJetzt().slice(0,10)+'.json', JSON.stringify(naSicherungDaten(), null, 1), 'application/json'));
naAkt('einspielenWahl', async ()=>{
  const f = await naDateiWaehlen(false); if(!f) return;
  let j; try{ j = JSON.parse(await naDateiAlsText(f)); }catch(e){ toast('Datei ist kein gültiges JSON.', true); return; }
  if(!j || j.format!==NA_SICHERUNG_FORMAT || !j.daten || typeof j.daten!=='object'){ toast('Das ist keine Sicherung der neuen App.', true); return; }
  const hier = naSicherungDaten().daten; const v = { neu:0, anders:0, gleich:0, nurHier:0 };
  Object.keys(j.daten).forEach(k=>{ if(!/^na_/.test(k)) return; if(!(k in hier)) v.neu++; else if(JSON.stringify(hier[k])===JSON.stringify(j.daten[k])) v.gleich++; else v.anders++; });
  Object.keys(hier).forEach(k=>{ if(!(k in j.daten)) v.nurHier++; });
  NA_IMPORT = { datei:j, vorschau:v }; naZeigen();
});
naAkt('einspielen', async d=>{
  if(!NA_IMPORT) return;
  const j = NA_IMPORT.datei; const ersetzen = d.art==='ersetzen';
  if(!(await naFrage(ersetzen ? 'Wirklich den Stand der Datei herstellen?' : 'Neues und Geändertes übernehmen?', { ja: ersetzen ? 'Ersetzen' : 'Zusammenführen', gefahr:ersetzen }))) return;
  const vorher = naSicherungDaten();
  naHerunterladen('HKL neue App vor dem Einspielen '+naJetzt().slice(0,16).replace(/:/g,'-')+'.json', JSON.stringify(vorher), 'application/json');
  let n = 0;
  Object.keys(j.daten).forEach(k=>{ if(!/^na_/.test(k)) return; if(JSON.stringify(vorher.daten[k])!==JSON.stringify(j.daten[k])){ naAbgleich.schreiben(k, j.daten[k]); naSchluesselLaden(k); n++; } });
  if(ersetzen) Object.keys(vorher.daten).forEach(k=>{ if(!(k in j.daten)){ naAbgleich.schreiben(k, null); naSchluesselLaden(k); n++; } });
  naVerlauf({ typ:'liste', id:'sicherung', titel:'Sicherung', was:(ersetzen?'ersetzt':'zusammengeführt')+' ('+n+' Objekte)' });
  NA_IMPORT = null; toast(n+' Objekte übernommen. Der vorige Stand wurde zur Sicherheit heruntergeladen.'); naZeigen();
});

/* ── Einstellungen ── */
function naSichtEinstellungen(){
  const a = naAdmin(); const live = raumLiveGemerkt();
  if(a && naEinstellung('register', true) && !NA_REGSTAND.laedt && Date.now()-(NA_REGSTAND.geholt||0) > 30000) naRegisterStandHolen(false);
  let h = '<div class="na-karte"><h3>Ansicht</h3><button class="na-knopf" data-na="thema">◐ Hell / Dunkel</button></div>';
  h += '<div class="na-karte"><h3>Dieses Gerät</h3>'+naF('Name des Geräts (für Verlauf und Papierkorb)', '<input type="text" value="'+esc(naGeraet().name)+'" placeholder="z. B. Saal 2 Tablet" data-na-wechsel="geraetName">', 'Kein Personenname nötig — es geht um das Gerät.')+'</div>';
  if(a) h += '<div class="na-karte"><h3>Passwort der Verwaltung (neue App)</h3>'
    + naF('Neues Passwort', '<input type="password" id="naPw1" autocomplete="new-password">') + naF('Noch einmal', '<input type="password" id="naPw2" autocomplete="new-password">')
    + '<button class="na-knopf" data-na="pwSetzen">Passwort ändern</button><div class="na-dim" style="margin-top:6px">Gilt auf allen Geräten. Komfort, keine Sicherheit (Grundsatz A9).</div></div>';
  if(a) h += '<div class="na-karte"><h3>EU-Register</h3><div class="na-feld"><label><input type="checkbox" data-na-wechsel="registerAn"'+(naEinstellung('register', true)?' checked':'')+'> Beim Scannen eines Barcodes das Register fragen</label></div>'
    + '<div class="na-dim">Der Server der App fragt mit der GTIN bei EUDAMED (EU) und, wenn dort nichts steht, bei GUDID (USA) nach Hersteller, Handelsname und REF. Übertragen wird nur die GTIN — keine Daten des Hauses. Die Angaben gelten erst nach dem Speichern als bestätigt. Gilt für alle Geräte.</div>'
    + '<div id="naRegStand" style="margin-top:10px">'+naRegisterStandHtml()+'</div></div>';
  h += '<div class="na-karte"><h3>Raum</h3><div class="na-dim">Diese App ist der <b>Neuaufbau</b>. '+(live==='neuaufbau' ? 'Er ist <b>live</b> — alle Geräte ohne eigene Wahl arbeiten hier.' : 'Live (im Labor) ist der <b>Bestand</b>; er bleibt hiervon unberührt.')+'</div>'
    + '<div style="margin-top:8px"><button class="na-knopf" data-na="zumBestand">'+(live==='neuaufbau' ? '↩ Alten Bestand ansehen' : '↩ Zurück zum Bestand')+'</button></div></div>';
  if(a) h += '<div class="na-karte"><h3>Live schalten</h3><div class="na-dim">Schaltet ALLE Geräte ohne eigene Raumwahl um. Daten werden nicht bewegt; Zurückschalten ist dieselbe Handbewegung. '
    + 'Verlangt das Zweitpasswort (das Passwort des Neuaufbaus aus der Verwaltung des Bestands) — der Server prüft es. Vorher die Checkliste in docs/UMSCHALTEN-PROMPT.md abarbeiten.</div>'
    + naF('Zweitpasswort', '<input type="password" id="naLivePw" autocomplete="off">')
    + '<div class="na-feld"><label><input type="checkbox" id="naLiveOk"> Ich habe die Checkliste abgearbeitet; alle Geräte sollen umschalten.</label></div>'
    + '<div class="na-zeile">'+(live==='neuaufbau' ? '<button class="na-knopf weg" data-na="liveSchalten" data-ziel="bestand">Bestand wieder live schalten</button>' : '<button class="na-knopf weg" data-na="liveSchalten" data-ziel="neuaufbau">Neue App live schalten</button>')+'</div></div>';
  h += '<div class="na-dim">Abgleich: '+esc(naAbgleich.status().text||'—')+(naAbgleich.offen()?' · '+naAbgleich.offen()+' warten':'')+'</div>';
  return { titel:'Einstellungen', zurueck:'#/mehr', html:h };
}
/* Zustand der Register — damit sichtbar ist, OB es gerade geht und WARUM nicht
   (server/register.js: zustand, pruefen). Gezeichnet wird nur dieser Kasten neu,
   damit getippte Passwörter in derselben Ansicht stehen bleiben. */
let NA_REGSTAND = { stand:null, geholt:0, laedt:false };
function naUhrzeit(iso){ if(!iso) return ''; const d = new Date(iso); if(isNaN(d)) return ''; const z = n=>String(n).padStart(2,'0');
  const heute = new Date().toDateString()===d.toDateString(); return (heute ? '' : naDatum(iso)+', ')+z(d.getHours())+':'+z(d.getMinutes())+' Uhr'; }
function naRegisterStandText(r){
  const name = r.name==='EUDAMED' ? 'EUDAMED (EU)' : (r.name==='GUDID' ? 'GUDID (USA)' : r.name);
  if(r.zustand==='ok') return { art:'ok', text:'✓ '+name+' antwortet'+(r.erfolg ? ' — zuletzt '+naUhrzeit(r.erfolg) : '')+'.' };
  if(r.zustand==='gestoert') return { art:'warn', text:'⚠ '+name+' ist gestört'+(r.seit ? ' seit '+naUhrzeit(r.seit) : '')+': '+(r.grund||'antwortet nicht')+'.'+(r.pauseBis ? ' Nächster Versuch '+naUhrzeit(r.pauseBis)+'.' : '') };
  return { art:'', text:name+': seit dem Start des Servers noch nicht gefragt.' };
}
function naRegisterStandHtml(){
  const R = NA_REGSTAND; const z = R.stand;
  const knopf = '<div style="margin-top:8px"><button class="na-knopf" data-na="registerPruefen"'+(R.laedt==='pruefen'?' disabled':'')+'>'+(R.laedt==='pruefen' ? '⏳ Die Register werden gefragt (bis 30 Sekunden) …' : '↻ Jetzt prüfen')+'</button></div>';
  if(!z) return '<div class="na-dim">'+(R.laedt ? 'Zustand der Register wird geholt …' : 'Zustand der Register: noch nicht abgerufen.')+'</div>'+knopf;
  if(z.fehler) return '<div class="na-info na-offen">Der Zustand der Register ist gerade nicht abrufbar — der Server der App antwortet nicht (Gerät offline?).</div>'+knopf;
  if(!z.an) return '<div class="na-info">Die Register-Abfrage ist auf dem Server abgeschaltet (REGISTER=0).</div>';
  const zeilen = (z.register||[]).map(naRegisterStandText);
  const gestoert = zeilen.some(x=>x.art==='warn');
  let h = '<div class="na-info'+(gestoert?' na-offen':'')+'">'+zeilen.map(x=>esc(x.text)).join('<br>');
  if(z.offen) h += '<br><b>'+z.offen+' Abfrage'+(z.offen===1?'':'n')+' offen</b> — '+(z.nachfassen ? 'der Server fragt von selbst weiter'+(z.naechstes ? ' (nächster Versuch '+esc(naUhrzeit(z.naechstes))+')' : '')+'.' : 'das selbsttätige Nachfragen ist auf dem Server abgeschaltet.');
  h += '<br><span class="na-dim">Gemerkt: '+((z.gemerkt&&z.gemerkt.treffer)||0)+' Produkte mit Registerdaten'+((z.gemerkt&&z.gemerkt.nichts) ? ', '+z.gemerkt.nichts+' ohne Eintrag' : '')+'.</span>';
  if(gestoert) h += '<br><span class="na-dim">Eine Störung liegt beim Register, nicht an der App oder am WLAN. Solange einfach ohne Registerdaten erfassen — nachgeholt wird mit „↻ Aus dem Register ergänzen" im Material-Verzeichnis.</span>';
  return h+'</div>'+knopf;
}
async function naRegisterStandHolen(pruefen){
  const R = NA_REGSTAND; if(R.laedt) return;
  R.laedt = pruefen ? 'pruefen' : true;
  const neu = ()=>{ const n = document.getElementById('naRegStand'); if(n) n.innerHTML = naRegisterStandHtml(); };
  neu();
  let zeit = null;
  try{
    const ctl = (typeof AbortController==='function') ? new AbortController() : null;
    if(ctl) zeit = setTimeout(()=>ctl.abort(), 45000);
    const r = await fetch('/api/register/zustand'+(pruefen ? '?pruefen=1' : ''), { cache:'no-store', signal: ctl ? ctl.signal : undefined });
    R.stand = r.ok ? await r.json() : { fehler:true };
  }catch(e){ R.stand = { fehler:true }; }
  finally{ if(zeit) clearTimeout(zeit); }
  R.geholt = Date.now(); R.laedt = false; neu();
}
naAkt('registerPruefen', ()=>{ if(naAdmin()) naRegisterStandHolen(true); });
naEin('registerAn', v=>{ if(!naAdmin()) return; naEinstellungSetzen('register', !!v); naVerlauf({ typ:'liste', id:'einstellungen', titel:'Einstellungen', was:'Register-Abfrage '+(v?'eingeschaltet':'ausgeschaltet') }); toast(v ? 'Register-Abfrage eingeschaltet' : 'Register-Abfrage ausgeschaltet'); });
naAkt('thema', ()=>{ const n = document.documentElement.getAttribute('data-theme')==='light' ? 'dark' : 'light'; document.documentElement.setAttribute('data-theme', n); store.set('hkl_theme', n); });
naEin('geraetName', v=>{ const g = naGeraet(); g.name = String(v||'').trim().slice(0,40); store.set('nalokal_geraet', JSON.stringify(g)); toast('Gerätename gespeichert'); });
naAkt('pwSetzen', ()=>{ const a = $('naPw1').value, b = $('naPw2').value;
  if(a.length<4){ toast('Mindestens 4 Zeichen.', true); return; } if(a!==b){ toast('Die beiden Eingaben stimmen nicht überein.', true); return; }
  naAbgleich.schreiben('hkl_authpw', naPwHash(a)); toast('Passwort geändert'); $('naPw1').value = $('naPw2').value = ''; });
naAkt('zumBestand', async ()=>{
  const live = raumLiveGemerkt();
  raumWaehlen(live==='bestand' ? null : 'bestand');
  await naAbgleich.leeren(2500);
  location.href = '../';
});
let naLiveLaeuft = false;
naAkt('liveSchalten', async d=>{
  if(naLiveLaeuft) return;
  const pw = $('naLivePw').value; if(!pw){ toast('Bitte das Zweitpasswort eingeben.', true); return; }
  if(!$('naLiveOk').checked){ toast('Bitte erst das Häkchen setzen.', true); return; }
  if(!(await naFrage(d.ziel==='neuaufbau' ? 'Die neue App für ALLE Geräte live schalten?' : 'Den Bestand wieder für alle Geräte live schalten?', { ja:'Ja, umschalten', gefahr:true }))) return;
  naLiveLaeuft = true; let r = null, j = null;
  try{ r = await fetch('/api/raeume', { method:'PUT', cache:'no-store', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ live:d.ziel, pw:naPwHash(pw) }) }); try{ j = await r.json(); }catch(e){} }catch(e){ r = null; }
  naLiveLaeuft = false;
  if(!r){ toast('Server nicht erreichbar — nichts umgeschaltet.', true); return; }
  if(r.status===403){ toast('Zweitpasswort stimmt nicht.', true); return; }
  if(!r.ok || !j || j.live!==d.ziel){ toast('Umschalten fehlgeschlagen (HTTP '+r.status+').', true); return; }
  raumLiveMerken(d.ziel);
  if(d.ziel==='neuaufbau'){ if(RAUM.wahl) raumWaehlen(null); toast('Live ist jetzt die neue App. Die Geräte wechseln beim nächsten Start oder spätestens nach zwei Minuten.'); naZeigen(); }
  else { raumWaehlen(null); toast('Live ist wieder der Bestand — dieses Gerät wechselt mit …'); await naAbgleich.leeren(2500); location.href = '../'; }
});
