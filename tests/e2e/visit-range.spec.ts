import {test,expect} from '@playwright/test';
import {login} from './helpers';
import {e2eAccounts} from '../fixtures/e2e-data';
import postgres from 'postgres';
import {randomUUID} from 'node:crypto';
test('multi-day all-day schedules, typed recipient identity, and selected form buttons',async({page,browser})=>{
 test.skip(process.env.E2E_DATABASE_READY!=='1','Disposable database only');test.setTimeout(120000);
 const db=postgres(process.env.DATABASE_URL!,{ssl:'require',prepare:false,max:1});
 const samId=randomUUID(),member=e2eAccounts.member;const createdVisits:string[]=[],createdMinistries:string[]=[];
 const [old]=await db`select sam_label from prayer_app.member_roster where id=${member.rosterId}::uuid`;
 const now=new Date(),start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,0)).toISOString().slice(0,10),end=new Date(Date.parse(start+'T00:00:00Z')+2*86400000).toISOString().slice(0,10);
 const nextMonth=end.slice(0,7);const context=await browser.newContext();
 try{
  await db`insert into prayer_app.sams(id,name,leader_name) values(${samId}::uuid,'1-2','리더검증')`;
  await db`update prayer_app.member_roster set sam_label='1-2' where id=${member.rosterId}::uuid`;
  await page.setViewportSize({width:390,height:844});await login(page,'admin');await page.goto('/visits');
  await page.getByRole('button',{name:new RegExp('^'+start+' 일정')}).click();
  const visitTab=page.getByRole('button',{name:'심방 확정 등록',exact:true}),ministryTab=page.getByRole('button',{name:'목회일정 등록',exact:true});
  await ministryTab.click();await expect(ministryTab).toHaveAttribute('aria-pressed','true');await expect(visitTab).toHaveAttribute('aria-pressed','false');
  expect(await ministryTab.evaluate(e=>getComputedStyle(e).backgroundColor)).not.toBe(await visitTab.evaluate(e=>getComputedStyle(e).backgroundColor));
  await expect(page.getByLabel('시작일',{exact:true})).toHaveValue(start);await expect(page.getByLabel('종료일',{exact:true})).toHaveValue(start);
  await page.getByLabel('일정 제목',{exact:true}).fill('범위검증 세미나');await page.getByLabel('종료일',{exact:true}).fill(end);await page.getByLabel('종일',{exact:true}).check();
  await expect(page.getByLabel('시간',{exact:true})).toBeDisabled();await expect(page.getByLabel('시간',{exact:true})).toHaveValue('종일 일정');
  const sent=page.waitForResponse(r=>r.url().endsWith('/api/admin/ministry-schedules')&&r.request().method()==='POST');await page.getByRole('button',{name:'확정 일정 등록',exact:true}).click();
  const response=await sent;expect(response.status()).toBe(201);createdMinistries.push((await response.json()).id);
  await visitTab.click();await expect(visitTab).toHaveAttribute('aria-pressed','true');await expect(ministryTab).toHaveAttribute('aria-pressed','false');
  await page.getByLabel('심방 대상자 이름',{exact:true}).fill(member.name);
  await expect(page.getByLabel('소속 샘',{exact:true})).toHaveValue('1-2샘');await expect(page.getByLabel('샘리더',{exact:true})).toHaveValue('리더검증');expect(await page.locator('select[name="recipientRosterId"]').count()).toBe(0);
  await page.getByLabel('종료일',{exact:true}).fill(end);await page.getByLabel('종일',{exact:true}).check();
  const saved=page.waitForResponse(r=>r.url().endsWith('/api/visits')&&r.request().method()==='POST');await page.getByRole('button',{name:'확정 일정 저장',exact:true}).click();
  const visitResponse=await saved;expect(visitResponse.status()).toBe(201);const vid=(await visitResponse.json()).id;createdVisits.push(vid);
  const [row]=await db`select recipient_name,recipient_sam,recipient_leader_name,visit_date::text,end_date::text,all_day,preferred_time,status from prayer_app.visit_requests where id=${vid}::uuid`;
  expect(row).toMatchObject({recipient_name:member.name,recipient_sam:'1-2샘',recipient_leader_name:'리더검증',visit_date:start,end_date:end,all_day:true,preferred_time:'',status:'confirmed'});
  const memberPage=await context.newPage();await login(memberPage);
  const month=await (await memberPage.request.get('/api/visits/calendar?month='+nextMonth)).json();
  expect(month.entries.filter((e:{id:string})=>e.id===vid)).toHaveLength(2);
  expect(month.entries.filter((e:{title:string})=>e.title==='범위검증 세미나')).toHaveLength(2);
  const adminMonth=await (await page.request.get('/api/admin/visits?from='+nextMonth+'-01')).json();expect(adminMonth.visits.some((v:{id:string})=>v.id===vid)).toBe(true);
  expect(month.entries.filter((e:{allDay?:boolean;id:string})=>e.id===vid).every((e:{allDay?:boolean;time:string})=>e.allDay&&e.time==='')).toBe(true);
  const ordinary=await memberPage.request.post('/api/visits',{data:{visitDate:start,endDate:end,allDay:true,visitType:'sam'}});expect(ordinary.status()).toBe(201);const ordinaryId=(await ordinary.json()).id;createdVisits.push(ordinaryId);
  const detail=await (await page.request.get('/api/admin/visits/'+ordinaryId)).json();expect(detail.visit).toMatchObject({endDate:end,allDay:true,status:'requested'});
  expect((await page.request.patch('/api/admin/visits/'+ordinaryId,{data:{endDate:'2020-01-01'}})).status()).toBe(400);
  expect((await memberPage.request.post('/api/admin/ministry-schedules',{data:{title:'불가',startDate:start,time:'14:00'}})).status()).toBe(403);
  expect((await memberPage.request.get('/api/visits/people')).status()).toBe(403);
  const bad=await page.request.post('/api/admin/ministry-schedules',{data:{title:'잘못된 범위',startDate:end,eventEndDate:start,allDay:true}});expect(bad.status()).toBe(400);
 }finally{
  for(const id of createdVisits)await db`delete from prayer_app.visit_requests where id=${id}::uuid`;
  for(const id of createdMinistries)await db`delete from prayer_app.ministry_schedules where id=${id}::uuid`;
  await db`update prayer_app.member_roster set sam_label=${old.sam_label} where id=${member.rosterId}::uuid`;
  await db`delete from prayer_app.sams where id=${samId}::uuid`;await context.close();await db.end();
 }
});

