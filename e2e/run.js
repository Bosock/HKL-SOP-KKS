/* Führt alle E2E-Tests nacheinander aus (jeder Test startet seinen eigenen
   Server mit frischem STATE_DIR). Aufruf: `npm run e2e`. Exit ≠ 0 bei Fehlern. */
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const files = fs.readdirSync(__dirname)
  /* messen.js ist KEINE Prüfung, sondern ein Messstand: Es liefert Zahlen und
     schlägt nie fehl. In diesem Lauf hätte es nichts zu sagen und kostete nur
     eine Minute. Aufruf einzeln über `npm run messen`. */
  .filter(f => f.endsWith('.js') && !['run.js', 'util.js', 'messen.js'].includes(f))
  .sort();

let failed = [];
for (const f of files) {
  console.log('\n━━ e2e/' + f + ' ━━');
  /* Zeitlimit je Suite. durchklick.js löst rund 170 Bedienelemente einzeln aus
     und wartet dabei jeweils die 300-ms-Entprellung ab — das dauert ~90 s.
     240 s lassen auch unter Last Luft, ohne einen echten Hänger zu verdecken. */
  const res = spawnSync(process.execPath, [path.join(__dirname, f)], { stdio: 'inherit', timeout: 240000 });
  if (res.status !== 0) failed.push(f);
}
console.log('\n══════════════════════════════');
if (failed.length) { console.error('FEHLGESCHLAGEN: ' + failed.join(', ')); process.exit(1); }
console.log(`ALLE ${files.length} E2E-SUITEN BESTANDEN`);
