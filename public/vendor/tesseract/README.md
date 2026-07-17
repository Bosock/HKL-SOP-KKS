# Vendored Tesseract.js (On-Device-OCR)

Selbst gehostete Assets für die On-Device-Texterkennung des Etikett-Scanners.
Bewusst **im Repo** (keine externen CDNs, offline-fähig, CSP `connect-src 'self'`).

| Datei | Quelle (npm) | Zweck |
|---|---|---|
| `tesseract.min.js` | `tesseract.js@5` | Browser-API (`window.Tesseract`) |
| `worker.min.js` | `tesseract.js@5` | Web-Worker-Skript |
| `tesseract-core-simd-lstm.js` / `.wasm` | `tesseract.js-core@5` | WASM-Engine (SIMD, LSTM-only) |
| `eng.traineddata.gz` | `@tesseract.js-data/eng` (`4.0.0_best_int`) | englisches Sprachmodell (integer-quantisiert) |

Lizenz: Apache-2.0 (Tesseract.js / tesseract-ocr). Siehe die `*.LICENSE.txt`.
Aktualisieren: Paket per `npm pack <name>` ziehen, Dateien hier ersetzen,
`CACHE_VERSION` in `public/sw.js` erhöhen.
