/* END-TO-END: DUPLIZIEREN von Standards und Anleitungen.

   Der Zweck ist Geschwindigkeit: Ein neuer Standard entsteht aus einem
   bestehenden, nicht auf einem weißen Blatt. Die Prüfungen richten sich
   deshalb an den fünf Zusagen aus features/duplicate.js:

     1. vollständig unabhängig vom Original (in BEIDE Richtungen)
     2. sieht aus wie das Original (effektiver Stand, nicht Rohtext)
     3. alles ist ECHT löschbar (kein Ausblenden wie am Original)
     4. keine Geschichte wird mitkopiert (Häkchen, Freigabe, Prüf-Vermerke)
     5. Rubrik-Vorlagen werden aufgelöst (kein Durchschlagen auf fremde Standards)
*/
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('duplizieren');
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);

  // ═══════════ Vorbereitung: Original mit Anpassungen versehen ═══════════
  const vorbereitet = await A.page.evaluate(() => {
    doLogin('1234567');
    const src = DB.standards.find(s => (s.rubriken || []).some(rb =>
      (rb.sub_bereiche || []).some(sb => (sb.eintraege || []).length >= 3)));
    if (!src) return { keinStandard: true };
    const ri = src.rubriken.findIndex(rb => (rb.sub_bereiche || []).some(sb => (sb.eintraege || []).length >= 3));
    const si = src.rubriken[ri].sub_bereiche.findIndex(sb => (sb.eintraege || []).length >= 3);
    const cid0 = cidOf(src.id, ri, si, 0);
    const cid1 = cidOf(src.id, ri, si, 1);
    const cid2 = cidOf(src.id, ri, si, 2);
    // Eigenschaft 2: der EFFEKTIVE Stand weicht vom Rohtext ab
    QE.cid[cid0] = { name: 'UMBENANNT Testkatheter', important: true, color: '#ff0000', why: 'Testbegründung' };
    // Eigenschaft 4: ausgeblendetes darf nicht mitkommen
    QE.cid[cid1] = { hidden: true };
    saveQE();
    // Freigabe am Original setzen — darf NICHT mitkopiert werden
    STDE[src.id] = Object.assign({}, STDE[src.id], { status: 'Freigegeben', version: '3.1' });
    saveSTDE();
    // Häkchen am Original — darf NICHT mitkommen
    checks = {}; checks[cid2] = true; saveChecks();
    return { keinStandard: false, sid: src.id, ri, si,
      titel: stdTitel(src), gruppe: stdGruppe(src),
      rohText0: src.rubriken[ri].sub_bereiche[si].eintraege[0].anzeige_text,
      anzahlStandards: DB.standards.length };
  });
  if (vorbereitet.keinStandard) { r.fail('Testvorbereitung (kein passender Standard gefunden)'); }

  // ═══════════ Duplizieren ═══════════
  const kopie = await A.page.evaluate((v) => {
    const neu = stdDuplicate(v.sid, 'DDD-ICD Testkopie', 'TESTGRUPPE');
    const k = DB.standards.find(s => s.id === neu);
    const orig = DB.standards.find(s => s.id === v.sid);
    const zaehl = (std) => { let n = 0; (std.rubriken || []).forEach(rb =>
      (rb.sub_bereiche || []).forEach(sb => { n += (sb.eintraege || []).length; })); return n; };
    // erster Eintrag der Kopie = der umbenannte, denn der ausgeblendete fiel weg
    const kRi = 0;
    let ersterName = null, zweiterName = null;
    for (const rb of (k.rubriken || [])) {
      for (const sb of (rb.sub_bereiche || [])) {
        if ((sb.eintraege || []).length >= 2) { ersterName = sb.eintraege[0].anzeige_text; zweiterName = sb.eintraege[1].anzeige_text; break; }
      }
      if (ersterName) break;
    }
    return { neu, angelegt: !!k, titel: k && stdTitel(k), gruppe: k && stdGruppe(k),
      istEigen: !!(k && k.__new), hatStruktur: ownHatStruktur(neu),
      eintraegeOrig: zaehl(orig), eintraegeKopie: zaehl(k),
      ersterName, zweiterName,
      standardsMehr: DB.standards.length - v.anzahlStandards, kRi };
  }, vorbereitet);
  r.check('Kopie wird als eigener Standard angelegt',
    kopie.angelegt && kopie.istEigen === true && kopie.standardsMehr === 1);
  r.check('Titel und Gruppe werden übernommen',
    kopie.titel === 'DDD-ICD Testkopie' && kopie.gruppe === 'TESTGRUPPE');
  r.check('Die Kopie trägt eine EIGENE Struktur (Voraussetzung für echtes Löschen)',
    kopie.hatStruktur === true);

  // ── Eigenschaft 2: sieht aus wie das Original ──
  r.check('Kopie zeigt den EFFEKTIVEN Namen, nicht den Rohtext',
    kopie.ersterName === 'UMBENANNT Testkatheter');

  // ── Eigenschaft 4: keine Geschichte ──
  const geschichte = await A.page.evaluate((n) => {
    const k = DB.standards.find(s => s.id === n);
    const meta = STDE[n] || {};
    let offen = 0;
    (k.rubriken || []).forEach((rb, ri) => (rb.sub_bereiche || []).forEach((sb, si) =>
      (sb.eintraege || []).forEach((e, ei) => { if (checks[cidOf(n, ri, si, ei)]) offen++; })));
    return { status: meta.status || '', version: meta.version || '', haken: offen };
  }, kopie.neu);
  r.check('Freigabe und Version des Originals kommen NICHT mit (Kopie ist Entwurf)',
    geschichte.status === '' && geschichte.version === '');
  r.check('Häkchen des Originals kommen nicht mit', geschichte.haken === 0);
  r.check('Ausgeblendete Einträge wandern nicht in die Kopie',
    kopie.eintraegeKopie === kopie.eintraegeOrig - 1);

  // ── Eigenschaft 1: Unabhängigkeit in BEIDE Richtungen ──
  const unabhaengig = await A.page.evaluate((d) => {
    const kRef = () => DB.standards.find(s => s.id === d.neu);
    const oRef = () => DB.standards.find(s => s.id === d.sid);
    const ersten = (std) => { for (const rb of (std.rubriken || [])) for (const sb of (rb.sub_bereiche || []))
      if ((sb.eintraege || []).length) return sb.eintraege[0]; return null; };
    // a) Original ändern → Kopie darf sich NICHT ändern
    const kVorher = ersten(kRef()).anzeige_text;
    const oCid = cidOf(d.sid, d.ri, d.si, 0);
    QE.cid[oCid] = Object.assign({}, QE.cid[oCid], { name: 'ORIGINAL SPAETER GEAENDERT' });
    saveQE(); rebuildDB();
    const kNachher = ersten(kRef()).anzeige_text;
    // b) Kopie ändern → Original darf sich NICHT ändern
    const oVorher = ersten(oRef()).anzeige_text;
    const kEintrag = ersten(kRef());
    kEintrag.anzeige_text = 'NUR IN DER KOPIE';
    const own = ownStd(d.neu);
    // in der eigenen Struktur wirklich schreiben
    for (const rb of (own.rubriken || [])) { let fertig = false;
      for (const sb of (rb.sub_bereiche || [])) if ((sb.eintraege || []).length) { sb.eintraege[0].anzeige_text = 'NUR IN DER KOPIE'; fertig = true; break; }
      if (fertig) break; }
    saveNEWSTD(); rebuildDB();
    const oNachher = ersten(oRef()).anzeige_text;
    return { kVorher, kNachher, oVorher, oNachher,
      kJetzt: ersten(kRef()).anzeige_text };
  }, { neu: kopie.neu, sid: vorbereitet.sid, ri: vorbereitet.ri, si: vorbereitet.si });
  r.check('Änderung am ORIGINAL lässt die Kopie unberührt',
    unabhaengig.kVorher === unabhaengig.kNachher);
  r.check('Änderung an der KOPIE lässt das Original unberührt',
    unabhaengig.oVorher === unabhaengig.oNachher && unabhaengig.kJetzt === 'NUR IN DER KOPIE');

  // ── Eigenschaft 3: ECHTES Löschen in der Kopie ──
  const loeschen = await A.page.evaluate((n) => {
    const k = () => DB.standards.find(s => s.id === n);
    const zaehl = (std) => { let c = 0; (std.rubriken || []).forEach(rb =>
      (rb.sub_bereiche || []).forEach(sb => { c += (sb.eintraege || []).length; })); return c; };
    // Anpassungen an den Einträgen 0..2 setzen, um das Nachziehen zu prüfen
    let ri = -1, si = -1;
    (k().rubriken || []).forEach((rb, i) => (rb.sub_bereiche || []).forEach((sb, j) => {
      if (ri < 0 && (sb.eintraege || []).length >= 3) { ri = i; si = j; } }));
    if (ri < 0) return { uebersprungen: true };
    QE.cid[cidOf(n, ri, si, 0)] = { color: '#111111' };
    QE.cid[cidOf(n, ri, si, 1)] = { color: '#222222' };
    QE.cid[cidOf(n, ri, si, 2)] = { color: '#333333' };
    saveQE();
    const vorher = zaehl(k());
    const nameVon2 = k().rubriken[ri].sub_bereiche[si].eintraege[2].anzeige_text;
    // Eintrag 1 ECHT löschen
    const ok = ownDeleteEntry(cidOf(n, ri, si, 1));
    const nachher = zaehl(k());
    // Der frühere Eintrag 2 steht jetzt auf Position 1 — seine Farbe muss mitgewandert sein
    const nameJetzt1 = k().rubriken[ri].sub_bereiche[si].eintraege[1].anzeige_text;
    const farbeJetzt1 = (QE.cid[cidOf(n, ri, si, 1)] || {}).color;
    const farbe0 = (QE.cid[cidOf(n, ri, si, 0)] || {}).color;
    const alteFarbe2Weg = !(QE.cid[cidOf(n, ri, si, 2)] || {}).color;
    // Segment (Rubrik) ECHT löschen
    const rubVorher = k().rubriken.length;
    const okRub = ownDeleteRubrik(n, ri);
    const rubNachher = k().rubriken.length;
    // Segment hinzufügen
    const okAdd = ownAddRubrik(n, 'Nachsorge', 'sonstige');
    const rubDanach = k().rubriken.length;
    const neuesSegment = k().rubriken[k().rubriken.length - 1];
    return { uebersprungen: false, ok, vorher, nachher,
      nameVon2, nameJetzt1, farbeJetzt1, farbe0, alteFarbe2Weg,
      okRub, rubVorher, rubNachher, okAdd, rubDanach,
      neuName: neuesSegment && neuesSegment.name, neuTyp: neuesSegment && neuesSegment.typ };
  }, kopie.neu);
  if (loeschen.uebersprungen) { r.fail('Echtes Löschen (kein Abschnitt mit ≥3 Einträgen)'); }
  else {
    r.check('Eintrag in der Kopie wird WIRKLICH gelöscht (nicht ausgeblendet)',
      loeschen.ok === true && loeschen.nachher === loeschen.vorher - 1);
    r.check('Nachrückende Einträge behalten ihre eigenen Anpassungen',
      loeschen.nameJetzt1 === loeschen.nameVon2 && loeschen.farbeJetzt1 === '#333333');
    r.check('Davorliegende Anpassungen bleiben unangetastet', loeschen.farbe0 === '#111111');
    r.check('Der verwaiste Anpassungs-Schlüssel bleibt nicht zurück', loeschen.alteFarbe2Weg === true);
    r.check('Segment wird WIRKLICH gelöscht',
      loeschen.okRub === true && loeschen.rubNachher === loeschen.rubVorher - 1);
    r.check('Segment lässt sich hinzufügen',
      loeschen.okAdd === true && loeschen.rubDanach === loeschen.rubNachher + 1
      && loeschen.neuName === 'Nachsorge');
  }

  // ── Am ORIGINAL bleibt es beim schonenden Ausblenden ──
  const original = await A.page.evaluate((sid) => {
    const s = DB.standards.find(x => x.id === sid);
    const zaehl = () => { let c = 0; (s.rubriken || []).forEach(rb =>
      (rb.sub_bereiche || []).forEach(sb => { c += (sb.eintraege || []).length; })); return c; };
    return { eigen: ownHatStruktur(sid), einträge: zaehl(), echtLoeschbar: ownDeleteEntry(cidOf(sid, 0, 0, 0)) };
  }, vorbereitet.sid);
  r.check('Importierter Standard bleibt unangetastet — kein echtes Löschen',
    original.eigen === false && original.echtLoeschbar === false);

  // ── Eigenschaft 5: Rubrik-Vorlagen werden aufgelöst ──
  const vorlagen = await A.page.evaluate((v) => {
    // Vorlage anlegen, die für ALLE Standards gilt
    saveRubrikTpl({ name: 'Vorlagen-Rubrik', typ: 'sonstige', scope: 'all' });
    rebuildDB();
    const neu = stdDuplicate(v.sid, 'Kopie mit Vorlage', 'TESTGRUPPE');
    const k = DB.standards.find(s => s.id === neu);
    const inKopie = (k.rubriken || []).filter(rb => rb.name === 'Vorlagen-Rubrik');
    // In der Kopie darf es KEINE Vorlagen-Rubrik mehr sein (sonst schlüge ein
    // Löschen dort auf alle anderen Standards durch).
    const alsVorlage = inKopie.filter(rb => rb.__tplid).length;
    return { anzahl: inKopie.length, alsVorlage, neu };
  }, vorbereitet);
  r.check('Vorlagen-Rubriken landen als normale Segmente in der Kopie',
    vorlagen.anzahl >= 1 && vorlagen.alsVorlage === 0);

  // ── Titelvorschlag ohne Dubletten ──
  const titel = await A.page.evaluate(() => ({
    erst: dupTitel('VVI-ICD', ['VVI-ICD']),
    zweit: dupTitel('VVI-ICD', ['VVI-ICD', 'Kopie von VVI-ICD']),
    dritt: dupTitel('VVI-ICD', ['VVI-ICD', 'Kopie von VVI-ICD', 'Kopie von VVI-ICD (2)']),
  }));
  r.check('Titelvorschlag weicht Dubletten aus',
    titel.erst === 'Kopie von VVI-ICD' && titel.zweit === 'Kopie von VVI-ICD (2)'
    && titel.dritt === 'Kopie von VVI-ICD (3)');

  // ═══════════ ANLEITUNGEN ═══════════
  const anleitung = await A.page.evaluate(() => {
    GUIDES = [{ id: 'g-orig', titel: 'Rhythmia aufbauen', bereich: 'Aufbau & Vorbereitung',
      kurz: 'Vor jedem Mapping', intervall: 'bei Bedarf',
      schritte: [{ id: 's1', text: 'Wagen positionieren', warn: 'Kabel nicht knicken' },
                 { id: 's2', text: 'Kabel verbinden', tipp: 'Farben beachten' }] }];
    saveGuides();
    checks = {}; checks[guideCid('g-orig', 's1')] = true; saveChecks();
    const neu = guideDuplicate('g-orig', 'Rhythmia abbauen');
    const k = guideById(neu);
    const o = guideById('g-orig');
    // Unabhängigkeit: Original ändern
    o.schritte[0].text = 'ORIGINAL GEAENDERT'; saveGuides();
    const kText = k.schritte[0].text;
    // Häkchen des Originals dürfen nicht mitkommen
    const kHaken = (k.schritte || []).filter(s => checks[guideCid(neu, s.id)]).length;
    const idsVerschieden = k.schritte.every(s => !o.schritte.some(x => x.id === s.id));
    return { neu, titel: k.titel, schritte: k.schritte.length, kText, kHaken, idsVerschieden,
      warnMit: k.schritte[0].warn, tippMit: k.schritte[1].tipp, anzahl: GUIDES.length };
  });
  r.check('Anleitung wird dupliziert (Titel, Schritte, Warnungen, Tipps)',
    anleitung.anzahl === 2 && anleitung.titel === 'Rhythmia abbauen' && anleitung.schritte === 2
    && anleitung.warnMit === 'Kabel nicht knicken' && anleitung.tippMit === 'Farben beachten');
  r.check('Kopie der Anleitung ist unabhängig vom Original',
    anleitung.kText === 'Wagen positionieren');
  r.check('Schritte bekommen frische Kennungen — Häkchen kommen nicht mit',
    anleitung.idsVerschieden === true && anleitung.kHaken === 0);

  // ═══════════ Die Formulare ═══════════
  const formulare = await A.page.evaluate((sid) => {
    openStandard(sid, true);
    openDupStdForm(sid);
    const dup = { offen: document.getElementById('scr-form').classList.contains('active'),
      titelVorbelegt: !!(document.getElementById('dupTitel') || {}).value,
      zeigtUmfang: /Segmente/.test(document.getElementById('scr-form').innerHTML),
      warntVorNichtKopiertem: /Entwurf/.test(document.getElementById('scr-form').innerHTML) };
    closeForm();
    openStandard(sid, true);
    openStdRenameForm();
    const ren = { offen: !!document.getElementById('stdTitelInp'),
      wert: (document.getElementById('stdTitelInp') || {}).value };
    closeForm();
    return { dup, ren };
  }, vorbereitet.sid);
  r.check('Duplizieren-Formular öffnet mit vorbelegtem Titel',
    formulare.dup.offen && formulare.dup.titelVorbelegt);
  r.check('… nennt den Umfang und sagt, was NICHT mitkommt',
    formulare.dup.zeigtUmfang && formulare.dup.warntVorNichtKopiertem);
  r.check('Umbenennen läuft über ein Formular statt prompt()',
    formulare.ren.offen && !!formulare.ren.wert);

  r.check('keine Konsolen-/Seitenfehler', A.errs.filter(e => !/favicon/i.test(e)).length === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
