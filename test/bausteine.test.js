'use strict';
/* Tests für die Bausteine (public/js/features/bausteine.js).

   Wie schon bei Merkmalskatalog und Zerlegung sind die Prüfmuster KEINE
   erfundenen Beispiele: Der Erkennungsteil läuft über den echten Bestand
   (public/data/hkl_standards_export.json, 47 Standards). Wer an den
   Schwellwerten dreht, sieht hier sofort, was das im Labor bedeutet.

   Der Wirkungsteil läuft gegen einen kleinen, nachgebauten Bestand — dort geht
   es um die Frage, die im Betrieb weh tut: Nimmt „Lösen" wirklich nur die
   EIGENEN Eintragungen zurück und lässt fremde stehen? */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* Objekte aus dem vm-Kontext haben eine ANDERE Prototypenkette als die des
   Testprozesses; deepEqual scheitert daran, obwohl der Inhalt stimmt. Der
   Umweg über JSON vergleicht das, worauf es ankommt: den Inhalt. */
function gleich(ist, soll, msg){ assert.deepEqual(JSON.parse(JSON.stringify(ist)), soll, msg); }

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'public/js/features/bausteine.js'), 'utf8');
const ECHT = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/hkl_standards_export.json'), 'utf8'));

/* Baut eine frische Umgebung: Speicher, QE-Ablage, DB. */
function umgebung(standards){
  const store = {};
  const ctx = vm.createContext({
    console,
    loadJSON: (k, d) => (k in store) ? JSON.parse(JSON.stringify(store[k])) : d,
    saveJSON: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
    DB: { standards: standards || [] },
    QE: { cid:{}, mat:{} },
    saveQE: () => {},
    ADDITIONS: { standards:[], entries:{} },
    saveAdditions: () => {},
    rebuildDB: () => {},
    newAid: () => 'a' + Math.random().toString(36).slice(2, 8),
    makeAddEntry: (f) => ({ anzeige_text:f.name, menge:f.menge||null, natur:f.nat,
      unterkategorie:f.uk||null, _added:true, _aid:f.aid }),
    esc: (s) => String(s),
    $: () => null,
    buildMaterialIndex: () => {},
    /* Kategorien wie in der App: `beschaffbar` heißt „Ding, das man holt". */
    natOf: (k) => ({ key:k, label:k, color:'#888',
      beschaffbar: (k==='material' || k==='geraet') }),
    rubName: (r) => r.name || '',
    /* Legt im Zielstandard eine Rubrik an, wenn sie fehlt (in der App:
       public/js/ui/forms.js). Hier nachgebaut, damit dieser Test nur die
       Baustein-Seite prüft. */
    stdRubrikSicherstellen: null,
  });
  ctx.stdRubrikSicherstellen = (sid, name, typ) => {
    const s = ctx.DB.standards.find(x => x.id === sid); if(!s) return -1;
    const i = s.rubriken.findIndex(r => (r.name||'').toLowerCase() === String(name).toLowerCase());
    if(i >= 0) return i;
    s.rubriken.push({ name, typ, sub_bereiche:[] });
    return s.rubriken.length - 1;
  };
  /* findEntry/qeGet wie in der App — hier bewusst schlank nachgebaut. */
  vm.runInContext(`
    function findEntry(cid){ const p=String(cid).split('|');
      const s=DB.standards.find(x=>x.id===p[0]); if(!s) return null;
      try{ return s.rubriken[+p[1]].sub_bereiche[+p[2]].eintraege[+p[3]]; }catch(e){ return null; } }
    function qeGet(e,cid,prop){ const c=QE.cid[cid]; if(c&&c[prop]!==undefined) return c[prop];
      const mk=e&&e.material_key; if(mk){ const m=QE.mat[mk]; if(m&&m[prop]!==undefined) return m[prop]; }
      return undefined; }
  `, ctx);
  vm.runInContext(SRC + `
    ;globalThis.__alle = () => BAUSTEINE;
    ;globalThis.__kur = {
      sammeln:bauSammeln, sammelt:bauSammelt, zahl:bauSammelZahl,
      zeilen:bauSammlungZeilen, ausSammlung:bauAusSammlung, leeren:bauSammlungLeeren,
      katAnlegen:bauKatAnlegen, katListe:bauKatListe, katSchalten:bauKatSchalten,
      katLoeschen:bauKatLoeschen, hatKat:bauHatKat,
      rubriken:bauRubriken, fuerRubrik:bauFuerRubrik, rubrikVon:bauRubrikVon,
      rubrikTyp:bauRubrikTyp, rubrikIndex:bauRubrikIndex, inStandard:bauInStandard,
      stdWahl:()=>bauStdWahl, stdSchalten:bauStdUiSchalten, stdIds:bauStdWahlIds,
      stdLeeren:bauStdWahlLeeren, stdBilanz:bauStdBilanzText, stdHTML:bauStdWahlHTML,
      einfuegen:bauEinfuegen, anlegen:bauAnlegen
    };`, ctx);
  return ctx;
}

/* Ein winziger, nachgebauter Bestand: dieselbe Folge in drei Standards. */
function zeile(t, m){ return { roh_text:t, anzeige_text:t, menge:m||null, natur:'material',
  unterkategorie:null, material_key:t.toLowerCase(), ist_fliesstext:false }; }
function mini(){
  const folge = () => [zeile('Kleiner Tisch','1x'), zeile('Coro-Set','1x'), zeile('NaCl-Flasche','1x')];
  const mk = (id, extra) => ({ id, titel:'Standard '+id, gruppe:'T', rubriken:[
    { name:'Materialien', typ:'material', sub_bereiche:[{ name:null,
      eintraege: folge().concat(extra||[]) }] }] });
  return [ mk('a'), mk('b', [zeile('Extra B')]), mk('c') ];
}

/* ═══════════════════════════════════════════════════════════════
   1. Vergleichsform: was gleich ist, muss gleich heißen
   ═══════════════════════════════════════════════════════════════ */

test('bauSlug: Schreibweise darf keinen Unterschied machen', () => {
  const B = umgebung([]);
  const s = B.bauSlug;
  assert.equal(s('Coro-Set'), s('coro set'));
  assert.equal(s('Coro-Set'), s('CORO  SET'));
  assert.equal(s('Größe'), s('Groesse'));
  assert.equal(s('500ml NaCl-Flasche'), '500ml-nacl-flasche');
  assert.equal(s(null), '');
});

/* ═══════════════════════════════════════════════════════════════
   2. Erkennung am ECHTEN Bestand
   ═══════════════════════════════════════════════════════════════ */

test('der echte Bestand zerfällt in vergleichbare Blöcke', () => {
  const B = umgebung(ECHT.standards);
  const bl = B.bauBloecke(ECHT.standards);
  assert.ok(bl.length > 150, 'Blöcke: ' + bl.length);
  const zeilen = bl.reduce((n, b) => n + b.zeilen.length, 0);
  assert.ok(zeilen > 2000, 'Zeilen: ' + zeilen);
  /* Überschriften und Fließtext gehören nicht in den Vergleich. */
  bl.forEach(b => b.zeilen.forEach(z => assert.notEqual(z.natur, 'ueberschrift')));
});

test('der Coro-Set-Aufbau wird als wiederkehrende Folge erkannt', () => {
  const B = umgebung(ECHT.standards);
  const folgen = B.bauFolgen(B.bauBloecke(ECHT.standards));
  const coro = folgen.find(f => f.key === 'kleiner-tisch§coro-set§500ml-nacl-flasche');
  assert.ok(coro, 'die Folge „kleiner Tisch · Coro-Set · 500ml NaCl-Flasche" fehlt');
  /* Das ist der Befund, der den ganzen Baustein rechtfertigt. */
  assert.ok(coro.standards.length >= 10, 'nur in ' + coro.standards.length + ' Standards');
});

test('Ausschnitte einer ebenso häufigen längeren Folge fallen weg', () => {
  const B = umgebung([]);
  const kurz = { key:'a§b§c', laenge:3, standards:['1','2','3'], vorkommen:[], zeilen:[] };
  const lang = { key:'a§b§c§d', laenge:4, standards:['1','2','3'], vorkommen:[], zeilen:[] };
  const raus = B.bauMaximal([kurz, lang]);
  gleich(raus.map(x => x.key), ['a§b§c§d']);
  /* Kommt die kurze Folge ÖFTER vor, ist sie eine eigene Erkenntnis. */
  const kurz2 = Object.assign({}, kurz, { standards:['1','2','3','4'] });
  assert.equal(B.bauMaximal([kurz2, lang]).length, 2);
});

test('die Vorschlagsliste überschneidet sich nicht', () => {
  const B = umgebung(ECHT.standards);
  const k = B.bauKandidaten(ECHT.standards);
  assert.ok(k.length >= 20, 'nur ' + k.length + ' Vorschläge');
  const belegt = new Set();
  k.forEach(x => x.vorkommen.forEach(v => v.eis.forEach(ei => {
    const zelle = v.sid + '|' + v.ri + '|' + v.si + '|' + ei;
    assert.ok(!belegt.has(zelle), 'Zelle doppelt vergeben: ' + zelle);
    belegt.add(zelle);
  })));
  /* Der Nutzen muss messbar sein, nicht behauptet. */
  const doppelt = k.reduce((n, x) => n + x.ersparnis, 0);
  assert.ok(doppelt > 400, 'nur ' + doppelt + ' doppelt gepflegte Zeilen gefunden');
});

test('jeder Vorschlag steht in mindestens drei Standards und hat drei Zeilen', () => {
  const B = umgebung(ECHT.standards);
  B.bauKandidaten(ECHT.standards).forEach(k => {
    assert.ok(k.standards.length >= 3, k.key);
    assert.ok(k.laenge >= 3, k.key);
    assert.equal(k.zeilen.length, k.laenge);
  });
});

test('bauFinden findet einen Vorschlag mindestens dort wieder, wo er herkommt', () => {
  const B = umgebung(ECHT.standards);
  const k = B.bauKandidaten(ECHT.standards)[0];
  const f = B.bauFinden(k.schluessel, ECHT.standards);
  assert.ok(f.length >= k.vorkommen.length, f.length + ' < ' + k.vorkommen.length);
});

test('Reichweite einer einzelnen Zeile: „Coro-Set" ist kein Einzelfall', () => {
  const B = umgebung(ECHT.standards);
  const r = B.bauTextReichweite('Coro-Set', ECHT.standards);
  assert.ok(r.standards >= 10, 'nur ' + r.standards + ' Standards');
  assert.ok(r.stellen >= r.standards);
  gleich(B.bauTextReichweite('', ECHT.standards), { stellen:0, standards:0 });
});

/* ═══════════════════════════════════════════════════════════════
   3. Was SOLL an einer Fundstelle stehen? („leer schlägt falsch")
   ═══════════════════════════════════════════════════════════════ */

test('ohne Abweichung wird nichts geschrieben', () => {
  const B = umgebung([]);
  const e = { anzeige_text:'Coro-Set', menge:'1x' };
  gleich(B.bauSollWerte({ text:'Coro-Set', menge:'1x' }, e), {});
});

test('nur die echte Abweichung wird geschrieben', () => {
  const B = umgebung([]);
  const e = { anzeige_text:'Coro-Set', menge:'1x' };
  gleich(B.bauSollWerte({ text:'Coro-Set Neu', menge:'1x' }, e), { name:'Coro-Set Neu' });
  gleich(B.bauSollWerte({ text:'Coro-Set', menge:'2x' }, e), { mengeVal:'2x' });
});

test('„weglassen" schlägt alles andere', () => {
  const B = umgebung([]);
  const e = { anzeige_text:'Coro-Set', menge:'1x' };
  gleich(B.bauSollWerte({ text:'Anders', menge:'9x', weg:true }, e), { hidden:true });
});

/* ═══════════════════════════════════════════════════════════════
   4. Wirkung: einmal ändern, überall gültig — und wieder zurück
   ═══════════════════════════════════════════════════════════════ */

test('ein angelegter Baustein findet alle drei Fundstellen', () => {
  const B = umgebung(mini());
  const k = B.bauKandidaten(mini());
  assert.equal(k.length, 1);
  const b = B.bauAnlegen('Coro-Aufbau', k[0].zeilen, k[0].schluessel);
  assert.equal(B.bauVorkommen(b.id).length, 3);
});

test('eine Änderung am Baustein wirkt an allen Fundstellen', () => {
  const B = umgebung(mini());
  const k = B.bauKandidaten(mini());
  const b = B.bauAnlegen('Coro-Aufbau', k[0].zeilen, k[0].schluessel);
  assert.ok(B.bauZeileSetzen(b.id, 1, 'text', 'Coro-Set XL'));
  ['a','b','c'].forEach(sid => {
    assert.equal(B.QE.cid[sid + '|0|0|1'].name, 'Coro-Set XL', 'fehlt in ' + sid);
  });
});

test('der Schlüssel bleibt eingefroren — Umbenennen verliert keine Fundstelle', () => {
  const B = umgebung(mini());
  const k = B.bauKandidaten(mini());
  const b = B.bauAnlegen('Coro-Aufbau', k[0].zeilen, k[0].schluessel);
  B.bauZeileSetzen(b.id, 1, 'text', 'Ganz anderer Name');
  B.bauCacheLeeren();
  assert.equal(B.bauVorkommen(b.id).length, 3, 'die Fundstellen sind verlorengegangen');
});

test('„Lösen" nimmt nur die EIGENEN Eintragungen zurück', () => {
  const B = umgebung(mini());
  const k = B.bauKandidaten(mini());
  const b = B.bauAnlegen('Coro-Aufbau', k[0].zeilen, k[0].schluessel);
  /* Eine fremde Eintragung an derselben Stelle — sie darf nicht verschwinden. */
  B.QE.cid['a|0|0|1'] = { color:'#ff0000' };
  B.bauZeileSetzen(b.id, 1, 'text', 'Coro-Set XL');
  assert.equal(B.QE.cid['a|0|0|1'].name, 'Coro-Set XL');
  const n = B.bauLoesen(b.id);
  assert.equal(n, 3, 'es wurden ' + n + ' statt 3 Eintragungen zurückgenommen');
  assert.equal(B.QE.cid['a|0|0|1'].name, undefined);
  assert.equal(B.QE.cid['a|0|0|1'].color, '#ff0000', 'die fremde Eintragung wurde mitgelöscht');
  assert.equal(B.QE.cid['b|0|0|1'], undefined, 'leere Hülle blieb stehen');
});

test('eine zurückgenommene Änderung wird beim erneuten Anwenden nicht doppelt gezählt', () => {
  const B = umgebung(mini());
  const k = B.bauKandidaten(mini());
  const b = B.bauAnlegen('Coro-Aufbau', k[0].zeilen, k[0].schluessel);
  B.bauZeileSetzen(b.id, 1, 'text', 'Coro-Set XL');
  /* Zurück auf den Originaltext: der Baustein muss seine Spur selbst räumen. */
  B.bauZeileSetzen(b.id, 1, 'text', 'Coro-Set');
  assert.equal(B.QE.cid['a|0|0|1'], undefined, 'die eigene Eintragung blieb liegen');
  gleich(B.bauNach(b.id).gesetzt, {});
});

test('„weglassen" blendet die Zeile überall aus — und gibt sie wieder frei', () => {
  const B = umgebung(mini());
  const k = B.bauKandidaten(mini());
  const b = B.bauAnlegen('Coro-Aufbau', k[0].zeilen, k[0].schluessel);
  B.bauZeileSetzen(b.id, 2, 'weg', true);
  ['a','b','c'].forEach(sid => assert.equal(B.QE.cid[sid + '|0|0|2'].hidden, true));
  B.bauZeileSetzen(b.id, 2, 'weg', false);
  ['a','b','c'].forEach(sid => assert.equal(B.QE.cid[sid + '|0|0|2'], undefined));
});

test('Löschen des Bausteins räumt seine Spuren mit weg', () => {
  const B = umgebung(mini());
  const k = B.bauKandidaten(mini());
  const b = B.bauAnlegen('Coro-Aufbau', k[0].zeilen, k[0].schluessel);
  B.bauZeileSetzen(b.id, 1, 'text', 'Coro-Set XL');
  B.bauLoeschen(b.id);
  assert.equal(B.__alle().length, 0);
  assert.equal(B.QE.cid['a|0|0|1'], undefined);
});

/* ═══════════════════════════════════════════════════════════════
   5. Abweichungen: nicht jede ist ein Fehler, aber jede muss auffallen
   ═══════════════════════════════════════════════════════════════ */

test('eine Abweichung an einer Stelle wird gemeldet', () => {
  const B = umgebung(mini());
  const k = B.bauKandidaten(mini());
  const b = B.bauAnlegen('Coro-Aufbau', k[0].zeilen, k[0].schluessel);
  assert.equal(B.bauAbweichungen(b.id).length, 0, 'ohne Zutun ist alles einheitlich');
  /* Jemand ändert an EINER Stelle von Hand (Schnellmenü). */
  B.QE.cid['b|0|0|1'] = { name:'Coro-Set Sonderfall' };
  const abw = B.bauAbweichungen(b.id);
  assert.equal(abw.length, 1);
  assert.equal(abw[0].sid, 'b');
  assert.equal(abw[0].was, 'text');
  assert.equal(abw[0].ist, 'Coro-Set Sonderfall');
  assert.equal(abw[0].soll, 'Coro-Set');
  /* Durchsetzen bereinigt sie. */
  B.bauAnwenden(b.id);
  assert.equal(B.bauAbweichungen(b.id).length, 0);
});

test('eine von Hand ausgeblendete Zeile fällt als Abweichung auf', () => {
  const B = umgebung(mini());
  const k = B.bauKandidaten(mini());
  const b = B.bauAnlegen('Coro-Aufbau', k[0].zeilen, k[0].schluessel);
  B.QE.cid['c|0|0|0'] = { hidden:true };
  const abw = B.bauAbweichungen(b.id);
  assert.equal(abw.length, 1);
  assert.equal(abw[0].was, 'versteckt');
});

test('bauFuerCid nennt den Baustein zu einer Stelle', () => {
  const B = umgebung(mini());
  const k = B.bauKandidaten(mini());
  const b = B.bauAnlegen('Coro-Aufbau', k[0].zeilen, k[0].schluessel);
  const t = B.bauFuerCid('b|0|0|1');
  assert.equal(t.length, 1);
  assert.equal(t[0].baustein.id, b.id);
  assert.equal(t[0].idx, 1);
  assert.equal(B.bauFuerCid('b|0|0|3').length, 0);
});

/* ═══════════════════════════════════════════════════════════════
   6. Einfügen: der Zeitgewinn beim Anlegen eines neuen Standards
   ═══════════════════════════════════════════════════════════════ */

test('ein Baustein lässt sich in einen Standard einfügen', () => {
  const B = umgebung(mini());
  const k = B.bauKandidaten(mini());
  const b = B.bauAnlegen('Coro-Aufbau', k[0].zeilen, k[0].schluessel);
  const n = B.bauEinfuegen(b.id, 'c', 0);
  assert.equal(n, 3);
  const neu = B.ADDITIONS.entries['c|0'];
  assert.equal(neu.length, 3);
  assert.equal(neu[1].anzeige_text, 'Coro-Set');
  assert.equal(neu[1].menge, '1x');
});

test('weggelassene Zeilen werden nicht eingefügt', () => {
  const B = umgebung(mini());
  const k = B.bauKandidaten(mini());
  const b = B.bauAnlegen('Coro-Aufbau', k[0].zeilen, k[0].schluessel);
  B.bauZeileSetzen(b.id, 0, 'weg', true);
  assert.equal(B.bauEinfuegen(b.id, 'c', 0), 2);
});

/* ═══════════════════════════════════════════════════════════════
   7. Randfälle — die App darf nirgends stehenbleiben
   ═══════════════════════════════════════════════════════════════ */

test('leerer Bestand, leere Eingaben: kein Absturz', () => {
  const B = umgebung([]);
  gleich(B.bauBloecke(null), []);
  gleich(B.bauFolgen(null), []);
  gleich(B.bauMaximal(null), []);
  gleich(B.bauGreedy(null), []);
  gleich(B.bauKandidaten([]), []);
  gleich(B.bauFinden([], []), []);
  assert.equal(B.bauAnlegen('x', []), null);
  assert.equal(B.bauNach('gibtsnicht'), null);
  gleich(B.bauAnwenden('gibtsnicht'), { stellen:0, felder:0 });
  assert.equal(B.bauLoesen('gibtsnicht'), 0);
  assert.equal(B.bauLoeschen('gibtsnicht'), false);
  gleich(B.bauAbweichungen('gibtsnicht'), []);
  assert.equal(B.bauEinfuegen('gibtsnicht', 'a', 0), 0);
});

test('ein Baustein ohne Fundstelle bleibt bedienbar', () => {
  const B = umgebung(mini());
  const b = B.bauAnlegen('Erfunden', [
    { text:'Gibt es nicht', menge:null }, { text:'Auch nicht', menge:null }, { text:'Nie', menge:null }]);
  assert.equal(B.bauVorkommen(b.id).length, 0);
  gleich(B.bauAnwenden(b.id), { stellen:0, felder:0 });
  gleich(B.bauAbweichungen(b.id), []);
  /* Einfügen geht trotzdem — genau dafür ist so ein Baustein da. */
  assert.equal(B.bauEinfuegen(b.id, 'a', 0), 3);
});

test('ein leerer Name wird nicht übernommen', () => {
  const B = umgebung(mini());
  const b = B.bauAnlegen('Name', [zeileObj('A'), zeileObj('B'), zeileObj('C')]);
  assert.equal(B.bauUmbenennen(b.id, '   '), false);
  assert.equal(B.bauNach(b.id).name, 'Name');
  assert.equal(B.bauZeileSetzen(b.id, 0, 'text', '  '), false);
  assert.equal(B.bauZeileSetzen(b.id, 99, 'text', 'x'), false);
  assert.equal(B.bauZeileSetzen(b.id, 0, 'quatsch', 'x'), false);
});
function zeileObj(t){ return { text:t, menge:null }; }

test('Namensvorschlag bleibt lesbar', () => {
  const B = umgebung([]);
  assert.equal(B.bauTitelVorschlag([{text:'A'},{text:'B'}]), 'A · B');
  assert.equal(B.bauTitelVorschlag([{text:'A'},{text:'B'},{text:'C'},{text:'D'}]), 'A · B +2');
  assert.equal(B.bauTitelVorschlag([]), 'Baustein');
});

test('die Bilanz zählt, was da ist', () => {
  const B = umgebung(mini());
  gleich(B.bauBilanz(), { bausteine:0, stellen:0, standards:0, abweichungen:0 });
  const k = B.bauKandidaten(mini());
  B.bauAnlegen('Coro-Aufbau', k[0].zeilen, k[0].schluessel);
  const bil = B.bauBilanz();
  assert.equal(bil.bausteine, 1);
  assert.equal(bil.stellen, 9);       /* 3 Standards × 3 Zeilen */
  assert.equal(bil.standards, 3);
  assert.equal(bil.abweichungen, 0);
});

test('ein angelegter Baustein wird nicht noch einmal vorgeschlagen', () => {
  const B = umgebung(mini());
  const k = B.bauKandidaten(mini());
  assert.equal(B.bauVorschlaege().length, 1);
  B.bauAnlegen('Coro-Aufbau', k[0].zeilen, k[0].schluessel);
  assert.equal(B.bauVorschlaege().length, 0);
});

/* ═══════════════════════════════════════════════════════════════
   8. Durchsetzen überschreibt — aber nicht endgültig
   ═══════════════════════════════════════════════════════════════ */

test('Durchsetzen überschreibt eine fremde Abweichung, Lösen stellt sie wieder her', () => {
  const B = umgebung(mini());
  const k = B.bauKandidaten(mini());
  const b = B.bauAnlegen('Coro-Aufbau', k[0].zeilen, k[0].schluessel);
  /* Jemand hat an EINER Stelle von Hand umbenannt. */
  B.QE.cid['b|0|0|1'] = { name:'Coro-Set Sonderfall', color:'#00ff00' };
  B.bauAnwenden(b.id);
  assert.equal(B.QE.cid['b|0|0|1'].name, undefined, 'die Abweichung wurde nicht durchgesetzt');
  assert.equal(B.QE.cid['b|0|0|1'].color, '#00ff00', 'ein fremdes Feld wurde mitgerissen');
  /* Lösen = der Baustein zieht sich zurück und gibt zurück, was er vorfand. */
  B.bauLoesen(b.id);
  assert.equal(B.QE.cid['b|0|0|1'].name, 'Coro-Set Sonderfall', 'die fremde Änderung ist verloren');
});

test('eine ausgeblendete Zeile wird durch Durchsetzen wieder sichtbar — umkehrbar', () => {
  const B = umgebung(mini());
  const k = B.bauKandidaten(mini());
  const b = B.bauAnlegen('Coro-Aufbau', k[0].zeilen, k[0].schluessel);
  B.QE.cid['c|0|0|0'] = { hidden:true };
  B.bauAnwenden(b.id);
  assert.equal(B.QE.cid['c|0|0|0'], undefined);
  B.bauLoesen(b.id);
  assert.equal(B.QE.cid['c|0|0|0'].hidden, true);
});

test('zweimal Durchsetzen ändert nichts mehr (und vergisst das Vorher nicht)', () => {
  const B = umgebung(mini());
  const k = B.bauKandidaten(mini());
  const b = B.bauAnlegen('Coro-Aufbau', k[0].zeilen, k[0].schluessel);
  B.QE.cid['b|0|0|1'] = { name:'Sonderfall' };
  B.bauAnwenden(b.id);
  const zweiter = B.bauAnwenden(b.id);
  assert.equal(zweiter.felder, 0, 'der zweite Lauf hat noch einmal geschrieben');
  B.bauLoesen(b.id);
  assert.equal(B.QE.cid['b|0|0|1'].name, 'Sonderfall', 'das Vorher ging beim zweiten Lauf verloren');
});

test('„vorher" ist der Zustand VOR dem ersten Zugriff des Bausteins', () => {
  /* Feine, aber wichtige Regel: Wer NACH dem Baustein an einer Stelle von Hand
     ändert, überschreibt dessen Wert — nicht den Originalzustand. „Lösen"
     führt deshalb auf den Original zurück, nicht auf die Zwischenfassung.
     Alles andere wäre eine Historie, und die führt dieser Speicher nicht. */
  const B = umgebung(mini());
  const k = B.bauKandidaten(mini());
  const b = B.bauAnlegen('Coro-Aufbau', k[0].zeilen, k[0].schluessel);
  B.bauZeileSetzen(b.id, 1, 'text', 'Coro-Set XL');        /* Baustein greift zu */
  B.QE.cid['b|0|0|1'].name = 'Von Hand danach';            /* Mensch danach */
  B.bauAnwenden(b.id);                                     /* durchsetzen */
  assert.equal(B.QE.cid['b|0|0|1'].name, 'Coro-Set XL');
  B.bauLoesen(b.id);
  assert.equal(B.QE.cid['b|0|0|1'], undefined, 'es blieb eine Zwischenfassung stehen');
});


/* ═══════════════════════════════════════════════════════════════
   6. Kuratieren statt vorschlagen
   ═══════════════════════════════════════════════════════════════

   Der Wunsch war eindeutig: „Ich will keine Vorschläge, ich kenne meine
   Bausteine schon." Gesammelt wird jetzt im Vorbeigehen — und der Baustein
   merkt sich, aus WELCHER RUBRIK er stammt. Genau daran hängt der
   Zeitgewinn beim nächsten Standard: In „Materialien" stehen die Bausteine
   für Materialien, nicht eine flache Liste über alles.
   ═══════════════════════════════════════════════════════════════ */

test('Sammeln ist ein Umschalter, kein Hinzufügen', () => {
  const B = umgebung(mini());
  const cid = 'a|0|0|0';
  assert.equal(B.__kur.sammelt(cid), false);
  B.__kur.sammeln(cid);
  assert.equal(B.__kur.sammelt(cid), true);
  assert.equal(B.__kur.zahl(), 1);
  B.__kur.sammeln(cid);
  assert.equal(B.__kur.sammelt(cid), false, 'nochmal tippen nimmt wieder heraus');
  assert.equal(B.__kur.zahl(), 0);
});

test('die Mappe behält die Reihenfolge des Sammelns', () => {
  const B = umgebung(mini());
  B.__kur.sammeln('a|0|0|2');
  B.__kur.sammeln('a|0|0|0');
  const z = B.__kur.zeilen();
  assert.equal(z.map(x => x.text).join('|'), 'NaCl-Flasche|Kleiner Tisch');
});

test('gelöschte Stellen fallen still aus der Mappe', () => {
  const B = umgebung(mini());
  B.__kur.sammeln('a|0|0|0');
  B.__kur.sammeln('a|9|9|9');
  assert.equal(B.__kur.zeilen().length, 1, 'eine Stelle, die es nicht gibt, ist kein Fehler');
});

test('DAS ENTSCHEIDENDE: der Baustein merkt sich seine Rubrik', () => {
  const B = umgebung(mini());
  B.__kur.sammeln('a|0|0|0');
  B.__kur.sammeln('a|0|0|1');
  const b = B.__kur.ausSammlung('Kleiner Tisch', []);
  assert.equal(b.rubrik, 'Materialien');
  assert.equal(b.quelle, 'kuratiert');
  assert.equal(B.__kur.fuerRubrik('Materialien').length, 1);
  assert.equal(B.__kur.fuerRubrik('Ablauf').length, 0);
});

test('die Rubrik ist die häufigste, nicht die erste', () => {
  /* Wer versehentlich eine Zeile aus einer anderen Rubrik mitnimmt, soll den
     Baustein trotzdem dort finden, wo er hingehört. */
  const stds = [{ id:'x', titel:'X', gruppe:'T', rubriken:[
    { name:'Ablauf', typ:'sonstige', sub_bereiche:[{ name:null, eintraege:[zeile('Fremdzeile')] }] },
    { name:'Materialien', typ:'material', sub_bereiche:[{ name:null, eintraege:[zeile('A'), zeile('B')] }] }
  ]}];
  const B = umgebung(stds);
  B.__kur.sammeln('x|0|0|0');   /* Ablauf */
  B.__kur.sammeln('x|1|0|0');   /* Materialien */
  B.__kur.sammeln('x|1|0|1');   /* Materialien */
  const b = B.__kur.ausSammlung('Gemischt', []);
  assert.equal(b.rubrik, 'Materialien');
});

test('nach dem Anlegen ist die Mappe leer', () => {
  const B = umgebung(mini());
  B.__kur.sammeln('a|0|0|0');
  B.__kur.ausSammlung('Test', []);
  assert.equal(B.__kur.zahl(), 0, 'sonst landete dieselbe Zeile im nächsten Baustein noch einmal');
});

test('aus einer leeren Mappe entsteht kein Baustein', () => {
  const B = umgebung(mini());
  assert.equal(B.__kur.ausSammlung('Leer', []), null);
  assert.equal(B.__alle().length, 0);
});

test('ein Baustein trägt beliebig viele Kategorien — Facetten statt Baum', () => {
  const B = umgebung(mini());
  const k1 = B.__kur.katAnlegen('CRM');
  const k2 = B.__kur.katAnlegen('EPU');
  B.__kur.sammeln('a|0|0|0');
  const b = B.__kur.ausSammlung('Test', [k1.key, k2.key]);
  assert.equal(B.__kur.hatKat(b, k1.key), true);
  assert.equal(B.__kur.hatKat(b, k2.key), true);
  assert.equal(B.__kur.hatKat(b, 'gibtsnicht'), false);
  assert.equal(B.__kur.hatKat(b, ''), true, 'ohne Filter passt jeder Baustein');
});

test('Kategorien lassen sich nachträglich an- und abschalten', () => {
  const B = umgebung(mini());
  const k = B.__kur.katAnlegen('EPU');
  B.__kur.sammeln('a|0|0|0');
  const b = B.__kur.ausSammlung('Test', []);
  assert.equal(B.__kur.hatKat(b, k.key), false);
  B.__kur.katSchalten(b.id, k.key);
  assert.equal(B.__kur.hatKat(B.__alle()[0], k.key), true);
  B.__kur.katSchalten(b.id, k.key);
  assert.equal(B.__kur.hatKat(B.__alle()[0], k.key), false);
});

test('eine gelöschte Kategorie verschwindet auch aus den Bausteinen', () => {
  const B = umgebung(mini());
  const k = B.__kur.katAnlegen('Weg damit');
  B.__kur.sammeln('a|0|0|0');
  const b = B.__kur.ausSammlung('Test', [k.key]);
  B.__kur.katLoeschen(k.key);
  assert.equal(B.__kur.katListe().length, 0);
  assert.equal((B.__alle()[0].kats || []).length, 0,
    'sonst hinge ein unsichtbarer Schlüssel am Baustein');
});

test('zwei gleichnamige Kategorien bekommen verschiedene Schlüssel', () => {
  const B = umgebung(mini());
  const a = B.__kur.katAnlegen('EPU');
  const b = B.__kur.katAnlegen('EPU');
  assert.notEqual(a.key, b.key);
});

test('bauRubriken listet die Heimatrubriken der Bibliothek', () => {
  const B = umgebung(mini());
  B.__kur.sammeln('a|0|0|0');
  B.__kur.ausSammlung('Eins', []);
  B.__kur.sammeln('b|0|0|0');
  B.__kur.ausSammlung('Zwei', []);
  assert.equal(B.__kur.rubriken().join(','), 'Materialien');
});

/* ═══════════════════════════════════════════════════════════════
   4. Bausteine beim ANLEGEN eines Standards
   Der Betreiber wollte beim Neuanlegen ankreuzen können — und die Bausteine
   sollen dort landen, wo sie herkommen. Getestet wird deshalb weniger das
   Einfügen (das kann bauEinfuegen längst) als die ZUORDNUNG: Findet ein
   Baustein seine Heimatrubrik? Und wenn es sie nicht gibt?
   ═══════════════════════════════════════════════════════════════ */

/* Ein Zielstandard, wie ihn addStandard() anlegt: drei leere Rubriken. */
function frisch(){ return { id:'neu', titel:'Neuer Standard', gruppe:'Eigene', rubriken:[
  { name:'Saal und Geräte', typ:'geraete', sub_bereiche:[] },
  { name:'Material', typ:'material', sub_bereiche:[] },
  { name:'Ablauf', typ:'ablauf', sub_bereiche:[] } ] }; }

test('die Rubrik-Art wird an den Zeilen abgelesen, nicht geraten', () => {
  const B = umgebung([]);
  assert.equal(B.__kur.rubrikTyp({ zeilen:[{natur:'material'},{natur:'material'},{natur:'handgriff'}] }), 'material');
  assert.equal(B.__kur.rubrikTyp({ zeilen:[{natur:'geraet'},{natur:'geraet'}] }), 'geraete');
  assert.equal(B.__kur.rubrikTyp({ zeilen:[{natur:'handgriff'},{natur:'handgriff'}] }), 'ablauf');
  assert.equal(B.__kur.rubrikTyp({ zeilen:[] }), 'sonstige', 'ohne Zeilen wird nichts behauptet');
  assert.equal(B.__kur.rubrikTyp({ zeilen:[{natur:'material',weg:true},{natur:'geraet'}] }), 'geraete',
    'entfernte Zeilen zählen nicht mit');
});

test('ein Baustein landet in der Rubrik, aus der er stammt', () => {
  const B = umgebung(mini().concat([frisch()]));
  B.__kur.sammeln('a|0|0|0'); B.__kur.sammeln('a|0|0|1');
  const b = B.__kur.ausSammlung('Tischaufbau', []);
  b.rubrik = 'Material';                       /* Heimat: die Materialrubrik */
  const erg = B.__kur.inStandard('neu', [b.id]);
  assert.equal(erg.bausteine, 1);
  assert.equal(erg.zeilen, 2);
  assert.equal(erg.neueRubriken.length, 0, 'die Rubrik gab es schon');
  assert.ok(B.ADDITIONS.entries['neu|1'], 'Index 1 ist „Material"');
  assert.equal(B.ADDITIONS.entries['neu|1'].length, 2);
});

test('fehlt die Heimatrubrik, entsteht sie — statt die Zeilen irgendwo abzuladen', () => {
  const B = umgebung(mini().concat([frisch()]));
  B.__kur.sammeln('a|0|0|0');
  const b = B.__kur.ausSammlung('Vorbereitung', []);
  b.rubrik = 'Patientenvorbereitung';
  const erg = B.__kur.inStandard('neu', [b.id]);
  assert.equal(erg.neueRubriken.join(','), 'Patientenvorbereitung');
  const ziel = B.DB.standards.find(s => s.id === 'neu');
  assert.equal(ziel.rubriken.length, 4);
  assert.equal(ziel.rubriken[3].name, 'Patientenvorbereitung');
  assert.equal(ziel.rubriken[3].typ, 'material', 'die Art kommt von den Zeilen');
  assert.equal(B.ADDITIONS.entries['neu|3'].length, 1);
});

test('ein Baustein ohne Heimat geht nicht verloren', () => {
  const B = umgebung(mini().concat([frisch()]));
  B.__kur.sammeln('a|0|0|0');
  const b = B.__kur.ausSammlung('Heimatlos', []);
  b.rubrik = '';
  const erg = B.__kur.inStandard('neu', [b.id]);
  assert.equal(erg.zeilen, 1, 'lieber in die erste Rubrik als nirgends (Grundsatz ②)');
  assert.equal(B.ADDITIONS.entries['neu|0'].length, 1);
});

test('mehrere Bausteine verteilen sich auf ihre jeweiligen Rubriken', () => {
  const B = umgebung(mini().concat([frisch()]));
  B.__kur.sammeln('a|0|0|0');
  const b1 = B.__kur.ausSammlung('Eins', []); b1.rubrik = 'Material';
  B.__kur.sammeln('a|0|0|1'); B.__kur.sammeln('a|0|0|2');
  const b2 = B.__kur.ausSammlung('Zwei', []); b2.rubrik = 'Ablauf';
  const erg = B.__kur.inStandard('neu', [b1.id, b2.id]);
  assert.equal(erg.bausteine, 2);
  assert.equal(erg.zeilen, 3);
  assert.equal(B.ADDITIONS.entries['neu|1'].length, 1, 'einer nach Material');
  assert.equal(B.ADDITIONS.entries['neu|2'].length, 2, 'zwei nach Ablauf');
});

test('ein unbekannter Baustein wird still übergangen', () => {
  const B = umgebung(mini().concat([frisch()]));
  const erg = B.__kur.inStandard('neu', ['gibtsnicht']);
  assert.equal(erg.bausteine, 0);
  assert.equal(erg.zeilen, 0);
});

test('ohne Auswahl passiert nichts', () => {
  const B = umgebung(mini().concat([frisch()]));
  const erg = B.__kur.inStandard('neu', []);
  assert.equal(erg.zeilen, 0);
  assert.equal(Object.keys(B.ADDITIONS.entries).length, 0);
});

test('bauRubrikIndex vergleicht über den ANGEZEIGTEN Namen', () => {
  const B = umgebung(mini().concat([frisch()]));
  assert.equal(B.__kur.rubrikIndex('neu', 'Material'), 1);
  assert.equal(B.__kur.rubrikIndex('neu', '  material  '), 1, 'Groß/klein und Leerraum egal');
  assert.equal(B.__kur.rubrikIndex('neu', 'Gibt es nicht'), -1);
  assert.equal(B.__kur.rubrikIndex('gibtsnicht', 'Material'), -1);
});

test('die Auswahl im Formular zählt ehrlich und lässt sich leeren', () => {
  const B = umgebung(mini());
  B.__kur.sammeln('a|0|0|0'); B.__kur.sammeln('a|0|0|1');
  const b = B.__kur.ausSammlung('Tischaufbau', []); b.rubrik = 'Material';
  assert.match(B.__kur.stdBilanz(), /Nichts angekreuzt/);
  B.__kur.stdSchalten(b.id, true);
  assert.equal(B.__kur.stdIds().length, 1);
  assert.match(B.__kur.stdBilanz(), /1 Baustein · 2 Zeilen · 1 Rubrik/);
  B.__kur.stdSchalten(b.id, false);
  assert.equal(B.__kur.stdIds().length, 0);
  B.__kur.stdSchalten(b.id, true);
  B.__kur.stdLeeren();
  assert.equal(B.__kur.stdIds().length, 0, 'ein neues Formular startet ohne Altlasten');
});

test('ohne Bausteine gibt es im Formular keinen leeren Block', () => {
  const B = umgebung(mini());
  assert.equal(B.__kur.stdHTML(), '', 'eine Überschrift ohne Inhalt wäre eine Frage ohne Antwort');
  B.__kur.sammeln('a|0|0|0');
  B.__kur.ausSammlung('Eins', []);
  assert.match(B.__kur.stdHTML(), /Bausteine übernehmen/);
});
