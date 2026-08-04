/* ============================================================
   Quelltext einsammeln und von Kommentaren befreien.

   Gemeinsame Grundlage der Prüfungen 3 und 4 (siehe docs/GRUNDSAETZE.md,
   Teil C). Bewusst ZEILENWEISE und ohne echten Parser: Der Quelltext dieses
   Projekts ist zeilenorientiert geschrieben, und ein Fehler in einer Zeile
   soll nicht die ganze Datei verfälschen. Die Prüfungen dürfen lieber einen
   Fall übersehen, als einen falschen Alarm auslösen — ein falscher Alarm
   kostet Vertrauen, und Vertrauen ist bei einer Prüfung das ganze Kapital.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

/* Alle .js-Dateien unterhalb eines Verzeichnisses (ohne node_modules/.git). */
function jsDateien(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir).sort()) {
    if (name === 'node_modules' || name === '.git' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) jsDateien(full, out);
    else if (name.endsWith('.js')) out.push(full);
  }
  return out;
}

/* Steht die Position i innerhalb einer Zeichenkette? Zählt unmaskierte
   Anführungszeichen von links. Reicht für eine Zeile. */
function inZeichenkette(zeile, i) {
  let q = null;
  for (let k = 0; k < i; k++) {
    const c = zeile[k];
    if (c === '\\') { k++; continue; }
    if (q) { if (c === q) q = null; }
    else if (c === "'" || c === '"' || c === '`') q = c;
  }
  return q !== null;
}

/* Entfernt Kommentare aus EINER Zeile. `offen` sagt, ob die Zeile bereits in
   einem Blockkommentar beginnt; zurück kommt der Code und der neue Zustand.
   Entfernte Zeichen werden durch Leerzeichen ersetzt, damit Spaltennummern
   und die Suche nach Markierungen weiter stimmen. */
function ohneKommentar(zeile, offen) {
  let aus = '';
  let i = 0;
  while (i < zeile.length) {
    if (offen) {
      const e = zeile.indexOf('*/', i);
      if (e < 0) { aus += ' '.repeat(zeile.length - i); i = zeile.length; }
      else { aus += ' '.repeat(e + 2 - i); i = e + 2; offen = false; }
      continue;
    }
    const c = zeile[i], c2 = zeile[i + 1];
    if (c === '/' && c2 === '*' && !inZeichenkette(zeile, i)) { offen = true; aus += '  '; i += 2; continue; }
    /* „//" nur dann Kommentar, wenn es nicht in einer Zeichenkette steht
       (sonst würde jede URL den Rest der Zeile verschlucken). */
    if (c === '/' && c2 === '/' && !inZeichenkette(zeile, i)) { aus += ' '.repeat(zeile.length - i); break; }
    aus += c; i++;
  }
  return { code: aus, offen };
}

/* Eine Datei als Zeilenliste: {nr, roh, code}. */
function zeilenVon(datei) {
  const roh = fs.readFileSync(datei, 'utf8').split('\n');
  let offen = false;
  return roh.map((z, i) => {
    const r = ohneKommentar(z, offen);
    offen = r.offen;
    return { nr: i + 1, roh: z, code: r.code };
  });
}

/* Begründete Ausnahme: die Marke (z. B. „fachwort:ok") steht als Kommentar in
   derselben Zeile ODER im Kommentarblock unmittelbar darüber. Der Block darf
   mehrzeilig sein — eine Begründung, die in eine halbe Zeile passt, ist meist
   keine. Gesucht wird höchstens BLOCK_MAX Zeilen weit; abgebrochen wird, sobald
   eine Zeile echten Code enthält. */
const BLOCK_MAX = 6;
function ausnahme(zeilen, idx, marke) {
  if (zeilen[idx] && zeilen[idx].roh.indexOf(marke) >= 0) return true;
  for (let k = idx - 1; k >= 0 && k >= idx - BLOCK_MAX; k--) {
    const z = zeilen[k];
    if (!z) break;
    if (z.code.trim() !== '') break;          /* echter Code → Block zu Ende */
    if (z.roh.trim() === '') break;           /* Leerzeile → Block zu Ende */
    if (z.roh.indexOf(marke) >= 0) return true;
  }
  return false;
}

module.exports = { jsDateien, ohneKommentar, zeilenVon, inZeichenkette, ausnahme };
