# Hinweise für Claude Code (und jeden KI-Assistenten)

Diese Datei wird zu Beginn jeder Sitzung gelesen. Sie fasst zusammen, was gilt;
die verbindliche Fassung steht in [`docs/GRUNDSAETZE.md`](docs/GRUNDSAETZE.md).

## Zuerst lesen

1. [`docs/GRUNDSAETZE.md`](docs/GRUNDSAETZE.md) — Teil A (Vorgaben des Hauses),
   Teil B (Entwicklung, ① bis ⑬), Teil C (was `npm run check` prüft),
   Teil D (Arbeitsweise).
2. [`docs/NEUE-APP.md`](docs/NEUE-APP.md) — die neue App im Neuaufbau: Leitregeln,
   Funktionen, Datenmodell, Prüfungen, Messungen.
3. [`docs/NEUAUFBAU.md`](docs/NEUAUFBAU.md) — Bestand und Neuaufbau, Live schalten.
4. Technik: [`ARCHITECTURE.md`](ARCHITECTURE.md), [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Die Regeln in Kürze (Teil D)

- **Am Live-Bestand wird nichts geändert** (`public/js`, `public/index.html`).
  Neues nur in `public/neu/`. Geteilten Code (z. B. `public/js/features/ocr.js`)
  nicht anfassen.
- **Nie den Live-Schalter betätigen.** sops.kardio.wiki nur lesen (GET).
- **Erst Konzept, dann Freigabe, dann bauen.** Funde in älteren Teilen berichten,
  nicht still reparieren.
- **Kein neues Menü je Wunsch** (⑫) — Prüfliste: Feld/Merkmal in der Maske →
  Auswahlfeld/Listen-Verzeichnis → Filter im Verzeichnis → Einstellung am Ort →
  das eine Bearbeiten-Menü → sonst Vorschlag, nicht bauen.
- **Begriffe** (⑬): Kategorie, Merkmal, Pflichtangabe, unbestätigt/bestätigt,
  Bestand/Neuaufbau.
- **Keine Patientendaten, keine Charge, kein Verfall** (A1, A2).
- **Leer schlägt falsch** (①), **keine nativen Eingabefenster** (⑧),
  **Gerätespeicher nur über `store`** (⑪).
- **Messen statt behaupten**; vor dem Push `npm run check`, `npm test`,
  betroffene `e2e/`-Suiten; Cache-Version in `public/sw.js` erhöhen; Doku nachziehen.
- **Pull Requests nur als Entwurf**; zusammenführen tut der Auftraggeber.

## Sprache

Antworten, Doku, Commit-Texte und Oberfläche auf Deutsch (A8): klar, ohne
Fachjargon in der Bedienung, mit Begründung.
