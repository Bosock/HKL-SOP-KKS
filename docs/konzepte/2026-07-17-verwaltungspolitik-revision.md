# Verwaltungspolitik — grundlegende Revision (Tiefenanalyse)

| | |
|---|---|
| **Erstellt** | 2026-07-17 |
| **Status** | **Konzept / Entscheidungsgrundlage — noch nichts umgesetzt.** |
| **Auftrag** | „Ich glaube, wir brauchen eine grundlegende Revision der Verwaltungspolitik in der App. Mach bitte wirklich eine tiefe Analyse … wie es am besten wäre, diese ganze Thematik zu bearbeiten." |
| **Anlass** | Wunsch nach schnellen **Massen-Änderungen über alle Standards / Gruppen (CRM, EPU, …)** — und das Gefühl, dass das aktuelle Bearbeiten-Modell dafür nicht trägt. |

---

## 0. Kernbefund in einem Satz

> **Die App hat heute keine *einheitliche Vorstellung davon, was „eine Änderung" ist*. Jede Art von Änderung hat ihren eigenen Speicher, ihre eigene Reichweite und ihren eigenen Bedienweg. Genau deshalb fühlt sich vieles „doppelt" an und deshalb ist „massenhaft über Gruppen" strukturell schwer. Die Lösung ist keine neue Bulk-Funktion, sondern *ein* gemeinsamer Änderungs-Begriff mit *einer* expliziten Reichweiten-Achse — dann ist Bulk nur noch „größere Reichweite".**

---

## 1. Ist-Zustand: Wie „Änderungen" heute wirklich funktionieren

Die Inhalte sind: **eine schreibgeschützte Quelldatei** (`DB_BASE`, aus den Word-Daten) plus ein **Stapel von Overlay-Speichern** im geteilten Zustand, die zur Anzeigezeit darübergelegt werden. Am Code belegt:

| Overlay-Speicher | Was er ändert | Implizite Reichweite |
|---|---|---|
| `overrides[cid]` | Kategorie eines Eintrags | **📍 diese Stelle** (cid) |
| `reassign[cid]` | Unterkategorie eines Eintrags | 📍 diese Stelle |
| `QE.cid[cid]` | Name/Menge/Größe/Spez/Farbe/Wichtig/Ausblenden … | 📍 diese Stelle |
| `QE.mat[material_key]` | dieselben Felder | **🧩 dieses Material — überall** |
| `ukMap` | Unterkategorie umbenennen/zusammenführen | **🏷 überall mit diesem Namen** |
| `ukMeta` | UK-Farbe/-Symbol/-Reihenfolge | 🏷 pro Name |
| `RUBICON[name]` | Rubrik-Symbol | 🏷 alle Rubriken dieses Namens |
| `RUBE[rubKey]` | Rubrik umbenennen/ausblenden/ordnen | 📄 diese Rubrik in **einem** Standard |
| `STDE[stdId]` | Titel/Gruppe/Version/Ausblenden eines Standards | 📄 ein Standard |
| `NATCFG` | Kategorien (Label/Farbe/Symbol/beschaffbar) | **🌐 global** |
| `hkl_prod`, `hkl_care`, `hkl_gtin` | Preise / Pflege / Scan-Produkte | 🧩 je Material bzw. je GTIN |
| `RUBTPL` | Rubrik-Vorlage | **🗂 std / Gruppe(n) / alle** |
| `NEWSTD/NEWRUB/NEW/ADDITIONS` | eigene Standards/Rubriken/Einträge | Anlage |

Zur Anzeigezeit lösen mehrere **Spezial-Resolver** die Schichten auf, z. B. `effNatur(e,cid)` (4-stufig: `overrides` → `QE.mat.natur` → `natur_manuell` → Quelle) und `canonUk`/`rawUk`, `qeGet`. Jeder Resolver kennt nur seine eigenen zwei bis vier Speicher.

## 2. Die vier Wurzelprobleme

1. **Es gibt keine gemeinsame „Reichweiten-Achse".** Faktisch existieren heute schon **vier verschiedene, implizite Reichweiten** nebeneinander — `cid` (diese Stelle), `material_key` (dieses Material überall), `name` (alles mit diesem Namen), `global` — **plus eine fünfte, die fehlt: `Gruppe` (CRM/EPU)**. Weil die Achse nicht ausgesprochen ist, muss man sie pro Änderungsart neu lernen.

2. **Ein Konzept, viele Wege und Speicher (Doppelung).** „Kategorie ändern" geht über Schnellmenü *und* „Einstufung prüfen", landet mal in `overrides[cid]`, mal in `QE.mat`. Dasselbe bei Unterkategorie (`reassign` **und** `QE.mat.uk` **und** `ukMap`). Das ist der „alles doppelt"-Eindruck aus dem QM-Brainstorming §2 — er ist **real und am Code belegt**.

3. **Bulk ist strukturell teuer.** Weil jede Reichweite in einem anderen Speicher lebt, hieße „über die Gruppe CRM ändern": Gruppen-Logik in **jeden** dieser Speicher einbauen. Das skaliert nicht — daher das Gefühl „geht nicht/ist kompliziert".

4. **Keine gemeinsame Vorschau, kein gemeinsames Rückgängig, kein Journal.** Weil „eine Änderung" kein greifbares Objekt ist, kann man nicht generisch sagen „das betrifft 14 Standards", sie nicht als Ganzes zurücknehmen und nicht protokollieren, wer wann was auf welcher Reichweite geändert hat.

## 3. Das Zielmodell: **Eine Änderung = Ziel · Reichweite · Wert**

Alles wird auf **einen** Begriff zurückgeführt — eine **Regel**:

```
Regel = { ziel, reichweite, eigenschaft, wert, wann, von }
```

- **ziel** — worauf: ein Eintrag · ein Material · eine Rubrik · ein Standard · eine Kategorie.
- **reichweite** — *die eine explizite Achse*, überall gleich benannt (= die Wirkungs-Chips aus §1):
  - `📍 hier` (genau diese Stelle)
  - `📄 dieser Standard`
  - `🗂 diese Gruppe` (CRM, EPU, …) ← **das bisher Fehlende**
  - `🧩 dieses Material` (jedes Vorkommen, alle Standards)
  - `🌐 alle`
- **eigenschaft/wert** — Kategorie, Name, Größe, Farbe, ausgeblendet, Reihenfolge …

**Auflösung: spezifisch schlägt allgemein** (`hier > Standard > Gruppe > Material > alle`). Es gibt **einen** Resolver statt vieler Spezial-Resolver. `effNatur` ist heute schon ein Mini-Resolver dieser Art — er wird verallgemeinert.

### Warum daraus alles **gratis** folgt

- **Bulk** ist keine neue Funktion mehr, sondern nur eine **größere Reichweite** derselben Regel (`🗂 Gruppe` / `🌐 alle`). Kein separater „Bulk-Motor".
- **Vorschau** fällt an: Aus `{ziel, reichweite}` kann man **vor** dem Anwenden genau ausrechnen, *welche* Einträge/Standards betroffen sind → „betrifft 23 Vorkommen in 14 Standards".
- **Rückgängig** fällt an: Eine Regel ist **ein Objekt** — entfernen = zurücknehmen (auch für Massenänderungen als Ganzes).
- **Transparenz (§1)** fällt an: Die Reichweite **ist** der Wirkungs-Chip.
- **Journal (M8)** fällt an: Regeln sind zeitgestempelte Objekte → „wer/wann/was/welche Reichweite".

## 4. Der lebende Beweis: `RUBTPL`

Die Rubrik-Vorlagen sind **heute schon genau dieses Modell**: `{ id, name, typ, scope: 'std'|'groups'|'all', groups:[…] }` mit einem `rubTplMatches(tpl, stdId, grp)`-Resolver. Sie sind der Beleg, dass das Muster in dieser App trägt — und die **Schablone** für die Migration: *„mach alles andere so wie RUBTPL."*

## 5. Governance — der eigentliche „-politik"-Teil

„Verwaltungspolitik" heißt auch **wer darf was, und mit welchen Sicherungen** — im Medizinkontext nicht verhandelbar:

- **Vorschau-Pflicht bei weiter Reichweite.** `🗂 Gruppe`/`🌐 alle` zeigen immer zuerst „betrifft N Standards / M Vorkommen — anwenden?".
- **Alles rückgängig.** Jede Regel (auch die massenhafte) ist als Ganzes rücknehmbar; „Zuletzt geändert"-Liste mit Ein-Klick-Rücknahme.
- **Journal (wer/wann/was/Reichweite).** Baut auf der Login-Identität auf (Entscheidung **E1** — GitHub-Login) und schafft die QM-Nachvollziehbarkeit (Audit-Befund F1).
- **Zwei Stufen im UI:** normale Einzeländerung vs. bewusst gewählte **„Sammel-Änderung"** mit größerer Bestätigung. Keine versehentliche Reichweite.
- **Automatik bleibt übersteuerbar** (QM-Leitplanke): Regeln ändern nie stillschweigend die klinische Bedeutung; Originaltext bleibt abrufbar.

## 6. Sicherer, gestufter Weg (Strangler — kein Big-Bang)

Ein kompletter Umbau des Overlay-Systems ist das Herz der App und im Medizinkontext riskant. Deshalb **additiv** vorgehen, in Schichten:

- **Stufe 0 — Modell festschreiben.** Reichweiten-Achse + Auflösungsreihenfolge als Kanon (dieses Dokument). Jede neue Funktion nutzt nur noch dieses Vokabular.
- **Stufe 1 — Neue Regel-Schicht *über* dem Bestand (`hkl_rules`).** Ein neuer geteilter Speicher: Liste von Regeln `{ziel, reichweite, eigenschaft, wert, wann, von}`. Der Resolver konsultiert **zuerst** diese Regeln, dann die alten Speicher (Rückwärtskompatibilität). Damit ist **eine Gruppen-/alle-Regel EIN Objekt** — vorschaubar, rücknehmbar. **Hier entsteht die erste echte Bulk-Fähigkeit**, ohne einen einzigen alten Speicher anzufassen.
- **Stufe 2 — Neue Änderungen durch die Regel-Schicht leiten; Altes faul migrieren** (alte Speicher lesen, beim nächsten Bearbeiten als Regel neu schreiben).
- **Stufe 3 — Redundante Speicher zurückbauen** (`overrides`/`reassign` → Regeln; siehe Backlog N6), wenn alles über die Regel-Schicht läuft.

Jede Stufe ist für sich testbar (Unit + E2E) und deploybar; nichts muss auf einmal „richtig" sein.

## 7. Konkrete erste Sammel-Operationen (nach Stufe 1)

- **Material überall/gruppenweit ändern** — Material wählen → Kategorie/Farbe/Name/Lagerort einmal → Reichweite `🧩 Material` oder `🗂 Gruppe` → Vorschau „betrifft N Vorkommen in M Standards" → anwenden/rücknehmen.
- **Rubrik über Gruppe/alle** — bereits über `RUBTPL` möglich; nur auffindbar/intuitiv machen (Teil desselben Modells).
- **Ausblenden/Einblenden gruppenweit** — z. B. „Draht X in allen EPU-Standards ausblenden".
- **Hinweis für eine Gruppe** — Info-Banner an alle Standards einer Gruppe.

## 8. Risiken & Leitplanken

- **Regel-Konflikte** (zwei Regeln, gleiche Eigenschaft, verschiedene Reichweite): klare Präzedenz (spezifisch > allgemein) + im Journal sichtbar.
- **Verwaiste Regeln** (Material/Standard existiert nicht mehr): Resolver ignoriert, Aufräum-Hinweis in der Verwaltung.
- **Sync/Merge:** `hkl_rules` ist ein Top-Level-Schlüssel wie die anderen (last-write-wins pro Schlüssel) → in `SHARED_KEYS`+`BACKUP_KEYS` wie gehabt.
- **Medizinische Sicherheit:** weite Reichweite nur mit Vorschau + Rücknahme; nie Farbe/Automatik als alleiniger Bedeutungsträger.

## 9. Empfehlung

1. **Modell annehmen** (Reichweiten-Achse + eine Regel-Schicht) als neue Verwaltungspolitik.
2. **Stufe 1 bauen**: `hkl_rules` + gemeinsamer Resolver-Vorschalter + **eine** erste Sammel-Operation („Material gruppen-/alle-weit ändern") **mit Vorschau + Rücknahme**. Klein, additiv, risikoarm — und liefert sofort die gewünschte Bulk-Fähigkeit.
3. Danach Stufe 2/3 schrittweise; jede Reichweite, jede neue Funktion spricht dieselbe Sprache.

> Damit wird „massenhaft über Standards/Gruppen" nicht ein Sonderfeature, sondern der **Normalfall desselben, einfachen Begriffs** — und die App wird gleichzeitig *einfacher*, weil vier implizite Reichweiten und mehrere Doppelwege zu **einer** klaren Achse verschmelzen.
