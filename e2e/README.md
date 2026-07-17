# End-to-End-Tests (Browser gegen echten Server)

Diese Suite beweist die **Backend-Anbindung jeder Funktionsgruppe** im echten
Chromium gegen den echten Server — sie ist die dauerhafte, versionierte Form
der Nachweise aus den Audits (QA-Befund P7: Beweise gehören ins Repo).

**Bewusst NICHT Teil von `npm test`/CI**: braucht ein installiertes Chromium.

## Ausführen

```bash
npm run e2e            # alle Suiten (jede startet ihren eigenen Server)
node e2e/quickwins.js  # einzelne Suite
```

Voraussetzungen: Node ≥ 18 und Playwright mit Chromium — entweder global
(`npm i -g playwright && npx playwright install chromium`) oder lokal;
alternativ Pfad zu einem Chrome/Chromium via `E2E_CHROME=/pfad/zu/chrome`.

## Suiten

| Datei | Beweist |
|---|---|
| `backend-roundtrip.js` | Gerät A schreibt über die realen Save-Funktionen **aller 13 geteilten Module** → Server → Gerät B liest denselben Stand |
| `scanner.js` | Etikett-Scanner end-to-end (ohne echte Kamera, `onDecode` mit GS1-Strings): Parser · unbekannter Scan → Formular · Speichern → Produktdatenbank · erneuter Scan → Wiedererkennung · Server-Persistenz · Gerät B |
| `sync-rerender.js` | Eigene Edits erzeugen kein überflüssiges Re-Rendering; Fremd-Edits werden übernommen und rendern |
| `payload-too-large.js` | 413-Kette: sauberer Serverstatus, klare Client-Meldung, Daten bleiben lokal |
| `auth-button.js` | Login-Knopf je OAuth-Konfiguration; `/auth/user`-Flag; GitHub-Redirect |
| `ui-hardening.js` | Apostroph-Namen zerbrechen nichts; Foto-Verkleinerung; Druck-Export ohne Steuerzeichen |
| `quickwins.js` | Zoom frei · 🔎-Kopfleiste · Such-Fallback · ⋯-Button (beide Rollen) · „lokal"-Pill + Offline-Hinweis · Tagesreset-Hinweis · Quota-Warnung mit Lese-Fallback · Altfoto-Migration · WCAG-Kontraste |
