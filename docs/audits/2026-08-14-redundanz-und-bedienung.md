# Analyse: Redundante Menüs, doppelte Wege und die Einhaltung der Grundsätze

| | |
|---|---|
| **Erstellt** | 2026-08-14 |
| **Geprüfter Stand** | `edd879f` (main), Branch `claude/app-analysis-redundancy-ux-i9hm9g` |
| **Umfang** | 78 JS-Module · 21.582 Zeilen · 30 Verwaltungs-Karten · 15 Menüpunkte · 3 Bearbeiten-Menüs · 24 Bildschirme |
| **Bestand zur Messung** | 47 Standards · 294 Rubriken · 4475 Zeilen (`e2e/messen.js`) |
| **Methode** | Quelltext-Analyse **plus** Vermessung im echten Browser (Chromium/Playwright, 390×844) gegen einen laufenden Server. Jeder Befund unten ist entweder gemessen oder an einer Zeilennummer belegt. Was nur vermutet ist, steht als Vermutung da. |
| **Ausgangslage** | `npm run check` grün · `npm test` 1004/1004 grün · 0 Konsolenfehler während aller Messläufe |

---

## 1. Kurzfassung

Die App ist **handwerklich weit über dem Durchschnitt**: Die Grundsätze sind
niedergeschrieben, fünf von ihnen werden maschinell überwacht, die Altlasten
sind gezählt statt verschwiegen, und die Begründung einer Entscheidung steht
fast überall neben ihr. Der Kernweg im Saal — Standard → Rubrik → abhaken — ist
schnell (3,5 ms Startseite, 18,8 ms größte Rubrik) und ruhig.

Die Befunde liegen fast alle **nicht im Kern, sondern an den Nähten**: dort, wo
ein neuer, besserer Ort für eine Funktion gebaut wurde und der alte stehen
blieb. Das erzeugt genau die Doppelungen, nach denen gefragt wurde — und in
drei Fällen Knöpfe, die **lautlos nichts tun**.

**Die fünf wichtigsten Befunde:**

1. **Auf dem installierten Tablet lässt sich die Verwaltung nicht öffnen.** Die
   Anmeldung läuft ausschließlich über `prompt()` — genau die Funktion, die
   Grundsatz ⑧ als „in installierten PWAs lautlos wirkungslos" beschreibt.
   Gemessen: liefert `prompt()` nichts, bleibt `ADMIN=false`, und es gibt
   keinen zweiten Weg. **Zwei der drei Aufgaben, die der Anhang der Grundsätze
   dem Auftraggeber persönlich zuweist (Passwort ändern, Glossar füllen), sind
   damit auf dem Zielgerät nicht ausführbar.**
2. **Kategorien und Unterkategorien gibt es an zwei Orten mit unterschiedlichem
   Funktionsumfang** (Verwaltung ↔ Materialzentrale). Genau die Konstellation,
   die Grundsatz ⑥ verbietet — und mit derselben Begründung, die dort steht:
   der zweite Weg kann weniger, sagt es aber nicht.
3. **Drei Knöpfe wirken nicht oder unsichtbar** (gemessen, nicht vermutet):
   „＋ Kategorie" in der Materialzentrale tut *nichts, ohne Rückmeldung*; das
   Kategorie-Symbol und das Umbenennen einer Unterkategorie ändern die Daten,
   zeichnen aber den unsichtbaren Bildschirm neu.
4. **Der Katalog-Bildschirm ist aus der ganzen App nicht erreichbar** (gemessen:
   0 Knöpfe in allen drei Modi) — aber das ⋯-Menü schreibt weiter hinein.
5. **Grundsatz A2 verbietet wörtlich „keine Bestellungen"** — es gibt ein
   Bestellmodul mit 717 Zeilen, Mengenfeld und eigenem Konzeptdokument. Nach
   der Regel des Hauses („Ein Widerspruch zwischen Code und Grundsatz ist immer
   ein Fehler im Code") muss hier **zuerst das Dokument** geändert werden.

---

## 2. Die Menü-Landschaft, wie sie tatsächlich ist

Gemessen im Browser, nicht aus dem Quelltext abgeschrieben.

| Fläche | Umfang | Bemerkung |
|---|---|---|
| **☰ Menü** | 10 Punkte (Gast) · 15 (Verwaltung) | + „🎛 Menü & Funktionen", hart angehängt |
| **Verwaltung** | 30 Karten in 3 Blöcken | Inhalte (19) · Aussehen (8) · Daten (3) |
| **Bearbeiten-Menüs ⋯** | 3 Menüs · 46 Aktionen | Eintrag (28) · Standard (10) · Rubrik (8) |
| **Materialzentrale** | 5 Reiter + 1 verdeckter | „dubletten" hat keinen Reiter |
| **Startseiten-Reiter** | 2 (Standards, Anleitungen) | frei erweiterbar |
| **Kopfleiste** | 6 Symbole | 3 davon abschaltbar |
| **Bildschirme** | 24 (`<div class="screen">`) | einer davon unerreichbar (§4.1) |

Der Aufbau ist bewusst gestaltet und im Quelltext begründet. Die Probleme
entstehen an vier Stellen, an denen dieses Bild nicht mehr stimmt.

---

## 3. Doppelte und redundante Wege

### 3.1 Kategorien & Unterkategorien: zwei Menüs, ungleicher Umfang · **schwer**

`features/backup.js` (Verwaltung) und `features/matcenter.js:247` (Reiter
„🗂 Ordnung") pflegen **dieselben Daten** mit **verschiedenem Umfang**:

| Handgriff | Verwaltung → 🏷️/🗂 | Materialzentrale → Ordnung |
|---|---|---|
| Name ändern | ✔ | ✔ |
| Farbe ändern | ✔ (Palette) | ✔ (Farbwähler) |
| Symbol ändern | ✔ | ✔ *(zeichnet nicht neu, §4.2)* |
| „zählt als Material" | ✔ | ✔ |
| Neue Kategorie | ✔ | ✔ *(ohne Wirkung, §4.2)* |
| Kategorie löschen | ✔ | **fehlt** |
| Auf Vorgabe zurücksetzen | ✔ | **fehlt** |
| Unterkategorien sortieren ▲▼ | ✔ | **fehlt** |
| Unterkategorien zusammenführen | ✔ *(mit Erklärung)* | ✔ *(ohne Erklärung)* |

Grundsatz ⑥ schreibt: *„Für eine Sache gibt es ein Bearbeiten-Menü … Kein
zweites, verkürztes Menü an einer dritten Stelle."* Und die Begründung dort
beschreibt exakt diesen Fall: *„Ein zweiter Weg mit weniger Rückfragen ist der
gefährlichere."*

Der Kopfkommentar von `matcenter.js` nennt die Zusammenführung von *„neun
Einstiegen"* als seine Daseinsberechtigung. Fünf dieser neun stehen aber noch
als eigene Verwaltungs-Karte da: Kategorien, Unterkategorien, Material­zusammen­führung,
Einstufung prüfen, Ausgeblendete Einträge. Der Umbau ist begonnen, nicht
abgeschlossen — und im jetzigen Zwischenzustand ist er schlechter als beide
Endzustände.

> **Empfehlung.** Eine der beiden Flächen wird zur Wahrheit, die andere zum
> Verweis („Kategorien pflegen → öffnet die Materialzentrale"). Welche, ist
> eine Entscheidung des Hauses; der geringere Umbau ist, die Materialzentrale
> auf einen Verweis zurückzunehmen, denn die Verwaltung kann heute mehr.

### 3.2 Der Katalog: Daten hinein, kein Weg hin · **schwer**

Gemessen: In **keinem** der drei Modi (`use`, `care`, `admin`) existiert ein
Bedienelement, das den Katalog öffnet.

- `ui/nav.js:25` zeichnet ihn (`setMode('catalog')`).
- Der einzige Aufrufer im Produktivcode ist `features/scanner.js:459` — die
  *Rückkehr* aus dem Scanner dorthin. Diese Rückkehr wird nur gesetzt, wenn man
  vorher schon im Katalog war (`scanner.js:442`). Ein geschlossener Kreis ohne
  Eingang.
- Trotzdem bietet das ⋯-Menü weiterhin **„📥 In Katalog aufnehmen"**
  (`quickmenu.js:108`). Die Daten landen in `hkl_catalog`, werden von der
  ☑-Ankreuzliste gelesen — aber **niemand kann sie je ansehen, korrigieren
  oder löschen**. Ein Speicherort ohne Sicht ist genau das, wovor Grundsatz ②
  („Nichts verschlucken") warnt.
- Nebenwirkung: `ui/catalog.js` trägt 3 der 47 geduldeten Eingabefenster —
  Altlasten in Code, den niemand erreicht.

> **Empfehlung.** Entweder einen Einstieg schaffen (naheliegend: ein sechster
> Reiter der Materialzentrale) — oder den Bildschirm entfernen und „In Katalog
> aufnehmen" durch „In die Ankreuzliste aufnehmen" ersetzen, wenn das die
> gemeinte Wirkung ist. Der jetzige Zustand ist die einzige Variante, die
> niemandem nützt.

### 3.3 Vier Verwaltungsbereiche liegen nicht in der Verwaltung · **mittel**

Pop-up-Dialoge, Ärzte & Varianten, Diagnose & Fehler und Material & Einträge
sind nur über ☰ erreichbar, während alle vergleichbaren Editoren (Bausteine,
Bereiche, Austauschgruppen, Merkmale, Seiten, Aktuelles …) Verwaltungs-Karten
sind. Es gibt keinen erkennbaren Grund für die Trennung.

Das schlägt direkt auf die Einstellungs-Suche der Verwaltung durch. Gemessen
mit 18 Alltagsbegriffen — **8 finden nichts**:

```
popup 0 · pop-up 0 · arzt 0 · varianten 0 · diagnose 0
katalog 0 · passwort 0 · barcode 0 · glossar 0
material 4 · farbe 3 · bild 3 · anleitung 1 · preis 1 · sicherung 1 …
```

Ein Suchfeld, das „Einstellung suchen (z. B. Farbe, Preis, Kategorie …)"
verspricht und bei „Pop-up" **„Kein Treffer"** meldet, ist schlechter als kein
Suchfeld: Es beweist der Nutzerin, dass es die Funktion nicht gibt.

> **Empfehlung.** Die vier Bereiche als Karten in die Verwaltung aufnehmen
> (Inhalt bleibt, wo er ist — die Karte enthält nur den Öffnen-Knopf, wie es
> „🎛 Menü & Funktionen" bereits vormacht). Zusätzlich `data-keys` um
> „passwort", „katalog", „barcode", „glossar" ergänzen.

### 3.4 „📷 Etikett scannen" sieht nur, wer sich nicht angemeldet hat · **mittel**

`features/funktionen.js:63` — `nur:'gast'`. Gemessen: Der Punkt steht im
Gast-Menü (10 Punkte) und **fehlt** im Verwaltungs-Menü (15 Punkte).

Damit sieht ausgerechnet die Rolle, die Material pflegt, den Menüpunkt nicht;
und die Rolle, die ihn sieht, darf beim Bearbeiten nichts speichern
(`scanner.js:487` verlangt ADMIN). Für Angemeldete gibt es den Scanner nur an
anderer Stelle und mit anderem Verhalten: Materialzentrale → Reiter Material →
`startCam()` springt direkt in die Kamera, während das Menü über
`openScanHub()` erst eine Liste zeigt. **Gleiche Beschriftung, zwei Orte, zwei
Verhalten, rollenverkehrt verteilt.**

> **Empfehlung.** `nur:'alle'` setzen und beide Einstiege auf `openScanHub()`
> vereinheitlichen. Der Kamerastart ist dann ein Knopf *in* der Liste — ein
> Ort, ein Verhalten.

### 3.5 Kleinere Doppelungen · **gering**

- **„＋ Neuer Standard"** steht zweimal in der Verwaltung: in „🧱 Inhalte &
  Aufbau" und in „➕ Eigene Standards" — beide rufen `openStandardForm(null)`.
  Harmlos, aber es erzeugt die Frage, ob es zwei verschiedene Dinge sind.
- **„🎛 Menü & Funktionen"** existiert als Verwaltungs-Karte *und* als hart
  angehängter Punkt im ☰-Menü (`app-state.js:47`, außerhalb des Registers, das
  es selbst verwaltet). Das ist als „ein Menü, zwei Kontexte" vertretbar —
  bemerkenswert ist nur, dass ausgerechnet dieser Punkt der einzige ist, der
  nicht durch das Register läuft, das er konfiguriert.
- **Zwei Wiederherstellungs-Listen** („🗑 Ausgeblendete Einträge" und
  „🚮 Endgültig entfernte Zeilen"). Sachlich begründet und im Quelltext sauber
  hergeleitet (`endgueltig.js`). Der Wortlaut trägt die Trennung aber nicht:
  Der Knopf heißt „**Endgültig** entfernen", und die Liste dazu bietet „Doch
  zurückholen". Wer beides sieht, weiß nicht mehr, was „endgültig" heißt.

---

## 4. Knöpfe, die nicht tun, was sie sagen

Alle drei Befunde sind im laufenden Browser reproduziert.

### 4.1 „＋ Kategorie" in der Materialzentrale: ohne Wirkung, ohne Rückmeldung · **schwer**

```
Knopf gefunden: ＋ Kategorie
Kategorien vorher: 5 · nachher: 5
Rückmeldung (toast): []
Eingabefeld admNewNatInp im DOM: false
⇒ LAUTLOS OHNE WIRKUNG
```

**Ursache.** `matcenter.js:258` rendert `onclick="addNat()"`. `addNat()`
(`backup.js:458`) liest `$('admNewNatInp')` — ein Feld, das nur in der
*Verwaltung* existiert und auch dort nur, wenn `admNewNatOpen` gesetzt ist. Auf
`scr-care` ist es `null`, `label` bleibt leer, und die Funktion kehrt in
Zeile 460 wortlos zurück:

```js
const inp=$('admNewNatInp'); const label=(inp&&inp.value||'').trim();
if(!label){ if(inp) inp.focus(); return; }   // inp ist null → gar nichts
```

Das ist exakt das Fehlerbild, gegen das Grundsatz ⑧ geschrieben wurde: *„Jemand
tippt, nichts passiert, niemand erfährt warum."* — nur hier ohne `prompt()` als
Ursache.

### 4.2 Änderungen wirken, aber der Bildschirm zeigt sie nicht · **schwer**

```
Kategorie-Symbol ändern — aus der Materialzentrale
  Nativer Dialog: prompt: Symbol (Emoji) für diese Kategorie:
  Symbol im Datenmodell: 📦 → 🚀
  Symbol auf dem Bildschirm: 📦
  aktiver Bildschirm: scr-care
⇒ GEÄNDERT, ABER NICHT NEU GEZEICHNET
```

**Ursache.** `editNatIcon` (`backup.js:452`) und `renameUk` (`backup.js:472`)
schließen mit `renderAdmin()` — sie zeichnen `#scr-admin` neu, während die
Nutzerin auf `#scr-care` steht. Die Änderung ist gespeichert und geteilt, aber
unsichtbar. Die wahrscheinliche Folge im Alltag: noch einmal tippen, noch einmal
ändern.

Dass es anders geht, steht daneben: `setNatColor`, `setNatLabel`,
`setNatBeschaffbar` und `setUkColor` rufen `refreshSettingsViews()`
(`backup.js:60`), das prüft, welcher Bildschirm aktiv ist. **Vier Funktionen
wurden umgestellt, drei wurden übersehen.** Genau darum ist es eine Doppelung
und kein Einzelfehler.

| Funktion | in der Materialzentrale | schließt mit | nativer Dialog |
|---|---|---|---|
| `setNatColor` | ja | `refreshSettingsViews` ✔ | – |
| `setNatLabel` | ja | `refreshSettingsViews` ✔ | – |
| `setNatBeschaffbar` | ja | `refreshSettingsViews` ✔ | – |
| `setUkColor` | ja | `refreshSettingsViews` ✔ | – |
| `addNat` | ja | `renderAdmin` ✘ | – *(wirkungslos, §4.1)* |
| `editNatIcon` | ja | `renderAdmin` ✘ | **prompt** |
| `renameUk` | ja | `renderAdmin` ✘ | **prompt** |

### 4.3 Zwei der vier Felder unter „🔤 Texte" sind wirkungslos · **mittel**

```
appTitle   (Bildschirm use)  : im Kopf=JA
careTitle  (Bildschirm care) : im Kopf=nein · im Inhalt=nein   ← OHNE WIRKUNG
careIntro  (Bildschirm care) : im Kopf=nein · im Inhalt=nein   ← OHNE WIRKUNG
pruefTitle (Bildschirm admin): im Inhalt=JA
```

`txt('careTitle')` und `txt('careIntro')` werden **nirgends** gelesen außer im
Eingabefeld selbst. Der Bildschirm, zu dem sie gehörten („Material pflegen"),
ist durch die Materialzentrale ersetzt worden; deren Überschrift steht fest im
Quelltext (`matcenter.js:118`), und `updateBar()` schreibt fest `'Material'`
(`nav.js:15`).

Die Feldbeschriftung lautet weiterhin „Titel **„Material pflegen"**" — sie nennt
einen Bildschirm, den es nicht mehr gibt. Das ist ein A7-Verstoß der
unangenehmsten Sorte: nicht „nicht einstellbar", sondern „sieht einstellbar aus".

Nebenbei heißt derselbe Bildschirm an vier Stellen verschieden: **„Material &
Einträge"** (Menü), **„🧬 Material & Einträge"** (Banner), **„Material"**
(Kopfzeile), **„Materialwirtschaft"** (`TXT_DEF.careTitle`), **„Material
pflegen"** (Verwaltungs-Feld).

---

## 5. Einhaltung der Grundsätze

| Regel | Befund |
|---|---|
| **A1** Keine Patientendaten | ✔ eingehalten. Keine Felder mit Personenbezug gefunden. Freitextfelder existieren (Bestellung, Hinweis, Eigene Felder) — sie sind der von A1 benannte Restrisiko-Ort, aber kein Verstoß. |
| **A2** Keine Bestandsführung | **✘ Widerspruch** — siehe §5.1 |
| **A3** Defi-Kennwort | ✔ nichts gefunden |
| **A4** Keine Zugriffsprotokolle | ⚠ mit einer Einschränkung — siehe §5.4 |
| **A5** Quelle & Status | ✔ umgesetzt (`gudid.js`, „unbestätigt"), Vanguard-Ausschluss vorhanden |
| **A6** Excel-Liste außen vor | ✔ keine Excel-Datei im Repository, keine Kennzahl daraus |
| **A7** Volle Kontrolle ohne Entwickler | **✘ drei Verstöße** — siehe §5.2 |
| **A8** Deutsch, mit Begründung | ✔ vorbildlich durchgehalten |
| **A9** Sicherheit zurückgestellt | ⚠ zwei Punkte fehlen in der Aufzählung — siehe §5.4 |
| **①** Leer schlägt falsch | ✔ konsequent |
| **②** Nichts verschlucken | ⚠ der Katalog verschluckt (§3.2) |
| **③** Der Mensch schlägt alles | ✔ |
| **④** Kein Fachwort im Code | ⚠ Prüfung hat eine Lücke — siehe §5.3 |
| **⑤** Alles konfigurierbar | ⚠ siehe A7 |
| **⑥** Ein Menü, zwei Kontexte | **✘ verletzt** (§3.1) |
| **⑦** Nicht in die Quelle schreiben | ✔ Overlay-Modell sauber |
| **⑧** Keine nativen Eingabefenster | **✘ 47 verbliebene, davon die Anmeldung** — siehe §5.5 |
| **⑨** Was nicht geprüft wird | ✔ 1004 Tests, 7 Maschinenprüfungen, Messstand |

### 5.1 A2 verbietet Bestellungen — es gibt ein Bestellmodul · **schwer (Dokument)**

A2 im Wortlaut: *„Sie führt keinen Bestand: keine Chargenverfolgung, keine
Verfallsüberwachung, keine Mengen im Lager, **keine Bestellungen**, keine
Rückrufe."*

Im Code: `features/bestellungen.js` (717 Zeilen), drei Zustände
(gemeldet → bestellt → geliefert), Kürzel und Uhrzeit je Schritt, ein
**Mengenfeld** (`bestellungen.js:222, 373`), eine „mitwachsende
Bestell-Datenbank" und ein eigenes Konzeptdokument
(`docs/KONZEPT-BESTELLDATENBANK.md`). Erreichbar über ⋯ → „🛒 ‚ist leer' melden".

Fachlich ist das gut verteidigbar: Eine Notiz „das Regal ist leer" ist keine
Materialwirtschaft, und die Begründung im Modulkopf ist überzeugend. Aber die
Grundsätze regeln diesen Fall selbst: *„Wer eine Regel für falsch hält, ändert
dieses Dokument — und zwar **bevor** der Code ihr widerspricht."* Und: *„Ein
Widerspruch zwischen Code und Grundsatz ist immer ein Fehler im Code, nie eine
Ausnahme."*

> **Empfehlung.** Nur der Auftraggeber darf Teil A ändern. Vorschlag für A2, zur
> Gegenzeichnung: den Halbsatz „keine Bestellungen" ersetzen durch *„keine
> Bestellabwicklung — eine Meldung ‚ist leer' mit Kürzel und Uhrzeit ist
> zulässig, Mengen im Lager, Lieferscheine und Preise je Bestellung nicht."*
> Solange das nicht gegengezeichnet ist, steht der Code gegen die Regel.

### 5.2 A7: drei feste Listen, die dem Haus gehören müssten · **mittel**

A7 nennt als Verstoßmerkmal wörtlich: *„Einer festen Liste im Code, die
eigentlich das Haus pflegen müsste (**Hersteller**, **Kategorien**, Symbole,
Rubriknamen, Statuswörter)."*

1. **`features/guides.js:28` — `GUIDE_BEREICHE`**
   ```js
   const GUIDE_BEREICHE = ['Aufbau & Vorbereitung','Gerät bedienen','Bestellen & Material',
     'Regelmäßige Aufgaben','Patient & Ablauf','Notfall','Hinweise'];
   ```
   Die Gruppierung *aller* Anleitungen. Kein `bezWert`, kein Feld in der
   Verwaltung. Wer „Hygiene" braucht, braucht einen Entwickler. Das ist die
   einzige Kategorien-Liste der App, die diese Behandlung nicht bekommen hat —
   alle anderen (`ALT_ARTEN`, `AUF_TAKTE_RUECKFALL`, `FRG_ZUSTAENDE`,
   `BEST_WORT_RUECKFALL`, `FAC_ARTEN` …) laufen vorbildlich über `bezWert`.
2. **`features/guides.js:32` — `GUIDE_INTERVALLE`** (`täglich`, `wöchentlich`,
   …). Dasselbe. Zusätzlich doppelt sich das mit `AUF_TAKTE_RUECKFALL` in
   `aufgaben.js:41`, das für dieselbe Sache **acht** Takte kennt statt sechs —
   und *konfigurierbar* ist. Zwei Wahrheiten über „wie oft".
3. **`features/ocr.js:98–99` — GTIN-Präfix → Hersteller**
   ```js
   if(/^8714729/.test(g)) out.hersteller='Boston Scientific';
   else if(/^5414734/.test(g)) out.hersteller='Abbott';
   ```
   Die Herstellerliste selbst ist vorbildlich ins Haus gewandert
   (`bezeichnungen.json → hersteller`, pflegbar unter „🏭 Bezeichnungen &
   Hersteller"). Diese zweite, versteckte Herstellertabelle ist es nicht. Ein
   neuer Lieferant — laut Kommentar an derselben Stelle „ein Alltagsereignis" —
   lässt sich hier nicht nachtragen.

### 5.3 Prüfung 4 (Fachwort) hat eine Lücke · **mittel**

`GUIDE_BEREICHE.indexOf(a)` (`guides.js:93`) ist ein Vergleich gegen eine
umbenennbare Zeichenkette — genau das, was ④ in seiner scharfen Fassung
verbietet: *„Eine Zeichenkette, die jemand umbenennen kann, darf nicht in einem
Vergleich stehen."* `npm run check` meldet das nicht, weil
`scripts/pruefungen/fachwort.js` auf Vergleichsoperatoren
(`===`, `!==`, `switch`) sieht, nicht auf `Array.prototype.indexOf` /
`.includes` gegen ein Literal-Array.

> **Empfehlung.** Die Prüfung um den Fall „Literal-Array, dessen Elemente
> deutsche Wörter sind, wird durchsucht" erweitern. Er ist maschinell erkennbar
> und der Grund, warum §5.2 monatelang unbemerkt blieb.

### 5.4 A9: zwei Punkte, die in der Aufzählung fehlen · **mittel**

A9 verlangt ausdrücklich, dass die offenen Punkte *„in keiner Analyse
verschwiegen"* werden. Die drei genannten stimmen. Zwei kommen hinzu:

**(4) Der Konfliktschutz ist eine Attrappe.** `core/sync.js:198` sendet
`baseRev: rev` bei jedem Schreibvorgang. Der Server liest ihn **nie** — `grep
baseRev server/` findet nichts, und `server/state.js:83` schreibt bedingungslos:

```js
function update(incoming) {
  STATE.state = Object.assign({}, STATE.state, incoming);   // letzter gewinnt
  STATE.rev += 1;
```

Das ist A9-Punkt 3 („eines kann das andere still überschreiben") — aber der
gesendete `baseRev` liest sich im Quelltext wie ein Schutz, den es nicht gibt.
Der Merge ist **je Schlüssel**, nicht je Eintrag: Zwei Personen, die
gleichzeitig *verschiedene* Zeilen bearbeiten, schreiben beide `hkl_qedits` —
und die zuletzt gespeicherte Fassung gewinnt vollständig. Das ist der einzige
Befund dieses Berichts, der **Arbeit vernichten** kann.

**(5) Der Kennwort-Hash ist nicht rückrechnungssicher.** `core/config.js:9`
verwendet djb2 mit 32 Bit:
```js
function pwHash(s){ let h=5381; … h=(((h<<5)+h)+s.charCodeAt(i))>>>0; … }
```
`hkl_authpw` steht in `SHARED_KEYS` (`sync.js:19`) und damit im unauthentifizierten
`/api/state`. A9-Punkt 2 sagt korrekt, dass das Kennwort „mitliegt"; dass es aus
dem Mitgelegenen in Sekunden zurückgerechnet werden kann, steht nicht dabei.
Bei zurückgestellter Zugangssicherung ist das **kein neuer Mangel** — aber es
gehört in die Aufzählung, damit die Entscheidung auf vollständiger Grundlage
bleibt.

**Zu A4:** eingehalten. Das Regel-Journal protokolliert Änderungen, nicht
Zugriffe. Einschränkung: `hkl_popup_log` (Antworten auf Pop-ups) und die Kürzel
an Bestellungen erzeugen personennahe Spuren. Beides ist freiwillig und
gerätelokal bzw. selbst eingetippt — kein Verstoß, aber der Ort, an dem einer
entstehen würde.

### 5.5 ⑧ Keine nativen Eingabefenster: 47 verbliebene — und die falsche · **schwer**

Der Bestand ist ehrlich gezählt (`altlasten.json`) und stimmt exakt: 47 Fälle in
16 Dateien, nachgerechnet mit der Prüfung selbst. Die Liste kann nur schrumpfen.
Das ist gute Arbeit.

Das Problem ist nicht die Zahl, sondern **welche** Fälle noch drin sind:

```
core/app-state.js:34  promptLogin()      → prompt('Passwort für den Verwaltungsmodus:')
core/app-state.js:35  promptLoginThen()  → prompt('Du bist nicht berechtigt …')
core/app-state.js:36  changePw()         → prompt × 3
features/glossary.js  addGlossaryTerm / editGlossaryTerm → prompt × 4
```

Gemessen mit einem Browser, der `prompt()` verwirft — das dokumentierte Verhalten
der installierten PWA auf Android-Chrome:

```
„Anmelden" im Menü vorhanden: true
ADMIN nach Anmeldeversuch: false
sichtbare Alternativen: ["🔒 Anmelden · Verwaltung freischalten"]
⇒ KEINE ANMELDUNG MÖGLICH — Verwaltung vollständig gesperrt
```

`promptLoginThen` ist an **38 weiteren Stellen** die Türsteherin (Material
öffnen, Zeile bearbeiten, Anleitung anlegen, Scanner speichern, Dubletten
zusammenführen …). Fällt sie lautlos aus, wirkt die ganze App wie ein hakendes
Tablet — das im Quelltext mehrfach beschriebene schlimmste Fehlerbild.

Und der **Anhang der Grundsätze** benennt drei Dinge, die nur der Auftraggeber
tun kann. Zwei davon — *„Verwaltungskennwort ändern"* und *„Glossar füllen"* —
laufen ausschließlich über `prompt()`.

Die Werkzeuge dafür sind längst gebaut: `sheetTextFrage()` und `sheetFrage()`
(`quickmenu.js:397/417`) sind genau für diesen Zweck geschrieben, mit
ausführlicher Begründung. `quickmenu.js` steht deshalb mit **0** in der
Altlastenliste. Sie sind nur nie auf die Anmeldung angewandt worden.

> **Empfehlung, priorisiert.** Nicht alle 47 — diese sieben, in dieser
> Reihenfolge: `promptLogin` · `promptLoginThen` · `changePw` (3×) ·
> `addGlossaryTerm` / `editGlossaryTerm` (4×). Danach ist die App auf dem
> Zielgerät vollständig bedienbar, und der Anhang ist erfüllbar. Aufwand:
> überschaubar, weil das Sheet-Muster fertig danebenliegt.

---

## 6. Bedienung: was im Alltag Kraft kostet

### 6.1 Jede Einstellung klappt ihre Karte zu · **mittel**

```
vor  der Änderung: offen = ["Kategorien","Einstufung prüfen"]
nach dem Ändern EINER Farbe: offen = ["Einstufung prüfen"]
⇒ Karte „Kategorien" noch offen: false
```

49 sichtbare Bedienelemente der Verwaltung rufen `renderAdmin()` direkt auf. Das
zeichnet die **gesamte** Verwaltung neu — der mit Abstand teuerste Renderpfad
der App (gemessen: **113,9 ms im Mittel, 203,4 ms im schlechtesten Fall**, und
das auf Entwickler-Hardware) — und wirft dabei den `open`-Zustand aller
`<details>` weg. Wer fünf Kategorien einfärbt, klappt die Karte fünfmal wieder
auf.

Dass es anders geht, steht in derselben Datei: `adminSearch()` filtert **ohne**
Neu-Render, ausdrücklich mit dem Kommentar *„Kein Re-Render → Panel-Zustände
bleiben."* Und `features/funktionen.js:492` merkt sich mit `fktMenuOffen`
genau aus diesem Grund, welches Menü offen war.

> **Empfehlung.** Vor `box.innerHTML=html` die offenen Karten merken und danach
> wiederherstellen (der Schlüssel `fktSlug(titel)` existiert bereits). Zehn
> Zeilen, und die Verwaltung fühlt sich anders an.

### 6.2 „Verlassen" meldet ab · **mittel**

Gemessen: Der einzige Knopf im Kopf der Verwaltung heißt „Verlassen" und ruft
`adminLogout()` — `ADMIN: true → false`. Verwaltung und Materialzentrale sind
außerdem die **einzigen** Bildschirme ohne ‹-Zurück (gemessen über 10
Bildschirme).

Wer die Verwaltung nur *schließen* will, meldet sich damit ab — und muss sich
neu anmelden. Auf dem Tablet heißt das nach §5.5: **gar nicht mehr**. Die beiden
Befunde verstärken sich.

> **Empfehlung.** Zwei Knöpfe: „Zur Übersicht" (`menuGo('use')`) und
> „Abmelden". Oder den ‹-Zurück auch hier zeigen.

### 6.3 Weitere Beobachtungen

- **Der Materialindex** braucht 59,9 ms (max 264,9 ms) für 4475 Zeilen und läuft
  nach nahezu jeder Änderung im ⋯-Menü. Auf Laborhardware ist das spürbar.
- **„Details bearbeiten"** öffnet 7 Eingabefelder in 10 Gruppen über 1,8
  Bildschirmhöhen und verlässt dabei die Ansicht (gemessen). Der schnellere Weg
  („✏️ Zeilen ändern": 8 Berührungen für 5 Zeilen statt 25) existiert — er ist
  nur der weniger sichtbare.
- **Langdruck** ist inzwischen an 11 Flächen verdrahtet, und der Messstand
  bestätigt: **0 von 110** geprüften Flächen der Kernbedienung ohne Langdruck.
  A7 ist hier nicht nur Regel, sondern belegt.
- **Ein verdeckter Reiter:** `mcTab==='dubletten'` hat keinen Reiter und ist nur
  über eine Zeile im Register „Prüfen" erreichbar. Bewusst so (Kommentar
  `matcenter.js:141`) — aber der Zurückweg dorthin ist damit nur die
  Pfeiltaste, und `MC_TABS` kennt ihn nicht.

---

## 7. Was gut ist (und so bleiben sollte)

Damit die Befundliste nicht das falsche Bild erzeugt:

- **Die Grundsätze existieren, sind begründet und werden geprüft.** Sieben
  Maschinenprüfungen, eine Altlastenliste, die nur schrumpfen darf, 1004 Tests,
  ein Messstand, der zählt statt zu schätzen. Das ist mehr, als die meisten
  Produkte dieser Größe haben.
- **Das Funktionsregister** (`features/funktionen.js`) ist die konsequenteste
  Umsetzung von A7, die man bauen kann: 46 ⋯-Aktionen, 30 Verwaltungs-Karten,
  17 Menüpunkte, 3 Kopf-Symbole — alle einzeln benennbar, abschaltbar,
  sortierbar, ohne Programmierung. Der Katalog wird sogar maschinell gegen den
  Quelltext abgeglichen.
- **Die Reichweiten-Frage** („Wo soll es gelten?") mit Trefferzahl und
  Bestätigung bei weiten Reichweiten ist vorbildlich — sie macht die
  gefährlichste Handlung der App zur ehrlichsten.
- **Der Umgang mit den eigenen Fehlern.** Der abgeräumte Kettensymbol-Zustand,
  die entfernte `expiryStatus()`, die gelöschte Verknüpfungs-Oberfläche: Jedes
  Mal steht daneben, warum. Genau dieser Umgang hat die Befunde dieses Berichts
  auffindbar gemacht.

---

## 8. Vorschlag zur Reihenfolge

| # | Maßnahme | Warum zuerst | Aufwand |
|---|---|---|---|
| 1 | `promptLogin`, `promptLoginThen`, `changePw`, Glossar auf `sheetTextFrage` umstellen (§5.5) | Ohne das ist die Verwaltung auf dem Zielgerät gesperrt; das Muster liegt fertig daneben | klein |
| 2 | `addNat` / `editNatIcon` / `renameUk` auf `refreshSettingsViews()` umstellen (§4.1, §4.2) | Drei Knöpfe, die lügen; vier Schwesterfunktionen zeigen den Weg | sehr klein |
| 3 | `careTitle`/`careIntro` entfernen **oder** anschließen (§4.3) | Ein Feld, das nichts tut, ist schlimmer als kein Feld | sehr klein |
| 4 | Katalog: Einstieg schaffen oder Bildschirm entfernen (§3.2) | Daten ohne Sicht; 3 Altlasten in totem Code | mittel |
| 5 | A2 im Dokument klären (§5.1) | Regel oder Code — nur der Auftraggeber kann das entscheiden | Entscheidung |
| 6 | Kategorien/Unterkategorien auf **einen** Ort führen (§3.1) | Grundsatz ⑥; heute kann jede Seite etwas, das die andere nicht kann | mittel |
| 7 | Offene Karten über `renderAdmin()` retten (§6.1) | Betrifft jede einzelne Einstellung, jeden Tag | klein |
| 8 | Pop-ups/Varianten/Diagnose/Material als Karte + `data-keys` ergänzen (§3.3) | Die Suche verspricht, was sie nicht halten kann | klein |
| 9 | „Etikett scannen" auf `nur:'alle'` (§3.4) | Rollenverkehrte Sichtbarkeit | sehr klein |
| 10 | `GUIDE_BEREICHE`/`GUIDE_INTERVALLE`/GTIN-Hersteller ins Haus geben (§5.2) | A7 nennt genau diese Sorte Liste | mittel |
| 11 | Prüfung 4 um Literal-Arrays erweitern (§5.3) | Damit #10 nicht wiederkommt | klein |
| 12 | `baseRev` serverseitig prüfen **oder** entfernen (§5.4) | Ein Schutz, der keiner ist, ist gefährlicher als keiner | mittel |

---

*Alle Messungen wurden gegen einen frisch gestarteten Server mit dem
ausgelieferten Datenbestand durchgeführt (Chromium, 390×844). Die Sonden sind
gegen `e2e/util.js` gebaut und lassen sich mit demselben Unterbau
wiederholen. Kein Befund dieses Berichts stützt sich auf die Excel-Liste
(Grundsatz A6).*
