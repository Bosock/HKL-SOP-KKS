# System-Audit: HKL-SOP-KKS — Ganzheitliche Kohärenz-, Sinnhaftigkeits- und Strukturprüfung

| | |
|---|---|
| **Erstellt** | 2026-07-16, 21:21 UTC |
| **Geprüfter Stand** | Branch `claude/github-oauth-connect-ljdxp2`, Commit `97c0836` (= main `83b28ec` + PR-#2-Fixes) |
| **Sofort-Korrekturen aus diesem Audit** | Commit `676dd36` (NUL-Byte, Apostroph-sichere onclick-Handler, Foto-Verkleinerung, Doku-Drift) |
| **Was dieser Bericht abbildet** | Vollständige Analyse von Frontend (`public/`), Backend (`server/`), Service Worker, Tests, CI/CD, Deployment und Dokumentation — Architektur, Kohärenz, Sinnhaftigkeit, Struktur, Logik, Vollständigkeit, Prozesse, Nutzerperspektive, Wartbarkeit, Skalierung, Robustheit, Sicherheit, Performance, Eleganz, Zukunftssicherheit |
| **Methode** | Vollständige Quelltext-Lektüre aller Module; Metriken (LOC/Bytes, globale API-Fläche, Handler-Zählung); Live-Verifikation gegen laufenden Server (Playwright: Zwei-Geräte-Sync über alle 12 State-Module, 413-Pfad, Apostroph-Härtetest, Foto-Verkleinerung, Druck-Export); Datenanalyse der Quelldaten (478 material_keys, Zeichenklassen); Abgleich Doku ↔ Code |
| **Prüfer** | Claude Code (automatisiertes interdisziplinäres Audit); Faktenbasis: ausgeführte Tests & Messungen. Annahmen sind als solche gekennzeichnet |

---

## 1. Executive Summary

HKL-SOP-KKS ist ein **bewusst minimalistisches, offline-fähiges Klinik-Werkzeug** mit einer für seine Größe ungewöhnlich guten Engineering-Disziplin: null Abhängigkeiten, 162 automatisierte Tests gegen den echten Server, mechanische Selbstprüfung (`npm run check`), atomare Persistenz mit rotierenden Snapshots, saubere Security-Header und eine ehrliche, aktuelle Dokumentation inklusive dokumentierter Kompromisse. Die Architekturidee — statisches Frontend + winziger State-Server mit Top-Level-Key-Merge — ist dem Problem angemessen und konsequent umgesetzt.

Dem stehen **drei strukturelle Schwächen** gegenüber:

1. **Sicherheit (größtes Risiko):** `/api/state` ist ohne jede Authentifizierung **öffentlich beschreibbar** (die App läuft unter `https://sops.kardio.wiki`). Jeder Internet-Teilnehmer kann den gesamten geteilten Zustand lesen (inkl. des schwachen djb2-Passwort-Hashes `hkl_authpw`) und überschreiben. Die Snapshots begrenzen den Schaden (Wiederherstellung möglich), verhindern ihn aber nicht. Die Doku deklariert das als bewussten Kompromiss „für vertrauenswürdiges Netz" — **diese Annahme ist durch die öffentliche Erreichbarkeit faktisch verletzt.**
2. **Struktur-Drift:** Das größte Frontend-Modul (`backup.js`, 25 KB) heißt „Datensicherung", enthält aber die gesamte Verwaltungsansicht. Der wachsende globale Namensraum (312 Funktionen, 57 Top-Level-Variablen, 27 geteilte Schlüssel) ist bei aktueller Größe beherrschbar, wird aber pro neuem Feature teurer.
3. **Skalierungs-Hypothek Fotos:** Material-Fotos liegen als Base64 im geteilten JSON-Blob; jede Änderung an *irgendeinem* Foto/Lagerort überträgt *alle* Fotos an *alle* Geräte. Die im Audit umgesetzte Client-Verkleinerung (Faktor ~20–50 pro Handyfoto) entschärft das praktisch; das Architekturmuster bleibt der limitierende Faktor.

**Gesamturteil: 72/100** — solide, wartbar, dem Zweck angemessen; mit einem klar priorisierten Handlungsbedarf (API-Schreibschutz) und gut abgegrenzten mittelfristigen Aufräumarbeiten.

---

## 2. Bewertungen (0–100, begründet)

| Dimension | Wert | Begründung (Kern) |
|---|---|---|
| Kohärenz | **82** | Durchgängige Muster (Overlay-Prinzip, `save*`-Konvention, deutsche Domänensprache); Abzüge: Modulname ≠ Inhalt (`backup.js`), totes `baseRev`-Feld im Sync-Protokoll, im Audit behobene Doku-Drift |
| Architektur | **78** | Zwei klar getrennte Schichten, Zero-Dep als bewusste und konsequent durchgehaltene Entscheidung; Routen-Registry, Ein-Zweck-Servermodule. Abzug: implizites Modulsystem (Script-Reihenfolge) als tragende Wand |
| Struktur | **74** | Server vorbildlich; Frontend-Ordnerlogik gut, aber `backup.js`/`ui/admin.js` vertauscht Verantwortung, `app-state.js` ist ein Sammelbecken (20 KB, ~30 Zuständigkeiten) |
| Modularität | **70** | Kein echtes Modulsystem (bewusst, wegen alter Tablets + onclick-Attributen); mechanisch abgesichert durch `check.js`. Kopplungsrisiko wächst linear mit Featurezahl |
| Verständlichkeit | **80** | Hervorragende deutsche Kommentare mit *Warum*-Begründungen, ARCHITECTURE/CONTRIBUTING einzigartig gut für Projektgröße; Abzug: extrem dichte Einzeiler (bis 480 Zeichen) erschweren Diffs & Debugging |
| Wartbarkeit | **75** | 162 Tests, CI-Gate, Selbstcheck, ausgezeichnete Doku; Abzug: Zeilendichte, globale API-Fläche, `prompt()`-basierte Editoren an ~15 Stellen (schwer erweiterbar) |
| Skalierbarkeit | **55** | Voll-State-Sync ohne Delta; ganzer Zustand im RAM + als eine Datei. Für die Zielgröße (Klinikteam, ≤ ~50 Geräte) unkritisch — Messwert: State-Roundtrip < 20 ms lokal. Bei 1 000+ aktiven Geräten bräche das Modell (Polling × Blobgröße) |
| Sicherheit | **45** | Stark: CSP/HSTS/Permissions-Policy, HMAC-Sessions, CSRF-State, Traversal-Schutz (verifiziert), kein eval. Schwach: **öffentlich beschreibbares `/api/state` ohne Auth**, djb2-Passwort-Hash im lesbaren State, `unsafe-inline` (durch Design erzwungen, dokumentiert) |
| Performance | **78** | gzip+ETag/304 (verifiziert), Debounce+Backoff-Sync, Re-Render-Vermeidung (PR #2); Voll-Re-Render-Muster ist bei DOM-Größe der App unproblematisch. Fotos waren der Engpass → im Audit behoben |
| Benutzerfreundlichkeit | **76** | Mobile-first, klare deutsche Oberfläche, Checklisten mit Tagesreset, globale Suche, Glossar, Vorschlagswesen; Abzüge: `prompt()`-Dialoge (inkonsistent zum Formularsystem), kein Undo-Verlauf, Verwaltungsseite sehr lang |
| Robustheit | **80** | Offline-first mit lokalem Fallback (verifiziert), atomares Persistieren, Snapshots, exponentielles Retry, 413-Pfad sauber (PR #2), toleranter SW-Precache, SPA-Fallback; Abzug: keine Konfliktbehandlung gleichzeitiger Edits am selben Schlüssel (dokumentiert) |
| Zukunftssicherheit | **68** | Zero-Dep = minimales Verrottungsrisiko, Node-LTS-Basis, PWA-Standard; Risiken: globaler Namensraum skaliert schlecht mit Featurewachstum, 27 interagierende Overlay-Schlüssel erhöhen die kognitive Last pro Änderung |
| Eleganz | **72** | Reine, testbare Helfer konsequent abgetrennt; einheitliches Idiom; Abzüge: Dichte, Duplikate (Glossar-Kartenrenderer 2×, `sheetNewNatur`≈`addNat`), Magic Numbers verstreut |
| **Gesamtqualität** | **72** | Gewichteter Gesamteindruck; getragen von Robustheit/Doku/Tests, gedrückt von Sicherheitslücke und Skalierungsmuster |

---

## 3. Befunde im Detail

Format je Befund: **Problem → Ursache → Auswirkung → Risiko → Vorschlag → Nutzen → Aufwand → Priorität.**

### 🔴 S1 — Öffentlich beschreibbare State-API (HOCH)
- **Problem:** `PUT /api/state` akzeptiert ohne Authentifizierung beliebige Schreibzugriffe; `GET` liefert den kompletten Zustand. Die App ist öffentlich erreichbar (`sops.kardio.wiki`).
- **Ursache:** Dokumentierter Kompromiss („internes, vertrauenswürdiges Netz"), der mit dem öffentlichen Deployment kollidiert.
- **Auswirkung:** Jeder kann Inhalte lesen (inkl. Material-Fotos, Lagerorte, Preise — potenziell sensibel) und **überschreiben/vandalisieren**. Über `hkl_authpw` (djb2, trivial brute-forcebar) zusätzlich Verwaltungszugang in der App.
- **Risiko:** Hoch (Integrität + Vertraulichkeit). Mitigiert nur durch Obskurität und Snapshots (Wiederherstellbarkeit).
- **Vorschlag (gestaffelt):** (a) Sofort: Schreibzugriffe an ein Shared-Secret binden (Header `X-State-Key`, Wert aus `.env`, Client bezieht ihn nach Admin-Login) **oder** Basic-Auth auf `/api/` im nginx-proxy; (b) besser: `PUT` nur mit gültiger signierter GitHub-Session (Infrastruktur existiert bereits!); (c) `hkl_authpw` serverseitig aus `GET`-Antworten für nicht authentifizierte Clients ausblenden.
- **Nutzen:** Schließt das größte Risiko; Variante (b) nutzt bereits gebauten Code.
- **Aufwand:** (a) ~2 h, (b) ~4 h inkl. Tests. **Priorität: HOCH.** *Nicht eigenmächtig umgesetzt, weil es eine Betriebsentscheidung erzwingt (jedes Gerät braucht dann Login/Secret).*

### 🔴 S2 — Passwort-Hash im geteilten Zustand (HOCH, gekoppelt an S1)
- **Problem:** `hkl_authpw` (djb2-Hash) synchronisiert über den offenen Endpunkt; djb2 ist in Sekunden zu brechen.
- **Ursache:** Komfortentscheidung „Passwort gilt auf allen Geräten" + fehlende Endpunkt-Auth.
- **Auswirkung/Risiko:** Verwaltungsmodus für jeden Mitleser. **Vorschlag:** Mit S1(b) entschärft; zusätzlich djb2 → SHA-256 via WebCrypto (Browser-Builtin, kein Dep). **Aufwand:** ~1 h + Migrationszeile. **Priorität: HOCH** (nach S1).

### 🟠 T1 — Modul-Verantwortung `backup.js` ↔ `ui/admin.js` (MITTEL)
- **Problem:** `renderAdmin()` + Kategorien-/UK-/Design-/Text-Editoren (≈ 160 von 210 Zeilen) liegen in `features/backup.js`; `ui/admin.js` enthält nur Sammel-Helfer.
- **Ursache:** Historisch gewachsen, nie umgezogen.
- **Auswirkung:** Auffindbarkeit leidet (der wichtigste Admin-Code steht im „falschen" Modul); ARCHITECTURE.md beschrieb es falsch (im Audit korrigiert).
- **Vorschlag:** Reines Verschieben (Funktionsnamen stabil, keine Logikänderung): Admin-Rendering → `ui/admin.js`, Backup-Kern bleibt. `check.js` sichert die Shell-Liste ab.
- **Nutzen:** Struktur = Doku; geringeres Einarbeitungsrisiko. **Aufwand:** ~1 h. **Priorität: MITTEL.**

### 🟠 T2 — Totes Protokollfeld `baseRev` (NIEDRIG–MITTEL)
- **Problem:** Der Client sendet `baseRev` bei jedem PUT; der Server liest es nie.
- **Ursache:** Vorbereitete, nie fertiggestellte Konfliktbehandlung.
- **Auswirkung:** Irreführender Code („sieht aus wie optimistische Nebenläufigkeitskontrolle, ist keine"); dokumentierter Last-write-wins bleibt real.
- **Vorschlag:** Entweder implementieren (Server: `baseRev < rev` → 409 + aktueller Stand; Client: Merge-Anzeige) **oder** Feld entfernen. Empfehlung: implementieren — kleiner Schritt, echter Schutz gegen das dokumentierte Same-Key-Fenster. **Aufwand:** ~3 h inkl. Tests. **Priorität: MITTEL.**

### 🟠 U1 — `prompt()`/`confirm()`-Dialoge (MITTEL)
- **Problem:** ~15 Editorpfade (Glossar, Kategorien, Symbole, Umbenennen, Passwort …) nutzen native `prompt()`-Dialoge, parallel zum ausgebauten Formularsystem (`scr-form`).
- **Auswirkung:** Inkonsistente UX, kein mehrzeiliger Text, kein Abbruch-Schutz, wirkt auf Tablets fremd; blockiert außerdem Automatisierung/Tests.
- **Vorschlag:** Schrittweise auf `openXyzForm`-Muster umziehen, beginnend mit Glossar (häufigster Nicht-Admin-Kontakt). **Aufwand:** ~30–60 min je Dialog. **Priorität: MITTEL, inkrementell.**

### 🟡 T3 — Dichte-/Duplikat-Politur (NIEDRIG)
- Glossar-Kartenrenderer existiert doppelt (`renderGlossary` + `glossarySearch`); `sheetNewNatur` dupliziert `addNat`; Magic Numbers (800 ms Debounce, 15 s Poll, 500 ms Long-Press, 300er-Limit Prüfliste) verstreut statt benannt. **Vorschlag:** Karten-Renderer extrahieren; Konstanten-Block je Modulkopf. **Aufwand:** ~2 h gesamt. **Priorität: NIEDRIG.**

### 🟡 F1 — Fehlende Funktionen (Vollständigkeitsanalyse)
Nach Nutzerrollen bewertet; keine davon blockierend:
| Lücke | Wer vermisst sie | Priorität |
|---|---|---|
| **Massenänderungen** (mehrere Standards/Einträge auf einmal) | Verwaltung | MITTEL (bereits im Backlog; Zielauswahl klären) |
| **Undo-Verlauf / Papierkorb** über Einzel-Reset hinaus | Verwaltung | MITTEL — Snapshots existieren serverseitig, aber ohne UI |
| **Änderungsprotokoll** (wer hat was wann geändert) | Leitung/QM | MITTEL — für ein Medizinumfeld naheliegend; Vorschlagswesen hat `by`, QEdits nicht |
| **Server-Snapshot-Wiederherstellung per UI** | Admin ohne SSH | NIEDRIG (Doku beschreibt Datei-Kopie) |
| **Abfrage-Builder** (konfigurierbare Formulare) | Verwaltung | Backlog, Konzept vor Bau |
| Rollenmodell (mehr als „Admin/Nicht-Admin") | Leitung | NIEDRIG bei Teamgröße |

Überflüssige/redundante Funktionen: keine gefunden, die Entfernung lohnten — auch Nischen-Features (Rubrik-Symbole, Farbmarkierung) sind billig im Unterhalt und werden von der Zielgruppe genutzt (Annahme aus Feature-Historie).

### 🟢 Positivbefunde (explizit, weil ungewöhnlich)
- **Doku-Ehrlichkeit:** ARCHITECTURE.md listet Altlasten und Kompromisse *mit Begründung* — selten und wertvoll.
- **Testkonzept:** Client-Helfer werden aus dem *echten* Quelltext extrahiert und in einer VM-Sandbox getestet; Servertests laufen gegen den echten HTTP-Server. Kein Mock-Theater.
- **`check.js`** fängt genau die zwei Fehlerklassen, die Unit-Tests strukturell nicht sehen (Syntax in nicht importierten Dateien, SW/Shell-Drift).
- **Offline-Modell** ist durchdacht: dirty-Set schützt eigene Edits vor Poll-Überschreibung; `storeSetQuiet` verhindert Echo-Schleifen; Screens mit offenen Eingaben werden nicht weggerendert.

---

## 4. Prozesse, Logik, Grenzfälle (Prüfergebnisse)

Verifiziert (Test/Messung), nicht nur gelesen:
- **Boot-Reihenfolge** `initAuth → sync.init → load → sync.start`: `rebuildDB` vor Datenladung ist durch `DB_BASE`-Guard abgesichert ✓
- **Merge-Semantik:** zwei Clients, disjunkte Schlüssel → kein Überschreiben ✓; Same-Key-Fenster dokumentiert (README) ✓
- **413-Kette** Server→Client inkl. Datenerhalt lokal ✓ (PR #2)
- **Tagesreset** der Häkchen (`hkl_checks.date`-Vergleich) ✓ logisch korrekt, schreibt bei Datumswechsel sofort zurück
- **Long-Press-Delegation:** Maus/Touch-Doppelfeuer über `lastTouch`-Fenster (700 ms) unterbunden; Edit-/Warum-Buttons von der Abhak-Geste ausgenommen ✓
- **Endlosschleifen/Dead Ends:** keine gefunden; einziger früherer Dead End (Login-Button ohne OAuth) in PR #2 behoben
- **Implizite Annahmen** (gekennzeichnet): material_key-Eindeutigkeit je Bedeutung (Quelldaten-Konvention); Gerätezahl klein; eine Klinik = ein State-Namespace (kein Mandantenkonzept — bewusst)

**Skalierungsprofil (gemessen/abgeschätzt):** 10 Nutzer: problemlos. 100 Nutzer: Polling 15 s → ~7 req/s Leerlauf, trivial; Schreibkonflikte am selben Schlüssel werden wahrscheinlicher → T2 (409) empfohlen. 1 000+: Modellgrenze (Voll-Blob-Sync); bräuchte Delta-Sync + Foto-Auslagerung — außerhalb des Einsatzzwecks.

---

## 5. Während des Audits behobene Defekte (Commit `676dd36`)

| # | Defekt | Schwere | Verifikation |
|---|---|---|---|
| 1 | **NUL-Byte (0x00)** als Gruppierungs-Sentinel in `pdfprint.js` — grep behandelte die Datei als binär; unsichtbare Wartungs-Mine | Mittel | Byte-Analyse; Druck-Smoke-Test ohne NUL im Output |
| 2 | **Freitext in onclick-Handlern** an 6 Stellen (Gruppen-, Rubrik-, UK-Namen, material_key — letzterer in den Quelldaten zu 89 % kein Slug) entgegen der eigenen dokumentierten Regel; Apostroph hätte Handler still zerbrochen | Mittel (latent) | Browser-Härtetest mit `L'Apostroph` / `O'Brien-Schrank`: Verwaltung, UK-Picker, Auf-/Zuklappen funktionieren |
| 3 | **Fotos ungebremst als Base64** in den Sync-Blob (4–16 MB je Handyfoto) | Hoch (praktisch) | `shrinkPhoto`: max. Kante 1280 px, JPEG 82 %, Fallback Original; Test 89 KB→14 KB, 1280×960 |
| 4 | **Doku-Drift**: README (SHARED_KEYS veraltet, `HOST_PORT` existiert nicht), ARCHITECTURE (backup.js-Beschreibung) | Niedrig | Abgleich gegen Code |

Alle 162 Tests + `npm run check` + Browser-Smoke nach den Fixes grün.

---

## 6. Roadmap (empfohlen)

**HOCH — als Nächstes, vor weiterem Featurebau:**
1. **S1: Schreibschutz `/api/state`** (Entscheidung nötig: Shared-Secret vs. GitHub-Session vs. Proxy-Basic-Auth) + `hkl_authpw` nicht mehr unauthentifiziert ausliefern.
2. **S2: Passwort-Hash → WebCrypto-SHA-256** (nach S1).

**MITTEL — nächste Aufräum-Iteration:**
3. T2: `baseRev` zu echter 409-Konflikterkennung ausbauen (oder entfernen).
4. T1: Admin-Rendering aus `backup.js` nach `ui/admin.js` verschieben.
5. U1: `prompt()`-Editoren schrittweise aufs Formularsystem heben (Start: Glossar).
6. F1: Änderungsprotokoll light (wer/wann je QEdit — Feld existiert im Vorschlagswesen schon).
7. Backlog-Features mit geklärtem Design: Massenänderungen, dann Abfrage-Builder.

**NIEDRIG — Gelegenheit:**
8. T3-Politur (Duplikate, Konstanten); Snapshot-Restore-UI; Foto-Speicher perspektivisch aus dem Sync-Blob lösen (eigener Endpunkt), falls Fotomengen weiter wachsen.

**Zielkonflikte (transparent):** Jede Auth auf `/api/state` kostet die heutige „aufmachen und es läuft"-Einfachheit auf Neugeräten — das ist der Preis des öffentlichen Deployments. Das Zero-Dependency-Gebot schließt fertige Lösungen (z. B. bcrypt) aus; WebCrypto/Node-crypto decken den Bedarf aber ab. Ein Modulsystem (ESM) würde die globale API-Fläche lösen, bricht aber die bewusste „kein Build, alte Tablets"-Entscheidung — nicht empfohlen, solange `check.js` die Drift mechanisch abfängt.

**Fehlende Informationen, die die Bewertung ändern könnten:** tatsächliche Geräte-/Nutzerzahl; ob die öffentliche Erreichbarkeit gewollt ist oder ein VPN/IP-Filter geplant war (→ würde S1 von HOCH auf MITTEL senken); ob GitHub-OAuth produktiv konfiguriert wird (→ macht S1(b) zur natürlichen Lösung); Foto-Bestandsgröße im Produktiv-State (Altbestand bleibt unverkleinert, bis neu fotografiert wird).

---

*Dieser Bericht ist Teil des Repositories (`docs/audits/`) und damit versioniert; Folge-Audits sollten als neue Datei mit Datum abgelegt werden, nicht diesen Stand überschreiben.*
