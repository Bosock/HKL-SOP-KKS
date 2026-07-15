/* Server-seitiger Zustand: ein JSON-Dokument, im Speicher gecacht und
   write-through nach STATE_FILE persistiert (atomisches temp-file + rename).
   Schreibvorgänge werden über eine Promise-Kette serialisiert. */
'use strict';
const fsp = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { STATE_FILE, BACKUP_DIR, BACKUP_INTERVAL_MS, BACKUP_KEEP } = require('./config');

let STATE = { rev: 0, updatedAt: null, state: {} };
let writeChain = Promise.resolve(); // serialise writes to the state file
let lastBackupAt = 0;               // throttle: newest snapshot timestamp (ms)
let backupSeq = 0;                  // disambiguates snapshots within the same ms

async function loadState() {
  try {
    const raw = await fsp.readFile(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.state && typeof parsed.state === 'object') {
      STATE = { rev: parsed.rev || 0, updatedAt: parsed.updatedAt || null, state: parsed.state };
    }
    console.log(`[state] loaded rev=${STATE.rev} keys=${Object.keys(STATE.state).length}`);
  } catch (e) {
    if (e.code === 'ENOENT') console.log('[state] no existing state file — starting empty');
    else console.error('[state] failed to load, starting empty:', e.message);
    STATE = { rev: 0, updatedAt: null, state: {} };
  }
}

// Atomic-ish write: write to a temp file then rename over the target.
function persist() {
  const snapshot = JSON.stringify(STATE);
  writeChain = writeChain.then(async () => {
    const tmp = STATE_FILE + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
    await fsp.writeFile(tmp, snapshot, 'utf8');
    await fsp.rename(tmp, STATE_FILE);
  }).catch(err => console.error('[state] write failed:', err.message));
  maybeSnapshot(); // best-effort, throttled — never blocks/rejects the main write
  return writeChain;
}

/* Schreibt einen zeitgestempelten Snapshot, falls seit dem letzten genug Zeit
   vergangen ist. Fire-and-forget: Fehler dürfen das Persistieren nie stören. */
function maybeSnapshot() {
  const now = Date.now();
  if (now - lastBackupAt < BACKUP_INTERVAL_MS) return;
  lastBackupAt = now;
  snapshot().catch(err => console.error('[state] snapshot failed:', err && err.message));
}

/* Schreibt sofort einen Snapshot der aktuellen state.json in BACKUP_DIR und
   behält nur die BACKUP_KEEP neuesten. Der Dateiname ist chronologisch
   sortierbar (ISO-Zeit + laufende Nummer), damit das Pruning rein über die
   Namen funktioniert. */
async function snapshot() {
  if (BACKUP_KEEP <= 0) return null;
  await fsp.mkdir(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const seq = String(backupSeq++).padStart(6, '0');
  const file = path.join(BACKUP_DIR, `state-${stamp}-${seq}.json`);
  await fsp.writeFile(file, JSON.stringify(STATE), 'utf8');
  await pruneBackups();
  return file;
}

async function pruneBackups() {
  let names;
  try { names = await fsp.readdir(BACKUP_DIR); }
  catch (e) { return; }
  const snaps = names.filter(n => /^state-.*\.json$/.test(n)).sort(); // ISO-Namen ⇒ chronologisch
  const excess = snaps.length - BACKUP_KEEP;
  if (excess <= 0) return;
  await Promise.all(snaps.slice(0, excess).map(n =>
    fsp.unlink(path.join(BACKUP_DIR, n)).catch(() => {})));
}

/* Top-level key merge: only the keys the client sends are replaced.
   Keys another client changed but this client did not send stay intact. */
function update(incoming) {
  STATE.state = Object.assign({}, STATE.state, incoming);
  STATE.rev += 1;
  STATE.updatedAt = new Date().toISOString();
  persist();
  return STATE;
}

module.exports = {
  loadState,
  persist,
  update,
  snapshot,
  pruneBackups,
  getState: () => STATE,
  resetState: () => { STATE = { rev: 0, updatedAt: null, state: {} }; },
  // Waits for all queued writes — used by the shutdown handler.
  flush: () => writeChain,
  // Test-Hook: setzt die Snapshot-Drosselung zurück (erzwingt nächsten Snapshot).
  _resetBackupClock: () => { lastBackupAt = 0; },
};
