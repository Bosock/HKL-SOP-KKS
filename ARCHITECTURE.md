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
      backup.js         Export/Import aller Anpassungen — enthält historisch
                        bedingt AUCH die Verwaltungsansicht (renderAdmin +
                        Kategorien-/UK-Editoren); ui/admin.js hält nur die
                        Sammel-Helfer. Bei Gelegenheit entwirren (siehe
                        docs/audits/).
      quickmenu.js      Schnellmenü (Long-Press)
      scanner.js        Etikett-Scanner: GS1-Parser (rein/testbar) + Kamera
                        (BarcodeDetector) + Produktdatenbank (hkl_gtin)
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
- **Snapshots (Datenverlust-Schutz):** Bei jedem Schreiben legt der Server
  zusätzlich gedrosselt (≤ 1 Snapshot je `BACKUP_INTERVAL_MS`, Default 10 min)
  eine zeitgestempelte Kopie in `STATE_DIR/backups/` ab und behält die
  `BACKUP_KEEP` neuesten (Default 48). Best-effort und fire-and-forget: ein
  Backup-Fehler darf das eigentliche Persistieren nie blockieren. Wiederher-
  stellen = passende `backups/state-….json` über `state.json` kopieren.

## Auslieferung & Caching

- HTML, JS, CSS und `data/*` werden mit `Cache-Control: no-cache` + schwachem
  **ETag** ausgeliefert: Browser revalidieren jede Datei (billige 304er),
  nach einem Deploy mischen sich also nie alte Module mit neuer Schale.
  Bilder/Fonts bekommen `max-age=3600`.
- **Sicherheits-Header** (`SECURITY_HEADERS` in `server/config.js`, auf jeder
  Antwort): strikte **Content-Security-Policy** (`default-src 'self'`,
  `object-src 'none'`, `base-uri`/`form-action`/`frame-ancestors 'self'`;
  `script`/`style` behalten `'unsafe-inline'` wegen der Inline-`onclick=`/
  `style=`-Attribute; `script-src` trägt zusätzlich `'wasm-unsafe-eval'` für die
  On-Device-OCR (nur WASM-Kompilierung — **nie** das gefährliche bare
  `'unsafe-eval'`), `worker-src` erlaubt `blob:` für den OCR-Worker; `img-src`
  erlaubt `data:`/`blob:` für die Foto-Pflege), **HSTS** (ohne `includeSubDomains`) sowie
  `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` und eine
  `Permissions-Policy`, die ungenutzte Sensor-/Zahlungs-APIs abschaltet.
- Deployment-Weg unverändert: Push auf `main` → GitHub Actions (Tests →
  Image → GHCR) → SSH-Deploy per `docker compose pull && up -d`
  (siehe README / `.github/workflows/deploy.yml`).

## Tests & Selbstprüfung

- `npm run check` (`scripts/check.js`, keine Abhängigkeiten) prüft **vier**
  Dinge: (1) `node --check` über alle projekteigenen `.js`-Dateien;
  (2) `SHELL` in `public/sw.js` ⇄ `<script>`-Tags in `public/index.html`;
  (3) **keine neuen `prompt()`/`confirm()`** (Grundsatz ⑧ — in installierten
  PWAs lautlos wirkungslos); (4) **kein Fachwort in einem Vergleich**
  (Grundsatz ④ — inkl. Umweg über eine Konstante).
  (3) und (4) liegen in `scripts/pruefungen/` und arbeiten gegen die
  **schrumpfende Altlastenliste** `scripts/pruefungen/altlasten.json`: Der
  Bestand vom Einführungstag ist je Datei gezählt und geduldet, neue Fälle
  brechen ab — und eine **zu hohe** Zahl bricht ebenfalls ab, damit die Liste
  nur kleiner werden kann. Begründete Einzelfälle stehen als
  `/* fachwort:ok — Grund */` bzw. `/* eingabe:ok — Grund */` am Quelltext.
  Die Regeln dahinter: [docs/GRUNDSAETZE.md](docs/GRUNDSAETZE.md).
  Läuft in CI vor den Tests. Praktische Anleitung für Mitpflegende:
  [CONTRIBUTING.md](CONTRIBUTING.md).
- `npm test` (Node ≥ 18, `node --test`, keine Abhängigkeiten).
- `test/server.test.js`: Integrationstests gegen den echten Server auf einem
  ephemeren Port (Fixture-Verzeichnisse unter `$TMPDIR`).
- `test/client-helpers.test.js`: extrahiert die **reinen** Helferfunktionen
  aus den `public/js`-Modulen (Modulliste kommt aus den `<script>`-Tags der
  Schale) und führt sie in einer vm-Sandbox aus — getestet wird also immer
  der echte, aktuelle Quelltext.

## Rubrik-Vorlagen mit Geltungsbereich (`hkl_rubtpl`)

Rubriken können über einen einzelnen Standard hinaus gelten. Eine Vorlage
(`RUBTPL`-Eintrag) hat `{id, name, typ, scope}` mit `scope`:

- `'std'` (+ `std:<id>`) — nur ein Standard,
- `'groups'` (+ `groups:[…]`) — alle Standards dieser Gruppen,
- `'all'` — jeder Standard.

`mergeCustomIntoDB()` hängt passende Vorlagen-Rubriken (`__tplid`) **auf einer
Kopie** des jeweiligen Standard-Objekts an (nie DB_BASE mutieren!). Steuerung
per Häkchen-Matrix in der Verwaltung (`rubTplPanelHTML` / `toggleTplGroup`, per
Gruppen-**Index** aufgerufen — Freitext gehört wegen der `esc()`-Apostroph-Altlast
nicht in `onclick`). Anlegen/Bearbeiten über `openRubrikForm`. Einträge und
Rubrik-Overrides (`RUBE`) nutzen den stabilen `rubKey` (`tpl:<id>`).

Neue geteilte Schlüssel: `hkl_prod` (Material-Preise) und `hkl_rubtpl`
(Rubrik-Vorlagen) — beide in `SHARED_KEYS` (`core/sync.js`) **und** `BACKUP_KEYS`
(`features/backup.js`).

## Etikett-Scanner & Produktdatenbank (`hkl_gtin`)

`features/scanner.js` liest per nativer **`BarcodeDetector`**-API (Android-Chrome)
GS1-Barcodes/UDI-DataMatrix live von der Kamera. Der reine, testbare Kern
(`parseGS1`, `parseScan`, `formatGs1Date`, `gtinKey`, `expiryStatus`,
`mergeGtinRecord`, `filterGtin`, `gtinGroups`, `gtinBadges`) zerlegt die
GS1-Application-Identifiers (01 GTIN, 17 Verfall, 10 LOT, 21 Serie …) und ist
in `test/client-helpers.test.js` abgedeckt; die Kamera-/DOM-Schicht bleibt dünn.
Die **GTIN** ist der Datenbankschlüssel — der Barcode trägt REF/Hersteller
bewusst **nicht**, diese Freitextfelder werden einmal je GTIN erfasst. Geteilter
Schlüssel `hkl_gtin` in `SHARED_KEYS` (+ `hydrateVars`) **und** `BACKUP_KEYS`.
Der Barcode-Teil braucht keine CSP-Änderung (BarcodeDetector ist kein
Skript-`eval`; die Kamera ist per `Permissions-Policy` erlaubt).
End-to-End: `e2e/scanner.js`.

**On-Device-OCR** (`features/ocr.js`) füllt die Freitextfelder aus einem
Etikett-**Foto** vor. `extractLabelFields(text)` ist rein/testbar (REF, LOT,
Marken-Hersteller, French/Länge/Ø aus dem OCR-Text) und wird nur auf **leere**
Formularfelder angewendet (nie überschreiben). Die Engine ist **Tesseract.js
(WASM)**, selbst gehostet unter `public/vendor/tesseract/` (SIMD-LSTM-Core +
`eng.traineddata.gz`, ~6 MB), **lazy** erst beim ersten OCR-Aufruf geladen und
same-origin (offline-fähig, `connect-src 'self'`). Dafür — und **nur** dafür —
trägt die CSP `'wasm-unsafe-eval'` (reine WASM-Kompilierung, kein bare
`'unsafe-eval'`), plus `worker-src 'self' blob:`; der Server liefert `.wasm`
(`application/wasm`) und das `.gz`-Sprachmodell ohne Content-Encoding aus
(Client entpackt selbst). End-to-End (lädt echte Engine, liest echten Text):
`e2e/ocr.js`.

**Etikett-Erkennung in vier Stufen** — Leitgedanke: *die beste Texterkennung
ist die, die man nicht braucht*, und eine REF muss nicht perfekt gelesen
werden, sondern **unterscheidbar** sein. Ausführlich in
[`docs/KONZEPT-OCR.md`](docs/KONZEPT-OCR.md):

| Stufe | Modul | Kern |
|---|---|---|
| 0 Barcode | `features/scanner.js` | GS1 AI `01` (GTIN) und AI `240/241` (REF **exakt**) |
| 1 GTIN auflösen | `features/gudid.js` | eigener Stammsatz → Referenz-Katalog → **AccessGUDID** (NLM, frei, kontolos); Treffer sind „unbestätigt" mit Quelle, Cache `hkl_gudid` (gerätelokal) |
| 2 Etikett lesen | `features/ocr.js` | `ocrReadLabel`: Graustufen bis 3600 px + Kontrastspreizung, Wörterbücher AUS, gezielter **REF-Streifen** (`ocrRefBand` → PSM 7 + Whitelist), zweite Meinung binarisiert, Mehrheitsentscheid (`ocrVoteFields`) — alles aus EINEM Foto |
| 3 REF auflösen | `features/matref.js` | `refResolve` gegen den bekannten Bestand: exakt → Zeichenklasse (`O/0`, `I/1`, `S/5`, `B/8`) → ähnlich; **nur Eindeutiges wird entschieden** |

Dazu die **Lernschleife** (`hkl_ocrlearn`, in `SHARED_KEYS` + `BACKUP_KEYS`):
Korrigiert ein Mensch eine Lesung, merkt sich die App das Paar — beim nächsten
Mal trifft sie sofort, auch bei Produkten außerhalb jedes Katalogs.
Der **geführte Dialog** (`features/ocrwizard.js`) führt durch zwei Aufnahmen
(Barcode nah, Etikett flächig), weil beide gegensätzliche Bilder brauchen; ein
einzelnes Foto bleibt möglich. Server-OCR ist bewusst **nicht** umgesetzt,
solange `/api/state` unauthentifiziert ist (siehe Konzeptpapier).
CSP: `connect-src` erlaubt zusätzlich genau `https://accessgudid.nlm.nih.gov`.

**Fotogalerie am Material** (`features/scanner.js`): der Stammsatz führt
`fotos: [{src,titel}]`; `photo` bleibt das erste Bild der Liste, damit alle
Listenansichten und Altbestände unverändert funktionieren.

**Fehler- und Problemanalyse** (`features/diag.js`) — damit die App ohne
Entwickler wartbar bleibt. Drei Bausteine, ausführlich in
[`docs/FEHLERANALYSE.md`](docs/FEHLERANALYSE.md):

1. **Technische Fehler automatisch**: `window.onerror`, `unhandledrejection`,
   fehlgeschlagene Ressourcen und — die ergiebigste Quelle — jeder rote
   Fehler-`toast()` der App (durch Umhüllen der globalen Funktion, kein
   Eingriff an den Aufrufstellen). Jeder Eintrag trägt Bildschirm und den Weg
   dorthin. `diagPush` fasst gleiche Befunde zu EINEM Eintrag mit Zähler
   zusammen — sonst wäre das Protokoll nach dem ersten Fehlerschauer wertlos.
2. **Gefühlte Fehler**: „🐞 Problem melden" im Menü, ohne Anmeldung, zwei
   Felder (Absicht / Beobachtung). Den Kontext hängt die App selbst an. Das
   ist der Fall, den keine Fehlerbehandlung sieht: *es passiert nichts.*
3. **Selbsttest**: `diagChecks()` prüft nebenwirkungsfrei Bildschirme,
   Datenbestand, Verknüpfungen, Speicherplatz, Verbindung — und
   **„Übersichtszeilen sind bedienbar"**: jeder Halte-Detektor trägt sich in
   `HOLDNAV` mit den Daten-Attributen ein, die er versteht; `diagRowProblems`
   meldet jede Zeile, für die es keinen Weg hinein gibt.

Dazu **„Schalter in Zeilen erreichbar"** (`diagInnerBlocked`): Der Detektor
lauscht am Container und beansprucht den Tipp auf der ganzen Zeile — ein
`stopPropagation()` im Inline-`onclick` eines Schalters DARIN läuft zu spät,
weil der native Klick gar nicht erst entsteht. Nur `ignoreSel` im Detektor
wirkt. Der Selbsttest meldet jeden nicht ausgenommenen Schalter.

Anlass war ein realer Fehler: Anleitungen ließen sich auf Touchgeräten nicht
öffnen, weil `attachHoldNav` nur `data-sid` kannte, bei `data-gid` nichts tun
konnte — den Tipp aber trotzdem per `preventDefault` verschluckte, sodass
kein `click` und damit kein Inline-`onclick` mehr feuerte. Mit der Maus fiel
das nicht auf. Behoben auf beiden Ebenen: der Detektor kennt jetzt beide
Attribute, UND `onTap` meldet zurück, ob es den Tipp behandelt hat — nur ein
behandelter Tipp wird noch unterdrückt. Die systematische Nachsuche fand zwei
Geschwister derselben Klasse (⭐ Favorit in der Übersicht, 🧬 Material-Verweis
am Eintrag) — beide behoben. Die zweite, fast identische Kopie des Detektors
in `attachLongPress` ist entfallen; Einträge nutzen jetzt denselben
`attachHoldNav` (`rowSel:'.entry-row[data-cid]'`, `ignoreSel:ENTRY_BTNS`),
womit auch der meistgenutzte Bildschirm im Selbsttest-Register `HOLDNAV`
erscheint.
Geteilter Schlüssel `hkl_diag` in `SHARED_KEYS` (Meldungen aller Geräte an
einem Ort), bewusst NICHT in `BACKUP_KEYS`. End-to-End: `e2e/diagnose.js`.

**Duplizieren** (`features/duplicate.js`) — neue Standards entstehen aus
bestehenden. Ausführlich in
[`docs/KONZEPT-DUPLIZIEREN.md`](docs/KONZEPT-DUPLIZIEREN.md). Fünf Zusagen:

1. **vollständig unabhängig in beide Richtungen** (spätere Änderungen am
   Original wirken nicht auf die Kopie und umgekehrt),
2. **effektiver statt roher Stand** — Name/Menge/Größen/Kategorie/
   Unterkategorie werden über `qeGet`/`effNatur`/`rawUk` aufgelöst und
   eingefroren; material-WEITE Regeln bleiben bewusst wirksam (über den
   `material_key`), damit die Kopie nicht von der Materialpflege abgeschnitten wird,
3. **echtes Löschen** statt Ausblenden,
4. **keine Geschichte** (Häkchen, Nutzung, Favoriten, Prüf-Vermerke und
   insbesondere Version/Freigabe bleiben zurück — eine Kopie ist ein Entwurf),
5. **Vorlagen-Rubriken werden aufgelöst**, sonst schlüge ein Löschen in der
   Kopie auf fremde Standards durch.

Schlüssel-Änderung dafür: `newStdToObj` baute bisher ein FESTES Zwei-Rubriken-
Gerüst — ein eigener Standard konnte gar keine beliebige Struktur tragen. Jetzt
trägt ein `NEWSTD`-Datensatz optional eigene `rubriken` (`__eigenStruktur`);
ohne bleibt alles wie gehabt. Erst dadurch ist echtes Löschen in der Kopie
möglich. Standards mit eigener Struktur bekommen keine Vorlagen-Rubriken mehr
automatisch dazu (sonst stünde dieselbe Rubrik zweimal da und Löschen hielte nicht).

Weil Kennungen positionsabhängig sind (`<std>|<rubrik>|<abschnitt>|<index>`),
zieht `dupCidShift` beim echten Löschen alle Overlay-Töpfe nach (`QE.cid`,
`overrides`, `reassign`, `reviewed`, `checks`, Arzt-Varianten) — sonst klebten
Anpassungen am falschen Eintrag. Nebenbei aufgeräumt: `rubKey`/`rubName`/
`rubHidden`/`rubOrd` hingen implizit an `curStd` und nehmen jetzt einen
optionalen `std`-Parameter (ohne ihn unverändert). End-to-End:
`e2e/duplizieren.js`.

## Facettierte Übersicht (`hkl_facetten`)

Die Startseite war eine Liste von 47 Titeln mit Bindestrichen
(`Transfemoral - Edwards - SAPIEN 3 Ultra`). Die Merkmale stehen darin längst —
aber als Fließtext, aneinandergehängt. Man kann sie lesen, aber nicht danach
greifen.

`features/facetten.js` zerlegt den Titel und macht die Teile auswählbar. **Im
Quelltext steht dabei kein Fachwort**; die Bedeutung kommt aus Daten, die die
Verwaltung selbst pflegt:

| Merkmal | Quelle |
|---|---|
| Bereich | die vorhandene Gruppe des Standards |
| Hersteller | ein Titelteil, der in der **konfigurierbaren** Herstellerliste steht (`bezeichnungen.json`) — steht ein Lieferant nicht darin, ist sein Name ein Merkmal wie jedes andere; geraten wird nichts |
| Art | der erste verbleibende Titelteil |
| Ausprägung | die weiteren Titelteile |
| Freigabe | `frgStatus` (siehe oben) |

Auch die **Namen** der Merkmale sind nur Vorgaben (`bezWert('facetten', …)`) und
über die Bezeichnungen änderbar — „Art" heißt im TAVI-Bereich vielleicht besser
„Zugang".

Getrennt wird nur an einem Strich mit **Leerraum an mindestens einer Seite**.
Das trifft `Transfemoral - Edwards` und auch `LAA- Abbott`, aber nie `Re-PVI`,
`S-ICD`, `CRT-D`, `Mitra-Clip` oder `Event-Recorder`.

`facBauen` ist echte Facettensuche: Die Zähler einer Merkmalsart rechnen ohne
die eigene Auswahl (sonst käme man nie zu einem anderen Bereich zurück), und
eine Auswahl, die auf null führt, wird gar nicht erst angeboten. Gemessen:
`{}` → 47, `TAVI` → 5, `+Transfemoral` → 3, `+Edwards` → 1.

Die Auswahl ist eine **Ansicht**, kein Inhalt — sie bleibt gerätelokal
(`hkl_facetten`, nicht in `SHARED_KEYS`). Damit später niemand einen Standard
„vermisst", steht über der Liste immer sichtbar, wie viele von wie vielen übrig
sind, mit einem Knopf zum Zurücksetzen; ein leeres Ergebnis bietet denselben
Knopf an. Tests: `test/facetten.test.js` (23), End-to-End: `e2e/facetten.js`.

## Freigabe mit Siegel (`STDE[sid].siegel`)

Ein Standard konnte schon vorher „Version 1.2 · Freigegeben · durch X am Y"
tragen. Das ist genau so lange richtig, wie danach niemand etwas ändert — und
geändert wird ununterbrochen: eine Menge im Schnellmenü, eine Regel mit
Reichweite „🌐 alle", ein Baustein, der acht Standards auf einmal anfasst.
Damit stand im Kopf des Standards ein Vermerk, der etwas bestätigt, das es so
nicht mehr gibt.

`features/freigabe.js` zieht bei der Freigabe ein **Siegel**: je Zeile ein
Fingerabdruck der **wirksamen** Werte (Name, Menge, Größen, Spezifikation,
Kategorie, Unterkategorie — also nach `qeGet`/`effNatur`/`canonUk`), dazu die
Rubriknamen und ihre Reihenfolge. Gespeichert wird `<8-Hex> <Kurztext>` je
Zeile; der Kurztext ist nötig, um auch **entfernte** Zeilen benennen zu können.
Gemessen am heutigen Bestand: 4.769 Zeilen, **207 KB** für alle 47 Siegel
zusammen, größtes Einzelsiegel 6 KB, Aufbau 14 ms (Grenze `MAX_BODY`: 32 MiB).

`frgStatus` liefert einen von fünf Zuständen:

| Zustand | Bedeutung |
|---|---|
| `ohne` | kein Vermerk gepflegt — die App behauptet nichts |
| `entwurf` | Vermerk vorhanden, nicht freigegeben |
| `gueltig` | freigegeben und inhaltlich unverändert |
| `ueberholt` | freigegeben, seither geändert (auch: „Freigegeben" **ohne** Siegel — der Altbestand) |
| `abgelaufen` | `validTo` verstrichen |

`frgAbgleich` vergleicht als Multimenge und liefert `neu` (mit cid → anspringbar),
`weg` (mit Kurztext) und `reihenfolge`. Der Zustand steht **ohne
Verwaltungsrechte** im Kopf des Standards und als Zeichen in der Übersicht —
ein Vermerk, den nur die Leitung sieht, schützt niemanden.

Das Siegel ist **keine Unterschrift im Rechtssinn und kein Zugriffsschutz**: Es
ist im Browser gerechnet und liegt im geteilten Zustand (`hkl_stdedits`, also
schon in `SHARED_KEYS`/`BACKUP_KEYS`). Es beantwortet eine einzige Frage, die
vorher niemand beantworten konnte: *Ist das noch der Stand, der freigegeben
wurde?* Die technische Absicherung des Zugangs (Stufe 0) bleibt davon unberührt.

Tests: `test/freigabe.test.js` (23), End-to-End: `e2e/freigabe.js`.

## Bausteine — wiederkehrende Handlungsfolgen (`hkl_bausteine`)

Die 47 Standards sind aus voneinander abgeschriebenen Word-Dateien entstanden.
Die naheliegende Gegenmaßnahme wäre „Rubrik-Vorlagen" — die Messung widerlegt
das: Auf Rubrik-Ebene liegt die Überschneidung bei 12–24 %, oft bei 0–2
gemeinsamen Zeilen. Die Wiederholung sitzt eine Ebene tiefer, in
**zusammenhängenden Folgen von Zeilen**: 1.345 von 2.375 Materialzeilen stecken
in einer Folge, die in mindestens drei Standards gleich vorkommt; der
Suchlauf (`bauKandidaten`) liefert am heutigen Bestand **43 überschneidungsfreie
Folgen** mit zusammen **823 doppelt gepflegten Zeilen**.

Ein Baustein (`features/bausteine.js`) hat deshalb zwei getrennte Teile:

| Feld | Bedeutung |
|---|---|
| `schluessel` | Vergleichsform der Original-Zeilen, **eingefroren** → daran werden die Fundstellen wiedergefunden |
| `zeilen` | der gewollte Inhalt (Text, Menge, `weg`) → das, was gepflegt wird |

Weil der Schlüssel eingefroren ist, verliert ein Baustein seine Fundstellen
nicht, wenn man eine Zeile umbenennt.

**Die Wirkung läuft über `QE.cid`** — dieselbe Ablage wie das Schnellmenü; es
gibt keine vierte Auflösungsebene und keine Änderung an den Basisdaten.
`bauAnwenden` gleicht jede Fundstelle an den Baustein an und merkt sich zu jedem
Feld, was **vor dem ersten Zugriff des Bausteins** dastand
(`gesetzt[cid][feld].alt`). `bauLoesen` stellt genau das wieder her — auch
fremde Eintragungen, die durchgesetzt worden sind. Wer NACH dem Baustein von
Hand ändert, überschreibt dessen Wert, nicht den Originalzustand; „Lösen" führt
dann auf den Original zurück (dieser Speicher führt keine Historie).

`bauAbweichungen` listet die Stellen, an denen der Bestand vom Baustein
abweicht — nicht jede ist ein Fehler, aber jede muss auffallen. Das Schnellmenü
warnt vor einer Änderung, wenn die Zeile zu einem Baustein gehört.
`bauEinfuegen` legt die Zeilen als Ergänzungen (`hkl_additions`) in einem
Standard an — der schnelle Weg, einen neuen Standard aufzubauen, statt ihn
abzuschreiben.

Der Suchlauf ist teuer (n-Gramme über den ganzen Bestand, ~300 ms) und läuft
deshalb **nicht beim Start**, sondern erst beim Öffnen der Ansicht; das Ergebnis
liegt bis zur nächsten Datenänderung im Zwischenspeicher (`bauCacheLeeren`,
u. a. aus `rebuildDB`). Tests: `test/bausteine.test.js` (33), End-to-End:
`e2e/bausteine.js`.

## Funktionsregister — Menü und Verwaltungs-Karten (`hkl_funktionen`)

`public/js/features/funktionen.js`. Antwort auf die Vorgabe „alles muss ohne
Programmierung anpassbar sein — auch Funktionen hinzufügen und wegnehmen"
(docs/GRUNDSAETZE.md, Regel A7).

**Menü.** `FKT_MENUE` ist die Vorgabe: je Punkt ein `key` (trägt die
Bedeutung), dazu `ico`/`label`/`sub` (Bezeichnungen, frei änderbar), `tun` (der
Aufruf), `nur` (`alle`/`admin`/`gast`) und optional `fest:true`.
`fktMenueListe(istAdmin)` löst das mit den eigenen Änderungen auf und sortiert.
`openMenu()` (core/app-state.js) rendert nur noch diese Liste; der eingebaute
Rückfall greift, wenn das Modul fehlt.

**Verwaltungs-Karten.** Der Schlüssel wird aus der Karten-Überschrift gewonnen
(`fktSlug` über `.vp-title`). Das ist Absicht: So erfasst das Register **jede**
Karte, auch neu hinzukommende, ohne dass an einem Dutzend Baustellen ein
Schlüssel nachgetragen werden muss. `renderAdmin()` ruft am Ende
`fktPanelAnwenden($('scr-admin'))` — ausblenden, umbenennen, umsortieren
(letzteres nur innerhalb des jeweiligen Themenblocks).

**Die Bearbeiten-Menüs (⋯).** Das meistbenutzte Menü der App — Grundsatz ⑥ —
läuft über denselben Weg. `quickmenu.js` baut die drei Menüs (`eintrag`,
`standard`, `rubrik`) nicht mehr durch String-Anhängen, sondern über einen
**Sammler**: `sheetBauer('<bereich>')` → `S.gruppe(key, titel, sub)` /
`S.akt(key, ico, label, sub, fn, cls)` → `S.html()`. Der Sammler wendet
ausblenden · umbenennen · Symbol · Reihenfolge an, kennt einen Schalter für
ganze Gruppen (`sheetgruppe`) und rendert bei komplett leerem Menü einen
Hinweis samt Weg zurück statt einer leeren Fläche.

Sortiert wird **nur innerhalb einer Gruppe** — sonst rutschte „Endgültig
löschen" unter „Inhalt" und die Gefahrenzone wäre keine mehr.

`FKT_SHEET_KATALOG` in `funktionen.js` führt alle Aktionen mit ihren
Auslieferungswerten, damit die Verwaltung sie auch anzeigen kann, ohne dass ein
Menü offen ist. Damit der Katalog nicht still veraltet, gleicht
`test/funktionen.test.js` ihn **maschinell gegen den Quelltext von
quickmenu.js** ab — in beide Richtungen, Gruppen inklusive Reihenfolge. Ein
neuer Menüpunkt ohne Katalogeintrag lässt die Tests durchfallen.

Fällt `funktionen.js` aus, liefert `sheetBauer` in `quickmenu.js` einen
Rückfall-Sammler ohne Einstellungen — die Kern-Bedienung hängt nie an einer
Komfortfunktion.

**Kopfleiste.** `FKT_KOPF` deckt die drei Symbole oben rechts ab (Lupe,
GitHub-Anmeldung, Hell/Dunkel); `fktKopfAnwenden()` läuft beim Start
(`main.js`, nach dem Laden des geteilten Zustands) und nach jedem Sync. `☰`
und „Zurück" sind nicht erfasst — ohne sie käme man nirgendwo mehr hin.

**Merkmalsleiste.** Jede Art aus `FAC_ARTEN` ist einzeln abschaltbar
(`fktFacetteAus`, Bereich `facette`). Eine ausgeblendete Art mit **aktiver
Auswahl** bleibt sichtbar — sonst wirkte ein Filter unsichtbar weiter.

**Eigene Punkte.** `FKT.eigene[]` mit `art` ∈ `standard` · `bildschirm` ·
`seite` · `adresse`. Bewusst nur diese vier: Ein frei eingebbarer Funktionsname
wäre eine offene Tür in den Quelltext; `adresse` lässt nur `http(s)://` zu.

**Grenze.** `verwaltung`, `anmelden`, `abmelden` und `melden` sind `fest` — wer
sie ausblenden könnte, sperrte sich mit einem Tipp selbst aus.

**Bewusst NICHT erfasst:** die Knöpfe *innerhalb* eines Formulars
(Abbrechen · Speichern · Zurück · Schließen). „Speichern" ausblenden zu können
wäre keine Freiheit, sondern eine Falle — das Formular ließe sich öffnen, aber
nicht abschließen.

**Bereiche im Speicher `hkl_funktionen`:** `menue` · `panel` · `sheet` ·
`sheetgruppe` · `facette` · `kopf` · `eigene[]`. Geteilt über SHARED_KEYS +
`hydrateVars`, gesichert über `BACKUP_KEYS`.
Tests: `test/funktionen.test.js` (18), End-to-End: `e2e/funktionen.js` (29).

## Bilder überall (`/api/media`, `hkl_medientexte`, `hkl_medienanker`)

`server/media.js` + `server/routes/media.js` + `public/js/features/medien.js`.

**Warum getrennt vom Zustand.** `/api/state` überträgt bei jeder Änderung den
ganzen geteilten Zustand. Für Text richtig, für Bilder eine Sackgasse: ~250 KB
je Foto, ~4.500 Zeilen, `MAX_BODY` 32 MiB. Deshalb liegen Bilder als einzelne
Dateien unter `STATE_DIR/media`; im Zustand steht nur die Kennung.

**Kennung = Inhalts-Fingerabdruck** (SHA-256, 32 Hexstellen). Daraus folgt
ohne Zutun: Dubletten kosten keinen Platz, die Auslieferung darf
`immutable` cachen, und zwei Geräte können nicht dieselbe Nummer vergeben.

**Endpunkte.** `POST /api/media` (Rumpf = Bilddaten, `Content-Type` = Art;
201 neu / 200 schon da) · `GET /api/media/<kennung>` · `GET /api/media`
(Bestand) · `DELETE /api/media/<kennung>`. Erlaubt sind JPEG/PNG/WebP/GIF —
**kein SVG** (ausführbares Markup von eigener Herkunft). Grenze je Bild
`MAX_MEDIA` (8 MiB).

**Client.** Bilder sind eine Eigenschaft `bilder` der Zeile und laufen deshalb
über dieselbe Reichweiten-Treppe wie Name und Menge (`sheetPending` →
`applyPending`) — 📍 Stelle · 📄 Standard · 🗂 Gruppe · 🌐 alle, journaliert und
rücknehmbar. Anzeige als Streifen unter der Zeile (`medStreifenHTML`, aus
`ui/detail.js`), Pflege im Bearbeiten-Menü (`sheetGo('bilder')`).
Bildunterschriften liegen je Kennung in `hkl_medientexte` — eine Kennung, eine
Unterschrift, überall gleich.

**Ohne Netz.** Aufnahmen warten in IndexedDB (`hkl-medien`) und gehen bei
`online` bzw. beim Start hoch. Der Service Worker cacht `/api/media/…`
cache-first (die einzige Ausnahme von „`/api` nie cachen" — die Adresse ist
unveränderlich). GIFs gehen ungerendert durch, sonst bliebe vom Bewegtbild nur
das erste Einzelbild.

Tests: `test/server.test.js` (10 Fälle), End-to-End: `e2e/medien.js` (17).


**Anker — Bilder an Stellen, die kein Eintrag sind.** `hkl_medienanker` ist ein
flacher Speicher nach Ankerschlüssel:

```
std:<sid>  ·  rub:<sid>|<ri>  ·  uk:<sid>|<ri>|<name>  ·  seg:<sid>|<ri>|<name>
```

Der Anker ist bewusst eine Zeichenkette: Eine weitere Stelle braucht keinen
neuen Speicher. Diese Stellen haben keine Kaskade — sie *sind* jeweils genau
eine Stelle.

**Größe je Stelle.** Ein Bild trägt seine Größe nicht in sich. Die Liste
speichert `{k, g}` mit `g ∈ {klein, mittel, gross}`; `medPaare()` liest auch die
alte flache Form `['<kennung>', …]` und vergibt die Vorgabegröße. Kein
Migrationslauf.

**Antippen macht groß.** Jedes Bild trägt `data-zoom`; `initLightbox()` fängt
den Klick zentral ab. `openLightbox(src, caption, details)` zeigt die Angaben
zum Bild unter dem Bild.

## Merkmale an Standards (`hkl_eigenschaften`, `hkl_stdeigen`)

Ein Eingriff ist gleichzeitig sedierungspflichtig, Rechtsherz und Implantat —
ein Baum kann das nicht. Deshalb **Facetten**: zwei getrennte Speicher, die
Definition (`hkl_eigenschaften`) und die Vergabe (`hkl_stdeigen`).

```
{ key, wort, symbol, farbe, art:'ja'|'wert'|'auswahl', werte[],
  zeigen:'kopf'|'still', alsReichweite:bool, ord }
```

Der **Schlüssel ist unveränderlich**: Wer das Wort korrigiert, verliert seine
Vergaben nicht. Gezählt wird immer mit „ohne Angabe" (`eigBilanz`).

Merkmale mit `alsReichweite` erscheinen in der Reichweiten-Treppe als
`wo:{art:'eigenschaft', wert:key}` — Rang 2, gleichauf mit `gruppe`.

## Reichweite und Prüfblatt (`features/reichweite.js`)

`rwStufen(cid, mk)` ist die **eine** Treppe, die Formular und Schnellmenü
gemeinsam benutzen. Jede Stufe trägt zwei Sprachebenen (`wort`/`sub` für
Chips, `lang`/`langSub` fürs Menü) und ihre Trefferzahl.

`pbOeffnen(cid, aenderungen, voreinstellung, fertig)` zeigt vor dem Speichern
je Änderung *vorher → nachher* und ihre **eigene** Reichweite. `pbSpeichern()`
schreibt je Zeile genau eine Regel mit deren Reichweite.

## Standardkopf als Bauplan (`hkl_stdkopf`)

`KOPF_BAUSTEINE` listet zehn Bausteine mit `tun(s)` → HTML. `stdKopfHTML(s)`
setzt sie in der eingestellten Reihenfolge zusammen; ein Baustein ohne Inhalt
erzeugt kein Markup. Gepflegt in der Verwaltung („🪧 Standardkopf").

## Schrift und Auszeichnung (`features/textstil.js`)

Zeilenstil (`{g,f}`) läuft als Eigenschaft `stil` über die normale Kaskade.
Wort-Auszeichnungen sind Zeichenpaare aus `bezeichnungen.json` → `auszeichnungen`.
`txsText()` entschärft **zuerst** (`esc`) und ersetzt **danach** — die Zeichen
selbst gehen ebenfalls durch `esc`, sonst fände ein Paar wie `<<…>>` nie etwas.

## Bereiche — zweite Sicht aufs Material (`hkl_bereiche`)

Dritte Achse neben `natur` (was) und `unterkategorie` (wo im Standard):
`bereich` sagt **wohin** — steriler Tisch, Umfeld. Läuft als normale
Eigenschaft über die Kaskade. In der Rüstliste umschaltbar
(`ruestSicht = 'ablauf' | 'bereich'`, gerätelokal).

## Alternativen (`hkl_altgruppen`, `hkl_zweige`)

**Austauschgruppen** sind geordnete Listen von Materialien (Rang 1 = Standard),
verknüpft über den kanonischen Schlüssel (`effMatKey`). Angezeigt an jedem
Glied als Chip.

**Verfahrenszweige** hängen an einem Abschnitt: `ZWG[sid|ri] = {wort, zweige[],
abschnitte:{name:zweigKey}}`. Die Wahl (`hkl_zweigwahl`) ist **gerätelokal** —
sie gilt für den Fall, der heute läuft. Ohne Wahl sind alle Zweige sichtbar.

## Fassungen (`hkl_fassungen`)

Festschreiben friert den wirksamen Stand eines Standards ein; er tritt an die
Stelle der Quelldatei. In `ruleCandidates` liegt die Fassung auf **Rang 0** —
unter jeder echten Reichweite, über der Datei. Die beteiligten Regeln werden
zurückgenommen (eingearbeitet); die ganze Fassung bleibt verwerfbar.

Die Quelldatei wird nie verändert (Grundsatz ⑦).

## Pflege-Weg (`hkl_pflegeschritte`, `hkl_pflegeeigen`, `hkl_pflegestand`)

Klammer um vier vorhandene Werkzeuge (Aufräum-Assistent, Material-Editor,
Etikett-Erfassung, Foto-Galerie). Baut nichts davon neu — führt sie in einer
Abfolge vor und bringt jedes an die Stelle zurück, an der man war.

**Einheit ist das Material**, nicht die Zeile und nicht der Text: `pfMaterialien()`
gruppiert den Bestand nach dem kanonischen Schlüssel (`effMatKey`) und hängt an
jedes Material seine Vorkommen (`stellen`), die rohen Wortlaute (`roh`) und die
noch nicht entschiedenen Textschlüssel (`texteOffen`).

**Schritte** stehen in `PF_SCHRITTE` mit `offen(m)` / `stand(m)` / `tun(m)`.
Der Code kennt nur die Prüfung; Wort, Untertitel, Symbol, Reihenfolge und
an/aus liegen in `hkl_pflegeschritte` (`pflWert`/`pflAus`/`pflSetzen` — dieselbe
Bauart wie `features/stdkopf.js`). Eigene Schritte (`hkl_pflegeeigen`) sind
reine Handhaken (`art:'hand'`).

**Gespeichert wird nur, was sich nicht ablesen lässt** (`hkl_pflegestand`,
je kanonischem Schlüssel): `entfaellt{schritt}` (Entscheidung des Menschen),
`hand{schritt}` (Haken eigener Schritte), `fertig` (von Hand abgeschlossen).
„Erledigt" kommt sonst immer aus den Daten — `pfSchrittZustand()` liefert
`offen` · `fertig` · `entfaellt`.

**Der Rückweg** ist der kritische Teil: `pflegeLaeuft()` / `pflegeRueckkehr()`
werden von `scanZurueck()` (Herkunft `'pflege'`), von `saveScanItem()` und vom
Aufräum-Assistenten (`cleanupRueckweg()`) aufgerufen. Der Assistent läuft dabei
auf **einen** Text eingeengt (`cleanupFokus`). `reRenderDetail()` kennt
`scr-pflege` als dritten Kontext, damit das ⋯-Menü (Bereich) von dort aus
funktioniert.

## Ankreuzen statt Abtippen (`features/ankreuzen.js`)

Mehrfach-Wähler in jeder Rubrik. Die Liste kommt aus dem BESTAND, passend zur
Sorte der Rubrik (`ankSorte`): Material/Geräte → der kanonische Materialbestand
(`pfMaterialien()`) plus die Katalog-Positionen, die es dort noch nicht gibt;
Ablauf/Sonstiges → die Zeilentexte der Ablauf-Rubriken, über `bauSlug`
zusammengefasst. Sortiert nach Häufigkeit, gecacht je Sorte
(`ankCacheLeeren()` hängt an `invalidateMatCaches()` und `hydrateVars()`).

Eingefügt wird über `makeAddEntry` — derselbe Weg wie im Formular. Der
Materialschlüssel entsteht dabei aus dem Namen, also trägt der neue Eintrag
denselben wie sein Vorbild; Foto, Maße und Preis hängen sofort mit dran.

Die frühere Einzel-Übernahme (`startAdoptCatalog` / `adoptCatalogItem`) ist
ersatzlos entfernt: eine Position pro Tipp, und nur aus dem Katalog.

**Bausteine beim Anlegen eines Standards** (`bauInStandard` in
`features/bausteine.js`): Jeder Baustein kennt seine Heimatrubrik (`b.rubrik`)
und landet dort. Fehlt sie im frischen Standard, legt
`stdRubrikSicherstellen()` (`ui/forms.js`) sie an — mit der Art, die
`bauRubrikTyp()` an den Zeilen abliest. Ohne Heimat geht der Baustein in die
erste Rubrik statt verloren (Grundsatz ②).

## Reihenfolge ziehen (`features/sortieren.js`)

Zweite, ruhige Ansicht derselben Rubrik (`sortRi` = Rubrik-Index, `null` = aus).
`openRubrik()` zweigt ganz oben dorthin ab; die Eintragszeile ist schon
dreifach belegt (tippen = abhaken, halten = ⋯-Menü, eigene Schalter), ein
viertes Verhalten darauf wäre ein Ratespiel.

`sortGruppen(idx)` bildet genau die Einheiten, die EINE gespeicherte
Reihenfolge haben: bei Material/Geräten die Unterkategorie
(`collectGroupCids`), sonst der Abschnitt (`ablaufSegments`). Über eine
Gruppengrenze hinweg lässt sich deshalb nichts ziehen — das wäre ein Wechsel
der Unterkategorie bzw. ein Verschieben, nicht eine Sortierung.

Gezogen wird über Zeiger-Ereignisse mit echtem `insertBefore`; am Ende wird die
DOM-Folge abgelesen und über `sortSchreiben()` nach `ENTORD` geschrieben.
**Die Ereignisse hängen am `document`, nicht am Griff:** Ein Knoten, der beim
Ziehen umgehängt wird, verliert seine Zeigerbindung (`setPointerCapture`, bei
Berührung die stillschweigende Bindung) — danach käme kein `pointerup` mehr an,
der Zug endete nie und nichts würde gespeichert.

Die reine Umordnung (`sortVerschieben`, `sortRang`) ist ohne Bildschirm
testbar. `sortBeenden()` räumt den Modus beim Verlassen der Rubrik still auf
(aus `setMode()` und `openStandard()`) — er ist ein Arbeitszustand wie ein
offenes Formular, kein Merkmal der Rubrik.

## Wer räumt welchen Zwischenspeicher? (Systemanalyse 06.08.2026)

Der teuerste Fehler dieser Art war unsichtbar: `buildMaterialIndex()` verwarf
den **Zerlegungs-Speicher** (`matKeyCache` in `features/matkey.js`) und rechnete
danach die Zerlegung aller 4.475 Zeilen neu. Die Funktion läuft nach fast jedem
Speichern — **gemessen 300 ms** auf einem schnellen Rechner, also gut eine
Sekunde auf dem Tablet im Saal. Nach der Umstellung: **2,8 ms**.

Der Vertrag lautet jetzt:

| Speicher | hängt an | wird geräumt in |
|---|---|---|
| `matKeyCache` / `matKeyZerlCache` / `matKeyAltCache` | **Positionen** (nach `cid` indiziert) und `ZERLDB` | `rebuildDB()` · `zerlBestaetigen()` / `zerlVerwerfen()` · `hydrateVars()` |
| `matStdMapCache`, `mcRowCache`, `mcEntryCache`, `pfCache`, `ankCache` | dem abgeleiteten Bestand | `invalidateMatCaches()`, also bei jedem `buildMaterialIndex()` |
| `bauVorkCache`, `frgCache` | dem Bestand | `rebuildDB()` |

Eine Regel, ein Preis oder ein Häkchen ändern die **Zerlegung** nicht — nur die
abgeleiteten Listen. Deshalb gehören die beiden Gruppen auseinander.
`e2e/ausbau.js` hält den Vertrag fest: Nach einer Löschung, die alle folgenden
Zeilen verschiebt, muss der gecachte Schlüssel dem frisch gerechneten gleichen.

## Sechste Maschinenprüfung: Verdrahtung

`scripts/pruefungen/verdrahtung.js` (in `npm run check`) prüft vier Dinge, bei
denen **nichts kaputtgeht** — es passiert einfach nichts:

1. **Doppelte globale Namen** — alle Module teilen einen Namensraum; die
   spätere Definition gewinnt lautlos. Duldet nichts.
2. **Schaltflächen ohne Ziel** — `onclick="machWas()"` ohne `machWas()`.
   Duldet nichts.
3. **Funktionen ohne Verwendung** — zweimal war das hier keine tote Last,
   sondern eine *vergessene Verdrahtung* (`pbScopeAlle`, `merkAbdeckung`).
   Ratsche über `altlasten.json → toteFunktionen`.
4. **Speicher-Schlüssel ohne Geräte-Teilung** — was nicht in `SHARED_KEYS`
   steht, wirkt nur auf einem Gerät. Wer das will, begründet es in
   `altlasten.json → geraetelokal`; eine Begründung ohne Schlüssel meldet
   sich ebenfalls.

## Bekannte Altlasten / bewusste Kompromisse

- `esc()` escaped seit dem QA-Fix (P2) auch `'` (`&#39;`) — die frühere
  Apostroph-Fehlerklasse ist damit an der Wurzel entschärft. Die Regel gilt
  als Defense-in-depth trotzdem weiter: Freitext nicht direkt in
  `onclick`-String-Literale interpolieren — IDs/Indizes übergeben oder
  `data-`-Attribute nutzen (Beispiele: `moveGroup(i,…)`, `toggleUk(this.dataset.k)`).
- Der Passwort-Schutz (`core/config.js`) ist Komfort-, keine echte
  Sicherheitsfunktion (djb2-Hash im geteilten Zustand); die App ist für den
  internen Gebrauch hinter vertrauenswürdigem Netz gedacht.
- Kein Auth am `/api/state`-Endpunkt — gleiche Begründung.
