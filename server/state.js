/* Server-seitiger Zustand: ein JSON-Dokument JE RAUM, im Speicher gecacht und
   write-through in die state.json des Raums persistiert (atomisches
   temp-file + rename). Schreibvorgänge werden je Raum über eine Promise-Kette
   serialisiert.

   Jeder Raum (server/raeume.js) bekommt hier ein eigenes, vollständig
   getrenntes Zustandsobjekt — eigener Speicherstand, eigene Schreibkette,
   eigene Sicherungen. Der Bestand verhält sich exakt wie vor der Einführung
   der Räume; die bisherigen Exporte (loadState, update, snapshot …) zeigen
   weiterhin auf ihn. */
'use strict';
const fsp = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { BACKUP_INTERVAL_MS, BACKUP_KEEP } = require('./config');
const { RAEUME, STANDARD } = require('./raeume');

function leer() { return { rev: 0, updatedAt: null, state: {} }; }

function raumZustand(raum) {
  const { stateFile, backupDir } = raum;
  const tag = raum.id === STANDARD ? '[state]' : `[state:${raum.id}]`;
  let STATE = leer();
  let writeChain = Promise.resolve(); // serialise writes to the state file
  let lastBackupAt = 0;               // throttle: newest snapshot timestamp (ms)
  let backupSeq = 0;                  // disambiguates snapshots within the same ms

  async function loadState() {
    try {
      const raw = await fsp.readFile(stateFile, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.state && typeof parsed.state === 'object') {
        STATE = { rev: parsed.rev || 0, updatedAt: parsed.updatedAt || null, state: parsed.state };
      }
      console.log(`${tag} loaded rev=${STATE.rev} keys=${Object.keys(STATE.state).length}`);
    } catch (e) {
      if (e.code === 'ENOENT') console.log(`${tag} no existing state file — starting empty`);
      else console.error(`${tag} failed to load, starting empty:`, e.message);
      STATE = leer();
    }
  }

  // Atomic write: write to a temp file, fsync it, then rename over the target.
  // Ohne fsync kann bei Stromausfall das Rename vor den Daten auf der Platte
  // landen (leere/halbe Datei) — der sync() schließt dieses Fenster (QA P5).
  function persist() {
    const snapshotText = JSON.stringify(STATE);
    writeChain = writeChain.then(async () => {
      /* Der Ordner eines Raums entsteht erst mit seinem ersten Schreibvorgang
         (für den Bestand existiert er immer schon — dann ist das ein No-op). */
      await fsp.mkdir(path.dirname(stateFile), { recursive: true });
      const tmp = stateFile + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
      const fh = await fsp.open(tmp, 'w');
      try { await fh.writeFile(snapshotText, 'utf8'); await fh.sync(); }
      finally { await fh.close(); }
      await fsp.rename(tmp, stateFile);
    }).catch(err => console.error(`${tag} write failed:`, err.message));
    maybeSnapshot(); // best-effort, throttled — never blocks/rejects the main write
    return writeChain;
  }

  /* Schreibt einen zeitgestempelten Snapshot, falls seit dem letzten genug Zeit
     vergangen ist. Fire-and-forget: Fehler dürfen das Persistieren nie stören. */
  function maybeSnapshot() {
    const now = Date.now();
    if (now - lastBackupAt < BACKUP_INTERVAL_MS) return;
    lastBackupAt = now;
    snapshot().catch(err => console.error(`${tag} snapshot failed:`, err && err.message));
  }

  /* Schreibt sofort einen Snapshot des aktuellen Zustands in den
     Sicherungsordner DIESES Raums und behält nur die BACKUP_KEEP neuesten. Der
     Dateiname ist chronologisch sortierbar (ISO-Zeit + laufende Nummer), damit
     das Pruning rein über die Namen funktioniert. */
  async function snapshot() {
    if (BACKUP_KEEP <= 0) return null;
    await fsp.mkdir(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const seq = String(backupSeq++).padStart(6, '0');
    const file = path.join(backupDir, `state-${stamp}-${seq}.json`);
    await fsp.writeFile(file, JSON.stringify(STATE), 'utf8');
    await pruneBackups();
    return file;
  }

  async function pruneBackups() {
    let names;
    try { names = await fsp.readdir(backupDir); }
    catch (e) { return; }
    const snaps = names.filter(n => /^state-.*\.json$/.test(n)).sort(); // ISO-Namen ⇒ chronologisch
    const excess = snaps.length - BACKUP_KEEP;
    if (excess <= 0) return;
    await Promise.all(snaps.slice(0, excess).map(n =>
      fsp.unlink(path.join(backupDir, n)).catch(() => {})));
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

  return {
    id: raum.id,
    loadState,
    persist,
    update,
    snapshot,
    pruneBackups,
    getState: () => STATE,
    resetState: () => { STATE = leer(); },
    flush: () => writeChain,
    _resetBackupClock: () => { lastBackupAt = 0; },
  };
}

/* Ein Zustandsobjekt je Raum — fest, wie die Raumliste selbst. */
const ZUSTAENDE = {};
Object.keys(RAEUME).forEach(id => { ZUSTAENDE[id] = raumZustand(RAEUME[id]); });
const bestand = ZUSTAENDE[STANDARD];

module.exports = {
  /* Bisherige Schnittstelle — unverändert der Bestand. */
  loadState: bestand.loadState,
  persist: bestand.persist,
  update: bestand.update,
  snapshot: bestand.snapshot,
  pruneBackups: bestand.pruneBackups,
  getState: bestand.getState,
  resetState: bestand.resetState,
  // Test-Hook: setzt die Snapshot-Drosselung zurück (erzwingt nächsten Snapshot).
  _resetBackupClock: bestand._resetBackupClock,
  /* Räume */
  raum: id => (Object.prototype.hasOwnProperty.call(ZUSTAENDE, id) ? ZUSTAENDE[id] : null),
  loadAll: () => Promise.all(Object.keys(ZUSTAENDE).map(id => ZUSTAENDE[id].loadState())),
  // Waits for all queued writes of ALL rooms — used by the shutdown handler.
  flush: () => Promise.all(Object.keys(ZUSTAENDE).map(id => ZUSTAENDE[id].flush())),
};
