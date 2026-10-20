'use strict';
/* Räume auf dem GERÄT: welcher Raum gilt (core/store.js), welche Passwörter
   gelten (core/config.js, features/raum.js), wohin „Verlassen" und der
   Live-Schalter führen — und dass das Verwaltungspasswort jetzt über den
   Abgleich geteilt wird (vorher blieb es still auf einem Gerät liegen).

   Geladen werden die echten Dateien, wie der Browser sie lädt — als Skripte
   im selben Namensraum, mit einem nachgebauten localStorage. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const serverRaeume = require('../server/raeume');

const ROOT = path.join(__dirname, '..');
const lies = (f) => fs.readFileSync(path.join(ROOT, 'public/js', f), 'utf8');

function speicher(start) {
  const m = new Map(Object.entries(start || {}));
  const s = {
    schreibvorgaenge: 0,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { s.schreibvorgaenge++; m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
    m,
  };
  return s;
}

/* Ein Gerät mit gegebenem Speicherinhalt, frisch „geladen". */
function geraet(start) {
  const ls = speicher(start);
  const neuGeladen = { n: 0 };
  const ctx = vm.createContext({
    console, localStorage: ls, document: undefined, window: undefined,
    setTimeout: () => {}, clearTimeout: () => {},
    location: { reload: () => { neuGeladen.n++; } },
    toast: () => {},
    vsum: (ico, titel, text, badge) => `<summary>${titel}|${text}|${badge || ''}</summary>`,
  });
  ['core/store.js', 'core/config.js', 'features/raum.js'].forEach(f => vm.runInContext(lies(f), ctx, { filename: f }));
  return { ls, neuGeladen, run: (code) => vm.runInContext(code, ctx) };
}

/* ═══ Welcher Raum gilt ═══ */
test('Raum: ohne Wahl und ohne Live-Meldung gilt der Bestand', () => {
  const g = geraet();
  assert.equal(g.run('RAUM.id'), 'bestand');
  assert.equal(g.run('RAUM.wahl'), null);
  assert.equal(g.run('raumParam()'), '', 'Bestand-Anfragen bleiben ohne Raumangabe');
});
test('Raum: ein Gerät ohne Wahl folgt dem gemerkten Live-Raum', () => {
  const g = geraet({ hkl_liveraum: 'neuaufbau' });
  assert.equal(g.run('RAUM.id'), 'neuaufbau');
  assert.equal(g.run('RAUM.gewaehlt'), false);
  assert.equal(g.run('raumParam()'), '?raum=neuaufbau');
});
test('Raum: die eigene Wahl schlägt den Live-Raum (alten Bestand ansehen)', () => {
  const g = geraet({ hkl_liveraum: 'neuaufbau', hkl_raumwahl: 'bestand' });
  assert.equal(g.run('RAUM.id'), 'bestand');
  assert.equal(g.run('RAUM.wahl'), 'bestand');
});
test('Raum: erfundene Werte im Speicher führen nie in einen erfundenen Raum', () => {
  const g = geraet({ hkl_liveraum: 'keller', hkl_raumwahl: '__proto__' });
  assert.equal(g.run('RAUM.id'), 'bestand');
  assert.equal(g.run('raumWaehlen("keller")'), false);
});
test('Raumwahl: setzen, aufgeben, Anmeldung im Zielraum', () => {
  const g = geraet();
  assert.equal(g.run('raumWaehlen("neuaufbau", 4242)'), true);
  assert.equal(g.ls.m.get('hkl_raumwahl'), 'neuaufbau');
  assert.equal(g.ls.m.get('raum:neuaufbau:hkl_authuntil'), '4242', 'gleich angemeldet — kein drittes Passwort');
  assert.equal(g.run('raumWaehlen(null)'), true);
  assert.equal(g.ls.m.has('hkl_raumwahl'), false, 'ohne Wahl folgt das Gerät dem Live-Raum');
  /* Dem Live-Raum folgen und dort angemeldet sein */
  g.run('raumLiveMerken("neuaufbau")');
  g.run('raumWaehlen(null, 777)');
  assert.equal(g.ls.m.get('raum:neuaufbau:hkl_authuntil'), '777');
  assert.equal(g.ls.m.has('hkl_authuntil'), false, 'der Bestand bekommt so keine Anmeldung geschenkt');
});
test('Live-Raum merken: nur schreiben, wenn er sich ändert', () => {
  const g = geraet();
  assert.equal(g.run('raumLiveGemerkt()'), 'bestand');
  g.run('raumLiveMerken("neuaufbau")');
  const n = g.ls.schreibvorgaenge;
  g.run('raumLiveMerken("neuaufbau")'); g.run('raumLiveMerken("neuaufbau")');
  assert.equal(g.ls.schreibvorgaenge, n, 'gleicher Wert — kein Schreiben (läuft jede Minute)');
  g.run('raumLiveMerken("gibtsnicht")');
  assert.equal(g.run('raumLiveGemerkt()'), 'neuaufbau');
});

/* ═══ Verwaltungspasswort ═══ */
test('Verwaltungspasswort: Bestand behält 1234567, der Neuaufbau beginnt mit abcdefg', () => {
  const b = geraet();
  assert.equal(b.run('checkPw("1234567")'), true);
  assert.equal(b.run('checkPw("abcdefg")'), false);
  const n = geraet({ hkl_raumwahl: 'neuaufbau' });
  assert.equal(n.run('checkPw("abcdefg")'), true);
  assert.equal(n.run('checkPw("1234567")'), false);
});
test('Verwaltungspasswort wird geteilt: als JSON gespeichert, auf dem zweiten Gerät gültig', () => {
  const a = geraet();
  a.run('setAuthPw("neuesPW")');
  const wert = a.ls.m.get('hkl_authpw');
  /* Der Abgleich (core/sync.js, payloadFor) schickt nur, was JSON.parse
     versteht — genau daran ist das Passwort vorher gescheitert. */
  const versendet = JSON.parse(wert);
  assert.equal(typeof versendet, 'string');
  assert.equal(a.run('checkPw("neuesPW")'), true);
  assert.equal(a.run('checkPw("1234567")'), false);
  /* Gerät B übernimmt den Wert so, wie adopt() ihn schreibt (JSON.stringify). */
  const b = geraet({ hkl_authpw: JSON.stringify(versendet) });
  assert.equal(b.run('checkPw("neuesPW")'), true, 'die Änderung gilt auf dem anderen Gerät');
  assert.equal(b.run('checkPw("1234567")'), false);
});
test('Verwaltungspasswort: ein alter, roher Wert gilt weiter — aber nur auf seinem Gerät', () => {
  const vorlage = geraet();
  const roh = vorlage.run('pwHash("altesPW")');
  const g = geraet({ hkl_authpw: roh });
  assert.equal(g.run('checkPw("altesPW")'), true, 'niemand verliert seinen Zugang');
  assert.throws(() => JSON.parse(roh), 'roh = wird nicht abgeglichen, also niemandem aufgezwungen');
});
test('Verwaltungspasswort: jeder Raum hat sein eigenes', () => {
  const n = geraet({ hkl_raumwahl: 'neuaufbau' });
  n.run('setAuthPw("nurNeu")');
  assert.equal(n.ls.m.has('hkl_authpw'), false, 'das Passwort des Bestands bleibt unberührt');
  assert.ok(n.ls.m.has('raum:neuaufbau:hkl_authpw'));
});

/* ═══ Zweitpasswort (Neuaufbau) ═══ */
test('Zweitpasswort: Vorgabe abcdefg, änderbar, als Fingerabdruck geteilt', () => {
  const g = geraet();
  assert.equal(g.run('raumPwStimmt("abcdefg")'), true);
  assert.equal(g.run('raumPwStimmt("")'), false);
  assert.equal(g.run('raumPwStimmt("1234567")'), false);
  g.run('raumPwSetzen("testraum")');
  assert.equal(g.run('raumPwStimmt("abcdefg")'), false, 'nach dem Ändern gilt die Vorgabe nicht mehr');
  assert.equal(g.run('raumPwStimmt("testraum")'), true);
  const gespeichert = JSON.parse(g.ls.m.get('hkl_raumpw'));
  assert.notEqual(gespeichert, 'testraum', 'nie das Wort selbst');
  /* Server und App erwarten denselben Fingerabdruck — mit und ohne Änderung. */
  assert.equal(serverRaeume.erwarteterFingerabdruck({ hkl_raumpw: gespeichert }), g.run('pwHash("testraum")'));
  assert.equal(serverRaeume.erwarteterFingerabdruck({}), g.run('pwHash("abcdefg")'));
  assert.equal(serverRaeume.RAUM_PW_VORGABE, g.run('RAUM_PW_VORGABE'));
});
test('Zweitpasswort ändern: neues muss sich vom Verwaltungspasswort unterscheiden', () => {
  const g = geraet();
  assert.ok(g.run('raumPwPruefeNeu("ab","ab")'));
  assert.ok(g.run('raumPwPruefeNeu("geheim1","geheim2")'));
  assert.ok(g.run('raumPwPruefeNeu("1234567","1234567")'));
  assert.equal(g.run('raumPwPruefeNeu("geheim1","geheim1")'), '');
});

/* ═══ Wohin Wechsel, Verlassen und Live-Schalter führen ═══ */
test('Wechsel in den Live-Raum gibt die eigene Wahl auf, in einen anderen Raum setzt er sie', async () => {
  const g = geraet();                                   /* live: Bestand */
  await g.run('raumWechseln("neuaufbau", 0)');
  assert.equal(g.ls.m.get('hkl_raumwahl'), 'neuaufbau');
  await g.run('raumWechseln("bestand", 0)');
  assert.equal(g.ls.m.has('hkl_raumwahl'), false, 'zurück im Live-Raum folgt das Gerät wieder dem Zeiger');
  g.run('raumLiveMerken("neuaufbau")');                 /* live: Neuaufbau */
  await g.run('raumWechseln("bestand", 0)');
  assert.equal(g.ls.m.get('hkl_raumwahl'), 'bestand', 'alten Bestand ansehen = eigene Wahl');
  await g.run('raumWechseln("neuaufbau", 0)');
  assert.equal(g.ls.m.has('hkl_raumwahl'), false);
  assert.equal(g.neuGeladen.n, 4, 'jeder Wechsel lädt neu');
});
test('Verlassen führt immer in den Live-Raum', async () => {
  const g = geraet({ hkl_liveraum: 'neuaufbau', hkl_raumwahl: 'bestand' });
  assert.equal(g.run('RAUM.id'), 'bestand');
  g.run('raumVerlassen()');
  await new Promise(r => setImmediate(r));
  assert.equal(g.ls.m.has('hkl_raumwahl'), false);
  assert.equal(g.neuGeladen.n, 1);
});
test('Live-Schalter bietet immer den Raum an, der gerade NICHT live ist', () => {
  const g = geraet();
  const a = g.run('raumLiveHTML()');
  assert.match(a, /data-ziel="neuaufbau"/);
  assert.match(a, /Neuaufbau live schalten/);
  assert.match(a, /id="raumPwLive"/);
  assert.match(a, /id="raumLiveOk"/, 'ohne Häkchen kein Umschalten');
  g.run('raumLiveMerken("neuaufbau")');
  const b = g.run('raumLiveHTML()');
  assert.match(b, /data-ziel="bestand"/);
  assert.match(b, /Bestand wieder live schalten/);
});
test('Verwaltungskarte: Eintritt direkt mit Passwort — kein „Festlegen" mehr', () => {
  const g = geraet();
  const h = g.run('raumPanelHTML()');
  assert.match(h, /id="raumPwEin"/);
  assert.doesNotMatch(h, /raumPwNeu1|Festlegen/);
  assert.match(h, /id="raumLiveKarte"/);
  assert.match(h, /id="raumFreigaben"/);
  assert.match(h, /id="raumKarte"/);
});
test('Verwaltungskarte: passt sich an — vier Lagen, vier Wege', () => {
  /* Bestand, Neuaufbau live (alter Bestand angesehen) */
  const altB = geraet({ hkl_liveraum: 'neuaufbau', hkl_raumwahl: 'bestand' }).run('raumPanelHTML()');
  assert.match(altB, /Zum Neuaufbau \(live\)/);
  assert.doesNotMatch(altB, /id="raumPwEin"/);
  assert.match(altB, /Bestand wieder live schalten/);
  /* Neuaufbau im Test (Bestand live) */
  const test1 = geraet({ hkl_raumwahl: 'neuaufbau' }).run('raumPanelHTML()');
  assert.match(test1, /Zurück zum Bestand/);
  assert.match(test1, /Neuaufbau live schalten/);
  /* Neuaufbau live */
  const live = geraet({ hkl_liveraum: 'neuaufbau' }).run('raumPanelHTML()');
  assert.match(live, /Alten Bestand ansehen/);
  assert.match(live, /Bestand wieder live schalten/);
  assert.doesNotMatch(live, /Zurück zum Bestand/);
});
