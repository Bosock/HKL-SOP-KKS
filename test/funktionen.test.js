'use strict';
/* Tests für das Funktionsregister (public/js/features/funktionen.js).

   Die Forderung dahinter ist absolut: „ich muss alles erweitern und anpassen
   können, Funktionen hinzufügen und wegnehmen" (docs/GRUNDSAETZE.md, A7).

   Der gefährlichste Fehler ist hier kein Absturz, sondern eine LÜCKE: ein
   Menüpunkt, der im Quelltext existiert, aber in der Verwaltung nicht
   auftaucht. Er wäre unsichtbar unveränderlich — und niemand würde es merken,
   weil nichts kaputtgeht. Deshalb gleicht die erste Gruppe von Tests den
   Katalog Zeile für Zeile gegen den echten Quelltext ab. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const P_FKT = path.join(ROOT, 'public/js/features/funktionen.js');
const P_QM = path.join(ROOT, 'public/js/features/quickmenu.js');
const SRC = fs.readFileSync(P_FKT, 'utf8');
const QM = fs.readFileSync(P_QM, 'utf8');

/* Das Modul in einer Sandbox laden. `const`/`let` auf oberster Ebene werden im
   vm-Kontext keine Eigenschaften — was gebraucht wird, wird deshalb über
   angehängte Zugriffsfunktionen herausgereicht. */
function umgebung(vorgabe) {
  const store = { hkl_funktionen: vorgabe || {} };
  const ctx = vm.createContext({
    console,
    loadJSON: (k, d) => (k in store) ? JSON.parse(JSON.stringify(store[k])) : d,
    saveJSON: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
    esc: (s) => String(s == null ? '' : s),
    sAct: (ico, label, sub, fn, cls) => `[AKT ${ico}|${label}|${sub}|${fn}|${cls || ''}]`,
    sGroup: (t, s2) => `[GRP ${t}|${s2 || ''}]`,
    window: undefined,
  });
  vm.runInContext(SRC + `
    ;globalThis.__katalog = () => FKT_SHEET_KATALOG;
    ;globalThis.__menue   = () => FKT_MENUE;
    ;globalThis.__bauer   = (b) => fktSheetBauer(b);
    ;globalThis.__fkt     = () => FKT;
  `, ctx);
  return ctx;
}

/* Alle S.akt('key', …)-Aufrufe eines Menüs aus quickmenu.js ziehen.
   Der Bereich steht in der Zeile `const S = sheetBauer('<bereich>');`. */
function aktSchluessel() {
  const aus = {};
  let bereich = null;
  for (const zeile of QM.split('\n')) {
    const b = zeile.match(/sheetBauer\('([a-z]+)'\)/);
    if (b) { bereich = b[1]; aus[bereich] = aus[bereich] || []; continue; }
    if (!bereich) continue;
    const m = zeile.match(/\bS\.akt\('([a-z]+)'/);
    if (m && aus[bereich].indexOf(m[1]) < 0) aus[bereich].push(m[1]);
  }
  return aus;
}
function gruppenSchluessel() {
  const aus = {};
  let bereich = null;
  for (const zeile of QM.split('\n')) {
    const b = zeile.match(/sheetBauer\('([a-z]+)'\)/);
    if (b) { bereich = b[1]; aus[bereich] = aus[bereich] || []; continue; }
    if (!bereich) continue;
    const m = zeile.match(/\bS\.gruppe\('([a-z]+)'/);
    if (m && aus[bereich].indexOf(m[1]) < 0) aus[bereich].push(m[1]);
  }
  return aus;
}

/* ═══════════ 1. Der Katalog ist vollständig ═══════════ */

test('jeder Menüpunkt im Quelltext steht auch im Katalog', () => {
  const K = umgebung().__katalog();
  const ist = aktSchluessel();
  for (const bereich of Object.keys(ist)) {
    assert.ok(K[bereich], 'Bereich „' + bereich + '" fehlt im Katalog');
    const bekannt = [];
    K[bereich].gruppen.forEach(g => g.akt.forEach(a => bekannt.push(a.key)));
    for (const key of ist[bereich]) {
      assert.ok(bekannt.indexOf(key) >= 0,
        'Der Menüpunkt „' + bereich + '.' + key + '" ist in quickmenu.js gebaut, steht aber nicht im ' +
        'Katalog von funktionen.js — er wäre in der Verwaltung unsichtbar und damit unveränderlich.');
    }
  }
});

test('kein Karteileichen-Eintrag: jeder Katalogpunkt wird auch gebaut', () => {
  const K = umgebung().__katalog();
  const ist = aktSchluessel();
  for (const bereich of Object.keys(K)) {
    assert.ok(ist[bereich], 'Bereich „' + bereich + '" steht im Katalog, wird aber nirgends gebaut');
    K[bereich].gruppen.forEach(g => g.akt.forEach(a => {
      assert.ok(ist[bereich].indexOf(a.key) >= 0,
        'Der Katalogpunkt „' + bereich + '.' + a.key + '" wird in quickmenu.js nicht mehr gebaut — ' +
        'die Verwaltung böte eine Einstellung ohne Wirkung an.');
    }));
  }
});

test('auch die Gruppen stimmen überein', () => {
  const K = umgebung().__katalog();
  const ist = gruppenSchluessel();
  for (const bereich of Object.keys(K)) {
    /* Über die vm-Grenze hinweg sind Arrays fremde Objekte — der strikte
       deepEqual verglicht sonst auch die Prototypen. Deshalb als Text. */
    const kat = K[bereich].gruppen.map(g => g.key).join(',');
    assert.equal(ist[bereich].join(','), kat,
      'Gruppen von „' + bereich + '" laufen auseinander (Reihenfolge zählt)');
  }
});

test('die drei Menüs sind vollständig erfasst', () => {
  const K = umgebung().__katalog();
  assert.equal(Object.keys(K).sort().join(','), 'eintrag,rubrik,standard');
  let n = 0;
  Object.values(K).forEach(b => b.gruppen.forEach(g => { n += g.akt.length; }));
  assert.ok(n >= 30, 'erwartet werden über 30 Aktionen, gefunden: ' + n);
});

/* ═══════════ 2. Der Sammler wendet die Einstellungen an ═══════════ */

test('ohne Einstellungen kommt genau das Ausgelieferte heraus', () => {
  const S = umgebung().__bauer('eintrag');
  S.gruppe('inhalt', 'Inhalt', 'Was der Eintrag ist');
  S.akt('details', '✏️', 'Details bearbeiten', 'Name …', 'f1()');
  S.akt('menge', '#️⃣', 'Menge ändern', '2x', 'f2()');
  const h = S.html();
  assert.match(h, /\[GRP Inhalt\|/);
  assert.match(h, /Details bearbeiten/);
  assert.match(h, /Menge ändern/);
});

test('ein ausgeblendeter Punkt verschwindet — der Rest bleibt', () => {
  const S = umgebung({ sheet: { 'eintrag.menge': { aus: true } } }).__bauer('eintrag');
  S.gruppe('inhalt', 'Inhalt', '');
  S.akt('details', '✏️', 'Details bearbeiten', '', 'f1()');
  S.akt('menge', '#️⃣', 'Menge ändern', '', 'f2()');
  const h = S.html();
  assert.match(h, /Details bearbeiten/);
  assert.ok(!/Menge ändern/.test(h), 'der ausgeblendete Punkt darf nicht erscheinen');
});

test('Umbenennen und eigenes Symbol wirken', () => {
  const S = umgebung({ sheet: { 'eintrag.groessen': { label: 'Maße', ico: '📐', sub: 'unser Wort' } } }).__bauer('eintrag');
  S.gruppe('inhalt', 'Inhalt', '');
  S.akt('groessen', '📏', 'Größen bearbeiten', '6F', 'f()');
  const h = S.html();
  assert.match(h, /📐\|Maße\|unser Wort/);
  assert.ok(!/Größen bearbeiten/.test(h));
});

test('eine ganze Gruppe lässt sich abschalten', () => {
  const S = umgebung({ sheetgruppe: { 'eintrag.gefahr': { aus: true } } }).__bauer('eintrag');
  S.gruppe('inhalt', 'Inhalt', '');
  S.akt('details', '✏️', 'Details', '', 'f1()');
  S.gruppe('gefahr', 'Gefahrenzone', '');
  S.akt('loeschen', '🗑️', 'Löschen', '', 'f2()');
  S.akt('zuruecksetzen', '↺', 'Zurücksetzen', '', 'f3()');
  const h = S.html();
  assert.match(h, /Details/);
  assert.ok(!/Gefahrenzone/.test(h));
  assert.ok(!/Löschen/.test(h) && !/Zurücksetzen/.test(h), 'alle Punkte der Gruppe sind weg');
});

test('innerhalb einer Gruppe lässt sich umsortieren', () => {
  const S = umgebung({ sheet: { 'eintrag.details': { ord: 5 }, 'eintrag.menge': { ord: 1 } } }).__bauer('eintrag');
  S.gruppe('inhalt', 'Inhalt', '');
  S.akt('details', 'A', 'Details', '', 'f1()');
  S.akt('menge', 'B', 'Menge', '', 'f2()');
  const h = S.html();
  assert.ok(h.indexOf('Menge') < h.indexOf('Details'), 'die kleinere Zahl steht oben');
});

test('ein leeres Menü erklärt sich selbst, statt leer zu bleiben', () => {
  const S = umgebung({ sheet: { 'eintrag.details': { aus: true } } }).__bauer('eintrag');
  S.gruppe('inhalt', 'Inhalt', '');
  S.akt('details', '✏️', 'Details', '', 'f()');
  const h = S.html();
  assert.match(h, /ausgeblendet/);
  assert.match(h, /Menü/, 'der Weg zurück steht dabei');
});

test('Gruppen werden NICHT über ihre Grenzen hinweg sortiert', () => {
  /* „Endgültig löschen" darf nicht unter „Inhalt" rutschen, nur weil jemand
     eine kleine Zahl vergeben hat. */
  const S = umgebung({ sheet: { 'eintrag.loeschen': { ord: 0 } } }).__bauer('eintrag');
  S.gruppe('inhalt', 'Inhalt', '');
  S.akt('details', 'A', 'Details', '', 'f1()');
  S.gruppe('gefahr', 'Gefahrenzone', '');
  S.akt('loeschen', 'B', 'Löschen', '', 'f2()');
  const h = S.html();
  assert.ok(h.indexOf('Details') < h.indexOf('Löschen'), 'die Gefahrenzone bleibt hinten');
});

/* ═══════════ 3. Das Menü und die Grenzen ═══════════ */

test('feste Punkte lassen sich nicht ausblenden', () => {
  const ctx = umgebung({ menue: { verwaltung: { aus: true }, melden: { aus: true }, anmelden: { aus: true }, abmelden: { aus: true } } });
  const admin = vm.runInContext('fktMenueListe(true).map(x=>x.key)', ctx);
  const gast = vm.runInContext('fktMenueListe(false).map(x=>x.key)', ctx);
  ['verwaltung', 'abmelden'].forEach(k => assert.ok(admin.indexOf(k) >= 0, k + ' muss bleiben'));
  assert.ok(admin.indexOf('melden') >= 0 && gast.indexOf('melden') >= 0);
  assert.ok(gast.indexOf('anmelden') >= 0);
});

test('ein normaler Punkt lässt sich ausblenden und wiederholen', () => {
  const ctx = umgebung({ menue: { glossar: { aus: true } } });
  assert.ok(vm.runInContext('fktMenueListe(true).map(x=>x.key)', ctx).indexOf('glossar') < 0);
  vm.runInContext("fktSetzen('menue','glossar','aus','')", ctx);
  assert.ok(vm.runInContext('fktMenueListe(true).map(x=>x.key)', ctx).indexOf('glossar') >= 0);
});

test('leerer Wert löscht die eigene Änderung statt sie zu leeren', () => {
  const ctx = umgebung();
  vm.runInContext("fktSetzen('menue','glossar','label','Wörterbuch')", ctx);
  assert.equal(vm.runInContext("fktWert('menue','glossar','label','Vorgabe')", ctx), 'Wörterbuch');
  vm.runInContext("fktSetzen('menue','glossar','label','')", ctx);
  assert.equal(vm.runInContext("fktWert('menue','glossar','label','Vorgabe')", ctx), 'Vorgabe');
  assert.equal(vm.runInContext("fktGeaendert('menue','glossar')", ctx), false);
});

test('ein eigener Menüpunkt zeigt nur auf sichere Ziele', () => {
  const ctx = umgebung();
  const tun = (art, wert) => vm.runInContext('fktEigenTun(' + JSON.stringify({ art, wert }) + ')', ctx);
  assert.match(tun('standard', 'tavi-1'), /openStandardById\("tavi-1"\)/);
  assert.match(tun('bildschirm', 'glossar'), /fktBildschirm\("glossar"\)/);
  assert.match(tun('seite', 'anleitung.html'), /fktSeiteOeffnen\("anleitung.html"\)/);
  assert.match(tun('adresse', 'https://x.de'), /fktAdresseOeffnen\("https:\/\/x.de"\)/);
  assert.equal(tun('gibtsnicht', 'egal'), 'showSheet(false)');
});

test('die Bildschirm-Ziele sind eine feste Liste, kein freier Funktionsname', () => {
  const keys = vm.runInContext('FKT_BILDSCHIRME.map(b=>b.key)', umgebung());
  assert.ok(keys.length >= 4);
  keys.forEach(k => assert.match(k, /^[a-z]+$/));
});

/* ═══════════ 4. Robustheit ═══════════ */

test('ein kaputter gespeicherter Zustand bringt nichts zum Absturz', () => {
  [null, 42, 'text', { menue: 'kaputt', eigene: 'auch kaputt' }].forEach(mist => {
    const ctx = umgebung(mist);
    const liste = vm.runInContext('fktMenueListe(true)', ctx);
    assert.ok(Array.isArray(liste) && liste.length > 5, 'Menü bleibt bedienbar bei ' + JSON.stringify(mist));
  });
});

test('der Karten-Schlüssel wird stabil aus der Überschrift gewonnen', () => {
  const ctx = umgebung();
  const slug = (t) => vm.runInContext('fktSlug(' + JSON.stringify(t) + ')', ctx);
  assert.equal(slug('Bezeichnungen & Hersteller'), 'bezeichnungen_hersteller');
  assert.equal(slug('Ausgeblendete Einträge'), 'ausgeblendete_eintraege');
  assert.equal(slug('Größen & Maße'), 'groessen_masse');
  assert.equal(slug(''), '');
  assert.equal(slug(null), '');
});
