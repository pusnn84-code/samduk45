import {test,expect} from "@playwright/test";
import {login,expectNoOverflow} from "./helpers";
test.use({serviceWorkers:"block"});
test("all prayer-card page numbers jump directly and village filters reset the page",async({page})=>{
 test.skip(process.env.E2E_DATABASE_READY!=="1","Disposable CI only");
 const requested:number[]=[];
 await page.route("**/api/autumn-light",r=>r.fulfill({json:{date:"2026-11-26",card:null,sams:[]}}));
 await page.route("**/api/autumn-light/cards?**",r=>{const url=new URL(r.request().url()),p=Number(url.searchParams.get("page")),total=url.searchParams.get("village")?40:445;requested.push(p);return r.fulfill({json:{total,hasMore:(p+1)*20<total,cards:[{id:"11111111-1111-4111-8111-111111111111",name:(p+1)+"페이지 예시",samId:"22222222-2222-4222-8222-222222222222",samName:"1-1샘",village:1,authorName:"가상작성자",prayer:"함께 기도합니다.",visited:false,registered:false,version:1,count:0,prayed:false,canEdit:false}]}});});
 await login(page);await page.goto("/autumn-light");await page.getByRole("button",{name:"전체 기도카드",exact:true}).click();
 const nav=page.getByRole("navigation",{name:"기도카드 목록 페이지",exact:true});await expect(nav.locator(".autumn-page-number")).toHaveText(Array.from({length:23},(_,i)=>String(i+1)));
 for(const width of [320,390,430]){await page.setViewportSize({width,height:844});await expectNoOverflow(page);}
 await nav.getByRole("button",{name:"7페이지",exact:true}).click();await expect(page.locator(".autumn-person-name:visible")).toContainText("7페이지 예시");expect(requested.at(-1)).toBe(6);await expect(nav.getByRole("button",{name:"7페이지",exact:true})).toHaveAttribute("aria-current","page");
 await nav.getByRole("button",{name:"2페이지",exact:true}).click();await expect(page.locator(".autumn-person-name:visible")).toContainText("2페이지 예시");expect(requested.at(-1)).toBe(1);
 await page.getByRole("button",{name:"1마을",exact:true}).click();await expect(nav.locator(".autumn-page-number")).toHaveText(["1","2"]);await expect(nav.getByRole("button",{name:"1페이지",exact:true})).toHaveAttribute("aria-current","page");
 for(const width of [320,390,430]){await page.setViewportSize({width,height:844});await expectNoOverflow(page);}
});
test("pastor edits and deletes notices from the notice screen while members cannot",async({page,browser})=>{
 test.skip(process.env.E2E_DATABASE_READY!=="1","Disposable CI only");const ctx=await browser.newContext({serviceWorkers:"block"});let id="";
 try{
  await login(page,"admin");const response=await page.request.post("/api/admin/notices",{data:{title:"공지 관리 검증",body:"수정 전 안내",status:"published"}});expect(response.status()).toBe(201);id=(await response.json()).notice.id;
  await page.goto("/notices");await expect(page.getByRole("link",{name:"공지 수정·삭제",exact:true})).toBeVisible();await page.goto("/notices/"+id);
  await page.getByRole("button",{name:"공지 수정",exact:true}).click();await page.getByPlaceholder("공지 내용을 입력하세요.").fill("수정 후 안내");const changed=page.waitForResponse(r=>r.url().endsWith("/api/admin/notices/"+id)&&r.request().method()==="PATCH");await page.getByRole("button",{name:"발행",exact:true}).click();expect((await changed).status()).toBe(200);await expect.poll(()=>page.locator(".notice-detail:visible .notice-body").allTextContents()).toContain("수정 후 안내");
  const member=await ctx.newPage();await login(member);await member.goto("/notices/"+id);await expect(member.getByRole("button",{name:"공지 삭제",exact:true})).toHaveCount(0);expect((await member.request.delete("/api/admin/notices/"+id)).status()).toBe(403);
  await page.bringToFront();page.once("dialog",d=>void d.accept());const removed=page.waitForResponse(r=>r.url().endsWith("/api/admin/notices/"+id)&&r.request().method()==="DELETE");await page.getByRole("button",{name:"공지 삭제",exact:true}).click();expect((await removed).status()).toBe(200);await expect(page).toHaveURL(/\/notices$/);await expect(page.getByRole("link").filter({hasText:"공지 관리 검증"})).toHaveCount(0);id="";await expectNoOverflow(page);
 }finally{if(id)await page.request.delete("/api/admin/notices/"+id);await ctx.close();}
});
