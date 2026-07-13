/* Erzeugt die PWA-Icons ohne externe Abhängigkeiten (nur Node-Kern).
   Gezeichnet wird ein "H"-Monogramm (HKL) auf dunklem Grund mit grünem
   Akzent – passend zu theme-color/Design der App. Neu erzeugen mit:

     node scripts/gen-icons.js

   Ausgabe: public/icons/{icon-192,icon-512,maskable-512,apple-touch-180}.png */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BG = [0x0c, 0x11, 0x16];       // #0c1116 – App-Hintergrund/theme-color
const FG = [0x34, 0xc9, 0x8a];       // #34c98a – Akzentgrün (Material)
const OUT = path.join(__dirname, '..', 'public', 'icons');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return (~c) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // Scanlines mit Filter-Byte 0 pro Zeile
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// Zeichnet ein Icon. `pad` = Anteil Rand (für maskable größer wegen Safe-Zone),
// `fullBleed` = ganzes Quadrat füllen (maskable) statt abgerundeter Kachel.
function drawIcon(size, { pad = 0.5, fullBleed = false } = {}) {
  const buf = Buffer.alloc(size * size * 4); // default: transparent
  const radius = fullBleed ? 0 : size * 0.22;
  const put = (x, y, col, a = 255) => {
    const i = (y * size + x) * 4;
    buf[i] = col[0]; buf[i + 1] = col[1]; buf[i + 2] = col[2]; buf[i + 3] = a;
  };
  const inRounded = (x, y) => {
    if (fullBleed) return true;
    const r = radius;
    const cx = Math.min(Math.max(x, r), size - r);
    const cy = Math.min(Math.max(y, r), size - r);
    const dx = x - cx, dy = y - cy;
    return dx * dx + dy * dy <= r * r;
  };
  // Hintergrund
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (inRounded(x, y)) put(x, y, BG);
  // "H": zwei senkrechte Balken + Querbalken, innerhalb der Safe-Zone
  const inset = size * pad * 0.5;              // freier Rand
  const left = inset, right = size - inset;
  const w = right - left;
  const barW = w * 0.22;
  const l1 = left, l2 = left + barW;           // linker Balken
  const r1 = right - barW, r2 = right;         // rechter Balken
  const top = inset, bot = size - inset;
  const midT = size / 2 - barW * 0.55, midB = size / 2 + barW * 0.55; // Querbalken
  for (let y = Math.floor(top); y < Math.ceil(bot); y++) {
    for (let x = Math.floor(l1); x < Math.ceil(r2); x++) {
      const vBar = (x >= l1 && x < l2) || (x >= r1 && x < r2);
      const hBar = (y >= midT && y < midB) && (x >= l1 && x < r2);
      if (vBar || hBar) put(x, y, FG);
    }
  }
  return buf;
}

fs.mkdirSync(OUT, { recursive: true });
const files = [
  ['icon-192.png', 192, { pad: 0.42 }],
  ['icon-512.png', 512, { pad: 0.42 }],
  ['maskable-512.png', 512, { pad: 0.62, fullBleed: true }],
  ['apple-touch-180.png', 180, { pad: 0.42, fullBleed: true }],
];
for (const [name, size, opts] of files) {
  fs.writeFileSync(path.join(OUT, name), encodePNG(size, drawIcon(size, opts)));
  console.log('wrote', path.relative(process.cwd(), path.join(OUT, name)));
}
