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

Ablauf für **ein** Foto:

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

## 7. Testabdeckung

- `test/client-helpers.test.js` — reine Kernfunktionen: `ocrStretch`,
  `ocrRefTokens`, `ocrVoteFields`, `ocrRefBand`, `ocrWordsOf`, `refClassKey`,
  `refDistance`, `refPlausible`, `refIndex`, `refResolve`, `refLearnInto`,
  `refFromLearn`, `gudidUrl`, `gudidExtract`, `wizZusammenfassung`,
  `matPhotos` & Co.
- `e2e/ocr.js` — echte Tesseract-Engine im echten Browser unter echter CSP,
  plus REF-Auflösung, Lernschleife, GTIN-Auflösung, geführter Dialog,
  Auflösungsgrenze der Vorverarbeitung.
- `e2e/photoedit.js` — Fotogalerie: mehrere Bilder, Vorschaubild, Speichern,
  Bildunterschriften, Lightbox.
