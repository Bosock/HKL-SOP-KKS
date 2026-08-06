'use strict';
/* ─────────────────────────────────────────────────────────────
   PRÜFUNG — DAS KETTENSYMBOL IN DER BEDIENUNG

   Die 🔗-Verknüpfung war keine missglückte Beschriftung, sondern eine
   Datenmodell-Entscheidung, die in die Oberfläche durchgeschlagen ist: Dass
   „Vorkommen im Standard" und „Material" intern zwei Dinge sind, wurde zu
   einem Menüpunkt, einem Zustand („verknüpft"/„nicht verknüpft"), einem
   Badge, einem Zähler und einem Verwaltungspanel. An sieben Stellen sah man
   die Naht, an der die App zusammengeklebt ist.

   Der Betreiber dazu: „Das ist total irreführend. … Das Material soll sich
   nicht anfühlen wie so'n klobiges Etwas."

   Diese Prüfung hält den erreichten Zustand fest. Sie verbietet nicht das
   Zeichen an sich — sie verbietet, dass es ZURÜCKKEHRT. Ein neues 🔗 in der
   Bedienung wäre der Rückfall in genau die Denkweise, die abgeräumt wurde,
   und niemandem würde es auffallen, weil nichts kaputtgeht.

   Wer es doch braucht (etwa für einen Link im Wortsinn), schreibt die Marke
   `kette:ok` in die Zeile oder in den Kommentarblock darüber — dann ist es
   eine bewusste Entscheidung und keine Gewohnheit.
   ───────────────────────────────────────────────────────────── */

const { jsDateien, zeilenVon, ausnahme } = require('./quelltext');
const path = require('path');

const MARKE = 'kette:ok';
const KETTE = '\u{1F517}';

/* Fundstellen in EINER Datei. Geprüft wird der ganze Quelltext (auch
   Kommentare): Ein Kommentar, der das Zeichen erklärt, ist genauso ein
   Hinweis darauf, dass die Denkweise zurückkommt. */
function fundstellen(datei) {
  const zeilen = zeilenVon(datei);
  const treffer = [];
  zeilen.forEach((z, i) => {
    if (z.roh.indexOf(KETTE) < 0) return;
    if (ausnahme(zeilen, i, MARKE)) return;
    treffer.push({ nr: z.nr, text: z.roh.trim().slice(0, 100) });
  });
  return treffer;
}

/* Ratsche wie bei den Eingabefenstern: Der Bestand darf nur schrumpfen.
   Eine ZU NIEDRIGE Zahl in der Liste ist ebenfalls ein Fehler — sonst
   veraltet die Liste still und schützt am Ende nichts mehr. */
function pruefe(wurzel, verzeichnis, altlasten) {
  const probleme = [];
  const erlaubt = altlasten || {};
  const gesehen = {};

  jsDateien(path.join(wurzel, verzeichnis)).forEach(datei => {
    const rel = path.relative(wurzel, datei).split(path.sep).join('/');
    const treffer = fundstellen(datei);
    if (treffer.length) gesehen[rel] = treffer.length;
    const geduldet = erlaubt[rel] || 0;
    if (treffer.length > geduldet) {
      const neu = treffer.slice(0, 3).map(t => `${rel}:${t.nr}  ${t.text}`).join('\n    ');
      probleme.push(
        `Kettensymbol in der Bedienung: ${rel} hat ${treffer.length} Vorkommen, geduldet sind ${geduldet}.\n    ${neu}\n` +
        `    Ein Material ist ein Material — die Verknüpfung gehört nicht in die Oberfläche.\n` +
        `    Bewusst gewollt? Dann die Marke „${MARKE}" in die Zeile oder den Kommentar darüber.`);
    }
  });

  Object.keys(erlaubt).forEach(rel => {
    const jetzt = gesehen[rel] || 0;
    if (jetzt < erlaubt[rel]) {
      probleme.push(
        `Altlastenliste veraltet: ${rel} hat nur noch ${jetzt} statt ${erlaubt[rel]} Kettensymbole.\n` +
        `    Bitte in scripts/pruefungen/altlasten.json auf ${jetzt} setzen (oder den Eintrag entfernen).`);
    }
  });

  return probleme;
}

module.exports = { MARKE, KETTE, fundstellen, pruefe };
