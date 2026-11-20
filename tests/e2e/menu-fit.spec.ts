import {expect,test} from "@playwright/test";
import {login} from "./helpers";

test("all twelve main menus fit normal phone screens with consistent row colors",async({page})=>{
 test.skip(process.env.E2E_DATABASE_READY!=="1","Disposable database only");
 await login(page);
 for(const [width,height] of [[320,568],[360,640],[390,844],[412,915],[1280,720],[844,390]]){
  await page.setViewportSize({width,height});
  await expect(page.locator(".menu-home-card")).toHaveCount(12);
  const result=await page.locator(".menu-home-card").evaluateAll(cards=>({
   boxes:cards.map(card=>{const r=card.getBoundingClientRect();const icon=card.querySelector(".menu-home-icon")!;return {rowTop:(card as HTMLElement).offsetTop,top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,color:getComputedStyle(icon).color};}),
   pageHeight:document.documentElement.scrollHeight,pageWidth:document.documentElement.scrollWidth
  }));
  expect(result.pageWidth, width+" horizontal overflow").toBeLessThanOrEqual(width+1);
  expect(result.pageHeight,width+"x"+height+" page overflow").toBeLessThanOrEqual(height+1);
  for(const box of result.boxes){
   expect(box.top).toBeGreaterThanOrEqual(0);expect(box.left).toBeGreaterThanOrEqual(0);
   expect(box.bottom).toBeLessThanOrEqual(height+1);expect(box.right).toBeLessThanOrEqual(width+1);expect(box.height).toBeGreaterThanOrEqual(44);
  }
  if(height>520){
   for(let row=0;row<4;row++){
    const cells=result.boxes.slice(row*3,row*3+3);
    expect(new Set(cells.map(b=>b.rowTop)).size).toBe(1);
    expect(new Set(cells.map(b=>b.color)).size).toBe(1);
   }
   expect(new Set([0,3,6,9].map(i=>result.boxes[i].color)).size).toBe(4);
  }
 }
});
