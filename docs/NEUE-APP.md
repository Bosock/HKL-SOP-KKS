# Die neue App im Neuaufbau

**Stand:** 18.11.2026 · Cache-Version `v87` · Code: `public/neu/`

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
2. **Pflichtangaben zum Produkt** (seit 18.11.2026, siehe unten): GTIN
   (Prüfziffer sofort, jede GTIN nur einmal), Hersteller, REF. Erst wenn sie
   beantwortet sind, öffnet sich der Rest der Maske.
3. **Weitere Produktangaben** — für alle Bereiche, freiwillig: Produktname des
   Herstellers, **SAP-Nummer**, freiwillige Felder des Hauses, Bilder.
4. **Im Bereich:** Name im Haus (vorbelegt mit dem Produktnamen des
   Herstellers, mit Vorschlägen aus den Bezeichnungen des Bestands und Hinweis
   auf vorhandene Einträge) und **Lagerort** (eine Liste statt Freitext, an
   Ort und Stelle erweiterbar).
5. **Mehr Angaben** — aufklappbar, alles freiwillig:
   - *Kategorie und Merkmale.* Die Kategorie ist ein **Vorschlag** (aus der
     Einordnung im Register oder aus einem Wort im Namen), kein Tor mehr. Acht
     Kategorien für Verbrauchsmaterial kamen dazu
     (`public/neu/daten/katalog-zusatz.json`). Die Kategorien gehören dem
     Haus (Grundsatz A7): Im Listen-Verzeichnis lassen sie sich umbenennen,
     zusammenführen, archivieren, neu anlegen, und ihre **Suchwörter**
     ändern (die Vorgabe ist zurückholbar). Welche Merkmale eine
     Kategorie hat, legt das Haus fest (siehe „Merkmale" unten).
   - *Steril · Einmal · Latex.*
   - *Packung und Preis* (Packungsgröße; „der Preis gilt für die ganze
     Packung" rechnet den Stückpreis).
   - *Verwendung · Suchwörter · PZN* (PZN mit Prüfziffer). Die Suche im
     Verzeichnis findet über alle drei.
   - *Verknüpfungen* (siehe unten).
   - *Bereich · Notiz.*
6. Über den Knöpfen steht, **was zum „vollständig" noch fehlt** (GTIN,
   Hersteller, REF, Lagerort, Produktbild, Kategorie; „gibt es nicht" zählt
   als vollständig, „unbekannt" und „nachtragen" nicht). Speichern geht,
   sobald die Pflichtangaben beantwortet sind; das Verzeichnis hat den Filter
   **„unvollständig"** und nennt je Zeile, was fehlt.
7. **Speichern und nächstes Material** für die Erfassung am Schrank: Lagerort
   und Bereich bleiben stehen, alles andere ist leer. **Als Variante kopieren**
   legt eine weitere Größe an (Familie bleibt; GTIN, REF, Bilder und
   Verknüpfungen nicht).
8. **Schutz:** Wer eine Maske mit ungespeicherten Eingaben verlässt (Reiter,
   „Zurück" des Geräts, Abbrechen), wird gefragt.
9. Danach wie bisher: „Verwendet in", Dublette zusammenführen, archivieren,
   Papierkorb.

**Pflichtangaben zum Produkt** (seit 18.11.2026). Was jedes Material hat,
egal in welchem Bereich, steht oben in der Maske und wird zuerst beantwortet:

- **GTIN, Hersteller, REF** sind Pflicht. Jede Angabe wird **eingetragen** oder
  ehrlich beantwortet: **„gibt es nicht"**, **„unbekannt"** oder
  **„nachtragen"**. Mit einem Wert verschwinden die drei Auswege; ein Wert
  schlägt immer den Ausweg (er wird beim Speichern entfernt). Nichts wird
  erfunden (Grundsatz ①).
- **Sperre:** Solange eine Pflichtangabe offen ist, zeigt die Maske nur
  „Erkennen" und die Pflichtangaben, darunter „🔒 Noch offen: …". Kein Name,
  kein Speichern. Ein Scan mit Treffer im Register beantwortet alle drei auf
  einmal. Zusammenführen, Archivieren und Papierkorb bleiben erreichbar.
- **Gilt überall, wo ein Material entsteht:** auch in der Kurzerfassung (das
  Blatt, mit dem man aus „Verknüpfungen" heraus ein zweites Material anlegt,
  ohne die Maske zu verlassen) und für alte Einträge — wer ein Material ohne
  Antworten öffnet, beantwortet sie einmal.
- **HIBC-Codes** (Barcodes mit „+" am Anfang, ohne GTIN): Kamera, Foto und
  Handscanner lesen daraus die REF; die GTIN bleibt offen.
- **Vor dem Speichern** fragt die Maske **einmal** nach, wenn Hersteller (nur
  mit Ausweg beantwortet), Produktname des Herstellers oder ein Produktfoto
  fehlen: „Jetzt ergänzen" springt zum Feld, „Trotzdem speichern" speichert.
  Das ist keine Pflicht.
- **SAP-Nummer:** freiwillig, nach und nach. Steht dieselbe Nummer schon bei
  einem anderen Material (führende Nullen und Leerzeichen zählen nicht), zeigt
  das Feld es sofort mit Verweis. Beim Speichern kommt die Frage „Trotzdem
  anlegen" / „Zurück zur Maske" — gewollt ist es z. B. bei Einzelstück und
  Karton mit verschiedenen GTINs.
- **Arbeitslisten im Verzeichnis:** „Pflichtangaben nachtragen" (offen oder
  „nachtragen"), „SAP-Nummer fehlt", „doppelte SAP-Nummer" — jeweils mit
  Anzahl, nur sichtbar, wenn es etwas zu tun gibt.
- **Erweiterbar (A7):** „＋ Feld für alle Produkte" (Verwaltung) macht ein
  vorhandenes oder neues Merkmal zur **Pflichtangabe** (oben, mit Auswegen,
  auch in der Kurzerfassung) oder zum **freiwilligen** Feld (bei „Weitere
  Produktangaben"). Zurück geht es auf der Seite des Merkmals: „Platz in der
  Material-Maske" → Pflicht / freiwillig / je nach Kategorie. Jede weitere
  Pflichtangabe kostet bei jedem Material Zeit — sparsam verwenden.

**Merkmale suchen, zuordnen, vorschlagen** (seit 12.11.2026). Kein eigenes
Menü: alles in der Maske und im Listen-Verzeichnis.

- **Suchen.** „＋ Merkmal suchen oder anlegen" öffnet DAS Auswahlfeld. Es
  durchsucht alle Merkmale, auch über Suchwörter: „Resterilisation" findet
  „Zulässige Wiederverwendungen", „Aufbereitungs-Zyklus" und
  „Resterilisierbar". Fehlt eines, wird es dort angelegt (Text, Zahl oder
  Ja/Nein), mit der üblichen Warnung vor Doppelungen.
- **Zuordnen.** Danach fragt die Maske einmal: gilt für *nur dieses
  Material* · *alle der Kategorie* · *alle der Kategorie, als Kern-Merkmal ★*.
  Die Masken aller Materialien der Kategorie passen sich sofort an. Nichts
  wird Pflicht. Die Zuordnung gilt sofort (auch wenn das Material danach
  verworfen wird) und steht im Verlauf.
- **Nur bei diesem Material.** Ein ausgefülltes Merkmal außerhalb der
  Kategorie bleibt am Material sichtbar und lässt sich dort später „für alle
  übernehmen".
- **Die App lernt — als Vorschlag.** Ist ein Merkmal bei mindestens der Hälfte
  der Materialien einer Kategorie ausgefüllt (mindestens 2, ab 3 Materialien),
  gehört aber nicht zu ihr, fragt die Maske: „Für alle übernehmen" oder „Nicht
  mehr vorschlagen".
- **Kategorie sichtbar.** Die vorgeschlagene Kategorie steht beim Namen (mit
  „ändern"); der Name im Haus schlägt beim Vorschlag den Text des Registers
  (ein „Verbindungskabel" bleibt ein Kabel).
- **Neue Kategorie wie eine andere.** Beim Anlegen (in der Maske oder im
  Listen-Verzeichnis) lassen sich die Merkmale einer vorhandenen Kategorie
  übernehmen („EPU-Kabel" wie „Kabel") — als Kopie, danach unabhängig.
- **Überblick.** Mehr → Listen-Verzeichnis → Material-Kategorien → Kategorie
  → „Merkmale dieser Kategorie": Kern ★ und weitere, je mit „bei n von m
  Materialien ausgefüllt"; antippen: Kern an/aus, Suchwörter, entfernen
  (eingetragene Werte bleiben).
- Gespeichert wird alles im Overlay `na_l_kategorien.tpl` (klassen.dazu/aus/
  diff/stumm/wie, merkmale, such); `data/merkmale.json` bleibt unverändert.

**Alle Merkmale an einer Stelle** (seit 13.11.2026). Mehr → Listen-Verzeichnis
→ **„Merkmale (Material)"**, gleich unter den Kategorien. Kein neues Menü: eine
weitere Liste im Verzeichnis, mit denselben Bedienmustern.

- **Liste.** Alle 100 mitgelieferten Merkmale und die eigenen des Hauses, nach
  Namen sortiert. Je Zeile: Art (Maß mit Einheit · Zahl · Auswahl · Text ·
  Ja/Nein), die Kategorien (★ = Kern) und „n× ausgefüllt". Die Suche geht über
  Name, Suchwörter, Einheit und Kategorie. Filter: alle · ausgefüllt · ohne
  Kategorie · eigene · geändert · archiviert (nur, was es gibt).
- **Seite eines Merkmals.** Angaben (Name, Art, Einheit, Hinweis unter dem
  Feld, Suchwörter), Auswahlwerte, Kategorien, „Ausgefüllt bei", darunter
  zum Nachlesen die Etikett-Erkennung.
- **Was sich ändern lässt:**

  | Angabe | mitgeliefertes Merkmal | eigenes Merkmal |
  |---|---|---|
  | Name | ja — unter dem alten Namen bleibt es auffindbar | ja |
  | Hinweis unter dem Feld | ja (auch leeren) | ja |
  | Suchwörter | ja | ja |
  | Auswahlwerte | anlegen, umbenennen, ausblenden, zurückholen | anlegen, umbenennen, entfernen |
  | Kategorien (Kern ★ / weiteres / entfernen) | ja | ja |
  | Art, Einheit | **nein** — die Etikett-Erkennung rechnet damit | ja |
  | Archivieren / zurückholen | ja | ja |
  | Löschen | nein | nur, solange es bei keinem Material ausgefüllt ist |

- **Wert umbenennen** ändert den Wert auch bei den Materialien, bei denen er
  eingetragen ist (das Blatt nennt die Zahl vorher).
- **Archiviert** heißt: nicht mehr in der Suche, in keiner Maske, kein
  Vorschlag, wird vom Etikett nicht mehr gefüllt. Ein eingetragener Wert bleibt
  beim Material sichtbar („Nur bei diesem Material").
- **„↺ Vorgabe zurückholen"** verwirft je Merkmal, was das Haus selbst
  festgelegt hat (Name, Hinweis, Werte, Suchwörter). Die Zuordnung zu
  Kategorien und alle eingetragenen Werte bleiben.
- **„＋ Neues Merkmal"** fragt bei ähnlichem Namen nach, dann die Art (Text ·
  Zahl · Auswahl · Ja/Nein) — dieselbe Frage wie in der Maske.
- Querverweise: Im Blatt „Merkmal in Kategorie" führt ein Tipp zur Seite des
  Merkmals und umgekehrt zur Kategorie.
- Gespeichert wird weiter nur die Abweichung des Hauses, im selben Overlay:
  `tpl.merkmale[<Kennung>]` trägt bei einer mitgelieferten Kennung
  `{label?, hinweis?, archiviert?}`, bei einer eigenen das ganze Merkmal;
  neu ist `tpl.werteAus` (ausgeblendete Werte der Vorgabe).
- **Grenze:** Mehrfachwerte, Umrechnungen und die Schreibmuster der
  Etikett-Erkennung sind mitgeliefert und hier nur zu lesen. Die Einteilung der
  Merkmale in feste Gruppen ist noch nicht entschieden und deshalb nicht
  gebaut.

**Aufbau aus dem Bestand** (seit 18.11.2026, nur am PC). Solange der Schalter
unter Einstellungen → „Aufbau aus dem Bestand" an ist (Vorgabe: an), öffnet
„Neuer Standard" nach dem Titel sofort einen **geteilten Bildschirm**: links
der neue, leere Standard im gewohnten Editor, rechts der Bestand als Quelle.
Übernommen wird nur, was mit der Maus herübergezogen wird — nichts kommt von
selbst. Beim Bearbeiten eines Standards ist die rechte Seite ebenfalls da;
✕ klappt sie zu (das Gerät merkt es sich), „📚 Bestand" im Editor öffnet sie.

- **Was rechts steht:** alle Standards des Bestands **so, wie das Labor sie
  heute sieht** — die eingelesenen Word-Standards plus alles, was die alte App
  darüberlegt: im Labor angelegte Standards und Zeilen, Textkorrekturen,
  ausgeblendete und umsortierte Rubriken und Zeilen, verschobene Zeilen,
  Regeln, eigene Abschnitte, Notizen. Dazu die Bausteine des Neuaufbaus.
  Gelesen wird beim Öffnen frisch vom Server (`GET /api/state` ohne Raum =
  Bestand); „↻" liest neu. **Der Bestand wird nie beschrieben.**
- **Suche** über alle Formulierungen, Word-Wortlaute, Zusätze, Abschnitts-
  und Rubriknamen und Standard-Titel. Gleiche Formulierungen stehen einmal da
  („Druckableitung vorbereiten — in 16 Standards"); ▸ zeigt alle Fundstellen
  als Standard › Rubrik › Abschnitt. Filter nach Gruppe und Rubrik.
- **Blättern** ohne Suche: Gruppe › Standard › Rubrik › Abschnitt › Zeilen.
- **Ziehen:**

  | gezogen | entsteht im neuen Standard |
  |---|---|
  | Zeile oder Formulierung | eine Zeile — vor oder nach der Zeile, auf die man sie fallen lässt (obere/untere Hälfte), ans Ende eines Abschnitts oder einer Rubrik, oder auf der Ablage unten als neue Rubrik |
  | „Word: …" unter einer Zeile | dieselbe Zeile mit dem Wortlaut der Word-Datei |
  | Notiz | eine Hinweis-Zeile |
  | Abschnitt | ein Abschnitt mit allen Zeilen, vor oder nach einem Abschnitt, ans Ende einer Rubrik oder als neue Rubrik |
  | Rubrik | eine Rubrik mit allen Abschnitten (die Notiz der Rubrik steht vorn) |
  | Baustein | seine Zeilen, als Kopie |

  Zeilen mit Kästchen 🔲 werden „Arbeitsschritt", die übrigen „Hinweis" —
  ein Vorschlag, änderbar über ✎. Menge und Zusätze (Spezifikation, „für …")
  kommen mit, was schon im Text steht, nicht doppelt. Neue Rubrik- und
  Abschnittsnamen landen in ihren Listen. Zeilen im Editor lassen sich auf
  denselben Wegen verschieben.
- **Material bleibt draußen:** Rubriken der Art „Material" (Materialien,
  Notfallmaterial) sind grau; ihre Zeilen lassen sich nicht ziehen und werden
  nicht durchsucht. Zieht man die ganze Rubrik, kommt nur die **Hülle**
  (Name und Abschnittsnamen, keine Zeile). Arbeitsschritte, die ein Material
  nennen („Wischdesinfektion mit Softasept"), stehen in anderen Rubriken und
  sind ziehbar.
- **Herkunft:** Jede übernommene Zeile merkt sich Standard, Stelle und
  Wortlaut (`herkunft`). Rechts trägt sie dann ✓ („in diesem Standard") oder
  ✓n („in n anderen neuen Standards"); jeder Standard zeigt „✓ x von y
  Zeilen". Das Positions-Blatt nennt die Herkunft. Die Zeile ist eine
  eigenständige Kopie: Spätere Änderungen im Bestand ändern sie nicht.
- **Nicht dabei**, weil es im Neuaufbau noch kein Gegenstück gibt:
  Arzt-Varianten, Verfahrenszweige, Anleitungen, Freigabe und Fassungen,
  Bilder des Bestands.
- **Nur am PC:** ab 1100 px Breite. Darunter steht im Editor ein Hinweis.
- **Ausgeschaltet** fragt „Neuer Standard" wieder „Womit beginnen?", und die
  rechte Seite öffnet sich nur über „📚 Bestand".

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
public/neu/js/bestand.js  der Bestand als Quelle: so aufbereitet, wie die alte App ihn
                          zeigt; Suche; Einfügen (rein) → test/aufbau.test.js
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
public/neu/js/aufbau.js   Aufbau aus dem Bestand: rechte Seite, Ziehen (auch Zeilen im Editor)
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
- **Die EU-Schnittstelle ist nicht verlässlich.** Gemessen am 10., 11. und
  13.11.2026, vier Störungen:

  | Störung | Was die App tut |
  |---|---|
  | langsam (2–9 s) | Zeitlimit 20 s (GUDID 8 s), insgesamt höchstens 30 s |
  | hängt (keine Antwort in 40 s) | Zeitlimit, dann Pause 2 min (wächst bis 5 min) |
  | „429 — zu viele Abfragen" (Grenze laut Antwortkopf: 500 je Minute) | verlangte Wartezeit einhalten; die App fragt höchstens 15-mal je Minute nach |
  | antwortet prompt „Data not found" — auch für Produkte, die sie führt (13.11.2026, über eine Stunde) | **Gegenprobe**, siehe unten |

- **Gegenprobe:** Auf jedes „nicht gefunden" von EUDAMED fragt der Server
  sofort nach einem Produkt, das EUDAMED nachweislich führt (zuerst eines, das
  er selbst dort schon gefunden hat; sonst eines aus `REGISTER_PRUEF_GTIN`).
  Kennt EUDAMED auch das nicht, ist es gestört — die Antwort zählt als
  Ausfall, nicht als Fehlanzeige. Kosten: eine zusätzliche Anfrage.
- **Drei Regeln, die daraus folgen:**
  1. Ein Treffer geht nie verloren. „Nicht gefunden" ersetzt ihn nicht, und
     nach Ablauf (30 Tage) wird er weiter ausgeliefert, wenn das Auffrischen
     scheitert.
  2. „Steht in keinem Register" wird nur gemerkt (24 Stunden), wenn beide
     Register geantwortet haben und EUDAMED die Gegenprobe bestanden hat.
     Ältere, ungesicherte Fehlanzeigen im Zwischenspeicher gelten nicht mehr —
     falsche Einträge aus einer Störung heilen so von selbst.
  3. **Der Server fragt von selbst nach.** Bleibt eine GTIN offen (Ausfall,
     oder GUDID-Treffer während EUDAMED fehlt), versucht er es nach 2, 5, 15,
     30, 60, 120, 240 Minuten und dann alle 6 Stunden, höchstens 20-mal.
     Meldet sich das Register zurück, kommt alles Offene sofort dran. Eine
     gesicherte Fehlanzeige wird nach einer Stunde einmal überprüft.
- Zwischenspeicher in `STATE_DIR/register-cache.json`, auch das Offene steht
  dort und übersteht einen Neustart.
- **Zustand sehen:** Einstellungen → „EU-Register" zeigt je Register
  „antwortet" oder „gestört seit … : Grund", die Zahl offener Abfragen und
  den Knopf „↻ Jetzt prüfen" (fragt beide Register mit einem bekannten
  Produkt). Dasselbe ohne App: `https://sops.kardio.wiki/api/register/zustand`
  (mit `?pruefen=1` wird vorher geprüft, höchstens alle 20 s). Die Antwort
  enthält Zeiten, Zähler und den Grund — keine GTIN.
- Umgebung: `REGISTER=0` (aus), `REGISTER_TIMEOUT_MS` (20000),
  `REGISTER_PAUSE_MS` (120000), `REGISTER_NACHFASSEN=0` (kein selbsttätiges
  Nachfragen), `REGISTER_NACHFASSEN_MIN` (Abstände), `REGISTER_PRUEF_GTIN`,
  `REGISTER_EUDAMED_URL`, `REGISTER_GUDID_URL`.
- **Nachholen:** Im Material-Verzeichnis (Verwaltung) steht „↻ Aus dem
  Register ergänzen (n)", solange Materialien eine gültige GTIN, aber noch
  keine Registerdaten haben. Ein Tipp schlägt alle nacheinander nach (höchstens
  15 je Minute), füllt nur leere Felder und lässt die Angaben „noch nicht
  bestätigt". Während einer Störung nennt der Tipp dem Server alle GTINs; er
  holt sie von selbst, und der nächste Tipp findet sie fertig vor.
- Der Server braucht dafür ausgehenden Zugriff auf
  `api.datalake.sante.service.ec.europa.eu` und `accessgudid.nlm.nih.gov`.
  Geprüft am 11. und 13.11.2026 auf sops.kardio.wiki: Der Zugang ist offen
  (GUDID antwortet in unter einer Sekunde). `REGISTER=0` in
  `~/hkl-sop-kks/.env` auf dem Server schaltet die Abfrage ab
  (docker-compose.yml reicht den Wert durch).
- **Was die App nicht kann:** Solange EUDAMED gestört ist, gibt es für
  Produkte, die nur dort stehen, keine Registerdaten — auch nicht über einen
  Umweg. Die öffentliche EUDAMED-Webseite weist automatische Abfragen ab und
  verweist auf diese Schnittstelle (geprüft 10.11.2026).

**Datenmodell** (geteilter Zustand des Raums Neuaufbau). Jedes Objekt ist ein
eigener Schlüssel; der Server ersetzt beim Speichern nur gesendete Schlüssel.

| Schlüssel | Inhalt |
|---|---|
| `na_m_<id>` | Material: name, handelsname, kategorie, gtin, ref, sap, pflicht{gtin\|hersteller\|ref\|<Merkmal>: 'gibtsnicht'\|'unbekannt'\|'nachtragen'} (nur, wo kein Wert steht), pzn, hersteller (Kennung), merkmale{}, lagerort (Kennung der Liste `lagerorte`), bereich, packung, verwendung, suchwoerter, verknuepfungen[{art, ziel, sorte, grund}], register{quelle, abgerufen, bestaetigt, hersteller, srn, bezeichnung, einordnung, basisUdi, gtin}, varianteVon, fotos[{k, v, rolle, titel, orig, origV}], hauptbild, preis{betrag, bezugsmenge}, notiz, archiviert |
| `na_g_<id>` | Gerätetyp: name, kategorie, hersteller, modell, lagerort, bereich, fotos[], hinweis |
| `na_d_<id>` | Medikament: name, wirkstoff, konzentration, darreichung, lagerort, bereich, preis, hinweis |
| `na_s_<id>` | Standard: titel, gruppe, kennzeichen[], rubriken[{id, name, abschnitte[{id, name, positionen[{id, art, ref{typ,id} \| text, menge, zusatz, bereich, ansage, herkunft{q:'bestand', std, titel, z, t}}]}]}] |
| `na_b_<id>` | Baustein: name, positionen[] |
| `na_l_<liste>` | Liste: eintraege[{id, name, angelegt, wo, archiviert, …}]; bei `hersteller` zusätzlich amtlich, srn; bei `kategorien`: tpl {klassen{dazu, aus, diff, stumm, wie, worte}, merkmale, werte, werteAus, such, global[{mid, pflicht}]} als Overlay auf `data/merkmale.json`; `na_l_einstellungen`: werte{register, aufbau} |
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

- `npm test`: 1155 Tests grün, davon 6 in `test/aufbau.test.js` (Aufbereitung des
  Bestands mit allen Arten von Labor-Änderungen, Suche, Einfügen an jedem Ziel,
  Material nur als Hülle, ✓ „schon übernommen"), 36 in `test/neue-app.test.js` (Logik,
  Bild-Regeln, Kategorie-Vorschlag, Verknüpfungen, Vollständigkeit, PZN,
  Pflichtangaben, SAP-Nummer, HIBC,
  Umleitung nur im Neuaufbau) und 16 in `test/register.test.js`
  (Register-Abfrage gegen eine Attrappe, die auch die gemessenen Störungen
  der EU-Schnittstelle nachstellt — der Test geht nie ins Internet).
- `npm run check`: grün, und die Prüfungen gelten jetzt auch für `public/neu`.
- `node e2e/neue-app.js` prüft 61 Punkte. Dabei ist die Anmeldung getippt, und
  jede Aktion läuft über sichtbare Schaltflächen. Abgedeckt sind:
  - Handy und PC, zwei Geräte im Abgleich;
  - der Bestand am Anfang und am Ende Byte für Byte gleich;
  - kein `na_*`-Schlüssel im Bestand;
  - der Live-Zeiger unberührt.
- `node e2e/neue-app-bilder.js` prüft 36 Punkte am echten Bedienweg:
  aufnehmen, drehen, zuschneiden (Maße des abgelegten Bildes), Anzeigebild
  nach Regel und nach Wahl, Original zurück, Bild an der Zeile im Standard,
  Großansicht, ältere Einträge, Etikettfoto mit Rolle „Etikett".
- `node e2e/neue-app-pflicht.js` prüft 43 Punkte an den Pflichtangaben:
  Sperre und drei Auswege, Wiederöffnen und -schließen, Erinnerung vor dem
  Speichern (einmal je Maske), SAP-Nummer doppelt („Zurück zur Maske" /
  „Trotzdem anlegen"), Arbeitslisten im Verzeichnis, alte Einträge ohne
  Antworten, HIBC aus dem Handscanner, „＋ Feld für alle Produkte" bis in die
  Kurzerfassung und zurück über die Seite des Merkmals, Bestand unverändert.
- `node e2e/neue-app-maske.js` prüft 108 Punkte an der Material-Maske: Scan
  mit dem echten Barcode-Leser (die „Kamera" ist eine Zeichenfläche mit einem
  EAN-13), Register-Attrappe, Hersteller mit Registriernummer, neue Felder,
  Kurzerfassung, Verknüpfungen, Schutz beim Verlassen, Speichern-und-nächstes,
  Variante, Filter „unvollständig", Zubehör-Frage und Ersatz im Standard,
  Register abschaltbar, Bestand unverändert.
- `node e2e/neue-app-aufbau.js` prüft 29 Punkte am PC (1440 × 900). **Treue:**
  Der Bestand bekommt Änderungen wie im Labor; die alte App zeigt jeden
  Standard, und die rechte Seite ergibt für alle 47 dieselben Rubriken,
  Abschnitte und Zeilen. Dann alle Zieh-Wege, Material gesperrt, Zuklappen,
  schmaler Bildschirm, Schalter aus — und der Bestand Byte für Byte gleich.
  Zusätzlich geprüft am 18.11.2026 mit einer Kopie des echten Laborstands
  (lokal; der Live-Server wurde nur gelesen): 49 Standards, 300 Rubriken,
  4.286 Zeilen — gleich.
- Die älteren Suiten, die den Neuaufbau betreten (`neuaufbau`, `liveschalter`,
  `editor`, `produkt`, `erfassung`), sind grün.
- **Messung** (`node e2e/messen-aufgaben.js`): zehn Alltagsaufgaben, gezählt in
  Tipps ohne Texteingabe. Jede Aufgabe prüft am Ende, dass sie erledigt ist.

| Nr | Aufgabe | Bestand (Analyse) | Ziel | Neue App |
|---|---|---|---|---|
| 1 | Neues Material mit GTIN/REF/Hersteller erfassen und in Standard setzen | ≈ 12, 2 Masken, 4 Bildschirme | 6 | **6**, eine Maske (vor dem Umbau 7; seit 18.11. einer mehr: die Erinnerung vor dem Speichern) |
| 2 | Vorhandenes Material in Standard setzen | 3 | 3 | **4** |
| 3 | Material überall umbenennen | Reichweiten-Regel über alle Zeilen | 1 Feld | **5** (inkl. Wirkungsvorschau und Erinnerung) |
| 4 | Foto zu einem Material | 4 + Frage nach dem Bildort | 3 | **6**, ein Bildort (ein Tipp bestätigt Zuschnitt/Drehung, einer die Erinnerung) |
| 5 | Menge nur an einer Stelle | 3–4 + Prüfblatt | 2 | **2** |
| 6 | Dublette auflösen | 5 verschiedene Orte | 1 Ort | **5**, an einem Ort |
| 7 | Neuen Auswahlwert an Ort und Stelle (Lagerort) | nur in der Verwaltung oder gar nicht | 1 | **4** (2 davon Weg zum Feld) |
| 8 | Wiederfinden, was ich angelegt habe | kein Ort | Verzeichnis mit Suche | **2** + Suche |
| 9 | Neuen Standard aus bestehendem | 4 | 4 | **4** |
| 10 | Neues Gerät | nur, wenn es schon in einem Standard steht | eine Maske | **3** |

**Einordnung:** Aufgabe 1 liegt auf dem Ziel (die Kategorie muss nicht mehr
gewählt werden). Seit den Pflichtangaben (18.11.2026) kostet das Speichern
eines Materials ohne Produktname oder Produktfoto einen Tipp mehr: die
Erinnerung „Vor dem Speichern" (einmal je Maske, gewollt). Aufgabe 2 liegt
einen Tipp über dem Ziel, Aufgabe 4 drei (einer davon ist die Erinnerung).

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

Gezählt ist mit Kamera (ein Tipp für den Scan), vor den Pflichtangaben vom
18.11.2026 und seitdem nicht neu gemessen: Mit Registertreffer sind GTIN,
Hersteller und REF sofort beantwortet; ohne Produktfoto kommt beim Speichern
die Erinnerung (ein Tipp) dazu. Zeiten sind Maschinenzeiten,
keine Bedienzeiten eines Menschen. Am 10.11.2026 abends antwortete EUDAMED
über eine Minute lang nicht: Der erste Scan wartete dann 7,8 s und meldete
„nicht erreichbar", der zweite 0,5 s (Pause für das ausgefallene Register);
die GTIN war in beiden Fällen übernommen, die Maske blieb bedienbar.

**Etikett lesen an zehn echten Fotos vom Server (11.11.2026).** Wahrheit:
REF und Hersteller aus EUDAMED, bei zwei Produkten ohne Registereintrag vom
Etikett abgelesen.

| | REF sicher gelesen | REF als 1. Vorschlag | Hersteller richtig |
|---|---|---|---|
| Etikett-Erkennung der alten App (`ocr.js`) | 4 / 10 | weitere 4 | 4 / 10 |
| dazu Herstellersuche der neuen App (`naHerstellerImText`) | 4 / 10 | weitere 4 | **7 / 10** |

Der Herstellername stand in 8 der 10 gelesenen Texte. Vorher gewann zweimal
der Lohnfertiger („Manufacturing Site: … Erwin Busch GmbH"). Jetzt zählen
Zeilen über Fertigungsort, Vertrieb, Import und EU-Bevollmächtigte nicht,
und ein Name aus der Herstellerliste des Hauses gewinnt. Steht der Hersteller
noch nicht in der Liste, bietet die Maske „Vom Etikett: … übernehmen" an.
Sicherer bleibt der Weg über den Barcode und das Register.

## 6. Was die neue App (noch) nicht hat — Entscheidung vor dem Umschalten

Die neue App beginnt **leer** (Entscheidung G1). Diese Funktionen der alten App
gibt es in ihr **nicht**:

| Funktion der alten App | Stand |
|---|---|
| die 47 eingelesenen Word-Standards, Referenzkatalog, Material des Bestands | bewusst nicht übernommen (G1). Aufbau von Hand — seit 18.11.2026 mit dem Bestand als Quelle daneben (Ziehen, ohne Material). |
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
