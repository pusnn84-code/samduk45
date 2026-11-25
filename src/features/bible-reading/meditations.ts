import {getDb,rows,sql} from "../pastoral/db";
import {getBibleReadingDay} from "../../content/bible-reading-plan";
import {DomainError} from "../../lib/http";
import type {BibleReadingState} from "./types";
type Input={id:string;date:string;sharing:string;sharingAnonymous:boolean};
type Stored={id:string;owner:string;date:string;text:string|null;anonymous:boolean;number:number|null};
export async function withMeditations(state:BibleReadingState,userId:string):Promise<BibleReadingState>{
 const lines=await rows<{id:string;name:string;text:string;isOwn:boolean;anonymous:boolean;empathyCount:number;commentCount:number;hasEmpathized:boolean;observedAt:string}>(getDb(),sql`
 select s.sharing_id as id,case when s.sharing_anonymous then '무명'||s.anonymous_number else u.display_name end as name,
 s.sharing as text,s.user_id=${userId}::uuid as "isOwn",s.sharing_anonymous as anonymous,
 (select count(*)::int from prayer_app.bible_sharing_empathy e join prayer_app.users r on r.id=e.user_id and r.is_active where e.sharing_id=s.sharing_id) as "empathyCount",
 (select count(*)::int from prayer_app.meditation_comments c join prayer_app.users commenter on commenter.id=c.user_id and commenter.is_active where c.sharing_id=s.sharing_id) as "commentCount",
 exists(select 1 from prayer_app.bible_sharing_empathy e where e.sharing_id=s.sharing_id and e.user_id=${userId}::uuid) as "hasEmpathized",
 to_char(statement_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "observedAt"
 from prayer_app.bible_reading_shares s join prayer_app.users u on u.id=s.user_id and u.is_active
 where s.reading_date=${state.date}::date and s.sharing is not null order by s.sharing_updated_at,s.sharing_id`);
 return {...state,observedAt:lines[0]?.observedAt??state.observedAt,sharedLines:lines.map(line=>({id:line.id,name:line.name,text:line.text,isOwn:line.isOwn,anonymous:line.anonymous,empathyCount:Number(line.empathyCount),commentCount:Number(line.commentCount??0),hasEmpathized:line.hasEmpathized}))};
}
export async function mutateMeditation(userId:string,method:"POST"|"PATCH"|"DELETE",input:Input|{id:string;date:string}){
 if(!getBibleReadingDay(input.date))throw new DomainError("INVALID_READING_DATE",400);
 await getDb().transaction(async tx=>{
  // The same date lock is used by older clients when they allocate anonymous names.
  await tx.execute(sql`select pg_advisory_xact_lock(560046,hashtext(${input.date}))`);
  const [existing]=await rows<Stored>(tx,sql`select sharing_id as id,user_id as owner,reading_date::text as date,sharing as text,sharing_anonymous as anonymous,anonymous_number as number from prayer_app.bible_reading_shares where sharing_id=${input.id}::uuid for update`);
  if(method==="POST"&&existing){
   if("sharing" in input&&existing.owner===userId&&existing.date===input.date&&existing.text===input.sharing&&existing.anonymous===input.sharingAnonymous)return;
   throw new DomainError("MEDITATION_CONFLICT",409);
  }
  if(method!=="POST"&&(!existing||existing.owner!==userId||existing.date!==input.date||existing.text===null))throw new DomainError("SHARING_NOT_FOUND",404);
  if(method==="DELETE"){await tx.execute(sql`update prayer_app.bible_reading_shares set sharing=null where sharing_id=${input.id}::uuid and user_id=${userId}::uuid`);return;}
  if(!("sharing" in input))throw new DomainError("INVALID_INPUT",400);
  let number=existing?.number??null;
  if(input.sharingAnonymous&&number===null){
   const [allocated]=await rows<{next:number}>(tx,sql`select coalesce(max(n),0)+1 as next from (select anonymous_number as n from prayer_app.bible_reading_shares where reading_date=${input.date}::date union all select anonymous_number as n from prayer_app.bible_reading_entries where reading_date=${input.date}::date) a`);
   number=Number(allocated.next);
  }
  if(method==="POST")await tx.execute(sql`insert into prayer_app.bible_reading_shares(sharing_id,user_id,reading_date,sharing,sharing_anonymous,anonymous_number) values(${input.id}::uuid,${userId}::uuid,${input.date}::date,${input.sharing},${input.sharingAnonymous},${number})`);
  else await tx.execute(sql`update prayer_app.bible_reading_shares set sharing=${input.sharing},sharing_anonymous=${input.sharingAnonymous},anonymous_number=${number} where sharing_id=${input.id}::uuid and user_id=${userId}::uuid`);
 });
}
