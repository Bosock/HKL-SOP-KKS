#!/usr/bin/env node
/* ============================================================
   HKL Standards — Projekt-Selbstprüfung (zero dependencies)

   Fängt vor dem Deploy die zwei häufigsten Fehlerquellen ab, die kein
   Test bemerkt, weil sie sich erst im Browser zeigen:

     1. SYNTAXFEHLER in einer JS-Datei (`node --check` je Datei) — ein
        vergessenes Komma bricht sonst die ganze App, ohne dass `npm test`
        (das nur einzelne Helfer lädt) es merkt.

     2. sw.js SHELL ⇄ index.html <script>-Liste AUSEINANDERGELAUFEN — steht
        ein neues Modul nicht in beiden Listen, lädt es der Browser online,
        fehlt aber offline (oder umgekehrt). README/ARCHITECTURE warnen
        davor; hier wird es maschinell erzwungen.

     3. NATIVE EINGABEFENSTER (prompt/confirm) — in installierten PWAs
        lautlos wirkungslos (Grundsatz ⑧, docs/GRUNDSAETZE.md).

     4. FACHWORT IN EINEM VERGLEICH — eine Zeichenkette, die jemand umbenennen
        kann, steuert Verhalten (Grundsatz ④, docs/GRUNDSAETZE.md).

     7. AUSLIEFERUNG — jeder CI-Job hat ein Zeitlimit, der Auslieferungszweig
        bricht laufende Deploys nicht ab, und am Ende steht ein Schritt, der
        die ausgelieferte App ABRUFT statt nur „grün" zu melden.

     6. VERDRAHTUNG — doppelte globale Namen, Schaltflächen ohne Ziel,
        Funktionen ohne Verwendung, Speicher-Schlüssel ohne Geräte-Teilung.
        Vier Fehlerklassen, bei denen NICHTS kaputtgeht: Es passiert einfach
        nichts. Genau deshalb braucht es eine Maschine dafür.

     5. KETTENSYMBOL IN DER BEDIENUNG — die Verknüpfung Zeile↔Material war
        eine Datenmodell-Entscheidung, die in die Oberfläche durchgeschlagen
        ist. Sie ist abgeräumt; diese Prüfung verhindert, dass sie
        zurückkehrt (docs/KONZEPT-FUENF-AUSBAUTEN.md, K4).

   3 bis 5 arbeiten mit einer Altlastenliste (scripts/pruefungen/altlasten.json):
   Der Bestand vom Tag der Einführung ist je Datei gezählt und geduldet, neue
   Fälle brechen ab — und eine zu hohe Zahl bricht ebenfalls ab. So kann der
   Bestand nur schrumpfen.

   Aufruf:  npm run check     (oder: node scripts/check.js)
   Exit 0 = alles gut, Exit 1 = Probleme (werden aufgelistet).
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const eingabefenster = require('./pruefungen/eingabefenster');
const fachwort = require('./pruefungen/fachwort');
const kettensymbol = require('./pruefungen/kettensymbol');
const verdrahtung = require('./pruefungen/verdrahtung');
const pipeline = require('./pruefungen/pipeline');

const ROOT = path.join(__dirname, '..');
const ALTLASTEN = path.join(__dirname, 'pruefungen', 'altlasten.json');

/* Alle projekteigenen .js-Dateien einsammeln (ohne node_modules/.git). */
function jsFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) jsFiles(full, out);
    else if (name.endsWith('.js')) out.push(full);
  }
  return out;
}

/* 1) Syntaxprüfung: node --check je Datei. Liefert Problem-Strings. */
function syntaxProblems() {
  const problems = [];
  for (const file of jsFiles(ROOT)) {
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    } catch (e) {
      const msg = (e.stderr ? e.stderr.toString() : e.message).trim();
      problems.push(`Syntaxfehler in ${path.relative(ROOT, file)}:\n    ${msg.split('\n').slice(0, 4).join('\n    ')}`);
    }
  }
  return problems;
}

/* js/-Module aus den <script src="…">-Tags von index.html (Reihenfolge egal). */
function indexModules() {
  const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
  const out = new Set();
  const re = /<script\s+src="(js\/[^"]+\.js)"/g;
  let m;
  while ((m = re.exec(html))) out.add(m[1]);
  return out;
}

/* js/-Module aus der SHELL-Liste von sw.js. */
function shellModules() {
  const sw = fs.readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8');
  const out = new Set();
  const re = /['"](js\/[^'"]+\.js)['"]/g;
  let m;
  while ((m = re.exec(sw))) out.add(m[1]);
  return out;
}

/* 2) sw.js SHELL ⇄ index.html abgleichen. */
function shellSyncProblems() {
  const idx = indexModules();
  const shell = shellModules();
  const problems = [];
  for (const mod of idx) if (!shell.has(mod)) problems.push(`Modul "${mod}" steht in index.html, fehlt aber in der SHELL-Liste von sw.js (offline nicht verfügbar).`);
  for (const mod of shell) if (!idx.has(mod)) problems.push(`Modul "${mod}" steht in der SHELL-Liste von sw.js, wird aber in index.html nicht geladen (verwaist).`);
  return problems;
}

/* 3–5) Grundsätze ⑧ und ④ sowie das abgeräumte Kettensymbol, je gegen die
   Altlastenliste. */
function altlasten() {
  try { return JSON.parse(fs.readFileSync(ALTLASTEN, 'utf8')); }
  catch (e) { return { eingabefenster: {}, fachwort: {}, kettensymbol: {}, toteFunktionen: [], geraetelokal: {}, pipeline: {} }; }
}
function grundsatzProblems() {
  const alt = altlasten();
  return [].concat(
    eingabefenster.pruefe(ROOT, 'public/js', alt.eingabefenster || {}),
    fachwort.pruefe(ROOT, 'public/js', alt.fachwort || {}),
    kettensymbol.pruefe(ROOT, 'public/js', alt.kettensymbol || {}),
    verdrahtung.pruefe(ROOT, alt),
    pipeline.pruefe(ROOT, alt.pipeline || {}));
}

function collectProblems() {
  return [].concat(shellSyncProblems(), syntaxProblems(), grundsatzProblems());
}

function main() {
  const problems = collectProblems();
  if (problems.length === 0) {
    console.log('✓ check: Syntax OK · sw.js SHELL ⇄ index.html synchron · keine neuen Eingabefenster · kein Fachwort in einem Vergleich · kein Kettensymbol in der Bedienung · Verdrahtung vollständig · Auslieferung beweist sich.');
    return 0;
  }
  console.error(`✗ check: ${problems.length} Problem(e) gefunden:\n`);
  problems.forEach((p, i) => console.error(`  ${i + 1}. ${p}`));
  console.error('\nBitte beheben, bevor deployt wird.');
  return 1;
}

if (require.main === module) process.exit(main());

module.exports = { jsFiles, indexModules, shellModules, shellSyncProblems, syntaxProblems, grundsatzProblems, altlasten, collectProblems, ALTLASTEN };
