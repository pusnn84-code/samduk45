import {test,expect} from "@playwright/test";
import {login,expectNoOverflow} from "./helpers";
test.use({serviceWorkers:"block"});
test("notice leaders stay in numeric sam order with compact red/green status indicators",async({page})=>{
 test.skip(process.env.E2E_DATABASE_READY!=="1"||!["127.0.0.1","localhost"].includes(new URL(process.env.DATABASE_URL!).hostname),"Disposable local CI only");let id="";
 const person=(id:string,name:string,roles:string[],confirmedAt:string|null=null)=>({id,name,responsibilities:roles,confirmedAt});
 const at="2026-11-26T01:00:00Z",one=person("one","한리더",["1-1샘 리더","1마을장"],at),two=person("two","하리더",["1-2샘 리더"]),ten=person("ten","가리더",["1-10샘 리더"],at),v2=person("v2","나리더",["2-1샘 리더"]),officer=person("officer","마임원",["임원"]);
 try{
  await login(page,"admin");const response=await page.request.post("/api/admin/notices",{data:{title:"리더 배열 검증",body:"확인 상태 검증용 안내입니다.",status:"published"}});expect(response.status()).toBe(201);id=(await response.json()).notice.id;
  const original=await(await page.request.get("/api/notices/"+id+"/confirmations")).json();let refreshes=0;
  await page.route("**/api/notices/"+id+"/confirmations",route=>{refreshes++;return route.fulfill({json:{...original,confirmed:refreshes===1?[ten,one]:[ten,one,{...two,confirmedAt:at}],unconfirmed:refreshes===1?[officer,two,v2]:[officer,v2]}});});
  await page.goto("/notices/"+id);await page.getByRole("button",{name:"현황 새로고침",exact:true}).click();const group=page.getByRole("region",{name:"1마을",exact:true});
  await expect(group.locator(".notice-confirmation-sam")).toHaveText(["1-1샘","1-2샘","1-10샘"]);await expect(group.getByRole("heading",{name:"1마을",exact:true})).toBeVisible();await expect(page.getByRole("region",{name:"임원 · 관리자",exact:true})).toContainText("마임원");
  await expect(group.getByRole("img",{name:"미확인",exact:true})).toHaveCount(1);expect(await group.locator(".notice-confirmation-status.is-confirmed").first().evaluate(e=>getComputedStyle(e).backgroundColor)).toBe("rgb(50, 185, 104)");expect(await group.getByRole("img",{name:"미확인",exact:true}).evaluate(e=>getComputedStyle(e).backgroundColor)).toBe("rgb(237, 98, 91)");
  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});await expectNoOverflow(page);const boxes=await group.locator("li").evaluateAll(rows=>rows.slice(0,2).map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y};}));expect(boxes[1].x).toBeGreaterThan(boxes[0].x);expect(Math.abs(boxes[1].y-boxes[0].y)).toBeLessThan(1);}
  await page.getByRole("button",{name:"현황 새로고침",exact:true}).click();await expect(group.locator(".notice-confirmation-status.is-confirmed")).toHaveCount(3);await expect(group.locator(".notice-confirmation-sam")).toHaveText(["1-1샘","1-2샘","1-10샘"]);
 }finally{if(id)await page.request.delete("/api/admin/notices/"+id);}
});
