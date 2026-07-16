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

   Aufruf:  npm run check     (oder: node scripts/check.js)
   Exit 0 = alles gut, Exit 1 = Probleme (werden aufgelistet).
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

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

function collectProblems() {
  return [].concat(shellSyncProblems(), syntaxProblems());
}

function main() {
  const problems = collectProblems();
  if (problems.length === 0) {
    console.log('✓ check: Syntax OK, sw.js SHELL und index.html sind synchron.');
    return 0;
  }
  console.error(`✗ check: ${problems.length} Problem(e) gefunden:\n`);
  problems.forEach((p, i) => console.error(`  ${i + 1}. ${p}`));
  console.error('\nBitte beheben, bevor deployt wird.');
  return 1;
}

if (require.main === module) process.exit(main());

module.exports = { jsFiles, indexModules, shellModules, shellSyncProblems, syntaxProblems, collectProblems };
