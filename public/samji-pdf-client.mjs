import {getDocument,GlobalWorkerOptions} from './vendor/pdfjs/pdf.mjs';
GlobalWorkerOptions.workerSrc='/vendor/pdfjs/pdf.worker.mjs';
window.samjiPdfText=async function(file){
 if(file.size>3*1024*1024)throw Error('PDF_TOO_LARGE');
 const task=getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,disableFontFace:true,useSystemFonts:false,cMapUrl:'/vendor/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/pdfjs/standard_fonts/',verbosity:0});
 const timeout=setTimeout(()=>task.destroy(),30000);
 try{
  const doc=await task.promise;if(doc.numPages>12)throw Error('TOO_MANY_PAGES');let pages=[];
  for(let i=1;i<=doc.numPages;i++){
   const page=await doc.getPage(i),viewport=page.getViewport({scale:1}),content=await page.getTextContent();
   const items=content.items.filter(item=>'str' in item&&item.str.trim());
   const columns=viewport.width>viewport.height?[items.filter(t=>t.transform[4]<viewport.width/2),items.filter(t=>t.transform[4]>=viewport.width/2)]:[items];
   for(const column of columns){const rows=[];
    for(const item of column){const y=item.transform[5],x=item.transform[4];let row=rows.find(r=>Math.abs(r.y-y)<3);if(!row){row={y,items:[]};rows.push(row);}row.items.push({x,text:item.str,width:item.width,font:Math.abs(item.transform[0])});}
    pages.push(rows.sort((a,b)=>b.y-a.y).map(row=>{const ordered=row.items.sort((a,b)=>a.x-b.x);let result='',end=0;for(const item of ordered){if(result&&item.x-end>Math.max(1,item.font*.15)&&!result.endsWith(' '))result+=' ';result+=item.text;end=item.x+item.width;}return result.trim();}).join('\n'));
   }
   page.cleanup();
  }
  const text=pages.join('\n\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');if(text.length>200000)throw Error('TOO_MUCH_TEXT');return text;
 }finally{clearTimeout(timeout);await task.destroy();}
};
