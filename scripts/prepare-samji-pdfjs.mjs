import {mkdir,copyFile,cp,access} from 'node:fs/promises';
import path from 'node:path';
const source=path.resolve('node_modules/pdfjs-dist'),target=path.resolve('public/vendor/pdfjs');
await mkdir(target,{recursive:true});
for(const name of ['pdf.mjs','pdf.worker.mjs'])await copyFile(path.join(source,'legacy/build',name),path.join(target,name));
for(const folder of ['cmaps','standard_fonts']){try{await access(path.join(source,folder));await cp(path.join(source,folder),path.join(target,folder),{recursive:true});}catch{/* Embedded-font PDFs do not require these fallback resources. */}}
await copyFile(path.join(source,'LICENSE'),path.join(target,'LICENSE'));
console.log('Prepared Mozilla PDF.js assets for private, in-browser document extraction.');
