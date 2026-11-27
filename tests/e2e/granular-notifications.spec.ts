import {test,expect} from '@playwright/test';
import postgres from 'postgres';
import {randomUUID} from 'node:crypto';
import {login,expectNoOverflow} from './helpers';
import {e2eAccounts,e2ePublishedNoticeId} from '../fixtures/e2e-data';
import {notificationEntryUrl} from '../../src/features/push/destination';
test.use({serviceWorkers:'block'});
test('notification links restore login, focus the exact meditation and protect anonymous questions',async({page,browser})=>{
 test.skip(process.env.CI!=='true'||process.env.E2E_DATABASE_READY!=='1'||!['127.0.0.1','localhost'].includes(new URL(process.env.DATABASE_URL!).hostname),'Disposable CI only');test.setTimeout(120000);
 const db=postgres(process.env.DATABASE_URL!,{ssl:'require',prepare:false,max:1}),share=randomUUID(),question=randomUUID(),visit=randomUUID(),ctx=await browser.newContext({serviceWorkers:'block'});const day='2026-11-26';
 try{
  await db`insert into prayer_app.bible_reading_shares(sharing_id,user_id,reading_date,sharing,sharing_anonymous,anonymous_number) values(${share}::uuid,${e2eAccounts.member.userId}::uuid,${day},'알림으로 찾아온 묵상',true,47)`;
  await db`insert into prayer_app.questions(id,owner_user_id,title) values(${question}::uuid,${e2eAccounts.member.userId}::uuid,'알림의 비공개 질문')`;
  const [message]=await db`insert into prayer_app.question_messages(question_id,sender,content) values(${question}::uuid,'member','익명 대화 내용') returning id::text`;
  await db`insert into prayer_app.visit_requests(id,requester_user_id,visit_date,visit_type,attendees,location,preferred_time,reason,status) values(${visit}::uuid,${e2eAccounts.member.userId}::uuid,${day},'personal','','알림 심방 장소','14:00','비공개 사유','confirmed')`;
  await login(page);await page.request.post('/api/auth/logout');await page.goto(notificationEntryUrl('notice',e2ePublishedNoticeId));await expect(page).toHaveURL(/\/login\?next=/);
  const change=page.getByRole('button',{name:'다른 계정으로 로그인',exact:true});if(await change.isVisible())await change.click();await page.getByLabel('이름 (아이디)').fill(e2eAccounts.member.name);await page.getByLabel('비밀번호',{exact:true}).fill(e2eAccounts.member.phone.slice(-6));await page.getByRole('button',{name:'로그인',exact:true}).click();await expect(page).toHaveURL(new RegExp('/notices/'+e2ePublishedNoticeId+'$'));
  await page.goto(notificationEntryUrl('reading',share));await expect(page).toHaveURL(new RegExp('/bible-reading\\?date='+day+'&sharing='+share+'$'));const target=page.locator('.bible-reading-lines li[data-notification-target=true]:visible');await expect(target).toContainText('알림으로 찾아온 묵상');await expect(target).toContainText('무명47');await expect(target).toBeFocused();
  const denied=await page.goto(notificationEntryUrl('admin_question',message.id));expect(denied?.status()).toBe(404);await expect(page.getByText('익명 대화 내용',{exact:true})).toHaveCount(0);
  const pastor=await ctx.newPage();await login(pastor,'admin');await pastor.goto(notificationEntryUrl('admin_question',message.id));await expect(pastor).toHaveURL(new RegExp('/questions\\?id='+question+'$'));await expect(pastor.locator('.questions-thread:visible')).toContainText('익명 대화 내용');
  await pastor.goto(notificationEntryUrl('admin_visit',visit));await expect(pastor).toHaveURL(new RegExp('/admin/visits\\?id='+visit+'$'));await expect(pastor.getByLabel('장소',{exact:true})).toHaveValue('알림 심방 장소');
  await page.bringToFront();await page.goto(notificationEntryUrl('own_visit',visit));await expect(page.locator('.visit-event-card[data-notification-target=true]:visible')).toContainText('알림 심방 장소');
  await page.addInitScript(()=>{const registration={pushManager:{getSubscription:async()=>null}};Object.defineProperty(navigator,'serviceWorker',{value:{register:async()=>registration,ready:Promise.resolve(registration)},configurable:true});Object.defineProperty(window,'PushManager',{value:class{},configurable:true});Object.defineProperty(window,'Notification',{value:class{static permission='default'},configurable:true});});
  await page.goto('/profile');const settings=page.getByRole('region',{name:'휴대폰 알림',exact:true});await expect(settings.getByLabel('공지 알림',{exact:true})).toBeVisible();await expect(settings.getByLabel('묵상 알림',{exact:true})).toBeVisible();await expect(settings.getByLabel('도란도란 알림',{exact:true})).toBeVisible();await expect(settings.getByLabel('심방 신청 알림',{exact:true})).toHaveCount(0);for(const width of [320,390,430]){await page.setViewportSize({width,height:844});await expectNoOverflow(page);}
 }finally{await ctx.close();await page.goto('about:blank');await db`delete from prayer_app.bible_reading_shares where sharing_id=${share}::uuid`;await db`delete from prayer_app.questions where id=${question}::uuid`;await db`delete from prayer_app.visit_requests where id=${visit}::uuid`;await db.end();}
});
