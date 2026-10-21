/* END-TO-END: FOTOS SPRENGEN DEN GETEILTEN ZUSTAND NICHT MEHR

   Der Anlass ist ein Vorfall aus dem Labor: Beim Speichern einer neuen
   Anleitung mit EINEM Foto meldete die App „Daten zu groß für den Server —
   lokal gesichert. Bitte Fotos verkleinern." Der Rat war unbrauchbar (Fotos
   werden beim Aufnehmen längst auf 1280 px verkleinert), und die Ursache blieb
   unsichtbar.

   Die Ursache war, dass Anleitungs-Fotos als base64 IM geteilten Zustand
   lagen (`hkl_guides`) — der Weg, den features/medien.js für Material- und
   Bestellfotos längst abgelöst hatte; die Anleitungen sind bei der Umstellung
   übersehen worden. Gemessen wiegt ein verkleinertes Handyfoto dort 327 KB,
   und weil beim Speichern IMMER der ganze Schlüssel wandert, wächst damit der
   Umfang JEDER weiteren Speicherung.

   Diese Prüfung hält drei Dinge fest:
     ① Ein neu angehängtes Anleitungs-Foto landet NICHT im geteilten Zustand.
     ② Der Altbestand zieht von selbst nach.
     ③ Lehnt der Server doch einmal ab, BENENNT die App den Posten — statt
        pauschal „Fotos verkleinern" zu raten. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

/* Ein kleines, aber echtes JPEG-Datenbild (Rauschen, damit es nicht auf ein
   paar Bytes zusammenfällt). */
const FOTO_BAUEN = (kante) => `(async()=>{
  const c=document.createElement('canvas'); c.width=${kante}; c.height=${kante};
  const g=c.getContext('2d'); const im=g.createImageData(c.width,c.height);
  for(let i=0;i<im.data.length;i+=4){ const v=100+Math.floor(Math.random()*120);
    im.data[i]=v; im.data[i+1]=v-20; im.data[i+2]=v-40; im.data[i+3]=255; }
  g.putImageData(im,0,0); return c.toDataURL('image/jpeg',0.9);
})()`;

(async () => {
  const r = reporter('fotogroesse');
  const browser = await launchBrowser();

  /* ══ Teil 1: normaler Server ══════════════════════════════════ */
  const srv = await startServer();
  const A = await bootPage(browser, srv.base);
  await A.page.evaluate(() => { doLogin('1234567'); });

  /* ① Ein Foto an einem Anleitungs-Schritt geht in den Medienspeicher. */
  const r1 = await A.page.evaluate(async (bauen) => {
    const foto = await eval(bauen);
    const g = { id: guideNewId('g'), titel: 'HKL einsatzbereit', bereich: '', kurz: '',
      schritte: [{ id: guideNewId('s'), text: 'Röntgen anschalten', bild: null, warn: '', tipp: '' }] };
    GUIDES.push(g); saveGuides();
    /* Genau der Weg, den guideStepPhoto jetzt nimmt. */
    const wert = await medFotoSichern(foto);
    g.schritte[0].bild = wert; saveGuides();
    const roh = store.get('hkl_guides') || '';
    return {
      istAdresse: medIstMediaUrl(wert),
      keinBase64: roh.indexOf('data:image') < 0,
      guidesKB: Math.round(roh.length / 1024),
      fotoKB: Math.round(foto.length / 1024),
      kennung: medKennungAusUrl(wert),
    };
  }, FOTO_BAUEN(900));
  r.check('Schritt-Foto wird als Adresse gespeichert, nicht als base64', r1.istAdresse && r1.keinBase64);
  r.check(`… hkl_guides bleibt klein (${r1.guidesKB} KB statt ~${r1.fotoKB} KB)`, r1.guidesKB < 5);

  /* Das Bild muss danach auch wirklich abrufbar sein — sonst hätten wir die
     Anleitung entlastet und dabei das Foto verloren. */
  const r1b = await A.page.evaluate(async (k) => {
    const a = await fetch('/api/media/' + k);
    return { ok: a.ok, typ: a.headers.get('content-type') || '', bytes: (await a.blob()).size };
  }, r1.kennung);
  r.check('… und das Foto liegt abrufbar auf dem Server', r1b.ok && r1b.bytes > 1000);

  /* ② Altbestand: base64 in einer Anleitung zieht von selbst um. */
  const r2 = await A.page.evaluate(async (bauen) => {
    const foto = await eval(bauen);
    const g = { id: guideNewId('g'), titel: 'Alt-Anleitung', schritte: [
      { id: guideNewId('s'), text: 'alter Schritt', bild: foto, warn: '', tipp: '' }] };
    GUIDES.push(g); saveGuides();
    const vorher = (store.get('hkl_guides') || '').length;
    const umgezogen = await medMigriereAltbestand(8);
    const nachher = (store.get('hkl_guides') || '').length;
    return { umgezogen, vorher, nachher,
      jetztAdresse: medIstMediaUrl(guideById(g.id).schritte[0].bild),
      keinBase64: (store.get('hkl_guides') || '').indexOf('data:image') < 0 };
  }, FOTO_BAUEN(900));
  r.check('Altbestand: base64-Foto einer Anleitung zieht um', r2.umgezogen > 0 && r2.jetztAdresse);
  r.check(`… und entlastet den geteilten Zustand (${Math.round(r2.vorher/1024)} → ${Math.round(r2.nachher/1024)} KB)`,
    r2.nachher < r2.vorher && r2.keinBase64);

  await A.ctx.close();
  await srv.stop();

  /* ══ Teil 2: Server mit absichtlich winzigem Limit ════════════
     So lässt sich der gemeldete Fall herstellen, ohne Megabyte zu erzeugen. */
  const eng = await startServer({ MAX_BODY: '4096' });
  const B = await bootPage(browser, eng.base);
  await B.page.evaluate(() => { doLogin('1234567'); });

  const r3 = await B.page.evaluate(async () => {
    /* Ein Schlüssel, der das Limit sicher reißt — ohne Foto, damit die Prüfung
       misst, was sie behauptet: die MELDUNG, nicht die Bildgröße. */
    const dick = []; for (let i = 0; i < 400; i++) dick.push({ id: 'g' + i, titel: 'X'.repeat(60), schritte: [] });
    GUIDES.length = 0; GUIDES.push.apply(GUIDES, dick); saveGuides();
    await new Promise(res => setTimeout(res, 3000));      /* Entprellung + Versuch */
    const d = document.getElementById('syncDot');
    return { titel: d.title || '', klasse: d.className || '',
      protokoll: (typeof DIAG !== 'undefined' && Array.isArray(DIAG))
        ? DIAG.filter(e => /abgelehnt/.test(e.text || '')).length : 0 };
  });
  r.check('Ablehnung: die Meldung nennt den Umfang in KB', /\d+\s*KB/.test(r3.titel));
  r.check('… und benennt den größten Posten beim Namen', /hkl_guides/.test(r3.titel));
  r.check('… rät nicht mehr pauschal „Fotos verkleinern"', !/Fotos verkleinern/.test(r3.titel));
  r.check('… und steht im Protokoll der Diagnose', r3.protokoll > 0);
  r.check('… der Status bleibt „lokal" (nichts geht verloren)', /\blocal\b/.test(r3.klasse));

  /* Die schlechte Nachricht darf nicht in der Farbe für „hat geklappt" kommen. */
  const r4 = await B.page.evaluate(async () => {
    document.getElementById('syncDot').click();
    await new Promise(res => setTimeout(res, 120));
    return document.getElementById('toast').className || '';
  });
  r.check('… und erscheint als Fehler, nicht in Grün', /\berr\b/.test(r4));

  /* Die 413-Antwort selbst schreibt der Browser ins Protokoll — sie ist hier
     der Pruefgegenstand, kein Mangel. Alles ANDERE muss still bleiben. */
  const fremd = B.errs.filter(t => !/413|Payload Too Large/i.test(t));
  r.check('keine unerwarteten Konsolenfehler', fremd.length === 0);
  await r.finish(browser, [eng]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
