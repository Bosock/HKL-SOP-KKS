# Der Neuaufbau — ein zweiter, leerer Raum in derselben App

**Stand:** Oktober 2026 · Cache-Version `v76`

**Kurz:** Neben dem **Bestand** (der App, mit der im Herzkatheterlabor jeden Tag
gearbeitet wird) gibt es jetzt einen zweiten Raum, den **Neuaufbau**. Er beginnt
vollständig leer — keine Standards, kein Material, keine Bilder — und ist nur
über ein zweites Passwort in der Verwaltung zu betreten. Was dort geschieht,
erreicht den Bestand nicht. Ist er so weit, lässt er sich mit einem Knopf für
alle **live schalten** — und ebenso zurück (Abschnitt 5). Ziel: die App von Grund auf neu einrichten, wie es ein
Haus täte, das sie zum ersten Mal benutzt — und dabei die Standards im Format der
App aufbauen statt im alten Word-Format.

---

## 1. Was getrennt ist und was nicht

| | Bestand | Neuaufbau |
|---|---|---|
| Geteilter Zustand (Standards, Material, Einstellungen …) | `STATE_DIR/state.json` | `STATE_DIR/raeume/neuaufbau/state.json` |
| Sicherungen | `STATE_DIR/backups/` | `STATE_DIR/raeume/neuaufbau/backups/` |
| Bilder | `STATE_DIR/media/` | `STATE_DIR/raeume/neuaufbau/media/` |
| Gerätespeicher (Browser) | `hkl_…` | `raum:neuaufbau:hkl_…` |
| Offline-Warteschlange für Bilder | IndexedDB `hkl-medien` | IndexedDB `hkl-medien-neuaufbau` |
| Mitgelieferte Standards (47 aus Word) | ja | **nein** |
| Referenzkatalog (527 Produkte), Aufräum-Vorschläge | ja | **nein** |
| Wissen der App (Herstellerliste, Merkmalskatalog, Zerlegungsregeln) | ja | ja |
| Programmcode | gemeinsam | gemeinsam |

**Ehrliche Grenze:** Getrennt sind die **Daten**, nicht der Programmcode. Eine
Änderung am Code erreicht beide Räume. Deshalb erscheinen Neuerungen zunächst
**nur im Neuaufbau** (siehe Abschnitt 4) — im Bestand ändert sich nichts, bis
eine Neuerung dort ausdrücklich freigegeben wird.

**Wie die Trennung gesichert ist** (damit sie nicht an Disziplin hängt):

- Ohne Raumangabe ist auf dem Server **immer** der Bestand gemeint. Die Anfragen
  der Geräte im Labor sehen Byte für Byte aus wie vorher.
- Auf dem Gerät gibt es genau **eine** Stelle, die den Speicher anfasst
  (`core/store.js`). Dort sitzt das Präfix. `npm run check` bricht ab, sobald
  irgendwo anders direkt auf `localStorage` zugegriffen wird.
- Ein Gerät im Neuaufbau tauscht erst dann Daten mit dem Server, wenn der Server
  den Raum **bestätigt** — und jede Antwort muss den Raum nennen. Ein Server ohne
  Räume (etwa nach dem Zurückspielen einer alten Fassung) würde die Raumangabe
  sonst übergehen und Neuaufbau-Daten in den Bestand schreiben.
- Ein Ende-zu-Ende-Test (`e2e/neuaufbau.js`) arbeitet im Neuaufbau und prüft
  danach: Bestand auf dem Server unverändert (Revision, Inhalt, `state.json`
  Byte für Byte), kein Bild im Bestand, kein Bestands-Schlüssel im Gerätespeicher
  verändert.

## 2. Hinein und hinaus

1. **Verwaltung → Daten & Sicherung → 🧪 Neuaufbau.**
2. Passwort des Neuaufbaus eingeben → **Neuaufbau betreten**. Die Seite lädt
   neu, man ist dort gleich angemeldet.
3. Solange der Neuaufbau **nicht** live ist, steht über allem ein **violettes,
   gestreiftes Band** („NEUAUFBAU · getrennter Raum"), auf jedem Bildschirm. Der
   Fenstertitel beginnt mit „Neuaufbau".
4. **Verlassen** im Band → in den Raum, der gerade live ist. Hinaus geht es
   immer ohne Passwort.

### Die Passwörter

| | Bestand | Neuaufbau |
|---|---|---|
| Verwaltung | wie bisher (Vorgabe `1234567`, falls nie geändert) | eigenes, Vorgabe `abcdefg` |
| Betreten des Neuaufbaus, Freigaben, Live-Schalter | — | Vorgabe `abcdefg` |

- Das **Passwort des Neuaufbaus** (Zweitpasswort) lässt sich im Bestand unter
  „Passwort des Neuaufbaus ändern" ändern (mindestens vier Zeichen, anders als
  das Verwaltungspasswort). Es liegt als Fingerabdruck im geteilten Zustand des
  Bestands (`hkl_raumpw`) und gilt damit auf jedem Gerät — und auf dem Server,
  der beim Live-Schalter dagegen prüft.
- Das **Verwaltungspasswort** gilt seit `v76` auf **allen Geräten** eines Raums.
  Vorher lag es als roher Text im Speicher; der Abgleich hat es übergangen, eine
  Änderung galt nur auf dem einen Gerät. Ein solcher alter Wert gilt weiter, aber
  nur auf seinem Gerät — niemand verliert seinen Zugang. Wer das Passwort neu
  setzt, setzt es für alle.

Beide Passwörter sind — wie bisher — **Komfort, keine Sicherheit** (Grundsatz
A9): Sie verhindern, dass jemand versehentlich im Testraum landet oder
versehentlich umschaltet. Gegen Absicht schützen sie nicht.

## 3. Was im Neuaufbau neu ist

### 3.1 Material erfassen (Produkt-Stammsatz)

Der Weg: **Barcode scannen → Etikett fotografieren → Produkt fotografieren →
Name, Synonyme.** Im Produktformular (Materialzentrale, Scanner oder „📷 Material
erfassen" auf der leeren Startseite):

- **GTIN der Einheit ist der Hauptschlüssel.** Einheit = was im Saal einzeln
  verbraucht wird (der Katheter in seiner Sterilverpackung, nicht der
  Zehnerkarton).
- **Verpackungsstufen:** Ein Karton hat eine eigene GTIN — sie wird mit der Zahl
  der Einheiten darin an die Einheit gehängt; eine Stufe lässt sich als
  **Bestelleinheit** markieren. Wer den Karton scannt, landet beim Produkt der
  Einheit, statt ein zweites anzulegen.
- **AccessGUDID** wird bei einer neuen GTIN gefragt. Ist die gescannte Nummer
  eine **Verpackung**, sagt die App das („Das ist eine Verpackung mit 40 Stück.
  Die Einheit hat GTIN …") und legt das Produkt mit einem Tipp **unter der
  Einheit** an. Bekannte Verpackungsstufen und Angaben (REF, Hersteller, Name)
  lassen sich übernehmen — nur in leere Felder, bitte mit dem Etikett vergleichen.
- **Prüfziffer:** Eine von Hand getippte GTIN wird gegen die GS1-Prüfziffer
  geprüft — Zahlendreher fallen sofort auf.
- **REF ist der Zweitschlüssel.** Steht dieselbe REF (auch in anderer
  Schreibweise) schon an einem anderen Produkt, meldet die App das sofort und
  speichert erst nach bewusster Bestätigung.
- **Bilder mit Rolle:** Etikett · Produkt · Verpackung · Sonstiges. Zwei
  Schnellknöpfe öffnen die Kamera und geben die Rolle gleich mit. Bilder heißen
  in der App **nicht** wie die GTIN — erst beim Export bekommen sie den Namen
  `GTIN_REF_rolle.jpg`.
- **Synonyme:** andere Bezeichnungen (Komma-getrennt), unter denen das Produkt
  gefunden wird — in der Suche und beim Zusammenstellen eines Standards.

### 3.2 Beziehungen zwischen Produkten

- 🧩 **Braucht dazu** (gerichtet): Der Inquiry-Katheter braucht das Kabel
  IBI 1910SA — nicht umgekehrt. Am Kabel steht die Gegenrichtung („wird
  gebraucht von …") als Auskunft.
- ♻️ **Aufbereitete Fassung von:** Ein Aufbereiter (z. B. Vanguard) bringt das
  Produkt als eigener Hersteller mit eigenem Etikett und eigener Nummer in
  Verkehr (MDR Art. 17). Das ist ein **zweites Produkt** mit einer Beziehung zum
  Original; das Original zeigt „gibt es auch aufbereitet".
- Festlegen: im Produktformular, im Schnellmenü einer Zeile (🧩 / ♻️) und im
  Editor an der Zeile.
- **Offen gelassen (bewusst):** wie Zubehör in der Rüstliste erscheinen soll. Das
  soll der Test zeigen. Festgehalten wird es schon jetzt.

### 3.3 Editor am PC

Am breiten Bildschirm (ab 900 px) steht im Standard **„🖥 Im Editor
bearbeiten"**. Der Bildschirm teilt sich:

- **links die Bibliothek:** 📦 Material (die erfassten Produkte) · 🖥 Geräte ·
  🧱 Bausteine · ✍️ Freitext · 📋 Vorlagen (Rubriken anderer Standards)
- **rechts der Standard:** alle Rubriken untereinander, mit ihren Abschnitten.

**Grob per Ankreuzen:** Ein Haken links legt das Produkt im **Ziel** an (rechts
violett umrandet; ein Tipp auf einen Abschnitt macht ihn zum Ziel). Haken weg
nimmt es heraus. **Fein per Ziehen:** am Griff ⠿ — ohne Modus, innerhalb eines
Abschnitts, zwischen Abschnitten, zwischen Rubriken, und aus der Bibliothek
direkt an die Stelle. ▲ ▼ tun dasselbe ohne Ziehen. Menge direkt in der Zeile;
Doppelklick öffnet das Eintragsformular. Fehlt Zubehör eines Produkts im
Standard, steht an der Zeile „🧩 braucht … ＋" — ein Tipp ergänzt es.

**Eine Zeile zeigt auf ein Produkt, nicht auf ein Wort:** Wird das Produkt
umbenannt, folgt die Zeile.

**Nichts verrutscht:** Wird eine Zeile verschoben, wandern alle an ihr
hängenden Änderungen mit (Menge/Name „nur hier", Regeln, Häkchen, Arzt-Varianten,
bestätigte Zerlegung) — sie treffen nie die Nachbarzeile, die nachrückt. Regeln
werden dabei am alten Platz zurückgenommen und am neuen neu gesetzt; der Umzug
steht im Journal.

Am Handy erscheint der Editor nicht — dort bleibt die Bedienung, wie sie ist.

### 3.4 Export für Excel / SAP

Materialzentrale → **⬇ Export für Excel/SAP**:

- **Tabelle (CSV):** GTIN (Einheit) · REF · Name · Hersteller · Kategorie ·
  Synonyme · Stückpreis · Packungsgröße · GTIN der Bestelleinheit ·
  Packungspreis · Verpackungsstufen · Lagerort · Maße · Braucht dazu ·
  Aufbereitung · Bildnamen · Daten. Öffnet sich direkt in Excel (Semikolon).
- **Tabelle + alle Bilder (ZIP):** dieselbe Tabelle und die Bilder als
  `GTIN_REF_rolle.jpg`.
- Für SAP: GTIN ↔ EAN-Feld des Materialstamms, REF ↔ Herstellerteilenummer.

### 3.5 Notizen

Im violetten Band steht **📝 Notiz** — auf jedem Bildschirm (ist der Neuaufbau
live, gibt es kein Band mehr; dann über Verwaltung → 📝 Notizen → „Neue Notiz"). Eine Notiz (💡
Wunsch · 🐞 Fehler · ❓ Frage · 📝 Inhalt) merkt sich automatisch, **wo** sie
entstand (Standard, Rubrik, Produkt, Bildschirm). Durchsehen, abhaken und als
Datei sichern: Verwaltung → **📝 Notizen**. Die Datei ist die Grundlage für das,
was in den Bestand übergehen soll.

## 4. Neuerungen für den Bestand freigeben

Verwaltung → 🧪 Neuaufbau → **„Neuerungen für den Bestand freigeben"** →
Zweitpasswort → je Neuerung ein Schalter:

| Schlüssel | Neuerung |
|---|---|
| `fotorollen` | Bildrollen am Produkt + Schnellknöpfe |
| `synonyme` | Synonyme am Produkt |
| `refpruefung` | REF als Zweitschlüssel (Dublettenwarnung) |
| `verpackung` | Verpackungsstufen, Karton-Scan, Prüfziffer, AccessGUDID-Hinweise |
| `materialexport` | Export für Excel/SAP |
| `editor` | Editor am PC |
| `beziehungen` | Zubehör & Aufbereitung |

Eingeschaltet erscheint die Neuerung sofort auf allen Geräten des Bestands;
ausschalten blendet sie wieder aus, Daten gehen dabei nicht verloren. Die
Notizen bleiben dem Neuaufbau vorbehalten.

**Für Entwickler:** Jede Neuerung fragt `neuFrei('<schlüssel>')`
(`features/raum.js`). Neues gehört in diese Liste — nie stillschweigend in den
Bestand.

## 5. Live schalten — und zurück

„Live" ist der Raum, mit dem jedes Gerät **ohne eigene Raumwahl** arbeitet —
also das Labor. Zu Beginn ist das der Bestand.

**Der Knopf:** Verwaltung → 🧪 Neuaufbau → **„Live schalten"** (in beiden Räumen
erreichbar). Passwort des Neuaufbaus eingeben, Häkchen „Ja — ab jetzt soll der
Neuaufbau für alle live sein" setzen → **Neuaufbau live schalten**. Der Knopf
bietet immer den Raum an, der gerade **nicht** live ist; zurück heißt er
**„Bestand wieder live schalten"**.

Was dann geschieht:

- Der Server setzt den Zeiger in `STATE_DIR/raeume.json` (mit Zeitpunkt und
  Verlauf der letzten 20 Umschaltungen). Er prüft das Passwort selbst — falsches
  Passwort: `403`, nichts geschaltet. Wirksam ohne Neustart.
- **Wer umschaltet, geht mit:** Das Gerät lädt im neuen Live-Raum neu (und ist
  dort angemeldet). Steht es schon darin, verschwindet nur das Band.
- **Die anderen Geräte folgen** beim nächsten Start oder Aufwecken (Tablet aus
  dem Ruhezustand, Tab wieder im Vordergrund). Ein Rechner, an dem die App den
  ganzen Tag offen steht, sieht jede Minute nach. **Wer gerade arbeitet, wird
  nicht herausgerissen:** Er sieht das Band „nicht live" mit **Verlassen** und
  wechselt von selbst erst nach zwei Minuten ohne Bedienung (und ohne offene,
  noch nicht übertragene Änderungen).
- Beim Folgen wechselt jedes Gerät seinen **lokalen** Speicherbereich mit — es
  trägt also keine Bestandsdaten in den Neuaufbau („Erstbefüllung"). Das prüfen
  `e2e/neuaufbau.js` und `e2e/liveschalter.js`.
- Der Zeiger lenkt **keine** Anfrage um: Ohne Raumangabe bleibt jede Anfrage
  beim Bestand. Daten werden beim Umschalten nicht bewegt, nichts wird gelöscht.

**Das Band folgt dem Live-Raum:** Im Live-Raum gibt es keins — das ist die App,
wie alle sie benutzen. Ist der Neuaufbau live, verschwindet sein violettes Band.
Wer dann den **alten Bestand ansieht** (Karte im Neuaufbau → „Alten Bestand
ansehen", ohne Passwort), bekommt ein braunes Band „BESTAND · nicht live";
**Verlassen** führt zurück in den Live-Raum.

**Eigene Wahl:** Nur wer einen Raum betritt, der gerade **nicht** live ist,
behält eine eigene Wahl (das Gerät bleibt dort, egal was live ist). Wer in den
Live-Raum geht — auch über Verlassen —, folgt wieder dem Zeiger. Wird der Raum,
den ein Gerät gewählt hat, selbst live geschaltet, gibt es seine Wahl auf und
folgt fortan dem Zeiger (also auch einem späteren Zurückschalten).

**Zurückschalten** ist dieselbe Handbewegung mit demselben Knopf. Jedes Gerät
findet seinen alten Bestand so vor, wie er beim Umschalten war; was im
Neuaufbau entstanden ist, bleibt dort.

**Für den Betrieb:** Der Zeiger lässt sich weiterhin auch direkt in
`STATE_DIR/raeume.json` setzen (`{ "live": "neuaufbau" }` bzw. `"bestand"` oder
Datei löschen).

Stückweises Übernehmen von **Inhalten** (einzelne Standards, Produkte) aus dem
Neuaufbau in den Bestand ist der nächste Schritt und noch nicht gebaut.

## 6. Schnittstelle (für Betrieb und Entwicklung)

- `GET/PUT /api/state?raum=neuaufbau` — wie `/api/state`, Antwort trägt `raum`.
- `GET/POST /api/media[/<kennung>]?raum=neuaufbau` — eigener Bilderordner;
  Bilder des einen Raums sind im anderen nicht abrufbar.
- `GET /api/raeume` → `{ live, geaendert, raeume:[{id,titel,basis,rev,updatedAt,schluessel}] }`
- `PUT /api/raeume` `{ live:'neuaufbau'|'bestand', pw:'<Fingerabdruck>' }` →
  `200 { live, geaendert }` · `403` falsches Passwort · `400` unbekannter Raum.
  Erwartet wird `hkl_raumpw` aus dem Bestand, sonst der Fingerabdruck der
  Vorgabe (`server/raeume.js`, `RAUM_PW_VORGABE` — wortgleich mit
  `features/raum.js`).
- Unbekannte Raumangabe → `400` (nie still der Bestand).
- Die Raumliste ist fest (`server/raeume.js`); über eine Anfrage entsteht kein
  neuer Ordner.
