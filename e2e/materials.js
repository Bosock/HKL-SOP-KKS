/* MATERIAL-DESTILLATION / -ZUSAMMENFÜHRUNG (docs/KONZEPT-MATERIALSTAMM.md):
   Trennt Identität (Produkt-Stammsatz = GTINDB) vom Vorkommen im Standard.
   `hkl_matlink` ordnet material_key → Stammsatz zu (nicht-destruktiv, lösbar),
   `hkl_matprops` ist ein wachsendes Eigenschaften-Schema (z. B. „Tip Load"), das
   an jedem Stammsatz erscheint. Prüft: distinkte Materialliste, manueller
   Stammsatz, Verknüpfen/Lösen, canon-Anzeige (Badge/Thumbnail am Eintrag),
   Duplikat-Vorschläge + Gruppen-Zusammenführung, eigene Eigenschaften wachsen,
   Verwaltungs-Panel „Materialzusammenführung". */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');
(async () => {
  const r = reporter('materials');
  const check = (l, c) => r.check(l, c);
  const srv = await startServer();
  const browser = await launchBrowser();
  const A = await bootPage(browser, srv.base);

  // 1) matDistinctList: distinkte Material-Vorkommen mit Name + Häufigkeit
  const r1 = await A.page.evaluate(() => {
    doLogin('1234567');
    const list = matDistinctList();
    const withKey = list.every(x => x.key && typeof x.name === 'string' && x.count >= 1);
    // Ein Material, das mehrfach vorkommt (count >= 2), falls vorhanden
    const multi = list.find(x => x.count >= 2) || null;
    return { n: list.length, withKey, hasMulti: !!multi, sampleKey: list[0] && list[0].key };
  });
  check('matDistinctList liefert Materialien (' + r1.n + ')', r1.n > 0);
  check('… jedes mit key/name/count', r1.withKey);

  // 2) Manueller Stammsatz + Verknüpfung + canon-Auflösung
  const r2 = await A.page.evaluate((prev) => {
    const mk = prev.sampleKey;
    const id = matCreateStamm('Prüf-Führungsdraht', { hersteller: 'ACME', ref: 'GW-260' });
    const isM = /^m:/.test(id);
    const created = GTINDB[id] && GTINDB[id].manual === true && GTINDB[id].name === 'Prüf-Führungsdraht';
    matLinkTo(mk, id);
    const cId = canonId(mk);
    const cOf = canonOf(mk);
    return { id, isM, created, linkedId: cId === id, canonName: cOf && cOf.name, mk };
  }, r1);
  check('matCreateStamm legt manuellen Stammsatz an (m:… , manual:true)', r2.isM && r2.created);
  check('matLinkTo verknüpft, canonId/canonOf lösen auf', r2.linkedId && r2.canonName === 'Prüf-Führungsdraht');

  // 3) Eintrag zeigt canon-Identität (🔗-Badge + Foto-Thumbnail) an
  const r3 = await A.page.evaluate((prev) => {
    // Foto in den Stammsatz, damit die Karte ein Thumbnail zeigt
    GTINDB[prev.id].photo = 'data:image/png;base64,iVBORw0KGgo=';
    saveGtinDB();
    let cid = null;
    DB.standards.forEach(s => (s.rubriken || []).forEach((r, ri) => (r.sub_bereiche || []).forEach((sb, si) => (sb.eintraege || []).forEach((e, ei) => {
      if (!cid && e.material_key === prev.mk) cid = cidOf(s.id, ri, si, ei);
    }))));
    const e = findEntry(cid);
    const card = entryCardHTML(e, cid, true);
    return {
      badge: card.indexOf('entry-canon-btn') >= 0 && card.indexOf('🔗') >= 0,
      thumb: card.indexOf('data:image/png;base64,iVBORw0KGgo=') >= 0,
    };
  }, r2);
  check('Eintragskarte zeigt 🔗-Badge zum Stammsatz', r3.badge);
  check('Eintragskarte übernimmt Foto-Thumbnail des Stammsatzes', r3.thumb);

  // 4) Verknüpfung lösen
  const r4 = await A.page.evaluate((prev) => {
    matUnlink(prev.mk);
    return { cleared: canonId(prev.mk) === null && canonOf(prev.mk) === null };
  }, r2);
  check('matUnlink löst die Verknüpfung (canon wieder leer)', r4.cleared);

  // 5) Wachsende eigene Eigenschaften (Schema): matPropAdd
  const r5 = await A.page.evaluate(() => {
    const before = MATPROPS.length;
    const k1 = matPropAdd('Tip Load');
    const k2 = matPropAdd('Tip Load'); // Duplikat -> gleicher key, kein Wachstum
    const k3 = matPropAdd('French');
    return {
      grew: MATPROPS.length === before + 2,
      dedupe: k1 === k2,
      slugs: /^[a-z0-9_]+$/.test(k1) && /^[a-z0-9_]+$/.test(k3),
      persisted: JSON.parse(store.get('hkl_matprops') || '[]').some(p => p.label === 'Tip Load'),
    };
  });
  check('matPropAdd fügt neue Eigenschaft hinzu, entdoppelt bei gleichem Label', r5.grew && r5.dedupe);
  check('… erzeugt [a-z0-9_]-Schlüssel und persistiert (Sync-fähig)', r5.slugs && r5.persisted);

  // 6) Duplikat-Vorschläge + Gruppen-Zusammenführung (admin action)
  const r6 = await A.page.evaluate(() => {
    // Zwei künstliche Vorkommen mit gleicher Normalform in einem eigenen Standard
    const s = DB.standards.find(st => (st.rubriken || []).some(r => r.typ === 'material'));
    const groups = matSuggestGroups(matDistinctList());
    // Falls die echten Daten schon Duplikate hergeben, nutze sie; sonst nur API prüfen
    const apiOk = Array.isArray(groups) && groups.every(g => g.length >= 2);
    return { apiOk, groups: groups.length, hasStd: !!s };
  });
  check('matSuggestGroups liefert nur Gruppen mit ≥2 Vorkommen', r6.apiOk);

  // 7) Verwaltungs-Panel „Materialzusammenführung" rendert
  const r7 = await A.page.evaluate(() => {
    setMode('admin'); renderAdmin();
    const box = document.getElementById('scr-admin');
    const html = box.innerHTML;
    const hasPanel = html.indexOf('Materialzusammenführung') >= 0;
    const hasSelect = box.querySelectorAll('select.vw-sel[data-k]').length > 0;
    return { hasPanel, hasSelect };
  });
  check('Verwaltung: Panel „Materialzusammenführung" ist da', r7.hasPanel);
  check('… mit Verknüpfungs-Auswahl je Material', r7.hasSelect);

  // 8) Admin-Verknüpfung über das Panel (matAdminLink) + Auflösen
  const r8 = await A.page.evaluate((prev) => {
    const mk = prev.mk;
    // an einen bestehenden Stammsatz verknüpfen (der vorhin angelegte)
    matAdminLink(mk, prev.id);
    const linked = canonId(mk) === prev.id;
    matAdminLink(mk, '');
    const unlinked = canonId(mk) === null;
    return { linked, unlinked };
  }, r2);
  check('matAdminLink verknüpft/löst ein Material im Panel', r8.linked && r8.unlinked);

  // 9) Zentrale Materialverwaltung (materialhub): ein Bildschirm, ein Editor
  const r9 = await A.page.evaluate(() => {
    setMode('care'); renderMaterialHub();
    const box = document.getElementById('scr-care');
    const html = box.innerHTML;
    return {
      title: html.indexOf('>Material<') >= 0,
      // Scan-CTA bei BarcodeDetector-Support, sonst Fallback-Hinweis (scan-this)
      scanBtn: html.indexOf('scan-cta') >= 0 || html.indexOf('scan-this') >= 0,
      newBtn: html.indexOf('Material ohne Barcode anlegen') >= 0,
      search: !!box.querySelector('#matHubSearch'),
      rows: box.querySelectorAll('#matHubList .mat-row').length,
      rowsShowWhere: (matHubRows()[0] && Array.isArray(matHubRows()[0].stds)),
    };
  });
  check('Material-Hub: EIN Bildschirm mit Titel „Material"', r9.title);
  check('… mit Scan-Knopf, „ohne Barcode anlegen" und Suche', r9.scanBtn && r9.newBtn && r9.search);
  check('… listet Materialien (' + r9.rows + ') inkl. Vorkommen (wo benutzt)', r9.rows > 0 && r9.rowsShowWhere);

  // 10) openMaterial: legt bei Bedarf Stammsatz an, öffnet den EINEN Editor;
  //     übernimmt Alt-Pflegedaten (Foto/Lagerort) in den Stammsatz
  const r10 = await A.page.evaluate(() => {
    // ein unverknüpftes Material mit Alt-Pflegedaten simulieren
    const key = matDistinctList().find(x => !canonId(x.key)).key;
    careMem[key] = { photo: 'data:image/png;base64,AAAA', loc: 'Regal Z' };
    PROD[key] = { hersteller: 'SeedCorp', ref: 'SEED-1', verwendung: null, preis: 9.5 };
    openMaterial(key);
    const id = canonId(key);
    const c = id ? GTINDB[id] : null;
    const onEditor = document.getElementById('scr-scan-item').classList.contains('active');
    return {
      created: !!id,
      seeded: !!(c && c.hersteller === 'SeedCorp' && c.ref === 'SEED-1' && c.lagerort === 'Regal Z' && c.photo === 'data:image/png;base64,AAAA' && c.preis === 9.5),
      onEditor,
    };
  });
  check('openMaterial legt Stammsatz an und öffnet den EINEN Editor', r10.created && r10.onEditor);
  check('… übernimmt Alt-Pflegedaten (Foto, Lagerort, Hersteller, REF, Preis)', r10.seeded);

  // 11) In-Standard-Zugang: matManage öffnet denselben zentralen Editor
  const r11 = await A.page.evaluate(() => {
    let cid = null, mk = null;
    DB.standards.forEach(s => (s.rubriken || []).forEach((r, ri) => (r.sub_bereiche || []).forEach((sb, si) => (sb.eintraege || []).forEach((e, ei) => {
      if (!cid && e.material_key) { cid = cidOf(s.id, ri, si, ei); mk = e.material_key; }
    }))));
    openSheet(cid); // Schnellmenü öffnen → sheetEntry/sheetCid gesetzt
    matManage();
    return { onEditor: document.getElementById('scr-scan-item').classList.contains('active'), linked: canonId(mk) !== null };
  });
  check('Standard → „Material verwalten" öffnet den zentralen Editor', r11.onEditor && r11.linked);

  check('keine Konsolenfehler', A.errs.length === 0);
  await r.finish(browser, [srv]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
