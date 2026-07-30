/* END-TO-END: MERKMALE AM MATERIALSTAMMSATZ
   (Konzept docs/KONZEPT-MATERIALMERKMALE.md)

   Bisher hatte ein Material nur Freitext-Größen und frei benannte Felder.
   Damit ließ sich eine „Agilis NxT ND" nicht von einer „LD" unterscheiden —
   nicht weil die Texterkennung versagt, sondern weil es keinen Ort für das
   Unterscheidungsmerkmal gab.

   Geprüft wird der ganze Weg in der echten Oberfläche:
     1. Der Katalog ist geladen und die Klassenwahl steht im Editor.
     2. Die Klasse bestimmt, welche Felder erscheinen (ein Draht hat keine
        Kurvenform).
     3. Eingetragene Merkmale werden gespeichert und wieder angezeigt.
     4. Ein Klassenwechsel verliert keine schon eingetippte Handarbeit.
     5. Unplausible Werte werden gemeldet — aber NICHT abgelehnt.
     6. Zwei Varianten derselben Familie werden unterscheidbar.
     7. Fehlt der Katalog, bleibt die Maske exakt wie vorher.
     8. Der Foto-Assistent schlägt Merkmale aus demselben Etikettenfoto vor:
        Vorschlag statt Setzung, Frage bei Mehrdeutigem, Eingetragenes bleibt. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('matmerkmale');
  const check = (l, c) => r.check(l, c);
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);

  // ═══════════ 1. Katalog geladen ═══════════
  const kat = await A.page.evaluate(() => ({
    da: typeof MERKKAT !== 'undefined' && Array.isArray(MERKKAT.merkmale),
    merkmale: (MERKKAT && MERKKAT.merkmale || []).length,
    klassen: (MERKKAT && MERKKAT.klassen || []).length,
    grammatik: (MERKKAT && MERKKAT.ref_grammatik || []).length,
  }));
  check('Merkmalskatalog wird beim Start geladen', kat.da && kat.merkmale > 50);
  check(`… mit ${kat.klassen} Klassen und ${kat.grammatik} REF-Grammatiken`, kat.klassen > 20 && kat.grammatik > 5);

  // ═══════════ 2. Editor zeigt Klassenwahl und passende Felder ═══════════
  const editor = await A.page.evaluate(() => {
    doLogin('1234567');
    openScanItem('m:e2e-merk', true);
    const sel = document.getElementById('scMerkKlasse');
    if (!sel) return { keinSelect: true };
    const klassenImSelect = sel.options.length;

    // Führungskatheter -> Kurvenform und Seitenlöcher müssen erscheinen
    sel.value = 'fuehrungskatheter'; scanMerkKlasseWechsel();
    const fk = [...document.querySelectorAll('#scMerkFelder .merk-f')].map(e => e.dataset.mid);

    // Führungsdraht -> Kurvenform darf NICHT erscheinen, Drahtstärke schon
    sel.value = 'fuehrungsdraht'; scanMerkKlasseWechsel();
    const fd = [...document.querySelectorAll('#scMerkFelder .merk-f')].map(e => e.dataset.mid);

    return { klassenImSelect, fk, fd };
  });
  check('Editor bietet eine Materialklasse zur Wahl', !editor.keinSelect && editor.klassenImSelect > 20);
  check('Führungskatheter bringt Kurvenform und Seitenlöcher mit',
    editor.fk.includes('kurvenform') && editor.fk.includes('seitenloecher') && editor.fk.includes('ad_fr'));
  check('Führungsdraht bringt Drahtstärke, aber KEINE Kurvenform',
    editor.fd.includes('draht_in') && !editor.fd.includes('kurvenform'));
  check('allgemeine Merkmale gelten in beiden Klassen (steril)',
    editor.fk.includes('steril') && editor.fd.includes('steril'));

  // ═══════════ 3. Ausfüllen, speichern, wieder anzeigen ═══════════
  const gespeichert = await A.page.evaluate(() => {
    openScanItem('m:e2e-merk', true);
    document.getElementById('scHersteller').value = 'Medtronic';
    document.getElementById('scRef').value = 'LA6EBU40SH';
    document.getElementById('scName').value = 'Launcher 6F EBU 4.0 SH';
    const sel = document.getElementById('scMerkKlasse');
    sel.value = 'fuehrungskatheter'; scanMerkKlasseWechsel();
    const setz = (id, v) => { const e = document.querySelector(`#scMerkFelder .merk-f[data-mid="${id}"]`); if (e) e.value = v; };
    setz('ad_fr', '6'); setz('kurvenform', 'EBU4.0'); setz('seitenloecher', 'ja');
    setz('nutzlaenge_cm', '100');
    // id_mm bewusst NICHT setzen — die Lückenliste muss es melden
    saveScanItem('m:e2e-merk');
    const rec = GTINDB['m:e2e-merk'];
    return { klasse: rec && rec.klasse, merkmale: rec && rec.merkmale };
  });
  check('Klasse wird am Stammsatz gespeichert', gespeichert.klasse === 'fuehrungskatheter');
  check('Merkmale werden gespeichert',
    gespeichert.merkmale && gespeichert.merkmale.ad_fr === '6'
    && gespeichert.merkmale.kurvenform === 'EBU4.0'
    && gespeichert.merkmale.seitenloecher === 'ja'
    && gespeichert.merkmale.nutzlaenge_cm === '100');

  const ansicht = await A.page.evaluate(() => {
    openScanItem('m:e2e-merk', false);
    const t = document.getElementById('scr-scan-item').textContent;
    return { text: t };
  });
  check('Produktblatt zeigt den Merkmalsblock', ansicht.text.includes('MERKMALE'));
  check('… mit Beschriftung und Einheit („6 F")', ansicht.text.includes('6 F'));
  check('… und der Kurvenform', ansicht.text.includes('EBU4.0'));
  check('… und der Lückenliste als Arbeitsauftrag',
    ansicht.text.includes('Noch nicht erfasst') && ansicht.text.includes('Innendurchmesser'));

  // ═══════════ 4. Klassenwechsel verliert keine Handarbeit ═══════════
  const wechsel = await A.page.evaluate(() => {
    openScanItem('m:e2e-merk', true);
    const sel = document.getElementById('scMerkKlasse');
    // etwas Neues eintippen, DANN die Klasse wechseln
    const e = document.querySelector('#scMerkFelder .merk-f[data-mid="ad_fr"]');
    if (e) e.value = '7';
    sel.value = 'diagnostikkatheter'; scanMerkKlasseWechsel();
    const nach = document.querySelector('#scMerkFelder .merk-f[data-mid="ad_fr"]');
    return { adNachWechsel: nach ? nach.value : null };
  });
  check('Eingetipptes überlebt den Klassenwechsel', wechsel.adNachWechsel === '7');

  // ═══════════ 5. Unplausibles wird gemeldet, nicht abgelehnt ═══════════
  const unplausibel = await A.page.evaluate(() => {
    const meldungen = [];
    const echt = window.toast;
    window.toast = (m, err) => { meldungen.push(String(m)); if (echt) echt(m, err); };
    openScanItem('m:e2e-merk2', true);
    document.getElementById('scHersteller').value = 'Test';
    document.getElementById('scRef').value = 'TEST-1';
    const sel = document.getElementById('scMerkKlasse');
    sel.value = 'fuehrungskatheter'; scanMerkKlasseWechsel();
    const e = document.querySelector('#scMerkFelder .merk-f[data-mid="nutzlaenge_cm"]');
    if (e) e.value = '8';               // 8 cm ist keine Katheterlänge
    saveScanItem('m:e2e-merk2');
    window.toast = echt;
    const rec = GTINDB['m:e2e-merk2'];
    return { meldungen, gespeichert: rec && rec.merkmale && rec.merkmale.nutzlaenge_cm };
  });
  check('unplausibler Wert wird gemeldet',
    unplausibel.meldungen.some(m => m.includes('außerhalb')));
  check('… aber trotzdem gespeichert (das Etikett schlägt den Katalog)',
    unplausibel.gespeichert === '8');

  // ═══════════ 6. Der ND/LD-Fall: zwei Varianten werden unterscheidbar ═══════════
  const varianten = await A.page.evaluate(() => {
    const bau = (key, ref, curl) => {
      openScanItem(key, true);
      document.getElementById('scHersteller').value = 'Baylis Medical';
      document.getElementById('scRef').value = ref;
      document.getElementById('scName').value = 'SureFlex 8.5F';
      const sel = document.getElementById('scMerkKlasse');
      sel.value = 'schleuse'; scanMerkKlasseWechsel();
      const setz = (id, v) => { const e = document.querySelector(`#scMerkFelder .merk-f[data-mid="${id}"]`); if (e) e.value = v; };
      setz('schleuse_fr', '8.5'); setz('schleuse_laenge_cm', '72'); setz('curl', curl);
      saveScanItem(key);
    };
    bau('m:e2e-sfm', 'TSK3003', 'Medium Curl');
    bau('m:e2e-sfl', 'TSK3005', 'Large Curl');
    const a = GTINDB['m:e2e-sfm'], b = GTINDB['m:e2e-sfl'];
    return {
      curlA: a.merkmale.curl, curlB: b.merkmale.curl,
      frGleich: a.merkmale.schleuse_fr === b.merkmale.schleuse_fr,
      laengeGleich: a.merkmale.schleuse_laenge_cm === b.merkmale.schleuse_laenge_cm,
    };
  });
  check('zwei Varianten unterscheiden sich im Curl',
    varianten.curlA === 'Medium Curl' && varianten.curlB === 'Large Curl');
  check('… und sind in French und Länge identisch',
    varianten.frGleich && varianten.laengeGleich);

  // ═══════════ 7. Ohne Katalog bleibt alles wie vorher ═══════════
  const ohne = await A.page.evaluate(() => {
    const sicher = MERKKAT;
    MERKKAT = { merkmale: [], klassen: [], einheiten: {}, ref_grammatik: [], kompatibilitaet: { regeln: [] } };
    openScanItem('m:e2e-ohne', true);
    const hatSelect = !!document.getElementById('scMerkKlasse');
    const hatStandardfelder = !!document.getElementById('scHersteller') && !!document.getElementById('scRef');
    // Speichern darf auch ohne Katalog nicht scheitern
    document.getElementById('scHersteller').value = 'X';
    document.getElementById('scRef').value = 'Y';
    saveScanItem('m:e2e-ohne');
    const rec = GTINDB['m:e2e-ohne'];
    MERKKAT = sicher;
    return { hatSelect, hatStandardfelder, gespeichert: !!rec, klasse: rec && rec.klasse };
  });
  check('ohne Katalog erscheint kein Merkmalsblock', ohne.hatSelect === false);
  check('… die übrige Maske bleibt vollständig', ohne.hatStandardfelder === true);
  check('… und Speichern funktioniert unverändert', ohne.gespeichert && ohne.klasse === undefined);

  // ═══════════ 8. Der Foto-Assistent schlägt Merkmale vor ═══════════
  /* Kein zweites Foto, kein zweiter Handgriff: derselbe Etikettentext wird
     ein zweites Mal ausgewertet, diesmal nach Merkmalen. Vorgeschlagen —
     nicht gesetzt: mehrdeutiges fragt, Eingetragenes bleibt. */
  const assistent = await A.page.evaluate(() => {
    const meldungen = [];
    const echt = window.toast;
    window.toast = (m, err) => { meldungen.push(String(m)); if (echt) echt(m, err); };

    openScanItem('m:e2e-wiz', true);
    ocrWizStart();
    /* Schritt ② ohne Kamera: Etikettentext setzen wie nach der Texterkennung. */
    WIZ.text = `Launcher GUIDE CATHETER
      de Führungskatheter
      6Fr
      0.071 in
      EBU4.0
      SH
      REF Catalog number LA6EBU40SH
      Do not reuse
      STERILE EO Sterilized using ethylene oxide`;
    WIZ.fields = { ref: 'LA6EBU40SH', hersteller: 'Medtronic' };
    WIZ.refInfo = { wie: 'exakt', sicher: true, kandidaten: [] };
    WIZ.schritt = 2;
    wizMerkAuswerten();
    wizRender();
    const seite = document.getElementById('wizBody').textContent;
    const vorschlaege = (WIZ.merk && WIZ.merk.merkmale || []).length;
    const klasse = WIZ.merk && WIZ.merk.klasse;
    const dropKnopf = !!document.querySelector('#wizBody .wiz-drop');
    wizApply();
    const zu = !document.querySelector('#ocrWiz.show');
    const lese = (id) => { const e = document.querySelector(`#scMerkFelder .merk-f[data-mid="${id}"]`); return e ? e.value : null; };
    const selKlasse = (document.getElementById('scMerkKlasse') || {}).value;
    window.toast = echt;
    return { seite, vorschlaege, klasse, dropKnopf, zu, meldungen,
      adFr: lese('ad_fr'), kurve: lese('kurvenform'), steril: lese('steril'), selKlasse };
  });
  check('Assistent wertet den Etikettentext auch nach Merkmalen aus',
    assistent.vorschlaege >= 3 && assistent.klasse === 'fuehrungskatheter');
  check('… und zeigt sie auf der Prüfseite mit Herkunft',
    assistent.seite.includes('MERKMALE') && /beschriftetes Feld|aus der REF|Etikett/.test(assistent.seite));
  check('… jeder Vorschlag ist wegklickbar', assistent.dropKnopf);
  check('Übernehmen setzt die Klasse am Stammsatz',
    assistent.zu && assistent.selKlasse === 'fuehrungskatheter');
  check('… und füllt die Merkmalsfelder', assistent.adFr === '6' && assistent.kurve === 'EBU4.0');
  check('… und meldet, wie viel übernommen wurde',
    assistent.meldungen.some(m => /Merkmal/.test(m) && /Übernommen/.test(m)));

  const eingetragen = await A.page.evaluate(async () => {
    const meldungen = [];
    const echt = window.toast;
    window.toast = (m, err) => { meldungen.push(String(m)); if (echt) echt(m, err); };

    openScanItem('m:e2e-wiz2', true);
    /* Der Mensch war zuerst da: 7 F von Hand eingetragen. */
    const sel = document.getElementById('scMerkKlasse');
    sel.value = 'fuehrungskatheter'; scanMerkKlasseWechsel();
    document.querySelector('#scMerkFelder .merk-f[data-mid="ad_fr"]').value = '7';

    ocrWizStart();
    WIZ.text = `Launcher GUIDE CATHETER
      de Führungskatheter
      6Fr
      EBU4.0
      REF Catalog number LA6EBU40SH`;
    WIZ.fields = { ref: 'LA6EBU40SH' };
    WIZ.schritt = 2;
    wizMerkAuswerten();
    wizApply();
    const lese = (id) => { const e = document.querySelector(`#scMerkFelder .merk-f[data-mid="${id}"]`); return e ? e.value : null; };
    /* Die Abweichungsmeldung kommt bewusst verzögert (nach der Erfolgsmeldung). */
    await new Promise(f => setTimeout(f, 1200));
    window.toast = echt;
    return { adFr: lese('ad_fr'), kurve: lese('kurvenform'), meldungen };
  });
  check('Eingetragenes wird NICHT überschrieben (7 F bleibt 7 F)', eingetragen.adFr === '7');
  check('… leere Felder werden trotzdem gefüllt', eingetragen.kurve === 'EBU4.0');
  check('… und der Unterschied wird benannt, nicht stillschweigend aufgelöst',
    eingetragen.meldungen.some(m => m.includes('Abweichung')));

  const wahl = await A.page.evaluate(() => {
    openScanItem('m:e2e-wiz3', true);
    ocrWizStart();
    /* ROTAWIRE: 0.009" Schaft, 0.014" Spitze — beides gedruckt, keins „das" Maß. */
    WIZ.text = `ROTAWIRE Drive Guidewire
      Boston Scientific
      0.009 in
      0.014 in
      Sterile EO
      Single use`;
    WIZ.fields = {};
    WIZ.schritt = 2;
    wizMerkAuswerten();
    wizRender();
    const seite = document.getElementById('wizBody').textContent;
    const offen = (WIZ.merk.mehrdeutig || []).some(x => x.id === 'draht_in');
    const vorWahl = (WIZ.merk.merkmale || []).some(m => m.id === 'draht_in');
    wizPickMerk('draht_in', '0.014');
    const nachWahl = (WIZ.merk.merkmale || []).filter(m => m.id === 'draht_in')[0];
    wizApply();
    const feld = document.querySelector('#scMerkFelder .merk-f[data-mid="draht_in"]');
    return { seite, offen, vorWahl, gewaehlt: nachWahl && nachWahl.wert,
      herkunft: nachWahl && nachWahl.herkunft, imFeld: feld ? feld.value : null };
  });
  check('mehrdeutiges Merkmal wird zur Wahl gestellt, nicht gesetzt',
    wahl.offen && !wahl.vorWahl && wahl.seite.includes('bitte auswählen'));
  check('die Wahl des Menschen zählt als Entscheidung',
    wahl.gewaehlt === '0.014' && wahl.herkunft === 'mensch');
  check('… und landet beim Übernehmen im Formular', wahl.imFeld === '0.014');

  const ohneKat = await A.page.evaluate(() => {
    const sicher = MERKKAT;
    MERKKAT = { merkmale: [], klassen: [], einheiten: {}, ref_grammatik: [], kompatibilitaet: { regeln: [] } };
    openScanItem('m:e2e-wiz4', true);
    ocrWizStart();
    WIZ.text = 'Launcher GUIDE CATHETER 6Fr EBU4.0';
    WIZ.fields = { ref: 'LA6EBU40SH', hersteller: 'Medtronic' };
    WIZ.schritt = 2;
    wizMerkAuswerten();
    wizRender();
    const seite = document.getElementById('wizBody').textContent;
    const merk = WIZ.merk;
    wizApply();
    const ref = (document.getElementById('scRef') || {}).value;
    MERKKAT = sicher;
    return { seite, merk, ref, zu: !document.querySelector('#ocrWiz.show') };
  });
  check('ohne Katalog zeigt der Assistent keinen Merkmalsteil',
    ohneKat.merk === null && !ohneKat.seite.includes('MERKMALE'));
  check('… und die Feldübernahme läuft unverändert weiter',
    ohneKat.zu && ohneKat.ref === 'LA6EBU40SH');

  check('keine Konsolenfehler', A.errs.length === 0);
  if (A.errs.length) console.log('   ', A.errs.slice(0, 4));

  await r.finish(browser, [srv]);
})();
