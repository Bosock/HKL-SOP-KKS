/* E2E: Fotos an Anleitungs-Schritten (features/guides.js + /api/media).

   Anlass: In der Notfall-Anleitung „Einsatzbereitschaft herstellen" stand beim
   Bearbeiten das orange „lokal"-Pill — nichts kam mehr auf dem Server an. Der
   Grund lag nicht am Netz: Die Schritt-Fotos lagen als base64 im geteilten
   Schlüssel `hkl_guides`. Damit wanderte bei JEDER Änderung der gesamte
   Bildbestand mit, und der Gerätespeicher (~5 MB) war nach wenigen Fotos voll.

   Geprüft wird deshalb der ganze Weg im echten Browser — Foto aufnehmen →
   Adresse am Schritt → Bild in der Anleitung sichtbar — und die eine
   Eigenschaft, die den Fehler unmöglich macht: im geteilten Zustand steht
   KEIN Bild. Dazu der Umzug des Altbestands, denn ohne ihn bleibt jede
   Anleitung, die es schon gibt, genau so schwer wie vorher. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

/* Ein echtes, aufnahmegroßes Foto im Browser erzeugen (kein 8×8-Pixelchen):
   erst an 1600 px zeigt sich, dass verkleinert wird. */
const FOTO = `(async function(){
  const c = document.createElement('canvas'); c.width=1600; c.height=1200;
  const g = c.getContext('2d');
  g.fillStyle='#123'; g.fillRect(0,0,1600,1200);
  g.fillStyle='#e08a3d'; g.fillRect(80,80,900,700);
  return c.toDataURL('image/jpeg', 0.92);
})()`;

(async () => {
  const r = reporter('anleitungsfotos');
  const srv = await startServer();
  const browser = await launchBrowser();
  const { page, errs } = await bootPage(browser, srv.base);
  await page.evaluate(`doLogin('1234567')`);

  // ═══════════ 1) Ein NEUES Foto am Schritt ═══════════
  const neu = await page.evaluate(`(async function(){
    const foto = await ${FOTO};
    GUIDES = [{ id:'g-eb', titel:'Einsatzbereitschaft herstellen', bereich:'Notfall', notfall:true,
      schritte:[{ id:'s1', text:'Grünen Knopf drücken' }] }];
    saveGuides(); guideEditId='g-eb';
    await guideStepBildSetzen(0, foto);
    const g = guideById('g-eb');
    return { bild:g.schritte[0].bild, roh:foto.length };
  })()`);
  r.check('das Foto steht als Adresse am Schritt', /^\/api\/media\/[0-9a-f]{32}$/.test(neu.bild || ''));

  const abruf = await page.evaluate(`(async function(){
    const a = await fetch(${JSON.stringify(neu.bild)});
    const b = await a.blob();
    return { ok:a.ok, art:a.headers.get('content-type'), bytes:b.size };
  })()`);
  r.check('das Bild liegt auf dem Server und ist abrufbar', abruf.ok && /^image\//.test(abruf.art || ''));
  r.check('… und ist dabei verkleinert worden', abruf.bytes > 0 && abruf.bytes < neu.roh * 0.75);

  /* Der Kern: der geteilte Zustand — das, was bei jeder Änderung komplett zum
     Server wandert — trägt das Bild NICHT. Geprüft über alle Schlüssel, weil
     ein Foto auch über einen anderen Weg hineingeraten könnte. */
  const zustand = await page.evaluate(`(function(){
    let gesamt=0, mitBild=[];
    SHARED_KEYS.forEach(k=>{ const v=store.get(k); if(!v) return; gesamt+=v.length;
      if(v.indexOf('data:image')>=0) mitBild.push(k); });
    return { gesamt, mitBild, guides:(store.get('hkl_guides')||'').length };
  })()`);
  r.check('kein Bild im geteilten Zustand', zustand.mitBild.length === 0);
  r.check('… und `hkl_guides` bleibt winzig (' + zustand.guides + ' Zeichen)', zustand.guides < 1000);

  /* Der Weg zum Server muss sauber durchlaufen: das Pill zeigt „gespeichert",
     nicht „lokal" — genau das war der sichtbare Fehler. */
  let dot = null;
  for (let i = 0; i < 40; i++) {
    dot = await page.evaluate(`(function(){ const d=document.getElementById('syncDot');
      return { cls:d.className, label:d.textContent, title:d.title }; })()`);
    if (/\bok\b/.test(dot.cls)) break;
    await page.waitForTimeout(150);
  }
  r.check('der Sync-Punkt steht auf „gespeichert" (kein „lokal"-Pill)', /\bok\b/.test(dot.cls) && dot.label === '');

  const serverSeitig = await page.evaluate(`(async function(){
    const j = await (await fetch('/api/state',{cache:'no-store'})).json();
    const g = (j.state && j.state.hkl_guides) || [];
    return { bild:(g[0]&&g[0].schritte[0].bild)||'', roh:JSON.stringify(j.state).indexOf('data:image')>=0 };
  })()`);
  r.check('der Server hat die Anleitung — mit Adresse statt Bild', serverSeitig.bild === neu.bild && !serverSeitig.roh);

  // ═══════════ 2) In der Anleitung sichtbar ═══════════
  const sicht = await page.evaluate(`(function(){
    openGuide('g-eb');
    const img = document.getElementById('scr-guide').querySelector('.g-img img');
    return { da:!!img, src: img ? img.getAttribute('src') : '' };
  })()`);
  r.check('das Foto erscheint im Schritt', sicht.da);
  r.check('… und zeigt auf /api/media/<Kennung>', /\/api\/media\/[0-9a-f]{32}/.test(sicht.src));

  // ═══════════ 3) Der Altbestand zieht nach ═══════════
  const umzug = await page.evaluate(`(async function(){
    const foto = await ${FOTO};
    GUIDES = [{ id:'g-alt', titel:'Alte Anleitung', schritte:[
      { id:'a1', bild:foto }, { id:'a2', bild:foto }, { id:'a3', text:'ohne Foto' }] }];
    saveGuides();
    const vorher = (store.get('hkl_guides')||'').length;
    let n = 0, runden = 0;
    do { n = await medMigriereAltbestand(); runden++; } while(n > 0 && runden < 20);
    const g = guideById('g-alt');
    return { vorher, nachher:(store.get('hkl_guides')||'').length,
             bilder:g.schritte.map(s=>s.bild||''), leer:g.schritte[2].bild };
  })()`);
  r.check('Altbestand: beide Fotos sind umgezogen',
    umzug.bilder.slice(0, 2).every(b => /^\/api\/media\/[0-9a-f]{32}$/.test(b)));
  r.check('… dasselbe Foto zweimal ergibt eine Adresse', umzug.bilder[0] === umzug.bilder[1]);
  r.check('… ein Schritt ohne Foto bleibt unangetastet', !umzug.leer);
  r.check('… und der Gerätespeicher wird frei (' +
    Math.round(umzug.vorher / 1024) + ' KB → ' + Math.round(umzug.nachher / 1024) + ' KB)',
    umzug.nachher < umzug.vorher / 10);

  r.check('keine Konsolen-/Seitenfehler', errs.length === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
