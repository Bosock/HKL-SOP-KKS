# Konzept: Die mitwachsende Bestell-Datenbank (Bestätigung zuerst)

Stand: 2026-08-11 · Betreiber-Anforderung: „Da die Materialien immer
wiederkehrend sind und dem Material, das verbraucht wird, entsprechen, wäre es
sinnvoll, kontinuierlich abzugleichen — damit man irgendwann OHNE Foto die
Bestelldaten hat. Ein sinnvoller, robuster, zuverlässiger Weg, damit am Ende
eine verlässliche Bestell-Datenbank entsteht."

## Der Befund: die Datenbank existiert schon

Eine verlässliche Bestell-Datenbank muss nicht neu gebaut werden — sie besteht
aus zwei Teilen, die es längst gibt:

- **GTINDB** (`hkl_gtin`) — die Produkt-**Stammsätze**: Name, GTIN, REF,
  Hersteller, Lagerort, Foto. Gepflegt vom Etikett-Scanner.
- **MATLINK** (`hkl_matlink`) — die **Brücke** `material_key → Stammsatz`.
  `canonOf(material_key)` löst sie auf.

Der Bestell-Scan (📷 im Meldeformular) las bisher GTIN und Foto, hängte sie aber
nur an die **einzelne Bestellung**. Das Gelernte versickerte dort — beim
nächsten „ist leer" musste man erneut fotografieren.

**Die Idee:** Jeder Scan zahlt in den gemeinsamen Stamm ein, statt sein Wissen
wegzuwerfen. Über die Zeit wird jedes wiederkehrende Material einmal erkannt und
danach ohne Foto bestellbar.

## Der gewählte Weg: „Bestätigung zuerst"

Ein falscher Auto-Abgleich würde die Datenbank vergiften (Grundsatz ①: *leer
schlägt falsch* — lieber keine Daten als falsche). Deshalb reift ein Scan nicht
von selbst zur Wahrheit, sondern erst durch einen Menschen.

### Vier Takte

**① Einzahlung** (`bestStammEinzahlen`, `bestLernErfassen`)
Beim Scan:
- Der **Stammsatz** wird angelegt/ergänzt — **nur leere Felder**, nie
  überschreibend. Web-Treffer (AccessGUDID) werden als „unbestätigt" markiert.
  Das Foto wandert an die Fotoliste des Stammsatzes (`matPhotoAdd`, ohne
  Dubletten) — ab jetzt für jeden nutzbar.
- Das Paar `material_key ↔ GTIN` wird als **Vorschlag** notiert (`hkl_bestlern`),
  mit Zähler und Herkunft. Noch keine Verknüpfung.

**② Reifung** (`bestLernBestaetigen`)
Ein Vorschlag bleibt Vorschlag, bis ein Mensch ihn **bestätigt** → dann setzt
die App `matLinkTo(material_key, gtin)`, dieselbe Brücke, die auch die
Materialzentrale pflegt. Ein **Widerspruch** (schon verlinkt, aber ein anderes
Produkt gescannt) wird erkannt (`bestLernStatus → 'widerspruch'`) und **nie
still übernommen** — nur ein Mensch darf umhängen. Ein Fehlscan lässt sich
**verwerfen** (`bestLernVerwerfen`); er taucht nicht wieder auf.

**③ Auszahlung** (`bestBestelldaten`, `bestDatenZeigen`)
Ist ein Material bestätigt verlinkt, stehen beim nächsten „ist leer" sofort
REF, Hersteller, Lagerort und GTIN im Formular — **ohne Foto**. Die GTIN wandert
automatisch an die Meldung. Ist nur ein (unbestätigter) Vorschlag vorhanden,
zeigt das Formular ihn als solchen mit einem Knopf „übernehmen" — nicht als
Tatsache.

**④ Prüffläche** (`bestLernPanelHTML`)
Ein Admin-Panel auf der Bestell-Seite listet offene Vorschläge und Widersprüche
(Widersprüche oben, rot) zum **Bestätigen** oder **Verwerfen**. Der Mensch
behält die Hoheit.

## Datenmodell (`hkl_bestlern`)

```
BESTLERN = {
  "<material_key>": {
    vor: { "<gtin>": { n, erst, letzt, name, ref, hersteller } },  // offene Vorschläge
    weg: [ "<gtin>", … ]                                            // verworfen, nie erneut
  }
}
```

Die **bestätigte** Verknüpfung liegt bewusst NICHT hier, sondern in `MATLINK` —
so profitiert die ganze App (Materialzentrale, Standards, Bestellung) von jeder
Bestätigung, und `bestlern` bleibt reine Vorschlags-Ebene.

Status eines Materials (`bestLernStatus`):

| Status        | Bedeutung |
|---------------|-----------|
| `verlinkt`    | bestätigter Stammsatz — Auszahlung ohne Foto |
| `widerspruch` | verlinkt, aber ein abweichendes Produkt gescannt |
| `vorschlag`   | ein Scan liegt vor, noch nicht bestätigt |
| `leer`        | nichts bekannt |

## Robustheit (die Zusagen, an denen das steht)

- **Nichts überschreiben:** Einzahlung füllt nur leere Felder; Gepflegtes ist
  geschützt.
- **Kein Blind-Verlinken:** Varianten (6 F/7 F) und Tippfehler sehen gleich aus —
  nur ein Mensch kennt den Unterschied (dieselbe Lektion wie `matDubletten`).
- **Rücknehmbar:** `MATLINK` ist eine reine Verweis-Ebene; jede Verknüpfung ist
  lösbar, die JSON-Basis wird nie angefasst.
- **Herkunft sichtbar:** Web-Stammsätze tragen `quelle` (unbestätigt), bis der
  Etikett-Scanner sie prüft.
- **Geteilt & gesichert:** `hkl_bestlern` liegt in `SHARED_KEYS` (Sync) und
  `BACKUP_KEYS` (Export) — der Lernstand kommt am anderen Gerät an und geht bei
  einem Backup nicht verloren.

## Tests

- `test/bestlern.test.js` — 16 Unit-Tests: Vorschlag zahlt nicht aus,
  Bestätigen verlinkt über MATLINK, Widerspruch, Verwerfen, Einzahlung ohne
  Überschreiben, Zähler, Namen, Persistenz.
- `e2e/seiten.js` (Abschnitt 9b) — der Weg in der echten App: Vorschlag →
  Admin-Panel → Bestätigen → Formular zeigt Bestelldaten ohne Foto.

## Die Erfassung: geführt, sichtbar, persistent

Der Befund des Betreibers: „Die Bilder verschwinden — sie sollen sichtbar
bleiben, damit man beim Bestellen gucken kann. Und die GTIN soll extrahiert und
angezeigt werden. Lass uns da auch eine geführte Erfassung machen wie bei der
Materialwirtschaft."

- **Geführte Erfassung (📸):** Der Foto-Knopf im Meldeformular startet jetzt
  denselben Dialog wie die Materialwirtschaft (`features/ocrwizard.js`) —
  Barcode aufnehmen → GTIN steht fest → Etikett aufnehmen → prüfen → übernehmen.
  Der Dialog ist über einen Rückruf wiederverwendet (`ocrWizStart({ fertig })`);
  der Material-Weg bleibt unverändert. `adminfrei:true`, weil eine Bestellung
  jede Person melden darf.
- **GTIN sichtbar:** Die gelesene Nummer erscheint als „🏷️ GTIN …"-Zeile im
  Formular (`#bestErkannt`) und auf der Bestellkarte — nicht mehr nur still in
  `b.gtin` gespeichert.
- **Foto bleibt:** Das Bild wird über den Medienspeicher abgelegt (Kennung, kein
  base64) und auf der Karte als größeres, antippbares Bild gezeigt (76 px,
  data-zoom öffnet es formatfüllend) — sichtbar beim Bestellen, nicht ein
  verschwindendes Vorschaubild.

Getestet in `e2e/seiten.js` (Abschnitt 9c): geführtes Ergebnis einspeisen →
GTIN im Formular, Name gefüllt, Foto als Medien-Kennung, nach dem Speichern GTIN
und Foto auf der Karte.
