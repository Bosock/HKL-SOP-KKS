# Konzept — Ausbau der App

Stand: 05.08.2026 · Grundlage: der Bestand auf `claude/github-oauth-connect-ljdxp2`

Dieses Papier beschreibt für jeden Ausbau: was heute wirklich im Quelltext
steht (Befund), was das Handwerk außerhalb dieses Hauses dazu gelernt hat
(Stand der Technik), das Zielbild, das Datenmodell, die Bedienung, den Weg
dorthin ohne Datenverlust — und ausdrücklich das, was **nicht** gebaut werden
sollte.

> **Fassung 2 (05.08.2026).** Nach der ersten Durchsicht durch den Betreiber
> wurde **K1 vollständig umgeschrieben**: Statt *Vorgaben*, wo ein Bild
> hingehört, gibt es jetzt die *Möglichkeit*, überall eines hinzusetzen — mit
> frei wählbarer Darstellungsgröße. Dazu kamen fünf weitere Ausbauten (K6–K10).
> Die Abschnitte K2–K5 sind inhaltlich unverändert und um das ergänzt, was der
> Betreiber präzisiert hat.

Alle Ausbauten stehen unter denselben Vorgaben wie der Rest der App
(`docs/GRUNDSAETZE.md`), besonders unter **A7** (volle Kontrolle ohne
Entwickler) und **⑤ Alles konfigurierbar**: Jedes Wort, jede Kategorie, jede
Vorgabe, jeder Bedienpunkt daraus muss in einer Verwaltungsmaske änderbar
sein. Nichts davon darf je eine Code-Änderung brauchen.

| | Ausbau | Kern in einem Satz | Größe |
|---|---|---|---|
| **K1** | Bilder überall | An **jeder** Stelle kann ein Bild stehen — mit frei wählbarer Größe. | mittel |
| **K2** | Eigenschaften an Standards | Ein Eingriff bekommt **Merkmale** („sedierungspflichtig") — sichtbar, zählbar, als Reichweite nutzbar. | mittel |
| **K3** | Reichweite je Feld | Eine Bearbeitung darf **pro Feld** unterschiedlich weit reichen — mit Prüfblatt vor dem Speichern. | klein |
| **K4** | Material ohne 🔗 | Die Verknüpfung verschwindet aus der Bedienung — **ein Material ist ein Material**. | groß |
| **K5** | Bausteine kuratiert | Der Mensch **sammelt** Bausteine; sie sind **rubrikgebunden**. | mittel |
| **K6** | Standardkopf als Bauplan | Was oben in einem Standard steht, ist eine Liste umbenennbarer Bausteine. | klein |
| **K7** | Schrift & Auszeichnung | Größe und Gewicht je Zeile, Hervorhebung je Wort. | klein |
| **K8** | Bereiche | Zweite Sicht aufs Material: steriler Tisch · Umfeld. | klein |
| **K9** | Alternativen | Austauschgruppen (Material) und Verfahrenszweige (Ablauf). | mittel |
| **K10** | Fassung festschreiben | Der erreichte Stand wird zur neuen Grundlage. | mittel |

---

## K1 · Bilder überall — Möglichkeit statt Vorgabe

### Der Kurswechsel

Die erste Fassung dieses Papiers schlug **Medienplätze** vor: eine Vorgabe je
Stelle, welche Art Bild dort *hingehört*, wie viele, und ob es sein *muss* oder
*soll*.

Der Betreiber hat das verworfen, und zwar zu Recht:

> „Ich möchte keine Vorgaben bei den Medien angeben, sondern ich möchte
> entscheiden, an welcher Stelle kommt ein Bild hin."

Das ist der bessere Entwurf. Eine Vorgabe hätte einen zweiten Regelkreis
eingezogen, der gepflegt werden will, und hätte in der Praxis genau zwei
Zustände produziert: erfüllt und unerfüllt. Beides interessiert niemanden im
Saal. Gebraucht wird die **Möglichkeit**, nicht die Pflicht.

### Befund

`features/medien.js` konnte Bilder nur an **Einträgen** — und alle gleich
groß, als kleiner Streifen.

### Zielbild

**Drei Dinge, mehr nicht:**

1. **Überall.** Neben Einträgen auch am Standardkopf, an einer Rubrik und an
   jedem Abschnitt.
2. **Größe je Stelle.** Klein wie ein Symbol · mittel · groß wie in einer
   Anleitung. Jederzeit nachträglich änderbar.
3. **Antippen macht groß** — an jeder Stelle in der App, samt der Angaben zum
   Bild.

### Datenmodell

Stellen, die kein Eintrag sind, haben keine Regel-Kaskade; sie **sind** jeweils
genau eine Stelle. Deshalb ein eigener, flacher Speicher `hkl_medienanker`,
nach **Ankerschlüssel**:

```
std:<sid>                 Kopf eines Standards
rub:<sid>|<ri>            eine Rubrik
uk:<sid>|<ri>|<name>      ein Abschnitt (Material/Geräte)
seg:<sid>|<ri>|<name>     ein Abschnitt (Ablauf)
```

Der Anker ist bewusst eine **Zeichenkette**: Kommt morgen eine weitere Stelle
dazu, braucht es keinen neuen Speicher und keine neue Funktion.

An Einträgen bleibt alles wie es war — die Bilder laufen weiter über die
Reichweiten-Treppe, damit ein Foto des Coro-Sets mit einem Tipp an allen 23
Stellen erscheint.

### Größe: die entscheidende Einsicht

**Ein Bild trägt seine Größe nicht in sich.** Dieselbe Aufnahme ist an einer
Materialzeile ein Symbol und in einer Anleitung eine ganze Seite. Die Größe
gehört deshalb an die **Stelle**, nicht an die Datei.

```
[ {k: '<kennung>', g: 'klein'|'mittel'|'gross'}, … ]
```

Die alte flache Liste `['<kennung>', …]` wird weiter gelesen und bekommt die
Vorgabegröße. **Kein Migrationslauf, kein Datenverlust** — und genau das prüfen
sechs Tests, weil ein Fehler an dieser Stelle Bilder wortlos verschwinden
ließe.

Die Wörter „klein/mittel/groß" stehen in `data/bezeichnungen.json` → Zweig
`mediengroessen`.

### Antippen macht groß — überall dieselbe Regel

Jedes Bild trägt `data-zoom`; ein zentraler Klick-Melder öffnet die
Großansicht. Das gilt auch für das **Produktfoto** an einer Materialzeile.
Sonst müsste man sich merken, welches Bild sich vergrößern lässt und welches
nicht.

Die Großansicht zeigt zwei Dinge: die **Bildunterschrift** oben und die
**Angaben zum Bild** unter dem Bild. Fehlen Angaben, verschwindet die Fläche
ganz — ein leerer Kasten sähe aus wie ein Ladefehler.

### Bewusst nicht

* **Keine Pflichtplätze.** Ausdrücklich verworfen (siehe oben).
* **Keine Vorgaben zu Dateigröße** — der Speicher normiert bereits.
* **Kein Video.** GIF ist gedeckt; Video ist ein anderer Speicher.

---

## K2 · Eigenschaften an Standards — „sedierungspflichtig"

### Befund

Ein Standard hat heute: `titel`, `gruppe`, und in `STDE[id]` Version, Zustand,
Gültigkeit. Die Merkmalsleiste der Übersicht (`features/facetten.js`) leitet
ihre Merkmale aus dem **Titel** ab — Zerlegung am Bindestrich, Abgleich gegen
die Herstellerliste, Rest nach Position („Art", „Ausprägung").

Es gibt also **kein Feld**, in das „sedierungspflichtig" gehören würde. Der
Versuch am MitraClip-Standard konnte deshalb gar nicht so werden, wie er
werden sollte: Er musste eine vorhandene Fläche zweckentfremden.

### Stand der Technik

Der Wunsch ist ausdrücklich **kein neuer Kategorienbaum** („nicht CRM, EPU als
Kategorie"), und das ist fachlich genau richtig. Die Wissensorganisation
unterscheidet dafür seit langem zwei Bauformen: die **Hierarchie** ordnet ein
Ding an genau einen Platz; die **Facette** beschreibt es aus einer Achse, und
ein Ding trägt beliebig viele Facetten
([Hedden, Faceted Classification](https://www.hedden-information.com/faceted-classification-and-faceted-taxonomies/),
[Hierarchies and Attributes](https://www.hedden-information.com/hierarchies-and-attributes-in-taxonomies/)).
Ein Eingriff ist gleichzeitig sedierungspflichtig, Rechtsherz, Implantat und
Rufbereitschaft — das kann keine Hierarchie abbilden, ohne zu zerfallen.

Facetten sind flacher, einfacher zu pflegen und **jede einzeln such- und
filterbar**, weil jede ein eigenes Feld im Datensatz ist. Genau das braucht
die geforderte Statistik.

### Zielbild

Zwei kleine Speicher — die **Definition** und die **Vergabe**:

```
hkl_eigenschaften = [ { key, wort, symbol, farbe, art, werte[], zeigen,
                        reihenfolge } ]
hkl_stdeigen      = { stdId: { key: true | 'Wert' } }
```

* `art`: `ja` (Ja/Nein — der Normalfall), `wert` (freie Angabe, z. B.
  „Vorbereitungszeit: 45 min"), `auswahl` (aus einer gepflegten Liste, z. B.
  „Zugang: radial · femoral"). Drei Arten reichen; mehr wäre Formularbau,
  und den pflegt niemand.
* `zeigen`: `kopf` (erscheint oben am Standard und als Facette) oder `still`
  (nur intern, z. B. für Listen).

Diese Bauform ist in der App **nicht neu** — `NATCFG` (Kategorien) und
`MATPROPS` (eigene Materialeigenschaften) sind genau so gebaut. Das dritte
Vorkommen desselben Musters ist ein gutes Zeichen, keine Erfindung.

### Wo es erscheint

1. **Am Standardkopf**, unter dem Titel: eine Reihe Chips
   „💤 sedierungspflichtig · ⏱ 45 min". Das ist die Antwort auf „was der
   Standard so alles beinhaltet — das soll quasi oben".
2. **In der Merkmalsleiste der Übersicht**: Jede Eigenschaft mit
   `zeigen:'kopf'` wird automatisch eine Facette. `FAC_ARTEN` ist bereits eine
   Liste; die Haus-Eigenschaften werden angehängt. Damit lässt sich die
   Übersicht nach „sedierungspflichtig" einschränken.
   *Bemerkenswert:* Diese Facetten sind **verlässlicher** als die vorhandenen,
   weil sie aus gepflegten Daten kommen und nicht aus einer Titelzerlegung.
   Sie können die Titel-Facetten mittelfristig ablösen — das muss heute nicht
   entschieden werden.
3. **Im PDF-Kopf** (`features/pdfprint.js`): Was oben am Bildschirm steht,
   gehört auch auf den Ausdruck.

### Listen und Statistik

Eine Verwaltungs-Karte **„📊 Eigenschaften"**: je Eigenschaft die Zahl, ein
Tipp öffnet die Liste der Standards. Kein Auswertungssystem — eine Filterzeile.

**Ehrlich zählen heißt: „ohne Angabe" mitzählen.**

```
💤 sedierungspflichtig   12 ja · 3 ausdrücklich nein · 32 ohne Angabe
```

„12 von 47" wäre eine Lüge, solange 32 Standards nie gefragt wurden. Das ist
Grundsatz ① in Zahlenform.

### Sammeländerung — die eigentliche Neuerung

„Alle sedierungspflichtigen Eingriffe gleichzeitig ändern können" verlangt eine
**neue Reichweite** in der bestehenden Kaskade:

```
🏷 alle mit Eigenschaft „sedierungspflichtig"
   → wo: { art:'eigenschaft', wert:'sedierungspflichtig' }
   → Rang 2, gleichauf mit 🗂 Gruppe
```

Gleicher Rang wie Gruppe, weil beides dasselbe ist: **eine Menge von
Standards**. Bei Gleichstand gewinnt die neuere Regel — das steht schon in
`ruleBeats()`. Es ist also **kein neuer Mechanismus**, sondern ein neuer Fall
in `ruleCandidates()` und `ruleHits()`. Dass das so klein ausfällt, ist der
nachträgliche Beweis, dass die Kaskade richtig gebaut wurde.

Dasselbe gilt für Rubriken-Vorlagen: `RUBTPL.scope` kennt heute `std` ·
`groups` · `all`; dazu kommt `eigenschaft`. Erst damit trägt die Eigenschaft
wirklich — man definiert „sedierungspflichtig" einmal, und die
Sedierungs-Rubrik erscheint in allen betroffenen Standards von selbst.

### Sicherheit bei Sammeländerungen

Der Stand der Technik für Massenänderungen ist eindeutig: **Vorschau vor der
Ausführung, Rücknahme danach** — ein Review-Schritt, der die Treffer zeigt,
bevor bestätigt wird
([data.world, bulk editing mit gespeicherten Filtern](https://docs.data.world/en/321939-bulk-editing-resources-using-saved-search-filters.html)).
Beides ist vorhanden: Treffervorschau (`ruleHits`) und das Journal
`🧾 Regeln & Journal` mit Ein-Tipp-Rücknahme. Die neue Reichweite erbt es
geschenkt.

### Bewusst nicht

* **Kein Baum.** Eigenschaften bleiben flach und mehrfach vergebbar. Wer
  gruppieren will, gibt ihnen eine Reihenfolge.
* **Keine abgeleiteten Eigenschaften.** „Sedierungspflichtig, weil ein
  Perfusor in der Materialliste steht" wäre klug und wäre falsch: Die
  Maschine würde damit eine fachliche Aussage treffen. Der Mensch setzt das
  Merkmal.
* **Keine Pflicht.** Ein Standard ohne Eigenschaften ist vollständig gültig.

---

## K3 · Reichweite je Feld — die kleinste und dringendste Änderung

### Begriffsklärung zuerst

Der Wunsch lautet: „für jede einzelne Rubrik, die in diesem Material vorhanden
ist". Gemeint ist nicht die Rubrik des Standards (Material/Ablauf), sondern
der **Abschnitt der Bearbeiten-Maske**: Bezeichnung · Menge · Kategorie ·
Größen · Unterkategorie · Spezifikation · Warum · Synonyme · Farbe. Dieses
Papier nennt sie **Felder**. Ohne diese Klarstellung redet man aneinander
vorbei.

### Befund

`public/js/ui/forms.js`:

* `entryScopeBarHTML(cid, mk)` zeigt **eine** Auswahl oben in der Maske.
* `entryFormChanges(cid, f)` liefert bereits eine **Liste** `[{prop, value}]`.
* `applyEditScope(scope)` schreibt sie alle mit **demselben** `wo`:
  `p.changes.forEach(c => addRule(ziel, wo, c.prop, c.value))`.

Der Befund ist damit exakt der beschriebene: Wer den Namen nur hier, die Größe
aber überall ändern will, muss zweimal speichern — und das weiß niemand.

### Stand der Technik

Feingranulare Vererbung ist ein gelöstes, aber nicht gratis zu habendes
Problem. In der Mehrfach-Site-Verwaltung von Adobe Experience Manager lässt
sich die Vererbung **je Feld** brechen; damit das beherrschbar bleibt, trägt
jedes Feld im Dialog ein sichtbares **Schloss** (`cq-msm-lockable`), das
anzeigt, ob es noch erbt
([Adobe, Manage Live Copy Inheritance](https://experienceleague.adobe.com/en/docs/experience-manager-learn/sites/multi-site-management/manage-component-inheritance-live-copy),
[Bounteous, MSM Inheritance](https://www.bounteous.com/insights/2022/11/21/multi-site-management-inheritance-adobe-experience-manager/)).

Die Lehre daraus ist nicht „geht" oder „geht nicht", sondern: **Feld-Reichweite
ohne sichtbares Zeichen am Feld ist ein Labyrinth.** Wer sie einführt, muss
gleichzeitig zeigen, wo sie greift.

### Zielbild

Die Änderung an der Logik ist eine Zeile:

```js
p.changes.forEach(c => addRule(ziel, c.wo || woVorgabe, c.prop, c.value));
```

Die ganze Arbeit liegt in der Bedienung — und dort gilt: **Der Normalfall darf
nicht teurer werden.**

* Die Leiste oben bleibt und ist die **Voreinstellung für alle Felder**
  („🎯 Gilt für: 📍 nur hier"). Wer nichts weiter tut, arbeitet wie heute.
* **Nur geänderte Felder** bekommen einen Reichweiten-Chip, und zwar erst,
  *nachdem* sie geändert wurden. Ein unangetastetes Feld zeigt nichts —
  sonst wäre die Maske ein Schaltpult.
* Der Chip zeigt die geltende Stufe (`📍`) und öffnet auf Tippen die vier (bald
  fünf) Stufen **mit Treffervorschau**.
* Weicht ein Feld von der Voreinstellung ab, trägt es ein deutliches Zeichen —
  das ist das Schloss aus der Recherche.
* Vor dem Speichern eine **Zusammenfassung**:

  ```
  Bezeichnung  → 📍 nur hier
  Größen       → 🌐 überall (23 Stellen in 9 Standards)
  ```

  Bei gemischten Reichweiten ist dieser Schritt nicht optional.
* Weite Reichweiten werden **einmal für den ganzen Vorgang** bestätigt, nicht
  je Feld. Und die Bestätigung ist eine Karte, kein `confirm()` — heute steht
  in `applyEditScope()` noch ein natives Fenster (Grundsatz ⑧, Altlastenliste).

### Warum das verantwortbar ist

Weil die Nachvollziehbarkeit schon steht: `openWhySheet()` („🔍 Warum so?")
zeigt die volle Kaskade **je Eigenschaft** — Gewinner oben, Überstimmtes
durchgestrichen, mit Urheber, Datum und Rücknahme. Ohne diesen Inspektor wäre
Feld-Reichweite unverantwortlich. Mit ihm ist sie der nächste logische Schritt.

### Ausbaustufe 2 (später, nicht jetzt)

Ändert man ein Feld, für das bereits eine weitreichende Regel gilt, ist die
richtige Frage nicht „wo soll das gelten?", sondern:

> „Für dieses Material gilt überall ‚6 F'. Die **bestehende Regel ändern**
> oder **hier eine Ausnahme** machen?"

Das ist die ehrlichere Frage — aber sie setzt voraus, dass Stufe 1 steht.

---

## K4 · Material ohne 🔗 — die Naht wegkonstruieren

### Was hier schiefgelaufen ist

Die 🔗-Verknüpfung ist kein missglücktes Symbol. Sie ist eine
**Datenmodell-Entscheidung, die in die Oberfläche durchgeschlagen ist.**

Dass „Vorkommen im Standard" und „Stammsatz" intern zwei Dinge sind, ist eine
Implementierungsfrage. Daraus wurden aber gemacht: ein Menüpunkt
(`S.akt('verknuepfen','🔗',…)`), ein Zustand („verknüpft"/„nicht verknüpft"),
ein Badge am Eintrag (`entry-canon-btn`), ein Zähler („x gepflegt",
`ui/nav.js`), ein Statusfeld (`matHubRows` → `linked`/`part`/`open`) und ein
eigenes Verwaltungspanel („Materialzusammenführung"). An sieben Stellen sieht
man die **Naht**, an der die App zusammengeklebt ist. „Das Material soll sich
nicht anfühlen wie so'n klobiges Etwas" beschreibt genau diese Naht.

### Zielbild, in einem Satz

**Ein Material ist ein Material.** Es gibt genau eine Materialkarte, sie ist
von jedem Standard aus dieselbe, und es existiert kein Zustand, in dem sie
„noch nicht verbunden" wäre.

### Warum das ohne Datenverlust geht — die Antwort steht schon im Bestand

`public/js/features/matkey.js` ist bereits die Lösung, sie wurde nur nicht zu
Ende gegangen:

* `effMatKey(e, cid)` liefert **für jede Zeile** einen kanonischen Schlüssel:
  bestätigte Zerlegung → Produktkern; sonst der alte `material_key`.
* `matKeyLesen(store, kanonisch)` liest **jeden** Alt-Speicher über den
  kanonischen Schlüssel *und* alle Alt-Schreibweisen.

Das heißt: **Die Identität existiert bereits, ohne dass ein Mensch etwas
verknüpft hat.** „hämostaseventil map 152" und „hämostaseventil map152" sind
schon heute ein Material.

Was `MATLINK` zusätzlich leistet, ist nur die Aussage „diese Zeile meint dieses
Etikett-Produkt (GTIN)". Und das ist eine **Eigenschaft des Materials**
(„welche GTIN hat es"), keine Beziehung, die ein Mensch stiften muss.

### Der Umbau in drei Sätzen

1. **Jede Materialzeile hat immer einen Stammsatz** — den zu ihrem kanonischen
   Schlüssel. Existiert noch keiner, entsteht er beim ersten Öffnen still.
   (`openMaterial()` tut das heute fast schon: Es bereitet einen transienten
   Stammsatz vor und legt ihn erst beim Speichern an.) Es gibt kein „noch
   nicht verknüpft" mehr.
2. **`MATLINK` bleibt** — als Index, nicht als Bedienkonzept. Bedient von
   `canonId(kanonischerSchlüssel)`, und niemand sieht es je. Nicht löschen:
   Grundsatz ⑦, und die vorhandenen Verknüpfungen sind echte Arbeit.
3. **Ein gescannter Barcode ist ein Feld** dieses Materials, kein zweites
   Objekt, an das man sich hängt.

### Was aus der Oberfläche verschwindet

| Heute | Künftig |
|---|---|
| ⋯ → „🔗 Mit Produkt verknüpfen" (`renderSheetLink`, `matLinkPick`, `matLinkClear`) | ⋯ → **„🧬 Material öffnen"** (`matManage()`, existiert bereits) |
| 🔗-Badge am Eintrag (`entry-canon-btn`) | Produktname ohne Kettensymbol — oder gar nichts, weil Foto und Maße ohnehin vom Material kommen |
| „x gepflegt"-Zähler (`ui/nav.js`) | Zähler über **offene Angaben** (kein Foto, kein Lagerort) — das ist die Arbeit, die wirklich wartet |
| Status `linked` · `part` · `open` (`matHubRows`) | nur noch **gepflegt / unvollständig** |
| Panel „Materialzusammenführung" | Liste **„Doppelt geführt?"** (siehe unten) |

### Zusammenführen: automatisch nur, wo es sicher ist

Der Stand der Technik in der Dublettenauflösung ist eine klare Zweiteilung:
sehr hohe Sicherheit (0,95–1,00) wird automatisch zusammengeführt, alles im
Mittelfeld geht in eine **Prüfliste** für einen Menschen, und die Entscheidung
des Menschen wird gemerkt
([Auto-Merge Confidence Thresholds](https://getclaro.ai/resources/playbooks/confidence-thresholds-auto-merge/),
[Plauti, False Positives reduzieren](https://www.plauti.com/blog/how-to-reduce-false-positives-in-dedupe-matching-without-losing-real-duplicates)).
Auf diese App übersetzt:

* **Automatisch, still:** gleicher kanonischer Schlüssel oder gleiche GTIN.
  Das ist per Definition dasselbe Ding, kein Ermessen.
* **Prüfliste:** Namensähnlichkeit. `matDubletten(list, 0.88)` findet das
  bereits (64 Beinah-Paare im Bestand). Was fehlt, ist die **Deutung**: Das ist
  kein „Vorschlag zur Verknüpfung", sondern die Frage „hier stehen zwei Karten
  für ein Ding — stimmt das?".
* **Nie automatisch** bei Ähnlichkeit. „Navitor 23" und „Navitor 25" sehen
  aus wie ein Tippfehler und sind zwei Produkte.
* **„Ist verschieden" wird gemerkt** (`hkl_nichtgleich`). Ohne dieses
  Gedächtnis fragt die Liste jeden Monat dasselbe — und an diesem Punkt
  sterben solche Listen.
* **Jede Zusammenführung ist trennbar** und steht im Journal. Ein
  „eindeutiges Materialkontingent" ist erreichbar, aber nur mit einer
  Trennfunktion; sonst ist der erste Fehlgriff dauerhaft.

### Was sichtbar bleiben muss

Die **Herkunft eines Werts**. Wenn die Maße vom Material kommen und nicht aus
dem Standard, muss das dranstehen („kommt vom Material") — sonst sucht jemand
die Zahl an der falschen Stelle. `productLinkedBlockHTML()` macht das schon
halb.

Das ist der Unterschied zwischen *Naht verstecken* und *Naht
wegkonstruieren*: Die **Beziehung** verschwindet aus der Bedienung, die
**Herkunft** eines Wertes bleibt ablesbar.

### Reihenfolge

1. **Oberfläche entflechten** (Menüpunkt, Badge, Zähler, Status) — sofort
   spürbar, ohne Datenrisiko. **Gebaut.**
2. Stillschweigender Stammsatz beim ersten Öffnen. *(`openMaterial()` legt ihn
   bereits an; der Sonderfall „noch nicht verknüpft" ist damit aus der
   Bedienung verschwunden.)*
2b. **Der geschlossene Pflege-Weg** — die Klammer um Aufräum-Assistent,
   Material-Editor, Etikett-Erfassung und Foto. **Gebaut** (siehe unten).
3. Automatische Zusammenführung bei exakter Kennung + Prüfliste + Trennung.
   **Offen.**

### Was Schritt 1 konkret geändert hat

| Vorher | Jetzt |
|---|---|
| ⋯ → „🔗 Mit Produkt verknüpfen" / „Verknüpft: X" | ⋯ → **„🧬 Material öffnen"** — ein Punkt, kein Zustand. Der Untertitel sagt, was fehlt: *„es fehlt: Foto und Lagerort"* |
| 🔗-Badge an jeder zugeordneten Zeile | Produktname **ohne Kettensymbol**, und nur wenn er vom Zeilentext abweicht |
| „x gepflegt" (= x verknüpft) | **„x unvollständig"** — die Arbeit, die wirklich wartet |
| Status `Stammsatz` · `teilgepflegt` · `offen` | `gepflegt` · `unvollständig` · `noch nichts hinterlegt` |

`MATLINK` bleibt unverändert bestehen — als Index, nicht als Bedienkonzept.
Grundsatz ⑦, und die vorhandenen Verknüpfungen sind echte Arbeit.

### Schritt 2: der geschlossene Pflege-Weg — **gebaut**

> „Ich möchte systematisch durch alle Materialien gehen, während ich die App
> benutze … die Materialien aufbereiten und bereinigen … gleichzeitig die
> Felder richtig befüllen und Etiketten scannen, ein Bild vom Produkt machen.
> Das muss alles kohärent, reibungslos ineinandergreifen."

Die Bausteine standen alle — der Aufräum-Assistent (Zerlegung), der
Etikett-Scanner, der Material-Editor, die Dublettenliste. Sie lagen nur an
vier Orten, und keiner wusste vom anderen. `features/pflege.js` ist die
**Klammer**. Sie baut kein Werkzeug neu; sie führt sie in einer Abfolge vor
und bringt jedes an die Stelle zurück, an der man war.

**① Die Einheit ist das Material, nicht die Zeile und nicht der Text.**
„Radialschleuse 6F" steht mehrfach im Bestand, hinter verschiedenen Sätzen aus
der Vorlage — das ist EIN Material, das EINMAL gepflegt wird. Gruppiert wird
nach dem kanonischen Schlüssel (`effMatKey`, K4/Schritt 1); im echten Bestand
werden aus 4.475 Zeilen **334 Materialien**, von denen 184 mehr als einmal
vorkommen und 63 hinter mehreren Wortlauten stehen. Der Aufräum-Assistent
arbeitet weiterhin an TEXTEN — deshalb ist er der *erste Schritt eines
Materials* und kein Weg daneben.

**② Was erledigt ist, wird abgelesen, nicht abgehakt.** Ob ein Foto da ist,
weiß der Stammsatz. Ein zweiter, von Hand gepflegter Haken daneben würde
irgendwann etwas anderes behaupten als die Daten (Grundsatz ⑨). Gespeichert
wird nur, was sich nicht ablesen lässt: die Entscheidung eines Menschen, dass
ein Schritt für dieses Material **entfällt** („diese Kompresse hat keine REF"),
die Haken *eigener* Schritte, und „von Hand abgeschlossen".

**③ Die Schritte sind eine Liste, kein Ablauf im Quelltext.** Ausgeliefert
werden acht — Text aufräumen · Produktname · Etikett (Hersteller & REF) ·
Produktfoto · Kategorie · Lagerort · Bereich · Stückpreis. Jeder lässt sich
umbenennen, verschieben, ausblenden; eigene kommen als Handhaken dazu
(„im Lagersystem angelegt"). Der Code kennt nur die PRÜFUNG hinter einem
Schritt — Wort, Reihenfolge und Ob stehen in der Einstellung (Grundsatz ⑤/A7).
Dieselbe Bauart wie der Standardkopf (K6) und das Funktionsregister.

**Die Kette, die halten muss.** Ein Schritt öffnet das Werkzeug *aufgeschlagen
an der richtigen Stelle* (der Foto-Schritt scrollt zur Galerie, der
Lagerort-Schritt zum Feld). Der Aufräum-Assistent wird dabei auf **genau
diesen einen Text** eingeengt — ohne das landete man in der allgemeinen
Warteschlange und verlöre das Material, das man vor sich hatte. Nach dem
Speichern steht der Weg wieder da: dasselbe Material, eine Lücke weniger.

Einstiege: ⋯ an der Zeile („Pflege-Weg ab hier" — beginnt bei genau diesem
Material, Umfang = dieser Standard), ⋯ am Standard („für diesen Standard"),
und die Materialzentrale (ganzer Bestand). Damit gilt buchstäblich „während
ich die App benutze".

**Ein Fund nebenbei:** `openMaterial()` hielt in seinem Neuanlage-Zweig die
Herkunft nicht fest. Aus der Materialzentrale fiel das nie auf, weil deren
Vorgabe zufällig richtig war — aus dem Pflege-Weg heraus hätte man nach dem
Speichern in der Produktliste gestanden. Der E2E-Prüfpunkt „der Editor weiß,
dass er aus dem Pflege-Weg kommt" hat es gefunden.

### Was noch fehlt (K4, Schritt 3)

Automatische Zusammenführung bei exakter Kennung (GTIN/REF) plus Prüfliste und
Trennmöglichkeit. Die Dublettenliste entscheidet heute Paar für Paar von Hand;
das ist richtig, wo nur der Name spricht — bei gleicher GTIN ist es Arbeit,
die niemand leisten müsste.

---

## K5 · Bausteine kuratiert — der Mensch sammelt

### Befund

`features/bausteine.js` sucht mit n-Grammen über den ganzen Bestand nach
zusammenhängenden Zeilenfolgen, die in mindestens drei Standards gleich
vorkommen (`BAU_MIN_STANDARDS = 3`), und bietet bis zu zwölf davon als
Vorschlag an (`bauVorschlaege()`, `bauKandCache`). Ein Baustein ist damit eine
**gefundene Folge von Materialzeilen**.

### Zwei verschiedene Werkzeuge, ein Name

Das muss dieses Konzept klar aussprechen, sonst wird das Falsche gebaut:

| | heute | gewünscht |
|---|---|---|
| **Was ist ein Baustein?** | eine Folge, die im Bestand **schon vielfach steht** | eine **Sammelmappe**, die ein Mensch füllt |
| **Wozu?** | gleich halten, Abweichungen finden | **wiederverwenden** beim Schreiben |
| **Wer bestimmt?** | die Maschine schlägt vor | der Mensch kennt seine Bausteine |
| **Inhalt** | nur Zeilenfolgen | auch **Textbausteine** |

Beide Werkzeuge sind berechtigt. Aber gefragt ist das zweite, und es ist heute
nicht vorhanden.

### Stand der Technik

Die strukturierte Redaktion (DITA) kennt beide Wege und ist in der Empfehlung
eindeutig: Man legt eine **kuratierte Sammlung** an, in die bewusst
hineingelegt wird, was wiederverwendet werden soll („warehouse topic"), und man
verweist auf **ganze, für sich sinnvolle Einheiten** — nicht auf Fragmente,
weil der Kontext sonst verlorengeht
([Oxygen, Reusing DITA Content](https://www.oxygenxml.com/doc/ug-editor/topics/eppo-pathfinder-reuse.html),
[Heretto, Content Reuse Strategy](https://www.heretto.com/blog/reuse-structured-content)).
Das stützt den Wunsch, nicht die bisherige Bauform.

### Zielbild

**Die Vorschlagsmaschine kommt aus der Bedienung weg.** Nicht „ausblendbar" —
weg. Die reinen Funktionen (`bauFolgen`, `bauKandidaten`) dürfen als Werkzeug
im Hintergrund bleiben, aber sie erscheinen nirgends von allein.

```
hkl_bausteine     = [ { id, name, kats:[katKey], art:'folge'|'text',
                        zeilen:[…], text?, schluessel?, gleichhalten } ]
hkl_bausteinkats  = [ { key, wort, symbol, reihenfolge } ]
hkl_bausammlung   = [ cid, … ]        ← die offene Sammelmappe
```

* **`kats` ist mehrfach.** Ein Baustein kann „EPU" *und* „Saalvorbereitung"
  sein. Wieder Facetten statt Baum — dieselbe Entscheidung wie in K2, und
  dass sie zweimal unabhängig richtig herauskommt, ist ein gutes Zeichen.
  Die Kategorien pflegt das Haus: CRM · EPU · sedierungspflichtige Prozeduren ·
  Patientenvorbereitung · Tischvorbereitung · Saalvorbereitung · …
* **`art:'text'` ist neu.** Ein Textbaustein hat einen Text statt einer
  Zeilenliste und wird eingefügt: als Eintrag, als Hinweis oder ins
  „Warum"-Feld.

### Die ehrliche Abgrenzung

**Nur Folgen können gleichgehalten werden, Texte nicht.** Ein Textbaustein hat
keinen `schluessel` und damit keine Fundstellen — er wird eingefügt und ist
danach normaler Inhalt.

Das ist keine Bequemlichkeit, sondern die Konsequenz aus K4: Wollte man auch
Texte gleichhalten, bräuchte man einen dauerhaften Verweis vom Text zu seiner
Quelle — und damit hätte man das 🔗 an einer neuen Stelle wieder eingebaut.
Genau der Fehler, der in K4 abgeräumt wird, darf hier nicht neu entstehen.

### Rubrikgebunden — der eigentliche Zeitgewinn

Der Betreiber hat hier präzisiert, und es ist der wichtigste Zusatz:

> „Da, wo ich die Bausteine markiere, wo sie ursprünglich herkommen — also
> Saal und Geräte oder Patient — da möchte ich die auch automatisch einsortiert
> haben, dass ich beim Erstellen eines neuen Standards direkt in Saal und
> Geräte gehe und da alle Bausteine finde und nur per Checkbox sage: das
> möchte ich haben."

Ein Baustein merkt sich deshalb seine **Heimatrubrik** — automatisch, aus den
Stellen, aus denen er gesammelt wurde. Genauer: aus der Rubrik, aus der die
**meisten** seiner Zeilen stammen. Wer versehentlich eine Zeile aus einer
anderen Rubrik mitnimmt, findet den Baustein trotzdem dort, wo er hingehört.

In der Rubrik selbst steht dann ein Knopf **„🧱 Bausteine einfügen"**: oben die
Bausteine *dieser* Rubrik, darunter die aus anderen. Ankreuzen, einfügen,
fertig. Statt einer flachen Liste über alles.

**Und beim ANLEGEN eines Standards** — der Satz, um den es dem Betreiber ging
— stehen sie im Formular „Neuer Standard" selbst, nach Heimatrubrik gruppiert
und nach Kategorie filterbar (CRM · EPU · …). Angekreuzt landet jeder in
seiner Heimatrubrik. Fehlt sie im frischen Standard, **entsteht sie**: Ein
Baustein aus „Patientenvorbereitung" bekommt seine Rubrik, mit der Art, die
aus seinen Zeilen abgelesen ist. Die Alternative — alles in eine vorhandene
Rubrik kippen — wäre schneller programmiert und für den, der den Standard
später liest, eine Zumutung. Die Rückmeldung nennt Zahlen und den neuen
Rubriknamen, damit er nicht wie ein Versehen aussieht.

### Das Sammeln

Der vorgeschlagene Weg ist der richtige, und er passt in die vorhandene
Bedienung:

1. Im ⋯-Menü eines Eintrags: **„＋ In Baustein übernehmen"**. Die Zeile geht in
   die **Sammelmappe** — nicht sofort in einen Baustein, denn bei der ersten
   Zeile weiß man den Namen noch nicht.
2. Mehrere Zeilen nacheinander sammeln; in der Kopfleiste ein Zähler
   „🧺 5 gesammelt", der die Mappe öffnet.
3. Einmal am Ende: **„Aus 5 gesammelten Zeilen einen Baustein machen"** →
   Name, Kategorien, fertig.
4. Für Text: dieselbe Aktion an einem Fließtext oder Hinweis.
5. Der Langdruck bleibt die Abkürzung zum ⋯-Menü — er bekommt keine eigene,
   zweite Bedeutung.

### „Ankreuzen statt Abtippen" — gebaut, und größer als geplant

Geplant war Mehrfachauswahl in einer Rubrik. Beim Bauen zeigte sich, dass es
dafür bereits einen halben Weg gab: „⬇ Aus Katalog übernehmen" — eine Position
pro Tipp, und nur aus dem Katalog, also dem kleinsten der vorhandenen Töpfe.
Zwei Wege für dieselbe Absicht nebeneinander stehen zu lassen wäre die
teurere Entscheidung gewesen; der alte ist **ersatzlos entfernt**.

Der neue (`features/ankreuzen.js`) zieht aus dem BESTAND, passend zur Sorte
der Rubrik:

| Rubrik | zur Auswahl |
|---|---|
| Material · Geräte | der **kanonische** Materialbestand — 334 Zeilen aus 4.475, jedes Material genau einmal — plus die Katalog-Positionen, die es dort noch nicht gibt |
| Ablauf · Sonstiges | die Handgriffe der Ablauf-Rubriken, über `bauSlug` zusammengefasst (145 Zeilen); „Time-out" und „Time out" sind einer |

Sortiert nach **Häufigkeit**: Was im Haus oft vorkommt, wird auch hier meistens
gesucht (oben steht „500ml NaCl-Flasche", 53×). Angekreuztes bleibt sichtbar,
auch wenn die Suche es gerade ausschließt — sonst kreuzt man an, tippt weiter
und glaubt, es sei weg.

Der eigentliche Gewinn ist nicht die Zeit, sondern die **Schreibweise**:
„Radialschleuse 6 F" neben „Radialschleuse 6F" ist der Anfang genau der
Dublettenarbeit, die anderswo mühsam aufgeräumt wird. Ein angekreuzter Eintrag
trägt denselben Namen wie sein Vorbild und damit denselben Materialschlüssel —
Foto, Maße und Preis hängen sofort dran, ohne dass jemand etwas verknüpfen
müsste.

### Die Bibliothek

Der Bildschirm „Bausteine" bekommt oben die **Kategorie-Chips** aus
`hkl_bausteinkats` statt der Vorschlagsliste unten. Einfügen bleibt wie heute
(`bauEinfuegen()` → eigene Ergänzungen, Basisdaten unberührt).

**`gleichhalten` ist voreingestellt AUS.** Ein kuratierter Baustein, den man
irgendwo eingefügt hat, ist danach eine Kopie und darf abweichen. Erst wenn
jemand ausdrücklich sagt „das soll überall gleich sein", läuft
`bauAbweichungen()` dafür. Sonst würde ein Baustein, den man nur zum Befüllen
benutzt hat, still die Standards fernsteuern.

### Bewusst nicht

* **Kein automatischer Vorschlag** — auch nicht „dezent unten".
* **Keine Verweis-Textbausteine** (siehe Abgrenzung oben).
* **Kein Zwang zur Kategorie.** Ein Baustein ohne Kategorie ist gültig; er
  landet unter „ohne Zuordnung".

---

## K6 · Der Standardkopf als Bauplan

### Befund

Was oben in einem Standard steht, war eine feste Abfolge im Quelltext: erst die
Varianten-Leiste, dann der Freigabe-Kasten, dann der Verwaltungsbalken, dann
die Plankosten. Wer daran etwas ändern wollte — eine Zeile weg, eine andere
Reihenfolge, ein eigenes Wort — brauchte einen Entwickler. Genau das verbietet
A7.

### Zielbild

Der Kopf ist eine **Liste von Bausteinen**, jeder mit *an/aus · eigenes Wort ·
Reihenfolge*:

```
varianten · freigabe · eigenschaften · titel · beschreibung
bild · hinweis · zaehler · verwaltung · kosten
```

Gepflegt unter „🧱 Standardkopf". Die Bauart ist dieselbe wie beim
Funktionsregister — wer eines versteht, versteht auch das andere (Grundsatz ⑥).

**Nichts ist unabschaltbar.** Auch ein völlig leerer Kopf ist erlaubt: Der
Titel steht ohnehin in der Kopfleiste. Ein Baustein ohne Inhalt erzeugt kein
Markup — keine leere Fläche, die wie ein Fehler aussieht.

Neu dabei: eine freie **Beschreibung** am Standard (in `STDE`, also auch an
Standards aus der Quelldatei).

---

## K7 · Schrift und Auszeichnung

### Zwei Wünsche, die man nicht mit einem Werkzeug erschlägt

> „Ich möchte jede Textzeile oder jedes Wort im Standard, was seine
> Schriftgröße angeht, anpassen und auch, ob es fett oder normal ist."

**Eine Zeile** größer oder fetter zu machen ist eine Eigenschaft der Zeile —
wie Farbe oder Menge. Also läuft sie über dieselbe Kaskade: 📍 · 📄 · 🗂 · 🏷 ·
🌐. Wer die Warnzeile eines Materials überall groß haben will, tippt einmal.

**Ein Wort** im Satz hervorzuheben ist etwas anderes: Das Wort steckt im Text.
Hier hilft eine **Auszeichnung** — ein Zeichenpaar um das Wort:

```
**CAVE**   fett      __wichtig__   größer      ~nebensache~   kleiner
```

### Warum Zeichenpaare und kein Formatierungsknopf

Ein Formatierungsknopf braucht einen Editor mit Cursorposition, Auswahl und
Zwischenzustand. Im Saal wird auf einem Tablet mit Handschuhen getippt. Ein
Sternchen um ein Wort überlebt jedes Kopieren, jeden Export, jede Suche — und
ist im Zweifel immer noch lesbar. Das ist der belastbarere Weg.

**Welche Zeichen was bedeuten,** steht in `bezeichnungen.json` → Zweig
`auszeichnungen` und ist änderbar. Der Code kennt nur die Regel „Zeichen auf,
Text, Zeichen zu".

### Sicherheit vor Bequemlichkeit

Ausgezeichnet wird **immer auf dem bereits entschärften Text**: erst `esc()`,
dann die Zeichenpaare — und die Zeichen selbst gehen ebenfalls durch `esc()`,
sonst fände ein Zeichenpaar wie `<<…>>` nie etwas. Ein Text aus einer
Word-Datei darf niemals Markup werden, nur weil er zufällig eine spitze
Klammer enthält. Drei Tests sichern genau das.

Eine Auszeichnung reicht **nie über eine Zeile hinweg**: Ein vergessenes
Zeichen darf nicht den halben Standard fetten.

---

## K8 · Bereiche — die zweite Sicht aufs Material

> „Die Standards sind schon so geschrieben, dass es quasi eine Rüstliste ist.
> Ich möchte aber differenzieren können nach: das ist Material für den sterilen
> Tisch, und das ist Material, was du so drumherum brauchst."

Das ist eine **zweite Achse**, keine weitere Kategorie. Die vorhandenen Achsen
sind vergeben:

| Achse | Frage | Beispiel |
|---|---|---|
| `natur` | **Was** ist es? | Material · Gerät · Handgriff |
| `unterkategorie` | **Wo** im Standard? | „Material auf Ansage" |
| `bereich` *(neu)* | **Wohin** kommt es? | steriler Tisch · Umfeld |

Alle drei gelten gleichzeitig. Ein 6F-Schleusenset ist Material, steht unter
„Zugang" und gehört auf den sterilen Tisch. Wer das in eine Achse presst,
verliert zwei Informationen.

Der Bereich läuft über **dieselbe Kaskade** wie alles andere. Wer einmal sagt
„Kompressen gehören überall auf den sterilen Tisch", hat es an allen 60 Stellen
gesagt.

In der **Rüstliste** gibt es dadurch einen Umschalter: *Nach Ablauf* (wie
bisher) oder *Nach Bereich*. Der Umschalter erscheint nur, wenn das Haus
überhaupt Bereiche pflegt — sonst wäre es ein Knopf, hinter dem nichts steht.

**Ausgeliefert wird bewusst nichts.** Ein Haus, das mit „steriler Tisch"
nichts anfangen kann, soll nicht erst etwas wegräumen müssen.

---

## K9 · Alternativen — zwei Dinge, die gleich klingen

### ① Austauschgruppen (Material)

> „Beim LAA gibt es eine Merit-Medical-Schleuse, die soll standardmäßig genutzt
> werden. Wenn die nicht da ist oder es ein schwerer Fall ist, gibt es auch
> eine Schwartz SL1 von Abbott."

Eine Gruppe ist eine **geordnete Liste** von Materialien: Rang 1 ist der
Standard, Rang 2+ sind die Alternativen, jede mit ihrem Grund. Eine Gruppe
statt gerichteter Paare, weil es sonst bei drei Produkten sechs Beziehungen
wären — und weil die Frage „was nehme ich stattdessen" immer die ganze Gruppe
meint.

Angezeigt wird sie an **jedem** Glied, direkt an der Zeile:

```
⇄ oder Schwartz SL1        (an der Merit-Zeile)
⇄ Alternative zu Merit …   (an der Schwartz-Zeile)
```

**Keine Kategorie.** Eine Kategorie wäre eine Schublade, in die im Saal niemand
schaut. Das Material muss die Alternative selbst tragen.

Verknüpft wird über den **kanonischen Materialschlüssel** (`effMatKey`), damit
die Gruppe auch über verschiedene Schreibweisen desselben Produkts hinweg
greift.

### ② Verfahrenszweige (Ablauf)

> „Wenn wir eine AVNRT machen, gibt es die alternative Therapievariante, dass
> wir statt mit RF mit Kryo arbeiten."

Das ist kein Material, sondern ein **Zweig im Verfahren**: Ein ganzer Abschnitt
tritt an die Stelle eines anderen, mit eigenem Material und eigenem Ablauf.

Ein Zweig hängt deshalb an einem **Abschnitt**. Oben in der Rubrik steht ein
Umschalter; die Abschnitte der nicht gewählten Zweige verschwinden:

```
⑂ Ablationsverfahren    [alle]  [RF]  [Kryo]
```

Die Wahl ist **gerätelokal** — sie gilt für den Fall, der heute läuft, nicht
für den Standard und nicht für die Kollegin im anderen Saal.

**Ohne Wahl sind alle Zweige sichtbar.** Leer schlägt falsch: Wer nichts
entschieden hat, darf nicht die Hälfte des Standards verlieren.

---

## K10 · Fassung festschreiben

> „Da wir gesagt haben, dass die App die neue Wahrheit ist und die Word-Datei
> nicht mehr, möchte ich im Journal endgültige Änderungen festlegen können.
> Wenn ich sage, das ist endgültig, dann ist das der neue Ist-Zustand und dann
> kann man das auch nicht mehr rückgängig machen."

### Der Widerspruch, und warum er nötig ist

Das Ziel ist richtig. Die naheliegende Umsetzung — „Rücknahme löschen" — wäre
es nicht. Gebraucht wird keine gelöschte Rücknahme, sondern eine **neue
Grundlage**:

> Der aktuelle wirksame Stand eines Standards wird eingefroren und tritt an die
> Stelle der Quelldatei. Die Regeln, die dahin geführt haben, sind danach
> **eingearbeitet** — sie verschwinden aus der Liste und lassen sich einzeln
> nicht mehr zurücknehmen. Genau das ist gewollt.

Der Unterschied zur harten Variante: Die **ganze Fassung** bleibt
wiederherstellbar. Einzel-Rücknahme weg, Katastrophen-Rückweg bleibt. Ohne den
zweiten Teil wäre ein Fehlgriff dauerhaft — und Festschreiben ist genau die
Handlung, bei der man sich irrt, weil man sie selten macht.

### Wo die Fassung in der Kaskade steht

```
📍 Stelle  >  📄 Standard  >  🗂 Gruppe / 🏷 Merkmal  >  🌐 alle
                                                      >  📚 FASSUNG
                                                      >  Quelldatei
```

Neue Regeln wirken weiterhin ganz normal darüber. Die Fassung ersetzt nur, was
vorher die Datei sagte.

### Was eingefroren wird

Nur, was **von der Quelldatei abweicht** — sonst schleppte eine Fassung 4.475
unveränderte Werte mit und der geteilte Zustand ginge unnötig auf. Und nur die
**inhaltlichen** Felder: Häkchen und Ansichtseinstellungen sind kein Inhalt
eines Standards.

Vor dem Festschreiben steht eine Vorschau mit den echten Zahlen: *so viele
Stellen, so viele Angaben, so viele Regeln werden eingearbeitet.*

**Die Quelldatei wird nie angefasst** — Grundsatz ⑦ gilt weiter.

---

## Querschnitt

### Reihenfolge und Abhängigkeiten

```
GEBAUT (in dieser Reihenfolge)
K1  Bilder überall            Anker, Größe je Stelle, Großansicht mit Angaben
K2  Eigenschaften an Standards  Merkmale, Zählung, neue Reichweite 🏷
K6  Standardkopf als Bauplan
K3  Reichweite je Feld        Prüfblatt vor dem Speichern
K7  Schrift & Auszeichnung
K8  Bereiche                  zweite Sicht + zweite Sicht in der Rüstliste
K9  Alternativen              Austauschgruppen + Verfahrenszweige
K5  Bausteine kuratiert       Sammelmappe, Rubrikbindung, Kategorien
    · Ankreuzen                beim Anlegen eines Standards + je Rubrik
K10 Fassung festschreiben
K4  Material ohne 🔗          Schritt 1: Naht aus der Bedienung
    · Pflege-Weg              Schritt 2: die Klammer um die vier Werkzeuge

OFFEN
K4  Schritt 3                 automatische Zusammenführung bei gleicher
                              Kennung (GTIN/REF) + Prüfliste + Trennung
```

K3 muss nicht auf K2 warten: Die Kaskade nimmt eine neue `wo.art` an, ohne
dass die Maske davon wissen muss.

### Was die Maschine prüfen muss (Grundsatz ⑨)

| Ausbau | Prüfung |
|---|---|
| K1 | Jeder Platz-Schlüssel hat eine Bezeichnung · Kaskadenrang eindeutig · `medListe()` liest alte **und** neue Form |
| K2 | Eigenschafts-Schlüssel nie in einem Vergleich (deckt `pruefungen/fachwort.js` bereits ab) · `ruleHits()` kennt jede `wo.art` · der Zähler zählt „ohne Angabe" mit |
| K3 | Für jedes geänderte Feld genau **eine** Regel mit dessen eigener Reichweite · ein Feld mit eigener Reichweite benutzt nie die Voreinstellung |
| K4 | Kein 🔗 mehr in den Bedienflächen (Ratchet `pruefungen/kettensymbol.js`) · jede Zeile mit `material_key` liefert einen Stammsatz |
| K4/Pflege-Weg | Gruppierung nach dem kanonischen Schlüssel · „fertig" wird abgelesen, nie gespeichert · jede Kette endet wieder im Weg (E2E: Editor **und** Aufräum-Assistent) · ausgeblendeter Schritt fällt aus Anzeige **und** Rechnung |
| K5 | Keine Vorschlagsliste im Bildschirm · jeder Baustein hat Kategorien oder ausdrücklich keine |
| K5/Ankreuzen | Jedes Material steht genau EINMAL zur Auswahl · Material und Handgriffe werden nie vermischt · ein angekreuzter Eintrag trägt denselben Materialschlüssel wie sein Vorbild · ein Baustein ohne Heimatrubrik geht nicht verloren |

### Was in jedem Fall konfigurierbar bleibt (A7)

Medienarten-Wörter · Platz-Titel · Pflichtstufen · Eigenschaften samt Wort,
Symbol, Farbe und Art · Bausteinkategorien · alle Reichweiten-Bezeichnungen ·
die Schritte des Pflege-Wegs samt Wort, Untertitel, Symbol, Reihenfolge und
eigenen Schritten ·
jede neue Karte und jeder neue Menüpunkt (über das Funktionsregister
ausblendbar, umbenennbar, sortierbar). **Nichts davon darf je eine
Code-Änderung brauchen.**

### Angenommen, nicht gefragt

* **K2:** Die neuen Eigenschafts-Facetten **ergänzen** die vorhandene
  Titel-Zerlegung, sie ersetzen sie nicht. Eine Ablösung wäre möglich, ist
  aber eine eigene Entscheidung.
* **K5:** Bereits angelegte, maschinell gefundene Bausteine bleiben erhalten
  und bekommen `quelle:'gefunden'`; nur die **Vorschlagsliste** verschwindet.
* **K4:** Vorhandene `MATLINK`-Einträge bleiben unverändert gültig und werden
  weiterverwendet.

### Ausdrücklich offen

**Stufe 0 (Sicherheit)** ist weiterhin zurückgestellt und wird durch keinen
dieser fünf Ausbauten berührt — aber sie bleibt offen und muss in jeder
Gesamtbetrachtung genannt werden.
