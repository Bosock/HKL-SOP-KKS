/* MESSSTAND — „Etikett lesen" der neuen App an ECHTEN Fotos (kein Test).

   Misst die ganze Kette, wie sie in der Material-Maske läuft (stamm.js
   naEtikettLesen + naEtikettUebernehmen): Barcode im Foto, Texterkennung
   (ocr.js), bei quer liegenden Etiketten gedreht nachgelesen, Auswertung der
   neuen App (kern.js naEtikettAuswerten). Daneben, aus derselben Lesung, die
   bisherige Auswertung (ocr.js ocrZusammenfuehren + naHerstellerImText).
   Ohne Register-Abfrage — die käme im Betrieb mit der GTIN dazu.

   Die Fotos liegen NICHT im Projekt. Einmal holen (nur lesen, GET):
     node e2e/messen-etiketten.js --holen <ordner>
   lädt die Bilder der Materialien aus dem Neuaufbau (sops.kardio.wiki),
   dazu die Liste der Hersteller und die Materialien (für den Hersteller aus
   der GS1-Firmennummer). Messen:
     node e2e/messen-etiketten.js <ordner>
   Wahrheit je Foto: e2e/daten/etiketten-wahrheit.json (von Hand geprüft). */
'use strict';
const fs = require('fs'), path = require('path');
const { launchBrowser, startServer } = require('./util');
const WAHR = require('./daten/etiketten-wahrheit.json').fotos;

async function holen(ordner) {
  const quelle = process.env.NEUAUFBAU_URL || 'https://sops.kardio.wiki';
  fs.mkdirSync(ordner, { recursive: true });
  const st = ((await (await fetch(quelle + '/api/state?raum=neuaufbau', { cache: 'no-store' })).json()).state) || {};
  const mats = Object.keys(st).filter(k => /^na_m_/.test(k)).map(k => st[k]).filter(Boolean);
  let n = 0;
  for (const m of mats) for (const [i, f] of (m.fotos || []).entries()) {
    const k = typeof f === 'string' ? f : f.k; if (!k) continue;
    const r = await fetch(quelle + '/api/media/' + encodeURIComponent(k) + '?raum=neuaufbau'); if (!r.ok) continue;
    fs.writeFileSync(path.join(ordner, m.id + '_' + i + '.jpg'), Buffer.from(await r.arrayBuffer())); n++;
  }
  fs.writeFileSync(path.join(ordner, 'haus.json'), JSON.stringify({
    hersteller: ((st.na_l_hersteller || {}).eintraege || []).map(h => ({ id: h.id, name: h.name, amtlich: h.amtlich || '', srn: h.srn || '' })),
    materialien: mats.map(m => ({ id: m.id, name: m.name, gtin: m.gtin || '', hersteller: m.hersteller || '' })) }, null, 1));
  console.log(n + ' Fotos nach ' + ordner);
}

async function messen(ordner) {
  const haus = JSON.parse(fs.readFileSync(path.join(ordner, 'haus.json'), 'utf8'));
  const fotos = Object.keys(WAHR).filter(d => fs.existsSync(path.join(ordner, d)));
  const srv = await startServer(); const browser = await launchBrowser();
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await p.goto(srv.base + '/', { waitUntil: 'networkidle' });
  await p.evaluate(() => { localStorage.setItem('hkl_raumwahl', 'neuaufbau'); localStorage.setItem('raum:neuaufbau:hkl_authuntil', String(Date.now() + 3600000)); });
  await p.goto(srv.base + '/neu/', { waitUntil: 'networkidle' });
  await p.evaluate(h => { naEinstellungSetzen('register', false);
    naListeSpeichern('hersteller', h.hersteller.map(x => ({ id: x.id, name: x.name, amtlich: x.amtlich || undefined, srn: x.srn || undefined })));
    h.materialien.forEach(m => naSpeichern('material', Object.assign(naStammLeer('material'), m))); }, haus);
  const norm = s => String(s || '').toUpperCase().replace(/\s/g, '');
  const hOk = (name, wahr) => !!name && !!wahr && new RegExp(wahr.split(/[ .]+/).filter(x => x.length > 1)[0], 'i').test(name);
  const z = { soll: 0, neu: [0, 0, 0], alt: [0, 0, 0], prodNeu: 0, prodAlt: 0, hSoll: 0, hNeu: 0, hAlt: 0, ms: 0 };
  for (const d of fotos) {
    const t = WAHR[d]; const url = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(ordner, d)).toString('base64');
    const t0 = Date.now();
    const r = await p.evaluate(async u => {
      const L = await naEtikettLesen(u, () => {});
      const E = { obj: naStammLeer('material'), ocr: {}, neu: true, offen: {} };
      if (L.barcode && L.barcode.gtin) E.obj.gtin = L.barcode.gtin;
      if (L.barcode && L.barcode.itemRef) E.obj.ref = L.barcode.itemRef;
      naEtikettUebernehmen(E, L);
      const alt = naHerstellerImText(L.erg.text || '', naListe('hersteller', true));
      return { ref: E.obj.ref || '', vor: (E.ocr.refVorschlaege || [])[0] || '', h: E.obj.hersteller ? naListeName('hersteller', E.obj.hersteller) : '', grad: L.grad,
        altRef: (L.erg.fields && L.erg.fields.ref) || '', altVor: ((L.erg.refInfo || {}).vorschlaege || [])[0] || '', altH: alt ? alt.name || '' : '' };
    }, url);
    const ms = Date.now() - t0; z.ms += ms;
    const ok = x => t.ref.some(y => norm(y) === norm(x));
    const zaehle = (feld, ref, vor) => { if (ref && ok(ref)) feld[0]++; else if (ref) feld[2]++; else if (vor && ok(vor)) feld[1]++; };
    if (t.ref.length) { z.soll++; zaehle(z.neu, r.ref, r.vor); zaehle(z.alt, r.altRef, r.altVor); }
    else { if (r.ref) z.prodNeu++; if (r.altRef) z.prodAlt++; }
    if (t.hersteller && !t.optional) { z.hSoll++; if (hOk(r.h, t.hersteller)) z.hNeu++; if (hOk(r.altH, t.hersteller)) z.hAlt++; }
    console.log(d.padEnd(22), (ms / 1000).toFixed(1) + ' s', r.grad ? '(gedreht ' + r.grad + '°)' : '', '| REF', r.ref || ('(' + (r.vor || '-') + ')'), '| H', r.h || '-', '|| bisher REF', r.altRef || ('(' + (r.altVor || '-') + ')'), '| H', r.altH || '-');
  }
  console.log('\nEtikett lesen — ' + fotos.length + ' echte Fotos, davon ' + z.soll + ' mit REF\n');
  console.log('| | bisher | neu |\n|---|---|---|');
  console.log('| REF richtig eingetragen | ' + z.alt[0] + ' / ' + z.soll + ' | ' + z.neu[0] + ' / ' + z.soll + ' |');
  console.log('| REF als 1. Vorschlag | ' + z.alt[1] + ' | ' + z.neu[1] + ' |');
  console.log('| REF falsch eingetragen | ' + z.alt[2] + ' | ' + z.neu[2] + ' |');
  console.log('| falsche REF auf Produktfotos | ' + z.prodAlt + ' | ' + z.prodNeu + ' |');
  console.log('| Hersteller richtig | ' + z.hAlt + ' / ' + z.hSoll + ' | ' + z.hNeu + ' / ' + z.hSoll + ' |');
  console.log('\nZeit je Foto (Mittel, Rechner): ' + (z.ms / Math.max(1, fotos.length) / 1000).toFixed(1) + ' s');
  await browser.close(); await srv.stop();
}

(async () => {
  const a = process.argv.slice(2);
  if (a[0] === '--holen') return holen(a[1] || process.env.ETIKETTEN);
  const ordner = a[0] || process.env.ETIKETTEN;
  if (!ordner || !fs.existsSync(path.join(ordner, 'haus.json'))) { console.error('Erst die Fotos holen: node e2e/messen-etiketten.js --holen <ordner>'); process.exit(2); }
  return messen(ordner);
})().catch(e => { console.error(e); process.exit(1); });
