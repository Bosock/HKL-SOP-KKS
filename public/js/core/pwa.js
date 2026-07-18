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
  });
})();
