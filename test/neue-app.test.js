'use strict';
/* Tests für die NEUE APP (public/neu, docs/NEUE-APP.md):
   · die reine Logik in public/neu/js/kern.js,
   · die Umleitung in public/js/core/store.js — sie darf NUR im Neuaufbau
     greifen; im Bestand ändert sich nichts. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const KAT = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/merkmale.json'), 'utf8'));
const KERN = fs.readFileSync(path.join(ROOT, 'public/neu/js/kern.js'), 'utf8');
const ctx = vm.createContext({ console });
vm.runInContext(KERN + `
;globalThis.__K = { naNorm, naAehnliche, naGtinPruefziffer, naGtinKey, naParseGS1, naParseScan, naMengeZahl,
  naStueckpreis, naKosten, naPositionen, naVerwendungen, naListenVerwendung, naRuestliste, naKatalog, naFelder,
  naHerstellerAusGtin, naNameVorschlag, naStandardNeu, naStandardKopie, naUnterschiede, naCsv,
  naFotos, naHauptbild, naFotosSetzen, naFotoDazu, naFotoErsetzen, naFotoOriginal, naFotoEntfernen, naFotoAendern, NA_FOTO_ROLLEN,
  NA_ARTEN_VORGABE, NA_BEREICHE_VORGABE, NA_RUBRIKEN_VORGABE,
  naKategorieVorschlag, naHerstellerKurz, naPznOk, naRegisterAnwenden, naVerknNormal, naVerknVon, naZubehoerFehlt,
  naVerknUmhaengen, naAngaben, naFehlt, naVariante, NA_VERKN_ARTEN, NA_ERSATZ_SORTEN, NA_LISTEN, naHerstellerImText,
  naMerkmalSuchtext, naFelderMaterial, naMerkmalNutzung, naMerkmalVorschlaege, naTplZuordnen, naTplStumm, naTplKategorieWie,
  NA_AUSWEGE, naPflichtFelder, naPflichtStand, naPflichtOffen, naPflichtNachtragen, naPflichtAufraeumen, naSapNorm, naSapDoppelt, naTplGlobal, naParseHIBC, naHibcPruefzeichen, naAuswegUmschalten, naSapZaehlen, naDarfPflicht, NA_FESTER_PLATZ, naKameraRang, naKameraReihenfolge, naRahmenImVideo, naMassUmrechnung, naMassArt, naMassArtVorgabe, naMassZahlen, naTplMerkmalSetzen, NA_GAUGE_MM,
  NA_MERKMAL_ARTEN, naMerkmalNutzungAlle, naMerkmalGeaendert, naMerkmalListe, naTplMerkmalSetzen, naTplMerkmalZurueck, naTplMerkmalLoeschen, naTplWert };`, ctx);
const K = ctx.__K;
const plain = v => JSON.parse(JSON.stringify(v));

function gtin(s13){ const z = s13.split('').map(Number); let s = 0; z.slice().reverse().forEach((d,i)=>{ s += d*(i%2===0?3:1); }); return s13 + ((10-(s%10))%10); }

/* ── Doppelungen ── */
test('Ähnlichkeit: gleich, ähnlich, verschieden', () => {
  const items = [{ id:'a', name:'Terumo' }, { id:'b', name:'Boston Scientific' }, { id:'c', name:'Abbott (Vascular)' }];
  assert.equal(K.naAehnliche('terumo', items)[0].grad, 'gleich');
  assert.equal(K.naAehnliche('Terumo Europe', items)[0].item.id, 'a');
  assert.equal(K.naAehnliche('Boston Scientifc', items)[0].item.id, 'b');   /* Tippfehler */
  assert.equal(K.naAehnliche('Abbott', items)[0].item.id, 'c');              /* ohne Klammer */
  assert.equal(K.naAehnliche('Medtronic', items).length, 0);
  assert.equal(K.naAehnliche('Terumo', [{ id:'x', name:'Terumo', archiviert:true }]).length, 0);
});

/* ── GTIN ── */
test('GTIN: Prüfziffer, 14-stellig, GS1 ohne Charge/Verfall', () => {
  const g = gtin('0401234567890');
  assert.equal(K.naGtinPruefziffer(g), true);
  assert.equal(K.naGtinPruefziffer(g.slice(0,13) + ((+g[13]+1)%10)), false);
  assert.equal(K.naGtinPruefziffer('abc'), false);
  assert.equal(K.naGtinKey('4012345678901'), '04012345678901');
  const s = K.naParseGS1('(01)' + g + '(17)261231(10)LOT42(240)RSS601');
  assert.deepEqual(plain(s), { gtin:g, itemRef:'RSS601' });
  assert.equal(K.naParseScan(g).kind, 'gtin');
  assert.equal(K.naParseScan('Hallo').kind, 'text');
});

/* ── Mengen und Kosten ── */
test('Menge: Unklares ist null, nie 1', () => {
  assert.equal(K.naMengeZahl('2x'), 2);
  assert.equal(K.naMengeZahl('2 Stk'), 2);
  assert.equal(K.naMengeZahl('0,5'), 0.5);
  assert.equal(K.naMengeZahl(''), null);
  assert.equal(K.naMengeZahl('1-2'), null);
  assert.equal(K.naMengeZahl('bei Bedarf'), null);
  assert.equal(K.naStueckpreis({ betrag:'120', bezugsmenge:10 }), 12);
  assert.equal(K.naStueckpreis({ betrag:'' }), null);
});
test('Kosten: Summe und benannte Lücken', () => {
  const std = K.naStandardNeu('T', '', ['Materialien']);
  const pos = std.rubriken[0].abschnitte[0].positionen;
  pos.push({ id:'p1', art:'material', ref:{ typ:'material', id:'m1' }, menge:'2x' });
  pos.push({ id:'p2', art:'material', ref:{ typ:'material', id:'m2' }, menge:'1-2' });
  pos.push({ id:'p3', art:'medikament', ref:{ typ:'medikament', id:'d1' }, menge:'1' });
  pos.push({ id:'p4', art:'geraet', ref:{ typ:'geraet', id:'g1' }, menge:'1' });
  const stamm = { m1:{ name:'A', preis:{ betrag:120, bezugsmenge:10 } }, m2:{ name:'B', preis:{ betrag:5 } }, d1:{ name:'C' } };
  const k = K.naKosten(std, r => stamm[r.id]);
  assert.equal(k.summe, 24);
  assert.equal(k.fehlend, 2);
  assert.equal(k.vollstaendig, false);
  assert.deepEqual(plain(k.posten.map(p => p.fehlt)), [null, 'menge', 'preis']);   /* Gerät zählt nicht */
});

/* ── Verwendung, Listen, Rüstliste ── */
test('Verwendungen und Listenverwendung', () => {
  const s = K.naStandardNeu('S', 'g1', ['R']); s.kennzeichen = ['k1'];
  s.rubriken[0].abschnitte[0].positionen.push({ id:'p', art:'material', ref:{ typ:'material', id:'m1' }, bereich:'tisch' });
  assert.equal(K.naVerwendungen([s], 'material', 'm1').length, 1);
  assert.equal(K.naVerwendungen([s], 'material', 'm2').length, 0);
  const d = { standards:[s], material:[{ id:'m1', hersteller:'h1', bereich:'tisch', kategorie:'schleuse' }] };
  assert.equal(K.naListenVerwendung('arten', 'material', d), 1);
  assert.equal(K.naListenVerwendung('bereiche', 'tisch', d), 2);
  assert.equal(K.naListenVerwendung('hersteller', 'h1', d), 1);
  assert.equal(K.naListenVerwendung('gruppen', 'g1', d), 1);
  assert.equal(K.naListenVerwendung('kennzeichen', 'k1', d), 1);
  assert.equal(K.naListenVerwendung('rubriken', 'R', d), 1);
  assert.equal(K.naListenVerwendung('kategorien', 'schleuse', d), 1);
});
test('Rüstliste: Bereich → Lagerort; Ansage markiert und zuletzt; Position schlägt Stammsatz', () => {
  const s = K.naStandardNeu('S', '', ['R']); const p = s.rubriken[0].abschnitte[0].positionen;
  p.push({ id:'1', ref:{ typ:'material', id:'a' }, ansage:true });
  p.push({ id:'2', ref:{ typ:'material', id:'b' } });
  p.push({ id:'3', ref:{ typ:'material', id:'c' }, bereich:'tisch' });
  p.push({ id:'4', text:'nur Text' });
  const st = { a:{ name:'A', bereich:'eingriff', lagerort:'S1' }, b:{ name:'B', bereich:'eingriff', lagerort:'S1' }, c:{ name:'C', bereich:'eingriff' } };
  const r = plain(K.naRuestliste(s, x => st[x.id], K.NA_BEREICHE_VORGABE));
  assert.deepEqual(r.map(g => g.bereich), ['tisch', 'eingriff']);
  assert.deepEqual(r[1].orte[0].posten.map(x => [x.name, x.ansage]), [['B', false], ['A', true]]);
  assert.equal(r[0].orte[0].ort, '');
});

/* ── Katalog ── */
test('Katalog-Overlay: eigene Kategorie, Feld dazu, Wert dazu; Quelle unverändert', () => {
  const vorher = JSON.stringify(KAT);
  const tpl = { klassen:{ k_x:{ neu:true, label:'Testklasse' }, schleuse:{ dazu:['m_eig'] } },
    merkmale:{ m_eig:{ label:'Eigenes', typ:'text' } }, werte:{ kurve_groesse:['XXL'] } };
  const kat = K.naKatalog(KAT, tpl);
  assert.ok(kat.klassen.some(k => k.id==='k_x' && k.eigen));
  const f = K.naFelder(kat, 'schleuse');
  assert.ok(f.weitere.concat(f.diff).some(d => d.id==='m_eig'));
  assert.ok(f.diff.length >= 3);
  assert.ok(kat.merkmale.find(m => m.id==='kurve_groesse').werte.includes('XXL'));
  assert.equal(JSON.stringify(KAT), vorher);
  assert.equal(K.naKatalog(null, tpl).klassen.length, 0);
});
test('Hersteller aus GTIN-Präfix und Namensvorschlag', () => {
  const m = [{ hersteller:'h1', gtin:gtin('0401234567890') }];
  assert.equal(K.naHerstellerAusGtin(m, gtin('0401234567111')).hersteller, 'h1');
  assert.equal(K.naHerstellerAusGtin(m, gtin('0999999999999')), null);
  const defs = [{ id:'a', einheit:'F' }, { id:'b', einheit:'cm' }];
  assert.equal(K.naNameVorschlag('Schleuse / Introducer', defs, { a:'6', b:'11' }), 'Schleuse · 6 F · 11 cm');
});

/* ── Standards ── */
test('Kopie bekommt neue Kennungen überall', () => {
  const s = K.naStandardNeu('A', '', ['R1', 'R2']);
  s.rubriken[0].abschnitte[0].positionen.push({ id:'p1', text:'x' });
  const k = K.naStandardKopie(s, 'B');
  assert.notEqual(k.id, s.id); assert.equal(k.titel, 'B'); assert.equal(k.kopieVon, s.id);
  assert.notEqual(k.rubriken[0].id, s.rubriken[0].id);
  assert.notEqual(k.rubriken[0].abschnitte[0].positionen[0].id, 'p1');
  assert.equal(s.rubriken[0].abschnitte[0].positionen[0].id, 'p1');   /* Original unverändert */
  assert.deepEqual(plain(K.naUnterschiede({ a:1, b:2, geaendert:1 }, { a:1, b:3, geaendert:2 })), ['b']);
  assert.equal(K.naCsv([['a;b', 'c"d']]), '"a;b";"c""d"');
});
test('Vorgaben: Hinweis wird nicht abgehakt; Bereiche Tisch und Eingriff', () => {
  assert.equal(K.NA_ARTEN_VORGABE.find(a => a.id==='hinweis').haken, false);
  assert.deepEqual(plain(K.NA_BEREICHE_VORGABE.map(b => b.name)), ['Tischvorbereitung', 'Eingriffsvorbereitung']);
});

/* ── Bilder ── */
test('Anzeigebild: Wahl schlägt Regel; ein Etikett wird nie von allein das Gesicht', () => {
  assert.equal(K.naHauptbild({}), null);
  /* ältere Einträge: bloße Kennungen → das erste */
  assert.equal(K.naHauptbild({ fotos:['a','b'] }).k, 'a');
  /* Etikett zuerst aufgenommen, Produkt danach → das Produktbild */
  const o = { fotos:[{ k:'e', rolle:'etikett' }, { k:'v', rolle:'verpackung' }, { k:'p', rolle:'produkt' }] };
  assert.equal(K.naHauptbild(o).k, 'p');
  /* kein Produktbild → das erste, das kein Etikett ist */
  assert.equal(K.naHauptbild({ fotos:[{ k:'e', rolle:'etikett' }, { k:'x' }] }).k, 'x');
  /* nur Etiketten → besser dieses als keines */
  assert.equal(K.naHauptbild({ fotos:[{ k:'e', rolle:'etikett' }] }).k, 'e');
  /* ausdrückliche Wahl gilt — auch für ein Etikett; ein toter Zeiger nicht */
  assert.equal(K.naHauptbild(Object.assign({ hauptbild:'e' }, o)).k, 'e');
  assert.equal(K.naHauptbild(Object.assign({ hauptbild:'weg' }, o)).k, 'p');
});
test('Bilder: anhängen, bearbeitetes ersetzt, Original zurück, entfernen', () => {
  const o = { fotos:['alt'] };
  K.naFotoDazu(o, { k:'n1', v:'n1v' }, 'produkt');
  K.naFotoDazu(o, { k:'n1', v:'n1v' }, 'produkt');                       /* dasselbe Bild nicht doppelt */
  assert.deepEqual(plain(o.fotos), [{ k:'alt' }, { k:'n1', v:'n1v', rolle:'produkt' }]);
  K.naFotoDazu(o, { k:'x' }, 'gibtsnicht');                              /* unbekannte Rolle wird nicht gespeichert */
  assert.equal(o.fotos[2].rolle, undefined);
  K.naFotoAendern(o, 'n1', { titel:'von oben' });
  o.hauptbild = 'n1';
  K.naFotoErsetzen(o, 'n1', { k:'n2', v:'n2v' });                        /* zugeschnitten */
  assert.deepEqual(plain(o.fotos[1]), { k:'n2', v:'n2v', rolle:'produkt', titel:'von oben', orig:'n1', origV:'n1v' });
  assert.equal(o.hauptbild, 'n2');                                       /* Wahl wandert mit */
  K.naFotoErsetzen(o, 'n2', { k:'n3' });                                 /* noch einmal: Original bleibt das ERSTE */
  assert.equal(o.fotos[1].orig, 'n1'); assert.equal(o.fotos[1].origV, 'n1v'); assert.equal(o.hauptbild, 'n3');
  K.naFotoOriginal(o, 'n3');
  assert.deepEqual(plain(o.fotos[1]), { k:'n1', v:'n1v', rolle:'produkt', titel:'von oben' });
  assert.equal(o.hauptbild, 'n1');
  K.naFotoErsetzen(o, 'x', { k:'alt' });                                 /* Ergebnis gibt es schon → nur das alte fällt weg */
  assert.deepEqual(plain(o.fotos.map(f => f.k)), ['alt', 'n1']);
  K.naFotoEntfernen(o, 'n1');
  assert.equal(o.hauptbild, undefined);                                  /* Zeiger zeigt nie ins Leere */
  assert.deepEqual(plain(o.fotos), [{ k:'alt' }]);
  assert.deepEqual(plain(K.NA_FOTO_ROLLEN.map(r => r.id)), ['produkt', 'etikett', 'verpackung', 'sonstiges']);
});

/* ── Umleitung in store.js: nur im Neuaufbau ── */
function storeLaden(ls, pfad){
  const umgeleitet = [];
  const lsObj = { getItem:k => (k in ls ? ls[k] : null), setItem:(k,v) => { ls[k] = String(v); }, removeItem:k => { delete ls[k]; } };
  const c = vm.createContext({ localStorage:lsObj, window:{ stop(){} }, URL,
    location:{ pathname:pfad, href:'http://h' + pfad, replace:u => umgeleitet.push(u) }, document:{} });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'public/js/core/store.js'), 'utf8'), c);
  return umgeleitet;
}
/* ── Material-Maske (Umbau 11/2026) ── */
const ZUSATZ = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/neu/daten/katalog-zusatz.json'), 'utf8'));
const KATNEU = K.naKatalog(KAT, ZUSATZ);

test('Zusatzkatalog: Verbrauchs-Kategorien kommen dazu, die Quelle bleibt unberührt', () => {
  const vorher = JSON.stringify(KAT);
  const ids = KATNEU.klassen.map(k => k.id);
  ['spritze_kanuele','infusion','naht','verband','instrument','desinfektion','schutz','op_zubehoer'].forEach(id => assert.ok(ids.includes(id), id));
  assert.equal(KATNEU.klassen.find(k => k.id === 'infusion').eigen, false);       /* mitgeliefert, nicht „eigene" */
  assert.ok(KAT.klassen.every(k => ids.includes(k.id)));
  assert.equal(JSON.stringify(KAT), vorher);
  /* Das Overlay des Hauses wirkt obendrauf weiter. */
  const mitHaus = K.naKatalog(KATNEU, { klassen:{ infusion:{ label:'Infusion (Haus)' } } });
  assert.equal(mitHaus.klassen.find(k => k.id === 'infusion').label, 'Infusion (Haus)');
});

test('Kategorie-Vorschlag: Register-Einordnung vor Wort; längstes Wort gewinnt; kurze Wörter nur ganz', () => {
  assert.deepEqual(plain(K.naKategorieVorschlag(KATNEU, { name:'irgendwas', einordnung:' A0703' })), { id:'infusion', grund:'einordnung', wort:'A0703' });
  assert.equal(K.naKategorieVorschlag(KATNEU, { name:'Dreiwegehahn' }).id, 'infusion');
  assert.equal(K.naKategorieVorschlag(KATNEU, { name:'Nadelhalter' }).id, 'instrument');          /* nicht „Nadel" */
  assert.equal(K.naKategorieVorschlag(KATNEU, { name:'OP-Kittel steril' }).id !== 'set', true);   /* „kit" steckt in „Kittel" */
  assert.equal(K.naKategorieVorschlag(KATNEU, { name:'xy' }), null);
  assert.equal(K.naKategorieVorschlag(KATNEU, { name:'Quarzuhr' }), null);
  /* Archivierte Kategorien werden nicht vorgeschlagen. */
  /* Das Haus bestimmt die Suchwörter selbst (A7): sie ersetzen die Vorgabe. */
  const eigen = K.naKatalog(KATNEU, { klassen:{ infusion:{ worte:['discofix'] }, k_eigen:{ neu:true, label:'Röntgenschutz', worte:['bleischürze'] } } });
  assert.equal(K.naKategorieVorschlag(eigen, { name:'Discofix C' }).id, 'infusion');
  assert.notEqual((K.naKategorieVorschlag(eigen, { name:'Dreiwegehahn' }) || {}).id, 'infusion');
  assert.equal(K.naKategorieVorschlag(eigen, { name:'Bleischürze groß' }).id, 'k_eigen');
  assert.equal(K.naKategorieVorschlag(K.naKatalog(KATNEU, { klassen:{ infusion:{ worte:[] } } }), { name:'x', einordnung:'A0703' }).id, 'infusion');   /* Register-Einordnung bleibt */
  const ohne = K.naKatalog(KATNEU, { klassen:{ infusion:{ archiviert:true } } });
  assert.equal(K.naKategorieVorschlag(ohne, { name:'x', einordnung:'A0703' }), null);
});

test('Hersteller-Kurzname und PZN-Prüfziffer', () => {
  assert.equal(K.naHerstellerKurz('B. Braun Melsungen AG'), 'B. Braun Melsungen');
  assert.equal(K.naHerstellerKurz('MEDTRONIC, INC.'), 'Medtronic');
  assert.equal(K.naHerstellerKurz('BOSTON SCIENTIFIC CORPORATION'), 'Boston Scientific');
  assert.equal(K.naHerstellerKurz('Vygon'), 'Vygon');
  assert.equal(K.naHerstellerKurz(''), '');
  const pzn = z7 => { const s = z7.split('').map(Number).reduce((a, d, i) => a + d * (i + 1), 0) % 11; return s === 10 ? null : z7 + s; };
  const gut = pzn('0329509'); assert.ok(gut);
  assert.equal(K.naPznOk(gut), true);
  assert.equal(K.naPznOk('PZN-' + gut), true);
  assert.equal(K.naPznOk(gut.slice(0, 7) + ((+gut[7] + 1) % 10)), false);
  assert.equal(K.naPznOk('12345'), false); assert.equal(K.naPznOk(''), false); assert.equal(K.naPznOk('abcdefgh'), false);
});

test('Hersteller im Etikett-Text: Lohnfertiger und Vertrieb zählen nicht, die Liste des Hauses gewinnt', () => {
  /* Auszüge echter OCR-Texte (B.-Braun-Spritze, Asahi-Draht), 11.11.2026 */
  const braun = 'Injekt Luer Solo\nManufacturing Site:  ALMO-Erzeugnisse\nErwin Busch GmbH, GroBe Allee 84, 34454\nB. Braun Melsungen AG\n34209 Melsungen, Germany\nBBRAUN';
  const asahi = 'ASAHI INTECC PCI Guide Wire\nEmergo Europe BV.\n& ASAHI INTECC EUROPE B.V.\nod ASAHI INTECC CO.,, LTD.\nMade in PHILIPPINES';
  const liste = [{ id:'b', name:'B. Braun Melsungen', amtlich:'B. Braun Melsungen AG' }, { id:'a', name:'Asahi Intecc', amtlich:'ASAHI INTECC CO., LTD.' }];
  assert.deepEqual(plain(K.naHerstellerImText(braun, liste)), { id:'b', name:'B. Braun Melsungen', quelle:'liste' });
  assert.equal(K.naHerstellerImText(asahi, liste).id, 'a');
  /* ohne Liste: Firmenname mit Rechtsform, nicht der Lohnfertiger */
  assert.deepEqual(plain(K.naHerstellerImText(braun, [])), { name:'B. Braun Melsungen AG', quelle:'text' });
  /* eine schlecht geschriebene Listenzeile („B|BRAUN") wird trotzdem gefunden */
  assert.equal(K.naHerstellerImText(braun, [{ id:'x', name:'B|BRAUN' }]).id, 'x');
  /* Archivierte Einträge und Wörter in Fertigungsort-Zeilen zählen nicht */
  assert.equal(K.naHerstellerImText('Manufacturing Site: Erwin Busch GmbH', [{ id:'e', name:'Erwin Busch' }]), null);
  assert.equal(K.naHerstellerImText(braun, [{ id:'b', name:'B. Braun Melsungen', archiviert:true }]).quelle, 'text');
  assert.equal(K.naHerstellerImText('', liste), null);
});

test('Merkmale suchen: Suchwörter finden „Resterilisation" — auch eigene des Hauses', () => {
  const finde = (kat, q) => kat.merkmale.filter(d => K.naMerkmalSuchtext(d).indexOf(K.naNorm(q)) >= 0).map(d => d.id);
  assert.ok(finde(KATNEU, 'Resterilisation').includes('wiederverwendungen'));
  assert.ok(finde(KATNEU, 'zyklen').includes('wiederverwendungen'));
  assert.ok(finde(KATNEU, 'french').includes('ad_fr'));
  const eigen = K.naKatalog(KATNEU, { such:{ wiederverwendungen:['autoklav'] }, merkmale:{ m_farbe:{ label:'Farbe', typ:'text' } } , klassen:{} });
  assert.ok(finde(eigen, 'autoklav').includes('wiederverwendungen'));
  assert.ok(finde(eigen, 'resterilisation').includes('wiederverwendungen'));     /* Vorgabe bleibt */
  assert.deepEqual(finde(K.naKatalog(KATNEU, { such:{ m_farbe:['colour'] }, merkmale:{ m_farbe:{ label:'Farbe', typ:'text' } } }), 'colour'), ['m_farbe']);
});

test('Merkmale zuordnen: nur dieses Material · alle der Kategorie · Kern — und zurück', () => {
  /* nicht mitgeliefertes Merkmal → Kabel, als Kern */
  let tpl = K.naTplZuordnen({}, KATNEU, 'kabel', 'aufbereitung_zyklus', 'kern');
  let kat = K.naKatalog(KATNEU, tpl); let f = K.naFelder(kat, 'kabel');
  assert.ok(f.diff.some(d => d.id === 'aufbereitung_zyklus'));
  assert.ok(f.diff.some(d => d.id === 'pin_zahl'));                            /* vorhandene Kern-Merkmale bleiben */
  /* zurückstufen: bleibt in der Kategorie, nicht mehr Kern */
  tpl = K.naTplZuordnen(tpl, KATNEU, 'kabel', 'aufbereitung_zyklus', 'weiter');
  f = K.naFelder(K.naKatalog(KATNEU, tpl), 'kabel');
  assert.ok(!f.diff.some(d => d.id === 'aufbereitung_zyklus') && f.weitere.some(d => d.id === 'aufbereitung_zyklus'));
  /* mitgeliefertes Merkmal entfernen und wieder aufnehmen */
  tpl = K.naTplZuordnen(tpl, KATNEU, 'kabel', 'kabel_laenge_cm', 'aus');
  f = K.naFelder(K.naKatalog(KATNEU, tpl), 'kabel');
  assert.ok(!f.diff.concat(f.weitere).some(d => d.id === 'kabel_laenge_cm'));
  tpl = K.naTplZuordnen(tpl, KATNEU, 'kabel', 'kabel_laenge_cm', 'weiter');
  f = K.naFelder(K.naKatalog(KATNEU, tpl), 'kabel');
  assert.ok(f.weitere.some(d => d.id === 'kabel_laenge_cm'));
  assert.equal(JSON.stringify(tpl.klassen.kabel.aus || []), '[]');
  /* das alte Overlay bleibt unverändert (neues Objekt) */
  const vorher = {}; K.naTplZuordnen(vorher, KATNEU, 'kabel', 'aufbereitung_zyklus', 'kern'); assert.deepEqual(plain(vorher), {});
});

test('Am Material: Merkmale außerhalb der Kategorie bleiben sichtbar („nur bei diesem Material")', () => {
  const o = { kategorie:'kabel', merkmale:{ pin_zahl:'10', aufbereitung_zyklus:'3 von 10', kurvenform:'' } };
  const f = K.naFelderMaterial(KATNEU, o, ['ballon_mm']);
  assert.deepEqual(plain(f.einzel.map(d => d.id)).sort(), ['aufbereitung_zyklus', 'ballon_mm']);
  assert.ok(!f.allgemein.some(d => d.id === 'aufbereitung_zyklus'));            /* nicht doppelt */
  assert.ok(f.diff.some(d => d.id === 'pin_zahl'));
  assert.deepEqual(plain(K.naFelderMaterial(KATNEU, { merkmale:{} }).einzel), []);
});

test('Die App lernt — als Vorschlag: ab 3 Materialien, bei mindestens der Hälfte ausgefüllt', () => {
  const m = (z, extra) => Object.assign({ kategorie:'kabel', merkmale: z }, extra || {});
  const zwei = [m({ aufbereitung_zyklus:'1' }), m({ aufbereitung_zyklus:'2' })];
  assert.deepEqual(plain(K.naMerkmalVorschlaege(KATNEU, zwei, 'kabel')), []);              /* zu wenige */
  const vier = zwei.concat([m({}), m({ aufbereitung_zyklus:'4' }), m({ aufbereitung_zyklus:'9' }, { archiviert:true }), m({ aufbereitung_zyklus:'1' }, { kategorie:'ballon' })]);
  assert.deepEqual(plain(K.naMerkmalNutzung(vier, 'kabel')), { n:4, zahl:{ aufbereitung_zyklus:3 } });
  assert.deepEqual(plain(K.naMerkmalVorschlaege(KATNEU, vier, 'kabel').map(v => [v.id, v.zahl, v.n])), [['aufbereitung_zyklus', 3, 4]]);
  /* abgestellt, ausgeschlossen oder schon zugeordnet → kein Vorschlag */
  assert.deepEqual(plain(K.naMerkmalVorschlaege(K.naKatalog(KATNEU, K.naTplStumm({}, 'kabel', 'aufbereitung_zyklus')), vier, 'kabel')), []);
  assert.deepEqual(plain(K.naMerkmalVorschlaege(KATNEU, vier, 'kabel', ['aufbereitung_zyklus'])), []);
  assert.deepEqual(plain(K.naMerkmalVorschlaege(K.naKatalog(KATNEU, K.naTplZuordnen({}, KATNEU, 'kabel', 'aufbereitung_zyklus', 'weiter')), vier, 'kabel')), []);
  /* nur eins von dreien → zu selten */
  assert.deepEqual(plain(K.naMerkmalVorschlaege(KATNEU, [m({ aufbereitung_zyklus:'1' }), m({}), m({})], 'kabel')), []);
});

test('Neue Kategorie mit den Merkmalen einer anderen („EPU-Kabel" wie „Kabel") — Kopie, keine Vererbung', () => {
  let tpl = { klassen:{ k_epu:{ neu:true, label:'EPU-Kabel', diff:[] } } };
  tpl = K.naTplKategorieWie(tpl, KATNEU, 'k_epu', 'kabel');
  const kat = K.naKatalog(KATNEU, tpl); const f = K.naFelder(kat, 'k_epu'); const fk = K.naFelder(kat, 'kabel');
  assert.deepEqual(plain(f.diff.map(d => d.id)), plain(fk.diff.map(d => d.id)));
  assert.deepEqual(plain(f.weitere.map(d => d.id)).sort(), plain(fk.weitere.map(d => d.id)).sort());
  assert.equal(tpl.klassen.k_epu.wie, 'kabel');
  /* danach unabhängig: ein Merkmal nur für EPU-Kabel ändert Kabel nicht */
  const t2 = K.naTplZuordnen(tpl, KATNEU, 'k_epu', 'aufbereitung_zyklus', 'kern');
  assert.ok(!K.naFelder(K.naKatalog(KATNEU, t2), 'kabel').diff.concat(K.naFelder(K.naKatalog(KATNEU, t2), 'kabel').weitere).some(d => d.id === 'aufbereitung_zyklus'));
});

test('Kategorie-Vorschlag: der Name im Haus schlägt den Text des Registers', () => {
  /* Befund 12.11.2026: ein Verbindungskabel landete wegen des Registertexts bei „Ablationskatheter" */
  assert.equal(K.naKategorieVorschlag(KATNEU, { name:'Blazer Verbindungskabel grau', bezeichnung:'Ablation catheter with tip electrode' }).id, 'kabel');
  assert.equal(K.naKategorieVorschlag(KATNEU, { name:'Blazer', handelsname:'Blazer™', bezeichnung:'Steerable ablation catheter' }) && true, true);
});

test('Registertreffer: füllt nur Leeres, merkt Quelle — und nichts ist „bestätigt"', () => {
  const t = { quelle:'EUDAMED', hersteller:{ name:'B. Braun Melsungen AG', srn:'DE-MF-000000201' }, handelsname:'Discofix® C', bezeichnung:'Stopcocks', ref:'16494C',
    steril:true, latex:false, mehrweg:false, einordnung:'A0703', basisUdi:'4039', abgerufen:'2026-11-10T10:00:00.000Z' };
  const o = { id:'m1', name:'Hahn', ref:'', merkmale:{} };
  assert.deepEqual(plain(K.naRegisterAnwenden(o, t)), ['Handelsname','REF','steril','latexfrei','Einmalprodukt']);
  assert.equal(o.handelsname, 'Discofix® C'); assert.equal(o.ref, '16494C');
  assert.deepEqual(plain(o.merkmale), { steril:'steril', latex:'latexfrei', einmalgebrauch:true });
  assert.equal(o.register.quelle, 'EUDAMED'); assert.equal(o.register.srn, 'DE-MF-000000201'); assert.equal(o.register.bestaetigt, undefined);
  assert.equal(o.name, 'Hahn');                               /* der Name im Haus gehört dem Haus */
  /* Der Mensch schlägt das Register: Vorhandenes bleibt. */
  const p = { id:'m2', ref:'EIGENE', handelsname:'Meins', merkmale:{ steril:'unsteril' } };
  assert.deepEqual(plain(K.naRegisterAnwenden(p, t)), ['latexfrei','Einmalprodukt']);
  assert.equal(p.ref, 'EIGENE'); assert.equal(p.merkmale.steril, 'unsteril');
  /* Unbekannt bleibt leer (Grundsatz ①). */
  const q = { id:'m3', merkmale:{} };
  K.naRegisterAnwenden(q, { quelle:'GUDID', steril:null, latex:null, mehrweg:null });
  assert.deepEqual(plain(q.merkmale), {});
  assert.deepEqual(plain(K.naRegisterAnwenden(null, t)), []);
});

test('Verknüpfungen: bereinigen, beide Richtungen lesen, Zubehör, umhängen', () => {
  assert.deepEqual(plain(K.NA_VERKN_ARTEN.map(a => a.id)), ['ersatz','zubehoer','aufbereitung']);
  assert.deepEqual(plain(K.NA_ERSATZ_SORTEN.map(a => a.id)), ['gleich','teuer','bedingt','reserve']);
  const roh = [{ art:'ersatz', ziel:'b', sorte:'teuer', grund:'  nur bei Engpass ' }, { art:'ersatz', ziel:'b' }, { art:'ersatz', ziel:'a' }, { art:'quatsch', ziel:'c' },
    { art:'zubehoer', ziel:'c', sorte:'gleich' }, null, { art:'zubehoer' }];
  assert.deepEqual(plain(K.naVerknNormal(roh, 'a')), [{ art:'ersatz', ziel:'b', sorte:'teuer', grund:'nur bei Engpass' }, { art:'zubehoer', ziel:'c' }]);
  assert.deepEqual(plain(K.naVerknNormal(undefined, 'a')), []);
  const alle = [{ id:'a', name:'A', verknuepfungen:roh }, { id:'b', name:'B' }, { id:'c', name:'C', verknuepfungen:[{ art:'aufbereitung', ziel:'a' }, { art:'ersatz', ziel:'weg' }] }];
  const va = K.naVerknVon(alle, 'a');
  assert.deepEqual(plain(va.raus.map(v => v.art + '>' + v.o.id)), ['ersatz>b','zubehoer>c']);
  assert.deepEqual(plain(va.rein.map(v => v.art + '<' + v.o.id)), ['aufbereitung<c']);
  assert.deepEqual(plain(K.naVerknVon(alle, 'c').raus.map(v => v.ziel)), ['a']);          /* Ziel „weg" gibt es nicht → fällt heraus */
  assert.deepEqual(plain(K.naVerknVon(alle, 'b').rein.map(v => v.o.id + ':' + v.sorte)), ['a:teuer']);
  assert.deepEqual(plain(K.naZubehoerFehlt(alle, 'a', ['b'])), ['c']);
  assert.deepEqual(plain(K.naZubehoerFehlt(alle, 'a', ['c'])), []);
  /* Dublette b → d: Verknüpfung zeigt auf den Verbleibenden; auf sich selbst nie. */
  const a = plain(alle[0]);
  assert.equal(K.naVerknUmhaengen(a, 'b', 'd'), true);
  assert.deepEqual(plain(a.verknuepfungen.map(v => v.ziel)), ['d','c']);
  assert.equal(K.naVerknUmhaengen(a, 'x', 'y'), false);
  const selbst = { id:'d', verknuepfungen:[{ art:'ersatz', ziel:'b' }] };
  assert.equal(K.naVerknUmhaengen(selbst, 'b', 'd'), true); assert.equal(selbst.verknuepfungen, undefined);
});

test('Vollständigkeit: GTIN, Hersteller, REF, Lagerort, Produktbild, Kategorie; „gibt es nicht" ist eine Antwort, „unbekannt" nicht', () => {
  assert.deepEqual(plain(K.naFehlt({ id:'m', name:'X' }, KATNEU)), ['GTIN','Hersteller','REF','Lagerort','Produktbild','Kategorie']);
  const o = { id:'m', name:'X', gtin:'04022495787309', hersteller:'h1', ref:'R1', lagerort:'l1', kategorie:'infusion', fotos:[{ k:'e', rolle:'etikett' }] };
  assert.deepEqual(plain(K.naFehlt(o, KATNEU)), ['Produktbild']);
  o.fotos.push({ k:'p', rolle:'produkt' });
  assert.deepEqual(plain(K.naFehlt(o, KATNEU)), []);
  assert.equal(K.naAngaben(o, KATNEU).filter(a => a.kern).length, 6);
  assert.equal(K.naAngaben(o, KATNEU).find(a => a.id === 'verknuepft').da, false);
  assert.equal(K.naAngaben(o, KATNEU).find(a => a.id === 'sap').kern, false);                 /* SAP-Nummer: freiwillig */
  assert.deepEqual(plain(K.naFehlt({ id:'m', gtin:'04022495787309', ref:'R', hersteller:'h', lagerort:'l', kategorie:'k', fotos:['alt'] }, KATNEU)), []);   /* alte Bildform zählt */
  const ohne = { id:'m', hersteller:'h', lagerort:'l', kategorie:'k', fotos:['alt'], pflicht:{ gtin:'gibtsnicht', ref:'unbekannt' } };
  assert.deepEqual(plain(K.naFehlt(ohne, KATNEU)), ['REF']);
});

test('Pflichtangaben: GTIN, Hersteller, REF — eintragen oder „gibt es nicht", „unbekannt", „nachtragen"', () => {
  assert.deepEqual(plain(K.NA_AUSWEGE.map(a => a.wort)), ['gibt es nicht', 'unbekannt', 'nachtragen']);
  const kat = K.naKatalog(KAT, {});
  assert.deepEqual(plain(K.naPflichtOffen({ id:'m' }, kat)), ['GTIN', 'Hersteller', 'REF']);
  const o = { id:'m', gtin:'04022495787309', pflicht:{ hersteller:'nachtragen', ref:'unbekannt', gtin:'gibtsnicht' } };
  const st = plain(K.naPflichtStand(o, kat));
  assert.deepEqual(st.map(x => x.id + ':' + (x.wert || x.ausweg)), ['gtin:04022495787309', 'hersteller:nachtragen', 'ref:unbekannt']);
  assert.deepEqual(plain(K.naPflichtOffen(o, kat)), []);
  assert.deepEqual(plain(K.naPflichtNachtragen(o, kat)), ['Hersteller']);
  assert.deepEqual(plain(K.naPflichtStand({ pflicht:{ ref:'quatsch' } }, kat).find(x => x.id === 'ref')), { id:'ref', wort:'REF', art:'fest', wert:'', ausweg:'', beantwortet:false });
  K.naPflichtAufraeumen(o, kat);                                            /* wo ein Wert steht, gilt kein Ausweg */
  assert.deepEqual(plain(o.pflicht), { hersteller:'nachtragen', ref:'unbekannt' });
  const leer = { pflicht:{ gtin:'gibtsnicht' }, gtin:'4006' }; K.naPflichtAufraeumen(leer, kat); assert.equal(leer.pflicht, undefined);
  /* ein Feld der Verwaltung für alle Produkte — als Pflicht */
  let tpl = K.naTplGlobal({}, 'herkunftsland', 'pflicht');
  const kg = K.naKatalog(KAT, tpl);
  assert.ok(kg.global.length === 1 && kg.global[0].pflicht);
  assert.deepEqual(plain(K.naPflichtOffen({ gtin:'1', hersteller:'h', ref:'r' }, kg)).length, 1);
  assert.deepEqual(plain(K.naPflichtOffen({ gtin:'1', hersteller:'h', ref:'r', pflicht:{ herkunftsland:'unbekannt' } }, kg)), []);
  tpl = K.naTplGlobal(tpl, 'herkunftsland', 'freiwillig'); assert.equal(K.naKatalog(KAT, tpl).global[0].pflicht, false);
  assert.equal(K.naTplGlobal(tpl, 'herkunftsland', 'aus').global, undefined);
  assert.deepEqual(plain(K.naKatalog(KAT, { global:[{ mid:'gibt_es_nicht', pflicht:true }] }).global), []);   /* unbekannte Felder fallen weg */
});

test('SAP-Nummer: führende Nullen und Leerzeichen zählen nicht; doppelte werden gefunden', () => {
  assert.equal(K.naSapNorm(' 000000000000123456 '), '123456'); assert.equal(K.naSapNorm('12 34'), '1234'); assert.equal(K.naSapNorm('ab-12'), 'AB-12'); assert.equal(K.naSapNorm(''), '');
  const m = [{ id:'a', sap:'123456' }, { id:'b', sap:'000123456' }, { id:'c', sap:'999' }, { id:'d' }];
  assert.deepEqual(plain(K.naSapDoppelt(m, '0123456', 'a').map(x => x.id)), ['b']);
  assert.deepEqual(plain(K.naSapDoppelt(m, '', 'x')), []);
});

test('HIBC-Code: REF aus dem Code, Prüfzeichen geprüft; GS1 gewinnt', () => {
  const mit = r => r + K.naHibcPruefzeichen(r);
  const code = mit('+A123BJC5D6E71');
  assert.deepEqual(plain(K.naParseHIBC(code)), { lic:'A123', ref:'BJC5D6E7', einheit:'1' });
  assert.deepEqual(plain(K.naParseScan(code)), { kind:'hibc', gtin:'', itemRef:'BJC5D6E7', lic:'A123' });
  assert.equal(K.naParseHIBC(code.slice(0, -1) + (code.slice(-1) === 'A' ? 'B' : 'A')), null);           /* falsches Prüfzeichen */
  const verkettet = mit('+H629REF4401/$$3271231LOT77');                                                 /* mit Verfall und Charge */
  assert.deepEqual(plain(K.naParseHIBC(verkettet)), { lic:'H629', ref:'REF440', einheit:'1' });
  assert.equal(K.naParseHIBC('*' + code + '*').ref, 'BJC5D6E7');                                         /* Start-/Stoppzeichen eines Code-39-Lesers */
  assert.equal(K.naParseHIBC(mit('+$$3271231LOT77')), null);                                              /* nur Sekundärdaten */
  assert.equal(K.naParseScan('(01)04022495787309(240)REF-77').kind, 'gs1');
});

test('Durchsicht 18.11.: Leerzeichen als HIBC-Prüfzeichen, Katalog ohne Quelle, Ja/Nein und feste Felder nie Pflicht', () => {
  /* Ein gültiger HIBC, dessen Prüfzeichen ein Leerzeichen ist (Wert 38) */
  const ZZ = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'; let rumpf = '';
  for (const a of ZZ) for (const c of ZZ) { const r = '+A123' + a + c + '1'; if (!rumpf && K.naHibcPruefzeichen(r) === ' ') rumpf = r; }
  assert.ok(rumpf, 'Probe gefunden');
  assert.equal(K.naParseHIBC(rumpf + ' ').ref, rumpf.slice(5, -1));
  assert.equal(K.naParseHIBC(rumpf + ' \r\n').ref, rumpf.slice(5, -1));                           /* Zeilenende des Handscanners */
  assert.equal(K.naParseScan(rumpf + ' ').kind, 'hibc');
  /* Ohne Katalog (offline) hat der Katalog trotzdem „global" — die Maske stürzt nicht */
  assert.deepEqual(plain(K.naKatalog(null, {}).global), []);
  /* Ja/Nein und Felder mit festem Platz: nie Pflicht bzw. nie global */
  const kat = K.naKatalog(KAT, { global:[{ mid:'dehp', pflicht:true }, { mid:'steril', pflicht:true }, { mid:'herkunftsland', pflicht:true }, { mid:'herkunftsland', pflicht:false }] });
  const dehp = kat.merkmale.find(d => d.id === 'dehp');
  if (dehp) { assert.equal(dehp.typ, 'ja_nein'); assert.deepEqual(plain(kat.global.find(g => g.mid === 'dehp')), { mid:'dehp', pflicht:false }); assert.equal(K.naDarfPflicht(dehp), false); }
  assert.equal(kat.global.some(g => g.mid === 'steril'), false);
  assert.deepEqual(plain(kat.global.filter(g => g.mid === 'herkunftsland')), [{ mid:'herkunftsland', pflicht:true }]);   /* doppelt → einmal */
  assert.ok(K.NA_FESTER_PLATZ.indexOf('stueck_packung') >= 0);
  /* Ausweg umschalten; SAP zählen */
  const o = {}; K.naAuswegUmschalten(o, 'ref', 'unbekannt'); assert.deepEqual(plain(o.pflicht), { ref:'unbekannt' });
  K.naAuswegUmschalten(o, 'ref', 'unbekannt'); assert.equal('pflicht' in o, false);
  const z = K.naSapZaehlen([{ sap:'000123' }, { sap:'123' }, { sap:'9' }, {}]);
  assert.equal(z.get('123'), 2); assert.equal(z.get('9'), 1); assert.equal(z.size, 2);
});

test('Maße umrechnen: Durchmesser mm · Zoll · French, Gauge als Außen-Ø, Länge mm → cm', () => {
  const def = id => KAT.merkmale.find(d => d.id === id);
  const u = (id, v) => K.naMassUmrechnung(def(id), v);
  /* Durchmesser — die üblichen Größen */
  assert.equal(u('draht_in', '0,035'), '0,89 mm · 2,7 F');
  assert.equal(u('draht_max_in', '.038'), '0,97 mm · 2,9 F');
  assert.equal(u('draht_in', '0,014'), '0,36 mm · 1,1 F');
  assert.equal(u('schleuse_fr', '9'), '3 mm · 0,118″');
  assert.equal(u('ad_fr', '6'), '2 mm · 0,079″');
  assert.equal(u('id_mm', '1,4'), '0,055″ · 4,2 F');                 /* Innen-Ø: nicht aufgerundet (5 F passte nicht) */
  assert.equal(u('nadel_g', '18'), '1,27 mm · 0,050″ · 3,8 F (Außen-Ø)');
  assert.equal(u('nadel_g', '17,5'), '');                             /* Gauge gibt es nur ganzzahlig */
  assert.equal(u('ad_fr', '5–6'), '1,67–2 mm · 0,066–0,079″');        /* Bereich */
  assert.equal(u('draht_in', '0,89 mm'), '0,035″ · 2,7 F');           /* Einheit im Wert gewinnt */
  /* Länge: nur mm → cm */
  assert.equal(u('nadel_laenge_mm', '980'), '98 cm');
  assert.equal(u('spitze_mm', '8'), '0,8 cm');
  assert.equal(u('nutzlaenge_cm', '110'), '');
  /* nicht umrechnen: Ballon-, Stent-, Implantatgröße; andere Einheiten */
  ['ballon_mm', 'stent_mm', 'implantat_mm', 'np_atm', 'volumen_ml'].forEach(id => assert.equal(u(id, '3'), '', id));
  assert.equal(u('draht_in', ''), ''); assert.equal(u('draht_in', 'unbekannt'), '');
  /* Gauge-Tabelle: Nenn-Außendurchmesser nach ISO 9626 */
  assert.equal(K.NA_GAUGE_MM[21], 0.819); assert.equal(K.NA_GAUGE_MM[18], 1.27);
  /* eigene Merkmale: aus Einheit und Name */
  const eigen = (label, einheit) => K.naMassArtVorgabe({ id:'x', typ:'mass', label, einheit });
  assert.equal(eigen('Dilatator-Innendurchmesser', 'mm'), 'durchmesser');
  assert.equal(eigen('Katheterlänge', 'mm'), 'laenge');
  assert.equal(eigen('Elektrodenabstand', 'mm'), 'keine');
  assert.equal(eigen('Profil', 'F'), 'durchmesser');
  /* das Haus legt fest — und holt die Vorgabe zurück */
  let tpl = K.naTplMerkmalSetzen({}, KAT, 'kurvenradius_mm', 'mass', 'laenge');
  assert.equal(tpl.merkmale.kurvenradius_mm.mass, 'laenge');
  assert.equal(K.naMassArt(K.naKatalog(KAT, tpl).merkmale.find(d => d.id === 'kurvenradius_mm')), 'laenge');
  assert.equal(K.naMassUmrechnung(K.naKatalog(KAT, tpl).merkmale.find(d => d.id === 'kurvenradius_mm'), '50'), '5 cm');
  tpl = K.naTplMerkmalSetzen(tpl, KAT, 'kurvenradius_mm', 'mass', 'keine');
  assert.equal(tpl.merkmale && tpl.merkmale.kurvenradius_mm, undefined);   /* gleich der Vorgabe → keine Abweichung */
});

test('Kamera zum Barcode-Lesen: virtuelle iPhone-Kamera, Android-Hauptkamera; nie die Frontkamera', () => {
  const ids = l => plain(K.naKameraReihenfolge(l)).map(k => k.id);
  /* iPhone (englisch und deutsch benannt) */
  assert.deepEqual(ids([{ id:'f', label:'Front Camera' }, { id:'w', label:'Back Camera' }, { id:'u', label:'Back Ultra Wide Camera' }, { id:'t', label:'Back Telephoto Camera' },
    { id:'d', label:'Back Dual Camera' }, { id:'dw', label:'Back Dual Wide Camera' }, { id:'tr', label:'Back Triple Camera' }]), ['tr', 'dw', 'd', 'w', 'u', 't']);
  assert.deepEqual(ids([{ id:'v', label:'Frontkamera' }, { id:'r', label:'Rückkamera' }, { id:'ru', label:'Rückseitige Ultraweitwinkelkamera' }, { id:'rd', label:'Rückseitige Dual-Weitwinkel-Kamera' }]), ['rd', 'r', 'ru']);
  /* Android: die Hauptkamera hat die kleinste Nummer; Tiefen- und Makrokamera hinten */
  assert.deepEqual(ids([{ id:'1', label:'camera2 1, facing front' }, { id:'2', label:'camera2 2, facing back' }, { id:'0', label:'camera2 0, facing back' },
    { id:'3', label:'camera2 3, facing back (depth)' }]), ['0', '2', '3']);
  assert.ok(K.naKameraRang('Back Macro Camera') < K.naKameraRang('Back Camera'));
  /* ohne Namen (vor der Freigabe): Reihenfolge bleibt, nichts fällt weg */
  assert.deepEqual(ids([{ id:'a', label:'' }, { id:'b', label:'' }]), ['a', 'b']);
  assert.deepEqual(ids([{ id:'', label:'Back Camera' }]), []);
});

test('Zielrahmen im Videobild: Video füllt die Fläche („cover"), Rahmen in Pixeln des Videos', () => {
  const R = { l:0.08, r:0.92, o:0.26, u:0.74 };
  /* Hochkant-Video in Hochkant-Fläche (Handy): ganze Breite, mittlerer Streifen */
  const a = plain(K.naRahmenImVideo(1080, 1920, 390, 640, R));
  assert.equal(a.x, 0); assert.equal(a.w, 1080); assert.ok(a.y > 300 && a.y < 500 && a.h > 1000 && a.h < 1250, JSON.stringify(a));
  /* Quer-Video in Hochkant-Fläche: links und rechts abgeschnitten → Rahmen nur in der Mitte */
  const b = plain(K.naRahmenImVideo(1920, 1080, 390, 640, R));
  assert.ok(b.x > 500 && b.x + b.w < 1420 && b.y >= 0 && b.h <= 1080, JSON.stringify(b));
  /* ohne Maße: das ganze Bild */
  assert.deepEqual(plain(K.naRahmenImVideo(1920, 1080, 0, 0, R)), { x:0, y:0, w:1920, h:1080 });
});

test('Variante: Familie bleibt, Nummern/Bilder/Verknüpfungen nicht; Lagerorte sind eine Liste', () => {
  const o = { id:'m1', name:'Schleuse 6F', kategorie:'schleuse', hersteller:'h1', lagerort:'l1', bereich:'b1', gtin:'04022495787309', ref:'R6', pzn:'1', merkmale:{ french:'6' },
    fotos:[{ k:'x' }], hauptbild:'x', register:{ quelle:'EUDAMED' }, verknuepfungen:[{ art:'ersatz', ziel:'m2' }], angelegt:'a', geaendert:'g', archiviert:true, preis:{ betrag:'10', bezugsmenge:1 } };
  const v = K.naVariante(o);
  assert.notEqual(v.id, 'm1'); assert.equal(v.varianteVon, 'm1');
  assert.deepEqual([v.name, v.kategorie, v.hersteller, v.lagerort, v.bereich, v.merkmale.french, v.preis.betrag], ['Schleuse 6F','schleuse','h1','l1','b1','6','10']);
  assert.deepEqual([v.gtin, v.ref, v.fotos.length], ['', '', 0]);
  const mitSap = K.naVariante(Object.assign({}, o, { sap:'123', pflicht:{ gtin:'gibtsnicht', ref:'nachtragen', hersteller:'unbekannt' } }));
  assert.equal(mitSap.sap, undefined); assert.deepEqual(plain(mitSap.pflicht), { hersteller:'unbekannt' });   /* Nummern je Größe eigen */
  ['pzn','hauptbild','register','verknuepfungen','angelegt','geaendert','archiviert'].forEach(f => assert.equal(f in v, false, f));
  assert.equal(o.gtin, '04022495787309');                     /* das Original bleibt */
  assert.ok(K.NA_LISTEN.some(l => l.key === 'lagerorte'));
  const daten = { standards:[], material:[{ lagerort:'l1' }, { lagerort:'l2' }], geraete:[{ lagerort:'l1' }], medikamente:[] };
  assert.equal(K.naListenVerwendung('lagerorte', 'l1', daten), 2);
});

test('store.js: Bestand wird NIE umgeleitet', () => {
  assert.deepEqual(storeLaden({}, '/'), []);
  assert.deepEqual(storeLaden({ hkl_liveraum:'bestand' }, '/'), []);
  assert.deepEqual(storeLaden({ hkl_raumwahl:'bestand', hkl_liveraum:'neuaufbau' }, '/'), []);
});
test('store.js: Neuaufbau → /neu/, außer dort selbst oder mit hkl_neu_alt', () => {
  assert.deepEqual(storeLaden({ hkl_raumwahl:'neuaufbau' }, '/'), ['http://h/neu/']);
  assert.deepEqual(storeLaden({ hkl_liveraum:'neuaufbau' }, '/index.html'), ['http://h/neu/']);
  assert.deepEqual(storeLaden({ hkl_raumwahl:'neuaufbau' }, '/neu/'), []);
  assert.deepEqual(storeLaden({ hkl_raumwahl:'neuaufbau', hkl_neu_alt:'1' }, '/'), []);
});


/* ── Merkmale als Liste im Listen-Verzeichnis (13.11.2026) ── */
test('Merkmal-Liste: alle Merkmale mit Art, Kategorien (★), Nutzung und Stand', () => {
  const mat = [{ id:'a', kategorie:'kabel', merkmale:{ aufbereitung_zyklus:'10', kurve_groesse:'LARGE' } }, { id:'b', kategorie:'kabel', merkmale:{ aufbereitung_zyklus:'10', seitenloecher:true } },
    { id:'c', archiviert:true, merkmale:{ aufbereitung_zyklus:'5' } }, { id:'d', merkmale:{ kurve_groesse:'', seitenloecher:false } }];
  const nu = plain(K.naMerkmalNutzungAlle(mat));
  assert.deepEqual(nu.zahl, { aufbereitung_zyklus:2, kurve_groesse:1, seitenloecher:1 });          /* Archiviertes und Leeres zählt nicht */
  assert.deepEqual(nu.werte.aufbereitung_zyklus, { '10':2 }); assert.deepEqual(nu.werte.seitenloecher, { ja:1 });

  const tpl = K.naTplZuordnen({ merkmale:{ m_eig:{ label:'Steckerfarbe', typ:'liste', werte:['rot'] } } }, KAT, 'kabel', 'aufbereitung_zyklus', 'kern');
  const z = plain(K.naMerkmalListe(K.naKatalog(KAT, tpl), KAT, tpl, mat));
  assert.equal(z.length, KAT.merkmale.length + 1);                                              /* alle mitgelieferten + das eigene */
  assert.deepEqual(z.map(x=>x.label), z.map(x=>x.label).slice().sort((a,b)=>a.localeCompare(b,'de',{ sensitivity:'base' })));
  const zy = z.find(x=>x.id==='aufbereitung_zyklus');
  assert.equal(zy.zahl, 2); assert.equal(zy.allgemein, true); assert.equal(zy.eigen, false);
  assert.deepEqual(zy.kategorien.filter(k=>k.id==='kabel'), [{ id:'kabel', label:'Kabel / Verbindung', kern:true }]);
  assert.deepEqual(zy.geaendert, ['Kategorien']);                                               /* das Haus hat es einer Kategorie zugeordnet */
  const eig = z.find(x=>x.id==='m_eig');
  assert.equal(eig.eigen, true); assert.equal(eig.typ, 'liste'); assert.deepEqual(eig.geaendert, []); assert.deepEqual(eig.kategorien, []);
  const ad = z.find(x=>x.id==='ad_fr');
  assert.equal(ad.einheit, 'F'); assert.equal(ad.zahl, 0); assert.ok(ad.kategorien.length >= 5); assert.deepEqual(ad.geaendert, []);
  assert.ok(ad.such.indexOf(K.naNorm('Führungskatheter'))>=0);                                  /* über die Kategorie auffindbar */
  assert.deepEqual(Object.keys(plain(K.NA_MERKMAL_ARTEN)).sort(), ['ja_nein','liste','mass','text','zahl']);
});

test('Merkmal ändern: Name und Hinweis als Abweichung, Vorgabe zurückholen, Art und Einheit der Vorgabe bleiben', () => {
  let tpl = K.naTplMerkmalSetzen({}, KAT, 'ad_fr', 'label', 'Außen-Ø');
  assert.deepEqual(plain(tpl.merkmale), { ad_fr:{ label:'Außen-Ø' } });
  let d = K.naKatalog(KAT, tpl).merkmale.find(x=>x.id==='ad_fr');
  assert.equal(d.label, 'Außen-Ø'); assert.equal(d.vorgabeLabel, 'Außendurchmesser'); assert.equal(d.typ, 'mass'); assert.equal(d.einheit, 'F');
  assert.ok(K.naMerkmalSuchtext(d).indexOf(K.naNorm('Außendurchmesser'))>=0);                    /* unter dem alten Namen weiter zu finden */
  assert.equal(K.naKatalog(KAT, tpl).merkmale.length, KAT.merkmale.length);                      /* kein zweites Merkmal entstanden */
  tpl = K.naTplMerkmalSetzen(tpl, KAT, 'ad_fr', 'hinweis', 'außen am Schaft gemessen');
  assert.equal(K.naKatalog(KAT, tpl).merkmale.find(x=>x.id==='ad_fr').hinweis, 'außen am Schaft gemessen');
  assert.deepEqual(plain(K.naMerkmalGeaendert(tpl, 'ad_fr')), ['Name', 'Hinweis']);
  /* Art und Einheit eines mitgelieferten Merkmals lassen sich nicht überschreiben. */
  tpl = K.naTplMerkmalSetzen(K.naTplMerkmalSetzen(tpl, KAT, 'ad_fr', 'typ', 'text'), KAT, 'ad_fr', 'einheit', 'mm');
  d = K.naKatalog(KAT, tpl).merkmale.find(x=>x.id==='ad_fr'); assert.equal(d.typ, 'mass'); assert.equal(d.einheit, 'F');
  /* Den Hinweis der Vorgabe ausblenden (leer) ist eine Abweichung; derselbe Text wie die Vorgabe ist keine. */
  const mitHinweis = KAT.merkmale.find(x=>x.hinweis);
  let t2 = K.naTplMerkmalSetzen({}, KAT, mitHinweis.id, 'hinweis', '');
  assert.equal(K.naKatalog(KAT, t2).merkmale.find(x=>x.id===mitHinweis.id).hinweis, undefined);
  t2 = K.naTplMerkmalSetzen(t2, KAT, mitHinweis.id, 'hinweis', mitHinweis.hinweis);
  assert.deepEqual(plain(t2.merkmale), {});
  /* Name zurück auf die Vorgabe = keine Abweichung mehr. */
  assert.deepEqual(plain(K.naTplMerkmalSetzen(K.naTplMerkmalSetzen({}, KAT, 'ad_fr', 'label', 'X'), KAT, 'ad_fr', 'label', '').merkmale), {});
  /* Vorgabe zurückholen: Name, Hinweis, Werte, Suchwörter weg — die Kategorie-Zuordnung und „archiviert" bleiben. */
  tpl = K.naTplZuordnen(tpl, KAT, 'kabel', 'ad_fr', 'weiter'); tpl.such = { ad_fr:['dicke'] };
  tpl = K.naTplMerkmalSetzen(tpl, KAT, 'ad_fr', 'archiviert', true);
  const zur = plain(K.naTplMerkmalZurueck(tpl, 'ad_fr'));
  assert.deepEqual(zur.merkmale, { ad_fr:{ archiviert:true } }); assert.deepEqual(zur.such, {}); assert.deepEqual(zur.klassen.kabel.dazu, ['ad_fr']);
  assert.deepEqual(plain(tpl.merkmale.ad_fr), { label:'Außen-Ø', hinweis:'außen am Schaft gemessen', archiviert:true });   /* das alte Overlay bleibt unberührt */
});

test('Eigenes Merkmal: Art, Einheit, Hinweis ändern; löschen entfernt auch die Zuordnungen', () => {
  let tpl = { merkmale:{ m_len:{ label:'Kabellänge', typ:'zahl' } } };
  tpl = K.naTplMerkmalSetzen(tpl, KAT, 'm_len', 'einheit', 'cm');
  tpl = K.naTplMerkmalSetzen(tpl, KAT, 'm_len', 'hinweis', 'ohne Stecker');
  let d = K.naKatalog(KAT, tpl).merkmale.find(x=>x.id==='m_len');
  assert.equal(d.einheit, 'cm'); assert.equal(d.hinweis, 'ohne Stecker'); assert.equal(d.eigen, true);
  tpl = K.naTplMerkmalSetzen(tpl, KAT, 'm_len', 'typ', 'liste');
  assert.equal(tpl.merkmale.m_len.typ, 'liste'); assert.equal(tpl.merkmale.m_len.einheit, undefined);   /* eine Auswahl hat keine Einheit */
  assert.equal(K.naTplMerkmalSetzen(tpl, KAT, 'm_len', 'typ', 'unsinn').merkmale.m_len.typ, 'liste');
  assert.equal(K.naTplMerkmalSetzen(tpl, KAT, 'm_len', 'label', '').merkmale.m_len.label, 'Kabellänge');  /* ein eigenes Merkmal braucht einen Namen */
  assert.deepEqual(plain(K.naTplMerkmalSetzen({}, KAT, 'gibt_es_nicht', 'hinweis', 'x').merkmale), {});
  tpl = K.naTplZuordnen(tpl, KAT, 'kabel', 'm_len', 'kern'); tpl.werte = { m_len:['200'] };
  assert.ok(K.naFelder(K.naKatalog(KAT, tpl), 'kabel').diff.some(x=>x.id==='m_len'));
  const weg = plain(K.naTplMerkmalLoeschen(tpl, 'm_len'));
  assert.deepEqual(weg.merkmale, {}); assert.deepEqual(weg.werte, {});
  assert.equal((weg.klassen.kabel.dazu||[]).indexOf('m_len'), -1); assert.equal((weg.klassen.kabel.diff||[]).indexOf('m_len'), -1);
  assert.equal(K.naKatalog(KAT, weg).merkmale.some(x=>x.id==='m_len'), false);
});

test('Archiviertes Merkmal: nicht mehr in Maske, Suche und Vorschlägen — ein eingetragener Wert bleibt sichtbar', () => {
  const tpl = K.naTplMerkmalSetzen(K.naTplZuordnen({}, KAT, 'kabel', 'kurve_groesse', 'kern'), KAT, 'kurve_groesse', 'archiviert', true);
  const kat = K.naKatalog(KAT, tpl);
  assert.equal(kat.merkmale.find(x=>x.id==='kurve_groesse').archiviert, true);                 /* bleibt im Katalog: der Name wird für alte Werte gebraucht */
  const f = K.naFelder(kat, 'kabel');
  assert.equal(f.diff.concat(f.weitere, f.allgemein).some(x=>x.id==='kurve_groesse'), false);
  const fm = K.naFelderMaterial(kat, { kategorie:'kabel', merkmale:{ kurve_groesse:'LARGE' } });
  assert.deepEqual(fm.einzel.map(x=>x.id), ['kurve_groesse']);
  const mat = [1,2,3].map(i=>({ id:'x'+i, kategorie:'schleuse', merkmale:{ kurve_groesse:'LARGE' } }));
  assert.equal(K.naMerkmalVorschlaege(kat, mat, 'schleuse').some(v=>v.id==='kurve_groesse'), false);
  assert.equal(K.naMerkmalVorschlaege(K.naKatalog(KAT, {}), mat, 'schleuse').some(v=>v.id==='kurve_groesse'), true);
  /* Zurückholen: wieder da, als Kern. */
  const zur = K.naKatalog(KAT, K.naTplMerkmalSetzen(tpl, KAT, 'kurve_groesse', 'archiviert', false));
  assert.ok(K.naFelder(zur, 'kabel').diff.some(x=>x.id==='kurve_groesse'));
});

test('Auswahlwerte: anlegen, ausblenden (Vorgabe bleibt), zurückholen, umbenennen', () => {
  const vorgabe = KAT.merkmale.find(x=>x.id==='kurve_groesse').werte;
  assert.ok(vorgabe.indexOf('LARGE')>=0);
  let tpl = K.naTplWert({}, KAT, 'kurve_groesse', 'dazu', 'XXL');
  assert.deepEqual(plain(tpl.werte), { kurve_groesse:['XXL'] });
  assert.deepEqual(plain(K.naTplWert(tpl, KAT, 'kurve_groesse', 'dazu', 'LARGE').werte), { kurve_groesse:['XXL'] });   /* gibt es schon: nichts doppelt */
  tpl = K.naTplWert(tpl, KAT, 'kurve_groesse', 'weg', 'LARGE');
  assert.deepEqual(plain(tpl.werteAus), { kurve_groesse:['LARGE'] });
  let w = K.naKatalog(KAT, tpl).merkmale.find(x=>x.id==='kurve_groesse').werte;
  assert.equal(w.indexOf('LARGE'), -1); assert.ok(w.indexOf('XXL')>=0); assert.equal(w.length, vorgabe.length);
  assert.deepEqual(plain(K.naMerkmalGeaendert(tpl, 'kurve_groesse')), ['Werte']);
  tpl = K.naTplWert(tpl, KAT, 'kurve_groesse', 'zurueck', 'LARGE');
  assert.equal(tpl.werteAus, undefined);
  /* Umbenennen eines eigenen Werts ersetzt ihn; eines Werts der Vorgabe: ausblenden + neuer Wert. */
  tpl = K.naTplWert(tpl, KAT, 'kurve_groesse', 'um', 'XXL', 'SEHR GROSS');
  assert.deepEqual(plain(tpl.werte), { kurve_groesse:['SEHR GROSS'] });
  tpl = K.naTplWert(tpl, KAT, 'kurve_groesse', 'um', 'SMALL', 'KLEIN');
  assert.deepEqual(plain(tpl.werteAus), { kurve_groesse:['SMALL'] }); assert.deepEqual(plain(tpl.werte.kurve_groesse), ['SEHR GROSS', 'KLEIN']);
  assert.deepEqual(plain(K.naTplWert(tpl, KAT, 'kurve_groesse', 'um', 'KLEIN', ' ').werte.kurve_groesse), ['SEHR GROSS', 'KLEIN']);   /* leerer neuer Name: nichts */
  /* Eigenes Merkmal: Werte aus der Anlage und später angelegte; entfernen wirkt auf beide. */
  let e = { merkmale:{ m_f:{ label:'Farbe', typ:'liste', werte:['rot', 'blau'] } }, werte:{ m_f:['grün'] } };
  assert.deepEqual(plain(K.naKatalog(KAT, e).merkmale.find(x=>x.id==='m_f').werte), ['rot', 'blau', 'grün']);
  e = K.naTplWert(K.naTplWert(e, KAT, 'm_f', 'weg', 'rot'), KAT, 'm_f', 'weg', 'grün');
  assert.deepEqual(plain(K.naKatalog(KAT, e).merkmale.find(x=>x.id==='m_f').werte), ['blau']);
  assert.equal(e.werteAus, undefined);
});
