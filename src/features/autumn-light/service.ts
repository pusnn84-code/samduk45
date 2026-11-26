import {getDb,rows,sql,type Executor} from "../pastoral/db";
import {DomainError} from "../../lib/http";
import {todayInSeoul,addDays} from "../challenge/date";
import {assertAutumnEdit,type AutumnCreateInput,type AutumnPatchInput,type AutumnListFilter} from "./policy";
import type {AutumnActor,AutumnCard,AutumnSam,AutumnParticipants,AutumnComment,AutumnCommentsPage} from "./types";

const samName=sql`regexp_replace(s.name,'샘$','')`;
const eligible=sql`p.active and s.is_active and ${samName} ~ '^[1-5]-[1-9][0-9]*$'`;
const author=sql`coalesce(p.source_author_name,u.display_name,'작성자')`;
const joins=sql`from prayer_app.autumn_people p join prayer_app.sams s on s.id=p.sam_id left join prayer_app.users u on u.id=p.created_by_user_id`;
function columns(actor:AutumnActor){return sql`p.id,p.person_name as name,p.sam_id as "samId",${samName}||'샘' as "samName",split_part(${samName},'-',1)::int as village,${author} as "authorName",p.prayer,p.visited,p.registered,p.version,
 (select count(*)::int from prayer_app.autumn_prayers r join prayer_app.users ru on ru.id=r.user_id and ru.is_active where r.person_id=p.id) as count,
 exists(select 1 from prayer_app.autumn_prayers r where r.person_id=p.id and r.user_id=${actor.id}::uuid) as prayed,
 (${actor.role==="admin"} or p.created_by_user_id=${actor.id}::uuid) is true as "canEdit",
 (${actor.role==="admin"} or p.created_by_user_id=${actor.id}::uuid or exists(select 1 from prayer_app.autumn_card_authors ca join prayer_app.users owner_user on owner_user.roster_id=ca.roster_id where ca.person_id=p.id and owner_user.id=${actor.id}::uuid and owner_user.is_active)) is true as "canComment",
 (select count(*)::int from prayer_app.autumn_comments c where c.person_id=p.id) as "commentCount"`;}

export async function listAutumnSams(db:Executor=getDb()):Promise<AutumnSam[]>{
 return rows<AutumnSam>(db,sql`select s.id,${samName}||'샘' as name,split_part(${samName},'-',1)::int as village from prayer_app.sams s where s.is_active and ${samName} ~ '^[1-5]-[1-9][0-9]*$' order by split_part(${samName},'-',1)::int,split_part(${samName},'-',2)::int,s.id`);
}
async function validSam(id:string,db:Executor){
 const [sam]=await rows<{id:string}>(db,sql`select s.id from prayer_app.sams s where s.id=${id}::uuid and s.is_active and ${samName} ~ '^[1-5]-[1-9][0-9]*$'`);
 if(!sam)throw new DomainError("INVALID_SAM",400);
}
export async function getAutumnCard(actor:AutumnActor,id:string,db:Executor=getDb()):Promise<AutumnCard>{
 const [card]=await rows<AutumnCard>(db,sql`select ${columns(actor)} ${joins} where p.id=${id}::uuid and ${eligible}`);
 if(!card)throw new DomainError("AUTUMN_NOT_FOUND",404);return card;
}
export async function getAutumnDaily(actor:AutumnActor,db:Executor=getDb(),date=todayInSeoul()){
 await db.execute(sql`insert into prayer_app.autumn_daily(prayer_date,person_id)
 select ${date}::date,p.id ${joins} where ${eligible}
 order by coalesce(p.id=(select person_id from prayer_app.autumn_daily where prayer_date=${addDays(date,-1)}::date),false),random() limit 1
 on conflict(prayer_date) do nothing`);
 const [daily]=await rows<{id:string}>(db,sql`select person_id as id from prayer_app.autumn_daily where prayer_date=${date}::date`);
 return {date,card:daily?await getAutumnCard(actor,daily.id,db):null};
}
export async function listAutumnCards(actor:AutumnActor,filter:AutumnListFilter,db:Executor=getDb()){
 const conditions=sql`${eligible}
  ${filter.village?sql`and split_part(${samName},'-',1)::int=${filter.village}`:sql``}
  ${filter.samId?sql`and p.sam_id=${filter.samId}::uuid`:sql``}
  ${filter.q?sql`and position(lower(${filter.q}) in lower(p.person_name||' '||${author}))>0`:sql``}`;
 const [cards,[count]]=await Promise.all([
  rows<AutumnCard>(db,sql`select ${columns(actor)} ${joins} where ${conditions} order by p.person_name,p.id limit 21 offset ${filter.page*20}`),
  rows<{total:number}>(db,sql`select count(*)::int as total ${joins} where ${conditions}`),
 ]);
 return {cards:cards.slice(0,20),hasMore:cards.length>20,total:Number(count?.total??0)};
}
export async function createAutumnCard(actor:AutumnActor,input:AutumnCreateInput){
 return getDb().transaction(async tx=>{
  const [previous]=await rows<{id:string}>(tx,sql`select id from prayer_app.autumn_people where created_by_user_id=${actor.id}::uuid and submission_key=${input.submissionKey}::uuid`);
  if(previous)return getAutumnCard(actor,previous.id,tx);
  await validSam(input.samId,tx);
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.samId+":"+input.name.toLocaleLowerCase("ko")},0))`);
  const [retry]=await rows<{id:string}>(tx,sql`select id from prayer_app.autumn_people where created_by_user_id=${actor.id}::uuid and submission_key=${input.submissionKey}::uuid`);
  if(retry)return getAutumnCard(actor,retry.id,tx);
  if(!input.allowDuplicate){const [duplicate]=await rows<{id:string}>(tx,sql`select id from prayer_app.autumn_people where active and sam_id=${input.samId}::uuid and lower(btrim(person_name))=lower(${input.name}) limit 1`);if(duplicate)throw new DomainError("AUTUMN_POSSIBLE_DUPLICATE",409);}
  const [saved]=await rows<{id:string}>(tx,sql`insert into prayer_app.autumn_people(person_name,sam_id,created_by_user_id,submission_key,prayer) values(${input.name},${input.samId}::uuid,${actor.id}::uuid,${input.submissionKey}::uuid,${input.prayer}) returning id`);
  return getAutumnCard(actor,saved.id,tx);
 });
}
export async function updateAutumnCard(actor:AutumnActor,id:string,input:AutumnPatchInput){
 return getDb().transaction(async tx=>{
  const [card]=await rows<{creator:string|null;version:number}>(tx,sql`select created_by_user_id as creator,version from prayer_app.autumn_people where id=${id}::uuid and active for update`);
  if(!card)throw new DomainError("AUTUMN_NOT_FOUND",404);
  assertAutumnEdit(actor,card.creator,input);
  if(card.version!==input.expectedVersion)throw new DomainError("AUTUMN_CONFLICT",409);
  if(input.samId)await validSam(input.samId,tx);
  await tx.execute(sql`update prayer_app.autumn_people set person_name=coalesce(${input.name??null},person_name),sam_id=coalesce(${input.samId??null}::uuid,sam_id),prayer=coalesce(${input.prayer??null},prayer),visited=coalesce(${input.visited??null}::boolean,visited),registered=coalesce(${input.registered??null}::boolean,registered),version=version+1,updated_at=now(),updated_by_user_id=${actor.id}::uuid where id=${id}::uuid`);
  return getAutumnCard(actor,id,tx);
 });
}
export async function setAutumnPrayer(actor:AutumnActor,id:string,prayed:boolean){
 return getDb().transaction(async tx=>{
  await getAutumnCard(actor,id,tx);
  if(prayed)await tx.execute(sql`insert into prayer_app.autumn_prayers(person_id,user_id) values(${id}::uuid,${actor.id}::uuid) on conflict(person_id,user_id) do nothing`);
  else await tx.execute(sql`delete from prayer_app.autumn_prayers where person_id=${id}::uuid and user_id=${actor.id}::uuid`);
  return getAutumnCard(actor,id,tx);
 });
}
export async function listAutumnParticipants(actor:AutumnActor,id:string,page=0,db:Executor=getDb()):Promise<AutumnParticipants>{
 await getAutumnCard(actor,id,db);
 const people=await rows<{name:string}>(db,sql`select u.display_name as name from prayer_app.autumn_prayers r join prayer_app.users u on u.id=r.user_id and u.is_active where r.person_id=${id}::uuid order by r.created_at,u.id limit 51 offset ${page*50}`);
 return {names:people.slice(0,50).map(p=>p.name),hasMore:people.length>50};
}

export async function listAutumnComments(actor:AutumnActor,id:string,page=0,db:Executor=getDb()):Promise<AutumnCommentsPage>{
 await getAutumnCard(actor,id,db);
 const comments=await rows<AutumnComment>(db,sql`select c.id,u.display_name as name,c.body,c.created_at as "createdAt",(${actor.role==="admin"} or c.user_id=${actor.id}::uuid) as "canDelete" from prayer_app.autumn_comments c join prayer_app.users u on u.id=c.user_id where c.person_id=${id}::uuid order by c.created_at,c.id limit 51 offset ${page*50}`);
 return {comments:comments.slice(0,50),hasMore:comments.length>50};
}
export async function createAutumnComment(actor:AutumnActor,id:string,input:{body:string;submissionKey:string}){
 return getDb().transaction(async tx=>{
  // Check ownership server-side, including the exact roster binding for PDF imports.
  const card=await getAutumnCard(actor,id,tx);if(!card.canComment)throw new DomainError("FORBIDDEN",403);
  await tx.execute(sql`insert into prayer_app.autumn_comments(person_id,user_id,body,submission_key) values(${id}::uuid,${actor.id}::uuid,${input.body},${input.submissionKey}::uuid) on conflict(person_id,user_id,submission_key) do nothing`);
  return {card:await getAutumnCard(actor,id,tx)};
 });
}
export async function deleteAutumnComment(actor:AutumnActor,id:string,commentId:string){
 return getDb().transaction(async tx=>{
  await getAutumnCard(actor,id,tx);
  const removed=await rows(tx,sql`delete from prayer_app.autumn_comments where id=${commentId}::uuid and person_id=${id}::uuid and (${actor.role==="admin"} or user_id=${actor.id}::uuid) returning id`);
  if(!removed.length)throw new DomainError("FORBIDDEN",403);return {card:await getAutumnCard(actor,id,tx)};
 });
}
