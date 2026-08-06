/* E2E: Reihenfolge ziehen (features/sortieren.js).

   Die reine Umordnung deckt test/sortieren.test.js ab. Hier geht es um das,
   was ein Test im Sandkasten nicht kann: ob der MODUS trägt.

     · Schaltet die Rubrik wirklich um — und wieder zurück?
     · Bleibt die normale Bedienung dabei aus dem Weg (kein Abhaken, kein
       ⋯-Menü mitten im Sortieren)?
     · Wird eine gezogene Zeile auch GESPEICHERT — und steht sie nach dem
       Verlassen des Modus in der normalen Ansicht an ihrem neuen Platz?
     · Und die Grenze: über einen Abschnitt hinweg darf nichts wandern.

   Der Zug wird mit echten Zeiger-Ereignissen ausgeführt (Playwright mouse),
   nicht durch Aufruf der Funktion — sonst prüfte diese Suite genau das
   nicht, wofür es sie gibt. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('sortieren');
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);
  await A.page.evaluate(`doLogin('1234567')`);

  /* ═══════════ 1. Hinein und wieder heraus ═══════════ */
  const start = await A.page.evaluate(`(function(){
    // Eine Rubrik mit mindestens drei Zeilen in EINER Gruppe suchen.
    let ziel=null;
    DB.standards.some(s=>{
      curStd=s;
      return (s.rubriken||[]).some((rb,ri)=>{
        const g=sortGruppen(ri).filter(x=>x.items.length>=3);
        if(!g.length) return false;
        ziel={sid:s.id, ri, okey:g[0].okey, n:g[0].items.length,
          cids:g[0].items.map(x=>x.cid), gruppen:sortGruppen(ri).length};
        return true; });
    });
    if(!ziel) return { kein:true };
    openStandard(ziel.sid); openRubrik(ziel.ri);
    const knoepfe=[...document.querySelectorAll('#scr-detail .add-entry-btn')];
    const knopfDa=knoepfe.some(b=>/Reihenfolge/.test(b.textContent));
    const normalZeilen=document.querySelectorAll('#scr-detail .entry-row[data-cid]').length;
    sortAn(ziel.ri);
    const box=document.getElementById('scr-detail');
    return Object.assign(ziel, { kein:false, knopfDa, normalZeilen,
      aktiv:sortAktiv(), nurDiese:sortAktivFuer(ziel.ri) && !sortAktivFuer(ziel.ri+1),
      srtZeilen:box.querySelectorAll('.srt-zeile').length,
      griffe:box.querySelectorAll('.srt-griff').length,
      keineEintragszeilen:box.querySelectorAll('.entry-row[data-cid]').length===0,
      gruppenSichtbar:box.querySelectorAll('.srt-gruppe').length });
  })()`);
  r.check('in der Rubrik steht „↕ Reihenfolge ändern"', !start.kein && start.knopfDa);
  r.check(`der Modus schaltet die Ansicht um (${start.srtZeilen} Sortierzeilen)`, start.aktiv && start.srtZeilen > 0);
  r.check('… und gilt nur für DIESE Rubrik', start.nurDiese);
  r.check('jede Zeile hat einen Griff', start.griffe === start.srtZeilen);
  r.check('die normale Eintragszeile ist währenddessen weg (kein Abhaken, kein ⋯)', start.keineEintragszeilen);
  r.check(`die Abschnitte bleiben sichtbar getrennt (${start.gruppenSichtbar})`, start.gruppenSichtbar >= 1);

  /* ═══════════ 2. Die Knöpfe ═══════════ */
  const knopf = await A.page.evaluate(`(function(){
    const vorher = sortGruppen(${start.ri}).find(g=>g.okey===${JSON.stringify(start.okey)}).items.map(x=>x.cid);
    const letzte = vorher[vorher.length-1];
    sortUiRang(${JSON.stringify(start.okey)}, letzte, 'anfang');
    const nachher = sortGruppen(${start.ri}).find(g=>g.okey===${JSON.stringify(start.okey)}).items.map(x=>x.cid);
    // Und wieder zurück ans Ende.
    sortUiRang(${JSON.stringify(start.okey)}, letzte, 'ende');
    const zurueck = sortGruppen(${start.ri}).find(g=>g.okey===${JSON.stringify(start.okey)}).items.map(x=>x.cid);
    return { obenJetzt: nachher[0]===letzte, wiederUnten: zurueck[zurueck.length-1]===letzte,
      gleicheMenge: nachher.length===vorher.length && zurueck.length===vorher.length,
      identisch: JSON.stringify(zurueck)===JSON.stringify(vorher),
      gespeichert: !!ENTORD[${JSON.stringify(start.okey)}] };
  })()`);
  r.check('„⤒ ganz nach oben" bringt die letzte Zeile an den Anfang', knopf.obenJetzt);
  r.check('„⤓ ganz nach unten" bringt sie zurück', knopf.wiederUnten && knopf.identisch);
  r.check('dabei geht keine Zeile verloren', knopf.gleicheMenge);
  r.check('die Reihenfolge steht im geteilten Zustand', knopf.gespeichert);

  /* ═══════════ 3. DER ZUG — mit echten Zeiger-Ereignissen ═══════════ */
  const vorZug = await A.page.evaluate(`(function(){
    return sortGruppen(${start.ri}).find(g=>g.okey===${JSON.stringify(start.okey)}).items.map(x=>x.cid);
  })()`);

  /* Die erste Zeile an die dritte Stelle ziehen. Gefasst wird am Griff. */
  const alleGriffe = await A.page.$$('#scr-detail .srt-zeile .srt-griff');
  const zeilen = await A.page.$$('#scr-detail .srt-zeile');
  let zugOk = false;
  if (alleGriffe.length >= 3 && zeilen.length >= 3) {
    await alleGriffe[0].scrollIntoViewIfNeeded();
    const g0 = await alleGriffe[0].boundingBox();
    const z2 = await zeilen[2].boundingBox();
    if (g0 && z2) {
      await A.page.mouse.move(g0.x + g0.width / 2, g0.y + g0.height / 2);
      await A.page.mouse.down();
      await A.page.mouse.move(g0.x + g0.width / 2, z2.y + z2.height * 0.75, { steps: 12 });
      await A.page.mouse.up();
      zugOk = true;
    }
  }
  r.check('ein Zug ließ sich ausführen (Griff gefasst, bewegt, losgelassen)', zugOk);

  const nachZug = await A.page.evaluate(`(function(){
    const jetzt = sortGruppen(${start.ri}).find(g=>g.okey===${JSON.stringify(start.okey)}).items.map(x=>x.cid);
    return { jetzt, gespeichert: (ENTORD[${JSON.stringify(start.okey)}]||[]).slice(),
      imModus: sortAktiv(), zeilen: document.querySelectorAll('.srt-zeile').length };
  })()`);
  r.check('DER ZUG: die Reihenfolge hat sich geändert',
    JSON.stringify(nachZug.jetzt) !== JSON.stringify(vorZug));
  r.check('… die erste Zeile steht jetzt weiter unten',
    nachZug.jetzt.indexOf(vorZug[0]) > 0);
  r.check('… es sind noch genau so viele Zeilen wie vorher',
    nachZug.jetzt.length === vorZug.length && new Set(nachZug.jetzt).size === vorZug.length);
  r.check('… und der neue Stand ist gespeichert, nicht nur angezeigt',
    JSON.stringify(nachZug.gespeichert) === JSON.stringify(nachZug.jetzt));
  r.check('nach dem Zug steht man weiter im Sortiermodus', nachZug.imModus);

  /* ═══════════ 4. Die Grenze: nicht über den Abschnitt hinweg ═══════════ */
  const grenze = await A.page.evaluate(`(function(){
    // Eine Rubrik mit MEHREREN Gruppen suchen.
    let ziel=null;
    DB.standards.some(s=>{ curStd=s;
      return (s.rubriken||[]).some((rb,ri)=>{
        const g=sortGruppen(ri).filter(x=>x.items.length>=1);
        if(g.length<2) return false;
        ziel={sid:s.id, ri, a:g[0], b:g[1]}; return true; }); });
    if(!ziel) return { kein:true };
    openStandard(ziel.sid);
    sortRi=null; openRubrik(ziel.ri); sortAn(ziel.ri);
    const boxen=[...document.querySelectorAll('.srt-gruppe')];
    const eigeneSchluessel = new Set(boxen.map(b=>b.dataset.okey)).size===boxen.length;
    // Jede Zeile liegt in GENAU der Gruppe, deren Reihenfolge sie trägt.
    const sauber = boxen.every(b=>{
      const cids=[...b.querySelectorAll('.srt-zeile')].map(z=>z.dataset.cid);
      const g=sortGruppen(ziel.ri).find(x=>x.okey===b.dataset.okey);
      return g && JSON.stringify(cids)===JSON.stringify(g.items.map(x=>x.cid)); });
    return { kein:false, gruppen:boxen.length, eigeneSchluessel, sauber, ri:ziel.ri, sid:ziel.sid };
  })()`);
  r.check(`mehrere Abschnitte haben je eine eigene Reihenfolge (${grenze.gruppen})`,
    !grenze.kein && grenze.eigeneSchluessel);
  r.check('jede Zeile liegt im Abschnitt, dessen Reihenfolge sie trägt', grenze.sauber);

  /* ═══════════ 5. Zurück in die normale Ansicht ═══════════ */
  const raus = await A.page.evaluate(`(function(){
    sortAus();
    const box=document.getElementById('scr-detail');
    const normal = box.querySelectorAll('.entry-row[data-cid]').length;
    const keineSort = box.querySelectorAll('.srt-zeile').length===0;
    // Und über den ‹-Knopf muss es auch gehen.
    sortAn(${grenze.ri});
    const drin = sortAktiv();
    goBack();
    const wiederDraussen = !sortAktiv() && document.getElementById('scr-detail').classList.contains('active');
    return { normal, keineSort, drin, wiederDraussen, aktiv:sortAktiv() };
  })()`);
  r.check('„✓ Fertig" bringt die normale Ansicht zurück', raus.normal > 0 && raus.keineSort);
  r.check('‹ verlässt den Sortiermodus, statt aus der Rubrik zu springen',
    raus.drin && raus.wiederDraussen && !raus.aktiv);

  /* ═══════════ 6. Der neue Platz gilt auch in der normalen Ansicht ═══════════ */
  const sicht = await A.page.evaluate(`(function(){
    openStandard(${JSON.stringify(start.sid)});
    openRubrik(${start.ri});
    const dom=[...document.querySelectorAll('#scr-detail .entry-row[data-cid]')].map(x=>x.dataset.cid);
    const ord=(ENTORD[${JSON.stringify(start.okey)}]||[]);
    // Die gespeicherte Folge muss in der Anzeige dieselbe Reihenfolge haben.
    const gefiltert=dom.filter(c=>ord.indexOf(c)>=0);
    const erwartet=ord.filter(c=>dom.indexOf(c)>=0);
    return { gleich: JSON.stringify(gefiltert)===JSON.stringify(erwartet), n:gefiltert.length };
  })()`);
  r.check(`der gezogene Platz gilt auch in der normalen Ansicht (${sicht.n} Zeilen geprüft)`,
    sicht.gleich && sicht.n > 0);

  r.check('keine Konsolenfehler', A.errs.length === 0);
  if (A.errs.length) console.error(A.errs.slice(0, 5));
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
