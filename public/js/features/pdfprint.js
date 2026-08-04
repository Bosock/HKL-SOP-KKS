/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — DRUCK / PDF-EXPORT eines Standards
   Baut aus dem gerade geöffneten Standard eine saubere, druckoptimierte
   Ansicht in #printRoot und ruft window.print() – der Browser erzeugt
   daraus ein PDF („Als PDF speichern"). Kein externer Dienst, keine
   Abhängigkeit; das @media-print-CSS blendet die App aus und nur die
   Druckansicht ein. Länge flexibel (nicht auf 2 Seiten gezwängt).
   ───────────────────────────────────────────────────────────── */

/* Effektiver Anzeigewert eines Eintrags fürs Drucken (mit Overlays). */
function prEntry(e,cid){
  const dn=qeGet(e,cid,'name'); const name=(dn!==undefined?dn:e.anzeige_text)||'';
  const mv=qeGet(e,cid,'mengeVal'); const menge=(mv!==undefined?mv:e.menge)||'';
  const gv=qeGet(e,cid,'groessen'); const groe=(gv!==undefined?gv:e.groessen)||[];
  const sizes=(groe||[]).map(g=>g.wert).filter(Boolean).join(', ');
  const sv=qeGet(e,cid,'spez'); const spRaw=(sv!==undefined)?sv:e.spezifikation; const spez=Array.isArray(spRaw)?spRaw.join(' · '):(spRaw||'');
  const care=e.material_key?careMem[e.material_key]:null; const loc=(care&&care.loc)||'';
  const meta=[sizes, spez, loc?('📍 '+loc):''].filter(Boolean).join('  ·  ');
  return { name, menge, meta };
}
function prRow(e,cid){ const x=prEntry(e,cid);
  return `<div class="pr-row"><span class="pr-menge">${esc(x.menge)}</span><span class="pr-name">${esc(x.name)}</span>${x.meta?`<span class="pr-meta">${esc(x.meta)}</span>`:''}</div>`; }

function prRubric(s,r,ri){ const isMatGer=(r.typ==='material'||r.typ==='geraete'); let out='';
  if(isMatGer){
    const groups=new Map(); let ord=0;
    (r.sub_bereiche||[]).forEach((sb,si)=>{ (sb.eintraege||[]).forEach((e,ei)=>{
      if(e.natur==='ueberschrift') return; if(settings.fliesstext===false&&e.ist_fliesstext) return;
      const cid=cidOf(s.id,ri,si,ei); if(qeGet(e,cid,'hidden')===true) return;
      const uk=canonUk(e,cid)||''; if(!groups.has(uk)) groups.set(uk,{first:ord++,rows:[]});
      groups.get(uk).rows.push(prRow(e,cid)); }); });
    [...groups.entries()].sort((a,b)=>a[1].first-b[1].first).forEach(([uk,g])=>{
      if(uk) out+=`<div class="pr-uk">${esc(uk)}</div>`; out+=g.rows.join(''); });
  } else {
    (r.sub_bereiche||[]).forEach((sb,si)=>{ if(sb.name) out+=`<div class="pr-uk">${esc(sb.name)}</div>`;
      (sb.eintraege||[]).forEach((e,ei)=>{ const cid=cidOf(s.id,ri,si,ei);
        if(e.natur==='ueberschrift'){ out+=`<div class="pr-uk">${esc(e.anzeige_text||e.roh_text||'')}</div>`; return; }
        if(settings.fliesstext===false&&e.ist_fliesstext) return; if(qeGet(e,cid,'hidden')===true) return;
        out+=prRow(e,cid); }); });
  }
  return out?`<section class="pr-rub"><h2>${esc(rubName(r,ri))}</h2>${out}</section>`:''; }

function buildPrintHTML(s){ const rubs=(s.rubriken||[]).map((r,i)=>({r,i})).filter(x=>!rubHidden(x.r,x.i)).sort((a,b)=>rubOrd(a.r,a.i)-rubOrd(b.r,b.i));
  let body=''; rubs.forEach(({r,i})=>{ body+=prRubric(s,r,i); });
  /* Das Statuswort kommt aus der Konfiguration (Grundsatz ④/⑤) — im Datensatz
     steht ein Schlüssel. Rückfall auf das mitgeschriebene Wort, falls
     freigabe.js nicht geladen ist. */
  const meta=STDE[s.id]||{};
  const statusWort=(typeof frgZustandWort==='function'&&typeof frgZustand==='function')
    ? (frgZustandWort(frgZustand(meta))||'') : (meta.status||'');
  const verLine=(meta.version||statusWort)?`<div class="pr-ver">${meta.version?('Version '+esc(meta.version)):''}${meta.version&&statusWort?' · ':''}${statusWort?esc(statusWort):''}${meta.validFrom?(' · gültig ab '+esc(meta.validFrom)):''}</div>`:'';
  return `<article class="pr-doc"><header class="pr-head"><div class="pr-grp">${esc(stdGruppe(s))}</div><h1>${esc(stdTitel(s))}</h1>${verLine}<div class="pr-date">Stand: ${esc(new Date().toLocaleDateString('de-DE'))}</div></header>${body||'<p>Keine Inhalte.</p>'}<footer class="pr-foot">HKL-Standards · ${esc(stdTitel(s))}</footer></article>`; }

function printStandard(){ const s=curStd; if(!s){ toast('Kein Standard geöffnet',true); return; }
  const root=$('printRoot'); if(!root) return; root.innerHTML=buildPrintHTML(s);
  document.body.classList.add('printing');
  const cleanup=()=>{ document.body.classList.remove('printing'); window.removeEventListener('afterprint',cleanup); };
  window.addEventListener('afterprint',cleanup);
  setTimeout(()=>{ try{ window.print(); }catch(e){ cleanup(); toast('Drucken nicht möglich',true); } },80); }
