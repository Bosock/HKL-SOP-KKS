/* END-TO-END: ANLEITUNGEN — vollständiger Funktionstest über ALLE Konstellationen.

   Anlass: „Anleitung antippen und aufrufen funktioniert nicht." Die erste
   Behebung deckte den Hauptweg ab — dieser Test geht systematisch JEDE
   Kombination durch, in der eine Anleitungs-Zeile entstehen kann:

     Bedienung   × Finger · Maus · langes Halten
     Sortierung  × Bereich (gruppiert) · A–Z · Favoriten · Meistgenutzt ·
                   Zuletzt · Fällig  (gruppiert und flach sind ZWEI Codewege!)
     Herkunft    × Übersicht · gefilterte Suche · globale Suche · Favorit
     Inhalt      × mit Schritten · ohne Schritte · Notfall · mit Intervall
     Rolle       × Verwaltung · normaler Nutzer
     Danach      × Abhaken · Zurück · Editor · Anlegen · Löschen

   Denn genau daran ist es gescheitert: Der Hauptweg wurde geprüft, die
   Konstellation (Touch + Zeile ohne bekanntes Attribut) nicht. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

/* Tippen wie mit dem FINGER. Gibt zurück, ob der native Klick unterdrückt
   wurde — genau dort lag der Fehler. */
const TIPP = `(el) => {
  const t = (typ) => { const ev = new TouchEvent(typ, { bubbles:true, cancelable:true,
      touches: typ==='touchend' ? [] : [new Touch({identifier:1,target:el,clientX:50,clientY:50})],
      changedTouches: [new Touch({identifier:1,target:el,clientX:50,clientY:50})] });
    el.dispatchEvent(ev); return ev; };
  t('touchstart'); const ende = t('touchend');
  if (!ende.defaultPrevented) el.click();
  return ende.defaultPrevented;
}`;
/* Klicken wie mit der MAUS (mousedown → mouseup → click). */
const KLICK = `(el) => ['mousedown','mouseup','click'].forEach(typ =>
  el.dispatchEvent(new MouseEvent(typ,{bubbles:true,cancelable:true,clientX:50,clientY:50})))`;

/* Testdaten: deckt alle Inhaltsvarianten ab. */
const SEED = `() => {
  GUIDES = [
    { id:'g-act',  titel:'ACT-Gerät: Chargennummer eingeben', bereich:'Geräte',
      kurz:'Nach jedem Chargenwechsel', intervall:'monatlich',
      schritte:[{id:'s1',text:'Menü öffnen'},{id:'s2',text:'Charge eintippen'},{id:'s3',text:'Bestätigen'}] },
    { id:'g-leer', titel:'Zebra-Anleitung ohne Schritte', bereich:'Sonstige', schritte:[] },
    { id:'g-nf',   titel:'Notfall: Defibrillator vorbereiten', bereich:'Notfall', notfall:true,
      schritte:[{id:'n1',text:'Paddles anschließen'}] },
    { id:'g-rhy',  titel:'Rhythmia aufbauen', bereich:'Aufbau', intervall:'täglich',
      schritte:[{id:'r1',text:'Wagen positionieren'},{id:'r2',text:'Kabel verbinden'}] },
  ];
  saveGuides();
}`;

(async () => {
  const r = reporter('anleitungen');
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);
  /* Nach jeder Berührung ignoriert die App Mausereignisse 700 ms lang
     (Geisterklick-Schutz). Zwischen Touch- und Maus-Abschnitten warten. */
  const entspann = () => new Promise(res => setTimeout(res, 800));

  // ═══════════ 1) ÖFFNEN IN JEDER SORTIERUNG (Finger) ═══════════
  // „Bereich" rendert GRUPPIERT, alle anderen FLACH — zwei verschiedene
  // Codewege in guideRowsHTML, beide müssen bedienbare Zeilen erzeugen.
  const sortierungen = await A.page.evaluate(({ tippSrc, seedSrc }) => {
    const tipp = eval('(' + tippSrc + ')'); eval('(' + seedSrc + ')')();
    doLogin('1234567');
    const erg = {};
    ['gruppe', 'alpha', 'fav', 'oft', 'neu', 'faellig'].forEach(sort => {
      setMode('use'); curSeg = 'anleitung'; curSort = sort;
      renderStandards(''); show('scr-standards');
      const row = document.querySelector('#scr-standards .std[data-gid="g-act"]');
      if (!row) { erg[sort] = { keineZeile: true }; return; }
      curGuide = null;
      tipp(row);
      erg[sort] = { screen: (document.querySelector('.screen.active') || {}).id,
        offen: curGuide && curGuide.id,
        zeilen: document.querySelectorAll('#scr-standards .std[data-gid]').length };
      setMode('use');
    });
    return erg;
  }, { tippSrc: TIPP, seedSrc: SEED });
  ['gruppe', 'alpha', 'fav', 'oft', 'neu', 'faellig'].forEach(sort => {
    const e = sortierungen[sort] || {};
    r.check('Finger öffnet Anleitung bei Sortierung „' + sort + '"',
      !e.keineZeile && e.screen === 'scr-guide' && e.offen === 'g-act');
  });
  r.check('Gruppierte und flache Darstellung listen dieselbe Anzahl',
    sortierungen.gruppe.zeilen === 4 && sortierungen.alpha.zeilen === 4);

  // ═══════════ 2) INHALTSVARIANTEN (Finger) ═══════════
  const varianten = await A.page.evaluate((tippSrc) => {
    const tipp = eval('(' + tippSrc + ')');
    const oeffne = (gid) => {
      setMode('use'); curSeg = 'anleitung'; curSort = 'alpha';
      renderStandards(''); show('scr-standards');
      const row = document.querySelector('#scr-standards .std[data-gid="' + gid + '"]');
      if (!row) return { keineZeile: true };
      curGuide = null; tipp(row);
      return { screen: (document.querySelector('.screen.active') || {}).id,
        offen: curGuide && curGuide.id,
        schritte: document.querySelectorAll('#scr-guide .g-step').length,
        leerHinweis: /Noch keine Schritte/.test(document.getElementById('scr-guide').innerHTML),
        nfBanner: /Notfall-Anleitung/.test(document.getElementById('scr-guide').innerHTML),
        intervall: /monatlich|täglich/.test(document.getElementById('scr-guide').innerHTML) };
    };
    return { mitSchritten: oeffne('g-act'), leer: oeffne('g-leer'),
      notfall: oeffne('g-nf'), intervall: oeffne('g-rhy') };
  }, TIPP);
  r.check('Anleitung MIT Schritten öffnet und zeigt sie',
    varianten.mitSchritten.offen === 'g-act' && varianten.mitSchritten.schritte === 3);
  r.check('Anleitung OHNE Schritte öffnet ebenfalls (mit Hinweis)',
    varianten.leer.offen === 'g-leer' && varianten.leer.leerHinweis === true);
  r.check('Notfall-Anleitung öffnet und ist als solche gekennzeichnet',
    varianten.notfall.offen === 'g-nf' && varianten.notfall.nfBanner === true);
  r.check('Anleitung mit Intervall zeigt es an',
    varianten.intervall.offen === 'g-rhy' && varianten.intervall.intervall === true);

  // ═══════════ 3) ⭐ FAVORIT IN DER ZEILE (Finger) ═══════════
  // Der Schalter liegt INNERHALB der Zeile. Ohne Ausnahme im Halte-Detektor
  // beansprucht dieser den Tipp — dann öffnet sich die Anleitung, statt den
  // Favoriten zu setzen. Am Schreibtisch fällt auch das nicht auf.
  const favTouch = await A.page.evaluate((tippSrc) => {
    const tipp = eval('(' + tippSrc + ')');
    setMode('use'); curSeg = 'anleitung'; curSort = 'alpha';
    FAV = {}; saveFav(); renderStandards(''); show('scr-standards');
    const btn = document.querySelector('#scr-standards .std[data-gid="g-act"] .fav-btn');
    if (!btn) return { keinKnopf: true };
    curGuide = null;
    tipp(btn);
    return { keinKnopf: false, favGesetzt: !!FAV['g-act'],
      screen: (document.querySelector('.screen.active') || {}).id,
      versehentlichGeoeffnet: !!curGuide };
  }, TIPP);
  r.check('⭐ mit dem Finger setzt den Favoriten', favTouch.favGesetzt === true);
  r.check('⭐ öffnet dabei NICHT die Anleitung',
    favTouch.versehentlichGeoeffnet === false && favTouch.screen === 'scr-standards');

  const favStd = await A.page.evaluate((tippSrc) => {
    const tipp = eval('(' + tippSrc + ')');
    setMode('use'); curSeg = 'standard'; curSort = 'alpha';
    FAV = {}; saveFav(); renderStandards(''); show('scr-standards');
    const row = document.querySelector('#scr-standards .std[data-sid]');
    const sid = row.dataset.sid;
    tipp(row.querySelector('.fav-btn'));
    return { fav: !!FAV[sid], screen: (document.querySelector('.screen.active') || {}).id };
  }, TIPP);
  r.check('⭐ verhält sich bei Standards genauso', favStd.fav === true && favStd.screen === 'scr-standards');

  // ═══════════ 4) MAUS-WEG (nach Entspannung des Geisterklick-Schutzes) ═══════════
  await entspann();
  const maus = await A.page.evaluate((klickSrc) => {
    const klick = eval('(' + klickSrc + ')');
    const erg = {};
    ['gruppe', 'alpha', 'faellig'].forEach(sort => {
      setMode('use'); curSeg = 'anleitung'; curSort = sort;
      renderStandards(''); show('scr-standards');
      let n = 0; const orig = window.openGuide;
      window.openGuide = function () { n++; return orig.apply(this, arguments); };
      curGuide = null;
      klick(document.querySelector('#scr-standards .std[data-gid="g-act"]'));
      window.openGuide = orig;
      erg[sort] = { n, screen: (document.querySelector('.screen.active') || {}).id, offen: curGuide && curGuide.id };
    });
    // ⭐ mit der Maus
    setMode('use'); curSeg = 'anleitung'; curSort = 'alpha';
    FAV = {}; saveFav(); renderStandards(''); show('scr-standards');
    curGuide = null;
    klick(document.querySelector('#scr-standards .std[data-gid="g-act"] .fav-btn'));
    erg.fav = { gesetzt: !!FAV['g-act'], geoeffnet: !!curGuide };
    return erg;
  }, KLICK);
  ['gruppe', 'alpha', 'faellig'].forEach(sort => {
    r.check('Maus öffnet Anleitung bei „' + sort + '" — genau einmal',
      maus[sort].screen === 'scr-guide' && maus[sort].offen === 'g-act' && maus[sort].n === 1);
  });
  r.check('⭐ mit der Maus setzt den Favoriten, ohne zu öffnen',
    maus.fav.gesetzt === true && maus.fav.geoeffnet === false);

  // ═══════════ 5) LANGES HALTEN → EDITOR (nur Verwaltung) ═══════════
  const halten = await A.page.evaluate(async () => {
    const halte = (el) => new Promise(res => {
      const t = (typ) => el.dispatchEvent(new TouchEvent(typ, { bubbles: true, cancelable: true,
        touches: typ === 'touchend' ? [] : [new Touch({ identifier: 1, target: el, clientX: 50, clientY: 50 })],
        changedTouches: [new Touch({ identifier: 1, target: el, clientX: 50, clientY: 50 })] }));
      t('touchstart'); setTimeout(() => { t('touchend'); res(); }, 620);   // > 500 ms Haltezeit
    });
    const lauf = async () => {
      setMode('use'); curSeg = 'anleitung'; curSort = 'alpha';
      renderStandards(''); show('scr-standards');
      await halte(document.querySelector('#scr-standards .std[data-gid="g-act"]'));
      return (document.querySelector('.screen.active') || {}).id;
    };
    doLogin('1234567');
    const alsAdmin = await lauf();
    setMode('use'); adminLogout();
    const alsNutzer = await lauf();
    doLogin('1234567');
    return { alsAdmin, alsNutzer };
  });
  r.check('Langes Halten öffnet den Anleitungs-Editor (Verwaltung)', halten.alsAdmin === 'scr-guide-edit');
  r.check('Ohne Anmeldung passiert beim Halten nichts', halten.alsNutzer === 'scr-standards');

  // ═══════════ 6) NORMALER NUTZER kann Anleitungen benutzen ═══════════
  const nutzer = await A.page.evaluate((tippSrc) => {
    const tipp = eval('(' + tippSrc + ')');
    adminLogout();
    setMode('use'); curSeg = 'anleitung'; curSort = 'alpha';
    renderStandards(''); show('scr-standards');
    const sichtbar = document.querySelectorAll('#scr-standards .std[data-gid]').length;
    const neuKnopf = /Neue Anleitung/.test(document.getElementById('scr-standards').innerHTML);
    curGuide = null;
    tipp(document.querySelector('#scr-standards .std[data-gid="g-act"]'));
    const bearbeiten = /✎ Bearbeiten/.test(document.getElementById('scr-guide').innerHTML);
    // Abhaken muss auch ohne Anmeldung gehen
    const cid = guideCid('g-act', 's1');
    toggleGuideCheck(cid);
    const abgehakt = !!checks[cid];
    doLogin('1234567');
    return { sichtbar, neuKnopf, offen: curGuide && curGuide.id, bearbeiten, abgehakt };
  }, TIPP);
  r.check('Ohne Anmeldung sind alle Anleitungen sichtbar und aufrufbar',
    nutzer.sichtbar === 4 && nutzer.offen === 'g-act');
  r.check('… ohne Bearbeiten-Knöpfe', nutzer.neuKnopf === false && nutzer.bearbeiten === false);
  r.check('… aber Schritte lassen sich abhaken', nutzer.abgehakt === true);

  // ═══════════ 7) SUCHE — in der Übersicht und global ═══════════
  await entspann();
  const suche = await A.page.evaluate((tippSrc) => {
    const tipp = eval('(' + tippSrc + ')');
    // a) gefilterte Übersicht
    setMode('use'); curSeg = 'anleitung'; curSort = 'alpha';
    renderStandards('rhythmia'); show('scr-standards');
    const gefiltert = document.querySelectorAll('#scr-standards .std[data-gid]').length;
    curGuide = null;
    const row = document.querySelector('#scr-standards .std[data-gid]');
    if (row) tipp(row);
    const ausFilter = { n: gefiltert, offen: curGuide && curGuide.id };
    // b) globale Suche (eigener Bildschirm, kein Halte-Detektor)
    setMode('use');
    openGlobalSearch('ACT');
    const treffer = document.querySelectorAll('#scr-search .srch-hit[data-gid]').length;
    curGuide = null;
    const hit = document.querySelector('#scr-search .srch-hit[data-gid]');
    if (hit) tipp(hit);
    return { ausFilter, global: { n: treffer, offen: curGuide && curGuide.id,
      screen: (document.querySelector('.screen.active') || {}).id } };
  }, TIPP);
  r.check('Suche in der Übersicht filtert und die Treffer sind bedienbar',
    suche.ausFilter.n === 1 && suche.ausFilter.offen === 'g-rhy');
  r.check('Globale Suche findet Anleitungen', suche.global.n >= 1);
  r.check('… und ihre Treffer öffnen die Anleitung',
    suche.global.offen === 'g-act' && suche.global.screen === 'scr-guide');

  // ═══════════ 8) ABHAKEN, FORTSCHRITT, ZURÜCKSETZEN ═══════════
  const haken = await A.page.evaluate(() => {
    checks = {}; saveChecks();
    openGuide('g-act');
    const p0 = guideProgress(curGuide);
    const schritt = document.querySelector('#scr-guide .g-step');
    schritt.click();                                   // kein Halte-Detektor auf diesem Bildschirm
    const p1 = guideProgress(curGuide);
    const markiert = schritt.classList.contains('done');
    renderGuide();
    const reset = /Alle zurücksetzen/.test(document.getElementById('scr-guide').innerHTML);
    guideResetChecks();
    return { p0: p0.done, gesamt: p0.total, p1: p1.done, markiert, reset,
      nachReset: guideProgress(curGuide).done };
  });
  r.check('Schritte lassen sich abhaken', haken.p0 === 0 && haken.p1 === 1 && haken.markiert === true);
  r.check('Fortschritt wird gezählt (x/y)', haken.gesamt === 3);
  r.check('„Alle zurücksetzen" erscheint und wirkt', haken.reset === true && haken.nachReset === 0);

  // ═══════════ 9) ZURÜCK-NAVIGATION ═══════════
  const zurueck = await A.page.evaluate(() => {
    setMode('use'); curSeg = 'anleitung'; renderStandards(''); show('scr-standards');
    openGuide('g-act');
    goBack();
    const nachZurueck = { screen: (document.querySelector('.screen.active') || {}).id,
      seg: curSeg, sucheSichtbar: document.getElementById('searchWrap').style.display !== 'none',
      zeilen: document.querySelectorAll('#scr-standards .std[data-gid]').length };
    // aus dem Editor zurück → wieder in der Anleitung
    openGuide('g-act'); openGuideEdit('g-act'); goBack();
    const ausEditor = (document.querySelector('.screen.active') || {}).id;
    return { nachZurueck, ausEditor };
  });
  r.check('Zurück aus der Anleitung landet wieder bei den ANLEITUNGEN (nicht bei den Standards)',
    zurueck.nachZurueck.screen === 'scr-standards' && zurueck.nachZurueck.seg === 'anleitung'
    && zurueck.nachZurueck.zeilen === 4);
  r.check('… und die Suchleiste ist wieder da', zurueck.nachZurueck.sucheSichtbar === true);
  r.check('Zurück aus dem Editor führt in die Anleitung', zurueck.ausEditor === 'scr-guide');

  // ═══════════ 10) EDITOR: anlegen · Schritte · speichern · löschen ═══════════
  const editor = await A.page.evaluate(() => {
    doLogin('1234567');
    const vorher = GUIDES.length;
    guideNew();
    const imEditor = (document.querySelector('.screen.active') || {}).id === 'scr-guide-edit';
    const neueId = guideEditId;
    document.getElementById('gTitel').value = 'Bestellung Schleusen auslösen';
    const bereich = document.getElementById('gBereich'); if (bereich) bereich.value = 'Bestellen';
    guideAddStep(); guideAddStep(); guideAddStep();
    const felder = [...document.querySelectorAll('#gSteps .ges-text')];
    felder.forEach((f, i) => { f.value = 'Schritt ' + (i + 1); });
    const nachAdd = felder.length;
    guideMoveStep(1, -1);                               // zweiten nach oben
    const reihenfolgeVorSpeichern = [...document.querySelectorAll('#gSteps .ges-text')].map(f => f.value);
    const origConfirm = window.confirm; window.confirm = () => true;
    guideDelStep(2);
    window.confirm = origConfirm;
    const nachDel = document.querySelectorAll('#gSteps .ges-text').length;
    guideSaveForm();
    const g = guideById(neueId);
    return { vorher, nachher: GUIDES.length, imEditor, nachAdd, nachDel,
      reihenfolge: reihenfolgeVorSpeichern,
      titel: g && g.titel, schritte: g && (g.schritte || []).length,
      screenNachSpeichern: (document.querySelector('.screen.active') || {}).id };
  });
  r.check('Neue Anleitung anlegen öffnet den Editor', editor.imEditor === true && editor.nachher === editor.vorher + 1);
  r.check('Schritte hinzufügen · verschieben · löschen', editor.nachAdd === 3 && editor.nachDel === 2
    && editor.reihenfolge[0] === 'Schritt 2');
  r.check('Speichern übernimmt Titel und Schritte',
    editor.titel === 'Bestellung Schleusen auslösen' && editor.schritte === 2);
  r.check('Nach dem Speichern steht man in der Anleitung', editor.screenNachSpeichern === 'scr-guide');

  // ═══════════ 11) Die neue Anleitung ist sofort per FINGER benutzbar ═══════════
  const frisch = await A.page.evaluate((tippSrc) => {
    const tipp = eval('(' + tippSrc + ')');
    const neu = GUIDES[GUIDES.length - 1];
    setMode('use'); curSeg = 'anleitung'; curSort = 'alpha';
    renderStandards(''); show('scr-standards');
    const row = document.querySelector('#scr-standards .std[data-gid="' + neu.id + '"]');
    if (!row) return { keineZeile: true };
    curGuide = null; tipp(row);
    return { offen: curGuide && curGuide.id, erwartet: neu.id,
      screen: (document.querySelector('.screen.active') || {}).id };
  }, TIPP);
  r.check('Eine gerade angelegte Anleitung lässt sich sofort mit dem Finger öffnen',
    !frisch.keineZeile && frisch.offen === frisch.erwartet && frisch.screen === 'scr-guide');

  // ═══════════ 12) LÖSCHEN ═══════════
  const loeschen = await A.page.evaluate(() => {
    const orig = window.confirm; window.confirm = () => true;
    const vorher = GUIDES.length;
    const id = GUIDES[GUIDES.length - 1].id;
    guideDelete(id);
    window.confirm = orig;
    return { vorher, nachher: GUIDES.length, weg: !guideById(id),
      screen: (document.querySelector('.screen.active') || {}).id };
  });
  r.check('Anleitung löschen entfernt sie und führt zurück zur Übersicht',
    loeschen.nachher === loeschen.vorher - 1 && loeschen.weg === true && loeschen.screen === 'scr-standards');

  // ═══════════ 13) BEREICHSWECHSEL & SORTIER-GÜLTIGKEIT ═══════════
  const wechsel = await A.page.evaluate(() => {
    setSeg('standard'); setSort('kosten');
    const kostenBeiStd = curSort;
    setSeg('anleitung');
    const nachWechsel = curSort;                       // „Kosten" gibt es bei Anleitungen nicht
    setSort('faellig');
    const faellig = curSort;
    setSeg('standard');
    const zurueck = curSort;                           // „Fällig" gibt es bei Standards nicht
    const chips = [...document.querySelectorAll('#scr-standards .sortchip')].map(c => c.textContent.trim());
    return { kostenBeiStd, nachWechsel, faellig, zurueck, chips };
  });
  r.check('Sortierung „Kosten" gilt bei Standards', wechsel.kostenBeiStd === 'kosten');
  r.check('… und fällt beim Wechsel zu Anleitungen sauber zurück', wechsel.nachWechsel === 'gruppe');
  r.check('Sortierung „Fällig" gilt bei Anleitungen und fällt bei Standards zurück',
    wechsel.faellig === 'faellig' && wechsel.zurueck === 'gruppe');
  r.check('Die Sortierleiste zeigt nur passende Sortierungen', !/Fällig/.test(wechsel.chips.join(' ')));

  // ═══════════ 14) NACH SERVER-ABGLEICH weiter bedienbar ═══════════
  const nachSync = await A.page.evaluate((tippSrc) => {
    const tipp = eval('(' + tippSrc + ')');
    setMode('use'); curSeg = 'anleitung'; curSort = 'alpha';
    renderStandards(''); show('scr-standards');
    hydrateVars();                                     // wie nach eingehenden Server-Daten
    renderStandards(''); show('scr-standards');
    const row = document.querySelector('#scr-standards .std[data-gid="g-act"]');
    if (!row) return { keineZeile: true };
    curGuide = null; tipp(row);
    return { offen: curGuide && curGuide.id, screen: (document.querySelector('.screen.active') || {}).id };
  }, TIPP);
  r.check('Nach einem Server-Abgleich bleiben Anleitungen bedienbar',
    !nachSync.keineZeile && nachSync.offen === 'g-act' && nachSync.screen === 'scr-guide');

  // ═══════════ 15) SELBSTTEST bestätigt die Bedienbarkeit ═══════════
  const selbsttest = await A.page.evaluate(() => {
    setMode('use'); curSeg = 'anleitung'; renderStandards(''); show('scr-standards');
    const P = diagChecks();
    const zeilen = P.find(p => p.titel === 'Übersichtszeilen sind bedienbar');
    const schalter = P.find(p => /Schalter/.test(p.titel));
    // Bedienbarkeit muss makellos sein. INHALTLICHE Befunde (hier: eine
    // Anleitung ohne Schritte aus den Testdaten) sind erwuenscht — der
    // Selbsttest soll sie ja melden.
    const bedienung = P.filter(p => /bedienbar|erreichbar|Bildschirme/.test(p.titel));
    return { zeilenOk: zeilen && zeilen.ok, schalterDa: !!schalter, schalterOk: schalter && schalter.ok,
      bedienungOk: bedienung.every(p => p.ok),
      meldetLeereAnleitung: P.some(p => /Anleitungen/.test(p.titel) && !p.ok && /ohne Schritte/.test(p.info || '')) };
  });
  r.check('Selbsttest: Übersichtszeilen bedienbar', selbsttest.zeilenOk === true);
  r.check('Selbsttest: Schalter in Zeilen erreichbar', selbsttest.schalterDa === true && selbsttest.schalterOk === true);
  r.check('Selbsttest: gesamte Bedienbarkeit ohne Befund', selbsttest.bedienungOk === true);
  r.check('Selbsttest meldet die Anleitung ohne Schritte (inhaltlicher Befund)',
    selbsttest.meldetLeereAnleitung === true);

  r.check('keine Konsolen-/Seitenfehler', A.errs.filter(e => !/favicon/i.test(e)).length === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
