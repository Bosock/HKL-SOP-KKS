/* ============================================================
   Prüfung 3 — keine nativen Eingabefenster (Grundsatz ⑧)

   `prompt()` und `confirm()` sind in installierten PWAs (manifest
   display:"standalone") auf mehreren Android-Chrome-Versionen wirkungslos:
   Es erscheint KEIN Dialog, der Aufruf liefert sofort null bzw. false — die
   Funktion schlägt lautlos fehl. Genau das ist im Labor der schlimmste
   Fehler: Jemand tippt, nichts passiert, niemand erfährt warum.

   Die Prüfung arbeitet mit einer Altlastenliste: Was am Tag der Einführung
   schon da war, ist je Datei gezählt und geduldet. Neue Fälle brechen ab.
   Ist eine Zahl ZU HOCH, bricht die Prüfung ebenfalls ab und nennt die neue,
   kleinere Zahl — so kann der Bestand nur schrumpfen.

   Ausnahme im Einzelfall (sehr sparsam):  /* eingabe:ok — Grund
   ============================================================ */
'use strict';
const path = require('path');
const { jsDateien, zeilenVon, ausnahme } = require('./quelltext');

const MARKE = 'eingabe:ok';
/* Vorangestelltes Zeichen ausschließen, damit promptLogin(), sheetPrompt()
   oder obj.confirm() nicht mitzählen. */
const RE = /(^|[^.\w$])(prompt|confirm)\s*\(/g;

/* Fundstellen einer Datei: [{datei, nr, fn, text}] */
function fundstellen(datei) {
  const zeilen = zeilenVon(datei);
  const aus = [];
  zeilen.forEach((z, i) => {
    let m;
    RE.lastIndex = 0;
    while ((m = RE.exec(z.code))) {
      if (ausnahme(zeilen, i, MARKE)) continue;
      aus.push({ datei, nr: z.nr, fn: m[2], text: z.roh.trim().slice(0, 100) });
    }
  });
  return aus;
}

/* wurzel: Projektwurzel · verzeichnis: was geprüft wird · altlasten: {datei: anzahl} */
function pruefe(wurzel, verzeichnis, altlasten) {
  const probleme = [];
  const gezaehlt = {};
  const alleFunde = [];
  for (const datei of jsDateien(path.join(wurzel, verzeichnis))) {
    const rel = path.relative(wurzel, datei).split(path.sep).join('/');
    const f = fundstellen(datei);
    if (f.length) { gezaehlt[rel] = f.length; alleFunde.push(...f.map(x => Object.assign({ rel }, x))); }
  }

  for (const rel of Object.keys(gezaehlt).sort()) {
    const erlaubt = altlasten[rel] || 0;
    const ist = gezaehlt[rel];
    if (ist > erlaubt) {
      const neue = alleFunde.filter(x => x.rel === rel).slice(erlaubt);
      probleme.push(
        `Natives Eingabefenster in ${rel}: ${ist} Vorkommen, geduldet sind ${erlaubt}.\n` +
        `    ${neue.map(x => 'Zeile ' + x.nr + ': ' + x.text).join('\n    ')}\n` +
        `    prompt()/confirm() bleiben in installierten PWAs lautlos wirkungslos (Grundsatz ⑧).\n` +
        `    Statt dessen: eine Eingabefläche der App (Sheet oder Formular).`);
    }
  }
  for (const rel of Object.keys(altlasten).sort()) {
    const ist = gezaehlt[rel] || 0;
    if (ist < altlasten[rel]) {
      probleme.push(
        `Altlastenliste veraltet: ${rel} hat nur noch ${ist} statt ${altlasten[rel]} Eingabefenster.\n` +
        `    Bitte in scripts/pruefungen/altlasten.json auf ${ist} setzen` +
        (ist === 0 ? ' (oder den Eintrag löschen).' : '.') +
        `\n    Die Liste darf nur schrumpfen — sonst schleicht sich der Bestand zurück.`);
    }
  }
  return probleme;
}

module.exports = { pruefe, fundstellen, MARKE };
