# Mitarbeiten & selbst weiterentwickeln

Dieses Kochbuch macht dich unabhängig: Es zeigt Schritt für Schritt, wie du die
häufigsten Änderungen **selbst** machst — ohne die Architektur zu kennen und
ohne Hilfe von außen. Für den tieferen Aufbau siehe [ARCHITECTURE.md](ARCHITECTURE.md).

> **Die eine goldene Regel:** Nach jeder Änderung erst `npm run check`, dann
> `npm test`. Sind beide grün, ist die Änderung sicher deploybar. Beide brauchen
> **kein** `npm install` (das Projekt hat null Abhängigkeiten) — nur Node ≥ 18.

Inhalt:

- [Einmal einrichten](#einmal-einrichten)
- [Der immer gleiche Arbeitsablauf](#der-immer-gleiche-arbeitsablauf)
- [Rezepte](#rezepte)
  - [1. Texte & Titel ändern](#1-texte--titel-ändern)
  - [2. Farben & Aussehen ändern](#2-farben--aussehen-ändern)
  - [3. Inhalte pflegen (Standards, Rubriken, Einträge)](#3-inhalte-pflegen-standards-rubriken-einträge)
  - [4. Das Verwaltungs-Passwort ändern](#4-das-verwaltungs-passwort-ändern)
  - [5. Ein neues Feld an Einträgen ergänzen](#5-ein-neues-feld-an-einträgen-ergänzen)
  - [6. Ein neues JS-Modul hinzufügen](#6-ein-neues-js-modul-hinzufügen)
  - [7. Einen neuen geteilten Speicher-Schlüssel anlegen](#7-einen-neuen-geteilten-speicher-schlüssel-anlegen)
  - [8. Einen neuen Server-Endpunkt hinzufügen](#8-einen-neuen-server-endpunkt-hinzufügen)
- [Deployen (live schalten)](#deployen-live-schalten)
- [Datensicherung & Wiederherstellung](#datensicherung--wiederherstellung)
- [Wenn etwas kaputt ist](#wenn-etwas-kaputt-ist)
- [Die drei Fallstricke, die du kennen musst](#die-drei-fallstricke-die-du-kennen-musst)

---

## Einmal einrichten

Du brauchst nur **Node.js ≥ 18** (https://nodejs.org). Danach im Projektordner:

```bash
# App lokal starten (Zustand landet in ./.state/state.json):
STATE_DIR=./.state PORT=8080 node server.js
# → im Browser http://localhost:8080 öffnen
```

Während du entwickelst, startet der Server bei jeder Server-Änderung neu:

```bash
STATE_DIR=./.state PORT=8080 npm run dev
```

Frontend-Änderungen (HTML/CSS/JS in `public/`) brauchen **keinen** Neustart —
einfach die Seite im Browser neu laden (ggf. mit Shift-Reload, um den Cache zu
umgehen).

---

## Der immer gleiche Arbeitsablauf

Egal was du änderst, der Ablauf ist immer derselbe:

1. **Ändern** — Datei bearbeiten (siehe Rezepte unten).
2. **Prüfen** — `npm run check` (Syntax + Offline-Liste) und `npm test` (die
   Testsuite). Beide müssen grün sein.
3. **Ansehen** — lokal im Browser testen (`node server.js`, siehe oben).
4. **Sichern** — mit Git committen (`git add -A && git commit -m "…"`).
5. **Deployen** — auf `main` pushen; der Rest passiert automatisch (siehe
   [Deployen](#deployen-live-schalten)).

Wenn `npm run check` oder `npm test` rot sind, **nicht deployen** — erst
reparieren. Die Fehlermeldung sagt dir genau, welche Datei und welche Zeile.

---

## Rezepte

### 1. Texte & Titel ändern

**Ohne Code — direkt in der App:** Melde dich im Verwaltungsmodus an
(☰ → Anmelden) und ändere App-Titel und Überschriften unter *Verwaltung*. Diese
Texte liegen im geteilten Zustand und gelten sofort auf allen Geräten.

**Die Standard-Vorgaben** (falls kein eigener Text gesetzt ist) stehen in
`public/js/core/app-state.js` in `TXT_DEF`:

```js
const TXT_DEF={ appTitle:'HKL Standards', careTitle:'Materialwirtschaft', … };
```

### 2. Farben & Aussehen ändern

**Ohne Code:** Verwaltung → Design (Akzentfarbe, Größenfarbe, Zoomstufe).

**Grundfarben im Code:** Die Farbpalette steckt als CSS-Variablen ganz oben in
`public/css/app.css` (`:root { --accent: …; --bg: …; … }`). Ändere dort den
Wert und lade die Seite neu.

Die Palette für Untergruppen-/Eintrags-Farben ist `UK_PALETTE` (Konstante im
JS). Die Textfarbe auf farbigen Einträgen wird automatisch lesbar gewählt
(`pickTextColor` in `public/js/core/color.js`) — daran musst du nichts tun.

### 3. Inhalte pflegen (Standards, Rubriken, Einträge)

Das ist **kein Code** — alles läuft über die App im Verwaltungsmodus:

- **Neuer Standard:** Verwaltung → „➕ Eigene Standards" → „＋ Neuer Standard".
- **Neue Rubrik:** im Standard auf „＋ Rubrik" (mit Geltungsbereich: nur dieser
  Standard, ganze Gruppen, oder alle — siehe ARCHITECTURE, „Rubrik-Vorlagen").
- **Neuer Eintrag:** in einer Rubrik auf „＋ Eintrag hinzufügen".
- **Bearbeiten/Ausblenden:** langer Druck (Long-Press) auf einen Eintrag.

Alle diese Inhalte liegen im geteilten Server-Zustand und erscheinen sofort auf
allen Geräten. Die JSON-Quelldatei
(`public/data/hkl_standards_export.json`) bleibt dabei **unangetastet**.

### 4. Das Verwaltungs-Passwort ändern

**Ohne Code:** Verwaltung → „🔑 Passwort ändern".

> Hinweis: Der Passwortschutz ist ein Komfort-Riegel für den internen Gebrauch,
> keine harte Sicherheitsgrenze (siehe ARCHITECTURE, „Bekannte Altlasten").

### 5. Ein neues Feld an Einträgen ergänzen

Beispiel: Du willst jedem Eintrag ein Feld „Warum" geben (aus dem Brainstorming).
Die Bausteine, die du anfasst:

1. **Formular** (`public/js/ui/forms.js`): ein Eingabefeld ins Eintrags-Formular
   aufnehmen und in `readEntryForm()` mit auslesen.
2. **Speichern**: das Feld über das bestehende Schnellmenü-System (`qeSet(…)`)
   ablegen — dann wird es automatisch server-seitig geteilt (der Schlüssel
   `hkl_qedits` ist bereits geteilt).
3. **Anzeigen** (`public/js/ui/detail.js`): in `entryCardHTML()` das Feld
   ausgeben (z. B. als aufklappbares Detail).

Für **reine** Hilfsfunktionen (Berechnungen ohne DOM) schreibe einen Test in
`test/client-helpers.test.js` — dann ist die Logik dauerhaft abgesichert.

### 6. Ein neues JS-Modul hinzufügen

Neue Bausteine sind eigene Dateien. **Drei Stellen** müssen zusammenpassen,
sonst schlägt `npm run check` fehl (genau dafür ist er da):

1. Datei anlegen, z. B. `public/js/features/mein-feature.js`.
2. In `public/index.html` ein `<script src="js/features/mein-feature.js">`
   eintragen — **vor** `js/main.js` und **nach** allem, was die Datei beim Laden
   sofort benutzt (die Reihenfolge der `<script>`-Tags *ist* das Modulsystem).
3. Denselben Pfad in die `SHELL`-Liste in `public/sw.js` aufnehmen (damit das
   Modul auch offline verfügbar ist).

`npm run check` prüft Punkt 2 ⇄ 3 automatisch.

### 7. Einen neuen geteilten Speicher-Schlüssel anlegen

Alle geteilten Daten liegen unter Schlüsseln, die mit `hkl_` beginnen. Soll ein
neuer Schlüssel **zwischen Geräten geteilt** werden (statt nur lokal):

1. Den Schlüssel in `SHARED_KEYS` in `public/js/core/sync.js` ergänzen.
2. In `hydrateVars()` (gleiche Datei) neu einlesen.
3. Soll er auch im Export/Import enthalten sein: in `BACKUP_KEYS` in
   `public/js/features/backup.js` ergänzen.

Ohne Schritt 1 bleibt der Schlüssel rein lokal (nur in diesem einen Browser).

### 8. Einen neuen Server-Endpunkt hinzufügen

1. `server/routes/<name>.js` anlegen, das `{ matches, handle }` exportiert
   (Vorlage: `server/routes/health.js`).
2. In `server/routes/index.js` registrieren.
3. Einen Integrationstest in `test/server.test.js` ergänzen.

Details in ARCHITECTURE.md, Abschnitt „Neuen API-Endpunkt hinzufügen".

---

## Deployen (live schalten)

Deployment ist vollautomatisch: **jeder Push auf `main`** baut ein neues Image
und rollt es auf den Server (https://sops.kardio.wiki) aus.

```bash
git add -A
git commit -m "Beschreibe deine Änderung"
git push origin main
```

Danach läuft in GitHub unter *Actions* die Pipeline: erst `npm run check` +
`npm test`, dann Image bauen, dann per SSH deployen. Ist eine der Prüfungen rot,
wird **nicht** deployt — deine Live-App bleibt unangetastet. Du kannst den Lauf
auch von Hand starten: *Actions → Build and Deploy → Run workflow*.

Nach dem Deploy müssen Nutzer nichts tun — beim nächsten Laden holt sich der
Browser die neue Version. Wenn du am Service Worker (`public/sw.js`) etwas
geändert hast, erhöhe dort `CACHE_VERSION` (z. B. `v4` → `v5`), damit der alte
Offline-Cache sauber ersetzt wird.

---

## Datensicherung & Wiederherstellung

Alle Eingaben der Kolleg:innen liegen server-seitig in **einer** Datei:
`state.json` (im Docker-Volume `hkl-state`, im Container unter `/app/state`).

- **Automatische Snapshots:** Der Server legt gedrosselt (höchstens alle
  10 Minuten) zeitgestempelte Kopien in `…/state/backups/` ab und behält die
  48 neuesten. Das schützt vor Korruption oder versehentlichem Überschreiben.
  Einstellbar über die Umgebungsvariablen `BACKUP_INTERVAL_MS` und
  `BACKUP_KEEP`.
- **Wiederherstellen:** Server stoppen, die gewünschte
  `backups/state-….json` über `state/state.json` kopieren, Server starten.
- **Manueller Export in der App:** Verwaltung → Export lädt alle Anpassungen als
  Datei herunter; Import spielt sie wieder ein. Praktisch, um einen Stand zu
  sichern, bevor du Größeres umbaust.

---

## Wenn etwas kaputt ist

| Symptom | Ursache & Lösung |
|---|---|
| Weiße Seite, nichts lädt | Meist ein **Syntaxfehler** in einer JS-Datei. `npm run check` sagt dir Datei + Zeile. Browser-Konsole (F12) zeigt die genaue Meldung. |
| „function is not defined" | Ein Modul benutzt beim Laden etwas aus einer Datei, die **später** in `index.html` steht. Reihenfolge der `<script>`-Tags anpassen (Benutzer nach Definition). |
| Neues Modul fehlt offline | Pfad nicht in `SHELL` in `sw.js`. `npm run check` meldet das. |
| Änderung erscheint nicht auf anderem Gerät | Der Speicher-Schlüssel ist nicht in `SHARED_KEYS` (siehe Rezept 7), oder das andere Gerät ist offline (Sync-Punkt oben rechts ist bernsteinfarben statt grün). |
| Farbiger Text unlesbar | Nicht selbst die Textfarbe setzen — `pickTextColor()` wählt sie automatisch nach Kontrast. |
| Tests rot nach Cache-Version-Änderung | In `test/service-worker.test.js` die `v…`-Nummern mit anpassen. |

**Merksatz:** Fast jeder Fehler wird schon von `npm run check` **oder**
`npm test` gefangen — laufen beide grün, ist die Wahrscheinlichkeit sehr hoch,
dass die App im Browser sauber startet.

---

## Die drei Fallstricke, die du kennen musst

1. **Apostroph in `onclick`.** `esc()` maskiert **kein** `'`. Interpoliere nie
   Freitext direkt in einen `onclick="…"`-String — übergib stattdessen eine ID
   (`[a-z0-9_]`) und schlag den Wert in der Funktion nach. Sonst zerbricht das
   Attribut bei Namen mit Apostroph.

2. **Ladereihenfolge = Modulsystem.** Es gibt keinen Bundler. Was in
   `index.html` weiter oben steht, lädt zuerst. Sofort ausgeführter Startcode
   gehört nach `js/main.js` (lädt zuletzt).

3. **DB_BASE nie mutieren.** Beim Einblenden von Vorlagen-Rubriken wird das
   Standard-Objekt **kopiert** (`mergeCustomIntoDB`), nie direkt verändert —
   sonst wandern eingefügte Rubriken in die Basisdaten und Einträge gehen beim
   nächsten Aufbau verloren.

Alles Weitere — Persistenz, Sync, Caching, Rubrik-Vorlagen — steht ausführlich
in [ARCHITECTURE.md](ARCHITECTURE.md).
