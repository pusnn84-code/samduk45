import {test,expect} from '@playwright/test';
import {login,expectNoOverflow} from './helpers';
import postgres from 'postgres';

test('pastor selects pending or confirmed for direct visits and ministry schedules',async({page,browser})=>{
 test.skip(process.env.E2E_DATABASE_READY!=='1','Disposable database only');test.setTimeout(120000);
 const db=postgres(process.env.DATABASE_URL!,{ssl:'require',prepare:false,max:1});
 const visits:string[]=[],ministries:string[]=[],context=await browser.newContext();
 const now=new Date(),date=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),25)).toISOString().slice(0,10),month=date.slice(0,7);
 try{
  await page.setViewportSize({width:390,height:844});await login(page,'admin');await page.goto('/visits');
  await page.getByRole('button',{name:new RegExp('^'+date+' 일정')}).click();await page.getByRole('button',{name:'심방 확정 등록',exact:true}).click();
  await expect(page.getByRole('radio',{name:'확정',exact:true})).toBeChecked();
  await page.getByLabel('심방 대상자 이름',{exact:true}).fill('대기심방 검증');await page.getByRole('radio',{name:'대기',exact:true}).check();
  const visitSent=page.waitForResponse(r=>r.url().endsWith('/api/visits')&&r.request().method()==='POST');await page.getByRole('button',{name:'대기 일정 저장',exact:true}).click();
  const v=await visitSent;expect(v.status()).toBe(201);const vid=(await v.json()).id;visits.push(vid);
  expect((await db`select status,confirmed_at from prayer_app.visit_requests where id=${vid}::uuid`)[0]).toMatchObject({status:'requested',confirmed_at:null});
  await page.getByRole('button',{name:'목회일정 등록',exact:true}).click();await page.getByLabel('일정 제목',{exact:true}).fill('대기세미나 검증');await page.getByRole('radio',{name:'대기',exact:true}).check();
  const ministrySent=page.waitForResponse(r=>r.url().endsWith('/api/admin/ministry-schedules')&&r.request().method()==='POST');await page.getByRole('button',{name:'대기 일정 등록',exact:true}).click();
  const m=await ministrySent;expect(m.status()).toBe(201);const mid=(await m.json()).id;ministries.push(mid);
  expect((await db`select status from prayer_app.ministry_schedules where id=${mid}::uuid`)[0].status).toBe('requested');
  const member=await context.newPage();await login(member);
  const entries=await (await member.request.get('/api/visits/calendar?month='+month)).json();
  expect(entries.entries.find((e:{id:string})=>e.id===vid).status).toBe('requested');
  expect(entries.entries.find((e:{seriesId:string})=>e.seriesId===mid).status).toBe('requested');
  expect((await member.request.patch('/api/admin/ministry-schedules',{data:{id:mid,status:'confirmed'}})).status()).toBe(403);
  expect((await member.request.post('/api/visits',{data:{visitDate:date,visitType:'personal',appointmentStatus:'confirmed'}})).status()).toBe(403);
  expect((await page.request.patch('/api/admin/ministry-schedules',{data:{id:mid,status:'cancelled'}})).status()).toBe(400);
  const event=page.locator('.visit-event-card').filter({hasText:'대기세미나 검증'});await expect(event.getByRole('img',{name:'대기',exact:true})).toBeVisible();
  await event.getByRole('button',{name:'확정으로 변경',exact:true}).click();
  await expect(event.getByRole('img',{name:'확정',exact:true})).toBeVisible();
  expect((await db`select status from prayer_app.ministry_schedules where id=${mid}::uuid`)[0].status).toBe('confirmed');
  expect((await page.request.post('/api/admin/visits/'+vid+'/confirm',{data:{}})).status()).toBe(200);
  const updated=await (await member.request.get('/api/visits/calendar?month='+month)).json();expect(updated.entries.find((e:{id:string})=>e.id===vid).status).toBe('confirmed');
  await expectNoOverflow(page);await page.screenshot({path:'test-results/schedule-status.png',fullPage:true});
 }finally{
  for(const id of visits)await db`delete from prayer_app.visit_requests where id=${id}::uuid`;
  for(const id of ministries)await db`delete from prayer_app.ministry_schedules where id=${id}::uuid`;
  await context.close();await db.end();
 }
});
