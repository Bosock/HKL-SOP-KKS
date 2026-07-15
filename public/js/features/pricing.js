/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — MATERIAL-PREISE & PLANKOSTEN
   Preisstammdaten liegen – wie die Materialpflege – je material_key in
   einem eigenen, server-geteilten Schlüssel `hkl_prod`:
     PROD[material_key] = { hersteller, ref, verwendung, preis(Zahl €) }
   Daraus werden je Standard die „Plankosten" berechnet (Summe aus
   Menge × Stückpreis über alle beschaffbaren Materialien/Geräte).
   ───────────────────────────────────────────────────────────── */
let PROD=loadJSON('hkl_prod',{}); function saveProd(){ saveJSON('hkl_prod',PROD); }

/* --- reine Helfer (ohne DOM/Store – daher testbar) --- */
/* Parst eine Preiseingabe („12,50 €", „1.234,56", "12.5") in eine Zahl (€) oder null. */
function parsePreis(str){
  if(str==null) return null;
  if(typeof str==='number') return isFinite(str)?str:null;
  let s=String(str).trim(); if(!s) return null;
  s=s.replace(/[^0-9.,-]/g,'');
  if(s.indexOf(',')>=0 && s.indexOf('.')>=0){ s=s.replace(/\./g,'').replace(',', '.'); }
  else if(s.indexOf(',')>=0){ s=s.replace(',', '.'); }
  const n=parseFloat(s); return isFinite(n)?n:null;
}
/* Formatiert eine Zahl als Euro-Betrag im deutschen Format („1.234,56 €"). */
function fmtEUR(n){
  if(n==null||!isFinite(n)) return '–';
  const neg=n<0; const v=Math.abs(n).toFixed(2); const parts=v.split('.');
  const ganz=parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  return (neg?'-':'')+ganz+','+parts[1]+' €';
}
/* Ermittelt die Stückzahl aus einer Mengenangabe („2x", „2 ×", 3) – Standard 1. */
function mengeNum(menge){
  if(menge==null) return 1;
  if(typeof menge==='number') return (isFinite(menge)&&menge>0)?Math.floor(menge):1;
  const m=String(menge).match(/\d+/); if(!m) return 1;
  const n=parseInt(m[0],10); return (isFinite(n)&&n>0)?n:1;
}

/* --- Plankosten je Standard (nutzt den laufenden App-Zustand) --- */
/* Alle beschaffbaren Material-/Geräte-Einträge eines Standards (mit Menge). */
function stdMatEntries(std){ const out=[];
  (std.rubriken||[]).forEach((r,ri)=>{ if(r.typ!=='material'&&r.typ!=='geraete') return;
    (r.sub_bereiche||[]).forEach((sb,si)=>{ (sb.eintraege||[]).forEach((e,ei)=>{
      if(e.natur==='ueberschrift'||e.ist_fliesstext) return;
      const cid=cidOf(std.id,ri,si,ei); if(qeGet(e,cid,'hidden')===true) return;
      if(!natOf(effNatur(e,cid)).beschaffbar) return; const key=e.material_key; if(!key) return;
      const mv=qeGet(e,cid,'mengeVal'); const menge=(mv!==undefined?mv:e.menge);
      out.push({key,menge}); }); });
  }); return out; }
/* Summiert Plankosten und zählt, wie viele Materialien einen Preis haben. */
function stdPlankosten(std){ let total=0, priced=0, items=0;
  stdMatEntries(std).forEach(x=>{ items++; const p=PROD[x.key]; if(p&&p.preis!=null){ total+=mengeNum(x.menge)*p.preis; priced++; } });
  return {total,priced,items}; }
