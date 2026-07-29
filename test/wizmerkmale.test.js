'use strict';
/* Tests für die Merkmals-Auswertung im Foto-Assistenten
   (public/js/features/ocrwizard.js, Abschnitt „MERKMALE im Assistenten").

   Der Assistent nimmt dasselbe Etikettenfoto ein zweites Mal her: einmal für
   die Stammfelder (REF, Name, Hersteller), einmal für die typisierten
   Merkmale. Diese Suite prüft die zweite Auswertung — an echten
   Etikettentexten, nicht an erfundenen Zeichenketten.

   Geprüft wird vor allem, was der Assistent NICHT tun darf:
     · einen mehrdeutigen Wert einfach setzen (er fragt),
     · eine getroffene Wahl bei einer Neuauswertung vergessen,
     · einen weggeklickten Vorschlag wieder anschleppen,
     · ohne Katalog überhaupt etwas anzeigen.

   Der echte Quelltext wird aus der Moduldatei herausgeschnitten und im
   Sandkasten ausgewertet — wer die Funktion ändert, prüft hier die Änderung
   und nicht eine Kopie davon. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const KAT = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/merkmale.json'), 'utf8'));
const MERK_SRC = fs.readFileSync(path.join(ROOT, 'public/js/features/merkmale.js'), 'utf8');
const WIZ_SRC = fs.readFileSync(path.join(ROOT, 'public/js/features/ocrwizard.js'), 'utf8');

/* `function NAME(…){…}` über Klammerzählung herausschneiden. */
function schnitt(quelle, name) {
  const sig = quelle.indexOf('function ' + name + '(');
  assert.notEqual(sig, -1, `Funktion ${name} nicht in ocrwizard.js gefunden`);
  let tiefe = 0;
  for (let j = quelle.indexOf('{', sig); j < quelle.length; j++) {
    if (quelle[j] === '{') tiefe++;
    else if (quelle[j] === '}') { tiefe--; if (tiefe === 0) return quelle.slice(sig, j + 1); }
  }
  throw new Error(`unbalancierte Klammern bei ${name}`);
}

/* merkmale.js und die Assistenten-Funktionen in EINEM Skript auswerten:
   nur so sehen die Assistenten-Funktionen das `let MERKKAT` des Moduls. */
const ctx = vm.createContext({ console, JSON, Math, Array, String, Object, RegExp });
vm.runInContext([
  MERK_SRC,
  'let WIZ=null;',
  "const esc=(s)=>(s==null?'':String(s).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c])));",
  'let RENDER=0; function wizRender(){ RENDER++; }',
  schnitt(WIZ_SRC, 'wizMerkAuswerten'),
  schnitt(WIZ_SRC, 'wizPickMerk'),
  schnitt(WIZ_SRC, 'wizDropMerk'),
  schnitt(WIZ_SRC, 'wizMerkHTML'),
  `;globalThis.__W = {
     setKat: (k)=>{ MERKKAT = k; },
     setWiz: (w)=>{ WIZ = w; },
     wiz: ()=>WIZ,
     renders: ()=>RENDER,
     auswerten: ()=>wizMerkAuswerten(),
     pick: (id,v)=>wizPickMerk(id,v),
     drop: (id)=>wizDropMerk(id),
     html: ()=>wizMerkHTML(),
   };`,
].join('\n'), ctx);
const W = ctx.__W;

const LEER_KAT = { merkmale: [], klassen: [], einheiten: {}, ref_grammatik: [], kompatibilitaet: { regeln: [] } };

/* Assistentenzustand wie nach der Texterkennung. */
function stand(text, ref) {
  const w = { schritt: 2, text: text, fields: { ref: ref || '' }, merk: null };
  W.setKat(KAT);
  W.setWiz(w);
  return w;
}
const wertVon = (w, id) => { const m = (w.merk.merkmale || []).filter(x => x.id === id)[0]; return m ? m.wert : undefined; };
const herkunftVon = (w, id) => { const m = (w.merk.merkmale || []).filter(x => x.id === id)[0]; return m ? m.herkunft : undefined; };

/* ═══════════ Echte Etikettentexte (abgeschrieben von Produktfotos) ═══════════ */

const LAUNCHER = `Launcher GUIDE CATHETER
  de Führungskatheter
  6Fr
  0.071 in
  EBU4.0
  SH
  (01)00763000565985
  (240)LA6EBU40SH
  REF Catalog number LA6EBU40SH
  Do not reuse
  STERILE EO Sterilized using ethylene oxide`;

const SUREFLEX_M = `SureFlex Steerable Guiding Sheath
  Baylis Medical
  REF TSK3003
  8.5 F
  71 cm
  Sterilized using ethylene oxide
  Single use only`;

/* ═══════════════════════════════════════════════════════════════
   1. Grundfall: der Assistent findet Merkmale ohne zweite Aufnahme
   ═══════════════════════════════════════════════════════════════ */

test('wizMerkAuswerten: erkennt Klasse und Merkmale aus dem Etikettentext', () => {
  const w = stand(LAUNCHER, 'LA6EBU40SH');
  W.auswerten();
  assert.ok(w.merk, 'es gibt ein Ergebnis');
  assert.equal(w.merk.klasse, 'fuehrungskatheter');
  assert.equal(String(wertVon(w, 'ad_fr')), '6');
  assert.equal(wertVon(w, 'kurvenform'), 'EBU4.0');
});

test('wizMerkAuswerten: Merkmale kommen nach Rang sortiert (Wichtiges zuerst)', () => {
  const w = stand(LAUNCHER, 'LA6EBU40SH');
  W.auswerten();
  const raenge = w.merk.merkmale.map(m => m.rang || 99);
  const sortiert = raenge.slice().sort((a, b) => a - b);
  assert.equal(raenge.join(','), sortiert.join(','));
});

test('wizMerkAuswerten: ohne Katalog bleibt der Merkmalsteil leer (nicht kaputt)', () => {
  const w = stand(LAUNCHER, 'LA6EBU40SH');
  W.setKat(LEER_KAT);
  W.auswerten();
  assert.equal(w.merk, null);
  assert.equal(W.html(), '', 'kein Merkmalsblock ohne Katalog');
  W.setKat(KAT);
});

test('wizMerkAuswerten: ohne Assistentenzustand passiert nichts', () => {
  W.setWiz(null);
  assert.doesNotThrow(() => W.auswerten());
  assert.equal(W.html(), '');
});

test('wizMerkAuswerten: leerer Text liefert kein erfundenes Merkmal', () => {
  const w = stand('', '');
  W.auswerten();
  assert.equal((w.merk.merkmale || []).length, 0);
});

/* ═══════════════════════════════════════════════════════════════
   2. Mehrdeutiges: der Assistent fragt, er entscheidet nicht
   ═══════════════════════════════════════════════════════════════ */

test('mehrdeutiges Merkmal landet NICHT in den Merkmalen, sondern in der Wahl', () => {
  /* Der ROTAWIRE-Fall: 0.009" Schaft, 0.014" Spitze. Beides ist auf dem
     Etikett gedruckt, keins ist „das" Maß. Der Katalog darf hier nicht raten. */
  const w = stand(`ROTAWIRE Drive Guidewire
    Boston Scientific
    0.009 in
    0.014 in
    Sterile EO
    Single use`, '');
  W.auswerten();
  const unklar = (w.merk.mehrdeutig || []).filter(x => x.id === 'draht_in')[0];
  assert.ok(unklar, 'Drahtstärke steht zur Wahl');
  assert.ok(Array.from(unklar.kandidaten).length >= 2);
  assert.equal(wertVon(w, 'draht_in'), undefined, 'kein Wert ohne Entscheidung');
});

test('wizPickMerk: die Wahl des Menschen wird gesetzt und verlässt die Wahlliste', () => {
  const w = stand(`ROTAWIRE Drive Guidewire
    0.009 in
    0.014 in`, '');
  W.auswerten();
  const vorher = W.renders();
  W.pick('draht_in', 0.014);
  assert.equal(wertVon(w, 'draht_in'), 0.014);
  assert.equal(herkunftVon(w, 'draht_in'), 'mensch');
  assert.equal((w.merk.mehrdeutig || []).filter(x => x.id === 'draht_in').length, 0);
  assert.ok(W.renders() > vorher, 'die Oberfläche wird neu gezeichnet');
});

test('wizPickMerk: die Wahl übersteht eine Neuauswertung (etwa nach REF-Wahl)', () => {
  const w = stand(`ROTAWIRE Drive Guidewire
    0.009 in
    0.014 in`, '');
  W.auswerten();
  W.pick('draht_in', 0.014);
  w.fields.ref = 'M0013010';                 /* wie nach wizPickRef */
  W.auswerten();
  assert.equal(wertVon(w, 'draht_in'), 0.014, 'Handarbeit bleibt Handarbeit');
  assert.equal(herkunftVon(w, 'draht_in'), 'mensch');
  assert.equal((w.merk.mehrdeutig || []).filter(x => x.id === 'draht_in').length, 0);
});

test('wizPickMerk: übernimmt Beschriftung und Einheit aus dem Katalog', () => {
  const w = stand(`ROTAWIRE Drive Guidewire
    0.009 in
    0.014 in`, '');
  W.auswerten();
  W.pick('draht_in', 0.014);
  const m = w.merk.merkmale.filter(x => x.id === 'draht_in')[0];
  const def = KAT.merkmale.filter(d => d.id === 'draht_in')[0];
  assert.equal(m.label, def.label);
  assert.equal(m.einheit, def.einheit || null);
  assert.equal(m.sicher, true);
});

test('wizPickMerk: ohne Zustand oder Ergebnis passiert nichts', () => {
  W.setWiz(null);
  assert.doesNotThrow(() => W.pick('draht_in', 0.014));
  W.setWiz({ schritt: 2, text: '', fields: {}, merk: null });
  assert.doesNotThrow(() => W.pick('draht_in', 0.014));
});

/* ═══════════════════════════════════════════════════════════════
   3. Verwerfen: ein falscher Vorschlag muss wegklickbar bleiben
   ═══════════════════════════════════════════════════════════════ */

test('wizDropMerk: verworfener Vorschlag verschwindet', () => {
  const w = stand(LAUNCHER, 'LA6EBU40SH');
  W.auswerten();
  assert.notEqual(wertVon(w, 'ad_fr'), undefined);
  W.drop('ad_fr');
  assert.equal(wertVon(w, 'ad_fr'), undefined);
});

test('wizDropMerk: verworfen bleibt verworfen — auch nach Neuauswertung', () => {
  const w = stand(LAUNCHER, 'LA6EBU40SH');
  W.auswerten();
  W.drop('kurvenform');
  W.auswerten();
  assert.equal(wertVon(w, 'kurvenform'), undefined, 'kommt nicht durch die Hintertür zurück');
});

test('wizDropMerk: löscht auch eine vorher getroffene Wahl', () => {
  const w = stand(`ROTAWIRE Drive Guidewire
    0.009 in
    0.014 in`, '');
  W.auswerten();
  W.pick('draht_in', 0.014);
  W.drop('draht_in');
  assert.equal(wertVon(w, 'draht_in'), undefined);
  W.auswerten();
  assert.equal(wertVon(w, 'draht_in'), undefined);
  assert.equal((w.merk.mehrdeutig || []).filter(x => x.id === 'draht_in').length, 0,
    'auch die Wahlfrage ist erledigt');
});

test('wizDropMerk: „weglassen" beendet auch eine offene Wahlfrage', () => {
  const w = stand(`ROTAWIRE Drive Guidewire
    0.009 in
    0.014 in`, '');
  W.auswerten();
  W.drop('draht_in');
  assert.equal((w.merk.mehrdeutig || []).filter(x => x.id === 'draht_in').length, 0);
});

/* ═══════════════════════════════════════════════════════════════
   4. Die Prüfseite: was der Anwender sieht
   ═══════════════════════════════════════════════════════════════ */

test('wizMerkHTML: zeigt Klasse, Merkmal mit Einheit und einen Verwerfen-Knopf', () => {
  stand(LAUNCHER, 'LA6EBU40SH');
  W.auswerten();
  const h = W.html();
  assert.ok(h.includes('MERKMALE'));
  assert.ok(h.includes('Führungskatheter'), 'Klassenname im Klartext');
  assert.ok(h.includes('6 F'), 'Wert mit Einheit');
  assert.ok(h.includes('wizDropMerk('), 'jeder Vorschlag ist wegklickbar');
});

test('wizMerkHTML: nennt die Herkunft je Merkmal', () => {
  stand(LAUNCHER, 'LA6EBU40SH');
  W.auswerten();
  const h = W.html();
  assert.ok(/beschriftetes Feld|aus der REF|Etikett \(gelesen\)/.test(h),
    'der Anwender sieht, woher ein Wert kommt');
});

test('wizMerkHTML: mehrdeutiges Merkmal erscheint als Auswahl samt „weglassen"', () => {
  stand(`ROTAWIRE Drive Guidewire
    0.009 in
    0.014 in`, '');
  W.auswerten();
  const h = W.html();
  assert.ok(h.includes('bitte auswählen'), 'die Frage wird gestellt');
  assert.ok(h.includes('wizPickMerk('));
  assert.ok(h.includes('weglassen'));
});

test('wizMerkHTML: gewähltes Merkmal wird als „von Ihnen gewählt" ausgewiesen', () => {
  stand(`ROTAWIRE Drive Guidewire
    0.009 in
    0.014 in`, '');
  W.auswerten();
  W.pick('draht_in', 0.014);
  assert.ok(W.html().includes('von Ihnen gewählt'));
});

test('wizMerkHTML: Lücken werden als Arbeitsauftrag genannt', () => {
  stand(SUREFLEX_M, 'TSK3003');
  W.auswerten();
  const h = W.html();
  assert.ok(h.includes('Nicht auf dem Etikett gefunden'),
    'was fehlt, steht da — geraten wird nichts');
});

test('wizMerkHTML: nicht erkannte Klasse wird als solche benannt', () => {
  stand('Nur irgendein Text ohne Produktbezug', '');
  W.auswerten();
  const h = W.html();
  assert.ok(h.includes('Materialklasse'));
  assert.ok(h.includes('nicht erkannt') || h.includes('unsicher'));
});

test('wizMerkHTML: unsichere Klasse wird zum Prüfen ausgewiesen', () => {
  const w = stand(LAUNCHER, 'LA6EBU40SH');
  W.auswerten();
  w.merk.klasseSicher = false;
  assert.ok(W.html().includes('unsicher – bitte prüfen'));
});

test('wizMerkHTML: Werte werden HTML-escaped (kein Einschleusen über das Etikett)', () => {
  const w = stand(LAUNCHER, 'LA6EBU40SH');
  W.auswerten();
  w.merk.merkmale = [{ id: 'x', label: '<b>L</b>', kurz: 'x', typ: 'text',
    einheit: null, wert: '<img src=x onerror=1>', sicher: true, herkunft: 'muster', rang: 10 }];
  const h = W.html();
  assert.ok(!h.includes('<img src=x'), 'kein rohes Markup aus dem Etikettentext');
  assert.ok(h.includes('&lt;img'), 'sondern escaped');
});

/* ═══════════════════════════════════════════════════════════════
   5. Der Fall, der das Ganze ausgelöst hat: zwei Varianten
   ═══════════════════════════════════════════════════════════════ */

test('SureFlex M und L: aus der REF wird die Kurve — die Varianten trennen sich', () => {
  const a = stand(SUREFLEX_M, 'TSK3003');
  W.auswerten();
  const curlA = wertVon(a, 'curl');
  const b = stand(SUREFLEX_M.replace('TSK3003', 'TSK3005'), 'TSK3005');
  W.auswerten();
  const curlB = wertVon(b, 'curl');
  assert.ok(curlA && curlB, 'beide bekommen eine Kurvenangabe');
  assert.notEqual(curlA, curlB, 'und zwar eine unterschiedliche');
  assert.equal(wertVon(a, 'schleuse_fr'), wertVon(b, 'schleuse_fr'),
    'French ist bei beiden gleich — daran ließen sie sich nie unterscheiden');
});
