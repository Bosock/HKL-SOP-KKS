'use strict';
/* Tests für die Schritt-Fotos der Anleitungen (public/js/features/guides.js).

   Der Befund, der dazu geführt hat: Ein Foto am Anleitungs-Schritt lag als
   base64 IM Schritt — und `hkl_guides` ist ein GETEILTER Schlüssel
   (core/sync.js). Damit hing an jedem Foto zweierlei:

     · der Gerätespeicher (localStorage, ~5 MB) war nach wenigen Fotos voll,
     · und bei JEDER Änderung an der Anleitung — auch beim Korrigieren eines
       einzigen Wortes — wanderte der gesamte Bildbestand erneut zum Server.

   Sichtbar wurde beides nur als oranges „lokal"-Pill in der Kopfleiste: Es
   kam schlicht nichts mehr an. Deshalb prüft dieser Test nicht „geht es",
   sondern WAS AM SCHRITT LANDET — eine Adresse, kein Bild. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'public/js/features/guides.js'), 'utf8');

const KENNUNG = '0123456789abcdef0123456789abcdef';
const GROSS = 'data:image/jpeg;base64,' + 'A'.repeat(400000);   /* ~300 KB Foto */

/* Eine Anleitung mit einem Schritt, offen im Editor. `medien` bestimmt, was der
   Medienspeicher liefert: eine Adresse (Normalfall), die Quelle unverändert
   (kein sicherer Kontext / kein IndexedDB) oder ein Fehler. */
function umgebung(medien) {
  const store = {
    hkl_guides: [{ id: 'g1', titel: 'Einsatzbereitschaft', schritte: [{ id: 's1', text: 'Knopf drücken' }] }],
  };
  const ctx = vm.createContext({
    console, Promise, setTimeout,
    loadJSON: (k, d) => (k in store) ? JSON.parse(JSON.stringify(store[k])) : d,
    saveJSON: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
    esc: (s) => String(s == null ? '' : s),
    $: () => ({ innerHTML: '' }),                       /* der Editor rendert ins Leere */
    ADMIN: true,
    /* verkleinert „auf ein Zehntel" — der Rückfallweg, wenn der Medienspeicher
       nicht liefert. Muss das Original ERSETZEN, nicht danebenstehen. */
    shrinkPhoto: (src, cb) => cb(src.slice(0, Math.ceil(src.length / 10))),
    medIstMediaUrl: (u) => typeof u === 'string' && u.indexOf('/api/media/') === 0,
    medFotoSichern: medien,
  });
  vm.runInContext(SRC + `
    ;guideEditId = 'g1';
    ;globalThis.__f = { setzen:guideStepBildSetzen, guide:()=>guideById('g1') };
  `, ctx);
  return { f: ctx.__f, store };
}

test('ein neues Schritt-Foto landet als Adresse am Schritt, nicht als base64', async () => {
  const { f, store } = umgebung(async () => '/api/media/' + KENNUNG);
  await f.setzen(0, GROSS);
  assert.equal(f.guide().schritte[0].bild, '/api/media/' + KENNUNG);
  const gespeichert = JSON.stringify(store.hkl_guides);
  assert.ok(gespeichert.indexOf('data:image') < 0, 'kein base64 im geteilten Zustand');
  assert.ok(gespeichert.length < 500, 'der Schlüssel bleibt klein — das war der ganze Punkt');
});

test('ohne Medienspeicher bleibt das Foto — aber VERKLEINERT', async () => {
  /* Kein sicherer Kontext, kein IndexedDB: medFotoSichern gibt die Quelle
     unverändert zurück. Dann ist ein großes Foto besser als gar keins, das
     unverkleinerte Original aber darf nie in den Zustand. */
  const { f } = umgebung(async (src) => src);
  await f.setzen(0, GROSS);
  const bild = f.guide().schritte[0].bild;
  assert.ok(bild.indexOf('data:image') === 0, 'Rückfall auf base64');
  assert.ok(bild.length < GROSS.length, 'aber nicht in Originalgröße');
});

test('ein Fehler im Medienspeicher verliert das Foto nicht', async () => {
  const { f } = umgebung(async () => { throw new Error('kein Netz'); });
  await f.setzen(0, GROSS);
  const bild = f.guide().schritte[0].bild;
  assert.ok(bild && bild.indexOf('data:image') === 0);
  assert.ok(bild.length < GROSS.length);
});

test('ist der Medienspeicher gar nicht geladen, geht der alte Weg weiter', async () => {
  const { f } = umgebung(undefined);
  await f.setzen(0, GROSS);
  assert.ok(f.guide().schritte[0].bild.length < GROSS.length);
});

test('ein Schritt, den es nicht mehr gibt, bringt nichts zum Absturz', async () => {
  const { f } = umgebung(async () => '/api/media/' + KENNUNG);
  await f.setzen(7, GROSS);
  assert.equal(f.guide().schritte.length, 1);
});
