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

  const ord = await A.page.evaluate(`(function(){
    const vor = fktMenueListe(true).map(x=>x.key);
    fktVerschieben(vor[1],-1,true);
    const nach = fktMenueListe(true).map(x=>x.key);
    return { getauscht: nach[0]===vor[1] && nach[1]===vor[0] };
  })()`);
  r.check('Reihenfolge lässt sich tauschen', ord.getauscht);

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

  r.check('keine Konsolenfehler', A.errs.length === 0);
  if (A.errs.length) console.error(A.errs.slice(0, 5).join('\n'));

  await r.finish(browser, [srv]);
})().catch(e => { console.error(e); process.exit(1); });
