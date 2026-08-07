'use strict';
/* Tests für das Seiten-Register und die drei neuen Seitenarten.

   Die Leiste oben war die letzte Fläche der App, die sich nicht ohne
   Entwickler ändern ließ. Geprüft wird deshalb vor allem die ZUSAGE, mit der
   dieser Umbau steht und fällt:

   ① Wer nichts einstellt, sieht genau das, was vorher da war — dieselben
      zwei Seiten unter denselben Kennungen. Ein Umbau, den man merkt, obwohl
      man nichts geändert hat, ist ein Fehler.
   ② Eine Art darf mehrfach vorkommen. Zwei Aufgaben-Seiten sind eine
      Einstellung, keine Programmierung.
   ③ Eine ausgelieferte Seite lässt sich ausblenden, aber nicht löschen —
      sonst wären die Standards unerreichbar.

   Bei den Seitenarten liegt die Gefahr in der Rechnerei: wiederkehrende
   Termine, Gültigkeiten, Zustandswechsel. Da wird jede Kante geprüft.
*/

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const lies = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function umgebung(dateien, vorgabe) {
  const store = Object.assign({}, vorgabe || {});
  const lokal = {};
  const ctx = vm.createContext({
    console,
    loadJSON: (k, d) => (k in store) ? JSON.parse(JSON.stringify(store[k])) : d,
    saveJSON: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
    store: { get: (k) => (k in lokal ? lokal[k] : null), set: (k, v) => { lokal[k] = v; } },
    esc: (s) => String(s == null ? '' : s),
    $: () => null,
    setTimeout: () => {},
    toast: () => {},
    ADMIN: true,
    curSeg: 'standard',
    DB: { standards: [] },
    document: { querySelectorAll: () => [] },
  });
  dateien.forEach(f => vm.runInContext(lies(f), ctx));
  return { ctx, store, lokal };
}

/* ═══════════ Das Register ═══════════ */

function reg(vorgabe) {
  const u = umgebung(['public/js/features/seiten.js'], vorgabe);
  vm.runInContext(`globalThis.__s = { alle:seitenAlle, liste:seitenListe, nach:seiteNach,
    anlegen:seiteAnlegen, setzen:seiteSetzen, verschieben:seiteVerschieben,
    loeschen:seiteLoeschen, loeschbar:seiteLoeschbar, zuruecksetzen:seitenZuruecksetzen,
    geaendert:seitenGeaendert, arten:()=>SEITEN_ARTEN, art:seitenArt,
    aktuell:seiteAktuell, istArt:seiteIstArt, setSeg:(v)=>{ curSeg=v; }, seg:()=>curSeg };`, u.ctx);
  return { s: u.ctx.__s, store: u.store, ctx: u.ctx };
}

test('ausgeliefert stehen genau die zwei Seiten von vorher — mit denselben Kennungen', () => {
  const { s, store } = reg();
  const l = s.alle();
  assert.equal(l.length, 2);
  assert.equal(l[0].id, 'standard');
  assert.equal(l[1].id, 'anleitung');
  assert.equal(l[0].wort, 'Standards');
  assert.equal(l[1].wort, 'Anleitungen');
  assert.equal(store.hkl_seiten, undefined, 'ohne Eingriff wird nichts gespeichert');
  assert.equal(s.geaendert(), false);
});

test('der Code kennt fünf Arten, das Haus legt daraus Seiten an', () => {
  const { s } = reg();
  const arten = s.arten().map(a => a.key);
  assert.deepEqual(JSON.parse(JSON.stringify(arten)),
    ['standards', 'anleitungen', 'aufgaben', 'aktuelles', 'bestellungen']);
});

test('eine Seite anlegen — und dieselbe Art darf mehrfach vorkommen', () => {
  const { s } = reg();
  const a = s.anlegen('aufgaben');
  const b = s.anlegen('aufgaben', 'Wartung');
  assert.ok(a && b);
  assert.notEqual(a.id, b.id, 'zwei Aufgaben-Seiten brauchen zwei Kennungen');
  assert.equal(s.alle().length, 4);
  assert.equal(s.nach(b.id).wort, 'Wartung');
  assert.equal(s.nach(a.id).wort, 'Aufgaben', 'ohne eigenes Wort gilt das der Art');
});

test('eine unbekannte Art entsteht gar nicht erst', () => {
  const { s } = reg();
  assert.equal(s.anlegen('gibtsnicht'), null);
  assert.equal(s.alle().length, 2);
});

test('Wort und Symbol sind änderbar, das Zurücksetzen geht über den leeren Wert', () => {
  const { s } = reg();
  s.setzen('standard', 'wort', 'Eingriffe');
  s.setzen('standard', 'ico', '🫀');
  assert.equal(s.nach('standard').wort, 'Eingriffe');
  assert.equal(s.nach('standard').ico, '🫀');
  s.setzen('standard', 'wort', '');
  assert.equal(s.nach('standard').wort, 'Standards', 'leer heißt: wieder die Vorgabe');
});

test('Reihenfolge lässt sich ändern und bleibt', () => {
  const { s } = reg();
  assert.equal(s.verschieben('anleitung', -1), true);
  assert.equal(s.alle()[0].id, 'anleitung');
  assert.equal(s.verschieben('anleitung', -1), false, 'weiter als an den Anfang geht nicht');
});

test('ausgeblendete Seiten sind für Nutzer weg — in der Verwaltung bleiben sie sichtbar', () => {
  const { s } = reg();
  s.setzen('anleitung', 'aus', true);
  assert.equal(s.liste(false).length, 1);
  assert.equal(s.liste(true).length, 2, 'sonst käme man nie wieder an sie heran');
});

test('eine ausgelieferte Seite lässt sich NICHT löschen, eine eigene schon', () => {
  const { s } = reg();
  assert.equal(s.loeschbar('standard'), false);
  assert.equal(s.loeschen('standard'), false);
  const neu = s.anlegen('aktuelles');
  assert.equal(s.loeschbar(neu.id), true);
  assert.equal(s.loeschen(neu.id), true);
  assert.equal(s.alle().length, 2);
});

test('zeigt die gewählte Seite ins Leere, greift die erste sichtbare — nie ein leerer Bildschirm', () => {
  const { s } = reg();
  s.setSeg('gibtsnicht');
  const a = s.aktuell();
  assert.equal(a.id, 'standard');
  assert.equal(s.seg(), 'standard', 'die Wahl wird gleich mitkorrigiert');
});

/* Diese Prüfung gibt es, weil genau hier ein Fehler saß: verglichen wurde das
   OBJEKT statt der Kennung. seitenAlle() baut die Seiten bei jedem Aufruf neu
   zusammen — der Vergleich traf nie zu, und JEDE Umschaltung fiel stumm auf
   die erste Seite zurück. Sichtbar wurde das erst im Browser. */
test('die gewählte Seite bleibt gewählt — auch die zweite, dritte, letzte', () => {
  const { s } = reg();
  s.anlegen('aufgaben', 'Wochencheck');
  s.anlegen('bestellungen');
  s.alle().forEach(seite => {
    s.setSeg(seite.id);
    assert.equal(s.aktuell().id, seite.id, 'gewählt: ' + seite.id);
    assert.equal(s.seg(), seite.id, 'die Wahl wird nicht heimlich umgebogen');
  });
});

test('seiteIstArt fragt nach der ART, nicht nach der Kennung', () => {
  const { s } = reg();
  const neu = s.anlegen('standards', 'EPU');
  s.setSeg(neu.id);
  assert.equal(s.istArt('standards'), true, 'eine zweite Standard-Seite ist immer noch eine Standard-Seite');
  assert.equal(s.istArt('anleitungen'), false);
  const anl = s.anlegen('anleitungen', 'Aufbau');
  s.setSeg(anl.id);
  assert.equal(s.istArt('anleitungen'), true);
  assert.equal(s.istArt('standards'), false, 'sonst zeigte die App zwei Seiten gleichzeitig an');
});

test('eine Seite mit unbekannter Art fällt heraus, statt die Leiste zu sprengen', () => {
  const { s } = reg({ hkl_seiten: [{ id: 'x', art: 'gibtsnichtmehr' }, { id: 'standard', art: 'standards' }] });
  assert.equal(s.alle().length, 1);
  assert.equal(s.alle()[0].id, 'standard');
});

test('Zurücksetzen bringt die Auslieferung wieder', () => {
  const { s } = reg();
  s.anlegen('aufgaben'); s.setzen('standard', 'wort', 'X');
  s.zuruecksetzen();
  assert.equal(s.alle().length, 2);
  assert.equal(s.alle()[0].wort, 'Standards');
});

/* ═══════════ Aufgaben ═══════════ */

function auf(vorgabe) {
  const u = umgebung(['public/js/features/kuerzel.js', 'public/js/features/aufgaben.js'], vorgabe);
  vm.runInContext(`globalThis.__a = { anlegen:aufAnlegen, nach:aufNach, loeschen:aufLoeschen,
    abhaken:aufAbhaken, zurueck:aufZuruecknehmen, naechste:aufNaechste, stand:aufStand,
    heute:aufHeute, sortiert:aufgabenSortiert, offen:aufgabenOffen, fuer:aufgabenFuer,
    letzter:aufLetzter, takte:aufTakte, alle:()=>AUFG };`, u.ctx);
  return { a: u.ctx.__a, store: u.store, ctx: u.ctx };
}

test('die nächste Fälligkeit rechnet vom SOLL-Termin, nicht vom Erledigungstag', () => {
  const { a } = auf();
  /* Wochencheck war Montag fällig, gemacht wird er Mittwoch — der nächste
     bleibt trotzdem Montag. */
  assert.equal(a.naechste('2026-08-03', 'woechentlich', '2026-08-05'), '2026-08-10');
});

test('lange nicht gemacht: es entsteht EIN nächster Termin, nicht zwölf offene', () => {
  const { a } = auf();
  const n = a.naechste('2026-01-05', 'woechentlich', '2026-08-06');
  assert.ok(n > '2026-08-06', 'der neue Termin liegt in der Zukunft');
  assert.equal(n, '2026-08-10', 'und zwar auf demselben Wochentag wie das Soll');
});

test('monatlich rechnet über den Kalender — der 31. rutscht nicht', () => {
  const { a } = auf();
  assert.equal(a.naechste('2026-01-31', 'monatlich', '2026-01-31'), '2026-02-28');
  assert.equal(a.naechste('2026-03-15', 'monatlich', '2026-03-15'), '2026-04-15');
  assert.equal(a.naechste('2026-12-15', 'monatlich', '2026-12-15'), '2027-01-15');
});

test('einmalige Aufgaben bekommen keinen Folgetermin', () => {
  const { a } = auf();
  assert.equal(a.naechste('2026-08-06', 'einmal', '2026-08-06'), null);
});

test('der Stand sagt, was los ist — überfällig zuerst', () => {
  const { a } = auf();
  assert.equal(a.stand({ faellig: '2026-08-04' }, '2026-08-06').key, 'ueber');
  assert.equal(a.stand({ faellig: '2026-08-04' }, '2026-08-06').wort, '2 Tage überfällig');
  assert.equal(a.stand({ faellig: '2026-08-06' }, '2026-08-06').key, 'heute');
  assert.equal(a.stand({ faellig: '2026-08-07' }, '2026-08-06').key, 'morgen');
  assert.equal(a.stand({ faellig: '2026-08-20' }, '2026-08-06').key, 'spaeter');
  assert.equal(a.stand({}, '2026-08-06').key, 'ohne');
  assert.ok(a.stand({ faellig: '2026-08-04' }, '2026-08-06').rang
          < a.stand({ faellig: '2026-08-06' }, '2026-08-06').rang);
});

test('DER KERN: ein Haken trägt Kürzel und Uhrzeit — und die Frage ist beantwortet', () => {
  const { a } = auf();
  const x = a.anlegen({ wort: 'Notfallwagen prüfen', takt: 'woechentlich', faellig: '2026-08-03' });
  const e = a.abhaken(x.id, 'MB', '2026-08-05');
  assert.equal(e.kuerzel, 'MB');
  assert.ok(e.ts);
  assert.equal(e.fuer, '2026-08-03', 'der Haken weiß, FÜR welchen Termin er galt');
  assert.equal(a.nach(x.id).faellig, '2026-08-10', 'und der nächste Termin steht');
  assert.equal(a.nach(x.id).verlauf.length, 1);
});

test('der Verlauf bleibt — zweite Frage im Saal: „wie oft fiel es aus?"', () => {
  const { a } = auf();
  const x = a.anlegen({ wort: 'X', takt: 'taeglich', faellig: '2026-08-01' });
  a.abhaken(x.id, 'AB', '2026-08-01');
  a.abhaken(x.id, 'CD', '2026-08-02');
  assert.equal(a.nach(x.id).verlauf.length, 2);
  assert.equal(a.letzter(a.nach(x.id)).kuerzel, 'CD');
});

test('ein Fehlgriff ist zurücknehmbar — samt Termin', () => {
  const { a } = auf();
  const x = a.anlegen({ wort: 'X', takt: 'woechentlich', faellig: '2026-08-03' });
  a.abhaken(x.id, 'MB', '2026-08-03');
  assert.equal(a.nach(x.id).faellig, '2026-08-10');
  assert.equal(a.zurueck(x.id), true);
  assert.equal(a.nach(x.id).faellig, '2026-08-03', 'nicht eine Woche warten müssen');
  assert.equal(a.nach(x.id).verlauf.length, 0);
});

test('eine einmalige Aufgabe ist nach dem Haken abgeschlossen', () => {
  const { a } = auf();
  const x = a.anlegen({ wort: 'X', takt: 'einmal', faellig: '2026-08-06' });
  a.abhaken(x.id, 'MB', '2026-08-06');
  assert.equal(a.nach(x.id).erledigt, true);
  assert.equal(a.offen(null).length, 0);
});

test('sortiert wird nach Dringlichkeit: was brennt, steht oben', () => {
  const { a } = auf();
  a.anlegen({ wort: 'später', takt: 'einmal', faellig: '2026-09-01' });
  a.anlegen({ wort: 'überfällig', takt: 'einmal', faellig: '2026-08-01' });
  a.anlegen({ wort: 'heute', takt: 'einmal', faellig: '2026-08-06' });
  const l = a.sortiert(null, '2026-08-06').map(x => x.wort);
  assert.equal(l[0], 'überfällig');
  assert.equal(l[1], 'heute');
});

test('eine Aufgabe ohne Wort entsteht nicht', () => {
  const { a } = auf();
  assert.equal(a.anlegen({ wort: '  ' }), null);
  assert.equal(a.alle().length, 0);
});

test('Aufgaben einer Seite: ohne Zuordnung gelten sie überall', () => {
  const { a } = auf();
  a.anlegen({ wort: 'A', seite: 's1' });
  a.anlegen({ wort: 'B', seite: null });
  assert.equal(a.fuer({ id: 's1' }).length, 2);
  assert.equal(a.fuer({ id: 's2' }).length, 1, 'nur die ohne Zuordnung');
});

/* ═══════════ Aktuelles ═══════════ */

function akt(vorgabe) {
  const u = umgebung(['public/js/features/kuerzel.js', 'public/js/features/aktuelles.js'], vorgabe);
  vm.runInContext(`globalThis.__k = { anlegen:aktAnlegen, nach:aktNach, gilt:aktGilt,
    geltende:aktGeltende, abgelaufene:aktAbgelaufene, kuenftige:aktKuenftige,
    beenden:aktBeenden, verlaengern:aktVerlaengern, rest:aktRest, loeschen:aktLoeschen,
    arten:aktArten, artAnlegen:aktArtAnlegen, artLoeschen:aktArtLoeschen, art:aktArt,
    alle:()=>AKTU };`, u.ctx);
  return { k: u.ctx.__k, store: u.store };
}

test('vier Arten sind ausgeliefert, der Notfall ist laut', () => {
  const { k } = akt();
  assert.equal(k.arten().length, 4);
  assert.equal(k.art('notfall').laut, true);
  assert.equal(k.art('info').laut, undefined);
});

test('eigene Arten kommen dazu und lassen sich entfernen', () => {
  const { k } = akt();
  const a = k.artAnlegen('Personalmangel');
  assert.equal(a.key, 'personalmangel');
  assert.equal(k.arten().length, 5);
  k.artLoeschen(a.key);
  assert.equal(k.arten().length, 4);
});

test('DIE GÜLTIGKEIT: was abgelaufen ist, gilt nicht mehr — verschwindet aber nicht', () => {
  const { k } = akt();
  const x = k.anlegen({ wort: 'HKL 3 Notfall', art: 'notfall', bis: '2026-08-06T12:00' });
  assert.equal(k.gilt(x, '2026-08-06T11:00'), true);
  assert.equal(k.gilt(x, '2026-08-06T13:00'), false);
  assert.equal(k.geltende('2026-08-06T13:00').length, 0);
  assert.equal(k.abgelaufene('2026-08-06T13:00').length, 1, 'lesbar bleibt es');
  assert.equal(k.alle().length, 1, 'gelöscht wird nichts von allein');
});

test('ein Aushang mit Beginn in der Zukunft ist angekündigt, nicht gültig', () => {
  const { k } = akt();
  k.anlegen({ wort: 'Wartung ab 12', von: '2026-08-06T12:00', bis: '2026-08-06T18:00' });
  assert.equal(k.geltende('2026-08-06T10:00').length, 0);
  assert.equal(k.kuenftige('2026-08-06T10:00').length, 1);
  assert.equal(k.geltende('2026-08-06T13:00').length, 1);
});

test('Beenden setzt das Ende auf jetzt — es wird nicht gelöscht', () => {
  const { k } = akt();
  const x = k.anlegen({ wort: 'X', bis: '2026-12-31T23:59' });
  k.beenden(x.id);
  assert.equal(k.gilt(k.nach(x.id)), false);
  assert.equal(k.alle().length, 1, 'wer nachliest, soll sehen, dass es galt');
});

test('Verlängern hängt an das Ende an, nicht an jetzt', () => {
  const { k } = akt();
  const weit = new Date(Date.now() + 3600000 * 5);
  const p = (n) => String(n).padStart(2, '0');
  const iso = weit.getFullYear() + '-' + p(weit.getMonth() + 1) + '-' + p(weit.getDate()) + 'T' + p(weit.getHours()) + ':' + p(weit.getMinutes());
  const x = k.anlegen({ wort: 'X', bis: iso });
  k.verlaengern(x.id, 2);
  const neu = new Date(k.nach(x.id).bis);
  assert.ok(neu - weit > 3600000, 'gerechnet wird ab dem bisherigen Ende');
});

test('die Restzeit ist die Auskunft, die zählt', () => {
  const { k } = akt();
  const in30 = new Date(Date.now() + 30 * 60000);
  const p = (n) => String(n).padStart(2, '0');
  const iso = in30.getFullYear() + '-' + p(in30.getMonth() + 1) + '-' + p(in30.getDate()) + 'T' + p(in30.getHours()) + ':' + p(in30.getMinutes());
  assert.match(k.rest({ bis: iso }), /noch \d+ Min\./);
  assert.equal(k.rest({}), 'ohne Ende');
});

test('ein Aushang ohne Wort entsteht nicht', () => {
  const { k } = akt();
  assert.equal(k.anlegen({ wort: '' }), null);
});

/* ═══════════ Bestellungen ═══════════ */

function best(vorgabe) {
  const u = umgebung(['public/js/features/kuerzel.js', 'public/js/features/bestellungen.js'], vorgabe);
  vm.runInContext(`globalThis.__b = { melden:bestMelden, nach:bestNach, stufe:bestStufe,
    weiter:bestWeiter, zurueck:bestZurueck, offen:bestOffen, erledigt:bestErledigt,
    loeschen:bestLoeschen, wort:bestWort, alle:()=>BEST };`, u.ctx);
  return { b: u.ctx.__b, store: u.store, lokal: u.lokal };
}

test('DREI ZUSTÄNDE, weil es drei Fragen sind', () => {
  const { b } = best();
  const x = b.melden({ wort: 'Führungskatheter EBU 3.5' });
  assert.equal(b.stufe(x), 'gemeldet');
  assert.equal(b.weiter(x.id, 'MB'), 'bestellt');
  assert.equal(b.stufe(b.nach(x.id)), 'bestellt');
  assert.equal(b.weiter(x.id, 'CD'), 'geliefert');
  assert.equal(b.weiter(x.id, 'XY'), null, 'weiter als geliefert geht nicht');
});

test('jeder Schritt trägt Kürzel und Uhrzeit', () => {
  const { b } = best();
  const x = b.melden({ wort: 'X' });
  b.weiter(x.id, 'MB');
  const n = b.nach(x.id);
  assert.equal(n.bestellt.kuerzel, 'MB');
  assert.ok(n.bestellt.ts);
  assert.ok(n.gemeldet.ts, 'auch das Melden selbst');
});

test('ein Fehlgriff geht zurück, statt neu getippt werden zu müssen', () => {
  const { b } = best();
  const x = b.melden({ wort: 'X' });
  b.weiter(x.id, 'MB');
  assert.equal(b.zurueck(x.id), 'gemeldet');
  assert.equal(b.nach(x.id).bestellt, null);
  assert.equal(b.zurueck(x.id), null, 'vor „gemeldet" gibt es nichts');
});

test('Geliefertes wandert in „Erledigt" und bleibt nachlesbar', () => {
  const { b } = best();
  const x = b.melden({ wort: 'X' });
  b.weiter(x.id, 'A'); b.weiter(x.id, 'B');
  assert.equal(b.offen().length, 0);
  assert.equal(b.erledigt().length, 1);
  assert.equal(b.alle().length, 1);
});

test('eine Meldung ohne Material ist erlaubt — leer schlägt falsch', () => {
  const { b } = best();
  const x = b.melden({ wort: 'Führungskatheter, weiß nicht welcher' });
  assert.ok(x, 'im Saal darf eine Meldung nicht an einer Pflicht scheitern');
  assert.equal(x.matKey, null);
});

test('eine Meldung ohne Wort entsteht nicht', () => {
  const { b } = best();
  assert.equal(b.melden({ wort: '   ' }), null);
  assert.equal(b.alle().length, 0);
});

test('die Wörter der Stufen gehören dem Haus', () => {
  const { b } = best();
  assert.equal(b.wort('gemeldet', 'wort'), 'gemeldet');
  assert.equal(b.wort('bestellt', 'tu'), 'Geliefert');
  assert.equal(b.wort('geliefert', 'tu'), '', 'nach geliefert kommt nichts');
});

/* ═══════════ Das Kürzel ═══════════ */

test('das Kürzel bleibt am Gerät und ist begrenzt', () => {
  const u = umgebung(['public/js/features/kuerzel.js']);
  vm.runInContext(`globalThis.__k = { setzen:kuerzelSetzen, holen:kuerzel, da:kuerzelDa,
    haken:kuerzelHaken, vermerk:kuerzelVermerk };`, u.ctx);
  const k = u.ctx.__k;
  assert.equal(k.da(), false);
  assert.equal(k.setzen('  MB  '), 'MB', 'Leerraum weg');
  assert.equal(k.holen(), 'MB');
  assert.equal(k.da(), true);
  assert.equal(k.setzen('123456789012345').length, 12, 'nicht endlos lang');
  assert.equal(u.lokal.hkl_kuerzel, k.holen(), 'gerätelokal gespeichert');
});

test('der Vermerk nennt Zeit UND Person — sonst ist die Frage nur halb beantwortet', () => {
  const u = umgebung(['public/js/features/kuerzel.js']);
  vm.runInContext(`globalThis.__k = { vermerk:kuerzelVermerk };`, u.ctx);
  const v = u.ctx.__k.vermerk({ ts: new Date().toISOString(), kuerzel: 'MB' });
  assert.match(v, /MB/);
  assert.match(v, /\d\d:\d\d/);
  assert.equal(u.ctx.__k.vermerk({ ts: new Date().toISOString(), kuerzel: '' }).indexOf('·'), -1,
    'ohne Kürzel kein leerer Trenner');
});
