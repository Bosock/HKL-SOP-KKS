/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — DAS KÜRZEL AN DIESEM GERÄT

   Vier Katheterlabore, räumlich getrennt. Eine Aufgabe steht im Raum, jeder
   weiß davon, und niemand weiß, ob sie erledigt ist — oder von wem. Genau
   dafür braucht ein Haken einen Namen daneben.

   ── Was das hier IST ──
   Ein frei getipptes Kürzel, das an DIESEM Gerät gemerkt wird und an einen
   Haken geschrieben wird: „erledigt · 14:20 · MB". Mehr nicht.

   ── Was das hier NICHT ist ──
   Keine Anmeldung, kein Konto, keine Person im Sinne eines Verzeichnisses.
   Es wird NICHT protokolliert, wer wann was ANGESEHEN hat — nur wer eine
   Arbeit als getan gemeldet hat. Der Unterschied ist nicht juristisch,
   sondern grundsätzlich: Das eine ist Überwachung, das andere ist die
   Auskunft, auf die im Saal alle warten.

   Das Kürzel bleibt deshalb GERÄTELOKAL und jederzeit änderbar. Wer ein
   fremdes Tablet benutzt, überschreibt es mit einem Tipp.
   ───────────────────────────────────────────────────────────── */

const KRZ_SCHLUESSEL = 'hkl_kuerzel';

function kuerzel(){
  if(typeof store!=='object' || !store || !store.get) return '';
  return String(store.get(KRZ_SCHLUESSEL) || '').trim();
}
function kuerzelSetzen(wert){
  const w = String(wert||'').trim().slice(0, 12);
  if(typeof store==='object' && store && store.set) store.set(KRZ_SCHLUESSEL, w);
  return w;
}
function kuerzelDa(){ return kuerzel().length > 0; }

/* Ein Vermerk, wie er an einem Haken steht. Rein/testbar. */
function kuerzelVermerk(k, ts){
  const wer = String((k && k.kuerzel) || '').trim();
  const zeit = (k && k.ts) || ts;
  const t = zeit ? kuerzelZeit(zeit) : '';
  return [t, wer].filter(Boolean).join(' · ');
}
/* Zeitangabe, die im Saal etwas nützt: heute die Uhrzeit, sonst das Datum.
   „vor 3 Tagen" ist hübsch und im Zweifel unbrauchbar — wer prüft, ob die
   Wartung vor der Schicht lief, braucht die Uhrzeit. */
function kuerzelZeit(ts){
  const d = new Date(ts);
  if(isNaN(d.getTime())) return '';
  const jetzt = new Date();
  const gleich = d.getFullYear()===jetzt.getFullYear() && d.getMonth()===jetzt.getMonth() && d.getDate()===jetzt.getDate();
  const uhr = String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  if(gleich) return uhr;
  return String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+'. '+uhr;
}

/* Einen Haken setzen — mit Kürzel, wenn eines da ist. Fehlt es, wird EINMAL
   danach gefragt und die Handlung danach fortgesetzt. Nicht blockieren:
   Wer partout keines angeben will, hakt ohne ab; ein Haken ohne Namen ist
   besser als eine Aufgabe, die niemand abhakt (Grundsatz ①). */
function kuerzelHaken(){
  return { ts: new Date().toISOString(), kuerzel: kuerzel() };
}

/* Die Nachfrage — als Karte, nie als natives Fenster (Grundsatz ⑧). */
let krzWeiter = null;
function kuerzelFragen(danach){
  krzWeiter = (typeof danach==='function') ? danach : null;
  const h = `<div class="sheet-grip"></div><div class="sheet-title">Wer bist du?</div>
    <p class="why-help">Ein Kürzel — zwei, drei Buchstaben genügen. Es steht danach neben deinen Haken, damit im anderen Saal jemand sieht, dass es erledigt ist und wer es war. Es bleibt auf diesem Gerät und lässt sich jederzeit ändern.</p>
    <input type="text" id="krzInp" class="txtinp" style="width:100%" maxlength="12" placeholder="z. B. MB" value="${esc(kuerzel())}">
    <div class="p-actions" style="margin-top:12px">
      <button class="btn btn-sec" onclick="kuerzelUeberspringen()">Ohne Kürzel</button>
      <button class="btn btn-pri" onclick="kuerzelSpeichern()">Übernehmen</button></div>`;
  $('sheet').innerHTML = h;
  if(typeof showSheet==='function') showSheet(true);
  const i = $('krzInp');
  if(i){ setTimeout(()=>{ try{ i.focus(); i.select(); }catch(e){} }, 50);
    i.onkeydown = (ev)=>{ if(ev.key==='Enter'){ ev.preventDefault(); kuerzelSpeichern(); } }; }
}
function kuerzelSpeichern(){
  const i = $('krzInp');
  kuerzelSetzen(i ? i.value : '');
  const f = krzWeiter; krzWeiter = null;
  if(typeof showSheet==='function') showSheet(false);
  if(f) f();
}
function kuerzelUeberspringen(){
  const f = krzWeiter; krzWeiter = null;
  if(typeof showSheet==='function') showSheet(false);
  if(f) f();
}
/* Vor einer Handlung sicherstellen, dass ein Kürzel da ist — höchstens einmal. */
function kuerzelDannn(fn){
  if(kuerzelDa()){ fn(); return; }
  kuerzelFragen(fn);
}
