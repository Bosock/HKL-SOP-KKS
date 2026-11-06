# Die neue App im Neuaufbau

**Stand:** 06.11.2026 · Cache-Version `v79` · Code: `public/neu/`

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

Die Material-Maske der Verwaltung, Schritt für Schritt:

1. **Kategorie zuerst.** Sie bestimmt die Felder.
2. **Etikett lesen.** Die Etikett-Erkennung der alten App wird unverändert
   wiederverwendet. Eine unsicher gelesene REF wird nur vorgeschlagen.
3. **GTIN.** Die Prüfziffer wird sofort geprüft. Eine GTIN gibt es nur einmal.
4. **REF** und **Hersteller.** Der Hersteller wird aus dem GTIN-Präfix
   vorgeschlagen.
5. **Merkmale.** ★-Felder stehen zuerst. Werte und neue Felder lassen sich an
   Ort und Stelle anlegen.
6. **Name** mit Vorschlag aus Kategorie und Merkmalen.
7. Weitere Felder: Lagerort, Bereich, Fotos, Preis je Bezugsmenge.
8. Danach: „Verwendet in", Dublette zusammenführen, archivieren, Papierkorb.

**Anwender und Verwaltung:** Die Anmeldung ist dieselbe wie im Neuaufbau
bisher: Verwaltungspasswort, Vorgabe „abcdefg", eine Stunde Sitzung. Sie ist
Komfort, keine Sicherheit (A9).

## 4. Aufbau (technisch)

```
public/neu/index.html     eigene Seite; nutzt ../css/app.css (gleiches Aussehen)
public/neu/neu.css        nur Ergänzungen
public/neu/js/kern.js     reine Logik, ohne DOM/Speicher → test/neue-app.test.js
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
- `data/merkmale.json`

**Datenmodell** (geteilter Zustand des Raums Neuaufbau). Jedes Objekt ist ein
eigener Schlüssel; der Server ersetzt beim Speichern nur gesendete Schlüssel.

| Schlüssel | Inhalt |
|---|---|
| `na_m_<id>` | Material: name, kategorie, gtin, ref, hersteller (Kennung), merkmale{}, lagerort, bereich, fotos[], preis{betrag, bezugsmenge}, notiz, archiviert |
| `na_g_<id>` | Gerätetyp: name, kategorie, hersteller, modell, lagerort, bereich, fotos[], hinweis |
| `na_d_<id>` | Medikament: name, wirkstoff, konzentration, darreichung, lagerort, bereich, preis, hinweis |
| `na_s_<id>` | Standard: titel, gruppe, kennzeichen[], rubriken[{id, name, abschnitte[{id, name, positionen[{id, art, ref{typ,id} \| text, menge, zusatz, bereich, ansage}]}]}] |
| `na_b_<id>` | Baustein: name, positionen[] |
| `na_l_<liste>` | Liste: eintraege[{id, name, angelegt, wo, archiviert, …}]; bei `kategorien`: tpl {klassen, merkmale, werte} als Overlay auf `data/merkmale.json` |
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

- `npm test`: 1109 Tests grün, davon 13 neu (`test/neue-app.test.js`: Logik
  sowie Umleitung nur im Neuaufbau).
- `npm run check`: grün, und die Prüfungen gelten jetzt auch für `public/neu`.
- `node e2e/neue-app.js` prüft 52 Punkte. Dabei ist die Anmeldung getippt, und
  jede Aktion läuft über sichtbare Schaltflächen. Abgedeckt sind:
  - Handy und PC, zwei Geräte im Abgleich;
  - der Bestand am Anfang und am Ende Byte für Byte gleich;
  - kein `na_*`-Schlüssel im Bestand;
  - der Live-Zeiger unberührt.
- Die älteren Suiten, die den Neuaufbau betreten (`neuaufbau`, `liveschalter`,
  `editor`, `produkt`, `erfassung`), sind grün.
- **Messung** (`node e2e/messen-aufgaben.js`): zehn Alltagsaufgaben, gezählt in
  Tipps ohne Texteingabe. Jede Aufgabe prüft am Ende, dass sie erledigt ist.

| Nr | Aufgabe | Bestand (Analyse) | Ziel | Neue App |
|---|---|---|---|---|
| 1 | Neues Material mit GTIN/REF/Hersteller erfassen und in Standard setzen | ≈ 12, 2 Masken, 4 Bildschirme | 6 | **7**, eine Maske |
| 2 | Vorhandenes Material in Standard setzen | 3 | 3 | **4** |
| 3 | Material überall umbenennen | Reichweiten-Regel über alle Zeilen | 1 Feld | **4** (inkl. Wirkungsvorschau) |
| 4 | Foto zu einem Material | 4 + Frage nach dem Bildort | 3 | **4**, ein Bildort |
| 5 | Menge nur an einer Stelle | 3–4 + Prüfblatt | 2 | **2** |
| 6 | Dublette auflösen | 5 verschiedene Orte | 1 Ort | **5**, an einem Ort |
| 7 | Neuen Auswahlwert an Ort und Stelle | nur in der Verwaltung oder gar nicht | 1 | **4** (2 davon Weg zum Feld) |
| 8 | Wiederfinden, was ich angelegt habe | kein Ort | Verzeichnis mit Suche | **2** + Suche |
| 9 | Neuen Standard aus bestehendem | 4 | 4 | **4** |
| 10 | Neues Gerät | nur, wenn es schon in einem Standard steht | eine Maske | **3** |

**Einordnung:** Die Aufgaben 1, 2 und 4 liegen einen Tipp über dem Ziel.

- Die Ursachen sind die Bestätigung der Mehrfachauswahl („Übernehmen") und das
  ausdrückliche Speichern.
- Beides ist bewusst so, damit nichts unbemerkt geändert wird.
- Die Bestandswerte stammen aus der Analyse am Bedienweg und sind nicht mit
  demselben Skript gemessen. Sie sind deshalb nur grob vergleichbar.

## 6. Was die neue App (noch) nicht hat — Entscheidung vor dem Umschalten

Die neue App beginnt **leer** (Entscheidung G1). Diese Funktionen der alten App
gibt es in ihr **nicht**:

| Funktion der alten App | Stand |
|---|---|
| die 47 eingelesenen Word-Standards, Referenzkatalog, Material des Bestands | bewusst nicht übernommen (G1). Aufbau von Hand oder späterer Import. |
| Arzt-Varianten, Austauschgruppen (E2), Verfahrenszweige (E3) | Rückstand |
| Freigabe + Fassungen (E4) | Rückstand |
| Anleitungen (E7), Glossar, Pop-ups mit Kalibrierwert (A1) | Rückstand |
| Änderungsvorschläge (E18), Notizen (E22) | Rückstand |
| Aktuelles (Pinnwand), Aufgaben | nicht Teil der Standards. Als eigenes Modul entscheiden. |
| Bestellungen | ersetzt durch **Meldungen** (A2) |
| PDF-Druck, Suche über alles, GUDID-Abfrage, Bildbearbeitung | Rückstand |
| Design und Texte frei einstellbar (E16) | Rückstand |
| Massenänderung „in Verwendungen ändern", Bilder in der Sicherung | Rückstand |

Ehrliche Folge: Würde heute live geschaltet, sähe das Labor nur, was im
Neuaufbau aufgebaut wurde, und **keine** der Funktionen oben. Der Umschalt-Prompt
prüft das deshalb als Erstes.

## 7. Bekannte Grenzen

- Konflikte werden je Objekt aufgelöst; es gilt die letzte Änderung (siehe 4).
- Bilder liegen auf dem Server (Medienordner des Neuaufbaus) und werden dort
  mitgesichert, aber **nicht** in der JSON-Sicherung.
- Etikett-Erkennung und Barcode-im-Foto hängen am Gerät:
  - Tesseract läuft lokal;
  - `BarcodeDetector` gibt es nicht in jedem Browser. Ersatz:
    „⌨ Barcode-Text".
- Die alten Fehler im Bestand bleiben wie entschieden unangetastet:
  - `pricing.js` liest `hkl_prod`;
  - `erfKategorieAnlegen` überschreibt `k_`;
  - `BACKUP_KEYS` unvollständig;
  - Zeitzonenfehler in `geraetNaechstePruefung`.
