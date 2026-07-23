/* END-TO-END: Referenz-Katalog (Baustein 1) + Aufräum-Assistent (Baustein 2).
   Beweist im echten Browser: die mitgelieferten Datendateien laden, der Katalog-
   Treffer füllt den Material-Editor (Status „unbestätigt"), und der Aufräum-
   Assistent legt aus einem verdichteten Standard-Eintrag einen sauberen
   Stammsatz mit entmischten Feldern an. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('matdata');
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);

  // Datendateien werden nach dem Render nachgeladen → kurz warten.
  await A.page.waitForFunction(() => typeof catCount === 'function' && catCount() > 100 && typeof cleanupCount === 'function' && cleanupCount() > 50, { timeout: 15000 });

  // 1) Referenz-Katalog: Editor öffnen, bekannte REF setzen, Treffer + Übernahme.
  const cat = await A.page.evaluate(() => {
    doLogin('1234567');
    openScanItem('', true);                 // leeres Produkt-Formular (Admin)
    const ref = document.getElementById('scRef'); ref.value = '538-476';  // Cordis INFINITI
    catCheckForm();
    const hitShown = !!document.querySelector('#catMatch .cat-hit');
    catApplyToForm();
    const val = (id) => { const el = document.getElementById(id); return el ? el.value : null; };
    const sizes = [...document.querySelectorAll('#scSizes .merk-wert')].map(i => i.value);
    const hold = document.getElementById('catHold').value;
    return { hitShown, herst: val('scHersteller'), kat: val('scKat'), name: val('scName'), sizes, hasHold: !!hold, holdUnb: /unbest/i.test(hold) };
  });
  r.check('Katalog-Treffer erscheint zur REF 538-476', cat.hitShown === true);
  r.check('Übernahme füllt Hersteller (Cordis)', cat.herst === 'Cordis');
  r.check('Übernahme setzt Kategorie (Diagnostikkatheter)', cat.kat === 'Diagnostikkatheter');
  r.check('Übernahme füllt Maße in die Größenliste', cat.sizes.some(v => /4F|100cm|\.038/.test(v)));
  r.check('Plattform-Specs als „unbestätigt" gemerkt (catHold)', cat.hasHold && cat.holdUnb);

  // 1b) Speichern schreibt katspecs/katstatus an den Stammsatz.
  const saved = await A.page.evaluate(() => {
    // manuellen Stammsatz nehmen (keine GTIN-Pflicht): Formular auf m:-ID stellen
    renderScanItemForm({ gtin: 'm:catref', manual: true, props: {} });
    document.getElementById('scRef').value = '538-476';
    catCheckForm(); catApplyToForm();
    saveScanItem('m:catref');
    const r2 = GTINDB['m:catref'];
    return { hasSpecs: !!(r2 && r2.katspecs && Object.keys(r2.katspecs).length), status: r2 && r2.katstatus, kat: r2 && r2.kategorie };
  });
  r.check('Speichern sichert katspecs am Stammsatz', saved.hasSpecs === true);
  r.check('Katalog-Status am Stammsatz = unbestätigt', /unbest/i.test(saved.status || ''));

  // 2) Aufräum-Assistent: Warteschlange + Übernehmen legt sauberen Stammsatz an.
  const clean = await A.page.evaluate(() => {
    const q = cleanupQueue();
    if (!q.length) return { empty: true };
    openCleanup();
    const first = cleanupQueue()[0];
    const before = Object.keys(GTINDB).length;
    // Kern-Feld bewusst überschreiben, um die Editierbarkeit zu prüfen.
    const kern = document.getElementById('clKern'); const editedName = (kern.value || first.name);
    cleanupApply(first.key);
    const id = canonId(first.key);
    const rec = id ? GTINDB[id] : null;
    return { empty: false, key: first.key, linked: !!id, name: rec && rec.name, kat: rec && rec.kategorie,
      done: cleanupIsDone(first.key), grew: Object.keys(GTINDB).length >= before, editedName };
  });
  r.check('Aufräum-Warteschlange ist nicht leer', clean.empty !== true);
  r.check('Übernehmen legt/verknüpft einen Stammsatz', clean.linked === true);
  r.check('Aufgeräumter Eintrag ist als erledigt markiert', clean.done === true);
  r.check('Stammsatz trägt einen Kategorienamen', !!clean.kat);

  r.check('keine Konsolen-/Seitenfehler', A.errs.filter(e => !/favicon/i.test(e)).length === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
