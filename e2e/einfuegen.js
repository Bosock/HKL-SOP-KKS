/* E2E: Eine ganze Liste auf einmal (features/einfuegen.js).

   Das Zerlegen deckt test/einfuegen.test.js ab — dort steht, was aus Word
   wirklich herauskommt. Hier geht es um den WEG, den ein Mensch geht, der
   einen Standard schreibt:

     Rubrik öffnen → „📋 Liste einfügen" → Text hineinkopieren → prüfen →
     eine Zeile korrigieren, eine abwählen → einfügen → und die Zeilen stehen
     wirklich in der Rubrik.

   Zwei Zusagen werden dabei einzeln geprüft:
     · Vor dem Prüfschritt entsteht NICHTS. Wer abbricht, hinterlässt nichts.
     · Ein Name, den die App schon kennt, wird auf dessen Schreibweise
       gezogen — daran hängt, ob die neue Zeile dasselbe Material ist wie
       ihre Geschwister. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

const AUS_WORD = [
  'Material:',
  '',
  '-\t2x E2E Radialschleuse 6F',
  '-\tE2E Führungsdraht 0.035',
  '- 10 Stk. E2E Kompressen',
  '',
  '1. E2E Punktion A. radialis',
  '2. E2E Schleuse einbringen',
  'E2E Führungsdraht 0.035',
].join('\n');

(async () => {
  const r = reporter('einfuegen');
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);
  await A.page.evaluate(`doLogin('1234567')`);

  /* ═══════════ 1. Der Knopf steht in der Rubrik ═══════════ */
  const start = await A.page.evaluate(`(function(){
    const s=DB.standards[0];
    let ri=null;
    (s.rubriken||[]).forEach((rr,i)=>{ if(ri===null && (rr.sub_bereiche||[]).length) ri=i; });
    openStandard(s.id); openRubrik(ri);
    const kn=[...document.querySelectorAll('#scr-detail .add-entry-btn')].map(b=>b.textContent);
    return { sid:s.id, ri, knopf:kn.some(t=>/Liste einfügen/.test(t)),
      vorher:(ADDITIONS.entries[s.id+'|'+ri]||[]).length };
  })()`);
  r.check('in der Rubrik steht „📋 Liste einfügen"', start.knopf);

  /* Ohne Anmeldung nicht. */
  const gast = await A.page.evaluate(`(function(){
    ADMIN=false; openRubrik(${start.ri});
    const kn=[...document.querySelectorAll('#scr-detail .add-entry-btn')].map(b=>b.textContent);
    doLogin('1234567'); openRubrik(${start.ri});
    return { ohne: !kn.some(t=>/Liste einfügen/.test(t)) };
  })()`);
  r.check('… nur im Verwaltungsmodus', gast.ohne);

  /* ═══════════ 2. Text einfügen und prüfen lassen ═══════════ */
  const knopf = await A.page.$$('#scr-detail .add-entry-btn');
  let geklickt = false;
  for (const b of knopf) {
    const t = await b.textContent();
    if (/Liste einfügen/.test(t)) { await b.click(); geklickt = true; break; }
  }
  await A.page.waitForSelector('#einfText', { timeout: 4000 });
  r.check('der Knopf öffnet den Einfügen-Bildschirm', geklickt);

  await A.page.fill('#einfText', AUS_WORD);
  const nochNichts = await A.page.evaluate(`(function(){
    return (ADDITIONS.entries[${JSON.stringify(start.sid)}+'|'+${start.ri}]||[]).length;
  })()`);
  r.check('vom bloßen Einfügen entsteht noch NICHTS', nochNichts === start.vorher);

  await A.page.click('#sheet .btn-pri');
  await A.page.waitForSelector('#sheet .einf-zeile', { timeout: 4000 });
  const geprueft = await A.page.evaluate(`(function(){
    const z=[...document.querySelectorAll('#sheet .einf-zeile')];
    return { n:z.length,
      namen:[...document.querySelectorAll('#sheet .einf-name')].map(i=>i.value),
      mengen:[...document.querySelectorAll('#sheet .einf-menge')].map(i=>i.value),
      ueber:document.querySelectorAll('#sheet .einf-zeile.einf-ueber').length,
      dublette:document.querySelectorAll('#sheet .einf-tag.einf-warn').length,
      angehakt:z.filter(x=>x.querySelector('input[type=checkbox]').checked).length,
      knopf:(document.getElementById('einfBtn')||{}).textContent||'' };
  })()`);
  r.check(`aus 9 Word-Zeilen werden ${geprueft.n} echte Zeilen (Leerzeilen weg)`, geprueft.n === 7);
  r.check('Spiegelstriche, Nummern und Tabulatoren sind weg',
    geprueft.namen[1] === 'E2E Radialschleuse 6F' && geprueft.namen[5] === 'E2E Schleuse einbringen');
  r.check('die Mengen sind erkannt („2x", „10 Stk.")',
    geprueft.mengen.indexOf('2') >= 0 && geprueft.mengen.indexOf('10') >= 0);
  r.check('„Material:" wird als Überschrift vorgeschlagen', geprueft.ueber === 1);
  r.check('die doppelte Zeile ist markiert …', geprueft.dublette >= 1);
  r.check('… und kommt ohne Haken herein — bewusste Entscheidung', geprueft.angehakt === 6);
  r.check('der Knopf sagt, wie viele es werden', /\(6\)/.test(geprueft.knopf));

  /* ═══════════ 3. Korrigieren, abwählen, umschalten ═══════════ */
  const felder = await A.page.$$('#sheet .einf-name');
  await felder[2].fill('E2E Führungsdraht 0.035 J');
  await A.page.waitForTimeout(120);
  const abwahl = await A.page.evaluate(`(function(){
    /* Die letzte Zeile abwählen. */
    const boxen=[...document.querySelectorAll('#sheet .einf-zeile input[type=checkbox]')];
    boxen[5].checked=false; boxen[5].dispatchEvent(new Event('change'));
    return { knopf:(document.getElementById('einfBtn')||{}).textContent||'',
      grau:document.querySelectorAll('#sheet .einf-zeile:not(.on)').length,
      geaendert:[...document.querySelectorAll('#sheet .einf-name')][2].value };
  })()`);
  r.check('ein Name lässt sich im Prüfschritt ändern',
    abwahl.geaendert === 'E2E Führungsdraht 0.035 J');
  r.check('eine Zeile lässt sich abwählen — der Knopf zählt mit', /\(5\)/.test(abwahl.knopf));
  r.check('… und sie steht sichtbar zurückgenommen da', abwahl.grau === 2);

  const artWechsel = await A.page.evaluate(`(function(){
    /* Die erste echte Zeile zur Überschrift machen — und wieder zurück. */
    const knoepfe=[...document.querySelectorAll('#sheet .einf-art')];
    knoepfe[1].click();
    const alsUeber=document.querySelectorAll('#sheet .einf-zeile.einf-ueber').length;
    [...document.querySelectorAll('#sheet .einf-art')][1].click();
    return { alsUeber, zurueck:document.querySelectorAll('#sheet .einf-zeile.einf-ueber').length };
  })()`);
  r.check('jede Zeile lässt sich zur Überschrift machen …', artWechsel.alsUeber === 2);
  r.check('… und wieder zurück', artWechsel.zurueck === 1);

  /* ═══════════ 4. Zurück zum Text — nichts geht verloren ═══════════ */
  const zurueck = await A.page.evaluate(`(function(){
    einfZurueck();
    const t=document.getElementById('einfText');
    return { textDa:!!t, zeilen:t?t.value.split('\\n').filter(Boolean).length:0 };
  })()`);
  r.check('„← Text ändern" bringt den Text zurück, statt ihn wegzuwerfen',
    zurueck.textDa && zurueck.zeilen === 7);

  await A.page.click('#sheet .btn-pri');
  await A.page.waitForSelector('#sheet .einf-zeile', { timeout: 4000 });

  /* ═══════════ 5. Abbrechen legt nichts an ═══════════ */
  const abbruch = await A.page.evaluate(`(function(){
    einfAbbrechen();
    return { offen:!!EINF, n:(ADDITIONS.entries[${JSON.stringify(start.sid)}+'|'+${start.ri}]||[]).length };
  })()`);
  r.check('Abbrechen hinterlässt nichts', !abbruch.offen && abbruch.n === start.vorher);

  /* ═══════════ 6. Der ganze Weg bis in die Rubrik ═══════════ */
  const drin = await A.page.evaluate(`(function(){
    einfOeffnen(${start.ri});
    document.getElementById('einfText').value = ${JSON.stringify(AUS_WORD)};
    einfUiPruefen();
    const vor = EINF.zeilen.filter(x=>x.an).length;
    einfUiEinfuegen();
    const arr = ADDITIONS.entries[${JSON.stringify(start.sid)}+'|'+${start.ri}]||[];
    return { vor, neu:arr.length - ${start.vorher},
      namen:arr.slice(-6).map(x=>x.anzeige_text),
      naturen:arr.slice(-6).map(x=>x.natur),
      mengen:arr.slice(-6).map(x=>x.menge),
      offen:!!EINF };
  })()`);
  r.check(`aus einer Einfügung entstehen ${drin.neu} echte Einträge`, drin.neu === drin.vor && drin.neu === 6);
  r.check('… die Überschrift ist eine Überschrift geblieben', drin.naturen[0] === 'ueberschrift');
  r.check('… die Mengen sind mitgekommen', drin.mengen.indexOf('2') >= 0 && drin.mengen.indexOf('10') >= 0);
  r.check('… und der Bildschirm ist danach zu', !drin.offen);

  const sichtbar = await A.page.evaluate(`(function(){
    setMode('use'); openStandard(${JSON.stringify(start.sid)}); openRubrik(${start.ri});
    const txt=document.getElementById('scr-detail').textContent;
    return { schleuse:/E2E Radialschleuse 6F/.test(txt),
      kompressen:/E2E Kompressen/.test(txt),
      punktion:/E2E Punktion A\\. radialis/.test(txt),
      ueberschrift:/E2E|Material/.test(txt) };
  })()`);
  r.check('die eingefügten Zeilen stehen wirklich in der Rubrik',
    sichtbar.schleuse && sichtbar.kompressen && sichtbar.punktion);

  /* ═══════════ 7. Der stille Gewinn: gleiche Schreibweise ═══════════ */
  const gleich = await A.page.evaluate(`(function(){
    setMode('admin');
    einfOeffnen(${start.ri});
    document.getElementById('einfText').value = 'e2e radialschleuse 6f\\nGANZ NEUES DING E2E';
    einfUiPruefen();
    const z = EINF.zeilen.map(x=>({name:x.name, bekannt:!!x.bekannt}));
    einfAbbrechen();
    return { z };
  })()`);
  r.check('DER GEWINN: ein bekannter Name wird auf die vorhandene Schreibweise gezogen',
    gleich.z[0].name === 'E2E Radialschleuse 6F' && gleich.z[0].bekannt);
  r.check('… und was neu ist, bleibt wie getippt',
    gleich.z[1].name === 'GANZ NEUES DING E2E' && !gleich.z[1].bekannt);

  /* ═══════════ 8. Leerer Text führt zu nichts ═══════════ */
  const leer = await A.page.evaluate(`(function(){
    einfOeffnen(${start.ri});
    document.getElementById('einfText').value = '   \\n\\n  \\n';
    einfUiPruefen();
    const nochImText = EINF && EINF.schritt==='text';
    einfAbbrechen();
    return { nochImText };
  })()`);
  r.check('leerer Text bleibt im Textfeld stehen, statt eine leere Prüfliste zu zeigen', leer.nochImText);

  r.check('keine Konsolenfehler', A.errs.length === 0);
  if (A.errs.length) console.error(A.errs.slice(0, 5));
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
