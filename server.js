/* Dünner Einstiegspunkt — die Implementierung liegt modular in server/
   (siehe ARCHITECTURE.md). `node server.js` startet den Server; Tests
   require()n dieses Modul und steuern listen()/loadState() selbst. */
'use strict';
const app = require('./server/index.js');

module.exports = app;

if (require.main === module) app.run();
