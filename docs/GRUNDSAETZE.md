# Grundsätze

**Was dieses Dokument ist.** Die Vorgaben, an die sich jede Änderung an dieser App
zu halten hat — die des Hauses (Teil A) und die der Entwicklung (Teil B). Sie sind
über Monate im Gespräch entstanden und standen bis jetzt nirgends. Damit galten sie
nur so lange, wie sich jemand an sie erinnerte.

**Wie es zu benutzen ist.** Vor jeder neuen Funktion Teil A lesen, danach Teil B.
Wer eine Regel für falsch hält, ändert *dieses Dokument* — und zwar bevor der Code
ihr widerspricht. Ein Widerspruch zwischen Code und Grundsatz ist immer ein Fehler
im Code, nie eine Ausnahme.

**Wer entscheidet.** Teil A gehört dem Haus. Nur der Auftraggeber ändert Teil A.
Teil B ist Handwerk; Vorschläge dazu sind willkommen, brauchen aber eine
Begründung im Dokument.

Zwei der Regeln werden inzwischen **maschinell** überwacht — `npm run check` bricht
ab, wenn sie verletzt werden (siehe [Teil C](#teil-c--was-die-maschine-prüft)).

---

## Teil A — Vorgaben des Hauses

Jede Regel steht in drei Teilen: **die Regel** · **warum** · **woran man einen
Verstoß erkennt**.

### A1 · Keine Patientendaten

> „DSGVO ist absolut und vollkommen irrelevant! Keine Patientendaten vorhanden!"

**Die Regel.** In dieser App gibt es keine patientenbezogenen Daten. Keine Namen,
keine Fallnummern, keine Befunde, keine Termine mit Personenbezug. Der Satz oben
ist kein Freibrief, sondern seine Umkehrung: Datenschutz ist deshalb kein Thema,
**weil** nichts Schützenswertes hineinkommt. Kommt es hinein, ist alles andere in
diesem Dokument hinfällig.

**Warum.** Die App ist eine Arbeits- und Organisationshilfe für Material, Geräte
und Abläufe. Sie hat keinen Zugang zum KIS, keine Anmeldung je Person und kein
Berechtigungskonzept — sie ist für Patientendaten schlicht nicht gebaut.

**Verstoß erkennt man an.** Einem neuen Feld, das eine Person meinen könnte:
„Patient", „Fall", „Termin", „Aufnahme", „Diagnose", freies Notizfeld am Eingriff.
Ein Freitextfeld, in das jemand *versehentlich* einen Patientennamen schreiben
könnte, ist bereits der Fehler — nicht erst der eingetragene Name.

### A2 · Keine Bestandsführung — Charge und Verfallsdatum sind irrelevant

> „Verfallsdatum und Charge sind irrelevant"

**Die Regel.** Die App sammelt *Wissen* über Material (was ist es, wie sieht es
aus, wo liegt es, wofür braucht man es). Sie führt keinen Bestand: keine
Chargenverfolgung, keine Verfallsüberwachung, keine Mengen im Lager, keine
Bestellungen, keine Rückrufe.

**Warum.** Bestandsführung ist Aufgabe der Materialwirtschaft des Hauses. Eine
zweite, unvollständige Buchhaltung daneben wäre gefährlicher als keine — man würde
ihr glauben. Außerdem beginnt an dieser Grenze der Bereich, in dem eine Software zu
einem Medizinprodukt werden kann (siehe README, Abgrenzung MDR).

**Verstoß erkennt man an.** Feldern namens `lot`, `charge`, `expiry`, `verfall`,
`bestand`, `menge_lager`, an einer Ansicht „bald abgelaufen", an einer Warnung beim
Scannen.

**Zulässige Ausnahme, bewusst.** Der Barcode-Leser *zerlegt* GS1-Codes vollständig,
also auch die Felder für Charge (AI 10) und Verfall (AI 17). Das muss er, sonst
kann er die Produktnummer nicht sicher von den übrigen Feldern trennen. Er
**behält** von einem Scan aber nur die GTIN und die Hersteller-Referenz —
`scanner.js`, Funktion `handleScan`. Alles andere wird verworfen und nirgends
gespeichert.

> **Behobener Widerspruch (04.08.2026).** In `scanner.js` stand eine Funktion
> `expiryStatus()`, die zu einem Verfallsdatum „abgelaufen / bald / ok" berechnete.
> Sie wurde nirgends aufgerufen, war aber der Anfang genau der Bestandsführung, die
> hier ausgeschlossen ist. Sie ist entfernt.

### A3 · Das Kennwort des Defibrillators wird nicht gespeichert

> „wir speichern einfach nur die Verfahren, nicht dieses Geheimnis speichern"

**Die Regel.** Verfahren und Handgriffe zum Umprogrammieren von Geräten dürfen in
der App stehen. Das Kennwort selbst nicht — weder im Text eines Eintrags noch in
einem Feld, einem Foto oder einer Anleitung.

**Warum.** Das Kennwort ist eine Sicherheitsbarriere des Herstellers. Die App liegt
auf jedem Tablet des Labors und im geteilten Zustand auf dem Server; sie ist der
falsche Ort dafür.

**Verstoß erkennt man an.** Einem Schritt „Kennwort eingeben: …" in einer Anleitung,
einem Foto eines Bildschirms mit sichtbarer Eingabe.

### A4 · Keine personenbezogenen Zugriffsprotokolle

**Die Regel.** Die App protokolliert **Änderungen** (was wurde wann geändert,
welche Regel greift warum — das Journal unter *Regeln & Journal*). Sie protokolliert
**nicht**, wer wann was *angesehen* hat. Ein Name an einer Änderung ist eine
freiwillige Angabe zur Nachvollziehbarkeit, keine Anmeldung.

**Warum.** Eine Auswertung „wer hat wie oft nachgeschaut" wäre eine
Leistungskontrolle. Sie ist mitbestimmungspflichtig, war nie beauftragt und würde
das Vertrauen in ein Werkzeug zerstören, das gerade dann helfen soll, wenn jemand
etwas nicht weiß.

**Verstoß erkennt man an.** Einem Ereignis „geöffnet", „gelesen", „gesucht" mit
Benutzerkennung; einer Statistik je Person; einem Pflichtfeld „Name" vor dem Lesen.

### A5 · Recherchierte Angaben tragen Quelle und Status

**Die Regel.** Alles, was nicht aus dem Haus kommt, sondern aus dem Netz oder von
einer Herstellerseite, wird mit **Quelle** und mit dem Status **„unbestätigt"**
gespeichert und auch so angezeigt. Erst wenn jemand aus dem Labor es prüft, wird
daraus „bestätigt". Produkte des Anbieters **Vanguard** werden nicht recherchiert
(aufbereitete Ware; die Herstellerangaben passen nicht auf das, was im Regal liegt).

**Warum.** Eine Zahl ohne Herkunft ist im klinischen Alltag wertlos bis gefährlich.
Der sichtbare Unterschied zwischen „gefunden" und „geprüft" ist die einzige
Absicherung, die eine solche App überhaupt bieten kann.

**Verstoß erkennt man an.** Einem recherchierten Wert, der ohne Kennzeichen wie ein
Hauswert aussieht; einem Import, der `status` leer lässt.

### A6 · Die Excel-Liste ist nicht Teil der App

> „wenn du sie nutzt (auch in der Analyse) dann muss diese ignoriert werden, denn
> es ist nicht App-inhärent sondern zusätzlich!"

**Die Regel.** Die Materialliste als Tabellenblatt ist eine Zulieferung von außen.
Sie darf nicht Grundlage von Zahlen, Auswertungen oder Analysen über die App sein
und gehört nicht in das Repository.

**Warum.** Was nicht in der App liegt, kann die App nicht garantieren. Eine Analyse,
die heimlich aus einer Nebenquelle schöpft, beschreibt einen Zustand, den es im
Produkt nicht gibt.

**Verstoß erkennt man an.** Einer Kennzahl, die sich aus den Daten unter
`public/data/` nicht nachrechnen lässt.

### A7 · Volle Kontrolle ohne Entwickler und ohne KI

> „ich möchte vollkommene Kontrolle über die App haben … ohne dich dazu als Coding
> Agent zu nutzen"

**Die Regel.** Jede Funktion, jedes Menü, jede Bezeichnung, jede Farbe, jede
Kategorie muss sich **in der App selbst** einstellen lassen — verständlich,
zuverlässig, rücknehmbar. Was nur durch Ändern einer Datei einstellbar ist, ist
nicht eingestellt, sondern programmiert.

**Warum.** Ein Werkzeug, dessen Anpassung von der Verfügbarkeit eines Entwicklers
abhängt, veraltet in dem Moment, in dem der Entwickler weg ist. Das Labor ändert
sich schneller als jeder Entwicklungszyklus.

**Wie es umgesetzt ist.** Vier Stufen, überall gleich
(`public/js/core/labels.js`, Funktion `bezWert`):

| Stufe | Quelle | wer pflegt |
|---|---|---|
| ① | von Hand vergebener Einzelwert | die Nutzerin, direkt am Objekt |
| ② | eigene Änderung (`hkl_bezeichnungen`) | die Nutzerin, in der Verwaltung |
| ③ | mitgelieferte Datei (`data/bezeichnungen.json`) | Auslieferung |
| ④ | Rückfall im Code | nur damit die App auch ohne Datei startet |

**Wo das heute greift** (Stand 06.08.2026 — die Liste ist der Prüfstand für
jede neue Funktion):

| Fläche | einstellbar in der App |
|---|---|
| Menü ☰ | an/aus · Symbol · Name · Untertitel · Reihenfolge · eigene Punkte |
| Symbole der Kopfleiste | Lupe · Anmeldung · Hell/Dunkel je an/aus |
| Verwaltungs-Karten | an/aus · Symbol · Name · Beschreibung · Reihenfolge |
| **Bearbeiten-Menü ⋯** (Eintrag · Standard · Rubrik) | je Punkt an/aus · Symbol · Name · Untertitel · Reihenfolge; ganze Gruppen abschaltbar |
| **Standardkopf** | zehn Bausteine je an/aus · Wortlaut · Reihenfolge |
| Merkmalsleiste der Startseite | je Merkmal an/aus, Namen frei |
| **Merkmale an Standards** | anlegen · Wort · Symbol · Farbe · Art · Werte · im Kopf zeigen · als Reichweite freigeben |
| **Bereiche** (zweite Sicht aufs Material) | anlegen · Wort · Symbol · Farbe · Reihenfolge |
| **Baustein-Kategorien** | anlegen · Wort · Symbol · Reihenfolge |
| **Pflege-Weg** (Schritte je Material) | je Schritt an/aus · Symbol · Wort · Untertitel · Reihenfolge · eigene Schritte als Handhaken; je Material einzeln „entfällt" |
| **Bild-Darstellung** | Größe je Bild und Stelle (klein · mittel · groß), jederzeit änderbar |
| **Schrift** | Größe und Gewicht je Zeile; Zeichen für Wort-Auszeichnungen frei wählbar |
| Kategorien | Name · Farbe · Symbol · eigene anlegen und löschen |
| Bezeichnungen | Hersteller · Größenarten · Rubriknamen · Merkmale · Freigabewörter · Bildgrößen · Schriftgrößen · Auszeichnungen · Merkmalsarten |
| Texte | App-Titel und die Einleitungen |
| Anzeige im Eintrag | jedes Feld einzeln ein-/ausblendbar |
| Inhalte | Standards · Rubriken · Einträge · Unterkategorien · Pop-ups · Anleitungen · Arzt-Varianten · Bausteine · Bilder · Austauschgruppen · Verfahrenszweige |

**Die Grenze, bewusst gezogen.** Nicht einstellbar sind (a) vier Menüpunkte —
Verwaltung, Anmelden, Abmelden, „Problem melden" — und ☰ selbst: wer sie
ausblenden könnte, sperrte sich mit einem Tipp aus; (b) die Knöpfe *innerhalb*
eines Formulars (Abbrechen, Speichern, Zurück). „Speichern" ausblenden zu
können wäre keine Freiheit, sondern eine Falle.

**Verstoß erkennt man an.** Einer festen Liste im Code, die eigentlich das Haus
pflegen müsste (Hersteller, Kategorien, Symbole, Rubriknamen, Statuswörter) —
oder einem neuen Knopf, der in dieser Tabelle keine Zeile findet.

### A8 · Deutsch, lesbar, mit Begründung

**Die Regel.** Bezeichner und Kommentare sind deutsch. Kommentare erklären das
**Warum**, nicht das Was. Wo eine Entscheidung überrascht, steht der Grund daneben
— am besten mit der Beobachtung, die dazu geführt hat.

**Warum.** Das Haus soll den Code lesen und ändern können, ohne ihn vorher zu
übersetzen. Ein „Warum" spart die Ausgrabung des ursprünglichen Gesprächs.

### A9 · Sicherheit ist zurückgestellt — aber nicht vergessen

**Die Regel.** Der Auftraggeber hat die Zugangssicherung bewusst zurückgestellt,
bis das Produkt inhaltlich fertig ist. Diese Entscheidung gilt. Sie darf aber in
keiner Analyse verschwiegen werden — offen ist heute:

1. Wer die Adresse kennt, kann den geteilten Zustand ohne Anmeldung abrufen.
2. Das Verwaltungskennwort liegt im geteilten Zustand mit.
3. Bearbeiten zwei Geräte gleichzeitig, kann eines das andere still überschreiben.

Punkt 3 ist der einzige, der im Alltag Daten kosten kann.

---

## Teil B — Grundsätze der Entwicklung

### ① Leer schlägt falsch

Im Zweifel **nichts** eintragen statt zu raten. Ein leeres Feld ist eine sichtbare
Lücke, die jemand füllt. Ein falsch geratenes Feld sieht aus wie Wissen und wird
nie wieder geprüft.

Praktisch: `art='unklar'` statt einer plausiblen Vermutung; ein Baustein schreibt
nur echte Abweichungen fort; der Assistent lässt Felder leer, die er nicht sicher
erkennt.

### ② Nichts verschlucken

Jedes Zeichen der Quelle landet in einem Feld **oder** sichtbar im Rest. Der Rest
steht oben, nicht im Kleingedruckten — er ist die Frage an den Menschen.

Praktisch: die Zerlegung führt einen Restbestand mit; der Import verwirft nichts
stillschweigend; wo etwas nicht zugeordnet werden kann, sagt die App das.

### ③ Der Mensch schlägt alles

Was ein Mensch eingetragen oder bestätigt hat, wird von keiner Automatik
überschrieben. Jede automatische Entscheidung ist ein Vorschlag und einzeln
zurücknehmbar.

Praktisch: bestätigte Merkmale bleiben bei erneuter Erkennung stehen; Regeln werden
nie gelöscht, sondern zurückgenommen (`revoke`); die Reichweiten-Frage stellt die
App, sie beantwortet sie nicht selbst.

### ④ Kein Fachwort im Code

Fachbegriffe — Kategorien, Orte, Präparate, Verben, Hersteller, Statuswörter —
stehen in Daten (`public/data/*.json`) und in der Konfiguration, nicht im Programm.

Die scharfe Fassung, die auch maschinell prüfbar ist:

> **Eine Zeichenkette, die jemand umbenennen kann, darf nicht in einem Vergleich
> stehen.**

Ein Wort, das *angezeigt* wird, ist eine Bezeichnung. Ein Wort, das *verglichen*
wird, ist Programmlogik. Beides in einem Wert zu führen heißt: Wer die Bezeichnung
ändert, ändert unbemerkt das Verhalten.

Wo ein Wert wirklich ein Schlüssel ist, der äußerlich wie ein deutsches Wort
aussieht (etwa `'bestätigt'` als fester Wert in einer mitgelieferten Datei), wird
das an Ort und Stelle begründet:

```js
if (r.katstatus !== 'bestätigt') …   /* fachwort:ok — fester Wert aus
                                        data/material_catalog.json, keine
                                        Anzeige-Bezeichnung */
```

### ⑤ Alles konfigurierbar (die technische Seite von A7)

Neue Bezeichnungen kommen als Zweig in `data/bezeichnungen.json` und bekommen ein
Feld in der Verwaltung (*Aussehen & Anzeige → Bezeichnungen*). Der Wert im Code ist
**Rückfall**, nie die Wahrheit.

### ⑥ Ein Menü, zwei Kontexte

Für eine Sache gibt es **ein** Bearbeiten-Menü. Es lässt sich an zwei Stellen
öffnen: direkt bei der Nutzung (⋯ an der Zeile, langes Drücken) und in der
Verwaltung. Kein zweites, verkürztes Menü an einer dritten Stelle.

**Warum.** Ein zweiter Weg mit weniger Rückfragen ist der gefährlichere: In der
Verwaltung fehlte lange die Reichweiten-Frage, dieselbe Handlung wirkte dort also
anders als im Saal — ohne dass es jemandem gesagt wurde.

### ⑦ Nicht in die Quelle schreiben (Overlay)

`public/data/hkl_standards_export.json` wird nie verändert. Alle Änderungen liegen
in Überlagerungen. Deshalb ist jede Änderung rücknehmbar und die Word-Vorlage bleibt
die Vorlage.

### ⑧ Keine nativen Eingabefenster

`prompt()` und `confirm()` sind in installierten PWAs (`display: standalone`) auf
mehreren Android-Chrome-Versionen wirkungslos: Es erscheint kein Dialog, der Aufruf
liefert sofort `null` — die Funktion schlägt **lautlos** fehl. Neue Eingaben laufen
über die Eingabeflächen der App (Sheet oder Formular).

Der Altbestand ist in `scripts/pruefungen/altlasten.json` gezählt und darf nur
kleiner werden.

### ⑨ Was nicht geprüft wird, ist nicht wahr

Reine Logik gehört in reine Funktionen mit `node:test`-Tests; Bedienwege in die
E2E-Läufe unter `e2e/`. Vor jedem Zusammenführen: `npm run check && npm test`.

---

## Teil C — Was die Maschine prüft

`npm run check` prüft fünf Dinge und bricht bei jedem Problem ab:

| # | Prüfung | dahinterliegender Grundsatz |
|---|---|---|
| 1 | Syntax jeder `.js`-Datei (`node --check`) | ⑨ |
| 2 | `sw.js`-SHELL ⇄ `index.html` synchron | Offlinefähigkeit |
| 3 | **Kein neues `prompt()` / `confirm()`** | ⑧ |
| 4 | **Kein Fachwort in einem Vergleich** | ④ |
| 5 | **Kein Kettensymbol in der Bedienung** | ⑥ · Naht des Datenmodells |

Prüfung 5 hält einen erreichten Zustand fest: Die Verknüpfung Zeile↔Material war
eine Datenmodell-Entscheidung, die in die Oberfläche durchgeschlagen ist — ein
Menüpunkt, ein Zustand, ein Badge, ein Zähler. Sie ist abgeräumt. Käme sie
zurück, ginge **nichts kaputt** — genau deshalb braucht es eine Prüfung.
Ausnahme mit `kette:ok`, wenn wirklich ein Link im Wortsinn gemeint ist.

Prüfung 3, 4 und 5 arbeiten mit einer **Altlastenliste**
(`scripts/pruefungen/altlasten.json`): Was am Tag der Einführung schon da war, ist
je Datei gezählt und bleibt geduldet. Neue Fälle brechen ab — und wenn eine Zahl
*zu hoch* ist, bricht die Prüfung ebenfalls ab und nennt die neue, kleinere Zahl.
So kann der Bestand nur schrumpfen.

Einzelfall begründen (nur wenn der Wert wirklich ein Schlüssel ist und keine
Bezeichnung):

```js
/* fachwort:ok — Begründung in einem Satz */
```

---

## Anhang · Was der Auftraggeber selbst tun muss

Drei Dinge kann kein Entwickler übernehmen:

1. **Verwaltungskennwort ändern** (☰ → Passwort ändern). Es steht noch das
   ausgelieferte.
2. **Fachliche Durchsicht** der Erkennungsregeln (`data/merkmale.json`,
   `data/zerlegung.json`) — ob „Abdeckung" im Haus ein Material oder eine Tätigkeit
   ist, weiß nur das Labor.
3. **Glossar füllen** (☰ → Abkürzungsglossar). Die Bedeutungen muss jemand aus dem
   Haus bestätigen.

---

*Angelegt am 04.08.2026. Teil A gibt die Vorgaben des Auftraggebers wieder und ist
von ihm gegenzulesen; Teil B und C beschreiben, wie sie im Code durchgesetzt werden.*
