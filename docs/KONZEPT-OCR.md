# Etikett-Erkennung — Konzept und Umsetzung

> Ziel: Die REF eines Medizinprodukts soll nach EINER Aufnahme richtig im
> Formular stehen. Nicht „meistens ungefähr", sondern richtig — oder ehrlich
> leer. **Leer schlägt falsch.**

## 1. Was vorher schiefging

Zwei Fehler in der Bildvorverarbeitung erklärten den Großteil des Problems
„er erkennt alles außer der REF":

| Befund | Wirkung |
|---|---|
| `MAXED=2200` in `ocrPreprocess` | Ein Handyfoto mit ~4000 px wurde auf 2200 px verkleinert — ~45 % weniger lineare Auflösung. Grobe Elemente (Logo, Produktname) überleben das; die 1–2 mm hohe REF-Schrift fällt unter die Erkennungsschwelle. |
| harte Binarisierung (Bradley) als einziger Weg | Bradley war für die alte Tesseract-3-Engine richtig. Die aktuelle LSTM-Engine ist auf **Graustufen** trainiert. Ein 1-Pixel-Strich einer `8` wird beim Schwellwert entweder weggeschnitten (liest sich als `B`/`3`) oder das Loch zugedrückt (`0`). |

Dazu fehlten: Zeichen-Whitelist, Abschalten der Wörterbücher, ein gezielter
Ausschnitt fürs REF-Feld — und vor allem jede Form von **Nachbearbeitung
gegen bekannte Artikelnummern**.

## 2. Der Leitgedanke

> **Die beste Texterkennung ist die, die man nicht braucht.**
> Und wo man sie braucht, muss eine REF nicht *perfekt* gelesen werden —
> sie muss *unterscheidbar* sein.

Daraus folgen vier Stufen, von der sichersten zur unsichersten Quelle.

## 3. Die vier Stufen

### Stufe 0 — Barcode (exakt, offline, kostenlos)
`features/scanner.js` · `parseGS1`

Jedes Medizinprodukt trägt die Nummer bereits maschinenlesbar. Der
GS1-DataMatrix enthält AI `01` (GTIN) und häufig AI `240`/`241`
(Artikelnummer = REF **direkt**). Wo AI 240 vorhanden ist, gibt es überhaupt
kein Erkennungsproblem — die REF steht exakt fest.

### Stufe 1 — GTIN auflösen (ohne jede Texterkennung)
`features/gudid.js` · `gtinAufloesen(gtin)`

Reihenfolge, vom Billigsten zum Teuersten:

1. **eigener Stammsatz** (`GTINDB`) — offline, exakt, sofort
2. **Referenz-Katalog** (`public/data/material_catalog.json`, 527 REFs) — offline
3. **AccessGUDID** der US National Library of Medicine —
   `https://accessgudid.nlm.nih.gov/api/v2/devices/lookup.json?di=<GTIN>`
   Frei, kein Konto, kein Schlüssel. Liefert Katalognummer (= REF), Marken-
   und Firmenname.

AccessGUDID-Treffer sind **„unbestätigt"** mit Quellenangabe — wie alle
web-recherchierten Daten in dieser App. Sie füllen nur leere Felder.
Ergebnisse (auch Negativ-Treffer) werden gerätelokal gecacht (`hkl_gudid`),
damit derselbe Artikel offline sofort wieder auflösbar ist.

CSP: `connect-src` erlaubt genau diese eine Fremd-Origin (`server/config.js`).

### Stufe 2 — Etikett lesen (verbessert)
`features/ocr.js` · `ocrReadLabel(dataUrl, onStatus)`

> **Stand November 2026:** Diese Tabelle beschreibt die erste Fassung.
> Die Kette ist inzwischen um Lichtaufbereitung, Feinlesung, Symbol-Nachlese,
> gewichtete REF-Abstimmung und Mehrfachfotos erweitert — siehe **§7**.

Ablauf für **ein** Foto (erste Fassung):

| Schritt | Was passiert | Warum |
|---|---|---|
| 0 | Barcode aus demselben Foto | kostet Millisekunden, liefert die Wahrheit |
| 1 | `ocrRender(modus:'grau')` — bis 3600 px, Graustufen + Kontrastspreizung (`ocrStretch`) | keine Auflösung mehr verschenken, blasse Schrift anheben, LSTM-freundlich |
| 2 | Volltext, PSM 3, **Wörterbücher aus** | ohne `load_system_dawg`/`load_freq_dawg` verbiegt die Engine Artikelnummern nicht mehr zu englischen Wörtern |
| 3 | **REF-Streifen**: `ocrRefBand()` findet über die Wortrahmen das Wort „REF" und schneidet den Streifen bis zum rechten Bildrand aus → erneut lesen mit **PSM 7** (eine Zeile) + Zeichen-Whitelist | größter Einzeleffekt: die Engine sucht nicht mehr in einem Wimmelbild, sondern liest eine Zeile |
| 4 | falls dünn/ergebnislos: zweite Meinung auf der **binarisierten** Variante (PSM 6) | glänzende Folienetiketten profitieren davon |
| 5 | `ocrVoteFields()` — Mehrheitsentscheid über alle Lesungen | Multi-Frame-Prinzip, aber aus EINEM Foto (der Nutzer soll nicht dreimal knipsen) |
| 6 | `refBest()` — Auflösung gegen den bekannten Bestand | siehe unten |

Der Tesseract-Worker wird **wiederverwendet** (`ocrGetWorker` /
`ocrReleaseWorker`); vorher wurde er je Lesung neu erzeugt und beendet, was
mehrere Durchgänge unbezahlbar gemacht hätte.

### Stufe 3 — REF-Auflösung (der eigentliche Qualitätshebel)
`features/matref.js`

Eine gelesene REF wird gegen die Menge der **bekannten** REFs aufgelöst
(Referenz-Katalog + eigene Stammsätze + gelernte Korrekturen):

| Stufe | Regel | `sicher`? |
|---|---|---|
| `exakt` | steht so im Bestand | ✔ |
| `zeichenklasse` | `O/Q/D→0`, `I/L→1`, `S→5`, `B→8`, `Z→2`, `G→6` gelten als dasselbe Zeichen. `8FR-B4O` trifft `8FR-840`. | ✔ |
| `ähnlich` | kleine Editier-Distanz (0 Fehler <5 Zeichen, 1 bis 7, 2 ab 8) | ✘ (Vorschlag) |
| `mehrdeutig` | mehrere bekannte REFs passen | ✘ — der Nutzer wählt |
| `roh` | nichts passt | ✘ — Rohlesung bleibt stehen |

**Sicherheitsregel:** Aufgelöst wird nur, was **eindeutig** ist. Kollidieren
zwei bekannte REFs auf einer Stufe, wird nichts entschieden. Deshalb ist die
Zeichenklassen-Abbildung bewusst konservativ.

### Lernschleife
`refLearn` / `ocrLearnFromSave` · geteilter Zustand `hkl_ocrlearn`

Speichert ein Mensch eine andere REF als gelesen wurde, merkt sich die App
das Paar (Rohlesung → richtige REF, über den Zeichenklassen-Schlüssel).
Beim nächsten Foto desselben Etiketts trifft sie sofort — **auch bei
Produkten, die in keinem Katalog stehen.** Genau das schließt die Lücke, die
ein Katalog mit 527 Einträgen zwangsläufig lässt. Der Lernstand wird über
`SHARED_KEYS` auf alle Geräte geteilt: was eine Person korrigiert, hilft
allen.

Zeitlich begrenzt (30 min), damit nur echte Korrekturen zur laufenden
Erfassung gelernt werden.

## 4. Der geführte Dialog
`features/ocrwizard.js`

Barcode und Klartext brauchen gegensätzliche Aufnahmen: Der Barcode will
**nah und formatfüllend**, das Etikett will **die ganze Fläche**. Ein
einziges Foto ist immer ein Kompromiss zulasten beider.

Drei Schritte:

1. **Barcode** → GTIN exakt, danach `gtinAufloesen` (Stammsatz → Katalog → AccessGUDID)
2. **Etikett** → `ocrReadLabel`, ergänzt nur, was noch fehlt
3. **Prüfen** → Übersicht mit **Herkunftsangabe je Feld**; bei mehrdeutiger
   REF eine Auswahl (die Wahl wird gelernt)

Beide Foto-Schritte sind überspringbar, und „**Ein Foto genügt mir**" lässt
dieselbe Kette auf einer einzigen Aufnahme laufen. Der frühere Einzelknopf
(„Nur ein Etikett-Foto lesen") bleibt erhalten.

Übernommen wird nur in **leere** Formularfelder — Eingetragenes bleibt
unangetastet.

## 5. Fotogalerie am Material
`features/scanner.js` · `matPhotos` / `matPhotoAdd` / `matPhotoDel` / `matPhotoMain`

Ein Bild reicht selten: Verpackung, Etikett, ausgepacktes Produkt, Anschluss,
Regalplatz. Der Stammsatz führt deshalb `fotos: [{src, titel}]`.

- `photo` (Einzelbild) bleibt bestehen und ist **immer das erste Bild** der
  Liste → alle Listenansichten und Altbestände funktionieren unverändert.
- Kachelraster im Editor: hinzufügen (auch Mehrfachauswahl), zuschneiden/
  drehen, entfernen, per ★ zum Vorschaubild machen, Bildunterschrift.
- In der Produktansicht: erstes Bild groß, weitere als Streifen — jedes mit
  `data-zoom` → Lightbox (`features/lightbox.js`).
- Die Aufnahmen des geführten Dialogs lassen sich auf Wunsch direkt als
  Materialfotos übernehmen.

Alle Bilder laufen durch `shrinkPhoto` (max. 1280 px, JPEG ~82 %), damit der
geteilte Zustand nicht explodiert.

## 6. Bewusst NICHT umgesetzt: Server-OCR

Server-seitige Erkennung (PaddleOCR oder ein Vision-Language-Modell) wäre
leistungsfähiger als Tesseract im Browser — das ist unstrittig. Sie ist hier
aus zwei Gründen zurückgestellt:

1. **`/api/state` ist derzeit unauthentifiziert** (`server/routes/state.js`).
   Ein Bild-Upload-Endpunkt auf demselben Server würde diese offene Tür
   deutlich verbreitern. Erst Authentifizierung, dann Upload.
2. Die App ist **offline-first**. Server-OCR funktioniert im Herzkatheterlabor
   mit schlechtem WLAN nicht — die Stufen 0–3 laufen vollständig auf dem Gerät
   (Stufe 1 nur für den optionalen AccessGUDID-Schritt am Netz).

## 7. Ausbau November 2026 — gemessen statt vermutet

Anlass: Rückmeldung aus dem Labor — bei schlechtem Licht, aber auch sonst,
werden die Felder eines Etiketts oft falsch oder gar nicht erkannt.

### 7.1 Erst messen: der Messstand

`e2e/messen-ocr.js` rendert vier realistische Etiketten (Schleuse, EP-Katheter,
Führungsdraht, Diagnostikkatheter — mit REF/LOT im **ISO-15223-Kästchen**,
mehrsprachigem Kleingedrucktem, Herstelleranschrift) als 12-MP-„Handyfoto" und
legt sieben Störungen darüber: sauber, wenig Licht + Sensorrauschen, Schatten,
leicht unscharf, Glanzlicht, Etikett klein im Bild, Alltag (dunkel + Schatten +
unscharf). Gezählt werden fünf Felder je Etikett (REF, Hersteller, French,
Länge, Materialklasse), die REF dreiwertig: **richtig · leer/Vorschlag ·
falsch eingetragen**.

**Grenze:** Synthetische Etiketten in einer sauberen Schrift. Die Zahlen
zeigen Richtung und Größenordnung, nicht die Trefferquote im Labor. Echte
Etikettfotos sind der nächste Schritt (§7.5).

### 7.2 Befunde der Ausgangslage

| Befund | Wirkung |
|---|---|
| Das **REF-Kästchen** kommt als „REF\|", „[REF]" oder gar nicht an (die Seitenanalyse verwirft es als Grafik) | Der REF-Marker griff fast nie. Text war oft fehlerfrei gelesen — die Auswertung scheiterte. |
| Fehlt der Marker, nahm die Kette **das erste freie Muster** | Im REF-Feld landeten „10cm", „115cm", die Postleitzahl der Anschrift, die LOT-Nummer: **21 von 28 REFs falsch eingetragen** |
| **Rauschen bei wenig Licht** wird von der Kontrastspreizung mit verstärkt | „wenig Licht": 8 von 20 Feldern; Materialklasse fast nie |
| Gleichstand zweier Lesungen → blind die erste | Oft gewann die schlechtere Lesung |
| „SF (1.67 mm)" statt „5F", „Fiihrungsdraht" statt „Führungsdraht", „Diagnostic Cathete" am Bildrand | French bzw. Klasse fehlten |

### 7.3 Was geändert wurde

| Baustein | Funktion | Wirkung |
|---|---|---|
| Kästchen-Toleranz an REF/LOT | `extractLabelFields`, `ocrRefTokens`, `ocrRefBand` | „REF\| X", „[REF] X" werden erkannt |
| Freie Muster ohne Maße/Anschrift/LOT | `ocrRefTokens` | „10cm", PLZ, LOT nie mehr REF-Kandidat |
| **Leer schlägt falsch** bei der REF | `ocrRefEntscheid` | Ohne Marker nur Vorschlag (antippen), außer der Bestand bestätigt |
| **Lichtaufbereitung** | `ocrRauschen` (Immerkær, robust), `ocrBoxBlur`, `ocrSchattenAusgleich` (Hintergrund je Kachel, Division), `ocrAufbereiten` | Rauschen weg, Schatten ausgeglichen — und Tesseract wird dadurch **schneller** |
| **Feinlesung** | `ocrZuschnitt` | Etikett ausschneiden, Wortrahmen auf ≈ 40 px bringen (LSTM normiert Zeilen auf 36 px; Fehlerquote hängt an der Versalhöhe in Pixeln) |
| **Symbol-Nachlese** | `ocrLinksVon`, `ocrMarkerArt` | Nummer ohne Beschriftung → links daneben das Symbol lesen (PSM 8 „ein Wort": 16/16, PSM 7: 12/16). REF bestätigt, LOT schließt aus |
| **Gewichtete REF-Abstimmung** | `ocrRefStimmen` | Wort-Sicherheit der Engine statt „die erste Lesung" |
| **Unsicher gelesene REF nur vorschlagen** | `ocrZusammenfuehren`, `OCR_REF_MINDESTSICHERHEIT` (65) | Alle Fehllesungen am Messstand hatten Lese-Sicherheit ≤ 59, die richtigen meist ≥ 66. Unter 65 und nicht im Bestand → Vorschlag mit Hinweis „O/0, I/1 … bitte vergleichen" |
| French mit Gegenprobe | `extractLabelFields` | „SF (1.67 mm)" → 5F nur, wenn 3 × mm passt (±0,15) |
| Einheiten-Verlesungen | `extractLabelFields` | „crn"/„rnm" hinter Ziffern → cm/mm |
| Tolerante Klassenerkennung | `merkFalte`, `merkUnscharf` (merkmale.js) | Umlaut-/„ii"-Faltung; lange Signalwörter mit 1 Lesefehler |
| **Mehrere Fotos** (bis 3) | `ocrLeseFoto`, `ocrZusammenfuehren`, `ocrReadLabels`; Assistent: `wizDoEtikettMehrere` | Jedes Foto einmal gelesen, gemeinsam ausgewertet |
| **Qualitätshinweise** | `ocrQualitaetsHinweise`, `ocrNochEinFoto` | Bei unsicherem Ergebnis: konkret (Licht, Spiegelung, Abstand, Schärfe) + „Weiteres Foto" |

### 7.4 Ergebnis am Messstand

| | Ausgangslage | jetzt, 1 Foto | jetzt, 3 Fotos |
|---|---|---|---|
| Felder richtig (von 140) | 106 (76 %) | **133 (95 %)** | 133 (95 %) |
| REF richtig (von 28) | 7 | **21** | 21 |
| REF **falsch eingetragen** | 21 | **0** | 1 |
| „wenig Licht + Rauschen" (von 20) | 8 | **19** | 19 |
| Zeit je Etikett (Testrechner, nacheinander, Störungen sauber/dunkel/Alltag) | ≈ 57 s | **≈ 7,7 s** | ≈ 3 × |

Die übrigen REF-Fehler sind fast alle **eine** Verwechslung: „M0045000CL0" wird
als „…CLO" gelesen. Bei einem unbekannten Produkt ist O/0 grundsätzlich nicht
entscheidbar; deshalb wird die Lesung jetzt nur vorgeschlagen. Steht das
Produkt im Bestand, löst `refResolve` die Verwechslung sicher auf.

**Mehrere Fotos bringen am Messstand nichts Messbares** — die synthetischen
Wiederholungen sind sich zu ähnlich, und eine Schrift verursacht auf jeder
Aufnahme denselben Irrtum. Deshalb sind weitere Fotos **ein Angebot bei
unsicherem Ergebnis, keine Pflicht**. Ihr Nutzen liegt bei Fehlern, die nur
eine Aufnahme treffen: Verwackeln, Glanzlicht an der falschen Stelle,
Fokus daneben. Eine geplante Regel „gleiche REF auf zwei Fotos gilt als
belegt" wurde nach der Messung **verworfen**: Sie hätte systematische
Fehllesungen zur Wahrheit erklärt.

### 7.5 Nächste Hebel (bewertet, nicht umgesetzt)

1. **Echte Etikettfotos in den Messstand** (20–30 Stück, gerne absichtlich
   schlechte). Größter Hebel für die Nachhaltigkeit: Schwellen (65, Licht,
   Textgröße) werden dann an der Wirklichkeit geeicht statt an Kunstbildern.
   Etiketten enthalten keine Patientendaten (Grundsatz A1).
2. **Anderes Erkennungsmodell auf dem Gerät: PaddleOCR (PP-OCRv5 mobile)**
   über ONNX Runtime Web. Offizielles JS-Paket `@paddleocr/paddleocr-js`
   (0.4.2, Apache-2.0, hängt an onnxruntime-web und OpenCV.js). Für Fotos
   (statt Scans) gebaut und dort nach mehreren Quellen robuster als Tesseract —
   die Belege sind allerdings überwiegend Blogvergleiche, keine sauberen
   Studien. Kosten: deutlich mehr Download für den Offline-Betrieb
   (Größenordnung Dutzende MB statt ~6 MB) und drei neue Abhängigkeiten.
   **Erst gegen echte Fotos (Punkt 1) messen, dann entscheiden.**
3. **Server- oder Cloud-OCR (Vision-Sprachmodell):** am genauesten, aber
   gegen offline-first und erst nach Authentifizierung von `/api/state`
   denkbar (§6, Maßnahme E1). Bleibt zurückgestellt.
4. **Kamera im Browser statt Kamera-App** (Taschenlampe, Serienbild):
   bewusst NICHT — die Kamera-App des Handys hat Nachtmodus und Mehrbild-
   Rauschminderung, an die eine Web-App nicht herankommt. Der Assistent
   empfiehlt sie deshalb ausdrücklich und erlaubt die Auswahl mehrerer
   Fotos aus der Galerie.

## 8. Testabdeckung

- `test/client-helpers.test.js` — reine Kernfunktionen: `ocrStretch`,
  `ocrRefTokens`, `ocrVoteFields`, `ocrRefBand`, `ocrWordsOf`, `refClassKey`,
  `refDistance`, `refPlausible`, `refIndex`, `refResolve`, `refLearnInto`,
  `refFromLearn`, `gudidUrl`, `gudidExtract`, `wizZusammenfassung`,
  `matPhotos` & Co.
- `test/ocr-qualitaet.test.js` — Ausbau 2026-11: Kästchen-Toleranz,
  Ausschluss von Maßen/PLZ/LOT, `ocrRefEntscheid`, `ocrBandTokens`,
  `ocrRefStimmen`, `ocrMarkerArt`/`ocrLinksVon`, Rauschschätzung,
  Schattenausgleich, Zuschnitt, Qualitätshinweise, Zusammenführen mehrerer
  Fotos, Zurückhalten unsicherer REFs.
- `e2e/ocr.js` — echte Tesseract-Engine im echten Browser unter echter CSP,
  plus REF-Auflösung, Lernschleife, GTIN-Auflösung, geführter Dialog,
  Auflösungsgrenze der Vorverarbeitung, Etikett bei wenig Licht und der
  Assistent mit zwei Fotos.
- `e2e/messen-ocr.js` — Messstand (kein Test, siehe §7.1).
- `e2e/photoedit.js` — Fotogalerie: mehrere Bilder, Vorschaubild, Speichern,
  Bildunterschriften, Lightbox.
