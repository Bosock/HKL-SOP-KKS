'use strict';
/* E2E: Aufbau aus dem Bestand (public/neu/js/bestand.js, aufbau.js), im echten
   Browser am PC (1440 × 900).

   1. TREUE: Der Bestand bekommt Änderungen, wie sie im Labor entstehen
      (umbenannt, ausgeblendet, umsortiert, verschoben, Regeln, Notizen, ein
      im Labor angelegter Standard). Dann zeigt die alte App jeden Standard,
      und die rechte Seite des Neuaufbaus muss für ALLE dieselben Rubriken,
      Abschnitte und Zeilen ergeben.
   2. ZIEHEN: Neuer Standard → geteilter Bildschirm; Suche fasst
      Formulierungen zusammen; Zeile, Wortlaut, Abschnitt, Rubrik, Baustein
      herüberziehen; Material-Rubrik nur als Hülle; Material-Zeilen gesperrt;
      Zeilen im Editor verschieben; ✓ „schon übernommen".
   3. SCHALTER und SCHUTZ: zuklappen, Knopf „📚 Bestand", schmaler Bildschirm,
      Aufbau aus; der Bestand bleibt Byte für Byte unverändert. */
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const { launchBrowser, startServer, bootPage, reporter } = require('./util');
const ROOT = path.join(__dirname, '..');
const EXP = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/hkl_standards_export.json'), 'utf8'));
const J = o => JSON.stringify(o);
const norm = t => String(t == null ? '' : t).replace(/\*\*|__|~/g, '').replace(/\s+/g, ' ').trim();
const warte = async (page, fn, arg, ms) => { try { await page.waitForFunction(fn, arg, { timeout: ms || 8000 }); return true; } catch (e) { return false; } };

/* Änderungen, wie sie im Labor entstehen — an echten Stellen des Exports. Der Server
   speichert sie so, wie die alte App sie schickt: als Objekte und Listen. */
const S0 = EXP.standards[0].id, S1 = EXP.standards[1].id, S2 = EXP.standards[2].id;
const LABOR = {
  hkl_stdedits: ({ [S0]: { titel: 'Aggregatexplantation (Labor)' }, [EXP.standards[3].id]: { hidden: true } }),
  hkl_rubedits: ({ [S1 + '|3']: { hidden: true }, [S1 + '|2']: { name: 'Patientenvorbereitung', ord: -1 } }),
  hkl_qedits: ({ cid: { [S0 + '|2|0|0']: { name: 'Checkliste Sedierung ausfüllen (Labor)' }, [S0 + '|2|0|1']: { hidden: true } }, mat: {} }),
  hkl_reassign: ({ [S0 + '|0|0|2']: 'Im Nebenraum' }),
  hkl_uksections: ({ [S0 + '|0']: ['Leer angelegt'] }),
  hkl_entryorder: ({ [S2 + '|5|seg0']: [S2 + '|5|0|3', S2 + '|5|0|0', S2 + '|5|0|1', S2 + '|5|0|2'] }),
  hkl_hints: ({ overview: [], std: { [S0]: [{ id: 'h1', text: 'Findet immer in HKL 1 statt' }] }, rub: { [S0 + '|2']: [{ id: 'h2', text: 'Transseptal auf Ansage' }] } }),
  hkl_rules: ([{ id: 'r1', ts: '2026-07-18T10:00:00Z', op: 'set', ziel: { art: 'text', key: 't:' + 'druckableitung vorbereiten' }, wo: { art: 'gruppe', wert: 'EPU' }, prop: 'name', wert: 'Druckableitung vorbereiten (EPU)' }]),
  hkl_additions: ({ standards: [{ id: 'labor_micra', titel: 'Schrittmacher - MICRA - Transfemoral', gruppe: 'CRM', dateiname: '(manuell angelegt)', _added: true,
    rubriken: [{ name: 'Saal und Geräte', typ: 'geraete', sub_bereiche: [] }, { name: 'Material', typ: 'material', sub_bereiche: [] }, { name: 'Ablauf', typ: 'ablauf', sub_bereiche: [] }] }],
    entries: { 'labor_micra|0': [{ roh_text: 'Programmer-Tablet neben den Notfallwagen', anzeige_text: 'Programmer-Tablet neben den Notfallwagen', natur: 'geraet', spezifikation: 'muss mit an den Defi angeschlossen werden', groessen: [], _added: true }],
      'labor_micra|2': [{ roh_text: 'Leiste rasieren', anzeige_text: 'Leiste rasieren', natur: 'hinweis', groessen: [], _added: true }] } }),
};

(async () => {
  const r = reporter('neue-app-aufbau');
  const srv = await startServer({ REGISTER: '0' });
  await fetch(srv.base + '/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: J({ state: LABOR }) });
  const bestandVorher = J((await (await fetch(srv.base + '/api/state')).json()).state);
  const browser = await launchBrowser();

  /* ── 1. Treue zur alten App ── */
  const alt = await bootPage(browser, srv.base, { viewport: { width: 1280, height: 900 } });
  await warte(alt.page, () => DB.standards.length >= 48, null, 20000);
  const sichtAlt = await alt.page.evaluate(() => DB.standards.filter(s => !stdHidden(s)).map(s => {
    openStandard(s.id, true, true);
    const vis = (s.rubriken || []).map((r, i) => ({ r, i })).filter(x => !rubHidden(x.r, x.i, s)).sort((a, b) => rubOrd(a.r, a.i, s) - rubOrd(b.r, b.i, s));
    return { id: s.id, titel: stdTitel(s), gruppe: stdGruppe(s), rubriken: vis.map(({ r, i }) => {
      openRubrik(i, true); const teile = [{ head: '', zeilen: [] }];
      document.getElementById('scr-detail').querySelectorAll('.uksec-name, .sub-head, .entry .e-text').forEach(el => {
        const k = el.cloneNode(true); k.querySelectorAll('button,.imp-star,.tun-ico,.added-tag,[class*="var"]').forEach(x => x.remove());
        if (el.classList.contains('e-text')) teile[teile.length - 1].zeilen.push(k.textContent); else teile.push({ head: k.textContent, zeilen: [] }); });
      return { name: rubName(r, i, s), matGer: r.typ === 'material' || r.typ === 'geraete', teile }; }) };
  }));
  await alt.ctx.close();
  const vmc = vm.createContext({ console });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'public/neu/js/kern.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'public/neu/js/bestand.js'), 'utf8') + '\n;globalThis.__B = naBestandAufbereiten;', vmc);
  const sichtNeu = JSON.parse(JSON.stringify(vmc.__B(EXP, (await (await fetch(srv.base + '/api/state')).json()).state)));
  const flach = (a, n) => {
    const at = a.teile.map(t => ({ h: norm(t.head), z: t.zeilen.map(norm).filter(Boolean) })).filter(t => t.h || t.z.length);
    const nt = n.abschnitte.map(t => ({ h: norm(t.name), z: t.zeilen.map(z => norm(z.text)) })).filter(t => t.z.length || (t.h && !a.matGer));
    return [J(at), J(nt)]; };
  const abw = [];
  sichtAlt.forEach(a => { const n = sichtNeu.find(x => x.id === a.id); if (!n) { abw.push('fehlt: ' + a.id); return; }
    if (norm(a.titel) !== norm(n.titel) || norm(a.gruppe) !== norm(n.gruppe)) abw.push(a.id + ' Titel/Gruppe');
    if (a.rubriken.map(x => norm(x.name)).join('|') !== n.rubriken.map(x => norm(x.name)).join('|')) abw.push(a.id + ' Rubriken');
    a.rubriken.forEach((ar, i) => { const nr = n.rubriken[i]; if (!nr) return; const [fa, fn] = flach(ar, nr); if (fa !== fn) abw.push(a.id + ' R' + i + ': ' + fa.slice(0, 200) + ' ≠ ' + fn.slice(0, 200)); }); });
  r.check('Treue: ' + sichtAlt.length + ' Standards — rechte Seite = alte App (Rubriken, Abschnitte, Zeilen)' + (abw.length ? ': ' + abw.slice(0, 3).join(' | ') : ''), sichtAlt.length === sichtNeu.length && sichtAlt.length === EXP.standards.length + 1 - 1 && !abw.length);   /* + im Labor angelegt − ausgeblendet */
  const s0 = sichtNeu.find(x => x.id === S0), s1 = sichtNeu.find(x => x.id === S1);
  r.check('… und die Labor-Änderungen wirken: Titel, Textkorrektur, ausgeblendet, eigener Abschnitt, Notizen, eigener Standard',
    s0.titel === 'Aggregatexplantation (Labor)' && J(s0).includes('Checkliste Sedierung ausfüllen (Labor)') && s0.rubriken[0].abschnitte.some(x => x.name === 'Im Nebenraum')
    && s0.notizen[0].text === 'Findet immer in HKL 1 statt' && s1.rubriken[0].name === 'Patientenvorbereitung' && !sichtNeu.some(x => x.id === EXP.standards[3].id)
    && sichtNeu.some(x => x.id === 'labor_micra' && x.eigen));

  /* ── 2. Ziehen am PC ── */
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
  await p.goto(srv.base + '/', { waitUntil: 'networkidle' });
  await p.evaluate(() => { localStorage.setItem('hkl_raumwahl', 'neuaufbau'); localStorage.setItem('raum:neuaufbau:hkl_authuntil', String(Date.now() + 3600000)); });
  await p.goto(srv.base + '/neu/#/standards', { waitUntil: 'networkidle' });
  const eingabe = async t => { await p.fill('#naEingabeFeld', t); await p.click('#naSheet.show [data-na="eingabeOk"]'); };
  const std = () => p.evaluate(() => JSON.parse(JSON.stringify(naEdObj())));
  const BILDER = process.env.AUFBAU_BILDER || '';
  const foto = n => BILDER ? p.screenshot({ path: path.join(BILDER, n + '.png') }) : null;
  /* ein Baustein im Neuaufbau, für später */
  await p.evaluate(() => naSpeichern('baustein', { id: naId('b'), name: 'Steriles Abdecken', positionen: [{ id: naId('p'), art: 'schritt', text: 'Patient steril abdecken' }, { id: naId('p'), art: 'schritt', text: 'Lochtuch auflegen' }] }));

  await p.click('[data-na="stdNeu"]'); await eingabe('PCI elektiv (Aufbau)');
  r.check('Neuer Standard öffnet sofort den geteilten Bildschirm — ohne „Womit beginnen?"', await warte(p, () => document.body.classList.contains('na-geteilt') && /\/bearbeiten$/.test(location.hash) && !document.getElementById('naSheet').classList.contains('show')));
  const N = EXP.standards.length;
  r.check('rechts: der Bestand ist gelesen (' + N + ' Standards, wie das Labor sie sieht)', await warte(p, n => NA_AB.daten && NA_AB.daten.stds.length === n && new RegExp(n + ' Standards').test(document.getElementById('naQStand').textContent), N, 15000));
  await foto('1-geteilt');

  await p.fill('#naQSuche', 'druckableitung vorbereiten');
  r.check('Suche fasst gleiche Formulierungen zusammen („in n Standards")', await warte(p, () => { const f = document.querySelector('#naQListe .na-q-zeile.form'); return !!f && /Druckableitung vorbereiten/.test(f.textContent) && /in \d+ Standards/.test(f.textContent); }));
  await foto('2-suche');
  await p.locator('#naQListe .na-q-zeile.form').first().dragTo(p.locator('[data-drop-ende]'));
  let s = await std();
  const p1 = s.rubriken[0] && s.rubriken[0].abschnitte[0].positionen[0];
  r.check('Formulierung auf die Ablage gezogen → neue Rubrik mit der Zeile, Art „Arbeitsschritt", Herkunft gemerkt',
    s.rubriken.length === 1 && !!p1 && /^Druckableitung vorbereiten/.test(p1.text) && p1.art === 'schritt' && p1.herkunft && p1.herkunft.q === 'bestand' && !!p1.herkunft.std && !!p1.herkunft.z && !!s.rubriken[0].name);
  r.check('rechts erscheint ✓ „in diesem Standard übernommen"', await warte(p, () => !!document.querySelector('#naQListe .na-q-zeile.form .na-q-mark.hier')));

  /* Fundstellen aufklappen, eine bestimmte Stelle auf die Zeile (untere Hälfte → danach) ziehen */
  await p.fill('#naQSuche', 'checkliste sedierung ausfüllen (labor)');
  await warte(p, () => { const f = document.querySelector('#naQListe .na-q-zeile.form'); return !!f && /Checkliste Sedierung/.test(f.textContent); });
  await p.click('#naQListe .na-q-zeile.form [data-na="abKlapp"]');
  await warte(p, () => !!document.querySelector('#naQListe .na-q-in [data-q-art="zeile"]'));
  const ziel = p.locator('#naMain [data-pos-id]').first(); const zb = await ziel.boundingBox();
  await p.locator('#naQListe .na-q-in [data-q-art="zeile"]').first().dragTo(ziel, { targetPosition: { x: 40, y: zb.height - 4 } });
  s = await std();
  r.check('Fundstelle auf die untere Hälfte einer Zeile → genau danach eingefügt', s.rubriken[0].abschnitte[0].positionen.map(x => x.text).join('|') === p1.text + '|Checkliste Sedierung ausfüllen (Labor)');

  /* blättern: Standard aufklappen, Rubrik, Abschnitt, Wortlaut ziehen */
  await p.fill('#naQSuche', '');
  await p.click('#naQListe [data-std-kopf="' + S0 + '"]');
  r.check('Blättern: Standard aufgeklappt — Rubriken, Abschnitte, Zeilen, Notiz; Material-Rubrik als „nur die Hülle"', await warte(p, () => {
    const t = document.getElementById('naQListe').textContent; return /Findet immer in HKL 1 statt/.test(t) && /Material — nur die Hülle/.test(t) && document.querySelectorAll('#naQListe .na-q-rub').length >= 5; }));
  await foto('3-blaettern');
  r.check('Material-Zeilen: gesperrt und nicht ziehbar', await p.evaluate(() => { const g = Array.from(document.querySelectorAll('#naQListe .na-q-zeile.gesperrt')); return g.length > 5 && g.every(x => !x.hasAttribute('draggable') && !x.hasAttribute('data-q')); }));
  const rubPatient = p.locator('#naQListe .na-q-rub:not(.material)', { hasText: 'Patient' }).first();
  await rubPatient.dragTo(p.locator('[data-drop-ende]'));
  s = await std();
  const rp = s.rubriken[1];
  r.check('Rubrik gezogen → mit Abschnitten, Zeilen und der Notiz der Rubrik vorn; ausgeblendete Zeile fehlt',
    !!rp && rp.name === 'Patient' && rp.abschnitte.map(a => a.name).join('|') === 'In der Bettenwarte|Im Saal|Abdecken' && rp.abschnitte[0].positionen[0].text === 'Transseptal auf Ansage'
    && rp.abschnitte[0].positionen[0].art === 'hinweis' && rp.abschnitte[0].positionen.length === 1 + 5 - 1 && rp.abschnitte.every(a => a.positionen.every(x => x.herkunft && x.herkunft.std === S0)));
  const matRub = p.locator('#naQListe .na-q-rub.material').first();
  await matRub.dragTo(p.locator('[data-drop-ende]'));
  s = await std();
  const rm = s.rubriken[2];
  r.check('Material-Rubrik gezogen → nur die Hülle: Name und Abschnitte, keine einzige Zeile', !!rm && rm.name === 'Materialien' && rm.abschnitte.length >= 1 && rm.abschnitte.every(a => !(a.positionen || []).length));
  /* Abschnitt auf die obere Hälfte eines Abschnitts → davor */
  const absQuelle = p.locator('#naQListe .na-q-abs', { hasText: 'Tisch mit Schrittmacher-Set' }).first();
  const absZiel = p.locator('#naMain [data-abs-block="' + rp.abschnitte[1].id + '"]'); const ab = await absZiel.boundingBox();
  await absQuelle.dragTo(absZiel, { targetPosition: { x: 60, y: 6 } });
  s = await std();
  r.check('Abschnitt auf die obere Hälfte eines Abschnitts → davor eingefügt, mit seinen Zeilen', s.rubriken[1].abschnitte.map(a => a.name).join('|') === 'In der Bettenwarte|Tisch mit Schrittmacher-Set|Im Saal|Abdecken' && s.rubriken[1].abschnitte[1].positionen.length === 5);
  /* den Word-Wortlaut einer Zeile ziehen */
  const wort = p.locator('#naQListe .na-q-wort').first(); const wortText = (await wort.textContent()).replace(/^Word:\s*/, '').trim();
  await wort.dragTo(p.locator('#naMain [data-abs-block="' + s.rubriken[0].abschnitte[0].id + '"] .na-abs'));
  s = await std();
  r.check('„Word: …" gezogen → der Wortlaut der Word-Datei, ans Ende des Abschnitts', s.rubriken[0].abschnitte[0].positionen.slice(-1)[0].text === wortText);
  /* Baustein */
  await p.click('#naQListe [data-k="bs"]');
  await p.locator('#naQListe [data-q-art="baustein"]').first().dragTo(p.locator('#naMain [data-rub-block="' + s.rubriken[1].id + '"] .na-rub'));
  s = await std();
  const letzte = s.rubriken[1].abschnitte.slice(-1)[0].positionen;
  r.check('Baustein auf eine Rubrik gezogen → seine Zeilen ans Ende der Rubrik (als Kopie)', letzte.slice(-2).map(x => x.text).join('|') === 'Patient steril abdecken|Lochtuch auflegen' && letzte.slice(-1)[0].ausBaustein);
  await foto('4-aufgebaut');
  /* Zeile im Editor verschieben (oben → nach der zweiten) */
  const erste = s.rubriken[0].abschnitte[0].positionen.map(x => x.id);
  const z2 = p.locator('#naMain [data-pos-id="' + erste[1] + '"]'); const z2b = await z2.boundingBox();
  await p.locator('#naMain [data-pos-id="' + erste[0] + '"]').dragTo(z2, { targetPosition: { x: 40, y: z2b.height - 4 } });
  s = await std();
  r.check('im Editor: Zeile nach unten gezogen → verschoben, nichts verdoppelt', J(s.rubriken[0].abschnitte[0].positionen.map(x => x.id)) === J([erste[1], erste[0]].concat(erste.slice(2))));
  /* Listen: neue Rubrik- und Abschnittsnamen */
  r.check('Rubrik- und Abschnittsnamen stehen in ihren Listen', await p.evaluate(() => ['In der Bettenwarte', 'Tisch mit Schrittmacher-Set'].every(n => naListe('abschnitte').some(x => x.name === n)) && naListe('rubriken').some(x => x.name === 'Patient')));
  /* Herkunft im Positions-Blatt */
  await p.click('#naMain [data-pos-id="' + erste[1] + '"] [data-na="posBearb"]');
  r.check('Positions-Blatt nennt die Herkunft', await warte(p, () => /Übernommen aus dem Bestand/.test(document.getElementById('naSheet').textContent)));
  await p.click('#naSheet.show [data-na="sheetZu"]');
  /* Fortschritt am Standard rechts */
  r.check('rechts am Standard: „✓ n von m Zeilen" übernommen', await p.evaluate(s0 => /✓ \d+ von \d+ Zeilen/.test(document.querySelector('#naQListe [data-std-kopf="' + s0 + '"]').textContent), S0));

  /* ── 3. Schalter und Schutz ── */
  await p.click('#naQuelle [data-na="abZu"]');
  r.check('✕ klappt die rechte Seite zu; im Editor steht „📚 Bestand"', await warte(p, () => !document.body.classList.contains('na-geteilt') && !!document.querySelector('#naMain [data-na="abAuf"]')));
  await p.reload({ waitUntil: 'networkidle' });
  r.check('… und das Gerät merkt sich „zu"', await warte(p, () => !!document.querySelector('#naMain [data-na="abAuf"]') && !document.body.classList.contains('na-geteilt')));
  await p.click('#naMain [data-na="abAuf"]');
  r.check('„📚 Bestand" öffnet sie wieder', await warte(p, n => document.body.classList.contains('na-geteilt') && NA_AB.daten && NA_AB.daten.stds.length === n, N, 15000));
  await p.setViewportSize({ width: 900, height: 900 });
  r.check('schmaler Bildschirm: kein geteilter Bildschirm, ein Hinweis', await warte(p, () => !document.body.classList.contains('na-geteilt') && /ab 1100 px/.test(document.getElementById('naMain').textContent)));
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.evaluate(() => naGeh('#/einstellungen'));
  await p.uncheck('input[data-na-wechsel="aufbauAn"]');
  r.check('Einstellung „Aufbau aus dem Bestand" aus (für alle Geräte)', await p.evaluate(() => naEinstellung('aufbau', true) === false));
  await p.evaluate(() => naGeh('#/standards')); await p.click('[data-na="stdNeu"]'); await eingabe('Ohne Aufbau');
  r.check('ausgeschaltet: „Neuer Standard" fragt wieder „Womit beginnen?"', await warte(p, () => /Womit beginnen/.test(document.getElementById('naSheet').textContent)));
  await p.click('#naSheet.show [data-wert="leer"]');
  r.check('… der Editor öffnet ohne rechte Seite, mit dem Knopf „📚 Bestand"', await warte(p, () => /\/bearbeiten$/.test(location.hash) && !document.body.classList.contains('na-geteilt') && !!document.querySelector('#naMain [data-na="abAuf"]')));
  await p.evaluate(() => naGeh('#/einstellungen')); await p.check('input[data-na-wechsel="aufbauAn"]');

  await warte(p, () => naAbgleich.offen() === 0, null, 10000);
  const neu = (await (await fetch(srv.base + '/api/state?raum=neuaufbau')).json()).state;
  const gespeichert = Object.keys(neu).filter(k => /^na_s_/.test(k)).map(k => neu[k]).find(x => x && x.titel === 'PCI elektiv (Aufbau)');
  r.check('Server (Neuaufbau): der aufgebaute Standard mit Herkunft der Zeilen', !!gespeichert && gespeichert.rubriken.length === 3 && J(gespeichert).includes('"q":"bestand"'));
  r.check('Server (Bestand): Byte für Byte unverändert', J((await (await fetch(srv.base + '/api/state')).json()).state) === bestandVorher);
  const fehler = errs.filter(x => !/favicon|ERR_ABORTED|Failed to load resource/.test(x));
  r.check('keine Fehler in der Konsole' + (fehler.length ? ': ' + fehler.slice(0, 3).join(' | ') : ''), fehler.length === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error(e); process.exit(1); });
