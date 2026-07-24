/* Bootstrap: erst Server-Stand holen, dann App rendern, dann Sync aktiv. */
(async function boot(){
  await initAuth();
  await sync.init();
  await load();
  if(typeof initLightbox==='function') initLightbox();   /* Foto-Detailansicht app-weit */
  sync.start();
  /* Bestands-Sanierung im Leerlauf: übergroße Alt-Fotos nachverkleinern
     (siehe migrateCarePhotos in features/care.js). */
  setTimeout(()=>{ try{ migrateCarePhotos(); }catch(e){} }, 3000);
})();
