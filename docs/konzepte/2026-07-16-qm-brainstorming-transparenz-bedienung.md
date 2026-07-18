# QM & Brainstorming: Transparenz, Konsolidierung, intuitive Bedienung

| | |
|---|---|
| **Erstellt** | 2026-07-16 (Folgedokument zum System-Audit vom selben Tag) |
| **Status** | **Reines Konzept / Brainstorming — hiervon ist NICHTS umgesetzt.** Dient als Entscheidungsgrundlage und Arbeitsvorrat |
| **Basis** | Nutzerfeedback (Betreiber) vom 2026-07-16 + Code-Analyse auf Stand `18d0acb` |
| **Was dieses Dokument abbildet** | Jeden Feedback-Punkt: Ist-Zustand (am Code belegt) → QM-Bewertung → Lösungsideen mit Abwägung → offene Entscheidungsfragen |

---

## 0. Leitprinzipien (Ziel-Definition für alle folgenden Punkte)

Jede Änderungs-Oberfläche der App muss künftig **vier Fragen sichtbar beantworten**:

1. **WAS** ändere ich? (Klartext, keine Fachbegriffe wie „Overlay"/„Natur")
2. **WO** wirkt es? (nur dieser Eintrag · dieses Material überall · diese Rubrik · dieser Standard · ganze App)
3. **WER** sieht es? (alle Geräte/Kolleginnen · nur dieses Gerät)
4. **Wie mache ich es RÜCKGÄNGIG?**

**QM-Leitplanken (Medizinkontext, nicht verhandelbar):**
- Automatik-Erkennungen (Farben, Hervorhebungen, Namens-Zerlegung) ändern **nie stillschweigend klinische Bedeutung**: Original-Text bleibt immer abrufbar, jede Automatik ist pro Eintrag übersteuerbar und global abschaltbar.
- **Farbe ist nie alleiniger Informationsträger** (Farbfehlsichtigkeit, WCAG): immer Farbe + Text/Symbol/Muster.
- Norm-/Konventionstabellen (z. B. Schleusenfarben) werden **vor klinischem Einsatz gegen den Hausbestand geprüft** und sind als „Konvention, keine Garantie" gekennzeichnet.

---

## 1. Transparenz: „Was ändert diese Einstellung wo?"

**Dein Punkt:** Im Verwaltungsmodus ist nicht ersichtlich, was eine Einstellung wo im Standard wie verändert.

**Ist-Zustand (Code):** Einstellungen wirken auf sehr unterschiedlichen Ebenen, ohne dass die UI das sagt — Beispiele: „Anzeige-Einstellungen" (global, alle Geräte), Kategorie-Farbe (global), Eintrag umbenennen (Scope-Abfrage „Nur hier / Überall" existiert nur im Schnellmenü), „Einstufung prüfen" (pro Eintrag), Design (global). Die Scope-Frage „📍 Nur hier / 🌐 Überall" ist der **einzige** Ort, der Wirkungsbereich heute explizit macht.

**Lösungsideen:**
- **A. Wirkungs-Chips (Kern-Idee, überall gleich):** Jede Einstellung/Aktion trägt einen kleinen farbigen Chip: `📍 Eintrag` · `🧩 Material überall` · `🗂 Rubrik` · `📄 Standard` · `🌐 App` plus `👥 alle Geräte` / `📱 nur dieses Gerät`. Einmal gelernt, überall verstanden. Legende einmal oben in der Verwaltung.
- **B. „Ändert…"-Untertitel:** Jede Aktionszeile bekommt einen Ein-Satz-Untertitel in Alltagssprache: *„Ändert den angezeigten Namen dieses Eintrags — Kolleginnen sehen die Änderung sofort."*
- **C. Live-Vorschau:** Bei Design/Farben/Anzeige-Schaltern zeigt ein Mini-Beispiel-Eintrag im Panel direkt, wie es aussehen wird (Render-Funktionen existieren, wiederverwendbar).
- **D. „Wo wirkt das?"-Aufklapper:** z. B. bei Rubrik-Vorlagen: „gilt aktuell in 7 Standards: …" (Daten dafür sind vorhanden: `rubTplMatches` über alle Standards).
- **E. Änderungs-Journal** (verknüpft mit Audit-Finding F1): Verwaltung zeigt „Letzte Änderungen" (was, wo, wann, von wem — GitHub-Name falls angemeldet, sonst Gerät). Schafft Vertrauen und Nachvollziehbarkeit; QM-relevant.

**Aufwand:** A+B sind reine UI-Texte/Chips (überschaubar, kein Datenmodell). C mittel. E braucht neuen Shared-Key (z. B. `hkl_journal`, gedeckelt auf letzte ~200 Einträge).
**Priorität-Vorschlag: HOCH — das ist das Fundament für alles Weitere.**

---

## 2. Konsolidierung: „Es scheint alles doppelt zu geben"

**Befund bestätigt.** Die Prüfung am Code zeigt: dieselben fachlichen Konzepte existieren mehrfach — als Bedienwege UND als Speicherpfade:

| Konzept | Wege heute (belegt) | Speicherpfade | Bewertung |
|---|---|---|---|
| **Kategorie ändern** | Schnellmenü → „Kategorie" · Verwaltung → „Einstufung prüfen" | `overrides[cid]` **und** `QE.mat[key].natur` — Auflösung 4-stufig (`effNatur`) | Zusammenführen: EIN Dialog, EIN Speicherweg mit Scope |
| **Unterkategorie ändern** | Schnellmenü → „UK" · Verwaltung → Dropdown | `reassign[cid]` **und** `QE.mat[key].uk` + `ukMap` (Umbenennung) = 3 Schichten | dito |
| **Umbenennen** | „Schnell umbenennen" · „Details bearbeiten" · Vorschlag übernehmen | einheitlich `QE…name` ✓ | Bedienwege reduzieren: „Schnell umbenennen" streichen, „Details" reicht |
| **Neue Kategorie anlegen** | Verwaltung `addNat()` · Schnellmenü `sheetNewNatur()` | gleiche Daten, **duplizierter Code** | Eine Funktion, zwei Aufrufer |
| **Ausblenden** | Eintrag (2 Scopes) · Rubrik · Standard | 4 Ablagen (`QE.cid/QE.mat/RUBE/STDE .hidden`) | Ablagen ok (je Ebene), aber **eine** gemeinsame „Papierkorb"-Ansicht existiert schon → Bedienlogik vereinheitlichen |
| **Symbole (Icons)** | Rubrik-Symbole · Kategorie-Symbole · UK-Symbole | `RUBICON` · `NATCFG.icon` · `ukMeta.icon` = 3 Systeme | Ein „Symbol ändern"-Dialogmuster für alle drei |
| **Farben** | Akzent · Größen-Badge · Kategorie · UK · Eintrag · Hinweis | 6 Konfigurationen | Ein Farbwähler-Baustein; Panel „Farben" bündelt alle mit Wirkungs-Chip |
| **Suche** | Startseiten-Suche · Standard-Suche · globale Suche · Glossar-Suche | 3 Implementierungen + Filterzeilen | Ein Suchfeld-Baustein; siehe Punkt 4 |
| **Hervorheben** | ⭐ wichtig · 🔢 Zahl · 🎨 Farbe | 3 Mechanismen im Schnellmenü | Zu EINEM Punkt „Hervorheben…" bündeln (Untermenü) |

**Konsolidierungs-Prinzip (Vorschlag):** *Ein Konzept = ein Dialog = ein Speicherweg (mit Scope-Parameter).* Konkret: `overrides` und `reassign` mittelfristig in das QE-Overlay-Modell überführen (`qeSet('cid'|'mat', …, 'natur'|'uk', …)`) — **mit Datenmigration** beim Laden (alte Schlüssel einlesen, umschreiben, danach leeren). Risiko klein, weil `effNatur`/`rawUk` die einzigen Leser sind.

**Priorität-Vorschlag: HOCH (Bedienwege bündeln = Punkt 3), MITTEL (Speicherpfade migrieren).**

---

## 3. Kontextsensitives Bearbeiten-Menü

**Dein Punkt:** Das Bearbeiten-Menü soll sich passend zum angetippten Element öffnen — nur Sinnvolles, transparent.

**Ist-Zustand:** Long-Press öffnet für *jeden* Eintrag dasselbe 15-Punkte-Menü (`renderSheetMain`), egal ob Material, Hinweis-Text oder Fließtext; Rubriken/Standards haben stattdessen verstreute Einzel-Buttons im Admin-Banner.

**Lösungsidee — Aktions-Matrix (nur Sinnvolles je Elementtyp):**

| Element | Inhalt | Darstellung | Organisation | Gefahrenzone |
|---|---|---|---|---|
| **Material/Gerät** | Name · Menge · Größen · Spezifikation · Warum · Synonyme | Hervorheben (⭐/🔢/🎨 gebündelt) | Kategorie · Untergruppe · Reihenfolge · → Katalog | Ausblenden/Löschen · Zurücksetzen |
| **Medikament/Hinweis-Eintrag** | Name · Warum | Hervorheben | Kategorie · Reihenfolge | dito |
| **Überschrift** | Text | — | Reihenfolge | Ausblenden |
| **Rubrik** (Kopf antippen) | Name · Symbol | — | Reihenfolge · Geltungsbereich (Vorlage) | Ausblenden · Häkchen zurücksetzen |
| **Standard** (Titelzeile) | Titel · Gruppe · Version/Freigabe | — | — | Ausblenden · (eigene: Löschen) |
| **Hinweis-Banner** | Text · Farbe | — | — | Löschen |

Jede Zeile mit Wirkungs-Chip + „Ändert…"-Untertitel (Punkt 1). Nicht-Admins sehen statt Bearbeiten „✍️ Änderung vorschlagen" (existiert schon) — dieselbe Menüstruktur, andere Aktion.
**Gruppierung im Menü** nach den vier Spalten oben — statt heutiger flacher 15er-Liste.

**Priorität-Vorschlag: HOCH.** Baut direkt auf dem vorhandenen Sheet auf; primär Umbau von `renderSheetMain` + neue Einstiege (Rubrik-Kopf, Standard-Titel).

---

## 4. Suche überall (nicht nur versteckt)

**Dein Punkt:** Suchen nicht nur im Verwaltungsmodus / nicht nur versteckt.

**Ist-Zustand:** Global-Suche existiert für alle, ist aber **nur über ☰-Menü** erreichbar; Startseite/Standard haben eigene Suchfelder; die **Verwaltung selbst hat keine Suche** (bei inzwischen ~10 Panels und langen Listen ein echtes Auffindbarkeits-Problem).

**Lösungsideen:**
- **A. 🔎 dauerhaft in der Kopfleiste** (jeder Screen, jeder Modus) → öffnet die globale Suche. Ein Tipp statt zwei.
- **B. Einstellungs-Suche in der Verwaltung** (wie Handy-Einstellungen): Suchfeld oben filtert Panels + Einzeloptionen nach Stichwort inkl. Synonymen („Farbe" findet Kategorie-Farben UND Design UND UK-Farben — gerade wegen der 6 Farbsysteme wichtig, solange Punkt 2 nicht umgesetzt ist).
- **C. Suche in jeder langen Auswahl-Liste** (UK-Picker, Katalog-Übernahme, Material-Pflege — Pflege hat schon Filter, aber kein Textfeld).

**Priorität-Vorschlag: A sofort (trivial), B HOCH, C mit Punkt 7 (Combobox) zusammen.**

---

## 5. Farben & Muster: Norm-Rahmenfarben für Material (Schleusen-Beispiel)

**Dein Punkt:** 6F-Schleuse ist genormt grün; jede als „Schleuse" erkannte Position soll automatisch die Norm-Rahmenfarbe tragen; gleiche Rahmenfarbe (radial 6F vs. femoral 6F) braucht eine zweite visuelle Differenzierung.

**Fachliche Grundlage (Recherche-Stand, VOR EINSATZ GEGEN HAUSBESTAND PRÜFEN):** Die Naben-/Hub-Farben von Einführschleusen folgen einer herstellerübergreifenden **De-facto-Konvention** (keine ISO-Norm für Schleusen-Hubs — anders als Kanülen nach ISO 6009):

| French | Farbe (Konvention) |
|---|---|
| 4F | Rot |
| 5F | Grau |
| 6F | **Grün** ✓ (dein Beispiel) |
| 7F | Orange |
| 8F | Blau |
| 9F | Schwarz |
| ≥10F | herstellerabhängig — einzeln prüfen |

**Lösungsidee — „Material-Typ-Profile" (neues, EIN gemeinsames Regelwerk statt siebtes Farbsystem):**
- Shared-Key `hkl_matprofile`: Liste von Regeln `{ erkennung, rahmenfarbe, zweitmerkmal, aktiv }`.
- **Erkennung:** reine, testbare Helferfunktion aus dem Namen: `istSchleuse(name)` (Schlüsselwort „schleuse"/„sheath"), `frenchSize(name)` (existiert im Kern schon als Größen-Parser: `guessSizeTyp` erkennt French), `zugangsweg(name)` → radial/femoral/brachial aus Name/Rubrik/UK.
- **Anwendung:** Trifft eine Regel → Eintrag bekommt automatisch die Rahmenfarbe (das Eintrag-Farbsystem `qeGet color` + `pickTextColor` existiert bereits und kann exakt dafür wiederverwendet werden — Automatik schreibt aber NICHT ins Overlay, sondern rechnet zur Anzeigezeit; Overlay bleibt manuelle Übersteuerung mit Vorrang).
- **Zweite Dimension bei Farbgleichheit** (radial vs. femoral 6F) — Optionen zur Auswahl:
  - (a) **Rahmen-Muster**: durchgezogen = femoral, gestrichelt = radial (CSS `border-style`, null Aufwand, farbfehlsichtigkeits-sicher) — *Empfehlung*
  - (b) Eck-Badge „R" / „F"
  - (c) Doppelrahmen / einfacher Rahmen
  - QM: Muster + Badge kombinieren ist erlaubt; nur-Farbe ist verboten (Leitplanke).
- **Pflege der Profile:** eigenes Verwaltungs-Panel „🎨 Material-Erkennung & Normfarben" mit: Regel-Liste, Live-Vorschau, Trefferliste („diese 23 Einträge bekämen Grün"), Global-Schalter, Einzel-Opt-out pro Eintrag.
- **Etikettenerkennung per Foto (deine Idee):** OCR/Barcode bräuchte externe Dienste oder große Bibliotheken → kollidiert mit Zero-Dependency + CSP (`connect-src 'self'`). **Alternative ohne Konflikt:** (1) Namens-Heuristik (oben) deckt den Großteil ab; (2) im Pflege-Dialog ein Feld „Normfarbe/Typ" als Dropdown mit Vorschlag aus der Heuristik — die einmalige „Internet-Recherche" wird zur **einmalig eingepflegten Konventionstabelle** im Regelwerk (siehe oben, bereits recherchiert); (3) falls später gewünscht: Barcode-Scan via `BarcodeDetector`-API (Browser-nativ, kein Dependency — aber Geräteabhängig; als Experiment kennzeichnen).

**Priorität-Vorschlag: MITTEL-HOCH** (hoher klinischer Nutzen; sauber machbar; braucht deine Freigabe der Farbtabelle + Wahl der Zweit-Differenzierung).

---

## 6. Verständliche Erklärungen + vollständige Konfigurierbarkeit

**Dein Punkt:** Erklärungen überall, aber einfacher; und alles soll anpassbar sein — eigene Kategorien/Felder überall.

**Ist-Zustand:** Erklärtexte existieren (`panel-help`, `hint`), sind aber teils systemsprachlich („Overlay", „Geltungsbereich", „Konfidenz"). Eigene Kategorien: ✓ möglich. Eigene UKs: ✓ (nur via Schnellmenü). Eigene Gruppen: nur als Freitext beim Standard. Eigene Felder am Eintrag: ✗ (fest: Name/Menge/Größe/Spez/Warum/Synonyme/Lagerort/Preis…). Eigene Status-Werte (Version/Freigabe): ✗ (fest: 4 Werte).

**Lösungsideen:**
- **A. Sprach-Überarbeitung als eigenes Arbeitspaket** (mit Punkt 10 zusammen): jeden `hint`/`panel-help` nach Muster umschreiben: *ein Satz Alltagssprache + ein konkretes Beispiel* („Beispiel: Du stellst ‚Größen-Badges' aus → die grünen 6F-Plaketten verschwinden bei allen.").
- **B. ❓-Aufklapper je Panel** statt Dauertext (weniger visuelle Last, Erklärung auf Abruf).
- **C. Eigene Felder am Eintrag („Zusatzfelder"):** Verwaltung definiert Feldliste `{name, typ: text|zahl|auswahl}` (Shared-Key `hkl_felder`), Einträge speichern Werte im vorhandenen QE-Overlay (`qeSet(...,'feld:<id>',wert)`). Anzeige als zusätzliche Meta-Zeile. → Das ist zugleich die **Vorstufe des Abfrage-Builders** aus dem Backlog: gleiche Datenidee, kleinerer Schnitt.
- **D. Status-Werte konfigurierbar** → siehe Punkt 7 (Dropdown-Hinzufügen) — gleiche Lösung.

**Priorität-Vorschlag: A/B HOCH (reine Texte), C MITTEL (kleines Datenmodell, große Wirkung), D mit Punkt 7.**

---

## 7. „＋ Hinzufügen…" in jedem Dropdown

**Dein Punkt:** Jede Auswahl soll eigene, dauerhaft gespeicherte Optionen zulassen.

**Ist-Zustand (Inventur):** Kategorie-Picker ✓ hat „＋ Neue Kategorie…"; UK-Picker ✓ hat „＋ Neue Unterkategorie…"; **fehlt bei:** UK-Dropdown in „Einstufung prüfen", Status (Version/Freigabe, fest 4 Werte), Gruppe (Freitext statt Auswahl+Hinzufügen), Größen-Typ (nur Heuristik), Lagerort (Freitext ohne Vorschläge), Rubrik-Typ (fest 3).

**Lösungsidee:** Ein wiederverwendbarer **Combobox-Baustein**: Suchfeld + bestehende Optionen + fixer letzter Punkt „＋ ‚…' neu anlegen". Eigene Optionen landen in einem gemeinsamen Shared-Key `hkl_optionen` = `{ status:[…], gruppen:[…], lagerorte:[…], … }` — damit sind sie auf allen Geräten da und in der Datensicherung enthalten. QM: Löschen einer Option, die noch verwendet wird → Warnung mit Verwendungszähler (Muster existiert bei Kategorien schon).
**Vorsicht Rubrik-Typ:** `typ` steuert Programmlogik (material/geraete vs. sonstige → Checklisten, Kosten, Gruppierung). Eigene Typen wären hier NICHT nur kosmetisch → bewusst ausnehmen und im Panel erklären (Transparenz statt falscher Freiheit).

**Priorität-Vorschlag: MITTEL, gebündelt umsetzbar; Lagerort-Vorschläge (aus Bestandsdaten) als Sofortgewinn.**

---

## 8. Benennungs-Review (unintuitive Namen)

**Dein Punkt:** Bisherige Kategorien-/Einstellungs-Namen sind unintuitiv.

**Vorschlagstabelle (zur gemeinsamen Entscheidung, Ist → Vorschlag):**

| Heute | Vorschlag | Begründung |
|---|---|---|
| „Einstufung prüfen" | „Automatische Zuordnung prüfen" | sagt, WAS geprüft wird |
| „Konfidenz" | „Sicherheit der automatischen Erkennung" | Alltagssprache |
| „Unterkategorie" | „Materialgruppe" (o. „Untergruppe") | „Kategorie" ist schon vergeben → Verwechslung |
| „Naturen" (intern) | bleibt intern unsichtbar; UI sagt schon „Kategorien" ✓ | — |
| „Material pflegen" | „Material-Steckbriefe (Foto · Lagerort · Preis)" | Inhalt im Titel |
| „Rubrik-Vorlagen · Geltungsbereich" | „Rubriken, die in mehreren Standards erscheinen" | erklärt statt benennt |
| „Overlay/QEdits" (nur intern) | darf nie in UI/Erklärtexten auftauchen | Systemsprache raus |
| „Zurücksetzen" (mehrdeutig) | immer mit Objekt: „Design zurücksetzen", „Änderungen an diesem Eintrag verwerfen" | Klarheit, was verloren geht |

Verfahren: Tabelle gemeinsam finalisieren → zentral umbenennen (Texte liegen fast alle in den Modulen; das `TXT`-System kann erweitert werden, damit DU Benennungen künftig selbst änderst — passt zu Punkt 6).

---

## 9. Automatische Mengen-Hervorhebung (≠ 1x)

**Dein Punkt:** Zahl immer hervorheben, wo NICHT 1x; ausgeschlossen, wo Menge fehlt.

**Ist-Zustand:** Hervorhebung (`mengeHi`) ist rein **manuell** pro Eintrag. Ein Mengen-Parser existiert (`mengeNum`: „2x"→2).

**Lösungsidee — Regel statt Handarbeit:**
- Anzeige-Logik: `mengeNum(menge) > 1` → automatisch hervorheben; Menge fehlt/leer → nie; „1x" → normal.
- Manuelles `mengeHi` bleibt als **Übersteuerung** (drei Zustände: Automatik / immer / nie) — kein Bestandsverlust.
- Globaler Schalter in Anzeige-Einstellungen („Mengen ab 2 automatisch hervorheben", Standard: an), mit Live-Vorschau (Punkt 1C).
- Kantenfälle fürs Regelwerk: „2–3x" (→ hervorheben), „je 1 pro Zugang" (Menge=1, aber bedingt — siehe Punkt 10/11: Hinweis-Hervorhebung statt Zahl), „bei Bedarf" (keine Zahl → keine Zahl-Hervorhebung, aber Bedingungs-Kennzeichen Punkt 10).

**Priorität-Vorschlag: HOCH (klein, sofort spürbar, rückwärtskompatibel).**

---

## 10. Bedingtes Material (CRM: „nur wenn Kriterium erfüllt")

**Dein Punkt:** Besonders bei CRM gibt es Material, das nur bei erfülltem Kriterium gebraucht wird — genau dieses braucht eine besondere Kennzeichnung.

**Ist-Zustand:** Kein Konzept „Bedingung" im Datenmodell; solche Information steckt heute unstrukturiert im Namen („falls …", „bei …", „ggf. …").

**Lösungsidee — Bedingungs-Kennzeichen:**
- **Datenmodell:** Overlay-Eigenschaft `bedingung` am Eintrag: `{ text: "wenn schrittmacherabhängig", kurz: "SM-abhängig" }` (via QE, teilt sich alle vorhandenen Mechanismen: Sync, Backup, Reset).
- **Darstellung:** gestrichelter Rahmen + auffälliges Badge `⚡ nur wenn: SM-abhängig` — deutlich unterscheidbar von Norm-Farbrahmen (Punkt 5: dort Farbe=Typ, hier Musterung=Bedingung; kombinierbar).
- **Erfassung:** (a) manuell im Bearbeiten-Menü („Bedingung…"); (b) **Erkennungs-Assistent** in der Verwaltung: Stichwort-Scan („falls", „wenn", „bei bedarf", „ggf.", „nur bei") schlägt Kandidaten vor — gleiche Bedienlogik wie „Einstufung prüfen" (bestätigen/ablehnen), KEIN automatisches Setzen (QM-Leitplanke).
- **Weiterdenken (Brainstorming):** Kriterien pro Standard als kleine Schalterleiste im Kopf der Rubrik („Kriterium erfüllt? ☐ SM-abhängig ☐ Sondenwechsel") → bei aktivem Kriterium werden dessen bedingte Materialien von „gedimmt" auf „aktiv + zählt in Checkliste/Plankosten". Das wäre die Brücke zum Abfrage-Builder (Bedingungen = erste „Formularlogik"). Tageshaken-Logik (gerätelokal) ließe sich wiederverwenden.

**Priorität-Vorschlag: MITTEL (Kennzeichen) — die Schalterleiste danach als eigenes Paket.**

---

## 11. Hinweise im Materialnamen (indirekte Menge, Klammern, „für/oder")

**Dein Punkt:** (a) Mengen-Hinweise im Namen („je 1 pro …") hervorheben — nur den Hinweis; (b) Klammer-Inhalte und „für/oder"-Erkennung sollen nicht im Titel bleiben, sondern als farbiges Badge am Eintrag erscheinen.

**Ist-Zustand:** Klammer-Inhalte sind beim Datenimport bereits teilweise als `spezifikation` extrahiert und werden als Meta-Zeile gezeigt; im Anzeige-Namen können sie trotzdem noch vorkommen. „für/oder"-Strukturen sind komplett unbehandelt. Ein Feld `zusatz_markierung` existiert im Datenmodell, wird aber kaum genutzt.

**Lösungsidee — Anzeige-Zerlegung (zur Laufzeit, nie destruktiv):**
- Reine, testbare Parser-Helfer über den Anzeige-Namen:
  - `(…)`-Inhalt → **Spez-Badge** (existierendes Badge-System), Titel zeigt Namen ohne Klammern
  - `für <Zweck>` → **Zweck-Badge** `→ für Schleusenspülung`
  - `oder <Alternative>` → **Alternativ-Badge** `⇄ oder: 5F-Katheter` (klinisch heikel — Alternative darf nie „verschwinden", Badge muss gleichwertig lesbar sein)
  - Mengen-Hinweis im Text (`je 1`, `pro Zugang`, `2 Stück`) → **nur dieses Fragment** farblich markiert (Inline-`<mark>`-Stil), Rest unangetastet
- **QM-Absicherung (zwingend):** Original-Name bleibt gespeichert und per Antippen einsehbar („Originaltext anzeigen"); jede Zerlegungs-Regel global schaltbar + pro Eintrag Opt-out; Verwaltungs-Panel mit **Vorher/Nachher-Vorschau über den echten Bestand** („Regel ‚Klammern' würde 214 Einträge betreffen — Beispiele: …") vor Aktivierung.
- Empfohlene Reihenfolge: Klammern (Datenlage am besten) → Mengen-Hinweis → für → oder (heikelster Fall zuletzt, einzeln freigeben).

**Priorität-Vorschlag: MITTEL; hoher Lesbarkeits-Gewinn, aber nur mit der Vorschau-Absicherung.**

---

## 12. Vorschlags-Assistent beim Anlegen neuer Standards

**Dein Punkt:** Beim Formulieren eines neuen Standards automatisch intuitive Vorschläge je Kategorie bekommen, auswählen, anpassen.

**Brainstorming — drei Vorschlagsquellen, kombinierbar, ohne KI/Fremddienste:**
1. **Vorlage-Standard:** „Ähnlich wie …" wählen → Rubrik-Struktur (+ optional Einträge) übernehmen, dann anpassen. Einfachster großer Gewinn.
2. **Häufigkeits-Vorschläge aus dem Bestand:** je Rubrik/Materialgruppe die in der gleichen **Gruppe** (z. B. CRM) häufigsten Materialien vorschlagen — Datengrundlage existiert (`MAT_INDEX.vorkommen`, gruppierbar). Darstellung als antippbare Chips, vorausgewählt ab Schwelle (z. B. „in ≥ 80 % der CRM-Standards enthalten").
3. **Katalog als kuratierter Pool:** der vorhandene Katalog ist genau dafür gebaut („für andere Standards verfügbar") — im Assistenten als dritter Reiter.

**Ablauf-Skizze:** Titel + Gruppe → Schritt „Grundausstattung wählen" (Reiter: Vorlage / Häufig in dieser Gruppe / Katalog) → Chips an-/abwählen → Standard entsteht mit Auswahl → Feinschliff wie gewohnt. Jeder Chip zeigt Herkunft („in 9/11 CRM-Standards") = Transparenz-Prinzip.
**Abgrenzung:** bewusst OHNE Internet/KI — nachvollziehbare Häufigkeit statt Blackbox (QM: erklärbare Vorschläge).

**Priorität-Vorschlag: MITTEL — nach Kontextmenü/Transparenz, weil es deren Bausteine (Chips, Combobox) wiederverwendet.**

---

## 13. „Falsch erfasstes Material in eine Kategorie ändern"

**Dein Punkt:** Diese Option fehlt.

**Analyse — sie existiert, ist aber nicht auffindbar (Transparenz-Kernproblem!):** Schnellmenü → „Kategorie ändern" sowie Verwaltung → „Einstufung prüfen". Dass sie als fehlend wahrgenommen wird, belegt: falsche Benennung (Punkt 8), versteckter Einstieg (Long-Press unbekannt), fehlende Wirkungs-Erklärung (Punkt 1). **Echte Lücken zusätzlich:**
- Aus **Pflege/Katalog/globaler Suche** heraus kann man die Kategorie NICHT ändern (nur im Standard-Kontext) → Kontextmenü (Punkt 3) auch dort anbieten.
- **„In andere Rubrik verschieben"** existiert überhaupt nicht (nur Reihenfolge innerhalb) → neue Aktion „Verschieben nach… (Rubrik/Untergruppe)" im Kontextmenü.
- Sichtbarer Einstieg: der ✎-Stift am Eintrag existiert schon — das Kontextmenü sollte zusätzlich über ihn erreichbar sein (ein sichtbarer Weg statt nur Geste).

---

## 14. Priorisierungs-Vorschlag (Roadmap-Skizze, zur Entscheidung)

| Phase | Inhalt | Charakter |
|---|---|---|
| **1 — Fundament Transparenz** | Wirkungs-Chips + „Ändert…"-Untertitel (1A/B) · Benennungs-Review (8) · Erklärtexte einfach (6A/B) · 🔎 in Kopfleiste (4A) · Mengen-Automatik (9) | fast nur UI/Texte, geringes Risiko, sofort spürbar |
| **2 — Konsolidierung & Kontext** | Kontextmenü nach Elementtyp (3) · Bedienwege bündeln (2) · Verwaltungs-Suche (4B) · Combobox + „＋ Hinzufügen" (7) | Umbau Bedienschicht |
| **3 — Fachliche Kennzeichnung** | Norm-Farbprofile + Zweitmerkmal (5) · Bedingungs-Kennzeichen (10) · Namens-Zerlegung mit Vorschau (11) | neue Regelwerke, je einzeln freischaltbar |
| **4 — Assistenz & Ausbau** | Standard-Assistent (12) · Zusatzfelder (6C) · Speicherpfad-Migration (2) · Kriterien-Schalter (10-Ausbau) | größere Pakete |

*(Parallel bleibt die Sicherheits-Empfehlung S1 aus dem System-Audit die technisch dringendste offene Entscheidung.)*

## 15. Offene Entscheidungsfragen (bitte beantworten, bevor gebaut wird)

1. **Farbtabelle Schleusen (Punkt 5):** Konventionstabelle 4F–9F so übernehmen? Wer prüft gegen euren Hausbestand (Hersteller)?
2. **Zweit-Differenzierung radial/femoral:** Rahmen-Muster (Empfehlung), Eck-Badge „R/F", oder beides?
3. **„Schnell umbenennen" streichen** zugunsten „Details bearbeiten" — ok?
4. **Benennungstabelle (Punkt 8):** Vorschläge so übernehmen / ändern?
5. **Mengen-Automatik Standard AN** für alle Geräte — einverstanden?
6. **Bedingungs-Stichwörter** (Punkt 10): Welche Formulierungen nutzt ihr real? („falls", „bei Bedarf", …)
7. **Namens-Zerlegung (Punkt 11):** Mit Klammern beginnen — und „oder"-Erkennung erst nach Einzelfreigabe?
8. **Phase-1-Start** wie skizziert freigeben?

---

*Konzept-Dokumente liegen unter `docs/konzepte/`; Umsetzungen referenzieren dieses Dokument und haken die Punkte hier ab (Änderung per Folge-Commit, nicht Überschreiben).*
