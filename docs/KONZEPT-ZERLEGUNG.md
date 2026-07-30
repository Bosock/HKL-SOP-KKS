# Konzept: Zerlegung — Produkt · Verwendung · Position

*Umsetzung von Stufe 1 der Systemanalyse vom 30.07.2026.*

---

## 1. Das Problem in einer Zeile

```
„1x 500ml NaCl-Flasche in die große Coro-Set-Schale, auf Ansage"
   ↓        ↓                    ↓                      ↓
 Menge   PRODUKT             VERWENDUNG            BEDINGUNG
```

In der Word-Vorlage war das **eine Tabellenzeile**. Der Import hat daraus **einen
Eintrag mit einem Namen** gemacht — und dieser Name wurde zur **Identität des
Materials** (`material_key`).

Daraus folgt fast alles, was in der App an der Materialverwaltung nicht
funktioniert:

| Befund | Messung am Bestand |
|---|---|
| Materialschlüssel sind Sätze statt Produkte | **49 %** haben einen Strukturfehler |
| Ein Wirkstoff wird zu mehreren Materialien | Heparin: **5** |
| Tätigkeiten laufen als Gerät | „Raumkontrolle" **44×** |
| Größen spalten ein Produkt auf | Peel-Off-Schleuse: **3** (6F/7F/9F) |
| Tippfehler werden eigene Materialien | **27** Beinah-Paare |
| Import-Artefakte gelten als Eigenschaft | `(en)` aus „Perfusor(en)": **25×** |

Der Merkmalskatalog (`docs/KONZEPT-MATERIALMERKMALE.md`) war die richtige
Antwort auf der falschen Ebene: Er unterscheidet ND und LD am *Stammsatz* —
aber die Standards zeigten weiterhin ihren Word-Satz.

---

## 2. Der Ansatz: subtraktiv, nicht generativ

Die Zerlegung **rät nichts**. Sie zieht ab, was sie sicher erkennt, und was
übrig bleibt, ist der Produktkern:

```
Rohtext
  → putzen            (Kästchen, Ordnungszahlen, Pfeile)
  → Klammern          (sechs Sachverhalte, s. u.)
  → TÄTIGKEIT?        ← Prüfpunkt 1
  → Bedingung         („auf Ansage")
  → Ort               („aus dem Keller", oder aus der Unterkategorie)
  → Zweck             („für die Fixierung des Gerätes")
  → TÄTIGKEIT?        ← Prüfpunkt 2
  → Ziel              („in die große Coro-Set-Schale")
  → Alternativen      („Sauerstoffbrille / Maske")
  → Größe             („6F", „500ml", „0er")
  → REST = Produktkern
```

**Zwei Prüfpunkte für die Tätigkeit** — das ist kein Zufall, sondern das
Ergebnis von drei Fehlern, die erst der Lauf gegen die echten Daten zeigte:

| Zeile | Fehler | wo das Verb steht |
|---|---|---|
| „Benötigte Klappen **aus dem Keller holen**" | Ort-Muster fraß „holen" | am Ende → Punkt 1 |
| „Tuchfixierung **für** OP-Tuch-Stange … **montieren**" | Zweck-Muster fraß „montieren" | am Ende → Punkt 1 |
| „C-Bogen … **auf die rechte Seite rotieren für** Implantation" | Ziel-Muster fraß „rotieren" | erst nach Zweckabzug → Punkt 2 |

---

## 3. Vier Grundsätze

**① Leer schlägt falsch.** Im Zweifel `art='unklar'` statt geraten.

**② Nichts verschlucken.** Jedes Zeichen landet in einem Feld oder im **Rest**.
Im Assistenten steht der Rest ganz oben — er ist die Frage an den Menschen,
kein Kleingedrucktes.

**③ Der Mensch schlägt alles.** Die Zerlegung ist ein Vorschlag. Bestätigtes
wird nie überschrieben, und jede Entscheidung ist einzeln zurücknehmbar.

**④ Kein Fachwort im Code.** Verben, Marker, Orte, Präparate, Farben und
Artefakte stehen ausschließlich in `public/data/zerlegung.json`. Der Code
enthält keinen einzigen Produktbegriff.

---

## 4. Die Klammer trägt sechs Sachverhalte

Das ergiebigste Einzelmuster: 18 % aller Zeilen, 331 Vorkommen, 84
verschiedene Inhalte.

| Klasse | Beispiel | Anzahl |
|---|---|---|
| **Artefakt** (verwerfen) | `(en)` aus „Perfusor(en)" | 25 |
| **Präparat** | `Lidocain 1%`, `Buccain 20ml – Bupivacain` | 44 |
| **Farbe** | `grüne`, `gelb`, `orange` | 59 |
| **Ort** | `Saal 3 Schrank rechts an der Wand` | 11 |
| **Anweisung** | `muss an den Defi angeschlossen werden` | 9 |
| **Bedingung** | `auf Ansage`, `entfällt oft` | 7 |
| **Maß** | `6F`, `150cm` | 13 |
| Erläuterung (Rest) | `Gefäß-Schallkopf`, `C-Bogen` | übrige |

---

## 5. Die Größe gehört nicht in den Namen

Der erste Entwurf **verschlechterte** die Lage: 368 → 396 Schlüssel. Ursache:
Er vermischte Produktidentität und Größe. „6F/7F/9F Peel-Off-Schleuse" wurde zu
drei Materialien.

Fachlich ist das **ein Produkt in drei Größen**. 327 Zeilen im Bestand beginnen
mit einem Maß (`0er` 51× · `500ml` 47× · `6F` 35× · `11er` 28×). Die Größe
gehört zu den Merkmalen (`data/merkmale.json`), der Name zum Produkt.

**Ergebnis nach der Trennung:**

| | vorher | nachher |
|---|---|---|
| Materialschlüssel | 368 | **308** |
| als Tätigkeit erkannt | 0 | **185** |
| unklar (Mensch entscheidet) | — | 50 |

**Der Änderungstest** aus der Analyse:

| | vorher | nachher |
|---|---|---|
| Softasept | 16 Schlüssel | **1** |
| Heparin | 33 | **3** |
| NaCl | 56 | **5** |
| Schleuse | 38 | **29** |

---

## 6. Die Brücke: nichts wird migriert

Ein Wechsel der Identität würde jede vorhandene Verknüpfung verwaisen lassen —
`hkl_matlink` (Stammsatz), `hkl_prod` (Preise), `hkl_care` (Fotos, Lagerorte),
`QE.mat` (Änderungen mit Reichweite „überall").

Deshalb liegt eine **Auflösungsebene** davor (`features/matkey.js`):

```
effMatKey(e, cid)   ① bestätigte Zerlegung
                    ② Vorschlag der Zerlegung
                    ③ alter material_key
                    — nie eine Lücke

matKeyLesen(store, key)
                    liest Alt-Speicher über ALLE Schreibweisen,
                    die auf denselben kanonischen Schlüssel zeigen
```

Eine Zeile, die früher `map 152` hieß, findet damit den Stammsatz, der unter
`map152` verknüpft wurde. Nichts wurde umgeschrieben; das Verwerfen einer
Zerlegung stellt den alten Zustand her.

**Rückfallebene:** Fehlt `data/zerlegung.json`, meldet sich die Brücke als
nicht einsatzbereit, jeder Schlüssel ist exakt der alte `material_key`, und der
Assistent erklärt die Lage, statt leer zu bleiben. End-to-End geprüft.

---

## 7. Der Assistent: einmal entscheiden, überall gültig

Gearbeitet wird an **Texten**, nicht an Stellen: aus 1.869 Einzelstellen werden
**430 Texte**. „OP-Lampengriff" steht 46× im Bestand — das ist *eine*
Entscheidung.

Die Reichweite folgt dem Muster des Hauses:

```
📍 diese Stelle   ZERLDB[cid]      schlägt
🌐 überall        ZERLDB['t:…']
```

— genau wie `QE.cid` vor `QE.mat`.

**Sortiert nach Wirkung:** unklare Fälle vor häufigen. Wer nach zehn Minuten
aufhört, hat die zehn Minuten mit den wirksamsten Fällen verbracht.

Ein bestätigter Produktkern legt weiterhin einen sauberen Stammsatz an
(Zweck → Verwendung, Ort → Lagerort, Hinweis → Hinweis, Alternativen →
Alternative). Vorhandene Angaben werden nicht überschrieben.

---

## 8. Beinah-Dubletten

Die vorhandene Duplikatsuche vergleicht Normalformen und findet deshalb
prinzipbedingt **nicht**, was im Bestand vorkommt:

```
blazer ii xp large curve std distal  ↔  … std disatal
große coro-set-schale …              ↔  große koro-set-schale …
jr 4 diagnostikkatheter              ↔  jr4 diagnostikkatheter
```

`matDubletten()` misst längennormiert über Levenshtein gegen die **kanonischen**
Schlüssel. Am Bestand: **27 Paare**.

**Bewusst nicht automatisch zusammengeführt.** Ein Tippfehler und eine echte
Variante sehen gleich aus („Navitor 23"/„Navitor 25"). Jedes Paar wird mit zwei
Knöpfen zur Wahl gestellt; „Verschiedene Produkte" wird gemerkt.

---

## 9. Geräte sind Exemplare

Ein Verbrauchsartikel ist eine **Sorte** — man nimmt irgendeinen aus der
Schachtel. Ein Gerät ist ein **Exemplar**: Es steht in einem bestimmten Saal,
hat eine Inventarnummer, eine Bedienanleitung, einen Prüftermin und jemanden,
den man anruft.

Der Baustein wäre vorher nicht brauchbar gewesen — „Raumkontrolle" stand 44× als
Gerät im Bestand. Erst weil die Zerlegung Tätigkeiten aussortiert, entsteht eine
echte Geräteliste: **44 Geräte**.

Felder stehen als Daten in `GERAET_FELDER`, nicht als Formularcode.

**Bewusst nicht gebaut:** keine Wartungsverwaltung (wir speichern den Termin,
nicht den Prozess), keine Störungshistorie (dafür die Diagnose-Meldungen), keine
Bestandsführung (bleibt außerhalb der App).

---

## 10. Neue Dateien und Speicher

| Datei | Inhalt |
|---|---|
| `public/data/zerlegung.json` | Regelwerk (Verben, Marker, Orte, Präparate, Farben, Artefakte) |
| `public/js/features/zerlegung.js` | reine Engine, kein DOM, kein Speicher |
| `public/js/features/matkey.js` | die Brücke (kanonischer Schlüssel, Alt-Auflösung) |
| `public/js/features/geraete.js` | Geräte-Stamm |
| `test/zerlegung.test.js` | 58 Tests, Prüfmuster sind echte Zeilen aus dem Bestand |
| `e2e/zerlegung.js` | 34 Prüfungen im echten Browser |

| Speicher | Inhalt | geteilt |
|---|---|---|
| `hkl_zerlegung` | bestätigte Zerlegungen (cid oder Text) | ja |
| `hkl_dubl_ok` | als „verschieden" vermerkte Paare | ja |
| `hkl_geraete` | Gerätesätze | ja |

---

## 11. Ein Fehler, den nur der Browser zeigte

Beim Start lief `buildMaterialIndex()`, **bevor** der Regelkatalog geladen war
(die Datendateien kommen bewusst nach dem ersten Rendern). Der Zwischenspeicher
merkte sich für jede Stelle „keine Zerlegung" — und behielt das. Der Katalog
hätte erst beim **nächsten** Start gewirkt.

Im Unit-Test unsichtbar, weil dort der Katalog immer schon vorlag. Sichtbare
Folge im Browser: 73 statt 185 erkannte Tätigkeiten, „Raumkontrolle" blieb ein
Gerät, Peel-Off-Schleuse blieb drei Materialien.

Das ist die Begründung dafür, dass jede Wirkungsbehauptung in `e2e/zerlegung.js`
**gemessen** wird, nicht nur im Unit-Test geprüft.

---

## 12. Was noch aussteht

**Stufe 1.5 — Bausteine statt Kopien** (nicht umgesetzt). Der größte
Wartungshebel: 72 % aller Einträge sind Kopien, zwei Standards sind bis zu 92 %
identisch. Wiederkehrende Blöcke („Punktion femoral", „Coro-Set aufbauen",
„Sterile Abdeckung", „Abschluss & Verband") sollten einmal definiert und
**referenziert** statt kopiert werden.

Der Mechanismus existiert im Ansatz: Rubriken-Vorlagen mit Geltungsbereich
(`hkl_rubtpl`). Er muss Einträge tragen dürfen, nicht nur Rubriken.

**Stufe 0 — Sicherheit und Konflikte** (nicht umgesetzt, weiterhin dringend):
`/api/state` ohne Authentifizierung · `hkl_authpw` im geteilten Zustand ·
`baseRev` wird gesendet, aber nicht ausgewertet · `hkl_qedits` als ein Schlüssel
für alle Bearbeitungen (stiller Datenverlust bei parallelem Arbeiten).

**Stufe 2 — Anzeige**: Die Zerlegung wirkt heute auf Identität, Materialindex,
Assistent, Dubletten und Geräte. Die **Eintragskarte** im Standard zeigt
weiterhin den Word-Satz. Produkt · Menge · Ziel · Bedingung dort getrennt
darzustellen ist der nächste sichtbare Schritt für die Pflege.
