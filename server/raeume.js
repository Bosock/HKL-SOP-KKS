/* ─────────────────────────────────────────────────────────────
   RÄUME — zwei vollständig getrennte Datenbestände in derselben App

   Warum es das gibt:
   Der BESTAND ist das, womit im Herzkatheterlabor jeden Tag gearbeitet wird.
   Er darf durch nichts, was daneben ausprobiert wird, auch nur berührt werden.
   Der NEUAUFBAU ist ein zweiter, anfangs völlig leerer Raum: ohne die
   eingelesenen Word-Standards, ohne Material, ohne Bilder. Dort wird die App
   von Grund auf neu eingerichtet — so, wie ein Haus anfinge, das sie zum
   ersten Mal benutzt.

   Getrennt ist ALLES, was Daten sind:
     · eigene state.json        (der geteilte Zustand)
     · eigener backups/-Ordner  (rotierende Sicherungen, wie beim Bestand)
     · eigener media/-Ordner    (Bilder — ausdrücklich so gewünscht)
   Gemeinsam ist nur der PROGRAMMCODE. Ein neues Bedienelement steht deshalb
   grundsätzlich in beiden Räumen zur Verfügung — wo es nur im Neuaufbau
   erscheinen soll, entscheidet der Client (siehe public/js/core/store.js,
   RAUM.neu).

   Die wichtigste Regel steht in ausAnfrage(): OHNE Raumangabe ist IMMER der
   Bestand gemeint. Jede Anfrage, die es vor den Räumen gab, landet damit
   genau dort, wo sie immer gelandet ist — Byte für Byte. Kein Gerät im Saal
   muss etwas davon wissen.

   Der ZEIGER (raeume.json, Feld `live`) sagt, welcher Raum der „Live-Raum"
   ist. Er lenkt bewusst KEINE Anfrage um — er ist nur eine Auskunft an die
   Geräte (GET /api/raeume). Ein Gerät, das keinem Raum fest zugeordnet ist,
   folgt ihm beim nächsten Start und wechselt dabei seinen eigenen lokalen
   Speicherbereich mit. So kann der Neuaufbau eines Tages als Ganzes live
   geschaltet werden, ohne dass ein Gerät alte Bestandsdaten in den neuen Raum
   „zurückbefüllt". Zurückschalten ist dieselbe Handbewegung: Zeiger zurück,
   und jedes Gerät findet seinen alten Stand unverändert vor.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');
const { STATE_DIR, STATE_FILE, BACKUP_DIR } = require('./config');
const { MEDIA_DIR } = require('./media');

const RAEUME_DIR = path.join(STATE_DIR, 'raeume');
const ZEIGER_DATEI = path.join(STATE_DIR, 'raeume.json');

function raumOrdner(id) {
  const dir = path.join(RAEUME_DIR, id);
  return {
    stateFile: path.join(dir, 'state.json'),
    backupDir: path.join(dir, 'backups'),
    mediaDir: path.join(dir, 'media'),
  };
}

/* Die Liste ist FEST. Es gibt keinen Weg, über eine Anfrage einen weiteren
   Raum anzulegen — sonst könnte jeder mit einer erfundenen Raumangabe
   Ordner auf der Platte erzeugen. */
const RAEUME = Object.freeze({
  /* Der Bestand liegt dort, wo die Daten immer lagen: direkt in STATE_DIR. */
  bestand: Object.freeze({
    id: 'bestand', titel: 'Bestand', basis: true,
    stateFile: STATE_FILE, backupDir: BACKUP_DIR, mediaDir: MEDIA_DIR,
  }),
  /* basis:false — der Neuaufbau lädt KEINE mitgelieferten Standards und
     keine Material-Kataloge. Er beginnt leer. */
  neuaufbau: Object.freeze(Object.assign({ id: 'neuaufbau', titel: 'Neuaufbau', basis: false }, raumOrdner('neuaufbau'))),
});
const STANDARD = 'bestand';

function istRaum(id) { return typeof id === 'string' && Object.prototype.hasOwnProperty.call(RAEUME, id); }

/* Welchen Raum meint diese Anfrage? Ohne Angabe: den Bestand (siehe oben).
   Eine unbekannte Angabe ist ein Fehler (null) — nie stillschweigend der
   Bestand, sonst schriebe ein vertippter Raumname in die Live-Daten. */
function ausAnfrage(url) {
  const r = url.searchParams.get('raum');
  if (r == null || r === '') return RAEUME[STANDARD];
  return istRaum(r) ? RAEUME[r] : null;
}

/* Der Zeiger wird bei jeder Abfrage frisch gelesen: Umschalten heißt, die
   Datei zu ändern — ohne Neustart. Fehlt sie oder ist sie kaputt, gilt der
   Bestand. */
function liveRaum() {
  try {
    const j = JSON.parse(fs.readFileSync(ZEIGER_DATEI, 'utf8'));
    if (j && istRaum(j.live)) return j.live;
  } catch (e) { /* keine oder unlesbare Datei → Bestand */ }
  return STANDARD;
}

/* ── Umschalten ──────────────────────────────────────────────────────────
   Der Live-Schalter in der App (features/raum.js) schreibt den Zeiger. Er
   verlangt das Passwort des Neuaufbaus — als Fingerabdruck, genau wie die App
   es speichert (pwHash, public/js/core/config.js; hier wortgleich). Erwartet
   wird der im Bestand hinterlegte Fingerabdruck (hkl_raumpw), sonst der der
   Vorgabe. Das ist — wie jedes Passwort dieser App — Komfort, keine
   Sicherheit (Grundsatz A9): Es verhindert den Fehlgriff, nicht die Absicht. */
const RAUM_PW_VORGABE = 'abcdefg';
function pwHash(s) { let h = 5381; s = String(s); for (let i = 0; i < s.length; i++) { h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0; } return 'h' + h.toString(36); }
function erwarteterFingerabdruck(bestandZustand) {
  const v = bestandZustand && bestandZustand.hkl_raumpw;
  return (typeof v === 'string' && v) ? v : pwHash(RAUM_PW_VORGABE);
}

/* Den Zeiger setzen — atomar über eine Zwischendatei, mit kurzem Verlauf
   (wann wurde wohin geschaltet). Gibt den neuen Inhalt zurück. */
function liveSetzen(id) {
  if (!istRaum(id)) { const e = new Error('unknown room'); e.code = 'RAUM'; throw e; }
  let alt = {};
  try { alt = JSON.parse(fs.readFileSync(ZEIGER_DATEI, 'utf8')) || {}; } catch (e) { alt = {}; }
  const vorher = istRaum(alt.live) ? alt.live : STANDARD;
  const jetzt = new Date().toISOString();
  const verlauf = (Array.isArray(alt.verlauf) ? alt.verlauf : []).concat([{ live: id, vorher, at: jetzt }]).slice(-20);
  const neu = { live: id, geaendert: jetzt, verlauf };
  fs.mkdirSync(path.dirname(ZEIGER_DATEI), { recursive: true });
  const tmp = ZEIGER_DATEI + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(neu, null, 2));
  fs.renameSync(tmp, ZEIGER_DATEI);
  return neu;
}

module.exports = { RAEUME, STANDARD, RAEUME_DIR, ZEIGER_DATEI, RAUM_PW_VORGABE, istRaum, ausAnfrage, liveRaum, liveSetzen, pwHash, erwarteterFingerabdruck };
