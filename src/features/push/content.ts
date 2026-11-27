import {getDb,rows,sql,type Executor} from '../pastoral/db';
import {cleanPushName,pushPayload,noticeConfirmationPayload,type PushKind} from './policy';
import {noticeConfirmationDetails} from './notice-confirmation';
import {notificationSource,notificationEntryUrl} from './destination';
type Content={body:string;target:string};
export async function notificationContent(recipientId:string,kind:PushKind,source:string,db:Executor=getDb()):Promise<Content|null>{
 const parsed=notificationSource(kind,source);if(!parsed)return null;
 const [recipient]=await rows<{role:string;pastor:boolean}>(db,sql`select u.role,exists(select 1 from prayer_app.question_settings qs where qs.id=1 and qs.pastor_user_id=u.id) as pastor from prayer_app.users u where u.id=${recipientId}::uuid and u.is_active`);
 if(!recipient||(kind.startsWith('admin_')&&(recipient.role!=='admin'||!recipient.pastor)))return null;
 const author=sql`coalesce(r.source_name,a.display_name,'작성자')`;
 if(kind==='notice'){
  const [item]=await rows<{name:string}>(db,sql`select ${author} as name from prayer_app.notices n join prayer_app.users a on a.id=n.author_user_id left join prayer_app.member_roster r on r.id=a.roster_id where n.id=${source}::uuid and n.status='published'`);return item?{body:cleanPushName(item.name)+'님이 새 공지를 올렸습니다.',target:'/notices/'+source}:null;
 }
 if(kind==='community'){
  const [item]=await rows<{name:string;photo:boolean}>(db,sql`select ${author} as name,exists(select 1 from prayer_app.community_files f where f.post_id=c.id) as photo from prayer_app.community_posts c join prayer_app.users a on a.id=c.author_user_id left join prayer_app.member_roster r on r.id=a.roster_id where c.id=${source}::uuid and c.published_at is not null`);return item?{body:cleanPushName(item.name)+(item.photo?'님이 사진과 이야기를 올렸습니다.':'님이 새 글을 올렸습니다.'),target:'/community?post='+source}:null;
 }
 if(kind==='reading'){
  const [item]=await rows<{name:string;anonymous:boolean;number:number|null;date:string}>(db,sql`select ${author} as name,b.sharing_anonymous as anonymous,b.anonymous_number as number,b.reading_date::text as date from prayer_app.bible_reading_shares b join prayer_app.users a on a.id=b.user_id left join prayer_app.member_roster r on r.id=a.roster_id where b.sharing_id=${source}::uuid and nullif(btrim(b.sharing),'') is not null`);return item?{body:(item.anonymous?'무명'+(item.number??''):cleanPushName(item.name))+'님이 묵상 나눔을 남겼습니다.',target:'/bible-reading?'+new URLSearchParams({date:item.date,sharing:source})}:null;
 }
 if(kind==='admin_report'){
  const [item]=await rows<{name:string;sam:string;entryKind:string|null}>(db,sql`select ${author} as name,p.sam_name as sam,p.form->>'entryKind' as "entryKind" from prayer_app.pastoral_reports p join prayer_app.users a on a.id=p.author_user_id left join prayer_app.member_roster r on r.id=a.roster_id where p.id=${source}::uuid and p.submitted_at is not null`);return item?{body:cleanPushName(item.name)+'님이 '+cleanPushName(item.sam).replace(/샘$/u,'')+'샘 '+(item.entryKind==='meeting'?'모임 기록을':item.entryKind==='member'?'샘원 소식을':'목양지를')+' 제출했습니다.',target:'/admin/pastoral-reports?id='+source}:null;
 }
 if(kind==='admin_visit'||kind==='own_visit'){
  const [item]=await rows<{name:string;owner:string;date:string;status:string}>(db,sql`select ${author} as name,v.requester_user_id as owner,v.visit_date::text as date,v.status from prayer_app.visit_requests v join prayer_app.users a on a.id=v.requester_user_id left join prayer_app.member_roster r on r.id=a.roster_id where v.id=${source}::uuid and not v.is_unavailable`);
  if(!item||(kind==='own_visit'&&(item.owner!==recipientId||item.status!=='confirmed')))return null;
  return kind==='admin_visit'?{body:cleanPushName(item.name)+'님이 심방을 신청했습니다.',target:'/admin/visits?id='+source}:{body:'신청하신 심방이 확정되었습니다.',target:'/visits?'+new URLSearchParams({date:item.date,visit:source})};
 }
 if(kind==='admin_prayer'){
  const [item]=await rows<{name:string}>(db,sql`select ${author} as name from prayer_app.prayer_requests p join prayer_app.users a on a.id=p.user_id left join prayer_app.member_roster r on r.id=a.roster_id where p.id=${source}::uuid`);return item?{body:cleanPushName(item.name)+'님이 기도를 요청했습니다.',target:'/admin/prayer-requests?id='+source}:null;
 }
 if(kind==='admin_question'||kind==='own_question'){
  const [item]=await rows<{id:string;owner:string;sender:string}>(db,sql`select q.id,q.owner_user_id as owner,m.sender from prayer_app.question_messages m join prayer_app.questions q on q.id=m.question_id where m.id=${source}::bigint`);if(!item||(kind==='own_question'&&(item.owner!==recipientId||item.sender!=='pastor'))||(kind==='admin_question'&&item.sender!=='member'))return null;return {body:kind==='admin_question'?'새로운 질문이 도착했습니다.':'목사님이 답변을 남겼습니다.',target:'/questions?id='+item.id};
 }
 if(kind==='admin_notice_confirmation'){const detail=await noticeConfirmationDetails(source,db);return detail?{body:noticeConfirmationPayload('unused',detail).body,target:'/notices/'+detail.noticeId}:null;}
 return null;
}
export async function sourcePushPayload(recipientId:string,kind:PushKind,source:string,eventKey:string){const content=await notificationContent(recipientId,kind,source);return content?{...pushPayload(kind,eventKey),body:content.body,url:notificationEntryUrl(kind,source)}:null;}
