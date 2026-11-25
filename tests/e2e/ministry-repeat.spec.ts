import {test,expect} from "@playwright/test";
import postgres from "postgres";
import {login,expectNoOverflow} from "./helpers";
import {shiftDate} from "../../src/features/visits/schedule-range";
test.use({serviceWorkers:"block"});
test("pastor creates biweekly ministry through the selected last date, visible to members",async({page,browser})=>{
 test.skip(process.env.E2E_DATABASE_READY!=="1"||!["127.0.0.1","localhost"].includes(new URL(process.env.DATABASE_URL!).hostname),"Disposable local CI only");test.setTimeout(90000);
 const db=postgres(process.env.DATABASE_URL!,{ssl:"require",prepare:false,max:1}),ctx=await browser.newContext({serviceWorkers:"block"});let id="";
 const month=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit"}).format(new Date()),start=month+"-05",until=shiftDate(start,28);
 try{
  await page.setViewportSize({width:390,height:844});await login(page,"admin");await page.goto("/visits");await page.getByRole("button",{name:new RegExp("^"+start+" 일정")}).click();await page.getByRole("button",{name:"목회일정 등록",exact:true}).click();
  const form=page.getByRole("form",{name:"목회일정 등록",exact:true});await form.getByLabel("일정 제목",{exact:true}).fill("격주 모임 검증");await form.getByLabel("반복",{exact:true}).selectOption("biweekly");await form.getByLabel("반복 종료일",{exact:true}).fill(until);
  const sent=page.waitForResponse(r=>r.url().endsWith("/api/admin/ministry-schedules")&&r.request().method()==="POST");await form.getByRole("button",{name:"확정 일정 등록",exact:true}).click();const response=await sent;expect(response.status()).toBe(201);id=(await response.json()).id;
  const [stored]=await db`select repeat,end_date::text from prayer_app.ministry_schedules where id=${id}::uuid`;expect(stored).toMatchObject({repeat:"biweekly",end_date:until});
  const member=await ctx.newPage();await login(member);const entries=[];
  for(const m of [...new Set([month,until.slice(0,7)])]){const r=await member.request.get("/api/visits/calendar?month="+m);expect(r.status()).toBe(200);entries.push(...(await r.json()).entries.filter((e:{seriesId:string})=>e.seriesId===id));}
  expect(entries.map(e=>e.date).sort()).toEqual([start,shiftDate(start,14),until]);expect(entries.every(e=>e.repeat==="biweekly"&&e.repeatUntil===until)).toBe(true);
  await page.bringToFront();await expect(page.locator(".visit-event-card:visible").filter({hasText:"격주 모임 검증"})).toContainText("격주");await expectNoOverflow(page);
 }finally{if(id)await db`delete from prayer_app.ministry_schedules where id=${id}::uuid`;await ctx.close();await db.end();}
});
