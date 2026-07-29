# Materialmerkmale — was ein Produkt im HKL wirklich ausmacht

> Abgrenzung: `KONZEPT-MERKMALE.md` beschreibt die frei benennbaren Merkmale
> **am Eintrag** (Größen + eigene Felder, mit Reichweitenfrage). Dieses Papier
> beschreibt den typisierten Merkmalskatalog **am Materialstammsatz**, aus dem
> Etikett gewonnen. Jenes Papier nennt als Folgeschritt „Merkmal-Vorlagen je
> Kategorie" — das ist genau das hier.

> Es gibt die Agilis NxT von Abbott — als **ND** und als **LD**. Zwei
> verschiedene Produkte, ein Buchstabe Unterschied, und die App kann sie nicht
> auseinanderhalten. Das ist kein Erkennungsproblem. Es ist ein
> **Datenmodell**problem.

## 1. Die eigentliche Diagnose

Die Texterkennung liest den Unterschied durchaus. Sie hat nur keinen Ort, an
dem sie ihn ablegen könnte.

Ein Materialstammsatz hat heute:

| Feld | Art |
|---|---|
| Name, Hersteller, REF, GTIN | Identität — in Ordnung |
| `groessen[]` | Liste aus `{typ, wert}`, beides **Freitext** |
| `props{}` | frei definierbare Schlüssel/Wert-Paare, **Freitext** |

Ein Etikett trägt dagegen 8 bis 15 harte, typisierte Eigenschaften mit
Einheiten, Toleranzen und Beziehungen zu anderen Produkten. Freitextfelder
nehmen davon eines auf — und machen es unsuchbar, unvergleichbar und
unprüfbar.

**Erst kommt der Ort, dann die Erkennung.** Alles andere ist Politur an der
falschen Stelle.

## 2. Drei Schichten

```
1. IDENTITÄT       Wer ist das?      GTIN · REF · Hersteller · Handelsname
2. MERKMALE        Wie ist es?       typisiert, mit Einheit und Herkunft
3. KOMPATIBILITÄT  Womit geht es?    passt in · nimmt auf · braucht
```

Schicht 1 existiert. Schicht 2 ist neu. **Schicht 3 ist der eigentliche
Gewinn** — sie beantwortet die Frage, die im Labor tatsächlich gestellt wird:
*„Passt das zusammen?"*

## 3. Woher ein Merkmal kommt

Vier Wege, absteigend nach Verlässlichkeit:

| Weg | Beispiel | Warum so verlässlich |
|---|---|---|
| **ANKER** | `Outer diameter · 0.082 In · 2.08 mm` | Der Wert steht neben seiner Bedeutung. Der Hersteller hat ihn selbst beschriftet. |
| **REF** | `LA6EBU40SH` → 6 F · EBU 4.0 · mit Seitenlöchern | Die Artikelnummer kodiert die Variante. Groß gedruckt, bereits gegen den Bestand aufgelöst. |
| **MUSTER** | `6Fr`, `190cm`, `STERILE EO` | Freitext. Niemand hat dabeigeschrieben, was die Zahl bedeutet. |
| **MENSCH** | jemand hat es eingetragen | schlägt alles, wird nie überschrieben |

### Die REF-Grammatik ist der stärkste Hebel

Das ist die Antwort auf das ND/LD-Problem — und sie kommt ganz ohne bessere
Texterkennung aus.

```
LA6EBU40SH   →  LA · 6 · EBU · 40 · SH
                     │     │     │    └── Seitenlöcher
                     │     │     └─────── Kurvengröße 4.0
                     │     └───────────── Extra Back-Up
                     └─────────────────── 6 French
```

Belegt an sechs Herstellern aus den vorliegenden Etiketten:

| REF | ergibt |
|---|---|
| `LA6EBU40SH` | 6 F · EBU4.0 · mit Seitenlöchern |
| `9-ATV12F45/80` | 12 F · 45° · 80 cm |
| `FGTO275020` | 2,75 mm × 20 mm |
| `RM*RF5J16PQ` | 5 F · J-Draht · 16 cm |
| `AFAPRO28` | 28-mm-Kryoballon |
| `L-EVOLUTFX-2329` | **Lade**system (nicht Einführsystem!) |

Acht bis zehn Hersteller decken ein Herzkatheterlabor zu über 90 % ab. Die
Grammatiken stehen als Daten in `public/data/merkmale.json` und werden ohne
Programmierung erweitert.

## 4. Sicherheitsregeln

**Leer schlägt falsch.** Ein Wert wird nur gesetzt, wenn er

1. in sein **Plausibilitätsfenster** passt, und
2. **eindeutig** ist.

### Das Plausibilitätsfenster

Auf dem Blazer-Etikett stehen nebeneinander: `2.5mm` (Elektrodenabstand),
`8mm` (Spitze), `10.2cm` (Elektrodenzeile), `110cm` (Nutzlänge). Ohne Fenster
landet die Spitzenlänge als Katheterlänge im Datensatz. Jedes Maß-Merkmal
trägt daher seinen Wertebereich: Nutzlänge 20–200 cm, Spitzenlänge 2–12 mm,
Drahtstärke 0,008–0,045″.

### Widerspruch heißt fragen, nicht raten

Dasselbe Blazer-Etikett nennt **7 F** (Schaft) *und* **8 F** (Spitze). Die App
entscheidet das nicht. Das Merkmal kommt als *mehrdeutig* zurück, mit beiden
Kandidaten — und ein Mensch wählt. Genau wie bei der REF-Auflösung.

### Gleiche Bedeutung ist kein Widerspruch

`EBU4.0` (Schachtelfront) und `EBU40` (aus der REF) meinen dasselbe. Sie
werden über einen normalisierten Schlüssel gebündelt: Die **lesbarere**
Schreibweise wird angezeigt, die **verlässlichere** Quelle liefert die
Sicherheit. Bestätigen sich mehrere Wege gegenseitig, wird das vermerkt.

### Verneinungen

Auf Etiketten steht `Do not resterilize`. Wer nur prüft, ob das Muster
greift, speichert „resterilisierbar: ja" — die Aussage ins Gegenteil verkehrt.
Solche Muster brauchen eine ausdrückliche Klartext-Abbildung. Das gilt genauso
für `Not for Injection`.

### Was bewusst NICHT erkannt wird

Das Latex-Symbol ist durchgestrichen (= latexfrei) oder nicht (= latexhaltig).
**Eine Texterkennung sieht diesen Unterschied nicht.** Ohne Klartext auf dem
Etikett bleibt der Wert deshalb „unbekannt". Lieber eine Lücke als eine
Allergieangabe, auf die sich jemand verlässt.

## 5. Was die Klassen unterscheidet

Ein Draht hat keine Kurvenform, eine Kompresse keinen Berstdruck. Der Katalog
kennt **22 Materialklassen**; jede bringt ihren eigenen Merkmalssatz mit, dazu
die Merkmale, die für alles gelten (steril, Einmalgebrauch, Latex, MR, CAS).

Erkannt wird die Klasse über Signalwörter — mit **Ausschlusswörtern**, denn
„Ablationskatheter" steckt wörtlich in „Kryoablationskatheter". Ohne
Ausschluss gewönne bei jedem Kryokatheter die falsche Klasse und damit der
falsche Merkmalssatz.

### Die Fallen, die eine erfahrene Pflegekraft kennt

| Falle | Warum sie zählt |
|---|---|
| **French bei Schleuse ≠ bei Katheter** | Schleuse: Innendurchmesser. Katheter: Außendurchmesser. Eine 6-F-Schleuse nimmt einen 6-F-Katheter auf — die Zahlen sind gleich, die Bedeutung nicht. |
| **Schaft- gegen Spitzen-French** | Blazer II XP: 7 F Schaft, 8 F Spitze. Für die Schleusenwahl zählt die dickste Stelle. |
| **`Rx only` ≠ Rapid Exchange** | „Rx" heißt auf US-Etiketten verschreibungspflichtig. Als System-Kürzel bedeutet es das Gegenteil von OTW. Im Katalog ausdrücklich ausgeschlossen. |
| **`L-` gegen `D-`** | Evolut FX: Ladesystem und Einführsystem, gleiche Schachtel, nebeneinander im Schrank. |
| **`SH` / `MS`** | Mit und ohne Seitenlöcher. Steht nur im Freitext und in der REF. |
| **Spülung ≠ Injektion** | „Solution for Irrigation. **Not for Injection.**" sieht aus wie eine Infusionsflasche. Warnmerkmal, ganz oben. |
| **Zwei REFs auf einem Etikett** | Angiokard führt die eigene REF **und** die des Vertriebs (L&R). |
| **GTIN-Ebene** | `(01)20841156110465` — die führende `2` ist eine Verpackungsebene, nicht die Basis-GTIN. Wichtig für jede Datenbankabfrage. |
| **Artikelnummer sieht aus wie ein Maß** | `217F3` enthält „17F". Ohne Wortgrenze wird daraus ein 17-French-Katheter. |

## 6. Kompatibilität — der eigentliche Nutzen

Beziehungsmerkmale zeigen über den Einzeldatensatz hinaus:

| Merkmal | Bedeutung | steht auf dem Etikett als |
|---|---|---|
| `draht_empf_in` | welcher Draht hineinpasst | „Recommended Guide wire size 0.025″" |
| `min_guiding_id_mm` | welchen Führungskatheter es braucht | „GCID ≥ 0.078″ (1.98 mm)" |
| `min_guiding_fr` | ab welcher Guiding-Größe | „Min. Guiding Catheter ≥ 5F" |

Alle Vergleiche laufen über Millimeter, damit 6 F, 0,071″ und 1,80 mm
vergleichbar werden. Fehlt eine Angabe, lautet die Antwort **„unbekannt"** —
nicht „ja".

Gerechnetes Beispiel aus den vorliegenden Etiketten:

> GuideLiner V3 7F braucht ein Führungskatheter-Innenlumen ≥ **1,98 mm**.
> Der Launcher 6 F hat **1,80 mm**. → **passt nicht.**

Das ist eine Frage, die heute im Labor jemand aus dem Kopf beantworten muss.

## 7. Ergebnis am echten Material

Der Katalog wurde an **16 fotografierten Etiketten** aus dem HKL entwickelt und
läuft gegen deren Text:

| | vorher | nachher |
|---|---|---|
| erfasste Merkmale gesamt | 16 Freitextzeilen | **115 typisierte Merkmale** |
| davon ohne Nachfrage sicher | — | **81 (70 %)** |
| als mehrdeutig gemeldet | — | 2 (statt falsch geraten) |
| Lücken benannt | — | ja, je Klasse |

Beispiel Launcher, 14 Merkmale aus einem einzigen Etikett:

```
✔ Außendurchmesser        6 F              [ref, bestätigt]
✔ Kurvenform              EBU4.0           [ref, bestätigt]
✔ Seitenlöcher            ja               [ref]
✔ Innendurchmesser        1.80 mm          [anker]
✔ Außendurchmesser (mm)   2.08 mm          [anker]
✔ Nutzlänge               100 cm           [anker, bestätigt]
✔ Steril                  steril (EO)      [muster]
✔ Einmalgebrauch          ja               [muster]
✔ Gefahrstoff (CAS)       7440-48-4        [anker, bestätigt]
✔ Herstellungsland        Mexico           [anker]
  …
```

Beispiel Blazer, ehrlich unvollständig:

```
~ Spitzenlänge            8 mm
✔ Kurvengröße             LARGE
✔ Distale Form            STD DISTAL
? Außendurchmesser        unklar: 8 oder 7      ← wird gefragt, nicht geraten
… fehlt noch: Elektrodenabstand, Gekühlt/Irrigation
```

## 8. Warum das ohne Entwickler pflegbar ist (Grundsatz ⑤)

Alles Fachliche steht in **`public/data/merkmale.json`** — Klassen, Merkmale,
Einheiten, Erkennungsmuster, Plausibilitätsfenster, REF-Grammatiken,
Kompatibilitätsregeln. Der Code enthält keine einzige Produkteigenschaft.

Ein neues Merkmal ist ein Objekt:

```json
{ "id": "tip_load_g", "label": "Spitzenkraft", "kurz": "g",
  "typ": "mass", "einheit": "g", "fenster": [0.3, 60],
  "klassen": ["fuehrungsdraht"],
  "anker": ["tip load", "spitzenkraft"],
  "rang": 14, "badge": true }
```

Stellschrauben, die der Katalog kennt — jede aus einem echten Etikett heraus
entstanden:

| Feld | wofür |
|---|---|
| `fenster` | Plausibilitätsbereich |
| `anker` | beschriftende Wörter |
| `muster` | reguläre Ausdrücke im Freitext |
| `abbild` | Etikettentext → Klartext (auch für Verneinungen) |
| `mehrfach` | `max` / `min` / `erste` bei mehreren Funden |
| `nur_anker` | Muster ergibt nur direkt hinter der Beschriftung Sinn |
| `streng` | Groß-/Kleinschreibung zählt |
| `warnung` | rot darstellen |
| `badge` | in der Listenzeile zeigen |
| `beziehung` | Kompatibilitätsmerkmal |
| `nicht` (Klasse) | Ausschlusswörter gegen Wortenthaltung |

Ein kaputtes Muster stürzt nichts ab — es wird still übergangen. Der Test
`alle Muster im Katalog sind gültige reguläre Ausdrücke` findet es trotzdem.

## 9. Was der Katalog NICHT leisten kann

Ehrlich benannt, damit niemand darauf baut:

* **Bemaßungspfeile in technischen Zeichnungen.** Beim Freezor steht die
  6-mm-Spitze nur als Pfeil mit Zahl, ohne beschriftendes Wort. Das kommt als
  **Lücke** zurück, nicht als Rateversuch.
* **Compliance-Charts.** Die Tabelle des Supraflex ist als Bild nicht
  zuverlässig lesbar. NP und RBP kommen an, der Rest nicht.
* **Symbole ohne Klartext.** Latex, MR, Lagigkeit — siehe oben.
* **Merkmale, die gar nicht auf dem Etikett stehen.** Tip-Load eines
  CTO-Drahtes, Crossing Profile, Biegesteifigkeit. Die müssen aus
  Herstellerdaten oder EUDAMED kommen — mit Status „unbestätigt".

Die Lückenliste je Klasse macht genau das sichtbar und wird damit zur
Arbeitsliste statt zum Bauchgefühl.

## 10. Stand und nächster Schritt

**Fertig und geprüft:**

* `public/data/merkmale.json` — 22 Klassen, 84 Merkmale, 6 REF-Grammatiken,
  4 Kompatibilitätsregeln
* `public/js/features/merkmale.js` — reine, testbare Erkennungsmaschine
* `test/merkmale.test.js` — 44 Tests gegen 16 echte Etikettentexte

**Noch nicht verdrahtet** (bewusst): Der Baustein wird geladen, aber weder der
Etikettenscanner noch der Material-Editor benutzen ihn bisher. Nichts an der
bestehenden Bedienung ändert sich dadurch. Der nächste Schritt braucht:

1. Merkmalsblock im Material-Editor (typisierte Felder je Klasse statt
   Freitextzeilen), mit Herkunfts- und Bestätigungsvermerk
2. Anbindung an den Foto-Assistenten: gefundene Merkmale als Vorschlag,
   mehrdeutige als Auswahl
3. Merkmals-Editor in der Materialverwaltung (Grundsatz ⑤)
4. Suche und Filter über Merkmale („alle 6-F-Führungskatheter mit
   Seitenlöchern")
5. Kompatibilitätsansicht („was passt hier hinein?")
6. Übernahme der Alt-Daten aus `groessen[]` und `props{}`

Reihenfolge und Umfang sind zu entscheiden — der Katalog gehört vorher
fachlich geprüft.
