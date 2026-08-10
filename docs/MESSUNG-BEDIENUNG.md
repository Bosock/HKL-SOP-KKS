# Was die Bedienung kostet — gemessen, nicht geschätzt

**Wozu dieses Dokument.** Ein Bericht über Bedienbarkeit, dessen Zahlen
geschätzt sind, ist eine Meinung mit Nachkommastellen. Deshalb erzeugt
`node e2e/messen.js` die Zahlen hier: Es fährt jeden Weg mit **echten Klicks
im echten Browser** ab, prüft danach, dass das Ziel wirklich erreicht ist, und
misst die Renderpfade mit dem **echten Bestand** (47 Standards, 294 Rubriken,
4.475 Zeilen).

**Wie gezählt wird.** Eine *Berührung* ist ein Fingerkontakt auf einer Fläche:
ein Feld antippen zählt (man muss es treffen), das Tippen des Textes danach
nicht (das ist Tastatur, kein Ziel). Ein Langdruck zählt als eine Berührung —
eine längere. Ein Weg, der sein Ziel nicht erreicht, wird als **ZIEL NICHT
ERREICHT** ausgewiesen und zählt nicht als Weg.

**Was NICHT vergleichbar ist.** Die Millisekunden stammen aus verschiedenen
Läufen auf einer geteilten Maschine und schwanken je nach Last um Faktor zwei.
Sie taugen, um Größenordnungen und Ausreißer zu erkennen — nicht, um zwei
Läufe gegeneinander zu rechnen. Die **Berührungszahlen dagegen sind
deterministisch** und direkt vergleichbar.

---

## Teil 1 — Berührungen je Weg

| Weg | vorher | nachher | Bemerkung |
|---|---:|---:|---|
| Eine Position anlegen (getippt) | 4 | 4 | unverändert — das Formular bleibt für Einzelfälle |
| **20 Positionen anlegen** | **80** | **4** | „📋 Liste einfügen": einfügen, prüfen, fertig |
| **Eine Zeile umbenennen** | **kam nie an** | **5** | vorher `prompt()` — in installierten PWAs erscheint kein Fenster |
| **Fünf Zeilen ändern** | **25** | **8** | „✏️ Zeilen ändern", Ansicht nie verlassen |
| Ein Bild an eine Zeile hängen | 2 | 2 | danach Systemdialog der Kamera |
| Einen Reiter umbenennen | 3 | 3 | Langdruck darauf |

**Der wichtigste Befund war kein Zahlenwert, sondern ein Nullwert.** Der
Messstand meldete beim Umbenennen *ZIEL NICHT ERREICHT*. Ursache: Die vier
meistbenutzten Schnellbearbeitungen — Umbenennen, Menge, Größen,
Spezifikation — liefen über `prompt()`. In installierten PWAs liefert das auf
mehreren Android-Chrome-Versionen sofort `null`, ohne ein Fenster zu zeigen.
Am Tablet im Saal passierte also **nichts**, und zwar lautlos. `quickmenu.js`
hatte insgesamt neun solcher Fenster; es sind jetzt **null**.

### Was „Details bearbeiten" kostet — und warum es trotzdem bleibt

| Größe | gemessen |
|---|---|
| Eingabefelder | 7 in 10 Gruppen |
| Höhe | 1,8 Bildschirmhöhen |
| Ansicht | wird verlassen |

Wer zehn Zeilen durchsieht, verliert zehnmal seinen Platz in der Liste. Das
Formular bleibt trotzdem: Kategorie, Größen, Farbe, Warum und Synonyme sind
**Entscheidungen**. Name, Menge und Spezifikation sind **Korrekturen** — und
nur die drei stehen jetzt inline zur Verfügung. Ein Inline-Formular mit allem
wäre wieder das Formular, nur an anderer Stelle.

---

## Teil 2 — Flächen ohne Langdruck (Hausregel A7)

Hausregel A7 verlangt, dass jede Fläche **dort** einstellbar ist, wo sie steht.
Der Messstand zählt, wo das noch nicht galt:

| Fläche | vorher ohne Langdruck | nachher |
|---|---:|---:|
| Übersichtszeile | 0 von 47 | 0 |
| Rubrikenzeile | 0 von 6 | 0 |
| Eintragszeile | 0 von 33 | 0 |
| Reiter oben | 0 von 2 | 0 |
| **Kopf des Standards** | **2 von 2** | **0** |
| **Knöpfe unter der Liste** | **6 von 6** | **0** |
| **Sortier-Knöpfe** | **6 von 6** | **0** |
| **Merkmals-Knöpfe** | **30 von 30** | **0** |

Verdrahtete Flächen: von 5 auf **9**. Alle vier neuen führen auf **ein** Sheet,
weil alle vier dieselbe Sorte Einstellung tragen (Wort, Symbol, an/aus).

`e2e/zeilen.js` schließt mit genau dieser Zählung ab und **scheitert**, sobald
eine Fläche der Kernbedienung wieder ohne Langdruck dasteht. A7 ist damit keine
Absichtserklärung mehr, sondern eine Prüfung.

---

## Teil 3 — Wartezeit der Renderpfade

Gemessen mit dem echten Bestand, je fünf Läufe. Ausgewiesen sind Mittelwert und
**schlechtester** Lauf — im Saal fällt nicht der Mittelwert auf, sondern der
Hänger.

| Pfad | Mittel | schlechtester | Einordnung |
|---|---:|---:|---|
| Startseite zeichnen (47 Standards) | 2,5 ms | 3,0 ms | unauffällig |
| Standard öffnen | 5,8 ms | 8,0 ms | unauffällig |
| Größte Rubrik öffnen (58 Zeilen) | 12,8 ms | 17,5 ms | unauffällig |
| Bearbeiten-Menü öffnen | 0,3 ms | 0,5 ms | unauffällig |
| Bestand neu bauen (bei JEDEM Speichern) | 0,1 ms | 0,2 ms | unauffällig |
| Vorschlagsliste „Ankreuzen" | 0,5 ms | 0,8 ms | gecacht |
| 40 Zeilen zerlegen + abgleichen | 0,9 ms | 1,6 ms | unauffällig |
| Globale Suche | 0,0 ms | 0,1 ms | unauffällig |
| **Materialindex bauen** (4.475 Zeilen) | 40,5 ms | **193 ms** | erster Lauf kalt, danach ~3 ms |
| **Verwaltung zeichnen** | 76,3 ms | **141 ms** | teuerster Bildschirm |

**Die beiden Ausreißer, ehrlich eingeordnet:**

*Materialindex.* Der schlechteste Lauf ist immer der **erste** — danach greifen
die Zwischenspeicher (`matKeyCache` & Co.) und es sind ~3 ms. Das ist die
richtige Verteilung: Einmal beim Start teuer, danach billig. Wichtig ist, dass
er **nicht** mehr bei jedem Speichern läuft; diese Kopplung war ein früher
behobener Leistungsfehler.

*Verwaltung.* Der teuerste Bildschirm der App, und er wird nach **jeder**
Panel-Änderung komplett neu gebaut. Das ist bewusst nicht optimiert: Die
Verwaltung ist kein Weg im Saal, sondern ein Ort, an dem man sitzt und
einstellt. 141 ms fallen dort nicht auf; die Arbeit, sie zu zerlegen, wäre an
einer Stelle investiert, an der niemand wartet. Sollte die Zahl über ~300 ms
steigen, ist der erste Schritt, die Karten erst beim Aufklappen zu füllen.

---

## Stand der Technik — woran ich mich halte, und wo bewusst nicht

**Übernommen:**

- **Trefferflächen ≥ 44 px** (Apple HIG, WCAG 2.2 „Target Size"). `e2e/zeilen.js`
  misst jede Trefferfläche im Änderungsmodus und schlägt bei jeder unter 44 px
  fehl — geprüft, nicht behauptet.
- **Direktmanipulation statt Formular** (Shneiderman): Das Objekt, das geändert
  wird, bleibt sichtbar. Deshalb wird die Rubrik zum Formular und nicht das
  Formular zur Rubrik.
- **Sichtbarkeit des Systemzustands** (Nielsen): Geänderte Zeilen sind markiert,
  der Knopf zählt mit, das Prüfblatt zeigt vorher → nachher.
- **Rückgängig statt Rückfrage** (Nielsen, „User control and freedom"): Kein
  „Sind Sie sicher?" vor dem Tippen, sondern ↺ an jeder Zeile und ein Journal
  danach.

**Bewusst abgewichen:**

| Üblich | Hier | Warum |
|---|---|---|
| Wischgesten für Aktionen | keine | Mit Handschuhen auf beschlagenem Glas unzuverlässig; eine verschluckte Wischgeste sieht aus wie ein hakendes Gerät. |
| Doppeltipp | keiner | Dieselbe Begründung, dazu der Zoom-Konflikt (Zoom bleibt bewusst frei, WCAG 1.4.4). |
| Ziehen als einziger Weg | Ziehen **und** Knöpfe | Beim Sortieren gibt es ⠿ *und* ⤒ ⬆ ⬇ ⤓. Ziehen ist schneller, wenn es klappt — mit Handschuhen klappt es nicht immer. |
| Autospeichern beim Tippen | Entwurf + Prüfblatt | Eine Änderung kann 23 Stellen betreffen. Wer das nicht vorher sieht, kann es nicht verantworten. |
| Native Dialoge | eigene Karten | In installierten PWAs erscheinen sie teilweise gar nicht — der belegte Grund, nicht der ästhetische. |
| Inline-Bearbeitung aller Felder | genau drei | Sonst wäre es wieder das Formular. |

---

## Bewusst nicht gemacht

- **Kein virtualisiertes Scrollen.** Die größte Rubrik hat 58 Zeilen und
  zeichnet in 17 ms. Virtualisierung brächte hier nichts und kostete
  Auffindbarkeit (Strg-F, Screenreader, Drucken).
- **Die Verwaltung wurde nicht zerlegt** (siehe oben) — gemessen, eingeordnet,
  bewusst stehen gelassen.
- **Keine Undo-Historie über mehrere Schritte.** Es gibt das Regel-Journal, das
  jede Änderung einzeln zurücknehmen lässt. Ein zweites Rückgängig-System
  daneben hätte zwei Wahrheiten erzeugt.
- **Keine Tastenkürzel.** Im Saal steht kein Gerät mit Tastatur; am Schreibtisch
  ist die App nicht der Engpass.
- **Kategorie, Größen, Farbe, Warum und Synonyme bleiben aus der
  Inline-Bearbeitung heraus** — Entscheidungen gehören ins Formular, wo Platz
  für die Erklärung ist.
- **Die verbleibenden nativen Dialoge außerhalb von `quickmenu.js`** (u. a.
  `app-state.js`, `backup.js`, `glossary.js`) sind nicht angefasst. Sie stehen
  mit Zahl in `scripts/pruefungen/altlasten.json`, die Ratsche lässt sie nicht
  wachsen, und sie liegen alle außerhalb des heißen Pfads im Saal. Der nächste
  Durchgang nimmt sich `app-state.js` vor (12 Stück, darunter die
  Passwortänderung).

---

*Erzeugt mit `node e2e/messen.js`. Wer die Zahlen anzweifelt, führt es aus.*
