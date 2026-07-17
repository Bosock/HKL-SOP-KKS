'use strict';
/* Tests for the pure helper functions in the client modules (public/js/).

   Rather than duplicate their bodies (which would drift), we extract the
   actual source of each function from the module files and evaluate it in a
   vm sandbox with the few globals it needs. If someone edits a helper, these
   tests exercise the edited code. Only genuinely pure helpers (no DOM / no
   localStorage) are covered here.

   The module list is read from public/index.html's <script src> tags, so the
   test also fails loudly if a referenced module file is missing. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PUBLIC = path.join(__dirname, '..', 'public');
const SHELL = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
const MODULES = [...SHELL.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map(m => m[1]);
assert.ok(MODULES.length > 0, 'no <script src="js/…"> tags found in public/index.html');
const SRC = MODULES.map(rel => fs.readFileSync(path.join(PUBLIC, rel), 'utf8')).join('\n');

// Grab a `function NAME(...) { ... }` definition by balancing braces.
function extractFn(name) {
  const sig = SRC.indexOf('function ' + name + '(');
  assert.notEqual(sig, -1, `function ${name} not found in public/js modules`);
  let i = SRC.indexOf('{', sig);
  let depth = 0;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') depth++;
    else if (SRC[j] === '}') { depth--; if (depth === 0) return SRC.slice(sig, j + 1); }
  }
  throw new Error(`unbalanced braces extracting ${name}`);
}

// Grab a `const NAME = ...;` single-line arrow/expression declaration.
function extractConst(name) {
  const re = new RegExp('const ' + name + '\\s*=.*', '');
  const m = SRC.match(re);
  assert.ok(m, `const ${name} not found in public/js modules`);
  return m[0];
}

// Build a sandbox and expose the requested helpers from it.
function loadHelpers() {
  const NATCFG = {
    order: ['blut', 'geraet'],
    items: {
      blut: { key: 'blut', label: 'Blut', color: '#c00', icon: '🩸', beschaffbar: true, builtin: true },
      geraet: { key: 'geraet', label: 'Gerät', color: '#0c0', icon: '🖥', beschaffbar: false, builtin: true },
    },
  };
  const ctx = { NATCFG, UK_PALETTE: ['#111', '#222', '#333'], Date, JSON, Math };
  vm.createContext(ctx);
  const src = [
    extractConst('esc'),
    extractConst('today'),
    extractConst('cidOf'),
    extractFn('sizeLabel'),
    extractFn('typLabel'),
    extractFn('rubrikIcon'),
    extractFn('ukKeywordIcon'),
    extractFn('natSlug'),
    extractFn('natOf'),
    extractFn('natList'),
    extractFn('addSlug'),
    extractFn('parseSyn'),
    extractFn('filterGlossary'),
    extractFn('voteTally'),
    extractFn('makeAddEntry'),
    extractFn('mergeAdditions'),
    extractFn('makeCatalogItem'),
    extractFn('catalogToForm'),
    extractFn('upsertCatalogItem'),
    extractFn('removeCatalogItem'),
    extractFn('buildCatalogFromStandards'),
    extractFn('canonCatalogName'),
    extractFn('findCatalogDuplicateGroups'),
    extractFn('mergeCatalogGroup'),
    extractFn('mergeCatalogDuplicates'),
    extractFn('parsePreis'),
    extractFn('fmtEUR'),
    extractFn('mengeNum'),
    extractFn('parseGS1'),
    extractFn('formatGs1Date'),
    extractFn('gtinKey'),
    extractFn('expiryStatus'),
    extractFn('parseScan'),
    extractFn('mergeGtinRecord'),
    extractFn('filterGtin'),
    extractFn('gtinGroups'),
    extractFn('gtinBadges'),
    extractFn('rubTplMatches'),
    extractFn('hexToRgb'),
    extractFn('_lin'),
    extractFn('relLuminance'),
    extractFn('contrastRatio'),
    extractFn('pickTextColor'),
  ].join('\n');
  const exportExpr = '({esc, today, cidOf, sizeLabel, typLabel, rubrikIcon, ukKeywordIcon, natSlug, natOf, natList, addSlug, parseSyn, filterGlossary, voteTally, makeAddEntry, mergeAdditions, makeCatalogItem, catalogToForm, upsertCatalogItem, removeCatalogItem, buildCatalogFromStandards, canonCatalogName, findCatalogDuplicateGroups, mergeCatalogGroup, mergeCatalogDuplicates, parsePreis, fmtEUR, mengeNum, parseGS1, formatGs1Date, gtinKey, expiryStatus, parseScan, mergeGtinRecord, filterGtin, gtinGroups, gtinBadges, rubTplMatches, hexToRgb, relLuminance, contrastRatio, pickTextColor})';
  const fns = vm.runInContext(src + '\n' + exportExpr, ctx);
  return { fns, NATCFG };
}

const { fns } = loadHelpers();

// --- esc --------------------------------------------------------------------
test('esc: escapes HTML metacharacters', () => {
  assert.equal(fns.esc('<a>&"'), '&lt;a&gt;&amp;&quot;');
});
test("esc: escapes apostrophes (root fix for the onclick class of bugs)", () => {
  // Ein ' in Namen (O'Brien-Schrank, L'Apostroph) zerbrach früher inline
  // interpolierte '…'-Literale still — jetzt an der Wurzel entschärft.
  assert.equal(fns.esc("O'Brien"), 'O&#39;Brien');
  assert.equal(fns.esc("a'b'c"), 'a&#39;b&#39;c');
});
test('esc: null/undefined become empty string', () => {
  assert.equal(fns.esc(null), '');
  assert.equal(fns.esc(undefined), '');
});
test('esc: coerces non-strings', () => {
  assert.equal(fns.esc(42), '42');
});
test('esc: plain text is unchanged', () => {
  assert.equal(fns.esc('Radialschleuse'), 'Radialschleuse');
});

// --- today ------------------------------------------------------------------
test('today: returns ISO yyyy-mm-dd', () => {
  assert.match(fns.today(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(fns.today(), new Date().toISOString().slice(0, 10));
});

// --- cidOf ------------------------------------------------------------------
test('cidOf: joins ids with pipe', () => {
  assert.equal(fns.cidOf('std', 1, 2, 3), 'std|1|2|3');
  assert.equal(fns.cidOf('a', 0, 0, 0), 'a|0|0|0');
});

// --- sizeLabel --------------------------------------------------------------
test('sizeLabel: known types map to short labels', () => {
  assert.equal(fns.sizeLabel('french'), 'Fr');
  assert.equal(fns.sizeLabel('durchmesser'), 'Ø');
  assert.equal(fns.sizeLabel('durchmesser+french'), 'Ø·Fr');
  assert.equal(fns.sizeLabel('naht'), 'Stärke');
});
test('sizeLabel: unknown type falls through to itself', () => {
  assert.equal(fns.sizeLabel('whatever'), 'whatever');
});
test('sizeLabel: empty/undefined returns empty string', () => {
  assert.equal(fns.sizeLabel(), '');
  assert.equal(fns.sizeLabel(''), '');
});

// --- typLabel ---------------------------------------------------------------
test('typLabel: maps the three known types', () => {
  assert.equal(fns.typLabel('material'), 'Material');
  assert.equal(fns.typLabel('geraete'), 'Geräte');
  assert.equal(fns.typLabel('ablauf'), 'Ablauf');
  assert.equal(fns.typLabel('anything-else'), 'Ablauf');
});

// --- rubrikIcon -------------------------------------------------------------
test('rubrikIcon: name keywords win over type', () => {
  assert.equal(fns.rubrikIcon('OP-Saal'), '🖥');
  assert.equal(fns.rubrikIcon('Notfallkoffer'), '🧰');
  assert.equal(fns.rubrikIcon('Materialien'), '📦');
  assert.equal(fns.rubrikIcon('Patiententisch'), '🫀'); // 'patient' before 'tisch'
  assert.equal(fns.rubrikIcon('Ablauf'), '📋');
  assert.equal(fns.rubrikIcon('Abschließende Kontrolle'), '✔');
});
test('rubrikIcon: falls back to type when name has no keyword', () => {
  assert.equal(fns.rubrikIcon('Foo', 'material'), '📦');
  assert.equal(fns.rubrikIcon('Foo', 'geraete'), '🖥');
});
test('rubrikIcon: default document icon', () => {
  assert.equal(fns.rubrikIcon('Foo'), '📄');
  assert.equal(fns.rubrikIcon(null), '📄');
});

// --- ukKeywordIcon ----------------------------------------------------------
test('ukKeywordIcon: keyword mapping', () => {
  assert.equal(fns.ukKeywordIcon('Lager'), '📦');
  assert.equal(fns.ukKeywordIcon('Notfall'), '🚨');
  assert.equal(fns.ukKeywordIcon('Zugang'), '🩸');
});
test('ukKeywordIcon: more specific vorbereitungsraum beats generic raum', () => {
  assert.equal(fns.ukKeywordIcon('Vorbereitungsraum'), '🧰');
  assert.equal(fns.ukKeywordIcon('Nebenraum'), '🚪');
});
test('ukKeywordIcon: default folder icon', () => {
  assert.equal(fns.ukKeywordIcon('Sonstiges'), '🗂');
  assert.equal(fns.ukKeywordIcon(null), '🗂');
});

// --- natSlug ----------------------------------------------------------------
test('natSlug: slugifies to lowercase underscore form', () => {
  assert.equal(fns.natSlug('Blut Neu'), 'blut_neu');
  assert.equal(fns.natSlug('  Fancy-Name!!  '), 'fancy_name');
});
test('natSlug: collision with existing key gets numeric suffix', () => {
  // NATCFG.items already contains 'blut'.
  assert.equal(fns.natSlug('Blut'), 'blut_2');
});
test('natSlug: non-alphanumeric input falls back to "kat"', () => {
  assert.equal(fns.natSlug('!!!'), 'kat');
  assert.equal(fns.natSlug(''), 'kat');
  assert.equal(fns.natSlug(null), 'kat');
});

// --- natOf ------------------------------------------------------------------
test('natOf: returns the configured item', () => {
  assert.equal(fns.natOf('blut').label, 'Blut');
  assert.equal(fns.natOf('blut').icon, '🩸');
});
test('natOf: unknown key returns a safe default', () => {
  const d = fns.natOf('missing');
  assert.equal(d.key, 'missing');
  assert.equal(d.label, 'missing');
  assert.equal(d.color, '#7f95ab');
  assert.equal(d.beschaffbar, false);
});

// --- natList ----------------------------------------------------------------
test('natList: returns items in order with keys merged in', () => {
  const list = fns.natList();
  assert.equal(list.length, 2);
  assert.deepEqual(list.map(x => x.key), ['blut', 'geraet']);
  assert.equal(list[0].label, 'Blut');
});

// --- addSlug ----------------------------------------------------------------
test('addSlug: slugifies to lowercase underscore form', () => {
  assert.equal(fns.addSlug('Koronarangiografie', {}), 'koronarangiografie');
  assert.equal(fns.addSlug('  My Std!!  ', {}), 'my_std');
});
test('addSlug: numeric suffix on collision (object of taken ids)', () => {
  assert.equal(fns.addSlug('foo', { foo: 1 }), 'foo_2');
  assert.equal(fns.addSlug('foo', { foo: 1, foo_2: 1 }), 'foo_3');
});
test('addSlug: accepts a Set of taken ids', () => {
  assert.equal(fns.addSlug('foo', new Set(['foo'])), 'foo_2');
});
test('addSlug: empty / non-alphanumeric falls back to "std"', () => {
  assert.equal(fns.addSlug('', {}), 'std');
  assert.equal(fns.addSlug('!!!', {}), 'std');
  assert.equal(fns.addSlug(null, {}), 'std');
});

// --- makeAddEntry -----------------------------------------------------------
test('makeAddEntry: builds a normalized entry with trimmed fields', () => {
  const e = fns.makeAddEntry({
    name: '  Radialschleuse ', menge: '2x', nat: 'material',
    sizeTyp: 'french', sizeVal: '6F', uk: 'Material auf Ansage', aid: 'a1',
  });
  assert.equal(e.roh_text, 'Radialschleuse');
  assert.equal(e.anzeige_text, 'Radialschleuse');
  assert.equal(e.menge, '2x');
  assert.equal(e.menge_zahl, 2);
  assert.equal(e.natur, 'material');
  assert.equal(e.unterkategorie, 'Material auf Ansage');
  // Cross-realm (vm sandbox) objects: compare by JSON, not reference-strict deepEqual.
  assert.equal(JSON.stringify(e.groessen), JSON.stringify([{ typ: 'french', wert: '6F', roh: '6F' }]));
  assert.equal(e.material_key, 'radialschleuse');
  assert.equal(e._added, true);
  assert.equal(e._aid, 'a1');
  assert.equal(e.ist_fliesstext, false);
});
test('makeAddEntry: no menge / no size yields nulls and empty groessen', () => {
  const e = fns.makeAddEntry({ name: 'Coro-J-Draht', nat: 'geraet', aid: 'a2' });
  assert.equal(e.menge, null);
  assert.equal(e.menge_zahl, null);
  assert.equal(e.groessen.length, 0);
  assert.equal(e.unterkategorie, null);
  assert.equal(e.spezifikation, null);
  assert.equal(e.why, null);
  assert.equal(e.synonyms, null);
});
test('makeAddEntry: carries why text and parsed synonyms', () => {
  const e = fns.makeAddEntry({ name: 'Schleuse', why: '  weil femoral  ', synonyms: 'Introducer, Sheath ; Schleuse', aid: 'a5' });
  assert.equal(e.why, 'weil femoral');
  assert.equal(JSON.stringify(e.synonyms), JSON.stringify(['Introducer', 'Sheath', 'Schleuse']));
});

// --- parseSyn --------------------------------------------------------------
// Cross-realm (vm sandbox) arrays aren't reference-equal to host arrays, so
// compare by JSON like the makeAddEntry tests above.
const J = (v) => JSON.stringify(v);
test('parseSyn: splits on comma/semicolon and trims, dropping empties', () => {
  assert.equal(J(fns.parseSyn('a, b ;c,, ; d')), J(['a', 'b', 'c', 'd']));
});
test('parseSyn: empty / whitespace yields empty array', () => {
  assert.equal(J(fns.parseSyn('   ')), '[]');
  assert.equal(J(fns.parseSyn('')), '[]');
  assert.equal(J(fns.parseSyn(null)), '[]');
});
test('parseSyn: passes through an existing array (trim + drop empties)', () => {
  assert.equal(J(fns.parseSyn([' x ', '', 'y'])), J(['x', 'y']));
});

// --- filterGlossary ---------------------------------------------------------
const GLOS = [
  { id: '1', term: 'CS', def: 'Coronarsinus' },
  { id: '2', term: 'ACT', def: 'Activated Clotting Time' },
  { id: '3', term: 'RCA', def: 'rechte Koronararterie' },
];
test('filterGlossary: empty query returns all, alphabetically by term', () => {
  const r = fns.filterGlossary(GLOS, '');
  assert.equal(J(r.map(g => g.term)), J(['ACT', 'CS', 'RCA']));
});
test('filterGlossary: matches term or definition, case-insensitively', () => {
  assert.equal(J(fns.filterGlossary(GLOS, 'cs').map(g => g.term)), J(['CS']));
  assert.equal(J(fns.filterGlossary(GLOS, 'koronar').map(g => g.term)), J(['RCA']));
});
test('filterGlossary: no match yields empty array; tolerates null list', () => {
  assert.equal(fns.filterGlossary(GLOS, 'zzz').length, 0);
  assert.equal(fns.filterGlossary(null, 'x').length, 0);
});

// --- voteTally --------------------------------------------------------------
test('voteTally: counts up/down votes, ignoring zero/absent', () => {
  assert.equal(J(fns.voteTally({ a: 1, b: 1, c: -1, d: 0 })), J({ up: 2, down: 1 }));
});
test('voteTally: empty / null votes yield zeroes', () => {
  assert.equal(J(fns.voteTally({})), J({ up: 0, down: 0 }));
  assert.equal(J(fns.voteTally(null)), J({ up: 0, down: 0 }));
});
test('makeAddEntry: defaults natur to material and size typ to dimension', () => {
  const e = fns.makeAddEntry({ name: 'Ding', sizeVal: '10', aid: 'a3' });
  assert.equal(e.natur, 'material');
  assert.equal(JSON.stringify(e.groessen), JSON.stringify([{ typ: 'dimension', wert: '10', roh: '10' }]));
});
test('makeAddEntry: empty name gives null material_key', () => {
  const e = fns.makeAddEntry({ name: '   ', aid: 'a4' });
  assert.equal(e.material_key, null);
});

// --- mergeAdditions ---------------------------------------------------------
test('mergeAdditions: appends added standards after base standards', () => {
  const base = { export_datum: null, standards: [{ id: 's1', titel: 'Base', rubriken: [] }] };
  const add = { standards: [{ id: 'x1', titel: 'Mine', rubriken: [] }], entries: {} };
  const out = fns.mergeAdditions(base, add);
  assert.equal(out.standards.length, 2);
  assert.deepEqual(out.standards.map(s => s.id), ['s1', 'x1']);
  assert.equal(out.export_datum, null); // base top-level fields preserved
});
test('mergeAdditions: injects entries into the target rubrik as an extra sub_bereich', () => {
  const base = { standards: [{ id: 's1', titel: 'B', rubriken: [
    { name: 'Material', typ: 'material', sub_bereiche: [{ name: null, eintraege: [{ roh_text: 'orig' }] }] },
  ] }] };
  const add = { standards: [], entries: { 's1|0': [{ roh_text: 'neu', _added: true, _aid: 'a1' }] } };
  const out = fns.mergeAdditions(base, add);
  const rub = out.standards[0].rubriken[0];
  assert.equal(rub.sub_bereiche.length, 2);
  assert.equal(rub.sub_bereiche[1]._added, true);
  assert.equal(JSON.stringify(rub.sub_bereiche[1].eintraege), JSON.stringify([{ roh_text: 'neu', _added: true, _aid: 'a1' }]));
  // Original sub_bereich untouched.
  assert.equal(JSON.stringify(rub.sub_bereiche[0].eintraege), JSON.stringify([{ roh_text: 'orig' }]));
});
test('mergeAdditions: standards without additions are passed through by reference', () => {
  const std = { id: 's1', titel: 'B', rubriken: [] };
  const base = { standards: [std] };
  const out = fns.mergeAdditions(base, { standards: [], entries: {} });
  assert.equal(out.standards[0], std); // no needless clone
});
test('mergeAdditions: does not mutate base or add', () => {
  const base = { standards: [{ id: 's1', rubriken: [{ name: 'M', sub_bereiche: [] }] }] };
  const add = { standards: [], entries: { 's1|0': [{ roh_text: 'neu' }] } };
  fns.mergeAdditions(base, add);
  assert.equal(base.standards[0].rubriken[0].sub_bereiche.length, 0);
});

// --- makeCatalogItem --------------------------------------------------------
test('makeCatalogItem: normalizes and trims fields', () => {
  const it = fns.makeCatalogItem({
    id: 'c1', name: '  Radialschleuse ', nat: 'material', menge: ' 2x ',
    sizeTyp: 'french', sizeVal: ' 6F ', uk: ' Material auf Ansage ',
  });
  assert.equal(it.id, 'c1');
  assert.equal(it.name, 'Radialschleuse');
  assert.equal(it.nat, 'material');
  assert.equal(it.menge, '2x');
  assert.equal(it.sizeTyp, 'french');
  assert.equal(it.sizeVal, '6F');
  assert.equal(it.uk, 'Material auf Ansage');
});
test('makeCatalogItem: empty optionals become null; defaults applied', () => {
  const it = fns.makeCatalogItem({ id: 'c2', name: 'Programmer' });
  assert.equal(it.nat, 'material'); // default
  assert.equal(it.menge, null);
  assert.equal(it.sizeTyp, null);
  assert.equal(it.sizeVal, null);
  assert.equal(it.uk, null);
});
test('makeCatalogItem: size value without typ defaults typ to dimension', () => {
  const it = fns.makeCatalogItem({ id: 'c3', name: 'Ding', sizeVal: '10' });
  assert.equal(it.sizeTyp, 'dimension');
  assert.equal(it.sizeVal, '10');
});
test('makeCatalogItem: size typ is dropped when there is no value', () => {
  const it = fns.makeCatalogItem({ id: 'c4', name: 'Ding', sizeTyp: 'french', sizeVal: '   ' });
  assert.equal(it.sizeVal, null);
  assert.equal(it.sizeTyp, null);
});

// --- catalogToForm ----------------------------------------------------------
test('catalogToForm: maps a catalog item to a form object', () => {
  const f = fns.catalogToForm({ id: 'c1', name: 'X', nat: 'geraet', menge: '1x', sizeTyp: 'laenge', sizeVal: '5cm', uk: 'Lager' });
  // Cross-realm (vm sandbox) objects: compare by JSON, not reference-strict deepEqual.
  assert.equal(JSON.stringify(f), JSON.stringify({ name: 'X', menge: '1x', nat: 'geraet', sizeTyp: 'laenge', sizeVal: '5cm', uk: 'Lager' }));
});
test('catalogToForm: null fields become empty strings and nat defaults', () => {
  const f = fns.catalogToForm({ id: 'c2', name: 'Y', nat: null, menge: null, sizeTyp: null, sizeVal: null, uk: null });
  assert.equal(JSON.stringify(f), JSON.stringify({ name: 'Y', menge: '', nat: 'material', sizeTyp: '', sizeVal: '', uk: '' }));
});
test('catalogToForm output feeds makeAddEntry (adoption path)', () => {
  const item = fns.makeCatalogItem({ id: 'c1', name: 'Radialschleuse', nat: 'material', menge: '2x', sizeTyp: 'french', sizeVal: '6F', uk: 'Ansage' });
  const e = fns.makeAddEntry(Object.assign(fns.catalogToForm(item), { aid: 'a9' }));
  assert.equal(e.anzeige_text, 'Radialschleuse');
  assert.equal(e.menge, '2x');
  assert.equal(e.natur, 'material');
  assert.equal(e.unterkategorie, 'Ansage');
  assert.equal(e._aid, 'a9');
  assert.equal(JSON.stringify(e.groessen), JSON.stringify([{ typ: 'french', wert: '6F', roh: '6F' }]));
});

// --- upsertCatalogItem ------------------------------------------------------
test('upsertCatalogItem: appends a new item', () => {
  const out = fns.upsertCatalogItem([{ id: 'a' }], { id: 'b', name: 'B' });
  assert.deepEqual(out.map(x => x.id), ['a', 'b']);
});
test('upsertCatalogItem: replaces item with matching id in place', () => {
  const out = fns.upsertCatalogItem([{ id: 'a', name: 'old' }, { id: 'b' }], { id: 'a', name: 'new' });
  assert.equal(out.length, 2);
  assert.equal(out[0].name, 'new');
  assert.equal(out[1].id, 'b');
});
test('upsertCatalogItem: does not mutate the input array', () => {
  const input = [{ id: 'a' }];
  const out = fns.upsertCatalogItem(input, { id: 'b' });
  assert.equal(input.length, 1);
  assert.notEqual(out, input);
});
test('upsertCatalogItem: tolerates null/undefined items list', () => {
  const out = fns.upsertCatalogItem(null, { id: 'a' });
  assert.deepEqual(Array.from(out, x => x.id), ['a']);
});

// --- removeCatalogItem ------------------------------------------------------
test('removeCatalogItem: drops the matching id', () => {
  const out = fns.removeCatalogItem([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 'b');
  assert.deepEqual(out.map(x => x.id), ['a', 'c']);
});
test('removeCatalogItem: no match leaves the list unchanged (new array)', () => {
  const input = [{ id: 'a' }];
  const out = fns.removeCatalogItem(input, 'zzz');
  assert.deepEqual(out.map(x => x.id), ['a']);
  assert.notEqual(out, input);
});
test('removeCatalogItem: tolerates null/undefined items list', () => {
  assert.deepEqual(Array.from(fns.removeCatalogItem(null, 'a')), []);
});

// --- buildCatalogFromStandards ---------------------------------------------
const isBeschaffbar = nat => nat === 'material' || nat === 'geraet';
// Deterministic id generator so assertions are stable.
function seqId() { let n = 0; return () => 'g' + (++n); }

test('buildCatalogFromStandards: extracts procurable geraete/material entries', () => {
  const std = { id: 's1', rubriken: [
    { name: 'Saal und Geräte', typ: 'geraete', sub_bereiche: [{ name: null, eintraege: [
      { anzeige_text: 'Programmer', natur: 'geraet', material_key: 'programmer', groessen: [] },
    ] }] },
    { name: 'Materialien', typ: 'material', sub_bereiche: [{ name: null, eintraege: [
      { anzeige_text: 'Radialschleuse', natur: 'material', material_key: 'radialschleuse',
        groessen: [{ typ: 'french', wert: '6F', roh: '6F' }] },
    ] }] },
  ] };
  const out = fns.buildCatalogFromStandards([std], [], seqId(), isBeschaffbar);
  assert.equal(out.length, 2);
  assert.equal(JSON.stringify(out.map(x => x.name).sort()), JSON.stringify(['Programmer', 'Radialschleuse']));
  const rs = out.find(x => x.name === 'Radialschleuse');
  assert.equal(rs.nat, 'material');
  assert.equal(rs.sizeTyp, 'french');
  assert.equal(rs.sizeVal, '6F');
  assert.equal(rs.menge, null);
  assert.equal(rs.uk, null);
  const pr = out.find(x => x.name === 'Programmer');
  assert.equal(pr.sizeTyp, null);
  assert.equal(pr.sizeVal, null);
});

test('buildCatalogFromStandards: dedupes across standards by nat|material_key', () => {
  const mk = (id, size) => ({ id, rubriken: [{ name: 'M', typ: 'material', sub_bereiche: [{ name: null,
    eintraege: [{ anzeige_text: 'Radialschleuse', natur: 'material', material_key: 'radialschleuse',
      groessen: size ? [{ typ: 'french', wert: size, roh: size }] : [] }] }] }] });
  const out = fns.buildCatalogFromStandards([mk('s1', '6F'), mk('s2', '5F')], [], seqId(), isBeschaffbar);
  assert.equal(out.length, 1);
  assert.equal(out[0].sizeVal, '6F'); // first-seen size wins
});

test('buildCatalogFromStandards: skips headings, fliesstext and non-procurable natures', () => {
  const std = { id: 's1', rubriken: [{ name: 'M', typ: 'material', sub_bereiche: [{ name: null, eintraege: [
    { anzeige_text: 'Material auf Ansage', natur: 'ueberschrift', material_key: null },
    { anzeige_text: 'Hinweistext', natur: 'material', material_key: 'hinweistext', ist_fliesstext: true },
    { anzeige_text: 'Amp. Heparin', natur: 'medikament', material_key: 'amp. heparin' },
    { anzeige_text: 'Schleuse', natur: 'material', material_key: 'schleuse', groessen: [] },
  ] }] }] };
  const out = fns.buildCatalogFromStandards([std], [], seqId(), isBeschaffbar);
  assert.equal(JSON.stringify(out.map(x => x.name)), JSON.stringify(['Schleuse']));
});

test('buildCatalogFromStandards: ignores non material/geraete rubriken', () => {
  const std = { id: 's1', rubriken: [{ name: 'Ablauf', typ: 'ablauf', sub_bereiche: [{ name: null,
    eintraege: [{ anzeige_text: 'Schritt 1', natur: 'material', material_key: 'schritt-1' }] }] }] };
  const out = fns.buildCatalogFromStandards([std], [], seqId(), isBeschaffbar);
  assert.equal(out.length, 0);
});

test('buildCatalogFromStandards: skips entries already in the catalog (same nat+name)', () => {
  const std = { id: 's1', rubriken: [{ name: 'M', typ: 'material', sub_bereiche: [{ name: null, eintraege: [
    { anzeige_text: 'Radialschleuse', natur: 'material', material_key: 'radialschleuse', groessen: [] },
    { anzeige_text: 'Neuer Draht', natur: 'material', material_key: 'neuer-draht', groessen: [] },
  ] }] }] };
  const existing = [{ id: 'c1', name: 'radialschleuse', nat: 'material' }]; // case-insensitive match
  const out = fns.buildCatalogFromStandards([std], existing, seqId(), isBeschaffbar);
  assert.equal(JSON.stringify(out.map(x => x.name)), JSON.stringify(['Neuer Draht']));
});

test('buildCatalogFromStandards: same name under different nat are distinct', () => {
  const std = { id: 's1', rubriken: [
    { name: 'G', typ: 'geraete', sub_bereiche: [{ name: null, eintraege: [
      { anzeige_text: 'Ultraschall', natur: 'geraet', material_key: 'ultraschall', groessen: [] }] }] },
    { name: 'M', typ: 'material', sub_bereiche: [{ name: null, eintraege: [
      { anzeige_text: 'Ultraschall', natur: 'material', material_key: 'ultraschall', groessen: [] }] }] },
  ] };
  const out = fns.buildCatalogFromStandards([std], [], seqId(), isBeschaffbar);
  assert.equal(out.length, 2);
  assert.equal(JSON.stringify(out.map(x => x.nat).sort()), JSON.stringify(['geraet', 'material']));
});

test('buildCatalogFromStandards: output feeds catalogToForm without loss', () => {
  const std = { id: 's1', rubriken: [{ name: 'M', typ: 'material', sub_bereiche: [{ name: null, eintraege: [
    { anzeige_text: 'Radialschleuse', natur: 'material', material_key: 'radialschleuse',
      groessen: [{ typ: 'french', wert: '6F', roh: '6F' }] }] }] }] };
  const [it] = fns.buildCatalogFromStandards([std], [], seqId(), isBeschaffbar);
  const f = fns.catalogToForm(it);
  assert.equal(f.name, 'Radialschleuse');
  assert.equal(f.sizeVal, '6F');
  assert.equal(f.nat, 'material');
});

test('buildCatalogFromStandards: tolerates empty / missing input', () => {
  assert.equal(JSON.stringify(fns.buildCatalogFromStandards(null, null, seqId(), isBeschaffbar)), '[]');
  assert.equal(JSON.stringify(fns.buildCatalogFromStandards([], [], seqId(), isBeschaffbar)), '[]');
});

// --- canonCatalogName -------------------------------------------------------
test('canonCatalogName: lowercases, folds umlauts, strips non-alphanumerics', () => {
  assert.equal(fns.canonCatalogName('Radial-Schleuse'), 'radialschleuse');
  assert.equal(fns.canonCatalogName('Radial Schleuse'), 'radialschleuse');
  assert.equal(fns.canonCatalogName('radialschleuse'), 'radialschleuse');
  assert.equal(fns.canonCatalogName('Größe Öl Übung Straße'), 'groesseoeluebungstrasse');
});
test('canonCatalogName: null/undefined/empty become empty string', () => {
  assert.equal(fns.canonCatalogName(null), '');
  assert.equal(fns.canonCatalogName(undefined), '');
  assert.equal(fns.canonCatalogName('   '), '');
  assert.equal(fns.canonCatalogName('!!!'), '');
});
test('canonCatalogName: coerces non-strings', () => {
  assert.equal(fns.canonCatalogName(6), '6');
});

// --- findCatalogDuplicateGroups ---------------------------------------------
test('findCatalogDuplicateGroups: groups spelling/whitespace/case variants', () => {
  const items = [
    { id: 'a', name: 'Radialschleuse', nat: 'material' },
    { id: 'b', name: 'Radial-Schleuse', nat: 'material' },
    { id: 'c', name: 'radial schleuse', nat: 'material' },
    { id: 'd', name: 'Programmer', nat: 'geraet' },
  ];
  const groups = fns.findCatalogDuplicateGroups(items);
  assert.equal(groups.length, 1);
  // Cross-realm (vm sandbox) arrays: compare by JSON, not reference-strict deepEqual.
  assert.equal(JSON.stringify(groups[0].map(x => x.id)), JSON.stringify(['a', 'b', 'c']));
});
test('findCatalogDuplicateGroups: same name different size stays separate', () => {
  const items = [
    { id: 'a', name: 'Schleuse', nat: 'material', sizeVal: '5F' },
    { id: 'b', name: 'Schleuse', nat: 'material', sizeVal: '6F' },
  ];
  assert.equal(fns.findCatalogDuplicateGroups(items).length, 0);
});
test('findCatalogDuplicateGroups: same name+size groups; size spelling normalized', () => {
  const items = [
    { id: 'a', name: 'Schleuse', nat: 'material', sizeVal: '6 F' },
    { id: 'b', name: 'Schleuse', nat: 'material', sizeVal: '6F' },
  ];
  const groups = fns.findCatalogDuplicateGroups(items);
  assert.equal(groups.length, 1);
  assert.equal(JSON.stringify(groups[0].map(x => x.id)), JSON.stringify(['a', 'b']));
});
test('findCatalogDuplicateGroups: same name under different nat are distinct', () => {
  const items = [
    { id: 'a', name: 'Ultraschall', nat: 'material' },
    { id: 'b', name: 'Ultraschall', nat: 'geraet' },
  ];
  assert.equal(fns.findCatalogDuplicateGroups(items).length, 0);
});
test('findCatalogDuplicateGroups: nameless entries are not grouped', () => {
  const items = [
    { id: 'a', name: '', nat: 'material' },
    { id: 'b', name: '   ', nat: 'material' },
  ];
  assert.equal(fns.findCatalogDuplicateGroups(items).length, 0);
});
test('findCatalogDuplicateGroups: tolerates null/empty input', () => {
  assert.equal(fns.findCatalogDuplicateGroups(null).length, 0);
  assert.equal(fns.findCatalogDuplicateGroups([]).length, 0);
});
test('findCatalogDuplicateGroups: group order is stable by first appearance', () => {
  const items = [
    { id: 'a', name: 'Draht', nat: 'material' },
    { id: 'b', name: 'Schleuse', nat: 'material' },
    { id: 'c', name: 'draht', nat: 'material' },
    { id: 'd', name: 'schleuse', nat: 'material' },
  ];
  const groups = fns.findCatalogDuplicateGroups(items);
  assert.equal(JSON.stringify(groups.map(g => g[0].id)), JSON.stringify(['a', 'b']));
});

// --- mergeCatalogGroup ------------------------------------------------------
test('mergeCatalogGroup: keeps first id/name/nat, fills missing fields', () => {
  const m = fns.mergeCatalogGroup([
    { id: 'a', name: 'Radialschleuse', nat: 'material', menge: null, sizeTyp: null, sizeVal: null, uk: null },
    { id: 'b', name: 'Radial-Schleuse', nat: 'material', menge: '2x', sizeTyp: 'french', sizeVal: '6F', uk: 'Ansage' },
  ]);
  assert.equal(m.id, 'a');
  assert.equal(m.name, 'Radialschleuse');
  assert.equal(m.nat, 'material');
  assert.equal(m.menge, '2x');
  assert.equal(m.sizeVal, '6F');
  assert.equal(m.sizeTyp, 'french');
  assert.equal(m.uk, 'Ansage');
});
test('mergeCatalogGroup: first non-empty wins, primary value kept', () => {
  const m = fns.mergeCatalogGroup([
    { id: 'a', name: 'X', nat: 'material', menge: '1x', sizeVal: null, uk: 'Lager' },
    { id: 'b', name: 'X', nat: 'material', menge: '9x', sizeVal: null, uk: 'Ansage' },
  ]);
  assert.equal(m.menge, '1x'); // primary already filled
  assert.equal(m.uk, 'Lager');
});
test('mergeCatalogGroup: sizeVal picked from a member also carries its sizeTyp', () => {
  const m = fns.mergeCatalogGroup([
    { id: 'a', name: 'X', nat: 'material', sizeVal: null, sizeTyp: null },
    { id: 'b', name: 'X', nat: 'material', sizeVal: '10', sizeTyp: 'laenge' },
  ]);
  assert.equal(m.sizeVal, '10');
  assert.equal(m.sizeTyp, 'laenge');
});
test('mergeCatalogGroup: sizeVal without a typ anywhere defaults to dimension', () => {
  const m = fns.mergeCatalogGroup([
    { id: 'a', name: 'X', nat: 'material', sizeVal: '10' },
    { id: 'b', name: 'X', nat: 'material' },
  ]);
  assert.equal(m.sizeVal, '10');
  assert.equal(m.sizeTyp, 'dimension');
});
test('mergeCatalogGroup: no sizes anywhere yields null size fields', () => {
  const m = fns.mergeCatalogGroup([
    { id: 'a', name: 'X', nat: 'material' },
    { id: 'b', name: 'X', nat: 'material' },
  ]);
  assert.equal(m.sizeVal, null);
  assert.equal(m.sizeTyp, null);
});
test('mergeCatalogGroup: does not mutate the primary input', () => {
  const primary = { id: 'a', name: 'X', nat: 'material', menge: null };
  fns.mergeCatalogGroup([primary, { id: 'b', name: 'X', nat: 'material', menge: '2x' }]);
  assert.equal(primary.menge, null);
});

// --- mergeCatalogDuplicates -------------------------------------------------
test('mergeCatalogDuplicates: collapses a group in place, drops extras', () => {
  // Same name+size (both unsized) → merge; the middle unrelated item is untouched.
  const items = [
    { id: 'a', name: 'Radialschleuse', nat: 'material', menge: null, sizeVal: null, uk: null },
    { id: 'x', name: 'Draht', nat: 'material' },
    { id: 'b', name: 'Radial-Schleuse', nat: 'material', menge: '2x', sizeVal: null, uk: 'Ansage' },
  ];
  const res = fns.mergeCatalogDuplicates(items);
  assert.equal(res.merged, 1);
  assert.equal(res.groups, 1);
  // primary kept in original slot, 'b' removed
  assert.equal(JSON.stringify(res.items.map(x => x.id)), JSON.stringify(['a', 'x']));
  const rs = res.items.find(x => x.id === 'a');
  assert.equal(rs.menge, '2x');
  assert.equal(rs.uk, 'Ansage');
  assert.equal(rs.sizeVal, null);
});
test('mergeCatalogDuplicates: no duplicates returns a copy unchanged', () => {
  const items = [{ id: 'a', name: 'A', nat: 'material' }, { id: 'b', name: 'B', nat: 'material' }];
  const res = fns.mergeCatalogDuplicates(items);
  assert.equal(res.merged, 0);
  assert.equal(res.groups, 0);
  assert.deepEqual(res.items.map(x => x.id), ['a', 'b']);
  assert.notEqual(res.items, items); // new array
});
test('mergeCatalogDuplicates: multiple groups counted; only extras removed', () => {
  const items = [
    { id: 'a', name: 'Draht', nat: 'material' },
    { id: 'b', name: 'draht', nat: 'material' },
    { id: 'c', name: 'Schleuse', nat: 'material' },
    { id: 'd', name: 'Schleuse!', nat: 'material' },
    { id: 'e', name: 'schleuse', nat: 'material' },
  ];
  const res = fns.mergeCatalogDuplicates(items);
  assert.equal(res.groups, 2);
  assert.equal(res.merged, 3); // Draht: 1 extra, Schleuse: 2 extras
  assert.equal(JSON.stringify(res.items.map(x => x.id)), JSON.stringify(['a', 'c']));
});
test('mergeCatalogDuplicates: does not mutate input array', () => {
  const items = [
    { id: 'a', name: 'X', nat: 'material' },
    { id: 'b', name: 'x', nat: 'material' },
  ];
  fns.mergeCatalogDuplicates(items);
  assert.equal(items.length, 2);
});
test('mergeCatalogDuplicates: tolerates null/empty input', () => {
  assert.equal(JSON.stringify(fns.mergeCatalogDuplicates(null).items), '[]');
  assert.equal(JSON.stringify(fns.mergeCatalogDuplicates([]).items), '[]');
});

// --- parsePreis -------------------------------------------------------------
test('parsePreis: German comma decimal', () => {
  assert.equal(fns.parsePreis('12,50'), 12.5);
  assert.equal(fns.parsePreis('12,50 €'), 12.5);
  assert.equal(fns.parsePreis('  3,00  '), 3);
});
test('parsePreis: thousands dot + comma decimal', () => {
  assert.equal(fns.parsePreis('1.234,56'), 1234.56);
  assert.equal(fns.parsePreis('1.234,56 €'), 1234.56);
});
test('parsePreis: plain dot decimal and integers', () => {
  assert.equal(fns.parsePreis('12.5'), 12.5);
  assert.equal(fns.parsePreis('42'), 42);
});
test('parsePreis: numbers pass through, junk is null', () => {
  assert.equal(fns.parsePreis(9.99), 9.99);
  assert.equal(fns.parsePreis(''), null);
  assert.equal(fns.parsePreis(null), null);
  assert.equal(fns.parsePreis('k. A.'), null);
});

// --- fmtEUR -----------------------------------------------------------------
test('fmtEUR: two decimals with comma and euro sign', () => {
  assert.equal(fns.fmtEUR(12.5), '12,50 €');
  assert.equal(fns.fmtEUR(0), '0,00 €');
  assert.equal(fns.fmtEUR(3), '3,00 €');
});
test('fmtEUR: thousands separator', () => {
  assert.equal(fns.fmtEUR(1234.56), '1.234,56 €');
  assert.equal(fns.fmtEUR(1000000), '1.000.000,00 €');
});
test('fmtEUR: null/invalid becomes dash', () => {
  assert.equal(fns.fmtEUR(null), '–');
  assert.equal(fns.fmtEUR(NaN), '–');
});

// --- mengeNum ---------------------------------------------------------------
test('mengeNum: parses leading count, defaults to 1', () => {
  assert.equal(fns.mengeNum('2x'), 2);
  assert.equal(fns.mengeNum('3 ×'), 3);
  assert.equal(fns.mengeNum('10 Stück'), 10);
  assert.equal(fns.mengeNum(null), 1);
  assert.equal(fns.mengeNum('auf Ansage'), 1);
  assert.equal(fns.mengeNum(''), 1);
});
test('mengeNum: numeric input floored, non-positive -> 1', () => {
  assert.equal(fns.mengeNum(4), 4);
  assert.equal(fns.mengeNum(2.7), 2);
  assert.equal(fns.mengeNum(0), 1);
});

// --- rubTplMatches ----------------------------------------------------------
test('rubTplMatches: scope "all" matches every standard', () => {
  const t = { scope: 'all' };
  assert.equal(fns.rubTplMatches(t, 'crm-x', 'CRM'), true);
  assert.equal(fns.rubTplMatches(t, 'lhk-y', 'LHK'), true);
});
test('rubTplMatches: scope "std" matches only its standard', () => {
  const t = { scope: 'std', std: 'crm-x' };
  assert.equal(fns.rubTplMatches(t, 'crm-x', 'CRM'), true);
  assert.equal(fns.rubTplMatches(t, 'crm-z', 'CRM'), false);
});
test('rubTplMatches: scope "groups" matches by group membership', () => {
  const t = { scope: 'groups', groups: ['CRM', 'TAVI'] };
  assert.equal(fns.rubTplMatches(t, 'a', 'CRM'), true);
  assert.equal(fns.rubTplMatches(t, 'b', 'TAVI'), true);
  assert.equal(fns.rubTplMatches(t, 'c', 'LHK'), false);
});
test('rubTplMatches: missing/invalid inputs are false', () => {
  assert.equal(fns.rubTplMatches(null, 'a', 'CRM'), false);
  assert.equal(fns.rubTplMatches({ scope: 'groups' }, 'a', 'CRM'), false); // no groups array
  assert.equal(fns.rubTplMatches({ scope: 'weird' }, 'a', 'CRM'), false);
});

// --- color helpers ----------------------------------------------------------
test('hexToRgb: parses 3- and 6-digit hex, rejects junk', () => {
  assert.equal(JSON.stringify(fns.hexToRgb('#ffffff')), JSON.stringify({ r: 255, g: 255, b: 255 }));
  assert.equal(JSON.stringify(fns.hexToRgb('#000')), JSON.stringify({ r: 0, g: 0, b: 0 }));
  assert.equal(JSON.stringify(fns.hexToRgb('3d9be0')), JSON.stringify({ r: 61, g: 155, b: 224 }));
  assert.equal(fns.hexToRgb('nope'), null);
  assert.equal(fns.hexToRgb(null), null);
});
test('contrastRatio: white on black is 21, identical is 1', () => {
  assert.ok(Math.abs(fns.contrastRatio('#ffffff', '#000000') - 21) < 0.01);
  assert.ok(Math.abs(fns.contrastRatio('#123456', '#123456') - 1) < 0.001);
});
test('pickTextColor: dark bg -> white text, light bg -> dark text', () => {
  assert.equal(fns.pickTextColor('#000000'), '#ffffff');
  assert.equal(fns.pickTextColor('#1b73b8'), '#ffffff'); // deep blue
  assert.equal(fns.pickTextColor('#ffffff'), '#0b1116');
  assert.equal(fns.pickTextColor('#e8b34a'), '#0b1116'); // amber
});
test('pickTextColor: chosen text always meets a usable contrast (>=4)', () => {
  ['#000000', '#ffffff', '#3d9be0', '#e8b34a', '#34c98a', '#e85d5d', '#7f95ab'].forEach(bg => {
    const t = fns.pickTextColor(bg);
    assert.ok(fns.contrastRatio(bg, t) >= 4, `contrast for ${bg} too low`);
  });
});

// --- Etikett-Scanner: GS1-Parser & Produktdatenbank -------------------------
const GS = String.fromCharCode(29); // FNC1/Gruppen-Trenner (ASCII 29)

test('parseGS1: GTIN + Verfall (fixe Längen) ohne Trenner', () => {
  // 01 + 14-stellige GTIN, 17 + YYMMDD
  const r = fns.parseGS1('0103453120000011' + '17' + '261130');
  assert.equal(r.gtin, '03453120000011');
  assert.equal(r.expiry, '261130');
});
test('parseGS1: LOT variabel bis Stringende (kein Trenner)', () => {
  const r = fns.parseGS1('0103453120000011' + '17261130' + '10ABC1234');
  assert.equal(r.gtin, '03453120000011');
  assert.equal(r.expiry, '261130');
  assert.equal(r.lot, 'ABC1234');
});
test('parseGS1: Serie variabel via GS-Trenner, dann weiteres Feld', () => {
  const r = fns.parseGS1('0103453120000011' + '21SER-9' + GS + '17261130');
  assert.equal(r.gtin, '03453120000011');
  assert.equal(r.serial, 'SER-9');
  assert.equal(r.expiry, '261130');
});
test('parseGS1: führendes FNC1 und AIM-Symbologie-Kennung werden entfernt', () => {
  const r = fns.parseGS1(']d2' + GS + '0103453120000011' + '10L1');
  assert.equal(r.gtin, '03453120000011');
  assert.equal(r.lot, 'L1');
});
test('parseGS1: AI 240 als itemRef (mögliche Hersteller-REF)', () => {
  const r = fns.parseGS1('0103453120000011' + '240RM-RG5J40');
  assert.equal(r.itemRef, 'RM-RG5J40');
});
test('parseGS1: Nicht-GS1-Text ergibt null', () => {
  assert.equal(fns.parseGS1('https://example.org'), null);
  assert.equal(fns.parseGS1(''), null);
  assert.equal(fns.parseGS1(null), null);
});

test('formatGs1Date: YYMMDD -> ISO', () => {
  assert.equal(fns.formatGs1Date('261130'), '2026-11-30');
  assert.equal(fns.formatGs1Date('260101'), '2026-01-01');
});
test('formatGs1Date: Tag 00 = Monatsende', () => {
  assert.equal(fns.formatGs1Date('260200'), '2026-02-28'); // Feb 2026 (kein Schaltjahr)
  assert.equal(fns.formatGs1Date('240200'), '2024-02-29'); // Feb 2024 (Schaltjahr)
});
test('formatGs1Date: ungültige Eingabe bleibt unverändert', () => {
  assert.equal(fns.formatGs1Date('12'), '12');
  assert.equal(fns.formatGs1Date('261399'), '261399'); // Monat 13
});

test('gtinKey: EAN-13 und GTIN-14 desselben Artikels ergeben denselben Schlüssel', () => {
  assert.equal(fns.gtinKey('4012345678901'), '04012345678901');
  assert.equal(fns.gtinKey('04012345678901'), '04012345678901');
  assert.equal(fns.gtinKey(' 04012345678901 '), '04012345678901');
});
test('gtinKey: nicht-numerische Codes bleiben (getrimmt) erhalten', () => {
  assert.equal(fns.gtinKey('ABC-123'), 'ABC-123');
  assert.equal(fns.gtinKey(null), '');
});

test('expiryStatus: abgelaufen / bald / ok relativ zu heute', () => {
  assert.equal(fns.expiryStatus('2026-01-01', '2026-07-17'), 'expired');
  assert.equal(fns.expiryStatus('2026-08-01', '2026-07-17'), 'soon');   // < 90 Tage
  assert.equal(fns.expiryStatus('2027-07-17', '2026-07-17'), 'ok');
  assert.equal(fns.expiryStatus('', '2026-07-17'), '');
});

test('parseScan: GS1-DataMatrix erkannt', () => {
  const r = fns.parseScan('0103453120000011' + '17261130', 'data_matrix');
  assert.equal(r.kind, 'gs1');
  assert.equal(r.gtin, '03453120000011');
});
test('parseScan: reine EAN-Ziffern als GTIN', () => {
  const r = fns.parseScan('4012345678901', 'ean_13');
  assert.equal(r.kind, 'gtin');
  assert.equal(r.gtin, '4012345678901');
});
test('parseScan: QR-Link als url', () => {
  const r = fns.parseScan('https://sops.kardio.wiki/x', 'qr_code');
  assert.equal(r.kind, 'url');
  assert.equal(r.url, 'https://sops.kardio.wiki/x');
});
test('parseScan: sonstiger Text als text', () => {
  assert.equal(fns.parseScan('Hallo Welt', 'qr_code').kind, 'text');
});

test('mergeGtinRecord: legt an, pflegt Zeitstempel, überschreibt Felder', () => {
  const a = fns.mergeGtinRecord(null, { gtin: '1', ref: 'R1' }, 'T1');
  assert.equal(a.createdAt, 'T1');
  assert.equal(a.updatedAt, 'T1');
  assert.equal(a.ref, 'R1');
  const b = fns.mergeGtinRecord(a, { ref: 'R2', hersteller: 'H' }, 'T2');
  assert.equal(b.createdAt, 'T1');   // Anlage-Zeitpunkt bleibt
  assert.equal(b.updatedAt, 'T2');
  assert.equal(b.ref, 'R2');
  assert.equal(b.hersteller, 'H');
});

test('filterGtin: Volltext über Name/REF/Hersteller/GTIN', () => {
  const list = [
    { gtin: '1', name: 'Radialschleuse 6F', ref: 'RG5J40', hersteller: 'Terumo' },
    { gtin: '2', name: 'Führungsdraht', ref: 'GW035', hersteller: 'Boston' },
  ];
  assert.equal(fns.filterGtin(list, 'terumo').length, 1);
  assert.equal(fns.filterGtin(list, 'GW035')[0].gtin, '2');
  assert.equal(fns.filterGtin(list, '').length, 2);
  assert.equal(fns.filterGtin(list, 'xyz').length, 0);
});

test('gtinGroups: nach Hersteller gruppiert und sortiert', () => {
  const list = [
    { gtin: '1', name: 'B-Artikel', hersteller: 'Terumo' },
    { gtin: '2', name: 'A-Artikel', hersteller: 'Terumo' },
    { gtin: '3', name: 'X', hersteller: 'Boston' },
    { gtin: '4', name: 'Y', hersteller: '' },
  ];
  const g = fns.gtinGroups(list);
  assert.equal(g[0].hersteller, 'Boston');
  assert.equal(g[1].hersteller, 'Ohne Hersteller');
  assert.equal(g[2].hersteller, 'Terumo');
  assert.equal(g[2].items[0].name, 'A-Artikel'); // innerhalb nach Name sortiert
});

test('gtinBadges: nur gesetzte Maße als [Label,Wert]-Paare', () => {
  const b = fns.gtinBadges({ french: '6F', laenge: '110 cm', dAussen: '2,6 mm' });
  // Reihenfolge: french, laenge, dAussen, dInnen, weitere.
  // Non-ASCII-Labels (Ø/ä) über NFC-normalisierten JSON vergleichen, damit die
  // Quelldateien-Normalform (NFC/NFD) den Test nicht verfälscht.
  const nfc = (x) => JSON.stringify(x).normalize('NFC');
  assert.equal(nfc(b), nfc([['Fr', '6F'], ['Länge', '110 cm'], ['Ø außen', '2,6 mm']]));
  // gtinBadges({}) kommt aus der vm-Sandbox (fremdes Array.prototype) → per
  // Länge/JSON prüfen statt deepEqual (das den Prototyp mitvergleicht).
  assert.equal(fns.gtinBadges({}).length, 0);
});
