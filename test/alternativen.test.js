'use strict';
/* Tests für die vier Sorten von Ersatzmaterial
   (public/js/features/alternativen.js).

   Der Betreiber hat sie wörtlich vorgegeben:

     äquivalent          eins zu eins nutzbar
     teures Äquivalent   eins zu eins, aber deutlich teurer — Absprache
     Alternative         nur unter Bedingungen oder mit Einschränkungen
     Back-Up (Reserve)   nutzbar, aber nicht optimal

   Der Unterschied ist im Saal keine Feinheit: Beim einen greift man zu, beim
   anderen fragt man vorher. Die Tests halten deshalb vor allem zwei Dinge
   fest:

   ① Eine NICHT eingestufte Alternative wird nicht stillschweigend zur
      „Alternative" gemacht. Das wäre eine Behauptung, die niemand aufgestellt
      hat (Grundsatz ①: leer schlägt falsch).
   ② Die Sorte steht am BADGE, also dort, wo im Saal gelesen wird — nicht nur
      in einem Untermenü.
*/

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'public/js/features/alternativen.js'), 'utf8');

function umgebung(vorgabe) {
  const store = Object.assign({}, vorgabe || {});
  const ctx = vm.createContext({
    console,
    loadJSON: (k, d) => (k in store) ? JSON.parse(JSON.stringify(store[k])) : d,
    saveJSON: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
    esc: (s) => String(s == null ? '' : s),
    ADMIN: true,
    DB: { standards: [] },
    __store: store,
  });
  vm.runInContext(SRC, ctx);
  /* `const`/`let` auf oberster Ebene sind in einem vm-Kontext KEINE
     Eigenschaften des globalen Objekts — sie müssen ausdrücklich
     herausgereicht werden. ALTG wird beim Löschen neu zugewiesen, deshalb
     eine Funktion und keine Kopie. */
  vm.runInContext('globalThis.__arten = ALT_ARTEN; globalThis.__altg = () => ALTG;', ctx);
  return ctx;
}

/* Zwei Materialien, eine Gruppe: die Merit ist der Standard, die Schwartz der
   Ersatz — genau das Beispiel, aus dem der Wunsch entstanden ist. */
function gruppe(c, art) {
  const g = c.altAnlegen('Statt Merit-Schleuse', 'merit', 'Merit-Schleuse');
  c.altGliedHinzu(g.id, 'schwartz', 'Schwartz SL1');
  if (art) c.altArtSetzen(g.id, 'schwartz', art);
  return g;
}
const MERIT = { material_key: 'merit' };
const SCHWARTZ = { material_key: 'schwartz' };

/* ═══ Die vier Sorten ═══ */

test('es sind genau vier Sorten — nicht drei und nicht fünf', () => {
  const c = umgebung();
  /* Über die vm-Grenze hinweg sind Arrays fremde Objekte — deshalb als Text
     vergleichen, sonst stolpert der strikte deepEqual über die Prototypen. */
  assert.equal(c.__arten.map(a => a.key).join(','), 'gleich,teuer,bedingt,reserve');
});

test('jede trägt Wort, Symbol und einen erklärenden Satz', () => {
  const c = umgebung();
  c.__arten.forEach(a => {
    assert.ok(a.vorgabe && a.vorgabe.length > 3, a.key + ' braucht ein Wort');
    assert.ok(a.ico && a.ico.length, a.key + ' braucht ein Symbol');
    assert.ok(a.sub && a.sub.length > 10, a.key + ' braucht eine Erklärung');
  });
  /* Die Symbole müssen unterscheidbar sein — sonst ist der Badge im Saal
     wertlos. */
  const icos = c.__arten.map(a => a.ico);
  assert.equal(new Set(icos).size, icos.length);
});

test('die Wörter sind ohne Programmierung änderbar', () => {
  const c = umgebung();
  assert.equal(c.altArtWort('teuer'), 'teures Äquivalent');
  /* bezWert ist der Weg dorthin (features/bezeichnungen). Fehlt er, gilt die
     Vorgabe — die App bleibt bedienbar. */
  ctxSetzen(c, 'bezWert', (bereich, key, vorgabe) =>
    (bereich === 'altarten' && key === 'teuer') ? 'Teuer — bitte fragen' : vorgabe);
  assert.equal(c.altArtWort('teuer'), 'Teuer — bitte fragen');
  assert.equal(c.altArtWort('gleich'), 'äquivalent', 'ungeänderte behalten ihr Wort');
});
function ctxSetzen(ctx, name, fn) { vm.runInContext('globalThis.' + name + ' = __fn;', Object.assign(ctx, { __fn: fn })); }

/* ═══ Einstufen ═══ */

test('eine frische Alternative ist NICHT eingestuft', () => {
  const c = umgebung();
  const g = gruppe(c);
  const glied = g.glieder.find(x => x.key === 'schwartz');
  assert.equal(c.altGliedArt(glied), null);
});

test('einstufen setzt genau eine Sorte', () => {
  const c = umgebung();
  const g = gruppe(c, 'teuer');
  assert.equal(c.altGliedArt(c.altGruppeOf(g.id).glieder[1]).key, 'teuer');
  c.altArtSetzen(g.id, 'schwartz', 'reserve');
  assert.equal(c.altGliedArt(c.altGruppeOf(g.id).glieder[1]).key, 'reserve');
});

test('eine erfundene Sorte wird abgewiesen', () => {
  const c = umgebung();
  const g = gruppe(c, 'teuer');
  assert.equal(c.altArtSetzen(g.id, 'schwartz', 'billig'), false);
  assert.equal(c.altGliedArt(c.altGruppeOf(g.id).glieder[1]).key, 'teuer', 'die alte bleibt stehen');
});

test('die Einstufung lässt sich zurücknehmen', () => {
  const c = umgebung();
  const g = gruppe(c, 'gleich');
  c.altArtSetzen(g.id, 'schwartz', null);
  assert.equal(c.altGliedArt(c.altGruppeOf(g.id).glieder[1]), null);
});

test('sie überlebt einen Neustart', () => {
  const c = umgebung();
  gruppe(c, 'reserve');
  const c2 = umgebung({ hkl_altgruppen: c.__store.hkl_altgruppen });
  assert.equal(c2.altGliedArt(c2.__altg()[0].glieder[1]).key, 'reserve');
});

/* ═══ Was im Saal zu lesen ist ═══ */

test('der Badge am Standard zeigt das Symbol der Sorte', () => {
  const c = umgebung();
  gruppe(c, 'teuer');
  const h = c.altBadgeHTML(MERIT, 's1|0|0|0');
  assert.match(h, /💶/);
  assert.match(h, /oder Schwartz SL1/);
});

test('der Badge an der Alternative sagt, WAS für ein Ersatz sie ist', () => {
  const c = umgebung();
  gruppe(c, 'gleich');
  const h = c.altBadgeHTML(SCHWARTZ, 's1|0|0|1');
  assert.match(h, /🟰/);
  assert.match(h, /äquivalent zu Merit-Schleuse/);
});

test('ohne Einstufung steht dort das neutrale Zeichen — keine Behauptung', () => {
  const c = umgebung();
  gruppe(c);
  const h = c.altBadgeHTML(SCHWARTZ, 's1|0|0|1');
  assert.match(h, /⇄/);
  assert.ok(!/🟰|💶|🧰/.test(h), 'keine Sorte, die niemand vergeben hat');
});

test('ohne Gruppe steht gar nichts an der Zeile', () => {
  const c = umgebung();
  assert.equal(c.altBadgeHTML({ material_key: 'irgendwas' }, 's1|0|0|0'), '');
  assert.equal(c.altBadgeHTML({}, 's1|0|0|0'), '', 'eine Zeile ohne Material erst recht nicht');
});

/* ═══ Die Wahlreihe ═══ */

test('die Wahlreihe bietet alle vier an und zeigt die gesetzte', () => {
  const c = umgebung();
  const g = gruppe(c, 'bedingt');
  const h = c.altSortenWahlHTML(g.id, c.altGruppeOf(g.id).glieder[1]);
  c.__arten.forEach(a => {
    assert.ok(h.indexOf('data-a="' + a.key + '"') >= 0, a.key + ' fehlt in der Reihe');
  });
  assert.match(h, /data-a="bedingt"[^>]*\n?[^>]*aria-pressed="true"/s);
  assert.equal((h.match(/aria-pressed="true"/g) || []).length, 1, 'genau eine ist gesetzt');
});

test('jeder Knopf trägt seine Erklärung mit', () => {
  const c = umgebung();
  const g = gruppe(c);
  const h = c.altSortenWahlHTML(g.id, c.altGruppeOf(g.id).glieder[1]);
  assert.match(h, /deutlich teurer/);
  assert.match(h, /nicht optimal/);
});

/* ═══ Die Gruppe selbst bleibt heil ═══ */

test('ein Glied entfernen löst eine Zweiergruppe auf', () => {
  const c = umgebung();
  const g = gruppe(c, 'gleich');
  c.altGliedWeg(g.id, 'schwartz');
  assert.equal(c.__altg().length, 0, 'eine Gruppe mit einem Glied ist keine Gruppe');
});
