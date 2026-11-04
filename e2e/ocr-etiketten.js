/* Synthetische Etikett-Fotos für den OCR-Messstand (e2e/messen-ocr.js) und
   die OCR-Prüfung (e2e/ocr.js).

   Warum synthetisch? Echte Etikettfotos wären besser — aber sie müssten erst
   gesammelt werden. Bis dahin bilden diese Etiketten die typischen Muster
   nach (Herstellerzeile, Markenname mit ™, Gerätetyp, umrandetes REF-/LOT-
   Symbol nach ISO 15223, Maße, mehrsprachiges Kleingedrucktes), und die
   Verschlechterungen ahmen nach, was im Labor wirklich passiert: wenig
   Licht mit Sensorrauschen, Schatten der Hand, leichte Unschärfe, Glanz auf
   der Folie, Etikett klein im Bild, JPEG-Kompression.

   Alles läuft IM BROWSER (Canvas) und ist deterministisch (fester Zufalls-
   startwert) — derselbe Lauf liefert dasselbe Bild, Vergleiche vorher/
   nachher sind damit fair.

   Export: ETIKETTEN (Daten) und rendernImBrowser (Funktion, die per
   page.evaluate mit {spec, stoerung, seed} aufgerufen wird). */
'use strict';

/* Wahrheit je Etikett: was die Kette finden SOLL. */
const ETIKETTEN = [
  { id: 'schleuse',
    wahr: { ref: 'RSA60K10SQ', hersteller: 'Terumo', french: '6F', laenge: '10 cm', klasse: 'schleuse' },
    zeilen: [
      { t: 'TERUMO', g: 74, b: true },
      { t: 'Radifocus™ Introducer II', g: 50, b: true },
      { t: 'Introducer Sheath / Einführschleuse', g: 36 },
      { marker: 'REF', t: 'RSA60K10SQ', g: 44, b: true },
      { marker: 'LOT', t: '231104A', g: 34 },
      { t: '6Fr   10 cm   0.025" (0.64 mm)', g: 44, b: true },
      { t: 'STERILE EO   Single use only   Nicht wiederverwenden', g: 26 },
      { t: 'Terumo Europe N.V., 3001 Leuven, Belgium', g: 24 },
    ] },
  { id: 'ep-katheter',
    wahr: { ref: 'M0045000CL0', hersteller: 'Boston Scientific', french: '7F', laenge: '115 cm', klasse: 'ep_katheter' },
    zeilen: [
      { t: 'Boston Scientific', g: 62, b: true },
      { t: 'Polaris X™', g: 56, b: true },
      { t: 'Steerable Electrophysiology Catheter', g: 38 },
      { marker: 'REF', t: 'M0045000CL0', g: 44, b: true },
      { marker: 'LOT', t: '33781593', g: 34 },
      { t: '7F  115 cm   Large Curve   2-5-2 mm', g: 42, b: true },
      { t: 'Electrode spacing (2-5-2mm)   10 electrodes', g: 28 },
      { t: 'Boston Scientific Corporation, Marlborough, MA 01752 USA', g: 24 },
    ] },
  { id: 'draht',
    wahr: { ref: '1001782', hersteller: 'Abbott', french: '', laenge: '190 cm', klasse: 'fuehrungsdraht' },
    zeilen: [
      { t: 'Abbott', g: 70, b: true },
      { t: 'HI-TORQUE BALANCE MIDDLEWEIGHT™', g: 46, b: true },
      { t: 'Guide Wire / Führungsdraht', g: 38 },
      { marker: 'REF', t: '1001782', g: 46, b: true },
      { marker: 'LOT', t: '4012291', g: 34 },
      { t: '.014" (0.36 mm)   190 cm   J-Tip', g: 44, b: true },
      { t: 'Hydrophilic coating   STERILE EO', g: 26 },
      { t: 'Abbott Vascular, Santa Clara, CA 95054 USA', g: 24 },
    ] },
  { id: 'katheter',
    wahr: { ref: '451-506H0', hersteller: 'Cordis', french: '5F', laenge: '100 cm', klasse: 'diagnostikkatheter' },
    zeilen: [
      { t: 'CORDIS', g: 72, b: true },
      { t: 'INFINITI™ Diagnostic Catheter', g: 46, b: true },
      { t: 'JL 4.0   Judkins Left', g: 40 },
      { marker: 'REF', t: '451-506H0', g: 46, b: true },
      { marker: 'LOT', t: '18273645', g: 34 },
      { t: '5F (1.67 mm)   100 cm   .038"', g: 44, b: true },
      { t: 'Non-pyrogenic   Do not resterilize', g: 26 },
      { t: 'Cordis US Corp., Miami Lakes, FL 33014 USA', g: 24 },
    ] },
];

/* Verschlechterungen. Werte bewusst an echten Handyfotos orientiert. */
const STOERUNGEN = [
  { id: 'sauber',    wort: 'sauber (Referenz)' },
  { id: 'dunkel',    wort: 'wenig Licht + Rauschen', hell: 0.30, rauschen: 14 },
  { id: 'schatten',  wort: 'Schatten (Hand/Lampe)', schatten: true },
  { id: 'unscharf',  wort: 'leicht unscharf', blur: 2.2 },
  { id: 'glanz',     wort: 'Glanzlicht auf Folie', glanz: true },
  { id: 'klein',     wort: 'Etikett klein im Bild', klein: true },
  { id: 'alltag',    wort: 'Alltag: dunkel+Schatten+unscharf', hell: 0.45, rauschen: 10, schatten: true, blur: 1.4 },
];

/* Läuft IM BROWSER. Gibt ein JPEG (data-URL) zurück — wie ein Handyfoto. */
function rendernImBrowser(arg) {
  const { spec, stoerung: st, seed } = arg;
  let s = (seed >>> 0) || 1;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const gauss = () => { let u = 0, v = 0; while (u === 0) u = rnd(); v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  /* 1) Etikett zeichnen (Weißes Etikett, Schrift dunkelgrau wie Thermodruck). */
  const LW = 1500, LH = 980;
  const lab = document.createElement('canvas'); lab.width = LW; lab.height = LH;
  const g = lab.getContext('2d');
  g.fillStyle = '#f7f6f2'; g.fillRect(0, 0, LW, LH);
  g.fillStyle = '#1d1d1f'; g.strokeStyle = '#1d1d1f'; g.textBaseline = 'alphabetic';
  let y = 40;
  for (const z of spec.zeilen) {
    const fs = z.g * 1.0;
    y += fs * 1.25;
    let x = 56;
    if (z.marker) {
      /* ISO-15223-Symbol: Kürzel im Rahmen */
      g.font = 'bold ' + Math.round(fs * 0.78) + 'px "Liberation Sans", Arial, sans-serif';
      const mw = g.measureText(z.marker).width;
      g.lineWidth = Math.max(2, fs / 16);
      g.strokeRect(x - 8, y - fs * 0.86, mw + 16, fs * 1.02);
      g.fillText(z.marker, x, y - fs * 0.12);
      x += mw + 40;
    }
    g.font = (z.b ? 'bold ' : '') + Math.round(fs) + 'px "Liberation Sans", Arial, sans-serif';
    g.fillText(z.t, x, y);
  }
  /* kleines DataMatrix-Imitat (Rauschmuster) rechts unten — Etiketten haben das */
  for (let i = 0; i < 18; i++) for (let j = 0; j < 18; j++)
    if (rnd() < 0.5) { g.fillRect(LW - 230 + i * 10, LH - 230 + j * 10, 10, 10); }

  /* 2) „Foto": Etikett auf Tisch, leicht gedreht, 4000×3000 wie ein 12-MP-Handy. */
  const PW = 4000, PH = 3000;
  const ph = document.createElement('canvas'); ph.width = PW; ph.height = PH;
  const p = ph.getContext('2d');
  p.fillStyle = '#6f7378'; p.fillRect(0, 0, PW, PH);
  const breite = st.klein ? 0.34 : 0.78;          /* Anteil der Bildbreite */
  const sc = (PW * breite) / LW;
  p.save();
  p.translate(PW / 2, PH / 2); p.rotate((rnd() * 4 - 2) * Math.PI / 180);
  if (st.blur) p.filter = 'blur(' + (st.blur * 2) + 'px)';   /* Fotoskala: 4000 px ≈ 2,7 × Etikettskala */
  p.drawImage(lab, -LW * sc / 2, -LH * sc / 2, LW * sc, LH * sc);
  p.restore(); p.filter = 'none';

  /* 3) Licht: Schatten (Verlauf), Glanz (Ellipse), Helligkeit + Rauschen */
  if (st.schatten) {
    const gr = p.createLinearGradient(PW * 0.15, 0, PW * 0.85, PH);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0.72)');
    p.fillStyle = gr; p.fillRect(0, 0, PW, PH);
  }
  if (st.glanz) {
    const rg = p.createRadialGradient(PW * 0.62, PH * 0.36, 30, PW * 0.62, PH * 0.36, PW * 0.2);
    rg.addColorStop(0, 'rgba(255,255,255,0.92)'); rg.addColorStop(0.5, 'rgba(255,255,255,0.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    p.fillStyle = rg; p.fillRect(0, 0, PW, PH);
  }
  if (st.hell != null || st.rauschen) {
    const id = p.getImageData(0, 0, PW, PH); const d = id.data;
    const k = st.hell != null ? st.hell : 1; const sig = st.rauschen || 0;
    for (let i = 0; i < d.length; i += 4) {
      const n = sig ? gauss() * sig : 0;
      d[i] = d[i] * k + n; d[i + 1] = d[i + 1] * k + n; d[i + 2] = d[i + 2] * k + n * 1.2;
    }
    p.putImageData(id, 0, 0);
  }
  return ph.toDataURL('image/jpeg', 0.86);
}

module.exports = { ETIKETTEN, STOERUNGEN, rendernImBrowser };
