/* MESSSTAND — zehn Alltagsaufgaben in der NEUEN APP (kein Test).

   Zählt die Tipps (Klicks ohne Texteingabe) je Aufgabe am echten Bedienweg
   und stellt sie den Werten aus der Verwaltungsanalyse gegenüber (Bestand,
   gezählt am Bedienweg der alten App, und Zielwert = Abnahmekriterium).
   Jede Aufgabe prüft am Ende, dass sie wirklich erledigt ist.

   Aufruf: node e2e/messen-aufgaben.js   (NEU_BILDER=<ordner> für Fotos) */
'use strict';
const path = require('path');
const { launchBrowser, startServer } = require('./util');

function gtin(s13){ const z = s13.split('').map(Number); let s = 0; z.slice().reverse().forEach((d,i)=>{ s += d*(i%2===0?3:1); }); return s13 + ((10-(s%10))%10); }
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

const AUFGABEN = [
  { nr:1,  wort:'Neues Material mit GTIN/REF/Hersteller erfassen und in einen Standard setzen', bestand:'≈ 12, 2 Masken, 4 Bildschirme', ziel:6 },
  { nr:2,  wort:'Vorhandenes Material in einen Standard setzen', bestand:'3', ziel:3 },
  { nr:3,  wort:'Material überall umbenennen', bestand:'Reichweiten-Regel über alle Zeilen', ziel:'1 Feld' },
  { nr:4,  wort:'Foto zu einem Material', bestand:'4 + Frage nach dem Bildort', ziel:3 },
  { nr:5,  wort:'Menge nur an einer Stelle ändern', bestand:'3–4 + Reichweiten-Prüfblatt', ziel:2 },
  { nr:6,  wort:'Dublette auflösen', bestand:'5 verschiedene Orte', ziel:'1 Ort' },
  { nr:7,  wort:'Neuen Wert einer Auswahl an Ort und Stelle anlegen', bestand:'nur in der Verwaltung oder gar nicht', ziel:1 },
  { nr:8,  wort:'Wiederfinden, was ich angelegt habe', bestand:'kein Ort', ziel:'Verzeichnis mit Suche' },
  { nr:9,  wort:'Neuen Standard aus einem bestehenden bauen', bestand:'4', ziel:4 },
  { nr:10, wort:'Neues Gerät anlegen (ein Eintrag je Modell)', bestand:'nur, wenn es schon in einem Standard steht', ziel:'eine Maske' },
];

(async () => {
  const srv = await startServer();
  const browser = await launchBrowser();
  const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(srv.base + '/', { waitUntil:'networkidle' });
  await p.evaluate(() => { localStorage.setItem('hkl_raumwahl', 'neuaufbau'); localStorage.setItem('raum:neuaufbau:hkl_authuntil', String(Date.now() + 3600000)); });
  await p.goto(srv.base + '/neu/', { waitUntil:'networkidle' });
  /* Ausgangslage (nicht gezählt): ein Hersteller, zwei Materialien, ein Standard. */
  const ids = await p.evaluate(g => {
    const h = naListeNeu('hersteller', 'Terumo', 'Messstand');
    const m1 = naSpeichern('material', { id:naId('m'), name:'Schleuse 6F', kategorie:'schleuse', gtin:g, ref:'RSS601', hersteller:h, merkmale:{}, fotos:[], lagerort:'Schrank 3' });
    const m2 = naSpeichern('material', { id:naId('m'), name:'Schleuse 6 F (alt)', kategorie:'schleuse', gtin:'', ref:'', hersteller:h, merkmale:{}, fotos:[] });
    const s = naStandardNeu('PCI elektiv', '', ['Materialien']);
    s.rubriken[0].abschnitte[0].positionen.push({ id:naId('p'), art:'material', ref:{ typ:'material', id:m2.id }, menge:'1' });
    naSpeichern('standard', s);
    return { h, m1:m1.id, m2:m2.id, s:s.id };
  }, gtin('0401234567890'));

  let n = 0; const tipp = async sel => { n++; await p.click(sel); };
  const erg = [];
  async function aufgabe(nr, fn, pruef){
    await p.evaluate(() => naGeh('#/standards')); n = 0;
    await fn(); const ok = await pruef();
    erg.push(Object.assign({}, AUFGABEN[nr-1], { neu:n, erledigt:!!ok }));
  }
  const editor = () => p.evaluate(id => naGeh('#/s/' + id + '/bearbeiten'), ids.s);

  await aufgabe(1, async () => {
    await editor();   /* Ausgangspunkt: der Standard im Editor */
    await tipp('[data-na="neuAnlegen"]'); await tipp('#naAuswListe >> text=Material');
    await p.fill('#naAuswQ', 'Führungsdraht 0,035'); await tipp('#naAuswListe >> text=neu anlegen');
    /* Die Kategorie wird aus dem Namen vorgeschlagen — kein Tippen mehr nötig. */
    await p.fill('input[data-f="gtin"]', gtin('0401234567111')); await p.fill('input[data-f="ref"]', 'RF-GA35');
    await tipp('[data-na="herstellerNehmen"]');   /* Vorschlag aus dem GTIN-Präfix */
    await tipp('[data-na="entwSpeichern"]');
  }, () => p.evaluate(id => naPositionen(naHole('standard', id)).some(x => x.pos.ref && (naStamm(x.pos.ref)||{}).ref === 'RF-GA35'), ids.s));

  await aufgabe(2, async () => {
    await editor();
    await tipp('[data-na="neuAnlegen"]'); await tipp('#naAuswListe >> text=Material');
    await tipp('#naAuswListe .sheet-act:has-text("Schleuse 6F")'); await tipp('#naSheet >> text=Übernehmen');
  }, () => p.evaluate(a => naVerwendungen(naStandards(), 'material', a.m1).length === 1, ids));

  await aufgabe(3, async () => {
    await tipp('.na-tab:has-text("Material")'); await tipp('.na-eintrag:has-text("Schleuse 6F")');
    await p.fill('input[data-f="name"]', 'Radialschleuse 6F'); await tipp('[data-na="entwSpeichern"]');
    if (await p.isVisible('#naSheet.show button:has-text("Überall übernehmen")')) await tipp('#naSheet.show button:has-text("Überall übernehmen")');
  }, () => p.evaluate(id => naHole('material', id).name === 'Radialschleuse 6F', ids.m1));

  await aufgabe(4, async () => {
    await tipp('.na-tab:has-text("Material")'); await tipp('.na-eintrag:has-text("Radialschleuse")');
    const fc = p.waitForEvent('filechooser'); await tipp('[data-na="fotoAuf"]');
    await (await fc).setFiles({ name:'f.png', mimeType:'image/png', buffer:Buffer.from(PNG, 'base64') });
    await p.waitForSelector('#photoEditOv'); await tipp('#peApply');   /* zuschneiden/drehen: hier nur bestätigen */
    await p.waitForSelector('.na-foto'); await tipp('[data-na="entwSpeichern"]');
    if (await p.isVisible('#naSheet.show button:has-text("Überall übernehmen")')) await tipp('#naSheet.show button:has-text("Überall übernehmen")');
  }, () => p.evaluate(id => (naHole('material', id).fotos||[]).length === 1, ids.m1));

  await aufgabe(5, async () => {
    await editor();
    await tipp('.na-pos:has-text("Radialschleuse") [data-na="posBearb"]'); await p.fill('#naPosMenge', '3'); await tipp('[data-na="posOk"]');
  }, () => p.evaluate(id => naPositionen(naHole('standard', id)).some(x => x.pos.menge === '3'), ids.s));

  await aufgabe(6, async () => {
    await tipp('.na-tab:has-text("Material")'); await tipp('.na-eintrag:has-text("(alt)")');
    await tipp('text=Dublette: zusammenführen'); await tipp('#naAuswListe .sheet-act:has-text("Radialschleuse")');
    await tipp('#naSheet button:has-text("Zusammenführen")');
  }, () => p.evaluate(a => !naHole('material', a.m2) && naVerwendungen(naStandards(), 'material', a.m1).length === 2, ids));

  await aufgabe(7, async () => {
    await tipp('.na-tab:has-text("Material")'); await tipp('.na-eintrag:has-text("Radialschleuse")');
    await tipp('button[data-f="bereich"]'); await p.fill('#naAuswQ', 'Notfallwagen'); await tipp('#naAuswListe >> text=neu anlegen');
  }, () => p.evaluate(() => naListe('bereiche').some(b => b.name === 'Notfallwagen')));
  await p.click('text=Abbrechen');

  await aufgabe(8, async () => {
    await tipp('.na-tab:has-text("Mehr")'); await tipp('text=Verlauf'); await p.fill('.na-suche', 'Notfallwagen');
  }, () => p.evaluate(() => /Notfallwagen/.test(document.getElementById('naVlListe').innerText)));

  await aufgabe(9, async () => {
    await tipp('.std:has-text("PCI elektiv")'); await tipp('text=✎ Bearbeiten'); await tipp('text=⧉ Kopieren');
    await p.fill('#naEingabeFeld', 'PCI akut'); await tipp('#naSheet >> text=Übernehmen');
  }, () => p.evaluate(() => naAlle('standard').some(s => s.titel === 'PCI akut' && naPositionen(s).length >= 3)));

  await aufgabe(10, async () => {
    await tipp('.na-tab:has-text("Geräte")'); await tipp('.na-plus');
    await p.fill('input[data-f="name"]', 'Defibrillator Lifepak 20'); await tipp('[data-na="entwSpeichern"]');
  }, () => p.evaluate(() => naAlle('geraet').length === 1));

  console.log('\nZehn Alltagsaufgaben — Tipps ohne Texteingabe\n');
  console.log(['Nr', 'Aufgabe', 'Bestand (Analyse)', 'Ziel', 'Neue App', 'erledigt'].join(' | '));
  erg.forEach(e => console.log([e.nr, e.wort, e.bestand, e.ziel, e.neu, e.erledigt ? 'ja' : 'NEIN'].join(' | ')));
  if (errs.length) console.log('\nSeitenfehler:', errs);
  if (process.env.NEU_MESSUNG) require('fs').writeFileSync(process.env.NEU_MESSUNG, JSON.stringify(erg, null, 1));
  await browser.close(); await srv.stop();
})().catch(e => { console.error(e); process.exit(1); });
