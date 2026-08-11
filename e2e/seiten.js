/* E2E: Die Startseite als Register (features/seiten.js + aufgaben/aktuelles/
   bestellungen/kuerzel).

   Die reine Rechnerei — Wiederholtakte, Gültigkeit, Stufen — deckt
   test/seiten.test.js ab. Hier geht es um das, was ein Sandkasten nicht kann:

     · Sieht die Startseite AUSGELIEFERT genauso aus wie vorher? (Grundsatz ①)
     · Legt „＋" wirklich einen Reiter an, der auch trägt?
     · Öffnet LANGES TIPPEN auf einen Reiter dessen Bearbeitung?
     · Laufen die drei neuen Seiten als KETTE durch: Aufgabe anlegen → abhaken
       (Kürzel wird gefragt) → Verlauf; Aushang anlegen → beenden → abgelaufen;
       Meldung → bestellt → geliefert → Erledigt?
     · Und der Rückweg: „Auf Auslieferung zurücksetzen" stellt exakt den
       Anfangszustand her.

   Das Kürzel-Sheet wird echt bedient (tippen + „Übernehmen"), nicht umgangen —
   sonst prüfte die Suite genau die Stelle nicht, an der ein Nutzer hängen
   bleibt. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

(async () => {
  const r = reporter('seiten');
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);

  /* ═══════════ 1. Ausgeliefert: alles wie vorher ═══════════ */
  const aus = await A.page.evaluate(`(function(){
    const btn=[...document.querySelectorAll('#scr-standards .seg-btn')];
    return { n:btn.length, worte:btn.map(b=>b.textContent.replace(/\\s+/g,' ').trim()),
      ids:btn.map(b=>b.dataset.seite||''),
      gespeichert: seitenGeaendert(),
      plus: btn.some(b=>b.classList.contains('seg-neu')),
      aktiv: (seiteAktuell()||{}).id };
  })()`);
  r.check('ausgeliefert stehen genau zwei Reiter da', aus.n === 2);
  r.check('… unter denselben Kennungen wie vorher',
    JSON.stringify(aus.ids) === JSON.stringify(['standard', 'anleitung']));
  r.check('… mit denselben Wörtern', /Standards/.test(aus.worte[0]) && /Anleitungen/.test(aus.worte[1]));
  r.check('… und ohne dass irgendetwas gespeichert wäre', !aus.gespeichert);
  r.check('ohne Verwaltung gibt es kein „＋"', !aus.plus);
  r.check('die erste Seite ist die aktive', aus.aktiv === 'standard');

  /* ═══════════ 2. Umschalten trägt (der alte Weg lebt) ═══════════ */
  const um = await A.page.evaluate(`(function(){
    setSeg('anleitung');
    const a={ seg:curSeg, art:segArt(curSeg), istArt:seiteIstArt('anleitungen'),
      an:!!document.querySelector('.seg-btn[data-seite="anleitung"].on') };
    setSeg('standard');
    const b={ seg:curSeg, art:segArt(curSeg), listeDa:document.querySelectorAll('#scr-standards .std[data-sid]').length>0 };
    return { a, b };
  })()`);
  /* segArt() liefert bewusst die alten Einzahl-Wörter ('standard'/'anleitung'):
     daran hängt die Sortierleiste, und die soll nicht zweimal existieren. */
  r.check('der Reiter „Anleitungen" schaltet um und wird markiert',
    um.a.seg === 'anleitung' && um.a.art === 'anleitung' && um.a.istArt && um.a.an);
  r.check('zurück auf „Standards" steht die Liste wieder da',
    um.b.seg === 'standard' && um.b.art === 'standard' && um.b.listeDa);

  /* ═══════════ 3. Verwaltung: das „＋" erscheint ═══════════ */
  await A.page.evaluate(`doLogin('1234567')`);
  const admin = await A.page.evaluate(`(function(){
    renderStandards();
    return { plus: !!document.querySelector('#scr-standards .seg-btn.seg-neu'),
      arten: SEITEN_ARTEN.length };
  })()`);
  r.check(`in der Verwaltung steht „＋" in der Leiste (${admin.arten} Arten wählbar)`,
    admin.plus && admin.arten === 5);

  /* ═══════════ 4. Drei Seiten anlegen — durch echtes Klicken ═══════════ */
  await A.page.click('#scr-standards .seg-btn.seg-neu');
  await A.page.waitForSelector('#sheet .sheet-pick-btn[data-a="aufgaben"]', { timeout: 4000 });
  await A.page.click('#sheet .sheet-pick-btn[data-a="aufgaben"]');
  const nachAuf = await A.page.evaluate(`(function(){
    return { n:seitenAlle().length, aktiv:(seiteAktuell()||{}).id,
      reiter:document.querySelectorAll('#scr-standards .seg-btn[data-seite]').length,
      banner: !!document.querySelector('#scr-standards .banner h2'),
      titel: (document.querySelector('#scr-standards .banner h2')||{}).textContent||'',
      anlegen: !!document.querySelector('#scr-standards .add-entry-btn'),
      gespeichert: seitenGeaendert() };
  })()`);
  r.check('„＋ → Aufgaben" legt eine dritte Seite an', nachAuf.n === 3 && nachAuf.reiter === 3);
  r.check('… springt sofort dorthin und zeichnet sie', /Aufgaben/.test(nachAuf.titel) && nachAuf.banner);
  r.check('… erst jetzt steht überhaupt etwas im Speicher', nachAuf.gespeichert);
  r.check('… und die Seite bietet ihre eigene Anlage an', nachAuf.anlegen);

  await A.page.click('#scr-standards .seg-btn.seg-neu');
  await A.page.waitForSelector('#sheet .sheet-pick-btn[data-a="aktuelles"]', { timeout: 4000 });
  await A.page.click('#sheet .sheet-pick-btn[data-a="aktuelles"]');
  await A.page.click('#scr-standards .seg-btn.seg-neu');
  await A.page.waitForSelector('#sheet .sheet-pick-btn[data-a="bestellungen"]', { timeout: 4000 });
  await A.page.click('#sheet .sheet-pick-btn[data-a="bestellungen"]');
  const fuenf = await A.page.evaluate(`(function(){
    return { n:seitenAlle().length,
      arten:seitenAlle().map(s=>s.art),
      ids:seitenAlle().map(s=>s.id),
      eindeutig:new Set(seitenAlle().map(s=>s.id)).size===seitenAlle().length };
  })()`);
  r.check('fünf Seiten stehen in der Leiste', fuenf.n === 5 && fuenf.eindeutig);
  r.check('… in der Reihenfolge, in der sie angelegt wurden',
    JSON.stringify(fuenf.arten) === JSON.stringify(['standards', 'anleitungen', 'aufgaben', 'aktuelles', 'bestellungen']));

  /* Dieselbe Art zweimal — genau das war der Wunsch („Täglich" und „Wartung"). */
  const zweimal = await A.page.evaluate(`(function(){
    const s = seiteAnlegen('aufgaben','Wartung');
    seiteAuffrischen();
    const beide = seitenAlle().filter(x=>x.art==='aufgaben');
    return { id:s&&s.id, n:beide.length, worte:beide.map(x=>x.wort),
      verschieden: beide.length===2 && beide[0].id!==beide[1].id };
  })()`);
  r.check('dieselbe Art darf zweimal vorkommen — „Aufgaben" und „Wartung"',
    zweimal.n === 2 && zweimal.verschieden && zweimal.worte.indexOf('Wartung') >= 0);
  await A.page.evaluate(`(function(){ seiteLoeschen(${JSON.stringify(zweimal.id)}); seiteAuffrischen(); })()`);

  /* ═══════════ 5. LANGES TIPPEN auf den Reiter ═══════════ */
  const box = await A.page.evaluate(`(function(){
    setSeg('standard'); renderStandards();
    const b=document.querySelector('.seg-btn[data-seite="anleitung"]');
    const r=b.getBoundingClientRect();
    return { x:r.x+r.width/2, y:r.y+r.height/2 };
  })()`);
  await A.page.mouse.move(box.x, box.y);
  await A.page.mouse.down();
  await A.page.waitForTimeout(750);
  await A.page.mouse.up();
  const lang = await A.page.evaluate(`(function(){
    const s=document.getElementById('sheet');
    return { offen: s.classList.contains('show') || document.getElementById('sheetOv').classList.contains('show'),
      titel: (s.querySelector('.sheet-title')||{}).textContent||'',
      wortfeld: !!document.getElementById('stNeuWort'),
      icofeld: !!document.getElementById('stNeuIco'),
      /* Eine eingebaute Seite lässt sich ausblenden, aber nicht löschen. */
      loeschen: /Seite entfernen/.test(s.textContent),
      hinweis: /Auslieferung/.test(s.textContent),
      nichtGesprungen: curSeg==='standard' };
  })()`);
  r.check('LANGES TIPPEN auf einen Reiter öffnet dessen Bearbeitung',
    lang.offen && /Seite bearbeiten/.test(lang.titel));
  r.check('… mit Feldern für Wort und Symbol', lang.wortfeld && lang.icofeld);
  r.check('… und ohne dabei die Seite zu wechseln (Tippen ≠ Halten)', lang.nichtGesprungen);
  r.check('eine ausgelieferte Seite lässt sich NICHT löschen, nur ausblenden',
    !lang.loeschen && lang.hinweis);

  /* Umbenennen über das Sheet — echt getippt. */
  await A.page.fill('#stNeuWort', 'Abläufe');
  await A.page.fill('#stNeuIco', '📗');
  await A.page.click('#sheet .btn-pri');
  const benannt = await A.page.evaluate(`(function(){
    const s=seiteNach('anleitung');
    const b=document.querySelector('.seg-btn[data-seite="anleitung"]');
    return { wort:s.wort, ico:s.ico, imReiter:(b?b.textContent:'').replace(/\\s+/g,' ').trim(),
      artBleibt:s.art };
  })()`);
  r.check('umbenennen wirkt sofort in der Leiste',
    benannt.wort === 'Abläufe' && /📗 Abläufe/.test(benannt.imReiter));
  r.check('… die ART bleibt dabei unangetastet', benannt.artBleibt === 'anleitungen');

  /* Leeres Wort = zurück auf die Vorgabe. */
  await A.page.evaluate(`seiteSheet('anleitung')`);
  await A.page.fill('#stNeuWort', '');
  await A.page.fill('#stNeuIco', '');
  await A.page.click('#sheet .btn-pri');
  const zurueck = await A.page.evaluate(`(function(){
    const s=seiteNach('anleitung');
    return { wort:s.wort, ico:s.ico, rohLeer: !SEITEN.find(x=>x.id==='anleitung').wort };
  })()`);
  r.check('ein leeres Wort bedeutet „wieder wie ausgeliefert"',
    zurueck.wort === 'Anleitungen' && zurueck.ico === '📘' && zurueck.rohLeer);

  /* Verschieben und Ausblenden. */
  const schieb = await A.page.evaluate(`(function(){
    const vor=seitenAlle().map(s=>s.id);
    seiteUiVerschieben('anleitung',1);
    const nach=seitenAlle().map(s=>s.id);
    seiteUiVerschieben('anleitung',-1);
    const wieder=seitenAlle().map(s=>s.id);
    return { vor, nach, wieder, geaendert:JSON.stringify(vor)!==JSON.stringify(nach),
      identisch:JSON.stringify(vor)===JSON.stringify(wieder) };
  })()`);
  r.check('„➡ nach rechts" ändert die Reihenfolge', schieb.geaendert);
  r.check('„⬅ nach links" bringt sie zurück', schieb.identisch);

  const versteckt = await A.page.evaluate(`(function(){
    seiteUiSchalten('anleitung');
    showSheet(false); renderStandards();
    const inVerwaltung=document.querySelectorAll('#scr-standards .seg-btn[data-seite]').length;
    const markiert=!!document.querySelector('.seg-btn[data-seite="anleitung"].seg-aus');
    /* Wirklich abmelden, nicht nur den Modus wechseln: „ausgeblendet" gilt
       gegenüber NUTZERN, nicht gegenüber einem angemeldeten Verwalter, der
       gerade in der Leseansicht steht. */
    adminLogout(); renderStandards();
    const fuerNutzer=document.querySelectorAll('#scr-standards .seg-btn[data-seite]').length;
    const wegFuerNutzer=!document.querySelector('.seg-btn[data-seite="anleitung"]');
    const keinPlus=!document.querySelector('#scr-standards .seg-btn.seg-neu');
    doLogin('1234567');
    seiteUiSchalten('anleitung'); showSheet(false); renderStandards();
    return { inVerwaltung, markiert, fuerNutzer, wegFuerNutzer, keinPlus,
      wiederDa:!!document.querySelector('.seg-btn[data-seite="anleitung"]') };
  })()`);
  r.check('ausgeblendet ist die Seite für Nutzer weg …',
    versteckt.wegFuerNutzer && versteckt.fuerNutzer === versteckt.inVerwaltung - 1);
  r.check('… und ohne Anmeldung gibt es auch kein „＋"', versteckt.keinPlus);
  r.check('… in der Verwaltung aber sichtbar und als „aus" markiert', versteckt.markiert);
  r.check('… und wieder einblendbar', versteckt.wiederDa);

  /* ═══════════ 6. Kette Aufgaben: anlegen → abhaken → Verlauf ═══════════ */
  const aufId = await A.page.evaluate(`(function(){
    const s=seitenAlle().find(x=>x.art==='aufgaben');
    curSeg=s.id; renderStandards();
    return s.id;
  })()`);
  await A.page.click('#scr-standards .add-entry-btn');
  await A.page.waitForSelector('#aufWort', { timeout: 4000 });
  await A.page.fill('#aufWort', 'Notfallwagen prüfen');
  await A.page.fill('#aufOrt', 'HKL 3');
  await A.page.selectOption('#aufTakt', 'woechentlich');
  await A.page.click('#scr-standards .auf-form .btn-pri');
  const angelegt = await A.page.evaluate(`(function(){
    const l=aufgabenFuer(seiteNach(${JSON.stringify(aufId)}));
    return { n:l.length, wort:(l[0]||{}).wort, ort:(l[0]||{}).ort,
      karte:document.querySelectorAll('#scr-standards .auf-karte').length,
      haken:!!document.querySelector('#scr-standards .auf-haken'),
      nie:/noch nie erledigt/.test(document.getElementById('scr-standards').textContent),
      zaehler:(document.querySelector('.seg-btn[data-seite="'+${JSON.stringify(aufId)}+'"] .seg-n')||{}).textContent };
  })()`);
  r.check('eine Aufgabe lässt sich über das Formular anlegen',
    angelegt.n === 1 && angelegt.wort === 'Notfallwagen prüfen' && angelegt.ort === 'HKL 3');
  r.check('… sie steht als Karte mit Haken auf der Seite', angelegt.karte === 1 && angelegt.haken);
  r.check('… und ehrlich als „noch nie erledigt" markiert', angelegt.nie);
  r.check('der Reiter trägt die Zahl der offenen Aufgaben', String(angelegt.zaehler).trim() === '1');

  /* Abhaken: das Kürzel wird EINMAL gefragt und danach nie wieder. */
  await A.page.click('#scr-standards .auf-haken');
  await A.page.waitForSelector('#krzInp', { timeout: 4000 });
  const gefragt = await A.page.evaluate(`(function(){
    return { titel:(document.querySelector('#sheet .sheet-title')||{}).textContent||'',
      ohne: /Ohne Kürzel/.test(document.getElementById('sheet').textContent) };
  })()`);
  r.check('beim ersten Haken wird nach dem Kürzel gefragt', /Wer bist du/.test(gefragt.titel));
  r.check('… und man darf auch ohne weitermachen (leer schlägt falsch)', gefragt.ohne);
  await A.page.fill('#krzInp', 'MB');
  await A.page.click('#sheet .btn-pri');
  await A.page.waitForTimeout(150);
  const gehakt = await A.page.evaluate(`(function(){
    const a=aufgabenFuer(seiteNach(${JSON.stringify(aufId)}))[0];
    const txt=document.getElementById('scr-standards').textContent;
    return { verlauf:(a.verlauf||[]).length, krz:(a.verlauf[0]||{}).kuerzel, ts:!!(a.verlauf[0]||{}).ts,
      faellig:a.faellig, imText:/MB/.test(txt), zuletzt:/zuletzt/.test(txt),
      gespeichert:kuerzel(), sheetZu:!document.getElementById('sheet').classList.contains('show') };
  })()`);
  r.check('der Haken trägt Kürzel UND Uhrzeit', gehakt.verlauf === 1 && gehakt.krz === 'MB' && gehakt.ts);
  r.check('… und steht sichtbar als „zuletzt … MB" auf der Karte', gehakt.imText && gehakt.zuletzt);
  r.check('das Kürzel bleibt am Gerät gespeichert', gehakt.gespeichert === 'MB');
  r.check('das Sheet schließt sich nach dem Übernehmen', gehakt.sheetZu);

  const wieder = await A.page.evaluate(`(function(){
    const a=aufgabenFuer(seiteNach(${JSON.stringify(aufId)}))[0];
    const heute=aufHeute();
    return { faellig:a.faellig, inZukunft:a.faellig>heute, heute };
  })()`);
  r.check('nach dem Haken steht die Aufgabe erneut an — in der Zukunft', wieder.inZukunft);

  /* Zweiter Haken: keine Nachfrage mehr. */
  await A.page.click('#scr-standards .auf-haken');
  await A.page.waitForTimeout(200);
  const zweiter = await A.page.evaluate(`(function(){
    const a=aufgabenFuer(seiteNach(${JSON.stringify(aufId)}))[0];
    /* Der Inhalt des Sheets bleibt nach dem Schließen stehen — entscheidend
       ist, ob es SICHTBAR ist. */
    return { verlauf:(a.verlauf||[]).length,
      keinSheet:!document.getElementById('sheet').classList.contains('show') };
  })()`);
  r.check('beim zweiten Haken wird NICHT wieder gefragt', zweiter.keinSheet && zweiter.verlauf === 2);

  /* Verlauf aufklappen und den letzten Haken zurücknehmen. */
  await A.page.evaluate(`aufUiVerlauf(aufgabenFuer(seiteNach(${JSON.stringify(aufId)}))[0].id)`);
  const verlauf = await A.page.evaluate(`(function(){
    const zeilen=document.querySelectorAll('#scr-standards .auf-vz').length;
    const zurueckKnopf=!!document.querySelector('#scr-standards .auf-vzurueck');
    const vorher=aufgabenFuer(seiteNach(${JSON.stringify(aufId)}))[0].faellig;
    aufUiZurueck(aufgabenFuer(seiteNach(${JSON.stringify(aufId)}))[0].id);
    const a=aufgabenFuer(seiteNach(${JSON.stringify(aufId)}))[0];
    return { zeilen, zurueckKnopf, vorher, nachher:a.faellig, verlauf:(a.verlauf||[]).length };
  })()`);
  r.check('der Verlauf zeigt beide Haken', verlauf.zeilen === 2 && verlauf.zurueckKnopf);
  r.check('„↺ zurücknehmen" löscht den Haken und stellt den Termin zurück',
    verlauf.verlauf === 1 && verlauf.nachher !== verlauf.vorher);

  /* ═══════════ 6b. Langes Tippen auf die Karte bearbeitet sie ═══════════ */
  const kartePos = await A.page.evaluate(`(function(){
    aufUiVerlauf(null); seiteAuffrischen();
    const k=document.querySelector('#scr-standards .auf-karte');
    if(!k) return { kein:true };
    const r=k.getBoundingClientRect();
    return { kein:false, kennung:k.dataset.i, x:r.x+r.width*0.55, y:r.y+r.height/2 };
  })()`);
  r.check('jede Karte trägt ihre Kennung an der Wurzel — sonst greift der Halte-Detektor ins Leere',
    !kartePos.kein && !!kartePos.kennung);
  await A.page.mouse.move(kartePos.x, kartePos.y);
  await A.page.mouse.down();
  await A.page.waitForTimeout(750);
  await A.page.mouse.up();
  const langKarte = await A.page.evaluate(`(function(){
    const auf=!!document.getElementById('aufWort');
    if(auf) aufUiAbbrechen();
    return { auf, verlauf:aufgabenFuer(seiteNach(${JSON.stringify(aufId)}))[0].verlauf.length };
  })()`);
  r.check('LANGES TIPPEN auf eine Aufgabenkarte öffnet ihre Bearbeitung', langKarte.auf);
  r.check('… ohne dabei versehentlich abzuhaken', langKarte.verlauf === 1);

  /* ═══════════ 7. Kette Aktuelles: aushängen → beenden ═══════════ */
  const aktSid = await A.page.evaluate(`(function(){
    const s=seitenAlle().find(x=>x.art==='aktuelles'); curSeg=s.id; renderStandards(); return s.id;
  })()`);
  await A.page.click('#scr-standards .add-entry-btn');
  await A.page.waitForSelector('#aktWort', { timeout: 4000 });
  await A.page.fill('#aktWort', 'HKL 3 — Notfall aufliegend');
  await A.page.fill('#aktOrt', 'HKL 3');
  await A.page.selectOption('#aktArt', 'notfall');
  await A.page.click('#scr-standards .auf-form .btn-pri');
  await A.page.waitForTimeout(150);
  const ausgehaengt = await A.page.evaluate(`(function(){
    const g=aktGeltende();
    const txt=document.getElementById('scr-standards').textContent;
    return { n:g.length, art:(g[0]||{}).art, laut:!!document.querySelector('#scr-standards .akt-karte.akt-laut'),
      bis:!!(g[0]||{}).bis, rest:/Std|Min|bis/.test(txt),
      zaehler:(document.querySelector('.seg-btn[data-seite="'+${JSON.stringify(aktSid)}+'"] .seg-n')||{}).textContent };
  })()`);
  r.check('ein Aushang lässt sich anlegen und gilt sofort', ausgehaengt.n === 1 && ausgehaengt.art === 'notfall');
  r.check('ein Notfall wird laut dargestellt', ausgehaengt.laut);
  r.check('jeder Aushang hat von sich aus ein Ende', ausgehaengt.bis && ausgehaengt.rest);
  r.check('der Reiter zeigt, wie viel gerade gilt', String(ausgehaengt.zaehler).trim() === '1');

  const verlaengert = await A.page.evaluate(`(function(){
    const id=aktGeltende()[0].id;
    const vor=aktNach(id).bis;
    aktUiVerlaengern(id,2);
    const nach=aktNach(id).bis;
    aktUiBeenden(id);
    const g=aktGeltende().length, alt=aktAbgelaufene().length;
    aktUiAlt();
    const sichtbar=document.querySelectorAll('#scr-standards .akt-karte.akt-alt').length;
    return { verlaengert:nach>vor, g, alt, sichtbar, nochDa:!!aktNach(id) };
  })()`);
  r.check('„+2 Std." verlängert vom bestehenden Ende aus', verlaengert.verlaengert);
  r.check('„Beenden" nimmt den Aushang aus der Pinnwand …', verlaengert.g === 0 && verlaengert.alt === 1);
  r.check('… löscht ihn aber nicht — er bleibt unter „Abgelaufen" lesbar',
    verlaengert.nochDa && verlaengert.sichtbar === 1);

  /* ═══════════ 8. Kette Bestellungen: gemeldet → bestellt → geliefert ═══════════ */
  const bestSid = await A.page.evaluate(`(function(){
    const s=seitenAlle().find(x=>x.art==='bestellungen'); curSeg=s.id; renderStandards(); return s.id;
  })()`);
  await A.page.click('#scr-standards .add-entry-btn');
  await A.page.waitForSelector('#bestWort', { timeout: 4000 });
  await A.page.fill('#bestWort', 'Führungskatheter JR4');
  await A.page.fill('#bestNotiz', 'letzte Packung offen');
  await A.page.click('#scr-standards .auf-form .btn-pri');
  await A.page.waitForTimeout(150);
  const gemeldet = await A.page.evaluate(`(function(){
    const b=bestOffen()[0];
    return { n:bestOffen().length, stufe:bestStufe(b), krz:(b.gemeldet||{}).kuerzel, ts:!!(b.gemeldet||{}).ts,
      karte:document.querySelectorAll('#scr-standards .best-karte').length,
      spur:document.querySelectorAll('#scr-standards .best-schritt').length,
      erledigtSchritte:document.querySelectorAll('#scr-standards .best-schritt.on').length,
      id:b.id };
  })()`);
  r.check('eine Meldung entsteht und steht auf „gemeldet"',
    gemeldet.n === 1 && gemeldet.stufe === 'gemeldet');
  r.check('… mit Kürzel und Uhrzeit, ohne erneute Nachfrage', gemeldet.krz === 'MB' && gemeldet.ts);
  r.check('die Karte zeigt alle drei Stufen, davon eine erreicht',
    gemeldet.karte === 1 && gemeldet.spur === 3 && gemeldet.erledigtSchritte === 1);

  await A.page.click('#scr-standards .best-karte .btn-pri');
  await A.page.waitForTimeout(150);
  const bestellt = await A.page.evaluate(`(function(){
    const b=bestNach(${JSON.stringify(gemeldet.id)});
    return { stufe:bestStufe(b), krz:(b.bestellt||{}).kuerzel,
      erreicht:document.querySelectorAll('#scr-standards .best-schritt.on').length,
      zurueckKnopf:!!document.querySelector('#scr-standards .best-karte .btn-sec') };
  })()`);
  r.check('ein Schritt weiter: „bestellt", wieder mit Kürzel',
    bestellt.stufe === 'bestellt' && bestellt.krz === 'MB' && bestellt.erreicht === 2);
  r.check('ab der zweiten Stufe gibt es einen Rückweg', bestellt.zurueckKnopf);

  await A.page.click('#scr-standards .best-karte .btn-pri');
  await A.page.waitForTimeout(150);
  const geliefert = await A.page.evaluate(`(function(){
    const b=bestNach(${JSON.stringify(gemeldet.id)});
    const offenKarten=document.querySelectorAll('#scr-standards .best-karte:not(.best-alt)').length;
    bestUiAlt();
    return { stufe:bestStufe(b), offen:bestOffen().length, erledigt:bestErledigt().length,
      offenKarten, altSichtbar:document.querySelectorAll('#scr-standards .best-karte.best-alt').length,
      zaehler:(document.querySelector('.seg-btn[data-seite="'+${JSON.stringify(bestSid)}+'"] .seg-n')||{}).textContent };
  })()`);
  r.check('nach „geliefert" ist die Meldung erledigt',
    geliefert.stufe === 'geliefert' && geliefert.offen === 0 && geliefert.erledigt === 1);
  r.check('… verschwindet aus den offenen Meldungen …', geliefert.offenKarten === 0);
  r.check('… bleibt aber unter „Erledigt" nachlesbar', geliefert.altSichtbar === 1);
  r.check('der Reiter zählt nur, was offen ist', String(geliefert.zaehler || '').trim() === '');

  const zurueckStufe = await A.page.evaluate(`(function(){
    bestUiZurueck(${JSON.stringify(gemeldet.id)});
    const b=bestNach(${JSON.stringify(gemeldet.id)});
    return { stufe:bestStufe(b), offen:bestOffen().length };
  })()`);
  r.check('ein Schritt zurück ist möglich, wenn jemand zu früh geklickt hat',
    zurueckStufe.stufe === 'bestellt' && zurueckStufe.offen === 1);

  /* ═══════════ 9. Aus dem Material heraus melden ═══════════ */
  const ausMat = await A.page.evaluate(`(function(){
    const vor=bestOffen().length;
    const m=(typeof pfMaterialien==='function') ? pfMaterialien()[0] : null;
    if(!m) return { kein:true };
    bestAusMaterial(m.key, m.name);
    const b=bestOffen().find(x=>x.matKey===m.key);
    return { kein:false, vor, nach:bestOffen().length, wort:b&&b.wort, name:m.name,
      gesprungen:curSeg===${JSON.stringify(bestSid)},
      zeile:(typeof bestMatZeile==='function' && b) ? bestMatZeile(b) : null };
  })()`);
  r.check('aus einer Materialzeile heraus lässt sich „ist leer" melden',
    !ausMat.kein && ausMat.nach === ausMat.vor + 1 && ausMat.wort === ausMat.name);
  r.check('… und die App springt auf die Bestell-Seite', ausMat.gesprungen);

  /* ═══════════ 9b. Die mitwachsende Bestell-Datenbank (Bestätigung zuerst) ═══════════
     Ein Scan hinterlässt einen VORSCHLAG. Erst die Bestätigung im Admin-Panel
     macht daraus eine verlässliche Verknüpfung — und ab da zahlt das Formular
     ohne Foto aus. Wir setzen den Vorschlag direkt (die Kamera ist headless
     nicht ansprechbar) und prüfen den Weg dahinter. */
  const vorschlag = await A.page.evaluate(`(function(){
    const m=pfMaterialien()[0];
    GTINDB['04012345']={ gtin:'04012345', name:'Launcher '+m.name, ref:'LA35', hersteller:'Medtronic', lagerort:'Schrank 2' };
    saveGtinDB();
    bestLernErfassen(m.key, '04012345', { name:'Launcher '+m.name, ref:'LA35' });
    bestZeigeLern=true; seiteAuffrischen();
    return { key:m.key, name:m.name, status:bestLernStatus(m.key),
      panel:!!document.querySelector('#scr-standards .best-lern-panel'),
      zeilen:document.querySelectorAll('#scr-standards .best-lern-zeile').length,
      daten:bestBestelldaten(m.key) };
  })()`);
  r.check('ein Scan-Vorschlag steht als „vorschlag", noch nicht verlinkt',
    vorschlag.status === 'vorschlag' && vorschlag.daten === null);
  r.check('das Admin-Panel zeigt den offenen Vorschlag zum Bestätigen',
    vorschlag.panel && vorschlag.zeilen === 1);

  const bestaetigt = await A.page.evaluate(`(function(){
    document.querySelector('#scr-standards .best-lern-zeile .btn-pri').click();
    const d=bestBestelldaten(${JSON.stringify(vorschlag.key)});
    return { status:bestLernStatus(${JSON.stringify(vorschlag.key)}), ref:d&&d.ref, herst:d&&d.hersteller,
      panelWeg:!document.querySelector('#scr-standards .best-lern-panel') };
  })()`);
  r.check('Bestätigen verlinkt das Material und liefert die Bestelldaten',
    bestaetigt.status === 'verlinkt' && bestaetigt.ref === 'LA35' && bestaetigt.herst === 'Medtronic');
  r.check('… und der Vorschlag verschwindet aus der Prüfliste', bestaetigt.panelWeg);

  await A.page.click('#scr-standards .add-entry-btn');
  await A.page.waitForSelector('#bestWort', { timeout: 4000 });
  await A.page.fill('#bestWort', vorschlag.name);
  const ohneFoto = await A.page.evaluate(`(function(){
    bestDatenZeigen();
    const box=document.querySelector('#bestDaten .best-daten-ok');
    return { sichtbar:!!box, text:box?box.textContent:'', gtin:bestScanState.gtin };
  })()`);
  r.check('bei erneuter Meldung stehen die Bestelldaten sofort da — ohne Foto',
    ohneFoto.sichtbar && /kein Foto/.test(ohneFoto.text) && ohneFoto.gtin === '04012345');
  await A.page.evaluate(`bestUiAbbrechen()`);

  /* ═══════════ 10. Löschen und Zurücksetzen ═══════════ */
  const weg = await A.page.evaluate(`(function(){
    const s=seitenAlle().find(x=>x.art==='bestellungen');
    seiteSheet(s.id);
    const angeboten=/Seite entfernen/.test(document.getElementById('sheet').textContent);
    seiteUiLoeschen(s.id);              /* erster Klick = Rückfrage */
    const frage=/Seite entfernen\\?/.test(document.getElementById('sheet').textContent);
    const nochDa=!!seiteNach(s.id);
    seiteUiLoeschen(s.id);              /* zweiter Klick = wirklich */
    return { angeboten, frage, nochDa, jetztWeg:!seiteNach(s.id), n:seitenAlle().length,
      inhalteBleiben:BEST.length>0, id:s.id };
  })()`);
  r.check('eine selbst angelegte Seite lässt sich entfernen', weg.angeboten);
  r.check('… aber erst nach einer Rückfrage (kein natives Fenster)', weg.frage && weg.nochDa);
  r.check('… danach ist der Reiter weg', weg.jetztWeg && weg.n === 4);
  r.check('… die Meldungen dahinter bleiben gespeichert (nichts verschluckt)', weg.inhalteBleiben);

  const heim = await A.page.evaluate(`(function(){
    /* Kommt die Seite zurück, sind die alten Meldungen wieder da. */
    const s=seiteAnlegen('bestellungen'); seiteAuffrischen();
    return { wiederDa:bestOffen().length>0, id:s.id };
  })()`);
  r.check('legt man die Art neu an, sind die Inhalte wieder da', heim.wiederDa);

  const reset = await A.page.evaluate(`(function(){
    seitenPanelZuruecksetzen();
    renderStandards();
    const btn=[...document.querySelectorAll('#scr-standards .seg-btn[data-seite]')];
    return { ids:btn.map(b=>b.dataset.seite), worte:btn.map(b=>b.textContent.replace(/\\s+/g,' ').trim()),
      gespeichert:seitenGeaendert(),
      /* Die Inhalte der entfernten Seiten sind NICHT gelöscht. */
      aufgabenDa:AUFG.length>0, aushaengeDa:AKTU.length>0, meldungenDa:BEST.length>0 };
  })()`);
  r.check('„Auf Auslieferung zurücksetzen" stellt exakt die zwei Reiter her',
    JSON.stringify(reset.ids) === JSON.stringify(['standard', 'anleitung']) && !reset.gespeichert);
  r.check('… mit den ausgelieferten Wörtern', /Standards/.test(reset.worte[0]) && /Anleitungen/.test(reset.worte[1]));
  r.check('… und ohne die Inhalte dahinter zu löschen',
    reset.aufgabenDa && reset.aushaengeDa && reset.meldungenDa);

  /* ═══════════ 11. Der Zustand überlebt einen Neustart ═══════════ */
  await A.page.evaluate(`(function(){ seiteAnlegen('aufgaben','Wochencheck'); saveSeiten(); })()`);
  await A.page.waitForTimeout(600);
  const B = await bootPage(browser, srv.base);
  const neu = await B.page.evaluate(`(function(){
    const btn=[...document.querySelectorAll('#scr-standards .seg-btn[data-seite]')];
    return { n:btn.length, worte:btn.map(b=>b.textContent.replace(/\\s+/g,' ').trim()),
      aufgaben:AUFG.length, krz:kuerzel() };
  })()`);
  r.check('nach einem Neustart steht der neue Reiter noch da',
    neu.n === 3 && neu.worte.some(w => /Wochencheck/.test(w)));
  r.check('… samt der Aufgaben dahinter', neu.aufgaben >= 1);
  r.check('das Kürzel ist GERÄTELOKAL — das zweite Gerät kennt es nicht', neu.krz === '');

  r.check('keine Konsolenfehler', A.errs.length === 0 && B.errs.length === 0);
  if (A.errs.length) console.error(A.errs.slice(0, 5));
  if (B.errs.length) console.error(B.errs.slice(0, 5));
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
