/* ─────────────────────────────────────────────────────────────
   NEUE APP — BEDIENBAUSTEINE

   · Aktionen laufen über data-na="<name>" + data-…-Attribute und EINEN
     Klick-Verteiler. Kein Freitext steht je in einem onclick.
   · Rückfragen und Eingaben sind eigene Blätter (nie prompt/confirm: in
     installierten PWAs lautlos wirkungslos, Grundsatz ⑧).
   · naAuswahl ist DAS Auswahlfeld der App: suchen, wählen, und — für die
     Verwaltung — an Ort und Stelle neu anlegen, mit Warnung vor Doppelungen.
   ───────────────────────────────────────────────────────────── */
const NA_AKT = {}, NA_EIN = {};
function naAkt(name, f){ NA_AKT[name] = f; }
function naEin(name, f){ NA_EIN[name] = f; }
document.addEventListener('click', ev=>{
  const el = ev.target.closest('[data-na]'); if(!el || el.disabled) return;
  const f = NA_AKT[el.getAttribute('data-na')]; if(!f) return;
  ev.preventDefault();
  try{ const r = f(el.dataset, el, ev); if(r && r.catch) r.catch(e=>{ console.error(e); toast('Fehler: '+e.message, true); }); }
  catch(e){ console.error(e); toast('Fehler: '+e.message, true); }
});
document.addEventListener('input', ev=>{
  const el = ev.target.closest('[data-na-ein]'); if(!el) return;
  const f = NA_EIN[el.getAttribute('data-na-ein')]; if(f) f(el.value, el.dataset, el, ev);
});
document.addEventListener('change', ev=>{
  const el = ev.target.closest('[data-na-wechsel]'); if(!el) return;
  const f = NA_EIN[el.getAttribute('data-na-wechsel')]; if(f) f(el.type==='checkbox' ? el.checked : el.value, el.dataset, el, ev);
});

/* ── Meldung unten ── */
let naToastZeit = null;
function toast(text, fehler){
  const t = $('toast'); if(!t) return;
  t.textContent = text; t.className = 'toast show' + (fehler ? ' err' : '');
  if(naToastZeit) clearTimeout(naToastZeit);
  naToastZeit = setTimeout(()=>{ t.className = 'toast'; }, fehler ? 4200 : 2400);
}

/* ── Blatt (eines zur Zeit) ── */
let naSheetLoeser = null;
function naSheetAuf(html){
  if(naSheetLoeser){ const l = naSheetLoeser; naSheetLoeser = null; l(null); }
  const s = $('naSheet'); s.innerHTML = '<div class="sheet-grip"></div>' + html;
  s.classList.add('show'); $('naSheetOv').classList.add('show');
  return new Promise(res=>{ naSheetLoeser = res; });
}
function naSheetZu(wert){
  $('naSheet').classList.remove('show'); $('naSheetOv').classList.remove('show');
  const l = naSheetLoeser; naSheetLoeser = null; if(l) l(wert===undefined ? null : wert);
}
function naSheetOffen(){ return $('naSheet').classList.contains('show'); }
naAkt('sheetZu', ()=>naSheetZu(null));
naAkt('sheetWert', d=>naSheetZu(d.wert));

function naFrage(text, opt){
  opt = opt || {};
  return naSheetAuf('<div class="sheet-name">'+esc(text)+'</div>'
    + (opt.mehr ? '<div class="na-info">'+opt.mehr+'</div>' : '')
    + '<div class="na-zeile" style="margin-top:12px">'
    + '<button class="btn btn-sec" data-na="sheetZu">'+esc(opt.nein||'Abbrechen')+'</button>'
    + '<button class="btn '+(opt.gefahr?'na-gefahr':'btn-pri')+'" data-na="sheetWert" data-wert="ja"'+(opt.gefahr?' style="background:var(--danger);color:#fff"':'')+'>'+esc(opt.ja||'Ja')+'</button></div>')
    .then(w=>w==='ja');
}
function naEingabe(titel, opt){
  opt = opt || {};
  const p = naSheetAuf('<div class="sheet-name">'+esc(titel)+'</div>'
    + '<div class="na-feld"><input type="'+(opt.typ||'text')+'" id="naEingabeFeld" value="'+esc(opt.wert||'')+'" placeholder="'+esc(opt.platzhalter||'')+'" autocomplete="off"></div>'
    + (opt.hilfe ? '<div class="na-dim">'+esc(opt.hilfe)+'</div>' : '')
    + '<div class="na-zeile" style="margin-top:12px"><button class="btn btn-sec" data-na="sheetZu">Abbrechen</button>'
    + '<button class="btn btn-pri" data-na="eingabeOk">'+esc(opt.ok||'Übernehmen')+'</button></div>');
  const f = $('naEingabeFeld'); setTimeout(()=>{ try{ f.focus(); f.select(); }catch(e){} }, 60);
  f.addEventListener('keydown', ev=>{ if(ev.key==='Enter'){ ev.preventDefault(); naSheetZu(f.value); } });
  return p.then(w=>w==null ? null : String(w).trim());
}
naAkt('eingabeOk', ()=>naSheetZu(($('naEingabeFeld')||{}).value || ''));

/* ── DAS Auswahlfeld ──
   opt: { titel, liste:'<key>' | items:[{id,name,sub}], gewaehlt:id|[ids],
          mehrfach, neu:true (anlegen erlaubt), wo:'wo angelegt', anlegen:(name)=>id,
          leer:'— keine —' (Auswahl „nichts" anbieten) }
   Liefert die gewählte Kennung (oder Liste) — null = abgebrochen,
   '' = bewusst „keine". */
let NA_AUSW = null;
function naAuswahlItems(){ const o = NA_AUSW.opt; return o.liste ? naListe(o.liste).map(e=>({ id:e.id, name:e.name, sub:e.sub||'', ico:e.ico||'' })) : (o.items||[]); }
function naAuswahl(opt){
  const gew = opt.mehrfach ? (opt.gewaehlt||[]).slice() : (opt.gewaehlt ? [opt.gewaehlt] : []);
  const meins = NA_AUSW = { opt, q:'', sel:new Set(gew), pruef:null };
  const darfNeu = !!opt.neu && naAdmin();
  const p = naSheetAuf('<div class="sheet-title">'+esc(opt.titel||'Auswählen')+'</div>'
    + '<input class="na-suche" id="naAuswQ" type="search" placeholder="Suchen'+(darfNeu?' oder neu anlegen':'')+' …" autocomplete="off" data-na-ein="auswSuche">'
    + '<div id="naAuswListe"></div>'
    + (opt.mehrfach ? '<div class="na-zeile" style="margin-top:10px"><button class="btn btn-sec" data-na="sheetZu">Abbrechen</button><button class="btn btn-pri" data-na="auswFertig">Übernehmen</button></div>' : ''));
  naAuswahlZeichnen();
  const q = $('naAuswQ');
  q.addEventListener('keydown', ev=>{ if(ev.key==='Enter'){ ev.preventDefault(); const erst = document.querySelector('#naAuswListe [data-na="auswWahl"]'); if(erst) erst.click(); } });
  if(naAuswahlItems().length > 6) setTimeout(()=>{ try{ q.focus(); }catch(e){} }, 80);
  return p.then(w=>{ if(NA_AUSW===meins) NA_AUSW = null; return w; });
}
function naAuswahlZeichnen(){
  if(!NA_AUSW) return;
  const o = NA_AUSW.opt; const q = NA_AUSW.q; const nq = naNorm(q);
  const alle = naAuswahlItems();
  const treffer = nq ? alle.filter(i=>naNorm(i.name+' '+(i.sub||'')).indexOf(nq)>=0) : alle;
  let h = '';
  if(NA_AUSW.pruef){
    const pr = NA_AUSW.pruef;
    if(pr.gleich){
      h += '<div class="na-warn">„'+esc(pr.name)+'" gibt es schon. Bitte den vorhandenen Eintrag nehmen:</div>';
      h += naAuswZeile(pr.gleich, true);
      h += '<button class="sheet-act" data-na="auswPruefZurueck">‹ zurück zur Liste</button>';
    } else {
      h += '<div class="na-warn">Ähnliche Einträge gibt es schon. Ist einer davon gemeint?</div>';
      pr.aehnlich.forEach(i=>{ h += naAuswZeile(i, true); });
      h += '<button class="sheet-act" data-na="auswNeuSicher"><span class="sa-ico">＋</span><span>Nein — „'+esc(pr.name)+'" wirklich neu anlegen</span></button>';
      h += '<button class="sheet-act" data-na="auswPruefZurueck">‹ zurück zur Liste</button>';
    }
    $('naAuswListe').innerHTML = h; return;
  }
  if(o.leer && !nq) h += '<button class="sheet-act" data-na="auswWahl" data-id=""><span class="sa-ico">∅</span><span>'+esc(o.leer)+'</span></button>';
  treffer.slice(0, 200).forEach(i=>{ h += naAuswZeile(i, false); });
  if(treffer.length > 200) h += '<div class="na-dim">… '+(treffer.length-200)+' weitere — bitte genauer suchen.</div>';
  if(!treffer.length && !nq) h += '<div class="na-dim" style="padding:8px 4px">Noch keine Einträge.</div>';
  if(nq && !treffer.length && !(o.neu && naAdmin())) h += '<div class="na-dim" style="padding:8px 4px">Nichts gefunden.</div>';
  if(nq && o.neu && naAdmin() && !treffer.some(i=>naNorm(i.name)===nq))
    h += '<button class="sheet-act" data-na="auswNeu"><span class="sa-ico">＋</span><span>„'+esc(q.trim())+'" neu anlegen<span class="sa-sub">'+esc(o.wo ? ('angelegt in: '+o.wo) : 'gilt danach überall')+'</span></span></button>';
  $('naAuswListe').innerHTML = h;
}
function naAuswZeile(i, direkt){
  const an = NA_AUSW.sel.has(i.id);
  const vor = NA_AUSW.opt.mehrfach && !direkt ? '<span class="chk" style="'+(an?'background:var(--ok);border-color:var(--ok);color:#06210f':'')+'">✓</span>' : '<span class="sa-ico">'+(i.ico ? esc(i.ico) : (an?'●':'○'))+'</span>';
  return '<button class="sheet-act" data-na="auswWahl" data-id="'+esc(i.id)+'">'+vor+'<span>'+esc(i.name)+(i.sub?'<span class="sa-sub">'+esc(i.sub)+'</span>':'')+'</span></button>';
}
naEin('auswSuche', v=>{ if(!NA_AUSW) return; NA_AUSW.q = v; NA_AUSW.pruef = null; naAuswahlZeichnen(); });
naAkt('auswWahl', d=>{
  if(!NA_AUSW) return;
  if(NA_AUSW.opt.mehrfach && !NA_AUSW.pruef){ if(NA_AUSW.sel.has(d.id)) NA_AUSW.sel.delete(d.id); else NA_AUSW.sel.add(d.id); naAuswahlZeichnen(); return; }
  if(NA_AUSW.opt.mehrfach){ NA_AUSW.sel.add(d.id); NA_AUSW.pruef = null; NA_AUSW.q = ''; $('naAuswQ').value = ''; naAuswahlZeichnen(); return; }
  naSheetZu(d.id);
});
naAkt('auswFertig', ()=>{ if(NA_AUSW) naSheetZu(Array.from(NA_AUSW.sel)); });
naAkt('auswPruefZurueck', ()=>{ if(!NA_AUSW) return; NA_AUSW.pruef = null; naAuswahlZeichnen(); });
naAkt('auswNeu', ()=>{
  if(!NA_AUSW) return;
  const name = NA_AUSW.q.trim(); if(!name) return;
  const tr = naAehnliche(name, naAuswahlItems());
  const gleich = tr.find(t=>t.grad==='gleich');
  if(gleich){ NA_AUSW.pruef = { name, gleich:gleich.item }; naAuswahlZeichnen(); return; }
  if(tr.length){ NA_AUSW.pruef = { name, aehnlich:tr.map(t=>t.item).slice(0,6) }; naAuswahlZeichnen(); return; }
  naAuswAnlegen(name);
});
naAkt('auswNeuSicher', ()=>{ if(NA_AUSW && NA_AUSW.pruef) naAuswAnlegen(NA_AUSW.pruef.name); });
async function naAuswAnlegen(name){
  const o = NA_AUSW.opt;
  const id = o.anlegen ? await o.anlegen(name) : naListeNeu(o.liste, name, o.wo);
  if(!id || !NA_AUSW) return;
  toast('„'+name+'" angelegt');
  if(o.mehrfach){ NA_AUSW.sel.add(id); NA_AUSW.q = ''; NA_AUSW.pruef = null; $('naAuswQ').value = ''; naAuswahlZeichnen(); return; }
  naSheetZu(id);
}

/* ── Anmeldung (Verwaltung). Komfort, keine Sicherheit (Grundsatz A9). ── */
const NA_PW_VORGABE = 'abcdefg';
const NA_SITZUNG = 3600*1000;
function naPwHash(s){ let h=5381; s=String(s); for(let i=0;i<s.length;i++){ h=(((h<<5)+h)+s.charCodeAt(i))>>>0; } return 'h'+h.toString(36); }
function naAuthHash(){
  const roh = store.get('hkl_authpw'); if(!roh) return naPwHash(NA_PW_VORGABE);
  try{ const v = JSON.parse(roh); if(typeof v==='string' && v) return v; }catch(e){}
  return roh;
}
function naAdmin(){ return Date.now() < (+(store.get('hkl_authuntil')||0)); }
function naAnmelden(pw){ if(naPwHash(pw)!==naAuthHash()) return false; store.set('hkl_authuntil', String(Date.now()+NA_SITZUNG)); return true; }
function naAbmelden(){ store.set('hkl_authuntil', '0'); }
let naAktivZuletzt = 0;
document.addEventListener('click', ()=>{ const t = Date.now(); if(t-naAktivZuletzt < 60000 || !naAdmin()) return; naAktivZuletzt = t; store.set('hkl_authuntil', String(t+NA_SITZUNG)); }, true);

/* ── Bilder: verkleinern, im Medienspeicher des Neuaufbaus ablegen ──
   Jedes Bild wird zweimal abgelegt: groß (längste Kante 1600) und als kleine
   Vorschau (320). Listen und Standards laden nur die Vorschau — ein Standard
   mit 30 Materialien kostet so einige hundert Kilobyte statt mehrerer
   Megabyte. Bearbeitet wird mit dem Foto-Editor der alten App
   (features/photoedit.js: zuschneiden, in 90°-Schritten drehen), vergrößert
   mit ihrer Großansicht (features/lightbox.js). Beide unverändert. */
function naBildUrl(k){ return '/api/media/'+encodeURIComponent(k)+'?raum='+NA_RAUM; }
/* Adresse eines Bildes: klein = Vorschau (wenn vorhanden), sonst das große. */
function naBildSrc(f, klein){ if(!f) return ''; const b = (typeof f==='string') ? { k:f } : f; return naBildUrl((klein && b.v) || b.k); }
/* art: 'kamera' (Vorgabe) · 'json'. Liefert EINE Datei oder null. */
function naDateiWaehlen(art){
  const inp = $((art===false || art==='json') ? 'naDateiJson' : 'naDatei');
  return new Promise(res=>{
    inp.value = '';
    inp.onchange = ()=>{ const f = inp.files && inp.files[0]; res(f || null); };
    inp.click();
  });
}
/* Bilder aus der Fotosammlung des Geräts (ohne Kamera-Zwang), auch mehrere. */
function naBilderWaehlen(){
  const inp = $('naDateiWahl');
  return new Promise(res=>{
    inp.value = '';
    inp.onchange = ()=>res(Array.from(inp.files || []));
    inp.click();
  });
}
function naDateiAlsDataUrl(f){ return new Promise((res, rej)=>{ const r = new FileReader(); r.onload = ()=>res(r.result); r.onerror = rej; r.readAsDataURL(f); }); }
function naDateiAlsText(f){ return new Promise((res, rej)=>{ const r = new FileReader(); r.onload = ()=>res(r.result); r.onerror = rej; r.readAsText(f); }); }
function naVerkleinern(quelle, kante, guete){
  return new Promise((res)=>{
    const im = new Image();
    im.onload = ()=>{ const k = kante||1600; const f = Math.min(1, k/Math.max(im.width, im.height));
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.width*f)); c.height = Math.max(1, Math.round(im.height*f));
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      c.toBlob(b=>res(b), 'image/jpeg', guete||0.85); };
    im.onerror = ()=>res(null);
    im.src = quelle;
  });
}
async function naBildAblegen(blob){
  const r = await fetch('/api/media?raum='+NA_RAUM, { method:'POST', headers:{ 'Content-Type':'image/jpeg' }, body: blob });
  if(!r.ok) throw new Error('Hochladen fehlgeschlagen (HTTP '+r.status+')');
  const j = await r.json(); if(!j || !j.kennung) throw new Error('Server hat keine Kennung geliefert');
  return j.kennung;
}
/* Legt ein Bild ab und liefert { k, v } (v fehlt, wenn die Vorschau nicht
   abgelegt werden konnte — dann wird überall das große Bild gezeigt). */
async function naBildHochladen(dataUrl){
  const gross = await naVerkleinern(dataUrl, 1600, 0.85);
  if(!gross) throw new Error('Bild nicht lesbar');
  const k = await naBildAblegen(gross);
  let v = '';
  try{ const klein = await naVerkleinern(dataUrl, 320, 0.8); if(klein) v = await naBildAblegen(klein); }catch(e){ v = ''; }
  return v && v!==k ? { k, v } : { k };
}
/* Foto-Editor: zuschneiden und drehen. Liefert das bearbeitete Bild als
   data-URL oder null (abgebrochen). quelle = data-URL oder Bildadresse. */
function naBildBearbeiten(quelle){
  return new Promise(res=>{
    if(typeof openPhotoEditor!=='function'){ res(quelle); return; }
    openPhotoEditor(quelle, erg=>res(erg || null));
  });
}
/* Antippen macht groß — überall dieselbe Regel: jedes <img data-zoom>.
   data-gross nennt das große Bild, wenn im Element nur die Vorschau steckt. */
document.addEventListener('click', ev=>{
  const t = ev.target; if(!t || t.tagName!=='IMG' || !t.hasAttribute('data-zoom') || typeof openLightbox!=='function') return;
  ev.preventDefault(); ev.stopPropagation();
  openLightbox(t.getAttribute('data-gross') || t.getAttribute('src'), t.getAttribute('data-cap') || '');
}, true);

/* ── Abhaken (nur dieses Gerät; es ist der Arbeitsstand im Saal) ── */
function naHaken(stdId){ return loadJSON('nalokal_haken_'+stdId, {}) || {}; }
function naHakenSetzen(stdId, h){ store.set('nalokal_haken_'+stdId, JSON.stringify(h)); }

/* ── Formate ── */
function naDatum(iso){ if(!iso) return ''; const d = new Date(iso); if(isNaN(d)) return '';
  const z = n=>String(n).padStart(2,'0'); return z(d.getDate())+'.'+z(d.getMonth()+1)+'.'+d.getFullYear()+' '+z(d.getHours())+':'+z(d.getMinutes()); }
function naEuro(n){ return (n==null || !isFinite(n)) ? '—' : n.toLocaleString('de-DE', { style:'currency', currency:'EUR' }); }
function naHerunterladen(name, inhalt, typ){
  const b = new Blob([inhalt], { type: typ||'application/octet-stream' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function naLeer(ico, titel, text){ return '<div class="empty"><div class="ei">'+ico+'</div><h3>'+esc(titel)+'</h3><p>'+(text||'')+'</p></div>'; }
