import {createHash} from 'node:crypto';
import {getDb,rows,sql} from '../pastoral/db';
import {DomainError} from '../../lib/http';
import {validateAnswerKeys,type SamjiBlock,type SamjiRecordInput} from './policy';
import type {z} from 'zod';
import type {DocumentInput} from './policy';
export type SamjiDocument={id:string;date:string;title:string;content:SamjiBlock[];sourceName:string};
export type SamjiSaved={version:number;answers:Record<string,string>;notes:{id:string;text:string}[];updatedAt:string|null};
export async function listSamji(userId:string,own:boolean,page:number){
 const items=await rows<{id:string;date:string;title:string;updatedAt:string|null;answered:number;total:number}>(getDb(),sql`
  select d.id,d.issue_date::text as date,d.title,r.updated_at::text as "updatedAt",
  coalesce((select count(*)::int from jsonb_each_text(r.answers) a where btrim(a.value)<>''),0) as answered,
  (select count(*)::int from jsonb_array_elements(d.content) b where b->>'kind'='question') as total
  from prayer_app.samji_documents d left join prayer_app.samji_records r on r.document_id=d.id and r.owner_user_id=${userId}::uuid
  where (${!own} or r.owner_user_id is not null)
  order by ${own?sql`r.updated_at desc`:sql`d.issue_date desc,d.created_at desc`} limit 13 offset ${page*12}`);
 return {items:items.slice(0,12),hasMore:items.length>12};
}
export async function samjiDetail(id:string,userId:string){
 const [document]=await rows<SamjiDocument>(getDb(),sql`select id,issue_date::text as date,title,content,source_name as "sourceName" from prayer_app.samji_documents where id=${id}::uuid`);
 if(!document)throw new DomainError('NOT_FOUND',404);
 const [saved]=await rows<SamjiSaved>(getDb(),sql`select version,answers,notes,updated_at::text as "updatedAt" from prayer_app.samji_records where document_id=${id}::uuid and owner_user_id=${userId}::uuid`);
 return {document,record:saved??{version:0,answers:{},notes:[],updatedAt:null}};
}
export async function createSamji(authorId:string,input:z.infer<typeof DocumentInput>,name:string,pdf:Uint8Array){
 const hash=createHash('sha256').update(pdf).digest('hex');
 return getDb().transaction(async tx=>{
  await tx.execute(sql`select id from prayer_app.users where id=${authorId}::uuid for update`);
  const existing=await rows<{id:string}>(tx,sql`select id from prayer_app.samji_documents where issue_date=${input.date}::date and source_sha256=${hash}`);if(existing.length)return existing[0];
  const [rate]=await rows<{n:number}>(tx,sql`select count(*)::int as n from prayer_app.samji_documents where author_user_id=${authorId}::uuid and created_at>now()-interval '1 minute'`);if(rate.n>=5)throw new DomainError('TOO_MANY_REQUESTS',429);
  const [created]=await rows<{id:string}>(tx,sql`insert into prayer_app.samji_documents(id,author_user_id,issue_date,title,content,source_name,source_sha256,source_data)
   values(${input.id}::uuid,${authorId}::uuid,${input.date}::date,${input.title},${JSON.stringify(input.content)}::jsonb,${name},${hash},decode(${Buffer.from(pdf).toString('base64')},'base64')) on conflict(issue_date,source_sha256) do update set source_sha256=prayer_app.samji_documents.source_sha256 returning id`);return created;
 });
}
export async function saveSamji(id:string,userId:string,input:SamjiRecordInput){
 const {document}=await samjiDetail(id,userId);if(!validateAnswerKeys(document.content,input.answers))throw new DomainError('INVALID_ANSWER',400);
 const answers=JSON.stringify(input.answers),notes=JSON.stringify(input.notes);
 const result=input.version===0?await rows<SamjiSaved>(getDb(),sql`insert into prayer_app.samji_records(document_id,owner_user_id,answers,notes) values(${id}::uuid,${userId}::uuid,${answers}::jsonb,${notes}::jsonb) on conflict(document_id,owner_user_id) do nothing returning version,answers,notes,updated_at::text as "updatedAt"`):await rows<SamjiSaved>(getDb(),sql`update prayer_app.samji_records set answers=${answers}::jsonb,notes=${notes}::jsonb,version=version+1,updated_at=now() where document_id=${id}::uuid and owner_user_id=${userId}::uuid and version=${input.version} returning version,answers,notes,updated_at::text as "updatedAt"`);
 if(result.length)return result[0];
 // A retried request whose response was lost is successful if the exact data is already stored.
 const [current]=await rows<SamjiSaved>(getDb(),sql`select version,answers,notes,updated_at::text as "updatedAt" from prayer_app.samji_records where document_id=${id}::uuid and owner_user_id=${userId}::uuid and answers=${answers}::jsonb and notes=${notes}::jsonb`);
 if(current)return current;throw new DomainError('RECORD_CHANGED',409);
}
export async function samjiPdf(id:string){const [file]=await rows<{data:Buffer;name:string}>(getDb(),sql`select source_data as data,source_name as name from prayer_app.samji_documents where id=${id}::uuid`);if(!file)throw new DomainError('NOT_FOUND',404);return file;}
