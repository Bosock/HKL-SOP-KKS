# Die neue App im Neuaufbau

**Stand:** 11.11.2026 · Cache-Version `v83` · Code: `public/neu/`

**Kurz:** Im Raum **Neuaufbau** läuft jetzt eine **neu gebaute App** mit einer
einfachen, durchgängigen Verwaltung. Der **Bestand** (die App im Labor) ist
unverändert: Er wird weder umgeleitet noch berührt. Wer den Neuaufbau betritt
(Zweitpasswort in der Verwaltung des Bestands), landet automatisch in der neuen
App. Umgeschaltet wird erst, wenn der Auftraggeber es entscheidet — dafür gibt
es den Prompt in [`UMSCHALTEN-PROMPT.md`](UMSCHALTEN-PROMPT.md).

---

## 1. Warum eine neue App

Die Verwaltungsanalyse vom 06.11.2026 hat gezeigt, dass die alte Verwaltung
über Jahre gewachsen ist. Es gibt etwa 28 erweiterbare Listen an etwa 45
Anlegestellen, mehrere Masken für dasselbe Material, drei Bildorte und keinen
Ort, an dem man wiederfindet, was man angelegt hat. Einzelkorrekturen hätten das
nicht aufgelöst. Entschieden wurde deshalb (Auftraggeber, 06.11.2026):

> „Im Untergrund bauen wir eine komplett neue App … Im Live-Modus der App wird
> nichts geändert."

## 2. Die Leitregeln

1. **Stammdaten gelten überall, eine Position gilt nur hier.**
   - Stammdaten sind Material, Gerät (ein Eintrag je Modell) und Medikament.
     Name, GTIN, REF, Hersteller, Merkmale, Lagerort, Fotos und Preis gehören
     zum Stammsatz.
   - Eine Position im Standard verweist auf einen Stammsatz oder trägt eigenen
     Text. Dazu kommen Menge, Zusatz, Bereich und „auf Ansage". Diese Angaben
     gelten nur in diesem Standard.
   - Damit entfällt die alte Reichweiten-Frage („nur hier oder überall?").
2. **Wirkungsvorschau statt Überraschung.** Wer einen Stammsatz ändert, der in
   Standards verwendet wird, sieht vor dem Speichern: „Diese Änderung wirkt in
   N Standards: …".
   - Ausgenommen sind Fotos, Notiz und Preis, weil sie keine Zeile im Standard
     ändern.
3. **Ein Auswahlfeld für alles.** Jede Auswahl (Kategorie, Hersteller, Bereich,
   Art, Gruppe, Kennzeichen, Merkmalswert …) funktioniert gleich:
   - suchen und wählen;
   - in der Verwaltung an Ort und Stelle **neu anlegen**.
   - Davor prüft die App auf Doppelungen. Bei einem gleichen Namen zeigt sie den
     vorhandenen Eintrag; bei ähnlichen Namen fragt sie „Ist einer davon
     gemeint?".
4. **Eine Maske „Neu anlegen"** mit Vorauswahl der Art.
   - Zuerst wird die Art gewählt (Material, Gerät, Medikament, Arbeitsschritt,
     Prüfpunkt, Anordnung, Hinweis, Personal, Aufgabe; erweiterbar).
   - Danach geht es je nach Art auf einem von zwei Wegen weiter: aus dem
     Verzeichnis wählen (Mehrfachauswahl) oder neu erfassen. Bei Textarten
     schreibt man eine Zeile je Position.
5. **Ein Verzeichnis für alle Listen** (Mehr → Listen-Verzeichnis). Jeder
   Eintrag zeigt, wann und wo er angelegt wurde und wie oft er verwendet wird.
   Er lässt sich umbenennen, zusammenführen und archivieren.
6. **Nichts geht verloren.** Löschen heißt Papierkorb, und jede Änderung steht
   im Verlauf (je Gerät).

## 3. Was die App kann

| Bereich | Anwender | Verwaltung |
|---|---|---|
| **Standards** | ansehen, Gruppen, Suche, Filter nach Kennzeichen, **abhaken** (nur auf dem eigenen Gerät), Fortschritt | neu (leer · übliche Rubriken · Kopie), Editor für Handy und PC (Ziehen am PC, ↑↓ am Handy), Rubriken/Abschnitte anlegen, umbenennen, verschieben und löschen, Positionen bearbeiten |
| **Rüstliste** | nach **Bereich** (Tischvorbereitung · Eingriffsvorbereitung · eigene), darin nach **Lagerort**; „auf Ansage" ist innerhalb des Bereichs markiert und steht zuletzt | Bereich als Vorgabe am Stammsatz, an der Position überschreibbar |
| **Material** | Verzeichnis mit Suche (Name, REF, GTIN, Ort, Merkmale), Ansicht ohne Preis, **Melden** | siehe die Liste unter der Tabelle |
| **Geräte** | wie Material | ein Eintrag je Modell (keine Seriennummern), Kategorie, Hersteller, Modell, Hinweis (Kalibrier-/Kontrollwerte erlaubt, A1) |
| **Medikamente** | wie Material | Wirkstoff, Konzentration, Darreichung, Preis |
| **Bausteine** | ansehen | wiederkehrende Positionsgruppen; werden als Kopie eingefügt |
| **Meldungen** (A2) | „ist leer · fehlt · defekt · sonstiges" mit Notiz | Stufen: gemeldet → weitergegeben → erledigt. **Es wird nichts bestellt.** |
| **Kosten** (C5) | — | Plankosten je Standard und Übersicht. Unklare Mengen und fehlende Preise erscheinen als Lücke und werden nie geschätzt. CSV-Export für Excel. |
| **Verlauf · Papierkorb** | — | wer (Gerätename) wann was geändert hat; wiederherstellen oder endgültig löschen |
| **Sicherung** | — | Export als JSON. Beim Import zeigt eine Vorschau, was neu, geändert, gleich oder nur hier vorhanden ist. Danach wählt man Zusammenführen oder Ersetzen. Vorher wird der aktuelle Stand automatisch heruntergeladen. |
| **Einstellungen** | Hell/Dunkel, Gerätename, Zurück zum Bestand | Passwort, **Live schalten** (Zweitpasswort, Häkchen, Rückfrage) |

Die Material-Maske der Verwaltung (Umbau 10.11.2026). Sie folgt dem, was man
in der Hand hat — **eine** Maske, keine neuen Menüs:

1. **Erkennen.** „▦ Barcode scannen" liest die GTIN mit der Kamera (auf jedem
   Gerät: Android, iPhone, iPad, PC; ohne Kamera per Foto). Mit der GTIN fragt
   der Server der App das **EU-Register EUDAMED** (sonst die US-Datenbank
   GUDID) und füllt die **leeren** Felder: Hersteller, Handelsname, REF,
   steril, Latex, Einmalprodukt. „📷 Etikett lesen" bleibt für REF und
   Merkmale, wenn kein Barcode da ist. Der Text eines Handscanners im
   GTIN-Feld wird ebenfalls ausgewertet. Charge und Verfall werden nie
   gespeichert (A2).
2. **Das Wichtigste** steht offen da: Name im Haus (mit Vorschlägen aus den
   Bezeichnungen des Bestands und Hinweis auf vorhandene Einträge),
   Handelsname, Hersteller, REF, GTIN (Prüfziffer sofort, jede GTIN nur
   einmal), **Lagerort** (eine Liste statt Freitext, an Ort und Stelle
   erweiterbar), Bilder.
3. **Mehr Angaben** — aufklappbar, alles freiwillig:
   - *Kategorie und Merkmale.* Die Kategorie ist ein **Vorschlag** (aus der
     Einordnung im Register oder aus einem Wort im Namen), kein Tor mehr. Acht
     Kategorien für Verbrauchsmaterial kamen dazu
     (`public/neu/daten/katalog-zusatz.json`). Die Kategorien gehören dem
     Haus (Grundsatz A7): Im Listen-Verzeichnis lassen sie sich umbenennen,
     zusammenführen, archivieren, neu anlegen, und ihre **Suchwörter**
     ändern (die Vorgabe ist zurückholbar); Felder kommen in der Maske mit
     „＋ Feld zu dieser Kategorie" dazu.
   - *Steril · Einmal · Latex.*
   - *Packung und Preis* (Packungsgröße; „der Preis gilt für die ganze
     Packung" rechnet den Stückpreis).
   - *Verwendung · Suchwörter · PZN* (PZN mit Prüfziffer). Die Suche im
     Verzeichnis findet über alle drei.
   - *Verknüpfungen* (siehe unten).
   - *Bereich · Notiz.*
4. Über den Knöpfen steht, **was zum „vollständig" noch fehlt** (Hersteller,
   GTIN oder REF, Lagerort, Produktbild, Kategorie). Speichern geht immer; das
   Verzeichnis hat den Filter **„unvollständig"** und nennt je Zeile, was fehlt.
5. **Speichern und nächstes Material** für die Erfassung am Schrank: Lagerort
   und Bereich bleiben stehen, alles andere ist leer. **Als Variante kopieren**
   legt eine weitere Größe an (Familie bleibt; GTIN, REF, Bilder und
   Verknüpfungen nicht).
6. **Schutz:** Wer eine Maske mit ungespeicherten Eingaben verlässt (Reiter,
   „Zurück" des Geräts, Abbrechen), wird gefragt.
7. Danach wie bisher: „Verwendet in", Dublette zusammenführen, archivieren,
   Papierkorb.

**Registerdaten (Grundsatz A5).** Was aus EUDAMED oder GUDID kommt, trägt in
der Maske Quelle, Abrufzeit und den Status „noch nicht bestätigt". Bestätigt
ist es erst, wenn ein Mensch den Stammsatz speichert. Der Mensch schlägt das
Register: Gefüllt werden nur leere Felder. Hinaus geht **nur die GTIN**.
Abschaltbar in Einstellungen → „EU-Register" (für alle Geräte) oder auf dem
Server mit `REGISTER=0`.

**Hersteller.** Ein Listeneintrag hat einen Kurznamen fürs Haus („B. Braun
Melsungen"), den amtlichen Namen und die EU-Registriernummer (SRN). Erkannt
wird ein Hersteller an der SRN, nicht an der Schreibweise — „B|BRAUN" und
„VYCON" entstehen so nicht mehr.

**Verknüpfungen** (ein Abschnitt der Maske, Entscheidung E2):

| Art | Hinrichtung | Gegenrichtung (nur gelesen) |
|---|---|---|
| 🔁 Ersatz | „Stattdessen geht auch" — mit Sorte und Grund | „Ist Ersatz für" |
| 🧩 Zubehör | „Braucht dazu" | „Wird gebraucht von" |
| ♻️ Aufbereitung | „Aufbereitete Fassung von" | „Gibt es auch aufbereitet" |

- Sorten von Ersatz: **äquivalent** · **teures Äquivalent** · **Alternative**
  (nur unter Bedingungen) · **Back-Up** (nutzbar, nicht optimal).
- Gespeichert wird nur die Hinrichtung, am einen Material; die Gegenrichtung
  wird gelesen. Die beiden Seiten können so nicht auseinanderlaufen.
- **Kurzerfassung:** Fehlt das andere Material noch, wird es im selben Zug
  angelegt (Barcode scannen oder nur der Name) — die Maske bleibt offen. Es
  entsteht bewusst unvollständig und steht im Verzeichnis unter
  „unvollständig".
- **Im Standard:** Eine Zeile mit eingetragenem Ersatz trägt „🔁 Ersatz";
  Antippen zeigt Sorte und Grund. Wird ein Material mit „braucht dazu"
  hinzugefügt, **fragt** die App, ob das Zubehör mit hinein soll — sie fügt
  nichts ungefragt ein.
- Beim Zusammenführen von Dubletten wandern die Verknüpfungen mit.

**Bilder** (seit 09.11.2026; ein Feld in der Maske, für Material, Gerät und
Medikament dasselbe — kein eigenes Menü):

- **Aufnehmen oder aus den Fotos wählen.** Nach der Aufnahme öffnet sofort der
  Foto-Editor: zuschneiden (Rahmen ziehen) und in 90°-Schritten drehen.
  Mehrere Bilder auf einmal kommen ohne Editor hinzu und lassen sich einzeln
  nachbearbeiten.
- **Bild antippen** öffnet ein Blatt in der Maske: zuschneiden/drehen, als
  **Anzeigebild** wählen (★), sagen, was es zeigt (Produkt · Etikett ·
  Verpackung · Sonstiges), Bildunterschrift, Original wiederherstellen,
  entfernen.
- **Anzeigebild** ist das Bild, das in Listen, in den Standards und in der
  Rüstliste an der Zeile steht. Ohne ausdrückliche Wahl gilt: das erste
  Produktbild, sonst das erste Bild, das kein Etikett ist, sonst das erste.
  Das Etikettfoto aus „Etikett lesen" bekommt die Rolle „Etikett" und wird
  deshalb nicht von allein zum Gesicht des Materials.
- **Antippen macht groß** — überall, mit Zoom (Großansicht der alten App).
- Jedes Bild liegt groß (längste Kante 1600) und als kleine Vorschau (320) im
  Medienspeicher; Listen und Standards laden nur die Vorschau.
- Foto-Editor (`features/photoedit.js`) und Großansicht
  (`features/lightbox.js`) sind die der alten App, unverändert.
- Bildänderungen gehören zum Entwurf der Maske und gelten erst nach
  „Speichern"; die Maske weist darauf hin.

**Anwender und Verwaltung:** Die Anmeldung ist dieselbe wie im Neuaufbau
bisher: Verwaltungspasswort, Vorgabe „abcdefg", eine Stunde Sitzung. Sie ist
Komfort, keine Sicherheit (A9).

## 4. Aufbau (technisch)

```
public/neu/index.html     eigene Seite; nutzt ../css/app.css (gleiches Aussehen)
public/neu/neu.css        nur Ergänzungen
public/neu/js/kern.js     reine Logik, ohne DOM/Speicher → test/neue-app.test.js
public/neu/js/barcode.js  Barcode lesen: Kamera (live) oder Foto; eingebauter Leser oder zxing
public/neu/daten/         katalog-zusatz.json (Kategorien für Verbrauchsmaterial, Suchwörter,
                          Register-Einordnung) · material-namen.json (Namensvorschläge;
                          erzeugt von scripts/neu-vokabular.js)
public/vendor/zxing/      Barcode-Leser (zxing-wasm 2.1.2, selbst gehostet, erst beim ersten Scan geladen)
server/register.js        Register-Abfrage EUDAMED → GUDID, mit Zwischenspeicher
server/routes/register.js GET /api/register?gtin=…
public/neu/js/abgleich.js eigener Sync, nur Raum „neuaufbau", nur na_*-Schlüssel + hkl_authpw
public/neu/js/daten.js    Arbeitsspeicher NA, Speichern/Löschen, Verlauf, Papierkorb, Listen
public/neu/js/ui.js       Klick-Verteiler (data-na), Blätter, Rückfragen, DAS Auswahlfeld, Anmeldung, Bilder
public/neu/js/stamm.js    Material · Geräte · Medikamente
public/neu/js/standards.js Standards, Editor, Neu anlegen, Bausteine, Rüstliste, Kosten
public/neu/js/werkzeuge.js Mehr: Listen, Meldungen, Verlauf, Papierkorb, Kosten, Sicherung, Einstellungen
public/neu/js/app.js      Start, Raumschutz, Navigation (#/…), Anmeldung
```

Wiederverwendet, **ohne Änderung**:

- `js/core/store.js` (Speicher mit Raum-Präfix)
- `js/features/merkmale.js` (Merkmalskatalog)
- `js/features/ocr.js` (Etikett)
- `js/features/photoedit.js` (zuschneiden, drehen), `js/features/lightbox.js`
  (Großansicht)
- `data/merkmale.json` (der Zusatzkatalog der neuen App liegt als Overlay
  darüber; die Datei selbst und die alte App bleiben unverändert)

**Register-Abfrage** (`server/register.js`):

- Reihenfolge: EUDAMED (offizielle Schnittstelle der EU-Kommission), dann
  AccessGUDID. Nur GET, nur Ziffern, feste Zieladressen.
- Zwischenspeicher in `STATE_DIR/register-cache.json`: Treffer 30 Tage,
  „nicht gefunden" 24 Stunden, ein Ausfall gar nicht.
- Drosselung: höchstens 15 Abfragen je Minute. EUDAMED begrenzt je
  Absender-Adresse (Erfahrungswerte anderer Nutzer, Oktober 2026: etwa 20 je
  Minute, darüber HTTP 429); offiziell dokumentiert ist keine Zahl. Bei 429
  hält der Server die verlangte Wartezeit (`Retry-After`) ein.
- Zeitlimit: EUDAMED 20 s (antwortet oft erst nach 2–9 s, gemessen 11.11.2026),
  GUDID 8 s.
- Antwortet ein Register nicht, wird es zwei Minuten übersprungen (sonst
  wartete jeder Scan das Zeitlimit ab). Ein GUDID-Treffer während eines
  EUDAMED-Ausfalls gilt nur einen Tag. „Steht in keinem Register" heißt
  immer: beide haben geantwortet.
- Umgebung: `REGISTER=0` (aus), `REGISTER_TIMEOUT_MS` (20000),
  `REGISTER_PAUSE_MS` (120000), `REGISTER_EUDAMED_URL`, `REGISTER_GUDID_URL`.
- **Nachholen:** Im Material-Verzeichnis (Verwaltung) steht „↻ Aus dem
  Register ergänzen (n)", solange Materialien eine gültige GTIN, aber noch
  keine Registerdaten haben. Ein Tipp schlägt alle nacheinander nach (höchstens
  15 je Minute), füllt nur leere Felder und lässt die Angaben „noch nicht
  bestätigt".
- Der Server braucht dafür ausgehenden Zugriff auf
  `api.datalake.sante.service.ec.europa.eu` und `accessgudid.nlm.nih.gov`.
  Ohne ihn arbeitet die Maske wie zuvor und sagt „nicht erreichbar".
  Geprüft am 11.11.2026 auf sops.kardio.wiki: GUDID antwortet in 0,7 s, der
  Zugang ist also offen; EUDAMED antwortete zu dieser Zeit niemandem.
  **Selbst prüfen:** im Browser `https://sops.kardio.wiki/api/register?gtin=08714729841968`
  öffnen — `"quelle":"GUDID"` heißt: der Server kommt hinaus. Für EUDAMED
  dasselbe mit `?gtin=04022495787309` (`"quelle":"EUDAMED"`).
  `REGISTER=0` in `~/hkl-sop-kks/.env` auf dem Server schaltet die Abfrage
  ab (docker-compose.yml reicht den Wert durch).

**Datenmodell** (geteilter Zustand des Raums Neuaufbau). Jedes Objekt ist ein
eigener Schlüssel; der Server ersetzt beim Speichern nur gesendete Schlüssel.

| Schlüssel | Inhalt |
|---|---|
| `na_m_<id>` | Material: name, handelsname, kategorie, gtin, ref, pzn, hersteller (Kennung), merkmale{}, lagerort (Kennung der Liste `lagerorte`), bereich, packung, verwendung, suchwoerter, verknuepfungen[{art, ziel, sorte, grund}], register{quelle, abgerufen, bestaetigt, hersteller, srn, bezeichnung, einordnung, basisUdi, gtin}, varianteVon, fotos[{k, v, rolle, titel, orig, origV}], hauptbild, preis{betrag, bezugsmenge}, notiz, archiviert |
| `na_g_<id>` | Gerätetyp: name, kategorie, hersteller, modell, lagerort, bereich, fotos[], hinweis |
| `na_d_<id>` | Medikament: name, wirkstoff, konzentration, darreichung, lagerort, bereich, preis, hinweis |
| `na_s_<id>` | Standard: titel, gruppe, kennzeichen[], rubriken[{id, name, abschnitte[{id, name, positionen[{id, art, ref{typ,id} \| text, menge, zusatz, bereich, ansage}]}]}] |
| `na_b_<id>` | Baustein: name, positionen[] |
| `na_l_<liste>` | Liste: eintraege[{id, name, angelegt, wo, archiviert, …}]; bei `hersteller` zusätzlich amtlich, srn; bei `kategorien`: tpl {klassen, merkmale, werte} als Overlay auf `data/merkmale.json`; `na_l_einstellungen`: werte{register} |
| `na_ml_<id>` | Meldung: ref, was, notiz, stufe, schritte[] |
| `na_pk_<id>` | Papierkorb: typ, daten, geloescht, von |
| `na_vl_<JJJJ-MM>_<gerät>` | Verlauf (je Monat und Gerät, höchstens 500 Einträge) |
| `nalokal_*` | nur auf dem Gerät: Haken, Rüstlisten-Haken, Gerätename, Warteliste des Abgleichs |

Gelöscht wird mit dem Wert `null`, weil der Server kein Entfernen kennt.
Ändern zwei Geräte **dasselbe** Objekt zur selben Zeit, gilt das zuletzt
gesendete. Das ist bewusst einfach gehalten, und der Verlauf zeigt beide
Änderungen.

**Schutz des Bestands.** Er ist mehrfach gesichert, damit er nicht an Disziplin
hängt:

1. Die neue App schreibt **nur**, wenn `RAUM.id === 'neuaufbau'` ist
   (`naAbgleich.schreiben`). Sonst zeigt sie nur einen Hinweis.
2. Jede Antwort des Servers muss `raum: 'neuaufbau'` tragen, sonst hält der
   Abgleich an.
3. Die Umleitung in `store.js` greift nur bei `RAUM.neu`. Im Bestand passiert
   dort nichts (Unit-Test und Browser-Test).
4. `sw.js` cacht die neue Seite unter einem eigenen Schlüssel
   (`neu/index.html`). Offline öffnet also nie die eine App statt der anderen.
5. `npm run check` verbietet in `public/neu` native Eingabefenster und den
   Gerätespeicher an `store` vorbei.

**Alte Oberfläche im Neuaufbau.** Setzt man `localStorage.hkl_neu_alt = '1'`
(außerhalb jedes Raums), erscheint sie wieder. Die älteren Browser-Tests nutzen
das.

## 5. Geprüft

- `npm test`: 1126 Tests grün, davon 21 in `test/neue-app.test.js` (Logik,
  Bild-Regeln, Kategorie-Vorschlag, Verknüpfungen, Vollständigkeit, PZN,
  Umleitung nur im Neuaufbau) und 8 in `test/register.test.js`
  (Register-Abfrage gegen eine Attrappe — der Test geht nie ins Internet).
- `npm run check`: grün, und die Prüfungen gelten jetzt auch für `public/neu`.
- `node e2e/neue-app.js` prüft 59 Punkte. Dabei ist die Anmeldung getippt, und
  jede Aktion läuft über sichtbare Schaltflächen. Abgedeckt sind:
  - Handy und PC, zwei Geräte im Abgleich;
  - der Bestand am Anfang und am Ende Byte für Byte gleich;
  - kein `na_*`-Schlüssel im Bestand;
  - der Live-Zeiger unberührt.
- `node e2e/neue-app-bilder.js` prüft 36 Punkte am echten Bedienweg:
  aufnehmen, drehen, zuschneiden (Maße des abgelegten Bildes), Anzeigebild
  nach Regel und nach Wahl, Original zurück, Bild an der Zeile im Standard,
  Großansicht, ältere Einträge, Etikettfoto mit Rolle „Etikett".
- `node e2e/neue-app-maske.js` prüft 60 Punkte an der Material-Maske: Scan
  mit dem echten Barcode-Leser (die „Kamera" ist eine Zeichenfläche mit einem
  EAN-13), Register-Attrappe, Hersteller mit Registriernummer, neue Felder,
  Kurzerfassung, Verknüpfungen, Schutz beim Verlassen, Speichern-und-nächstes,
  Variante, Filter „unvollständig", Zubehör-Frage und Ersatz im Standard,
  Register abschaltbar, Bestand unverändert.
- Die älteren Suiten, die den Neuaufbau betreten (`neuaufbau`, `liveschalter`,
  `editor`, `produkt`, `erfassung`), sind grün.
- **Messung** (`node e2e/messen-aufgaben.js`): zehn Alltagsaufgaben, gezählt in
  Tipps ohne Texteingabe. Jede Aufgabe prüft am Ende, dass sie erledigt ist.

| Nr | Aufgabe | Bestand (Analyse) | Ziel | Neue App |
|---|---|---|---|---|
| 1 | Neues Material mit GTIN/REF/Hersteller erfassen und in Standard setzen | ≈ 12, 2 Masken, 4 Bildschirme | 6 | **5**, eine Maske (vor dem Umbau 7) |
| 2 | Vorhandenes Material in Standard setzen | 3 | 3 | **4** |
| 3 | Material überall umbenennen | Reichweiten-Regel über alle Zeilen | 1 Feld | **4** (inkl. Wirkungsvorschau) |
| 4 | Foto zu einem Material | 4 + Frage nach dem Bildort | 3 | **5**, ein Bildort (ein Tipp davon bestätigt Zuschnitt/Drehung) |
| 5 | Menge nur an einer Stelle | 3–4 + Prüfblatt | 2 | **2** |
| 6 | Dublette auflösen | 5 verschiedene Orte | 1 Ort | **5**, an einem Ort |
| 7 | Neuen Auswahlwert an Ort und Stelle (Lagerort) | nur in der Verwaltung oder gar nicht | 1 | **4** (2 davon Weg zum Feld) |
| 8 | Wiederfinden, was ich angelegt habe | kein Ort | Verzeichnis mit Suche | **2** + Suche |
| 9 | Neuen Standard aus bestehendem | 4 | 4 | **4** |
| 10 | Neues Gerät | nur, wenn es schon in einem Standard steht | eine Maske | **3** |

**Einordnung:** Aufgabe 1 liegt seit dem Umbau der Maske unter dem Ziel (die
Kategorie muss nicht mehr gewählt werden). Die Aufgaben 2 und 4 liegen einen
Tipp über dem Ziel.

- Die Ursachen sind die Bestätigung der Mehrfachauswahl („Übernehmen") und das
  ausdrückliche Speichern.
- Beides ist bewusst so, damit nichts unbemerkt geändert wird.
- Die Bestandswerte stammen aus der Analyse am Bedienweg und sind nicht mit
  demselben Skript gemessen. Sie sind deshalb nur grob vergleichbar.

**Die zwei echten Etiketten vom 09.11.2026** (Punktionskanüle Vygon,
3-Wege-Hahn B. Braun), mit dem Barcode-Leser aus den Fotos und den echten
Antworten von EUDAMED (aufgezeichnet am 10.11.2026):

| | vorher (vom Betreiber erfasst) | neue Maske |
|---|---|---|
| Barcode lesen | ging nicht (Texterkennung las höchstens die REF) | 0,1–0,5 s je Foto |
| Hersteller | „VYCON", „B\|BRAUN" (getippt) | Vygon / B. Braun Melsungen, mit SRN |
| Handelsname, REF, steril, Latex, Einmal | getippt oder fehlend | aus dem Register |
| Kategorie | von Hand gesucht, eine neu angelegt | vorgeschlagen (EMDN A018003, A0703) |
| erstes Material | ≈ 11 Tipps, 34–48 Zeichen | **8 Tipps, 14 Zeichen** (davon 9 für den neuen Lagerort) |
| zweites Material | | **5 Tipps, 3 Zeichen** |
| Kern-Angaben vollständig | nein | ja, beide |

Gezählt ist mit Kamera (ein Tipp für den Scan). Zeiten sind Maschinenzeiten,
keine Bedienzeiten eines Menschen. Am 10.11.2026 abends antwortete EUDAMED
über eine Minute lang nicht: Der erste Scan wartete dann 7,8 s und meldete
„nicht erreichbar", der zweite 0,5 s (Pause für das ausgefallene Register);
die GTIN war in beiden Fällen übernommen, die Maske blieb bedienbar.

## 6. Was die neue App (noch) nicht hat — Entscheidung vor dem Umschalten

Die neue App beginnt **leer** (Entscheidung G1). Diese Funktionen der alten App
gibt es in ihr **nicht**:

| Funktion der alten App | Stand |
|---|---|
| die 47 eingelesenen Word-Standards, Referenzkatalog, Material des Bestands | bewusst nicht übernommen (G1). Aufbau von Hand oder späterer Import. |
| Austauschgruppen (E2) | **vorhanden** seit 10.11.2026 als Verknüpfungen am Material (Ersatz, Zubehör, Aufbereitung) |
| Arzt-Varianten, Verfahrenszweige (E3) | Rückstand |
| Freigabe + Fassungen (E4) | Rückstand |
| Anleitungen (E7), Glossar, Pop-ups mit Kalibrierwert (A1) | Rückstand |
| Änderungsvorschläge (E18), Notizen (E22) | Rückstand |
| Aktuelles (Pinnwand), Aufgaben | nicht Teil der Standards. Als eigenes Modul entscheiden. |
| Bestellungen | ersetzt durch **Meldungen** (A2) |
| Register-Abfrage (EUDAMED, sonst GUDID) | **vorhanden** seit 10.11.2026 |
| PDF-Druck, Suche über alles | Rückstand |
| Bildbearbeitung (zuschneiden, drehen, Anzeigebild) | **vorhanden** seit 09.11.2026 |
| Design und Texte frei einstellbar (E16) | Rückstand |
| Massenänderung „in Verwendungen ändern", Bilder in der Sicherung | Rückstand |

Ehrliche Folge: Würde heute live geschaltet, sähe das Labor nur, was im
Neuaufbau aufgebaut wurde, und **keine** der Funktionen oben. Der Umschalt-Prompt
prüft das deshalb als Erstes.

## 7. Bekannte Grenzen

- Konflikte werden je Objekt aufgelöst; es gilt die letzte Änderung (siehe 4).
- Bilder liegen auf dem Server (Medienordner des Neuaufbaus) und werden dort
  mitgesichert, aber **nicht** in der JSON-Sicherung.
- Die Etikett-Erkennung (Tesseract) läuft lokal auf dem Gerät. Der Barcode
  hängt nicht mehr am Browser: Wo `BarcodeDetector` fehlt (iPhone, iPad, PC),
  liest zxing. Die Kamera braucht HTTPS und die Freigabe des Nutzers; sonst
  bietet der Scanner das Foto an.
- Register: Nicht jedes Produkt steht darin (Stichprobe mit 14 echten GTINs:
  EUDAMED 7, GUDID 10, eines von beiden 12). Die GTIN eines Umkartons kann
  fehlen, wenn nur die der Einzelpackung gemeldet ist. Amtliche Namen
  unterscheiden sich zwischen den Registern; deshalb Kurzname + amtlicher Name
  + SRN. Ein über das Register angelegter Hersteller bleibt in der Liste, auch
  wenn die Maske danach verworfen wird.
- Der Kategorie-Vorschlag trifft nicht immer (Messung am Bestand: 69 % der
  Bezeichnungen, 82 % der Zeilen). Er ist deshalb als Vorschlag gekennzeichnet
  und mit einem Tipp änderbar.
- Bilder lassen sich ohne Netz nicht hochladen.
- Die alten Fehler im Bestand bleiben wie entschieden unangetastet:
  - `pricing.js` liest `hkl_prod`;
  - `erfKategorieAnlegen` überschreibt `k_`;
  - `BACKUP_KEYS` unvollständig;
  - Zeitzonenfehler in `geraetNaechstePruefung`.
