'use strict';
/* ─────────────────────────────────────────────────────────────
   PRÜFUNG — DER GERÄTESPEICHER HAT GENAU EINE TÜR

   Seit es den Neuaufbau gibt (features/raum.js), trennt auf dem Gerät ein
   PRÄFIX die beiden Räume: „raum:neuaufbau:hkl_…" gegen „hkl_…". Gesetzt
   wird es an einer einzigen Stelle — in `store` (public/js/core/store.js).

   Diese eine Stelle trägt die ganze Zusage „der Bestand bleibt unberührt".
   Ein einziges `localStorage.setItem('hkl_…')` irgendwo sonst ginge am
   Präfix vorbei: Es schriebe aus dem Neuaufbau heraus in den Bestand, ohne
   Fehlermeldung, ohne dass irgendein Test es bemerkt. Deshalb ist der direkte
   Zugriff auf localStorage/sessionStorage außerhalb von store.js verboten.

   Ausnahme mit Begründung: die Marke `speicher:ok` in der Zeile oder im
   Kommentarblock darüber — etwa für eine reine MESSUNG des Platzbedarfs, die
   nichts schreibt und bewusst über alle Räume zählt.
   ───────────────────────────────────────────────────────────── */

const path = require('path');
const { jsDateien, zeilenVon, ausnahme } = require('./quelltext');

const MARKE = 'speicher:ok';
const ERLAUBT = 'public/js/core/store.js';
const ZUGRIFF = /\b(?:localStorage|sessionStorage)\b/;

function fundstellen(datei) {
  const zeilen = zeilenVon(datei);
  const treffer = [];
  zeilen.forEach((z, i) => {
    if (!ZUGRIFF.test(z.code)) return;           /* nur echter Code, keine Kommentare */
    if (ausnahme(zeilen, i, MARKE)) return;
    treffer.push({ nr: z.nr, text: z.roh.trim().slice(0, 100) });
  });
  return treffer;
}

function pruefe(wurzel, verzeichnis) {
  const probleme = [];
  jsDateien(path.join(wurzel, verzeichnis)).forEach(datei => {
    const rel = path.relative(wurzel, datei).split(path.sep).join('/');
    if (rel === ERLAUBT) return;
    const treffer = fundstellen(datei);
    if (!treffer.length) return;
    probleme.push(
      `Gerätespeicher am Raum vorbei: ${rel} greift ${treffer.length}× direkt auf localStorage/sessionStorage zu.\n    `
      + treffer.slice(0, 3).map(t => `${rel}:${t.nr}  ${t.text}`).join('\n    ')
      + `\n    Nur ${ERLAUBT} darf das — dort sitzt das Präfix, das Bestand und Neuaufbau trennt.`
      + `\n    Bitte store.get/store.set (oder loadJSON/saveJSON) benutzen. Reine Messung ohne Schreiben?`
      + `\n    Dann die Marke „${MARKE}" mit einem Satz Begründung in die Zeile oder den Kommentar darüber.`);
  });
  return probleme;
}

module.exports = { MARKE, ERLAUBT, fundstellen, pruefe };
