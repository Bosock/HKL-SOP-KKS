/* ─────────────────────────────────────────────────────────────
   PRODUKTREGISTER — amtliche Stammdaten zu einer GTIN

   Warum es das gibt: Hersteller, Handelsname und REF wurden bisher getippt
   oder vom Etikett geraten — und landeten als „VYCON" und „B|BRAUN" in der
   App. Dabei steht all das in öffentlichen Registern, zu finden über die
   GTIN aus dem Barcode:

     1. EUDAMED — die Datenbank der EU (seit 28.05.2026 Pflicht). Offizielle,
        freie Schnittstelle der EU-Kommission (SANTE Data Platform).
     2. AccessGUDID — die Datenbank der US-Gesundheitsbibliothek (NLM). Für
        Produkte, die (noch) nicht in EUDAMED stehen.

   Gefragt wird VOM SERVER, nicht vom Gerät im Saal:
     · die EU-Schnittstelle antwortet Browsern fremder Seiten nicht (CORS),
     · die Geräte sprechen weiter nur mit dem eigenen Server,
     · ein Treffer wird hier zwischengespeichert — dieselbe GTIN kostet beim
       zweiten Mal kein Netz mehr.
   Hinaus geht NUR die GTIN — keine Patienten-, keine Nutzerdaten (A1).
   Zurück kommt ein Vorschlag mit Quelle; bestätigt wird er erst, wenn ein
   Mensch den Stammsatz speichert (Grundsatz A5).

   ── Verlässlichkeit: Die Schnittstelle der EU ist es nicht ──
   Gemessen am 10., 11. und 13.11.2026. Sie kennt vier Störungen:
     a) langsam (2–9 s)                          → Zeitlimit 20 s
     b) hängt (keine Antwort in 40 s)            → Zeitlimit, dann Pause
     c) „429 — zu viele Abfragen" (500 je Min.)  → Wartezeit einhalten
     d) antwortet prompt „Data not found" — auch für Produkte, die sie am
        Vortag kannte (13.11.2026, über mindestens eine Stunde)
   (d) ist die tückische: Sie sieht aus wie eine ehrliche Fehlanzeige. Darum
   gilt ein „nicht gefunden" von EUDAMED erst nach einer GEGENPROBE: Kennt die
   Schnittstelle im selben Augenblick ein Produkt, das sie nachweislich führt?
   Wenn nein, ist sie gestört — und die Antwort zählt als Ausfall.

   Daraus folgen drei Regeln:
     1. Ein Treffer geht nie verloren. Er wird nicht durch „nicht gefunden"
        ersetzt und auch nach Ablauf weiter ausgeliefert, wenn das Auffrischen
        scheitert.
     2. „Steht in keinem Register" wird nur gemerkt, wenn beide Register
        geantwortet haben und EUDAMED die Gegenprobe bestanden hat.
     3. Was offen bleibt, fragt der Server von selbst nach (nach 2, 5, 15 …
        Minuten, später alle 6 Stunden) — niemand muss daran denken.

   Abschalten: REGISTER=0 in der Umgebung. Die App arbeitet dann wie zuvor.
   Weitere Schalter: REGISTER_TIMEOUT_MS (20000), REGISTER_PAUSE_MS (120000;
   0 = keine Pause), REGISTER_NACHFASSEN=0 (kein selbsttätiges Nachfragen),
   REGISTER_NACHFASSEN_MIN (Abstände in Minuten, mit Komma getrennt),
   REGISTER_PRUEF_GTIN (Produkte für die Gegenprobe, mit Komma getrennt).
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { STATE_DIR } = require('./config');

const AN = process.env.REGISTER !== '0';
const EUDAMED_URL = process.env.REGISTER_EUDAMED_URL || 'https://api.datalake.sante.service.ec.europa.eu/eudamed/udi';
const GUDID_URL = process.env.REGISTER_GUDID_URL || 'https://accessgudid.nlm.nih.gov/api/v2/devices/lookup.json';
/* EUDAMED antwortet oft erst nach 2–9 s (gemessen 11.11.2026), GUDID in unter
   einer Sekunde. Ein zu knappes Zeitlimit machte aus „langsam" „nicht
   erreichbar" — und legte EUDAMED danach für alle Abfragen still. */
const ZEITLIMIT_MS = parseInt(process.env.REGISTER_TIMEOUT_MS || '20000', 10);
const ZEITLIMIT_GUDID_MS = Math.min(ZEITLIMIT_MS, 8000);
/* Eine Abfrage dauert insgesamt höchstens so lange — das Gerät im Saal gibt
   nach 35 s auf (public/neu/js/stamm.js). */
const GESAMT_MS = 30000;
const RESERVE_GUDID_MS = 9000;      /* so viel bleibt für GUDID übrig */
const CACHE_DATEI = path.join(STATE_DIR, 'register-cache.json');
const TREFFER_TAGE = 30;            /* ein Treffer gilt 30 Tage */
const FEHLANZEIGE_STUNDEN = 24;     /* „nicht gefunden" nur einen Tag — die Register füllen sich */
/* Schutz der fremden Dienste: EUDAMED erlaubt je Absender-Adresse 500 Abfragen
   in der Minute (Antwortkopf x-ratelimit-limit, 13.11.2026), darüber HTTP 429.
   Die App bleibt mit 15 Nachschlagen je Minute (je höchstens 3 Anfragen an
   EUDAMED) weit darunter. */
const MAX_JE_MINUTE = 15;
/* Antwortet ein Register nicht, wird es übersprungen — sonst wartete jeder
   Scan aufs Neue das volle Zeitlimit ab. Die Pause wächst mit jedem weiteren
   Fehlschlag (2, 4 Minuten), höchstens aber 5 Minuten. */
const pauseMs = () => parseInt(process.env.REGISTER_PAUSE_MS || '120000', 10);
const PAUSE_MAX_MS = 5 * 60000;
/* Produkte für die Gegenprobe. Sie folgt auf JEDES „nicht gefunden" von
   EUDAMED (eine zusätzliche Anfrage, rund eine Sekunde) — eine Störung kann
   von einer Sekunde auf die andere beginnen. Der Server nimmt zuerst, was er
   selbst schon bei EUDAMED gefunden hat. Für den Anfang drei Produkte, deren Eintrag am
   10./11.11.2026 abgerufen wurde (B. Braun Discofix C und Injekt, Vygon). */
const PRUEF_GTINS = (process.env.REGISTER_PRUEF_GTIN || '04022495787309,04022495250766,03660812002653').split(',').map(s => s.trim()).filter(Boolean);
const PRUEF_GUDID = '08714729841968';   /* Boston Scientific IntellaMap Orion, abgerufen 10.11.2026 */
/* Selbsttätiges Nachfragen: Minuten bis zum 1., 2., … Versuch; danach bleibt
   es beim letzten Abstand. Nach MAX_VERSUCHE (rund vier Tage) ist Schluss,
   bis wieder jemand nach der GTIN fragt. */
const NACHFASSEN_MIN = (() => { const l = String(process.env.REGISTER_NACHFASSEN_MIN || '').split(',').map(Number).filter(n => n > 0);
  return l.length ? l : [2, 5, 15, 30, 60, 120, 240, 360]; })();
const MAX_VERSUCHE = 20;
const NACHSEHEN_MIN = 60;           /* eine Fehlanzeige wird nach einer Stunde EINMAL überprüft */
const AUTO = AN && process.env.REGISTER_NACHFASSEN !== '0';

/* ── Reine Helfer (testbar) ── */
function gtinOk(g) {
  const s = String(g == null ? '' : g).trim();
  if (!/^(\d{8}|\d{12,14})$/.test(s)) return false;
  const z = s.split('').map(Number); const pz = z.pop(); let summe = 0;
  z.reverse().forEach((d, i) => { summe += d * (i % 2 === 0 ? 3 : 1); });
  return (10 - (summe % 10)) % 10 === pz;
}
function gtin14(g) { const s = String(g == null ? '' : g).replace(/\D/g, ''); return s.length < 14 ? s.padStart(14, '0') : s; }
function txt(v) { const t = (v == null ? '' : String(v)).trim(); return (!t || /^(n\/?a|null|none|-+|\.+)$/i.test(t)) ? '' : t; }
function janein(v) { return (v === 1 || v === true || v === '1') ? true : ((v === 0 || v === false || v === '0') ? false : null); }

/* EUDAMED: { value:[ { TRADE_NAME, REFERENCE, MF_NAME, MF_SRN, STERILE, … } ] } */
function ausEudamed(json) {
  const v = json && Array.isArray(json.value) ? json.value[0] : null;
  if (!v) return null;
  const hersteller = txt(v.MF_NAME);
  const t = {
    quelle: 'EUDAMED',
    hersteller: hersteller ? { name: hersteller, srn: txt(v.MF_SRN) } : null,
    handelsname: txt(v.TRADE_NAME),
    bezeichnung: txt(v.DEVICE_NAME),
    ref: txt(v.REFERENCE),
    steril: janein(v.STERILE),
    latex: janein(v.LATEX),
    mehrweg: janein(v.REUSABLE),
    einordnung: txt(v.NOMENCLATURE_CODE),
    basisUdi: txt(v.BASIC_UDI),
  };
  return (t.hersteller || t.handelsname || t.ref) ? t : null;
}
/* AccessGUDID: { gudid:{ device:{ brandName, catalogNumber, companyName, … } } } */
function ausGudid(json) {
  const d = json && json.gudid && json.gudid.device;
  if (!d || typeof d !== 'object') return null;
  const hersteller = txt(d.companyName);
  const latex = d.labeledContainsNRL === true ? true : (d.labeledNoNRL === true ? false : null);
  const t = {
    quelle: 'GUDID',
    hersteller: hersteller ? { name: hersteller, srn: '' } : null,
    handelsname: txt(d.brandName),
    bezeichnung: txt(d.deviceDescription),
    ref: txt(d.catalogNumber) || txt(d.versionModelNumber),
    steril: (d.sterilization && typeof d.sterilization.deviceSterile === 'boolean') ? d.sterilization.deviceSterile : null,
    latex,
    mehrweg: typeof d.singleUse === 'boolean' ? !d.singleUse : null,
    einordnung: '',
    basisUdi: '',
  };
  return (t.hersteller || t.handelsname || t.ref) ? t : null;
}
/* Gilt ein gemerkter Eintrag noch, ohne dass neu gefragt wird?
     · Treffer: 30 Tage.
     · vorlaeufig — Treffer aus dem zweiten Register, während das erste
       ausfiel: nur einen Tag, damit EUDAMED (mit Registriernummer und
       Einordnung) bald wieder zum Zug kommt.
     · Fehlanzeige: einen Tag — aber nur, wenn sie GESICHERT ist (beide
       Register haben geantwortet, EUDAMED hat die Gegenprobe bestanden).
       Ältere, ungesicherte Fehlanzeigen gelten nicht mehr: So heilt der
       Zwischenspeicher falsche Einträge aus einer Störung von selbst. */
function frisch(eintrag, jetzt) {
  if (!eintrag || !eintrag.t) return false;
  const alter = (jetzt || Date.now()) - eintrag.t;
  if (eintrag.treffer) return alter < (eintrag.vorlaeufig ? FEHLANZEIGE_STUNDEN * 36e5 : TREFFER_TAGE * 864e5);
  return !!eintrag.sicher && alter < FEHLANZEIGE_STUNDEN * 36e5;
}
/* Wann wird eine offene GTIN das nächste Mal von selbst gefragt? */
function naechsterVersuch(alt, jetzt) {
  const n = ((alt && alt.offen && alt.offen.n) || 0) + 1;
  if (n > MAX_VERSUCHE) return null;
  return { n, ab: jetzt + NACHFASSEN_MIN[Math.min(n, NACHFASSEN_MIN.length) - 1] * 60000 };
}

/* ── Zwischenspeicher (eine Datei; die Register sind raumunabhängig) ──
   Eintrag je GTIN: { t, treffer|null, vorlaeufig?, sicher?, gudidLeer?,
                      offen?:{ n, ab, einmal? } } */
let CACHE = null, schreibt = Promise.resolve();
function cacheLaden() {
  if (CACHE) return CACHE;
  try { const j = JSON.parse(fs.readFileSync(CACHE_DATEI, 'utf8')); CACHE = (j && typeof j === 'object') ? j : {}; }
  catch (e) { CACHE = {}; }
  return CACHE;
}
function cacheSchreiben() {
  const inhalt = JSON.stringify(CACHE);
  schreibt = schreibt.then(async () => {
    await fsp.mkdir(path.dirname(CACHE_DATEI), { recursive: true });
    const tmp = CACHE_DATEI + '.' + process.pid + '.tmp';
    await fsp.writeFile(tmp, inhalt, 'utf8'); await fsp.rename(tmp, CACHE_DATEI);
  }).catch(err => console.error('[register] cache write failed:', err && err.message));
  return schreibt;
}

/* ── Die beiden Register und ihr Zustand ── */
const REGISTER = [
  { name: 'EUDAMED', lesen: ausEudamed, limit: ZEITLIMIT_MS, reserve: RESERVE_GUDID_MS, gegenprobe: true,
    url: g => EUDAMED_URL + '?api-version=v1.0&format=json&PRIMARY_DI=' + encodeURIComponent(g) },
  { name: 'GUDID', lesen: ausGudid, limit: ZEITLIMIT_GUDID_MS, reserve: 0, gegenprobe: false,
    url: g => GUDID_URL + '?di=' + encodeURIComponent(g) },
];
const [EUDAMED, GUDID] = REGISTER;
const stand = {};
function standNeu() { REGISTER.forEach(r => { stand[r.name] = { ok: null, seit: 0, erfolg: 0, fehler: 0, grund: '', folge: 0, pauseBis: 0 }; }); }
standNeu();
function gut(reg) {
  const s = stand[reg.name]; const jetzt = Date.now(); const warGestoert = s.ok === false;
  if (s.ok !== true) s.seit = jetzt;
  s.ok = true; s.erfolg = jetzt; s.folge = 0; s.pauseBis = 0; s.grund = '';
  /* Das Register ist zurück (und kein anderes gestört): Alles, was liegen
     blieb, ist sofort wieder dran. */
  if (warGestoert && REGISTER.every(r => stand[r.name].ok !== false)) { const c = cacheLaden(); Object.keys(c).forEach(g => { if (c[g] && c[g].offen && !c[g].offen.einmal) c[g].offen.ab = jetzt; }); }
}
function schlecht(reg, grund, warteMs) {
  const s = stand[reg.name]; const jetzt = Date.now();
  if (s.ok !== false) s.seit = jetzt;
  s.ok = false; s.fehler = jetzt; s.grund = grund; s.folge++;
  const pause = warteMs || Math.min(pauseMs() * Math.pow(2, Math.min(s.folge, 6) - 1), PAUSE_MAX_MS);
  if (pause > 0) s.pauseBis = jetzt + pause;
}
function grundAus(e) {
  if (e && e.name === 'AbortError') return 'antwortet nicht (Zeitlimit)';
  if (e && e.status === 429) return 'weist ab: zu viele Abfragen (HTTP 429)';
  if (e && e.status) return 'meldet einen Fehler (HTTP ' + e.status + ')';
  return 'ist nicht erreichbar' + (e && e.cause && e.cause.code ? ' (' + e.cause.code + ')' : '');
}

/* ── Abfrage ── */
async function holen(url, limitMs) {
  const ctrl = new AbortController(); const zeit = setTimeout(() => ctrl.abort(), limitMs || ZEITLIMIT_MS);
  try {
    const r = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, signal: ctrl.signal });
    if (r.status === 404) { try { await r.arrayBuffer(); } catch (e) { /* Verbindung freigeben */ } return { status: 404, json: null }; }
    if (!r.ok) {
      const e = new Error('HTTP ' + r.status); e.status = r.status;
      /* „429 — zu viele Abfragen": die verlangte Wartezeit einhalten */
      const s = parseInt(r.headers.get('retry-after') || r.headers.get('x-ratelimit-reset') || '', 10); if (r.status === 429 && s > 0) e.warteMs = Math.min(s, 3600) * 1000;
      throw e;
    }
    return { status: r.status, json: await r.json() };
  } finally { clearTimeout(zeit); }
}
let fenster = { start: 0, n: 0 };
function gedrosselt() {
  const jetzt = Date.now();
  if (jetzt - fenster.start > 60000) fenster = { start: jetzt, n: 0 };
  return ++fenster.n > MAX_JE_MINUTE;
}

/* Gegenprobe: Kennt das Register in diesem Augenblick ein Produkt, das es
   nachweislich führt? → 'ok' | 'leer' (gestört) | 'fehler' | 'zeit'. */
let probeLaeuft = null;
function pruefKandidaten(ausser) {
  const c = cacheLaden();
  const eigene = Object.keys(c).filter(g => c[g] && c[g].treffer && c[g].treffer.quelle === 'EUDAMED').sort((a, b) => c[b].t - c[a].t);
  const alle = []; eigene.slice(0, 1).concat(PRUEF_GTINS, eigene.slice(1, 2)).forEach(g => { g = gtin14(g); if (g !== ausser && alle.indexOf(g) < 0) alle.push(g); });
  return alle.slice(0, 2);
}
function gegenprobe(ausser, ende) {
  if (probeLaeuft) return probeLaeuft;
  probeLaeuft = (async () => {
    let gefragt = 0;
    for (const g of pruefKandidaten(ausser)) {
      const rest = ende - Date.now() - RESERVE_GUDID_MS;
      if (rest < 1500) return gefragt ? 'leer' : 'zeit';
      gefragt++;
      try { const a = await holen(EUDAMED.url(g), Math.min(8000, rest)); if (a.json && ausEudamed(a.json)) return 'ok'; }
      catch (e) { return 'fehler'; }
    }
    return 'leer';
  })();
  const p = probeLaeuft; p.then(() => { probeLaeuft = null; }, () => { probeLaeuft = null; });
  return p;
}
/* Ein Register nach einer GTIN fragen → { art:'treffer', treffer } |
   { art:'leer' } (gesichert) | { art:'fehler', grund }. Wirft nie. */
async function fragen(reg, gtin, ende) {
  const s = stand[reg.name];
  if (s.pauseBis > Date.now()) return { art: 'fehler', grund: s.grund, pausiert: true };
  const rest = ende - Date.now() - reg.reserve;
  if (rest < 1000) return { art: 'fehler', grund: 'keine Zeit mehr' };
  try {
    const a = await holen(reg.url(gtin), Math.min(reg.limit, rest));
    const t = a.json ? reg.lesen(a.json) : null;
    if (t) { gut(reg); return { art: 'treffer', treffer: t }; }
    if (!reg.gegenprobe) { gut(reg); return { art: 'leer' }; }
    const p = await gegenprobe(gtin, ende);
    if (p === 'ok') { gut(reg); return { art: 'leer' }; }
    schlecht(reg, p === 'leer' ? 'meldet „nicht gefunden" auch für Produkte, die es führt' : 'antwortet nicht (Gegenprobe)');
    console.error('[register]', reg.name, gtin, 'gestört:', s.grund);
    return { art: 'fehler', grund: s.grund };
  } catch (e) {
    schlecht(reg, grundAus(e), e && e.warteMs);
    console.error('[register]', reg.name, gtin, s.grund);
    return { art: 'fehler', grund: s.grund };
  }
}

const laufend = new Map();
/* Liefert { gtin, treffer|null, ausCache, fehler?, veraltet?, nachfassen? }.
   Wirft nie. opt.hintergrund: der Server fragt von selbst nach. */
async function abfragen(roh, opt) {
  const hintergrund = !!(opt && opt.hintergrund);
  const gtin = gtin14(roh);
  const cache = cacheLaden();
  if (!hintergrund && frisch(cache[gtin])) return { gtin, treffer: cache[gtin].treffer, ausCache: true };
  if (laufend.has(gtin)) return laufend.get(gtin);
  const lauf = (async () => {
    const alt = cache[gtin]; const altTreffer = (alt && alt.treffer) || null;
    /* Ein alter Treffer ist besser als keine Antwort. */
    const ausAlt = extra => Object.assign({ gtin, treffer: altTreffer, ausCache: true, veraltet: true }, extra);
    if (gedrosselt() && !hintergrund) return altTreffer ? ausAlt() : { gtin, treffer: null, ausCache: false, fehler: 'zu viele Abfragen — bitte kurz warten' };
    const jetzt = Date.now(); const ende = jetzt + GESAMT_MS;
    const e = await fragen(EUDAMED, gtin, ende);
    /* GUDID nur, wenn EUDAMED keinen Treffer hat — und nicht noch einmal,
       wenn es zu dieser offenen GTIN schon „nicht gefunden" gesagt hat. */
    const gudidBekannt = !!(alt && alt.gudidLeer && jetzt - alt.t < FEHLANZEIGE_STUNDEN * 36e5);
    /* Liegt schon ein vorläufiger Treffer vor und EUDAMED fehlt weiter, bleibt
       er, wie er ist — GUDID muss dafür nicht noch einmal gefragt werden. */
    const wartetAufEudamed = hintergrund && !!altTreffer && !!alt.vorlaeufig && e.art === 'fehler';
    const g = e.art === 'treffer' ? null : (gudidBekannt ? { art: 'leer' } : (wartetAufEudamed ? { art: 'fehler' } : await fragen(GUDID, gtin, ende)));
    const treffer = e.treffer || (g && g.treffer) || null;
    const ausfall = e.art === 'fehler' || !!(g && g.art === 'fehler');
    if (treffer) {
      treffer.abgerufen = new Date().toISOString();
      /* GUDID-Treffer bei gestörtem EUDAMED: vorläufig, EUDAMED wird nachgefragt. */
      const offen = e.art === 'fehler' ? naechsterVersuch(alt, Date.now()) : null;
      cache[gtin] = Object.assign({ t: Date.now(), treffer }, e.art === 'fehler' ? { vorlaeufig: true } : {}, offen ? { offen } : {});
      cacheSchreiben();
      return { gtin, treffer, ausCache: false };
    }
    if (!ausfall) {
      /* Beide Register haben geantwortet: gesicherte Fehlanzeige. Ein früherer
         Treffer bleibt trotzdem — Produktangaben werden nicht falsch, nur weil
         ein Register den Eintrag gerade nicht (mehr) führt. */
      if (altTreffer) { cache[gtin] = { t: Date.now(), treffer: altTreffer }; cacheSchreiben(); return ausAlt({ veraltet: false }); }
      const einmal = (alt && alt.offen && alt.offen.einmal) ? null : { n: 0, ab: Date.now() + NACHSEHEN_MIN * 60000, einmal: true };
      cache[gtin] = Object.assign({ t: Date.now(), treffer: null, sicher: true }, einmal ? { offen: einmal } : {});
      cacheSchreiben();
      return { gtin, treffer: null, ausCache: false };
    }
    /* Mindestens ein Register hat nicht (ehrlich) geantwortet: nichts
       behaupten, den alten Stand behalten, später von selbst nachfragen. */
    if (hintergrund && alt && alt.sicher && alt.offen && alt.offen.einmal) {
      /* Das einmalige Nachsehen fiel in eine Störung: Die gesicherte
         Fehlanzeige bleibt, nachgesehen wird eine Stunde später. */
      if (Date.now() - alt.t < FEHLANZEIGE_STUNDEN * 36e5) alt.offen = { n: 0, ab: Date.now() + NACHSEHEN_MIN * 60000, einmal: true }; else delete alt.offen;
      cacheSchreiben();
      return { gtin, treffer: null, ausCache: true };
    }
    const offen = naechsterVersuch(alt, Date.now());
    const neu = altTreffer ? Object.assign({}, alt) : { t: Date.now(), treffer: null };
    if (!altTreffer && ((g && g.art === 'leer') || gudidBekannt)) neu.gudidLeer = true;
    if (!altTreffer && gudidBekannt) neu.t = alt.t;
    if (offen) neu.offen = offen; else delete neu.offen;
    cache[gtin] = neu; cacheSchreiben();
    if (altTreffer) return ausAlt();
    return { gtin, treffer: null, ausCache: false, fehler: 'Register nicht erreichbar', nachfassen: !!(offen && AUTO) };
  })();
  laufend.set(gtin, lauf);
  try { return await lauf; } finally { laufend.delete(gtin); if (!hintergrund) planen(); }
}

/* ── Selbsttätiges Nachfragen ──
   Offene GTINs (Ausfall, vorläufiger Treffer, einmaliges Nachsehen) fragt der
   Server im Hintergrund erneut — eine nach der anderen, mit Abstand, und nur,
   solange das Register nicht pausiert. opt.sofort: ohne Wartezeiten (Tests). */
let zeitgeber = null, fasstNach = false;
const warten = ms => new Promise(ok => { const t = setTimeout(ok, ms); if (t.unref) t.unref(); });
async function nachfassen(opt) {
  if (fasstNach) return 0;
  fasstNach = true; let n = 0;
  try {
    const sofort = !!(opt && opt.sofort); const c = cacheLaden(); const jetzt = Date.now();
    const faellig = Object.keys(c).filter(g => c[g] && c[g].offen && (sofort || c[g].offen.ab <= jetzt)).sort((a, b) => c[a].offen.ab - c[b].offen.ab);
    for (const g of faellig) {
      if (!sofort && (stand.EUDAMED.pauseBis > Date.now() || n >= 10)) break;
      /* Menschen gehen vor: Das Nachfragen lässt ein Drittel der Abfragen frei. */
      if (!sofort && Date.now() - fenster.start <= 60000 && fenster.n >= MAX_JE_MINUTE - 5) break;
      await abfragen(g, { hintergrund: true }); n++;
      if (!sofort) await warten(5000);
    }
  } catch (e) { console.error('[register] Nachfragen:', e && e.message); }
  finally { fasstNach = false; }
  return n;
}
function planen() {
  if (!AUTO || fasstNach) return;
  if (zeitgeber) { clearTimeout(zeitgeber); zeitgeber = null; }
  const c = cacheLaden(); let frueh = Infinity;
  Object.keys(c).forEach(g => { if (c[g] && c[g].offen) frueh = Math.min(frueh, c[g].offen.ab); });
  if (frueh === Infinity) return;
  const start = Math.max(frueh, stand.EUDAMED.pauseBis, Date.now() + 5000);
  zeitgeber = setTimeout(async () => { zeitgeber = null; await nachfassen(); planen(); }, Math.min(start - Date.now(), 6 * 36e5));
  if (zeitgeber.unref) zeitgeber.unref();
}
/* Nach einem Neustart: liegen gebliebene GTINs wieder aufnehmen. */
if (AUTO) { const t = setTimeout(planen, 10000); if (t.unref) t.unref(); }

/* ── Zustand (für Einstellungen → „EU-Register" und zur Fehlersuche) ──
   Enthält nur Zeiten, Zähler und den Grund einer Störung — keine GTIN. */
function zustand() {
  const c = cacheLaden(); const z = { treffer: 0, nichts: 0, offen: 0 }; let naechstes = 0;
  Object.keys(c).forEach(g => { const e = c[g]; if (!e) return;
    if (e.treffer) z.treffer++; else if (e.sicher) z.nichts++;
    if (e.offen && !e.offen.einmal) { z.offen++; naechstes = naechstes ? Math.min(naechstes, e.offen.ab) : e.offen.ab; } });
  const iso = t => (t ? new Date(t).toISOString() : null);
  return { an: AN, nachfassen: AUTO, jetzt: iso(Date.now()),
    register: REGISTER.map(r => { const s = stand[r.name];
      return { name: r.name, zustand: s.ok === true ? 'ok' : (s.ok === false ? 'gestoert' : 'unbekannt'), seit: iso(s.seit), erfolg: iso(s.erfolg), fehler: iso(s.fehler), grund: s.grund, pauseBis: s.pauseBis > Date.now() ? iso(s.pauseBis) : null }; }),
    gemerkt: { treffer: z.treffer, nichts: z.nichts }, offen: z.offen, naechstes: iso(naechstes) };
}
/* „Jetzt prüfen": beide Register mit einem bekannten Produkt fragen. Höchstens
   alle 20 Sekunden — dazwischen kommt der zuletzt ermittelte Zustand. */
let geprueft = 0, pruefLauf = null;
async function pruefen() {
  if (pruefLauf) return pruefLauf;
  if (Date.now() - geprueft < 20000) return zustand();
  pruefLauf = (async () => {
    const ende = Date.now() + GESAMT_MS;
    const p = await gegenprobe('', ende);
    if (p === 'ok') gut(EUDAMED);
    else schlecht(EUDAMED, p === 'leer' ? 'meldet „nicht gefunden" auch für Produkte, die es führt' : 'antwortet nicht');
    try { const a = await holen(GUDID.url(PRUEF_GUDID), ZEITLIMIT_GUDID_MS); if (a.json && ausGudid(a.json)) gut(GUDID); else schlecht(GUDID, 'meldet „nicht gefunden" für ein Produkt, das es führt'); }
    catch (e) { schlecht(GUDID, grundAus(e), e && e.warteMs); }
    geprueft = Date.now(); planen();
    return zustand();
  })();
  try { return await pruefLauf; } finally { pruefLauf = null; }
}

module.exports = { AN, gtinOk, gtin14, ausEudamed, ausGudid, frisch, naechsterVersuch, abfragen, nachfassen, zustand, pruefen, CACHE_DATEI,
  flush: () => schreibt,
  _reset: () => { CACHE = null; fenster = { start: 0, n: 0 }; standNeu(); geprueft = 0; if (zeitgeber) { clearTimeout(zeitgeber); zeitgeber = null; } } };
