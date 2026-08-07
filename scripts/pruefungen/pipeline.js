'use strict';
/* ─────────────────────────────────────────────────────────────
   PRÜFUNG — DIE AUSLIEFERUNG MUSS SICH MELDEN

   Am 06.08.2026 lief ein Deploy nicht. Nicht, weil etwas kaputt war — der
   Test-Job hing fünfzehn Minuten und wurde abgebrochen; der zweite Versuch
   lief in fünfzehn SEKUNDEN durch. Teuer war daran nicht der Ausrutscher,
   sondern dass man ihm nicht ansah, was er war: kein Zeitlimit, also sah ein
   hängender Job aus wie ein langsamer; keine Nachprüfung am Ende, also sagte
   „grün" nichts darüber, ob die App draußen wirklich neu ist.

   Drei Eigenschaften halten das fest:

   ① JEDER JOB HAT EIN ZEITLIMIT. Ohne `timeout-minutes` läuft ein hängender
      Job bis zu sechs Stunden und meldet dabei „läuft noch". Mit Zeitlimit
      wird aus einem Rätsel eine Fehlermeldung.

   ② AUF DEM AUSLIEFERUNGSZWEIG WIRD NICHT ABGEBROCHEN.
      `cancel-in-progress: true` ist bei Pull Requests richtig — dort ist ein
      überholter Lauf wertlos. Auf `main` ist es ein stiller Verlust: Zwei
      Merges kurz hintereinander, der erste Deploy wird mitten im Lauf
      beendet, keine Fehlermeldung, die App bleibt auf dem alten Stand.

   ③ DER DEPLOY BEWEIST SICH SELBST. Am Ende muss ein Schritt stehen, der die
      ausgelieferte App ABRUFT und ihre Fassung mit der gebauten vergleicht.
      Alles andere prüft nur, ob die Befehle zurückgekommen sind.

   Gelesen wird zeilenweise, ohne YAML-Bibliothek (das Projekt hat bewusst
   keine Abhängigkeiten). Das reicht für die drei Fragen und ist die gleiche
   Bauart wie die übrigen Prüfungen: lieber einen Fall übersehen als falschen
   Alarm auslösen.
   ───────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');

/* Einrückungstiefe einer Zeile (Leerzeichen). */
function tiefe(z){ return z.length - z.replace(/^ */, '').length; }

/* Die Jobs einer Workflow-Datei mit ihren direkten Eigenschaften.
   Erwartet die übliche Form:  jobs:\n  <name>:\n    <feld>: <wert> */
function jobsVon(text){
  const zeilen = text.split('\n');
  const jobs = [];
  let inJobs = false, aktuell = null;
  zeilen.forEach((z, i)=>{
    if(/^jobs:\s*$/.test(z)){ inJobs = true; return; }
    if(!inJobs) return;
    if(z.trim() && tiefe(z) === 0){ inJobs = false; return; }   /* nächster Block auf oberster Ebene */
    const kopf = /^  ([A-Za-z_][\w-]*):\s*$/.exec(z);
    if(kopf){ aktuell = { name: kopf[1], nr: i+1, felder: {}, text: '' }; jobs.push(aktuell); return; }
    if(!aktuell) return;
    aktuell.text += z + '\n';
    const feld = /^    ([a-z-]+):\s*(.*)$/.exec(z);
    if(feld) aktuell.felder[feld[1]] = feld[2].trim();
  });
  return jobs;
}

/* Der Wert von `cancel-in-progress` im obersten concurrency-Block. */
function nebenlaeufigkeit(text){
  const m = /\nconcurrency:\n((?:[ \t]+.*\n)+)/.exec('\n'+text);
  if(!m) return null;
  const c = /cancel-in-progress:\s*(.+)/.exec(m[1]);
  return c ? c[1].trim() : null;
}

function workflowDateien(wurzel){
  const dir = path.join(wurzel, '.github', 'workflows');
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f=>/\.ya?ml$/.test(f)).sort().map(f=>path.join(dir, f));
}

function pruefe(wurzel, geduldet){
  const opt = geduldet || {};
  const probleme = [];
  workflowDateien(wurzel).forEach(datei=>{
    const rel = path.relative(wurzel, datei).split(path.sep).join('/');
    const text = fs.readFileSync(datei, 'utf8');
    const jobs = jobsVon(text);

    /* ① Zeitlimit je Job */
    jobs.forEach(j=>{
      if(j.felder['timeout-minutes']) return;
      if((opt.ohneZeitlimit || []).indexOf(rel+':'+j.name) >= 0) return;
      probleme.push(`Job „${j.name}" in ${rel}:${j.nr} hat kein timeout-minutes.\n`
        + `    Ein hängender Job läuft sonst bis zu sechs Stunden und meldet dabei „läuft noch".\n`
        + `    Genau so sah der Ausfall vom 06.08. aus — 15 Minuten Hänger, kein Hinweis worauf.`);
    });

    /* ② und ③ nur für den Workflow, der wirklich ausliefert */
    const liefertAus = jobs.some(j=>/deploy/i.test(j.name) || /deploy/i.test(j.felder.name||''));
    if(!liefertAus) return;

    const cip = nebenlaeufigkeit(text);
    if(cip === 'true'){
      probleme.push(`${rel}: cancel-in-progress steht auf `+'`true`'+` — auch für den Auslieferungszweig.\n`
        + `    Zwei Merges kurz hintereinander brechen den ersten Deploy ab: keine Fehlermeldung,\n`
        + `    die App bleibt still auf dem alten Stand. Bei Pull Requests ist Abbrechen richtig,\n`
        + `    auf main nicht — etwa: cancel-in-progress: \${{ github.event_name == 'pull_request' }}`);
    }

    const hatNachweis = /(?:^|\n)\s*-\s*name:\s*.*Nachweis/i.test(text);
    if(!hatNachweis){
      probleme.push(`${rel}: kein Nachweis-Schritt nach dem Deploy.\n`
        + `    „Workflow grün" heißt sonst nur, dass die Befehle zurückgekommen sind — nicht,\n`
        + `    dass unter der öffentlichen Adresse wirklich der neue Stand liegt. Der Schritt muss\n`
        + `    die ausgelieferte App ABRUFEN und ihre Fassung mit der gebauten vergleichen.`);
    }
  });
  return probleme;
}

module.exports = { pruefe, jobsVon, nebenlaeufigkeit, workflowDateien };
