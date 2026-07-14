/* Bootstrap: erst Server-Stand holen, dann App rendern, dann Sync aktiv. */
(async function boot(){
  await initAuth();
  await sync.init();
  await load();
  sync.start();
})();
