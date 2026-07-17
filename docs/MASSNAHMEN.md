# Maßnahmen-Backlog (führende Liste)

**Dies ist die EINZIGE maßgebliche Prioritätenliste** — sie konsolidiert die
Roadmaps aus allen Berichten (System-Audit, QM-Konzept, UX-Audit, QA-Gutachten
unter `docs/audits/` bzw. `docs/konzepte/`). Die Berichte bleiben als Begründung
und Detail-Referenz stehen; **Status wird nur hier gepflegt** (per Commit).

Stand: 2026-07-17 · Status: ☐ offen · ◐ in Arbeit · ☑ erledigt · ✋ wartet auf Entscheidung

## Entscheidungen (blockieren Umsetzung)

| # | Entscheidung | Kontext | Status |
|---|---|---|---|
| E1 | **Schutz für `/api/state`**: (a) Shared-Secret, (b) Schreiben nur mit GitHub-Login *(empfohlen)*, (c) Basic-Auth im Proxy | System-Audit S1 + QA R1 (DSGVO!) — höchstes Risiko des Systems | ✋ Betreiber |
| E2 | Schleusen-Farbtabelle 4F–9F freigeben + Prüfung gegen Hausbestand (wer?) | QM-Konzept §5 | ✋ Betreiber |
| E3 | Zweitmerkmal radial/femoral: Rahmen-Muster *(empfohlen)* / Badge / beides | QM-Konzept §5 | ✋ Betreiber |
| E4 | Benennungs-Tabelle (u. a. „Einstufung prüfen" → „Automatische Zuordnung prüfen") | QM-Konzept §8 | ✋ Betreiber |
| E5 | Klinik ISO-9001-zertifiziert? → entscheidet über Freigabe-Workflow | QA R3 | ✋ Betreiber |

## HOCH (als Nächstes)

| # | Maßnahme | Quelle | Status |
|---|---|---|---|
| H1 | E1 umsetzen (nach Entscheidung) + `hkl_authpw`/Personennamen nicht mehr unauthentifiziert ausliefern | S1/S2/R1 | ✋ E1 |
| H2 | Offsite-Backup-Cron auf dem Host einrichten (Anleitung: CONTRIBUTING „Offsite-Kopie") + vierteljährliche Restore-Probe | QA P3/V3 | ☐ (Host-Zugriff nötig) |
| H3 | Word→JSON-Datenpipeline dokumentieren bzw. Konverter einchecken | QA P6/V5 | ☐ |
| H4 | 3–5 beobachtete Nutzertests vor Phase-2-UI-Umbau | QA Q3/V6 | ☐ |
| H5 | Zweite interne Wartungsperson per CONTRIBUTING-Walkthrough einarbeiten | QA W1 | ☐ |
| H6 | Kontextsensitives Bearbeiten-Menü je Elementtyp (gebündelt statt 15er-Liste) | QM §3 / UX 10 | ◐ Eintrags-Menü in 4 Fächer gegliedert (2026-07-17); offen: eigene Einstiege Rubrik-Kopf/Standard-Titel |
| H7 | Wirkungs-Chips („ändert WAS/WO, sichtbar für WEN") in Verwaltung & Scope-Dialog | QM §1 / UX H6 | ☐ |

## MITTEL

| # | Maßnahme | Quelle | Status |
|---|---|---|---|
| M1 | `prompt()`-Dialoge → Formularsystem (Reihenfolge: Login → Umbenennen → Glossar) | UX H3/M5 | ☐ |
| M2 | Undo-Snackbar (5 s) für Ausblenden/Löschen/Übernehmen | UX H4 | ☐ |
| M3 | Formular-Verwerfen-Guard bei befülltem Formular | UX H5 | ☐ |
| M4 | Tastatur/Screenreader-Grundpass (role/tabindex/Enter auf Listen, `:focus-visible`, aria-live für Toasts) | UX K3/M7/M8 | ☐ |
| M5 | Verwaltungs-Gliederung + Einstellungs-Suche | UX M1 / QM §4B | ☐ |
| M6 | `baseRev` → echte 409-Konflikterkennung (oder Feld entfernen) | System-Audit T2 | ☐ |
| M7 | Admin-Rendering aus `features/backup.js` nach `ui/admin.js` verschieben | System-Audit T1 | ☐ |
| M8 | Journal light (wer/wann je Änderung) + Aufräumen erledigter Vorschläge | QA V10 / QM §1E | ☐ |
| M9 | Combobox-Baustein mit „＋ Hinzufügen" (Status, Gruppen, Lagerorte, …) | QM §7 | ☐ |
| M10 | Mengen-Hervorhebung automatisch bei ≠1x (mit Übersteuerung) | QM §9 | ☐ |
| M11 | Bedingungs-Kennzeichen „⚡ nur wenn: …" + Erkennungs-Assistent | QM §10 | ☐ |
| M12 | Norm-Farbprofile Material (nach E2/E3) | QM §5 | ✋ E2/E3 |

## NIEDRIG / SPÄTER

| # | Maßnahme | Quelle | Status |
|---|---|---|---|
| N1 | Namens-Zerlegung (Klammern → Badge; „für/oder") mit Bestands-Vorschau, je Regel einzeln | QM §11 | ☐ |
| N2 | Standard-Anlage-Assistent (Vorlage/Häufigkeit/Katalog) | QM §12 | ☐ |
| N3 | Zusatzfelder am Eintrag (Vorstufe Abfrage-Builder) | QM §6C | ☐ |
| N4 | Serienpflege-Flow („Speichern & nächstes offene Material") | UX §5 | ☐ |
| N5 | Onboarding-Coachmarks (3 Stück, einmalig) | UX Roadmap | ☐ |
| N6 | Speicherpfad-Migration `overrides`/`reassign` → QE-Overlay | QM §2 | ☐ |
| N7 | Visionär: Steril-Sprachmodus, QR am Regal, Wandmonitor-Board | UX Roadmap | ☐ |
| N8 | Etikett-Scanner **Phase 2**: Texterkennung von REF/Hersteller/Maßen — **erledigt als On-Device-OCR** (Betreiber-Entscheidung); Cloud-Vision bewusst NICHT umgesetzt | Scanner | ☑ (2026-07-17) |

## Erledigt

| Datum | Maßnahme | Quelle |
|---|---|---|
| 2026-07-16 | CSP/HSTS/Permissions-Policy, HMAC-Sessions, CSRF-State, Snapshots, `npm run check`, CONTRIBUTING | System-Audit-Vorarbeit |
| 2026-07-16 | `.env`→Container (SESSION_SECRET/GITHUB_*), OAuth-Sackgasse (Button versteckt), SW-`/auth/`-Bypass, Geister-Session-Guard | PR #2 |
| 2026-07-16 | CI auf Pull Requests (nur Test-Stufe); Sync ohne überflüssige Re-Renders | PR #2 |
| 2026-07-16 | 413 sauber (Server + Client-Meldung „zu groß") | PR #2 |
| 2026-07-16 | NUL-Byte entfernt; 6× Apostroph-onclick entschärft; Foto-Verkleinerung (Neuaufnahme); README/ARCHITECTURE-Drift | Audit-Fixes `676dd36` |
| 2026-07-17 | **P1 Quota-Schutz** (Warnung + Lese-Fallback) · **P2 `esc('…')`-Root-Fix** · **P5 fsync** · **P4 Log-Rotation** | QA V2/V8/V12/V9 |
| 2026-07-17 | **UX-Quick-Wins:** Zoom frei (K2) · ⋯-Button für alle (K1) · „lokal"-Pill + Offline-Toast + role=status (K4) · Tagesreset-Hinweis (K4c) · 🔎-Kopfleiste (H1a) · Kontrast-Token + Mindestschrift + 44-px-Buttons (H2/N1) · QR-Hint nur Admin (H7) · Such-Fallback (M2) | UX Quick Wins |
| 2026-07-17 | **Altfoto-Migration** (Bestand wird nachverkleinert, geteilt) | QA P1-Folge |
| 2026-07-17 | **E2E-Suite versioniert** (`e2e/`, 6 Suiten, `npm run e2e`) | QA P7/V7 |
| 2026-07-17 | Offsite-Backup-Anleitung (CONTRIBUTING) · MDR-Leitplanke (README) · diese Liste | QA V3/V11/V4 |
| 2026-07-17 | **Etikett-Scanner & Produktdatenbank (Phase 1):** Live-Barcode/UDI-DataMatrix via nativem `BarcodeDetector` → GTIN/LOT/Verfall (offline, zero-dep, keine CSP-Änderung); GTIN als DB-Schlüssel; REF/Hersteller/Maße 1× je GTIN; `hkl_gtin` geteilt + Backup; 20 Unit-Tests + E2E-Suite `scanner.js` | Betreiber-Entscheidung: Barcode-first, Android-Chrome |
| 2026-07-17 | **Bearbeiten-Menü gegliedert (QM §3, Teil von H6):** flache 15er-Liste → vier Fächer *Inhalt · Darstellung · Organisation · Gefahrenzone* mit Überschrift + Ein-Satz-Erklärung; material-/gerätespezifische Aktionen nur bei beschaffbaren Einträgen; E2E-Check | Menü-Ordnung zuerst |
| 2026-07-17 | **Etikett-Scanner Phase 2 — On-Device-OCR:** Foto → REF/Hersteller/Maße per Tesseract.js (WASM, selbst gehostet unter `public/vendor/tesseract/`, ~6 MB, lazy, offline); `extractLabelFields` rein/testbar; füllt nur leere Felder; CSP `wasm-unsafe-eval`+`worker-src blob:`; Server-MIME `.wasm`/`.gz`; 4 Unit-Tests + E2E `ocr.js` (echte Engine liest echten Text) | Betreiber-Entscheidung: On-Device statt Cloud |
