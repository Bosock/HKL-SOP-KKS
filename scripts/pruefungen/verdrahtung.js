'use strict';
/* ─────────────────────────────────────────────────────────────
   PRÜFUNG — HÄNGT ALLES ZUSAMMEN, WAS ZUSAMMENGEHÖRT?

   Diese App hat keinen Bündler. Alle Module teilen EINEN globalen Namensraum,
   und jede Schaltfläche nennt ihre Funktion als Zeichenkette im HTML. Daraus
   folgen vier Fehlerklassen, die alle dasselbe gemeinsam haben: NICHTS GEHT
   KAPUTT. Kein Absturz, keine rote Meldung — es passiert einfach nichts, oder
   etwas anderes als gedacht. Genau deshalb braucht es eine Maschine dafür
   (Grundsatz ⑨).

   ① DOPPELTER NAME. Eine zweite `function speichern()` in einer anderen Datei
      überschreibt die erste lautlos. Welche gewinnt, hängt an der Reihenfolge
      der <script>-Tags. Der teuerste Fehler dieser Bauart.

   ② KNOPF INS LEERE. `onclick="machWas()"` ohne machWas() — der Finger tippt,
      und nichts geschieht. Im Saal sieht das aus wie ein hakendes Tablet.

   ③ TOTER CODE. Eine Funktion, die niemand ruft, ist eine Falle für den
      nächsten, der sie liest und für in Benutzung hält. Zweimal in diesem
      Projekt war so etwas kein Ballast, sondern eine VERGESSENE VERDRAHTUNG:
      Die Funktion war da, angeschrieben und getestet — nur der Weg dorthin
      fehlte (pbScopeAlle, merkAbdeckung).

   ④ SPEICHER-SCHLÜSSEL OHNE TEILUNG. Wird etwas gespeichert, das nicht in
      SHARED_KEYS steht, wirkt es NUR auf dem Gerät, an dem es gepflegt wurde.
      Am Tablet im Saal fehlt es dann, ohne Fehlermeldung. Gerätelokal ist
      manchmal richtig — dann steht es hier mit BEGRÜNDUNG in der Liste.

   ⑤ WACHE AUF EINEN NAMEN, DEN ES NICHT GIBT. Weil die Module lose
      nebeneinanderliegen, fragt der Code vorsichtig `typeof x==='function'`,
      bevor er ruft. Steht dort ein Name, den es nirgends gibt — ein Tippfehler,
      ein umbenanntes Modul —, ist die Wache für immer falsch. Der Zweig läuft
      nie, und zwar so leise, dass er nach „vorsichtig programmiert" aussieht.
      Genau so verschwand der Zähler auf dem Reiter „Aktuelles": die Wache
      fragte nach `aktuellGeltende`, die Funktion heißt `aktGeltende`. Und im
      Diagnose-Bericht stand jahrelang ein leeres Feld „Version", weil dort
      nach `APP_VERSION` gefragt wurde — eine Größe, die es nie gab.

   Alle fünf arbeiten mit einer Ratsche in beide Richtungen: zu viele Fälle
   brechen ab, zu wenige ebenfalls — eine Liste, die still veraltet, schützt
   am Ende nichts.
   ───────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const { jsDateien } = require('./quelltext');

/* Browser-Eingebautes und globale Helfer, die es immer gibt. */
const EINGEBAUT = new Set(['alert','confirm','prompt','print','fetch','setTimeout','clearTimeout',
  'setInterval','clearInterval','encodeURIComponent','decodeURIComponent','JSON','Math','Object',
  'Array','String','Number','Boolean','Date','Set','Map','WeakMap','Promise','parseInt','parseFloat',
  'isNaN','isFinite','console','document','window','navigator','history','location','event','open',
  'requestAnimationFrame','URL','URLSearchParams','Blob','File','FileReader','Image','CustomEvent',
  'Intl','RegExp','Error','TypeError','structuredClone','queueMicrotask','btoa','atob',
  'caches','indexedDB','IDBKeyRange','crypto','localStorage','sessionStorage','performance']);

/* Schlüsselwörter, die vor einer Klammer stehen dürfen, ohne Aufruf zu sein. */
const SCHLUESSELWORT = new Set(['if','for','while','switch','return','typeof','function','catch',
  'new','delete','void','in','of','do','else','case','await','yield']);

/* ── Quellen einsammeln ── */
function quellen(wurzel){
  const js = jsDateien(path.join(wurzel, 'public/js'));
  const html = path.join(wurzel, 'public/index.html');
  return { js, alle: js.concat(fs.existsSync(html) ? [html] : []) };
}

/* Alle Namen, die ein `let`/`const`/`var` in diesem Text erklärt.
   `const a = 1, b = 2;` erklärt ZWEI Namen — deshalb wird ab dem Schlüsselwort
   bis zum Zeilenende bzw. Semikolon gelaufen und bei jedem Komma auf
   Klammerebene 0 der nächste Name mitgenommen. Ein einfaches Muster übersähe
   den zweiten, und alles, was auf ihn zeigt, hielte er für unbekannt. */
function deklarierteNamen(txt){
  const n = [];
  const rd = /\b(?:let|const|var)\s+/g;
  let d;
  while((d = rd.exec(txt))){
    let i = d.index + d[0].length, tiefe = 0, erwarteName = true;
    for(; i < txt.length; i++){
      const c = txt[i];
      if(c === '\n' || (c === ';' && tiefe === 0)) break;
      if('([{'.includes(c)) tiefe++;
      else if(')]}'.includes(c)){ if(tiefe === 0) break; tiefe--; }
      else if(c === ',' && tiefe === 0) erwarteName = true;
      else if(erwarteName && /[A-Za-z_$]/.test(c)){
        const m = /^[A-Za-z_$][\w$]*/.exec(txt.slice(i));
        if(n.indexOf(m[0]) < 0) n.push(m[0]);
        i += m[0].length - 1; erwarteName = false;
      }
      else if(erwarteName && !/\s/.test(c) && c !== '{' && c !== '[') erwarteName = false;
    }
  }
  return n;
}

/* Alles, was auf oberster Ebene einen globalen Namen belegt. */
function definitionen(dateien, wurzel){
  const aus = {};
  dateien.forEach(p=>{
    const rel = path.relative(wurzel, p).split(path.sep).join('/');
    fs.readFileSync(p,'utf8').split('\n').forEach((z,i)=>{
      let m;
      /* `function f(`, auch `async function` und mehrere in EINER Zeile */
      const rf = /(?:^|[;{}\s])(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g;
      while((m = rf.exec(z))){
        /* nur oberste Ebene: eingerückte Funktionen sind lokal */
        if(/^\s/.test(z) && !/^(?:let|const|var)/.test(z.trim())) {
          if(/^\s{2,}/.test(z)) continue;
        }
        (aus[m[1]] = aus[m[1]] || []).push({ rel, nr:i+1, art:'function' });
      }
      /* `let curStd=null, curSeg='standard';` erklärt ZWEI globale Namen.
         Früher wurde nur der erste erfasst — dadurch galt `curSeg` als
         „gibt es nicht", und Prüfung ⑤ schlug bei jeder Wache darauf an. */
      if(/^(?:let|const|var)\s/.test(z))
        deklarierteNamen(z).forEach(n=>(aus[n] = aus[n] || []).push({ rel, nr:i+1, art:'variable' }));
    });
  });
  return aus;
}

/* ① Doppelte globale Namen. */
function doppelteNamen(defs){
  const probleme = [];
  Object.keys(defs).sort().forEach(name=>{
    const l = defs[name];
    if(l.length < 2) return;
    probleme.push(`Globaler Name „${name}" ist ${l.length}× vergeben:\n    `
      + l.map(d=>`${d.rel}:${d.nr} [${d.art}]`).join('\n    ')
      + `\n    Alle Module teilen EINEN Namensraum — die spätere Definition gewinnt lautlos.`);
  });
  return probleme;
}

/* ② Handler im erzeugten HTML, deren Funktion es nicht gibt. */
function handlerOhneZiel(dateien, defs, wurzel){
  const bekannt = new Set(Object.keys(defs));
  const fehlt = {};
  const ereignis = /\son(?:click|change|input|keydown|keyup|submit|focus|blur|toggle)\s*=\s*(["'])([\s\S]*?)\1/g;
  dateien.forEach(p=>{
    const rel = path.relative(wurzel, p).split(path.sep).join('/');
    const txt = fs.readFileSync(p,'utf8');
    let m; const re = new RegExp(ereignis.source, 'g');
    while((m = re.exec(txt))){
      const nr = txt.slice(0, m.index).split('\n').length;
      const rufe = /(?:^|[;{}\s(&|!?:])([A-Za-z_$][\w$]*)\s*\(/g;
      let f;
      while((f = rufe.exec(m[2]))){
        const name = f[1];
        if(SCHLUESSELWORT.has(name) || EINGEBAUT.has(name) || bekannt.has(name)) continue;
        (fehlt[name] = fehlt[name] || []).push(`${rel}:${nr}`);
      }
    }
  });
  return Object.keys(fehlt).sort().map(n=>
    `Schaltfläche ohne Ziel: ${n}() ist nirgends definiert (${fehlt[n].length} Fundstelle(n))\n    `
    + fehlt[n].slice(0,3).join('\n    ')
    + `\n    Der Finger tippt, und es passiert nichts — kein Fehler, keine Meldung.`);
}

/* ③ Funktionen ohne jede Verwendung (auch Tests und E2E zählen als Nutzung). */
function toteFunktionen(wurzel, geduldet){
  const { js } = quellen(wurzel);
  const suchraum = js
    .concat([path.join(wurzel,'public/index.html'), path.join(wurzel,'public/sw.js')])
    .concat(jsDateien(path.join(wurzel,'test')))
    .concat(jsDateien(path.join(wurzel,'e2e')))
    .concat(jsDateien(path.join(wurzel,'scripts')))
    .filter(p=>fs.existsSync(p));
  const text = suchraum.map(p=>fs.readFileSync(p,'utf8')).join('\n');
  const tot = [];
  js.forEach(p=>{
    const rel = path.relative(wurzel, p).split(path.sep).join('/');
    fs.readFileSync(p,'utf8').split('\n').forEach((z,i)=>{
      const re = /(?:^|[;{}\s])(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g;
      let m;
      while((m = re.exec(z))){
        const name = m[1];
        if((geduldet||[]).indexOf(name) >= 0) continue;
        const treffer = (text.match(new RegExp('\\b'+name.replace(/\$/g,'\\$')+'\\b','g')) || []).length;
        if(treffer <= 1) tot.push(`${name}()  ${rel}:${i+1}`);
      }
    });
  });
  if(!tot.length) return [];
  return [`Funktionen ohne jede Verwendung (${tot.length}):\n    ` + tot.join('\n    ')
    + `\n    Entweder verdrahten (oft ist es eine vergessene Verdrahtung) oder entfernen.`];
}

/* ④ Speicher-Schlüssel, die nicht geteilt werden. */
function ungeteilteSchluessel(wurzel, gerätelokal){
  const sync = path.join(wurzel, 'public/js/core/sync.js');
  if(!fs.existsSync(sync)) return [];
  const txt = fs.readFileSync(sync,'utf8');
  const block = /const SHARED_KEYS\s*=\s*\[([\s\S]*?)\];/.exec(txt);
  if(!block) return ['SHARED_KEYS in public/js/core/sync.js nicht gefunden.'];
  const geteilt = new Set([...block[1].matchAll(/'([^']+)'/g)].map(m=>m[1]));
  const lokal = Object.keys(gerätelokal || {});
  const geschrieben = {};
  jsDateien(path.join(wurzel,'public/js')).forEach(p=>{
    const rel = path.relative(wurzel, p).split(path.sep).join('/');
    fs.readFileSync(p,'utf8').split('\n').forEach((z,i)=>{
      for(const m of z.matchAll(/(?:saveJSON|store\.set)\(\s*'(hkl_[\w]+)'/g))
        (geschrieben[m[1]] = geschrieben[m[1]] || []).push(`${rel}:${i+1}`);
    });
  });
  const probleme = [];
  Object.keys(geschrieben).sort().forEach(k=>{
    if(geteilt.has(k) || lokal.indexOf(k) >= 0) return;
    probleme.push(`Speicher-Schlüssel „${k}" wird geschrieben, aber nicht geteilt:\n    `
      + geschrieben[k].slice(0,3).join('\n    ')
      + `\n    Er wirkt nur auf DIESEM Gerät. Entweder in SHARED_KEYS (public/js/core/sync.js)`
      + `\n    aufnehmen — oder mit Begründung in scripts/pruefungen/altlasten.json unter`
      + `\n    "geraetelokal" eintragen.`);
  });
  /* Gegenrichtung: eine Begründung für einen Schlüssel, den es nicht mehr gibt. */
  lokal.forEach(k=>{
    if(!geschrieben[k] && !geteilt.has(k))
      probleme.push(`„${k}" steht als gerätelokal begründet, wird aber nirgends mehr geschrieben.`
        + `\n    Eintrag aus scripts/pruefungen/altlasten.json entfernen.`);
  });
  return probleme;
}

/* ── Namen, die INNERHALB einer Datei entstehen ──
   Für ⑤ genügt nicht die Liste der globalen Namen: `typeof danach==='function'`
   fragt nach einem Parameter, `typeof origToast==='function'` nach einer
   Variablen in einem Block. Beides ist richtig und darf nicht anschlagen. */
function ortsnamen(txt){
  const n = new Set();
  /* Funktionen an jeder Stelle — auch die eingerückten, die `definitionen()`
     bewusst auslässt, weil sie keinen globalen Namen belegen. */
  for(const m of txt.matchAll(/\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g)) n.add(m[1]);
  /* Deklarationen an jeder Stelle, auch eingerückt und mehrfach je Zeile. */
  deklarierteNamen(txt).forEach(x=>n.add(x));
  /* Parameterlisten: function f(a,b), (a,b)=>, a=>, catch(e) */
  const listen = [];
  for(const m of txt.matchAll(/function\s*[A-Za-z_$][\w$]*\s*\(([^)]*)\)/g)) listen.push(m[1]);
  for(const m of txt.matchAll(/function\s*\(([^)]*)\)/g)) listen.push(m[1]);
  for(const m of txt.matchAll(/\(([^()]*)\)\s*=>/g)) listen.push(m[1]);
  for(const m of txt.matchAll(/catch\s*\(([^)]*)\)/g)) listen.push(m[1]);
  for(const m of txt.matchAll(/(?:^|[^\w$.)])([A-Za-z_$][\w$]*)\s*=>/g)) n.add(m[1]);
  listen.forEach(l=>{ l.split(',').forEach(t=>{
    const m = /([A-Za-z_$][\w$]*)/.exec(String(t).replace(/[{}\[\]]/g,' '));
    if(m) n.add(m[1]); }); });
  return n;
}

/* ⑤ `typeof x==='function'` auf einen Namen, den es nirgends gibt. */
function wacheOhneNamen(wurzel, defs, geduldet){
  const bekannt = new Set(Object.keys(defs));
  const probleme = [];
  jsDateien(path.join(wurzel,'public/js')).forEach(p=>{
    const rel = path.relative(wurzel, p).split(path.sep).join('/');
    const txt = fs.readFileSync(p,'utf8');
    const hier = ortsnamen(txt);
    txt.split('\n').forEach((z,i)=>{
      for(const m of z.matchAll(/typeof\s+([A-Za-z_$][\w$]*)\s*[=!]==?\s*'(?:function|object|string|number|undefined)'/g)){
        const name = m[1];
        if(EINGEBAUT.has(name) || bekannt.has(name) || hier.has(name)) continue;
        if((geduldet||[]).indexOf(name) >= 0) continue;
        probleme.push(`Wache auf einen Namen, den es nicht gibt: „${name}" (${rel}:${i+1})`
          + `\n    Die Prüfung ist für immer falsch — der Zweig dahinter läuft nie,`
          + `\n    und zwar völlig lautlos. Meist ein Tippfehler im Namen.`);
      }
    });
  });
  return probleme;
}

function pruefe(wurzel, altlasten){
  const opt = altlasten || {};
  const { alle, js } = quellen(wurzel);
  const defs = definitionen(alle, wurzel);
  return [].concat(
    doppelteNamen(defs),
    handlerOhneZiel(alle, defs, wurzel),
    toteFunktionen(wurzel, opt.toteFunktionen),
    ungeteilteSchluessel(wurzel, opt.geraetelokal),
    wacheOhneNamen(wurzel, defs, opt.wachen));
}

module.exports = { pruefe, definitionen, doppelteNamen, handlerOhneZiel, toteFunktionen,
  ungeteilteSchluessel, ortsnamen, wacheOhneNamen, deklarierteNamen };
