# Duplizieren — neue Standards aus bestehenden

> Ein neuer Standard entsteht in der Praxis fast nie auf einem weißen Blatt.
> „VVI-ICD" → „DDD-ICD" ist zu 80 % dasselbe. Wer das abtippen muss, legt
> keine neuen Standards an.

## 1. Die fünf Eigenschaften, die eine brauchbare Kopie haben muss

Eine Duplikationsfunktion ist nicht „Objekt kopieren". In einer App mit
Überlagerungen, Regeln und geteiltem Zustand entscheiden fünf Eigenschaften
darüber, ob die Kopie brauchbar oder gefährlich ist.

### 1. Vollständig unabhängig — in **beide** Richtungen

Nach dem Duplizieren gibt es keine Verbindung mehr zum Original. Ändert
jemand später das Original, ändert sich die Kopie **nicht** — und umgekehrt.

Für ein SOP ist alles andere gefährlich: Eine stille Kopplung würde bedeuten,
dass eine Korrektur an Standard A unbemerkt Standard B verändert. Beides wird
end-to-end geprüft (`e2e/duplizieren.js`).

### 2. Sie sieht aus wie das Original

Ein Eintrag zeigt selten seinen Rohtext. Name, Menge, Größen, Kategorie und
Unterkategorie können durch Anpassungen und Regeln überlagert sein. Kopiert
wird deshalb der **effektive** Stand — das, was auf dem Bildschirm steht.

Konkret aufgelöst und eingefroren: `name` → `anzeige_text`, `mengeVal` →
`menge`, `groessen`, `spez`, `effNatur()` → `natur`, `rawUk()` →
`unterkategorie`. Die reinen Overlay-Eigenschaften (Hervorhebung, Farbe,
„Warum", Synonyme, Zusatzfelder) werden für die neuen Kennungen übernommen.

**Eine bewusste Ausnahme:** Material-WEITE Regeln werden *nicht* eingefroren.
Sie greifen über den `material_key` weiterhin von selbst — sonst wäre die
Kopie von künftigen Materialänderungen abgeschnitten, und genau das will die
Materialverwaltung verhindern.

### 3. Alles ist **echt** löschbar

Das ist der Punkt, an dem es sonst schiefgeht.

Am Original kann man Rubriken und Einträge nur **ausblenden**. Das ist dort
richtig: Die importierten Standards sind die Quelle, sie bleiben unangetastet,
jede Ausblendung ist rücknehmbar.

In einer Kopie wäre das falsch. Wer einen neuen Standard baut, wirft
Segmente weg, die er nicht braucht — und dann sollen sie weg sein, nicht als
„ausgeblendet" mitgeschleppt werden.

Deshalb ist die Kopie ein **vollwertiger eigener Standard mit eigener
Struktur**. Der Unterschied ist im Menü sichtbar: dort steht „Endgültig
löschen" statt „Ausblenden".

### 4. Keine Geschichte wird mitkopiert

Zurück bleiben: Häkchen, Nutzungszähler, Favoriten, Prüf-Vermerke — **und
Version/Freigabe**. Eine Kopie ist ein **Entwurf**, kein freigegebenes
Dokument. Würde der Freigabe-Status mitkopiert, wäre das eine
Freigabe-Fälschung.

Ausgeblendete Einträge des Originals wandern ebenfalls nicht mit: Wer sie
ausgeblendet hat, wollte sie nicht sehen.

### 5. Rubrik-Vorlagen werden aufgelöst

Eine Rubrik mit Geltungsbereich („erscheint in allen Standards der Gruppe X")
darf in der Kopie **keine Vorlage bleiben** — sonst würde ein Umbenennen oder
Löschen in der Kopie auf fremde Standards durchschlagen.

In der Kopie wird daraus ein ganz normales Segment. Damit dieselbe Rubrik
nicht **zweimal** erscheint (einmal materialisiert, einmal von der Vorlage
nachgeliefert), bekommen Standards mit eigener Struktur keine Vorlagen-
Rubriken mehr automatisch dazu. Ein Duplikat ist bewusst gestaltet, nicht
generiert.

## 2. Was mitkommt — und was nicht

| Kommt mit | Bleibt zurück |
|---|---|
| Segmente (Rubriken) und Abschnitte | Häkchen |
| Alle Einträge mit effektiven Werten | Nutzungszähler, Favoriten |
| Mengen, Größen, Spezifikationen | Prüf-Vermerke („erledigt") |
| Kategorien und Unterkategorien | **Version und Freigabe** |
| Hervorhebungen, Farben, „Warum", Synonyme | Ausgeblendete Einträge |
| Material-Verknüpfungen (`material_key`) | Vorlagen-Charakter von Rubriken |
| Arzt-Varianten | |

Die Material-Verknüpfungen sind wichtig: Dadurch findet die Material-
Quersuche die Kopie sofort, und Materialpflege wirkt auch dort.

## 3. Bedienung

**Standard duplizieren** — Standard öffnen → Titelzeile lange halten (oder
⋯) → *⧉ Duplizieren*. Titel ist vorbelegt („Kopie von …", ohne Dubletten),
Gruppe ebenfalls. Ein Tipp auf *Kopie anlegen*, und man steht direkt im neuen
Standard.

Das Formular nennt vorab den Umfang („12 Segmente mit 143 Einträgen") und
sagt ausdrücklich, was **nicht** mitkommt.

**Segmente bearbeiten** — im eigenen Standard:
* *＋ Segment hinzufügen* im Standard-Menü (Name + Art)
* Segment lange halten → *Endgültig löschen*
* Eintrag lange halten → *Endgültig löschen*

**Anleitung duplizieren** — Anleitung öffnen → *⧉ Duplizieren*. Schritte,
Fotos, Warnungen und Tipps kommen mit; die Schritte bekommen frische
Kennungen, damit die abgehakten Schritte des Originals nicht mitwandern.

**Umbenennen** — läuft jetzt über ein Formular statt zweier `prompt()`-
Dialoge (in installierten PWAs sind die unzuverlässig) und ändert bei einem
eigenen Standard direkt den Datensatz, sonst wie bisher die Überlagerung.

## 4. Technisch

### Eigene Struktur am eigenen Standard

Vorher baute `newStdToObj()` ein festes Gerüst aus zwei Rubriken — ein
eigener Standard konnte gar keine beliebige Struktur tragen. **Das war der
eigentliche Blocker.** Jetzt gilt: Trägt der `NEWSTD`-Datensatz ein Feld
`rubriken`, wird es verwendet (`__eigenStruktur:true`); ohne bleibt es beim
alten Gerüst, sodass vorhandene eigene Standards unverändert weiterlaufen.

### Positionsabhängige Kennungen nachziehen

Eine Kennung ist `<standard>|<rubrik>|<abschnitt>|<index>`. Löscht man den
Eintrag an Index 3 **wirklich**, rutschen 4, 5, 6 … eine Position nach vorn —
ihre Anpassungen (Name, Farbe, Häkchen …) würden sonst am falschen Eintrag
kleben.

`dupCidShift(map, sid, ri, si, ei)` bildet eine Schlüssel-Map auf die neuen
Indizes ab: Der gelöschte Schlüssel fällt weg, alle dahinter rücken auf.
Angewandt auf `QE.cid`, `overrides`, `reassign`, `reviewed`, `checks` und die
Arzt-Varianten. Rein und einzeln getestet.

Beim Löschen eines ganzen **Segments** verschieben sich die Rubrik-Indizes;
dort wird alles Positionsabhängige dieses Standards verworfen statt falsch
zugeordnet — lieber ein verlorener Farbwunsch als eine Anpassung am falschen
Eintrag.

### Ein aufgeräumter Nebeneffekt

`rubKey/rubName/rubHidden/rubOrd` hingen implizit am gerade **geöffneten**
Standard (`curStd`). Für die Anzeige reicht das, für die Auswertung eines
anderen Standards nicht. Sie nehmen jetzt einen optionalen dritten Parameter
`std`; ohne ihn verhalten sie sich exakt wie bisher.

## 5. Testabdeckung

* `test/client-helpers.test.js` — `dupTitel` (Durchnummerierung,
  Groß-/Kleinschreibung), `dupDeep` (echte Tiefkopie: Änderung an der Kopie
  darf das Original nicht berühren), **`dupCidShift`** (Nachrücken, fremde
  Standards/Rubriken/Abschnitte unberührt, keine verwaisten Schlüssel),
  `dupZaehlung`.
* `e2e/duplizieren.js` — alle fünf Zusagen im echten Browser: Unabhängigkeit
  in beide Richtungen, effektiver statt roher Text, echtes Löschen mitsamt
  Nachziehen der Anpassungen, keine Geschichte, Vorlagen-Auflösung; dazu
  Segment hinzufügen/löschen, Anleitungs-Duplikat und die Formulare. Zur
  Gegenprobe: Am importierten Standard schlägt echtes Löschen weiterhin fehl.
