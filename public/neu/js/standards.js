/* ─────────────────────────────────────────────────────────────
   NEUE APP — STANDARDS

   Ein Standard: Rubriken → Abschnitte → Positionen. Eine Position gilt NUR
   hier: Verweis auf einen Stammsatz (Material/Gerät/Medikament) ODER eigener
   Text, dazu Menge, Zusatz, Bereich (Vorgabe vom Stammsatz, hier
   überschreibbar) und „auf Ansage" (Markierung innerhalb des Bereichs).

   Anwender sehen und haken ab (nur auf ihrem Gerät). Die Verwaltung bearbeitet
   im Editor; jede Änderung wird sofort gespeichert und steht im Verlauf.
   ───────────────────────────────────────────────────────────── */

/* ── Liste ── */
let NA_STD_Q = '', NA_STD_KZ = '';
function naSichtStandards(){
  const kz = naListe('kennzeichen');
  return { titel:'Standards', pfad: naAlle('standard').length+' Standards', tab:'standard', plus: naAdmin() ? { na:'stdNeu' } : null,
    html: '<input class="na-suche" type="search" placeholder="Standard suchen …" value="'+esc(NA_STD_Q)+'" data-na-ein="stdSuche">'
      + (kz.length ? '<div class="na-chips" style="margin-bottom:8px">'+kz.map(k=>'<button class="na-chip'+(NA_STD_KZ===k.id?' an':'')+'" data-na="stdKz" data-id="'+esc(k.id)+'">'+esc(k.name)+'</button>').join('')+'</div>' : '')
      + '<div id="naStdListe">'+naStandardListe()+'</div>' };
}
function naStandardListe(){
  const q = naNorm(NA_STD_Q);
  const alle = naAlle('standard');
  if(!alle.length) return naLeer('📋','Noch keine Standards', naAdmin() ? 'Mit ＋ unten rechts den ersten Standard anlegen.' : 'Die Verwaltung legt die Standards an.');
  const tr = alle.filter(s=>(!q || naNorm(s.titel+' '+naListeName('gruppen', s.gruppe)).indexOf(q)>=0) && (!NA_STD_KZ || (s.kennzeichen||[]).indexOf(NA_STD_KZ)>=0));
  if(!tr.length) return naLeer('🔎','Nichts gefunden','');
  const gruppen = {}; tr.forEach(s=>{ (gruppen[s.gruppe||''] = gruppen[s.gruppe||''] || []).push(s); });
  const reihe = naListe('gruppen').map(g=>g.id);
  return Object.keys(gruppen).sort((a,b)=>{ const ia = reihe.indexOf(a), ib = reihe.indexOf(b); return (a===''?1:0)-(b===''?1:0) || (ia<0?999:ia)-(ib<0?999:ib); })
    .map(g=>'<div class="grp">'+esc(g ? naListeName('gruppen', g) : 'Ohne Gruppe')+'<span class="ln"></span></div>' + gruppen[g].map(s=>{
      const n = naPositionen(s).length; const h = naHaken(s.id); const fertig = Object.keys(h).filter(k=>h[k]).length;
      return '<div class="std" data-na="geh" data-ziel="#/s/'+esc(s.id)+'"><div class="std-main"><div class="std-title">'+esc(s.titel)+'</div><div class="std-file">'+n+' Positionen'
        + ((s.kennzeichen||[]).length ? ' · '+esc(s.kennzeichen.map(k=>naListeName('kennzeichen',k)).filter(Boolean).join(', ')) : '')+'</div></div>'
        + (fertig ? '<span class="std-badge">'+fertig+'/'+n+' ✓</span>' : '')+'<span class="chev">›</span></div>'; }).join('')).join('');
}
naEin('stdSuche', v=>{ NA_STD_Q = v; const l = $('naStdListe'); if(l) l.innerHTML = naStandardListe(); });
naAkt('stdKz', d=>{ NA_STD_KZ = NA_STD_KZ===d.id ? '' : d.id; naZeigen(); });

/* ── Neuer Standard ── */
naAkt('stdNeu', ()=>naStandardAnlegen());
naAkt('bsNeu', ()=>naBausteinAnlegen());
async function naStandardAnlegen(){
  if(!naAdmin()) return;
  const titel = await naEingabe('Neuer Standard — Titel', { platzhalter:'z. B. PCI elektiv' });
  if(!titel) return;
  const tr = naAehnliche(titel, naAlle('standard', true).map(s=>({ id:s.id, name:s.titel })));
  if(tr.length && !(await naFrage('Ähnlich: '+tr.slice(0,3).map(t=>'„'+t.item.name+'"').join(', ')+'. Trotzdem neu anlegen?', { ja:'Neu anlegen' }))) return;
  const alle = naAlle('standard');
  const wie = await naSheetAuf('<div class="sheet-title">Womit beginnen?</div><div class="sheet-name">'+esc(titel)+'</div>'
    + '<button class="sheet-act" data-na="sheetWert" data-wert="geruest"><span class="sa-ico">▤</span><span>Mit den üblichen Rubriken<span class="sa-sub">'+esc(naListe('rubriken').map(r=>r.name).join(' · '))+'</span></span></button>'
    + '<button class="sheet-act" data-na="sheetWert" data-wert="leer"><span class="sa-ico">□</span><span>Leer</span></button>'
    + (alle.length ? '<button class="sheet-act" data-na="sheetWert" data-wert="kopie"><span class="sa-ico">⧉</span><span>Als Kopie eines Standards<span class="sa-sub">Positionen werden übernommen; Stammdaten bleiben gemeinsam.</span></span></button>' : ''));
  if(!wie) return;
  let s;
  if(wie==='kopie'){
    const id = await naAuswahl({ titel:'Kopie von …', items: alle.map(x=>({ id:x.id, name:x.titel })) });
    if(!id) return;
    s = naStandardKopie(naHole('standard', id), titel);
  } else s = naStandardNeu(titel, '', wie==='geruest' ? naListe('rubriken').map(r=>r.name) : []);
  naSpeichern('standard', s, 'angelegt');
  naGeh('#/s/'+s.id+'/bearbeiten');
}

/* ── Ansehen und abhaken ── */
/* Das Anzeigebild des Stammsatzes an der Zeile — klein, antippen macht groß. */
function naPosBild(pos){
  const st = pos && pos.ref ? naStamm(pos.ref) : null; const hb = st ? naHauptbild(st) : null;
  return hb ? '<img class="na-pbild" loading="lazy" draggable="false" alt="" data-zoom data-gross="'+esc(naBildSrc(hb))+'" data-cap="'+esc(st.name||'')+'" src="'+esc(naBildSrc(hb, true))+'">' : '';
}
function naPosZeile(std, pos, h, editor){
  const art = naArt(pos.art); const haken = art.haken!==false;
  const zusatz = pos.zusatz ? '<span class="na-pzusatz">'+esc(pos.zusatz)+'</span>' : '';
  const ansage = (pos.ansage ? ' <span class="na-chip ansage">auf Ansage</span>' : '')
    + (pos.ref && pos.ref.typ==='material' && naHatErsatz(naStamm(pos.ref)) ? ' <span class="na-chip ersatz" title="Ersatz eingetragen — antippen">🔁 Ersatz</span>' : '');
  const cls = 'na-pos'+(h && h[pos.id] ? ' erledigt' : '')+(haken ? '' : ' hinweis');
  const text = '<span class="na-ptext"'+(pos.ref ? ' data-na="posInfo" data-pos="'+esc(pos.id)+'" data-std="'+esc(std.id)+'" style="cursor:pointer"' : '')+'>'
    + (art.ico ? esc(art.ico)+' ' : '')+esc(naPosText(pos))+ansage+zusatz+'</span>';
  const menge = pos.menge ? '<span class="na-pmenge">'+esc(pos.menge)+'</span>' : '';
  const bild = naPosBild(pos);
  if(editor){
    return '<div class="'+cls+'" style="--pf:'+esc(art.farbe||'')+'" draggable="true" data-pos-id="'+esc(pos.id)+'"><span class="na-griff" title="Ziehen zum Verschieben">⋮⋮</span>'+bild+text+menge
      + '<span class="na-pakt"><button class="na-knopf klein" data-na="posBearb" data-pos="'+esc(pos.id)+'" aria-label="Bearbeiten">✎</button>'
      + '<button class="na-knopf klein" data-na="posSchieb" data-pos="'+esc(pos.id)+'" data-r="-1" aria-label="nach oben">↑</button>'
      + '<button class="na-knopf klein" data-na="posSchieb" data-pos="'+esc(pos.id)+'" data-r="1" aria-label="nach unten">↓</button></span></div>';
  }
  return '<div class="'+cls+'" style="--pf:'+esc(art.farbe||'')+'">'+(haken ? '<span class="chk" data-na="haken" data-std="'+esc(std.id)+'" data-pos="'+esc(pos.id)+'" role="checkbox" aria-checked="'+(h && h[pos.id] ? 'true' : 'false')+'">✓</span>' : '<span style="width:26px;text-align:center">ℹ</span>')+bild+text+menge+'</div>';
}
function naSichtStandard(id){
  const s = naHole('standard', id);
  if(!s) return { titel:'Standard', html: naLeer('❓','Nicht gefunden', naImPapierkorb('standard',id) ? 'Liegt im Papierkorb.' : '') };
  const h = naHaken(s.id); const alle = naPositionen(s).filter(x=>naArt(x.pos.art).haken!==false);
  const fertig = alle.filter(x=>h[x.pos.id]).length;
  let html = '<div class="na-zeile" style="margin-bottom:6px"><button class="na-knopf" data-na="geh" data-ziel="#/s/'+esc(s.id)+'/ruest">🧺 Rüstliste</button>'
    + (fertig ? '<button class="na-knopf" data-na="hakenNull" data-std="'+esc(s.id)+'">↺ Haken zurücksetzen</button>' : '')
    + (naAdmin() ? '<button class="na-knopf pri" data-na="geh" data-ziel="#/s/'+esc(s.id)+'/bearbeiten">✎ Bearbeiten</button><button class="na-knopf" data-na="geh" data-ziel="#/s/'+esc(s.id)+'/kosten">€ Kosten</button>' : '')+'</div>';
  if(alle.length) html += '<div class="na-dim">'+fertig+' von '+alle.length+' erledigt</div><div class="na-fortschritt"><i style="width:'+Math.round(100*fertig/alle.length)+'%"></i></div>';
  if(!naPositionen(s).length) html += naLeer('📋','Noch leer', naAdmin() ? 'Über „Bearbeiten" Positionen hinzufügen.' : '');
  (s.rubriken||[]).forEach(r=>{
    const n = (r.abschnitte||[]).reduce((a,x)=>a+(x.positionen||[]).length, 0); if(!n) return;
    html += '<div class="na-rub"><h2>'+esc(r.name)+'</h2></div>';
    (r.abschnitte||[]).forEach(a=>{ if(!(a.positionen||[]).length) return;
      if(a.name) html += '<div class="na-abs">'+esc(a.name)+'</div>';
      html += a.positionen.map(p=>naPosZeile(s, p, h, false)).join(''); });
  });
  return { titel:s.titel, pfad: s.gruppe ? naListeName('gruppen', s.gruppe) : 'Standard', zurueck:'#/standards', html };
}
naAkt('haken', (d, el)=>{
  const h = naHaken(d.std); h[d.pos] = !h[d.pos]; if(!h[d.pos]) delete h[d.pos]; naHakenSetzen(d.std, h);
  const z = el.closest('.na-pos'); if(z) z.classList.toggle('erledigt', !!h[d.pos]); el.setAttribute('aria-checked', h[d.pos] ? 'true' : 'false');
  const s = naHole('standard', d.std); if(!s) return;
  const alle = naPositionen(s).filter(x=>naArt(x.pos.art).haken!==false); const f = alle.filter(x=>h[x.pos.id]).length;
  const bar = document.querySelector('.na-fortschritt i'); if(bar) bar.style.width = Math.round(100*f/Math.max(1,alle.length))+'%';
  const t = document.querySelector('.na-fortschritt'); if(t && t.previousElementSibling) t.previousElementSibling.textContent = f+' von '+alle.length+' erledigt';
});
naAkt('hakenNull', async d=>{ if(await naFrage('Alle Haken dieses Standards auf diesem Gerät zurücksetzen?', { ja:'Zurücksetzen' })){ naHakenSetzen(d.std, {}); naZeigen(); } });
naAkt('posInfo', d=>{
  const s = naHole('standard', d.std) || naHole('baustein', d.std); if(!s) return;
  const x = naPosFinden(s, d.pos); if(!x || !x.pos.ref) return;
  const st = naStamm(x.pos.ref);
  if(!st){ toast('Der Stammsatz fehlt (Papierkorb?).', true); return; }
  naSheetAuf(naStammAnsicht(x.pos.ref.typ, st) + (naAdmin() ? '<button class="sheet-act" data-na="geh" data-ziel="#/'+x.pos.ref.typ+'/'+esc(st.id)+'"><span class="sa-ico">✎</span><span>Stammsatz bearbeiten<span class="sa-sub">wirkt überall, wo er verwendet wird</span></span></button>' : ''));
});

/* ── Position finden / verschieben ── */
function naPosFinden(s, posId){
  if(s.rubriken){ for(const r of s.rubriken) for(const a of (r.abschnitte||[])){ const i = (a.positionen||[]).findIndex(p=>p.id===posId); if(i>=0) return { r, a, i, liste:a.positionen, pos:a.positionen[i] }; } }
  else { const i = (s.positionen||[]).findIndex(p=>p.id===posId); if(i>=0) return { liste:s.positionen, i, pos:s.positionen[i] }; }
  return null;
}
function naAbschnittFinden(s, absId){ for(const r of (s.rubriken||[])) for(const a of (r.abschnitte||[])) if(a.id===absId) return { r, a }; return null; }

/* ── Editor ── */
let NA_ED = null;   /* { typ:'standard'|'baustein', id } */
function naEdObj(){ return NA_ED ? naHole(NA_ED.typ, NA_ED.id) : null; }
function naEdSpeichern(was){ const o = naEdObj(); if(o){ naSpeichern(NA_ED.typ, o, was); naFormNeu(); } }
function naSichtEditor(id){
  if(!naAdmin()) return { titel:'Bearbeiten', html: naLeer('🔒','Nur in der Verwaltung','Bitte oben anmelden.') };
  const s = naHole('standard', id); if(!s) return { titel:'Bearbeiten', html: naLeer('❓','Nicht gefunden','') };
  NA_ED = { typ:'standard', id };
  let h = '<div class="na-karte">'
    + naF('Titel', '<input type="text" value="'+esc(s.titel)+'" data-na-wechsel="edTitel">')
    + '<div class="na-zwei">'+naF('Gruppe', '<button class="na-wahl" data-na="edGruppe">'+(s.gruppe ? esc(naListeName('gruppen', s.gruppe)) : '<span class="na-leer">— keine —</span>')+'</button>')
    + naF('Kennzeichen', '<button class="na-wahl" data-na="edKz">'+((s.kennzeichen||[]).length ? esc(s.kennzeichen.map(k=>naListeName('kennzeichen',k)).join(', ')) : '<span class="na-leer">— keine —</span>')+'</button>')+'</div>'
    + '<div class="na-zeile"><button class="na-knopf" data-na="geh" data-ziel="#/s/'+esc(s.id)+'">👁 Ansehen</button><button class="na-knopf" data-na="edKopie">⧉ Kopieren</button><button class="na-knopf weg" data-na="edLoeschen">In den Papierkorb</button></div></div>';
  (s.rubriken||[]).forEach((r, ri)=>{
    h += '<div class="na-rub"><h2>'+esc(r.name||'(Rubrik ohne Namen)')+'</h2>'
      + '<button class="na-knopf klein" data-na="rubName" data-r="'+esc(r.id)+'" aria-label="Umbenennen">✎</button>'
      + '<button class="na-knopf klein" data-na="rubSchieb" data-r="'+esc(r.id)+'" data-d="-1"'+(ri===0?' disabled':'')+' aria-label="nach oben">↑</button>'
      + '<button class="na-knopf klein" data-na="rubSchieb" data-r="'+esc(r.id)+'" data-d="1"'+(ri===s.rubriken.length-1?' disabled':'')+' aria-label="nach unten">↓</button>'
      + '<button class="na-knopf klein weg" data-na="rubWeg" data-r="'+esc(r.id)+'" aria-label="Rubrik löschen">×</button></div>';
    (r.abschnitte||[]).forEach(a=>{
      h += '<div class="na-abs na-zeile" data-abs-ziel="'+esc(a.id)+'"><span style="flex:1">'+(a.name ? esc(a.name) : '<span class="na-leer">Abschnitt</span>')+'</span>'
        + '<button class="na-knopf klein" data-na="absName" data-a="'+esc(a.id)+'">✎</button>'
        + ((r.abschnitte.length>1 || !(a.positionen||[]).length) ? '<button class="na-knopf klein weg" data-na="absWeg" data-a="'+esc(a.id)+'" aria-label="Abschnitt löschen">×</button>' : '')+'</div>';
      h += (a.positionen||[]).map(p=>naPosZeile(s, p, null, true)).join('');
      h += '<div class="na-zeile" style="margin:4px 0 10px"><button class="na-knopf pri" data-na="neuAnlegen" data-a="'+esc(a.id)+'">＋ Neu anlegen</button><button class="na-knopf" data-na="bausteinRein" data-a="'+esc(a.id)+'">🧩 Baustein</button></div>';
    });
    h += '<button class="na-knopf klein" data-na="absNeu" data-r="'+esc(r.id)+'">＋ Abschnitt</button>';
  });
  h += '<div style="margin:16px 0"><button class="na-knopf" data-na="rubNeu">＋ Rubrik</button></div>';
  return { titel:s.titel, pfad:'Bearbeiten', zurueck:'#/s/'+s.id, bearbeitung:true, html:h, nachher: naZiehenAn };
}
naEin('edTitel', v=>{ const s = naEdObj(); v = String(v||'').trim(); if(!s || !v || v===s.titel) return; s.titel = v; naEdSpeichern('Titel geändert'); });
naAkt('edGruppe', async ()=>{ const s = naEdObj(); if(!s) return;
  const w = await naAuswahl({ titel:'Gruppe', liste:'gruppen', gewaehlt:s.gruppe, neu:true, wo:'Standard: '+s.titel, leer:'— keine —' });
  if(w==null) return; s.gruppe = w; naEdSpeichern('Gruppe'); });
naAkt('edKz', async ()=>{ const s = naEdObj(); if(!s) return;
  const w = await naAuswahl({ titel:'Kennzeichen', liste:'kennzeichen', gewaehlt:s.kennzeichen||[], mehrfach:true, neu:true, wo:'Standard: '+s.titel });
  if(w==null) return; s.kennzeichen = w; naEdSpeichern('Kennzeichen'); });
naAkt('edKopie', async ()=>{ const s = naEdObj(); if(!s) return;
  const t = await naEingabe('Titel der Kopie', { wert: s.titel+' (Kopie)' }); if(!t) return;
  const k = naStandardKopie(s, t); naSpeichern('standard', k, 'kopiert von „'+s.titel+'"'); naGeh('#/s/'+k.id+'/bearbeiten'); });
naAkt('edLoeschen', async ()=>{ const s = naEdObj(); if(!s) return;
  if(!(await naFrage('„'+s.titel+'" in den Papierkorb legen?', { ja:'In den Papierkorb', gefahr:true }))) return;
  naLoeschen('standard', s.id); naGeh('#/standards'); toast('Im Papierkorb'); });
async function naNameAusListe(liste, titel, alt, wo){
  const id = await naAuswahl({ titel, liste, neu:true, wo, gewaehlt: (naListe(liste).find(x=>x.name===alt)||{}).id });
  if(id==null) return null; return naListeName(liste, id) || '';
}
naAkt('rubName', async d=>{ const s = naEdObj(); const r = (s.rubriken||[]).find(x=>x.id===d.r); if(!r) return;
  const n = await naNameAusListe('rubriken', 'Rubrik-Name', r.name, 'Standard: '+s.titel); if(n==null) return; r.name = n; naEdSpeichern('Rubrik umbenannt'); });
naAkt('rubNeu', async ()=>{ const s = naEdObj(); if(!s) return;
  const n = await naNameAusListe('rubriken', 'Neue Rubrik', '', 'Standard: '+s.titel); if(!n) return;
  s.rubriken = (s.rubriken||[]).concat([{ id:naId('r'), name:n, abschnitte:[{ id:naId('a'), name:'', positionen:[] }] }]); naEdSpeichern('Rubrik „'+n+'"'); });
naAkt('rubSchieb', d=>{ const s = naEdObj(); const i = s.rubriken.findIndex(x=>x.id===d.r); const j = i+(+d.d); if(i<0 || j<0 || j>=s.rubriken.length) return;
  const t = s.rubriken[i]; s.rubriken[i] = s.rubriken[j]; s.rubriken[j] = t; naEdSpeichern('Rubrik verschoben'); });
naAkt('rubWeg', async d=>{ const s = naEdObj(); const r = s.rubriken.find(x=>x.id===d.r); if(!r) return;
  const n = (r.abschnitte||[]).reduce((a,x)=>a+(x.positionen||[]).length, 0);
  if(n && !(await naFrage('Rubrik „'+r.name+'" mit '+n+' Positionen löschen?', { ja:'Löschen', gefahr:true, mehr:'Im Verlauf bleibt der vorige Stand nachvollziehbar; der ganze Standard lässt sich über den Papierkorb nicht einzeln zurückholen.' }))) return;
  s.rubriken = s.rubriken.filter(x=>x.id!==d.r); naEdSpeichern('Rubrik „'+r.name+'" gelöscht'); });
naAkt('absNeu', async d=>{ const s = naEdObj(); const r = s.rubriken.find(x=>x.id===d.r); if(!r) return;
  const n = await naNameAusListe('abschnitte', 'Neuer Abschnitt', '', 'Standard: '+s.titel); if(n==null) return;
  r.abschnitte = (r.abschnitte||[]).concat([{ id:naId('a'), name:n, positionen:[] }]); naEdSpeichern('Abschnitt'); });
naAkt('absName', async d=>{ const s = naEdObj(); const x = naAbschnittFinden(s, d.a); if(!x) return;
  const n = await naNameAusListe('abschnitte', 'Abschnitt-Name', x.a.name, 'Standard: '+s.titel); if(n==null) return; x.a.name = n; naEdSpeichern('Abschnitt umbenannt'); });
naAkt('absWeg', async d=>{ const s = naEdObj(); const x = naAbschnittFinden(s, d.a); if(!x) return;
  if((x.a.positionen||[]).length && !(await naFrage('Abschnitt mit '+x.a.positionen.length+' Positionen löschen?', { ja:'Löschen', gefahr:true }))) return;
  x.r.abschnitte = x.r.abschnitte.filter(a=>a.id!==d.a); if(!x.r.abschnitte.length) x.r.abschnitte.push({ id:naId('a'), name:'', positionen:[] }); naEdSpeichern('Abschnitt gelöscht'); });
naAkt('posSchieb', d=>{ const s = naEdObj(); const x = naPosFinden(s, d.pos); if(!x) return;
  const j = x.i+(+d.r); if(j<0 || j>=x.liste.length) return;
  const t = x.liste[x.i]; x.liste[x.i] = x.liste[j]; x.liste[j] = t; naEdSpeichern('Position verschoben'); });

/* Ziehen am PC: Position auf eine andere Position (davor) oder auf eine
   Abschnittszeile (ans Ende) ziehen. */
function naZiehenAn(){
  let von = null;
  document.querySelectorAll('#naMain [data-pos-id]').forEach(el=>{
    el.addEventListener('dragstart', ev=>{ von = el.getAttribute('data-pos-id'); el.classList.add('zieh'); try{ ev.dataTransfer.setData('text/plain', von); }catch(e){} });
    el.addEventListener('dragend', ()=>{ el.classList.remove('zieh'); });
  });
  document.querySelectorAll('#naMain [data-pos-id], #naMain [data-abs-ziel]').forEach(el=>{
    el.addEventListener('dragover', ev=>{ if(von) ev.preventDefault(); });
    el.addEventListener('drop', ev=>{ ev.preventDefault(); if(!von) return; const s = naEdObj(); if(!s) return;
      const q = naPosFinden(s, von); if(!q) return;
      const zielPos = el.getAttribute('data-pos-id'); const zielAbs = el.getAttribute('data-abs-ziel');
      if(zielPos===von) return;
      const [pos] = q.liste.splice(q.i, 1);
      if(zielPos){ const z = naPosFinden(s, zielPos); if(z) z.liste.splice(z.i, 0, pos); else q.liste.splice(q.i, 0, pos); }
      else { const z = naAbschnittFinden(s, zielAbs); (z ? z.a.positionen : q.liste).push(pos); }
      von = null; naEdSpeichern('Position verschoben'); });
  });
}

/* ── Position bearbeiten (gilt nur hier) ── */
naAkt('posBearb', async d=>{
  const s = naEdObj(); const x = s && naPosFinden(s, d.pos); if(!x) return;
  const p = x.pos; const st = p.ref ? naStamm(p.ref) : null;
  const vorgabeBereich = st && st.bereich ? naListeName('bereiche', st.bereich) : '';
  const w = await naSheetAuf('<div class="sheet-title">Position — gilt nur in diesem '+(NA_ED.typ==='baustein'?'Baustein':'Standard')+'</div>'
    + '<div class="sheet-name">'+esc(naPosText(p))+'</div>'
    + (p.ref ? '<div class="na-info">Name, Lagerort und Fotos gehören zum Stammsatz und gelten überall. '+(st ? '<a href="#/'+p.ref.typ+'/'+esc(st.id)+'">Stammsatz öffnen</a>' : '')+'</div>'
      : naF('Text', '<textarea id="naPosText">'+esc(p.text||'')+'</textarea>'))
    + '<div class="na-zwei">'+naF('Menge', '<input type="text" id="naPosMenge" value="'+esc(p.menge||'')+'" placeholder="z. B. 2x">', 'Unklare Mengen (z. B. „1–2") zählen in den Kosten nicht.')
    + naF('Zusatz', '<input type="text" id="naPosZusatz" value="'+esc(p.zusatz||'')+'" placeholder="z. B. nur bei radial">')+'</div>'
    + naF('Bereich', '<button class="na-wahl" data-na="posBereich" id="naPosBereich" data-wert="'+esc(p.bereich||'')+'">'+(p.bereich ? esc(naListeName('bereiche', p.bereich)) : '<span class="na-leer">'+(vorgabeBereich ? 'wie Stammsatz: '+esc(vorgabeBereich) : '— keiner —')+'</span>')+'</button>')
    + '<div class="na-feld"><label><input type="checkbox" id="naPosAnsage"'+(p.ansage?' checked':'')+'> auf Ansage (wird erst auf Zuruf gerichtet)</label></div>'
    + '<div class="na-feld"><label>Art</label><button class="na-wahl" data-na="posArt" id="naPosArt" data-wert="'+esc(p.art||'')+'">'+esc(naArt(p.art).ico+' '+naArt(p.art).name)+'</button></div>'
    + '<div class="na-zeile" style="margin-top:10px"><button class="na-knopf weg" data-na="sheetWert" data-wert="weg">Entfernen</button><span style="flex:1"></span><button class="btn btn-sec" data-na="sheetZu">Abbrechen</button><button class="btn btn-pri" data-na="posOk">Übernehmen</button></div>');
  if(!w) return;
  if(w==='weg'){ x.liste.splice(x.i, 1); naEdSpeichern('Position entfernt: '+naPosText(p)); return; }
  Object.assign(p, w); if(!p.bereich) delete p.bereich; if(!p.ansage) delete p.ansage; if(!p.zusatz) delete p.zusatz;
  naEdSpeichern('Position geändert: '+naPosText(p));
});
function naPosMerk(){ return { menge:$('naPosMenge').value, zusatz:$('naPosZusatz').value, ansage:$('naPosAnsage').checked,
  bereich:$('naPosBereich').getAttribute('data-wert'), art:$('naPosArt').getAttribute('data-wert'), text:$('naPosText') ? $('naPosText').value : null }; }
/* Ein Auswahlfeld IM Positionsblatt: Blatt merken, Auswahl zeigen, Blatt mit
   allen Eingaben wieder öffnen. Das ursprüngliche Warten (posBearb) bleibt. */
async function naImPosBlatt(waehlen, setzen){
  const merk = naPosMerk(); const html = $('naSheet').innerHTML.replace(/^<div class="sheet-grip"><\/div>/, '');
  const loeser = naSheetLoeser; naSheetLoeser = null;
  const w = await waehlen(merk);
  naSheetAuf(html).then(loeser);
  $('naPosMenge').value = merk.menge; $('naPosZusatz').value = merk.zusatz; $('naPosAnsage').checked = merk.ansage;
  $('naPosBereich').setAttribute('data-wert', merk.bereich); $('naPosArt').setAttribute('data-wert', merk.art);
  if(merk.text!=null) $('naPosText').value = merk.text;
  if(w!=null) setzen(w);
}
naAkt('posBereich', ()=>naImPosBlatt(
  m=>naAuswahl({ titel:'Bereich', liste:'bereiche', gewaehlt:m.bereich, neu:true, wo:'Position', leer:'— wie Stammsatz / keiner —' }),
  id=>{ const b = $('naPosBereich'); b.setAttribute('data-wert', id); b.innerHTML = id ? esc(naListeName('bereiche', id)) : '<span class="na-leer">— wie Stammsatz / keiner —</span>'; }));
naAkt('posArt', ()=>naImPosBlatt(
  ()=>naArtWaehlen(),
  id=>{ if(!id) return; const b = $('naPosArt'); b.setAttribute('data-wert', id); b.textContent = naArt(id).ico+' '+naArt(id).name; }));
naAkt('posOk', ()=>{
  const w = { menge: $('naPosMenge').value.trim(), zusatz: $('naPosZusatz').value.trim(), ansage: $('naPosAnsage').checked,
    bereich: $('naPosBereich').getAttribute('data-wert') || '', art: $('naPosArt').getAttribute('data-wert') };
  if($('naPosText')) w.text = $('naPosText').value.trim();
  naSheetZu(w);
});

/* ── „Neu anlegen" — die EINE Maske mit Vorauswahl der Art ── */
function naArtWaehlen(){
  return naAuswahl({ titel:'Was ist das?', items: naListe('arten').map(a=>({ id:a.id, name:a.name, ico:a.ico, sub: a.verweis ? ('aus dem Verzeichnis '+NA_TYPEN[a.verweis].mehr) : (a.haken===false ? 'Hinweis, wird nicht abgehakt' : 'eigener Text') })),
    neu:true, wo:'Neu anlegen', anlegen: name=>naListeNeu('arten', name, 'Neu anlegen', { ico:'•', farbe:'#7f95ab', verweis:'', haken:true }) });
}
naAkt('neuAnlegen', async d=>{
  const ziel = { typ:NA_ED.typ, id:NA_ED.id, abs:d.a };
  const artId = await naArtWaehlen(); if(!artId) return;
  await naPositionenHinzu(ziel, artId);
});
function naZielListe(ziel){ const o = naHole(ziel.typ, ziel.id); if(!o) return null;
  if(ziel.typ==='baustein'){ o.positionen = o.positionen || []; return { o, liste:o.positionen }; }
  const x = naAbschnittFinden(o, ziel.abs); return x ? { o, liste:x.a.positionen = x.a.positionen || [] } : null; }
/* Verknüpfung „braucht dazu": Fehlt das Zubehör in dieser Liste noch, bietet
   die App es an — sie fügt nichts ungefragt ein. */
async function naZubehoerAnbieten(ziel, artId, typ, ids){
  if(typ!=='material') return;
  const o = naHole(ziel.typ, ziel.id); if(!o) return;
  const da = naPositionenAlle(o).filter(p=>p.ref && p.ref.typ==='material').map(p=>p.ref.id);
  const alle = naAlle('material', true); const fehlt = [];
  ids.forEach(id=>naZubehoerFehlt(alle, id, da).forEach(x=>{ const m = naHole('material', x); if(m && !m.archiviert && fehlt.indexOf(x)<0) fehlt.push(x); }));
  if(!fehlt.length) return;
  const namen = fehlt.map(x=>naHole('material', x).name);
  if(!(await naFrage('Dazu gehört noch Zubehör. Gleich mit hinzufügen?', { ja: fehlt.length===1 ? 'Hinzufügen' : 'Alle '+fehlt.length+' hinzufügen', nein:'Nein', mehr: esc(namen.join(' · ')) }))) return;
  const z = naZielListe(ziel); if(!z) return;
  fehlt.forEach(id=>z.liste.push({ id:naId('p'), art:artId, ref:{ typ:'material', id }, menge:'' }));
  naSpeichern(ziel.typ, z.o, fehlt.length+' Zubehör-Position(en)');
  toast(fehlt.length+' Zubehör hinzugefügt'); naFormNeu();
}
let NA_NEU_NAME = '';
async function naPositionenHinzu(ziel, artId){
  const art = naArt(artId);
  if(art.verweis){
    const typ = art.verweis;
    const items = naAlle(typ).map(o=>({ id:o.id, name:o.name, sub:naStammSub(typ, o) }));
    const w = await naAuswahl({ titel: art.name+' aus dem Verzeichnis', items, mehrfach:true, neu:true, wo:'Standard',
      anlegen: name=>{ naSheetZu(['__neu__']); NA_NEU_NAME = name; return null; } });
    if(!w || !w.length) return;
    if(w.indexOf('__neu__')>=0){
      const zurueck = location.hash;
      naStammNeuAusStandard(typ, r=>{ const z = naZielListe(ziel); if(z){ z.liste.push({ id:naId('p'), art:artId, ref:{ typ, id:r.id }, menge:'' }); naSpeichern(ziel.typ, z.o, 'Position: '+naPosText(z.liste[z.liste.length-1])); } naGeh(zurueck); naZubehoerAnbieten(ziel, artId, typ, [r.id]); },
        ()=>{ naGeh(zurueck); }, NA_NEU_NAME);
      NA_NEU_NAME = '';
      return;
    }
    const z = naZielListe(ziel); if(!z) return;
    w.forEach(id=>z.liste.push({ id:naId('p'), art:artId, ref:{ typ, id }, menge:'' }));
    naSpeichern(ziel.typ, z.o, w.length+' Position(en) '+art.name);
    toast(w.length+' hinzugefügt — Menge und Zusatz über ✎'); naFormNeu();
    await naZubehoerAnbieten(ziel, artId, typ, w);
    return;
  }
  const t = await naSheetAuf('<div class="sheet-title">'+esc(art.ico+' '+art.name)+'</div>'
    + naF('Text (eine Zeile je Position)', '<textarea id="naNeuText" style="min-height:110px"></textarea>')
    + '<div class="na-zeile"><button class="btn btn-sec" data-na="sheetZu">Abbrechen</button><button class="btn btn-pri" data-na="neuTextOk">Hinzufügen</button></div>');
  if(!t) return;
  const zeilen = String(t).split(/\n/).map(x=>x.trim()).filter(Boolean); if(!zeilen.length) return;
  const z = naZielListe(ziel); if(!z) return;
  zeilen.forEach(text=>z.liste.push({ id:naId('p'), art:artId, text }));
  naSpeichern(ziel.typ, z.o, zeilen.length+' Position(en) '+art.name); naFormNeu();
}
naAkt('neuTextOk', ()=>naSheetZu(($('naNeuText')||{}).value || ''));
naAkt('bausteinRein', async d=>{
  const s = naEdObj(); if(!s) return;
  const b = naAlle('baustein');
  if(!b.length){ toast('Noch keine Bausteine — unter Mehr → Bausteine anlegen.', true); return; }
  const id = await naAuswahl({ titel:'Baustein einfügen', items: b.map(x=>({ id:x.id, name:x.name, sub:(x.positionen||[]).length+' Positionen' })) });
  if(!id) return;
  const bs = naHole('baustein', id); const x = naAbschnittFinden(s, d.a); if(!x || !bs) return;
  (bs.positionen||[]).forEach(p=>x.a.positionen.push(Object.assign(JSON.parse(JSON.stringify(p)), { id:naId('p'), ausBaustein:bs.id })));
  naEdSpeichern('Baustein „'+bs.name+'" eingefügt'); toast((bs.positionen||[]).length+' Positionen eingefügt');
});

/* ── Bausteine (wiederkehrende Positionsgruppen; eingefügt als Kopie) ── */
function naSichtBausteine(){
  const b = naAlle('baustein');
  return { titel:'Bausteine', pfad:b.length+' Bausteine', zurueck:'#/mehr', plus: naAdmin() ? { na:'bsNeu' } : null,
    html: '<div class="na-info">Ein Baustein ist eine Gruppe von Positionen, die in mehreren Standards vorkommt. Eingefügt wird eine Kopie — danach gilt sie nur dort.</div>'
      + (b.length ? b.map(x=>'<div class="na-eintrag" data-na="geh" data-ziel="#/b/'+esc(x.id)+'"><span class="na-ico">🧩</span><div class="na-haupt"><div class="na-name">'+esc(x.name)+'</div><div class="na-sub">'+(x.positionen||[]).length+' Positionen</div></div></div>').join('') : naLeer('🧩','Noch keine Bausteine','')) };
}
async function naBausteinAnlegen(){
  const n = await naEingabe('Neuer Baustein — Name', { platzhalter:'z. B. Radialer Zugang' });
  if(!n) return;
  const b = { id:naId('b'), name:n, positionen:[] }; naSpeichern('baustein', b); naGeh('#/b/'+b.id);
}
function naSichtBaustein(id){
  const b = naHole('baustein', id); if(!b) return { titel:'Baustein', html: naLeer('❓','Nicht gefunden','') };
  if(!naAdmin()) return { titel:b.name, zurueck:'#/bausteine', html:(b.positionen||[]).map(p=>naPosZeile(b, p, null, false)).join('') };
  NA_ED = { typ:'baustein', id };
  const h = naF('Name', '<input type="text" value="'+esc(b.name)+'" data-na-wechsel="bsName">')
    + (b.positionen||[]).map(p=>naPosZeile(b, p, null, true)).join('')
    + '<div class="na-zeile" style="margin:8px 0"><button class="na-knopf pri" data-na="neuAnlegen" data-a="">＋ Neu anlegen</button><button class="na-knopf weg" data-na="bsWeg">In den Papierkorb</button></div>'
    + '<div class="na-dim">Eingefügt (als Kopie) in '+naStandards().filter(x=>naPositionen(x).some(y=>y.pos.ausBaustein===b.id)).length+' Standard(s). Spätere Änderungen hier ändern diese Kopien nicht.</div>';
  return { titel:b.name, pfad:'Baustein', zurueck:'#/bausteine', bearbeitung:true, html:h, nachher:naZiehenAn };
}
naEin('bsName', v=>{ const b = naEdObj(); v = String(v||'').trim(); if(!b || !v) return; b.name = v; naEdSpeichern('umbenannt'); });
naAkt('bsWeg', async ()=>{ const b = naEdObj(); if(!b) return; if(!(await naFrage('Baustein „'+b.name+'" in den Papierkorb?', { ja:'In den Papierkorb', gefahr:true, mehr:'Bereits eingefügte Kopien bleiben in den Standards.' }))) return;
  naLoeschen('baustein', b.id); naGeh('#/bausteine'); });

/* ── Rüstliste (E9): nach Bereich, darin nach Lagerort; „auf Ansage" markiert ── */
function naSichtRuest(id){
  const s = naHole('standard', id); if(!s) return { titel:'Rüstliste', html: naLeer('❓','Nicht gefunden','') };
  const gruppen = naRuestliste(s, naStammFuerListe, naListe('bereiche', true));
  const h = loadJSON('nalokal_ruest_'+s.id, {}) || {};
  let html = '<div class="na-zeile" style="margin-bottom:8px"><button class="na-knopf" data-na="ruestNull" data-std="'+esc(s.id)+'">↺ Haken zurücksetzen</button></div>';
  if(!gruppen.length) html += naLeer('🧺','Nichts zu richten','Die Rüstliste zeigt Material, Geräte und Medikamente des Standards.');
  gruppen.forEach(g=>{
    html += '<div class="na-rub"><h2>'+esc(g.bereich ? naListeName('bereiche', g.bereich) : 'Ohne Bereich')+'</h2></div>';
    g.orte.forEach(o=>{
      html += '<div class="na-ruest-ort">📍 '+esc(o.ort || 'ohne Lagerort')+'</div>';
      html += o.posten.map(p=>'<div class="na-pos'+(h[p.pos.id]?' erledigt':'')+'"><span class="chk" data-na="ruestHaken" data-std="'+esc(s.id)+'" data-pos="'+esc(p.pos.id)+'">✓</span>'+naPosBild(p.pos)+'<span class="na-ptext">'+esc(NA_TYPEN[p.typ].ico+' '+p.name)+(p.ansage?' <span class="na-chip ansage">auf Ansage</span>':'')+(p.pos.zusatz?'<span class="na-pzusatz">'+esc(p.pos.zusatz)+'</span>':'')+'</span>'+(p.menge?'<span class="na-pmenge">'+esc(p.menge)+'</span>':'')+'</div>').join('');
    });
  });
  return { titel:'Rüstliste', pfad:s.titel, zurueck:'#/s/'+s.id, html };
}
naAkt('ruestHaken', (d, el)=>{ const k = 'nalokal_ruest_'+d.std; const h = loadJSON(k, {}) || {}; h[d.pos] = !h[d.pos]; if(!h[d.pos]) delete h[d.pos];
  store.set(k, JSON.stringify(h)); const z = el.closest('.na-pos'); if(z) z.classList.toggle('erledigt', !!h[d.pos]); });
naAkt('ruestNull', d=>{ store.set('nalokal_ruest_'+d.std, '{}'); naZeigen(); });

/* ── Kosten (nur Verwaltung; Überblick für Controlling, Einkauf, Chefarzt) ── */
function naKostenVon(s){ return naKosten(s, naStamm); }
function naSichtKosten(id){
  if(!naAdmin()) return { titel:'Kosten', html: naLeer('🔒','Nur in der Verwaltung','') };
  const s = naHole('standard', id); if(!s) return { titel:'Kosten', html: naLeer('❓','Nicht gefunden','') };
  const k = naKostenVon(s);
  const grund = { stammsatz:'Stammsatz fehlt', menge:'Menge unklar', preis:'kein Preis' };
  let html = '<div class="na-karte"><h3>Plankosten: <span class="na-preis">'+naEuro(k.summe)+'</span></h3>'
    + (k.vollstaendig ? '<div class="na-dim">Vollständig: alle Positionen haben Menge und Preis.</div>' : '<div class="na-warn">Unvollständig: '+k.fehlend+' Position(en) ohne Preis oder mit unklarer Menge — die Summe ist eine Untergrenze.</div>')
    + '<div class="na-dim">Medizinische Begründungen und Patientendaten gehören nicht hierher. Die App bestellt nichts.</div></div>'
    + '<table class="na-tab-tbl"><tr><th>Position</th><th class="z">Menge</th><th class="z">Stück</th><th class="z">Betrag</th></tr>'
    + k.posten.map(p=>'<tr class="'+(p.fehlt?'luecke':'')+'"><td>'+esc(p.name)+(p.fehlt?' <small>('+grund[p.fehlt]+')</small>':'')+'</td><td class="z">'+(p.menge==null?'?':esc(String(p.menge).replace('.',',')))+'</td><td class="z">'+naEuro(p.preis)+'</td><td class="z">'+naEuro(p.betrag)+'</td></tr>').join('')
    + '</table><div style="margin:12px 0"><button class="na-knopf" data-na="kostenCsv" data-std="'+esc(s.id)+'">⬇ Als CSV (Excel)</button></div>';
  return { titel:'Kosten', pfad:s.titel, zurueck:'#/s/'+s.id, html };
}
function naKostenZeilen(liste){
  const z = [['Standard','Position','GTIN','REF','Menge','Stückpreis','Betrag','Lücke']];
  liste.forEach(s=>{ naKostenVon(s).posten.forEach(p=>{ const st = naStamm(p.pos.ref) || {};
    z.push([s.titel, p.name, st.gtin||'', st.ref||'', p.menge==null?'':String(p.menge).replace('.',','), p.preis==null?'':p.preis.toFixed(2).replace('.',','), p.betrag==null?'':p.betrag.toFixed(2).replace('.',','), p.fehlt||'']); }); });
  return z;
}
naAkt('kostenCsv', d=>{ const s = naHole('standard', d.std); if(!s) return;
  naHerunterladen('Kosten '+s.titel.replace(/[\\/:*?"<>|]/g,'_')+'.csv', '﻿'+naCsv(naKostenZeilen([s])), 'text/csv;charset=utf-8'); });
