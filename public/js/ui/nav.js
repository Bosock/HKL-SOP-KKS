/* ============ Kopf / Navigation ============ */
function setBar(t,c,b){ $('barTitle').textContent=t; $('barCrumb').textContent=c; $('backBtn').hidden=!b; }
function updateBar(){ const total=DB.standards.length;
  if(mode==='use'&&nav.length===0) setBar(txt('appTitle'),total+' Standards',false);
  else if(mode==='care'&&!$('scr-care-item').classList.contains('active')){ const d=MAT_INDEX.filter(m=>(typeof canonId==='function'&&canonId(m.key))||careMem[m.key]).length; setBar('Material',MAT_INDEX.length+' Materialien · '+d+' gepflegt',false); }
  else if(mode==='catalog'){ setBar('Katalog',CATALOG.items.length+' Geräte & Materialien',false); }
  else if(mode==='admin') setBar('Verwaltung','Kategorien · Unterkategorien · Prüfen',false);
}
function show(scr){ document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active')); $(scr).classList.add('active'); $('main').scrollTop=0; }
function setMode(m){ if(!ADMIN&&m!=='use') m='use'; mode=m; formCtx=null; /* offenes Formular verwerfen beim Moduswechsel */
  $('mUse').classList.toggle('on',m==='use'); $('mCatalog').classList.toggle('on',m==='catalog'); $('mCare').classList.toggle('on',m==='care'); $('mAdmin').classList.toggle('on',m==='admin');
  $('searchWrap').style.display=(m==='use'&&nav.length===0)?'block':'none';
  if(m==='use'){ nav=[]; try{ history.replaceState({d:0},''); }catch(e){} renderStandards(); show('scr-standards'); }
  else if(m==='catalog'){ renderCatalog(); show('scr-catalog'); }
  else if(m==='care'){ renderCare(); show('scr-care'); } else { renderAdmin(); show('scr-admin'); }
  updateBar();
}

