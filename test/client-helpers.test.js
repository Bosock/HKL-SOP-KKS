'use strict';
/* Tests for the pure helper functions embedded in index.html's <script>.

   Rather than duplicate their bodies (which would drift), we extract the
   actual source of each function from index.html and evaluate it in a vm
   sandbox with the few globals it needs. If someone edits a helper in
   index.html, these tests exercise the edited code. Only genuinely pure
   helpers (no DOM / no localStorage) are covered here. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Grab a `function NAME(...) { ... }` definition by balancing braces.
function extractFn(name) {
  const sig = SRC.indexOf('function ' + name + '(');
  assert.notEqual(sig, -1, `function ${name} not found in index.html`);
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
  assert.ok(m, `const ${name} not found in index.html`);
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
    extractFn('makeAddEntry'),
    extractFn('mergeAdditions'),
  ].join('\n');
  const exportExpr = '({esc, today, cidOf, sizeLabel, typLabel, rubrikIcon, ukKeywordIcon, natSlug, natOf, natList, addSlug, makeAddEntry, mergeAdditions})';
  const fns = vm.runInContext(src + '\n' + exportExpr, ctx);
  return { fns, NATCFG };
}

const { fns } = loadHelpers();

// --- esc --------------------------------------------------------------------
test('esc: escapes HTML metacharacters', () => {
  assert.equal(fns.esc('<a>&"'), '&lt;a&gt;&amp;&quot;');
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
