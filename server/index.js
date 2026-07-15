/* ============================================================
   HKL Standards — backend server (zero dependencies)

   It does two jobs:

     1. Serves the single-page app (public/) and the standards
        data (public/data/*.json) with gzip, cache and security
        headers — i.e. everything the old nginx.conf did.

     2. Provides a tiny persistence API (/api/state) so that edits
        made in the web interface survive on the SERVER and are
        shared across all devices — not just in one browser's
        localStorage.

   Aufbau (ein Modul pro Aufgabe, siehe ARCHITECTURE.md):
     config.js     zentrale Konfiguration (env wird einmal gelesen)
     state.js      Zustand: Laden/Persistieren/Top-Level-Merge
     http-util.js  sendJSON / gzip / Body-Limit
     static.js     statische Dateien, ETag, SPA-Fallback
     routes/       API-Endpunkte (Registry in routes/index.js)
     app.js        http.Server + Dispatch
   ============================================================ */
'use strict';
const fsp = require('fs').promises;
const config = require('./config');
const state = require('./state');
const { sendJSON, maybeGzip } = require('./http-util');
const { safeJoin } = require('./static');
const { server } = require('./app');
const stateRoute = require('./routes/state');
const authRoute = require('./routes/auth');

async function main() {
  await fsp.mkdir(config.STATE_DIR, { recursive: true });
  await state.loadState();
  server.listen(config.PORT, () => console.log(`[server] listening on :${config.PORT} (public=${config.PUBLIC_DIR}, state=${config.STATE_FILE})`));
}

/* Start als Prozess (node server.js): Signale abfangen, Zustand flushen. */
function run() {
  ['SIGTERM', 'SIGINT'].forEach(sig => process.on(sig, () => {
    console.log(`[server] ${sig} — flushing state and exiting`);
    state.flush().finally(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  }));

  main().catch(err => { console.error('[server] fatal:', err); process.exit(1); });
}

module.exports = {
  server,
  main,
  run,
  loadState: state.loadState,
  persist: state.persist,
  safeJoin,
  maybeGzip,
  sendJSON,
  handleState: stateRoute.handle,
  // Session-Signierung (für Tests der OAuth-Härtung).
  signSession: authRoute.signSession,
  verifySession: authRoute.verifySession,
  // State accessors for tests (STATE is module-private).
  getState: state.getState,
  resetState: state.resetState,
  config: {
    PUBLIC_DIR: config.PUBLIC_DIR,
    STATE_DIR: config.STATE_DIR,
    STATE_FILE: config.STATE_FILE,
    MAX_BODY: config.MAX_BODY,
    MIME: config.MIME,
    SECURITY_HEADERS: config.SECURITY_HEADERS,
    COMPRESSIBLE: config.COMPRESSIBLE,
  },
};
