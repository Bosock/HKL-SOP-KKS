/* Registriert den Service Worker (Offline-Fähigkeit). Bewusst nicht-blockierend:
   der App-Start (boot in main.js) wartet nicht darauf.

   Update-Auslieferung: Der neue SW ruft in install skipWaiting() und in
   activate clients.claim() – dadurch übernimmt er sofort die Kontrolle und
   feuert 'controllerchange'. Wir laden die Seite dann GENAU EINMAL neu, damit
   die frische App-Shell (neuer Code) sofort greift. Ohne diesen Reload lief in
   installierten PWAs weiter der alte, gecachte Code, bis die App komplett
   beendet wurde – deploye Änderungen kamen scheinbar „nicht an". Alle Eingaben
   liegen bereits im localStorage, ein Reload verliert daher nichts.
   Der Erst-Install (noch kein Controller) löst KEINEN Reload aus. */
(function registerSW(){
  if(!('serviceWorker' in navigator)) return;
  let reloading=false;
  const hadController=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(reloading||!hadController) return; reloading=true;
    try{ location.reload(); }catch(e){}
  });
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(err=>{
      console.warn('[pwa] Service-Worker-Registrierung fehlgeschlagen:', err && err.message);
    });
    pwaStandLesen();
  });
})();

/* Welcher Stand läuft hier gerade? Die einzige ehrliche Antwort steht im Namen
   des Shell-Zwischenspeichers, den der Service Worker angelegt hat („hkl-shell-v63").
   Nur der sagt, welcher AUSGELIEFERTE Code im Browser liegt — eine Nummer im
   Quelltext sagte nur, was ausgeliefert werden SOLLTE.

   Der Diagnose-Bericht braucht das: „bei mir geht es nicht" ist ohne den Stand
   nicht beantwortbar. Gelesen wird einmal beim Start; bis dahin steht dort
   nichts, und das ist ehrlicher als eine geratene Nummer. */
let APP_STAND = '';
function pwaStandLesen(){
  if(typeof caches==='undefined' || !caches.keys) return;
  caches.keys().then(namen=>{
    const shell = (namen||[]).filter(n=>String(n).indexOf('hkl-shell-')===0).sort().pop();
    if(shell) APP_STAND = String(shell).replace('hkl-shell-','');
  }).catch(()=>{});
}
