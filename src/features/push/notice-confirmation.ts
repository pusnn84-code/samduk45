import {getDb,rows,sql,type Executor} from "../pastoral/db";
// Keep the revision check identical to the notice displayed and acknowledged.
export function confirmationSourceMatches(sourceKey:string){return sql`c.notice_id::text||':'||c.roster_id::text||':'||c.notice_revision=${sourceKey}
 and n.status='published' and r.is_active and c.confirmed_by_user_id is not null
 and c.notice_revision=md5(jsonb_build_array(n.title,n.body,to_char(n.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US'),ni.version)::text)`;}
export async function noticeConfirmationDetails(sourceKey:string,db:Executor=getDb()){
 const [detail]=await rows<{noticeId:string;name:string}>(db,sql`select c.notice_id as "noticeId",r.source_name as name from prayer_app.notice_confirmations c join prayer_app.notices n on n.id=c.notice_id join prayer_app.member_roster r on r.id=c.roster_id left join prayer_app.notice_images ni on ni.notice_id=n.id where ${confirmationSourceMatches(sourceKey)}`);
 return detail??null;
}
