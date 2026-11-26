import {randomUUID} from 'node:crypto';
import {getDb,rows,sql} from '../pastoral/db';
import {confirmationSourceMatches,noticeConfirmationDetails} from './notice-confirmation';
import {noticeConfirmationPayload,pushPayload,type PushKind} from './policy';
import {pushConfig} from './config';
import {sendDevicePush,pushStatusCode,type PushTarget} from './devices';
type Delivery=PushTarget&{id:string;recipientId:string;subscriptionId:string;kind:PushKind;sourceKey:string;eventKey:string;topic:string;attempts:number};
export async function deliveryEligible(d:Delivery){
 const [row]=await rows<{allowed:boolean}>(getDb(),sql`select exists(select 1 from prayer_app.push_subscriptions p
  join prayer_app.push_devices dev on dev.subscription_id=p.id join prayer_app.users u on u.id=p.user_id and u.is_active
  where p.id=${d.subscriptionId}::uuid and p.user_id=${d.recipientId}::uuid and p.endpoint=${d.endpoint} and p.auth=${d.auth} and p.p256dh=${d.p256dh}
  and coalesce((dev.preferences->>${d.topic})::boolean,false) and (case
   when ${d.kind}='notice' then exists(select 1 from prayer_app.notices n where n.id::text=${d.sourceKey} and n.status='published')
   when ${d.kind}='community' then exists(select 1 from prayer_app.community_posts c where c.id::text=${d.sourceKey} and c.published_at is not null)
   when ${d.kind}='reading' then exists(select 1 from prayer_app.bible_reading_shares b where b.sharing_id::text=${d.sourceKey} and nullif(btrim(b.sharing),'') is not null)
   when ${d.kind}='own_visit' then exists(select 1 from prayer_app.visit_requests v where v.id::text=${d.sourceKey} and v.requester_user_id=u.id and v.status='confirmed' and not v.is_unavailable)
   when ${d.kind}='own_question' then exists(select 1 from prayer_app.question_messages m join prayer_app.questions q on q.id=m.question_id where m.id::text=${d.sourceKey} and m.sender='pastor' and q.owner_user_id=u.id)
   else u.role='admin' and exists(select 1 from prayer_app.question_settings qs where qs.id=1 and qs.pastor_user_id=u.id) and (case
    when ${d.kind}='admin_notice_confirmation' then exists(select 1 from prayer_app.notice_confirmations c join prayer_app.notices n on n.id=c.notice_id join prayer_app.member_roster r on r.id=c.roster_id left join prayer_app.notice_images ni on ni.notice_id=n.id where ${confirmationSourceMatches(d.sourceKey)})
    when ${d.kind}='admin_prayer' then exists(select 1 from prayer_app.prayer_requests r where r.id::text=${d.sourceKey})
    when ${d.kind}='admin_visit' then exists(select 1 from prayer_app.visit_requests v where v.id::text=${d.sourceKey} and v.status='requested' and not v.is_unavailable)
    when ${d.kind}='admin_report' then exists(select 1 from prayer_app.pastoral_reports r where r.id::text=${d.sourceKey} and r.submitted_at is not null)
    when ${d.kind}='admin_question' then exists(select 1 from prayer_app.question_messages m where m.id::text=${d.sourceKey} and m.sender='member')
    else false end)
   end)) as allowed`);
 return row?.allowed===true;
}
export async function dispatchPush(maxBatches=20){
 const [waiting]=await rows<{ready:boolean}>(getDb(),sql`select exists(select 1 from prayer_app.push_delivery_queue where (state='pending' or (state='working' and lease_until<now())) and next_attempt_at<=now() and attempts<5 and created_at>now()-interval '1 day') as ready`);
 if(!waiting?.ready||!await pushConfig())return {sent:0};let sent=0;const deadline=Date.now()+45000;
 for(let batch=0;batch<maxBatches&&Date.now()<deadline;batch++){
  const lease=randomUUID();
  const due=await rows<Delivery>(getDb(),sql`with candidates as(select id from prayer_app.push_delivery_queue
   where (state='pending' or (state='working' and lease_until<now())) and next_attempt_at<=now() and attempts<5 and created_at>now()-interval '1 day'
   order by created_at limit 30 for update skip locked), claimed as(update prayer_app.push_delivery_queue q set state='working',lease=${lease}::uuid,lease_until=now()+interval '90 seconds',attempts=attempts+1 from candidates c where q.id=c.id returning q.*)
   select q.id,q.recipient_id as "recipientId",q.subscription_id as "subscriptionId",q.kind,q.source_key as "sourceKey",q.event_key as "eventKey",q.topic,q.attempts,p.endpoint,p.p256dh,p.auth from claimed q join prayer_app.push_subscriptions p on p.id=q.subscription_id`);
  if(!due.length)break;let index=0;
  await Promise.all(Array.from({length:Math.min(6,due.length)},async()=>{while(index<due.length){const d=due[index++];
   try{
    if(!await deliveryEligible(d)){await finish(d.id,lease,'cancelled');continue;}
    const payload=pushPayload(d.kind,d.eventKey);
    if(d.kind==='admin_notice_confirmation'){const detail=await noticeConfirmationDetails(d.sourceKey);if(!detail){await finish(d.id,lease,'cancelled');continue;}await sendDevicePush(d,noticeConfirmationPayload(d.eventKey,detail));}
    else await sendDevicePush(d,payload);await finish(d.id,lease,'sent');sent++;
   }catch(e){
    if([404,410].includes(pushStatusCode(e))){await getDb().execute(sql`delete from prayer_app.push_subscriptions where id=${d.subscriptionId}::uuid and user_id=${d.recipientId}::uuid and endpoint=${d.endpoint} and auth=${d.auth}`);continue;}
    await getDb().execute(sql`update prayer_app.push_delivery_queue set state=${d.attempts>=5?'failed':'pending'},lease=null,lease_until=null,next_attempt_at=now()+interval '1 minute'*least(60,power(2,attempts)::int) where id=${d.id}::uuid and lease=${lease}::uuid`);
   }
  }}));
 }
 await getDb().execute(sql`delete from prayer_app.push_delivery_queue where created_at<now()-interval '7 days'`);
 return {sent};
}
async function finish(id:string,lease:string,state:string){await getDb().execute(sql`update prayer_app.push_delivery_queue set state=${state},finished_at=now(),lease=null,lease_until=null where id=${id}::uuid and lease=${lease}::uuid`);}
