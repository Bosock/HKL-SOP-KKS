# Prompt für den Umschalttag — die neue App dauerhaft als Oberfläche

**Wofür:** An dem Tag, an dem der Auftraggeber entscheidet, die neue App
(`public/neu/`, siehe [`NEUE-APP.md`](NEUE-APP.md)) für alle Geräte zur
Oberfläche zu machen. Den Block unten **vollständig** in eine neue Claude-Code-
Sitzung mit diesem Repository kopieren. Das Datum in der ersten Zeile anpassen.

**Arbeitsteilung, damit nichts schiefgeht:** Claude bereitet vor, prüft und
baut, was noch fehlt. Den **Live-Schalter drückt ausschließlich der
Auftraggeber** selbst, im Browser und mit dem Zweitpasswort. Claude drückt ihn
nie, auch nicht über die API.

---

```text
Heute ist der Umschalttag (Datum: __.__.____). Ich will den Neuaufbau mit der
neuen App (public/neu/) ab jetzt dauerhaft als Oberfläche der HKL-App nutzen.
Antworte auf Deutsch, Ergebnis zuerst, knapp und ohne Floskeln. Trenne Fakten,
Annahmen und Empfehlungen.

HARTE REGELN (gelten für die ganze Sitzung)
1. Du drückst NIE den Live-Schalter: kein PUT /api/raeume gegen den
   Produktivserver, kein Klick auf „Live schalten" in einer echten Instanz. Das
   mache ich selbst. Auf einem lokalen Testserver (e2e/util.js startServer)
   darfst du umschalten, um es zu prüfen.
2. Die Daten des Bestands (state.json, backups/, media/ ohne Raum) werden nicht
   verändert, nicht migriert, nicht gelöscht. Der Bestand bleibt als
   Rückfallebene vollständig erhalten.
3. Kein Code des Bestands wird heute entfernt. Aufräumen der alten Oberfläche
   gibt es frühestens nach einer Bewährungszeit und nur auf meine ausdrückliche
   Erlaubnis.
4. Arbeite auf deinem Sitzungs-Branch, committe nachvollziehbar, öffne einen
   Draft-PR. Kein Force-Push, kein Merge durch dich.
5. Native Eingabefenster (prompt/confirm) sind verboten (Grundsatz ⑧);
   Gerätespeicher nur über store (npm run check erzwingt beides).
6. Wenn eine Angabe fehlt, die das Ergebnis wesentlich ändert: gezielt EINE
   Frage stellen. Sonst mit gekennzeichneter Annahme weiterarbeiten.

PHASE 0 — LESEN (vollständig, nicht überfliegen)
- docs/NEUE-APP.md (Aufbau, Datenmodell, Schutz des Bestands, Abschnitt 6
  „Was die neue App noch nicht hat")
- docs/GRUNDSAETZE.md (insbesondere A1, A2, A9, ⑧)
- docs/NEUAUFBAU.md (Räume, Live-Zeiger, Rückweg)
- public/js/core/store.js (RAUM, Umleitung nach /neu/), public/sw.js
  (Navigation /neu/), server/raeume.js + server/routes/raeume.js (Live-Zeiger,
  Prüfung des Zweitpassworts gegen hkl_raumpw des Bestands)

PHASE 1 — BESTANDSAUFNAHME (nur lesen und prüfen, nichts ändern)
1. git status, aktueller Stand von main; ist der PR „Neue App im Neuaufbau"
   gemergt? Welche Commits kamen seither dazu?
2. Ausführen und Ergebnis berichten:
   npm run check · npm test · node e2e/neue-app.js · node e2e/neuaufbau.js ·
   node e2e/liveschalter.js · node e2e/messen-aufgaben.js
   (Chromium ist vorinstalliert; bei Fehlschlag: Ursache eingrenzen, nicht
   umgehen, keine Tests abschalten.)
3. Liste mir in einer Tabelle, was aus docs/NEUE-APP.md Abschnitt 6 inzwischen
   umgesetzt ist und was fehlt.

PHASE 2 — LÜCKENENTSCHEIDUNG (eine gebündelte Frage an mich)
Frage mich in EINER Frage (Mehrfachauswahl), welche fehlenden Funktionen aus
Abschnitt 6 VOR dem Umschalten vorhanden sein müssen. Empfiehl mit kurzer
Begründung. Weise ausdrücklich darauf hin, dass alles, was fehlt, nach dem
Umschalten für ALLE Geräte nicht mehr sichtbar ist (im alten Bestand bleibt es
nur über „Alten Bestand ansehen" erreichbar).

PHASE 3 — UMSETZEN, WAS ICH FREIGEBE
- Nur in public/neu/ (und Tests/Doku). Gleiche Regeln wie bisher: Leitregel
  „Stammdaten gelten überall, Position nur hier", ein Auswahlfeld, eine Maske
  „Neu anlegen", Papierkorb und Verlauf für jede Änderung.
- Je Funktion: Unit-Test für reine Logik (test/neue-app.test.js erweitern),
  Browser-Prüfung in e2e/neue-app.js (Bedienung wie ein Mensch, Passwort
  getippt), Doku in docs/NEUE-APP.md.
- Danach Phase-1-Prüfungen erneut, alle grün.

PHASE 4 — DAUERBETRIEB ABSICHERN (immer, auch ohne neue Funktionen)
Prüfe auf einem LOKALEN Testserver und behebe, was nicht hält:
a) Umschalten: Live-Zeiger auf neuaufbau (PUT /api/raeume mit dem
   Vorgabe-Zweitpasswort des Testservers). Ein Gerät OHNE eigene Raumwahl, das
   „/" öffnet, landet in /neu/. Ohne lila Leiste, Abgleich grün, Standard
   öffnen, abhaken.
b) Ein Gerät, das gerade in der alten App offen ist, wechselt nach spätestens
   zwei Minuten oder beim Aufwecken (core/sync.js) und landet in /neu/.
c) Offline nach dem Umschalten: einmal online geladen, dann ohne Netz „/"
   öffnen → die neue App startet aus dem Cache (sw.js: index.html → store.js →
   neu/index.html).
d) Installierte PWA (manifest start_url „/") startet in der neuen App.
e) Rückweg: Zeiger zurück auf bestand → Geräte ohne Wahl landen wieder in der
   alten App, beide Datenbestände unverändert (Byte-Vergleich der state.json).
f) „Alten Bestand ansehen" aus der neuen App (Einstellungen) funktioniert,
   danach zurück in die neue App.
g) Das Zweitpasswort, das der Server erwartet, ist der Fingerabdruck
   hkl_raumpw aus dem BESTAND (sonst die Vorgabe). Prüfe, dass die
   Live-Schaltfläche der neuen App genau damit funktioniert und mit falschem
   Passwort nichts ändert.
Schreibe diese Punkte als dauerhafte Suite e2e/umschalten-neue-app.js, falls
sie noch nicht existiert. Erhöhe CACHE_VERSION in sw.js, wenn sich ausgelieferte
Dateien ändern.

PHASE 5 — MEINE CHECKLISTE (gib sie mir am Ende als nummerierte Liste)
Formuliere für mich, was ICH in welcher Reihenfolge tue, mit erwartetem
Ergebnis je Schritt:
1. Sicherungen ziehen: alte App (Bestand) → Verwaltung → Sicherung; neue App →
   Mehr → Sicherung. Dateien an einem zweiten Ort ablegen.
2. Inhalt prüfen: Sind im Neuaufbau alle Standards, Materialien, Geräte,
   Medikamente, Bereiche und Lagerorte, die das Labor ab morgen braucht?
3. Zeitpunkt: kein laufender Eingriff, alle Geräte im WLAN.
4. Umschalten (nur ich): neue App → Mehr → Einstellungen → Live schalten,
   Zweitpasswort, Häkchen, bestätigen.
5. Je Gerät prüfen: App schließen und neu öffnen → neue App, keine lila
   Leiste, grüner Punkt, ein Standard lässt sich öffnen und abhaken.
6. Rückweg, falls nötig: neue App → Einstellungen → „Bestand wieder live
   schalten" (Zweitpasswort). Es gehen keine Daten verloren.
7. Bewährungszeit (Vorschlag: 4 Wochen): alter Bestand bleibt unverändert
   erreichbar. Erst danach entscheide ich über Aufräumen.

ABSCHLUSSBERICHT
Ergebnis zuerst (ein Satz: bereit zum Umschalten ja/nein und warum). Dann:
erledigt · geprüft (mit Testnamen und Zahl der Prüfpunkte) · offen ·
Entscheidungen, die bei mir liegen · PR-Link. Keine Behauptung ohne Beleg aus
dieser Sitzung.
```

---

## Warum der Prompt so gebaut ist

- **Der Schalter bleibt beim Menschen.** Umschalten betrifft alle Geräte im
  Labor. Das soll eine bewusste Handlung des Verantwortlichen sein, keine
  Nebenwirkung einer Sitzung.
- **Lücken zuerst.** Die neue App beginnt leer und hat bewusst nicht alle
  Funktionen der alten (NEUE-APP.md, Abschnitt 6). Der größte Fehler am
  Umschalttag wäre, das erst danach zu merken.
- **Rückweg vor Hinweg.** Rückweg, Offline-Start und installierte PWA werden
  auf einem Testserver bewiesen, bevor die echte Instanz umgeschaltet wird.
- **Kein Aufräumen am selben Tag.** Der alte Code ist die Rückfallebene.
