# Architektur

Die App besteht aus zwei Teilen, beide bewusst **ohne Build-Schritt und ohne
npm-Abhängigkeiten** — was im Repo liegt, ist exakt das, was ausgeliefert wird:

1. **Frontend** (`public/`): eine Single-Page-App aus einer HTML-Schale,
   einem Stylesheet und kleinen JavaScript-Modulen (klassische Scripts,
   keine ES-Module).
2. **Backend** (`server.js` → `server/`): ein Node-Server, der `public/`
   statisch ausliefert und unter `/api/state` den geteilten Zustand persistiert.

```
public/
  index.html          HTML-Schale: Markup + geordnete <script>-Liste (= Manifest)
  css/app.css         Styles
  js/
    core/             Fundament: Store, Konfiguration, Labels, App-Zustand, Server-Sync
      store.js          localStorage-Wrapper, $() , esc(), loadJSON/saveJSON
      config.js         Passwort-Schutz, Naturen-Konfiguration (DEFAULT_NAT)
      labels.js         Größen-/Typ-Labels, Icons
      app-state.js      globale Zustandsvariablen + App-Gestalt (Texte, Design)
      sync.js           Server-Sync (/api/state), SHARED_KEYS, Bootstrap-Hydrierung
    data/             Daten laden
      demo-data.js      Fallback-Demodaten
      load.js           JSON laden, Material-Index aufbauen
    features/         fachliche Bausteine
      additions.js      eigene Einträge/Standards (hkl_additions)
      catalog.js        Katalog-Domänenlogik (rein, testbar)
      care.js           Materialpflege (Fotos, Lagerorte)
      backup.js         Export/Import aller Anpassungen
      quickmenu.js      Schnellmenü (Long-Press)
    ui/               Ansichten & Navigation
      nav.js, standards.js, rubriken.js, detail.js,
      catalog.js, admin.js, forms.js, chrome.js
    main.js           Bootstrap: sync.init() → load() → sync.start()
  data/               hkl_standards_export.json (Quelldaten, read-only)

server/
  config.js           liest die Umgebung EINMAL beim Start (PORT, PUBLIC_DIR, …)
  state.js            Zustand: Laden, atomisches Persistieren, Top-Level-Merge
  http-util.js        sendJSON, gzip, Body-Limit
  static.js           statische Dateien: MIME, Cache-Header, ETag/304, SPA-Fallback
  routes/             API-Endpunkte (Registry in routes/index.js)
  app.js              http.Server + Dispatch (Routen → sonst statisch)
  index.js            Zusammenbau, main()/run(), öffentliche Modul-API
server.js             dünner Einstiegspunkt (node server.js)
```

## Frontend-Konventionen

- **Klassische Scripts, gemeinsamer globaler Namensraum.** Alle Module teilen
  sich einen Scope (wie früher das eine große `<script>`). Funktionen sind
  global, weil das Markup sie in `onclick="…"`-Attributen direkt referenziert.
- **Die Reihenfolge der `<script>`-Tags in `public/index.html` ist die
  Ladereihenfolge** — sie ist das einzige "Modulsystem". Regeln:
  - Code, der beim Laden sofort ausgeführt wird (Top-Level-Aufrufe,
    `let x = f()`), darf nur Funktionen aus **früher geladenen** Dateien
    aufrufen. Innerhalb einer Datei gilt normales Hoisting.
  - Sofort ausgeführter Startcode gehört nach `js/main.js` (lädt zuletzt).
- **Kein `use strict`, keine ES-Module, kein Transpiler** — bewusst, damit
  die Dateien 1:1 dem entsprechen, was der Browser ausführt, und damit
  ältere Stations-Tablets nicht ausgeschlossen werden.

### Neuen Frontend-Baustein hinzufügen

1. Datei anlegen, z. B. `public/js/features/mein-feature.js`. Reine
   Domänenlogik (ohne DOM/Store) als eigenständige Funktionen schreiben —
   dann ist sie automatisch testbar (siehe Tests unten).
2. In `public/index.html` einen `<script src="js/features/mein-feature.js">`
   **vor `js/main.js`** eintragen (und nach allem, was die Datei beim Laden
   sofort benutzt).
3. Soll ein neuer Speicher-Schlüssel (`hkl_…`) **zwischen Geräten geteilt**
   werden: den Schlüssel in `SHARED_KEYS` in `public/js/core/sync.js`
   ergänzen und in `hydrateVars()` neu einlesen. Ohne diesen Eintrag bleibt
   der Schlüssel rein lokal (localStorage).
4. Für reine Helferfunktionen Tests in `test/client-helpers.test.js`
   ergänzen (`extractFn('meinHelfer')`).

## Backend-Konventionen

- **Null Abhängigkeiten** — nur Node-Builtins (`http`, `fs`, `zlib`, …).
- Konfiguration wird **einmal beim Laden** aus der Umgebung gelesen
  (`server/config.js`); Tests setzen `process.env` deshalb vor dem
  `require('../server.js')`.
- Die öffentliche Modul-API (`server`, `loadState`, `resetState`, …) wird in
  `server/index.js` zusammengebaut und von `server.js` re-exportiert — sie
  ist der Vertrag mit `test/server.test.js` und sollte stabil bleiben.

### Neuen API-Endpunkt hinzufügen

1. Datei `server/routes/<name>.js` anlegen, die exportiert:
   ```js
   module.exports = {
     matches: pathname => pathname === '/api/mein-endpunkt',
     async handle(req, res, url) { /* … */ },
   };
   ```
   (`sendJSON`/`readBody` aus `../http-util` verwenden.)
2. Die Route in `server/routes/index.js` registrieren.
3. Integrationstest in `test/server.test.js` ergänzen.

## Persistenz & Sync (Überblick)

- Der Client schreibt alles über `store.set()` nach `localStorage`; der
  Sync-Baustein (`core/sync.js`) schickt geänderte `SHARED_KEYS` gebündelt
  per `PUT /api/state` an den Server (Top-Level-Key-Merge, last write wins
  pro Schlüssel) und pollt alle 15 s Fremdänderungen.
- Der Server hält den Zustand im Speicher und persistiert ihn atomar nach
  `STATE_DIR/state.json` (Docker-Volume `hkl-state`) — siehe README,
  Abschnitt "Server-side state".

## Auslieferung & Caching

- HTML, JS, CSS und `data/*` werden mit `Cache-Control: no-cache` + schwachem
  **ETag** ausgeliefert: Browser revalidieren jede Datei (billige 304er),
  nach einem Deploy mischen sich also nie alte Module mit neuer Schale.
  Bilder/Fonts bekommen `max-age=3600`.
- Deployment-Weg unverändert: Push auf `main` → GitHub Actions (Tests →
  Image → GHCR) → SSH-Deploy per `docker compose pull && up -d`
  (siehe README / `.github/workflows/deploy.yml`).

## Tests

- `npm test` (Node ≥ 18, `node --test`, keine Abhängigkeiten).
- `test/server.test.js`: Integrationstests gegen den echten Server auf einem
  ephemeren Port (Fixture-Verzeichnisse unter `$TMPDIR`).
- `test/client-helpers.test.js`: extrahiert die **reinen** Helferfunktionen
  aus den `public/js`-Modulen (Modulliste kommt aus den `<script>`-Tags der
  Schale) und führt sie in einer vm-Sandbox aus — getestet wird also immer
  der echte, aktuelle Quelltext.

## Bekannte Altlasten / bewusste Kompromisse

- `esc()` escaped kein `'`. In `onclick`-Attributen, die Werte in
  JS-String-Literale interpolieren, sind daher nur `[a-z0-9_]`-IDs sicher
  (dafür gibt es `newAid()`/`addSlug()`). Freitext nie direkt in
  `onclick`-Strings interpolieren — IDs übergeben und nachschlagen.
- Der Passwort-Schutz (`core/config.js`) ist Komfort-, keine echte
  Sicherheitsfunktion (djb2-Hash im geteilten Zustand); die App ist für den
  internen Gebrauch hinter vertrauenswürdigem Netz gedacht.
- Kein Auth am `/api/state`-Endpunkt — gleiche Begründung.
