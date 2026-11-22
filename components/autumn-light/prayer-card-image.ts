import type {AutumnCard} from "../../src/features/autumn-light/types";
import {autumnStatusLabels} from "../../src/features/autumn-light/policy";
export function wrapPrayer(ctx:CanvasRenderingContext2D,text:string,maxWidth:number){
 const lines:string[]=[];for(const paragraph of text.replace(/\r/g,"").split("\n")){let line="";for(const letter of Array.from(paragraph)){if(line&&ctx.measureText(line+letter).width>maxWidth){lines.push(line);line=letter;}else line+=letter;}lines.push(line);}return lines;
}
export async function prayerCardImages(card:AutumnCard):Promise<Blob[]>{
 await document.fonts.ready;
 const probe=document.createElement("canvas"),ctx=probe.getContext("2d");if(!ctx)throw Error("CANVAS_UNAVAILABLE");
 ctx.font="30px system-ui, sans-serif";const lines=wrapPrayer(ctx,card.prayer,904),pages:string[][]=[];
 for(let n=0;n<lines.length;n+=75)pages.push(lines.slice(n,n+75));
 ctx.font="700 60px system-ui, sans-serif";const nameHeight=wrapPrayer(ctx,card.name,904).length*70;ctx.font="26px system-ui, sans-serif";const metaHeight=wrapPrayer(ctx,card.samName+" · "+card.authorName,904).length*38;const headerHeight=218+nameHeight+metaHeight+(autumnStatusLabels(card).length?52:0)+103;
 const results:Blob[]=[];
 for(let p=0;p<pages.length;p++){
  const part=pages[p],height=Math.max(850,headerHeight+part.length*48+150),canvas=document.createElement("canvas");canvas.width=1080;canvas.height=height;
  const c=canvas.getContext("2d");if(!c)throw Error("CANVAS_UNAVAILABLE");
  c.fillStyle="#f1f5ee";c.fillRect(0,0,1080,height);c.fillStyle="#fff";c.beginPath();c.roundRect(48,48,984,height-96,32);c.fill();
  c.fillStyle="#355d4c";c.font="700 34px system-ui, sans-serif";c.fillText("이분을 위해 기도합시다",88,125);
  c.fillStyle="#17251e";c.font="700 60px system-ui, sans-serif";const nameLines=wrapPrayer(c,card.name,904);
  let y=218;for(const line of nameLines){c.fillText(line,88,y);y+=70;}
  c.fillStyle="#657367";c.font="26px system-ui, sans-serif";
  for(const line of wrapPrayer(c,card.samName+" · "+card.authorName,904)){c.fillText(line,88,y+8);y+=38;}
  const badges=autumnStatusLabels(card);if(badges.length){c.fillStyle="#355d4c";c.font="700 25px system-ui, sans-serif";c.fillText(badges.join("  ·  "),88,y+28);y+=52;}
  y+=45;c.strokeStyle="#dce5d8";c.beginPath();c.moveTo(88,y);c.lineTo(992,y);c.stroke();y+=58;
  c.fillStyle="#24372b";c.font="30px system-ui, sans-serif";
  for(const line of part){c.fillText(line,88,y);y+=48;}
  c.fillStyle="#657367";c.font="24px system-ui, sans-serif";c.fillText("삼덕교회 45공동체 · 가을빛축제",88,height-100);
  if(pages.length>1){c.textAlign="right";c.fillText(String(p+1)+"/"+pages.length,992,height-100);}
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error("IMAGE_FAILED")),"image/png"));results.push(blob);
  canvas.width=1;canvas.height=1;
 }
 return results;
}
