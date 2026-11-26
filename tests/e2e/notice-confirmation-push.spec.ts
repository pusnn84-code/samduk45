import {test,expect} from '@playwright/test';
import postgres from 'postgres';
import {randomUUID,createECDH,randomBytes} from 'node:crypto';
import {login} from './helpers';
import {e2eAccounts} from '../fixtures/e2e-data';
import {savePushSubscription,removePushSubscription} from '../../src/features/push/devices';
test.use({serviceWorkers:'block'});
test('explicit confirmation queues one named alert only to the pastor, not to other members',async({page,browser})=>{
 test.skip(process.env.CI!=='true'||process.env.E2E_DATABASE_READY!=='1'||!['127.0.0.1','localhost'].includes(new URL(process.env.DATABASE_URL!).hostname),'Disposable CI only');
 const db=postgres(process.env.DATABASE_URL!,{ssl:'require',prepare:false,max:1}),ctx=await browser.newContext({serviceWorkers:'block'}),key=randomUUID();let id='';
 const ec=createECDH('prime256v1');ec.generateKeys();const keys={p256dh:ec.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')},prefs={notices:true,community:false,reading:false,pastoral:true,personal:true};const endpoint=(role:string)=>'https://fcm.googleapis.com/fcm/send/ack-e2e-'+role+'-'+key;
 try{
  for(const role of ['admin','member'] as const)await savePushSubscription(e2eAccounts[role].userId!,{endpoint:endpoint(role),keys,preferences:prefs},'Synthetic no-delivery device');
  await db`update prayer_app.member_roster set is_notice_officer=true where id=${e2eAccounts.member.rosterId}::uuid`;
  await login(page,'admin');const response=await page.request.post('/api/admin/notices',{data:{title:'공지 확인 알림 검증',body:'본문은 알림에 넣지 않습니다.',status:'published'}});expect(response.status()).toBe(201);id=(await response.json()).notice.id;
  const member=await ctx.newPage();await login(member);await member.goto('/notices/'+id);await expect(member.getByRole('button',{name:'확인했습니다',exact:true})).toBeVisible();
  const initial=await(await member.request.get('/api/notices/'+id+'/confirmations')).json();expect(await db`select id from prayer_app.push_delivery_queue where kind='admin_notice_confirmation' and source_key like ${id+':%'}`).toHaveLength(0);
  await member.getByRole('button',{name:'확인했습니다',exact:true}).click();await expect(member.getByRole('button',{name:'확인 완료',exact:true})).toBeDisabled();
  for(let i=0;i<2;i++)expect((await member.request.post('/api/notices/'+id+'/confirmations',{data:{revision:initial.revision}})).status()).toBe(200);
  const rows=await db`select recipient_id,topic,source_key from prayer_app.push_delivery_queue where kind='admin_notice_confirmation' and source_key like ${id+':%'}`;expect(rows).toHaveLength(1);expect(rows[0].recipient_id).toBe(e2eAccounts.admin.userId);expect(rows[0].topic).toBe('pastoral');expect(rows[0].source_key).toBe(id+':'+e2eAccounts.member.rosterId+':'+initial.revision);
  expect((await page.request.post('/api/notices/'+id+'/confirmations',{data:{revision:initial.revision}})).status()).toBe(200);expect(await db`select id from prayer_app.push_delivery_queue where kind='admin_notice_confirmation' and source_key like ${id+':%'}`).toHaveLength(1);
 }finally{await ctx.close();await removePushSubscription(e2eAccounts.admin.userId!,endpoint('admin'));await removePushSubscription(e2eAccounts.member.userId!,endpoint('member'));if(id)await db`delete from prayer_app.notices where id=${id}::uuid`;await db`update prayer_app.member_roster set is_notice_officer=false where id=${e2eAccounts.member.rosterId}::uuid`;await db.end();}
});
