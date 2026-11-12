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
    + NA_LISTEN.map(l=>'<div class="na-eintrag" data-na="geh" data-ziel="#/liste/'+l.key+'"><span class="na-ico">🗂</span><div class="na-haupt"><div class="na-name">'+esc(l.wort)+'</div><div class="na-sub">'+naListe(l.key).length+' Einträge'+(naListe(l.key,true).length>naListe(l.key).length?' · '+(naListe(l.key,true).length-naListe(l.key).length)+' archiviert':'')+'</div></div><span class="chev">›</span></div>').join('') };
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
  let h = '<div class="na-karte"><h3>Ansicht</h3><button class="na-knopf" data-na="thema">◐ Hell / Dunkel</button></div>';
  h += '<div class="na-karte"><h3>Dieses Gerät</h3>'+naF('Name des Geräts (für Verlauf und Papierkorb)', '<input type="text" value="'+esc(naGeraet().name)+'" placeholder="z. B. Saal 2 Tablet" data-na-wechsel="geraetName">', 'Kein Personenname nötig — es geht um das Gerät.')+'</div>';
  if(a) h += '<div class="na-karte"><h3>Passwort der Verwaltung (neue App)</h3>'
    + naF('Neues Passwort', '<input type="password" id="naPw1" autocomplete="new-password">') + naF('Noch einmal', '<input type="password" id="naPw2" autocomplete="new-password">')
    + '<button class="na-knopf" data-na="pwSetzen">Passwort ändern</button><div class="na-dim" style="margin-top:6px">Gilt auf allen Geräten. Komfort, keine Sicherheit (Grundsatz A9).</div></div>';
  if(a) h += '<div class="na-karte"><h3>EU-Register</h3><div class="na-feld"><label><input type="checkbox" data-na-wechsel="registerAn"'+(naEinstellung('register', true)?' checked':'')+'> Beim Scannen eines Barcodes das Register fragen</label></div>'
    + '<div class="na-dim">Der Server der App fragt mit der GTIN bei EUDAMED (EU) und, wenn dort nichts steht, bei GUDID (USA) nach Hersteller, Handelsname und REF. Übertragen wird nur die GTIN — keine Daten des Hauses. Die Angaben gelten erst nach dem Speichern als bestätigt. Gilt für alle Geräte.</div></div>';
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
