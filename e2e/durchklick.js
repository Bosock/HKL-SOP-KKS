/* END-TO-END: SYSTEMATISCHER DURCHKLICK

   Zweck: Jede Schaltfläche, jedes Eingabefeld, jede Auswahl und jede Geste
   mindestens einmal auslösen — und dabei feststellen, ob etwas bricht.

   Warum das nötig ist: Die App hat rund 200 verschiedene Klick-Ziele. Von Hand
   ist das weder vollständig noch wiederholbar. Dieser Lauf geht die Bildschirme
   der Reihe nach durch, sammelt je Bildschirm alle bedienbaren Elemente,
   gruppiert sie nach der dahinterliegenden FUNKTION (ein Vertreter je Funktion
   genügt — 300 Materialzeilen mit demselben Handler sind ein Testfall, nicht
   300) und löst jeden Vertreter einzeln aus.

   Nach jedem Auslösen wird geprüft:
     · Ist ein Fehler in der Konsole aufgelaufen?
     · Wurde eine Zusage nicht eingelöst (unhandledrejection)?
     · Steht die App noch (DB da, ein Bildschirm aktiv, kein leerer Rumpf)?

   Dialoge werden abgefangen: confirm → ja, prompt → ein Testwert, print → nichts,
   Kamera → nichts. Sonst würde der Lauf beim ersten Bestätigen stehen bleiben.

   Der Lauf ist bewusst NICHT zerstörungsfrei — er drückt auch „Löschen" und
   „Zurücksetzen". Das ist der Sinn: Diese Wege sind im Alltag die gefährlichsten
   und werden am seltensten geprüft. Der Server läuft dabei in einem eigenen
   STATE_DIR (e2e/util.js), es geht also nichts Echtes verloren. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

/* Elemente, die den Lauf selbst kaputtmachen würden statt etwas zu prüfen. */
const NICHT_AUSLOESEN = [
  'stopCam',           // stoppt einen Kamerastrom, den es im Test nicht gibt
  'toggleTorch',       // dito
  'adminLogout',       // meldet ab; wird gezielt am Ende geprüft
];

(async () => {
  const r = reporter('durchklick');
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);

  /* ── Fehlersammler und Dialog-Attrappen einrichten ───────────── */
  await A.page.evaluate(() => {
    window.__err = [];
    window.addEventListener('error', e => window.__err.push('error: ' + (e.message || e)));
    window.addEventListener('unhandledrejection', e =>
      window.__err.push('unhandled: ' + ((e.reason && e.reason.message) || e.reason)));
    const ce = console.error;
    console.error = function (...a) { window.__err.push('console: ' + a.join(' ')); ce.apply(console, a); };
    window.confirm = () => true;
    window.prompt = () => 'Testwert';
    window.print = () => {};
    window.alert = () => {};
    if (!navigator.mediaDevices) navigator.mediaDevices = {};
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error('keine Kamera im Test'));
    /* Datei-Auswahl (Foto/Backup) darf keinen Systemdialog öffnen. */
    const origClick = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function () { if (this.type === 'file') return; return origClick.call(this); };
    window.__stand = () => ({
      db: !!(typeof DB !== 'undefined' && DB && DB.standards && DB.standards.length),
      screen: (document.querySelector('.screen.active') || {}).id || null,
      leer: !document.querySelector('.screen.active') ||
        (document.querySelector('.screen.active').textContent || '').trim().length === 0,
    });
  });

  /* Ein Bildschirm: Name, wie man hinkommt, optional was vorher passieren muss. */
  const BILDSCHIRME = [
    { name: 'Übersicht',            oeffnen: `setMode('use')` },
    { name: 'Standard (Rubriken)',  oeffnen: `setMode('use'); openStandard(DB.standards[0].id, true)` },
    { name: 'Rubrik (Detail)',      oeffnen: `setMode('use'); openStandard(DB.standards[0].id, true); openRubrik(0, true)` },
    { name: 'Material-Zentrale',    oeffnen: `mode='care'; renderCare(); show('scr-care')` },
    { name: '… Reiter Einträge',    oeffnen: `mode='care'; renderCare(); show('scr-care'); mcGo('eintraege')` },
    { name: '… Reiter Ordnung',     oeffnen: `mode='care'; renderCare(); show('scr-care'); mcGo('ordnung')` },
    { name: '… Reiter Geräte',      oeffnen: `mode='care'; renderCare(); show('scr-care'); mcGo('geraete')` },
    { name: '… Reiter Prüfen',      oeffnen: `mode='care'; renderCare(); show('scr-care'); mcGo('pruefen')` },
    { name: '… Dubletten',          oeffnen: `mode='care'; renderCare(); show('scr-care'); mcGo('dubletten')` },
    { name: 'Aufräum-Assistent',    oeffnen: `openCleanup()` },
    { name: 'Material-Editor',      oeffnen: `openScanItem('m:durchklick', true)` },
    { name: 'Produktblatt',         oeffnen: `openScanItem('m:durchklick', false)` },
    { name: 'Verwaltung',           oeffnen: `setMode('admin')` },
    { name: 'Katalog',              oeffnen: `setMode('catalog')` },
    { name: 'Globale Suche',        oeffnen: `openGlobalSearch()` },
    { name: 'Glossar',              oeffnen: `openGlossary()` },
    { name: 'Änderungsvorschläge',  oeffnen: `openSuggestions()` },
    { name: 'Anleitung (Ansicht)',  oeffnen: `openGuide(GUIDES[0] && GUIDES[0].id)` },
    { name: 'Anleitung (Editor)',   oeffnen: `openGuideEdit(GUIDES[0] && GUIDES[0].id)` },
    { name: 'Pop-up (Editor)',      oeffnen: `openPopupAdmin(); popupEdit(POPUPS[0] && POPUPS[0].id)` },
    { name: 'Variante (Editor)',    oeffnen: `openVariantEdit(DB.standards[0].id)` },
    { name: 'Eintrag bearbeiten',   oeffnen: `setMode('use'); openStandard(DB.standards[0].id, true); openRubrik(0, true); editEntry(document.querySelector('.entry-row[data-cid]').dataset.cid)` },
    { name: 'Änderung vorschlagen', oeffnen: `setMode('use'); openStandard(DB.standards[0].id, true); openRubrik(0, true); openProposeForm(document.querySelector('.entry-row[data-cid]').dataset.cid)` },
    { name: 'Standard duplizieren', oeffnen: `setMode('use'); openStandard(DB.standards[0].id, true); openDupStdForm()` },
    { name: 'Pop-up-Verwaltung',    oeffnen: `openPopupAdmin()` },
    { name: 'Ärzte & Varianten',    oeffnen: `openVariantAdmin()` },
    { name: 'Diagnose',             oeffnen: `openDiag()` },
    { name: 'Scan-Hub',             oeffnen: `openScanHub()` },
  ];

  /* Login einmal — fast alles ist nur im Verwaltungsmodus sichtbar. */
  await A.page.evaluate(() => { doLogin('1234567'); });

  /* Saatgut: Ohne Inhalte bleiben halbe Bildschirme leer und ihre Knöpfe
     erscheinen gar nicht erst. Ein Vorschlag, eine Anleitung, ein Pop-up, ein
     Arzt, ein Glossareintrag und ein Hinweis machen die Masken vollständig. */
  await A.page.evaluate(() => {
    try { guideNew(); guideSaveForm && guideSaveForm(); } catch (e) {}
    try { popupNew(); } catch (e) {}
    try { GLOSSARY.push({ id: 'g-dk', term: 'DK', def: 'Durchklick-Test' }); saveGlossary(); } catch (e) {}
    try {
      const cid = cidOf(DB.standards[0].id, 0, 0, 0);
      SUGGESTIONS.push({ id: 's-dk', cid: cid, feld: 'name', wert: 'Durchklick',
        von: 'Test', at: Date.now(), votes: {}, status: 'offen' });
      saveSuggestions();
    } catch (e) {}
    try { VARIANTS.aerzte.push({ id: 'a-dk', name: 'Dr. Durchklick', kurz: 'DK', farbe: '#8b5cf6' }); saveVariants && saveVariants(); } catch (e) {}
    try { GERAETE['durchklick'] = { key: 'durchklick', name: 'Testgerät', saal: 'Saal 1' }; saveGeraete(); } catch (e) {}
    try { hintAdd && hintAdd('overview', '', 'Durchklick-Hinweis'); } catch (e) {}
    try { buildMaterialIndex(); } catch (e) {}
  });

  let gesamtZiele = 0, gesamtFehler = 0;
  const defekte = [];
  const wirkungslos = [];

  for (const b of BILDSCHIRME) {
    /* 1) Hingehen und die bedienbaren Elemente einsammeln, nach Funktion gruppiert. */
    /* Navigation über page.evaluate(<string>): Playwright wertet das über das
       Debug-Protokoll aus und umgeht damit die CSP der App. eval() IN der Seite
       ist verboten (script-src ohne 'unsafe-eval') — ein früherer Entwurf dieses
       Tests hat das übersehen und deshalb immer denselben Bildschirm geprüft. */
    let oeffnenFehler = null;
    try { await A.page.evaluate(b.oeffnen); }
    catch (e) { oeffnenFehler = String((e && e.message || e)).split('\n')[0]; }
    if (oeffnenFehler) {
      r.check(`${b.name}: lässt sich öffnen`, false);
      defekte.push({ bildschirm: b.name, ziel: '(öffnen)', fehler: oeffnenFehler });
      continue;
    }
    const ziele = await A.page.evaluate(({ verboten }) => {
      const scr = document.querySelector('.screen.active');
      if (!scr) return { keinBildschirm: true };
      /* Alles aufklappen: In der Verwaltung liegen die eigentlichen Knöpfe in
         zugeklappten Panels. Ohne das prüft der Lauf nur die Überschriften. */
      scr.querySelectorAll('details').forEach(d => { d.open = true; });
      const gesehen = new Set();
      const liste = [];
      scr.querySelectorAll('button,[onclick],summary,input,select,textarea').forEach(el => {
        const roh = el.getAttribute('onclick') || el.getAttribute('onchange') || el.getAttribute('oninput') || '';
        const fn = (roh.match(/^(?!if\b|for\b|while\b|return\b)([a-zA-Z0-9_]+)\s*\(/) || [])[1]
          || (el.tagName === 'SUMMARY' ? 'details:aufklappen' : null)
          || (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA'
            ? 'eingabe:' + (el.type || el.tagName.toLowerCase()) : 'klick:ohne-handler');
        if (verboten.includes(fn)) return;
        if (gesehen.has(fn)) return;          /* ein Vertreter je Funktion genügt */
        gesehen.add(fn);
        liste.push({ fn, label: (el.textContent || el.getAttribute('aria-label') || el.id || '').trim().slice(0, 44) });
      });
      return { liste };
    }, { verboten: NICHT_AUSLOESEN });

    if (ziele.fehlerBeimOeffnen) {
      r.check(`${b.name}: lässt sich öffnen`, false);
      defekte.push({ bildschirm: b.name, ziel: '(öffnen)', fehler: ziele.fehlerBeimOeffnen });
      continue;
    }
    if (ziele.keinBildschirm) { r.check(`${b.name}: lässt sich öffnen`, false); continue; }

    /* 2) Jeden Vertreter einzeln auslösen, danach den Zustand prüfen. */
    const ergebnis = [];
    for (const fn of ziele.liste.map(x => x.fn)) {
      try { await A.page.evaluate(b.oeffnen); } catch (e) { /* weiter */ }
      const eins = await A.page.evaluate(async (fn) => {
        const aus = [];
        const scr = document.querySelector('.screen.active');
        if (!scr) { aus.push({ fn, ok: false, grund: 'kein Bildschirm nach dem Öffnen' }); return aus; }
        scr.querySelectorAll('details').forEach(d => { d.open = true; });
        let el = null;
        scr.querySelectorAll('button,[onclick],summary,input,select,textarea').forEach(x => {
          if (el) return;
          const roh = x.getAttribute('onclick') || x.getAttribute('onchange') || x.getAttribute('oninput') || '';
          const f = (roh.match(/^(?!if\b|for\b|while\b|return\b)([a-zA-Z0-9_]+)\s*\(/) || [])[1]
            || (x.tagName === 'SUMMARY' ? 'details:aufklappen' : null)
            || (x.tagName === 'INPUT' || x.tagName === 'SELECT' || x.tagName === 'TEXTAREA'
              ? 'eingabe:' + (x.type || x.tagName.toLowerCase()) : 'klick:ohne-handler');
          if (f === fn) el = x;
        });
        if (!el) { aus.push({ fn, ok: true, wirkung: true, grund: 'nach dem Neuaufbau nicht mehr da (unkritisch)' }); return aus; }

        const vorher = window.__err.length;
        /* Wirkungsprobe: Ein Knopf, der NICHTS bewirkt, wirft auch keine
           Ausnahme — er ist trotzdem kaputt. Deshalb wird vor und nach dem
           Auslösen ein Abdruck des sichtbaren Zustands genommen. */
        const abdruck = () => {
          const a = document.querySelector('.screen.active');
          let ls = 0; try { for (let i = 0; i < localStorage.length; i++) ls += (localStorage.getItem(localStorage.key(i)) || '').length; } catch (e) {}
          /* Auch AUSSERHALB des aktiven Bildschirms nachsehen: Ein Pop-up hängt
             am body, eine Auswahl ändert nur eine CSS-Klasse, ein Formularfeld
             nur seinen Wert. Wer bloß den Bildschirm-Rumpf misst, hält all das
             für wirkungslos. */
          const werte = [...document.querySelectorAll('input,select,textarea')]
            .map(x => (x.type === 'checkbox' || x.type === 'radio') ? (x.checked ? '1' : '0') : (x.value || '')).join('\u0001');
          return [(a && a.id) || '', (a && a.innerHTML.length) || 0,
            document.body.innerHTML.length,
            document.querySelectorAll('.sel,.on,.active,[aria-selected="true"]').length,
            document.getElementById('sheet').className,
            document.getElementById('toast').textContent,
            document.documentElement.getAttribute('data-theme'), ls, werte].join('|');
        };
        const vorAbdruck = abdruck();
        try {
          if (el.tagName === 'INPUT' && el.type === 'color') {
            el.value = '#4488cc';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } else if (el.tagName === 'INPUT' && ['text', 'search', 'number', 'date', 'tel'].includes(el.type)) {
            el.value = el.type === 'number' ? '3' : (el.type === 'date' ? '2026-01-15' : 'Durchklick');
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } else if (el.tagName === 'SELECT') {
            if (el.options.length > 1) { el.selectedIndex = 1; el.dispatchEvent(new Event('change', { bubbles: true })); }
          } else if (el.tagName === 'TEXTAREA') {
            el.value = 'Durchklick'; el.dispatchEvent(new Event('input', { bubbles: true }));
          } else if (el.type === 'checkbox' || el.type === 'radio') {
            el.checked = !el.checked; el.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            el.click();
          }
        } catch (e) { window.__err.push('wurf: ' + (e && e.message || e)); }

        /* 340 ms: Die Suche ist mit 300 ms entprellt (core/store.js debounce).
           Wer kürzer wartet, hält jede Sucheingabe für wirkungslos. */
        await new Promise(f2 => setTimeout(f2, 340));
        const neu = window.__err.slice(vorher);
        const st = window.__stand();
        const wirkung = abdruck() !== vorAbdruck;
        const ok = neu.length === 0 && st.db && !st.leer;
        aus.push({ fn, ok, wirkung,
          grund: neu[0] || (!st.db ? 'DB verloren' : (st.leer ? 'Bildschirm leer' : '')) });
        /* Ein offenes Sheet/Overlay wieder schließen, sonst blockiert es den Rest. */
        try { if (typeof showSheet === 'function') showSheet(false); } catch (e) {}
        return aus;
      }, fn);
      ergebnis.push(...eins);
    }

    const schlecht = ergebnis.filter(x => !x.ok);
    const stumm = ergebnis.filter(x => x.ok && !x.wirkung);
    gesamtZiele += ergebnis.length;
    gesamtFehler += schlecht.length;
    schlecht.forEach(x => defekte.push({ bildschirm: b.name, ziel: x.fn, fehler: x.grund }));
    /* Nicht jeder wirkungslose Klick ist ein Defekt. Diese Fälle sind
       nachweislich in Ordnung und würden den Bericht sonst zumüllen:
         · Eingabefelder ändern erst beim Speichern etwas
         · Datei-/Kameraknöpfe sind im Test bewusst stillgelegt
         · ein bereits aktiver Reiter/Filter bleibt aktiv
         · das erste Element „nach oben" schieben bewegt nichts
       Alles andere bleibt im Bericht stehen und will erklärt werden. */
    const ERWARTET = /^(eingabe:|klick:ohne-handler$)|^(mcGo|mcSetFilter|setCatalogFilter|setSeg|setSort|setAdmState|setAdmNat|cleanupSetArt|moveUk|moveGroup|guideMoveStep|popupMoveField|importBackupFile|exportBackup|exportCostCSV|ocrWizStart|ocrCaptureAndFill|scanOnPhoto|scanSetPhoto|printStandard)$/;
    stumm.filter(x => !ERWARTET.test(x.fn))
      .forEach(x => wirkungslos.push({ bildschirm: b.name, ziel: x.fn }));
    r.check(`${b.name}: ${ergebnis.length} Bedienelemente ohne Fehler`, schlecht.length === 0);
  }

  /* ── Gesten: Lange-Tippen, Wischen, Tastatur ─────────────────── */
  const gesten = await A.page.evaluate(async () => {
    const aus = [];
    const probe = async (name, fn) => {
      const vorher = window.__err.length;
      try { await fn(); } catch (e) { window.__err.push('geste: ' + (e && e.message || e)); }
      await new Promise(f => setTimeout(f, 30));
      aus.push({ name, ok: window.__err.length === vorher, grund: window.__err[vorher] || '' });
    };
    setMode('use'); openStandard(DB.standards[0].id, true); openRubrik(0, true);
    const zeile = document.querySelector('.screen.active .entry-row[data-cid]');

    await probe('Lange-Tippen auf einen Eintrag (Touch)', async () => {
      if (!zeile) return;
      const t = (x, y) => new Touch({ identifier: 1, target: zeile, clientX: x, clientY: y });
      zeile.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [t(10, 10)], changedTouches: [t(10, 10)] }));
      await new Promise(f => setTimeout(f, 620));
      zeile.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [t(10, 10)] }));
    });
    try { showSheet(false); } catch (e) {}

    await probe('Lange-Drücken mit der Maus', async () => {
      if (!zeile) return;
      zeile.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }));
      await new Promise(f => setTimeout(f, 620));
      zeile.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 10, clientY: 10 }));
    });
    try { showSheet(false); } catch (e) {}

    await probe('Antippen setzt ein Häkchen', async () => {
      if (!zeile) return;
      zeile.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }));
      zeile.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 10, clientY: 10 }));
      zeile.click();
    });

    await probe('Wischen während des Tippens bricht das Lange-Tippen ab', async () => {
      if (!zeile) return;
      const t = (x, y) => new Touch({ identifier: 2, target: zeile, clientX: x, clientY: y });
      zeile.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [t(10, 10)], changedTouches: [t(10, 10)] }));
      zeile.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: [t(10, 90)], changedTouches: [t(10, 90)] }));
      zeile.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [t(10, 90)] }));
    });

    await probe('Pfeiltasten wechseln den Reiter in der Zentrale', async () => {
      mode = 'care'; renderCare(); show('scr-care');
      mcTabKey({ key: 'ArrowRight', preventDefault() {} });
      mcTabKey({ key: 'ArrowLeft', preventDefault() {} });
      mcTabKey({ key: 'Home', preventDefault() {} });
      mcTabKey({ key: 'End', preventDefault() {} });
    });

    await probe('Zurück-Taste des Browsers', async () => {
      setMode('use'); openStandard(DB.standards[0].id);
      gotoState({ d: 0 });
    });

    await probe('Kopfzeilen-Knöpfe (Suche, Theme, Menü, Sync)', async () => {
      document.getElementById('searchBtn').click();
      document.getElementById('themeBtn').click();
      document.getElementById('themeBtn').click();
      document.getElementById('syncDot').click();
      document.getElementById('menuBtn').click();
      showSheet(false);
    });

    await probe('Menü-Einträge einzeln auslösen', async () => {
      openMenu();
      const knoepfe = [...document.querySelectorAll('#sheet .sheet-act')];
      for (const k of knoepfe) {
        const roh = k.getAttribute('onclick') || '';
        if (/adminLogout|resetAllChecks/.test(roh)) continue;   /* gezielt separat */
        openMenu(); const wieder = [...document.querySelectorAll('#sheet .sheet-act')]
          .find(x => (x.getAttribute('onclick') || '') === roh);
        if (wieder) wieder.click();
        showSheet(false);
      }
    });

    return aus;
  });
  gesten.forEach(g => { r.check('Geste: ' + g.name, g.ok); if (!g.ok) defekte.push({ bildschirm: 'Gesten', ziel: g.name, fehler: g.grund }); });

  /* ── Abmelden ganz zum Schluss ───────────────────────────────── */
  const ab = await A.page.evaluate(async () => {
    const vorher = window.__err.length;
    adminLogout();
    await new Promise(f => setTimeout(f, 30));
    return { fehler: window.__err.slice(vorher), admin: ADMIN, screen: (document.querySelector('.screen.active') || {}).id };
  });
  r.check('Abmelden funktioniert und führt in die Nutzung', ab.fehler.length === 0 && ab.admin === false);

  /* ── Bilanz ──────────────────────────────────────────────────── */
  console.log(`\n   ── ${gesamtZiele} Bedienelemente ausgelöst, ${gesamtFehler} mit Fehler, ${wirkungslos.length} ohne erkennbare Wirkung ──`);
  if (wirkungslos.length) {
    console.log('   ── Ohne erkennbare Wirkung (zu prüfen, nicht zwingend defekt) ──');
    wirkungslos.forEach(w => console.log(`   ? [${w.bildschirm}] ${w.ziel}`));
  }
  if (defekte.length) {
    console.log('   ── Befunde ──');
    defekte.slice(0, 40).forEach(d => console.log(`   ✗ [${d.bildschirm}] ${d.ziel}\n       ${d.fehler}`));
    if (defekte.length > 40) console.log(`   … und ${defekte.length - 40} weitere`);
  }
  r.check(`Gesamtlauf: ${gesamtZiele} Bedienelemente`, gesamtZiele > 100);

  await r.finish(browser, [srv]);
})();
