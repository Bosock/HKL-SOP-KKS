# Bericht: Benutzerverwaltung & mehrere Stationen

Stand: 2026-08-12 · Auftrag: „Überlegen, wie man eine gute Benutzerverwaltung
kreiert (Ärzte, Pflegekräfte, Admins, Arztmodus nur für ein, zwei Ärzte,
Pflege darf nur Bestimmtes und Änderungen werden geprüft) — und wie jeder
Bereich der Klinik eine eigene PWA über einen eigenen Link bekommt, während die
Klinik alle Bereiche sieht und in jeden eingreifen kann."

**Reine Recherche und Analyse. Kein Code geändert.**

---

## Teil 0 — Der eine Befund, der über beide Teile entscheidet

`server/routes/state.js` nimmt **ohne jede Anmeldung** Lesen *und* Schreiben des
gesamten geteilten Zustands entgegen. Wer die Adresse kennt, kann alles lesen und
alles überschreiben. Das ist die offene Entscheidung **E1** aus
`docs/MASSNAHMEN.md` und steht offen in `docs/GRUNDSAETZE.md` A9.

Daraus folgt eine Zusage, die dieser Bericht nirgends verletzt:

> **Solange E1 offen ist, ist jedes Rollenmodell eine Bedienhilfe, kein Schutz.**
> Es verhindert Versehen, nicht Absicht.

Das ist **kein Grund zu warten**. Die überwiegende Zahl der Schäden in so einem
System entsteht durch Versehen („ich wollte nur diese eine Zeile ändern, jetzt
steht es in 23 Standards"), nicht durch böse Absicht im Kliniknetz. Ein
Rollenmodell zahlt sich sofort aus. Es darf nur nicht als Sicherheit verkauft
werden — und es sollte so gebaut sein, dass es **später serverseitig scharf
geschaltet werden kann, ohne neu gedacht zu werden.**

Genau darauf zielt der Entwurf in Teil 1: die Rechte-Entscheidung liegt in
**einer** reinen Funktion, die man später auch auf dem Server aufrufen kann.

---

# TEIL 1 — Benutzerverwaltung

## 1.1 Inventur: erstaunlich viel ist schon da

Bevor irgendetwas gebaut wird — was die App heute kann:

| Baustein | Datei | Was er heute leistet | Wert fürs Rollenmodell |
|---|---|---|---|
| **Verwaltungsmodus** | `app-state.js` | *ein* Passwort → `ADMIN = true/false` | Der Platzhalter, den wir ersetzen |
| **GitHub-Anmeldung** | `auth.js`, `routes/auth.js` | echte Identität, HMAC-signiertes Cookie | Identitäts-Quelle, **wird für Rechte bisher nicht genutzt** |
| **Kürzel** | `kuerzel.js` | gerätelokales Kürzel an Häkchen | Autorschaft ohne Überwachung — das Vorbild |
| **Arzt-Varianten** | `variants.js` | Overlay je Arzt: ändern, ausblenden, ergänzen | **Der Arztmodus existiert bereits vollständig** |
| **Änderungsvorschläge** | `suggestions.js` | vorschlagen → 👍/👎 → Verwaltung übernimmt/lehnt ab | **Die Prüfschleife existiert bereits** |
| **Freigabe mit Siegel** | `freigabe.js` | „gültig / überholt / Entwurf" je Standard | Der Ort für das Recht „freigeben" |
| **Regelwerk** | `rules.js` | Journal + Kaskade 📍 Stelle → 📄 Standard → 🗂 Gruppe → 🌐 überall | **Die Reichweite ist die natürliche Rechte-Achse** |

**Befund:** Es fehlt kein einziger Mechanismus. Es fehlt genau eine Sache — die
**Frage „wer bist du"** und drei kleine Weichen, die an die vorhandenen
Mechanismen andocken.

## 1.2 Der Denkfehler, den man hier machen kann

Der übliche Weg ist eine Rechte-Matrix: *Rolle × Aktion × Objekt*. Bei dieser App
wären das schnell 4 Rollen × ~40 Aktionen × 6 Objektarten — knapp tausend Häkchen.
Genau das erzeugt die Unübersichtlichkeit, die du ausgeschlossen hast, und
niemand pflegt sie nach dem ersten Monat.

**Der Ausweg: Rechte nicht als Matrix, sondern als drei Achsen, die es schon gibt.**

1. **Wie weit** darf jemand wirken? → die **Reichweite** (Regelwerk)
2. **Was passiert** mit seiner Änderung? → **sofort** oder **als Vorschlag**
3. **Welche Schublade** darf er anfassen? → Standard · eigene Arzt-Variante · Betrieb

Damit reduziert sich die ganze Verwaltung auf **eine Zeile pro Person**.

## 1.3 Vorschlag: vier Rollen, zwei Schlüssel

### Die vier Rollen

| Rolle | Wer | Grundhaltung |
|---|---|---|
| 👁 **Lesen** | alle, ohne Anmeldung | sieht alles, ändert nichts |
| 🧤 **Pflege** | Pflegekräfte im Saal | darf viel — aber **nur hier** und **nur als Vorschlag** |
| 🩺 **Arzt** | Ärztinnen und Ärzte | ändert **die eigene Karte** frei; am Haus-Standard nur per Vorschlag |
| 🛡 **Leitung** | 1–3 Personen | ändert alles sofort, prüft Vorschläge, verwaltet Personen |

### Die zwei Schlüssel (Zusatzrechte, unabhängig von der Rolle)

| Schlüssel | Wofür | Typisch bei |
|---|---|---|
| 🗝 **Arztmodus verwalten** | Ärzte anlegen/entfernen, fremde Karten bearbeiten | **1–2 Ärzte** (genau dein Fall) |
| ✅ **Freigeben** | Siegel setzen/erneuern (`freigabe.js`) | Leitung, evtl. eine Fachkraft |

Warum Schlüssel und nicht zwei weitere Rollen: Deine beiden Ausnahmen sind
**Personen**-Eigenschaften, keine Berufsgruppen. „Dr. Meyer ist Arzt **und** darf
den Arztmodus verwalten" ist eine Zeile mit einem Häkchen — nicht eine fünfte
Rolle namens „Oberarzt-Admin", die man dann pflegen und erklären muss.

### Die Rechte-Tabelle (Musterbeispiel — vollständig, passt auf eine Seite)

| | 👁 Lesen | 🧤 Pflege | 🩺 Arzt | 🛡 Leitung |
|---|:--:|:--:|:--:|:--:|
| Standards lesen, suchen, drucken | ✔ | ✔ | ✔ | ✔ |
| Häkchen setzen, Rüstliste abarbeiten | ✔ | ✔ | ✔ | ✔ |
| „ist leer" melden (Bestellungen) | ✔ | ✔ | ✔ | ✔ |
| Aufgaben abhaken, Aushang lesen | ✔ | ✔ | ✔ | ✔ |
| Zeile ändern · Reichweite **📍 nur hier** | – | **Vorschlag** | **Vorschlag** | sofort |
| Zeile ändern · 📄 Standard / 🗂 Gruppe / 🌐 überall | – | – | – | sofort |
| Eigene **Arzt-Karte** ändern (Variante) | – | – | **sofort** | sofort |
| Fremde Arzt-Karte ändern, Ärzte anlegen | – | – | 🗝 | 🗝 |
| Foto/Bild anhängen, Material erfassen | – | ✔ | ✔ | ✔ |
| Material-Stammsatz bestätigen (Bestell-DB) | – | **Vorschlag** | **Vorschlag** | sofort |
| Vorschläge prüfen (übernehmen/ablehnen) | – | – | – | ✔ |
| Freigabe-Siegel setzen | – | – | – | ✅ |
| Standard anlegen/löschen, Seiten, Menü | – | – | – | ✔ |
| Personen verwalten | – | – | – | ✔ |

Lies die Tabelle einmal quer: **Pflege und Arzt haben dieselbe Spalte, bis auf
eine Zeile** — die eigene Arzt-Karte. Das ist der ganze Unterschied. Genau so
klein soll es bleiben.

## 1.4 Der Kniff: die Rolle begrenzt die *Reichweite* — kein neuer Mechanismus

Deine Anforderung „Pflegekräfte dürfen nur einen bestimmten Bereich bearbeiten"
lässt sich ohne einen einzigen neuen Begriff erfüllen, weil die App die passende
Achse schon hat: die **Reichweiten-Treppe** aus `rules.js`.

```
📍 nur hier   → Pflege darf das (als Vorschlag)
📄 Standard   ┐
🗂 Gruppe     ├→ nur Leitung
🌐 überall    ┘
```

Der Reichweiten-Dialog existiert, zeigt sogar die Trefferzahl vorher an. Für die
Rolle heißt das: **die weiten Stufen sind für Pflege und Arzt gar nicht erst
anwählbar** (ausgegraut mit ehrlichem Grund: „ändert 23 Stellen — das entscheidet
die Leitung"). Grundsatz ⑥ bleibt gewahrt: ein Menü, zwei Kontexte.

Das ist zugleich der wirksamste Schutz überhaupt: Der Schaden in dieser App
entsteht nicht durch „jemand ändert eine Zeile", sondern durch „jemand ändert
versehentlich 23 Zeilen".

## 1.5 Der zweite Kniff: dieselbe Bedienung, anderes Ziel

„Änderungen von Pflegekräften müssen von einem Admin geprüft werden" — dafür
braucht es **keine zweite Oberfläche**. `suggestions.js` kann das bereits.

**Die Weiche liegt an genau einer Stelle:** dort, wo eine Änderung heute
geschrieben wird (`applyPending` in `quickmenu.js`), entscheidet die Rolle:

```
Leitung   → schreibt die Regel (wie heute)
Pflege    → legt denselben Inhalt als Vorschlag ab
Arzt      → am Haus-Standard: Vorschlag · an der eigenen Karte: schreibt sofort
```

Für die Pflegekraft ändert sich **nichts an der Bedienung**: sie tippt lange auf
die Zeile, ändert den Namen, wählt „nur hier", tippt speichern. Danach steht
ehrlich da: *„Als Vorschlag an die Leitung gesendet."* Und die Zeile trägt bis
zur Prüfung ein sichtbares Zeichen (📎), damit im Saal niemand glaubt, es sei
schon beschlossen (Grundsatz ①: leer schlägt falsch).

Das ist die eleganteste Stelle des ganzen Entwurfs: **Vier-Augen-Prinzip zum
Nulltarif**, weil Vorschlagsweg, Bewertung und Übernahme fertig dastehen.

## 1.6 Ärzte, Karten und der Arztmodus — konkret

`variants.js` ist bereits genau das, was du „Procedure Cards" nennst:

- **Der Haus-Standard** bleibt unangetastet (Grundsatz ⑦).
- **Je Arzt eine dünne Karte** darüber: ändern · ausblenden · ergänzen.
- Umschalten über Reiter im Kopf; jede Abweichung farbig markiert.
- Der **aktive Arzt ist gerätelokal** (jeder steht gerade bei einem anderen).

Was fehlt, ist ausschließlich die **Zuordnung Person → eigene Karte**:

```
Person „Dr. Meyer"  →  arztId: "v:abc123"     (seine eigene Karte)
                    →  rolle: "arzt"
                    →  schluessel: []          (darf nur die eigene)

Person „Dr. Ulrich" →  arztId: "v:def456"
                    →  rolle: "arzt"
                    →  schluessel: ["arztmodus"]   ← einer der ein, zwei
```

Damit ist deine Anforderung wörtlich erfüllt: *jeder* Arzt pflegt seine eigene
Spezifikation frei, aber **nur wer den Schlüssel 🗝 trägt, darf Ärzte anlegen,
fremde Karten anfassen oder den Arztmodus überhaupt freischalten.**

Die Unterscheidung „arztspezifisch vs. allgemeingültig" ist dadurch nicht nur
organisatorisch, sondern **strukturell** — sie liegt in zwei verschiedenen
Datentöpfen (`hkl_variants` vs. Haus-Standard) und ist in der Anzeige bereits
sichtbar getrennt.

## 1.7 Woher kommt die Identität? (die eigentlich offene Frage)

Das Rollenmodell ist wertlos ohne eine Antwort auf „wer bist du". Vier Wege,
ehrlich gegeneinander:

| Weg | Alltag im Saal | Verlässlichkeit | Aufwand | Bewertung |
|---|---|---|---|---|
| **A · Passwort je Rolle** (wie heute, aber 4 statt 1) | sehr niedrigschwellig | schwach: Passwörter wandern | sehr klein | Guter **Einstieg**, kein Ziel |
| **B · PIN je Person** aus kleiner Personenliste | ein Tipp, 4 Ziffern | mittel: pro Person nachvollziehbar | klein | **Empfohlen** für Phase 1 |
| **C · GitHub-Anmeldung** (existiert) | braucht Konto + Internet | hoch | vorhanden | Für Pflegekräfte **unrealistisch** |
| **D · Kliniks-Anmeldung** (LDAP/AD, SSO) | vertraut, kein neues Passwort | hoch | groß, IT-Abhängigkeit | **Das Ziel**, wenn die Klinik mitspielt |

**Empfehlung:** B jetzt, D später — und zwar so gebaut, dass der Wechsel **eine
Datei** betrifft. Konkret: Identität und Rechte trennen.

```
  „Wer bin ich?"           →  austauschbar  (PIN | GitHub | SSO)
          ↓ liefert: { personId, name, rolle, station, schluessel[] }
  „Was darf ich?"          →  EINE reine Funktion, testbar
          darfIch('zeile.aendern', { reichweite:'std' })  → true | 'vorschlag' | false
```

Diese eine Funktion ist der Grund, warum das später auch serverseitig scharf
geschaltet werden kann (E1): Sie ist reines JavaScript ohne DOM und ließe sich
im Server-Prozess unverändert aufrufen. **Wer sie sauber schneidet, muss das
Rollenmodell nie zweimal denken.**

## 1.8 Grenze, die nicht verhandelbar ist (Grundsatz A4)

Die Hausregel lautet: **keine personenbezogenen Zugriffsprotokolle** —
mitbestimmungspflichtig, nie beauftragt. Das Rollenmodell muss also:

- **Lesen niemals an eine Anmeldung binden.** Wer in den Saal kommt, sieht sofort
  alles. Angemeldet wird nur, **wer ändern will**. (Das ist auch fachlich
  richtig: eine Anmeldeschranke vor einem Standard ist im Notfall gefährlich.)
- **Namen nur an Änderungen** schreiben — nie an Aufrufe, nie an Suchen. Genau
  wie das Kürzel es heute vormacht.
- **Keine Statistik je Person.** „Wer hat wie oft nachgeschaut" darf es nicht
  geben — auch nicht als Nebenprodukt.

Dieser Punkt ist beim Betriebsrat der Unterschied zwischen Zustimmung und
Ablehnung, und er kostet nichts: Das Modell braucht Identität nur beim Schreiben.

## 1.9 Musterbeispiel: die Verwaltungsoberfläche

Deine Forderung war „übersichtlich, intuitiv, schnell verwaltbar". Vorschlag:
**ein Bildschirm, eine Zeile je Person, alles ohne Untermenü erreichbar.**

```
┌──────────────────────────────────────────────────────────────┐
│ 👥 Personen · Station C71              [＋ Person]  [Suche…] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  MB   Maike B.          🧤 Pflege        · · ·         ⋯     │
│  TS   Dr. Tscheban      🩺 Arzt          🗝 ✅         ⋯     │
│  AU   Dr. Ulrich        🩺 Arzt          · · ·         ⋯     │
│  SK   Sandra K.         🧤 Pflege        · ✅          ⋯     │
│  RB   Robert B.         🛡 Leitung       🗝 ✅         ⋯     │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ 5 Personen · 1 Leitung · 2 Ärzte (1 mit Arztmodus-Schlüssel) │
└──────────────────────────────────────────────────────────────┘
```

Antippen einer Zeile öffnet ein Blatt von unten — **fünf Felder, mehr nicht**:

```
   Name        [ Dr. Tscheban            ]
   Kürzel      [ TSC ]        PIN  [ •••• ]  [neu würfeln]
   Rolle       ( ) Lesen  ( ) Pflege  (•) Arzt  ( ) Leitung
   Eigene Karte  [ Dr. Tscheban ▾ ]        ← nur bei Rolle „Arzt"
   Schlüssel   [✓] 🗝 Arztmodus verwalten
               [✓] ✅ Freigeben

   ⓘ Ändert Rechte auf dieser Station. Lesen bleibt für alle offen.
                                        [Abbrechen]  [Speichern]
```

**Warum das übersichtlich bleibt:**
- Eine Zeile je Person, die Rolle als Symbol+Wort — auf einen Blick lesbar.
- Die beiden Schlüssel als Symbole in der Zeile: man sieht **sofort**, wer den
  Arztmodus verwalten darf, ohne irgendetwas zu öffnen.
- Keine Rechte-Häkchen. Die Rechte stehen in der Tabelle aus 1.3, einmal für
  alle — nicht 40-fach je Person.
- Die Fußzeile beantwortet die einzige Frage, die man beim Draufschauen hat:
  *Ist die Verteilung noch gesund?*

## 1.10 Was der Entwurf bewusst **nicht** enthält

- **Keine Gruppen/Teams.** Bei 5–30 Personen je Station kosten sie mehr, als sie
  sparen.
- **Keine zeitlich befristeten Rechte.** Klingt gut, wird nie gepflegt.
- **Keine feingranulare Objekt-Freigabe** („Frau X darf nur Rubrik 3"). Die
  Reichweiten-Achse deckt den echten Bedarf ab.
- **Keine Selbstregistrierung.** Die Leitung legt Personen an, fertig.

---

# TEIL 2 — Mehrere Stationen (C71 · C81 · C61)

## 2.1 Erst die Wortwahl: „Bereich" ist vergeben

`features/bereiche.js` benutzt **Bereich** bereits für etwas anderes — *steriler
Tisch · Umfeld · Anästhesie* (wohin das Material kommt). Ein zweites „Bereich"
für Stationen würde die klarste Achse der App zerschießen.

**Vorschlag: „Station"** — das Wort, das du selbst benutzt („das sind drei
Stationen bei uns"). Und wie im Haus üblich **konfigurierbar** über
`data/bezeichnungen.json`, falls ein anderes Haus „Abteilung", „Funktionsbereich"
oder „Standort" sagt (Grundsatz ④/⑤).

## 2.2 Der harte technische Befund — er entscheidet die Architektur

Für „jede Station eine eigene PWA über einen eigenen Link" gibt es zwei
Bauweisen: **Unterpfad** (`/s/c71/`) oder **Unterdomäne** (`c71.sops…`). Die Wahl
ist keine Geschmacksfrage, denn:

> **Browser-Speicher ist an den *Origin* gebunden (Schema + Host + Port) — nicht
> an den Pfad.** `localStorage`, `IndexedDB` und der Cache-Speicher sind für
> `/s/c71/` und `/s/c81/` **derselbe Topf**.

Der Service Worker lässt sich auf einen Pfad begrenzen, der **Speicher nicht**.
Diese App legt ihren gesamten Zustand unter festen Schlüsseln ab (`hkl_gtin`,
`hkl_bestellungen`, `hkl_rules`, …). Zwei Stationen auf demselben Origin würden
sich also **gegenseitig überschreiben** — auf demselben Gerät, lautlos.

Zusätzlich: Damit zwei PWAs desselben Origins überhaupt als **zwei** Apps
installierbar sind, brauchen sie **verschiedene `id`-Werte** im Manifest;
gleicher `id` heißt für den Browser „dieselbe App, neue Fassung". Und die
Mehr-PWA-pro-Origin-Kombination hat beim W3C bis heute offene Kanten.

**Damit ist die Empfehlung technisch begründet, nicht stilistisch.**

## 2.3 Drei Bauweisen, ehrlich verglichen

### A) Eine Unterdomäne je Station — **empfohlen**

```
https://c71.sops.kardio.wiki/      → Station C71
https://c81.sops.kardio.wiki/      → Station C81
https://c61.sops.kardio.wiki/      → Station C61
https://leitstand.sops.kardio.wiki/ → Dachsicht der Klinik
```

| | |
|---|---|
| **Speicher** | eigener Origin ⇒ **sauber getrennt**, kein Übersprechen |
| **Service Worker / Offline** | je Station eigener, unverändertes Verhalten |
| **Installation** | eigene App, eigener Name, eigenes Symbol — ohne `id`-Tricks |
| **Anmeldung** | Cookies je Origin getrennt — Rolle je Station fällt natürlich ab |
| **Server** | **ein** Prozess; Station aus dem `Host`-Kopf; eine Zustandsdatei je Station |
| **Kosten** | Wildcard-DNS `*.sops.kardio.wiki` + Wildcard-Zertifikat |
| **Risiko** | gering; der einzige echte Aufwand ist einmalig beim Betrieb |

### B) Ein Unterpfad je Station

```
https://sops.kardio.wiki/s/c71/
```

| | |
|---|---|
| **Speicher** | ⚠ **geteilt** — jeder Schlüssel müsste `hkl_c71_*` heißen |
| **Aufwand** | jeder Speicherzugriff der App muss umgestellt werden |
| **Risiko** | ein vergessener Schlüssel = zwei Stationen überschreiben sich |
| **Vorteil** | kein DNS/Zertifikat nötig |

Machbar, aber der Preis ist eine Umstellung quer durch die App **und** eine
dauerhafte Fehlerquelle, die sich still auswirkt. Nur sinnvoll, wenn die
Klinik-IT keine Unterdomänen herausgibt.

### C) Eine App, Station als Filter

Alles bleibt ein Topf; jede Station sieht nur ihre Standards.

| | |
|---|---|
| **Aufwand** | am kleinsten |
| **Trennung** | keine — jede Station kann alles ändern |
| **Datenmenge** | jedes Gerät lädt **alle** Stationen (bei 3× 4.500 Zeilen spürbar) |
| **Eigener Link** | nur als Startparameter, keine eigene installierte App |

Für zwei sehr ähnliche Bereiche vertretbar, für „C71/C81/C61 mit eigener
Verantwortung" **nicht** zu empfehlen.

## 2.4 Was getrennt gehört — und was auf keinen Fall

Das ist die inhaltlich wichtigste Entscheidung, wichtiger als die Technik:

| Inhalt | Getrennt je Station | Gemeinsam für die Klinik |
|---|:--:|:--:|
| Standards, Rubriken, Einträge | ✔ | |
| Aufgaben, Aushänge, Bestellungen | ✔ | |
| Arzt-Karten (Varianten) | ✔ | |
| Freigaben/Siegel | ✔ | |
| Personen & Rollen | ✔ | |
| **Material-Stammsätze** (`hkl_gtin`) | | ✔ |
| **Material-Verknüpfungen** (`hkl_matlink`) | | ✔ |
| **Bestell-Lernstand** (`hkl_bestlern`) | | ✔ |
| **Bilder** (`/api/media`) | | ✔ |
| Glossar, Merkmalskatalog | | ✔ (mit lokaler Ergänzung) |

**Begründung:** Ein Schleusenset 6F ist auf C71 dasselbe Produkt wie auf C81.
Die gerade gebaute mitwachsende Bestell-Datenbank verliert ihren ganzen Wert,
wenn jede Station bei null anfängt und dasselbe Etikett dreimal fotografiert
wird. Die **Standards** dagegen sind Ausdruck der Arbeitsweise einer Station und
müssen getrennt bleiben — sonst ist es wieder eine Zentral-Datei, gegen die die
App angetreten ist.

Muster: **gemeinsamer Stamm, eigene Standards** — technisch dieselbe
Overlay-Idee, die die App überall benutzt (Grundsatz ⑦): Die Station liest den
gemeinsamen Stamm und darf ihn lokal überlagern, ohne ihn zu verändern.

Da Bilder ohnehin schon inhaltsadressiert unter `/api/media/<Fingerabdruck>`
liegen, ist der gemeinsame Bildspeicher **bereits gebaut** — er funktioniert über
Stationen hinweg ohne eine Zeile Änderung.

## 2.5 Der Leitstand — die Klinik sieht alles und greift ein

```
┌────────────────────────────────────────────────────────────────────┐
│ 🏥 Klinikum · Leitstand                            [＋ Station]    │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  C71  Herzkatheterlabor        47 Standards    ⚠ 3 überholt        │
│       12 Personen · 2 Ärzte     4 Vorschläge offen      [öffnen →] │
│                                                                    │
│  C81  Elektrophysiologie       18 Standards    ✅ alle gültig      │
│       7 Personen · 3 Ärzte      0 Vorschläge            [öffnen →] │
│                                                                    │
│  C61  Station                   6 Standards    📝 4 Entwürfe       │
│       9 Personen                1 Vorschlag             [öffnen →] │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│ Gemeinsamer Stamm: 1.284 Produkte · 96 Bilder · 41 offene Vorschläge│
└────────────────────────────────────────────────────────────────────┘
```

Drei Eigenschaften, die er haben muss:

1. **Er zeigt Zustände, keine Zahlenfriedhöfe.** „3 überholt" heißt: an drei
   Standards wurde nach der Freigabe geändert — genau die Frage, die eine
   Klinikleitung wirklich hat. Das rechnet `freigabe.js` bereits.
2. **„Öffnen" springt in die Station** — mit den Rechten der Klinikleitung. Kein
   zweites Bedienkonzept, dieselbe App (Grundsatz ⑥).
3. **Er ist lesend, außer beim Eingreifen.** Der Leitstand verwaltet Stationen und
   Klinik-Rollen; alles Inhaltliche passiert *in* der Station.

Technisch ist er günstig: Der Server hält ohnehin alle Zustandsdateien; die
Kennzahlen sind eine kleine Zusammenfassung je Datei. **Kein zweites System.**

## 2.6 Eine neue Station anlegen (Musterbeispiel)

```
   Kennung     [ c61 ]          →  https://c61.sops.kardio.wiki
   Name        [ Station C61                 ]
   Symbol      [ 🏥 ]   Farbe  [ ■ ]
   Startinhalt (•) leer
               ( ) Vorlage aus  [ C71 ▾ ]  kopieren
               ( ) nur Struktur (Rubriken ohne Inhalte)
   Erste Leitung  [ Name ]  [ PIN würfeln ]
                                          [Abbrechen]  [Anlegen]
```

Danach hängt am Tresen ein **QR-Code** auf den Stationslink; jedes Gerät im
Kliniknetz öffnet ihn und kann die App über „zum Startbildschirm hinzufügen"
installieren — mit eigenem Namen und Symbol, weil eigener Origin.

## 2.7 Was der Umbau am bestehenden System bedeutet

| Baustein | Änderung | Größe |
|---|---|---|
| `server/state.js` | eine Zustandsdatei **je Station** statt einer | mittel |
| `server/app.js` | Station aus `Host` bestimmen, an die Routen reichen | klein |
| `server/routes/state.js` | liest/schreibt die Station des Aufrufs | klein |
| `public/manifest.webmanifest` | Name/Symbol je Station ausliefern | klein |
| **App-Code (`public/js/**`)** | **unverändert** | – |
| Leitstand | neue kleine Seite + Zusammenfassungs-Route | mittel |
| Betrieb | Wildcard-DNS + Wildcard-Zertifikat | einmalig |

Der springende Punkt: **Bei Bauweise A muss die App selbst praktisch nicht
angefasst werden.** Sie merkt gar nicht, dass sie mandantenfähig ist — jede
Station ist für sie „der Server". Bei Bauweise B wäre genau das anders (jeder
Speicherschlüssel müsste umgebaut werden). Das ist das stärkste Argument für A.

**Migration:** Die heutige Instanz wird zu `hkl.sops.kardio.wiki` (oder `c71.…`),
alle vorhandenen Daten bleiben, wo sie sind. Für die Menschen im Saal ändert sich
nichts außer der Adresse — und die kommt per QR-Code.

---

# TEIL 3 — Zusammenspiel und Vorgehen

## 3.1 Rolle **je Station** — und die Matrix bleibt trotzdem winzig

```
Person          C71          C81          C61        Klinik
──────────────────────────────────────────────────────────────
Maike B.        🧤 Pflege     –            –           –
Dr. Tscheban    🩺 Arzt 🗝     🩺 Arzt      –           –
Robert B.       🛡 Leitung    🛡 Leitung   –           –
Klinikleitung   –            –            –          🏥 alle
```

Regeln, die es klein halten:
- Eine Person hat **je Station höchstens eine Rolle** (kein Rollen-Stapel).
- Die meisten Menschen stehen in **genau einer** Station — die Tabelle ist in der
  Praxis eine Liste, keine Matrix.
- **Klinikleitung** ist eine eigene, seltene Rolle *über* den Stationen.
- Verwaltet wird **in der Station** (dort kennt man die Leute), nicht zentral.

## 3.2 Vorgehen in Stufen — jede Stufe für sich nützlich

| Stufe | Inhalt | Nutzen sofort | Aufwand |
|---|---|---|---|
| **1** | **Rollenmodell im Client**: 4 Rollen, 2 Schlüssel, `darfIch()`, Reichweiten-Begrenzung, Pflege→Vorschlag | Versehen hören auf; Prüfschleife lebt | mittel |
| **2** | **Personen-Verwaltung** (eine Zeile je Person) + PIN-Anmeldung | Namen an Änderungen; Arztmodus-Schlüssel wirkt | mittel |
| **3** | **E1 entscheiden** und `darfIch()` **serverseitig** anwenden | aus Bedienhilfe wird Schutz | mittel |
| **4** | **Stationen** (Bauweise A) + Migration der heutigen Instanz | eigene Links, saubere Trennung | mittel |
| **5** | **Leitstand** + gemeinsamer Stamm über Stationen | Klinik sieht und greift ein | mittel |
| **6** | optional: **SSO** statt PIN | kein zusätzliches Passwort | groß |

Stufe 1 und 2 sind ohne Server-Arbeit möglich und liefern schon den größten Teil
des Alltagsnutzens. Stufe 3 ist die, die aus Ordnung Sicherheit macht — **sie
sollte vor dem klinikweiten Ausrollen (4/5) kommen**, nicht danach.

## 3.3 Entscheidungen, die nur du treffen kannst

| # | Frage | Empfehlung |
|---|---|---|
| **D1** | Wie meldet man sich an? PIN je Person / Passwort je Rolle / SSO | **PIN je Person**, SSO als Ziel |
| **D2** | Gibt die Klinik-IT Unterdomänen (`*.sops…`) heraus? | Klären — davon hängt A vs. B ab |
| **D3** | Bleibt der Material-Stamm klinikweit gemeinsam? | **Ja** — sonst verliert die Bestell-DB ihren Wert |
| **D4** | Darf Pflege am Ende auch „sofort" ändern (📍 nur hier)? | Erst Vorschlag; nach 3 Monaten prüfen |
| **D5** | Wie heißt die Einheit im Haus: Station / Abteilung / Standort? | „Station", konfigurierbar |
| **D6** | Wird E1 vor dem Ausrollen entschieden? | **Ja** — dringend empfohlen |

## 3.4 Was ich bewusst offengelassen habe

- **Notfall-Zugang:** Was passiert, wenn die einzige Leitung im Urlaub ist und
  ein Standard dringend geändert werden muss? Vorschlag für später: ein zweiter
  Leitungs-Zugang ist Pflicht beim Anlegen einer Station (die Oberfläche fragt
  danach). Ungelöst, aber benannt.
- **Rechtliche Einordnung der Freigabe:** Das Siegel ist ausdrücklich *keine*
  Unterschrift im Rechtssinn (`freigabe.js`). Ob eine Klinik das für SOPs so
  akzeptiert, ist eine Hausfrage, keine technische.
- **Wie viele Personen wirklich?** Der Entwurf ist auf 5–30 je Station
  ausgelegt. Bei 200 bräuchte es Gruppen — dann müsste man neu denken.

---

## Quellen

- [Progressive Web Apps in multi-origin sites — web.dev](https://web.dev/articles/multi-origin-pwas)
- [Offline data — web.dev](https://web.dev/learn/pwa/offline-data)
- [Store data on the device — Microsoft Edge Developer documentation](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/offline)
- [Service Worker Scope (PWA) — mittl-medien.de](https://mittl-medien.de/progressive-web-app/scope-service-worker)
- [`id` — Web app manifest, MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/id)
- [Uniquely identifying PWAs with the web app manifest `id` property — Chrome for Developers](https://developer.chrome.com/docs/capabilities/pwa-manifest-id)
- [multiple pwa on same origin could be conflicting for app scoped to path — w3c/manifest #1180](https://github.com/w3c/manifest/issues/1180)

Interne Grundlagen: `docs/GRUNDSAETZE.md` (A4, A9, ⑥, ⑦), `docs/MASSNAHMEN.md`
(E1), `public/js/features/{variants,suggestions,freigabe,rules,kuerzel,bereiche}.js`,
`server/{state,app}.js`, `server/routes/{state,auth}.js`,
`public/manifest.webmanifest`, `public/js/core/{pwa,sync,app-state}.js`.
