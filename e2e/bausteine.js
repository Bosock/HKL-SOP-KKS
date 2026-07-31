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

  // ═══════════ 2. Erkennung am echten Bestand ═══════════
  const funde = await A.page.evaluate(() => {
    const vs = bauVorschlaege();
    const txt = document.getElementById('scr-bausteine').textContent;
    return { anzahl: vs.length, ersparnis: vs.reduce((n, k) => n + k.ersparnis, 0),
      top: vs[0] ? { std: vs[0].standards.length, len: vs[0].laenge } : null,
      zeigtListe: txt.includes('Gefundene Wiederholungen'),
      knoepfe: document.querySelectorAll('#scr-bausteine .bau-vor').length };
  });
  check(`am echten Bestand werden Wiederholungen gefunden (${funde.anzahl})`, funde.anzahl >= 20);
  check(`… mit messbarem Nutzen (${funde.ersparnis} doppelt gepflegte Zeilen)`, funde.ersparnis > 400);
  check(`… die stärkste steht in ${funde.top ? funde.top.std : 0} Standards`, !!funde.top && funde.top.std >= 5);
  check('… und sie stehen als Vorschläge auf dem Bildschirm', funde.zeigtListe && funde.knoepfe > 0);

  // ═══════════ 3. Anlegen über die Bedienoberfläche ═══════════
  const angelegt = await A.page.evaluate(() => {
    const knopf = [...document.querySelectorAll('#scr-bausteine button')]
      .find(b => /Als Baustein anlegen/.test(b.textContent));
    if (!knopf) return { kein: true };
    knopf.click();
    const b = BAUSTEINE[0];
    const vor = b ? bauVorkommen(b.id) : [];
    return { kein: false, name: b && b.name, zeilen: b ? b.zeilen.length : 0,
      stellen: vor.length, standards: [...new Set(vor.map(v => v.sid))].length,
      cid0: vor.length ? (vor[0].sid + '|' + vor[0].ri + '|' + vor[0].si + '|' + vor[0].eis[0]) : null,
      inListe: document.getElementById('scr-bausteine').textContent.includes('Deine Bausteine') };
  });
  check('ein Vorschlag lässt sich per Knopf anlegen', !angelegt.kein && angelegt.name === 'E2E-Baustein');
  check(`… er findet seine Fundstellen (${angelegt.stellen} in ${angelegt.standards} Standards)`,
    angelegt.stellen >= 3 && angelegt.standards >= 3);
  check('… und steht danach oben in der Liste', angelegt.inListe === true);

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
