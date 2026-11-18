'use strict';
/* Tests für den Aufbau aus dem Bestand (public/neu/js/bestand.js).
   Reine Logik: den Bestand so aufbereiten, wie das Labor ihn sieht, darin
   suchen und Stücke in einen Standard des Neuaufbaus einfügen. Dass die
   Aufbereitung dasselbe ergibt wie die alte App, prüft zusätzlich der
   Browser-Test e2e/neue-app-aufbau.js. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'public/neu/js/kern.js'), 'utf8') + '\n'
  + fs.readFileSync(path.join(ROOT, 'public/neu/js/bestand.js'), 'utf8')
  + '\n;globalThis.__B = { naBestandAufbereiten, naBstWerte, naBstSlug, naBstIndex, naBstSuchen, naBstPosition, naBstAbschnittNeu, naBstRubrikNeu, naStdEinfuegen, naBstBenutzt, naBstMarke, naNorm };', ctx);
const B = ctx.__B;
const plain = v => JSON.parse(JSON.stringify(v));

/* Ein kleiner Bestand: zwei eingelesene Standards. */
const z = (roh, natur, extra) => Object.assign({ roh_text: roh, anzeige_text: roh.replace(/^🔲\s*/, ''), natur: natur || 'hinweis', menge: null, groessen: [], spezifikation: null, zusatz_markierung: null, material_key: null, unterkategorie: null }, extra || {});
const EXP = { standards: [
  { id: 'pci', titel: 'PCI', gruppe: 'PCI', rubriken: [
    { name: 'Saal und Geräte', typ: 'geraete', sub_bereiche: [{ name: null, eintraege: [
      z('🔲 Druckableitung vorbereiten', 'geraet'),
      z('🔲 Programmer neben Notfallwagen ► EKG', 'geraet', { anzeige_text: 'Programmer neben Notfallwagen', spezifikation: 'an den Defi', zusatz_markierung: { typ: 'für', fundstelle: 'für Analyser' } }),
      z('🔲 Mobiles Sono', 'geraet', { unterkategorie: 'In Bereitschaft' }) ] }] },
    { name: 'Materialien', typ: 'material', sub_bereiche: [{ name: null, eintraege: [
      z('Material aus dem Vorbereitungsraum', 'ueberschrift'),
      z('1x Coro-Set', 'material', { anzeige_text: 'Coro-Set', menge: '1x', unterkategorie: 'Material aus dem Vorbereitungsraum', material_key: 'coro-set' }),
      z('Materialien auf Ansage', 'ueberschrift'),
      z('1x Amp. Heparin', 'medikament', { anzeige_text: 'Amp. Heparin', unterkategorie: 'Materialien auf Ansage', material_key: 'amp. heparin' }) ] }] },
    { name: 'Patient', typ: 'sonstige', sub_bereiche: [
      { name: 'In der Bettenwarte', eintraege: [ z('🔲 Checkliste ausfüllen'), z('Wird bei Bedarf **sediert**') ] },
      { name: null, eintraege: [ z('Im Saal', 'ueberschrift'), z('🔲 Druckableitung vorbereiten'), z('🔲 Dreifache Wischdesinfektion mit Softasept® N', 'material', { material_key: 'softasept' }) ] } ] },
    { name: 'Alt', typ: 'sonstige', sub_bereiche: [{ name: null, eintraege: [ z('🔲 nicht mehr gebraucht') ] }] } ] },
  { id: 'epu', titel: 'EPU', gruppe: 'EPU', rubriken: [
    { name: 'Ablauf der Prozedur', typ: 'sonstige', sub_bereiche: [{ name: null, eintraege: [ z('🔲 Druckableitung vorbereiten'), z('🔲 Kabel anschließen'), z('🔲 Kabel prüfen') ] }] } ] } ] };
/* Was die alte App im Labor darübergelegt hat — so, wie der Server es liefert (JSON-Text je Schlüssel). */
const J = o => JSON.stringify(o);
const ZUSTAND = {
  hkl_stdedits: J({ pci: { titel: 'PCI elektiv' }, epu: { gruppe: 'Rhythmus' } }),
  hkl_rubedits: J({ 'pci|3': { hidden: true }, 'pci|2': { name: 'Patientenvorbereitung', ord: -1 } }),
  hkl_qedits: { cid: { 'pci|2|0|0': { name: 'Checkliste Sedierung ausfüllen' }, 'epu|0|0|2': { hidden: true } }, mat: {} },   /* als Objekt, nicht als Text — beides kommt vor */
  hkl_reassign: J({ 'pci|0|0|0': 'In Bereitschaft' }),
  hkl_entryorder: J({ 'epu|0|seg0': ['epu|0|0|1', 'epu|0|0|0'] }),
  hkl_uksections: J({ 'pci|0': ['Leerer Abschnitt'] }),
  hkl_hints: J({ overview: [], std: { pci: [{ id: 'h1', text: 'Findet immer in HKL 1 statt' }] }, rub: { 'pci|2': [{ id: 'h2', text: 'Auf Ansage' }] } }),
  hkl_rules: J([{ id: 'r1', ts: '2026-07-18T10:00:00Z', op: 'set', ziel: { art: 'text', key: 't:kabel anschließen' }, wo: { art: 'gruppe', wert: 'Rhythmus' }, prop: 'name', wert: 'Kabel anschließen (EPU)' }]),
  hkl_additions: J({ standards: [{ id: 'micra', titel: 'MICRA', gruppe: 'CRM', _added: true, rubriken: [{ name: 'Ablauf', typ: 'ablauf', sub_bereiche: [] }] }],
    entries: { 'micra|0': [Object.assign(z('Programmer-Tablet neben den Notfallwagen'), { _added: true })] } }),
};

test('Werte des Bestands: JSON-Text und Objekte', () => {
  const w = plain(B.naBstWerte({ a: '{"x":1}', b: { y: 2 }, c: 'kein json' }));
  assert.deepEqual(w, { a: { x: 1 }, b: { y: 2 }, c: 'kein json' });
  assert.equal(B.naBstSlug('MAP 152 · JR 4®'), 'map152jr4');                  /* wie zerlSlug der alten App */
  assert.equal(B.naBstSlug('Kleiner  Tisch'), 'kleiner tisch');
});

test('Aufbereitung: der Bestand, wie das Labor ihn sieht', () => {
  const s = plain(B.naBestandAufbereiten(EXP, ZUSTAND));
  assert.deepEqual(s.map(x => x.id + ':' + x.titel + ':' + x.gruppe), ['pci:PCI elektiv:PCI', 'epu:EPU:Rhythmus', 'micra:MICRA:CRM']);
  const pci = s[0];
  /* Rubriken: „Alt" ausgeblendet, „Patient" umbenannt und nach vorn sortiert */
  assert.deepEqual(pci.rubriken.map(r => r.name + (r.material ? ' [Material]' : '')), ['Patientenvorbereitung', 'Saal und Geräte', 'Materialien [Material]']);
  assert.deepEqual(pci.notizen.map(n => n.text), ['Findet immer in HKL 1 statt']);
  const pat = pci.rubriken[0];
  assert.deepEqual(pat.notizen.map(n => n.text), ['Auf Ansage']);
  /* Abschnitte aus Unterbereichen und Zwischenüberschriften; Textkorrektur des Labors; Auszeichnung entfernt */
  assert.deepEqual(pat.abschnitte.map(a => a.name + ': ' + a.zeilen.map(l => l.text).join(' | ')),
    ['In der Bettenwarte: Checkliste Sedierung ausfüllen | Wird bei Bedarf sediert', 'Im Saal: Druckableitung vorbereiten | Dreifache Wischdesinfektion mit Softasept® N']);
  assert.equal(pat.abschnitte[0].zeilen[0].wort, 'Checkliste ausfüllen');        /* der Word-Wortlaut, weil er abweicht */
  assert.equal(pat.abschnitte[0].zeilen[0].kaestchen, true);
  assert.equal(pat.abschnitte[0].zeilen[1].kaestchen, false);
  /* Geräte-Rubrik: nach Unterkategorie, mit Umsortierung durch das Labor und leerem eigenem Abschnitt */
  const saal = pci.rubriken[1];
  assert.deepEqual(saal.abschnitte.map(a => a.name + ':' + a.zeilen.map(l => l.text).join('|')),
    [':Programmer neben Notfallwagen', 'In Bereitschaft:Druckableitung vorbereiten|Mobiles Sono', 'Leerer Abschnitt:']);
  const prog = saal.abschnitte[0].zeilen[0];
  assert.equal(prog.zusatz, 'an den Defi · für Analyser');
  /* Zusätze, die schon im Text stehen, erscheinen nicht doppelt */
  const doppelt = plain(B.naBestandAufbereiten({ standards: [{ id: 'x', titel: 'X', gruppe: 'G', rubriken: [{ name: 'R', typ: 'sonstige', sub_bereiche: [{ name: null, eintraege: [
    z('🔲 C-Bogen rotieren für Aggregat links!', 'hinweis', { spezifikation: 'Aggregat links', zusatz_markierung: { fundstelle: 'für Aggregat links!' } }) ] }] }] }] }, {}));
  assert.equal(doppelt[0].rubriken[0].abschnitte[0].zeilen[0].zusatz, '');
  assert.equal(prog.wort, 'Programmer neben Notfallwagen ► EKG');
  /* Material-Rubrik: gekennzeichnet; Abschnitte aus den Überschriften */
  assert.deepEqual(pci.rubriken[2].abschnitte.map(a => a.name), ['Material aus dem Vorbereitungsraum', 'Materialien auf Ansage']);
  /* EPU: Regel der Gruppe benennt um, Labor blendet aus und sortiert um */
  assert.deepEqual(s[1].rubriken[0].abschnitte[0].zeilen.map(l => l.text), ['Kabel anschließen (EPU)', 'Druckableitung vorbereiten']);
  /* im Labor angelegter Standard */
  assert.equal(s[2].eigen, true);
  assert.deepEqual(s[2].rubriken[0].abschnitte[0].zeilen.map(l => l.text), ['Programmer-Tablet neben den Notfallwagen']);
  /* ohne Änderungen im Labor: die eingelesenen Standards, so wie sie sind */
  const roh = plain(B.naBestandAufbereiten(EXP, {}));
  assert.deepEqual(roh.map(x => x.titel), ['PCI', 'EPU']);
  assert.deepEqual(roh[0].rubriken.map(r => r.name), ['Saal und Geräte', 'Materialien', 'Patient', 'Alt']);
});

test('Suchen: Formulierungen zusammengefasst, Material-Rubriken nicht durchsucht, Filter', () => {
  const s = B.naBestandAufbereiten(EXP, ZUSTAND); const ix = B.naBstIndex(s);
  const e = plain(B.naBstSuchen(s, ix, 'druckableitung', {}));
  assert.equal(e.formulierungen.length, 1);
  assert.equal(e.formulierungen[0].text, 'Druckableitung vorbereiten');
  assert.equal(e.formulierungen[0].nStd, 2); assert.equal(e.formulierungen[0].stellen.length, 3);
  assert.equal(plain(B.naBstSuchen(s, ix, 'heparin', {})).formulierungen.length, 0);    /* steht nur in der Material-Rubrik */
  assert.equal(plain(B.naBstSuchen(s, ix, 'softasept', {})).formulierungen.length, 1);  /* ein Arbeitsschritt, der ein Material nennt: ja */
  assert.equal(plain(B.naBstSuchen(s, ix, 'druckableitung', { gruppe: 'Rhythmus' })).formulierungen[0].stellen.length, 1);
  assert.equal(plain(B.naBstSuchen(s, ix, 'druckableitung', { rubrik: 'Saal und Geräte' })).formulierungen[0].stellen.length, 1);
  const n = plain(B.naBstSuchen(s, ix, 'ansage', {}));
  assert.deepEqual(n.abschnitte.map(a => a.name + ':' + a.stellen.length), ['Materialien auf Ansage:1']);  /* die Hülle ist findbar */
  assert.equal(n.formulierungen[0].text, 'Auf Ansage');                                                     /* die Notiz */
  assert.deepEqual(plain(B.naBstSuchen(s, ix, 'micra', {})).standards.map(x => x.id), ['micra']);
  assert.equal(B.naBstSuchen(s, ix, '  ', {}), null);
  assert.ok(plain(B.naBstSuchen(s, ix, 'kabel prüfen', {})).formulierungen.length === 0);   /* vom Labor ausgeblendet */
});

test('Übernehmen: Position mit Herkunft, Abschnitt, Rubrik — Material nur als Hülle', () => {
  const s = B.naBestandAufbereiten(EXP, ZUSTAND); const pci = s[0];
  const l = pci.rubriken[1].abschnitte[0].zeilen[0];
  const p = plain(B.naBstPosition(pci, l));
  assert.equal(p.art, 'schritt'); assert.equal(p.text, 'Programmer neben Notfallwagen'); assert.equal(p.zusatz, 'an den Defi · für Analyser');
  assert.deepEqual(p.herkunft, { q: 'bestand', std: 'pci', titel: 'PCI elektiv', z: 'pci|0|0|1', t: 'Programmer neben Notfallwagen' });
  assert.equal(plain(B.naBstPosition(pci, l, 'eigener Text')).text, 'eigener Text');
  assert.equal(plain(B.naBstPosition(pci, l, 'Programmer an den Defi')).zusatz, 'für Analyser');   /* beim Wortlaut: was schon drinsteht, fällt weg */
  assert.equal(plain(B.naBstPosition(pci, pci.notizen[0])).art, 'hinweis');
  const pat = plain(B.naBstRubrikNeu(pci, pci.rubriken[0]));
  assert.equal(pat.name, 'Patientenvorbereitung');
  assert.deepEqual(pat.abschnitte.map(a => a.name + ':' + a.positionen.length), ['In der Bettenwarte:3', 'Im Saal:2']);   /* die Notiz der Rubrik steht vorn */
  assert.equal(pat.abschnitte[0].positionen[0].text, 'Auf Ansage');
  const mat = plain(B.naBstRubrikNeu(pci, pci.rubriken[2]));
  assert.deepEqual(mat.abschnitte.map(a => a.name + ':' + a.positionen.length), ['Material aus dem Vorbereitungsraum:0', 'Materialien auf Ansage:0']);
  assert.equal(plain(B.naBstAbschnittNeu(pci, pci.rubriken[2], pci.rubriken[2].abschnitte[0])).positionen.length, 0);
});

test('Einfügen in einen Standard: alle Ziele', () => {
  const st = () => ({ id: 's', titel: 'Neu', rubriken: [{ id: 'r1', name: 'A', abschnitte: [{ id: 'a1', name: '', positionen: [{ id: 'p1', text: 'eins' }, { id: 'p2', text: 'zwei' }] }] }, { id: 'r2', name: 'B', abschnitte: [{ id: 'a2', name: '', positionen: [] }] }] });
  const pos = t => ({ art: 'positionen', liste: [{ id: 'n', text: t }], rubName: 'Quelle', absName: 'Abschnitt' });
  let s = st(); assert.equal(B.naStdEinfuegen(s, { art: 'pos', a: 'a1', i: 1 }, pos('neu')), true);
  assert.deepEqual(plain(s.rubriken[0].abschnitte[0].positionen.map(p => p.text)), ['eins', 'neu', 'zwei']);
  s = st(); B.naStdEinfuegen(s, { art: 'posende', a: 'a1' }, pos('neu')); assert.deepEqual(plain(s.rubriken[0].abschnitte[0].positionen.map(p => p.text)), ['eins', 'zwei', 'neu']);
  s = st(); B.naStdEinfuegen(s, { art: 'rubende', r: 'r2' }, pos('neu')); assert.deepEqual(plain(s.rubriken[1].abschnitte[0].positionen.map(p => p.text)), ['neu']);
  s = st(); B.naStdEinfuegen(s, { art: 'neu' }, pos('neu'));
  assert.deepEqual(plain(s.rubriken[2]).abschnitte[0].positionen.map(p => p.text), ['neu']); assert.equal(s.rubriken[2].name, 'Quelle'); assert.equal(s.rubriken[2].abschnitte[0].name, 'Abschnitt');
  const abs = { art: 'abschnitt', abschnitt: { id: 'x', name: 'Neu-Abschnitt', positionen: [] }, rubName: 'Quelle' };
  s = st(); B.naStdEinfuegen(s, { art: 'abs', r: 'r1', i: 0 }, abs); assert.deepEqual(plain(s.rubriken[0].abschnitte.map(a => a.id)), ['x', 'a1']);
  s = st(); B.naStdEinfuegen(s, { art: 'absende', r: 'r2' }, abs); assert.deepEqual(plain(s.rubriken[1].abschnitte.map(a => a.id)), ['x']);   /* der leere Platzhalter weicht */
  s = st(); B.naStdEinfuegen(s, { art: 'neu' }, abs); assert.equal(s.rubriken[2].name, 'Quelle');
  const rub = { art: 'rubrik', rubrik: { id: 'rx', name: 'Neu-Rubrik', abschnitte: [] } };
  s = st(); B.naStdEinfuegen(s, { art: 'rub', i: 1 }, rub); assert.deepEqual(plain(s.rubriken.map(r => r.id)), ['r1', 'rx', 'r2']);
  s = st(); B.naStdEinfuegen(s, { art: 'neu' }, rub); assert.deepEqual(plain(s.rubriken.map(r => r.id)), ['r1', 'r2', 'rx']);
  /* falsche Paarungen tun nichts */
  s = st(); assert.equal(B.naStdEinfuegen(s, { art: 'rub', i: 0 }, pos('x')), false); assert.equal(B.naStdEinfuegen(s, { art: 'pos', a: 'gibts-nicht', i: 0 }, pos('x')), false);
  assert.equal(B.naStdEinfuegen(s, { art: 'abs', r: 'r1', i: 0 }, rub), false); assert.equal(JSON.stringify(s), JSON.stringify(st()));
  /* ein Standard ohne Rubriken */
  const leer = { id: 'l', rubriken: [] }; B.naStdEinfuegen(leer, { art: 'neu' }, pos('erste')); assert.equal(leer.rubriken.length, 1);
});

test('Schon übernommen: in diesem Standard und in anderen, nach Stelle und Wortlaut', () => {
  const s = B.naBestandAufbereiten(EXP, ZUSTAND); const pci = s[0];
  const zeilen = pci.rubriken[0].abschnitte[1].zeilen;   /* Druckableitung vorbereiten · Wischdesinfektion */
  const neu = [
    { id: 'n1', rubriken: [{ abschnitte: [{ positionen: [B.naBstPosition(pci, zeilen[0])] }] }] },
    { id: 'n2', rubriken: [{ abschnitte: [{ positionen: [B.naBstPosition(pci, zeilen[1], 'umbenannt'), { id: 'x', text: 'ohne Herkunft' }] }] }] },
  ];
  const b = B.naBstBenutzt(neu, 'n1');
  assert.deepEqual(plain(B.naBstMarke(b, zeilen[0])), { hier: true, anders: 0 });
  assert.deepEqual(plain(B.naBstMarke(b, zeilen[1])), { hier: false, anders: 1 });     /* auch umbenannt erkannt (Stelle) */
  /* dieselbe Formulierung an anderer Stelle (anderer Standard) zählt mit */
  const epuDruck = s[1].rubriken[0].abschnitte[0].zeilen[1];
  assert.equal(epuDruck.text, 'Druckableitung vorbereiten'); assert.equal(B.naBstMarke(b, epuDruck).hier, true);
});
