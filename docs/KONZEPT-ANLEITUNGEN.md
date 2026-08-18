# Konzept — Anleitungen, Pop-ups und Arzt-Varianten

Vier Bausteine, die zusammen die App von „Standards nachschlagen" zu
„Standards **und** Anleitungen nutzen, mit Rückfragen und arztspezifischen
Abweichungen" erweitern. Alle vier bauen auf der vorhandenen Engine auf —
es gibt kein zweites System daneben.

---

## 1. Anleitungen (`hkl_guides`, `js/features/guides.js`)

**Warum getrennt von den Standards?** Fachlich sind das zwei Inhaltsarten:

| | Standard (SOP) | Anleitung (Arbeitsanweisung) |
|---|---|---|
| Frage | „Für Eingriff X: welches Material, welche Phasen?" | „Wie mache ich Aufgabe Y — Schritt für Schritt?" |
| Struktur | Matrix (Rubrik × Kategorie) | lineare Schritt-Sequenz |
| Ordnung | Fachgebiet (TAVI, EPU …) | Bereich (Aufbau, Gerät, Bestellen …) |

Das Mischen zweier Inhaltsarten ist die häufigste Ursache für unbrauchbare
Dokumentation (Diátaxis-Regel). Deshalb: **ein Umschalter oben**
(`Standards | Anleitungen`), zwei getrennte Räume, aber **eine** Suche.

Datensatz:

```js
{ id, titel, bereich, kurz, intervall, notfall,
  schritte: [ { id, text, bild, warn, tipp } ], createdAt, updatedAt }
  /* `bild` ist eine ADRESSE (`/api/media/<Kennung>`), kein Bild: die Bytes
     liegen einzeln auf dem Server (features/medien.js). Anders wandert bei
     jeder Textänderung der ganze Bildbestand mit — und der Gerätespeicher
     ist nach wenigen Fotos voll. */
```

* `bereich` gruppiert wie die `gruppe` eines Standards
  (Aufbau & Vorbereitung · Gerät bedienen · Bestellen & Material ·
  Regelmäßige Aufgaben · Patient & Ablauf · Notfall · Hinweise).
* `intervall` ist für wiederkehrende Aufgaben da („monatlich"). Das Feld ist
  bewusst schon vorhanden, damit die geplante **Erinnerung/Benachrichtigung**
  daran andocken kann, ohne das Datenmodell zu ändern.
* `warn` / `tipp` sind abgesetzte Kästen — der Handlungsfluss bleibt knapp,
  Hintergrundwissen funkt nicht dazwischen.
* Häkchen laufen über denselben (gerätelokalen, täglich zurückgesetzten)
  Speicher wie die Standards, Schlüssel `g|<guideId>|<schrittId>`.

## 2. Foto-Detailansicht (`js/features/lightbox.js`)

App-weit, nicht nur für Anleitungen: **jedes** Bild mit `data-zoom` öffnet
eine Vollbild-Lightbox (Doppeltippen · Pinch · Ziehen · Escape). Ein
Aufbau-Foto muss man heranziehen können, bis das Detail erkennbar ist.
Registriert wird das einmalig über `initLightbox()` in `main.js`
(delegierter Klick-Handler — einzelne Ansichten brauchen kein eigenes
`onclick`).

## 3. Konfigurierbare Pop-ups (`hkl_popups`, `js/features/popups.js`)

Abfragen an bestimmten Stellen („beim Abhaken von *ACT* nach dem Wert
fragen") sind je Haus verschieden. Deshalb sind sie **vollständig über eine
Oberfläche** konfigurierbar — es wird nie Code angefasst. Vier Teile:

1. **Auslöser** — Ereignis (`check`, `uncheck`, `standard-oeffnen`,
   `anleitung-oeffnen`) und Geltung (`alle`, `text`-Muster, ein bestimmter
   Standard bzw. eine Anleitung).
2. **Aussehen** — Titel, Text, Stil (Frage / Warnung / Hinweis).
3. **Felder** — beliebig viele eigene Eingaben je Pop-up
   (Text · Zahl · Auswahl · Ja/Nein), einzeln als Pflichtfeld markierbar.
4. **Aktionen** — Beschriftung und Wirkung von Bestätigen/Ablehnen
   (`nichts` · `haken-entfernen` · `haken-setzen`).

Der Kern ist die reine Funktion `popupMatches(p, ctx)` — sie entscheidet, ob
ein Pop-up zu einem Auslöser passt, und ist voll testbar. Antworten landen
gedeckelt in `hkl_popup_log` (z. B. dokumentierte ACT-Werte).

Ausgelöst wird zentral über `popupFire(ctx)` aus `toggleCheck`,
`toggleGuideCheck`, `openStandard` und `openGuide`.

## 4. Arzt-Varianten (`hkl_variants`, `js/features/variants.js`)

Der Standard bleibt **unangetastet**; je Arzt liegt ein dünnes Overlay
darüber, das drei Dinge kann: einen Eintrag **ändern** (Name/Menge/Hinweis),
**ausblenden** oder **ergänzen**.

```js
{ aerzte: [ { id, name, kurz, farbe } ],
  data: { <arztId>: { qe: { <cid>: {name,menge,hinweis} },
                      hidden: { <cid>: true },
                      added:  { "<sid>|<ri>": [ {id,name,menge} ] } } } }
```

Bedienung: Reiter im Kopf des Standards (`Standard | Dr. X`). Jede Abweichung
ist doppelt markiert — farbiger Rahmen **und** Kürzel-Badge —, damit immer
sichtbar bleibt, was Haus-Standard und was arztspezifisch ist (Tab-Muster +
Diff-Markierung; „nahtlos integriert, aber klar unterscheidbar").

Der **aktive Arzt ist gerätelokal** (`hkl_curvariant`) — jeder arbeitet
gerade bei einem anderen. Die Varianten-**Inhalte** werden geteilt.

In der Kaskade liegt die Variante **ganz oben**: `entryCardHTML` fragt erst
`varGet(cid, …)`, darunter greift unverändert die bisherige Auflösung
(Regeln → QE → Basis).

## 5. Suche über alles, nach Typ getrennt (`js/features/search.js`)

Ein Suchfeld, ein Ergebnis — **untereinander mit großen Trennern**:

```
📋 Standards      → Treffer je Standard gruppiert (Rückwärtssuche Material → Eingriff)
📘 Anleitungen    → Titel-, Kurz- und Schritt-Treffer
🧬 Material       → Stammsätze + „wird genutzt in: …"
```

Zusätzlich sucht `searchStandard()` **innerhalb** eines Standards jetzt auch
über Synonyme, Spezifikation, Größen und — falls das Material einem
Stammsatz zugeordnet ist — dessen Name/REF/Hersteller/Kategorie/Lagerort.
Damit findet „IntellaNav" oder „20ml" den Eintrag auch bei abweichender
Schreibweise im Standard.

## 6. Übersicht: Sortierung & Favoriten (`js/features/listview.js`)

Die Sortierung ist umstellbar und gilt für beide Inhaltsarten:
Bereich · A–Z · Favoriten · Meistgenutzt · Zuletzt · Kosten (nur Standards,
aus `stdPlankosten`) · Fällig (nur Anleitungen, aus `intervall`).

`sortValid(key, seg)` sorgt dafür, dass eine bereichsfremde Sortierung
(z. B. „Kosten" bei Anleitungen) sauber auf „Bereich" zurückfällt.
Favoriten (`hkl_fav`) und Nutzungszähler (`hkl_usage`) sind **gerätelokal**,
weil sie pro Person verschieden sind.

---

## Persistenz-Überblick

| Schlüssel | Inhalt | geteilt? |
|---|---|---|
| `hkl_guides` | Anleitungen | ja |
| `hkl_popups` | Pop-up-Konfiguration | ja |
| `hkl_popup_log` | Antwort-Protokoll | nein (lokal, gedeckelt) |
| `hkl_variants` | Ärzte + Abweichungen | ja |
| `hkl_curvariant` | gerade gewählter Arzt | nein (gerätelokal) |
| `hkl_fav`, `hkl_usage`, `hkl_sort` | Favoriten/Nutzung/Sortierung | nein (gerätelokal) |

## Tests

* Unit (`test/client-helpers.test.js`): `sortValid`, `sortItems`,
  `guideSearch`, `intervalRank`, `popupMatches`, `popupMissing`,
  `popupOptions`, `varKurz`, `varGet`, `varHidden`, `varChanged`,
  `varDiffCount`, `lbClampScale`, `lbTouchDist`.
* E2E (`e2e/features.js`): Anleitung anlegen → Schritte → abhaken →
  Lightbox; Pop-up visuell konfigurieren → auslösen → Pflichtfeld →
  Ablehn-Aktion; Arzt anlegen → Abweichung → Ausblenden → zurück auf
  Standard; Suche mit Typ-Trennern.
