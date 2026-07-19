# Konzept: Merkmale am Eintrag — beliebige Eigenschaften, sauber mit Reichweite

Stand: 2026-07-19 · Betreiber-Anforderung: „In der Eintrag-bearbeiten-Maske
möchte ich zu jedem Material weitere Eigenschaften anlegen können — nicht nur
EINE Größe, sondern z. B. bei Nahtmaterial Stärke UND Länge UND geflochten/
monofil UND Nadelform. Und beim Speichern will ich wie überall gefragt werden:
nur hier · dieser Standard · Eingriffsgruppe · überall."

## 1. Analyse des Ist-Stands

### Was das Datenmodell schon kann (aber die Maske versteckt)

| Baustein | Ist-Stand | Befund |
|---|---|---|
| `groessen` | **Array** `[{typ,wert,roh}]` — mehrere Größen pro Eintrag; `sizeBadges()` rendert alle; Regel-Prop mit Reichweite | Die Maske zeigt nur `groessen[0]` (EIN Typ+Wert-Paar). **Datenverlust-Bug:** Beim Speichern eines Eintrags mit mehreren Basis-Größen (z. B. „6F" + „260cm") überschrieb die Maske das Array mit max. 1 Element — die zweite Größe war weg. |
| `zusatz` | **Array** `[{n,w}]` — freie Name+Wert-Felder („Schrank: B3"); Badge-Anzeige, Regel-Prop, Journal, Sync — alles vorhanden (Souveränitäts-Paket N3) | Nur über das Schnellmenü (⋯ → 🧩 Eigene Felder) erreichbar, **fehlt in der Bearbeiten-Maske** — genau dort, wo man beim Pflegen eines Eintrags ohnehin ist. |
| Reichweiten-Frage der Maske | Seit v20: `saveEntryForm` → 4-Stufen-Sheet (📍/📄/🗂/🌐) für Material-Einträge, nur echte Änderungen werden Regeln | Deckt `groessen` bisher nur als Einzelgröße ab, `zusatz` gar nicht. |
| Größen-Typen | Fester Katalog: Fr, Länge, Ø, Vol, Maß, Stärke (Naht), Größe, Typ, Ø·Fr | Reicht für Messbares. „Geflochten/monofil", „Nadel 5/8", „Rundkörper" sind KEINE Größen — sie brauchen freie Namen. |

### Kernbefund

Es fehlt kein neues Speichersystem — es fehlt die **Bedienoberfläche**, die die
vorhandenen zwei Bausteine (`groessen` mehrfach + `zusatz` frei) in der Maske
zugänglich macht, und ihre **Anbindung an die Reichweiten-Frage**.
Das ist die architektonisch sauberste Lösung: keine neuen Datenpfade, keine
neuen Sync-Schlüssel, kein neues Anzeige-Rendering — alles läuft über den
EINEN bestehenden Schreibweg (Regeln mit Journal).

## 2. Zielbild (Konzept)

### 2.1 Die Maske bekommt einen „Merkmale"-Bereich mit zwei Listen

```
Merkmale
├── GRÖSSEN (messbar, typisiert — beliebig viele)
│   [Stärke ▾] [4-0        ] ✕
│   [Länge  ▾] [45cm       ] ✕
│   ＋ Größe
└── EIGENE MERKMALE (frei benannt — beliebig viele)
    [Struktur   ] [geflochten ] ✕
    [Nadel      ] [5/8        ] ✕
    [Nadelform  ] [Rundkörper ] ✕
    ＋ Merkmal
```

- **Größen**: Zeile = Typ-Auswahl (Fr, Länge, Ø, Vol, Maß, Stärke, Größe, Typ,
  Ø·Fr) + Wert. Speichert ins bestehende `groessen`-Array → farbige
  Größen-Badges am Eintrag. Der Datenverlust-Bug ist damit behoben: ALLE
  Größen erscheinen in der Maske und bleiben erhalten.
- **Eigene Merkmale**: Zeile = freier Name + Wert. Der Name schlägt per
  Datalist alle bereits irgendwo verwendeten Merkmal-Namen vor (wählen ODER
  frei tippen — Souveränitäts-Muster). Speichert ins bestehende
  `zusatz`-Array → Badge „Name: Wert" am Eintrag.
- Beide Listen sind mit ✕ je Zeile kürzbar. Leere Werte werden ignoriert.

### 2.2 Reichweite: IMMER gefragt, aber nur für echte Änderungen

Beim Speichern ermittelt `entryFormChanges()` feldgenau, was sich WIRKLICH
geändert hat (jetzt inkl. Größen-Array und eigener Merkmale). Bei Einträgen
mit geteiltem Material (`material_key`) erscheint dann die bekannte
4-Stufen-Frage mit Treffervorschau:

- 📍 **Nur hier** — nur an dieser Stelle
- 📄 **In diesem Standard**
- 🗂 **In der Eingriffsgruppe** (EPU, CRM, PCI …) — mit „betrifft X× in Y Standards"
- 🌐 **Überall** — alle Einträge dieser Art

Jede Wahl wird als Regel journaliert (🧾 Regeln & Journal, rücknehmbar) und
auf alle Geräte synchronisiert. Gruppe/Überall bestätigen mit Trefferzahl.

**Bewusste Ausnahme:** Selbst angelegte (eigene) Einträge existieren nur an
ihrer einen Stelle — es gibt nichts „auszurollen", die Frage entfällt dort
ehrlicherweise. Katalog-Einträge behalten ihre einfache Ein-Größen-Zeile
(der Katalog ist eine Schnell-Auswahlliste, kein Standard-Inhalt).

### 2.3 Warum ZWEI Listen statt einer gemischten?

Größen sind typisiert (einheitliche Kürzel-Badges, automatische Erkennung beim
Import, druckbar), eigene Merkmale sind frei. Eine gemischte Liste müsste
beides in einer Zeile abbilden (Typ-Dropdown MIT „eigener Name"-Sonderfall) —
mehr Bedienschritte für den häufigen Fall. Zwei klar beschriftete Listen sind
selbsterklärend und entsprechen 1:1 dem Datenmodell.

## 3. Umsetzungsplan

1. **forms.js**: `entryToForm` liefert `groessen`-Array + `zusatz` vollständig;
   Merkmale-Editor (Zeilen dynamisch, ✕, ＋, Namens-Datalist);
   `readEntryForm` sammelt beide Listen; `entryFormChanges` diffe Arrays;
   `applyBaseEntryEdit` schreibt beide (Nicht-Material-Pfad).
2. **additions.js**: `makeAddEntry` übernimmt Größen-Liste + Merkmale in den
   eigenen Eintrag (dort direkt gespeichert, kein Regel-Umweg nötig).
3. **detail.js**: Badge-Anzeige fällt bei eigenen Einträgen auf `e.zusatz`
   zurück (Regeln haben weiter Vorrang).
4. **Tests**: neue E2E-Suite `merkmale.js` — mehrere Größen + eigene Merkmale
   anlegen, Reichweiten-Frage, „Überall"-Ausrollung, Badge-Anzeige,
   KEIN Datenverlust bei Mehrfach-Größen, eigener Eintrag.
5. SW-Cache-Bump, Gesamtregression (Unit + alle E2E), Deploy.

## 4. Was bewusst NICHT Teil dieses Pakets ist

- **Eigene Größen-TYPEN** (neues Kürzel im Typ-Katalog): freie Merkmale decken
  den Bedarf; ein Typ-Editor wäre ein eigenes kleines Paket (M-Backlog).
- **Merkmal-Vorlagen je Kategorie** (z. B. „Nahtmaterial hat immer Stärke,
  Struktur, Nadel"): sinnvoller Folgeschritt, sobald sich aus der Nutzung
  wiederkehrende Muster zeigen (die Namens-Datalist sammelt sie bereits).
