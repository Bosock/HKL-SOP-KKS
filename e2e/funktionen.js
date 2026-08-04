/* E2E: Funktionsregister — Menü und Verwaltungs-Karten ohne Programmierung. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('/home/user/HKL-SOP-KKS/e2e/util');

(async () => {
  const r = reporter('funktionen');
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);
  await A.page.evaluate(`doLogin('1234567')`);

  const m = await A.page.evaluate(`(function(){
    openMenu();
    const txt = document.getElementById('sheet').textContent;
    return { hatAnleitung:/Anleitung/.test(txt), hatRegister:/Menü & Funktionen/.test(txt),
             n: document.querySelectorAll('#sheet .sheet-act').length };
  })()`);
  r.check('Menü kommt aus dem Register (' + m.n + ' Punkte)', m.n > 10);
  r.check('„Anleitung" steht im Menü', m.hatAnleitung);
  r.check('„Menü & Funktionen" ist erreichbar', m.hatRegister);

  const aus = await A.page.evaluate(`(function(){
    fktSetzen('menue','glossar','aus',true);
    openMenu();
    const weg = !/Abkürzungsglossar/.test(document.getElementById('sheet').textContent);
    fktSetzen('menue','glossar','aus','');
    openMenu();
    const wieder = /Abkürzungsglossar/.test(document.getElementById('sheet').textContent);
    return { weg, wieder };
  })()`);
  r.check('ein Menüpunkt lässt sich ausblenden', aus.weg);
  r.check('… und ist mit einem Tipp wieder da', aus.wieder);

  const um = await A.page.evaluate(`(function(){
    fktSetzen('menue','glossar','label','Wörterbuch'); fktSetzen('menue','glossar','ico','🔤');
    openMenu();
    const t = document.getElementById('sheet').textContent;
    return { neu:/Wörterbuch/.test(t), alt:/Abkürzungsglossar/.test(t) };
  })()`);
  r.check('umbenennen wirkt sofort', um.neu && !um.alt);

  const fest = await A.page.evaluate(`(function(){
    fktSetzen('menue','verwaltung','aus',true); fktSetzen('menue','melden','aus',true);
    openMenu();
    const t = document.getElementById('sheet').textContent;
    return /Verwaltung/.test(t) && /Problem melden/.test(t);
  })()`);
  r.check('feste Punkte lassen sich NICHT aussperren', fest);

  const reihe = await A.page.evaluate(`(function(){
    const vor = fktMenueListe(true).map(x=>x.key);
    fktVerschieben(vor[1],-1,true);
    const nach = fktMenueListe(true).map(x=>x.key);
    return { getauscht: nach[0]===vor[1] && nach[1]===vor[0] };
  })()`);
  r.check('Reihenfolge lässt sich tauschen', reihe.getauscht);

  const eig = await A.page.evaluate(`(function(){
    FKT.eigene.push({key:'eigen9',ico:'🚑',label:'Notfallnummern',sub:'im Haus',art:'bildschirm',wert:'glossar',nur:'alle',ord:0});
    saveFKT(); openMenu();
    return /Notfallnummern/.test(document.getElementById('sheet').textContent);
  })()`);
  r.check('eigener Menüpunkt erscheint', eig);

  const pan = await A.page.evaluate(`(function(){
    setMode('admin');
    const liste = fktPanelListe(document.getElementById('scr-admin'));
    const key = liste.length ? liste[0].key : null;
    if(!key) return { n:0 };
    fktSetzen('panel',key,'aus',true); renderAdmin();
    const el = fktPanelListe(document.getElementById('scr-admin')).find(p=>p.key===key);
    const versteckt = el && el.el.style.display==='none';
    fktSetzen('panel',key,'label','Eigener Name'); fktSetzen('panel',key,'aus',''); renderAdmin();
    const el2 = fktPanelListe(document.getElementById('scr-admin')).find(p=>p.key==='eigener_name'||p.key===key);
    const umbenannt = !!document.querySelector('#scr-admin .vp-title') &&
      /Eigener Name/.test(document.getElementById('scr-admin').textContent);
    return { n:liste.length, key, versteckt, umbenannt };
  })()`);
  r.check('Verwaltung liefert Karten mit Schlüssel (' + pan.n + ')', pan.n > 5);
  r.check('eine Karte lässt sich ausblenden', !!pan.versteckt);
  r.check('… und umbenennen', !!pan.umbenannt);

  const bild = await A.page.evaluate(`(function(){
    openFunktionen();
    const el = document.getElementById('scr-funktionen');
    return { aktiv: el.classList.contains('active'), zeilen: el.querySelectorAll('.fkt-zeile').length };
  })()`);
  r.check('Bildschirm „Menü & Funktionen" öffnet', bild.aktiv);
  r.check('… und listet die Funktionen (' + bild.zeilen + ')', bild.zeilen > 10);

  /* ══════ Die Bearbeiten-Menüs (⋯) — das meistbenutzte Menü der App ══════ */
  const cid = await A.page.evaluate(`(function(){
    const s = DB.standards[0];
    let c=null;
    (s.rubriken||[]).forEach((rr,ri)=>(rr.sub_bereiche||[]).forEach((sb,si)=>(sb.eintraege||[]).forEach((e,ei)=>{
      if(!c && e && !e.ist_fliesstext && e.natur!=='ueberschrift') c=cidOf(s.id,ri,si,ei); })));
    return c;
  })()`);

  const sh = await A.page.evaluate(`(function(){
    openSheet(${JSON.stringify(cid)});
    const t0 = document.getElementById('sheet').textContent;
    /* Einen Punkt ausblenden */
    fktSetzen('sheet','eintrag.umbenennen','aus',true);
    renderSheetMain();
    const ohne = document.getElementById('sheet').textContent;
    /* Einen Punkt umbenennen */
    fktSetzen('sheet','eintrag.details','label','Alles ändern');
    fktSetzen('sheet','eintrag.details','ico','🧰');
    renderSheetMain();
    const um = document.getElementById('sheet').innerHTML;
    /* Eine ganze Gruppe abschalten */
    fktSetzen('sheetgruppe','eintrag.gefahr','aus',true);
    renderSheetMain();
    const ohneGruppe = document.getElementById('sheet').textContent;
    /* Alles zurück */
    fktZuruecksetzen('sheet','eintrag.umbenennen');
    fktZuruecksetzen('sheet','eintrag.details');
    fktZuruecksetzen('sheetgruppe','eintrag.gefahr');
    renderSheetMain();
    const zurueck = document.getElementById('sheet').textContent;
    return {
      vorher: /Schnell umbenennen/.test(t0),
      ausgeblendet: !/Schnell umbenennen/.test(ohne),
      umbenannt: /Alles ändern/.test(um) && /🧰/.test(um) && !/Details bearbeiten/.test(um),
      gruppeWeg: !/Gefahrenzone/.test(ohneGruppe) && !/Änderungen zurücksetzen/.test(ohneGruppe),
      zurueck: /Schnell umbenennen/.test(zurueck) && /Details bearbeiten/.test(zurueck) && /Gefahrenzone/.test(zurueck),
    };
  })()`);
  r.check('das ⋯-Menü zeigt ausgelieferte Punkte', sh.vorher);
  r.check('ein einzelner Punkt lässt sich ausblenden', sh.ausgeblendet);
  r.check('… umbenennen und mit eigenem Symbol versehen', sh.umbenannt);
  r.check('eine ganze Gruppe lässt sich abschalten', sh.gruppeWeg);
  r.check('„Vorgabe" stellt alles wieder her', sh.zurueck);

  const sortierung = await A.page.evaluate(`(function(){
    fktSheetVerschieben('eintrag.menge',-1);
    openSheet(${JSON.stringify(cid)});
    const h = document.getElementById('sheet').innerHTML;
    /* „Menge" steht in der Gruppe „Inhalt" hinter „Schnell umbenennen" —
       ein Schritt nach oben tauscht genau mit diesem Nachbarn. */
    const getauscht = h.indexOf('Menge ändern') < h.indexOf('Schnell umbenennen');
    /* Über die Gruppengrenze darf nichts wandern. */
    fktSetzen('sheet','eintrag.zuruecksetzen','ord',-99);
    renderSheetMain();
    const h2 = document.getElementById('sheet').innerHTML;
    const gefahrHinten = h2.indexOf('Details bearbeiten') < h2.indexOf('Änderungen zurücksetzen');
    fktZuruecksetzen('sheet','eintrag.zuruecksetzen');
    return { getauscht, gefahrHinten };
  })()`);
  r.check('Punkte lassen sich innerhalb ihrer Gruppe tauschen', sortierung.getauscht);
  r.check('… aber nicht über die Gruppengrenze (Gefahrenzone bleibt hinten)', sortierung.gefahrHinten);

  const leer = await A.page.evaluate(`(function(){
    ['warum','details','umbenennen','menge','groessen','spez','wichtig','mengehi','farbe','bilder',
     'kategorie','uk','verknuepfen','eigenefelder','verschieben','hoch','runter','katalog',
     'loeschen','zuruecksetzen','baustein'].forEach(k=>fktSetzen('sheet','eintrag.'+k,'aus',true));
    renderSheetMain();
    const t = document.getElementById('sheet').textContent;
    ['warum','details','umbenennen','menge','groessen','spez','wichtig','mengehi','farbe','bilder',
     'kategorie','uk','verknuepfen','eigenefelder','verschieben','hoch','runter','katalog',
     'loeschen','zuruecksetzen','baustein'].forEach(k=>fktZuruecksetzen('sheet','eintrag.'+k));
    return /ausgeblendet/.test(t) && /Menü/.test(t);
  })()`);
  r.check('ein vollständig leeres Menü erklärt sich selbst', leer);

  /* ══════ Kopfleiste ══════ */
  const kopf = await A.page.evaluate(`(function(){
    const sicht = ()=>({ suche: !document.getElementById('searchBtn').hidden,
                         thema: !document.getElementById('themeBtn').hidden,
                         menue: !document.getElementById('menuBtn').hidden });
    const vorher = sicht();
    fktSetzen('kopf','suche','aus',true); fktKopfAnwenden();
    const ohne = sicht();
    fktZuruecksetzen('kopf','suche'); fktKopfAnwenden();
    return { vorher, ohne, zurueck: sicht() };
  })()`);
  r.check('die Lupe der Kopfleiste lässt sich abschalten', kopf.vorher.suche && !kopf.ohne.suche);
  r.check('… ☰ bleibt dabei immer da', kopf.ohne.menue);
  r.check('… und die Lupe kommt zurück', kopf.zurueck.suche);

  /* ══════ Merkmalsleiste ══════ */
  const fac = await A.page.evaluate(`(function(){
    setMode('use'); nav=[]; renderStandards(''); show('scr-standards');
    const vorher = document.querySelectorAll('#scr-standards .fac-reihe').length;
    fktSetzen('facette','hersteller','aus',true);
    renderStandards('');
    const nachher = document.querySelectorAll('#scr-standards .fac-reihe').length;
    fktZuruecksetzen('facette','hersteller');
    renderStandards('');
    return { vorher, nachher, zurueck: document.querySelectorAll('#scr-standards .fac-reihe').length };
  })()`);
  r.check('ein Merkmal lässt sich aus der Startseite nehmen (' + fac.vorher + ' → ' + fac.nachher + ')',
    fac.nachher === fac.vorher - 1);
  r.check('… und kommt zurück', fac.zurueck === fac.vorher);

  /* ══════ Der Verwaltungs-Bildschirm zeigt alles ══════ */
  const bild2 = await A.page.evaluate(`(function(){
    setMode('admin'); renderAdmin();
    openFunktionen();
    const t = document.getElementById('scr-funktionen').textContent;
    return { roh: t, menues: /Bearbeiten-Menüs/.test(t), merkmale: /Merkmalsleiste/.test(t),
             karten: /Karten der Verwaltung/.test(t),
                      zeilen: document.querySelectorAll('#scr-funktionen .fkt-zeile').length,
             gruppen: document.querySelectorAll('#scr-funktionen .fkt-gruppe').length };
  })()`);
  r.check('die Verwaltung führt die Kopfleiste', /Symbole oben rechts/.test(bild2.roh||''));
  r.check('die Verwaltung führt die Bearbeiten-Menüs', bild2.menues);
  r.check('… die Merkmalsleiste', bild2.merkmale);
  r.check('… und die Karten', bild2.karten);
  r.check('alle Bedienpunkte stehen dort (' + bild2.zeilen + ' Zeilen, ' + bild2.gruppen + ' Gruppen)',
    bild2.zeilen > 45 && bild2.gruppen >= 11);

  r.check('keine Konsolenfehler', A.errs.length === 0);
  if (A.errs.length) console.error(A.errs.slice(0, 5).join('\n'));

  await r.finish(browser, [srv]);
})().catch(e => { console.error(e); process.exit(1); });
