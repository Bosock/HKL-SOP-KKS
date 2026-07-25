/* ============ Material-Modus + Foto-Werkzeuge ============
   Der „care"-Modus rendert die MATERIAL-ZENTRALE (features/matcenter.js):
   ein Ort für Material, Einträge, Ordnung und Prüfen.

   Historie: Früher lagen hier zwei parallele Masken — „Material pflegen"
   (Foto/Lagerort in hkl_care, Hersteller/REF/Preis in hkl_prod) und der
   Stammsatz-Editor des Etikett-Scanners (hkl_gtin). Beide pflegten DIESELBEN
   Felder in VERSCHIEDENE Töpfe. Die alte Maske wurde entfernt; ihre Daten
   gehen über „Prüfen → Alt-Daten übernehmen" nicht-destruktiv in die
   Stammsätze über (mcMigrateLegacy). Gelesen werden die Alt-Töpfe weiterhin,
   damit auf keinem Gerät etwas verschwindet.

   Hier bleiben die FOTO-WERKZEUGE, weil sie app-weit gebraucht werden
   (Stammsatz-Editor, Anleitungs-Schritte, Foto-Editor). */

function renderCare(){
  if(typeof renderMatCenter==='function'){ renderMatCenter(); return; }
  const box=$('scr-care'); if(box) box.innerHTML='<p class="hint">Materialverwaltung nicht verfügbar.</p>';
}

/* Verkleinert ein Foto clientseitig (max. Kante 1280px, JPEG ~82 %), bevor es
   als data-URL in den geteilten Zustand wandert. Ohne das wären Handyfotos
   4–16 MB Base64 pro Bild: wenige Fotos füllen das Server-Limit (MAX_BODY)
   und jede Synchronisation überträgt alle Fotos an alle Geräte. Schlägt das
   Dekodieren fehl (exotisches Format), bleibt das Original der Fallback. */
function shrinkPhoto(dataUrl,cb){ const MAX=1280; const img=new Image();
  img.onload=()=>{ try{
      let w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
      if(!w||!h){ cb(dataUrl); return; }
      if(w>MAX||h>MAX){ const f=MAX/Math.max(w,h); w=Math.round(w*f); h=Math.round(h*f); }
      const c=document.createElement('canvas'); c.width=w; c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      const out=c.toDataURL('image/jpeg',0.82);
      /* nur übernehmen, wenn wirklich kleiner – sonst Original behalten */
      cb(out.length<dataUrl.length?out:dataUrl);
    }catch(e){ cb(dataUrl); } };
  img.onerror=()=>cb(dataUrl);
  img.src=dataUrl; }

/* Verkleinert einmalig ALT-Fotos, die vor Einführung der automatischen
   Verkleinerung in Originalgröße gespeichert wurden (QA-Befund P1: solche
   Bestände füllen Geräte-Quota und Server-Limit). Läuft im Leerlauf nach dem
   Start, ein Foto je Tick; idempotent über die Größenprüfung; das Ergebnis
   wird geteilt gespeichert — EIN Gerät saniert damit den Bestand für alle. */
const CARE_PHOTO_MAX=400000; /* ~300 KB Base64 – darüber wird nachverkleinert */
function migrateCarePhotos(done){
  let changed=false;
  const keys=Object.keys(careMem).filter(k=>careMem[k]&&careMem[k].photo&&careMem[k].photo.length>CARE_PHOTO_MAX);
  let i=0;
  (function step(){
    if(i>=keys.length){ if(changed) saveJSON('hkl_care',careMem); if(done) done({migrated:changed?keys.length:0}); return; }
    const k=keys[i++];
    try{ shrinkPhoto(careMem[k].photo,(small)=>{ if(small&&small.length<careMem[k].photo.length){ careMem[k].photo=small; changed=true; } setTimeout(step,120); }); }
    catch(e){ setTimeout(step,120); }
  })();
}
