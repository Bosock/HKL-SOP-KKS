'use strict';
/* Tests für die Auslieferungs-Prüfung (scripts/pruefungen/pipeline.js).

   Anlass war ein Deploy, der nicht ankam — und dem man nicht ansah, warum.
   Der Test-Job hing 15 Minuten und wurde abgebrochen; der zweite Versuch lief
   in 15 Sekunden durch. Nicht der Ausrutscher war teuer, sondern dass die
   Pipeline keine Mittel hatte, ihn als solchen zu zeigen.

   Geprüft wird deshalb, dass die drei Eigenschaften wirklich eingefordert
   werden — und dass eine gesunde Pipeline schweigt.
*/

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const P = require('../scripts/pruefungen/pipeline');

const GESUND = `name: Build and Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: deploy-\${{ github.ref }}
  cancel-in-progress: \${{ github.event_name == 'pull_request' }}

jobs:
  test:
    name: Test
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout
        uses: actions/checkout@v4

  deploy:
    name: Deploy to server
    needs: test
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Deploy over SSH
        run: echo hin
      - name: Nachweis — liefert die App wirklich den neuen Stand aus?
        run: curl -fsS "$PUBLIC_URL/sw.js"
`;

function mitWorkflow(inhalt, fn) {
  const wurzel = fs.mkdtempSync(path.join(os.tmpdir(), 'hkl-pipe-'));
  try {
    const dir = path.join(wurzel, '.github', 'workflows');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'deploy.yml'), inhalt, 'utf8');
    return fn(wurzel);
  } finally {
    fs.rmSync(wurzel, { recursive: true, force: true });
  }
}

test('eine gesunde Pipeline meldet nichts', () => {
  mitWorkflow(GESUND, w => assert.equal(P.pruefe(w, {}).length, 0));
});

/* ═══ ① Zeitlimit ═══ */

test('ein Job ohne timeout-minutes wird gemeldet', () => {
  mitWorkflow(GESUND.replace('    timeout-minutes: 10\n', ''), w => {
    const p = P.pruefe(w, {});
    assert.equal(p.length, 1);
    assert.match(p[0], /Job „test".*hat kein timeout-minutes/s);
    assert.match(p[0], /sechs Stunden/);
  });
});

test('jeder Job wird einzeln geprüft, nicht nur der erste', () => {
  mitWorkflow(GESUND.replace(/    timeout-minutes: \d+\n/g, ''), w => {
    const p = P.pruefe(w, {});
    assert.equal(p.filter(x => /hat kein timeout-minutes/.test(x)).length, 2);
  });
});

test('ein ausdrücklich geduldeter Job bricht nicht ab', () => {
  mitWorkflow(GESUND.replace('    timeout-minutes: 10\n', ''), w => {
    assert.equal(P.pruefe(w, { ohneZeitlimit: ['.github/workflows/deploy.yml:test'] }).length, 0);
  });
});

/* ═══ ② Abbruch auf dem Auslieferungszweig ═══ */

test('cancel-in-progress: true wird beim Auslieferungs-Workflow gemeldet', () => {
  mitWorkflow(GESUND.replace("cancel-in-progress: ${{ github.event_name == 'pull_request' }}",
                             'cancel-in-progress: true'), w => {
    const p = P.pruefe(w, {});
    assert.equal(p.length, 1);
    assert.match(p[0], /cancel-in-progress steht auf/);
    assert.match(p[0], /bleibt still auf dem alten Stand/);
  });
});

test('ein Workflow OHNE Deploy darf abbrechen — dort ist es richtig', () => {
  const nurTest = GESUND
    .replace(/\n  deploy:[\s\S]*$/, '\n')
    .replace("cancel-in-progress: ${{ github.event_name == 'pull_request' }}", 'cancel-in-progress: true');
  mitWorkflow(nurTest, w => assert.equal(P.pruefe(w, {}).length, 0));
});

/* ═══ ③ Der Nachweis ═══ */

test('fehlt der Nachweis-Schritt, wird das gemeldet', () => {
  mitWorkflow(GESUND.replace('      - name: Nachweis — liefert die App wirklich den neuen Stand aus?',
                             '      - name: Fertig'), w => {
    const p = P.pruefe(w, {});
    assert.equal(p.length, 1);
    assert.match(p[0], /kein Nachweis-Schritt/);
    assert.match(p[0], /nicht,\n.*dass unter der öffentlichen Adresse wirklich der neue Stand liegt/s);
  });
});

/* ═══ Die Zerlegung selbst ═══ */

test('jobsVon liest Namen, Zeile und Felder', () => {
  const jobs = P.jobsVon(GESUND);
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].name, 'test');
  assert.equal(jobs[0].felder['timeout-minutes'], '10');
  assert.equal(jobs[1].name, 'deploy');
  assert.equal(jobs[1].felder.needs, 'test');
  assert.ok(jobs[0].nr > 0);
});

test('nebenlaeufigkeit liest den obersten concurrency-Block', () => {
  assert.match(P.nebenlaeufigkeit(GESUND), /github\.event_name/);
  assert.equal(P.nebenlaeufigkeit('name: x\njobs:\n  a:\n    runs-on: x\n'), null);
});

test('ohne .github/workflows meldet die Prüfung nichts', () => {
  const leer = fs.mkdtempSync(path.join(os.tmpdir(), 'hkl-pipe-leer-'));
  try { assert.equal(P.pruefe(leer, {}).length, 0); }
  finally { fs.rmSync(leer, { recursive: true, force: true }); }
});

/* ═══ Und die echte Pipeline ═══ */

test('die echte Auslieferung erfüllt alle drei Zusagen', () => {
  const wurzel = path.join(__dirname, '..');
  const alt = JSON.parse(fs.readFileSync(path.join(wurzel, 'scripts/pruefungen/altlasten.json'), 'utf8'));
  const probleme = P.pruefe(wurzel, alt.pipeline || {});
  assert.equal(probleme.length, 0, 'Befunde:\n' + probleme.join('\n\n'));
});

test('der Nachweis liest dieselbe Cache-Version, die die App wirklich trägt', () => {
  const wurzel = path.join(__dirname, '..');
  const sw = fs.readFileSync(path.join(wurzel, 'public/sw.js'), 'utf8');
  const yml = fs.readFileSync(path.join(wurzel, '.github/workflows/deploy.yml'), 'utf8');
  /* Der Ausdruck im Workflow und die Zeile in sw.js müssen zueinander passen —
     ein Nachweis, der nichts liest, wäre die schlimmste Sorte grüner Haken. */
  const m = /^const CACHE_VERSION = '([^']+)';/m.exec(sw);
  assert.ok(m, 'public/sw.js trägt eine CACHE_VERSION in erwarteter Form');
  assert.match(yml, /CACHE_VERSION/, 'der Workflow sucht danach');
  assert.match(m[1], /^v\d+$/, `Fassung sieht aus wie erwartet (ist: ${m[1]})`);
});
