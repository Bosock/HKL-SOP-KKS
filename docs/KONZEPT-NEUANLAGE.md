# Konzept: Geführte Neuanlage („Was ist das?")

**Stand:** 04.11.2026 · **Quelle:** Schaubild „Workflow Einträge" des Betreibers
· **Schalter:** `neuFrei('erfassung')` (zuerst nur im Neuaufbau, Grundsatz ⑩)
· **Code:** `public/js/features/erfassung.js`

## Anlass

Beim Anlegen neuer Materialien wurden Kategorien, Größen und Längen kaum
richtig erkannt. Felder mussten doppelt ausgefüllt werden, und für kleines
Material (z. B. einen Nadelhalter) fehlten passende Kategorien – man scrollte
durch lange Listen. Entscheidung des Betreibers: **Erst wird die Kategorie
gewählt, dann wird gescannt.**

## Ablauf

```
Neuer Eintrag ──► „Was ist das?" (einmal antippen)
                    │  Material · Gerät · Medikament · Hinweis · Anweisung ·
                    │  Überschrift · Personal · ＋ eigene Art
                    │
                    ├─ Material ──► ① Kategorie (Pflicht, vor GTIN/REF; ＋ Neue Kategorie)
                    │               ② GTIN · REF · Hersteller  ← EIN Etikettfoto
                    │               ③ Merkmale der Kategorie   ← dasselbe Foto
                    │               ④ Kontrolle & Speichern
                    ├─ Gerät ─────► vorerst Bezeichnung/Hersteller/Modell (siehe „Offen")
                    └─ alles andere ► das gewohnte Eintragsformular, Art vorgewählt
```

- **Wo gefragt wird:** im Standard bei jedem „＋ Eintrag" (alle Arten) und in
  der Materialverwaltung bei „＋ Material anlegen", „＋ Neues Material oder
  Gerät" und bei einem Scan mit unbekannter GTIN (nur beschaffbare Arten:
  Material, Gerät, eigene beschaffbare).
- **Einfachauswahl statt Checkbox:** Ein Eintrag hat genau eine Art. Ein Tipp
  genügt, kein zusätzliches Bestätigen.

## Die vier Material-Schritte

### ① Kategorie
Suchbare Liste aller Kategorien (Materialklassen), mit Anzahl der schon
erfassten Produkte. „＋ Neue Kategorie anlegen" legt sie direkt an. Für sie
gelten sofort die allgemeinen Felder (steril, Einmalgebrauch, Latex …), eigene
Felder lassen sich in Schritt ③ ergänzen.

**Kategorie und Materialklasse sind ein Feld** (Betreiber-Entscheidung):
Am Stammsatz ist `klasse` der Schlüssel und `kategorie` die Bezeichnung. Im
Produktformular gibt es kein freies Kategoriefeld mehr. Maßliste und freie
Eigenschaften erscheinen nur noch als „Ältere Angaben", wenn ein Stammsatz
dort schon Werte hat.

### ② GTIN · REF · Hersteller — exakt und mit Herkunft
| Feld | Woher | Absicherung |
|---|---|---|
| GTIN | **nur** Barcode (Foto) oder Handeingabe | GS1-Prüfziffer sofort geprüft; falsche Prüfziffer hält an |
| REF | Barcode (AI 240) → eigener Bestand / Katalog / AccessGUDID → Etikett | unsicher Gelesenes nur als Vorschlag zum Antippen (Zeichen für Zeichen vergleichen) |
| Hersteller | **Auswahl** (gepflegte Liste + schon verwendete Namen, keine Schreibvarianten) | Vorschlag aus dem **GTIN-Präfix**, wenn bereits erfasste Produkte mit derselben Herstellernummer eindeutig einen Hersteller nennen; das Etikett gewinnt gegen den Präfix |

Jedes Feld zeigt seine Herkunft (Barcode exakt · Etikett gelesen · aus der
GTIN · von Hand …). Am Stammsatz wird sie als Schlüssel (`quellen`) gespeichert.

**Dubletten:** Ist die GTIN (oder eine Verpackungsstufe davon) schon erfasst,
bietet die App „Dieses Produkt verwenden" an. Aus dem Standard heraus wird dann
nur die Zeile eingefügt, kein zweiter Stammsatz. Steht die REF schon an einem
anderen Produkt, wird ebenfalls gefragt.

### ③ Merkmale
- Gesucht werden **die Felder der gewählten Kategorie** (`merkSammeln(…,
  klasseFest)`), nicht die einer geratenen Klasse. Nennt das Etikett eher eine
  andere Kategorie, erscheint „Kategorie wechseln?" – entschieden wird nicht
  automatisch (Grundsatz ③).
- **★ Differenzierungsmerkmale** stehen vorn und bilden den Namensvorschlag
  („Ablationskatheter · LARGE · 8 F · irrigiert"). Vorgabe sind die
  Leitmerkmale des Katalogs.
- Offen stehen nur die ★-Felder und alles mit Wert. **Leere Felder liegen
  zugeklappt** („Nicht gefunden – bei Bedarf von Hand").
- Was auf dem Etikett steht, aber zu keinem Feld gehört, steht unter
  „Außerdem auf dem Etikett" (Grundsatz ②).
- Weitere Etikettfotos (bis 3) werden gemeinsam ausgewertet. Von Hand
  Eingetragenes überschreibt keine Erkennung.

### ④ Kontrolle
Alle Werte mit Herkunft. Pflicht sind Kategorie, GTIN (oder bewusst „keine
GTIN"), REF (oder bewusst „keine REF") und Hersteller. Noch leere ★-Felder
werden benannt. Speichern legt den Stammsatz an und fügt im Standard die Zeile
ein, die auf das Produkt zeigt (`material_key = produkt:<id>`, wie im Editor).

## Kategorien & Felder pflegen (ohne Entwickler, Grundsatz A7)

Ein Menü, zwei Einstiege (Grundsatz ⑥): **Verwaltung → Inhalte pflegen →
🗂 Kategorien & Felder** und **„⚙ Felder dieser Kategorie" in Schritt ③**.

- Felder je Kategorie an- oder abwählen, ★ setzen, Kategorie umbenennen.
- **Neues Merkmal:** Bezeichnung, Typ (Text · Maß mit Einheit · Zahl ·
  Ja/Nein · Auswahl), Einheit, Werte, und wie es auf dem Etikett steht.
  Gesucht wird ein eigenes Merkmal nur hinter seiner Beschriftung, damit keine
  Zufallstreffer entstehen (leer schlägt falsch).
- Gespeichert als Overlay `hkl_kattpl` über `data/merkmale.json`. Die Quelle
  bleibt unverändert, alles ist umkehrbar (Grundsatz ⑦), und es wird auf alle
  Geräte geteilt.

## Offen

- **Geräte-Ablauf:** Der Betreiber möchte Geräte genormt aufnehmen. Bis dahin
  legt die Materialverwaltung ein Gerät mit Bezeichnung, Hersteller und Modell
  an. Weitere Angaben folgen unter Material → Geräte. Im Standard öffnet
  „Gerät" das gewohnte Formular.
- **Kategorien vorbefüllen:** Für Instrumente (Nadelhalter u. a.) und
  Punktionskanülen gibt es noch keine Vorlage. Sie lassen sich in der App
  anlegen; ob sie in `data/merkmale.json` mitgeliefert werden sollen,
  entscheidet der Betreiber.
- **Freigabe für den Bestand:** nach dem Test im Neuaufbau über Verwaltung →
  🧪 Neuaufbau → „Neuerungen freigeben" → „Geführte Neuanlage".
