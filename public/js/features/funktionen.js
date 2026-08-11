/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — FUNKTIONSREGISTER

   Die Forderung, die dahintersteht, ist eine einzige und sie ist absolut:

     „alles muss so gebaut sein, dass Konfiguration, Erweiterbarkeit,
      Anpassung usw. ohne KI und ohne Code-Kontakt in jedem einzelnen Button
      und jeder Funktion möglich ist — ich muss alles erweitern und anpassen
      können, Funktionen hinzufügen und wegnehmen."

   Bis hierher war das für INHALTE erfüllt (Standards, Rubriken, Einträge,
   Kategorien, Bezeichnungen, Pop-ups, Anleitungen, Merkmale) — aber nicht für
   die App selbst. Welche Punkte im Menü stehen, in welcher Reihenfolge, wie
   sie heißen, welche Verwaltungs-Karten sichtbar sind: das stand im Quelltext.
   Wer im Labor eine Funktion nicht braucht, musste sie trotzdem ansehen; wer
   einen eigenen Punkt wollte, brauchte einen Entwickler.

   ── Was hier passiert ──
   Jeder Menüpunkt und jede Verwaltungs-Karte bekommt einen SCHLÜSSEL. Über den
   Schlüssel lassen sich in der Verwaltung ändern:

       an/aus · Symbol · Name · Untertitel · Reihenfolge

   Und es lassen sich EIGENE Menüpunkte anlegen, die auf einen Standard, eine
   Anleitung, einen Bildschirm der App oder eine Adresse zeigen.

   ── Wie das mit den Grundsätzen zusammenpasst ──
   ④ Kein Fachwort im Code: Der Schlüssel ist maschinenlesbar ('glossar'), das
     Wort daneben ist Bezeichnung ('Abkürzungsglossar') und frei änderbar.
   ⑤ Alles konfigurierbar: dieselbe Vier-Stufen-Auflösung wie bei den
     Bezeichnungen — eigene Änderung schlägt Vorgabe im Code.
   ③ Der Mensch schlägt alles: Was jemand eingestellt hat, wird von keiner
     Auslieferung überschrieben. Ein neuer Menüpunkt aus einer neuen Fassung
     erscheint zusätzlich, an seinem vorgesehenen Platz.
   ⑦ Nichts wird gelöscht: „aus" heißt unsichtbar, nicht weg — jederzeit
     rücknehmbar, ohne dass jemand die Vorgabe kennen muss.

   ── Die eine Grenze, bewusst gezogen ──
   Vier Punkte lassen sich NICHT abschalten: Verwaltung, Anmelden/Abmelden,
   „Problem melden" und dieses Register selbst. Wer sie ausblenden könnte,
   könnte sich selbst aus der App aussperren — mit einem Tipp und ohne Weg
   zurück. Alles andere ist frei.
   ───────────────────────────────────────────────────────────── */

/* ═══════════ 1. Das Register ═══════════ */

/* Ein Menüpunkt der Vorgabe:
     key    Schlüssel (unveränderlich, trägt die Bedeutung)
     ico    Symbol            } beides Bezeichnung — frei änderbar
     label  Name              }
     sub    Untertitel (Funktion darf ihn dynamisch liefern)
     tun    was beim Antippen passiert (Zeichenkette, wie bisher im Menü)
     nur    'alle' | 'admin' | 'gast'  — wem der Punkt überhaupt angeboten wird
     fest   true = nicht abschaltbar (siehe Kopf) */
const FKT_MENUE = [
  { key:'standards',   ico:'📋', label:'Alle Standards',        sub:'Übersicht',                                  tun:"menuGo('use')",                              nur:'alle' },
  { key:'suche',       ico:'🔎', label:'Globale Suche',         sub:'Material, Gerät, Synonym …',                 tun:"showSheet(false);openGlobalSearch()",        nur:'alle' },
  { key:'glossar',     ico:'📖', label:'Abkürzungsglossar',     sub:'Begriffe nachschlagen',                      tun:"showSheet(false);openGlossary()",            nur:'alle' },
  { key:'anleitung',   ico:'🧭', label:'Anleitung',             sub:'Schritt für Schritt, mit Bildern',           tun:"showSheet(false);openAnleitung()",           nur:'alle' },
  { key:'vorschlaege', ico:'✍️', label:'Änderungsvorschläge',   sub:'ansehen & bewerten',                         tun:"showSheet(false);openSuggestions()",         nur:'alle',
    zahl:()=> (typeof pendingSuggestions==='function') ? pendingSuggestions().length : 0, zahlText:(n)=> n?(n+' offen'):'ansehen & bewerten' },
  { key:'material',    ico:'🧬', label:'Material & Einträge',   sub:'Der eine Ort: erfassen · pflegen · zuordnen · ordnen · prüfen', tun:"menuGo('care')", nur:'admin' },
  { key:'scannen',     ico:'📷', label:'Etikett scannen',       sub:'Produkt per Barcode erfassen & finden',      tun:"showSheet(false);openScanHub()",             nur:'gast' },
  { key:'popups',      ico:'💬', label:'Pop-up-Dialoge',        sub:'Abfragen beim Abhaken frei einstellen',      tun:"showSheet(false);openPopupAdmin()",          nur:'admin' },
  { key:'varianten',   ico:'👤', label:'Ärzte & Varianten',     sub:'arztspezifische Abweichungen pflegen',       tun:"showSheet(false);openVariantAdmin()",        nur:'admin' },
  { key:'verwaltung',  ico:'🛠️', label:'Verwaltung',            sub:'Einstellungen & Bearbeitung',                tun:"menuGo('admin')",                            nur:'admin', fest:true },
  { key:'passwort',    ico:'🔑', label:'Passwort ändern',       sub:'',                                           tun:"changePw()",                                 nur:'admin' },
  { key:'abmelden',    ico:'🚪', label:'Abmelden',              sub:'Verwaltungsmodus beenden',                   tun:"adminLogout()",                              nur:'admin', fest:true },
  { key:'anmelden',    ico:'🔒', label:'Anmelden',              sub:'Verwaltung freischalten',                    tun:"promptLogin()",                              nur:'gast',  fest:true },
  { key:'melden',      ico:'🐞', label:'Problem melden',        sub:'Etwas geht nicht? Zwei Sätze genügen',       tun:"showSheet(false);diagMeldenForm()",          nur:'alle',  fest:true },
  { key:'diagnose',    ico:'🩺', label:'Diagnose & Fehler',     sub:'Protokoll & Selbsttest',                     tun:"showSheet(false);openDiag()",                nur:'admin',
    zahl:()=> (typeof DIAG!=='undefined'&&Array.isArray(DIAG)) ? DIAG.filter(e=>e.art==='fehler'||e.art==='meldung').length : 0,
    zahlText:(n)=> n?(n+' Einträge im Protokoll'):'Protokoll & Selbsttest' },
  { key:'haken',       ico:'↺',  label:'Alle Häkchen zurücksetzen', sub:'Abhaken dieses Geräts leeren',           tun:"resetAllChecks()",                           nur:'alle' },
  { key:'ansicht',     ico:'◐',  label:'Ansicht hell/dunkel',   sub:'',                                           tun:"toggleTheme();showSheet(false)",             nur:'alle' },
];

/* Die eigenen Änderungen. Aufbau:
     { menue:{ key:{aus,ico,label,sub,ord} },
       panel:{ key:{aus,ico,label,sub,ord} },
       eigene:[ {key,ico,label,sub,art,wert,nur,ord} ] }
   art: 'standard' | 'seite' | 'bildschirm' | 'adresse' */
let FKT = (typeof loadJSON==='function') ? loadJSON('hkl_funktionen', {}) : {};
function fktNormalisieren(){
  if(!FKT || typeof FKT!=='object') FKT = {};
  if(!FKT.menue || typeof FKT.menue!=='object') FKT.menue = {};
  if(!FKT.panel || typeof FKT.panel!=='object') FKT.panel = {};
  if(!Array.isArray(FKT.eigene)) FKT.eigene = [];
}
fktNormalisieren();
function saveFKT(){ fktNormalisieren(); if(typeof saveJSON==='function') saveJSON('hkl_funktionen', FKT); }

/* Eine Einstellung lesen: eigene Änderung vor Vorgabe. */
function fktWert(bereich, key, feld, vorgabe){
  fktNormalisieren();
  const e = FKT[bereich] && FKT[bereich][key];
  if(e && e[feld]!==undefined && e[feld]!==null && e[feld]!=='') return e[feld];
  return vorgabe;
}
function fktAus(bereich, key){
  fktNormalisieren();
  const e = FKT[bereich] && FKT[bereich][key];
  return !!(e && e.aus);
}
/* Eine Einstellung setzen. Ein LEERER Wert löscht die eigene Änderung — dann
   gilt wieder die Vorgabe, ohne dass jemand sie kennen muss. */
function fktSetzen(bereich, key, feld, wert){
  fktNormalisieren();
  const leer = (wert===null || wert===undefined || wert==='');
  const b = FKT[bereich] = FKT[bereich] || {};
  if(leer){ if(b[key]){ delete b[key][feld]; if(!Object.keys(b[key]).length) delete b[key]; } }
  else { (b[key]=b[key]||{})[feld]=wert; }
  saveFKT();
}
function fktZuruecksetzen(bereich, key){
  fktNormalisieren();
  if(FKT[bereich]) delete FKT[bereich][key];
  saveFKT();
}
function fktGeaendert(bereich, key){
  fktNormalisieren();
  const e = FKT[bereich] && FKT[bereich][key];
  return !!(e && Object.keys(e).length);
}

/* ═══════════ 2. Das Menü ═══════════ */

/* Schlüssel eines EIGENEN Punktes — eindeutig und stabil. */
function fktNeuerSchluessel(){
  fktNormalisieren();
  let n = 1;
  const belegt = {};
  FKT.eigene.forEach(x=>{ belegt[x.key]=1; });
  while(belegt['eigen'+n]) n++;
  return 'eigen'+n;
}

/* Was ein eigener Punkt beim Antippen tut. Bewusst NUR vier Arten — jede
   davon führt in die App zurück, keine kann etwas kaputt machen. */
function fktEigenTun(e){
  const w = String(e && e.wert || '');
  const q = JSON.stringify(w);
  if(e.art==='standard')   return "showSheet(false);openStandardById("+q+")";
  if(e.art==='seite')      return "showSheet(false);fktSeiteOeffnen("+q+")";
  if(e.art==='adresse')    return "showSheet(false);fktAdresseOeffnen("+q+")";
  if(e.art==='bildschirm') return "showSheet(false);fktBildschirm("+q+")";
  return "showSheet(false)";
}
function fktSeiteOeffnen(datei){
  try{ window.open(datei, '_blank', 'noopener'); }catch(e){}
}
/* Nur http(s) und nur in einem neuen Fenster — keine javascript:-Adressen. */
function fktAdresseOeffnen(url){
  const u = String(url||'').trim();
  if(!/^https?:\/\//i.test(u)){ if(typeof toast==='function') toast('Nur Adressen mit http:// oder https://',true); return; }
  try{ window.open(u, '_blank', 'noopener'); }catch(e){}
}
/* Die Bildschirme, die ein eigener Punkt ansteuern darf. Eine feste Liste —
   ein freier Funktionsname wäre eine offene Tür in den Quelltext. */
const FKT_BILDSCHIRME = [
  { key:'standards', label:'Alle Standards',      tun:()=>menuGo('use') },
  { key:'suche',     label:'Globale Suche',       tun:()=>{ if(typeof openGlobalSearch==='function') openGlobalSearch(); } },
  { key:'glossar',   label:'Abkürzungsglossar',   tun:()=>{ if(typeof openGlossary==='function') openGlossary(); } },
  { key:'scannen',   label:'Etikett scannen',     tun:()=>{ if(typeof openScanHub==='function') openScanHub(); } },
  { key:'material',  label:'Material & Einträge', tun:()=>menuGo('care') },
  { key:'anleitung', label:'Anleitung',           tun:()=>openAnleitung() },
];
function fktBildschirm(key){
  const b = FKT_BILDSCHIRME.find(x=>x.key===key);
  if(b) b.tun();
}

/* Die bebilderte Anleitung — eine eigenständige Seite neben der App. Der
   Service Worker legt sie beim ersten Öffnen ab, danach ist sie offline da. */
function openAnleitung(){ fktSeiteOeffnen('anleitung.html'); }

/* Die aufgelöste Menüliste: Vorgabe + eigene Punkte, gefiltert, sortiert. */
function fktMenueListe(istAdmin){
  fktNormalisieren();
  const passt = (nur)=> nur==='alle' || (nur==='admin' && istAdmin) || (nur==='gast' && !istAdmin);
  const aus = [];
  FKT_MENUE.forEach((m,i)=>{
    if(!passt(m.nur)) return;
    if(!m.fest && fktAus('menue', m.key)) return;
    let sub = m.sub;
    if(typeof m.zahl==='function'){ try{ sub = m.zahlText(m.zahl()); }catch(e){} }
    aus.push({ key:m.key, fest:!!m.fest,
      ico:  fktWert('menue', m.key, 'ico',   m.ico),
      label:fktWert('menue', m.key, 'label', m.label),
      sub:  fktWert('menue', m.key, 'sub',   sub),
      tun:  m.tun,
      ord:  Number(fktWert('menue', m.key, 'ord', i)) });
  });
  FKT.eigene.forEach((e,i)=>{
    if(!passt(e.nur||'alle')) return;
    if(fktAus('menue', e.key)) return;
    aus.push({ key:e.key, eigen:true,
      ico:e.ico||'⭐', label:e.label||'Eigener Punkt', sub:e.sub||'',
      tun:fktEigenTun(e), ord:Number(e.ord!=null?e.ord:(FKT_MENUE.length+i)) });
  });
  return aus.sort((a,b)=>(a.ord-b.ord));
}

/* Verschieben: nur die sichtbare Reihenfolge, nichts anderes. Damit ein
   Tausch stabil bleibt, bekommt JEDER Punkt eine Zahl — sonst kollidieren
   verschobene und nicht verschobene Punkte. */
function fktVerschieben(key, richtung, istAdmin){
  const liste = fktMenueListe(istAdmin);
  const i = liste.findIndex(x=>x.key===key);
  const j = i + (richtung<0?-1:1);
  if(i<0 || j<0 || j>=liste.length) return false;
  const um = liste.slice();
  const t = um[i]; um[i]=um[j]; um[j]=t;
  um.forEach((x,k)=>{
    const eigen = FKT.eigene.find(e=>e.key===x.key);
    if(eigen) eigen.ord = k; else fktSetzen('menue', x.key, 'ord', k);
  });
  saveFKT();
  return true;
}

/* ═══════════ 3. Die Bearbeiten-Menüs (⋯) ═══════════

   Das ⋯-Menü ist DAS Menü der App (Grundsatz ⑥: ein Menü, zwei Kontexte) und
   damit die Fläche, die im Saal am häufigsten angefasst wird. Genau deshalb
   muss sie dem Haus gehören: Wer „Spezifikation bearbeiten" nie braucht, soll
   es nicht jedes Mal überlesen müssen; wer „Größen" lieber „Maße" nennt, soll
   es umbenennen können.

   Der Katalog unten ist die VOLLSTÄNDIGE Liste aller Aktionen der drei Menüs
   mit ihren Auslieferungswerten. Er wird maschinell gegen den Quelltext von
   features/quickmenu.js abgeglichen (test/funktionen.test.js) — ein neuer
   Menüpunkt, der hier fehlt, lässt die Tests durchfallen. Sonst wäre der
   Katalog nach dem dritten Umbau stillschweigend unvollständig, und die
   Verwaltung zeigte weniger, als es gibt.

   Ganze GRUPPEN lassen sich mit einem Schalter abräumen ('sheetgruppe') —
   „Gefahrenzone aus" nimmt Löschen und Zurücksetzen in einem Zug aus dem
   Menü. */

const FKT_SHEET_KATALOG = {
  eintrag: {
    titel: 'Eintrag (⋯ an der Zeile)',
    gruppen: [
      { key:'kopf', titel:'', sub:'', akt:[
        { key:'warum',        ico:'🔍',  label:'Warum so?',              sub:'zeigt, woher Name, Kategorie, Farbe & Co. kommen' },
        { key:'baustein',     ico:'⛓️',  label:'Gehört zum Baustein',    sub:'Hinweis, wenn die Zeile mehrfach gepflegt wird' },
      ]},
      { key:'inhalt', titel:'Inhalt', sub:'Was der Eintrag ist', akt:[
        { key:'details',      ico:'✏️',  label:'Details bearbeiten',     sub:'Name, Menge, Größe, Kategorie, Warum …' },
        { key:'umbenennen',   ico:'🔤',  label:'Schnell umbenennen',     sub:'nur den Anzeigenamen' },
        { key:'menge',        ico:'#️⃣',  label:'Menge ändern',           sub:'zeigt die aktuelle Menge' },
        { key:'groessen',     ico:'📏',  label:'Größen bearbeiten',      sub:'nur bei beschaffbarem Material' },
        { key:'spez',         ico:'🧷',  label:'Spezifikation bearbeiten', sub:'nur bei beschaffbarem Material' },
      ]},
      { key:'darstellung', titel:'Darstellung', sub:'Wie er auffällt', akt:[
        { key:'wichtig',      ico:'⭐',  label:'Als wichtig markieren',  sub:'hervorheben' },
        { key:'mengehi',      ico:'🔢',  label:'Zahl/Menge hervorheben', sub:'automatisch bei ungleich 1x' },
        { key:'farbe',        ico:'🎨',  label:'Farblich absetzen',      sub:'eigene Akzentfarbe' },
        { key:'bilder',       ico:'🖼️',  label:'Bilder',                 sub:'Foto, Bildfolge oder Skizze hinzufügen' },
        { key:'schrift',      ico:'🔠',  label:'Schrift & Auszeichnung', sub:'Größe und Gewicht der Zeile, Wörter hervorheben' },
      ]},
      { key:'organisation', titel:'Organisation', sub:'Wohin er gehört', akt:[
        { key:'kategorie',    ico:'🏷️',  label:'Kategorie ändern',       sub:'zeigt die aktuelle Kategorie' },
        { key:'uk',           ico:'🗂️',  label:'Unterkategorie ändern',  sub:'Gruppe zuweisen' },
        { key:'bereich',      ico:'📍',  label:'Bereich',                sub:'zweite Sicht: steriler Tisch, Umfeld …' },
        { key:'alternativen', ico:'⇄',   label:'Alternativen',           sub:'Material, das stattdessen geht' },
        { key:'material',     ico:'🧬',  label:'Material öffnen',        sub:'Angaben, Etikett scannen, Foto' },
        { key:'pflege',       ico:'🧹',  label:'Pflege-Weg ab hier',     sub:'dieses Material fertig pflegen, dann das nächste' },
        { key:'bestellen',    ico:'🛒',  label:'„ist leer" melden',      sub:'landet auf der Bestell-Seite — mit Kürzel und Uhrzeit' },
        { key:'eigenefelder', ico:'＋',  label:'Eigene Felder',          sub:'Zusatz-Infos als Badges am Eintrag' },
        { key:'verschieben',  ico:'📦',  label:'Verschieben',            sub:'in andere Rubrik oder anderen Standard' },
        { key:'hoch',         ico:'⬆',   label:'Nach oben',              sub:'Reihenfolge in der Gruppe' },
        { key:'runter',       ico:'⬇',   label:'Nach unten',             sub:'Reihenfolge in der Gruppe' },
        { key:'katalog',      ico:'📥',  label:'In Katalog aufnehmen',   sub:'für andere Standards verfügbar' },
        { key:'sammeln',      ico:'＋',  label:'In Baustein übernehmen', sub:'sammeln und später zu einem Baustein machen' },
      ]},
      { key:'gefahr', titel:'Gefahrenzone', sub:'Entfernen & zurücksetzen', akt:[
        { key:'loeschen',     ico:'🗑️',  label:'Ausblenden',              sub:'aus der Anzeige nehmen — über die Verwaltung wiederherstellbar' },
        { key:'endgueltig',   ico:'🗑',   label:'Endgültig entfernen',    sub:'weg — und NICHT unter „Ausgeblendete Einträge" wiederherstellbar' },
        { key:'zuruecksetzen',ico:'↺',   label:'Änderungen zurücksetzen', sub:'für diesen Eintrag' },
      ]},
    ],
  },
  standard: {
    titel: 'Standard (Titelzeile)',
    gruppen: [
      { key:'inhalt', titel:'Inhalt', sub:'Titel, Gruppe & Freigabe', akt:[
        { key:'titel',        ico:'✏️',  label:'Titel & Gruppe',         sub:'Name und Zuordnung' },
        { key:'merkmale',     ico:'🏷',  label:'Merkmale',               sub:'z. B. sedierungspflichtig' },
        { key:'bilder',       ico:'🖼️',  label:'Bilder am Standard',     sub:'Fotos im Kopf des Standards' },
        { key:'freigabe',     ico:'🏷️',  label:'Freigabe prüfen & erteilen', sub:'Siegel, Version, Gültigkeit' },
        { key:'festschreiben',ico:'📚',  label:'Stand festschreiben',    sub:'die App wird zur Grundlage' },
        { key:'pflege',       ico:'🧹',  label:'Pflege-Weg für diesen Standard', sub:'Material für Material durchgehen' },
      ]},
      { key:'kopieren', titel:'Neuen Standard daraus machen', sub:'Kopieren statt abtippen', akt:[
        { key:'duplizieren',  ico:'⧉',   label:'Duplizieren',            sub:'vollständige, unabhängige Kopie als Entwurf' },
        { key:'segment',      ico:'＋',  label:'Segment hinzufügen',     sub:'neue Rubrik in diesem eigenen Standard' },
      ]},
      { key:'gefahr', titel:'Gefahrenzone', sub:'Ausblenden & löschen', akt:[
        { key:'ausblenden',   ico:'🗑️',  label:'Ausblenden',             sub:'aus der Nutzung nehmen (wiederherstellbar)' },
        { key:'endgueltig',   ico:'🗑️',  label:'Endgültig löschen',      sub:'App-eigenen Standard samt Einträgen entfernen' },
      ]},
    ],
  },
  rubrik: {
    titel: 'Rubrik (Abschnitts-Kopf)',
    gruppen: [
      { key:'inhalt', titel:'Inhalt', sub:'Name & Symbol', akt:[
        { key:'umbenennen',   ico:'✏️',  label:'Umbenennen',             sub:'nur diese Rubrik in diesem Standard' },
        { key:'symbol',       ico:'🔣',  label:'Symbol ändern',          sub:'gilt für ALLE Rubriken dieses Namens' },
        { key:'bilder',       ico:'🖼️',  label:'Bilder an der Rubrik',   sub:'Foto oder Skizze — der Weg zum ersten Bild' },
      ]},
      { key:'organisation', titel:'Organisation', sub:'Reihenfolge & Geltung', akt:[
        { key:'hoch',         ico:'⬆',   label:'Nach oben',              sub:'Reihenfolge im Standard' },
        { key:'runter',       ico:'⬇',   label:'Nach unten',             sub:'Reihenfolge im Standard' },
        { key:'geltung',      ico:'🌐',  label:'Geltungsbereich',        sub:'in welchen Standards die Rubrik erscheint' },
      ]},
      { key:'gefahr', titel:'Gefahrenzone', sub:'Häkchen & Ausblenden', akt:[
        { key:'haken',        ico:'♻️',  label:'Häkchen zurücksetzen',   sub:'die Tages-Häkchen dieser Rubrik' },
        { key:'ausblenden',   ico:'🗑️',  label:'Ausblenden',             sub:'aus der Anzeige nehmen (wiederherstellbar)' },
      ]},
    ],
  },
};

/* Der Sammler, den quickmenu.js benutzt. Er nimmt Gruppen und Aktionen
   entgegen, wendet die Einstellungen an und gibt am Ende das Markup zurück.

   Warum sammeln statt direkt anhängen: Nur so lässt sich INNERHALB einer
   Gruppe umsortieren. Über Gruppengrenzen hinweg wird bewusst nicht sortiert —
   sonst stünde „Endgültig löschen" plötzlich unter „Inhalt", und die
   Gefahrenzone wäre keine mehr. */
function fktSheetBauer(bereich){
  const gruppen = [];
  let lauf = 0;
  const letzte = ()=>{
    if(!gruppen.length) gruppen.push({ key:'', titel:'', sub:'', akt:[] });
    return gruppen[gruppen.length-1];
  };
  return {
    gruppe(key, titel, sub){
      const voll = bereich+'.'+key;
      gruppen.push({ key,
        titel: fktWert('sheetgruppe', voll, 'label', titel),
        sub:   fktWert('sheetgruppe', voll, 'sub', sub),
        aus:   fktAus('sheetgruppe', voll),
        akt: [] });
    },
    akt(key, ico, label, sub, fn, cls){
      const voll = bereich+'.'+key;
      if(fktAus('sheet', voll)) return;
      letzte().akt.push({ key,
        ord: Number(fktWert('sheet', voll, 'ord', lauf++)),
        html: sAct(fktWert('sheet', voll, 'ico', ico),
                   fktWert('sheet', voll, 'label', label),
                   fktWert('sheet', voll, 'sub', sub), fn, cls) });
    },
    html(){
      let h = '', n = 0;
      gruppen.forEach(g=>{
        if(g.aus || !g.akt.length) return;
        const akt = g.akt.slice().sort((a,b)=>a.ord-b.ord);
        if(g.titel) h += sGroup(g.titel, g.sub);
        h += akt.map(a=>a.html).join('');
        n += akt.length;
      });
      /* Ein leeres Menü darf nicht wie ein Fehler aussehen — es ist eine
         Einstellung, und der Weg zurück muss dastehen. */
      if(!n) h = '<p class="hint" style="padding:12px">Für dieses Menü sind alle Punkte ausgeblendet. Wieder einschalten unter &#9776; &rarr; „Menü &amp; Funktionen".</p>';
      return h;
    },
  };
}

/* ═══════════ 3a. Die Kopfleiste ═══════════
   Die vier kleinen Symbole oben rechts sind ebenfalls Funktionen — und drei
   davon gibt es zusätzlich im Menü. Wer sie nicht braucht, gewinnt Platz in
   der schmalsten Zeile der App. ☰ und „Zurück" bleiben: ohne sie käme man
   nirgendwo mehr hin. */
const FKT_KOPF = [
  { key:'suche',   ico:'🔎', label:'Lupe (alles durchsuchen)', sub:'steht auch im Menü' },
  { key:'auth',    ico:'🔓', label:'GitHub-Anmeldung',         sub:'nur für die Wartung nötig' },
  { key:'ansicht', ico:'◐',  label:'Hell/Dunkel',              sub:'steht auch im Menü' },
];
/* Wird nach jedem Moduswechsel und beim Start angewandt (ui/chrome.js). */
function fktKopfAnwenden(){
  FKT_KOPF.forEach(k=>{
    const el = (typeof $==='function') ? $(k.key==='suche'?'searchBtn':(k.key==='auth'?'authBtn':'themeBtn')) : null;
    if(!el) return;
    if(fktAus('kopf', k.key)) el.hidden = true;
    else if(el.hidden) el.hidden = false;
  });
}

/* ═══════════ 3b. Die Merkmalsleiste der Startseite ═══════════
   Die Leiste wurde im UX-Audit als „zu groß" bemängelt — auf dem Tablet füllt
   sie fast den ersten Bildschirm. Statt sie kleiner zu raten: Jedes Merkmal
   einzeln abschaltbar, damit jedes Haus die zwei bis drei behält, nach denen
   es wirklich sucht. */
function fktFacetteAus(key){ return fktAus('facette', key); }

/* ═══════════ 4. Die Verwaltungs-Karten ═══════════ */

/* Der Schlüssel einer Karte wird aus ihrer Überschrift gewonnen. Das ist
   Absicht: So wird JEDE Karte erfasst — auch die, die es beim Bau dieses
   Registers noch gar nicht gab — ohne dass an einem Dutzend Stellen im
   Quelltext ein Schlüssel nachgetragen werden muss. */
function fktSlug(text){
  let s = String(text==null?'':text).toLowerCase()
    .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
  try{ s = s.normalize('NFD').replace(/[\u0300-\u036f]/g,''); }catch(e){}
  return s.replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
}

/* Die Karten eines Behälters einlesen: [{key,titel,desc,el}] */
function fktPanelListe(box){
  const aus = [];
  if(!box || !box.querySelectorAll) return aus;
  box.querySelectorAll('details.vpanel').forEach(el=>{
    const t = el.querySelector('.vp-title');
    if(!t) return;
    const titel = t.textContent || '';
    const key = fktSlug(titel);
    if(!key) return;
    const d = el.querySelector('.vp-desc');
    aus.push({ key, titel, desc:(d?d.textContent:''), el });
  });
  return aus;
}

/* Einstellungen auf die frisch gezeichnete Verwaltung anwenden: ausblenden,
   umbenennen, umsortieren. Wird am Ende von renderAdmin() aufgerufen. */
function fktPanelAnwenden(box){
  fktNormalisieren();
  const liste = fktPanelListe(box);
  if(!liste.length) return;
  liste.forEach((p,i)=>{
    if(fktAus('panel', p.key)){ p.el.style.display='none'; return; }
    p.el.style.display='';
    const ico = fktWert('panel', p.key, 'ico', null);
    const lab = fktWert('panel', p.key, 'label', null);
    const sub = fktWert('panel', p.key, 'sub', null);
    if(ico){ const e=p.el.querySelector('.vp-ico'); if(e) e.textContent=ico; }
    if(lab){ const e=p.el.querySelector('.vp-title'); if(e) e.textContent=lab; }
    if(sub){ const e=p.el.querySelector('.vp-desc'); if(e) e.textContent=sub; }
  });
  /* Umsortieren nur INNERHALB des jeweiligen Themenblocks — sonst wanderte
     eine Karte aus „Daten & Sicherung" nach „Inhalte pflegen" und die
     Überschriften stimmten nicht mehr. */
  const gruppen = new Map();
  liste.forEach(p=>{
    const el = p.el;
    const eltern = el.parentNode;
    if(!gruppen.has(eltern)) gruppen.set(eltern, []);
    gruppen.get(eltern).push(p);
  });
  gruppen.forEach((ps)=>{
    const mitOrd = ps.map((p,i)=>({ p, ord:Number(fktWert('panel', p.key, 'ord', i)) }));
    const soll = mitOrd.slice().sort((a,b)=>a.ord-b.ord).map(x=>x.p);
    const gleich = soll.every((p,i)=>p===ps[i]);
    if(gleich) return;
    const anker = ps[ps.length-1].el.nextSibling;
    const eltern = ps[0].el.parentNode;
    soll.forEach(p=>{ eltern.insertBefore(p.el, anker); });
  });
}

/* Karte verschieben (nur innerhalb ihres Blocks — die Liste kommt aus dem
   DOM und ist deshalb schon blockweise sortiert). */
function fktPanelVerschieben(key, richtung){
  const box = (typeof $==='function') ? $('scr-admin') : null;
  const alle = fktPanelListe(box);
  const gruppe = alle.filter(p=>{
    const mein = alle.find(x=>x.key===key);
    return mein && p.el.parentNode===mein.el.parentNode;
  });
  const i = gruppe.findIndex(p=>p.key===key);
  const j = i + (richtung<0?-1:1);
  if(i<0 || j<0 || j>=gruppe.length) return false;
  const um = gruppe.slice(); const t=um[i]; um[i]=um[j]; um[j]=t;
  um.forEach((p,k)=> fktSetzen('panel', p.key, 'ord', k));
  return true;
}

/* ═══════════ 5. Bildschirm „Menü & Funktionen" ═══════════ */

let fktForm = null;   /* offene Eingabefläche: {art:'neu'|'bearbeiten', key} */
/* Welches Bearbeiten-Menü ist auf dem Bildschirm gerade aufgeklappt — damit es
   nach einer Änderung nicht zuklappt und man von vorn suchen muss. Reine
   Anzeige, wird nicht geteilt. */
let fktMenuOffen = null;

function openFunktionen(){
  if(typeof ADMIN!=='undefined' && !ADMIN){ if(typeof promptLoginThen==='function') promptLoginThen(openFunktionen); return; }
  fktForm = null;
  renderFunktionen(); show('scr-funktionen');
  if(typeof setBar==='function') setBar('Menü & Funktionen', 'ohne Programmierung', true);
}

function fktZeileHTML(bereich, key, ico, label, sub, aus, fest, extra){
  const g = fktGeaendert(bereich, key);
  return `<div class="fkt-zeile${aus?' fkt-aus':''}">
    <div class="fkt-kopf">
      <input class="loc-input fkt-ico" value="${esc(ico||'')}" data-k="${esc(key)}"
        onchange="fktUiSetzen('${esc(bereich)}',this.dataset.k,'ico',this.value)" aria-label="Symbol">
      <input class="loc-input fkt-name" value="${esc(label||'')}" data-k="${esc(key)}"
        onchange="fktUiSetzen('${esc(bereich)}',this.dataset.k,'label',this.value)" aria-label="Name">
      ${g?'<span class="bez-flag">geändert</span>':''}
    </div>
    <input class="loc-input fkt-sub" value="${esc(sub||'')}" data-k="${esc(key)}"
      onchange="fktUiSetzen('${esc(bereich)}',this.dataset.k,'sub',this.value)" placeholder="Untertitel" aria-label="Untertitel">
    <div class="fkt-akt">
      ${fest
        ? '<span class="fkt-fest">immer sichtbar</span>'
        : `<button class="${aus?'':'on'}" data-k="${esc(key)}" onclick="fktUiSchalten('${esc(bereich)}',this.dataset.k)">${aus?'aus':'an'}</button>`}
      <button data-k="${esc(key)}" onclick="fktUiVerschieben('${esc(bereich)}',this.dataset.k,-1)" aria-label="nach oben">⬆</button>
      <button data-k="${esc(key)}" onclick="fktUiVerschieben('${esc(bereich)}',this.dataset.k,1)" aria-label="nach unten">⬇</button>
      ${g?`<button data-k="${esc(key)}" onclick="fktUiZuruecksetzen('${esc(bereich)}',this.dataset.k)">Vorgabe</button>`:''}
      ${extra||''}
    </div></div>`;
}

function renderFunktionen(){
  const box = $('scr-funktionen'); if(!box) return;
  fktNormalisieren();
  const istAdmin = (typeof ADMIN!=='undefined') ? ADMIN : true;

  let h = `<div class="banner"><h2>🎛 Menü &amp; Funktionen</h2>
    <p>Hier gehört Dir die App selbst: Welche Punkte im Menü stehen, wie sie heißen, welches Symbol sie tragen, in welcher Reihenfolge sie erscheinen — und welche Du gar nicht sehen willst. Nichts davon braucht eine Programmierung.</p>
    <p><b>„aus" heißt unsichtbar, nicht weg.</b> Jede Einstellung ist mit einem Tipp zurückgenommen; „Vorgabe" stellt den Auslieferungszustand wieder her.</p></div>`;

  /* ── Menü ── */
  h += `<div class="bez-sec">Das Menü (☰)</div>`;
  h += `<p class="hint">Vier Punkte bleiben immer sichtbar: Verwaltung, Anmelden/Abmelden und „Problem melden". Wer sie ausblenden könnte, könnte sich selbst aussperren.</p>`;
  const liste = fktMenueListe(istAdmin);
  liste.forEach(m=>{
    const eigen = FKT.eigene.find(e=>e.key===m.key);
    h += fktZeileHTML('menue', m.key, m.ico, m.label, m.sub, false, m.fest,
      eigen?`<button class="dgr" data-k="${esc(m.key)}" onclick="fktUiEigenLoeschen(this.dataset.k)">Löschen</button>`:'');
  });
  /* Ausgeblendete gesondert, damit sie auffindbar bleiben. */
  const versteckt = FKT_MENUE.filter(m=>!m.fest && fktAus('menue', m.key))
    .concat(FKT.eigene.filter(e=>fktAus('menue', e.key)));
  if(versteckt.length){
    h += `<div class="bez-sec">Ausgeblendet (${versteckt.length})</div>`;
    versteckt.forEach(m=>{
      h += fktZeileHTML('menue', m.key,
        fktWert('menue', m.key, 'ico', m.ico), fktWert('menue', m.key, 'label', m.label),
        fktWert('menue', m.key, 'sub', m.sub), true, false, '');
    });
  }

  /* ── Eigener Punkt ── */
  h += `<div class="bez-sec">Eigener Menüpunkt</div>`;
  if(fktForm && fktForm.art==='neu'){
    h += fktNeuFormHTML();
  } else {
    h += `<p class="hint">Ein eigener Punkt kann einen Standard öffnen, einen Bildschirm der App aufrufen, die Anleitung zeigen oder eine Adresse im Browser öffnen — zum Beispiel „Dienstplan" oder „Notfallnummern".</p>
      <div class="p-actions"><button class="btn btn-pri" onclick="fktUiNeu()">＋ Eigenen Menüpunkt anlegen</button></div>`;
  }

  /* ── Verwaltungs-Karten ── */
  h += `<div class="bez-sec">Karten der Verwaltung</div>`;
  const pl = fktPanelListe($('scr-admin'));
  if(!pl.length){
    h += `<p class="hint">Die Verwaltung war in dieser Sitzung noch nicht offen — einmal „🛠️ Verwaltung" aufrufen, dann erscheinen hier alle Karten.</p>`;
  } else {
    h += `<p class="hint">Dieselben Einstellungen für jede Karte der Verwaltung. Ausgeblendete Karten verschwinden aus der Liste — die Funktion dahinter bleibt erhalten.</p>`;
    pl.forEach(p=>{
      h += fktZeileHTML('panel', p.key,
        fktWert('panel', p.key, 'ico',   (p.el.querySelector('.vp-ico')||{}).textContent||''),
        fktWert('panel', p.key, 'label', p.titel),
        fktWert('panel', p.key, 'sub',   p.desc),
        fktAus('panel', p.key), false, '');
    });
  }

  /* ── Die Bearbeiten-Menüs (⋯) ── */
  h += `<div class="bez-sec">Die Bearbeiten-Menüs (⋯)</div>`;
  h += `<p class="hint">Das meistbenutzte Menü der App. Jeder Punkt einzeln: ausblenden, umbenennen, eigenes Symbol, in seiner Gruppe verschieben. Eine ganze Gruppe abzuschalten nimmt alle ihre Punkte auf einmal aus dem Menü.</p>`;
  Object.keys(FKT_SHEET_KATALOG).forEach(bereich=>{
    const kat = FKT_SHEET_KATALOG[bereich];
    const offen = (fktMenuOffen===bereich);
    h += `<details class="vpanel"${offen?' open':''}>
      ${vsum('⋯', kat.titel, 'Punkte dieses Menüs ein- und ausblenden, umbenennen, ordnen',
             fktSheetGeaendert(bereich) ? (fktSheetGeaendert(bereich)+' angepasst') : '')}
      <div class="vpanel-body">`;
    kat.gruppen.forEach(g=>{
      const gkey = bereich+'.'+g.key;
      const gAus = fktAus('sheetgruppe', gkey);
      h += `<div class="fkt-gruppe${gAus?' fkt-aus':''}">
        <span class="fkt-gruppe-t">${esc(fktWert('sheetgruppe', gkey, 'label', g.titel) || 'ohne Überschrift')}</span>
        <button class="${gAus?'':'on'}" data-k="${esc(gkey)}" onclick="fktUiSchalten('sheetgruppe',this.dataset.k)">${gAus?'Gruppe aus':'Gruppe an'}</button>
      </div>`;
      g.akt.forEach(a2=>{
        const voll = bereich+'.'+a2.key;
        h += fktZeileHTML('sheet', voll,
          fktWert('sheet', voll, 'ico',   a2.ico),
          fktWert('sheet', voll, 'label', a2.label),
          fktWert('sheet', voll, 'sub',   a2.sub),
          fktAus('sheet', voll), false, '');
      });
    });
    h += `</div></details>`;
  });

  /* ── Kopfleiste ── */
  h += `<div class="bez-sec">Die Symbole oben rechts</div>`;
  h += `<p class="hint">Lupe, Anmeldung und Hell/Dunkel. „☰" und „Zurück" bleiben — ohne sie käme man nirgendwo mehr hin.</p>`;
  FKT_KOPF.forEach(k=>{
    const aus = fktAus('kopf', k.key);
    h += `<div class="fkt-zeile${aus?' fkt-aus':''}">
      <div class="fkt-kopf"><span class="fkt-ico">${k.ico}</span>
        <span class="fkt-name">${esc(k.label)}</span></div>
      <input class="loc-input fkt-sub" value="${esc(k.sub)}" readonly aria-label="Erklärung">
      <div class="fkt-akt">
        <button class="${aus?'':'on'}" data-k="${esc(k.key)}" onclick="fktUiSchalten('kopf',this.dataset.k)">${aus?'aus':'an'}</button>
      </div></div>`;
  });

  /* ── Merkmalsleiste ── */
  h += `<div class="bez-sec">Merkmalsleiste der Startseite</div>`;
  h += `<p class="hint">Welche Merkmale zum Filtern angeboten werden. Weniger heißt hier mehr — auf dem Tablet kostet jede Reihe eine Bildschirmzeile. Ein Merkmal mit aktiver Auswahl bleibt sichtbar, damit kein Filter unsichtbar wirkt. Die <b>Namen</b> werden unter „Bezeichnungen & Hersteller" gepflegt.</p>`;
  (typeof FAC_ARTEN!=='undefined'?FAC_ARTEN:[]).forEach(a2=>{
    const aus = fktAus('facette', a2.key);
    h += `<div class="fkt-zeile${aus?' fkt-aus':''}">
      <div class="fkt-kopf"><span class="fkt-ico">🔎</span>
        <span class="fkt-name">${esc(typeof facLabel==='function'?facLabel(a2.key):a2.vorgabe)}</span></div>
      <div class="fkt-akt">
        <button class="${aus?'':'on'}" data-k="${esc(a2.key)}" onclick="fktUiSchalten('facette',this.dataset.k)">${aus?'aus':'an'}</button>
      </div></div>`;
  });

  h += `<div class="p-actions" style="margin-top:16px">
      <button class="btn btn-sec" onclick="fktUiAllesZuruecksetzen()">Alles auf Auslieferung zurücksetzen</button>
    </div>
    <p class="hint">Diese Einstellungen gelten auf <b>allen Geräten</b> — sie liegen im geteilten Zustand, nicht nur auf diesem Tablet.</p>`;
  box.innerHTML = h;
}

/* Wie viele Punkte eines Bearbeiten-Menüs sind angepasst? Nur für das Abzeichen. */
function fktSheetGeaendert(bereich){
  const kat = FKT_SHEET_KATALOG[bereich]; if(!kat) return 0;
  let n = 0;
  kat.gruppen.forEach(g=>{
    if(fktGeaendert('sheetgruppe', bereich+'.'+g.key)) n++;
    g.akt.forEach(a=>{ if(fktGeaendert('sheet', bereich+'.'+a.key)) n++; });
  });
  return n;
}

function fktNeuFormHTML(){
  const stds = (typeof DB!=='undefined'&&DB&&DB.standards) ? DB.standards.filter(s=>!(typeof stdHidden==='function'&&stdHidden(s))) : [];
  return `<div class="pcard">
    <div class="form-grp"><div class="flabel">Symbol</div>
      <input class="loc-input" id="fktNIco" value="⭐" style="max-width:5em;text-align:center"></div>
    <div class="form-grp"><div class="flabel">Name</div>
      <input class="loc-input" id="fktNName" style="width:100%" placeholder="z. B. Notfallnummern"></div>
    <div class="form-grp"><div class="flabel">Untertitel (optional)</div>
      <input class="loc-input" id="fktNSub" style="width:100%" placeholder="kurze Erklärung"></div>
    <div class="form-grp"><div class="flabel">Was soll passieren?</div>
      <select class="form-sel" id="fktNArt" style="width:100%" onchange="renderFktNeuZiel()">
        <option value="standard">Einen Standard öffnen</option>
        <option value="bildschirm">Einen Bildschirm der App öffnen</option>
        <option value="seite">Die Anleitung öffnen</option>
        <option value="adresse">Eine Adresse im Browser öffnen</option>
      </select></div>
    <div class="form-grp" id="fktNZiel">
      <div class="flabel">Welcher Standard?</div>
      <select class="form-sel" id="fktNWert" style="width:100%">
        ${stds.map(s=>`<option value="${esc(s.id)}">${esc(typeof stdTitel==='function'?stdTitel(s):s.titel)}</option>`).join('')}
      </select></div>
    <div class="form-grp"><div class="flabel">Für wen?</div>
      <select class="form-sel" id="fktNNur" style="width:100%">
        <option value="alle">Für alle</option>
        <option value="admin">Nur in der Verwaltung</option>
      </select></div>
    <div class="p-actions"><button class="btn btn-sec" onclick="fktUiAbbrechen()">Abbrechen</button>
      <button class="btn btn-pri" onclick="fktUiNeuSpeichern()">Anlegen</button></div></div>`;
}

/* Das Zielfeld wechselt mit der Art — ohne die ganze Seite neu zu zeichnen,
   damit die schon getippten Felder stehen bleiben. */
function renderFktNeuZiel(){
  const art = ($('fktNArt')&&$('fktNArt').value)||'standard';
  const box = $('fktNZiel'); if(!box) return;
  if(art==='standard'){
    const stds = (typeof DB!=='undefined'&&DB&&DB.standards) ? DB.standards.filter(s=>!(typeof stdHidden==='function'&&stdHidden(s))) : [];
    box.innerHTML = `<div class="flabel">Welcher Standard?</div>
      <select class="form-sel" id="fktNWert" style="width:100%">
        ${stds.map(s=>`<option value="${esc(s.id)}">${esc(typeof stdTitel==='function'?stdTitel(s):s.titel)}</option>`).join('')}
      </select>`;
  } else if(art==='bildschirm'){
    box.innerHTML = `<div class="flabel">Welcher Bildschirm?</div>
      <select class="form-sel" id="fktNWert" style="width:100%">
        ${FKT_BILDSCHIRME.map(b=>`<option value="${esc(b.key)}">${esc(b.label)}</option>`).join('')}
      </select>`;
  } else if(art==='seite'){
    box.innerHTML = `<div class="flabel">Seite</div>
      <select class="form-sel" id="fktNWert" style="width:100%"><option value="anleitung.html">Bebilderte Anleitung</option></select>`;
  } else {
    box.innerHTML = `<div class="flabel">Adresse (mit https://)</div>
      <input class="loc-input" id="fktNWert" style="width:100%" placeholder="https://…">
      <p class="hint">Öffnet sich in einem neuen Fenster. Ohne Netz nicht erreichbar.</p>`;
  }
}

/* ── Bedien-Hüllen ── */
function fktUiSetzen(bereich, key, feld, wert){
  fktMerkeOffen(bereich, key);
  fktSetzen(bereich, key, feld, (wert||'').trim());
  const eigen = (bereich==='menue') ? FKT.eigene.find(e=>e.key===key) : null;
  if(eigen){ /* eigene Punkte tragen ihre Wörter direkt */
    if(feld==='ico') eigen.ico=(wert||'').trim()||'⭐';
    if(feld==='label') eigen.label=(wert||'').trim()||eigen.label;
    if(feld==='sub') eigen.sub=(wert||'').trim();
    fktZuruecksetzen(bereich, key); saveFKT();
  }
  if(bereich==='panel' && typeof renderAdmin==='function' && $('scr-admin') && $('scr-admin').classList.contains('active')) renderAdmin();
  renderFunktionen();
}
function fktUiSchalten(bereich, key){
  const jetzt = fktAus(bereich, key);
  fktMerkeOffen(bereich, key);
  fktSetzen(bereich, key, 'aus', jetzt?'':true);
  if(bereich==='kopf') fktKopfAnwenden();
  if(bereich==='panel' && typeof renderAdmin==='function') renderAdmin();
  renderFunktionen();
  if(typeof toast==='function') toast(jetzt?'Wieder sichtbar':'Ausgeblendet — jederzeit rücknehmbar');
}
function fktUiVerschieben(bereich, key, richtung){
  fktMerkeOffen(bereich, key);
  const ok = (bereich==='menue') ? fktVerschieben(key, richtung, (typeof ADMIN!=='undefined')?ADMIN:true)
    : (bereich==='panel') ? fktPanelVerschieben(key, richtung)
    : fktSheetVerschieben(key, richtung);
  if(!ok) return;
  if(bereich==='panel' && typeof renderAdmin==='function') renderAdmin();
  renderFunktionen();
}
function fktUiZuruecksetzen(bereich, key){
  fktMerkeOffen(bereich, key);
  fktZuruecksetzen(bereich, key);
  if(bereich==='panel' && typeof renderAdmin==='function') renderAdmin();
  renderFunktionen(); if(typeof toast==='function') toast('Vorgabe wiederhergestellt');
}
function fktUiNeu(){ fktForm={art:'neu'}; renderFunktionen();
  const i=$('fktNName'); if(i) setTimeout(()=>i.focus(),50); }
function fktUiAbbrechen(){ fktForm=null; renderFunktionen(); }
function fktUiNeuSpeichern(){
  const name=($('fktNName')&&$('fktNName').value||'').trim();
  if(!name){ if(typeof toast==='function') toast('Bitte einen Namen eingeben',true); const i=$('fktNName'); if(i) i.focus(); return; }
  const art=($('fktNArt')&&$('fktNArt').value)||'standard';
  const wert=($('fktNWert')&&$('fktNWert').value||'').trim();
  if(art==='adresse' && !/^https?:\/\//i.test(wert)){ if(typeof toast==='function') toast('Adresse muss mit http:// oder https:// beginnen',true); return; }
  if(!wert){ if(typeof toast==='function') toast('Bitte ein Ziel wählen',true); return; }
  fktNormalisieren();
  FKT.eigene.push({ key:fktNeuerSchluessel(), ico:($('fktNIco')&&$('fktNIco').value||'⭐').trim()||'⭐',
    label:name, sub:($('fktNSub')&&$('fktNSub').value||'').trim(), art, wert,
    nur:($('fktNNur')&&$('fktNNur').value)||'alle', ord:FKT_MENUE.length+FKT.eigene.length });
  saveFKT(); fktForm=null; renderFunktionen();
  if(typeof toast==='function') toast('Menüpunkt angelegt');
}
function fktUiEigenLoeschen(key){
  fktNormalisieren();
  FKT.eigene = FKT.eigene.filter(e=>e.key!==key);
  fktZuruecksetzen('menue', key); saveFKT(); renderFunktionen();
  if(typeof toast==='function') toast('Eigener Menüpunkt entfernt');
}
/* Merkt sich, welches Bearbeiten-Menü offen war (nur Anzeige, nicht geteilt). */
function fktMerkeOffen(bereich, key){
  if(bereich==='sheet' || bereich==='sheetgruppe'){ fktMenuOffen = String(key).split('.')[0]; }
}

/* Eine Aktion INNERHALB ihrer Gruppe verschieben. Über Gruppengrenzen hinweg
   bewusst nicht — sonst stünde „Endgültig löschen" unter „Inhalt". */
function fktSheetVerschieben(voll, richtung){
  const teile = String(voll).split('.');
  const kat = FKT_SHEET_KATALOG[teile[0]]; if(!kat) return false;
  const g = kat.gruppen.find(x=>x.akt.some(a=>a.key===teile[1])); if(!g) return false;
  const bereich = teile[0];
  /* Aktuelle Reihenfolge dieser Gruppe = gespeicherte Zahl, sonst Katalogplatz. */
  const reihe = g.akt.map((a,i)=>({ key:a.key, ord:Number(fktWert('sheet', bereich+'.'+a.key, 'ord', i)) }))
    .sort((a,b)=>a.ord-b.ord);
  const i = reihe.findIndex(x=>x.key===teile[1]);
  const j = i + (richtung<0?-1:1);
  if(i<0 || j<0 || j>=reihe.length) return false;
  const t = reihe[i]; reihe[i]=reihe[j]; reihe[j]=t;
  reihe.forEach((x,k)=> fktSetzen('sheet', bereich+'.'+x.key, 'ord', k));
  return true;
}

function fktUiAllesZuruecksetzen(){
  /* auch die Kopfleiste muss danach wieder vollständig sein */
  FKT = { menue:{}, panel:{}, sheet:{}, sheetgruppe:{}, facette:{}, kopf:{}, eigene:FKT.eigene||[] };
  saveFKT();
  fktKopfAnwenden();
  if(typeof renderAdmin==='function') renderAdmin();
  renderFunktionen();
  if(typeof toast==='function') toast('Auslieferungszustand wiederhergestellt (eigene Punkte bleiben)');
}

/* Karte in der Verwaltung. */
function funktionenPanelHTML(){
  fktNormalisieren();
  const n = Object.keys(FKT.menue||{}).length + Object.keys(FKT.panel||{}).length + (FKT.eigene||[]).length;
  return `<details class="vpanel" data-keys="menü menue funktionen ausblenden umbenennen reihenfolge eigener punkt symbol">
    ${vsum('🎛','Menü & Funktionen','Menüpunkte und Verwaltungs-Karten ein- und ausblenden, umbenennen, umsortieren — und eigene anlegen', n?(n+' angepasst'):'')}
    <div class="vpanel-body">
    <p class="hint">Die App gehört Dir: Was Du nicht brauchst, blendest Du aus; was anders heißen soll, benennst Du um; was fehlt, legst Du als eigenen Menüpunkt an. Alles ohne Programmierung und jederzeit rücknehmbar.</p>
    <div class="p-actions"><button class="btn btn-pri" onclick="openFunktionen()">Menü &amp; Funktionen öffnen</button></div>
    </div></details>`;
}

/* ═══════════ 9. Langdruck auf eine beliebige Fläche ═══════════

   Hausregel A7 sagt: Jede Fläche muss ohne Code änderbar sein, und zwar
   DORT, wo sie steht — nicht über ein Untermenü. Der Messstand
   (e2e/messen.js) hat gezählt, wo das noch nicht galt:

     Kopf des Standards      2 Flächen ohne Langdruck
     Knöpfe unter der Liste  6
     Sortier-Knöpfe          6
     Merkmals-Knöpfe        30

   Für alle vier gilt dasselbe: umbenennen, Symbol ändern, ausblenden. Also
   braucht es dafür EIN Sheet und nicht vier. Die Bereiche liegen im selben
   Speicher wie das übrige Register (`hkl_funktionen`), damit es keinen
   zweiten Ort für dieselbe Sorte Einstellung gibt. */

let fktFlaeche = null;    /* { bereich, key, wort, ico, titel, sub, ohneIco } */

function fktFlaecheSheet(bereich, key, vorgabe){
  if(typeof ADMIN!=='undefined' && !ADMIN) return;
  const v = vorgabe || {};
  fktFlaeche = { bereich, key,
    wort:String(v.wort||''), ico:String(v.ico||''),
    titel:String(v.titel||'Fläche bearbeiten'), sub:String(v.sub||''),
    ohneIco:!!v.ohneIco };
  fktFlaecheZeichnen();
  if(typeof showSheet==='function') showSheet(true);
}
function fktFlaecheZeichnen(){
  const f = fktFlaeche; if(!f) return;
  const aus = fktAus(f.bereich, f.key);
  const wort = fktWert(f.bereich, f.key, 'wort', f.wort);
  const ico  = fktWert(f.bereich, f.key, 'ico',  f.ico);
  $('sheet').innerHTML = `<div class="sheet-grip"></div><div class="sheet-title">${esc(f.titel)}</div>
    <div class="sheet-name">${esc(ico)} ${esc(wort)}</div>
    ${f.sub?`<p class="why-help">${esc(f.sub)}</p>`:''}
    <div class="form-grp"><div class="flabel">Wort</div>
      <input class="loc-input" id="fkFlWort" value="${esc(wort)}" placeholder="${esc(f.wort)}"></div>
    ${f.ohneIco?'':`<div class="form-grp"><div class="flabel">Symbol</div>
      <input class="loc-input" id="fkFlIco" value="${esc(ico)}" maxlength="4" placeholder="${esc(f.ico)}"></div>`}
    <div class="p-actions"><button class="btn btn-pri" onclick="fktFlaecheSpeichern()">Übernehmen</button></div>
    <div class="sheet-pick" style="margin-top:10px">
      <button class="sheet-pick-btn" onclick="fktFlaecheSchalten()">${aus?'👁 Wieder einblenden':'🚫 Ausblenden'}</button>
      ${fktGeaendert(f.bereich,f.key)?`<button class="sheet-pick-btn" onclick="fktFlaecheZurueck()">↺ Auf Auslieferung zurücksetzen</button>`:''}
    </div>
    <p class="hint" style="padding:8px 4px">Leeres Feld heißt: wieder wie ausgeliefert. Ausgeblendetes bleibt in der Verwaltung unter „🎛 Menü &amp; Funktionen" erreichbar — es geht nichts verloren.</p>
    <button class="sheet-close" onclick="showSheet(false)">Schließen</button>`;
}
function fktFlaecheAuffrischen(){
  if(typeof reRenderDetail==='function') reRenderDetail();
  if(typeof renderStandards==='function' && typeof curSeg!=='undefined') renderStandards();
}
function fktFlaecheSpeichern(){
  const f = fktFlaeche; if(!f) return;
  const w = ($('fkFlWort') && $('fkFlWort').value || '').trim();
  const i = ($('fkFlIco')  && $('fkFlIco').value  || '').trim();
  fktSetzen(f.bereich, f.key, 'wort', (w===f.wort) ? '' : w);
  if(!f.ohneIco) fktSetzen(f.bereich, f.key, 'ico', (i===f.ico) ? '' : i);
  if(typeof showSheet==='function') showSheet(false);
  fktFlaecheAuffrischen();
  if(typeof toast==='function') toast('Übernommen');
}
function fktFlaecheSchalten(){
  const f = fktFlaeche; if(!f) return;
  const aus = fktAus(f.bereich, f.key);
  fktSetzen(f.bereich, f.key, 'aus', aus ? '' : true);
  fktFlaecheZeichnen(); fktFlaecheAuffrischen();
  if(typeof toast==='function') toast(aus ? 'Wieder sichtbar' : 'Ausgeblendet — in der Verwaltung erreichbar');
}
function fktFlaecheZurueck(){
  const f = fktFlaeche; if(!f) return;
  fktZuruecksetzen(f.bereich, f.key);
  fktFlaecheZeichnen(); fktFlaecheAuffrischen();
  if(typeof toast==='function') toast('Auf Auslieferung zurückgesetzt');
}
