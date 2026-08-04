/* ============================================================
   Prüfung 4 — kein Fachwort in einem Vergleich (Grundsatz ④)

   Die Regel in einem Satz:

     Eine Zeichenkette, die jemand umbenennen kann, darf nicht in einem
     Vergleich stehen.

   Ein Wort, das ANGEZEIGT wird, ist eine Bezeichnung — sie gehört dem Haus
   und darf sich jederzeit ändern. Ein Wort, das VERGLICHEN wird, ist
   Programmlogik. Steht beides im selben Wert, ändert die Umbenennung
   unbemerkt das Verhalten.

   Der reale Fall, der zu dieser Prüfung geführt hat: Der Freigabe-Zustand
   eines Standards hing an dem Wort „Freigegeben". Wer es in der Verwaltung
   umbenannt hätte, hätte damit jede Freigabe des Hauses still ungültig
   gemacht — ohne Fehlermeldung, ohne Hinweis, an einer Stelle, auf die sich
   das Labor verlässt.

   Wie erkannt wird
   ────────────────
   Gemeldet wird eine Zeichenkette, die
     · in einem Identitätsvergleich steht (=== !== == !=) oder in
       indexOf / includes / startsWith / endsWith übergeben wird, UND
     · wie ein MENSCHENWORT aussieht: Großbuchstabe, Leerzeichen oder Umlaut.

   Nicht gemeldet werden damit die üblichen Maschinenschlüssel dieses
   Projekts ('material', 'geraete', 'mengeVal', 'scr-rubriken', 'new|…') —
   die sind klein geschrieben und wurden nie zum Anzeigen gebaut.
   Plattform-Begriffe ('Enter', 'Escape', 'NotAllowedError') stehen in einer
   festen Liste; sie gehören dem Browser, nicht dem Haus.

   Zusätzlich wird der UMWEG ÜBER EINE KONSTANTE erkannt:
   `const FRG_FREI = 'Freigegeben'` mit einem Vergleich auf FRG_FREI
   irgendwo in derselben Datei ist derselbe Fehler, nur eine Zeile weiter.

   Ausnahme im Einzelfall, wenn der Wert wirklich ein Schlüssel ist: hinter
   die Zeile (oder darüber) einen Kommentar mit der Marke „fachwort:ok" und
   einer Begründung in einem Satz setzen, etwa „fester Wert aus
   data/material_catalog.json, keine Anzeige-Bezeichnung".
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const { jsDateien, zeilenVon, ausnahme } = require('./quelltext');

const MARKE = 'fachwort:ok';

/* Begriffe des BROWSERS, nicht des Hauses. Niemand im Labor benennt eine
   Tastaturtaste oder einen DOM-Fehlernamen um. */
const PLATTFORM = new Set([
  'Enter', 'Escape', 'Tab', 'Backspace', 'Delete', 'Shift', 'Control', 'Alt', 'Meta',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown',
  'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS',
  'IMG', 'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A', 'DIV', 'LABEL', 'SUMMARY', 'DETAILS',
  'NotAllowedError', 'SecurityError', 'NotFoundError', 'NotReadableError',
  'OverconstrainedError', 'TrackStartError', 'AbortError', 'QuotaExceededError',
  'TypeError', 'RangeError', 'SyntaxError',
  'Escape', 'Unidentified',
]);

/* Sieht der Wert aus wie ein Wort, das ein Mensch lesen und umbenennen kann? */
function istMenschenwort(lit) {
  if (!lit || !/[A-Za-zÄÖÜäöüß]/.test(lit)) return false;   /* Zahlen, Zeichen, leer */
  if (PLATTFORM.has(lit)) return false;
  if (/^[a-z][A-Za-z0-9]*$/.test(lit)) return false;        /* maschinenSchluessel */
  if (/^[a-z0-9][a-z0-9_.|:/#\[\]-]*$/.test(lit)) return false; /* scr-rubriken, new| … */
  return /[A-ZÄÖÜ]|\s|[äöüß]/.test(lit);
}

/* Zeichenkette in einem Vergleich — beide Seiten, plus die vier
   Suchfunktionen, mit denen man dasselbe umständlicher schreibt. */
const RE_VERGLEICH = new RegExp(
  '(?:[=!]==?\\s*|\\.(?:indexOf|includes|startsWith|endsWith)\\s*\\(\\s*)' +
  '([\'"])((?:[^\'"\\\\]|\\\\.)*)\\1' +
  '|([\'"])((?:[^\'"\\\\]|\\\\.)*)\\3\\s*[=!]==?', 'g');

function fundstellenDirekt(datei) {
  const zeilen = zeilenVon(datei);
  const aus = [];
  zeilen.forEach((z, i) => {
    let m;
    RE_VERGLEICH.lastIndex = 0;
    while ((m = RE_VERGLEICH.exec(z.code))) {
      const lit = (m[2] !== undefined) ? m[2] : (m[4] || '');
      if (!istMenschenwort(lit)) continue;
      if (ausnahme(zeilen, i, MARKE)) continue;
      aus.push({ nr: z.nr, wort: lit, art: 'direkt' });
    }
  });
  return aus;
}

/* Der Umweg: const NAME = 'Menschenwort'  +  irgendwo NAME === / !== NAME. */
const RE_KONST = /(?:^|[\s;{(])(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(['"])((?:[^'"\\]|\\.)*)\2/gm;

function fundstellenKonstante(datei) {
  const src = fs.readFileSync(datei, 'utf8');
  const zeilen = zeilenVon(datei);
  const codeGanz = zeilen.map(z => z.code).join('\n');
  const aus = [];
  let m;
  RE_KONST.lastIndex = 0;
  while ((m = RE_KONST.exec(src))) {
    const name = m[1], lit = m[3];
    if (!istMenschenwort(lit)) continue;
    const nr = src.slice(0, m.index).split('\n').length;
    if (ausnahme(zeilen, nr - 1, MARKE)) continue;
    const cmp = new RegExp('(?:[=!]==?\\s*' + name + '\\b|\\b' + name + '\\s*[=!]==)');
    if (!cmp.test(codeGanz)) continue;
    aus.push({ nr, wort: lit, art: 'konstante', name });
  }
  return aus;
}

function fundstellen(datei) {
  return fundstellenDirekt(datei).concat(fundstellenKonstante(datei)).sort((a, b) => a.nr - b.nr);
}

function pruefe(wurzel, verzeichnis, altlasten) {
  const probleme = [];
  const gezaehlt = {};
  const alle = {};
  for (const datei of jsDateien(path.join(wurzel, verzeichnis))) {
    const rel = path.relative(wurzel, datei).split(path.sep).join('/');
    const f = fundstellen(datei);
    if (f.length) { gezaehlt[rel] = f.length; alle[rel] = f; }
  }

  for (const rel of Object.keys(gezaehlt).sort()) {
    const erlaubt = altlasten[rel] || 0;
    if (gezaehlt[rel] > erlaubt) {
      const neu = alle[rel].slice(erlaubt);
      probleme.push(
        `Fachwort in einem Vergleich — ${rel}: ${gezaehlt[rel]} Vorkommen, geduldet sind ${erlaubt}.\n` +
        `    ${neu.map(x => 'Zeile ' + x.nr + ': „' + x.wort + '"' + (x.art === 'konstante' ? ' (über ' + x.name + ')' : '')).join('\n    ')}\n` +
        `    Wer dieses Wort umbenennt, ändert das Verhalten (Grundsatz ④).\n` +
        `    Statt dessen: ein Schlüssel im Datensatz, das Wort nur zur Anzeige.\n` +
        `    Ist der Wert wirklich ein Schlüssel: /* ${MARKE} — Begründung */ danebenschreiben.`);
    }
  }
  for (const rel of Object.keys(altlasten).sort()) {
    const ist = gezaehlt[rel] || 0;
    if (ist < altlasten[rel]) {
      probleme.push(
        `Altlastenliste veraltet: ${rel} hat nur noch ${ist} statt ${altlasten[rel]} Fachwort-Vergleiche.\n` +
        `    Bitte in scripts/pruefungen/altlasten.json auf ${ist} setzen` +
        (ist === 0 ? ' (oder den Eintrag löschen).' : '.'));
    }
  }
  return probleme;
}

module.exports = { pruefe, fundstellen, istMenschenwort, PLATTFORM, MARKE };
