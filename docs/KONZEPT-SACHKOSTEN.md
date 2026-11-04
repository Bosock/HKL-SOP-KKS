# Konzept (geparkt): Sachkostenerhebung je Eingriff mit SAP-Abgleich

**Stand:** 04.11.2026 · **Status:** geparkt — wird später wieder aufgegriffen.
Hier festgehalten, damit die Vorüberlegungen nicht verloren gehen.

## Anlass

Der Einkauf möchte eine Sachkostenerhebung machen. Die Standards der App
führen jedes Material eines Eingriffs auf (steriler Tisch, Umfeld, Geräte).
Ziel: über einen einfachen Datenabgleich mit SAP (Materialwirtschaft) schnell
zu den Kosten pro Eingriff kommen.

## Was es schon gibt

- **Stammsätze** (`GTINDB`, `hkl_gtin`) mit GTIN, REF und Hersteller.
- **Verknüpfung** Standard-Eintrag → Stammsatz (`hkl_matlink`, `canonOf`).
- **Stückpreise und Plankosten** je Standard (`features/pricing.js`, `hkl_prod`)
  samt CSV-Export (Verwaltung → Kostenübersicht).

## Bisherige Empfehlung

**Datei-Abgleich statt Live-Schnittstelle.** Die App läuft auf einem externen
Server; eine Verbindung zum SAP der Klinik bräuchte eine Freigabe der IT und
Arbeit an SAP selbst.

1. **App → Einkauf:** Export „Materialliste je Eingriff" (Standard, Material,
   Menge, GTIN, REF, Hersteller, verknüpft ja/nein).
2. **Einkauf → App:** SAP-Export (Materialnummer, GTIN, Hersteller,
   Herstellerteilenummer = REF, Preis, Preiseinheit). Abgleich: eindeutig /
   mehrdeutig / kein Treffer; nur Eindeutiges wird übernommen (leer schlägt
   falsch).
3. Danach die **SAP-Materialnummer am Stammsatz** speichern — dauerhafte
   Zuordnung, spätere Preisstände per Neu-Import.

Zuordnungsschlüssel: GTIN, ersatzweise REF + Hersteller.

## Geklärt

- **Verpackungsebene der GTIN** (Einzelstück vs. Packung): hat der Einkauf im
  Blick und berücksichtigt — kein offener Punkt für die App
  (Rückmeldung des Betreibers, 04.11.2026).

## Offen, wenn das Thema wieder aufgegriffen wird

- **Mengen:** 518 von 1.625 Material-Einträgen der mitgelieferten Standards
  (32 %) haben keine Menge. Die Plankosten zählen sie derzeit stillschweigend
  als 1 (`mengeNum`). Für eine Erhebung müssten sie als „Menge offen"
  erscheinen.
- **Soll vs. Ist:** Standards sind Soll-Listen; „bei Bedarf", Größen-
  Alternativen (44 Einträge mit mehreren Größen) und Zugangsvarianten brauchen
  eine Kennzeichnung (immer / bei Bedarf / Alternative).
- **Geräte** sind Mehrweg — getrennt ausweisen, nicht als Stückpreis je Fall.
- **Preis am Stammsatz statt am Eintragstext:** `hkl_prod` hängt am
  `material_key`, nicht an der GTIN — vereinheitlichen.
- **Sollen Einkaufspreise überhaupt in die App?** Externer Server, geteiltes
  Passwort, mögliche Vertraulichkeitsklauseln der Lieferverträge.
  Alternative: Die App liefert nur Mengenliste + Kennungen, der Einkauf rechnet
  in SAP/Excel. Entscheidung des Hauses.
- **Vom Einkauf benötigt:** Beispiel-Export aus SAP (≈ 20 Zeilen, echte
  Spaltennamen); gewünschte Kostenart (Soll je Standard oder Ist); Geräte ja/nein.
