/* NEUE APP — Kamera zum Barcode-Scannen (public/neu/js/barcode.js), im echten Browser.

   Handys haben hinten mehrere Kameras; „hintere Kamera" überlässt die Wahl dem
   Browser, und der nimmt manchmal eine, die aus der Nähe nicht scharf stellt.
   Geprüft wird hier mit nachgebildeten Kameras (Namen wie auf iPhone und
   Android, Fähigkeiten wie Autofokus, Zoom, Licht):
   · die passende Kamera wird gewählt (virtuelle iPhone-Kamera, Android „0"),
   · Autofokus „laufend" und — bei virtuellen iPhone-Kameras — Zoom 2,
   · „Kamera wechseln", „2×", „Licht"; die Kamera mit Treffer wird gemerkt
     und beim nächsten Mal direkt geöffnet; eine verschwundene vergessen,
   · nach 4 s ohne Treffer ein Hinweis; ein kleiner Code im Zielrahmen wird
     gelesen (Zielrahmen in voller Auflösung),
   · Einstellungen zeigen die gemerkte Kamera; „Vergessen".
   Der BESTAND bleibt Byte für Byte unverändert. */
'use strict';
const { launchBrowser, startServer, reporter } = require('./util');

function ean13(z12) { const z = z12.split('').map(Number); let s = 0; z.forEach((d, i) => { s += d * (i % 2 ? 3 : 1); }); return z12 + ((10 - (s % 10)) % 10); }
function eanBits(code) {
  const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
  const R = L.map(x => x.split('').map(b => b === '1' ? '0' : '1').join('')); const G = R.map(x => x.split('').reverse().join(''));
  const P = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'][+code[0]];
  let b = '101'; for (let i = 1; i <= 6; i++) b += (P[i - 1] === 'L' ? L : G)[+code[i]]; b += '01010'; for (let i = 7; i <= 12; i++) b += R[+code[i]]; return b + '101';
}
const E1 = ean13('401234567890'), E2 = ean13('401234567891'), E3 = ean13('401234567892');
async function json(base, p) { return (await fetch(base + p, { cache: 'no-store' })).json(); }
async function warte(page, fn, arg, ms) { try { await page.waitForFunction(fn, arg, { timeout: ms || 8000 }); return true; } catch (e) { return false; } }

const IPHONE = [
  { id: 'f', label: 'Front Camera' }, { id: 'w', label: 'Back Camera' }, { id: 'u', label: 'Back Ultra Wide Camera' },
  { id: 't', label: 'Back Telephoto Camera' }, { id: 'dw', label: 'Back Dual Wide Camera' }, { id: 'tr', label: 'Back Triple Camera' },
];
const CAPS_IPHONE = { w: { focusMode: ['continuous'], zoom: { min: 1, max: 5 } }, tr: { focusMode: ['continuous', 'single-shot'], zoom: { min: 1, max: 6 } },
  dw: { focusMode: ['continuous'], zoom: { min: 1, max: 4 } }, u: {}, t: { focusMode: ['continuous'] } };
const ANDROID = [{ id: 'a1', label: 'camera2 1, facing front' }, { id: 'a2', label: 'camera2 2, facing back' }, { id: 'a0', label: 'camera2 0, facing back' }];
const CAPS_ANDROID = { a0: { focusMode: ['continuous', 'single-shot', 'manual'], zoom: { min: 1, max: 8 }, torch: true }, a2: { focusMode: ['manual'] } };

(async () => {
  const r = reporter('neue-app-kamera');
  const srv = await startServer();
  const browser = await launchBrowser();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
  p.on('dialog', d => { errs.push('NATIVER DIALOG: ' + d.message()); d.dismiss(); });
  await p.goto(srv.base + '/', { waitUntil: 'networkidle' });
  const bestandVorher = JSON.stringify((await json(srv.base, '/api/state')).state);
  await p.evaluate(() => { localStorage.setItem('hkl_raumwahl', 'neuaufbau'); localStorage.setItem('raum:neuaufbau:hkl_authuntil', String(Date.now() + 3600000)); });
  await p.goto(srv.base + '/neu/#/material/neu', { waitUntil: 'networkidle' });
  await p.evaluate(() => naEinstellungSetzen('register', false));   /* ohne Register — hier geht es nur um die Kamera */

  /* Nachgebildete Kameras: eine Zeichenfläche (hochkant wie am Handy), Namen, Fähigkeiten, Protokoll. */
  await p.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1920; const x = c.getContext('2d'); let t = 0;
    window.__kam = { geraete: [], standard: '', caps: {}, log: [], bits: '', modul: 6 };
    setInterval(() => { const k = window.__kam; x.fillStyle = (t++ % 2) ? '#fefefe' : '#fff'; x.fillRect(0, 0, c.width, c.height);
      if (k.bits) { const m = k.modul, links = Math.round((c.width - k.bits.length * m) / 2); x.fillStyle = '#000';
        for (let i = 0; i < k.bits.length; i++) if (k.bits[i] === '1') x.fillRect(links + i * m, c.height / 2 - 80, m, 160); } }, 100);
    navigator.mediaDevices.enumerateDevices = async () => window.__kam.geraete.map(g => ({ kind: 'videoinput', deviceId: g.id, label: g.label, groupId: '' }));
    navigator.mediaDevices.getUserMedia = async w => {
      const k = window.__kam; const v = (w && w.video) || {}; const id = v.deviceId && v.deviceId.exact;
      k.log.push(id ? 'öffne:' + id : 'öffne:hinten');
      if (id && !k.geraete.some(g => g.id === id)) throw new DOMException('Kamera gibt es nicht', 'OverconstrainedError');
      const gew = id || k.standard; const st = c.captureStream(10); const tr = st.getVideoTracks()[0];
      const set = { deviceId: gew, width: 1080, height: 1920, zoom: 1 };
      tr.getSettings = () => Object.assign({}, set);
      tr.getCapabilities = () => k.caps[gew] || {};
      tr.applyConstraints = async c2 => { const a = (c2.advanced || [c2])[0]; k.log.push('stelle:' + gew + ':' + Object.keys(a).map(n => n + '=' + JSON.stringify(a[n])).join(',')); Object.assign(set, a); };
      return st;
    };
  });
  const kam = (o) => p.evaluate(a => Object.assign(window.__kam, a), o);
  const log = () => p.evaluate(() => window.__kam.log.slice());
  const gemerkt = () => p.evaluate(() => naKameraGemerkt());
  const info = () => p.textContent('#naScanInfo');

  /* ── 1. iPhone: der Browser gibt die Weitwinkel-Kamera — gewählt wird die virtuelle Triple-Kamera ── */
  await kam({ geraete: IPHONE, standard: 'w', caps: CAPS_IPHONE, log: [], bits: '' });
  await p.click('[data-na="scan"]');
  r.check('iPhone: zuerst „hintere Kamera", dann Wechsel auf „Back Triple Camera" (wechselt die Linse selbst, auch Makro)',
    await warte(p, () => /Back Triple Camera/.test((document.getElementById('naScanInfo') || {}).textContent || '')) && (await log()).filter(x => /^öffne/.test(x)).join(' ') === 'öffne:hinten öffne:tr');
  const l1 = await log();
  r.check('… Autofokus „laufend" und Zoom 2 (normaler Bildausschnitt statt Ultraweitwinkel)', l1.indexOf('stelle:tr:focusMode="continuous"') >= 0 && l1.indexOf('stelle:tr:zoom=2') >= 0 && /Zoom 2×/.test(await info()));
  r.check('… „Kamera wechseln (1/5)" — die Frontkamera zählt nicht', /Kamera wechseln \(1\/5\)/.test(await p.textContent('#naScanWechsel')) && await p.isVisible('#naScanWechsel'));
  r.check('… „1×"-Knopf (Zoom ist aktiv); kein Licht, wo die Kamera keins hat', (await p.textContent('#naScanZoom')) === '1×' && !(await p.isVisible('#naScanLicht')));
  /* Wechseln: Dual Wide, dann gemerkt */
  await p.click('#naScanWechsel');
  r.check('„Kamera wechseln": nächste ist „Back Dual Wide Camera" (2/5) — und gemerkt', await warte(p, () => /Back Dual Wide Camera/.test(document.getElementById('naScanInfo').textContent))
    && /\(2\/5\)/.test(await p.textContent('#naScanWechsel')) && ((await gemerkt()) || {}).id === 'dw');
  /* Nach 4 s ohne Treffer: Hinweis */
  r.check('nach 4 s ohne Treffer: Hinweis auf Abstand, „2×" und „Kamera wechseln"', await warte(p, () => /weiter weg halten[\s\S]*Kamera wechseln/.test(document.getElementById('naScanStand').textContent), null, 9000));
  await kam({ bits: eanBits(E1), modul: 6 });
  r.check('Code im Bild: gelesen, Scanner schließt', await warte(p, g => !document.getElementById('naScanOv') && NA_ENTWURF && NA_ENTWURF.obj.gtin === g, '0' + E1, 12000));
  r.check('… die Kamera mit dem Treffer bleibt gemerkt', ((await gemerkt()) || {}).id === 'dw' && ((await gemerkt()) || {}).label === 'Back Dual Wide Camera');

  /* ── 2. Nächster Scan: die gemerkte Kamera wird direkt geöffnet ── */
  await p.click('[data-na="entwAbbrechen"]'); await p.click('#naSheet.show button:has-text("Verwerfen")').catch(() => {});
  await p.evaluate(() => naGeh('#/material/neu'));
  await kam({ log: [], bits: '' });
  await p.click('[data-na="scan"]');
  await warte(p, () => /Back Dual Wide Camera/.test((document.getElementById('naScanInfo') || {}).textContent || ''));
  await p.waitForTimeout(400);
  r.check('gemerkte Kamera direkt geöffnet — kein Umweg, kein Wechsel', (await log()).filter(x => /^öffne/.test(x)).join(' ') === 'öffne:dw');
  await p.click('#naScanZu');

  /* ── 3. Die gemerkte Kamera gibt es nicht mehr → vergessen, neu wählen ── */
  await kam({ geraete: IPHONE.filter(g => g.id !== 'dw'), log: [] });
  await p.click('[data-na="scan"]');
  r.check('verschwundene Kamera: vergessen, „hintere Kamera", dann wieder die Triple-Kamera', await warte(p, () => /Back Triple Camera/.test((document.getElementById('naScanInfo') || {}).textContent || ''))
    && (await log()).filter(x => /^öffne/.test(x)).join(' ') === 'öffne:dw öffne:hinten öffne:tr' && (await gemerkt()) === null);
  await p.click('#naScanZu');

  /* ── 4. Android: der Browser gibt „camera2 2" (fester Fokus) — gewählt wird „camera2 0" ── */
  await kam({ geraete: ANDROID, standard: 'a2', caps: CAPS_ANDROID, log: [] });
  await p.click('[data-na="scan"]');
  r.check('Android: Wechsel von „camera2 2" auf die Hauptkamera „camera2 0"', await warte(p, () => /camera2 0, facing back/.test((document.getElementById('naScanInfo') || {}).textContent || ''))
    && (await log()).filter(x => /^öffne/.test(x)).join(' ') === 'öffne:hinten öffne:a0');
  r.check('… Autofokus laufend; Licht- und 2×-Knopf (Zoom bleibt 1×)', (await log()).indexOf('stelle:a0:focusMode="continuous"') >= 0 && await p.isVisible('#naScanLicht') && (await p.textContent('#naScanZoom')) === '2×' && !/Zoom/.test(await info()));
  await p.click('#naScanLicht');
  r.check('„Licht": an', await warte(p, () => document.getElementById('naScanLicht').classList.contains('an') && /Licht an/.test(document.getElementById('naScanInfo').textContent)) && (await log()).indexOf('stelle:a0:torch=true') >= 0);
  await p.click('#naScanZoom');
  r.check('„2×": Zoom 2, Hinweis auf größeren Abstand', await warte(p, () => /Zoom 2×/.test(document.getElementById('naScanInfo').textContent) && /20–30 cm/.test(document.getElementById('naScanStand').textContent)) && (await log()).indexOf('stelle:a0:zoom=2') >= 0);
  await p.click('#naScanZoom');
  r.check('„1×": zurück', await warte(p, () => !/Zoom/.test(document.getElementById('naScanInfo').textContent)) && (await p.textContent('#naScanZoom')) === '2×');
  /* Kleiner Code (1,75 Pixel je Strich) im Zielrahmen */
  await kam({ bits: eanBits(E2), modul: 1.75 });
  r.check('kleiner Code (1,75 px je Strich) im Zielrahmen: gelesen', await warte(p, g => !document.getElementById('naScanOv') && NA_ENTWURF && NA_ENTWURF.obj.gtin === g, '0' + E2, 15000));
  r.check('… Hauptkamera gemerkt', ((await gemerkt()) || {}).id === 'a0');

  /* ── 5. Ohne Kameranamen (alter Browser): bleibt bei „hintere Kamera", kein Fehler ── */
  await p.click('[data-na="entwAbbrechen"]'); await p.click('#naSheet.show button:has-text("Verwerfen")').catch(() => {});
  await p.evaluate(() => { naKameraMerken(null); naGeh('#/material/neu'); });
  await kam({ geraete: [{ id: 'x1', label: '' }, { id: 'x2', label: '' }], standard: 'x1', caps: {}, log: [], bits: eanBits(E3), modul: 6 });
  await p.click('[data-na="scan"]');
  r.check('Kameras ohne Namen: kein Wechsel, Code gelesen', await warte(p, g => !document.getElementById('naScanOv') && NA_ENTWURF && NA_ENTWURF.obj.gtin === g, '0' + E3, 12000)
    && (await log()).filter(x => /^öffne/.test(x)).join(' ') === 'öffne:hinten');

  /* ── 6. Einstellungen: gemerkte Kamera sehen und vergessen ── */
  await p.click('[data-na="entwAbbrechen"]'); await p.click('#naSheet.show button:has-text("Verwerfen")').catch(() => {});
  await p.evaluate(() => naKameraMerken({ id: 'a0', label: 'camera2 0, facing back' }));
  await p.evaluate(() => naGeh('#/einstellungen'));
  r.check('Einstellungen: „Kamera zum Barcode-Scannen" nennt die gemerkte Kamera', await warte(p, () => /Kamera zum Barcode-Scannen[\s\S]*Gemerkt: camera2 0, facing back/.test(document.getElementById('naMain').textContent)));
  await p.click('[data-na="kameraVergessen"]');
  r.check('… „Vergessen"', await warte(p, () => naKameraGemerkt() === null && /Noch keine gemerkt/.test(document.getElementById('naMain').textContent)));

  r.check('Server (Bestand): Byte für Byte unverändert', JSON.stringify((await json(srv.base, '/api/state')).state) === bestandVorher);
  r.check('keine Fehler' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''), errs.length === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error(e); process.exit(1); });
