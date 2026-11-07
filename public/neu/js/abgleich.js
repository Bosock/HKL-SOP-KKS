/* ─────────────────────────────────────────────────────────────
   NEUE APP — ABGLEICH mit dem Server (eigener, kleiner Sync)

   · Gesprochen wird NUR mit dem Raum „neuaufbau" (?raum=neuaufbau). Jede
     Antwort muss diesen Raum bestätigen (Feld `raum`), sonst wird nichts
     übernommen und nichts mehr gesendet — nie landet etwas im Bestand.
   · Abgeglichen werden nur die Schlüssel der neuen App (na_…) und das
     Verwaltungspasswort des Neuaufbaus (hkl_authpw). Die Schlüssel der alten
     Oberfläche im selben Raum bleiben unberührt.
   · Jeder Schlüssel ist ein eigenes Objekt (ein Material, ein Standard …).
     Der Server ersetzt beim Senden nur die gesendeten Schlüssel; zwei Geräte,
     die verschiedene Dinge ändern, kommen sich also nicht in die Quere. Ändern
     zwei Geräte DASSELBE Objekt, gilt das zuletzt gesendete (bewusst einfach).
   · Löschen = Wert null (der Server kennt kein Entfernen).
   · Offline: Änderungen liegen im Gerätespeicher und in einer Warteliste
     (nalokal_offen) und gehen beim nächsten Kontakt hinaus.
   ───────────────────────────────────────────────────────────── */
const NA_RAUM = 'neuaufbau';
const NA_OFFEN = 'nalokal_offen';     /* noch nicht gesendete Schlüssel (nur dieses Gerät) */
const NA_INDEX = 'nalokal_index';     /* alle bekannten Schlüssel der neuen App auf diesem Gerät */
function naSyncSchluessel(k){ return /^na_/.test(k) || k==='hkl_authpw'; }

const naAbgleich = (()=>{
  let rev = null, laeuft = false, nochmal = false, gesperrt = false, zeitgeber = null, beiAenderung = null;
  const offen = new Set(loadJSON(NA_OFFEN, []) || []);
  const index = new Set(loadJSON(NA_INDEX, []) || []);
  let zuletzt = { art:'', text:'' };

  function punkt(art, text){
    zuletzt = { art, text };
    const d = $('naPunkt'); if(!d) return;
    d.className = 'sync-dot ' + art;
    d.title = text || '';
    d.textContent = art==='local' ? 'lokal' : '';
  }
  function indexMerken(k){ if(index.has(k)) return; index.add(k); saveJSON(NA_INDEX, Array.from(index)); }
  function offenMerken(){ saveJSON(NA_OFFEN, Array.from(offen)); }

  /* Lesen und Schreiben eines Objekts. Schreiben merkt es zum Senden vor. */
  function lesen(k){ return loadJSON(k, null); }
  function schreiben(k, wert){
    /* Raumschutz: außerhalb des Neuaufbaus schreibt die neue App NICHTS. */
    if(RAUM.id!==NA_RAUM) throw new Error('Neue App nur im Neuaufbau');
    if(gesperrt) throw new Error('Abgleich gesperrt');
    store.set(k, JSON.stringify(wert==null ? null : wert));
    indexMerken(k); offen.add(k); offenMerken(); planen();
  }
  function schluessel(){ return Array.from(index); }

  function raumPruefen(j){
    if(!j || j.raum!==NA_RAUM){ gesperrt = true; throw new Error('Server bestätigt den Raum „Neuaufbau" nicht'); }
  }
  /* Übernimmt den Stand des Servers für alle Schlüssel, die hier nicht
     gerade selbst geändert wurden. Gibt die geänderten Schlüssel zurück. */
  function uebernehmen(state){
    const geaendert = [];
    Object.keys(state||{}).forEach(k=>{
      if(!naSyncSchluessel(k) || offen.has(k)) return;
      const neu = JSON.stringify(state[k]==null ? null : state[k]);
      if(store.get(k)!==neu){ store.set(k, neu); geaendert.push(k); }
      indexMerken(k);
    });
    return geaendert;
  }
  async function holen(){
    const url = '/api/state?raum='+NA_RAUM + (rev!=null ? '&since='+rev : '');
    const r = await fetch(url, { cache:'no-store' });
    if(!r.ok) throw new Error('HTTP '+r.status);
    const j = await r.json(); raumPruefen(j);
    if(j.unchanged) return [];
    rev = j.rev;
    return uebernehmen(j.state);
  }
  async function senden(){
    if(!offen.size) return [];
    const keys = Array.from(offen); const st = {}; const stand = {};
    keys.forEach(k=>{ stand[k] = store.get(k); st[k] = loadJSON(k, null); });
    const r = await fetch('/api/state?raum='+NA_RAUM, { method:'PUT', cache:'no-store',
      headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ state: st }) });
    if(!r.ok) throw new Error('HTTP '+r.status);
    const j = await r.json(); raumPruefen(j);
    /* Nur austragen, was sich seit dem Absenden nicht wieder geändert hat. */
    keys.forEach(k=>{ if(store.get(k)===stand[k]) offen.delete(k); });
    offenMerken();
    rev = j.rev;
    return uebernehmen(j.state);
  }
  async function runde(){
    if(gesperrt){ punkt('err', 'Abgleich angehalten: Server bestätigt den Raum nicht'); return; }
    if(laeuft){ nochmal = true; return; }
    laeuft = true;
    try{
      if(offen.size) punkt('saving', 'Wird gespeichert …');
      const a = await senden();
      const b = await holen();
      const alle = a.concat(b).filter((k,i,x)=>x.indexOf(k)===i);
      punkt(offen.size ? 'local' : 'ok', offen.size ? (offen.size+' Änderung(en) warten auf den Server') : 'Mit dem Server abgeglichen');
      if(alle.length && beiAenderung){ try{ beiAenderung(alle); }catch(e){ console.error(e); } }
    }catch(e){
      punkt(gesperrt ? 'err' : 'local', gesperrt ? String(e.message) : 'Server nicht erreichbar – gespeichert nur auf diesem Gerät');
    }finally{
      laeuft = false;
      if(nochmal){ nochmal = false; setTimeout(runde, 50); }
    }
  }
  let planTimer = null;
  function planen(){ if(planTimer) clearTimeout(planTimer); planTimer = setTimeout(()=>{ planTimer = null; runde(); }, 700); }

  /* Der Live-Zeiger: Folgt dieses Gerät dem Zeiger (keine eigene Wahl) und
     ist der Neuaufbau nicht mehr live, geht es zurück zur alten App. */
  async function liveBlick(){
    try{
      const r = await fetch('/api/raeume', { cache:'no-store' });
      if(!r.ok) return null;
      const j = await r.json();
      const liste = Array.isArray(j.raeume) ? j.raeume : [];
      if(!liste.some(x=>x && x.id===NA_RAUM)){ gesperrt = true; punkt('err','Server kennt den Neuaufbau nicht'); return j; }
      raumLiveMerken(j.live);
      if(RAUM.wahl && RAUM.wahl===j.live) raumWaehlen(null);
      if(!RAUM.gewaehlt && j.live!==RAUM.id){ await leeren(2500); location.replace('../'); }
      return j;
    }catch(e){ return null; }
  }

  async function leeren(ms){
    if(!offen.size) return true;
    const t = new Promise(res=>setTimeout(()=>res(false), ms||3000));
    await Promise.race([runde(), t]);
    return !offen.size;
  }
  function start(cb){
    beiAenderung = cb;
    runde(); liveBlick();
    zeitgeber = setInterval(runde, 20000);
    setInterval(liveBlick, 120000);
    document.addEventListener('visibilitychange', ()=>{ if(!document.hidden){ runde(); liveBlick(); } });
    window.addEventListener('online', runde);
  }
  return { lesen, schreiben, schluessel, start, runde, leeren, liveBlick,
    offen: ()=>offen.size, gesperrt: ()=>gesperrt, status: ()=>zuletzt };
})();
