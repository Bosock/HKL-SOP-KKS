/* ============ Deep-Link / Suche / Theme / Toast ============ */
function applyDeepLink(){ const h=location.hash||''; const m=h.match(/^#\/std\/(.+)$/); if(m){ const id=decodeURIComponent(m[1]); if(DB.standards.find(s=>s.id===id)){ setMode('use'); openStandard(id); } } }
$('searchInput').addEventListener('input',e=>{ const v=e.target.value; $('searchClear').classList.toggle('show',v.length>0); renderStandards(v); });
$('searchClear').addEventListener('click',()=>{ $('searchInput').value=''; $('searchClear').classList.remove('show'); renderStandards(''); $('searchInput').focus(); });
function toggleTheme(){ const cur=document.documentElement.getAttribute('data-theme'); const next=cur==='light'?'dark':'light'; document.documentElement.setAttribute('data-theme',next); const tb=$('themeBtn'); if(tb) tb.textContent=next==='light'?'☀':'◐'; store.set('hkl_theme',next); applyNatConfig(); applyDesign(); }
(function initTheme(){ const t=store.get('hkl_theme'); if(t){ document.documentElement.setAttribute('data-theme',t); const tb=$('themeBtn'); if(tb) tb.textContent=t==='light'?'☀':'◐'; } })();
let tTimer; function toast(msg,err){ const t=$('toast'); t.textContent=msg; t.className='toast show'+(err?' err':''); clearTimeout(tTimer); tTimer=setTimeout(()=>t.className='toast',2000); }

$('mUse').onclick=()=>setMode('use'); $('mCatalog').onclick=()=>setMode('catalog'); $('mCare').onclick=()=>setMode('care'); $('mAdmin').onclick=()=>setMode('admin');
$('backBtn').onclick=goBack; $('themeBtn').onclick=toggleTheme; $('menuBtn').onclick=openMenu;
document.addEventListener('click',()=>{ if(ADMIN) refreshAuth(); });
window.addEventListener('hashchange',()=>{ checkAdminHash(); });
window.addEventListener('popstate',(e)=>{ gotoState(e.state); });

