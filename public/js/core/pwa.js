/* Registriert den Service Worker (Offline-Fähigkeit). Bewusst nicht-blockierend:
   der App-Start (boot in main.js) wartet nicht darauf. Kein erzwungener Reload
   bei Updates – die neue Shell greift beim nächsten App-Start. */
(function registerSW(){
  if(!('serviceWorker' in navigator)) return;
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(err=>{
      console.warn('[pwa] Service-Worker-Registrierung fehlgeschlagen:', err && err.message);
    });
  });
})();
