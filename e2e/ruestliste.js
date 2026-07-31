/* END-TO-END: RÜSTLISTE

   Die Frage vor jedem Eingriff ist nicht „was steht im Standard?", sondern
   „was hole ich WOHER — und in welcher Reihenfolge?". Der Standard beantwortet
   das nicht: Er ist nach der Word-Vorlage gegliedert, Material aus Lager, Saal,
   Vorbereitungsraum und Reserve steht gemischt.

   Geprüft wird:
     1. Die Rüstliste ist aus jedem Standard erreichbar.
     2. Sie bündelt nach Standort — ein Weg je Ort.
     3. Sie trennt Reserve („auf Ansage") vom Vorzubereitenden.
     4. Sie wirkt SOFORT, ohne vorherige Aufräumarbeit — die Ordnung steckt
        schon in den Unterkategorien.
     5. Eine bestätigte Zerlegung verbessert sie zusätzlich.
     6. Die Häkchen sind DIESELBEN wie im Standard (keine zweite Liste).
     7. Tätigkeiten werden nicht gerüstet.
     8. Der Rückweg führt in den Standard zurück. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('ruestliste');
  const check = (l, c) => r.check(l, c);
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);

  // ═══════════ 1./2./3./4. Aufbau am echten Bestand ═══════════
  const bau = await A.page.evaluate(() => {
    // Den Standard mit den meisten Materialzeilen nehmen
    let best = null;
    DB.standards.forEach(s => {
      const l = ruestBauen(s.id);
      if (!best || l.gesamt > best.z.gesamt) best = { sid: s.id, titel: stdTitel(s), z: l };
    });
    const z = ruestZahlen(best.z);
    const orte = Object.keys(best.z.lager);
    return { sid: best.sid, titel: best.titel, z, orte,
      beispielOrt: orte[0] || null,
      erstesLager: orte.length ? best.z.lager[orte[0]][0] : null,
      ansageBeispiel: best.z.ansage[0] || null };
  });
  check(`Rüstliste entsteht aus dem Bestand (${bau.z.gesamt} Zeilen)`, bau.z.gesamt > 20);
  check(`… gebündelt nach Standort (${bau.z.orte} Wege)`, bau.z.orte >= 2);
  check(`… mit Reserve getrennt (${bau.z.ansage} auf Ansage)`, typeof bau.z.ansage === 'number');
  check('… und das OHNE vorherige Aufräumarbeit', bau.z.lager > 0);
  check('… die Ortsnamen sind lesbar, nicht die rohe Unterkategorie',
    !!bau.beispielOrt && !/^material aus/i.test(bau.beispielOrt));

  // ═══════════ Einstieg aus dem Standard ═══════════
  const einstieg = await A.page.evaluate((sid) => {
    setMode('use'); openStandard(sid);
    const knopf = document.querySelector('#scr-rubriken .ruest-btn');
    const txt = knopf ? knopf.textContent : '';
    if (knopf) knopf.click();
    const aktiv = (document.querySelector('.screen.active') || {}).id;
    const inhalt = document.getElementById('scr-ruest').textContent;
    return { knopf: !!knopf, txt, aktiv,
      hatLager: inhalt.includes('Aus dem Lager holen'),
      hatTisch: inhalt.includes('Auf den Tisch'),
      hatReserve: inhalt.includes('Nur auf Ansage'),
      warnt: inhalt.includes('Nicht vorbereiten') };
  }, bau.sid);
  check('jeder Standard hat einen Einstieg in die Rüstliste', einstieg.knopf && /Rüstliste/.test(einstieg.txt));
  check('… und sie öffnet sich', einstieg.aktiv === 'scr-ruest');
  check('… mit den drei Fächern Lager · Tisch · Ansage',
    einstieg.hatLager && (einstieg.hatTisch || einstieg.hatReserve));
  check('Reserve wird ausdrücklich NICHT zum Vorbereiten empfohlen',
    !einstieg.hatReserve || einstieg.warnt);

  // ═══════════ 6. Häkchen sind dieselben wie im Standard ═══════════
  const haken = await A.page.evaluate((sid) => {
    openRuestliste(sid);
    const zeile = document.querySelector('#scr-ruest .rl-zeile');
    if (!zeile) return { keine: true };
    const cid = zeile.dataset.cid;
    const vorher = !!checks[cid];
    zeile.click();
    const nachKlick = !!checks[cid];
    // … und im Standard sichtbar?
    const p = cid.split('|');
    setMode('use'); openStandard(p[0]); openRubrik(+p[1]);
    const imStd = document.getElementById('e-' + cid);
    const dortAbgehakt = !!(imStd && imStd.classList.contains('done'));
    // wieder zurücknehmen
    openRuestliste(sid);
    const z2 = document.querySelector(`#scr-ruest .rl-zeile[data-cid="${cid}"]`);
    if (z2) z2.click();
    return { keine: false, cid, vorher, nachKlick, dortAbgehakt, zurueck: !!checks[cid] };
  }, bau.sid);
  check('Abhaken in der Rüstliste setzt das Häkchen', !haken.keine && haken.nachKlick !== haken.vorher);
  check('… und es steht im Standard genauso da (keine zweite Liste)',
    haken.keine || haken.dortAbgehakt === true);
  check('… und lässt sich wieder zurücknehmen', haken.keine || haken.zurueck === false);

  // ═══════════ 5./7. Zerlegung verbessert; Tätigkeit fällt raus ═══════════
  const zerl = await A.page.evaluate((sid) => {
    doLogin('1234567');
    // Eine Materialzeile mit Ort bestätigen und prüfen, dass sie dort landet
    const s = DB.standards.find(x => x.id === sid);
    let treffer = null, tun = null;
    (s.rubriken || []).forEach((rr, ri) => {
      if (rr.typ !== 'material' && rr.typ !== 'geraete') return;
      (rr.sub_bereiche || []).forEach((sb, si) => (sb.eintraege || []).forEach((e, ei) => {
        if (e.ist_fliesstext || e.natur === 'ueberschrift') return;
        const z = zerlege(e, ZERLKAT);
        if (!treffer && z.art === 'produkt' && z.produkt) treffer = { e, cid: cidOf(s.id, ri, si, ei), z };
        if (!tun && z.art === 'taetigkeit') tun = { e, cid: cidOf(s.id, ri, si, ei) };
      }));
    });
    const out = {};
    if (treffer) {
      zerlBestaetigen(zerlTextKey(treffer.e), {
        art: 'produkt', produkt: treffer.z.produkt, ort: 'E2E-Schrank', bedingung: null });
      const l = ruestBauen(sid);
      out.eigenerOrt = Object.keys(l.lager).includes('E2E-Schrank');
    }
    /* Eine Tätigkeit prüfen, die TATSÄCHLICH in der Rüstliste steht — sonst
       misst der Test nichts. Viele Tätigkeiten stehen in Ablauf-Rubriken und
       tauchen dort ohnehin nie auf. */
    const liste = ruestBauen(sid);
    const alleCids = [].concat(
      ...Object.keys(liste.lager).map(o => liste.lager[o]), liste.tisch, liste.ansage
    ).map(x => x.cid);
    let drin = null;
    alleCids.forEach(cid => {
      if (drin) return;
      const e = findEntry(cid);
      if (!e) return;
      const z = zerlege(e, ZERLKAT);
      if (z.art === 'taetigkeit' || z.art === 'unklar') drin = { cid, e };
    });
    if (drin) {
      const vorher = ruestBauen(sid).gesamt;
      zerlBestaetigen(zerlTextKey(drin.e), { art: 'taetigkeit', produkt: null });
      out.tunRaus = ruestBauen(sid).gesamt < vorher;
      out.tunText = drin.e.anzeige_text;
    } else out.tunRaus = null;
    return out;
  }, bau.sid);
  check('eine bestätigte Zerlegung setzt den Ort in der Rüstliste', zerl.eigenerOrt === true);
  check(`… und eine bestätigte Tätigkeit fällt aus der Rüstliste${zerl.tunText?` („${zerl.tunText.slice(0,34)}…")`:''}`,
    zerl.tunRaus === null || zerl.tunRaus === true);

  // ═══════════ 8. Rückweg ═══════════
  const zurueck = await A.page.evaluate((sid) => {
    openRuestliste(sid);
    const vor = (document.querySelector('.screen.active') || {}).id;
    goBack();
    return { vor, nach: (document.querySelector('.screen.active') || {}).id };
  }, bau.sid);
  check('Zurück führt in den Standard, nicht in die Übersicht',
    zurueck.vor === 'scr-ruest' && zurueck.nach === 'scr-rubriken');

  check('keine Konsolenfehler', A.errs.length === 0);
  if (A.errs.length) console.log('   ', A.errs.slice(0, 4));

  await r.finish(browser, [srv]);
})();
