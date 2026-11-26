import {test,expect} from "@playwright/test";
import {randomUUID} from "node:crypto";
import postgres from "postgres";
import {login,expectNoOverflow} from "./helpers";
import {e2eAccounts} from "../fixtures/e2e-data";
test.use({serviceWorkers:"block"});
test("card author and pastor write shared comments while other members only read",async({page,browser})=>{
 test.skip(process.env.E2E_DATABASE_READY!=="1"||!["127.0.0.1","localhost"].includes(new URL(process.env.DATABASE_URL!).hostname),"Disposable CI only");
 const db=postgres(process.env.DATABASE_URL!,{ssl:"require",prepare:false,max:1}),id=randomUUID(),otherId=randomUUID(),samId=randomUUID(),ctx=await browser.newContext({serviceWorkers:"block"});
 try{
  await db`insert into prayer_app.sams(id,name,leader_name,is_active) values(${samId}::uuid,'1-99','',true)`;
  await db`insert into prayer_app.autumn_people(id,person_name,sam_id,source_author_name,prayer) values(${id}::uuid,'댓글 검증 대상',${samId}::uuid,'성도검증','함께 기도하는 예시입니다.'),(${otherId}::uuid,'다른 대상',${samId}::uuid,'다른 작성자','다른 카드입니다.')`;
  await db`insert into prayer_app.autumn_card_authors(person_id,roster_id) values(${id}::uuid,${e2eAccounts.member.rosterId}::uuid)`;
  await login(page);await page.goto('/autumn-light?card='+id);
  // Open via the share deep link used by the application.
  const detail=page.getByRole('dialog');await expect(detail).toBeVisible();const input=detail.getByRole('textbox',{name:'추가 내용',exact:true});await input.fill('가족과 함께 교회에 방문하기로 했습니다.');const saved=page.waitForResponse(r=>r.url().endsWith('/comments')&&r.request().method()==='POST');await detail.getByRole('button',{name:'등록',exact:true}).click();expect((await saved).status()).toBe(201);await expect(detail.locator('.autumn-comment')).toContainText('가족과 함께');
  const key=randomUUID();for(let i=0;i<2;i++)expect((await page.request.post('/api/autumn-light/cards/'+id+'/comments',{data:{body:'재전송 예시',submissionKey:key}})).status()).toBe(201);
  const comments=await(await page.request.get('/api/autumn-light/cards/'+id+'/comments')).json();expect(comments.comments.filter((c:{body:string})=>c.body==='재전송 예시')).toHaveLength(1);
  expect((await page.request.post('/api/autumn-light/cards/'+otherId+'/comments',{data:{body:'권한 없는 입력',submissionKey:randomUUID()}})).status()).toBe(403);
  const admin=await ctx.newPage();await login(admin,'admin');expect((await admin.request.post('/api/autumn-light/cards/'+id+'/comments',{data:{body:'목사님도 함께 기도합니다.',submissionKey:randomUUID()}})).status()).toBe(201);
  const after=await(await page.request.get('/api/autumn-light/cards/'+id+'/comments')).json();const pastor=after.comments.find((c:{body:string})=>c.body==='목사님도 함께 기도합니다.');expect(pastor.canDelete).toBe(false);expect((await page.request.delete('/api/autumn-light/cards/'+id+'/comments/'+pastor.id)).status()).toBe(403);
  // An imported card bound to another author is read-only even for a deputy.
  await db`update prayer_app.autumn_card_authors set roster_id=${e2eAccounts.admin.rosterId}::uuid where person_id=${id}::uuid`;
  await db`update prayer_app.member_roster set is_deputy_admin=true where id=${e2eAccounts.member.rosterId}::uuid`;
  await page.bringToFront();await page.reload();await expect(detail.locator('.autumn-comment')).toHaveCount(3);await expect(detail.getByRole('textbox',{name:'추가 내용',exact:true})).toHaveCount(0);expect((await page.request.post('/api/autumn-light/cards/'+id+'/comments',{data:{body:'대리 권한',submissionKey:randomUUID()}})).status()).toBe(403);
  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});await expectNoOverflow(page);}
  expect((await admin.request.delete('/api/autumn-light/cards/'+id+'/comments/'+pastor.id)).status()).toBe(200);
 }finally{await page.goto("about:blank");await ctx.close();await db`delete from prayer_app.autumn_daily where person_id in (${id}::uuid,${otherId}::uuid)`;await db`delete from prayer_app.autumn_people where id in (${id}::uuid,${otherId}::uuid)`;await db`delete from prayer_app.sams where id=${samId}::uuid`;await db`update prayer_app.member_roster set is_deputy_admin=false where id=${e2eAccounts.member.rosterId}::uuid`;await db.end();}
});
test("notice officers appear with their actual responsibilities and can confirm",async({page})=>{
 test.skip(process.env.E2E_DATABASE_READY!=="1"||!["127.0.0.1","localhost"].includes(new URL(process.env.DATABASE_URL!).hostname),"Disposable CI only");const db=postgres(process.env.DATABASE_URL!,{ssl:'require',prepare:false,max:1});let id='';
 try{await db`update prayer_app.member_roster set is_notice_officer=true,notice_officer_title='총무' where id=${e2eAccounts.member.rosterId}::uuid`;await login(page,'admin');const r=await page.request.post('/api/admin/notices',{data:{title:'임원 확인 검증',body:'안내',status:'published'}});id=(await r.json()).notice.id;await login(page);await page.goto('/notices/'+id);await expect(page.locator('.notice-confirmation-identity:visible')).toContainText(['성도검증(총무)']);await page.getByRole('button',{name:'확인했습니다',exact:true}).click();await expect(page.getByRole('button',{name:'확인 완료',exact:true})).toBeDisabled();for(const width of [320,390,430]){await page.setViewportSize({width,height:844});await expectNoOverflow(page);}}
 finally{if(id)await db`delete from prayer_app.notices where id=${id}::uuid`;await db`update prayer_app.member_roster set is_notice_officer=false,notice_officer_title='' where id=${e2eAccounts.member.rosterId}::uuid`;await db.end();}
});
