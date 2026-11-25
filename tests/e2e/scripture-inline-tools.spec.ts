import {test,expect} from "@playwright/test";
import {login,expectNoOverflow} from "./helpers";
test.use({serviceWorkers:"block"});
test("headings are not selectable, text-only highlights and four actions fit one mobile row",async({page})=>{
 test.skip(process.env.E2E_DATABASE_READY!=="1"||!["127.0.0.1","localhost"].includes(new URL(process.env.DATABASE_URL!).hostname),"Disposable CI database only");
 await login(page);await page.goto("/scripture/bible/66/7");
 const heading=page.getByRole("heading",{name:"인치심을 받은 십사만 사천 명",exact:true});await expect(heading).toBeVisible();
 expect(await heading.evaluate(el=>el.closest("button")===null)).toBe(true);
 await heading.click();await expect(page.getByRole("toolbar",{name:"선택한 구절 도구"})).toHaveCount(0);
 const verse=page.locator("#scripture-verse-1:visible");await verse.click();
 const toolbar=page.getByRole("toolbar",{name:"선택한 구절 도구",exact:true});await expect(toolbar.getByRole("button")).toHaveCount(4);
 for(const width of [320,375,430]){
  await page.setViewportSize({width,height:844});
  const boxes=await toolbar.getByRole("button").evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,height:r.height};}));
  expect(Math.max(...boxes.map(b=>b.y))-Math.min(...boxes.map(b=>b.y))).toBeLessThan(1);
  expect(boxes.every(b=>b.x>=0&&b.right<=width&&b.height>=44)).toBe(true);await expectNoOverflow(page);
 }
 const markBefore=verse.locator(".scripture-verse-mark");expect(await markBefore.evaluate(el=>getComputedStyle(el).boxShadow)).toBe("none");
 for(const button of ["형광펜 칠하기","형광펜 지우기"]){const bounds=await toolbar.getByRole("button",{name:button,exact:true}).locator("svg").boundingBox();expect(bounds?.width).toBeGreaterThanOrEqual(32);expect(bounds?.height).toBeGreaterThanOrEqual(32);}
 const marker=toolbar.getByRole("button",{name:"형광펜 칠하기",exact:true});await expect(marker).toBeEnabled();
 const saved=page.waitForResponse(r=>r.url().endsWith("/api/scripture/highlights")&&r.request().method()==="PUT");await marker.click();expect((await saved).status()).toBe(200);
 try{
  const mark=verse.locator('.scripture-verse-mark[data-highlight="yellow"]');await expect(mark).toBeVisible();
  expect(await verse.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  expect(await heading.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  const fragments=await mark.evaluate(el=>({display:getComputedStyle(el).display,lines:el.getClientRects().length}));expect(fragments.display).toBe("inline");expect(fragments.lines).toBeGreaterThan(1);
  await page.evaluate(()=>Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async(text:string)=>{Reflect.set(window,"scriptureCopied",text);}}}));
  await verse.click();await toolbar.getByRole("button",{name:"복사하기",exact:true}).click();
  const copied=await page.evaluate(()=>Reflect.get(window,"scriptureCopied") as string);expect(copied).not.toContain("인치심을 받은");expect(copied).toMatch(/\(계 7:1\)$/);
  const erased=page.waitForResponse(r=>r.url().endsWith("/api/scripture/highlights")&&r.request().method()==="PUT");await toolbar.getByRole("button",{name:"형광펜 지우기",exact:true}).click();expect((await erased).status()).toBe(200);await expect(verse.locator(".scripture-verse-mark")).not.toHaveAttribute("data-highlight");
 }finally{await page.request.put("/api/scripture/highlights",{data:{verses:[{book:66,chapter:7,verse:1}],color:null}});}
});
