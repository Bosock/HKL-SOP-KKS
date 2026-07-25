# Konzept — Material-Zentrale (Konsolidierung)

## Der Befund, der dazu geführt hat

Eine vollständige Code-Inventur ergab **14 verschiedene Eingabewege** für
Material und Einträge, verteilt über 19 Bildschirme, 13 Verwaltungs-Panels und
17 Schnellmenü-Aktionen.

Das eigentliche Problem war aber nicht die Zahl der Menüs, sondern:
**dasselbe Feld existierte mehrfach — in verschiedenen Speichern.**

| Feld | Stammsatz `hkl_gtin` | `hkl_prod` (alt) | `hkl_care` (alt) | Eintrag `QE.cid` | „überall" `QE.mat` | Regel |
|---|---|---|---|---|---|---|
| Hersteller | ✓ | ✓ | | | | |
| REF | ✓ | ✓ | | | | |
| Verwendung | ✓ | ✓ | | | | |
| Preis | ✓ | ✓ | | | | |
| Foto | ✓ | | ✓ | | | |
| Lagerort | ✓ | | ✓ | | | |
| Größen | ✓ | | | ✓ | ✓ | ✓ |
| Name | ✓ | | | ✓ | ✓ | ✓ |

Zwei konkrete Altlasten:

* Die alte **„Material pflegen"-Maske war nicht mehr erreichbar** (der Hub hatte
  sie ersetzt), **ihre Daten wurden aber noch an 8 Stellen gelesen**. Wer dort
  früher ein Foto gepflegt hatte, hatte es in einem Topf, den keine Maske mehr
  füllte.
* Der **Katalog** war ein paralleler Material-Bestand mit eigenem Formular —
  konzeptionell dasselbe wie ein Stammsatz, technisch getrennt.

## Die Grundidee: zwei Dinge, eine Querfrage

| | Was es ist | Beispiele | Gilt |
|---|---|---|---|
| 📦 **Material** | Was das Produkt **ist** | Hersteller, REF, Maße, Foto, Preis, Lagerort, Eigenschaften | einmal, überall gleich |
| 📄 **Eintrag** | Wie es **hier** benutzt wird | Menge, Hinweis, Kategorie, Sichtbarkeit | pro Stelle |
| 🎯 **Geltung** | **Für wen/wo** eine Änderung gilt | nur hier · Standard · Gruppe · überall · je Arzt | die eine Querfrage |

Die Zersplitterung kam daher, dass diese drei Achsen vermischt waren: Der
Geltungsbereich war mal ein Nachfrage-Dialog, mal ein eigenes Menü (Regeln),
mal ein eigener Speicher (`QE.mat`), mal ein Reiter (Varianten).

## Die Umsetzung: `js/features/matcenter.js`

Ein Menüpunkt **„🧬 Material & Einträge"** mit vier Registern:

```
📦 Material    alle Stammsätze · scannen · anlegen · Filter nach Lücken
📄 Einträge    alle Vorkommen in den Standards · Pflegestatus · direkt bearbeiten
🗂 Ordnung     Kategorien · Unterkategorien · eigene Eigenschaften
✅ Prüfen      Arbeitsliste: was fehlt noch · Duplikate · Alt-Daten übernehmen
```

Das absorbiert neun frühere Einstiege: Materialverwaltung, Etikett-Scanner,
Materialzusammenführung, Einstufung prüfen, Unterkategorien, Kategorien,
Ausgeblendete Einträge, Katalog und den Aufräum-Assistenten.

### Register „Prüfen" ist der eigentliche Gewinn

Statt zu suchen, bekommt man eine **Arbeitsliste**: „12 ohne Foto · 30 ohne
Preis · 8 ohne Lagerort · 5 unsichere Einstufung · 3 Duplikate · 279 nicht
verknüpft". Jede Zeile springt mit einem Tipp in den passenden Filter
(`mcJump`). Das ist das Fenster, durch das der Materialstamm tatsächlich fertig
wird.

Kern ist die reine Funktion `mcMissingOf(rec)` — sie benennt die Lücken eines
Stammsatzes und ist voll testbar. (Feinheit: Preis `0` gilt als gepflegt, nicht
als Lücke.)

## Der Geltungsbereich wird sichtbar — statt Nachfrage hinterher

Vorher: speichern → Dialog „Wo soll das gelten?". Man erfuhr **nach** dem
Tippen, was man geändert hatte.

Jetzt steht die Stufe **oben in der Eintrags-Maske**, mit Trefferzahl:

```
🎯 Gilt für   [📍 Nur hier]  [📄 Standard 3×]  [🗂 Gruppe 12× / 4 Std.]  [🌐 Überall 31× / 9 Std.]
```

Vorbelegt ist die sichere Stufe „nur hier". Weite Stufen werden weiterhin mit
Trefferzahl bestätigt.

**Wichtig (und beim Testen aufgefallen):** Auch „nur hier" läuft weiter über
`applyEditScope` und damit über das **Regel-Journal** — sonst wäre die Änderung
nicht mehr unter 🧾 Regeln & Journal rücknehmbar gewesen. Ein Schreibweg für
alle Reichweiten.

Die Material-Maske bekommt das Gegenstück als Klartext-Hinweis: *„Gilt für
dieses Material überall — was nur an EINER Stelle anders sein soll, gehört an
den Eintrag."*

## Alt-Daten: Übernahme statt Bruch

Register „Prüfen" bietet **„Alt-Daten übernehmen"** an. Die Übernahme
(`mcMigrateLegacy`) ist bewusst konservativ:

* füllt **nur leere** Felder (`mcFillEmpty` überschreibt nie),
* **lässt die Alt-Speicher unangetastet** (`hkl_care`, `hkl_prod`, `hkl_catalog`
  bleiben erhalten und werden weiter gelesen),
* ist damit **idempotent und gefahrlos wiederholbar**.

Die tote „Material pflegen"-Maske (`openCare`/`saveCare`) wurde entfernt; die
Foto-Werkzeuge (`shrinkPhoto`, `migrateCarePhotos`) bleiben in `care.js`, weil
sie app-weit gebraucht werden.

`mcMigrateCatalog` legt Katalog-Positionen als Stammsätze an (überspringt
Namensdubletten) — der Katalog selbst bleibt bestehen.

## Tests

* **Unit** (`test/client-helpers.test.js`): `mcMissingOf` (inkl. Preis-0-Fall),
  `mcGapCounts`, `mcLegacyPending` (zählt nur Unverknüpftes),
  `mcFillEmpty` (überschreibt nie, idempotent).
* **E2E** (`e2e/matcenter.js`, 21 Prüfungen): vier Register, Einträge-Filter,
  Arbeitsliste → Sprung in den richtigen Filter, Alt-Daten-Übernahme inkl.
  „Alt-Daten bleiben unangetastet", sichtbarer Geltungsbereich, Ordnung.
* **Angepasst**, weil sich das Verhalten bewusst geändert hat:
  `e2e/souveraen.js` und `e2e/merkmale.js` (Geltungsbereich vorab statt
  Nachfrage), `e2e/photoedit.js` (prüft jetzt, dass die Alt-Maske weg ist **und**
  Alt-Fotos verlustfrei in den Stammsatz wandern).
