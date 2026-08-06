/* ============ Kopf / Navigation ============ */
function setBar(t,c,b){ $('barTitle').textContent=t; $('barCrumb').textContent=c; $('backBtn').hidden=!b; }
function updateBar(){ const total=DB.standards.length;
  if(mode==='use'&&nav.length===0) setBar(txt('appTitle'),total+' Standards',false);
  else if(mode==='care'){
    /* Gezählt wird nicht mehr, was „verknüpft" ist — das war die Naht des
       Datenmodells, nicht die Arbeit. Gezählt wird, was NOCH FEHLT. */
    const offen=MAT_INDEX.filter(m=>{
      const c=(typeof canonOf==='function')?canonOf(m.key):null;
      const care=careMem[m.key];
      const foto=(c&&c.photo)||(care&&care.photo);
      const ort=(c&&c.lagerort)||(care&&care.loc);
      return !foto || !ort;
    }).length;
    setBar('Material', MAT_INDEX.length+' Materialien · '+(offen?(offen+' unvollständig'):'alle gepflegt'), false); }
  else if(mode==='catalog'){ setBar('Katalog',CATALOG.items.length+' Geräte & Materialien',false); }
  else if(mode==='admin') setBar('Verwaltung','Kategorien · Unterkategorien · Prüfen',false);
}
function show(scr){ document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active')); $(scr).classList.add('active'); $('main').scrollTop=0; }
function setMode(m){ if(!ADMIN&&m!=='use') m='use'; mode=m; formCtx=null; /* offenes Formular verwerfen beim Moduswechsel */
  $('searchWrap').style.display=(m==='use'&&nav.length===0)?'block':'none';
  if(m==='use'){ nav=[]; try{ history.replaceState({d:0},''); }catch(e){} renderStandards(); show('scr-standards'); }
  else if(m==='catalog'){ renderCatalog(); show('scr-catalog'); }
  else if(m==='care'){ renderCare(); show('scr-care'); } else { renderAdmin(); show('scr-admin'); }
  updateBar();
}

