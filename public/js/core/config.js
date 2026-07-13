/* ─────────────────────────────────────────────────────────────
   BAUSTEIN 1 — KONFIGURATION (die einzige Quelle der Wahrheit)
   DEFAULT_NAT sind die Voreinstellungen im Code. Sie werden von
   deinen über die Oberfläche gemachten Änderungen überschrieben.
   ───────────────────────────────────────────────────────────── */
/* Passwort-Schutz (Komfort, keine echte Sicherheit). Start-Passwort: 1234567; in der App änderbar. */
const AUTH_DEFAULT_PW='1234567';
const AUTH_TTL=3600*1000; /* Verwaltungsmodus bleibt bis 1 Stunde Inaktivität aktiv */
function pwHash(s){ let h=5381; s=String(s); for(let i=0;i<s.length;i++){ h=(((h<<5)+h)+s.charCodeAt(i))>>>0; } return 'h'+h.toString(36); }
function getAuthHash(){ return store.get('hkl_authpw') || pwHash(AUTH_DEFAULT_PW); }
function checkPw(pw){ return pwHash(pw)===getAuthHash(); }
function setAuthPw(pw){ store.set('hkl_authpw', pwHash(pw)); }
function authValid(){ return Date.now() < (+(store.get('hkl_authuntil')||0)); }
function refreshAuth(){ if(ADMIN) store.set('hkl_authuntil', String(Date.now()+AUTH_TTL)); }
const DEFAULT_NAT=[
  {key:'material',    label:'Material',    color:'#34c98a', icon:'📦',  builtin:true, beschaffbar:true },
  {key:'geraet',      label:'Gerät',       color:'#e8b34a', icon:'🖥',  builtin:true, beschaffbar:true },
  {key:'medikament',  label:'Medikament',  color:'#bd8ce8', icon:'💊',  builtin:true, beschaffbar:false},
  {key:'hinweis',     label:'Hinweis',     color:'#7f95ab', icon:'ℹ️',  builtin:true, beschaffbar:false},
  {key:'ueberschrift',label:'Überschrift', color:'#3d9be0', icon:'▸',   builtin:true, beschaffbar:false},
];
function loadNatCfg(){
  const saved=loadJSON('hkl_natcfg',null);
  const items={}, order=[];
  DEFAULT_NAT.forEach(n=>{ items[n.key]={...n}; order.push(n.key); });
  if(saved&&saved.items){
    Object.keys(saved.items).forEach(k=>{ if(items[k]) items[k]={...items[k],...saved.items[k]}; else items[k]={beschaffbar:false,builtin:false,...saved.items[k],key:k}; });
    if(Array.isArray(saved.order)&&saved.order.length){ const o=saved.order.filter(k=>items[k]); order.length=0; o.forEach(k=>order.push(k)); Object.keys(items).forEach(k=>{ if(!order.includes(k)) order.push(k); }); }
  }
  return {items,order};
}
function saveNatCfg(){ store.set('hkl_natcfg',JSON.stringify({order:NATCFG.order,items:NATCFG.items})); }
function natList(){ return NATCFG.order.map(k=>({key:k,...NATCFG.items[k]})); }
function natOf(key){ return NATCFG.items[key]||{key,label:key,color:'#7f95ab',icon:'•',beschaffbar:false,builtin:false}; }
/* schreibt die Konfigurationsfarben als CSS-Variablen — die App liest sie überall */
function applyNatConfig(){ const root=document.documentElement; natList().forEach(n=>{ root.style.setProperty('--n-'+n.key, n.color); }); }
function natSlug(s){ let base=(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')||'kat'; let k=base,i=2; while(NATCFG.items[k]){k=base+'_'+i;i++;} return k; }

