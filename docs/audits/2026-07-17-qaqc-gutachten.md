# QA/QC-Gutachten: HKL-SOP-KKS — Unabhängige Qualitätsprüfung des Gesamtprojekts inkl. Gegenprüfung der bisherigen Audits

| | |
|---|---|
| **Erstellt** | 2026-07-17, 03:57 UTC |
| **Geprüfter Stand** | Branch `claude/github-oauth-connect-ljdxp2`, Commit `029602c` (PR #2) |
| **Was dieses Gutachten abbildet** | Unabhängige QA/QC-Prüfung nach ISO-9001-/FMEA-/Peer-Review-Denkweise über: (1) das Produkt (App, Server, Betrieb), (2) **die bisherige Prüf- und Umsetzungsarbeit selbst** — System-Audit, QM-Konzept, UX-Audit, PR-#2-Fixes — auf fachliche Fehler, Widersprüche, unbewiesene Annahmen und Lücken, (3) bislang unbeleuchtete Dimensionen: Wirtschaftlichkeit, Recht/Datenschutz, Betrieb/Backup, regulatorische Grenzen |
| **Methode** | Gegenprüfung durch **eigene Tests statt Vertrauen**: Restore-Drill der Server-Backups (durchgeführt), Quota-Fehler-Simulation im Browser (durchgeführt), Widerspruchsanalyse der drei Berichte, Betriebs-/Konfigurationsprüfung, FMEA. Vermutungen sind ausdrücklich als solche gekennzeichnet |
| **Prüfer-Unabhängigkeit (Einschränkung, offen benannt)** | Gutachter = Ersteller der Vorarbeiten. Kompensation: aktive Suche nach eigenen Fehlern (§4.B dokumentiert zwei gefundene), ausschließlich nachprüfbare Belege, keine Gefälligkeitswerte. Eine externe Zweitprüfung ersetzt das nicht — Empfehlung in §9 |

---

## 1. Zielverständnis

Das Projekt will: klinische Standards (HKL/SOP/KKS) am Behandlungsort **zuverlässig abrufbar, abhakbar und vom Team selbst pflegbar** machen — offline-fähig, geräteübergreifend synchron, ohne laufende Lizenzkosten, langfristig **ohne externe Entwickler wartbar**. Die jüngste Arbeit (Audits + Fixes) soll Qualität, Sicherheit und Bedienbarkeit systematisch heben. *Unklar bleibt (→ §11): gewollte öffentliche Erreichbarkeit, Gerätezahl, Zertifizierungskontext der Klinik.*

## 2. Zusammenfassung

Das Produkt ist **technisch überdurchschnittlich solide** für seine Klasse (Tests gegen echten Server, Backups, Offline-Robustheit — Restore jetzt erstmals **praktisch verifiziert** ✓). Die bisherigen Berichte sind methodisch überwiegend sauber, aber nicht fehlerfrei: die Gegenprüfung fand **einen ernsten technischen Befund, den das System-Audit übersehen hat** (stiller Sofort-Datenverlust bei vollem Gerätespeicher — im Browser nachgestellt), **einen Bewertungswiderspruch** zwischen zwei Berichten und **drei strukturelle Lücken** (Datenpipeline undokumentiert, Prüf-Skripte nicht versioniert, drei konkurrierende Roadmaps ohne führenden Maßnahmenplan). Wirtschaftlich ist die Lösung klar vorteilhaft; rechtlich besteht **Handlungsbedarf beim Datenschutz** (Mitarbeiternamen über offenen Endpunkt). Die wichtigste offene Betriebsentscheidung bleibt der API-Schreibschutz (S1 aus dem System-Audit) — sie wird hier bekräftigt und um die Datenschutz-Dimension verschärft.

## 3. Positive Aspekte (belegt, nicht behauptet)

1. **Backup-Wiederherstellung funktioniert** — Drill durchgeführt: Snapshot über `state.json` kopiert, Neustart, Altstand korrekt zurück (`rev:1`, Inhalt intakt). Damit sind die Backups erstmals *verifiziert*, nicht nur vorhanden.
2. **Testfundament real:** 162 Tests laufen gegen den echten HTTP-Server bzw. echten Quelltext; CI blockiert Fehler vor Deploy; `npm run check` fängt die zwei klassischen „unsichtbaren" Fehlerklassen.
3. **Die PR-#2-Fixes halten der Nachprüfung stand:** 413-Kette, OAuth-Härtung, SW-Bypass, Apostroph-Härtetest, Foto-Verkleinerung — jeweils mit reproduzierbaren Browser-Tests belegt; keine Regression gefunden.
4. **Ehrlichkeit der Doku** (bekannte Altlasten mit Begründung dokumentiert) — QM-technisch der wichtigste Kulturfaktor des Projekts.
5. **Wirtschaftlich schlank by design:** null Lizenz-/Abo-Kosten, ein Mini-Container auf vorhandenem Host, Energie-/Wartungskosten vernachlässigbar (≈ Grundlast eines einzelnen Node-Prozesses; Annahme: <5 W Anteil).

## 4. Gefundene Probleme

### A) Neue technische Befunde (im Produkt, von den Vor-Audits übersehen)

**P1 — Stiller Sofort-Datenverlust bei vollem localStorage (VERIFIZIERT, ernst).**
Simulation: `setItem` wirft Quota-Fehler → `store.set` schluckt ihn, **keine Warnung**, und `store.get` liest weiter aus localStorage → die Eingabe ist **sofort weg** (nicht erst beim Reload); der nächste Sync pusht sogar den *alten* Wert. Eintrittswahrscheinlichkeit steigt mit Foto-Nutzung (Quota typ. ~5 MB; die neue Verkleinerung ≈ 100–300 KB/Foto ⇒ Grenze bei grob 20–40 Fotos + Altbestand unverkleinert!). *Ursache (5 Why): Fallback wurde für „localStorage von Anfang an gesperrt" gebaut, nicht für „läuft im Betrieb voll"; der Lesepfad kennt den Schreib-Fallback nicht.* → Fix-Skizze: Quota-Fehler erkennen → Nutzer-Warnung + `mem`-Fallback auch im Lesepfad + Foto-Altbestand nachverkleinern. Aufwand klein–mittel. **Priorität: HOCH.**

**P2 — Wurzelursache der Apostroph-Klasse besteht fort.** PR #2/Audit fixte 6 Fundstellen, aber `esc()` escaped weiterhin kein `'` — jeder künftige Entwickler kann den Fehler reproduzieren. Root-Fix (eine Zeile: `'`→`&#39;`) ist risikoarm (HTML-Text und Attribute bleiben korrekt) + Regel bleibt dokumentiert. Aufwand: minimal + Testlauf. **Priorität: MITTEL-HOCH.**

**P3 — Backups liegen im selben Docker-Volume wie die Primärdaten.** Host-/Volume-Verlust = Totalverlust inkl. aller Snapshots. Kein Offsite-/Host-Backup dokumentiert. → Empfehlung: täglicher Host-Cronjob (`docker run --rm -v hkl-state:… tar → /backup/…` oder rsync auf Zweitziel) + Wiederherstellungsanleitung in CONTRIBUTING. Aufwand: 1–2 h. **Priorität: HOCH.**

**P4 — Container-Logs unbegrenzt.** `docker-compose.yml` setzt kein `logging.options.max-size` → json-file-Log wächst unbeschränkt (Platten-Risiko auf dem Shared Host). Fix: 3 Zeilen Compose. **Priorität: MITTEL.**

**P5 — Persistenz ohne `fsync`.** `writeFile`+`rename` ist atomar gegen Teil-Schreiben, aber bei Stromausfall kann das Rename ungeflusht verloren gehen. Bei Snapshot-Netz + Klinik-USV akzeptabel; ein `fh.sync()` wäre korrekt. **Priorität: NIEDRIG.**

**P6 — Die Quelldaten-Pipeline ist nicht im Repo.** `hkl_standards_export.json` (Basis von allem) entstand aus Word-Dokumenten — das Erzeugungswerkzeug/-verfahren ist nirgends versioniert oder beschrieben. Ändern sich die Quell-SOPs, ist der Weg zur Regeneration unklar (Bus-Faktor der *Daten*, nicht des Codes). → Mindestens: Herkunft + Schritt-für-Schritt in `docs/` dokumentieren; ideal: Konverter-Skript einchecken. **Priorität: HOCH (Vollständigkeit).**

**P7 — Verifikations-Skripte sind flüchtig.** Alle Playwright-Nachweise (Zwei-Geräte-Sync, 413, Apostroph, Foto, UX-Messung) liegen im Session-Scratchpad, nicht im Repo → Beweise nicht reproduzierbar, Regressionsschutz verschenkt. → `test/e2e/`-Ordner + README („optional, braucht Chromium"), bewusst außerhalb des CI-Pflichtlaufs. **Priorität: MITTEL-HOCH.**

**P8 — Unbegrenztes Wachstum von `hkl_suggestions`/Journal-losen Overlays.** Erledigte Vorschläge sammeln sich (nur manuelles Löschen); QEdits ohne Zeit-/Autor-Stempel erschweren spätere Aufräum-/Nachvollzieharbeit. **Priorität: NIEDRIG-MITTEL.**

### B) Befunde an der bisherigen Prüf-/Berichtsarbeit (Selbst-Gegenprüfung)

**Q1 — Bewertungswiderspruch zwischen den Berichten.** System-Audit: „Benutzerfreundlichkeit **76/100**"; UX-Audit (einen Tag später, empirisch): „Gesamt-UX **5/10**". Beide können nicht gleichzeitig als Gesamtaussage stimmen. *Ursache: Das System-Audit bewertete UX aus Code-Lektüre (Feature-Vorhandensein), das UX-Audit maß Auffindbarkeit/Zugänglichkeit.* Konsequenz: Die 76 ist **zurückzunehmen**; maßgeblich ist der empirische Wert. Lehre (dokumentiert): UX-Zahlen nur noch mit Messgrundlage.

**Q2 — Drei parallele Roadmaps ohne führende Liste.** System-Audit, QM-Konzept und UX-Audit enthalten je eigene Priorisierungen mit Überschneidungen (z. B. Kontextmenü in QM §3 = UX-Punkt 10; Wirkungs-Chips in QM §1 = UX H6). Ohne konsolidierten Maßnahmen-Backlog drohen Doppelarbeit und Prioritäten-Drift. → **Ein** führendes Dokument `docs/MASSNAHMEN.md` (Single Source of Truth), die Berichte verweisen nur noch. **Priorität: HOCH (Prozess).**

**Q3 — Alle UX-Aussagen sind Expertenprüfung, kein Nutzertest.** Heuristik + Messung finden nachweislich andere Fehlerklassen als echte Anwenderbeobachtung (NN/g). Für ein Werkzeug im Klinikalltag: **3–5 kurze beobachtete Aufgaben-Tests mit echten Kolleginnen** (je 15 min: „Finde X", „Schlage eine Änderung vor", „Setze einen Lagerort") vor größeren UI-Umbauten. Kosten ≈ 2 h Teamzeit, Nutzen: Priorisierung wird evidenzbasiert. **Priorität: HOCH, vor Phase-2-Umbauten.**

**Q4 — Kleinere Unschärfen in den Vorberichten** (korrigierend festgehalten): (a) QM-Konzept §13 nennt den ✎-Stift als vorhandenen sichtbaren Einstieg — er existiert **nur im Admin-Modus** (UX-Audit hat es später korrekt gemessen); (b) die Schleusen-Farbtabelle ist Konvention ohne zitierfähige Norm — sie darf erst nach dokumentiertem Abgleich mit dem Hausbestand aktiv werden (im Konzept korrekt als Leitplanke vermerkt, hier als *Pflichtschritt mit Verantwortlichem* verschärft); (c) System-Audit-Scores tragen keine Gewichtungsmethodik — sie sind Experteneinschätzung, nicht Messung (gilt auch für dieses Gutachten, §10).

### C) Recht / Datenschutz / Regulatorik (bisher unbeleuchtet)

**R1 — DSGVO: Personenbezogene Daten über offenen Endpunkt (ernst).** `hkl_suggestions` speichert Klarnamen (`by`, `resolvedBy` — GitHub-Name), erreichbar für jedermann via öffentlichem `GET /api/state`. Das ist eine **Offenlegung von Mitarbeiterdaten ohne Rechtsgrundlage/Information**. Zusammen mit S1 (Schreibzugriff) wird die API-Absicherung damit auch **rechtlich** geboten, nicht nur technisch. Zusätzlich fehlen: Datenschutzhinweis in der App (welche Daten, wo gespeichert, GitHub-Login-Datenfluss), AVV-Betrachtung Hosting. *Vermutung (prüfen): keine Patientendaten im System — Fotos zeigen Material; eine kurze Team-Anweisung „keine Personen/Patientendaten fotografieren" sollte das absichern.* **Priorität: HOCH, mit S1 zusammen lösen.**

**R2 — MDR-Abgrenzung (vorausschauend, aktuell unkritisch).** Heute: Organisations-/Dokumentationswerkzeug → kein Medizinprodukt (Annahme, plausibel). Die Roadmap-Ideen „bedingtes Material mit Kriterien-Schaltern" und „Abfrage-Builder" nähern sich der Grenze, **wenn** daraus je Handlungs-/Therapieempfehlungen pro Patient würden. Leitplanke schriftlich fixieren: App organisiert Material & Abläufe, gibt **keine** patientenindividuellen klinischen Empfehlungen. **Priorität: MITTEL (Doku-Satz jetzt, Prüfung je Feature).**

**R3 — ISO-9001-Dokumentenlenkung (falls Klinik zertifiziert — offene Frage).** Versions-/Freigabe-Metadaten existieren, sind aber informativ, nicht gelenkt (jeder Admin ändert freigegebene Standards ohne Workflow/Historie). Falls die SOPs QM-gelenkte Dokumente sind: kleiner Freigabe-Workflow (Entwurf→Prüfung→Freigabe mit Journal) wäre nötig; sonst Kennzeichnung „Arbeitshilfe, ersetzt nicht das gelenkte Dokument". **Priorität: abhängig von §11-Antwort.**

### D) Wirtschaftlichkeit

**W1 — Betriebskosten ≈ 0, Alternativen teurer:** SaaS-Checklisten/DMS: wiederkehrend €€, Datenschutz-Auslandsfragen, Anpassbarkeit ↓. Eigenlösung ist hier klar wirtschaftlich — **unter der Bedingung**, dass der Bus-Faktor adressiert bleibt (Doku ✓, aber: genau **eine** Person versteht das System heute tief; →Q3/§9: zweite interne Person einarbeiten, CONTRIBUTING-Walkthrough gemeinsam einmal durchspielen). Lebensdauer-Risiken klein (Node LTS, Browser-Standards); einzige echte Abhängigkeit: GitHub (CI/GHCR/OAuth) — Ausfall = kein Deploy, App läuft weiter ✓.

## 5. Risiken (FMEA-Kurzform; S=Schwere, A=Auftreten, E=Entdeckung, je 1–10; RPZ=S·A·E)

| Fehlermodus | Folge | S | A | E | RPZ | Gegenmaßnahme |
|---|---|---|---|---|---|---|
| Fremder überschreibt State (offene API) | Datenverlust/Manipulation, Vertrauensbruch | 8 | 4 | 6 | **192** | S1-Entscheidung + Restore-Prozess (verifiziert ✓) |
| Mitarbeiternamen öffentlich lesbar | DSGVO-Verstoß, Meldepflicht-Risiko | 7 | 6 | 4 | **168** | R1: API-Auth, Namen pseudonymisieren |
| localStorage-Quota voll (Fotos) | stiller Verlust einzelner Eingaben | 6 | 4 | 7 | **168** | P1-Fix + Altfotos nachverkleinern |
| Host-/Volume-Ausfall | Totalverlust inkl. Backups | 9 | 2 | 8 | 144 | P3: Offsite-Kopie täglich |
| Freigegebener Standard fehlerhaft geändert | falsches Material im Eingriff vorbereitet | 9 | 2 | 6 | 108 | Journal + (falls R3 zutrifft) Freigabe-Workflow; menschliche Endkontrolle bleibt Prozess |
| Quelldaten müssen neu erzeugt werden | Stillstand der Inhaltspflege | 6 | 3 | 6 | 108 | P6: Pipeline dokumentieren/einchecken |
| Log-Wachstum füllt Host-Platte | Ausfall aller Container des Hosts | 7 | 3 | 5 | 105 | P4: max-size |
| Einziger Wissensträger fällt aus | Wartung stockt | 6 | 3 | 5 | 90 | Zweitperson + Walkthrough |

## 6. Verbesserungsvorschläge (konkret, mit Abwägung)

| # | Maßnahme | Begründung | Vorteil | Nachteil/Kosten | Aufwand | Priorität |
|---|---|---|---|---|---|---|
| V1 | **S1+R1 gemeinsam:** Schreib- (und idealerweise Lese-)Schutz auf `/api/state`; Empfehlung: signierte GitHub-Session für PUT, GET ohne Session ohne Personennamen (Feld-Filter) | schließt größtes Sicherheits- **und** Rechtsrisiko | RPZ 192+168 ↓ | Geräte müssen sich einmalig anmelden; Betriebsentscheidung nötig | ~0,5–1 Tag | **SOFORT (Entscheidung), dann HOCH** |
| V2 | Quota-Schutz (P1): Warnung + konsistenter mem-Fallback + Migrations-Job „Altfotos verkleinern" | verifizierter stiller Datenverlust | Datensicherheit am Gerät | – | ~0,5 Tag | **HOCH** |
| V3 | Offsite-Backup + vierteljährlicher Restore-Drill als 5-Zeilen-Anleitung (P3) | Backups ohne Zweitstandort sichern nur gegen Software-Fehler | Katastrophenfestigkeit | minimaler Host-Cron | 1–2 h | **HOCH** |
| V4 | `docs/MASSNAHMEN.md` als führender konsolidierter Backlog (Q2), speist sich aus allen 4 Berichten | verhindert Prioritäten-Drift | eine Wahrheit | Pflegedisziplin | 1–2 h | **HOCH** |
| V5 | Datenpipeline dokumentieren/einchecken (P6) | Daten-Bus-Faktor | Reproduzierbarkeit | evtl. Aufräumen des Alt-Skripts | 0,5–1 Tag | **HOCH** |
| V6 | 3–5 beobachtete Nutzertests vor Phase-2-UI-Umbau (Q3) | Expertenprüfung ≠ Nutzerrealität | evidenzbasierte Prioritäten | 2 h Teamzeit | gering | **HOCH** |
| V7 | E2E-Smokes ins Repo (`test/e2e/`, optional ausführbar) (P7) | Beweissicherung, Regressionsschutz | dauerhafte Verifizierbarkeit | Chromium-Voraussetzung dokumentieren | 0,5 Tag | MITTEL-HOCH |
| V8 | `esc()` escaped `'` (P2) + Kommentar-Update der Altlast | Wurzelursache statt Symptomliste | Fehlerklasse eliminiert | theor. Doppel-Escape-Prüfung (Testlauf deckt ab) | <1 h | MITTEL-HOCH |
| V9 | Compose-Logging begrenzen (P4) | Shared-Host-Hygiene | – | – | 15 min | MITTEL |
| V10 | Journal light (wer/wann je Änderung; knüpft an QM §1E) + Vorschlags-Aufräumen (P8) | Nachvollziehbarkeit, R3-Vorstufe | QM-Nutzen | neuer Shared-Key | 1–2 Tage | MITTEL |
| V11 | MDR-/Zweck-Leitplanke als Absatz in README (R2) | billige Prävention | Klarheit für künftige Features | – | 15 min | MITTEL |
| V12 | fsync im Persist-Pfad (P5) | Korrektheit | Stromausfall-Fenster zu | minimal langsamer | 1 h | NIEDRIG |

## 7. Alternativen (geprüft, mit Gegenargumenten)

- **SaaS-/Fertiglösung statt Eigenbau:** wiederkehrende Kosten, Datenschutz-/Standortfragen, Anpassbarkeit und Offline-Verhalten schlechter; Eigenbau ist bereits bezahlt und dokumentiert → **nicht empfehlenswert** (Wechselkosten > Nutzen).
- **Auth im Reverse-Proxy statt in der App** (Basic-Auth auf `/api/`): schnellste S1-Lösung, aber: Geräte-UX (Browser-Basic-Auth-Dialoge), keine Personenbindung, R1-Namensproblem bleibt bei GET bestehen → als **Übergangslösung akzeptabel**, App-Session-Lösung bleibt Ziel.
- **„Nichts tun" bei S1/R1** („interne Nutzung, obskure URL"): Obskurität ist kein Schutz; DSGVO-Risiko bleibt objektiv → **nicht vertretbar**.
- **Großumbau auf Framework/ESM:** löst keine der Top-RPZ-Risiken, zerstört den Zero-Dep-Vorteil und die Tablet-Kompatibilität → **nicht empfehlenswert** (bestätigt Vor-Audits).

## 8. Kosten-/Nutzen-Bewertung

Gesamtaufwand der „Sofort+Hoch"-Liste (V1–V6): **grob 3–4 Arbeitstage** + eine Betriebsentscheidung + 2 h Teamzeit. Dem stehen gegenüber: Beseitigung der drei höchsten RPZ-Risiken (Sicherheit/Recht/Datenverlust), Katastrophenfestigkeit, belastbare Prioritäten. Laufende Kosten unverändert ≈ 0. **Nutzen/Kosten-Verhältnis: außergewöhnlich hoch**, weil die teuersten Risiken billige Fixes haben.

## 9. Prioritätenliste

**Sofort umsetzen:**
1. **Entscheidung S1/R1** (Schutzvariante wählen) → dann V1 umsetzen
2. V2 Quota-Schutz (verifizierter Datenverlust)
3. V3 Offsite-Backup + Restore-Drill-Routine (Drill selbst: hiermit erstmals bestanden ✓)
4. V4 konsolidierter Maßnahmen-Backlog (eine Wahrheit statt drei Roadmaps)
5. V5 Datenpipeline dokumentieren
6. V6 Nutzertests vor UI-Phase 2 · plus: zweite interne Person via CONTRIBUTING-Walkthrough einarbeiten

**Optional (geringere Dringlichkeit):** V7 E2E ins Repo · V8 esc-Rootfix · V9 Log-Limit · V10 Journal light · V11 MDR-Satz · V12 fsync · UX-Quick-Wins laufen unabhängig (bereits separat priorisiert).

**Nicht empfehlenswert:** SaaS-Migration · Framework-/ESM-Umbau · „Sicherheit durch Obskurität" belassen · weitere Parallel-Roadmaps erzeugen.

## 10. Gesamtbewertung (0–10; Experteneinschätzung, Methodik-Grenze aus Q4c gilt auch hier)

| Kategorie | Note | Begründung |
|---|---|---|
| Fachliche Qualität | **8** | Aussagen der Vorarbeiten hielten der Gegenprüfung überwiegend stand; zwei Unschärfen gefunden und korrigiert (Q1, Q4) |
| Technische Qualität | **7** | solide + getestet; P1 (verifiziert), P2, P5 zeigen: gut, nicht fehlerfrei |
| Wirtschaftlichkeit | **8** | ≈0 Betriebskosten, keine sinnvolle günstigere Alternative; Abzug: Bus-Faktor |
| Sicherheit | **4** | unverändert durch offene API bestimmt; jetzt zusätzlich als Rechtsrisiko qualifiziert (R1) |
| Wartbarkeit | **7** | Doku/Tests stark; Abzug: flüchtige E2E-Beweise (P7), Pipeline-Lücke (P6) |
| Zukunftssicherheit | **7** | Zero-Dep-Strategie trägt; MDR-Leitplanke nötig (R2) |
| Benutzerfreundlichkeit | **5** | Übernahme des empirischen UX-Werts; die 76/100 des System-Audits wird hiermit formell revidiert (Q1) |
| Skalierbarkeit | **6** | zweckangemessen; Grenzen (Quota, Blob-Sync) jetzt vollständig kartiert |
| Vollständigkeit | **6** | Produkt ✓, aber: Datenpipeline, Nutzertests, konsolidierter Backlog fehlen |
| **Gesamteindruck** | **7** | überdurchschnittliches kleines System mit klarer, günstig abarbeitbarer Risikoliste |

## 11. Offene Fragen (beeinflussen Bewertung/Prioritäten)

1. Ist die **öffentliche Erreichbarkeit** gewollt (Heim-/Mobilzugriff) oder Nebeneffekt? (→ bestimmt S1-Variante)
2. Wie viele **Geräte/Nutzer** real? (→ Quota-/Sync-Dringlichkeit)
3. Ist die Klinik **ISO-9001-zertifiziert** / sind die SOPs QM-gelenkte Dokumente? (→ R3-Workflow ja/nein)
4. Wer kann **zweite interne Wartungsperson** werden?
5. Existiert das **Konvertierungswerkzeug** Word→JSON noch, und wo? (→ V5-Aufwand)
6. Gibt es eine Team-Regel zu **Foto-Inhalten** (keine Personen/Patientenbezüge)?

## 12. Fazit

Das Projekt ist in einem **guten, ehrlichen Zustand**: Stärken sind real und belegt, die Schwächen sind bekannt, benannt — und überwiegend billig zu beheben. Die Gegenprüfung hat den Wert unabhängiger QA demonstriert: ein ernster stiller Datenverlust-Pfad (P1), ein Bewertungswiderspruch (Q1) und die Rechtsdimension der offenen API (R1) waren in drei vorangegangenen Berichten **nicht** erfasst. Die entscheidende Weichenstellung ist keine technische, sondern eine organisatorische: **S1/R1-Entscheidung treffen, einen führenden Maßnahmen-Backlog etablieren, echte Nutzertests einplanen, eine zweite Person einarbeiten.** Danach ist dieses System nicht nur robust, sondern auch nachweislich beherrscht — im Sinne von ISO 9001: geplant, geprüft, verbessert.

*Methodische Anmerkungen: Alle „verifiziert"-Markierungen beruhen auf in dieser Prüfung ausgeführten Tests (Restore-Drill, Quota-Simulation, Nachrechnung der Vorbefunde). Nicht geprüft werden konnten: reale Nutzerzahlen, Produktiv-State-Inhalt, Klinik-QM-Status — als Annahmen gekennzeichnet. Selbstprüfungs-Bias ist methodisch begrenzt kompensierbar; für S1/R1 wird vor Umsetzung eine kurze externe Zweitmeinung (Datenschutzbeauftragte:r der Klinik) empfohlen.*
