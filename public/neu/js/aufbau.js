/* ─────────────────────────────────────────────────────────────
   NEUE APP — AUFBAU AUS DEM BESTAND: die rechte Seite des Editors
   (Entscheidung 18.11.2026, nur am PC)

   Solange der Schalter „Aufbau aus dem Bestand" an ist (Einstellungen),
   öffnet „Neuer Standard" sofort den geteilten Bildschirm: links der neue
   Standard, rechts alles aus dem Bestand mit Volltextsuche. Übernommen wird
   nur, was mit der Maus herübergezogen wird.

   · Der Bestand wird NUR GELESEN — beim Öffnen frisch vom Server
     (GET /api/state ohne Raum = der Bestand). Geschrieben wird ausschließlich
     über den Editor in den eigenen Raum (naAbgleich).
   · Die Aufbereitung ist rein und steht in bestand.js.
   · Ziehen mit der Maus (HTML-Ziehen). Das Verschieben von Zeilen im Editor
     läuft über dieselben Ziele.
   ───────────────────────────────────────────────────────────── */
const NA_AB_BREIT = 1100;   /* darunter kein geteilter Bildschirm */
let NA_AB = { daten:null, laedt:false, fehler:'', q:'', gruppe:'', rubrik:'', auf:{}, offen:false, treffer:null };
let NA_ZIEHT = null;        /* { von:'quelle'|'editor', art, q?, pos? } — während eines Ziehens */

function naAbAn(){ return naEinstellung('aufbau', true); }
function naAbBreit(){ return window.innerWidth >= NA_AB_BREIT; }
function naAbImEditor(){ const r = naRoute(); return r[0]==='s' && !!r[1] && r[2]==='bearbeiten'; }
/* Zeilen verschieben geht in beiden Editoren: Standard und Baustein. */
function naAbImBearbeiten(){ const r = naRoute(); return naAbImEditor() || (r[0]==='b' && !!r[1]); }
/* Zugeklappt? Bei eingeschaltetem Aufbau merkt sich das Gerät „zu"; sonst
   ist die Seite nur offen, wenn sie mit dem Knopf geöffnet wurde. */
function naAbOffen(){ return naAbAn() ? store.get('nalokal_quelle_zu')!=='1' : NA_AB.offen; }
function naAbSoll(){ return naAdmin() && naAbImEditor() && naAbBreit() && naAbOffen(); }
function naAbOeffnen(){ if(naAbAn()) store.set('nalokal_quelle_zu', '0'); else NA_AB.offen = true; }
naAkt('abAuf', ()=>{ naAbOeffnen(); naAbNachZeigen(); });
naAkt('abZu', ()=>{ if(naAbAn()) store.set('nalokal_quelle_zu', '1'); else NA_AB.offen = false; naAbNachZeigen(); naFormNeu(); });

/* Knopf und Hinweis im Kopf des Editors (standards.js). */
function naAbEditorKnopf(){
  if(!naAbBreit()) return naAbAn() ? '<div class="na-dim" style="margin-top:6px">Aufbau aus dem Bestand: Der geteilte Bildschirm erscheint am PC (ab '+NA_AB_BREIT+' px Breite).</div>' : '';
  return naAbSoll() ? '' : '<button class="na-knopf" data-na="abAuf">📚 Bestand</button>';
}

/* ── Den Bestand lesen (nur GET) ── */
async function naAbLaden(){
  if(NA_AB.laedt) return; NA_AB.laedt = true; NA_AB.fehler = ''; naAbStand();
  try{
    const [exp, z] = await Promise.all([
      fetch('../data/hkl_standards_export.json').then(r=>{ if(!r.ok) throw new Error('Standards '+r.status); return r.json(); }),
      fetch('/api/state', { cache:'no-store' }).then(r=>{ if(!r.ok) throw new Error('Server '+r.status); return r.json(); }) ]);
    /* Ohne Raum-Angabe antwortet der Server mit dem Bestand. Käme ein anderer Raum, stimmte die Quelle nicht. */
    if(z && z.raum && z.raum!=='bestand') throw new Error('falscher Raum');
    const stds = naBestandAufbereiten(exp, (z && z.state) || {});
    NA_AB.daten = naAbDatenBauen(stds); NA_AB.daten.geholt = Date.now();
  }catch(e){ NA_AB.fehler = 'Der Bestand ließ sich nicht lesen ('+((e && e.message) || 'Netz')+'). Der Editor links arbeitet trotzdem.'; }
  NA_AB.laedt = false;
  if(naAbSoll()){ naAbStand(); naAbFilter(); naAbListe(); }
}
naAkt('abNeuLaden', ()=>{ NA_AB.daten = null; naAbLaden(); });
function naAbDatenBauen(stds){
  const D = { stds, std:{}, rub:{}, abs:{}, zeile:{}, gruppen:[], rubNamen:[] };
  const gz = {}, rz = {};
  stds.forEach(s=>{ D.std[s.id] = s; gz[s.gruppe||''] = (gz[s.gruppe||'']||0)+1;
    s.notizen.forEach(n=>{ D.zeile[n.key] = { std:s, rub:null, abs:null, l:n }; });
    s.rubriken.forEach(r=>{ D.rub[r.key] = { std:s, rub:r }; if(!r.material && r.name) rz[r.name] = (rz[r.name]||0)+1;
      r.notizen.forEach(n=>{ D.zeile[n.key] = { std:s, rub:r, abs:null, l:n }; });
      r.abschnitte.forEach(a=>{ D.abs[a.key] = { std:s, rub:r, abs:a };
        a.zeilen.forEach(l=>{ D.zeile[l.key] = { std:s, rub:r, abs:a, l }; }); }); }); });
  D.gruppen = Object.keys(gz).filter(Boolean).sort((a,b)=>a.localeCompare(b, 'de'));
  D.rubNamen = Object.keys(rz).sort((a,b)=>rz[b]-rz[a] || a.localeCompare(b, 'de')).slice(0, 12);
  D.index = naBstIndex(stds);
  return D;
}

/* ── Die rechte Seite ── Das Gerüst steht einmal; neu gezeichnet werden nur
   Stand, Filter und Liste — so bleibt das Suchfeld beim Tippen in Ruhe. */
function naAbPanel(){
  let p = document.getElementById('naQuelle');
  if(!p){ p = document.createElement('aside'); p.id = 'naQuelle'; p.className = 'na-quelle'; p.setAttribute('aria-label', 'Bestand als Quelle');
    p.innerHTML = '<div class="na-q-kopf"><div style="flex:1;min-width:0"><b>Bestand</b> <span class="na-dim">— nur gelesen, ziehen zum Übernehmen</span><div class="na-dim" id="naQStand"></div></div>'
      + '<button class="na-knopf klein" data-na="abNeuLaden" title="Bestand neu lesen" aria-label="Bestand neu lesen">↻</button>'
      + '<button class="na-knopf klein" data-na="abZu" title="Rechte Seite zuklappen" aria-label="Zuklappen">✕</button></div>'
      + '<div class="na-q-such"><input class="na-suche" type="search" id="naQSuche" placeholder="Alles durchsuchen: Formulierung, Abschnitt, Rubrik, Standard …" autocomplete="off" data-na-ein="abSuche"></div>'
      + '<div class="na-q-filter" id="naQFilter"></div><div id="naQListe"></div>';
    document.body.appendChild(p);
    p.addEventListener('dragstart', naAbZiehStart);
    p.addEventListener('dragend', naAbZiehEnde);
  }
  return p;
}
function naAbNachZeigen(){
  const soll = naAbSoll();
  document.body.classList.toggle('na-geteilt', soll);
  if(!soll) return;
  naAbPanel();
  if(!NA_AB.daten && !NA_AB.laedt && !NA_AB.fehler) naAbLaden();
  naAbStand(); naAbFilter(); naAbListe();
}
function naAbStand(){
  const el = document.getElementById('naQStand'); if(!el) return; const D = NA_AB.daten;
  el.textContent = NA_AB.laedt ? 'wird gelesen …' : (NA_AB.fehler ? 'nicht gelesen' : (D ? D.stds.length+' Standards · gelesen '+naUhrzeit(new Date(D.geholt).toISOString()) : ''));
}
function naAbFilter(){
  const el = document.getElementById('naQFilter'); if(!el) return; const D = NA_AB.daten; if(!D){ el.innerHTML = ''; return; }
  const chip = (art, wert, wort)=>'<button class="na-chip'+(NA_AB[art]===wert?' an':'')+'" data-na="abFilter" data-art="'+art+'" data-w="'+esc(wert)+'">'+esc(wort)+'</button>';
  el.innerHTML = '<div class="na-chips">'+chip('gruppe', '', 'alle Gruppen')+D.gruppen.map(g=>chip('gruppe', g, g)).join('')+'</div>'
    + '<div class="na-chips">'+chip('rubrik', '', 'alle Rubriken')+D.rubNamen.map(n=>chip('rubrik', n, n)).join('')+'</div>';
}
naAkt('abFilter', d=>{ NA_AB[d.art] = NA_AB[d.art]===d.w ? '' : d.w; naAbFilter(); naAbListe(); });
let naAbSuchZeit = null;
naEin('abSuche', v=>{ NA_AB.q = v; if(naAbSuchZeit) clearTimeout(naAbSuchZeit); naAbSuchZeit = setTimeout(()=>{ naAbSuchZeit = null; naAbListe(); }, 120); });
naAkt('abKlapp', d=>{ NA_AB.auf[d.k] = !NA_AB.auf[d.k]; naAbListe(); });
naAkt('abZumStandard', d=>{ NA_AB.q = ''; const f = document.getElementById('naQSuche'); if(f) f.value = ''; NA_AB.auf['s:'+d.id] = true; naAbListe();
  setTimeout(()=>{ const z = document.querySelector('#naQListe [data-std-kopf="'+d.id+'"]'); if(z) z.scrollIntoView({ block:'start' }); }, 30); });

/* Markierung „schon übernommen" */
function naAbBenutzt(){ return naBstBenutzt(naAlle('standard'), NA_ED && NA_ED.typ==='standard' ? NA_ED.id : null); }
function naAbMarke(b, l){ const m = naBstMarke(b, l);
  return (m.hier ? '<span class="na-q-mark hier" title="in diesem Standard übernommen">✓</span>' : '')
    + (m.anders ? '<span class="na-q-mark anders" title="in '+m.anders+' anderen neuen Standard(s) übernommen">✓'+m.anders+'</span>' : ''); }
function naAbOrt(x){ return [x.std.titel, x.rub && x.rub.name, x.abs && x.abs.name].filter(Boolean).join(' › '); }
function naAbZeileHtml(b, l, opt){
  opt = opt || {};
  const gesperrt = !!opt.gesperrt;
  const zus = l.zusatz ? '<div class="na-q-zus">'+esc(l.zusatz)+'</div>' : '';
  const wort = (!gesperrt && l.wort) ? '<div class="na-q-wort" draggable="true" data-q-art="wort" data-q="'+esc(l.key)+'" title="Den Wortlaut aus der Word-Datei übernehmen">Word: '+esc(l.wort)+'</div>' : '';
  return '<div class="na-q-zeile'+(gesperrt?' gesperrt':'')+(l.notiz?' notiz':'')+'"'+(gesperrt ? ' title="Material bleibt draußen — es wird im Neuaufbau aus dem Verzeichnis eingetragen"' : ' draggable="true" data-q-art="zeile" data-q="'+esc(l.key)+'"')+'>'
    + '<span class="na-griff">'+(gesperrt ? '🔒' : '⋮⋮')+'</span><div class="na-q-text">'+(l.menge ? '<span class="na-pmenge">'+esc(l.menge)+'</span> ' : '')
    + (l.notiz ? 'ℹ️ ' : (l.kaestchen ? '' : ''))+esc(l.text)+(opt.ort ? '<div class="na-q-ort">'+esc(opt.ort)+'</div>' : '')+zus+wort+'</div>'
    + (gesperrt ? '' : naAbMarke(b, l))+'</div>';
}
function naAbListe(){
  const el = document.getElementById('naQListe'); if(!el) return;
  const y = el.scrollTop; const D = NA_AB.daten;
  if(NA_AB.fehler){ el.innerHTML = '<div class="na-info na-offen">'+esc(NA_AB.fehler)+'<div style="margin-top:8px"><button class="na-knopf" data-na="abNeuLaden">↻ Noch einmal</button></div></div>'; return; }
  if(!D){ el.innerHTML = '<div class="na-dim" style="padding:12px 4px">Der Bestand wird gelesen …</div>'; return; }
  const b = naAbBenutzt();
  el.innerHTML = String(NA_AB.q||'').trim() ? naAbSuchHtml(D, b) : naAbBaumHtml(D, b);
  el.scrollTop = y;
}
/* Ohne Suche: blättern — Gruppe › Standard › Rubrik › Abschnitt › Zeilen */
function naAbBaumHtml(D, b){
  let h = naAbBausteineHtml(naAlle('baustein'), 'bs');
  const f = { gruppe:NA_AB.gruppe, rubrik:NA_AB.rubrik };
  const gruppen = {}; D.stds.forEach(s=>{ if(f.gruppe && s.gruppe!==f.gruppe) return; (gruppen[s.gruppe||'(ohne Gruppe)'] = gruppen[s.gruppe||'(ohne Gruppe)'] || []).push(s); });
  Object.keys(gruppen).sort((a,b2)=>a.localeCompare(b2, 'de')).forEach(g=>{
    h += '<div class="na-q-gruppe">'+esc(g)+' <span class="na-dim">('+gruppen[g].length+')</span></div>';
    gruppen[g].sort((a,c)=>a.titel.localeCompare(c.titel, 'de', { sensitivity:'base' })).forEach(s=>{ h += naAbStandardHtml(s, b, f); });
  });
  return h || naLeer('🔎', 'Nichts in dieser Auswahl', '');
}
function naAbStandardHtml(s, b, f){
  const auf = !!NA_AB.auf['s:'+s.id];
  let gesamt = 0, da = 0;
  s.rubriken.forEach(r=>{ if(r.material) return; r.abschnitte.forEach(a=>a.zeilen.forEach(l=>{ gesamt++; if(naBstMarke(b, l).hier) da++; })); });
  let h = '<div class="na-q-std'+(auf?' auf':'')+'" data-na="abKlapp" data-k="s:'+esc(s.id)+'" data-std-kopf="'+esc(s.id)+'"><span class="na-q-pfeil">'+(auf?'▾':'▸')+'</span><span style="flex:1">'+esc(s.titel)+(s.eigen ? ' <span class="na-dim">(im Labor angelegt)</span>' : '')+'</span>'
    + '<span class="na-dim" title="Zeilen dieses Bestands-Standards (ohne Material), deren Stelle oder Formulierung im neuen Standard schon steht">'+(da ? '<b class="na-q-ok">✓ '+da+'</b> von ' : '')+gesamt+' Zeilen</span></div>';
  if(!auf) return h;
  h += '<div class="na-q-in">';
  s.notizen.forEach(n=>{ h += naAbZeileHtml(b, n); });
  s.rubriken.forEach(r=>{ if(f.rubrik && naNorm(r.name)!==naNorm(f.rubrik)) return; h += naAbRubrikHtml(s, r, b); });
  return h + '</div>';
}
function naAbRubrikHtml(s, r, b){
  const k = 'r:'+r.key; const auf = NA_AB.auf[k]!==false;   /* Rubriken eines aufgeklappten Standards stehen offen */
  const n = r.abschnitte.reduce((x,a)=>x+a.zeilen.length, 0);
  let h = '<div class="na-q-rub'+(r.material?' material':'')+'" draggable="true" data-q-art="rub" data-q="'+esc(r.key)+'">'
    + '<span class="na-griff">⋮⋮</span><span style="flex:1"><b>'+esc(r.name||'(Rubrik ohne Namen)')+'</b>'+(r.material ? ' <span class="na-chip ansage">Material — nur die Hülle</span>' : '')+'</span>'
    + '<span class="na-dim">'+n+'</span><button class="na-knopf klein" data-na="abKlapp" data-k="'+esc(k)+'" aria-label="auf- oder zuklappen">'+(auf?'▾':'▸')+'</button></div>';
  if(!auf) return h;
  h += '<div class="na-q-in">';
  if(!r.material) r.notizen.forEach(nz=>{ h += naAbZeileHtml(b, nz); });
  r.abschnitte.forEach(a=>{
    if(a.name || r.abschnitte.length>1) h += '<div class="na-q-abs" draggable="true" data-q-art="abs" data-q="'+esc(a.key)+'"><span class="na-griff">⋮⋮</span><span style="flex:1">'+(a.name ? esc(a.name) : '<span class="na-leer">Abschnitt ohne Namen</span>')+'</span><span class="na-dim">'+a.zeilen.length+'</span></div>';
    a.zeilen.forEach(l=>{ h += naAbZeileHtml(b, l, { gesperrt:r.material }); });
  });
  return h + '</div>';
}
function naAbBausteineHtml(liste, k, offenErzwingen){
  if(!liste.length) return '';
  const auf = offenErzwingen || !!NA_AB.auf[k];
  let h = '<div class="na-q-gruppe" data-na="abKlapp" data-k="'+esc(k)+'" style="cursor:pointer">'+(auf?'▾':'▸')+' 🧩 Bausteine des Neuaufbaus <span class="na-dim">('+liste.length+')</span></div>';
  if(!auf) return h;
  liste.forEach(x=>{ h += '<div class="na-q-zeile baustein" draggable="true" data-q-art="baustein" data-q="'+esc(x.id)+'"><span class="na-griff">⋮⋮</span><div class="na-q-text">🧩 '+esc(x.name)
    + '<div class="na-q-ort">'+(x.positionen||[]).length+' Positionen: '+esc((x.positionen||[]).slice(0, 4).map(naPosText).join(' · '))+((x.positionen||[]).length>4 ? ' …' : '')+'</div></div></div>'; });
  return h;
}
/* Mit Suche: Formulierungen (zusammengefasst), Abschnitte, Rubriken, Standards, Bausteine */
function naAbSuchHtml(D, b){
  const f = { gruppe:NA_AB.gruppe, rubrik:NA_AB.rubrik };
  const e = naBstSuchen(D.stds, D.index, NA_AB.q, f); NA_AB.treffer = e;
  const w = naNorm(NA_AB.q).split(' ').filter(Boolean);
  const bs = naAlle('baustein').filter(x=>{ const t = naNorm(x.name+' '+(x.positionen||[]).map(naPosText).join(' ')); return w.every(y=>t.indexOf(y)>=0); });
  let h = '<div class="na-dim" style="margin:2px 2px 8px">'+e.treffer+' Fundstelle(n) in '+e.formulierungen.length+' Formulierung(en)'
    +(e.abschnitte.length ? ' · '+e.abschnitte.length+' Abschnitt-Name(n)' : '')+(e.standards.length ? ' · '+e.standards.length+' Standard(s)' : '')+'</div>';
  if(e.standards.length){ h += '<div class="na-q-gruppe">Standards</div>';
    e.standards.slice(0, 12).forEach(s=>{ h += '<div class="na-q-std" data-na="abZumStandard" data-id="'+esc(s.id)+'"><span class="na-q-pfeil">›</span><span style="flex:1">'+esc(s.titel)+'</span><span class="na-dim">'+esc(s.gruppe)+'</span></div>'; }); }
  if(e.formulierungen.length){ h += '<div class="na-q-gruppe">Formulierungen</div>';
    e.formulierungen.slice(0, 150).forEach((g, gi)=>{
      const k = 'f:'+g.key; const auf = !!NA_AB.auf[k]; const erst = g.stellen[0].zeile;
      h += '<div class="na-q-zeile form" draggable="true" data-q-art="form" data-q="'+gi+'"><span class="na-griff">⋮⋮</span><div class="na-q-text">'+(erst.notiz ? 'ℹ️ ' : '')+esc(g.text)
        + '<div class="na-q-ort">'+(g.nStd>1 ? 'in '+g.nStd+' Standards' : esc(naAbOrt(g.stellen[0])))+(g.stellen.length>g.nStd ? ' · '+g.stellen.length+'×' : '')+'</div></div>'
        + naAbMarke(b, erst)+'<button class="na-knopf klein" data-na="abKlapp" data-k="'+esc(k)+'" title="Alle Fundstellen" aria-label="Fundstellen">'+(auf?'▾':'▸')+'</button></div>';
      if(auf){ h += '<div class="na-q-in">'; g.stellen.forEach(x=>{ h += naAbZeileHtml(b, x.zeile, { ort:naAbOrt(x) }); }); h += '</div>'; }
    });
    if(e.formulierungen.length>150) h += '<div class="na-dim">… weitere — bitte genauer suchen.</div>';
  }
  const namenListe = (titel, liste, art)=>{ if(!liste.length) return '';
    let x = '<div class="na-q-gruppe">'+titel+'</div>';
    liste.slice(0, 40).forEach(g=>{ const k = art+':'+naNorm(g.name); const auf = !!NA_AB.auf[k];
      x += '<div class="na-q-std" data-na="abKlapp" data-k="'+esc(k)+'"><span class="na-q-pfeil">'+(auf?'▾':'▸')+'</span><span style="flex:1">„'+esc(g.name)+'"</span><span class="na-dim">in '+g.stellen.length+'</span></div>';
      if(auf){ x += '<div class="na-q-in">'; g.stellen.forEach(s=>{ const n = art==='abs' ? s.abs.zeilen.length : s.rub.abschnitte.reduce((y,a)=>y+a.zeilen.length, 0);
        x += '<div class="na-q-'+(art==='abs'?'abs':'rub')+(s.rub.material?' material':'')+'" draggable="true" data-q-art="'+art+'" data-q="'+esc(art==='abs' ? s.abs.key : s.rub.key)+'"><span class="na-griff">⋮⋮</span><span style="flex:1">'+esc(s.std.titel)+(art==='abs' ? ' › '+esc(s.rub.name) : '')
          +(s.rub.material ? ' <span class="na-chip ansage">nur die Hülle</span>' : '')+'</span><span class="na-dim">'+n+' Zeilen</span></div>'; });
        x += '</div>'; } });
    return x; };
  h += namenListe('Abschnitte', e.abschnitte, 'abs');
  h += namenListe('Rubriken', e.rubriken, 'rub');
  if(bs.length) h += naAbBausteineHtml(bs, 'bsq', true);
  if(!e.formulierungen.length && !e.abschnitte.length && !e.rubriken.length && !e.standards.length && !bs.length) h += naLeer('🔎', 'Nichts gefunden', 'Andere Schreibweise oder weniger Wörter versuchen. Material-Rubriken werden nicht durchsucht.');
  return h;
}

/* ── Ziehen ── */
function naAbArtKlasse(art){ return art==='rub' ? 'rub' : (art==='abs' ? 'abs' : 'pos'); }
function naAbZiehStart(ev){
  const el = ev.target.closest && ev.target.closest('[data-q-art]'); if(!el || el.classList.contains('gesperrt')){ ev.preventDefault(); return; }
  ev.stopPropagation();
  NA_ZIEHT = { von:'quelle', art:el.getAttribute('data-q-art'), q:el.getAttribute('data-q') };
  try{ ev.dataTransfer.effectAllowed = 'copy'; ev.dataTransfer.setData('text/plain', el.textContent.trim().slice(0, 200)); }catch(e){}
  document.body.classList.add('na-zieht', 'na-zieht-'+naAbArtKlasse(NA_ZIEHT.art));
  el.classList.add('zieh');
}
function naAbZiehEnde(ev){
  if(ev && ev.target && ev.target.classList) ev.target.classList.remove('zieh');
  NA_ZIEHT = null; naAbMarkeWeg();
  document.body.classList.remove('na-zieht', 'na-zieht-pos', 'na-zieht-abs', 'na-zieht-rub');
}
let naAbMarkiert = null;
function naAbMarkeWeg(){ if(naAbMarkiert){ naAbMarkiert.classList.remove('drop-vor', 'drop-nach', 'drop-in'); naAbMarkiert = null; } }
/* Wohin käme es? → { el, cls, ziel } oder null. Die Stellen werden am
   Standard selbst gezählt (Kennungen), nicht am Bildschirm. */
function naAbZiel(ev, Z){
  const s = naEdObj(); if(!s || !NA_ED || !Z) return null;
  const t = ev.target && ev.target.closest ? ev.target : null; if(!t) return null;
  const halb = el=>{ const r = el.getBoundingClientRect(); return ev.clientY < r.top + r.height/2 ? 'vor' : 'nach'; };
  if(NA_ED.typ==='baustein'){   /* im Baustein: nur Zeilen verschieben */
    if(Z.von!=='editor') return null;
    const p = t.closest('#naMain [data-pos-id]'); if(!p) return null; const x = naPosFinden(s, p.getAttribute('data-pos-id')); if(!x) return null;
    const h = halb(p); return { el:p, cls:'drop-'+h, ziel:{ art:'liste', i:x.i+(h==='nach'?1:0) } };
  }
  if(NA_ED.typ!=='standard') return null;
  const kl = naAbArtKlasse(Z.art);
  const ende = t.closest('[data-drop-ende]'); if(ende) return { el:ende, cls:'drop-in', ziel:{ art:'neu' } };
  if(kl==='pos'){
    const p = t.closest('#naMain [data-pos-id]');
    if(p){ const id = p.getAttribute('data-pos-id'); const x = naPosFinden(s, id); if(!x || !x.a) return null; const h = halb(p);
      return { el:p, cls:'drop-'+h, ziel:{ art:'pos', a:x.a.id, i:x.i+(h==='nach'?1:0) } }; }
    const ab = t.closest('#naMain [data-abs-block]'); if(ab) return { el:ab, cls:'drop-in', ziel:{ art:'posende', a:ab.getAttribute('data-abs-block') } };
    const rb = t.closest('#naMain [data-rub-block]'); if(rb) return { el:rb, cls:'drop-in', ziel:{ art:'rubende', r:rb.getAttribute('data-rub-block') } };
    return null;
  }
  if(kl==='abs'){
    const ab = t.closest('#naMain [data-abs-block]');
    if(ab){ const x = naAbschnittFinden(s, ab.getAttribute('data-abs-block')); if(!x) return null; const h = halb(ab); const i = x.r.abschnitte.indexOf(x.a);
      return { el:ab, cls:'drop-'+h, ziel:{ art:'abs', r:x.r.id, i:i+(h==='nach'?1:0) } }; }
    const rb = t.closest('#naMain [data-rub-block]'); if(rb) return { el:rb, cls:'drop-in', ziel:{ art:'absende', r:rb.getAttribute('data-rub-block') } };
    return null;
  }
  const rb = t.closest('#naMain [data-rub-block]');
  if(rb){ const i = (s.rubriken||[]).findIndex(r=>r.id===rb.getAttribute('data-rub-block')); if(i<0) return null; const h = halb(rb);
    return { el:rb, cls:'drop-'+h, ziel:{ art:'rub', i:i+(h==='nach'?1:0) } }; }
  return null;
}
/* Das Stück, das aus dem Gezogenen wird (bestand.js baut es). */
function naAbTeil(Z){
  const D = NA_AB.daten;
  if(Z.art==='baustein'){ const bs = naHole('baustein', Z.q); if(!bs || !(bs.positionen||[]).length) return null;
    return { art:'positionen', liste:bs.positionen.map(p=>Object.assign(JSON.parse(JSON.stringify(p)), { id:naId('p'), ausBaustein:bs.id })), rubName:bs.name, kurz:'Baustein „'+bs.name+'"' }; }
  if(!D) return null;
  if(Z.art==='zeile' || Z.art==='wort'){ const x = D.zeile[Z.q]; if(!x || (x.rub && x.rub.material)) return null;
    const text = Z.art==='wort' ? (x.l.wort || x.l.text) : x.l.text;
    return { art:'positionen', liste:[naBstPosition(x.std, x.l, text)], rubName:x.rub ? x.rub.name : '', absName:x.abs ? x.abs.name : '', kurz:'„'+text+'"', namen:{ rub:x.rub && x.rub.name, abs:x.abs && x.abs.name } }; }
  if(Z.art==='form'){ const g = NA_AB.treffer && NA_AB.treffer.formulierungen[+Z.q]; if(!g) return null;
    const x = g.stellen.find(s=>s.zeile.text===g.text) || g.stellen[0];
    return { art:'positionen', liste:[naBstPosition(x.std, x.zeile, g.text)], rubName:x.rub ? x.rub.name : '', absName:x.abs ? x.abs.name : '', kurz:'„'+g.text+'"', namen:{ rub:x.rub && x.rub.name, abs:x.abs && x.abs.name } }; }
  if(Z.art==='abs'){ const x = D.abs[Z.q]; if(!x) return null;
    return { art:'abschnitt', abschnitt:naBstAbschnittNeu(x.std, x.rub, x.abs), rubName:x.rub.name, kurz:'Abschnitt „'+(x.abs.name||'ohne Namen')+'" aus „'+x.std.titel+'"', namen:{ rub:x.rub.name, abs:x.abs.name } }; }
  if(Z.art==='rub'){ const x = D.rub[Z.q]; if(!x) return null;
    const rubrik = naBstRubrikNeu(x.std, x.rub);
    return { art:'rubrik', rubrik, kurz:'Rubrik „'+(x.rub.name||'')+'" aus „'+x.std.titel+'"'+(x.rub.material ? ' (nur die Hülle)' : ''), namen:{ rub:x.rub.name, abs:rubrik.abschnitte.map(a=>a.name) } }; }
  return null;
}
/* Neue Rubrik- und Abschnittsnamen kommen in ihre Listen — wie überall, wo
   etwas angelegt wird. Schon vorhandene Namen (gleich geschrieben) bleiben. */
function naAbNamenInListen(s){
  const neu = (key, name)=>{ name = String(name||'').trim(); if(!name) return;
    if(naListe(key, true).some(x=>naNorm(x.name)===naNorm(name))) return; naListeNeu(key, name, 'Aufbau aus dem Bestand: '+s.titel); };
  (s.rubriken||[]).forEach(r=>{ neu('rubriken', r.name); (r.abschnitte||[]).forEach(a=>neu('abschnitte', a.name)); });
}
function naAbAusfuehren(Z, ziel){
  const s = naEdObj(); if(!s) return;
  if(NA_ED.typ==='baustein'){ const q = naPosFinden(s, Z.pos); if(!q || ziel.art!=='liste' || ziel.i===q.i || ziel.i===q.i+1) return;
    const [pos] = q.liste.splice(q.i, 1); q.liste.splice(ziel.i>q.i ? ziel.i-1 : ziel.i, 0, pos); naEdSpeichern('Position verschoben'); return; }
  if(NA_ED.typ!=='standard') return;
  if(Z.von==='editor'){
    const q = naPosFinden(s, Z.pos); if(!q) return;
    if(ziel.art==='pos' && ziel.a===(q.a && q.a.id) && (ziel.i===q.i || ziel.i===q.i+1)) return;   /* an derselben Stelle losgelassen */
    const [pos] = q.liste.splice(q.i, 1);
    if(ziel.art==='pos' && ziel.a===(q.a && q.a.id) && ziel.i>q.i) ziel = Object.assign({}, ziel, { i:ziel.i-1 });
    if(!naStdEinfuegen(s, ziel, { art:'positionen', liste:[pos], rubName:'' })) q.liste.splice(q.i, 0, pos);
    naEdSpeichern('Position verschoben'); return;
  }
  const teil = naAbTeil(Z); if(!teil){ toast('Das lässt sich nicht übernehmen.', true); return; }
  if(!naStdEinfuegen(s, ziel, teil)) return;
  naAbNamenInListen(s);
  naEdSpeichern('aus dem Bestand übernommen: '+teil.kurz);
  toast('Übernommen: '+teil.kurz);
}
/* Ziele im Editor: einmal für das ganze Dokument, gefiltert auf den Editor. */
document.addEventListener('dragstart', ev=>{
  const el = ev.target && ev.target.closest ? ev.target.closest('#naMain [data-pos-id]') : null; if(!el || !naAbImBearbeiten()) return;
  NA_ZIEHT = { von:'editor', art:'pos', pos:el.getAttribute('data-pos-id') };
  try{ ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', el.getAttribute('data-pos-id')); }catch(e){}
  el.classList.add('zieh'); document.body.classList.add('na-zieht', 'na-zieht-pos');
});
document.addEventListener('dragend', ev=>{ if(NA_ZIEHT && NA_ZIEHT.von==='editor') naAbZiehEnde(ev); });
document.addEventListener('dragover', ev=>{
  if(!NA_ZIEHT) return; const z = naAbZiel(ev, NA_ZIEHT); if(!z){ naAbMarkeWeg(); return; }
  ev.preventDefault(); try{ ev.dataTransfer.dropEffect = NA_ZIEHT.von==='quelle' ? 'copy' : 'move'; }catch(e){}
  if(naAbMarkiert!==z.el || !z.el.classList.contains(z.cls)){ naAbMarkeWeg(); z.el.classList.add(z.cls); naAbMarkiert = z.el; }
});
document.addEventListener('drop', ev=>{
  if(!NA_ZIEHT) return; const Z = NA_ZIEHT; const z = naAbZiel(ev, Z); naAbMarkeWeg();
  if(!z) return; ev.preventDefault();
  NA_ZIEHT = null; document.body.classList.remove('na-zieht', 'na-zieht-pos', 'na-zieht-abs', 'na-zieht-rub');
  naAbAusfuehren(Z, z.ziel);
});
window.addEventListener('resize', (()=>{ let t = null; return ()=>{ if(t) clearTimeout(t); t = setTimeout(()=>{ t = null; const vorher = document.body.classList.contains('na-geteilt'); naAbNachZeigen(); if(vorher!==naAbSoll() && naAbImEditor()) naFormNeu(); }, 200); }; })());
