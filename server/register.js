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

   Abschalten: REGISTER=0 in der Umgebung. Die App arbeitet dann wie zuvor.
   Zeitlimit je Register: REGISTER_TIMEOUT_MS (7 s). Pause nach einem
   Ausfall: REGISTER_PAUSE_MS (5 min; 0 = keine).
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { STATE_DIR } = require('./config');

const AN = process.env.REGISTER !== '0';
const EUDAMED_URL = process.env.REGISTER_EUDAMED_URL || 'https://api.datalake.sante.service.ec.europa.eu/eudamed/udi';
const GUDID_URL = process.env.REGISTER_GUDID_URL || 'https://accessgudid.nlm.nih.gov/api/v2/devices/lookup.json';
const ZEITLIMIT_MS = parseInt(process.env.REGISTER_TIMEOUT_MS || '7000', 10);
const CACHE_DATEI = path.join(STATE_DIR, 'register-cache.json');
const TREFFER_TAGE = 30;            /* ein Treffer gilt 30 Tage */
const FEHLANZEIGE_STUNDEN = 24;     /* „nicht gefunden" nur einen Tag — die Register füllen sich */
/* Schutz der fremden Dienste: EUDAMED drosselt je Absender-Adresse (Erfahrungs-
   werte anderer Nutzer, Oktober 2026: etwa 20 Abfragen je Minute, darüber
   HTTP 429). Die App bleibt mit 15 sicher darunter — im Alltag fragt sie
   ohnehin nur, wenn jemand ein neues Material scannt. */
const MAX_JE_MINUTE = 15;
/* Antwortet ein Register nicht (am 10.11.2026 hing EUDAMED über eine Minute),
   wird es einige Minuten übersprungen — sonst wartete jeder Scan aufs Neue
   das volle Zeitlimit ab, bevor das zweite Register gefragt wird. */
const pauseMs = () => parseInt(process.env.REGISTER_PAUSE_MS || '300000', 10);

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
function frisch(eintrag, jetzt) {
  if (!eintrag || !eintrag.t) return false;
  const alter = (jetzt || Date.now()) - eintrag.t;
  /* vorlaeufig: Treffer aus dem zweiten Register, während das erste ausfiel —
     nur einen Tag merken, damit EUDAMED (mit Registriernummer und Einordnung)
     bald wieder zum Zug kommt. */
  return (eintrag.treffer && !eintrag.vorlaeufig) ? alter < TREFFER_TAGE * 864e5 : alter < FEHLANZEIGE_STUNDEN * 36e5;
}

/* ── Zwischenspeicher (eine Datei; die Register sind raumunabhängig) ── */
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

/* ── Abfrage ── */
async function holen(url) {
  const ctrl = new AbortController(); const zeit = setTimeout(() => ctrl.abort(), ZEITLIMIT_MS);
  try {
    const r = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, signal: ctrl.signal });
    if (r.status === 404) return { status: 404, json: null };
    if (!r.ok) {
      const e = new Error('HTTP ' + r.status); e.status = r.status;
      /* „429 — zu viele Abfragen": die verlangte Wartezeit einhalten */
      const s = parseInt(r.headers.get('retry-after') || '', 10); if (r.status === 429 && s > 0) e.warteMs = Math.min(s, 3600) * 1000;
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
const laufend = new Map();
const pauseBis = {};                /* Register → Zeitpunkt, bis zu dem es übersprungen wird */
/* Liefert { gtin, treffer|null, ausCache, fehler? }. Wirft nie. */
async function abfragen(roh) {
  const gtin = gtin14(roh);
  const cache = cacheLaden();
  if (frisch(cache[gtin])) return { gtin, treffer: cache[gtin].treffer, ausCache: true };
  if (laufend.has(gtin)) return laufend.get(gtin);
  const lauf = (async () => {
    if (gedrosselt()) return { gtin, treffer: null, ausCache: false, fehler: 'zu viele Abfragen — bitte kurz warten' };
    let treffer = null, fehler = 0, versuche = 0;
    for (const [url, lesen] of [
      [EUDAMED_URL + '?api-version=v1.0&format=json&PRIMARY_DI=' + encodeURIComponent(gtin), ausEudamed],
      [GUDID_URL + '?di=' + encodeURIComponent(gtin), ausGudid],
    ]) {
      versuche++;
      if ((pauseBis[lesen.name] || 0) > Date.now()) { fehler++; continue; }
      try { const a = await holen(url); treffer = a.json ? lesen(a.json) : null; }
      catch (e) {
        fehler++; const warte = (e && e.warteMs) || pauseMs(); if (warte > 0) pauseBis[lesen.name] = Date.now() + warte;
        console.error('[register]', lesen.name, gtin, e && (e.name === 'AbortError' ? 'Zeitlimit' : e.message));
      }
      if (treffer) break;
    }
    if (treffer) { treffer.abgerufen = new Date().toISOString(); }
    /* Nur ein EINDEUTIGES Ergebnis merken: Antwortet ein Register gar nicht,
       wird „nicht gefunden" nicht gespeichert — sonst bliebe ein Produkt
       einen Tag lang unauffindbar, nur weil das Netz kurz weg war. */
    if (treffer || fehler === 0) { cache[gtin] = Object.assign({ t: Date.now(), treffer }, (treffer && fehler) ? { vorlaeufig: true } : {}); cacheSchreiben(); }
    /* Ohne Treffer zählt schon EIN ausgefallenes Register als „nicht erreichbar":
       „steht in keinem Register" darf nur heißen, dass beide geantwortet haben. */
    return Object.assign({ gtin, treffer, ausCache: false }, (!treffer && fehler) ? { fehler: 'Register nicht erreichbar' } : {});
  })();
  laufend.set(gtin, lauf);
  try { return await lauf; } finally { laufend.delete(gtin); }
}

module.exports = { AN, gtinOk, gtin14, ausEudamed, ausGudid, frisch, abfragen, CACHE_DATEI,
  flush: () => schreibt, _reset: () => { CACHE = null; fenster = { start: 0, n: 0 }; Object.keys(pauseBis).forEach(k => { delete pauseBis[k]; }); } };
