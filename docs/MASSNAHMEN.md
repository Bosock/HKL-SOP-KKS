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
| E6 | **Verwaltungspolitik-Modell**: Regel-Journal (append-only) + Reichweiten-Kaskade (📍 Stelle > 📄 Standard > 🗂 Gruppe > 🌐 alle) + Inspektor + Treffervorschau | `docs/konzepte/2026-07-17-verwaltungspolitik-revision.md` (v2) | ☑ freigegeben 2026-07-18; **Stufen 1–3 umgesetzt** + Stufe-4-Governance (Bestätigung weiter Reichweiten); offen nur: Stufe-4-**Vier-Augen** (hängt an E5) |

## HOCH (als Nächstes)

| # | Maßnahme | Quelle | Status |
|---|---|---|---|
| H1 | E1 umsetzen (nach Entscheidung) + `hkl_authpw`/Personennamen nicht mehr unauthentifiziert ausliefern | S1/S2/R1 | ✋ E1 |
| H2 | Offsite-Backup-Cron auf dem Host einrichten (Anleitung: CONTRIBUTING „Offsite-Kopie") + vierteljährliche Restore-Probe | QA P3/V3 | ☐ (Host-Zugriff nötig) |
| H3 | Word→JSON-Datenpipeline dokumentieren bzw. Konverter einchecken | QA P6/V5 | ☐ |
| H4 | 3–5 beobachtete Nutzertests vor Phase-2-UI-Umbau | QA Q3/V6 | ☐ |
| H5 | Zweite interne Wartungsperson per CONTRIBUTING-Walkthrough einarbeiten | QA W1 | ☐ |
| H6 | Kontextsensitives Bearbeiten-Menü je Elementtyp (gebündelt statt 15er-Liste) | QM §3 / UX 10 | ☑ (2026-07-17) Eintrag · Rubrik · Standard nutzen dasselbe gegliederte Menü |
| H7 | Wirkungs-Chips („ändert WAS/WO, sichtbar für WEN") in Verwaltung & Scope-Dialog | QM §1 / UX H6 | ◐ (2026-07-17) Chips + „Ändert…"-Untertitel in den Bearbeiten-Menüs; offen: Live-Vorschau (C), Scope-Dialog-Chips |

## MITTEL

| # | Maßnahme | Quelle | Status |
|---|---|---|---|
| M1 | `prompt()`-Dialoge → Formularsystem (Reihenfolge: Login → Umbenennen → Glossar) | UX H3/M5 | ◐ (2026-07-18) Neue Unterkategorie/Kategorie (Sheet + Verwaltung) auf Eingabefeld umgestellt — behob lautloses Fehlschlagen im installierten PWA-Fenster; offen: Umbenennen, Symbol-Editor, Glossar |
| M2 | Undo-Snackbar (5 s) für Ausblenden/Löschen/Übernehmen | UX H4 | ☐ |
| M3 | Formular-Verwerfen-Guard bei befülltem Formular | UX H5 | ☐ |
| M4 | Tastatur/Screenreader-Grundpass (role/tabindex/Enter auf Listen, `:focus-visible`, aria-live für Toasts) | UX K3/M7/M8 | ☐ |
| M5 | Verwaltungs-Gliederung + Einstellungs-Suche | UX M1 / QM §4B | ☑ (2026-07-17) 3 Themenblöcke + Suchfeld; Prüf-Workflow einklappbar |
| M6 | `baseRev` → echte 409-Konflikterkennung (oder Feld entfernen) | System-Audit T2 | ☐ |
| M7 | Admin-Rendering aus `features/backup.js` nach `ui/admin.js` verschieben | System-Audit T1 | ☐ |
| M8 | Journal light (wer/wann je Änderung) + Aufräumen erledigter Vorschläge | QA V10 / QM §1E | ☐ |
| M9 | Combobox-Baustein mit „＋ Hinzufügen" (Status, Gruppen, Lagerorte, …) | QM §7 | ☑ (2026-07-18) UK-Select mit „＋ Neue…", Datalists Lagerort/Gruppe |
| M10 | Mengen-Hervorhebung automatisch bei ≠1x (mit Übersteuerung) | QM §9 | ☑ (2026-07-18) |
| M11 | Bedingungs-Kennzeichen „⚡ nur wenn: …" + Erkennungs-Assistent | QM §10 | ☐ |
| M12 | Norm-Farbprofile Material (nach E2/E3) | QM §5 | ✋ E2/E3 |

## NIEDRIG / SPÄTER

| # | Maßnahme | Quelle | Status |
|---|---|---|---|
| N1 | Namens-Zerlegung (Klammern → Badge; „für/oder") mit Bestands-Vorschau, je Regel einzeln | QM §11 | ☐ |
| N2 | Standard-Anlage-Assistent (Vorlage/Häufigkeit/Katalog) | QM §12 | ☐ |
| N3 | Zusatzfelder am Eintrag (Vorstufe Abfrage-Builder) | QM §6C | ☑ (2026-07-18) „🧩 Eigene Felder" im Schnellmenü (Regel `zusatz`) |
| N4 | Serienpflege-Flow („Speichern & nächstes offene Material") | UX §5 | ☐ |
| N5 | Onboarding-Coachmarks (3 Stück, einmalig) | UX Roadmap | ☐ |
| N6 | Speicherpfad-Migration `overrides`/`reassign` → QE-Overlay | QM §2 | ☐ |
| N7 | Visionär: Steril-Sprachmodus, QR am Regal, Wandmonitor-Board | UX Roadmap | ☐ |
| N8 | Etikett-Scanner **Phase 2**: Texterkennung von REF/Hersteller/Maßen — **erledigt als On-Device-OCR** (Betreiber-Entscheidung); Cloud-Vision bewusst NICHT umgesetzt | Scanner | ☑ (2026-07-17) |

## Erledigt

| Datum | Maßnahme | Quelle |
|---|---|---|
| 2026-07-18 | **Souveränitäts-Paket (überall anpassen, hinzufügen, verschieben):** (B) **📦 Verschieben** im Schnellmenü — eigene Einträge werden echt in andere Rubrik/anderen Standard umgehängt (additions/NEW), Basis-Einträge als Kopie mit den effektiven Werten am Ziel + Original journaliert ausgeblendet (rücknehmbar über Ausgeblendete Einträge/Journal) · (D) **🧩 Eigene Felder** am Eintrag (N3): beliebige Zusatz-Infos als Badge, gespeichert als Regel `zusatz` → Reichweiten-Wahl, Journal, „Warum so?", Geräte-Sync · (C) **„＋ Neu…" in Auswahlmenüs** (M9): UK-Select im Prüf-Workflow mit „＋ Neue Unterkategorie…" (Eingabezeile statt prompt), Datalists für Lagerort und Gruppe (vorhandene wählen ODER frei tippen) · (A) **🧱 Inhalte & Aufbau**-Panel in der Verwaltung: alle Standards → Rubriken zentral durchgehen, „＋ Eintrag" direkt aus dem Panel, „Öffnen" springt in die Ansicht, ＋ Neuer Standard · neue E2E-Suite `souveraen.js` (17 Checks); 199 Unit + 12 E2E grün | Betreiber-Vision Souveränität (Gespräch 2026-07-18) |
| 2026-07-18 | **Bugfix: „Neue Unterkategorie/Kategorie" lautlos wirkungslos (M1) + Kamera-Fehlerdiagnostik:** `window.prompt()` liefert in installierten PWA-Fenstern (`manifest.webmanifest` → `display:"standalone"`) auf manchen Android-Chrome-Versionen **keinen Dialog**, sondern sofort `null` — „＋ Neue Unterkategorie…"/„＋ Neue Kategorie…" (Schnellmenü) und „＋ Neue Kategorie" (Verwaltungs-Panel) schlugen dadurch **ohne jede Fehlermeldung** fehl. Alle drei jetzt auf eigenes Eingabefeld statt `prompt()` umgestellt (Sheet-Screen bzw. Inline-Zeile im Panel), funktioniert nachweislich auch wenn `prompt()` kaputt ist (per Probe erzwungen). — Zusätzlich: Live-Scanner-Kamera zeigte bei JEDEM `getUserMedia`-Fehler dieselbe pauschale Meldung „Kamera nicht freigegeben oder nicht verfügbar" — `camErrorMessage()` unterscheidet jetzt Berechtigung verweigert / keine Kamera / anderweitig belegt / unsicherer Kontext (https) mit je passender Handlungsanweisung; `OverconstrainedError` (z. B. nur eine Kamera vorhanden) versucht automatisch einen Neuversuch ohne `facingMode`-Zwang. **Material-Fotos & OCR-Etikett-Erkennung sind vom Scanner-Problem strukturell unabhängig** (natives `<input type=file capture>` statt `getUserMedia`/`BarcodeDetector`) — per Probe bestätigt. +9 Unit-Tests, 4 neue Browser-Proben, 199 Unit + 11 E2E grün. | Nutzer-Rückmeldung (Kamera-Fehler, Unterkategorie nicht anlegbar) |
| 2026-07-18 | **M10 Mengen-Hervorhebung automatisch bei ≠1x:** `mengeHiEff(e,cid,mengeEff)` — automatisch hervorgehoben, wenn die Menge gesetzt UND ≠„1x" ist (fehlende Menge bleibt ausgeschlossen); manuelles 🔢-Umschalten im Schnellmenü ist jetzt eine **Übersteuerung** (schreibt explizit an/aus, gewinnt immer gegen die Automatik) statt eines reinen Ein/Aus-Schalters ohne Grundzustand. Betrifft Eintragskarten (`.mbox.hi`) und das Bearbeiten-Menü-Label. +5 Unit-Tests (`mengeHiAuto`) + Live-Beweis (Screenshot: 2x hervorgehoben, 1x neutral). War seit dem QM-Brainstorming offen (M10, ☐) — jetzt nachgeholt. | Nutzer-Rückmeldung („Hervorhebung fehlt") |
| 2026-07-18 | **Verwaltungs-Menü verständlicher (klar „was es ändert"):** einheitliche Panel-Kopfzeile `vsum()` — Symbol · Titel · **Klartext-Beschreibung der Wirkung** · Status-Badge · Aufklapp-Pfeil — statt uneinheitlicher Kurz-Hinweise (mal Beschreibung, mal nackte Zahl). Jargon entschärft („Kategorien (Naturen)" → **Kategorien**), doppelte Symbole entkoppelt (🏷️ Kategorien · 🗂 Unterkategorien · 📚 Gruppen & Symbole · 🎨 Design · 👁 Anzeige), Badges vereinheitlicht (z. B. „6/6 an", „223 offen", „27 Gruppen", Gesamt-€). Rubriken-Vorlagen jetzt suchbar (data-keys). +2 E2E-Checks (jedes Panel hat Titel+Beschreibung, Symbole eindeutig). | Nutzer-Feedback (Menü unklar) / H7 |
| 2026-07-18 | **Bugfix Verwaltungspolitik (Fehlerdiagnostik nach EIN-Schreibweg):** Zwei Lese-Pfade übersahen Regel-Änderungen und lasen weiter die Alt-Speicher. (1) **Ausblenden** über das Schnellmenü (Regel `hidden`) fehlte im Panel „Ausgeblendete Einträge" und war dort nicht wiederherstellbar — obwohl der Bestätigungsdialog es verspricht → `collectHidden`/`restoreCid`/`restoreMat` regel-bewusst (📍 Stelle→byCid, 🌐 alle→byMat, Rücknahme = revoke). (2) **Kategorie-Korrektur** über „Einstufung prüfen" (`setNatur` schreibt Regel) zählte nicht mehr als „korrigiert/erledigt" (Badge, Fortschritt, Offen/Erledigt-Filter) → neuer Helfer `hasStelleRule`/`naturKorrigiert` in `isHandled`/`isOv`/`collectUncertain`/`hasEdit`. Live-Backend-Funktionstest (alle Endpunkte + Fehler-/Sicherheitspfade) + neue Regressionssuite `rules-hidden.js`; 191 Unit + 11 E2E grün. | Funktions-/Backend-Test + Bug-Hunt |
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
| 2026-07-17 | **Bearbeiten-Menü gegliedert (QM §3, H6):** flache 15er-Liste → vier Fächer *Inhalt · Darstellung · Organisation · Gefahrenzone*; **Standard-Titel & Rubrik-Kopf** nutzen jetzt dasselbe gegliederte Menü (⋯/✎), verstreute Admin-Buttons gebündelt; E2E-Checks | Menü-Ordnung zuerst |
| 2026-07-18 | **Verwaltungspolitik Stufen 2–3 + Governance (E6):** EIN Kaskaden-Resolver `ruleResolve`/`ruleCandidates` (Regeln JEDER Reichweite + Alt-Speicher als Rand, verbindliche Ordnung 📍>📄>🗂>🌐, dann neuer) ersetzt die Spezial-Resolver in qeGet/effNatur/rawUk (rückwärtskompatibel) · **EIN Schreibweg**: Schnellmenü **und** „Einstufung prüfen" schreiben Regeln (auch 📍/🌐), Alt-Werte werden beim Schreiben **migriert** (`clearLegacyAt`, Lazy-Migration) · Reset nimmt nur die Stelle-Regeln zurück · Governance: weite Reichweiten (Gruppe/alle) mit Trefferzahl-Bestätigung · Inspektor nutzt denselben Resolver (Gewinner korrekt) · +14-Check-E2E `rules-migration.js`; alle 10 E2E-Suiten grün | E6 Stufen 2–3 |
| 2026-07-18 | **Verwaltungspolitik Stufe 1 (E6):** Regel-Journal `hkl_rules` (append-only, geteilt + Backup, Sync als **Vereinigung** statt Überschreiben) · EIN Kaskaden-Vorschalter in qeGet/effNatur/rawUk (📍 > 📄 > 🗂 > 🌐) · Reichweiten-Dialog mit **Treffervorschau** an jeder Option („betrifft N× in M Standards") · **Sammel-Änderung über Standard/Gruppe** mit Bestätigung + Ein-Klick-Rücknahme · Inspektor **„🔍 Warum so?"** (Kaskade je Eigenschaft, Gewinner/überstimmt, Regel-Rücknahme) · Verwaltungs-Panel **🧾 Regeln & Journal** · 3 Unit-Tests + E2E-Suite `rules.js` (17 Checks, inkl. Gruppen-Wirkung über Standards + Gerät B) | E6 / Konzept v2 |
| 2026-07-17 | **Lange-Tippen überall + Wirkungs-Chips (QM §1/§3):** Halten öffnet das gegliederte Bearbeiten-Menü auf JEDER Ebene — Standard-Übersicht, Rubriken-Liste, Einträge (generischer `attachHoldNav`, Tippen=öffnen/Halten=Menü); Wirkungs-Chips (📄/🗂/📍 · 👥 alle Geräte) + ehrliche „Ändert…"-Untertitel in den Menüs; echte Maus-Halte-E2E-Checks | Option 2 + „durch langes Tippen überall" |
| 2026-07-17 | **Verwaltung gegliedert & durchsuchbar (QM §4B, M5):** ~11 Panels in 3 Themenblöcke (*Inhalte pflegen · Aussehen & Anzeige · Daten & Sicherung*); Einstellungs-Suchfeld (Titel+Synonyme, blendet leere Blöcke aus); großer „Einstufung prüfen"-Block jetzt einklappbares Panel; E2E-Checks | Menü-Ordnung zuerst |
| 2026-07-17 | **Etikett-Scanner Phase 2 — On-Device-OCR:** Foto → REF/Hersteller/Maße per Tesseract.js (WASM, selbst gehostet unter `public/vendor/tesseract/`, ~6 MB, lazy, offline); `extractLabelFields` rein/testbar; füllt nur leere Felder; CSP `wasm-unsafe-eval`+`worker-src blob:`; Server-MIME `.wasm`/`.gz`; 4 Unit-Tests + E2E `ocr.js` (echte Engine liest echten Text) | Betreiber-Entscheidung: On-Device statt Cloud |
