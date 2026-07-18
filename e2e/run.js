/* Führt alle E2E-Tests nacheinander aus (jeder Test startet seinen eigenen
   Server mit frischem STATE_DIR). Aufruf: `npm run e2e`. Exit ≠ 0 bei Fehlern. */
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const files = fs.readdirSync(__dirname)
  .filter(f => f.endsWith('.js') && !['run.js', 'util.js'].includes(f))
  .sort();

let failed = [];
for (const f of files) {
  console.log('\n━━ e2e/' + f + ' ━━');
  const res = spawnSync(process.execPath, [path.join(__dirname, f)], { stdio: 'inherit', timeout: 120000 });
  if (res.status !== 0) failed.push(f);
}
console.log('\n══════════════════════════════');
if (failed.length) { console.error('FEHLGESCHLAGEN: ' + failed.join(', ')); process.exit(1); }
console.log(`ALLE ${files.length} E2E-SUITEN BESTANDEN`);
