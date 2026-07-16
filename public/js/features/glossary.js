/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — ABKÜRZUNGSGLOSSAR
   Ein eigener Reiter (☰-Menü) mit Begriffen/Abkürzungen und ihrer
   Bedeutung. Für alle durchsuch- und lesbar; Pflege (anlegen/bearbeiten/
   löschen) nur im Verwaltungsmodus. Zentral geteilt über hkl_glossary.
     GLOSSARY = [ { id, term, def } ]  (alphabetisch nach term)
   ───────────────────────────────────────────────────────────── */
function loadGlossary(){ const g=loadJSON('hkl_glossary',[]); return Array.isArray(g)?g:[]; }
let GLOSSARY=loadGlossary();
function saveGlossary(){ GLOSSARY.sort((a,b)=>(a.term||'').localeCompare(b.term||'','de')); saveJSON('hkl_glossary',GLOSSARY); }

/* Reine Filterfunktion (testbar): Begriffe, deren Term oder Bedeutung den
   Suchtext enthalten; leere Suche = alle. */
function filterGlossary(list,q){ q=(q||'').trim().toLowerCase(); const arr=(list||[]).slice().sort((a,b)=>(a.term||'').localeCompare(b.term||'','de'));
  if(!q) return arr; return arr.filter(g=>((g.term||'')+' '+(g.def||'')).toLowerCase().indexOf(q)>=0); }

function openGlossary(){ showSheet(false); formCtx=null; mode='use'; nav=[]; /* Zurück → Übersicht */
  renderGlossary(''); show('scr-glossary'); setBar('Abkürzungsglossar','Begriffe & Abkürzungen',true); $('searchWrap').style.display='none'; }

function renderGlossary(q){ const addBtn=ADMIN?`<button class="add-entry-btn" onclick="addGlossaryTerm()">＋ Begriff hinzufügen</button>`:'';
  const search=`<div class="std-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><input type="search" id="glSearchInput" placeholder="Begriff oder Abkürzung suchen …" value="${esc(q||'')}" oninput="glossarySearch(this.value)" autocomplete="off"></div>`;
  const list=filterGlossary(GLOSSARY,q);
  let body;
  if(!GLOSSARY.length){ body=`<div class="empty"><div class="ei">📖</div><h3>Glossar ist leer</h3><p>${ADMIN?'Lege den ersten Begriff über „＋ Begriff hinzufügen" an.':'Es wurden noch keine Begriffe hinterlegt.'}</p></div>`; }
  else if(!list.length){ body=`<div class="empty"><div class="ei">🔍</div><h3>Kein Treffer</h3><p>„${esc(q)}" ist im Glossar nicht hinterlegt.</p></div>`; }
  else { body=list.map(g=>{ const admin=ADMIN?`<span class="gl-actions"><button type="button" onclick="editGlossaryTerm('${esc(g.id)}')" aria-label="Bearbeiten">✎</button><button type="button" onclick="deleteGlossaryTerm('${esc(g.id)}')" aria-label="Löschen">🗑</button></span>`:'';
      return `<div class="gl-card"><div class="gl-main"><div class="gl-term">${esc(g.term)}</div><div class="gl-def">${esc(g.def).replace(/\n/g,'<br>')}</div></div>${admin}</div>`; }).join(''); }
  $('scr-glossary').innerHTML=search+addBtn+`<div id="glList">${body}</div>`; }

function glossarySearch(q){ const list=filterGlossary(GLOSSARY,q); const box=$('glList'); if(!box) return;
  if(!GLOSSARY.length){ return; }
  if(!list.length){ box.innerHTML=`<div class="empty"><div class="ei">🔍</div><h3>Kein Treffer</h3><p>„${esc(q)}" ist im Glossar nicht hinterlegt.</p></div>`; return; }
  box.innerHTML=list.map(g=>{ const admin=ADMIN?`<span class="gl-actions"><button type="button" onclick="editGlossaryTerm('${esc(g.id)}')" aria-label="Bearbeiten">✎</button><button type="button" onclick="deleteGlossaryTerm('${esc(g.id)}')" aria-label="Löschen">🗑</button></span>`:'';
    return `<div class="gl-card"><div class="gl-main"><div class="gl-term">${esc(g.term)}</div><div class="gl-def">${esc(g.def).replace(/\n/g,'<br>')}</div></div>${admin}</div>`; }).join(''); }

function addGlossaryTerm(){ if(!ADMIN) return; const term=prompt('Abkürzung / Begriff:',''); if(term==null||!term.trim()) return;
  const def=prompt('Bedeutung / Erklärung:',''); if(def==null) return;
  GLOSSARY.push({ id:newAid(), term:term.trim(), def:(def||'').trim() }); saveGlossary(); renderGlossary(''); toast('Begriff hinzugefügt'); }
function editGlossaryTerm(id){ if(!ADMIN) return; const g=GLOSSARY.find(x=>x.id===id); if(!g) return;
  const term=prompt('Abkürzung / Begriff:',g.term); if(term==null||!term.trim()) return;
  const def=prompt('Bedeutung / Erklärung:',g.def); if(def==null) return;
  g.term=term.trim(); g.def=(def||'').trim(); saveGlossary(); renderGlossary($('glSearchInput')?$('glSearchInput').value:''); toast('Gespeichert'); }
function deleteGlossaryTerm(id){ if(!ADMIN) return; const g=GLOSSARY.find(x=>x.id===id); if(!g) return; if(!confirm('Begriff „'+g.term+'" löschen?')) return;
  GLOSSARY=GLOSSARY.filter(x=>x.id!==id); saveGlossary(); renderGlossary($('glSearchInput')?$('glSearchInput').value:''); toast('Gelöscht'); }
