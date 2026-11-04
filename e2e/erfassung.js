/* GEFÜHRTE NEUANLAGE end-to-end (features/erfassung.js).

   Spielt den Ablauf aus dem Schaubild „Workflow Einträge" im echten Browser
   durch — mit echten Klicks auf die Bedienflächen:
     ① Neuer Eintrag im Standard → „Was ist das?" → Material
     ② Kategorie wählen (Ablationskatheter) → GTIN/REF/Hersteller
     ③ Merkmale aus einem Etikettentext (der Weg, den das Foto nimmt)
     ④ Kontrolle → Speichern → Stammsatz + verknüpfte Zeile im Standard
   Dazu: dieselbe GTIN ein zweites Mal → „Schon erfasst" statt Dublette,
   ein Hinweis läuft am Material-Ablauf vorbei, eine neue Kategorie samt
   eigenem Feld, und im Bestand ohne Freigabe bleibt alles wie bisher. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('erfassung');
  const srv = await startServer();
  const browser = await launchBrowser();
  const { page, errs } = await bootPage(browser, srv.base);
  const klick = async (sel) => { await page.click(sel, { timeout: 8000 }); await page.waitForTimeout(60); };

  // 0) Ohne Freigabe (Bestand): alter Weg, keine neuen Arten.
  const ohne = await page.evaluate(() => {
    doLogin('1234567');
    const s = DB.standards[0]; openStandard(s.id);
    const ri = s.rubriken.findIndex(x => x.typ === 'material'); openRubrik(ri);
    startAddEntry();
    const formular = !!document.getElementById('fName');
    const arten = natList().map(n => n.key);
    closeForm();
    return { formular, anweisung: arten.includes('anweisung') };
  });
  r.check('Bestand ohne Freigabe: „Eintrag hinzufügen" öffnet wie bisher das Formular', ohne.formular);
  r.check('Bestand ohne Freigabe: keine neuen Arten (Anweisung, Personal)', !ohne.anweisung);

  // 1) Freigabe an → „Was ist das?"
  const ziel = await page.evaluate(() => {
    NEUFREI.erfassung = true;
    const s = DB.standards[0]; openStandard(s.id);
    const ri = s.rubriken.findIndex(x => x.typ === 'material'); openRubrik(ri);
    startAddEntry();
    const t = document.getElementById('sheet').textContent;
    return { sid: s.id, ri, frage: /Was ist das\?/.test(t), anweisung: /Anweisung/.test(t), personal: /Personal/.test(t) };
  });
  r.check('Neuer Eintrag fragt zuerst „Was ist das?"', ziel.frage);
  r.check('Zur Wahl stehen auch Anweisung und Personal', ziel.anweisung && ziel.personal);

  // Hinweis → direkt das gewohnte Formular, ohne Material-Schritte
  await klick('.erf-art[data-k="hinweis"]');
  const hinweis = await page.evaluate(() => {
    const ok = !!document.getElementById('fName') && document.getElementById('fNatWrap').dataset.nat === 'hinweis';
    closeForm(); return ok;
  });
  r.check('Hinweis: gewohntes Formular, Art vorgewählt — keine Material-Schritte', hinweis);

  // 2) Material → Kategorie
  await page.evaluate(() => startAddEntry());
  await klick('.erf-art[data-k="material"]');
  r.check('Material: Schritt 1 ist die Kategorie', await page.evaluate(() => /Schritt 1 von 4 · Kategorie/.test(document.getElementById('scr-form').textContent)));
  await page.fill('#erfKatSuche', 'Ablation');
  await page.waitForTimeout(80);
  r.check('Kategorie-Suche filtert', await page.evaluate(() => document.querySelectorAll('.erf-kat-z').length >= 1 && document.querySelectorAll('.erf-kat-z').length < 6));
  await klick('.erf-kat-z[data-k="ablation_rf"]');

  // 3) Kennung: GTIN mit falscher Prüfziffer wird abgewiesen, richtige angenommen
  await page.fill('#erfGtin', '04012345678902');
  await page.dispatchEvent('#erfGtin', 'change');
  await page.waitForTimeout(150);
  await klick('.erf-fuss .btn-pri');
  r.check('Falsche GTIN-Prüfziffer hält den Ablauf an', await page.evaluate(() => /Schritt 2 von 4/.test(document.getElementById('scr-form').textContent)
    && /Prüfziffer stimmt nicht/.test(document.getElementById('scr-form').textContent)));
  await page.fill('#erfGtin', '04012345678901');
  await page.dispatchEvent('#erfGtin', 'change');
  await page.waitForTimeout(150);

  // Etikettentext statt Kamera: derselbe Weg, den ein Foto nimmt.
  await page.evaluate(() => {
    const text = 'Boston Scientific\nIntellaNav MiFi XP\nTemperature Ablation Catheter\nREF M004EMR4500K20\n8F 110 cm Large Curve\nBi-directional\nIrrigated\nSTERILE EO\nSingle use only';
    erfAusErgebnis({ text, fields: { ref: 'M004EMR4500K20', hersteller: 'Boston Scientific', name: 'IntellaNav MiFi XP' },
      refInfo: { wie: 'roh', sicher: false, vorschlaege: [] }, refRoh: 'M004EMR4500K20', qualitaet: [] });
    ERF.fotoErg.push({ lesungen: [] });
    erfZeichnen();
  });
  const kennung = await page.evaluate(() => ({ ref: document.getElementById('erfRef').value, herst: document.getElementById('erfHerst').value,
    quelle: document.getElementById('scr-form').textContent }));
  r.check('Etikett füllt REF und Hersteller (Hersteller als Auswahl)', kennung.ref === 'M004EMR4500K20' && kennung.herst === 'Boston Scientific');
  r.check('Jedes Feld nennt seine Herkunft', /Etikett \(gelesen\)/.test(kennung.quelle));
  await klick('.erf-fuss .btn-pri');

  // 4) Merkmale der Kategorie, vom selben Etikett — kein zweites Foto
  const merk = await page.evaluate(() => {
    const t = document.getElementById('scr-form').textContent;
    const wert = (id) => { const el = document.querySelector('#erfMerk .merk-f[data-mid="' + id + '"]'); return el ? el.value : null; };
    return { schritt3: /Schritt 3 von 4 · Merkmale/.test(t), ad: wert('ad_fr'), laenge: wert('nutzlaenge_cm'), steuer: wert('steuerbar'),
      irr: wert('gekuehlt'), sterne: document.querySelectorAll('#erfMerk .erf-diff').length, name: document.getElementById('erfName').value };
  });
  r.check('Schritt 3 zeigt die Felder des Ablationskatheters', merk.schritt3);
  r.check('Merkmale vom Etikett: French ' + merk.ad + ', Länge ' + merk.laenge, merk.ad === '8' && merk.laenge === '110');
  r.check('Steuerbar und Irrigation erkannt (' + merk.steuer + ' / ' + merk.irr + ')', !!merk.steuer && !!merk.irr);
  r.check('Differenzierungsmerkmale (★) vorn', merk.sterne >= 2);
  r.check('Produktname vorgeschlagen', !!merk.name);
  await klick('.erf-fuss .btn-pri');

  // 5) Kontrolle → Speichern
  r.check('Schritt 4: Kontrolle ohne fehlende Pflichtfelder', await page.evaluate(() => /Schritt 4 von 4/.test(document.getElementById('scr-form').textContent)
    && !/Bitte ergänzen/.test(document.getElementById('scr-form').textContent)));
  await klick('.erf-fuss .btn-pri');
  await page.waitForTimeout(300);
  const gespeichert = await page.evaluate(({ sid, ri }) => {
    const rec = GTINDB['04012345678901'];
    const zeilen = ADDITIONS.entries[sid + '|' + ri] || [];
    const z = zeilen.find(e => e.produkt === '04012345678901');
    return { rec: rec && { klasse: rec.klasse, kategorie: rec.kategorie, ref: rec.ref, herst: rec.hersteller, merk: rec.merkmale, q: rec.quellen },
      zeile: !!z, mk: z && z.material_key };
  }, ziel);
  r.check('Stammsatz: Kategorie = Materialklasse (ein Feld)', gespeichert.rec && gespeichert.rec.klasse === 'ablation_rf' && !!gespeichert.rec.kategorie);
  r.check('Stammsatz: REF, Hersteller und Merkmale', gespeichert.rec && gespeichert.rec.ref === 'M004EMR4500K20' && gespeichert.rec.herst === 'Boston Scientific' && gespeichert.rec.merk && gespeichert.rec.merk.ad_fr === '8');
  r.check('Stammsatz merkt sich die Herkunft (Schlüssel)', gespeichert.rec && gespeichert.rec.q && gespeichert.rec.q.ref === 'etikett');
  r.check('Zeile im Standard zeigt auf das Produkt', gespeichert.zeile && gespeichert.mk === 'produkt:04012345678901');

  // 6) Dieselbe GTIN noch einmal → „Schon erfasst", keine Dublette
  await page.evaluate(() => startAddEntry());
  await klick('.erf-art[data-k="material"]');
  await klick('.erf-kat-z[data-k="ablation_rf"]');
  await page.fill('#erfGtin', '04012345678901');
  await page.dispatchEvent('#erfGtin', 'change');
  await page.waitForTimeout(150);
  r.check('Bekannte GTIN: „Schon erfasst" wird angeboten', await page.evaluate(() => /Schon erfasst/.test(document.getElementById('scr-form').textContent)));
  const vorher = await page.evaluate(() => Object.keys(GTINDB).length);
  await klick('.erf-vorh .btn-pri');
  await page.waitForTimeout(200);
  const dubl = await page.evaluate(({ sid, ri }) => ({ n: Object.keys(GTINDB).length,
    zeilen: (ADDITIONS.entries[sid + '|' + ri] || []).filter(e => e.produkt === '04012345678901').length }), ziel);
  r.check('Kein zweiter Stammsatz — die vorhandene Zeile wird wiederverwendet', dubl.n === vorher && dubl.zeilen === 2);

  // 7) Neue Kategorie mit eigenem Feld (Nadelhalter) — ohne Entwickler
  await page.evaluate(() => startAddEntry());
  await klick('.erf-art[data-k="material"]');
  await klick('button.wiz-link');
  await page.fill('#erfKatNeuInp', 'Instrument');
  await klick('#erfKatNeu .add-btn');
  const neuKat = await page.evaluate(() => ({ klasse: ERF && ERF.klasse, inKatalog: (MERKKAT.klassen || []).some(k => k.label === 'Instrument'),
    geteilt: SHARED_KEYS.includes('hkl_kattpl') }));
  r.check('Neue Kategorie direkt angelegt und gewählt', !!neuKat.klasse && neuKat.inKatalog);
  r.check('Kategorien & Felder werden auf alle Geräte geteilt', neuKat.geteilt);
  await page.evaluate(() => { ERF.schritt = 2; erfZeichnen(); });
  await klick('button[onclick="erfVorlageBlatt(ERF.klasse)"]');
  await page.fill('#erfNmLabel', 'Maulform');
  await page.selectOption('#erfNmTyp', 'liste');
  await page.fill('#erfNmWerte', 'gerade, gebogen');
  await klick('.sheet-pick-btn');
  await klick('.sheet-close');
  r.check('Eigenes Feld erscheint sofort im Formular', await page.evaluate(() => [...document.querySelectorAll('#erfMerk .flabel')].some(e => /MAULFORM/.test(e.textContent))));
  await page.evaluate(() => erfAbbrechen());

  // 8) Materialverwaltung: nur Material oder Gerät zur Wahl
  const verw = await page.evaluate(() => { erfStart({ ort: 'verwaltung' });
    const k = [...document.querySelectorAll('.erf-art')].map(b => b.dataset.k); showSheet(false); return k; });
  r.check('Materialverwaltung fragt nur Material oder Gerät (' + verw.join(', ') + ')', verw.includes('material') && verw.includes('geraet') && !verw.includes('hinweis'));

  r.check('keine Konsolenfehler', errs.filter(e => !/favicon|net::ERR|Failed to load resource/i.test(e)).length === 0);
  { const rest = errs.filter(e => !/favicon|net::ERR|Failed to load resource/i.test(e)); if (rest.length) console.log(rest.slice(0, 5)); }
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
