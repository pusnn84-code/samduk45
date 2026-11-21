import { test, expect } from "@playwright/test";
import { login, expectNoOverflow } from "./helpers";

test("Google export controls stay administrator-only and explain one-way calendar ownership",async({page,browser})=>{
  test.skip(process.env.E2E_DATABASE_READY!=="1","Disposable database only");
  test.setTimeout(90_000);
  const context=await browser.newContext(),member=await context.newPage();let syncs=0;
  try{
    await page.setViewportSize({width:390,height:844});await login(page,"admin");await login(member);
    expect((await member.request.get("/api/admin/google-calendar/status")).status()).toBe(403);
    expect((await member.request.post("/api/admin/google-calendar/sync",{data:{}})).status()).toBe(403);
    await page.route("**/api/admin/google-calendar/status",route=>route.fulfill({json:{configured:true,connected:true,accountEmail:"pastor@example.test",selectedCalendarId:"primary",selectedCalendarName:"내 일정",direction:"app_to_google"}}));
    await page.route("**/api/admin/google-calendar/calendars",route=>route.fulfill({json:{calendars:[{id:"primary",summary:"내 일정",accessRole:"owner"},{id:"read-only",summary:"읽기 전용",accessRole:"reader"}]}}));
    await page.route("**/api/admin/google-calendar/sync",route=>{syncs++;return route.fulfill({json:{status:"ok",created:1,updated:1,removed:0,unchanged:2}});});
    await page.goto("/admin/visits");const settings=page.getByRole("region",{name:"내 구글 캘린더 연결",exact:true});
    await expect(settings).toContainText("pastor@example.test");await expect(settings).toContainText("일정 변경은 삼덕사오에서");await expect(settings.getByRole("status")).toContainText("동기화 완료 · 4개 일정");
    await expect(settings.getByLabel("내 캘린더",{exact:true})).toHaveValue("primary");expect(await settings.getByRole("option",{name:"읽기 전용"}).count()).toBe(0);
    await settings.getByRole("button",{name:"지금 동기화",exact:true}).click();await expect(settings.getByRole("status")).toContainText("동기화 완료");expect(syncs).toBeGreaterThanOrEqual(2);await expectNoOverflow(page);
    await page.route("**/api/admin/google-calendar/status",route=>route.fulfill({json:{configured:true,connected:false,accountEmail:null,selectedCalendarId:null,selectedCalendarName:null}}));
    await page.reload();await expect(settings.getByRole("link",{name:"구글 캘린더 연결하기",exact:true})).toHaveAttribute("href","/api/admin/google-calendar/connect");
    await page.screenshot({path:"test-results/google-calendar-export-settings.png",fullPage:true});
  }finally{await context.close();}
});
