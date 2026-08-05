# Konzept — Fünf Ausbauten

Stand: 05.08.2026 · Grundlage: der Bestand auf `claude/github-oauth-connect-ljdxp2`

Dieses Papier ist ein **Konzept, kein Bauauftrag**. Es beschreibt für fünf
gewünschte Ausbauten je: was heute wirklich im Quelltext steht (Befund), was
das Handwerk außerhalb dieses Hauses dazu gelernt hat (Stand der Technik), das
Zielbild, das Datenmodell, die Bedienung, den Weg dorthin ohne Datenverlust —
und ausdrücklich das, was **nicht** gebaut werden sollte.

Alle fünf stehen unter denselben Vorgaben wie der Rest der App
(`docs/GRUNDSAETZE.md`), besonders unter **A7** (volle Kontrolle ohne
Entwickler) und **⑤ Alles konfigurierbar**: Jedes Wort, jede Kategorie, jede
Vorgabe, jeder Bedienpunkt aus diesen fünf Ausbauten muss in einer
Verwaltungsmaske änderbar sein. Nichts davon darf je eine Code-Änderung
brauchen.

| | Ausbau | Kern in einem Satz | Größe |
|---|---|---|---|
| **K1** | Medienplätze | Bilder bekommen eine **Vorgabe je Stelle** statt nur eine Möglichkeit. | mittel |
| **K2** | Eigenschaften an Standards | Ein Eingriff bekommt **Merkmale** („sedierungspflichtig") — sichtbar, zählbar, als Reichweite nutzbar. | mittel |
| **K3** | Reichweite je Feld | Eine Bearbeitung darf **pro Feld** unterschiedlich weit reichen. | klein |
| **K4** | Material ohne 🔗 | Die Verknüpfung verschwindet aus der Bedienung — **ein Material ist ein Material**. | groß |
| **K5** | Bausteine kuratiert | Der Mensch **sammelt** Bausteine; die Vorschlagsmaschine kommt weg. | mittel |

---

## K1 · Medienplätze — „hier muss ein Bild hin"

### Befund

`public/js/features/medien.js` kann heute: an **jeder** Zeile beliebig viele
Bilder (max. 12), inhaltsadressiert gespeichert (SHA-256), mit Reichweite
📍/📄/🗂/🌐, offline-fähig über eine IndexedDB-Warteschlange.

Was fehlt, ist die andere Richtung: **eine Vorgabe.** Die App kann sagen „hier
darf ein Bild sein". Sie kann nicht sagen „hier **soll** eine dreiteilige
Bildfolge sein und hier **muss** ein Foto des Geräts sein". Damit bleibt jede
Bebilderung Zufall — sie hängt daran, ob jemand daran gedacht hat.

### Stand der Technik

Das ist kein Bildproblem, sondern eine **Feldvorgabe** — und dafür gibt es eine
eingespielte Bauform. In strukturierten Redaktionssystemen hängt an einem
Bildfeld eine Validierungsregel: `Rule.required().min(1).max(3)` an einem
Bild-Array, `assetRequired()` für „nicht bloß ein leerer Platzhalter"
([Sanity, Validation](https://www.sanity.io/docs/studio/validation),
[Array-Länge](https://www.sanity.io/recipes/custom-validation-on-field-array-length-4237e475)).
Was dort im Quelltext eines Entwicklers steht, muss hier im Menü der Leitung
stehen — das ist der ganze Unterschied.

Zweiter Befund aus derselben Ecke: Ein Bild trägt seine Bedeutung nicht in
sich. Dasselbe Foto heißt an einer Stelle „Übersicht Tisch", an einer anderen
„Schritt 2". Deshalb gehört die Beschriftung **an den Platz**, nicht an die
Datei
([Hygraph, Image SEO im Headless CMS](https://hygraph.com/blog/image-seo-with-headless-cms)).

### Zielbild

Ein **Medienplatz** ist eine benannte, vorgegebene Stelle für Bilder:

> An jedem Eintrag der Rubrik „Ablauf" **soll** ein Bild stehen (Titel:
> „Handgriff"). An jedem Eintrag der Kategorie „Gerät" **muss** ein Foto
> stehen. An dieser einen Stelle **soll** eine Bildfolge aus drei Bildern
> stehen (Titel: „Aufbau in drei Schritten").

Die Vorgabe wird nicht 4.475-mal gesetzt, sondern **einmal je Reichweite** —
mit derselben Treppe wie alles andere in dieser App, um zwei Stufen erweitert,
die hier unentbehrlich sind:

```
📍 diese Stelle        (Rang 6)
📄 dieser Standard     (Rang 5)
🗂 diese Rubrik in diesem Standard   (Rang 4)
🗂 diese Rubrik überall              (Rang 3)
🏷 diese Kategorie (Material/Gerät/Handgriff …)  (Rang 2)
🌐 alle                (Rang 1)
```

Der spezifischste Rang gewinnt; bei Gleichstand die neuere Vorgabe. Das ist
wortgleich die Regel aus `features/rules.js` (`ruleRank`/`ruleBeats`) — bewusst,
denn zwei verschiedene Kaskaden in einer App sind eine Falle.

### Datenmodell

Ein eigener, geteilter Speicher `hkl_medienplaetze`, append-only wie das
Regelwerk (jede Vorgabe rücknehmbar, nichts wird überschrieben):

```
{ id, ts, von, op:'set'|'revoke', ref?,
  wo: { art:'stelle'|'standard'|'rubrikStd'|'rubrik'|'kategorie'|'alle',
        wert, wert2? },
  plaetze: [ { key, titel, art, min, max, pflicht, hinweis } ] }
```

* **`plaetze` ist eine Liste**, weil an einer Stelle mehreres sinnvoll ist:
  ein Übersichtsbild **und** eine dreiteilige Folge. Jeder Platz hat einen
  Schlüssel (`uebersicht`, `schritte`, `warnung`) und einen **Titel, den das
  Haus vergibt**.
* **`art`** ist ein Schlüssel, kein Wort: `bild` · `bewegt` · `folge`. Das
  angezeigte Wort kommt aus `data/bezeichnungen.json` → neuer Zweig
  `medienarten` (Grundsatz ④; die Maschinenprüfung `scripts/pruefungen/fachwort.js`
  erzwingt das ohnehin).
* **`folge` ist eine eigene Art, nicht bloß `max>1`.** Eine Folge wird
  nummeriert und in Reihenfolge dargestellt (1/2/3, wischbar); zwei
  unabhängige Bilder stehen nebeneinander. Das ist ein Darstellungs-
  unterschied, kein Zählunterschied — und genau der Unterschied, den
  „hier soll eine Bildabfolge rein" meint.
* **`pflicht`**: `muss` · `soll` · `kann`. Drei Stufen, weil das Haus im
  Alltag drei benutzt.

### Zuordnung Bild → Platz (ohne Bruch)

Heute steht an einer Zeile eine flache Liste `[kennung, …]`. `medListe()` liest
bereits **beide** Formen — `x.k !== undefined ? x.k : x`. Damit ist der Weg
schon offen: Ein Bild darf künftig als `{k: kennung, p: platzKey}` gespeichert
werden. Bilder ohne `p` liegen im **ersten** Platz, bis jemand sie zuordnet.
Kein Migrationslauf, kein Datenverlust, jederzeit rückwärts lesbar.

### Was passiert, wenn ein `muss`-Platz leer ist

**Nichts wird blockiert.** Im Saal darf keine Vorgabe eine Arbeit anhalten —
das ist die Konsequenz aus „Leer schlägt falsch" (①) und aus dem Grundsatz,
dass die App ein Nachschlagewerk ist, kein Freigabesystem.

Stattdessen wird die Lücke **sichtbar**:

1. Am Eintrag ein dezenter Platzhalter mit dem Titel des Platzes
   („📷 Übersichtsbild fehlt") — **nur im Verwaltungsmodus**, im Saal nicht.
2. Eine Liste „Was fehlt noch?" in der Verwaltung, gleiche Bauart wie
   `bauAbweichungen()`: alle offenen Plätze, ein Tipp springt hin.
3. Im Freigabe-Ablauf (`features/freigabe.js`) als **Vermerk**, nicht als
   Sperre: „3 Pflicht-Bilder offen".

### Bedienung ohne Code

* Neue Verwaltungs-Karte **„🖼 Medienplätze"**: Liste der Vorgaben, je Vorgabe
  Reichweite, Plätze, und die **Treffervorschau** („betrifft 214 Zeilen in 8
  Standards") — dieselbe Bauart wie `ruleHits()`.
* Angelegt wird eine Vorgabe aber **am Ort**, aus dem ⋯-Menü heraus:
  „Hier sollen Bilder hin…". Man entscheidet dort, wo man die Stelle vor
  Augen hat, nicht in einer abstrakten Maske.
* Die Karte ist über das Funktionsregister (`features/funktionen.js`)
  ausblendbar und umbenennbar wie jede andere.

### Bewusst nicht

* **Kein hartes Pflichtfeld.** Ein `muss` ohne Bild darf das Speichern nie
  verhindern.
* **Keine Vorgaben zu Dateigröße/Auflösung je Platz** — der Speicher normiert
  bereits (1280 px, JPEG 0,72); ein zweiter Regelkreis wäre Ballast.
* **Kein Video.** GIF ist gedeckt (`medVerkleinern` reicht GIF ungerendert
  durch); Video ist ein anderer Speicher und eine andere Bandbreite.

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

1. Oberfläche entflechten (Menüpunkt, Badge, Zähler, Status) — sofort spürbar,
   ohne Datenrisiko.
2. Stillschweigender Stammsatz beim ersten Öffnen.
3. Automatische Zusammenführung bei exakter Kennung + Prüfliste + Trennung.

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

**Verbindung zu einer bereits zugesagten Funktion:** „Ankreuzen statt
Abtippen" (Mehrfachauswahl in einer Rubrik) ist der bequeme Weg, viele Zeilen
auf einmal zu sammeln. Die beiden gehören zusammen und sollten zusammen
gebaut werden.

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

## Querschnitt

### Reihenfolge und Abhängigkeiten

```
K3  Reichweite je Feld        klein, größter Alltagsgewinn, kein Datenrisiko
 │
K2  Eigenschaften an Standards  liefert die neue Reichweite 🏷, die K3 dann
 │                              automatisch mit anbietet
K1  Medienplätze              lehnt sich an die Kaskade aus K2/K3 an
K5  Bausteine kuratiert       unabhängig, jederzeit möglich
 │
K4  Material ohne 🔗          größter Eingriff in Gewohnheiten; braucht
                              Trennfunktion + Journal, deshalb zuletzt
```

K3 muss nicht auf K2 warten: Die Kaskade nimmt eine neue `wo.art` an, ohne
dass die Maske davon wissen muss.

### Was die Maschine prüfen muss (Grundsatz ⑨)

| Ausbau | Prüfung |
|---|---|
| K1 | Jeder Platz-Schlüssel hat eine Bezeichnung · Kaskadenrang eindeutig · `medListe()` liest alte **und** neue Form |
| K2 | Eigenschafts-Schlüssel nie in einem Vergleich (deckt `pruefungen/fachwort.js` bereits ab) · `ruleHits()` kennt jede `wo.art` · der Zähler zählt „ohne Angabe" mit |
| K3 | Für jedes geänderte Feld genau **eine** Regel mit dessen eigener Reichweite · ein Feld mit eigener Reichweite benutzt nie die Voreinstellung |
| K4 | Kein 🔗 mehr in den Bedienflächen (Ratchet wie `pruefungen/eingabefenster.js`) · jede Zeile mit `material_key` liefert einen Stammsatz |
| K5 | Keine Vorschlagsliste im Bildschirm · jeder Baustein hat Kategorien oder ausdrücklich keine |

### Was in jedem Fall konfigurierbar bleibt (A7)

Medienarten-Wörter · Platz-Titel · Pflichtstufen · Eigenschaften samt Wort,
Symbol, Farbe und Art · Bausteinkategorien · alle Reichweiten-Bezeichnungen ·
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
