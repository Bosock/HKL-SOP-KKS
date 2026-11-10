/* ─────────────────────────────────────────────────────────────
   NEUE APP — DATEN (Arbeitsspeicher über dem Abgleich)

   NA hält alle Objekte der neuen App, nach Art getrennt. Geschrieben wird
   ausschließlich über naSpeichern / naLoeschen / naListeSpeichern — dort
   entstehen auch Verlauf und Papierkorb. Kein anderer Baustein schreibt.
   ───────────────────────────────────────────────────────────── */
const NA_TYPEN = {
  material:   { p:'na_m_',  wort:'Material',   mehr:'Material',    ico:'📦' },
  geraet:     { p:'na_g_',  wort:'Gerät',      mehr:'Geräte',      ico:'🖥' },
  medikament: { p:'na_d_',  wort:'Medikament', mehr:'Medikamente', ico:'💊' },
  standard:   { p:'na_s_',  wort:'Standard',   mehr:'Standards',   ico:'📋' },
  baustein:   { p:'na_b_',  wort:'Baustein',   mehr:'Bausteine',   ico:'🧩' },
  meldung:    { p:'na_ml_', wort:'Meldung',    mehr:'Meldungen',   ico:'📣' },
  papierkorb: { p:'na_pk_', wort:'Papierkorb', mehr:'Papierkorb',  ico:'🗑' },
  verlauf:    { p:'na_vl_', wort:'Verlauf',    mehr:'Verlauf',     ico:'🕘' },
  liste:      { p:'na_l_',  wort:'Liste',      mehr:'Listen',      ico:'🗂' },
};
/* Längere Präfixe zuerst (na_ml_ vor na_m_). */
const NA_PRAEFIXE = Object.keys(NA_TYPEN).map(t=>({ t, p:NA_TYPEN[t].p })).sort((a,b)=>b.p.length-a.p.length);
const NA = {}; Object.keys(NA_TYPEN).forEach(t=>{ NA[t] = {}; });
const NA_STAMMTYPEN = ['material','geraet','medikament'];

function naTypVon(k){ const x = NA_PRAEFIXE.find(x=>k.indexOf(x.p)===0); return x ? x.t : null; }
function naSchluesselLaden(k){
  const t = naTypVon(k); if(!t) return null;
  const id = k.slice(NA_TYPEN[t].p.length); const v = naAbgleich.lesen(k);
  if(v==null) delete NA[t][id]; else NA[t][id] = v;
  return t;
}
function naAllesLaden(){ naAbgleich.schluessel().forEach(naSchluesselLaden); }

function naTitel(o){ return o ? (o.titel || o.name || o.text || '') : ''; }
function naAlle(typ, mitArchiv){
  return Object.keys(NA[typ]).map(id=>NA[typ][id]).filter(o=>o && (mitArchiv || !o.archiviert))
    .sort((a,b)=>naTitel(a).localeCompare(naTitel(b), 'de', { sensitivity:'base' }));
}
function naHole(typ, id){ return (NA[typ] && id) ? (NA[typ][id] || null) : null; }
function naStamm(ref){ return ref ? naHole(ref.typ, ref.id) : null; }
function naStandards(){ return naAlle('standard', true); }

/* ── Gerät (nur für Verlauf und Papierkorb: „wo wurde es geändert") ── */
function naGeraet(){
  let g = loadJSON('nalokal_geraet', null);
  if(!g || !g.id){ g = { id: naId('d'), name: '' }; store.set('nalokal_geraet', JSON.stringify(g)); }
  return g;
}
function naGeraetName(){ const g = naGeraet(); return g.name || ('Gerät '+g.id.slice(-4)); }

/* ── Verlauf: je Monat und Gerät ein Schlüssel (kein Gerät überschreibt
   den Verlauf eines anderen). Höchstens 500 Einträge je Schlüssel. ── */
function naVerlauf(e){
  const g = naGeraet(); const monat = naJetzt().slice(0,7);
  const k = monat+'_'+g.id;
  const liste = (NA.verlauf[k] || []).concat([Object.assign({ t:naJetzt(), wer:naGeraetName() }, e)]).slice(-500);
  NA.verlauf[k] = liste; naAbgleich.schreiben(NA_TYPEN.verlauf.p+k, liste);
}
function naVerlaufAlle(){
  const out = []; Object.keys(NA.verlauf).forEach(k=>(NA.verlauf[k]||[]).forEach(e=>out.push(e)));
  return out.sort((a,b)=>String(b.t).localeCompare(String(a.t)));
}

/* ── Speichern / Löschen ── */
function naSpeichern(typ, obj, was){
  const alt = NA[typ][obj.id] || null;
  const jetzt = naJetzt();
  obj.geaendert = jetzt; if(!obj.angelegt){ obj.angelegt = jetzt; obj.angelegtAuf = naGeraetName(); }
  NA[typ][obj.id] = obj;
  naAbgleich.schreiben(NA_TYPEN[typ].p+obj.id, obj);
  if(typ!=='meldung' || !alt) naVerlauf({ typ, id:obj.id, titel:naTitel(obj), was: was || (alt ? 'geändert' : 'angelegt'), felder: alt ? naUnterschiede(alt, obj) : [] });
  return obj;
}
/* Löschen heißt: in den Papierkorb. Endgültig erst dort. */
function naLoeschen(typ, id){
  const o = NA[typ][id]; if(!o) return null;
  const pk = { id: naId('pk'), typ, daten: o, geloescht: naJetzt(), von: naGeraetName() };
  NA.papierkorb[pk.id] = pk; naAbgleich.schreiben(NA_TYPEN.papierkorb.p+pk.id, pk);
  delete NA[typ][id]; naAbgleich.schreiben(NA_TYPEN[typ].p+id, null);
  naVerlauf({ typ, id, titel:naTitel(o), was:'in den Papierkorb' });
  return pk;
}
function naWiederherstellen(pkId){
  const pk = NA.papierkorb[pkId]; if(!pk) return null;
  const o = pk.daten;
  if(NA[pk.typ][o.id]) o.id = naId(pk.typ[0]);   /* Kennung inzwischen belegt → neue */
  NA[pk.typ][o.id] = o; naAbgleich.schreiben(NA_TYPEN[pk.typ].p+o.id, o);
  delete NA.papierkorb[pkId]; naAbgleich.schreiben(NA_TYPEN.papierkorb.p+pkId, null);
  naVerlauf({ typ:pk.typ, id:o.id, titel:naTitel(o), was:'wiederhergestellt' });
  return o;
}
function naEndgueltig(pkId){
  const pk = NA.papierkorb[pkId]; if(!pk) return;
  delete NA.papierkorb[pkId]; naAbgleich.schreiben(NA_TYPEN.papierkorb.p+pkId, null);
  naVerlauf({ typ:pk.typ, id:pk.daten.id, titel:naTitel(pk.daten), was:'endgültig gelöscht' });
}
/* Was der Papierkorb über eine Kennung weiß (für Positionen, deren Stammsatz
   gelöscht wurde: „im Papierkorb" statt „?"). */
function naImPapierkorb(typ, id){
  return Object.keys(NA.papierkorb).map(k=>NA.papierkorb[k]).find(p=>p && p.typ===typ && p.daten && p.daten.id===id) || null;
}

/* ── Listen (ein Verzeichnis für alle erweiterbaren Auswahllisten) ──
   Solange eine Liste nie geändert wurde, gilt ihre Vorgabe — sie wird erst
   beim ersten Ändern gespeichert (kein Gerät überschreibt so die Vorgabe
   eines anderen). Kategorien sind besonders: Sie kommen aus dem Merkmals-
   katalog (data/merkmale.json) plus dem Overlay des Hauses. */
let NA_MERKQUELLE = null;
function naListeVorgabe(key){
  if(key==='arten') return NA_ARTEN_VORGABE.map(a=>Object.assign({ vorgabe:true }, a));
  if(key==='bereiche') return NA_BEREICHE_VORGABE.map(b=>Object.assign({ vorgabe:true }, b));
  if(key==='rubriken') return NA_RUBRIKEN_VORGABE.map((n,i)=>({ id:'r'+i, name:n, vorgabe:true }));
  return [];
}
function naKatTpl(){ const l = NA.liste.kategorien; return (l && l.tpl) || { klassen:{}, merkmale:{}, werte:{} }; }
/* Der Katalog wird oft gebraucht (jede Zeile im Verzeichnis) — nur neu bauen,
   wenn sich Quelle oder Overlay geändert haben. */
let naKatMerk = null;
function naKat(){
  const l = NA.liste.kategorien; const g = l ? l.geaendert : '';
  if(naKatMerk && naKatMerk.q===NA_MERKQUELLE && naKatMerk.l===l && naKatMerk.g===g) return naKatMerk.k;
  const k = naKatalog(NA_MERKQUELLE, naKatTpl()); naKatMerk = { q:NA_MERKQUELLE, l, g, k }; return k;
}
function naListe(key, mitArchiv){
  let e;
  if(key==='kategorien'){
    e = naKat().klassen.map(k=>({ id:k.id, name:k.label, archiviert:!!k.archiviert, angelegt:k.angelegt||null, wo:k.wo||'', vorgabe:!k.eigen }));
  } else {
    const l = NA.liste[key];
    e = (l && Array.isArray(l.eintraege)) ? l.eintraege : naListeVorgabe(key);
  }
  return mitArchiv ? e : e.filter(x=>!x.archiviert);
}
function naListeEintrag(key, id){ return naListe(key, true).find(x=>x.id===id) || null; }
function naListeName(key, id){ const e = naListeEintrag(key, id); return e ? e.name : ''; }
function naListeSpeichern(key, eintraege, was){
  const l = Object.assign({}, NA.liste[key] || {}, { eintraege, geaendert:naJetzt() });
  NA.liste[key] = l; naAbgleich.schreiben(NA_TYPEN.liste.p+key, l);
  if(was) naVerlauf({ typ:'liste', id:key, titel:naListeWort(key), was });
}
function naListeWort(key){ const x = NA_LISTEN.find(l=>l.key===key); return x ? x.wort : key; }
function naKatTplSpeichern(tpl, was){
  const l = Object.assign({}, NA.liste.kategorien || {}, { tpl, geaendert:naJetzt() });
  NA.liste.kategorien = l; naAbgleich.schreiben(NA_TYPEN.liste.p+'kategorien', l);
  if(was) naVerlauf({ typ:'liste', id:'kategorien', titel:naListeWort('kategorien'), was });
}
/* Neuer Eintrag an Ort und Stelle. `wo` = wo er angelegt wurde. */
function naListeNeu(key, name, wo, extra){
  name = String(name||'').trim(); if(!name) return null;
  if(key==='kategorien'){
    const tpl = JSON.parse(JSON.stringify(naKatTpl()));
    const id = 'k_'+naNorm(name).replace(/\s+/g,'_').slice(0,24)+'_'+naId('').slice(-4);
    tpl.klassen = tpl.klassen || {};
    tpl.klassen[id] = { neu:true, label:name, diff:[], angelegt:naJetzt(), wo:wo||'' };
    naKatTplSpeichern(tpl, 'Kategorie „'+name+'" angelegt');
    return id;
  }
  const e = Object.assign({ id: naId(key.slice(0,2)), name, angelegt:naJetzt(), wo:wo||'', von:naGeraetName() }, extra||{});
  naListeSpeichern(key, naListe(key, true).concat([e]), '„'+name+'" angelegt');
  return e.id;
}
function naListeUmbenennen(key, id, name){
  name = String(name||'').trim(); if(!name) return;
  if(key==='kategorien'){
    const tpl = JSON.parse(JSON.stringify(naKatTpl())); tpl.klassen = tpl.klassen || {};
    tpl.klassen[id] = Object.assign({}, tpl.klassen[id] || {}, { label:name });
    naKatTplSpeichern(tpl, 'Kategorie umbenannt in „'+name+'"'); return;
  }
  /* Namensbasierte Listen (Rubriken, Abschnitte): auch in den Standards umbenennen. */
  const alt = naListeName(key, id);
  naListeSpeichern(key, naListe(key, true).map(x=>x.id===id ? Object.assign({}, x, { name }) : x), '„'+alt+'" → „'+name+'"');
  if(key==='rubriken' || key==='abschnitte') naStandards().forEach(s=>{ let n=0;
    (s.rubriken||[]).forEach(r=>{ if(key==='rubriken' && r.name===alt){ r.name=name; n++; }
      (r.abschnitte||[]).forEach(a=>{ if(key==='abschnitte' && a.name===alt){ a.name=name; n++; } }); });
    if(n) naSpeichern('standard', s, 'Name „'+alt+'" → „'+name+'"'); });
}
function naListeArchivieren(key, id, an){
  if(key==='kategorien'){
    const tpl = JSON.parse(JSON.stringify(naKatTpl())); tpl.klassen = tpl.klassen || {};
    tpl.klassen[id] = Object.assign({}, tpl.klassen[id] || {}, { archiviert: !!an });
    naKatTplSpeichern(tpl, an ? 'Kategorie archiviert' : 'Kategorie zurückgeholt'); return;
  }
  naListeSpeichern(key, naListe(key, true).map(x=>x.id===id ? Object.assign({}, x, { archiviert: !!an }) : x), (an?'archiviert: ':'zurückgeholt: ')+naListeName(key, id));
}
/* Zusammenführen: alle Verwendungen von `von` zeigen danach auf `nach`, `von`
   wird archiviert. Nur für Listen mit festen Kennungen. */
const NA_LISTE_FELD = { bereiche:'bereich', hersteller:'hersteller', lagerorte:'lagerort', darreichung:'darreichung', geraetekategorien:'kategorie', kategorien:'kategorie' };
function naListeZusammenfuehren(key, von, nach){
  if(!von || !nach || von===nach) return 0;
  let n = 0;
  const umhaengen = (typ, feld)=>naAlle(typ, true).forEach(o=>{ if(o[feld]===von){ o[feld]=nach; n++; naSpeichern(typ, o, 'zusammengeführt ('+naListeWort(key)+')'); } });
  if(key==='arten' || key==='bereiche'){
    naStandards().concat(naAlle('baustein', true)).forEach(s=>{ let m=0;
      naPositionenAlle(s).forEach(p=>{ const f = key==='arten' ? 'art' : 'bereich'; if(p[f]===von){ p[f]=nach; m++; } });
      if(m){ n+=m; naSpeichern(s.rubriken ? 'standard' : 'baustein', s, 'zusammengeführt ('+naListeWort(key)+')'); } });
  }
  if(key==='bereiche') NA_STAMMTYPEN.forEach(t=>umhaengen(t, 'bereich'));
  if(key==='hersteller'){ umhaengen('material','hersteller'); umhaengen('geraet','hersteller'); }
  if(key==='lagerorte') NA_STAMMTYPEN.forEach(t=>umhaengen(t, 'lagerort'));
  if(key==='darreichung') umhaengen('medikament','darreichung');
  if(key==='geraetekategorien') umhaengen('geraet','kategorie');
  if(key==='kategorien') umhaengen('material','kategorie');
  if(key==='gruppen') naStandards().forEach(s=>{ if(s.gruppe===von){ s.gruppe=nach; n++; naSpeichern('standard', s, 'Gruppe zusammengeführt'); } });
  if(key==='kennzeichen') naStandards().forEach(s=>{ const k=s.kennzeichen||[]; if(k.indexOf(von)>=0){ s.kennzeichen=k.filter(x=>x!==von).concat(k.indexOf(nach)<0?[nach]:[]); n++; naSpeichern('standard', s, 'Kennzeichen zusammengeführt'); } });
  naListeArchivieren(key, von, true);
  return n;
}
/* Positionen eines Standards ODER eines Bausteins (flach). */
function naPositionenAlle(o){
  if(!o) return [];
  if(o.rubriken) return naPositionen(o).map(x=>x.pos);
  return (o.positionen || []).slice();
}
function naVerwendungDaten(){
  return { standards: naStandards().concat(naAlle('baustein', true).map(b=>({ id:b.id, rubriken:[{ abschnitte:[{ positionen:b.positionen||[] }] }] }))),
    material: naAlle('material', true), geraete: naAlle('geraet', true), medikamente: naAlle('medikament', true) };
}

/* ── Lagerort: eine Liste statt Freitext (sonst stehen „Inari Wagen" und
   „Inari-Wagen" nebeneinander). Ältere Einträge mit freiem Text bleiben
   lesbar. ── */
function naLagerortName(o){ if(!o || !o.lagerort) return ''; return naListeName('lagerorte', o.lagerort) || String(o.lagerort); }
/* Stammsatz, wie ihn die Rüstliste braucht: Lagerort als Wort. */
function naStammFuerListe(ref){ const o = naStamm(ref); return o ? Object.assign({}, o, { lagerort: naLagerortName(o) }) : null; }

/* ── Hersteller aus dem Register ──
   Die Identität hängt an der EU-Registriernummer (SRN), nicht an der
   Schreibweise. Gesucht wird erst nach der SRN, dann nach dem Namen (amtlich
   oder kurz); ein vorhandener Eintrag bekommt SRN und amtlichen Namen
   nachgetragen. Erst wenn nichts passt, entsteht ein neuer Eintrag — mit
   Kurznamen fürs Haus. Liefert die Kennung. */
function naHerstellerAusRegister(h){
  if(!h || !h.name) return '';
  const liste = naListe('hersteller', true);
  const kurz = naHerstellerKurz(h.name);
  let e = h.srn ? liste.find(x=>x.srn && x.srn===h.srn) : null;
  if(!e){ const n = [naNorm(h.name), naNorm(kurz)];
    e = liste.find(x=>!x.archiviert && (n.indexOf(naNorm(x.name))>=0 || (x.amtlich && n.indexOf(naNorm(x.amtlich))>=0))); }
  if(e){
    if((h.srn && !e.srn) || !e.amtlich){
      naListeSpeichern('hersteller', liste.map(x=>x.id===e.id ? Object.assign({}, x, { amtlich: x.amtlich || h.name }, (h.srn && !x.srn) ? { srn:h.srn } : {}) : x), 'Hersteller „'+e.name+'" mit dem Register abgeglichen');
    }
    return e.id;
  }
  return naListeNeu('hersteller', kurz || h.name, 'Register', Object.assign({ amtlich:h.name }, h.srn ? { srn:h.srn } : {}));
}

/* ── Einstellungen des Hauses (für alle Geräte) ── */
function naEinstellung(key, vorgabe){ const l = NA.liste.einstellungen; const w = l && l.werte; return (w && key in w) ? w[key] : vorgabe; }
function naEinstellungSetzen(key, wert){
  const l = Object.assign({}, NA.liste.einstellungen || {}); l.werte = Object.assign({}, l.werte || {}); l.werte[key] = wert; l.geaendert = naJetzt();
  NA.liste.einstellungen = l; naAbgleich.schreiben(NA_TYPEN.liste.p+'einstellungen', l);
}

/* ── Art einer Position ── */
function naArt(id){ return naListeEintrag('arten', id) || { id, name:id||'Zeile', ico:'•', farbe:'#7f95ab', verweis:'', haken:true }; }
/* Anzeigetext einer Position: Stammsatz-Name oder eigener Text. */
function naPosText(p){
  if(p.ref){ const s = naStamm(p.ref); if(s) return s.name || '(ohne Namen)';
    const pk = naImPapierkorb(p.ref.typ, p.ref.id); return pk ? ('⚠ '+(pk.daten.name||'')+' (im Papierkorb)') : '⚠ Eintrag fehlt'; }
  return p.text || '';
}
