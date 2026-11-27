import webPush from 'web-push';
import {getDb,rows,sql} from '../pastoral/db';
import {DomainError} from '../../lib/http';
import {pushConfig} from './config';
import {defaultPreferences,normalizePreferences,safePushEndpoint,type PushPreferences} from './policy';
export type PushTarget={endpoint:string;p256dh:string;auth:string};
export type BrowserPushSubscription={endpoint:string;keys:{p256dh:string;auth:string};preferences?:PushPreferences};
export function pushStatusCode(e:unknown){return e&&typeof e==='object'&&'statusCode' in e?Number(e.statusCode):0;}
export async function deviceStatus(userId:string,endpoint:string){
 const [row]=await rows<{preferences:PushPreferences}>(getDb(),sql`select d.preferences from prayer_app.push_subscriptions p join prayer_app.push_devices d on d.subscription_id=p.id where p.user_id=${userId}::uuid and p.endpoint=${endpoint}`);
 return {enabled:Boolean(row),preferences:normalizePreferences(row?.preferences??defaultPreferences)};
}
export async function savePushSubscription(userId:string,subscription:BrowserPushSubscription,userAgent:string|null){
 const preferences=normalizePreferences(subscription.preferences??defaultPreferences);
 await getDb().transaction(async tx=>{
  await tx.execute(sql`select id from prayer_app.users where id=${userId}::uuid for update`);
  const [count]=await rows<{n:number}>(tx,sql`select count(*)::int as n from prayer_app.push_subscriptions where user_id=${userId}::uuid and endpoint<>${subscription.endpoint}`);
  if(count.n>=10)throw new DomainError('TOO_MANY_PUSH_DEVICES',429);
  const [saved]=await rows<{id:string}>(tx,sql`insert into prayer_app.push_subscriptions(user_id,endpoint,p256dh,auth,user_agent,last_seen_at)
   values(${userId}::uuid,${subscription.endpoint},${subscription.keys.p256dh},${subscription.keys.auth},${userAgent?.slice(0,500)??null},now())
   on conflict(endpoint) do update set user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,user_agent=excluded.user_agent,last_seen_at=now() returning id`);
  await tx.execute(sql`delete from prayer_app.push_delivery_queue where subscription_id=${saved.id}::uuid and recipient_id<>${userId}::uuid`);
  await tx.execute(sql`insert into prayer_app.push_devices(subscription_id,preferences) values(${saved.id}::uuid,${JSON.stringify(preferences)}::jsonb)
   on conflict(subscription_id) do update set preferences=excluded.preferences`);
 });
}
export async function updatePushPreferences(userId:string,endpoint:string,preferences:PushPreferences){
 const result=await rows(getDb(),sql`update prayer_app.push_devices d set preferences=${JSON.stringify(normalizePreferences(preferences))}::jsonb from prayer_app.push_subscriptions p where p.id=d.subscription_id and p.user_id=${userId}::uuid and p.endpoint=${endpoint} returning d.subscription_id`);
 if(!result.length)throw new DomainError('NOT_FOUND',404);
}
export async function removePushSubscription(userId:string,endpoint:string){await getDb().execute(sql`delete from prayer_app.push_subscriptions where user_id=${userId}::uuid and endpoint=${endpoint}`);}
export async function sendDevicePush(target:PushTarget,payload:unknown){
 if(!safePushEndpoint(target.endpoint))throw new DomainError('INVALID_PUSH_ENDPOINT',400);
 const config=await pushConfig();if(!config)throw new DomainError('PUSH_NOT_CONFIGURED',503);
 await webPush.sendNotification({endpoint:target.endpoint,keys:{p256dh:target.p256dh,auth:target.auth}},JSON.stringify(payload),{vapidDetails:config,TTL:3600,urgency:'normal',timeout:5000});
}
export async function sendTestPush(userId:string,endpoint:string){
 const [target]=await rows<PushTarget>(getDb(),sql`update prayer_app.push_devices d set last_test_at=now() from prayer_app.push_subscriptions p where p.id=d.subscription_id and p.user_id=${userId}::uuid and p.endpoint=${endpoint} and (d.last_test_at is null or d.last_test_at<now()-interval '1 minute') returning p.endpoint,p.p256dh,p.auth`);
 if(!target)throw new DomainError('PUSH_TEST_NOT_READY',429);
 try{await sendDevicePush(target,{title:'삼덕사오 · 알림 확인',body:'이 휴대폰에서 삼덕사오 알림을 받을 수 있습니다.',url:'/profile',tag:'samduk45-test'});}
 catch(e){if([404,410].includes(pushStatusCode(e)))await removePushSubscription(userId,endpoint);throw e;}
}
