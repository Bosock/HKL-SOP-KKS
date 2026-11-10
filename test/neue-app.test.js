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
  naVerknUmhaengen, naAngaben, naFehlt, naVariante, NA_VERKN_ARTEN, NA_ERSATZ_SORTEN, NA_LISTEN };`, ctx);
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

test('Vollständigkeit: fünf Kern-Angaben; ein Etikettfoto ist kein Produktbild', () => {
  assert.deepEqual(plain(K.naFehlt({ id:'m', name:'X' }, KATNEU)), ['Hersteller','GTIN oder REF','Lagerort','Produktbild','Kategorie']);
  const o = { id:'m', name:'X', hersteller:'h1', ref:'R1', lagerort:'l1', kategorie:'infusion', fotos:[{ k:'e', rolle:'etikett' }] };
  assert.deepEqual(plain(K.naFehlt(o, KATNEU)), ['Produktbild']);
  o.fotos.push({ k:'p', rolle:'produkt' });
  assert.deepEqual(plain(K.naFehlt(o, KATNEU)), []);
  assert.equal(K.naAngaben(o, KATNEU).filter(a => a.kern).length, 5);
  assert.equal(K.naAngaben(o, KATNEU).find(a => a.id === 'verknuepft').da, false);
  assert.deepEqual(plain(K.naFehlt({ id:'m', gtin:'04022495787309', hersteller:'h', lagerort:'l', kategorie:'k', fotos:['alt'] }, KATNEU)), []);   /* alte Bildform zählt */
});

test('Variante: Familie bleibt, Nummern/Bilder/Verknüpfungen nicht; Lagerorte sind eine Liste', () => {
  const o = { id:'m1', name:'Schleuse 6F', kategorie:'schleuse', hersteller:'h1', lagerort:'l1', bereich:'b1', gtin:'04022495787309', ref:'R6', pzn:'1', merkmale:{ french:'6' },
    fotos:[{ k:'x' }], hauptbild:'x', register:{ quelle:'EUDAMED' }, verknuepfungen:[{ art:'ersatz', ziel:'m2' }], angelegt:'a', geaendert:'g', archiviert:true, preis:{ betrag:'10', bezugsmenge:1 } };
  const v = K.naVariante(o);
  assert.notEqual(v.id, 'm1'); assert.equal(v.varianteVon, 'm1');
  assert.deepEqual([v.name, v.kategorie, v.hersteller, v.lagerort, v.bereich, v.merkmale.french, v.preis.betrag], ['Schleuse 6F','schleuse','h1','l1','b1','6','10']);
  assert.deepEqual([v.gtin, v.ref, v.fotos.length], ['', '', 0]);
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
