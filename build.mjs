import {cpSync, mkdirSync} from 'node:fs';
mkdirSync('public/vendor', {recursive: true});
cpSync('node_modules/pdfjs-dist/build/pdf.mjs', 'public/vendor/pdf.mjs');
cpSync('node_modules/pdfjs-dist/build/pdf.worker.mjs', 'public/vendor/pdf.worker.mjs');
for (const name of ['cmaps', 'standard_fonts', 'wasm']) {
  cpSync(`node_modules/pdfjs-dist/${name}`, `public/vendor/package/${name}`, {recursive: true});
}
console.log('PDF.js assets prepared. Study media is served from R2.');
