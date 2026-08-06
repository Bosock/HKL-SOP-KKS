'use strict';
/* Tests für „Ankreuzen statt Abtippen" (public/js/features/ankreuzen.js).

   Der Sinn dieses Bausteins ist, dass NICHT getippt wird — und damit, dass
   keine neuen Schreibweisen entstehen. Danach richten sich die Prüfungen:

   ① Die Liste zeigt jedes Material EINMAL, nicht so oft, wie es dasteht.
      Eine Liste mit elf gleichen Zeilen wäre schlimmer als gar keine.
   ② Sie zeigt das Richtige je Rubrik-Sorte: In eine Materialrubrik gehören
      keine Handgriffe und umgekehrt.
   ③ Ein angekreuzter Eintrag ist ein ganz normaler Eintrag — mit demselben
      Namen und damit demselben Materialschlüssel wie sein Vorbild. Genau
      daran hängen Foto, Preis und Maße.
*/

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'public/js/features/ankreuzen.js'), 'utf8');

function bestand() {
  const zeile = (text, mk, natur) => ({ anzeige_text: text, roh_text: text, material_key: mk, natur: natur || 'material' });
  return [
    { id: 's1', titel: 'Koro', rubriken: [
      { typ: 'material', sub_bereiche: [{ eintraege: [
        zeile('Radialschleuse 6F', 'schleuse'),
        zeile('Kompressen steril', 'kompressen'),
      ] }] },
      { typ: 'ablauf', sub_bereiche: [{ eintraege: [
        zeile('Patient lagern', null, 'handgriff'),
        zeile('Time-out durchführen', null, 'handgriff'),
      ] }] },
    ] },
    { id: 's2', titel: 'PCI', rubriken: [
      { typ: 'material', sub_bereiche: [{ eintraege: [
        zeile('Radialschleuse 6 F', 'schleuse-alt'),   /* andere Schreibweise, dasselbe Material */
      ] }] },
      { typ: 'ablauf', sub_bereiche: [{ eintraege: [
        zeile('Time out durchführen', null, 'handgriff'),   /* andere Schreibweise */
      ] }] },
    ] },
  ];
}

function umgebung(opt) {
  const o = opt || {};
  const ADDITIONS = { standards: [], entries: {} };
  const gespeichert = { additions: 0, rebuild: 0, index: 0 };
  const kanon = { schleuse: 'radialschleuse-6f', 'schleuse-alt': 'radialschleuse-6f', kompressen: 'kompressen' };
  const standards = o.standards || bestand();
  const ctx = vm.createContext({
    console,
    esc: (s) => String(s == null ? '' : s),
    $: () => null,
    DB: { standards },
    ADDITIONS,
    CATALOG: { items: o.katalog || [] },
    /* Der Materialbestand kommt aus dem Pflege-Weg — hier nachgestellt, damit
       dieser Test nur EIN Modul prüft. */
    pfMaterialien: () => {
      const map = new Map();
      standards.forEach(s => (s.rubriken || []).forEach((r, ri) => {
        if (r.typ !== 'material' && r.typ !== 'geraete') return;
        (r.sub_bereiche || []).forEach((sb, si) => (sb.eintraege || []).forEach((e, ei) => {
          const k = kanon[e.material_key] || e.material_key; if (!k) return;
          if (!map.has(k)) map.set(k, { key: k, name: e.anzeige_text, rec: null, stellen: [], standards: [] });
          const t = map.get(k);
          t.stellen.push({ cid: [s.id, ri, si, ei].join('|'), e, sid: s.id });
          if (t.standards.indexOf(s.id) < 0) t.standards.push(s.id);
        }));
      }));
      return [...map.values()].map(t => Object.assign(t, { vorkommen: t.stellen.length }));
    },
    cidOf: (sid, ri, si, ei) => [sid, ri, si, ei].join('|'),
    bauSlug: (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    effNatur: (e) => e.natur || 'material',
    canonUk: () => '',
    qeGet: o.qeGet || (() => undefined),
    stdHidden: () => false,
    natOf: (k) => ({ label: k, color: '#888' }),
    newAid: (() => { let n = 0; return () => 'a' + (++n); })(),
    makeAddEntry: (f) => ({ anzeige_text: f.name, roh_text: f.name, natur: f.nat,
      unterkategorie: f.uk || null, menge: f.menge || null,
      material_key: f.name ? f.name.toLowerCase() : null, _added: true, _aid: f.aid }),
    saveAdditions: () => { gespeichert.additions++; },
    rebuildDB: () => { gespeichert.rebuild++; },
    buildMaterialIndex: () => { gespeichert.index++; },
    computeUkList: () => {},
    toast: () => {},
  });
  vm.runInContext(SRC + `
    ;globalThis.__a = {
      sorte: ankSorte, bestand: ankBestand, leeren: ankCacheLeeren,
      einfuegen: ankEinfuegen, finden: ankFinden,
      listeHTML: ankListeHTML, schalten: ankSchalten,
      setzeANK: (v)=>{ ANK = v; }, holANK: ()=>ANK,
      setzeSuche: (v)=>{ ankSuche = v; }, setzeWahl:(v)=>{ ankWahl = v; },
    };
  `, ctx);
  return { a: ctx.__a, ADDITIONS, gespeichert, ctx };
}

/* ═══ ① Jedes Material einmal ═══ */

test('zwei Schreibweisen desselben Materials ergeben EINE Zeile zur Auswahl', () => {
  const { a } = umgebung();
  const liste = a.bestand('material');
  const namen = liste.map(x => x.name);
  assert.equal(liste.length, 2, 'Schleuse und Kompressen — nicht drei Zeilen');
  assert.ok(namen.some(n => /Radialschleuse/.test(n)));
});

test('Handgriffe werden ebenfalls nach Schreibweise zusammengefasst', () => {
  const { a } = umgebung();
  const liste = a.bestand('ablauf');
  assert.equal(liste.length, 2, '„Time-out" und „Time out" sind derselbe Handgriff — zwei Zeilen, nicht drei');
  const timeout = liste.find(x => /Time/.test(x.name));
  assert.equal(timeout.n, 2, 'gezählt werden beide Vorkommen');
  assert.equal(timeout.wo, 2, 'aus zwei Standards');
});

test('sortiert wird nach Häufigkeit — was oft vorkommt, steht oben', () => {
  const { a } = umgebung();
  const liste = a.bestand('material');
  assert.ok(liste[0].n >= liste[liste.length - 1].n);
  assert.equal(liste[0].n, 2, 'die Schleuse steht zweimal im Bestand');
});

/* ═══ ② Das Richtige je Sorte ═══ */

test('Material und Geräte sind EINE Sorte, Ablauf und Sonstiges die andere', () => {
  const { a } = umgebung();
  assert.equal(a.sorte('material'), 'material');
  assert.equal(a.sorte('geraete'), 'material');
  assert.equal(a.sorte('ablauf'), 'ablauf');
  assert.equal(a.sorte('sonstige'), 'ablauf');
});

test('in der Materialliste stehen keine Handgriffe und umgekehrt', () => {
  const { a } = umgebung();
  const mat = a.bestand('material').map(x => x.name).join(' | ');
  const abl = a.bestand('ablauf').map(x => x.name).join(' | ');
  assert.ok(mat.indexOf('lagern') < 0);
  assert.ok(abl.indexOf('Kompressen') < 0);
  assert.ok(abl.indexOf('lagern') >= 0);
});

test('Katalog-Positionen kommen dazu — aber nur, wenn es sie im Bestand nicht gibt', () => {
  const { a } = umgebung({ katalog: [
    { id: 'k1', name: 'Druckverband', nat: 'material' },
    { id: 'k2', name: 'Kompressen steril', nat: 'material' },   /* steht schon im Bestand */
  ] });
  const liste = a.bestand('material');
  const namen = liste.map(x => x.name);
  assert.ok(namen.indexOf('Druckverband') >= 0);
  assert.equal(namen.filter(n => n === 'Kompressen steril').length, 1, 'keine Dublette aus dem Katalog');
  assert.equal(liste.find(x => x.name === 'Druckverband').quelle, 'katalog');
});

test('ausgeblendete Zeilen stehen nicht zur Auswahl', () => {
  const { a } = umgebung({ qeGet: (e, cid, prop) => (prop === 'hidden' && /lagern/.test(e.anzeige_text)) ? true : undefined });
  const abl = a.bestand('ablauf').map(x => x.name).join(' | ');
  assert.ok(abl.indexOf('lagern') < 0, 'was ausgeblendet ist, will niemand neu einfügen');
});

/* ═══ ③ Einfügen ist ein ganz normaler Eintrag ═══ */

test('angekreuzt entsteht ein eigener Eintrag mit demselben Namen wie das Vorbild', () => {
  const { a, ADDITIONS, gespeichert } = umgebung();
  a.setzeANK({ sid: 's3', ri: 0, sorte: 'material', rname: 'Material' });
  const key = a.bestand('material').find(x => /Radialschleuse/.test(x.name)).key;
  const n = a.einfuegen('s3', 0, [key]);
  assert.equal(n, 1);
  const arr = ADDITIONS.entries['s3|0'];
  assert.equal(arr.length, 1);
  assert.match(arr[0].anzeige_text, /Radialschleuse/);
  assert.equal(arr[0]._added, true);
  assert.ok(gespeichert.additions > 0 && gespeichert.rebuild > 0, 'gespeichert und neu aufgebaut');
});

test('der Materialschlüssel entsteht aus dem Namen — daran hängen Foto und Preis', () => {
  const { a, ADDITIONS } = umgebung();
  a.setzeANK({ sid: 's3', ri: 0, sorte: 'material', rname: 'Material' });
  const it = a.bestand('material').find(x => x.name === 'Kompressen steril');
  a.einfuegen('s3', 0, [it.key]);
  assert.equal(ADDITIONS.entries['s3|0'][0].material_key, 'kompressen steril');
});

test('mehrere Häkchen fügen mehrere Einträge in EINEM Vorgang ein', () => {
  const { a, ADDITIONS, gespeichert } = umgebung();
  a.setzeANK({ sid: 's3', ri: 0, sorte: 'material', rname: 'Material' });
  const keys = a.bestand('material').map(x => x.key);
  const n = a.einfuegen('s3', 0, keys);
  assert.equal(n, 2);
  assert.equal(ADDITIONS.entries['s3|0'].length, 2);
  assert.equal(gespeichert.additions, 1, 'einmal gespeichert, nicht je Zeile');
});

test('ein unbekannter Schlüssel wird still übergangen, der Rest kommt an', () => {
  const { a, ADDITIONS } = umgebung();
  a.setzeANK({ sid: 's3', ri: 0, sorte: 'material', rname: 'Material' });
  const gut = a.bestand('material')[0].key;
  const n = a.einfuegen('s3', 0, ['gibtsnicht', gut]);
  assert.equal(n, 1);
  assert.equal(ADDITIONS.entries['s3|0'].length, 1);
});

test('ohne Häkchen passiert nichts — kein leerer Eintrag, kein Speichern', () => {
  const { a, ADDITIONS, gespeichert } = umgebung();
  a.setzeANK({ sid: 's3', ri: 0, sorte: 'material', rname: 'Material' });
  assert.equal(a.einfuegen('s3', 0, []), 0);
  assert.equal(ADDITIONS.entries['s3|0'], undefined);
  assert.equal(gespeichert.additions, 0);
});

/* ═══ Die Liste selbst ═══ */

test('die Suche filtert, und Angekreuztes bleibt trotzdem sichtbar', () => {
  const { a } = umgebung();
  a.setzeANK({ sid: 's3', ri: 0, sorte: 'material', rname: 'Material' });
  const kompressen = a.bestand('material').find(x => x.name === 'Kompressen steril');
  a.setzeWahl({ [kompressen.key]: true });
  a.setzeSuche('schleuse');
  const html = a.listeHTML();
  assert.ok(html.indexOf('Radialschleuse') >= 0, 'der Treffer steht da');
  assert.ok(html.indexOf('Kompressen') >= 0, 'das Angekreuzte auch — sonst glaubt man, es sei weg');
  assert.ok(html.indexOf('Bereits angekreuzt') >= 0);
});

test('eine Suche ohne Treffer erklärt den Ausweg, statt leer zu bleiben', () => {
  const { a } = umgebung();
  a.setzeANK({ sid: 's3', ri: 0, sorte: 'material', rname: 'Material' });
  a.setzeWahl({});
  a.setzeSuche('gibtesnicht');
  assert.match(a.listeHTML(), /Eintrag hinzufügen/);
});

test('der Cache fällt, wenn er geleert wird — sonst zeigte die Liste Zahlen von gestern', () => {
  const { a, ctx } = umgebung();
  assert.equal(a.bestand('material').length, 2);
  ctx.DB.standards[0].rubriken[0].sub_bereiche[0].eintraege.push(
    { anzeige_text: 'Neues Ding', roh_text: 'Neues Ding', material_key: 'neu', natur: 'material' });
  assert.equal(a.bestand('material').length, 2, 'gecacht — noch der alte Stand');
  a.leeren();
  assert.equal(a.bestand('material').length, 3);
});
