/* END-TO-END: ZERLEGUNG UND AUFRÄUM-ASSISTENT

   Der Kernbefund der Systemanalyse: Eine Word-Tabellenzeile beschreibt vier
   Sachverhalte gleichzeitig, die App hat daraus EIN Ding gemacht — und dieses
   Ding wurde zur Identität des Materials. Deshalb ist „Raumkontrolle" ein
   Gerät und Heparin fünf verschiedene Materialien.

   Geprüft wird der ganze Weg in der echten Oberfläche:
     1. Regelwerk und Engine sind geladen.
     2. Der kanonische Schlüssel wirkt im Materialindex.
     3. Tätigkeiten verschwinden aus dem Materialbestand.
     4. Gleiche Produkte in verschiedenen Größen sind EIN Material.
     5. Der Assistent zeigt die Zerlegung und arbeitet nach Wirkung sortiert.
     6. Eine Entscheidung gilt für ALLE Stellen mit demselben Text.
     7. Entscheidungen sind zurücknehmbar (nicht-destruktiv).
     8. Alt-Verknüpfungen verwaisen NICHT.
     9. Ohne Regelwerk verhält sich alles wie vorher. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('zerlegung');
  const check = (l, c) => r.check(l, c);
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);

  // ═══════════ 1. Regelwerk geladen ═══════════
  const kat = await A.page.evaluate(() => ({
    da: typeof ZERLKAT !== 'undefined' && Array.isArray(ZERLKAT.putzen),
    verben: ((ZERLKAT.taetigkeit || {}).verben || []).length,
    artefakte: (ZERLKAT.artefakte || []).length,
    bereit: typeof matKeyBereit === 'function' && matKeyBereit(),
  }));
  check('Zerlegungs-Regelwerk wird beim Start geladen', kat.da && kat.verben > 30);
  check('… mit den bekannten Import-Artefakten', kat.artefakte >= 5);
  check('… und die Brücke meldet sich einsatzbereit', kat.bereit === true);

  // ═══════════ 2./3./4. Wirkung auf den Bestand ═══════════
  const bilanz = await A.page.evaluate(() => {
    const b = matKeyBilanz();
    // Raumkontrolle: 44× im Bestand, heute als Gerät geführt
    let raumProdukt = 0, raumGesamt = 0;
    DB.standards.forEach(s => (s.rubriken || []).forEach((rr, ri) =>
      (rr.sub_bereiche || []).forEach((sb, si) => (sb.eintraege || []).forEach((e, ei) => {
        if (!/Raumkontrolle/i.test(e.anzeige_text || '')) return;
        raumGesamt++;
        if (effMatKey(e, cidOf(s.id, ri, si, ei))) raumProdukt++;
      }))));
    // Peel-Off-Schleuse in verschiedenen Größen
    const schleusen = {};
    DB.standards.forEach(s => (s.rubriken || []).forEach((rr, ri) =>
      (rr.sub_bereiche || []).forEach((sb, si) => (sb.eintraege || []).forEach((e, ei) => {
        if (!/Peel-Off-Schleuse/i.test(e.anzeige_text || '')) return;
        const k = effMatKey(e, cidOf(s.id, ri, si, ei));
        if (k) schleusen[k] = (schleusen[k] || 0) + 1;
      }))));
    return { b, raumProdukt, raumGesamt, schleusenKeys: Object.keys(schleusen).length };
  });
  check(`Bilanz über den Bestand (${bilanz.b.eintraege} Zeilen) wird berechnet`, bilanz.b.eintraege > 1500);
  check(`Zerlegung fasst Materialschlüssel zusammen (${bilanz.b.altKeys} → ${bilanz.b.produktKeys})`,
    bilanz.b.produktKeys > 0 && bilanz.b.produktKeys < bilanz.b.altKeys);
  check(`… erkennt ${bilanz.b.taetigkeiten} Zeilen als Tätigkeit`, bilanz.b.taetigkeiten > 100);
  check(`… und weist die noch offenen ehrlich aus (${bilanz.b.offen})`, typeof bilanz.b.offen === 'number');
  check(`„Raumkontrolle" (${bilanz.raumGesamt}×) ist kein Material mehr`,
    bilanz.raumGesamt >= 40 && bilanz.raumProdukt === 0);
  check('Peel-Off-Schleuse ist EIN Material statt eines je Größe',
    bilanz.schleusenKeys === 1);

  // ═══════════ 5. Der Assistent ═══════════
  const ass = await A.page.evaluate(() => {
    doLogin('1234567');
    openCleanup();
    const sichtbar = document.getElementById('scr-cleanup').classList.contains('active');
    const t = document.getElementById('scr-cleanup').textContent;
    const q = cleanupQueue();
    const st = cleanupStats();
    return {
      sichtbar, hatRoh: t.includes('So steht es heute im Standard'),
      hatArtwahl: !!document.querySelector('.cl-art'),
      hatProduktfeld: !!document.getElementById('clKern'),
      hatGroesse: !!document.getElementById('clGroesse'),
      erstesUnklar: q.length ? q[0].unklar : null,
      queue: q.length, total: st.total, stellen: st.stellen,
      spur: !!document.querySelector('.cl-spur'),
    };
  });
  check('Assistent öffnet sich', ass.sichtbar && ass.hatRoh);
  check('… bietet die Art zur Wahl (Produkt · Tätigkeit · Hinweis)', ass.hatArtwahl);
  check('… mit getrennten Feldern für Produkt und Größe', ass.hatProduktfeld && ass.hatGroesse);
  check('… zeigt die Begründung („Warum so?")', ass.spur);
  check('… und sortiert nach Wirkung: Unklares zuerst', ass.erstesUnklar === true);
  check(`… über ${ass.total} Texte statt ${ass.stellen} Einzelstellen`,
    ass.total > 0 && ass.total < ass.stellen);

  // ═══════════ 6. Eine Entscheidung gilt überall ═══════════
  const ueberall = await A.page.evaluate(() => {
    // Einen Text mit vielen Stellen suchen und entscheiden
    const q = cleanupQueue();
    const viele = q.filter(g => g.stellen >= 3)[0];
    if (!viele) return { keine: true };
    // Position im Assistenten auf diesen Text stellen
    cleanupIdx = q.indexOf(viele);
    renderCleanup();
    document.getElementById('clKern').value = 'E2E-Testprodukt';
    document.getElementById('clGroesse').value = '';
    cleanupSetArt('produkt');
    cleanupApply(viele.tkey);
    // Wirkung prüfen: alle Stellen dieses Textes tragen jetzt denselben Schlüssel
    const keys = new Set();
    viele.cids.forEach(cid => { const e = findEntry(cid); if (e) keys.add(effMatKey(e, cid)); });
    return { stellen: viele.stellen, keys: [...keys], tkey: viele.tkey, offenNach: cleanupStats().offen };
  });
  check('eine Entscheidung wirkt auf alle Stellen mit demselben Text',
    !ueberall.keine && ueberall.keys.length === 1 && ueberall.keys[0] === 'e2e testprodukt');
  check(`… und der Fortschritt zählt sie als EINE Entscheidung (${ueberall.stellen} Stellen)`,
    ueberall.stellen >= 3);

  // ═══════════ 7. Zurücknehmbar ═══════════
  const zurueck = await A.page.evaluate((tkey) => {
    const vorher = Object.keys(ZERLDB).length;
    zerlVerwerfen(tkey);
    const nachher = Object.keys(ZERLDB).length;
    // Der Schlüssel fällt auf den Vorschlag zurück
    const q = cleanupQueue();
    return { vorher, nachher, wiederOffen: q.some(g => g.tkey === tkey) };
  }, ueberall.tkey);
  check('eine Entscheidung lässt sich einzeln zurücknehmen',
    zurueck.nachher === zurueck.vorher - 1 && zurueck.wiederOffen === true);

  // ═══════════ 8. Alt-Verknüpfungen verwaisen nicht ═══════════
  const alt = await A.page.evaluate(() => {
    // Stammsatz unter einer ALTEN Schreibweise verknüpfen …
    const id = matCreateStamm('E2E Altprodukt');
    let altKey = null, e0 = null, cid0 = null;
    DB.standards.forEach(s => (s.rubriken || []).forEach((rr, ri) => {
      if (rr.typ !== 'material' && rr.typ !== 'geraete') return;
      (rr.sub_bereiche || []).forEach((sb, si) => (sb.eintraege || []).forEach((e, ei) => {
        if (altKey || !e.material_key || e.ist_fliesstext) return;
        const cid = cidOf(s.id, ri, si, ei);
        const k = effMatKey(e, cid);
        if (k && k !== e.material_key) { altKey = e.material_key; e0 = e; cid0 = cid; }
      }));
    }));
    if (!altKey) return { keine: true };
    matLinkTo(altKey, id);
    matKeyCacheLeeren();
    // … und über den NEUEN kanonischen Schlüssel wiederfinden
    const neu = effMatKey(e0, cid0);
    return { altKey, neu, gefunden: canonId(neu) === id };
  });
  check('ein unter der alten Schreibweise verknüpfter Stammsatz bleibt auffindbar',
    alt.keine || alt.gefunden === true);

  // ═══════════ 9. Ohne Regelwerk wie vorher ═══════════
  const ohne = await A.page.evaluate(() => {
    const sicher = ZERLKAT;
    ZERLKAT = { putzen: [], artefakte: [], taetigkeit: {}, bedingung: {}, anweisung: {},
      ort: {}, ziel: {}, zweck: {}, alternative: {}, menge: {}, farbe: {}, praeparat: {},
      eigenschaft: {}, mass: {}, kern: {}, art_regeln: {} };
    matKeyCacheLeeren();
    const bereit = matKeyBereit();
    // Der Schlüssel fällt auf material_key zurück
    let gleich = true;
    DB.standards.slice(0, 3).forEach(s => (s.rubriken || []).forEach((rr, ri) =>
      (rr.sub_bereiche || []).forEach((sb, si) => (sb.eintraege || []).forEach((e, ei) => {
        if (!e.material_key || e.ist_fliesstext) return;
        if (effMatKey(e, cidOf(s.id, ri, si, ei)) !== e.material_key) gleich = false;
      }))));
    openCleanup();
    const meldung = document.getElementById('scr-cleanup').textContent;
    ZERLKAT = sicher; matKeyCacheLeeren(); buildMaterialIndex();
    return { bereit, gleich, meldung };
  });
  check('ohne Regelwerk meldet sich die Brücke als nicht einsatzbereit', ohne.bereit === false);
  check('… und jeder Schlüssel ist exakt der alte material_key', ohne.gleich === true);
  check('… der Assistent erklärt das, statt leer zu bleiben',
    ohne.meldung.includes('Zerlegungs-Regeln fehlen'));

  // ═══════════ 10. Beinah-Dubletten (Tippfehler) ═══════════
  const dub = await A.page.evaluate(() => {
    mode = 'care'; renderCare(); show('scr-care');
    const paare = mcDubletten();
    mcGo('dubletten');
    const txt = document.getElementById('scr-care').textContent;
    const ersteA = paare.length ? paare[0].a : null;
    const ersteB = paare.length ? paare[0].b : null;
    let nachMerge = null, gleicherStamm = false;
    if (ersteA && ersteB) {
      mcDublettenMerge(ersteA, ersteB);
      gleicherStamm = !!(canonId(ersteA) && canonId(ersteA) === canonId(ersteB));
      nachMerge = mcDubletten().length;
    }
    return { anzahl: paare.length, txt, vorher: paare.length, nachMerge, gleicherStamm,
      erste: ersteA && ersteB ? [ersteA, ersteB] : null };
  });
  check(`Beinah-Dubletten werden gefunden (${dub.anzahl} Paare)`, dub.anzahl > 0);
  check('… und als Paar zur Entscheidung gestellt, nicht automatisch zusammengeführt',
    dub.txt.includes('entscheidet hier ein Mensch') && dub.txt.includes('Verschiedene Produkte'));
  check('Zusammenführen legt beide auf denselben Stammsatz', dub.gleicherStamm === true);
  check('… und das Paar verschwindet aus der Liste', dub.nachMerge === dub.vorher - 1);

  const dubNein = await A.page.evaluate(() => {
    const paare = mcDubletten();
    if (!paare.length) return { leer: true };
    const p = paare[0];
    mcDublettenTrennen(p.a, p.b);
    return { vorher: paare.length, nachher: mcDubletten().length };
  });
  check('„Verschiedene Produkte" merkt sich die Entscheidung',
    dubNein.leer || dubNein.nachher === dubNein.vorher - 1);

  // ═══════════ 11. Geräte-Stamm ═══════════
  const ger = await A.page.evaluate(() => {
    mode = 'care'; renderCare(); show('scr-care');
    mcGo('geraete');
    const liste = geraetListe();
    const txt = document.getElementById('scr-care').textContent;
    const raum = liste.filter(g => /Raumkontrolle/i.test(g.name)).length;
    if (!liste.length) return { leer: true };
    // Ersten Gerätesatz öffnen und ausfüllen
    mcGeraetToggle(liste[0].key);
    const hatFelder = !!document.getElementById('ger_inventarnr') && !!document.getElementById('ger_saal');
    document.getElementById('ger_saal').value = 'Saal 1';
    document.getElementById('ger_inventarnr').value = '4711';
    document.getElementById('ger_ansprech').value = 'Medizintechnik';
    document.getElementById('ger_pruef_letzte').value = '2026-01-15';
    document.getElementById('ger_pruef_int').value = '12';
    mcGeraetSpeichern(liste[0].key);
    const rec = GERAETE[liste[0].key];
    const b = geraetBilanz('2027-02-01');
    return { leer: false, anzahl: liste.length, raum, hatFelder, txt,
      gespeichert: !!rec, saal: rec && rec.saal,
      naechste: geraetNaechstePruefung(rec), faellig: b.pruefFaellig };
  });
  check(`Geräteliste entsteht aus den Standards (${ger.anzahl || 0})`, !ger.leer && ger.anzahl > 0);
  check('… und „Raumkontrolle" steht NICHT mehr darin', ger.raum === 0);
  check('… mit Feldern für Saal, Inventarnummer und Ansprechpartner', ger.hatFelder === true);
  check('Gerätesatz wird gespeichert', ger.gespeichert === true && ger.saal === 'Saal 1');
  check('… und der nächste Prüftermin wird gerechnet', ger.naechste === '2027-01-15');
  check('… überfällige Prüfungen werden gezählt', ger.faellig >= 1);

  check('keine Konsolenfehler', A.errs.length === 0);
  if (A.errs.length) console.log('   ', A.errs.slice(0, 4));

  await r.finish(browser, [srv]);
})();
