/* ─────────────────────────────────────────────────────────────
   MEDIENSPEICHER — Bilder liegen EINZELN, nicht im geteilten Zustand

   Warum überhaupt getrennt (die Entscheidung „Weg B"):
   Die App schickt bei jeder Änderung den GANZEN geteilten Zustand als ein
   JSON an /api/state. Das ist für Text genau richtig — kurz, konfliktarm,
   in einer Datei sicherbar. Für Bilder ist es eine Sackgasse mit Zahlen:
   ein verkleinertes Foto wiegt rund 250 KB, die Standards haben rund 4.500
   Zeilen. Bekäme nur jede zehnte ein Bild, wären das über 100 MB — und bei
   32 MiB (MAX_BODY) ist Schluss. Vorher wird jede einzelne Änderung, auch
   das Umbenennen eines Wortes, so schwer wie der gesamte Bildbestand.

   Deshalb: Bilder liegen als EINZELNE Dateien unter STATE_DIR/media. Im
   geteilten Zustand steht nur noch ein Kürzel je Bild (die Kennung). Eine
   Textänderung bleibt eine Textänderung.

   Die Kennung ist der INHALTS-FINGERABDRUCK (SHA-256, 32 Hexstellen).
   Drei Dinge fallen dadurch ohne Zutun ab:
     · Dasselbe Foto zweimal hochgeladen belegt einmal Platz.
     · Die Auslieferung darf unbegrenzt zwischengespeichert werden — eine
       Kennung bezeichnet für immer denselben Inhalt (immutable).
     · Es gibt keine laufende Nummer, die zwei Geräte gleichzeitig vergeben
       könnten. Der Konflikt „zwei Säle laden zugleich hoch" entfällt.

   Bewusst NICHT gelöscht wird beim Entfernen eines Bildes aus einem Eintrag:
   Dasselbe Bild kann an mehreren Stellen hängen, und ein Bild ist teurer
   wiederzubeschaffen als zu behalten. Aufräumen ist ein eigener, bewusster
   Schritt in der Verwaltung (siehe /api/media?unbenutzt).
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { STATE_DIR } = require('./config');

const MEDIA_DIR = process.env.MEDIA_DIR || path.join(STATE_DIR, 'media');

/* Erlaubte Bildarten. Keine SVG: SVG ist ausführbares Markup und käme von
   derselben Herkunft wie die App — ein hochgeladenes SVG könnte Skript
   mitbringen. Fotos aus dem Labor sind ohnehin JPEG/PNG/WebP. */
const ARTEN = {
  'image/jpeg': '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
  'image/gif':  '.gif',
};
/* Ein einzelnes Bild. Großzügig, aber nicht grenzenlos: Die App verkleinert
   vor dem Hochladen auf ~1280 px; 8 MiB fangen auch ein unverkleinertes Foto
   aus einer Tablet-Kamera ab, ohne dass jemand ein Video hochladen kann. */
const MAX_BILD = parseInt(process.env.MAX_MEDIA || String(8 * 1024 * 1024), 10);

function sicherstellen() {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

/* Kennung = 32 Hexstellen. Alles andere weisen wir ab, damit über den Namen
   niemand aus dem Verzeichnis herausläuft (kein „../"). */
const KENNUNG_RE = /^[0-9a-f]{32}$/;
function istKennung(k) { return KENNUNG_RE.test(String(k || '')); }

function dateiname(kennung, endung) { return kennung + endung; }

/* Die Datei zu einer Kennung finden — die Endung kennt nur das Verzeichnis. */
function suchen(kennung) {
  if (!istKennung(kennung)) return null;
  for (const endung of Object.values(ARTEN)) {
    const p = path.join(MEDIA_DIR, dateiname(kennung, endung));
    if (fs.existsSync(p)) return { pfad: p, endung, art: artZuEndung(endung) };
  }
  return null;
}
function artZuEndung(endung) {
  for (const [art, e] of Object.entries(ARTEN)) if (e === endung) return art;
  return 'application/octet-stream';
}

/* Ein Bild ablegen. Gibt {kennung, art, groesse, neu} zurück.
   Atomar über eine Zwischendatei: Ein abgebrochener Upload hinterlässt keine
   halbe Datei, die später als gültiges Bild ausgeliefert würde. */
function ablegen(buffer, art) {
  if (!ARTEN[art]) { const e = new Error('unsupported media type'); e.code = 'ART'; throw e; }
  if (!buffer || !buffer.length) { const e = new Error('empty body'); e.code = 'LEER'; throw e; }
  if (buffer.length > MAX_BILD) { const e = new Error('media too large'); e.code = 'GROSS'; throw e; }
  sicherstellen();
  const kennung = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 32);
  const endung = ARTEN[art];
  const ziel = path.join(MEDIA_DIR, dateiname(kennung, endung));
  if (fs.existsSync(ziel)) return { kennung, art, groesse: buffer.length, neu: false };
  const tmp = ziel + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, buffer);
  fs.renameSync(tmp, ziel);
  return { kennung, art, groesse: buffer.length, neu: true };
}

function lesen(kennung) {
  const t = suchen(kennung);
  if (!t) return null;
  return { daten: fs.readFileSync(t.pfad), art: t.art };
}

function loeschen(kennung) {
  const t = suchen(kennung);
  if (!t) return false;
  fs.unlinkSync(t.pfad);
  return true;
}

/* Bestandsübersicht für die Verwaltung: wie viele Bilder, wie viel Platz. */
function bestand() {
  sicherstellen();
  const aus = [];
  for (const name of fs.readdirSync(MEDIA_DIR)) {
    const endung = path.extname(name);
    if (!Object.values(ARTEN).includes(endung)) continue;
    const kennung = path.basename(name, endung);
    if (!istKennung(kennung)) continue;
    let st; try { st = fs.statSync(path.join(MEDIA_DIR, name)); } catch (e) { continue; }
    aus.push({ kennung, art: artZuEndung(endung), groesse: st.size, seit: st.mtime.toISOString() });
  }
  return aus.sort((a, b) => (a.seit < b.seit ? 1 : -1));
}

module.exports = { MEDIA_DIR, MAX_BILD, ARTEN, istKennung, ablegen, lesen, loeschen, bestand, sicherstellen };
