/* ============================================================
   HKL Standards v4 — Logik
   ============================================================ */
const DATA_URL='data/hkl_standards_export.json';
/* Hook: wird nach jedem store.set(key) aufgerufen. Der Server-Sync-Baustein
   hängt sich hier ein, um geänderte Schlüssel an /api/state zu schicken. */
let onStoreSet=null;
const store=(()=>{ let mem={},ok=false; try{localStorage.setItem('__t','1');localStorage.removeItem('__t');ok=true;}catch(e){ok=false;}
  return { get(k){try{return ok?localStorage.getItem(k):(k in mem?mem[k]:null);}catch(e){return (k in mem)?mem[k]:null;}}, set(k,v){try{ok?localStorage.setItem(k,v):(mem[k]=v);}catch(e){mem[k]=v;} if(onStoreSet){try{onStoreSet(k);}catch(_){}} } }; })();
/* schreibt in den Store OHNE den Sync-Hook auszulösen (für eingehende
   Server-Daten – sonst würden wir Fremdänderungen sofort zurückspielen). */
function storeSetQuiet(k,v){ const h=onStoreSet; onStoreSet=null; try{ store.set(k,v); } finally { onStoreSet=h; } }
const $=(id)=>document.getElementById(id);
const esc=(s)=>(s==null?'':String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])));
const today=()=>new Date().toISOString().slice(0,10);
function loadJSON(k,def){ try{ const r=store.get(k); return r?JSON.parse(r):def; }catch(e){ return def; } }
function saveJSON(k,v){ store.set(k,JSON.stringify(v)); }

