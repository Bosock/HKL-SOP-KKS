/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — PRODUKT ERFASSEN (Neuaufbau)

   Im Neuaufbau beginnt das Material bei null. Jedes Produkt wird so erfasst,
   wie es auf dem Tisch liegt: Barcode scannen, Etikett fotografieren, Produkt
   fotografieren, Name und Synonyme. Daraus entsteht ein Stammsatz, der
   später drei Dinge tragen soll: die Standards (jede Zeile zeigt auf ein
   Produkt, nicht auf ein Wort), eine Kostenschätzung und irgendwann die
   Anbindung an die Materialwirtschaft (SAP).

   Die Schlüssel:
     · GTIN der EINHEIT ist der Hauptschlüssel. Eine Einheit ist das, was im
       Saal einzeln verbraucht wird — der Katheter in seiner Sterilverpackung,
       nicht der Zehnerkarton. Der Karton hat eine EIGENE GTIN; sie wird als
       VERPACKUNGSSTUFE mit Stückzahl an die Einheit gehängt. Wer den Karton
       scannt, landet trotzdem beim richtigen Produkt.
     · REF (Bestellnummer des Herstellers) ist der Zweitschlüssel. Sie muss
       eindeutig sein; dieselbe REF an zwei Produkten ist fast immer ein
       Versehen (oder dieselbe Ware in zwei Verpackungsstufen) und wird
       gemeldet, bevor gespeichert wird.
     · Bilder heißen NICHT wie die GTIN. Ein Bild hängt am Stammsatz und
       trägt eine ROLLE (Etikett, Produkt, Verpackung). Erst beim Export
       bekommt es einen sprechenden Dateinamen: GTIN_REF_rolle.jpg — dann,
       wenn ihn jemand außerhalb der App braucht.

   Der Export (Tabelle für Excel, wahlweise mit Bildern als ZIP) ist die
   Brücke nach draußen: GTIN entspricht dem EAN-Feld eines SAP-Materials, die
   REF der Herstellerteilenummer.

   Alles hier gehört zu den NEUERUNGEN des Neuaufbaus (features/raum.js,
   neuFrei): Im Bestand erscheint davon nichts, bis es dort ausdrücklich
   freigegeben wird.
   ───────────────────────────────────────────────────────────── */

/* ═══════════ 1. Reine Helfer ═══════════ */

/* Die Rollen eines Bildes. Der Code kennt nur die Schlüssel (Grundsatz ④);
   die Wörter sind Vorgaben und lassen sich über die Bezeichnungen ändern
   (Zweig „fotorollen"). */
const FOTO_ROLLEN = [
  { key:'etikett',    vorgabe:'Etikett',    ico:'🏷' },
  { key:'produkt',    vorgabe:'Produkt',    ico:'📦' },
  { key:'verpackung', vorgabe:'Verpackung', ico:'🗃' },
  { key:'sonstiges',  vorgabe:'Sonstiges',  ico:'🖼' },
];
function fotoRolleGueltig(r){ return FOTO_ROLLEN.some(x=>x.key===r) ? r : ''; }
function fotoRolleWort(r){
  const d = FOTO_ROLLEN.find(x=>x.key===r);
  if(!d) return '';
  const tab = (typeof bezWert==='function') ? bezWert('fotorollen','werte',null) : null;
  return (tab && tab[r]) || d.vorgabe;
}

/* GS1-Prüfziffer. Ein vom Scanner gelesener Code stimmt immer; bei einer
   VON HAND getippten Nummer fängt sie fast jeden Tippfehler (Zahlendreher,
   vergessene Ziffer). Rein/testbar. */
function gtinPruefzifferOk(g){
  const s = String(g==null?'':g).trim();
  if(!/^(\d{8}|\d{12,14})$/.test(s)) return false;
  const z = s.split('').map(Number);
  const pz = z.pop();
  let summe = 0;
  z.reverse().forEach((d,i)=>{ summe += d * (i%2===0 ? 3 : 1); });
  return (10 - (summe % 10)) % 10 === pz;
}

/* REF in Vergleichsform: Großschrift, nur A–Z und 0–9 (wie matref.js). */
function produktRefKanon(s){ return String(s==null?'':s).toUpperCase().replace(/[^A-Z0-9]/g,''); }

/* Andere Produkte mit derselben REF. Rein/testbar. */
function refDubletten(db, ref, eigeneId){
  const c = produktRefKanon(ref);
  if(!c) return [];
  return Object.keys(db||{}).filter(id=>id!==eigeneId && db[id] && produktRefKanon(db[id].ref)===c).map(id=>db[id]);
}

/* Synonyme: Komma, Semikolon oder Zeilenumbruch trennen. Doppelte (ohne
   Rücksicht auf Groß/Klein) und der Produktname selbst fallen weg. */
function produktSynonyme(text, name){
  const n = String(name||'').trim().toLowerCase();
  const gesehen = {};
  return String(text==null?'':text).split(/[,;\n]+/).map(s=>s.trim()).filter(s=>{
    const k = s.toLowerCase();
    if(!s || k===n || gesehen[k]) return false;
    gesehen[k] = 1; return true;
  });
}

/* ── Verpackungsstufen ──
   rec.packungen = [ { gtin, menge, art?, bestell? } ]
   menge = Zahl der EINHEITEN in dieser Verpackung (nicht der direkt
   enthaltenen Unterpackungen): Ein Kasten mit 4 Kartons zu je 10 trägt 40. */
function packungenNormal(liste){
  const key = (typeof gtinKey==='function') ? gtinKey : (x=>String(x||'').trim());
  const aus = [], gesehen = {};
  (Array.isArray(liste)?liste:[]).forEach(p=>{
    if(!p) return;
    const g = key(p.gtin);
    const m = parseInt(p.menge, 10);
    if(!g || gesehen[g] || !(m >= 2)) return;
    gesehen[g] = 1;
    const o = { gtin:g, menge:m };
    if(p.art) o.art = String(p.art).trim();
    if(p.bestell) o.bestell = true;
    aus.push(o);
  });
  aus.sort((a,b)=>a.menge-b.menge);
  /* Höchstens EINE Bestelleinheit. */
  let b = false;
  aus.forEach(p=>{ if(p.bestell){ if(b) delete p.bestell; b = true; } });
  return aus;
}

/* Gehört diese GTIN als Verpackung zu einem Produkt? → { id, packung } */
function packungFinden(db, gtin){
  const key = (typeof gtinKey==='function') ? gtinKey : (x=>String(x||'').trim());
  const g = key(gtin);
  if(!g) return null;
  const ids = Object.keys(db||{});
  for(let i=0;i<ids.length;i++){
    const r = db[ids[i]];
    const p = (r && Array.isArray(r.packungen)) ? r.packungen.find(x=>x && key(x.gtin)===g) : null;
    if(p) return { id:ids[i], packung:p };
  }
  return null;
}

/* Die Bestelleinheit: ausdrücklich markiert — sonst die kleinste Verpackung.
   Ohne Verpackungsstufen ist es die Einheit selbst (menge 1). */
function packungBestell(rec){
  const l = packungenNormal(rec && rec.packungen);
  return l.find(p=>p.bestell) || l[0] || null;
}

/* ── AccessGUDID: Verpackungsstufen aus der Antwort ──
   Die Datenbank führt je Gerät eine Liste von Kennungen: die „Primary" DI
   (die Grundverpackung — unsere Einheit) und „Package"-DIs mit Stückzahl
   und der Kennung, die sie enthalten. Daraus wird die Gesamtzahl der
   Einheiten je Verpackung errechnet (Kasten → Karton → Einheit).
   Liefert { primaer, stufen:[{gtin,menge,art}] } oder null. Rein/testbar. */
function gudidStufen(json){
  if(!json || typeof json!=='object') return null;
  const d = (json.gudid && json.gudid.device) || json.device || null;
  if(!d || !d.identifiers) return null;
  let ids = d.identifiers.identifier;
  if(!ids) return null;
  if(!Array.isArray(ids)) ids = [ids];
  const key = (typeof gtinKey==='function') ? gtinKey : (x=>String(x||'').trim());
  const liste = ids.filter(Boolean).map(x=>({
    gtin: key(x.deviceId),
    typ: String(x.deviceIdType||''),
    enthaelt: x.containsDINumber ? key(x.containsDINumber) : '',
    menge: parseInt(x.pkgQuantity, 10) || 0,
    art: (x.pkgType && String(x.pkgType).toLowerCase()!=='null') ? String(x.pkgType) : '',
  })).filter(x=>x.gtin);
  const p = liste.find(x=>/primary/i.test(x.typ));
  if(!p) return null;
  const nach = {}; liste.forEach(x=>{ nach[x.gtin] = x; });
  function einheiten(x, tiefe){
    if(tiefe > 8) return 0;
    if(x.gtin === p.gtin) return 1;
    if(!x.menge || !x.enthaelt) return 0;
    const innen = nach[x.enthaelt];
    if(!innen) return 0;
    const m = einheiten(innen, tiefe+1);
    return m ? x.menge * m : 0;
  }
  const stufen = liste.filter(x=>/package/i.test(x.typ))
    .map(x=>({ gtin:x.gtin, menge:einheiten(x,0), art:x.art }))
    .filter(x=>x.menge >= 2)
    .sort((a,b)=>a.menge-b.menge);
  return { primaer:p.gtin, stufen };
}

/* ── Export ──
   Dateiname eines Bildes außerhalb der App: GTIN_REF_rolle(_n).endung.
   Nur Zeichen, die jedes Dateisystem verträgt. */
function produktDateiSicher(s){ return String(s==null?'':s).replace(/[^A-Za-z0-9.-]+/g,'-').replace(/^-+|-+$/g,''); }
function produktBildName(rec, rolle, n, endung){
  const gt = rec && rec.manual ? ('ohneGTIN-'+produktDateiSicher(String(rec.gtin||'').replace(/^m:/,''))) : produktDateiSicher(rec && rec.gtin);
  const ref = produktDateiSicher(rec && rec.ref) || 'ohneREF';
  const ro = fotoRolleGueltig(rolle) || 'foto';
  return (gt||'ohneGTIN') + '_' + ref + '_' + ro + (n>1 ? ('_'+n) : '') + (endung || '.jpg');
}
/* Bildnamen eines Produkts in Reihenfolge, je Rolle durchgezählt. */
function produktBildNamen(rec, endungen){
  const fotos = (typeof matPhotos==='function') ? matPhotos(rec) : [];
  const zaehler = {};
  return fotos.map((f,i)=>{
    const ro = fotoRolleGueltig(f.rolle) || 'foto';
    zaehler[ro] = (zaehler[ro]||0) + 1;
    return { src:f.src, name:produktBildName(rec, ro, zaehler[ro], (endungen&&endungen[i])||'.jpg') };
  });
}

/* Eine CSV-Zelle (Semikolon-Trennung wie die übrigen Exporte der App;
   Excel in deutscher Einstellung öffnet das ohne Rückfrage). */
function csvZelle(v){
  const s = (v==null) ? '' : String(v);
  return /[";\r\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
}
function csvText(zeilen){ return zeilen.map(z=>z.map(csvZelle).join(';')).join('\r\n'); }
function euroText(n){ return (n==null || !isFinite(n)) ? '' : Number(n).toFixed(2).replace('.',','); }

const PRODUKT_EXPORT_KOPF = ['GTIN (Einheit)','REF','Name','Hersteller','Kategorie','Synonyme',
  'Stückpreis EUR','Packungsgröße (Stück)','GTIN Bestelleinheit','Packungspreis EUR','Verpackungsstufen',
  'Lagerort','Maße','Braucht dazu','Aufbereitung','Bilder','Erfasst','Geändert'];

/* Tabelle aller Produkte. `namen(id)` liefert für Beziehungen den Namen des
   Zielprodukts. Rein/testbar (bis auf matSizeList/matPhotos, die selbst rein
   sind). */
function produktExportZeilen(db, namen){
  const nm = namen || (id=>id);
  const ids = Object.keys(db||{}).sort((a,b)=>{
    const x=db[a]||{}, y=db[b]||{};
    return String(x.name||x.ref||a).localeCompare(String(y.name||y.ref||b),'de'); });
  const zeilen = [PRODUKT_EXPORT_KOPF.slice()];
  ids.forEach(id=>{
    const r = db[id]; if(!r) return;
    const best = packungBestell(r);
    const menge = best ? best.menge : 1;
    const masse = (typeof matSizeList==='function') ? matSizeList(r).map(g=>g.wert).join(', ') : '';
    const stufen = packungenNormal(r.packungen).map(p=>p.menge+' Stk: '+p.gtin).join(' | ');
    const bez = Array.isArray(r.beziehungen) ? r.beziehungen : [];
    const zubehoer = bez.filter(b=>b && b.art==='zubehoer').map(b=>nm(b.ziel)).join(' | ');
    const aufber = bez.filter(b=>b && b.art==='aufbereitung').map(b=>nm(b.ziel)).join(' | ');
    zeilen.push([
      r.manual ? '' : (r.gtin||''), r.ref||'', r.name||'', r.hersteller||'', r.kategorie||'',
      (Array.isArray(r.synonyme)?r.synonyme:[]).join(', '),
      euroText(r.preis), String(menge), best ? best.gtin : (r.manual ? '' : (r.gtin||'')),
      (r.preis!=null && isFinite(r.preis)) ? euroText(r.preis*menge) : '',
      stufen, r.lagerort||'', masse, zubehoer, aufber,
      produktBildNamen(r).map(b=>b.name).join(' | '),
      (r.createdAt||'').slice(0,10), (r.updatedAt||'').slice(0,10),
    ]);
  });
  return zeilen;
}

/* ── ZIP ohne Bibliothek ──
   Ein ZIP im Verfahren „gespeichert" (ohne Kompression) ist ein einfaches
   Format: je Datei ein Kopf mit Prüfsumme, am Ende ein Inhaltsverzeichnis.
   Fotos sind ohnehin JPEG — Kompression brächte kaum etwas. Rein/testbar. */
let _crcTab = null;
function crc32(bytes){
  if(!_crcTab){ _crcTab = new Uint32Array(256);
    for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c = (c&1) ? (0xEDB88320 ^ (c>>>1)) : (c>>>1); _crcTab[n]=c>>>0; } }
  let c = 0xFFFFFFFF;
  for(let i=0;i<bytes.length;i++) c = _crcTab[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function zipErstellen(dateien, jetzt){
  const enc = new TextEncoder();
  const d = jetzt || new Date();
  const zeit = ((d.getHours()<<11) | (d.getMinutes()<<5) | Math.floor(d.getSeconds()/2)) & 0xFFFF;
  const datum = (((d.getFullYear()-1980)<<9) | ((d.getMonth()+1)<<5) | d.getDate()) & 0xFFFF;
  const teile = [], verzeichnis = [];
  let pos = 0;
  (dateien||[]).forEach(f=>{
    const name = enc.encode(f.name);
    const daten = (f.daten instanceof Uint8Array) ? f.daten : enc.encode(String(f.daten==null?'':f.daten));
    const crc = crc32(daten);
    const kopf = new DataView(new ArrayBuffer(30));
    kopf.setUint32(0, 0x04034b50, true); kopf.setUint16(4, 20, true); kopf.setUint16(6, 0x0800, true);
    kopf.setUint16(8, 0, true); kopf.setUint16(10, zeit, true); kopf.setUint16(12, datum, true);
    kopf.setUint32(14, crc, true); kopf.setUint32(18, daten.length, true); kopf.setUint32(22, daten.length, true);
    kopf.setUint16(26, name.length, true); kopf.setUint16(28, 0, true);
    teile.push(new Uint8Array(kopf.buffer), name, daten);
    const z = new DataView(new ArrayBuffer(46));
    z.setUint32(0, 0x02014b50, true); z.setUint16(4, 20, true); z.setUint16(6, 20, true); z.setUint16(8, 0x0800, true);
    z.setUint16(10, 0, true); z.setUint16(12, zeit, true); z.setUint16(14, datum, true);
    z.setUint32(16, crc, true); z.setUint32(20, daten.length, true); z.setUint32(24, daten.length, true);
    z.setUint16(28, name.length, true); z.setUint16(30, 0, true); z.setUint16(32, 0, true);
    z.setUint16(34, 0, true); z.setUint16(36, 0, true); z.setUint32(38, 0, true); z.setUint32(42, pos, true);
    verzeichnis.push(new Uint8Array(z.buffer), name);
    pos += 30 + name.length + daten.length;
  });
  const vzLaenge = verzeichnis.reduce((n,t)=>n+t.length, 0);
  const ende = new DataView(new ArrayBuffer(22));
  ende.setUint32(0, 0x06054b50, true); ende.setUint16(4, 0, true); ende.setUint16(6, 0, true);
  ende.setUint16(8, (dateien||[]).length, true); ende.setUint16(10, (dateien||[]).length, true);
  ende.setUint32(12, vzLaenge, true); ende.setUint32(16, pos, true); ende.setUint16(20, 0, true);
  const alle = teile.concat(verzeichnis, [new Uint8Array(ende.buffer)]);
  const aus = new Uint8Array(alle.reduce((n,t)=>n+t.length, 0));
  let o = 0; alle.forEach(t=>{ aus.set(t, o); o += t.length; });
  return aus;
}

/* Name einer Zeile, die auf ein Produkt zeigt — der AKTUELLE Name des
   Produkts. null, wenn die Zeile auf kein (vorhandenes) Produkt zeigt. */
function produktNameFuer(e){
  const id = e && e.produkt;
  const r = id && typeof GTINDB!=='undefined' && GTINDB ? GTINDB[id] : null;
  return r ? (r.name || r.ref || null) : null;
}

/* ═══════════ 2. Im Produktformular ═══════════ */

/* Zusatzfelder zwischen Name und Verwendung: Synonyme. */
function produktSynonymFeldHTML(r){
  if(!neuFrei('synonyme')) return '';
  return `<div class="flabel">SYNONYME / ANDERE BEZEICHNUNGEN</div>
    <input class="loc-input" id="pdSyn" placeholder="z. B. CS-Katheter, Coronarsinus-Katheter" value="${esc((Array.isArray(r.synonyme)?r.synonyme:[]).join(', '))}">
    <p class="hint">Komma-getrennt. Unter jedem dieser Wörter findet man das Produkt — beim Suchen und beim Schreiben eines Standards.</p>`;
}

/* Platz für die REF-Warnung, direkt unter dem REF-Feld. */
function produktRefSlotHTML(){ return neuFrei('refpruefung') ? '<div id="pdRefWarn" class="pd-warn" role="status"></div>' : ''; }
function produktRefPruefen(eigeneId){
  const slot = $('pdRefWarn'); if(!slot) return [];
  const ref = (($('scRef')||{}).value||'').trim();
  const dup = refDubletten(GTINDB, ref, eigeneId);
  slot.innerHTML = dup.length
    ? `⚠ REF <b>${esc(ref)}</b> steht schon an: ${dup.map(d=>`<button type="button" class="vlink" data-g="${esc(d.gtin)}" onclick="openScanItem(this.dataset.g,false)">${esc(d.name||d.ref||d.gtin)}</button>`).join(', ')}.
       Dieselbe Bestellnummer gehört zu EINEM Produkt — ist das hier eine andere Verpackungsstufe davon?`
    : '';
  return dup;
}

/* Verpackungsstufen-Editor. */
function produktPackZeileHTML(p, i){
  return `<div class="form-row pd-pack" style="margin-bottom:8px">
    <input class="loc-input pd-pack-g" inputmode="numeric" placeholder="GTIN der Verpackung" value="${esc(p&&p.gtin||'')}">
    <input class="loc-input pd-pack-m" inputmode="numeric" style="flex:0 0 84px" placeholder="Stück" value="${esc(p&&p.menge?String(p.menge):'')}">
    <label class="pd-pack-b" title="Bestelleinheit"><input type="radio" name="pdPackBest" ${p&&p.bestell?'checked':''}> bestellt</label>
    <input type="hidden" class="pd-pack-a" value="${esc(p&&p.art||'')}">
    <button type="button" class="merk-del" style="flex:0 0 44px;border-radius:10px;border:1px solid var(--line);background:var(--surface-2);color:var(--text)" onclick="this.closest('.pd-pack').remove()" aria-label="Verpackungsstufe entfernen">✕</button>
  </div>`;
}
function produktPackHTML(r){
  if(!neuFrei('verpackung')) return '';
  const l = packungenNormal(r.packungen);
  return `<div class="flabel" style="margin-top:12px">VERPACKUNGSSTUFEN</div>
    <div id="pdPack">${l.map(produktPackZeileHTML).join('')}</div>
    <button type="button" class="add-btn" onclick="produktPackNeu()">＋ Verpackungsstufe</button>
    <p class="hint">Die GTIN oben gehört zur <b>Einheit</b> (was im Saal einzeln verbraucht wird). Ein Karton hat eine eigene GTIN — hier mit der Zahl der Einheiten darin. „bestellt" markiert die Bestelleinheit (für Packungspreis und Export).</p>`;
}
function produktPackNeu(p){ const box=$('pdPack'); if(box) box.insertAdjacentHTML('beforeend', produktPackZeileHTML(p||null)); }
function produktPackLesen(){
  const box = $('pdPack'); if(!box) return null;
  return [...box.querySelectorAll('.pd-pack')].map(z=>({
    gtin: (z.querySelector('.pd-pack-g').value||'').trim(),
    menge: (z.querySelector('.pd-pack-m').value||'').trim(),
    art: (z.querySelector('.pd-pack-a').value||'').trim(),
    bestell: !!z.querySelector('input[type=radio]').checked,
  })).filter(p=>p.gtin || p.menge);
}

/* Prüfung VOR dem Speichern. Gibt eine Meldung zurück oder ''. */
function produktFormPruefen(g, istNeu){
  const manual = /^m:/.test(String(g||''));
  if(neuFrei('verpackung') && !manual && istNeu && !gtinPruefzifferOk(g))
    return 'Die Prüfziffer der GTIN passt nicht — bitte die Nummer noch einmal mit dem Etikett vergleichen.';
  const roh = produktPackLesen();
  if(roh){
    for(const p of roh){
      const pg = (typeof gtinKey==='function') ? gtinKey(p.gtin) : p.gtin;
      if(!/^\d{8,14}$/.test(String(p.gtin).replace(/\s/g,'')) || !gtinPruefzifferOk(String(p.gtin).replace(/\s/g,'')))
        return 'Verpackungsstufe: „'+p.gtin+'" ist keine gültige GTIN.';
      const m = parseInt(p.menge,10);
      if(!(m>=2)) return 'Verpackungsstufe '+p.gtin+': bitte die Zahl der Einheiten angeben (mindestens 2).';
      if(pg===g) return 'Die Verpackung kann nicht dieselbe GTIN haben wie die Einheit.';
      if(GTINDB[pg]) return 'GTIN '+p.gtin+' ist schon ein eigenes Produkt („'+(GTINDB[pg].name||GTINDB[pg].ref||pg)+'"). Erst dort löschen, dann hier als Verpackung eintragen.';
      const anders = packungFinden(GTINDB, pg);
      if(anders && anders.id!==g) return 'GTIN '+p.gtin+' ist schon Verpackung von „'+(GTINDB[anders.id].name||anders.id)+'".';
    }
  }
  return '';
}

/* Was das Formular an Neuerungen in den Stammsatz schreibt. Nur Felder,
   deren Neuerung freigegeben ist — sonst bliebe der Satz im Bestand
   unverändert. */
function produktFormPatch(){
  const patch = {};
  if(neuFrei('synonyme') && $('pdSyn')) patch.synonyme = produktSynonyme($('pdSyn').value, ($('scName')||{}).value);
  if(neuFrei('verpackung')){ const roh = produktPackLesen(); if(roh) patch.packungen = packungenNormal(roh); }
  return patch;
}

/* ── AccessGUDID-Hinweis im Formular ──
   Bei einer neuen GTIN fragt der Neuaufbau nach, ob es dazu Angaben gibt —
   und vor allem: ob die gescannte Nummer eine VERPACKUNG ist. Dann wird das
   Produkt unter der Einheit angelegt, sonst entstünde für den Zehnerkarton
   ein eigenes Produkt. */
function produktGudidSlotHTML(g){
  if(!neuFrei('verpackung') || !g || /^m:/.test(g)) return '';
  return '<div id="pdGudid"></div>';
}
let PD_GUDID = null;      /* letzter Treffer zum offenen Formular */
async function produktGudidPruefen(g){
  const slot = $('pdGudid'); if(!slot || typeof gudidLookup!=='function') return;
  PD_GUDID = null;
  slot.innerHTML = '<p class="hint">AccessGUDID wird nach dieser Nummer gefragt …</p>';
  const di = String(g).replace(/^0+/,'') || g;
  let t = null;
  try{ t = await gudidLookup(di); }catch(e){ t = null; }
  if($('pdGudid')!==slot) return;                 /* Formular inzwischen gewechselt */
  if(!t){ slot.innerHTML = '<p class="hint">AccessGUDID kennt diese Nummer nicht (oder kein Netz). Angaben bitte vom Etikett.</p>'; return; }
  PD_GUDID = { gtin:g, treffer:t };
  const teile = [];
  const st = t.stufen || null;
  if(st && st.primaer && st.primaer!==g){
    const meine = (st.stufen||[]).find(x=>x.gtin===g);
    const einheitDa = GTINDB[st.primaer];
    teile.push(`<div class="pd-gudid-box"><b>📦 Das ist eine Verpackung${meine?(' mit '+meine.menge+' Stück'):''}.</b>
      Die Einheit hat die GTIN <span class="gtin-mono">${esc(st.primaer)}</span>${einheitDa?(' und ist schon erfasst: „'+esc(einheitDa.name||einheitDa.ref||st.primaer)+'"'):''}.
      <div class="p-actions" style="margin-top:8px"><button type="button" class="btn btn-pri" onclick="produktAlsEinheit()">${einheitDa?'Verpackung dort eintragen':'Unter der Einheit anlegen'}</button></div></div>`);
  } else if(st && (st.stufen||[]).length){
    teile.push(`<div class="pd-gudid-box">AccessGUDID kennt ${st.stufen.length} Verpackungsstufe${st.stufen.length===1?'':'n'}: ${st.stufen.map(x=>esc(x.menge+' Stück'+(x.art?(' ('+x.art+')'):''))).join(' · ')}.
      <div class="p-actions" style="margin-top:8px"><button type="button" class="btn btn-sec" onclick="produktGudidStufenUebernehmen()">Verpackungsstufen übernehmen</button></div></div>`);
  }
  const leer = (id)=>{ const el=$(id); return el && !el.value.trim(); };
  if((t.ref && leer('scRef')) || (t.hersteller && leer('scHersteller')) || (t.name && leer('scName'))){
    teile.push(`<div class="pd-gudid-box">Angaben laut AccessGUDID (unbestätigt): ${[t.name, t.hersteller, t.ref?('REF '+t.ref):''].filter(Boolean).map(esc).join(' · ')}
      <div class="p-actions" style="margin-top:8px"><button type="button" class="btn btn-sec" onclick="produktGudidAngaben()">In leere Felder übernehmen</button></div></div>`);
  }
  slot.innerHTML = teile.join('') || '<p class="hint">AccessGUDID: keine weiteren Angaben.</p>';
}
function produktGudidAngaben(){
  const t = PD_GUDID && PD_GUDID.treffer; if(!t) return;
  const setze = (id, v)=>{ const el=$(id); if(el && v && !el.value.trim()) el.value = v; };
  setze('scRef', t.ref); setze('scHersteller', t.hersteller); setze('scName', t.name);
  produktRefPruefen(PD_GUDID.gtin);
  toast('Übernommen – bitte mit dem Etikett vergleichen.');
}
function produktGudidStufenUebernehmen(){
  const st = PD_GUDID && PD_GUDID.treffer && PD_GUDID.treffer.stufen; if(!st) return;
  const vorhanden = (produktPackLesen()||[]).map(p=>(typeof gtinKey==='function')?gtinKey(p.gtin):p.gtin);
  let n = 0;
  st.stufen.forEach(x=>{ if(vorhanden.indexOf(x.gtin)<0){ produktPackNeu({ gtin:x.gtin, menge:x.menge, art:x.art }); n++; } });
  toast(n ? (n+' Verpackungsstufe'+(n===1?'':'n')+' übernommen') : 'Schon alle eingetragen');
}
/* Die gescannte Nummer ist eine Verpackung: zum Produkt der Einheit wechseln
   und die Verpackung dort eintragen. Bereits Getipptes geht mit. */
function produktAlsEinheit(){
  const t = PD_GUDID && PD_GUDID.treffer; const st = t && t.stufen; if(!st) return;
  const packG = PD_GUDID.gtin;
  const meine = (st.stufen||[]).find(x=>x.gtin===packG) || { gtin:packG, menge:0 };
  const einheit = st.primaer;
  const val = (id)=>{ const el=$(id); return el ? el.value.trim() : ''; };
  const entwurf = Object.assign({}, GTINDB[einheit] || { gtin:einheit });
  const aufnehmen = (k, v)=>{ if(v && !entwurf[k]) entwurf[k] = v; };
  aufnehmen('hersteller', val('scHersteller')); aufnehmen('ref', val('scRef')); aufnehmen('name', val('scName'));
  aufnehmen('verwendung', val('scVerw')); aufnehmen('kategorie', val('scKat')); aufnehmen('lagerort', val('scLoc'));
  entwurf.fotos = (matPhotos(entwurf)).concat((typeof scanGalerie!=='undefined'?scanGalerie:[]).filter(f=>f && !matPhotos(entwurf).some(x=>x.src===f.src)));
  entwurf.packungen = packungenNormal((entwurf.packungen||[]).concat([{ gtin:packG, menge:meine.menge||'', art:meine.art||'' }]));
  if(!meine.menge) toast('Bitte die Stückzahl der Verpackung eintragen.', true);
  renderScanItemForm(entwurf);
  /* Stückzahl unbekannt → leere Zeile zum Ausfüllen anbieten. */
  if(!meine.menge) produktPackNeu({ gtin:packG, menge:'' });
  if(typeof setBar==='function') setBar(entwurf.name||('GTIN '+einheit), 'Bearbeiten', true);
  toast('Produkt der Einheit geöffnet — die Verpackung ist eingetragen.');
}

/* ═══════════ 3. In der Produktansicht ═══════════ */
function produktViewFelderHTML(r){
  let h = '';
  if(neuFrei('synonyme') && Array.isArray(r.synonyme) && r.synonyme.length)
    h += `<div class="info-field"><div class="if-l">Synonyme</div><div class="if-v">${esc(r.synonyme.join(', '))}</div></div>`;
  if(neuFrei('verpackung')){
    const l = packungenNormal(r.packungen);
    if(l.length) h += `<div class="info-field"><div class="if-l">Verpackungsstufen</div><div class="if-v pd-stufen">${l.map(p=>
      `<div class="pd-stufe"><b>${esc(p.menge+' Stück')}</b>${p.art?(' · '+esc(p.art)):''}${p.bestell?' <span class="pd-best">Bestelleinheit</span>':''}<div class="gtin-mono">${esc(p.gtin)}</div></div>`).join('')}</div></div>`;
  }
  return h;
}

/* ═══════════ 4. Export für Excel / SAP ═══════════ */

function produktExportBlatt(){
  if(!neuFrei('materialexport')) return;
  const n = Object.keys(GTINDB||{}).length;
  const bilder = Object.keys(GTINDB||{}).reduce((s,id)=>s+matPhotos(GTINDB[id]).length, 0);
  let h = `<div class="sheet-grip"></div><div class="sheet-title">Material exportieren</div>
    <p class="hint" style="margin:0 4px 10px">${n} Produkte · ${bilder} Bilder. Die Tabelle öffnet sich direkt in Excel: GTIN, REF, Name, Hersteller, Packungsgröße, Preise, Verpackungsstufen, Zubehör. Für SAP entspricht die GTIN dem EAN-Feld, die REF der Herstellerteilenummer.</p>`;
  h += sAct('📊','Nur die Tabelle (CSV)','klein, sofort','showSheet(false);produktExportCSV()');
  h += sAct('🗂','Tabelle + alle Bilder (ZIP)','Bilder heißen GTIN_REF_rolle.jpg','showSheet(false);produktExportZIP()');
  h += `<button class="sheet-close" onclick="showSheet(false)">Schließen</button>`;
  $('sheet').innerHTML = h; showSheet(true);
}
function produktNameVon(id){ const r=GTINDB&&GTINDB[id]; return r ? (r.name||r.ref||id) : String(id||''); }
function produktExportDatei(blob, name){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 4000);
}
function produktExportCSV(){
  try{
    const csv = csvText(produktExportZeilen(GTINDB, produktNameVon));
    produktExportDatei(new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8'}), 'material-'+today()+'.csv');
    toast('Tabelle heruntergeladen');
  }catch(e){ toast('Export fehlgeschlagen', true); }
}
const PD_ENDUNG = { 'image/jpeg':'.jpg', 'image/png':'.png', 'image/webp':'.webp', 'image/gif':'.gif' };
/* Die Bytes eines Bildes: vom Server, sonst aus dem Spiegel des Geräts,
   sonst aus einer alten data-URL. */
async function produktBildBytes(src){
  let blob = null;
  try{ const r = await fetch(src); if(r.ok) blob = await r.blob(); }catch(e){}
  if(!blob && typeof medKennungAusUrl==='function' && typeof medSpiegelGet==='function'){
    const k = medKennungAusUrl(src); if(k) blob = await medSpiegelGet(k); }
  if(!blob && typeof medZuBlob==='function' && /^data:/.test(String(src))) blob = medZuBlob(src);
  if(!blob) return null;
  return { daten:new Uint8Array(await blob.arrayBuffer()), endung:PD_ENDUNG[blob.type]||'.jpg' };
}
async function produktExportZIP(){
  try{
    toast('Bilder werden gesammelt …');
    const dateien = [];
    const ids = Object.keys(GTINDB||{});
    let fehlt = 0;
    for(const id of ids){
      const r = GTINDB[id];
      const fotos = matPhotos(r);
      if(!fotos.length) continue;
      const bytes = [];
      for(const f of fotos){ bytes.push(await produktBildBytes(f.src)); }
      const namen = produktBildNamen(r, bytes.map(b=>b?b.endung:'.jpg'));
      namen.forEach((nm,i)=>{ if(bytes[i]) dateien.push({ name:'bilder/'+nm.name, daten:bytes[i].daten }); else fehlt++; });
    }
    const csv = '\ufeff' + csvText(produktExportZeilen(GTINDB, produktNameVon));
    dateien.unshift({ name:'material.csv', daten:new TextEncoder().encode(csv) });
    const zip = zipErstellen(dateien);
    produktExportDatei(new Blob([zip], {type:'application/zip'}), 'material-'+today()+'.zip');
    toast(fehlt ? ('ZIP heruntergeladen — '+fehlt+' Bild(er) nicht erreichbar (kein Netz?)') : 'ZIP mit Tabelle und Bildern heruntergeladen', !!fehlt);
  }catch(e){ toast('Export fehlgeschlagen: '+((e&&e.message)||e), true); }
}
