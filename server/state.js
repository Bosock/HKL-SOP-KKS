/* Server-seitiger Zustand: ein JSON-Dokument, im Speicher gecacht und
   write-through nach STATE_FILE persistiert (atomisches temp-file + rename).
   Schreibvorgänge werden über eine Promise-Kette serialisiert. */
'use strict';
const fsp = require('fs').promises;
const crypto = require('crypto');
const { STATE_FILE } = require('./config');

let STATE = { rev: 0, updatedAt: null, state: {} };
let writeChain = Promise.resolve(); // serialise writes to the state file

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
  return writeChain;
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
  getState: () => STATE,
  resetState: () => { STATE = { rev: 0, updatedAt: null, state: {} }; },
  // Waits for all queued writes — used by the shutdown handler.
  flush: () => writeChain,
};
