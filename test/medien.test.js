'use strict';
/* Tests für Bilder an jeder Stelle (public/js/features/medien.js).

   Der gefährlichste Fehler ist hier kein Absturz, sondern ein LEISER
   DATENVERLUST: Die Bildlisten haben zwei Schreibweisen — die alte flache
   Liste von Kennungen und die neue Liste aus {Kennung, Größe}. Liest der Code
   nur eine davon, verschwinden vorhandene Bilder wortlos aus der Anzeige, und
   niemand merkt es, weil nichts kaputtgeht.

   Deshalb prüft die erste Gruppe genau diese Verträglichkeit in beide
   Richtungen. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'public/js/features/medien.js'), 'utf8');

const K1 = '0123456789abcdef0123456789abcdef';
const K2 = 'fedcba9876543210fedcba9876543210';
const K3 = 'aaaabbbbccccddddeeeeffff00001111';

function umgebung(vorgabe) {
  const store = Object.assign({ hkl_medientexte: {}, hkl_medienanker: {} }, vorgabe || {});
  const ctx = vm.createContext({
    console,
    loadJSON: (k, d) => (k in store) ? JSON.parse(JSON.stringify(store[k])) : d,
    saveJSON: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
    esc: (s) => String(s == null ? '' : s),
    window: undefined,
    indexedDB: undefined,
    setTimeout: () => {},
  });
  vm.runInContext(SRC + `
    ;globalThis.__f = {
      paare:medPaare, liste:medListe, groesse:medGroesseGueltig, wort:medGroesseWort,
      istAnker:medIstAnker, ankPaare:medAnkerPaare, ankSchreiben:medAnkerSchreiben,
      eintragen:medEintragen, entfernen:medEntfernen, verschieben:medVerschieben,
      groesseSetzen:medGroesseSetzen,
      satz:medSatz, textSetzen:medTextSetzen, detailSetzen:medDetailSetzen,
      hatDetail:medHatDetail, ankStd:medAnkStd, ankRub:medAnkRub, ankUk:medAnkUk, ankSeg:medAnkSeg,
      bildHTML:medBildHTML, paareHTML:medPaareHTML, ankerHTML:medAnkerHTML,
      max:MED_MAX_PRO_ZEILE, arten:MED_GROESSEN, vorgabe:MED_GROESSE_VORGABE
    };
    ;globalThis.__store = () => ({ txt: MEDTXT, ank: MEDANK });
  `, ctx);
  return { f: ctx.__f, store, holen: ctx.__store };
}

/* ═══ Beide Schreibweisen lesen ═══ */

test('die alte flache Bildliste wird weiter gelesen', () => {
  const { f } = umgebung();
  const p = f.paare([K1, K2]);
  assert.equal(p.length, 2);
  assert.equal(p[0].k, K1);
  assert.equal(p[0].g, f.vorgabe, 'ohne Angabe gilt die Vorgabegröße');
});

test('die neue Form mit Größe wird gelesen', () => {
  const { f } = umgebung();
  const p = f.paare([{ k: K1, g: 'gross' }, { k: K2, g: 'mittel' }]);
  assert.equal(p[0].g, 'gross');
  assert.equal(p[1].g, 'mittel');
});

test('gemischte Listen sind erlaubt — sonst bräuchte es einen Migrationslauf', () => {
  const { f } = umgebung();
  const p = f.paare([K1, { k: K2, g: 'gross' }]);
  assert.equal(p.length, 2);
  assert.equal(p[0].g, f.vorgabe);
  assert.equal(p[1].g, 'gross');
});

test('medListe liefert weiterhin nur die Kennungen', () => {
  const { f } = umgebung();
  assert.equal(f.liste([{ k: K1, g: 'gross' }, K2]).join(','), K1 + ',' + K2);
});

test('was keine Kennung ist, fliegt raus statt als kaputtes Bild zu erscheinen', () => {
  const { f } = umgebung();
  assert.equal(f.paare(['nein', '', null, { k: 'zu-kurz' }, K1]).length, 1);
  assert.equal(f.paare('kein Array').length, 0);
  assert.equal(f.paare(null).length, 0);
});

test('eine unbekannte Größe fällt auf die Vorgabe zurück, statt die Anzeige zu zerlegen', () => {
  const { f } = umgebung();
  assert.equal(f.groesse('riesig'), f.vorgabe);
  assert.equal(f.groesse(undefined), f.vorgabe);
  f.arten.forEach(g => assert.equal(f.groesse(g), g));
});

test('mehr Bilder als erlaubt werden gekappt', () => {
  const { f } = umgebung();
  const viele = [];
  for (let i = 0; i < f.max + 5; i++) viele.push(K1.slice(0, 30) + String(i).padStart(2, '0'));
  assert.equal(f.paare(viele).length, f.max);
});

/* ═══ Anker: Bilder an Stellen ohne Eintrag ═══ */

test('Anker werden erkannt, eine cid nicht', () => {
  const { f } = umgebung();
  assert.equal(f.istAnker('std:s1'), true);
  assert.equal(f.istAnker('rub:s1|0'), true);
  assert.equal(f.istAnker('uk:s1|0|Lager'), true);
  assert.equal(f.istAnker('seg:s1|0|Vorbereitung'), true);
  assert.equal(f.istAnker('s1|0|0|3'), false, 'eine cid ist kein Anker');
  assert.equal(f.istAnker('new|abc'), false);
});

test('die Ankerschlüssel sind aus ihren Teilen aufgebaut', () => {
  const { f } = umgebung();
  assert.equal(f.ankStd('s1'), 'std:s1');
  assert.equal(f.ankRub('s1', 2), 'rub:s1|2');
  assert.equal(f.ankUk('s1', 2, 'Lager'), 'uk:s1|2|Lager');
  assert.equal(f.ankSeg('s1', 2, 'Nachbereitung'), 'seg:s1|2|Nachbereitung');
});

test('an einem Anker lässt sich ein Bild eintragen, verschieben und entfernen', () => {
  const { f, holen } = umgebung();
  const a = f.ankRub('s1', 0);
  assert.equal(f.eintragen(a, K1, null, 'klein'), true);
  assert.equal(f.eintragen(a, K2, null, 'gross'), true);
  assert.equal(f.ankPaare(a).length, 2);

  f.verschieben(a, K2, -1, null);
  assert.equal(f.ankPaare(a)[0].k, K2, 'K2 steht jetzt vorn');

  f.entfernen(a, K1, null);
  assert.equal(f.ankPaare(a).length, 1);
  assert.equal(holen().ank[a].length, 1, 'der geteilte Speicher wurde geschrieben');
});

test('dasselbe Bild wird an einer Stelle nicht doppelt eingetragen', () => {
  const { f } = umgebung();
  const a = f.ankStd('s1');
  f.eintragen(a, K1, null, 'klein');
  f.eintragen(a, K1, null, 'gross');
  assert.equal(f.ankPaare(a).length, 1);
});

test('ein leer geräumter Anker verschwindet ganz aus dem Speicher', () => {
  const { f, holen } = umgebung();
  const a = f.ankStd('s1');
  f.eintragen(a, K1, null, 'klein');
  f.entfernen(a, K1, null);
  assert.equal(a in holen().ank, false, 'kein leerer Rest, der später aussieht wie Inhalt');
});

test('die Größe eines Bildes lässt sich nachträglich ändern', () => {
  const { f } = umgebung();
  const a = f.ankRub('s1', 1);
  f.eintragen(a, K1, null, 'klein');
  f.eintragen(a, K2, null, 'klein');
  f.groesseSetzen(a, K2, 'gross', null);
  const p = f.ankPaare(a);
  assert.equal(p.find(x => x.k === K1).g, 'klein', 'die anderen bleiben unberührt');
  assert.equal(p.find(x => x.k === K2).g, 'gross');
});

test('Verschieben über den Rand hinaus tut nichts, statt die Liste zu zerstören', () => {
  const { f } = umgebung();
  const a = f.ankStd('s2');
  f.eintragen(a, K1, null, 'klein');
  f.eintragen(a, K2, null, 'klein');
  assert.equal(f.verschieben(a, K1, -1, null), false);
  assert.equal(f.verschieben(a, K2, 1, null), false);
  assert.equal(f.ankPaare(a).map(x => x.k).join(','), K1 + ',' + K2);
});

/* ═══ Angaben zum Bild ═══ */

test('eine reine Bildunterschrift bleibt schlank gespeichert', () => {
  const { f, holen } = umgebung();
  f.textSetzen(K1, 'Kleiner Tisch');
  assert.equal(typeof holen().txt[K1], 'string', 'kein unnötiges Objekt');
  assert.equal(f.satz(K1).t, 'Kleiner Tisch');
  assert.equal(f.satz(K1).d, '');
});

test('kommen Angaben dazu, wird daraus ein Satz — und die Unterschrift bleibt', () => {
  const { f } = umgebung();
  f.textSetzen(K1, 'Kleiner Tisch');
  f.detailSetzen(K1, 'Aufbau von links: Spülung, Manifold, Y-Konnektor.');
  assert.equal(f.satz(K1).t, 'Kleiner Tisch');
  assert.equal(f.satz(K1).d.indexOf('Manifold') > 0, true);
});

test('Altbestand als reiner Text wird gelesen', () => {
  const { f } = umgebung({ hkl_medientexte: { [K1]: 'alte Unterschrift' } });
  assert.equal(f.satz(K1).t, 'alte Unterschrift');
  assert.equal(f.hatDetail(K1), true);
});

test('leert man beide Felder, verschwindet der Eintrag', () => {
  const { f, holen } = umgebung();
  f.textSetzen(K1, 'x'); f.detailSetzen(K1, 'y');
  f.textSetzen(K1, ''); f.detailSetzen(K1, '');
  assert.equal(K1 in holen().txt, false);
  assert.equal(f.hatDetail(K1), false);
});

/* ═══ Anzeige ═══ */

test('jedes Bild trägt data-zoom — antippen macht groß, überall gleich', () => {
  const { f } = umgebung();
  f.textSetzen(K1, 'Titel');
  f.detailSetzen(K1, 'Angaben');
  const h = f.bildHTML({ k: K1, g: 'gross' });
  assert.equal(h.indexOf('data-zoom') > 0, true);
  assert.equal(h.indexOf('data-cap="Titel"') > 0, true);
  assert.equal(h.indexOf('data-det="Angaben"') > 0, true);
  assert.equal(h.indexOf('med-gross') > 0, true);
});

test('kleine Bilder stehen im Streifen, große als eigene Blöcke', () => {
  const { f } = umgebung();
  const h = f.paareHTML([{ k: K1, g: 'klein' }, { k: K2, g: 'gross' }, { k: K3, g: 'klein' }]);
  assert.equal(h.indexOf('med-streifen') >= 0, true);
  assert.equal(h.indexOf('med-bloecke') > 0, true);
  /* Der Streifen steht VOR den Blöcken — sonst zerreißt ein großes Bild die Reihe. */
  assert.equal(h.indexOf('med-streifen') < h.indexOf('med-bloecke'), true);
});

test('ohne Bild und ohne Verwaltung entsteht kein Markup', () => {
  const { f } = umgebung();
  assert.equal(f.paareHTML([]), '');
  assert.equal(f.ankerHTML('rub:s1|0', 'Material'), '', 'keine leere Fläche, die wie ein Fehler aussieht');
});

/* ═══════════════════════════════════════════════════════════════════════════
   Fotos aus dem localStorage heraus (das „5 MB Limit muss beseitigt werden")

   Produkt- und Bestellfotos lagen als base64 im geteilten Zustand und damit im
   localStorage, den der Browser bei ~5 MB deckelt. Jetzt gehen sie denselben
   Weg wie die Eintrags-Bilder: einzeln auf den Server, im Zustand nur die
   Kennung. Damit `/api/media/<kennung>` genau das eben hochgeladene Bild zeigt
   (und dieselben Bytes nie zweimal Platz belegen), MUSS die im Browser
   gebildete Kennung Zeichen für Zeichen der Server-Kennung entsprechen.
   ═══════════════════════════════════════════════════════════════════════════ */

const crypto5 = require('node:crypto');

function umgebung5mb() {
  const ctx = vm.createContext({
    console, Blob, atob, btoa, TextEncoder, TextDecoder, Uint8Array,
    crypto: crypto5.webcrypto,
    loadJSON: () => ({}), saveJSON: () => {},
    esc: (s) => String(s == null ? '' : s),
    window: undefined, indexedDB: undefined, setTimeout: () => {},
  });
  vm.runInContext(SRC + `
    ;globalThis.__m = { url:medUrl, istMedia:medIstMediaUrl,
      kennungAusUrl:medKennungAusUrl, zuBlob:medZuBlob, kennungVon:medKennungVon };
  `, ctx);
  return ctx.__m;
}

/* Die Server-Formel wortgleich aus server/media.js — der Beweis-Gegenpart. */
function serverKennung(buffer) {
  return crypto5.createHash('sha256').update(buffer).digest('hex').slice(0, 32);
}

test('die Client-Kennung ist Zeichen für Zeichen die Server-Kennung', async () => {
  const m = umgebung5mb();
  const bytes = Buffer.from('irgendein Bild-Inhalt äöü  ÿ', 'binary');
  const client = await m.kennungVon(new Blob([bytes]));
  assert.match(client, /^[0-9a-f]{32}$/);
  assert.equal(client, serverKennung(bytes), 'nur bei Gleichheit zeigt /api/media dasselbe Bild');
});

test('gleicher Inhalt ⇒ gleiche Kennung (kein doppelter Platz)', async () => {
  const m = umgebung5mb();
  const a = await m.kennungVon(new Blob([Buffer.from('foto')]));
  const b = await m.kennungVon(new Blob([Buffer.from('foto')]));
  const c = await m.kennungVon(new Blob([Buffer.from('anderes')]));
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('eine base64-data-URL wird ohne Netz zu den richtigen Bytes', async () => {
  const m = umgebung5mb();
  const roh = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x10, 0x20]);
  const dataUrl = 'data:image/jpeg;base64,' + roh.toString('base64');
  const blob = m.zuBlob(dataUrl);
  assert.equal(blob.type, 'image/jpeg');
  assert.equal(blob.size, roh.length);
  assert.equal(await m.kennungVon(blob), serverKennung(roh), 'als hätte der Server die Bytes bekommen');
});

test('ein Blob wird unverändert durchgereicht, Unsinn ergibt null', () => {
  const m = umgebung5mb();
  const b = new Blob([Buffer.from('x')], { type: 'image/png' });
  assert.equal(m.zuBlob(b), b);
  assert.equal(m.zuBlob('https://example/x.jpg'), null);
  assert.equal(m.zuBlob(''), null);
});

test('Media-URLs werden erkannt und ihre Kennung herausgelesen (Offline-Fallback)', () => {
  const m = umgebung5mb();
  const k = 'a'.repeat(32);
  assert.equal(m.url(k), '/api/media/' + k);
  assert.ok(m.istMedia('/api/media/' + k));
  assert.equal(m.istMedia('data:image/png;base64,AAAA'), false);
  assert.equal(m.kennungAusUrl('/api/media/' + k), k);
  assert.equal(m.kennungAusUrl('data:image/png;base64,AAAA'), null);
});

/* ═══════════════════════════════════════════════════════════════════════════
   Der Altbestand zieht nach (medMigriereAltbestand)

   Neue Fotos gehen den richtigen Weg — der Bestand aber liegt weiter als
   base64 im geteilten Zustand und hält den Gerätespeicher besetzt. Für
   Etikett-Scans (GTINDB) und Bestellungen (BEST) gab es den Umzug schon;
   die ANLEITUNGEN fehlten. Genau sie waren der Fall aus dem Saal: eine
   Notfall-Anleitung mit Fotos an jedem Schritt.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Umgebung mit Netz: der Upload gelingt, IndexedDB gibt es nicht (der Spiegel
   ist bewusst best-effort). GUIDES/saveGuides wie in der App. */
function umgebungUmzug(guides) {
  const gespeichert = { n: 0 };
  const ctx = vm.createContext({
    console, Blob, atob, btoa, TextEncoder, TextDecoder, Uint8Array,
    crypto: crypto5.webcrypto,
    fetch: async () => ({ ok: true, json: async () => ({ kennung: 'egal' }) }),
    navigator: { onLine: true },
    loadJSON: () => ({}), saveJSON: () => {},
    esc: (s) => String(s == null ? '' : s),
    GUIDES: guides,
    saveGuides: () => { gespeichert.n++; },
    window: undefined, indexedDB: undefined, setTimeout: () => {},
  });
  vm.runInContext(SRC + `
    ;globalThis.__u = { migriere:medMigriereAltbestand, istMedia:medIstMediaUrl };
  `, ctx);
  return { u: ctx.__u, guides, gespeichert };
}

const FOTO = 'data:image/jpeg;base64,' + Buffer.from('ein Bild').toString('base64');

test('Anleitungsfotos ziehen aus dem Gerätespeicher auf den Server um', async () => {
  const { u, guides, gespeichert } = umgebungUmzug([
    { id: 'g1', titel: 'Einsatzbereitschaft', schritte: [
      { id: 's1', bild: FOTO }, { id: 's2', bild: FOTO }, { id: 's3', text: 'ohne Foto' }] },
  ]);
  const n = await u.migriere();
  assert.equal(n, 2, 'beide Fotos umgezogen');
  assert.ok(u.istMedia(guides[0].schritte[0].bild));
  assert.ok(u.istMedia(guides[0].schritte[1].bild));
  assert.equal(guides[0].schritte[2].bild, undefined, 'ein Schritt ohne Foto bleibt unangetastet');
  assert.ok(gespeichert.n > 0, 'der neue Stand wird gespeichert — sonst war der Umzug umsonst');
  assert.ok(JSON.stringify(guides).indexOf('data:image') < 0);
});

test('der Umzug ist wiederholbar, ohne etwas zweites Mal zu tun', async () => {
  const { u, guides } = umgebungUmzug([
    { id: 'g1', schritte: [{ id: 's1', bild: FOTO }] },
  ]);
  assert.equal(await u.migriere(), 1);
  const nachher = guides[0].schritte[0].bild;
  assert.equal(await u.migriere(), 0, 'nichts mehr zu tun');
  assert.equal(guides[0].schritte[0].bild, nachher, 'die Adresse bleibt dieselbe');
});

test('gleiche Bytes ⇒ gleiche Adresse (ein Foto belegt nicht zweimal Platz)', async () => {
  const { u, guides } = umgebungUmzug([
    { id: 'g1', schritte: [{ id: 's1', bild: FOTO }] },
    { id: 'g2', schritte: [{ id: 's1', bild: FOTO }] },
  ]);
  await u.migriere();
  assert.equal(guides[0].schritte[0].bild, guides[1].schritte[0].bild);
});

test('ohne Netz wird gar nicht erst angefangen', async () => {
  const ctx = vm.createContext({
    console, Blob, atob, btoa, TextEncoder, TextDecoder, Uint8Array,
    crypto: crypto5.webcrypto, navigator: { onLine: false },
    loadJSON: () => ({}), saveJSON: () => {}, esc: (s) => String(s == null ? '' : s),
    GUIDES: [{ id: 'g1', schritte: [{ id: 's1', bild: FOTO }] }],
    saveGuides: () => {}, window: undefined, indexedDB: undefined, setTimeout: () => {},
  });
  vm.runInContext(SRC + ';globalThis.__m = medMigriereAltbestand;', ctx);
  assert.equal(await ctx.__m(), 0);
});

test('kaputte Anleitungen bringen den Umzug nicht zum Absturz', async () => {
  const { u } = umgebungUmzug([null, { id: 'g1' }, { id: 'g2', schritte: null },
    { id: 'g3', schritte: [null, { id: 's1', bild: 123 }, { id: 's2', bild: FOTO }] }]);
  assert.equal(await u.migriere(), 1);
});
