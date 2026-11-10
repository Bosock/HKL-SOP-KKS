# Vendored zxing-wasm (Barcode-Leser auf dem Gerät)

Selbst gehosteter Barcode-Leser für die neue App (`public/neu/js/barcode.js`).
Bewusst **im Repo** (keine externen CDNs, CSP `connect-src 'self'`): Die
Bibliothek würde ihre WASM-Datei sonst von einem fremden Server nachladen.

Wozu: Nur Android-Chrome bringt einen eingebauten Barcode-Leser mit
(`BarcodeDetector`). Auf iPhone, iPad und am PC liest dieser hier — DataMatrix,
Code 128 (GS1-128), EAN und QR. Geladen wird er erst beim ersten Scan.

| Datei | Quelle (npm) | Zweck |
|---|---|---|
| `zxing-reader.js` | `zxing-wasm@2.1.2`, `dist/iife/reader/index.js` | Browser-API (`window.ZXingWASM`) |
| `zxing_reader.wasm` | `zxing-wasm@2.1.2`, `dist/reader/zxing_reader.wasm` | WASM-Engine (zxing-cpp) |

Lizenz: MIT (zxing-wasm), zxing-cpp Apache-2.0. Siehe `LICENSE-zxing-wasm.txt`.
Aktualisieren: `npm pack zxing-wasm@<version>`, die beiden Dateien ersetzen,
`CACHE_VERSION` in `public/sw.js` erhöhen.
