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

   Alle vier arbeiten mit einer Ratsche in beide Richtungen: zu viele Fälle
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
  'Intl','RegExp','Error','TypeError','structuredClone','queueMicrotask','btoa','atob']);

/* Schlüsselwörter, die vor einer Klammer stehen dürfen, ohne Aufruf zu sein. */
const SCHLUESSELWORT = new Set(['if','for','while','switch','return','typeof','function','catch',
  'new','delete','void','in','of','do','else','case','await','yield']);

/* ── Quellen einsammeln ── */
function quellen(wurzel){
  const js = jsDateien(path.join(wurzel, 'public/js'));
  const html = path.join(wurzel, 'public/index.html');
  return { js, alle: js.concat(fs.existsSync(html) ? [html] : []) };
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
      if((m = /^(?:let|const|var)\s+([A-Za-z_$][\w$]*)\s*[=;]/.exec(z)))
        (aus[m[1]] = aus[m[1]] || []).push({ rel, nr:i+1, art:'variable' });
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

function pruefe(wurzel, altlasten){
  const opt = altlasten || {};
  const { alle, js } = quellen(wurzel);
  const defs = definitionen(alle, wurzel);
  return [].concat(
    doppelteNamen(defs),
    handlerOhneZiel(alle, defs, wurzel),
    toteFunktionen(wurzel, opt.toteFunktionen),
    ungeteilteSchluessel(wurzel, opt.geraetelokal));
}

module.exports = { pruefe, definitionen, doppelteNamen, handlerOhneZiel, toteFunktionen, ungeteilteSchluessel };
