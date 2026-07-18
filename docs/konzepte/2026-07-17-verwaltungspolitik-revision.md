# Verwaltungspolitik — grundlegende Revision (Tiefenanalyse, v2)

| | |
|---|---|
| **Erstellt** | 2026-07-17 (v1) · **v2: erweitert um State-of-the-Art-Fundament und verbindliche Ziel-Architektur** |
| **Status** | **Freigegeben (E6, 2026-07-18). Stufen 1–3 umgesetzt + Stufe-4-Governance; offen nur Stufe-4-Vier-Augen (hängt an E5).** |
| **Auftrag** | „Kein Quick-Fix, sondern ein durchdachtes, nachhaltiges System der Verwaltungspolitik und der Logik dahinter — auch wenn es aufwändig ist. Was ist Best Practice / State of the Art für solche Anwendungen?" |

---

## 0. Einordnung: Welche Problemklasse ist das eigentlich?

Die entscheidende Erkenntnis zuerst: **Diese App ist keine gewöhnliche Daten-App (CRUD).** Sie ist ein System für

> **richtlinien-gesteuerte Anpassung unveränderlicher Stamm-Inhalte, über Reichweiten (Stelle → Standard → Gruppe → überall), mehrgeräte-synchron, offline-first, in einem regulierten (QM-/Medizin-)Umfeld.**

Die Quelldaten (`DB_BASE`) sind bewusst schreibgeschützt; alles, was Nutzer ändern, ist eine *Anpassung darüber*. Genau diese Problemklasse — „Konfiguration/Policy über unveränderlicher Basis, mit Geltungsbereichen, Nachvollziehbarkeit und Vorschau" — hat die Software-Industrie mehrfach unabhängig gelöst. Ein nachhaltiges System entsteht nicht, indem wir etwas Neues erfinden, sondern indem wir die **erprobten Muster dieser Referenzsysteme** übernehmen und auf unsere Größe zuschneiden.

---

## 1. State of the Art: die fünf Referenzsysteme und ihre Lektionen

### 1.1 CSS-Kaskade (W3C) — *das* Modell für „Regeln mit Reichweite"

Stylesheets ändern nie das HTML (die Basis bleibt unangetastet — wie unser `DB_BASE`). Stattdessen: **Regeln** = Selektor (Ziel + Reichweite) + Eigenschaft + Wert. Konflikte löst eine **deterministische Kaskade**: Spezifität zuerst, bei Gleichstand die spätere Regel.

**Lektion 1:** Änderungen als *Regeln* formulieren, nicht als Edits am Objekt.
**Lektion 2:** *Eine* dokumentierte, deterministische Auflösungsordnung („spezifisch schlägt allgemein, dann neuer schlägt älter") statt vieler Spezial-Resolver.
**Lektion 3 (die wichtigste):** Der Browser-Inspector zeigt pro Element **alle greifenden Regeln, die Gewinnerin markiert, Verliererinnen durchgestrichen, jede mit Herkunft**. Diese „Computed Styles"-Ansicht ist das perfekte Vorbild für unsere Transparenz-Frage „Warum sieht dieser Eintrag so aus?".

### 1.2 Windows-Gruppenrichtlinien (GPO) + RSoP — Verwaltungspolitik im Unternehmensmaßstab

Das wörtliche Industrie-„Verwaltungspolitik"-System: Richtlinien hängen an **Geltungsbereichen** (Lokal → Standort → Domäne → Organisationseinheit) mit Vererbung und Präzedenz. Und: Weil das komplex werden kann, gibt es **RSoP** („Resultant Set of Policy") — ein Werkzeug, das für jedes Objekt beantwortet: *„Was gilt hier tatsächlich, und woher kommt es?"* — auch als **Simulation vor dem Anwenden**.

**Lektion 4:** Gruppen (CRM, EPU, …) sind der natürliche mittlere Geltungsbereich — exakt unsere fehlende Ebene.
**Lektion 5:** Ein „Was-gilt-hier-und-warum"-Werkzeug ist **kein Nice-to-have, sondern Pflichtbestandteil** eines Reichweiten-Systems. Ohne RSoP wird jedes Scope-System undurchschaubar.

### 1.3 Feature-Flag-/Targeting-Systeme (LaunchDarkly-Klasse) — sichere Massen-Änderung

Moderne Rollout-Systeme ändern Verhalten für **Segmente** (≙ Gruppen) über Targeting-Regeln. Best Practices dort: **Vorschau der Trefferzahl** („diese Regel trifft N Nutzer") *vor* dem Aktivieren, **jede Änderung journaliert mit Urheber**, und **sofortige Rücknahme** (Kill-Switch) als Grundrecht.

**Lektion 6:** Massen-Änderung = Regel + Treffervorschau + Ein-Klick-Rücknahme. Nie „anwenden und hoffen".

### 1.4 Event Sourcing / Ledger (Buchhaltung, Git, elektronische Patientenakte)

In Buchhaltung, Git und Patientenakten wird **nie überschrieben**: Es wird **angehängt**. Der Zustand ist die *Folge* der Ereignisse; Rückgängig ist ein **kompensierendes Ereignis** (Storno / `git revert`), keine Löschung. Für Medizin-/GxP-Software ist das der Compliance-Standard (ALCOA-Prinzipien: zuordenbar, zeitnah, original, unverfälscht — 21 CFR Part 11 verlangt genau solche Audit-Trails).

**Lektion 7:** Das *Schreibmodell* ist ein **append-only-Journal** (wer, wann, was, welche Reichweite), der sichtbare Zustand nur eine daraus berechnete Sicht.
**Lektion 8 (Sync-Bonus):** Eine nur-wachsende Ereignismenge lässt sich **konfliktfrei vereinigen** (Vereinigungsmenge statt „last write wins") — zwei Geräte, die gleichzeitig Regeln anlegen, überschreiben einander *prinzipbedingt nicht mehr*. Das ist robuster als unser heutiges Key-LWW und kommt gratis mit.

### 1.5 QM-Dokumentenlenkung (ISO 9001 / 13485)

Gelenkte Dokumente durchlaufen Zustände (Entwurf → Prüfung → Freigabe → gültig → obsolet), Änderungen sind begründet und rückverfolgbar. Für uns relevant, **falls** die Klinik zertifiziert ist (offene Entscheidung E5): Dann brauchen *weitreichende* Regeln (🗂/🌐) perspektivisch ein Vier-Augen-Prinzip — unser vorhandenes **Vorschlagswesen mit Voting ist dafür bereits die halbe Infrastruktur**.

**Lektion 9:** Governance-Stufen nach Reichweite: kleine Änderung = sofort; große Änderung = Vorschau + bewusste Bestätigung; (später optional) sehr große = zweites Paar Augen.

### Was wir bewusst NICHT übernehmen

- **CRDT-Frameworks (Automerge/Yjs):** Overkill und Bruch der Zero-Dependency-Politik; die Vereinigungs-Eigenschaft des Journals genügt uns.
- **Server-seitige Event-Store-Datenbank:** Der Zero-Dep-Server bleibt; das Journal ist ein normaler geteilter Schlüssel.
- **Volles ISO-Workflow-Modul jetzt:** hängt an E5; das Modell lässt es später andocken, ohne umzubauen.

---

## 2. Ist-Befund (am Code belegt): warum das heutige Modell nicht trägt

Die App hat heute **keinen gemeinsamen Begriff von „einer Änderung"**. Es existieren parallel:

| Overlay-Speicher | Ändert | Implizite Reichweite |
|---|---|---|
| `overrides[cid]` | Kategorie | 📍 diese Stelle |
| `reassign[cid]` | Unterkategorie | 📍 diese Stelle |
| `QE.cid[cid]` | Name/Menge/Größe/Spez/Farbe/… | 📍 diese Stelle |
| `QE.mat[key]` | dieselben Felder | 🧩 dieses Material überall |
| `ukMap` / `ukMeta` | UK-Name/-Farbe/-Symbol | 🏷 alle mit diesem Namen |
| `RUBICON[name]` | Rubrik-Symbol | 🏷 alle Rubriken dieses Namens |
| `RUBE[rubKey]` / `STDE[sid]` | Rubrik/Standard | 📄 ein Standard |
| `NATCFG` | Kategorien | 🌐 global |
| `RUBTPL` | Rubrik-Vorlagen | 🗂 std/Gruppen/alle ✓ |

Vier **unausgesprochene** Reichweiten (Stelle · Material · Name · global), aufgelöst von je eigenen Spezial-Resolvern (`effNatur` 4-stufig, `canonUk`/`rawUk`, `qeGet`, …). Folgen:

1. **Die Gruppen-Reichweite (CRM/EPU) fehlt strukturell** — sie müsste in jeden Speicher einzeln eingebaut werden.
2. **Doppelwege/Doppelspeicher** („alles doppelt", QM-Brainstorming §2) sind systembedingt.
3. **Keine generische Vorschau, kein generisches Rückgängig, kein Journal** — weil „eine Änderung" kein greifbares Objekt ist.
4. Einzige Ausnahme und **lebender Beweis für das Zielmodell**: `RUBTPL` (`{scope:'std'|'groups'|'all'}` + `rubTplMatches`-Resolver) funktioniert seit Monaten genau nach dem Prinzip, das hier vorgeschlagen wird.

---

## 3. Ziel-Architektur: „Regelwerk mit Kaskade, Journal und Inspektor"

Die Synthese der fünf Referenzsysteme, zugeschnitten auf diese App. Drei Schichten, zwei Werkzeuge, eine Governance-Treppe.

### 3.1 Schicht 0 — Unveränderliche Basis *(existiert)*

`DB_BASE` bleibt schreibgeschützt (wie das HTML unter CSS, wie der erste Commit in Git). ✓

### 3.2 Schicht 1 — Das Regel-Journal `hkl_rules` (append-only)

**Eine** Änderung = **ein** unveränderliches Regel-Ereignis:

```js
{
  id:    'r_…',                 // eindeutig (Zeit+Zufall)
  ts:    '2026-07-17T…',        // wann
  von:   'github:bosock'|'gerät:…', // wer (E1-Login, sonst Geräte-ID)
  op:    'set' | 'revoke',      // setzen oder (kompensierend) zurücknehmen
  ref:   'r_…',                 // bei revoke: welche Regel
  ziel:  { art:'stelle'|'material'|'rubrik'|'standard'|'uk'|'kategorie', key:… },
  wo:    { art:'stelle'|'standard'|'gruppe'|'alle', wert:… },   // die Reichweiten-Achse
  prop:  'natur'|'name'|'uk'|'color'|'hidden'|…,
  wert:  …,
  notiz: '…'                    // optional: Begründung (QM)
}
```

Grundsätze (aus 1.4):
- **Nie löschen, nie überschreiben** — Rücknahme ist ein `revoke`-Ereignis. Vollständiger Audit-Trail (ALCOA) fällt ab.
- **Sync als Vereinigung:** eingehende `hkl_rules` werden mit den lokalen **per `id` vereinigt** (append-only ⇒ Vereinigung ist verlustfrei und idempotent). Konfliktklasse „zwei Admins gleichzeitig" verschwindet für Regeln.
- **Wachstum:** Regeln sind Text (~200 Bytes); selbst tausende sind kleiner als ein einziges Foto. Zunächst **keine Kompaktierung** (QM bevorzugt Vollständigkeit); Deckel ~2000 mit Archiv-Export, Server-Snapshots archivieren ohnehin.

### 3.3 Schicht 2 — Der eine Resolver (die Kaskade)

**Eine** reine, testbare Funktion ersetzt perspektivisch alle Spezial-Resolver:

```
effektiv(prop, eintrag, kontext):
  basiswert
  → überstimmt von der spezifischsten, nicht-revozierten Regel
  → bei gleicher Spezifität gewinnt die neuere (ts)
```

**Spezifitätsordnung** (verbindlich, dokumentiert — deckungsgleich mit heutigem Verhalten `QE.cid > QE.mat`):

> **WO zuerst:** 📍 Stelle > 📄 Standard > 🗂 Gruppe > 🌐 alle · **dann ZIEL:** dieses Vorkommen > dieses Material · **dann Zeit:** neuer > älter.

Sichtbarer Zustand = berechnete Sicht (Projektion), wie heute beim Rendern — nur aus *einer* Quelle.

### 3.4 Werkzeug 1 — Der Inspektor („Warum sieht das so aus?")

Das CSS-Devtools-/RSoP-Muster als Menüpunkt in jedem Bearbeiten-Menü: **„🔍 Warum so?"** zeigt pro Eintrag/Rubrik/Standard:

- den Basiswert aus der Quelldatei,
- **alle greifenden Regeln**, die Gewinnerin markiert, überstimmte durchgestrichen,
- je Regel: Wirkungs-Chip (Reichweite), wer, wann, Notiz — und einen **„Zurücknehmen"-Knopf** (= revoke).

Damit sind die Punkte 1 A–E des QM-Brainstormings (Chips, Untertitel, „wo wirkt das?", Journal) **in einem Werkzeug** vereint statt vier Einzellösungen.

### 3.5 Werkzeug 2 — Treffervorschau für weite Reichweiten (RSoP-Simulation)

Jede Regel mit `wo ∈ {gruppe, alle}` zeigt **vor** dem Anwenden: *„Betrifft M Vorkommen in N Standards: [Liste]"* (berechenbar, weil Ziel+Reichweite deklarativ sind). Nach dem Anwenden: Ein-Klick-Rücknahme der ganzen Massenänderung (ein `revoke`).

### 3.6 Governance-Treppe (die eigentliche „Politik")

| Reichweite | Verfahren |
|---|---|
| 📍 Stelle / 📄 Standard | direkt anwenden (wie heute), erscheint im Journal |
| 🗂 Gruppe / 🌐 alle | **immer** Treffervorschau + bewusste Bestätigung; prominente Rücknahme |
| später, falls ISO (E5) | Vier-Augen: weite Regel entsteht als *Vorschlag* (vorhandenes Vorschlagswesen!), zweiter Admin wendet an |

Dazu: Journal-Ansicht in der Verwaltung („Letzte Änderungen", filterbar, mit Rücknahme); `von` nutzt die GitHub-Identität aus E1; QM-Leitplanken unverändert (Original bleibt abrufbar, Automatik übersteuerbar, Farbe nie alleiniger Träger).

---

## 4. Warum dieses System *nachhaltig* ist (Eigenschaften statt Versprechen)

1. **Erweiterbar ohne Umbau:** Neue Eigenschaft = neuer `prop`-Wert. Neue Reichweite = neuer `wo.art`-Wert. Neue Massenoperation = Regel mit weiter Reichweite. Nichts davon braucht neue Speicher oder Resolver.
2. **Erklärbar per Konstruktion:** Der Inspektor kann *jede* Darstellung lückenlos begründen — Transparenz ist keine UI-Deko mehr, sondern Systemeigenschaft.
3. **Revidierbar per Konstruktion:** Alles (auch Massenänderungen) ist ein Objekt mit Rücknahme-Ereignis.
4. **Auditierbar per Konstruktion:** Journal = das Datenmodell selbst (ALCOA-konform), nicht ein nachträglich angeflanschtes Log.
5. **Sync-robuster als heute:** Vereinigung statt Überschreiben für den Regel-Schlüssel.
6. **Testbar:** Resolver und Trefferberechnung sind reine Funktionen → Unit-Tests; Journal-Vereinigung → Unit-Tests; UI-Flüsse → vorhandene E2E-Infrastruktur.
7. **Konsistent mit dem Bestand:** `RUBTPL` beweist das Muster im eigenen Code; die Wirkungs-Chips (bereits gebaut) *sind* die Reichweiten-Achse; das Vorschlagswesen *ist* der spätere Vier-Augen-Baustein.

## 5. Risiken und ihre Antworten

| Risiko | Antwort |
|---|---|
| Regel-Konflikte verwirren | deterministische Kaskade + Inspektor zeigt Gewinner/Verlierer |
| Verwaiste Regeln (Ziel existiert nicht mehr) | Resolver ignoriert sie; Verwaltungs-Panel listet sie zum Aufräumen |
| Journal wächst | Text-Regeln sind winzig; Deckel + Archiv-Export; Server-Snapshots |
| Migration bricht Bestehendes | Strangler (unten): alte Speicher bleiben lesbar, bis alles migriert ist; jede Stufe einzeln getestet & deploybar |
| Zwei Wahrheiten während der Migration | klare Präzedenz: Regeln **vor** Alt-Speichern; Alt wird nur noch gelesen, nie mehr neu geschrieben (ab Stufe 2) |

## 6. Umsetzungs-Fahrplan (Strangler, jede Stufe für sich grün)

- **Stufe 0 — Modell freigeben (Entscheidung E6, ✋ Betreiber):** Reichweiten-Achse, Spezifitätsordnung, Journal-Prinzip. Dieses Dokument ist die Vorlage.
- **Stufe 1 — Fundament (~2–3 Tage):** `hkl_rules` (SHARED+BACKUP, Vereinigungs-Merge) · Resolver-Vorschalter vor `effNatur`/`qeGet`/`canonUk` (Regeln zuerst, Alt-Speicher als Fallback) · Treffervorschau-Funktion · **erste Sammel-Operation:** „Material in Gruppe/überall ändern" (Kategorie · Farbe · Ausblenden) mit Vorschau + Rücknahme · Inspektor v1 („Warum so?" am Eintrag). Unit-Tests (Resolver, Merge, Treffer) + E2E (Bulk über 2 Geräte, Rücknahme).
- **Stufe 2 — Ein Schreibweg (~2–3 Tage):** Schnellmenü/„Einstufung prüfen" schreiben Regeln statt `overrides`/`reassign`/`QE`; der Scope-Dialog bekommt 📄/🗂 dazu (aus „Nur hier/Überall" werden vier ehrliche Reichweiten); Alt-Einträge werden beim nächsten Bearbeiten als Regel neu geschrieben (Lazy-Migration).
- **Stufe 3 — Konsolidierung (~2 Tage):** Verwaltungs-Panel „Regeln & Journal" (Liste, Filter, Rücknahme, verwaiste Regeln); Alt-Speicher `overrides`/`reassign` stilllegen (nur noch Lese-Fallback), Doppelwege aus §2 des QM-Brainstormings entfallen.
- **Stufe 4 — Governance-Ausbau (nach E5):** Vier-Augen über das Vorschlagswesen; ggf. Freigabe-Workflow für Standards.

## 7. Empfehlung

Das Modell **freigeben (E6)** und mit **Stufe 1** beginnen. Es ist der aufwändige, aber richtige Weg: Statt einer weiteren Funktion bekommt die App ein *Betriebssystem für Änderungen* — dieselbe Logik von der kleinsten Korrektur bis zur klinikweiten Massenänderung, erklärbar, rückverfolgbar, rücknehmbar.
