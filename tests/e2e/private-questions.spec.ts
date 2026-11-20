import { expect,test } from "@playwright/test";
import { login,expectNoOverflow } from "./helpers";
import { e2eAccounts } from "../fixtures/e2e-data";
import postgres from "postgres";
test.describe('private anonymous pastor conversations',()=>{
 test.skip(process.env.E2E_DATABASE_READY!=='1','Disposable database only');
 test('member sends, pastor answers, identity stays private and unrelated accounts are excluded',async({page,browser})=>{
  test.setTimeout(120000);
  await page.setViewportSize({width:390,height:844});await login(page);
  await page.getByRole('link',{name:'질문있습니다',exact:true}).first().click();
  await expect(page.getByRole('heading',{name:'질문있습니다',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'질문하기',exact:true}).click();
  await page.getByLabel('제목',{exact:true}).fill('검증용 비공개 질문');
  await page.getByLabel('나누고 싶은 이야기').fill('신앙과 삶에 대해 궁금합니다.');
  const sent=page.waitForResponse(r=>r.url().endsWith('/api/questions')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'목사님께 보내기'}).click();
  const response=await sent;expect(response.status()).toBe(201);const {id}=await response.json();
  await expect(page.getByText('신앙과 삶에 대해 궁금합니다.',{exact:true})).toBeVisible();
  await expectNoOverflow(page);
  await page.goto('/');
  const pastorContext=await browser.newContext(),outsiderContext=await browser.newContext();
  const db=postgres(process.env.DATABASE_URL!,{ssl:'require',max:1,prepare:false});
  try{
   const pastor=await pastorContext.newPage();await login(pastor,'admin');
   expect((await pastor.request.get('/api/questions/unread')).status()).toBe(200);
   expect((await (await pastor.request.get('/api/questions/unread')).json()).count).toBeGreaterThan(0);
   const raw=await pastor.request.get(`/api/questions/${id}`);expect(raw.status()).toBe(200);
   const body=await raw.json(),serialized=JSON.stringify(body);
   expect(serialized).not.toContain(e2eAccounts.member.name);expect(serialized).not.toContain(e2eAccounts.member.userId);expect(serialized).not.toContain(e2eAccounts.member.phone);
   expect(Object.keys(body).sort()).toEqual(['hasMore','id','messages','pastor','title']);
   await pastor.goto('/questions');await pastor.getByRole('button',{name:/검증용 비공개 질문/}).first().click();
   await expect(pastor.getByText('무명',{exact:true}).first()).toBeVisible();
   await pastor.getByLabel('답변',{exact:true}).fill('함께 말씀을 살피며 기도하겠습니다.');
   await pastor.getByRole('button',{name:'보내기',exact:true}).click();
   await expect(pastor.getByText('함께 말씀을 살피며 기도하겠습니다.',{exact:true})).toBeVisible();
   expect((await (await page.request.get('/api/questions/unread')).json()).count).toBeGreaterThan(0);
   const own=await (await page.request.get(`/api/questions/${id}`)).json();
   expect(own.messages.at(-1).sender).toBe('pastor');
   await page.request.patch(`/api/questions/${id}`,{data:{through:own.messages.at(-1).id}});
   expect((await (await page.request.get('/api/questions/unread')).json()).count).toBe(0);
   const outsider=await outsiderContext.newPage();await login(outsider,'newcomer');
   expect((await outsider.request.get(`/api/questions/${id}`)).status()).toBe(404);
   expect((await outsider.request.post(`/api/questions/${id}`,{data:{content:'권한 없는 답변'}})).status()).toBe(404);
   expect((await outsider.request.patch(`/api/questions/${id}`,{data:{through:own.messages[0].id}})).status()).toBe(404);
   // Deputies and even other full admins are not the designated private pastor.
   await db`update prayer_app.member_roster set is_deputy_admin=true where id=${e2eAccounts.newcomer.rosterId}::uuid`;
   expect((await outsider.request.get(`/api/questions/${id}`)).status()).toBe(404);
   await db`update prayer_app.users set role='admin' where roster_id=${e2eAccounts.newcomer.rosterId}::uuid`;
   expect((await outsider.request.get(`/api/questions/${id}`)).status()).toBe(404);
   const otherList=await (await outsider.request.get('/api/questions')).json();expect(otherList.pastor).toBe(false);expect(otherList.items.some((x:{id:string})=>x.id===id)).toBe(false);
   expect((await page.request.post('/api/questions',{headers:{Origin:'https://evil.example'},data:{title:'외부',content:'금지'}})).status()).toBe(403);
   expect((await page.request.post('/api/questions',{data:{title:'',content:'내용'}})).status()).toBe(400);
   expect((await page.request.post('/api/questions',{data:{title:'제목',content:'내용',owner_user_id:e2eAccounts.admin.userId}})).status()).toBe(400);
   expect((await page.request.get('/api/questions/not-a-uuid')).status()).toBe(400);
   expect(raw.headers()['cache-control']).toContain('no-store');
   const guest=await browser.newContext();try{const p=await guest.newPage();expect((await p.request.get('/api/questions')).status()).toBe(401);}finally{await guest.close();}
   const tables=await db`select relname,relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='prayer_app' and relname in ('questions','question_messages','question_settings')`;
   expect(tables).toHaveLength(3);expect(tables.every(t=>t.relrowsecurity)).toBe(true);
  }finally{
   await db`update prayer_app.users set role='member' where roster_id=${e2eAccounts.newcomer.rosterId}::uuid`;
   await db`update prayer_app.member_roster set is_deputy_admin=false where id=${e2eAccounts.newcomer.rosterId}::uuid`;
   await db`delete from prayer_app.questions where id=${id}::uuid`;
   await db.end();await pastorContext.close();await outsiderContext.close();
  }
 });
});
