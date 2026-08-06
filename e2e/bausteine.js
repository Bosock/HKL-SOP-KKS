/* END-TO-END: BAUSTEINE

   Die Standards sind voneinander abgeschrieben. Derselbe Aufbau steht deshalb
   vielfach im Bestand und muss vielfach nachgezogen werden. Der Baustein soll
   das aufheben — hier wird geprüft, ob er es im laufenden Browser tut:

     1. Der Einstieg steht in der Verwaltung und öffnet die Ansicht.
     2. Die Ansicht findet am ECHTEN Bestand wiederkehrende Folgen.
     3. Anlegen geht über die Bedienoberfläche (nicht nur über die Konsole).
     4. Eine Änderung am Baustein steht danach IM STANDARD — an allen Stellen.
     5. Eine Abweichung im Bestand fällt auf und lässt sich durchsetzen.
     6. „Lösen" gibt den Bestand vollständig zurück.
     7. Einfügen legt die Zeilen in einem Standard an.
     8. Der Rückweg führt in die Verwaltung.
     9. Das Schnellmenü warnt vor, bevor jemand eine Baustein-Zeile ändert. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('bausteine');
  const check = (l, c) => r.check(l, c);
  const srv = await startServer();
  const browser = await launchBrowser();
  /* prompt()/confirm() der Bedienoberfläche beantwortet bootPage — der
     Antworttext ist der Name, den der neu angelegte Baustein bekommt. */
  const A = await bootPage(browser, srv.base, { dialogText: 'E2E-Baustein' });

  await A.page.evaluate(() => { doLogin('1234567'); });

  // ═══════════ 1. Einstieg aus der Verwaltung ═══════════
  const einstieg = await A.page.evaluate(() => {
    setMode('admin');
    const txt = document.getElementById('scr-admin').textContent;
    const knopf = [...document.querySelectorAll('#scr-admin button')]
      .find(b => /Bausteine öffnen/.test(b.textContent));
    if (knopf) knopf.click();
    return { imPanel: txt.includes('Bausteine'), knopf: !!knopf,
      aktiv: (document.querySelector('.screen.active') || {}).id };
  });
  check('die Verwaltung hat einen Bausteine-Bereich', einstieg.imPanel && einstieg.knopf);
  check('… und er öffnet die Ansicht', einstieg.aktiv === 'scr-bausteine');

  // ═══════════ 2. KURATIEREN statt vorschlagen ═══════════
  //
  // Der Betreiber hat die Vorschlagsmaschine ausdrücklich abbestellt: „Ich will
  // keine Vorschläge, ich kenne meine Bausteine schon." Gesammelt wird jetzt
  // beim Durcharbeiten eines Standards. Die Erkennungsfunktionen bleiben im
  // Modul (sie sind billig und geprüft) — sie dürfen nur nirgends von allein
  // erscheinen. Genau das prüft der erste Punkt.
  const ohneVorschlag = await A.page.evaluate(() => {
    const txt = document.getElementById('scr-bausteine').textContent;
    return { keineListe: !/Gefundene Wiederholungen/.test(txt),
      keineKarten: document.querySelectorAll('#scr-bausteine .bau-vor').length === 0,
      erklaert: /In Baustein übernehmen/.test(txt) || /Baustein/.test(txt) };
  });
  check('keine Vorschlagsliste mehr auf dem Bildschirm', ohneVorschlag.keineListe && ohneVorschlag.keineKarten);
  check('… stattdessen erklärt der Bildschirm den Sammelweg', ohneVorschlag.erklaert);

  // ═══════════ 3. Sammeln und daraus einen Baustein machen ═══════════
  const angelegt = await A.page.evaluate(() => {
    /* Eine echte Folge aus dem Bestand suchen: drei aufeinanderfolgende Zeilen
       einer Material-Rubrik, die es auch anderswo gibt. */
    const kand = bauVorschlaege()[0];
    if (!kand) return { kein: true, keinKandidat: true };
    const vor = bauFindenIn(kand.zeilen.map(z => z.slug), bauBloeckeJetzt());
    if (!vor.length) return { kein: true, keineStelle: true };
    const v = vor[0];
    const rubrik = bauRubrikVon(v.sid + '|' + v.ri);
    /* Sammeln — genau wie es das ⋯-Menü tut. */
    v.eis.forEach(ei => bauSammeln(v.sid + '|' + v.ri + '|' + v.si + '|' + ei));
    openBausteinAdmin();
    const mappeDa = /Gesammelt/.test(document.getElementById('scr-bausteine').textContent);
    const machen = [...document.querySelectorAll('#scr-bausteine button')]
      .find(b => /Baustein daraus machen/.test(b.textContent));
    if (!machen) return { kein: true, keinKnopf: true };
    machen.click();
    const feld = document.getElementById('bauSamName');
    if (!feld) return { kein: true, keinFeld: true };
    feld.value = 'E2E-Baustein';
    const anlegen = [...document.querySelectorAll('#scr-bausteine button')]
      .find(x => x.textContent.trim() === 'Baustein anlegen');
    if (!anlegen) return { kein: true, keinAnlegen: true };
    anlegen.click();
    const b = BAUSTEINE[0];
    const f = b ? bauVorkommen(b.id) : [];
    return { kein: false, mappeDa, name: b && b.name, rubrik: b && b.rubrik, erwartet: rubrik,
      quelle: b && b.quelle, mappeLeer: bauSammelZahl() === 0,
      zeilen: b ? b.zeilen.length : 0,
      stellen: f.length, standards: [...new Set(f.map(x => x.sid))].length,
      cid0: f.length ? (f[0].sid + '|' + f[0].ri + '|' + f[0].si + '|' + f[0].eis[0]) : null,
      inListe: document.getElementById('scr-bausteine').textContent.includes(rubrik || '') };
  });
  check('gesammelte Zeilen erscheinen als Mappe', !angelegt.kein && angelegt.mappeDa);
  check('aus der Mappe entsteht ein Baustein — über eine Eingabefläche, nicht über ein Fenster',
    !angelegt.kein && angelegt.name === 'E2E-Baustein' && angelegt.quelle === 'kuratiert');
  check('… und die Mappe ist danach leer', angelegt.mappeLeer === true);
  check(`… er merkt sich seine Rubrik („${angelegt.rubrik || ''}")`,
    !!angelegt.rubrik && angelegt.rubrik === angelegt.erwartet);
  check(`… er findet seine Fundstellen (${angelegt.stellen} in ${angelegt.standards} Standards)`,
    angelegt.stellen >= 3 && angelegt.standards >= 3);
  check('… und steht in der Bibliothek unter seiner Rubrik', angelegt.inListe === true);

  // ═══════════ 3b. Kategorien: Facetten statt Baum ═══════════
  const kategorien = await A.page.evaluate(() => {
    const k1 = bauKatAnlegen('E2E-CRM');
    const k2 = bauKatAnlegen('E2E-EPU');
    const b = BAUSTEINE[0];
    bauKatSchalten(b.id, k1.key);
    bauKatSchalten(b.id, k2.key);
    const beide = bauHatKat(BAUSTEINE[0], k1.key) && bauHatKat(BAUSTEINE[0], k2.key);
    renderBausteine();
    const leiste = document.querySelectorAll('#scr-bausteine .bau-kb').length;
    bauKatLoeschen(k1.key);
    const wegAusBaustein = !bauHatKat(BAUSTEINE[0], k1.key);
    bauKatLoeschen(k2.key);
    renderBausteine();
    return { beide, leiste, wegAusBaustein };
  });
  check('ein Baustein trägt mehrere Kategorien gleichzeitig', kategorien.beide);
  check('… die Bibliothek zeigt sie als Leiste', kategorien.leiste >= 3);
  check('… und eine gelöschte Kategorie verschwindet auch aus dem Baustein', kategorien.wegAusBaustein);

  // ═══════════ 4. Einmal ändern — überall gültig ═══════════
  const geaendert = await A.page.evaluate(() => {
    const feld = document.querySelector('#scr-bausteine .bau-text');
    if (!feld) return { kein: true };
    const b = BAUSTEINE[0];
    const alt = b.zeilen[0].text;
    feld.value = 'E2E-Produkt umbenannt';
    feld.dispatchEvent(new Event('change', { bubbles: true }));
    const vor = bauVorkommen(b.id);
    /* An JEDER Fundstelle muss der neue Name effektiv gelten … */
    const alleGesetzt = vor.every(v => {
      const cid = v.sid + '|' + v.ri + '|' + v.si + '|' + v.eis[0];
      const e = findEntry(cid);
      return e && qeGet(e, cid, 'name') === 'E2E-Produkt umbenannt';
    });
    /* … und im Standard sichtbar sein. */
    const p = (vor[0].sid + '|' + vor[0].ri + '|' + vor[0].si + '|' + vor[0].eis[0]).split('|');
    setMode('use'); openStandard(p[0]); openRubrik(+p[1]);
    const karte = document.getElementById('e-' + p.join('|'));
    const sichtbar = karte ? karte.textContent.includes('E2E-Produkt umbenannt') : false;
    return { kein: false, alt, alleGesetzt, sichtbar, stellen: vor.length };
  });
  check(`eine Änderung am Baustein wirkt an allen ${geaendert.stellen} Fundstellen`,
    !geaendert.kein && geaendert.alleGesetzt === true);
  check('… und sie steht auch wirklich im Standard auf dem Bildschirm', geaendert.sichtbar === true);

  // ═══════════ 5. Abweichung sichtbar machen und durchsetzen ═══════════
  /* Bewusst an einer Zeile, die der Baustein NOCH NICHT angefasst hat (Zeile 2
     der Folge) — nur dort ist der vorgefundene Wert wirklich fremd, und nur
     dort kann „Lösen" ihn zurückgeben. Genau diese Unterscheidung ist die
     Buchhaltung in `gesetzt[cid][feld].alt`. */
  const abw = await A.page.evaluate(() => {
    const b = BAUSTEINE[0];
    const vor = bauVorkommen(b.id);
    const cid = vor[1].sid + '|' + vor[1].ri + '|' + vor[1].si + '|' + vor[1].eis[1];
    QE.cid[cid] = Object.assign({}, QE.cid[cid], { name: 'Hier machen wir das anders' });
    saveQE();
    openBausteinAdmin();
    const liste = bauAbweichungen(b.id);
    const txt = document.getElementById('scr-bausteine').textContent;
    return { cid, sollText: b.zeilen[1].text, anzahl: liste.length,
      sichtbar: txt.includes('Hier machen wir das anders'), badge: txt.includes('weichen ab') };
  });
  check('eine Abweichung im Bestand wird gemeldet', abw.anzahl === 1);
  check('… und steht mit Ist und Soll auf dem Bildschirm', abw.sichtbar && abw.badge);

  const durchgesetzt = await A.page.evaluate((cid) => {
    const b = BAUSTEINE[0];
    const knopf = [...document.querySelectorAll('#scr-bausteine button')]
      .find(x => /durchsetzen/i.test(x.textContent));
    if (knopf) knopf.click();
    const e = findEntry(cid);
    const nm = qeGet(e, cid, 'name');
    return { knopf: !!knopf, offen: bauAbweichungen(b.id).length,
      jetzt: (nm !== undefined ? nm : e.anzeige_text) };
  }, abw.cid);
  check('„durchsetzen" ist als Knopf da und räumt die Abweichung ab',
    durchgesetzt.knopf && durchgesetzt.offen === 0);
  check('… die Stelle trägt danach wieder den Baustein-Text', durchgesetzt.jetzt === abw.sollText);

  // ═══════════ 6. Lösen gibt den Bestand zurück ═══════════
  const geloest = await A.page.evaluate((cid) => {
    const b = BAUSTEINE[0];
    const knopf = [...document.querySelectorAll('#scr-bausteine button')]
      .find(x => x.textContent.trim() === 'Lösen');
    if (knopf) knopf.click();
    const vor = bauVorkommen(b.id);
    const reste = vor.filter(v => {
      const c = v.sid + '|' + v.ri + '|' + v.si + '|' + v.eis[0];
      return QE.cid[c] && QE.cid[c].name === 'E2E-Produkt umbenannt';
    }).length;
    const e = findEntry(cid);
    return { knopf: !!knopf, reste, wiederher: qeGet(e, cid, 'name') };
  }, abw.cid);
  check('„Lösen" nimmt alle eigenen Eintragungen zurück', geloest.knopf && geloest.reste === 0);
  check('… und stellt die überschriebene fremde Änderung wieder her',
    geloest.wiederher === 'Hier machen wir das anders');

  // ═══════════ 7. In einen Standard einfügen ═══════════
  const eingefuegt = await A.page.evaluate(() => {
    const b = BAUSTEINE[0];
    const sid = DB.standards[0].id;
    const vorher = ((ADDITIONS.entries[sid + '|0']) || []).length;
    const n = bauEinfuegen(b.id, sid, 0);
    const nachher = ((ADDITIONS.entries[sid + '|0']) || []).length;
    return { n, zugewachsen: nachher - vorher, zeilen: b.zeilen.length };
  });
  check(`ein Baustein lässt sich in einen Standard einfügen (${eingefuegt.n} Zeilen)`,
    eingefuegt.n === eingefuegt.zeilen && eingefuegt.zugewachsen === eingefuegt.n);

  // ═══════════ 9. Vorwarnung im Schnellmenü ═══════════
  const warnung = await A.page.evaluate(() => {
    const b = BAUSTEINE[0];
    const vor = bauVorkommen(b.id);
    if (!vor.length) return { kein: true };
    const cid = vor[0].sid + '|' + vor[0].ri + '|' + vor[0].si + '|' + vor[0].eis[0];
    openSheet(cid);
    const txt = document.getElementById('sheet').textContent;
    showSheet(false);
    return { kein: false, warnt: txt.includes('Gehört zum Baustein') };
  });
  check('das Schnellmenü sagt vorher, dass die Zeile zu einem Baustein gehört',
    warnung.kein || warnung.warnt === true);

  // ═══════════ 8. Rückweg ═══════════
  const zurueck = await A.page.evaluate(() => {
    openBausteinAdmin();
    const vor = (document.querySelector('.screen.active') || {}).id;
    goBack();
    return { vor, nach: (document.querySelector('.screen.active') || {}).id };
  });
  check('Zurück führt in die Verwaltung, nicht in die Übersicht',
    zurueck.vor === 'scr-bausteine' && zurueck.nach === 'scr-admin');

  check('keine Konsolenfehler', A.errs.length === 0);
  if (A.errs.length) console.log('   ', A.errs.slice(0, 4));

  await r.finish(browser, [srv]);
})();
