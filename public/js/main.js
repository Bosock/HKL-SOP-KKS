/* Bootstrap: erst Server-Stand holen, dann App rendern, dann Sync aktiv. */
(async function boot(){
  await initAuth();
  await sync.init();
  await load();
  if(typeof initLightbox==='function') initLightbox();   /* Foto-Detailansicht app-weit */
  /* Die Symbole der Kopfleiste können vom Haus abgeschaltet sein — erst NACH
     dem Laden des geteilten Zustands anwenden, sonst blitzt ein Symbol auf,
     das jemand ausgeblendet hat (features/funktionen.js). */
  if(typeof fktKopfAnwenden==='function') try{ fktKopfAnwenden(); }catch(e){}
  sync.start();
  /* Bestands-Sanierung im Leerlauf: übergroße Alt-Fotos nachverkleinern
     (siehe migrateCarePhotos in features/care.js). */
  setTimeout(()=>{ try{ migrateCarePhotos(); }catch(e){} }, 3000);
})();
