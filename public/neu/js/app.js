/* ─────────────────────────────────────────────────────────────
   NEUE APP — START, NAVIGATION, ANMELDUNG

   Die Seite läuft NUR im Raum „Neuaufbau". Ist auf diesem Gerät ein anderer
   Raum gewählt (oder live), zeigt sie nur einen Hinweis und schreibt nichts.
   Navigation über die Adresse (#/…), damit „Zurück" des Geräts funktioniert.
   ───────────────────────────────────────────────────────────── */
const NA_TABS = [
  { id:'standard',   ziel:'#/standards',  ico:'📋', wort:'Standards' },
  { id:'material',   ziel:'#/material',   ico:'📦', wort:'Material' },
  { id:'geraet',     ziel:'#/geraet',     ico:'🖥', wort:'Geräte' },
  { id:'medikament', ziel:'#/medikament', ico:'💊', wort:'Medikamente' },
  { id:'mehr',       ziel:'#/mehr',       ico:'☰', wort:'Mehr' },
];
let NA_BEARBEITUNG = false;
/* Navigation: Adresse setzen UND sofort zeichnen (pushState löst kein
   hashchange aus; „Zurück" des Geräts schon). */
function naGeh(ziel){
  if(naSheetOffen()) naSheetZu(null);
  if(location.hash!==ziel){ try{ history.pushState(null, '', ziel); }catch(e){ location.hash = ziel; return; } }
  naZeigen(); window.scrollTo(0, 0);
}
naAkt('geh', d=>naGeh(d.ziel));

function naRoute(){ return (location.hash || '#/standards').replace(/^#\/?/, '').split('/').map(x=>decodeURIComponent(x)); }
function naSichtFuer(r){
  const [a, b, c] = r;
  switch(a){
    case 's':
      if(c==='bearbeiten') return naSichtEditor(b);
      if(c==='ruest') return naSichtRuest(b);
      if(c==='kosten') return naSichtKosten(b);
      return naSichtStandard(b);
    case 'material': case 'geraet': case 'medikament':
      return b ? Object.assign(naSichtStamm(a, b), { tab:a, zurueck:'#/'+a }) : naSichtVerzeichnis(a);
    case 'bausteine': return naSichtBausteine();
    case 'b': return naSichtBaustein(b);
    case 'mehr': return naSichtMehr();
    case 'listen': return naSichtListen();
    case 'liste': return naSichtListe(b);
    case 'meldungen': return naSichtMeldungen();
    case 'verlauf': return naSichtVerlauf();
    case 'papierkorb': return naSichtPapierkorb();
    case 'kosten': return naSichtKostenAlle();
    case 'sicherung': return naSichtSicherung();
    case 'einstellungen': return naSichtEinstellungen();
    default: return naSichtStandards();
  }
}
function naZeigen(){
  const r = naRoute();
  /* Ein Entwurf gilt nur, solange seine Maske offen ist. */
  if(NA_ENTWURF && !(r[0]===NA_ENTWURF.typ && (r[1]===NA_ENTWURF.obj.id || (r[1]==='neu' && NA_ENTWURF.neu)))){ NA_ENTWURF = null; NA_RUECKSPRUNG = null; }
  let v;
  try{ v = naSichtFuer(r); }
  catch(e){ console.error(e); v = { titel:'Fehler', html:'<div class="na-fehler">Diese Ansicht ließ sich nicht aufbauen: '+esc(e.message)+'</div>' }; }
  const tab = v.tab || ({ s:'standard', standards:'standard', b:'mehr' })[r[0]] || (['mehr','listen','liste','meldungen','verlauf','papierkorb','kosten','sicherung','einstellungen','bausteine'].indexOf(r[0])>=0 ? 'mehr' : 'standard');
  $('naTitel').textContent = v.titel || 'HKL Standards';
  $('naPfad').textContent = v.pfad || '';
  document.title = (v.titel ? v.titel+' · ' : '')+'HKL Standards';
  const z = $('naZurueck'); z.hidden = !v.zurueck; z.setAttribute('data-ziel', v.zurueck || '');
  $('naMain').innerHTML = v.html + (v.plus ? '<button class="na-plus" data-na="'+esc(v.plus.na)+'"'+(v.plus.ziel?' data-ziel="'+esc(v.plus.ziel)+'"':'')+' aria-label="Neu anlegen">＋</button>' : '');
  $('naTabs').innerHTML = NA_TABS.map(t=>'<button class="na-tab'+(t.id===tab?' an':'')+'" data-na="geh" data-ziel="'+t.ziel+'"><b>'+t.ico+'</b>'+esc(t.wort)+'</button>').join('');
  $('naAnmelden').textContent = naAdmin() ? '🔓' : '🔒';
  $('naAnmelden').title = naAdmin() ? 'Verwaltung angemeldet' : 'Anmelden (Verwaltung)';
  naLeisteZeigen();
  NA_BEARBEITUNG = !!v.bearbeitung;
  if(v.nachher) try{ v.nachher(); }catch(e){ console.error(e); }
}
function naLeisteZeigen(){
  const l = $('naLeiste'); if(!l) return;
  if(raumLiveGemerkt()==='neuaufbau'){ l.innerHTML = ''; return; }
  l.innerHTML = '<div class="na-leiste"><span>Neuaufbau — nicht live. Das Labor arbeitet im Bestand.</span><button data-na="zumBestand">Zum Bestand</button></div>';
}
document.addEventListener('click', ev=>{ const z = ev.target.closest('#naZurueck'); if(!z) return; const ziel = z.getAttribute('data-ziel'); if(ziel) naGeh(ziel); });

/* ── Anmelden ── */
naAkt('anmeldenOk', ()=>{
  const f = $('naAnmeldePw');
  if(naAnmelden(f ? f.value : '')){ naSheetZu(null); toast('Verwaltung angemeldet'); naZeigen(); }
  else { toast('Passwort stimmt nicht.', true); if(f){ f.value = ''; f.focus(); } }
});
naAkt('abmelden', ()=>{ naAbmelden(); naSheetZu(null); toast('Abgemeldet'); naZeigen(); });
function naAnmeldeBlatt(){
  if(naAdmin()){ naSheetAuf('<div class="sheet-name">Verwaltung angemeldet</div><button class="sheet-act" data-na="abmelden"><span class="sa-ico">🔒</span><span>Abmelden</span></button>'); return; }
  naSheetAuf('<div class="sheet-title">Verwaltung</div><div class="na-feld"><label>Passwort</label><input type="password" id="naAnmeldePw" autocomplete="current-password"></div>'
    + '<div class="na-zeile"><button class="btn btn-sec" data-na="sheetZu">Abbrechen</button><button class="btn btn-pri" data-na="anmeldenOk">Anmelden</button></div>');
  const f = $('naAnmeldePw'); setTimeout(()=>{ try{ f.focus(); }catch(e){} }, 60);
  f.addEventListener('keydown', ev=>{ if(ev.key==='Enter'){ ev.preventDefault(); NA_AKT.anmeldenOk(); } });
}

/* ── Start ── */
function naSchutzZeigen(){
  $('naTitel').textContent = 'HKL Standards'; $('naPfad').textContent = 'Neue App';
  $('naMain').innerHTML = '<div class="na-schutz"><h2>Die neue App läuft nur im Neuaufbau</h2><p class="na-dim">Auf diesem Gerät ist der '+esc(RAUM.titel)+' gewählt. Hier wird nichts angezeigt und nichts gespeichert.</p><p><a class="na-knopf pri" href="../">Zur App</a></p></div>';
  $('naTabs').innerHTML = '';
  ['naAnmelden','naThema'].forEach(id=>{ const e = $(id); if(e) e.hidden = true; });
}
async function naStart(){
  const t = store.get('hkl_theme'); if(t) document.documentElement.setAttribute('data-theme', t);
  if(RAUM.id!==NA_RAUM){ naSchutzZeigen(); return; }
  $('naSheetOv').addEventListener('click', ()=>naSheetZu(null));
  $('naAnmelden').addEventListener('click', naAnmeldeBlatt);
  $('naThema').addEventListener('click', ()=>NA_AKT.thema());
  $('naPunkt').addEventListener('click', ()=>{ const s = naAbgleich.status(); toast(s.text || 'Abgleich …'); naAbgleich.runde(); });
  try{ const r = await fetch('../data/merkmale.json', { cache:'no-store' }); if(r.ok){ NA_MERKQUELLE = await r.json(); if(typeof merkSetData==='function') merkSetData(NA_MERKQUELLE); } }catch(e){ /* ohne Katalog: nur eigene Kategorien */ }
  naAllesLaden();
  window.addEventListener('hashchange', ()=>{ if(naSheetOffen()) naSheetZu(null); naZeigen(); window.scrollTo(0, 0); });
  naZeigen();
  naAbgleich.start(keys=>{
    keys.forEach(naSchluesselLaden);
    if(NA_BEARBEITUNG || naSheetOffen()){ toast('Auf einem anderen Gerät wurde etwas geändert.'); return; }
    const y = window.scrollY; naZeigen(); window.scrollTo(0, y);
  });
  if('serviceWorker' in navigator){ try{ navigator.serviceWorker.register('../sw.js'); }catch(e){} }
}
naStart();
