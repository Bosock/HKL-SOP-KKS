/* ─────────────────────────────────────────────────────────────
   BAUSTEIN — FARB-HELFER (Kontrast)
   Reine Funktionen (kein DOM/Store) für die frei wählbaren Eintrags-/
   Banner-Farben: aus einer Füllfarbe wird automatisch eine gut lesbare
   Textfarbe (schwarz oder weiß) nach WCAG-Kontrast bestimmt.
   ───────────────────────────────────────────────────────────── */
function hexToRgb(hex){ if(typeof hex!=='string') return null; let h=hex.trim().replace(/^#/,'');
  if(h.length===3) h=h.split('').map(c=>c+c).join('');
  if(!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return { r:parseInt(h.slice(0,2),16), g:parseInt(h.slice(2,4),16), b:parseInt(h.slice(4,6),16) }; }
function _lin(c){ c=c/255; return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4); }
/* Relative Leuchtdichte (WCAG) einer Hex-Farbe, 0..1. */
function relLuminance(hex){ const p=hexToRgb(hex); if(!p) return 0; return 0.2126*_lin(p.r)+0.7152*_lin(p.g)+0.0722*_lin(p.b); }
/* Kontrastverhältnis zweier Hex-Farben (1..21). */
function contrastRatio(a,b){ const la=relLuminance(a), lb=relLuminance(b); const hi=Math.max(la,lb), lo=Math.min(la,lb); return (hi+0.05)/(lo+0.05); }
/* Wählt für einen Hintergrund die besser lesbare Textfarbe (dunkel/weiß). */
function pickTextColor(bg){ const dark='#0b1116', light='#ffffff'; return contrastRatio(bg,light)>=contrastRatio(bg,dark) ? light : dark; }
