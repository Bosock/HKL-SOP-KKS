/* MESSSTAND — wie gut liest die Etikett-Erkennung wirklich?

   Kein Urteil über die Texterkennung ist etwas wert, wenn es auf einem
   Eindruck beruht. Diese Datei rendert synthetische Etikettfotos mit den
   typischen Störungen aus dem Labor (e2e/ocr-etiketten.js), schickt sie
   durch die ECHTE Kette (Tesseract im echten Browser unter echter CSP) und
   zählt, welche Felder richtig herauskommen.

   Gemessen wird je Etikett × Störung:
     REF        exakt gelesen (ohne Hilfe des Bestands — neue Produkte stehen
                in keinem Katalog, das ist der harte Fall)
     Hersteller, French, Länge, Materialklasse
     Zeit       Dauer der ganzen Kette

   Varianten: Über die Umgebungsvariable OCR_VARIANTEN lassen sich mehrere
   Einstellungen der Kette nebeneinander messen (siehe OCR_VERSUCH in
   public/js/features/ocr.js), z. B.
     OCR_VARIANTEN='alt,neu' node e2e/messen-ocr.js
   „fotos3" misst die Mehrfachaufnahme: drei Fotos desselben Etiketts mit
   leicht unterschiedlichem Licht/Winkel, gemeinsam ausgewertet.

   Die Datei prüft nichts und schlägt nicht fehl — sie liefert Zahlen.  */
'use strict';
const { launchBrowser, startServer, bootPage } = require('./util');
const { ETIKETTEN, STOERUNGEN, rendernImBrowser } = require('./ocr-etiketten');

const VARIANTEN = (process.env.OCR_VARIANTEN || 'neu').split(',').map(s => s.trim()).filter(Boolean);
const NUR = process.env.OCR_NUR ? process.env.OCR_NUR.split(',') : null;          /* Störungen einschränken */
const PARALLEL = Math.max(1, parseInt(process.env.OCR_PARALLEL || '3', 10));

const norm = s => String(s || '').toUpperCase().replace(/[\s]/g, '');

async function lauf(page, spec, st, variante, seed) {
  const render = rendernImBrowser.toString();
  return page.evaluate(async ({ render, spec, st, variante, seed }) => {
    const rendern = eval('(' + render + ')');
    const anzahl = variante === 'fotos3' ? 3 : 1;
    const bilder = [];
    for (let i = 0; i < anzahl; i++) {
      /* Zweites/drittes Foto: anderer Zufall (Rauschen, Winkel) und das
         Glanzlicht/der Schatten wandert — wie beim erneuten Auslösen. */
      bilder.push(rendern({ spec, stoerung: st, seed: seed + i * 7919 }));
    }
    if (typeof OCR_VERSUCH !== 'undefined') {
      OCR_VERSUCH.modus = (variante === 'fotos3') ? 'neu' : variante;
    }
    const t0 = Date.now();
    let erg;
    try {
      erg = (anzahl > 1 && typeof ocrReadLabels === 'function')
        ? await ocrReadLabels(bilder, () => {})
        : await ocrReadLabel(bilder[0], () => {});
    } catch (e) { return { fehler: String((e && e.message) || e) }; }
    const ms = Date.now() - t0;
    let klasse = '';
    try { klasse = merkSammeln(erg.text || '', (erg.fields && erg.fields.ref) || '', MERKKAT).klasse; } catch (e) {}
    return { ms, f: erg.fields || {}, klasse, roh: erg.refRoh || '', lesungen: erg.lesungen || [],
      vorschlaege: (erg.refInfo && erg.refInfo.vorschlaege) || [], sich: erg.refLeseSicherheit,
      qualitaet: erg.qualitaet || null, text: (erg.text || '').slice(0, 400) };
  }, { render, spec, st, variante, seed });
}

(async () => {
  const srv = await startServer();
  const browser = await launchBrowser();
  const seiten = [];
  for (let i = 0; i < PARALLEL; i++) seiten.push((await bootPage(browser, srv.base)).page);

  const auftraege = [];
  for (const v of VARIANTEN) for (const st of STOERUNGEN) {
    if (NUR && !NUR.includes(st.id)) continue;
    for (const spec of ETIKETTEN) auftraege.push({ v, st, spec });
  }
  const ergebnisse = [];
  let naechster = 0;
  await Promise.all(seiten.map(async page => {
    while (naechster < auftraege.length) {
      const a = auftraege[naechster++];
      const r = await lauf(page, a.spec, a.st, a.v, 1234 + a.spec.id.length * 31);
      const w = a.spec.wahr;
      const tr = r.fehler ? {} : {
        ref: norm(r.f.ref) === norm(w.ref),
        hersteller: (r.f.hersteller || '').toLowerCase() === w.hersteller.toLowerCase(),
        french: (r.f.french || '') === w.french,
        laenge: (r.f.laenge || '') === w.laenge,
        klasse: r.klasse === w.klasse,
      };
      /* REF dreiwertig: richtig · leer (Feld bleibt frei — erlaubt) · FALSCH
         (falscher Wert im Feld — genau das darf nicht passieren). */
      tr.refFalsch = !r.fehler && !!(r.f.ref) && !tr.ref;
      tr.refVorschlag = !r.fehler && !r.f.ref && (r.vorschlaege || []).some(v => norm(v) === norm(w.ref));
      ergebnisse.push({ ...a, r, tr });
      const zeichen = k => tr[k] ? '✓' : (k === 'ref' ? (tr.refFalsch ? '✗FALSCH' : (tr.refVorschlag ? '○+Vorschlag' : '○leer')) : '✗');
      console.log(`[${a.v}] ${a.st.id.padEnd(9)} ${a.spec.id.padEnd(12)} REF ${zeichen('ref')} (${(r.f && r.f.ref) || '—'} · ${r.sich == null ? '–' : r.sich})  Herst ${zeichen('hersteller')}  Fr ${zeichen('french')} (${(r.f && r.f.french) || '—'})  Länge ${zeichen('laenge')} (${(r.f && r.f.laenge) || '—'})  Klasse ${zeichen('klasse')} (${r.klasse || '—'})  ${r.ms || '?'} ms${r.fehler ? '  FEHLER ' + r.fehler : ''}`);
      if (process.env.OCR_TEXT) console.log('      ' + JSON.stringify(r.text));
    }
  }));

  /* Zusammenfassung je Variante × Störung: Trefferquote über alle Felder. */
  console.log('\n══ Zusammenfassung (richtige Felder von 5 je Etikett) ══');
  const felder = ['ref', 'hersteller', 'french', 'laenge', 'klasse'];
  for (const v of VARIANTEN) {
    let gesamt = 0, max = 0, zeit = 0, n = 0;
    const zeilen = [];
    for (const st of STOERUNGEN) {
      const es = ergebnisse.filter(e => e.v === v && e.st.id === st.id);
      if (!es.length) continue;
      const je = felder.map(k => es.filter(e => e.tr[k]).length);
      const sum = je.reduce((a, b) => a + b, 0);
      gesamt += sum; max += es.length * felder.length;
      es.forEach(e => { zeit += e.r.ms || 0; n++; });
      const falsch = es.filter(e => e.tr.refFalsch).length, vorschl = es.filter(e => e.tr.refVorschlag).length;
      zeilen.push(`  ${st.wort.padEnd(34)} ${String(sum).padStart(2)}/${es.length * felder.length}   REF ${je[0]}/${es.length} (falsch ${falsch}, Vorschlag ${vorschl})  Herst ${je[1]}/${es.length}  Fr ${je[2]}/${es.length}  Länge ${je[3]}/${es.length}  Klasse ${je[4]}/${es.length}`);
    }
    console.log(`\nVariante „${v}": ${gesamt}/${max} Felder richtig (${max ? Math.round(gesamt * 100 / max) : 0} %), Ø ${n ? Math.round(zeit / n) : 0} ms je Etikett`);
    zeilen.forEach(z => console.log(z));
  }
  await browser.close();
  await srv.stop();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(0); });
