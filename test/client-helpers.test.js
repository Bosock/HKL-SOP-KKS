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
  ].join('\n');
  const exportExpr = '({esc, today, cidOf, sizeLabel, typLabel, rubrikIcon, ukKeywordIcon, natSlug, natOf, natList})';
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
