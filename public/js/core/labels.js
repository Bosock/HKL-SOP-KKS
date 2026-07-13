const UK_PALETTE=['#34c98a','#e8b34a','#bd8ce8','#5fb0e0','#e0795f','#5fd0c0','#c9a24a','#d47fb0'];
function sizeLabel(t){ return ({french:'Fr',laenge:'Länge',durchmesser:'Ø',volumen:'Vol',dimension:'Maß',naht:'Stärke',groesse_kuerzel:'Größe',typcode:'Typ','durchmesser+french':'Ø·Fr'})[t]||t||''; }
function rubrikIcon(name,typ){ if(typeof RUBICON!=='undefined'&&RUBICON[name]) return RUBICON[name]; const n=(name||'').toLowerCase();
  if(n.includes('saal')||n.includes('gerät')||n.includes('gerae'))return '🖥'; if(n.includes('notfall'))return '🧰';
  if(n.includes('material'))return '📦'; if(n.includes('patient'))return '🫀'; if(n.includes('tisch'))return '🩺';
  if(n.includes('ablauf')||n.includes('prozedur'))return '📋'; if(n.includes('bettenwarte'))return '🛏';
  if(n.includes('abschließend')||n.includes('abschliess'))return '✔'; if(typ==='material')return '📦'; if(typ==='geraete')return '🖥'; return '📄'; }
function typLabel(t){ return t==='material'?'Material':t==='geraete'?'Geräte':'Ablauf'; }
function ukKeywordIcon(name){ const n=(name||'').toLowerCase();
  if(n.includes('lager'))return '📦'; if(n.includes('vorbereitungsraum'))return '🧰'; if(n.includes('raum'))return '🚪';
  if(n.includes('ansage'))return '📢'; if(n.includes('weitere'))return '➕'; if(n.includes('notfall'))return '🚨';
  if(n.includes('bettenwarte'))return '🛏'; if(n.includes('zugang'))return '🩸'; if(n.includes('aggregat'))return '🔋'; return '🗂'; }

