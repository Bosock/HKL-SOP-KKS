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

- `npm run check` (`scripts/check.js`, keine Abhängigkeiten): `node --check`
  über alle projekteigenen `.js`-Dateien **und** Abgleich, dass die `SHELL`-
  Liste in `public/sw.js` und die `<script>`-Tags in `public/index.html`
  dieselben Module führen. Fängt die zwei Fehlerquellen ab, die kein Unit-Test
  sieht (Syntaxfehler, auseinandergelaufene Offline-Liste). Läuft in CI vor den
  Tests. Praktische Anleitung für Mitpflegende: [CONTRIBUTING.md](CONTRIBUTING.md).
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
Geschwister derselben Klasse (⭐ Favorit in der Übersicht, 🔗 Produkt-Verweis
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
