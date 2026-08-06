'use strict';
/* Tests für die Verdrahtungs-Prüfung (scripts/pruefungen/verdrahtung.js).

   Eine Prüfung, die nie anschlägt, ist keine Prüfung — sie ist eine
   Beruhigung. Deshalb wird hier VOR ALLEM geprüft, dass sie bei einem echten
   Fehler wirklich meldet: ein doppelter Name, ein Knopf ins Leere, eine
   Funktion ohne Verwendung, ein ungeteilter Speicher-Schlüssel.

   Und die Gegenrichtung: Sie darf bei gesundem Code NICHT melden. Ein
   falscher Alarm kostet Vertrauen, und Vertrauen ist bei einer Prüfung das
   ganze Kapital.
*/

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const V = require('../scripts/pruefungen/verdrahtung');

/* Ein winziges Projekt auf der Platte — die Prüfung liest Dateien, also
   bekommt sie welche. */
function projekt(dateien, fn) {
  const wurzel = fs.mkdtempSync(path.join(os.tmpdir(), 'hkl-verdr-'));
  try {
    Object.keys(dateien).forEach(rel => {
      const p = path.join(wurzel, rel);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, dateien[rel], 'utf8');
    });
    return fn(wurzel);
  } finally {
    fs.rmSync(wurzel, { recursive: true, force: true });
  }
}

const SYNC_LEER = `const SHARED_KEYS=['hkl_a'];\n`;
const GESUND = {
  'public/js/a.js': "function eins(){ return 1; }\nfunction zwei(){ return eins(); }\n",
  'public/js/b.js': "function zeichne(){ return `<button onclick=\"zwei()\">x</button>`; }\nzeichne();\n",
  'public/js/core/sync.js': SYNC_LEER,
};

test('gesunder Code meldet nichts', () => {
  projekt(GESUND, w => {
    assert.equal(V.pruefe(w, { toteFunktionen: ['zeichne'], geraetelokal: {} }).length, 0);
  });
});

/* ═══ ① Doppelte globale Namen ═══ */

test('derselbe Funktionsname in zwei Dateien wird gemeldet', () => {
  projekt(Object.assign({}, GESUND, {
    'public/js/c.js': "function eins(){ return 99; }\neins();\n",
  }), w => {
    const p = V.pruefe(w, { toteFunktionen: ['zeichne'], geraetelokal: {} });
    assert.equal(p.length, 1);
    assert.match(p[0], /Globaler Name „eins" ist 2× vergeben/);
    assert.match(p[0], /a\.js:1/);
    assert.match(p[0], /c\.js:1/);
    assert.match(p[0], /die spätere Definition gewinnt lautlos/);
  });
});

test('auch eine Variable, die eine Funktion überschreibt, fällt auf', () => {
  projekt(Object.assign({}, GESUND, {
    'public/js/c.js': "let eins = 5;\nconsole.log(eins);\n",
  }), w => {
    const p = V.pruefe(w, { toteFunktionen: ['zeichne'], geraetelokal: {} });
    assert.equal(p.filter(x => /„eins"/.test(x)).length, 1);
  });
});

test('gleiche Namen in DERSELBEN Datei sind ebenso ein Fehler', () => {
  projekt({
    'public/js/a.js': "function f(){}\nfunction f(){}\nf();\n",
    'public/js/core/sync.js': SYNC_LEER,
  }, w => {
    assert.match(V.pruefe(w, { toteFunktionen: [], geraetelokal: {} }).join('\n'), /2× vergeben/);
  });
});

/* ═══ ② Schaltflächen ohne Ziel ═══ */

test('ein onclick auf eine Funktion, die es nicht gibt, wird gemeldet', () => {
  projekt(Object.assign({}, GESUND, {
    'public/js/b.js': "function zeichne(){ return `<button onclick=\"gibtEsNicht()\">x</button>`; }\nzeichne();\n",
  }), w => {
    /* `zwei` wird durch das Ersetzen von b.js zur Waise — das meldet die
       Prüfung zu Recht mit; hier interessiert nur der Knopf ins Leere. */
    const p = V.pruefe(w, { toteFunktionen: ['zeichne','zwei'], geraetelokal: {} });
    assert.equal(p.length, 1);
    assert.match(p[0], /Schaltfläche ohne Ziel: gibtEsNicht\(\)/);
    assert.match(p[0], /es passiert nichts/);
  });
});

test('Browser-Eingebautes und Schlüsselwörter lösen keinen Fehlalarm aus', () => {
  projekt(Object.assign({}, GESUND, {
    'public/js/b.js': "function zeichne(){ return `<button onclick=\"if(confirm('x')){ setTimeout(zwei,1); } return false\">x</button>`; }\nzeichne();\n",
  }), w => {
    assert.equal(V.pruefe(w, { toteFunktionen: ['zeichne'], geraetelokal: {} }).length, 0);
  });
});

test('auch onchange und oninput werden geprüft, nicht nur onclick', () => {
  projekt(Object.assign({}, GESUND, {
    'public/js/b.js': "function zeichne(){ return `<input onchange=\"fehltA()\" oninput=\"fehltB()\">`; }\nzeichne();\n",
  }), w => {
    const t = V.pruefe(w, { toteFunktionen: ['zeichne'], geraetelokal: {} }).join('\n');
    assert.match(t, /fehltA/);
    assert.match(t, /fehltB/);
  });
});

test('async function zählt als Definition', () => {
  projekt({
    'public/js/a.js': "async function laden(){ return 1; }\nfunction z(){ return `<b onclick=\"laden()\">x</b>`; }\nz();\n",
    'public/js/core/sync.js': SYNC_LEER,
  }, w => {
    assert.equal(V.pruefe(w, { toteFunktionen: ['z'], geraetelokal: {} }).length, 0);
  });
});

/* ═══ ③ Funktionen ohne Verwendung ═══ */

test('eine Funktion, die niemand ruft, wird gemeldet', () => {
  projekt(Object.assign({}, GESUND, {
    'public/js/c.js': "function niemandRuftMich(){ return 1; }\n",
  }), w => {
    const p = V.pruefe(w, { toteFunktionen: ['zeichne'], geraetelokal: {} });
    assert.equal(p.length, 1);
    assert.match(p[0], /niemandRuftMich\(\)/);
    assert.match(p[0], /oft ist es eine vergessene Verdrahtung/);
  });
});

test('eine Nennung im Test oder im E2E zählt als Verwendung', () => {
  projekt(Object.assign({}, GESUND, {
    'public/js/c.js': "function nurImTest(){ return 1; }\n",
    'test/x.test.js': "// prüft nurImTest\n",
  }), w => {
    assert.equal(V.pruefe(w, { toteFunktionen: ['zeichne'], geraetelokal: {} }).length, 0);
  });
});

test('was ausdrücklich geduldet ist, wird nicht gemeldet', () => {
  projekt(Object.assign({}, GESUND, {
    'public/js/c.js': "function absichtlichUngenutzt(){ return 1; }\n",
  }), w => {
    assert.equal(V.pruefe(w, { toteFunktionen: ['zeichne','absichtlichUngenutzt'], geraetelokal: {} }).length, 0);
  });
});

/* ═══ ④ Speicher-Schlüssel ohne Geräte-Teilung ═══ */

test('ein gespeicherter Schlüssel außerhalb von SHARED_KEYS wird gemeldet', () => {
  projekt(Object.assign({}, GESUND, {
    'public/js/c.js': "function merk(){ saveJSON('hkl_neu', 1); }\nmerk();\n",
  }), w => {
    const p = V.pruefe(w, { toteFunktionen: ['zeichne'], geraetelokal: {} });
    assert.equal(p.length, 1);
    assert.match(p[0], /„hkl_neu" wird geschrieben, aber nicht geteilt/);
    assert.match(p[0], /wirkt nur auf DIESEM Gerät/);
  });
});

test('ein Schlüssel in SHARED_KEYS ist in Ordnung', () => {
  projekt(Object.assign({}, GESUND, {
    'public/js/c.js': "function merk(){ saveJSON('hkl_a', 1); }\nmerk();\n",
  }), w => {
    assert.equal(V.pruefe(w, { toteFunktionen: ['zeichne'], geraetelokal: {} }).length, 0);
  });
});

test('gerätelokal MIT Begründung ist in Ordnung — ohne nicht', () => {
  const p = Object.assign({}, GESUND, {
    'public/js/c.js': "function merk(){ store.set('hkl_ansicht', 1); }\nmerk();\n",
  });
  projekt(p, w => {
    assert.equal(V.pruefe(w, { toteFunktionen: ['zeichne'], geraetelokal: { hkl_ansicht: 'ist eine Ansicht' } }).length, 0);
  });
  projekt(p, w => {
    assert.equal(V.pruefe(w, { toteFunktionen: ['zeichne'], geraetelokal: {} }).length, 1);
  });
});

test('eine Begründung für einen Schlüssel, den es nicht mehr gibt, veraltet nicht still', () => {
  projekt(GESUND, w => {
    const p = V.pruefe(w, { toteFunktionen: ['zeichne'], geraetelokal: { hkl_weg: 'gab es mal' } });
    assert.equal(p.length, 1);
    assert.match(p[0], /wird aber nirgends mehr geschrieben/);
  });
});

/* ═══ Und schließlich: das echte Projekt ═══ */

test('das echte Projekt ist verdrahtet — keine Lücke, kein toter Rest', () => {
  const wurzel = path.join(__dirname, '..');
  const alt = JSON.parse(fs.readFileSync(path.join(wurzel, 'scripts/pruefungen/altlasten.json'), 'utf8'));
  const probleme = V.pruefe(wurzel, alt);
  assert.equal(probleme.length, 0, 'Befunde:\n' + probleme.join('\n\n'));
});

test('jeder gerätelokale Schlüssel trägt eine Begründung, nicht nur einen Haken', () => {
  const wurzel = path.join(__dirname, '..');
  const alt = JSON.parse(fs.readFileSync(path.join(wurzel, 'scripts/pruefungen/altlasten.json'), 'utf8'));
  const lokal = alt.geraetelokal || {};
  const keys = Object.keys(lokal);
  assert.ok(keys.length > 5, 'es gibt gerätelokale Schlüssel');
  keys.forEach(k => {
    assert.ok(String(lokal[k]).length > 20,
      `„${k}" braucht eine Begründung, aus der hervorgeht WARUM es nicht geteilt wird`);
  });
});
