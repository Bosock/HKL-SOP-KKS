# Konzept: Material-Destillation (Stammsatz + Zuordnung) & erweiterbare Eigenschaften

Stand: 2026-07-20 · Betreiber-Anforderung: Die Materialien aus dem JSON-Import
und die selbst erfassten Materialien sind oft DASSELBE. Ziel: einen guten,
destillierten Material-Stamm aufbauen, die vielen Varianten Stück für Stück dem
„eigentlichen" Material zuordnen (die Variante wird durch die destillierte
Fassung ersetzt) — und beim Erfassen beliebige EIGENE Eigenschaften ergänzen
(z. B. „Tip Load" bei Spezialdrähten), die dann bei den nächsten Materialien
automatisch mit auftauchen.

## Leitidee: Identität vs. Vorkommen (nicht-destruktiv)

- **Stammsatz** (= das Produkt): *was es ist* — Name, GTIN/REF/Hersteller,
  Foto, Maße, beliebige eigene Eigenschaften. Der bestehende **GTINDB**
  (Etikett-Scanner) IST dieser Stammsatz; ohne Barcode gibt es einen
  manuellen Stammsatz (Schlüssel `m:<id>`).
- **Vorkommen** (im Standard): *wie/wo* — Menge, Zugang („femoral"), Position,
  Warum. Bleibt beim Standard, wird NICHT verändert.

**Zuordnung** = eine reine Verweis-Ebene `hkl_matlink`: `material_key → Stammsatz-ID`.
Die JSON-Basis wird nie angefasst; die Zuordnung ist jederzeit lösbar
(wie ukMap für Unterkategorie-Synonyme).

## Bausteine

### A) Erweiterbare Eigenschaften (`hkl_matprops`)
- Wachsendes Schema `MATPROPS = [{key,label}]`. Legt der Nutzer beim Erfassen
  eine neue Eigenschaft an (z. B. „Tip Load"), landet sie im Schema und
  erscheint bei JEDEM Produkt automatisch als Feld.
- Werte am Stammsatz: `GTINDB[id].props = { <key>: <wert> }`.
- Freitext-Feld „Weitere Maße" bleibt für Unstrukturiertes.

### B) Zuordnung / Destillation (`hkl_matlink`)
- `canonOf(material_key)` → Stammsatz oder null.
- Aus dem Eintrag-Schnellmenü „🔗 Mit Produkt verknüpfen" (Produkt wählen oder
  neu scannen/anlegen) bzw. „Verknüpfung lösen".
- Anzeige am Eintrag: Foto-Thumbnail und Badge „🔗 <Produktname>" (antippbar →
  Produktkarte). Der Eintragstext (klinische Anweisung) bleibt erhalten —
  „ersetzt" wird die IDENTITÄT (Name/Foto/Eigenschaften), nicht der Kontext.

### C) Materialzusammenführung (Verwaltung)
- Panel listet Materialien (aus MAT_INDEX), Status verknüpft/offen.
- **Duplikat-Vorschläge**: Materialien mit gleicher Normalform des Namens
  (Größen/Einheiten entfernt, Tokens sortiert) werden als Kandidaten-Gruppen
  vorgeschlagen → gemeinsam einem Stammsatz zuordnen.
- Stammsatz wählen: vorhandenes Produkt ODER neuen manuellen Stammsatz aus dem
  Namen anlegen.

## Reine, testbare Helfer
`matPropSlug`, `matNormName` (Dedup-Normalform), `matSuggestGroups`
(Kandidaten-Gruppen). Alles synchronisiert (SHARED_KEYS) und rücknehmbar.

## Bewusst NICHT in v1
- „Generisch vs. konkret" als harte Regel (offene Frage des Betreibers) —
  v1 lässt Zuordnung optional, Vorkommen dürfen unverknüpft/generisch bleiben.
- Automatisches Verschmelzen ohne Bestätigung — es gibt nur Vorschläge.

## v2 — Eine zentrale Materialverwaltung (materialhub.js)
Die früher getrennten Material-Menüs sind zu EINEM Ort verschmolzen:
- „Material pflegen" (Foto/Lagerort/Preis, hkl_care+hkl_prod),
- „Etikett-Scanner" (Barcode-Stammsatz mit Maßen & eigenen Eigenschaften, GTINDB),
- „Materialzusammenführung" (Destillation, hkl_matlink).

`renderMaterialHub()` (im „care"-Modus, ☰ → „🧬 Material verwalten") listet jedes
Material mit Foto, Vorkommen (in welchen Standards) und Status; ein Tipp öffnet
EINEN Editor — den reichen Stammsatz-Editor (`renderScanItemForm`) mit Scan 📷,
OCR, Foto-Zuschnitt, Maßen, eigenen Eigenschaften, Preis, Lagerort. Duplikate
werden im Hub direkt zusammengeführt (`matHubMerge`). Aus einem Standard-Eintrag
öffnet „🧬 Material verwalten" (`matManage` → `openMaterial`) denselben Editor.

Der Stammsatz (GTINDB, inkl. manueller „m:…") ist die EINZIGE Quelle der
Identität. `openMaterial(key)` legt bei Bedarf einen Stammsatz an und übernimmt
Alt-Pflegedaten (Foto, Lagerort, Hersteller, REF, Verwendung, Preis) verlustfrei
via `matSeedFromCare` — nicht-destruktiv (hkl_care/hkl_prod bleiben als Fallback).
Der klassische Etikett-Scanner bleibt für den Nutzungs-Modus (Produkt-Identifikation
ohne Anmeldung) erhalten; `renderCareLegacy` bleibt als Fallback im Code.
