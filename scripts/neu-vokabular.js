#!/usr/bin/env node
/* Erzeugt public/neu/daten/material-namen.json — die Bezeichnungen, die die
   neue App beim Tippen eines Materialnamens vorschlägt.

   Quelle sind die mitgelieferten Standards (public/data/hkl_standards_export.json):
   alle Zeilen der Art „Material" in den Material-Rubriken. Es sind NUR Wörter
   — kein Material wird dadurch angelegt, der Neuaufbau bleibt leer. Der Zweck:
   weniger tippen, und derselbe Gegenstand heißt überall gleich.

   Aufruf:  node scripts/neu-vokabular.js */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const quelle = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/hkl_standards_export.json'), 'utf8'));

const namen = new Map();
(quelle.standards || []).forEach(s => (s.rubriken || []).forEach(r => {
  if (r.typ !== 'material') return;
  (r.sub_bereiche || []).forEach(sb => (sb.eintraege || []).forEach(e => {
    if (e.natur !== 'material' || e.ist_fliesstext) return;
    const t = String(e.anzeige_text || '').replace(/\s+/g, ' ').replace(/^[+\s]+/, '').trim();
    /* Sammelzeilen („A | B | C") und Sätze sind keine Bezeichnung. */
    if (t.length < 3 || t.length > 60 || /[|]/.test(t)) return;
    const k = t.toLowerCase();
    const o = namen.get(k) || { n: t, z: 0 }; o.z++; namen.set(k, o);
  }));
}));
const liste = Array.from(namen.values()).sort((a, b) => b.z - a.z || a.n.localeCompare(b.n, 'de'));
const ziel = path.join(ROOT, 'public/neu/daten/material-namen.json');
fs.writeFileSync(ziel, JSON.stringify({ _zweck: 'Vorschläge beim Tippen eines Materialnamens. Erzeugt von scripts/neu-vokabular.js aus den mitgelieferten Standards. n = Bezeichnung, z = wie oft sie dort steht.', namen: liste }));
console.log(liste.length + ' Bezeichnungen → ' + path.relative(ROOT, ziel));
