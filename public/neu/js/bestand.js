/* ─────────────────────────────────────────────────────────────
   NEUE APP — DER BESTAND ALS QUELLE (Aufbau, 18.11.2026)

   Beim Aufbau eines Standards im Neuaufbau steht rechts der Bestand: alle
   Standards der App im Labor, so wie das Labor sie HEUTE sieht. Daraus wird
   per Ziehen übernommen, was gebraucht wird. Nichts kommt von selbst.

   „So wie das Labor sie sieht" heißt: die eingelesenen Word-Standards
   (data/hkl_standards_export.json) plus alles, was die alte App darüber legt
   — im Labor angelegte Standards und Zeilen, umbenannte, ausgeblendete und
   umsortierte Rubriken und Zeilen, Regeln, Abschnitte, Notizen. Die Logik
   dafür steht hier als Nachbau der alten App (public/js/core/app-state.js,
   features/rules.js, features/additions.js, ui/detail.js). Sie ist REIN: kein
   Netz, kein Speicher, keine Seite. Dass sie dasselbe ergibt wie die alte
   App, prüft e2e/neue-app-aufbau.js an derselben Stelle im Browser.

   Nicht nachgebaut, weil es im Labor ohne Wahl nicht wirkt: Arzt-Varianten
   und Verfahrenszweige (ohne Wahl ist alles sichtbar).

   Material bleibt draußen (Entscheidung 18.11.2026): Rubriken der Art
   „material" sind gesperrt — sichtbar, aber nur ihre Hülle (Name und
   Abschnitte) lässt sich übernehmen.
   ───────────────────────────────────────────────────────────── */

/* ── Werte des Bestands ── Der Server liefert jeden Schlüssel als JSON-Text
   (so speichert ihn die alte App). */
function naBstWerte(roh){
  const w = {};
  Object.keys(roh||{}).forEach(k=>{ const v = roh[k];
    if(typeof v==='string'){ try{ w[k] = JSON.parse(v); }catch(e){ w[k] = v; } } else w[k] = v; });
  return w;
}
/* Wie zerlSlug der alten App (features/zerlegung.js): Schlüssel eines Textes. */
function naBstSlug(name){
  return String(name==null?'':name).toLowerCase()
    .replace(/[™®©◊]/g,'').replace(/[ ]/g,' ').replace(/[^\wäöüß]+/g,' ')
    .replace(/([a-zäöüß])\s+(\d)/g, '$1$2').replace(/(\d)\s+([a-zäöüß])/g, '$1$2')
    .replace(/\s+/g,' ').trim();
}
/* Auszeichnungen der alten App (**fett**, __größer__) stehen als Zeichen im
   Text. Der Neuaufbau kennt sie nicht — sie würden als Sternchen dastehen. */
function naBstOhneAuszeichnung(t){ return String(t==null?'':t).replace(/\*\*([^*\n]+)\*\*/g,'$1').replace(/__([^_\n]+)__/g,'$1').trim(); }

/* ── Der Kontext: alles, was die alte App über die eingelesenen Standards legt ── */
function naBstKontext(exp, roh){
  const w = naBstWerte(roh);
  const obj = (v)=> (v && typeof v==='object' && !Array.isArray(v)) ? v : {};
  const arr = (v)=> Array.isArray(v) ? v : [];
  const QE = obj(w.hkl_qedits); const add = obj(w.hkl_additions);
  const C = {
    QEc: obj(QE.cid), QEm: obj(QE.mat),
    overrides: obj(w.hkl_overrides), reassign: obj(w.hkl_reassign), ukMap: obj(w.hkl_ukmap), ukMeta: obj(w.hkl_ukmeta),
    UKSEC: obj(w.hkl_uksections), ENTORD: obj(w.hkl_entryorder), STDE: obj(w.hkl_stdedits), RUBE: obj(w.hkl_rubedits),
    NEW: arr(w.hkl_newentries), NEWSTD: arr(w.hkl_newstd), NEWRUB: arr(w.hkl_newrub), RUBTPL: arr(w.hkl_rubtpl),
    EIGSTD: obj(w.hkl_stdeigen), ZERL: obj(w.hkl_zerlegung), GTIN: obj(w.hkl_gtin),
    settings: Object.assign({ fliesstext:true, zerlegung:true }, obj(w.hkl_settings)),
    hints: obj(w.hkl_hints),
    ADD: { standards: arr(add.standards), entries: obj(add.entries) },
  };
  /* Regeln: aktiv ist, was nicht zurückgenommen wurde (features/rules.js). */
  const regeln = arr(w.hkl_rules); const zurueck = new Set(regeln.filter(r=>r&&r.op==='revoke'&&r.ref).map(r=>r.ref));
  C.RIDX = new Map();
  regeln.forEach(r=>{ if(!r || r.op!=='set' || zurueck.has(r.id) || !r.ziel || (r.ziel.art!=='material'&&r.ziel.art!=='text') || !r.ziel.key || !r.prop || !r.wo) return;
    const k = r.ziel.key+'|'+r.prop; if(!C.RIDX.has(k)) C.RIDX.set(k, []); C.RIDX.get(k).push(r); });
  /* Festgeschriebene Fassungen (features/fassung.js): je Standard die neueste. */
  const jeStd = new Map();
  arr(w.hkl_fassungen).forEach(f=>{ if(!f || f.verworfen) return; const a = jeStd.get(f.sid); if(!a || String(f.ts) > String(a.ts)) jeStd.set(f.sid, f); });
  C.FAS = {};
  [...jeStd.values()].forEach(f=>{ Object.keys(f.werte||{}).forEach(cid=>{ C.FAS[cid] = Object.assign({}, C.FAS[cid], f.werte[cid]); }); });
  C.DB = naBstDB(exp, C);
  C.grp = {}; C.DB.forEach(s=>{ C.grp[s.id] = naBstStdGruppe(C, s); });
  return C;
}
/* Export + Ergänzungen (mergeAdditions) + App-eigene Standards und Rubriken
   (mergeCustomIntoDB). Die Quelle wird nie verändert. */
function naBstDB(exp, C){
  const inject = std=>{ const rubs = std.rubriken||[]; let neu = false;
    const nr = rubs.map((r,ri)=>{ const extra = C.ADD.entries[std.id+'|'+ri]; if(!Array.isArray(extra) || !extra.length) return r; neu = true;
      return Object.assign({}, r, { sub_bereiche:(r.sub_bereiche||[]).concat([{ name:null, _added:true, eintraege:extra }]) }); });
    return neu ? Object.assign({}, std, { rubriken:nr }) : std; };
  let db = ((exp && exp.standards)||[]).map(inject).concat(C.ADD.standards.filter(s=>s && s.id).map(inject));
  C.NEWSTD.forEach(n=>{ if(n && n.id && !db.find(s=>s.id==='ns:'+n.id)) db.push(naBstNeuStd(n)); });
  if(C.NEWRUB.length || C.RUBTPL.length){
    db = db.map(s=>{ const grp = naBstStdGruppe(C, s); const dazu = [];
      C.NEWRUB.forEach(n=>{ if(n && n.std===s.id && !(s.rubriken||[]).find(r=>r.__nrid===n.id) && !dazu.find(r=>r.__nrid===n.id))
        dazu.push({ name:n.name, typ:n.typ||'sonstige', __nrid:n.id, sub_bereiche:[{ name:null, eintraege:[] }] }); });
      if(!s.__eigenStruktur) C.RUBTPL.forEach(t=>{ if(naBstTplPasst(t, s.id, grp) && !(s.rubriken||[]).find(r=>r.__tplid===t.id) && !dazu.find(r=>r.__tplid===t.id))
        dazu.push({ name:t.name, typ:t.typ||'sonstige', __tplid:t.id, sub_bereiche:[{ name:null, eintraege:[] }] }); });
      return dazu.length ? Object.assign({}, s, { rubriken:(s.rubriken||[]).concat(dazu) }) : s; });
  }
  return db;
}
function naBstNeuStd(n){ const eigen = Array.isArray(n.rubriken) && n.rubriken.length;
  return { id:'ns:'+n.id, titel:n.titel, gruppe:n.gruppe||'EIGENE', __new:true, __eigenStruktur:!!eigen,
    rubriken: eigen ? n.rubriken : [ { name:'Materialien', typ:'material', sub_bereiche:[{ name:null, eintraege:[] }] },
                                     { name:'Ablauf', typ:'sonstige', sub_bereiche:[{ name:null, eintraege:[] }] } ] }; }
function naBstTplPasst(t, sid, grp){ if(!t) return false; if(t.scope==='all') return true; if(t.scope==='std') return t.std===sid;
  if(t.scope==='groups') return Array.isArray(t.groups) && t.groups.indexOf(grp)>=0; return false; }
function naBstStdTitel(C, s){ return (C.STDE[s.id] && C.STDE[s.id].titel) || s.titel; }
function naBstStdGruppe(C, s){ return (C.STDE[s.id] && C.STDE[s.id].gruppe) || s.gruppe; }
function naBstCid(sid, ri, si, ei){ return sid+'|'+ri+'|'+si+'|'+ei; }
function naBstRubKey(s, r, idx){ return s.id+'|'+(r.__tplid ? ('tpl:'+r.__tplid) : (r.__nrid ? ('nr:'+r.__nrid) : idx)); }
function naBstRubIdxKey(r, idx){ return r.__nrid ? ('nr:'+r.__nrid) : idx; }
function naBstRub(C, s, r, idx){ return C.RUBE[naBstRubKey(s, r, idx)] || null; }

/* ── Die eine Kaskade der alten App (ruleCandidates) ──
   📍 Stelle > 📄 Standard > 🗂 Gruppe/Eigenschaft > 🌐 alle > 📚 Fassung;
   bei gleicher Reichweite die neuere Regel. */
function naBstTextKey(e){ const t = (e && (e.anzeige_text || e.roh_text)) || ''; if(!t) return null; const s = naBstSlug(t); return s ? ('t:'+s) : null; }
function naBstCidStd(C, cid){ if(!cid) return null;
  if(cid.indexOf('new|')===0){ const n = C.NEW.find(x=>('new|'+x.id)===cid); return n ? n.std : null; }
  const i = cid.indexOf('|'); return i>0 ? cid.slice(0, i) : null; }
function naBstAufloesen(C, e, cid, prop, alt){
  const mk = (e && e.material_key) || naBstTextKey(e); const out = [];
  const liste = mk ? C.RIDX.get(mk+'|'+prop) : null;
  if(liste){ const sid = naBstCidStd(C, cid);
    liste.forEach(r=>{ let ok = false, rang = 0; const a = r.wo.art;
      if(a==='stelle'){ ok = r.wo.wert===cid; rang = 4; }
      else if(a==='standard'){ ok = r.wo.wert===sid; rang = 3; }
      else if(a==='gruppe'){ const g = sid ? C.grp[sid] : null; ok = !!g && r.wo.wert===g; rang = 2; }
      else if(a==='eigenschaft'){ const m = sid ? C.EIGSTD[sid] : null; const v = (m && (r.wo.wert in m)) ? m[r.wo.wert] : undefined; ok = v!==undefined && v!==false; rang = 2; }
      else if(a==='alle'){ ok = true; rang = 1; }
      if(ok) out.push({ rang, ts:r.ts, id:r.id, val:r.wert }); }); }
  if(alt){ if('stelle' in alt) out.push({ rang:4, ts:'', id:'', val:alt.stelle }); if('alle' in alt) out.push({ rang:1, ts:'', id:'', val:alt.alle }); }
  const fw = C.FAS[cid]; if(fw && (prop in fw)) out.push({ rang:0, ts:'', id:'', val:fw[prop] });
  out.sort((a,b)=> (a.rang!==b.rang) ? b.rang-a.rang : (a.ts!==b.ts) ? ((a.ts<b.ts) ? 1 : -1) : ((a.id<b.id) ? 1 : -1));
  return out.length ? out[0].val : undefined;
}
function naBstQe(C, e, cid, prop){
  const alt = {}; const c = C.QEc[cid]; if(c && c[prop]!==undefined) alt.stelle = c[prop];
  const mk = e && e.material_key; const m = mk && C.QEm[mk]; if(m && m[prop]!==undefined) alt.alle = m[prop];
  return naBstAufloesen(C, e, cid, prop, alt);
}
function naBstUk(C, e, cid){
  const alt = {}; if(Object.prototype.hasOwnProperty.call(C.reassign, cid)) alt.stelle = C.reassign[cid];
  const mk = e.material_key; if(mk && C.QEm[mk] && ('uk' in C.QEm[mk])) alt.alle = C.QEm[mk].uk;
  const v = naBstAufloesen(C, e, cid, 'uk', alt); const r = (v!==undefined) ? v : e.unterkategorie;
  if(r==null || r==='') return null; return C.ukMap[r] || r;
}

/* ── Eine Zeile, wie die alte App sie zeigt (ui/detail.js, entryCardHTML) ── */
function naBstZeile(C, e, cid){
  const dn = naBstQe(C, e, cid, 'name');
  let zerl = null;
  if(C.settings.zerlegung!==false){ const tk = naBstTextKey(e); zerl = (cid && C.ZERL[cid]) || (tk && C.ZERL[tk]) || null;
    if(zerl && (typeof zerl!=='object' || !Object.keys(zerl).length)) zerl = null; }
  const zProd = (zerl && zerl.art==='produkt' && zerl.produkt && zerl.produkt.name) || null;
  const pr = e.produkt && C.GTIN[e.produkt]; const pName = pr ? (pr.name || pr.ref || null) : null;
  const name = naBstOhneAuszeichnung((dn!==undefined ? dn : (zProd || pName || e.anzeige_text)) || '');
  const mv = naBstQe(C, e, cid, 'mengeVal'); const menge = String(((mv!==undefined) ? mv : e.menge) || '').trim();
  const zus = [];
  const sv = naBstQe(C, e, cid, 'spez'); const sp = (sv!==undefined) ? (sv ? sv : null) : e.spezifikation;
  (Array.isArray(sp) ? sp : (sp ? [sp] : [])).forEach(x=>{ if(x) zus.push(String(x).trim()); });
  if(zerl){
    if(zerl.groesse) zus.push(String(zerl.groesse)); if(zerl.ziel) zus.push('→ '+zerl.ziel); if(zerl.zweck) zus.push('für '+zerl.zweck);
    if(zerl.bedingung) zus.push(String(zerl.bedingung)); if(zerl.praeparat) zus.push(String(zerl.praeparat)); if(zerl.farbe) zus.push(String(zerl.farbe));
    (Array.isArray(zerl.alternativen) ? zerl.alternativen : []).forEach(a=>{ if(a) zus.push('oder '+a); });
    if(zerl.hinweis) zus.push(String(zerl.hinweis));
  }
  if(e.zusatz_markierung && e.zusatz_markierung.fundstelle) zus.push(String(e.zusatz_markierung.fundstelle).trim());
  const zv = naBstQe(C, e, cid, 'zusatz'); const zl = (zv!==undefined && zv!==null) ? zv : e.zusatz;
  if(Array.isArray(zl)) zl.forEach(f=>{ if(f && f.n) zus.push(f.n+(f.w ? ': '+f.w : '')); });
  const roh = String(e.roh_text||'').trim();
  const wort = naBstOhneAuszeichnung(roh.replace(/^🔲\s*/, ''));
  const teile = zus.filter(Boolean);
  return { key:cid, text:name, zusatz:naBstZusatz(teile, name), teile, menge,
    wort: (wort && naNorm(wort)!==naNorm(name)) ? wort : '', kaestchen:/^🔲/.test(roh), natur:e.natur||'' };
}
/* Zusätze, die schon im Text stehen, nicht noch einmal (die alte App zeigt sie
   doppelt: „… für Analyser" und daneben das Etikett „für Analyser"). */
function naBstZusatz(teile, text){ const t = naNorm(text); const gesehen = {};
  return (teile||[]).filter(x=>{ const n = naNorm(x); if(!n || gesehen[n] || t.indexOf(n)>=0) return false; gesehen[n] = 1; return true; }).join(' · '); }

/* ── Abschnitte einer Rubrik ── */
function naBstNeuEintraege(C, s, r, idx){ const key = naBstRubIdxKey(r, idx); return C.NEW.filter(n=>n && n.std===s.id && String(n.rub)===String(key)); }
function naBstNeuEintrag(n){ return { roh_text:n.name, anzeige_text:n.name, menge:n.menge||null, natur:n.natur||'material', unterkategorie:n.uk||null,
  groessen:[], spezifikation:null, zusatz_markierung:null, material_key:null, ist_fliesstext:false, __new:true }; }
function naBstOrdKey(s, r, idx, teil){ return s.id+'|'+naBstRubIdxKey(r, idx)+'|'+(teil||''); }
function naBstOrdnen(C, liste, key){ const ord = C.ENTORD[key]; if(!Array.isArray(ord) || !ord.length) return liste;
  return liste.slice().sort((a,b)=>{ let pa = ord.indexOf(a.cid), pb = ord.indexOf(b.cid); if(pa<0) pa = 1e6+liste.indexOf(a); if(pb<0) pb = 1e6+liste.indexOf(b); return pa-pb; }); }
/* Material- und Geräte-Rubriken: gruppiert nach Unterkategorie (openRubrik). */
function naBstGruppen(C, s, r, idx){
  const m = new Map(); let erst = 0;
  const dazu = (e, cid)=>{ const uk = naBstUk(C, e, cid); const k = uk || '\u0000'; if(!m.has(k)) m.set(k, { uk, first:erst++, items:[] }); m.get(k).items.push({ e, cid }); };
  (r.sub_bereiche||[]).forEach((sb,si)=>{ (sb.eintraege||[]).forEach((e,ei)=>{
    if(e.natur==='ueberschrift') return; if(C.settings.fliesstext===false && e.ist_fliesstext) return;
    const cid = naBstCid(s.id, idx, si, ei); if(naBstQe(C, e, cid, 'hidden')===true) return; dazu(e, cid); }); });
  naBstNeuEintraege(C, s, r, idx).forEach(n=>{ const cid = 'new|'+n.id; const e = naBstNeuEintrag(n); if(naBstQe(C, e, cid, 'hidden')===true) return; dazu(e, cid); });
  (C.UKSEC[s.id+'|'+naBstRubIdxKey(r, idx)]||[]).forEach(uk=>{ if(uk && !m.has(uk)) m.set(uk, { uk, first:erst++, items:[] }); });
  const gs = [...m.values()]; gs.forEach(g=>{ g.items = naBstOrdnen(C, g.items, naBstOrdKey(s, r, idx, g.uk||'')); });
  const ord = g=> (g.uk && C.ukMeta[g.uk] && C.ukMeta[g.uk].order!=null) ? C.ukMeta[g.uk].order : g.first;
  gs.sort((a,b)=>ord(a)-ord(b));
  const ohne = gs.find(g=>!g.uk); const out = [];
  if(ohne) out.push({ teil:'uk:', name:'', items:ohne.items });
  gs.filter(g=>g.uk).forEach(g=>out.push({ teil:'uk:'+g.uk, name:g.uk, items:g.items }));
  return out;
}
/* Alle anderen Rubriken: Abschnitte aus Zwischenüberschriften (ablaufSegments). */
function naBstSegmente(C, s, r, idx){
  const bl = []; let seg = -1, cur = null; const spaeter = {};
  const start = head=>{ seg++; cur = { teil:'seg'+seg, name:head||'', items:[] }; bl.push(cur); };
  (r.sub_bereiche||[]).forEach((sb,si)=>{ if(sb.name) start(sb.name);
    (sb.eintraege||[]).forEach((e,ei)=>{ const cid = naBstCid(s.id, idx, si, ei);
      if(e.natur==='ueberschrift'){ start(e.anzeige_text || e.roh_text); return; }
      if(C.settings.fliesstext===false && e.ist_fliesstext) return;
      if(naBstQe(C, e, cid, 'hidden')===true) return;
      if(e._added && e.seg){ (spaeter[e.seg] = spaeter[e.seg] || []).push({ e, cid }); return; }
      if(!cur) start(null); cur.items.push({ e, cid }); }); });
  Object.keys(spaeter).forEach(head=>{ let b = bl.find(x=>x.name===head) || cur; if(!b){ start(null); b = cur; } spaeter[head].forEach(x=>b.items.push(x)); });
  const neue = naBstNeuEintraege(C, s, r, idx);
  if(neue.length){ const nb = { teil:'segnew', name:'', items:[] };
    neue.forEach(n=>{ const cid = 'new|'+n.id; const e = naBstNeuEintrag(n); if(naBstQe(C, e, cid, 'hidden')===true) return; nb.items.push({ e, cid }); });
    if(nb.items.length) bl.push(nb); }
  bl.forEach(b=>{ b.items = naBstOrdnen(C, b.items, naBstOrdKey(s, r, idx, b.teil)); });
  return bl;
}
function naBstNotizen(liste, prefix){ return (Array.isArray(liste) ? liste : []).filter(n=>n && String(n.text||'').trim())
  .map(n=>({ key:'notiz|'+prefix+'|'+(n.id||''), text:String(n.text).trim(), notiz:true })); }

/* ── Der Bestand, aufbereitet ──
   → [{ id, titel, gruppe, eigen, notizen[], rubriken:[{ key, name, typ, material,
        notizen[], abschnitte:[{ key, name, zeilen:[{ key, text, zusatz, menge,
        wort, kaestchen, natur }] }] }] }] */
function naBestandAufbereiten(exp, roh){
  const C = naBstKontext(exp, roh); const out = [];
  C.DB.forEach(s=>{
    if(!s || !s.id || (C.STDE[s.id] && C.STDE[s.id].hidden)) return;
    const sicht = (s.rubriken||[]).map((r,i)=>({ r, i })).filter(x=>{ const e = naBstRub(C, s, x.r, x.i); return !(e && e.hidden); })
      .sort((a,b)=>{ const ea = naBstRub(C, s, a.r, a.i), eb = naBstRub(C, s, b.r, b.i);
        return ((ea && ea.ord!=null) ? ea.ord : a.i) - ((eb && eb.ord!=null) ? eb.ord : b.i); });
    const rubriken = sicht.map(({ r, i })=>{
      const rk = s.id+'|'+naBstRubIdxKey(r, i); const e = naBstRub(C, s, r, i);
      const teile = (r.typ==='material' || r.typ==='geraete') ? naBstGruppen(C, s, r, i) : naBstSegmente(C, s, r, i);
      return { key:rk, name:(e && e.name) || r.name || '', typ:r.typ||'sonstige', material:r.typ==='material',
        notizen: naBstNotizen(C.hints.rub && C.hints.rub[s.id+'|'+i], s.id+'|'+i),
        abschnitte: teile.map(t=>({ key:rk+'|'+t.teil, name:t.name, zeilen:t.items.map(x=>naBstZeile(C, x.e, x.cid)).filter(z=>z.text) })) };
    });
    out.push({ id:s.id, titel:naBstStdTitel(C, s)||'', gruppe:naBstStdGruppe(C, s)||'', eigen:!!(s._added || s.__new),
      notizen: naBstNotizen(C.hints.std && C.hints.std[s.id], s.id), rubriken });
  });
  return out;
}

/* ── Suchen ── Gleiche Formulierungen werden zusammengefasst: „Druckableitung
   vorbereiten" steht dann einmal da, mit allen Fundstellen. Material-Rubriken
   sind nicht durchsucht — ihre Zeilen kommen ohnehin nicht mit. */
function naBstIndex(stds){
  const z = [];
  (stds||[]).forEach(s=>{
    s.notizen.forEach(n=>z.push({ art:'notiz', std:s, rub:null, abs:null, zeile:n, such:naNorm(n.text) }));
    s.rubriken.forEach(r=>{ if(r.material) return;
      r.notizen.forEach(n=>z.push({ art:'notiz', std:s, rub:r, abs:null, zeile:n, such:naNorm(n.text) }));
      r.abschnitte.forEach(a=>a.zeilen.forEach(l=>z.push({ art:'zeile', std:s, rub:r, abs:a, zeile:l, such:naNorm([l.text, l.wort, l.zusatz].join(' ')) }))); }); });
  return z;
}
function naBstPasst(s, r, f){ return (!f.gruppe || s.gruppe===f.gruppe) && (!f.rubrik || (r && naNorm(r.name)===naNorm(f.rubrik))); }
function naBstSuchen(stds, index, q, filter){
  const w = naNorm(q).split(' ').filter(Boolean); if(!w.length) return null;
  const f = filter || {}; const alle = t=>w.every(x=>t.indexOf(x)>=0);
  const gr = new Map();
  (index||[]).forEach(it=>{ if(!naBstPasst(it.std, it.rub, f) || !alle(it.such)) return;
    const k = naNorm(it.zeile.text); if(!gr.has(k)) gr.set(k, []); gr.get(k).push(it); });
  const formulierungen = [...gr.entries()].map(([k, st])=>{ const zahl = {}; st.forEach(x=>{ zahl[x.zeile.text] = (zahl[x.zeile.text]||0)+1; });
    const text = Object.keys(zahl).sort((a,b)=>zahl[b]-zahl[a] || a.localeCompare(b, 'de'))[0];
    return { key:k, text, stellen:st, nStd:new Set(st.map(x=>x.std.id)).size }; })
    .sort((a,b)=>b.nStd-a.nStd || b.stellen.length-a.stellen.length || a.text.localeCompare(b.text, 'de', { sensitivity:'base' }));
  const nachName = ()=>new Map(); const abs = nachName(), rubs = nachName(); const standards = [];
  const merk = (m, name, x)=>{ const k = naNorm(name); if(!m.has(k)) m.set(k, { name, stellen:[] }); m.get(k).stellen.push(x); };
  (stds||[]).forEach(s=>{ if(f.gruppe && s.gruppe!==f.gruppe) return;
    if(alle(naNorm(s.titel+' '+s.gruppe))) standards.push(s);
    s.rubriken.forEach(r=>{ if(f.rubrik && naNorm(r.name)!==naNorm(f.rubrik)) return;
      if(r.name && alle(naNorm(r.name))) merk(rubs, r.name, { std:s, rub:r });
      r.abschnitte.forEach(a=>{ if(a.name && alle(naNorm(a.name))) merk(abs, a.name, { std:s, rub:r, abs:a }); }); }); });
  const sortiert = m=>[...m.values()].sort((a,b)=>b.stellen.length-a.stellen.length || a.name.localeCompare(b.name, 'de', { sensitivity:'base' }));
  return { formulierungen, abschnitte:sortiert(abs), rubriken:sortiert(rubs), standards,
    treffer:formulierungen.reduce((n,x)=>n+x.stellen.length, 0) };
}

/* ── Übernehmen: aus einem Stück Bestand wird ein Stück Neuaufbau ──
   Jede Zeile merkt sich ihre Herkunft (Standard, Stelle, Wortlaut) — daran
   zeigt die rechte Seite ✓ „schon übernommen". Danach ist sie eine
   eigenständige Kopie: Was später im Bestand geändert wird, ändert sie nicht. */
function naBstArt(l){ return l && l.kaestchen ? 'schritt' : 'hinweis'; }
function naBstHerkunft(std, key, text){ return { q:'bestand', std:std.id, titel:std.titel, z:key, t:text }; }
function naBstPosition(std, l, anderer){
  const text = anderer || l.text;
  const p = { id:naId('p'), art:l.notiz ? 'hinweis' : naBstArt(l), text, herkunft:naBstHerkunft(std, l.key, l.text) };
  const zusatz = anderer ? naBstZusatz(l.teile, text) : l.zusatz;
  if(l.menge) p.menge = l.menge; if(zusatz) p.zusatz = zusatz; return p;
}
function naBstAbschnittNeu(std, rub, a){
  return { id:naId('a'), name:a.name||'', positionen: rub.material ? [] : a.zeilen.map(l=>naBstPosition(std, l)), herkunft:naBstHerkunft(std, a.key, a.name||'') };
}
function naBstRubrikNeu(std, rub){
  let ab = rub.abschnitte.map(a=>naBstAbschnittNeu(std, rub, a));
  if(rub.material) ab = ab.filter(a=>a.name);   /* nur die Hülle: benannte Abschnitte, keine Zeilen */
  if(!rub.material && rub.notizen.length){ if(!ab.length) ab.push({ id:naId('a'), name:'', positionen:[] });
    ab[0].positionen = rub.notizen.map(n=>naBstPosition(std, n)).concat(ab[0].positionen); }
  if(!ab.length) ab.push({ id:naId('a'), name:'', positionen:[] });
  return { id:naId('r'), name:rub.name||'', abschnitte:ab, herkunft:naBstHerkunft(std, rub.key, rub.name||'') };
}
/* Ein Stück in einen Standard des Neuaufbaus einfügen. Verändert `s`.
   teil:  { art:'positionen', liste, rubName?, absName? } · { art:'abschnitt', abschnitt, rubName? } · { art:'rubrik', rubrik }
   ziel:  { art:'pos', a, i } vor Position i im Abschnitt a · { art:'posende', a } · { art:'rubende', r }
          { art:'abs', r, i } als i-ter Abschnitt der Rubrik r · { art:'absende', r }
          { art:'rub', i } als i-te Rubrik · { art:'neu' } als neue Rubrik ans Ende
   → true, wenn eingefügt. */
function naStdEinfuegen(s, ziel, teil){
  if(!s || !ziel || !teil) return false; s.rubriken = s.rubriken || [];
  const rub = id=>s.rubriken.find(r=>r.id===id);
  const abs = id=>{ for(const r of s.rubriken) for(const a of (r.abschnitte||[])) if(a.id===id) return a; return null; };
  const neueRubrik = ab=>({ id:naId('r'), name:teil.rubName||'', abschnitte:ab });
  const grenze = (i, n)=>Math.max(0, Math.min(n, (i==null || isNaN(+i)) ? n : +i));
  if(teil.art==='positionen'){
    const l = teil.liste||[]; if(!l.length) return false;
    if(ziel.art==='pos' || ziel.art==='posende'){ const a = abs(ziel.a); if(!a) return false; a.positionen = a.positionen||[];
      a.positionen.splice(ziel.art==='pos' ? grenze(ziel.i, a.positionen.length) : a.positionen.length, 0, ...l); return true; }
    if(ziel.art==='rubende'){ const r = rub(ziel.r); if(!r) return false; r.abschnitte = r.abschnitte||[];
      if(!r.abschnitte.length) r.abschnitte.push({ id:naId('a'), name:'', positionen:[] });
      const a = r.abschnitte[r.abschnitte.length-1]; a.positionen = (a.positionen||[]).concat(l); return true; }
    if(ziel.art==='neu'){ s.rubriken.push(neueRubrik([{ id:naId('a'), name:teil.absName||'', positionen:l }])); return true; }
    return false;
  }
  if(teil.art==='abschnitt'){
    if(ziel.art==='abs' || ziel.art==='absende'){ const r = rub(ziel.r); if(!r) return false; r.abschnitte = r.abschnitte||[];
      /* Ein leerer, namenloser Abschnitt ist nur Platzhalter — er weicht. */
      const nurPlatz = r.abschnitte.length===1 && !r.abschnitte[0].name && !(r.abschnitte[0].positionen||[]).length;
      if(nurPlatz) r.abschnitte = [teil.abschnitt];
      else r.abschnitte.splice(ziel.art==='abs' ? grenze(ziel.i, r.abschnitte.length) : r.abschnitte.length, 0, teil.abschnitt);
      return true; }
    if(ziel.art==='neu'){ s.rubriken.push(neueRubrik([teil.abschnitt])); return true; }
    return false;
  }
  if(teil.art==='rubrik'){
    if(ziel.art==='rub'){ s.rubriken.splice(grenze(ziel.i, s.rubriken.length), 0, teil.rubrik); return true; }
    if(ziel.art==='neu'){ s.rubriken.push(teil.rubrik); return true; }
    return false;
  }
  return false;
}

/* ── Was ist schon übernommen? ── je Stelle (z) und je Wortlaut (t),
   getrennt nach „in diesem Standard" und „in anderen neuen Standards". */
function naBstBenutzt(standards, aktuellId){
  const hier = { z:new Set(), t:new Set() }, anders = { z:new Map(), t:new Map() };
  const zaehl = (m, k)=>{ if(k) m.set(k, (m.get(k)||0)+1); };
  (standards||[]).forEach(s=>{ if(!s) return; const da = s.id===aktuellId;
    (s.rubriken||[]).forEach(r=>(r.abschnitte||[]).forEach(a=>(a.positionen||[]).forEach(p=>{ const h = p && p.herkunft; if(!h || h.q!=='bestand') return;
      const t = naNorm(h.t||'');
      if(da){ if(h.z) hier.z.add(h.z); if(t) hier.t.add(t); }
      else { zaehl(anders.z, h.z); zaehl(anders.t, t); } }))); });
  return { hier, anders };
}
/* Für eine Zeile: 'hier' · Zahl der anderen neuen Standards · null */
function naBstMarke(b, l){ if(!b || !l) return { hier:false, anders:0 }; const t = naNorm(l.text);
  return { hier: b.hier.z.has(l.key) || b.hier.t.has(t), anders: Math.max(b.anders.z.get(l.key)||0, b.anders.t.get(t)||0) }; }
