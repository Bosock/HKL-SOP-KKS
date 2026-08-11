/* END-TO-END: FACETTIERTE ÜBERSICHT

   Die Startseite war eine Liste von 47 Titeln mit Bindestrichen. Wer eine
   Prozedur vorbereitet, sucht darin nicht nach einem Titel, sondern nach
   Merkmalen.

   ── Was sich gegenüber der ersten Fassung geändert hat ──
   Die Leiste hatte fünf Merkmalsarten, drei davon aus dem Titel GERATEN:
   „Art", „Hersteller", „Ausprägung". Sie brachten dreißig Knöpfe mit, von
   denen die meisten genau einen Standard trafen — auf einem Handy die halbe
   Startseite für wenig Auskunft. Ansage des Betreibers: „der Bereich reicht
   als Filter!"

   Geblieben sind zwei Arten, die aus gepflegten Daten kommen (Bereich,
   Freigabe) — und jedes MERKMAL, das das Haus selbst anlegt. Genau das prüft
   diese Suite jetzt: dass die geratenen Arten weg sind UND dass der Ersatz
   trägt, also ein gepflegtes Merkmal wirklich als Reihe erscheint und filtert.

   Geprüft wird:
     1. Die Merkmalsleiste steht über der Liste und zeigt Zähler.
     2. Art, Hersteller und Ausprägung kommen NICHT zurück.
     3. Ein Griff filtert wirklich — die Liste wird kürzer.
     4. Die Auswahl überlebt einen Neustart der App (und bleibt sichtbar).
     5. Ein gepflegtes Merkmal wird zur zweiten Reihe und schränkt weiter ein.
     6. Es steht immer da, wie viele von wie vielen übrig sind.
     7. Ein leeres Ergebnis bietet den Ausweg an, statt ratlos zu lassen.
     8. Zurücksetzen führt zurück auf den vollen Bestand.
     9. Die Merkmalsnamen sind ohne Programmierung änderbar. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('facetten');
  const check = (l, c) => r.check(l, c);
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);

  // ═══════════ 1./2. Die Leiste ist da — und schlank ═══════════
  const leiste = await A.page.evaluate(() => {
    setMode('use'); renderStandards('');
    const bar = document.querySelector('#scr-standards .facbar');
    const reihen = [...document.querySelectorAll('#scr-standards .fac-reihe')]
      .map(x => (x.querySelector('.fac-name') || {}).textContent);
    const chips = document.querySelectorAll('#scr-standards .facchip').length;
    const zaehler = document.querySelectorAll('#scr-standards .facchip .fac-n').length;
    return { da: !!bar, reihen, chips, zaehler,
      arten: facArten().map(a => a.key),
      standards: document.querySelectorAll('#scr-standards .std').length };
  });
  check('die Merkmalsleiste steht über der Liste', leiste.da === true);
  check(`… mit den Merkmalsarten (${leiste.reihen.join(' · ')})`,
    leiste.reihen.includes('Bereich'));
  check('… und OHNE die aus dem Titel geratenen (Art · Hersteller · Ausprägung)',
    !['art', 'hersteller', 'auspraegung'].some(k => leiste.arten.includes(k)) &&
    !leiste.reihen.some(n => /^(Art|Hersteller|Ausprägung)$/.test(n)));
  check(`… und jedem Wert seine Trefferzahl (${leiste.chips} Werte)`,
    leiste.chips > 3 && leiste.zaehler === leiste.chips);
  check(`… über dem vollen Bestand (${leiste.standards} Standards)`, leiste.standards === 47);

  // ═══════════ 3./6. Ein Griff ═══════════
  const griff1 = await A.page.evaluate(() => {
    /* Der meistbesetzte Bereich — nicht fest verdrahtet, damit der Test auch
       nach einer Umbenennung im Haus noch dasselbe prüft. */
    const reihe = [...document.querySelectorAll('#scr-standards .fac-reihe')]
      .find(x => (x.querySelector('.fac-name') || {}).textContent === 'Bereich');
    if (!reihe) return { kein: true };
    const chip = reihe.querySelector('.facchip');
    const wort = chip.firstChild.textContent;
    const erwartet = +(chip.querySelector('.fac-n').textContent);
    chip.click();
    return { kein: false, wort, erwartet,
      standards: document.querySelectorAll('#scr-standards .std').length,
      aktiv: (document.querySelector('#scr-standards .fac-aktiv') || {}).textContent || '' };
  });
  check(`ein Griff filtert die Liste (${griff1.wort} → ${griff1.standards})`,
    !griff1.kein && griff1.standards === griff1.erwartet &&
    griff1.standards > 0 && griff1.standards < 47);
  check('… und über der Liste steht, wie viele von wie vielen',
    new RegExp('\\b' + griff1.standards + '\\b').test(griff1.aktiv) && /47/.test(griff1.aktiv));

  // ═══════════ 4. Die Auswahl überlebt einen Neustart ═══════════
  /* Neu LADEN, nicht neuer Kontext: Ein frischer Browser-Kontext hätte einen
     leeren Speicher — dann prüfte der Test nur sich selbst. */
  await A.page.reload({ waitUntil: 'networkidle' });
  await A.page.waitForFunction(
    () => typeof DB !== 'undefined' && DB && DB.standards && DB.standards.length > 0,
    { timeout: 15000 });
  const B = A;
  const nachNeustart = await B.page.evaluate(() => {
    setMode('use'); renderStandards('');
    return { standards: document.querySelectorAll('#scr-standards .std').length,
      hinweis: !!document.querySelector('#scr-standards .fac-aktiv'),
      an: document.querySelectorAll('#scr-standards .facchip.on').length };
  });
  check('die Auswahl überlebt den Neustart',
    nachNeustart.standards === griff1.standards && nachNeustart.an === 1);
  check('… und bleibt dabei unübersehbar', nachNeustart.hinweis === true);

  // ═══════════ 5. Der Ersatz für die geratenen Arten ═══════════
  /* Wer feiner unterteilen will, legt ein MERKMAL an. Das kommt aus Daten und
     nicht aus einer Vermutung über einen Titel — und steht automatisch mit in
     der Leiste. Ohne diesen Nachweis wäre Punkt 2 eine reine Wegnahme. */
  const eigen = await B.page.evaluate(() => {
    doLogin('1234567');
    const e = eigAnlegen('Zugangsweg', 'auswahl');
    eigAendern(e.key, 'werte', ['Femoral', 'Radial']);
    const bereich = FACWAHL.gruppe[0];
    const posten = facPosten();
    const drin = posten.filter(p => (p.merkmale.gruppe || [])[0] === bereich).map(p => p.id);
    const raus = posten.filter(p => (p.merkmale.gruppe || [])[0] !== bereich).map(p => p.id);
    eigSetzen(drin[0], e.key, 'Femoral');
    eigSetzen(raus[0], e.key, 'Radial');
    facCacheLeeren();
    /* Ohne Vorauswahl ansehen: Bei aktivem Bereichsfilter bliebe von „Zugangsweg"
       nur EIN Wert übrig — und eine Art mit einem einzigen Wert unterscheidet
       nichts, die Leiste bietet sie deshalb bewusst nicht an. */
    facZuruecksetzen();
    setMode('use'); renderStandards('');
    const reihen = [...document.querySelectorAll('#scr-standards .fac-reihe')]
      .map(x => (x.querySelector('.fac-name') || {}).textContent);
    facWaehle('gruppe', bereich);
    facWaehle('eig:' + e.key, 'Femoral');
    const eng = document.querySelectorAll('#scr-standards .std').length;
    return { key: e.key, reihen, eng, drin: drin.length, raus: raus.length };
  });
  check(`ein gepflegtes Merkmal wird zur eigenen Reihe (${eigen.reihen.join(' · ')})`,
    eigen.reihen.includes('Zugangsweg'));
  check(`… und schränkt weiter ein (${griff1.standards} → ${eigen.eng})`, eigen.eng === 1);

  // ═══════════ 7. Leeres Ergebnis bietet den Ausweg ═══════════
  const leer = await B.page.evaluate((k) => {
    /* Eine Kombination, die es nicht gibt: der gewählte Bereich UND ein Wert,
       den nur ein Standard AUSSERHALB dieses Bereichs trägt. */
    facWaehle(k, 'Femoral');            /* die eben gesetzte Wahl wieder ab */
    facWaehle(k, 'Radial');
    const box = document.getElementById('scr-standards');
    return { n: box.querySelectorAll('.std').length,
      leerText: (box.querySelector('.empty') || {}).textContent || '',
      knopf: !![...box.querySelectorAll('button')].find(b => /Filter zurücksetzen/.test(b.textContent)) };
  }, 'eig:' + eigen.key);
  check('eine leere Auswahl lässt nicht ratlos zurück', leer.n === 0 && leer.knopf === true);
  check('… und sagt, woran es liegt', /Merkmale/.test(leer.leerText));

  // ═══════════ 8. Zurücksetzen ═══════════
  const zurueck = await B.page.evaluate(() => {
    const knopf = [...document.querySelectorAll('#scr-standards button')]
      .find(b => /Filter zurücksetzen/.test(b.textContent));
    if (knopf) knopf.click();
    return { standards: document.querySelectorAll('#scr-standards .std').length,
      aktiv: !!document.querySelector('#scr-standards .fac-aktiv') };
  });
  check('Zurücksetzen führt auf den vollen Bestand', zurueck.standards === 47 && !zurueck.aktiv);

  // ═══════════ 9. Namen ohne Programmierung ändern ═══════════
  const umbenannt = await B.page.evaluate(() => {
    doLogin('1234567');
    bezSetzen('facetten', 'gruppe', 'Fachbereich');
    setMode('use'); renderStandards('');
    const namen = [...document.querySelectorAll('#scr-standards .fac-name')].map(x => x.textContent);
    bezSetzen('facetten', 'gruppe', null);
    renderStandards('');
    const zurueck = [...document.querySelectorAll('#scr-standards .fac-name')].map(x => x.textContent);
    return { namen, zurueck };
  });
  check('die Merkmalsnamen sind ohne Programmierung änderbar', umbenannt.namen.includes('Fachbereich'));
  check('… und ein leeres Feld stellt die Vorgabe wieder her', umbenannt.zurueck.includes('Bereich'));

  check('keine Konsolenfehler', A.errs.length === 0);
  if (A.errs.length) console.log('   ', A.errs.slice(0, 4));

  await r.finish(browser, [srv]);
})();
