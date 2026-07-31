/* END-TO-END: FACETTIERTE ÜBERSICHT

   Die Startseite war eine Liste von 47 Titeln mit Bindestrichen. Wer eine
   Prozedur vorbereitet, sucht darin nicht nach einem Titel, sondern nach
   Merkmalen. Geprüft wird:

     1. Die Merkmalsleiste steht über der Liste und zeigt Zähler.
     2. Ein Griff filtert wirklich — die Liste wird kürzer.
     3. Drei Griffe führen von 47 auf einen Standard.
     4. Jede Auswahl schränkt die übrigen Merkmale ein.
     5. Es steht immer da, wie viele von wie vielen übrig sind.
     6. Zurücksetzen führt zurück auf den vollen Bestand.
     7. Die Auswahl überlebt einen Neustart der App (und bleibt sichtbar).
     8. Die Merkmalsnamen sind ohne Programmierung änderbar.
     9. Ein leeres Ergebnis bietet den Ausweg an, statt ratlos zu lassen. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('facetten');
  const check = (l, c) => r.check(l, c);
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);

  // ═══════════ 1. Die Leiste ist da ═══════════
  const leiste = await A.page.evaluate(() => {
    setMode('use'); renderStandards('');
    const bar = document.querySelector('#scr-standards .facbar');
    const reihen = [...document.querySelectorAll('#scr-standards .fac-reihe')]
      .map(x => (x.querySelector('.fac-name') || {}).textContent);
    const chips = document.querySelectorAll('#scr-standards .facchip').length;
    const zaehler = document.querySelectorAll('#scr-standards .facchip .fac-n').length;
    return { da: !!bar, reihen, chips, zaehler,
      standards: document.querySelectorAll('#scr-standards .std').length };
  });
  check('die Merkmalsleiste steht über der Liste', leiste.da === true);
  check(`… mit den Merkmalsarten (${leiste.reihen.join(' · ')})`,
    leiste.reihen.includes('Bereich') && leiste.reihen.includes('Art') && leiste.reihen.includes('Hersteller'));
  check(`… und jedem Wert seine Trefferzahl (${leiste.chips} Werte)`,
    leiste.chips > 10 && leiste.zaehler > 10);
  check(`… über dem vollen Bestand (${leiste.standards} Standards)`, leiste.standards === 47);

  // ═══════════ 2./3./4./5. Drei Griffe ═══════════
  const griff1 = await A.page.evaluate(() => {
    const chip = [...document.querySelectorAll('#scr-standards .facchip')]
      .find(b => b.textContent.startsWith('TAVI'));
    if (!chip) return { kein: true };
    chip.click();
    const arten = [...document.querySelectorAll('#scr-standards .fac-reihe')]
      .find(x => (x.querySelector('.fac-name') || {}).textContent === 'Art');
    return { kein: false,
      standards: document.querySelectorAll('#scr-standards .std').length,
      aktiv: (document.querySelector('#scr-standards .fac-aktiv') || {}).textContent || '',
      artWerte: arten ? [...arten.querySelectorAll('.facchip')].map(b => b.firstChild.textContent) : [],
      herWerte: [...document.querySelectorAll('#scr-standards .fac-reihe')]
        .filter(x => (x.querySelector('.fac-name') || {}).textContent === 'Hersteller')
        .flatMap(x => [...x.querySelectorAll('.facchip')].map(b => b.firstChild.textContent)) };
  });
  check('ein Griff filtert die Liste (TAVI → 5)', !griff1.kein && griff1.standards === 5);
  check('… und über der Liste steht, wie viele von wie vielen',
    /5/.test(griff1.aktiv) && /47/.test(griff1.aktiv));
  check(`… die Arten sind eingeschränkt (${griff1.artWerte.join(' · ')})`,
    griff1.artWerte.length === 3 && griff1.artWerte.every(w => /^Trans/.test(w)));
  check(`… und die Hersteller auch (${griff1.herWerte.join(' · ')})`,
    griff1.herWerte.length === 3 && !griff1.herWerte.includes('Gore'));

  const griff23 = await A.page.evaluate(() => {
    const klick = (txt) => { const b = [...document.querySelectorAll('#scr-standards .facchip')]
      .find(x => x.firstChild.textContent === txt); if (b) b.click(); return !!b; };
    const ok2 = klick('Transfemoral');
    const n2 = document.querySelectorAll('#scr-standards .std').length;
    const ok3 = klick('Edwards');
    const n3 = document.querySelectorAll('#scr-standards .std').length;
    const titel = (document.querySelector('#scr-standards .std-title') || {}).textContent || '';
    return { ok2, n2, ok3, n3, titel };
  });
  check('zweiter Griff (Transfemoral → 3)', griff23.ok2 && griff23.n2 === 3);
  check('dritter Griff (Edwards → 1)', griff23.ok3 && griff23.n3 === 1);
  check(`… und es ist der richtige („${griff23.titel}")`, /Edwards/.test(griff23.titel));

  // ═══════════ 7. Die Auswahl überlebt einen Neustart ═══════════
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
  check('die Auswahl überlebt den Neustart', nachNeustart.standards === 1 && nachNeustart.an === 3);
  check('… und bleibt dabei unübersehbar', nachNeustart.hinweis === true);

  // ═══════════ 9. Leeres Ergebnis bietet den Ausweg ═══════════
  const leer = await B.page.evaluate(() => {
    /* Eine Kombination, die es nicht gibt. */
    facWaehle('art', 'Transapikal');       /* zusätzlich zu Transfemoral+Edwards */
    facZuruecksetzen();
    facWaehle('gruppe', 'TAVI');
    facWaehle('art', 'Rhythmia');          /* Rhythmia gibt es nur in EPU */
    const box = document.getElementById('scr-standards');
    return { n: box.querySelectorAll('.std').length,
      leerText: (box.querySelector('.empty') || {}).textContent || '',
      knopf: !![...box.querySelectorAll('button')].find(b => /Filter zurücksetzen/.test(b.textContent)) };
  });
  check('eine leere Auswahl lässt nicht ratlos zurück', leer.n === 0 && leer.knopf === true);
  check('… und sagt, woran es liegt', /Merkmale/.test(leer.leerText));

  // ═══════════ 6. Zurücksetzen ═══════════
  const zurueck = await B.page.evaluate(() => {
    const knopf = [...document.querySelectorAll('#scr-standards button')]
      .find(b => /Filter zurücksetzen/.test(b.textContent));
    if (knopf) knopf.click();
    return { standards: document.querySelectorAll('#scr-standards .std').length,
      aktiv: !!document.querySelector('#scr-standards .fac-aktiv') };
  });
  check('Zurücksetzen führt auf den vollen Bestand', zurueck.standards === 47 && !zurueck.aktiv);

  // ═══════════ 8. Namen ohne Programmierung ändern ═══════════
  const umbenannt = await B.page.evaluate(() => {
    doLogin('1234567');
    bezSetzen('facetten', 'art', 'Zugang');
    setMode('use'); renderStandards('');
    const namen = [...document.querySelectorAll('#scr-standards .fac-name')].map(x => x.textContent);
    bezSetzen('facetten', 'art', null);
    renderStandards('');
    const zurueck = [...document.querySelectorAll('#scr-standards .fac-name')].map(x => x.textContent);
    return { namen, zurueck };
  });
  check('die Merkmalsnamen sind ohne Programmierung änderbar', umbenannt.namen.includes('Zugang'));
  check('… und ein leeres Feld stellt die Vorgabe wieder her', umbenannt.zurueck.includes('Art'));

  check('keine Konsolenfehler', A.errs.length === 0);
  if (A.errs.length) console.log('   ', A.errs.slice(0, 4));

  await r.finish(browser, [srv]);
})();
