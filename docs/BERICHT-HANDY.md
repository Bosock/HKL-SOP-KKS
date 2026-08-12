# Bericht: Handy-Tauglichkeit — Darstellung & Bedienung

Stand: 2026-08-11 · Auftrag des Betreibers: „Systematische Analyse der
Darstellung und Bedienung bezüglich der Nutzung am Handy, mit anschließendem
Bericht mit Prioritäten und Vorgehen."

## Methode (damit das hier keine Meinung ist)

Gemessen statt geschätzt, mit `npm run messen` am echten Bestand (47 Standards ·
294 Rubriken · 4.475 Zeilen) und durch Sichtung von `public/css/app.css` /
`public/index.html`. Geprüft an den drei Fensterbreiten, die im Saal wirklich
vorkommen: **360 px** (kleines Diensthandy), **390 px** (Standard), **430 px**
(großes Handy). Drei Achsen: **Darstellung** (was man sieht), **Bedienung** (was
der Daumen erreicht und auslöst), **Robustheit** (schwaches Gerät, Notch, kein
Netz).

## Was schon gut ist — bewusst NICHT anfassen

- **Zoom bleibt frei:** `viewport` ohne `user-scalable=no` → Kneifen zum
  Vergrößern ist erlaubt (Barrierefreiheit).
- **Grundschrift 17 px**, Icon-Knöpfe **44 px**, Langdruck an **11 Flächen**.
- **Bottom-Sheet**-Muster fürs Bearbeiten (kommt von unten, Daumen-nah) — inkl.
  `env(safe-area-inset-bottom)` am Sheet und am Kamera-Overlay.
- **Offline-fest**; Renderpfade meist < 15 ms.
- **Jüngster Umbau greift:** bei 360 px bekommt der Name jetzt 130 px statt 98,
  die Zeile ist 93 px statt 119 hoch, die große Rubrik 2.962 px statt 3.644.

Der Sockel ist also gut. Die folgenden Befunde sind Feinarbeit auf einer
tragfähigen Grundlage — mit einer klaren Rangfolge.

---

## P1 — spürt jede Person bei jeder Nutzung

### 1. Bei 360 px brechen noch über die Hälfte der Namen um
**Messung:** Name 130 px (36 % der Breite), **14 von 26 Namen umbrechen**, die
große Rubrik ist 2.962 px lang — rund **acht Bildschirmhöhen** Scrollen.
**Warum es zählt:** Der Name ist die eine Information, auf die es ankommt. Zwei-
und dreizeilige Namen kosten Höhe, Höhe kostet Scrollweg.
**Vorgehen:** (a) Materialzeile weiter verdichten — Menge/Badges nur zeigen, wo
sie stehen; für kurze Namen ein echter Ein-Zeilen-Modus. (b) **Sprung-Navigation
innerhalb langer Rubriken** (Untergruppen-Index oben, „↑ nach oben"), damit die
2.962 px nicht am Stück durchgewischt werden müssen. (c) Optional eine dichtere
Zeilenhöhe unter 390 px.

### 2. Alles zum Bedienen sitzt oben — einhändig schwer erreichbar
**Befund:** Menü (☰), Suche und die Reiter (`seg-btn`) kleben alle am oberen
Rand (`header.bar { position:sticky; top:0 }`). Auf einem großen Handy erreicht
der Daumen den oberen Rand einhändig kaum.
**Vorgehen:** Die häufigsten Griffe (Suche, Reiter-Wechsel) in Daumenreichweite
holen — eine **untere Aktionsleiste** oder die Reiter nach unten; mindestens die
Suche über einen unteren Knopf (FAB) erreichbar machen. Kein Zwang, nur ein
zweiter, unterer Zugang.

### 3. Safe-Area nur halb bedacht (Notch / Home-Leiste)
**Befund:** Sheet und Kamera nutzen `env(safe-area-inset-bottom)` — aber
`header.bar` (oben) hat kein `safe-area-inset-top`, und `main` hat unten nur
`padding-bottom:44px` ohne Inset. Auf Geräten mit Notch/Home-Indikator sitzt
Inhalt dann teils unter der Systemleiste.
**Vorgehen:** `env(safe-area-inset-top)` an `header.bar`,
`calc(44px + env(safe-area-inset-bottom))` an `main`. Kleiner Eingriff, überall
sichtbar.

---

## P2 — spürbar in bestimmten Abläufen

### 4. „Details bearbeiten" ist lang und verlässt die Ansicht
**Messung:** 7 Felder in 10 Gruppen, **1,8 Bildschirmhöhen**, und die Ansicht
wird gewechselt — die Scrollposition in der Rubrik geht verloren.
**Vorgehen:** Das schnelle ⋯-Menü bleibt der Hauptweg (2 Berührungen, gut). Das
lange Formular als **Sheet statt Vollbildwechsel** öffnen (Position bleibt
erhalten) und die 10 Gruppen einklappbar machen.

### 5. Verwaltung und Materialindex ruckeln auf schwachen Geräten
**Messung:** „Verwaltung zeichnen" **96 ms Mittel / 184 ms schlechtester**;
„Materialindex bauen" **218 ms Spitze**. Auf einem starken Rechner unsichtbar —
auf einem 150-€-Diensthandy ein spürbarer Hänger beim Öffnen bzw. bei jedem
Speichern.
**Vorgehen:** Verwaltung **je Panel erst bei Bedarf** zeichnen (lazy, die Panels
sind ohnehin einklappbar); den Materialindex-Bau entprellen/bündeln, statt ihn
bei jedem Speichern voll durchlaufen zu lassen.

### 6. Ein paar Trefferflächen unter dem Richtwert
**Befund:** Glossar-Aktionen 32 px, Sortier-Aktionen 30 px (unter 420 px) —
unter den 44 px, die der Rest der App hält.
**Vorgehen:** auf 40–44 px anheben oder unsichtbaren Rand (Hit-Slop) ergänzen.

---

## P3 — Feinschliff und Vorbeugung

### 7. Langdruck ist mächtig, aber unsichtbar
**Befund:** Der Langdruck trägt die halbe Bedienung, hat aber keinen
Erstkontakt-Hinweis. Bei Personalwechsel kennt ihn niemand mehr — die Funktion
wäre da, aber unauffindbar.
**Vorgehen:** Einmaliger, wegklickbarer Hinweis beim ersten Anmelden („Tipp:
lange auf eine Zeile tippen zum Bearbeiten"). Das sichtbare ⋯ bleibt der Zwilling
für alle, die den Griff nicht kennen.

### 8. Quer-Scroll ist richtig gelöst — als Regel absichern
**Befund:** Breite Inhalte (Tabs, Sortierleiste, Galerie, Prüfblatt-Tabelle)
laufen sauber in eigenen `overflow-x:auto`-Streifen. Fehlt nur die Zusage, dass
der **Seitenkörper selbst nie quer scrollt**.
**Vorgehen:** Als Prüfpunkt ins Messwerkzeug aufnehmen (siehe unten).

### 9. Die neue Foto-/Scan-/Bestell-Oberfläche auf 360 px gegenprüfen
**Befund:** Scan-Reihe (Feld + 44-px-Knopf), Foto-Thumbnails und die Zeilen des
Prüf-Panels sind neu — sie sollten als eigener Messpunkt bei 360 px sauber
umbrechen.
**Vorgehen:** Einen Handy-Messpunkt für die Bestell-Seite ergänzen.

---

## Vorgehen (Reihenfolge)

1. **P1 als ein fokussierter Durchgang** — Zeilendichte + Sprung-Navigation +
   untere Erreichbarkeit + Safe-Area. Das ist der größte spürbare Gewinn pro
   Aufwand und betrifft jede Nutzung.
2. **Messwerkzeug um Handy-Prüfpunkte erweitern** — Trefferflächen ≥ 44 px, kein
   Körper-Querlauf, Safe-Area vorhanden. So wird der Gewinn dauerhaft
   abgesichert, genau wie die „Berührungen je Weg" es schon sind.
3. **P2** — Formular als Sheet, Verwaltung lazy. Zweiter Durchgang.
4. **P3** — Langdruck-Hinweis und Feinschliff.

Jeder Punkt ist eine eigene, testbare Änderung im Geist der Hausregeln
(Trefferflächen bleiben groß, Leerräume werden enger; nichts Destruktives).
Nichts davon ist ein Umbau der Architektur — es ist Verdichtung und
Erreichbarkeit auf einem bereits handytauglichen Fundament.
