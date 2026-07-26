# Fehler- und Problemanalyse

> Ziel: Die App soll **ohne Entwickler** benutzbar und wartbar sein. Dafür
> muss man nachsehen können, was schiefgelaufen ist — und zwar so, dass aus
> „geht nicht" ein bearbeitbarer Befund wird.

## 1. Der Anlass: warum es das braucht

Anleitungen ließen sich auf dem Handy nicht öffnen. Am Schreibtisch
funktionierte alles. Kein Absturz, keine Fehlermeldung, kein Eintrag
irgendwo — **technisch passierte schlicht nichts.**

Das ist der schwierigste und häufigste Fehlertyp. Eine klassische
Fehlerbehandlung hätte ihn nie gemeldet, weil aus Sicht des Programms nichts
Falsches geschah. Nur der Mensch vor dem Gerät wusste: *das hätte jetzt
passieren müssen.*

Daraus folgen die drei Bausteine.

## 2. Die drei Bausteine

### Baustein 1 — Technische Fehler (automatisch)

Wird ohne Zutun erfasst und landet im Protokoll:

| Quelle | Was sie liefert |
|---|---|
| `window.onerror` | JavaScript-Fehler samt Datei und Zeile |
| `unhandledrejection` | Fehler in asynchronen Abläufen (Netz, OCR, Kamera) |
| Ressourcen-Fehler | Bilder/Skripte, die sich nicht laden ließen |
| **rote Fehler-Toasts der App** | die wertvollste Quelle: genau die Stellen, an denen die App selbst sagt „das hat nicht geklappt" |

Jeder Eintrag trägt automatisch: Zeitpunkt, aktiver Bildschirm, der **Weg
dorthin** (die letzten Stationen) und — bei Meldungen — das Gerät.

**Flutungsschutz:** Gleiche Art + gleicher Text + gleicher Bildschirm =
derselbe Befund. Ein Fehler, der in einer Schleife 500-mal auftritt, ergibt
**einen** Eintrag mit Zähler `×500`. Ohne das wäre das Protokoll nach dem
ersten kaputten Render unbrauchbar.

### Baustein 2 — Gefühlte Fehler („Problem melden")

Das Gegenstück, und der eigentliche Kern.

- **Menü → 🐞 Problem melden** — für **jeden** zugänglich, auch ohne
  Anmeldung. Wer im Labor merkt, dass etwas nicht geht, muss das sofort
  loswerden können.
- Zwei Felder, mehr nicht:
  - *Was wolltest du tun?* („eine Anleitung öffnen")
  - *Was ist stattdessen passiert?* („nichts")
- Den technischen Zusammenhang hängt die App **selbst** an: Bildschirm, Weg
  dorthin, Gerät, Bildschirmgröße, Browser.

Die Trennung von **Absicht** und **Beobachtung** ist Absicht: Sie macht aus
einer Beschwerde eine reproduzierbare Beschreibung.

### Baustein 3 — Selbsttest (aktiv statt abwartend)

**Menü → 🩺 Diagnose & Fehler → Selbsttest.** Prüft nebenwirkungsfrei:

| Prüfung | Fängt ab |
|---|---|
| Alle Bildschirme vorhanden | `index.html` und Code sind auseinandergelaufen |
| **Übersichtszeilen sind bedienbar** | **genau der Anleitungs-Fehler** — siehe unten |
| Anleitungen vollständig | Anleitungen ohne Schritte |
| Material-Verknüpfungen heil | verwaiste Verweise auf gelöschte Stammsätze |
| Speicherplatz ausreichend | die ~5-MB-Grenze der Browser, bevor sie zuschlägt |
| Verbindung zum Server | offline vs. echter Fehler |
| Neueste App-Version geladen | alter Stand im Offline-Cache |
| Keine Fehler in 24 h | Verweis ins Protokoll |

Jede auffällige Prüfung erklärt **in einem Satz, was zu tun ist** — nicht nur,
dass etwas rot ist.

## 3. Wie der Selbsttest genau diesen Fehler findet

Die Übersicht trägt zwei Zeilenarten mit derselben CSS-Klasse `.std`:
Standards (`data-sid`) und Anleitungen (`data-gid`). Bedient werden sie vom
**Halte-Detektor** (`attachHoldNav` in `features/quickmenu.js`): kurz tippen =
öffnen, lang halten = Bearbeiten-Menü.

Der Detektor kannte nur `data-sid`. Bei einer Anleitungs-Zeile konnte er
nichts tun — **unterdrückte den Tipp aber trotzdem** (`preventDefault` auf
`touchend`). Der Browser feuerte daraufhin kein `click`, und das
Inline-`onclick` der Zeile kam nie zum Zug. Mit der Maus fiel das nicht auf,
weil `mouseup` nichts unterdrückt.

Zwei Änderungen, zwei Ebenen:

1. **Ursache:** Der Detektor kennt jetzt beide Attribute (`keys:['sid','gid']`)
   und öffnet Anleitungen ebenso wie Standards; langes Halten öffnet den
   Anleitungs-Editor. Das doppelte Inline-`onclick` ist entfallen.
2. **Fehlerklasse:** `onTap` meldet zurück, ob es den Tipp **behandelt** hat.
   Nur ein behandelter Tipp wird unterdrückt. Ein Handler, der nichts tun
   kann, blockiert nie mehr den normalen Weg.

Und damit es nicht wiederkommt: Jeder Halte-Detektor trägt sich in das
Register `HOLDNAV` ein — mit den Attributen, die er versteht. Der Selbsttest
vergleicht jede sichtbare Zeile dagegen und meldet
„*n Zeile(n) ohne Handler*". Ein solcher Fehler ist damit **sichtbar, bevor
jemand darüber stolpert**.

## 4. Der Bericht

**📋 Bericht kopieren** erzeugt einen kompakten Textblock:

```
HKL-SOP — Diagnosebericht
erstellt: 2026-07-26T12:00:00Z
Gerät: Chrome · Android · 390×844
Verbindung: online

SELBSTTEST: 7/8 in Ordnung
  [ok] Alle Bildschirme vorhanden — 11 Bildschirme
  [!!] Übersichtszeilen sind bedienbar — 1 Zeile(n) ohne Handler: scr-standards .std
  …

PROTOKOLL (3 Einträge, neueste zuerst):
  [meldung] 2026-07-26T11:58:00Z
    nichts passiert, sie geht nicht auf
    Bildschirm: scr-standards · use
    Wollte: eine Anleitung öffnen
    Weg: scr-standards → scr-guide → scr-standards
```

Direkt einfügbar in eine Nachricht oder ein GitHub-Issue. **Das ist die
Brücke von „geht nicht" zu gezielter Bearbeitung** — mit oder ohne
Entwickler.

Fällt die Zwischenablage aus (älterer Browser, kein https), zeigt die App den
Text markiert an, sodass man ihn von Hand kopieren kann.

## 5. Datenhaltung

| | |
|---|---|
| Schlüssel | `hkl_diag` |
| Umfang | Ringpuffer, max. 150 Einträge, Texte gekürzt |
| Geteilt (`SHARED_KEYS`) | **ja** — Meldungen *aller* Geräte laufen an einem Ort zusammen; die Verwaltung sieht alles |
| Im Backup (`BACKUP_KEYS`) | **nein** — ein Backup soll Inhalte sichern, keine alten Fehlerprotokolle zurückspielen |
| Speichern | gebündelt (600 ms), damit ein Fehlerschauer nicht 50 Synchronisationen auslöst |
| Wegprotokoll | nur im Arbeitsspeicher, letzte 25 Stationen — wird nie geteilt |

Es werden **keine Eingabeinhalte** protokolliert, nur Bildschirm-Kennungen,
Fehlertexte und was der Mensch selbst in die Meldung schreibt.

## 6. Arbeitsweise im Alltag

1. **Etwas geht nicht** → Menü → 🐞 *Problem melden*, zwei Sätze. Fertig.
   (Auch für Kollegen ohne Anmeldung.)
2. **Regelmäßig** (oder wenn Meldungen auflaufen) → Menü → 🩺 *Diagnose &
   Fehler*:
   - *Selbsttest* zuerst: erklärt oft schon, woran es liegt.
   - *Protokoll*: technische Fehler und Meldungen, neueste zuerst, mit Zähler.
3. **Nicht selbst lösbar?** → 📋 *Bericht kopieren* → in ein GitHub-Issue
   einfügen. Der Bericht enthält alles, was zur Einordnung nötig ist.
4. **Erledigt?** → Einzelne Einträge mit ✕ entfernen oder das Protokoll leeren.

## 7. Für Entwickler: eine neue Prüfung ergänzen

In `public/js/features/diag.js`, Funktion `diagChecks()`:

```js
add('Kurzer, verständlicher Titel', () => {
  const problem = /* … prüfen, NEBENWIRKUNGSFREI … */;
  return { ok: !problem, info: problem ? 'was gefunden wurde' : 'alles gut' };
}, 'Ein Satz: was das bedeutet und was zu tun ist.');
```

Regeln: keine Nebenwirkungen, deutscher Klartext, und bei `ok:false` immer
eine Handlungsanweisung. Prüfungen laufen bei jedem Öffnen des Registers.

## 8. Testabdeckung

- `test/client-helpers.test.js` — `diagPush` (Zusammenfassung, Ringpuffer,
  Trennschärfe), `diagAlter`, `diagShort`, **`diagRowProblems`** (bildet den
  Anleitungs-Fehler exakt nach), `diagBerichtText`.
- `e2e/diagnose.js` — im echten Browser: Anleitung per **Finger** öffnen
  (die Regression), derselbe Weg per Maus **genau einmal**, Gleichverhalten
  mit Standards, Selbsttest erkennt eine unerreichbare Zeile, automatische
  Fehlererfassung inklusive Flutungsschutz (200 gleiche Fehler → ein
  Eintrag), „Problem melden" ohne Anmeldung, Bericht.
