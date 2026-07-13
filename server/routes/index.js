/* Routen-Registry. Neue Endpunkte: Datei in server/routes/ anlegen, die
   { matches(pathname), handle(req, res, url) } exportiert, und hier eintragen.
   Die erste Route, deren matches() greift, behandelt die Anfrage; alles
   andere fällt auf die statische Auslieferung zurück (siehe app.js). */
'use strict';

module.exports = [
  require('./health'),
  require('./state'),
];
